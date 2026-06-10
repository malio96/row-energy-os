// ============================================================
// Edge Function: invitar-usuario
// ============================================================
// Crea un usuario en la tabla 'usuarios' Y le da acceso vía Supabase Auth
// (dos modos: invitación por email O password temporal generada).
//
// v5 (2026-06-10): amplía quién puede invitar. Dirección crea cualquier rol;
// director_proyectos y ventas pueden dar de alta SOLO equipo_proyectos
// (guardarraíl anti-escalada de privilegios). El resto: 403.
//
// v4 (2026-05-14): soporta password temporal
// - generar_password_temporal:true en el body → crea auth user con password
//   aleatoria segura (CSPRNG). Retorna la password en respuesta UNA vez al
//   admin (no se loguea, no se guarda en BD).
// - default sigue siendo inviteUserByEmail (más seguro porque el destinatario
//   crea su propia password).
//
// v3 (2026-05-13): security hardening (CORS allowlist + PII sanitization +
// email regex + capacidad bounds + sanitized error messages).
//
// v2 (2026-05): soporta usuario huérfano (existe en tabla usuarios sin
// auth_id) — solo dispara invite y linkea auth_id sin recrear el row.
//
// Requiere que quien llama tenga rol direccion, director_proyectos o ventas
// en la tabla usuarios (ver guardarraíl de rol objetivo más abajo).
// El service_role key vive como secret en Supabase, nunca toca el frontend.
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

// v16.7.0: password temporal segura (CSPRNG). 12 chars, sin caracteres
// ambiguos (0/O/l/1/I), garantiza 1 símbolo + mezcla.
function generarPasswordTemporal(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  const symbols = '!@#$%&*'
  const totalLen = 12
  const buf = new Uint8Array(totalLen)
  crypto.getRandomValues(buf)
  const result: string[] = []
  for (let i = 0; i < totalLen - 1; i++) {
    result.push(chars[buf[i] % chars.length])
  }
  result.push(symbols[buf[totalLen - 1] % symbols.length])
  // Mezclar el orden (para que el símbolo no quede siempre al final)
  const shuffle = new Uint8Array(totalLen)
  crypto.getRandomValues(shuffle)
  return result
    .map((c, i) => ({ c, k: shuffle[i] }))
    .sort((a, b) => a.k - b.k)
    .map(x => x.c)
    .join('')
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

    // v5 (2026-06-10): además de Dirección, director_proyectos y ventas pueden
    // dar de alta usuarios, PERO solo con rol equipo_proyectos (guardarraíl
    // anti-escalada). La validación del rol objetivo se hace más abajo, una vez
    // que se conoce el rol efectivo (nuevo o huérfano existente).
    const PUEDEN_INVITAR = ['direccion', 'director_proyectos', 'ventas']
    if (!usuarioLlamante || !PUEDEN_INVITAR.includes(usuarioLlamante.rol)) {
      return json({ error: 'No tienes permiso para invitar usuarios' }, 403, cors)
    }
    const esDireccion = usuarioLlamante.rol === 'direccion'

    const body = await req.json()
    const { nombre, email, rol, telefono, capacidad_horas_semana, generar_password_temporal } = body
    const usarPasswordTemporal = generar_password_temporal === true

    if (!email?.trim()) return json({ error: 'Email requerido' }, 400, cors)
    const emailLower = email.toLowerCase().trim()
    if (!EMAIL_REGEX.test(emailLower)) return json({ error: 'Email con formato inválido' }, 400, cors)

    const ROLES_VALIDOS = ['direccion', 'admin', 'director_proyectos', 'ventas', 'cobranza', 'equipo_proyectos']

    const capRaw = parseInt(String(capacidad_horas_semana ?? ''), 10)
    const capacidad = Number.isFinite(capRaw) ? Math.min(Math.max(capRaw, 1), 168) : 40

    const { data: existente } = await supabaseAdmin
      .from('usuarios')
      .select('id, auth_id, nombre, rol')
      .eq('email', emailLower)
      .maybeSingle()

    // v5: guardarraíl anti-escalada. Quien no es Dirección solo puede dar de alta
    // (o reinvitar) usuarios con rol equipo_proyectos. Se valida antes de insertar
    // para no dejar rows huérfanos.
    const rolObjetivo = existente ? existente.rol : rol
    if (!esDireccion && rolObjetivo !== 'equipo_proyectos') {
      return json({ error: 'Solo Dirección puede invitar usuarios con ese rol. Tú únicamente puedes dar de alta colaboradores de Equipo de Proyectos.' }, 403, cors)
    }

    let usuarioRow
    let creadoAhora = false

    if (existente) {
      if (existente.auth_id) {
        return json({ error: `Ya existe un usuario con auth activo para ${emailLower}` }, 409, cors)
      }
      usuarioRow = existente
    } else {
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

    // ============================================================
    // CASO 1: Crear con password temporal (v16.7.0)
    // ============================================================
    if (usarPasswordTemporal) {
      const passwordTemporal = generarPasswordTemporal()
      const { data: authData, error: errorCreate } = await supabaseAdmin.auth.admin.createUser({
        email: emailLower,
        password: passwordTemporal,
        email_confirm: true,  // marca como verificado (no requiere click en email)
        user_metadata: {
          nombre: usuarioRow.nombre,
          rol: usuarioRow.rol,
        },
      })

      if (errorCreate) {
        console.error('Error creando auth user:', errorCreate)
        // Rollback: si recién creamos el row en usuarios, removerlo para no dejar huérfano
        if (creadoAhora) await supabaseAdmin.from('usuarios').delete().eq('id', usuarioRow.id)
        return json({ error: 'No se pudo crear el acceso. Reintenta en unos minutos.' }, 500, cors)
      }

      if (authData?.user?.id) {
        await supabaseAdmin
          .from('usuarios')
          .update({ auth_id: authData.user.id })
          .eq('id', usuarioRow.id)
      }

      return json({
        ok: true,
        modo: 'password_temporal',
        password_temporal: passwordTemporal,
        mensaje: `Acceso creado para ${emailLower}. Comparte la contraseña temporal por canal seguro (WhatsApp, en persona). Recomienda al usuario cambiarla en su primer login desde Configuración.`,
      }, 200, cors)
    }

    // ============================================================
    // CASO 2 (default): Invitar por email
    // ============================================================
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

    return json({
      ok: true,
      modo: 'invite_email',
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
