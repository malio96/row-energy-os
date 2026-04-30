// ============================================================
// PERMISOS POR ROL — Row Energy OS v12.5.6
// ============================================================
// Arquitectura simple: cada rol tiene acceso fijo a ciertos módulos.
// Para cambiar permisos, se edita este archivo y aplica a todos los usuarios del rol.
//
// Para agregar override por usuario en el futuro, se puede:
//   1. Crear tabla 'usuario_permisos_extra'
//   2. Modificar la función puede() para consultar overrides primero
// ============================================================

// ============================================================
// MATRIZ DE PERMISOS — fuente única de verdad
// ============================================================
export const PERMISOS_POR_ROL = {
  direccion: {
    label: 'Dirección',
    descripcion: 'Acceso total a todo el sistema',
    modulos: [
      'dashboard', 'proyectos', 'cotizaciones', 'contratos', 'leads',
      'cobranza', 'facturacion', 'compras', 'cierre', 'postventa',
      'plantas',  // v15.8.0
      'config'
    ],
    puedeEliminar: true,
    puedeGestionarUsuarios: true,
  },
  admin: {
    label: 'Administración',
    descripcion: 'Acceso a todo excepto configuración; no puede eliminar registros',
    modulos: [
      'dashboard', 'proyectos', 'cotizaciones', 'contratos', 'leads',
      'cobranza', 'facturacion', 'compras', 'cierre', 'postventa',
      'plantas',  // v15.8.0
    ],
    puedeEliminar: false,
    puedeGestionarUsuarios: false,
  },
  director_proyectos: {
    label: 'Director de Proyectos',
    descripcion: 'Operaciones: proyectos, cierre, postventa, plantas',
    modulos: [
      'dashboard', 'proyectos', 'cierre', 'postventa',
      'plantas',
    ],
    puedeEliminar: false,
    puedeGestionarUsuarios: false,
  },
  ventas: {
    label: 'Ventas',
    descripcion: 'Acceso amplio de lectura: comercial + visibilidad de operaciones',
    modulos: [
      'dashboard', 'proyectos', 'cotizaciones', 'contratos', 'leads',
      'cobranza', 'facturacion', 'compras', 'cierre', 'postventa',
      'plantas',
    ],
    puedeEliminar: false,
    puedeGestionarUsuarios: false,
  },
  cobranza: {
    label: 'Cobranza',
    descripcion: 'Finanzas entrantes + visibilidad de contratos, compras y cierre',
    modulos: [
      'dashboard', 'cobranza', 'facturacion',
      'contratos', 'compras', 'cierre',
    ],
    puedeEliminar: false,
    puedeGestionarUsuarios: false,
  },
  equipo_proyectos: {
    label: 'Equipo de Proyectos',
    descripcion: 'Ejecución de actividades en proyectos. Dashboard personal.',
    modulos: ['dashboard', 'proyectos'],
    puedeEliminar: false,
    puedeGestionarUsuarios: false,
  },
}

// Lista de roles disponibles (para dropdowns)
export const ROLES_DISPONIBLES = Object.keys(PERMISOS_POR_ROL)

// ============================================================
// HELPERS
// ============================================================

// ¿El usuario puede VER este módulo?
// Uso: puede(usuario, 'proyectos')
export function puede(usuario, modulo) {
  if (!usuario || !usuario.rol) return false
  const config = PERMISOS_POR_ROL[usuario.rol]
  if (!config) return false
  return config.modulos.includes(modulo)
}

// ¿El usuario puede eliminar registros? (regla transversal)
export function puedeEliminar(usuario) {
  if (!usuario || !usuario.rol) return false
  return PERMISOS_POR_ROL[usuario.rol]?.puedeEliminar === true
}

// ¿El usuario puede gestionar otros usuarios? (solo dirección)
export function puedeGestionarUsuarios(usuario) {
  if (!usuario || !usuario.rol) return false
  return PERMISOS_POR_ROL[usuario.rol]?.puedeGestionarUsuarios === true
}

// Helper legible para UI: retorna los módulos a los que tiene acceso
export function modulosPermitidos(usuario) {
  if (!usuario || !usuario.rol) return []
  return PERMISOS_POR_ROL[usuario.rol]?.modulos || []
}

// Helper para UI: label legible de un rol
export function labelRol(rol) {
  return PERMISOS_POR_ROL[rol]?.label || rol
}

// Helper para UI: descripción del rol
export function descripcionRol(rol) {
  return PERMISOS_POR_ROL[rol]?.descripcion || ''
}