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
    .select(`*, cliente:clientes(id, razon_social, codigo), director:usuarios!director_id(id, nombre)`)
    .order('created_at', { ascending: false })
  if (error) { console.error('getProyectos:', error); return [] }
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
  const { count } = await supabase.from('proyectos').select('*', { count: 'exact', head: true })
  const codigo = `PRY-${String((count || 0) + 1).padStart(3, '0')}`
  const plantillaActs = await getPlantillaActividades(plantillaId)
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

export async function actualizarActividad(id, cambios) {
  const { data, error } = await supabase.from('actividades').update({ ...cambios, updated_at: new Date().toISOString() }).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function eliminarActividad(id) {
  const { error } = await supabase.from('actividades').delete().eq('id', id)
  if (error) throw error
}

export async function crearActividad(proyectoId, actividad) {
  const { count } = await supabase.from('actividades').select('*', { count: 'exact', head: true }).eq('proyecto_id', proyectoId)
  const { data, error } = await supabase.from('actividades').insert({ ...actividad, proyecto_id: proyectoId, numero: (count || 0) + 1 }).select().single()
  if (error) throw error
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
      const nuevoInicio = new Date(maxFin)
      nuevoInicio.setDate(nuevoInicio.getDate() + 1)
      const duracionDias = Math.round((new Date(act.fin + 'T00:00:00') - new Date(act.inicio + 'T00:00:00')) / 86400000)
      const nuevoFin = new Date(nuevoInicio)
      nuevoFin.setDate(nuevoFin.getDate() + duracionDias)

      const nuevoInicioStr = nuevoInicio.toISOString().split('T')[0]
      const nuevoFinStr = nuevoFin.toISOString().split('T')[0]

      if (act.inicio !== nuevoInicioStr || act.fin !== nuevoFinStr) {
        cambios.push({ id: act.id, inicio: nuevoInicioStr, fin: nuevoFinStr })
        mapa[act.id].inicio = nuevoInicioStr
        mapa[act.id].fin = nuevoFinStr
      }
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
export async function getNotificaciones(usuarioId) {
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
  const { data } = await supabase.from('facturas').select(`*, cliente:clientes(id, razon_social), proyecto:proyectos(id, codigo, nombre)`).order('fecha_emision', { ascending: false })
  return data || []
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
// AGREGAR ESTAS FUNCIONES A tu src/supabase.js
// Al final del archivo, antes del último export si lo hay.
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
// v8: AGREGAR AL FINAL DE tu src/supabase.js
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
// v12 + v13.3 — AGREGAR AL FINAL DE tu src/supabase.js
// (copia TODO este bloque y pégalo al final del archivo)
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
// PATCH SUPABASE v12 — calcularCargaPorColaborador + identificarCuellosBotella
// ============================================================
//
// ERROR QUE ARREGLA:
//   Uncaught SyntaxError: The requested module '/src/supabase.js'
//   does not provide an export named 'calcularCargaPorColaborador'
//   (at Dashboard.jsx:4:10)
//
// CÓMO APLICAR:
//   1. Abre src/supabase.js
//   2. Ve hasta el FINAL del archivo (Cmd + flecha abajo)
//   3. Pega TODO este bloque (desde la línea "// ============")
//   4. Guarda (Cmd+S)
//   5. Vite recarga solo, la app vuelve a cargar
//
// NOTA:
//   Son funciones puras — no requieren tablas SQL nuevas.
//   Trabajan sobre las actividades y usuarios que ya cargas.
// ============================================================

// ============================================================
// v12: Cálculo de carga por colaborador (para VistaPersonas de Luis)
// ============================================================
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
    const activas = actsUsuario.filter(a => !['Completada','Cancelada'].includes(a.estado))
    const completadas = actsUsuario.filter(a => a.estado === 'Completada')

    // Horas consumidas esta semana: contar días traslapados con la semana actual × 8h
    let horasSemana = 0
    activas.forEach(a => {
      if (!a.inicio || !a.fin) return
      const ini = new Date(a.inicio); ini.setHours(0,0,0,0)
      const fin = new Date(a.fin); fin.setHours(23,59,59,999)
      // Intersección con [lunes, domingo)
      const interIni = ini > lunes ? ini : lunes
      const interFin = fin < domingo ? fin : new Date(domingo.getTime() - 1)
      if (interFin < interIni) return
      const diasTraslape = Math.max(1, Math.ceil((interFin - interIni) / (1000*60*60*24)))
      horasSemana += diasTraslape * 8 // 8h por día
    })
 

    const porcentaje = capacidad > 0 ? Math.round((horasSemana / capacidad) * 100) : 0
    const sobrecargado = porcentaje > 100
    const subutilizado = porcentaje < 50 && activas.length > 0

     // Tiempo promedio en actividades completadas
    // NOTA: Tu tabla 'actividades' no tiene columnas fecha_inicio_real/fecha_fin_real,
    // usamos inicio/fin como referencia de duración.
    let tiempoPromedioDias = null
    if (completadas.length > 0) {
      const dias = completadas.map(a => {
        if (!a.inicio || !a.fin) return null
        return Math.ceil((new Date(a.fin) - new Date(a.inicio)) / (1000*60*60*24))
      }).filter(d => d !== null && d > 0)
      if (dias.length > 0) {
        tiempoPromedioDias = Math.round(dias.reduce((s,d) => s+d, 0) / dias.length)
      }
    }
 
    // Desviación real vs estimado — por ahora es 0 porque no tenemos fechas reales separadas.
    // Si en el futuro agregas columnas fecha_inicio_real/fecha_fin_real a la tabla,
    // podemos calcular desviación aquí.
    let desviacionPct = 0

    return {
      usuario: u,
      asignadas: activas.length,
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
    const diasRetraso = Math.ceil((hoy - new Date(a.fin)) / (1000*60*60*24))
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