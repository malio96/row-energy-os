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
      'dashboard', 'proyectos', 'ventas', 'cotizaciones', 'contratos', 'leads',
      'cobranza', 'facturacion', 'compras', 'cierre', 'postventa',
      'plantas',  // v15.8.0
      'actividades',  // v16.9.x: drill-down vista
      'auditoria',  // v17.1.0
      'config'
    ],
    puedeEliminar: true,
    puedeGestionarUsuarios: true,
    puedeCrearUsuarios: true,  // v17.5.0
  },
  admin: {
    label: 'Administración',
    descripcion: 'Acceso a todo excepto configuración; no puede eliminar registros',
    modulos: [
      'dashboard', 'proyectos', 'ventas', 'cotizaciones', 'contratos', 'leads',
      'cobranza', 'facturacion', 'compras', 'cierre', 'postventa',
      'plantas',  // v15.8.0
      'actividades',  // v16.9.x
      'auditoria',  // v17.1.0
    ],
    puedeEliminar: false,
    puedeGestionarUsuarios: false,
  },
  director_proyectos: {
    label: 'Director de Proyectos',
    descripcion: 'Operaciones: proyectos, cierre, postventa, plantas. Sin acceso a dinero.',
    modulos: [
      // v18.5.0: SIN módulos de dinero (ventas/contratos/cobranza/facturacion/compras)
      // por decisión de dirección. RLS alineado en BD.
      'dashboard', 'proyectos', 'cierre', 'postventa',
      'plantas',
      'actividades',  // v16.9.x
      'config',  // v17.5.0: acceso a Configuración para dar de alta equipo
    ],
    puedeEliminar: false,
    puedeGestionarUsuarios: false,
    puedeCrearUsuarios: true,  // v17.5.0: solo puede crear equipo_proyectos
  },
  ventas: {
    label: 'Ventas',
    descripcion: 'Acceso amplio de lectura: comercial + visibilidad de operaciones',
    modulos: [
      'dashboard', 'proyectos', 'ventas', 'cotizaciones', 'contratos', 'leads',
      'cobranza', 'facturacion', 'compras', 'cierre', 'postventa',
      'plantas',
      'actividades',  // v16.9.x
      'config',  // v17.5.0: acceso a Configuración para dar de alta equipo
    ],
    puedeEliminar: false,
    puedeGestionarUsuarios: false,
    puedeCrearUsuarios: true,  // v17.5.0: solo puede crear equipo_proyectos
  },
  cobranza: {
    label: 'Cobranza',
    descripcion: 'Finanzas entrantes + visibilidad de contratos, compras y cierre',
    modulos: [
      'dashboard', 'ventas', 'cobranza', 'facturacion',
      'contratos', 'compras', 'cierre',
      'plantas',
      'actividades',  // v16.9.x
    ],
    puedeEliminar: false,
    puedeGestionarUsuarios: false,
  },
  equipo_proyectos: {
    label: 'Equipo de Proyectos',
    descripcion: 'Ejecución de actividades en proyectos. Dashboard personal.',
    modulos: ['dashboard', 'proyectos', 'plantas', 'actividades'],
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

// ¿El usuario puede gestionar OTROS usuarios por completo (editar rol, desactivar,
// eliminar, reinvitar)? — solo dirección.
export function puedeGestionarUsuarios(usuario) {
  if (!usuario || !usuario.rol) return false
  return PERMISOS_POR_ROL[usuario.rol]?.puedeGestionarUsuarios === true
}

// v17.5.0: ¿El usuario puede DAR DE ALTA usuarios? (acción acotada: crear + invitar)
// Dirección puede crear cualquier rol; director_proyectos y ventas solo equipo_proyectos.
// El control real vive en la Edge Function `invitar-usuario`; esto solo decide UI.
export function puedeCrearUsuarios(usuario) {
  if (!usuario || !usuario.rol) return false
  return PERMISOS_POR_ROL[usuario.rol]?.puedeCrearUsuarios === true
}

// v17.5.0: ¿Puede crear un usuario con ESTE rol? Dirección → cualquiera; el resto,
// solo 'equipo_proyectos' (guardarraíl anti-escalada de privilegios).
export function puedeCrearRol(usuario, rol) {
  if (!puedeCrearUsuarios(usuario)) return false
  if (usuario.rol === 'direccion') return true
  return rol === 'equipo_proyectos'
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

// ============================================================
// v16.4.0 — HELPERS GRANULARES POR ACCIÓN
// Centralizan los chequeos `usuario.rol === 'X'` que estaban
// dispersos en los módulos (Cotizaciones, Compras, etc.).
// Si cambia la política, se modifica acá una sola vez.
// ============================================================

// ¿El usuario tiene alguno de los roles indicados?
export function esRolEn(usuario, roles) {
  if (!usuario || !usuario.rol || !Array.isArray(roles)) return false
  return roles.includes(usuario.rol)
}

// Atajo: dirección o admin (cobertura amplia para operaciones de gestión)
export function esDirOAdmin(usuario) {
  return esRolEn(usuario, ['direccion', 'admin'])
}

// ¿Puede aprobar cotizaciones (cambiar estado a Aprobada)?
export function puedeAprobarCotizacion(usuario) {
  return esRolEn(usuario, ['direccion', 'admin', 'ventas'])
}

// ¿Puede VER el tab financiero de un proyecto (totales, hitos)?
export function puedeVerFinanciero(usuario) {
  return esRolEn(usuario, ['direccion', 'admin', 'ventas'])
}

// ¿Puede EDITAR el tab financiero (crear/editar hitos, marcar cobrado)?
export function puedeEditarFinanciero(usuario) {
  return esRolEn(usuario, ['direccion', 'admin'])
}

// ¿Puede gestionar operaciones de proyecto (estado, plantilla, fechas)?
// v18.4.0: incluye equipo_proyectos — cualquiera del área de proyectos edita
// proyectos y mueve actividades (decisión de dirección; RLS alineado en BD).
export function puedeGestionarProyecto(usuario) {
  return esRolEn(usuario, ['direccion', 'admin', 'director_proyectos', 'equipo_proyectos'])
}