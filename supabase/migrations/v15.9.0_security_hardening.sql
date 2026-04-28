-- ============================================================
-- v15.9.0 — Security Hardening (aplicado vía Supabase MCP, abr 2026)
-- ============================================================
-- 6 sub-migraciones aplicadas en orden. Snapshot consolidado del estado final.
-- Pasamos de 35 advisors → 6 (los 6 son intencionales: helpers RLS y RPCs by design).
-- ============================================================

-- ============================================================
-- FASE 1.1 — DROP tablas muertas (vacías, sin policies, sin uso en código)
-- ============================================================
DROP TABLE IF EXISTS public.adjuntos CASCADE;
DROP TABLE IF EXISTS public.comentarios CASCADE;
DROP TABLE IF EXISTS public.historial_actividad CASCADE;
DROP TABLE IF EXISTS public.pagos CASCADE;

-- ============================================================
-- FASE 1.4 — SECURITY DEFINER hardening
-- ============================================================
-- Fix search_path mutable en 7 funciones
ALTER FUNCTION public.cobrar_hito_al_pagar_factura() SET search_path = public, pg_temp;
ALTER FUNCTION public.crear_proyecto_desde_cotizacion() SET search_path = public, pg_temp;
ALTER FUNCTION public.duplicar_proyecto(uuid, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.aplicar_defaults_alertas(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.set_updated_at_plantas() SET search_path = public, pg_temp;
ALTER FUNCTION public.set_updated_at_sim() SET search_path = public, pg_temp;
ALTER FUNCTION public.trg_notas_updated_at() SET search_path = public, pg_temp;

-- REVOKE FROM PUBLIC en helpers RLS, GRANT solo a authenticated
REVOKE EXECUTE ON FUNCTION public.app_has_any_rol(text[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.app_user_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.app_user_rol() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.app_has_any_rol(text[]) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.app_user_id() TO authenticated;
GRANT  EXECUTE ON FUNCTION public.app_user_rol() TO authenticated;

-- RPCs útiles: solo authenticated
REVOKE EXECUTE ON FUNCTION public.duplicar_actividad(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.duplicar_proyecto(uuid, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.duplicar_actividad(uuid) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.duplicar_proyecto(uuid, text) TO authenticated;

-- Triggers internos y utilities: nadie. Solo se ejecutan vía trigger.
REVOKE EXECUTE ON FUNCTION public.cobrar_hito_al_pagar_factura()        FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.crear_proyecto_desde_cotizacion()     FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.trigger_auditoria()                   FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable()                     FROM PUBLIC, authenticated, anon;

-- ============================================================
-- FASE 1.2 + 1.3 — Endurecer policies débiles
-- ============================================================
-- cuentas_por_pagar: era qual=true para read+write
DROP POLICY IF EXISTS "Usuarios autenticados pueden leer cuentas_por_pagar" ON public.cuentas_por_pagar;
DROP POLICY IF EXISTS "Usuarios autenticados pueden modificar cuentas_por_pagar" ON public.cuentas_por_pagar;
CREATE POLICY cxp_read   ON public.cuentas_por_pagar FOR SELECT TO authenticated USING (public.app_has_any_rol('direccion','admin','cobranza'));
CREATE POLICY cxp_insert ON public.cuentas_por_pagar FOR INSERT TO authenticated WITH CHECK (public.app_has_any_rol('direccion','admin','cobranza'));
CREATE POLICY cxp_update ON public.cuentas_por_pagar FOR UPDATE TO authenticated USING (public.app_has_any_rol('direccion','admin','cobranza')) WITH CHECK (public.app_has_any_rol('direccion','admin','cobranza'));
CREATE POLICY cxp_delete ON public.cuentas_por_pagar FOR DELETE TO authenticated USING (public.app_has_any_rol('direccion'));

-- gastos_variables: idem
DROP POLICY IF EXISTS "Usuarios autenticados pueden leer gastos_variables" ON public.gastos_variables;
DROP POLICY IF EXISTS "Usuarios autenticados pueden modificar gastos_variables" ON public.gastos_variables;
CREATE POLICY gastos_read   ON public.gastos_variables FOR SELECT TO authenticated USING (public.app_has_any_rol('direccion','admin'));
CREATE POLICY gastos_insert ON public.gastos_variables FOR INSERT TO authenticated WITH CHECK (public.app_has_any_rol('direccion','admin'));
CREATE POLICY gastos_update ON public.gastos_variables FOR UPDATE TO authenticated USING (public.app_has_any_rol('direccion','admin')) WITH CHECK (public.app_has_any_rol('direccion','admin'));
CREATE POLICY gastos_delete ON public.gastos_variables FOR DELETE TO authenticated USING (public.app_has_any_rol('direccion'));

-- postventa_tickets: write era authenticated libre
DROP POLICY IF EXISTS tickets_read  ON public.postventa_tickets;
DROP POLICY IF EXISTS tickets_write ON public.postventa_tickets;
CREATE POLICY tickets_read   ON public.postventa_tickets FOR SELECT TO authenticated USING ((SELECT auth.role()) = 'authenticated');
CREATE POLICY tickets_insert ON public.postventa_tickets FOR INSERT TO authenticated WITH CHECK (public.app_has_any_rol('direccion','admin','director_proyectos','equipo_proyectos'));
CREATE POLICY tickets_update ON public.postventa_tickets FOR UPDATE TO authenticated USING (public.app_has_any_rol('direccion','admin','director_proyectos','equipo_proyectos')) WITH CHECK (public.app_has_any_rol('direccion','admin','director_proyectos','equipo_proyectos'));
CREATE POLICY tickets_delete ON public.postventa_tickets FOR DELETE TO authenticated USING (public.app_has_any_rol('direccion','admin'));

-- lead_actividades: write era authenticated libre
DROP POLICY IF EXISTS lead_acts_read  ON public.lead_actividades;
DROP POLICY IF EXISTS lead_acts_write ON public.lead_actividades;
CREATE POLICY lead_acts_read   ON public.lead_actividades FOR SELECT TO authenticated
  USING (public.app_has_any_rol('direccion','admin') OR EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id AND l.owner_id = public.app_user_id()));
CREATE POLICY lead_acts_insert ON public.lead_actividades FOR INSERT TO authenticated
  WITH CHECK (public.app_has_any_rol('direccion','admin') OR EXISTS (SELECT 1 FROM public.leads l WHERE l.id = lead_id AND l.owner_id = public.app_user_id()));
CREATE POLICY lead_acts_update ON public.lead_actividades FOR UPDATE TO authenticated
  USING (public.app_has_any_rol('direccion','admin') OR autor_id = public.app_user_id())
  WITH CHECK (public.app_has_any_rol('direccion','admin') OR autor_id = public.app_user_id());
CREATE POLICY lead_acts_delete ON public.lead_actividades FOR DELETE TO authenticated
  USING (public.app_has_any_rol('direccion','admin') OR autor_id = public.app_user_id());

-- notificaciones: faltaba INSERT y DELETE; agregamos
CREATE POLICY notif_insert ON public.notificaciones FOR INSERT TO authenticated
  WITH CHECK (destinatario_id IS NOT NULL OR destinatario_rol IS NOT NULL);
CREATE POLICY notif_delete_own ON public.notificaciones FOR DELETE TO authenticated
  USING (destinatario_id = public.app_user_id() OR public.app_has_any_rol('direccion','admin'));

-- ============================================================
-- FASE 1.5 — Performance: wrap auth.* + consolidar multiple permissive
-- (Recreamos todas las policies con FOR ALL → split en INSERT/UPDATE/DELETE
--  para evitar duplicación con FOR SELECT, y wrap auth.uid()/auth.role() en (select ...))
-- ============================================================

-- actividades
DROP POLICY IF EXISTS acts_read_all_auth ON public.actividades;
DROP POLICY IF EXISTS acts_write         ON public.actividades;
CREATE POLICY acts_read   ON public.actividades FOR SELECT TO authenticated USING (true);
CREATE POLICY acts_insert ON public.actividades FOR INSERT TO authenticated WITH CHECK (public.app_has_any_rol('direccion','admin','director_proyectos','equipo_proyectos'));
CREATE POLICY acts_update ON public.actividades FOR UPDATE TO authenticated USING (public.app_has_any_rol('direccion','admin','director_proyectos','equipo_proyectos')) WITH CHECK (public.app_has_any_rol('direccion','admin','director_proyectos','equipo_proyectos'));
CREATE POLICY acts_delete ON public.actividades FOR DELETE TO authenticated USING (public.app_has_any_rol('direccion','admin','director_proyectos'));

-- alertas_config (wrap auth.uid)
DROP POLICY IF EXISTS "Users insert own alert config" ON public.alertas_config;
DROP POLICY IF EXISTS "Users read own alert config"   ON public.alertas_config;
DROP POLICY IF EXISTS "Users update own alert config" ON public.alertas_config;
CREATE POLICY alertas_cfg_read   ON public.alertas_config FOR SELECT TO authenticated USING (usuario_id IN (SELECT u.id FROM public.usuarios u WHERE u.auth_id = (SELECT auth.uid())));
CREATE POLICY alertas_cfg_insert ON public.alertas_config FOR INSERT TO authenticated WITH CHECK (usuario_id IN (SELECT u.id FROM public.usuarios u WHERE u.auth_id = (SELECT auth.uid())));
CREATE POLICY alertas_cfg_update ON public.alertas_config FOR UPDATE TO authenticated
  USING (usuario_id IN (SELECT u.id FROM public.usuarios u WHERE u.auth_id = (SELECT auth.uid())))
  WITH CHECK (usuario_id IN (SELECT u.id FROM public.usuarios u WHERE u.auth_id = (SELECT auth.uid())));

-- auditoria
DROP POLICY IF EXISTS auditoria_read_direccion ON public.auditoria;
CREATE POLICY auditoria_read ON public.auditoria FOR SELECT TO authenticated USING (public.app_has_any_rol('direccion'));

-- cierre_checklist
DROP POLICY IF EXISTS cierre_read  ON public.cierre_checklist;
DROP POLICY IF EXISTS cierre_write ON public.cierre_checklist;
CREATE POLICY cierre_read   ON public.cierre_checklist FOR SELECT TO authenticated USING (public.app_has_any_rol('direccion','admin','director_proyectos'));
CREATE POLICY cierre_insert ON public.cierre_checklist FOR INSERT TO authenticated WITH CHECK (public.app_has_any_rol('direccion','admin','director_proyectos'));
CREATE POLICY cierre_update ON public.cierre_checklist FOR UPDATE TO authenticated USING (public.app_has_any_rol('direccion','admin','director_proyectos')) WITH CHECK (public.app_has_any_rol('direccion','admin','director_proyectos'));
CREATE POLICY cierre_delete ON public.cierre_checklist FOR DELETE TO authenticated USING (public.app_has_any_rol('direccion','admin'));

-- clientes
DROP POLICY IF EXISTS clientes_read_all ON public.clientes;
DROP POLICY IF EXISTS clientes_write    ON public.clientes;
CREATE POLICY clientes_read   ON public.clientes FOR SELECT TO authenticated USING (true);
CREATE POLICY clientes_insert ON public.clientes FOR INSERT TO authenticated WITH CHECK (public.app_has_any_rol('direccion','admin','ventas'));
CREATE POLICY clientes_update ON public.clientes FOR UPDATE TO authenticated USING (public.app_has_any_rol('direccion','admin','ventas')) WITH CHECK (public.app_has_any_rol('direccion','admin','ventas'));
CREATE POLICY clientes_delete ON public.clientes FOR DELETE TO authenticated USING (public.app_has_any_rol('direccion','admin'));

-- contratos
DROP POLICY IF EXISTS contratos_read  ON public.contratos;
DROP POLICY IF EXISTS contratos_write ON public.contratos;
CREATE POLICY contratos_read   ON public.contratos FOR SELECT TO authenticated USING (public.app_has_any_rol('direccion','admin','director_proyectos'));
CREATE POLICY contratos_insert ON public.contratos FOR INSERT TO authenticated WITH CHECK (public.app_has_any_rol('direccion','admin'));
CREATE POLICY contratos_update ON public.contratos FOR UPDATE TO authenticated USING (public.app_has_any_rol('direccion','admin')) WITH CHECK (public.app_has_any_rol('direccion','admin'));
CREATE POLICY contratos_delete ON public.contratos FOR DELETE TO authenticated USING (public.app_has_any_rol('direccion'));

-- cotizacion_items
DROP POLICY IF EXISTS cot_items_read  ON public.cotizacion_items;
DROP POLICY IF EXISTS cot_items_write ON public.cotizacion_items;
CREATE POLICY cot_items_read   ON public.cotizacion_items FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.cotizaciones c WHERE c.id = cotizacion_id AND (
    public.app_has_any_rol('direccion','admin','director_proyectos','cobranza') OR c.vendedor_id = public.app_user_id())));
CREATE POLICY cot_items_insert ON public.cotizacion_items FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.cotizaciones c WHERE c.id = cotizacion_id AND (
    public.app_has_any_rol('direccion','admin') OR (public.app_user_rol() = 'ventas' AND c.vendedor_id = public.app_user_id() AND c.estado IN ('Borrador','Enviada')))));
CREATE POLICY cot_items_update ON public.cotizacion_items FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.cotizaciones c WHERE c.id = cotizacion_id AND (
    public.app_has_any_rol('direccion','admin') OR (public.app_user_rol() = 'ventas' AND c.vendedor_id = public.app_user_id() AND c.estado IN ('Borrador','Enviada')))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.cotizaciones c WHERE c.id = cotizacion_id AND (
    public.app_has_any_rol('direccion','admin') OR (public.app_user_rol() = 'ventas' AND c.vendedor_id = public.app_user_id() AND c.estado IN ('Borrador','Enviada')))));
CREATE POLICY cot_items_delete ON public.cotizacion_items FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.cotizaciones c WHERE c.id = cotizacion_id AND (
    public.app_has_any_rol('direccion','admin') OR (public.app_user_rol() = 'ventas' AND c.vendedor_id = public.app_user_id() AND c.estado IN ('Borrador','Enviada')))));

-- facturas
DROP POLICY IF EXISTS facturas_read  ON public.facturas;
DROP POLICY IF EXISTS facturas_write ON public.facturas;
CREATE POLICY facturas_read   ON public.facturas FOR SELECT TO authenticated USING (public.app_has_any_rol('direccion','admin','cobranza'));
CREATE POLICY facturas_insert ON public.facturas FOR INSERT TO authenticated WITH CHECK (public.app_has_any_rol('direccion','admin','cobranza'));
CREATE POLICY facturas_update ON public.facturas FOR UPDATE TO authenticated USING (public.app_has_any_rol('direccion','admin','cobranza')) WITH CHECK (public.app_has_any_rol('direccion','admin','cobranza'));
CREATE POLICY facturas_delete ON public.facturas FOR DELETE TO authenticated USING (public.app_has_any_rol('direccion'));

-- hitos_cobranza
DROP POLICY IF EXISTS hitos_read  ON public.hitos_cobranza;
DROP POLICY IF EXISTS hitos_write ON public.hitos_cobranza;
CREATE POLICY hitos_read   ON public.hitos_cobranza FOR SELECT TO authenticated USING (public.app_has_any_rol('direccion','admin','cobranza','director_proyectos'));
CREATE POLICY hitos_insert ON public.hitos_cobranza FOR INSERT TO authenticated WITH CHECK (public.app_has_any_rol('direccion','admin','cobranza'));
CREATE POLICY hitos_update ON public.hitos_cobranza FOR UPDATE TO authenticated USING (public.app_has_any_rol('direccion','admin','cobranza')) WITH CHECK (public.app_has_any_rol('direccion','admin','cobranza'));
CREATE POLICY hitos_delete ON public.hitos_cobranza FOR DELETE TO authenticated USING (public.app_has_any_rol('direccion','admin'));

-- notificaciones (wrap)
DROP POLICY IF EXISTS notif_read_own   ON public.notificaciones;
DROP POLICY IF EXISTS notif_update_own ON public.notificaciones;
CREATE POLICY notif_read_own   ON public.notificaciones FOR SELECT TO authenticated
  USING (destinatario_id = public.app_user_id() OR destinatario_rol = public.app_user_rol() OR destinatario_id IS NULL);
CREATE POLICY notif_update_own ON public.notificaciones FOR UPDATE TO authenticated
  USING (destinatario_id = public.app_user_id())
  WITH CHECK (destinatario_id = public.app_user_id());

-- plantas_electricas
DROP POLICY IF EXISTS lectura_plantas_authenticated ON public.plantas_electricas;
DROP POLICY IF EXISTS escritura_plantas_directores  ON public.plantas_electricas;
CREATE POLICY plantas_read   ON public.plantas_electricas FOR SELECT TO authenticated USING (true);
CREATE POLICY plantas_insert ON public.plantas_electricas FOR INSERT TO authenticated WITH CHECK (public.app_has_any_rol('direccion','director_proyectos','admin'));
CREATE POLICY plantas_update ON public.plantas_electricas FOR UPDATE TO authenticated USING (public.app_has_any_rol('direccion','director_proyectos','admin')) WITH CHECK (public.app_has_any_rol('direccion','director_proyectos','admin'));
CREATE POLICY plantas_delete ON public.plantas_electricas FOR DELETE TO authenticated USING (public.app_has_any_rol('direccion','admin'));

-- plantilla_actividades
DROP POLICY IF EXISTS plantilla_acts_read  ON public.plantilla_actividades;
DROP POLICY IF EXISTS plantilla_acts_write ON public.plantilla_actividades;
CREATE POLICY plantilla_acts_read   ON public.plantilla_actividades FOR SELECT TO authenticated USING (true);
CREATE POLICY plantilla_acts_insert ON public.plantilla_actividades FOR INSERT TO authenticated WITH CHECK (public.app_has_any_rol('direccion','director_proyectos'));
CREATE POLICY plantilla_acts_update ON public.plantilla_actividades FOR UPDATE TO authenticated USING (public.app_has_any_rol('direccion','director_proyectos')) WITH CHECK (public.app_has_any_rol('direccion','director_proyectos'));
CREATE POLICY plantilla_acts_delete ON public.plantilla_actividades FOR DELETE TO authenticated USING (public.app_has_any_rol('direccion','director_proyectos'));

-- plantillas_proyecto
DROP POLICY IF EXISTS plantillas_read  ON public.plantillas_proyecto;
DROP POLICY IF EXISTS plantillas_write ON public.plantillas_proyecto;
CREATE POLICY plantillas_read   ON public.plantillas_proyecto FOR SELECT TO authenticated USING (true);
CREATE POLICY plantillas_insert ON public.plantillas_proyecto FOR INSERT TO authenticated WITH CHECK (public.app_has_any_rol('direccion','director_proyectos'));
CREATE POLICY plantillas_update ON public.plantillas_proyecto FOR UPDATE TO authenticated USING (public.app_has_any_rol('direccion','director_proyectos')) WITH CHECK (public.app_has_any_rol('direccion','director_proyectos'));
CREATE POLICY plantillas_delete ON public.plantillas_proyecto FOR DELETE TO authenticated USING (public.app_has_any_rol('direccion','director_proyectos'));

-- proyecto_notas (wrap auth.role)
DROP POLICY IF EXISTS notas_read        ON public.proyecto_notas;
DROP POLICY IF EXISTS notas_insert      ON public.proyecto_notas;
DROP POLICY IF EXISTS notas_update_own  ON public.proyecto_notas;
DROP POLICY IF EXISTS notas_delete_own  ON public.proyecto_notas;
CREATE POLICY notas_read       ON public.proyecto_notas FOR SELECT TO authenticated USING (true);
CREATE POLICY notas_insert     ON public.proyecto_notas FOR INSERT TO authenticated WITH CHECK (autor_id = public.app_user_id());
CREATE POLICY notas_update_own ON public.proyecto_notas FOR UPDATE TO authenticated USING (autor_id = public.app_user_id()) WITH CHECK (autor_id = public.app_user_id());
CREATE POLICY notas_delete_own ON public.proyecto_notas FOR DELETE TO authenticated USING (autor_id = public.app_user_id() OR public.app_has_any_rol('direccion','admin'));

-- proyecto_sim_etapas
DROP POLICY IF EXISTS lectura_authenticated_sim ON public.proyecto_sim_etapas;
DROP POLICY IF EXISTS escritura_directores_sim  ON public.proyecto_sim_etapas;
CREATE POLICY sim_read   ON public.proyecto_sim_etapas FOR SELECT TO authenticated USING (true);
CREATE POLICY sim_insert ON public.proyecto_sim_etapas FOR INSERT TO authenticated WITH CHECK (public.app_has_any_rol('direccion','director_proyectos','admin'));
CREATE POLICY sim_update ON public.proyecto_sim_etapas FOR UPDATE TO authenticated USING (public.app_has_any_rol('direccion','director_proyectos','admin')) WITH CHECK (public.app_has_any_rol('direccion','director_proyectos','admin'));
CREATE POLICY sim_delete ON public.proyecto_sim_etapas FOR DELETE TO authenticated USING (public.app_has_any_rol('direccion','admin'));

-- proyectos (wrap)
DROP POLICY IF EXISTS proy_read_all_auth ON public.proyectos;
CREATE POLICY proy_read ON public.proyectos FOR SELECT TO authenticated USING (true);

-- usuarios (consolidar UPDATE policies + wrap)
DROP POLICY IF EXISTS usuarios_read         ON public.usuarios;
DROP POLICY IF EXISTS usuarios_self_update  ON public.usuarios;
DROP POLICY IF EXISTS usuarios_update_dir   ON public.usuarios;
CREATE POLICY usuarios_read   ON public.usuarios FOR SELECT TO authenticated USING (true);
CREATE POLICY usuarios_update ON public.usuarios FOR UPDATE TO authenticated
  USING (public.app_has_any_rol('direccion','admin') OR auth_id = (SELECT auth.uid()))
  WITH CHECK (public.app_has_any_rol('direccion','admin') OR (auth_id = (SELECT auth.uid()) AND rol = (SELECT u.rol FROM public.usuarios u WHERE u.auth_id = (SELECT auth.uid()))));

-- ============================================================
-- FASE 1.5 (parte 2) — Foreign Key indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_actividades_cotizacion_item_id    ON public.actividades(cotizacion_item_id);
CREATE INDEX IF NOT EXISTS idx_actividades_parent_id             ON public.actividades(parent_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_usuario_id              ON public.auditoria(usuario_id);
CREATE INDEX IF NOT EXISTS idx_cierre_checklist_responsable_id   ON public.cierre_checklist(responsable_id);
CREATE INDEX IF NOT EXISTS idx_compras_aprobado_por              ON public.compras(aprobado_por);
CREATE INDEX IF NOT EXISTS idx_compras_solicitado_por            ON public.compras(solicitado_por);
CREATE INDEX IF NOT EXISTS idx_contratos_cliente_id              ON public.contratos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_cot_items_cotizacion_id           ON public.cotizacion_items(cotizacion_id);
CREATE INDEX IF NOT EXISTS idx_cot_items_plantilla_sugerida_id   ON public.cotizacion_items(plantilla_sugerida_id);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_cliente_id           ON public.cotizaciones(cliente_id);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_lead_id              ON public.cotizaciones(lead_id);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_plantilla_id         ON public.cotizaciones(plantilla_id);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_vendedor_id          ON public.cotizaciones(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_cxp_autorizado_por                ON public.cuentas_por_pagar(autorizado_por);
CREATE INDEX IF NOT EXISTS idx_cxp_creado_por                    ON public.cuentas_por_pagar(creado_por);
CREATE INDEX IF NOT EXISTS idx_cxp_pagado_por                    ON public.cuentas_por_pagar(pagado_por);
CREATE INDEX IF NOT EXISTS idx_facturas_cliente_id               ON public.facturas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_facturas_hito_cobranza_id         ON public.facturas(hito_cobranza_id);
CREATE INDEX IF NOT EXISTS idx_gastos_creado_por                 ON public.gastos_variables(creado_por);
CREATE INDEX IF NOT EXISTS idx_hitos_cobranza_actividad_id       ON public.hitos_cobranza(actividad_id);
CREATE INDEX IF NOT EXISTS idx_hitos_cobranza_cotizacion_item_id ON public.hitos_cobranza(cotizacion_item_id);
CREATE INDEX IF NOT EXISTS idx_lead_actividades_autor_id         ON public.lead_actividades(autor_id);
CREATE INDEX IF NOT EXISTS idx_lead_actividades_lead_id          ON public.lead_actividades(lead_id);
CREATE INDEX IF NOT EXISTS idx_leads_cliente_id                  ON public.leads(cliente_id);
CREATE INDEX IF NOT EXISTS idx_leads_owner_id                    ON public.leads(owner_id);
CREATE INDEX IF NOT EXISTS idx_plantilla_actividades_plantilla_id ON public.plantilla_actividades(plantilla_id);
CREATE INDEX IF NOT EXISTS idx_postventa_tickets_responsable_id  ON public.postventa_tickets(responsable_id);
CREATE INDEX IF NOT EXISTS idx_proyecto_notas_parent_nota_id     ON public.proyecto_notas(parent_nota_id);
CREATE INDEX IF NOT EXISTS idx_proyecto_sim_etapas_responsable_id ON public.proyecto_sim_etapas(responsable_id);
CREATE INDEX IF NOT EXISTS idx_proyectos_cliente_id              ON public.proyectos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_proyectos_cotizacion_id           ON public.proyectos(cotizacion_id);
CREATE INDEX IF NOT EXISTS idx_proyectos_plantilla_id            ON public.proyectos(plantilla_id);
