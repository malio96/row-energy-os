-- ============================================================
-- v17.2.0 — DB Webhook: alerta-acceso-cotizaciones
-- ============================================================
-- Dispara la Edge Function cada vez que se inserta un evento
-- en auditoria_eventos. La función filtra internamente cuáles
-- merecen email (no-autorizados en cotizaciones / tab financiero).
-- ============================================================

CREATE OR REPLACE TRIGGER "alerta_accesos_sensibles_webhook"
AFTER INSERT ON "public"."auditoria_eventos"
FOR EACH ROW
EXECUTE FUNCTION supabase_functions.http_request(
  'https://twwqmjumtqwhhwxrmlse.supabase.co/functions/v1/alerta-acceso-cotizaciones',
  'POST',
  '{"Content-type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR3d3FtanVtdHF3aGh3eHJtbHNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0ODc2NDMsImV4cCI6MjA5MjA2MzY0M30.dIXKpdo3BE8suJ-eYJJ0F8aO9N-QC-PWlNa-VDCsaOk"}',
  '{}',
  '5000'
);
