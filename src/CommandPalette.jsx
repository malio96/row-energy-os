import { useState, useEffect, useRef, useMemo } from 'react'
import { getProyectos, getCotizaciones, getLeads, getClientes } from './supabase'
import { COLORS, Icon, fmtMoney, useKeyboard } from './helpers'

const SHORTCUTS = [
  { k:'Ir al Dashboard', nav:'dashboard', icon:'Eye' },
  { k:'Ir a Proyectos', nav:'proyectos', icon:'File' },
  { k:'Ir a Cotizaciones', nav:'cotizaciones', icon:'File' },
  { k:'Ir a Leads / CRM', nav:'leads', icon:'Users' },
  { k:'Ir a Cobranza', nav:'cobranza', icon:'Dollar' },
  { k:'Ir a Facturación', nav:'facturacion', icon:'File' },
  { k:'Ir a Compras', nav:'compras', icon:'Archive' },
  { k:'Ir a Contratos', nav:'contratos', icon:'File' },
  { k:'Ir a Cierre administrativo', nav:'cierre', icon:'Check' },
  { k:'Ir a Postventa', nav:'postventa', icon:'Message' },
]

export default function CommandPalette({ open, onClose, onNavigate }) {
  const [query, setQuery] = useState('')
  const [selIdx, setSelIdx] = useState(0)
  const [data, setData] = useState({ proyectos:[], cotizaciones:[], leads:[], clientes:[] })
  const inputRef = useRef(null)

  useEffect(() => {
    if (!open) return
    setQuery('')
    setSelIdx(0)
    setTimeout(() => inputRef.current?.focus(), 50)
    // Cargar datos
    Promise.all([getProyectos(), getCotizaciones(), getLeads(), getClientes()]).then(([p, c, l, cli]) => {
      setData({ proyectos:p, cotizaciones:c, leads:l, clientes:cli })
    })
  }, [open])

  const resultados = useMemo(() => {
    const q = query.trim().toLowerCase()
    const items = []

    // Atajos (siempre visibles)
    SHORTCUTS.forEach(s => {
      if (!q || s.k.toLowerCase().includes(q)) {
        items.push({ type:'atajo', label:s.k, sub:'Navegación', icon:s.icon, nav:s.nav })
      }
    })

    if (q) {
      data.proyectos.forEach(p => {
        if (p.nombre?.toLowerCase().includes(q) || p.codigo?.toLowerCase().includes(q) || p.cliente?.razon_social?.toLowerCase().includes(q)) {
          items.push({ type:'proyecto', label:p.nombre, sub:`${p.codigo} · ${p.cliente?.razon_social || '—'}`, icon:'File', nav:'proyectos', id:p.id })
        }
      })
      data.cotizaciones.forEach(c => {
        if (c.nombre_proyecto?.toLowerCase().includes(q) || c.codigo?.toLowerCase().includes(q) || c.cliente?.razon_social?.toLowerCase().includes(q)) {
          items.push({ type:'cotizacion', label:c.nombre_proyecto, sub:`${c.codigo} · ${c.estado} · ${fmtMoney(c.total, true)}`, icon:'File', nav:'cotizaciones', id:c.id })
        }
      })
      data.leads.forEach(l => {
        if (l.razon_social?.toLowerCase().includes(q) || l.codigo?.toLowerCase().includes(q) || l.contacto_nombre?.toLowerCase().includes(q)) {
          items.push({ type:'lead', label:l.razon_social, sub:`${l.codigo} · ${l.etapa} · ${fmtMoney(l.monto_estimado, true)}`, icon:'Users', nav:'leads', id:l.id })
        }
      })
      data.clientes.forEach(cli => {
        if (cli.razon_social?.toLowerCase().includes(q) || cli.codigo?.toLowerCase().includes(q)) {
          items.push({ type:'cliente', label:cli.razon_social, sub:`${cli.codigo} · Cliente`, icon:'Users', nav:'clientes' })
        }
      })
    }

    return items.slice(0, 15)
  }, [query, data])

  // Teclado global: Cmd+K para abrir
  useEffect(() => {
    const handle = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        document.dispatchEvent(new CustomEvent('open-command-palette'))
      }
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [])

  // Teclado dentro del palette: arriba/abajo/enter/escape
  useEffect(() => {
    if (!open) return
    const handle = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose() }
      else if (e.key === 'ArrowDown') { e.preventDefault(); setSelIdx(i => Math.min(i+1, resultados.length-1)) }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setSelIdx(i => Math.max(i-1, 0)) }
      else if (e.key === 'Enter') {
        e.preventDefault()
        const item = resultados[selIdx]
        if (item) { onNavigate(item.nav); onClose() }
      }
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [open, resultados, selIdx, onClose, onNavigate])

  if (!open) return null

  const grupos = {}
  resultados.forEach(r => { if (!grupos[r.type]) grupos[r.type] = []; grupos[r.type].push(r) })
  const tipoNombre = { atajo:'Navegación', proyecto:'Proyectos', cotizacion:'Cotizaciones', lead:'Leads', cliente:'Clientes' }

  let idxGlobal = -1

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(10,37,64,0.4)', zIndex:9998, backdropFilter:'blur(2px)' }}/>
      <div style={{ position:'fixed', top:'15%', left:'50%', transform:'translateX(-50%)', width:'min(600px, 92vw)', maxHeight:'70vh', background:'white', borderRadius:14, zIndex:9999, display:'flex', flexDirection:'column', boxShadow:'0 20px 80px rgba(10,37,64,0.3)', overflow:'hidden' }}>
        {/* Input */}
        <div style={{ display:'flex', alignItems:'center', padding:'14px 18px', borderBottom:`1px solid ${COLORS.slate100}`, gap:10 }}>
          <div style={{ color:COLORS.slate400 }}>{Icon('Search')}</div>
          <input ref={inputRef} value={query} onChange={e => { setQuery(e.target.value); setSelIdx(0) }} placeholder="Buscar proyectos, leads, cotizaciones, módulos..." style={{ flex:1, border:'none', outline:'none', fontSize:15, color:COLORS.ink, background:'transparent' }}/>
          <kbd style={{ fontSize:10, background:COLORS.slate50, color:COLORS.slate500, padding:'3px 6px', borderRadius:4, fontFamily:'var(--font-mono)' }}>ESC</kbd>
        </div>

        {/* Resultados */}
        <div style={{ overflow:'auto', padding:8 }}>
          {resultados.length === 0 && (
            <div style={{ padding:30, textAlign:'center', color:COLORS.slate400, fontSize:13 }}>Sin resultados para "{query}"</div>
          )}
          {Object.entries(grupos).map(([tipo, items]) => (
            <div key={tipo} style={{ marginBottom:8 }}>
              <div style={{ fontSize:10, fontWeight:600, color:COLORS.slate400, textTransform:'uppercase', letterSpacing:'0.08em', padding:'6px 10px' }}>{tipoNombre[tipo] || tipo}</div>
              {items.map(item => {
                idxGlobal++
                const isSel = idxGlobal === selIdx
                const currentIdx = idxGlobal
                return (
                  <div key={currentIdx} onClick={() => { onNavigate(item.nav); onClose() }} onMouseEnter={() => setSelIdx(currentIdx)}
                    style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:8, cursor:'pointer', background: isSel ? COLORS.slate50 : 'transparent' }}>
                    <div style={{ color: isSel ? COLORS.navy : COLORS.slate400 }}>{Icon(item.icon)}</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, color:COLORS.ink, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.label}</div>
                      <div style={{ fontSize:10, color:COLORS.slate500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.sub}</div>
                    </div>
                    {isSel && <kbd style={{ fontSize:10, background:'white', color:COLORS.slate500, padding:'3px 6px', borderRadius:4, fontFamily:'var(--font-mono)', border:`1px solid ${COLORS.slate200}` }}>↵</kbd>}
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding:'10px 16px', borderTop:`1px solid ${COLORS.slate100}`, background:COLORS.slate50, display:'flex', gap:14, fontSize:10, color:COLORS.slate500 }}>
          <span><kbd style={{ background:'white', padding:'2px 5px', borderRadius:3, border:`1px solid ${COLORS.slate200}`, fontFamily:'var(--font-mono)' }}>↑↓</kbd> Navegar</span>
          <span><kbd style={{ background:'white', padding:'2px 5px', borderRadius:3, border:`1px solid ${COLORS.slate200}`, fontFamily:'var(--font-mono)' }}>↵</kbd> Abrir</span>
          <span><kbd style={{ background:'white', padding:'2px 5px', borderRadius:3, border:`1px solid ${COLORS.slate200}`, fontFamily:'var(--font-mono)' }}>⌘K</kbd> Abrir búsqueda</span>
        </div>
      </div>
    </>
  )
}