import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import {
  supabase, getProyectos, getProyectoConActividades, getUsuarios, getClientes,
  getPlantillas, getPlantillaActividades, crearProyectoDesdePlantilla,
  actualizarActividad, crearActividad, desglosarActividadConPlantilla,
  agregarDependencia, quitarDependencia, recalcularFechasDesde,
  // v7: helpers agregados
  getHitosProyecto, getNotasProyecto, crearNotaProyecto, eliminarNota, extraerMenciones,
  // v8: helpers nuevos
  duplicarActividad, eliminarActividad, cambiarImportancia,
} from './supabase'

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

const ESTADOS_HITO = {
  'Pagado': { bg:'#E1F5EE', color:'#0F6E56', sem:'#0F6E56' },
  'Facturado': { bg:'#E0EDFF', color:'#1B3A6B', sem:'#3B82F6' },
  'Pendiente': { bg:'#FEF3C7', color:'#D97706', sem:'#F59E0B' },
  'Vencido': { bg:'#FEF2F2', color:'#DC2626', sem:'#DC2626' },
  'Cancelado': { bg:'#F1F5F9', color:'#64748B', sem:'#94A3B8' },
}

// v8: Importancia (prioridad) de actividad
const IMPORTANCIA = {
  'alta':  { label:'Alta',  bg:'#FEF2F2', color:'#DC2626', dot:'#DC2626' },
  'media': { label:'Media', bg:'#FEF3C7', color:'#D97706', dot:'#F59E0B' },
  'baja':  { label:'Baja',  bg:'#E0EDFF', color:'#1B3A6B', dot:'#3B82F6' },
}

const toDate = s => s ? new Date(s + 'T00:00:00') : new Date()
const toStr = d => d.toISOString().split('T')[0]
const diffDays = (a, b) => Math.round((toDate(b) - toDate(a)) / 86400000)
const addDays = (s, n) => { const d = toDate(s); d.setDate(d.getDate()+n); return toStr(d) }
const fmtDate = s => {
  if (!s) return '—'
  const d = toDate(s)
  const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
  return `${d.getDate()} ${meses[d.getMonth()]} ${d.getFullYear()}`
}
const fmtMoney = n => n == null ? '—' : n.toLocaleString('es-MX', { style:'currency', currency:'MXN', minimumFractionDigits:0 })

function generarNumeracion(actividades) {
  const porPadre = {}
  actividades.forEach(a => {
    const key = a.parent_id || 'root'
    if (!porPadre[key]) porPadre[key] = []
    porPadre[key].push(a)
  })
  Object.keys(porPadre).forEach(k => porPadre[k].sort((a,b) => (a.numero||0) - (b.numero||0)))
  const numeros = {}
  const asignar = (parentId, prefijo) => {
    const hijos = porPadre[parentId || 'root'] || []
    hijos.forEach((hijo, i) => {
      const nuevoNum = prefijo ? `${prefijo}.${i+1}` : `${i+1}`
      numeros[hijo.id] = nuevoNum
      asignar(hijo.id, nuevoNum)
    })
  }
  asignar(null, '')
  return numeros
}

const Icon = {
  Back:()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>,
  Plus:()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 5v14M5 12h14"/></svg>,
  X:()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>,
  Check:()=><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5"><path d="M20 6 9 17l-5-5"/></svg>,
  Search:()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>,
  Diamond:()=><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2 22 12 12 22 2 12z"/></svg>,
  Link:()=><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
  Trash:()=><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>,
  Scale:()=><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10M12 3v18M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/></svg>,
  Info:()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>,
  Pencil:()=><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>,
  ChevronDown:()=><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>,
  ChevronRight:()=><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6"/></svg>,
  Calendar:()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  User:()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  Lock:()=><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  Warning:()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  Folder:()=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>,
  FileText:()=><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  Upload:()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  Send:()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  Kanban:()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="6" height="14" rx="1"/><rect x="10" y="3" width="6" height="10" rx="1"/><rect x="17" y="3" width="4" height="7" rx="1"/></svg>,
  Users:()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  Dollar:()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  // v8 — iconos menú contextual
  Copy:()=><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>,
  Flag:()=><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>,
  Duplicate:()=><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>,
  Eye:()=><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
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

function Avatar({ nombre, color, tamano=28 }) {
  const colores = [COLORS.navy, COLORS.teal, COLORS.gold, COLORS.purple, COLORS.blue]
  const parts = (nombre || '?').trim().split(' ')
  const init = ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?'
  const bg = color || colores[(nombre || '').length % colores.length]
  return (
    <div title={nombre} style={{
      width:tamano, height:tamano, borderRadius:'50%',
      background:bg, color:'white', display:'inline-flex',
      alignItems:'center', justifyContent:'center',
      fontSize: tamano * 0.36, fontWeight:700, flexShrink:0,
      border:'2px solid white', boxShadow:'0 1px 3px rgba(0,0,0,0.15)',
    }}>{init}</div>
  )
}

function useIsMobile() {
  const [m, setM] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false)
  useEffect(() => { const h = () => setM(window.innerWidth < 768); window.addEventListener('resize', h); return () => window.removeEventListener('resize', h) }, [])
  return m
}

const labelStyle = { fontSize:10, fontWeight:700, color:COLORS.slate500, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }
const miniLabel = { fontSize:10, fontWeight:600, color:COLORS.slate500, textTransform:'uppercase', letterSpacing:'0.05em', display:'block', marginBottom:4 }
const inputStyle = { width:'100%', padding:'9px 11px', border:`1px solid ${COLORS.slate200}`, borderRadius:7, fontSize:12, outline:'none', fontFamily:'var(--font-sans)', boxSizing:'border-box' }
const selectStyle = { ...inputStyle, background:'white', cursor:'pointer' }
const btnPrimary = { padding:'9px 20px', background:COLORS.navy, color:'white', border:'none', borderRadius:7, fontSize:12, fontWeight:600, cursor:'pointer', minHeight:40 }
const btnSecondary = { padding:'9px 16px', background:'transparent', color:COLORS.slate600, border:`1px solid ${COLORS.slate200}`, borderRadius:7, fontSize:12, fontWeight:500, cursor:'pointer', minHeight:40 }
const btnTeal = { padding:'9px 20px', background:COLORS.teal, color:'white', border:'none', borderRadius:7, fontSize:12, fontWeight:600, cursor:'pointer', minHeight:40 }
const cardStyle = { background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, padding:20 }

function Alerta({ tipo='info', children }) {
  const estilos = {
    info:{ bg:'#E0EDFF', border:COLORS.blue, color:'#1B3A6B' },
    warn:{ bg:'#FEF3C7', border:COLORS.amber, color:'#78350F' },
    danger:{ bg:'#FEF2F2', border:COLORS.red, color:'#7F1D1D' },
    success:{ bg:'#E1F5EE', border:COLORS.teal, color:'#064E3B' },
  }
  const e = estilos[tipo] || estilos.info
  return (
    <div style={{
      padding:'10px 14px', borderRadius:8, fontSize:12, marginBottom:10,
      display:'flex', alignItems:'center', gap:10,
      background:e.bg, border:`1px solid ${e.border}`, color:e.color,
    }}>{children}</div>
  )
}

function EditableText({ value, onSave, style, placeholder='Editar...' }) {
  const [editing, setEditing] = useState(false)
  const [temp, setTemp] = useState(value)
  const inputRef = useRef(null)

  useEffect(() => { setTemp(value) }, [value])
  useEffect(() => { if (editing && inputRef.current) { inputRef.current.focus(); inputRef.current.select?.() } }, [editing])

  const commit = () => {
    const v = (temp || '').trim()
    if (v && v !== value) onSave(v)
    else setTemp(value)
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={temp}
        onChange={e => setTemp(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Escape') { setTemp(value); setEditing(false) }; if (e.key === 'Enter') commit() }}
        placeholder={placeholder}
        style={{ ...inputStyle, ...style, padding:'4px 8px' }}
      />
    )
  }
  return (
    <span
      onDoubleClick={e => { e.stopPropagation(); setEditing(true) }}
      style={{ ...style, cursor:'text', padding:'2px 4px', borderRadius:4, display:'inline-block' }}
      title="Doble clic para editar"
      onMouseEnter={e => e.currentTarget.style.background = 'rgba(10,37,64,0.04)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      {value || <span style={{ color:COLORS.slate400, fontStyle:'italic' }}>{placeholder}</span>}
    </span>
  )
}

// ============================================================
// v8: BadgeImportancia - pequeño badge visual de prioridad
// ============================================================
function BadgeImportancia({ importancia, tamano='mini' }) {
  if (!importancia || !IMPORTANCIA[importancia]) return null
  const cfg = IMPORTANCIA[importancia]
  if (tamano === 'mini') {
    return (
      <span title={`Importancia: ${cfg.label}`} style={{ display:'inline-flex', alignItems:'center', gap:3, flexShrink:0 }}>
        <span style={{ width:6, height:6, borderRadius:'50%', background:cfg.dot }}/>
      </span>
    )
  }
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:10, fontWeight:600, padding:'2px 7px', borderRadius:10, background:cfg.bg, color:cfg.color }}>
      <span style={{ width:6, height:6, borderRadius:'50%', background:cfg.dot }}/>
      {cfg.label}
    </span>
  )
}

// ============================================================
// v8: MenuContextual - menú al click derecho sobre actividad
// ============================================================
function MenuContextual({ x, y, actividad, onClose, onAbrirInfo, onDuplicar, onEliminar, onToggleMilestone, onCambiarImportancia, onAgregarHijo, proyectoId }) {
  const menuRef = useRef(null)
  const [submenuImp, setSubmenuImp] = useState(false)

  // Cerrar al click fuera o escape
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose()
    }
    const escHandler = (e) => { if (e.key === 'Escape') onClose() }
    // timeout para que no capture el mismo click que lo abrió
    const t = setTimeout(() => {
      document.addEventListener('mousedown', handler)
      document.addEventListener('keydown', escHandler)
    }, 50)
    return () => {
      clearTimeout(t)
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', escHandler)
    }
  }, [onClose])

  // Ajustar posición si se sale de la pantalla
  const MENU_WIDTH = 220
  const MENU_HEIGHT = 380
  const adjX = Math.min(x, window.innerWidth - MENU_WIDTH - 10)
  const adjY = Math.min(y, window.innerHeight - MENU_HEIGHT - 10)

  const copiarEnlace = () => {
    const url = `${window.location.origin}/proyectos/${proyectoId}?actividad=${actividad.id}`
    navigator.clipboard.writeText(url)
      .then(() => alert('Enlace copiado al portapapeles'))
      .catch(() => alert('No se pudo copiar el enlace'))
    onClose()
  }

  const MenuItem = ({ icon, label, onClick, danger, shortcut, submenu }) => (
    <div
      onClick={submenu ? undefined : (e) => { e.stopPropagation(); onClick?.(); onClose() }}
      onMouseEnter={(e) => {
        if (submenu) setSubmenuImp(true)
        else setSubmenuImp(false)
        e.currentTarget.style.background = COLORS.slate50
      }}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      style={{
        display:'flex', alignItems:'center', gap:10,
        padding:'8px 14px', fontSize:12, cursor:'pointer',
        color: danger ? COLORS.red : COLORS.ink,
        position:'relative',
      }}
    >
      <span style={{ width:14, color: danger ? COLORS.red : COLORS.slate500, display:'flex' }}>{icon}</span>
      <span style={{ flex:1 }}>{label}</span>
      {shortcut && <span style={{ fontSize:10, color:COLORS.slate400, fontFamily:'var(--font-mono)' }}>{shortcut}</span>}
      {submenu && <span style={{ color:COLORS.slate400 }}>›</span>}
      {submenu && submenuImp && (
        <div style={{ position:'absolute', left:'100%', top:-4, background:'white', border:`1px solid ${COLORS.slate200}`, borderRadius:8, boxShadow:'0 6px 20px rgba(10,37,64,0.12)', minWidth:140, padding:'4px 0', zIndex:1 }}>
          {[
            { key:'alta', label:'Alta' },
            { key:'media', label:'Media' },
            { key:'baja', label:'Baja' },
            { key:null, label:'Ninguna' },
          ].map(opt => (
            <div key={String(opt.key)} onClick={(e) => { e.stopPropagation(); onCambiarImportancia(opt.key); onClose() }}
              onMouseEnter={e => e.currentTarget.style.background = COLORS.slate50}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              style={{ padding:'8px 14px', fontSize:12, cursor:'pointer', display:'flex', alignItems:'center', gap:8, color: actividad.importancia === opt.key ? COLORS.teal : COLORS.ink }}>
              {opt.key ? <span style={{ width:8, height:8, borderRadius:'50%', background:IMPORTANCIA[opt.key].dot }}/> : <span style={{ width:8 }}/>}
              {opt.label}
              {actividad.importancia === opt.key && <span style={{ marginLeft:'auto' }}><Icon.Check/></span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )

  const Separator = () => <div style={{ height:1, background:COLORS.slate100, margin:'4px 0' }}/>

  return (
    <div ref={menuRef} style={{
      position:'fixed', left:adjX, top:adjY, width:MENU_WIDTH,
      background:'white', border:`1px solid ${COLORS.slate200}`, borderRadius:10,
      boxShadow:'0 10px 32px rgba(10,37,64,0.18)',
      zIndex:2000, padding:'4px 0',
      animation:'rowFadeIn 0.1s ease-out',
    }}>
      <style>{`@keyframes rowFadeIn { from { opacity:0; transform:translateY(-4px); } to { opacity:1; transform:translateY(0); } }`}</style>

      <div style={{ padding:'8px 14px 6px', fontSize:10, color:COLORS.slate400, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', borderBottom:`1px solid ${COLORS.slate100}`, marginBottom:4 }}>
        {actividad.nombre.length > 24 ? actividad.nombre.substring(0, 24) + '...' : actividad.nombre}
      </div>

      <MenuItem icon={<Icon.Eye/>} label="Ver detalles" onClick={() => onAbrirInfo(actividad)}/>
      <MenuItem icon={<Icon.Copy/>} label="Copiar enlace" onClick={copiarEnlace}/>
      <Separator/>
      <MenuItem icon={<Icon.Plus/>} label="Agregar sub-actividad" onClick={() => onAgregarHijo(actividad)}/>
      <MenuItem icon={<Icon.Duplicate/>} label="Duplicar" onClick={() => onDuplicar(actividad)}/>
      <Separator/>
      <MenuItem icon={<Icon.Flag/>} label="Importancia" submenu/>
      <MenuItem
        icon={<Icon.Diamond/>}
        label={actividad.es_milestone ? 'Quitar hito' : 'Convertir en hito'}
        onClick={() => onToggleMilestone(actividad)}
      />
      <Separator/>
      <MenuItem icon={<Icon.Trash/>} label="Eliminar" onClick={() => onEliminar(actividad)} danger/>
    </div>
  )
}

function PanelActividad({ actividad, actividades, numeracion, usuarios, onClose, onCambio }) {
  const [loc, setLoc] = useState(actividad)
  const [guardando, setGuardando] = useState(false)
  const [predSel, setPredSel] = useState('')
  const isMobile = useIsMobile()

  useEffect(() => { setLoc(actividad) }, [actividad])

  const guardar = async (cambios) => {
    setLoc(prev => ({ ...prev, ...cambios }))
    setGuardando(true)
    try {
      await actualizarActividad(actividad.id, cambios)
      onCambio()
    } catch (e) { alert('Error: ' + e.message) }
    setGuardando(false)
  }

  const esDescendiente = (id, ancestroId) => {
    if (id === ancestroId) return true
    const a = actividades.find(x => x.id === id)
    if (!a || !a.parent_id) return false
    return esDescendiente(a.parent_id, ancestroId)
  }
  const candidatasDeps = actividades.filter(a => a.id !== actividad.id && !(loc.deps || []).some(d => d.id === a.id) && !esDescendiente(actividad.id, a.id))

  const agregarDep = async () => {
    if (!predSel) return
    setGuardando(true)
    try {
      await agregarDependencia(actividad.id, predSel, 'FS')
      setLoc(prev => ({ ...prev, deps: [...(prev.deps || []), { id: predSel, tipo: 'FS' }] }))
      setPredSel('')
      onCambio()
    } catch (e) { alert('Error: ' + e.message) }
    setGuardando(false)
  }

  const quitarDep = async (predId) => {
    setGuardando(true)
    try {
      await quitarDependencia(actividad.id, predId)
      setLoc(prev => ({ ...prev, deps: (prev.deps || []).filter(d => d.id !== predId) }))
      onCambio()
    } catch (e) { alert('Error: ' + e.message) }
    setGuardando(false)
  }

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(10,37,64,0.3)', zIndex:1100 }}/>
      <div style={{
        position:'fixed', top:0, right:0,
        width: isMobile ? '100%' : 460,
        height:'100vh', background:'white',
        boxShadow:'-8px 0 32px rgba(10,37,64,0.12)',
        zIndex:1101, display:'flex', flexDirection:'column',
        animation:'rowSlideIn 0.2s ease-out',
      }}>
        <style>{`@keyframes rowSlideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>
        <div style={{ padding:'16px 20px', borderBottom:`1px solid ${COLORS.slate100}`, display:'flex', justifyContent:'space-between', alignItems:'center', gap:10 }}>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:10, fontFamily:'var(--font-mono)', color:COLORS.slate400, fontWeight:700, marginBottom:2 }}>
              Actividad {numeracion[actividad.id] || ''} {guardando && <span style={{ color:COLORS.teal, marginLeft:8 }}>Guardando...</span>}
            </div>
            <div>
              <EditableText value={loc.nombre} onSave={v => guardar({ nombre: v })} style={{ fontSize:16, fontWeight:600, color:COLORS.navy, fontFamily:'var(--font-serif)' }}/>
            </div>
          </div>
          <button onClick={onClose} style={{ border:'none', background:COLORS.slate50, width:32, height:32, borderRadius:8, cursor:'pointer', flexShrink:0 }}><Icon.X/></button>
        </div>
        <div style={{ flex:1, overflow:'auto', padding:20 }}>
          <div style={{ marginBottom:16 }}>
            <label style={miniLabel}>Estado</label>
            <select value={loc.estado} onChange={e => guardar({ estado: e.target.value })} style={selectStyle}>
              {Object.keys(ESTADOS).map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          <div style={{ marginBottom:16 }}>
            <label style={miniLabel}>Importancia</label>
            <div style={{ display:'flex', gap:6 }}>
              {[
                { key:null, label:'Ninguna', color:COLORS.slate400 },
                { key:'baja', label:'Baja', color:IMPORTANCIA.baja.dot },
                { key:'media', label:'Media', color:IMPORTANCIA.media.dot },
                { key:'alta', label:'Alta', color:IMPORTANCIA.alta.dot },
              ].map(opt => {
                const active = (loc.importancia || null) === opt.key
                return (
                  <button key={String(opt.key)} onClick={() => guardar({ importancia: opt.key })}
                    style={{
                      flex:1, padding:'8px 10px', fontSize:11, fontWeight:600, cursor:'pointer',
                      border: active ? `1.5px solid ${opt.color}` : `1px solid ${COLORS.slate200}`,
                      background: active ? `${opt.color}18` : 'white',
                      color: active ? opt.color : COLORS.slate600,
                      borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center', gap:5,
                    }}>
                    {opt.key && <span style={{ width:8, height:8, borderRadius:'50%', background:opt.color }}/>}
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16 }}>
            <div>
              <label style={miniLabel}>Inicio</label>
              <input type="date" value={loc.inicio} onChange={e => guardar({ inicio: e.target.value })} style={inputStyle}/>
            </div>
            <div>
              <label style={miniLabel}>Fin</label>
              <input type="date" value={loc.fin} onChange={e => guardar({ fin: e.target.value })} style={inputStyle}/>
            </div>
          </div>
          <div style={{ marginBottom:16, padding:10, background:COLORS.slate50, borderRadius:8, fontSize:11, color:COLORS.slate600, fontFamily:'var(--font-mono)', textAlign:'center' }}>
            Duración: <strong style={{ color:COLORS.navy }}>{diffDays(loc.inicio, loc.fin) + 1} días</strong>
          </div>
          <div style={{ marginBottom:16 }}>
            <label style={miniLabel}>Progreso: {loc.avance || 0}%</label>
            <input type="range" min="0" max="100" step="5" value={loc.avance || 0}
              onChange={e => setLoc(prev => ({ ...prev, avance: parseInt(e.target.value) }))}
              onMouseUp={e => guardar({ avance: parseInt(e.target.value), completada: parseInt(e.target.value) === 100 })}
              onTouchEnd={e => guardar({ avance: parseInt(e.target.value), completada: parseInt(e.target.value) === 100 })}
              style={{ width:'100%', accentColor:COLORS.teal }}/>
            <BarraAvance avance={loc.avance || 0}/>
          </div>
          {usuarios && usuarios.length > 0 && (
            <div style={{ marginBottom:16 }}>
              <label style={miniLabel}>Responsable</label>
              <select value={loc.responsable_id || ''} onChange={e => guardar({ responsable_id: e.target.value || null })} style={selectStyle}>
                <option value="">Sin asignar</option>
                {usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
              </select>
            </div>
          )}
          <div style={{ marginBottom:16 }}>
            <label style={miniLabel}>Notas</label>
            <textarea
              value={loc.notas || ''}
              onChange={e => setLoc(prev => ({ ...prev, notas: e.target.value }))}
              onBlur={e => e.target.value !== (actividad.notas || '') && guardar({ notas: e.target.value })}
              placeholder="Agrega contexto o comentarios..."
              style={{ ...inputStyle, minHeight:80, resize:'vertical' }}
            />
          </div>
          <div style={{ marginBottom:16 }}>
            <label style={miniLabel}>Predecesoras ({(loc.deps || []).length})</label>
            {(loc.deps || []).length === 0 && <div style={{ padding:12, textAlign:'center', color:COLORS.slate400, fontSize:11, border:`1px dashed ${COLORS.slate200}`, borderRadius:8 }}>Sin dependencias.</div>}
            {(loc.deps || []).map(dep => {
              const pred = actividades.find(a => a.id === dep.id)
              if (!pred) return null
              return (
                <div key={dep.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', background:COLORS.slate50, borderRadius:8, marginBottom:4 }}>
                  <span style={{ fontSize:10, fontFamily:'var(--font-mono)', color:COLORS.navy, fontWeight:700, minWidth:30 }}>{numeracion[pred.id] || ''}</span>
                  <span style={{ flex:1, fontSize:12, color:COLORS.ink, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{pred.nombre}</span>
                  <button onClick={() => quitarDep(dep.id)} disabled={guardando} style={{ border:'none', background:'transparent', color:COLORS.red, cursor:'pointer', padding:4 }}><Icon.Trash/></button>
                </div>
              )
            })}
            <div style={{ display:'flex', gap:6, marginTop:6 }}>
              <select value={predSel} onChange={e => setPredSel(e.target.value)} style={{...selectStyle, flex:1, fontSize:11}}>
                <option value="">Agregar predecesora...</option>
                {candidatasDeps.map(a => <option key={a.id} value={a.id}>{numeracion[a.id] || ''} · {a.nombre}</option>)}
              </select>
              <button onClick={agregarDep} disabled={!predSel || guardando} style={{ padding:'8px 12px', background:COLORS.teal, color:'white', border:'none', borderRadius:7, fontSize:11, fontWeight:600, cursor:'pointer', opacity: !predSel ? 0.5 : 1 }}>+</button>
            </div>
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center', padding:'10px 12px', background:COLORS.slate50, borderRadius:8 }}>
            <input type="checkbox" id="mstone" checked={!!loc.es_milestone} onChange={e => guardar({ es_milestone: e.target.checked })}/>
            <label htmlFor="mstone" style={{ fontSize:12, color:COLORS.slate600, cursor:'pointer' }}>Es milestone (hito)</label>
          </div>
        </div>
      </div>
    </>
  )
}

function PanelProyecto({ proyecto, clientes, usuarios, onClose, onCambio }) {
  const [loc, setLoc] = useState(proyecto)
  const [guardando, setGuardando] = useState(false)
  const isMobile = useIsMobile()

  useEffect(() => { setLoc(proyecto) }, [proyecto])

  const guardar = async (cambios) => {
    setLoc(prev => ({ ...prev, ...cambios }))
    setGuardando(true)
    try {
      const { error } = await supabase.from('proyectos').update(cambios).eq('id', proyecto.id)
      if (error) throw error
      onCambio()
    } catch (e) { alert('Error: ' + e.message) }
    setGuardando(false)
  }

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(10,37,64,0.3)', zIndex:1100 }}/>
      <div style={{
        position:'fixed', top:0, right:0,
        width: isMobile ? '100%' : 460,
        height:'100vh', background:'white',
        boxShadow:'-8px 0 32px rgba(10,37,64,0.12)',
        zIndex:1101, display:'flex', flexDirection:'column',
        animation:'rowSlideIn 0.2s ease-out',
      }}>
        <div style={{ padding:'16px 20px', borderBottom:`1px solid ${COLORS.slate100}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:10, fontFamily:'var(--font-mono)', color:COLORS.slate400, fontWeight:700, marginBottom:2 }}>
              {proyecto.codigo} {guardando && <span style={{ color:COLORS.teal, marginLeft:8 }}>Guardando...</span>}
            </div>
            <EditableText value={loc.nombre} onSave={v => guardar({ nombre: v })} style={{ fontSize:16, fontWeight:600, color:COLORS.navy, fontFamily:'var(--font-serif)' }}/>
          </div>
          <button onClick={onClose} style={{ border:'none', background:COLORS.slate50, width:32, height:32, borderRadius:8, cursor:'pointer' }}><Icon.X/></button>
        </div>
        <div style={{ flex:1, overflow:'auto', padding:20 }}>
          <div style={{ marginBottom:16 }}>
            <label style={miniLabel}>Estado</label>
            <select value={loc.estado} onChange={e => guardar({ estado: e.target.value })} style={selectStyle}>
              {Object.keys(ESTADOS_PROY).map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          <div style={{ marginBottom:16 }}>
            <label style={miniLabel}>Cliente</label>
            <select value={loc.cliente_id || ''} onChange={e => guardar({ cliente_id: e.target.value })} style={selectStyle}>
              <option value="">Sin cliente</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.razon_social}</option>)}
            </select>
          </div>
          <div style={{ marginBottom:16 }}>
            <label style={miniLabel}>Director</label>
            <select value={loc.director_id || ''} onChange={e => guardar({ director_id: e.target.value })} style={selectStyle}>
              <option value="">Sin director</option>
              {usuarios.filter(u => ['direccion','director_proyectos'].includes(u.rol)).map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
            </select>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16 }}>
            <div><label style={miniLabel}>Inicio</label><input type="date" value={loc.inicio || ''} onChange={e => guardar({ inicio: e.target.value })} style={inputStyle}/></div>
            <div><label style={miniLabel}>Cierre</label><input type="date" value={loc.cierre || ''} onChange={e => guardar({ cierre: e.target.value })} style={inputStyle}/></div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16 }}>
            <div>
              <label style={miniLabel}>Capacidad MW</label>
              <input type="number" step="0.1" value={loc.capacidad_mw || ''}
                onChange={e => setLoc(prev => ({ ...prev, capacidad_mw: e.target.value }))}
                onBlur={e => guardar({ capacidad_mw: e.target.value ? parseFloat(e.target.value) : null })}
                style={inputStyle}/>
            </div>
            <div>
              <label style={miniLabel}>Ubicación</label>
              <input value={loc.ubicacion || ''}
                onChange={e => setLoc(prev => ({ ...prev, ubicacion: e.target.value }))}
                onBlur={e => guardar({ ubicacion: e.target.value || null })}
                style={inputStyle}/>
            </div>
          </div>
          <div style={{ marginBottom:16 }}>
            <label style={miniLabel}>Descripción</label>
            <textarea
              value={loc.descripcion || ''}
              onChange={e => setLoc(prev => ({ ...prev, descripcion: e.target.value }))}
              onBlur={e => guardar({ descripcion: e.target.value || null })}
              style={{ ...inputStyle, minHeight:80, resize:'vertical' }}
            />
          </div>
        </div>
      </div>
    </>
  )
}

function GanttInteractivo({ actividadesProp, onRecargar, onDesglosar, onAbrirInfo, onInlineUpdate, onNuevaActividad, onMenuContextual }) {
  const [zoom, setZoom] = useState('dia')
  const DAY_WIDTH = zoom === 'dia' ? 32 : (zoom === 'semana' ? 18 : 8)
  const ROW_HEIGHT = 42
  const HEADER_HEIGHT = 60
  const LEFT_PANEL = 320
  const BAR_VPAD = 10
  const BAR_HEIGHT = ROW_HEIGHT - BAR_VPAD * 2
  const BAR_HEIGHT_PADRE = ROW_HEIGHT - 16

  const containerRef = useRef(null)
  const scrollRef = useRef(null)
  const timelineRef = useRef(null)
  const dragStateRef = useRef(null)

  const [actividades, setActividades] = useState(actividadesProp)
  useEffect(() => { setActividades(actividadesProp) }, [actividadesProp])

  const [hoveredId, setHoveredId] = useState(null)
  const [tooltip, setTooltip] = useState(null)
  const [drag, setDrag] = useState(null)
  const [dropTargetId, setDropTargetId] = useState(null)
  const [, forceRender] = useState(0)

  const numeracion = useMemo(() => generarNumeracion(actividades), [actividades])

  const fechaInicio = useMemo(() => {
    if (actividades.length === 0) return toDate(toStr(new Date()))
    const min = actividades.reduce((m, a) => a.inicio < m ? a.inicio : m, actividades[0].inicio)
    const d = toDate(min); d.setDate(d.getDate() - 3); return d
  }, [actividades])

  const fechaFin = useMemo(() => {
    if (actividades.length === 0) { const d = new Date(); d.setDate(d.getDate() + 90); return d }
    const max = actividades.reduce((m, a) => a.fin > m ? a.fin : m, actividades[0].fin)
    const d = toDate(max); d.setDate(d.getDate() + 14); return d
  }, [actividades])

  const totalDias = diffDays(toStr(fechaInicio), toStr(fechaFin))
  const totalWidth = totalDias * DAY_WIDTH
  const hoy = toStr(new Date())

  const dias = useMemo(() => {
    const arr = []
    for (let i = 0; i <= totalDias; i++) {
      const d = new Date(fechaInicio); d.setDate(d.getDate() + i)
      arr.push(d)
    }
    return arr
  }, [fechaInicio, totalDias])

  const meses = useMemo(() => {
    const arr = []; let current = null
    dias.forEach((d, i) => {
      const key = `${d.getFullYear()}-${d.getMonth()}`
      if (key !== current) {
        arr.push({ key, label: d.toLocaleDateString('es-MX', { month:'long', year:'numeric' }), inicio: i, dias: 1 })
        current = key
      } else arr[arr.length-1].dias++
    })
    return arr
  }, [dias])

  const getX = fecha => diffDays(toStr(fechaInicio), fecha) * DAY_WIDTH
  const getW = (inicio, fin) => Math.max((diffDays(inicio, fin) + 1) * DAY_WIDTH, DAY_WIDTH)

  const [collapsed, setCollapsed] = useState(new Set())
  const toggleCollapse = (id) => setCollapsed(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  const actOrdenadas = useMemo(() => {
    const padres = actividades.filter(a => !a.parent_id)
    const result = []
    padres.forEach(p => {
      result.push(p)
      if (!collapsed.has(p.id)) {
        actividades.filter(a => a.parent_id === p.id).forEach(h => result.push(h))
      }
    })
    return result
  }, [actividades, collapsed])

  const rowByActId = useMemo(() => {
    const r = {}
    actOrdenadas.forEach((a, i) => { r[a.id] = i })
    return r
  }, [actOrdenadas])

  const previewActividad = useCallback((act) => {
    const d = dragStateRef.current
    if (!d || d.actId !== act.id) return { inicio: act.inicio, fin: act.fin }
    const deltaDays = Math.round((d.mouseX - d.startX) / DAY_WIDTH)
    if (d.tipo === 'move') return { inicio: addDays(d.originalInicio, deltaDays), fin: addDays(d.originalFin, deltaDays) }
    if (d.tipo === 'resize-left') {
      const nuevoInicio = addDays(d.originalInicio, deltaDays)
      if (nuevoInicio >= d.originalFin) return { inicio: d.originalFin, fin: d.originalFin }
      return { inicio: nuevoInicio, fin: d.originalFin }
    }
    if (d.tipo === 'resize-right') {
      const nuevoFin = addDays(d.originalFin, deltaDays)
      if (nuevoFin <= d.originalInicio) return { inicio: d.originalInicio, fin: d.originalInicio }
      return { inicio: d.originalInicio, fin: nuevoFin }
    }
    return { inicio: act.inicio, fin: act.fin }
  }, [DAY_WIDTH])

  const creariaCiclo = useCallback((predId, sucId) => {
    if (predId === sucId) return true
    const visit = (id, seen) => {
      if (id === sucId) return true
      if (seen.has(id)) return false
      seen.add(id)
      const act = actividades.find(a => a.id === id)
      if (!act) return false
      for (const d of (act.deps || [])) if (visit(d.id, seen)) return true
      return false
    }
    return visit(predId, new Set())
  }, [actividades])

  useEffect(() => {
    if (!drag) return
    const onMove = (e) => {
      if (!dragStateRef.current) return
      dragStateRef.current.mouseX = e.clientX
      dragStateRef.current.mouseY = e.clientY
      forceRender(v => v + 1)
      if (drag.tipo === 'dep') {
        const el = document.elementFromPoint(e.clientX, e.clientY)
        const targetId = el?.closest('[data-act-id]')?.getAttribute('data-act-id')
        if (targetId && targetId !== drag.actId && !creariaCiclo(drag.actId, targetId)) {
          setDropTargetId(prev => prev !== targetId ? targetId : prev)
        } else {
          setDropTargetId(prev => prev ? null : prev)
        }
      }
    }
    const onUp = async (e) => {
      const d = dragStateRef.current
      setDrag(null); setDropTargetId(null)
      if (!d) return
      if (d.tipo === 'dep') {
        const el = document.elementFromPoint(e.clientX, e.clientY)
        const targetId = el?.closest('[data-act-id]')?.getAttribute('data-act-id')
        if (targetId && targetId !== d.actId && !creariaCiclo(d.actId, targetId)) {
          setActividades(prev => prev.map(a => a.id === targetId ? { ...a, deps: [...(a.deps || []), { id: d.actId, tipo: 'FS' }] } : a))
          try {
            await agregarDependencia(targetId, d.actId, 'FS')
            onRecargar()
          } catch (err) {
            setActividades(prev => prev.map(a => a.id === targetId ? { ...a, deps: (a.deps || []).filter(x => x.id !== d.actId) } : a))
            alert('No se pudo crear la dependencia: ' + err.message)
          }
        }
      } else {
        const deltaDays = Math.round((d.mouseX - d.startX) / DAY_WIDTH)
        if (deltaDays === 0) { dragStateRef.current = null; return }
        let cambios = {}
        if (d.tipo === 'move') {
          cambios.inicio = addDays(d.originalInicio, deltaDays)
          cambios.fin = addDays(d.originalFin, deltaDays)
        } else if (d.tipo === 'resize-left') {
          const nuevoInicio = addDays(d.originalInicio, deltaDays)
          if (nuevoInicio >= d.originalFin) { dragStateRef.current = null; return }
          cambios.inicio = nuevoInicio
        } else if (d.tipo === 'resize-right') {
          const nuevoFin = addDays(d.originalFin, deltaDays)
          if (nuevoFin <= d.originalInicio) { dragStateRef.current = null; return }
          cambios.fin = nuevoFin
        }
        setActividades(prev => prev.map(a => a.id === d.actId ? { ...a, ...cambios } : a))
        dragStateRef.current = null
        try {
          await actualizarActividad(d.actId, cambios)
          await recalcularFechasDesde(d.actId)
          onRecargar()
        } catch (err) {
          setActividades(actividadesProp)
          alert('Error: ' + err.message)
        }
      }
      dragStateRef.current = null
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [drag, actividadesProp, onRecargar, creariaCiclo, DAY_WIDTH])

  const iniciarDrag = (e, act, tipo) => {
    e.stopPropagation(); e.preventDefault()
    setTooltip(null)
    const state = { tipo, actId: act.id, startX: e.clientX, mouseX: e.clientX, mouseY: e.clientY, originalInicio: act.inicio, originalFin: act.fin }
    dragStateRef.current = state
    setDrag(state)
  }

  const buildOrthPath = (x1, y1, x2, y2) => {
    const STUB = 8, ARROW_STUB = 6
    const sx = x1 + STUB
    const ex = x2 - ARROW_STUB
    if (ex > sx + 10) {
      const midX = sx + Math.max(12, (ex - sx) / 2)
      return `M ${x1} ${y1} L ${sx} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${ex} ${y2}`
    } else {
      const goDown = y2 > y1
      const midY = y1 + (goDown ? ROW_HEIGHT/2 : -ROW_HEIGHT/2)
      return `M ${x1} ${y1} L ${sx} ${y1} L ${sx} ${midY} L ${ex - 12} ${midY} L ${ex - 12} ${y2} L ${ex} ${y2}`
    }
  }

  const lineasDeps = useMemo(() => {
    const lineas = []
    actOrdenadas.forEach((act, rowIdx) => {
      const { inicio, fin } = previewActividad(act)
      ;(act.deps || []).forEach(dep => {
        const pred = actividades.find(a => a.id === dep.id)
        if (!pred) return
        const predRow = rowByActId[pred.id]
        if (predRow === undefined) return
        const predPrev = previewActividad(pred)
        const x1 = getX(predPrev.inicio) + getW(predPrev.inicio, predPrev.fin)
        const y1 = predRow * ROW_HEIGHT + ROW_HEIGHT / 2
        const x2 = getX(inicio)
        const y2 = rowIdx * ROW_HEIGHT + ROW_HEIGHT / 2
        lineas.push({
          id: `${pred.id}-${act.id}`,
          path: buildOrthPath(x1, y1, x2, y2),
          fromId: pred.id, toId: act.id,
          highlighted: hoveredId === pred.id || hoveredId === act.id,
        })
      })
    })
    return lineas
  }, [actOrdenadas, actividades, rowByActId, hoveredId, previewActividad, DAY_WIDTH, drag])

  const dragDepPath = useMemo(() => {
    if (!drag || drag.tipo !== 'dep' || !timelineRef.current || !dragStateRef.current) return null
    const act = actividades.find(a => a.id === drag.actId)
    if (!act) return null
    const prev = previewActividad(act)
    const rect = timelineRef.current.getBoundingClientRect()
    const scrollLeft = scrollRef.current?.scrollLeft || 0
    const x1 = getX(prev.inicio) + getW(prev.inicio, prev.fin)
    const y1 = rowByActId[act.id] * ROW_HEIGHT + ROW_HEIGHT / 2
    const x2 = dragStateRef.current.mouseX - rect.left + scrollLeft
    const y2 = dragStateRef.current.mouseY - rect.top
    return buildOrthPath(x1, y1, x2, y2)
  }, [drag, actividades, rowByActId, previewActividad, DAY_WIDTH])

  const getNivel = id => (numeracion[id] || '').split('.').length - 1
  const totalHeight = actOrdenadas.length * ROW_HEIGHT

  const [nuevaNombre, setNuevaNombre] = useState('')
  const [creando, setCreando] = useState(false)
  const agregarActividadInline = async () => {
    if (!nuevaNombre.trim()) return
    setCreando(true)
    try { await onNuevaActividad({ nombre: nuevaNombre.trim() }); setNuevaNombre('') }
    catch (e) { alert('Error: ' + e.message) }
    setCreando(false)
  }

  return (
    <div ref={containerRef} style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, overflow:'hidden', position:'relative', userSelect: drag ? 'none' : 'auto' }}>
      <div style={{ padding:'10px 14px', borderBottom:`1px solid ${COLORS.slate100}`, background:COLORS.slate50, display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
        <div style={{ display:'flex', background:'white', border:`1px solid ${COLORS.slate200}`, borderRadius:7, overflow:'hidden' }}>
          {[{k:'dia',l:'Día'},{k:'semana',l:'Sem'},{k:'mes',l:'Mes'}].map(z => (
            <button key={z.k} onClick={() => setZoom(z.k)} style={{ padding:'6px 12px', border:'none', background: zoom === z.k ? COLORS.navy : 'transparent', color: zoom === z.k ? 'white' : COLORS.slate600, fontSize:11, fontWeight:600, cursor:'pointer' }}>{z.l}</button>
          ))}
        </div>
        <button onClick={() => {
          const hoyIdx = dias.findIndex(d => toStr(d) === hoy)
          if (hoyIdx >= 0 && scrollRef.current) scrollRef.current.scrollTo({ left: Math.max(0, hoyIdx * DAY_WIDTH - 200), behavior:'smooth' })
        }} style={{ padding:'6px 10px', background:'white', border:`1px solid ${COLORS.slate200}`, borderRadius:7, fontSize:11, fontWeight:600, cursor:'pointer', color:COLORS.slate600, display:'flex', alignItems:'center', gap:5 }}>
          <Icon.Calendar/> Ir a hoy
        </button>
        <div style={{ marginLeft:'auto', fontSize:10, color:COLORS.slate500, fontStyle:'italic' }}>
          Arrastra barras · doble clic para detalles · punto verde para dependencias
        </div>
      </div>

      {actividades.length === 0 ? (
        <div style={{ padding:60, textAlign:'center', color:COLORS.slate400 }}>
          <p style={{ marginBottom:16 }}>No hay actividades aún.</p>
          <div style={{ display:'flex', gap:8, maxWidth:400, margin:'0 auto' }}>
            <input value={nuevaNombre} onChange={e => setNuevaNombre(e.target.value)} onKeyDown={e => e.key === 'Enter' && agregarActividadInline()} placeholder="Nombre de la primera actividad..." style={{...inputStyle, flex:1}}/>
            <button onClick={agregarActividadInline} disabled={!nuevaNombre.trim() || creando} style={{...btnPrimary, opacity: !nuevaNombre.trim() ? 0.5 : 1}}>{creando ? '...' : 'Crear'}</button>
          </div>
        </div>
      ) : (
      <div style={{ display:'flex' }}>
        <div style={{ width:LEFT_PANEL, flexShrink:0, borderRight:`2px solid ${COLORS.slate100}`, background:'white', zIndex:2 }}>
          <div style={{ height:HEADER_HEIGHT, borderBottom:`1px solid ${COLORS.slate100}`, display:'flex', alignItems:'flex-end', padding:'0 16px 12px', background:COLORS.slate50 }}>
            <span style={{ fontSize:10, fontWeight:700, color:COLORS.slate500, textTransform:'uppercase', letterSpacing:'0.1em' }}>#  Actividad</span>
          </div>
          {actOrdenadas.map(act => {
            const esPadre = act.es_servicio_padre
            const tieneHijos = actividades.some(a => a.parent_id === act.id)
            const isCollapsed = collapsed.has(act.id)
            const nivel = getNivel(act.id)
            const num = numeracion[act.id] || `${act.numero}`
            const depsCount = (act.deps || []).length
            return (
              <div key={act.id}
                onMouseEnter={() => setHoveredId(act.id)} onMouseLeave={() => setHoveredId(null)}
                onContextMenu={(e) => { e.preventDefault(); onMenuContextual?.(act, e.clientX, e.clientY) }}
                style={{ height:ROW_HEIGHT, borderBottom:`1px solid ${COLORS.slate100}`, display:'flex', alignItems:'center', padding:'0 8px 0 12px', paddingLeft: 12 + nivel * 18, background: hoveredId === act.id ? COLORS.slate50 : (esPadre ? '#FAFBFE' : 'white'), gap:6 }}>
                {tieneHijos ? (
                  <button onClick={() => toggleCollapse(act.id)} style={{ border:'none', background:'transparent', cursor:'pointer', padding:0, color:COLORS.slate500, display:'flex' }}>
                    {isCollapsed ? <Icon.ChevronRight/> : <Icon.ChevronDown/>}
                  </button>
                ) : <span style={{ width:12 }}/>}
                <span style={{ fontSize:10, fontFamily:'var(--font-mono)', color: esPadre ? COLORS.navy : COLORS.slate400, fontWeight: esPadre ? 700 : 500, minWidth: 32 }}>{num}</span>
                {act.es_milestone && <span style={{ color:COLORS.navy }}><Icon.Diamond/></span>}
                <BadgeImportancia importancia={act.importancia} tamano="mini"/>
                <div style={{ fontSize:12, color:COLORS.ink, fontWeight: esPadre ? 600 : 400, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  <EditableText value={act.nombre} onSave={v => onInlineUpdate(act.id, { nombre: v })} style={{ fontSize:12, color:COLORS.ink, fontWeight: esPadre ? 600 : 400 }}/>
                </div>
                {depsCount > 0 && <span title={`${depsCount} dependencia(s)`} style={{ display:'inline-flex', alignItems:'center', gap:2, fontSize:9, color:COLORS.teal, background:COLORS.tealLight, padding:'2px 5px', borderRadius:10, fontWeight:700 }}><Icon.Link/>{depsCount}</span>}
                {hoveredId === act.id && (
                  <>
                    <button onClick={() => onAbrirInfo(act)} title="Información" style={{ border:'none', background:'transparent', color:COLORS.slate500, cursor:'pointer', padding:3, display:'flex' }}><Icon.Info/></button>
                    {esPadre && <button onClick={() => onDesglosar(act)} title="Desglosar" style={{ background:'transparent', border:'none', color:COLORS.teal, cursor:'pointer', padding:3, display:'flex' }}><Icon.Scale/></button>}
                  </>
                )}
              </div>
            )
          })}
          <div style={{ height:ROW_HEIGHT, borderBottom:`1px solid ${COLORS.slate100}`, display:'flex', alignItems:'center', padding:'0 12px', gap:6 }}>
            <span style={{ width:12 }}/>
            <span style={{ fontSize:10, fontFamily:'var(--font-mono)', color:COLORS.slate400, minWidth:32 }}>+</span>
            <input value={nuevaNombre} onChange={e => setNuevaNombre(e.target.value)} onKeyDown={e => e.key === 'Enter' && agregarActividadInline()} placeholder="Agregar actividad..." style={{ flex:1, border:'none', outline:'none', background:'transparent', fontSize:12, color:COLORS.ink, padding:'4px 0' }}/>
            {nuevaNombre.trim() && (
              <button onClick={agregarActividadInline} disabled={creando} style={{ padding:'4px 10px', background:COLORS.teal, color:'white', border:'none', borderRadius:6, fontSize:10, fontWeight:600, cursor:'pointer' }}>{creando ? '...' : 'Agregar'}</button>
            )}
          </div>
        </div>

        <div ref={scrollRef} style={{ flex:1, overflowX:'auto', overflowY:'hidden' }}>
          <div style={{ width:totalWidth, position:'relative' }}>
            <div style={{ position:'sticky', top:0, zIndex:3, background:COLORS.slate50, borderBottom:`1px solid ${COLORS.slate100}` }}>
              <div style={{ display:'flex', height:HEADER_HEIGHT/2, borderBottom:`1px solid ${COLORS.slate100}` }}>
                {meses.map(m => <div key={m.key} style={{ width: m.dias * DAY_WIDTH, borderRight:`1px solid ${COLORS.slate200}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:600, color:COLORS.navy, textTransform:'capitalize', background:'white' }}>{m.label}</div>)}
              </div>
              <div style={{ display:'flex', height:HEADER_HEIGHT/2 }}>
                {dias.map((d, i) => {
                  const isWeekend = d.getDay() === 0 || d.getDay() === 6
                  const isToday = toStr(d) === hoy
                  return (
                    <div key={i} style={{ width: DAY_WIDTH, flexShrink:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background: isToday ? COLORS.tealLight : (isWeekend ? '#F8FAFC' : 'white'), borderRight:`1px solid ${COLORS.slate100}`, fontSize:10, color: isToday ? COLORS.teal : COLORS.slate500, fontWeight: isToday ? 700 : 500, fontFamily:'var(--font-mono)' }}>
                      {zoom === 'dia' && <div style={{ fontSize:9, opacity:0.7 }}>{['D','L','M','M','J','V','S'][d.getDay()]}</div>}
                      <div style={{ fontSize: zoom === 'mes' ? 8 : 10 }}>{d.getDate()}</div>
                    </div>
                  )
                })}
              </div>
            </div>
            <div ref={timelineRef} style={{ position:'relative', height: totalHeight + ROW_HEIGHT }}>
              <div style={{ position:'absolute', inset:0, pointerEvents:'none', zIndex:0 }}>
                {zoom !== 'mes' && dias.map((d, i) => {
                  const isWeekend = d.getDay() === 0 || d.getDay() === 6
                  if (!isWeekend) return null
                  return <div key={i} style={{ position:'absolute', left: i*DAY_WIDTH, top:0, width:DAY_WIDTH, height:'100%', background:'rgba(241, 245, 249, 0.5)' }}/>
                })}
                {(() => {
                  const idx = dias.findIndex(d => toStr(d) === hoy)
                  if (idx < 0) return null
                  return <div style={{ position:'absolute', left: idx*DAY_WIDTH + DAY_WIDTH/2, top:0, width:0, height:'100%', borderLeft:`1.5px dashed ${COLORS.red}`, opacity:0.85 }}/>
                })()}
              </div>
              {actOrdenadas.map((act, rowIdx) => (
                <div key={`row-${act.id}`} onMouseEnter={() => setHoveredId(act.id)} onMouseLeave={() => setHoveredId(null)}
                  style={{ position:'absolute', left:0, right:0, top: rowIdx * ROW_HEIGHT, height: ROW_HEIGHT, borderBottom:`1px solid ${COLORS.slate100}`, background: hoveredId === act.id ? 'rgba(10, 37, 64, 0.02)' : 'transparent', zIndex: 1 }}/>
              ))}
              <div style={{ position:'absolute', left:0, right:0, top: actOrdenadas.length * ROW_HEIGHT, height: ROW_HEIGHT, borderBottom:`1px solid ${COLORS.slate100}`, background:'transparent', zIndex:1 }}/>
              <svg style={{ position:'absolute', inset:0, width:totalWidth, height: totalHeight, pointerEvents:'none', zIndex:2, overflow:'visible' }}>
                <defs>
                  <marker id="dep-dot" markerWidth="8" markerHeight="8" refX="4" refY="4" markerUnits="userSpaceOnUse">
                    <circle cx="4" cy="4" r="3" fill={COLORS.slate500}/>
                  </marker>
                  <marker id="dep-dot-hl" markerWidth="8" markerHeight="8" refX="4" refY="4" markerUnits="userSpaceOnUse">
                    <circle cx="4" cy="4" r="3.5" fill={COLORS.teal}/>
                  </marker>
                  <marker id="dep-dot-ghost" markerWidth="8" markerHeight="8" refX="4" refY="4" markerUnits="userSpaceOnUse">
                    <circle cx="4" cy="4" r="3" fill={COLORS.teal}/>
                  </marker>
                </defs>
                {lineasDeps.map(l => (
                  <path key={l.id} d={l.path} fill="none" stroke={l.highlighted ? COLORS.teal : COLORS.slate400} strokeWidth={l.highlighted ? 2 : 1.5} opacity={l.highlighted ? 1 : 0.55} markerEnd={l.highlighted ? 'url(#dep-dot-hl)' : 'url(#dep-dot)'} style={{ transition: drag ? 'none' : 'stroke 0.15s, opacity 0.15s' }}/>
                ))}
                {dragDepPath && <path d={dragDepPath} fill="none" stroke={COLORS.teal} strokeWidth={2} strokeDasharray="5 4" markerEnd="url(#dep-dot-ghost)"/>}
              </svg>
              {actOrdenadas.map((act, rowIdx) => {
                const estadoCfg = ESTADOS[act.estado] || ESTADOS['Sin iniciar']
                const prev = previewActividad(act)
                const x = getX(prev.inicio)
                const w = getW(prev.inicio, prev.fin)
                const esPadre = act.es_servicio_padre
                const esMilestone = act.es_milestone
                const isDraggedNow = drag && drag.actId === act.id
                const isHovered = hoveredId === act.id
                const isDropTarget = dropTargetId === act.id
                const barTop = rowIdx * ROW_HEIGHT + (esPadre ? 8 : BAR_VPAD)
                const barH = esPadre ? BAR_HEIGHT_PADRE : BAR_HEIGHT

                if (esMilestone) {
                  return (
                    <div key={act.id} data-act-id={act.id}
                      onMouseDown={(e) => iniciarDrag(e, act, 'move')}
                      onContextMenu={(e) => { e.preventDefault(); onMenuContextual?.(act, e.clientX, e.clientY) }}
                      onMouseEnter={(e) => { setHoveredId(act.id); setTooltip({ act, x: e.clientX, y: e.clientY }) }}
                      onMouseMove={(e) => !drag && setTooltip({ act, x: e.clientX, y: e.clientY })}
                      onMouseLeave={() => { setHoveredId(null); setTooltip(null) }}
                      onDoubleClick={() => onAbrirInfo(act)}
                      style={{ position:'absolute', left: x + DAY_WIDTH/2 - 10, top: rowIdx * ROW_HEIGHT + ROW_HEIGHT/2 - 10, width:20, height:20, background: estadoCfg.bar, transform:'rotate(45deg)', borderRadius:3, boxShadow: isHovered ? '0 4px 10px rgba(0,0,0,0.2)' : '0 2px 6px rgba(0,0,0,0.15)', cursor: 'grab', zIndex: 3 }}/>
                  )
                }
                return (
                  <div key={act.id} data-act-id={act.id}
                    style={{ position:'absolute', left: x, top: barTop, width: w, height: barH, zIndex: isDraggedNow ? 10 : 3 }}>
                    <div style={{ position:'relative', width:'100%', height:'100%' }}>
                      <div
                        onMouseDown={(e) => iniciarDrag(e, act, 'move')}
                        onContextMenu={(e) => { e.preventDefault(); onMenuContextual?.(act, e.clientX, e.clientY) }}
                        onMouseEnter={(e) => { setHoveredId(act.id); setTooltip({ act, x: e.clientX, y: e.clientY }) }}
                        onMouseMove={(e) => !drag && setTooltip({ act, x: e.clientX, y: e.clientY })}
                        onMouseLeave={() => { setHoveredId(null); setTooltip(null) }}
                        onDoubleClick={() => onAbrirInfo(act)}
                        style={{ position:'absolute', inset:0, background: esPadre ? `linear-gradient(135deg, ${COLORS.navy} 0%, ${COLORS.navy2} 100%)` : estadoCfg.gradient, borderRadius: esPadre ? 4 : 7, display:'flex', alignItems:'center', padding:'0 10px', boxShadow: isDropTarget ? `0 0 0 3px ${COLORS.teal}, 0 4px 12px rgba(15,110,86,0.4)` : (isHovered || isDraggedNow ? `0 4px 12px rgba(10, 37, 64, 0.25)` : '0 1px 3px rgba(10, 37, 64, 0.1)'), transition: drag ? 'none' : 'box-shadow 0.15s', overflow:'hidden', cursor: isDraggedNow && drag?.tipo === 'move' ? 'grabbing' : 'grab' }}>
                        {!esPadre && act.avance > 0 && <div style={{ position:'absolute', left:0, top:0, bottom:0, width:`${act.avance}%`, background:'rgba(255,255,255,0.25)', pointerEvents:'none' }}/>}
                        {w > 70 && <span style={{ position:'relative', fontSize:11, fontWeight:600, color:'white', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', textShadow:'0 1px 2px rgba(0,0,0,0.2)', pointerEvents:'none' }}>{act.nombre}{!esPadre && act.avance > 0 && <span style={{ opacity:0.9, fontSize:10 }}> · {act.avance}%</span>}</span>}
                      </div>
                      <div onMouseDown={(e) => iniciarDrag(e, act, 'resize-left')} style={{ position:'absolute', left:0, top:0, width:6, height:'100%', cursor:'ew-resize', zIndex:4, background: isHovered && !isDraggedNow ? 'rgba(255,255,255,0.4)' : 'transparent', borderTopLeftRadius: esPadre ? 4 : 7, borderBottomLeftRadius: esPadre ? 4 : 7 }}/>
                      <div onMouseDown={(e) => iniciarDrag(e, act, 'resize-right')} style={{ position:'absolute', right:0, top:0, width:6, height:'100%', cursor:'ew-resize', zIndex:4, background: isHovered && !isDraggedNow ? 'rgba(255,255,255,0.4)' : 'transparent', borderTopRightRadius: esPadre ? 4 : 7, borderBottomRightRadius: esPadre ? 4 : 7 }}/>
                      {(isHovered || isDraggedNow) && !isDropTarget && (
                        <div onMouseDown={(e) => iniciarDrag(e, act, 'dep')} title="Arrastra a otra actividad para crear dependencia" style={{ position:'absolute', right: -7, top:'50%', transform:'translateY(-50%)', width:12, height:12, borderRadius:'50%', background: COLORS.teal, border:'2px solid white', boxShadow:'0 2px 6px rgba(15,110,86,0.5)', cursor:'crosshair', zIndex:6 }}/>
                      )}
                      {isHovered && !isDraggedNow && (
                        <div onMouseDown={(e) => iniciarDrag(e, act, 'dep')} style={{ position:'absolute', left: -7, top:'50%', transform:'translateY(-50%)', width:12, height:12, borderRadius:'50%', background: COLORS.teal, border:'2px solid white', boxShadow:'0 2px 6px rgba(15,110,86,0.5)', cursor:'crosshair', zIndex:6 }}/>
                      )}
                      {isDropTarget && <div style={{ position:'absolute', inset:-4, border:`2px dashed ${COLORS.teal}`, borderRadius: esPadre ? 6 : 9, background:'rgba(15,110,86,0.08)', pointerEvents:'none', zIndex:5 }}/>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
      )}

      {tooltip && !drag && (
        <div style={{ position:'fixed', left: Math.min(tooltip.x + 14, window.innerWidth - 280), top: tooltip.y + 14, background: 'white', border: `1px solid ${COLORS.slate200}`, borderRadius: 10, padding: '12px 14px', boxShadow: '0 8px 24px rgba(10, 37, 64, 0.18)', fontSize: 11, minWidth: 240, zIndex: 1000, pointerEvents: 'none' }}>
          <div style={{ fontSize:13, fontWeight:600, color:COLORS.navy, marginBottom:6 }}>{tooltip.act.nombre}</div>
          <div style={{ display:'flex', justifyContent:'space-between', color:COLORS.slate500, fontFamily:'var(--font-mono)', marginBottom:3, fontSize:11 }}><span>Inicio</span><span>{tooltip.act.inicio}</span></div>
          <div style={{ display:'flex', justifyContent:'space-between', color:COLORS.slate500, fontFamily:'var(--font-mono)', marginBottom:3, fontSize:11 }}><span>Fin</span><span>{tooltip.act.fin}</span></div>
          <div style={{ display:'flex', justifyContent:'space-between', color:COLORS.slate500, fontFamily:'var(--font-mono)', marginBottom:8, fontSize:11 }}><span>Duración</span><span>{diffDays(tooltip.act.inicio, tooltip.act.fin) + 1} días</span></div>
          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom: tooltip.act.avance > 0 ? 8 : 0 }}>
            <Badge texto={tooltip.act.estado} mapa={ESTADOS} tamano={10}/>
            {(tooltip.act.deps || []).length > 0 && <span style={{ fontSize:9, color:COLORS.teal, background:COLORS.tealLight, padding:'2px 6px', borderRadius:10, fontWeight:700 }}>← {tooltip.act.deps.length} dep</span>}
          </div>
          {tooltip.act.avance > 0 && <BarraAvance avance={tooltip.act.avance} height={4}/>}
        </div>
      )}

      <div style={{ padding:'10px 20px', borderTop:`1px solid ${COLORS.slate100}`, background:COLORS.slate50, display:'flex', gap:16, flexWrap:'wrap', fontSize:11, alignItems:'center' }}>
        {Object.entries(ESTADOS).map(([key, cfg]) => (
          <div key={key} style={{ display:'flex', alignItems:'center', gap:5 }}>
            <div style={{ width:12, height:8, background:cfg.gradient, borderRadius:2 }}/>
            <span style={{ color:COLORS.slate600, fontSize:10 }}>{key}</span>
          </div>
        ))}
        <div style={{ display:'flex', alignItems:'center', gap:5 }}>
          <svg width="20" height="8"><path d="M 0 4 L 20 4" stroke={COLORS.slate400} strokeWidth="1.3" fill="none"/><circle cx="18" cy="4" r="2.2" fill={COLORS.slate500}/></svg>
          <span style={{ color:COLORS.slate600, fontSize:10 }}>Dep</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:5 }}>
          <div style={{ width:0, height:10, borderLeft:`1.5px dashed ${COLORS.red}` }}/>
          <span style={{ color:COLORS.slate600, fontSize:10 }}>Hoy</span>
        </div>
      </div>
    </div>
  )
}

function TabResumen({ proyecto, actividades, hitos, usuarios, puedeVerFinanciero }) {
  const padres = actividades.filter(a => !a.parent_id)
  const avance = padres.length > 0
    ? Math.round(padres.reduce((s,a) => s+(a.avance||0), 0) / padres.length)
    : 0
  const completadas = actividades.filter(a => a.completada).length
  const bloqueadas = actividades.filter(a => a.estado === 'Bloqueada').length
  const retrasadas = actividades.filter(a => a.estado === 'Retrasada').length

  const responsableIds = [...new Set(actividades.map(a => a.responsable_id).filter(Boolean))]
  const equipo = usuarios.filter(u => responsableIds.includes(u.id))
  const director = usuarios.find(u => u.id === proyecto.director_id)

  return (
    <div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:14, marginBottom:18 }}>
        <div style={cardStyle}>
          <div style={{ fontSize:11, color:COLORS.slate500, marginBottom:6 }}>Avance global</div>
          <div style={{ fontSize:32, fontWeight:400, color:COLORS.navy, fontFamily:'var(--font-serif)', marginBottom:6 }}>{avance}%</div>
          <BarraAvance avance={avance}/>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize:11, color:COLORS.slate500, marginBottom:6 }}>Estado</div>
          <div style={{ marginBottom:6, marginTop:10 }}><Badge texto={proyecto.estado} mapa={ESTADOS_PROY} tamano={13}/></div>
          <div style={{ fontSize:11, color:COLORS.slate400 }}>{completadas} de {actividades.length} actividades</div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize:11, color:COLORS.slate500, marginBottom:6 }}>Fecha de cierre</div>
          <div style={{ fontSize:18, fontWeight:500, color:COLORS.navy, fontFamily:'var(--font-serif)' }}>{fmtDate(proyecto.cierre)}</div>
          <div style={{ fontSize:11, color:COLORS.slate400, marginTop:4 }}>Inicio: {fmtDate(proyecto.inicio)}</div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize:11, color:COLORS.slate500, marginBottom:6 }}>Alertas</div>
          <div style={{ fontSize:32, fontWeight:400, color: (bloqueadas+retrasadas)>0 ? COLORS.red : COLORS.teal, fontFamily:'var(--font-serif)', marginBottom:4 }}>{bloqueadas + retrasadas}</div>
          <div style={{ fontSize:11, color:COLORS.slate400 }}>{bloqueadas} bloq · {retrasadas} retr</div>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
        <div style={cardStyle}>
          <div style={{ ...labelStyle, marginBottom:12 }}>Equipo asignado</div>
          {director && (
            <div style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderBottom:`1px solid ${COLORS.slate100}` }}>
              <Avatar nombre={director.nombre} color={COLORS.navy} tamano={36}/>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:600, color:COLORS.ink }}>{director.nombre}</div>
                <div style={{ fontSize:11, color:COLORS.slate500 }}>Director del proyecto</div>
              </div>
            </div>
          )}
          {equipo.length === 0 && !director && (
            <div style={{ padding:16, textAlign:'center', color:COLORS.slate400, fontSize:12 }}>Sin responsables asignados aún.</div>
          )}
          {equipo.filter(u => u.id !== proyecto.director_id).map(u => (
            <div key={u.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderBottom:`1px solid ${COLORS.slate100}` }}>
              <Avatar nombre={u.nombre} color={COLORS.teal} tamano={36}/>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:600, color:COLORS.ink }}>{u.nombre}</div>
                <div style={{ fontSize:11, color:COLORS.slate500 }}>
                  {actividades.filter(a => a.responsable_id === u.id).length} actividad(es)
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={cardStyle}>
          <div style={{ ...labelStyle, marginBottom:12 }}>Hitos de cobro</div>
          {!puedeVerFinanciero ? (
            <div style={{ padding:16, textAlign:'center', color:COLORS.slate500, fontSize:12, background:COLORS.slate50, borderRadius:8 }}>
              🔒 Información financiera restringida
            </div>
          ) : hitos.length === 0 ? (
            <div style={{ padding:16, textAlign:'center', color:COLORS.slate400, fontSize:12 }}>Sin hitos de cobro registrados.</div>
          ) : hitos.map(h => {
            const cfg = ESTADOS_HITO[h.estado] || ESTADOS_HITO['Pendiente']
            return (
              <div key={h.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 0', borderBottom:`1px solid ${COLORS.slate100}` }}>
                <div style={{ width:10, height:10, borderRadius:'50%', background:cfg.sem, flexShrink:0 }}/>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, fontWeight:600, color:COLORS.ink, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{h.descripcion || h.concepto || 'Hito'}</div>
                  <div style={{ fontSize:10, color:COLORS.slate500, fontFamily:'var(--font-mono)' }}>{fmtDate(h.fecha_vencimiento || h.fecha_pago)}</div>
                </div>
                <div style={{ fontSize:12, fontWeight:700, color:COLORS.navy, fontFamily:'var(--font-mono)' }}>{fmtMoney(h.monto)}</div>
                <Badge texto={h.estado} mapa={ESTADOS_HITO} tamano={10}/>
              </div>
            )
          })}
        </div>
      </div>

      {proyecto.descripcion && (
        <div style={cardStyle}>
          <div style={{ ...labelStyle, marginBottom:10 }}>Alcance técnico</div>
          <p style={{ fontSize:13, lineHeight:1.7, color:COLORS.slate600, margin:0 }}>{proyecto.descripcion}</p>
        </div>
      )}
    </div>
  )
}

function TabActividades({ actividades, numeracion, onToggle, onInlineUpdate, onAbrirInfo, onDesglosar, onNuevaActividad, onMenuContextual }) {
  const [nombreNueva, setNombreNueva] = useState('')
  const [creandoBajo, setCreandoBajo] = useState(null)
  const [creando, setCreando] = useState(false)

  const padres = actividades.filter(a => !a.parent_id).sort((a,b) => (a.numero||0) - (b.numero||0))
  const getNivel = id => (numeracion[id] || '').split('.').length - 1

  const crearBajo = async (parentId) => {
    if (!nombreNueva.trim()) return
    setCreando(true)
    try {
      await onNuevaActividad({ nombre: nombreNueva.trim(), parentId })
      setNombreNueva(''); setCreandoBajo(null)
    } catch (e) { alert('Error: ' + e.message) }
    setCreando(false)
  }

  return (
    <div>
      {padres.length === 0 ? (
        <div style={{ ...cardStyle, textAlign:'center', color:COLORS.slate400, padding:40 }}>
          Sin actividades aún. Usa el Gantt para agregar la primera.
        </div>
      ) : padres.map(padre => {
        const hijos = actividades.filter(a => a.parent_id === padre.id).sort((a,b) => (a.numero||0) - (b.numero||0))
        const padreAvance = hijos.length > 0 ? Math.round(hijos.reduce((s,h) => s+(h.avance||0), 0) / hijos.length) : (padre.avance||0)
        return (
          <div key={padre.id} style={{ marginBottom:16 }}>
            <div
              onContextMenu={(e) => { e.preventDefault(); onMenuContextual?.(padre, e.clientX, e.clientY) }}
              style={{ background:'linear-gradient(to right, #F8FAFC, white)', padding:'12px 16px', border:`1px solid ${COLORS.slate100}`, borderRadius:10, marginBottom:2, display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ fontSize:11, fontFamily:'var(--font-mono)', color:COLORS.navy, fontWeight:700, minWidth:24 }}>{numeracion[padre.id]}</span>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:14, fontWeight:600, color:COLORS.navy, fontFamily:'var(--font-serif)' }}>
                  <EditableText value={padre.nombre} onSave={v => onInlineUpdate(padre.id, { nombre: v })} style={{ fontSize:14, fontWeight:600, color:COLORS.navy, fontFamily:'var(--font-serif)' }}/>
                </div>
                <div style={{ fontSize:10, color:COLORS.slate500, fontFamily:'var(--font-mono)', marginTop:2 }}>{fmtDate(padre.inicio)} → {fmtDate(padre.fin)} · {hijos.length} sub-actividades</div>
              </div>
              <BadgeImportancia importancia={padre.importancia} tamano="normal"/>
              <div style={{ width:140 }}><BarraAvance avance={padreAvance}/></div>
              <Badge texto={padre.estado} mapa={ESTADOS}/>
              <button onClick={() => onAbrirInfo(padre)} style={{ padding:'5px 10px', background:'transparent', color:COLORS.slate600, border:`1px solid ${COLORS.slate200}`, borderRadius:6, fontSize:10, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:3 }}><Icon.Info/></button>
              {padre.es_servicio_padre && <button onClick={() => onDesglosar(padre)} title="Desglosar con plantilla" style={{ padding:'5px 10px', background:COLORS.tealLight, color:COLORS.teal, border:'none', borderRadius:6, fontSize:10, fontWeight:600, cursor:'pointer' }}>⚖ Desglosar</button>}
            </div>
            {hijos.map(h => {
              const nivel = getNivel(h.id)
              const depsCount = (h.deps || []).length
              return (
                <div key={h.id}
                  onContextMenu={(e) => { e.preventDefault(); onMenuContextual?.(h, e.clientX, e.clientY) }}
                  style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 16px', background:'white', border:`1px solid ${COLORS.slate100}`, borderTop:'none', paddingLeft: 16 + nivel * 20 }}>
                  <div onClick={() => onToggle(h)} style={{ width:18, height:18, borderRadius:5, border:`1.5px solid ${h.completada?COLORS.teal:'#CBD5E1'}`, background:h.completada?COLORS.teal:'white', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'white', flexShrink:0 }}>{h.completada && <Icon.Check/>}</div>
                  <span style={{ fontSize:10, fontFamily:'var(--font-mono)', color:COLORS.slate400, fontWeight:500, minWidth:36 }}>{numeracion[h.id]}</span>
                  {h.es_milestone && <span style={{ color:COLORS.navy }}><Icon.Diamond/></span>}
                  <BadgeImportancia importancia={h.importancia} tamano="mini"/>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <span style={{ fontSize:13, color:COLORS.ink }}>
                        <EditableText value={h.nombre} onSave={v => onInlineUpdate(h.id, { nombre: v })} style={{ fontSize:13, color:COLORS.ink }}/>
                      </span>
                      {depsCount > 0 && <span style={{ display:'inline-flex', alignItems:'center', gap:3, background:COLORS.tealLight, color:COLORS.teal, padding:'2px 7px', borderRadius:10, fontSize:10, fontWeight:700 }}><Icon.Link/>{depsCount}</span>}
                    </div>
                    <div style={{ fontSize:10, color:COLORS.slate500, fontFamily:'var(--font-mono)', marginTop:2 }}>{fmtDate(h.inicio)} → {fmtDate(h.fin)} · {diffDays(h.inicio, h.fin) + 1}d</div>
                  </div>
                  <BarraAvance avance={h.avance}/>
                  <select value={h.estado} onChange={e => onInlineUpdate(h.id, { estado: e.target.value })} style={{ padding:'4px 8px', border:`1px solid ${COLORS.slate200}`, borderRadius:6, fontSize:11, background: ESTADOS[h.estado]?.bg, color: ESTADOS[h.estado]?.color, fontWeight:500, cursor:'pointer' }}>
                    {Object.keys(ESTADOS).map(k => <option key={k} value={k}>{k}</option>)}
                  </select>
                  <button onClick={() => onAbrirInfo(h)} title="Información" style={{ padding:'5px 9px', background:'transparent', color:COLORS.slate500, border:`1px solid ${COLORS.slate200}`, borderRadius:6, fontSize:10, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center' }}><Icon.Info/></button>
                </div>
              )
            })}
            {creandoBajo === padre.id ? (
              <div style={{ display:'flex', gap:8, padding:'10px 16px', background:COLORS.slate50, border:`1px solid ${COLORS.slate100}`, borderTop:'none', borderBottomLeftRadius:10, borderBottomRightRadius:10 }}>
                <input value={nombreNueva} onChange={e => setNombreNueva(e.target.value)} onKeyDown={e => e.key === 'Enter' && crearBajo(padre.id)} autoFocus placeholder="Nombre de la sub-actividad..." style={{...inputStyle, flex:1}}/>
                <button onClick={() => crearBajo(padre.id)} disabled={!nombreNueva.trim() || creando} style={{...btnTeal, padding:'7px 14px'}}>{creando ? '...' : 'Crear'}</button>
                <button onClick={() => { setCreandoBajo(null); setNombreNueva('') }} style={{...btnSecondary, padding:'7px 14px'}}>Cancelar</button>
              </div>
            ) : (
              <div onClick={() => setCreandoBajo(padre.id)} style={{ padding:'10px 16px', background:COLORS.slate50, border:`1px dashed ${COLORS.slate200}`, borderTop:'none', borderBottomLeftRadius:10, borderBottomRightRadius:10, fontSize:11, color:COLORS.slate500, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
                <Icon.Plus/> Agregar sub-actividad a "{padre.nombre}"
              </div>
            )}
          </div>
        )
      })}
      <div style={{ marginTop:20 }}>
        {creandoBajo === 'root' ? (
          <div style={{ display:'flex', gap:8, padding:'12px 16px', background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:10 }}>
            <input value={nombreNueva} onChange={e => setNombreNueva(e.target.value)} onKeyDown={e => e.key === 'Enter' && crearBajo(null)} autoFocus placeholder="Nombre del nuevo servicio/fase..." style={{...inputStyle, flex:1}}/>
            <button onClick={() => crearBajo(null)} disabled={!nombreNueva.trim() || creando} style={btnPrimary}>{creando ? '...' : 'Crear'}</button>
            <button onClick={() => { setCreandoBajo(null); setNombreNueva('') }} style={btnSecondary}>Cancelar</button>
          </div>
        ) : (
          <button onClick={() => setCreandoBajo('root')} style={{ width:'100%', padding:'14px', background:'white', border:`2px dashed ${COLORS.slate200}`, borderRadius:10, color:COLORS.slate500, fontSize:13, fontWeight:500, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
            <Icon.Plus/> Agregar nuevo servicio / fase
          </button>
        )}
      </div>
    </div>
  )
}

function TabKanban({ actividades, onAbrirInfo, numeracion }) {
  const hoy = toStr(new Date())
  const manana = addDays(hoy, 1)
  const semana = addDays(hoy, 7)

  const clasifica = (a) => {
    if (a.completada || a.avance === 100) return null
    if (!a.fin) return null
    if (a.fin < hoy) return 'retrasadas'
    if (a.fin === hoy) return 'hoy'
    if (a.fin === manana) return 'manana'
    if (a.fin <= semana) return 'semana'
    return null
  }

  const cols = { retrasadas: [], hoy: [], manana: [], semana: [] }
  actividades.forEach(a => {
    // Solo sub-actividades (no padres) y actividades root sin hijos
    const tieneHijos = actividades.some(x => x.parent_id === a.id)
    if (a.es_servicio_padre || tieneHijos) return
    const c = clasifica(a)
    if (c) cols[c].push(a)
  })

  const colDef = [
    { k:'retrasadas', titulo:'🔴 Con retraso', borde:COLORS.red, bg:'#FEF2F2' },
    { k:'hoy', titulo:'🟡 Hoy', borde:COLORS.amber, bg:'#FEF3C7' },
    { k:'manana', titulo:'🔵 Mañana', borde:COLORS.blue, bg:'#E0EDFF' },
    { k:'semana', titulo:'🟢 Esta semana', borde:COLORS.teal, bg:COLORS.tealLight },
  ]

  const totalPendientes = actividades.filter(a => !a.completada && a.avance < 100 && !a.es_servicio_padre).length
  const totalClasificadas = Object.values(cols).reduce((s,c) => s+c.length, 0)

  return (
    <div>
      <Alerta tipo="info">
        <Icon.Info/>
        Vista Kanban por urgencia · Hoy: <strong>{fmtDate(hoy)}</strong> · {totalClasificadas} de {totalPendientes} actividades próximas a vencer
      </Alerta>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:12, alignItems:'start' }}>
        {colDef.map(c => (
          <div key={c.k} style={{ background:'#F7F8FB', borderRadius:10, padding:12, minHeight:300 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10, paddingBottom:8, borderBottom:`2px solid ${c.borde}` }}>
              <span style={{ fontSize:12, fontWeight:700, color:COLORS.slate600 }}>{c.titulo}</span>
              <span style={{ background:'white', color:COLORS.slate600, padding:'2px 10px', borderRadius:12, fontSize:11, fontWeight:600, border:`1px solid ${COLORS.slate200}` }}>{cols[c.k].length}</span>
            </div>
            {cols[c.k].length === 0 ? (
              <div style={{ padding:20, textAlign:'center', color:COLORS.slate400, fontSize:11 }}>Sin actividades</div>
            ) : cols[c.k].map(a => {
              return (
                <div key={a.id} onClick={() => onAbrirInfo(a)} style={{ background:'white', borderRadius:8, padding:12, border:`1px solid ${COLORS.slate100}`, borderLeft:`3px solid ${c.borde}`, marginBottom:8, cursor:'pointer', transition:'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 3px 10px rgba(0,0,0,0.08)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none' }}>
                  <div style={{ fontSize:10, fontFamily:'var(--font-mono)', color:COLORS.slate400, fontWeight:700, marginBottom:4, display:'flex', alignItems:'center', gap:6 }}>
                    <span>{numeracion[a.id]}</span>
                    {a.estado === 'Bloqueada' && <Icon.Lock/>}
                    <BadgeImportancia importancia={a.importancia} tamano="mini"/>
                  </div>
                  <div style={{ fontSize:12, fontWeight:600, color:COLORS.ink, marginBottom:6 }}>{a.nombre}</div>
                  <div style={{ fontSize:10, color:COLORS.slate500, fontFamily:'var(--font-mono)', marginBottom:8 }}>
                    {fmtDate(a.fin)}
                  </div>
                  <BarraAvance avance={a.avance||0} height={4}/>
                  <div style={{ marginTop:6 }}><Badge texto={a.estado} mapa={ESTADOS} tamano={10}/></div>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

function TabPorPersona({ actividades, usuarios, numeracion, onAbrirInfo }) {
  const responsableIds = [...new Set(actividades.map(a => a.responsable_id).filter(Boolean))]
  const equipo = usuarios.filter(u => responsableIds.includes(u.id))
  const [sel, setSel] = useState(equipo[0]?.id || '')

  if (equipo.length === 0) {
    return <div style={{ ...cardStyle, textAlign:'center', color:COLORS.slate400, padding:40 }}>
      Sin responsables asignados todavía. Asigna responsables desde el panel de información de cada actividad.
    </div>
  }

  const user = usuarios.find(u => u.id === sel) || equipo[0]
  const misActs = actividades.filter(a => a.responsable_id === user.id)
  const comp = misActs.filter(a => a.estado === 'Completada').length
  const inProg = misActs.filter(a => a.estado === 'En progreso').length
  const bloq = misActs.filter(a => a.estado === 'Bloqueada').length
  const retr = misActs.filter(a => a.estado === 'Retrasada').length

  return (
    <div>
      <div style={{ ...cardStyle, marginBottom:14, display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
        <span style={{ fontSize:12, fontWeight:600, color:COLORS.slate600 }}>Persona:</span>
        <select value={sel} onChange={e => setSel(e.target.value)} style={{...selectStyle, maxWidth:280}}>
          {equipo.map(u => (
            <option key={u.id} value={u.id}>
              {u.nombre} ({actividades.filter(a => a.responsable_id === u.id).length})
            </option>
          ))}
        </select>
        <div style={{ flex:1 }}/>
        <Avatar nombre={user.nombre} tamano={36}/>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:12, marginBottom:14 }}>
        <div style={cardStyle}>
          <div style={{ fontSize:11, color:COLORS.slate500, marginBottom:4 }}>Total</div>
          <div style={{ fontSize:26, fontWeight:400, color:COLORS.navy, fontFamily:'var(--font-serif)' }}>{misActs.length}</div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize:11, color:COLORS.slate500, marginBottom:4 }}>Completadas</div>
          <div style={{ fontSize:26, fontWeight:400, color:COLORS.teal, fontFamily:'var(--font-serif)' }}>{comp}</div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize:11, color:COLORS.slate500, marginBottom:4 }}>En progreso</div>
          <div style={{ fontSize:26, fontWeight:400, color:COLORS.blue, fontFamily:'var(--font-serif)' }}>{inProg}</div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize:11, color:COLORS.slate500, marginBottom:4 }}>Bloqueadas</div>
          <div style={{ fontSize:26, fontWeight:400, color: bloq>0 ? COLORS.amber : COLORS.slate400, fontFamily:'var(--font-serif)' }}>{bloq}</div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize:11, color:COLORS.slate500, marginBottom:4 }}>Retrasadas</div>
          <div style={{ fontSize:26, fontWeight:400, color: retr>0 ? COLORS.red : COLORS.slate400, fontFamily:'var(--font-serif)' }}>{retr}</div>
        </div>
      </div>
      <div style={{ ...cardStyle, padding:0, overflow:'hidden' }}>
        {misActs.length === 0 ? (
          <div style={{ padding:40, textAlign:'center', color:COLORS.slate400 }}>Sin actividades asignadas a {user.nombre}.</div>
        ) : misActs.map(a => (
          <div key={a.id} onClick={() => onAbrirInfo(a)} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', borderBottom:`1px solid ${COLORS.slate100}`, cursor:'pointer' }}
            onMouseEnter={e => e.currentTarget.style.background = COLORS.slate50}
            onMouseLeave={e => e.currentTarget.style.background = 'white'}>
            {a.estado === 'Bloqueada' && <Icon.Lock/>}
            <span style={{ fontSize:10, fontFamily:'var(--font-mono)', color:COLORS.slate400, fontWeight:700, minWidth:36 }}>{numeracion[a.id]}</span>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:13, fontWeight:500, color:COLORS.ink }}>{a.nombre}</div>
              <div style={{ fontSize:10, color:COLORS.slate500, fontFamily:'var(--font-mono)', marginTop:2 }}>{fmtDate(a.inicio)} → {fmtDate(a.fin)}</div>
            </div>
            <BarraAvance avance={a.avance}/>
            <Badge texto={a.estado} mapa={ESTADOS}/>
          </div>
        ))}
      </div>
    </div>
  )
}

function TabDocumentos({ proyecto }) {
  const carpetas = [
    { n:'Contratos', icon:'📝', color:COLORS.navy },
    { n:'Planos', icon:'📐', color:COLORS.blue },
    { n:'Entregables', icon:'📦', color:COLORS.teal },
    { n:'Fotos', icon:'📷', color:COLORS.gold },
    { n:'Facturas', icon:'🧾', color:COLORS.amber },
    { n:'Permisos', icon:'📑', color:COLORS.purple },
  ]
  return (
    <div>
      <Alerta tipo="info">
        <Icon.Info/> Documentos por carpeta · La carga de archivos se activará cuando conectemos a Supabase Storage.
      </Alerta>
      <div style={{ border:`2px dashed ${COLORS.slate200}`, borderRadius:10, padding:24, textAlign:'center', marginBottom:16, background:COLORS.slate50, cursor:'pointer' }}
        onClick={() => alert('Función de carga próximamente. Se integrará con Supabase Storage para manejar archivos por proyecto.')}>
        <div style={{ fontSize:28, marginBottom:6 }}>📤</div>
        <div style={{ fontSize:13, fontWeight:600, color:COLORS.navy }}>Arrastra archivos aquí o haz clic para subir</div>
        <div style={{ fontSize:11, color:COLORS.slate500, marginTop:4 }}>PDF, Word, Excel, JPG, PNG, ZIP · Máx. 50MB por archivo</div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:12 }}>
        {carpetas.map(c => (
          <div key={c.n} style={{ ...cardStyle, cursor:'pointer', transition:'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = c.color; e.currentTarget.style.transform = 'translateY(-2px)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = COLORS.slate100; e.currentTarget.style.transform = 'none' }}>
            <div style={{ fontSize:28, marginBottom:8 }}>{c.icon}</div>
            <div style={{ fontSize:14, fontWeight:600, color:COLORS.navy, marginBottom:2 }}>{c.n}</div>
            <div style={{ fontSize:11, color:COLORS.slate500 }}>0 archivos</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function TabNotas({ proyectoId, usuarios }) {
  const [notas, setNotas] = useState([])
  const [nuevo, setNuevo] = useState('')
  const [loading, setLoading] = useState(true)
  const [enviando, setEnviando] = useState(false)

  const cargar = useCallback(async () => {
    try {
      const data = await getNotasProyecto(proyectoId)
      setNotas(data || [])
    } catch (e) { console.error('Error cargando notas:', e) }
    setLoading(false)
  }, [proyectoId])

  useEffect(() => { cargar() }, [cargar])

  const enviar = async () => {
    if (!nuevo.trim()) return
    setEnviando(true)
    try {
      const menciones = extraerMenciones(nuevo, usuarios)
      await crearNotaProyecto({ proyectoId, contenido: nuevo.trim(), menciones })
      setNuevo('')
      cargar()
    } catch (e) { alert('Error: ' + e.message) }
    setEnviando(false)
  }

  const eliminar = async (id) => {
    if (!confirm('¿Eliminar esta nota?')) return
    try { await eliminarNota(id); cargar() }
    catch (e) { alert('Error: ' + e.message) }
  }

  const formatoContenido = (texto) => {
    return texto.replace(/@([A-ZÁ-ÚÑ][a-zá-úñ]+(?:\s+[A-ZÁ-ÚÑ][a-zá-úñ]+)?)/g,
      `<span style="color:${COLORS.navy};font-weight:600;background:${COLORS.tealLight};padding:1px 5px;border-radius:4px">@$1</span>`)
  }

  return (
    <div>
      <div style={{ ...cardStyle, marginBottom:14, padding:14 }}>
        <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
          <Avatar nombre="Yo" color={COLORS.navy} tamano={36}/>
          <div style={{ flex:1 }}>
            <textarea
              value={nuevo}
              onChange={e => setNuevo(e.target.value)}
              placeholder="Escribe una nota... Usa @Nombre Apellido para mencionar a alguien"
              style={{ ...inputStyle, minHeight:70, resize:'vertical' }}
            />
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:8, flexWrap:'wrap', gap:8 }}>
              <div style={{ fontSize:10, color:COLORS.slate400 }}>
                {usuarios.length > 0 ? `Menciones: ${usuarios.slice(0, 4).map(u => `@${u.nombre.split(' ')[0]}`).join(' · ')}${usuarios.length > 4 ? '...' : ''}` : ''}
              </div>
              <button onClick={enviar} disabled={!nuevo.trim() || enviando} style={{...btnPrimary, opacity: !nuevo.trim() ? 0.5 : 1, display:'flex', alignItems:'center', gap:6}}>
                <Icon.Send/> {enviando ? 'Enviando...' : 'Publicar'}
              </button>
            </div>
          </div>
        </div>
      </div>
      {loading ? (
        <div style={{ padding:40, textAlign:'center', color:COLORS.slate400 }}>Cargando notas...</div>
      ) : notas.length === 0 ? (
        <div style={{ ...cardStyle, textAlign:'center', color:COLORS.slate400, padding:40 }}>
          Aún no hay notas en este proyecto. Sé el primero en comentar.
        </div>
      ) : notas.slice().reverse().map(n => {
        const autor = n.autor || usuarios.find(u => u.id === n.autor_id)
        return (
          <div key={n.id} style={{ display:'flex', gap:12, marginBottom:16 }}>
            <Avatar nombre={autor?.nombre || '?'} tamano={36}/>
            <div style={{ flex:1 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:5 }}>
                <span style={{ fontSize:13, fontWeight:600, color:COLORS.ink }}>{autor?.nombre || 'Usuario'}</span>
                <span style={{ fontSize:10, color:COLORS.slate400, fontFamily:'var(--font-mono)' }}>
                  {new Date(n.created_at).toLocaleString('es-MX', { dateStyle:'medium', timeStyle:'short' })}
                </span>
                <button onClick={() => eliminar(n.id)} style={{ marginLeft:'auto', border:'none', background:'transparent', color:COLORS.slate400, cursor:'pointer', padding:4 }} title="Eliminar"><Icon.Trash/></button>
              </div>
              <div style={{ background:COLORS.slate50, borderRadius:10, padding:12, fontSize:13, lineHeight:1.6, color:COLORS.slate600 }}
                dangerouslySetInnerHTML={{ __html: formatoContenido(n.contenido) }}/>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function TabFinanciero({ proyecto, hitos, puedeVerFinanciero }) {
  if (!puedeVerFinanciero) {
    return (
      <div style={{ ...cardStyle, padding:40, textAlign:'center', color:COLORS.slate500 }}>
        <div style={{ marginBottom:10 }}><Icon.Lock/></div>
        <div style={{ fontSize:14, fontWeight:600, marginBottom:6 }}>Acceso restringido</div>
        <div style={{ fontSize:12 }}>La información financiera de este proyecto está restringida para tu rol.</div>
      </div>
    )
  }

  const cobrado = hitos.filter(h => h.estado === 'Pagado').reduce((s,h) => s + (h.monto || 0), 0)
  const pendiente = hitos.filter(h => h.estado !== 'Pagado' && h.estado !== 'Cancelado').reduce((s,h) => s + (h.monto || 0), 0)
  const total = (proyecto.monto_total || proyecto.monto || 0) || (cobrado + pendiente)

  return (
    <div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:14, marginBottom:18 }}>
        <div style={cardStyle}>
          <div style={{ fontSize:11, color:COLORS.slate500, marginBottom:6 }}>Monto total</div>
          <div style={{ fontSize:22, fontWeight:500, color:COLORS.navy, fontFamily:'var(--font-serif)' }}>{fmtMoney(total)}</div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize:11, color:COLORS.slate500, marginBottom:6 }}>Cobrado</div>
          <div style={{ fontSize:22, fontWeight:500, color:COLORS.teal, fontFamily:'var(--font-serif)' }}>{fmtMoney(cobrado)}</div>
          <div style={{ fontSize:11, color:COLORS.slate400, marginTop:4 }}>{total > 0 ? Math.round(cobrado/total*100) : 0}%</div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize:11, color:COLORS.slate500, marginBottom:6 }}>Por cobrar</div>
          <div style={{ fontSize:22, fontWeight:500, color:COLORS.amber, fontFamily:'var(--font-serif)' }}>{fmtMoney(pendiente)}</div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize:11, color:COLORS.slate500, marginBottom:6 }}>Hitos</div>
          <div style={{ fontSize:22, fontWeight:500, color:COLORS.navy, fontFamily:'var(--font-serif)' }}>{hitos.length}</div>
          <div style={{ fontSize:11, color:COLORS.slate400, marginTop:4 }}>{hitos.filter(h => h.estado === 'Pagado').length} cobrados</div>
        </div>
      </div>
      <div style={{ ...cardStyle, padding:0, overflow:'hidden' }}>
        <div style={{ padding:'14px 18px', borderBottom:`1px solid ${COLORS.slate100}`, background:COLORS.slate50 }}>
          <div style={labelStyle}>Hitos de cobro</div>
        </div>
        {hitos.length === 0 ? (
          <div style={{ padding:40, textAlign:'center', color:COLORS.slate400, fontSize:12 }}>Sin hitos de cobro registrados para este proyecto.</div>
        ) : hitos.map(h => {
          const cfg = ESTADOS_HITO[h.estado] || ESTADOS_HITO['Pendiente']
          return (
            <div key={h.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 18px', borderBottom:`1px solid ${COLORS.slate100}` }}>
              <div style={{ width:10, height:10, borderRadius:'50%', background:cfg.sem, flexShrink:0 }}/>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:500, color:COLORS.ink }}>{h.descripcion || h.concepto || 'Hito'}</div>
                <div style={{ fontSize:10, color:COLORS.slate500, fontFamily:'var(--font-mono)', marginTop:2 }}>
                  Venc: {fmtDate(h.fecha_vencimiento)} {h.fecha_pago && `· Pago: ${fmtDate(h.fecha_pago)}`}
                </div>
              </div>
              <div style={{ fontSize:14, fontWeight:700, color:COLORS.navy, fontFamily:'var(--font-mono)' }}>{fmtMoney(h.monto)}</div>
              <Badge texto={h.estado} mapa={ESTADOS_HITO}/>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ModalNuevoProyecto({ onClose, onCreado }) {
  const [plantillas, setPlantillas] = useState([])
  const [clientes, setClientes] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [plantillaSel, setPlantillaSel] = useState(null)
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

  const crear = async () => {
    if (!plantillaSel || !form.nombre || !form.clienteId || !form.directorId) { alert('Completa los campos requeridos'); return }
    setCreando(true)
    try {
      const proyecto = await crearProyectoDesdePlantilla({
        plantillaId: plantillaSel.id, nombre: form.nombre, clienteId: form.clienteId, directorId: form.directorId,
        inicioFecha: form.inicioFecha, capacidadMw: form.capacidadMw ? parseFloat(form.capacidadMw) : null, ubicacion: form.ubicacion || null,
      })
      onCreado(proyecto)
    } catch (e) { alert('Error: ' + e.message); setCreando(false) }
  }

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(10,37,64,0.35)', zIndex:999 }}/>
      <div style={{ position:'fixed', top: isMobile ? 0 : '5%', left:'50%', transform:'translateX(-50%)', width: isMobile ? '100%' : 'min(880px, 95vw)', maxHeight: isMobile ? '100vh' : '90vh', background:'white', borderRadius: isMobile ? 0 : 16, zIndex:1000, display:'flex', flexDirection:'column' }}>
        <div style={{ padding:'18px 24px', borderBottom:`1px solid ${COLORS.slate100}`, display:'flex', justifyContent:'space-between' }}>
          <h2 style={{ fontSize:18, fontWeight:500, color:COLORS.navy, fontFamily:'var(--font-serif)', margin:0 }}>Nuevo proyecto</h2>
          <button onClick={onClose} style={{ width:32, height:32, border:'none', background:COLORS.slate50, borderRadius:8, cursor:'pointer' }}><Icon.X/></button>
        </div>
        <div style={{ flex:1, overflow:'auto', padding:20, display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap:20 }}>
          <div>
            <div style={labelStyle}>1. Plantilla ({plantillas.length})</div>
            <div style={{ display:'grid', gap:6, maxHeight: isMobile ? 200 : 500, overflow:'auto' }}>
              {plantillas.map(p => (
                <div key={p.id} onClick={() => setPlantillaSel(p)} style={{ padding:12, background: plantillaSel?.id === p.id ? COLORS.tealLight : 'white', border:`1.5px solid ${plantillaSel?.id === p.id ? COLORS.teal : COLORS.slate100}`, borderRadius:10, cursor:'pointer' }}>
                  <div style={{ fontSize:9, fontFamily:'var(--font-mono)', color:COLORS.slate400, fontWeight:600 }}>{p.codigo}</div>
                  <div style={{ fontSize:12, fontWeight:600, color:COLORS.ink }}>{p.nombre}</div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div style={labelStyle}>2. Datos</div>
            <div style={{ marginBottom:10 }}><label style={miniLabel}>Nombre *</label><input value={form.nombre} onChange={e=>setForm({...form, nombre:e.target.value})} style={inputStyle}/></div>
            <div style={{ marginBottom:10 }}><label style={miniLabel}>Cliente *</label><select value={form.clienteId} onChange={e=>setForm({...form, clienteId:e.target.value})} style={selectStyle}><option value="">Selecciona...</option>{clientes.map(c => <option key={c.id} value={c.id}>{c.razon_social}</option>)}</select></div>
            <div style={{ marginBottom:10 }}><label style={miniLabel}>Director *</label><select value={form.directorId} onChange={e=>setForm({...form, directorId:e.target.value})} style={selectStyle}><option value="">Selecciona...</option>{usuarios.filter(u => ['direccion','director_proyectos'].includes(u.rol)).map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}</select></div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
              <div><label style={miniLabel}>MW</label><input type="number" step="0.1" value={form.capacidadMw} onChange={e=>setForm({...form, capacidadMw:e.target.value})} style={inputStyle}/></div>
              <div><label style={miniLabel}>Inicio</label><input type="date" value={form.inicioFecha} onChange={e=>setForm({...form, inicioFecha:e.target.value})} style={inputStyle}/></div>
            </div>
            <div><label style={miniLabel}>Ubicación</label><input value={form.ubicacion} onChange={e=>setForm({...form, ubicacion:e.target.value})} style={inputStyle}/></div>
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
    if (!confirm(`Se generarán ${plantillaActs.length} actividades. ¿Continuar?`)) return
    setDesglosando(true)
    try {
      const n = await desglosarActividadConPlantilla(actividad.id, plantillaSel.id)
      alert(`✓ Se generaron ${n} actividades`)
      onDesglosado()
    } catch (e) { alert('Error: ' + e.message); setDesglosando(false) }
  }

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(10,37,64,0.35)', zIndex:999 }}/>
      <div style={{ position:'fixed', top: isMobile ? 0 : '5%', left:'50%', transform:'translateX(-50%)', width: isMobile ? '100%' : 'min(880px, 95vw)', maxHeight: isMobile ? '100vh' : '90vh', background:'white', borderRadius: isMobile ? 0 : 16, zIndex:1000, display:'flex', flexDirection:'column' }}>
        <div style={{ padding:'18px 24px', borderBottom:`1px solid ${COLORS.slate100}`, display:'flex', justifyContent:'space-between' }}>
          <div>
            <h2 style={{ fontSize:18, fontWeight:500, color:COLORS.navy, fontFamily:'var(--font-serif)', margin:0 }}>Desglosar con plantilla</h2>
            <p style={{ fontSize:11, color:COLORS.slate500, margin:'3px 0 0' }}>Para: <strong>{actividad.nombre}</strong></p>
          </div>
          <button onClick={onClose} style={{ border:'none', background:'transparent', cursor:'pointer' }}><Icon.X/></button>
        </div>
        <div style={{ flex:1, overflow:'auto', padding:20, display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap:16 }}>
          <div>
            <div style={labelStyle}>Plantilla</div>
            <div style={{ display:'grid', gap:6, maxHeight:500, overflow:'auto' }}>
              {plantillas.map(p => (
                <div key={p.id} onClick={() => setPlantillaSel(p)} style={{ padding:10, background: plantillaSel?.id === p.id ? COLORS.tealLight : 'white', border:`1.5px solid ${plantillaSel?.id === p.id ? COLORS.teal : COLORS.slate100}`, borderRadius:8, cursor:'pointer' }}>
                  <div style={{ fontSize:9, fontFamily:'var(--font-mono)', color:COLORS.slate400 }}>{p.codigo}</div>
                  <div style={{ fontSize:12, fontWeight:600 }}>{p.nombre}</div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div style={labelStyle}>{plantillaSel ? `Previsualización (${plantillaActs.length})` : 'Selecciona plantilla'}</div>
            {plantillaActs.length > 0 && (
              <div style={{ padding:12, background:COLORS.slate50, borderRadius:10, maxHeight:500, overflow:'auto' }}>
                {plantillaActs.map(a => (
                  <div key={a.orden} style={{ padding:'6px 0', fontSize:11, borderBottom:`1px solid ${COLORS.slate100}` }}>
                    <span style={{ fontFamily:'var(--font-mono)', color:COLORS.slate400, marginRight:6 }}>#{a.orden}</span>
                    {a.es_milestone && <span style={{ color:COLORS.navy, marginRight:4 }}><Icon.Diamond/></span>}
                    <span>{a.nombre}</span>
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

function DetalleProyecto({ proyectoId, onVolver, usuarioActual }) {
  const [proyecto, setProyecto] = useState(null)
  const [hitos, setHitos] = useState([])
  const [tab, setTab] = useState('resumen')
  const [loading, setLoading] = useState(true)
  const [desglosarAct, setDesglosarAct] = useState(null)
  const [panelAct, setPanelAct] = useState(null)
  const [panelProy, setPanelProy] = useState(false)
  const [clientes, setClientes] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [menuCtx, setMenuCtx] = useState(null)  // v8: {actividad, x, y}
  const isMobile = useIsMobile()

  const puedeVerFinanciero = usuarioActual?.rol
    ? ['direccion', 'admin', 'cobranza', 'ventas'].includes(usuarioActual.rol)
    : true

  const esDirOAdmin = usuarioActual?.rol
    ? ['direccion', 'admin', 'director_proyectos'].includes(usuarioActual.rol)
    : true

  const cargar = useCallback(async () => {
    try {
      const p = await getProyectoConActividades(proyectoId)
      setProyecto(p)
      try {
        const h = await getHitosProyecto(proyectoId)
        setHitos(h)
      } catch (err) { console.warn('No se pudieron cargar hitos:', err) }
    } catch (e) { alert('Error cargando proyecto: ' + e.message) }
    setLoading(false)
  }, [proyectoId])

  useEffect(() => {
    cargar()
    Promise.all([getClientes(), getUsuarios()]).then(([c, u]) => { setClientes(c); setUsuarios(u) })
  }, [cargar])

  const numeracion = useMemo(() => generarNumeracion(proyecto?.actividades || []), [proyecto])

  const actualizarInline = useCallback(async (actId, cambios) => {
    setProyecto(prev => ({ ...prev, actividades: prev.actividades.map(a => a.id === actId ? { ...a, ...cambios } : a) }))
    try { await actualizarActividad(actId, cambios) }
    catch (e) { alert('Error: ' + e.message); cargar() }
  }, [cargar])

  const crearNuevaActividad = useCallback(async ({ nombre, parentId = null }) => {
    const acts = proyecto?.actividades || []
    const siblings = acts.filter(a => (a.parent_id || null) === parentId)
    const maxNum = siblings.reduce((m, a) => Math.max(m, a.numero || 0), 0)
    const lastFin = siblings.length > 0 ? siblings.reduce((m, a) => a.fin > m ? a.fin : m, siblings[0].fin) : (proyecto.inicio || new Date().toISOString().split('T')[0])
    const inicio = addDays(lastFin, 1)
    const fin = addDays(inicio, 4)
    await crearActividad({
      proyecto_id: proyectoId, parent_id: parentId, nombre,
      numero: maxNum + 1, inicio, fin, avance: 0,
      estado: 'Sin iniciar', es_milestone: false, es_servicio_padre: false,
    })
    await cargar()
  }, [proyecto, proyectoId, cargar])

  const toggleActividad = async (a) => {
    const nueva = { completada: !a.completada, avance: !a.completada ? 100 : 0, estado: !a.completada ? 'Completada' : 'Sin iniciar' }
    setProyecto(prev => ({ ...prev, actividades: prev.actividades.map(x => x.id === a.id ? { ...x, ...nueva } : x) }))
    try { await actualizarActividad(a.id, nueva) } catch (e) { alert('Error: ' + e.message); cargar() }
  }

  // v8: Handlers menú contextual
  const abrirMenuCtx = useCallback((actividad, x, y) => {
    setMenuCtx({ actividad, x, y })
  }, [])

  const handleDuplicar = useCallback(async (actividad) => {
    try {
      await duplicarActividad(actividad.id)
      await cargar()
    } catch (e) { alert('Error al duplicar: ' + e.message) }
  }, [cargar])

  const handleEliminar = useCallback(async (actividad) => {
    const tieneHijos = proyecto?.actividades?.some(a => a.parent_id === actividad.id)
    const msg = tieneHijos
      ? `¿Eliminar "${actividad.nombre}" y TODAS sus sub-actividades? Esta acción no se puede deshacer.`
      : `¿Eliminar "${actividad.nombre}"? Esta acción no se puede deshacer.`
    if (!confirm(msg)) return
    try {
      await eliminarActividad(actividad.id)
      await cargar()
    } catch (e) { alert('Error al eliminar: ' + e.message) }
  }, [proyecto, cargar])

  const handleToggleMilestone = useCallback(async (actividad) => {
    const nuevo = !actividad.es_milestone
    setProyecto(prev => ({ ...prev, actividades: prev.actividades.map(a => a.id === actividad.id ? { ...a, es_milestone: nuevo } : a) }))
    try { await actualizarActividad(actividad.id, { es_milestone: nuevo }) }
    catch (e) { alert('Error: ' + e.message); cargar() }
  }, [cargar])

  const handleCambiarImportancia = useCallback(async (actividad, importancia) => {
    setProyecto(prev => ({ ...prev, actividades: prev.actividades.map(a => a.id === actividad.id ? { ...a, importancia } : a) }))
    try { await cambiarImportancia(actividad.id, importancia) }
    catch (e) { alert('Error: ' + e.message); cargar() }
  }, [cargar])

  const handleAgregarHijo = useCallback(async (actividad) => {
    const nombre = prompt(`Nombre de la nueva sub-actividad de "${actividad.nombre}":`)
    if (!nombre?.trim()) return
    try { await crearNuevaActividad({ nombre: nombre.trim(), parentId: actividad.id }) }
    catch (e) { alert('Error: ' + e.message) }
  }, [crearNuevaActividad])

  if (loading) return <div style={{ padding:40, textAlign:'center', color:COLORS.slate400 }}>Cargando proyecto...</div>
  if (!proyecto) return <div style={{ padding:40, textAlign:'center', color:COLORS.red }}>Proyecto no encontrado</div>

  const actividades = proyecto.actividades || []
  const bloqueadas = actividades.filter(a => a.estado === 'Bloqueada').length
  const retrasadas = actividades.filter(a => a.estado === 'Retrasada').length

  const tabs = [
    { k:'resumen', l:'Resumen' },
    { k:'actividades', l:'Actividades' },
    { k:'gantt', l:'Gantt', icon:<Icon.Calendar/> },
    { k:'kanban', l:'Kanban', icon:<Icon.Kanban/> },
    { k:'personas', l:'Por Persona', icon:<Icon.Users/> },
    { k:'documentos', l:'Documentos', icon:<Icon.Folder/> },
    { k:'notas', l:'Notas' },
  ]
  if (puedeVerFinanciero) tabs.push({ k:'financiero', l:'Financiero', icon:<Icon.Dollar/> })

  return (
    <div>
      {desglosarAct && <ModalDesglose actividad={desglosarAct} onClose={() => setDesglosarAct(null)} onDesglosado={() => { setDesglosarAct(null); cargar() }}/>}
      {panelAct && <PanelActividad actividad={panelAct} actividades={actividades} numeracion={numeracion} usuarios={usuarios} onClose={() => setPanelAct(null)} onCambio={cargar}/>}
      {panelProy && <PanelProyecto proyecto={proyecto} clientes={clientes} usuarios={usuarios} onClose={() => setPanelProy(false)} onCambio={cargar}/>}
      {menuCtx && (
        <MenuContextual
          x={menuCtx.x}
          y={menuCtx.y}
          actividad={menuCtx.actividad}
          proyectoId={proyectoId}
          onClose={() => setMenuCtx(null)}
          onAbrirInfo={setPanelAct}
          onDuplicar={handleDuplicar}
          onEliminar={handleEliminar}
          onToggleMilestone={handleToggleMilestone}
          onCambiarImportancia={(imp) => handleCambiarImportancia(menuCtx.actividad, imp)}
          onAgregarHijo={handleAgregarHijo}
        />
      )}

      <div style={{ display:'flex', alignItems:'flex-start', gap:12, marginBottom:16, flexWrap:'wrap' }}>
        <button onClick={onVolver} style={{ padding:'8px 12px', background:'white', border:`1px solid ${COLORS.slate200}`, borderRadius:8, fontSize:12, cursor:'pointer', color:COLORS.slate600, display:'flex', alignItems:'center', gap:6, fontWeight:500, minHeight:40 }}><Icon.Back/> Proyectos</button>
        <div style={{ flex:1, minWidth:200 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4, flexWrap:'wrap' }}>
            <span style={{ fontSize:11, fontFamily:'var(--font-mono)', color:COLORS.slate400 }}>{proyecto.codigo}</span>
            <Badge texto={proyecto.estado} mapa={ESTADOS_PROY}/>
            {bloqueadas > 0 && <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11, fontWeight:500, padding:'3px 10px', borderRadius:20, background:'#FEF3C7', color:'#D97706' }}><Icon.Lock/> {bloqueadas} bloqueadas</span>}
          </div>
          <h1 style={{ fontSize: isMobile ? 20 : 26, fontWeight:500, color:COLORS.navy, margin:0, fontFamily:'var(--font-serif)' }}>
            <EditableText value={proyecto.nombre} onSave={async v => {
              setProyecto(prev => ({ ...prev, nombre: v }))
              try { await supabase.from('proyectos').update({ nombre: v }).eq('id', proyectoId) }
              catch (e) { alert('Error: ' + e.message); cargar() }
            }} style={{ fontSize: isMobile ? 20 : 26, fontWeight:500, color:COLORS.navy, fontFamily:'var(--font-serif)' }}/>
          </h1>
          <p style={{ fontSize:12, color:COLORS.slate500, margin:'3px 0 0' }}>{proyecto.cliente?.razon_social || 'Sin cliente'} · {proyecto.director?.nombre || 'Sin director'}</p>
        </div>
        {esDirOAdmin && bloqueadas > 0 && (
          <button onClick={() => alert('Función "Autorizar avance": Registra pago del hito y desbloquea actividades automáticamente. Próximamente.')} style={{...btnTeal, display:'flex', alignItems:'center', gap:6}}>
            <Icon.Check/> Autorizar avance
          </button>
        )}
        <button onClick={() => setPanelProy(true)} title="Información del proyecto" style={{ padding:'8px 12px', background:'white', border:`1px solid ${COLORS.slate200}`, borderRadius:8, fontSize:12, cursor:'pointer', color:COLORS.slate600, display:'flex', alignItems:'center', gap:6, fontWeight:500, minHeight:40 }}><Icon.Info/> Info</button>
      </div>

      {bloqueadas > 0 && (
        <Alerta tipo="warn">
          <Icon.Lock/> <strong>{bloqueadas} actividades bloqueadas</strong> — Revisa los pagos pendientes para desbloquear el avance.
        </Alerta>
      )}
      {retrasadas > 0 && (
        <Alerta tipo="danger">
          <Icon.Warning/> <strong>{retrasadas} actividad(es) retrasada(s)</strong> — Requieren atención inmediata.
        </Alerta>
      )}

      <div style={{ display:'flex', borderBottom:`1px solid ${COLORS.slate200}`, marginBottom:20, gap:2, overflowX:'auto' }}>
        {tabs.map(t => (
          <button key={t.k} onClick={() => setTab(t.k)} style={{ padding:'10px 16px', border:'none', background:'transparent', cursor:'pointer', fontSize:13, fontWeight: tab===t.k?600:500, color: tab===t.k?COLORS.navy:COLORS.slate500, borderBottom: tab===t.k?`2px solid ${COLORS.navy}`:'2px solid transparent', marginBottom:-1, minHeight:44, display:'flex', alignItems:'center', gap:6, whiteSpace:'nowrap' }}>
            {t.icon}{t.l}
          </button>
        ))}
      </div>

      {tab === 'resumen' && <TabResumen proyecto={proyecto} actividades={actividades} hitos={hitos} usuarios={usuarios} puedeVerFinanciero={puedeVerFinanciero}/>}
      {tab === 'actividades' && <TabActividades actividades={actividades} numeracion={numeracion} onToggle={toggleActividad} onInlineUpdate={actualizarInline} onAbrirInfo={setPanelAct} onDesglosar={setDesglosarAct} onNuevaActividad={crearNuevaActividad} onMenuContextual={abrirMenuCtx}/>}
      {tab === 'gantt' && <GanttInteractivo actividadesProp={actividades} onRecargar={cargar} onDesglosar={setDesglosarAct} onAbrirInfo={setPanelAct} onInlineUpdate={actualizarInline} onNuevaActividad={crearNuevaActividad} onMenuContextual={abrirMenuCtx}/>}
      {tab === 'kanban' && <TabKanban actividades={actividades} onAbrirInfo={setPanelAct} numeracion={numeracion}/>}
      {tab === 'personas' && <TabPorPersona actividades={actividades} usuarios={usuarios} numeracion={numeracion} onAbrirInfo={setPanelAct}/>}
      {tab === 'documentos' && <TabDocumentos proyecto={proyecto}/>}
      {tab === 'notas' && <TabNotas proyectoId={proyectoId} usuarios={usuarios}/>}
      {tab === 'financiero' && <TabFinanciero proyecto={proyecto} hitos={hitos} puedeVerFinanciero={puedeVerFinanciero}/>}
    </div>
  )
}

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

  const filtrados = useMemo(() => {
    let r = proyectos
    if (filtro === 'Activos') r = r.filter(p => ['Por iniciar', 'En curso', 'En pausa'].includes(p.estado))
    else if (filtro === 'Terminados') r = r.filter(p => ['Terminado', 'Cancelado'].includes(p.estado))
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase()
      r = r.filter(p => p.nombre?.toLowerCase().includes(q) || p.cliente?.razon_social?.toLowerCase().includes(q) || p.codigo?.toLowerCase().includes(q))
    }
    return r
  }, [proyectos, filtro, busqueda])

  if (proyectoSel) return <DetalleProyecto proyectoId={proyectoSel} onVolver={() => { setProyectoSel(null); cargar() }} usuarioActual={usuario}/>

  return (
    <div>
      {modalNuevo && <ModalNuevoProyecto onClose={() => setModalNuevo(false)} onCreado={(p) => { setModalNuevo(false); cargar(); setProyectoSel(p.id) }}/>}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontSize: isMobile ? 24 : 32, fontWeight:400, color:COLORS.navy, margin:0, fontFamily:'var(--font-serif)' }}>Proyectos</h1>
          <p style={{ color:COLORS.slate500, fontSize:12, marginTop:4 }}>{filtrados.length} de {proyectos.length}</p>
        </div>
        <button onClick={() => setModalNuevo(true)} style={{ padding:'10px 18px', background:COLORS.navy, color:'white', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:6, minHeight:44 }}>
          <Icon.Plus/> {isMobile ? 'Nuevo' : 'Nuevo proyecto'}
        </button>
      </div>
      <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
        <div style={{ display:'flex', background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:10, padding:2 }}>
          {['Activos', 'Terminados', 'Todos'].map(f => (
            <button key={f} onClick={() => setFiltro(f)} style={{ padding:'7px 14px', border:'none', background: filtro === f ? COLORS.navy : 'transparent', color: filtro === f ? 'white' : COLORS.slate600, borderRadius:8, fontSize:12, fontWeight:600, cursor:'pointer' }}>{f}</button>
          ))}
        </div>
        <div style={{ flex:1, minWidth:200, position:'relative' }}>
          <div style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:COLORS.slate400 }}><Icon.Search/></div>
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar..." style={{ width:'100%', padding:'9px 14px 9px 36px', border:`1px solid ${COLORS.slate100}`, borderRadius:10, fontSize:12, outline:'none', minHeight:40, boxSizing:'border-box' }}/>
        </div>
      </div>
      {loading && <div style={{ padding:40, textAlign:'center', color:COLORS.slate400 }}>Cargando...</div>}
      {!loading && filtrados.length === 0 && <div style={{ padding:50, background:'white', border:`1px dashed ${COLORS.slate200}`, borderRadius:12, textAlign:'center', color:COLORS.slate500 }}>{busqueda ? 'Sin resultados' : 'Sin proyectos'}</div>}
      {!loading && filtrados.length > 0 && (
        <div style={{ display:'grid', gap:8 }}>
          {filtrados.map(p => {
            const tieneBloqueadas = (p.actividades || []).some(a => a.estado === 'Bloqueada')
            return (
              <div key={p.id} onClick={() => setProyectoSel(p.id)} style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderLeft:`3px solid ${ESTADOS_PROY[p.estado]?.bar || COLORS.slate400}`, borderRadius:10, padding:16, cursor:'pointer', display:'flex', alignItems:'center', gap:12 }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3, flexWrap:'wrap' }}>
                    <span style={{ fontSize:10, fontFamily:'var(--font-mono)', color:COLORS.slate400, fontWeight:600 }}>{p.codigo}</span>
                    <Badge texto={p.estado} mapa={ESTADOS_PROY}/>
                    {tieneBloqueadas && <span title="Actividades bloqueadas" style={{ color:COLORS.amber, display:'inline-flex' }}><Icon.Lock/></span>}
                  </div>
                  <div style={{ fontSize:15, fontWeight:500, color:COLORS.ink, marginBottom:2 }}>{p.nombre}</div>
                  <div style={{ fontSize:11, color:COLORS.slate500 }}>{p.cliente?.razon_social || 'Sin cliente'}{p.director?.nombre && ` · ${p.director.nombre}`}</div>
                </div>
                <span style={{ color:COLORS.slate400 }}>›</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}