-- v18.5.0 — Lockdown de dinero para roles de proyectos (pedido de dirección, 12-jun-2026):
-- director_proyectos y equipo_proyectos NO acceden a nada financiero
-- (contratos, ventas/cotizaciones/leads, cobranza/hitos, facturas, compras, cxp, gastos).
-- Estado previo en BD: todas las tablas de dinero ya los excluían EXCEPTO hitos_cobranza,
-- que incluía director_proyectos. Esta migración cierra ese único hueco.
-- Frontend alineado: permisos.js (director_proyectos sin módulo 'ventas'),
-- Dashboard (skipFinanciero + widgets de dinero ocultos), Cierre (columna Monto oculta).
DROP POLICY IF EXISTS hitos_read ON public.hitos_cobranza;
CREATE POLICY hitos_read ON public.hitos_cobranza FOR SELECT TO authenticated
  USING (app_has_any_rol(VARIADIC ARRAY['direccion','admin','cobranza','ventas']));
