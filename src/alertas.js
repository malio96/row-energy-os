// ============================================================
// alertas.js — v12.5.9
// Generador de alertas del sistema Row Energy OS
//
// Toma los datos ya cargados (facturas, actividades, etc) y
// el usuario actual (con su config), y devuelve las alertas
// que debe ver esa persona.
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
// GENERADOR PRINCIPAL
// ============================================================
// Uso:
//   const alertas = generarAlertas({
//     usuario: {...},            // usuario actual con .id, .rol
//     config: {...},             // alertas_config del usuario
//     facturas, actividades, proyectos, cxp, leads, cotizaciones, carga
//   })
//
// Retorna array:
//   [{ id, tipo, severidad, mensaje, modulo, modulo_ruta, fecha, data }, ...]
//   Ordenado por severidad (crítica → importante → info)
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
    // Cobranza ve todas las facturas (no filtramos)
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
    // Filtrar por owner si es rol operativo
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
        data: retrasadas.slice(0, 5),
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
    // No se filtra por owner (estratégico)
    if (proximos.length > 0) {
      alertas.push({
        id: 'proyectos_cierre_proximo',
        tipo: 'proyectos_cierre_proximo',
        severidad: 'importante',
        mensaje: `${proximos.length} proyecto(s) con cierre en los próximos 30 días`,
        modulo: 'proyectos',
        modulo_ruta: '/proyectos',
        fecha: hoy.toISOString(),
        data: proximos.slice(0, 5),
      })
    }
  }

  // ---------- CxP sin autorizar con fecha próxima (<=3 días) ----------
  if (config.cxp_autorizacion_pendiente) {
    const pendientes = cxp.filter(c => {
      if (c.autorizado || c.estado === 'Pagado' || c.estado === 'Cancelado') return false
      if (!c.fecha_pago) return false
      const dias = Math.ceil((new Date(c.fecha_pago) - hoy) / 86400000)
      return dias <= 3  // incluye las vencidas
    })
    if (pendientes.length > 0) {
      const total = pendientes.reduce((s, c) => s + Number(c.monto || 0), 0)
      alertas.push({
        id: 'cxp_autorizacion_pendiente',
        tipo: 'cxp_autorizacion_pendiente',
        severidad: 'critica',
        mensaje: `${pendientes.length} cuenta(s) por pagar sin autorizar (${fmtCorto(total)}) con fecha próxima`,
        modulo: 'dashboard',
        modulo_ruta: '/',
        fecha: hoy.toISOString(),
        data: pendientes.slice(0, 5),
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
        data: inactivos.slice(0, 5),
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
        data: sinRespuesta.slice(0, 5),
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
        data: sobrecargados.slice(0, 5),
      })
    }
  }

  // Orden: crítica → importante → info
  const orden = { critica: 0, importante: 1, info: 2 }
  alertas.sort((a, b) => orden[a.severidad] - orden[b.severidad])

  return alertas
}

// ============================================================
// HELPERS VISUALES
// ============================================================

// Color según severidad
export function colorAlerta(severidad) {
  switch (severidad) {
    case 'critica':    return COLORS.red
    case 'importante': return COLORS.amber
    case 'info':       return COLORS.navy2 || COLORS.navy
    default:           return COLORS.slate500
  }
}

// Background suave según severidad
export function bgAlerta(severidad) {
  switch (severidad) {
    case 'critica':    return '#FEF2F2'
    case 'importante': return '#FEF3C7'
    case 'info':       return '#E0EDFF'
    default:           return COLORS.slate50
  }
}

// Etiqueta legible de cada tipo de alerta (para UI config)
export const ETIQUETAS_ALERTAS = {
  facturas_vencidas:             { label: 'Facturas vencidas', descripcion: 'Clientes que pasaron su fecha de pago' },
  actividades_retrasadas:        { label: 'Actividades retrasadas', descripcion: 'Tareas de proyectos con fin vencido' },
  proyectos_cierre_proximo:      { label: 'Cierre de proyecto próximo', descripcion: 'Proyectos que cerrarán en los próximos 30 días' },
  cxp_autorizacion_pendiente:    { label: 'Cuentas por pagar sin autorizar', descripcion: 'Pagos próximos (≤3 días) sin tu autorización' },
  leads_sin_actividad:           { label: 'Leads sin actividad', descripcion: 'Leads sin movimiento en más de 7 días' },
  cotizaciones_sin_respuesta:    { label: 'Cotizaciones sin respuesta', descripcion: 'Cotizaciones enviadas sin respuesta en 5+ días' },
  colaborador_sobrecargado:      { label: 'Colaborador sobrecargado', descripcion: 'Miembros del equipo con >100% carga' },
}

// ============================================================
// Helper de formateo corto (no importa de helpers para evitar ciclo)
// ============================================================
function fmtCorto(n) {
  const num = Number(n) || 0
  if (Math.abs(num) >= 1000000) return '$' + (num/1000000).toFixed(1) + 'M'
  if (Math.abs(num) >= 1000) return '$' + (num/1000).toFixed(0) + 'k'
  return '$' + num.toLocaleString('es-MX')
}