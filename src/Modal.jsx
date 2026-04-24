// ============================================================
// Modal.jsx — v12.5.6
// Modal estilo Row Energy (réplica del diseño del Gantt)
// Reemplaza prompt() / confirm() / alert() nativos del navegador
//
// v12.5.6: agregado soporte para tipo 'select' en editor (dropdowns)
// ============================================================
import { useState, useEffect, useRef } from 'react'
import { COLORS } from './helpers'

// ============================================================
// Hook: useModal()
// Uso:
//   const modal = useModal()
//   <modal.Render/>  // pones esto una vez en el componente
//   const valor = await modal.prompt({ titulo, mensaje, defaultValue, tipo })
//   const ok = await modal.confirm({ titulo, mensaje, destructivo })
//   await modal.alert({ titulo, mensaje })
//   const cambios = await modal.editor({ titulo, campos })
//
// Ejemplo de campos para editor:
//   [
//     { key: 'nombre', label: 'Nombre', tipo: 'text', required: true, defaultValue: '...' },
//     { key: 'monto', label: 'Monto', tipo: 'number', required: true },
//     { key: 'fecha', label: 'Fecha', tipo: 'date' },
//     { key: 'rol', label: 'Rol', tipo: 'select', required: true, defaultValue: 'ventas',
//       opciones: [
//         { value: 'direccion', label: 'Dirección' },
//         { value: 'ventas', label: 'Ventas' },
//       ] },
//   ]
// ============================================================
export function useModal() {
  const [estado, setEstado] = useState({ abierto: false })
  const resolverRef = useRef(null)

  const cerrar = (valor) => {
    if (resolverRef.current) {
      resolverRef.current(valor)
      resolverRef.current = null
    }
    setEstado({ abierto: false })
  }

  const prompt = (opts) => new Promise(resolve => {
    resolverRef.current = resolve
    setEstado({
      abierto: true,
      tipo: 'prompt',
      titulo: opts.titulo || 'Ingresar valor',
      mensaje: opts.mensaje || '',
      defaultValue: opts.defaultValue ?? '',
      inputTipo: opts.tipo || 'text',
      placeholder: opts.placeholder || '',
      icono: opts.icono || 'Edit',
    })
  })

  const confirm = (opts) => new Promise(resolve => {
    resolverRef.current = resolve
    setEstado({
      abierto: true,
      tipo: 'confirm',
      titulo: opts.titulo || '¿Confirmar?',
      mensaje: opts.mensaje || '',
      destructivo: !!opts.destructivo,
      textoBoton: opts.textoBoton || (opts.destructivo ? 'Eliminar' : 'Confirmar'),
      icono: opts.icono || (opts.destructivo ? 'Trash' : 'Check'),
    })
  })

  const alert = (opts) => new Promise(resolve => {
    resolverRef.current = resolve
    setEstado({
      abierto: true,
      tipo: 'alert',
      titulo: opts.titulo || 'Aviso',
      mensaje: opts.mensaje || '',
      icono: opts.icono || 'Alert',
      color: opts.color || COLORS.amber,
    })
  })

  const editor = (opts) => new Promise(resolve => {
    resolverRef.current = resolve
    setEstado({
      abierto: true,
      tipo: 'editor',
      titulo: opts.titulo || 'Editar',
      mensaje: opts.mensaje || '',
      campos: opts.campos || [],
      textoBoton: opts.textoBoton || 'Guardar',
      icono: opts.icono || 'Edit',
    })
  })

  const Render = () => {
    if (!estado.abierto) return null
    return <ModalUI estado={estado} onCerrar={cerrar}/>
  }

  return { prompt, confirm, alert, editor, Render }
}


// ============================================================
// ModalUI
// ============================================================
function ModalUI({ estado, onCerrar }) {
  const [valor, setValor] = useState(estado.tipo === 'prompt' ? estado.defaultValue : '')
  const [valoresEditor, setValoresEditor] = useState(() => {
    if (estado.tipo !== 'editor') return {}
    const v = {}
    estado.campos.forEach(c => { v[c.key] = c.defaultValue ?? '' })
    return v
  })
  const inputRef = useRef(null)

  useEffect(() => {
    if (inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [])

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        if (estado.tipo === 'prompt' || estado.tipo === 'confirm' || estado.tipo === 'editor') onCerrar(null)
        else onCerrar(true)
      }
      if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'SELECT') {
        if (estado.tipo === 'prompt') onCerrar(valor)
        if (estado.tipo === 'alert') onCerrar(true)
        if (estado.tipo === 'confirm') onCerrar(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [estado.tipo, valor, onCerrar])

  const confirmarPrompt = () => {
    if (!valor && valor !== 0 && valor !== '0') return onCerrar(null)
    onCerrar(estado.inputTipo === 'number' ? Number(valor) : valor)
  }

  const confirmarEditor = () => {
    for (const c of estado.campos) {
      if (c.required && !valoresEditor[c.key]) {
        return
      }
    }
    const resultado = {}
    estado.campos.forEach(c => {
      const v = valoresEditor[c.key]
      resultado[c.key] = c.tipo === 'number' ? Number(v || 0) : v
    })
    onCerrar(resultado)
  }

  const colorAccion = estado.destructivo ? COLORS.red : COLORS.navy

  return (
    <>
      <div
        onClick={() => onCerrar(estado.tipo === 'alert' ? true : null)}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(10, 37, 64, 0.35)',
          backdropFilter: 'blur(2px)',
          zIndex: 10000,
          animation: 'fadeIn 0.15s ease',
        }}
      />

      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: 'fixed', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'white',
          borderRadius: 16,
          padding: '28px 32px',
          minWidth: 380,
          maxWidth: 480,
          width: '90vw',
          boxShadow: '0 20px 60px rgba(10, 37, 64, 0.18)',
          zIndex: 10001,
          animation: 'popIn 0.15s ease',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 10 }}>
          <div style={{
            width: 38, height: 38, minWidth: 38,
            background: estado.destructivo ? '#FEF2F2' : estado.tipo === 'alert' ? '#FEF3C7' : '#E1F5EE',
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: estado.destructivo ? COLORS.red : estado.tipo === 'alert' ? COLORS.amber : COLORS.teal,
          }}>
            <IconoModal tipo={estado.icono}/>
          </div>
          <div style={{ flex: 1, paddingTop: 2 }}>
            <h3 style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 20, fontWeight: 500,
              color: COLORS.ink,
              margin: 0, lineHeight: 1.3,
              letterSpacing: '-0.01em',
            }}>{estado.titulo}</h3>
          </div>
        </div>

        {estado.mensaje && (
          <div style={{
            fontSize: 14,
            color: COLORS.slate600,
            lineHeight: 1.5,
            marginBottom: 18,
            marginLeft: 52,
          }}>
            {estado.mensaje}
          </div>
        )}

        {/* Input prompt */}
        {estado.tipo === 'prompt' && (
          <div style={{ marginBottom: 18, marginLeft: 52 }}>
            <input
              ref={inputRef}
              type={estado.inputTipo}
              value={valor}
              onChange={e => setValor(e.target.value)}
              placeholder={estado.placeholder}
              style={inputStyle()}
              onFocus={e => e.currentTarget.style.borderColor = COLORS.navy}
              onBlur={e => e.currentTarget.style.borderColor = COLORS.slate200}
            />
          </div>
        )}

        {/* Campos editor */}
        {estado.tipo === 'editor' && (
          <div style={{ marginBottom: 18, marginLeft: 52, display: 'grid', gap: 12 }}>
            {estado.campos.map((campo, idx) => (
              <div key={campo.key}>
                <label style={labelStyle()}>
                  {campo.label} {campo.required && <span style={{ color: COLORS.red }}>*</span>}
                </label>
                {campo.tipo === 'select' ? (
                  <select
                    ref={idx === 0 ? inputRef : null}
                    value={valoresEditor[campo.key] ?? ''}
                    onChange={e => setValoresEditor({ ...valoresEditor, [campo.key]: e.target.value })}
                    style={{ ...inputStyle(), cursor: 'pointer', appearance: 'menulist' }}
                    onFocus={e => e.currentTarget.style.borderColor = COLORS.navy}
                    onBlur={e => e.currentTarget.style.borderColor = COLORS.slate200}
                  >
                    {!campo.required && <option value="">— Sin selección —</option>}
                    {(campo.opciones || []).map(op => (
                      <option key={op.value} value={op.value}>{op.label}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    ref={idx === 0 ? inputRef : null}
                    type={campo.tipo || 'text'}
                    value={valoresEditor[campo.key] ?? ''}
                    onChange={e => setValoresEditor({ ...valoresEditor, [campo.key]: e.target.value })}
                    placeholder={campo.placeholder || ''}
                    style={inputStyle()}
                    onFocus={e => e.currentTarget.style.borderColor = COLORS.navy}
                    onBlur={e => e.currentTarget.style.borderColor = COLORS.slate200}
                  />
                )}
                {campo.ayuda && (
                  <div style={{ fontSize: 10, color: COLORS.slate500, marginTop: 4 }}>
                    {campo.ayuda}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Botones */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 10,
          marginTop: estado.tipo === 'alert' ? 6 : 0,
        }}>
          {(estado.tipo === 'prompt' || estado.tipo === 'confirm' || estado.tipo === 'editor') && (
            <button
              onClick={() => onCerrar(null)}
              style={{
                padding: '10px 22px',
                background: 'white',
                border: `1px solid ${COLORS.slate200}`,
                borderRadius: 8,
                fontSize: 13, fontWeight: 600,
                color: COLORS.slate600,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = COLORS.slate50}
              onMouseLeave={e => e.currentTarget.style.background = 'white'}
            >
              Cancelar
            </button>
          )}
          <button
            onClick={() => {
              if (estado.tipo === 'prompt') confirmarPrompt()
              else if (estado.tipo === 'editor') confirmarEditor()
              else onCerrar(true)
            }}
            style={{
              padding: '10px 22px',
              background: colorAccion,
              color: 'white',
              border: 'none',
              borderRadius: 8,
              fontSize: 13, fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s',
              boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.92'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            {estado.tipo === 'alert' ? 'Entendido' :
             estado.tipo === 'prompt' ? 'Aceptar' :
             estado.tipo === 'editor' ? (estado.textoBoton || 'Guardar') :
             estado.textoBoton || 'Confirmar'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes popIn {
          from { opacity: 0; transform: translate(-50%, -48%) scale(0.96); }
          to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
      `}</style>
    </>
  )
}

function inputStyle() {
  return {
    width: '100%',
    padding: '10px 14px',
    border: `1px solid ${COLORS.slate200}`,
    borderRadius: 8,
    fontSize: 14,
    outline: 'none',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
    background: 'white',
  }
}

function labelStyle() {
  return {
    display: 'block',
    fontSize: 11, fontWeight: 600,
    color: COLORS.slate500,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    marginBottom: 5,
  }
}

function IconoModal({ tipo }) {
  const iconos = {
    Edit: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>,
    Plus: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>,
    Trash: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>,
    Check: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>,
    Alert: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4M12 17h.01"/></svg>,
    Dollar: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
    Unlink: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18.84 12.25l1.72-1.71h-.02a5.004 5.004 0 0 0-.12-7.07 5.006 5.006 0 0 0-6.95 0l-1.72 1.71"/><path d="M5.17 11.75l-1.71 1.71a5.004 5.004 0 0 0 .12 7.07 5.006 5.006 0 0 0 6.95 0l1.71-1.71"/><line x1="8" y1="2" x2="8" y2="5"/><line x1="2" y1="8" x2="5" y2="8"/><line x1="16" y1="19" x2="16" y2="22"/><line x1="19" y1="16" x2="22" y2="16"/></svg>,
    Users: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  }
  return iconos[tipo] || iconos.Edit
}