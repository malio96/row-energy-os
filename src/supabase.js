import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Faltan variables de entorno de Supabase. Verifica .env')
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: true, autoRefreshToken: true }
})

// ============================================================
// USUARIOS & CLIENTES
// ============================================================
export async function getUsuarios() {
  const { data, error } = await supabase.from('usuarios').select('*').eq('activo', true).order('nombre')
  if (error) { console.error('getUsuarios:', error); return [] }
  return data || []
}

export async function getClientes() {
  const { data, error } = await supabase.from('clientes').select('*').order('razon_social')
  if (error) { console.error('getClientes:', error); return [] }
  return data || []
}

// v16.4.0: validación de RFC mexicano (persona moral 12 chars, física 13 chars).
// Formato: 3-4 letras + 6 dígitos (AAMMDD) + 3 alfanumérico (homoclave).
export const RFC_REGEX = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/
export function validarRFC(rfc) {
  if (!rfc) return true // vacío permitido (es opcional hasta que se quiera facturar)
  return RFC_REGEX.test(rfc.trim().toUpperCase())
}

// v16.4.0: extraído de FormClienteInline para centralizar validación.
// Genera código CLI-XXX automáticamente.
export async function crearCliente(payload) {
  const rfcTrim = payload.rfc?.trim().toUpperCase() || null
  if (rfcTrim && !validarRFC(rfcTrim)) {
    throw new Error('RFC inválido. Formato esperado: XAXX010101000 (3-4 letras + 6 dígitos AAMMDD + 3 alfanuméricos).')
  }
  if (!payload.razon_social?.trim()) {
    throw new Error('Razón social requerida.')
  }
  const { count } = await supabase.from('clientes').select('*', { count: 'exact', head: true })
  const codigo = `CLI-${String((count || 0) + 1).padStart(3, '0')}`
  const { data, error } = await supabase
    .from('clientes')
    .insert({
      codigo,
      razon_social: payload.razon_social.trim(),
      rfc: rfcTrim,
      contacto_nombre: payload.contacto_nombre?.trim() || null,
      contacto_email: payload.contacto_email?.trim() || null,
      contacto_telefono: payload.contacto_telefono?.trim() || null,
      direccion: payload.direccion?.trim() || null,
      industria: payload.industria?.trim() || null,
      notas: payload.notas?.trim() || null,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

// v16.1.1: actualizar cliente — necesario para completar campos faltantes
// (especialmente RFC y dirección fiscal, requeridos por el trigger de aprobar cotización).
// v16.4.0: valida RFC si está presente.
export async function actualizarCliente(id, cambios) {
  const rfcTrim = cambios.rfc?.trim().toUpperCase() || null
  if (rfcTrim && !validarRFC(rfcTrim)) {
    throw new Error('RFC inválido. Formato esperado: XAXX010101000 (3-4 letras + 6 dígitos AAMMDD + 3 alfanuméricos).')
  }
  const limpio = {
    razon_social: cambios.razon_social?.trim() || undefined,
    rfc: rfcTrim,
    contacto_nombre: cambios.contacto_nombre?.trim() || null,
    contacto_email: cambios.contacto_email?.trim() || null,
    contacto_telefono: cambios.contacto_telefono?.trim() || null,
    direccion: cambios.direccion?.trim() || null,
    industria: cambios.industria?.trim() || null,
    notas: cambios.notas?.trim() || null,
    updated_at: new Date().toISOString(),
  }
  // Quitar undefined para no sobrescribir con null la razón social
  Object.keys(limpio).forEach(k => limpio[k] === undefined && delete limpio[k])
  const { data, error } = await supabase.from('clientes').update(limpio).eq('id', id).select().single()
  if (error) throw error
  return data
}

// ============================================================
// PLANTILLAS
// ============================================================
export async function getPlantillas() {
  const { data, error } = await supabase.from('plantillas_proyecto').select('*').eq('activa', true).order('codigo')
  if (error) { console.error('getPlantillas:', error); return [] }
  return data || []
}

export async function getPlantillaActividades(plantillaId) {
  const { data, error } = await supabase.from('plantilla_actividades').select('*').eq('plantilla_id', plantillaId).order('orden')
  if (error) { console.error('getPlantillaActividades:', error); return [] }
  return data || []
}

// ============================================================
// PROYECTOS
// ============================================================
export async function getProyectos() {
  const { data, error } = await supabase
    .from('proyectos')
    .select(`*, cliente:clientes(id, razon_social, codigo), director:usuarios!director_id(id, nombre), actividades(*)`)
    .order('created_at', { ascending: false })
  if (error) { console.error('getProyectos:', error); return [] }
  return data || []
}

// v17.0.0: versión liviana para listas (sin actividades). Mata el lag inicial
// al cargar /proyectos. El detalle sigue usando getProyectoConActividades(id).
// Incluye conteos pre-calculados de actividades para badges del listado.
export async function getProyectosLite() {
  const { data, error } = await supabase
    .from('proyectos')
    .select(`*,
      cliente:clientes(id, razon_social),
      director:usuarios!director_id(id, nombre),
      actividades(id, estado, fin, completada, peso, avance)
    `)
    .order('created_at', { ascending: false })
  if (error) { console.error('getProyectosLite:', error); throw error }
  return data || []
}

export async function getProyectoConActividades(proyectoId) {
  const { data: proyecto, error: e1 } = await supabase
    .from('proyectos')
    .select(`*, cliente:clientes(id, razon_social, codigo, contacto_nombre), director:usuarios!director_id(id, nombre)`)
    .eq('id', proyectoId).single()
  if (e1) { console.error('getProyecto:', e1); return null }

  const { data: actividades } = await supabase.from('actividades').select('*').eq('proyecto_id', proyectoId).order('numero')
  return { ...proyecto, actividades: actividades || [] }
}

export async function crearProyectoDesdePlantilla({ plantillaId, nombre, clienteId, directorId, inicioFecha, capacidadMw, ubicacion }) {
  // v16.4.0: paralelizar count + fetch de plantilla (independientes)
  const [countResult, plantillaActs] = await Promise.all([
    supabase.from('proyectos').select('*', { count: 'exact', head: true }),
    getPlantillaActividades(plantillaId),
  ])
  const codigo = `PRY-${String((countResult.count || 0) + 1).padStart(3, '0')}`
  const actividadesConFechas = calcularFechasCascada(plantillaActs, inicioFecha)
  const fechaCierre = actividadesConFechas.reduce((max, a) => a.fin > max ? a.fin : max, inicioFecha)

  const { data: proyecto, error: e1 } = await supabase.from('proyectos').insert({
    codigo, nombre, cliente_id: clienteId, plantilla_id: plantillaId, director_id: directorId,
    estado: 'Por iniciar', inicio: inicioFecha, cierre: fechaCierre,
    capacidad_mw: capacidadMw, ubicacion,
    alcance: `Proyecto generado desde plantilla. Capacidad: ${capacidadMw || 'N/A'} MW. Ubicación: ${ubicacion || 'N/A'}.`,
  }).select().single()
  if (e1) throw e1

  const actsInsert = actividadesConFechas.map(a => ({
    proyecto_id: proyecto.id, numero: a.orden, fase: a.fase, nombre: a.nombre,
    inicio: a.inicio, fin: a.fin, es_milestone: a.es_milestone,
    base_legal: a.base_legal, plazo_legal_dias: a.plazo_legal_dias,
    avance: 0, estado: 'Sin iniciar', prioridad: 'Media', deps: a.deps_calculadas || [],
    responsable_id: directorId,
  }))
  const { error: e2 } = await supabase.from('actividades').insert(actsInsert)
  if (e2) throw e2
  return proyecto
}

function calcularFechasCascada(plantillaActs, fechaInicio) {
  const result = []
  const byOrden = {}
  for (const pa of plantillaActs) {
    let inicioCalc = fechaInicio
    const depsOrden = pa.depende_de_orden || []
    if (depsOrden.length > 0) {
      const finMaxDeps = depsOrden.reduce((max, ord) => {
        const dep = byOrden[ord]
        if (!dep) return max
        return dep.fin > max ? dep.fin : max
      }, fechaInicio)
      inicioCalc = addDaysStr(finMaxDeps, 1)
    }
    const finCalc = addDaysStr(inicioCalc, pa.duracion_dias || 0)
    const acts = { orden: pa.orden, fase: pa.fase, nombre: pa.nombre, inicio: inicioCalc, fin: finCalc,
      es_milestone: pa.es_milestone, base_legal: pa.base_legal, plazo_legal_dias: pa.plazo_legal_dias,
      deps_calculadas: depsOrden.map(ord => ({ id: ord, tipo: 'FS', lag: 0 })) }
    result.push(acts)
    byOrden[pa.orden] = acts
  }
  return result
}

function addDaysStr(fechaStr, dias) {
  const d = new Date(fechaStr + 'T00:00:00')
  d.setDate(d.getDate() + dias)
  return d.toISOString().split('T')[0]
}

export async function actualizarProyecto(id, cambios) {
  const { data, error } = await supabase.from('proyectos').update({ ...cambios, updated_at: new Date().toISOString() }).eq('id', id).select().single()
  if (error) throw error
  return data
}

// v17.3.0: la RLS de actividades sólo deja a equipo_proyectos tocar proyectos
// donde está asignado (y a jefes/dirección, todo). Cuando NO tiene permiso:
//  - UPDATE afecta 0 filas → .single() lanzaba "Cannot coerce ... single JSON object"
//  - INSERT lanza 42501 "new row violates row-level security policy"
// Traducimos ambos a un error reconocible para mostrar una notificación amable.
function errorNoAsignadoProyecto() {
  const e = new Error('No estás asignado a este proyecto, no puedes crear ni modificar sus actividades. Pídele al director del proyecto que te asigne.')
  e.code = 'NO_AUTORIZADO_PROYECTO'
  return e
}
function mapearErrorActividad(error) {
  if (error?.code === '42501' || /row-level security/i.test(error?.message || '')) return errorNoAsignadoProyecto()
  return error
}

export async function actualizarActividad(id, cambios) {
  const { data, error } = await supabase.from('actividades').update({ ...cambios, updated_at: new Date().toISOString() }).eq('id', id).select().maybeSingle()
  if (error) throw mapearErrorActividad(error)
  if (!data) throw errorNoAsignadoProyecto()  // 0 filas = RLS lo bloqueó
  return data
}

export async function eliminarActividad(id) {
  const { error } = await supabase.from('actividades').delete().eq('id', id)
  if (error) throw error
}

export async function crearActividad(actividad) {
  const proyectoId = actividad?.proyecto_id
  if (!proyectoId) throw new Error('crearActividad: falta proyecto_id')
  const numero = actividad.numero
  if (numero == null) {
    // v15.10.13: usar MAX(numero) en lugar de COUNT. Con borrados puede haber gaps,
    // y COUNT+1 podría chocar con un numero existente (constraint proyecto_id+numero).
    const { data: maxRow } = await supabase.from('actividades').select('numero').eq('proyecto_id', proyectoId).order('numero', { ascending: false }).limit(1).maybeSingle()
    actividad.numero = ((maxRow?.numero) || 0) + 1
  }
  const { data, error } = await supabase.from('actividades').insert(actividad).select().single()
  if (error) throw mapearErrorActividad(error)
  return data
}

export async function desglosarActividadConPlantilla(actividadPadreId, plantillaId) {
  const { data: padre } = await supabase.from('actividades').select('*').eq('id', actividadPadreId).single()
  if (!padre) throw new Error('Actividad padre no encontrada')
  await supabase.from('actividades').delete().eq('parent_id', actividadPadreId)
  const { data: plantillaActs } = await supabase.from('plantilla_actividades').select('*').eq('plantilla_id', plantillaId).order('orden')
  const { count } = await supabase.from('actividades').select('*', { count: 'exact', head: true }).eq('proyecto_id', padre.proyecto_id)
  let numeroActual = count || 0
  const byOrden = {}
  const nuevas = []
  for (const pa of plantillaActs) {
    numeroActual++
    const depsOrden = pa.depende_de_orden || []
    let inicioCalc = padre.inicio
    if (depsOrden.length > 0) {
      inicioCalc = depsOrden.reduce((max, ord) => {
        const dep = byOrden[ord]
        if (!dep) return max
        return dep.fin > max ? dep.fin : max
      }, padre.inicio)
      const d = new Date(inicioCalc + 'T00:00:00'); d.setDate(d.getDate() + 1)
      inicioCalc = d.toISOString().split('T')[0]
    }
    const d2 = new Date(inicioCalc + 'T00:00:00'); d2.setDate(d2.getDate() + (pa.duracion_dias || 7))
    const finCalc = d2.toISOString().split('T')[0]
    nuevas.push({
      proyecto_id: padre.proyecto_id, numero: numeroActual, parent_id: actividadPadreId,
      fase: padre.fase, nombre: pa.nombre, inicio: inicioCalc, fin: finCalc,
      es_milestone: pa.es_milestone, base_legal: pa.base_legal, plazo_legal_dias: pa.plazo_legal_dias,
      avance: 0, estado: 'Sin iniciar', prioridad: 'Media',
      deps: depsOrden.map(ord => ({ orden_plantilla: ord, tipo: 'FS', lag: 0 })),
      responsable_id: padre.responsable_id,
    })
    byOrden[pa.orden] = { fin: finCalc }
  }
  const { error } = await supabase.from('actividades').insert(nuevas)
  if (error) throw error
  return nuevas.length
}

// ============================================================
// DEPENDENCIAS DE ACTIVIDADES
// ============================================================
export async function agregarDependencia(actividadId, predecesorId, tipo = 'FS') {
  const { data: act, error: e1 } = await supabase
    .from('actividades')
    .select('deps')
    .eq('id', actividadId)
    .single()
  if (e1) throw e1

  const deps = act.deps || []
  if (deps.some(d => d.id === predecesorId)) return
  deps.push({ id: predecesorId, tipo })

  const { error: e2 } = await supabase
    .from('actividades')
    .update({ deps })
    .eq('id', actividadId)
  if (e2) throw e2

  await recalcularFechasDesde(actividadId)
}

export async function quitarDependencia(actividadId, predecesorId) {
  const { data: act, error: e1 } = await supabase
    .from('actividades')
    .select('deps')
    .eq('id', actividadId)
    .single()
  if (e1) throw e1

  const deps = (act.deps || []).filter(d => d.id !== predecesorId)
  const { error: e2 } = await supabase
    .from('actividades')
    .update({ deps })
    .eq('id', actividadId)
  if (e2) throw e2

  await recalcularFechasDesde(actividadId)
}

export async function recalcularFechasDesde(actividadId) {
  const { data: actividad } = await supabase
    .from('actividades')
    .select('proyecto_id')
    .eq('id', actividadId)
    .single()
  if (!actividad) return

  const { data: todas } = await supabase
    .from('actividades')
    .select('id, inicio, fin, deps')
    .eq('proyecto_id', actividad.proyecto_id)

  const mapa = {}
  todas.forEach(a => { mapa[a.id] = { ...a } })

  const cambios = []
  const visitados = new Set()
  const cola = [actividadId]

  while (cola.length > 0) {
    const id = cola.shift()
    if (visitados.has(id)) continue
    visitados.add(id)

    const act = mapa[id]
    if (!act || !act.deps || act.deps.length === 0) {
      const sucesoras = todas.filter(a => (a.deps || []).some(d => d.id === id))
      sucesoras.forEach(s => cola.push(s.id))
      continue
    }

    let maxFin = null
    act.deps.forEach(dep => {
      const pred = mapa[dep.id]
      if (!pred) return
      const finPred = new Date(pred.fin + 'T00:00:00')
      if (!maxFin || finPred > maxFin) maxFin = finPred
    })

    if (maxFin) {
      // v15.10.4: la dependencia define el INICIO MÍNIMO permitido, no la fecha exacta.
      // Si la actividad ya está después del mínimo (lag positivo manual), respetar.
      // Solo empujar al mínimo si la fecha actual lo viola (está antes que el mínimo).
      const minInicio = new Date(maxFin)
      minInicio.setDate(minInicio.getDate() + 1)
      const minInicioStr = minInicio.toISOString().split('T')[0]

      if (act.inicio < minInicioStr) {
        const duracionDias = Math.round((new Date(act.fin + 'T00:00:00') - new Date(act.inicio + 'T00:00:00')) / 86400000)
        const nuevoFin = new Date(minInicio)
        nuevoFin.setDate(nuevoFin.getDate() + duracionDias)
        const nuevoFinStr = nuevoFin.toISOString().split('T')[0]

        cambios.push({ id: act.id, inicio: minInicioStr, fin: nuevoFinStr })
        mapa[act.id].inicio = minInicioStr
        mapa[act.id].fin = nuevoFinStr
      }
      // Si act.inicio >= minInicioStr, respeta la fecha actual (lag positivo válido).
    }

    const sucesoras = todas.filter(a => (a.deps || []).some(d => d.id === id))
    sucesoras.forEach(s => { if (!visitados.has(s.id)) cola.push(s.id) })
  }

  for (const c of cambios) {
    await supabase
      .from('actividades')
      .update({ inicio: c.inicio, fin: c.fin })
      .eq('id', c.id)
  }

  return cambios
}

// ============================================================
// NOTIFICACIONES
// ============================================================
// v16.0.0 (security defense-in-depth): validar UUID antes de interpolar en .or().
// usuarioId hoy viene de auth.getUser() (server-validated UUID), pero un refactor
// futuro podría aceptarlo de un input — mejor blindarlo ahora.
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export async function getNotificaciones(usuarioId) {
  if (!usuarioId || !UUID_REGEX.test(String(usuarioId))) return []
  const { data } = await supabase.from('notificaciones').select('*').or(`destinatario_id.eq.${usuarioId},destinatario_id.is.null`).order('created_at', { ascending: false }).limit(20)
  return data || []
}

export async function marcarNotificacionLeida(id) {
  await supabase.from('notificaciones').update({ leida: true }).eq('id', id)
}

// ============================================================
// COTIZACIONES
// ============================================================
export async function getCotizaciones() {
  const { data } = await supabase.from('cotizaciones').select(`*, cliente:clientes(id, razon_social), vendedor:usuarios!vendedor_id(id, nombre)`).order('created_at', { ascending: false })
  return data || []
}

export async function getCotizacion(id) {
  const { data: cot } = await supabase.from('cotizaciones').select(`*, cliente:clientes(*), vendedor:usuarios!vendedor_id(*), plantilla:plantillas_proyecto(*)`).eq('id', id).single()
  const { data: items } = await supabase.from('cotizacion_items').select('*').eq('cotizacion_id', id).order('orden')
  return { ...cot, items: items || [] }
}

export async function crearCotizacion(data) {
  const { count } = await supabase.from('cotizaciones').select('*', { count: 'exact', head: true })
  const codigo = `COT-${String((count || 0) + 1).padStart(3, '0')}`
  const { data: cot, error } = await supabase.from('cotizaciones').insert({ ...data, codigo }).select().single()
  if (error) throw error
  return cot
}

export async function actualizarCotizacion(id, cambios) {
  const { data, error } = await supabase.from('cotizaciones').update({ ...cambios, updated_at: new Date().toISOString() }).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function agregarCotizacionItem(cotizacionId, item) {
  const { count } = await supabase.from('cotizacion_items').select('*', { count: 'exact', head: true }).eq('cotizacion_id', cotizacionId)
  const { data, error } = await supabase.from('cotizacion_items').insert({ ...item, cotizacion_id: cotizacionId, orden: (count || 0) + 1 }).select().single()
  if (error) throw error
  await recalcularTotalCotizacion(cotizacionId)
  return data
}

export async function actualizarCotizacionItem(id, cambios) {
  const { data, error } = await supabase.from('cotizacion_items').update(cambios).eq('id', id).select().single()
  if (error) throw error
  if (data) await recalcularTotalCotizacion(data.cotizacion_id)
  return data
}

export async function eliminarCotizacionItem(id) {
  const { data: item } = await supabase.from('cotizacion_items').select('cotizacion_id').eq('id', id).single()
  await supabase.from('cotizacion_items').delete().eq('id', id)
  if (item) await recalcularTotalCotizacion(item.cotizacion_id)
}

async function recalcularTotalCotizacion(cotizacionId) {
  const { data: items } = await supabase.from('cotizacion_items').select('total').eq('cotizacion_id', cotizacionId)
  const subtotal = (items || []).reduce((s, i) => s + Number(i.total || 0), 0)
  await supabase.from('cotizaciones').update({ subtotal, total: subtotal, updated_at: new Date().toISOString() }).eq('id', cotizacionId)
}

// ============================================================
// LEADS
// ============================================================
export async function getLeads() {
  const { data } = await supabase.from('leads').select(`*, owner:usuarios!owner_id(id, nombre), cliente:clientes(id, razon_social)`).order('updated_at', { ascending: false })
  return data || []
}

export async function crearLead(data) {
  const { count } = await supabase.from('leads').select('*', { count: 'exact', head: true })
  const codigo = `LEAD-${String((count || 0) + 1).padStart(3, '0')}`
  const { data: lead, error } = await supabase.from('leads').insert({ ...data, codigo }).select().single()
  if (error) throw error
  return lead
}

export async function actualizarLead(id, cambios) {
  const { data, error } = await supabase.from('leads').update({ ...cambios, updated_at: new Date().toISOString() }).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function eliminarLead(id) {
  const { error } = await supabase.from('leads').delete().eq('id', id)
  if (error) throw error
}

// ============================================================
// COBRANZA
// ============================================================
export async function getHitos() {
  const { data } = await supabase.from('hitos_cobranza').select(`*, proyecto:proyectos(id, codigo, nombre, cliente_id, cliente:clientes(razon_social))`).order('fecha_esperada', { ascending: true })
  return data || []
}

export async function actualizarHito(id, cambios) {
  const { data, error } = await supabase.from('hitos_cobranza').update(cambios).eq('id', id).select().single()
  if (error) throw error
  return data
}

// ============================================================
// FACTURAS
// ============================================================
export async function getFacturas() {
  const { data } = await supabase
    .from('facturas')
    .select(`
      *,
      cliente:clientes(id, razon_social),
      proyecto:proyectos(id, codigo, nombre),
      hito:hitos_cobranza!hito_cobranza_id(id, fecha_cobro)
    `)
    .order('fecha_emision', { ascending: false })

  return (data || []).map(f => ({
    ...f,
    fecha_pago: f.hito?.fecha_cobro || null
  }))
}

export async function crearFactura(data) {
  const { count } = await supabase.from('facturas').select('*', { count: 'exact', head: true })
  const folio = `F-${String((count || 0) + 1).padStart(4, '0')}`
  const { data: f, error } = await supabase.from('facturas').insert({ ...data, folio }).select().single()
  if (error) throw error
  return f
}

export async function actualizarFactura(id, cambios) {
  const { data, error } = await supabase.from('facturas').update(cambios).eq('id', id).select().single()
  if (error) throw error
  return data
}

// ============================================================
// COMPRAS
// ============================================================
export async function getCompras() {
  const { data } = await supabase.from('compras').select(`*, proyecto:proyectos(id, codigo, nombre), aprobador:usuarios!aprobado_por(id, nombre)`).order('fecha_solicitud', { ascending: false })
  return data || []
}

export async function crearCompra(data) {
  const { count } = await supabase.from('compras').select('*', { count: 'exact', head: true })
  const codigo = `COMP-${String((count || 0) + 1).padStart(4, '0')}`
  const { data: c, error } = await supabase.from('compras').insert({ ...data, codigo }).select().single()
  if (error) throw error
  return c
}

export async function actualizarCompra(id, cambios) {
  const { data, error } = await supabase.from('compras').update(cambios).eq('id', id).select().single()
  if (error) throw error
  return data
}

// ============================================================
// CONTRATOS
// ============================================================
export async function getContratos() {
  const { data } = await supabase.from('contratos').select(`*, proyecto:proyectos(id, codigo, nombre), cliente:clientes(id, razon_social)`).order('created_at', { ascending: false })
  return data || []
}

export async function crearContrato(data) {
  const { count } = await supabase.from('contratos').select('*', { count: 'exact', head: true })
  const codigo = `CTR-${String((count || 0) + 1).padStart(3, '0')}`
  const { data: c, error } = await supabase.from('contratos').insert({ ...data, codigo }).select().single()
  if (error) throw error
  return c
}

export async function actualizarContrato(id, cambios) {
  const { data, error } = await supabase.from('contratos').update(cambios).eq('id', id).select().single()
  if (error) throw error
  return data
}

// ============================================================
// CIERRE
// ============================================================
export async function getCierreChecklist(proyectoId) {
  const { data } = await supabase.from('cierre_checklist').select('*').eq('proyecto_id', proyectoId).order('orden')
  return data || []
}

export async function crearCierreItem(proyectoId, item) {
  const { count } = await supabase.from('cierre_checklist').select('*', { count: 'exact', head: true }).eq('proyecto_id', proyectoId)
  const { data, error } = await supabase.from('cierre_checklist').insert({ ...item, proyecto_id: proyectoId, orden: (count || 0) + 1 }).select().single()
  if (error) throw error
  return data
}

export async function actualizarCierreItem(id, cambios) {
  const { data, error } = await supabase.from('cierre_checklist').update(cambios).eq('id', id).select().single()
  if (error) throw error
  return data
}

// ============================================================
// POSTVENTA
// ============================================================
export async function getPostventaTickets() {
  const { data } = await supabase.from('postventa_tickets').select(`*, proyecto:proyectos(id, codigo, nombre, cliente:clientes(razon_social)), responsable:usuarios!responsable_id(id, nombre)`).order('created_at', { ascending: false })
  return data || []
}

export async function crearTicket(data) {
  const { count } = await supabase.from('postventa_tickets').select('*', { count: 'exact', head: true })
  const codigo = `TK-${String((count || 0) + 1).padStart(4, '0')}`
  const { data: t, error } = await supabase.from('postventa_tickets').insert({ ...data, codigo }).select().single()
  if (error) throw error
  return t
}

export async function actualizarTicket(id, cambios) {
  const { data, error } = await supabase.from('postventa_tickets').update(cambios).eq('id', id).select().single()
  if (error) throw error
  return data
}

// ============================================================
// v7 — HITOS DE COBRO + NOTAS DE PROYECTO
// ============================================================

// ----- HITOS DE COBRO (lectura para panel Proyecto) -----

export async function getHitosProyecto(proyectoId) {
  const { data, error } = await supabase
    .from('hitos_cobranza')
    .select('*')
    .eq('proyecto_id', proyectoId)
    .order('fecha_esperada', { ascending: true, nullsFirst: false })
  if (error) throw error
  return data || []
}

// ----- NOTAS DEL PROYECTO -----

export async function getNotasProyecto(proyectoId) {
  // Trae las notas con el autor (join a usuarios)
  const { data, error } = await supabase
    .from('proyecto_notas')
    .select(`
      id, proyecto_id, autor_id, contenido, menciones, parent_nota_id,
      created_at, updated_at,
      autor:usuarios!proyecto_notas_autor_id_fkey(id, nombre, email, rol)
    `)
    .eq('proyecto_id', proyectoId)
    .order('created_at', { ascending: true })
  if (error) {
    // Si el FK no tiene alias, fallback sin join
    const { data: d2, error: e2 } = await supabase
      .from('proyecto_notas')
      .select('*')
      .eq('proyecto_id', proyectoId)
      .order('created_at', { ascending: true })
    if (e2) throw e2
    return d2 || []
  }
  return data || []
}

export async function crearNotaProyecto({ proyectoId, contenido, menciones = [], parentId = null }) {
  // Obtener autor_id desde tabla usuarios (matching auth_id)
  const { data: userData } = await supabase.auth.getUser()
  const authId = userData?.user?.id
  const { data: usuario } = await supabase
    .from('usuarios').select('id').eq('auth_id', authId).single()

  const { data, error } = await supabase
    .from('proyecto_notas')
    .insert({
      proyecto_id: proyectoId,
      autor_id: usuario?.id,
      contenido,
      menciones,
      parent_nota_id: parentId,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function actualizarNota(id, contenido, menciones = []) {
  const { data, error } = await supabase
    .from('proyecto_notas')
    .update({ contenido, menciones })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function eliminarNota(id) {
  const { error } = await supabase.from('proyecto_notas').delete().eq('id', id)
  if (error) throw error
}

// Extrae @nombres del contenido y los mapea a user_ids
// usage: extraerMenciones("Hola @Malio Martinez y @Ana Torres", usuarios)
export function extraerMenciones(contenido, usuarios) {
  const mentions = new Set()
  // Match @nombre seguido opcional de apellido (palabras capitalizadas)
  const regex = /@([A-ZÁ-ÚÑ][a-zá-úñ]+(?:\s+[A-ZÁ-ÚÑ][a-zá-úñ]+)?)/g
  let match
  while ((match = regex.exec(contenido)) !== null) {
    const nombre = match[1].trim()
    const user = usuarios.find(u =>
      u.nombre?.toLowerCase().startsWith(nombre.toLowerCase()) ||
      nombre.toLowerCase().startsWith(u.nombre?.toLowerCase())
    )
    if (user) mentions.add(user.id)
  }
  return Array.from(mentions)
}
// ============================================================
// v8 — ACTIVIDADES: duplicar, milestone, importancia, peso
// ============================================================

// Duplicar actividad (mantiene props, nombre + " (copia)")
export async function duplicarActividad(actividadId) {
  const { data, error } = await supabase.rpc('duplicar_actividad', {
    p_actividad_id: actividadId
  })
  if (error) throw error
  return data  // nuevo UUID
}

// Toggle milestone / quitar milestone
export async function toggleMilestone(actividadId, esMilestone) {
  const { error } = await supabase
    .from('actividades')
    .update({ es_milestone: esMilestone })
    .eq('id', actividadId)
  if (error) throw error
}

// Cambiar importancia
export async function cambiarImportancia(actividadId, importancia) {
  // importancia: 'alta' | 'media' | 'baja' | null
  const { error } = await supabase
    .from('actividades')
    .update({ importancia })
    .eq('id', actividadId)
  if (error) throw error
}

// ============================================================
// v12 + v13.3 — DUPLICAR PROYECTO + PESO + RECALCULAR PADRE
// ============================================================

// ----- v12: DUPLICAR PROYECTO COMPLETO -----
// Crea una copia del proyecto con todas sus actividades (y sus deps)
export async function duplicarProyecto(proyectoId, nuevoNombre) {
  // 1. Traer proyecto original
  const { data: original, error: eP } = await supabase
    .from('proyectos').select('*').eq('id', proyectoId).single()
  if (eP) throw eP

  // 2. Generar código nuevo
  const { count } = await supabase.from('proyectos').select('*', { count:'exact', head:true })
  const codigo = `PRY-${String((count || 0) + 1).padStart(3, '0')}`

  // 3. Crear proyecto duplicado (quitamos id, created_at, updated_at)
  const { id: _, created_at, updated_at, codigo: _c, ...datos } = original
  const { data: nuevo, error: eN } = await supabase
    .from('proyectos')
    .insert({
      ...datos,
      codigo,
      nombre: nuevoNombre,
      estado: 'Por iniciar',
    })
    .select().single()
  if (eN) throw eN

  // 4. Traer actividades originales
  const { data: actsOrig } = await supabase
    .from('actividades').select('*').eq('proyecto_id', proyectoId).order('numero')

  if (!actsOrig || actsOrig.length === 0) return nuevo.id

  // 5. Mapear id_viejo → id_nuevo (para preservar deps y jerarquía padre/hijo)
  // Primero insertamos actividades SIN deps ni parent_id, y guardamos el mapeo
  const mapaIds = {}
  const actsParaInsertar = actsOrig.map(a => {
    const { id, created_at, updated_at, proyecto_id, parent_id, deps, ...datos } = a
    return { ...datos, proyecto_id: nuevo.id, avance: 0, estado: 'Sin iniciar', completada: false }
  })

  const { data: actsNuevas, error: eA } = await supabase
    .from('actividades').insert(actsParaInsertar).select()
  if (eA) throw eA

  // Construir mapa id_viejo → id_nuevo usando el número (que preservamos)
  actsOrig.forEach((orig, i) => {
    const nueva = actsNuevas.find(n => n.numero === orig.numero)
    if (nueva) mapaIds[orig.id] = nueva.id
  })

  // 6. Segundo pase: actualizar parent_id y deps con los nuevos IDs
  const actualizaciones = []
  for (const orig of actsOrig) {
    const nuevoId = mapaIds[orig.id]
    if (!nuevoId) continue
    const cambios = {}
    if (orig.parent_id && mapaIds[orig.parent_id]) {
      cambios.parent_id = mapaIds[orig.parent_id]
    }
    if (orig.deps && orig.deps.length > 0) {
      cambios.deps = orig.deps
        .map(d => mapaIds[d.id] ? { ...d, id: mapaIds[d.id] } : null)
        .filter(Boolean)
    }
    if (Object.keys(cambios).length > 0) {
      actualizaciones.push(supabase.from('actividades').update(cambios).eq('id', nuevoId))
    }
  }
  await Promise.all(actualizaciones)

  return nuevo.id
}

// ----- v12: CALCULAR AVANCE PONDERADO (fórmula Luis) -----
// Si parentId es null → avance del proyecto completo
// Si parentId es un ID → avance ponderado de los hijos de ese padre
// Fórmula: Σ (avance_i × peso_i) / Σ peso_i
// Si no hay pesos definidos, usa promedio simple
export function calcularAvancePonderado(actividades, parentId = null) {
  const hijos = actividades.filter(a => (a.parent_id || null) === parentId)
  if (hijos.length === 0) return 0

  const sumaPesos = hijos.reduce((s, h) => s + Number(h.peso || 0), 0)

  if (sumaPesos > 0) {
    // Avance ponderado
    const sumaPonderada = hijos.reduce((s, h) => s + (Number(h.peso || 0) * Number(h.avance || 0)), 0)
    return Math.round(sumaPonderada / sumaPesos)
  } else {
    // Fallback: promedio simple
    const sumaSimple = hijos.reduce((s, h) => s + Number(h.avance || 0), 0)
    return Math.round(sumaSimple / hijos.length)
  }
}

// ----- v12: VALIDAR SUMA DE PESOS -----
// Verifica si los pesos de los hijos suman 100%
// Retorna: { ok: bool, suma: number, mensaje: string }
export function validarSumaPesos(actividades, parentId = null) {
  const hijos = actividades.filter(a => (a.parent_id || null) === parentId)
  const suma = hijos.reduce((s, h) => s + Number(h.peso || 0), 0)

  if (suma === 0) return { ok: true, suma: 0, mensaje: 'Sin pesos definidos (usando promedio simple)' }
  if (suma === 100) return { ok: true, suma: 100, mensaje: 'Pesos correctos' }
  return { ok: false, suma, mensaje: `La suma es ${suma}%, debe ser 100%` }
}

// ----- v12: MARCAR ACTIVIDAD COMO COBRABLE -----
export async function marcarCobrable(actividadId, esCobrable, estadoCobro = null, monto = null) {
  const cambios = { es_cobrable: esCobrable }
  if (esCobrable) {
    cambios.estado_cobro = estadoCobro || 'Pendiente'
    if (monto !== null) cambios.monto_cobrable = monto
  } else {
    cambios.estado_cobro = 'NA'
  }
  const { error } = await supabase.from('actividades').update(cambios).eq('id', actividadId)
  if (error) throw error
}

// ----- v13.3: RECALCULAR FECHAS DEL PADRE -----
// Cuando se mueve un hijo, el padre debe adaptar sus fechas (MIN inicio, MAX fin)
// para que el grupo visual abarque todos sus hijos.
export async function recalcularPadre(padreId) {
  if (!padreId) return
  const { data: hijos, error } = await supabase
    .from('actividades').select('inicio, fin').eq('parent_id', padreId)
  if (error) throw error
  if (!hijos || hijos.length === 0) return

  const minInicio = hijos.reduce((min, h) => !min || h.inicio < min ? h.inicio : min, null)
  const maxFin = hijos.reduce((max, h) => !max || h.fin > max ? h.fin : max, null)

  if (!minInicio || !maxFin) return

  await supabase.from('actividades')
    .update({ inicio: minInicio, fin: maxFin })
    .eq('id', padreId)
}

// ============================================================
// v12 — CARGA POR COLABORADOR + CUELLOS DE BOTELLA
// Funciones puras (no requieren tablas SQL). Operan sobre
// actividades y usuarios ya cargados en memoria.
// ============================================================

// ============================================================
// v12: Cálculo de carga por colaborador (para VistaPersonas de Luis)
// ============================================================
// v16.5.0: constante para evitar magic number repetido
const MS_PER_DAY = 86400000

export function calcularCargaPorColaborador(actividades = [], usuarios = []) {
  // Rango de "esta semana" (lunes-domingo de la semana actual)
  const hoy = new Date()
  const diaSemana = hoy.getDay() // 0=domingo, 1=lunes...
  const diasDesdeLunes = diaSemana === 0 ? 6 : diaSemana - 1
  const lunes = new Date(hoy); lunes.setDate(hoy.getDate() - diasDesdeLunes); lunes.setHours(0,0,0,0)
  const domingo = new Date(lunes); domingo.setDate(lunes.getDate() + 7)

  // Solo usuarios que trabajan en operaciones (equipo, director de proyectos, admin)
  const usuariosOperativos = usuarios.filter(u =>
    ['equipo_proyectos', 'director_proyectos', 'admin', 'direccion'].includes(u.rol)
  )

  return usuariosOperativos.map(u => {
    const capacidad = Number(u.capacidad_horas_semana || 40) // horas/semana, default 40
    const actsUsuario = actividades.filter(a => a.responsable_id === u.id || a.asignado_id === u.id)
    // Activas pendientes (lo que sigue abierto, sin importar fechas)
    const activas = actsUsuario.filter(a => !['Completada','Cancelada'].includes(a.estado))
    const completadas = actsUsuario.filter(a => a.estado === 'Completada')
    // Activas que tocan la semana actual (las que realmente generan carga ahora)
    const activasEstaSemana = activas.filter(a => {
      if (!a.inicio || !a.fin) return false
      const ini = new Date(a.inicio); ini.setHours(0,0,0,0)
      const fin = new Date(a.fin); fin.setHours(23,59,59,999)
      return fin >= lunes && ini < domingo
    })

    // Horas consumidas esta semana usando horas_estimadas si existe (>0).
    // Si no, fallback a días traslapados × 8h por día.
    let horasSemana = 0
    activasEstaSemana.forEach(a => {
      const ini = new Date(a.inicio); ini.setHours(0,0,0,0)
      const fin = new Date(a.fin); fin.setHours(23,59,59,999)
      const interIni = ini > lunes ? ini : lunes
      const interFin = fin < domingo ? fin : new Date(domingo.getTime() - 1)
      const diasTraslape = Math.max(1, Math.ceil((interFin - interIni) / MS_PER_DAY))
      const horasEst = Number(a.horas_estimadas || 0)
      if (horasEst > 0) {
        // Prorratear horas_estimadas por días que caen en esta semana
        const duracionDias = Math.max(1, Math.ceil((fin - ini) / MS_PER_DAY))
        horasSemana += (horasEst / duracionDias) * diasTraslape
      } else {
        // v15.10.13: fallback a 2h/día (antes 8h/día). Razón: 8h/día asumía
        // dedicación full-time por actividad, lo que sobrecargaba con solo 2-3
        // tareas. 2h/día es un default realista para actividades parciales;
        // si una actividad requiere más, se ajusta con el campo horas_estimadas.
        horasSemana += diasTraslape * 2
      }
    })
    horasSemana = Math.round(horasSemana)

    const porcentaje = capacidad > 0 ? Math.round((horasSemana / capacidad) * 100) : 0
    const sobrecargado = porcentaje > 100
    const subutilizado = porcentaje < 50 && activasEstaSemana.length > 0

    // Tiempo promedio en actividades completadas — usa fecha_fin_real - fecha_inicio_real si existen
    let tiempoPromedioDias = null
    if (completadas.length > 0) {
      const dias = completadas.map(a => {
        const fini = a.fecha_inicio_real || a.inicio
        const ffin = a.fecha_fin_real || a.fin
        if (!fini || !ffin) return null
        return Math.ceil((new Date(ffin) - new Date(fini)) / MS_PER_DAY)
      }).filter(d => d !== null && d > 0)
      if (dias.length > 0) {
        tiempoPromedioDias = Math.round(dias.reduce((s,d) => s+d, 0) / dias.length)
      }
    }

    // Desviación real vs estimado: promedio de (real_fin - planeado_fin) / duracion_planeada
    // Solo cuenta completadas con fecha_fin_real registrada y fechas planeadas válidas.
    let desviacionPct = 0
    const desvs = completadas.map(a => {
      if (!a.fecha_fin_real || !a.fin || !a.inicio) return null
      const planFin = new Date(a.fin)
      const realFin = new Date(a.fecha_fin_real)
      const planIni = new Date(a.inicio)
      const duracionPlan = Math.max(1, Math.ceil((planFin - planIni) / MS_PER_DAY))
      const diferenciaDias = Math.round((realFin - planFin) / MS_PER_DAY)
      return Math.round((diferenciaDias / duracionPlan) * 100)
    }).filter(d => d !== null)
    if (desvs.length > 0) {
      desviacionPct = Math.round(desvs.reduce((s, d) => s + d, 0) / desvs.length)
    }

    return {
      usuario: u,
      asignadas: activasEstaSemana.length,        // Solo las que tocan esta semana (Issue #1)
      pendientesTotal: activas.length,             // Todas las pendientes (referencia)
      completadas: completadas.length,
      horasSemana,
      capacidad,
      porcentaje,
      sobrecargado,
      subutilizado,
      tiempoPromedioDias,
      desviacionPct,
    }
  })
}

// ============================================================
// v12: Identificar cuellos de botella (para VistaPersonas de Luis)
// ============================================================
export function identificarCuellosBotella(actividades = []) {
  const hoy = new Date(); hoy.setHours(0,0,0,0)

  // Actividades retrasadas: estado activo + fin < hoy
  const retrasadas = actividades.filter(a => {
    if (['Completada','Cancelada'].includes(a.estado)) return false
    if (!a.fin) return false
    return new Date(a.fin) < hoy
  }).map(a => {
    const diasRetraso = Math.ceil((hoy - new Date(a.fin)) / MS_PER_DAY)
    return { ...a, diasRetraso }
  })

  // Agrupar por nombre de actividad (etapa más recurrente)
  const porEtapaMap = {}
  retrasadas.forEach(a => {
    const key = a.nombre || 'Sin nombre'
    if (!porEtapaMap[key]) porEtapaMap[key] = { nombre: key, count: 0, totalDias: 0 }
    porEtapaMap[key].count += 1
    porEtapaMap[key].totalDias += a.diasRetraso
  })

  const porEtapa = Object.values(porEtapaMap)
    .sort((a,b) => b.count - a.count)
    .slice(0, 5) // top 5 cuellos de botella

  return {
    retrasadas,
    porEtapa,
  }
}

// ============================================================
// v12.5.4 — CRUD GASTOS VARIABLES + CUENTAS POR PAGAR
// Usa tablas gastos_variables y cuentas_por_pagar.
// ============================================================


// ============================================================
// v12.5.4: GASTOS VARIABLES
// ============================================================

// Lista todos los gastos variables (opcionalmente filtrados por año)
export async function getGastosVariables(anio = null) {
  let query = supabase
    .from('gastos_variables')
    .select('*, creador:usuarios!creado_por(id, nombre)')
    .order('anio', { ascending: false })
    .order('mes', { ascending: false })

  if (anio) query = query.eq('anio', anio)

  const { data, error } = await query
  if (error) { console.error('getGastosVariables:', error); return [] }
  return data || []
}

// Crear un gasto variable nuevo
export async function crearGasto({ categoria, monto, mes, anio, notas = null }) {
  const { data: userData } = await supabase.auth.getUser()
  const authId = userData?.user?.id
  let creadoPor = null
  if (authId) {
    const { data: u } = await supabase.from('usuarios').select('id').eq('auth_id', authId).single()
    creadoPor = u?.id || null
  }

  const { data, error } = await supabase
    .from('gastos_variables')
    .insert({ categoria, monto: Number(monto), mes: Number(mes), anio: Number(anio), notas, creado_por: creadoPor })
    .select()
    .single()
  if (error) throw error
  return data
}

// Actualizar gasto existente
export async function actualizarGasto(id, cambios) {
  const { data, error } = await supabase
    .from('gastos_variables')
    .update(cambios)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

// Eliminar gasto
export async function eliminarGasto(id) {
  const { error } = await supabase.from('gastos_variables').delete().eq('id', id)
  if (error) throw error
}

// Helper: agrupar gastos por categoría para un mes/año específico
// Retorna: { categoria: montoTotal, ... }
export function agruparGastosPorCategoria(gastos, mes, anio) {
  return gastos
    .filter(g => g.mes === mes && g.anio === anio)
    .reduce((acc, g) => {
      acc[g.categoria] = (acc[g.categoria] || 0) + Number(g.monto || 0)
      return acc
    }, {})
}

// Helper: agrupar gastos históricos por año (para gráfico de líneas)
// Retorna: { 2024: [enero, feb, ...], 2025: [...], 2026: [...] }
export function agruparGastosHistoricos(gastos) {
  const result = {}
  gastos.forEach(g => {
    if (!result[g.anio]) result[g.anio] = Array(12).fill(0)
    result[g.anio][g.mes - 1] += Number(g.monto || 0)
  })
  return result
}


// ============================================================
// v12.5.4: CUENTAS POR PAGAR
// ============================================================

// Lista todas las cuentas por pagar (opcionalmente filtradas)
export async function getCuentasPorPagar({ estado = null, soloSemanaActual = false } = {}) {
  let query = supabase
    .from('cuentas_por_pagar')
    .select(`
      *,
      creador:usuarios!creado_por(id, nombre),
      autorizador:usuarios!autorizado_por(id, nombre),
      pagador:usuarios!pagado_por(id, nombre),
      proyecto:proyectos(id, codigo, nombre)
    `)
    .order('fecha_pago', { ascending: true })

  if (estado) query = query.eq('estado', estado)

  if (soloSemanaActual) {
    const hoy = new Date()
    const dia = hoy.getDay()
    const diasDesdeLunes = dia === 0 ? 6 : dia - 1
    const lunes = new Date(hoy); lunes.setDate(hoy.getDate() - diasDesdeLunes)
    const domingo = new Date(lunes); domingo.setDate(lunes.getDate() + 6)
    query = query
      .gte('fecha_pago', lunes.toISOString().split('T')[0])
      .lte('fecha_pago', domingo.toISOString().split('T')[0])
  }

  const { data, error } = await query
  if (error) { console.error('getCuentasPorPagar:', error); return [] }
  return data || []
}

// Crear cuenta por pagar nueva
export async function crearCuentaPorPagar({ concepto, monto, fecha_pago, proveedor = null, notas = null, proyecto_id = null }) {
  const { data: userData } = await supabase.auth.getUser()
  const authId = userData?.user?.id
  let creadoPor = null
  if (authId) {
    const { data: u } = await supabase.from('usuarios').select('id').eq('auth_id', authId).single()
    creadoPor = u?.id || null
  }

  const { data, error } = await supabase
    .from('cuentas_por_pagar')
    .insert({
      concepto,
      monto: Number(monto),
      fecha_pago,
      proveedor,
      notas,
      proyecto_id,
      estado: 'Pendiente',
      autorizado: false,
      creado_por: creadoPor,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

// Autorizar cuenta (acción especial que registra quién y cuándo)
export async function autorizarCuentaPorPagar(id) {
  const { data: userData } = await supabase.auth.getUser()
  const authId = userData?.user?.id
  let autorizadoPor = null
  if (authId) {
    const { data: u } = await supabase.from('usuarios').select('id').eq('auth_id', authId).single()
    autorizadoPor = u?.id || null
  }

  const { data, error } = await supabase
    .from('cuentas_por_pagar')
    .update({
      autorizado: true,
      estado: 'Autorizado',
      autorizado_por: autorizadoPor,
      autorizado_en: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

// Des-autorizar cuenta (revertir autorización)
export async function desautorizarCuentaPorPagar(id) {
  const { data, error } = await supabase
    .from('cuentas_por_pagar')
    .update({
      autorizado: false,
      estado: 'Pendiente',
      autorizado_por: null,
      autorizado_en: null,
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

// Marcar como pagada
export async function marcarCuentaPorPagarComoPagada(id) {
  const { data: userData } = await supabase.auth.getUser()
  const authId = userData?.user?.id
  let pagadoPor = null
  if (authId) {
    const { data: u } = await supabase.from('usuarios').select('id').eq('auth_id', authId).single()
    pagadoPor = u?.id || null
  }

  const { data, error } = await supabase
    .from('cuentas_por_pagar')
    .update({
      estado: 'Pagado',
      pagado_por: pagadoPor,
      pagado_en: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

// Actualizar cualquier campo de la cuenta
export async function actualizarCuentaPorPagar(id, cambios) {
  const { data, error } = await supabase
    .from('cuentas_por_pagar')
    .update(cambios)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

// Eliminar cuenta (solo si no está pagada — integridad de auditoría)
export async function eliminarCuentaPorPagar(id) {
  const { data: cuenta } = await supabase
    .from('cuentas_por_pagar')
    .select('estado')
    .eq('id', id)
    .single()

  if (cuenta?.estado === 'Pagado') {
    throw new Error('No se puede eliminar una cuenta ya pagada. Usa Cancelar en su lugar.')
  }

  const { error } = await supabase.from('cuentas_por_pagar').delete().eq('id', id)
  if (error) throw error
}

// Cancelar cuenta (en lugar de eliminar si ya tiene historial)
export async function cancelarCuentaPorPagar(id, motivo = null) {
  const { data, error } = await supabase
    .from('cuentas_por_pagar')
    .update({ estado: 'Cancelado', notas: motivo })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

// ============================================================
// v12.5.6 — CRUD DE USUARIOS
// Incluye reglas duras para proteger integridad del sistema.
// ============================================================


// ============================================================
// v12.5.6: USUARIOS (CRUD completo)
// ============================================================

// getUsuarios ya existe, pero por si quieres también los inactivos:
export async function getTodosUsuarios() {
  const { data, error } = await supabase
    .from('usuarios')
    .select('*')
    .order('nombre')
  if (error) { console.error('getTodosUsuarios:', error); return [] }
  return data || []
}

// Crear usuario nuevo en la tabla 'usuarios'
// NOTA: Este usuario NO tendrá auth_id hasta que alguien lo invite a Supabase Auth
// y haga su primer login. Por eso tiene un paso adicional.
export async function crearUsuario({ nombre, email, rol, telefono = null, capacidad_horas_semana = 40, activo = true }) {
  // Validación básica
  if (!nombre?.trim()) throw new Error('El nombre es obligatorio')
  if (!email?.trim()) throw new Error('El email es obligatorio')
  if (!rol) throw new Error('El rol es obligatorio')
  // v16.4.0: bounds en capacidad (espejo del edge function v3)
  const capRaw = parseInt(String(capacidad_horas_semana ?? ''), 10)
  if (!Number.isFinite(capRaw)) throw new Error('Capacidad horas/semana inválida')
  if (capRaw < 1 || capRaw > 168) throw new Error('Capacidad horas/semana debe estar entre 1 y 168')

  const emailLower = email.toLowerCase().trim()

  // Verificar si el email ya existe
  const { data: existente } = await supabase
    .from('usuarios')
    .select('id')
    .eq('email', emailLower)
    .maybeSingle()

  if (existente) {
    throw new Error(`Ya existe un usuario con el email ${emailLower}`)
  }

  const { data, error } = await supabase
    .from('usuarios')
    .insert({
      nombre: nombre.trim(),
      email: emailLower,
      rol,
      telefono: telefono?.trim() || null,
      capacidad_horas_semana: capRaw,
      activo,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

// Actualizar usuario existente
// Reglas duras aplicadas:
//   - No se puede cambiar email a uno que ya existe
export async function actualizarUsuario(id, cambios) {
  if (!id) throw new Error('ID de usuario requerido')

  // Si se está cambiando el email, verificar que no exista duplicado
  if (cambios.email) {
    const emailLower = cambios.email.toLowerCase().trim()
    const { data: existente } = await supabase
      .from('usuarios')
      .select('id')
      .eq('email', emailLower)
      .neq('id', id)
      .maybeSingle()

    if (existente) {
      throw new Error(`Ya existe otro usuario con el email ${emailLower}`)
    }
    cambios.email = emailLower
  }

  // Normalizar strings
  if (cambios.nombre) cambios.nombre = cambios.nombre.trim()
  if (cambios.telefono !== undefined) cambios.telefono = cambios.telefono?.trim() || null
  // v16.4.0: bounds en capacidad (espejo del edge function v3)
  if (cambios.capacidad_horas_semana !== undefined) {
    const cap = parseInt(String(cambios.capacidad_horas_semana), 10)
    if (!Number.isFinite(cap)) throw new Error('Capacidad horas/semana inválida')
    if (cap < 1 || cap > 168) throw new Error('Capacidad horas/semana debe estar entre 1 y 168')
    cambios.capacidad_horas_semana = cap
  }

  const { data, error } = await supabase
    .from('usuarios')
    .update(cambios)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

// Eliminar usuario con reglas duras:
//   - No se puede eliminar a sí mismo
//   - No se puede eliminar el último usuario con rol 'direccion'
//   - Si tiene foreign keys activas, en lugar de eliminar se sugiere desactivar
export async function eliminarUsuario(id, idSolicitante) {
  if (!id) throw new Error('ID de usuario requerido')

  // Regla 1: no auto-eliminación
  if (id === idSolicitante) {
    throw new Error('No puedes eliminar tu propia cuenta')
  }

  // Obtener el usuario a eliminar
  const { data: usuario, error: eGet } = await supabase
    .from('usuarios')
    .select('id, rol, nombre')
    .eq('id', id)
    .single()

  if (eGet || !usuario) throw new Error('Usuario no encontrado')

  // Regla 2: si es direccion, verificar que haya al menos otro
  if (usuario.rol === 'direccion') {
    const { count } = await supabase
      .from('usuarios')
      .select('*', { count: 'exact', head: true })
      .eq('rol', 'direccion')
      .eq('activo', true)

    if ((count || 0) <= 1) {
      throw new Error(
        `No se puede eliminar: ${usuario.nombre} es el único usuario con rol Dirección. ` +
        `Debe existir al menos uno activo.`
      )
    }
  }

  // Intentar eliminar. Si falla por foreign keys, sugerir desactivar
  const { error } = await supabase.from('usuarios').delete().eq('id', id)
  if (error) {
    if (error.code === '23503') {
      // Foreign key violation
      throw new Error(
        `No se puede eliminar: ${usuario.nombre} tiene registros asociados ` +
        `(proyectos, cotizaciones, etc.). Desactiva el usuario en su lugar.`
      )
    }
    throw error
  }
}

// Desactivar usuario (alternativa segura a eliminar)
// Reglas duras:
//   - No se puede desactivar a sí mismo
//   - No se puede desactivar el último usuario activo con rol 'direccion'
export async function desactivarUsuario(id, idSolicitante) {
  if (!id) throw new Error('ID de usuario requerido')

  if (id === idSolicitante) {
    throw new Error('No puedes desactivar tu propia cuenta')
  }

  const { data: usuario } = await supabase
    .from('usuarios')
    .select('id, rol, nombre, activo')
    .eq('id', id)
    .single()

  if (!usuario) throw new Error('Usuario no encontrado')

  if (usuario.rol === 'direccion' && usuario.activo) {
    const { count } = await supabase
      .from('usuarios')
      .select('*', { count: 'exact', head: true })
      .eq('rol', 'direccion')
      .eq('activo', true)

    if ((count || 0) <= 1) {
      throw new Error(
        `No se puede desactivar: ${usuario.nombre} es el único usuario con rol Dirección activo.`
      )
    }
  }

  const { data, error } = await supabase
    .from('usuarios')
    .update({ activo: false })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

// Reactivar usuario
export async function activarUsuario(id) {
  const { data, error } = await supabase
    .from('usuarios')
    .update({ activo: true })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

// Cambiar rol de usuario con reglas duras:
//   - No se puede cambiar su propio rol si es el único direccion
export async function cambiarRolUsuario(id, nuevoRol, idSolicitante) {
  if (!id) throw new Error('ID de usuario requerido')
  if (!nuevoRol) throw new Error('Nuevo rol requerido')

  const { data: usuario } = await supabase
    .from('usuarios')
    .select('id, rol, nombre')
    .eq('id', id)
    .single()

  if (!usuario) throw new Error('Usuario no encontrado')

  // Regla: si está degradando el último direccion, bloquear
  if (usuario.rol === 'direccion' && nuevoRol !== 'direccion') {
    const { count } = await supabase
      .from('usuarios')
      .select('*', { count: 'exact', head: true })
      .eq('rol', 'direccion')
      .eq('activo', true)

    if ((count || 0) <= 1) {
      throw new Error(
        `No se puede cambiar el rol: ${usuario.nombre} es el único usuario con rol Dirección. ` +
        `Primero asigna otro usuario como Dirección.`
      )
    }
  }

  const { data, error } = await supabase
    .from('usuarios')
    .update({ rol: nuevoRol })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

// ============================================================
// v12.5.8 — INVITACIÓN DE USUARIOS VÍA EDGE FUNCTION
// ============================================================


// ============================================================
// v12.5.8: Invitar usuario vía Edge Function
// Crea usuario en tabla + envía email con magic link en UN SOLO PASO
// ============================================================
export async function invitarUsuarioViaEdge({ nombre, email, rol, telefono = null, capacidad_horas_semana = 40, generar_password_temporal = false }) {
  // Obtener el JWT del usuario actual (para autenticar la llamada)
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Debes estar autenticado para invitar usuarios')

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  if (!supabaseUrl) throw new Error('VITE_SUPABASE_URL no configurado')

  const response = await fetch(`${supabaseUrl}/functions/v1/invitar-usuario`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      nombre,
      email,
      rol,
      telefono,
      capacidad_horas_semana,
      generar_password_temporal,  // v16.7.0
    }),
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error || `Error HTTP ${response.status}`)
  }

  return data
}

// v16.1.4: Reinvitar usuario huérfano (existe en BD sin auth_id)
// La edge function v2 detecta huérfano y solo dispara el invite + linkea auth_id
// sin recrear el row (preserva FKs).
export async function reinvitarUsuario(email) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Debes estar autenticado para reinvitar usuarios')

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  if (!supabaseUrl) throw new Error('VITE_SUPABASE_URL no configurado')

  const response = await fetch(`${supabaseUrl}/functions/v1/invitar-usuario`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email }),
  })

  const data = await response.json()
  if (!response.ok) throw new Error(data.error || `Error HTTP ${response.status}`)
  return data
}

// ============================================================
// v12.5.9 — CRUD ALERTAS CONFIG (por usuario)
// ============================================================

// Obtiene la config de alertas del usuario actual
// Si no tiene config, la crea con defaults por rol
export async function getAlertasConfig(usuarioId) {
  if (!usuarioId) throw new Error('usuarioId requerido')

  const { data, error } = await supabase
    .from('alertas_config')
    .select('*')
    .eq('usuario_id', usuarioId)
    .maybeSingle()

  if (error) {
    console.error('getAlertasConfig:', error)
    return null
  }

  // Si no existe, crear con defaults por rol
  if (!data) {
    await supabase.rpc('aplicar_defaults_alertas', { p_usuario_id: usuarioId })
    const { data: nuevaConfig } = await supabase
      .from('alertas_config')
      .select('*')
      .eq('usuario_id', usuarioId)
      .single()
    return nuevaConfig
  }

  return data
}

// Actualiza la config de alertas del usuario
export async function actualizarAlertasConfig(usuarioId, cambios) {
  if (!usuarioId) throw new Error('usuarioId requerido')

  const { data, error } = await supabase
    .from('alertas_config')
    .update({ ...cambios, updated_at: new Date().toISOString() })
    .eq('usuario_id', usuarioId)
    .select()
    .single()

  if (error) throw error
  return data
}

// Resetear a defaults del rol (útil si el usuario quiere volver al default)
export async function resetearAlertasConfig(usuarioId) {
  if (!usuarioId) throw new Error('usuarioId requerido')

  // Borrar la config actual
  await supabase.from('alertas_config').delete().eq('usuario_id', usuarioId)

  // Recrear con defaults
  await supabase.rpc('aplicar_defaults_alertas', { p_usuario_id: usuarioId })

  // Retornar la nueva
  const { data } = await supabase
    .from('alertas_config')
    .select('*')
    .eq('usuario_id', usuarioId)
    .single()

  return data
}

// ============================================================
// v15.7.0 — Workflow SIM (Declaración Operación Comercial)
// ============================================================

export const ETAPAS_SIM = [
  { key: 'estudios',     label: 'Estudios',                  descripcion: 'Estudios de Impacto e Instalaciones ante CENACE.' },
  { key: 'contrato',     label: 'Contrato',                  descripcion: 'Contrato de Conexión / Interconexión y garantías financieras.' },
  { key: 'poc',          label: 'POC',                       descripcion: 'Puesta en Servicio: gestión SAPPSE, ingeniería básica.' },
  { key: 'anexo',        label: 'Anexo II',                  descripcion: 'Anexos del POC: parámetros de equipos, validación de modelos.' },
  { key: 'energizacion', label: 'Energización',              descripcion: 'Primera energización con CENACE y CFE.' },
  { key: 'doc',          label: 'DOC',                       descripcion: 'Declaración de Operación Comercial — alta como Participante del Mercado.' },
]

export const ESTADOS_SIM = {
  pendiente:   { label: 'Pendiente',   color: '#64748B', bg: '#F1F5F9' },
  en_curso:    { label: 'En curso',    color: '#0F6E56', bg: '#E1F5EE' },
  completada:  { label: 'Completada',  color: '#15803D', bg: '#DCFCE7' },
  bloqueada:   { label: 'Bloqueada',   color: '#DC2626', bg: '#FEF2F2' },
}

// Devuelve las 6 etapas del proyecto. Si una etapa no tiene fila, se rellena con default 'pendiente'.
// Devuelve null si la tabla no existe (Malio aún no aplicó la migration).
export async function getProyectoSimEtapas(proyectoId) {
  if (!proyectoId) throw new Error('proyectoId requerido')

  const { data, error } = await supabase
    .from('proyecto_sim_etapas')
    .select('*, responsable:usuarios!responsable_id(id, nombre)')
    .eq('proyecto_id', proyectoId)

  if (error) {
    // Si la tabla no existe, devolver null para que la UI muestre mensaje
    if (error.code === '42P01') return null
    console.error('getProyectoSimEtapas:', error)
    throw error
  }

  // Rellenar las 6 etapas, marcando las faltantes como 'pendiente'
  const porEtapa = {}
  ;(data || []).forEach(row => { porEtapa[row.etapa] = row })
  return ETAPAS_SIM.map(e => porEtapa[e.key] || {
    proyecto_id: proyectoId,
    etapa: e.key,
    estado: 'pendiente',
    fecha_inicio: null,
    fecha_fin: null,
    notas: null,
    responsable_id: null,
    responsable: null,
  })
}

// UPSERT (insert or update) de una etapa específica.
// cambios = subset de columnas a setear. Devuelve la fila actualizada.
export async function upsertEtapaSim(proyectoId, etapaKey, cambios) {
  if (!proyectoId || !etapaKey) throw new Error('proyectoId y etapaKey requeridos')
  const payload = { proyecto_id: proyectoId, etapa: etapaKey, ...cambios }
  const { data, error } = await supabase
    .from('proyecto_sim_etapas')
    .upsert(payload, { onConflict: 'proyecto_id,etapa' })
    .select('*, responsable:usuarios!responsable_id(id, nombre)')
    .single()
  if (error) throw error
  return data
}

// ============================================================
// v15.8.0 — Catálogo de Plantas Eléctricas
// ============================================================

export const TIPOS_TECNOLOGIA_PLANTA = [
  'Fotovoltaica', 'Eolica', 'Termoelectrica', 'Hidroelectrica',
  'Cogeneracion', 'Biomasa', 'Geotermica', 'Ciclo combinado',
  'Almacenamiento BESS', 'Hibrido', 'Otra',
]

export const ESTADOS_PLANTA = {
  'Planeacion':       { label: 'Planeación',      color: '#64748B', bg: '#F1F5F9' },
  'En construccion':  { label: 'En construcción', color: '#D97706', bg: '#FEF3C7' },
  'En operacion':     { label: 'En operación',    color: '#0F6E56', bg: '#E1F5EE' },
  'Mantenimiento':    { label: 'Mantenimiento',   color: '#1B3A6B', bg: '#E0E7FF' },
  'Retirada':         { label: 'Retirada',        color: '#94A3B8', bg: '#F1F5F9' },
}

// Devuelve el path del template DOCX según capacidad MW (para botón "descargar template")
export function templateCotizacionPorCapacidad(capacidadMw) {
  if (!capacidadMw) return null
  const mw = Number(capacidadMw)
  if (mw <= 10) return 'BASE CENTRAL ELÉCTRICA 0.5 A 10 MW (1).docx'
  if (mw <= 1000) return 'BASE CENTRAL ELÉCTRICA 10.1 A 1000 MW (1).docx'
  return null
}

export async function getPlantas() {
  const { data, error } = await supabase
    .from('plantas_electricas')
    .select('*, cliente:clientes(id, razon_social)')
    .order('created_at', { ascending: false })
  if (error) {
    if (error.code === '42P01') return null  // tabla no existe aún
    console.error('getPlantas:', error)
    throw error
  }
  return data
}

export async function getPlanta(id) {
  if (!id) throw new Error('id requerido')
  const { data, error } = await supabase
    .from('plantas_electricas')
    .select('*, cliente:clientes(id, razon_social, rfc, industria)')
    .eq('id', id)
    .single()
  if (error) throw error

  // Cargar proyectos asociados
  const { data: proyectos } = await supabase
    .from('proyectos')
    .select('id, codigo, nombre, estado, director:usuarios!director_id(id, nombre)')
    .eq('planta_id', id)
    .order('created_at', { ascending: false })

  return { ...data, proyectos: proyectos || [] }
}

// Genera el siguiente código PLT-NNNN
async function siguienteCodigoPlanta() {
  const { data } = await supabase
    .from('plantas_electricas')
    .select('codigo')
    .ilike('codigo', 'PLT-%')
    .order('created_at', { ascending: false })
    .limit(1)
  const ultimo = data?.[0]?.codigo || 'PLT-0000'
  const num = parseInt(ultimo.replace('PLT-', ''), 10) || 0
  return `PLT-${String(num + 1).padStart(4, '0')}`
}

export async function crearPlanta(payload) {
  if (!payload?.nombre) throw new Error('nombre requerido')
  const codigo = payload.codigo || await siguienteCodigoPlanta()
  const limpio = {
    codigo,
    nombre: payload.nombre,
    cliente_id: payload.cliente_id || null,
    capacidad_mw: payload.capacidad_mw === '' || payload.capacidad_mw == null ? null : Number(payload.capacidad_mw),
    tipo_tecnologia: payload.tipo_tecnologia || null,
    ubicacion: payload.ubicacion || null,
    estado_geo: payload.estado_geo || null,
    coordenadas: payload.coordenadas || null,
    estado: payload.estado || 'Planeacion',
    fecha_operacion_comercial: payload.fecha_operacion_comercial || null,
    punto_interconexion: payload.punto_interconexion || null,
    voltaje_kv: payload.voltaje_kv === '' || payload.voltaje_kv == null ? null : Number(payload.voltaje_kv),
    notas: payload.notas || null,
  }
  const { data, error } = await supabase
    .from('plantas_electricas')
    .insert(limpio)
    .select('*, cliente:clientes(id, razon_social)')
    .single()
  if (error) throw error
  return data
}

export async function actualizarPlanta(id, cambios) {
  if (!id) throw new Error('id requerido')
  // Limpiar valores vacíos a null donde aplique (numéricos)
  const limpio = { ...cambios }
  if ('capacidad_mw' in limpio) limpio.capacidad_mw = limpio.capacidad_mw === '' || limpio.capacidad_mw == null ? null : Number(limpio.capacidad_mw)
  if ('voltaje_kv' in limpio) limpio.voltaje_kv = limpio.voltaje_kv === '' || limpio.voltaje_kv == null ? null : Number(limpio.voltaje_kv)
  const { data, error } = await supabase
    .from('plantas_electricas')
    .update(limpio)
    .eq('id', id)
    .select('*, cliente:clientes(id, razon_social)')
    .single()
  if (error) throw error
  return data
}

export async function eliminarPlanta(id) {
  if (!id) throw new Error('id requerido')
  const { error } = await supabase.from('plantas_electricas').delete().eq('id', id)
  if (error) throw error
}

// ============================================================
// v15.8.3 — Helpers de eliminar / crear faltantes
// (solo direccion según puedeEliminar; la UI controla visibilidad)
// ============================================================

export async function eliminarProyecto(id) {
  if (!id) throw new Error('id requerido')
  // Las actividades, hitos, notas se eliminan en cascada por la FK on delete cascade
  const { error } = await supabase.from('proyectos').delete().eq('id', id)
  if (error) throw error
}

export async function eliminarCotizacion(id) {
  if (!id) throw new Error('id requerido')
  // Los items se eliminan en cascada
  const { error } = await supabase.from('cotizaciones').delete().eq('id', id)
  if (error) throw error
}

export async function eliminarFactura(id) {
  if (!id) throw new Error('id requerido')
  const { error } = await supabase.from('facturas').delete().eq('id', id)
  if (error) throw error
}

export async function eliminarCompra(id) {
  if (!id) throw new Error('id requerido')
  const { error } = await supabase.from('compras').delete().eq('id', id)
  if (error) throw error
}

export async function eliminarHito(id) {
  if (!id) throw new Error('id requerido')
  const { error } = await supabase.from('hitos_cobranza').delete().eq('id', id)
  if (error) throw error
}

export async function crearHito(payload) {
  if (!payload?.proyecto_id || !payload?.descripcion) throw new Error('proyecto_id y descripción requeridos')
  const limpio = {
    proyecto_id: payload.proyecto_id,
    descripcion: payload.descripcion,
    monto: Number(payload.monto || 0),
    estado: payload.estado || 'Pendiente',
    fecha_vencimiento: payload.fecha_vencimiento || null,
    fecha_pago: payload.fecha_pago || null,
  }
  const { data, error } = await supabase
    .from('hitos_cobranza')
    .insert(limpio)
    .select('*')
    .single()
  if (error) throw error
  return data
}

// ============================================================
// STORAGE DE DOCUMENTOS (v16.0.0) — bucket privado proyectos-docs
// Path convention: {scope}/{scopeId}/{categoria}/{timestamp}_{nombre}
// scope     ∈ ('proyectos', 'plantas', 'clientes')
// categoria ∈ ('contratos', 'planos', 'entregables', 'fotos', 'facturas', 'permisos')
// ============================================================

const DOCS_BUCKET = 'proyectos-docs'

export const DOC_CATEGORIAS = [
  { k: 'contratos',   l: 'Contratos',   icon: '📝' },
  { k: 'planos',      l: 'Planos',      icon: '📐' },
  { k: 'entregables', l: 'Entregables', icon: '📦' },
  { k: 'fotos',       l: 'Fotos',       icon: '📷' },
  { k: 'facturas',    l: 'Facturas',    icon: '🧾' },
  { k: 'permisos',    l: 'Permisos',    icon: '📑' },
]

const SCOPES_VALIDOS = new Set(['proyectos', 'plantas', 'clientes'])
const CATEGORIAS_VALIDAS = new Set(DOC_CATEGORIAS.map(c => c.k))

function _validarScope(scope, scopeId, categoria) {
  if (!SCOPES_VALIDOS.has(scope)) throw new Error(`scope inválido: ${scope}`)
  if (!UUID_REGEX.test(String(scopeId))) throw new Error('scopeId inválido (debe ser UUID)')
  if (categoria != null && !CATEGORIAS_VALIDAS.has(categoria)) throw new Error(`categoría inválida: ${categoria}`)
}

// Sanea el nombre del archivo: solo letras/dígitos/punto/guion/underscore
function _sanitizarNombre(name) {
  return String(name).replace(/[^\w.\-]/g, '_').slice(0, 200)
}

// v16.6.0: derivar extensión del MIME type (server-verifiable) en lugar del
// nombre del cliente. Defense in depth — el bucket ya tiene allowed_mime_types
// whitelist, esto solo asegura que el path final no tenga una extensión engañosa
// (ej. `evil.svg.exe` queda como `<ts>_evil_svg.bin`).
const MIME_TO_EXT = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/zip': 'zip', 'application/x-zip-compressed': 'zip',
  'text/plain': 'txt', 'text/csv': 'csv',
}
function _extDesdeMime(mime) {
  return MIME_TO_EXT[(mime || '').toLowerCase()] || 'bin'
}
// Quita la extensión final del nombre del archivo (para no duplicarla en el path).
function _basename(name) {
  const sin = String(name).replace(/\.[^.]+$/, '')
  return sin || 'archivo'
}

export async function uploadDoc({ scope, scopeId, categoria, file }) {
  _validarScope(scope, scopeId, categoria)
  if (!file) throw new Error('file es requerido')
  // v16.6.0: ext desde MIME (no desde file.name); base sin extensión + sanitizado
  const base = _sanitizarNombre(_basename(file.name))
  const ext = _extDesdeMime(file.type)
  const path = `${scope}/${scopeId}/${categoria}/${Date.now()}_${base}.${ext}`
  const { data, error } = await supabase.storage.from(DOCS_BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type || 'application/octet-stream',
  })
  if (error) throw error
  return { path: data.path, name: file.name, size: file.size, type: file.type }
}

// Lista todos los archivos por categoría para un recurso. Retorna {categoria: [files]}
export async function listDocs(scope, scopeId) {
  _validarScope(scope, scopeId)
  const result = {}
  for (const cat of DOC_CATEGORIAS) {
    const { data, error } = await supabase.storage.from(DOCS_BUCKET).list(
      `${scope}/${scopeId}/${cat.k}`,
      { limit: 200, sortBy: { column: 'created_at', order: 'desc' } }
    )
    if (error && error.statusCode !== 404 && error.statusCode !== '404') {
      console.warn(`listDocs ${cat.k}:`, error)
    }
    result[cat.k] = (data || []).filter(f => f.id != null)  // filtrar carpetas/placeholder
  }
  return result
}

export async function getSignedDocUrl(path, expiresIn = 3600) {
  if (!path) throw new Error('path requerido')
  const { data, error } = await supabase.storage.from(DOCS_BUCKET).createSignedUrl(path, expiresIn)
  if (error) throw error
  return data.signedUrl
}

export async function deleteDoc(path) {
  if (!path) throw new Error('path requerido')
  const { error } = await supabase.storage.from(DOCS_BUCKET).remove([path])
  if (error) throw error
}

// Helper de descarga: abre el archivo en una nueva pestaña con signed URL.
export async function downloadDoc(path, filename) {
  const url = await getSignedDocUrl(path, 60)  // 1 min, suficiente para click
  const a = document.createElement('a')
  a.href = url
  if (filename) a.download = filename
  a.target = '_blank'
  a.rel = 'noopener noreferrer'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

// ============================================================
// PRICING ENGINE v15.7 (MVP) — tabla precios_servicios
// 16 servicios × 9 rangos de capacidad MW × 2 tipos (CC, CE).
// El factor de inflación es opcional vía toggle en UI: precio * 1.05^años.
// ============================================================

export const PRICING_TIPOS = [
  { k: 'CC', l: 'Centro de Carga (CC)' },
  { k: 'CE', l: 'Central Eléctrica (CE)' },
]

// Cache simple en memoria (evita hits a BD repetidos en una sesión)
let _preciosCache = null
let _preciosCachePromise = null

export async function getPreciosServicios(forceRefresh = false) {
  if (!forceRefresh && _preciosCache) return _preciosCache
  if (_preciosCachePromise) return _preciosCachePromise
  _preciosCachePromise = supabase
    .from('precios_servicios')
    .select('servicio, tipo, capacidad_min_mw, capacidad_max_mw, precio')
    .order('servicio')
    .order('capacidad_min_mw')
    .then(({ data, error }) => {
      _preciosCachePromise = null
      if (error) throw error
      _preciosCache = data || []
      return _preciosCache
    })
  return _preciosCachePromise
}

// Lista de servicios distintos para el dropdown (filtrados por tipo)
export function listarServiciosPricing(precios, tipo) {
  if (!precios || !tipo) return []
  const set = new Set()
  precios.forEach(p => { if (p.tipo === tipo) set.add(p.servicio) })
  return [...set].sort()
}

// Busca el precio que aplica a (servicio, tipo, capacidad MW). Aplica inflación si pide.
// Retorna {precio, rango: {min, max}} o null si no hay match.
export function buscarPrecioServicio(precios, { servicio, tipo, capacidadMw, conInflacion = false, anios = 0, factorAnual = 0.05 }) {
  if (!precios || !servicio || !tipo || capacidadMw == null || isNaN(capacidadMw)) return null
  const cap = Number(capacidadMw)
  // Buscar la fila cuyo rango incluya capacidadMw
  const match = precios.find(p =>
    p.servicio === servicio &&
    p.tipo === tipo &&
    cap >= Number(p.capacidad_min_mw) &&
    (p.capacidad_max_mw == null || cap <= Number(p.capacidad_max_mw))
  )
  if (!match) return null
  let precio = Number(match.precio)
  if (conInflacion && anios > 0) {
    precio = precio * Math.pow(1 + factorAnual, anios)
  }
  return {
    precio: Math.round(precio),
    rango: {
      min: Number(match.capacidad_min_mw),
      max: match.capacidad_max_mw == null ? null : Number(match.capacidad_max_mw),
    },
  }
}

// ============================================================
// WORKFLOW POST-CIERRE v16.1
// Tabla tareas_post_cierre: 3 tareas (legal/admin/proyectos) que se crean
// automáticamente cuando una cotización pasa a "Aprobada" (vía trigger SQL).
// Validación previa: el cliente debe tener RFC + dirección fiscal.
// ============================================================

export const DEPARTAMENTOS_POST_CIERRE = [
  { k: 'legal',     l: 'Legal',          icon: '⚖️', color: '#7C3AED' },  // purple
  { k: 'admin',     l: 'Administración', icon: '📋', color: '#EA580C' },  // orange
  { k: 'proyectos', l: 'Proyectos',      icon: '🛠️', color: '#0F6E56' },  // teal (Row green)
]

export const ESTADOS_TAREA_PC = {
  pendiente:  { l: 'Pendiente',  color: '#64748B', bg: '#F1F5F9' },
  en_curso:   { l: 'En curso',   color: '#0F6E56', bg: '#E1F5EE' },
  completada: { l: 'Completada', color: '#16A34A', bg: '#F0FDF4' },
  vencida:    { l: 'Vencida',    color: '#DC2626', bg: '#FEF2F2' },
}

// Lista las tareas post-cierre de UNA cotización.
export async function getTareasPostCierre(cotizacionId) {
  if (!cotizacionId || !UUID_REGEX.test(String(cotizacionId))) return []
  const { data, error } = await supabase
    .from('tareas_post_cierre')
    .select(`
      *,
      asignado:usuarios!asignado_a(id, nombre, email),
      completada_por_user:usuarios!completada_por(id, nombre)
    `)
    .eq('cotizacion_id', cotizacionId)
    .order('departamento')
  if (error) throw error
  // Marcar visualmente las vencidas (status=vencida si pendiente y fecha_limite < hoy)
  const hoy = new Date().toISOString().split('T')[0]
  return (data || []).map(t => ({
    ...t,
    esta_vencida: t.estado === 'pendiente' && t.fecha_limite < hoy,
  }))
}

// Lista las tareas pendientes/vencidas que le corresponden al usuario actual
// (por asignación o por rol del departamento). Usado para Bandeja Dashboard.
export async function getTareasPostCierrePendientes(usuarioId) {
  if (!usuarioId || !UUID_REGEX.test(String(usuarioId))) return []
  const { data, error } = await supabase
    .from('tareas_post_cierre')
    .select(`
      *,
      cotizacion:cotizaciones(id, codigo, nombre_proyecto, cliente:clientes(razon_social))
    `)
    .in('estado', ['pendiente', 'en_curso'])
    .order('fecha_limite', { ascending: true })
  if (error) throw error
  const hoy = new Date().toISOString().split('T')[0]
  return (data || []).map(t => ({
    ...t,
    esta_vencida: t.fecha_limite < hoy,
  }))
}

// Marca una tarea como completada. Opcionalmente recibe un archivo entregable
// que se sube al bucket proyectos-docs y se asocia a la tarea.
export async function completarTareaPostCierre(tareaId, { notas, archivo, cotizacionId } = {}) {
  if (!tareaId || !UUID_REGEX.test(String(tareaId))) throw new Error('tareaId inválido')
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')
  const { data: usuarioRow } = await supabase.from('usuarios').select('id').eq('email', user.email.toLowerCase()).single()

  let archivoPath = null
  if (archivo && cotizacionId) {
    // Subir el entregable al bucket de docs en categoría 'contratos' (la más natural para los entregables del workflow)
    const safe = _sanitizarNombre(archivo.name)
    const path = `cotizaciones/${cotizacionId}/contratos/${Date.now()}_${safe}`
    const { data, error } = await supabase.storage.from(DOCS_BUCKET).upload(path, archivo, {
      upsert: false, contentType: archivo.type || 'application/octet-stream',
    })
    if (error) throw error
    archivoPath = data.path
  }

  const update = {
    estado: 'completada',
    completada_en: new Date().toISOString(),
    completada_por: usuarioRow?.id || null,
    updated_at: new Date().toISOString(),
  }
  if (archivoPath) update.archivo_path = archivoPath
  if (notas != null) update.notas = notas

  const { data, error } = await supabase
    .from('tareas_post_cierre')
    .update(update)
    .eq('id', tareaId)
    .select()
    .single()
  if (error) throw error
  return data
}

// Asignar/reasignar manualmente
export async function asignarTareaPostCierre(tareaId, usuarioId) {
  if (!tareaId || !UUID_REGEX.test(String(tareaId))) throw new Error('tareaId inválido')
  const { data, error } = await supabase
    .from('tareas_post_cierre')
    .update({ asignado_a: usuarioId, updated_at: new Date().toISOString() })
    .eq('id', tareaId)
    .select().single()
  if (error) throw error
  return data
}

// Aprobar el workflow completo (Ventas confirma que las 3 tareas están bien)
// Esto desbloquea la generación del calendario de cobranza.
export async function aprobarWorkflowPostCierre(cotizacionId) {
  if (!cotizacionId || !UUID_REGEX.test(String(cotizacionId))) throw new Error('cotizacionId inválido')
  // Verificar que las 3 tareas estén completadas
  const tareas = await getTareasPostCierre(cotizacionId)
  const incompletas = tareas.filter(t => t.estado !== 'completada')
  if (incompletas.length > 0) {
    throw new Error(`Faltan ${incompletas.length} tarea(s) por completar: ${incompletas.map(t => t.departamento).join(', ')}`)
  }
  const { data: { user } } = await supabase.auth.getUser()
  const { data: usuarioRow } = await supabase.from('usuarios').select('id').eq('email', user.email.toLowerCase()).single()

  const { data, error } = await supabase
    .from('cotizaciones')
    .update({
      workflow_aprobado_en: new Date().toISOString(),
      workflow_aprobado_por: usuarioRow?.id || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', cotizacionId)
    .select().single()
  if (error) throw error
  return data
}