// ============================================================
// alertas.js — v12.5.9c
// Generador de alertas del sistema Row Energy OS
//
// API:
//   - generarAlertas(...)            → alertas AGRUPADAS (banner Dashboard)
//   - generarAlertasDetalladas(...)  → 1 alerta por item específico (Centro de Alertas)
//
// Alertas filtradas por owner para roles operativos:
//   - ventas → solo sus leads y cotizaciones
//   - cobranza → todo (es su responsabilidad transversal)
//   - equipo_proyectos → solo sus actividades
// ============================================================

import { COLORS } from './helpers'

// Roles operativos que solo ven sus propios registros
const ROLES_OPERATIVOS = ['ventas', 'equipo_proyectos']

// ============================================================
// GENERADOR PRINCIPAL — agrupado (banner Dashboard, sin cambios)
// ============================================================
export function generarAlertas({ usuario, config, facturas = [], actividades = [], proyectos = [], cxp = [], leads = [], cotizaciones = [], carga = [] }) {
  if (!config) return []
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const alertas = []
  const filtrar = ROLES_OPERATIVOS.includes(usuario?.rol)

  // ---------- Facturas vencidas ----------
  if (config.facturas_vencidas) {
    const vencidas = facturas.filter(f => {
      if (f.estado !== 'Emitida' || !f.fecha_vencimiento) return false
      return new Date(f.fecha_vencimiento) < hoy
    })
    if (vencidas.length > 0) {
      const total = vencidas.reduce((s, f) => s + Number(f.total || 0), 0)
      alertas.push({
        id: 'facturas_vencidas',
        tipo: 'facturas_vencidas',
        severidad: 'critica',
        mensaje: `${vencidas.length} factura(s) vencida(s) por ${fmtCorto(total)}`,
        modulo: 'cobranza',
        modulo_ruta: '/cobranza',
        fecha: hoy.toISOString(),
        data: vencidas.slice(0, 5),
      })
    }
  }

  // ---------- Actividades retrasadas ----------
  if (config.actividades_retrasadas) {
    let retrasadas = actividades.filter(a => {
      if (['Completada', 'Cancelada'].includes(a.estado)) return false
      if (!a.fin) return false
      return new Date(a.fin) < hoy
    })
    if (filtrar) {
      retrasadas = retrasadas.filter(a => a.responsable_id === usuario.id || a.asignado_id === usuario.id)
    }
    if (retrasadas.length > 0) {
      alertas.push({
        id: 'actividades_retrasadas',
        tipo: 'actividades_retrasadas',
        severidad: 'importante',
        mensaje: filtrar
          ? `Tienes ${retrasadas.length} actividad(es) retrasada(s)`
          : `${retrasadas.length} actividad(es) retrasada(s) en proyectos`,
        modulo: 'proyectos',
        modulo_ruta: '/proyectos',
        fecha: hoy.toISOString(),
        data: retrasadas.slice(0, 10),
      })
    }
  }

  // ---------- Actividades bloqueadas ----------
  if (config.actividades_bloqueadas) {
    let bloqueadas = actividades.filter(a => a.estado === 'Bloqueada')
    if (filtrar) {
      bloqueadas = bloqueadas.filter(a => a.responsable_id === usuario.id || a.asignado_id === usuario.id)
    }
    if (bloqueadas.length > 0) {
      alertas.push({
        id: 'actividades_bloqueadas',
        tipo: 'actividades_bloqueadas',
        severidad: 'importante',
        mensaje: filtrar
          ? `Tienes ${bloqueadas.length} actividad(es) bloqueada(s)`
          : `${bloqueadas.length} actividad(es) bloqueada(s) en proyectos`,
        modulo: 'proyectos',
        modulo_ruta: '/proyectos',
        fecha: hoy.toISOString(),
        data: bloqueadas.slice(0, 10),
      })
    }
  }

  // ---------- Proyectos con cierre próximo ----------
  if (config.proyectos_cierre_proximo) {
    const proximos = proyectos.filter(p => {
      if (!p.cierre || p.estado === 'Terminado' || p.estado === 'Cancelado') return false
      const dias = Math.ceil((new Date(p.cierre) - hoy) / 86400000)
      return dias >= 0 && dias <= 30
    })
    if (proximos.length > 0) {
      alertas.push({
        id: 'proyectos_cierre_proximo',
        tipo: 'proyectos_cierre_proximo',
        severidad: 'importante',
        mensaje: `${proximos.length} proyecto(s) con cierre en los próximos 30 días`,
        modulo: 'proyectos',
        modulo_ruta: '/proyectos',
        fecha: hoy.toISOString(),
        data: proximos.slice(0, 10),
      })
    }
  }

  // ---------- CxP sin autorizar con fecha próxima (<=3 días) ----------
  if (config.cxp_autorizacion_pendiente) {
    const pendientes = cxp.filter(c => {
      if (c.autorizado || c.estado === 'Pagado' || c.estado === 'Cancelado') return false
      if (!c.fecha_pago) return false
      const dias = Math.ceil((new Date(c.fecha_pago) - hoy) / 86400000)
      return dias <= 3
    })
    if (pendientes.length > 0) {
      const total = pendientes.reduce((s, c) => s + Number(c.monto || 0), 0)
      alertas.push({
        id: 'cxp_autorizacion_pendiente',
        tipo: 'cxp_autorizacion_pendiente',
        severidad: 'critica',
        mensaje: `${pendientes.length} cuenta(s) por pagar sin autorizar (${fmtCorto(total)}) con fecha próxima`,
        modulo: 'compras',
        modulo_ruta: '/compras',
        fecha: hoy.toISOString(),
        data: pendientes.slice(0, 10),
      })
    }
  }

  // ---------- Leads sin actividad reciente (>7 días) ----------
  if (config.leads_sin_actividad) {
    const hace7dias = new Date(hoy); hace7dias.setDate(hoy.getDate() - 7)
    let inactivos = leads.filter(l => {
      if (['Ganado', 'Perdido'].includes(l.etapa)) return false
      const ultima = l.updated_at || l.created_at
      if (!ultima) return false
      return new Date(ultima) < hace7dias
    })
    if (filtrar) {
      inactivos = inactivos.filter(l => l.owner_id === usuario.id)
    }
    if (inactivos.length > 0) {
      alertas.push({
        id: 'leads_sin_actividad',
        tipo: 'leads_sin_actividad',
        severidad: 'info',
        mensaje: filtrar
          ? `${inactivos.length} de tus leads sin actividad en 7+ días`
          : `${inactivos.length} lead(s) sin actividad en 7+ días`,
        modulo: 'leads',
        modulo_ruta: '/leads',
        fecha: hoy.toISOString(),
        data: inactivos.slice(0, 10),
      })
    }
  }

  // ---------- Cotizaciones sin respuesta (>5 días enviadas) ----------
  if (config.cotizaciones_sin_respuesta) {
    const hace5dias = new Date(hoy); hace5dias.setDate(hoy.getDate() - 5)
    let sinRespuesta = cotizaciones.filter(c => {
      if (!['Enviada', 'En revisión'].includes(c.estado)) return false
      const ultima = c.updated_at || c.created_at
      if (!ultima) return false
      return new Date(ultima) < hace5dias
    })
    if (filtrar) {
      sinRespuesta = sinRespuesta.filter(c => c.vendedor_id === usuario.id)
    }
    if (sinRespuesta.length > 0) {
      alertas.push({
        id: 'cotizaciones_sin_respuesta',
        tipo: 'cotizaciones_sin_respuesta',
        severidad: 'info',
        mensaje: filtrar
          ? `${sinRespuesta.length} de tus cotizaciones sin respuesta en 5+ días`
          : `${sinRespuesta.length} cotización(es) sin respuesta en 5+ días`,
        modulo: 'cotizaciones',
        modulo_ruta: '/cotizaciones',
        fecha: hoy.toISOString(),
        data: sinRespuesta.slice(0, 10),
      })
    }
  }

  // ---------- Colaboradores sobrecargados ----------
  if (config.colaborador_sobrecargado) {
    const sobrecargados = carga.filter(c => c.sobrecargado)
    if (sobrecargados.length > 0) {
      alertas.push({
        id: 'colaborador_sobrecargado',
        tipo: 'colaborador_sobrecargado',
        severidad: 'importante',
        mensaje: `${sobrecargados.length} colaborador(es) sobrecargado(s) esta semana`,
        modulo: 'dashboard',
        modulo_ruta: '/',
        fecha: hoy.toISOString(),
        data: sobrecargados.slice(0, 10),
      })
    }
  }

  // Orden: crítica → importante → info
  const orden = { critica: 0, importante: 1, info: 2 }
  alertas.sort((a, b) => orden[a.severidad] - orden[b.severidad])
  return alertas
}

// ============================================================
// GENERADOR DETALLADO — 1 item por alerta (Centro de Alertas)
// Reutiliza generarAlertas() y "explota" cada grupo en items
// individuales con metadatos para drill-down.
// ============================================================
export function generarAlertasDetalladas(params) {
  const grupos = generarAlertas(params)
  const usuariosMap = (params.usuarios || []).reduce((acc, u) => { acc[u.id] = u; return acc }, {})
  const items = []

  grupos.forEach(grupo => {
    const data = grupo.data || []

    if (grupo.tipo === 'facturas_vencidas') {
      data.forEach(f => {
        const dias = diasDesde(f.fecha_vencimiento)
        items.push({
          id: `factura-vencida-${f.id}`,
          categoria: 'facturas_vencidas',
          severidad: 'critica',
          titulo: `Factura ${f.folio || f.id?.slice(0, 8)}`,
          detalle: `${dias} día${dias !== 1 ? 's' : ''} de retraso · ${fmtCorto(f.total || 0)}`,
          contexto: f.cliente_nombre || f.cliente?.razon_social || '',
          modulo: 'facturacion',
          modulo_ruta: `/facturacion?factura=${f.id}`,
          entidad_id: f.id,
          fecha_relevante: f.fecha_vencimiento,
        })
      })
    } else if (grupo.tipo === 'actividades_retrasadas' || grupo.tipo === 'actividades_bloqueadas') {
      data.forEach(a => {
        const responsable = usuariosMap[a.responsable_id]?.nombre || a.responsable_nombre || 'Sin asignar'
        const proyectoCodigo = a.proyecto?.codigo || a.proyecto_codigo || ''
        const proyectoNombre = a.proyecto?.nombre || ''
        const detalle = grupo.tipo === 'actividades_retrasadas'
          ? `${diasDesde(a.fin)} día(s) de retraso`
          : 'Bloqueada'
        items.push({
          id: `${grupo.tipo}-${a.id}`,
          categoria: grupo.tipo,
          severidad: 'importante',
          titulo: a.nombre || a.titulo || `Actividad ${a.numero || ''}`,
          detalle,
          contexto: `${proyectoCodigo}${proyectoNombre ? ' · ' + proyectoNombre : ''} · ${responsable}`.trim(),
          modulo: 'proyectos',
          modulo_ruta: a.proyecto?.id ? `/proyectos?proyecto=${a.proyecto.id}&actividad=${a.id}` : '/proyectos',
          entidad_id: a.proyecto?.id || a.proyecto_id,
          entidad_secundaria_id: a.id,
          fecha_relevante: a.fin,
        })
      })
    } else if (grupo.tipo === 'proyectos_cierre_proximo') {
      data.forEach(p => {
        const dias = diasHasta(p.cierre)
        items.push({
          id: `proyecto-cierre-${p.id}`,
          categoria: 'proyectos_cierre_proximo',
          severidad: 'importante',
          titulo: p.nombre || `Proyecto ${p.codigo || ''}`,
          detalle: `Cierre en ${dias} día${dias !== 1 ? 's' : ''}`,
          contexto: `${p.codigo || ''}${p.cliente?.razon_social ? ' · ' + p.cliente.razon_social : ''}`.trim(),
          modulo: 'proyectos',
          modulo_ruta: `/proyectos?proyecto=${p.id}`,
          entidad_id: p.id,
          fecha_relevante: p.cierre,
        })
      })
    } else if (grupo.tipo === 'cxp_autorizacion_pendiente') {
      data.forEach(c => {
        const dias = diasHasta(c.fecha_pago)
        const detalle = dias < 0
          ? `Vencida hace ${Math.abs(dias)} día${Math.abs(dias) !== 1 ? 's' : ''}`
          : dias === 0 ? 'Vence hoy' : `Vence en ${dias} día${dias !== 1 ? 's' : ''}`
        items.push({
          id: `cxp-${c.id}`,
          categoria: 'cxp_autorizacion_pendiente',
          severidad: 'critica',
          titulo: `${c.proveedor || 'CxP'} · ${fmtCorto(c.monto || 0)}`,
          detalle,
          contexto: c.concepto || c.referencia || '',
          modulo: 'compras',
          modulo_ruta: `/compras?cxp=${c.id}`,
          entidad_id: c.id,
          fecha_relevante: c.fecha_pago,
        })
      })
    } else if (grupo.tipo === 'leads_sin_actividad') {
      data.forEach(l => {
        const dias = diasDesde(l.updated_at || l.created_at)
        items.push({
          id: `lead-${l.id}`,
          categoria: 'leads_sin_actividad',
          severidad: 'info',
          titulo: l.nombre || l.empresa || 'Lead',
          detalle: `${dias} día(s) sin actividad`,
          contexto: l.etapa || '',
          modulo: 'leads',
          modulo_ruta: `/leads?lead=${l.id}`,
          entidad_id: l.id,
          fecha_relevante: l.updated_at || l.created_at,
        })
      })
    } else if (grupo.tipo === 'cotizaciones_sin_respuesta') {
      data.forEach(c => {
        const dias = diasDesde(c.updated_at || c.created_at)
        items.push({
          id: `cot-${c.id}`,
          categoria: 'cotizaciones_sin_respuesta',
          severidad: 'info',
          titulo: c.codigo || c.folio || `Cotización ${c.id?.slice(0, 8)}`,
          detalle: `${dias} día(s) sin respuesta · ${fmtCorto(c.total || c.monto || 0)}`,
          contexto: c.cliente?.razon_social || c.cliente_nombre || '',
          modulo: 'cotizaciones',
          modulo_ruta: `/cotizaciones?cotizacion=${c.id}`,
          entidad_id: c.id,
          fecha_relevante: c.updated_at || c.created_at,
        })
      })
    } else if (grupo.tipo === 'colaborador_sobrecargado') {
      data.forEach(c => {
        const u = c.usuario || c
        items.push({
          id: `sobrecarga-${u.id}`,
          categoria: 'colaborador_sobrecargado',
          severidad: 'importante',
          titulo: u.nombre || 'Colaborador',
          detalle: `${c.porcentaje || 0}% de carga · ${c.horasSemana || 0}h asignadas`,
          contexto: `${c.asignadas || 0} actividad(es) esta semana`,
          modulo: 'dashboard',
          modulo_ruta: '/',
          entidad_id: u.id,
          fecha_relevante: null,
        })
      })
    }
  })

  // Orden: severidad → fecha más reciente
  const orden = { critica: 0, importante: 1, info: 2 }
  items.sort((a, b) => {
    const dif = orden[a.severidad] - orden[b.severidad]
    if (dif !== 0) return dif
    if (a.fecha_relevante && b.fecha_relevante) {
      return new Date(a.fecha_relevante) - new Date(b.fecha_relevante)
    }
    return 0
  })

  return items
}

// ============================================================
// AGRUPADOR para Centro de Alertas (por categoría)
// ============================================================
export function agruparPorCategoria(items) {
  const grupos = {}
  items.forEach(item => {
    if (!grupos[item.categoria]) {
      grupos[item.categoria] = {
        categoria: item.categoria,
        label: ETIQUETAS_ALERTAS[item.categoria]?.label || item.categoria,
        descripcion: ETIQUETAS_ALERTAS[item.categoria]?.descripcion || '',
        icono: ICONOS_ALERTAS[item.categoria] || '📌',
        severidad_mas_alta: item.severidad,
        items: [],
      }
    }
    grupos[item.categoria].items.push(item)
    // Severidad más alta del grupo
    const orden = { critica: 0, importante: 1, info: 2 }
    if (orden[item.severidad] < orden[grupos[item.categoria].severidad_mas_alta]) {
      grupos[item.categoria].severidad_mas_alta = item.severidad
    }
  })
  // Ordenar grupos por severidad más alta del grupo
  const orden = { critica: 0, importante: 1, info: 2 }
  return Object.values(grupos).sort(
    (a, b) => orden[a.severidad_mas_alta] - orden[b.severidad_mas_alta]
  )
}

// ============================================================
// HELPERS VISUALES
// ============================================================
export function colorAlerta(severidad) {
  switch (severidad) {
    case 'critica':    return COLORS.red
    case 'importante': return COLORS.amber
    case 'info':       return COLORS.navy2 || COLORS.navy
    default:           return COLORS.slate500
  }
}

export function bgAlerta(severidad) {
  switch (severidad) {
    case 'critica':    return '#FEF2F2'
    case 'importante': return '#FEF3C7'
    case 'info':       return '#E0EDFF'
    default:           return COLORS.slate50
  }
}

export function labelSeveridad(severidad) {
  switch (severidad) {
    case 'critica':    return 'Crítica'
    case 'importante': return 'Importante'
    case 'info':       return 'Info'
    default:           return ''
  }
}

// Etiquetas legibles de cada tipo de alerta
export const ETIQUETAS_ALERTAS = {
  facturas_vencidas:             { label: 'Facturas vencidas', descripcion: 'Clientes que pasaron su fecha de pago' },
  actividades_retrasadas:        { label: 'Actividades retrasadas', descripcion: 'Tareas de proyectos con fin vencido' },
  actividades_bloqueadas:        { label: 'Actividades bloqueadas', descripcion: 'Tareas marcadas como Bloqueada' },
  proyectos_cierre_proximo:      { label: 'Cierre de proyecto próximo', descripcion: 'Proyectos que cerrarán en los próximos 30 días' },
  cxp_autorizacion_pendiente:    { label: 'Cuentas por pagar sin autorizar', descripcion: 'Pagos próximos (≤3 días) sin tu autorización' },
  leads_sin_actividad:           { label: 'Leads sin actividad', descripcion: 'Leads sin movimiento en más de 7 días' },
  cotizaciones_sin_respuesta:    { label: 'Cotizaciones sin respuesta', descripcion: 'Cotizaciones enviadas sin respuesta en 5+ días' },
  colaborador_sobrecargado:      { label: 'Colaborador sobrecargado', descripcion: 'Miembros del equipo con >100% carga' },
}

// Iconos emoji por categoría (para Centro de Alertas)
export const ICONOS_ALERTAS = {
  facturas_vencidas:             '💰',
  actividades_retrasadas:        '⏰',
  actividades_bloqueadas:        '🚧',
  proyectos_cierre_proximo:      '🎯',
  cxp_autorizacion_pendiente:    '💸',
  leads_sin_actividad:           '🌱',
  cotizaciones_sin_respuesta:    '📑',
  colaborador_sobrecargado:      '👥',
}

// ============================================================
// HELPERS DE FECHAS
// ============================================================
function diasDesde(fechaStr) {
  if (!fechaStr) return 0
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const f = new Date(fechaStr); f.setHours(0, 0, 0, 0)
  return Math.max(0, Math.ceil((hoy - f) / 86400000))
}

function diasHasta(fechaStr) {
  if (!fechaStr) return 0
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const f = new Date(fechaStr); f.setHours(0, 0, 0, 0)
  return Math.ceil((f - hoy) / 86400000)
}

function fmtCorto(n) {
  const num = Number(n) || 0
  if (Math.abs(num) >= 1000000) return '$' + (num/1000000).toFixed(1) + 'M'
  if (Math.abs(num) >= 1000) return '$' + (num/1000).toFixed(0) + 'k'
  return '$' + num.toLocaleString('es-MX')
}