// ============================================================
// Plantas.jsx — v15.8.0
// Catálogo maestro de Plantas Eléctricas (Centros de Generación).
// CRUD + filtros + detalle + vinculación con proyectos.
// ============================================================
import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getPlantas, getPlanta, crearPlanta, actualizarPlanta, eliminarPlanta,
  getClientes, TIPOS_TECNOLOGIA_PLANTA, ESTADOS_PLANTA, templateCotizacionPorCapacidad,
} from './supabase'
import {
  COLORS, Badge, fmtMoney, fmtDate, inputStyle, selectStyle, labelStyle,
  btnPrimary, Icon, EmptyState, LoadingState, useIsMobile,
} from './helpers'
import { puede, puedeEliminar as rolPuedeEliminar } from './permisos'

export default function Plantas({ usuario }) {
  const [plantas, setPlantas] = useState(null)  // null = no cargado / tabla no existe
  const [loading, setLoading] = useState(true)
  const [tablaNoExiste, setTablaNoExiste] = useState(false)
  const [vista, setVista] = useState('lista')  // 'lista' | 'detalle'
  const [plantaSel, setPlantaSel] = useState(null)
  const [modalCrear, setModalCrear] = useState(false)
  const [filtroEstado, setFiltroEstado] = useState('Todos')
  const [filtroTipo, setFiltroTipo] = useState('Todos')
  const [busqueda, setBusqueda] = useState('')
  const isMobile = useIsMobile()

  const puedeEditar = ['direccion', 'director_proyectos', 'admin'].includes(usuario?.rol)
  const puedeBorrar = rolPuedeEliminar(usuario)

  const cargar = async () => {
    setLoading(true)
    try {
      const data = await getPlantas()
      if (data === null) { setTablaNoExiste(true); setPlantas([]) }
      else { setPlantas(data); setTablaNoExiste(false) }
    } catch (e) { alert('Error cargando plantas: ' + e.message) }
    setLoading(false)
  }
  useEffect(() => { cargar() }, [])

  const filtradas = useMemo(() => {
    if (!plantas) return []
    let r = plantas
    if (filtroEstado !== 'Todos') r = r.filter(p => p.estado === filtroEstado)
    if (filtroTipo !== 'Todos') r = r.filter(p => p.tipo_tecnologia === filtroTipo)
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase()
      r = r.filter(p =>
        p.nombre?.toLowerCase().includes(q) ||
        p.codigo?.toLowerCase().includes(q) ||
        p.cliente?.razon_social?.toLowerCase().includes(q) ||
        p.ubicacion?.toLowerCase().includes(q)
      )
    }
    return r
  }, [plantas, filtroEstado, filtroTipo, busqueda])

  const kpis = useMemo(() => {
    if (!plantas) return { total: 0, mwTotal: 0, enOperacion: 0, enPlaneacion: 0 }
    return {
      total: plantas.length,
      mwTotal: plantas.reduce((s, p) => s + Number(p.capacidad_mw || 0), 0),
      enOperacion: plantas.filter(p => p.estado === 'En operacion').length,
      enPlaneacion: plantas.filter(p => p.estado === 'Planeacion').length,
    }
  }, [plantas])

  if (loading) return <LoadingState/>

  if (tablaNoExiste) {
    return (
      <div>
        <h1 style={{ fontSize:32, fontWeight:400, color:COLORS.navy, margin:0, fontFamily:'var(--font-sans)' }}>Plantas Eléctricas</h1>
        <div style={{ marginTop:20, background:'#FEF3C7', border:'1px solid #FDE68A', borderRadius:12, padding:18 }}>
          <h3 style={{ fontSize:13, fontWeight:600, color:'#92400E', margin:0, marginBottom:8 }}>Tabla no configurada</h3>
          <p style={{ fontSize:12, color:'#92400E', margin:0, lineHeight:1.5 }}>
            Aplica el SQL en <strong>supabase/migrations/v15.8.0_plantas_electricas.sql</strong> en el SQL Editor de tu dashboard de Supabase. Una vez ejecutado, recarga esta vista.
          </p>
        </div>
      </div>
    )
  }

  if (vista === 'detalle' && plantaSel) {
    return <DetallePlanta
      plantaId={plantaSel}
      usuario={usuario}
      onVolver={() => { setPlantaSel(null); setVista('lista'); cargar() }}
      onEliminada={() => { setPlantaSel(null); setVista('lista'); cargar() }}
    />
  }

  return (
    <div>
      {modalCrear && <ModalPlanta usuario={usuario} onClose={() => setModalCrear(false)} onGuardada={(p) => { setModalCrear(false); cargar(); setPlantaSel(p.id); setVista('detalle') }}/>}

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontSize: isMobile ? 24 : 32, fontWeight:400, color:COLORS.navy, margin:0, fontFamily:'var(--font-sans)' }}>Plantas Eléctricas</h1>
          <p style={{ color:COLORS.slate500, fontSize:12, marginTop:4 }}>{filtradas.length} de {plantas.length} · {kpis.mwTotal.toFixed(2)} MW totales</p>
        </div>
        {puedeEditar && (
          <button onClick={() => setModalCrear(true)} style={{ ...btnPrimary, display:'flex', alignItems:'center', gap:6 }}>
            {Icon('Plus')} Nueva planta
          </button>
        )}
      </div>

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap:10, marginBottom:16 }}>
        <KpiCard label="Plantas registradas" valor={kpis.total} color={COLORS.navy}/>
        <KpiCard label="Capacidad total" valor={`${kpis.mwTotal.toFixed(1)} MW`} color={COLORS.teal}/>
        <KpiCard label="En operación" valor={kpis.enOperacion} color={COLORS.teal}/>
        <KpiCard label="En planeación" valor={kpis.enPlaneacion} color={COLORS.slate500}/>
      </div>

      {/* Filtros */}
      <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap' }}>
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} style={{ ...selectStyle, width:'auto', minWidth:140 }}>
          <option value="Todos">Todos los estados</option>
          {Object.entries(ESTADOS_PLANTA).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} style={{ ...selectStyle, width:'auto', minWidth:160 }}>
          <option value="Todos">Todas las tecnologías</option>
          {TIPOS_TECNOLOGIA_PLANTA.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <div style={{ flex:1, minWidth:200, position:'relative' }}>
          <div style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:COLORS.slate400 }}>{Icon('Search')}</div>
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar nombre, código, cliente, ubicación..." style={{ ...inputStyle, paddingLeft:36 }}/>
        </div>
      </div>

      {/* Lista */}
      {filtradas.length === 0 && plantas.length === 0 && (
        <EmptyState titulo="Sin plantas registradas" descripcion={puedeEditar ? "Empieza agregando la primera planta del catálogo." : "Aún no hay plantas registradas."}/>
      )}
      {filtradas.length === 0 && plantas.length > 0 && (
        <EmptyState titulo="Sin resultados" descripcion="Ningún resultado con los filtros actuales."/>
      )}
      {filtradas.length > 0 && (
        <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(320px, 1fr))', gap:12 }}>
          {filtradas.map(p => (
            <PlantaCard key={p.id} planta={p} onClick={() => { setPlantaSel(p.id); setVista('detalle') }}/>
          ))}
        </div>
      )}
    </div>
  )
}

function KpiCard({ label, valor, color }) {
  return (
    <div style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, padding:14 }}>
      <div style={{ fontSize:10, fontWeight:600, color:COLORS.slate500, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>{label}</div>
      <div style={{ fontSize:20, fontWeight:500, color, fontFamily:'var(--font-mono)', lineHeight:1 }}>{valor}</div>
    </div>
  )
}

function PlantaCard({ planta, onClick }) {
  const estadoMeta = ESTADOS_PLANTA[planta.estado] || ESTADOS_PLANTA.Planeacion
  return (
    <div onClick={onClick} style={{
      background:'white', border:`1px solid ${COLORS.slate100}`,
      borderLeft:`3px solid ${estadoMeta.color}`, borderRadius:12, padding:16,
      cursor:'pointer', transition:'all 0.15s',
    }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 14px rgba(10,37,64,0.08)' }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none' }}
    >
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8, marginBottom:10 }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:10, fontFamily:'var(--font-mono)', color:COLORS.slate400, fontWeight:700, marginBottom:2 }}>{planta.codigo || '—'}</div>
          <div style={{ fontSize:14, fontWeight:600, color:COLORS.ink, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{planta.nombre}</div>
          {planta.cliente && <div style={{ fontSize:11, color:COLORS.slate500, marginTop:2 }}>{planta.cliente.razon_social}</div>}
        </div>
        <Badge texto={estadoMeta.label} mapa={Object.fromEntries(Object.entries(ESTADOS_PLANTA).map(([k,v])=>[v.label, v]))} tamano={10}/>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, fontSize:11 }}>
        {planta.capacidad_mw != null && (
          <div><div style={{ color:COLORS.slate500 }}>Capacidad</div><div style={{ fontWeight:600, color:COLORS.navy, fontFamily:'var(--font-mono)' }}>{Number(planta.capacidad_mw).toFixed(2)} MW</div></div>
        )}
        {planta.tipo_tecnologia && (
          <div><div style={{ color:COLORS.slate500 }}>Tecnología</div><div style={{ fontWeight:500, color:COLORS.ink }}>{planta.tipo_tecnologia}</div></div>
        )}
        {planta.ubicacion && (
          <div style={{ gridColumn:'span 2' }}><div style={{ color:COLORS.slate500 }}>Ubicación</div><div style={{ fontWeight:500, color:COLORS.ink, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{planta.ubicacion}</div></div>
        )}
      </div>
    </div>
  )
}

// ============================================================
// DETALLE
// ============================================================
function DetallePlanta({ plantaId, usuario, onVolver, onEliminada }) {
  const [planta, setPlanta] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState(false)
  const navigate = useNavigate()

  const puedeEditar = ['direccion', 'director_proyectos', 'admin'].includes(usuario?.rol)
  const puedeBorrar = rolPuedeEliminar(usuario)

  const cargar = async () => {
    setLoading(true)
    try { setPlanta(await getPlanta(plantaId)) }
    catch (e) { alert('Error: ' + e.message) }
    setLoading(false)
  }
  useEffect(() => { cargar() }, [plantaId])

  const handleEliminar = async () => {
    if (!confirm(`¿Eliminar la planta "${planta.nombre}"? Los proyectos asociados quedarán sin planta vinculada (no se eliminan).`)) return
    try {
      await eliminarPlanta(plantaId)
      onEliminada()
    } catch (e) { alert('Error eliminando: ' + e.message) }
  }

  if (loading) return <LoadingState/>
  if (!planta) return <div style={{ padding:40, textAlign:'center', color:COLORS.slate400 }}>Planta no encontrada</div>

  const estadoMeta = ESTADOS_PLANTA[planta.estado] || ESTADOS_PLANTA.Planeacion
  const templateDocx = templateCotizacionPorCapacidad(planta.capacidad_mw)

  return (
    <div>
      {editando && <ModalPlanta usuario={usuario} planta={planta} onClose={() => setEditando(false)} onGuardada={() => { setEditando(false); cargar() }}/>}

      <div style={{ display:'flex', alignItems:'flex-start', gap:12, marginBottom:16, flexWrap:'wrap' }}>
        <button onClick={onVolver} style={{ padding:'8px 12px', background:'white', border:`1px solid ${COLORS.slate200}`, borderRadius:8, fontSize:12, cursor:'pointer', color:COLORS.slate600, display:'flex', alignItems:'center', gap:6, fontWeight:500 }}>
          {Icon('Back')} Plantas
        </button>
        <div style={{ flex:1, minWidth:200 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4, flexWrap:'wrap' }}>
            <span style={{ fontSize:11, fontFamily:'var(--font-mono)', color:COLORS.slate400 }}>{planta.codigo}</span>
            <Badge texto={estadoMeta.label} mapa={Object.fromEntries(Object.entries(ESTADOS_PLANTA).map(([k,v])=>[v.label, v]))}/>
          </div>
          <h1 style={{ fontSize:26, fontWeight:500, color:COLORS.navy, margin:0, fontFamily:'var(--font-sans)' }}>{planta.nombre}</h1>
          {planta.cliente && <p style={{ fontSize:12, color:COLORS.slate500, margin:'3px 0 0' }}>{planta.cliente.razon_social}{planta.cliente.rfc ? ` · RFC: ${planta.cliente.rfc}` : ''}</p>}
        </div>
        {puedeEditar && (
          <button onClick={() => setEditando(true)} style={{ padding:'8px 14px', background:COLORS.navy, color:'white', border:'none', borderRadius:8, fontSize:12, fontWeight:600, cursor:'pointer' }}>
            Editar
          </button>
        )}
        {puedeBorrar && (
          <button onClick={handleEliminar} style={{ padding:'8px 12px', background:'transparent', border:`1px solid ${COLORS.red}`, color:COLORS.red, borderRadius:8, fontSize:12, fontWeight:500, cursor:'pointer' }}>
            Eliminar
          </button>
        )}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:20 }}>
        {/* COLUMNA IZQUIERDA */}
        <div>
          {/* Datos técnicos */}
          <div style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, padding:18, marginBottom:16 }}>
            <h3 style={{ fontSize:13, fontWeight:600, color:COLORS.ink, margin:0, marginBottom:14 }}>Información técnica</h3>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <DataRow label="Capacidad" valor={planta.capacidad_mw != null ? `${Number(planta.capacidad_mw).toFixed(2)} MW` : '—'} mono/>
              <DataRow label="Tecnología" valor={planta.tipo_tecnologia || '—'}/>
              <DataRow label="Voltaje interconexión" valor={planta.voltaje_kv != null ? `${planta.voltaje_kv} kV` : '—'} mono/>
              <DataRow label="Punto de interconexión" valor={planta.punto_interconexion || '—'}/>
              <DataRow label="Ubicación" valor={planta.ubicacion || '—'}/>
              <DataRow label="Estado (geográfico)" valor={planta.estado_geo || '—'}/>
              <DataRow label="Coordenadas" valor={planta.coordenadas || '—'} mono/>
              <DataRow label="Fecha Operación Comercial" valor={planta.fecha_operacion_comercial ? fmtDate(planta.fecha_operacion_comercial) : '—'}/>
            </div>
          </div>

          {/* Proyectos asociados */}
          <div style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, padding:18, marginBottom:16 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:14 }}>
              <h3 style={{ fontSize:13, fontWeight:600, color:COLORS.ink, margin:0 }}>Proyectos asociados ({planta.proyectos.length})</h3>
            </div>
            {planta.proyectos.length === 0 && <div style={{ padding:16, textAlign:'center', color:COLORS.slate400, fontSize:12 }}>Sin proyectos vinculados todavía. Edita un proyecto y selecciona esta planta para vincularlo.</div>}
            {planta.proyectos.map(p => (
              <div key={p.id} onClick={() => navigate(`/proyectos?proyecto=${p.id}`)} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderBottom:`1px solid ${COLORS.slate100}`, cursor:'pointer' }}
                onMouseEnter={e => { e.currentTarget.style.background = COLORS.slate50 }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:11, fontFamily:'var(--font-mono)', color:COLORS.slate400, fontWeight:600 }}>{p.codigo}</div>
                  <div style={{ fontSize:13, fontWeight:500, color:COLORS.ink, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.nombre}</div>
                  {p.director?.nombre && <div style={{ fontSize:10, color:COLORS.slate500, marginTop:2 }}>{p.director.nombre}</div>}
                </div>
                <Badge texto={p.estado} mapa={{}} tamano={10}/>
                <span style={{ color:COLORS.slate400 }}>›</span>
              </div>
            ))}
          </div>

          {/* Notas */}
          {planta.notas && (
            <div style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, padding:18 }}>
              <h3 style={{ fontSize:13, fontWeight:600, color:COLORS.ink, margin:0, marginBottom:8 }}>Notas</h3>
              <p style={{ fontSize:12, color:COLORS.slate600, margin:0, lineHeight:1.5, whiteSpace:'pre-wrap' }}>{planta.notas}</p>
            </div>
          )}
        </div>

        {/* COLUMNA DERECHA */}
        <div>
          {/* Template de cotización según rango MW */}
          {templateDocx && (
            <div style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, padding:18, marginBottom:16 }}>
              <h3 style={{ fontSize:11, fontWeight:600, color:COLORS.slate500, marginBottom:10, textTransform:'uppercase', letterSpacing:'0.08em' }}>Template de cotización</h3>
              <p style={{ fontSize:12, color:COLORS.slate600, margin:'0 0 12px', lineHeight:1.4 }}>
                Plantilla de propuesta técnica-económica correspondiente a esta capacidad ({Number(planta.capacidad_mw).toFixed(1)} MW).
              </p>
              <a href={`/templates/${encodeURIComponent(templateDocx)}`} download
                style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'10px 14px', background:COLORS.navy, color:'white', borderRadius:8, fontSize:12, fontWeight:600, textDecoration:'none' }}>
                {Icon('Download')} Descargar .docx
              </a>
            </div>
          )}
          {!templateDocx && planta.capacidad_mw != null && (
            <div style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, padding:18, marginBottom:16, fontSize:12, color:COLORS.slate500 }}>
              No hay template asociado para esta capacidad ({Number(planta.capacidad_mw).toFixed(1)} MW). Templates disponibles: 0.5–10 MW y 10.1–1000 MW.
            </div>
          )}

          {/* Auditoría */}
          <div style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, padding:18 }}>
            <h3 style={{ fontSize:11, fontWeight:600, color:COLORS.slate500, marginBottom:10, textTransform:'uppercase', letterSpacing:'0.08em' }}>Auditoría</h3>
            <div style={{ fontSize:11, color:COLORS.slate600, lineHeight:1.6 }}>
              <div>Creada: {fmtDate(planta.created_at)}</div>
              <div>Última actualización: {fmtDate(planta.updated_at)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function DataRow({ label, valor, mono }) {
  return (
    <div>
      <div style={{ fontSize:10, fontWeight:600, color:COLORS.slate500, textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:3 }}>{label}</div>
      <div style={{ fontSize:13, color:COLORS.ink, fontFamily: mono ? 'var(--font-mono)' : 'var(--font-sans)', fontWeight:500 }}>{valor}</div>
    </div>
  )
}

// ============================================================
// MODAL CREAR / EDITAR
// ============================================================
function ModalPlanta({ usuario, planta, onClose, onGuardada }) {
  const esEdicion = !!planta
  const [clientes, setClientes] = useState([])
  const [form, setForm] = useState({
    nombre: planta?.nombre || '',
    cliente_id: planta?.cliente_id || planta?.cliente?.id || '',
    capacidad_mw: planta?.capacidad_mw ?? '',
    tipo_tecnologia: planta?.tipo_tecnologia || '',
    ubicacion: planta?.ubicacion || '',
    estado_geo: planta?.estado_geo || '',
    coordenadas: planta?.coordenadas || '',
    estado: planta?.estado || 'Planeacion',
    fecha_operacion_comercial: planta?.fecha_operacion_comercial || '',
    punto_interconexion: planta?.punto_interconexion || '',
    voltaje_kv: planta?.voltaje_kv ?? '',
    notas: planta?.notas || '',
  })
  const [guardando, setGuardando] = useState(false)

  useEffect(() => { getClientes().then(setClientes).catch(()=>{}) }, [])

  const guardar = async () => {
    if (!form.nombre.trim()) { alert('Nombre es requerido'); return }
    setGuardando(true)
    try {
      const result = esEdicion
        ? await actualizarPlanta(planta.id, form)
        : await crearPlanta(form)
      onGuardada(result)
    } catch (e) {
      alert('Error: ' + e.message)
      setGuardando(false)
    }
  }

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(10,37,64,0.35)', zIndex:999 }}/>
      <div style={{ position:'fixed', top:'5%', left:'50%', transform:'translateX(-50%)', width:620, maxHeight:'90vh', overflow:'auto', background:'white', borderRadius:16, zIndex:1000 }}>
        <div style={{ padding:'20px 28px', borderBottom:`1px solid ${COLORS.slate100}`, display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
          <div>
            <h2 style={{ fontSize:20, fontWeight:500, margin:0, color:COLORS.navy, fontFamily:'var(--font-sans)' }}>{esEdicion ? 'Editar planta' : 'Nueva planta eléctrica'}</h2>
            {esEdicion && <p style={{ fontSize:11, color:COLORS.slate500, margin:'4px 0 0' }}>{planta.codigo}</p>}
          </div>
          <button onClick={onClose} style={{ border:'none', background:'transparent', cursor:'pointer' }}>{Icon('X')}</button>
        </div>
        <div style={{ padding:24 }}>
          <div style={{ marginBottom:14 }}>
            <label style={labelStyle}>Nombre de la planta *</label>
            <input value={form.nombre} onChange={e=>setForm({...form, nombre:e.target.value})} placeholder="Ej: Solar Querétaro Norte" style={inputStyle}/>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
            <div>
              <label style={labelStyle}>Cliente / Propietario</label>
              <select value={form.cliente_id} onChange={e=>setForm({...form, cliente_id:e.target.value})} style={selectStyle}>
                <option value="">— Sin cliente —</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.razon_social}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Estado</label>
              <select value={form.estado} onChange={e=>setForm({...form, estado:e.target.value})} style={selectStyle}>
                {Object.entries(ESTADOS_PLANTA).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
            <div>
              <label style={labelStyle}>Capacidad (MW)</label>
              <input type="number" step="0.1" value={form.capacidad_mw} onChange={e=>setForm({...form, capacidad_mw:e.target.value})} placeholder="Ej: 25" style={inputStyle}/>
            </div>
            <div>
              <label style={labelStyle}>Tipo de tecnología</label>
              <select value={form.tipo_tecnologia} onChange={e=>setForm({...form, tipo_tecnologia:e.target.value})} style={selectStyle}>
                <option value="">— Selecciona —</option>
                {TIPOS_TECNOLOGIA_PLANTA.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
            <div>
              <label style={labelStyle}>Ubicación / Ciudad</label>
              <input value={form.ubicacion} onChange={e=>setForm({...form, ubicacion:e.target.value})} placeholder="Ej: Querétaro" style={inputStyle}/>
            </div>
            <div>
              <label style={labelStyle}>Estado geográfico</label>
              <input value={form.estado_geo} onChange={e=>setForm({...form, estado_geo:e.target.value})} placeholder="Ej: Querétaro, MX" style={inputStyle}/>
            </div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:12, marginBottom:14 }}>
            <div>
              <label style={labelStyle}>Coordenadas (lat, lon)</label>
              <input value={form.coordenadas} onChange={e=>setForm({...form, coordenadas:e.target.value})} placeholder="20.5888, -100.3899" style={inputStyle}/>
            </div>
            <div>
              <label style={labelStyle}>Voltaje interconexión (kV)</label>
              <input type="number" step="0.1" value={form.voltaje_kv} onChange={e=>setForm({...form, voltaje_kv:e.target.value})} placeholder="115" style={inputStyle}/>
            </div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:12, marginBottom:14 }}>
            <div>
              <label style={labelStyle}>Punto de interconexión (subestación / barra)</label>
              <input value={form.punto_interconexion} onChange={e=>setForm({...form, punto_interconexion:e.target.value})} placeholder="Ej: SE Querétaro Norte 115 kV" style={inputStyle}/>
            </div>
            <div>
              <label style={labelStyle}>Fecha Op. Comercial</label>
              <input type="date" value={form.fecha_operacion_comercial} onChange={e=>setForm({...form, fecha_operacion_comercial:e.target.value})} style={inputStyle}/>
            </div>
          </div>

          <div style={{ marginBottom:8 }}>
            <label style={labelStyle}>Notas</label>
            <textarea value={form.notas} onChange={e=>setForm({...form, notas:e.target.value})} rows={3} style={{...inputStyle, resize:'vertical', fontFamily:'inherit'}} placeholder="Observaciones, contactos clave, restricciones..."/>
          </div>
        </div>
        <div style={{ padding:'16px 28px', borderTop:`1px solid ${COLORS.slate100}`, display:'flex', justifyContent:'flex-end', gap:10 }}>
          <button onClick={onClose} disabled={guardando} style={{ padding:'10px 18px', background:'transparent', border:`1px solid ${COLORS.slate200}`, borderRadius:8, fontSize:13, cursor:'pointer' }}>Cancelar</button>
          <button onClick={guardar} disabled={guardando} style={{ padding:'10px 22px', background:COLORS.navy, color:'white', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor: guardando ? 'wait' : 'pointer' }}>{guardando ? 'Guardando...' : (esEdicion ? 'Guardar cambios' : 'Crear planta')}</button>
        </div>
      </div>
    </>
  )
}
