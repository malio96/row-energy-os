-- v15.10.2 — Endurecer postventa_tickets RLS
-- equipo_proyectos pierde acceso (ya no aparece en su menú).
-- Reads ahora restringidos a roles con UI access; writes sin equipo_proyectos.

DROP POLICY IF EXISTS tickets_read ON public.postventa_tickets;
DROP POLICY IF EXISTS tickets_insert ON public.postventa_tickets;
DROP POLICY IF EXISTS tickets_update ON public.postventa_tickets;
DROP POLICY IF EXISTS tickets_delete ON public.postventa_tickets;

CREATE POLICY tickets_read ON public.postventa_tickets
  FOR SELECT TO authenticated
  USING (public.app_has_any_rol('direccion','admin','director_proyectos','ventas','cobranza'));

CREATE POLICY tickets_insert ON public.postventa_tickets
  FOR INSERT TO authenticated
  WITH CHECK (public.app_has_any_rol('direccion','admin','director_proyectos'));

CREATE POLICY tickets_update ON public.postventa_tickets
  FOR UPDATE TO authenticated
  USING (public.app_has_any_rol('direccion','admin','director_proyectos'))
  WITH CHECK (public.app_has_any_rol('direccion','admin','director_proyectos'));

CREATE POLICY tickets_delete ON public.postventa_tickets
  FOR DELETE TO authenticated
  USING (public.app_has_any_rol('direccion','admin'));
