# Row Energy OS — Contexto del proyecto

> Este archivo es leído automáticamente por Claude Code al arrancar. Mantiene el contexto entre sesiones para no perder progreso.

## 👤 Sobre el proyecto y el usuario

**Director General:** Malio Martínez (`mmartinez@row.energy`)
**Empresa:** Row Energy México (energía / interconexiones)
**Producto:** Row Energy OS — plataforma interna multi-rol para gestión integral del negocio
**URL producción:** `app.row.energy` (deployada en Vercel)
**Repo local:** `~/Library/CloudStorage/OneDrive-AmpereEnergía/Row Energy OS/row-energy-os`

## 🛠️ Stack técnico

- **Frontend:** React + Vite + JavaScript (no TypeScript)
- **Estilos:** estilos inline con tokens en `helpers.jsx` (`COLORS`)
- **Routing:** react-router-dom (BrowserRouter)
- **Backend:** Supabase (PostgreSQL + Auth + Edge Functions)
- **Project ref Supabase:** `twwqmjumtqwhhwxrmlse`
- **Deploy:** Vercel
- **Sistema de diseño:** estilo "Klar" — minimalista, mucho espacio en blanco, tipografía serif para titulares (`var(--font-serif)`) y sans-serif para cuerpo

## 🎯 Versión actual en producción

**v15.10.12** — Estado actual en producción (10 may 2026). Ver "📍 Estado de sesión actual" abajo para el contexto vivo.

La versión visible está en `package.json` y se renderiza en el Sidebar como "OS · v{version}". **REGLA**: bumpear `package.json.version` antes de cada commit visible.

### Histórico relevante:
- **v11–v13:** estabilización Gantt + Sidebar Klar
- **v14 MEGA:** ruta crítica CPM (entregado), Kanban fix (entregado)
- **v12.5.6–9e:** sistema de permisos + alertas completo (config + dashboard + centro + drill-down). Ver historial git para detalles.
- **v15.1 — Cuellos de botella widget destacado en Dashboard Ejecutivo** (promueve `identificarCuellosBotella` con drill-down a actividades específicas).
- **v15.2 — Export PDF + Excel del Gantt** (Proyectos → tab Gantt → toolbar). Lazy-loaded chunk de jspdf+exceljs (~1.4MB) para no inflar el bundle principal.
- **v15.3a — PDF cotización inicial** con pdfmake (luego refactor 1:1 en v15.8.2).
- **v15.3b — Edit completeness CotizacionDetalle** (metadata + items editables, no solo crear/borrar).
- **v15.3c — PDF cotización refinada** (ajustes provisionales).
- **v15.4 / 15.4.1 / 15.4.2 — Unificación visual:** tipografía Geist + Geist Mono (eliminado Instrument Serif, decisión de Malio); iconos stroke 1.8 + caps round (matching Sidebar) en helpers.Icon, Modal, CampanaAlertas, CentroAlertas, Sidebar, Proyectos local Icon. Bonus: emoji 🚨 → SVG Alert en Cuellos de botella y Top vencidos.
- **v15.5.1 — PDF cotización fixes** (hojas en blanco, imagen pequeña, T&C doble columna, "Dirigida a" duplicado).
- **v15.6.0 / 15.6.1 — Catálogo de 22 servicios** (`src/serviciosCatalogo.js`) con dropdown en ModalNuevoItem y ModalEditarItem. Autopobla nombre + descripción técnica oficial. Catálogo vive en código (no BD); para actualizar editar el archivo.
- **v15.7.0 — Workflow SIM** (Declaración Operación Comercial). Tab "SIM" en DetalleProyecto con stepper de 6 etapas (Estudios → Contrato → POC → Anexo II → Energización → DOC). Escritura solo direccion/director_proyectos/admin. Tabla `proyecto_sim_etapas` con RLS. **SQL aplicado.**
- **v15.8.0 / 15.8.1 — Catálogo Plantas Eléctricas** (módulo nuevo `/plantas`). Tabla `plantas_electricas` + columna `planta_id` en `proyectos`. CRUD completo, vinculación con proyectos vía PanelProyecto. Templates DOCX descargables según rango MW (≤10 / 10.1-1000). **SQL: `supabase/migrations/v15.8.0_plantas_electricas.sql`.**
- **v15.8.2 — PDF cotización refactor 1:1** con templates/COTIZACION_REFERENCIA.pdf. Imagen hero full-bleed, header constante (logo + folio + "Guadalajara, Jalisco a..."), footer constante (dirección + tel + web + página + banner turbinas). Color verde Row Energy (#0F6E56). Bullets verdes. "Atentamente" centrado.
- **v15.8.3 — Tab Financiero interactivo + botones Eliminar:** click en hito → modal editar/eliminar. Botón "Nuevo hito". Botones eliminar (solo direccion) en Proyecto, Cotización, Factura, Compra, Hito.
- **v15.8.4 — Paneles detalle clickeables en Cobranza/Facturación/Compras** con info del proyecto, cliente, fechas, edición inline, botón "Abrir proyecto →" para drill-down. Fix Compras: dirección modifica estado siempre (antes solo cuando "Solicitada").
- **v15.8.5 — Fix 404 al refrescar en rutas SPA:** `vercel.json` con rewrites `/(.*) → /index.html`.
- **v15.8.6 — Iconos de alertas como SVG** (matching Sidebar) en Centro de Alertas y tab Mis alertas. Reemplaza emojis 💰⏰🚧🎯💸🌱📑👥. Componente nuevo `src/IconAlerta.jsx` + `SVG_PATHS_ALERTAS` en alertas.js.
- **v15.9.0 — Security Hardening completo.** 5 migraciones SQL aplicadas vía MCP (drop tablas muertas, harden weak policies, security definer revoke, perf optimize RLS, FK indexes). Security headers + CSP estricto en `vercel.json`. Advisors: 35 → 6 warnings (los 6 restantes son intencionales: helpers RLS y RPCs callable por authenticated by design + leaked_password_protection que solo se activa por dashboard). Ver sección "🔐 Security Hardening v15.9.0" abajo para checklist pendiente (Auth dashboard + rotación creds).
- **v15.9.1 — Bugfixes reportados por Luis (Q&A).** 6 issues funcionales:
  - **#1 Carga histórica**: VistaPersonas ahora muestra solo "actividades activas en esta semana" + "X pendientes en total" como referencia. `calcularCargaPorColaborador` filtra por traslape con [lunes, domingo) actual.
  - **#2 Peso/sobrecarga no recalcula**: la columna `peso` (existente) sirve para avance del proyecto (0-100%), no para esfuerzo. Agregada UI inline para `horas_estimadas` (existente, default 0). Cuando >0, el cálculo de carga lo prorratea por días que tocan la semana en lugar del fallback 8h/día. UseMemo dependiente de actividades, así que cambios se reflejan inmediato.
  - **#3 Listado plano de actividades por usuario**: PersonaCard expandido ahora agrupa por proyecto (recuadros con código+nombre+conteo).
  - **#4 Desviación 0**: SQL migration `v15.9.1_actividades_fechas_reales.sql` agrega `fecha_inicio_real` y `fecha_fin_real` con trigger automático (estado→'Completada' set fecha_fin_real=hoy). Backfill desde updated_at para completadas existentes. `calcularCargaPorColaborador` ahora calcula desviación real = avg((real_fin - planeado_fin) / duracion_planeada × 100).
  - **#5 Error al crear sub-actividades**: bug crítico — `crearActividad(proyectoId, actividad)` en supabase.js esperaba 2 args pero el caller en Proyectos.jsx pasaba 1 objeto. Refactor a single-arg `crearActividad(actividad)`.
  - **#6 Gantt dependencia invertida**: dot izquierdo y derecho llamaban a `iniciarDrag` con misma signature, sin distinguir sentido. Agregado parámetro `from = 'left' | 'right'`. Si `from === 'left'`, en mouseup se invierte: predecesora = donde soltaste, sucesora = de donde arrastraste. Tooltips actualizados ("Cuando termine esta, empieza la que vincules" vs "Esta inicia DESPUÉS de la que vincules").
- **v15.9.2 — v15.10.10 — Sesión de Q&A + features (28 abr - 10 may 2026):**
  - **v15.9.2 / v15.9.4** — Refinamientos del rubber-band (fromLeft/Right, salir del centro del dot).
  - **v15.9.3** — Fix crear cliente: `email`/`telefono` → `contacto_email`/`contacto_telefono` en `FormClienteInline`.
  - **v15.10.0** — Flujo "Olvidé contraseña" self-service: link en Login, ruta `/reset-password`, `signOut({scope:'others'})` para invalidar otras sesiones al cambiar password.
  - **v15.10.1** — Matriz de permisos ajustada por feedback de Malio: `director_proyectos` pierde cotizaciones/contratos/compras; `ventas` ve todo (excepto config); `cobranza` agrega contratos/compras/cierre. RLS alineada en migration `v15.10.1_align_rls_with_role_changes.sql`.
  - **v15.10.2** — `postventa_tickets` RLS endurecida (antes era `authenticated` libre): read = direccion/admin/director_proyectos/ventas/cobranza, write = direccion/admin/director_proyectos. Migration `v15.10.2_postventa_tickets_harden.sql`.
  - **v15.10.3** — **Ctrl+Z en Gantt** (move/resize/dep/create/delete). Stack 30 acciones, RAM, sesión local. Toast feedback. No dispara en inputs. `equipo_proyectos` ahora solo ve dashboard + proyectos.
  - **v15.10.4** — `recalcularFechasDesde` ahora respeta lag positivo manual. Antes pegaba siempre la sucesora al fin de la predecesora; ahora solo si su inicio actual viola el mínimo. Comportamiento estándar MS Project / Primavera.
  - **v15.10.5** — Banner alertas Dashboard compacto (top 3 + "ver más" + link al Centro). Click colaborador sobrecargado → cambia a vista Personas y expande la card.
  - **v15.10.6 - v15.10.8** — Intentos de mejorar la animación del rubber-band en Gantt. **TODOS FALLARON** según feedback del usuario (línea se congelaba en barras "Sin iniciar"). Probé DOM directo, state simple, listeners always-on. **Sin éxito.**
  - **v15.10.8 (lateral)** — CSP en `vercel.json` ahora permite Google Fonts (`fonts.googleapis.com`, `fonts.gstatic.com`). Antes bloqueaba la fuente Geist.
  - **v15.10.9** — Sidebar fijo cuando se scrollea (`height:100vh + overflow:hidden` en outer; solo el `<main>` scrolea).
  - **v15.10.10** — REVERT QUIRÚRGICO de `src/Proyectos.jsx` al estado de v15.10.4 (commit `913c9de`). Los otros archivos (App.jsx sidebar fijo, Dashboard.jsx alertas, vercel.json CSP fonts) se mantienen como mejoras válidas.
  - **v15.10.11** — Intento parcial de fix del rubber-band: mover a SVG flotante con `zIndex:20` (antes `zIndex:2`, las barras lo tapaban) + quitar `requestAnimationFrame` (volver a setDragTick directo). Mejoró el visual pero el bug real persistía.
  - **v15.10.12 — FIX DEFINITIVO del rubber-band Gantt.** Causa raíz: `dragDepPath` calculaba `x2 = mouseX - rect.left + scrollLeft` pero `rect.left` del timelineRef YA reflejaba el offset del scroll (el SVG se mueve con su parent). Sumar `scrollLeft` adicional duplicaba el offset → la línea se "estiraba" hacia la derecha al hacer scroll. Fix: quitar `+ scrollLeft`. Validado con Playwright en localhost (scroll=0/500/1500, delta_x=0 en los 3). Bug existía desde v15.9.x pero se notó a partir de v15.9.4 cuando se cambió `buildOrthPath` por línea recta diagonal (la diagonal exagera visualmente el offset).

## 📍 Estado de sesión actual (10 may 2026)

### ✅ Bug del rubber-band Gantt RESUELTO (v15.10.12)
3 versiones tomó cerrar este bug crónico (15.10.6 → 15.10.12). El diagnóstico final salió de una pista clave de Malio: "scroll=0 funciona, con scroll se estira". Mirando la fórmula de `x2`, era un doble-conteo del scroll. Validado matemáticamente con Playwright + dev local antes del push.

### ✅ Features de esta sesión (ya en producción)
1. Security Hardening completo BD (v15.9.0): 35 → 6 advisors. Migraciones en `supabase/migrations/`.
2. 6 bugfixes funcionales (v15.9.1): sub-actividades, dependencia invertida, peso/horas, desviación real, etc.
3. Fix crear cliente columnas (v15.9.3).
4. Flujo "Olvidé contraseña" en login (v15.10.0). Requiere config en Auth dashboard.
5. Matriz permisos rebalanceada (v15.10.1, v15.10.2).
6. **Ctrl+Z en Gantt** (v15.10.3) — move, resize, dep, create, delete. Stack RAM 30 acciones.
7. Dependencias respetan lag positivo (v15.10.4).
8. Dashboard alertas top 3 + ver más + click colaborador sobrecargado → vista Personas (v15.10.5).
9. CSP permite Google Fonts (v15.10.8). Sidebar fijo en scroll (v15.10.9).

### ⚠️ Pendientes de acción del usuario (NO se pueden hacer vía MCP)

**Auth Dashboard Supabase (5 min):**
- [ ] Site URL: `https://app.row.energy`
- [ ] Redirect URLs: agregar `https://app.row.energy/reset-password`
- [ ] Disable signups (solo invitación)
- [ ] Min password length: 12
- [ ] Required chars: lower + upper + digit + symbol
- [ ] (Pro plan) Leaked password protection: ON

**Probar flujo "Olvidé contraseña" end-to-end:**
- [ ] Logout → "¿Olvidaste tu contraseña?" → email → click link → poner password real
- [ ] Confirmar que `Row2026!Mali` queda inválida (sesiones revocadas)

**Rotación crítica** (`RowEnergy2026!` aún en git history + temporales en chat):
- [ ] Dashboard → Settings → Database → Reset password
- [ ] Settings → API → Roll JWT secret
- [ ] Actualizar `.env.local`
- [ ] Actualizar Vercel env vars
- [ ] Redeploy

**Edgar (doperaciones@row.energy):**
- [ ] Le pasaste por canal seguro: él entra a `app.row.energy` → "Olvidaste tu contraseña?" → email `doperaciones@row.energy` → setea password real
- [ ] Una vez hecho, `Row2026!Edgar` queda muerta

### 🔧 Setup de MCP pendiente

**Playwright MCP** (para que pueda ver/navegar la app y diagnosticar el bug del Gantt):
```bash
claude mcp add playwright -- npx -y @playwright/mcp@latest
```
Reiniciar Claude Code después. Cuando regreses, tendré tools `browser_*` para navegar, ver DOM, hacer screenshots, ejecutar JS.

### 🎯 Próxima mega: Storage de documentos
Cuando el bug del Gantt esté diagnosticado/cerrado, arrancamos con:
- Bucket Supabase Storage con RLS por proyecto/rol
- Tab "Documentos" funcional en Proyectos (hoy está pero no hace nada)
- Upload con drag-and-drop, preview de PDFs/imágenes, signed URLs

---

## 🗺️ Roadmap pendiente

### ⏸️ Pausados — retomar cuando se decida
- **Email diario alertas (Commit E original)** — Edge Function scheduled + UI de `email_diario` / `email_dias` / `email_hora` en tab Mis alertas. Necesita decidir formato real de `email_dias` (consultar schema vivo de `alertas_config`).
- **v15.7 Pricing engine** — importar matriz Excel `templates/PRECIOS AMPERE.xlsx` (4 sheets: CC sin/con inflación, CE sin/con inflación; ~25 servicios × 18 rangos de capacidad). Vendedor selecciona servicio + capacidad MW + toggle inflación → autopobla precio. Ya existe el catálogo de NOMBRES (v15.6.0); falta el motor de precios.

### ⏳ Próximos features grandes
- **Storage de documentos** (Supabase Storage): tab "Documentos" en Proyectos hoy no funciona. Por proyecto/planta/cliente: subir contratos firmados, planos, fotos de obra, facturas escaneadas. Permisos por rol. Estimado ~3-5 días.
- **Reportes ejecutivos PDF** (board pack mensual/trimestral): KPIs consolidados, comparativo vs mes anterior/meta, lista de proyectos en riesgo, auto-enviado por email. Estimado ~1 semana.
- **Profundizar módulos básicos:** Postventa (SLA tracking, dashboard tickets), Cierre (checklist con docs requeridos, lecciones aprendidas), Contratos (gestión documental, vencimientos automáticos, alertas de renovación). Cada uno ~1-2 días.

### 🔌 Integraciones externas (cuando haga sentido)
- WhatsApp Business para mandar cotización al cliente
- DocuSign / firma electrónica de contratos
- Stripe / Mercado Pago para cobros online
- Google Calendar sync con fechas críticas (cierre, vencimientos, energización)

### 🎯 Sub-mejoras chicas (cualquier momento)
- Crear proyecto desde planta (botón en detalle de planta autopobla capacidad/ubicación)
- Auditoría / log de cambios (compliance)
- Mobile UX polish, especialmente Gantt
- Buscador global mejorado (CommandPalette puede buscar dentro de notas/descripciones)

### 🤔 Sugerencia de orden para próxima sesión
1. **Storage de documentos** — gran feature que el equipo usa día a día y hoy no funciona
2. **v15.7 Pricing engine** — cierra el ciclo de cotizaciones; alto valor para ventas
3. **Reportes ejecutivos** al final cuando ya haya data real fluyendo de los puntos 1-2

## 🏗️ Arquitectura clave

### Roles del sistema (matriz de permisos)
```
direccion         — Malio. Ve todo.
admin             — Operaciones generales.
director_proyectos — Gestiona proyectos.
ventas            — Solo sus leads y cotizaciones.
cobranza          — Cobranza transversal.
equipo_proyectos  — Solo sus actividades.
```

Sistema de permisos en `src/permisos.js`. Función principal: `puede(usuario, modulo)`.

### Sistema de alertas
- Tabla `alertas_config` (1 fila por usuario) con flags por categoría
- Defaults por rol vía función SQL `aplicar_defaults_alertas(uuid)`
- Generador en `src/alertas.js`:
  - `generarAlertas(...)` → alertas AGRUPADAS (banner Dashboard)
  - `generarAlertasDetalladas(...)` → 1 item por alerta (Centro de Alertas)
- 8 categorías: facturas_vencidas, actividades_retrasadas, actividades_bloqueadas, proyectos_cierre_proximo, cxp_autorizacion_pendiente, leads_sin_actividad, cotizaciones_sin_respuesta, colaborador_sobrecargado

### Edge Functions activas
- `/functions/v1/invitar-usuario` — crea usuario en Supabase Auth + envía email de invitación

### Tablas principales (Supabase)
- `usuarios` (id, auth_id, nombre, email, rol, capacidad_horas_semana, activo)
- `proyectos` (id, codigo, nombre, cliente_id, director_id, estado, cierre, ...)
- `actividades` (id, proyecto_id, nombre, responsable_id, inicio, fin, estado, ...)
- `clientes`, `leads`, `cotizaciones`, `facturas`, `cuentas_por_pagar`, `tickets_postventa`
- `alertas_config` (id, usuario_id, + 8 columnas bool por categoría + email_diario, email_dias, email_hora)

## 🐛 Bugs históricos resueltos (NO repetir)

### `getProyectos` no incluía actividades (v12.5.9b)
**Síntoma:** Dashboard mostraba banner vacío aunque la BD tenía actividades retrasadas.
**Causa:** `getProyectos()` en supabase.js hacía `.select('*, cliente, director')` SIN incluir `actividades(*)`. Cualquier código que hacía `proyectos.flatMap(p => p.actividades || [])` recibía `[]`.
**Fix:** Agregar `, actividades(*)` al select de `getProyectos`.
**Ahora getProyectos siempre trae actividades.** Si vas a crear nueva función getProyectos*, considéralo.

### `notifCount` viejo (v12.5.9c)
**Eliminado:** import `getNotificaciones` y state `notifCount` del Sidebar. Reemplazado completamente por `<CampanaAlertas/>`. El sistema viejo de notificaciones fue depreciado a favor de las alertas.

## 📐 Convenciones del código

- **Imports:** estilos inline, no CSS modules ni Tailwind
- **Colores:** siempre vía `COLORS.navy`, `COLORS.amber`, etc — definidos en `helpers.jsx`
- **Mobile:** usar `useIsMobile()` de helpers — breakpoint a 768px
- **Estados de loading:** mostrar texto "Cargando..." con `COLORS.slate400`
- **Botones primarios:** `background: COLORS.navy, color: 'white'`
- **Cards:** `borderRadius: 12-16, border: 1px solid COLORS.slate100`
- **Severidad de alertas:** `critica` (rojo), `importante` (amber), `info` (navy2)
- **Persistencia local:** `loadPref(key, default)` y `savePref(key, value)` — usan localStorage
- **Sin TypeScript:** todo el proyecto es JS puro (.js y .jsx)

## 🎨 Estilo de comunicación (importante para Claude Code)

Malio prefiere:
- **Disciplina:** un commit a la vez, validar antes de seguir
- **Honestidad:** decir cuando algo es riesgoso o cuando no estoy seguro
- **Diagnóstico antes de fix:** entender la causa raíz, no solo síntoma
- **Heads-up explícitos:** avisar de impactos colaterales antes de aplicar
- **Decisiones por opciones:** ofrecer 2-3 caminos con pros/cons en vez de imponer uno
- **Compactos:** evitar redundancia, ir al punto

Malio NO necesita que le explique todo desde cero. Es Director General técnicamente sólido. Habla en español. Trabaja desde Mac (zsh).

## 🔐 Security Hardening v15.9.0

### ✅ Aplicado en BD (5 migraciones)
1. `v15_9_0_drop_unused_tables` — drop `adjuntos`, `comentarios`, `historial_actividad`, `pagos` (vacías, sin uso, sin policies).
2. `v15_9_0_security_definer_hardening` — fix `search_path` mutable en 7 funciones; REVOKE EXECUTE de PUBLIC en triggers internos (`cobrar_hito_al_pagar_factura`, `crear_proyecto_desde_cotizacion`, `trigger_auditoria`, `rls_auto_enable`).
3. `v15_9_0_harden_weak_policies` — endurece `cuentas_por_pagar` y `gastos_variables` (eran `qual=true`); restringe `postventa_tickets` y `lead_actividades` write a roles específicos; agrega INSERT policy en `notificaciones`.
4. `v15_9_0_perf_optimize_rls` — wrap `auth.uid()`/`auth.role()` → `(select ...)` cacheado; consolida multiple permissive policies (split `FOR ALL` en INSERT/UPDATE/DELETE separados); cambia `roles {public}` → `{authenticated}` explícito en 19 tablas; consolida `usuarios_self_update` + `usuarios_update_dir` en una sola policy.
5. `v15_9_0_fk_indexes` — 33 índices nuevos en foreign keys.
6. `v15_9_0_revoke_public_execute` — REVOKE FROM PUBLIC en helpers RLS y RPCs (anon hereda de PUBLIC).

### ✅ Aplicado en frontend (`vercel.json`)
Headers HTTP: CSP estricto (con `connect-src` para Supabase REST + Realtime wss://), HSTS preload 2 años, X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy bloqueando camera/mic/geo/payment/topics, COOP/CORP same-origin.

### ⚠️ Pendiente — acción manual de Malio (no se puede vía MCP)

**Dashboard Supabase → Authentication → Sign In / Up:**
- [ ] Disable signups (toggle OFF "Allow new users to sign up") — solo invitación vía Edge Function `invitar-usuario`.
- [ ] Site URL: `https://app.row.energy`
- [ ] Redirect URLs: agregar solo `https://app.row.energy/**`

**Dashboard Supabase → Authentication → Policies / Password:**
- [ ] Min password length: **12** (default es 6)
- [ ] Required characters: lowercase + uppercase + digits + symbols
- [ ] **Leaked password protection** (HaveIBeenPwned): toggle ON. **Requiere Pro plan**. Si Free → upgrade o skipear.

**Dashboard Supabase → Authentication → MFA:**
- [ ] TOTP ya está habilitado por default. Animar al equipo a activarlo (Settings → Cuenta → Two-factor en la app).

**Rotación credenciales (CRÍTICO — `RowEnergy2026!` está en git history):**
- [ ] Dashboard Supabase → Settings → Database → **Reset database password**
- [ ] Dashboard Supabase → Settings → API → **Roll JWT secret** (rota service_role + anon)
- [ ] Actualizar `.env.local` local
- [ ] Actualizar env vars en Vercel (Settings → Environment Variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_KEY`)
- [ ] Redeploy en Vercel

### Warnings residuales aceptables (6)
- 5 SECURITY DEFINER callable por authenticated: `app_user_id`, `app_user_rol`, `app_has_any_rol` (helpers de RLS, devuelven solo info propia), `duplicar_actividad`, `duplicar_proyecto` (RPCs útiles, restringidos por RLS interna). Patrón estándar Supabase.
- `auth_leaked_password_protection`: solo se activa via dashboard.

### ✅ Edge Function de invitación funciona — NO usar service_role key en frontend.

## 📂 Estructura de archivos clave

```
src/
├── App.jsx                    Routes + Layout + RUTAS_POR_SECCION
├── Sidebar.jsx                Sidebar Klar + filtro por permisos
├── CampanaAlertas.jsx         Campana en Sidebar — popover top 3 + ver todas
├── CentroAlertas.jsx          Página /alertas con drill-down
├── Dashboard.jsx              Dashboard con BannerAlertas
├── Proyectos.jsx              Gestión proyectos + Gantt + Kanban (archivo grande, ~2000+ líneas)
├── Cotizaciones.jsx
├── Leads.jsx
├── Cobranza.jsx
├── Facturacion.jsx
├── Compras.jsx
├── Contratos.jsx
├── Cierre.jsx
├── Postventa.jsx
├── Configuracion.jsx          Tabs: Usuarios, Clientes, ... (falta tab Mis Alertas)
├── CommandPalette.jsx
├── alertas.js                 Generadores + helpers visuales + ETIQUETAS_ALERTAS
├── helpers.jsx                COLORS, useIsMobile, fmts, savePref/loadPref
├── permisos.js                puede(usuario, modulo) + matriz por rol
└── supabase.js                Cliente + getX() funciones
```

## 🚀 Próximos pasos cuando arranque la sesión

1. Leer este archivo (CLAUDE.md)
2. Confirmar con `git status` y `git log -1` que estamos en **v15.8.6** pusheado.
3. Verificar que Malio aplicó el SQL `supabase/migrations/v15.8.0_plantas_electricas.sql` (el de SIM v15.7.0 ya lo aplicó). Si Plantas no carga, ese SQL es la causa.
4. **Si Malio configuró el MCP de Supabase** (ver sección "🔌 MCP Supabase" abajo): usarlo para futuras migraciones automáticas, schema lookups y queries directas. No volver a pedir SQL manual.
5. Preguntar a Malio qué prioriza para la sesión. Mi sugerencia: Storage de documentos → v15.7 Pricing engine → Reportes ejecutivos.

## 🔌 MCP Supabase (configuración futura)

Si Malio configuró el MCP, las tools `mcp__supabase_*` estarán disponibles. Permite:
- Aplicar migraciones SQL automáticamente
- Inspeccionar schema en vivo (útil para v15.7 — formato real de `email_dias`)
- Queries de diagnóstico sin pedir capturas
- RLS policies management

Setup que Malio debe correr una vez:
```bash
claude mcp add supabase \
  -e SUPABASE_ACCESS_TOKEN=sbp_PERSONAL_ACCESS_TOKEN \
  -- npx -y @supabase/mcp-server-supabase@latest \
     --project-ref=twwqmjumtqwhhwxrmlse
```

Token: https://supabase.com/dashboard/account/tokens
Project ref: `twwqmjumtqwhhwxrmlse`
Después: reiniciar Claude Code.

## 🧪 Comandos útiles

```bash
# Dev server
npm run dev

# Build local (verificar que compila)
npm run build

# Test rápido de archivo
node --check src/alertas.js

# Git status diario
git status
git log --oneline -5
```

## 📊 Datos operacionales útiles

- 7 usuarios operativos
- BD limpia (último estado conocido):
  - 0 facturas vencidas
  - 0 CxP próximas vencidas
  - 1 actividad retrasada: PRY-001 "Estudio de Impacto" (Edgar Medina)
  - 0 actividades bloqueadas
  - 1 ticket Alta TK-0001 "Renovación CNE"
- Config alertas Malio (rol direccion): todos true excepto `leads_sin_actividad` y `cotizaciones_sin_respuesta`

---

*Última actualización: v15.8.6 · 2026-04-28*
