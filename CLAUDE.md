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

## ✅ ENTREGADO EN v16.9.0 (17 may 2026)

Auth Dashboard toggles aplicados vía Management API (Opción B automatizada): disable_signup, password_min 12, required chars lower+upper+digit+symbol, JWT 1800. Solo HIBP queda diferido (requiere Pro plan).

Backfill Monday completo: 4,453 fechas sub-actividades + 1,068 responsables recuperados, 211 SIM etapas en 133 proyectos.

TabActividades migrado a CSS Grid de 9 columnas con collapse/expand.

Ver sección "🌳 v16.9.0" más abajo para detalles.

---

## 📦 Plan v16.9.0 — REFERENCIA HISTÓRICA (ejecutado completo)

Auditoría con 3 agentes detectó que la migración Monday → Supabase (v16.8.0, 17 may) tiene fixes pendientes. Malio aprobó plan completo A+B+archivos. Pidió ejecutar en próxima sesión (esperando nueva versión Claude/MCP). Token Monday usado en la migración fue revocable (`eyJhbGciOiJI...rgn:use1` — si Malio lo revocó, pedir uno nuevo). Project ref Supabase: `twwqmjumtqwhhwxrmlse`.

### A. Re-migración BD (UPDATEs idempotentes, NO recrear filas)

**CRIT-1 — Fechas de sub-actividades faltantes en 4,773 / 7,252.**
Causa raíz: en Monday los subitems boards usan IDs de columna DISTINTOS a los items padre. Mi script (`/tmp/migrate-monday.py` líneas 324-325) leía `date` y `date_mkre36p3` que no existen en subitems. Los IDs reales en subitems: `date0` (inicio) y `date_mkrhs6t9` (fin). Las fechas SÍ están en Monday.

Fix: backfill — query `actividades WHERE parent_id IS NOT NULL AND inicio IS NULL`, re-fetch subitems Monday por board_id, leer las columnas con IDs correctos, UPDATE.

**CRIT-2 — Responsables faltantes en 7,237 / 7,252.**
Mi script hardcoded `multiple_person_mm0nm79q`. Hay ~38 IDs distintos de people columns en distintos boards. Fix: en lugar de buscar por ID, recorrer todas las columnas y filtrar por `cv.type == 'people'`. Parsear `value` JSON (`personsAndTeams[].id`) y mapear monday_user_id → usuarios.email usando la lista de 10 users que sacamos antes (Alan/Alfonso/Antonio/Helida/Mayra/Noel/Noemi/Carlos + Edgar + Malio).

**HIGH — Datos en items de boards Admin (50 clientes).**
Cada cliente tiene items con columnas `Entregables` (file) y `Condiciones de pago` (text). Mi script solo creó clientes desde el nombre del board e ignoró los items. Fix:
- Condiciones de pago → `clientes.notas`
- Entregables → descargar files de Monday y subir a `proyectos-docs/clientes/{id}/`
- Usar `board_relation` (linkedBoardId en linkedPulseIds) para mejor matching cliente↔proyecto (autoritativo, 198 vs los 70 actuales)

**HIGH — Enlaces a entregables en actividades (21 boards).**
Columnas `link_*` con URLs a SharePoint/Drive — no leídas. Fix: leer cualquier `cv.type == 'link'` y guardar en `actividades.notas` (o agregar columna nueva `url_entregable`).

**MED — Avance + prioridad en subitems.**
Subitems boards usan IDs distintos para `numeric_*` (avance) y `color_*` (prioridad). Fix: detectar por type.

**MED — Poblar `proyecto_sim_etapas` desde grupos Monday.**
Mapear grupos como "Permiso de Generación", "Estudios de Interconexión", "POC" → etapas SIM existentes (Estudios, Contrato, POC, Anexo II, Energización, DOC). INSERT con fecha_inicio = min(act.inicio del grupo), fecha_fin = max(act.fin del grupo).

**LOW — Archivos adjuntos en items (9 boards).**
Descargar de Monday vía `assets.url` y subir a Storage bajo scope `proyectos/{id}/entregables/`.

### B. UI rework — TabActividades (v16.9.0)

Diseño confirmado por agente Plan (archivo `src/Proyectos.jsx`, función `TabActividades`, líneas ~2066-2280):

1. **Layout CSS Grid** (NO `<table>` porque rompe el render recursivo). Columnas: `gridTemplateColumns: '32px 28px 1fr 90px 90px 60px 140px 120px auto'` → `Chevron | # | Nombre | Inicio | Fin | Duración | Avance | Estado | Acciones`.
2. **Header sticky** de columnas con mismo gridTemplate.
3. **Collapse/expand** state local `useState(new Set())`, mismo patrón que Gantt (líneas 1074-1091). Chevron solo si `tieneHijos`. Reusar `Icon.ChevronDown` / `Icon.ChevronRight`.
4. **Indent en celda Nombre** (no en la fila completa, rompería grid). `paddingLeft: nivel * 20` dentro de la columna nombre.
5. **Group headers de fase**: mantener pero envolver con `gridColumn: '1 / -1'` para que ocupen toda la fila dentro del contenedor grid.
6. **Edge cases**: `fmtDate(null)` → `—`; duración `—` si no hay fechas; chevron 32px vacío si 0 hijos; tooltip sobre BarraAvance para sumas de pesos.

Performance: con collapse por defecto, lista visible será ~50-200 filas → no requiere virtualización inicial.

### C. Push v16.9.0

Bumpear `package.json.version` 16.8.0 → 16.9.0, commit con descripción de todos los fixes, push. Vercel deploy auto.

### Estado actual BD (snapshot 17 may después de v16.8.0)

- 50 clientes (sin RFC/dirección — badge ⚠ INCOMPLETO; 70/198 proyectos con cliente vinculado)
- 198 proyectos (105 PI / 93 PC; 19 con MW extraído del nombre; 90 vinculados a planta_id)
- 90 plantas eléctricas (PI no duplicados, tecnología derivada por regex)
- 7,252 actividades (4,342 sub-actividades; 1,161 con deps; 15 con responsable; 4,773 sin fechas)
- 11 usuarios activos: Malio (direccion), Edgar (director_proyectos), Regino (ventas) + 8 nuevos equipo_proyectos (passwords temporales ya distribuidas)
- 0 usuarios huérfanos (los 6 de prueba: desactivados + borrados de auth.users)

---

## 🎯 Versión actual en producción

**v16.9.0** — Estado actual en producción (17 may 2026). Backfill Monday + UI rework + auth hardening, plan v16.9.0 ejecutado completo en sesión.

## 🌳 v16.9.0 — Backfill Monday + TabActividades grid + Auth (entregado)

Sesión 17 may 2026. Ejecutó plan v16.9.0 (auditoría 3 agentes post-v16.8.0) entero: bloque A (re-migración) + bloque B (UI) + Auth Dashboard.

### A. Backfill BD (UPDATEs idempotentes desde Monday, scripts en `/tmp/`)

**CRIT-1 fechas sub-actividades**: 4,773 → **320** (recuperadas 4,453, las 320 restantes son genuinamente vacías en Monday). Causa raíz era leer `date` y `date_mkre36p3` en subitems cuando esos IDs solo existen en items padre. Fix: detección por `cv.type=='date'` en lugar de ID hardcoded.

**CRIT-2 responsables**: 15 → **1,083** con responsable (las 6,169 restantes tampoco tienen people en Monday). Causa raíz era `multiple_person_mm0nm79q` hardcoded; cada board usa un ID distinto. Fix: filtrar por `cv.type=='people'`, parsear `personsAndTeams[].id` y mapear monday_user_id → email vía Monday users API (10 mapeos).

**HIGH enlaces**: 16 actividades con URL de entregable en `notas` (Monday `cv.type=='link'`).

**MED avance/prioridad subitems**: integrados en mismo scan (detección por type).

**MED proyecto_sim_etapas**: 211 etapas en 133 proyectos distintos. Mapeo grupos Monday → ETAPAS_SIM: "Estudios de Interconexión / Impacto / Instalaciones / SIASIC / Permiso de Generación" → `estudios`, "Suscripción de Contrato" → `contrato`, "POC / Operación Comercial" → `poc`, "Anexo 4 / Anexo 2" → `anexo`, "Puesta en Servicio / Energización / Obras" → `energizacion`. Fechas inicio/fin = min/max de items del grupo.

**HIGH clientes (Admin items)**: 0 clientes actualizados — los 50 boards Admin tienen items pero sus columnas (text/file/board_relation) están vacías. No es bug del script: la data simplemente no existe en Monday.

**LOW archivos adjuntos**: diferido (Monday boards con assets ≈ 9, valor bajo vs costo de descarga+re-upload).

### B. TabActividades rework (CSS Grid 9 col)

`src/Proyectos.jsx:2066-2305`. Reemplazo del render recursivo de `<div>`s anidados por CSS Grid de 9 columnas: `Chevron | # | Nombre | Inicio | Fin | Dur | Avance | Estado | Acciones`. Cambios técnicos:

- `display: grid; gridTemplateColumns: '32px 28px 1fr 90px 90px 60px 140px 120px auto'` + header sticky `top:0 zIndex:2`.
- `useState(new Set())` para `collapsed` — toggle chevron por id, mismo patrón Gantt.
- `<Fragment key={act.id}>` por fila para emitir 9 celdas + opcional input inline (`gridColumn: '1/-1'`) sin div wrapper.
- Group headers de fase como filas `gridColumn: '1/-1'`.
- Indent en celda Nombre (`paddingLeft: 8 + nivel * 20`) para no romper grid.
- `useMemo` para `childrenMap` (Map parentId → hijos ordenados por numero) y `avanceMap` (cache ponderado por id) — antes era `.filter()` por cada fila × cada render con 7,252 actividades.
- `onContextMenu` por celda (cada celda lo llama; no wrapper porque no encaja en grid).

Performance: con collapse default ~50-200 filas visibles (de 7,252) — no requiere virtualización inicial.

### C. Auth Dashboard (Management API directa, no MCP)

Aplicado vía `PATCH /v1/projects/{ref}/config/auth` con PAT del usuario:

- ✅ `disable_signup: true` (solo invitación vía Edge Function)
- ✅ `password_min_length: 12`
- ✅ `password_required_characters: lower+upper+digit+symbol` (enum exacto Supabase)
- ✅ `jwt_exp: 1800` (de 3600)
- ❌ `password_hibp_enabled`: **402 Pro plan required** — diferido hasta upgrade

### Pendientes manuales (no cierre del bloque)

- **HIBP leaked password protection**: requiere upgrade Supabase a Pro.
- **Rotación de credenciales** (`RowEnergy2026!` en git history): Dashboard → Settings → Database → Reset password + Settings → API → Roll JWT + actualizar `.env.local` + Vercel + redeploy.

---

## 🌳 v16.8.0 — UI rework + migración masiva Monday (entregado)

Sesión 16-17 may 2026. Wipe completo de datos de prueba previo (50 archivos test borrados de bucket, 6 usuarios test desactivados+borrados auth.users, 19 tablas operativas en 0). Después migración completa desde Monday.com vía API GraphQL (token PAT del usuario).

**UI Proyectos:**
- Tab Actividades limpia: removido row permanente "+ Agregar sub-actividad", agregado botón "+" discreto en cada fila (col Acciones)
- Group headers visuales en Actividades cuando cambia `fase` entre tareas root (replica grupos de Monday)
- Filtro `tipo_proyecto` (Todos / Interconexión / Conexión / Almacenamiento / Estudios Eléctricos)
- **Fix bug navegación**: click en sidebar "Proyectos" estando en DetalleProyecto regresa a la lista (`useLocation` + `location.key` reset)

**Export Gantt PDF** (rewrite completo en `src/exportGantt.js`):
- De `autoTable` plano → render nativo jsPDF
- A3 landscape: columna izquierda (actividad + fechas) + columna derecha con barras visuales
- Header de fechas con años + quarters (escala temporal)
- Barras coloreadas por estado, overlay de avance
- Líneas ortogonales de dependencias entre barras con flecha
- Group headers cuando cambia fase
- Leyenda al pie + paginación automática

**Datos migrados (Monday → Supabase):**
- 50 clientes desde workspace Admin (códigos CLI-001..050)
- 198 proyectos desde workspaces PI (105) + PC (93). Códigos PRY-001..198
- 7,252 actividades incluyendo 4,342 sub-actividades anidadas
- 1,161 actividades con dependencias del Gantt (DependencyValue.linked_item_ids)
- 90 plantas eléctricas (excluyendo "Duplicado de", "Ejercicio", etc.)
- 8 usuarios nuevos del equipo Monday con passwords temporales

**Scripts migración** (en `/tmp/`, NO en repo): `migrate-monday.py` (clientes+proyectos+actividades), `migrate-deps.py` (deps), `migrate-plantas.py`, `migrate-enrichment.py` (cliente match + MW + estado).

**v16.7.0** — Estado anterior (14 may 2026). **Onboarding y self-service de contraseñas completo**: crear usuarios con password temporal + cambio de contraseña en Configuración → Mi cuenta. Site URL de Auth corregida (bug de reset password resuelto).

## 🔑 v16.7.0 — Password temporal + Mi cuenta (entregado)

### Crear usuario con password temporal (Configuración → Usuarios)

El flujo de invitación por email seguía siendo el default, pero faltaba un fallback rápido para cuando:
- El email no llega (spam, bloqueo del servidor del destinatario)
- El admin quiere darle acceso inmediato sin esperar email
- El user no maneja bien email y necesita "aquí está tu password, cámbiala después"

Modal "Nuevo usuario" ahora tiene campo "Método de acceso" con 2 opciones:
- **Invitar por email** (default, más seguro): el destinatario crea su propia password
- **Crear con password temporal**: admin recibe la password, la copia al portapapeles automáticamente, comparte por canal seguro

Password generada en edge function con CSPRNG (`crypto.getRandomValues`), 12 chars, sin caracteres ambiguos (`0/O/l/1/I`), garantiza 1 símbolo. Se muestra una vez al admin (no se loguea, no se guarda en BD).

Edge function `invitar-usuario` v4 acepta `generar_password_temporal:true` en body. Si true, usa `auth.admin.createUser({password, email_confirm:true})` en lugar de `inviteUserByEmail`. Default sigue siendo invite.

### Cambio de contraseña self-service (Configuración → Mi cuenta — nuevo tab)

Disponible para **todos los roles**. Antes solo se podía cambiar la password via "Olvidé contraseña" desde el login (requiere email). Ahora cualquier usuario logueado puede ir a Configuración → Mi cuenta y cambiarla en el sitio.

Form: password actual + nueva + confirmar. Validaciones:
- Min 12 caracteres (alineado con HIGH-3 del Security Hardening Playbook)
- Nueva debe ser distinta a la actual
- Confirmar debe matchear

Flujo:
1. Re-auth con `signInWithPassword(email, actual)` para verificar identidad
2. `updateUser({password: nueva})` aplica el cambio
3. `signOut({scope:'others'})` cierra cualquier otra sesión activa del usuario (defensa contra session hijacking)

El tab también muestra los datos del usuario (nombre, email, rol) como referencia.

### Fix manual aplicado por Malio (14 may) — VERIFICADO FUNCIONANDO

- ✅ **Site URL** de Supabase Auth corregida a `https://app.row.energy` (antes apuntaba a `localhost:3000`, causaba "No se puede acceder a este sitio" al hacer click en email de reset password).
- ✅ **Redirect URLs** agregadas: `https://app.row.energy/**` + `https://app.row.energy/reset-password`.
- ✅ Flow end-to-end probado y funcionando: Login → "¿Olvidaste tu contraseña?" → email llega con link a `app.row.energy/reset-password` → pantalla de cambio de password carga correctamente.

Esto desbloquea el flow "Olvidé contraseña" del login (que existía desde v15.10.0 pero no funcionaba sin esta config).

## 🛡️ v16.6.0 — Security hardening playbook (entregado)

Auditoría externa (playbook en `../row-energy-construction/docs/SECURITY_HARDENING_PLAYBOOK.md`) detectó 3 CRIT + 3 HIGH + 3 MED + 1 LOW. Análisis cruzado contra Row Energy OS: 2 ya cerrados (v16.2.0), 1 manual pendiente, 3 diferidos por riesgo, **3 cerrados en v16.6.0**.

### Cerrado en v16.6.0

- **CRIT-1/HIGH-1: Policy `usuarios_update` extendida.** Antes, el `with_check` solo bloqueaba cambios a `rol` en self-update. Faltaba `activo`, `email`, `auth_id`. Un user auth podía cambiar su `auth_id` (impersonation) o `email` (lockout + takeover por email lookup). Migration `v16_6_0_harden_usuarios_self_update` agrega los 4 chequeos. Direccion/admin siguen pudiendo editar todo (branch admin del OR los exenta).

- **CRIT-3: Cloudflare Turnstile (modo dormido).** Login + reset password expuestos a brute force. `mmartinez@row.energy` es público en repos/docs. Componente `src/Turnstile.jsx` + integración en `Login.jsx`. `captchaToken` se pasa a `signInWithPassword` y `resetPasswordForEmail`. **Sin `VITE_TURNSTILE_SITE_KEY` está dormido** (componente devuelve null, `TURNSTILE_ENABLED=false`, login funciona normal). Activación end-to-end pendiente manual de Malio (ver sección 🔐 más abajo).

- **LOW-1: `uploadDoc` deriva extensión del MIME.** Antes el path usaba `file.name` (controlado por cliente). Si subes `evil.svg.exe` quedaba como `.exe` en el path. Ahora hay `MIME_TO_EXT` whitelist + `_basename()` que quita la ext del nombre. Default `bin` si MIME no está en whitelist. Defense in depth (el bucket ya tiene `allowed_mime_types` que filtra MIME en sí).

### Ya hecho / no aplica

- **CRIT-2 (cron functions anónimas)**: no hay cron functions en Row Energy OS. `invitar-usuario` ya valida JWT desde v16.2.0.
- **HIGH-2 (CORS wildcard)**: cerrado en v16.2.0.
- **HIGH-3 (Auth defaults Dashboard)**: parcialmente hecho (Site URL + Redirect URLs aplicados 14 may). Pendientes: Disable signups, Min password 12, Required chars (lower+upper+digit+symbol), Leaked password protection (HIBP, requiere Pro), JWT expiry 1800s.

### Diferido (documentado)

- **MED-1 (CSP `unsafe-eval`)**: el playbook dice "fácil, sin breaking changes en Vite prod". **Confirmé que NO es así**: `pdfMake` (export cotización) y `exceljs` (export Gantt) usan `new Function()` que requiere `unsafe-eval`. Removerlo sin probar rompe el export. Pendiente: testear con CSP estricto en build local antes de aplicar.
- **MED-2 (`dangerouslySetInnerHTML` en `IconAlerta`)**: paths son constantes hardcoded, safe hoy. Refactor a componentes SVG es defensive only. Bajo ROI.
- **MED-3 (MFA TOTP forzado admins)**: ~2-3h UI nueva, decisión de producto (¿fricción aceptable para admin?).

### 🔐 Activación Turnstile (pendiente manual de Malio)

Cuando decida activarlo:

1. **Cloudflare** (5 min): https://dash.cloudflare.com → Turnstile → Add site → dominio `app.row.energy` → mode "Managed" → copiar **Site Key** y **Secret Key**.
2. **Vercel** (2 min): Settings → Environment Variables → agregar `VITE_TURNSTILE_SITE_KEY=<site_key>` para Production.
3. **Supabase Dashboard** (2 min): Authentication → Settings → CAPTCHA Protection → enable → paste **Secret Key** → guardar.
4. **Vercel** (auto): redeploy. Login y reset password ya pedirán captcha.

**Importante**: si pegas el Secret en Supabase pero NO seteas la env var en Vercel, los logins se rompen (Supabase exige captcha pero frontend no lo manda). Orden seguro: var en Vercel + redeploy → luego Secret en Supabase.

## 🧹 v16.5.0 — Cleanup UI + perf low-hanging (entregado)

Cerrado el punch list LOW del hard review v16.1.4. Cambios cosméticos y bajo riesgo que mejoran consistencia y mantenibilidad sin tocar lógica de negocio.

- **`LoadingState`/`EmptyState` consistentes**: Cotizaciones, Compras, Facturacion ahora usan los componentes de `helpers.jsx` en lugar de div inline. Si se cambia el estilo de loading mañana, es un solo lugar.
- **Hex hardcoded → `COLORS.*`**: agregados `amberBorder`, `amberInk`, `amberSemaforo`, `successLight`, `successInk` a `COLORS`. Migrados callsites en Compras (banner amber), Cobranza (semaforo 31-60d + estados vencido), Cotizaciones (badge "Aprobado" + alerta amber), Contratos (banner incompletos), Facturacion (highlight). Los mapas de estado/color hardcoded en `Proyectos.jsx:61-108` quedan para otra sesión (refactor masivo con riesgo visual).
- **Catches silenciosos → feedback visible**: `WorkflowPostCierre` en Cotizaciones silenciaba el error de `getTareasPostCierre` con console.error + setTareas([]). El usuario veía workflow vacío sin explicación. Ahora muestra banner rojo con mensaje + botón "Reintentar".
- **`ModalShell` helper en `helpers.jsx`**: el patrón overlay + dialog frame estaba duplicado en 5+ modales (Proyectos, Cotizaciones). Helper expone `{title, onClose, width, top, children, footer}`. NO migré los modales existentes — el helper está disponible para uso futuro o migración progresiva.
- **`MS_PER_DAY` constante en `supabase.js`**: reemplazadas 6 instancias de `(1000*60*60*24)` en `calcularCargaPorColaborador` (4) y `identificarCuellosBotella` (2).
- **Upload paralelo en TabDocumentos**: antes for serial con await uploadDoc (5 archivos × 5MB = 5× latencia). Ahora `Promise.allSettled` — sube en paralelo, recoge éxitos/fallos por separado. UX igual pero ~5× más rápido típico.

### Sin tocar (riesgo alto, próxima sesión)
- `Modal.jsx` con `useModal()` sigue sin usuarios — decidir migrar todo o eliminar.
- Gantt virtualization (200+ actividades): 2h + riesgo de romper drag/resize/rubber-band recién estabilizados.
- 5 modales en `Proyectos.jsx` con overlay duplicado: ya existe `ModalShell`, migración progresiva sin presión.

## ✅ v16.4.0 — Validaciones críticas + permisos centralizados (entregado)

Cerrado el punch list MEDIUM del hard review v16.1.4. Los fixes que el equipo iba a chocar al usar la app mañana.

- **Validación RFC (cliente + servidor)**: hoy el sistema aceptaba RFCs como "ABC123" y solo se enteraba al aprobar cotización (trigger BD validaba pero error en momento crítico). `RFC_REGEX = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/` + `validarRFC()` exportados en `supabase.js`. Vacío permitido (RFC es opcional hasta facturar). Validación en `actualizarCliente` y nueva función `crearCliente` (extraída del insert inline en `FormClienteInline`). El form valida antes de mutar — muestra error legible sin pasar a la query.
- **`capacidad_horas_semana` bounds en frontend**: espejo del fix del edge function v3. `crearUsuario` y `actualizarUsuario` ahora hacen parseInt + clamp 1..168, lanzan error legible si fuera del rango. Antes `Number(x) || 40` dejaba pasar NaN.
- **Permisos centralizados (`permisos.js`)**: nuevos helpers `esRolEn`, `esDirOAdmin`, `puedeAprobarCotizacion`, `puedeVerFinanciero`, `puedeEditarFinanciero`, `puedeGestionarProyecto`. Migrados los `usuario.rol === 'direccion'` y arrays `['direccion','admin',...].includes(...)` esparcidos en Cotizaciones, Compras, Cobranza, Facturacion, Contratos, Proyectos. Si cambia la política, ahora es 1 cambio en `permisos.js`.
- **N+1 en `crearProyectoDesdePlantilla`**: antes count proyectos → fetch plantilla activities serial. Ahora `Promise.all` (las dos primeras eran independientes). Ahorra un round-trip por creación de proyecto.

## 📄 v16.3.0 — PDF cotización LITERAL al DOCX base (entregado)

v15.8.2 había usado `templates/COTIZACION_REFERENCIA.pdf` como referencia pero divergía del DOCX real. Malio reportó: "el output actual NO se parece al doc base". Esta versión hace el match 1:1 con `templates/COTIZACIÓN BASE CC (1).docx`.

**Cambios en `src/exportCotizacion.js`:**
- Color títulos: TEAL verde (#0F6E56) → **NAVY profundo (#1F3864)**. El verde Row Energy queda fuera del PDF — sigue en el resto de la app.
- Sub-items de descripciones de servicios: bullets verdes → **numeración a) b) c)** (`subItemLetra` reemplaza `bulletVerde`).
- T&C: 10 → **17 cláusulas literales** del DOCX. Agregadas: Aceptación, Inicio de servicio, Condiciones (con 8 sub-items a-h), Vigencia, Negociación, Límites (con sub Forma de pago), Pago. `TC_CLAUSULAS` ahora soporta `subitems` array (strings simples o `{titulo, texto}` para "6a. Forma de pago"). Renderer `renderClausula` maneja ambos casos.
- **Tabla Propuesta Económica simplificada**: N° / NOMBRE SERVICIO / CANTIDAD / PRECIO UNITARIO / SUBTOTAL. Sin IVA visible (queda en cláusula 11 Impuestos de T&C). Sin "Condiciones de pago" separadas (en cláusula 6 Límites → Forma de pago). Sin "Vigencia" (en cláusula 4). Sin "Observaciones". Header fondo navy claro #D9E1F2.
- Portada: "ROW Energy" 16pt → 24pt bold. Folio CO--XX explícito debajo del título.

Sin cambios funcionales adicionales — sigue lazy-loaded en `Cotizaciones.jsx:274`. Imágenes de `templates/` no cambian (banner-turbinas, cot-hero, cot-mapa, cot-alcance, firma-malio, row-logo).

**Pendiente del director**: validar visualmente el PDF generado vs `/Users/maliomartinez/Downloads/COTIZACIÓN BASE CC (1).pdf`. Si hay diferencias, ajustar en próxima iteración.

## 🔐 v16.2.0 — Hard review post-v16.1.4 (entregado)

Hard review multi-agente (4 agentes Explore en paralelo cubriendo deuda técnica, security, performance, inconsistencias). Detectó 1 CRITICAL + 3 HIGH + varios MEDIUM/LOW. Esta versión cierra todo lo HIGH del bucket "edge function".

**CRITICAL: Edge function `invitar-usuario` con CORS abierto + PII leak.**
- Antes: `Access-Control-Allow-Origin: '*'` + retornaba `usuarioRow` completo (id, nombre, email, rol) en el response success. Cualquier origin externo podía enumerar usuarios.
- Fix: allowlist de origins (`app.row.energy` + localhost dev), Vary: Origin agregado. Response success ahora es `{ok, reinvited, mensaje}` — sin objeto usuario. Frontend en `Configuracion.jsx` ya usaba solo `respuesta.mensaje`, así que es backward-compatible.

**HIGH: validación + sanitización en la misma edge function.**
- Email regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` bloquea formatos inválidos antes de tocar Auth.
- `capacidad_horas_semana` ahora `parseInt` + clamp 1..168 (antes `Number(x)||40` permitía NaN llegar a la BD).
- Error messages internos (`errorInsert.message`, `errorInvite.message`) sanitizados — se loguean server-side, cliente recibe mensaje genérico.

Deployada como **v3** vía MCP supabase. Status ACTIVE.

**Cleanup `supabase.js`**: 8 secciones tenían encabezados tipo "PATCH SUPABASE / CÓMO APLICAR: pega este bloque al final" — instrucciones obsoletas (el código ya estaba integrado). Reemplazados por encabezados simples ("v12.5.6 — CRUD DE USUARIOS"). Sin cambios funcionales.

**Falsos positivos del audit** (sin cambio): "lazy-load pdfMake" — `exportCotizacion.js` ya estaba lazy-loaded en `Cotizaciones.jsx:274`.

### 📋 Punch list pendiente del hard review v16.1.4

Documentado para decidir con el equipo qué priorizar. NO atacado en v16.2.0/v16.3.0 (acuerdo explícito: "no agregar cosas que no usemos o compliquen").

**MEDIUM:**
- RFC validation regex en clientes (hoy acepta "ABC123") → trigger cierre cotización lo deja pasar hasta el momento de aprobar.
- 5 modales en `Proyectos.jsx` con overlay + close button duplicados (líneas 593, 845, 2958, 3330, 3443).
- `Modal.jsx` con `useModal()` hook existe pero **nadie lo usa** — todos los módulos hacen modales inline. Decidir: migrar gradualmente o eliminar `Modal.jsx`.
- Permisos hardcoded `usuario.rol === 'direccion'` en Cotizaciones, Compras, Facturacion, Contratos. Centralizar con `puede()` de `permisos.js`.
- N+1 en `crearProyectoDesdePlantilla` (`supabase.js:88-113`) — 3 queries serial. Cambiar a RPC o `Promise.all`.
- Gantt sin virtualización con 100+ actividades (`Proyectos.jsx:1041, 1115, 1282`) — lag visible si los proyectos crecen.

**LOW:**
- 6× `(d1-d2)/(1000*60*60*24)` → `MS_PER_DAY` constante.
- Hex hardcoded vs `COLORS.*` en Compras/Cotizaciones/Cobranza (#FDE68A, #F59E0B, #16A34A).
- `LoadingState`/`EmptyState` reusables pero algunos módulos hacen div inline (Cotizaciones, Compras, Facturacion).
- `alert()` vs catch silencioso inconsistente (`Cotizaciones.jsx:106` muestra, `:331` silencia).
- Upload de archivos en for loop síncrono — `Promise.allSettled` mejora con multiple files.

**Confirmado seguro** (sin acción):
- XSS en notas (v16.0.0 ya arreglado): JSX nativo OK.
- UUID validation en `getNotificaciones`: regex correcto.
- `service_role` solo en edge function (no en frontend).
- `signOut` limpia sesión bien.
- Storage RLS valida scope/scopeId con regex.
- Reset password usa Supabase recovery session, no tokens en URL.
- RLS habilitado en TODAS las tablas.

## 👤 v16.1.4 — Estado real de auth en TabUsuarios (entregado)

Bug grave detectado mientras Malio pedía agregar a Regino: la lista de usuarios mostraba "✓ Activo" para **todos** los 9 usuarios, pero solo 3 (Malio, Edgar, Regino) tenían cuenta auth real. Los otros 6 estaban en tabla `usuarios` con `auth_id NULL` — huérfanos que no podían loguearse. UX silenciaba el problema.

**Fixes:**
- `estadoAuth(u)` deriva 3 estados visuales: `✓ Activo` (verde, tiene auth), `⚠ Sin invitar` (rojo, sin auth), `○ Inactivo` (gris).
- Badge en columna estado (no plain text) con color según estado.
- Botón **`✉ Invitar`** primario (navy) para usuarios sin auth — sólo aparece si `activo && !auth_id`.
- Banner rojo al top de la lista cuenta huérfanos con instrucciones para invitarlos.
- Helper `reinvitarUsuario(email)` en `supabase.js` llama a la Edge Function `invitar-usuario` solo con email.

**Edge Function v2** (deployada antes en esta sesión): detecta usuario huérfano (existe en tabla `usuarios` sin `auth_id`) y solo dispara `inviteUserByEmail` + linkea `auth_id` SIN recrear el row (preserva FKs en actividades/leads/cotizaciones, 14 referencias para Regino).

Sin migración SQL. Probado en producción: Regino fue invitado con éxito desde el flujo de re-invite.

## 🧪 v16.1.3 — Bugfixes cosméticos detectados en E2E completo (entregado)

E2E exhaustivo Playwright sobre v16.1.2 (crear cliente → proyecto → sub × 4 niveles → eliminar → Kanban → cotización + pricing engine 25 MW = $184,219 → estado Aprobada → workflow post-cierre 3 tareas → Documentos UI). Todo el pipeline funciona end-to-end. Detectados solo 2 issues menores:

- **#1 Plural mal**: "1 sub-actividades" → "1 sub-actividad" (singular cuando count===1).
- **#2 React warning**: mezcla de shorthand `border` + non-shorthand `borderTop:'none'` en el wrapper del botón "+ Agregar sub-actividad". Fixed: split en `borderLeft/Right/Bottom` separados.

**No** son blockers funcionales pero salen en console.error y se ven raros visualmente. Build limpio. Sin migración SQL.

## 🌳 v16.1.2 — Jerarquía ilimitada de actividades (entregado)

Director reportó: "Aparecen nuevos errores al intentar crear sub-actividades. Debido a esto, no fue posible validar la creación de sub-sub-actividades." También pidió: "tambien quieren agregar subactividades de las subavtividades, no los limites".

**Causa raíz:** La UI estaba hardcodeada para exactamente 2 niveles (root + sub). El backend (numeración `1.1.1...`, parent_id self-FK, queries) ya soportaba N niveles desde v15.x — el limitante era puramente visual.

**Cambios en `src/Proyectos.jsx`:**
- **TabActividades**: refactor completo a recursivo. Nueva función `renderFila(act, nivel)` que pinta una fila y luego se llama a sí misma para cada hijo. Cada fila (root, sub, sub-sub, sub-sub-sub...) tiene su propio botón "+ Agregar sub-actividad" → no hay límite de profundidad. Indentación visual por nivel.
- **Gantt (`actOrdenadas` useMemo)**: refactor de filter 2-niveles a `visit(parentId)` recursivo que respeta `collapsed` Set. Renderiza N niveles en orden DFS. CPM y dependencias ya tomaban actividades planas → no requirió cambios.
- **Kanban**: ya funcionaba (filtra por estado, no por nivel).

**Verificación E2E (Playwright):**
- Creé sub-actividad y sub-sub-actividad (nivel 3) en proyecto real.
- Numeración auto-generada: `5.1.1` (3 niveles).
- Visible en TabActividades con indentación, Gantt con barras y dependencias correctas.
- `totalWrappers=15, has3Nivel=true` confirmado por inspección DOM.

Sin migración SQL — solo cambios de render. Build verde.

## 🐛 v16.1.1 — Bugfix: edición de clientes (entregado)

Test E2E exhaustivo del sistema (crear cliente → proyecto → sub-actividad → docs → cotización → pricing → workflow post-cierre → alertas) reveló 3 bugs:

- **BUG #1** (CRÍTICO): el `FormClienteInline` que se usaba para crear cliente NO tenía campo "Dirección fiscal" (ni "Industria"). Pero el trigger v16.1 requiere RFC + dirección para aprobar cotización → loop frustrante: el sistema dice "edita el cliente" pero no había forma de hacerlo.
- **BUG #2**: el modal "Nueva cotización" NO tenía botón "+ Nuevo" para crear cliente inline (a diferencia del modal "Nuevo proyecto"). Inconsistencia UX.
- **BUG #3** (CRÍTICO bloqueante): NO existía función `actualizarCliente()` ni UI para editar un cliente existente. Los clientes creados sin dirección quedaban atrapados sin forma de completarlos.

**Fixes:**
- `actualizarCliente(id, cambios)` en `supabase.js`. RLS UPDATE de `clientes` ampliada a los 5 roles operativos (direccion/admin/ventas/director_proyectos/cobranza), alineado con la policy INSERT de v15.10.13.
- `FormClienteInline` refactorizado: ahora soporta crear (`cliente=null`) o editar (`cliente=obj`). Agregados campos Dirección fiscal (textarea), Industria, Notas. Exportado para reuso. Validación visual: labels indican "necesario para facturar" (RFC) y "necesaria para aprobar cotizaciones" (dirección).
- Modal "Nueva cotización" ahora tiene botón "+ Nuevo" cliente que abre el form inline (UX consistente con modal "Nuevo proyecto").
- TabClientes en Configuración: ahora es read-write. Botón "+ Nuevo cliente". Cada fila es clickeable → expande form de edición inline. Badge **⚠ INCOMPLETO** visible junto a clientes sin RFC o sin dirección (alerta visual proactiva al usuario antes de bloquearse en una cotización).

Migration: `supabase/migrations/v16.1.1_clientes_update_align.sql`.

## 🔄 v16.1.0 — Workflow Post-Cierre CRM (entregado)

## 🔄 v16.1.0 — Workflow Post-Cierre CRM (entregado)

Spec del director de ventas: cuando una cotización se aprueba, dispara automáticamente 3 tareas (Legal/Admin/Proyectos) con plazos en días hábiles. Ventas confirma cuando todo OK → arranca cobranza.

**Backend:**
- Tabla `tareas_post_cierre` (cotizacion_id, departamento, plazo, fecha_limite, asignado_a, estado, archivo_path, completada_en/por). RLS por departamento.
- Función `sumar_dias_habiles(fecha, n)` que salta sábados/domingos.
- Trigger `BEFORE UPDATE ON cotizaciones`: cuando estado pasa a 'Aprobada':
  - Valida que el cliente tenga RFC + dirección fiscal (sino bloquea con error legible).
  - Crea las 3 tareas con plazos (Admin 2d, Legal 3d, Proyectos 5d) y auto-asigna al primer usuario activo de cada rol.
- Columnas nuevas en cotizaciones: `workflow_aprobado_en`, `workflow_aprobado_por`.
- Storage policies actualizadas: scope 'cotizaciones' agregado al bucket `proyectos-docs` para los entregables del workflow.

**Frontend:**
- Helpers en `supabase.js`: `getTareasPostCierre`, `getTareasPostCierrePendientes`, `completarTareaPostCierre` (con upload opcional al bucket), `aprobarWorkflowPostCierre`, `asignarTareaPostCierre`. Constantes: `DEPARTAMENTOS_POST_CIERRE`, `ESTADOS_TAREA_PC`.
- Componente `WorkflowPostCierre` en `Cotizaciones.jsx`: timeline horizontal con 3 cards (legal/admin/proyectos), cada una con asignado + plazo + estado + adjuntar entregable + notas + botón "Marcar completada". Botón "Aprobar workflow → arrancar cobranza" cuando las 3 están OK (solo direccion/admin/ventas).
- `cambiarEstado` en CotizacionDetalle ahora captura el error del trigger y lo muestra en alert (validación cliente).
- `BandejaPostCierre` en Dashboard (vista Ejecutivo): muestra tareas pendientes del usuario actual, con drill-down a la cotización. Resalta vencidas en rojo.
- Categoría alerta nueva `tareas_post_cierre_vencidas` (icon 🔄, severidad importante) integrada en `alertas.js`. Visible en banner Dashboard, Centro de Alertas, y campana sidebar.

**Pendientes para v16.2** (cobranza automática desde el workflow): generación de hitos al confirmar workflow + recordatorio email cliente vía Edge Function programada.

Migration: `supabase/migrations/v16.1.0_workflow_post_cierre.sql`. Verificado E2E con Playwright (validación bloquea, trigger crea 3 tareas, completar con archivo funciona, archivo en bucket, badge "Completada").

## ✅ Mega v16.0.0 — Security review + Storage docs + Pricing engine (entregado)

## 🎉 Mega v16.0 — Entregada

### ✅ Fase 1 — Security review baseline (entregado)
2 fixes high-confidence aplicados antes de Storage:
- **Stored XSS en notas** (`Proyectos.jsx`): `formatoContenido` usaba `dangerouslySetInnerHTML` con un `.replace()` que NO sanitizaba HTML del contenido. Atacante podía inyectar `<script>` y robar tokens de auth de quien viera la nota. Fix: render JSX nativo (sin innerHTML), React auto-escapa.
- **UUID validation en `getNotificaciones`** (`supabase.js`): defense-in-depth. `usuarioId` se interpolaba a `.or()` PostgREST; ahora requiere UUID válido.

### ✅ Fase 2 — Storage de documentos (entregado)
- Bucket privado `proyectos-docs` (50 MB max, MIME whitelist), RLS estrictas con verificación `EXISTS` contra tabla padre (proyectos/plantas/clientes).
- 4 policies: SELECT respeta RLS de la tabla padre; INSERT (todos los roles operativos); UPDATE (direccion/admin/director_proyectos); DELETE (solo direccion/admin).
- Helpers en `supabase.js`: `uploadDoc`, `listDocs`, `getSignedDocUrl`, `deleteDoc`, `downloadDoc`, `DOC_CATEGORIAS`. Path: `{scope}/{scopeId}/{categoria}/{timestamp}_{filename}`.
- UI `TabDocumentos` (exportado desde Proyectos.jsx, reusable): drag-and-drop, selector de categoría (6 categorías), listado por carpeta, preview modal (iframe PDF / img imagen), botones download/delete con permisos.
- Aplicado en **Proyectos** (tab existente activado) + **Plantas** (sección al final del DetallePlanta). Clientes pendiente para futura iteración (TabClientes es read-only).
- Verificado end-to-end con Playwright: upload + listar + preview signed URL + delete.
- Migration: `supabase/migrations/v16.0.0_storage_documentos.sql`.

### ✅ Fase 3 — Pricing engine v15.7 (entregado, MVP)
- Tabla `public.precios_servicios` con 184 registros (16 servicios × ~9 rangos × 2 tipos CC/CE), parseado de `templates/PRECIOS AMPERE.xlsx` con la skill xlsx. Dato típico: "Estudio de Impacto Ampere" CC, 11-30 MW = $184,219 MXN.
- Helpers en `supabase.js`: `getPreciosServicios()` (cache local), `listarServiciosPricing(precios, tipo)`, `buscarPrecioServicio({servicio, tipo, capacidadMw, conInflacion, anios})` con fórmula `precio * 1.05^años`.
- UI: bloque colapsable "💲 Calcular precio según capacidad MW" en `ModalNuevoItem` (Cotizaciones). Dropdown tipo CC/CE → dropdown servicio → input MW → muestra precio con badge del rango. Toggle "con inflación" + input años. Botón "Usar este precio" auto-popula el campo `precio_unitario`.
- Verificado end-to-end con Playwright: COT-003 (Borrador) → Agregar → seleccionar Estudio de Impacto Ampere CC 25 MW → $184,219 calculado → "Usar este precio" → input precio = 184219.
- Migration: `supabase/migrations/v16.0.0_pricing_engine.sql` (incluye los 184 INSERTs).
- **Pendiente para v16.1**: precios con inflación tipo proyección año-por-año (las sheets "CC INFLACIÓN" y "CE Inflación" del Excel tienen precios proyectados a múltiples años; hoy aplicamos 5%/año en runtime, suficiente para el MVP).

### ✅ Fase 4 — Security review final + push (entregado)
- Quick scan: `service_role` solo en edge function (server-side), no expuesto. Único `dangerouslySetInnerHTML` restante es en `IconAlerta.jsx:23` con path constante hardcoded (safe).
- Build limpio. Push directo a main.

### Pendiente del usuario (no bloqueante)
- **Cuando vayas a lanzar la plataforma** (hoy en prueba): rotar credenciales Supabase (`Settings → Database → Reset password`, `Settings → API → Roll JWT`) + actualizar `.env.local` y Vercel env vars + redeploy. Las credenciales actuales (`RowEnergy2026!`) están en git history desde versiones anteriores.



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

## 📍 Estado de sesión actual (13 may 2026)

### 🚨 Lección clave de la sesión

**Antes de implementar features grandes, hacer `git fetch` y revisar `git log HEAD..origin/main`.** Arranqué la sesión leyendo el CLAUDE.md local que decía "próxima sesión: Storage docs + Pricing + ..." y empecé a implementarlo. Después de un commit local v15.12.0 descubrí que el remote ya tenía v16.0.0 (commit del 11 may) con literalmente los mismos features entregados — Storage docs, Pricing engine, Security review. Y v16.1.0-v16.1.4 encima. Mi commit local quedó en branch `backup-v15.12.0-local` y reset hard a origin/main, replanificación de la sesión.

Causa raíz: el local estaba en `e4393ae` (commit del 10 may), Malio commiteó/pushó del 11 al 12 may, y la próxima sesión local no hizo `git fetch` antes de planear.

### ✅ Features de esta sesión (ya en producción)
1. **v16.2.0 — Hard review fixes (CRITICAL + HIGH)**: edge function `invitar-usuario` con CORS lockdown + PII sanitization + email regex + capacidad bounds + error messages sanitizados. Deploy v3 vía MCP supabase. Cleanup de 8 comentarios obsoletos "pega este bloque" en `supabase.js`.
2. **v16.3.0 — PDF cotización refactor 1:1 al DOCX base**: colores NAVY (no TEAL), 17 cláusulas literales T&C (no 10), numeración a/b/c en sub-items (no bullets verdes), tabla Propuesta Económica simplificada sin IVA visible, portada con folio.
3. **v16.4.0 — Hard review fixes (MEDIUM)**: validación RFC client + server + `crearCliente` centralizada + `capacidad_horas_semana` bounds frontend + 6 helpers de permisos centralizados (migrados callsites en 6 módulos) + N+1 en `crearProyectoDesdePlantilla` paralelizado.
4. **v16.5.0 — Hard review fixes (LOW)**: LoadingState/EmptyState consistentes en 3 módulos + 5 colores nuevos en COLORS (`amberBorder`, `amberInk`, `amberSemaforo`, `successLight`, `successInk`) + migrados hex hardcoded + feedback visible en catch silencioso del Workflow + `ModalShell` helper en helpers.jsx + `MS_PER_DAY` constante (6 usos) + upload paralelo con `Promise.allSettled`.
5. **v16.6.0 — Security hardening playbook (3 ítems)**: Policy `usuarios_update` extendida (bloquea cambios a rol/activo/email/auth_id en self-update) + Cloudflare Turnstile preparado en modo dormido (activación manual pendiente) + `uploadDoc` deriva extensión del MIME en lugar del nombre cliente.
6. **v16.7.0 — Password temporal + Mi cuenta**: edge function `invitar-usuario` v4 con flag `generar_password_temporal` opcional (CSPRNG 12 chars) + UI método de acceso en modal Nuevo usuario + tab "Mi cuenta" en Configuración para cambio de contraseña self-service (re-auth + signOut scope:others) + Site URL / Redirect URLs de Supabase Auth aplicadas manualmente.

### 📝 Hard review v16.1.4 — CERRADO

4 agentes Explore en paralelo (deuda técnica, security, performance, inconsistencias). 1 CRITICAL + 3 HIGH + 6 MEDIUM + 8 LOW. **Todos cerrados** en v16.2.0/v16.4.0/v16.5.0 excepto los 3 explícitamente diferidos:
- `Modal.jsx` con `useModal()` sin usuarios (decisión: migrar todo o eliminar).
- Gantt virtualization (2h + riesgo de romper drag/rubber-band).
- 5 modales en `Proyectos.jsx` con overlay duplicado (ya existe `ModalShell`, migración progresiva).

### ⚠️ Pendientes de acción del usuario (NO se pueden hacer vía MCP)

**Auth Dashboard Supabase (5 min):**
- [x] Site URL: `https://app.row.energy` ← hecho 14 may
- [x] Redirect URLs: agregar `https://app.row.energy/**` y `https://app.row.energy/reset-password` ← hecho 14 may
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

---

## 🗺️ Roadmap pendiente

### ⏸️ Pausados — retomar cuando se decida
- **Email diario alertas (Commit E original)** — Edge Function scheduled + UI de `email_diario` / `email_dias` / `email_hora` en tab Mis alertas. Necesita decidir formato real de `email_dias` (consultar schema vivo de `alertas_config`).

### ⏳ Próximos features grandes (no urgentes)
- **Reportes ejecutivos PDF** (board pack mensual/trimestral): KPIs consolidados, comparativo vs mes anterior/meta, lista de proyectos en riesgo, auto-enviado por email. Estimado ~1 semana.
- **Profundizar módulos básicos:** Postventa (SLA tracking, dashboard tickets), Cierre (checklist con docs requeridos, lecciones aprendidas), Contratos (gestión documental, vencimientos automáticos, alertas de renovación). Cada uno ~1-2 días.
- **Pricing engine v16.1** — proyecciones año-por-año (las sheets "CC INFLACIÓN" y "CE Inflación" del Excel tienen precios pre-calculados a múltiples años; hoy aplicamos 5%/año en runtime, suficiente para MVP entregado en v16.0.0).
- **Cobranza automática desde workflow Post-Cierre v16.1.0** — generación de hitos al confirmar workflow + recordatorio email cliente vía Edge Function programada.

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
- Punch list MEDIUM/LOW del hard review v16.1.4 (ver sección v16.2.0 arriba)

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
- [x] Site URL: `https://app.row.energy` ← hecho 14 may
- [x] Redirect URLs: `https://app.row.energy/**` ← hecho 14 may

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

1. Leer este archivo (CLAUDE.md).
2. **`git fetch origin && git log --oneline HEAD..origin/main`** — verificar si remote tiene commits que no tengo. **No saltarse este paso** antes de planear features grandes (lección del 13 may: terminé re-implementando v15.12.0 redundante con v16.0.0 que ya estaba en remote).
3. Confirmar que la versión local matchea producción. Hoy: **v16.3.0**.
4. MCPs activos: supabase, playwright, context7. Skill superpowers habilitado.
5. Preguntar a Malio qué prioriza. Si pide validación del PDF cotización v16.3.0, generar uno y comparar con `/Users/maliomartinez/Downloads/COTIZACIÓN BASE CC (1).pdf` antes de tocar el generador.

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
