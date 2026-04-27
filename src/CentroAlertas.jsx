import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getProyectos, getFacturas, getCuentasPorPagar, getLeads,
  getCotizaciones, getUsuarios, getAlertasConfig,
  calcularCargaPorColaborador,
} from './supabase'
import {
  generarAlertasDetalladas, agruparPorCategoria,
  colorAlerta, bgAlerta, labelSeveridad,
} from './alertas'
import { COLORS, useIsMobile } from './helpers'

// ============================================================
// CentroAlertas v12.5.9c
// Página /alertas: muestra todas las alertas detalladas del usuario,
// agrupadas por categoría. Click en cada item lleva al lugar específico.
//
// Permisos: el filtro es automático vía alertasConfig (que tiene defaults
// por rol). Cada usuario solo ve las categorías habilitadas para su rol.
// ============================================================
export default function CentroAlertas({ usuario }) {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState([])
  const [filtroSeveridad, setFiltroSeveridad] = useState('todas')

  useEffect(() => {
    if (!usuario?.id) return
    let cancelled = false

    const cargar = async () => {
      setLoading(true)
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
        console.warn('CentroAlertas: error cargando datos', err)
        if (!cancelled) setLoading(false)
      }
    }

    cargar()
    return () => { cancelled = true }
  }, [usuario?.id])

  // Filtrado por severidad
  const itemsFiltrados = useMemo(() => {
    if (filtroSeveridad === 'todas') return items
    return items.filter(i => i.severidad === filtroSeveridad)
  }, [items, filtroSeveridad])

  // Agrupar por categoría
  const grupos = useMemo(() => agruparPorCategoria(itemsFiltrados), [itemsFiltrados])

  // Conteos por severidad (para los chips)
  const conteos = useMemo(() => ({
    todas: items.length,
    critica: items.filter(i => i.severidad === 'critica').length,
    importante: items.filter(i => i.severidad === 'importante').length,
    info: items.filter(i => i.severidad === 'info').length,
  }), [items])

  const handleItemClick = (item) => {
    if (item.modulo_ruta) navigate(item.modulo_ruta)
  }

  return (
    <div style={{ fontFamily: 'var(--font-sans)' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{
          fontFamily: 'var(--font-sans)',
          fontSize: isMobile ? 24 : 30,
          color: COLORS.navy,
          fontWeight: 500,
          letterSpacing: '-0.02em',
          margin: 0,
        }}>
          Centro de Alertas
        </h1>
        <p style={{
          fontSize: 13,
          color: COLORS.slate500,
          marginTop: 4,
        }}>
          {loading
            ? 'Cargando alertas...'
            : items.length === 0
              ? 'Todo al día — no tienes alertas activas'
              : `${items.length} alerta${items.length !== 1 ? 's' : ''} ${items.length !== 1 ? 'activas' : 'activa'}`
          }
        </p>
      </div>

      {/* Chips de filtro por severidad */}
      {!loading && items.length > 0 && (
        <div style={{
          display: 'flex',
          gap: 8,
          marginBottom: 24,
          flexWrap: 'wrap',
        }}>
          <ChipFiltro
            label="Todas"
            count={conteos.todas}
            active={filtroSeveridad === 'todas'}
            onClick={() => setFiltroSeveridad('todas')}
            color={COLORS.navy}
          />
          {conteos.critica > 0 && (
            <ChipFiltro
              label="Críticas"
              count={conteos.critica}
              active={filtroSeveridad === 'critica'}
              onClick={() => setFiltroSeveridad('critica')}
              color={COLORS.red}
            />
          )}
          {conteos.importante > 0 && (
            <ChipFiltro
              label="Importantes"
              count={conteos.importante}
              active={filtroSeveridad === 'importante'}
              onClick={() => setFiltroSeveridad('importante')}
              color={COLORS.amber}
            />
          )}
          {conteos.info > 0 && (
            <ChipFiltro
              label="Info"
              count={conteos.info}
              active={filtroSeveridad === 'info'}
              onClick={() => setFiltroSeveridad('info')}
              color={COLORS.navy2 || COLORS.navy}
            />
          )}
        </div>
      )}

      {/* Estado vacío */}
      {loading && (
        <div style={{
          padding: 48,
          textAlign: 'center',
          color: COLORS.slate400,
          fontSize: 13,
        }}>
          Cargando alertas...
        </div>
      )}

      {!loading && items.length === 0 && (
        <div style={{
          padding: '64px 32px',
          textAlign: 'center',
          background: 'white',
          borderRadius: 16,
          border: `1px solid ${COLORS.slate100}`,
        }}>
          <div style={{
            width: 64, height: 64,
            margin: '0 auto 16px',
            borderRadius: '50%',
            background: '#E1F5EE',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: COLORS.teal,
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5"/>
            </svg>
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, color: COLORS.ink, marginBottom: 6 }}>
            Todo al día
          </div>
          <div style={{ fontSize: 13, color: COLORS.slate500 }}>
            No hay alertas activas en este momento
          </div>
        </div>
      )}

      {!loading && items.length > 0 && itemsFiltrados.length === 0 && (
        <div style={{
          padding: '32px',
          textAlign: 'center',
          background: 'white',
          borderRadius: 12,
          border: `1px solid ${COLORS.slate100}`,
          color: COLORS.slate500,
          fontSize: 13,
        }}>
          No hay alertas con este filtro
        </div>
      )}

      {/* Grupos de alertas */}
      {!loading && grupos.map(grupo => (
        <GrupoAlertas
          key={grupo.categoria}
          grupo={grupo}
          onItemClick={handleItemClick}
          isMobile={isMobile}
        />
      ))}
    </div>
  )
}

// ============================================================
// Chip de filtro
// ============================================================
function ChipFiltro({ label, count, active, onClick, color }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 14px',
        background: active ? color : 'white',
        color: active ? 'white' : COLORS.slate600,
        border: `1px solid ${active ? color : COLORS.slate200}`,
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 6,
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.borderColor = color }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.borderColor = COLORS.slate200 }}
    >
      {label}
      <span style={{
        background: active ? 'rgba(255,255,255,0.25)' : COLORS.slate100,
        color: active ? 'white' : COLORS.slate600,
        padding: '1px 8px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        fontFamily: 'var(--font-mono)',
      }}>
        {count}
      </span>
    </button>
  )
}

// ============================================================
// Grupo de alertas (categoría)
// ============================================================
function GrupoAlertas({ grupo, onItemClick, isMobile }) {
  const color = colorAlerta(grupo.severidad_mas_alta)

  return (
    <div style={{
      background: 'white',
      border: `1px solid ${COLORS.slate100}`,
      borderRadius: 12,
      marginBottom: 16,
      overflow: 'hidden',
    }}>
      {/* Header del grupo */}
      <div style={{
        padding: '14px 18px',
        borderBottom: `1px solid ${COLORS.slate100}`,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: COLORS.slate50,
      }}>
        <span style={{ fontSize: 18 }}>{grupo.icono}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.ink }}>
            {grupo.label}
          </div>
          {grupo.descripcion && (
            <div style={{ fontSize: 11, color: COLORS.slate500, marginTop: 2 }}>
              {grupo.descripcion}
            </div>
          )}
        </div>
        <div style={{
          background: color,
          color: 'white',
          padding: '3px 10px',
          borderRadius: 999,
          fontSize: 11,
          fontWeight: 700,
          fontFamily: 'var(--font-mono)',
        }}>
          {grupo.items.length}
        </div>
      </div>

      {/* Lista de items */}
      <div>
        {grupo.items.map((item, idx) => (
          <ItemAlerta
            key={item.id}
            item={item}
            onClick={() => onItemClick(item)}
            isLast={idx === grupo.items.length - 1}
            isMobile={isMobile}
          />
        ))}
      </div>
    </div>
  )
}

// ============================================================
// Item individual
// ============================================================
function ItemAlerta({ item, onClick, isLast, isMobile }) {
  const color = colorAlerta(item.severidad)
  const bg = bgAlerta(item.severidad)

  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: isMobile ? '12px 14px' : '14px 18px',
        background: 'white',
        border: 'none',
        borderBottom: isLast ? 'none' : `1px solid ${COLORS.slate100}`,
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background 0.12s',
        fontFamily: 'inherit',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = bg }}
      onMouseLeave={e => { e.currentTarget.style.background = 'white' }}
    >
      {/* Dot de severidad */}
      <div style={{
        width: 8, height: 8, minWidth: 8,
        borderRadius: '50%',
        background: color,
        marginTop: 7,
        flexShrink: 0,
      }}/>

      {/* Contenido */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13,
          fontWeight: 600,
          color: COLORS.ink,
          marginBottom: 3,
          lineHeight: 1.4,
        }}>
          {item.titulo}
        </div>
        <div style={{
          fontSize: 12,
          color: color,
          fontWeight: 500,
          marginBottom: 4,
        }}>
          {item.detalle}
        </div>
        {item.contexto && (
          <div style={{
            fontSize: 11,
            color: COLORS.slate500,
            lineHeight: 1.4,
          }}>
            {item.contexto}
          </div>
        )}
      </div>

      {/* Severidad badge + chevron */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexShrink: 0,
        marginTop: 2,
      }}>
        {!isMobile && (
          <span style={{
            fontSize: 9,
            fontWeight: 700,
            color: color,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}>
            {labelSeveridad(item.severidad)}
          </span>
        )}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={COLORS.slate400} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </div>
    </button>
  )
}