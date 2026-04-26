import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getLeads, crearLead, actualizarLead, eliminarLead, getUsuarios, getClientes } from './supabase'
import { COLORS, ETAPAS_LEAD, Badge, Avatar, fmtMoney, inputStyle, selectStyle, labelStyle, Icon } from './helpers'

export default function Leads({ usuario }) {
  const [searchParams, setSearchParams] = useSearchParams()
  // Deep-link desde Centro de Alertas: ?lead=X
  const deepLinkRef = useRef({ leadId: searchParams.get('lead'), aplicado: false })
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [dragLead, setDragLead] = useState(null)
  const [leadSel, setLeadSel] = useState(null)

  const cargar = async () => { setLoading(true); setLeads(await getLeads()); setLoading(false) }
  useEffect(() => { cargar() }, [])

  useEffect(() => {
    if (deepLinkRef.current.aplicado) return
    if (leads.length === 0) return
    const { leadId } = deepLinkRef.current
    const lead = leadId ? leads.find(l => l.id === leadId) : null
    if (lead) setLeadSel(lead)
    deepLinkRef.current.aplicado = true
    if (searchParams.get('lead')) setSearchParams({}, { replace: true })
  }, [leads, searchParams, setSearchParams])

  const cambiarEtapa = async (leadId, nuevaEtapa) => {
    await actualizarLead(leadId, { etapa: nuevaEtapa, ultima_actividad: new Date().toISOString() })
    cargar()
  }

  const totalPonderado = leads.filter(l => !['Ganado','Perdido'].includes(l.etapa)).reduce((s,l) => s + (Number(l.monto_estimado) * Number(l.probabilidad) / 100), 0)

  return (
    <div>
      {modal && <ModalNuevoLead usuario={usuario} onClose={() => setModal(false)} onCreado={() => { setModal(false); cargar() }}/>}
      {leadSel && <PanelLead lead={leadSel} onClose={() => setLeadSel(null)} onCambio={() => { cargar(); setLeadSel(null) }}/>}

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:32, fontWeight:400, color:COLORS.navy, margin:0, letterSpacing:'-0.02em', fontFamily:'var(--font-serif)' }}>Leads / CRM</h1>
          <p style={{ color:COLORS.slate500, fontSize:13, marginTop:6 }}>{leads.length} leads · Pipeline ponderado: <strong style={{ color:COLORS.navy }}>{fmtMoney(totalPonderado)}</strong></p>
        </div>
        <button onClick={() => setModal(true)} style={{ padding:'10px 20px', background:COLORS.navy, color:'white', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>{Icon('Plus')} Nuevo lead</button>
      </div>

      {loading && <div style={{ padding:40, textAlign:'center', color:COLORS.slate400 }}>Cargando...</div>}

      {!loading && (
        <div style={{ display:'grid', gridTemplateColumns:`repeat(${ETAPAS_LEAD.length}, minmax(220px, 1fr))`, gap:10, overflowX:'auto', paddingBottom:10 }}>
          {ETAPAS_LEAD.map(etapa => {
            const leadsEtapa = leads.filter(l => l.etapa === etapa.key)
            const total = leadsEtapa.reduce((s,l) => s + Number(l.monto_estimado || 0), 0)
            return (
              <div key={etapa.key} onDragOver={e => e.preventDefault()} onDrop={() => { if (dragLead) { cambiarEtapa(dragLead, etapa.key); setDragLead(null) } }} style={{ minWidth:220 }}>
                <div style={{ padding:'10px 14px', background:etapa.bg, borderRadius:10, marginBottom:8 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ fontSize:12, fontWeight:600, color:etapa.color }}>{etapa.key}</span>
                    <span style={{ fontSize:10, fontFamily:'var(--font-mono)', color:etapa.color, background:'white', borderRadius:10, padding:'2px 6px', fontWeight:600 }}>{leadsEtapa.length}</span>
                  </div>
                  <div style={{ fontSize:10, color:etapa.color, opacity:0.8, marginTop:2, fontFamily:'var(--font-mono)' }}>{fmtMoney(total)}</div>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  {leadsEtapa.map(l => (
                    <div key={l.id} draggable onDragStart={() => setDragLead(l.id)} onClick={() => setLeadSel(l)} style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderLeft:`3px solid ${etapa.color}`, borderRadius:8, padding:12, cursor:'pointer', transition:'box-shadow 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(10,37,64,0.08)'}
                      onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}>
                      <div style={{ fontSize:12, fontWeight:600, color:COLORS.ink, marginBottom:4 }}>{l.razon_social}</div>
                      {l.contacto_nombre && <div style={{ fontSize:11, color:COLORS.slate500, marginBottom:6 }}>{l.contacto_nombre}</div>}
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:8 }}>
                        <span style={{ fontSize:12, fontWeight:600, color:COLORS.navy, fontFamily:'var(--font-mono)' }}>{fmtMoney(l.monto_estimado)}</span>
                        <span style={{ fontSize:10, color:COLORS.slate400, fontFamily:'var(--font-mono)' }}>{l.probabilidad}%</span>
                      </div>
                      {l.owner?.nombre && <div style={{ marginTop:6, display:'flex', alignItems:'center', gap:6 }}><Avatar nombre={l.owner.nombre} size={18}/><span style={{ fontSize:10, color:COLORS.slate500 }}>{l.owner.nombre}</span></div>}
                    </div>
                  ))}
                  {leadsEtapa.length === 0 && <div style={{ padding:20, textAlign:'center', color:COLORS.slate400, fontSize:11, border:`1px dashed ${COLORS.slate200}`, borderRadius:8 }}>Arrastra aquí</div>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ModalNuevoLead({ usuario, onClose, onCreado }) {
  const [form, setForm] = useState({ razon_social:'', contacto_nombre:'', contacto_email:'', contacto_telefono:'', monto_estimado:'', probabilidad:25, etapa:'Nuevo', tipo_proyecto:'', capacidad_mw:'', fuente:'', notas:'' })
  const [usuarios, setUsuarios] = useState([])
  useEffect(() => { getUsuarios().then(setUsuarios) }, [])

  const crear = async () => {
    if (!form.razon_social) { alert('Completa razón social'); return }
    await crearLead({ ...form, monto_estimado: Number(form.monto_estimado) || 0, probabilidad: Number(form.probabilidad), capacidad_mw: form.capacidad_mw ? parseFloat(form.capacidad_mw) : null, owner_id: usuario.id })
    onCreado()
  }

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(10,37,64,0.35)', zIndex:999 }}/>
      <div style={{ position:'fixed', top:'5%', left:'50%', transform:'translateX(-50%)', width:560, maxHeight:'90vh', overflow:'auto', background:'white', borderRadius:16, zIndex:1000 }}>
        <div style={{ padding:'20px 28px', borderBottom:`1px solid ${COLORS.slate100}`, display:'flex', justifyContent:'space-between' }}>
          <h2 style={{ fontSize:20, fontWeight:500, margin:0, color:COLORS.navy, fontFamily:'var(--font-serif)' }}>Nuevo lead</h2>
          <button onClick={onClose} style={{ border:'none', background:'transparent', cursor:'pointer' }}>{Icon('X')}</button>
        </div>
        <div style={{ padding:24 }}>
          <div style={{ marginBottom:12 }}><label style={labelStyle}>Empresa / Razón social *</label><input value={form.razon_social} onChange={e=>setForm({...form, razon_social:e.target.value})} style={inputStyle}/></div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
            <div><label style={labelStyle}>Contacto</label><input value={form.contacto_nombre} onChange={e=>setForm({...form, contacto_nombre:e.target.value})} style={inputStyle}/></div>
            <div><label style={labelStyle}>Teléfono</label><input value={form.contacto_telefono} onChange={e=>setForm({...form, contacto_telefono:e.target.value})} style={inputStyle}/></div>
          </div>
          <div style={{ marginBottom:12 }}><label style={labelStyle}>Email</label><input type="email" value={form.contacto_email} onChange={e=>setForm({...form, contacto_email:e.target.value})} style={inputStyle}/></div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
            <div><label style={labelStyle}>Monto estimado (MXN)</label><input type="number" value={form.monto_estimado} onChange={e=>setForm({...form, monto_estimado:e.target.value})} style={inputStyle}/></div>
            <div><label style={labelStyle}>Probabilidad (%)</label><input type="number" min={0} max={100} value={form.probabilidad} onChange={e=>setForm({...form, probabilidad:e.target.value})} style={inputStyle}/></div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
            <div><label style={labelStyle}>Tipo de proyecto</label><input value={form.tipo_proyecto} onChange={e=>setForm({...form, tipo_proyecto:e.target.value})} placeholder="Autoconsumo, MEM..." style={inputStyle}/></div>
            <div><label style={labelStyle}>Capacidad (MW)</label><input type="number" step="0.1" value={form.capacidad_mw} onChange={e=>setForm({...form, capacidad_mw:e.target.value})} style={inputStyle}/></div>
          </div>
          <div style={{ marginBottom:12 }}><label style={labelStyle}>Fuente</label><input value={form.fuente} onChange={e=>setForm({...form, fuente:e.target.value})} placeholder="Referido, LinkedIn, Web..." style={inputStyle}/></div>
          <div style={{ marginBottom:12 }}><label style={labelStyle}>Notas</label><textarea value={form.notas} onChange={e=>setForm({...form, notas:e.target.value})} rows={3} style={{...inputStyle, resize:'vertical'}}/></div>
        </div>
        <div style={{ padding:'16px 28px', borderTop:`1px solid ${COLORS.slate100}`, display:'flex', justifyContent:'flex-end', gap:10 }}>
          <button onClick={onClose} style={{ padding:'10px 18px', background:'transparent', border:`1px solid ${COLORS.slate200}`, borderRadius:8, fontSize:13, cursor:'pointer' }}>Cancelar</button>
          <button onClick={crear} style={{ padding:'10px 22px', background:COLORS.navy, color:'white', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer' }}>Crear lead</button>
        </div>
      </div>
    </>
  )
}

function PanelLead({ lead, onClose, onCambio }) {
  const [etapa, setEtapa] = useState(lead.etapa)
  const [notas, setNotas] = useState(lead.notas || '')
  const [monto, setMonto] = useState(lead.monto_estimado || '')
  const [probabilidad, setProbabilidad] = useState(lead.probabilidad || 0)
  const [guardando, setGuardando] = useState(false)

  const guardar = async () => {
    setGuardando(true)
    try {
      await actualizarLead(lead.id, {
        etapa,
        notas,
        monto_estimado: Number(monto) || 0,
        probabilidad: Number(probabilidad),
        ultima_actividad: new Date().toISOString(),
      })
      onCambio()
    } catch (e) {
      alert('Error: ' + e.message)
      setGuardando(false)
    }
  }

  const eliminar = async () => {
    if (!confirm(`¿Eliminar lead "${lead.razon_social}"? Esta acción no se puede deshacer.`)) return
    setGuardando(true)
    try { await eliminarLead(lead.id); onCambio() }
    catch (e) { alert('Error: ' + e.message); setGuardando(false) }
  }

  const fmtFecha = (iso) => iso ? new Date(iso).toLocaleDateString('es-MX', { day:'2-digit', month:'short', year:'numeric' }) : '—'

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(10,37,64,0.35)', zIndex:999 }}/>
      <div style={{ position:'fixed', top:'5%', left:'50%', transform:'translateX(-50%)', width:560, maxHeight:'90vh', overflow:'auto', background:'white', borderRadius:16, zIndex:1000 }}>
        <div style={{ padding:'20px 28px', borderBottom:`1px solid ${COLORS.slate100}`, display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
          <div>
            <h2 style={{ fontSize:20, fontWeight:500, margin:0, color:COLORS.navy, fontFamily:'var(--font-serif)' }}>{lead.razon_social}</h2>
            {lead.contacto_nombre && <p style={{ fontSize:12, color:COLORS.slate500, margin:'4px 0 0' }}>{lead.contacto_nombre}</p>}
          </div>
          <button onClick={onClose} style={{ border:'none', background:'transparent', cursor:'pointer' }}>{Icon('X')}</button>
        </div>

        <div style={{ padding:24 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
            <div style={{ padding:12, background:COLORS.slate50, borderRadius:8 }}>
              <div style={{ fontSize:10, fontWeight:700, color:COLORS.slate500, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>Owner</div>
              <div style={{ fontSize:13, color:COLORS.ink, display:'flex', alignItems:'center', gap:6 }}>
                {lead.owner?.nombre ? <><Avatar nombre={lead.owner.nombre} size={18}/>{lead.owner.nombre}</> : '—'}
              </div>
            </div>
            <div style={{ padding:12, background:COLORS.slate50, borderRadius:8 }}>
              <div style={{ fontSize:10, fontWeight:700, color:COLORS.slate500, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>Última actividad</div>
              <div style={{ fontSize:13, color:COLORS.ink }}>{fmtFecha(lead.ultima_actividad || lead.updated_at || lead.created_at)}</div>
            </div>
          </div>

          {(lead.contacto_email || lead.contacto_telefono) && (
            <div style={{ marginBottom:16, fontSize:12, color:COLORS.slate600 }}>
              {lead.contacto_email && <div>📧 {lead.contacto_email}</div>}
              {lead.contacto_telefono && <div>📞 {lead.contacto_telefono}</div>}
            </div>
          )}

          {(lead.tipo_proyecto || lead.capacidad_mw || lead.fuente) && (
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:16 }}>
              {lead.tipo_proyecto && <span style={{ fontSize:11, padding:'4px 10px', background:COLORS.slate50, borderRadius:12, color:COLORS.slate600 }}>{lead.tipo_proyecto}</span>}
              {lead.capacidad_mw && <span style={{ fontSize:11, padding:'4px 10px', background:COLORS.slate50, borderRadius:12, color:COLORS.slate600 }}>{lead.capacidad_mw} MW</span>}
              {lead.fuente && <span style={{ fontSize:11, padding:'4px 10px', background:COLORS.slate50, borderRadius:12, color:COLORS.slate600 }}>Fuente: {lead.fuente}</span>}
            </div>
          )}

          <div style={{ marginBottom:12 }}>
            <label style={labelStyle}>Etapa</label>
            <select value={etapa} onChange={e=>setEtapa(e.target.value)} style={selectStyle}>
              {ETAPAS_LEAD.map(et => <option key={et.key} value={et.key}>{et.key}</option>)}
            </select>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
            <div><label style={labelStyle}>Monto estimado (MXN)</label><input type="number" value={monto} onChange={e=>setMonto(e.target.value)} style={inputStyle}/></div>
            <div><label style={labelStyle}>Probabilidad (%)</label><input type="number" min={0} max={100} value={probabilidad} onChange={e=>setProbabilidad(e.target.value)} style={inputStyle}/></div>
          </div>

          <div style={{ marginBottom:8 }}>
            <label style={labelStyle}>Notas</label>
            <textarea value={notas} onChange={e=>setNotas(e.target.value)} rows={4} style={{...inputStyle, resize:'vertical', fontFamily:'inherit'}}/>
          </div>
        </div>

        <div style={{ padding:'16px 28px', borderTop:`1px solid ${COLORS.slate100}`, display:'flex', justifyContent:'space-between', gap:10 }}>
          <button onClick={eliminar} disabled={guardando} style={{ padding:'10px 18px', background:'transparent', border:`1px solid ${COLORS.red}`, color:COLORS.red, borderRadius:8, fontSize:13, cursor:'pointer' }}>Eliminar</button>
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={onClose} disabled={guardando} style={{ padding:'10px 18px', background:'transparent', border:`1px solid ${COLORS.slate200}`, borderRadius:8, fontSize:13, cursor:'pointer' }}>Cancelar</button>
            <button onClick={guardar} disabled={guardando} style={{ padding:'10px 22px', background:COLORS.navy, color:'white', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor: guardando ? 'wait' : 'pointer' }}>{guardando ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </div>
      </div>
    </>
  )
}