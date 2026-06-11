-- v17.9.0 — Índices para foreign keys sin cobertura (advisor performance, jun 2026)
-- Riesgo nulo: solo mejora joins/deletes por estas FKs.
CREATE INDEX IF NOT EXISTS idx_cierre_checklist_proyecto_id ON public.cierre_checklist(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_compras_proyecto_id ON public.compras(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_contratos_proyecto_id ON public.contratos(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_workflow_aprobado_por ON public.cotizaciones(workflow_aprobado_por);
CREATE INDEX IF NOT EXISTS idx_postventa_tickets_proyecto_id ON public.postventa_tickets(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_tareas_post_cierre_completada_por ON public.tareas_post_cierre(completada_por);
