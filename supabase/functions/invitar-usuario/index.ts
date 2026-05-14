// ============================================================
// Edge Function: invitar-usuario
// ============================================================
// Crea un usuario en la tabla 'usuarios' Y envía invitación por email
// vía Supabase Auth (inviteUserByEmail).
//
// v3 (2026-05-13): security hardening tras hard review
// - CORS restringido a allowlist (app.row.energy + localhost dev)
// - Response sanitizada (no PII en respuesta; solo {ok, message, reinvited})
// - Email regex validation
// - Bounds en capacidad_horas_semana
// - Error messages internos no se exponen al cliente
//
// v2 (2026-05): además del caso normal de crear desde cero, ahora
// soporta el caso 'usuario huérfano' — ya existe en tabla usuarios
// pero sin auth_id. En ese caso, solo dispara el invite y linkea.
// Útil para usuarios precargados en la BD antes de existir en Auth.
//
// Requiere que quien llama tenga rol 'direccion' en la tabla usuarios.
// El service_role key vive como secret en Supabase, nunca toca el frontend.
//
// DEPLOY:
//   supabase functions deploy invitar-usuario
// ============================================================

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED_ORIGINS = new Set([
  'https://app.row.energy',
  'http://localhost:5173',
  'http://localhost:4173',
])

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function corsHeadersFor(origin: string | null) {
  const allowOrigin = origin && ALLOWED_ORIGINS.has(origin) ? origin : 'https://app.row.energy'
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

serve(async (req) => {
  const origin = req.headers.get('Origin')
  const cors = corsHeadersFor(origin)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'No autenticado' }, 401, cors)
    const jwt = authHeader.replace('Bearer ', '')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabaseAuth = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    })

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser()
    if (userError || !user) return json({ error: 'Sesión inválida' }, 401, cors)

    const supabaseAdmin = createClient(supabaseUrl, serviceKey)
    const { data: usuarioLlamante } = await supabaseAdmin
      .from('usuarios')
      .select('id, rol')
      .eq('email', user.email!.toLowerCase())
      .single()

    if (!usuarioLlamante || usuarioLlamante.rol !== 'direccion') {
      return json({ error: 'Solo usuarios con rol Dirección pueden invitar' }, 403, cors)
    }

    const body = await req.json()
    const { nombre, email, rol, telefono, capacidad_horas_semana } = body

    if (!email?.trim()) return json({ error: 'Email requerido' }, 400, cors)
    const emailLower = email.toLowerCase().trim()
    if (!EMAIL_REGEX.test(emailLower)) return json({ error: 'Email con formato inválido' }, 400, cors)

    const ROLES_VALIDOS = ['direccion', 'admin', 'director_proyectos', 'ventas', 'cobranza', 'equipo_proyectos']

    // Bounds en capacidad: entero entre 1 y 168 (horas en una semana)
    const capRaw = parseInt(String(capacidad_horas_semana ?? ''), 10)
    const capacidad = Number.isFinite(capRaw) ? Math.min(Math.max(capRaw, 1), 168) : 40

    // Check if user already exists in usuarios table
    const { data: existente } = await supabaseAdmin
      .from('usuarios')
      .select('id, auth_id, nombre, rol')
      .eq('email', emailLower)
      .maybeSingle()

    let usuarioRow
    let creadoAhora = false

    if (existente) {
      if (existente.auth_id) {
        return json({ error: `Ya existe un usuario con auth activo para ${emailLower}` }, 409, cors)
      }
      // Huérfano — solo necesita auth + invite
      usuarioRow = existente
    } else {
      // Caso normal: crear desde cero — requiere nombre+rol
      if (!nombre?.trim()) return json({ error: 'Nombre requerido' }, 400, cors)
      if (!rol) return json({ error: 'Rol requerido' }, 400, cors)
      if (!ROLES_VALIDOS.includes(rol)) {
        return json({ error: `Rol inválido. Debe ser uno de: ${ROLES_VALIDOS.join(', ')}` }, 400, cors)
      }

      const { data: nuevoUsuario, error: errorInsert } = await supabaseAdmin
        .from('usuarios')
        .insert({
          nombre: nombre.trim(),
          email: emailLower,
          rol,
          telefono: telefono?.trim() || null,
          capacidad_horas_semana: capacidad,
          activo: true,
        })
        .select()
        .single()

      if (errorInsert) {
        console.error('Error creando usuario:', errorInsert)
        return json({ error: 'No se pudo crear el usuario. Contacta al equipo técnico.' }, 500, cors)
      }
      usuarioRow = nuevoUsuario
      creadoAhora = true
    }

    // Enviar invitación por email vía Auth
    const { data: invitacion, error: errorInvite } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      emailLower,
      {
        data: {
          nombre: usuarioRow.nombre,
          rol: usuarioRow.rol,
        },
      }
    )

    if (errorInvite) {
      console.error('Error enviando invitación:', errorInvite)
      if (creadoAhora) await supabaseAdmin.from('usuarios').delete().eq('id', usuarioRow.id)
      return json({ error: 'No se pudo enviar la invitación por email. Reintenta en unos minutos.' }, 500, cors)
    }

    if (invitacion?.user?.id) {
      await supabaseAdmin
        .from('usuarios')
        .update({ auth_id: invitacion.user.id })
        .eq('id', usuarioRow.id)
    }

    // Response mínima: no devolvemos el objeto usuario para evitar leakage de PII
    return json({
      ok: true,
      reinvited: !creadoAhora,
      mensaje: creadoAhora
        ? 'Invitación enviada. El destinatario recibirá un email para crear su contraseña.'
        : 'Re-invitación enviada. El destinatario recibirá un email para crear su contraseña.',
    }, 200, cors)

  } catch (err) {
    console.error('Error en invitar-usuario:', err)
    return json({ error: 'Error interno. Contacta al equipo técnico.' }, 500, cors)
  }
})

function json(obj: any, status = 200, cors: Record<string, string> = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}
