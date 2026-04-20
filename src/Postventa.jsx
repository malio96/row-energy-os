import { useState, useEffect, useMemo } from 'react'
import { getPostventaTickets, crearTicket, actualizarTicket, getProyectos, getUsuarios } from './supabase'
import { COLORS, ESTADOS_TICKET, Badge, fmtDate, relativeTime, inputStyle, selectStyle, labelStyle, btnPrimary, btnSecondary, Icon, EmptyState, LoadingState, useIsMobile, loadPref, savePref } from './helpers'

const PRIORIDAD_COLOR = {
  'Alta': { bg:'#FEF2F2', color:'#DC2626' },
  'Media': { bg:'#FEF3C7', color:'#D97706' },
  'Baja': { bg:'#F1F5F9', color:'#64748B' },
}

export default function Postventa({ usuario }) {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [filtro, setFiltro] = useState(loadPref('tk_filtro', 'Abiertos'))
  const [busqueda, setBusqueda] = useState('')
  const isMobile = useIsMobile()

  const cargar = async () => { setLoading(true); setTickets(await getPostventaTickets()); setLoading(false) }
  useEffect(() => { cargar() }, [])
  useEffect(() => { savePref('tk_filtro', filtro) }, [filtro])

  const filtrados = useMemo(() => {
    let r = tickets
    if (filtro === 'Abiertos') r = r.filter(t => t.estado !== 'Resuelto' && t.estado !== 'Cerrado')
    else if (filtro === 'Resueltos') r = r.filter(t => t.estado === 'Resuelto' || t.estado === 'Cerrado')
    else if (filtro !== 'Todos') r = r.filter(t => t.prioridad === filtro)
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase()
      r = r.filter(t => t.titulo?.toLowerCase().includes(q) || t.codigo?.toLowerCase().includes(q) || t.proyecto?.nombre?.toLowerCase().includes(q))
    }
    return r.sort((a,b) => {
      const prioOrder = { 'Alta':0, 'Media':1, 'Baja':2 }
      return (prioOrder[a.prioridad] ?? 3) - (prioOrder[b.prioridad] ?? 3)
    })
  }, [tickets, filtro, busqueda])

  const kpis = useMemo(() => ({
    abiertos: tickets.filter(t => t.estado === 'Abierto').length,
    enProgreso: tickets.filter(t => t.estado === 'En progreso').length,
    alta: tickets.filter(t => t.prioridad === 'Alta' && t.estado !== 'Resuelto').length,
    total: tickets.length,
  }), [tickets])

  const cambiarEstado = async (id, nuevo) => { await actualizarTicket(id, { estado: nuevo }); cargar() }

  return (
    <div>
      {modal && <ModalNuevoTicket usuario={usuario} onClose={() => setModal(false)} onCreado={() => { setModal(false); cargar() }}/>}

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexWrap:'wrap', gap:10 }}>
        <div>
          <h1 style={{ fontSize: isMobile ? 24 : 32, fontWeight:400, color:COLORS.navy, margin:0, letterSpacing:'-0.02em', fontFamily:'var(--font-serif)' }}>Postventa</h1>
          <p style={{ color:COLORS.slate500, fontSize:12, marginTop:4 }}>{tickets.length} tickets</p>
        </div>
        <button onClick={() => setModal(true)} style={btnPrimary}>{Icon('Plus')} {isMobile ? 'Nuevo' : 'Nuevo ticket'}</button>
      </div>

      <div style={{ display:'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(180px, 1fr))', gap:10, marginBottom:16 }}>
        <KpiCard label="Abiertos" valor={kpis.abiertos} color={COLORS.red}/>
        <KpiCard label="En progreso" valor={kpis.enProgreso} color={COLORS.amber}/>
        <KpiCard label="Prioridad alta" valor={kpis.alta} color={COLORS.red}/>
        <KpiCard label="Total" valor={kpis.total} color={COLORS.slate600}/>
      </div>

      <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap' }}>
        <div style={{ display:'flex', background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:10, padding:2, flexWrap:'wrap' }}>
          {['Todos', 'Abiertos', 'Alta', 'Media', 'Baja', 'Resueltos'].map(f => (
            <button key={f} onClick={() => setFiltro(f)} style={{ padding:'7px 12px', border:'none', background: filtro === f ? COLORS.navy : 'transparent', color: filtro === f ? 'white' : COLORS.slate600, borderRadius:8, fontSize:11, fontWeight:600, cursor:'pointer' }}>{f}</button>
          ))}
        </div>
        <div style={{ flex:1, minWidth:200, position:'relative' }}>
          <div style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:COLORS.slate400 }}>{Icon('Search')}</div>
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar..." style={{ ...inputStyle, paddingLeft:36, minHeight:36, fontSize:13 }}/>
        </div>
      </div>

      {loading && <LoadingState/>}
      {!loading && filtrados.length === 0 && <EmptyState titulo="Sin tickets"/>}

      {!loading && filtrados.length > 0 && (
        <div style={{ display:'grid', gap:8 }}>
          {filtrados.map(t => (
            <div key={t.id} style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderLeft:`3px solid ${PRIORIDAD_COLOR[t.prioridad]?.color || COLORS.slate400}`, borderRadius:10, padding:14 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:10, flexWrap:'wrap' }}>
                <div style={{ flex:1, minWidth:200 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4, flexWrap:'wrap' }}>
                    <span style={{ fontSize:10, fontFamily:'var(--font-mono)', color:COLORS.slate500, fontWeight:600 }}>{t.codigo}</span>
                    <Badge texto={t.prioridad} mapa={PRIORIDAD_COLOR} size={10}/>
                    <Badge texto={t.estado} mapa={ESTADOS_TICKET} size={10}/>
                    {t.tipo && <span style={{ fontSize:10, color:COLORS.slate500, textTransform:'capitalize' }}>· {t.tipo}</span>}
                  </div>
                  <div style={{ fontSize:14, fontWeight:500, color:COLORS.ink, marginBottom:3 }}>{t.titulo}</div>
                  {t.descripcion && <div style={{ fontSize:11, color:COLORS.slate500, marginBottom:6, lineHeight:1.4 }}>{t.descripcion}</div>}
                  <div style={{ fontSize:10, color:COLORS.slate400 }}>
                    {t.proyecto?.codigo || '—'} · {t.responsable?.nombre || 'Sin asignar'} · {relativeTime(t.created_at)}
                  </div>
                </div>
                <select value={t.estado} onChange={e => cambiarEstado(t.id, e.target.value)} style={{ padding:'6px 10px', border:`1px solid ${COLORS.slate200}`, borderRadius:6, fontSize:11, cursor:'pointer', background:'white' }}>
                  {Object.keys(ESTADOS_TICKET).map(e => <option key={e}>{e}</option>)}
                </select>
              </div>
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
      <div style={{ fontSize:20, fontWeight:500, color, fontFamily:'var(--font-serif)', lineHeight:1 }}>{valor}</div>
    </div>
  )
}

function ModalNuevoTicket({ usuario, onClose, onCreado }) {
  const [proyectos, setProyectos] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [form, setForm] = useState({ titulo:'', descripcion:'', tipo:'consulta', prioridad:'Media', proyecto_id:'', responsable_id:'' })
  const isMobile = useIsMobile()

  useEffect(() => { Promise.all([getProyectos(), getUsuarios()]).then(([p, u]) => { setProyectos(p); setUsuarios(u) }) }, [])

  const crear = async () => {
    if (!form.titulo) { alert('Ingresa un título'); return }
    await crearTicket({ ...form, proyecto_id: form.proyecto_id || null, responsable_id: form.responsable_id || null })
    onCreado()
  }

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(10,37,64,0.35)', zIndex:999 }}/>
      <div style={{ position:'fixed', top: isMobile ? 0 : '10%', left:'50%', transform:'translateX(-50%)', width: isMobile ? '100%' : 520, maxHeight: isMobile ? '100vh' : '85vh', background:'white', borderRadius: isMobile ? 0 : 16, zIndex:1000, overflow:'auto' }}>
        <div style={{ padding:'18px 24px', borderBottom:`1px solid ${COLORS.slate100}`, display:'flex', justifyContent:'space-between' }}>
          <h2 style={{ fontSize:18, fontWeight:500, margin:0, color:COLORS.navy, fontFamily:'var(--font-serif)' }}>Nuevo ticket</h2>
          <button onClick={onClose} style={{ border:'none', background:COLORS.slate50, width:32, height:32, borderRadius:8, cursor:'pointer' }}>{Icon('X')}</button>
        </div>
        <div style={{ padding:20 }}>
          <div style={{ marginBottom:10 }}><label style={labelStyle}>Título *</label><input value={form.titulo} onChange={e=>setForm({...form, titulo:e.target.value})} style={inputStyle}/></div>
          <div style={{ marginBottom:10 }}><label style={labelStyle}>Descripción</label><textarea value={form.descripcion} onChange={e=>setForm({...form, descripcion:e.target.value})} rows={3} style={{...inputStyle, resize:'vertical', fontFamily:'inherit', minHeight:70}}/></div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
            <div><label style={labelStyle}>Tipo</label><select value={form.tipo} onChange={e=>setForm({...form, tipo:e.target.value})} style={selectStyle}><option>consulta</option><option>incidente</option><option>renovacion</option><option>mantenimiento</option></select></div>
            <div><label style={labelStyle}>Prioridad</label><select value={form.prioridad} onChange={e=>setForm({...form, prioridad:e.target.value})} style={selectStyle}><option>Alta</option><option>Media</option><option>Baja</option></select></div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div><label style={labelStyle}>Proyecto</label><select value={form.proyecto_id} onChange={e=>setForm({...form, proyecto_id:e.target.value})} style={selectStyle}><option value="">Ninguno</option>{proyectos.map(p => <option key={p.id} value={p.id}>{p.codigo}</option>)}</select></div>
            <div><label style={labelStyle}>Responsable</label><select value={form.responsable_id} onChange={e=>setForm({...form, responsable_id:e.target.value})} style={selectStyle}><option value="">Sin asignar</option>{usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}</select></div>
          </div>
        </div>
        <div style={{ padding:'14px 24px', borderTop:`1px solid ${COLORS.slate100}`, display:'flex', justifyContent:'flex-end', gap:10 }}>
          <button onClick={onClose} style={btnSecondary}>Cancelar</button>
          <button onClick={crear} style={btnPrimary}>Crear ticket</button>
        </div>
      </div>
    </>
  )
}