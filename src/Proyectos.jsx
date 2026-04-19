import { useState, useRef, useEffect } from 'react'

// ============================================================
// DATOS DEMO
// ============================================================
const proyectosDemo = [
  {
    id: 'PRY-001',
    nombre: 'Instalación Solar — Planta Bajío',
    cliente: 'Grupo Industrial del Bajío',
    director: 'Carlos Mendez',
    equipo: ['Carlos Mendez', 'Sofia Ruiz'],
    estado: 'En curso',
    avance: 45,
    inicio: '2026-03-01',
    cierre: '2026-06-30',
    alcance: 'Instalación de sistema fotovoltaico de 500 kWp en planta industrial. Incluye paneles, inversores, estructura y conexión a red.',
    actividades: [
      { id:1, nombre:'Estudio de sitio', fase:'Fase 1 — Ingeniería', responsable:'Carlos Mendez', inicio:'2026-03-01', fin:'2026-03-15', avance:100, estado:'Completada', deps:[], completada:true, notas:'', checklist:[{id:1,texto:'Visita técnica',hecho:true},{id:2,texto:'Medición de área disponible',hecho:true},{id:3,texto:'Reporte fotográfico',hecho:true}] },
      { id:2, nombre:'Diseño del sistema', fase:'Fase 1 — Ingeniería', responsable:'Sofia Ruiz', inicio:'2026-03-16', fin:'2026-03-31', avance:100, estado:'Completada', deps:[1], completada:true, notas:'', checklist:[] },
      { id:3, nombre:'Gestión de permisos', fase:'Fase 2 — Permisos', responsable:'Carlos Mendez', inicio:'2026-04-01', fin:'2026-04-20', avance:80, estado:'En progreso', deps:[2], completada:false, notas:'En trámite ante CFE — esperando respuesta oficial', checklist:[{id:1,texto:'Solicitud CFE enviada',hecho:true},{id:2,texto:'Pago de derechos',hecho:true},{id:3,texto:'Recibir aprobación',hecho:false}] },
      { id:4, nombre:'Compra de equipos', fase:'Fase 2 — Permisos', responsable:'Sofia Ruiz', inicio:'2026-04-01', fin:'2026-04-15', avance:100, estado:'Completada', deps:[2], completada:true, notas:'', checklist:[] },
      { id:5, nombre:'Instalación estructura', fase:'Fase 3 — Instalación', responsable:'Carlos Mendez', inicio:'2026-04-21', fin:'2026-05-15', avance:20, estado:'En progreso', deps:[3,4], completada:false, notas:'', checklist:[] },
      { id:6, nombre:'Instalación paneles', fase:'Fase 3 — Instalación', responsable:'Sofia Ruiz', inicio:'2026-05-16', fin:'2026-06-05', avance:0, estado:'Sin iniciar', deps:[5], completada:false, notas:'', checklist:[] },
      { id:7, nombre:'Conexión eléctrica', fase:'Fase 3 — Instalación', responsable:'Carlos Mendez', inicio:'2026-06-06', fin:'2026-06-20', avance:0, estado:'Sin iniciar', deps:[6], completada:false, notas:'', checklist:[] },
      { id:8, nombre:'Pruebas y puesta en marcha', fase:'Fase 4 — Cierre', responsable:'Carlos Mendez', inicio:'2026-06-21', fin:'2026-06-28', avance:0, estado:'Sin iniciar', deps:[7], completada:false, notas:'', checklist:[] },
      { id:9, nombre:'Entrega y documentación', fase:'Fase 4 — Cierre', responsable:'Sofia Ruiz', inicio:'2026-06-29', fin:'2026-06-30', avance:0, estado:'Sin iniciar', deps:[8], completada:false, notas:'', checklist:[] },
    ]
  },
  {
    id: 'PRY-002',
    nombre: 'Auditoría Energética — Bodega Norte',
    cliente: 'Vitro Glass',
    director: 'Sofia Ruiz',
    equipo: ['Sofia Ruiz'],
    estado: 'Terminado',
    avance: 100,
    inicio: '2026-02-01',
    cierre: '2026-03-31',
    alcance: 'Auditoría energética completa de bodega industrial.',
    actividades: [
      { id:1, nombre:'Levantamiento de datos', fase:'Fase 1', responsable:'Sofia Ruiz', inicio:'2026-02-01', fin:'2026-02-15', avance:100, estado:'Completada', deps:[], completada:true, notas:'', checklist:[] },
      { id:2, nombre:'Análisis de consumo', fase:'Fase 2', responsable:'Sofia Ruiz', inicio:'2026-02-16', fin:'2026-03-10', avance:100, estado:'Completada', deps:[1], completada:true, notas:'', checklist:[] },
      { id:3, nombre:'Reporte final', fase:'Fase 3', responsable:'Sofia Ruiz', inicio:'2026-03-11', fin:'2026-03-31', avance:100, estado:'Completada', deps:[2], completada:true, notas:'', checklist:[] },
    ]
  },
]

// ============================================================
// CONSTANTES DE DISEÑO
// ============================================================
const COLORS = {
  navy: '#0A2540',
  navy2: '#1B3A6B',
  teal: '#0F6E56',
  tealLight: '#E1F5EE',
  gold: '#C89B3C',
  red: '#DC2626',
  amber: '#D97706',
  slate50: '#F8FAFC',
  slate100: '#F1F5F9',
  slate200: '#E2E8F0',
  slate400: '#94A3B8',
  slate500: '#64748B',
  slate600: '#475569',
  ink: '#1C2128',
}

const ESTADOS_CONFIG = {
  'Completada':  { bg:'#E1F5EE', color:'#0F6E56', bar:'#0F6E56' },
  'En progreso': { bg:'#E0EDFF', color:'#1B3A6B', bar:'#1B3A6B' },
  'Sin iniciar': { bg:'#F1F5F9', color:'#64748B', bar:'#94A3B8' },
  'Retrasada':   { bg:'#FEF2F2', color:'#DC2626', bar:'#DC2626' },
  'Bloqueada':   { bg:'#FEF3C7', color:'#D97706', bar:'#D97706' },
}

const ESTADOS_PROYECTO = {
  'En curso':    { bg:'#E0EDFF', color:'#1B3A6B', bar:'#1B3A6B' },
  'Terminado':   { bg:'#E1F5EE', color:'#0F6E56', bar:'#0F6E56' },
  'Por iniciar': { bg:'#FEF3C7', color:'#D97706', bar:'#D97706' },
  'En pausa':    { bg:'#FEF2F2', color:'#DC2626', bar:'#DC2626' },
}

// ============================================================
// COMPONENTES REUTILIZABLES
// ============================================================
function Badge({ texto, mapa }) {
  const c = mapa[texto] || { bg:'#F1F5F9', color:'#64748B' }
  return (
    <span style={{
      display:'inline-flex', alignItems:'center',
      fontSize:11, fontWeight:500, padding:'3px 10px',
      borderRadius:20, background:c.bg, color:c.color,
      letterSpacing:'-0.01em'
    }}>{texto}</span>
  )
}

function BarraAvance({ avance, color=COLORS.navy2, height=5 }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:100 }}>
      <div style={{ flex:1, height, background:'#EEF2F6', borderRadius:height/2, overflow:'hidden' }}>
        <div style={{
          width:`${avance}%`, height:'100%',
          background: avance === 100 ? COLORS.teal : color,
          borderRadius:height/2, transition:'width 0.3s ease'
        }}/>
      </div>
      <span style={{ fontSize:11, fontWeight:600, color: avance === 100 ? COLORS.teal : color, minWidth:32, fontFamily:'var(--font-mono)' }}>
        {avance}%
      </span>
    </div>
  )
}

function Avatar({ nombre, size=28 }) {
  const iniciales = nombre?.split(' ').map(n=>n[0]).slice(0,2).join('').toUpperCase() || '?'
  const colors = ['#1B3A6B', '#0F6E56', '#C89B3C', '#6B4C9A', '#D97706']
  const color = colors[nombre?.length % colors.length || 0]
  return (
    <div style={{
      width:size, height:size, borderRadius:'50%',
      background:color, color:'white',
      display:'flex', alignItems:'center', justifyContent:'center',
      fontSize:size*0.38, fontWeight:600, flexShrink:0, letterSpacing:'-0.02em'
    }}>{iniciales}</div>
  )
}

function IconBtn({ onClick, title, children, color=COLORS.slate500 }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      title={title}
      onMouseEnter={()=>setHover(true)}
      onMouseLeave={()=>setHover(false)}
      style={{
        width:26, height:26, borderRadius:6,
        border:'none', background: hover ? '#EEF2F6' : 'transparent',
        color: hover ? COLORS.navy : color,
        cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
        padding:0, transition:'all 0.15s'
      }}
    >
      {children}
    </button>
  )
}

// Iconos SVG minimales (estilo Lucide)
const Icon = {
  Info: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>,
  Edit: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>,
  Trash: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
  Plus: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>,
  Chevron: ({ open }) => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', transition:'transform 0.15s' }}><path d="m6 9 6 6 6-6"/></svg>,
  Check: () => <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>,
  X: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>,
  Back: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>,
  Calendar: () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>,
  User: () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
}

// ============================================================
// PANEL DE DETALLE (tipo MS Planner)
// ============================================================
function PanelDetalle({ actividad, onClose, onSave, onDelete }) {
  const [form, setForm] = useState({ ...actividad })

  const addChecklistItem = () => {
    const newId = Math.max(0, ...(form.checklist||[]).map(c=>c.id)) + 1
    setForm({...form, checklist:[...(form.checklist||[]), {id:newId, texto:'', hecho:false}]})
  }
  const updateChecklistItem = (id, field, value) => {
    setForm({...form, checklist: form.checklist.map(c => c.id===id ? {...c, [field]:value} : c)})
  }
  const deleteChecklistItem = (id) => {
    setForm({...form, checklist: form.checklist.filter(c => c.id !== id)})
  }

  const estadoConfig = ESTADOS_CONFIG[form.estado] || ESTADOS_CONFIG['Sin iniciar']

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(10,37,64,0.25)', backdropFilter:'blur(2px)', zIndex:999 }}/>
      <div style={{
        position:'fixed', top:0, right:0, bottom:0, width:460,
        background:'white', boxShadow:'-8px 0 32px rgba(10,37,64,0.12)', zIndex:1000,
        display:'flex', flexDirection:'column', animation:'slideIn 0.25s ease-out'
      }}>
        <style>{`@keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>

        {/* Header */}
        <div style={{ padding:'22px 28px 18px', borderBottom:`1px solid ${COLORS.slate100}` }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
            <div style={{ display:'flex', gap:10, alignItems:'center' }}>
              <span style={{ fontSize:10, fontFamily:'var(--font-mono)', color:COLORS.slate400, fontWeight:500 }}>#{form.id}</span>
              <Badge texto={form.fase} mapa={{[form.fase]:{bg:'#EEF2F6', color:COLORS.navy}}}/>
            </div>
            <IconBtn onClick={onClose} title="Cerrar"><Icon.X/></IconBtn>
          </div>
          <input
            value={form.nombre}
            onChange={e => setForm({...form, nombre:e.target.value})}
            style={{
              fontSize:22, fontWeight:600, color:COLORS.ink,
              border:'none', outline:'none', width:'100%', background:'transparent',
              letterSpacing:'-0.02em', fontFamily:'var(--font-sans)'
            }}
          />
        </div>

        {/* Body */}
        <div style={{ flex:1, overflow:'auto', padding:'22px 28px' }}>

          {/* Estado + Completada */}
          <div style={{
            padding:14, background:COLORS.slate50, borderRadius:10,
            display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:22,
            border:`1px solid ${COLORS.slate100}`
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div
                onClick={() => setForm({...form, completada:!form.completada, avance:!form.completada?100:0, estado:!form.completada?'Completada':'Sin iniciar'})}
                style={{
                  width:22, height:22, borderRadius:6,
                  border:`2px solid ${form.completada ? COLORS.teal : '#CBD5E1'}`,
                  background: form.completada ? COLORS.teal : 'white',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  cursor:'pointer', flexShrink:0, color:'white', transition:'all 0.15s'
                }}>
                {form.completada && <Icon.Check/>}
              </div>
              <span style={{ fontSize:14, fontWeight:500, color:COLORS.ink }}>
                {form.completada ? 'Completada' : 'Marcar como completada'}
              </span>
            </div>
            <Badge texto={form.estado} mapa={ESTADOS_CONFIG}/>
          </div>

          {/* Grid de campos */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:20 }}>
            <Campo label="Estado">
              <select value={form.estado} onChange={e => setForm({...form, estado:e.target.value})} style={selectStyle}>
                {['Sin iniciar','En progreso','Completada','Bloqueada','Retrasada'].map(s => <option key={s}>{s}</option>)}
              </select>
            </Campo>
            <Campo label="Avance (%)">
              <input type="number" min={0} max={100} value={form.avance}
                onChange={e => setForm({...form, avance:parseInt(e.target.value)||0})}
                style={inputStyle}/>
            </Campo>
          </div>

          <Campo label="Responsable">
            <input value={form.responsable} onChange={e => setForm({...form, responsable:e.target.value})} style={inputStyle}/>
          </Campo>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginTop:20 }}>
            <Campo label="Fecha inicio">
              <input type="date" value={form.inicio} onChange={e => setForm({...form, inicio:e.target.value})} style={inputStyle}/>
            </Campo>
            <Campo label="Fecha fin">
              <input type="date" value={form.fin} onChange={e => setForm({...form, fin:e.target.value})} style={inputStyle}/>
            </Campo>
          </div>

          <div style={{ marginTop:20 }}>
            <Campo label="Predecesoras (IDs separados por coma)">
              <input
                value={form.deps.join(', ')}
                onChange={e => setForm({...form, deps: e.target.value.split(',').map(x=>parseInt(x.trim())).filter(x=>!isNaN(x))})}
                placeholder="ej: 1, 3"
                style={inputStyle}/>
            </Campo>
          </div>

          {/* Checklist */}
          <div style={{ marginTop:28 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
              <span style={labelStyle}>Subtareas</span>
              <span style={{ fontSize:11, color:COLORS.slate400, fontFamily:'var(--font-mono)' }}>
                {(form.checklist||[]).filter(c=>c.hecho).length}/{(form.checklist||[]).length}
              </span>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {(form.checklist||[]).map(item => (
                <div key={item.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', background:COLORS.slate50, borderRadius:8 }}>
                  <div
                    onClick={() => updateChecklistItem(item.id, 'hecho', !item.hecho)}
                    style={{
                      width:16, height:16, borderRadius:4,
                      border:`1.5px solid ${item.hecho ? COLORS.teal : '#CBD5E1'}`,
                      background: item.hecho ? COLORS.teal : 'white',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      cursor:'pointer', flexShrink:0, color:'white'
                    }}>
                    {item.hecho && <Icon.Check/>}
                  </div>
                  <input
                    value={item.texto}
                    onChange={e => updateChecklistItem(item.id, 'texto', e.target.value)}
                    placeholder="Descripción de la subtarea"
                    style={{
                      flex:1, border:'none', outline:'none', background:'transparent',
                      fontSize:13, color: item.hecho ? COLORS.slate400 : COLORS.ink,
                      textDecoration: item.hecho ? 'line-through' : 'none'
                    }}/>
                  <IconBtn onClick={() => deleteChecklistItem(item.id)} title="Eliminar"><Icon.Trash/></IconBtn>
                </div>
              ))}
              <button onClick={addChecklistItem} style={{
                marginTop:4, padding:'8px 12px', background:'transparent',
                border:`1px dashed ${COLORS.slate200}`, borderRadius:8,
                fontSize:12, color:COLORS.slate500, cursor:'pointer',
                display:'flex', alignItems:'center', gap:6,
                fontFamily:'var(--font-sans)'
              }}>
                <Icon.Plus/> Agregar subtarea
              </button>
            </div>
          </div>

          {/* Notas */}
          <div style={{ marginTop:22 }}>
            <Campo label="Notas">
              <textarea
                value={form.notas}
                onChange={e => setForm({...form, notas:e.target.value})}
                rows={4}
                placeholder="Agrega notas, comentarios o contexto..."
                style={{...inputStyle, resize:'vertical', fontFamily:'var(--font-sans)'}}
              />
            </Campo>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding:'16px 28px', borderTop:`1px solid ${COLORS.slate100}`, display:'flex', gap:10, alignItems:'center' }}>
          <button onClick={() => onDelete(form.id)} style={{
            padding:'10px 14px', background:'transparent', color:COLORS.red,
            border:`1px solid ${COLORS.slate200}`, borderRadius:8,
            fontSize:13, fontWeight:500, cursor:'pointer', fontFamily:'var(--font-sans)'
          }}>Eliminar</button>
          <div style={{ flex:1 }}/>
          <button onClick={onClose} style={{
            padding:'10px 16px', background:'transparent', color:COLORS.slate600,
            border:`1px solid ${COLORS.slate200}`, borderRadius:8,
            fontSize:13, fontWeight:500, cursor:'pointer', fontFamily:'var(--font-sans)'
          }}>Cancelar</button>
          <button onClick={() => onSave(form)} style={{
            padding:'10px 20px', background:COLORS.navy, color:'white',
            border:'none', borderRadius:8,
            fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'var(--font-sans)',
            letterSpacing:'-0.01em'
          }}>Guardar</button>
        </div>
      </div>
    </>
  )
}

const labelStyle = { fontSize:11, fontWeight:600, color:COLORS.slate500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:6 }
const inputStyle = { width:'100%', padding:'10px 12px', border:`1px solid ${COLORS.slate200}`, borderRadius:8, fontSize:13, color:COLORS.ink, outline:'none', boxSizing:'border-box', fontFamily:'var(--font-sans)' }
const selectStyle = { ...inputStyle, background:'white', cursor:'pointer' }

function Campo({ label, children }) {
  return <div><label style={labelStyle}>{label}</label>{children}</div>
}

// ============================================================
// TAB: ACTIVIDADES (estilo Wrike)
// ============================================================
function TabActividades({ actividades, onToggle, onUpdate, onDelete, onAgregar, onAbrirDetalle }) {
  const fases = [...new Set(actividades.map(a => a.fase))]
  const [hoveredId, setHoveredId] = useState(null)
  const [editandoId, setEditandoId] = useState(null)
  const [fasesColapsadas, setFasesColapsadas] = useState({})

  return (
    <div style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, overflow:'hidden' }}>
      {/* Header */}
      <div style={{ display:'grid', gridTemplateColumns:'40px 30px 1fr 160px 110px 110px 160px 120px 80px', gap:0, padding:'12px 16px', background:COLORS.slate50, borderBottom:`1px solid ${COLORS.slate100}`, fontSize:10, fontWeight:600, color:COLORS.slate500, textTransform:'uppercase', letterSpacing:'0.08em' }}>
        <div></div>
        <div></div>
        <div>Actividad</div>
        <div>Responsable</div>
        <div>Inicio</div>
        <div>Fin</div>
        <div>Avance</div>
        <div>Estado</div>
        <div style={{ textAlign:'right' }}></div>
      </div>

      {fases.map(fase => {
        const actsFase = actividades.filter(a => a.fase === fase)
        const doneCount = actsFase.filter(a => a.completada).length
        const colapsada = fasesColapsadas[fase]

        return (
          <div key={fase}>
            {/* Header de fase */}
            <div
              onClick={() => setFasesColapsadas(prev => ({...prev, [fase]: !prev[fase]}))}
              style={{
                padding:'10px 16px', background:'#F4F6FA',
                borderBottom:`1px solid ${COLORS.slate100}`,
                display:'flex', alignItems:'center', gap:10, cursor:'pointer',
                fontSize:12, fontWeight:600, color:COLORS.navy
              }}
            >
              <Icon.Chevron open={!colapsada}/>
              <span style={{ letterSpacing:'-0.01em' }}>{fase}</span>
              <span style={{ fontSize:11, color:COLORS.slate500, fontWeight:400, marginLeft:'auto', fontFamily:'var(--font-mono)' }}>
                {doneCount}/{actsFase.length}
              </span>
            </div>

            {!colapsada && actsFase.map(a => (
              <div
                key={a.id}
                onMouseEnter={() => setHoveredId(a.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{
                  display:'grid',
                  gridTemplateColumns:'40px 30px 1fr 160px 110px 110px 160px 120px 80px',
                  gap:0, alignItems:'center',
                  padding:'10px 16px',
                  borderBottom:`1px solid ${COLORS.slate100}`,
                  background: hoveredId === a.id ? '#FAFBFE' : 'white',
                  transition:'background 0.1s',
                  opacity: a.completada ? 0.65 : 1
                }}
              >
                {/* ID */}
                <div style={{ fontSize:10, fontFamily:'var(--font-mono)', color:COLORS.slate400, fontWeight:500 }}>#{a.id}</div>

                {/* Checkbox */}
                <div
                  onClick={(e) => { e.stopPropagation(); onToggle(a.id) }}
                  style={{
                    width:17, height:17, borderRadius:5,
                    border:`1.5px solid ${a.completada ? COLORS.teal : '#CBD5E1'}`,
                    background: a.completada ? COLORS.teal : 'white',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    cursor:'pointer', color:'white', transition:'all 0.15s'
                  }}>
                  {a.completada && <Icon.Check/>}
                </div>

                {/* Nombre (editable inline con doble click) */}
                <div style={{ display:'flex', alignItems:'center', gap:6, minWidth:0 }}>
                  {editandoId === a.id ? (
                    <input
                      autoFocus
                      value={a.nombre}
                      onChange={e => onUpdate({...a, nombre:e.target.value})}
                      onBlur={() => setEditandoId(null)}
                      onKeyDown={e => { if(e.key==='Enter') setEditandoId(null) }}
                      style={{
                        flex:1, border:`1px solid ${COLORS.navy2}`, borderRadius:5,
                        padding:'4px 8px', fontSize:13, outline:'none',
                        fontFamily:'var(--font-sans)'
                      }}/>
                  ) : (
                    <span
                      onDoubleClick={() => setEditandoId(a.id)}
                      style={{
                        fontSize:13, fontWeight:500, color:COLORS.ink,
                        textDecoration: a.completada ? 'line-through' : 'none',
                        overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                        cursor:'text', letterSpacing:'-0.01em'
                      }}>{a.nombre}</span>
                  )}
                  {a.checklist && a.checklist.length > 0 && (
                    <span style={{ fontSize:10, color:COLORS.slate400, fontFamily:'var(--font-mono)', flexShrink:0 }}>
                      ☰ {a.checklist.filter(c=>c.hecho).length}/{a.checklist.length}
                    </span>
                  )}
                </div>

                {/* Responsable */}
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <Avatar nombre={a.responsable} size={22}/>
                  <span style={{ fontSize:12, color:COLORS.slate600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {a.responsable}
                  </span>
                </div>

                {/* Inicio */}
                <div style={{ fontSize:12, color:COLORS.slate500, fontFamily:'var(--font-mono)' }}>{a.inicio}</div>

                {/* Fin */}
                <div style={{ fontSize:12, color:COLORS.slate500, fontFamily:'var(--font-mono)' }}>{a.fin}</div>

                {/* Avance */}
                <div><BarraAvance avance={a.avance}/></div>

                {/* Estado */}
                <div><Badge texto={a.estado} mapa={ESTADOS_CONFIG}/></div>

                {/* Hover actions (como Wrike) */}
                <div style={{ display:'flex', justifyContent:'flex-end', gap:2, opacity: hoveredId === a.id ? 1 : 0, transition:'opacity 0.15s' }}>
                  <IconBtn onClick={() => onAbrirDetalle(a)} title="Ver detalles"><Icon.Info/></IconBtn>
                  <IconBtn onClick={() => setEditandoId(a.id)} title="Editar nombre"><Icon.Edit/></IconBtn>
                  <IconBtn onClick={() => onDelete(a.id)} title="Eliminar"><Icon.Trash/></IconBtn>
                </div>
              </div>
            ))}

            {/* Agregar actividad */}
            {!colapsada && (
              <button onClick={() => onAgregar(fase)} style={{
                width:'100%', padding:'10px 16px', background:'transparent',
                border:'none', borderBottom:`1px solid ${COLORS.slate100}`,
                fontSize:12, color:COLORS.slate500, cursor:'pointer',
                display:'flex', alignItems:'center', gap:8, textAlign:'left',
                fontFamily:'var(--font-sans)'
              }}>
                <Icon.Plus/> Agregar actividad a {fase}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ============================================================
// TAB: GANTT (manteniendo lo que te gustó)
// ============================================================
function TabGantt({ actividades, onToggle, onAbrirDetalle }) {
  const containerRef = useRef(null)
  const [containerWidth, setContainerWidth] = useState(0)
  const [hoveredId, setHoveredId] = useState(null)
  const [fasesColapsadas, setFasesColapsadas] = useState({})

  useEffect(() => {
    const update = () => { if (containerRef.current) setContainerWidth(containerRef.current.offsetWidth) }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const fases = [...new Set(actividades.map(a => a.fase))]
  const hoy = new Date()
  const fechaMin = new Date(Math.min(...actividades.map(a => new Date(a.inicio))))
  const fechaMax = new Date(Math.max(...actividades.map(a => new Date(a.fin))))
  const totalDias = Math.ceil((fechaMax - fechaMin) / 86400000) + 14
  const ROW_H = 38
  const FASE_H = 34
  const PANEL_W = 340
  const timelineW = Math.max(0, containerWidth - PANEL_W)

  const dayToPx = (fecha) => Math.max(0, (Math.ceil((new Date(fecha) - fechaMin) / 86400000) / totalDias) * timelineW)
  const durToPx = (inicio, fin) => Math.max(8, ((new Date(fin) - new Date(inicio)) / 86400000 + 1) / totalDias * timelineW)

  const colorBarra = (a) => {
    if (a.completada || a.estado === 'Completada') return COLORS.teal
    if (new Date(a.fin) < hoy && a.avance < 100) return COLORS.red
    if (a.estado === 'En progreso') return COLORS.navy2
    return COLORS.slate400
  }

  const meses = []
  const cur = new Date(fechaMin); cur.setDate(1)
  while (cur <= fechaMax) {
    meses.push({ label: cur.toLocaleDateString('es-MX',{month:'short',year:'numeric'}), px: dayToPx(cur.toISOString().split('T')[0]) })
    cur.setMonth(cur.getMonth()+1)
  }

  const filasVisibles = []
  fases.forEach(fase => {
    filasVisibles.push({ tipo:'fase', fase })
    if (!fasesColapsadas[fase]) {
      actividades.filter(a => a.fase === fase).forEach(a => filasVisibles.push({ tipo:'actividad', actividad:a }))
    }
  })

  const rowY = {}
  let y = 0
  filasVisibles.forEach((f) => {
    if (f.tipo === 'actividad') rowY[f.actividad.id] = y + ROW_H/2
    y += f.tipo === 'fase' ? FASE_H : ROW_H
  })
  const totalH = y

  const flechas = []
  if (timelineW > 0) {
    actividades.forEach(a => {
      a.deps.forEach(depId => {
        if (rowY[depId] === undefined || rowY[a.id] === undefined) return
        const from = actividades.find(x => x.id === depId)
        const x1 = dayToPx(from.inicio) + durToPx(from.inicio, from.fin)
        const y1 = rowY[depId]
        const x2 = dayToPx(a.inicio)
        const y2 = rowY[a.id]
        flechas.push({ x1, y1, x2, y2, key:`${depId}-${a.id}` })
      })
    })
  }

  return (
    <div ref={containerRef} style={{ background:'white', borderRadius:12, border:`1px solid ${COLORS.slate100}`, overflow:'hidden' }}>
      {/* Header */}
      <div style={{ display:'flex', borderBottom:`1px solid ${COLORS.slate100}`, background:COLORS.slate50 }}>
        <div style={{ width:PANEL_W, flexShrink:0, padding:'12px 16px', fontSize:10, fontWeight:600, color:COLORS.slate500, textTransform:'uppercase', letterSpacing:'0.08em', borderRight:`1px solid ${COLORS.slate100}` }}>
          Actividad
        </div>
        <div style={{ flex:1, position:'relative', height:40, overflow:'hidden' }}>
          {meses.map((m,i) => (
            <div key={i} style={{ position:'absolute', left:m.px, top:0, bottom:0, display:'flex', alignItems:'center', paddingLeft:10, borderLeft:`1px solid ${COLORS.slate100}` }}>
              <span style={{ fontSize:11, fontWeight:500, color:COLORS.slate500, whiteSpace:'nowrap', textTransform:'uppercase', letterSpacing:'0.06em' }}>{m.label}</span>
            </div>
          ))}
          {timelineW > 0 && (
            <div style={{ position:'absolute', left:dayToPx(hoy.toISOString().split('T')[0]), top:0, bottom:0, width:2, background:COLORS.red, opacity:0.9, zIndex:2 }}>
              <span style={{ position:'absolute', top:4, left:6, fontSize:9, fontWeight:700, color:COLORS.red, letterSpacing:'0.08em' }}>HOY</span>
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div style={{ position:'relative' }}>
        {timelineW > 0 && (
          <svg style={{ position:'absolute', left:PANEL_W, top:0, width:timelineW, height:totalH, pointerEvents:'none', zIndex:5, overflow:'visible' }}>
            <defs>
              <marker id="arr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L0,6 L6,3 z" fill={COLORS.slate400}/>
              </marker>
            </defs>
            {flechas.map(f => (
              <path key={f.key}
                d={`M${f.x1},${f.y1} C${(f.x1+f.x2)/2},${f.y1} ${(f.x1+f.x2)/2},${f.y2} ${f.x2},${f.y2}`}
                fill="none" stroke={COLORS.slate400} strokeWidth="1.5" strokeDasharray="3,3" markerEnd="url(#arr)"
              />
            ))}
          </svg>
        )}

        {filasVisibles.map((fila, i) => {
          if (fila.tipo === 'fase') {
            const colapsada = fasesColapsadas[fila.fase]
            const actCount = actividades.filter(a => a.fase === fila.fase).length
            const doneCount = actividades.filter(a => a.fase === fila.fase && a.completada).length
            return (
              <div key={fila.fase} style={{ display:'flex', alignItems:'center', height:FASE_H, background:'#F4F6FA', borderBottom:`1px solid ${COLORS.slate100}`, cursor:'pointer' }}
                onClick={() => setFasesColapsadas(prev => ({...prev, [fila.fase]: !prev[fila.fase]}))}>
                <div style={{ width:PANEL_W, flexShrink:0, padding:'0 16px', display:'flex', alignItems:'center', gap:10, borderRight:`1px solid ${COLORS.slate100}`, color:COLORS.navy }}>
                  <Icon.Chevron open={!colapsada}/>
                  <span style={{ fontSize:12, fontWeight:600, letterSpacing:'-0.01em' }}>{fila.fase}</span>
                  <span style={{ fontSize:11, color:COLORS.slate500, fontWeight:400, marginLeft:'auto', fontFamily:'var(--font-mono)' }}>{doneCount}/{actCount}</span>
                </div>
                <div style={{ flex:1, height:'100%' }}/>
              </div>
            )
          }

          const a = fila.actividad
          return (
            <div key={a.id}
              onMouseEnter={() => setHoveredId(a.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{
                display:'flex', alignItems:'center',
                borderBottom:`1px solid ${COLORS.slate100}`,
                height:ROW_H,
                background: hoveredId===a.id ? '#FAFBFE' : (i%2===0?'white':'#FCFCFD')
              }}>
              {/* Panel */}
              <div style={{ width:PANEL_W, flexShrink:0, padding:'0 14px', display:'flex', alignItems:'center', gap:8, borderRight:`1px solid ${COLORS.slate100}`, height:'100%' }}>
                <span style={{ fontSize:10, fontFamily:'var(--font-mono)', color:COLORS.slate400, fontWeight:500, minWidth:24 }}>#{a.id}</span>
                <div
                  onClick={() => onToggle(a.id)}
                  style={{
                    width:15, height:15, borderRadius:4,
                    border:`1.5px solid ${a.completada?COLORS.teal:'#CBD5E1'}`,
                    background:a.completada?COLORS.teal:'white',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    flexShrink:0, cursor:'pointer', color:'white', transition:'all 0.15s'
                  }}>
                  {a.completada && <Icon.Check/>}
                </div>
                <span style={{
                  fontSize:12, color:a.completada?COLORS.slate400:COLORS.ink,
                  textDecoration:a.completada?'line-through':'none',
                  overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                  fontWeight:500, flex:1, letterSpacing:'-0.01em'
                }}>{a.nombre}</span>

                {hoveredId === a.id && (
                  <div style={{ display:'flex', gap:2, flexShrink:0 }}>
                    <IconBtn onClick={() => onAbrirDetalle(a)} title="Ver detalles"><Icon.Info/></IconBtn>
                  </div>
                )}
              </div>

              {/* Timeline */}
              <div style={{ flex:1, position:'relative', height:'100%', overflow:'hidden' }}>
                {meses.map((m,mi) => <div key={mi} style={{ position:'absolute', left:m.px, top:0, bottom:0, width:1, background:COLORS.slate100 }}/>)}
                {timelineW > 0 && <div style={{ position:'absolute', left:dayToPx(hoy.toISOString().split('T')[0]), top:0, bottom:0, width:2, background:COLORS.red, opacity:0.12, zIndex:1 }}/>}
                {timelineW > 0 && (
                  <div style={{
                    position:'absolute', left:dayToPx(a.inicio), width:durToPx(a.inicio, a.fin),
                    top:'22%', height:'56%', background:colorBarra(a), borderRadius:5, zIndex:3,
                    opacity:a.estado==='Sin iniciar'&&!a.completada?0.5:1,
                    display:'flex', alignItems:'center', overflow:'hidden',
                    boxShadow:'0 1px 3px rgba(10,37,64,0.15)', cursor:'pointer'
                  }} onClick={() => onAbrirDetalle(a)}>
                    <div style={{ position:'absolute', left:0, top:0, height:'100%', width:`${a.avance}%`, background:'rgba(255,255,255,0.22)' }}/>
                    <span style={{ fontSize:10, color:'white', fontWeight:600, paddingLeft:8, position:'relative', zIndex:1, whiteSpace:'nowrap', fontFamily:'var(--font-mono)' }}>
                      {a.avance > 0 ? `${a.avance}%` : ''}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ============================================================
// TAB: KANBAN SEMANAL
// ============================================================
function TabKanban({ actividades, onAbrirDetalle }) {
  const hoy = new Date(); hoy.setHours(0,0,0,0)
  const manana = new Date(hoy); manana.setDate(manana.getDate()+1)
  const semana = new Date(hoy); semana.setDate(semana.getDate()+7)
  const cols = [
    { key:'retraso', label:'Con retraso', color:COLORS.red, bg:'#FEF2F2', items: actividades.filter(a => new Date(a.fin)<hoy && a.avance<100) },
    { key:'hoy', label:'Hoy', color:COLORS.navy2, bg:'#E0EDFF', items: actividades.filter(a => { const f=new Date(a.fin); f.setHours(0,0,0,0); return f.getTime()===hoy.getTime()&&a.avance<100 }) },
    { key:'manana', label:'Mañana', color:COLORS.teal, bg:COLORS.tealLight, items: actividades.filter(a => { const f=new Date(a.fin); f.setHours(0,0,0,0); return f.getTime()===manana.getTime()&&a.avance<100 }) },
    { key:'semana', label:'Esta semana', color:COLORS.gold, bg:'#FEF3C7', items: actividades.filter(a => { const f=new Date(a.fin); f.setHours(0,0,0,0); return f>manana&&f<=semana&&a.avance<100 }) },
  ]

  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14 }}>
      {cols.map(col => (
        <div key={col.key}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10, padding:'10px 14px', background:col.bg, borderRadius:10 }}>
            <span style={{ fontSize:12, fontWeight:600, color:col.color, letterSpacing:'-0.01em' }}>{col.label}</span>
            <span style={{ fontSize:11, fontWeight:600, color:col.color, background:'white', borderRadius:10, padding:'2px 8px', fontFamily:'var(--font-mono)' }}>{col.items.length}</span>
          </div>
          {col.items.length===0 && <div style={{ padding:20, textAlign:'center', color:COLORS.slate400, fontSize:12, border:`1px dashed ${COLORS.slate200}`, borderRadius:10 }}>Sin actividades</div>}
          {col.items.map(a => (
            <div key={a.id} onClick={() => onAbrirDetalle(a)} style={{
              background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:10, padding:14, marginBottom:8,
              cursor:'pointer', transition:'all 0.15s'
            }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(10,37,64,0.08)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}>
              <div style={{ fontSize:13, fontWeight:500, color:COLORS.ink, marginBottom:8, letterSpacing:'-0.01em' }}>{a.nombre}</div>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                <Avatar nombre={a.responsable} size={20}/>
                <span style={{ fontSize:11, color:COLORS.slate500 }}>{a.responsable}</span>
              </div>
              <div style={{ fontSize:10, color:COLORS.slate400, marginBottom:8, fontFamily:'var(--font-mono)' }}>Vence: {a.fin}</div>
              <BarraAvance avance={a.avance} color={col.color}/>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// ============================================================
// TAB: RESUMEN
// ============================================================
function TabResumen({ proyecto }) {
  const diasRestantes = Math.ceil((new Date(proyecto.cierre) - new Date()) / 86400000)
  return (
    <div style={{ display:'grid', gridTemplateColumns:'1.3fr 1fr', gap:24 }}>
      <div>
        <div style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, padding:24 }}>
          <h3 style={{ fontSize:11, fontWeight:600, color:COLORS.slate500, marginBottom:16, textTransform:'uppercase', letterSpacing:'0.08em' }}>Información general</h3>
          {[
            { label:'Cliente', value:proyecto.cliente },
            { label:'Director', value:proyecto.director },
            { label:'Equipo', value:proyecto.equipo.join(', ') },
            { label:'Inicio', value:proyecto.inicio },
            { label:'Cierre estimado', value:proyecto.cierre },
            { label:'Días restantes', value:diasRestantes>0?`${diasRestantes} días`:`${Math.abs(diasRestantes)} días de retraso` },
          ].map((item,i) => (
            <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'12px 0', borderBottom: i < 5 ? `1px solid ${COLORS.slate100}` : 'none' }}>
              <span style={{ fontSize:12, color:COLORS.slate500 }}>{item.label}</span>
              <span style={{ fontSize:13, fontWeight:500, color: item.label==='Días restantes'&&diasRestantes<0?COLORS.red:COLORS.ink, letterSpacing:'-0.01em' }}>{item.value}</span>
            </div>
          ))}
        </div>
        <div style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, padding:24, marginTop:16 }}>
          <h3 style={{ fontSize:11, fontWeight:600, color:COLORS.slate500, marginBottom:12, textTransform:'uppercase', letterSpacing:'0.08em' }}>Alcance</h3>
          <p style={{ fontSize:13, color:COLORS.slate600, lineHeight:1.65 }}>{proyecto.alcance}</p>
        </div>
      </div>
      <div>
        <div style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, padding:28, marginBottom:16, textAlign:'center' }}>
          <h3 style={{ fontSize:11, fontWeight:600, color:COLORS.slate500, marginBottom:16, textTransform:'uppercase', letterSpacing:'0.08em' }}>Avance general</h3>
          <div style={{ fontSize:56, fontWeight:400, color:COLORS.navy, fontFamily:'var(--font-serif)', lineHeight:1, marginBottom:12 }}>{proyecto.avance}%</div>
          <BarraAvance avance={proyecto.avance} color={COLORS.navy2}/>
        </div>
        <div style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, padding:24 }}>
          <h3 style={{ fontSize:11, fontWeight:600, color:COLORS.slate500, marginBottom:14, textTransform:'uppercase', letterSpacing:'0.08em' }}>Equipo</h3>
          {[proyecto.director, ...proyecto.equipo.filter(e => e !== proyecto.director)].map((n,i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0' }}>
              <Avatar nombre={n} size={32}/>
              <div>
                <div style={{ fontSize:13, fontWeight:500, color:COLORS.ink, letterSpacing:'-0.01em' }}>{n}</div>
                <div style={{ fontSize:11, color:COLORS.slate500 }}>{i === 0 ? 'Director de Proyecto' : 'Equipo'}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ============================================================
// DETALLE DE PROYECTO
// ============================================================
function DetalleProyecto({ proyecto, onVolver }) {
  const [tab, setTab] = useState('resumen')
  const [actividades, setActividades] = useState(proyecto.actividades)
  const [panelActividad, setPanelActividad] = useState(null)

  const toggleActividad = (id) => {
    setActividades(prev => prev.map(a =>
      a.id===id ? {...a, completada:!a.completada, avance:!a.completada?100:0, estado:!a.completada?'Completada':'Sin iniciar'} : a
    ))
  }

  const updateActividad = (updated) => {
    setActividades(prev => prev.map(a => a.id===updated.id ? updated : a))
  }

  const deleteActividad = (id) => {
    setActividades(prev => prev.filter(a => a.id !== id))
    setPanelActividad(null)
  }

  const agregarActividad = (fase) => {
    const newId = Math.max(...actividades.map(a=>a.id), 0) + 1
    const hoy = new Date().toISOString().split('T')[0]
    const semana = new Date(); semana.setDate(semana.getDate()+7)
    const semanaStr = semana.toISOString().split('T')[0]
    setActividades(prev => [...prev, {
      id:newId, nombre:'Nueva actividad', fase,
      responsable:proyecto.director, inicio:hoy, fin:semanaStr,
      avance:0, estado:'Sin iniciar', deps:[], completada:false,
      notas:'', checklist:[]
    }])
  }

  const tabs = [
    { key:'resumen', label:'Resumen' },
    { key:'actividades', label:'Actividades' },
    { key:'gantt', label:'Gantt' },
    { key:'kanban', label:'Kanban semanal' },
  ]

  return (
    <div>
      {panelActividad && (
        <PanelDetalle
          actividad={panelActividad}
          onClose={() => setPanelActividad(null)}
          onSave={(updated) => { updateActividad(updated); setPanelActividad(null) }}
          onDelete={(id) => deleteActividad(id)}
        />
      )}

      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', gap:16, marginBottom:28 }}>
        <button onClick={onVolver} style={{
          padding:'8px 12px', background:'white', border:`1px solid ${COLORS.slate200}`,
          borderRadius:8, fontSize:13, cursor:'pointer', color:COLORS.slate600,
          display:'flex', alignItems:'center', gap:6, fontFamily:'var(--font-sans)', fontWeight:500
        }}>
          <Icon.Back/> Proyectos
        </button>
        <div style={{ flex:1 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
            <span style={{ fontSize:11, fontFamily:'var(--font-mono)', color:COLORS.slate400, fontWeight:500 }}>{proyecto.id}</span>
            <Badge texto={proyecto.estado} mapa={ESTADOS_PROYECTO}/>
          </div>
          <h1 style={{ fontSize:28, fontWeight:500, color:COLORS.navy, margin:0, letterSpacing:'-0.02em', fontFamily:'var(--font-serif)', lineHeight:1.15 }}>{proyecto.nombre}</h1>
          <p style={{ fontSize:13, color:COLORS.slate500, margin:'4px 0 0' }}>{proyecto.cliente}</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', borderBottom:`1px solid ${COLORS.slate200}`, marginBottom:24, gap:4 }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding:'10px 18px', border:'none', background:'transparent', cursor:'pointer',
            fontSize:13, fontWeight: tab===t.key?600:500,
            color: tab===t.key?COLORS.navy:COLORS.slate500,
            borderBottom: tab===t.key?`2px solid ${COLORS.navy}`:'2px solid transparent',
            marginBottom:-1, fontFamily:'var(--font-sans)', letterSpacing:'-0.01em', transition:'all 0.15s'
          }}>{t.label}</button>
        ))}
      </div>

      {tab==='resumen' && <TabResumen proyecto={{...proyecto, actividades}}/>}
      {tab==='actividades' && <TabActividades
        actividades={actividades}
        onToggle={toggleActividad}
        onUpdate={updateActividad}
        onDelete={deleteActividad}
        onAgregar={agregarActividad}
        onAbrirDetalle={setPanelActividad}
      />}
      {tab==='gantt' && <TabGantt actividades={actividades} onToggle={toggleActividad} onAbrirDetalle={setPanelActividad}/>}
      {tab==='kanban' && <TabKanban actividades={actividades} onAbrirDetalle={setPanelActividad}/>}
    </div>
  )
}

// ============================================================
// LISTA DE PROYECTOS
// ============================================================
export default function Proyectos() {
  const [proyectoSeleccionado, setProyectoSeleccionado] = useState(null)

  if (proyectoSeleccionado) {
    return <DetalleProyecto proyecto={proyectoSeleccionado} onVolver={() => setProyectoSeleccionado(null)}/>
  }

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:28 }}>
        <div>
          <h1 style={{ fontSize:32, fontWeight:400, color:COLORS.navy, margin:0, letterSpacing:'-0.02em', fontFamily:'var(--font-serif)' }}>Proyectos</h1>
          <p style={{ color:COLORS.slate500, fontSize:13, marginTop:6 }}>{proyectosDemo.length} proyectos totales</p>
        </div>
        <button style={{
          padding:'10px 20px', background:COLORS.navy, color:'white',
          border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer',
          display:'flex', alignItems:'center', gap:6,
          fontFamily:'var(--font-sans)', letterSpacing:'-0.01em'
        }}>
          <Icon.Plus/> Nuevo proyecto
        </button>
      </div>

      <div style={{ display:'grid', gap:10 }}>
        {proyectosDemo.map(p => (
          <div key={p.id} onClick={() => setProyectoSeleccionado(p)}
            style={{
              background:'white', border:`1px solid ${COLORS.slate100}`,
              borderLeft:`3px solid ${ESTADOS_PROYECTO[p.estado]?.bar || COLORS.slate400}`,
              borderRadius:12, padding:'18px 22px', cursor:'pointer', transition:'all 0.15s'
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = COLORS.slate200; e.currentTarget.style.boxShadow='0 4px 16px rgba(10,37,64,0.06)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = COLORS.slate100; e.currentTarget.style.boxShadow='none' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                  <span style={{ fontSize:11, fontFamily:'var(--font-mono)', color:COLORS.slate400, fontWeight:500 }}>{p.id}</span>
                  <Badge texto={p.estado} mapa={ESTADOS_PROYECTO}/>
                </div>
                <div style={{ fontSize:17, fontWeight:500, color:COLORS.ink, letterSpacing:'-0.01em', marginBottom:3 }}>{p.nombre}</div>
                <div style={{ fontSize:12, color:COLORS.slate500 }}>{p.cliente} · {p.director}</div>
              </div>
              <div style={{ fontSize:11, color:COLORS.slate400, fontFamily:'var(--font-mono)' }}>Cierre: {p.cierre}</div>
            </div>
            <BarraAvance avance={p.avance} color={COLORS.navy2}/>
          </div>
        ))}
      </div>
    </div>
  )
}