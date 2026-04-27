import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, useNavigate, Navigate } from 'react-router-dom'
import { supabase } from './supabase'
import { COLORS, useIsMobile } from './helpers'
import { puede } from './permisos'
import Sidebar from './Sidebar'
import Proyectos from './Proyectos'
import Cotizaciones from './Cotizaciones'
import Leads from './Leads'
import Cobranza from './Cobranza'
import Facturacion from './Facturacion'
import Compras from './Compras'
import Contratos from './Contratos'
import Cierre from './Cierre'
import Postventa from './Postventa'
import Configuracion from './Configuracion'
import Dashboard from './Dashboard'
import CommandPalette from './CommandPalette'
import CentroAlertas from './CentroAlertas'  // v12.5.9c

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
}

const inputStyle = {
  width:'100%', padding:'10px 12px',
  border:`1px solid ${COLORS.slate100}`, borderRadius:8,
  fontSize:13, outline:'none', fontFamily:'inherit', boxSizing:'border-box'
}

// ============================================================
// LOGIN
// ============================================================
function Login({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const login = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const emailLower = email.toLowerCase().trim()
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email: emailLower, password })
    if (authError) {
      setError(authError.message)
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

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(135deg, #F8FAFC 0%, #E1F5EE 100%)', fontFamily:'var(--font-sans)' }}>
      <div style={{ background:'white', padding:'40px 44px', borderRadius:16, boxShadow:'0 20px 60px rgba(10,37,64,0.08)', width:400 }}>
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <img src="/logo-negro.png" alt="Row Energy" style={{ height:40, marginBottom:16 }} onError={(e)=>{e.target.style.display='none'}}/>
          <h1 style={{ fontSize:22, fontWeight:500, color:COLORS.navy, fontFamily:'var(--font-sans)', margin:0, letterSpacing:'-0.01em' }}>Row Energy OS</h1>
          <p style={{ fontSize:12, color:COLORS.slate500, marginTop:6 }}>Plataforma interna</p>
        </div>
        <form onSubmit={login}>
          <div style={{ marginBottom:16 }}>
            <label style={{ fontSize:11, fontWeight:600, color:COLORS.slate500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:6 }}>Email</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required style={inputStyle} placeholder="tu@row.energy"/>
          </div>
          <div style={{ marginBottom:20 }}>
            <label style={{ fontSize:11, fontWeight:600, color:COLORS.slate500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:6 }}>Contraseña</label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} required style={inputStyle} placeholder="••••••••"/>
          </div>
          {error && <div style={{ padding:10, background:'#FEF2F2', color:COLORS.red, borderRadius:8, fontSize:12, marginBottom:14 }}>{error}</div>}
          <button type="submit" disabled={loading} style={{ width:'100%', padding:'12px', background:COLORS.navy, color:'white', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:loading?'wait':'pointer', opacity:loading?0.7:1 }}>
            {loading ? 'Entrando...' : 'Iniciar sesión'}
          </button>
        </form>
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

  const goTo = (seccion) => { if (RUTAS_POR_SECCION[seccion]) navigate(RUTAS_POR_SECCION[seccion]) }

  useEffect(() => {
    const handler = () => setCmdOpen(true)
    document.addEventListener('open-command-palette', handler)
    return () => document.removeEventListener('open-command-palette', handler)
  }, [])

  return (
    <div style={{
      display:'flex',
      minHeight:'100vh',
      background: COLORS.bgKlar,
      flexDirection: isMobile ? 'column' : 'row',
    }}>
      <Sidebar usuario={usuario} onLogout={onLogout} onNavigate={goTo}/>
      <main style={{
        flex:1,
        minWidth:0,
        overflow:'auto',
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
  const [usuario, setUsuario] = useState(null)
  const [loading, setLoading] = useState(true)

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

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUsuario(null)
  }

  if (loading) return <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', color:COLORS.slate400, fontFamily:'var(--font-sans)' }}>Cargando...</div>
  if (!usuario) return <Login onLogin={setUsuario}/>

  return (
    <BrowserRouter>
      <Layout usuario={usuario} onLogout={handleLogout}>
        <Routes>
          <Route path="/" element={<DashboardWrapper usuario={usuario}/>}/>

          {/* v12.5.9c: Centro de Alertas — accesible para todos */}
          <Route path="/alertas" element={<CentroAlertas usuario={usuario}/>}/>

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
          <Route path="/config" element={
            <RutaProtegida usuario={usuario} modulo="config">
              <Configuracion usuario={usuario}/>
            </RutaProtegida>
          }/>
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}