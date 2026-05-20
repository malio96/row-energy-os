import { useState, useEffect, useRef, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getCotizaciones, getCotizacion, crearCotizacion, actualizarCotizacion, agregarCotizacionItem, actualizarCotizacionItem, eliminarCotizacionItem, eliminarCotizacion, getClientes, getUsuarios, getPlantillas, getPreciosServicios, listarServiciosPricing, buscarPrecioServicio, PRICING_TIPOS, getTareasPostCierre, completarTareaPostCierre, asignarTareaPostCierre, aprobarWorkflowPostCierre, DEPARTAMENTOS_POST_CIERRE, ESTADOS_TAREA_PC } from './supabase'
// v17.0.2: loadPref/savePref desde helpers (antes shim local sin sync a BD)
import { COLORS, ESTADOS_COT, Badge, Avatar, fmtMoney, inputStyle, selectStyle, labelStyle, Icon, LoadingState, EmptyState, SortControl, aplicarSort, loadPref, savePref } from './helpers'
import { SERVICIOS_CATALOGO } from './serviciosCatalogo'  // v15.6.0
import { FormClienteInline } from './Proyectos'  // v16.1.1: reuso del form unificado
import { puedeEliminar, puedeAprobarCotizacion, esDirOAdmin } from './permisos'  // v16.4.0

function extraerClienteNombre(cot) {
  if (cot.cliente?.razon_social) return cot.cliente.razon_social
  const n = cot.nombre_proyecto || ''
  for (const sep of [' - ', ' – ', ' — ']) {
    const i = n.indexOf(sep)
    if (i > 0) return n.slice(0, i).trim()
  }
  return '(Sin cliente)'
}

export default function Cotizaciones({ usuario }) {
  const [searchParams, setSearchParams] = useSearchParams()
  // Deep-link desde Centro de Alertas: capturar ?cotizacion=X en el primer render
  const deepLinkRef = useRef({ cotizacionId: searchParams.get('cotizacion'), aplicado: false })
  const [cots, setCots] = useState([])
  const [loading, setLoading] = useState(true)
  const [selId, setSelId] = useState(null)
  const [modalNuevo, setModalNuevo] = useState(false)
  // v16.9.3: orden persistido por usuario
  const [sort, setSort] = useState(() => loadPref('sort.cotizaciones', { field:'fecha', dir:'desc' }))
  useEffect(() => { savePref('sort.cotizaciones', sort) }, [sort])
  // v17.0.4: filtro especial via URL (?filtro=pendientes|sin_respuesta|workflow_pendiente desde Dashboard "Ver todos")
  const filtroEspecial = searchParams.get('filtro')  // 'pendientes' | 'sin_respuesta' | 'workflow_pendiente' | null
  const [filtroAño, setFiltroAño] = useState('todos')
  const [filtroMes, setFiltroMes] = useState('todos')
  const [busqueda, setBusqueda] = useState('')
  const [agruparCliente, setAgruparCliente] = useState(() => loadPref('cots.agrupar', false))

  const cotsOrdenadas = useMemo(() => {
    let r = cots
    // v17.0.4: filtro especial drill-down desde Dashboard
    if (filtroEspecial === 'pendientes') {
      r = r.filter(c => ['Borrador', 'Enviada', 'En revisión'].includes(c.estado))
    } else if (filtroEspecial === 'sin_respuesta') {
      const hace5d = new Date(); hace5d.setDate(hace5d.getDate() - 5)
      const cutoff = hace5d.toISOString().split('T')[0]
      r = r.filter(c => c.estado === 'Enviada' && c.fecha_emision && c.fecha_emision < cutoff)
    } else if (filtroEspecial === 'workflow_pendiente') {
      // Simplificado: cotizaciones aprobadas con workflow no aprobado aún
      r = r.filter(c => c.estado === 'Aprobada' && !c.workflow_aprobado_en)
    }
    // Filtros normales
    if (filtroAño !== 'todos') r = r.filter(c => c.fecha_emision?.startsWith(filtroAño))
    if (filtroMes !== 'todos') r = r.filter(c => c.fecha_emision?.slice(5, 7) === filtroMes)
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase()
      r = r.filter(c =>
        c.codigo?.toLowerCase().includes(q) ||
        c.nombre_proyecto?.toLowerCase().includes(q) ||
        extraerClienteNombre(c).toLowerCase().includes(q)
      )
    }
    // v17.0.4: override sort según filtro especial
    let sortEffective = sort
    if (filtroEspecial === 'pendientes') sortEffective = { field:'fecha', dir:'desc' }
    else if (filtroEspecial === 'sin_respuesta') sortEffective = { field:'fecha', dir:'asc' }
    else if (filtroEspecial === 'workflow_pendiente') sortEffective = { field:'fecha', dir:'desc' }
    return aplicarSort(r, sortEffective, {
      codigo:   c => c.codigo || '',
      proyecto: c => (c.nombre_proyecto || '').toLowerCase(),
      cliente:  c => extraerClienteNombre(c).toLowerCase(),
      total:    c => Number(c.total || 0),
      estado:   c => c.estado || '',
      fecha:    c => c.fecha_emision || '',
    })
  }, [cots, sort, filtroEspecial, filtroAño, filtroMes, busqueda])

  const cotsPorCliente = useMemo(() => {
    if (!agruparCliente) return null
    const map = new Map()
    for (const c of cotsOrdenadas) {
      const k = extraerClienteNombre(c)
      if (!map.has(k)) map.set(k, [])
      map.get(k).push(c)
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b, 'es'))
  }, [cotsOrdenadas, agruparCliente])

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

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontSize:32, fontWeight:400, color:COLORS.navy, margin:0, letterSpacing:'-0.02em', fontFamily:'var(--font-sans)' }}>Cotizaciones</h1>
          <p style={{ color:COLORS.slate500, fontSize:13, marginTop:6 }}>
            {cotsOrdenadas.length !== cots.length
              ? <>{cotsOrdenadas.length} de {cots.length} cotizaciones</>
              : <>{cots.length} cotización{cots.length!==1?'es':''}</>
            }
          </p>
        </div>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <SortControl value={sort} onChange={setSort} fields={[
            { key:'fecha',    label:'Más reciente' },
            { key:'codigo',   label:'Código' },
            { key:'proyecto', label:'Proyecto' },
            { key:'cliente',  label:'Cliente' },
            { key:'total',    label:'Monto' },
            { key:'estado',   label:'Estado' },
          ]}/>
          <button onClick={() => setModalNuevo(true)} style={{ padding:'10px 20px', background:COLORS.navy, color:'white', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
            {Icon('Plus')} Nueva cotización
          </button>
        </div>
      </div>

      {/* Filtros año / mes / búsqueda / agrupar */}
      <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:14, flexWrap:'wrap' }}>
        <input
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar código, proyecto, cliente..."
          style={{ ...inputStyle, width:260, margin:0, padding:'8px 12px' }}
        />
        <select value={filtroAño} onChange={e => setFiltroAño(e.target.value)} style={{ ...selectStyle, width:130 }}>
          <option value="todos">Todos los años</option>
          <option value="2024">2024</option>
          <option value="2025">2025</option>
          <option value="2026">2026</option>
        </select>
        <select value={filtroMes} onChange={e => setFiltroMes(e.target.value)} style={{ ...selectStyle, width:140 }}>
          <option value="todos">Todos los meses</option>
          {['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'].map((m, i) => (
            <option key={m} value={String(i+1).padStart(2,'0')}>{m}</option>
          ))}
        </select>
        <button
          onClick={() => { const next = !agruparCliente; setAgruparCliente(next); savePref('cots.agrupar', next) }}
          style={{ padding:'8px 14px', background: agruparCliente ? COLORS.navy : 'white', color: agruparCliente ? 'white' : COLORS.slate600, border:`1px solid ${agruparCliente ? COLORS.navy : COLORS.slate200}`, borderRadius:8, fontSize:12, fontWeight:500, cursor:'pointer', whiteSpace:'nowrap' }}
        >
          Agrupar por cliente
        </button>
        {(filtroAño !== 'todos' || filtroMes !== 'todos' || busqueda.trim()) && (
          <button onClick={() => { setFiltroAño('todos'); setFiltroMes('todos'); setBusqueda('') }} style={{ padding:'6px 12px', background:'transparent', border:`1px solid ${COLORS.slate200}`, borderRadius:8, fontSize:11, color:COLORS.slate500, cursor:'pointer' }}>
            ✕ Limpiar filtros
          </button>
        )}
      </div>

      {/* v17.0.4: banner cuando hay filtro especial drill-down desde Dashboard */}
      {(filtroEspecial === 'pendientes' || filtroEspecial === 'sin_respuesta' || filtroEspecial === 'workflow_pendiente') && (
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', marginBottom:14, background:'#FEF3C7', border:'1px solid #FDE68A', borderRadius:10 }}>
          {Icon('Alert')}
          <div style={{ flex:1, fontSize:12, color:COLORS.ink }}>
            <strong>Filtrando:</strong> {
              filtroEspecial === 'pendientes' ? 'cotizaciones pendientes (Borrador, Enviada, En revisión)'
              : filtroEspecial === 'sin_respuesta' ? 'cotizaciones enviadas sin respuesta (5+ días) · ordenadas por más viejas arriba'
              : 'cotizaciones aprobadas con workflow post-cierre pendiente'
            }
          </div>
          <button onClick={() => setSearchParams({}, { replace: true })} style={{ padding:'5px 12px', background:'white', border:`1px solid ${COLORS.slate200}`, borderRadius:6, fontSize:11, fontWeight:600, color:COLORS.slate600, cursor:'pointer' }}>
            ✕ Quitar filtro
          </button>
        </div>
      )}

      {loading && <LoadingState/>}

      {!loading && cots.length === 0 && (
        <EmptyState
          titulo="Aún no hay cotizaciones"
          descripcion="Crea la primera para empezar"
          accion={<button onClick={() => setModalNuevo(true)} style={{ padding:'10px 20px', background:COLORS.navy, color:'white', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer' }}>+ Crear primera cotización</button>}
        />
      )}

      {!loading && cots.length > 0 && cotsOrdenadas.length === 0 && (
        <EmptyState titulo="Sin resultados" descripcion="Ninguna cotización coincide con los filtros aplicados."/>
      )}

      {!loading && cotsOrdenadas.length > 0 && (() => {
        const COLS = '100px 1fr 200px 140px 120px 130px'
        const Header = () => (
          <div style={{ display:'grid', gridTemplateColumns:COLS, padding:'12px 20px', background:COLORS.slate50, borderBottom:`1px solid ${COLORS.slate100}`, fontSize:10, fontWeight:600, color:COLORS.slate500, textTransform:'uppercase', letterSpacing:'0.07em' }}>
            <div>Código</div><div>Proyecto</div><div>Cliente</div><div>Total</div><div>Estado</div><div>Emitida</div>
          </div>
        )
        const CotRow = ({ c }) => (
          <div key={c.id} onClick={() => setSelId(c.id)} style={{ display:'grid', gridTemplateColumns:COLS, padding:'14px 20px', borderBottom:`1px solid ${COLORS.slate100}`, alignItems:'center', cursor:'pointer', transition:'background 0.12s' }}
            onMouseEnter={e => e.currentTarget.style.background = COLORS.slate50} onMouseLeave={e => e.currentTarget.style.background = 'white'}>
            <span style={{ fontSize:11, fontFamily:'var(--font-mono)', color:COLORS.slate500, fontWeight:600 }}>{c.codigo}</span>
            <div>
              <div style={{ fontSize:13, fontWeight:500, color:COLORS.ink }}>{c.nombre_proyecto}</div>
              {c.capacidad_mw && <div style={{ fontSize:11, color:COLORS.slate500 }}>{c.capacidad_mw} MW{c.ubicacion ? ` · ${c.ubicacion}` : ''}</div>}
            </div>
            <div style={{ fontSize:12, color:COLORS.slate600 }}>{extraerClienteNombre(c)}</div>
            <div style={{ fontSize:13, fontFamily:'var(--font-mono)', fontWeight:600, color:COLORS.navy }}>{fmtMoney(c.total)} <span style={{ fontSize:10, color:COLORS.slate400, fontWeight:400 }}>{c.moneda}</span></div>
            <div><Badge texto={c.estado} mapa={ESTADOS_COT}/></div>
            <div style={{ fontSize:11, color:COLORS.slate500, fontFamily:'var(--font-mono)' }}>{c.fecha_emision}</div>
          </div>
        )

        if (cotsPorCliente) {
          return cotsPorCliente.map(([cliente, items]) => (
            <div key={cliente} style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, overflow:'hidden', marginBottom:12 }}>
              <div style={{ padding:'10px 20px', background:COLORS.slate50, borderBottom:`1px solid ${COLORS.slate100}`, display:'flex', alignItems:'center', gap:10 }}>
                <span style={{ fontSize:13, fontWeight:700, color:COLORS.navy }}>{cliente}</span>
                <span style={{ fontSize:11, color:COLORS.slate400 }}>{items.length} cotización{items.length!==1?'es':''}</span>
                <span style={{ fontSize:11, color:COLORS.slate500, marginLeft:'auto', fontFamily:'var(--font-mono)', fontWeight:600 }}>
                  {fmtMoney(items.reduce((s, c) => s + Number(c.total || 0), 0))} MXN
                </span>
              </div>
              <Header/>
              {items.map(c => <CotRow key={c.id} c={c}/>)}
            </div>
          ))
        }

        return (
          <div style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, overflow:'hidden' }}>
            <Header/>
            {cotsOrdenadas.map(c => <CotRow key={c.id} c={c}/>)}
          </div>
        )
      })()}
    </div>
  )
}

function ModalNuevaCotizacion({ usuario, onClose, onCreada }) {
  const [clientes, setClientes] = useState([])
  const [plantillas, setPlantillas] = useState([])
  const [form, setForm] = useState({ nombre_proyecto:'', cliente_id:'', plantilla_id:'', capacidad_mw:'', ubicacion:'', notas:'' })
  const [creando, setCreando] = useState(false)
  const [nuevoCliente, setNuevoCliente] = useState(false)  // v16.1.1

  useEffect(() => {
    Promise.all([getClientes(), getPlantillas()]).then(([c, p]) => { setClientes(c); setPlantillas(p) })
  }, [])

  // v16.1.1: cuando se crea un cliente desde el form inline, refrescar y seleccionar
  const onClienteCreado = async (cli) => {
    setNuevoCliente(false)
    const cs = await getClientes()
    setClientes(cs)
    setForm(f => ({ ...f, cliente_id: cli.id }))
  }

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
          <div style={{ marginBottom:14 }}>
            <label style={labelStyle}>Cliente *</label>
            <div style={{ display:'flex', gap:8 }}>
              <select value={form.cliente_id} onChange={e=>setForm({...form, cliente_id:e.target.value})} style={{...selectStyle, flex:1}}>
                <option value="">Selecciona...</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.razon_social}</option>)}
              </select>
              <button type="button" onClick={() => setNuevoCliente(v => !v)} style={{ padding:'8px 14px', background: nuevoCliente ? COLORS.slate200 : COLORS.teal, color: nuevoCliente ? COLORS.slate600 : 'white', border:'none', borderRadius:8, fontSize:12, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap' }}>
                {nuevoCliente ? 'Cancelar' : '+ Nuevo'}
              </button>
            </div>
            {nuevoCliente && (
              <FormClienteInline onCancel={() => setNuevoCliente(false)} onCreated={onClienteCreado}/>
            )}
          </div>
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
  const clienteNombre = extraerClienteNombre(cot)

  const cambiarEstado = async (nuevo) => {
    if (nuevo === 'Aprobada' && !confirm('Al aprobar se creará el proyecto automáticamente con los hitos 50/40/10 y se dispararán las 3 tareas post-cierre (Legal/Admin/Proyectos). ¿Continuar?')) return
    try {
      await actualizarCotizacion(cot.id, { estado: nuevo })
      cargar()
      if (nuevo === 'Aprobada') setTimeout(() => alert('✓ Proyecto creado y tareas post-cierre asignadas. Revisa el bloque Post-cierre abajo y el módulo Proyectos.'), 500)
    } catch (e) {
      // El trigger BEFORE UPDATE puede bloquear si el cliente no tiene RFC/dirección
      alert('No se pudo cambiar de estado:\n\n' + (e.message || e))
    }
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
            {clienteNombre !== '(Sin cliente)' && <span style={{ fontSize:12, color:COLORS.slate500 }}>· {clienteNombre}</span>}
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
          {cot.items.length === 0 && (
            <div style={{ padding:30, textAlign:'center' }}>
              <div style={{ color:COLORS.slate500, fontSize:13, marginBottom:4 }}>
                {esBorrador ? 'Sin servicios.' : 'Cotización importada — sin desglose de ítems.'}
              </div>
              <div style={{ color:COLORS.slate400, fontSize:11 }}>
                {esBorrador ? 'Agrega el primero con el botón de arriba.' : 'El monto total proviene del registro histórico.'}
              </div>
            </div>
          )}
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
            {[['Cliente', clienteNombre !== '(Sin cliente)' ? clienteNombre : null], ['Capacidad', cot.capacidad_mw ? `${cot.capacidad_mw} MW` : '—'], ['Ubicación', cot.ubicacion], ['Fecha emisión', cot.fecha_emision], ['Vigencia', cot.fecha_vigencia]].map(([k,v]) => (
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

          {/* v15.8.3: zona destructiva — solo dirección */}
          {puedeEliminar(usuario) && (
            <div style={{ marginTop:16, paddingTop:14, borderTop:`1px solid ${COLORS.slate100}` }}>
              <button
                onClick={async () => {
                  if (!confirm(`¿Eliminar la cotización ${cot.codigo}? Se borrarán todos sus items. Esta acción no se puede deshacer.`)) return
                  try { await eliminarCotizacion(cot.id); onVolver() }
                  catch (e) { alert('Error: ' + e.message) }
                }}
                style={{ width:'100%', padding:'10px', background:'transparent', border:`1px solid ${COLORS.red}`, color:COLORS.red, borderRadius:8, fontSize:12, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}
              >
                {Icon('Trash')} Eliminar cotización
              </button>
            </div>
          )}
        </div>
      </div>

      {/* v16.1: Workflow Post-Cierre — solo se muestra cuando la cotización está Aprobada */}
      {cot.estado === 'Aprobada' && (
        <WorkflowPostCierre cotizacion={cot} usuario={usuario} onCambio={cargar}/>
      )}
    </div>
  )
}

// ============================================================
// v16.1: Workflow Post-Cierre — 3 tareas (Legal/Admin/Proyectos) tras aprobar cotización
// ============================================================
function WorkflowPostCierre({ cotizacion, usuario, onCambio }) {
  const [tareas, setTareas] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorCarga, setErrorCarga] = useState(null)  // v16.5.0: feedback visible
  const [completandoId, setCompletandoId] = useState(null)
  const [archivos, setArchivos] = useState({})  // {tareaId: File}
  const [notasMap, setNotasMap] = useState({})

  const cargar = async () => {
    setLoading(true)
    setErrorCarga(null)
    try { setTareas(await getTareasPostCierre(cotizacion.id)) }
    catch (e) {
      console.error('getTareasPostCierre:', e)
      setTareas([])
      setErrorCarga(e.message || 'No se pudieron cargar las tareas del workflow')
    }
    setLoading(false)
  }
  useEffect(() => { cargar() }, [cotizacion.id])

  const completar = async (tareaId) => {
    if (!confirm('¿Marcar esta tarea como completada?')) return
    setCompletandoId(tareaId)
    try {
      await completarTareaPostCierre(tareaId, {
        notas: notasMap[tareaId] || null,
        archivo: archivos[tareaId] || null,
        cotizacionId: cotizacion.id,
      })
      cargar()
    } catch (e) { alert('Error: ' + e.message) }
    setCompletandoId(null)
  }

  const aprobarTodo = async () => {
    if (!confirm('¿Confirmar que las 3 tareas están bien y arrancar el calendario de cobranza? Esta acción es definitiva.')) return
    try {
      await aprobarWorkflowPostCierre(cotizacion.id)
      alert('✓ Workflow aprobado. Cobranza puede arrancar el calendario de pagos.')
      onCambio?.()
    } catch (e) { alert('Error: ' + e.message) }
  }

  const completadas = tareas.filter(t => t.estado === 'completada').length
  const total = tareas.length
  const todasOK = total > 0 && completadas === total
  const yaAprobado = !!cotizacion.workflow_aprobado_en
  const puedeAprobar = puedeAprobarCotizacion(usuario)

  if (loading) return <div style={{ marginTop: 24, padding: 30, textAlign: 'center', color: COLORS.slate400 }}>Cargando workflow...</div>
  if (errorCarga) return (
    <div style={{ marginTop:24, padding:14, background:COLORS.redLight, border:`1px solid ${COLORS.red}`, borderRadius:10, color:COLORS.red, fontSize:12 }}>
      ⚠ {errorCarga}
      <button onClick={cargar} style={{ marginLeft:10, padding:'4px 10px', background:'transparent', border:`1px solid ${COLORS.red}`, color:COLORS.red, borderRadius:6, fontSize:11, cursor:'pointer' }}>Reintentar</button>
    </div>
  )

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ background: 'white', border: `1px solid ${COLORS.slate100}`, borderRadius: 12, padding: 18, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: COLORS.navy, margin: 0 }}>🔄 Workflow Post-Cierre</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 12, color: COLORS.slate500, fontWeight: 600 }}>
              {completadas} de {total} completadas
            </span>
            {yaAprobado && (
              <span style={{ fontSize: 11, padding: '4px 10px', background: COLORS.successLight, color: COLORS.successInk, borderRadius: 12, fontWeight: 700 }}>
                ✓ Aprobado · cobranza activa
              </span>
            )}
          </div>
        </div>
        <p style={{ fontSize: 11, color: COLORS.slate500, margin: '4px 0 0' }}>
          Tareas automáticas creadas al aprobar la cotización. Cada departamento tiene un plazo en días hábiles. Cuando las 3 estén completadas, Ventas debe confirmar para arrancar el calendario de cobranza.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
        {DEPARTAMENTOS_POST_CIERRE.map(dep => {
          const t = tareas.find(x => x.departamento === dep.k)
          if (!t) return (
            <div key={dep.k} style={{ background: 'white', border: `1px solid ${COLORS.slate100}`, borderRadius: 10, padding: 14, opacity: 0.5 }}>
              <div style={{ fontSize: 12, color: COLORS.slate400 }}>{dep.icon} {dep.l}</div>
              <div style={{ fontSize: 11, color: COLORS.slate400, marginTop: 6 }}>(no asignada)</div>
            </div>
          )
          const estCfg = ESTADOS_TAREA_PC[t.esta_vencida ? 'vencida' : t.estado] || ESTADOS_TAREA_PC.pendiente
          const esResp = t.asignado?.id === usuario?.id || esDirOAdmin(usuario)
          const yaCompletada = t.estado === 'completada'
          return (
            <div key={dep.k} style={{
              background: 'white', border: `2px solid ${dep.color}`,
              borderRadius: 10, padding: 14,
              opacity: yaCompletada ? 0.7 : 1,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 18 }}>{dep.icon}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: dep.color }}>{dep.l}</span>
                </div>
                <span style={{ fontSize: 10, padding: '3px 8px', background: estCfg.bg, color: estCfg.color, borderRadius: 10, fontWeight: 700 }}>
                  {estCfg.l}
                </span>
              </div>
              <div style={{ fontSize: 12, color: COLORS.ink, fontWeight: 500, marginBottom: 4 }}>{t.titulo}</div>
              <div style={{ fontSize: 10, color: COLORS.slate500, marginBottom: 10, lineHeight: 1.4 }}>{t.descripcion}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: COLORS.slate500, fontFamily: 'var(--font-mono)', marginBottom: 8 }}>
                <span>📅 {t.fecha_limite} ({t.plazo_dias_habiles}d hábiles)</span>
                <span>👤 {t.asignado?.nombre || 'Sin asignar'}</span>
              </div>
              {yaCompletada ? (
                <div style={{ fontSize: 10, color: COLORS.teal, fontWeight: 600 }}>
                  ✓ Completada {t.completada_en ? new Date(t.completada_en).toLocaleDateString('es-MX', {day:'2-digit',month:'short'}) : ''}
                  {t.completada_por_user?.nombre ? ` por ${t.completada_por_user.nombre}` : ''}
                  {t.archivo_path && <div style={{ fontSize: 9, color: COLORS.slate500, marginTop: 4, fontFamily: 'var(--font-mono)' }}>📎 {t.archivo_path.split('/').pop().replace(/^\d+_/, '')}</div>}
                  {t.notas && <div style={{ fontSize: 10, color: COLORS.slate600, marginTop: 6, padding: 6, background: COLORS.slate50, borderRadius: 4 }}>{t.notas}</div>}
                </div>
              ) : esResp ? (
                <div>
                  <input
                    type="file"
                    onChange={e => setArchivos(a => ({ ...a, [t.id]: e.target.files?.[0] || null }))}
                    style={{ fontSize: 10, marginBottom: 6, width: '100%' }}
                  />
                  <textarea
                    placeholder="Notas (opcional)"
                    value={notasMap[t.id] || ''}
                    onChange={e => setNotasMap(n => ({ ...n, [t.id]: e.target.value }))}
                    rows={2}
                    style={{ width: '100%', padding: '6px 8px', fontSize: 10, border: `1px solid ${COLORS.slate200}`, borderRadius: 4, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', marginBottom: 6 }}
                  />
                  <button
                    onClick={() => completar(t.id)}
                    disabled={completandoId === t.id}
                    style={{ width: '100%', padding: '6px 10px', background: dep.color, color: 'white', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                  >
                    {completandoId === t.id ? 'Subiendo...' : '✓ Marcar completada'}
                  </button>
                </div>
              ) : (
                <div style={{ fontSize: 10, color: COLORS.slate400, fontStyle: 'italic' }}>
                  Esperando que {t.asignado?.nombre || 'el responsable'} la complete.
                </div>
              )}
            </div>
          )
        })}
      </div>

      {todasOK && !yaAprobado && puedeAprobar && (
        <button
          onClick={aprobarTodo}
          style={{ width: '100%', marginTop: 14, padding: 14, background: COLORS.teal, color: 'white', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          ✅ Aprobar workflow → arrancar calendario de cobranza
        </button>
      )}
      {todasOK && !yaAprobado && !puedeAprobar && (
        <div style={{ marginTop: 14, padding: 12, background: COLORS.slate50, borderRadius: 8, fontSize: 12, color: COLORS.slate600, textAlign: 'center' }}>
          Las 3 tareas están listas. Ventas debe confirmar para arrancar el calendario de cobranza.
        </div>
      )}
    </div>
  )
}

function ModalNuevoItem({ cotizacionId, onClose, onAgregado }) {
  const [form, setForm] = useState({ servicio:'', descripcion:'', cantidad:1, precio_unitario:'', porcentaje_anticipo:50, porcentaje_avance:40, porcentaje_finalizacion:10 })
  const [catalogoSel, setCatalogoSel] = useState('')  // v15.6.0
  const suma = Number(form.porcentaje_anticipo) + Number(form.porcentaje_avance) + Number(form.porcentaje_finalizacion)

  // v15.7 — Pricing engine: state local del bloque
  const [precios, setPrecios] = useState([])
  const [pricingOpen, setPricingOpen] = useState(false)
  const [pricingTipo, setPricingTipo] = useState('CC')
  const [pricingCap, setPricingCap] = useState('')
  const [pricingInfl, setPricingInfl] = useState(false)
  const [pricingAnios, setPricingAnios] = useState(0)
  const [pricingError, setPricingError] = useState(null)  // v16.9.3: feedback visible (antes catch silencioso)
  useEffect(() => {
    getPreciosServicios()
      .then(d => { setPrecios(d); setPricingError(null) })
      .catch(e => setPricingError(e.message || 'No se pudieron cargar los precios'))
  }, [])

  const pricingMatch = (() => {
    if (!form.servicio || !pricingCap) return null
    return buscarPrecioServicio(precios, {
      servicio: form.servicio,
      tipo: pricingTipo,
      capacidadMw: Number(pricingCap),
      conInflacion: pricingInfl,
      anios: Number(pricingAnios) || 0,
    })
  })()

  const aplicarPrecioPricing = () => {
    if (!pricingMatch) return
    setForm(f => ({ ...f, precio_unitario: pricingMatch.precio }))
  }

  // v15.6.0: al elegir un servicio del catálogo, autocompletar nombre + descripcion
  const elegirCatalogo = (id) => {
    setCatalogoSel(id)
    if (!id) return // "Particular custom" → no toca form
    const s = SERVICIOS_CATALOGO.find(x => x.id === id)
    if (s) {
      setForm(f => ({ ...f, servicio: s.nombre, descripcion: s.descripcion }))
      // Si el servicio tiene un tipo específico (CC o CE), sugerirlo al pricing
      if (s.tipo === 'CC' || s.tipo === 'CE') setPricingTipo(s.tipo)
    }
  }

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
      <div style={{ position:'fixed', top:'5%', left:'50%', transform:'translateX(-50%)', width:560, maxHeight:'90vh', overflow:'auto', background:'white', borderRadius:16, zIndex:1002 }}>
        <div style={{ padding:'20px 28px', borderBottom:`1px solid ${COLORS.slate100}`, display:'flex', justifyContent:'space-between' }}>
          <h2 style={{ fontSize:18, fontWeight:500, margin:0, color:COLORS.navy, fontFamily:'var(--font-sans)' }}>Agregar servicio</h2>
          <button onClick={onClose} style={{ border:'none', background:'transparent', cursor:'pointer' }}>{Icon('X')}</button>
        </div>
        <div style={{ padding:24 }}>
          {/* v15.6.0: Selector del catálogo (acelera y mantiene wording oficial) */}
          <div style={{ marginBottom:12, padding:12, background:COLORS.slate50, borderRadius:8 }}>
            <label style={labelStyle}>Servicio del catálogo (opcional)</label>
            <select value={catalogoSel} onChange={e => elegirCatalogo(e.target.value)} style={selectStyle}>
              <option value="">— Servicio particular (custom) —</option>
              {SERVICIOS_CATALOGO.map(s => (
                <option key={s.id} value={s.id}>{s.nombre}{s.tipo !== 'AMBOS' ? ` · ${s.tipo}` : ''}</option>
              ))}
            </select>
            <div style={{ fontSize:10, color:COLORS.slate500, marginTop:6, fontStyle:'italic' }}>
              Selecciona uno y autocompleta el nombre y la descripción técnica oficial. Puedes editar después.
            </div>
          </div>

          <div style={{ marginBottom:12 }}><label style={labelStyle}>Servicio *</label><input value={form.servicio} onChange={e=>setForm({...form, servicio:e.target.value})} placeholder="Ej: Estudio de Impacto" style={inputStyle}/></div>

          {/* v15.7 — Pricing engine: bloque colapsable */}
          <div style={{ marginBottom: 12, border: `1px solid ${COLORS.slate200}`, borderRadius: 8, overflow: 'hidden' }}>
            <button
              type="button"
              onClick={() => setPricingOpen(v => !v)}
              style={{ width: '100%', padding: '10px 14px', background: pricingOpen ? COLORS.tealLight : COLORS.slate50, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: COLORS.navy, textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <span>💲 Calcular precio según capacidad MW {pricingOpen ? '▼' : '▶'}</span>
              {pricingMatch && <span style={{ fontSize: 11, color: COLORS.teal, fontWeight: 700 }}>${pricingMatch.precio.toLocaleString('es-MX')} MXN</span>}
            </button>
            {pricingOpen && (
              <div style={{ padding: 14, background: 'white' }}>
                {pricingError && (
                  <div style={{ padding:10, marginBottom:10, background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:8, fontSize:12, color:'#DC2626', display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
                    <span>⚠ {pricingError}</span>
                    <button onClick={() => { setPricingError(null); getPreciosServicios().then(d => { setPrecios(d); setPricingError(null) }).catch(e => setPricingError(e.message || 'No se pudieron cargar los precios')) }} style={{ padding:'4px 10px', background:'white', color:'#DC2626', border:'1px solid #FECACA', borderRadius:6, fontSize:11, fontWeight:600, cursor:'pointer' }}>Reintentar</button>
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 110px', gap: 10, marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 10, color: COLORS.slate500, marginBottom: 4 }}>Tipo</div>
                    <select value={pricingTipo} onChange={e => setPricingTipo(e.target.value)} style={selectStyle}>
                      {PRICING_TIPOS.map(t => <option key={t.k} value={t.k}>{t.l}</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: COLORS.slate500, marginBottom: 4 }}>Servicio del catálogo</div>
                    <select value={form.servicio} onChange={e => setForm(f => ({ ...f, servicio: e.target.value }))} style={selectStyle}>
                      <option value="">— Seleccionar —</option>
                      {listarServiciosPricing(precios, pricingTipo).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: COLORS.slate500, marginBottom: 4 }}>Capacidad (MW)</div>
                    <input type="number" min="0" step="0.5" value={pricingCap} onChange={e => setPricingCap(e.target.value)} placeholder="Ej: 25" style={inputStyle}/>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, marginBottom: 10 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input type="checkbox" checked={pricingInfl} onChange={e => setPricingInfl(e.target.checked)}/>
                    Con inflación (5% anual)
                  </label>
                  {pricingInfl && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: COLORS.slate500 }}>Años:</span>
                      <input type="number" min="0" max="20" value={pricingAnios} onChange={e => setPricingAnios(e.target.value)} style={{ ...inputStyle, width: 60, padding: '4px 8px' }}/>
                    </div>
                  )}
                </div>
                {pricingMatch ? (
                  <div style={{ padding: '10px 12px', background: COLORS.tealLight, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: 12 }}>
                      <strong style={{ color: COLORS.navy }}>${pricingMatch.precio.toLocaleString('es-MX')} MXN</strong>
                      <span style={{ color: COLORS.slate500, marginLeft: 8 }}>
                        (rango {pricingMatch.rango.min}{pricingMatch.rango.max != null ? `–${pricingMatch.rango.max}` : '+'} MW{pricingInfl && pricingAnios > 0 ? ` · +${pricingAnios}a inflación` : ''})
                      </span>
                    </div>
                    <button type="button" onClick={aplicarPrecioPricing} style={{ padding: '6px 12px', background: COLORS.teal, color: 'white', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                      Usar este precio
                    </button>
                  </div>
                ) : (form.servicio && pricingCap) ? (
                  <div style={{ padding: '8px 12px', background: COLORS.amberLight, borderRadius: 6, fontSize: 11, color: COLORS.amber }}>
                    No hay precio en el catálogo para "{form.servicio}" ({pricingTipo}) a {pricingCap} MW.
                  </div>
                ) : (
                  <div style={{ fontSize: 11, color: COLORS.slate500 }}>
                    Selecciona tipo + servicio + capacidad para ver el precio.
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{ marginBottom:12 }}><label style={labelStyle}>Descripción</label><textarea value={form.descripcion} onChange={e=>setForm({...form, descripcion:e.target.value})} rows={6} style={{...inputStyle, resize:'vertical', fontFamily:'inherit'}} placeholder="Bullets que aparecerán en el PDF (cada línea con '- ' al inicio se renderiza como lista)"/></div>
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
  // v15.6.0: si el servicio del item matchea un nombre del catálogo, preseleccionar el dropdown
  const [catalogoSel, setCatalogoSel] = useState(
    SERVICIOS_CATALOGO.find(s => s.nombre === item.servicio)?.id || ''
  )
  const [guardando, setGuardando] = useState(false)
  const suma = Number(form.porcentaje_anticipo) + Number(form.porcentaje_avance) + Number(form.porcentaje_finalizacion)

  const elegirCatalogo = (id) => {
    setCatalogoSel(id)
    if (!id) return
    const s = SERVICIOS_CATALOGO.find(x => x.id === id)
    if (s) setForm(f => ({ ...f, servicio: s.nombre, descripcion: s.descripcion }))
  }

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
          {/* v15.6.0: dropdown del catálogo (preseleccionado si el servicio matchea) */}
          <div style={{ marginBottom:12, padding:12, background:COLORS.slate50, borderRadius:8 }}>
            <label style={labelStyle}>Servicio del catálogo (opcional)</label>
            <select value={catalogoSel} onChange={e => elegirCatalogo(e.target.value)} style={selectStyle}>
              <option value="">— Servicio particular (custom) —</option>
              {SERVICIOS_CATALOGO.map(s => (
                <option key={s.id} value={s.id}>{s.nombre}{s.tipo !== 'AMBOS' ? ` · ${s.tipo}` : ''}</option>
              ))}
            </select>
            <div style={{ fontSize:10, color:COLORS.slate500, marginTop:6, fontStyle:'italic' }}>
              Cambiar reemplaza el nombre y la descripción con el wording oficial del catálogo.
            </div>
          </div>

          <div style={{ marginBottom:12 }}><label style={labelStyle}>Servicio *</label><input value={form.servicio} onChange={e=>setForm({...form, servicio:e.target.value})} style={inputStyle}/></div>
          <div style={{ marginBottom:12 }}><label style={labelStyle}>Descripción</label><textarea value={form.descripcion} onChange={e=>setForm({...form, descripcion:e.target.value})} rows={6} style={{...inputStyle, resize:'vertical', fontFamily:'inherit'}}/></div>
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
    cliente_id: cot.cliente_id || '',
    capacidad_mw: cot.capacidad_mw ?? '',
    ubicacion: cot.ubicacion || '',
    fecha_emision: cot.fecha_emision || '',
    fecha_vigencia: cot.fecha_vigencia || '',
    notas: cot.notas || '',
  })
  const [clientes, setClientes] = useState([])
  const [guardando, setGuardando] = useState(false)
  useEffect(() => { getClientes().then(setClientes) }, [])

  const guardar = async () => {
    if (!form.nombre_proyecto.trim()) { alert('El nombre del proyecto es requerido'); return }
    setGuardando(true)
    try {
      await actualizarCotizacion(cot.id, {
        nombre_proyecto: form.nombre_proyecto.trim(),
        cliente_id: form.cliente_id || null,
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
            <p style={{ fontSize:11, color:COLORS.slate500, margin:'4px 0 0' }}>{cot.codigo}</p>
          </div>
          <button onClick={onClose} style={{ border:'none', background:'transparent', cursor:'pointer' }}>{Icon('X')}</button>
        </div>
        <div style={{ padding:24 }}>
          <div style={{ marginBottom:12 }}>
            <label style={labelStyle}>Nombre del proyecto *</label>
            <input value={form.nombre_proyecto} onChange={e=>setForm({...form, nombre_proyecto:e.target.value})} style={inputStyle}/>
          </div>
          <div style={{ marginBottom:12 }}>
            <label style={labelStyle}>Cliente</label>
            <select value={form.cliente_id} onChange={e=>setForm({...form, cliente_id:e.target.value})} style={selectStyle}>
              <option value="">Sin cliente vinculado</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.razon_social}</option>)}
            </select>
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