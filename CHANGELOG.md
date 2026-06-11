# Row Energy OS — Historial de versiones

Registro detallado de cada versión entregada. Para contexto de sesión activa ver `CLAUDE.md`.

---

## v17.x (may–jun 2026)

- **v17.6.0** (10 jun) — **leads ↔ cotizaciones 1:1 + sync bidireccional automático**. (1) Import: reconciliación del Excel "Seguimiento cotizaciones" (hojas 2024/2025/2026) contra BD por código normalizado → +13 cotizaciones nuevas de 2026 + 3 cambios de estado (carga con triggers de usuario deshabilitados para no spawnear proyectos basura desde el workflow de aprobación). (2) Sync (`v17.6.0_sync_bidireccional_leads_cotizaciones.sql`): cada cotización tiene un lead espejo (`cotizaciones.lead_id`); triggers `sync_cotiz_to_lead` (BEFORE INSERT/UPDATE — crea lead al insertar, sincroniza estado/monto/nombre) y `sync_lead_to_cotiz` (AFTER UPDATE) con guarda anti-recursión `pg_trigger_depth()`. Mapeo estado↔etapa. El reverso NO fuerza `Aprobada` desde el lead (evita disparar creación de proyecto + guard de cliente). (3) Backfill de leads espejo SOLO para cotizaciones 2025 (185 leads). Script de parseo: `scripts/parse_cotiz_xlsx.cjs`. Dashboard refleja automáticamente (pipeline ponderado pasó de ~$60k a ~$110M). **Pendiente opcional**: UI para mostrar el vínculo lead↔cotización explícito en los módulos.
- **v17.5.0** (10 jun) — **alta de usuarios para director_proyectos y ventas**. Nuevo permiso granular `puedeCrearUsuarios` (≠ `puedeGestionarUsuarios`): estos roles ahora ven el tab Usuarios y pueden dar de alta colaboradores, pero **solo con rol `equipo_proyectos`** (guardarraíl anti-escalada). Editar rol / desactivar / eliminar / reinvitar siguen exclusivos de Dirección, igual que el tab Clientes. Helper `puedeCrearRol(usuario, rol)`. Edge Function `invitar-usuario` **v5**: amplía el allowlist de invitadores y valida el rol objetivo del lado servidor (control real). En el modal de alta, no-Dirección no elige rol (fijo a equipo_proyectos). **Pendiente deploy Edge Function** (`supabase functions deploy invitar-usuario`).
- **v17.4.1** (8 jun) — barrido global: TODOS los `alert`/`confirm`/`prompt` nativos del navegador → diálogos propios en 13 módulos (Cotizaciones, Plantas, Facturación, Compras, Leads, Cobranza, MisActividades, Postventa, Dashboard, Contratos, CentroAlertas, exportGantt + Proyectos de v17.4.0). Cero diálogos nativos en la app. `promptDialog` agregado a `Dialogs.jsx`.
- **v17.4.0** (8 jun) — sistema global de diálogos `src/Dialogs.jsx`: `toast()` + `confirmDialog()` a nivel de módulo (sin context ni props), `<DialogHost/>` montado una vez en App.jsx, estilo Klar. Proyectos.jsx migrado (7 confirm + ~30 alert); toast local de DetalleProyecto unificado al global.
- **v17.3.2** (8 jun) — **fix borrado de actividades**: la política RLS `acts_delete` no incluía la rama `equipo_proyectos AND app_es_miembro_proyecto` que sí tenían insert/update → los miembros podían crear/editar pero el DELETE fallaba en silencio (RLS bloquea 0 filas, sin error) y reaparecían al recargar. Migración alinea `acts_delete` con `acts_update`. `eliminarActividad` usa `.select('id')` y lanza `NO_AUTORIZADO_PROYECTO` si 0 filas. **+ hardening seguridad** (3 migraciones post-advisors): cerrar funciones trigger/cron a RPC (revoke EXECUTE a public/anon/authenticated), fijar `search_path` en 2 funciones, revocar PUBLIC en helpers RLS de actividades (ya no anon-ejecutables).
- **v17.3.1** — edición inline de estado (actividades principales) + fechas en tabla de actividades
- **v17.3.0** — RLS actividades: equipo por proyecto (`app_es_miembro_proyecto`) + jefes de proyectos (flag `usuarios.es_jefe_proyectos`). Fix: equipo_proyectos no podía cambiar estado/crear subactividades (política exigía responsable_id = uid pero 96% tienen responsable NULL)
- **v17.2.3** — Gantt: oculta la barra de scroll propia del cuerpo (doble scroll al final)
- **v17.2.2** — Gantt: barra de scroll horizontal fija al pie del viewport
- **v17.2.1** — alertas de acceso solo a no-autorizados (silencio total para roles con permiso) + webhook `alerta_accesos_sensibles` (pg_net trigger) + fix deeplink Plantas→proyecto + edición de planta para equipo_proyectos
- **v17.2.0** — audit tracking cotizaciones + financiero + limpieza plantas
- **v17.1.8** — cotizaciones detalle: desglose Subtotal / IVA 16% / Total
- **v17.1.7** — cotizaciones: filtros año/mes/búsqueda, agrupar por cliente, editar cliente en modal, items importados desde PDFs
- **v17.1.5** — fix Gantt fechaInicio/fechaFin con actividades sin fecha (117 proyectos)
- **v17.1.4** — Gantt undo incluye cascada: Ctrl+Z deshace drag + recalcularFechasDesde
- **v17.1.3** — fix Gantt sticky: leyenda al fondo sticky bottom, header sticky top
- **v17.1.2** — Gantt UX: leyenda arriba, header sticky, toast no-puede-editar + fix drag para equipo_proyectos en actividades ajenas
- **v17.1.1** — render error states + sidebar active state respeta query string
- **v17.1.0** — audit log completo (BD triggers + frontend tracking + vista admin + auto-purga)
- **v17.0.4** — drill-downs Dashboard → módulos con filtros pre-aplicados (replica del patrón v17.0.3)
- **v17.0.3** — drill-down cierre próximo Dashboard → /proyectos?filtro=cierre_proximo
- **v17.0.2** — fix prefs leak cross-user + Gantt highlight bloqueadas + panel alertas por proyecto

---

## v16.9.3 — Sort + auditoría multi-agente fixes (17 may 2026)

4 agentes paralelos. Malio pidió "ataca todo" del audit + sort/persistencia en list views.

**Sort persistente por usuario (localStorage):**
- Nuevo helper `<SortControl>` + `aplicarSort()` en `helpers.jsx`. Dropdown campo + toggle ↑/↓.
- Aplicado en 10 list views: Proyectos, Cotizaciones, Plantas, Cobranza (hitos), Facturación, Compras, Contratos, Postventa, Cierre, Configuración (Usuarios + Clientes).
- Pref keys: `sort.<modulo>` (ej. `sort.proyectos`, `sort.cobranza.hitos`).

**Bug fix `ESTADOS_HITO` divergente:**
- `Proyectos.jsx` redefinía local con `'Pagado'` mientras helpers/Cobranza usan `'Cobrado'`. Hitos con `'Pagado'` eran invisibles al filtro de Cobranza.
- Fix: eliminar local, importar de helpers, `esCompleto` a solo `'Cobrado'`. Color semaforo aislado en `SEMAFORO_HITO`.

**Permisos hardcoded → helpers:**
- `Dashboard.jsx:458`, `Plantas.jsx:31,207` migrados a `esRolEn`/`puedeGestionarProyecto`.

**Catches silenciosos → feedback:**
- `Cotizaciones.jsx:528` pricing engine: banner rojo + botón Reintentar.

**Emojis residuales → dot CSS:**
- `Proyectos.jsx:2391` Kanban: `🔴🟡🔵🟢⚪` → `<span background:c.dot>`.

**RBAC ventas ocultar edits:**
- Cobranza/Facturación/Compras usan `puedeEditarFinanciero(usuario)` para botones "Nuevo X" y selects de estado.

**Diferido (deuda técnica):** 74 hex hardcoded Proyectos.jsx, 18 modales sin ModalShell, 75 sim_etapas vencidas, clientes RFC+dirección, proyectos.cotizacion_id, plantas.fecha_operacion_comercial.

---

## v16.9.0 — Backfill Monday + TabActividades grid + Auth (17 may 2026)

Ejecutó plan v16.9.0 (auditoría 3 agentes post-v16.8.0) completo.

### A. Backfill BD (UPDATEs idempotentes desde Monday)

**CRIT-1 fechas sub-actividades:** 4,773 sin fechas → 320 (recuperadas 4,453). Causa raíz: script leía `date`/`date_mkre36p3` que solo existen en items padre; subitems usan `date0`/`date_mkrhs6t9`. Fix: detección por `cv.type=='date'`.

**CRIT-2 responsables:** 15 → 1,083 con responsable. Causa raíz: `multiple_person_mm0nm79q` hardcoded; cada board usa ID distinto. Fix: filtrar `cv.type=='people'`, parsear `personsAndTeams[].id`, mapear monday_user_id → email.

**MED proyecto_sim_etapas:** 211 etapas en 133 proyectos. Mapeo grupos Monday → ETAPAS_SIM (estudios, contrato, poc, anexo, energizacion). Fechas = min/max de items del grupo.

**HIGH clientes (Admin items):** 0 actualizados — las columnas de los 50 boards Admin están vacías en Monday (no es bug del script).

**LOW archivos adjuntos:** diferido.

### B. TabActividades rework (CSS Grid 9 col)

`src/Proyectos.jsx`. Reemplaza render recursivo de `<div>`s por CSS Grid: `Chevron | # | Nombre | Inicio | Fin | Dur | Avance | Estado | Acciones`.
- `gridTemplateColumns: '32px 28px 1fr 90px 90px 60px 140px 120px auto'` + header sticky.
- `useState(new Set())` para `collapsed` — mismo patrón Gantt.
- `<Fragment key={act.id}>` por fila. Group headers con `gridColumn: '1/-1'`.
- `useMemo` para `childrenMap` y `avanceMap` — evita `.filter()` por cada fila con 7,252 actividades.

### C. Auth Dashboard (Management API)

Aplicado vía `PATCH /v1/projects/{ref}/config/auth`:
- ✅ `disable_signup: true`
- ✅ `password_min_length: 12`
- ✅ `password_required_characters: lower+upper+digit+symbol`
- ✅ `jwt_exp: 1800`
- ❌ `password_hibp_enabled`: 402 Pro plan required

---

## v16.8.0 — UI rework + migración masiva Monday (16-17 may 2026)

Wipe completo de datos de prueba (50 archivos test, 6 usuarios test, 19 tablas en 0). Migración completa desde Monday.com vía API GraphQL.

**UI Proyectos:**
- Tab Actividades: botón "+" discreto por fila (col Acciones), group headers por `fase`.
- Filtro `tipo_proyecto` (Todos / Interconexión / Conexión / Almacenamiento / Estudios Eléctricos).
- Fix bug navegación: click sidebar "Proyectos" desde DetalleProyecto regresa a la lista.

**Export Gantt PDF** (rewrite en `src/exportGantt.js`): A3 landscape, barras coloreadas por estado con overlay avance, líneas ortogonales de dependencias con flecha, group headers por fase, paginación automática.

**Datos migrados:**
- 50 clientes (CLI-001..050), 198 proyectos (PRY-001..198), 7,252 actividades (4,342 sub), 1,161 deps, 90 plantas, 8 usuarios nuevos.

**Scripts migración** (en `/tmp/`, NO en repo): `migrate-monday.py`, `migrate-deps.py`, `migrate-plantas.py`, `migrate-enrichment.py`.

---

## v16.7.0 — Password temporal + Mi cuenta (14 may 2026)

**Crear usuario con password temporal** (Configuración → Usuarios):
- Edge function `invitar-usuario` v4 acepta `generar_password_temporal: true`.
- CSPRNG 12 chars, sin ambiguos (`0/O/l/1/I`), garantiza 1 símbolo. Se muestra una vez al admin.
- Modal "Nuevo usuario" muestra campo "Método de acceso": Invitar por email | Crear con password temporal.

**Cambio de contraseña self-service** (Configuración → Mi cuenta):
- Re-auth con `signInWithPassword` + `updateUser({password})` + `signOut({scope:'others'})`.
- Min 12 chars, nueva ≠ actual, confirmar debe matchear.

**Fix manual aplicado por Malio:**
- Site URL de Supabase Auth corregida a `https://app.row.energy`.
- Redirect URLs: `https://app.row.energy/**` + `https://app.row.energy/reset-password`.

---

## v16.6.0 — Security hardening playbook (may 2026)

Auditoría externa (playbook en `../row-energy-construction/docs/SECURITY_HARDENING_PLAYBOOK.md`).

**Cerrado:**
- Policy `usuarios_update` extendida — bloquea cambios a `rol`, `activo`, `email`, `auth_id` en self-update. Migration `v16_6_0_harden_usuarios_self_update`.
- Cloudflare Turnstile preparado en modo dormido — `src/Turnstile.jsx` + `Login.jsx`. Sin `VITE_TURNSTILE_SITE_KEY` devuelve null (login funciona normal).
- `uploadDoc` deriva extensión del MIME (no del nombre de archivo). Whitelist `MIME_TO_EXT` + `_basename()`.

**Diferido:**
- MED-1 (`unsafe-eval` CSP): `pdfMake` y `exceljs` requieren `new Function()`. No se puede quitar sin probar build.
- MED-2 (`dangerouslySetInnerHTML` en `IconAlerta`): paths hardcoded, safe. Bajo ROI.
- MED-3 (MFA TOTP forzado admins): ~2-3h UI, decisión de producto.

**Activación Turnstile (pendiente manual):**
1. Cloudflare → Turnstile → Add site `app.row.energy` → Site Key + Secret Key.
2. Vercel → `VITE_TURNSTILE_SITE_KEY=<site_key>` → redeploy.
3. Supabase → Auth → CAPTCHA → enable → paste Secret Key.
> Orden crítico: Vercel env + redeploy ANTES de pegar Secret en Supabase.

---

## v16.5.0 — Cleanup UI + perf (may 2026)

Punch list LOW del hard review v16.1.4.

- `LoadingState`/`EmptyState` consistentes en Cotizaciones, Compras, Facturacion.
- Colores nuevos en `COLORS`: `amberBorder`, `amberInk`, `amberSemaforo`, `successLight`, `successInk`. Migrados hex hardcoded.
- `ModalShell` helper en `helpers.jsx` — disponible para uso futuro (NO migrados modales existentes).
- `MS_PER_DAY` constante en `supabase.js` — 6 instancias de `(1000*60*60*24)` reemplazadas.
- Upload paralelo en TabDocumentos: `Promise.allSettled` en lugar de for serial.
- Catch silencioso → banner rojo en `WorkflowPostCierre`.

---

## v16.4.0 — Validaciones críticas + permisos centralizados (may 2026)

Punch list MEDIUM del hard review v16.1.4.

- `RFC_REGEX = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/` + `validarRFC()` en `supabase.js`. Validación antes de mutar.
- `capacidad_horas_semana`: parseInt + clamp 1..168 en `crearUsuario` y `actualizarUsuario`.
- `permisos.js`: `esRolEn`, `esDirOAdmin`, `puedeAprobarCotizacion`, `puedeVerFinanciero`, `puedeEditarFinanciero`, `puedeGestionarProyecto`. Migrados callsites en 6 módulos.
- N+1 en `crearProyectoDesdePlantilla`: `Promise.all` en lugar de queries serial.

---

## v16.3.0 — PDF cotización 1:1 al DOCX base (may 2026)

Match 1:1 con `templates/COTIZACIÓN BASE CC (1).docx` (v15.8.2 divergía).

- Títulos: TEAL (#0F6E56) → NAVY (#1F3864).
- Sub-items: bullets verdes → numeración `a) b) c)`.
- T&C: 10 → 17 cláusulas literales. `TC_CLAUSULAS` soporta `subitems` array.
- Tabla Propuesta Económica simplificada: sin IVA visible, sin Condiciones de pago separadas, sin Observaciones. Header #D9E1F2.
- Portada: "ROW Energy" 16pt → 24pt bold. Folio explícito.

---

## v16.2.0 — Hard review post-v16.1.4 (13 may 2026)

4 agentes Explore paralelos (deuda técnica, security, performance, inconsistencias).

**CRITICAL: Edge function `invitar-usuario` con CORS abierto + PII leak.**
- Fix: allowlist origins (`app.row.energy` + localhost), Vary: Origin. Response solo `{ok, reinvited, mensaje}`.

**HIGH: validación + sanitización edge function.**
- Email regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`.
- `capacidad_horas_semana`: parseInt + clamp 1..168.
- Error messages sanitizados (server-only, cliente recibe mensaje genérico).

**Cleanup `supabase.js`:** 8 encabezados "PATCH SUPABASE / pega este bloque" eliminados.

### Punch list hard review v16.1.4 — estado final

**CERRADO en v16.2.0/v16.4.0/v16.5.0:** RFC validation, modal duplicados, permisos centralizados, N+1, MS_PER_DAY, hex hardcoded, LoadingState, upload paralelo.

**DIFERIDO:**
- `Modal.jsx` con `useModal()` sin usuarios.
- Gantt virtualization (2h + riesgo drag/rubber-band).
- 5 modales Proyectos.jsx con overlay duplicado (ModalShell disponible).

**CONFIRMADO SEGURO:** XSS notas (v16.0.0), UUID validation, service_role solo edge function, RLS en todas las tablas.

---

## v16.1.4 — Estado real de auth en TabUsuarios (may 2026)

Bug: lista mostraba "✓ Activo" para todos, pero 6/9 tenían `auth_id NULL` (huérfanos).

- `estadoAuth(u)` → 3 estados: `✓ Activo` (verde), `⚠ Sin invitar` (rojo), `○ Inactivo` (gris).
- Botón `✉ Invitar` solo si `activo && !auth_id`.
- Banner rojo cuenta huérfanos.
- `reinvitarUsuario(email)` en `supabase.js`.
- Edge Function v2: detecta huérfano, dispara `inviteUserByEmail` + linkea `auth_id` SIN recrear row.

---

## v16.1.3 — Bugfixes cosméticos E2E (may 2026)

- "1 sub-actividades" → "1 sub-actividad" (singular).
- React warning: `border` shorthand + `borderTop:'none'` → split en `borderLeft/Right/Bottom`.

---

## v16.1.2 — Jerarquía ilimitada de actividades (may 2026)

Causa raíz: UI hardcodeada a 2 niveles; backend ya soportaba N desde v15.x.

- `TabActividades`: refactor completo a `renderFila(act, nivel)` recursivo.
- Gantt: `visit(parentId)` recursivo que respeta `collapsed` Set, orden DFS.
- Numeración auto: ej. `5.1.1` (3 niveles). Sin migración SQL.

---

## v16.1.1 — Bugfix: edición de clientes (may 2026)

3 bugs bloqueantes detectados en E2E:
1. `FormClienteInline` sin campo Dirección fiscal (requerida por trigger v16.1).
2. Modal "Nueva cotización" sin botón "+ Nuevo cliente".
3. `actualizarCliente()` no existía — clientes sin dirección sin forma de completarlos.

**Fixes:** `actualizarCliente(id, cambios)` en `supabase.js` + RLS UPDATE ampliada. `FormClienteInline` soporta crear (`cliente=null`) o editar (`cliente=obj`). TabClientes read-write con badge ⚠ INCOMPLETO. Migration: `v16.1.1_clientes_update_align.sql`.

---

## v16.1.0 — Workflow Post-Cierre CRM (may 2026)

Cuando cotización pasa a 'Aprobada': trigger crea 3 tareas (Admin 2d, Legal 3d, Proyectos 5d) con plazos en días hábiles. Valida RFC + dirección del cliente (bloquea con error legible si faltan).

**BD:** `tareas_post_cierre`, `sumar_dias_habiles()`, trigger `BEFORE UPDATE ON cotizaciones`. Migration: `v16.1.0_workflow_post_cierre.sql`.

**Frontend:** `WorkflowPostCierre` en Cotizaciones (timeline horizontal 3 cards). `BandejaPostCierre` en Dashboard. Alerta `tareas_post_cierre_vencidas` en alertas.js.

---

## v16.0.0 Mega — Security + Storage + Pricing engine (11 may 2026)

### Fase 1 — Security review
- Stored XSS en notas: `formatoContenido` usaba `dangerouslySetInnerHTML`. Fix: JSX nativo.
- UUID validation en `getNotificaciones`: requiere UUID válido antes de interpolar a PostgREST.

### Fase 2 — Storage documentos
- Bucket privado `proyectos-docs` (50 MB max, MIME whitelist). RLS con `EXISTS` contra tabla padre.
- Helpers: `uploadDoc`, `listDocs`, `getSignedDocUrl`, `deleteDoc`, `downloadDoc`, `DOC_CATEGORIAS`.
- Path: `{scope}/{scopeId}/{categoria}/{timestamp}_{filename}`.
- `TabDocumentos`: drag-and-drop, 6 categorías, preview modal (PDF/imagen).
- Migration: `v16.0.0_storage_documentos.sql`.

### Fase 3 — Pricing engine
- `precios_servicios` con 184 registros (16 servicios × rangos MW × tipos CC/CE).
- `buscarPrecioServicio({servicio, tipo, capacidadMw, conInflacion, anios})` con fórmula `precio * 1.05^años`.
- UI colapsable en `ModalNuevoItem` (Cotizaciones). Botón "Usar este precio".
- Migration: `v16.0.0_pricing_engine.sql`.

---

## v15.9.0 — Security Hardening completo (abr 2026)

5 migraciones SQL vía MCP:
1. `v15_9_0_drop_unused_tables` — drop `adjuntos`, `comentarios`, `historial_actividad`, `pagos`.
2. `v15_9_0_security_definer_hardening` — fix `search_path` mutable en 7 funciones; REVOKE EXECUTE de PUBLIC en triggers internos.
3. `v15_9_0_harden_weak_policies` — endurece `cuentas_por_pagar`, `gastos_variables`, `postventa_tickets`, `lead_actividades`. Agrega INSERT policy en `notificaciones`.
4. `v15_9_0_perf_optimize_rls` — wrap `auth.uid()`/`auth.role()` → `(select ...)` cacheado; consolida policies; cambia `roles {public}` → `{authenticated}` en 19 tablas.
5. `v15_9_0_fk_indexes` — 33 índices nuevos en foreign keys.

Security headers en `vercel.json`: CSP, HSTS preload 2 años, X-Frame-Options DENY, Referrer-Policy strict, Permissions-Policy (camera/mic/geo/payment bloqueados), COOP/CORP same-origin.

Advisors: 35 → 6 warnings (los 6 son intencionales: helpers RLS callable por authenticated + HIBP).

---

## v15.10.x — Sesión Q&A + features (28 abr - 10 may 2026)

- **v15.10.0** — Flujo "Olvidé contraseña" self-service: link en Login, ruta `/reset-password`.
- **v15.10.1** — Matriz permisos: `director_proyectos` pierde cotizaciones/contratos/compras; `ventas` ve todo excepto config; `cobranza` agrega contratos/compras/cierre. Migration `v15.10.1_align_rls_with_role_changes.sql`.
- **v15.10.2** — `postventa_tickets` RLS endurecida. Migration `v15.10.2_postventa_tickets_harden.sql`.
- **v15.10.3** — Ctrl+Z en Gantt (stack 30 acciones, RAM, sesión local). Toast feedback. `equipo_proyectos` solo dashboard + proyectos.
- **v15.10.4** — `recalcularFechasDesde` respeta lag positivo manual (comportamiento MS Project / Primavera).
- **v15.10.5** — Banner alertas Dashboard compacto (top 3 + "ver más"). Click colaborador sobrecargado → vista Personas.
- **v15.10.6-v15.10.8** — Intentos mejorar rubber-band Gantt. **TODOS FALLARON.** Probé DOM directo, state simple, listeners always-on.
- **v15.10.8 (lateral)** — CSP permite Google Fonts (`fonts.googleapis.com`, `fonts.gstatic.com`).
- **v15.10.9** — Sidebar fijo al scrollear (`height:100vh + overflow:hidden` en outer).
- **v15.10.10** — REVERT QUIRÚRGICO de `Proyectos.jsx` a estado v15.10.4 (commit `913c9de`).
- **v15.10.12** — **FIX DEFINITIVO rubber-band Gantt.** Causa raíz: `dragDepPath` calculaba `x2 = mouseX - rect.left + scrollLeft` pero `rect.left` del timelineRef YA incluía el scroll offset (el SVG se mueve con su parent). Sumar `scrollLeft` duplicaba el offset. Fix: quitar `+ scrollLeft`.

---

## v15.9.1 — Bugfixes Q&A (Luis) (abr 2026)

1. **Carga histórica:** `calcularCargaPorColaborador` filtra por traslape con [lunes, domingo) actual.
2. **Horas estimadas UI:** campo inline en actividades, prorratea carga por días que tocan la semana.
3. **Listado por usuario:** `PersonaCard` expandido agrupa por proyecto.
4. **Desviación real:** migration `v15.9.1_actividades_fechas_reales.sql` agrega `fecha_inicio_real`/`fecha_fin_real` con trigger (estado→'Completada' set fecha_fin_real=hoy).
5. **Bug crear sub-actividades:** `crearActividad(proyectoId, actividad)` esperaba 2 args; refactor a single-arg `crearActividad(actividad)`.
6. **Gantt dependencia invertida:** parámetro `from = 'left' | 'right'`. Si `from === 'left'`, invierte predecesora/sucesora en mouseup.

---

## v15.8.x (abr 2026)

- **v15.8.0/15.8.1** — Módulo Plantas Eléctricas (`/plantas`). `plantas_electricas` + `planta_id` en `proyectos`. Templates DOCX descargables. Migration `v15.8.0_plantas_electricas.sql`.
- **v15.8.2** — PDF cotización refactor 1:1 con `templates/COTIZACION_REFERENCIA.pdf`. Hero full-bleed, header/footer constantes.
- **v15.8.3** — Tab Financiero interactivo: click en hito → modal editar/eliminar. Botones Eliminar (solo direccion).
- **v15.8.4** — Paneles detalle clickeables en Cobranza/Facturación/Compras. Botón "Abrir proyecto →".
- **v15.8.5** — Fix 404 al refrescar en rutas SPA: `vercel.json` con rewrites `/(.*) → /index.html`.
- **v15.8.6** — Iconos alertas como SVG en Centro y tab Mis alertas. `src/IconAlerta.jsx` + `SVG_PATHS_ALERTAS`.

---

## v15.7.0 — Workflow SIM (abr 2026)

Tab "SIM" en DetalleProyecto. Stepper 6 etapas: Estudios → Contrato → POC → Anexo II → Energización → DOC. Tabla `proyecto_sim_etapas` con RLS.

---

## v15.6.0 — Catálogo de 22 servicios (abr 2026)

`src/serviciosCatalogo.js` con 22 servicios. Dropdown en `ModalNuevoItem` y `ModalEditarItem`. Autopobla nombre + descripción técnica.

---

## v15.4.x — Unificación visual (abr 2026)

Tipografía Geist + Geist Mono (eliminado Instrument Serif). Iconos stroke 1.8 + caps round en todos los componentes. Emojis → SVG en Cuellos de botella.

---

## v15.3.x — PDF cotización inicial (abr 2026)

`exportCotizacion.js` con pdfmake. Lazy-loaded desde `Cotizaciones.jsx:274`.

---

## v15.2.0 — Export PDF + Excel del Gantt (abr 2026)

`src/exportGantt.js`. Lazy-loaded chunk de jspdf+exceljs (~1.4MB).

---

## v15.1.0 — Widget Cuellos de botella (abr 2026)

Dashboard Ejecutivo: `identificarCuellosBotella` con drill-down a actividades específicas.

---

## v14 MEGA — Ruta crítica CPM + Kanban fix (abr 2026)

CPM (Critical Path Method) para cálculo de ruta crítica. Kanban view estabilizado.

---

## v12.5.6–v13 — Sistema de permisos + alertas + Gantt (2026)

- Sistema de alertas completo: config + dashboard + centro + drill-down.
- Estabilización Gantt + Sidebar Klar.
- `getProyectos` incluye `actividades(*)` — bug histórico resuelto.
- `notifCount` eliminado del Sidebar → reemplazado por `<CampanaAlertas/>`.

---

## 📝 Lección clave entre sesiones (13 may 2026)

Local en `e4393ae` (10 may). Malio commiteó del 11-12 may. La siguiente sesión empezó a re-implementar v15.12.0 (Storage + Pricing + Security) que ya estaba en remote como v16.0.0-v16.1.4. Commit local quedó en branch `backup-v15.12.0-local`, reset hard a `origin/main`.

**Regla:** `git fetch origin && git log --oneline HEAD..origin/main` ANTES de planear features grandes.
