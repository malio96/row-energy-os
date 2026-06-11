# Plan de trabajo — Auditoría Row Energy OS (jun 2026)

> Auditoría completa (seguridad, RLS/BD, código, performance) hecha el 10-jun-2026 sobre v17.7.0.
> Pensado para ejecutar en una próxima sesión. Cada ítem trae **prioridad**, **esfuerzo** (S<2h / M medio día / L 1-3 días) y **riesgo de romper algo**.
> Orden sugerido de ejecución: P0 → P1 → P2 → P3 → P4.

---

## ✅ ESTADO (actualizado 10-jun, v17.9.0 — ya ejecutado en esta sesión)

**HECHO:**
- ✅ **P0.2** search_path fijo en `cotizacion_aprobar_workflow` (migración v17.8.0)
- ✅ **P1.1** políticas `leads`/`cotizaciones` `{public}`→`authenticated`
- ✅ **P1.2** guardas de autorización en `duplicar_proyecto`/`duplicar_actividad` (rol gestión/membresía)
- ✅ **P1.5** edge fn: `ALERT_EMAIL`/`ALERT_FROM_EMAIL` vía secret (desplegada)
- ✅ **P2.1** 6 índices FK (migración v17.9.0)
- ✅ **P4.1** `.gitignore` ignora backups + basura templates

**PENDIENTE MANUAL (solo Malio, dashboards):**
- ⏳ **P0.1** rotar credenciales (DB password + JWT secret + Vercel env) — **lo más urgente**
- ⏳ **P0.3** HIBP (requiere upgrade Pro)
- ⏳ **P2.4** estrategia de conexión Auth (dashboard)

**DIFERIDO POR RIESGO/CRITERIO (no se rusheó autónomamente):**
- ⏭️ **P1.2 helpers RLS** — NO revocar EXECUTE en `app_*`: las usan las políticas RLS, revocar rompería toda query. Aceptable como está (solo devuelven datos del propio caller).
- ⏭️ **P1.4** IconAlerta `dangerouslySetInnerHTML` — seguro hoy (SVG estático). Conversión de 10 iconos = riesgo de regresión visual silenciosa. Hacer con verificación en navegador.
- ⏭️ **P2.2** drop de índices sin uso — bajo valor, algún riesgo; los de `leads` son nuevos. No tocar aún.
- ⏭️ **P2.3** mover `pg_net` de `public` — el webhook `alerta_accesos_sensibles` lo usa; mover puede romperlo. Hacer con prueba del webhook.
- ⏭️ **P3.3** dedup `btnPrimary` — los locales de Proyectos son variante densa intencional; deduplicar cambia ~16 botones. No vale.
- ⏭️ **P3.1/3.4/3.5/3.6/3.7/3.8/3.9** refactors grandes (splits de archivos, date utils, Sentry, select*, Gantt) — esfuerzo L, alto riesgo de regresión. Hacer incremental, un commit por pieza, con verificación.
- ℹ️ **P4.2** el import `Fragment` SÍ se usa (4 veces) — era falso positivo, no tocar.

## ⚠️ Antes de empezar
```bash
git fetch origin && git log --oneline HEAD..origin/main   # sync con remote
npm run build                                             # baseline verde
```

---

## P0 — Seguridad crítica (hacer primero, riesgo real)

### P0.1 — Rotar credenciales filtradas en git history · **CRÍTICO** · S · riesgo bajo
El password `RowEnergy2026!` está en el historial de git (documentado en CLAUDE.md). Cualquiera con acceso al repo lo ve.
- [ ] Supabase → Settings → Database → **Reset database password**
- [ ] Supabase → Settings → API → **Roll JWT secret** (invalida tokens viejos → todos re-login)
- [ ] Actualizar `.env.local` local + Vercel env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_KEY`)
- [ ] Redeploy en Vercel
- [ ] Verificar login en producción tras el roll
> Nota: la **anon key** en `.env.local`/`dist` es pública por diseño (no es secreto). Lo crítico es el password de BD y el JWT secret.

### P0.2 — `cotizacion_aprobar_workflow` con `search_path` vacío · **ALTO** · S · riesgo medio
Es la única función `SECURITY DEFINER` sin `search_path` fijo (`""`). Puede resolver objetos en el esquema equivocado o fallar. El resto (15 funciones) ya están fijas.
```sql
ALTER FUNCTION public.cotizacion_aprobar_workflow() SET search_path = public, pg_temp;
```
- [ ] Aplicar como migración `v17.8.0_fix_search_path_workflow.sql`
- [ ] Probar aprobar una cotización con cliente válido (que cree el proyecto sin error)

### P0.3 — Habilitar Leaked Password Protection (HIBP) · **MEDIO** · S · requiere Pro
Advisor de seguridad: está deshabilitado. Requiere upgrade a Supabase **Pro** (ya estaba diferido por esto).
- [ ] Si se hace upgrade: Supabase → Auth → Settings → activar "Leaked password protection"

---

## P1 — Hardening de seguridad (defensa en profundidad, NO exploitable hoy)

### P1.1 — Limpiar políticas `{public}` → `{authenticated}` · **BAJO/MEDIO** · S · riesgo bajo
**Verificado: NO hay exposición a anon.** Las 7 políticas de `leads`/`cotizaciones` marcadas `{public}` tienen `USING` con `app_has_any_rol()` / `owner_id = app_user_id()`, que dan false/null para anon → cero filas. Es inconsistencia cosmética (`cots_read` ya es `{authenticated}`). Vale unificar para que el modelo sea legible y a prueba de futuros errores.
- [ ] Recrear las políticas `leads_read/update/insert/delete` y `cots_insert/update/delete` con `TO authenticated`
- [ ] Verificar que ventas sigue viendo solo sus leads/cotizaciones y dirección todo

### P1.2 — Revocar EXECUTE a `authenticated` en funciones `SECURITY DEFINER` · **MEDIO** · S · riesgo medio
Advisor: 7 funciones son llamables por RPC desde cualquier usuario autenticado:
- Helpers RLS (`app_user_id`, `app_user_rol`, `app_has_any_rol`, `app_es_miembro_proyecto`, `app_es_jefe_proyectos`): bajo riesgo (devuelven datos del propio caller), pero no hay razón para exponerlas como RPC.
- **`duplicar_actividad`, `duplicar_proyecto`**: MEDIO — un usuario podría invocarlas por RPC sobre IDs arbitrarios. Revisar que validen pertenencia, o revocar EXECUTE a `authenticated` (que se llamen solo desde otras funciones/triggers).
```sql
REVOKE EXECUTE ON FUNCTION public.app_user_id(), public.app_user_rol(),
  public.app_has_any_rol(text[]), public.app_es_miembro_proyecto(uuid),
  public.app_es_jefe_proyectos(), public.duplicar_actividad(uuid),
  public.duplicar_proyecto(uuid, text) FROM anon, authenticated;
```
- [ ] Confirmar que `duplicar_*` se llaman desde el cliente (supabase.js). Si sí, dejar EXECUTE pero **agregar validación de pertenencia dentro de la función**. Si no, revocar.

### P1.3 — Falta política INSERT en `auditoria` · **MEDIO** · S
La tabla `auditoria` tiene RLS pero solo policy de SELECT (`direccion`). Si la app intenta insertar audit rows como usuario normal, RLS las bloquea silenciosamente. (Los triggers `SECURITY DEFINER` insertan OK; verificar si hay inserts directos desde cliente.)
- [ ] Confirmar quién inserta en `auditoria`. Si es solo trigger SECURITY DEFINER, no hace falta. Si hay inserts cliente, agregar policy.

### P1.4 — `IconAlerta.jsx:23` usa `dangerouslySetInnerHTML` · **BAJO** · S · riesgo bajo
Hoy es seguro (SVG de constante estática), pero es anti-patrón.
- [ ] Reemplazar por `<path d={path}/>` directo. Sin dependencia externa.

### P1.5 — `ALERT_EMAIL` hardcodeado en edge function · **BAJO** · S
`alerta-acceso-cotizaciones` manda a `mmartinez@row.energy` hardcodeado. Si cambia, hay que redeploy.
- [ ] Mover a env var de la edge function (`Deno.env.get('ALERT_EMAIL')`) o tabla de config.

---

## P2 — Base de datos: performance (advisors)

### P2.1 — Foreign keys sin índice · **MEDIO** · S · riesgo nulo
6 FKs sin índice de cobertura (lentitud en joins/deletes):
`cierre_checklist.proyecto_id`, `compras.proyecto_id`, `contratos.proyecto_id`, `cotizaciones.workflow_aprobado_por`, `postventa_tickets.proyecto_id`, `tareas_post_cierre.completada_por`.
- [ ] `CREATE INDEX` en cada una (migración `v17.x_indices_fk.sql`). Riesgo nulo, solo mejora.

### P2.2 — Índices sin uso (~30) · **BAJO** · S · riesgo bajo
Advisor lista ~30 índices nunca usados (ej. varios de `cuentas_por_pagar`, `leads`, `gastos_variables`). **OJO**: los de `leads` (`idx_leads_etapa`, `idx_leads_owner_id`, `idx_leads_cliente_id`) son nuevos — probablemente aún sin uso por recientes; **no borrarlos todavía**. Para el resto, evaluar drop tras confirmar que llevan tiempo sin uso.
- [ ] Revisar lista, borrar solo los claramente muertos y viejos. Dejar los recién creados.

### P2.3 — `pg_net` en esquema `public` · **BAJO** · S
Advisor: mover la extensión fuera de `public`.
- [ ] `ALTER EXTENSION pg_net SET SCHEMA extensions;` (validar que el webhook `alerta_accesos_sensibles` siga funcionando).

### P2.4 — Auth: estrategia de conexión absoluta · **BAJO** · S
Auth usa máx 10 conexiones fijas. Cambiar a porcentual mejora al escalar.
- [ ] Solo relevante si se sube el tamaño de instancia.

---

## P3 — Calidad de código y arquitectura

### P3.1 — Dividir `Proyectos.jsx` (4.570 líneas) · **ALTO** · L · riesgo alto
Megacomponente con Gantt + Kanban + Tabla + Editor + Notas/Docs.
- [ ] Extraer a `GanttView.jsx`, `KanbanView.jsx`, `ActivityTable.jsx`, `ProjectEditor.jsx`, `ProjectNotes.jsx`.
- [ ] Hacer **un componente a la vez**, build + prueba manual entre cada uno. Cuidado con la sync Gantt↔Kanban y el drag de dependencias (bug histórico documentado).

### P3.2 — Hex hardcodeados en `Proyectos.jsx` (~53 líneas) · **ALTO** · S · riesgo bajo
`ESTADO_ESTILOS`, `IMPORTANCIA_ESTILOS`, etc. (líneas ~55-115) duplican colores fuera de `COLORS`.
- [ ] Mover a `helpers.jsx` como `export const ESTADO_COLORES` etc. Single source of truth.

### P3.3 — `btnPrimary`/`cardStyle` locales en Proyectos.jsx · **MEDIO** · S
Líneas ~344-349 redefinen botones/estilos que ya están en `helpers.jsx`.
- [ ] Importar de helpers, borrar locales. También `<SortControl>` en Kanban/Tabla (hoy sort inline).

### P3.4 — Dividir `supabase.js` (2.275 líneas) · **MEDIO** · M · riesgo medio
160+ funciones en un archivo.
- [ ] Refactor a `lib/supabase/` (`queries.js`, `mutations.js`, `admin.js`, `auth.js`). Diferible a v18.

### P3.5 — Dividir `Dashboard.jsx` (2.317 líneas) · **MEDIO** · M
- [ ] Extraer secciones (`KPISection`, `FacturasSection`, `AlertasSection`, etc.).

### P3.6 — Utilidades de fecha centralizadas · **MEDIO** · M · riesgo bajo
~60 usos de `new Date()`/`toISOString()` dispersos; Proyectos y Cotizaciones redefinen `toDate/toStr`.
- [ ] Crear `lib/dateUtils.js` y unificar. Reduce bugs de timezone.

### P3.7 — Logging remoto (Sentry/LogRocket) · **MEDIO** · M
Hoy los errores de producción solo van a `console`. Invisibles.
- [ ] Integrar Sentry + conectar el `trackEvent()` existente.

### P3.8 — `select('*')` → columnas explícitas · **BAJO** · M
`getUsuarios`, `getClientes`, etc. Mitigado por RLS pero conviene por claridad/payload.
- [ ] Reemplazar progresivamente.

### P3.9 — Gantt sin virtualización (100+ actividades) · **MEDIO** · L · riesgo alto
Diferido desde v16.9.3. Lag en proyectos grandes.
- [ ] Evaluar ROI. Si se hace, `react-window` cuidando drag/rubber-band (bugs históricos).

---

## P4 — Limpieza

### P4.1 — Archivos basura sin trackear · **BAJO** · S
`src/App_backup_v12_*.jsx`, `src/*_backup_*.jsx/.js` (5 archivos, ~1.567 líneas), `templates/.bin/`, `templates/.vite/`, `templates/.package-lock.json`, `templates/COTIZACION_REFERENCIA.pdf`.
- [ ] Decidir borrar (`rm`) o `.gitignore`. CLAUDE.md ya dice "NO commitear".

### P4.2 — Dead code menor · **BAJO** · S
- [ ] `Fragment` importado sin uso en Proyectos.jsx. Imports sin usar varios.
- [ ] Decidir sobre `Modal.jsx`/`useModal()` (solo 2 usuarios) — migrar a `Dialogs.jsx` (el sistema nuevo) o documentar.

---

## Pendientes manuales ya conocidos (de CLAUDE.md, siguen vigentes)
- [ ] **Cloudflare Turnstile** (captcha login en modo dormido) — activar cuando se decida. Orden importa: env var en Vercel ANTES del secret en Supabase.
- [ ] **Clientes sin RFC/dirección** (50/50) — captura manual; bloquea aprobación de cotizaciones (trigger lo exige).
- [ ] `proyectos.cotizacion_id`, `plantas.fecha_operacion_comercial` — backfills pendientes.

---

## Lo que está BIEN (no tocar)
- **RLS: 28/28 tablas con RLS + políticas** coherentes por rol. Cobertura 100%.
- **Edge Function `invitar-usuario` v5**: authz sólida, guardarraíl anti-escalada, CORS allowlist, password CSPRNG, errores sanitizados.
- **Secrets**: `service_role` y `RESEND_API_KEY` solo en edge functions (Deno.env), nunca en frontend. `.env.local` en `.gitignore`.
- **Sin inyección SQL**: todo vía Supabase SDK parametrizado.
- **Sync leads↔cotizaciones** (v17.6.0): triggers con guarda anti-recursión, verificados.

---

### Resumen de prioridades
| Bloque | Ítems | Esfuerzo total | Cuándo |
|---|---|---|---|
| **P0 Seguridad crítica** | 3 | ~medio día | YA (rotación de credenciales es lo único urgente de verdad) |
| **P1 Hardening** | 5 | ~1 día | Pronto |
| **P2 BD performance** | 4 | ~medio día | Cuando convenga |
| **P3 Calidad/arquitectura** | 9 | ~2-3 semanas | Progresivo (un componente por commit) |
| **P4 Limpieza** | 2 | ~1h | Cuando sea |
