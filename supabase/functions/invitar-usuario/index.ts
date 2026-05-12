// ============================================================
// Edge Function: invitar-usuario
// ============================================================
// Crea un usuario en la tabla 'usuarios' Y envía invitación por email
// vía Supabase Auth (inviteUserByEmail).
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
//
// Una vez deployada, la URL será:
//   https://TU_PROJECT_REF.supabase.co/functions/v1/invitar-usuario
// ============================================================

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'No autenticado' }, 401)
    const jwt = authHeader.replace('Bearer ', '')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabaseAuth = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    })

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser()
    if (userError || !user) return json({ error: 'Sesión inválida' }, 401)

    const supabaseAdmin = createClient(supabaseUrl, serviceKey)
    const { data: usuarioLlamante } = await supabaseAdmin
      .from('usuarios')
      .select('id, rol')
      .eq('email', user.email!.toLowerCase())
      .single()

    if (!usuarioLlamante || usuarioLlamante.rol !== 'direccion') {
      return json({ error: 'Solo usuarios con rol Dirección pueden invitar' }, 403)
    }

    const body = await req.json()
    const { nombre, email, rol, telefono, capacidad_horas_semana } = body

    if (!email?.trim()) return json({ error: 'Email requerido' }, 400)

    const ROLES_VALIDOS = ['direccion', 'admin', 'director_proyectos', 'ventas', 'cobranza', 'equipo_proyectos']

    const emailLower = email.toLowerCase().trim()

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
        return json({ error: `Ya existe un usuario con auth activo para ${emailLower}` }, 409)
      }
      // Huérfano — solo necesita auth + invite
      usuarioRow = existente
    } else {
      // Caso normal: crear desde cero — requiere nombre+rol
      if (!nombre?.trim()) return json({ error: 'Nombre requerido' }, 400)
      if (!rol) return json({ error: 'Rol requerido' }, 400)
      if (!ROLES_VALIDOS.includes(rol)) {
        return json({ error: `Rol inválido. Debe ser uno de: ${ROLES_VALIDOS.join(', ')}` }, 400)
      }

      const { data: nuevoUsuario, error: errorInsert } = await supabaseAdmin
        .from('usuarios')
        .insert({
          nombre: nombre.trim(),
          email: emailLower,
          rol,
          telefono: telefono?.trim() || null,
          capacidad_horas_semana: Number(capacidad_horas_semana) || 40,
          activo: true,
        })
        .select()
        .single()

      if (errorInsert) return json({ error: `Error creando usuario: ${errorInsert.message}` }, 500)
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
      if (creadoAhora) await supabaseAdmin.from('usuarios').delete().eq('id', usuarioRow.id)
      return json({ error: `Error enviando invitación: ${errorInvite.message}` }, 500)
    }

    if (invitacion?.user?.id) {
      await supabaseAdmin
        .from('usuarios')
        .update({ auth_id: invitacion.user.id })
        .eq('id', usuarioRow.id)
    }

    return json({
      ok: true,
      usuario: usuarioRow,
      invitacion_enviada: true,
      reinvited: !creadoAhora,
      email: emailLower,
      mensaje: creadoAhora
        ? `Invitación enviada a ${emailLower}. Recibirá email para crear su contraseña.`
        : `Re-invitación enviada a ${emailLower} (usuario huérfano). Recibirá email para crear su contraseña.`,
    }, 200)

  } catch (err) {
    console.error('Error en invitar-usuario:', err)
    return json({ error: err.message || 'Error interno' }, 500)
  }
})

function json(obj: any, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
