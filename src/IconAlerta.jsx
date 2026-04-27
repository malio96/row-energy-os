// ============================================================
// IconAlerta.jsx — v15.8.6
// Renderiza el icono de una categoría de alerta como SVG con el mismo
// perfil visual del Sidebar (stroke 1.8, caps round). Reemplaza los
// emojis legacy en Centro de Alertas y tab "Mis alertas".
// ============================================================
import { SVG_PATHS_ALERTAS } from './alertas'

export default function IconAlerta({ categoria, size = 18, color }) {
  const path = SVG_PATHS_ALERTAS[categoria]
  if (!path) return null
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color || 'currentColor'}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
      dangerouslySetInnerHTML={{ __html: path }}
    />
  )
}
