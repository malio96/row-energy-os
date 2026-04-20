import { useState, useEffect, useMemo } from 'react'
import { getProyectos, getCotizaciones, getLeads, getHitos, getFacturas, getCompras, getPostventaTickets } from './supabase'
import { COLORS, ETAPAS_LEAD, Badge, fmtMoney, fmtDate, daysUntil, relativeTime, btnPrimary, Icon, LoadingState, useIsMobile } from './helpers'

export default function Dashboard({ usuario, onNavigate }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const isMobile = useIsMobile()

  useEffect(() => {
    const cargar = async () => {
      setLoading(true)
      const [proyectos, cotizaciones, leads, hitos, facturas, compras, tickets] = await Promise.all([
        getProyectos(), getCotizaciones(), getLeads(), getHitos(), getFacturas(), getCompras(), getPostventaTickets()
      ])
      setData({ proyectos, cotizaciones, leads, hitos, facturas, compras, tickets })
      setLoading(false)
    }
    cargar()
  }, [])

  if (loading || !data) return <LoadingState/>

  const { proyectos, cotizaciones, leads, hitos, facturas, compras, tickets } = data

  // ============ KPIs ============
  const proyectosActivos = proyectos.filter(p => p.estado !== 'Terminado' && p.estado !== 'Cancelado')
  const cotizacionesPipeline = cotizaciones.filter(c => ['Borrador', 'Enviada', 'En revisión'].includes(c.estado))
  const cotizacionesAprobadas = cotizaciones.filter(c => c.estado === 'Aprobada')
  const leadsActivos = leads.filter(l => !['Ganado', 'Perdido'].includes(l.etapa))
  const ponderado = leadsActivos.reduce((s,l) => s + (Number(l.monto_estimado) * Number(l.probabilidad) / 100), 0)

  const porCobrar = hitos.filter(h => ['Pendiente', 'Facturado'].includes(h.estado)).reduce((s,h) => s + Number(h.monto), 0)
  const vencido = hitos.filter(h => {
    if (h.estado === 'Cobrado' || h.estado === 'Cancelado') return false
    const d = daysUntil(h.fecha_esperada)
    return d !== null && d < 0
  }).reduce((s,h) => s + Number(h.monto), 0)

  const cobradoMes = hitos.filter(h => {
    if (h.estado !== 'Cobrado' || !h.fecha_cobro) return false
    const d = new Date(h.fecha_cobro)
    const hoy = new Date()
    return d.getMonth() === hoy.getMonth() && d.getFullYear() === hoy.getFullYear()
  }).reduce((s,h) => s + Number(h.monto), 0)

  // ============ Pipeline por etapa ============
  const pipelinePorEtapa = ETAPAS_LEAD.filter(e => !['Ganado', 'Perdido'].includes(e.key)).map(etapa => {
    const leadsEtapa = leads.filter(l => l.etapa === etapa.key)
    return {
      etapa: etapa.key,
      color: etapa.color,
      bg: etapa.bg,
      count: leadsEtapa.length,
      monto: leadsEtapa.reduce((s,l) => s + Number(l.monto_estimado || 0), 0),
    }
  })
  const maxMonto = Math.max(...pipelinePorEtapa.map(p => p.monto), 1)

  // ============ Aging ============
  const aging = { '0-30':0, '31-60':0, '61-90':0, '+90':0 }
  hitos.forEach(h => {
    if (h.estado === 'Cobrado' || h.estado === 'Cancelado') return
    const d = daysUntil(h.fecha_esperada)
    if (d === null || d >= 0) return
    const diasVencido = Math.abs(d)
    if (diasVencido <= 30) aging['0-30'] += Number(h.monto)
    else if (diasVencido <= 60) aging['31-60'] += Number(h.monto)
    else if (diasVencido <= 90) aging['61-90'] += Number(h.monto)
    else aging['+90'] += Number(h.monto)
  })

  // ============ Proyectos en riesgo ============
  const proyectosRiesgo = proyectosActivos.filter(p => {
    const dias = daysUntil(p.cierre)
    return dias !== null && dias < 30 && dias > 0
  })

  // ============ Alertas ============
  const alertas = []
  if (vencido > 0) alertas.push({ tipo:'cobranza', titulo:`${fmtMoney(vencido, true)} en cobranza vencida`, nav:'cobranza', color:COLORS.red })
  const comprasPendientes = compras.filter(c => c.estado === 'Solicitada')
  if (comprasPendientes.length > 0) alertas.push({ tipo:'compras', titulo:`${comprasPendientes.length} compras esperando aprobación`, nav:'compras', color:COLORS.amber })
  const ticketsAlta = tickets.filter(t => t.prioridad === 'Alta' && t.estado !== 'Resuelto' && t.estado !== 'Cerrado')
  if (ticketsAlta.length > 0) alertas.push({ tipo:'tickets', titulo:`${ticketsAlta.length} tickets de alta prioridad abiertos`, nav:'postventa', color:COLORS.red })
  if (proyectosRiesgo.length > 0) alertas.push({ tipo:'proyectos', titulo:`${proyectosRiesgo.length} proyecto(s) con cierre próximo (<30 días)`, nav:'proyectos', color:COLORS.amber })

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom:20 }}>
        <h1 style={{ fontSize: isMobile ? 24 : 32, fontWeight:400, color:COLORS.navy, margin:0, letterSpacing:'-0.02em', fontFamily:'var(--font-serif)' }}>
          Hola, {usuario.nombre?.split(' ')[0] || 'Malio'}
        </h1>
        <p style={{ color:COLORS.slate500, fontSize:13, marginTop:4 }}>Resumen ejecutivo · {new Date().toLocaleDateString('es-MX', { weekday:'long', day:'numeric', month:'long' })}</p>
      </div>

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
        <KpiHero label="Cobrado este mes" valor={fmtMoney(cobradoMes, true)} sub="MXN" color={COLORS.gold} onClick={() => onNavigate?.('facturacion')}/>
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
                <div style={{ width:`${(p.monto/maxMonto)*100}%`, height:'100%', background: p.color, borderRadius:5, transition:'width 0.3s', minWidth: p.monto > 0 ? 4 : 0 }}/>
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
            const c = bucket === '+90' ? COLORS.red : bucket === '61-90' ? COLORS.amber : bucket === '31-60' ? COLORS.gold : COLORS.slate400
            return (
              <div key={bucket} style={{ marginBottom:10 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                  <span style={{ fontSize:11, color:COLORS.slate600 }}>{bucket} días</span>
                  <span style={{ fontSize:11, fontWeight:600, color:c, fontFamily:'var(--font-mono)' }}>{fmtMoney(monto, true)}</span>
                </div>
                <div style={{ height:6, background:COLORS.slate50, borderRadius:3, overflow:'hidden' }}>
                  <div style={{ width:`${pct}%`, height:'100%', background:c, borderRadius:3 }}/>
                </div>
              </div>
            )
          })}
          {vencido === 0 && <div style={{ padding:20, textAlign:'center', color:COLORS.teal, fontSize:12, fontWeight:500 }}>✓ Sin cobranza vencida</div>}
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap:16, marginBottom:20 }}>
        {/* Proyectos en riesgo */}
        <div style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, padding:18 }}>
          <h3 style={{ fontSize:13, fontWeight:600, color:COLORS.ink, margin:0, marginBottom:14 }}>Proyectos con cierre próximo</h3>
          {proyectosRiesgo.length === 0 ? (
            <div style={{ padding:20, textAlign:'center', color:COLORS.slate500, fontSize:12 }}>Ningún proyecto con cierre en los próximos 30 días</div>
          ) : (
            proyectosRiesgo.slice(0, 5).map(p => {
              const dias = daysUntil(p.cierre)
              return (
                <div key={p.id} onClick={() => onNavigate?.('proyectos')} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom:`1px solid ${COLORS.slate100}`, cursor:'pointer' }}>
                  <div>
                    <div style={{ fontSize:12, fontWeight:500, color:COLORS.ink }}>{p.nombre}</div>
                    <div style={{ fontSize:10, color:COLORS.slate500 }}>{p.cliente?.razon_social} · {p.codigo}</div>
                  </div>
                  <span style={{ fontSize:11, fontWeight:600, color: dias < 7 ? COLORS.red : COLORS.amber }}>{dias}d</span>
                </div>
              )
            })
          )}
        </div>

        {/* Cotizaciones recientes */}
        <div style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, padding:18 }}>
          <h3 style={{ fontSize:13, fontWeight:600, color:COLORS.ink, margin:0, marginBottom:14 }}>Cotizaciones pipeline</h3>
          {cotizacionesPipeline.length === 0 ? (
            <div style={{ padding:20, textAlign:'center', color:COLORS.slate500, fontSize:12 }}>Sin cotizaciones en pipeline</div>
          ) : (
            cotizacionesPipeline.slice(0, 5).map(c => (
              <div key={c.id} onClick={() => onNavigate?.('cotizaciones')} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom:`1px solid ${COLORS.slate100}`, cursor:'pointer' }}>
                <div>
                  <div style={{ fontSize:12, fontWeight:500, color:COLORS.ink }}>{c.nombre_proyecto}</div>
                  <div style={{ fontSize:10, color:COLORS.slate500 }}>{c.cliente?.razon_social} · {c.codigo}</div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontSize:12, fontWeight:600, color:COLORS.navy, fontFamily:'var(--font-mono)' }}>{fmtMoney(c.total, true)}</div>
                  <div style={{ fontSize:9, color:COLORS.slate500 }}>{c.estado}</div>
                </div>
              </div>
            ))
          )}
        </div>
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
    </div>
  )
}

function KpiHero({ label, valor, sub, color, onClick }) {
  return (
    <div onClick={onClick} style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, padding:16, cursor: onClick ? 'pointer' : 'default', transition:'all 0.15s' }}
      onMouseEnter={e => { if (onClick) e.currentTarget.style.boxShadow='0 4px 16px rgba(10,37,64,0.08)' }}
      onMouseLeave={e => { if (onClick) e.currentTarget.style.boxShadow='none' }}>
      <div style={{ fontSize:10, fontWeight:600, color:COLORS.slate500, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>{label}</div>
      <div style={{ fontSize:26, fontWeight:500, color, fontFamily:'var(--font-serif)', lineHeight:1, marginBottom:4 }}>{valor}</div>
      <div style={{ fontSize:11, color:COLORS.slate500 }}>{sub}</div>
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