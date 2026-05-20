// ============================================================
// Edge Function: alerta-acceso-cotizaciones
// ============================================================
// Llamada via Database Webhook cuando se inserta un evento en
// auditoria_eventos con modulo='cotizaciones' o evento='ver_financiero'.
//
// Envía email a mmartinez@row.energy con:
//   - Quién accedió (nombre, rol, email)
//   - Qué cotización/proyecto vio (código, nombre)
//   - Timestamp y User-Agent
//
// Requiere secrets en Supabase:
//   RESEND_API_KEY  — de https://resend.com (gratis hasta 3,000/mes)
//   SUPABASE_URL    — auto-disponible en Edge Functions
//   SUPABASE_SERVICE_ROLE_KEY — auto-disponible en Edge Functions
// ============================================================

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALERT_EMAIL = 'mmartinez@row.energy'
const FROM_EMAIL  = 'alertas@app.row.energy'  // dominio verificado en Resend

// Roles autorizados por módulo/evento
const ROLES_COTIZACIONES = new Set(['direccion', 'admin', 'ventas'])
const ROLES_FINANCIERO   = new Set(['direccion', 'admin', 'ventas'])

function esEventoRelevante(evento: string, modulo: string): boolean {
  if (modulo === 'cotizaciones') return true
  if (evento === 'ver_financiero' && modulo === 'proyectos') return true
  return false
}

serve(async (req) => {
  const payload = await req.json().catch(() => null)
  if (!payload) return new Response('bad payload', { status: 400 })

  const ev = payload.record ?? payload  // Supabase DB Webhook wraps in {record}
  if (!ev) return new Response('skip', { status: 200 })

  const tipoEvento = ev.evento ?? ''
  const modulo     = ev.modulo ?? ''

  if (!esEventoRelevante(tipoEvento, modulo)) {
    return new Response('skip', { status: 200 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Enriquecer con datos del usuario
  const { data: usr } = await supabase
    .from('usuarios')
    .select('nombre, email, rol')
    .eq('id', ev.usuario_id)
    .single()

  const nombre = usr?.nombre ?? 'Desconocido'
  const rol    = usr?.rol    ?? 'desconocido'
  const email  = usr?.email  ?? '—'

  // Determinar si el acceso es autorizado según el módulo
  const rolesAutorizados = modulo === 'cotizaciones' ? ROLES_COTIZACIONES : ROLES_FINANCIERO
  const esAutorizado = rolesAutorizados.has(rol)

  const metadata   = ev.metadata ?? {}
  const timestamp  = new Date(ev.created_at).toLocaleString('es-MX', {
    timeZone: 'America/Mexico_City',
    dateStyle: 'full', timeStyle: 'short'
  })

  // ── Cotizaciones ──────────────────────────────────────────
  if (modulo === 'cotizaciones') {
    const duracion   = metadata.duracion_seg != null ? `${metadata.duracion_seg} segundos` : '—'
    const cotCodigo  = metadata.codigo  ?? '—'
    const cotNombre  = metadata.nombre  ?? '—'
    const accion     = metadata.accion  ?? tipoEvento

    // Para usuarios autorizados, solo alertar en ver_cotizacion (evitar spam de carga de lista)
    if (esAutorizado && tipoEvento !== 'ver_cotizacion') {
      return new Response('authorized_skip', { status: 200 })
    }

    const asunto = esAutorizado
      ? `📋 ${nombre} vio cotización ${cotCodigo}`
      : `🚨 ACCESO NO AUTORIZADO a Cotizaciones — ${nombre} (${rol})`

    const colorAlerta = esAutorizado ? '#1B3A6B' : '#DC2626'
    const badgeColor  = esAutorizado ? '#E0EDFF'  : '#FEF2F2'

    const html = buildHtml({
      titulo: esAutorizado ? '📋 Actividad en Cotizaciones' : '🚨 Acceso No Autorizado — Cotizaciones',
      timestamp, colorAlerta,
      filas: [
        { label: 'Usuario', valor: nombre, bold: true },
        { label: 'Email', valor: email },
        { label: 'Rol', valor: rol, badge: { bg: badgeColor, color: colorAlerta } },
        { label: 'Acción', valor: accion },
        ...(cotCodigo !== '—' ? [{ label: 'Cotización', valor: `${cotCodigo} — ${cotNombre}`, mono: true, bold: true }] : []),
        ...(duracion !== '—' ? [{ label: 'Tiempo en módulo', valor: duracion }] : []),
        { label: 'User-Agent', valor: (ev.user_agent ?? '—').slice(0, 80), small: true },
      ],
      alerta: !esAutorizado
        ? `El rol <strong>${rol}</strong> no tiene permiso para ver Cotizaciones. Verifica si hubo un cambio en los permisos o si la protección de ruta falló.`
        : null,
    })

    return sendEmail(asunto, html)
  }

  // ── Tab Financiero ─────────────────────────────────────────
  if (tipoEvento === 'ver_financiero') {
    // Si es autorizado, no generar ruido — solo alertar no autorizados
    if (esAutorizado) return new Response('authorized_skip', { status: 200 })

    const proyNombre = metadata.nombre ?? '—'
    const proyCode   = metadata.codigo ?? '—'
    const asunto     = `🚨 ACCESO NO AUTORIZADO a Tab Financiero — ${nombre} (${rol})`

    const html = buildHtml({
      titulo: '🚨 Acceso No Autorizado — Tab Financiero',
      timestamp, colorAlerta: '#DC2626',
      filas: [
        { label: 'Usuario', valor: nombre, bold: true },
        { label: 'Email', valor: email },
        { label: 'Rol', valor: rol, badge: { bg: '#FEF2F2', color: '#DC2626' } },
        { label: 'Proyecto', valor: `${proyCode} — ${proyNombre}`, mono: true, bold: true },
        { label: 'User-Agent', valor: (ev.user_agent ?? '—').slice(0, 80), small: true },
      ],
      alerta: `El rol <strong>${rol}</strong> no tiene permiso para ver el tab Financiero de proyectos.`,
    })

    return sendEmail(asunto, html)
  }

  return new Response('skip', { status: 200 })
})

// ── Helpers ───────────────────────────────────────────────────

interface Fila {
  label: string
  valor: string
  bold?: boolean
  mono?: boolean
  small?: boolean
  badge?: { bg: string; color: string }
}

function buildHtml({ titulo, timestamp, colorAlerta, filas, alerta }: {
  titulo: string
  timestamp: string
  colorAlerta: string
  filas: Fila[]
  alerta: string | null
}): string {
  const filaHtml = filas.map(f => {
    let val = f.valor
    if (f.badge) {
      val = `<span style="background:${f.badge.bg}; color:${f.badge.color}; padding:2px 10px; border-radius:20px; font-size:11px; font-weight:700;">${f.valor}</span>`
    } else if (f.bold && f.mono) {
      val = `<span style="font-weight:600; font-family:monospace;">${f.valor}</span>`
    } else if (f.bold) {
      val = `<span style="font-weight:600;">${f.valor}</span>`
    } else if (f.small) {
      val = `<span style="font-size:11px; color:#94A3B8;">${f.valor}</span>`
    }
    return `<tr style="border-bottom:1px solid #F1F5F9;">
      <td style="padding:10px 0; color:#64748B; width:160px;">${f.label}</td>
      <td style="padding:10px 0;">${val}</td>
    </tr>`
  }).join('\n')

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, sans-serif; background:#F8FAFC; padding:32px; color:#1E293B;">
  <div style="max-width:560px; margin:0 auto; background:white; border-radius:12px; overflow:hidden; box-shadow:0 1px 4px rgba(0,0,0,0.08);">
    <div style="background:${colorAlerta}; padding:20px 28px;">
      <h1 style="color:white; margin:0; font-size:18px; font-weight:600;">${titulo}</h1>
      <p style="color:rgba(255,255,255,0.8); margin:6px 0 0; font-size:13px;">${timestamp}</p>
    </div>
    <div style="padding:24px 28px;">
      <table style="width:100%; border-collapse:collapse; font-size:13px; margin-bottom:20px;">
        ${filaHtml}
      </table>
      ${alerta ? `<div style="background:#FEF2F2; border:1px solid #FECACA; border-radius:8px; padding:14px 16px; font-size:13px; color:#DC2626;">
        <strong>⚠ Alerta de seguridad:</strong> ${alerta}
        Verifica si hubo un cambio en los permisos o si la protección de ruta falló.
      </div>` : ''}
      <p style="font-size:11px; color:#94A3B8; margin-top:20px; text-align:center;">
        Row Energy OS · Auditoría automática · <a href="https://app.row.energy" style="color:#1B3A6B;">app.row.energy</a>
      </p>
    </div>
  </div>
</body>
</html>`
}

async function sendEmail(asunto: string, html: string): Promise<Response> {
  const resendKey = Deno.env.get('RESEND_API_KEY')
  if (!resendKey) {
    console.error('RESEND_API_KEY no configurado')
    return new Response('no_email_key', { status: 200 })
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM_EMAIL, to: [ALERT_EMAIL], subject: asunto, html }),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('Resend error:', err)
    return new Response('email_error', { status: 500 })
  }

  return new Response('ok', { status: 200 })
}
