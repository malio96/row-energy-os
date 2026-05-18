import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './supabase'
import { COLORS, fmtDate, useIsMobile, Icon, LoadingState, EmptyState, SortControl, aplicarSort, loadPref, savePref, Badge } from './helpers'

export default function Auditoria({ usuario }) {
  const [eventos, setEventos] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const navigate = useNavigate()
  const isMobile = useIsMobile()

  // Filtros (persistidos)
  const [filtroUsuario, setFiltroUsuario] = useState(() => loadPref('audit.user', 'todos'))
  const [filtroModulo, setFiltroModulo] = useState(() => loadPref('audit.modulo', 'todos'))
  const [filtroEvento, setFiltroEvento] = useState(() => loadPref('audit.evento', 'todos'))
  const [busqueda, setBusqueda] = useState('')
  const [diasAtras, setDiasAtras] = useState(() => loadPref('audit.dias', 7))  // últimos N días
  const [sort, setSort] = useState(() => loadPref('sort.auditoria', { field:'fecha', dir:'desc' }))

  useEffect(() => savePref('audit.user', filtroUsuario), [filtroUsuario])
  useEffect(() => savePref('audit.modulo', filtroModulo), [filtroModulo])
  useEffect(() => savePref('audit.evento', filtroEvento), [filtroEvento])
  useEffect(() => savePref('audit.dias', diasAtras), [diasAtras])
  useEffect(() => savePref('sort.auditoria', sort), [sort])

  // Cargar
  const cargar = async () => {
    setLoading(true); setError(null)
    try {
      const desde = new Date(); desde.setDate(desde.getDate() - diasAtras)
      const [evRes, uRes] = await Promise.all([
        supabase.from('auditoria_eventos')
          .select('*')
          .gte('created_at', desde.toISOString())
          .order('created_at', { ascending: false })
          .limit(2000),
        supabase.from('usuarios').select('id, nombre, email, rol').order('nombre')
      ])
      if (evRes.error) throw evRes.error
      if (uRes.error) throw uRes.error
      setEventos(evRes.data || [])
      setUsuarios(uRes.data || [])
    } catch (e) {
      setError(e.message || 'Error cargando auditoría')
    }
    setLoading(false)
  }
  useEffect(() => { cargar() }, [diasAtras])

  // Map usuario_id -> nombre
  const userMap = useMemo(() => {
    const m = {}
    for (const u of usuarios) m[u.id] = u
    return m
  }, [usuarios])

  // Lista de módulos únicos vistos en eventos
  const modulosDisponibles = useMemo(() => {
    return [...new Set(eventos.map(e => e.modulo).filter(Boolean))].sort()
  }, [eventos])

  const eventosDisponibles = useMemo(() => {
    return [...new Set(eventos.map(e => e.evento).filter(Boolean))].sort()
  }, [eventos])

  const filtrados = useMemo(() => {
    let r = eventos
    if (filtroUsuario !== 'todos') r = r.filter(e => e.usuario_id === filtroUsuario)
    if (filtroModulo !== 'todos') r = r.filter(e => e.modulo === filtroModulo)
    if (filtroEvento !== 'todos') r = r.filter(e => e.evento === filtroEvento)
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase()
      r = r.filter(e =>
        (userMap[e.usuario_id]?.nombre || '').toLowerCase().includes(q) ||
        (e.modulo || '').toLowerCase().includes(q) ||
        (e.evento || '').toLowerCase().includes(q) ||
        (e.ruta || '').toLowerCase().includes(q) ||
        (JSON.stringify(e.metadata) || '').toLowerCase().includes(q)
      )
    }
    return aplicarSort(r, sort, {
      fecha:   e => e.created_at,
      usuario: e => (userMap[e.usuario_id]?.nombre || '').toLowerCase(),
      modulo:  e => e.modulo || '',
      evento:  e => e.evento || '',
    })
  }, [eventos, filtroUsuario, filtroModulo, filtroEvento, busqueda, sort, userMap])

  // KPIs
  const kpis = useMemo(() => ({
    total: eventos.length,
    usuariosActivos: new Set(eventos.map(e => e.usuario_id).filter(Boolean)).size,
    modulosUsados: new Set(eventos.map(e => e.modulo).filter(Boolean)).size,
    porEvento: eventosDisponibles.map(ev => ({ ev, n: eventos.filter(e => e.evento === ev).length })),
  }), [eventos, eventosDisponibles])

  const EVENTO_COLOR = {
    insert: { bg:'#E1F5EE', color:'#0F6E56', label:'Crear' },
    update: { bg:'#E0EDFF', color:'#1B3A6B', label:'Actualizar' },
    delete: { bg:'#FEF2F2', color:'#DC2626', label:'Eliminar' },
    view:   { bg:'#F1F5F9', color:'#64748B', label:'Ver' },
    login:  { bg:'#E1F5EE', color:'#0F6E56', label:'Login' },
    export: { bg:'#FEF3C7', color:'#D97706', label:'Exportar' },
  }

  const fmtRelative = (ts) => {
    const d = new Date(ts); const ahora = new Date()
    const seg = Math.floor((ahora - d) / 1000)
    if (seg < 60) return 'ahora'
    if (seg < 3600) return Math.floor(seg/60) + 'min'
    if (seg < 86400) return Math.floor(seg/3600) + 'h'
    return Math.floor(seg/86400) + 'd'
  }

  return (
    <div>
      <div style={{ marginBottom:20 }}>
        <h1 style={{ fontSize:isMobile?22:28, fontWeight:400, color:COLORS.navy, margin:0 }}>Auditoría</h1>
        <p style={{ color:COLORS.slate500, fontSize:12, marginTop:4 }}>
          Registro de actividad de usuarios y cambios en datos. Solo dirección/admin.
        </p>
      </div>

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns: isMobile?'1fr 1fr':'repeat(4,1fr)', gap:12, marginBottom:16 }}>
        <KpiCard label="Eventos totales" valor={kpis.total} sub={`últimos ${diasAtras} días`}/>
        <KpiCard label="Usuarios activos" valor={kpis.usuariosActivos} sub={`de ${usuarios.length} totales`}/>
        <KpiCard label="Módulos usados" valor={kpis.modulosUsados}/>
        <KpiCard label="Eventos / hora" valor={diasAtras > 0 ? Math.round(kpis.total / (diasAtras * 24)) : 0} sub="promedio"/>
      </div>

      {/* Filtros */}
      <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap', alignItems:'center' }}>
        <select value={diasAtras} onChange={e => setDiasAtras(parseInt(e.target.value))} style={selectStyle()}>
          <option value={1}>Últimas 24h</option>
          <option value={7}>Últimos 7 días</option>
          <option value={30}>Últimos 30 días</option>
          <option value={90}>Últimos 90 días</option>
          <option value={365}>Último año</option>
        </select>
        <select value={filtroUsuario} onChange={e => setFiltroUsuario(e.target.value)} style={selectStyle()}>
          <option value="todos">Todos los usuarios</option>
          {usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
        </select>
        <select value={filtroModulo} onChange={e => setFiltroModulo(e.target.value)} style={selectStyle()}>
          <option value="todos">Todos los módulos</option>
          {modulosDisponibles.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={filtroEvento} onChange={e => setFiltroEvento(e.target.value)} style={selectStyle()}>
          <option value="todos">Todos los eventos</option>
          {eventosDisponibles.map(ev => <option key={ev} value={ev}>{ev}</option>)}
        </select>
        <div style={{ flex:1, minWidth:200, position:'relative' }}>
          <div style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:COLORS.slate400 }}>{Icon('Search')}</div>
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar..." style={{ width:'100%', padding:'9px 14px 9px 36px', border:`1px solid ${COLORS.slate100}`, borderRadius:10, fontSize:12, outline:'none', minHeight:40, boxSizing:'border-box' }}/>
        </div>
        <SortControl value={sort} onChange={setSort} fields={[
          { key:'fecha', label:'Más reciente' },
          { key:'usuario', label:'Usuario' },
          { key:'modulo', label:'Módulo' },
          { key:'evento', label:'Evento' },
        ]}/>
      </div>

      {loading && <LoadingState/>}
      {error && (
        <div style={{ padding:14, background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:10, color:'#DC2626', fontSize:13, marginBottom:14 }}>
          ⚠ {error} <button onClick={cargar} style={{ marginLeft:10, padding:'3px 10px', border:'1px solid #FECACA', background:'white', borderRadius:6, color:'#DC2626', fontSize:11, fontWeight:600, cursor:'pointer' }}>Reintentar</button>
        </div>
      )}

      {!loading && filtrados.length === 0 && (
        <EmptyState titulo="Sin eventos" descripcion={busqueda || filtroUsuario !== 'todos' || filtroModulo !== 'todos' ? 'Ningún resultado con los filtros actuales.' : 'No hay actividad registrada en este periodo.'}/>
      )}

      {!loading && filtrados.length > 0 && (
        <>
          <p style={{ color:COLORS.slate500, fontSize:11, marginBottom:10 }}>
            {filtrados.length} de {eventos.length} eventos
          </p>
          <div style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:10, overflow:'hidden' }}>
            {filtrados.slice(0, 500).map((e, i) => {
              const evCfg = EVENTO_COLOR[e.evento] || { bg:COLORS.slate100, color:COLORS.slate600, label:e.evento }
              const user = userMap[e.usuario_id]
              return (
                <div key={e.id} style={{ display:'grid', gridTemplateColumns: isMobile?'1fr':'140px 1fr 100px 80px 60px', gap:10, padding:'10px 14px', borderBottom:`1px solid ${COLORS.slate100}`, fontSize:12 }}>
                  <div style={{ color:COLORS.slate500, fontFamily:'var(--font-mono)' }}>
                    {fmtDate(e.created_at)} <span style={{ opacity:0.6 }}>{new Date(e.created_at).toLocaleTimeString('es-MX', { hour:'2-digit', minute:'2-digit' })}</span>
                  </div>
                  <div>
                    <div style={{ fontWeight:600, color:COLORS.ink }}>{user?.nombre || (e.usuario_id ? 'Usuario borrado' : 'Sistema')}</div>
                    {e.ruta && <div style={{ fontSize:10, color:COLORS.slate500, fontFamily:'var(--font-mono)' }}>{e.ruta}</div>}
                    {e.metadata?.cambios && (
                      <details style={{ marginTop:4 }}>
                        <summary style={{ fontSize:10, color:COLORS.teal, cursor:'pointer' }}>Ver cambios ({Object.keys(e.metadata.cambios).length} campo{Object.keys(e.metadata.cambios).length !== 1 ? 's' : ''})</summary>
                        <pre style={{ fontSize:10, background:COLORS.slate50, padding:8, borderRadius:6, marginTop:4, maxHeight:200, overflow:'auto' }}>{JSON.stringify(e.metadata.cambios, null, 2)}</pre>
                      </details>
                    )}
                  </div>
                  <div><Badge texto={e.modulo || '—'} mapa={{ [e.modulo]: { bg:COLORS.slate100, color:COLORS.slate600 } }}/></div>
                  <div><Badge texto={evCfg.label} mapa={{ [evCfg.label]: { bg:evCfg.bg, color:evCfg.color } }}/></div>
                  <div style={{ color:COLORS.slate400, fontSize:10, textAlign:'right' }}>{fmtRelative(e.created_at)}</div>
                </div>
              )
            })}
            {filtrados.length > 500 && (
              <div style={{ padding:14, textAlign:'center', color:COLORS.slate500, fontSize:11 }}>
                Mostrando primeros 500. Refina filtros para ver más.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function KpiCard({ label, valor, sub }) {
  return (
    <div style={{ background:'white', border:'1px solid #E2E8F0', borderRadius:12, padding:14 }}>
      <div style={{ fontSize:10, fontWeight:600, color:'#64748B', textTransform:'uppercase', letterSpacing:0.5, marginBottom:8 }}>{label}</div>
      <div style={{ fontSize:24, fontWeight:500, color:'#0A2540', lineHeight:1, marginBottom:4 }}>{valor}</div>
      {sub && <div style={{ fontSize:11, color:'#64748B' }}>{sub}</div>}
    </div>
  )
}

function selectStyle() {
  return { padding:'8px 12px', border:'1px solid #E2E8F0', borderRadius:10, fontSize:12, background:'white', cursor:'pointer', fontFamily:'inherit', outline:'none' }
}
