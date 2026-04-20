import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom'
import { supabase } from './supabase'
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

const COLORS = {
  navy:'#0A2540', navy2:'#1B3A6B', teal:'#0F6E56',
  slate50:'#F8FAFC', slate100:'#F1F5F9', slate400:'#94A3B8',
  slate500:'#64748B', ink:'#1C2128', red:'#DC2626'
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
  const [email, setEmail] = useState('mmartinez@row.energy')
  const [password, setPassword] = useState('RowEnergy2026!')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const login = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }
    const { data: usuario } = await supabase.from('usuarios').select('*').eq('email', email).single()
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
          <h1 style={{ fontSize:22, fontWeight:500, color:COLORS.navy, fontFamily:'var(--font-serif)', margin:0, letterSpacing:'-0.01em' }}>Row Energy OS</h1>
          <p style={{ fontSize:12, color:COLORS.slate500, marginTop:6 }}>Plataforma interna</p>
        </div>
        <form onSubmit={login}>
          <div style={{ marginBottom:16 }}>
            <label style={{ fontSize:11, fontWeight:600, color:COLORS.slate500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:6 }}>Email</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required style={inputStyle}/>
          </div>
          <div style={{ marginBottom:20 }}>
            <label style={{ fontSize:11, fontWeight:600, color:COLORS.slate500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:6 }}>Contraseña</label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} required style={inputStyle}/>
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

// ============================================================
// DASHBOARD WRAPPER — conecta onNavigate con react-router
// ============================================================
function DashboardWrapper({ usuario }) {
  const navigate = useNavigate()
  const goTo = (seccion) => {
    const rutas = {
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
    }
    if (rutas[seccion]) navigate(rutas[seccion])
  }
  return <Dashboard usuario={usuario} onNavigate={goTo}/>
}

// ============================================================
// COMMAND PALETTE WRAPPER — conecta onNavigate con react-router
// ============================================================
function CommandPaletteWrapper({ open, onClose }) {
  const navigate = useNavigate()
  const goTo = (seccion) => {
    const rutas = {
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
    }
    if (rutas[seccion]) navigate(rutas[seccion])
  }
  return <CommandPalette open={open} onClose={onClose} onNavigate={goTo}/>
}

// ============================================================
// LAYOUT (con listener Cmd+K)
// ============================================================
function Layout({ usuario, children }) {
  const [cmdOpen, setCmdOpen] = useState(false)

  useEffect(() => {
    const handler = () => setCmdOpen(true)
    document.addEventListener('open-command-palette', handler)
    return () => document.removeEventListener('open-command-palette', handler)
  }, [])

  return (
    <div style={{ display:'flex', height:'100vh', background:COLORS.slate50 }}>
      <Sidebar usuario={usuario}/>
      <main style={{ flex:1, overflow:'auto', padding:'28px 32px' }}>{children}</main>
      <CommandPaletteWrapper open={cmdOpen} onClose={() => setCmdOpen(false)}/>
    </div>
  )
}

// ============================================================
// APP
// ============================================================
export default function App() {
  const [usuario, setUsuario] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        const { data } = await supabase.from('usuarios').select('*').eq('email', session.user.email).single()
        if (data) setUsuario(data)
      }
      setLoading(false)
    }
    check()
  }, [])

  if (loading) return <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', color:COLORS.slate400, fontFamily:'var(--font-sans)' }}>Cargando...</div>
  if (!usuario) return <Login onLogin={setUsuario}/>

  return (
    <BrowserRouter>
      <Layout usuario={usuario}>
        <Routes>
          <Route path="/" element={<DashboardWrapper usuario={usuario}/>}/>
          <Route path="/proyectos" element={<Proyectos usuario={usuario}/>}/>
          <Route path="/cotizaciones" element={<Cotizaciones usuario={usuario}/>}/>
          <Route path="/leads" element={<Leads usuario={usuario}/>}/>
          <Route path="/cobranza" element={<Cobranza usuario={usuario}/>}/>
          <Route path="/facturacion" element={<Facturacion usuario={usuario}/>}/>
          <Route path="/compras" element={<Compras usuario={usuario}/>}/>
          <Route path="/contratos" element={<Contratos usuario={usuario}/>}/>
          <Route path="/cierre" element={<Cierre usuario={usuario}/>}/>
          <Route path="/postventa" element={<Postventa usuario={usuario}/>}/>
          <Route path="/config" element={<Configuracion usuario={usuario}/>}/>
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}