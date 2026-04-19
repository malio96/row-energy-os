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