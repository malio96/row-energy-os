-- v15.10.1 — Alinear RLS con cambios de matriz de permisos UI
-- ventas: read amplio (proyectos + finanzas + ops)
-- cobranza: + contratos, compras, cierre
-- director_proyectos: ya no ve cotizaciones, cot_items, contratos

DROP POLICY IF EXISTS contratos_read ON public.contratos;
CREATE POLICY contratos_read ON public.contratos
  FOR SELECT TO authenticated
  USING (public.app_has_any_rol('direccion','admin','ventas','cobranza'));

DROP POLICY IF EXISTS cots_read ON public.cotizaciones;
CREATE POLICY cots_read ON public.cotizaciones
  FOR SELECT TO authenticated
  USING (
    public.app_has_any_rol('direccion','admin','cobranza','ventas')
    OR vendedor_id = public.app_user_id()
  );

DROP POLICY IF EXISTS cot_items_read ON public.cotizacion_items;
CREATE POLICY cot_items_read ON public.cotizacion_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.cotizaciones c
      WHERE c.id = cotizacion_id
        AND (
          public.app_has_any_rol('direccion','admin','cobranza','ventas')
          OR c.vendedor_id = public.app_user_id()
        )
    )
  );

DROP POLICY IF EXISTS cierre_read ON public.cierre_checklist;
CREATE POLICY cierre_read ON public.cierre_checklist
  FOR SELECT TO authenticated
  USING (public.app_has_any_rol('direccion','admin','director_proyectos','ventas','cobranza'));

DROP POLICY IF EXISTS compras_read ON public.compras;
CREATE POLICY compras_read ON public.compras
  FOR SELECT TO authenticated
  USING (public.app_has_any_rol('direccion','admin','ventas','cobranza'));

DROP POLICY IF EXISTS facturas_read ON public.facturas;
CREATE POLICY facturas_read ON public.facturas
  FOR SELECT TO authenticated
  USING (public.app_has_any_rol('direccion','admin','cobranza','ventas'));

DROP POLICY IF EXISTS hitos_read ON public.hitos_cobranza;
CREATE POLICY hitos_read ON public.hitos_cobranza
  FOR SELECT TO authenticated
  USING (public.app_has_any_rol('direccion','admin','cobranza','director_proyectos','ventas'));

DROP POLICY IF EXISTS cxp_read ON public.cuentas_por_pagar;
CREATE POLICY cxp_read ON public.cuentas_por_pagar
  FOR SELECT TO authenticated
  USING (public.app_has_any_rol('direccion','admin','cobranza','ventas'));

DROP POLICY IF EXISTS gastos_read ON public.gastos_variables;
CREATE POLICY gastos_read ON public.gastos_variables
  FOR SELECT TO authenticated
  USING (public.app_has_any_rol('direccion','admin','ventas'));
