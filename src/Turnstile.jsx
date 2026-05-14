// ============================================================
// Turnstile.jsx — v16.6.0
// Cloudflare Turnstile (captcha invisible/managed) para Login + Reset password.
// CRIT-3 del Security Hardening Playbook.
//
// Comportamiento:
//   - Si VITE_TURNSTILE_SITE_KEY NO está set, el componente devuelve null y
//     TURNSTILE_ENABLED = false. El login funciona normal sin captcha.
//   - Cuando se setea la variable + se habilita captcha en Supabase Auth
//     dashboard, el componente renderiza el widget y captchaToken se pasa
//     a signInWithPassword / resetPasswordForEmail.
//
// Setup (cuando se decida activar):
//   1. https://dash.cloudflare.com → Turnstile → Add site → "app.row.energy"
//      → Widget mode "Managed"
//   2. Copiar Site Key → Vercel env: VITE_TURNSTILE_SITE_KEY=<key>
//   3. Copiar Secret Key → Supabase Dashboard → Authentication →
//      Settings → CAPTCHA Protection → enable → paste Secret Key
//   4. Redeploy Vercel
// ============================================================
import { useEffect, useRef } from 'react'

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || ''
let scriptLoading = null

function loadScript() {
  if (scriptLoading) return scriptLoading
  scriptLoading = new Promise((resolve) => {
    if (window.turnstile) return resolve()
    const s = document.createElement('script')
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    s.async = true
    s.defer = true
    s.onload = () => resolve()
    document.head.appendChild(s)
  })
  return scriptLoading
}

export default function Turnstile({ onVerify, theme = 'light' }) {
  const ref = useRef(null)
  const widgetIdRef = useRef(null)

  useEffect(() => {
    if (!SITE_KEY || !ref.current) return
    let mounted = true
    ;(async () => {
      await loadScript()
      if (!mounted || !ref.current || !window.turnstile) return
      widgetIdRef.current = window.turnstile.render(ref.current, {
        sitekey: SITE_KEY,
        theme,
        callback: (token) => onVerify?.(token),
        'expired-callback': () => onVerify?.(''),
        'error-callback': () => onVerify?.(''),
      })
    })()
    return () => {
      mounted = false
      try {
        if (widgetIdRef.current && window.turnstile) {
          window.turnstile.remove(widgetIdRef.current)
        }
      } catch { /* no-op */ }
    }
  }, [onVerify, theme])

  if (!SITE_KEY) return null
  return <div ref={ref} style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}/>
}

// Helper para que el caller sepa si está activo y pueda gating del submit button.
export const TURNSTILE_ENABLED = !!SITE_KEY
