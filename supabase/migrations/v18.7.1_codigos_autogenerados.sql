-- v18.7.1 — FIX BUG CRÍTICO: códigos de leads/cotizaciones generados en cliente
-- con count() filtrado por RLS → colisiones de UNIQUE(codigo) → "no me deja
-- crear" intermitente (queja real del equipo, abierta desde hace semanas).
-- La BD asigna el código vía secuencia (inmune a RLS y a concurrencia).
-- Secuencias arrancan en 1000 para no chocar con históricos (LEAD-001, L-CO-*, COT-513).
CREATE SEQUENCE IF NOT EXISTS public.seq_lead_codigo START 1000;
CREATE SEQUENCE IF NOT EXISTS public.seq_cot_codigo START 1000;

CREATE OR REPLACE FUNCTION public.asignar_codigo_lead()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
BEGIN
  IF NEW.codigo IS NULL OR NEW.codigo = '' THEN
    NEW.codigo := 'LEAD-' || nextval('public.seq_lead_codigo');
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.asignar_codigo_cotizacion()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $$
BEGIN
  IF NEW.codigo IS NULL OR NEW.codigo = '' THEN
    NEW.codigo := 'COT-' || nextval('public.seq_cot_codigo');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_codigo_lead ON public.leads;
CREATE TRIGGER trg_codigo_lead BEFORE INSERT ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.asignar_codigo_lead();

DROP TRIGGER IF EXISTS trg_codigo_cotizacion ON public.cotizaciones;
CREATE TRIGGER trg_codigo_cotizacion BEFORE INSERT ON public.cotizaciones
  FOR EACH ROW EXECUTE FUNCTION public.asignar_codigo_cotizacion();

REVOKE EXECUTE ON FUNCTION public.asignar_codigo_lead(), public.asignar_codigo_cotizacion() FROM anon, authenticated;
