-- v15.10.13: agregar director_proyectos y cobranza a INSERT policy de clientes
-- Razón: director_proyectos necesita crear clientes al iniciar nuevos proyectos.
-- Cobranza puede registrar clientes nuevos al recibir facturación de proveedores nuevos.
-- Antes: solo direccion, admin, ventas. Esto bloqueaba a Edgar (director_proyectos)
-- al crear cliente "Equinix SA de CV" con error "new row violates row-level security policy".
DROP POLICY IF EXISTS clientes_insert ON public.clientes;
CREATE POLICY clientes_insert ON public.clientes
  FOR INSERT TO authenticated
  WITH CHECK (public.app_has_any_rol('direccion','admin','ventas','director_proyectos','cobranza'));
