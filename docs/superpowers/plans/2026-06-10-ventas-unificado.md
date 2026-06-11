# Módulo "Ventas" unificado — Plan de implementación

> Spec: `docs/superpowers/specs/2026-06-10-ventas-unificado-design.md`
> **Verificación:** este repo no tiene framework de tests → cada tarea se valida con `npm run build` + checklist manual. Commits frecuentes. Construir Ventas en paralelo; recién al final se quitan Leads/Cotizaciones del sidebar (rollback fácil).

**Goal:** Reemplazar Leads + Cotizaciones por un solo módulo "Ventas" (pipeline de 5 etapas, oportunidad = lead con cotización adjunta), sin cambios de esquema.

**Arquitectura:** `Ventas.jsx` modular (subcomponentes), reusa `getLeads`/`getCotizaciones` (join cliente-side por `lead_id`), el sync 1:1 existente como plomería, y el detalle/PDF/aprobación de cotización ya existentes.

**Tech:** React + Vite, estilos inline (COLORS), Supabase.

---

### Task 1 — Helpers de fases (mapeo 7→5)
**Files:** Modify `src/helpers.jsx`
- [ ] `export const FASES_VENTA = [{key:'Nuevo',...},{key:'Cotización enviada'},{key:'Negociación'},{key:'Ganado'},{key:'Perdido'}]` con colores (reusar paleta ETAPAS_LEAD).
- [ ] `export function faseDeEtapa(etapa)` → mapea las 7 etapas de lead a las 5 fases (Nuevo/En contacto/Calificando→Nuevo; Propuesta enviada→Cotización enviada; Negociación→Negociación; Ganado→Ganado; Perdido→Perdido).
- [ ] `export function etapaCanonicaDeFase(fase)` → fase 5 a etapa canónica de lead (Nuevo→'Nuevo', Cotización enviada→'Propuesta enviada', Negociación→'Negociación', Ganado→'Ganado', Perdido→'Perdido').
- [ ] `npm run build`.

### Task 2 — getOportunidades en supabase.js
**Files:** Modify `src/supabase.js`
- [ ] `getOportunidades()`: `Promise.all([getLeads(), getCotizaciones()])`, indexar cotizaciones por `lead_id`, devolver `leads.map(l => ({...l, cotizacion: byLead[l.id] || null }))`.
- [ ] `cambiarFaseOportunidad(leadId, fase)`: `actualizarLead(leadId, { etapa: etapaCanonicaDeFase(fase), ultima_actividad: now })` (el trigger sincroniza la cotización).
- [ ] `npm run build`.

### Task 3 — Ventas.jsx: pipeline Kanban + tabla + filtros
**Files:** Create `src/Ventas.jsx`; Modify `src/App.jsx` (ruta `/ventas` temporal, sin tocar sidebar aún)
- [ ] Header (total + pipeline ponderado), filtros búsqueda/año(default actual)/responsable, toggle Kanban/Tabla.
- [ ] Kanban de 5 columnas (FASES_VENTA) con DnD (reusa patrón de Leads); tarjeta modo simple = empresa + monto + etapa. Mover tarjeta → `cambiarFaseOportunidad`.
- [ ] Tabla alternativa (reusa patrón de Cotizaciones).
- [ ] Ruta `/ventas` protegida (modulo 'cotizaciones' por ahora). Verificar en navegador (`npm run dev`).
- [ ] `npm run build` + commit.

### Task 4 — Detalle de oportunidad (progressive disclosure)
**Files:** Modify `src/Ventas.jsx`
- [ ] Panel detalle: cabecera (empresa, contacto, etapa selector, monto, responsable) + secciones colapsables: Cotización (si existe: reusar `CotizacionDetalle` o panel con partidas+PDF+Aprobar; si no: botón "Generar cotización" → `crearCotizacion` ligada al lead), Actividad/notas, Más detalles.
- [ ] Flujo Ganado: al mover/seleccionar Ganado con cotización, aprobar (reusa `actualizarCotizacion` estado Aprobada); si falta cliente/RFC, avisar y abrir captura (toast + modal cliente). 
- [ ] `npm run build` + commit.

### Task 5 — Alta rápida
**Files:** Modify `src/Ventas.jsx`
- [ ] Modal "+ Nueva oportunidad": empresa(req), contacto, responsable(default usuario). `crearLead` con etapa 'Nuevo'. 
- [ ] `npm run build` + commit.

### Task 6 — Swap sidebar + redirects (último, reversible)
**Files:** Modify `src/Sidebar.jsx`, `src/App.jsx`, `src/permisos.js`
- [ ] Agregar módulo 'ventas' a permisos (roles: direccion, admin, ventas, cobranza, director_proyectos). Quitar items 'leads' y 'cotizaciones' del sidebar (dejar rutas como redirect a /ventas con query mapeado).
- [ ] Deep-links `?lead=` / `?cotizacion=` → resolver a la oportunidad.
- [ ] `npm run build` + commit + push.

### Task 7 — QA manual + bump versión
- [ ] Checklist de aceptación del spec (8 puntos). Bump package.json a v18.0.0, CHANGELOG, commit.

## Self-review
- Cubre las 14 secciones del spec (pipeline 5 etapas ✓, vistas ✓, detalle ✓, alta ✓, Ganado ✓, sidebar/redirect ✓, sin cambios esquema ✓).
- Sin placeholders en la lógica clave (mapeos y joins definidos).
- Riesgo controlado: módulos viejos se quitan solo en Task 6.
