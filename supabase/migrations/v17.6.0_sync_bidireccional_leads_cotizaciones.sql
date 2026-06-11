-- v17.6.0 — Sincronización bidireccional 1:1 leads <-> cotizaciones
-- ============================================================
-- Cada cotización tiene un lead "espejo" (cotizaciones.lead_id). Los cambios
-- se propagan en ambos sentidos vía triggers, con guarda anti-recursión
-- (pg_trigger_depth()).
--
-- Mapeo estado(cotización) <-> etapa(lead):
--   Enviada      <-> Propuesta enviada
--   En revisión  <-> Negociación
--   Aprobada     <-> Ganado
--   Rechazada/Vencida <-> Perdido
--   Borrador     <-> Nuevo
--
-- IMPORTANTE: el reverso (lead->cotización) NO fuerza estado 'Aprobada' al
-- mover un lead a 'Ganado'. Forzarlo dispararía el workflow de aprobación
-- (trg_cotizacion_aprobar_workflow + trg_handoff_cotizacion → crea proyecto,
-- tareas, hitos) y su guard exige cliente con RFC/dirección. La aprobación
-- formal sigue siendo una acción explícita desde el módulo Cotizaciones.
--
-- Backfill histórico: se ejecutó SOLO para cotizaciones 2025 (decisión de
-- negocio), con triggers de usuario deshabilitados, NO incluido en este
-- archivo (operación de datos puntual, no schema).
-- ============================================================

-- ---- Forward: cotización -> lead (crea espejo en INSERT, sincroniza en UPDATE)
CREATE OR REPLACE FUNCTION public.sync_cotiz_to_lead()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $fn$
DECLARE v_lead uuid; v_etapa text; v_prob int;
BEGIN
  v_etapa := CASE NEW.estado
    WHEN 'Aprobada' THEN 'Ganado'
    WHEN 'Rechazada' THEN 'Perdido'
    WHEN 'Vencida' THEN 'Perdido'
    WHEN 'En revisión' THEN 'Negociación'
    WHEN 'Enviada' THEN 'Propuesta enviada'
    WHEN 'Borrador' THEN 'Nuevo'
    ELSE 'Nuevo' END;
  v_prob := CASE v_etapa
    WHEN 'Ganado' THEN 100 WHEN 'Perdido' THEN 0 WHEN 'Negociación' THEN 75
    WHEN 'Propuesta enviada' THEN 55 WHEN 'Calificando' THEN 40
    WHEN 'En contacto' THEN 25 ELSE 10 END;

  IF TG_OP = 'INSERT' THEN
    IF NEW.lead_id IS NULL THEN
      INSERT INTO leads (codigo, razon_social, etapa, monto_estimado, probabilidad,
                         owner_id, cliente_id, capacidad_mw, ultima_actividad)
      VALUES ('L-'||NEW.codigo, coalesce(NEW.nombre_proyecto,'(sin nombre)'), v_etapa,
              coalesce(NEW.total,0), v_prob, NEW.vendedor_id, NEW.cliente_id,
              NEW.capacidad_mw, now())
      RETURNING id INTO v_lead;
      NEW.lead_id := v_lead;
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE: ignorar si el cambio proviene del trigger inverso
  IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;
  IF NEW.lead_id IS NOT NULL AND (
       NEW.estado IS DISTINCT FROM OLD.estado
    OR NEW.total IS DISTINCT FROM OLD.total
    OR NEW.nombre_proyecto IS DISTINCT FROM OLD.nombre_proyecto
    OR NEW.cliente_id IS DISTINCT FROM OLD.cliente_id) THEN
    UPDATE leads SET
      etapa = v_etapa, probabilidad = v_prob,
      monto_estimado = coalesce(NEW.total,0),
      razon_social = coalesce(NEW.nombre_proyecto, razon_social),
      cliente_id = coalesce(NEW.cliente_id, cliente_id),
      ultima_actividad = now(), updated_at = now()
    WHERE id = NEW.lead_id;
  END IF;
  RETURN NEW;
END $fn$;

DROP TRIGGER IF EXISTS trg_sync_cotiz_to_lead ON cotizaciones;
CREATE TRIGGER trg_sync_cotiz_to_lead
  BEFORE INSERT OR UPDATE ON cotizaciones
  FOR EACH ROW EXECUTE FUNCTION public.sync_cotiz_to_lead();

-- ---- Reverse: lead -> cotización (sincroniza estado/monto, sin forzar Aprobada)
CREATE OR REPLACE FUNCTION public.sync_lead_to_cotiz()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $fn$
DECLARE v_estado text;
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;
  IF NEW.etapa IS DISTINCT FROM OLD.etapa OR NEW.monto_estimado IS DISTINCT FROM OLD.monto_estimado THEN
    v_estado := CASE NEW.etapa
      WHEN 'Ganado' THEN 'Aprobada'
      WHEN 'Perdido' THEN 'Rechazada'
      WHEN 'Negociación' THEN 'En revisión'
      WHEN 'Propuesta enviada' THEN 'Enviada'
      WHEN 'Calificando' THEN 'Enviada'
      WHEN 'En contacto' THEN 'Enviada'
      WHEN 'Nuevo' THEN 'Borrador'
      ELSE NULL END;
    UPDATE cotizaciones SET
      -- no forzamos 'Aprobada' desde el lead (evita cascada de proyecto + guard de cliente)
      estado = CASE WHEN v_estado = 'Aprobada' THEN estado ELSE coalesce(v_estado, estado) END,
      total = coalesce(NEW.monto_estimado, total),
      updated_at = now()
    WHERE lead_id = NEW.id;
  END IF;
  RETURN NEW;
END $fn$;

DROP TRIGGER IF EXISTS trg_sync_lead_to_cotiz ON leads;
CREATE TRIGGER trg_sync_lead_to_cotiz
  AFTER UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION public.sync_lead_to_cotiz();

-- Funciones SECURITY DEFINER: revocar ejecución pública directa
REVOKE EXECUTE ON FUNCTION public.sync_cotiz_to_lead() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_lead_to_cotiz() FROM public, anon, authenticated;
