import { useState, useEffect, useMemo } from 'react'
import { getContratos, crearContrato, actualizarContrato, getProyectos } from './supabase'
import { COLORS, ESTADOS_CONTRATO, Badge, fmtMoney, fmtDate, daysUntil, inputStyle, selectStyle, labelStyle, btnPrimary, btnSecondary, Icon, EmptyState, LoadingState, useIsMobile, loadPref, savePref } from './helpers'

export default function Contratos({ usuario }) {
  const [contratos, setContratos] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [filtro, setFiltro] = useState(loadPref('ctr_filtro', 'Todos'))
  const [busqueda, setBusqueda] = useState('')
  const isMobile = useIsMobile()
  const puedeEditar = usuario.rol === 'direccion' || usuario.rol === 'admin'

  const cargar = async () => { setLoading(true); setContratos(await getContratos()); setLoading(false) }
  useEffect(() => { cargar() }, [])
  useEffect(() => { savePref('ctr_filtro', filtro) }, [filtro])

  const enriquecidos = useMemo(() => contratos.map(c => {
    const dias = daysUntil(c.fecha_fin)
    return { ...c, diasParaVencer: dias, porVencer: dias !== null && dias < 60 && dias > 0 && c.estado === 'Firmado' }
  }), [contratos])

  const filtrados = useMemo(() => {
    let r = enriquecidos
    if (filtro !== 'Todos') r = r.filter(c => c.estado === filtro)
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase()
      r = r.filter(c => c.codigo?.toLowerCase().includes(q) || c.proyecto?.nombre?.toLowerCase().includes(q) || c.cliente?.razon_social?.toLowerCase().includes(q))
    }
    return r
  }, [enriquecidos, filtro, busqueda])

  const kpis = useMemo(() => ({
    total: contratos.reduce((s,c) => s + Number(c.monto_total || 0), 0),
    firmados: contratos.filter(c => c.estado === 'Firmado').length,
    borradores: contratos.filter(c => c.estado === 'Borrador').length,
    porVencer: enriquecidos.filter(c => c.porVencer).length,
  }), [contratos, enriquecidos])

  return (
    <div>
      {modal && <ModalNuevoContrato onClose={() => setModal(false)} onCreado={() => { setModal(false); cargar() }}/>}

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexWrap:'wrap', gap:10 }}>
        <div>
          <h1 style={{ fontSize: isMobile ? 24 : 32, fontWeight:400, color:COLORS.navy, margin:0, letterSpacing:'-0.02em', fontFamily:'var(--font-sans)' }}>Contratos</h1>
          <p style={{ color:COLORS.slate500, fontSize:12, marginTop:4 }}>{contratos.length} contratos · {fmtMoney(kpis.total)}</p>
        </div>
        {puedeEditar && <button onClick={() => setModal(true)} style={btnPrimary}>{Icon('Plus')} {isMobile ? 'Nuevo' : 'Nuevo contrato'}</button>}
      </div>

      {kpis.porVencer > 0 && (
        <div style={{ padding:12, background:'#FEF3C7', border:'1px solid #FDE68A', borderRadius:10, marginBottom:12, fontSize:12, color:'#92400E', display:'flex', alignItems:'center', gap:8 }}>
          {Icon('Alert')}
          <span><strong>{kpis.porVencer}</strong> contrato(s) vencen en los próximos 60 días. Inicia proceso de renovación.</span>
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(180px, 1fr))', gap:10, marginBottom:16 }}>
        <KpiCard label="Valor total" valor={fmtMoney(kpis.total, true)} color={COLORS.navy}/>
        <KpiCard label="Firmados" valor={kpis.firmados} color={COLORS.teal}/>
        <KpiCard label="Borradores" valor={kpis.borradores} color={COLORS.slate600}/>
        <KpiCard label="Por vencer" valor={kpis.porVencer} color={kpis.porVencer > 0 ? COLORS.amber : COLORS.slate600}/>
      </div>

      <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap' }}>
        <div style={{ display:'flex', background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:10, padding:2, flexWrap:'wrap' }}>
          {['Todos', 'Borrador', 'Enviado', 'Firmado', 'Vencido'].map(f => (
            <button key={f} onClick={() => setFiltro(f)} style={{ padding:'7px 12px', border:'none', background: filtro === f ? COLORS.navy : 'transparent', color: filtro === f ? 'white' : COLORS.slate600, borderRadius:8, fontSize:11, fontWeight:600, cursor:'pointer' }}>{f}</button>
          ))}
        </div>
        <div style={{ flex:1, minWidth:200, position:'relative' }}>
          <div style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:COLORS.slate400 }}>{Icon('Search')}</div>
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar..." style={{ ...inputStyle, paddingLeft:36, minHeight:36, fontSize:13 }}/>
        </div>
      </div>

      {loading && <LoadingState/>}
      {!loading && filtrados.length === 0 && <EmptyState titulo="Sin contratos" descripcion="Los contratos se crean cuando se firma un proyecto"/>}

      {!loading && filtrados.length > 0 && (
        <div style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, overflow:'hidden' }}>
          {!isMobile && (
            <div style={{ display:'grid', gridTemplateColumns:'100px 1fr 200px 140px 120px 120px 110px', padding:'12px 20px', background:COLORS.slate50, borderBottom:`1px solid ${COLORS.slate100}`, fontSize:10, fontWeight:600, color:COLORS.slate500, textTransform:'uppercase', letterSpacing:'0.07em' }}>
              <div>Código</div><div>Proyecto</div><div>Cliente</div><div>Monto</div><div>Firma</div><div>Vence</div><div>Estado</div>
            </div>
          )}
          {filtrados.map(c => (
            <div key={c.id} style={{ display: isMobile ? 'block' : 'grid', gridTemplateColumns:'100px 1fr 200px 140px 120px 120px 110px', padding:'12px 20px', borderBottom:`1px solid ${COLORS.slate100}`, alignItems:'center', fontSize:12 }}>
              {isMobile ? (
                <>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                    <span style={{ fontSize:11, fontFamily:'var(--font-mono)', color:COLORS.slate500, fontWeight:600 }}>{c.codigo}</span>
                    <Badge texto={c.estado} mapa={ESTADOS_CONTRATO} size={10}/>
                  </div>
                  <div style={{ fontSize:13, fontWeight:500, color:COLORS.ink }}>{c.proyecto?.nombre}</div>
                  <div style={{ fontSize:11, color:COLORS.slate500, marginBottom:6 }}>{c.cliente?.razon_social}</div>
                  <div style={{ display:'flex', justifyContent:'space-between' }}>
                    <span style={{ fontSize:14, fontWeight:600, color:COLORS.navy, fontFamily:'var(--font-mono)' }}>{fmtMoney(c.monto_total)}</span>
                    {c.porVencer && <span style={{ fontSize:10, color:COLORS.amber, fontWeight:700 }}>Vence en {c.diasParaVencer}d</span>}
                  </div>
                </>
              ) : (
                <>
                  <span style={{ fontSize:11, fontFamily:'var(--font-mono)', color:COLORS.slate500, fontWeight:600 }}>{c.codigo}</span>
                  <div style={{ fontWeight:500, color:COLORS.ink }}>{c.proyecto?.nombre || '—'}</div>
                  <div style={{ color:COLORS.slate600 }}>{c.cliente?.razon_social || '—'}</div>
                  <div style={{ fontFamily:'var(--font-mono)', fontWeight:600, color:COLORS.navy }}>{fmtMoney(c.monto_total)}</div>
                  <div style={{ fontSize:11, color:COLORS.slate500, fontFamily:'var(--font-mono)' }}>{c.fecha_firma || '—'}</div>
                  <div style={{ fontSize:11, fontFamily:'var(--font-mono)', color: c.porVencer ? COLORS.amber : COLORS.slate500 }}>
                    {c.fecha_fin || '—'}
                    {c.porVencer && <div style={{ fontSize:9, fontWeight:700 }}>{c.diasParaVencer}d</div>}
                  </div>
                  <div><Badge texto={c.estado} mapa={ESTADOS_CONTRATO}/></div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function KpiCard({ label, valor, color }) {
  return (
    <div style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, padding:14 }}>
      <div style={{ fontSize:10, fontWeight:600, color:COLORS.slate500, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>{label}</div>
      <div style={{ fontSize:20, fontWeight:500, color, fontFamily:'var(--font-sans)', lineHeight:1 }}>{valor}</div>
    </div>
  )
}

function ModalNuevoContrato({ onClose, onCreado }) {
  const [proyectos, setProyectos] = useState([])
  const [form, setForm] = useState({ proyecto_id:'', fecha_firma:'', fecha_inicio:'', fecha_fin:'', monto_total:'', moneda:'MXN', estado:'Borrador' })
  const isMobile = useIsMobile()
  useEffect(() => { getProyectos().then(setProyectos) }, [])

  const crear = async () => {
    if (!form.proyecto_id) { alert('Selecciona un proyecto'); return }
    const p = proyectos.find(x => x.id === form.proyecto_id)
    await crearContrato({ ...form, cliente_id: p.cliente_id, monto_total: Number(form.monto_total) || null })
    onCreado()
  }

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(10,37,64,0.35)', zIndex:999 }}/>
      <div style={{ position:'fixed', top: isMobile ? 0 : '10%', left:'50%', transform:'translateX(-50%)', width: isMobile ? '100%' : 520, maxHeight: isMobile ? '100vh' : '85vh', background:'white', borderRadius: isMobile ? 0 : 16, zIndex:1000, overflow:'auto' }}>
        <div style={{ padding:'18px 24px', borderBottom:`1px solid ${COLORS.slate100}`, display:'flex', justifyContent:'space-between' }}>
          <h2 style={{ fontSize:18, fontWeight:500, margin:0, color:COLORS.navy, fontFamily:'var(--font-sans)' }}>Nuevo contrato</h2>
          <button onClick={onClose} style={{ border:'none', background:COLORS.slate50, width:32, height:32, borderRadius:8, cursor:'pointer' }}>{Icon('X')}</button>
        </div>
        <div style={{ padding:20 }}>
          <div style={{ marginBottom:10 }}>
            <label style={labelStyle}>Proyecto *</label>
            <select value={form.proyecto_id} onChange={e => setForm({...form, proyecto_id: e.target.value})} style={selectStyle}>
              <option value="">Selecciona...</option>
              {proyectos.map(p => <option key={p.id} value={p.id}>{p.codigo} · {p.nombre}</option>)}
            </select>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
            <div><label style={labelStyle}>Fecha firma</label><input type="date" value={form.fecha_firma} onChange={e=>setForm({...form, fecha_firma:e.target.value})} style={inputStyle}/></div>
            <div><label style={labelStyle}>Estado</label><select value={form.estado} onChange={e=>setForm({...form, estado:e.target.value})} style={selectStyle}><option>Borrador</option><option>Enviado</option><option>Firmado</option></select></div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
            <div><label style={labelStyle}>Inicio vigencia</label><input type="date" value={form.fecha_inicio} onChange={e=>setForm({...form, fecha_inicio:e.target.value})} style={inputStyle}/></div>
            <div><label style={labelStyle}>Fin vigencia</label><input type="date" value={form.fecha_fin} onChange={e=>setForm({...form, fecha_fin:e.target.value})} style={inputStyle}/></div>
          </div>
          <div><label style={labelStyle}>Monto total MXN</label><input type="number" value={form.monto_total} onChange={e=>setForm({...form, monto_total:e.target.value})} style={inputStyle}/></div>
        </div>
        <div style={{ padding:'14px 24px', borderTop:`1px solid ${COLORS.slate100}`, display:'flex', justifyContent:'flex-end', gap:10 }}>
          <button onClick={onClose} style={btnSecondary}>Cancelar</button>
          <button onClick={crear} style={btnPrimary}>Crear contrato</button>
        </div>
      </div>
    </>
  )
}