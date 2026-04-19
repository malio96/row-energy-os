import { useState, useEffect } from 'react'
import { getPostventaTickets, crearTicket, actualizarTicket, getProyectos, getUsuarios } from './supabase'
import { COLORS, ESTADOS_TICKET, Badge, Avatar, inputStyle, selectStyle, labelStyle, Icon } from './helpers'

const TIPOS_TICKET = ['mantenimiento','soporte','renovacion','incidencia','consulta']

export default function Postventa({ usuario }) {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [filtroEstado, setFiltroEstado] = useState('')

  const cargar = async () => { setLoading(true); setTickets(await getPostventaTickets()); setLoading(false) }
  useEffect(() => { cargar() }, [])

  const filtrados = filtroEstado ? tickets.filter(t => t.estado === filtroEstado) : tickets
  const abiertos = tickets.filter(t => t.estado === 'Abierto').length
  const enProgreso = tickets.filter(t => t.estado === 'En progreso').length

  const cambiarEstado = async (id, nuevo) => {
    const cambios = { estado: nuevo }
    if (nuevo === 'Cerrado' || nuevo === 'Resuelto') cambios.fecha_cierre = new Date().toISOString().split('T')[0]
    await actualizarTicket(id, cambios); cargar()
  }

  return (
    <div>
      {modal && <ModalNuevoTicket usuario={usuario} onClose={() => setModal(false)} onCreado={() => { setModal(false); cargar() }}/>}

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:32, fontWeight:400, color:COLORS.navy, margin:0, letterSpacing:'-0.02em', fontFamily:'var(--font-serif)' }}>Postventa</h1>
          <p style={{ color:COLORS.slate500, fontSize:13, marginTop:6 }}>{tickets.length} tickets · {abiertos} abiertos · {enProgreso} en progreso</p>
        </div>
        <button onClick={() => setModal(true)} style={{ padding:'10px 20px', background:COLORS.navy, color:'white', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>{Icon('Plus')} Nuevo ticket</button>
      </div>

      <div style={{ marginBottom:16 }}>
        <select value={filtroEstado} onChange={e=>setFiltroEstado(e.target.value)} style={{ ...selectStyle, width:200 }}>
          <option value="">Todos los estados</option>
          {Object.keys(ESTADOS_TICKET).map(e => <option key={e}>{e}</option>)}
        </select>
      </div>

      {loading && <div style={{ padding:40, textAlign:'center', color:COLORS.slate400 }}>Cargando...</div>}

      {!loading && filtrados.length === 0 && <div style={{ padding:40, textAlign:'center', color:COLORS.slate400, background:'white', borderRadius:12 }}>Sin tickets</div>}

      {!loading && filtrados.length > 0 && (
        <div style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, overflow:'hidden' }}>
          <div style={{ display:'grid', gridTemplateColumns:'90px 1fr 120px 140px 140px 140px', padding:'12px 20px', background:COLORS.slate50, borderBottom:`1px solid ${COLORS.slate100}`, fontSize:10, fontWeight:600, color:COLORS.slate500, textTransform:'uppercase', letterSpacing:'0.07em' }}>
            <div>Código</div><div>Título</div><div>Tipo</div><div>Proyecto</div><div>Responsable</div><div>Estado</div>
          </div>
          {filtrados.map(t => (
            <div key={t.id} style={{ display:'grid', gridTemplateColumns:'90px 1fr 120px 140px 140px 140px', padding:'12px 20px', borderBottom:`1px solid ${COLORS.slate100}`, alignItems:'center', fontSize:12 }}>
              <span style={{ fontSize:11, fontFamily:'var(--font-mono)', color:COLORS.slate500, fontWeight:600 }}>{t.codigo}</span>
              <div>
                <div style={{ fontWeight:500, color:COLORS.ink }}>{t.titulo}</div>
                <div style={{ fontSize:11, color:COLORS.slate500 }}>{t.descripcion?.substring(0,80)}{t.descripcion?.length > 80 ? '...' : ''}</div>
              </div>
              <div><Badge texto={t.tipo} mapa={{ mantenimiento:{bg:'#E0EDFF',color:'#1B3A6B'},soporte:{bg:'#E1F5EE',color:'#0F6E56'},renovacion:{bg:'#FEF3C7',color:'#D97706'},incidencia:{bg:'#FEF2F2',color:'#DC2626'},consulta:{bg:'#F1F5F9',color:'#64748B'} }}/></div>
              <div style={{ fontSize:11, fontFamily:'var(--font-mono)', color:COLORS.slate500 }}>{t.proyecto?.codigo || '—'}</div>
              <div>{t.responsable?.nombre ? <div style={{ display:'flex', alignItems:'center', gap:6 }}><Avatar nombre={t.responsable.nombre} size={20}/><span style={{ fontSize:11 }}>{t.responsable.nombre}</span></div> : '—'}</div>
              <div><select value={t.estado} onChange={e => cambiarEstado(t.id, e.target.value)} style={{ border:'none', background:ESTADOS_TICKET[t.estado]?.bg, color:ESTADOS_TICKET[t.estado]?.color, padding:'4px 8px', borderRadius:12, fontSize:11, fontWeight:500, cursor:'pointer' }}>{Object.keys(ESTADOS_TICKET).map(e => <option key={e}>{e}</option>)}</select></div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ModalNuevoTicket({ usuario, onClose, onCreado }) {
  const [proyectos, setProyectos] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [form, setForm] = useState({ titulo:'', descripcion:'', tipo:'soporte', prioridad:'Media', proyecto_id:'', responsable_id:'' })

  useEffect(() => { Promise.all([getProyectos(), getUsuarios()]).then(([p,u]) => { setProyectos(p); setUsuarios(u) }) }, [])

  const crear = async () => {
    if (!form.titulo) { alert('Completa el título'); return }
    await crearTicket({ ...form, proyecto_id: form.proyecto_id || null, responsable_id: form.responsable_id || null })
    onCreado()
  }

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(10,37,64,0.35)', zIndex:999 }}/>
      <div style={{ position:'fixed', top:'8%', left:'50%', transform:'translateX(-50%)', width:560, background:'white', borderRadius:16, zIndex:1000 }}>
        <div style={{ padding:'20px 28px', borderBottom:`1px solid ${COLORS.slate100}`, display:'flex', justifyContent:'space-between' }}>
          <h2 style={{ fontSize:20, fontWeight:500, margin:0, color:COLORS.navy, fontFamily:'var(--font-serif)' }}>Nuevo ticket de postventa</h2>
          <button onClick={onClose} style={{ border:'none', background:'transparent', cursor:'pointer' }}>{Icon('X')}</button>
        </div>
        <div style={{ padding:24 }}>
          <div style={{ marginBottom:14 }}><label style={labelStyle}>Título *</label><input value={form.titulo} onChange={e=>setForm({...form, titulo:e.target.value})} style={inputStyle}/></div>
          <div style={{ marginBottom:14 }}><label style={labelStyle}>Descripción</label><textarea value={form.descripcion} onChange={e=>setForm({...form, descripcion:e.target.value})} rows={3} style={{...inputStyle, resize:'vertical'}}/></div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
            <div><label style={labelStyle}>Tipo</label><select value={form.tipo} onChange={e=>setForm({...form, tipo:e.target.value})} style={selectStyle}>{TIPOS_TICKET.map(t => <option key={t}>{t}</option>)}</select></div>
            <div><label style={labelStyle}>Prioridad</label><select value={form.prioridad} onChange={e=>setForm({...form, prioridad:e.target.value})} style={selectStyle}><option>Alta</option><option>Media</option><option>Baja</option></select></div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div><label style={labelStyle}>Proyecto</label><select value={form.proyecto_id} onChange={e=>setForm({...form, proyecto_id:e.target.value})} style={selectStyle}><option value="">Sin proyecto</option>{proyectos.map(p => <option key={p.id} value={p.id}>{p.codigo}</option>)}</select></div>
            <div><label style={labelStyle}>Responsable</label><select value={form.responsable_id} onChange={e=>setForm({...form, responsable_id:e.target.value})} style={selectStyle}><option value="">Sin asignar</option>{usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}</select></div>
          </div>
        </div>
        <div style={{ padding:'16px 28px', borderTop:`1px solid ${COLORS.slate100}`, display:'flex', justifyContent:'flex-end', gap:10 }}>
          <button onClick={onClose} style={{ padding:'10px 18px', background:'transparent', border:`1px solid ${COLORS.slate200}`, borderRadius:8, fontSize:13, cursor:'pointer' }}>Cancelar</button>
          <button onClick={crear} style={{ padding:'10px 22px', background:COLORS.navy, color:'white', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer' }}>Crear ticket</button>
        </div>
      </div>
    </>
  )
}