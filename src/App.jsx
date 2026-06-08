import { useState, useEffect, useCallback } from 'react'
import { BrowserRouter, Routes, Route, useNavigate, Navigate, useLocation } from 'react-router-dom'
import { supabase } from './supabase'
import { COLORS, useIsMobile, hydratePrefsFromBD, setSyncPrefHandler, clearLocalPrefs, setTrackHandler, trackEvent } from './helpers'
import { puede } from './permisos'
import Turnstile, { TURNSTILE_ENABLED } from './Turnstile'  // v16.6.0: captcha login
import Sidebar from './Sidebar'
import Proyectos from './Proyectos'
import Cotizaciones from './Cotizaciones'
import Leads from './Leads'
import Cobranza from './Cobranza'
import Facturacion from './Facturacion'
import Compras from './Compras'
import Contratos from './Contratos'
import Cierre from './Cierre'
import MisActividades from './MisActividades'  // v16.9.4: drill-down de alertas Dashboard
import Auditoria from './Auditoria'  // v17.1.0: audit log para direccion/admin
import Postventa from './Postventa'
import Configuracion from './Configuracion'
import Dashboard from './Dashboard'
import CommandPalette from './CommandPalette'
import CentroAlertas from './CentroAlertas'  // v12.5.9c
import Plantas from './Plantas'  // v15.8.0
import { DialogHost } from './Dialogs'  // v17.4.0: toast + confirm propios (reemplazan alert/confirm nativos)

// ============================================================
// v12.5.9c: agregada ruta /alertas (Centro de Alertas)
// ============================================================
const RUTAS_POR_SECCION = {
  dashboard: '/',
  proyectos: '/proyectos',
  cotizaciones: '/cotizaciones',
  leads: '/leads',
  cobranza: '/cobranza',
  facturacion: '/facturacion',
  compras: '/compras',
  contratos: '/contratos',
  cierre: '/cierre',
  postventa: '/postventa',
  config: '/config',
  clientes: '/config',
  alertas: '/alertas',  // v12.5.9c
  plantas: '/plantas',  // v15.8.0
  actividades: '/actividades',  // v16.9.4
  auditoria: '/auditoria',  // v17.1.0
}

const inputStyle = {
  width:'100%', padding:'10px 12px',
  border:`1px solid ${COLORS.slate100}`, borderRadius:8,
  fontSize:13, outline:'none', fontFamily:'inherit', boxSizing:'border-box'
}

// ============================================================
// LOGIN + RECOVERY (v15.10: flujo "Olvidé contraseña")
// ============================================================
function Login({ onLogin }) {
  const [mode, setMode] = useState('login')   // 'login' | 'recover'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  // v16.6.0: Cloudflare Turnstile. Si VITE_TURNSTILE_SITE_KEY no está set,
  // TURNSTILE_ENABLED=false y captchaToken queda '' (signIn lo ignora).
  const [captchaToken, setCaptchaToken] = useState('')
  const handleCaptcha = useCallback((token) => setCaptchaToken(token || ''), [])
  const captchaListo = !TURNSTILE_ENABLED || !!captchaToken

  const login = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const emailLower = email.toLowerCase().trim()
    const authOptions = captchaToken ? { captchaToken } : undefined
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email: emailLower, password, options: authOptions })
    if (authError) {
      setError(authError.message)
      setCaptchaToken('')  // token de Turnstile es one-shot
      setLoading(false)
      return
    }
    const { data: usuario } = await supabase.from('usuarios').select('*').eq('email', emailLower).single()
    if (usuario) {
      if (!usuario.auth_id && data.user) {
        await supabase.from('usuarios').update({ auth_id: data.user.id }).eq('id', usuario.id)
      }
      onLogin(usuario)
    } else {
      setError('Usuario no encontrado en la base de datos')
    }
    setLoading(false)
  }

  const recover = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setInfo('')
    const emailLower = email.toLowerCase().trim()
    const resetOpts = {
      redirectTo: `${window.location.origin}/reset-password`,
      ...(captchaToken ? { captchaToken } : {}),
    }
    const { error: recError } = await supabase.auth.resetPasswordForEmail(emailLower, resetOpts)
    if (recError) {
      setError(recError.message)
      setCaptchaToken('')
    } else {
      setInfo('Si el email existe, recibirás un link de recuperación en los próximos minutos. Revisa también la carpeta de spam.')
    }
    setLoading(false)
  }

  const switchMode = (next) => {
    setMode(next)
    setError('')
    setInfo('')
    setPassword('')
    setCaptchaToken('')
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(135deg, #F8FAFC 0%, #E1F5EE 100%)', fontFamily:'var(--font-sans)' }}>
      <div style={{ background:'white', padding:'40px 44px', borderRadius:16, boxShadow:'0 20px 60px rgba(10,37,64,0.08)', width:400 }}>
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <img src="/logo-negro.png" alt="Row Energy" style={{ height:40, marginBottom:16 }} onError={(e)=>{e.target.style.display='none'}}/>
          <h1 style={{ fontSize:22, fontWeight:500, color:COLORS.navy, fontFamily:'var(--font-sans)', margin:0, letterSpacing:'-0.01em' }}>Row Energy OS</h1>
          <p style={{ fontSize:12, color:COLORS.slate500, marginTop:6 }}>{mode === 'recover' ? 'Recuperar contraseña' : 'Plataforma interna'}</p>
        </div>

        {mode === 'login' ? (
          <form onSubmit={login}>
            <div style={{ marginBottom:16 }}>
              <label style={{ fontSize:11, fontWeight:600, color:COLORS.slate500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:6 }}>Email</label>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required style={inputStyle} placeholder="tu@row.energy"/>
            </div>
            <div style={{ marginBottom:8 }}>
              <label style={{ fontSize:11, fontWeight:600, color:COLORS.slate500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:6 }}>Contraseña</label>
              <input type="password" value={password} onChange={e=>setPassword(e.target.value)} required style={inputStyle} placeholder="••••••••"/>
            </div>
            <div style={{ textAlign:'right', marginBottom:18 }}>
              <button type="button" onClick={() => switchMode('recover')} style={{ background:'none', border:'none', color:COLORS.teal, fontSize:11, cursor:'pointer', padding:0, fontFamily:'inherit', textDecoration:'underline' }}>
                ¿Olvidaste tu contraseña?
              </button>
            </div>
            {error && <div style={{ padding:10, background:'#FEF2F2', color:COLORS.red, borderRadius:8, fontSize:12, marginBottom:14 }}>{error}</div>}
            <Turnstile onVerify={handleCaptcha}/>
            <button type="submit" disabled={loading || !captchaListo} style={{ width:'100%', padding:'12px', background:COLORS.navy, color:'white', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:(loading || !captchaListo)?'not-allowed':'pointer', opacity:(loading || !captchaListo)?0.7:1 }}>
              {loading ? 'Entrando...' : (TURNSTILE_ENABLED && !captchaToken ? 'Completa la verificación' : 'Iniciar sesión')}
            </button>
          </form>
        ) : (
          <form onSubmit={recover}>
            <div style={{ marginBottom:16, fontSize:12, color:COLORS.slate500, lineHeight:1.5 }}>
              Ingresa tu email y te enviaremos un link para establecer una nueva contraseña.
            </div>
            <div style={{ marginBottom:18 }}>
              <label style={{ fontSize:11, fontWeight:600, color:COLORS.slate500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:6 }}>Email</label>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required style={inputStyle} placeholder="tu@row.energy" autoFocus/>
            </div>
            {error && <div style={{ padding:10, background:'#FEF2F2', color:COLORS.red, borderRadius:8, fontSize:12, marginBottom:14 }}>{error}</div>}
            {info && <div style={{ padding:10, background:'#F0FDF4', color:COLORS.teal, borderRadius:8, fontSize:12, marginBottom:14, border:`1px solid #86EFAC` }}>{info}</div>}
            <Turnstile onVerify={handleCaptcha}/>
            <button type="submit" disabled={loading || !captchaListo} style={{ width:'100%', padding:'12px', background:COLORS.navy, color:'white', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:(loading || !captchaListo)?'not-allowed':'pointer', opacity:(loading || !captchaListo)?0.7:1, marginBottom:10 }}>
              {loading ? 'Enviando...' : (TURNSTILE_ENABLED && !captchaToken ? 'Completa la verificación' : 'Enviar link de recuperación')}
            </button>
            <button type="button" onClick={() => switchMode('login')} style={{ width:'100%', padding:'10px', background:'transparent', color:COLORS.slate500, border:`1px solid ${COLORS.slate100}`, borderRadius:8, fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>
              ← Volver a iniciar sesión
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

// ============================================================
// RESET PASSWORD — pantalla destino del email de recuperación
// ============================================================
function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [validToken, setValidToken] = useState(false)
  const navigate = useNavigate()

  // Verificar que el link de recovery es válido
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        setValidToken(true)
      }
    })
    // También checar si ya hay sesión recovery activa al montar
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setValidToken(true)
    })
    return () => subscription?.unsubscribe()
  }, [])

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres'); return }
    if (password !== confirm) { setError('Las contraseñas no coinciden'); return }
    setLoading(true)
    const { error: upErr } = await supabase.auth.updateUser({ password })
    if (upErr) { setError(upErr.message); setLoading(false); return }
    // Cerrar todas las otras sesiones de este usuario (si las hubiera)
    try { await supabase.auth.signOut({ scope: 'others' }) } catch (_) {}
    setDone(true)
    setLoading(false)
    // Cerrar la sesión actual y redirigir al login después de 2s
    setTimeout(async () => {
      await supabase.auth.signOut()
      navigate('/', { replace: true })
    }, 2000)
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(135deg, #F8FAFC 0%, #E1F5EE 100%)', fontFamily:'var(--font-sans)' }}>
      <div style={{ background:'white', padding:'40px 44px', borderRadius:16, boxShadow:'0 20px 60px rgba(10,37,64,0.08)', width:400 }}>
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <img src="/logo-negro.png" alt="Row Energy" style={{ height:40, marginBottom:16 }} onError={(e)=>{e.target.style.display='none'}}/>
          <h1 style={{ fontSize:22, fontWeight:500, color:COLORS.navy, margin:0, letterSpacing:'-0.01em' }}>Nueva contraseña</h1>
          <p style={{ fontSize:12, color:COLORS.slate500, marginTop:6 }}>Establece una contraseña nueva para tu cuenta</p>
        </div>
        {done ? (
          <div style={{ padding:14, background:'#F0FDF4', color:COLORS.teal, borderRadius:8, fontSize:13, textAlign:'center', border:`1px solid #86EFAC` }}>
            ✅ Contraseña actualizada. Redirigiendo al login...
          </div>
        ) : !validToken ? (
          <div style={{ padding:14, background:'#FEF2F2', color:COLORS.red, borderRadius:8, fontSize:13, lineHeight:1.5 }}>
            Link inválido o expirado. Solicita un nuevo email de recuperación desde la pantalla de login.
            <button onClick={() => navigate('/', { replace: true })} style={{ marginTop:14, width:'100%', padding:10, background:COLORS.navy, color:'white', border:'none', borderRadius:8, fontSize:12, cursor:'pointer' }}>
              Ir al login
            </button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <div style={{ marginBottom:14 }}>
              <label style={{ fontSize:11, fontWeight:600, color:COLORS.slate500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:6 }}>Nueva contraseña</label>
              <input type="password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={8} style={inputStyle} placeholder="Mínimo 8 caracteres" autoFocus/>
            </div>
            <div style={{ marginBottom:18 }}>
              <label style={{ fontSize:11, fontWeight:600, color:COLORS.slate500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:6 }}>Confirmar</label>
              <input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} required style={inputStyle} placeholder="Repite la contraseña"/>
            </div>
            {error && <div style={{ padding:10, background:'#FEF2F2', color:COLORS.red, borderRadius:8, fontSize:12, marginBottom:14 }}>{error}</div>}
            <button type="submit" disabled={loading} style={{ width:'100%', padding:12, background:COLORS.navy, color:'white', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:loading?'wait':'pointer', opacity:loading?0.7:1 }}>
              {loading ? 'Guardando...' : 'Guardar nueva contraseña'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

function RutaProtegida({ usuario, modulo, children }) {
  if (!puede(usuario, modulo)) {
    return <Navigate to="/" replace/>
  }
  return children
}

function DashboardWrapper({ usuario }) {
  const navigate = useNavigate()
  const goTo = (seccion) => { if (RUTAS_POR_SECCION[seccion]) navigate(RUTAS_POR_SECCION[seccion]) }
  return <Dashboard usuario={usuario} onNavigate={goTo}/>
}

function CommandPaletteWrapper({ open, onClose }) {
  const navigate = useNavigate()
  const goTo = (seccion) => { if (RUTAS_POR_SECCION[seccion]) navigate(RUTAS_POR_SECCION[seccion]) }
  return <CommandPalette open={open} onClose={onClose} onNavigate={goTo}/>
}

function Layout({ usuario, onLogout, children }) {
  const [cmdOpen, setCmdOpen] = useState(false)
  const isMobile = useIsMobile()
  const navigate = useNavigate()
  const location = useLocation()

  const goTo = (seccion) => { if (RUTAS_POR_SECCION[seccion]) navigate(RUTAS_POR_SECCION[seccion]) }

  useEffect(() => {
    const handler = () => setCmdOpen(true)
    document.addEventListener('open-command-palette', handler)
    return () => document.removeEventListener('open-command-palette', handler)
  }, [])

  // v17.1.0: auto-track route changes para auditoría. Solo dispara cuando el
  // pathname cambia (no en cada query-param tweak para no inundar la tabla).
  useEffect(() => {
    const modulo = location.pathname.split('/')[1] || 'dashboard'
    trackEvent('view', { modulo, ruta: location.pathname + (location.search || '') })
  }, [location.pathname])

  return (
    <div style={{
      display:'flex',
      // v15.10.9: height fija + overflow hidden para que solo el main scrolee.
      // Antes era minHeight:100vh → al haber muchas filas, el body completo
      // scroleaba y el sidebar se iba con todo.
      height: isMobile ? 'auto' : '100vh',
      minHeight: isMobile ? '100vh' : '100vh',
      overflow: isMobile ? 'visible' : 'hidden',
      background: COLORS.bgKlar,
      flexDirection: isMobile ? 'column' : 'row',
    }}>
      <Sidebar usuario={usuario} onLogout={onLogout} onNavigate={goTo}/>
      <main style={{
        flex:1,
        minWidth:0,
        overflow:'auto',
        height: isMobile ? 'auto' : '100vh',
        padding: isMobile ? '72px 16px 78px' : '12px 12px 12px 0',
      }}>
        <div style={{
          background:'white',
          borderRadius: isMobile ? 0 : 16,
          boxShadow: isMobile ? 'none' : '0 1px 3px rgba(10, 37, 64, 0.04), 0 8px 24px rgba(10, 37, 64, 0.06)',
          padding: isMobile ? '20px 16px' : '24px 28px',
          minHeight: isMobile ? 'auto' : 'calc(100vh - 24px)',
        }}>
          {children}
        </div>
      </main>
      <CommandPaletteWrapper open={cmdOpen} onClose={() => setCmdOpen(false)}/>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Reset password debe ser accesible sin sesión válida (el link del email
            crea una sesión temporal de tipo recovery). */}
        <Route path="/reset-password" element={<ResetPassword/>}/>
        <Route path="*" element={<MainApp/>}/>
      </Routes>
      {/* v17.4.0: host global de toasts + confirmaciones propias (estilo Klar) */}
      <DialogHost/>
    </BrowserRouter>
  )
}

function MainApp() {
  const [usuario, setUsuario] = useState(null)
  const [loading, setLoading] = useState(true)
  // v17.0.0: hidratar prefs del usuario desde BD (cross-device persistence)
  const [prefsHydrated, setPrefsHydrated] = useState(false)

  useEffect(() => {
    let mounted = true

    const cargarUsuario = async (session) => {
      if (!session?.user) {
        if (mounted) { setUsuario(null); setLoading(false) }
        return
      }
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('email', session.user.email.toLowerCase())
        .single()

      if (error || !data) {
        console.warn('Usuario autenticado pero no encontrado en tabla usuarios. Cerrando sesión.')
        await supabase.auth.signOut()
        if (mounted) { setUsuario(null); setLoading(false) }
        return
      }

      if (mounted) { setUsuario(data); setLoading(false) }
    }

    supabase.auth.getSession().then(({ data: { session } }) => cargarUsuario(session))

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      cargarUsuario(session)
    })

    return () => {
      mounted = false
      subscription?.unsubscribe()
    }
  }, [])

  // v17.0.0: cuando cambia usuario, hidratar prefs desde BD y setup sync handler
  // v17.1.0: además setup trackHandler para auditoría (fire-and-forget insert a auditoria_eventos)
  useEffect(() => {
    if (!usuario?.id) { setPrefsHydrated(true); return }
    setPrefsHydrated(false)
    // Limpiar prefs locales del user anterior antes de hidratar
    clearLocalPrefs()
    hydratePrefsFromBD(supabase, usuario.id).finally(() => {
      // Configurar dual-write a BD para futuras llamadas a savePref
      setSyncPrefHandler((key, value) => {
        supabase.from('usuario_preferencias').upsert(
          { usuario_id: usuario.id, key, value, updated_at: new Date().toISOString() },
          { onConflict: 'usuario_id,key' }
        ).then(({ error }) => {
          if (error) console.warn('savePref sync to BD:', error.message)
        })
      })
      // v17.1.0: handler de auditoría
      setTrackHandler((payload) => {
        supabase.from('auditoria_eventos').insert({
          usuario_id: usuario.id,
          evento: payload.evento,
          modulo: payload.modulo || null,
          ruta: payload.ruta || null,
          entidad_tipo: payload.entidadTipo || null,
          entidad_id: payload.entidadId || null,
          metadata: payload.metadata || null,
          user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        }).then(({ error }) => {
          if (error) console.warn('trackEvent insert:', error.message)
        })
      })
      // Login event
      trackEvent('login', { modulo: 'auth' })
      setPrefsHydrated(true)
    })
    return () => { setSyncPrefHandler(null); setTrackHandler(null) }
  }, [usuario?.id])

  const handleLogout = async () => {
    trackEvent('logout', { modulo: 'auth' })  // v17.1.0: registrar antes de cerrar
    setSyncPrefHandler(null)  // no escribir más a BD
    setTrackHandler(null)
    clearLocalPrefs()
    await supabase.auth.signOut()
    setUsuario(null)
  }

  if (loading) return <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', color:COLORS.slate400, fontFamily:'var(--font-sans)' }}>Cargando...</div>
  if (!usuario) return <Login onLogin={setUsuario}/>
  if (!prefsHydrated) return <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', color:COLORS.slate400, fontFamily:'var(--font-sans)' }}>Cargando preferencias...</div>

  return (
    <Layout usuario={usuario} onLogout={handleLogout}>
      <Routes>
        <Route path="/" element={<DashboardWrapper usuario={usuario}/>}/>

        {/* v12.5.9c: Centro de Alertas — accesible para todos */}
        <Route path="/alertas" element={<CentroAlertas usuario={usuario}/>}/>

        {/* v16.9.4: Vista de actividades filtradas (drill-down desde Dashboard).
            v16.9.x: protegida bajo módulo 'actividades' (todos los roles operativos lo tienen). */}
        <Route path="/actividades" element={
          <RutaProtegida usuario={usuario} modulo="actividades">
            <MisActividades usuario={usuario}/>
          </RutaProtegida>
        }/>

        {/* v17.1.0: Auditoría — solo direccion/admin */}
        <Route path="/auditoria" element={
          <RutaProtegida usuario={usuario} modulo="auditoria">
            <Auditoria usuario={usuario}/>
          </RutaProtegida>
        }/>

          <Route path="/proyectos" element={
            <RutaProtegida usuario={usuario} modulo="proyectos">
              <Proyectos usuario={usuario}/>
            </RutaProtegida>
          }/>
          <Route path="/cotizaciones" element={
            <RutaProtegida usuario={usuario} modulo="cotizaciones">
              <Cotizaciones usuario={usuario}/>
            </RutaProtegida>
          }/>
          <Route path="/leads" element={
            <RutaProtegida usuario={usuario} modulo="leads">
              <Leads usuario={usuario}/>
            </RutaProtegida>
          }/>
          <Route path="/cobranza" element={
            <RutaProtegida usuario={usuario} modulo="cobranza">
              <Cobranza usuario={usuario}/>
            </RutaProtegida>
          }/>
          <Route path="/facturacion" element={
            <RutaProtegida usuario={usuario} modulo="facturacion">
              <Facturacion usuario={usuario}/>
            </RutaProtegida>
          }/>
          <Route path="/compras" element={
            <RutaProtegida usuario={usuario} modulo="compras">
              <Compras usuario={usuario}/>
            </RutaProtegida>
          }/>
          <Route path="/contratos" element={
            <RutaProtegida usuario={usuario} modulo="contratos">
              <Contratos usuario={usuario}/>
            </RutaProtegida>
          }/>
          <Route path="/cierre" element={
            <RutaProtegida usuario={usuario} modulo="cierre">
              <Cierre usuario={usuario}/>
            </RutaProtegida>
          }/>
          <Route path="/postventa" element={
            <RutaProtegida usuario={usuario} modulo="postventa">
              <Postventa usuario={usuario}/>
            </RutaProtegida>
          }/>
          <Route path="/plantas" element={
            <RutaProtegida usuario={usuario} modulo="plantas">
              <Plantas usuario={usuario}/>
            </RutaProtegida>
          }/>
        <Route path="/config" element={
          <RutaProtegida usuario={usuario} modulo="config">
            <Configuracion usuario={usuario}/>
          </RutaProtegida>
        }/>
      </Routes>
    </Layout>
  )
}