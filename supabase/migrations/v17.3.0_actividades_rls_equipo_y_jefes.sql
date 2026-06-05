-- ============================================================
-- v17.3.0 — RLS actividades: equipo por proyecto + jefes de proyectos
-- ============================================================
-- Problema (reportado por el equipo):
--   - equipo_proyectos NO podía actualizar estado de subactividades
--     ("Cannot coerce the result to a single JSON object" = 0 filas por RLS)
--   - equipo_proyectos NO podía crear subactividades
--     ("new row violates row-level security policy for table actividades")
--   Causa: la política exigía responsable_id = el mismo usuario, pero el 96%
--   de las subactividades tienen responsable_id NULL.
--
-- Decisión (Malio):
--   - equipo_proyectos puede crear/editar CUALQUIER actividad de un proyecto
--     donde tenga al menos UNA actividad asignada (es "miembro" del proyecto).
--   - Jefes de proyectos (flag es_jefe_proyectos) pueden mover TODO,
--     en todos los proyectos. Hoy: Helida Castro y Alfonso Prado.
--     (Malio=direccion y Edgar=director_proyectos ya tenían acceso por rol.)
-- ============================================================

-- 1) Flag de jefe de proyectos -------------------------------------------------
ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS es_jefe_proyectos boolean NOT NULL DEFAULT false;

UPDATE public.usuarios
  SET es_jefe_proyectos = true
  WHERE id IN (
    'acd2d647-2623-48ca-bca3-508d15c9b475',  -- Alfonso Prado
    'dcf20332-7120-4883-83e6-681e646987e6'   -- Helida Castro
  );

-- 2) Helpers SECURITY DEFINER (bypassan RLS por dentro, sin recursión) ---------
CREATE OR REPLACE FUNCTION public.app_es_jefe_proyectos()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
  SELECT COALESCE(
    (SELECT es_jefe_proyectos FROM public.usuarios WHERE auth_id = auth.uid() LIMIT 1),
    false
  );
$$;
GRANT EXECUTE ON FUNCTION public.app_es_jefe_proyectos() TO authenticated;

CREATE OR REPLACE FUNCTION public.app_es_miembro_proyecto(p_proyecto_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.actividades a
    WHERE a.proyecto_id = p_proyecto_id
      AND a.responsable_id = public.app_user_id()
  );
$$;
GRANT EXECUTE ON FUNCTION public.app_es_miembro_proyecto(uuid) TO authenticated;

-- 3) Políticas actividades -----------------------------------------------------
DROP POLICY IF EXISTS acts_insert ON public.actividades;
CREATE POLICY acts_insert ON public.actividades
  FOR INSERT TO authenticated
  WITH CHECK (
    public.app_has_any_rol('direccion','admin','director_proyectos')
    OR public.app_es_jefe_proyectos()
    OR (public.app_user_rol() = 'equipo_proyectos' AND public.app_es_miembro_proyecto(proyecto_id))
  );

DROP POLICY IF EXISTS acts_update ON public.actividades;
CREATE POLICY acts_update ON public.actividades
  FOR UPDATE TO authenticated
  USING (
    public.app_has_any_rol('direccion','admin','director_proyectos')
    OR public.app_es_jefe_proyectos()
    OR (public.app_user_rol() = 'equipo_proyectos' AND public.app_es_miembro_proyecto(proyecto_id))
  )
  WITH CHECK (
    public.app_has_any_rol('direccion','admin','director_proyectos')
    OR public.app_es_jefe_proyectos()
    OR (public.app_user_rol() = 'equipo_proyectos' AND public.app_es_miembro_proyecto(proyecto_id))
  );

DROP POLICY IF EXISTS acts_delete ON public.actividades;
CREATE POLICY acts_delete ON public.actividades
  FOR DELETE TO authenticated
  USING (
    public.app_has_any_rol('direccion','admin','director_proyectos')
    OR public.app_es_jefe_proyectos()
  );
