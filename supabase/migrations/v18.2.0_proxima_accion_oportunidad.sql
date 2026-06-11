-- v18.2.0 — Accountability de seguimiento (insight Pipedrive: todo trato vivo
-- debe tener un siguiente paso con fecha). Columnas en leads (= oportunidad).
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS proxima_accion text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS proxima_accion_fecha date;
