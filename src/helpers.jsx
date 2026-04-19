// Helpers compartidos entre módulos
export const COLORS = {
  navy:'#0A2540', navy2:'#1B3A6B', teal:'#0F6E56', tealLight:'#E1F5EE',
  gold:'#C89B3C', red:'#DC2626', amber:'#D97706', purple:'#6B4C9A',
  slate50:'#F8FAFC', slate100:'#F1F5F9', slate200:'#E2E8F0',
  slate400:'#94A3B8', slate500:'#64748B', slate600:'#475569', ink:'#1C2128',
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
  { key:'Nuevo', color:'#94A3B8', bg:'#F1F5F9' },
  { key:'En contacto', color:'#1B3A6B', bg:'#E0EDFF' },
  { key:'Calificando', color:'#6B4C9A', bg:'#F3EEFB' },
  { key:'Propuesta enviada', color:'#D97706', bg:'#FEF3C7' },
  { key:'Negociación', color:'#C89B3C', bg:'#FEF9E6' },
  { key:'Ganado', color:'#0F6E56', bg:'#E1F5EE' },
  { key:'Perdido', color:'#DC2626', bg:'#FEF2F2' },
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

export function fmtMoney(n) {
  if (n === null || n === undefined) return '—'
  return '$' + Number(n).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export function fmtDate(s) {
  if (!s) return '—'
  return s
}

export function diffDays(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000)
}

export function Badge({ texto, mapa, tamano=11 }) {
  const c = mapa[texto] || { bg:'#F1F5F9', color:'#64748B' }
  return <span style={{ display:'inline-flex', alignItems:'center', fontSize:tamano, fontWeight:500, padding:'3px 10px', borderRadius:20, background:c.bg, color:c.color, whiteSpace:'nowrap' }}>{texto}</span>
}

export function Avatar({ nombre, size=28 }) {
  const iniciales = nombre?.split(' ').map(n=>n[0]).slice(0,2).join('').toUpperCase() || '?'
  const colors = ['#1B3A6B','#0F6E56','#C89B3C','#6B4C9A','#D97706','#DC2626']
  const color = colors[(nombre?.length||0) % colors.length]
  return <div style={{ width:size, height:size, borderRadius:'50%', background:color, color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontSize:size*0.38, fontWeight:600, flexShrink:0 }}>{iniciales}</div>
}

export const inputStyle = { width:'100%', padding:'10px 12px', border:`1px solid ${COLORS.slate200}`, borderRadius:8, fontSize:13, outline:'none', fontFamily:'var(--font-sans)', boxSizing:'border-box' }
export const selectStyle = { ...inputStyle, background:'white', cursor:'pointer' }
export const labelStyle = { fontSize:11, fontWeight:600, color:COLORS.slate500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:6 }

export function Icon(tipo) {
  const s = { X:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>,
              Plus:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 5v14M5 12h14"/></svg>,
              Back:<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>,
              Trash:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>,
              Check:<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5"><path d="M20 6 9 17l-5-5"/></svg>,
              Send:<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> }
  return s[tipo] || null
}