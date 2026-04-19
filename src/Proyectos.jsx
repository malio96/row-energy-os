import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { supabase, getProyectos, getProyectoConActividades, getUsuarios, getClientes, getPlantillas, getPlantillaActividades, crearProyectoDesdePlantilla, actualizarProyecto, actualizarActividad, eliminarActividad, crearActividad, desglosarActividadConPlantilla } from './supabase'

const COLORS = { navy:'#0A2540', navy2:'#1B3A6B', teal:'#0F6E56', tealLight:'#E1F5EE', gold:'#C89B3C', red:'#DC2626', amber:'#D97706', purple:'#6B4C9A', slate50:'#F8FAFC', slate100:'#F1F5F9', slate200:'#E2E8F0', slate400:'#94A3B8', slate500:'#64748B', slate600:'#475569', ink:'#1C2128' }
const ESTADOS = { 'Completada':{bg:'#E1F5EE',color:'#0F6E56',bar:'#0F6E56'}, 'En progreso':{bg:'#E0EDFF',color:'#1B3A6B',bar:'#1B3A6B'}, 'Sin iniciar':{bg:'#F1F5F9',color:'#64748B',bar:'#94A3B8'}, 'Retrasada':{bg:'#FEF2F2',color:'#DC2626',bar:'#DC2626'}, 'Bloqueada':{bg:'#FEF3C7',color:'#D97706',bar:'#D97706'} }
const ESTADOS_PROY = { 'En curso':{bg:'#E0EDFF',color:'#1B3A6B',bar:'#1B3A6B'}, 'Terminado':{bg:'#E1F5EE',color:'#0F6E56',bar:'#0F6E56'}, 'Por iniciar':{bg:'#FEF3C7',color:'#D97706',bar:'#D97706'}, 'En pausa':{bg:'#FEF2F2',color:'#DC2626',bar:'#DC2626'}, 'Cancelado':{bg:'#FEF2F2',color:'#DC2626',bar:'#DC2626'} }

const toDate = (s) => s ? new Date(s + 'T00:00:00') : new Date()
const toStr = (d) => d.toISOString().split('T')[0]
const addDays = (s, n) => { const d = toDate(s); d.setDate(d.getDate()+n); return toStr(d) }
const diffDays = (a, b) => Math.round((toDate(b) - toDate(a)) / 86400000)

const Icon = {
  Back:()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>,
  Plus:()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>,
  X:()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>,
  Check:()=><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>,
  Chevron:({open})=><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{transform: open?'rotate(0deg)':'rotate(-90deg)',transition:'transform 0.15s'}}><path d="m6 9 6 6 6-6"/></svg>,
  Info:()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>,
  Diamond:()=><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2 22 12 12 22 2 12z"/></svg>,
  Lock:()=><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  Scale:()=><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/></svg>,
}

function Badge({ texto, mapa, tamano=11 }) {
  const c = mapa[texto] || { bg:'#F1F5F9', color:'#64748B' }
  return <span style={{ display:'inline-flex', alignItems:'center', fontSize:tamano, fontWeight:500, padding:'3px 10px', borderRadius:20, background:c.bg, color:c.color, whiteSpace:'nowrap' }}>{texto}</span>
}

function BarraAvance({ avance, color=COLORS.navy2, height=5 }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:100 }}>
      <div style={{ flex:1, height, background:'#EEF2F6', borderRadius:height/2, overflow:'hidden' }}>
        <div style={{ width:`${avance||0}%`, height:'100%', background: avance===100?COLORS.teal:color, borderRadius:height/2, transition:'width 0.3s' }}/>
      </div>
      <span style={{ fontSize:11, fontWeight:600, color:avance===100?COLORS.teal:color, minWidth:32, fontFamily:'var(--font-mono)' }}>{avance||0}%</span>
    </div>
  )
}

function Avatar({ nombre, size=28 }) {
  const iniciales = nombre?.split(' ').map(n=>n[0]).slice(0,2).join('').toUpperCase() || '?'
  const colors = ['#1B3A6B','#0F6E56','#C89B3C','#6B4C9A','#D97706','#DC2626']
  const color = colors[(nombre?.length||0) % colors.length]
  return <div style={{ width:size, height:size, borderRadius:'50%', background:color, color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontSize:size*0.38, fontWeight:600, flexShrink:0 }}>{iniciales}</div>
}

// ============================================================
// MODAL: NUEVO PROYECTO DESDE PLANTILLA
// ============================================================
function ModalNuevoProyecto({ onClose, onCreado }) {
  const [plantillas, setPlantillas] = useState([])
  const [clientes, setClientes] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [plantillaSeleccionada, setPlantillaSeleccionada] = useState(null)
  const [plantillaActs, setPlantillaActs] = useState([])
  const [form, setForm] = useState({ nombre:'', clienteId:'', directorId:'', capacidadMw:'', ubicacion:'', inicioFecha: new Date().toISOString().split('T')[0] })
  const [creando, setCreando] = useState(false)

  useEffect(() => {
    Promise.all([getPlantillas(), getClientes(), getUsuarios()]).then(([p, c, u]) => {
      setPlantillas(p)
      setClientes(c)
      setUsuarios(u)
      const director = u.find(x => x.rol === 'director_proyectos')
      if (director) setForm(f => ({ ...f, directorId: director.id }))
    })
  }, [])

  useEffect(() => {
    if (plantillaSeleccionada) getPlantillaActividades(plantillaSeleccionada.id).then(setPlantillaActs)
    else setPlantillaActs([])
  }, [plantillaSeleccionada])

  const crear = async () => {
    if (!plantillaSeleccionada || !form.nombre || !form.clienteId || !form.directorId) {
      alert('Completa todos los campos requeridos')
      return
    }
    setCreando(true)
    try {
      const proyecto = await crearProyectoDesdePlantilla({
        plantillaId: plantillaSeleccionada.id,
        nombre: form.nombre,
        clienteId: form.clienteId,
        directorId: form.directorId,
        inicioFecha: form.inicioFecha,
        capacidadMw: form.capacidadMw ? parseFloat(form.capacidadMw) : null,
        ubicacion: form.ubicacion || null,
      })
      onCreado(proyecto)
    } catch (e) {
      alert('Error: ' + e.message)
    }
    setCreando(false)
  }

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(10,37,64,0.35)', zIndex:999 }}/>
      <div style={{ position:'fixed', top:'5%', left:'50%', transform:'translateX(-50%)', width:'min(880px, 95vw)', maxHeight:'90vh', background:'white', borderRadius:16, boxShadow:'0 20px 60px rgba(10,37,64,0.2)', zIndex:1000, display:'flex', flexDirection:'column' }}>
        <div style={{ padding:'20px 28px', borderBottom:`1px solid ${COLORS.slate100}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <h2 style={{ fontSize:20, fontWeight:500, color:COLORS.navy, fontFamily:'var(--font-serif)', margin:0 }}>Nuevo proyecto</h2>
            <p style={{ fontSize:12, color:COLORS.slate500, margin:'4px 0 0' }}>Elige una plantilla basada en LSE 2025 — las actividades se generarán automáticamente</p>
          </div>
          <button onClick={onClose} style={{ width:30, height:30, border:'none', background:COLORS.slate50, borderRadius:8, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}><Icon.X/></button>
        </div>

        <div style={{ flex:1, overflow:'auto', padding:24, display:'grid', gridTemplateColumns:'1fr 1fr', gap:24 }}>
          {/* Columna izquierda: plantillas */}
          <div>
            <div style={{ fontSize:11, fontWeight:600, color:COLORS.slate500, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>1. Plantilla ({plantillas.length})</div>
            <div style={{ display:'grid', gap:8, maxHeight:500, overflow:'auto' }}>
              {plantillas.map(p => {
                const sel = plantillaSeleccionada?.id === p.id
                return (
                  <div key={p.id} onClick={() => setPlantillaSeleccionada(p)} style={{ padding:14, background: sel?COLORS.tealLight:'white', border:`1.5px solid ${sel?COLORS.teal:COLORS.slate100}`, borderRadius:10, cursor:'pointer', transition:'all 0.15s' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                      <span style={{ fontSize:10, fontFamily:'var(--font-mono)', color:COLORS.slate400, fontWeight:600 }}>{p.codigo}</span>
                      {p.duracion_estimada_dias && <span style={{ fontSize:10, color:COLORS.slate500, background:COLORS.slate50, padding:'2px 6px', borderRadius:10 }}>~{p.duracion_estimada_dias} días</span>}
                      {p.capacidad_mw_min !== null && p.capacidad_mw_max !== null && <span style={{ fontSize:10, color:COLORS.slate500, background:COLORS.slate50, padding:'2px 6px', borderRadius:10 }}>{p.capacidad_mw_min}-{p.capacidad_mw_max} MW</span>}
                      {p.capacidad_mw_min !== null && p.capacidad_mw_max === null && <span style={{ fontSize:10, color:COLORS.slate500, background:COLORS.slate50, padding:'2px 6px', borderRadius:10 }}>&gt;{p.capacidad_mw_min} MW</span>}
                      {p.capacidad_mw_min === null && p.capacidad_mw_max !== null && <span style={{ fontSize:10, color:COLORS.slate500, background:COLORS.slate50, padding:'2px 6px', borderRadius:10 }}>&lt;{p.capacidad_mw_max} MW</span>}
                    </div>
                    <div style={{ fontSize:13, fontWeight:600, color:COLORS.ink, marginBottom:4 }}>{p.nombre}</div>
                    <div style={{ fontSize:11, color:COLORS.slate500, lineHeight:1.4 }}>{p.descripcion}</div>
                    {p.base_legal && <div style={{ fontSize:10, color:COLORS.teal, marginTop:6, display:'flex', alignItems:'center', gap:4 }}><Icon.Scale/> {p.base_legal}</div>}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Columna derecha: datos + preview */}
          <div>
            <div style={{ fontSize:11, fontWeight:600, color:COLORS.slate500, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>2. Datos del proyecto</div>

            <div style={{ marginBottom:12 }}>
              <label style={labelStyle}>Nombre del proyecto *</label>
              <input value={form.nombre} onChange={e=>setForm({...form, nombre:e.target.value})} placeholder="Ej: Autoconsumo Intel Querétaro 15 MW" style={inputStyle}/>
            </div>

            <div style={{ marginBottom:12 }}>
              <label style={labelStyle}>Cliente *</label>
              <select value={form.clienteId} onChange={e=>setForm({...form, clienteId:e.target.value})} style={selectStyle}>
                <option value="">Selecciona cliente...</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.razon_social}</option>)}
              </select>
            </div>

            <div style={{ marginBottom:12 }}>
              <label style={labelStyle}>Director de proyecto *</label>
              <select value={form.directorId} onChange={e=>setForm({...form, directorId:e.target.value})} style={selectStyle}>
                <option value="">Selecciona director...</option>
                {usuarios.filter(u => ['direccion','director_proyectos'].includes(u.rol)).map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
              </select>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
              <div>
                <label style={labelStyle}>Capacidad (MW)</label>
                <input type="number" step="0.1" value={form.capacidadMw} onChange={e=>setForm({...form, capacidadMw:e.target.value})} placeholder="Ej: 15" style={inputStyle}/>
              </div>
              <div>
                <label style={labelStyle}>Fecha inicio</label>
                <input type="date" value={form.inicioFecha} onChange={e=>setForm({...form, inicioFecha:e.target.value})} style={inputStyle}/>
              </div>
            </div>

            <div style={{ marginBottom:12 }}>
              <label style={labelStyle}>Ubicación</label>
              <input value={form.ubicacion} onChange={e=>setForm({...form, ubicacion:e.target.value})} placeholder="Ej: Querétaro, MX" style={inputStyle}/>
            </div>

            {plantillaActs.length > 0 && (
              <div style={{ marginTop:18, padding:14, background:COLORS.slate50, borderRadius:10, border:`1px solid ${COLORS.slate100}` }}>
                <div style={{ fontSize:11, fontWeight:600, color:COLORS.slate500, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>Vista previa ({plantillaActs.length} actividades)</div>
                <div style={{ maxHeight:180, overflow:'auto' }}>
                  {plantillaActs.map(a => (
                    <div key={a.orden} style={{ padding:'6px 0', fontSize:12, display:'flex', gap:8, alignItems:'center', borderBottom:`1px solid ${COLORS.slate100}` }}>
                      <span style={{ fontSize:10, fontFamily:'var(--font-mono)', color:COLORS.slate400, minWidth:20 }}>#{a.orden}</span>
                      {a.es_milestone && <span style={{ color:COLORS.navy }}><Icon.Diamond/></span>}
                      <span style={{ flex:1, color:COLORS.ink, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.nombre}</span>
                      <span style={{ fontSize:10, color:COLORS.slate500, fontFamily:'var(--font-mono)' }}>{a.duracion_dias}d</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={{ padding:'16px 28px', borderTop:`1px solid ${COLORS.slate100}`, display:'flex', justifyContent:'flex-end', gap:10 }}>
          <button onClick={onClose} style={{ padding:'10px 18px', background:'transparent', color:COLORS.slate600, border:`1px solid ${COLORS.slate200}`, borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer' }}>Cancelar</button>
          <button onClick={crear} disabled={!plantillaSeleccionada || !form.nombre || !form.clienteId || creando} style={{ padding:'10px 22px', background: (!plantillaSeleccionada || !form.nombre || !form.clienteId) ? COLORS.slate200 : COLORS.navy, color:'white', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor: creando?'wait':'pointer' }}>
            {creando ? 'Creando...' : 'Crear proyecto'}
          </button>
        </div>
      </div>
    </>
  )
}

const labelStyle = { fontSize:11, fontWeight:600, color:COLORS.slate500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:6 }
const inputStyle = { width:'100%', padding:'10px 12px', border:`1px solid ${COLORS.slate200}`, borderRadius:8, fontSize:13, outline:'none', fontFamily:'var(--font-sans)', boxSizing:'border-box' }
const selectStyle = { ...inputStyle, background:'white', cursor:'pointer' }

// ============================================================
// DETALLE DE PROYECTO (conectado a Supabase)
// ============================================================
function DetalleProyecto({ proyectoId, onVolver }) {
  const [proyecto, setProyecto] = useState(null)
  const [tab, setTab] = useState('resumen')
  const [desglosarAct, setDesglosarAct] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getProyectoConActividades(proyectoId).then(p => { setProyecto(p); setLoading(false) })
  }, [proyectoId])

  if (loading) return <div style={{ padding:40, textAlign:'center', color:COLORS.slate400 }}>Cargando proyecto...</div>
  if (!proyecto) return <div style={{ padding:40, textAlign:'center', color:COLORS.red }}>Proyecto no encontrado</div>

  const actividades = proyecto.actividades || []
  const avanceGeneral = actividades.length > 0 ? Math.round(actividades.filter(a => !a.parent_id).reduce((s,a) => s+(a.avance||0), 0) / Math.max(1, actividades.filter(a => !a.parent_id).length)) : 0

  const updateActividadLocal = async (id, cambios) => {
    await actualizarActividad(id, cambios)
    setProyecto(p => ({ ...p, actividades: p.actividades.map(a => a.id === id ? {...a, ...cambios} : a) }))
  }

  const toggleActividad = async (a) => {
    const nueva = { completada: !a.completada, avance: !a.completada ? 100 : 0, estado: !a.completada ? 'Completada' : 'Sin iniciar' }
    await updateActividadLocal(a.id, nueva)
  }

  const agregarAct = async () => {
    const hoy = new Date().toISOString().split('T')[0]
    const nueva = { nombre:'Nueva actividad', fase:'General', inicio:hoy, fin:addDays(hoy, 7), avance:0, estado:'Sin iniciar', prioridad:'Media', deps:[], es_milestone:false, completada:false, tags:[], horas_estimadas:0, horas_reales:0, checklist:[] }
    const creada = await crearActividad(proyectoId, nueva)
    setProyecto(p => ({ ...p, actividades: [...p.actividades, creada] }))
  }

  return (
    <div>
      <div style={{ display:'flex', alignItems:'flex-start', gap:16, marginBottom:24 }}>
        <button onClick={onVolver} style={{ padding:'8px 12px', background:'white', border:`1px solid ${COLORS.slate200}`, borderRadius:8, fontSize:13, cursor:'pointer', color:COLORS.slate600, display:'flex', alignItems:'center', gap:6, fontWeight:500 }}><Icon.Back/> Proyectos</button>
        <div style={{ flex:1 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
            <span style={{ fontSize:11, fontFamily:'var(--font-mono)', color:COLORS.slate400, fontWeight:500 }}>{proyecto.codigo}</span>
            <Badge texto={proyecto.estado} mapa={ESTADOS_PROY}/>
          </div>
          <h1 style={{ fontSize:28, fontWeight:500, color:COLORS.navy, margin:0, letterSpacing:'-0.02em', fontFamily:'var(--font-serif)', lineHeight:1.15 }}>{proyecto.nombre}</h1>
          <p style={{ fontSize:13, color:COLORS.slate500, margin:'4px 0 0' }}>{proyecto.cliente?.razon_social || 'Sin cliente'} · Director: {proyecto.director?.nombre || 'Sin asignar'}</p>
        </div>
      </div>

      <div style={{ display:'flex', borderBottom:`1px solid ${COLORS.slate200}`, marginBottom:24, gap:2 }}>
        {[{k:'resumen',l:'Resumen'},{k:'actividades',l:'Actividades'},{k:'gantt',l:'Gantt'}].map(t => (
          <button key={t.k} onClick={()=>setTab(t.k)} style={{ padding:'10px 16px', border:'none', background:'transparent', cursor:'pointer', fontSize:13, fontWeight: tab===t.k?600:500, color: tab===t.k?COLORS.navy:COLORS.slate500, borderBottom: tab===t.k?`2px solid ${COLORS.navy}`:'2px solid transparent', marginBottom:-1 }}>{t.l}</button>
        ))}
      </div>

      {tab === 'resumen' && (
        <div style={{ display:'grid', gridTemplateColumns:'1.3fr 1fr', gap:20 }}>
          <div style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, padding:24 }}>
            <h3 style={{ fontSize:11, fontWeight:600, color:COLORS.slate500, marginBottom:16, textTransform:'uppercase', letterSpacing:'0.08em' }}>Información general</h3>
            <Row label="Cliente">{proyecto.cliente?.razon_social || '—'}</Row>
            <Row label="Director">{proyecto.director?.nombre || '—'}</Row>
            <Row label="Estado"><Badge texto={proyecto.estado} mapa={ESTADOS_PROY}/></Row>
            <Row label="Capacidad">{proyecto.capacidad_mw ? `${proyecto.capacidad_mw} MW` : '—'}</Row>
            <Row label="Ubicación">{proyecto.ubicacion || '—'}</Row>
            <Row label="Inicio"><span style={{ fontFamily:'var(--font-mono)' }}>{proyecto.inicio}</span></Row>
            <Row label="Cierre estimado" last><span style={{ fontFamily:'var(--font-mono)' }}>{proyecto.cierre}</span></Row>
          </div>
          <div>
            <div style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, padding:28, textAlign:'center', marginBottom:16 }}>
              <h3 style={{ fontSize:11, fontWeight:600, color:COLORS.slate500, marginBottom:16, textTransform:'uppercase', letterSpacing:'0.08em' }}>Avance general</h3>
              <div style={{ fontSize:52, fontWeight:400, color:COLORS.navy, fontFamily:'var(--font-serif)', lineHeight:1, marginBottom:12 }}>{avanceGeneral}%</div>
              <BarraAvance avance={avanceGeneral}/>
              <div style={{ fontSize:11, color:COLORS.slate400, marginTop:12 }}>{actividades.filter(a=>a.completada).length} de {actividades.length} actividades completadas</div>
            </div>
            <div style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, padding:20 }}>
              <h3 style={{ fontSize:11, fontWeight:600, color:COLORS.slate500, marginBottom:14, textTransform:'uppercase', letterSpacing:'0.08em' }}>Alcance</h3>
              <p style={{ fontSize:13, color:COLORS.slate600, lineHeight:1.6, margin:0 }}>{proyecto.alcance}</p>
            </div>
          </div>
        </div>
      )}

      {tab === 'actividades' && (
        <div style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, overflow:'hidden' }}>
          <div style={{ display:'grid', gridTemplateColumns:'50px 30px 1fr 120px 100px 100px 110px 110px 50px', padding:'11px 16px', background:COLORS.slate50, borderBottom:`1px solid ${COLORS.slate100}`, fontSize:10, fontWeight:600, color:COLORS.slate500, textTransform:'uppercase', letterSpacing:'0.07em' }}>
            <div>ID</div><div></div><div>Actividad</div><div>Fase</div><div>Inicio</div><div>Fin</div><div>Avance</div><div>Estado</div><div></div>
          </div>
          {actividades.map(a => {
            const esPadre = a.es_servicio_padre
            const esHijo = a.parent_id != null
            return (
              <div key={a.id} style={{ display:'grid', gridTemplateColumns:'50px 30px 1fr 120px 100px 100px 110px 110px 50px', padding:'10px 16px', borderBottom:`1px solid ${COLORS.slate100}`, alignItems:'center', background: a.completada ? '#FCFCFD' : (esPadre ? '#FAFBFE' : 'white'), opacity: a.completada ? 0.7 : 1 }}>
                <div style={{ fontSize:10, fontFamily:'var(--font-mono)', color:COLORS.slate400, fontWeight:500 }}>#{a.numero}</div>
                <div onClick={() => toggleActividad(a)} style={{ width:17, height:17, borderRadius:5, border:`1.5px solid ${a.completada?COLORS.teal:'#CBD5E1'}`, background:a.completada?COLORS.teal:'white', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'white' }}>{a.completada && <Icon.Check/>}</div>
                <div style={{ display:'flex', alignItems:'center', gap:6, minWidth:0, paddingLeft: esHijo ? 24 : 0 }}>
                  {a.es_milestone && <span style={{ color:COLORS.navy }}><Icon.Diamond/></span>}
                  <span style={{ fontSize:13, color:COLORS.ink, fontWeight: esPadre ? 600 : 400, textDecoration: a.completada?'line-through':'none', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.nombre}</span>
                  {a.base_legal && <span title={a.base_legal} style={{ color:COLORS.teal, fontSize:11, cursor:'help', display:'flex' }}><Icon.Scale/></span>}
                </div>
                <div style={{ fontSize:11, color:COLORS.slate500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.fase}</div>
                <div style={{ fontSize:11, color:COLORS.slate500, fontFamily:'var(--font-mono)' }}>{a.inicio}</div>
                <div style={{ fontSize:11, color:COLORS.slate500, fontFamily:'var(--font-mono)' }}>{a.fin}</div>
                <div><BarraAvance avance={a.avance}/></div>
                <div><Badge texto={a.estado} mapa={ESTADOS}/></div>
                <div>
                  {esPadre && <button onClick={() => setDesglosarAct(a)} title="Desglosar con plantilla LSE" style={{ padding:'4px 8px', background:COLORS.tealLight, color:COLORS.teal, border:'none', borderRadius:6, fontSize:10, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:3 }}><Icon.Scale/> Desglosar</button>}
                </div>
              </div>
            )
          })}
          <button onClick={agregarAct} style={{ width:'100%', padding:'12px 16px', background:'transparent', border:'none', fontSize:12, color:COLORS.slate500, cursor:'pointer', display:'flex', alignItems:'center', gap:8 }}><Icon.Plus/> Agregar actividad</button>
        </div>
      )}

      {desglosarAct && <ModalDesglose actividad={desglosarAct} onClose={() => setDesglosarAct(null)} onDesglosado={() => { setDesglosarAct(null); getProyectoConActividades(proyectoId).then(setProyecto) }}/>}

      {tab === 'gantt' && (
        <div style={{ padding:40, textAlign:'center', background:'white', borderRadius:12, border:`1px solid ${COLORS.slate100}`, color:COLORS.slate500 }}>
          <p style={{ fontSize:13 }}>Vista Gantt conectada a DB — se refinará en próxima iteración de Semana 1.</p>
          <p style={{ fontSize:12, color:COLORS.slate400 }}>Por ahora usa la pestaña Actividades para gestionar el proyecto.</p>
        </div>
      )}
    </div>
  )
}

function Row({ label, children, last }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 0', borderBottom: last ? 'none' : `1px solid ${COLORS.slate100}` }}>
      <span style={{ fontSize:12, color:COLORS.slate500 }}>{label}</span>
      <span style={{ fontSize:13, fontWeight:500, color:COLORS.ink }}>{children}</span>
    </div>
  )
}

function ModalDesglose({ actividad, onClose, onDesglosado }) {
  const [plantillas, setPlantillas] = useState([])
  const [plantillaSel, setPlantillaSel] = useState(null)
  const [plantillaActs, setPlantillaActs] = useState([])
  const [desglosando, setDesglosando] = useState(false)

  useEffect(() => { getPlantillas().then(setPlantillas) }, [])
  useEffect(() => { if (plantillaSel) getPlantillaActividades(plantillaSel.id).then(setPlantillaActs); else setPlantillaActs([]) }, [plantillaSel])

  const desglosar = async () => {
    if (!plantillaSel) return
    if (!confirm(`Se generarán ${plantillaActs.length} actividades específicas bajo "${actividad.nombre}". Si ya había actividades hijas, serán reemplazadas. ¿Continuar?`)) return
    setDesglosando(true)
    try {
      const n = await desglosarActividadConPlantilla(actividad.id, plantillaSel.id)
      alert(`✓ Se generaron ${n} actividades específicas`)
      onDesglosado()
    } catch (e) { alert('Error: ' + e.message); setDesglosando(false) }
  }

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(10,37,64,0.35)', zIndex:999 }}/>
      <div style={{ position:'fixed', top:'5%', left:'50%', transform:'translateX(-50%)', width:'min(880px, 95vw)', maxHeight:'90vh', background:'white', borderRadius:16, zIndex:1000, display:'flex', flexDirection:'column' }}>
        <div style={{ padding:'20px 28px', borderBottom:`1px solid ${COLORS.slate100}`, display:'flex', justifyContent:'space-between' }}>
          <div>
            <h2 style={{ fontSize:20, fontWeight:500, margin:0, color:COLORS.navy, fontFamily:'var(--font-serif)' }}>Desglosar con plantilla LSE</h2>
            <p style={{ fontSize:12, color:COLORS.slate500, margin:'4px 0 0' }}>Genera las actividades específicas para: <strong>{actividad.nombre}</strong></p>
          </div>
          <button onClick={onClose} style={{ border:'none', background:'transparent', cursor:'pointer' }}><Icon.X/></button>
        </div>
        <div style={{ flex:1, overflow:'auto', padding:24, display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
          <div>
            <div style={{ fontSize:11, fontWeight:600, color:COLORS.slate500, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>Elige plantilla ({plantillas.length})</div>
            <div style={{ display:'grid', gap:6, maxHeight:500, overflow:'auto' }}>
              {plantillas.map(p => (
                <div key={p.id} onClick={() => setPlantillaSel(p)} style={{ padding:12, background: plantillaSel?.id === p.id ? COLORS.tealLight : 'white', border:`1.5px solid ${plantillaSel?.id === p.id ? COLORS.teal : COLORS.slate100}`, borderRadius:8, cursor:'pointer' }}>
                  <div style={{ fontSize:10, fontFamily:'var(--font-mono)', color:COLORS.slate400, marginBottom:3 }}>{p.codigo}</div>
                  <div style={{ fontSize:12, fontWeight:600, color:COLORS.ink }}>{p.nombre}</div>
                  <div style={{ fontSize:10, color:COLORS.slate500, marginTop:4 }}>{p.descripcion?.substring(0, 80)}...</div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize:11, fontWeight:600, color:COLORS.slate500, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 }}>
              {plantillaSel ? `Se generarán ${plantillaActs.length} actividades` : 'Selecciona una plantilla'}
            </div>
            {plantillaActs.length > 0 && (
              <div style={{ padding:14, background:COLORS.slate50, borderRadius:10, maxHeight:440, overflow:'auto' }}>
                {plantillaActs.map(a => (
                  <div key={a.orden} style={{ padding:'8px 0', fontSize:12, borderBottom:`1px solid ${COLORS.slate100}` }}>
                    <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                      <span style={{ fontSize:10, fontFamily:'var(--font-mono)', color:COLORS.slate400, minWidth:20 }}>#{a.orden}</span>
                      {a.es_milestone && <span style={{ color:COLORS.navy }}><Icon.Diamond/></span>}
                      <span style={{ flex:1, color:COLORS.ink, fontWeight:500 }}>{a.nombre}</span>
                      <span style={{ fontSize:10, color:COLORS.slate500, fontFamily:'var(--font-mono)' }}>{a.duracion_dias}d</span>
                    </div>
                    {a.base_legal && <div style={{ fontSize:10, color:COLORS.teal, marginLeft:28, marginTop:2 }}>⚖ {a.base_legal}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div style={{ padding:'16px 28px', borderTop:`1px solid ${COLORS.slate100}`, display:'flex', justifyContent:'flex-end', gap:10 }}>
          <button onClick={onClose} style={{ padding:'10px 18px', background:'transparent', border:`1px solid ${COLORS.slate200}`, borderRadius:8, fontSize:13, cursor:'pointer' }}>Cancelar</button>
          <button onClick={desglosar} disabled={!plantillaSel || desglosando} style={{ padding:'10px 22px', background: !plantillaSel ? COLORS.slate200 : COLORS.navy, color:'white', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor: desglosando ? 'wait' : 'pointer' }}>{desglosando ? 'Generando...' : 'Desglosar'}</button>
        </div>
      </div>
    </>
  )
}

// ============================================================
// LISTA DE PROYECTOS (conectado a DB)
// ============================================================
export default function Proyectos({ usuario }) {
  const [proyectos, setProyectos] = useState([])
  const [loading, setLoading] = useState(true)
  const [proyectoSeleccionadoId, setProyectoSeleccionadoId] = useState(null)
  const [modalNuevo, setModalNuevo] = useState(false)

  const cargar = async () => {
    setLoading(true)
    const data = await getProyectos()
    setProyectos(data)
    setLoading(false)
  }

  useEffect(() => { cargar() }, [])

  if (proyectoSeleccionadoId) return <DetalleProyecto proyectoId={proyectoSeleccionadoId} onVolver={() => { setProyectoSeleccionadoId(null); cargar() }}/>

  return (
    <div>
      {modalNuevo && <ModalNuevoProyecto onClose={() => setModalNuevo(false)} onCreado={(p) => { setModalNuevo(false); cargar(); setProyectoSeleccionadoId(p.id) }}/>}

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:28 }}>
        <div>
          <h1 style={{ fontSize:32, fontWeight:400, color:COLORS.navy, margin:0, letterSpacing:'-0.02em', fontFamily:'var(--font-serif)' }}>Proyectos</h1>
          <p style={{ color:COLORS.slate500, fontSize:13, marginTop:6 }}>{proyectos.length} proyecto{proyectos.length!==1?'s':''} en el sistema</p>
        </div>
        <button onClick={() => setModalNuevo(true)} style={{ padding:'10px 20px', background:COLORS.navy, color:'white', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
          <Icon.Plus/> Nuevo proyecto
        </button>
      </div>

      {loading && <div style={{ padding:40, textAlign:'center', color:COLORS.slate400, fontSize:13 }}>Cargando proyectos desde Supabase...</div>}

      {!loading && proyectos.length === 0 && (
        <div style={{ padding:'60px 30px', background:'white', border:`1px dashed ${COLORS.slate200}`, borderRadius:12, textAlign:'center' }}>
          <div style={{ fontSize:14, color:COLORS.slate500, marginBottom:6 }}>Todavía no hay proyectos</div>
          <div style={{ fontSize:12, color:COLORS.slate400, marginBottom:18 }}>Crea tu primer proyecto desde una plantilla LSE 2025</div>
          <button onClick={() => setModalNuevo(true)} style={{ padding:'10px 20px', background:COLORS.navy, color:'white', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer' }}>+ Crear primer proyecto</button>
        </div>
      )}

      {!loading && proyectos.length > 0 && (
        <div style={{ display:'grid', gap:10 }}>
          {proyectos.map(p => (
            <div key={p.id} onClick={() => setProyectoSeleccionadoId(p.id)}
              style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderLeft:`3px solid ${ESTADOS_PROY[p.estado]?.bar || COLORS.slate400}`, borderRadius:12, padding:'18px 22px', cursor:'pointer', transition:'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow='0 4px 16px rgba(10,37,64,0.06)' }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow='none' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                    <span style={{ fontSize:11, fontFamily:'var(--font-mono)', color:COLORS.slate400, fontWeight:500 }}>{p.codigo}</span>
                    <Badge texto={p.estado} mapa={ESTADOS_PROY}/>
                  </div>
                  <div style={{ fontSize:17, fontWeight:500, color:COLORS.ink, marginBottom:3 }}>{p.nombre}</div>
                  <div style={{ fontSize:12, color:COLORS.slate500 }}>
                    {p.cliente?.razon_social || 'Sin cliente'}
                    {p.director?.nombre && ` · ${p.director.nombre}`}
                    {p.capacidad_mw && ` · ${p.capacidad_mw} MW`}
                  </div>
                </div>
                <div style={{ fontSize:11, color:COLORS.slate400, fontFamily:'var(--font-mono)' }}>Cierre: {p.cierre}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}