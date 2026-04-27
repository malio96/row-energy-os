import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getFacturas, crearFactura, actualizarFactura, getHitos, getClientes } from './supabase'
import { COLORS, ESTADOS_FACTURA, Badge, fmtMoney, inputStyle, selectStyle, labelStyle, Icon } from './helpers'

export default function Facturacion() {
  const [searchParams, setSearchParams] = useSearchParams()
  // Deep-link desde Centro de Alertas: ?factura=X → scroll + highlight
  const deepLinkRef = useRef({ facturaId: searchParams.get('factura'), aplicado: false })
  const [highlightId, setHighlightId] = useState(null)
  const rowRefs = useRef({})
  const [facturas, setFacturas] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)

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

  return (
    <div>
      {modal && <ModalNuevaFactura onClose={() => setModal(false)} onCreada={() => { setModal(false); cargar() }}/>}

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:32, fontWeight:400, color:COLORS.navy, margin:0, letterSpacing:'-0.02em', fontFamily:'var(--font-sans)' }}>Facturación</h1>
          <p style={{ color:COLORS.slate500, fontSize:13, marginTop:6 }}>{facturas.length} facturas · Total: <strong>{fmtMoney(total)}</strong></p>
        </div>
        <button onClick={() => setModal(true)} style={{ padding:'10px 20px', background:COLORS.navy, color:'white', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>{Icon('Plus')} Nueva factura</button>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:12, marginBottom:20 }}>
        {[{ l:'Pagadas', v:fmtMoney(pagadas), c:COLORS.teal }, { l:'Pendientes', v:fmtMoney(pendientes), c:COLORS.amber }].map(k => (
          <div key={k.l} style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, padding:16 }}>
            <div style={{ fontSize:10, fontWeight:600, color:COLORS.slate500, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>{k.l}</div>
            <div style={{ fontSize:22, fontWeight:500, color:k.c, fontFamily:'var(--font-sans)' }}>{k.v}</div>
          </div>
        ))}
      </div>

      {loading && <div style={{ padding:40, textAlign:'center', color:COLORS.slate400 }}>Cargando...</div>}

      {!loading && facturas.length === 0 && <div style={{ padding:40, textAlign:'center', color:COLORS.slate400, background:'white', borderRadius:12 }}>Sin facturas. Crea la primera desde un hito cobrable.</div>}

      {!loading && facturas.length > 0 && (
        <div style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, overflow:'hidden' }}>
          <div style={{ display:'grid', gridTemplateColumns:'90px 1fr 220px 130px 120px 140px', padding:'12px 20px', background:COLORS.slate50, borderBottom:`1px solid ${COLORS.slate100}`, fontSize:10, fontWeight:600, color:COLORS.slate500, textTransform:'uppercase', letterSpacing:'0.07em' }}>
            <div>Folio</div><div>Proyecto</div><div>Cliente</div><div>Total</div><div>Emisión</div><div>Estado</div>
          </div>
          {facturas.map(f => (
            <div key={f.id} ref={el => { if (el) rowRefs.current[f.id] = el }} style={{ display:'grid', gridTemplateColumns:'90px 1fr 220px 130px 120px 140px', padding:'12px 20px', borderBottom:`1px solid ${COLORS.slate100}`, alignItems:'center', fontSize:12, background: highlightId === f.id ? '#FEF3C7' : 'transparent', transition:'background 0.5s' }}>
              <span style={{ fontSize:11, fontFamily:'var(--font-mono)', color:COLORS.slate500, fontWeight:600 }}>{f.folio}</span>
              <div>
                <div style={{ fontWeight:500, color:COLORS.ink }}>{f.proyecto?.nombre || '—'}</div>
                {f.uuid_sat && <div style={{ fontSize:10, color:COLORS.slate400, fontFamily:'var(--font-mono)' }}>UUID: {f.uuid_sat}</div>}
              </div>
              <div style={{ color:COLORS.slate600 }}>{f.cliente?.razon_social || '—'}</div>
              <div style={{ fontFamily:'var(--font-mono)', fontWeight:600, color:COLORS.navy }}>{fmtMoney(f.total)}</div>
              <div style={{ fontSize:11, fontFamily:'var(--font-mono)', color:COLORS.slate500 }}>{f.fecha_emision}</div>
              <div><select value={f.estado} onChange={e => cambiarEstado(f.id, e.target.value)} style={{ border:'none', background:ESTADOS_FACTURA[f.estado]?.bg, color:ESTADOS_FACTURA[f.estado]?.color, padding:'4px 8px', borderRadius:12, fontSize:11, fontWeight:500, cursor:'pointer', fontFamily:'inherit' }}>{Object.keys(ESTADOS_FACTURA).map(e => <option key={e}>{e}</option>)}</select></div>
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
    if (!form.hito_cobranza_id) { alert('Selecciona un hito'); return }
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