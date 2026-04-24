import { useState, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { supabase, getNotificaciones } from './supabase'

// ============================================================
// v13 — Sidebar retráctil estilo Klar
// Cambios vs versión anterior:
//   1. Botón para colapsar/expandir (solo desktop)
//   2. Separación del borde (padding exterior)
//   3. Esquinas redondeadas estilo Klar
//   4. Cuando colapsado muestra solo iconos (60px)
//   5. Cuando expandido 220px con labels
//   6. Estado persistente en localStorage
// ============================================================

const COLORS = {
  navy: '#0A2540', navy2: '#1B3A6B', teal: '#0F6E56',
  slate50: '#F8FAFC', slate100: '#F1F5F9', slate200: '#E2E8F0',
  slate400: '#94A3B8', slate500: '#64748B', slate600: '#475569',
  bg: '#F5F5F4', // Fondo estilo Klar (beige muy claro / warm gray)
}

// Helpers de persistencia
const loadPref = (key, def) => {
  try { const v = localStorage.getItem(key); return v !== null ? JSON.parse(v) : def } catch { return def }
}
const savePref = (key, val) => {
  try { localStorage.setItem(key, JSON.stringify(val)) } catch {}
}

// ============================================================
// Definición de módulos
// ============================================================
const modulos = [
  { seccion: null, items: [
    { id:'dashboard', label:'Dashboard', path:'/', mobileNav:true,
      icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>
    },
  ]},
  { seccion: 'OPERACIONES', items: [
    { id:'proyectos', label:'Proyectos', path:'/proyectos', mobileNav:true,
      icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 20h20M5 20V8l7-5 7 5v12M9 20v-6h6v6"/></svg>
    },
    { id:'cotizaciones', label:'Cotizaciones', path:'/cotizaciones', mobileNav:true,
      icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 10h8M8 14h8M8 18h5"/></svg>
    },
    { id:'contratos', label:'Contratos', path:'/contratos',
      icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
    },
  ]},
  { seccion: 'CRM', items: [
    { id:'leads', label:'Leads / CRM', path:'/leads', mobileNav:true,
      icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
    },
  ]},
  { seccion: 'FINANZAS', items: [
    { id:'cobranza', label:'Cobranza', path:'/cobranza',
      icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
    },
    { id:'facturacion', label:'Facturación', path:'/facturacion',
      icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 13h6M9 17h6"/></svg>
    },
    { id:'compras', label:'Compras', path:'/compras',
      icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 8l-2 12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L3 8M1 8h22M10 12v4M14 12v4"/><path d="M7 8V6a5 5 0 0 1 10 0v2"/></svg>
    },
  ]},
  { seccion: 'POST-VENTA', items: [
    { id:'cierre', label:'Cierre', path:'/cierre',
      icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
    },
    { id:'postventa', label:'Post-venta', path:'/postventa',
      icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/></svg>
    },
  ]},
  { seccion: 'SISTEMA', items: [
    { id:'config', label:'Configuración', path:'/config',
      icon:<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
    },
  ]},
]

// ============================================================
// Hook: detectar mobile
// ============================================================
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false)
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return isMobile
}

// ============================================================
// Componente principal
// ============================================================
export default function Sidebar({ usuario, onLogout }) {
  const location = useLocation()
  const isMobile = useIsMobile()
  const [collapsed, setCollapsed] = useState(() => loadPref('sidebar_collapsed', false))
  const [mobileOpen, setMobileOpen] = useState(false)
  const [notifCount, setNotifCount] = useState(0)

  // Cargar notificaciones no leídas
  useEffect(() => {
    if (!usuario?.id) return
    getNotificaciones(usuario.id).then(notifs => {
      setNotifCount((notifs || []).filter(n => !n.leida).length)
    }).catch(() => {})
  }, [usuario?.id, location.pathname])

  // Guardar preferencia
  useEffect(() => { savePref('sidebar_collapsed', collapsed) }, [collapsed])

  // Cerrar menú mobile al navegar
  useEffect(() => { setMobileOpen(false) }, [location.pathname])

  const ancho = collapsed ? 72 : 240

  // ============================================================
  // MOBILE: Header + drawer + bottom nav
  // ============================================================
  if (isMobile) {
    const mobileNavItems = modulos.flatMap(s => s.items).filter(i => i.mobileNav).slice(0, 5)
    return (
      <>
        {/* Header superior mobile */}
        <div style={{
          position:'fixed', top:0, left:0, right:0, zIndex:100, height:56,
          background:'white', borderBottom:`1px solid ${COLORS.slate100}`,
          display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 16px',
        }}>
          <button onClick={() => setMobileOpen(true)} style={{ width:40, height:40, border:'none', background:'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={COLORS.navy} strokeWidth="2" strokeLinecap="round"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
          </button>
          <div style={{ fontFamily:'var(--font-serif)', fontSize:16, fontWeight:500, color:COLORS.navy, letterSpacing:'-0.02em' }}>Row Energy</div>
          <div style={{ width:40 }}/>
        </div>

        {/* Drawer overlay */}
        {mobileOpen && (
          <>
            <div onClick={() => setMobileOpen(false)} style={{ position:'fixed', inset:0, background:'rgba(10,37,64,0.4)', zIndex:200 }}/>
            <div style={{
              position:'fixed', top:0, left:0, bottom:0, width:280, background:'white', zIndex:201,
              display:'flex', flexDirection:'column', boxShadow:'0 10px 40px rgba(0,0,0,0.15)',
              overflow:'auto',
            }}>
              <div style={{ padding:'20px 20px 12px', borderBottom:`1px solid ${COLORS.slate100}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <div style={{ fontFamily:'var(--font-serif)', fontSize:18, color:COLORS.navy, fontWeight:500 }}>Row Energy</div>
                  <div style={{ fontSize:10, color:COLORS.slate500, marginTop:2, letterSpacing:'0.04em' }}>OS · v13</div>
                </div>
                <button onClick={() => setMobileOpen(false)} style={{ width:32, height:32, border:'none', background:COLORS.slate50, borderRadius:8, cursor:'pointer' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={COLORS.slate600} strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
              </div>
              <div style={{ flex:1, padding:'12px 8px', overflow:'auto' }}>
                {modulos.map((seccion, idx) => (
                  <div key={idx} style={{ marginBottom: 16 }}>
                    {seccion.seccion && (
                      <div style={{ fontSize:10, fontWeight:700, color:COLORS.slate400, letterSpacing:'0.1em', padding:'8px 12px' }}>
                        {seccion.seccion}
                      </div>
                    )}
                    {seccion.items.map(item => {
                      const active = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path))
                      return (
                        <NavLink key={item.id} to={item.path} style={{ textDecoration:'none' }}>
                          <div style={{
                            display:'flex', alignItems:'center', gap:12, padding:'12px 14px',
                            borderRadius:10, margin:'2px 4px',
                            background: active ? COLORS.navy : 'transparent',
                            color: active ? 'white' : COLORS.slate600,
                            fontSize:14, fontWeight: active ? 600 : 500,
                          }}>
                            {item.icon}
                            <span>{item.label}</span>
                          </div>
                        </NavLink>
                      )
                    })}
                  </div>
                ))}
              </div>
              <div style={{ padding:'12px 16px', borderTop:`1px solid ${COLORS.slate100}` }}>
                <div style={{ fontSize:12, fontWeight:600, color:COLORS.ink }}>{usuario?.nombre || '—'}</div>
                <div style={{ fontSize:10, color:COLORS.slate500, marginBottom:8 }}>{usuario?.rol || ''}</div>
                <button onClick={onLogout} style={{ width:'100%', padding:'10px 14px', background:COLORS.slate50, border:'none', borderRadius:8, fontSize:12, fontWeight:600, color:COLORS.slate600, cursor:'pointer' }}>
                  Cerrar sesión
                </button>
              </div>
            </div>
          </>
        )}

        {/* Bottom nav mobile */}
        <div style={{
          position:'fixed', bottom:0, left:0, right:0, zIndex:100, height:62,
          background:'white', borderTop:`1px solid ${COLORS.slate100}`,
          display:'flex', justifyContent:'space-around', alignItems:'center', padding:'0 8px',
          paddingBottom:'env(safe-area-inset-bottom)',
        }}>
          {mobileNavItems.map(item => {
            const active = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path))
            return (
              <NavLink key={item.id} to={item.path} style={{ textDecoration:'none', flex:1 }}>
                <div style={{
                  display:'flex', flexDirection:'column', alignItems:'center', gap:3, padding:'6px 4px',
                  color: active ? COLORS.navy : COLORS.slate400,
                }}>
                  {item.icon}
                  <span style={{ fontSize:9, fontWeight: active ? 700 : 500 }}>{item.label.split(' ')[0]}</span>
                </div>
              </NavLink>
            )
          })}
        </div>
      </>
    )
  }

  // ============================================================
  // DESKTOP: Sidebar retráctil estilo Klar
  // ============================================================
  return (
    <aside style={{
      // v13: Separación del borde (no pegado al marco)
      margin: 12,
      width: ancho,
      minWidth: ancho,
      maxWidth: ancho,
      height: 'calc(100vh - 24px)',
      background: 'white',
      // v13: Esquinas redondeadas estilo Klar
      borderRadius: 16,
      boxShadow: '0 1px 3px rgba(10, 37, 64, 0.04), 0 8px 24px rgba(10, 37, 64, 0.06)',
      display: 'flex', flexDirection: 'column',
      transition: 'width 0.2s ease, min-width 0.2s ease, max-width 0.2s ease',
      overflow: 'hidden',
      flexShrink: 0,
    }}>
      {/* HEADER — Logo + botón colapsar */}
      <div style={{
        padding: collapsed ? '18px 0 14px' : '20px 20px 14px',
        borderBottom: `1px solid ${COLORS.slate100}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between',
        flexShrink: 0,
      }}>
        {!collapsed && (
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontFamily: 'var(--font-serif)', fontSize: 18, color: COLORS.navy,
              fontWeight: 500, letterSpacing: '-0.02em',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              Row Energy
            </div>
            <div style={{ fontSize: 10, color: COLORS.slate400, marginTop: 2, letterSpacing: '0.06em', fontWeight: 600 }}>
              OS · v13
            </div>
          </div>
        )}
        {/* Botón colapsar/expandir */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? 'Expandir menú' : 'Contraer menú'}
          style={{
            width: 28, height: 28, minWidth: 28,
            border: `1px solid ${COLORS.slate100}`,
            background: 'white',
            borderRadius: 8,
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: COLORS.slate500,
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = COLORS.slate50; e.currentTarget.style.color = COLORS.navy }}
          onMouseLeave={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.color = COLORS.slate500 }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: collapsed ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
      </div>

      {/* NAV — Módulos */}
      <nav style={{ flex: 1, padding: '10px 8px', overflow: 'auto', overflowX: 'hidden' }}>
        {modulos.map((seccion, idx) => (
          <div key={idx} style={{ marginBottom: collapsed ? 6 : 12 }}>
            {seccion.seccion && !collapsed && (
              <div style={{
                fontSize: 9, fontWeight: 700, color: COLORS.slate400,
                letterSpacing: '0.12em', padding: '10px 12px 6px',
                textTransform: 'uppercase',
              }}>
                {seccion.seccion}
              </div>
            )}
            {seccion.seccion && collapsed && idx > 0 && (
              <div style={{ height: 1, background: COLORS.slate100, margin: '8px 12px' }}/>
            )}
            {seccion.items.map(item => {
              const active = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path))
              return (
                <NavLink
                  key={item.id}
                  to={item.path}
                  title={collapsed ? item.label : undefined}
                  style={{ textDecoration: 'none' }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: collapsed ? '10px' : '10px 12px',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    borderRadius: 10,
                    margin: '2px 4px',
                    background: active ? COLORS.navy : 'transparent',
                    color: active ? 'white' : COLORS.slate600,
                    fontSize: 13,
                    fontWeight: active ? 600 : 500,
                    transition: 'background 0.12s, color 0.12s',
                    cursor: 'pointer',
                    position: 'relative',
                  }}
                  onMouseEnter={e => { if (!active) { e.currentTarget.style.background = COLORS.slate50; e.currentTarget.style.color = COLORS.navy } }}
                  onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = COLORS.slate600 } }}
                  >
                    <span style={{ display: 'inline-flex', flexShrink: 0 }}>{item.icon}</span>
                    {!collapsed && (
                      <span style={{
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        flex: 1,
                      }}>
                        {item.label}
                      </span>
                    )}
                    {/* Badge notificaciones en Dashboard */}
                    {!collapsed && item.id === 'dashboard' && notifCount > 0 && (
                      <span style={{
                        background: COLORS.teal, color: 'white',
                        fontSize: 9, fontWeight: 700,
                        padding: '2px 6px', borderRadius: 10, minWidth: 16, textAlign: 'center',
                      }}>
                        {notifCount}
                      </span>
                    )}
                  </div>
                </NavLink>
              )
            })}
          </div>
        ))}
      </nav>

      {/* FOOTER — Usuario */}
      <div style={{
        padding: collapsed ? 10 : 14,
        borderTop: `1px solid ${COLORS.slate100}`,
        flexShrink: 0,
      }}>
        {collapsed ? (
          <button
            onClick={onLogout}
            title={`${usuario?.nombre || ''} — Cerrar sesión`}
            style={{
              width: '100%', padding: '10px 0',
              background: COLORS.slate50, border: 'none', borderRadius: 10,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: COLORS.slate600,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#FEF2F2'; e.currentTarget.style.color = '#DC2626' }}
            onMouseLeave={e => { e.currentTarget.style.background = COLORS.slate50; e.currentTarget.style.color = COLORS.slate600 }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        ) : (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: COLORS.navy, color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, flexShrink: 0,
              }}>
                {(usuario?.nombre || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 12, fontWeight: 600, color: COLORS.ink,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {usuario?.nombre || '—'}
                </div>
                <div style={{
                  fontSize: 10, color: COLORS.slate500,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {usuario?.rol || ''}
                </div>
              </div>
            </div>
            <button
              onClick={onLogout}
              style={{
                width: '100%', padding: '8px 12px',
                background: 'white', border: `1px solid ${COLORS.slate200}`,
                borderRadius: 8, fontSize: 11, fontWeight: 600,
                color: COLORS.slate600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#FEF2F2'; e.currentTarget.style.color = '#DC2626'; e.currentTarget.style.borderColor = '#FECACA' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.color = COLORS.slate600; e.currentTarget.style.borderColor = COLORS.slate200 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              Cerrar sesión
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}