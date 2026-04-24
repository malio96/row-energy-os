import { useState, useEffect, useMemo } from 'react'
import { getProyectos, getCotizaciones, getLeads, getHitos, getFacturas, getCompras, getPostventaTickets, getClientes, getUsuarios } from './supabase'
// v12: nuevas helpers para vista Personas
import { calcularCargaPorColaborador, identificarCuellosBotella } from './supabase'
import { COLORS, ETAPAS_LEAD, Badge, fmtMoney, fmtDate, daysUntil, relativeTime, btnPrimary, Icon, LoadingState, useIsMobile, loadPref, savePref } from './helpers'

// ============================================================
// CONFIG: Nombres de mes en español (para ADMIN META vs REAL)
// ============================================================
const MESES_ES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

// ============================================================
// METAS — lo que quiere Malio / jefa de admin
// ============================================================
// META mensual de cobranza (MXN). Por ahora hardcoded, luego vendrá de DB.
const META_COBRANZA_MENSUAL = 2500000  // $2.5M mensual por defecto
const META_CLIENTES_NUEVOS_MES = 3      // del manual Ampere: 3 clientes/mes
const META_TIEMPO_RESPUESTA_HORAS = 1   // respuesta <1h

// Clientes "watchlist" que la jefa de admin quiere ver siempre arriba
const CLIENTES_WATCHLIST = [
  'Cielo Azul', 'GKN', 'Energia Real', 'Energía Real',
  'MITINFRA', 'SHARL', 'EDP', 'Arizmendi', 'Arizmerndi'
]

// ============================================================
// v12.5 — Mockups por default para indicadores admin (editables)
// Los datos reales vendrán de la DB más adelante
// ============================================================
const MOCK_GASTOS_CATEGORIAS_DEFAULT = {
  Servicios: 1356000,   // 67% de $2M aprox
  Otros:     527000,    // 26%
  Prestamos: 140000,    // 7%
}

// Últimos 12 meses de gastos variables por año (para gráfico histórico)
const MOCK_GASTOS_HISTORICOS_DEFAULT = {
  2024: [3600,1250,4950,750,3600,2300,3330,2700,2260,7670,3210,450],
  2025: [2870,2110,2220,1260,3550,5370,4510,1290,1140,1220,4080,5690],
  2026: [2890,3020,2010,2030,0,0,0,0,0,0,0,0], // solo hasta abril
}

const MOCK_CUENTAS_POR_PAGAR_DEFAULT = [
  { id:1, concepto:'Nómina semanal Natalia', monto:2000, fecha:'2026-04-25', autorizado:false },
  { id:2, concepto:'Nómina primera quincena', monto:150000, fecha:'2026-04-30', autorizado:false },
  { id:3, concepto:'Jarming Asesores', monto:19971.35, fecha:'2026-04-28', autorizado:false },
  { id:4, concepto:'NRC Consultores', monto:9744, fecha:'2026-04-29', autorizado:false },
  { id:5, concepto:'Odoo', monto:754, fecha:'2026-04-26', autorizado:false },
  { id:6, concepto:'Megacable Internet', monto:12064, fecha:'2026-04-27', autorizado:false },
  { id:7, concepto:'IVA / ISR mensual', monto:85000, fecha:'2026-05-17', autorizado:false },
]

// ============================================================
// MAIN DASHBOARD (con selector de vista por departamento)
// ============================================================
export default function Dashboard({ usuario, onNavigate }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [vista, setVista] = useState(loadPref('dash_vista', 'ejecutivo'))
  const isMobile = useIsMobile()

  useEffect(() => {
    const cargar = async () => {
      setLoading(true)
      const [proyectos, cotizaciones, leads, hitos, facturas, compras, tickets, clientes, usuarios] = await Promise.all([
        getProyectos(), getCotizaciones(), getLeads(), getHitos(),
        getFacturas(), getCompras(), getPostventaTickets(), getClientes(), getUsuarios()
      ])
      // v12: aplanar actividades para vista Personas
      const actividades = proyectos.flatMap(p => (p.actividades || []).map(a => ({ ...a, proyecto: { id: p.id, codigo: p.codigo, nombre: p.nombre } })))
      setData({ proyectos, cotizaciones, leads, hitos, facturas, compras, tickets, clientes, usuarios, actividades })
      setLoading(false)
    }
    cargar()
  }, [])

  useEffect(() => { savePref('dash_vista', vista) }, [vista])

  if (loading || !data) return <LoadingState/>

  const VISTAS = [
    { key:'ejecutivo',       label:'Ejecutivo',       icon:'Eye' },
    { key:'administracion',  label:'Administración',  icon:'File' },
    { key:'ventas',          label:'Ventas',          icon:'Users' },
    { key:'marketing',       label:'Marketing',       icon:'Message' },
    { key:'compras',         label:'Compras',         icon:'Archive' },
    { key:'cobranza',        label:'Cobranza',        icon:'Dollar' },
    { key:'personas',        label:'Personas',        icon:'Users' },  // v12
  ]

  return (
    <div>
      {/* ======== HEADER con saludo y selector de vista ======== */}
      <div style={{ marginBottom:20 }}>
        <h1 style={{ fontSize: isMobile ? 24 : 32, fontWeight:400, color:COLORS.navy, margin:0, letterSpacing:'-0.02em', fontFamily:'var(--font-serif)' }}>
          Hola, {usuario?.nombre?.split(' ')[0] || 'Malio'}
        </h1>
        <p style={{ color:COLORS.slate500, fontSize:13, marginTop:4 }}>
          Resumen · {new Date().toLocaleDateString('es-MX', { weekday:'long', day:'numeric', month:'long' })}
        </p>
      </div>

      {/* Selector de vistas (tabs) */}
      <div style={{
        display:'flex', gap:4, marginBottom:20, overflowX:'auto',
        background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, padding:4,
        WebkitOverflowScrolling:'touch'
      }}>
        {VISTAS.map(v => {
          const active = vista === v.key
          return (
            <button key={v.key} onClick={() => setVista(v.key)} style={{
              padding:'8px 14px', border:'none',
              background: active ? COLORS.navy : 'transparent',
              color: active ? 'white' : COLORS.slate600,
              borderRadius:8, fontSize:12, fontWeight:600, cursor:'pointer',
              display:'flex', alignItems:'center', gap:6, whiteSpace:'nowrap',
              flexShrink:0, transition:'all 0.15s'
            }}>
              {Icon(v.icon)} {v.label}
            </button>
          )
        })}
      </div>

      {/* ======== CONTENIDO SEGÚN VISTA ======== */}
      {vista === 'ejecutivo'      && <VistaEjecutivo      data={data} onNavigate={onNavigate} isMobile={isMobile}/>}
      {vista === 'administracion' && <VistaAdministracion data={data} onNavigate={onNavigate} isMobile={isMobile}/>}
      {vista === 'ventas'         && <VistaVentas        data={data} onNavigate={onNavigate} isMobile={isMobile}/>}
      {vista === 'marketing'      && <VistaMarketing     data={data} onNavigate={onNavigate} isMobile={isMobile}/>}
      {vista === 'compras'        && <VistaCompras       data={data} onNavigate={onNavigate} isMobile={isMobile}/>}
      {vista === 'cobranza'       && <VistaCobranza      data={data} onNavigate={onNavigate} isMobile={isMobile}/>}
      {vista === 'personas'       && <VistaPersonas      data={data} onNavigate={onNavigate} isMobile={isMobile}/>}
    </div>
  )
}

// ============================================================
// VISTA EJECUTIVO — la que ya tenías (preservada 100%)
// ============================================================
function VistaEjecutivo({ data, onNavigate, isMobile }) {
  const { proyectos, cotizaciones, leads, hitos, facturas, tickets } = data

  // ============ KPIs ============
  const proyectosActivos = proyectos.filter(p => p.estado !== 'Terminado' && p.estado !== 'Cancelado')
  const cotizacionesPipeline = cotizaciones.filter(c => ['Borrador', 'Enviada', 'En revisión'].includes(c.estado))
  const leadsActivos = leads.filter(l => !['Ganado','Perdido'].includes(l.etapa))
  const ponderado = leadsActivos.reduce((s,l) => s + (Number(l.monto_estimado || 0) * Number(l.probabilidad || 0) / 100), 0)

  const hoy = new Date()
  const porCobrar = facturas.filter(f => f.estado === 'Emitida').reduce((s,f) => s + Number(f.total || 0), 0)
  const vencido = facturas.filter(f => {
    if (f.estado !== 'Emitida' || !f.fecha_vencimiento) return false
    return new Date(f.fecha_vencimiento) < hoy
  }).reduce((s,f) => s + Number(f.total || 0), 0)

  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
  const cobradoMes = facturas.filter(f => {
    if (f.estado !== 'Pagada' || !f.fecha_pago) return false
    return new Date(f.fecha_pago) >= inicioMes
  }).reduce((s,f) => s + Number(f.total || 0), 0)

  // ============ Pipeline por etapa ============
  const pipelinePorEtapa = ETAPAS_LEAD.filter(e => !['Ganado','Perdido'].includes(e.key)).map(e => {
    const arr = leads.filter(l => l.etapa === e.key)
    return {
      etapa: e.key,
      count: arr.length,
      monto: arr.reduce((s,l) => s + Number(l.monto_estimado || 0), 0),
      color: e.color || COLORS.teal,
    }
  })
  const maxMonto = Math.max(...pipelinePorEtapa.map(p => p.monto), 1)

  // ============ Aging ============
  const aging = { '0-30':0, '31-60':0, '61-90':0, '+90':0 }
  facturas.filter(f => f.estado === 'Emitida' && f.fecha_vencimiento).forEach(f => {
    const dias = Math.floor((hoy - new Date(f.fecha_vencimiento)) / (1000*60*60*24))
    if (dias <= 0) return
    const monto = Number(f.total || 0)
    if (dias <= 30) aging['0-30'] += monto
    else if (dias <= 60) aging['31-60'] += monto
    else if (dias <= 90) aging['61-90'] += monto
    else aging['+90'] += monto
  })

  // ============ Alertas ============
  const alertas = []
  if (vencido > 0) alertas.push({ titulo:`${fmtMoney(vencido, true)} en facturas vencidas`, color:COLORS.red, nav:'cobranza' })
  const bloqueadas = proyectos.reduce((n,p) => n + (p.actividades || []).filter(a => a.estado === 'Bloqueada').length, 0)
  if (bloqueadas > 0) alertas.push({ titulo:`${bloqueadas} actividades bloqueadas en proyectos`, color:COLORS.amber, nav:'proyectos' })
  const proximosCierre = proyectos.filter(p => {
    if (!p.fecha_cierre || p.estado === 'Terminado') return false
    const d = daysUntil(p.fecha_cierre)
    return d !== null && d >= 0 && d <= 30
  })
  if (proximosCierre.length > 0) alertas.push({ titulo:`${proximosCierre.length} proyecto(s) con cierre próximo`, color:COLORS.navy, nav:'proyectos' })
  const ticketsUrgentes = tickets.filter(t => t.prioridad === 'Alta' && t.estado !== 'Cerrado')
  if (ticketsUrgentes.length > 0) alertas.push({ titulo:`${ticketsUrgentes.length} ticket(s) de alta prioridad`, color:COLORS.red, nav:'postventa' })

  return (
    <>
      {/* Alertas arriba */}
      {alertas.length > 0 && (
        <div style={{ display:'grid', gap:8, marginBottom:20 }}>
          {alertas.map((a, i) => (
            <div key={i} onClick={() => onNavigate?.(a.nav)} style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 16px', background:'white', border:`1px solid ${COLORS.slate100}`, borderLeft:`3px solid ${a.color}`, borderRadius:10, cursor:'pointer' }}>
              <div style={{ color:a.color }}>{Icon('Alert')}</div>
              <span style={{ flex:1, fontSize:13, color:COLORS.ink, fontWeight:500 }}>{a.titulo}</span>
              <span style={{ fontSize:11, color:COLORS.slate400, textTransform:'uppercase', fontWeight:600 }}>Ver →</span>
            </div>
          ))}
        </div>
      )}

      {/* KPIs grandes */}
      <div style={{ display:'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap:12, marginBottom:20 }}>
        <KpiHero label="Proyectos activos" valor={proyectosActivos.length} sub={`de ${proyectos.length} totales`} color={COLORS.navy} onClick={() => onNavigate?.('proyectos')}/>
        <KpiHero label="Pipeline ponderado" valor={fmtMoney(ponderado, true)} sub={`${leadsActivos.length} leads activos`} color={COLORS.teal} onClick={() => onNavigate?.('leads')}/>
        <KpiHero label="Por cobrar" valor={fmtMoney(porCobrar, true)} sub={vencido > 0 ? `${fmtMoney(vencido, true)} vencido` : 'Al día'} color={vencido > 0 ? COLORS.red : COLORS.navy} onClick={() => onNavigate?.('cobranza')}/>
        <KpiHero label="Cobrado este mes" valor={fmtMoney(cobradoMes, true)} sub="MXN" color={COLORS.gold || COLORS.teal} onClick={() => onNavigate?.('facturacion')}/>
      </div>

      <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1.5fr 1fr', gap:16, marginBottom:20 }}>
        {/* Pipeline visual */}
        <div style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, padding:18 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:14 }}>
            <h3 style={{ fontSize:13, fontWeight:600, color:COLORS.ink, margin:0 }}>Pipeline comercial</h3>
            <span style={{ fontSize:11, color:COLORS.slate500 }}>{fmtMoney(pipelinePorEtapa.reduce((s,p) => s+p.monto, 0), true)} total</span>
          </div>
          {pipelinePorEtapa.map(p => (
            <div key={p.etapa} style={{ marginBottom:10 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                <span style={{ fontSize:12, color:COLORS.ink, fontWeight:500 }}>{p.etapa}</span>
                <span style={{ fontSize:11, color:COLORS.slate500, fontFamily:'var(--font-mono)' }}>{p.count} · {fmtMoney(p.monto, true)}</span>
              </div>
              <div style={{ height:10, background:COLORS.slate50, borderRadius:5, overflow:'hidden' }}>
                <div style={{ width:`${(p.monto/maxMonto)*100}%`, height:'100%', background:p.color, borderRadius:5, transition:'width 0.3s', minWidth: p.monto > 0 ? 4 : 0 }}/>
              </div>
            </div>
          ))}
        </div>

        {/* Aging */}
        <div style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, padding:18 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:14 }}>
            <h3 style={{ fontSize:13, fontWeight:600, color:COLORS.ink, margin:0 }}>Cobranza vencida</h3>
            <span style={{ fontSize:11, color: vencido > 0 ? COLORS.red : COLORS.teal, fontWeight:600 }}>{fmtMoney(vencido, true)}</span>
          </div>
          {Object.entries(aging).map(([bucket, monto]) => {
            const pct = vencido > 0 ? (monto/vencido)*100 : 0
            const c = bucket === '+90' ? COLORS.red : bucket === '61-90' ? COLORS.amber : bucket === '31-60' ? '#F59E0B' : COLORS.teal
            return (
              <div key={bucket} style={{ marginBottom:10 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                  <span style={{ fontSize:12, color:COLORS.ink, fontWeight:500 }}>{bucket} días</span>
                  <span style={{ fontSize:11, color:COLORS.slate500, fontFamily:'var(--font-mono)' }}>{fmtMoney(monto, true)}</span>
                </div>
                <div style={{ height:8, background:COLORS.slate50, borderRadius:4, overflow:'hidden' }}>
                  <div style={{ width:`${pct}%`, height:'100%', background:c, borderRadius:4 }}/>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Proyectos próximos a cierre y cotizaciones pendientes */}
      <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap:16, marginBottom:20 }}>
        <Tarjeta titulo={`Proyectos con cierre próximo (${proximosCierre.length})`} onVerTodo={() => onNavigate?.('proyectos')}>
          {proximosCierre.length === 0 && <EmptyMini texto="Ningún proyecto cerca de cierre"/>}
          {proximosCierre.slice(0, 5).map(p => {
            const d = daysUntil(p.fecha_cierre)
            return (
              <div key={p.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 0', borderBottom:`1px solid ${COLORS.slate100}` }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, fontFamily:'var(--font-mono)', color:COLORS.slate400, fontWeight:700, marginBottom:2 }}>{p.codigo}</div>
                  <div style={{ fontSize:13, color:COLORS.ink, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.nombre}</div>
                </div>
                <div style={{ fontSize:11, fontFamily:'var(--font-mono)', color: d <= 7 ? COLORS.red : d <= 14 ? COLORS.amber : COLORS.slate500, fontWeight:700 }}>
                  {d} días
                </div>
              </div>
            )
          })}
        </Tarjeta>

        <Tarjeta titulo={`Cotizaciones pendientes (${cotizacionesPipeline.length})`} onVerTodo={() => onNavigate?.('cotizaciones')}>
          {cotizacionesPipeline.length === 0 && <EmptyMini texto="No hay cotizaciones pendientes"/>}
          {cotizacionesPipeline.slice(0, 5).map(c => (
            <div key={c.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 0', borderBottom:`1px solid ${COLORS.slate100}` }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:12, fontFamily:'var(--font-mono)', color:COLORS.slate400, fontWeight:700, marginBottom:2 }}>{c.codigo}</div>
                <div style={{ fontSize:13, color:COLORS.ink, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.cliente?.razon_social || 'Sin cliente'}</div>
              </div>
              <div style={{ fontSize:12, fontFamily:'var(--font-mono)', color:COLORS.navy, fontWeight:600 }}>{fmtMoney(c.monto_total || 0, true)}</div>
            </div>
          ))}
        </Tarjeta>
      </div>

      {/* Acciones rápidas */}
      <div style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, padding:18 }}>
        <h3 style={{ fontSize:13, fontWeight:600, color:COLORS.ink, margin:0, marginBottom:14 }}>Acciones rápidas</h3>
        <div style={{ display:'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap:10 }}>
          <QuickAction icon="Plus" label="Nueva cotización" onClick={() => onNavigate?.('cotizaciones')}/>
          <QuickAction icon="Users" label="Nuevo lead" onClick={() => onNavigate?.('leads')}/>
          <QuickAction icon="Dollar" label="Ver cobranza" onClick={() => onNavigate?.('cobranza')}/>
          <QuickAction icon="Search" label="Buscar (⌘K)" onClick={() => document.dispatchEvent(new CustomEvent('open-command-palette'))}/>
        </div>
      </div>
    </>
  )
}

// ============================================================
// VISTA ADMINISTRACIÓN (lo que quiere la jefa de admin)
// v12.5: + Cotizado/Aceptado del mes, Gastos variables, Cuentas por pagar
// ============================================================
function VistaAdministracion({ data, onNavigate, isMobile }) {
  const { facturas, clientes, hitos, cotizaciones = [] } = data
  const hoy = new Date()
  const anio = hoy.getFullYear()

  // === META vs REAL mensual (cobranza) ===
  const porMes = Array(12).fill(0).map(() => ({ meta: META_COBRANZA_MENSUAL, real: 0 }))
  facturas.forEach(f => {
    if (f.estado !== 'Pagada' || !f.fecha_pago) return
    const d = new Date(f.fecha_pago)
    if (d.getFullYear() === anio) porMes[d.getMonth()].real += Number(f.total || 0)
  })
  const mesActual = hoy.getMonth()
  const metaAcum  = porMes.slice(0, mesActual+1).reduce((s,m) => s+m.meta, 0)
  const realAcum  = porMes.slice(0, mesActual+1).reduce((s,m) => s+m.real, 0)
  const avancePct = metaAcum > 0 ? Math.round((realAcum/metaAcum)*100) : 0

  // === Clientes nuevos por mes (Con contrato / Sin documento) ===
  // Por ahora un resumen simple basado en fecha_creacion de cliente
  const nuevosPorMes = Array(12).fill(0).map(() => ({ conContrato:0, sinDoc:0 }))
  ;(clientes || []).forEach(c => {
    const created = c.created_at || c.fecha_creacion
    if (!created) return
    const d = new Date(created)
    if (d.getFullYear() === anio) {
      // Heurística simple: si tiene rfc completo lo consideramos "con contrato/OC", sino "sin documento"
      if (c.rfc && c.rfc.length >= 12) nuevosPorMes[d.getMonth()].conContrato++
      else nuevosPorMes[d.getMonth()].sinDoc++
    }
  })
  const totalConContrato = nuevosPorMes.reduce((s,m) => s+m.conContrato, 0)
  const totalSinDoc      = nuevosPorMes.reduce((s,m) => s+m.sinDoc, 0)

  // === v12.5: Cotizado y Aceptado del mes (automático desde BD, editable) ===
  const cotizadoCalc = Array(12).fill(0)
  const aceptadoCalc = Array(12).fill(0)
  cotizaciones.forEach(c => {
    const fecha = c.created_at || c.fecha_creacion
    if (!fecha) return
    const d = new Date(fecha)
    if (d.getFullYear() !== anio) return
    cotizadoCalc[d.getMonth()] += Number(c.monto_total || 0)
    if (c.estado === 'Aprobada') aceptadoCalc[d.getMonth()] += 1
  })
  // Permitir override manual (localStorage)
  const [cotizadoOverride, setCotizadoOverride] = useState(loadPref('admin_cotizado_override', null))
  const [aceptadoOverride, setAceptadoOverride] = useState(loadPref('admin_aceptado_override', null))
  const cotizadoMes = cotizadoOverride || cotizadoCalc
  const aceptadoMes = aceptadoOverride || aceptadoCalc
  useEffect(() => savePref('admin_cotizado_override', cotizadoOverride), [cotizadoOverride])
  useEffect(() => savePref('admin_aceptado_override', aceptadoOverride), [aceptadoOverride])
  const editarMesBarra = (idx, tipo) => {
    const actual = tipo === 'cot' ? cotizadoMes[idx] : aceptadoMes[idx]
    const nuevo = prompt(`${tipo === 'cot' ? 'Cotizado' : 'Aceptado'} ${MESES_ES[idx]} ${anio}:`, actual)
    if (nuevo === null) return
    const n = Number(nuevo) || 0
    if (tipo === 'cot') {
      const arr = [...cotizadoMes]; arr[idx] = n
      setCotizadoOverride(arr)
    } else {
      const arr = [...aceptadoMes]; arr[idx] = n
      setAceptadoOverride(arr)
    }
  }

  // === v12.5: Gastos variables (pie + histórico) ===
  const [gastosCategorias, setGastosCategorias] = useState(loadPref('admin_gastos_cat', MOCK_GASTOS_CATEGORIAS_DEFAULT))
  const [gastosHistoricos, setGastosHistoricos] = useState(loadPref('admin_gastos_hist', MOCK_GASTOS_HISTORICOS_DEFAULT))
  useEffect(() => savePref('admin_gastos_cat', gastosCategorias), [gastosCategorias])
  useEffect(() => savePref('admin_gastos_hist', gastosHistoricos), [gastosHistoricos])
  const gastosTotal = Object.values(gastosCategorias).reduce((s,v) => s+Number(v||0), 0)

  // === v12.5: Cuentas por pagar esta semana ===
  const [cuentasPorPagar, setCuentasPorPagar] = useState(loadPref('admin_cxp', MOCK_CUENTAS_POR_PAGAR_DEFAULT))
  useEffect(() => savePref('admin_cxp', cuentasPorPagar), [cuentasPorPagar])
  const cxpAutorizadas = cuentasPorPagar.filter(c => c.autorizado).reduce((s,c) => s+Number(c.monto||0), 0)
  const cxpPendientes = cuentasPorPagar.filter(c => !c.autorizado).reduce((s,c) => s+Number(c.monto||0), 0)
  const toggleAutorizar = (id) => setCuentasPorPagar(prev => prev.map(c => c.id === id ? { ...c, autorizado: !c.autorizado } : c))
  const agregarCxp = () => {
    const concepto = prompt('Concepto:'); if (!concepto) return
    const monto = Number(prompt('Monto $:') || 0); if (!monto) return
    setCuentasPorPagar([...cuentasPorPagar, { id: Date.now(), concepto, monto, fecha: new Date().toISOString().split('T')[0], autorizado:false }])
  }
  const eliminarCxp = (id) => setCuentasPorPagar(cuentasPorPagar.filter(c => c.id !== id))

  // === Watchlist de clientes con seguimiento ===
  const watchlist = (clientes || []).filter(c =>
    CLIENTES_WATCHLIST.some(w => (c.razon_social || '').toLowerCase().includes(w.toLowerCase()))
  ).map(c => {
    const facturasCli = facturas.filter(f => f.cliente_id === c.id || f.cliente?.id === c.id)
    const porCobrar = facturasCli.filter(f => f.estado === 'Emitida').reduce((s,f) => s+Number(f.total||0), 0)
    const vencidas  = facturasCli.filter(f => {
      if (f.estado !== 'Emitida' || !f.fecha_vencimiento) return false
      return new Date(f.fecha_vencimiento) < hoy
    })
    return { ...c, porCobrar, vencidas: vencidas.length }
  })

  // Objetivos y planeación semana (localStorage por ahora)
  const [objetivos, setObjetivos] = useState(loadPref('admin_objetivos', [
    'Seguimiento clientes: Energía Real',
    'Realizar pagos pendientes de la semana',
    'Seguimiento diario: Cielo Azul, GKN, Energía Real',
    'Cotizaciones: Abei y Recurrent',
  ]))
  const [planeacion, setPlaneacion] = useState(loadPref('admin_planeacion', [
    'Seguimiento a fechas de pago',
    'Seguimiento al avance de proyectos',
    'MITINFRA: Seguimiento',
    'SHARL: Seguimiento pago de facturas',
    'EDP: Envío de factura',
    'Facturación Arizmendi',
  ]))
  useEffect(() => savePref('admin_objetivos', objetivos), [objetivos])
  useEffect(() => savePref('admin_planeacion', planeacion), [planeacion])

  return (
    <>
      {/* KPIs superiores */}
      <div style={{ display:'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap:12, marginBottom:20 }}>
        <KpiHero label="Meta acumulada" valor={fmtMoney(metaAcum, true)} sub={`${MESES_ES[mesActual]} YTD`} color={COLORS.slate500}/>
        <KpiHero label="Real acumulado" valor={fmtMoney(realAcum, true)} sub={`${avancePct}% vs meta`} color={avancePct >= 90 ? COLORS.teal : avancePct >= 70 ? COLORS.amber : COLORS.red}/>
        <KpiHero label="Clientes nuevos con contrato" valor={totalConContrato} sub={`año ${anio}`} color={COLORS.navy}/>
        <KpiHero label="Clientes nuevos sin documento" valor={totalSinDoc} sub="pendientes de formalizar" color={COLORS.amber}/>
      </div>

      {/* Gráfico META vs REAL mensual */}
      <div style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, padding:18, marginBottom:16 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:14 }}>
          <h3 style={{ fontSize:14, fontWeight:600, color:COLORS.ink, margin:0, fontFamily:'var(--font-serif)' }}>Avance de cobranza — META vs REAL</h3>
          <div style={{ display:'flex', gap:14, fontSize:11 }}>
            <Leyenda color="#3B82F6" label="META"/>
            <Leyenda color="#6B7280" label="REAL"/>
          </div>
        </div>
        <GraficoMetaReal porMes={porMes} isMobile={isMobile}/>
      </div>

      {/* Gráfico Clientes nuevos + Watchlist */}
      <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1.4fr 1fr', gap:16, marginBottom:20 }}>
        <div style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, padding:18 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:14 }}>
            <h3 style={{ fontSize:14, fontWeight:600, color:COLORS.ink, margin:0, fontFamily:'var(--font-serif)' }}>Clientes nuevos con contrato / OC</h3>
            <div style={{ display:'flex', gap:14, fontSize:11 }}>
              <Leyenda color={COLORS.teal} label="Con contrato"/>
              <Leyenda color={COLORS.slate400} label="Sin documento"/>
            </div>
          </div>
          <GraficoClientesNuevos porMes={nuevosPorMes} isMobile={isMobile}/>
        </div>

        <Tarjeta titulo="Clientes en seguimiento" onVerTodo={() => onNavigate?.('config')}>
          {watchlist.length === 0 && <EmptyMini texto="Sin clientes en la watchlist"/>}
          {watchlist.map(c => (
            <div key={c.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 0', borderBottom:`1px solid ${COLORS.slate100}` }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, color:COLORS.ink, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.razon_social}</div>
                <div style={{ fontSize:10, color:COLORS.slate500, marginTop:2 }}>
                  {c.vencidas > 0 ? <span style={{ color:COLORS.red, fontWeight:600 }}>{c.vencidas} vencida(s)</span> : 'Al día'}
                </div>
              </div>
              <div style={{ fontSize:11, fontFamily:'var(--font-mono)', color:c.porCobrar > 0 ? COLORS.navy : COLORS.slate400, fontWeight:700 }}>
                {fmtMoney(c.porCobrar, true)}
              </div>
            </div>
          ))}
        </Tarjeta>
      </div>

      {/* Objetivos + Planeación semana */}
      <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap:16, marginBottom:20 }}>
        <ListaEditable titulo="Objetivos de la semana" items={objetivos} setItems={setObjetivos} color={COLORS.teal}/>
        <ListaEditable titulo="Planeación de la semana" items={planeacion} setItems={setPlaneacion} color={COLORS.navy}/>
      </div>

      {/* ============================================================ */}
      {/* v12.5 NUEVO: Cotizado y Aceptado del mes */}
      {/* ============================================================ */}
      <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap:16, marginBottom:20 }}>
        <div style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, padding:18 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:14 }}>
            <h3 style={{ fontSize:14, fontWeight:600, color:COLORS.ink, margin:0, fontFamily:'var(--font-serif)' }}>Cotizado del mes</h3>
            {cotizadoOverride && (
              <button onClick={() => setCotizadoOverride(null)} style={{ fontSize:10, border:'none', background:'transparent', color:COLORS.slate500, cursor:'pointer', textDecoration:'underline' }}>Reset (usar BD)</button>
            )}
          </div>
          <div style={{ fontSize:11, color:COLORS.slate500, marginBottom:10 }}>Click en cualquier barra para editar · valores MXN</div>
          <GraficoBarrasMensuales valores={cotizadoMes} color={COLORS.slate500} formato="money" onEditar={(i) => editarMesBarra(i, 'cot')} isMobile={isMobile}/>
        </div>
        <div style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, padding:18 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:14 }}>
            <h3 style={{ fontSize:14, fontWeight:600, color:COLORS.ink, margin:0, fontFamily:'var(--font-serif)' }}>Aceptado del mes</h3>
            {aceptadoOverride && (
              <button onClick={() => setAceptadoOverride(null)} style={{ fontSize:10, border:'none', background:'transparent', color:COLORS.slate500, cursor:'pointer', textDecoration:'underline' }}>Reset (usar BD)</button>
            )}
          </div>
          <div style={{ fontSize:11, color:COLORS.slate500, marginBottom:10 }}>Cotizaciones aprobadas por mes · click para editar</div>
          <GraficoBarrasMensuales valores={aceptadoMes} color="#3B82F6" formato="numero" onEditar={(i) => editarMesBarra(i, 'acep')} isMobile={isMobile}/>
        </div>
      </div>

      {/* ============================================================ */}
      {/* v12.5 NUEVO: Gastos variables (pie + histórico) */}
      {/* ============================================================ */}
      <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1.4fr', gap:16, marginBottom:20 }}>
        <div style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, padding:18 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:14 }}>
            <h3 style={{ fontSize:14, fontWeight:600, color:COLORS.ink, margin:0, fontFamily:'var(--font-serif)' }}>Gastos variables</h3>
            <span style={{ fontSize:11, color:COLORS.slate500, fontFamily:'var(--font-mono)' }}>{fmtMoney(gastosTotal, true)}</span>
          </div>
          <DonutGastos categorias={gastosCategorias} total={gastosTotal} onEditar={(k) => {
            const nuevo = prompt(`${k} (MXN):`, gastosCategorias[k])
            if (nuevo === null) return
            setGastosCategorias({ ...gastosCategorias, [k]: Number(nuevo)||0 })
          }}/>
        </div>
        <div style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, padding:18 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:14 }}>
            <h3 style={{ fontSize:14, fontWeight:600, color:COLORS.ink, margin:0, fontFamily:'var(--font-serif)' }}>Gastos variables históricos</h3>
            <div style={{ display:'flex', gap:12, fontSize:11 }}>
              <Leyenda color="#93C5FD" label="2024"/>
              <Leyenda color={COLORS.navy} label="2025"/>
              <Leyenda color="#1F2937" label="2026"/>
            </div>
          </div>
          <GraficoLineaHistorico series={gastosHistoricos} isMobile={isMobile}/>
        </div>
      </div>

      {/* ============================================================ */}
      {/* v12.5 NUEVO: Cuentas por pagar esta semana */}
      {/* ============================================================ */}
      <div style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, padding:18, marginBottom:20 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:14, flexWrap:'wrap', gap:10 }}>
          <h3 style={{ fontSize:14, fontWeight:600, color:COLORS.ink, margin:0, fontFamily:'var(--font-serif)' }}>Cuentas por pagar esta semana</h3>
          <div style={{ display:'flex', gap:14, fontSize:11 }}>
            <span style={{ color:COLORS.amber, fontWeight:600 }}>Pendientes: {fmtMoney(cxpPendientes, true)}</span>
            <span style={{ color:COLORS.teal, fontWeight:600 }}>Autorizadas: {fmtMoney(cxpAutorizadas, true)}</span>
          </div>
        </div>
        <div style={{ fontSize:11, color:COLORS.slate500, marginBottom:10, fontStyle:'italic' }}>
          *Requiere autorización de dirección — click en el círculo para autorizar*
        </div>
        {cuentasPorPagar.length === 0 && <EmptyMini texto="Sin cuentas por pagar esta semana"/>}
        {cuentasPorPagar.map(c => (
          <div key={c.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 0', borderBottom:`1px solid ${COLORS.slate100}` }}>
            <button onClick={() => toggleAutorizar(c.id)} style={{
              width:22, height:22, minWidth:22, borderRadius:'50%',
              border:`2px solid ${c.autorizado ? COLORS.teal : COLORS.slate200}`,
              background: c.autorizado ? COLORS.teal : 'white',
              cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
              padding:0, flexShrink:0,
            }}>
              {c.autorizado && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
            </button>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:13, color:COLORS.ink, fontWeight:500, textDecoration: c.autorizado ? 'line-through' : 'none', opacity: c.autorizado ? 0.6 : 1 }}>{c.concepto}</div>
              <div style={{ fontSize:10, color:COLORS.slate500, marginTop:2 }}>Fecha: {c.fecha}</div>
            </div>
            <div style={{ fontSize:12, fontFamily:'var(--font-mono)', color: c.autorizado ? COLORS.slate400 : COLORS.navy, fontWeight:700, minWidth:90, textAlign:'right' }}>
              {fmtMoney(Number(c.monto||0), true)}
            </div>
            <button onClick={() => eliminarCxp(c.id)} style={{ border:'none', background:'transparent', color:COLORS.slate400, cursor:'pointer', padding:4, display:'flex' }}>{Icon('X')}</button>
          </div>
        ))}
        <button onClick={agregarCxp} style={{
          marginTop:10, width:'100%', padding:'10px', background:COLORS.slate50, border:`1px dashed ${COLORS.slate200}`,
          borderRadius:8, fontSize:12, fontWeight:600, color:COLORS.slate600, cursor:'pointer'
        }}>+ Agregar cuenta por pagar</button>
      </div>
    </>
  )
}

// ============================================================
// VISTA VENTAS (KPIs del manual Ampere)
// ============================================================
function VistaVentas({ data, onNavigate, isMobile }) {
  const { leads, cotizaciones, clientes } = data
  const hoy = new Date()
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1)

  // Clientes nuevos este mes (de leads ganados)
  const clientesNuevosMes = leads.filter(l => {
    if (l.etapa !== 'Ganado') return false
    const fecha = l.updated_at || l.created_at
    return fecha && new Date(fecha) >= inicioMes
  }).length

  // Conversión de cotizaciones
  const cotTotal = cotizaciones.length
  const cotAprobadas = cotizaciones.filter(c => c.estado === 'Aprobada').length
  const cotRechazadas = cotizaciones.filter(c => c.estado === 'Rechazada').length
  const cotPct = cotTotal > 0 ? Math.round((cotAprobadas/cotTotal)*100) : 0
  const cotPctRechazo = cotTotal > 0 ? Math.round((cotRechazadas/cotTotal)*100) : 0

  // Pipeline por etapa
  const leadsActivos = leads.filter(l => !['Ganado','Perdido'].includes(l.etapa))
  const totalPipeline = leadsActivos.reduce((s,l) => s+Number(l.monto_estimado||0), 0)
  const ponderado = leadsActivos.reduce((s,l) => s+(Number(l.monto_estimado||0)*Number(l.probabilidad||0)/100), 0)

  return (
    <>
      <div style={{ display:'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap:12, marginBottom:20 }}>
        <KpiConMeta label="Clientes nuevos este mes" valor={clientesNuevosMes} meta={META_CLIENTES_NUEVOS_MES} sufijo="" color={COLORS.teal}/>
        <KpiHero label="Cotizaciones aceptadas" valor={`${cotPct}%`} sub={`${cotAprobadas} de ${cotTotal}`} color={cotPct >= 60 ? COLORS.teal : COLORS.amber} onClick={() => onNavigate?.('cotizaciones')}/>
        <KpiHero label="Rechazo cotizaciones" valor={`${cotPctRechazo}%`} sub={`meta ≤ 20%`} color={cotPctRechazo <= 20 ? COLORS.teal : COLORS.red}/>
        <KpiHero label="Pipeline ponderado" valor={fmtMoney(ponderado, true)} sub={`${leadsActivos.length} leads activos`} color={COLORS.navy} onClick={() => onNavigate?.('leads')}/>
      </div>

      <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap:16, marginBottom:20 }}>
        {/* Donut Aceptadas vs Rechazadas vs Pendientes */}
        <div style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, padding:18 }}>
          <h3 style={{ fontSize:14, fontWeight:600, color:COLORS.ink, margin:0, marginBottom:14, fontFamily:'var(--font-serif)' }}>Estado de cotizaciones</h3>
          <DonutCotizaciones cotizaciones={cotizaciones}/>
        </div>

        {/* Top clientes potenciales */}
        <Tarjeta titulo="Top leads por monto" onVerTodo={() => onNavigate?.('leads')}>
          {leadsActivos.length === 0 && <EmptyMini texto="Sin leads activos"/>}
          {[...leadsActivos].sort((a,b) => Number(b.monto_estimado||0)-Number(a.monto_estimado||0)).slice(0,5).map(l => (
            <div key={l.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 0', borderBottom:`1px solid ${COLORS.slate100}` }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, color:COLORS.ink, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{l.empresa || l.nombre_contacto}</div>
                <div style={{ fontSize:10, color:COLORS.slate500, marginTop:2 }}>{l.etapa} · {l.probabilidad || 0}%</div>
              </div>
              <div style={{ fontSize:11, fontFamily:'var(--font-mono)', color:COLORS.navy, fontWeight:700 }}>{fmtMoney(Number(l.monto_estimado||0), true)}</div>
            </div>
          ))}
        </Tarjeta>
      </div>

      <NotaRecordatorio titulo="Metas del área (Manual Ampere)" items={[
        `Conseguir ${META_CLIENTES_NUEVOS_MES} clientes nuevos al mes`,
        `Tiempo de respuesta a consultas menor a ${META_TIEMPO_RESPUESTA_HORAS}h`,
        'Porcentaje de rechazo de cotizaciones menor al 20%',
        'Resolver las quejas de clientes al 100%',
      ]}/>
    </>
  )
}

// ============================================================
// VISTA MARKETING (redes sociales semanales)
// ============================================================
function VistaMarketing({ data, onNavigate, isMobile }) {
  // Datos de ejemplo del PDF de la jefa (editables con localStorage)
  const [fb, setFb] = useState(loadPref('mkt_fb', {
    s1: { visualizaciones: 38, espectadores: 34, interaccion: 11, visitas: 5, seguidores: 3 },
    s2: { visualizaciones: 36, espectadores: 36, interaccion: 10, visitas: 5, seguidores: 3 },
  }))
  const [ig, setIg] = useState(loadPref('mkt_ig', {
    s1: { visualizaciones: 84, alcance: 98, interaccion: 3, visitas: 4, seguidores: 8 },
    s2: { visualizaciones: 98, alcance: 98, interaccion: 4, visitas: 4, seguidores: 3 },
  }))
  useEffect(() => savePref('mkt_fb', fb), [fb])
  useEffect(() => savePref('mkt_ig', ig), [ig])

  return (
    <>
      <div style={{ padding:'12px 14px', background:'#FEF3C7', border:`1px solid #FDE68A`, borderRadius:10, marginBottom:20, fontSize:12, color:'#78350F' }}>
        <strong>Sección Marketing (beta):</strong> Aquí capturas manualmente las métricas semanales de redes sociales.
        Click en cualquier número para editarlo. Los datos se guardan en tu navegador por ahora.
      </div>

      <RedSocial
        titulo="Facebook"
        color="#1877F2"
        metrics={['visualizaciones','espectadores','interaccion','visitas','seguidores']}
        data={fb}
        onChange={setFb}
        isMobile={isMobile}
      />

      <RedSocial
        titulo="Instagram"
        color="#E4405F"
        metrics={['visualizaciones','alcance','interaccion','visitas','seguidores']}
        data={ig}
        onChange={setIg}
        isMobile={isMobile}
      />
    </>
  )
}

// ============================================================
// VISTA COMPRAS
// ============================================================
function VistaCompras({ data, onNavigate, isMobile }) {
  const { compras } = data

  const total = compras.length
  const abiertas = compras.filter(c => c.estado !== 'Pagada' && c.estado !== 'Cancelada')
  const pagadas  = compras.filter(c => c.estado === 'Pagada')
  const pendientePago = compras.filter(c => c.estado === 'Aprobada' || c.estado === 'Recibida').reduce((s,c) => s+Number(c.monto||0), 0)

  // Top proveedores por monto acumulado
  const porProv = {}
  compras.forEach(c => {
    const key = c.proveedor || c.proveedor_nombre || 'Sin proveedor'
    if (!porProv[key]) porProv[key] = { nombre: key, monto:0, count:0 }
    porProv[key].monto += Number(c.monto||0)
    porProv[key].count += 1
  })
  const topProv = Object.values(porProv).sort((a,b) => b.monto-a.monto).slice(0,6)

  return (
    <>
      <div style={{ display:'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap:12, marginBottom:20 }}>
        <KpiHero label="Órdenes abiertas" valor={abiertas.length} sub={`de ${total} totales`} color={COLORS.navy} onClick={() => onNavigate?.('compras')}/>
        <KpiHero label="Órdenes pagadas" valor={pagadas.length} sub={`año actual`} color={COLORS.teal} onClick={() => onNavigate?.('compras')}/>
        <KpiHero label="Pendiente de pago" valor={fmtMoney(pendientePago, true)} sub="aprobadas/recibidas" color={COLORS.amber}/>
        <KpiHero label="Proveedores activos" valor={Object.keys(porProv).length} sub="con órdenes registradas" color={COLORS.slate500}/>
      </div>

      <div style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, padding:18, marginBottom:16 }}>
        <h3 style={{ fontSize:14, fontWeight:600, color:COLORS.ink, margin:0, marginBottom:14, fontFamily:'var(--font-serif)' }}>Top proveedores por monto</h3>
        {topProv.length === 0 && <EmptyMini texto="Sin compras registradas"/>}
        {topProv.map(p => {
          const max = Math.max(...topProv.map(x => x.monto), 1)
          const pct = (p.monto/max)*100
          return (
            <div key={p.nombre} style={{ marginBottom:12 }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                <span style={{ fontSize:12, color:COLORS.ink, fontWeight:500 }}>{p.nombre}</span>
                <span style={{ fontSize:11, fontFamily:'var(--font-mono)', color:COLORS.slate500 }}>{p.count} orden(es) · {fmtMoney(p.monto, true)}</span>
              </div>
              <div style={{ height:8, background:COLORS.slate50, borderRadius:4, overflow:'hidden' }}>
                <div style={{ width:`${pct}%`, height:'100%', background:COLORS.navy, borderRadius:4, transition:'width 0.3s' }}/>
              </div>
            </div>
          )
        })}
      </div>

      <Tarjeta titulo={`Órdenes abiertas (${abiertas.length})`} onVerTodo={() => onNavigate?.('compras')}>
        {abiertas.length === 0 && <EmptyMini texto="No hay órdenes abiertas"/>}
        {abiertas.slice(0, 8).map(c => (
          <div key={c.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 0', borderBottom:`1px solid ${COLORS.slate100}` }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:12, fontFamily:'var(--font-mono)', color:COLORS.slate400, fontWeight:700, marginBottom:2 }}>{c.codigo || c.id?.substring(0,8)}</div>
              <div style={{ fontSize:13, color:COLORS.ink, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.descripcion || c.proveedor || 'Sin descripción'}</div>
            </div>
            <span style={{ fontSize:10, fontWeight:700, padding:'3px 8px', borderRadius:4, background: c.estado === 'Aprobada' ? '#E1F5EE' : '#FEF3C7', color: c.estado === 'Aprobada' ? COLORS.teal : COLORS.amber }}>{c.estado}</span>
            <div style={{ fontSize:11, fontFamily:'var(--font-mono)', color:COLORS.navy, fontWeight:700, minWidth:80, textAlign:'right' }}>{fmtMoney(Number(c.monto||0), true)}</div>
          </div>
        ))}
      </Tarjeta>
    </>
  )
}

// ============================================================
// VISTA COBRANZA (resumen - el detalle completo va en Cobranza v2)
// ============================================================
function VistaCobranza({ data, onNavigate, isMobile }) {
  const { facturas, clientes } = data
  const hoy = new Date()
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1)

  const cobradoMes = facturas.filter(f => f.estado === 'Pagada' && f.fecha_pago && new Date(f.fecha_pago) >= inicioMes).reduce((s,f) => s+Number(f.total||0), 0)
  const porCobrar = facturas.filter(f => f.estado === 'Emitida').reduce((s,f) => s+Number(f.total||0), 0)
  const vencido = facturas.filter(f => {
    if (f.estado !== 'Emitida' || !f.fecha_vencimiento) return false
    return new Date(f.fecha_vencimiento) < hoy
  }).reduce((s,f) => s+Number(f.total||0), 0)

  const avancePct = META_COBRANZA_MENSUAL > 0 ? Math.min(100, Math.round((cobradoMes/META_COBRANZA_MENSUAL)*100)) : 0

  // Top 5 facturas vencidas
  const vencidasList = facturas.filter(f => {
    if (f.estado !== 'Emitida' || !f.fecha_vencimiento) return false
    return new Date(f.fecha_vencimiento) < hoy
  }).map(f => {
    const dias = Math.floor((hoy - new Date(f.fecha_vencimiento))/(1000*60*60*24))
    return { ...f, diasVencido: dias }
  }).sort((a,b) => b.diasVencido-a.diasVencido).slice(0,5)

  return (
    <>
      <div style={{ display:'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap:12, marginBottom:20 }}>
        <KpiHero label="Meta del mes" valor={fmtMoney(META_COBRANZA_MENSUAL, true)} sub={MESES_ES[hoy.getMonth()]} color={COLORS.slate500}/>
        <KpiHero label="Cobrado este mes" valor={fmtMoney(cobradoMes, true)} sub={`${avancePct}% de meta`} color={avancePct >= 90 ? COLORS.teal : avancePct >= 70 ? COLORS.amber : COLORS.red}/>
        <KpiHero label="Por cobrar" valor={fmtMoney(porCobrar, true)} sub="facturas emitidas" color={COLORS.navy} onClick={() => onNavigate?.('cobranza')}/>
        <KpiHero label="Vencido" valor={fmtMoney(vencido, true)} sub={vencidasList.length + ' factura(s)'} color={vencido > 0 ? COLORS.red : COLORS.teal}/>
      </div>

      {/* Barra META vs REAL del mes actual */}
      <div style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, padding:18, marginBottom:16 }}>
        <h3 style={{ fontSize:14, fontWeight:600, color:COLORS.ink, margin:0, marginBottom:12, fontFamily:'var(--font-serif)' }}>Avance de cobranza {MESES_ES[hoy.getMonth()]} {hoy.getFullYear()}</h3>
        <div style={{ position:'relative', height:28, background:COLORS.slate50, borderRadius:8, overflow:'hidden', marginBottom:8 }}>
          <div style={{ width:`${avancePct}%`, height:'100%', background: avancePct >= 90 ? COLORS.teal : avancePct >= 70 ? COLORS.amber : COLORS.red, transition:'width 0.5s', display:'flex', alignItems:'center', justifyContent:'flex-end', paddingRight:10 }}>
            <span style={{ fontSize:11, fontWeight:700, color:'white', fontFamily:'var(--font-mono)' }}>{avancePct}%</span>
          </div>
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:COLORS.slate500 }}>
          <span>Cobrado: {fmtMoney(cobradoMes, true)}</span>
          <span>Meta: {fmtMoney(META_COBRANZA_MENSUAL, true)}</span>
        </div>
      </div>

      <Tarjeta titulo={`Top facturas vencidas (${vencidasList.length})`} onVerTodo={() => onNavigate?.('cobranza')}>
        {vencidasList.length === 0 && <EmptyMini texto="¡No hay facturas vencidas!"/>}
        {vencidasList.map(f => (
          <div key={f.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 0', borderBottom:`1px solid ${COLORS.slate100}` }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:12, fontFamily:'var(--font-mono)', color:COLORS.slate400, fontWeight:700, marginBottom:2 }}>{f.folio || f.codigo}</div>
              <div style={{ fontSize:13, color:COLORS.ink, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.cliente?.razon_social || f.cliente_nombre || 'Sin cliente'}</div>
            </div>
            <span style={{ fontSize:10, fontWeight:700, padding:'3px 8px', borderRadius:4, background:'#FEF2F2', color:COLORS.red }}>{f.diasVencido} días</span>
            <div style={{ fontSize:11, fontFamily:'var(--font-mono)', color:COLORS.red, fontWeight:700, minWidth:80, textAlign:'right' }}>{fmtMoney(Number(f.total||0), true)}</div>
          </div>
        ))}
      </Tarjeta>

      <div style={{ padding:'14px 16px', background:COLORS.slate50, border:`1px dashed ${COLORS.slate200}`, borderRadius:10, fontSize:12, color:COLORS.slate600, textAlign:'center', marginTop:16 }}>
        Para ver el detalle completo con seguimiento por cliente → <button onClick={() => onNavigate?.('cobranza')} style={{ border:'none', background:'transparent', color:COLORS.navy, fontWeight:700, cursor:'pointer', textDecoration:'underline', padding:0, fontSize:12 }}>Ir al módulo Cobranza</button>
      </div>
    </>
  )
}

// ============================================================
// COMPONENTES COMPARTIDOS
// ============================================================

function KpiHero({ label, valor, sub, color, onClick }) {
  return (
    <div onClick={onClick} style={{
      background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, padding:16,
      cursor: onClick ? 'pointer' : 'default', transition:'all 0.15s'
    }}
      onMouseEnter={e => { if (onClick) e.currentTarget.style.boxShadow='0 4px 16px rgba(10,37,64,0.08)' }}
      onMouseLeave={e => { if (onClick) e.currentTarget.style.boxShadow='none' }}>
      <div style={{ fontSize:10, fontWeight:600, color:COLORS.slate500, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>{label}</div>
      <div style={{ fontSize:26, fontWeight:500, color, fontFamily:'var(--font-serif)', lineHeight:1, marginBottom:4 }}>{valor}</div>
      <div style={{ fontSize:11, color:COLORS.slate500 }}>{sub}</div>
    </div>
  )
}

function KpiConMeta({ label, valor, meta, sufijo, color }) {
  const pct = meta > 0 ? Math.min(100, Math.round((Number(valor)/meta)*100)) : 0
  return (
    <div style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, padding:16 }}>
      <div style={{ fontSize:10, fontWeight:600, color:COLORS.slate500, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>{label}</div>
      <div style={{ fontSize:26, fontWeight:500, color, fontFamily:'var(--font-serif)', lineHeight:1, marginBottom:8 }}>{valor}{sufijo} <span style={{ fontSize:14, color:COLORS.slate400 }}>/ {meta}</span></div>
      <div style={{ height:6, background:COLORS.slate50, borderRadius:3, overflow:'hidden' }}>
        <div style={{ width:`${pct}%`, height:'100%', background:color, borderRadius:3, transition:'width 0.3s' }}/>
      </div>
    </div>
  )
}

function QuickAction({ icon, label, onClick }) {
  return (
    <button onClick={onClick} style={{ display:'flex', alignItems:'center', gap:8, padding:'12px 14px', background:COLORS.slate50, border:'none', borderRadius:10, cursor:'pointer', fontSize:12, fontWeight:500, color:COLORS.navy, textAlign:'left' }}>
      {Icon(icon)} {label}
    </button>
  )
}

function Tarjeta({ titulo, children, onVerTodo }) {
  return (
    <div style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, padding:18 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:8 }}>
        <h3 style={{ fontSize:13, fontWeight:600, color:COLORS.ink, margin:0 }}>{titulo}</h3>
        {onVerTodo && <button onClick={onVerTodo} style={{ border:'none', background:'transparent', color:COLORS.slate500, fontSize:11, fontWeight:600, cursor:'pointer', textTransform:'uppercase', letterSpacing:'0.04em' }}>Ver todo →</button>}
      </div>
      {children}
    </div>
  )
}

function EmptyMini({ texto }) {
  return <div style={{ padding:'20px 10px', textAlign:'center', color:COLORS.slate400, fontSize:12 }}>{texto}</div>
}

function Leyenda({ color, label }) {
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:4, color:COLORS.slate600 }}>
      <span style={{ width:10, height:10, borderRadius:'50%', background:color }}/>{label}
    </span>
  )
}

// ============================================================
// GRÁFICO META vs REAL (SVG barras dobles por mes)
// ============================================================
function GraficoMetaReal({ porMes, isMobile }) {
  const H = 220
  const W = isMobile ? 700 : 900
  const PAD_L = 70, PAD_R = 20, PAD_T = 14, PAD_B = 36
  const innerW = W - PAD_L - PAD_R
  const innerH = H - PAD_T - PAD_B
  const maxVal = Math.max(...porMes.flatMap(m => [m.meta, m.real]), 1)
  const nice = niceMax(maxVal)
  const slot = innerW / 12

  return (
    <div style={{ overflowX:'auto' }}>
      <svg width={W} height={H} style={{ display:'block', minWidth:W }}>
        {/* Y axis con grid */}
        {[0, 0.25, 0.5, 0.75, 1].map(p => {
          const y = PAD_T + innerH - p*innerH
          return (
            <g key={p}>
              <line x1={PAD_L} y1={y} x2={PAD_L+innerW} y2={y} stroke={COLORS.slate100} strokeDasharray={p === 0 ? '' : '3 3'}/>
              <text x={PAD_L - 8} y={y+4} textAnchor="end" fontSize="10" fill={COLORS.slate500} fontFamily="var(--font-mono)">{fmtMoney(nice*p, true)}</text>
            </g>
          )
        })}

        {/* Barras */}
        {porMes.map((m, i) => {
          const cx = PAD_L + slot*i + slot/2
          const bw = Math.min(slot*0.32, 24)
          const hMeta = (m.meta/nice)*innerH
          const hReal = (m.real/nice)*innerH
          return (
            <g key={i}>
              <rect x={cx - bw - 1} y={PAD_T + innerH - hMeta} width={bw} height={hMeta} fill="#3B82F6" rx="2"/>
              <rect x={cx + 1} y={PAD_T + innerH - hReal} width={bw} height={hReal} fill="#6B7280" rx="2"/>
              <text x={cx} y={H - 12} textAnchor="middle" fontSize="10" fill={COLORS.slate500} fontFamily="var(--font-mono)">{MESES_ES[i]}</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function GraficoClientesNuevos({ porMes, isMobile }) {
  const H = 180
  const W = isMobile ? 600 : 500
  const PAD_L = 30, PAD_R = 10, PAD_T = 10, PAD_B = 28
  const innerW = W - PAD_L - PAD_R
  const innerH = H - PAD_T - PAD_B
  const maxVal = Math.max(...porMes.map(m => m.conContrato + m.sinDoc), 1)
  const nice = Math.max(3, Math.ceil(maxVal))
  const slot = innerW / 12

  return (
    <div style={{ overflowX:'auto' }}>
      <svg width={W} height={H} style={{ display:'block', minWidth:W }}>
        {[0, 0.5, 1].map(p => {
          const y = PAD_T + innerH - p*innerH
          return (
            <g key={p}>
              <line x1={PAD_L} y1={y} x2={PAD_L+innerW} y2={y} stroke={COLORS.slate100} strokeDasharray={p === 0 ? '' : '3 3'}/>
              <text x={PAD_L - 6} y={y+4} textAnchor="end" fontSize="9" fill={COLORS.slate500} fontFamily="var(--font-mono)">{Math.round(nice*p)}</text>
            </g>
          )
        })}
        {porMes.map((m, i) => {
          const cx = PAD_L + slot*i + slot/2
          const bw = Math.min(slot*0.7, 28)
          const hCon = (m.conContrato/nice)*innerH
          const hSin = (m.sinDoc/nice)*innerH
          const total = hCon + hSin
          return (
            <g key={i}>
              {hSin > 0 && <rect x={cx - bw/2} y={PAD_T + innerH - total} width={bw} height={hSin} fill={COLORS.slate400}/>}
              {hCon > 0 && <rect x={cx - bw/2} y={PAD_T + innerH - hCon} width={bw} height={hCon} fill={COLORS.teal}/>}
              <text x={cx} y={H - 10} textAnchor="middle" fontSize="9" fill={COLORS.slate500} fontFamily="var(--font-mono)">{MESES_ES[i]}</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function DonutCotizaciones({ cotizaciones }) {
  const buckets = {
    Aprobada:  { count: cotizaciones.filter(c => c.estado === 'Aprobada').length,  color: COLORS.teal },
    Enviada:   { count: cotizaciones.filter(c => ['Enviada','En revisión'].includes(c.estado)).length, color: '#3B82F6' },
    Rechazada: { count: cotizaciones.filter(c => c.estado === 'Rechazada').length, color: COLORS.red },
    Borrador:  { count: cotizaciones.filter(c => c.estado === 'Borrador').length,  color: COLORS.slate400 },
  }
  const total = Object.values(buckets).reduce((s,b) => s+b.count, 0)

  const CX = 100, CY = 100, R = 70
  let acum = 0
  const paths = []
  Object.entries(buckets).forEach(([k, b]) => {
    if (b.count === 0 || total === 0) return
    const startAngle = (acum/total)*2*Math.PI
    const endAngle = ((acum+b.count)/total)*2*Math.PI
    const large = (endAngle-startAngle) > Math.PI ? 1 : 0
    const x1 = CX + R*Math.cos(startAngle-Math.PI/2)
    const y1 = CY + R*Math.sin(startAngle-Math.PI/2)
    const x2 = CX + R*Math.cos(endAngle-Math.PI/2)
    const y2 = CY + R*Math.sin(endAngle-Math.PI/2)
    paths.push(<path key={k} d={`M ${CX} ${CY} L ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} Z`} fill={b.color}/>)
    acum += b.count
  })

  return (
    <div style={{ display:'flex', alignItems:'center', gap:20, flexWrap:'wrap' }}>
      <svg width="200" height="200">
        {total === 0
          ? <circle cx={CX} cy={CY} r={R} fill={COLORS.slate50} stroke={COLORS.slate100}/>
          : paths
        }
        <circle cx={CX} cy={CY} r={42} fill="white"/>
        <text x={CX} y={CY-4} textAnchor="middle" fontSize="22" fontWeight="500" fill={COLORS.navy} fontFamily="var(--font-serif)">{total}</text>
        <text x={CX} y={CY+14} textAnchor="middle" fontSize="10" fill={COLORS.slate500}>total</text>
      </svg>
      <div style={{ flex:1, minWidth:140 }}>
        {Object.entries(buckets).map(([k, b]) => (
          <div key={k} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 0', borderBottom:`1px solid ${COLORS.slate50}` }}>
            <span style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:COLORS.ink }}>
              <span style={{ width:10, height:10, borderRadius:2, background:b.color }}/>{k}
            </span>
            <span style={{ fontSize:12, fontFamily:'var(--font-mono)', color:COLORS.slate600, fontWeight:600 }}>{b.count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function RedSocial({ titulo, color, metrics, data, onChange, isMobile }) {
  const [editMetric, setEditMetric] = useState(null)

  return (
    <div style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, padding:18, marginBottom:16 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
        <h3 style={{ fontSize:14, fontWeight:600, color:COLORS.ink, margin:0, fontFamily:'var(--font-serif)', display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ width:12, height:12, borderRadius:3, background:color }}/>
          {titulo}
        </h3>
        <div style={{ display:'flex', gap:14, fontSize:11 }}>
          <Leyenda color={COLORS.slate400} label="Semana 1"/>
          <Leyenda color={color} label="Semana 2"/>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : `repeat(${metrics.length}, 1fr)`, gap:14 }}>
        {metrics.map(m => {
          const v1 = data.s1[m] || 0
          const v2 = data.s2[m] || 0
          const max = Math.max(v1, v2, 1)
          return (
            <div key={m} style={{ background:COLORS.slate50, borderRadius:8, padding:12, textAlign:'center' }}>
              <div style={{ fontSize:10, fontWeight:700, color:COLORS.slate500, textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:10 }}>{m}</div>
              <div style={{ display:'flex', gap:6, alignItems:'flex-end', justifyContent:'center', height:80, marginBottom:8 }}>
                <div style={{ width:16, height: `${(v1/max)*80}px`, background:COLORS.slate400, borderRadius:'3px 3px 0 0', minHeight:2, cursor:'pointer' }}
                  onClick={() => {
                    const nuevo = prompt(`${m} - Semana 1:`, v1)
                    if (nuevo !== null) onChange({ ...data, s1: { ...data.s1, [m]: Number(nuevo)||0 } })
                  }}/>
                <div style={{ width:16, height: `${(v2/max)*80}px`, background:color, borderRadius:'3px 3px 0 0', minHeight:2, cursor:'pointer' }}
                  onClick={() => {
                    const nuevo = prompt(`${m} - Semana 2:`, v2)
                    if (nuevo !== null) onChange({ ...data, s2: { ...data.s2, [m]: Number(nuevo)||0 } })
                  }}/>
              </div>
              <div style={{ display:'flex', justifyContent:'space-around', fontSize:11, fontFamily:'var(--font-mono)', color:COLORS.slate600, fontWeight:600 }}>
                <span>{v1}</span>
                <span>{v2}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ListaEditable({ titulo, items, setItems, color }) {
  const [nuevo, setNuevo] = useState('')
  const agregar = () => {
    if (!nuevo.trim()) return
    setItems([...items, nuevo.trim()])
    setNuevo('')
  }
  const quitar = (i) => setItems(items.filter((_, idx) => idx !== i))

  return (
    <div style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, padding:18 }}>
      <h3 style={{ fontSize:14, fontWeight:600, color:COLORS.ink, margin:0, marginBottom:14, fontFamily:'var(--font-serif)', display:'flex', alignItems:'center', gap:8 }}>
        <span style={{ width:3, height:14, background:color, borderRadius:2 }}/>
        {titulo}
      </h3>
      {items.length === 0 && <EmptyMini texto="Agrega tu primer objetivo"/>}
      {items.map((t, i) => (
        <div key={i} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 0', borderBottom:`1px solid ${COLORS.slate50}` }}>
          <span style={{ width:6, height:6, borderRadius:'50%', background:color, flexShrink:0 }}/>
          <span style={{ flex:1, fontSize:13, color:COLORS.ink }}>{t}</span>
          <button onClick={() => quitar(i)} style={{ border:'none', background:'transparent', color:COLORS.slate400, cursor:'pointer', padding:2, display:'flex' }}>{Icon('X')}</button>
        </div>
      ))}
      <div style={{ display:'flex', gap:6, marginTop:12 }}>
        <input value={nuevo} onChange={e => setNuevo(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && agregar()}
          placeholder="Agregar item..."
          style={{ flex:1, padding:'8px 10px', border:`1px solid ${COLORS.slate200}`, borderRadius:7, fontSize:12, outline:'none', fontFamily:'inherit' }}/>
        <button onClick={agregar} style={{ padding:'8px 14px', background:color, color:'white', border:'none', borderRadius:7, fontSize:12, fontWeight:600, cursor:'pointer' }}>+</button>
      </div>
    </div>
  )
}

function NotaRecordatorio({ titulo, items }) {
  return (
    <div style={{ background:'linear-gradient(to right, #F0F9FF, white)', border:`1px solid #BFDBFE`, borderRadius:12, padding:18, marginTop:16 }}>
      <h3 style={{ fontSize:13, fontWeight:700, color:'#1E3A8A', margin:0, marginBottom:12, fontFamily:'var(--font-serif)' }}>{titulo}</h3>
      {items.map((t, i) => (
        <div key={i} style={{ display:'flex', gap:8, padding:'4px 0', fontSize:12, color:'#1E40AF' }}>
          <span>•</span><span>{t}</span>
        </div>
      ))}
    </div>
  )
}

// ============================================================
// v12: VISTA PERSONAS — Capacidad y KPIs por colaborador (Luis)
// ============================================================
function VistaPersonas({ data, onNavigate, isMobile }) {
  const { actividades, usuarios } = data

  const carga = useMemo(
    () => calcularCargaPorColaborador(actividades || [], usuarios || []),
    [actividades, usuarios]
  )

  // Orden: sobrecargados primero, luego por % carga descendente
  const ordenada = [...carga].sort((a, b) => {
    if (a.sobrecargado !== b.sobrecargado) return a.sobrecargado ? -1 : 1
    return b.porcentaje - a.porcentaje
  })

  const sobrecargados = carga.filter(c => c.sobrecargado).length
  const subutilizados = carga.filter(c => c.subutilizado).length
  const capacidadTotal = carga.reduce((s, c) => s + c.capacidad, 0)
  const horasAsignadas = carga.reduce((s, c) => s + c.horasSemana, 0)
  const cargaGlobalPct = capacidadTotal > 0 ? Math.round((horasAsignadas / capacidadTotal) * 100) : 0

  // Cuellos de botella
  const cuellos = useMemo(() => identificarCuellosBotella(actividades || []), [actividades])

  return (
    <>
      {/* KPIs arriba */}
      <div style={{ display:'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap:12, marginBottom:20 }}>
        <KpiHero label="Colaboradores" valor={carga.length} sub="activos" color={COLORS.navy}/>
        <KpiHero
          label="Carga global"
          valor={`${cargaGlobalPct}%`}
          sub={`${horasAsignadas}h de ${capacidadTotal}h`}
          color={cargaGlobalPct > 100 ? COLORS.red : cargaGlobalPct >= 70 ? COLORS.teal : COLORS.amber}
        />
        <KpiHero
          label="Sobrecargados"
          valor={sobrecargados}
          sub={sobrecargados > 0 ? '> 100% carga' : 'ninguno'}
          color={sobrecargados > 0 ? COLORS.red : COLORS.teal}
        />
        <KpiHero
          label="Subutilizados"
          valor={subutilizados}
          sub={subutilizados > 0 ? '< 50% carga' : 'ninguno'}
          color={subutilizados > 0 ? COLORS.amber : COLORS.teal}
        />
      </div>

      {/* Cuellos de botella (Luis) */}
      {cuellos.porEtapa.length > 0 && (
        <div style={{ background:'white', border:`1px solid #FECACA`, borderLeft:`3px solid ${COLORS.red}`, borderRadius:12, padding:18, marginBottom:16 }}>
          <h3 style={{ fontSize:14, fontWeight:600, color:COLORS.red, margin:0, marginBottom:12, fontFamily:'var(--font-serif)' }}>
            🚨 Cuellos de botella detectados
          </h3>
          <div style={{ fontSize:11, color:COLORS.slate500, marginBottom:12 }}>
            {cuellos.retrasadas.length} actividad(es) retrasadas · agrupadas por etapa más recurrente:
          </div>
          <div style={{ display:'grid', gap:8 }}>
            {cuellos.porEtapa.map((e, i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'8px 12px', background:'#FEF2F2', borderRadius:8 }}>
                <div style={{ flex:1, fontSize:12, color:COLORS.ink, fontWeight:500 }}>{e.nombre}</div>
                <div style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:4, background:COLORS.red, color:'white' }}>
                  {e.count} actividad(es)
                </div>
                <div style={{ fontSize:11, fontFamily:'var(--font-mono)', fontWeight:700, color:COLORS.red, minWidth:80, textAlign:'right' }}>
                  +{Math.round(e.totalDias / e.count)}d promedio
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lista de colaboradores */}
      <div style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, padding:18 }}>
        <h3 style={{ fontSize:14, fontWeight:600, color:COLORS.ink, margin:0, marginBottom:14, fontFamily:'var(--font-serif)' }}>
          Capacidad y KPIs por colaborador · esta semana
        </h3>
        {ordenada.length === 0 && (
          <div style={{ padding:30, textAlign:'center', color:COLORS.slate400, fontSize:12 }}>
            Sin colaboradores cargados
          </div>
        )}
        <div style={{ display:'grid', gap:10 }}>
          {ordenada.map(c => <PersonaCard key={c.usuario.id} carga={c} isMobile={isMobile}/>)}
        </div>
      </div>

      <div style={{ background:'linear-gradient(to right, #F0F9FF, white)', border:`1px solid #BFDBFE`, borderRadius:12, padding:18, marginTop:16 }}>
        <h3 style={{ fontSize:13, fontWeight:700, color:'#1E3A8A', margin:0, marginBottom:12, fontFamily:'var(--font-serif)' }}>Fórmulas (Luis)</h3>
        {[
          'Capacidad = horas/semana configurables por colaborador (default 40h)',
          'Carga = Σ(días traslapados con esta semana × 8h) / capacidad',
          'Sobrecarga: > 100% · Subutilización: < 50% con actividades asignadas',
          'Tiempo promedio: días reales de actividades completadas por este colaborador',
          'Desviación: (días reales − duración estimada) / duración estimada',
        ].map((t, i) => (
          <div key={i} style={{ display:'flex', gap:8, padding:'4px 0', fontSize:12, color:'#1E40AF' }}>
            <span>•</span><span>{t}</span>
          </div>
        ))}
      </div>
    </>
  )
}

function PersonaCard({ carga, isMobile }) {
  const { usuario, asignadas, horasSemana, capacidad, porcentaje, sobrecargado, subutilizado, tiempoPromedioDias, desviacionPct, completadas } = carga
  const color = sobrecargado ? COLORS.red : porcentaje >= 70 ? COLORS.teal : subutilizado ? COLORS.amber : COLORS.slate500
  const pctVisible = Math.min(100, porcentaje)

  return (
    <div style={{
      padding:14,
      background: sobrecargado ? '#FEF2F2' : subutilizado ? '#FEF3C7' : 'white',
      border: `1px solid ${sobrecargado ? '#FECACA' : subutilizado ? '#FDE68A' : COLORS.slate100}`,
      borderLeft: `3px solid ${color}`,
      borderRadius: 10,
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:10, flexWrap:'wrap' }}>
        <div style={{
          width:36, height:36, borderRadius:'50%',
          background:COLORS.navy, color:'white',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:14, fontWeight:700, flexShrink:0,
        }}>
          {usuario.nombre?.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?'}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:13, fontWeight:600, color:COLORS.ink }}>{usuario.nombre}</div>
          <div style={{ fontSize:10, color:COLORS.slate500, marginTop:2 }}>
            {usuario.rol} · {asignadas} actividad(es) activa(s)
            {sobrecargado && <span style={{ marginLeft:6, color:COLORS.red, fontWeight:700 }}>· SOBRECARGADO</span>}
            {subutilizado && <span style={{ marginLeft:6, color:COLORS.amber, fontWeight:700 }}>· SUBUTILIZADO</span>}
          </div>
        </div>
        <div style={{ textAlign:'right' }}>
          <div style={{ fontSize:20, fontFamily:'var(--font-mono)', fontWeight:700, color }}>
            {porcentaje}%
          </div>
          <div style={{ fontSize:10, color:COLORS.slate500, fontFamily:'var(--font-mono)' }}>
            {horasSemana}h / {capacidad}h
          </div>
        </div>
      </div>

      {/* Barra de capacidad */}
      <div style={{ position:'relative', height:12, background:COLORS.slate50, borderRadius:6, overflow:'hidden', marginBottom:10 }}>
        <div style={{ width:`${pctVisible}%`, height:'100%', background:color, borderRadius:6, transition:'width 0.3s' }}/>
        {porcentaje > 100 && (
          <div style={{ position:'absolute', right:4, top:0, bottom:0, display:'flex', alignItems:'center', fontSize:9, fontWeight:700, color:'white' }}>
            +{porcentaje - 100}%
          </div>
        )}
      </div>

      {/* KPIs (solo desktop) */}
      {!isMobile && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:10, fontSize:11 }}>
          <div style={{ padding:'8px 10px', background:COLORS.slate50, borderRadius:6 }}>
            <div style={{ fontSize:9, fontWeight:700, color:COLORS.slate500, textTransform:'uppercase', marginBottom:2 }}>Completadas</div>
            <div style={{ fontSize:14, fontWeight:600, color:COLORS.navy, fontFamily:'var(--font-mono)' }}>{completadas}</div>
          </div>
          <div style={{ padding:'8px 10px', background:COLORS.slate50, borderRadius:6 }}>
            <div style={{ fontSize:9, fontWeight:700, color:COLORS.slate500, textTransform:'uppercase', marginBottom:2 }}>Tiempo promedio</div>
            <div style={{ fontSize:14, fontWeight:600, color:COLORS.navy, fontFamily:'var(--font-mono)' }}>
              {tiempoPromedioDias ? `${tiempoPromedioDias}d` : '—'}
            </div>
          </div>
          <div style={{ padding:'8px 10px', background: desviacionPct > 20 ? '#FEF2F2' : desviacionPct < -10 ? '#E1F5EE' : COLORS.slate50, borderRadius:6 }}>
            <div style={{ fontSize:9, fontWeight:700, color:COLORS.slate500, textTransform:'uppercase', marginBottom:2 }}>Desviación</div>
            <div style={{ fontSize:14, fontWeight:600, fontFamily:'var(--font-mono)', color: desviacionPct > 20 ? COLORS.red : desviacionPct < -10 ? COLORS.teal : COLORS.navy }}>
              {desviacionPct > 0 ? '+' : ''}{desviacionPct}%
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// v12.5: COMPONENTES AUXILIARES PARA NUEVOS WIDGETS ADMIN
// ============================================================

// Gráfico de barras mensuales (para Cotizado y Aceptado del mes)
function GraficoBarrasMensuales({ valores, color, formato, onEditar, isMobile }) {
  const H = 180
  const W = isMobile ? 520 : 450
  const PAD_L = 50, PAD_R = 10, PAD_T = 14, PAD_B = 32
  const innerW = W - PAD_L - PAD_R
  const innerH = H - PAD_T - PAD_B
  const maxVal = Math.max(...valores, 1)
  const nice = formato === 'money' ? niceMax(maxVal) : Math.max(5, Math.ceil(maxVal))
  const slot = innerW / 12

  const fmtY = (v) => {
    if (formato === 'money') {
      if (v >= 1000000) return `$${(v/1000000).toFixed(0)}M`
      if (v >= 1000) return `$${(v/1000).toFixed(0)}k`
      return `$${v}`
    }
    return String(Math.round(v))
  }

  return (
    <div style={{ overflowX:'auto' }}>
      <svg width={W} height={H} style={{ display:'block', minWidth:W }}>
        {[0, 0.25, 0.5, 0.75, 1].map(p => {
          const y = PAD_T + innerH - p*innerH
          return (
            <g key={p}>
              <line x1={PAD_L} y1={y} x2={PAD_L+innerW} y2={y} stroke={COLORS.slate100} strokeDasharray={p === 0 ? '' : '3 3'}/>
              <text x={PAD_L - 6} y={y+4} textAnchor="end" fontSize="9" fill={COLORS.slate500} fontFamily="var(--font-mono)">{fmtY(nice*p)}</text>
            </g>
          )
        })}
        {valores.map((v, i) => {
          const cx = PAD_L + slot*i + slot/2
          const bw = Math.min(slot*0.6, 22)
          const h = (v/nice)*innerH
          return (
            <g key={i} onClick={() => onEditar && onEditar(i)} style={{ cursor: onEditar ? 'pointer' : 'default' }}>
              <rect x={cx - bw/2} y={PAD_T + innerH - h} width={bw} height={h} fill={color} rx="2"/>
              <text x={cx} y={H - 10} textAnchor="middle" fontSize="9" fill={COLORS.slate500} fontFamily="var(--font-mono)">{MESES_ES[i]}</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// Donut de Gastos variables (Servicios / Otros / Préstamos)
function DonutGastos({ categorias, total, onEditar }) {
  const colores = { Servicios:'#60A5FA', Otros:'#93C5FD', Prestamos:COLORS.navy }
  const CX = 110, CY = 110, R = 80
  let acum = 0
  const paths = []
  Object.entries(categorias).forEach(([k, v]) => {
    if (v === 0 || total === 0) return
    const startAngle = (acum/total)*2*Math.PI
    const endAngle = ((acum+v)/total)*2*Math.PI
    const large = (endAngle-startAngle) > Math.PI ? 1 : 0
    const x1 = CX + R*Math.cos(startAngle-Math.PI/2)
    const y1 = CY + R*Math.sin(startAngle-Math.PI/2)
    const x2 = CX + R*Math.cos(endAngle-Math.PI/2)
    const y2 = CY + R*Math.sin(endAngle-Math.PI/2)
    paths.push(<path key={k} d={`M ${CX} ${CY} L ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} Z`} fill={colores[k] || COLORS.slate400}/>)
    acum += v
  })

  return (
    <div style={{ display:'flex', alignItems:'center', gap:14, flexWrap:'wrap' }}>
      <svg width="220" height="220">
        {total === 0
          ? <circle cx={CX} cy={CY} r={R} fill={COLORS.slate50} stroke={COLORS.slate100}/>
          : paths
        }
        <circle cx={CX} cy={CY} r={50} fill="white"/>
        <text x={CX} y={CY-4} textAnchor="middle" fontSize="12" fill={COLORS.slate500}>TOTAL</text>
        <text x={CX} y={CY+16} textAnchor="middle" fontSize="16" fontWeight="600" fill={COLORS.navy} fontFamily="var(--font-serif)">
          {total >= 1000000 ? `$${(total/1000000).toFixed(2)}M` : total >= 1000 ? `$${(total/1000).toFixed(0)}k` : `$${total}`}
        </text>
      </svg>
      <div style={{ flex:1, minWidth:140 }}>
        {Object.entries(categorias).map(([k, v]) => {
          const pct = total > 0 ? Math.round((v/total)*100) : 0
          return (
            <div key={k} onClick={() => onEditar && onEditar(k)} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:`1px solid ${COLORS.slate50}`, cursor: onEditar ? 'pointer' : 'default' }}>
              <span style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:COLORS.ink }}>
                <span style={{ width:12, height:12, borderRadius:3, background:colores[k] || COLORS.slate400 }}/>
                {k} <span style={{ color:COLORS.slate400, fontSize:10 }}>{pct}%</span>
              </span>
              <span style={{ fontSize:11, fontFamily:'var(--font-mono)', color:COLORS.slate600, fontWeight:600 }}>{fmtMoney(v, true)}</span>
            </div>
          )
        })}
        <div style={{ fontSize:10, color:COLORS.slate400, marginTop:8, fontStyle:'italic' }}>Click en fila para editar</div>
      </div>
    </div>
  )
}

// Gráfico de línea histórico (gastos variables 2024/2025/2026)
function GraficoLineaHistorico({ series, isMobile }) {
  const H = 220
  const W = isMobile ? 580 : 500
  const PAD_L = 40, PAD_R = 10, PAD_T = 14, PAD_B = 32
  const innerW = W - PAD_L - PAD_R
  const innerH = H - PAD_T - PAD_B

  const allValues = Object.values(series).flat().filter(v => v > 0)
  const maxVal = Math.max(...allValues, 1)
  const nice = Math.ceil(maxVal/1000)*1000
  const slot = innerW / 11 // 12 meses = 11 espacios

  const coloresSerie = { '2024':'#93C5FD', '2025':COLORS.navy, '2026':'#1F2937' }

  const pathPara = (arr) => {
    return arr.map((v, i) => {
      const x = PAD_L + slot*i
      const y = PAD_T + innerH - (v/nice)*innerH
      if (v === 0 && i > 3) return null // no dibujar ceros futuros
      return `${i === 0 || arr[i-1] === 0 ? 'M' : 'L'} ${x} ${y}`
    }).filter(Boolean).join(' ')
  }

  return (
    <div style={{ overflowX:'auto' }}>
      <svg width={W} height={H} style={{ display:'block', minWidth:W }}>
        {[0, 0.25, 0.5, 0.75, 1].map(p => {
          const y = PAD_T + innerH - p*innerH
          return (
            <g key={p}>
              <line x1={PAD_L} y1={y} x2={PAD_L+innerW} y2={y} stroke={COLORS.slate100} strokeDasharray={p === 0 ? '' : '3 3'}/>
              <text x={PAD_L - 6} y={y+4} textAnchor="end" fontSize="9" fill={COLORS.slate500} fontFamily="var(--font-mono)">
                {Math.round(nice*p/1000)}k
              </text>
            </g>
          )
        })}
        {Object.entries(series).map(([anio, arr]) => (
          <g key={anio}>
            <path d={pathPara(arr)} fill="none" stroke={coloresSerie[anio]} strokeWidth="2"/>
            {arr.map((v, i) => {
              if (v === 0) return null
              const x = PAD_L + slot*i
              const y = PAD_T + innerH - (v/nice)*innerH
              return <circle key={i} cx={x} cy={y} r="3" fill={coloresSerie[anio]}/>
            })}
          </g>
        ))}
        {MESES_ES.map((m, i) => (
          <text key={i} x={PAD_L + slot*i} y={H - 10} textAnchor="middle" fontSize="9" fill={COLORS.slate500} fontFamily="var(--font-mono)">{m}</text>
        ))}
      </svg>
    </div>
  )
}

// Helper: redondea a un "nice" máximo para el eje Y
function niceMax(v) {
  if (v <= 0) return 1
  const mag = Math.pow(10, Math.floor(Math.log10(v)))
  const n = v / mag
  if (n <= 1) return mag
  if (n <= 2) return 2 * mag
  if (n <= 5) return 5 * mag
  return 10 * mag
}