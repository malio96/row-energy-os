import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getProyectos, getFacturas, getCuentasPorPagar, getLeads,
  getCotizaciones, getUsuarios, getAlertasConfig,
  calcularCargaPorColaborador,
} from './supabase'
import { generarAlertasDetalladas, colorAlerta, bgAlerta } from './alertas'
import { COLORS, useIsMobile } from './helpers'

// ============================================================
// CampanaAlertas v12.5.9c — Popover preview top 3 + botón "Ver todas"
//
// Click en campana → abre popover con las 3 alertas más críticas
// Click en alerta → navega al lugar específico + cierra popover
// Click en "Ver todas las alertas" → navega a /alertas
//
// Refresh automático cada 5 min
// ============================================================
const REFRESH_INTERVAL_MS = 5 * 60 * 1000
const PREVIEW_COUNT = 3

export default function CampanaAlertas({ usuario, onNavigate, collapsed = false }) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshTick, setRefreshTick] = useState(0)
  const containerRef = useRef(null)
  const navigate = useNavigate()
  const isMobile = useIsMobile()

  // Carga + refresh cada 5 min
  useEffect(() => {
    if (!usuario?.id) return
    let cancelled = false

    const cargar = async () => {
      try {
        const [proyectos, facturas, cxp, leads, cotizaciones, usuarios, config] = await Promise.all([
          getProyectos(),
          getFacturas(),
          getCuentasPorPagar(),
          getLeads(),
          getCotizaciones(),
          getUsuarios(),
          getAlertasConfig(usuario.id),
        ])
        if (cancelled) return

        const actividades = proyectos.flatMap(p =>
          (p.actividades || []).map(a => ({
            ...a,
            proyecto: { id: p.id, codigo: p.codigo, nombre: p.nombre },
          }))
        )
        const carga = calcularCargaPorColaborador(actividades, usuarios)

        const detalladas = generarAlertasDetalladas({
          usuario, config, usuarios,
          facturas, actividades, proyectos, cxp, leads, cotizaciones, carga,
        })
        if (!cancelled) {
          setItems(detalladas)
          setLoading(false)
        }
      } catch (err) {
        console.warn('CampanaAlertas: error cargando datos', err)
        if (!cancelled) setLoading(false)
      }
    }

    cargar()
    const interval = setInterval(() => setRefreshTick(t => t + 1), REFRESH_INTERVAL_MS)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [usuario?.id, refreshTick])

  // Cerrar al click fuera
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Cerrar con ESC
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  const { count, badgeColor, top3 } = useMemo(() => {
    const c = items.length
    if (c === 0) return { count: 0, badgeColor: null, top3: [] }
    const tieneCritica = items.some(a => a.severidad === 'critica')
    const tieneImportante = items.some(a => a.severidad === 'importante')
    return {
      count: c,
      badgeColor: tieneCritica ? COLORS.red : tieneImportante ? COLORS.amber : (COLORS.navy2 || COLORS.navy),
      top3: items.slice(0, PREVIEW_COUNT),
    }
  }, [items])

  const handleItemClick = (item) => {
    setOpen(false)
    // Usar navigate con la ruta completa para preservar URL params (drill-down)
    if (item.modulo_ruta) navigate(item.modulo_ruta)
  }

  const handleVerTodas = () => {
    setOpen(false)
    navigate('/alertas')
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-flex' }}>
      {/* Botón campana */}
      <button
        onClick={() => setOpen(o => !o)}
        title={count > 0 ? `${count} alerta${count !== 1 ? 's' : ''}` : 'Sin alertas'}
        style={{
          width: 28, height: 28, minWidth: 28,
          border: `1px solid ${COLORS.slate100}`,
          background: open ? COLORS.slate50 : 'white',
          borderRadius: 8,
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: count > 0 ? badgeColor : COLORS.slate500,
          position: 'relative',
          transition: 'all 0.15s',
        }}
        onMouseEnter={e => { if (!open) { e.currentTarget.style.background = COLORS.slate50 } }}
        onMouseLeave={e => { if (!open) { e.currentTarget.style.background = 'white' } }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
        </svg>
        {count > 0 && (
          <span style={{
            position: 'absolute',
            top: -4, right: -4,
            minWidth: 16, height: 16,
            background: badgeColor,
            color: 'white',
            borderRadius: 8,
            fontSize: 9,
            fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 4px',
            border: '2px solid white',
            fontFamily: 'var(--font-mono)',
          }}>
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {/* Popover */}
      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          // FIX v12.5.9c: abre hacia la derecha (left:0) para no salirse
          // del viewport cuando el sidebar está pegado al borde izquierdo
          left: isMobile ? '50%' : 0,
          right: 'auto',
          transform: isMobile ? 'translateX(-50%)' : 'none',
          width: isMobile ? 320 : 360,
          maxWidth: 'calc(100vw - 24px)',
          background: 'white',
          borderRadius: 12,
          boxShadow: '0 12px 40px rgba(10, 37, 64, 0.16), 0 2px 8px rgba(10, 37, 64, 0.08)',
          border: `1px solid ${COLORS.slate100}`,
          zIndex: 1000,
          overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          animation: 'campana-popover-in 0.15s ease',
        }}>
          {/* Header */}
          <div style={{
            padding: '14px 16px',
            borderBottom: `1px solid ${COLORS.slate100}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.ink, fontFamily: 'var(--font-serif)' }}>
                Alertas
              </div>
              <div style={{ fontSize: 10, color: COLORS.slate500, marginTop: 2 }}>
                {loading ? 'Cargando...' : count === 0 ? 'Todo al día' : `${count} alerta${count !== 1 ? 's' : ''} activa${count !== 1 ? 's' : ''}`}
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              style={{
                width: 24, height: 24,
                border: 'none', background: 'transparent',
                color: COLORS.slate400,
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: 6,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = COLORS.slate50; e.currentTarget.style.color = COLORS.slate600 }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = COLORS.slate400 }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>

          {/* Estado vacío */}
          {loading && (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: COLORS.slate400, fontSize: 12 }}>
              Cargando...
            </div>
          )}

          {!loading && count === 0 && (
            <div style={{ padding: '32px 16px', textAlign: 'center' }}>
              <div style={{
                width: 44, height: 44,
                margin: '0 auto 12px',
                borderRadius: '50%',
                background: '#E1F5EE',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: COLORS.teal,
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5"/>
                </svg>
              </div>
              <div style={{ fontSize: 13, fontWeight: 500, color: COLORS.ink, marginBottom: 4 }}>
                Todo al día
              </div>
              <div style={{ fontSize: 11, color: COLORS.slate500 }}>
                No hay alertas activas
              </div>
            </div>
          )}

          {/* Top 3 alertas */}
          {!loading && count > 0 && (
            <div style={{ padding: 6 }}>
              {top3.map(item => {
                const color = colorAlerta(item.severidad)
                const bg = bgAlerta(item.severidad)
                return (
                  <button
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    style={{
                      width: '100%',
                      display: 'flex', alignItems: 'flex-start', gap: 10,
                      padding: '10px 12px',
                      border: 'none',
                      background: 'transparent',
                      borderRadius: 8,
                      cursor: 'pointer',
                      textAlign: 'left',
                      margin: '2px 0',
                      transition: 'background 0.12s',
                      fontFamily: 'inherit',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = bg }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                  >
                    <div style={{
                      width: 8, height: 8, minWidth: 8,
                      borderRadius: '50%',
                      background: color,
                      marginTop: 5,
                      flexShrink: 0,
                    }}/>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 12, fontWeight: 600, color: COLORS.ink,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {item.titulo}
                      </div>
                      <div style={{ fontSize: 11, color: color, fontWeight: 500, marginTop: 2 }}>
                        {item.detalle}
                      </div>
                      {item.contexto && (
                        <div style={{
                          fontSize: 10, color: COLORS.slate500, marginTop: 2,
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>
                          {item.contexto}
                        </div>
                      )}
                    </div>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={COLORS.slate400} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 4 }}>
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </button>
                )
              })}
            </div>
          )}

          {/* Footer: botón Ver todas */}
          {!loading && count > 0 && (
            <div style={{
              borderTop: `1px solid ${COLORS.slate100}`,
              padding: 8,
              background: COLORS.slate50,
            }}>
              <button
                onClick={handleVerTodas}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: COLORS.navy,
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  fontFamily: 'inherit',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#0c2d4d' }}
                onMouseLeave={e => { e.currentTarget.style.background = COLORS.navy }}
              >
                Ver todas las alertas
                {count > PREVIEW_COUNT && (
                  <span style={{
                    background: 'rgba(255,255,255,0.25)',
                    padding: '1px 7px',
                    borderRadius: 999,
                    fontSize: 10,
                    fontWeight: 700,
                    fontFamily: 'var(--font-mono)',
                  }}>
                    +{count - PREVIEW_COUNT}
                  </span>
                )}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes campana-popover-in {
          from { opacity: 0; transform: translateY(-6px) ${isMobile ? 'translateX(-50%)' : ''}; }
          to { opacity: 1; transform: translateY(0) ${isMobile ? 'translateX(-50%)' : ''}; }
        }
      `}</style>
    </div>
  )
}