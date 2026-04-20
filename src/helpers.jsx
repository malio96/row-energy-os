// ============================================================
// HELPERS COMPARTIDOS — Row Energy OS v2
// ============================================================
import { useState, useEffect } from 'react'

export const COLORS = {
  navy:'#0A2540', navy2:'#1B3A6B', teal:'#0F6E56', tealLight:'#E1F5EE',
  gold:'#C89B3C', red:'#DC2626', redLight:'#FEF2F2',
  amber:'#D97706', amberLight:'#FEF3C7',
  purple:'#6B4C9A', blue:'#3B82F6', green:'#10B981',
  slate50:'#F8FAFC', slate100:'#F1F5F9', slate200:'#E2E8F0',
  slate300:'#CBD5E1', slate400:'#94A3B8', slate500:'#64748B',
  slate600:'#475569', ink:'#1C2128',
}

export const ESTADOS_COT = {
  'Borrador':       { bg:'#F1F5F9', color:'#64748B' },
  'Enviada':        { bg:'#E0EDFF', color:'#1B3A6B' },
  'En revisión':    { bg:'#FEF3C7', color:'#D97706' },
  'Aprobada':       { bg:'#E1F5EE', color:'#0F6E56' },
  'Rechazada':      { bg:'#FEF2F2', color:'#DC2626' },
  'Vencida':        { bg:'#FEF2F2', color:'#DC2626' },
}

export const ETAPAS_LEAD = [
  { key:'Nuevo', color:'#94A3B8', bg:'#F1F5F9', prob:10 },
  { key:'En contacto', color:'#1B3A6B', bg:'#E0EDFF', prob:25 },
  { key:'Calificando', color:'#6B4C9A', bg:'#F3EEFB', prob:40 },
  { key:'Propuesta enviada', color:'#D97706', bg:'#FEF3C7', prob:55 },
  { key:'Negociación', color:'#C89B3C', bg:'#FEF9E6', prob:75 },
  { key:'Ganado', color:'#0F6E56', bg:'#E1F5EE', prob:100 },
  { key:'Perdido', color:'#DC2626', bg:'#FEF2F2', prob:0 },
]

export const ESTADOS_HITO = {
  'Pendiente':  { bg:'#F1F5F9', color:'#64748B' },
  'Facturado':  { bg:'#E0EDFF', color:'#1B3A6B' },
  'Cobrado':    { bg:'#E1F5EE', color:'#0F6E56' },
  'Vencido':    { bg:'#FEF2F2', color:'#DC2626' },
  'Cancelado':  { bg:'#F1F5F9', color:'#94A3B8' },
}

export const ESTADOS_FACTURA = {
  'Emitida':   { bg:'#E0EDFF', color:'#1B3A6B' },
  'Pagada':    { bg:'#E1F5EE', color:'#0F6E56' },
  'Vencida':   { bg:'#FEF2F2', color:'#DC2626' },
  'Cancelada': { bg:'#F1F5F9', color:'#94A3B8' },
}

export const ESTADOS_COMPRA = {
  'Solicitada': { bg:'#FEF3C7', color:'#D97706' },
  'Aprobada':   { bg:'#E1F5EE', color:'#0F6E56' },
  'Rechazada':  { bg:'#FEF2F2', color:'#DC2626' },
  'Pagada':     { bg:'#E0EDFF', color:'#1B3A6B' },
}

export const ESTADOS_TICKET = {
  'Abierto':      { bg:'#FEF2F2', color:'#DC2626' },
  'En progreso':  { bg:'#FEF3C7', color:'#D97706' },
  'Resuelto':     { bg:'#E1F5EE', color:'#0F6E56' },
  'Cerrado':      { bg:'#F1F5F9', color:'#94A3B8' },
}

export const ESTADOS_CONTRATO = {
  'Borrador': { bg:'#F1F5F9', color:'#64748B' },
  'Enviado':  { bg:'#E0EDFF', color:'#1B3A6B' },
  'Firmado':  { bg:'#E1F5EE', color:'#0F6E56' },
  'Vencido':  { bg:'#FEF2F2', color:'#DC2626' },
}

// ============================================================
// FORMATEADORES
// ============================================================
export function fmtMoney(n, short=false) {
  if (n === null || n === undefined || isNaN(n)) return '—'
  const num = Number(n)
  if (short && Math.abs(num) >= 1000000) return '$' + (num/1000000).toFixed(1) + 'M'
  if (short && Math.abs(num) >= 1000) return '$' + (num/1000).toFixed(0) + 'k'
  return '$' + num.toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export function fmtDate(s, format='short') {
  if (!s) return '—'
  const d = new Date(s + (s.includes && s.includes('T') ? '' : 'T00:00:00'))
  if (isNaN(d)) return s
  if (format === 'long') return d.toLocaleDateString('es-MX', { day:'numeric', month:'long', year:'numeric' })
  if (format === 'relative') return relativeTime(d)
  return d.toLocaleDateString('es-MX', { day:'2-digit', month:'2-digit', year:'numeric' })
}

export function relativeTime(date) {
  const diff = (new Date() - new Date(date)) / 1000
  if (diff < 60) return 'hace un momento'
  if (diff < 3600) return `hace ${Math.floor(diff/60)} min`
  if (diff < 86400) return `hace ${Math.floor(diff/3600)} h`
  if (diff < 604800) return `hace ${Math.floor(diff/86400)} días`
  if (diff < 2592000) return `hace ${Math.floor(diff/604800)} semanas`
  return `hace ${Math.floor(diff/2592000)} meses`
}

export function diffDays(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000)
}

export function daysUntil(fecha) {
  if (!fecha) return null
  return diffDays(new Date().toISOString().split('T')[0], fecha)
}

// ============================================================
// COMPONENTES REUTILIZABLES
// ============================================================
export function Badge({ texto, mapa, size=11 }) {
  const c = (mapa && mapa[texto]) || { bg:'#F1F5F9', color:'#64748B' }
  return <span style={{ display:'inline-flex', alignItems:'center', fontSize:size, fontWeight:500, padding:'3px 10px', borderRadius:20, background:c.bg, color:c.color, whiteSpace:'nowrap' }}>{texto}</span>
}

export function Avatar({ nombre, size=28 }) {
  const iniciales = nombre?.split(' ').map(n=>n[0]).slice(0,2).join('').toUpperCase() || '?'
  const colors = ['#1B3A6B','#0F6E56','#C89B3C','#6B4C9A','#D97706','#DC2626','#3B82F6','#10B981']
  const color = colors[(nombre?.length||0) % colors.length]
  return <div style={{ width:size, height:size, borderRadius:'50%', background:color, color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontSize:Math.max(10, size*0.38), fontWeight:600, flexShrink:0 }}>{iniciales}</div>
}

export function BarraAvance({ avance, color=COLORS.navy2, height=5, showNumber=true }) {
  const v = Math.max(0, Math.min(100, avance||0))
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:showNumber ? 100 : 60 }}>
      <div style={{ flex:1, height, background:'#EEF2F6', borderRadius:height/2, overflow:'hidden' }}>
        <div style={{ width:`${v}%`, height:'100%', background: v===100?COLORS.teal:color, borderRadius:height/2, transition:'width 0.3s' }}/>
      </div>
      {showNumber && <span style={{ fontSize:11, fontWeight:600, color:v===100?COLORS.teal:color, minWidth:32, fontFamily:'var(--font-mono)' }}>{v}%</span>}
    </div>
  )
}

export function EmptyState({ icon, titulo, descripcion, accion }) {
  return (
    <div style={{ padding:'50px 20px', background:'white', border:`1px dashed ${COLORS.slate200}`, borderRadius:12, textAlign:'center' }}>
      {icon && <div style={{ marginBottom:12, display:'flex', justifyContent:'center', color:COLORS.slate400 }}>{icon}</div>}
      <div style={{ fontSize:14, color:COLORS.slate600, marginBottom:4, fontWeight:500 }}>{titulo}</div>
      {descripcion && <div style={{ fontSize:12, color:COLORS.slate500, marginBottom:14 }}>{descripcion}</div>}
      {accion}
    </div>
  )
}

export function LoadingState() {
  return <div style={{ padding:40, textAlign:'center', color:COLORS.slate400, fontSize:13 }}>Cargando...</div>
}

// ============================================================
// ÍCONOS
// ============================================================
export function Icon(tipo) {
  const s = {
    X:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>,
    Plus:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>,
    Back:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>,
    Trash:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>,
    Check:<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>,
    Send:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
    Search:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>,
    Filter:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>,
    Sort:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M7 12h10M11 18h2"/></svg>,
    More:<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>,
    Edit:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>,
    Eye:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>,
    Mail:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-10 5L2 7"/></svg>,
    Phone:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>,
    Calendar:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>,
    Clock:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
    Download:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>,
    Upload:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>,
    Archive:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="5" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M10 12h4"/></svg>,
    TrendUp:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>,
    TrendDown:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/></svg>,
    Alert:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4M12 17h.01"/></svg>,
    Dollar:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
    Users:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    File:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
    Print:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>,
    Link:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
    Message:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
    Scale:<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10M12 3v18M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/></svg>,
    Diamond:<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2 22 12 12 22 2 12z"/></svg>,
  }
  return s[tipo] || null
}

// ============================================================
// ESTILOS COMPARTIDOS
// ============================================================
export const inputStyle = {
  width:'100%', padding:'10px 12px',
  border:`1px solid ${COLORS.slate200}`, borderRadius:8,
  fontSize:14, outline:'none', fontFamily:'var(--font-sans)',
  boxSizing:'border-box', minHeight:40,
  background:'white',
}

export const selectStyle = { ...inputStyle, cursor:'pointer' }

export const labelStyle = {
  fontSize:10, fontWeight:600, color:COLORS.slate500,
  textTransform:'uppercase', letterSpacing:'0.06em',
  display:'block', marginBottom:5,
}

export const btnPrimary = {
  padding:'10px 18px', background:COLORS.navy, color:'white',
  border:'none', borderRadius:8, fontSize:13, fontWeight:600,
  cursor:'pointer', minHeight:44, display:'inline-flex', alignItems:'center', gap:6,
}

export const btnSecondary = {
  padding:'10px 16px', background:'transparent', color:COLORS.slate600,
  border:`1px solid ${COLORS.slate200}`, borderRadius:8, fontSize:13, fontWeight:500,
  cursor:'pointer', minHeight:44, display:'inline-flex', alignItems:'center', gap:6,
}

export const btnDanger = {
  padding:'10px 16px', background:COLORS.red, color:'white',
  border:'none', borderRadius:8, fontSize:13, fontWeight:600,
  cursor:'pointer', minHeight:44,
}

export const card = {
  background:'white', border:`1px solid ${COLORS.slate100}`,
  borderRadius:12, padding:20,
}

// ============================================================
// HOOKS
// ============================================================
export function useIsMobile() {
  const [m, setM] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false)
  useEffect(() => { const h = () => setM(window.innerWidth < 768); window.addEventListener('resize', h); return () => window.removeEventListener('resize', h) }, [])
  return m
}

export function useKeyboard(handlers) {
  useEffect(() => {
    const handle = (e) => {
      const key = `${e.metaKey||e.ctrlKey?'mod+':''}${e.key.toLowerCase()}`
      if (handlers[key]) { e.preventDefault(); handlers[key](e) }
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [handlers])
}

export function loadPref(key, defaultValue) {
  try { const v = localStorage.getItem(`rowenergy:${key}`); return v ? JSON.parse(v) : defaultValue }
  catch { return defaultValue }
}
export function savePref(key, value) {
  try { localStorage.setItem(`rowenergy:${key}`, JSON.stringify(value)) } catch {}
}