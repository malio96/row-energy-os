import { useState, useEffect } from 'react'
import { getProyectos, getCierreChecklist, actualizarCierreItem, crearCierreItem } from './supabase'
import { COLORS, Badge, fmtMoney, inputStyle, selectStyle, labelStyle, btnPrimary, btnSecondary, Icon, EmptyState, LoadingState, useIsMobile } from './helpers'

const CHECKLIST_TEMPLATE = [
  'Todas las actividades completadas',
  'Documentos entregables subidos al expediente',
  'Facturación al 100% emitida',
  'Cobros al 100% recibidos',
  'Acta de cierre firmada con el cliente',
  'Encuesta de satisfacción enviada',
  'Lecciones aprendidas documentadas',
  'Archivo digital consolidado',
  'Handoff a Postventa completado',
]

export default function Cierre({ usuario }) {
  const [proyectos, setProyectos] = useState([])
  const [selId, setSelId] = useState(null)
  const [loading, setLoading] = useState(true)
  const isMobile = useIsMobile()

  useEffect(() => {
    getProyectos().then(ps => {
      setProyectos(ps.filter(p => p.estado === 'Terminado' || p.estado === 'En cierre'))
      setLoading(false)
    })
  }, [])

  if (selId) return <CierreDetalle proyectoId={selId} onVolver={() => setSelId(null)} usuario={usuario}/>

  return (
    <div>
      <div style={{ marginBottom:16 }}>
        <h1 style={{ fontSize: isMobile ? 24 : 32, fontWeight:400, color:COLORS.navy, margin:0, letterSpacing:'-0.02em', fontFamily:'var(--font-sans)' }}>Cierre Administrativo</h1>
        <p style={{ color:COLORS.slate500, fontSize:12, marginTop:4 }}>Proyectos terminados o en proceso de cierre</p>
      </div>

      {loading && <LoadingState/>}
      {!loading && proyectos.length === 0 && <EmptyState titulo="Sin proyectos por cerrar" descripcion="Los proyectos aparecen aquí cuando están en estado 'En cierre' o 'Terminado'"/>}

      {!loading && proyectos.length > 0 && (
        <div style={{ display:'grid', gap:10 }}>
          {proyectos.map(p => <ProyectoCard key={p.id} p={p} onClick={() => setSelId(p.id)}/>)}
        </div>
      )}
    </div>
  )
}

function ProyectoCard({ p, onClick }) {
  return (
    <div onClick={onClick} style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderLeft:`3px solid ${p.estado === 'Terminado' ? COLORS.teal : COLORS.amber}`, borderRadius:10, padding:14, cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center', gap:12 }}>
      <div>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
          <span style={{ fontSize:11, fontFamily:'var(--font-mono)', color:COLORS.slate500, fontWeight:600 }}>{p.codigo}</span>
          <Badge texto={p.estado} mapa={{ 'Terminado':{bg:'#E1F5EE', color:'#0F6E56'}, 'En cierre':{bg:'#FEF3C7', color:'#D97706'} }}/>
        </div>
        <div style={{ fontSize:14, fontWeight:500, color:COLORS.ink }}>{p.nombre}</div>
        <div style={{ fontSize:11, color:COLORS.slate500 }}>{p.cliente?.razon_social} · {fmtMoney(p.monto_contrato, true)}</div>
      </div>
      <div style={{ color:COLORS.slate400 }}>{Icon('Back')}</div>
    </div>
  )
}

function CierreDetalle({ proyectoId, onVolver, usuario }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const isMobile = useIsMobile()

  const cargar = async () => { setLoading(true); setItems(await getCierreChecklist(proyectoId)); setLoading(false) }
  useEffect(() => { cargar() }, [proyectoId])

  const toggle = async (item) => {
    await actualizarCierreItem(item.id, { hecho: !item.hecho, fecha_completado: !item.hecho ? new Date().toISOString().split('T')[0] : null })
    cargar()
  }

  const inicializar = async () => {
    if (items.length > 0) return
    for (let i = 0; i < CHECKLIST_TEMPLATE.length; i++) {
      await crearCierreItem({ proyecto_id: proyectoId, orden: i+1, item: CHECKLIST_TEMPLATE[i], hecho: false })
    }
    cargar()
  }

  const hechos = items.filter(i => i.hecho).length
  const pct = items.length > 0 ? Math.round(hechos / items.length * 100) : 0

  return (
    <div>
      <button onClick={onVolver} style={{ ...btnSecondary, marginBottom:16 }}>{Icon('Back')} Proyectos en cierre</button>

      <div style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, padding:20, marginBottom:14 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12, flexWrap:'wrap', gap:10 }}>
          <h2 style={{ fontSize:18, fontWeight:500, margin:0, color:COLORS.navy, fontFamily:'var(--font-sans)' }}>Checklist de cierre</h2>
          <div style={{ fontSize:14, fontWeight:600, color: pct === 100 ? COLORS.teal : COLORS.navy, fontFamily:'var(--font-mono)' }}>{hechos}/{items.length} ({pct}%)</div>
        </div>
        <div style={{ height:8, background:COLORS.slate100, borderRadius:4, overflow:'hidden' }}>
          <div style={{ width:`${pct}%`, height:'100%', background: pct === 100 ? COLORS.teal : COLORS.navy2, transition:'width 0.3s' }}/>
        </div>
      </div>

      {loading && <LoadingState/>}
      {!loading && items.length === 0 && (
        <EmptyState titulo="Sin checklist" descripcion="Inicializa el checklist estándar de cierre" accion={<button onClick={inicializar} style={btnPrimary}>+ Inicializar checklist</button>}/>
      )}

      {!loading && items.length > 0 && (
        <div style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, overflow:'hidden' }}>
          {items.map(item => (
            <div key={item.id} onClick={() => toggle(item)} style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 18px', borderBottom:`1px solid ${COLORS.slate100}`, cursor:'pointer', background: item.hecho ? COLORS.slate50 : 'white' }}>
              <div style={{ width:22, height:22, borderRadius:6, border:`2px solid ${item.hecho ? COLORS.teal : COLORS.slate300}`, background: item.hecho ? COLORS.teal : 'white', display:'flex', alignItems:'center', justifyContent:'center', color:'white', flexShrink:0 }}>
                {item.hecho && Icon('Check')}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:500, color: item.hecho ? COLORS.slate500 : COLORS.ink, textDecoration: item.hecho ? 'line-through' : 'none' }}>{item.item}</div>
                {item.notas && <div style={{ fontSize:11, color:COLORS.slate500, marginTop:2 }}>{item.notas}</div>}
                {item.fecha_completado && <div style={{ fontSize:10, color:COLORS.slate400, marginTop:2, fontFamily:'var(--font-mono)' }}>Completado {item.fecha_completado}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}