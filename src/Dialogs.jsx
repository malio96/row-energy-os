// v17.4.0: Sistema global de diálogos propios (estilo Klar) que reemplaza los
// alert()/confirm() nativos del navegador en toda la app.
//
// Uso desde cualquier componente o helper, sin props ni context:
//   import { toast, confirmDialog } from './Dialogs'
//   toast('Guardado', 'success')
//   if (await confirmDialog({ title: 'Eliminar', message: '¿Seguro?' })) { ... }
//
// Montar <DialogHost/> UNA sola vez cerca de la raíz (App.jsx).
import { useEffect, useState, useSyncExternalStore } from 'react'
import { COLORS, useIsMobile } from './helpers'

// ── Store a nivel de módulo (sin context: accesible desde cualquier import) ──
let _toasts = []
let _confirm = null
let _prompt = null
let _version = 0
let _idSeq = 0
const _listeners = new Set()

function _emit() { _version++; _listeners.forEach(fn => fn()) }
function _subscribe(fn) { _listeners.add(fn); return () => _listeners.delete(fn) }
function _getSnapshot() { return _version }

/** Muestra un toast efímero. tipo: 'info' | 'success' | 'error' */
export function toast(mensaje, tipo = 'info', duracionMs = 3200) {
  if (mensaje == null || mensaje === '') return
  const id = ++_idSeq
  _toasts = [..._toasts, { id, mensaje: String(mensaje), tipo }]
  _emit()
  setTimeout(() => {
    _toasts = _toasts.filter(t => t.id !== id)
    _emit()
  }, duracionMs)
}

/**
 * Confirmación modal. Devuelve Promise<boolean>.
 * opts: { title, message, confirmLabel='Eliminar', cancelLabel='Cancelar', variant='danger' }
 * variant: 'danger' (rojo) | 'warning' (ámbar) | 'info' (navy)
 */
export function confirmDialog(opts = {}) {
  return new Promise(resolve => {
    _confirm = {
      title: opts.title || '¿Confirmar?',
      message: opts.message || '',
      confirmLabel: opts.confirmLabel || 'Eliminar',
      cancelLabel: opts.cancelLabel || 'Cancelar',
      variant: opts.variant || 'danger',
      _done: (val) => { _confirm = null; _emit(); resolve(val) },
    }
    _emit()
  })
}

/**
 * Prompt modal con input de texto. Devuelve Promise<string|null> (null si cancela).
 * opts: { title, message, defaultValue='', placeholder='', confirmLabel='Aceptar', cancelLabel='Cancelar' }
 */
export function promptDialog(opts = {}) {
  return new Promise(resolve => {
    _prompt = {
      title: opts.title || '',
      message: opts.message || '',
      defaultValue: opts.defaultValue != null ? String(opts.defaultValue) : '',
      placeholder: opts.placeholder || '',
      confirmLabel: opts.confirmLabel || 'Aceptar',
      cancelLabel: opts.cancelLabel || 'Cancelar',
      _done: (val) => { _prompt = null; _emit(); resolve(val) },
    }
    _emit()
  })
}

const VARIANTS = {
  danger:  { iconBg: COLORS.redLight,   iconColor: COLORS.red,   btnBg: COLORS.red },
  warning: { iconBg: COLORS.amberLight, iconColor: COLORS.amber, btnBg: COLORS.amber },
  info:    { iconBg: COLORS.tealLight,  iconColor: COLORS.navy,  btnBg: COLORS.navy },
}

const TOAST_STYLES = {
  error:   { bg: COLORS.redLight, color: COLORS.red,  border: '#FECACA' },
  success: { bg: '#F0FDF4',       color: COLORS.teal, border: '#86EFAC' },
  info:    { bg: '#F8FAFC',       color: COLORS.navy, border: COLORS.slate200 },
}

function WarnIcon({ color }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  )
}

function ConfirmModal({ data }) {
  const isMobile = useIsMobile()
  const v = VARIANTS[data.variant] || VARIANTS.danger

  useEffect(() => {
    const h = (e) => {
      if (e.key === 'Escape') data._done(false)
      else if (e.key === 'Enter') data._done(true)
    }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [data])

  return (
    <div onClick={() => data._done(false)} style={{
      position:'fixed', inset:0, background:'rgba(10, 37, 64, 0.35)', backdropFilter:'blur(2px)',
      zIndex:3000, display:'flex', alignItems:'center', justifyContent:'center',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: isMobile ? 'calc(100% - 32px)' : 460, background:'white', borderRadius:14,
        boxShadow:'0 20px 60px rgba(10, 37, 64, 0.25)', overflow:'hidden',
        fontFamily:'var(--font-sans)',
      }}>
        <div style={{ padding:'22px 24px 14px', display:'flex', alignItems:'flex-start', gap:14 }}>
          <div style={{
            width:40, height:40, borderRadius:'50%', background:v.iconBg, color:v.iconColor,
            display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
          }}>
            <WarnIcon color={v.iconColor}/>
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <h3 style={{ margin:0, fontSize:16, fontWeight:600, color:COLORS.navy, letterSpacing:'-0.01em' }}>
              {data.title}
            </h3>
            {data.message && (
              <p style={{ margin:'6px 0 0', fontSize:13, color:COLORS.slate500, lineHeight:1.5, whiteSpace:'pre-line' }}>
                {data.message}
              </p>
            )}
          </div>
        </div>
        <div style={{
          padding:'14px 24px 18px', display:'flex', justifyContent:'flex-end', gap:10,
          background:COLORS.slate50, borderTop:`1px solid ${COLORS.slate100}`,
        }}>
          <button onClick={() => data._done(false)} style={{
            padding:'9px 18px', background:'white', color:COLORS.slate600,
            border:`1px solid ${COLORS.slate200}`, borderRadius:8, fontSize:13, fontWeight:600,
            cursor:'pointer', fontFamily:'inherit',
          }}>
            {data.cancelLabel}
          </button>
          <button autoFocus onClick={() => data._done(true)} style={{
            padding:'9px 18px', background:v.btnBg, color:'white', border:'none', borderRadius:8,
            fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit',
          }}>
            {data.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

function PromptModal({ data }) {
  const isMobile = useIsMobile()
  const [val, setVal] = useState(data.defaultValue)

  const submit = () => { if (val.trim()) data._done(val) }

  return (
    <div onClick={() => data._done(null)} style={{
      position:'fixed', inset:0, background:'rgba(10, 37, 64, 0.35)', backdropFilter:'blur(2px)',
      zIndex:3000, display:'flex', alignItems:'center', justifyContent:'center',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: isMobile ? 'calc(100% - 32px)' : 460, background:'white', borderRadius:14,
        boxShadow:'0 20px 60px rgba(10, 37, 64, 0.25)', overflow:'hidden', fontFamily:'var(--font-sans)',
      }}>
        <div style={{ padding:'22px 24px 16px' }}>
          {data.title && (
            <h3 style={{ margin:0, fontSize:16, fontWeight:600, color:COLORS.navy, letterSpacing:'-0.01em' }}>
              {data.title}
            </h3>
          )}
          {data.message && (
            <p style={{ margin:'6px 0 0', fontSize:13, color:COLORS.slate500, lineHeight:1.5, whiteSpace:'pre-line' }}>
              {data.message}
            </p>
          )}
          <input
            autoFocus
            value={val}
            onChange={e => setVal(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submit(); else if (e.key === 'Escape') data._done(null) }}
            placeholder={data.placeholder}
            style={{
              width:'100%', marginTop:14, padding:'10px 12px', border:`1px solid ${COLORS.slate200}`,
              borderRadius:8, fontSize:13, outline:'none', fontFamily:'inherit', boxSizing:'border-box',
            }}
          />
        </div>
        <div style={{
          padding:'14px 24px 18px', display:'flex', justifyContent:'flex-end', gap:10,
          background:COLORS.slate50, borderTop:`1px solid ${COLORS.slate100}`,
        }}>
          <button onClick={() => data._done(null)} style={{
            padding:'9px 18px', background:'white', color:COLORS.slate600,
            border:`1px solid ${COLORS.slate200}`, borderRadius:8, fontSize:13, fontWeight:600,
            cursor:'pointer', fontFamily:'inherit',
          }}>
            {data.cancelLabel}
          </button>
          <button onClick={submit} disabled={!val.trim()} style={{
            padding:'9px 18px', background:COLORS.navy, color:'white', border:'none', borderRadius:8,
            fontSize:13, fontWeight:600, cursor: val.trim() ? 'pointer' : 'not-allowed',
            opacity: val.trim() ? 1 : 0.6, fontFamily:'inherit',
          }}>
            {data.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

/** Host único: renderiza la pila de toasts + los modales de confirmación/prompt. */
export function DialogHost() {
  useSyncExternalStore(_subscribe, _getSnapshot, _getSnapshot)
  const confirm = _confirm
  const promptReq = _prompt
  const toasts = _toasts

  return (
    <>
      {toasts.length > 0 && (
        <div style={{
          position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)',
          display:'flex', flexDirection:'column', gap:8, zIndex:9999, alignItems:'center',
          pointerEvents:'none',
        }}>
          {toasts.map(t => {
            const s = TOAST_STYLES[t.tipo] || TOAST_STYLES.info
            return (
              <div key={t.id} style={{
                padding:'12px 20px', borderRadius:10, fontSize:13, fontWeight:500,
                background:s.bg, color:s.color, border:`1px solid ${s.border}`,
                boxShadow:'0 8px 24px rgba(10,37,64,0.12)', fontFamily:'var(--font-sans)',
                maxWidth:'min(90vw, 480px)', textAlign:'center',
              }}>
                {t.mensaje}
              </div>
            )
          })}
        </div>
      )}
      {confirm && <ConfirmModal data={confirm}/>}
      {promptReq && <PromptModal data={promptReq}/>}
    </>
  )
}
