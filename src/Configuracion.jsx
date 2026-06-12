import { useState, useEffect, useMemo } from 'react'
import {
  supabase,
  getTodosUsuarios, getClientes,
  actualizarUsuario, eliminarUsuario,
  desactivarUsuario, activarUsuario, cambiarRolUsuario,
  invitarUsuarioViaEdge, reinvitarUsuario,  // v12.5.8, v16.1.4
  getAlertasConfig, actualizarAlertasConfig, resetearAlertasConfig,  // v12.5.9e
  getResumenHorasActividades, aplicarHorasPorNombre, asignarHorasFaltantes,  // v18.8.0
} from './supabase'
import { toast } from './Dialogs'  // v18.8.0
import { COLORS, Avatar, Icon, SortControl, aplicarSort, loadPref, savePref } from './helpers'
import { useModal } from './Modal'
import {
  PERMISOS_POR_ROL, ROLES_DISPONIBLES,
  puedeGestionarUsuarios, puedeCrearUsuarios, puedeGestionarProyecto, labelRol, descripcionRol,
} from './permisos'
import { ETIQUETAS_ALERTAS } from './alertas'
import { FormClienteInline } from './Proyectos'  // v16.1.1: reuso para crear/editar cliente
import IconAlerta from './IconAlerta'  // v15.8.6

// ============================================================
// v12.5.6: Configuración con gestión de usuarios (solo direccion)
// v12.5.6c2: rol dropdown en lugar de texto libre
// v12.5.8: invitación automática via Edge Function
// ============================================================

const OPCIONES_ROL = ROLES_DISPONIBLES.map(r => ({
  value: r,
  label: `${PERMISOS_POR_ROL[r].label} — ${PERMISOS_POR_ROL[r].descripcion}`,
}))

export default function Configuracion({ usuario }) {
  const puedeGestionar = puedeGestionarUsuarios(usuario)  // edición total: solo dirección
  const puedeCrear = puedeCrearUsuarios(usuario)          // v17.5.0: alta de usuarios
  const [tab, setTab] = useState(puedeCrear ? 'usuarios' : 'sistema')
  const [usuarios, setUsuarios] = useState([])
  const [clientes, setClientes] = useState([])
  const [refreshTick, setRefreshTick] = useState(0)
  const modal = useModal()

  useEffect(() => {
    if (tab === 'usuarios') getTodosUsuarios().then(setUsuarios)
    else if (tab === 'clientes') getClientes().then(setClientes)
  }, [tab, refreshTick])

  const recargar = () => setRefreshTick(t => t + 1)

  const tabs = [
    ...(puedeCrear ? [{ k:'usuarios', l:'Usuarios' }] : []),
    ...(puedeGestionar ? [{ k:'clientes', l:'Clientes' }] : []),  // v17.5.0: clientes sigue solo dirección
    ...(puedeGestionarProyecto(usuario) ? [{ k:'horas', l:'Horas' }] : []),  // v18.8.0: horas en masa
    { k:'alertas', l:'Mis alertas' },
    { k:'cuenta', l:'Mi cuenta' },  // v16.7.0: cambio de contraseña
    { k:'sistema', l:'Sistema' },
  ]

  return (
    <div>
      <modal.Render/>

      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontSize:32, fontWeight:400, color:COLORS.navy, margin:0, letterSpacing:'-0.02em', fontFamily:'var(--font-sans)' }}>Configuración</h1>
        <p style={{ color:COLORS.slate500, fontSize:13, marginTop:6 }}>Gestión de usuarios, clientes y parámetros del sistema</p>
      </div>

      <div style={{ display:'flex', borderBottom:`1px solid ${COLORS.slate200}`, marginBottom:24, gap:2 }}>
        {tabs.map(t => (
          <button key={t.k} onClick={()=>setTab(t.k)} style={{
            padding:'10px 18px', border:'none', background:'transparent', cursor:'pointer',
            fontSize:13, fontWeight: tab===t.k?600:500,
            color: tab===t.k?COLORS.navy:COLORS.slate500,
            borderBottom: tab===t.k?`2px solid ${COLORS.navy}`:'2px solid transparent',
            marginBottom:-1
          }}>{t.l}</button>
        ))}
      </div>

      {tab === 'usuarios' && puedeCrear && (
        <TabUsuarios usuarios={usuarios} usuarioActual={usuario} modal={modal} recargar={recargar} puedeGestionar={puedeGestionar}/>
      )}

      {tab === 'clientes' && puedeGestionar && <TabClientes clientes={clientes}/>}
      {tab === 'horas' && puedeGestionarProyecto(usuario) && <TabHoras/>}
      {tab === 'alertas' && <TabMisAlertas usuario={usuario} modal={modal}/>}
      {tab === 'cuenta' && <TabMiCuenta usuario={usuario} modal={modal}/>}
      {tab === 'sistema' && <TabSistema usuario={usuario}/>}
    </div>
  )
}

// ============================================================
// TAB USUARIOS
// ============================================================
function TabUsuarios({ usuarios, usuarioActual, modal, recargar, puedeGestionar }) {

  // v17.5.0: solo Dirección elige rol libremente. director_proyectos y ventas
  // dan de alta exclusivamente colaboradores de Equipo de Proyectos.
  const puedeElegirRol = usuarioActual.rol === 'direccion'

  // v12.5.8: crear usuario con invitación automática
  // v16.7.0: dos métodos: invitar por email o crear con password temporal
  const abrirModalCrear = async () => {
    const resultado = await modal.editor({
      titulo: puedeElegirRol ? 'Nuevo usuario' : 'Nuevo colaborador de Equipo',
      mensaje: puedeElegirRol
        ? 'Crea el registro en la BD. Elige cómo darle acceso: invitación por email (más seguro, el destinatario crea su password) o password temporal (instantáneo, comparte por canal seguro y pídele que la cambie).'
        : 'Darás de alta un colaborador con rol Equipo de Proyectos. Elige cómo darle acceso: invitación por email (más seguro, crea su propia password) o password temporal (instantáneo, comparte por canal seguro y pídele que la cambie).',
      icono: 'Plus',
      textoBoton: 'Crear',
      campos: [
        { key: 'nombre',   label: 'Nombre completo', tipo: 'text',   required: true, placeholder: 'Ej: Juan Pérez' },
        { key: 'email',    label: 'Email',            tipo: 'text',   required: true, placeholder: 'juan@row.energy' },
        ...(puedeElegirRol
          ? [{ key: 'rol', label: 'Rol', tipo: 'select', required: true, defaultValue: 'ventas', opciones: OPCIONES_ROL }]
          : []),
        { key: 'telefono', label: 'Teléfono',         tipo: 'text',   placeholder: 'Opcional' },
        { key: 'capacidad_horas_semana', label: 'Capacidad horas/semana', tipo: 'number', defaultValue: 40 },
        { key: 'metodo',   label: 'Método de acceso', tipo: 'select', required: true, defaultValue: 'invite_email',
          opciones: [
            { value: 'invite_email', label: 'Invitar por email (recomendado)' },
            { value: 'password_temporal', label: 'Crear con password temporal' },
          ] },
      ],
    })
    if (!resultado) return

    const usarPasswordTemporal = resultado.metodo === 'password_temporal'
    const rolFinal = puedeElegirRol ? resultado.rol : 'equipo_proyectos'

    try {
      const respuesta = await invitarUsuarioViaEdge({
        nombre: resultado.nombre,
        email: resultado.email,
        rol: rolFinal,
        telefono: resultado.telefono,
        capacidad_horas_semana: resultado.capacidad_horas_semana,
        generar_password_temporal: usarPasswordTemporal,
      })

      if (usarPasswordTemporal && respuesta.password_temporal) {
        // Mostrar password una sola vez con opción de copiar
        const pwd = respuesta.password_temporal
        try { await navigator.clipboard?.writeText(pwd) } catch { /* no-op */ }
        await modal.alert({
          titulo: '🔑 Password temporal creada',
          mensaje: `Usuario: ${resultado.email}\nPassword: ${pwd}\n\n${navigator.clipboard ? '✓ Copiada al portapapeles.\n\n' : ''}IMPORTANTE: esta password no se mostrará de nuevo. Cómprtela por canal seguro (WhatsApp, en persona) y pídele al usuario que la cambie en su primer login desde Configuración → Mi cuenta.`,
          icono: 'Check',
        })
      } else {
        await modal.alert({
          titulo: '✉️ Invitación enviada',
          mensaje: respuesta.mensaje || `Usuario creado. Invitación enviada a ${resultado.email}.`,
          icono: 'Check',
        })
      }
      recargar()
    } catch (err) {
      await modal.alert({
        titulo: 'Error al invitar',
        mensaje: err.message || String(err),
        icono: 'Alert',
      })
    }
  }

  const abrirModalEditar = async (u) => {
    const resultado = await modal.editor({
      titulo: `Editar ${u.nombre}`,
      mensaje: 'Modifica los datos del usuario. Los cambios sensibles como rol tienen reglas de protección automáticas.',
      icono: 'Edit',
      textoBoton: 'Guardar cambios',
      campos: [
        { key: 'nombre',   label: 'Nombre completo', tipo: 'text',   required: true, defaultValue: u.nombre },
        { key: 'email',    label: 'Email',            tipo: 'text',   required: true, defaultValue: u.email },
        { key: 'rol',      label: 'Rol',              tipo: 'select', required: true, defaultValue: u.rol, opciones: OPCIONES_ROL },
        { key: 'telefono', label: 'Teléfono',         tipo: 'text',   defaultValue: u.telefono || '' },
        { key: 'capacidad_horas_semana', label: 'Capacidad horas/semana', tipo: 'number', defaultValue: u.capacidad_horas_semana || 40 },
      ],
    })
    if (!resultado) return

    try {
      if (resultado.rol !== u.rol) {
        await cambiarRolUsuario(u.id, resultado.rol, usuarioActual.id)
      }
      await actualizarUsuario(u.id, {
        nombre: resultado.nombre,
        email: resultado.email,
        telefono: resultado.telefono,
        capacidad_horas_semana: resultado.capacidad_horas_semana,
      })
      recargar()
    } catch (err) {
      await modal.alert({ titulo: 'Error al guardar', mensaje: err.message || String(err), icono: 'Alert' })
    }
  }

  const toggleActivo = async (u) => {
    const ok = await modal.confirm({
      titulo: `${u.activo ? 'Desactivar' : 'Activar'} usuario`,
      mensaje: u.activo
        ? `${u.nombre} no podrá iniciar sesión hasta que sea reactivado. ¿Continuar?`
        : `${u.nombre} podrá iniciar sesión nuevamente. ¿Continuar?`,
      textoBoton: u.activo ? 'Desactivar' : 'Activar',
      destructivo: u.activo,
      icono: u.activo ? 'Alert' : 'Check',
    })
    if (!ok) return

    try {
      if (u.activo) await desactivarUsuario(u.id, usuarioActual.id)
      else await activarUsuario(u.id)
      recargar()
    } catch (err) {
      await modal.alert({ titulo: 'No se puede realizar', mensaje: err.message || String(err), icono: 'Alert' })
    }
  }

  const eliminar = async (u) => {
    const ok = await modal.confirm({
      titulo: 'Eliminar usuario',
      mensaje: `El usuario ${u.nombre} (${u.email}) se eliminará permanentemente. Si tiene registros asociados (proyectos, facturas, etc.) la eliminación no será posible — usa Desactivar en su lugar.`,
      textoBoton: 'Eliminar',
      destructivo: true,
      icono: 'Trash',
    })
    if (!ok) return

    try {
      await eliminarUsuario(u.id, usuarioActual.id)
      recargar()
    } catch (err) {
      await modal.alert({ titulo: 'No se puede eliminar', mensaje: err.message || String(err), icono: 'Alert' })
    }
  }

  // v16.1.4: enviar/re-enviar invitación a un usuario que existe en BD pero sin auth
  const reinvitar = async (u) => {
    const ok = await modal.confirm({
      titulo: 'Enviar invitación',
      mensaje: `Se enviará un email a ${u.email} con el link para crear su contraseña. ¿Continuar?`,
      textoBoton: 'Enviar invitación',
      icono: 'Plus',
    })
    if (!ok) return
    try {
      const r = await reinvitarUsuario(u.email)
      await modal.alert({
        titulo: '✉️ Invitación enviada',
        mensaje: r.mensaje || `Email enviado a ${u.email}.`,
        icono: 'Check',
      })
      recargar()
    } catch (err) {
      await modal.alert({ titulo: 'Error al invitar', mensaje: err.message || String(err), icono: 'Alert' })
    }
  }

  const esYo = (u) => u.id === usuarioActual.id

  // v16.1.4: estado real de auth — derivado de auth_id en la tabla usuarios
  const estadoAuth = (u) => {
    if (!u.activo) return { label: '○ Inactivo', color: COLORS.slate400, badgeBg: COLORS.slate50 }
    if (!u.auth_id) return { label: '⚠ Sin invitar', color: COLORS.red, badgeBg: '#FEF2F2' }
    return { label: '✓ Activo', color: COLORS.teal, badgeBg: '#E1F5EE' }
  }

  // Sort (persistido en localStorage)
  const [sort, setSort] = useState(() => loadPref('sort.config.usuarios', { field:'nombre', dir:'asc' }))
  useEffect(() => { savePref('sort.config.usuarios', sort) }, [sort])

  const usuariosOrdenados = useMemo(() => aplicarSort(usuarios, sort, {
    nombre: u => (u.nombre || '').toLowerCase(),
    email:  u => (u.email || '').toLowerCase(),
    rol:    u => u.rol || '',
    activo: u => u.activo ? 1 : 0,
  }), [usuarios, sort])

  return (
    <>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, gap:10 }}>
        <div>
          <h3 style={{ fontSize:14, fontWeight:600, color:COLORS.ink, margin:0 }}>Equipo ({usuarios.length})</h3>
          <div style={{ fontSize:11, color:COLORS.slate500, marginTop:2 }}>
            {usuarios.filter(u => u.activo).length} activos · {usuarios.filter(u => !u.activo).length} inactivos
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <SortControl value={sort} onChange={setSort} fields={[
            { key:'nombre', label:'Nombre' },
            { key:'email',  label:'Email' },
            { key:'rol',    label:'Rol' },
            { key:'activo', label:'Activo' },
          ]}/>
          <button onClick={abrirModalCrear} style={{
            padding:'10px 18px', background:COLORS.navy, color:'white',
            border:'none', borderRadius:8, fontSize:13, fontWeight:600,
            cursor:'pointer', display:'inline-flex', alignItems:'center', gap:6,
          }}>
            {Icon('Plus')} Invitar usuario
          </button>
        </div>
      </div>

      {/* v16.1.4: banner advertencia si hay usuarios huérfanos (sin auth).
          v17.5.0: solo para Dirección — el botón Invitar por fila es exclusivo suyo. */}
      {puedeGestionar && (() => {
        const huerfanos = usuarios.filter(u => u.activo && !u.auth_id)
        if (huerfanos.length === 0) return null
        return (
          <div style={{
            background:'#FEF2F2', border:`1px solid #FECACA`, borderRadius:10,
            padding:'12px 16px', marginBottom:16, display:'flex', alignItems:'center', gap:10,
            fontSize:12, color:'#991B1B',
          }}>
            <span style={{ fontSize:16 }}>⚠</span>
            <div style={{ flex:1 }}>
              <strong>{huerfanos.length} usuario(s) sin invitar</strong> — están en la BD pero todavía no pueden iniciar sesión. Usa el botón <em>Invitar</em> en cada uno para enviarles el email con el link de setup de contraseña.
            </div>
          </div>
        )
      })()}

      <div style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, overflow:'hidden', marginBottom:20 }}>
        {usuarios.length === 0 && (
          <div style={{ padding:40, textAlign:'center', color:COLORS.slate400, fontSize:13 }}>Sin usuarios</div>
        )}
        {usuariosOrdenados.map(u => {
          const auth = estadoAuth(u)
          const sinInvitar = u.activo && !u.auth_id
          return (
          <div key={u.id} style={{
            display:'grid',
            gridTemplateColumns:'40px 1fr 160px 130px 130px auto',
            padding:'14px 20px',
            borderBottom:`1px solid ${COLORS.slate100}`,
            alignItems:'center', fontSize:13, gap:12,
            opacity: u.activo ? 1 : 0.55,
          }}>
            <Avatar nombre={u.nombre} size={34}/>
            <div style={{ minWidth:0 }}>
              <div style={{ fontWeight:500, color:COLORS.ink, display:'flex', alignItems:'center', gap:6 }}>
                {u.nombre}
                {esYo(u) && <span style={{ fontSize:9, padding:'2px 6px', background:COLORS.teal, color:'white', borderRadius:4, fontWeight:700 }}>TÚ</span>}
              </div>
              <div style={{ fontSize:11, color:COLORS.slate500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{u.email}</div>
            </div>
            <div>
              <BadgeRol rol={u.rol}/>
            </div>
            <div style={{ fontSize:11, color:COLORS.slate500 }}>{u.telefono || '—'}</div>
            <div>
              <span style={{
                fontSize:10, fontWeight:700, padding:'4px 10px', borderRadius:10,
                background: auth.badgeBg, color: auth.color, textTransform:'uppercase', letterSpacing:'0.04em',
                whiteSpace:'nowrap',
              }}>
                {auth.label}
              </span>
            </div>
            <div style={{ display:'flex', gap:4 }}>
              {/* v17.5.0: editar/activar/desactivar/eliminar/reinvitar solo Dirección.
                  director_proyectos y ventas solo pueden dar de alta (lista de solo lectura). */}
              {puedeGestionar && (
                <>
                  {sinInvitar && !esYo(u) && (
                    <button onClick={() => reinvitar(u)} title="Enviar invitación por email" style={{
                      padding:'6px 12px', background:COLORS.navy, color:'white',
                      border:'none', borderRadius:6, fontSize:11, fontWeight:600,
                      cursor:'pointer', display:'inline-flex', alignItems:'center', gap:4,
                    }}>
                      ✉ Invitar
                    </button>
                  )}
                  <button onClick={() => abrirModalEditar(u)} title="Editar" style={botonIcon()}
                    onMouseEnter={e => { e.currentTarget.style.background = COLORS.slate50; e.currentTarget.style.color = COLORS.navy }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.color = COLORS.slate500 }}>
                    {Icon('Edit')}
                  </button>
                  {!esYo(u) && (
                    <>
                      <button onClick={() => toggleActivo(u)} title={u.activo ? 'Desactivar' : 'Activar'} style={botonIcon()}
                        onMouseEnter={e => { e.currentTarget.style.background = u.activo ? '#FEF3C7' : '#E1F5EE'; e.currentTarget.style.color = u.activo ? COLORS.amber : COLORS.teal }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.color = COLORS.slate500 }}>
                        {u.activo
                          ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                          : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 16 9"/></svg>
                        }
                      </button>
                      <button onClick={() => eliminar(u)} title="Eliminar" style={botonIcon()}
                        onMouseEnter={e => { e.currentTarget.style.background = '#FEF2F2'; e.currentTarget.style.color = COLORS.red; e.currentTarget.style.borderColor = '#FECACA' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.color = COLORS.slate500; e.currentTarget.style.borderColor = COLORS.slate200 }}>
                        {Icon('Trash')}
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        )})}
      </div>

      <MatrizPermisos/>
    </>
  )
}

// ============================================================
// BADGE DE ROL
// ============================================================
function BadgeRol({ rol }) {
  const colores = {
    direccion: { bg: '#E1F5EE', color: COLORS.teal },
    admin: { bg: '#E0EDFF', color: COLORS.navy2 || COLORS.navy },
    director_proyectos: { bg: '#F3EEFB', color: COLORS.purple },
    ventas: { bg: '#FEF3C7', color: COLORS.amber },
    cobranza: { bg: '#FEF9E6', color: COLORS.gold },
    equipo_proyectos: { bg: '#F1F5F9', color: COLORS.slate600 },
  }
  const c = colores[rol] || { bg: COLORS.slate50, color: COLORS.slate500 }
  return (
    <span style={{
      display:'inline-block', fontSize:10, fontWeight:700,
      padding:'3px 10px', borderRadius:12,
      background: c.bg, color: c.color,
      textTransform: 'uppercase', letterSpacing: '0.04em',
      whiteSpace: 'nowrap',
    }}>
      {labelRol(rol)}
    </span>
  )
}

// ============================================================
// MATRIZ DE PERMISOS (referencia)
// ============================================================
function MatrizPermisos() {
  const [expandida, setExpandida] = useState(false)

  return (
    <div style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, overflow:'hidden' }}>
      <button onClick={() => setExpandida(!expandida)} style={{
        width:'100%', padding:'14px 20px', border:'none', background:'transparent', cursor:'pointer',
        display:'flex', alignItems:'center', justifyContent:'space-between', fontSize:13, fontWeight:600, color:COLORS.ink,
      }}>
        <span>Permisos por rol (referencia)</span>
        <span style={{ color:COLORS.slate500, fontSize:11 }}>{expandida ? '▼ Ocultar' : '▶ Ver detalles'}</span>
      </button>
      {expandida && (
        <div style={{ borderTop:`1px solid ${COLORS.slate100}`, padding:'14px 20px' }}>
          <div style={{ fontSize:11, color:COLORS.slate500, marginBottom:14, fontStyle:'italic' }}>
            Para cambiar qué módulos ve cada rol, se edita el archivo <code style={{ background:COLORS.slate50, padding:'2px 6px', borderRadius:4, fontFamily:'var(--font-mono)' }}>permisos.js</code>
          </div>
          <div style={{ display:'grid', gap:12 }}>
            {ROLES_DISPONIBLES.map(rol => {
              const config = PERMISOS_POR_ROL[rol]
              return (
                <div key={rol} style={{ padding:'12px 14px', background:COLORS.slate50, borderRadius:8 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
                    <BadgeRol rol={rol}/>
                    <span style={{ fontSize:11, color:COLORS.slate500 }}>{descripcionRol(rol)}</span>
                  </div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginTop:6 }}>
                    {config.modulos.map(m => (
                      <span key={m} style={{
                        fontSize:10, padding:'2px 8px', borderRadius:4,
                        background:'white', border:`1px solid ${COLORS.slate200}`, color:COLORS.slate600,
                        fontFamily:'var(--font-mono)',
                      }}>{m}</span>
                    ))}
                    {config.puedeEliminar && (
                      <span style={{
                        fontSize:10, padding:'2px 8px', borderRadius:4,
                        background:COLORS.red, color:'white', fontWeight:600,
                      }}>puede eliminar</span>
                    )}
                    {config.puedeGestionarUsuarios && (
                      <span style={{
                        fontSize:10, padding:'2px 8px', borderRadius:4,
                        background:COLORS.teal, color:'white', fontWeight:600,
                      }}>gestiona usuarios</span>
                    )}
                    {config.puedeCrearUsuarios && !config.puedeGestionarUsuarios && (
                      <span style={{
                        fontSize:10, padding:'2px 8px', borderRadius:4,
                        background:COLORS.navy, color:'white', fontWeight:600,
                      }}>crea equipo</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// TAB CLIENTES
// ============================================================
// v16.1.1: TabClientes ahora permite crear y editar clientes inline.
// Antes era read-only, lo que dejaba a clientes sin RFC/dirección bloqueados
// (no podían aprobar cotizaciones porque el trigger v16.1 lo requiere).
function TabClientes({ clientes: clientesProp }) {
  const [clientes, setClientes] = useState(clientesProp || [])
  const [editando, setEditando] = useState(null)  // cliente o null
  const [creando, setCreando] = useState(false)

  useEffect(() => { setClientes(clientesProp || []) }, [clientesProp])
  const recargar = async () => setClientes(await getClientes())

  // Helper visual: marca clientes incompletos (sin RFC o sin dirección) en rojo.
  // Ayuda al usuario a ver de un vistazo qué clientes bloquearán sus cotizaciones.
  const incompleto = (c) => !c.rfc || !c.direccion

  // Sort (persistido en localStorage)
  const [sort, setSort] = useState(() => loadPref('sort.config.clientes', { field:'razon', dir:'asc' }))
  useEffect(() => { savePref('sort.config.clientes', sort) }, [sort])

  const clientesOrdenados = useMemo(() => aplicarSort(clientes, sort, {
    razon:     c => (c.razon_social || '').toLowerCase(),
    rfc:       c => (c.rfc || '').toUpperCase(),
    industria: c => (c.industria || '').toLowerCase(),
  }), [clientes, sort])

  return (
    <div style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, overflow:'hidden' }}>
      <div style={{ padding:'14px 20px', borderBottom:`1px solid ${COLORS.slate100}`, display:'flex', justifyContent:'space-between', alignItems:'center', gap:10 }}>
        <div style={{ fontSize:13, fontWeight:600, color:COLORS.ink }}>Clientes ({clientes.length})</div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <SortControl value={sort} onChange={setSort} fields={[
            { key:'razon',     label:'Alfabético' },
            { key:'rfc',       label:'RFC' },
            { key:'industria', label:'Industria' },
          ]}/>
          <button onClick={() => { setCreando(true); setEditando(null) }} style={{ padding:'6px 12px', background:COLORS.teal, color:'white', border:'none', borderRadius:6, fontSize:12, fontWeight:600, cursor:'pointer' }}>
            + Nuevo cliente
          </button>
        </div>
      </div>

      {creando && (
        <div style={{ padding:'12px 20px', borderBottom:`1px solid ${COLORS.slate100}`, background:COLORS.slate50 }}>
          <FormClienteInline
            onCancel={() => setCreando(false)}
            onCreated={async () => { setCreando(false); await recargar() }}
          />
        </div>
      )}

      {clientes.length === 0 && !creando && (
        <div style={{ padding:40, textAlign:'center', color:COLORS.slate400, fontSize:13 }}>Sin clientes</div>
      )}

      {clientesOrdenados.map(c => {
        const enEdicion = editando?.id === c.id
        return (
          <div key={c.id} style={{ borderBottom:`1px solid ${COLORS.slate100}` }}>
            <div
              onClick={() => setEditando(enEdicion ? null : c)}
              style={{
                display:'grid',
                gridTemplateColumns:'80px 1fr 180px 160px 140px 90px',
                padding:'12px 20px',
                alignItems:'center',
                fontSize:13,
                cursor:'pointer',
                background: enEdicion ? COLORS.tealLight : 'transparent',
                transition:'background 0.12s',
              }}
              onMouseEnter={e => { if (!enEdicion) e.currentTarget.style.background = COLORS.slate50 }}
              onMouseLeave={e => { if (!enEdicion) e.currentTarget.style.background = 'transparent' }}
            >
              <span style={{ fontSize:11, fontFamily:'var(--font-mono)', color:COLORS.slate500, fontWeight:600 }}>{c.codigo}</span>
              <div>
                <div style={{ fontWeight:500, color:COLORS.ink, display:'flex', alignItems:'center', gap:6 }}>
                  {c.razon_social}
                  {incompleto(c) && (
                    <span title="Cliente incompleto: falta RFC o dirección. No podrá aprobar cotizaciones." style={{ fontSize:9, padding:'2px 6px', background:'#FEF3C7', color:'#92400E', borderRadius:6, fontWeight:700 }}>
                      ⚠ INCOMPLETO
                    </span>
                  )}
                </div>
                <div style={{ fontSize:11, color:COLORS.slate500 }}>{c.rfc || <span style={{ color:COLORS.red }}>sin RFC</span>}</div>
              </div>
              <div style={{ fontSize:12, color:COLORS.slate600 }}>{c.contacto_nombre || '—'}</div>
              <div style={{ fontSize:11, color:COLORS.slate500 }}>{c.contacto_email || '—'}</div>
              <div style={{ fontSize:11, color:COLORS.slate500 }}>{c.industria || '—'}</div>
              <div style={{ fontSize:11, color:COLORS.teal, textAlign:'right', fontWeight:600 }}>
                {enEdicion ? 'Cerrar ▴' : 'Editar ▾'}
              </div>
            </div>
            {enEdicion && (
              <div style={{ padding:'8px 20px 14px', background:COLORS.slate50 }}>
                <FormClienteInline
                  cliente={c}
                  onCancel={() => setEditando(null)}
                  onUpdated={async () => { setEditando(null); await recargar() }}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ============================================================
// TAB MI CUENTA — v16.7.0
// Permite al usuario logueado cambiar su contraseña sin pasar por
// el flujo "Olvidé contraseña" (que requiere email).
// ============================================================
function TabMiCuenta({ usuario, modal }) {
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [exito, setExito] = useState(false)

  const cambiar = async (e) => {
    e.preventDefault()
    setError('')
    setExito(false)

    if (nueva.length < 12) {
      setError('La nueva contraseña debe tener al menos 12 caracteres.')
      return
    }
    if (nueva !== confirmar) {
      setError('La nueva contraseña y su confirmación no coinciden.')
      return
    }
    if (nueva === actual) {
      setError('La nueva contraseña debe ser distinta a la actual.')
      return
    }

    setGuardando(true)
    try {
      // Re-auth para verificar identidad del que está cambiando la password
      const { error: reauthErr } = await supabase.auth.signInWithPassword({
        email: usuario.email,
        password: actual,
      })
      if (reauthErr) {
        setError('La contraseña actual es incorrecta.')
        setGuardando(false)
        return
      }

      // Actualizar password
      const { error: upErr } = await supabase.auth.updateUser({ password: nueva })
      if (upErr) {
        setError(upErr.message || 'No se pudo actualizar la contraseña.')
        setGuardando(false)
        return
      }

      // Revocar otras sesiones (mantiene solo la actual)
      try { await supabase.auth.signOut({ scope: 'others' }) } catch { /* no-op */ }

      setActual('')
      setNueva('')
      setConfirmar('')
      setExito(true)
    } catch (err) {
      setError(err.message || String(err))
    }
    setGuardando(false)
  }

  const inputStyle = {
    width:'100%', padding:'10px 12px', border:`1px solid ${COLORS.slate200}`,
    borderRadius:8, fontSize:13, outline:'none', fontFamily:'inherit', boxSizing:'border-box',
  }
  const labelStyle = {
    fontSize:11, fontWeight:600, color:COLORS.slate500, textTransform:'uppercase',
    letterSpacing:'0.06em', display:'block', marginBottom:6,
  }

  return (
    <div style={{ display:'grid', gap:16 }}>
      {/* Info del usuario */}
      <div style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, padding:24 }}>
        <h3 style={{ fontSize:14, fontWeight:600, color:COLORS.ink, marginBottom:16 }}>Mis datos</h3>
        <div style={{ display:'grid', gap:12, fontSize:13 }}>
          <InfoRow label="Nombre" valor={usuario.nombre}/>
          <InfoRow label="Email" valor={usuario.email}/>
          <InfoRow label="Rol" valor={labelRol(usuario.rol)}/>
        </div>
      </div>

      {/* Cambio de contraseña */}
      <div style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, padding:24, maxWidth:520 }}>
        <h3 style={{ fontSize:14, fontWeight:600, color:COLORS.ink, marginBottom:6 }}>Cambiar contraseña</h3>
        <p style={{ fontSize:12, color:COLORS.slate500, marginBottom:18 }}>
          Mínimo 12 caracteres. Cambiarla cerrará sesión en otros dispositivos donde estés conectado.
        </p>
        <form onSubmit={cambiar}>
          <div style={{ marginBottom:14 }}>
            <label style={labelStyle}>Contraseña actual</label>
            <input type="password" value={actual} onChange={e => setActual(e.target.value)} required style={inputStyle} autoComplete="current-password"/>
          </div>
          <div style={{ marginBottom:14 }}>
            <label style={labelStyle}>Nueva contraseña</label>
            <input type="password" value={nueva} onChange={e => setNueva(e.target.value)} required style={inputStyle} autoComplete="new-password" placeholder="Al menos 12 caracteres"/>
          </div>
          <div style={{ marginBottom:14 }}>
            <label style={labelStyle}>Confirmar nueva contraseña</label>
            <input type="password" value={confirmar} onChange={e => setConfirmar(e.target.value)} required style={inputStyle} autoComplete="new-password"/>
          </div>
          {error && <div style={{ padding:10, background:COLORS.redLight, color:COLORS.red, borderRadius:8, fontSize:12, marginBottom:14 }}>⚠ {error}</div>}
          {exito && <div style={{ padding:10, background:COLORS.successLight, color:COLORS.successInk, borderRadius:8, fontSize:12, marginBottom:14 }}>✓ Contraseña actualizada. Las otras sesiones fueron cerradas.</div>}
          <button type="submit" disabled={guardando} style={{ padding:'10px 22px', background:COLORS.navy, color:'white', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor: guardando ? 'wait' : 'pointer', opacity: guardando ? 0.7 : 1 }}>
            {guardando ? 'Actualizando...' : 'Cambiar contraseña'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ============================================================
// TAB SISTEMA
// ============================================================
function TabSistema({ usuario }) {
  return (
    <div style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, padding:24 }}>
      <h3 style={{ fontSize:14, fontWeight:600, color:COLORS.ink, marginBottom:16 }}>Información del sistema</h3>
      <div style={{ display:'grid', gap:12, fontSize:13 }}>
        <InfoRow label="Versión" valor="Row Energy OS 1.0 (v12.5.8)"/>
        <InfoRow label="Base de datos" valor="Supabase (conectada)" color={COLORS.teal}/>
        <InfoRow label="Hosting" valor="Vercel · app.row.energy"/>
        <InfoRow label="Normativa base" valor="LSE 2025 · Reglamento LSE"/>
        <InfoRow label="Tu rol" valor={labelRol(usuario.rol)}/>
      </div>
    </div>
  )
}

function InfoRow({ label, valor, color }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', padding:'10px 0', borderBottom:`1px solid ${COLORS.slate100}` }}>
      <span style={{ color:COLORS.slate500 }}>{label}</span>
      <span style={{ fontFamily:'var(--font-mono)', color: color || COLORS.ink, fontWeight: color ? 600 : 400 }}>{valor}</span>
    </div>
  )
}

function botonIcon() {
  return {
    border:`1px solid ${COLORS.slate200}`, background:'white', color:COLORS.slate500,
    cursor:'pointer', padding:'6px 8px', borderRadius:6,
    display:'flex', alignItems:'center', justifyContent:'center',
    transition:'all 0.15s',
  }
}

// ============================================================
// TAB MIS ALERTAS — v12.5.9e
// Toggles personales para activar/desactivar cada categoría de alerta.
// Email diario queda fuera de scope (Commit E).
// ============================================================
const GRUPOS_ALERTAS = [
  {
    severidad: 'critica',
    label: 'Críticas',
    color: COLORS.red,
    bg: '#FEF2F2',
    descripcion: 'Requieren acción inmediata',
    categorias: ['facturas_vencidas', 'cxp_autorizacion_pendiente'],
  },
  {
    severidad: 'importante',
    label: 'Importantes',
    color: COLORS.amber,
    bg: '#FEF3C7',
    descripcion: 'Conviene revisar pronto',
    categorias: ['actividades_retrasadas', 'actividades_bloqueadas', 'proyectos_cierre_proximo', 'colaborador_sobrecargado'],
  },
  {
    severidad: 'info',
    label: 'Informativas',
    color: COLORS.navy,
    bg: '#EFF6FF',
    descripcion: 'Buenas para tener en el radar',
    categorias: ['leads_sin_actividad', 'cotizaciones_sin_respuesta'],
  },
]

function TabMisAlertas({ usuario, modal }) {
  const [config, setConfig] = useState(null)
  const [original, setOriginal] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!usuario?.id) return
    setLoading(true)
    getAlertasConfig(usuario.id)
      .then(c => { setConfig(c); setOriginal(c) })
      .catch(err => console.warn('getAlertasConfig:', err))
      .finally(() => setLoading(false))
  }, [usuario?.id])

  const dirty = config && original && GRUPOS_ALERTAS.some(g =>
    g.categorias.some(k => Boolean(config[k]) !== Boolean(original[k]))
  )

  const toggle = (key) => setConfig(c => ({ ...c, [key]: !c[key] }))

  const guardar = async () => {
    if (!config || !dirty) return
    setSaving(true)
    try {
      const cambios = {}
      GRUPOS_ALERTAS.forEach(g => g.categorias.forEach(k => { cambios[k] = Boolean(config[k]) }))
      const actualizada = await actualizarAlertasConfig(usuario.id, cambios)
      setConfig(actualizada)
      setOriginal(actualizada)
      await modal.alert({ titulo: 'Preferencias guardadas', mensaje: 'Tus alertas se actualizarán la próxima vez que abras el Dashboard o el Centro de Alertas.', icono: 'Check' })
    } catch (e) {
      await modal.alert({ titulo: 'Error al guardar', mensaje: e.message || String(e), icono: 'Alert' })
    } finally { setSaving(false) }
  }

  const cancelar = () => setConfig(original)

  const restaurarDefaults = async () => {
    const ok = await modal.confirm({
      titulo: 'Restaurar valores por defecto',
      mensaje: `Esto reemplazará tus preferencias con los defaults sugeridos para tu rol (${labelRol(usuario.rol) || usuario.rol}). ¿Continuar?`,
      destructivo: true,
    })
    if (!ok) return
    setSaving(true)
    try {
      const nueva = await resetearAlertasConfig(usuario.id)
      setConfig(nueva)
      setOriginal(nueva)
      await modal.alert({ titulo: 'Defaults aplicados', mensaje: 'Se restauraron las preferencias por defecto de tu rol.', icono: 'Check' })
    } catch (e) {
      await modal.alert({ titulo: 'Error', mensaje: e.message || String(e), icono: 'Alert' })
    } finally { setSaving(false) }
  }

  if (loading) return <div style={{ padding:40, textAlign:'center', color:COLORS.slate400, fontSize:13 }}>Cargando preferencias...</div>
  if (!config) return <div style={{ padding:40, textAlign:'center', color:COLORS.slate400, fontSize:13 }}>No se pudo cargar la configuración.</div>

  return (
    <div>
      <div style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, padding:18, marginBottom:16 }}>
        <h3 style={{ fontSize:14, fontWeight:600, color:COLORS.ink, margin:0, marginBottom:6 }}>Preferencias de alertas</h3>
        <p style={{ fontSize:12, color:COLORS.slate500, margin:0 }}>
          Activa o desactiva las categorías que quieres ver en el banner del Dashboard, en la campana del Sidebar y en el Centro de Alertas. Estos toggles solo afectan a tu cuenta.
        </p>
      </div>

      {GRUPOS_ALERTAS.map(grupo => (
        <div key={grupo.severidad} style={{ marginBottom:16 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
            <span style={{ width:8, height:8, borderRadius:'50%', background:grupo.color }}/>
            <span style={{ fontSize:12, fontWeight:700, color:COLORS.ink, textTransform:'uppercase', letterSpacing:'0.06em' }}>{grupo.label}</span>
            <span style={{ fontSize:11, color:COLORS.slate500 }}>· {grupo.descripcion}</span>
          </div>
          <div style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, overflow:'hidden' }}>
            {grupo.categorias.map((k, i) => {
              const meta = ETIQUETAS_ALERTAS[k]
              const activo = Boolean(config[k])
              return (
                <div key={k} style={{
                  display:'flex', alignItems:'center', gap:14,
                  padding:'14px 18px',
                  borderTop: i === 0 ? 'none' : `1px solid ${COLORS.slate100}`,
                }}>
                  <span style={{ display:'flex', alignItems:'center', justifyContent:'center', width:32, height:32, borderRadius:8, background:COLORS.slate50, color:COLORS.navy, flexShrink:0 }}>
                    <IconAlerta categoria={k} size={16}/>
                  </span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:500, color:COLORS.ink }}>{meta?.label || k}</div>
                    <div style={{ fontSize:11, color:COLORS.slate500, marginTop:2 }}>{meta?.descripcion || ''}</div>
                  </div>
                  <ToggleSwitch checked={activo} onChange={() => toggle(k)} disabled={saving} color={grupo.color}/>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:24, gap:12, flexWrap:'wrap' }}>
        <button onClick={restaurarDefaults} disabled={saving} style={{
          padding:'10px 16px', background:'transparent', border:`1px solid ${COLORS.slate200}`,
          color:COLORS.slate600, borderRadius:8, fontSize:12, fontWeight:500, cursor: saving ? 'wait' : 'pointer',
        }}>Restaurar defaults del rol</button>
        <div style={{ display:'flex', gap:10 }}>
          {dirty && (
            <button onClick={cancelar} disabled={saving} style={{
              padding:'10px 18px', background:'transparent', border:`1px solid ${COLORS.slate200}`,
              borderRadius:8, fontSize:13, cursor: saving ? 'wait' : 'pointer',
            }}>Cancelar</button>
          )}
          <button onClick={guardar} disabled={!dirty || saving} style={{
            padding:'10px 22px',
            background: dirty ? COLORS.navy : COLORS.slate200,
            color:'white', border:'none', borderRadius:8, fontSize:13, fontWeight:600,
            cursor: (!dirty || saving) ? 'not-allowed' : 'pointer',
          }}>{saving ? 'Guardando...' : 'Guardar cambios'}</button>
        </div>
      </div>
    </div>
  )
}

function ToggleSwitch({ checked, onChange, disabled, color }) {
  const onColor = color || COLORS.teal
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      disabled={disabled}
      style={{
        width:42, height:24, minWidth:42,
        background: checked ? onColor : COLORS.slate200,
        border:'none', borderRadius:999,
        position:'relative', cursor: disabled ? 'wait' : 'pointer',
        transition:'background 0.18s', flexShrink:0, padding:0,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <span style={{
        position:'absolute', top:2, left: checked ? 20 : 2,
        width:20, height:20, borderRadius:'50%',
        background:'white', boxShadow:'0 1px 3px rgba(0,0,0,0.2)',
        transition:'left 0.18s',
      }}/>
    </button>
  )
}
// ============================================================
// v18.8.0 — TAB HORAS: asignación masiva de horas estimadas
// Las actividades vienen de plantillas → el mismo nombre se repite en muchos
// proyectos. Acá se asignan horas por nombre (aplica a todas) o un default
// global a las que no tienen. Las horas alimentan la carga en Dashboard→Personas.
// ============================================================
function TabHoras() {
  const [resumen, setResumen] = useState([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [edits, setEdits] = useState({})        // nombre -> valor del input
  const [defaultGlobal, setDefaultGlobal] = useState('')
  const [aplicando, setAplicando] = useState(null)

  const cargar = async () => {
    setCargando(true)
    setResumen(await getResumenHorasActividades())
    setCargando(false)
  }
  useEffect(() => { cargar() }, [])

  const filtradas = useMemo(() => {
    if (!busqueda.trim()) return resumen
    const q = busqueda.toLowerCase()
    return resumen.filter(r => r.nombre.toLowerCase().includes(q))
  }, [resumen, busqueda])

  const sinHoras = resumen.filter(r => r.horas === null || r.horas === 'varias').reduce((s, r) => s + r.total, 0)

  const aplicar = async (nombre) => {
    const v = parseInt(edits[nombre])
    if (isNaN(v) || v < 0) { toast('Pon un número de horas válido', 'error'); return }
    setAplicando(nombre)
    try {
      const n = await aplicarHorasPorNombre(nombre, v)
      toast(`✓ ${v}h aplicadas a ${n} actividad(es)`, 'success')
      setEdits(prev => ({ ...prev, [nombre]: '' }))
      cargar()
    } catch (e) { toast('Error: ' + e.message, 'error') }
    setAplicando(null)
  }

  const aplicarDefault = async () => {
    const v = parseInt(defaultGlobal)
    if (isNaN(v) || v < 0) { toast('Pon un número de horas válido', 'error'); return }
    setAplicando('__global__')
    try {
      const n = await asignarHorasFaltantes(v)
      toast(`✓ ${v}h asignadas a ${n} actividad(es) que no tenían horas`, 'success')
      setDefaultGlobal('')
      cargar()
    } catch (e) { toast('Error: ' + e.message, 'error') }
    setAplicando(null)
  }

  return (
    <div>
      <div style={{ marginBottom:16 }}>
        <h3 style={{ fontSize:14, fontWeight:600, color:COLORS.ink, margin:0 }}>Horas estimadas por actividad</h3>
        <p style={{ fontSize:12, color:COLORS.slate500, marginTop:4 }}>
          Define cuántas horas de esfuerzo real toma cada tipo de actividad. Se aplica a <strong>todas las actividades con ese nombre en todos los proyectos</strong> y alimenta la carga de trabajo en Dashboard → Personas (sin horas, el cálculo asume 8h/día y dispara sobrecargas).
        </p>
      </div>

      {/* Default global para las que no tienen horas */}
      <div style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, padding:16, marginBottom:16, display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
        <div style={{ flex:1, minWidth:220 }}>
          <div style={{ fontSize:13, fontWeight:600, color:COLORS.ink }}>Asignar default a las que no tienen horas</div>
          <div style={{ fontSize:11, color:COLORS.slate500, marginTop:2 }}>Aplica solo a actividades sin horas definidas (no pisa las ya configuradas).</div>
        </div>
        <input type="number" min="0" step="1" value={defaultGlobal} onChange={e => setDefaultGlobal(e.target.value)} placeholder="horas" style={{ ...inputStyle, width:90, margin:0 }}/>
        <button onClick={aplicarDefault} disabled={aplicando === '__global__'} style={{ padding:'10px 18px', background:COLORS.navy, color:'white', border:'none', borderRadius:8, fontSize:12, fontWeight:600, cursor:'pointer' }}>
          {aplicando === '__global__' ? 'Aplicando...' : 'Asignar'}
        </button>
      </div>

      <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:12 }}>
        <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar actividad..." style={{ ...inputStyle, width:280, margin:0, padding:'8px 12px' }}/>
        <span style={{ fontSize:11, color:COLORS.slate500 }}>{filtradas.length} tipo(s) de actividad · {sinHoras > 0 ? `${sinHoras} actividades en grupos sin horas uniformes` : 'todas con horas'}</span>
      </div>

      {cargando && <div style={{ padding:40, textAlign:'center', color:COLORS.slate400 }}>Cargando...</div>}

      {!cargando && (
        <div style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, overflow:'hidden' }}>
          <div style={{ display:'grid', gridTemplateColumns:'minmax(0,1fr) 90px 90px 170px', padding:'10px 16px', borderBottom:`1px solid ${COLORS.slate100}`, fontSize:10, fontWeight:700, color:COLORS.slate500, textTransform:'uppercase', letterSpacing:'0.04em', gap:8 }}>
            <span>Actividad</span><span>Repeticiones</span><span>Horas hoy</span><span>Asignar horas</span>
          </div>
          {filtradas.slice(0, 200).map(r => (
            <div key={r.nombre} style={{ display:'grid', gridTemplateColumns:'minmax(0,1fr) 90px 90px 170px', padding:'10px 16px', borderBottom:`1px solid ${COLORS.slate100}`, alignItems:'center', fontSize:13, gap:8 }}>
              <div style={{ color:COLORS.ink, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={r.nombre}>{r.nombre}</div>
              <div style={{ fontFamily:'var(--font-mono)', fontSize:12, color:COLORS.slate500 }}>{r.total}</div>
              <div style={{ fontFamily:'var(--font-mono)', fontSize:12, fontWeight:600, color: r.horas === null ? COLORS.slate400 : r.horas === 'varias' ? COLORS.amber : COLORS.teal }}>
                {r.horas === null ? '—' : r.horas === 'varias' ? 'varias' : `${r.horas}h`}
              </div>
              <div style={{ display:'flex', gap:6 }}>
                <input type="number" min="0" step="1" value={edits[r.nombre] ?? ''} onChange={e => setEdits(prev => ({ ...prev, [r.nombre]: e.target.value }))} placeholder="h" style={{ ...inputStyle, width:64, margin:0, padding:'6px 8px', minHeight:32, fontSize:12 }}/>
                <button onClick={() => aplicar(r.nombre)} disabled={aplicando === r.nombre || (edits[r.nombre] ?? '') === ''} style={{ padding:'6px 12px', background: (edits[r.nombre] ?? '') === '' ? COLORS.slate200 : COLORS.teal, color:'white', border:'none', borderRadius:6, fontSize:11, fontWeight:600, cursor:'pointer' }}>
                  {aplicando === r.nombre ? '...' : 'Aplicar'}
                </button>
              </div>
            </div>
          ))}
          {filtradas.length > 200 && <div style={{ padding:'10px 16px', fontSize:11, color:COLORS.slate500, fontStyle:'italic' }}>Mostrando 200 de {filtradas.length} — usa la búsqueda para encontrar el resto.</div>}
          {filtradas.length === 0 && <div style={{ padding:40, textAlign:'center', color:COLORS.slate400, fontSize:13 }}>Sin resultados</div>}
        </div>
      )}
    </div>
  )
}
