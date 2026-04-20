import { useState, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { supabase, getNotificaciones } from './supabase'

const COLORS = { navy:'#0A2540', navy2:'#1B3A6B', teal:'#0F6E56', slate100:'#F1F5F9', slate400:'#94A3B8', slate500:'#64748B' }

const modulos = [
  { seccion: null, items: [
    { id:'dashboard', label:'Dashboard', path:'/', mobileNav:true, icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg> },
  ]},
  { seccion: 'OPERACIONES', items: [
    { id:'proyectos', label:'Proyectos', path:'/proyectos', mobileNav:true, icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2 20h20M5 20V8l7-5 7 5v12M9 20v-6h6v6"/></svg> },
    { id:'cotizaciones', label:'Cotizaciones', path:'/cotizaciones', mobileNav:true, icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 10h8M8 14h8M8 18h5"/></svg> },
    { id:'contratos', label:'Contratos', path:'/contratos', icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg> },
  ]},
  { seccion: 'CRM', items: [
    { id:'leads', label:'Leads / CRM', path:'/leads', mobileNav:true, icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg> },
  ]},
  { seccion: 'FINANZAS', items: [
    { id:'cobranza', label:'Cobranza', path:'/cobranza', icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/></svg> },
    { id:'facturacion', label:'Facturación', path:'/facturacion', icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6"/></svg> },
    { id:'compras', label:'Compras', path:'/compras', icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/></svg> },
    { id:'financiero', label:'Control Financiero', path:'/financiero', icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 3v18h18M7 14l4-4 4 4 5-5"/></svg> },
  ]},
  { seccion: 'CIERRE', items: [
    { id:'cierre', label:'Cierre Admin.', path:'/cierre', icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg> },
    { id:'postventa', label:'Postventa', path:'/postventa', icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z"/></svg> },
  ]},
  { seccion: 'SISTEMA', items: [
    { id:'config', label:'Configuración', path:'/config', icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3"/><path d="M12 1v6M12 17v6M4.2 4.2l4.3 4.3M15.5 15.5l4.3 4.3M1 12h6M17 12h6M4.2 19.8l4.3-4.3M15.5 8.5l4.3-4.3"/></svg> },
  ]},
]

const mobileNavItems = modulos.flatMap(s => s.items).filter(i => i.mobileNav)

export function MobileHeader({ usuario, onOpenMenu, notifCount }) {
  return (
    <div style={{ position:'sticky', top:0, zIndex:100, background:COLORS.navy, color:'white', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', height:56, boxShadow:'0 2px 8px rgba(0,0,0,0.1)' }}>
      <button onClick={onOpenMenu} style={{ background:'transparent', border:'none', color:'white', padding:8, cursor:'pointer', display:'flex', alignItems:'center' }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
      </button>
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <img src="/logo-blanco.png" alt="" style={{ height:20 }} onError={e=>e.target.style.display='none'}/>
        <span style={{ fontSize:14, fontWeight:600, letterSpacing:'-0.01em' }}>Row Energy</span>
      </div>
      <div style={{ position:'relative', width:36, height:36, borderRadius:'50%', background:COLORS.teal, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:600 }}>
        {usuario?.nombre?.split(' ').map(n=>n[0]).slice(0,2).join('')}
        {notifCount > 0 && <div style={{ position:'absolute', top:-4, right:-4, background:'#DC2626', color:'white', fontSize:9, fontWeight:700, minWidth:16, height:16, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', padding:'0 4px' }}>{notifCount}</div>}
      </div>
    </div>
  )
}

export function MobileBottomNav() {
  return (
    <div style={{ position:'fixed', bottom:0, left:0, right:0, zIndex:99, background:'white', borderTop:`1px solid ${COLORS.slate100}`, display:'flex', justifyContent:'space-around', alignItems:'center', height:62, boxShadow:'0 -2px 12px rgba(10,37,64,0.06)', paddingBottom:'env(safe-area-inset-bottom)' }}>
      {mobileNavItems.map(item => (
        <NavLink key={item.id} to={item.path} end={item.path==='/'} style={({isActive}) => ({
          display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
          gap:3, padding:'8px 4px', textDecoration:'none',
          color: isActive ? COLORS.teal : COLORS.slate500,
          fontSize:10, fontWeight: isActive ? 600 : 500,
          flex:1, minWidth:0
        })}>
          {item.icon}
          <span style={{ whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:'100%' }}>{item.label.replace(' / CRM','').replace(' Admin.','')}</span>
        </NavLink>
      ))}
    </div>
  )
}

export default function Sidebar({ usuario, isMobile, mobileOpen, onMobileClose }) {
  const [notifCount, setNotifCount] = useState(0)
  const location = useLocation()

  useEffect(() => {
    if (!usuario?.id) return
    getNotificaciones(usuario.id).then(ns => setNotifCount(ns.filter(n => !n.leida).length))
    const sub = supabase.channel('notif').on('postgres_changes', { event: '*', schema: 'public', table: 'notificaciones' }, () => {
      getNotificaciones(usuario.id).then(ns => setNotifCount(ns.filter(n => !n.leida).length))
    }).subscribe()
    return () => supabase.removeChannel(sub)
  }, [usuario])

  // Cerrar sidebar mobile al cambiar de ruta
  useEffect(() => { if (isMobile && mobileOpen) onMobileClose() }, [location.pathname])

  const cerrarSesion = async () => {
    if (!confirm('¿Cerrar sesión?')) return
    await supabase.auth.signOut()
    window.location.reload()
  }

  // En mobile con sidebar cerrado, solo renderizamos el overlay y el drawer
  if (isMobile) {
    return (
      <>
        {mobileOpen && <div onClick={onMobileClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:200, animation:'fadeIn 0.2s' }}/>}
        <div style={{
          position:'fixed', top:0, left:0, bottom:0, width:270, background:COLORS.navy, color:'white',
          display:'flex', flexDirection:'column', zIndex:201,
          transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition:'transform 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: mobileOpen ? '2px 0 16px rgba(0,0,0,0.2)' : 'none'
        }}>
          <SidebarContent usuario={usuario} notifCount={notifCount} onCerrarSesion={cerrarSesion} isMobile/>
        </div>
      </>
    )
  }

  // Desktop: sidebar fijo
  return (
    <div style={{ width:240, height:'100vh', background:COLORS.navy, color:'white', display:'flex', flexDirection:'column', flexShrink:0, fontFamily:'var(--font-sans)' }}>
      <SidebarContent usuario={usuario} notifCount={notifCount} onCerrarSesion={cerrarSesion}/>
    </div>
  )
}

function SidebarContent({ usuario, notifCount, onCerrarSesion, isMobile }) {
  return (
    <>
      <div style={{ padding:'22px 20px 18px', borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <img src="/logo-blanco.png" alt="Row Energy" style={{ height:24 }} onError={e=>e.target.style.display='none'}/>
          <div>
            <div style={{ fontSize:16, fontWeight:600, letterSpacing:'-0.01em' }}>Row Energy</div>
            <div style={{ fontSize:10, color:'rgba(255,255,255,0.5)', letterSpacing:'0.05em' }}>PLATAFORMA ENTERPRISE</div>
          </div>
        </div>
      </div>

      {usuario && (
        <div style={{ padding:'14px 20px', borderBottom:'1px solid rgba(255,255,255,0.08)', display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:34, height:34, borderRadius:'50%', background:COLORS.teal, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:600 }}>
            {usuario.nombre.split(' ').map(n=>n[0]).slice(0,2).join('')}
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:13, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{usuario.nombre}</div>
            <div style={{ fontSize:10, color:'rgba(255,255,255,0.5)', textTransform:'capitalize' }}>{usuario.rol?.replace('_',' ')}</div>
          </div>
          {notifCount > 0 && !isMobile && <div style={{ background:'#DC2626', color:'white', fontSize:10, fontWeight:600, padding:'2px 6px', borderRadius:10, fontFamily:'var(--font-mono)' }}>{notifCount}</div>}
        </div>
      )}

      <nav style={{ flex:1, overflowY:'auto', padding:'8px 0', WebkitOverflowScrolling:'touch' }}>
        {modulos.map((grupo, i) => (
          <div key={i} style={{ marginBottom:4 }}>
            {grupo.seccion && <div style={{ padding:'14px 20px 6px', fontSize:10, fontWeight:600, color:'rgba(255,255,255,0.35)', letterSpacing:'0.1em' }}>{grupo.seccion}</div>}
            {grupo.items.map(item => (
              <NavLink key={item.id} to={item.path} end={item.path==='/'} style={({isActive}) => ({
                display:'flex', alignItems:'center', gap:12, padding:'11px 20px', fontSize:13,
                color: isActive ? 'white' : 'rgba(255,255,255,0.72)',
                background: isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
                textDecoration:'none',
                borderLeft: isActive ? `3px solid ${COLORS.teal}` : '3px solid transparent',
                transition:'all 0.12s'
              })}>
                {item.icon}
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <button onClick={onCerrarSesion} style={{ padding:'14px 20px', background:'transparent', border:'none', borderTop:'1px solid rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.6)', fontSize:12, textAlign:'left', cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:8 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>
        Cerrar sesión
      </button>
    </>
  )
}