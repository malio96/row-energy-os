// ============================================================
// Edge Function: invitar-usuario
// ============================================================
// Crea un usuario en la tabla 'usuarios' Y envía invitación por email
// vía Supabase Auth (inviteUserByEmail).
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

// CORS — permite llamadas desde cualquier origen (incluye localhost y tu dominio)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  // Preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Autenticación — extraer JWT del header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return json({ error: 'No autenticado' }, 401)
    }

    const jwt = authHeader.replace('Bearer ', '')

    // 2. Cliente con la anon key para validar quién es el que llama
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabaseAuth = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    })

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser()
    if (userError || !user) {
      return json({ error: 'Sesión inválida' }, 401)
    }

    // 3. Verificar que el que llama sea 'direccion'
    const supabaseAdmin = createClient(supabaseUrl, serviceKey)
    const { data: usuarioLlamante } = await supabaseAdmin
      .from('usuarios')
      .select('id, rol')
      .eq('email', user.email!.toLowerCase())
      .single()

    if (!usuarioLlamante || usuarioLlamante.rol !== 'direccion') {
      return json({ error: 'Solo usuarios con rol Dirección pueden invitar' }, 403)
    }

    // 4. Validar body
    const body = await req.json()
    const { nombre, email, rol, telefono, capacidad_horas_semana } = body

    if (!nombre?.trim()) return json({ error: 'Nombre requerido' }, 400)
    if (!email?.trim()) return json({ error: 'Email requerido' }, 400)
    if (!rol) return json({ error: 'Rol requerido' }, 400)

    const ROLES_VALIDOS = ['direccion', 'admin', 'director_proyectos', 'ventas', 'cobranza', 'equipo_proyectos']
    if (!ROLES_VALIDOS.includes(rol)) {
      return json({ error: `Rol inválido. Debe ser uno de: ${ROLES_VALIDOS.join(', ')}` }, 400)
    }

    const emailLower = email.toLowerCase().trim()

    // 5. Verificar que no exista ya en tabla usuarios
    const { data: existente } = await supabaseAdmin
      .from('usuarios')
      .select('id')
      .eq('email', emailLower)
      .maybeSingle()

    if (existente) {
      return json({ error: `Ya existe un usuario con el email ${emailLower}` }, 409)
    }

    // 6. Crear registro en tabla usuarios
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

    if (errorInsert) {
      return json({ error: `Error creando usuario: ${errorInsert.message}` }, 500)
    }

    // 7. Enviar invitación por email vía Auth
    const { data: invitacion, error: errorInvite } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      emailLower,
      {
        data: {
          nombre: nombre.trim(),
          rol,
        },
      }
    )

    if (errorInvite) {
      // Rollback: eliminar el registro creado si la invitación falló
      await supabaseAdmin.from('usuarios').delete().eq('id', nuevoUsuario.id)
      return json({ error: `Error enviando invitación: ${errorInvite.message}` }, 500)
    }

    // 8. Vincular auth_id del usuario invitado con el registro de tabla usuarios
    if (invitacion?.user?.id) {
      await supabaseAdmin
        .from('usuarios')
        .update({ auth_id: invitacion.user.id })
        .eq('id', nuevoUsuario.id)
    }

    return json({
      ok: true,
      usuario: nuevoUsuario,
      invitacion_enviada: true,
      email: emailLower,
      mensaje: `Invitación enviada a ${emailLower}. El usuario recibirá un email con instrucciones para crear su contraseña.`,
    }, 200)

  } catch (err) {
    console.error('Error en invitar-usuario:', err)
    return json({ error: err.message || 'Error interno' }, 500)
  }
})

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

