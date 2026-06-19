-- v18.9.3 — permitir estado 'Cancelada' (y 'Retrasada') en actividades
-- =====================================================================
-- Causa: la constraint `actividades_estado_check` no incluía 'Cancelada',
-- así que el UPDATE de estado disparaba error 23514 (check_violation) y la
-- app mostraba error al elegir "Cancelada" en el selector (v18.9.2).
--
-- Seguro para datos existentes: las 7,238 actividades usan solo
-- 'Sin iniciar' / 'Completada' / 'En progreso' / 'Bloqueada' (verificado vía
-- service_role el 18 jun 2026), todos incluidos en la lista nueva.
-- 'Retrasada' se incluye porque el selector de la UI la ofrece (aunque
-- normalmente es un estado derivado por fecha, no persistido).
--
-- No toca RLS ni columnas de dinero → no aplica la auditoría de lockdown.

ALTER TABLE public.actividades DROP CONSTRAINT IF EXISTS actividades_estado_check;

ALTER TABLE public.actividades
  ADD CONSTRAINT actividades_estado_check
  CHECK (estado IN ('Sin iniciar', 'En progreso', 'Completada', 'Bloqueada', 'Retrasada', 'Cancelada'));
