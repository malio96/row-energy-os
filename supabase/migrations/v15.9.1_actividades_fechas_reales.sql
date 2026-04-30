-- v15.9.1 — Tracking de fechas reales en actividades
-- Habilita el cálculo correcto de "tiempo promedio" y "desviación" en VistaPersonas.
-- Trigger BEFORE INSERT/UPDATE: setea fecha_inicio_real cuando estado pasa a 'En progreso'
-- (o avance > 0), y fecha_fin_real cuando estado pasa a 'Completada' (o avance = 100).
-- Si la actividad se reabre, fecha_fin_real se limpia.

ALTER TABLE public.actividades
  ADD COLUMN IF NOT EXISTS fecha_inicio_real date,
  ADD COLUMN IF NOT EXISTS fecha_fin_real    date;

CREATE OR REPLACE FUNCTION public.set_actividad_fechas_reales()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.fecha_inicio_real IS NULL
     AND (
       (NEW.estado IN ('En progreso','En proceso') AND COALESCE(OLD.estado, '') NOT IN ('En progreso','En proceso'))
       OR (NEW.avance > 0 AND COALESCE(OLD.avance, 0) = 0)
     )
  THEN
    NEW.fecha_inicio_real := CURRENT_DATE;
  END IF;

  IF NEW.fecha_fin_real IS NULL
     AND (
       (NEW.estado = 'Completada' AND COALESCE(OLD.estado, '') <> 'Completada')
       OR (NEW.avance >= 100 AND COALESCE(OLD.avance, 0) < 100)
     )
  THEN
    NEW.fecha_fin_real := CURRENT_DATE;
  END IF;

  IF NEW.fecha_fin_real IS NOT NULL
     AND NEW.estado <> 'Completada'
     AND NEW.avance < 100
     AND (OLD.estado = 'Completada' OR OLD.avance >= 100)
  THEN
    NEW.fecha_fin_real := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_actividad_fechas_reales ON public.actividades;
CREATE TRIGGER trg_actividad_fechas_reales
  BEFORE INSERT OR UPDATE ON public.actividades
  FOR EACH ROW
  EXECUTE FUNCTION public.set_actividad_fechas_reales();

-- Backfill para actividades ya completadas
UPDATE public.actividades
SET fecha_fin_real = updated_at::date
WHERE estado = 'Completada' AND fecha_fin_real IS NULL;
