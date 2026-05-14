import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { getCompras, crearCompra, actualizarCompra, eliminarCompra, getProyectos, getUsuarios } from './supabase'
import { COLORS, ESTADOS_COMPRA, Badge, fmtMoney, fmtDate, inputStyle, selectStyle, labelStyle, Icon, LoadingState, EmptyState } from './helpers'
import { puedeEliminar } from './permisos'  // v16.4.0

export default function Compras({ usuario }) {
  const [searchParams, setSearchParams] = useSearchParams()
  // Deep-link desde Centro de Alertas: ?cxp=X → scroll + highlight
  const deepLinkRef = useRef({ cxpId: searchParams.get('cxp'), aplicado: false })
  const [highlightId, setHighlightId] = useState(null)
  const rowRefs = useRef({})
  const [compras, setCompras] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [compraSel, setCompraSel] = useState(null)  // v15.8.4

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
      {compraSel && <PanelCompra compra={compraSel} usuario={usuario} onClose={() => setCompraSel(null)} onCambio={() => { setCompraSel(null); cargar() }}/>}

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:32, fontWeight:400, color:COLORS.navy, margin:0, letterSpacing:'-0.02em', fontFamily:'var(--font-sans)' }}>Compras</h1>
          <p style={{ color:COLORS.slate500, fontSize:13, marginTop:6 }}>{compras.length} solicitudes · Total: <strong>{fmtMoney(total)}</strong></p>
        </div>
        <button onClick={() => setModal(true)} style={{ padding:'10px 20px', background:COLORS.navy, color:'white', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>{Icon('Plus')} Nueva solicitud</button>
      </div>

      {pendientes > 0 && (
        <div style={{ padding:14, background:COLORS.amberLight, border:`1px solid ${COLORS.amberBorder}`, borderRadius:10, marginBottom:16, fontSize:12, color:COLORS.amberInk }}>
          <strong>{fmtMoney(pendientes)}</strong> en solicitudes pendientes de aprobación
        </div>
      )}

      {loading && <LoadingState/>}

      {!loading && compras.length === 0 && <EmptyState titulo="Sin solicitudes de compra"/>}

      {!loading && compras.length > 0 && (
        <div style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, overflow:'hidden' }}>
          <div style={{ display:'grid', gridTemplateColumns:'100px 180px 1fr 140px 120px 130px 140px', padding:'12px 20px', background:COLORS.slate50, borderBottom:`1px solid ${COLORS.slate100}`, fontSize:10, fontWeight:600, color:COLORS.slate500, textTransform:'uppercase', letterSpacing:'0.07em' }}>
            <div>Código</div><div>Proveedor</div><div>Descripción</div><div>Monto</div><div>Proyecto</div><div>Solicitud</div><div>Estado</div>
          </div>
          {compras.map(c => {
            // v15.8.4: dirección siempre puede modificar el estado; admin solo si Solicitada y <50k
            // v15.8.4: dirección siempre puede modificar el estado; admin solo si Solicitada y <50k
            const puedeAprobar = (
              puedeEliminar(usuario) ||  // dirección
              (c.estado === 'Solicitada' && usuario?.rol === 'admin' && Number(c.monto) < 50000)
            )
            return (
              <div
                key={c.id}
                ref={el => { if (el) rowRefs.current[c.id] = el }}
                onClick={() => setCompraSel(c)}
                title="Click para ver detalle"
                style={{
                  display:'grid', gridTemplateColumns:'100px 180px 1fr 140px 120px 130px 140px',
                  padding:'12px 20px', borderBottom:`1px solid ${COLORS.slate100}`,
                  alignItems:'center', fontSize:12,
                  background: highlightId === c.id ? COLORS.amberLight : 'transparent',
                  transition:'background 0.3s', cursor:'pointer',
                }}
                onMouseEnter={e => { if (highlightId !== c.id) e.currentTarget.style.background = COLORS.slate50 }}
                onMouseLeave={e => { if (highlightId !== c.id) e.currentTarget.style.background = 'transparent' }}
              >
                <span style={{ fontSize:11, fontFamily:'var(--font-mono)', color:COLORS.slate500, fontWeight:600 }}>{c.codigo}</span>
                <div style={{ fontWeight:500, color:COLORS.ink }}>{c.proveedor}</div>
                <div style={{ color:COLORS.slate600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.descripcion || '—'}</div>
                <div style={{ fontFamily:'var(--font-mono)', fontWeight:600, color:COLORS.navy }}>{fmtMoney(c.monto)}</div>
                <div style={{ fontSize:11, color:COLORS.slate500, fontFamily:'var(--font-mono)' }}>{c.proyecto?.codigo || '—'}</div>
                <div style={{ fontSize:11, color:COLORS.slate500, fontFamily:'var(--font-mono)' }}>{c.fecha_solicitud}</div>
                <div style={{ display:'flex', alignItems:'center', gap:6 }} onClick={e => e.stopPropagation()}>
                  {puedeAprobar ? (
                    <select value={c.estado} onChange={e => cambiarEstado(c.id, e.target.value)} style={{ border:'none', background:ESTADOS_COMPRA[c.estado]?.bg, color:ESTADOS_COMPRA[c.estado]?.color, padding:'4px 8px', borderRadius:12, fontSize:11, fontWeight:500, cursor:'pointer', fontFamily:'inherit' }}>
                      {Object.keys(ESTADOS_COMPRA).map(e => <option key={e}>{e}</option>)}
                    </select>
                  ) : <Badge texto={c.estado} mapa={ESTADOS_COMPRA}/>}
                  {puedeEliminar(usuario) && (
                    <button
                      onClick={async (ev) => {
                        ev.stopPropagation()
                        if (!confirm(`¿Eliminar compra ${c.codigo}? Esta acción no se puede deshacer.`)) return
                        try { await eliminarCompra(c.id); cargar() }
                        catch (e) { alert('Error: ' + e.message) }
                      }}
                      title="Eliminar compra"
                      style={{ border:'none', background:'transparent', color:COLORS.red, cursor:'pointer', padding:4, display:'flex', alignItems:'center' }}
                    >{Icon('Trash')}</button>
                  )}
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
          <h2 style={{ fontSize:20, fontWeight:500, margin:0, color:COLORS.navy, fontFamily:'var(--font-sans)' }}>Nueva solicitud de compra</h2>
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

// ============================================================
// v15.8.4: PanelCompra — modal con detalle completo de la compra
// ============================================================
function PanelCompra({ compra: c, usuario, onClose, onCambio }) {
  const navigate = useNavigate()
  const [estado, setEstado] = useState(c.estado)
  const [descripcion, setDescripcion] = useState(c.descripcion || '')
  const [notas, setNotas] = useState(c.notas || '')
  const [fechaPago, setFechaPago] = useState(c.fecha_pago || '')
  const [guardando, setGuardando] = useState(false)
  const puedeBorrar = puedeEliminar(usuario)

  const guardar = async () => {
    setGuardando(true)
    try {
      const cambios = { estado, descripcion: descripcion || null, notas: notas || null, fecha_pago: fechaPago || null }
      // Si se aprueba ahora, registrar quién y cuándo (consistente con el toggle inline)
      if (estado === 'Aprobada' && c.estado !== 'Aprobada') {
        cambios.fecha_aprobacion = new Date().toISOString().split('T')[0]
        cambios.aprobado_por = usuario.id
      }
      await actualizarCompra(c.id, cambios)
      onCambio()
    } catch (e) { alert('Error: ' + e.message); setGuardando(false) }
  }

  const borrar = async () => {
    if (!confirm(`¿Eliminar compra ${c.codigo}? Esta acción no se puede deshacer.`)) return
    setGuardando(true)
    try { await eliminarCompra(c.id); onCambio() }
    catch (e) { alert('Error: ' + e.message); setGuardando(false) }
  }

  const irAProyecto = () => {
    if (c.proyecto?.id) navigate(`/proyectos?proyecto=${c.proyecto.id}`)
  }

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(10,37,64,0.35)', zIndex:999 }}/>
      <div style={{ position:'fixed', top:'5%', left:'50%', transform:'translateX(-50%)', width:580, maxHeight:'90vh', overflow:'auto', background:'white', borderRadius:16, zIndex:1000 }}>
        <div style={{ padding:'18px 24px', borderBottom:`1px solid ${COLORS.slate100}`, display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
          <div>
            <div style={{ fontSize:11, fontFamily:'var(--font-mono)', color:COLORS.slate500, fontWeight:700, marginBottom:3 }}>{c.codigo || '—'}</div>
            <h2 style={{ fontSize:18, fontWeight:500, margin:0, color:COLORS.navy, fontFamily:'var(--font-sans)' }}>{c.proveedor}</h2>
            <div style={{ marginTop:6, display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
              <Badge texto={c.estado} mapa={ESTADOS_COMPRA}/>
              <span style={{ fontSize:18, fontWeight:700, color:COLORS.navy, fontFamily:'var(--font-mono)' }}>{fmtMoney(Number(c.monto || 0))}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ border:'none', background:'transparent', cursor:'pointer' }}>{Icon('X')}</button>
        </div>

        <div style={{ padding:24 }}>
          {/* Proyecto asociado */}
          <div style={{ background:COLORS.slate50, borderRadius:10, padding:14, marginBottom:16 }}>
            <div style={{ fontSize:10, fontWeight:700, color:COLORS.slate500, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>Proyecto asociado</div>
            {c.proyecto?.id ? (
              <>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                  <span style={{ fontSize:11, fontFamily:'var(--font-mono)', color:COLORS.slate500, fontWeight:700 }}>{c.proyecto.codigo}</span>
                  <span style={{ fontSize:13, fontWeight:600, color:COLORS.ink }}>{c.proyecto.nombre}</span>
                </div>
                <button onClick={irAProyecto} style={{ marginTop:6, padding:'6px 12px', background:COLORS.navy, color:'white', border:'none', borderRadius:6, fontSize:11, fontWeight:600, cursor:'pointer' }}>
                  Abrir proyecto →
                </button>
              </>
            ) : (
              <div style={{ fontSize:11, color:COLORS.slate500, fontStyle:'italic' }}>Compra sin proyecto vinculado.</div>
            )}
          </div>

          {/* Datos de la solicitud */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14 }}>
            <DataRowC label="Solicitada" valor={c.fecha_solicitud ? fmtDate(c.fecha_solicitud) : '—'}/>
            <DataRowC label="Aprobada" valor={c.fecha_aprobacion ? fmtDate(c.fecha_aprobacion) : '—'}/>
            <DataRowC label="Aprobador" valor={c.aprobador?.nombre || '—'}/>
            <DataRowC label="Pago" valor={c.fecha_pago ? fmtDate(c.fecha_pago) : '—'}/>
          </div>

          <div style={{ marginBottom:12 }}>
            <label style={labelStyle}>Descripción</label>
            <textarea value={descripcion} onChange={e=>setDescripcion(e.target.value)} rows={2} style={{...inputStyle, resize:'vertical', fontFamily:'inherit'}}/>
          </div>

          {/* Edición */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
            <div>
              <label style={labelStyle}>Estado</label>
              <select value={estado} onChange={e=>setEstado(e.target.value)} style={selectStyle}>
                {Object.keys(ESTADOS_COMPRA).map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Fecha de pago</label>
              <input type="date" value={fechaPago} onChange={e=>setFechaPago(e.target.value)} style={inputStyle}/>
            </div>
          </div>
          <div style={{ marginBottom:8 }}>
            <label style={labelStyle}>Notas</label>
            <textarea value={notas} onChange={e=>setNotas(e.target.value)} rows={3} style={{...inputStyle, resize:'vertical', fontFamily:'inherit'}} placeholder="Justificación, contacto del proveedor, condiciones..."/>
          </div>
        </div>

        <div style={{ padding:'14px 24px', borderTop:`1px solid ${COLORS.slate100}`, display:'flex', justifyContent:'space-between', gap:8 }}>
          {puedeBorrar ? (
            <button onClick={borrar} disabled={guardando} style={{ padding:'9px 14px', background:'transparent', border:`1px solid ${COLORS.red}`, color:COLORS.red, borderRadius:7, fontSize:12, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
              {Icon('Trash')} Eliminar
            </button>
          ) : <span/>}
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={onClose} disabled={guardando} style={{ padding:'9px 16px', background:'transparent', border:`1px solid ${COLORS.slate200}`, borderRadius:7, fontSize:12, cursor:'pointer' }}>Cancelar</button>
            <button onClick={guardar} disabled={guardando} style={{ padding:'9px 18px', background:COLORS.navy, color:'white', border:'none', borderRadius:7, fontSize:12, fontWeight:600, cursor: guardando ? 'wait' : 'pointer' }}>{guardando ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </div>
      </div>
    </>
  )
}

function DataRowC({ label, valor }) {
  return (
    <div>
      <div style={{ fontSize:9, fontWeight:700, color:COLORS.slate500, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:3 }}>{label}</div>
      <div style={{ fontSize:12, fontWeight:500, color:COLORS.ink }}>{valor}</div>
    </div>
  )
}