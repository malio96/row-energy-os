# Diseño — Módulo "Ventas" unificado (Leads + Cotizaciones)

> Fecha: 2026-06-10 · Estado: aprobado para implementar · Versión objetivo: v18.0.0
> Primer spec de la iniciativa "mejor CRM + proyectos, simple de usar". Los otros frentes (simplificación UX transversal, proyectos serio-pero-simple, captura sin fricción) van en specs separados — ver Roadmap al final.

## 1. Problema

Hoy "Leads" y "Cotizaciones" son dos módulos separados para lo que en realidad es **una sola oportunidad de venta**. Con el sync 1:1 (v17.6.0) cada cotización ya tiene un lead espejo → la misma oportunidad se ve y administra en dos lugares. Eso es la complejidad principal que reporta el usuario. La investigación de mercado (Pipedrive, HubSpot) confirma el modelo correcto: **una oportunidad que avanza por etapas, con la cotización como documento adjunto**, no dos listas.

## 2. Objetivo y principios

Unificar en **un solo módulo "Ventas"** que reemplaza Leads y Cotizaciones en el sidebar, aplicando:
- **Opinionado**: un solo flujo claro (oportunidad → cotización → ganado), no dos módulos que sincronizar.
- **Simple por default, potente bajo demanda** (progressive disclosure).
- **Defaults inteligentes** + alta rápida con mínimos campos.
- **Reuso máximo**: sin cambios de esquema; la cotización (partidas, PDF, workflow de aprobación) queda intacta.

## 3. Modelo de datos (sin cambios de esquema)

- **Oportunidad = fila en `leads`** (pipeline + contacto + responsable + monto). Es la unidad central.
- **Cotización = fila en `cotizaciones`** (documento: partidas, total, PDF, workflow). Cuelga de la oportunidad vía el vínculo 1:1 existente (`cotizaciones.lead_id`).
- Una oportunidad puede no tener cotización aún (lead temprano) o tener una (al avanzar).
- **Los triggers de sync (v17.6.0/17.7.0) se mantienen** como plomería: cambiar la etapa de la oportunidad o el estado de la cotización mantiene ambas filas coherentes. El usuario solo ve y edita la etapa de la oportunidad.

## 4. Pipeline — 5 etapas

`Nuevo → Cotización enviada → Negociación → Ganado → Perdido`

**Mapeo desde los estados actuales** (para mostrar las 527 existentes y para el sync):

| Etapa Ventas | `leads.etapa` (actual) | `cotizaciones.estado` (actual) |
|---|---|---|
| Nuevo | Nuevo, En contacto, Calificando | Borrador |
| Cotización enviada | Propuesta enviada | Enviada |
| Negociación | Negociación | En revisión |
| Ganado | Ganado | Aprobada |
| Perdido | Perdido | Rechazada, Vencida |

- El módulo lee `leads` + su cotización embebida y **deriva la etapa de 5** desde `leads.etapa` (función de mapeo en `helpers.jsx`). No se migra el dato; se agrupan las 7 etapas en 5 columnas.
- **Mover una tarjeta** setea la `leads.etapa` canónica de esa columna (ej. "Cotización enviada" → `Propuesta enviada`), y el trigger existente refleja el `cotizaciones.estado`.

## 5. Vistas (pantalla principal)

- **Kanban (default) + toggle a Tabla** sobre la misma data (reusa el patrón Kanban de Leads + tabla de Cotizaciones).
- **Filtro por año** (ya existe, default año actual) + búsqueda + filtro por responsable. Sin archivar; el filtro controla qué se ve.
- **Modo simple**: la tarjeta muestra solo empresa, monto y etapa. (Sin badges financieros ni campos extra en la tarjeta.)
- Encabezado: total de oportunidades visibles + pipeline ponderado (lo que ya calcula Leads).

## 6. Detalle de la oportunidad (progressive disclosure)

Una sola vista con secciones colapsables (no tabs):
- **Cabecera (siempre visible)**: empresa/razón social, contacto, etapa (selector), monto, responsable.
- **Cotización** (colapsable, se expande si existe): partidas, subtotal/IVA/total, estado, **Exportar PDF**, **Aprobar**. Si no hay cotización: botón **"Generar cotización"**.
- **Actividad y notas** (colapsable): última actividad, notas de seguimiento.
- **Más detalles** (colapsable): campos secundarios (tipo proyecto, capacidad MW, fuente, email/teléfono).

## 7. Alta rápida

- Botón **"+ Nueva oportunidad"** → modal mínimo: **empresa (req), contacto, responsable** (default = usuario actual). Etapa default "Nuevo". Todo lo demás con defaults.
- La cotización **no** se pide en el alta; se genera después desde el detalle.

## 8. Flujo "Ganado" → aprobación

- Mover a **Ganado** = aprobar la cotización (acción de negocio real: ganar el trato aprueba el quote y dispara la creación del proyecto vía el workflow existente).
- El guard existente exige cliente con RFC + dirección. Si falta: la UI **avisa y abre la captura de cliente** antes de confirmar Ganado (no falla en silencio).
- Si la oportunidad no tiene cotización al marcar Ganado: se permite, pero sin disparar proyecto (no hay documento que aprobar); se marca la etapa nomás.

## 9. Permisos

- Sidebar "Ventas" visible para: direccion, admin, ventas, cobranza (lectura), director_proyectos (lectura). Reusa reglas actuales de cotizaciones/leads.
- RLS sin cambios (ya endurecido en v17.8.0): ventas ve sus oportunidades (owner/vendedor), dirección todo.

## 10. Sidebar / routing

- Quitar "Leads" y "Cotizaciones" del sidebar; agregar **"Ventas"** (`/ventas`).
- Mantener rutas viejas como redirect a `/ventas` (deep-links de alertas: `?lead=` y `?cotizacion=` siguen funcionando, resolviendo a la oportunidad correspondiente).

## 11. Qué NO cambia

- Esquema de BD, triggers de sync, documento de cotización (partidas, PDF `exportCotizacion.js`), workflow de aprobación (creación de proyecto/tareas/hitos), alertas (`cotizaciones_sin_respuesta`, `leads_sin_actividad`).

## 12. Fuera de alcance (otros specs)

- Simplificación UX transversal (modo simple en Proyectos, recorte de campos global).
- Proyectos serio-pero-simple (workload por persona, baselines, cascada).
- Captura sin fricción (quick-add móvil, realtime, integraciones email/WhatsApp/calendario).
- (Viáticos: descartado — no aplica a esta empresa.)

## 13. Riesgos

- **Agrupar 7 etapas en 5** puede perder matiz (En contacto/Calificando colapsan en Nuevo). Aceptado por simplicidad; reversible.
- **Ganado→aprobación** toca el workflow que crea proyectos: probar bien el caso sin cliente/RFC (que avise, no rompa).
- **Archivos grandes**: Cotizaciones.jsx (~1.058) + Leads.jsx (~280) → el nuevo `Ventas.jsx` debe nacer modular (subcomponentes: `PipelineKanban`, `OportunidadDetalle`, `CotizacionPanel`), no otro megacomponente.

## 14. Criterios de aceptación

1. Un solo módulo "Ventas" en el sidebar; Leads y Cotizaciones ya no aparecen.
2. Pipeline Kanban de 5 etapas + tabla, con filtro de año (default actual), búsqueda y responsable.
3. Abrir una oportunidad muestra contacto + etapa + cotización (si existe) + actividad, con secciones colapsables.
4. Alta rápida crea oportunidad con ≤3 campos.
5. "Generar cotización" desde el detalle; PDF y aprobación funcionan igual que hoy.
6. Mover a Ganado aprueba la cotización (con manejo del cliente faltante).
7. Deep-links viejos (`?lead=`, `?cotizacion=`) redirigen a la oportunidad.
8. `npm run build` verde; sin regresión en alertas ni en el workflow de proyecto.
