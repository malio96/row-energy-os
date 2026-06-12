import { useState, useEffect, useMemo } from 'react'
import { getProyectos, getCierreChecklist, actualizarCierreItem, crearCierreItem } from './supabase'
import { COLORS, Badge, fmtMoney, inputStyle, selectStyle, labelStyle, btnPrimary, btnSecondary, Icon, EmptyState, LoadingState, useIsMobile, loadPref, savePref, SortControl, aplicarSort } from './helpers'

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
  const [sort, setSort] = useState(() => loadPref('sort.cierre', { field:'cierre', dir:'asc' }))
  const isMobile = useIsMobile()

  useEffect(() => {
    getProyectos().then(ps => {
      setProyectos(ps.filter(p => p.estado === 'Terminado' || p.estado === 'En cierre'))
      setLoading(false)
    })
  }, [])
  useEffect(() => { savePref('sort.cierre', sort) }, [sort])

  const itemsOrdenados = useMemo(() => aplicarSort(proyectos, sort, {
    cierre: p => p.cierre || '9999-12-31',
    nombre: p => (p.nombre || '').toLowerCase(),
    codigo: p => p.codigo || '',
    cliente: p => (p.cliente?.razon_social || '').toLowerCase(),
    estado: p => p.estado || '',
  }), [proyectos, sort])

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
        <>
          <div style={{ display:'flex', gap:8, marginBottom:12, flexWrap:'wrap', justifyContent:'flex-end' }}>
            <SortControl value={sort} onChange={setSort} fields={[
              { key:'cierre', label:'Fecha cierre' },
              { key:'nombre', label:'Alfabético' },
              { key:'codigo', label:'Código' },
              { key:'cliente', label:'Cliente' },
              { key:'estado', label:'Estado' },
            ]}/>
          </div>
          <TablaCierre items={itemsOrdenados} onSelect={setSelId} isMobile={isMobile}/>
        </>
      )}
    </div>
  )
}

const ESTADO_MAPA = { 'Terminado':{bg:'#E1F5EE', color:'#0F6E56'}, 'En cierre':{bg:'#FEF3C7', color:'#D97706'} }

function TablaCierre({ items, onSelect, isMobile }) {
  const cols = isMobile ? 'minmax(0,1fr) 90px' : 'minmax(0,1fr) 100px 120px 100px 24px'
  return (
    <div style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, overflow:'hidden' }}>
      <div style={{ display:'grid', gridTemplateColumns:cols, padding:'10px 16px', borderBottom:`1px solid ${COLORS.slate100}`, fontSize:10, fontWeight:700, color:COLORS.slate500, textTransform:'uppercase', letterSpacing:'0.04em', gap:8 }}>
        <span>Proyecto</span>
        <span>Estado</span>
        {!isMobile && <span style={{ textAlign:'right' }}>Monto</span>}
        {!isMobile && <span>Cierre</span>}
        {!isMobile && <span/>}
      </div>
      {items.map(p => (
        <div key={p.id} onClick={() => onSelect(p.id)}
          onMouseEnter={e => e.currentTarget.style.background = COLORS.slate50}
          onMouseLeave={e => e.currentTarget.style.background = 'white'}
          style={{ display:'grid', gridTemplateColumns:cols, padding:'12px 16px', borderBottom:`1px solid ${COLORS.slate100}`, alignItems:'center', fontSize:13, cursor:'pointer', gap:8 }}>
          <div style={{ minWidth:0 }}>
            <div style={{ fontWeight:500, color:COLORS.ink, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{p.nombre}</div>
            <div style={{ fontSize:11, color:COLORS.slate500, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
              <span style={{ fontFamily:'var(--font-mono)', fontWeight:600 }}>{p.codigo}</span>
              {p.cliente?.razon_social ? ` · ${p.cliente.razon_social}` : ''}
            </div>
          </div>
          <div><Badge texto={p.estado} mapa={ESTADO_MAPA}/></div>
          {!isMobile && <div style={{ fontFamily:'var(--font-mono)', fontSize:12, color:COLORS.ink, textAlign:'right' }}>{fmtMoney(p.monto_contrato, true)}</div>}
          {!isMobile && <div style={{ fontSize:11, color:COLORS.slate500, fontFamily:'var(--font-mono)' }}>{p.cierre || '—'}</div>}
          {!isMobile && <div style={{ color:COLORS.slate400, display:'flex', justifyContent:'flex-end' }}>{Icon('Back')}</div>}
        </div>
      ))}
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