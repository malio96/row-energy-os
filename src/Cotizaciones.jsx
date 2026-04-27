import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getCotizaciones, getCotizacion, crearCotizacion, actualizarCotizacion, agregarCotizacionItem, actualizarCotizacionItem, eliminarCotizacionItem, getClientes, getUsuarios, getPlantillas } from './supabase'
import { COLORS, ESTADOS_COT, Badge, Avatar, fmtMoney, inputStyle, selectStyle, labelStyle, Icon } from './helpers'

export default function Cotizaciones({ usuario }) {
  const [searchParams, setSearchParams] = useSearchParams()
  // Deep-link desde Centro de Alertas: capturar ?cotizacion=X en el primer render
  const deepLinkRef = useRef({ cotizacionId: searchParams.get('cotizacion'), aplicado: false })
  const [cots, setCots] = useState([])
  const [loading, setLoading] = useState(true)
  const [selId, setSelId] = useState(null)
  const [modalNuevo, setModalNuevo] = useState(false)

  const cargar = async () => { setLoading(true); setCots(await getCotizaciones()); setLoading(false) }
  useEffect(() => { cargar() }, [])

  useEffect(() => {
    if (deepLinkRef.current.aplicado) return
    if (cots.length === 0) return
    const { cotizacionId } = deepLinkRef.current
    if (cotizacionId && cots.some(c => c.id === cotizacionId)) setSelId(cotizacionId)
    deepLinkRef.current.aplicado = true
    if (searchParams.get('cotizacion')) setSearchParams({}, { replace: true })
  }, [cots, searchParams, setSearchParams])

  if (selId) return <CotizacionDetalle id={selId} usuario={usuario} onVolver={() => { setSelId(null); cargar() }}/>

  return (
    <div>
      {modalNuevo && <ModalNuevaCotizacion usuario={usuario} onClose={() => setModalNuevo(false)} onCreada={(c) => { setModalNuevo(false); cargar(); setSelId(c.id) }}/>}

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:28 }}>
        <div>
          <h1 style={{ fontSize:32, fontWeight:400, color:COLORS.navy, margin:0, letterSpacing:'-0.02em', fontFamily:'var(--font-sans)' }}>Cotizaciones</h1>
          <p style={{ color:COLORS.slate500, fontSize:13, marginTop:6 }}>{cots.length} cotización{cots.length!==1?'es':''}</p>
        </div>
        <button onClick={() => setModalNuevo(true)} style={{ padding:'10px 20px', background:COLORS.navy, color:'white', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
          {Icon('Plus')} Nueva cotización
        </button>
      </div>

      {loading && <div style={{ padding:40, textAlign:'center', color:COLORS.slate400, fontSize:13 }}>Cargando...</div>}

      {!loading && cots.length === 0 && (
        <div style={{ padding:'60px 30px', background:'white', border:`1px dashed ${COLORS.slate200}`, borderRadius:12, textAlign:'center' }}>
          <div style={{ fontSize:14, color:COLORS.slate500 }}>Aún no hay cotizaciones</div>
          <button onClick={() => setModalNuevo(true)} style={{ marginTop:16, padding:'10px 20px', background:COLORS.navy, color:'white', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer' }}>+ Crear primera cotización</button>
        </div>
      )}

      {!loading && cots.length > 0 && (
        <div style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, overflow:'hidden' }}>
          <div style={{ display:'grid', gridTemplateColumns:'100px 1fr 200px 140px 120px 130px', padding:'12px 20px', background:COLORS.slate50, borderBottom:`1px solid ${COLORS.slate100}`, fontSize:10, fontWeight:600, color:COLORS.slate500, textTransform:'uppercase', letterSpacing:'0.07em' }}>
            <div>Código</div><div>Proyecto</div><div>Cliente</div><div>Total</div><div>Estado</div><div>Emitida</div>
          </div>
          {cots.map(c => (
            <div key={c.id} onClick={() => setSelId(c.id)} style={{ display:'grid', gridTemplateColumns:'100px 1fr 200px 140px 120px 130px', padding:'14px 20px', borderBottom:`1px solid ${COLORS.slate100}`, alignItems:'center', cursor:'pointer', transition:'background 0.12s' }}
              onMouseEnter={e => e.currentTarget.style.background = COLORS.slate50} onMouseLeave={e => e.currentTarget.style.background = 'white'}>
              <span style={{ fontSize:11, fontFamily:'var(--font-mono)', color:COLORS.slate500, fontWeight:600 }}>{c.codigo}</span>
              <div>
                <div style={{ fontSize:13, fontWeight:500, color:COLORS.ink }}>{c.nombre_proyecto}</div>
                {c.capacidad_mw && <div style={{ fontSize:11, color:COLORS.slate500 }}>{c.capacidad_mw} MW · {c.ubicacion || ''}</div>}
              </div>
              <div style={{ fontSize:12, color:COLORS.slate600 }}>{c.cliente?.razon_social || '—'}</div>
              <div style={{ fontSize:13, fontFamily:'var(--font-mono)', fontWeight:600, color:COLORS.navy }}>{fmtMoney(c.total)} <span style={{ fontSize:10, color:COLORS.slate400, fontWeight:400 }}>{c.moneda}</span></div>
              <div><Badge texto={c.estado} mapa={ESTADOS_COT}/></div>
              <div style={{ fontSize:11, color:COLORS.slate500, fontFamily:'var(--font-mono)' }}>{c.fecha_emision}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ModalNuevaCotizacion({ usuario, onClose, onCreada }) {
  const [clientes, setClientes] = useState([])
  const [plantillas, setPlantillas] = useState([])
  const [form, setForm] = useState({ nombre_proyecto:'', cliente_id:'', plantilla_id:'', capacidad_mw:'', ubicacion:'', notas:'' })
  const [creando, setCreando] = useState(false)

  useEffect(() => {
    Promise.all([getClientes(), getPlantillas()]).then(([c, p]) => { setClientes(c); setPlantillas(p) })
  }, [])

  const crear = async () => {
    if (!form.nombre_proyecto || !form.cliente_id) { alert('Completa nombre y cliente'); return }
    setCreando(true)
    try {
      const cot = await crearCotizacion({
        ...form,
        capacidad_mw: form.capacidad_mw ? parseFloat(form.capacidad_mw) : null,
        plantilla_id: form.plantilla_id || null,
        vendedor_id: usuario.id,
        fecha_vigencia: new Date(Date.now() + 30*86400000).toISOString().split('T')[0],
      })
      onCreada(cot)
    } catch (e) { alert('Error: ' + e.message); setCreando(false) }
  }

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(10,37,64,0.35)', zIndex:999 }}/>
      <div style={{ position:'fixed', top:'10%', left:'50%', transform:'translateX(-50%)', width:'min(560px, 95vw)', background:'white', borderRadius:16, boxShadow:'0 20px 60px rgba(10,37,64,0.2)', zIndex:1000 }}>
        <div style={{ padding:'20px 28px', borderBottom:`1px solid ${COLORS.slate100}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <h2 style={{ fontSize:20, fontWeight:500, color:COLORS.navy, fontFamily:'var(--font-sans)', margin:0 }}>Nueva cotización</h2>
          <button onClick={onClose} style={{ width:30, height:30, border:'none', background:COLORS.slate50, borderRadius:8, cursor:'pointer' }}>{Icon('X')}</button>
        </div>
        <div style={{ padding:24 }}>
          <div style={{ marginBottom:14 }}><label style={labelStyle}>Nombre del proyecto *</label><input value={form.nombre_proyecto} onChange={e=>setForm({...form, nombre_proyecto:e.target.value})} placeholder="Ej: Interconexión Intel Querétaro 50 MW" style={inputStyle}/></div>
          <div style={{ marginBottom:14 }}><label style={labelStyle}>Cliente *</label><select value={form.cliente_id} onChange={e=>setForm({...form, cliente_id:e.target.value})} style={selectStyle}><option value="">Selecciona...</option>{clientes.map(c => <option key={c.id} value={c.id}>{c.razon_social}</option>)}</select></div>
          <div style={{ marginBottom:14 }}><label style={labelStyle}>Plantilla sugerida (opcional)</label><select value={form.plantilla_id} onChange={e=>setForm({...form, plantilla_id:e.target.value})} style={selectStyle}><option value="">Sin plantilla</option>{plantillas.map(p => <option key={p.id} value={p.id}>{p.codigo} · {p.nombre}</option>)}</select></div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
            <div><label style={labelStyle}>Capacidad (MW)</label><input type="number" step="0.1" value={form.capacidad_mw} onChange={e=>setForm({...form, capacidad_mw:e.target.value})} style={inputStyle}/></div>
            <div><label style={labelStyle}>Ubicación</label><input value={form.ubicacion} onChange={e=>setForm({...form, ubicacion:e.target.value})} placeholder="Ej: Querétaro, MX" style={inputStyle}/></div>
          </div>
          <div style={{ marginBottom:14 }}><label style={labelStyle}>Notas</label><textarea value={form.notas} onChange={e=>setForm({...form, notas:e.target.value})} rows={3} style={{...inputStyle, resize:'vertical', fontFamily:'inherit'}} placeholder="Condiciones, observaciones..."/></div>
        </div>
        <div style={{ padding:'16px 28px', borderTop:`1px solid ${COLORS.slate100}`, display:'flex', justifyContent:'flex-end', gap:10 }}>
          <button onClick={onClose} style={{ padding:'10px 18px', background:'transparent', color:COLORS.slate600, border:`1px solid ${COLORS.slate200}`, borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer' }}>Cancelar</button>
          <button onClick={crear} disabled={creando} style={{ padding:'10px 22px', background:COLORS.navy, color:'white', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor: creando?'wait':'pointer' }}>{creando ? 'Creando...' : 'Crear'}</button>
        </div>
      </div>
    </>
  )
}

function CotizacionDetalle({ id, usuario, onVolver }) {
  const [cot, setCot] = useState(null)
  const [loading, setLoading] = useState(true)
  const [modalItem, setModalItem] = useState(false)
  const [itemEditando, setItemEditando] = useState(null)
  const [editandoInfo, setEditandoInfo] = useState(false)

  const cargar = async () => { setLoading(true); setCot(await getCotizacion(id)); setLoading(false) }
  useEffect(() => { cargar() }, [id])

  if (loading) return <div style={{ padding:40, textAlign:'center', color:COLORS.slate400 }}>Cargando...</div>
  if (!cot) return null

  const esBorrador = cot.estado === 'Borrador'

  const cambiarEstado = async (nuevo) => {
    if (nuevo === 'Aprobada' && !confirm('Al aprobar se creará el proyecto automáticamente con los hitos 50/40/10. ¿Continuar?')) return
    await actualizarCotizacion(cot.id, { estado: nuevo })
    cargar()
    if (nuevo === 'Aprobada') setTimeout(() => alert('✓ Proyecto creado. Revisa el módulo Proyectos.'), 500)
  }

  const delItem = async (itemId) => { if (!confirm('¿Eliminar item?')) return; await eliminarCotizacionItem(itemId); cargar() }

  return (
    <div>
      {modalItem && <ModalNuevoItem cotizacionId={cot.id} onClose={() => setModalItem(false)} onAgregado={() => { setModalItem(false); cargar() }}/>}
      {itemEditando && <ModalEditarItem item={itemEditando} onClose={() => setItemEditando(null)} onGuardado={() => { setItemEditando(null); cargar() }}/>}
      {editandoInfo && <ModalEditarInfo cot={cot} onClose={() => setEditandoInfo(false)} onGuardado={() => { setEditandoInfo(false); cargar() }}/>}

      <div style={{ display:'flex', alignItems:'flex-start', gap:16, marginBottom:24 }}>
        <button onClick={onVolver} style={{ padding:'8px 12px', background:'white', border:`1px solid ${COLORS.slate200}`, borderRadius:8, fontSize:13, cursor:'pointer', color:COLORS.slate600, display:'flex', alignItems:'center', gap:6 }}>{Icon('Back')} Cotizaciones</button>
        <div style={{ flex:1 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
            <span style={{ fontSize:11, fontFamily:'var(--font-mono)', color:COLORS.slate400, fontWeight:500 }}>{cot.codigo}</span>
            <Badge texto={cot.estado} mapa={ESTADOS_COT}/>
            {cot.cliente && <span style={{ fontSize:12, color:COLORS.slate500 }}>· {cot.cliente.razon_social}</span>}
          </div>
          <h1 style={{ fontSize:26, fontWeight:500, color:COLORS.navy, margin:0, fontFamily:'var(--font-sans)', letterSpacing:'-0.02em' }}>{cot.nombre_proyecto}</h1>
          <p style={{ fontSize:12, color:COLORS.slate500, margin:'4px 0 0' }}>Vendedor: {cot.vendedor?.nombre || '—'} · Emitida: {cot.fecha_emision}</p>
        </div>
        <select value={cot.estado} onChange={e => cambiarEstado(e.target.value)} style={{ ...selectStyle, width:180, fontWeight:600 }}>
          {Object.keys(ESTADOS_COT).map(e => <option key={e}>{e}</option>)}
        </select>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:20 }}>
        <div style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, overflow:'hidden' }}>
          <div style={{ padding:'14px 20px', borderBottom:`1px solid ${COLORS.slate100}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <h3 style={{ fontSize:13, fontWeight:600, color:COLORS.ink, margin:0 }}>Servicios cotizados ({cot.items.length})</h3>
            <button onClick={() => setModalItem(true)} disabled={cot.estado !== 'Borrador'} style={{ padding:'6px 12px', background: cot.estado === 'Borrador' ? COLORS.navy : COLORS.slate200, color:'white', border:'none', borderRadius:6, fontSize:12, fontWeight:500, cursor: cot.estado === 'Borrador' ? 'pointer' : 'not-allowed', display:'flex', alignItems:'center', gap:4 }}>{Icon('Plus')} Agregar</button>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'30px 1fr 100px 110px 140px 80px 40px', padding:'10px 20px', background:COLORS.slate50, fontSize:10, fontWeight:600, color:COLORS.slate500, textTransform:'uppercase', letterSpacing:'0.06em', borderBottom:`1px solid ${COLORS.slate100}` }}>
            <div>#</div><div>Servicio</div><div>Cant.</div><div>Precio unit.</div><div>% Pagos</div><div>Total</div><div></div>
          </div>
          {cot.items.length === 0 && <div style={{ padding:30, textAlign:'center', color:COLORS.slate400, fontSize:13 }}>Sin servicios. Agrega el primero.</div>}
          {cot.items.map(item => (
            <div
              key={item.id}
              onClick={esBorrador ? () => setItemEditando(item) : undefined}
              title={esBorrador ? 'Click para editar este item' : ''}
              style={{
                display:'grid', gridTemplateColumns:'30px 1fr 100px 110px 140px 80px 40px',
                padding:'12px 20px', borderBottom:`1px solid ${COLORS.slate100}`,
                alignItems:'center', fontSize:12,
                cursor: esBorrador ? 'pointer' : 'default',
                transition:'background 0.12s',
              }}
              onMouseEnter={e => { if (esBorrador) e.currentTarget.style.background = COLORS.slate50 }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            >
              <span style={{ color:COLORS.slate400, fontFamily:'var(--font-mono)' }}>{item.orden}</span>
              <div><div style={{ fontWeight:500, color:COLORS.ink }}>{item.servicio}</div>{item.descripcion && <div style={{ fontSize:11, color:COLORS.slate500, marginTop:2 }}>{item.descripcion}</div>}</div>
              <span style={{ fontFamily:'var(--font-mono)' }}>{item.cantidad}</span>
              <span style={{ fontFamily:'var(--font-mono)' }}>{fmtMoney(item.precio_unitario)}</span>
              <span style={{ fontSize:11, fontFamily:'var(--font-mono)', color:COLORS.slate600 }}>{item.porcentaje_anticipo}/{item.porcentaje_avance}/{item.porcentaje_finalizacion}</span>
              <span style={{ fontFamily:'var(--font-mono)', fontWeight:600, color:COLORS.navy }}>{fmtMoney(item.total)}</span>
              {esBorrador && (
                <button
                  onClick={(e) => { e.stopPropagation(); delItem(item.id) }}
                  title="Eliminar item"
                  style={{ border:'none', background:'transparent', color:COLORS.red, cursor:'pointer' }}
                >{Icon('Trash')}</button>
              )}
            </div>
          ))}
          <div style={{ padding:'16px 20px', display:'flex', justifyContent:'flex-end', gap:20, background:COLORS.slate50, borderTop:`1px solid ${COLORS.slate100}` }}>
            <div><span style={{ fontSize:11, color:COLORS.slate500 }}>Total: </span><span style={{ fontSize:18, fontWeight:600, color:COLORS.navy, fontFamily:'var(--font-mono)' }}>{fmtMoney(cot.total)}</span> <span style={{ fontSize:11, color:COLORS.slate400 }}>{cot.moneda}</span></div>
          </div>
        </div>

        <div>
          <div style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, padding:20, marginBottom:16 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
              <h3 style={{ fontSize:11, fontWeight:600, color:COLORS.slate500, margin:0, textTransform:'uppercase', letterSpacing:'0.08em' }}>Información</h3>
              <button onClick={() => setEditandoInfo(true)} style={{ padding:'4px 10px', background:'transparent', border:`1px solid ${COLORS.slate200}`, color:COLORS.slate600, borderRadius:6, fontSize:11, fontWeight:500, cursor:'pointer' }}>Editar</button>
            </div>
            {[['Cliente', cot.cliente?.razon_social], ['Capacidad', cot.capacidad_mw ? `${cot.capacidad_mw} MW` : '—'], ['Ubicación', cot.ubicacion], ['Fecha emisión', cot.fecha_emision], ['Vigencia', cot.fecha_vigencia]].map(([k,v]) => (
              <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:`1px solid ${COLORS.slate100}`, fontSize:12 }}>
                <span style={{ color:COLORS.slate500 }}>{k}</span><span style={{ fontWeight:500, color:COLORS.ink }}>{v || '—'}</span>
              </div>
            ))}
          </div>

          {cot.estado === 'Borrador' && cot.items.length > 0 && (
            <button onClick={() => cambiarEstado('Enviada')} style={{ width:'100%', padding:'12px', background:COLORS.teal, color:'white', border:'none', borderRadius:10, fontSize:13, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginBottom:8 }}>{Icon('Send')} Enviar al cliente</button>
          )}
          {cot.estado === 'Enviada' && (
            <button onClick={() => cambiarEstado('Aprobada')} style={{ width:'100%', padding:'12px', background:COLORS.teal, color:'white', border:'none', borderRadius:10, fontSize:13, fontWeight:600, cursor:'pointer', marginBottom:8 }}>✓ Marcar como aprobada</button>
          )}
          {/* v15.3: descargar PDF — disponible en cualquier estado salvo si no hay items */}
          {cot.items.length > 0 && (
            <button
              onClick={async () => {
                try {
                  const m = await import('./exportCotizacion')
                  await m.exportarCotizacionPDF(cot)
                } catch (e) {
                  alert('Error al generar PDF: ' + (e.message || e))
                }
              }}
              style={{ width:'100%', padding:'12px', background:'white', color:COLORS.navy, border:`1px solid ${COLORS.navy}`, borderRadius:10, fontSize:13, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
              Descargar PDF
            </button>
          )}

          {cot.notas && <div style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, padding:16, marginTop:12 }}>
            <div style={{ fontSize:10, fontWeight:600, color:COLORS.slate500, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>Notas</div>
            <p style={{ fontSize:12, color:COLORS.slate600, margin:0, lineHeight:1.5 }}>{cot.notas}</p>
          </div>}
        </div>
      </div>
    </div>
  )
}

function ModalNuevoItem({ cotizacionId, onClose, onAgregado }) {
  const [form, setForm] = useState({ servicio:'', descripcion:'', cantidad:1, precio_unitario:'', porcentaje_anticipo:50, porcentaje_avance:40, porcentaje_finalizacion:10 })
  const suma = Number(form.porcentaje_anticipo) + Number(form.porcentaje_avance) + Number(form.porcentaje_finalizacion)

  const agregar = async () => {
    if (!form.servicio || !form.precio_unitario) { alert('Completa servicio y precio'); return }
    if (suma !== 100) { alert('Los porcentajes deben sumar 100%'); return }
    const total = Number(form.cantidad) * Number(form.precio_unitario)
    await agregarCotizacionItem(cotizacionId, { ...form, precio_unitario: Number(form.precio_unitario), cantidad: Number(form.cantidad), total })
    onAgregado()
  }

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(10,37,64,0.35)', zIndex:1001 }}/>
      <div style={{ position:'fixed', top:'10%', left:'50%', transform:'translateX(-50%)', width:560, background:'white', borderRadius:16, zIndex:1002 }}>
        <div style={{ padding:'20px 28px', borderBottom:`1px solid ${COLORS.slate100}`, display:'flex', justifyContent:'space-between' }}>
          <h2 style={{ fontSize:18, fontWeight:500, margin:0, color:COLORS.navy, fontFamily:'var(--font-sans)' }}>Agregar servicio</h2>
          <button onClick={onClose} style={{ border:'none', background:'transparent', cursor:'pointer' }}>{Icon('X')}</button>
        </div>
        <div style={{ padding:24 }}>
          <div style={{ marginBottom:12 }}><label style={labelStyle}>Servicio *</label><input value={form.servicio} onChange={e=>setForm({...form, servicio:e.target.value})} placeholder="Ej: Estudio de Impacto" style={inputStyle}/></div>
          <div style={{ marginBottom:12 }}><label style={labelStyle}>Descripción</label><textarea value={form.descripcion} onChange={e=>setForm({...form, descripcion:e.target.value})} rows={2} style={{...inputStyle, resize:'vertical'}}/></div>
          <div style={{ display:'grid', gridTemplateColumns:'80px 1fr', gap:12, marginBottom:12 }}>
            <div><label style={labelStyle}>Cantidad</label><input type="number" value={form.cantidad} onChange={e=>setForm({...form, cantidad:e.target.value})} style={inputStyle}/></div>
            <div><label style={labelStyle}>Precio unitario (MXN) *</label><input type="number" value={form.precio_unitario} onChange={e=>setForm({...form, precio_unitario:e.target.value})} placeholder="450000" style={inputStyle}/></div>
          </div>
          <div style={{ marginBottom:8, padding:12, background:COLORS.slate50, borderRadius:8 }}>
            <label style={labelStyle}>Forma de pago (% debe sumar 100)</label>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
              <div><div style={{ fontSize:10, color:COLORS.slate500, marginBottom:4 }}>Anticipo</div><input type="number" value={form.porcentaje_anticipo} onChange={e=>setForm({...form, porcentaje_anticipo:e.target.value})} style={inputStyle}/></div>
              <div><div style={{ fontSize:10, color:COLORS.slate500, marginBottom:4 }}>Avance</div><input type="number" value={form.porcentaje_avance} onChange={e=>setForm({...form, porcentaje_avance:e.target.value})} style={inputStyle}/></div>
              <div><div style={{ fontSize:10, color:COLORS.slate500, marginBottom:4 }}>Finalización</div><input type="number" value={form.porcentaje_finalizacion} onChange={e=>setForm({...form, porcentaje_finalizacion:e.target.value})} style={inputStyle}/></div>
            </div>
            <div style={{ fontSize:11, marginTop:6, color: suma===100 ? COLORS.teal : COLORS.red, fontWeight:600, textAlign:'right' }}>Suma: {suma}%</div>
          </div>
        </div>
        <div style={{ padding:'16px 28px', borderTop:`1px solid ${COLORS.slate100}`, display:'flex', justifyContent:'flex-end', gap:10 }}>
          <button onClick={onClose} style={{ padding:'10px 18px', background:'transparent', border:`1px solid ${COLORS.slate200}`, borderRadius:8, fontSize:13, cursor:'pointer' }}>Cancelar</button>
          <button onClick={agregar} style={{ padding:'10px 22px', background:COLORS.navy, color:'white', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer' }}>Agregar servicio</button>
        </div>
      </div>
    </>
  )
}

// ============================================================
// v15.3b: ModalEditarItem — edita un item existente de la cotización
// ============================================================
function ModalEditarItem({ item, onClose, onGuardado }) {
  const [form, setForm] = useState({
    servicio: item.servicio || '',
    descripcion: item.descripcion || '',
    cantidad: item.cantidad || 1,
    precio_unitario: item.precio_unitario || '',
    porcentaje_anticipo: item.porcentaje_anticipo ?? 50,
    porcentaje_avance: item.porcentaje_avance ?? 40,
    porcentaje_finalizacion: item.porcentaje_finalizacion ?? 10,
  })
  const [guardando, setGuardando] = useState(false)
  const suma = Number(form.porcentaje_anticipo) + Number(form.porcentaje_avance) + Number(form.porcentaje_finalizacion)

  const guardar = async () => {
    if (!form.servicio || !form.precio_unitario) { alert('Completa servicio y precio'); return }
    if (suma !== 100) { alert('Los porcentajes deben sumar 100%'); return }
    setGuardando(true)
    try {
      const total = Number(form.cantidad) * Number(form.precio_unitario)
      await actualizarCotizacionItem(item.id, {
        servicio: form.servicio,
        descripcion: form.descripcion,
        cantidad: Number(form.cantidad),
        precio_unitario: Number(form.precio_unitario),
        porcentaje_anticipo: Number(form.porcentaje_anticipo),
        porcentaje_avance: Number(form.porcentaje_avance),
        porcentaje_finalizacion: Number(form.porcentaje_finalizacion),
        total,
      })
      onGuardado()
    } catch (e) { alert('Error: ' + e.message); setGuardando(false) }
  }

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(10,37,64,0.35)', zIndex:1001 }}/>
      <div style={{ position:'fixed', top:'8%', left:'50%', transform:'translateX(-50%)', width:560, maxHeight:'90vh', overflow:'auto', background:'white', borderRadius:16, zIndex:1002 }}>
        <div style={{ padding:'20px 28px', borderBottom:`1px solid ${COLORS.slate100}`, display:'flex', justifyContent:'space-between' }}>
          <h2 style={{ fontSize:18, fontWeight:500, margin:0, color:COLORS.navy, fontFamily:'var(--font-sans)' }}>Editar servicio</h2>
          <button onClick={onClose} style={{ border:'none', background:'transparent', cursor:'pointer' }}>{Icon('X')}</button>
        </div>
        <div style={{ padding:24 }}>
          <div style={{ marginBottom:12 }}><label style={labelStyle}>Servicio *</label><input value={form.servicio} onChange={e=>setForm({...form, servicio:e.target.value})} style={inputStyle}/></div>
          <div style={{ marginBottom:12 }}><label style={labelStyle}>Descripción</label><textarea value={form.descripcion} onChange={e=>setForm({...form, descripcion:e.target.value})} rows={2} style={{...inputStyle, resize:'vertical', fontFamily:'inherit'}}/></div>
          <div style={{ display:'grid', gridTemplateColumns:'80px 1fr', gap:12, marginBottom:12 }}>
            <div><label style={labelStyle}>Cantidad</label><input type="number" value={form.cantidad} onChange={e=>setForm({...form, cantidad:e.target.value})} style={inputStyle}/></div>
            <div><label style={labelStyle}>Precio unitario (MXN) *</label><input type="number" value={form.precio_unitario} onChange={e=>setForm({...form, precio_unitario:e.target.value})} style={inputStyle}/></div>
          </div>
          <div style={{ marginBottom:8, padding:12, background:COLORS.slate50, borderRadius:8 }}>
            <label style={labelStyle}>Forma de pago (% debe sumar 100)</label>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
              <div><div style={{ fontSize:10, color:COLORS.slate500, marginBottom:4 }}>Anticipo</div><input type="number" value={form.porcentaje_anticipo} onChange={e=>setForm({...form, porcentaje_anticipo:e.target.value})} style={inputStyle}/></div>
              <div><div style={{ fontSize:10, color:COLORS.slate500, marginBottom:4 }}>Avance</div><input type="number" value={form.porcentaje_avance} onChange={e=>setForm({...form, porcentaje_avance:e.target.value})} style={inputStyle}/></div>
              <div><div style={{ fontSize:10, color:COLORS.slate500, marginBottom:4 }}>Finalización</div><input type="number" value={form.porcentaje_finalizacion} onChange={e=>setForm({...form, porcentaje_finalizacion:e.target.value})} style={inputStyle}/></div>
            </div>
            <div style={{ fontSize:11, marginTop:6, color: suma===100 ? COLORS.teal : COLORS.red, fontWeight:600, textAlign:'right' }}>Suma: {suma}%</div>
          </div>
        </div>
        <div style={{ padding:'16px 28px', borderTop:`1px solid ${COLORS.slate100}`, display:'flex', justifyContent:'flex-end', gap:10 }}>
          <button onClick={onClose} disabled={guardando} style={{ padding:'10px 18px', background:'transparent', border:`1px solid ${COLORS.slate200}`, borderRadius:8, fontSize:13, cursor:'pointer' }}>Cancelar</button>
          <button onClick={guardar} disabled={guardando} style={{ padding:'10px 22px', background:COLORS.navy, color:'white', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor: guardando ? 'wait' : 'pointer' }}>{guardando ? 'Guardando...' : 'Guardar cambios'}</button>
        </div>
      </div>
    </>
  )
}

// ============================================================
// v15.3b: ModalEditarInfo — edita la metadata de la cotización
// ============================================================
function ModalEditarInfo({ cot, onClose, onGuardado }) {
  const [form, setForm] = useState({
    nombre_proyecto: cot.nombre_proyecto || '',
    capacidad_mw: cot.capacidad_mw ?? '',
    ubicacion: cot.ubicacion || '',
    fecha_emision: cot.fecha_emision || '',
    fecha_vigencia: cot.fecha_vigencia || '',
    notas: cot.notas || '',
  })
  const [guardando, setGuardando] = useState(false)

  const guardar = async () => {
    if (!form.nombre_proyecto.trim()) { alert('El nombre del proyecto es requerido'); return }
    setGuardando(true)
    try {
      await actualizarCotizacion(cot.id, {
        nombre_proyecto: form.nombre_proyecto.trim(),
        capacidad_mw: form.capacidad_mw === '' ? null : parseFloat(form.capacidad_mw),
        ubicacion: form.ubicacion || null,
        fecha_emision: form.fecha_emision || null,
        fecha_vigencia: form.fecha_vigencia || null,
        notas: form.notas || null,
      })
      onGuardado()
    } catch (e) { alert('Error: ' + e.message); setGuardando(false) }
  }

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(10,37,64,0.35)', zIndex:999 }}/>
      <div style={{ position:'fixed', top:'8%', left:'50%', transform:'translateX(-50%)', width:560, maxHeight:'90vh', overflow:'auto', background:'white', borderRadius:16, zIndex:1000 }}>
        <div style={{ padding:'20px 28px', borderBottom:`1px solid ${COLORS.slate100}`, display:'flex', justifyContent:'space-between' }}>
          <div>
            <h2 style={{ fontSize:18, fontWeight:500, margin:0, color:COLORS.navy, fontFamily:'var(--font-sans)' }}>Editar información</h2>
            <p style={{ fontSize:11, color:COLORS.slate500, margin:'4px 0 0' }}>{cot.codigo} · {cot.cliente?.razon_social || ''}</p>
          </div>
          <button onClick={onClose} style={{ border:'none', background:'transparent', cursor:'pointer' }}>{Icon('X')}</button>
        </div>
        <div style={{ padding:24 }}>
          <div style={{ marginBottom:12 }}>
            <label style={labelStyle}>Nombre del proyecto *</label>
            <input value={form.nombre_proyecto} onChange={e=>setForm({...form, nombre_proyecto:e.target.value})} style={inputStyle}/>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
            <div><label style={labelStyle}>Capacidad (MW)</label><input type="number" step="0.1" value={form.capacidad_mw} onChange={e=>setForm({...form, capacidad_mw:e.target.value})} style={inputStyle}/></div>
            <div><label style={labelStyle}>Ubicación</label><input value={form.ubicacion} onChange={e=>setForm({...form, ubicacion:e.target.value})} style={inputStyle}/></div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
            <div><label style={labelStyle}>Fecha emisión</label><input type="date" value={form.fecha_emision} onChange={e=>setForm({...form, fecha_emision:e.target.value})} style={inputStyle}/></div>
            <div><label style={labelStyle}>Vigencia</label><input type="date" value={form.fecha_vigencia} onChange={e=>setForm({...form, fecha_vigencia:e.target.value})} style={inputStyle}/></div>
          </div>
          <div style={{ marginBottom:8 }}>
            <label style={labelStyle}>Observaciones / Notas</label>
            <textarea value={form.notas} onChange={e=>setForm({...form, notas:e.target.value})} rows={4} style={{...inputStyle, resize:'vertical', fontFamily:'inherit'}} placeholder="Condiciones especiales, observaciones que aparecerán en el PDF..."/>
          </div>
        </div>
        <div style={{ padding:'16px 28px', borderTop:`1px solid ${COLORS.slate100}`, display:'flex', justifyContent:'flex-end', gap:10 }}>
          <button onClick={onClose} disabled={guardando} style={{ padding:'10px 18px', background:'transparent', border:`1px solid ${COLORS.slate200}`, borderRadius:8, fontSize:13, cursor:'pointer' }}>Cancelar</button>
          <button onClick={guardar} disabled={guardando} style={{ padding:'10px 22px', background:COLORS.navy, color:'white', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor: guardando ? 'wait' : 'pointer' }}>{guardando ? 'Guardando...' : 'Guardar cambios'}</button>
        </div>
      </div>
    </>
  )
}