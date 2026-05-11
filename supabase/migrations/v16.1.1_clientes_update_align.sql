-- v16.1.1: Alinear UPDATE policy de clientes con INSERT (todos los roles operativos).
-- Antes solo direccion/admin/ventas podían editar; ahora también
-- director_proyectos y cobranza, que es necesario para completar campos
-- faltantes (RFC, dirección fiscal) tras crear un cliente.
DROP POLICY IF EXISTS clientes_update ON public.clientes;
CREATE POLICY clientes_update ON public.clientes
  FOR UPDATE TO authenticated
  USING (public.app_has_any_rol('direccion','admin','ventas','director_proyectos','cobranza'))
  WITH CHECK (public.app_has_any_rol('direccion','admin','ventas','director_proyectos','cobranza'));
