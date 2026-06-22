-- v18.10.0 — cancelar sub-actividades en cascada (reversible)
-- =====================================================================
-- Feature: al poner una actividad en 'Cancelada', la app ofrece cancelar
-- también sus sub-actividades pendientes (todas menos las 'Completada').
-- Requisito clave: la acción es REVERSIBLE. Si luego se hace Ctrl+Z o se
-- regresa la actividad padre a un estado != 'Cancelada', las hijas
-- auto-canceladas vuelven EXACTAMENTE a su estado anterior.
--
-- Para lograrlo de forma durable (sobrevive recarga de página / sesión),
-- se guarda en cada hija auto-cancelada:
--   - cancel_origen_id     : la actividad cuya cancelación la disparó
--   - cancel_estado_previo : el estado que tenía justo antes de cancelarse
-- Al des-cancelar el origen, se restauran las hijas con ese origen y se
-- limpian ambos marcadores. Una cancelación manual directa (sin cascada)
-- no setea marcadores → no se auto-restaura.
--
-- NO son columnas de dinero ni tocan RLS → no aplica la auditoría de
-- lockdown. Ambas columnas son nullable y sin default → cero impacto en
-- las 7,238 filas existentes.

ALTER TABLE public.actividades
  ADD COLUMN IF NOT EXISTS cancel_origen_id uuid
    REFERENCES public.actividades(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cancel_estado_previo text;

COMMENT ON COLUMN public.actividades.cancel_origen_id IS
  'Actividad cuya cancelación canceló esta fila en cascada (NULL si no fue cascada). Permite restaurar al des-cancelar el origen.';
COMMENT ON COLUMN public.actividades.cancel_estado_previo IS
  'Estado que tenía la actividad justo antes de ser auto-cancelada en cascada. Usado para restaurarla.';
