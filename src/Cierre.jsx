import { useState, useEffect } from 'react'
import { getProyectos, getCierreChecklist, crearCierreItem, actualizarCierreItem } from './supabase'
import { COLORS, Badge, Icon } from './helpers'

export default function Cierre() {
  const [proyectos, setProyectos] = useState([])
  const [selId, setSelId] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { getProyectos().then(p => { setProyectos(p); setLoading(false) }) }, [])

  if (selId) return <CierreProyecto proyectoId={selId} onVolver={() => setSelId(null)}/>

  return (
    <div>
      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontSize:32, fontWeight:400, color:COLORS.navy, margin:0, letterSpacing:'-0.02em', fontFamily:'var(--font-serif)' }}>Cierre Administrativo</h1>
        <p style={{ color:COLORS.slate500, fontSize:13, marginTop:6 }}>Checklist de cierre por proyecto</p>
      </div>

      {loading && <div style={{ padding:40, textAlign:'center', color:COLORS.slate400 }}>Cargando...</div>}

      {!loading && proyectos.length === 0 && <div style={{ padding:40, textAlign:'center', color:COLORS.slate400, background:'white', borderRadius:12 }}>Sin proyectos</div>}

      {!loading && proyectos.length > 0 && (
        <div style={{ display:'grid', gap:10 }}>
          {proyectos.map(p => (
            <div key={p.id} onClick={() => setSelId(p.id)} style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, padding:'16px 22px', cursor:'pointer', transition:'all 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.boxShadow='0 4px 16px rgba(10,37,64,0.06)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow='none'}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <div style={{ fontSize:11, fontFamily:'var(--font-mono)', color:COLORS.slate400, marginBottom:4 }}>{p.codigo}</div>
                  <div style={{ fontSize:14, fontWeight:500, color:COLORS.ink }}>{p.nombre}</div>
                  <div style={{ fontSize:12, color:COLORS.slate500, marginTop:2 }}>{p.cliente?.razon_social}</div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <Badge texto={p.estado} mapa={{'Terminado':{bg:'#E1F5EE',color:'#0F6E56'},'En curso':{bg:'#E0EDFF',color:'#1B3A6B'},'Por iniciar':{bg:'#FEF3C7',color:'#D97706'},'Cancelado':{bg:'#FEF2F2',color:'#DC2626'},'En pausa':{bg:'#FEF2F2',color:'#DC2626'}}}/>
                  <span style={{ fontSize:11, color:COLORS.slate400, fontFamily:'var(--font-mono)' }}>{p.cierre}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const CHECKLIST_DEFAULT = [
  'Todas las actividades del proyecto completadas',
  'Documentos entregables subidos al expediente',
  'Facturación al 100% emitida',
  'Cobros al 100% recibidos',
  'Acta de cierre firmada con el cliente',
  'Encuesta de satisfacción enviada',
  'Lecciones aprendidas documentadas',
  'Archivo digital consolidado y respaldado',
  'Handoff a equipo de Postventa completado',
]

function CierreProyecto({ proyectoId, onVolver }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [nuevoItem, setNuevoItem] = useState('')

  const cargar = async () => {
    setLoading(true)
    let lista = await getCierreChecklist(proyectoId)
    if (lista.length === 0) {
      for (const texto of CHECKLIST_DEFAULT) await crearCierreItem(proyectoId, { item: texto })
      lista = await getCierreChecklist(proyectoId)
    }
    setItems(lista); setLoading(false)
  }
  useEffect(() => { cargar() }, [proyectoId])

  const toggle = async (item) => {
    await actualizarCierreItem(item.id, { hecho: !item.hecho, fecha_completado: !item.hecho ? new Date().toISOString().split('T')[0] : null })
    cargar()
  }

  const agregar = async () => {
    if (!nuevoItem.trim()) return
    await crearCierreItem(proyectoId, { item: nuevoItem })
    setNuevoItem(''); cargar()
  }

  const hechos = items.filter(i => i.hecho).length
  const progreso = items.length > 0 ? Math.round((hechos / items.length) * 100) : 0

  return (
    <div>
      <button onClick={onVolver} style={{ padding:'8px 12px', background:'white', border:`1px solid ${COLORS.slate200}`, borderRadius:8, fontSize:13, cursor:'pointer', color:COLORS.slate600, display:'flex', alignItems:'center', gap:6, marginBottom:20 }}>{Icon('Back')} Volver a cierres</button>

      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontSize:28, fontWeight:500, color:COLORS.navy, margin:0, fontFamily:'var(--font-serif)' }}>Checklist de Cierre</h1>
        <div style={{ marginTop:12, display:'flex', alignItems:'center', gap:16 }}>
          <div style={{ flex:1, height:10, background:COLORS.slate100, borderRadius:5, overflow:'hidden' }}>
            <div style={{ width:`${progreso}%`, height:'100%', background: progreso === 100 ? COLORS.teal : COLORS.navy2, transition:'width 0.3s' }}/>
          </div>
          <span style={{ fontSize:14, fontWeight:600, color:COLORS.navy, fontFamily:'var(--font-mono)' }}>{hechos}/{items.length}</span>
        </div>
      </div>

      {loading && <div style={{ padding:40, textAlign:'center', color:COLORS.slate400 }}>Cargando...</div>}

      {!loading && (
        <div style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, padding:20 }}>
          {items.map(item => (
            <div key={item.id} onClick={() => toggle(item)} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 0', borderBottom:`1px solid ${COLORS.slate100}`, cursor:'pointer' }}>
              <div style={{ width:22, height:22, borderRadius:6, border:`2px solid ${item.hecho?COLORS.teal:'#CBD5E1'}`, background:item.hecho?COLORS.teal:'white', display:'flex', alignItems:'center', justifyContent:'center', color:'white', flexShrink:0 }}>
                {item.hecho && Icon('Check')}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, color: item.hecho ? COLORS.slate400 : COLORS.ink, textDecoration: item.hecho ? 'line-through' : 'none' }}>{item.item}</div>
                {item.fecha_completado && <div style={{ fontSize:10, color:COLORS.slate400, fontFamily:'var(--font-mono)', marginTop:2 }}>✓ {item.fecha_completado}</div>}
              </div>
            </div>
          ))}
          <div style={{ display:'flex', gap:8, marginTop:16, paddingTop:16, borderTop:`1px solid ${COLORS.slate100}` }}>
            <input value={nuevoItem} onChange={e=>setNuevoItem(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') agregar() }} placeholder="Agregar item al checklist..." style={{ flex:1, padding:'10px 12px', border:`1px solid ${COLORS.slate200}`, borderRadius:8, fontSize:13, outline:'none', fontFamily:'var(--font-sans)' }}/>
            <button onClick={agregar} style={{ padding:'10px 18px', background:COLORS.navy, color:'white', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer' }}>{Icon('Plus')}</button>
          </div>
        </div>
      )}
    </div>
  )
}