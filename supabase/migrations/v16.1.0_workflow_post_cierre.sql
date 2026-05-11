-- v16.1: Workflow Post-Cierre (CRM)
-- Cuando una cotización pasa a "Aprobada", se crean automáticamente 3 tareas
-- (Legal/Admin/Proyectos) con plazos en días hábiles. Validación previa: el
-- cliente debe tener RFC + dirección fiscal.

-- 1. Helper: sumar N días hábiles (salta sábados/domingos)
CREATE OR REPLACE FUNCTION public.sumar_dias_habiles(fecha_base date, n_dias int)
RETURNS date
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  resultado date := fecha_base;
  agregados int := 0;
  dow int;
BEGIN
  WHILE agregados < n_dias LOOP
    resultado := resultado + INTERVAL '1 day';
    dow := EXTRACT(DOW FROM resultado);  -- 0=Sun, 6=Sat
    IF dow NOT IN (0, 6) THEN
      agregados := agregados + 1;
    END IF;
  END LOOP;
  RETURN resultado;
END;
$$;

-- 2. Tabla tareas_post_cierre
CREATE TABLE IF NOT EXISTS public.tareas_post_cierre (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cotizacion_id uuid NOT NULL REFERENCES public.cotizaciones(id) ON DELETE CASCADE,
  departamento text NOT NULL CHECK (departamento IN ('legal', 'admin', 'proyectos')),
  titulo text NOT NULL,
  descripcion text,
  plazo_dias_habiles int NOT NULL,
  fecha_creacion timestamptz NOT NULL DEFAULT now(),
  fecha_limite date NOT NULL,
  asignado_a uuid REFERENCES public.usuarios(id),
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'en_curso', 'completada', 'vencida')),
  archivo_path text,
  notas text,
  completada_en timestamptz,
  completada_por uuid REFERENCES public.usuarios(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cotizacion_id, departamento)
);

CREATE INDEX IF NOT EXISTS idx_tareas_post_cierre_cot ON public.tareas_post_cierre (cotizacion_id);
CREATE INDEX IF NOT EXISTS idx_tareas_post_cierre_asignado ON public.tareas_post_cierre (asignado_a);
CREATE INDEX IF NOT EXISTS idx_tareas_post_cierre_estado ON public.tareas_post_cierre (estado, fecha_limite);

-- 3. Columnas en cotizaciones para aprobación de Ventas
ALTER TABLE public.cotizaciones ADD COLUMN IF NOT EXISTS workflow_aprobado_en timestamptz;
ALTER TABLE public.cotizaciones ADD COLUMN IF NOT EXISTS workflow_aprobado_por uuid REFERENCES public.usuarios(id);

-- 4. RLS
ALTER TABLE public.tareas_post_cierre ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tareas_pc_select ON public.tareas_post_cierre;
CREATE POLICY tareas_pc_select ON public.tareas_post_cierre
  FOR SELECT TO authenticated USING (
    public.app_has_any_rol('direccion','admin','ventas')
    OR (departamento = 'legal' AND public.app_has_any_rol('direccion'))
    OR (departamento = 'admin' AND public.app_has_any_rol('admin'))
    OR (departamento = 'proyectos' AND public.app_has_any_rol('director_proyectos'))
    OR asignado_a = public.app_user_id()
  );

DROP POLICY IF EXISTS tareas_pc_insert ON public.tareas_post_cierre;
CREATE POLICY tareas_pc_insert ON public.tareas_post_cierre
  FOR INSERT TO authenticated WITH CHECK (public.app_has_any_rol('direccion','admin'));

DROP POLICY IF EXISTS tareas_pc_update ON public.tareas_post_cierre;
CREATE POLICY tareas_pc_update ON public.tareas_post_cierre
  FOR UPDATE TO authenticated
  USING (
    public.app_has_any_rol('direccion','admin','ventas')
    OR (departamento = 'legal' AND public.app_has_any_rol('direccion'))
    OR (departamento = 'admin' AND public.app_has_any_rol('admin'))
    OR (departamento = 'proyectos' AND public.app_has_any_rol('director_proyectos'))
    OR asignado_a = public.app_user_id()
  )
  WITH CHECK (
    public.app_has_any_rol('direccion','admin','ventas','director_proyectos')
    OR asignado_a = public.app_user_id()
  );

DROP POLICY IF EXISTS tareas_pc_delete ON public.tareas_post_cierre;
CREATE POLICY tareas_pc_delete ON public.tareas_post_cierre
  FOR DELETE TO authenticated USING (public.app_has_any_rol('direccion'));

-- 5. Trigger BEFORE UPDATE en cotizaciones: validación + creación de tareas
CREATE OR REPLACE FUNCTION public.cotizacion_aprobar_workflow()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  cli RECORD;
  user_legal uuid;
  user_admin uuid;
  user_proy uuid;
  hoy date := CURRENT_DATE;
BEGIN
  IF NEW.estado = 'Aprobada' AND (OLD.estado IS DISTINCT FROM 'Aprobada') THEN
    -- Validación previa: cliente debe tener RFC + dirección fiscal
    SELECT id, razon_social, rfc, direccion INTO cli FROM public.clientes WHERE id = NEW.cliente_id;
    IF cli.id IS NULL THEN
      RAISE EXCEPTION 'No se puede aprobar la cotización: no tiene cliente asignado.';
    END IF;
    IF cli.rfc IS NULL OR cli.rfc = '' THEN
      RAISE EXCEPTION 'No se puede aprobar la cotización: el cliente "%" no tiene RFC. Edita el cliente primero.', cli.razon_social;
    END IF;
    IF cli.direccion IS NULL OR cli.direccion = '' THEN
      RAISE EXCEPTION 'No se puede aprobar la cotización: el cliente "%" no tiene dirección fiscal. Edita el cliente primero.', cli.razon_social;
    END IF;

    -- Auto-asignar al primer usuario activo de cada rol
    SELECT id INTO user_legal FROM public.usuarios WHERE rol = 'direccion' AND activo = true ORDER BY created_at LIMIT 1;
    SELECT id INTO user_admin FROM public.usuarios WHERE rol = 'admin' AND activo = true ORDER BY created_at LIMIT 1;
    SELECT id INTO user_proy FROM public.usuarios WHERE rol = 'director_proyectos' AND activo = true ORDER BY created_at LIMIT 1;
    IF user_admin IS NULL THEN user_admin := user_legal; END IF;
    IF user_proy IS NULL THEN user_proy := user_legal; END IF;

    -- Crear las 3 tareas (idempotente)
    INSERT INTO public.tareas_post_cierre (cotizacion_id, departamento, titulo, descripcion, plazo_dias_habiles, fecha_limite, asignado_a)
    VALUES
      (NEW.id, 'legal', 'Elaborar contrato de servicios',
       'Redactar el contrato de servicios con base en la cotización aceptada.', 3,
       public.sumar_dias_habiles(hoy, 3), user_legal),
      (NEW.id, 'admin', 'Generar factura y dar de alta cliente',
       'Crear la factura inicial y dar de alta al cliente en el sistema contable.', 2,
       public.sumar_dias_habiles(hoy, 2), user_admin),
      (NEW.id, 'proyectos', 'Crear orden de trabajo y cronograma',
       'Crear la orden de trabajo, planear alcances y cronograma del proyecto.', 5,
       public.sumar_dias_habiles(hoy, 5), user_proy)
    ON CONFLICT (cotizacion_id, departamento) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cotizacion_aprobar_workflow ON public.cotizaciones;
CREATE TRIGGER trg_cotizacion_aprobar_workflow
  BEFORE UPDATE ON public.cotizaciones
  FOR EACH ROW
  EXECUTE FUNCTION public.cotizacion_aprobar_workflow();

REVOKE EXECUTE ON FUNCTION public.cotizacion_aprobar_workflow() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cotizacion_aprobar_workflow() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.sumar_dias_habiles(date, int) FROM PUBLIC;

-- 6. Actualizar policies de storage para aceptar scope 'cotizaciones'
-- (los entregables del workflow se suben con path cotizaciones/{cot_id}/contratos/...)
DROP POLICY IF EXISTS "proyectos_docs_select" ON storage.objects;
CREATE POLICY "proyectos_docs_select" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'proyectos-docs' AND (
    ((storage.foldername(name))[1] = 'proyectos' AND
     EXISTS (SELECT 1 FROM public.proyectos p WHERE p.id::text = (storage.foldername(name))[2]))
    OR
    ((storage.foldername(name))[1] = 'plantas' AND
     EXISTS (SELECT 1 FROM public.plantas_electricas pe WHERE pe.id::text = (storage.foldername(name))[2]))
    OR
    ((storage.foldername(name))[1] = 'clientes' AND
     EXISTS (SELECT 1 FROM public.clientes c WHERE c.id::text = (storage.foldername(name))[2]))
    OR
    ((storage.foldername(name))[1] = 'cotizaciones' AND
     EXISTS (SELECT 1 FROM public.cotizaciones cot WHERE cot.id::text = (storage.foldername(name))[2]))
  )
);

DROP POLICY IF EXISTS "proyectos_docs_insert" ON storage.objects;
CREATE POLICY "proyectos_docs_insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'proyectos-docs' AND
  public.app_has_any_rol('direccion','admin','director_proyectos','ventas','cobranza','equipo_proyectos') AND
  (storage.foldername(name))[1] IN ('proyectos', 'plantas', 'clientes', 'cotizaciones')
);
