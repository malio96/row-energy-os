import { useState, useEffect, useMemo } from 'react'
import { getHitos, actualizarHito } from './supabase'
import { COLORS, ESTADOS_HITO, Badge, fmtMoney, fmtDate, daysUntil, inputStyle, selectStyle, labelStyle, btnPrimary, btnSecondary, Icon, EmptyState, LoadingState, useIsMobile, loadPref, savePref } from './helpers'

// ============================================================
// CONFIG — lo que pidió la jefa de admin
// ============================================================
const MESES_ES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const META_COBRANZA_MENSUAL = 2500000  // $2.5M — ajústalo aquí o desde config

const CLIENTES_WATCHLIST = [
  'Cielo Azul', 'GKN', 'Energia Real', 'Energía Real',
  'MITINFRA', 'SHARL', 'EDP', 'Arizmendi', 'Arizmerndi'
]

// ============================================================
// COBRANZA v10
// ============================================================
export default function Cobranza({ usuario }) {
  const [hitos, setHitos] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState(loadPref('cob_tab', 'hitos'))
  const [filtro, setFiltro] = useState(loadPref('cob_filtro', 'Todos'))
  const [busqueda, setBusqueda] = useState('')
  const [clienteSel, setClienteSel] = useState(null)
  const isMobile = useIsMobile()

  const cargar = async () => { setLoading(true); setHitos(await getHitos()); setLoading(false) }
  useEffect(() => { cargar() }, [])
  useEffect(() => { savePref('cob_filtro', filtro); savePref('cob_tab', tab) }, [filtro, tab])

  // Enriquecer hitos con cálculos derivados
  const enriquecidos = useMemo(() => hitos.map(h => {
    const vence = daysUntil(h.fecha_esperada)
    const esVencido = h.estado !== 'Cobrado' && h.estado !== 'Cancelado' && vence !== null && vence < 0
    return { ...h, diasVence: vence, esVencido, diasVencido: esVencido ? Math.abs(vence) : 0 }
  }), [hitos])

  // KPIs globales
  const kpis = useMemo(() => {
    const porCobrar = enriquecidos.filter(h => ['Pendiente', 'Facturado'].includes(h.estado)).reduce((s,h) => s + Number(h.monto || 0), 0)
    const cobrado = enriquecidos.filter(h => h.estado === 'Cobrado').reduce((s,h) => s + Number(h.monto || 0), 0)
    const vencido = enriquecidos.filter(h => h.esVencido || h.estado === 'Vencido').reduce((s,h) => s + Number(h.monto || 0), 0)
    const cobradosConFechas = enriquecidos.filter(h => h.estado === 'Cobrado' && h.fecha_facturacion && h.fecha_cobro)
    const dso = cobradosConFechas.length > 0
      ? Math.round(cobradosConFechas.reduce((s,h) => s + ((new Date(h.fecha_cobro) - new Date(h.fecha_facturacion)) / 86400000), 0) / cobradosConFechas.length)
      : 0
    return { porCobrar, cobrado, vencido, dso }
  }, [enriquecidos])

  const cambiarEstado = async (id, nuevo) => {
    const cambios = { estado: nuevo }
    if (nuevo === 'Facturado') cambios.fecha_facturacion = new Date().toISOString().split('T')[0]
    if (nuevo === 'Cobrado')   cambios.fecha_cobro       = new Date().toISOString().split('T')[0]
    try { await actualizarHito(id, cambios); cargar() }
    catch (e) { alert('Error: ' + e.message) }
  }

  if (loading) return <LoadingState/>

  const TABS = [
    { key:'hitos',    label:'Hitos',        icon:'File'  },
    { key:'clientes', label:'Por cliente',  icon:'Users' },
    { key:'meta',     label:'META vs REAL', icon:'TrendUp' },
    { key:'semana',   label:'Semana',       icon:'Clock' },
  ]

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom:16 }}>
        <h1 style={{ fontSize: isMobile ? 24 : 32, fontWeight:400, color:COLORS.navy, margin:0, letterSpacing:'-0.02em', fontFamily:'var(--font-serif)' }}>Cobranza</h1>
        <p style={{ color:COLORS.slate500, fontSize:12, marginTop:4 }}>
          {hitos.length} hitos · DSO: <strong style={{ color:COLORS.navy }}>{kpis.dso} días</strong>
        </p>
      </div>

      {/* KPIs siempre visibles arriba */}
      <div style={{ display:'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(180px, 1fr))', gap:10, marginBottom:16 }}>
        <KpiCard label="Por cobrar" valor={fmtMoney(kpis.porCobrar, true)} color={COLORS.navy}      icon="Clock"/>
        <KpiCard label="Cobrado"    valor={fmtMoney(kpis.cobrado, true)}   color={COLORS.teal}      icon="Check"/>
        <KpiCard label="Vencido"    valor={fmtMoney(kpis.vencido, true)}   color={COLORS.red}       icon="Alert"/>
        <KpiCard label="DSO"        valor={`${kpis.dso} días`}              color={COLORS.gold || COLORS.amber} icon="TrendDown"/>
      </div>

      {/* Tabs selector */}
      <div style={{
        display:'flex', gap:4, marginBottom:16, overflowX:'auto',
        background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, padding:4,
        WebkitOverflowScrolling:'touch'
      }}>
        {TABS.map(t => {
          const active = tab === t.key
          return (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding:'8px 14px', border:'none',
              background: active ? COLORS.navy : 'transparent',
              color: active ? 'white' : COLORS.slate600,
              borderRadius:8, fontSize:12, fontWeight:600, cursor:'pointer',
              display:'flex', alignItems:'center', gap:6, whiteSpace:'nowrap',
              flexShrink:0, transition:'all 0.15s'
            }}>
              {Icon(t.icon)} {t.label}
            </button>
          )
        })}
      </div>

      {/* Contenido según tab */}
      {tab === 'hitos' && (
        <VistaHitos
          enriquecidos={enriquecidos}
          filtro={filtro} setFiltro={setFiltro}
          busqueda={busqueda} setBusqueda={setBusqueda}
          cambiarEstado={cambiarEstado}
          kpis={kpis}
          isMobile={isMobile}
        />
      )}
      {tab === 'clientes' && !clienteSel && (
        <VistaPorCliente
          enriquecidos={enriquecidos}
          onSelectCliente={setClienteSel}
          isMobile={isMobile}
        />
      )}
      {tab === 'clientes' && clienteSel && (
        <DetalleCliente
          cliente={clienteSel}
          enriquecidos={enriquecidos}
          onVolver={() => setClienteSel(null)}
          cambiarEstado={cambiarEstado}
          isMobile={isMobile}
        />
      )}
      {tab === 'meta'   && <VistaMetaReal enriquecidos={enriquecidos} isMobile={isMobile}/>}
      {tab === 'semana' && <VistaSemana   enriquecidos={enriquecidos} isMobile={isMobile}/>}
    </div>
  )
}

// ============================================================
// VISTA HITOS (la que ya existía - preservada 100%)
// ============================================================
function VistaHitos({ enriquecidos, filtro, setFiltro, busqueda, setBusqueda, cambiarEstado, kpis, isMobile }) {
  const filtrados = useMemo(() => {
    let r = enriquecidos
    if (filtro === 'Por cobrar') r = r.filter(h => ['Pendiente', 'Facturado'].includes(h.estado))
    else if (filtro === 'Cobrados') r = r.filter(h => h.estado === 'Cobrado')
    else if (filtro === 'Vencidos') r = r.filter(h => h.esVencido || h.estado === 'Vencido')
    else if (filtro === 'Por vencer') r = r.filter(h => !h.esVencido && h.estado !== 'Cobrado' && h.diasVence !== null && h.diasVence <= 7 && h.diasVence >= 0)
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase()
      r = r.filter(h =>
        h.nombre?.toLowerCase().includes(q) ||
        h.proyecto?.nombre?.toLowerCase().includes(q) ||
        h.proyecto?.cliente?.razon_social?.toLowerCase().includes(q)
      )
    }
    return r
  }, [enriquecidos, filtro, busqueda])

  // Aging Report
  const aging = useMemo(() => {
    const buckets = { '0-30':0, '31-60':0, '61-90':0, '+90':0 }
    enriquecidos.filter(h => h.esVencido || h.estado === 'Vencido').forEach(h => {
      const d = h.diasVencido
      if (d <= 30) buckets['0-30'] += Number(h.monto || 0)
      else if (d <= 60) buckets['31-60'] += Number(h.monto || 0)
      else if (d <= 90) buckets['61-90'] += Number(h.monto || 0)
      else buckets['+90'] += Number(h.monto || 0)
    })
    return buckets
  }, [enriquecidos])

  return (
    <>
      {/* Aging Report (solo desktop y si hay vencido) */}
      {kpis.vencido > 0 && !isMobile && (
        <div style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, padding:16, marginBottom:16 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <h3 style={{ fontSize:13, fontWeight:600, color:COLORS.ink, margin:0 }}>Aging Report (vencidos)</h3>
            <span style={{ fontSize:11, color:COLORS.slate500 }}>Total: {fmtMoney(kpis.vencido, true)}</span>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:10 }}>
            {Object.entries(aging).map(([bucket, monto]) => {
              const pct = kpis.vencido > 0 ? (monto / kpis.vencido * 100) : 0
              const colorBucket = bucket === '+90' ? COLORS.red : bucket === '61-90' ? COLORS.amber : bucket === '31-60' ? '#F59E0B' : COLORS.teal
              return (
                <div key={bucket} style={{ padding:12, background:COLORS.slate50, borderRadius:8 }}>
                  <div style={{ fontSize:10, fontWeight:700, color:COLORS.slate500, textTransform:'uppercase', marginBottom:4 }}>{bucket} días</div>
                  <div style={{ fontSize:16, fontWeight:600, color:colorBucket, fontFamily:'var(--font-mono)' }}>{fmtMoney(monto, true)}</div>
                  <div style={{ height:4, background:COLORS.slate100, borderRadius:2, marginTop:6, overflow:'hidden' }}>
                    <div style={{ width:`${pct}%`, height:'100%', background:colorBucket }}/>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Filtros + búsqueda */}
      <div style={{ display:'flex', gap:8, marginBottom:12, flexWrap:'wrap' }}>
        <div style={{ display:'flex', background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:10, padding:2, flexShrink:0 }}>
          {['Todos','Por cobrar','Vencidos','Por vencer','Cobrados'].map(f => (
            <button key={f} onClick={() => setFiltro(f)} style={{
              padding:'7px 12px', border:'none',
              background: filtro === f ? COLORS.navy : 'transparent',
              color: filtro === f ? 'white' : COLORS.slate600,
              borderRadius:8, fontSize:11, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap'
            }}>{f}</button>
          ))}
        </div>
        <div style={{ flex:1, minWidth:200, position:'relative' }}>
          <div style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:COLORS.slate400 }}>{Icon('Search')}</div>
          <input
            value={busqueda} onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar hito, proyecto, cliente..."
            style={{ width:'100%', padding:'9px 14px 9px 36px', border:`1px solid ${COLORS.slate100}`, borderRadius:10, fontSize:12, outline:'none', boxSizing:'border-box' }}
          />
        </div>
      </div>

      {/* Lista de hitos */}
      {filtrados.length === 0 && <EmptyState titulo="Sin hitos" descripcion="No hay hitos con esos filtros."/>}
      {filtrados.length > 0 && (
        <div style={{ display:'grid', gap:8 }}>
          {filtrados.map(h => <HitoRow key={h.id} hito={h} onCambiar={cambiarEstado} isMobile={isMobile}/>)}
        </div>
      )}
    </>
  )
}

function HitoRow({ hito, onCambiar, isMobile }) {
  const proyNombre = hito.proyecto?.nombre || 'Sin proyecto'
  const clienteNombre = hito.proyecto?.cliente?.razon_social || ''
  const color = hito.esVencido ? COLORS.red : (ESTADOS_HITO[hito.estado]?.color || COLORS.slate500)

  return (
    <div style={{
      background:'white', border:`1px solid ${COLORS.slate100}`,
      borderLeft:`3px solid ${color}`, borderRadius:10, padding:14,
      display:'flex', alignItems:'center', gap:12, flexWrap:'wrap'
    }}>
      <div style={{ flex:1, minWidth:200 }}>
        <div style={{ fontSize:10, fontFamily:'var(--font-mono)', color:COLORS.slate400, fontWeight:700, marginBottom:2 }}>
          {hito.proyecto?.codigo || ''} · {clienteNombre}
        </div>
        <div style={{ fontSize:13, color:COLORS.ink, fontWeight:500 }}>{hito.nombre}</div>
        <div style={{ fontSize:11, color:COLORS.slate500, marginTop:2 }}>{proyNombre}</div>
      </div>
      <div style={{ minWidth:100, textAlign:'right' }}>
        <div style={{ fontSize:11, fontFamily:'var(--font-mono)', color:COLORS.slate500 }}>
          {hito.fecha_esperada ? fmtDate(hito.fecha_esperada) : '—'}
        </div>
        {hito.esVencido && <div style={{ fontSize:10, color:COLORS.red, fontWeight:700, marginTop:2 }}>{hito.diasVencido}d vencido</div>}
        {!hito.esVencido && hito.diasVence !== null && hito.diasVence >= 0 && hito.estado !== 'Cobrado' && (
          <div style={{ fontSize:10, color: hito.diasVence <= 7 ? COLORS.amber : COLORS.slate500, fontWeight:600, marginTop:2 }}>
            {hito.diasVence === 0 ? 'hoy' : `en ${hito.diasVence}d`}
          </div>
        )}
      </div>
      <div style={{ fontSize:14, fontFamily:'var(--font-mono)', color:COLORS.navy, fontWeight:700, minWidth:100, textAlign:'right' }}>
        {fmtMoney(Number(hito.monto || 0), true)}
      </div>
      {!isMobile ? (
        <Badge texto={hito.estado} mapa={ESTADOS_HITO}/>
      ) : null}
      {hito.estado !== 'Cobrado' && hito.estado !== 'Cancelado' && (
        <select
          value={hito.estado}
          onChange={e => onCambiar(hito.id, e.target.value)}
          style={{ padding:'6px 10px', border:`1px solid ${COLORS.slate200}`, borderRadius:7, fontSize:11, background:'white', cursor:'pointer' }}
        >
          {Object.keys(ESTADOS_HITO).map(k => <option key={k} value={k}>{k}</option>)}
        </select>
      )}
    </div>
  )
}

// ============================================================
// VISTA POR CLIENTE (con watchlist arriba)
// ============================================================
function VistaPorCliente({ enriquecidos, onSelectCliente, isMobile }) {
  // Agrupar hitos por cliente
  const porCliente = useMemo(() => {
    const map = {}
    enriquecidos.forEach(h => {
      const nombre = h.proyecto?.cliente?.razon_social || 'Sin cliente'
      const clienteId = h.proyecto?.cliente?.id || 'null'
      if (!map[clienteId]) {
        map[clienteId] = {
          id: clienteId, nombre, hitos: [],
          porCobrar:0, cobrado:0, vencido:0,
          proxVence: null, esWatchlist:false
        }
      }
      map[clienteId].hitos.push(h)
      if (['Pendiente','Facturado'].includes(h.estado)) map[clienteId].porCobrar += Number(h.monto || 0)
      if (h.estado === 'Cobrado') map[clienteId].cobrado += Number(h.monto || 0)
      if (h.esVencido) map[clienteId].vencido += Number(h.monto || 0)
      if (h.diasVence !== null && h.diasVence >= 0 && h.estado !== 'Cobrado') {
        if (!map[clienteId].proxVence || h.diasVence < map[clienteId].proxVence) {
          map[clienteId].proxVence = h.diasVence
        }
      }
    })
    // marcar watchlist
    Object.values(map).forEach(c => {
      c.esWatchlist = CLIENTES_WATCHLIST.some(w => c.nombre.toLowerCase().includes(w.toLowerCase()))
    })
    return Object.values(map)
  }, [enriquecidos])

  // Separar watchlist y resto
  const watchlist = porCliente.filter(c => c.esWatchlist).sort((a,b) => b.vencido - a.vencido || b.porCobrar - a.porCobrar)
  const resto = porCliente.filter(c => !c.esWatchlist).sort((a,b) => b.vencido - a.vencido || b.porCobrar - a.porCobrar)

  return (
    <>
      {watchlist.length > 0 && (
        <div style={{ marginBottom:20 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
            <span style={{ fontSize:12, fontWeight:700, color:COLORS.navy, textTransform:'uppercase', letterSpacing:'0.06em' }}>Cuentas con seguimiento</span>
            <span style={{ fontSize:10, padding:'2px 8px', background:COLORS.navy, color:'white', borderRadius:10, fontWeight:600 }}>{watchlist.length}</span>
          </div>
          <div style={{ display:'grid', gap:8 }}>
            {watchlist.map(c => <ClienteRow key={c.id} cliente={c} onClick={() => onSelectCliente(c)} isMobile={isMobile} destacado/>)}
          </div>
        </div>
      )}

      {resto.length > 0 && (
        <div>
          <div style={{ fontSize:12, fontWeight:700, color:COLORS.slate500, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10 }}>Otros clientes ({resto.length})</div>
          <div style={{ display:'grid', gap:8 }}>
            {resto.map(c => <ClienteRow key={c.id} cliente={c} onClick={() => onSelectCliente(c)} isMobile={isMobile}/>)}
          </div>
        </div>
      )}

      {porCliente.length === 0 && <EmptyState titulo="Sin clientes con hitos" descripcion="Aún no hay hitos registrados para ningún cliente."/>}
    </>
  )
}

function ClienteRow({ cliente, onClick, isMobile, destacado }) {
  const tieneProblema = cliente.vencido > 0
  return (
    <div onClick={onClick} style={{
      background:'white',
      border:`1px solid ${tieneProblema ? COLORS.red : COLORS.slate100}`,
      borderLeft:`3px solid ${tieneProblema ? COLORS.red : destacado ? COLORS.navy : COLORS.slate300 || COLORS.slate400}`,
      borderRadius:10, padding:14,
      display:'flex', alignItems:'center', gap:12, cursor:'pointer',
      transition:'all 0.15s', flexWrap:'wrap'
    }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 3px 12px rgba(10,37,64,0.06)' }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none' }}
    >
      <div style={{ flex:1, minWidth:200 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:2 }}>
          <span style={{ fontSize:14, color:COLORS.ink, fontWeight:600 }}>{cliente.nombre}</span>
          {destacado && <span style={{ fontSize:9, padding:'2px 6px', background:COLORS.navy, color:'white', borderRadius:4, fontWeight:700 }}>WATCH</span>}
          {tieneProblema && <span style={{ fontSize:9, padding:'2px 6px', background:'#FEF2F2', color:COLORS.red, borderRadius:4, fontWeight:700 }}>VENCIDO</span>}
        </div>
        <div style={{ fontSize:11, color:COLORS.slate500 }}>
          {cliente.hitos.length} hito(s)
          {cliente.proxVence !== null && (
            <> · próximo vence en <strong style={{ color: cliente.proxVence <= 7 ? COLORS.amber : COLORS.slate600 }}>{cliente.proxVence === 0 ? 'hoy' : `${cliente.proxVence}d`}</strong></>
          )}
        </div>
      </div>
      {!isMobile && (
        <>
          <div style={{ textAlign:'right', minWidth:90 }}>
            <div style={{ fontSize:10, color:COLORS.slate400, fontWeight:600, textTransform:'uppercase' }}>Por cobrar</div>
            <div style={{ fontSize:13, fontFamily:'var(--font-mono)', color:COLORS.navy, fontWeight:700 }}>{fmtMoney(cliente.porCobrar, true)}</div>
          </div>
          {cliente.vencido > 0 && (
            <div style={{ textAlign:'right', minWidth:90 }}>
              <div style={{ fontSize:10, color:COLORS.red, fontWeight:600, textTransform:'uppercase' }}>Vencido</div>
              <div style={{ fontSize:13, fontFamily:'var(--font-mono)', color:COLORS.red, fontWeight:700 }}>{fmtMoney(cliente.vencido, true)}</div>
            </div>
          )}
          <div style={{ textAlign:'right', minWidth:90 }}>
            <div style={{ fontSize:10, color:COLORS.teal, fontWeight:600, textTransform:'uppercase' }}>Cobrado</div>
            <div style={{ fontSize:13, fontFamily:'var(--font-mono)', color:COLORS.teal, fontWeight:700 }}>{fmtMoney(cliente.cobrado, true)}</div>
          </div>
        </>
      )}
      {isMobile && (
        <div style={{ textAlign:'right', minWidth:80 }}>
          <div style={{ fontSize:13, fontFamily:'var(--font-mono)', color:tieneProblema ? COLORS.red : COLORS.navy, fontWeight:700 }}>
            {fmtMoney(cliente.porCobrar + cliente.vencido, true)}
          </div>
        </div>
      )}
      <span style={{ color:COLORS.slate400, fontSize:18 }}>›</span>
    </div>
  )
}

function DetalleCliente({ cliente, enriquecidos, onVolver, cambiarEstado, isMobile }) {
  const hitosCli = enriquecidos.filter(h => (h.proyecto?.cliente?.id || 'null') === cliente.id)
    .sort((a,b) => {
      // Primero vencidos, luego por fecha esperada
      if (a.esVencido && !b.esVencido) return -1
      if (!a.esVencido && b.esVencido) return 1
      return (a.fecha_esperada || '').localeCompare(b.fecha_esperada || '')
    })

  return (
    <>
      <button onClick={onVolver} style={{ border:'none', background:'transparent', color:COLORS.slate500, fontSize:12, fontWeight:600, cursor:'pointer', marginBottom:12, display:'flex', alignItems:'center', gap:4, padding:0 }}>
        ← Volver a clientes
      </button>

      <div style={{ background:'linear-gradient(to right, #F8FAFC, white)', border:`1px solid ${COLORS.slate100}`, borderRadius:12, padding:18, marginBottom:16 }}>
        <h2 style={{ fontSize:20, fontWeight:500, color:COLORS.navy, margin:0, fontFamily:'var(--font-serif)' }}>{cliente.nombre}</h2>
        <div style={{ display:'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap:12, marginTop:14 }}>
          <Mini label="Hitos"      valor={cliente.hitos.length} color={COLORS.slate600}/>
          <Mini label="Por cobrar" valor={fmtMoney(cliente.porCobrar, true)} color={COLORS.navy}/>
          <Mini label="Vencido"    valor={fmtMoney(cliente.vencido, true)}   color={cliente.vencido > 0 ? COLORS.red : COLORS.slate400}/>
          <Mini label="Cobrado"    valor={fmtMoney(cliente.cobrado, true)}   color={COLORS.teal}/>
        </div>
      </div>

      <div style={{ fontSize:11, fontWeight:700, color:COLORS.slate500, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>
        Hitos del cliente ({hitosCli.length})
      </div>

      {hitosCli.length === 0 && <EmptyState titulo="Sin hitos" descripcion="Este cliente no tiene hitos registrados."/>}
      <div style={{ display:'grid', gap:8 }}>
        {hitosCli.map(h => <HitoRow key={h.id} hito={h} onCambiar={cambiarEstado} isMobile={isMobile}/>)}
      </div>
    </>
  )
}

// ============================================================
// VISTA META vs REAL (gráfico mensual estilo PDF jefa de admin)
// ============================================================
function VistaMetaReal({ enriquecidos, isMobile }) {
  const hoy = new Date()
  const anio = hoy.getFullYear()

  // Cálculo mensual basado en fecha_cobro
  const porMes = Array(12).fill(0).map(() => ({ meta: META_COBRANZA_MENSUAL, real: 0, facturado: 0 }))
  enriquecidos.forEach(h => {
    if (h.estado === 'Cobrado' && h.fecha_cobro) {
      const d = new Date(h.fecha_cobro)
      if (d.getFullYear() === anio) porMes[d.getMonth()].real += Number(h.monto || 0)
    }
    if (h.estado === 'Facturado' && h.fecha_facturacion) {
      const d = new Date(h.fecha_facturacion)
      if (d.getFullYear() === anio) porMes[d.getMonth()].facturado += Number(h.monto || 0)
    }
  })

  const mesActual = hoy.getMonth()
  const metaAcum = porMes.slice(0, mesActual+1).reduce((s,m) => s+m.meta, 0)
  const realAcum = porMes.slice(0, mesActual+1).reduce((s,m) => s+m.real, 0)
  const avancePct = metaAcum > 0 ? Math.round((realAcum/metaAcum)*100) : 0
  const color = avancePct >= 90 ? COLORS.teal : avancePct >= 70 ? COLORS.amber : COLORS.red

  // Mes actual puntual
  const mesReal = porMes[mesActual].real
  const mesMeta = porMes[mesActual].meta
  const mesPct = mesMeta > 0 ? Math.min(100, Math.round((mesReal/mesMeta)*100)) : 0
  const mesColor = mesPct >= 90 ? COLORS.teal : mesPct >= 70 ? COLORS.amber : COLORS.red

  return (
    <>
      {/* KPIs YTD */}
      <div style={{ display:'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap:12, marginBottom:16 }}>
        <Mini label={`Meta ${MESES_ES[mesActual]} YTD`} valor={fmtMoney(metaAcum, true)} color={COLORS.slate500}/>
        <Mini label={`Real ${MESES_ES[mesActual]} YTD`} valor={fmtMoney(realAcum, true)} color={color}/>
        <Mini label="Avance vs meta" valor={`${avancePct}%`} color={color}/>
        <Mini label="Gap vs meta" valor={fmtMoney(metaAcum - realAcum, true)} color={realAcum < metaAcum ? COLORS.red : COLORS.teal}/>
      </div>

      {/* Barra grande mes actual */}
      <div style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, padding:18, marginBottom:16 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:10 }}>
          <h3 style={{ fontSize:14, fontWeight:600, color:COLORS.ink, margin:0, fontFamily:'var(--font-serif)' }}>
            Avance de {MESES_ES[mesActual]} {anio}
          </h3>
          <span style={{ fontSize:12, fontWeight:700, color:mesColor }}>{mesPct}%</span>
        </div>
        <div style={{ position:'relative', height:36, background:COLORS.slate50, borderRadius:10, overflow:'hidden', marginBottom:10 }}>
          <div style={{
            width:`${mesPct}%`, height:'100%', background:mesColor,
            transition:'width 0.5s', display:'flex', alignItems:'center', justifyContent:'flex-end', paddingRight:14
          }}>
            {mesPct >= 15 && <span style={{ fontSize:12, fontWeight:700, color:'white', fontFamily:'var(--font-mono)' }}>{fmtMoney(mesReal, true)}</span>}
          </div>
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:COLORS.slate500 }}>
          <span>Cobrado: <strong style={{ color:mesColor }}>{fmtMoney(mesReal, true)}</strong></span>
          <span>Meta: <strong>{fmtMoney(mesMeta, true)}</strong></span>
        </div>
      </div>

      {/* Gráfico mensual estilo PDF */}
      <div style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, padding:18 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:14 }}>
          <h3 style={{ fontSize:14, fontWeight:600, color:COLORS.ink, margin:0, fontFamily:'var(--font-serif)' }}>Avance de cobranza {anio}</h3>
          <div style={{ display:'flex', gap:14, fontSize:11 }}>
            <Leyenda color="#3B82F6" label="META"/>
            <Leyenda color="#6B7280" label="REAL"/>
          </div>
        </div>
        <GraficoMetaReal porMes={porMes} isMobile={isMobile}/>
      </div>
    </>
  )
}

function GraficoMetaReal({ porMes, isMobile }) {
  const H = 260
  const W = isMobile ? 760 : 920
  const PAD_L = 78, PAD_R = 20, PAD_T = 14, PAD_B = 40
  const innerW = W - PAD_L - PAD_R
  const innerH = H - PAD_T - PAD_B
  const maxVal = Math.max(...porMes.flatMap(m => [m.meta, m.real]), 1)
  const nice = niceMax(maxVal)
  const slot = innerW / 12

  return (
    <div style={{ overflowX:'auto' }}>
      <svg width={W} height={H} style={{ display:'block', minWidth:W }}>
        {/* Grid horizontal + Y labels */}
        {[0, 0.25, 0.5, 0.75, 1].map(p => {
          const y = PAD_T + innerH - p*innerH
          return (
            <g key={p}>
              <line x1={PAD_L} y1={y} x2={PAD_L+innerW} y2={y} stroke={COLORS.slate100} strokeDasharray={p === 0 ? '' : '3 3'}/>
              <text x={PAD_L - 8} y={y+4} textAnchor="end" fontSize="10" fill={COLORS.slate500} fontFamily="var(--font-mono)">
                {fmtMoney(nice*p, true)}
              </text>
            </g>
          )
        })}

        {/* Barras dobles por mes */}
        {porMes.map((m, i) => {
          const cx = PAD_L + slot*i + slot/2
          const bw = Math.min(slot*0.32, 24)
          const hMeta = (m.meta/nice)*innerH
          const hReal = (m.real/nice)*innerH
          return (
            <g key={i}>
              <rect x={cx - bw - 1} y={PAD_T + innerH - hMeta} width={bw} height={hMeta} fill="#3B82F6" rx="2"/>
              <rect x={cx + 1} y={PAD_T + innerH - hReal} width={bw} height={hReal} fill="#6B7280" rx="2"/>
              <text x={cx} y={H - 14} textAnchor="middle" fontSize="10" fill={COLORS.slate500} fontFamily="var(--font-mono)">
                {MESES_ES[i]}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ============================================================
// VISTA SEMANA — Objetivos y próximos vencimientos
// ============================================================
function VistaSemana({ enriquecidos, isMobile }) {
  const hoy = new Date()

  // Hitos que vencen en próximos 7 días
  const prox7dias = enriquecidos.filter(h => {
    if (h.estado === 'Cobrado' || h.estado === 'Cancelado') return false
    if (!h.fecha_esperada) return false
    const d = new Date(h.fecha_esperada)
    const diff = Math.ceil((d - hoy) / (1000*60*60*24))
    return diff >= 0 && diff <= 7
  }).sort((a,b) => (a.fecha_esperada || '').localeCompare(b.fecha_esperada || ''))

  // Vencidos más recientes (hasta 5)
  const vencidosTop = enriquecidos.filter(h => h.esVencido).sort((a,b) => b.diasVencido - a.diasVencido).slice(0, 5)

  // Listas editables (localStorage)
  const [objetivos, setObjetivos] = useState(loadPref('cob_objetivos_semana', [
    'Seguimiento diario: Cielo Azul, GKN, Energía Real',
    'Cobrar hitos vencidos de MITINFRA y SHARL',
    'Emitir factura pendiente de EDP',
    'Confirmar fechas de pago con Arizmendi',
  ]))
  useEffect(() => savePref('cob_objetivos_semana', objetivos), [objetivos])

  return (
    <>
      <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap:16, marginBottom:16 }}>
        <ListaEditable titulo="Objetivos de cobranza de la semana" items={objetivos} setItems={setObjetivos} color={COLORS.teal}/>

        <div style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, padding:18 }}>
          <h3 style={{ fontSize:14, fontWeight:600, color:COLORS.ink, margin:0, marginBottom:12, fontFamily:'var(--font-serif)', display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ width:3, height:14, background:COLORS.amber, borderRadius:2 }}/>
            Vencen esta semana ({prox7dias.length})
          </h3>
          {prox7dias.length === 0 && <div style={{ padding:20, textAlign:'center', color:COLORS.slate400, fontSize:12 }}>No hay hitos próximos a vencer.</div>}
          {prox7dias.map(h => (
            <div key={h.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 0', borderBottom:`1px solid ${COLORS.slate100}` }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:12, color:COLORS.ink, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {h.nombre}
                </div>
                <div style={{ fontSize:10, color:COLORS.slate500, marginTop:2 }}>
                  {h.proyecto?.cliente?.razon_social || 'Sin cliente'}
                </div>
              </div>
              <div style={{ fontSize:10, fontWeight:700, padding:'3px 8px', borderRadius:4,
                background: h.diasVence === 0 ? '#FEF2F2' : '#FEF3C7',
                color: h.diasVence === 0 ? COLORS.red : COLORS.amber }}>
                {h.diasVence === 0 ? 'hoy' : `${h.diasVence}d`}
              </div>
              <div style={{ fontSize:11, fontFamily:'var(--font-mono)', color:COLORS.navy, fontWeight:700, minWidth:70, textAlign:'right' }}>
                {fmtMoney(Number(h.monto || 0), true)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {vencidosTop.length > 0 && (
        <div style={{ background:'white', border:`1px solid #FECACA`, borderLeft:`3px solid ${COLORS.red}`, borderRadius:12, padding:18 }}>
          <h3 style={{ fontSize:14, fontWeight:600, color:COLORS.red, margin:0, marginBottom:12, fontFamily:'var(--font-serif)' }}>
            🚨 Top vencidos · requieren atención inmediata
          </h3>
          {vencidosTop.map(h => (
            <div key={h.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 0', borderBottom:`1px solid ${COLORS.slate50}` }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:12, color:COLORS.ink, fontWeight:600 }}>
                  {h.proyecto?.cliente?.razon_social || 'Sin cliente'}
                </div>
                <div style={{ fontSize:11, color:COLORS.slate500, marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {h.nombre}
                </div>
              </div>
              <div style={{ fontSize:10, fontWeight:700, padding:'3px 8px', borderRadius:4, background:'#FEF2F2', color:COLORS.red }}>
                {h.diasVencido}d
              </div>
              <div style={{ fontSize:11, fontFamily:'var(--font-mono)', color:COLORS.red, fontWeight:700, minWidth:80, textAlign:'right' }}>
                {fmtMoney(Number(h.monto || 0), true)}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

// ============================================================
// COMPONENTES COMPARTIDOS
// ============================================================

function KpiCard({ label, valor, color, icon }) {
  return (
    <div style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, padding:14, display:'flex', alignItems:'center', gap:12 }}>
      <div style={{ width:34, height:34, borderRadius:8, background:`${color}18`, color, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
        {Icon(icon)}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:9, fontWeight:700, color:COLORS.slate500, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:3 }}>{label}</div>
        <div style={{ fontSize:16, fontWeight:600, color, fontFamily:'var(--font-mono)', lineHeight:1 }}>{valor}</div>
      </div>
    </div>
  )
}

function Mini({ label, valor, color }) {
  return (
    <div style={{ background:COLORS.slate50, borderRadius:10, padding:12 }}>
      <div style={{ fontSize:10, fontWeight:700, color:COLORS.slate500, textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:4 }}>{label}</div>
      <div style={{ fontSize:16, fontWeight:600, color, fontFamily:'var(--font-mono)' }}>{valor}</div>
    </div>
  )
}

function Leyenda({ color, label }) {
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:4, color:COLORS.slate600 }}>
      <span style={{ width:10, height:10, borderRadius:'50%', background:color }}/>{label}
    </span>
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
      <h3 style={{ fontSize:14, fontWeight:600, color:COLORS.ink, margin:0, marginBottom:12, fontFamily:'var(--font-serif)', display:'flex', alignItems:'center', gap:8 }}>
        <span style={{ width:3, height:14, background:color, borderRadius:2 }}/>
        {titulo}
      </h3>
      {items.length === 0 && <div style={{ padding:'12px 0', textAlign:'center', color:COLORS.slate400, fontSize:12 }}>Agrega tu primer objetivo</div>}
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
          placeholder="Agregar objetivo..."
          style={{ flex:1, padding:'8px 10px', border:`1px solid ${COLORS.slate200}`, borderRadius:7, fontSize:12, outline:'none', fontFamily:'inherit' }}/>
        <button onClick={agregar} style={{ padding:'8px 14px', background:color, color:'white', border:'none', borderRadius:7, fontSize:12, fontWeight:600, cursor:'pointer' }}>+</button>
      </div>
    </div>
  )
}

// Redondea a un "nice" máximo para el eje Y
function niceMax(v) {
  if (v <= 0) return 1
  const mag = Math.pow(10, Math.floor(Math.log10(v)))
  const n = v / mag
  if (n <= 1) return mag
  if (n <= 2) return 2 * mag
  if (n <= 5) return 5 * mag
  return 10 * mag
}