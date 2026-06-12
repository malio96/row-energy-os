-- v18.4.0 — Edición plena para equipo_proyectos (pedido de dirección, 12-jun-2026):
-- cualquier usuario del área de proyectos puede editar proyectos y mover todas
-- las actividades, sin requisito de membresía (app_es_miembro_proyecto causaba
-- fricción: si no eras responsable de ≥1 actividad del proyecto, no podías tocar nada).
-- Crear proyectos sigue en direccion/admin/director_proyectos; borrar solo direccion.
-- Frontend alineado: permisos.js puedeGestionarProyecto + Proyectos.jsx puedeEditarAct.

DROP POLICY IF EXISTS acts_insert ON public.actividades;
CREATE POLICY acts_insert ON public.actividades FOR INSERT TO authenticated
  WITH CHECK (app_has_any_rol(VARIADIC ARRAY['direccion','admin','director_proyectos','equipo_proyectos']) OR app_es_jefe_proyectos());

DROP POLICY IF EXISTS acts_update ON public.actividades;
CREATE POLICY acts_update ON public.actividades FOR UPDATE TO authenticated
  USING (app_has_any_rol(VARIADIC ARRAY['direccion','admin','director_proyectos','equipo_proyectos']) OR app_es_jefe_proyectos())
  WITH CHECK (app_has_any_rol(VARIADIC ARRAY['direccion','admin','director_proyectos','equipo_proyectos']) OR app_es_jefe_proyectos());

DROP POLICY IF EXISTS acts_delete ON public.actividades;
CREATE POLICY acts_delete ON public.actividades FOR DELETE TO authenticated
  USING (app_has_any_rol(VARIADIC ARRAY['direccion','admin','director_proyectos','equipo_proyectos']) OR app_es_jefe_proyectos());

DROP POLICY IF EXISTS proy_update ON public.proyectos;
CREATE POLICY proy_update ON public.proyectos FOR UPDATE TO authenticated
  USING (app_has_any_rol(VARIADIC ARRAY['direccion','admin','director_proyectos','equipo_proyectos']));
