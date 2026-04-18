import { useState } from 'react'

const proyectosDemo = [
  {
    id: 'PRY-001',
    nombre: 'Instalación Solar — Planta Bajio',
    cliente: 'Grupo Industrial del Bajio',
    director: 'Carlos Mendez',
    equipo: ['Carlos Mendez', 'Sofia Ruiz'],
    estado: 'En curso',
    avance: 45,
    inicio: '2026-03-01',
    cierre: '2026-06-30',
    alcance: 'Instalación de sistema fotovoltaico de 500 kWp en planta industrial. Incluye paneles, inversores, estructura y conexión a red.',
    bloqueado: false,
    actividades: [
      { id:'A1', nombre:'Estudio de sitio', fase:'Fase 1 — Ingeniería', responsable:'Carlos Mendez', inicio:'2026-03-01', fin:'2026-03-15', avance:100, estado:'Completada', deps:[] },
      { id:'A2', nombre:'Diseño del sistema', fase:'Fase 1 — Ingeniería', responsable:'Sofia Ruiz', inicio:'2026-03-16', fin:'2026-03-31', avance:100, estado:'Completada', deps:['A1'] },
      { id:'A3', nombre:'Gestión de permisos', fase:'Fase 2 — Permisos', responsable:'Carlos Mendez', inicio:'2026-04-01', fin:'2026-04-20', avance:80, estado:'En progreso', deps:['A2'] },
      { id:'A4', nombre:'Compra de equipos', fase:'Fase 2 — Permisos', responsable:'Sofia Ruiz', inicio:'2026-04-01', fin:'2026-04-15', avance:100, estado:'Completada', deps:['A2'] },
      { id:'A5', nombre:'Instalación estructura', fase:'Fase 3 — Instalación', responsable:'Carlos Mendez', inicio:'2026-04-21', fin:'2026-05-15', avance:20, estado:'En progreso', deps:['A3','A4'] },
      { id:'A6', nombre:'Instalación paneles', fase:'Fase 3 — Instalación', responsable:'Sofia Ruiz', inicio:'2026-05-16', fin:'2026-06-05', avance:0, estado:'Sin iniciar', deps:['A5'] },
      { id:'A7', nombre:'Conexión eléctrica', fase:'Fase 3 — Instalación', responsable:'Carlos Mendez', inicio:'2026-06-06', fin:'2026-06-20', avance:0, estado:'Sin iniciar', deps:['A6'] },
      { id:'A8', nombre:'Pruebas y puesta en marcha', fase:'Fase 4 — Cierre', responsable:'Carlos Mendez', inicio:'2026-06-21', fin:'2026-06-28', avance:0, estado:'Sin iniciar', deps:['A7'] },
      { id:'A9', nombre:'Entrega y documentación', fase:'Fase 4 — Cierre', responsable:'Sofia Ruiz', inicio:'2026-06-29', fin:'2026-06-30', avance:0, estado:'Sin iniciar', deps:['A8'] },
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
    alcance: 'Auditoría energética completa de bodega industrial. Análisis de consumo, identificación de oportunidades de ahorro y reporte final.',
    bloqueado: false,
    actividades: [
      { id:'B1', nombre:'Levantamiento de datos', fase:'Fase 1', responsable:'Sofia Ruiz', inicio:'2026-02-01', fin:'2026-02-15', avance:100, estado:'Completada', deps:[] },
      { id:'B2', nombre:'Análisis de consumo', fase:'Fase 2', responsable:'Sofia Ruiz', inicio:'2026-02-16', fin:'2026-03-10', avance:100, estado:'Completada', deps:['B1'] },
      { id:'B3', nombre:'Reporte final', fase:'Fase 3', responsable:'Sofia Ruiz', inicio:'2026-03-11', fin:'2026-03-31', avance:100, estado:'Completada', deps:['B2'] },
    ]
  },
]

const COLORES_ESTADO = {
  'Completada': { bg:'#E1F5EE', color:'#0F6E56' },
  'En progreso': { bg:'#D6E4F7', color:'#1B3A6B' },
  'Sin iniciar': { bg:'#F1F5F9', color:'#64748B' },
  'Retrasada':   { bg:'#FEF2F2', color:'#DC2626' },
  'Bloqueada':   { bg:'#FEF3C7', color:'#D97706' },
}

const COLORES_PROYECTO = {
  'En curso':    { bg:'#D6E4F7', color:'#1B3A6B' },
  'Terminado':   { bg:'#E1F5EE', color:'#0F6E56' },
  'Por iniciar': { bg:'#FEF3C7', color:'#D97706' },
  'En pausa':    { bg:'#FEF2F2', color:'#DC2626' },
}

function Badge({ texto, mapa }) {
  const c = mapa[texto] || { bg:'#F1F5F9', color:'#64748B' }
  return (
    <span style={{ fontSize:12, fontWeight:600, padding:'3px 10px', borderRadius:20, background:c.bg, color:c.color }}>
      {texto}
    </span>
  )
}

function BarraAvance({ avance, color='#1B3A6B' }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
      <div style={{ flex:1, height:6, background:'#E2E8F0', borderRadius:3 }}>
        <div style={{ width:`${avance}%`, height:'100%', background:color, borderRadius:3, transition:'width 0.3s' }}/>
      </div>
      <span style={{ fontSize:12, fontWeight:600, color, minWidth:32 }}>{avance}%</span>
    </div>
  )
}

function TabActividades({ actividades }) {
  const fases = [...new Set(actividades.map(a => a.fase))]
  return (
    <div>
      {fases.map(fase => (
        <div key={fase} style={{ marginBottom:24 }}>
          <div style={{ fontSize:13, fontWeight:600, color:'#1B3A6B', padding:'8px 0', borderBottom:'2px solid #1B3A6B', marginBottom:8 }}>{fase}</div>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ background:'#F8FAFC' }}>
                {['ID','Actividad','Responsable','Inicio','Fin','Avance','Estado','Deps'].map(h => (
                  <th key={h} style={{ padding:'8px 12px', textAlign:'left', fontSize:11, fontWeight:600, color:'#64748B', textTransform:'uppercase', letterSpacing:'0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {actividades.filter(a => a.fase === fase).map(a => (
                <tr key={a.id} style={{ borderBottom:'1px solid #F1F5F9' }}>
                  <td style={{ padding:'10px 12px', fontSize:12, fontFamily:'monospace', color:'#94A3B8' }}>{a.id}</td>
                  <td style={{ padding:'10px 12px', fontSize:13, fontWeight:500, color:'#1C2128' }}>{a.nombre}</td>
                  <td style={{ padding:'10px 12px', fontSize:13, color:'#64748B' }}>{a.responsable}</td>
                  <td style={{ padding:'10px 12px', fontSize:12, color:'#64748B' }}>{a.inicio}</td>
                  <td style={{ padding:'10px 12px', fontSize:12, color:'#64748B' }}>{a.fin}</td>
                  <td style={{ padding:'10px 12px', minWidth:120 }}><BarraAvance avance={a.avance} /></td>
                  <td style={{ padding:'10px 12px' }}><Badge texto={a.estado} mapa={COLORES_ESTADO} /></td>
                  <td style={{ padding:'10px 12px', fontSize:12, color:'#94A3B8' }}>{a.deps.join(', ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}

function TabGantt({ actividades }) {
  const hoy = new Date()
  const fechaMin = new Date(Math.min(...actividades.map(a => new Date(a.inicio))))
  const fechaMax = new Date(Math.max(...actividades.map(a => new Date(a.fin))))
  const totalDias = Math.ceil((fechaMax - fechaMin) / 86400000) + 1
  const diasHoy = Math.ceil((hoy - fechaMin) / 86400000)

  const getPct = (fecha) => Math.max(0, Math.min(100, (Math.ceil((new Date(fecha) - fechaMin) / 86400000) / totalDias) * 100))
  const getAncho = (inicio, fin) => Math.max(1, ((new Date(fin) - new Date(inicio)) / 86400000 / totalDias) * 100)

  const colorBarra = (a) => {
    if (a.estado === 'Completada') return '#0F6E56'
    if (new Date(a.fin) < hoy && a.avance < 100) return '#DC2626'
    if (a.estado === 'Bloqueada') return '#D97706'
    return '#1B3A6B'
  }

  return (
    <div style={{ overflowX:'auto' }}>
      <div style={{ minWidth:800, position:'relative' }}>
        {/* Header meses */}
        <div style={{ display:'flex', marginLeft:240, marginBottom:4 }}>
          {['Mar','Abr','May','Jun'].map((m,i) => (
            <div key={i} style={{ flex:1, textAlign:'center', fontSize:12, fontWeight:600, color:'#64748B', padding:'4px 0', borderLeft:'1px solid #E2E8F0' }}>{m} 2026</div>
          ))}
        </div>

        {/* Linea de hoy */}
        <div style={{ position:'absolute', left:`calc(240px + ${diasHoy/totalDias*100}%)`, top:24, bottom:0, width:2, background:'#DC2626', zIndex:10, opacity:0.7 }}>
          <div style={{ position:'absolute', top:-16, left:-16, fontSize:10, fontWeight:700, color:'#DC2626', whiteSpace:'nowrap' }}>HOY</div>
        </div>

        {/* Filas */}
        {actividades.map(a => (
          <div key={a.id} style={{ display:'flex', alignItems:'center', borderBottom:'1px solid #F1F5F9', height:36 }}>
            {/* Nombre */}
            <div style={{ width:240, flexShrink:0, padding:'0 12px', fontSize:12, color:'#1C2128', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              <span style={{ fontFamily:'monospace', fontSize:10, color:'#94A3B8', marginRight:6 }}>{a.id}</span>
              {a.nombre}
            </div>
            {/* Barra */}
            <div style={{ flex:1, position:'relative', height:'100%', background:'#F8FAFC' }}>
              <div style={{
                position:'absolute',
                left:`${getPct(a.inicio)}%`,
                width:`${getAncho(a.inicio, a.fin)}%`,
                top:'20%', height:'60%',
                background:colorBarra(a),
                borderRadius:4,
                opacity: a.estado === 'Sin iniciar' ? 0.4 : 1,
                display:'flex', alignItems:'center', paddingLeft:4, overflow:'hidden'
              }}>
                {/* Progreso dentro de la barra */}
                <div style={{ position:'absolute', left:0, top:0, height:'100%', width:`${a.avance}%`, background:'rgba(255,255,255,0.3)', borderRadius:4 }}/>
                <span style={{ fontSize:10, color:'white', fontWeight:600, position:'relative', zIndex:1, whiteSpace:'nowrap' }}>
                  {a.avance > 0 ? `${a.avance}%` : ''}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function TabKanban({ actividades }) {
  const hoy = new Date()
  hoy.setHours(0,0,0,0)
  const manana = new Date(hoy); manana.setDate(manana.getDate()+1)
  const semana = new Date(hoy); semana.setDate(semana.getDate()+7)

  const cols = [
    { key:'retraso', label:'Con retraso', color:'#DC2626', bg:'#FEF2F2',
      items: actividades.filter(a => new Date(a.fin) < hoy && a.avance < 100) },
    { key:'hoy', label:'Hoy', color:'#1B3A6B', bg:'#D6E4F7',
      items: actividades.filter(a => { const f=new Date(a.fin); f.setHours(0,0,0,0); return f.getTime()===hoy.getTime() && a.avance<100 }) },
    { key:'manana', label:'Mañana', color:'#0F6E56', bg:'#E1F5EE',
      items: actividades.filter(a => { const f=new Date(a.fin); f.setHours(0,0,0,0); return f.getTime()===manana.getTime() && a.avance<100 }) },
    { key:'semana', label:'Esta semana', color:'#D97706', bg:'#FEF3C7',
      items: actividades.filter(a => { const f=new Date(a.fin); f.setHours(0,0,0,0); return f>manana && f<=semana && a.avance<100 }) },
  ]

  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16 }}>
      {cols.map(col => (
        <div key={col.key}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12, padding:'8px 12px', background:col.bg, borderRadius:8 }}>
            <span style={{ fontSize:13, fontWeight:700, color:col.color }}>{col.label}</span>
            <span style={{ fontSize:12, fontWeight:700, color:col.color, background:'white', borderRadius:10, padding:'2px 8px' }}>{col.items.length}</span>
          </div>
          {col.items.length === 0 && (
            <div style={{ padding:16, textAlign:'center', color:'#94A3B8', fontSize:13, border:'1px dashed #E2E8F0', borderRadius:8 }}>Sin actividades</div>
          )}
          {col.items.map(a => (
            <div key={a.id} style={{ background:'white', border:'1px solid #E2E8F0', borderRadius:8, padding:12, marginBottom:8 }}>
              <div style={{ fontSize:13, fontWeight:600, color:'#1C2128', marginBottom:6 }}>{a.nombre}</div>
              <div style={{ fontSize:11, color:'#64748B', marginBottom:8 }}>👤 {a.responsable}</div>
              <div style={{ fontSize:11, color:'#64748B', marginBottom:8 }}>📅 {a.fin}</div>
              <BarraAvance avance={a.avance} color={col.color} />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function TabResumen({ proyecto }) {
  const diasRestantes = Math.ceil((new Date(proyecto.cierre) - new Date()) / 86400000)
  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:24 }}>
      <div>
        <h3 style={{ fontSize:14, fontWeight:600, color:'#64748B', marginBottom:12, textTransform:'uppercase', letterSpacing:'0.05em' }}>Información general</h3>
        {[
          { label:'Cliente', value: proyecto.cliente },
          { label:'Director', value: proyecto.director },
          { label:'Equipo', value: proyecto.equipo.join(', ') },
          { label:'Inicio', value: proyecto.inicio },
          { label:'Cierre estimado', value: proyecto.cierre },
          { label:'Días restantes', value: diasRestantes > 0 ? `${diasRestantes} días` : `${Math.abs(diasRestantes)} días de retraso` },
        ].map((item,i) => (
          <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid #F1F5F9' }}>
            <span style={{ fontSize:13, color:'#64748B' }}>{item.label}</span>
            <span style={{ fontSize:13, fontWeight:500, color: item.label==='Días restantes' && diasRestantes < 0 ? '#DC2626' : '#1C2128' }}>{item.value}</span>
          </div>
        ))}
      </div>
      <div>
        <h3 style={{ fontSize:14, fontWeight:600, color:'#64748B', marginBottom:12, textTransform:'uppercase', letterSpacing:'0.05em' }}>Avance general</h3>
        <div style={{ background:'#F8FAFC', borderRadius:12, padding:20, marginBottom:16 }}>
          <div style={{ fontSize:48, fontWeight:700, color:'#1B3A6B', textAlign:'center' }}>{proyecto.avance}%</div>
          <BarraAvance avance={proyecto.avance} color='#1B3A6B' />
        </div>
        <h3 style={{ fontSize:14, fontWeight:600, color:'#64748B', marginBottom:8, textTransform:'uppercase', letterSpacing:'0.05em' }}>Alcance</h3>
        <p style={{ fontSize:13, color:'#475569', lineHeight:1.6, background:'#F8FAFC', padding:12, borderRadius:8 }}>{proyecto.alcance}</p>
      </div>
    </div>
  )
}

function DetalleProyecto({ proyecto, onVolver }) {
  const [tab, setTab] = useState('resumen')
  const tabs = [
    { key:'resumen', label:'Resumen' },
    { key:'actividades', label:'Actividades' },
    { key:'gantt', label:'Gantt' },
    { key:'kanban', label:'Kanban semanal' },
  ]

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:24 }}>
        <button onClick={onVolver} style={{ padding:'6px 12px', background:'transparent', border:'1px solid #E2E8F0', borderRadius:8, fontSize:13, cursor:'pointer', color:'#64748B' }}>
          ← Volver
        </button>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontSize:13, fontFamily:'monospace', color:'#94A3B8' }}>{proyecto.id}</span>
            <Badge texto={proyecto.estado} mapa={COLORES_PROYECTO} />
          </div>
          <h1 style={{ fontSize:20, fontWeight:700, color:'#1B3A6B', margin:'4px 0 0' }}>{proyecto.nombre}</h1>
          <p style={{ fontSize:13, color:'#64748B', margin:0 }}>{proyecto.cliente}</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', borderBottom:'2px solid #E2E8F0', marginBottom:24 }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding:'10px 20px', border:'none', background:'transparent', cursor:'pointer',
            fontSize:14, fontWeight: tab===t.key ? 600 : 400,
            color: tab===t.key ? '#1B3A6B' : '#64748B',
            borderBottom: tab===t.key ? '2px solid #1B3A6B' : '2px solid transparent',
            marginBottom:-2
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Contenido tab */}
      <div>
        {tab==='resumen' && <TabResumen proyecto={proyecto} />}
        {tab==='actividades' && <TabActividades actividades={proyecto.actividades} />}
        {tab==='gantt' && <TabGantt actividades={proyecto.actividades} />}
        {tab==='kanban' && <TabKanban actividades={proyecto.actividades} />}
      </div>
    </div>
  )
}

export default function Proyectos() {
  const [proyectoSeleccionado, setProyectoSeleccionado] = useState(null)

  if (proyectoSeleccionado) {
    return <DetalleProyecto proyecto={proyectoSeleccionado} onVolver={() => setProyectoSeleccionado(null)} />
  }

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:24, fontWeight:700, color:'#1B3A6B', margin:0 }}>Proyectos</h1>
          <p style={{ color:'#64748B', fontSize:14, marginTop:4 }}>{proyectosDemo.length} proyectos totales</p>
        </div>
        <button style={{ padding:'10px 20px', background:'#1B3A6B', color:'white', border:'none', borderRadius:8, fontSize:14, fontWeight:600, cursor:'pointer' }}>
          + Nuevo proyecto
        </button>
      </div>

      <div style={{ display:'grid', gap:12 }}>
        {proyectosDemo.map(p => (
          <div key={p.id} onClick={() => setProyectoSeleccionado(p)}
            style={{ background:'white', border:'1px solid #E2E8F0', borderLeft:`4px solid ${p.estado==='Terminado'?'#0F6E56':p.estado==='En curso'?'#1B3A6B':'#D97706'}`, borderRadius:12, padding:20, cursor:'pointer', transition:'box-shadow 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.boxShadow='0 4px 16px rgba(0,0,0,0.08)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow='none'}
          >
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
              <div>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                  <span style={{ fontSize:12, fontFamily:'monospace', color:'#94A3B8' }}>{p.id}</span>
                  <Badge texto={p.estado} mapa={COLORES_PROYECTO} />
                </div>
                <div style={{ fontSize:16, fontWeight:600, color:'#1C2128' }}>{p.nombre}</div>
                <div style={{ fontSize:13, color:'#64748B' }}>{p.cliente} · Director: {p.director}</div>
              </div>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:12, color:'#64748B' }}>Cierre: {p.cierre}</div>
              </div>
            </div>
            <BarraAvance avance={p.avance} color={p.estado==='Terminado'?'#0F6E56':'#1B3A6B'} />
          </div>
        ))}
      </div>
    </div>
  )
}