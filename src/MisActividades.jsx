// ============================================================
// MisActividades.jsx — v16.9.4
// Vista de lista plana de actividades con filtros por estado/fecha.
// Llegas aquí desde Dashboard alert cards (retrasadas, bloqueadas, etc.).
// Permite acciones rápidas: cambiar estado, abrir en proyecto.
// ============================================================
import { useState, useEffect, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { getProyectos, actualizarActividad } from './supabase'
import {
  COLORS, Badge, fmtDate, daysUntil, inputStyle, btnPrimary, Icon,
  LoadingState, EmptyState, useIsMobile, SortControl, aplicarSort,
  loadPref, savePref, estadoEfectivo,
} from './helpers'

const ESTADOS = {
  'Completada': { bg:'#E1F5EE', color:'#0F6E56' },
  'En progreso': { bg:'#E0EDFF', color:'#1B3A6B' },
  'Sin iniciar': { bg:'#F1F5F9', color:'#64748B' },
  'Retrasada':   { bg:'#FEF2F2', color:'#DC2626' },
  'Bloqueada':   { bg:'#FEF3C7', color:'#D97706' },
  'Cancelada':   { bg:'#F1F5F9', color:'#94A3B8' },
}

// Definicion de cada filtro: titulo, descripcion, predicado.
const FILTROS = {
  retrasadas: {
    titulo: 'Actividades retrasadas',
    descripcion: 'Actividades cuya fecha fin ya pasó y no están completadas ni canceladas.',
    color: '#DC2626',
    test: (a) => {
      if (['Completada', 'Cancelada'].includes(a.estado)) return false
      if (!a.fin) return false
      const hoyStr = new Date().toISOString().slice(0,10)
      return a.fin < hoyStr
    },
  },
  bloqueadas: {
    titulo: 'Actividades bloqueadas',
    descripcion: 'Actividades en estado "Bloqueada" — necesitan acción para desbloquear.',
    color: '#D97706',
    test: (a) => a.estado === 'Bloqueada',
  },
  proximas: {
    titulo: 'Próximas a vencer (7 días)',
    descripcion: 'Actividades con fin en los próximos 7 días.',
    color: '#F59E0B',
    test: (a) => {
      if (['Completada', 'Cancelada'].includes(a.estado)) return false
      if (!a.fin) return false
      const d = daysUntil(a.fin)
      return d !== null && d >= 0 && d <= 7
    },
  },
  sin_fecha: {
    titulo: 'Sin fecha asignada',
    descripcion: 'Actividades sin fecha fin definida.',
    color: '#94A3B8',
    test: (a) => !a.fin && !['Completada', 'Cancelada'].includes(a.estado),
  },
}

export default function MisActividades({ usuario }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const filtro = searchParams.get('filtro') || 'retrasadas'
  const navigate = useNavigate()

  const [proyectos, setProyectos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [soloMias, setSoloMias] = useState(() => loadPref('misActividades.soloMias', false))
  useEffect(() => savePref('misActividades.soloMias', soloMias), [soloMias])
  const [sort, setSort] = useState(() => loadPref(`sort.misActividades.${filtro}`, { field:'fin', dir:'asc' }))
  useEffect(() => savePref(`sort.misActividades.${filtro}`, sort), [sort, filtro])
  const [updating, setUpdating] = useState(null)
  const isMobile = useIsMobile()

  const cargar = async () => {
    setLoading(true); setError(null)
    try {
      const data = await getProyectos()
      setProyectos(data)
    } catch (e) { setError(e?.message || 'Error cargando proyectos') }
    setLoading(false)
  }
  useEffect(() => { cargar() }, [])

  // Aplana todas las actividades anotando su proyecto
  const todasActividades = useMemo(() => {
    const out = []
    for (const p of proyectos) {
      for (const a of (p.actividades || [])) {
        out.push({
          ...a,
          _proyecto: { id: p.id, codigo: p.codigo, nombre: p.nombre, cliente: p.cliente?.razon_social || null },
        })
      }
    }
    return out
  }, [proyectos])

  const cfg = FILTROS[filtro] || FILTROS.retrasadas

  const filtradas = useMemo(() => {
    let r = todasActividades.filter(cfg.test)
    if (soloMias) r = r.filter(a => a.responsable_id === usuario?.id || a.asignado_id === usuario?.id)
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase()
      r = r.filter(a =>
        a.nombre?.toLowerCase().includes(q) ||
        a._proyecto?.nombre?.toLowerCase().includes(q) ||
        a._proyecto?.codigo?.toLowerCase().includes(q) ||
        a.responsable_nombre?.toLowerCase().includes(q)
      )
    }
    return aplicarSort(r, sort, {
      fin:        a => a.fin || '9999-12-31',
      inicio:     a => a.inicio || '9999-12-31',
      nombre:     a => (a.nombre || '').toLowerCase(),
      proyecto:   a => (a._proyecto?.nombre || '').toLowerCase(),
      responsable:a => (a.responsable_nombre || '').toLowerCase(),
      estado:     a => a.estado || '',
      avance:     a => Number(a.avance || 0),
    })
  }, [todasActividades, cfg, soloMias, busqueda, sort, usuario?.id])

  const cambiarEstado = async (act, nuevoEstado) => {
    setUpdating(act.id)
    try {
      await actualizarActividad(act.id, { estado: nuevoEstado })
      await cargar()
    } catch (e) { alert('Error: ' + (e?.message || 'No se pudo actualizar')) }
    setUpdating(null)
  }

  const marcarCompletada = async (act) => {
    setUpdating(act.id)
    try {
      await actualizarActividad(act.id, { estado: 'Completada', avance: 100, completada: true })
      await cargar()
    } catch (e) { alert('Error: ' + (e?.message || 'No se pudo completar')) }
    setUpdating(null)
  }

  const abrirEnProyecto = (act) => {
    if (!act._proyecto?.id) return
    navigate(`/proyectos?proyecto=${act._proyecto.id}&actividad=${act.id}`)
  }

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexWrap:'wrap', gap:12 }}>
        <div>
          <button onClick={() => navigate('/')} style={{ background:'transparent', border:'none', color:COLORS.slate500, fontSize:11, fontWeight:600, cursor:'pointer', padding:0, marginBottom:6, display:'flex', alignItems:'center', gap:4 }}>
            ← Dashboard
          </button>
          <h1 style={{ fontSize: isMobile ? 22 : 28, fontWeight:400, color:COLORS.navy, margin:0, fontFamily:'var(--font-sans)' }}>
            {cfg.titulo}
          </h1>
          <p style={{ color:COLORS.slate500, fontSize:12, marginTop:4, maxWidth:560 }}>{cfg.descripcion}</p>
        </div>
      </div>

      {/* Tabs de filtros */}
      <div style={{ display:'flex', gap:6, marginBottom:14, flexWrap:'wrap' }}>
        {Object.entries(FILTROS).map(([k, f]) => (
          <button key={k} onClick={() => setSearchParams({ filtro: k }, { replace:true })} style={{
            padding:'7px 14px', border:`1px solid ${filtro === k ? f.color : COLORS.slate200}`,
            background: filtro === k ? f.color : 'white',
            color: filtro === k ? 'white' : COLORS.slate600,
            borderRadius:8, fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit',
          }}>{f.titulo.replace('Actividades ', '').replace(/^./, c => c.toUpperCase())}</button>
        ))}
      </div>

      {/* Toolbar busqueda + sort + filtro mias */}
      <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap', alignItems:'center' }}>
        <div style={{ flex:1, minWidth:240, position:'relative' }}>
          <div style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:COLORS.slate400 }}>{Icon('Search')}</div>
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar nombre, proyecto, responsable..." style={{ ...inputStyle, paddingLeft:36 }}/>
        </div>
        <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:COLORS.slate600, cursor:'pointer', padding:'8px 12px', background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:10 }}>
          <input type="checkbox" checked={soloMias} onChange={e => setSoloMias(e.target.checked)}/>
          Solo asignadas a mí
        </label>
        <SortControl value={sort} onChange={setSort} fields={[
          { key:'fin',         label:'Fecha fin' },
          { key:'inicio',      label:'Fecha inicio' },
          { key:'nombre',      label:'Nombre' },
          { key:'proyecto',    label:'Proyecto' },
          { key:'responsable', label:'Responsable' },
          { key:'estado',      label:'Estado' },
          { key:'avance',      label:'Avance' },
        ]}/>
      </div>

      {loading && <LoadingState/>}
      {error && (
        <div style={{ padding:14, background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:10, color:'#DC2626', fontSize:13, marginBottom:14 }}>
          ⚠ {error} <button onClick={cargar} style={{ marginLeft:10, padding:'3px 10px', border:'1px solid #FECACA', background:'white', borderRadius:6, color:'#DC2626', fontSize:11, fontWeight:600, cursor:'pointer' }}>Reintentar</button>
        </div>
      )}

      {!loading && filtradas.length === 0 && (
        <EmptyState titulo={`Sin ${cfg.titulo.toLowerCase()}`} descripcion={busqueda ? 'Ningún resultado con los filtros actuales.' : '🎉 No hay actividades en este filtro.'}/>
      )}

      {!loading && filtradas.length > 0 && (
        <>
          <p style={{ color:COLORS.slate500, fontSize:11, marginBottom:10 }}>
            {filtradas.length} actividad{filtradas.length === 1 ? '' : 'es'}{soloMias ? ' asignada a ti' : ''}
          </p>
          <div style={{ display:'grid', gap:8 }}>
            {filtradas.map(a => {
              const eff = estadoEfectivo(a)
              const dias = daysUntil(a.fin)
              const diasTxt = dias === null ? '—' : dias < 0 ? `${Math.abs(dias)}d retraso` : dias === 0 ? 'Hoy' : `en ${dias}d`
              const diasColor = dias === null ? COLORS.slate400 : dias < 0 ? '#DC2626' : dias <= 7 ? '#F59E0B' : COLORS.slate500
              return (
                <div key={a.id} style={{
                  background:'white', border:`1px solid ${COLORS.slate100}`,
                  borderLeft:`3px solid ${ESTADOS[eff]?.color || COLORS.slate400}`,
                  borderRadius:10, padding:14,
                  display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 130px 110px 110px 140px',
                  gap:12, alignItems:'center',
                }}>
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:COLORS.ink, marginBottom:4 }}>{a.nombre}</div>
                    <div style={{ fontSize:11, color:COLORS.slate500, display:'flex', gap:8, flexWrap:'wrap' }}>
                      <span style={{ fontFamily:'var(--font-mono)', color:COLORS.slate400, fontWeight:600 }}>{a._proyecto?.codigo}</span>
                      <span>· {a._proyecto?.nombre}</span>
                      {a._proyecto?.cliente && <span>· {a._proyecto.cliente}</span>}
                      {a.responsable_nombre && <span>· {a.responsable_nombre}</span>}
                    </div>
                  </div>

                  {!isMobile && (
                    <div style={{ fontSize:11, color:COLORS.slate500, fontFamily:'var(--font-mono)' }}>
                      {fmtDate(a.inicio)} → {fmtDate(a.fin)}
                    </div>
                  )}

                  {!isMobile && (
                    <div style={{ fontSize:11, fontWeight:700, color:diasColor, fontFamily:'var(--font-mono)' }}>
                      {diasTxt}
                    </div>
                  )}

                  <select
                    value={a.estado}
                    disabled={updating === a.id}
                    onChange={e => cambiarEstado(a, e.target.value)}
                    style={{ padding:'6px 8px', border:`1px solid ${COLORS.slate200}`, borderRadius:6, fontSize:11, background: ESTADOS[eff]?.bg, color: ESTADOS[eff]?.color, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                    {['Sin iniciar','En progreso','Bloqueada','Completada','Cancelada'].map(k => <option key={k} value={k}>{k}</option>)}
                  </select>

                  <div style={{ display:'flex', gap:6, justifyContent:'flex-end' }}>
                    {a.estado !== 'Completada' && (
                      <button onClick={() => marcarCompletada(a)} disabled={updating === a.id} title="Marcar como completada (100% avance)" style={{ padding:'6px 10px', background:COLORS.teal, color:'white', border:'none', borderRadius:6, fontSize:11, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap' }}>
                        ✓ Completar
                      </button>
                    )}
                    <button onClick={() => abrirEnProyecto(a)} title="Abrir en el proyecto" style={{ padding:'6px 10px', background:'white', color:COLORS.navy, border:`1px solid ${COLORS.slate200}`, borderRadius:6, fontSize:11, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap' }}>
                      Abrir →
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
