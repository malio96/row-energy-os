// ============================================================
// Ventas.jsx — v18.0.0
// Módulo unificado Leads + Cotizaciones. Una "oportunidad" = lead con su
// cotización adjunta (vínculo 1:1). Pipeline de 5 fases, Kanban + tabla,
// progressive disclosure en el detalle. Reusa CotizacionDetalle para todo
// lo de la cotización (partidas, PDF, aprobación/workflow).
// ============================================================
import { useState, useEffect, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  supabase,
  getOportunidades, cambiarFaseOportunidad, crearLead, actualizarLead, eliminarLead,
  getUsuarios, crearCotizacion, actualizarCotizacion, getCotizacion,
} from './supabase'
import {
  COLORS, FASES_VENTA, faseDeEtapa, fmtMoney, Avatar, Icon,
  inputStyle, selectStyle, labelStyle, aniosDisponibles, ANIO_ACTUAL,
  SortControl, aplicarSort, loadPref, savePref,
} from './helpers'
import { toast, confirmDialog } from './Dialogs'
import { CotizacionDetalle } from './Cotizaciones'

const ESTADO_COT_BADGE = {
  'Borrador':    { bg:'#F1F5F9', color:'#64748B' },
  'Enviada':     { bg:'#FEF3C7', color:'#D97706' },
  'En revisión': { bg:'#FEF9E6', color:'#C89B3C' },
  'Aprobada':    { bg:'#E1F5EE', color:'#0F6E56' },
  'Rechazada':   { bg:'#FEF2F2', color:'#DC2626' },
  'Vencida':     { bg:'#FEF2F2', color:'#DC2626' },
}

export default function Ventas({ usuario }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const deepLinkRef = useRef({ leadId: searchParams.get('lead'), cotId: searchParams.get('cotizacion'), aplicado: false })

  // v18.2.0: drill-downs del Dashboard (?filtro=pendientes|sin_respuesta)
  const filtroEspecial = searchParams.get('filtro')

  const [opps, setOpps] = useState([])
  const [loading, setLoading] = useState(true)
  const [vista, setVista] = useState('kanban')      // 'kanban' | 'tabla'
  const [busqueda, setBusqueda] = useState('')
  const [filtroAño, setFiltroAño] = useState(() => filtroEspecial ? 'todos' : String(ANIO_ACTUAL))
  const [filtroOwner, setFiltroOwner] = useState('todos')
  const [sort, setSort] = useState(() => loadPref('sort.ventas', { field:'fecha', dir:'desc' }))
  useEffect(() => { savePref('sort.ventas', sort) }, [sort])
  const [dragId, setDragId] = useState(null)
  const [sel, setSel] = useState(null)             // oportunidad abierta (panel)
  const [cotFull, setCotFull] = useState(null)     // id de cotización en vista completa
  const [modalNuevo, setModalNuevo] = useState(false)

  const cargar = async () => { setLoading(true); setOpps(await getOportunidades()); setLoading(false) }
  useEffect(() => { cargar() }, [])

  // v18.6.0: realtime — cambios de leads/cotizaciones de otros usuarios se reflejan
  // en vivo (recarga silenciosa con debounce; respeta RLS por cliente).
  useEffect(() => {
    let t = null
    const recargaSilenciosa = () => {
      clearTimeout(t)
      t = setTimeout(async () => setOpps(await getOportunidades()), 800)
    }
    const ch = supabase.channel('ventas-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, recargaSilenciosa)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cotizaciones' }, recargaSilenciosa)
      .subscribe()
    return () => { clearTimeout(t); supabase.removeChannel(ch) }
  }, [])

  // Deep-link desde alertas (?lead= / ?cotizacion=) → abrir la oportunidad
  useEffect(() => {
    if (deepLinkRef.current.aplicado || opps.length === 0) return
    const { leadId, cotId } = deepLinkRef.current
    let o = null
    if (leadId) o = opps.find(x => x.id === leadId)
    if (!o && cotId) o = opps.find(x => x.cotizacion?.id === cotId)
    if (o) setSel(o)
    deepLinkRef.current.aplicado = true
    if (leadId || cotId) setSearchParams({}, { replace: true })
  }, [opps, searchParams, setSearchParams])

  // v18.5.0: captura rápida — /ventas?nuevo=1 abre el alta directo (quick-add desde Dashboard)
  useEffect(() => {
    if (searchParams.get('nuevo')) {
      setModalNuevo(true)
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const owners = useMemo(() => {
    const m = new Map()
    for (const o of opps) if (o.owner) m.set(o.owner.id, o.owner.nombre)
    return [...m.entries()]
  }, [opps])

  const montoOpp = (o) => Number(o.cotizacion?.total ?? o.monto_estimado ?? 0)

  const filtradas = useMemo(() => {
    let r = opps
    // v18.2.0: drill-downs del Dashboard
    if (filtroEspecial === 'pendientes') {
      r = r.filter(o => !['Ganado','Perdido'].includes(faseDeEtapa(o.etapa)))
    } else if (filtroEspecial === 'sin_respuesta') {
      const hace5d = new Date(); hace5d.setDate(hace5d.getDate() - 5)
      r = r.filter(o => faseDeEtapa(o.etapa) === 'Cotización enviada' &&
        new Date(o.ultima_actividad || o.updated_at || o.created_at) < hace5d)
    }
    if (filtroAño !== 'todos') r = r.filter(o => (o.created_at || '').startsWith(filtroAño))
    if (filtroOwner !== 'todos') r = r.filter(o => o.owner?.id === filtroOwner)
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase()
      r = r.filter(o =>
        o.razon_social?.toLowerCase().includes(q) ||
        o.codigo?.toLowerCase().includes(q) ||
        o.contacto_nombre?.toLowerCase().includes(q) ||
        o.cotizacion?.codigo?.toLowerCase().includes(q)
      )
    }
    return r
  }, [opps, filtroAño, filtroOwner, busqueda, filtroEspecial])

  // Orden (default: más nuevas primero). Aplica a Kanban (dentro de cada columna) y a la Tabla.
  const ordenadas = useMemo(() => aplicarSort(filtradas, sort, {
    fecha:   o => o.created_at || '',
    empresa: o => (o.razon_social || '').toLowerCase(),
    monto:   o => montoOpp(o),
    fase:    o => faseDeEtapa(o.etapa),
  }), [filtradas, sort])

  const pipelinePonderado = filtradas
    .filter(o => !['Ganado','Perdido'].includes(faseDeEtapa(o.etapa)))
    .reduce((s,o) => s + montoOpp(o) * Number(o.probabilidad || 0) / 100, 0)

  const moverFase = async (opp, fase) => {
    if (fase === faseDeEtapa(opp.etapa)) return
    try {
      await cambiarFaseOportunidad(opp.id, fase)
      if (fase === 'Ganado' && opp.cotizacion && opp.cotizacion.estado !== 'Aprobada') {
        toast('Oportunidad ganada. Para formalizar (crear proyecto), aprobá la cotización desde el detalle.', 'info')
      }
      cargar()
    } catch (e) { toast('Error: ' + (e.message || e), 'error') }
  }

  // Vista completa de cotización (reusa el detalle existente con todo: items/PDF/aprobar)
  if (cotFull) {
    return <CotizacionDetalle id={cotFull} usuario={usuario} onVolver={() => { setCotFull(null); cargar() }}/>
  }

  return (
    <div>
      {modalNuevo && <ModalNuevaOportunidad usuario={usuario} onClose={() => setModalNuevo(false)} onCreada={() => { setModalNuevo(false); cargar() }}/>}
      {sel && (
        <PanelOportunidad
          opp={opps.find(o => o.id === sel.id) || sel}
          usuario={usuario}
          onClose={() => setSel(null)}
          onCambio={cargar}
          onAbrirCotizacion={(id) => { setSel(null); setCotFull(id) }}
        />
      )}

      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontSize:32, fontWeight:400, color:COLORS.navy, margin:0, letterSpacing:'-0.02em', fontFamily:'var(--font-sans)' }}>Ventas</h1>
          <p style={{ color:COLORS.slate500, fontSize:13, marginTop:6 }}>
            {filtradas.length}{filtradas.length !== opps.length ? ` de ${opps.length}` : ''} oportunidades · Pipeline ponderado: <strong style={{ color:COLORS.navy }}>{fmtMoney(pipelinePonderado)}</strong>
          </p>
        </div>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <SortControl value={sort} onChange={setSort} fields={[
            { key:'fecha',   label:'Más reciente' },
            { key:'empresa', label:'Empresa' },
            { key:'monto',   label:'Monto' },
            { key:'fase',    label:'Fase' },
          ]}/>
          <div style={{ display:'flex', background:COLORS.slate50, borderRadius:8, padding:3 }}>
            {['kanban','tabla'].map(v => (
              <button key={v} onClick={() => setVista(v)} style={{
                padding:'6px 14px', border:'none', borderRadius:6, fontSize:12, fontWeight:600, cursor:'pointer',
                background: vista===v ? 'white' : 'transparent', color: vista===v ? COLORS.navy : COLORS.slate500,
                boxShadow: vista===v ? '0 1px 3px rgba(10,37,64,0.1)' : 'none', textTransform:'capitalize',
              }}>{v}</button>
            ))}
          </div>
          <button onClick={() => setModalNuevo(true)} style={{ padding:'10px 20px', background:COLORS.navy, color:'white', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>{Icon('Plus')} Nueva oportunidad</button>
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:14, flexWrap:'wrap' }}>
        {filtroEspecial && (
          <button onClick={() => setSearchParams({}, { replace:true })} style={{ padding:'7px 12px', background:COLORS.navy, color:'white', border:'none', borderRadius:8, fontSize:12, fontWeight:600, cursor:'pointer' }}>
            ✕ {filtroEspecial === 'sin_respuesta' ? 'Sin respuesta +5 días' : 'Pendientes'}
          </button>
        )}
        <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar empresa, código, contacto..." style={{ ...inputStyle, width:260, margin:0, padding:'8px 12px' }}/>
        <select value={filtroAño} onChange={e => setFiltroAño(e.target.value)} style={{ ...selectStyle, width:130 }}>
          <option value="todos">Todos los años</option>
          {aniosDisponibles().map(y => <option key={y} value={String(y)}>{y}</option>)}
        </select>
        {owners.length > 0 && (
          <select value={filtroOwner} onChange={e => setFiltroOwner(e.target.value)} style={{ ...selectStyle, width:170 }}>
            <option value="todos">Todos los responsables</option>
            {owners.map(([id, nombre]) => <option key={id} value={id}>{nombre}</option>)}
          </select>
        )}
      </div>

      {loading && <div style={{ padding:40, textAlign:'center', color:COLORS.slate400 }}>Cargando...</div>}

      {!loading && vista === 'kanban' && (
        <div style={{ display:'grid', gridTemplateColumns:`repeat(${FASES_VENTA.length}, minmax(220px, 1fr))`, gap:10, overflowX:'auto', paddingBottom:10 }}>
          {FASES_VENTA.map(fase => {
            const enFase = ordenadas.filter(o => faseDeEtapa(o.etapa) === fase.key)
            const total = enFase.reduce((s,o) => s + montoOpp(o), 0)
            return (
              <div key={fase.key} onDragOver={e => e.preventDefault()} onDrop={() => { if (dragId) { const o = opps.find(x => x.id === dragId); if (o) moverFase(o, fase.key); setDragId(null) } }} style={{ minWidth:220 }}>
                <div style={{ padding:'10px 14px', background:fase.bg, borderRadius:10, marginBottom:8 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ fontSize:12, fontWeight:600, color:fase.color }}>{fase.key}</span>
                    <span style={{ fontSize:10, fontFamily:'var(--font-mono)', color:fase.color, background:'white', borderRadius:10, padding:'2px 6px', fontWeight:600 }}>{enFase.length}</span>
                  </div>
                  <div style={{ fontSize:10, color:fase.color, opacity:0.8, marginTop:2, fontFamily:'var(--font-mono)' }}>{fmtMoney(total)}</div>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  {enFase.map(o => (
                    <div key={o.id} draggable onDragStart={() => setDragId(o.id)} onClick={() => setSel(o)} style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderLeft:`3px solid ${fase.color}`, borderRadius:8, padding:12, cursor:'pointer', transition:'box-shadow 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(10,37,64,0.08)'}
                      onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}>
                      <div style={{ fontSize:12, fontWeight:600, color:COLORS.ink, marginBottom:4 }}>{o.razon_social}</div>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:6 }}>
                        <span style={{ fontSize:12, fontWeight:600, color:COLORS.navy, fontFamily:'var(--font-mono)' }}>{fmtMoney(montoOpp(o))}</span>
                        {o.cotizacion && <span style={{ fontSize:9, padding:'2px 6px', borderRadius:6, fontWeight:700, ...(ESTADO_COT_BADGE[o.cotizacion.estado] || {}) }}>{o.cotizacion.codigo}</span>}
                      </div>
                      {/* v18.2.0: próxima acción visible en la tarjeta (rojo = vencida) */}
                      {o.proxima_accion_fecha && !['Ganado','Perdido'].includes(fase.key) && (() => {
                        const hoy = new Date().toISOString().slice(0,10)
                        const vencida = o.proxima_accion_fecha < hoy
                        const esHoy = o.proxima_accion_fecha === hoy
                        return (
                          <div title={o.proxima_accion || 'Próxima acción'} style={{
                            marginTop:6, fontSize:10, padding:'3px 8px', borderRadius:6, display:'inline-block',
                            background: vencida ? '#FEF2F2' : esHoy ? '#FEF3C7' : COLORS.slate50,
                            color: vencida ? COLORS.red : esHoy ? '#D97706' : COLORS.slate500,
                            fontWeight:600, maxWidth:'100%', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                          }}>
                            {vencida ? '⚠ ' : '◷ '}{o.proxima_accion ? `${o.proxima_accion} · ` : ''}{new Date(o.proxima_accion_fecha + 'T12:00').toLocaleDateString('es-MX', { day:'numeric', month:'short' })}
                          </div>
                        )
                      })()}
                      {o.owner?.nombre && <div style={{ marginTop:6, display:'flex', alignItems:'center', gap:6 }}><Avatar nombre={o.owner.nombre} size={18}/><span style={{ fontSize:10, color:COLORS.slate500 }}>{o.owner.nombre}</span></div>}
                    </div>
                  ))}
                  {enFase.length === 0 && <div style={{ padding:20, textAlign:'center', color:COLORS.slate400, fontSize:11, border:`1px dashed ${COLORS.slate200}`, borderRadius:8 }}>Arrastra aquí</div>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {!loading && vista === 'tabla' && (
        <div style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, overflow:'hidden' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 150px 130px 120px 140px', padding:'10px 16px', borderBottom:`1px solid ${COLORS.slate100}`, fontSize:10, fontWeight:700, color:COLORS.slate500, textTransform:'uppercase', letterSpacing:'0.04em' }}>
            <span>Empresa</span><span>Fase</span><span>Monto</span><span>Cotización</span><span>Responsable</span>
          </div>
          {ordenadas.length === 0 && <div style={{ padding:40, textAlign:'center', color:COLORS.slate400, fontSize:13 }}>Sin oportunidades</div>}
          {ordenadas.map(o => {
            const fase = FASES_VENTA.find(f => f.key === faseDeEtapa(o.etapa))
            return (
              <div key={o.id} onClick={() => setSel(o)} style={{ display:'grid', gridTemplateColumns:'1fr 150px 130px 120px 140px', padding:'12px 16px', borderBottom:`1px solid ${COLORS.slate100}`, alignItems:'center', fontSize:13, cursor:'pointer' }}
                onMouseEnter={e => e.currentTarget.style.background = COLORS.slate50}
                onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                <div style={{ fontWeight:500, color:COLORS.ink, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', paddingRight:8 }}>{o.razon_social}</div>
                <div><span style={{ fontSize:11, fontWeight:600, padding:'3px 10px', borderRadius:10, background:fase?.bg, color:fase?.color }}>{fase?.key}</span></div>
                <div style={{ fontFamily:'var(--font-mono)', color:COLORS.navy, fontWeight:600 }}>{fmtMoney(montoOpp(o))}</div>
                <div style={{ fontSize:11, color:COLORS.slate500, fontFamily:'var(--font-mono)' }}>{o.cotizacion?.codigo || '—'}</div>
                <div style={{ fontSize:12, color:COLORS.slate600 }}>{o.owner?.nombre || '—'}</div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ============================================================
// Panel de detalle de oportunidad (progressive disclosure)
// ============================================================
function PanelOportunidad({ opp, usuario, onClose, onCambio, onAbrirCotizacion }) {
  const [etapa, setEtapa] = useState(opp.etapa)
  const [notas, setNotas] = useState(opp.notas || '')
  const [monto, setMonto] = useState(opp.monto_estimado || '')
  // v18.2.0: accountability — todo trato vivo debe tener un siguiente paso con fecha
  const [proxAccion, setProxAccion] = useState(opp.proxima_accion || '')
  const [proxFecha, setProxFecha] = useState(opp.proxima_accion_fecha || '')
  const [guardando, setGuardando] = useState(false)
  const [openCot, setOpenCot] = useState(true)
  const [openAct, setOpenAct] = useState(false)
  const [openMas, setOpenMas] = useState(false)
  const cot = opp.cotizacion
  // v18.0.0: cargar partidas para la vista previa (ver qué se cotizó sin abrir la cotización completa)
  const [items, setItems] = useState(null)
  useEffect(() => {
    if (cot?.id) getCotizacion(cot.id).then(c => setItems(c.items || [])).catch(() => setItems([]))
    else setItems(null)
  }, [cot?.id])

  const guardar = async () => {
    setGuardando(true)
    try {
      await actualizarLead(opp.id, {
        etapa, notas, monto_estimado: Number(monto) || 0,
        proxima_accion: proxAccion.trim() || null,
        proxima_accion_fecha: proxFecha || null,
        ultima_actividad: new Date().toISOString(),
      })
      onCambio(); onClose()
    } catch (e) { toast('Error: ' + e.message, 'error'); setGuardando(false) }
  }

  const eliminar = async () => {
    if (!(await confirmDialog({ title:'Eliminar oportunidad', message:`Se eliminará "${opp.razon_social}". No se puede deshacer.`, confirmLabel:'Eliminar' }))) return
    setGuardando(true)
    try { await eliminarLead(opp.id); onCambio(); onClose() }
    catch (e) { toast('Error: ' + e.message, 'error'); setGuardando(false) }
  }

  const generarCotizacion = async () => {
    setGuardando(true)
    try {
      const c = await crearCotizacion({ nombre_proyecto: opp.razon_social, cliente_id: opp.cliente_id, vendedor_id: usuario.id, estado:'Borrador', lead_id: opp.id, fecha_emision: new Date().toISOString().slice(0,10) })
      onAbrirCotizacion(c.id)
    } catch (e) { toast('Error: ' + e.message, 'error'); setGuardando(false) }
  }

  const aprobar = async () => {
    setGuardando(true)
    try {
      await actualizarCotizacion(cot.id, { estado:'Aprobada' })
      toast('Cotización aprobada. Se generó el proyecto.', 'success')
      onCambio(); onClose()
    } catch (e) {
      toast(e.message || 'No se pudo aprobar (revisá que el cliente tenga RFC y dirección).', 'error')
      setGuardando(false)
    }
  }

  const Seccion = ({ titulo, open, setOpen, children, extra }) => (
    <div style={{ border:`1px solid ${COLORS.slate100}`, borderRadius:10, marginBottom:10, overflow:'hidden' }}>
      <button onClick={() => setOpen(!open)} style={{ width:'100%', padding:'12px 14px', border:'none', background:open?COLORS.slate50:'white', cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:13, fontWeight:600, color:COLORS.ink }}>
        <span>{titulo}{extra}</span><span style={{ color:COLORS.slate400, fontSize:11 }}>{open ? '▼' : '▶'}</span>
      </button>
      {open && <div style={{ padding:14, borderTop:`1px solid ${COLORS.slate100}` }}>{children}</div>}
    </div>
  )

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(10,37,64,0.35)', zIndex:999 }}/>
      <div style={{ position:'fixed', top:'4%', left:'50%', transform:'translateX(-50%)', width:600, maxHeight:'92vh', overflow:'auto', background:'white', borderRadius:16, zIndex:1000 }}>
        <div style={{ padding:'20px 28px', borderBottom:`1px solid ${COLORS.slate100}`, display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
          <div>
            <h2 style={{ fontSize:20, fontWeight:500, margin:0, color:COLORS.navy, fontFamily:'var(--font-sans)' }}>{opp.razon_social}</h2>
            {opp.contacto_nombre && <p style={{ fontSize:12, color:COLORS.slate500, margin:'4px 0 0' }}>{opp.contacto_nombre}</p>}
          </div>
          <button onClick={onClose} style={{ border:'none', background:'transparent', cursor:'pointer' }}>{Icon('X')}</button>
        </div>

        <div style={{ padding:24 }}>
          {/* Cabecera: etapa + monto + responsable */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
            <div>
              <label style={labelStyle}>Etapa</label>
              <select value={etapa} onChange={e => setEtapa(e.target.value)} style={selectStyle}>
                {['Nuevo','En contacto','Calificando','Propuesta enviada','Negociación','Ganado','Perdido'].map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Monto estimado (MXN)</label>
              <input type="number" value={monto} onChange={e => setMonto(e.target.value)} style={inputStyle}/>
            </div>
          </div>

          {/* Próxima acción (accountability de seguimiento) */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 160px', gap:12, marginBottom:16 }}>
            <div>
              <label style={labelStyle}>Próxima acción</label>
              <input value={proxAccion} onChange={e => setProxAccion(e.target.value)} placeholder="Ej: Llamar para dar seguimiento" style={inputStyle}/>
            </div>
            <div>
              <label style={labelStyle}>Fecha</label>
              <input type="date" value={proxFecha} onChange={e => setProxFecha(e.target.value)} style={inputStyle}/>
            </div>
          </div>

          {/* Cotización */}
          <Seccion titulo="Cotización" open={openCot} setOpen={setOpenCot} extra={cot ? <span style={{ marginLeft:8, fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:8, ...(ESTADO_COT_BADGE[cot.estado] || {}) }}>{cot.estado}</span> : null}>
            {cot ? (
              <div>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:8 }}>
                  <span style={{ color:COLORS.slate500 }}>{cot.codigo}</span>
                  <span style={{ fontFamily:'var(--font-mono)', fontWeight:600, color:COLORS.navy }}>{fmtMoney(cot.total)}</span>
                </div>
                {/* Vista previa de partidas (qué se cotizó) */}
                {items === null ? (
                  <div style={{ fontSize:11, color:COLORS.slate400, marginBottom:8 }}>Cargando partidas...</div>
                ) : items.length === 0 ? (
                  <div style={{ fontSize:11, color:COLORS.slate400, fontStyle:'italic', marginBottom:8 }}>Cotización importada — sin desglose de partidas.</div>
                ) : (
                  <div style={{ marginBottom:10, border:`1px solid ${COLORS.slate100}`, borderRadius:8, overflow:'hidden' }}>
                    {items.map((it, i) => (
                      <div key={it.id || i} style={{ display:'flex', justifyContent:'space-between', gap:8, padding:'7px 10px', fontSize:12, borderBottom: i < items.length-1 ? `1px solid ${COLORS.slate100}` : 'none' }}>
                        <span style={{ color:COLORS.ink, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                          {it.cantidad > 1 ? `${it.cantidad}× ` : ''}{it.servicio || it.descripcion || 'Servicio'}
                        </span>
                        <span style={{ fontFamily:'var(--font-mono)', color:COLORS.slate600, whiteSpace:'nowrap' }}>{fmtMoney(it.total ?? it.precio_unitario ?? 0)}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={() => onAbrirCotizacion(cot.id)} style={{ flex:1, padding:'9px', background:COLORS.navy, color:'white', border:'none', borderRadius:8, fontSize:12, fontWeight:600, cursor:'pointer' }}>Abrir cotización completa</button>
                  {cot.estado !== 'Aprobada' && <button onClick={aprobar} disabled={guardando} style={{ padding:'9px 14px', background:COLORS.teal, color:'white', border:'none', borderRadius:8, fontSize:12, fontWeight:600, cursor:'pointer' }}>Aprobar</button>}
                </div>
              </div>
            ) : (
              <button onClick={generarCotizacion} disabled={guardando} style={{ width:'100%', padding:'10px', background:'white', color:COLORS.navy, border:`1px dashed ${COLORS.slate300 || COLORS.slate200}`, borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer' }}>+ Generar cotización</button>
            )}
          </Seccion>

          {/* Actividad / notas */}
          <Seccion titulo="Actividad y notas" open={openAct} setOpen={setOpenAct}>
            <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={4} placeholder="Notas de seguimiento..." style={{ ...inputStyle, resize:'vertical', fontFamily:'inherit' }}/>
          </Seccion>

          {/* Más detalles */}
          <Seccion titulo="Más detalles" open={openMas} setOpen={setOpenMas}>
            <div style={{ fontSize:12, color:COLORS.slate600, display:'flex', flexDirection:'column', gap:6 }}>
              {opp.contacto_email && <div>📧 {opp.contacto_email}</div>}
              {opp.contacto_telefono && <div>📞 {opp.contacto_telefono}</div>}
              {opp.tipo_proyecto && <div>Tipo: {opp.tipo_proyecto}</div>}
              {opp.capacidad_mw && <div>{opp.capacidad_mw} MW</div>}
              {opp.fuente && <div>Fuente: {opp.fuente}</div>}
              {opp.owner?.nombre && <div>Responsable: {opp.owner.nombre}</div>}
            </div>
          </Seccion>
        </div>

        <div style={{ padding:'16px 28px', borderTop:`1px solid ${COLORS.slate100}`, display:'flex', justifyContent:'space-between', gap:10 }}>
          <button onClick={eliminar} disabled={guardando} style={{ padding:'10px 18px', background:'transparent', border:`1px solid ${COLORS.red}`, color:COLORS.red, borderRadius:8, fontSize:13, cursor:'pointer' }}>Eliminar</button>
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={onClose} disabled={guardando} style={{ padding:'10px 18px', background:'transparent', border:`1px solid ${COLORS.slate200}`, borderRadius:8, fontSize:13, cursor:'pointer' }}>Cancelar</button>
            <button onClick={guardar} disabled={guardando} style={{ padding:'10px 22px', background:COLORS.navy, color:'white', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor: guardando?'wait':'pointer' }}>{guardando ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </div>
      </div>
    </>
  )
}

// ============================================================
// Alta rápida (≤3 campos)
// ============================================================
function ModalNuevaOportunidad({ usuario, onClose, onCreada }) {
  const [razon, setRazon] = useState('')
  const [contacto, setContacto] = useState('')
  const [ownerId, setOwnerId] = useState(usuario.id)
  const [usuarios, setUsuarios] = useState([])
  const [guardando, setGuardando] = useState(false)
  useEffect(() => { getUsuarios().then(setUsuarios) }, [])

  const crear = async () => {
    if (!razon.trim()) { toast('Completa la empresa', 'error'); return }
    setGuardando(true)
    try {
      await crearLead({ razon_social: razon.trim(), contacto_nombre: contacto.trim() || null, owner_id: ownerId, etapa:'Nuevo', probabilidad:10 })
      onCreada()
    } catch (e) { toast('Error: ' + e.message, 'error'); setGuardando(false) }
  }

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(10,37,64,0.35)', zIndex:999 }}/>
      <div style={{ position:'fixed', top:'12%', left:'50%', transform:'translateX(-50%)', width:480, background:'white', borderRadius:16, zIndex:1000 }}>
        <div style={{ padding:'20px 28px', borderBottom:`1px solid ${COLORS.slate100}`, display:'flex', justifyContent:'space-between' }}>
          <h2 style={{ fontSize:20, fontWeight:500, margin:0, color:COLORS.navy, fontFamily:'var(--font-sans)' }}>Nueva oportunidad</h2>
          <button onClick={onClose} style={{ border:'none', background:'transparent', cursor:'pointer' }}>{Icon('X')}</button>
        </div>
        <div style={{ padding:24 }}>
          <div style={{ marginBottom:12 }}><label style={labelStyle}>Empresa / Razón social *</label><input value={razon} onChange={e => setRazon(e.target.value)} style={inputStyle} placeholder="Ej: Cementos Cruz Azul"/></div>
          <div style={{ marginBottom:12 }}><label style={labelStyle}>Contacto</label><input value={contacto} onChange={e => setContacto(e.target.value)} style={inputStyle} placeholder="Opcional"/></div>
          <div><label style={labelStyle}>Responsable</label>
            <select value={ownerId} onChange={e => setOwnerId(e.target.value)} style={selectStyle}>
              {usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
            </select>
          </div>
        </div>
        <div style={{ padding:'16px 28px', borderTop:`1px solid ${COLORS.slate100}`, display:'flex', justifyContent:'flex-end', gap:10 }}>
          <button onClick={onClose} style={{ padding:'10px 18px', background:'transparent', border:`1px solid ${COLORS.slate200}`, borderRadius:8, fontSize:13, cursor:'pointer' }}>Cancelar</button>
          <button onClick={crear} disabled={guardando} style={{ padding:'10px 22px', background:COLORS.navy, color:'white', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer' }}>Crear</button>
        </div>
      </div>
    </>
  )
}
