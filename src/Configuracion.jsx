import { useState, useEffect } from 'react'
import { getUsuarios, getClientes } from './supabase'
import { COLORS, Avatar, fmtMoney } from './helpers'

export default function Configuracion({ usuario }) {
  const [tab, setTab] = useState('usuarios')
  const [usuarios, setUsuarios] = useState([])
  const [clientes, setClientes] = useState([])

  useEffect(() => {
    if (tab === 'usuarios') getUsuarios().then(setUsuarios)
    else if (tab === 'clientes') getClientes().then(setClientes)
  }, [tab])

  return (
    <div>
      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontSize:32, fontWeight:400, color:COLORS.navy, margin:0, letterSpacing:'-0.02em', fontFamily:'var(--font-serif)' }}>Configuración</h1>
        <p style={{ color:COLORS.slate500, fontSize:13, marginTop:6 }}>Gestión de usuarios, clientes y parámetros del sistema</p>
      </div>

      <div style={{ display:'flex', borderBottom:`1px solid ${COLORS.slate200}`, marginBottom:24, gap:2 }}>
        {[{k:'usuarios',l:'Usuarios'},{k:'clientes',l:'Clientes'},{k:'sistema',l:'Sistema'}].map(t => (
          <button key={t.k} onClick={()=>setTab(t.k)} style={{ padding:'10px 18px', border:'none', background:'transparent', cursor:'pointer', fontSize:13, fontWeight: tab===t.k?600:500, color: tab===t.k?COLORS.navy:COLORS.slate500, borderBottom: tab===t.k?`2px solid ${COLORS.navy}`:'2px solid transparent', marginBottom:-1 }}>{t.l}</button>
        ))}
      </div>

      {tab === 'usuarios' && (
        <div style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, overflow:'hidden' }}>
          <div style={{ padding:'14px 20px', borderBottom:`1px solid ${COLORS.slate100}`, fontSize:13, fontWeight:600, color:COLORS.ink }}>Equipo ({usuarios.length})</div>
          {usuarios.map(u => (
            <div key={u.id} style={{ display:'grid', gridTemplateColumns:'40px 1fr 200px 160px 100px', padding:'12px 20px', borderBottom:`1px solid ${COLORS.slate100}`, alignItems:'center', fontSize:13 }}>
              <Avatar nombre={u.nombre} size={32}/>
              <div><div style={{ fontWeight:500, color:COLORS.ink }}>{u.nombre}</div><div style={{ fontSize:11, color:COLORS.slate500 }}>{u.email}</div></div>
              <div style={{ fontSize:12, color:COLORS.slate600, textTransform:'capitalize' }}>{u.rol?.replace('_',' ')}</div>
              <div style={{ fontSize:11, color:COLORS.slate500 }}>{u.telefono || '—'}</div>
              <div style={{ fontSize:11, color: u.activo ? COLORS.teal : COLORS.red, fontWeight:600 }}>{u.activo ? '✓ Activo' : '○ Inactivo'}</div>
            </div>
          ))}
        </div>
      )}

      {tab === 'clientes' && (
        <div style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, overflow:'hidden' }}>
          <div style={{ padding:'14px 20px', borderBottom:`1px solid ${COLORS.slate100}`, fontSize:13, fontWeight:600, color:COLORS.ink }}>Clientes ({clientes.length})</div>
          {clientes.map(c => (
            <div key={c.id} style={{ display:'grid', gridTemplateColumns:'80px 1fr 180px 160px 140px', padding:'12px 20px', borderBottom:`1px solid ${COLORS.slate100}`, alignItems:'center', fontSize:13 }}>
              <span style={{ fontSize:11, fontFamily:'var(--font-mono)', color:COLORS.slate500, fontWeight:600 }}>{c.codigo}</span>
              <div><div style={{ fontWeight:500, color:COLORS.ink }}>{c.razon_social}</div><div style={{ fontSize:11, color:COLORS.slate500 }}>{c.rfc || '—'}</div></div>
              <div style={{ fontSize:12, color:COLORS.slate600 }}>{c.contacto_nombre || '—'}</div>
              <div style={{ fontSize:11, color:COLORS.slate500 }}>{c.contacto_email || '—'}</div>
              <div style={{ fontSize:11, color:COLORS.slate500 }}>{c.industria || '—'}</div>
            </div>
          ))}
        </div>
      )}

      {tab === 'sistema' && (
        <div style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, padding:24 }}>
          <h3 style={{ fontSize:14, fontWeight:600, color:COLORS.ink, marginBottom:16 }}>Información del sistema</h3>
          <div style={{ display:'grid', gap:12, fontSize:13 }}>
            <div style={{ display:'flex', justifyContent:'space-between', padding:'10px 0', borderBottom:`1px solid ${COLORS.slate100}` }}><span style={{ color:COLORS.slate500 }}>Versión</span><span style={{ fontFamily:'var(--font-mono)' }}>Row Energy OS 1.0 (Semana 1)</span></div>
            <div style={{ display:'flex', justifyContent:'space-between', padding:'10px 0', borderBottom:`1px solid ${COLORS.slate100}` }}><span style={{ color:COLORS.slate500 }}>Base de datos</span><span style={{ fontFamily:'var(--font-mono)', color:COLORS.teal, fontWeight:600 }}>Supabase (conectada)</span></div>
            <div style={{ display:'flex', justifyContent:'space-between', padding:'10px 0', borderBottom:`1px solid ${COLORS.slate100}` }}><span style={{ color:COLORS.slate500 }}>Hosting</span><span style={{ fontFamily:'var(--font-mono)' }}>Vercel · app.row.energy</span></div>
            <div style={{ display:'flex', justifyContent:'space-between', padding:'10px 0', borderBottom:`1px solid ${COLORS.slate100}` }}><span style={{ color:COLORS.slate500 }}>Normativa base</span><span style={{ fontFamily:'var(--font-mono)' }}>LSE 2025 · Reglamento LSE</span></div>
            <div style={{ display:'flex', justifyContent:'space-between', padding:'10px 0' }}><span style={{ color:COLORS.slate500 }}>Tu rol</span><span style={{ fontFamily:'var(--font-mono)', textTransform:'capitalize' }}>{usuario.rol?.replace('_',' ')}</span></div>
          </div>
        </div>
      )}
    </div>
  )
}