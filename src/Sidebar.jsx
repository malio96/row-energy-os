import { useState, useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { supabase, getNotificaciones } from './supabase'

const COLORS = {
  navy: '#0A2540', navy2: '#1B3A6B', teal: '#0F6E56',
  slate100: '#F1F5F9', slate400: '#94A3B8', slate500: '#64748B',
}

const ICON = (path) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={path}/></svg>

const modulos = [
  { seccion: null, items: [
    { id:'dashboard', label:'Dashboard', path:'/', icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg> },
  ]},
  { seccion: 'OPERACIONES', items: [
    { id:'proyectos', label:'Proyectos', path:'/proyectos', icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2 20h20M5 20V8l7-5 7 5v12M9 20v-6h6v6"/></svg> },
    { id:'cotizaciones', label:'Cotizaciones', path:'/cotizaciones', icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 10h8M8 14h8M8 18h5"/></svg> },
    { id:'contratos', label:'Contratos', path:'/contratos', icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M12 18v-6"/><path d="M9 15h6"/></svg> },
  ]},
  { seccion: 'CRM', items: [
    { id:'leads', label:'Leads / CRM', path:'/leads', icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg> },
  ]},
  { seccion: 'FINANZAS', items: [
    { id:'cobranza', label:'Cobranza', path:'/cobranza', icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8M12 6v2M12 16v2"/></svg> },
    { id:'facturacion', label:'Facturación', path:'/facturacion', icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg> },
    { id:'compras', label:'Compras', path:'/compras', icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/></svg> },
    { id:'financiero', label:'Control Financiero', path:'/financiero', icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 3v18h18M7 14l4-4 4 4 5-5"/></svg> },
  ]},
  { seccion: 'CIERRE', items: [
    { id:'cierre', label:'Cierre Admin.', path:'/cierre', icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg> },
    { id:'postventa', label:'Postventa', path:'/postventa', icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z"/></svg> },
  ]},
  { seccion: 'SISTEMA', items: [
    { id:'config', label:'Configuración', path:'/config', icon:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> },
  ]},
]

export default function Sidebar({ usuario }) {
  const [notifCount, setNotifCount] = useState(0)

  useEffect(() => {
    if (!usuario?.id) return
    getNotificaciones(usuario.id).then(ns => setNotifCount(ns.filter(n => !n.leida).length))
    const sub = supabase.channel('notif').on('postgres_changes', { event: '*', schema: 'public', table: 'notificaciones' }, () => {
      getNotificaciones(usuario.id).then(ns => setNotifCount(ns.filter(n => !n.leida).length))
    }).subscribe()
    return () => supabase.removeChannel(sub)
  }, [usuario])

  const cerrarSesion = async () => {
    await supabase.auth.signOut()
    window.location.reload()
  }

  return (
    <div style={{ width:240, height:'100vh', background:COLORS.navy, color:'white', display:'flex', flexDirection:'column', fontFamily:'var(--font-sans)', flexShrink:0 }}>
      <div style={{ padding:'22px 20px 18px', borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <img src="/logo-blanco.png" alt="Row Energy" style={{ height:24 }} onError={(e)=>{e.target.style.display='none'}}/>
          <div>
            <div style={{ fontSize:16, fontWeight:600, letterSpacing:'-0.01em' }}>Row Energy</div>
            <div style={{ fontSize:10, color:'rgba(255,255,255,0.5)', letterSpacing:'0.05em' }}>PLATAFORMA ENTERPRISE</div>
          </div>
        </div>
      </div>

      {usuario && (
        <div style={{ padding:'14px 20px', borderBottom:'1px solid rgba(255,255,255,0.08)', display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:32, height:32, borderRadius:'50%', background:COLORS.teal, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:600 }}>
            {usuario.nombre.split(' ').map(n=>n[0]).slice(0,2).join('')}
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:12, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{usuario.nombre}</div>
            <div style={{ fontSize:10, color:'rgba(255,255,255,0.5)', textTransform:'capitalize' }}>{usuario.rol?.replace('_',' ')}</div>
          </div>
          {notifCount > 0 && <div style={{ background:'#DC2626', color:'white', fontSize:10, fontWeight:600, padding:'2px 6px', borderRadius:10, fontFamily:'var(--font-mono)' }}>{notifCount}</div>}
        </div>
      )}

      <nav style={{ flex:1, overflowY:'auto', padding:'8px 0' }}>
        {modulos.map((grupo, i) => (
          <div key={i} style={{ marginBottom:4 }}>
            {grupo.seccion && <div style={{ padding:'14px 20px 6px', fontSize:10, fontWeight:600, color:'rgba(255,255,255,0.35)', letterSpacing:'0.1em' }}>{grupo.seccion}</div>}
            {grupo.items.map(item => (
              <NavLink key={item.id} to={item.path} end={item.path==='/'} style={({isActive}) => ({
                display:'flex', alignItems:'center', gap:12, padding:'9px 20px', fontSize:13, color: isActive ? 'white' : 'rgba(255,255,255,0.72)',
                background: isActive ? 'rgba(255,255,255,0.08)' : 'transparent', textDecoration:'none', borderLeft: isActive ? `3px solid ${COLORS.teal}` : '3px solid transparent',
                transition:'all 0.12s'
              })}>
                {item.icon}
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <button onClick={cerrarSesion} style={{ padding:'14px 20px', background:'transparent', border:'none', borderTop:'1px solid rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.6)', fontSize:12, textAlign:'left', cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:8 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>
        Cerrar sesión
      </button>
    </div>
  )
}