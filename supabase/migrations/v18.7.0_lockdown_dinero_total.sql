-- v18.7.0 — Lockdown de dinero TOTAL (auditoría exhaustiva, pedido de dirección).
-- Cierra las 3 fugas restantes hacia director_proyectos/equipo_proyectos:
-- (1) notificaciones: "destinatario_id IS NULL" permitía leer broadcasts de otros
--     roles (el workflow escribe montos en el texto). Ahora: propias o de TU rol.
-- (2) precios_servicios: catálogo de precios era USING(true) → solo direccion/admin/ventas.
-- (3) actividades.monto_cobrable: columna de dinero en tabla legible por proyectos.
--     Nunca usada (0 filas) → ELIMINADA. duplicar_proyecto actualizado (ya no la copia).
--     El dinero de cobro vive SOLO en hitos_cobranza (blindada).
-- SQL completo aplicado vía MCP (migración v18_7_0_lockdown_dinero_total en Supabase).
-- Verificación permanente: scripts/auditoria_lockdown_dinero.sql (todo debe dar 0).
DROP POLICY IF EXISTS notif_read_own ON public.notificaciones;
CREATE POLICY notif_read_own ON public.notificaciones FOR SELECT TO authenticated
  USING (destinatario_id = app_user_id() OR (destinatario_id IS NULL AND destinatario_rol = app_user_rol()));

DROP POLICY IF EXISTS precios_servicios_select ON public.precios_servicios;
CREATE POLICY precios_servicios_select ON public.precios_servicios FOR SELECT TO authenticated
  USING (app_has_any_rol(VARIADIC ARRAY['direccion','admin','ventas']));

ALTER TABLE public.actividades DROP COLUMN IF EXISTS monto_cobrable;
-- (el cuerpo completo de duplicar_proyecto actualizado vive en la BD)
