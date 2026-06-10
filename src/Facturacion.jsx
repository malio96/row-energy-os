import { useState, useEffect, useRef, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { getFacturas, crearFactura, actualizarFactura, eliminarFactura, getHitos, getClientes } from './supabase'
import { COLORS, ESTADOS_FACTURA, Badge, fmtMoney, fmtDate, inputStyle, selectStyle, labelStyle, Icon, LoadingState, EmptyState, loadPref, savePref, SortControl, aplicarSort } from './helpers'
import { puedeEliminar, puedeEditarFinanciero } from './permisos'  // v16.4.0
import { toast, confirmDialog } from './Dialogs'  // v17.4.1: diálogos propios

export default function Facturacion({ usuario }) {
  const puedeEditar = puedeEditarFinanciero(usuario)
  const [searchParams, setSearchParams] = useSearchParams()
  // Deep-link desde Centro de Alertas: ?factura=X → scroll + highlight
  const deepLinkRef = useRef({ facturaId: searchParams.get('factura'), aplicado: false })
  const [highlightId, setHighlightId] = useState(null)
  const rowRefs = useRef({})
  const [facturas, setFacturas] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [facturaSel, setFacturaSel] = useState(null)  // v15.8.4
  const [sort, setSort] = useState(() => loadPref('sort.facturacion', { field:'emision', dir:'desc' }))
  useEffect(() => { savePref('sort.facturacion', sort) }, [sort])
  // v17.0.4: filtro especial via URL (?filtro=vencidas | cobradas_mes desde Dashboard "Ver todas")
  const filtroEspecial = searchParams.get('filtro')

  const cargar = async () => { setLoading(true); setFacturas(await getFacturas()); setLoading(false) }
  useEffect(() => { cargar() }, [])

  useEffect(() => {
    if (deepLinkRef.current.aplicado) return
    if (facturas.length === 0) return
    const { facturaId } = deepLinkRef.current
    if (facturaId && facturas.some(f => f.id === facturaId)) {
      setHighlightId(facturaId)
      // Scroll después del próximo render
      setTimeout(() => {
        rowRefs.current[facturaId]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 100)
      // Apagar el highlight a los 3s
      setTimeout(() => setHighlightId(null), 3000)
    }
    deepLinkRef.current.aplicado = true
    if (searchParams.get('factura')) setSearchParams({}, { replace: true })
  }, [facturas, searchParams, setSearchParams])

  const total = facturas.reduce((s,f) => s + Number(f.total), 0)
  const pagadas = facturas.filter(f => f.estado === 'Pagada').reduce((s,f) => s + Number(f.total), 0)
  const pendientes = facturas.filter(f => f.estado === 'Emitida').reduce((s,f) => s + Number(f.total), 0)

  const cambiarEstado = async (id, nuevo) => { await actualizarFactura(id, { estado: nuevo }); cargar() }

  const itemsOrdenados = useMemo(() => {
    let base = facturas
    // v17.0.4: filtro especial drill-down desde Dashboard
    if (filtroEspecial === 'vencidas') {
      const hoy = new Date().toISOString().split('T')[0]
      base = base.filter(f => f.estado === 'Emitida' && f.fecha_vencimiento && f.fecha_vencimiento < hoy)
    } else if (filtroEspecial === 'cobradas_mes') {
      const now = new Date()
      const y = now.getFullYear()
      const m = String(now.getMonth() + 1).padStart(2, '0')
      const prefijo = `${y}-${m}`
      base = base.filter(f => f.estado === 'Pagada' && f.fecha_pago && f.fecha_pago.startsWith(prefijo))
    }
    // Si el filtro especial aplica, override del sort por la fecha relevante
    const sortEffective =
      filtroEspecial === 'vencidas' ? { field:'vencimiento', dir:'asc' } :
      filtroEspecial === 'cobradas_mes' ? { field:'pago', dir:'desc' } :
      sort
    return aplicarSort(base, sortEffective, {
      emision:     f => f.fecha_emision || '0',
      folio:       f => f.folio || '',
      proyecto:    f => (f.proyecto?.nombre || '').toLowerCase(),
      cliente:     f => (f.cliente?.razon_social || f.proyecto?.cliente?.razon_social || '').toLowerCase(),
      total:       f => Number(f.total || 0),
      estado:      f => f.estado || '',
      vencimiento: f => f.fecha_vencimiento || '9999-12-31',
      pago:        f => f.fecha_pago || '0',
    })
  }, [facturas, sort, filtroEspecial])

  return (
    <div>
      {modal && <ModalNuevaFactura onClose={() => setModal(false)} onCreada={() => { setModal(false); cargar() }}/>}
      {facturaSel && <PanelFactura factura={facturaSel} usuario={usuario} onClose={() => setFacturaSel(null)} onCambio={() => { setFacturaSel(null); cargar() }}/>}

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:32, fontWeight:400, color:COLORS.navy, margin:0, letterSpacing:'-0.02em', fontFamily:'var(--font-sans)' }}>Facturación</h1>
          <p style={{ color:COLORS.slate500, fontSize:13, marginTop:6 }}>{facturas.length} facturas · Total: <strong>{fmtMoney(total)}</strong></p>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <SortControl value={sort} onChange={setSort} fields={[
            { key:'emision',  label:'Más reciente' },
            { key:'folio',    label:'Folio' },
            { key:'proyecto', label:'Proyecto' },
            { key:'cliente',  label:'Cliente' },
            { key:'total',    label:'Monto' },
            { key:'estado',   label:'Estado' },
          ]}/>
          {puedeEditar && <button onClick={() => setModal(true)} style={{ padding:'10px 20px', background:COLORS.navy, color:'white', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>{Icon('Plus')} Nueva factura</button>}
        </div>
      </div>

      {/* v17.0.4: banner cuando hay filtro especial drill-down desde Dashboard */}
      {filtroEspecial && ['vencidas','cobradas_mes'].includes(filtroEspecial) && (
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', marginBottom:14, background:'#FEF3C7', border:'1px solid #FDE68A', borderRadius:10 }}>
          {Icon('Alert')}
          <div style={{ flex:1, fontSize:12, color:COLORS.ink }}>
            <strong>Filtrando:</strong> {filtroEspecial === 'vencidas' ? 'facturas vencidas · ordenadas por fecha de vencimiento asc' : 'cobradas este mes · ordenadas por fecha de pago desc'}
          </div>
          <button onClick={() => setSearchParams({}, { replace: true })} style={{ padding:'5px 12px', background:'white', border:`1px solid ${COLORS.slate200}`, borderRadius:6, fontSize:11, fontWeight:600, color:COLORS.slate600, cursor:'pointer' }}>
            ✕ Quitar filtro
          </button>
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:12, marginBottom:20 }}>
        {[{ l:'Pagadas', v:fmtMoney(pagadas), c:COLORS.teal }, { l:'Pendientes', v:fmtMoney(pendientes), c:COLORS.amber }].map(k => (
          <div key={k.l} style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, padding:16 }}>
            <div style={{ fontSize:10, fontWeight:600, color:COLORS.slate500, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>{k.l}</div>
            <div style={{ fontSize:22, fontWeight:500, color:k.c, fontFamily:'var(--font-sans)' }}>{k.v}</div>
          </div>
        ))}
      </div>

      {loading && <LoadingState/>}

      {!loading && facturas.length === 0 && <EmptyState titulo="Sin facturas" descripcion="Crea la primera desde un hito cobrable."/>}

      {!loading && facturas.length > 0 && (
        <div style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, overflow:'hidden' }}>
          <div style={{ display:'grid', gridTemplateColumns:'90px 1fr 220px 130px 120px 140px', padding:'12px 20px', background:COLORS.slate50, borderBottom:`1px solid ${COLORS.slate100}`, fontSize:10, fontWeight:600, color:COLORS.slate500, textTransform:'uppercase', letterSpacing:'0.07em' }}>
            <div>Folio</div><div>Proyecto</div><div>Cliente</div><div>Total</div><div>Emisión</div><div>Estado</div>
          </div>
          {itemsOrdenados.map(f => (
            <div
              key={f.id}
              ref={el => { if (el) rowRefs.current[f.id] = el }}
              onClick={() => setFacturaSel(f)}
              title="Click para ver detalle"
              style={{
                display:'grid', gridTemplateColumns:'90px 1fr 220px 130px 120px 140px',
                padding:'12px 20px', borderBottom:`1px solid ${COLORS.slate100}`,
                alignItems:'center', fontSize:12,
                background: highlightId === f.id ? COLORS.amberLight : 'transparent',
                transition:'background 0.3s', cursor:'pointer',
              }}
              onMouseEnter={e => { if (highlightId !== f.id) e.currentTarget.style.background = COLORS.slate50 }}
              onMouseLeave={e => { if (highlightId !== f.id) e.currentTarget.style.background = 'transparent' }}
            >
              <span style={{ fontSize:11, fontFamily:'var(--font-mono)', color:COLORS.slate500, fontWeight:600 }}>{f.folio}</span>
              <div>
                <div style={{ fontWeight:500, color:COLORS.ink }}>{f.proyecto?.nombre || '—'}</div>
                {f.uuid_sat && <div style={{ fontSize:10, color:COLORS.slate400, fontFamily:'var(--font-mono)' }}>UUID: {f.uuid_sat}</div>}
              </div>
              <div style={{ color:COLORS.slate600 }}>{f.cliente?.razon_social || '—'}</div>
              <div style={{ fontFamily:'var(--font-mono)', fontWeight:600, color:COLORS.navy }}>{fmtMoney(f.total)}</div>
              <div style={{ fontSize:11, fontFamily:'var(--font-mono)', color:COLORS.slate500 }}>{f.fecha_emision}</div>
              <div style={{ display:'flex', alignItems:'center', gap:6 }} onClick={e => e.stopPropagation()}>
                <select value={f.estado} onChange={e => cambiarEstado(f.id, e.target.value)} disabled={!puedeEditar} style={{ border:'none', background:ESTADOS_FACTURA[f.estado]?.bg, color:ESTADOS_FACTURA[f.estado]?.color, padding:'4px 8px', borderRadius:12, fontSize:11, fontWeight:500, cursor: puedeEditar ? 'pointer' : 'not-allowed', fontFamily:'inherit', opacity: puedeEditar ? 1 : 0.55 }}>{Object.keys(ESTADOS_FACTURA).map(e => <option key={e}>{e}</option>)}</select>
                {puedeEliminar(usuario) && (
                  <button
                    onClick={async (ev) => {
                      ev.stopPropagation()
                      if (!(await confirmDialog({ title: 'Eliminar factura', message: `Se eliminará la factura ${f.folio}. Esta acción no se puede deshacer.`, confirmLabel: 'Eliminar' }))) return
                      try { await eliminarFactura(f.id); cargar() }
                      catch (e) { toast('Error: ' + e.message, 'error') }
                    }}
                    title="Eliminar factura"
                    style={{ border:'none', background:'transparent', color:COLORS.red, cursor:'pointer', padding:4, display:'flex', alignItems:'center' }}
                  >{Icon('Trash')}</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ModalNuevaFactura({ onClose, onCreada }) {
  const [hitos, setHitos] = useState([])
  const [form, setForm] = useState({ hito_cobranza_id:'', subtotal:'', iva:'', total:'', fecha_vencimiento:'' })

  useEffect(() => { getHitos().then(hs => setHitos(hs.filter(h => h.estado === 'Pendiente' || h.estado === 'Facturado'))) }, [])

  const seleccionarHito = (hitoId) => {
    const h = hitos.find(x => x.id === hitoId)
    if (h) {
      const subtotal = Number(h.monto)
      const iva = subtotal * 0.16
      setForm({ ...form, hito_cobranza_id: hitoId, subtotal, iva, total: subtotal + iva })
    } else setForm({ ...form, hito_cobranza_id:'' })
  }

  const crear = async () => {
    if (!form.hito_cobranza_id) { toast('Selecciona un hito', 'error'); return }
    const h = hitos.find(x => x.id === form.hito_cobranza_id)
    await crearFactura({ hito_cobranza_id: form.hito_cobranza_id, proyecto_id: h.proyecto_id, cliente_id: h.proyecto?.cliente_id, subtotal: Number(form.subtotal), iva: Number(form.iva), total: Number(form.total), fecha_vencimiento: form.fecha_vencimiento || null })
    onCreada()
  }

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(10,37,64,0.35)', zIndex:999 }}/>
      <div style={{ position:'fixed', top:'10%', left:'50%', transform:'translateX(-50%)', width:560, background:'white', borderRadius:16, zIndex:1000 }}>
        <div style={{ padding:'20px 28px', borderBottom:`1px solid ${COLORS.slate100}`, display:'flex', justifyContent:'space-between' }}>
          <h2 style={{ fontSize:20, fontWeight:500, margin:0, color:COLORS.navy, fontFamily:'var(--font-sans)' }}>Nueva factura</h2>
          <button onClick={onClose} style={{ border:'none', background:'transparent', cursor:'pointer' }}>{Icon('X')}</button>
        </div>
        <div style={{ padding:24 }}>
          <div style={{ marginBottom:14 }}>
            <label style={labelStyle}>Hito a facturar *</label>
            <select value={form.hito_cobranza_id} onChange={e => seleccionarHito(e.target.value)} style={selectStyle}>
              <option value="">Selecciona...</option>
              {hitos.map(h => <option key={h.id} value={h.id}>{h.proyecto?.codigo} — {h.nombre} ({fmtMoney(h.monto)})</option>)}
            </select>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:14 }}>
            <div><label style={labelStyle}>Subtotal</label><input type="number" value={form.subtotal} onChange={e=>setForm({...form, subtotal:e.target.value})} style={inputStyle}/></div>
            <div><label style={labelStyle}>IVA 16%</label><input type="number" value={form.iva} onChange={e=>setForm({...form, iva:e.target.value})} style={inputStyle}/></div>
            <div><label style={labelStyle}>Total</label><input type="number" value={form.total} onChange={e=>setForm({...form, total:e.target.value})} style={inputStyle}/></div>
          </div>
          <div style={{ marginBottom:14 }}><label style={labelStyle}>Fecha de vencimiento</label><input type="date" value={form.fecha_vencimiento} onChange={e=>setForm({...form, fecha_vencimiento:e.target.value})} style={inputStyle}/></div>
        </div>
        <div style={{ padding:'16px 28px', borderTop:`1px solid ${COLORS.slate100}`, display:'flex', justifyContent:'flex-end', gap:10 }}>
          <button onClick={onClose} style={{ padding:'10px 18px', background:'transparent', border:`1px solid ${COLORS.slate200}`, borderRadius:8, fontSize:13, cursor:'pointer' }}>Cancelar</button>
          <button onClick={crear} style={{ padding:'10px 22px', background:COLORS.navy, color:'white', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer' }}>Emitir factura</button>
        </div>
      </div>
    </>
  )
}

// ============================================================
// v15.8.4: PanelFactura — modal con detalle completo de la factura
// ============================================================
function PanelFactura({ factura: f, usuario, onClose, onCambio }) {
  const navigate = useNavigate()
  const [estado, setEstado] = useState(f.estado)
  const [fechaPago, setFechaPago] = useState(f.fecha_pago || '')
  const [uuid, setUuid] = useState(f.uuid_sat || '')
  const [guardando, setGuardando] = useState(false)
  const puedeBorrar = puedeEliminar(usuario)

  const guardar = async () => {
    setGuardando(true)
    try {
      await actualizarFactura(f.id, { estado, fecha_pago: fechaPago || null, uuid_sat: uuid || null })
      onCambio()
    } catch (e) { toast('Error: ' + e.message, 'error'); setGuardando(false) }
  }

  const borrar = async () => {
    if (!(await confirmDialog({ title: 'Eliminar factura', message: `Se eliminará la factura ${f.folio}. Esta acción no se puede deshacer.`, confirmLabel: 'Eliminar' }))) return
    setGuardando(true)
    try { await eliminarFactura(f.id); onCambio() }
    catch (e) { toast('Error: ' + e.message, 'error'); setGuardando(false) }
  }

  const irAProyecto = () => {
    if (f.proyecto?.id) navigate(`/proyectos?proyecto=${f.proyecto.id}`)
  }

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(10,37,64,0.35)', zIndex:999 }}/>
      <div style={{ position:'fixed', top:'5%', left:'50%', transform:'translateX(-50%)', width:560, maxHeight:'90vh', overflow:'auto', background:'white', borderRadius:16, zIndex:1000 }}>
        <div style={{ padding:'18px 24px', borderBottom:`1px solid ${COLORS.slate100}`, display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
          <div>
            <div style={{ fontSize:11, fontFamily:'var(--font-mono)', color:COLORS.slate500, fontWeight:700, marginBottom:3 }}>FOLIO {f.folio || '—'}</div>
            <h2 style={{ fontSize:18, fontWeight:500, margin:0, color:COLORS.navy, fontFamily:'var(--font-sans)' }}>Factura</h2>
            <div style={{ marginTop:6, display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
              <Badge texto={f.estado} mapa={ESTADOS_FACTURA}/>
              <span style={{ fontSize:18, fontWeight:700, color:COLORS.navy, fontFamily:'var(--font-mono)' }}>{fmtMoney(Number(f.total || 0))}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ border:'none', background:'transparent', cursor:'pointer' }}>{Icon('X')}</button>
        </div>

        <div style={{ padding:24 }}>
          {/* Cliente + Proyecto */}
          <div style={{ background:COLORS.slate50, borderRadius:10, padding:14, marginBottom:16 }}>
            <div style={{ fontSize:10, fontWeight:700, color:COLORS.slate500, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>Cliente y proyecto</div>
            {f.cliente?.razon_social && (
              <div style={{ fontSize:13, fontWeight:600, color:COLORS.ink, marginBottom:4 }}>{f.cliente.razon_social}</div>
            )}
            {f.proyecto?.id ? (
              <>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:4 }}>
                  <span style={{ fontSize:11, fontFamily:'var(--font-mono)', color:COLORS.slate500, fontWeight:700 }}>{f.proyecto.codigo || ''}</span>
                  <span style={{ fontSize:12, color:COLORS.slate600 }}>{f.proyecto.nombre}</span>
                </div>
                <button onClick={irAProyecto} style={{ marginTop:10, padding:'6px 12px', background:COLORS.navy, color:'white', border:'none', borderRadius:6, fontSize:11, fontWeight:600, cursor:'pointer' }}>
                  Abrir proyecto →
                </button>
              </>
            ) : (
              <div style={{ fontSize:11, color:COLORS.slate500, fontStyle:'italic', marginTop:4 }}>Sin proyecto vinculado.</div>
            )}
          </div>

          {/* Datos económicos */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:10, marginBottom:14 }}>
            <DataRow label="Subtotal" valor={fmtMoney(Number(f.subtotal || 0))} mono/>
            <DataRow label="IVA" valor={fmtMoney(Number(f.iva || 0))} mono/>
            <DataRow label="Total" valor={fmtMoney(Number(f.total || 0))} mono bold/>
          </div>

          {/* Fechas */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14 }}>
            <DataRow label="Fecha emisión" valor={f.fecha_emision ? fmtDate(f.fecha_emision) : '—'}/>
            <DataRow label="Fecha vencimiento" valor={f.fecha_vencimiento ? fmtDate(f.fecha_vencimiento) : '—'}/>
          </div>

          {/* Edición */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
            <div>
              <label style={labelStyle}>Estado</label>
              <select value={estado} onChange={e=>setEstado(e.target.value)} style={selectStyle}>
                {Object.keys(ESTADOS_FACTURA).map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Fecha pago (si pagada)</label>
              <input type="date" value={fechaPago} onChange={e=>setFechaPago(e.target.value)} style={inputStyle}/>
            </div>
          </div>
          <div style={{ marginBottom:8 }}>
            <label style={labelStyle}>UUID SAT</label>
            <input value={uuid} onChange={e=>setUuid(e.target.value)} placeholder="UUID del CFDI emitido" style={{...inputStyle, fontFamily:'var(--font-mono)', fontSize:11}}/>
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

function DataRow({ label, valor, mono, bold }) {
  return (
    <div>
      <div style={{ fontSize:9, fontWeight:700, color:COLORS.slate500, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:3 }}>{label}</div>
      <div style={{ fontSize: bold ? 14 : 12, fontWeight: bold ? 600 : 500, color: bold ? COLORS.navy : COLORS.ink, fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)' }}>{valor}</div>
    </div>
  )
}