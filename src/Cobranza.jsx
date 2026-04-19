import { useState, useEffect } from 'react'
import { getHitos, actualizarHito } from './supabase'
import { COLORS, ESTADOS_HITO, Badge, fmtMoney, selectStyle, Icon } from './helpers'

export default function Cobranza() {
  const [hitos, setHitos] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtroEstado, setFiltroEstado] = useState('')

  const cargar = async () => { setLoading(true); setHitos(await getHitos()); setLoading(false) }
  useEffect(() => { cargar() }, [])

  const filtrados = filtroEstado ? hitos.filter(h => h.estado === filtroEstado) : hitos
  const porCobrar = hitos.filter(h => h.estado === 'Pendiente' || h.estado === 'Facturado').reduce((s,h) => s + Number(h.monto), 0)
  const cobrado = hitos.filter(h => h.estado === 'Cobrado').reduce((s,h) => s + Number(h.monto), 0)
  const vencido = hitos.filter(h => h.estado === 'Vencido').reduce((s,h) => s + Number(h.monto), 0)

  const cambiarEstado = async (id, nuevo) => {
    const cambios = { estado: nuevo }
    if (nuevo === 'Facturado') cambios.fecha_facturacion = new Date().toISOString().split('T')[0]
    if (nuevo === 'Cobrado') cambios.fecha_cobro = new Date().toISOString().split('T')[0]
    await actualizarHito(id, cambios)
    cargar()
  }

  return (
    <div>
      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontSize:32, fontWeight:400, color:COLORS.navy, margin:0, letterSpacing:'-0.02em', fontFamily:'var(--font-serif)' }}>Cobranza</h1>
        <p style={{ color:COLORS.slate500, fontSize:13, marginTop:6 }}>{hitos.length} hitos de cobranza</p>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:12, marginBottom:20 }}>
        {[
          { l:'Por cobrar', v:fmtMoney(porCobrar), c:COLORS.navy2 },
          { l:'Cobrado', v:fmtMoney(cobrado), c:COLORS.teal },
          { l:'Vencido', v:fmtMoney(vencido), c:COLORS.red },
        ].map(k => (
          <div key={k.l} style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, padding:16 }}>
            <div style={{ fontSize:10, fontWeight:600, color:COLORS.slate500, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>{k.l}</div>
            <div style={{ fontSize:22, fontWeight:500, color:k.c, fontFamily:'var(--font-serif)' }}>{k.v}</div>
          </div>
        ))}
      </div>

      <div style={{ marginBottom:16, display:'flex', gap:10, alignItems:'center' }}>
        <label style={{ fontSize:11, fontWeight:600, color:COLORS.slate500, textTransform:'uppercase', letterSpacing:'0.06em' }}>Filtrar:</label>
        <select value={filtroEstado} onChange={e=>setFiltroEstado(e.target.value)} style={{ ...selectStyle, width:180 }}>
          <option value="">Todos los estados</option>
          {Object.keys(ESTADOS_HITO).map(e => <option key={e}>{e}</option>)}
        </select>
      </div>

      {loading && <div style={{ padding:40, textAlign:'center', color:COLORS.slate400 }}>Cargando...</div>}

      {!loading && filtrados.length === 0 && <div style={{ padding:40, textAlign:'center', color:COLORS.slate400, background:'white', borderRadius:12 }}>Sin hitos. Se crean automáticamente al aprobar cotizaciones.</div>}

      {!loading && filtrados.length > 0 && (
        <div style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, overflow:'hidden' }}>
          <div style={{ display:'grid', gridTemplateColumns:'100px 1fr 200px 140px 110px 140px 150px', padding:'12px 20px', background:COLORS.slate50, borderBottom:`1px solid ${COLORS.slate100}`, fontSize:10, fontWeight:600, color:COLORS.slate500, textTransform:'uppercase', letterSpacing:'0.07em' }}>
            <div>Proyecto</div><div>Hito</div><div>Cliente</div><div>Monto</div><div>Tipo</div><div>Fecha esperada</div><div>Estado</div>
          </div>
          {filtrados.map(h => (
            <div key={h.id} style={{ display:'grid', gridTemplateColumns:'100px 1fr 200px 140px 110px 140px 150px', padding:'12px 20px', borderBottom:`1px solid ${COLORS.slate100}`, alignItems:'center', fontSize:12 }}>
              <span style={{ fontSize:11, fontFamily:'var(--font-mono)', color:COLORS.slate500, fontWeight:600 }}>{h.proyecto?.codigo || '—'}</span>
              <div>
                <div style={{ fontWeight:500, color:COLORS.ink }}>{h.nombre}</div>
                <div style={{ fontSize:11, color:COLORS.slate500 }}>{h.proyecto?.nombre || ''}</div>
              </div>
              <div style={{ color:COLORS.slate600 }}>{h.proyecto?.cliente?.razon_social || '—'}</div>
              <div style={{ fontFamily:'var(--font-mono)', fontWeight:600, color:COLORS.navy }}>{fmtMoney(h.monto)} <span style={{ fontSize:10, color:COLORS.slate400, fontWeight:400 }}>({h.porcentaje}%)</span></div>
              <div><Badge texto={h.tipo} mapa={{ anticipo:{bg:'#E0EDFF',color:'#1B3A6B'}, avance:{bg:'#FEF3C7',color:'#D97706'}, finalizacion:{bg:'#E1F5EE',color:'#0F6E56'} }}/></div>
              <div style={{ fontSize:11, fontFamily:'var(--font-mono)', color:COLORS.slate500 }}>{h.fecha_esperada}</div>
              <div><select value={h.estado} onChange={e => cambiarEstado(h.id, e.target.value)} style={{ border:'none', background:ESTADOS_HITO[h.estado]?.bg, color:ESTADOS_HITO[h.estado]?.color, padding:'4px 8px', borderRadius:12, fontSize:11, fontWeight:500, cursor:'pointer' }}>{Object.keys(ESTADOS_HITO).map(e => <option key={e}>{e}</option>)}</select></div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}