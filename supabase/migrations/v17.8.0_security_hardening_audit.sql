-- v17.8.0 — Hardening de seguridad (auditoría jun 2026)
-- ============================================================
-- P0.2: fijar search_path en la única función SECURITY DEFINER sin él.
-- P1.1: políticas de leads/cotizaciones de {public} -> authenticated (semántica idéntica;
--       NO eran explotables por anon — sus USING usan app_has_any_rol()/app_user_id() que
--       dan false/null para anon — pero unifica el modelo y evita errores futuros).
-- P1.2: guardas de autorización dentro de duplicar_* (SECURITY DEFINER bypassa RLS, así que
--       sin esto cualquier autenticado podía duplicar proyectos/actividades ajenos).
-- ============================================================

ALTER FUNCTION public.cotizacion_aprobar_workflow() SET search_path = public, pg_temp;

-- ---- P1.1 leads
DROP POLICY IF EXISTS leads_read ON public.leads;
CREATE POLICY leads_read ON public.leads FOR SELECT TO authenticated
  USING (app_has_any_rol(VARIADIC ARRAY['direccion'::text,'admin'::text]) OR (owner_id = app_user_id()));
DROP POLICY IF EXISTS leads_update ON public.leads;
CREATE POLICY leads_update ON public.leads FOR UPDATE TO authenticated
  USING (app_has_any_rol(VARIADIC ARRAY['direccion'::text,'admin'::text]) OR (owner_id = app_user_id()));
DROP POLICY IF EXISTS leads_insert ON public.leads;
CREATE POLICY leads_insert ON public.leads FOR INSERT TO authenticated
  WITH CHECK (app_has_any_rol(VARIADIC ARRAY['direccion'::text,'admin'::text,'ventas'::text]));
DROP POLICY IF EXISTS leads_delete ON public.leads;
CREATE POLICY leads_delete ON public.leads FOR DELETE TO authenticated
  USING (app_has_any_rol(VARIADIC ARRAY['direccion'::text]));

-- ---- P1.1 cotizaciones (cots_read ya era authenticated)
DROP POLICY IF EXISTS cots_insert ON public.cotizaciones;
CREATE POLICY cots_insert ON public.cotizaciones FOR INSERT TO authenticated
  WITH CHECK (app_has_any_rol(VARIADIC ARRAY['direccion'::text,'admin'::text,'ventas'::text]));
DROP POLICY IF EXISTS cots_update ON public.cotizaciones;
CREATE POLICY cots_update ON public.cotizaciones FOR UPDATE TO authenticated
  USING (app_has_any_rol(VARIADIC ARRAY['direccion'::text,'admin'::text]) OR ((app_user_rol() = 'ventas'::text) AND (vendedor_id = app_user_id()) AND (estado = ANY (ARRAY['Borrador'::text,'Enviada'::text]))));
DROP POLICY IF EXISTS cots_delete ON public.cotizaciones;
CREATE POLICY cots_delete ON public.cotizaciones FOR DELETE TO authenticated
  USING (app_has_any_rol(VARIADIC ARRAY['direccion'::text]) OR ((app_user_rol() = 'ventas'::text) AND (vendedor_id = app_user_id()) AND (estado = 'Borrador'::text)));

-- ---- P1.2 duplicar_actividad: guarda de rol/membresía
CREATE OR REPLACE FUNCTION public.duplicar_actividad(p_actividad_id uuid)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_new_id UUID;
  v_orig RECORD;
  v_max_num INTEGER;
BEGIN
  SELECT * INTO v_orig FROM public.actividades WHERE id = p_actividad_id;
  IF v_orig IS NULL THEN
    RAISE EXCEPTION 'Actividad no encontrada';
  END IF;

  IF NOT (public.app_has_any_rol(VARIADIC ARRAY['direccion'::text,'admin'::text,'director_proyectos'::text])
          OR public.app_es_miembro_proyecto(v_orig.proyecto_id)) THEN
    RAISE EXCEPTION 'No autorizado para duplicar esta actividad';
  END IF;

  SELECT COALESCE(MAX(numero), 0) + 1 INTO v_max_num
  FROM public.actividades
  WHERE proyecto_id = v_orig.proyecto_id
    AND COALESCE(parent_id::text, '') = COALESCE(v_orig.parent_id::text, '');

  INSERT INTO public.actividades (
    proyecto_id, parent_id, nombre, numero, inicio, fin,
    avance, estado, es_milestone, es_servicio_padre,
    responsable_id, notas, importancia, deps
  ) VALUES (
    v_orig.proyecto_id, v_orig.parent_id, v_orig.nombre || ' (copia)', v_max_num,
    v_orig.inicio, v_orig.fin, 0, 'Sin iniciar',
    v_orig.es_milestone, v_orig.es_servicio_padre,
    v_orig.responsable_id, v_orig.notas, v_orig.importancia, '[]'::jsonb
  ) RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$function$;

-- ---- P1.2 duplicar_proyecto: guarda de rol de gestión
CREATE OR REPLACE FUNCTION public.duplicar_proyecto(p_proyecto_id uuid, p_nuevo_nombre text DEFAULT NULL::text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_new_id UUID;
  v_old proyectos%ROWTYPE;
  v_next_num INTEGER;
  v_new_codigo TEXT;
  v_act RECORD;
  v_act_id_map JSONB := '{}'::JSONB;
  v_new_act_id UUID;
  v_dep_arr JSONB;
  v_new_deps JSONB;
  v_dep_item JSONB;
  v_mapped_dep_id UUID;
BEGIN
  IF NOT public.app_has_any_rol(VARIADIC ARRAY['direccion'::text,'admin'::text,'director_proyectos'::text]) THEN
    RAISE EXCEPTION 'No autorizado para duplicar proyectos';
  END IF;

  SELECT * INTO v_old FROM proyectos WHERE id = p_proyecto_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proyecto % no encontrado', p_proyecto_id;
  END IF;

  SELECT COALESCE(MAX(CAST(SUBSTRING(codigo FROM 'PRY-(\d+)') AS INTEGER)), 0) + 1
    INTO v_next_num FROM proyectos WHERE codigo ~ '^PRY-\d+$';
  v_new_codigo := 'PRY-' || LPAD(v_next_num::TEXT, 3, '0');

  INSERT INTO proyectos (
    codigo, nombre, cliente_id, director_id, estado, avance,
    inicio, cierre, capacidad_mw, ubicacion, descripcion,
    clasificacion, prioridad, tipo_proyecto, created_at
  ) VALUES (
    v_new_codigo, COALESCE(p_nuevo_nombre, v_old.nombre || ' (copia)'),
    v_old.cliente_id, v_old.director_id, 'Por iniciar', 0,
    v_old.inicio, v_old.cierre, v_old.capacidad_mw, v_old.ubicacion, v_old.descripcion,
    v_old.clasificacion, v_old.prioridad, v_old.tipo_proyecto, NOW()
  ) RETURNING id INTO v_new_id;

  FOR v_act IN SELECT * FROM actividades WHERE proyecto_id = p_proyecto_id ORDER BY numero
  LOOP
    INSERT INTO actividades (
      proyecto_id, numero, nombre, descripcion, responsable_id,
      inicio, fin, duracion_dias, estado, avance, completada,
      parent_id, es_servicio_padre, es_milestone, deps,
      peso, es_cobrable, estado_cobro, monto_cobrable, importancia, created_at
    ) VALUES (
      v_new_id, v_act.numero, v_act.nombre, v_act.descripcion, v_act.responsable_id,
      v_act.inicio, v_act.fin, v_act.duracion_dias, 'Sin iniciar', 0, false,
      NULL, v_act.es_servicio_padre, v_act.es_milestone, '[]'::JSONB,
      v_act.peso, v_act.es_cobrable, 'NA', v_act.monto_cobrable, v_act.importancia, NOW()
    ) RETURNING id INTO v_new_act_id;
    v_act_id_map := v_act_id_map || jsonb_build_object(v_act.id::TEXT, v_new_act_id::TEXT);
  END LOOP;

  FOR v_act IN SELECT * FROM actividades WHERE proyecto_id = p_proyecto_id
  LOOP
    v_new_act_id := (v_act_id_map ->> v_act.id::TEXT)::UUID;
    IF v_act.parent_id IS NOT NULL THEN
      UPDATE actividades SET parent_id = (v_act_id_map ->> v_act.parent_id::TEXT)::UUID WHERE id = v_new_act_id;
    END IF;
    v_dep_arr := COALESCE(v_act.deps, '[]'::JSONB);
    v_new_deps := '[]'::JSONB;
    FOR v_dep_item IN SELECT * FROM jsonb_array_elements(v_dep_arr)
    LOOP
      v_mapped_dep_id := (v_act_id_map ->> (v_dep_item ->> 'id'))::UUID;
      IF v_mapped_dep_id IS NOT NULL THEN
        v_new_deps := v_new_deps || jsonb_build_array(
          jsonb_build_object('id', v_mapped_dep_id::TEXT, 'tipo', COALESCE(v_dep_item ->> 'tipo', 'FS'))
        );
      END IF;
    END LOOP;
    UPDATE actividades SET deps = v_new_deps WHERE id = v_new_act_id;
  END LOOP;

  RETURN v_new_id;
END;
$function$;
