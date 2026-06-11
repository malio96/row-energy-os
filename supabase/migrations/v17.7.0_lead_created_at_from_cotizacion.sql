-- v17.7.0 — El lead espejo hereda created_at = fecha_emision de su cotización
-- ============================================================
-- Motivo: el filtro por AÑO en Leads y Dashboard usa created_at del lead.
-- Si el lead se crea hoy (backfill o alta), su created_at sería el año actual y
-- no el año real del quote. Por eso el lead hereda la fecha_emisión de la
-- cotización. Backfill histórico (leads de TODAS las cotizaciones + corrección
-- de created_at de los ya existentes) se ejecutó como operación de datos puntual,
-- no incluida aquí.
-- ============================================================

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
                         owner_id, cliente_id, capacidad_mw, ultima_actividad, created_at)
      VALUES ('L-'||NEW.codigo, coalesce(NEW.nombre_proyecto,'(sin nombre)'), v_etapa,
              coalesce(NEW.total,0), v_prob, NEW.vendedor_id, NEW.cliente_id,
              NEW.capacidad_mw, now(), coalesce(NEW.fecha_emision::timestamptz, now()))
      RETURNING id INTO v_lead;
      NEW.lead_id := v_lead;
    END IF;
    RETURN NEW;
  END IF;

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
