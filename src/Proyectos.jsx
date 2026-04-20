import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase, getProyectos, getProyectoConActividades, getUsuarios, getClientes, getPlantillas, getPlantillaActividades, crearProyectoDesdePlantilla, actualizarActividad, crearActividad, desglosarActividadConPlantilla } from './supabase'

const COLORS = {
  navy:'#0A2540', navy2:'#1B3A6B', teal:'#0F6E56', tealLight:'#E1F5EE',
  gold:'#C89B3C', red:'#DC2626', amber:'#D97706', purple:'#6B4C9A',
  blue:'#3B82F6', green:'#10B981',
  slate50:'#F8FAFC', slate100:'#F1F5F9', slate200:'#E2E8F0',
  slate400:'#94A3B8', slate500:'#64748B', slate600:'#475569', ink:'#1C2128'
}

const ESTADOS = {
  'Completada': { bg:'#E1F5EE', color:'#0F6E56', bar:'#10B981', gradient:'linear-gradient(135deg, #10B981 0%, #059669 100%)' },
  'En progreso': { bg:'#E0EDFF', color:'#1B3A6B', bar:'#3B82F6', gradient:'linear-gradient(135deg, #60A5FA 0%, #3B82F6 100%)' },
  'Sin iniciar': { bg:'#F1F5F9', color:'#64748B', bar:'#94A3B8', gradient:'linear-gradient(135deg, #CBD5E1 0%, #94A3B8 100%)' },
  'Retrasada': { bg:'#FEF2F2', color:'#DC2626', bar:'#EF4444', gradient:'linear-gradient(135deg, #F87171 0%, #DC2626 100%)' },
  'Bloqueada': { bg:'#FEF3C7', color:'#D97706', bar:'#F59E0B', gradient:'linear-gradient(135deg, #FBBF24 0%, #D97706 100%)' }
}

const ESTADOS_PROY = {
  'En curso': { bg:'#E0EDFF', color:'#1B3A6B', bar:'#1B3A6B' },
  'Terminado': { bg:'#E1F5EE', color:'#0F6E56', bar:'#0F6E56' },
  'Por iniciar': { bg:'#FEF3C7', color:'#D97706', bar:'#D97706' },
  'En pausa': { bg:'#FEF2F2', color:'#DC2626', bar:'#DC2626' },
  'Cancelado': { bg:'#FEF2F2', color:'#DC2626', bar:'#DC2626' }
}

const toDate = s => s ? new Date(s + 'T00:00:00') : new Date()
const toStr = d => d.toISOString().split('T')[0]
const addDays = (s, n) => { const d = toDate(s); d.setDate(d.getDate()+n); return toStr(d) }
const diffDays = (a, b) => Math.round((toDate(b) - toDate(a)) / 86400000)

const Icon = {
  Back:()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>,
  Plus:()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 5v14M5 12h14"/></svg>,
  X:()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>,
  Check:()=><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5"><path d="M20 6 9 17l-5-5"/></svg>,
  Search:()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>,
  Filter:()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>,
  Diamond:()=><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2 22 12 12 22 2 12z"/></svg>,
  Scale:()=><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10M12 3v18M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/></svg>,
  Archive:()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="5" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M10 12h4"/></svg>,
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

function useIsMobile() {
  const [m, setM] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false)
  useEffect(() => { const h = () => setM(window.innerWidth < 768); window.addEventListener('resize', h); return () => window.removeEventListener('resize', h) }, [])
  return m
}

// ============================================================
// GANTT PROFESIONAL MODERNO
// ============================================================
function GanttModerno({ actividades, onActividadClick }) {
  const containerRef = useRef(null)
  const [hoveredId, setHoveredId] = useState(null)

  const DAY_WIDTH = 32
  const ROW_HEIGHT = 42
  const HEADER_HEIGHT = 60
  const LEFT_PANEL = 280

  const fechaInicio = useMemo(() => {
    if (actividades.length === 0) return toDate(toStr(new Date()))
    const min = actividades.reduce((m, a) => a.inicio < m ? a.inicio : m, actividades[0].inicio)
    const d = toDate(min); d.setDate(d.getDate() - 3); return d
  }, [actividades])

  const fechaFin = useMemo(() => {
    if (actividades.length === 0) { const d = new Date(); d.setDate(d.getDate() + 90); return d }
    const max = actividades.reduce((m, a) => a.fin > m ? a.fin : m, actividades[0].fin)
    const d = toDate(max); d.setDate(d.getDate() + 7); return d
  }, [actividades])

  const totalDias = diffDays(toStr(fechaInicio), toStr(fechaFin))
  const totalWidth = totalDias * DAY_WIDTH
  const hoy = toStr(new Date())

  // Generar array de días para header
  const dias = useMemo(() => {
    const arr = []
    for (let i = 0; i <= totalDias; i++) {
      const d = new Date(fechaInicio); d.setDate(d.getDate() + i)
      arr.push(d)
    }
    return arr
  }, [fechaInicio, totalDias])

  // Agrupar por mes para el header superior
  const meses = useMemo(() => {
    const arr = []
    let currentMes = null
    dias.forEach((d, i) => {
      const key = `${d.getFullYear()}-${d.getMonth()}`
      if (key !== currentMes) {
        arr.push({ key, label: d.toLocaleDateString('es-MX', { month:'long', year:'numeric' }), inicio: i, dias: 1 })
        currentMes = key
      } else arr[arr.length-1].dias++
    })
    return arr
  }, [dias])

  const getPositionX = fecha => diffDays(toStr(fechaInicio), fecha) * DAY_WIDTH
  const getWidth = (inicio, fin) => Math.max((diffDays(inicio, fin) + 1) * DAY_WIDTH, DAY_WIDTH)

  // Ordenar: padres primero con sus hijos debajo
  const actOrdenadas = useMemo(() => {
    const padres = actividades.filter(a => !a.parent_id)
    const result = []
    padres.forEach(p => {
      result.push(p)
      actividades.filter(a => a.parent_id === p.id).forEach(h => result.push(h))
    })
    // Actividades sin parent_id que tampoco son padres (casos raros)
    actividades.filter(a => !a.parent_id && !padres.find(p => p.id === a.id)).forEach(a => result.push(a))
    return result
  }, [actividades])

  // Calcular dependencias como paths SVG curvos
  const dependencias = useMemo(() => {
    const deps = []
    actOrdenadas.forEach((act, rowIdx) => {
      if (!act.deps || act.deps.length === 0) return
      act.deps.forEach(dep => {
        // Intentar encontrar la actividad predecesora
        let predId = dep.id || dep.orden_plantilla
        let pred = actOrdenadas.find(a => a.id === predId || a.numero === predId)
        if (!pred) return
        const predIdx = actOrdenadas.indexOf(pred)
        deps.push({
          fromX: getPositionX(pred.fin) + getWidth(pred.inicio, pred.fin) - DAY_WIDTH + DAY_WIDTH,
          fromY: predIdx * ROW_HEIGHT + ROW_HEIGHT/2,
          toX: getPositionX(act.inicio),
          toY: rowIdx * ROW_HEIGHT + ROW_HEIGHT/2,
          fromId: pred.id, toId: act.id
        })
      })
    })
    return deps
  }, [actOrdenadas])

  if (actividades.length === 0) {
    return <div style={{ padding:60, textAlign:'center', color:COLORS.slate400, background:'white', borderRadius:12, border:`1px solid ${COLORS.slate100}` }}>
      No hay actividades aún. Agrega la primera desde la pestaña "Actividades".
    </div>
  }

  return (
    <div ref={containerRef} style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, overflow:'hidden', position:'relative' }}>
      <div style={{ display:'flex', overflow:'hidden' }}>
        {/* PANEL IZQUIERDO — Lista de actividades */}
        <div style={{ width:LEFT_PANEL, flexShrink:0, borderRight:`2px solid ${COLORS.slate100}`, background:'white', zIndex:2 }}>
          {/* Header del panel */}
          <div style={{ height:HEADER_HEIGHT, borderBottom:`1px solid ${COLORS.slate100}`, display:'flex', alignItems:'flex-end', padding:'0 16px 12px', background:COLORS.slate50 }}>
            <span style={{ fontSize:10, fontWeight:700, color:COLORS.slate500, textTransform:'uppercase', letterSpacing:'0.1em' }}>Actividad</span>
          </div>
          {/* Filas */}
          {actOrdenadas.map((act, idx) => {
            const esPadre = act.es_servicio_padre
            const esHijo = act.parent_id != null
            return (
              <div key={act.id} onClick={() => onActividadClick?.(act)} onMouseEnter={() => setHoveredId(act.id)} onMouseLeave={() => setHoveredId(null)}
                style={{
                  height:ROW_HEIGHT, borderBottom:`1px solid ${COLORS.slate100}`,
                  display:'flex', alignItems:'center', padding:'0 16px',
                  paddingLeft: esHijo ? 36 : 16,
                  cursor:'pointer',
                  background: hoveredId === act.id ? COLORS.slate50 : (esPadre ? '#FAFBFE' : 'white'),
                  transition:'background 0.1s',
                }}>
                <span style={{ fontSize:10, fontFamily:'var(--font-mono)', color:COLORS.slate400, minWidth:24 }}>#{act.numero}</span>
                {act.es_milestone && <span style={{ color:COLORS.navy, marginRight:6 }}><Icon.Diamond/></span>}
                <span style={{ fontSize:12, color:COLORS.ink, fontWeight: esPadre ? 600 : 400, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>{act.nombre}</span>
              </div>
            )
          })}
        </div>

        {/* PANEL DERECHO — Timeline */}
        <div style={{ flex:1, overflowX:'auto', overflowY:'hidden' }}>
          <div style={{ width:totalWidth, position:'relative' }}>
            {/* Header: meses y días */}
            <div style={{ position:'sticky', top:0, zIndex:3, background:COLORS.slate50, borderBottom:`1px solid ${COLORS.slate100}` }}>
              {/* Fila de meses */}
              <div style={{ display:'flex', height:HEADER_HEIGHT/2, borderBottom:`1px solid ${COLORS.slate100}` }}>
                {meses.map(m => (
                  <div key={m.key} style={{
                    width: m.dias * DAY_WIDTH,
                    borderRight: `1px solid ${COLORS.slate200}`,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:12, fontWeight:600, color:COLORS.navy, textTransform:'capitalize',
                    background:'white'
                  }}>{m.label}</div>
                ))}
              </div>
              {/* Fila de días */}
              <div style={{ display:'flex', height:HEADER_HEIGHT/2 }}>
                {dias.map((d, i) => {
                  const isWeekend = d.getDay() === 0 || d.getDay() === 6
                  const isToday = toStr(d) === hoy
                  return (
                    <div key={i} style={{
                      width: DAY_WIDTH, flexShrink:0,
                      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                      background: isToday ? COLORS.tealLight : (isWeekend ? '#F8FAFC' : 'white'),
                      borderRight:`1px solid ${COLORS.slate100}`,
                      fontSize:10, color: isToday ? COLORS.teal : COLORS.slate500, fontWeight: isToday ? 700 : 500,
                      fontFamily:'var(--font-mono)',
                    }}>
                      <div style={{ fontSize:9, opacity:0.7 }}>{['D','L','M','M','J','V','S'][d.getDay()]}</div>
                      <div>{d.getDate()}</div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Grid de fondo (weekends + today line) */}
            <div style={{ position:'absolute', top:HEADER_HEIGHT, left:0, right:0, height: actOrdenadas.length * ROW_HEIGHT, pointerEvents:'none' }}>
              {dias.map((d, i) => {
                const isWeekend = d.getDay() === 0 || d.getDay() === 6
                if (!isWeekend) return null
                return <div key={i} style={{ position:'absolute', left: i*DAY_WIDTH, top:0, width:DAY_WIDTH, height:'100%', background:'rgba(241, 245, 249, 0.4)' }}/>
              })}
              {/* Today vertical line */}
              {(() => {
                const idx = dias.findIndex(d => toStr(d) === hoy)
                if (idx < 0) return null
                return <div style={{ position:'absolute', left: idx*DAY_WIDTH + DAY_WIDTH/2, top:0, width:2, height:'100%', background:COLORS.teal, boxShadow:`0 0 8px ${COLORS.teal}` }}/>
              })()}
            </div>

            {/* Filas con barras */}
            {actOrdenadas.map((act, idx) => {
              const estadoCfg = ESTADOS[act.estado] || ESTADOS['Sin iniciar']
              const x = getPositionX(act.inicio)
              const w = getWidth(act.inicio, act.fin)
              const esPadre = act.es_servicio_padre
              const esMilestone = act.es_milestone
              return (
                <div key={act.id} onClick={() => onActividadClick?.(act)}
                  style={{
                    height:ROW_HEIGHT, borderBottom:`1px solid ${COLORS.slate100}`,
                    position:'relative', cursor:'pointer',
                    background: hoveredId === act.id ? 'rgba(10, 37, 64, 0.02)' : 'transparent',
                  }}
                  onMouseEnter={() => setHoveredId(act.id)} onMouseLeave={() => setHoveredId(null)}
                >
                  {esMilestone ? (
                    <div style={{
                      position:'absolute', left: x + DAY_WIDTH/2 - 10, top:ROW_HEIGHT/2 - 10,
                      width:20, height:20,
                      background: estadoCfg.bar,
                      transform:'rotate(45deg)',
                      borderRadius:3,
                      boxShadow:'0 2px 6px rgba(0,0,0,0.15)',
                    }}/>
                  ) : (
                    <div style={{
                      position:'absolute', left:x, top: esPadre ? 8 : 10,
                      width:w, height: esPadre ? ROW_HEIGHT - 16 : ROW_HEIGHT - 20,
                      background: esPadre ? `linear-gradient(135deg, ${COLORS.navy} 0%, ${COLORS.navy2} 100%)` : estadoCfg.gradient,
                      borderRadius: esPadre ? 4 : 7,
                      display:'flex', alignItems:'center', padding:'0 10px', gap:8,
                      boxShadow: hoveredId === act.id ? `0 4px 12px rgba(10, 37, 64, 0.25)` : '0 1px 3px rgba(10, 37, 64, 0.1)',
                      transition:'all 0.15s',
                      overflow:'hidden',
                    }}>
                      {/* Progreso interno */}
                      {!esPadre && act.avance > 0 && (
                        <div style={{
                          position:'absolute', left:0, top:0, bottom:0,
                          width:`${act.avance}%`,
                          background:'rgba(255,255,255,0.25)',
                          borderRadius:7,
                        }}/>
                      )}
                      {/* Texto */}
                      {w > 80 && (
                        <span style={{
                          position:'relative', fontSize:11, fontWeight:600, color:'white',
                          whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                          textShadow:'0 1px 2px rgba(0,0,0,0.2)',
                        }}>
                          {act.nombre} {!esPadre && act.avance > 0 && <span style={{ opacity:0.9, fontSize:10 }}>· {act.avance}%</span>}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )
            })}

            {/* SVG overlay para dependencias (flechas curvas bezier) */}
            <svg style={{ position:'absolute', top:HEADER_HEIGHT, left:0, width:totalWidth, height: actOrdenadas.length * ROW_HEIGHT, pointerEvents:'none' }}>
              <defs>
                <marker id="arrowhead" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto" markerUnits="strokeWidth">
                  <path d="M0,0 L0,8 L6,4 z" fill={COLORS.slate400}/>
                </marker>
                <marker id="arrowhead-hover" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto" markerUnits="strokeWidth">
                  <path d="M0,0 L0,8 L6,4 z" fill={COLORS.teal}/>
                </marker>
              </defs>
              {dependencias.map((d, i) => {
                const isHovered = hoveredId === d.toId || hoveredId === d.fromId
                // Path bezier curvo elegante
                const midX = d.fromX + Math.max(20, (d.toX - d.fromX) / 2)
                const path = `M ${d.fromX} ${d.fromY}
                              C ${midX} ${d.fromY}, ${midX} ${d.toY}, ${d.toX - 4} ${d.toY}`
                return (
                  <path key={i} d={path}
                    fill="none"
                    stroke={isHovered ? COLORS.teal : COLORS.slate400}
                    strokeWidth={isHovered ? 2 : 1.5}
                    strokeDasharray={isHovered ? 'none' : '4 3'}
                    markerEnd={`url(#${isHovered ? 'arrowhead-hover' : 'arrowhead'})`}
                    style={{ transition:'all 0.15s' }}
                  />
                )
              })}
            </svg>
          </div>
        </div>
      </div>
      {/* Leyenda */}
      <div style={{ padding:'12px 20px', borderTop:`1px solid ${COLORS.slate100}`, background:COLORS.slate50, display:'flex', gap:20, flexWrap:'wrap', fontSize:11 }}>
        {Object.entries(ESTADOS).map(([key, cfg]) => (
          <div key={key} style={{ display:'flex', alignItems:'center', gap:6 }}>
            <div style={{ width:14, height:10, background:cfg.gradient, borderRadius:3 }}/>
            <span style={{ color:COLORS.slate600 }}>{key}</span>
          </div>
        ))}
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <div style={{ width:10, height:10, background:COLORS.navy, transform:'rotate(45deg)' }}/>
          <span style={{ color:COLORS.slate600 }}>Milestone</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <div style={{ width:20, height:2, background:COLORS.teal }}/>
          <span style={{ color:COLORS.slate600 }}>Hoy</span>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// MODAL NUEVO PROYECTO
// ============================================================
function ModalNuevoProyecto({ onClose, onCreado }) {
  const [plantillas, setPlantillas] = useState([])
  const [clientes, setClientes] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [plantillaSel, setPlantillaSel] = useState(null)
  const [plantillaActs, setPlantillaActs] = useState([])
  const [form, setForm] = useState({ nombre:'', clienteId:'', directorId:'', capacidadMw:'', ubicacion:'', inicioFecha: new Date().toISOString().split('T')[0] })
  const [creando, setCreando] = useState(false)
  const isMobile = useIsMobile()

  useEffect(() => {
    Promise.all([getPlantillas(), getClientes(), getUsuarios()]).then(([p, c, u]) => {
      setPlantillas(p); setClientes(c); setUsuarios(u)
      const director = u.find(x => x.rol === 'director_proyectos')
      if (director) setForm(f => ({ ...f, directorId: director.id }))
    })
  }, [])

  useEffect(() => {
    if (plantillaSel) getPlantillaActividades(plantillaSel.id).then(setPlantillaActs)
    else setPlantillaActs([])
  }, [plantillaSel])

  const crear = async () => {
    if (!plantillaSel || !form.nombre || !form.clienteId || !form.directorId) { alert('Completa todos los campos requeridos'); return }
    setCreando(true)
    try {
      const proyecto = await crearProyectoDesdePlantilla({
        plantillaId: plantillaSel.id, nombre: form.nombre, clienteId: form.clienteId, directorId: form.directorId,
        inicioFecha: form.inicioFecha,
        capacidadMw: form.capacidadMw ? parseFloat(form.capacidadMw) : null,
        ubicacion: form.ubicacion || null,
      })
      onCreado(proyecto)
    } catch (e) { alert('Error: ' + e.message); setCreando(false) }
  }

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(10,37,64,0.35)', zIndex:999 }}/>
      <div style={{
        position:'fixed', top: isMobile ? 0 : '5%', left:'50%', transform:'translateX(-50%)',
        width: isMobile ? '100%' : 'min(880px, 95vw)', maxHeight: isMobile ? '100vh' : '90vh',
        background:'white', borderRadius: isMobile ? 0 : 16, zIndex:1000, display:'flex', flexDirection:'column',
        boxShadow:'0 20px 60px rgba(10,37,64,0.2)'
      }}>
        <div style={{ padding:'18px 24px', borderBottom:`1px solid ${COLORS.slate100}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <h2 style={{ fontSize:18, fontWeight:500, color:COLORS.navy, fontFamily:'var(--font-serif)', margin:0 }}>Nuevo proyecto</h2>
            <p style={{ fontSize:11, color:COLORS.slate500, margin:'3px 0 0' }}>Basado en plantillas LSE 2025</p>
          </div>
          <button onClick={onClose} style={{ width:32, height:32, border:'none', background:COLORS.slate50, borderRadius:8, cursor:'pointer' }}><Icon.X/></button>
        </div>

        <div style={{ flex:1, overflow:'auto', padding:20, display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap:20 }}>
          <div>
            <div style={labelStyle}>1. Plantilla ({plantillas.length})</div>
            <div style={{ display:'grid', gap:6, maxHeight: isMobile ? 200 : 500, overflow:'auto' }}>
              {plantillas.map(p => (
                <div key={p.id} onClick={() => setPlantillaSel(p)} style={{ padding:12, background: plantillaSel?.id === p.id ? COLORS.tealLight : 'white', border:`1.5px solid ${plantillaSel?.id === p.id ? COLORS.teal : COLORS.slate100}`, borderRadius:10, cursor:'pointer' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:3 }}>
                    <span style={{ fontSize:9, fontFamily:'var(--font-mono)', color:COLORS.slate400, fontWeight:600 }}>{p.codigo}</span>
                    {p.duracion_estimada_dias && <span style={{ fontSize:9, color:COLORS.slate500, background:COLORS.slate50, padding:'1px 5px', borderRadius:10 }}>~{p.duracion_estimada_dias}d</span>}
                  </div>
                  <div style={{ fontSize:12, fontWeight:600, color:COLORS.ink, marginBottom:3 }}>{p.nombre}</div>
                  <div style={{ fontSize:10, color:COLORS.slate500 }}>{p.descripcion?.substring(0, 80)}...</div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div style={labelStyle}>2. Datos del proyecto</div>
            <div style={{ marginBottom:10 }}><label style={miniLabel}>Nombre *</label><input value={form.nombre} onChange={e=>setForm({...form, nombre:e.target.value})} placeholder="Ej: Autoconsumo Intel 15 MW" style={inputStyle}/></div>
            <div style={{ marginBottom:10 }}><label style={miniLabel}>Cliente *</label><select value={form.clienteId} onChange={e=>setForm({...form, clienteId:e.target.value})} style={selectStyle}><option value="">Selecciona...</option>{clientes.map(c => <option key={c.id} value={c.id}>{c.razon_social}</option>)}</select></div>
            <div style={{ marginBottom:10 }}><label style={miniLabel}>Director *</label><select value={form.directorId} onChange={e=>setForm({...form, directorId:e.target.value})} style={selectStyle}><option value="">Selecciona...</option>{usuarios.filter(u => ['direccion','director_proyectos'].includes(u.rol)).map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}</select></div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
              <div><label style={miniLabel}>MW</label><input type="number" step="0.1" value={form.capacidadMw} onChange={e=>setForm({...form, capacidadMw:e.target.value})} style={inputStyle}/></div>
              <div><label style={miniLabel}>Inicio</label><input type="date" value={form.inicioFecha} onChange={e=>setForm({...form, inicioFecha:e.target.value})} style={inputStyle}/></div>
            </div>
            <div style={{ marginBottom:10 }}><label style={miniLabel}>Ubicación</label><input value={form.ubicacion} onChange={e=>setForm({...form, ubicacion:e.target.value})} placeholder="Querétaro, MX" style={inputStyle}/></div>

            {plantillaActs.length > 0 && (
              <div style={{ marginTop:14, padding:12, background:COLORS.slate50, borderRadius:10 }}>
                <div style={{ fontSize:10, fontWeight:600, color:COLORS.slate500, textTransform:'uppercase', marginBottom:6 }}>{plantillaActs.length} actividades se generarán</div>
              </div>
            )}
          </div>
        </div>

        <div style={{ padding:'14px 24px', borderTop:`1px solid ${COLORS.slate100}`, display:'flex', justifyContent:'flex-end', gap:10 }}>
          <button onClick={onClose} style={btnSecondary}>Cancelar</button>
          <button onClick={crear} disabled={!plantillaSel || !form.nombre || !form.clienteId || creando} style={{...btnPrimary, opacity: (!plantillaSel || !form.nombre || !form.clienteId) ? 0.5 : 1 }}>{creando ? 'Creando...' : 'Crear proyecto'}</button>
        </div>
      </div>
    </>
  )
}

// ============================================================
// MODAL DESGLOSE CON PLANTILLA
// ============================================================
function ModalDesglose({ actividad, onClose, onDesglosado }) {
  const [plantillas, setPlantillas] = useState([])
  const [plantillaSel, setPlantillaSel] = useState(null)
  const [plantillaActs, setPlantillaActs] = useState([])
  const [desglosando, setDesglosando] = useState(false)
  const isMobile = useIsMobile()

  useEffect(() => { getPlantillas().then(setPlantillas) }, [])
  useEffect(() => { if (plantillaSel) getPlantillaActividades(plantillaSel.id).then(setPlantillaActs); else setPlantillaActs([]) }, [plantillaSel])

  const desglosar = async () => {
    if (!plantillaSel) return
    if (!confirm(`Se generarán ${plantillaActs.length} actividades específicas. Si ya había actividades hijas, serán reemplazadas. ¿Continuar?`)) return
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
      <div style={{ position:'fixed', top: isMobile ? 0 : '5%', left:'50%', transform:'translateX(-50%)', width: isMobile ? '100%' : 'min(880px, 95vw)', maxHeight: isMobile ? '100vh' : '90vh', background:'white', borderRadius: isMobile ? 0 : 16, zIndex:1000, display:'flex', flexDirection:'column' }}>
        <div style={{ padding:'18px 24px', borderBottom:`1px solid ${COLORS.slate100}`, display:'flex', justifyContent:'space-between' }}>
          <div>
            <h2 style={{ fontSize:18, fontWeight:500, color:COLORS.navy, fontFamily:'var(--font-serif)', margin:0 }}>Desglosar con plantilla LSE</h2>
            <p style={{ fontSize:11, color:COLORS.slate500, margin:'3px 0 0' }}>Para: <strong>{actividad.nombre}</strong></p>
          </div>
          <button onClick={onClose} style={{ border:'none', background:'transparent', cursor:'pointer' }}><Icon.X/></button>
        </div>
        <div style={{ flex:1, overflow:'auto', padding:20, display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap:16 }}>
          <div>
            <div style={labelStyle}>Plantilla</div>
            <div style={{ display:'grid', gap:6, maxHeight: isMobile ? 200 : 500, overflow:'auto' }}>
              {plantillas.map(p => (
                <div key={p.id} onClick={() => setPlantillaSel(p)} style={{ padding:10, background: plantillaSel?.id === p.id ? COLORS.tealLight : 'white', border:`1.5px solid ${plantillaSel?.id === p.id ? COLORS.teal : COLORS.slate100}`, borderRadius:8, cursor:'pointer' }}>
                  <div style={{ fontSize:9, fontFamily:'var(--font-mono)', color:COLORS.slate400, marginBottom:2 }}>{p.codigo}</div>
                  <div style={{ fontSize:12, fontWeight:600, color:COLORS.ink }}>{p.nombre}</div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div style={labelStyle}>{plantillaSel ? `Previsualización (${plantillaActs.length})` : 'Selecciona plantilla'}</div>
            {plantillaActs.length > 0 && (
              <div style={{ padding:12, background:COLORS.slate50, borderRadius:10, maxHeight: isMobile ? 300 : 500, overflow:'auto' }}>
                {plantillaActs.map(a => (
                  <div key={a.orden} style={{ padding:'6px 0', fontSize:11, borderBottom:`1px solid ${COLORS.slate100}` }}>
                    <span style={{ fontFamily:'var(--font-mono)', color:COLORS.slate400, marginRight:6 }}>#{a.orden}</span>
                    {a.es_milestone && <span style={{ color:COLORS.navy, marginRight:4 }}><Icon.Diamond/></span>}
                    <span style={{ color:COLORS.ink, fontWeight:500 }}>{a.nombre}</span>
                    <span style={{ float:'right', fontFamily:'var(--font-mono)', color:COLORS.slate500 }}>{a.duracion_dias}d</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div style={{ padding:'14px 24px', borderTop:`1px solid ${COLORS.slate100}`, display:'flex', justifyContent:'flex-end', gap:10 }}>
          <button onClick={onClose} style={btnSecondary}>Cancelar</button>
          <button onClick={desglosar} disabled={!plantillaSel || desglosando} style={{...btnPrimary, opacity: !plantillaSel ? 0.5 : 1}}>{desglosando ? 'Generando...' : 'Desglosar'}</button>
        </div>
      </div>
    </>
  )
}

const labelStyle = { fontSize:10, fontWeight:700, color:COLORS.slate500, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }
const miniLabel = { fontSize:10, fontWeight:600, color:COLORS.slate500, textTransform:'uppercase', letterSpacing:'0.05em', display:'block', marginBottom:4 }
const inputStyle = { width:'100%', padding:'9px 11px', border:`1px solid ${COLORS.slate200}`, borderRadius:7, fontSize:12, outline:'none', fontFamily:'var(--font-sans)', boxSizing:'border-box' }
const selectStyle = { ...inputStyle, background:'white', cursor:'pointer' }
const btnPrimary = { padding:'9px 20px', background:COLORS.navy, color:'white', border:'none', borderRadius:7, fontSize:12, fontWeight:600, cursor:'pointer', minHeight:40 }
const btnSecondary = { padding:'9px 16px', background:'transparent', color:COLORS.slate600, border:`1px solid ${COLORS.slate200}`, borderRadius:7, fontSize:12, fontWeight:500, cursor:'pointer', minHeight:40 }

// ============================================================
// DETALLE DE PROYECTO
// ============================================================
function DetalleProyecto({ proyectoId, onVolver }) {
  const [proyecto, setProyecto] = useState(null)
  const [tab, setTab] = useState('gantt')
  const [loading, setLoading] = useState(true)
  const [desglosarAct, setDesglosarAct] = useState(null)
  const isMobile = useIsMobile()

  const cargar = async () => { setLoading(true); setProyecto(await getProyectoConActividades(proyectoId)); setLoading(false) }
  useEffect(() => { cargar() }, [proyectoId])

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

  return (
    <div>
      {desglosarAct && <ModalDesglose actividad={desglosarAct} onClose={() => setDesglosarAct(null)} onDesglosado={() => { setDesglosarAct(null); cargar() }}/>}

      <div style={{ display:'flex', alignItems:'flex-start', gap:12, marginBottom:20, flexWrap:'wrap' }}>
        <button onClick={onVolver} style={{ padding:'8px 12px', background:'white', border:`1px solid ${COLORS.slate200}`, borderRadius:8, fontSize:12, cursor:'pointer', color:COLORS.slate600, display:'flex', alignItems:'center', gap:6, fontWeight:500, minHeight:40 }}><Icon.Back/> Proyectos</button>
        <div style={{ flex:1, minWidth:200 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4, flexWrap:'wrap' }}>
            <span style={{ fontSize:11, fontFamily:'var(--font-mono)', color:COLORS.slate400, fontWeight:500 }}>{proyecto.codigo}</span>
            <Badge texto={proyecto.estado} mapa={ESTADOS_PROY}/>
          </div>
          <h1 style={{ fontSize: isMobile ? 20 : 26, fontWeight:500, color:COLORS.navy, margin:0, letterSpacing:'-0.02em', fontFamily:'var(--font-serif)', lineHeight:1.2 }}>{proyecto.nombre}</h1>
          <p style={{ fontSize:12, color:COLORS.slate500, margin:'3px 0 0' }}>{proyecto.cliente?.razon_social || 'Sin cliente'} · {proyecto.director?.nombre || 'Sin director'}</p>
        </div>
      </div>

      <div style={{ display:'flex', borderBottom:`1px solid ${COLORS.slate200}`, marginBottom:20, gap:2, overflowX:'auto' }}>
        {[{k:'gantt',l:'Gantt'},{k:'actividades',l:'Actividades'},{k:'resumen',l:'Resumen'}].map(t => (
          <button key={t.k} onClick={()=>setTab(t.k)} style={{ padding:'10px 16px', border:'none', background:'transparent', cursor:'pointer', fontSize:13, fontWeight: tab===t.k?600:500, color: tab===t.k?COLORS.navy:COLORS.slate500, borderBottom: tab===t.k?`2px solid ${COLORS.navy}`:'2px solid transparent', marginBottom:-1, whiteSpace:'nowrap', minHeight:44 }}>{t.l}</button>
        ))}
      </div>

      {tab === 'gantt' && <GanttModerno actividades={actividades} onActividadClick={a => { if (a.es_servicio_padre) setDesglosarAct(a) }}/>}

      {tab === 'actividades' && (
        <div style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, overflow:'hidden' }}>
          {actividades.map(a => {
            const esPadre = a.es_servicio_padre
            const esHijo = a.parent_id != null
            return (
              <div key={a.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 16px', borderBottom:`1px solid ${COLORS.slate100}`, paddingLeft: esHijo ? 36 : 16, background: esPadre ? '#FAFBFE' : 'white' }}>
                <div onClick={() => toggleActividad(a)} style={{ width:18, height:18, borderRadius:5, border:`1.5px solid ${a.completada?COLORS.teal:'#CBD5E1'}`, background:a.completada?COLORS.teal:'white', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'white', flexShrink:0 }}>{a.completada && <Icon.Check/>}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    {a.es_milestone && <span style={{ color:COLORS.navy }}><Icon.Diamond/></span>}
                    <span style={{ fontSize:13, fontWeight: esPadre ? 600 : 400, color:COLORS.ink, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.nombre}</span>
                    {a.base_legal && <span title={a.base_legal} style={{ color:COLORS.teal, cursor:'help', display:'flex' }}><Icon.Scale/></span>}
                  </div>
                  <div style={{ fontSize:10, color:COLORS.slate500, fontFamily:'var(--font-mono)', marginTop:2 }}>{a.inicio} → {a.fin} · {a.fase}</div>
                </div>
                <BarraAvance avance={a.avance}/>
                <Badge texto={a.estado} mapa={ESTADOS}/>
                {esPadre && <button onClick={() => setDesglosarAct(a)} style={{ padding:'5px 10px', background:COLORS.tealLight, color:COLORS.teal, border:'none', borderRadius:6, fontSize:10, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap' }}>⚖ Desglosar</button>}
              </div>
            )
          })}
        </div>
      )}

      {tab === 'resumen' && (
        <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1.3fr 1fr', gap:16 }}>
          <div style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, padding:20 }}>
            <h3 style={labelStyle}>Información</h3>
            {[['Cliente', proyecto.cliente?.razon_social || '—'], ['Director', proyecto.director?.nombre || '—'], ['Capacidad', proyecto.capacidad_mw ? `${proyecto.capacidad_mw} MW` : '—'], ['Ubicación', proyecto.ubicacion || '—'], ['Inicio', proyecto.inicio], ['Cierre', proyecto.cierre]].map(([k,v]) => (
              <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:'10px 0', borderBottom:`1px solid ${COLORS.slate100}`, fontSize:12 }}>
                <span style={{ color:COLORS.slate500 }}>{k}</span><span style={{ fontWeight:500, color:COLORS.ink }}>{v}</span>
              </div>
            ))}
          </div>
          <div style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, padding:24, textAlign:'center' }}>
            <h3 style={labelStyle}>Avance general</h3>
            <div style={{ fontSize:48, fontWeight:400, color:COLORS.navy, fontFamily:'var(--font-serif)', lineHeight:1, marginBottom:12 }}>{avanceGeneral}%</div>
            <BarraAvance avance={avanceGeneral}/>
            <div style={{ fontSize:11, color:COLORS.slate400, marginTop:10 }}>{actividades.filter(a=>a.completada).length} de {actividades.length} completadas</div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// LISTA DE PROYECTOS (CON FILTRO ACTIVOS/TERMINADOS/TODOS + BÚSQUEDA)
// REEMPLAZA SOLO ESTA FUNCIÓN AL FINAL DEL ARCHIVO
// ============================================================
export default function Proyectos({ usuario }) {
  const [proyectos, setProyectos] = useState([])
  const [loading, setLoading] = useState(true)
  const [proyectoSel, setProyectoSel] = useState(null)
  const [modalNuevo, setModalNuevo] = useState(false)
  const [filtro, setFiltro] = useState('Activos')
  const [busqueda, setBusqueda] = useState('')
  const isMobile = useIsMobile()

  const cargar = async () => { setLoading(true); setProyectos(await getProyectos()); setLoading(false) }
  useEffect(() => { cargar() }, [])

  // ⚠️ IMPORTANTE: useMemo DEBE ir ANTES del return condicional
  const filtrados = useMemo(() => {
    let r = proyectos
    if (filtro === 'Activos') r = r.filter(p => ['Por iniciar', 'En curso', 'En pausa'].includes(p.estado))
    else if (filtro === 'Terminados') r = r.filter(p => ['Terminado', 'Cancelado'].includes(p.estado))
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase()
      r = r.filter(p => p.nombre?.toLowerCase().includes(q) || p.cliente?.razon_social?.toLowerCase().includes(q) || p.codigo?.toLowerCase().includes(q) || p.ubicacion?.toLowerCase().includes(q))
    }
    return r
  }, [proyectos, filtro, busqueda])

  // Return condicional DESPUÉS de todos los hooks
  if (proyectoSel) return <DetalleProyecto proyectoId={proyectoSel} onVolver={() => { setProyectoSel(null); cargar() }}/>

  return (
    <div>
      {modalNuevo && <ModalNuevoProyecto onClose={() => setModalNuevo(false)} onCreado={(p) => { setModalNuevo(false); cargar(); setProyectoSel(p.id) }}/>}

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontSize: isMobile ? 24 : 32, fontWeight:400, color:COLORS.navy, margin:0, letterSpacing:'-0.02em', fontFamily:'var(--font-serif)' }}>Proyectos</h1>
          <p style={{ color:COLORS.slate500, fontSize:12, marginTop:4 }}>{filtrados.length} de {proyectos.length}</p>
        </div>
        <button onClick={() => setModalNuevo(true)} style={{ padding:'10px 18px', background:COLORS.navy, color:'white', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:6, minHeight:44 }}>
          <Icon.Plus/> {isMobile ? 'Nuevo' : 'Nuevo proyecto'}
        </button>
      </div>

      <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
        <div style={{ display:'flex', background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:10, padding:2 }}>
          {['Activos', 'Terminados', 'Todos'].map(f => (
            <button key={f} onClick={() => setFiltro(f)} style={{
              padding:'7px 14px', border:'none',
              background: filtro === f ? COLORS.navy : 'transparent',
              color: filtro === f ? 'white' : COLORS.slate600,
              borderRadius:8, fontSize:12, fontWeight:600, cursor:'pointer', minHeight:36
            }}>{f === 'Terminados' ? <>{<Icon.Archive/>} {f}</> : f}</button>
          ))}
        </div>
        <div style={{ flex:1, minWidth:200, position:'relative' }}>
          <div style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:COLORS.slate400 }}><Icon.Search/></div>
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar por nombre, cliente, código..." style={{ width:'100%', padding:'9px 14px 9px 36px', border:`1px solid ${COLORS.slate100}`, borderRadius:10, fontSize:12, outline:'none', minHeight:40, boxSizing:'border-box' }}/>
        </div>
      </div>

      {loading && <div style={{ padding:40, textAlign:'center', color:COLORS.slate400 }}>Cargando...</div>}

      {!loading && filtrados.length === 0 && (
        <div style={{ padding:'50px 20px', background:'white', border:`1px dashed ${COLORS.slate200}`, borderRadius:12, textAlign:'center' }}>
          <div style={{ fontSize:13, color:COLORS.slate500, marginBottom:4 }}>{busqueda ? 'Sin resultados' : 'Sin proyectos en esta vista'}</div>
          {!busqueda && <button onClick={() => setModalNuevo(true)} style={{ marginTop:14, ...btnPrimary }}>+ Crear primer proyecto</button>}
        </div>
      )}

      {!loading && filtrados.length > 0 && (
        <div style={{ display:'grid', gap:8 }}>
          {filtrados.map(p => (
            <div key={p.id} onClick={() => setProyectoSel(p.id)}
              style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderLeft:`3px solid ${ESTADOS_PROY[p.estado]?.bar || COLORS.slate400}`, borderRadius:10, padding: isMobile ? '14px 16px' : '16px 20px', cursor:'pointer', transition:'all 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.boxShadow='0 4px 16px rgba(10,37,64,0.06)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow='none'}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:10, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3, flexWrap:'wrap' }}>
                    <span style={{ fontSize:10, fontFamily:'var(--font-mono)', color:COLORS.slate400, fontWeight:600 }}>{p.codigo}</span>
                    <Badge texto={p.estado} mapa={ESTADOS_PROY}/>
                  </div>
                  <div style={{ fontSize: isMobile ? 14 : 15, fontWeight:500, color:COLORS.ink, marginBottom:2 }}>{p.nombre}</div>
                  <div style={{ fontSize:11, color:COLORS.slate500 }}>
                    {p.cliente?.razon_social || 'Sin cliente'}
                    {p.director?.nombre && ` · ${p.director.nombre}`}
                    {p.capacidad_mw && ` · ${p.capacidad_mw} MW`}
                  </div>
                </div>
                {!isMobile && <div style={{ fontSize:10, color:COLORS.slate400, fontFamily:'var(--font-mono)', textAlign:'right' }}>Cierre<br/>{p.cierre}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}