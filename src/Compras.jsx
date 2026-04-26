import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getCompras, crearCompra, actualizarCompra, getProyectos, getUsuarios } from './supabase'
import { COLORS, ESTADOS_COMPRA, Badge, fmtMoney, inputStyle, selectStyle, labelStyle, Icon } from './helpers'

export default function Compras({ usuario }) {
  const [searchParams, setSearchParams] = useSearchParams()
  // Deep-link desde Centro de Alertas: ?cxp=X → scroll + highlight
  const deepLinkRef = useRef({ cxpId: searchParams.get('cxp'), aplicado: false })
  const [highlightId, setHighlightId] = useState(null)
  const rowRefs = useRef({})
  const [compras, setCompras] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)

  const cargar = async () => { setLoading(true); setCompras(await getCompras()); setLoading(false) }
  useEffect(() => { cargar() }, [])

  useEffect(() => {
    if (deepLinkRef.current.aplicado) return
    if (compras.length === 0) return
    const { cxpId } = deepLinkRef.current
    if (cxpId && compras.some(c => c.id === cxpId)) {
      setHighlightId(cxpId)
      setTimeout(() => rowRefs.current[cxpId]?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100)
      setTimeout(() => setHighlightId(null), 3000)
    }
    deepLinkRef.current.aplicado = true
    if (searchParams.get('cxp')) setSearchParams({}, { replace: true })
  }, [compras, searchParams, setSearchParams])

  const total = compras.reduce((s,c) => s + Number(c.monto), 0)
  const pendientes = compras.filter(c => c.estado === 'Solicitada').reduce((s,c) => s + Number(c.monto), 0)

  const cambiarEstado = async (id, nuevo) => {
    const cambios = { estado: nuevo }
    if (nuevo === 'Aprobada') { cambios.fecha_aprobacion = new Date().toISOString().split('T')[0]; cambios.aprobado_por = usuario.id }
    await actualizarCompra(id, cambios); cargar()
  }

  return (
    <div>
      {modal && <ModalNuevaCompra usuario={usuario} onClose={() => setModal(false)} onCreada={() => { setModal(false); cargar() }}/>}

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:32, fontWeight:400, color:COLORS.navy, margin:0, letterSpacing:'-0.02em', fontFamily:'var(--font-serif)' }}>Compras</h1>
          <p style={{ color:COLORS.slate500, fontSize:13, marginTop:6 }}>{compras.length} solicitudes · Total: <strong>{fmtMoney(total)}</strong></p>
        </div>
        <button onClick={() => setModal(true)} style={{ padding:'10px 20px', background:COLORS.navy, color:'white', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>{Icon('Plus')} Nueva solicitud</button>
      </div>

      {pendientes > 0 && (
        <div style={{ padding:14, background:'#FEF3C7', border:'1px solid #FDE68A', borderRadius:10, marginBottom:16, fontSize:12, color:'#92400E' }}>
          <strong>{fmtMoney(pendientes)}</strong> en solicitudes pendientes de aprobación
        </div>
      )}

      {loading && <div style={{ padding:40, textAlign:'center', color:COLORS.slate400 }}>Cargando...</div>}

      {!loading && compras.length === 0 && <div style={{ padding:40, textAlign:'center', color:COLORS.slate400, background:'white', borderRadius:12 }}>Sin solicitudes de compra</div>}

      {!loading && compras.length > 0 && (
        <div style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, overflow:'hidden' }}>
          <div style={{ display:'grid', gridTemplateColumns:'100px 180px 1fr 140px 120px 130px 140px', padding:'12px 20px', background:COLORS.slate50, borderBottom:`1px solid ${COLORS.slate100}`, fontSize:10, fontWeight:600, color:COLORS.slate500, textTransform:'uppercase', letterSpacing:'0.07em' }}>
            <div>Código</div><div>Proveedor</div><div>Descripción</div><div>Monto</div><div>Proyecto</div><div>Solicitud</div><div>Estado</div>
          </div>
          {compras.map(c => {
            const puedeAprobar = c.estado === 'Solicitada' && (usuario.rol === 'direccion' || (usuario.rol === 'admin' && Number(c.monto) < 50000))
            return (
              <div key={c.id} ref={el => { if (el) rowRefs.current[c.id] = el }} style={{ display:'grid', gridTemplateColumns:'100px 180px 1fr 140px 120px 130px 140px', padding:'12px 20px', borderBottom:`1px solid ${COLORS.slate100}`, alignItems:'center', fontSize:12, background: highlightId === c.id ? '#FEF3C7' : 'transparent', transition:'background 0.5s' }}>
                <span style={{ fontSize:11, fontFamily:'var(--font-mono)', color:COLORS.slate500, fontWeight:600 }}>{c.codigo}</span>
                <div style={{ fontWeight:500, color:COLORS.ink }}>{c.proveedor}</div>
                <div style={{ color:COLORS.slate600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.descripcion || '—'}</div>
                <div style={{ fontFamily:'var(--font-mono)', fontWeight:600, color:COLORS.navy }}>{fmtMoney(c.monto)}</div>
                <div style={{ fontSize:11, color:COLORS.slate500, fontFamily:'var(--font-mono)' }}>{c.proyecto?.codigo || '—'}</div>
                <div style={{ fontSize:11, color:COLORS.slate500, fontFamily:'var(--font-mono)' }}>{c.fecha_solicitud}</div>
                <div>
                  {puedeAprobar ? (
                    <select value={c.estado} onChange={e => cambiarEstado(c.id, e.target.value)} style={{ border:'none', background:ESTADOS_COMPRA[c.estado]?.bg, color:ESTADOS_COMPRA[c.estado]?.color, padding:'4px 8px', borderRadius:12, fontSize:11, fontWeight:500, cursor:'pointer' }}>
                      {Object.keys(ESTADOS_COMPRA).map(e => <option key={e}>{e}</option>)}
                    </select>
                  ) : <Badge texto={c.estado} mapa={ESTADOS_COMPRA}/>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ModalNuevaCompra({ usuario, onClose, onCreada }) {
  const [proyectos, setProyectos] = useState([])
  const [form, setForm] = useState({ proveedor:'', descripcion:'', monto:'', proyecto_id:'', notas:'' })
  useEffect(() => { getProyectos().then(setProyectos) }, [])

  const crear = async () => {
    if (!form.proveedor || !form.monto) { alert('Completa proveedor y monto'); return }
    await crearCompra({ ...form, monto: Number(form.monto), proyecto_id: form.proyecto_id || null, solicitado_por: usuario.id })
    onCreada()
  }

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(10,37,64,0.35)', zIndex:999 }}/>
      <div style={{ position:'fixed', top:'10%', left:'50%', transform:'translateX(-50%)', width:560, background:'white', borderRadius:16, zIndex:1000 }}>
        <div style={{ padding:'20px 28px', borderBottom:`1px solid ${COLORS.slate100}`, display:'flex', justifyContent:'space-between' }}>
          <h2 style={{ fontSize:20, fontWeight:500, margin:0, color:COLORS.navy, fontFamily:'var(--font-serif)' }}>Nueva solicitud de compra</h2>
          <button onClick={onClose} style={{ border:'none', background:'transparent', cursor:'pointer' }}>{Icon('X')}</button>
        </div>
        <div style={{ padding:24 }}>
          <div style={{ marginBottom:14 }}><label style={labelStyle}>Proveedor *</label><input value={form.proveedor} onChange={e=>setForm({...form, proveedor:e.target.value})} style={inputStyle}/></div>
          <div style={{ marginBottom:14 }}><label style={labelStyle}>Descripción</label><textarea value={form.descripcion} onChange={e=>setForm({...form, descripcion:e.target.value})} rows={2} style={{...inputStyle, resize:'vertical'}}/></div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
            <div><label style={labelStyle}>Monto (MXN) *</label><input type="number" value={form.monto} onChange={e=>setForm({...form, monto:e.target.value})} style={inputStyle}/></div>
            <div><label style={labelStyle}>Proyecto</label><select value={form.proyecto_id} onChange={e=>setForm({...form, proyecto_id:e.target.value})} style={selectStyle}><option value="">Sin proyecto</option>{proyectos.map(p => <option key={p.id} value={p.id}>{p.codigo} · {p.nombre}</option>)}</select></div>
          </div>
          <div style={{ marginBottom:14 }}><label style={labelStyle}>Notas</label><textarea value={form.notas} onChange={e=>setForm({...form, notas:e.target.value})} rows={2} style={{...inputStyle, resize:'vertical'}}/></div>
          <div style={{ padding:10, background:COLORS.slate50, borderRadius:8, fontSize:11, color:COLORS.slate600 }}>
            {Number(form.monto) < 50000 ? 'Aprobación: Administración' : 'Aprobación: Dirección General (monto &gt; $50,000)'}
          </div>
        </div>
        <div style={{ padding:'16px 28px', borderTop:`1px solid ${COLORS.slate100}`, display:'flex', justifyContent:'flex-end', gap:10 }}>
          <button onClick={onClose} style={{ padding:'10px 18px', background:'transparent', border:`1px solid ${COLORS.slate200}`, borderRadius:8, fontSize:13, cursor:'pointer' }}>Cancelar</button>
          <button onClick={crear} style={{ padding:'10px 22px', background:COLORS.navy, color:'white', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer' }}>Solicitar</button>
        </div>
      </div>
    </>
  )
}