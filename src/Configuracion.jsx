import { useState, useEffect } from 'react'
import {
  getTodosUsuarios, getClientes,
  crearUsuario, actualizarUsuario, eliminarUsuario,
  desactivarUsuario, activarUsuario, cambiarRolUsuario,
} from './supabase'
import { COLORS, Avatar, Icon } from './helpers'
import { useModal } from './Modal'
import {
  PERMISOS_POR_ROL, ROLES_DISPONIBLES,
  puedeGestionarUsuarios, labelRol, descripcionRol, modulosPermitidos
} from './permisos'

// ============================================================
// v12.5.6: Configuración con gestión de usuarios (solo direccion)
// v12.5.6c2: rol ahora es dropdown en lugar de texto libre
// ============================================================

// Construir opciones para el dropdown de roles a partir de la matriz
const OPCIONES_ROL = ROLES_DISPONIBLES.map(r => ({
  value: r,
  label: `${PERMISOS_POR_ROL[r].label} — ${PERMISOS_POR_ROL[r].descripcion}`,
}))

export default function Configuracion({ usuario }) {
  const puedeGestionar = puedeGestionarUsuarios(usuario)
  const [tab, setTab] = useState(puedeGestionar ? 'usuarios' : 'sistema')
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
    ...(puedeGestionar ? [{ k:'usuarios', l:'Usuarios' }] : []),
    { k:'clientes', l:'Clientes' },
    { k:'sistema', l:'Sistema' },
  ]

  return (
    <div>
      <modal.Render/>

      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontSize:32, fontWeight:400, color:COLORS.navy, margin:0, letterSpacing:'-0.02em', fontFamily:'var(--font-serif)' }}>Configuración</h1>
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

      {tab === 'usuarios' && puedeGestionar && (
        <TabUsuarios usuarios={usuarios} usuarioActual={usuario} modal={modal} recargar={recargar}/>
      )}

      {tab === 'clientes' && <TabClientes clientes={clientes}/>}
      {tab === 'sistema' && <TabSistema usuario={usuario}/>}
    </div>
  )
}

// ============================================================
// TAB USUARIOS
// ============================================================
function TabUsuarios({ usuarios, usuarioActual, modal, recargar }) {

  const abrirModalCrear = async () => {
    const resultado = await modal.editor({
      titulo: 'Nuevo usuario',
      mensaje: 'Los permisos se asignan automáticamente según el rol. El usuario deberá ser invitado a Supabase Auth por separado para poder iniciar sesión.',
      icono: 'Plus',
      textoBoton: 'Crear usuario',
      campos: [
        { key: 'nombre',   label: 'Nombre completo', tipo: 'text',   required: true, placeholder: 'Ej: Juan Pérez' },
        { key: 'email',    label: 'Email',            tipo: 'text',   required: true, placeholder: 'juan@row.energy' },
        { key: 'rol',      label: 'Rol',              tipo: 'select', required: true, defaultValue: 'ventas', opciones: OPCIONES_ROL },
        { key: 'telefono', label: 'Teléfono',         tipo: 'text',   placeholder: 'Opcional' },
        { key: 'capacidad_horas_semana', label: 'Capacidad horas/semana', tipo: 'number', defaultValue: 40 },
      ],
    })
    if (!resultado) return

    try {
      await crearUsuario({
        nombre: resultado.nombre,
        email: resultado.email,
        rol: resultado.rol,
        telefono: resultado.telefono,
        capacidad_horas_semana: resultado.capacidad_horas_semana,
      })
      recargar()
    } catch (err) {
      await modal.alert({ titulo: 'Error al crear usuario', mensaje: err.message || String(err), icono: 'Alert' })
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
      // Si el rol cambió, usar cambiarRolUsuario (respeta reglas duras)
      if (resultado.rol !== u.rol) {
        await cambiarRolUsuario(u.id, resultado.rol, usuarioActual.id)
      }
      // Actualizar los demás campos
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
      if (u.activo) {
        await desactivarUsuario(u.id, usuarioActual.id)
      } else {
        await activarUsuario(u.id)
      }
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

  const esYo = (u) => u.id === usuarioActual.id

  return (
    <>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <div>
          <h3 style={{ fontSize:14, fontWeight:600, color:COLORS.ink, margin:0 }}>Equipo ({usuarios.length})</h3>
          <div style={{ fontSize:11, color:COLORS.slate500, marginTop:2 }}>
            {usuarios.filter(u => u.activo).length} activos · {usuarios.filter(u => !u.activo).length} inactivos
          </div>
        </div>
        <button onClick={abrirModalCrear} style={{
          padding:'10px 18px', background:COLORS.navy, color:'white',
          border:'none', borderRadius:8, fontSize:13, fontWeight:600,
          cursor:'pointer', display:'inline-flex', alignItems:'center', gap:6,
        }}>
          {Icon('Plus')} Agregar usuario
        </button>
      </div>

      <div style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, overflow:'hidden', marginBottom:20 }}>
        {usuarios.length === 0 && (
          <div style={{ padding:40, textAlign:'center', color:COLORS.slate400, fontSize:13 }}>Sin usuarios</div>
        )}
        {usuarios.map(u => (
          <div key={u.id} style={{
            display:'grid',
            gridTemplateColumns:'40px 1fr 160px 130px 90px auto',
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
            <div style={{ fontSize:11, fontWeight:600, color: u.activo ? COLORS.teal : COLORS.slate400 }}>
              {u.activo ? '✓ Activo' : '○ Inactivo'}
            </div>
            <div style={{ display:'flex', gap:4 }}>
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
            </div>
          </div>
        ))}
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
function TabClientes({ clientes }) {
  return (
    <div style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, overflow:'hidden' }}>
      <div style={{ padding:'14px 20px', borderBottom:`1px solid ${COLORS.slate100}`, fontSize:13, fontWeight:600, color:COLORS.ink }}>
        Clientes ({clientes.length})
      </div>
      {clientes.length === 0 && (
        <div style={{ padding:40, textAlign:'center', color:COLORS.slate400, fontSize:13 }}>Sin clientes</div>
      )}
      {clientes.map(c => (
        <div key={c.id} style={{ display:'grid', gridTemplateColumns:'80px 1fr 180px 160px 140px', padding:'12px 20px', borderBottom:`1px solid ${COLORS.slate100}`, alignItems:'center', fontSize:13 }}>
          <span style={{ fontSize:11, fontFamily:'var(--font-mono)', color:COLORS.slate500, fontWeight:600 }}>{c.codigo}</span>
          <div>
            <div style={{ fontWeight:500, color:COLORS.ink }}>{c.razon_social}</div>
            <div style={{ fontSize:11, color:COLORS.slate500 }}>{c.rfc || '—'}</div>
          </div>
          <div style={{ fontSize:12, color:COLORS.slate600 }}>{c.contacto_nombre || '—'}</div>
          <div style={{ fontSize:11, color:COLORS.slate500 }}>{c.contacto_email || '—'}</div>
          <div style={{ fontSize:11, color:COLORS.slate500 }}>{c.industria || '—'}</div>
        </div>
      ))}
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
        <InfoRow label="Versión" valor="Row Energy OS 1.0 (v12.5.6)"/>
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