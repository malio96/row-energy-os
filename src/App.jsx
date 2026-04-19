import { useState } from 'react'
import { supabase } from './supabase'
import Proyectos from './Proyectos'

function Login({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError('Correo o contraseña incorrectos'); setLoading(false); return }
    onLogin(data.user)
    setLoading(false)
  }

  return (
    <div style={{ minHeight:'100vh', background:'#F8FAFC', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'system-ui,sans-serif' }}>
      <div style={{ background:'white', borderRadius:16, padding:48, width:400, boxShadow:'0 4px 24px rgba(0,0,0,0.08)', border:'1px solid #E2E8F0' }}>
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <img src="/logo-negro.png" alt="Row Energy" style={{ height:72, width:'auto', margin:'0 auto 16px', display:'block' }}/>
          <p style={{ color:'#64748B', fontSize:13, marginTop:0, letterSpacing:'0.05em' }}>SISTEMA OPERATIVO INTERNO</p>
        </div>
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom:16 }}>
            <label style={{ display:'block', fontSize:14, fontWeight:500, color:'#374151', marginBottom:6 }}>Correo electrónico</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="mmartinez@row.energy" required
              style={{ width:'100%', padding:'10px 14px', border:'1px solid #D1D5DB', borderRadius:8, fontSize:14, outline:'none', boxSizing:'border-box' }} />
          </div>
          <div style={{ marginBottom:24 }}>
            <label style={{ display:'block', fontSize:14, fontWeight:500, color:'#374151', marginBottom:6 }}>Contraseña</label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" required
              style={{ width:'100%', padding:'10px 14px', border:'1px solid #D1D5DB', borderRadius:8, fontSize:14, outline:'none', boxSizing:'border-box' }} />
          </div>
          {error && <div style={{ background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:8, padding:'10px 14px', color:'#DC2626', fontSize:14, marginBottom:16 }}>{error}</div>}
          <button type="submit" disabled={loading}
            style={{ width:'100%', padding:12, background:loading?'#94A3B8':'#1B3A6B', color:'white', border:'none', borderRadius:8, fontSize:15, fontWeight:600, cursor:loading?'not-allowed':'pointer' }}>
            {loading ? 'Entrando...' : 'Entrar al sistema'}
          </button>
        </form>
        <p style={{ textAlign:'center', color:'#94A3B8', fontSize:12, marginTop:24 }}>Row Energy © 2026 — Acceso restringido</p>
      </div>
    </div>
  )
}

function Dashboard({ user, onLogout }) {
  const [seccion, setSeccion] = useState('dashboard')

  const handleLogout = async () => {
    await supabase.auth.signOut()
    onLogout()
  }

  const navItems = [
    { key:'dashboard', icon:'📊', label:'Dashboard' },
    { key:'proyectos', icon:'📁', label:'Proyectos' },
    { key:'cotizaciones', icon:'💼', label:'Cotizaciones' },
    { key:'leads', icon:'👥', label:'Leads / CRM' },
    { key:'cobranza', icon:'💰', label:'Cobranza' },
    { key:'facturacion', icon:'🧾', label:'Facturación' },
    { key:'compras', icon:'🛒', label:'Compras' },
    { key:'financiero', icon:'📈', label:'Control Financiero' },
  ]

  return (
    <div style={{ minHeight:'100vh', background:'#F8FAFC', fontFamily:'system-ui,sans-serif' }}>
      {/* Sidebar */}
      <div style={{ position:'fixed', left:0, top:0, bottom:0, width:240, background:'#1B3A6B', display:'flex', flexDirection:'column' }}>
        <div style={{ padding:'20px 16px', borderBottom:'1px solid rgba(255,255,255,0.1)' }}>
          <img src="/logo-blanco.png" alt="Row Energy" style={{ height:36, width:'auto', display:'block' }}/>
        </div>

        <nav style={{ padding:'16px 12px', flex:1 }}>
          {navItems.map(item => (
            <div key={item.key} onClick={() => setSeccion(item.key)} style={{
              display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:8, marginBottom:4, cursor:'pointer',
              background: seccion===item.key ? 'rgba(255,255,255,0.15)' : 'transparent',
              color: seccion===item.key ? 'white' : 'rgba(255,255,255,0.65)',
              fontSize:14, fontWeight: seccion===item.key ? 600 : 400
            }}>
              <span style={{ fontSize:16 }}>{item.icon}</span>
              {item.label}
            </div>
          ))}
        </nav>

        <div style={{ padding:'16px 12px', borderBottom:'1px solid rgba(255,255,255,0.1)', marginBottom:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
            <div style={{ width:32, height:32, borderRadius:'50%', background:'#0F6E56', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:'white' }}>
              MM
            </div>
            <div>
              <div style={{ color:'white', fontSize:13, fontWeight:600 }}>Malio Martinez</div>
              <div style={{ color:'rgba(255,255,255,0.5)', fontSize:11 }}>Dirección General</div>
            </div>
          </div>
          <button onClick={handleLogout} style={{ width:'100%', padding:'8px', background:'rgba(255,255,255,0.1)', color:'rgba(255,255,255,0.7)', border:'none', borderRadius:8, fontSize:13, cursor:'pointer' }}>
            Cerrar sesión
          </button>
        </div>
      </div>

      {/* Contenido */}
      <div style={{ marginLeft:240, padding:32 }}>
        {seccion === 'dashboard' && (
          <div>
            <div style={{ marginBottom:32 }}>
              <h1 style={{ fontSize:24, fontWeight:700, color:'#1B3A6B', margin:0 }}>Dashboard</h1>
              <p style={{ color:'#64748B', fontSize:14, marginTop:4 }}>Bienvenido, Malio — {new Date().toLocaleDateString('es-MX', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}</p>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:32 }}>
              {[
                { label:'Proyectos activos', value:'4', color:'#1B3A6B' },
                { label:'Pendiente de cobrar', value:'$1,430,000', color:'#D97706' },
                { label:'Cotizaciones este mes', value:'7', color:'#0F6E56' },
                { label:'Proyectos retrasados', value:'1', color:'#DC2626' },
              ].map((k,i) => (
                <div key={i} style={{ background:'white', borderRadius:12, padding:20, border:'1px solid #E2E8F0' }}>
                  <div style={{ fontSize:12, fontWeight:500, color:'#64748B', marginBottom:8, textTransform:'uppercase', letterSpacing:'0.05em' }}>{k.label}</div>
                  <div style={{ fontSize:28, fontWeight:700, color:k.color }}>{k.value}</div>
                </div>
              ))}
            </div>
            <div style={{ background:'white', borderRadius:12, border:'1px solid #E2E8F0', padding:20 }}>
              <h2 style={{ fontSize:16, fontWeight:600, color:'#1B3A6B', margin:'0 0 16px' }}>Acceso rápido</h2>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
                {[
                  { label:'Ver proyectos', key:'proyectos', color:'#1B3A6B' },
                  { label:'Cotizaciones', key:'cotizaciones', color:'#0F6E56' },
                  { label:'Cobranza', key:'cobranza', color:'#D97706' },
                  { label:'Financiero', key:'financiero', color:'#DC2626' },
                ].map((b,i) => (
                  <button key={i} onClick={() => setSeccion(b.key)} style={{ padding:'12px', background:b.color+'11', color:b.color, border:`1px solid ${b.color}33`, borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer' }}>
                    {b.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {seccion === 'proyectos' && <Proyectos />}

        {!['dashboard','proyectos'].includes(seccion) && (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh', flexDirection:'column', gap:12 }}>
            <div style={{ fontSize:48 }}>🚧</div>
            <h2 style={{ color:'#1B3A6B', margin:0 }}>Módulo en construcción</h2>
            <p style={{ color:'#64748B' }}>Este módulo estará disponible pronto.</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function App() {
  const [user, setUser] = useState(null)
  return user
    ? <Dashboard user={user} onLogout={() => setUser(null)} />
    : <Login onLogin={setUser} />
}