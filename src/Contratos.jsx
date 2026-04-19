import { useState, useEffect } from 'react'
import { getContratos, crearContrato, actualizarContrato, getProyectos, getClientes } from './supabase'
import { COLORS, Badge, fmtMoney, inputStyle, selectStyle, labelStyle, Icon } from './helpers'

const ESTADOS_CONTRATO = { 'Borrador':{bg:'#F1F5F9',color:'#64748B'}, 'Enviado':{bg:'#E0EDFF',color:'#1B3A6B'}, 'Firmado':{bg:'#E1F5EE',color:'#0F6E56'}, 'Vencido':{bg:'#FEF2F2',color:'#DC2626'} }

export default function Contratos() {
  const [contratos, setContratos] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)

  const cargar = async () => { setLoading(true); setContratos(await getContratos()); setLoading(false) }
  useEffect(() => { cargar() }, [])

  return (
    <div>
      {modal && <ModalNuevoContrato onClose={() => setModal(false)} onCreado={() => { setModal(false); cargar() }}/>}

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:32, fontWeight:400, color:COLORS.navy, margin:0, letterSpacing:'-0.02em', fontFamily:'var(--font-serif)' }}>Contratos</h1>
          <p style={{ color:COLORS.slate500, fontSize:13, marginTop:6 }}>{contratos.length} contratos</p>
        </div>
        <button onClick={() => setModal(true)} style={{ padding:'10px 20px', background:COLORS.navy, color:'white', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>{Icon('Plus')} Nuevo contrato</button>
      </div>

      {loading && <div style={{ padding:40, textAlign:'center', color:COLORS.slate400 }}>Cargando...</div>}

      {!loading && contratos.length === 0 && <div style={{ padding:40, textAlign:'center', color:COLORS.slate400, background:'white', borderRadius:12 }}>Sin contratos</div>}

      {!loading && contratos.length > 0 && (
        <div style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, overflow:'hidden' }}>
          <div style={{ display:'grid', gridTemplateColumns:'100px 1fr 200px 140px 130px 130px 140px', padding:'12px 20px', background:COLORS.slate50, borderBottom:`1px solid ${COLORS.slate100}`, fontSize:10, fontWeight:600, color:COLORS.slate500, textTransform:'uppercase', letterSpacing:'0.07em' }}>
            <div>Código</div><div>Proyecto</div><div>Cliente</div><div>Monto</div><div>Inicio</div><div>Fin</div><div>Estado</div>
          </div>
          {contratos.map(c => (
            <div key={c.id} style={{ display:'grid', gridTemplateColumns:'100px 1fr 200px 140px 130px 130px 140px', padding:'12px 20px', borderBottom:`1px solid ${COLORS.slate100}`, alignItems:'center', fontSize:12 }}>
              <span style={{ fontSize:11, fontFamily:'var(--font-mono)', color:COLORS.slate500, fontWeight:600 }}>{c.codigo}</span>
              <div style={{ fontWeight:500, color:COLORS.ink }}>{c.proyecto?.nombre || '—'}</div>
              <div style={{ color:COLORS.slate600 }}>{c.cliente?.razon_social || '—'}</div>
              <div style={{ fontFamily:'var(--font-mono)', fontWeight:600, color:COLORS.navy }}>{fmtMoney(c.monto_total)}</div>
              <div style={{ fontSize:11, fontFamily:'var(--font-mono)', color:COLORS.slate500 }}>{c.fecha_inicio || '—'}</div>
              <div style={{ fontSize:11, fontFamily:'var(--font-mono)', color:COLORS.slate500 }}>{c.fecha_fin || '—'}</div>
              <div><select value={c.estado} onChange={e => { actualizarContrato(c.id, { estado:e.target.value }).then(cargar) }} style={{ border:'none', background:ESTADOS_CONTRATO[c.estado]?.bg || '#F1F5F9', color:ESTADOS_CONTRATO[c.estado]?.color || '#64748B', padding:'4px 8px', borderRadius:12, fontSize:11, fontWeight:500, cursor:'pointer' }}>{Object.keys(ESTADOS_CONTRATO).map(e => <option key={e}>{e}</option>)}</select></div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ModalNuevoContrato({ onClose, onCreado }) {
  const [proyectos, setProyectos] = useState([])
  const [form, setForm] = useState({ proyecto_id:'', cliente_id:'', fecha_firma:'', fecha_inicio:'', fecha_fin:'', monto_total:'', moneda:'MXN' })
  useEffect(() => { getProyectos().then(setProyectos) }, [])

  const onProyecto = (id) => { const p = proyectos.find(x => x.id === id); setForm({ ...form, proyecto_id: id, cliente_id: p?.cliente_id || '', monto_total: p?.monto_contrato || '' }) }

  const crear = async () => {
    if (!form.proyecto_id) { alert('Selecciona proyecto'); return }
    await crearContrato({ ...form, monto_total: Number(form.monto_total) || 0, estado:'Borrador' })
    onCreado()
  }

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(10,37,64,0.35)', zIndex:999 }}/>
      <div style={{ position:'fixed', top:'10%', left:'50%', transform:'translateX(-50%)', width:520, background:'white', borderRadius:16, zIndex:1000 }}>
        <div style={{ padding:'20px 28px', borderBottom:`1px solid ${COLORS.slate100}`, display:'flex', justifyContent:'space-between' }}>
          <h2 style={{ fontSize:20, fontWeight:500, margin:0, color:COLORS.navy, fontFamily:'var(--font-serif)' }}>Nuevo contrato</h2>
          <button onClick={onClose} style={{ border:'none', background:'transparent', cursor:'pointer' }}>{Icon('X')}</button>
        </div>
        <div style={{ padding:24 }}>
          <div style={{ marginBottom:14 }}><label style={labelStyle}>Proyecto *</label><select value={form.proyecto_id} onChange={e=>onProyecto(e.target.value)} style={selectStyle}><option value="">Selecciona...</option>{proyectos.map(p => <option key={p.id} value={p.id}>{p.codigo} · {p.nombre}</option>)}</select></div>
          <div style={{ marginBottom:14 }}><label style={labelStyle}>Monto total (MXN)</label><input type="number" value={form.monto_total} onChange={e=>setForm({...form, monto_total:e.target.value})} style={inputStyle}/></div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
            <div><label style={labelStyle}>Firma</label><input type="date" value={form.fecha_firma} onChange={e=>setForm({...form, fecha_firma:e.target.value})} style={inputStyle}/></div>
            <div><label style={labelStyle}>Inicio</label><input type="date" value={form.fecha_inicio} onChange={e=>setForm({...form, fecha_inicio:e.target.value})} style={inputStyle}/></div>
            <div><label style={labelStyle}>Fin</label><input type="date" value={form.fecha_fin} onChange={e=>setForm({...form, fecha_fin:e.target.value})} style={inputStyle}/></div>
          </div>
        </div>
        <div style={{ padding:'16px 28px', borderTop:`1px solid ${COLORS.slate100}`, display:'flex', justifyContent:'flex-end', gap:10 }}>
          <button onClick={onClose} style={{ padding:'10px 18px', background:'transparent', border:`1px solid ${COLORS.slate200}`, borderRadius:8, fontSize:13, cursor:'pointer' }}>Cancelar</button>
          <button onClick={crear} style={{ padding:'10px 22px', background:COLORS.navy, color:'white', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer' }}>Crear</button>
        </div>
      </div>
    </>
  )
}