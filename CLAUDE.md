# Row Energy OS — Contexto del proyecto

> Este archivo es leído automáticamente por Claude Code al arrancar. Historial detallado de versiones en `CHANGELOG.md`.

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

La versión visible está en `package.json` y se renderiza en el Sidebar como "OS · v{version}". **REGLA**: bumpear `package.json.version` antes de cada commit visible.

---

## 🚫 REGLA DE SEGURIDAD INNEGOCIABLE — separación dinero / proyectos

**`director_proyectos` y `equipo_proyectos` JAMÁS deben ver NADA de dinero.** Administración y Proyectos están totalmente separados por decisión de dirección. Esto ya se violó una vez (v18.0.0 le dio el módulo `ventas` a director_proyectos — revertido en v18.5.0) y NO debe repetirse.

- **Prohibido** darles módulos: `ventas`, `cotizaciones`, `leads`, `contratos`, `cobranza`, `facturacion`, `compras`.
- **Prohibido** incluirlos en políticas RLS de: cotizaciones, cotizacion_items, leads, hitos_cobranza, facturas, contratos, compras, cuentas_por_pagar, gastos_variables, proyectos_montos, precios_servicios.
- **Prohibido** agregar columnas de montos a tablas que estos roles leen (proyectos, actividades, plantas...). Los montos viven en tablas blindadas: `proyectos_montos`, `hitos_cobranza`. (`proyectos.monto_contrato` y `actividades.monto_cobrable` se ELIMINARON en v18.6/18.7 — no recrearlas.)
- **Tras CUALQUIER cambio de permisos/RLS/módulos**: correr `scripts/auditoria_lockdown_dinero.sql` — toda superficie debe dar 0 para ambos roles.

## 🎯 Versión actual en producción

**v18.x** — rediseño "mejor CRM + proyectos, simple": módulo **Ventas** unificado (leads+cotizaciones, pipeline 5 fases), formato tabla estándar en toda la app, edición plena de proyectos para equipo_proyectos, lockdown total de dinero (ver regla arriba), realtime en Ventas. Ver `CHANGELOG.md` para el detalle por versión.

### Estado actual BD (snapshot 17 may 2026, post-v16.9.0)

- 50 clientes (sin RFC/dirección — badge ⚠ INCOMPLETO; 70/198 proyectos con cliente vinculado)
- 198 proyectos (105 PI / 93 PC; 19 con MW extraído del nombre; 90 vinculados a planta_id)
- 90 plantas eléctricas
- 7,252 actividades (4,342 sub-actividades; 1,161 con deps; 1,083 con responsable; 320 sin fechas — vacías en Monday)
- 211 etapas SIM en 133 proyectos
- 11 usuarios activos: Malio (direccion), Edgar (director_proyectos), Regino (ventas) + 8 equipo_proyectos

---

## ⚠️ Deuda técnica pendiente (diferida de v16.9.3)

- 74 hex hardcoded en Proyectos.jsx (define COLORS local) — riesgo visual alto
- 18 modales inline sin ModalShell — alto QA cost
- 20+ botones hardcoded sin btnPrimary — mecánico pero high churn
- 75 sim_etapas vencidas necesitan trigger
- Clientes RFC + dirección (50/50 CRIT) → captura manual de Malio
- Proyectos.cotizacion_id (198/198) → requiere generar cotizaciones primero
- Plantas.fecha_operacion_comercial (18/18) → backfill Monday
- Modal.jsx con `useModal()` sin usuarios — decidir migrar o eliminar
- Gantt virtualization (100+ actividades) — 2h + riesgo romper drag/rubber-band

---

## 🔐 Pendientes manuales de Malio

**Limpieza de archivos basura** — ✅ RESUELTO (v17.9.0): `.gitignore` los ignora; quedan en disco por si se quieren borrar a mano.

**Cloudflare Turnstile** (captcha login — en modo dormido, activar cuando se decida):
1. Cloudflare → Turnstile → Add site `app.row.energy` → copiar Site Key + Secret Key
2. Vercel → Settings → Env Vars → `VITE_TURNSTILE_SITE_KEY=<site_key>` → redeploy
3. Supabase → Auth → Settings → CAPTCHA Protection → enable → paste Secret Key
> IMPORTANTE: agregar Secret en Supabase SIN la env var en Vercel rompe los logins.

**Rotación de credenciales** (`RowEnergy2026!` en git history — CRÍTICO):
- [ ] Supabase → Settings → Database → Reset database password
- [ ] Supabase → Settings → API → Roll JWT secret
- [ ] Actualizar `.env.local` local
- [ ] Actualizar Vercel env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_KEY`)
- [ ] Redeploy

**HIBP (leaked password protection):** requiere upgrade Supabase a Pro — diferido.

---

## 🚨 Lección clave entre sesiones

**Antes de implementar features grandes, siempre:**
```bash
git fetch origin && git log --oneline HEAD..origin/main
```
Sin este paso se puede terminar re-implementando algo que ya está en remote (ocurrió el 13 may con v15.12.0 vs v16.0.0 ya en producción).

---

## 🏗️ Arquitectura clave

### Roles del sistema
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
- `/functions/v1/invitar-usuario` (v4) — crea usuario en Supabase Auth. Soporta `generar_password_temporal: true` para password CSPRNG de 12 chars. CORS allowlist (app.row.energy + localhost).

### Tablas principales (Supabase)
- `usuarios` (id, auth_id, nombre, email, rol, capacidad_horas_semana, activo)
- `proyectos` (id, codigo, nombre, cliente_id, director_id, estado, cierre, planta_id, ...)
- `actividades` (id, proyecto_id, nombre, responsable_id, inicio, fin, estado, parent_id, ...)
- `proyecto_sim_etapas` (proyecto_id, etapa, fecha_inicio, fecha_fin, estado)
- `clientes`, `leads`, `cotizaciones`, `facturas`, `cuentas_por_pagar`, `tickets_postventa`
- `tareas_post_cierre` (cotizacion_id, departamento, plazo, fecha_limite, asignado_a, estado)
- `alertas_config` (usuario_id + 8 columnas bool por categoría + email_diario, email_dias, email_hora)
- `precios_servicios` (184 registros — 16 servicios × rangos MW × tipos CC/CE)

---

## 🐛 Bugs históricos resueltos (NO repetir)

### `getProyectos` no incluía actividades
`getProyectos()` en supabase.js debe hacer `.select('*, cliente, director, actividades(*)')`. Sin `actividades(*)`, `proyectos.flatMap(p => p.actividades || [])` devuelve `[]` silenciosamente.

### `notifCount` viejo
Eliminado — el sistema de notificaciones fue depreciado. El sidebar usa `<CampanaAlertas/>`. No importar `getNotificaciones` para el sidebar.

### Gantt rubber-band offset duplicado
`dragDepPath` NO debe sumar `scrollLeft` si ya está incluido en `rect.left` (el SVG se mueve con su parent). Ver v15.10.12 en CHANGELOG.

---

## 📐 Convenciones del código

- **Estilos:** inline, no CSS modules ni Tailwind
- **Colores:** siempre vía `COLORS.navy`, `COLORS.amber`, etc — definidos en `helpers.jsx`
- **Mobile:** usar `useIsMobile()` de helpers — breakpoint a 768px
- **Estados de loading:** mostrar texto "Cargando..." con `COLORS.slate400`
- **Botones primarios:** `background: COLORS.navy, color: 'white'`
- **Cards:** `borderRadius: 12-16, border: 1px solid COLORS.slate100`
- **Severidad de alertas:** `critica` (rojo), `importante` (amber), `info` (navy2)
- **Persistencia local:** `loadPref(key, default)` y `savePref(key, value)` — usan localStorage
- **Sort persistente:** `<SortControl>` + `aplicarSort()` en `helpers.jsx`, pref key `sort.<modulo>`
- **Sin TypeScript:** todo el proyecto es JS puro (.js y .jsx)

---

## 🎨 Estilo de comunicación (importante para Claude Code)

Malio prefiere:
- **Disciplina:** un commit a la vez, validar antes de seguir
- **Honestidad:** decir cuando algo es riesgoso o cuando no estoy seguro
- **Diagnóstico antes de fix:** entender la causa raíz, no solo síntoma
- **Heads-up explícitos:** avisar de impactos colaterales antes de aplicar
- **Decisiones por opciones:** ofrecer 2-3 caminos con pros/cons en vez de imponer uno
- **Compactos:** evitar redundancia, ir al punto

Malio NO necesita que le explique todo desde cero. Es Director General técnicamente sólido. Habla en español. Trabaja desde Mac (zsh).

---

## 📂 Estructura de archivos clave

```
src/
├── App.jsx                    Routes + Layout + RUTAS_POR_SECCION
├── Sidebar.jsx                Sidebar Klar + filtro por permisos
├── CampanaAlertas.jsx         Campana en Sidebar — popover top 3 + ver todas
├── CentroAlertas.jsx          Página /alertas con drill-down
├── Dashboard.jsx              Dashboard con BannerAlertas
├── Proyectos.jsx              Gestión proyectos + Gantt + Kanban (~3000+ líneas)
├── Cotizaciones.jsx
├── Leads.jsx
├── Cobranza.jsx
├── Facturacion.jsx
├── Compras.jsx
├── Contratos.jsx
├── Cierre.jsx
├── Postventa.jsx
├── Configuracion.jsx          Tabs: Usuarios, Clientes, Mi cuenta
├── CommandPalette.jsx
├── Turnstile.jsx              Captcha (modo dormido sin VITE_TURNSTILE_SITE_KEY)
├── alertas.js                 Generadores + helpers visuales + ETIQUETAS_ALERTAS
├── helpers.jsx                COLORS, useIsMobile, fmts, savePref/loadPref, SortControl
├── permisos.js                puede(usuario, modulo) + helpers (esRolEn, puedeEditarFinanciero, ...)
├── serviciosCatalogo.js       22 servicios con nombres + descripciones técnicas
├── exportCotizacion.js        PDF cotización (lazy-loaded desde Cotizaciones.jsx)
├── exportGantt.js             PDF/Excel Gantt (lazy-loaded)
└── supabase.js                Cliente + getX() + helpers CRUD
```

---

## 🚀 Próximos pasos al arrancar sesión

1. Leer este archivo (CLAUDE.md).
2. `git fetch origin && git log --oneline HEAD..origin/main` — verificar sync con remote.
3. Confirmar versión local vs producción (`package.json` vs último commit).
4. MCPs disponibles: supabase, playwright, context7.
5. Preguntar a Malio qué prioriza.

---

## 🗺️ Roadmap pendiente

### ⏸️ Pausados
- **Email diario alertas** — Edge Function scheduled + UI `email_diario`/`email_dias`/`email_hora` en tab Mis alertas.

### ⏳ Próximos features
- **Reportes ejecutivos PDF** (board pack mensual/trimestral) — KPIs, comparativo, proyectos en riesgo, auto-email. ~1 semana.
- **Módulos básicos profundizados:** Postventa (SLA tracking), Cierre (checklist + docs), Contratos (vencimientos + alertas). ~1-2 días c/u.
- **Pricing engine v2** — proyecciones año-por-año desde sheets "CC INFLACIÓN" / "CE Inflación".
- **Cobranza automática desde workflow Post-Cierre** — generación de hitos al confirmar + email cliente vía Edge Function.

### 🔌 Integraciones externas (cuando haga sentido)
- WhatsApp Business, DocuSign, Stripe/MercadoPago, Google Calendar sync

---

## 🧪 Comandos útiles

```bash
npm run dev          # Dev server
npm run build        # Build local (verificar que compila)
git status
git log --oneline -5
```
