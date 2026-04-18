import { useState } from 'react'
import { supabase } from './supabase'

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
          <div style={{ width:48, height:48, background:'#1B3A6B', borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
          </div>
          <h1 style={{ fontSize:24, fontWeight:700, color:'#1B3A6B', margin:0 }}>Row Energy</h1>
          <p style={{ color:'#64748B', fontSize:14, marginTop:4 }}>Sistema Operativo Interno</p>
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
  const handleLogout = async () => {
    await supabase.auth.signOut()
    onLogout()
  }

  return (
    <div style={{ minHeight:'100vh', background:'#F8FAFC', fontFamily:'system-ui,sans-serif' }}>
      {/* Sidebar */}
      <div style={{ position:'fixed', left:0, top:0, bottom:0, width:240, background:'#1B3A6B', display:'flex', flexDirection:'column' }}>
        <div style={{ padding:'24px 20px', borderBottom:'1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:32, height:32, background:'#0F6E56', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
            </div>
            <span style={{ color:'white', fontWeight:700, fontSize:15 }}>Row Energy</span>
          </div>
        </div>

        <nav style={{ padding:'16px 12px', flex:1 }}>
          {[
            { icon:'📊', label:'Dashboard', active:true },
            { icon:'📁', label:'Proyectos' },
            { icon:'💼', label:'Cotizaciones' },
            { icon:'👥', label:'Leads / CRM' },
            { icon:'💰', label:'Cobranza' },
            { icon:'🧾', label:'Facturación' },
            { icon:'🛒', label:'Compras' },
            { icon:'📈', label:'Control Financiero' },
          ].map((item, i) => (
            <div key={i} style={{
              display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:8, marginBottom:4, cursor:'pointer',
              background: item.active ? 'rgba(255,255,255,0.15)' : 'transparent',
              color: item.active ? 'white' : 'rgba(255,255,255,0.65)',
              fontSize:14, fontWeight: item.active ? 600 : 400
            }}>
              <span style={{ fontSize:16 }}>{item.icon}</span>
              {item.label}
            </div>
          ))}
        </nav>

        <div style={{ padding:'16px 12px', borderTop:'1px solid rgba(255,255,255,0.1)' }}>
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

      {/* Contenido principal */}
      <div style={{ marginLeft:240, padding:32 }}>
        <div style={{ marginBottom:32 }}>
          <h1 style={{ fontSize:24, fontWeight:700, color:'#1B3A6B', margin:0 }}>Dashboard</h1>
          <p style={{ color:'#64748B', fontSize:14, marginTop:4 }}>Bienvenido, Malio — {new Date().toLocaleDateString('es-MX', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}</p>
        </div>

        {/* KPI Cards */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:32 }}>
          {[
            { label:'Proyectos activos', value:'4', color:'#1B3A6B', bg:'#D6E4F7' },
            { label:'Pendiente de cobrar', value:'$1,430,000', color:'#D97706', bg:'#FEF3C7' },
            { label:'Cotizaciones este mes', value:'7', color:'#0F6E56', bg:'#E1F5EE' },
            { label:'Proyectos retrasados', value:'1', color:'#DC2626', bg:'#FEF2F2' },
          ].map((k,i) => (
            <div key={i} style={{ background:'white', borderRadius:12, padding:20, border:'1px solid #E2E8F0' }}>
              <div style={{ fontSize:12, fontWeight:500, color:'#64748B', marginBottom:8, textTransform:'uppercase', letterSpacing:'0.05em' }}>{k.label}</div>
              <div style={{ fontSize:28, fontWeight:700, color:k.color }}>{k.value}</div>
            </div>
          ))}
        </div>

        {/* Proyectos recientes */}
        <div style={{ background:'white', borderRadius:12, border:'1px solid #E2E8F0', overflow:'hidden' }}>
          <div style={{ padding:'16px 20px', borderBottom:'1px solid #E2E8F0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <h2 style={{ fontSize:16, fontWeight:600, color:'#1B3A6B', margin:0 }}>Proyectos en curso</h2>
            <button style={{ padding:'6px 14px', background:'#1B3A6B', color:'white', border:'none', borderRadius:8, fontSize:13, cursor:'pointer' }}>+ Nuevo proyecto</button>
          </div>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ background:'#F8FAFC' }}>
                {['Proyecto','Cliente','Responsable','Avance','Estado'].map(h => (
                  <th key={h} style={{ padding:'10px 16px', textAlign:'left', fontSize:11, fontWeight:600, color:'#64748B', textTransform:'uppercase', letterSpacing:'0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { nombre:'Instalación Solar — Planta Bajio', cliente:'Grupo Industrial del Bajio', resp:'Carlos Mendez', avance:45, estado:'En curso', color:'#0F6E56' },
                { nombre:'Auditoría Energética — Bodega Norte', cliente:'Vitro Glass', resp:'Sofia Ruiz', avance:100, estado:'Terminado', color:'#1B3A6B' },
                { nombre:'Sistema Fotovoltaico — CEMEX', cliente:'CEMEX Jalisco', resp:'Carlos Mendez', avance:20, estado:'Por iniciar', color:'#D97706' },
              ].map((p,i) => (
                <tr key={i} style={{ borderBottom:'1px solid #F1F5F9' }}>
                  <td style={{ padding:'12px 16px', fontSize:14, fontWeight:500, color:'#1C2128' }}>{p.nombre}</td>
                  <td style={{ padding:'12px 16px', fontSize:13, color:'#64748B' }}>{p.cliente}</td>
                  <td style={{ padding:'12px 16px', fontSize:13, color:'#64748B' }}>{p.resp}</td>
                  <td style={{ padding:'12px 16px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <div style={{ flex:1, height:6, background:'#E2E8F0', borderRadius:3 }}>
                        <div style={{ width:`${p.avance}%`, height:'100%', background:p.color, borderRadius:3 }}/>
                      </div>
                      <span style={{ fontSize:12, fontWeight:600, color:p.color, minWidth:32 }}>{p.avance}%</span>
                    </div>
                  </td>
                  <td style={{ padding:'12px 16px' }}>
                    <span style={{ fontSize:12, fontWeight:600, padding:'3px 10px', borderRadius:20, background:p.color+'22', color:p.color }}>{p.estado}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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