import { useState, useRef, useEffect, useMemo, useCallback } from 'react'

// ============================================================
// DATOS Y CONSTANTES
// ============================================================
const COLABORADORES = [
  { nombre:'Malio Martinez', rol:'Dirección General', email:'mmartinez@row.energy' },
  { nombre:'Carlos Mendez', rol:'Director de Proyectos', email:'cmendez@row.energy' },
  { nombre:'Sofia Ruiz', rol:'Proyectos Sr', email:'sruiz@row.energy' },
  { nombre:'Luis Reyes', rol:'Proyectos', email:'lreyes@row.energy' },
  { nombre:'Ana Torres', rol:'Proyectos', email:'atorres@row.energy' },
  { nombre:'Pedro Ruiz', rol:'Proyectos Jr', email:'pruiz@row.energy' },
  { nombre:'Laura Gutiérrez', rol:'Ventas', email:'lgutierrez@row.energy' },
]

const NOMBRES = COLABORADORES.map(c => c.nombre)

// Feriados oficiales México 2026
const FERIADOS_MX = ['2026-01-01','2026-02-02','2026-03-16','2026-05-01','2026-09-16','2026-11-16','2026-12-25']

const COLORS = {
  navy:'#0A2540', navy2:'#1B3A6B', teal:'#0F6E56', tealLight:'#E1F5EE',
  gold:'#C89B3C', red:'#DC2626', amber:'#D97706', purple:'#6B4C9A',
  slate50:'#F8FAFC', slate100:'#F1F5F9', slate200:'#E2E8F0',
  slate400:'#94A3B8', slate500:'#64748B', slate600:'#475569', ink:'#1C2128',
}

const ESTADOS = {
  'Completada':  { bg:'#E1F5EE', color:'#0F6E56', bar:'#0F6E56' },
  'En progreso': { bg:'#E0EDFF', color:'#1B3A6B', bar:'#1B3A6B' },
  'Sin iniciar': { bg:'#F1F5F9', color:'#64748B', bar:'#94A3B8' },
  'Retrasada':   { bg:'#FEF2F2', color:'#DC2626', bar:'#DC2626' },
  'Bloqueada':   { bg:'#FEF3C7', color:'#D97706', bar:'#D97706' },
}

const ESTADOS_PROY = {
  'En curso':    { bg:'#E0EDFF', color:'#1B3A6B', bar:'#1B3A6B' },
  'Terminado':   { bg:'#E1F5EE', color:'#0F6E56', bar:'#0F6E56' },
  'Por iniciar': { bg:'#FEF3C7', color:'#D97706', bar:'#D97706' },
  'En pausa':    { bg:'#FEF2F2', color:'#DC2626', bar:'#DC2626' },
}

const PRIORIDADES = {
  'Alta':  { color:'#DC2626', bg:'#FEF2F2' },
  'Media': { color:'#D97706', bg:'#FEF3C7' },
  'Baja':  { color:'#0F6E56', bg:'#E1F5EE' },
}

// Tipos dependencia: FS=Finish-to-Start (default), SS=Start-to-Start, FF=Finish-to-Finish, SF=Start-to-Finish
const TIPOS_DEP = {
  'FS': { label:'Fin → Inicio', desc:'La sucesora inicia cuando termina la predecesora' },
  'SS': { label:'Inicio → Inicio', desc:'Ambas inician al mismo tiempo' },
  'FF': { label:'Fin → Fin', desc:'Ambas terminan al mismo tiempo' },
  'SF': { label:'Inicio → Fin', desc:'La sucesora termina cuando inicia la predecesora' },
}

// ============================================================
// DATOS DEMO — ROW ENERGY
// ============================================================
const PROYECTOS_INICIALES = [
  {
    id: 'PRY-001',
    nombre: 'Gestión CENACE — Parque Solar Querétaro 50 MW',
    cliente: 'Intel México',
    director: 'Carlos Mendez',
    equipo: ['Carlos Mendez', 'Sofia Ruiz', 'Luis Reyes'],
    estado: 'En curso',
    inicio: '2026-02-01',
    cierre: '2026-09-30',
    alcance: 'Servicios integrales de consultoría y gestoría ante CENACE y CFE para la interconexión de Central Eléctrica de 50 MW al Sistema Eléctrico Nacional. Incluye permiso CNE, estudios de impacto, instalaciones, contrato de interconexión, modelados matemáticos, pruebas Código de Red y operación comercial.',
    camposCustom: { 'Ubicación': 'Querétaro, MX', 'Tipo de central': 'Solar fotovoltaica', 'Capacidad': '50 MW', 'Punto de conexión': 'SE El Marqués 115 kV' },
    actividades: [
      { id:1, nombre:'Permiso de Generación ante CNE', fase:'Servicio 1 — Permiso CNE', responsable:'Carlos Mendez', inicio:'2026-02-01', fin:'2026-03-15', avance:100, estado:'Completada', deps:[], completada:true, notas:'Folio de recepción recibido sin observaciones', parentId:null, esMilestone:false, prioridad:'Alta', tags:['CNE','Regulatorio'], horasEstimadas:120, horasReales:115, checklist:[{id:1,texto:'Pre-registro OPE CNE',hecho:true},{id:2,texto:'Expediente corporativo',hecho:true},{id:3,texto:'Plan de negocios',hecho:true},{id:4,texto:'Descripción técnica',hecho:true},{id:5,texto:'Seguimiento ante CNE',hecho:true}], comentarios:[{id:1,autor:'Carlos Mendez',fecha:'2026-03-10',texto:'Folio aprobado sin observaciones. Copia al cliente.'}], adjuntos:[{id:1,nombre:'Folio_CNE_50MW.pdf',size:'2.3 MB'}], historial:[{id:1,fecha:'2026-03-15',autor:'Carlos Mendez',accion:'Marcó como completada'}] },
      { id:2, nombre:'Estudio de Impacto', fase:'Servicio 2 — Estudios', responsable:'Sofia Ruiz', inicio:'2026-03-01', fin:'2026-04-20', avance:100, estado:'Completada', deps:[], completada:true, notas:'', parentId:null, esMilestone:false, prioridad:'Alta', tags:['CENACE','Estudios'], horasEstimadas:180, horasReales:195, checklist:[{id:1,texto:'Elaboración Anexo IV',hecho:true},{id:2,texto:'Diagrama geográfico y unifilar',hecho:true},{id:3,texto:'Envío a CENACE por SIASIC',hecho:true},{id:4,texto:'Gestión de pagos SIASIC',hecho:true},{id:5,texto:'Reuniones con CENACE',hecho:true}], comentarios:[], adjuntos:[], historial:[] },
      { id:3, nombre:'Estudio de Instalaciones', fase:'Servicio 3 — Estudios', responsable:'Sofia Ruiz', inicio:'2026-04-21', fin:'2026-05-30', avance:75, estado:'En progreso', deps:[{id:2,tipo:'FS',lag:0}], completada:false, notas:'Avance 75%. Esperando respuesta a última solicitud CENACE', parentId:null, esMilestone:false, prioridad:'Alta', tags:['CENACE','Estudios'], horasEstimadas:160, horasReales:120, checklist:[{id:1,texto:'Integración información',hecho:true},{id:2,texto:'Envío por SIASIC',hecho:true},{id:3,texto:'Atención a requerimientos',hecho:false},{id:4,texto:'Reunión cierre con CENACE',hecho:false}], comentarios:[{id:1,autor:'Sofia Ruiz',fecha:'2026-04-25',texto:'@Carlos Mendez enviado. Esperando primera revisión.'}], adjuntos:[], historial:[] },
      { id:4, nombre:'Contrato de Interconexión con CFE', fase:'Servicio 4 — Contrato', responsable:'Carlos Mendez', inicio:'2026-05-31', fin:'2026-06-30', avance:30, estado:'En progreso', deps:[{id:3,tipo:'FS',lag:0}], completada:false, notas:'', parentId:null, esMilestone:false, prioridad:'Alta', tags:['CFE','Contrato'], horasEstimadas:100, horasReales:35, checklist:[{id:1,texto:'Solicitud por SIASIC',hecho:true},{id:2,texto:'Coordinación CFE',hecho:false},{id:3,texto:'Firma del contrato',hecho:false}], comentarios:[], adjuntos:[], historial:[] },
      { id:5, nombre:'Modelados Matemáticos', fase:'Servicio 5 — Modelados', responsable:'Luis Reyes', inicio:'2026-06-01', fin:'2026-07-31', avance:0, estado:'Sin iniciar', deps:[{id:4,tipo:'FS',lag:0}], completada:false, notas:'Actividad padre', parentId:null, esMilestone:false, prioridad:'Media', tags:['Modelados'], horasEstimadas:0, horasReales:0, checklist:[], comentarios:[], adjuntos:[], historial:[] },
      { id:6, nombre:'Modelo matemático EMTP', fase:'Servicio 5 — Modelados', responsable:'Luis Reyes', inicio:'2026-06-01', fin:'2026-06-30', avance:0, estado:'Sin iniciar', deps:[{id:4,tipo:'FS',lag:0}], completada:false, notas:'', parentId:5, esMilestone:false, prioridad:'Media', tags:['EMTP'], horasEstimadas:80, horasReales:0, checklist:[], comentarios:[], adjuntos:[], historial:[] },
      { id:7, nombre:'Modelo matemático PSSe V35', fase:'Servicio 5 — Modelados', responsable:'Luis Reyes', inicio:'2026-07-01', fin:'2026-07-31', avance:0, estado:'Sin iniciar', deps:[{id:6,tipo:'FS',lag:0}], completada:false, notas:'', parentId:5, esMilestone:false, prioridad:'Media', tags:['PSSe'], horasEstimadas:80, horasReales:0, checklist:[], comentarios:[], adjuntos:[], historial:[] },
      { id:8, nombre:'Requerimientos Puesta en Servicio', fase:'Servicio 6 — Puesta en servicio', responsable:'Carlos Mendez', inicio:'2026-08-01', fin:'2026-08-15', avance:0, estado:'Sin iniciar', deps:[{id:7,tipo:'FS',lag:0}], completada:false, notas:'', parentId:null, esMilestone:false, prioridad:'Media', tags:['Puesta en servicio'], horasEstimadas:60, horasReales:0, checklist:[], comentarios:[], adjuntos:[], historial:[] },
      { id:9, nombre:'Pruebas del Código de Red', fase:'Servicio 7 — Pruebas', responsable:'Sofia Ruiz', inicio:'2026-08-16', fin:'2026-09-15', avance:0, estado:'Sin iniciar', deps:[{id:8,tipo:'FS',lag:0}], completada:false, notas:'', parentId:null, esMilestone:false, prioridad:'Alta', tags:['Código de Red'], horasEstimadas:140, horasReales:0, checklist:[], comentarios:[], adjuntos:[], historial:[] },
      { id:10, nombre:'Entrega y Operación Comercial', fase:'Servicio 8 — Operación', responsable:'Carlos Mendez', inicio:'2026-09-30', fin:'2026-09-30', avance:0, estado:'Sin iniciar', deps:[{id:9,tipo:'FS',lag:0}], completada:false, notas:'Hito de entrega al cliente', parentId:null, esMilestone:true, prioridad:'Alta', tags:['Entrega'], horasEstimadas:8, horasReales:0, checklist:[], comentarios:[], adjuntos:[], historial:[] },
    ],
    baseline: null,
  },
  {
    id: 'PRY-002',
    nombre: 'Estudio de Impacto — Ascenty Data Center',
    cliente: 'Ascenty',
    director: 'Sofia Ruiz',
    equipo: ['Sofia Ruiz'],
    estado: 'Terminado',
    inicio: '2026-01-10',
    cierre: '2026-03-15',
    alcance: 'Estudio de Impacto y Anexo IV para interconexión de centro de carga de 15 MW ante CENACE.',
    camposCustom: { 'Ubicación': 'Querétaro, MX', 'Tipo': 'Centro de carga', 'Capacidad': '15 MW' },
    actividades: [
      { id:1, nombre:'Elaboración Anexo IV', fase:'Fase 1', responsable:'Sofia Ruiz', inicio:'2026-01-10', fin:'2026-02-01', avance:100, estado:'Completada', deps:[], completada:true, notas:'', parentId:null, esMilestone:false, prioridad:'Alta', tags:[], horasEstimadas:100, horasReales:95, checklist:[], comentarios:[], adjuntos:[], historial:[] },
      { id:2, nombre:'Envío y seguimiento CENACE', fase:'Fase 2', responsable:'Sofia Ruiz', inicio:'2026-02-02', fin:'2026-03-01', avance:100, estado:'Completada', deps:[{id:1,tipo:'FS',lag:0}], completada:true, notas:'', parentId:null, esMilestone:false, prioridad:'Media', tags:[], horasEstimadas:60, horasReales:55, checklist:[], comentarios:[], adjuntos:[], historial:[] },
      { id:3, nombre:'Reporte y entrega al cliente', fase:'Fase 3', responsable:'Sofia Ruiz', inicio:'2026-03-02', fin:'2026-03-15', avance:100, estado:'Completada', deps:[{id:2,tipo:'FS',lag:0}], completada:true, notas:'', parentId:null, esMilestone:false, prioridad:'Alta', tags:[], horasEstimadas:40, horasReales:42, checklist:[], comentarios:[], adjuntos:[], historial:[] },
    ],
    baseline: null,
  },
]

// ============================================================
// UTILIDADES DE FECHAS
// ============================================================
const toDate = (s) => new Date(s + 'T00:00:00')
const toStr = (d) => d.toISOString().split('T')[0]
const addDays = (s, n) => { const d = toDate(s); d.setDate(d.getDate()+n); return toStr(d) }
const diffDays = (a, b) => Math.round((toDate(b) - toDate(a)) / 86400000)
const esFinDeSemana = (fecha) => { const d = toDate(fecha).getDay(); return d === 0 || d === 6 }
const esFeriado = (fecha) => FERIADOS_MX.includes(fecha)
const esNoLaboral = (fecha) => esFinDeSemana(fecha) || esFeriado(fecha)

// Cascada con 4 tipos de dependencias y lag
function recalcularCascada(actividades, idCambiada, ignorarIds=new Set()) {
  const copia = actividades.map(a => ({...a}))
  const byId = Object.fromEntries(copia.map(a => [a.id, a]))
  const cola = [idCambiada]
  const visitados = new Set()

  while (cola.length > 0) {
    const actualId = cola.shift()
    if (visitados.has(actualId)) continue
    visitados.add(actualId)

    copia.forEach(suc => {
      if (!suc.deps || suc.deps.length === 0) return
      if (ignorarIds.has(suc.id)) return

      // Calcular fechas requeridas por cada dependencia
      let nuevoInicio = null
      let nuevoFin = null

      suc.deps.forEach(dep => {
        const pred = byId[dep.id]
        if (!pred) return
        const lag = dep.lag || 0
        const tipo = dep.tipo || 'FS'

        let reqInicio = null
        let reqFin = null

        if (tipo === 'FS') reqInicio = addDays(pred.fin, 1 + lag)
        else if (tipo === 'SS') reqInicio = addDays(pred.inicio, lag)
        else if (tipo === 'FF') reqFin = addDays(pred.fin, lag)
        else if (tipo === 'SF') reqFin = addDays(pred.inicio, lag)

        if (reqInicio && (!nuevoInicio || toDate(reqInicio) > toDate(nuevoInicio))) nuevoInicio = reqInicio
        if (reqFin && (!nuevoFin || toDate(reqFin) > toDate(nuevoFin))) nuevoFin = reqFin
      })

      const duracion = diffDays(suc.inicio, suc.fin)
      let cambio = false

      if (nuevoInicio && toDate(nuevoInicio) > toDate(suc.inicio)) {
        suc.inicio = nuevoInicio
        suc.fin = addDays(nuevoInicio, duracion)
        cambio = true
      } else if (nuevoFin && toDate(nuevoFin) > toDate(suc.fin)) {
        suc.fin = nuevoFin
        suc.inicio = addDays(nuevoFin, -duracion)
        cambio = true
      }

      if (cambio) cola.push(suc.id)
    })
  }
  return copia
}

function detectarAlertas(actividades) {
  const alertas = []
  const byId = Object.fromEntries(actividades.map(a => [a.id, a]))
  actividades.forEach(a => {
    if (!a.deps || a.deps.length === 0 || a.completada) return
    a.deps.forEach(dep => {
      const pred = byId[dep.id]
      if (!pred) return
      const lag = dep.lag || 0
      const tipo = dep.tipo || 'FS'
      let reqInicio = null
      if (tipo === 'FS') reqInicio = addDays(pred.fin, 1 + lag)
      else if (tipo === 'SS') reqInicio = addDays(pred.inicio, lag)

      if (reqInicio && toDate(a.inicio) < toDate(reqInicio)) {
        alertas.push({ actividad:a, predecesora:pred, deberiaIniciar:reqInicio, tipo })
      }
    })
  })
  return alertas
}

function calcularRutaCritica(actividades) {
  const copia = actividades.map(a => ({...a, es:0, ls:0, ef:0, lf:0}))
  const byId = Object.fromEntries(copia.map(a => [a.id, a]))

  const calcES = (a, visitando=new Set()) => {
    if (visitando.has(a.id)) return
    visitando.add(a.id)
    if (!a.deps || a.deps.length === 0) {
      a.es = toDate(a.inicio).getTime()
    } else {
      a.es = Math.max(...a.deps.map(dep => {
        const p = byId[dep.id]
        if (!p) return toDate(a.inicio).getTime()
        calcES(p, visitando)
        return p.ef
      }))
    }
    a.ef = a.es + diffDays(a.inicio, a.fin) * 86400000
  }
  copia.forEach(a => calcES(a))
  const projectFinish = Math.max(...copia.map(a => a.ef))

  const calcLF = (a, visitando=new Set()) => {
    if (visitando.has(a.id)) return
    visitando.add(a.id)
    const sucesoras = copia.filter(s => s.deps?.some(d => d.id === a.id))
    if (sucesoras.length === 0) a.lf = projectFinish
    else a.lf = Math.min(...sucesoras.map(s => { calcLF(s, visitando); return s.ls }))
    a.ls = a.lf - diffDays(a.inicio, a.fin) * 86400000
  }
  copia.slice().reverse().forEach(a => calcLF(a))

  const criticos = new Set()
  copia.forEach(a => { if (Math.abs(a.ls - a.es) < 86400000) criticos.add(a.id) })
  return criticos
}

// Rollup: padres calculan fechas y avance de hijos
function aplicarRollup(actividades) {
  const copia = actividades.map(a => ({...a}))
  copia.forEach(padre => {
    const hijos = copia.filter(c => c.parentId === padre.id)
    if (hijos.length === 0) return
    padre.inicio = hijos.reduce((min, h) => toDate(h.inicio) < toDate(min) ? h.inicio : min, hijos[0].inicio)
    padre.fin = hijos.reduce((max, h) => toDate(h.fin) > toDate(max) ? h.fin : max, hijos[0].fin)
    // Avance ponderado por duración
    const totalDias = hijos.reduce((s, h) => s + diffDays(h.inicio, h.fin) + 1, 0)
    padre.avance = totalDias > 0 ? Math.round(hijos.reduce((s, h) => s + h.avance * (diffDays(h.inicio, h.fin) + 1), 0) / totalDias) : 0
    padre.completada = hijos.every(h => h.completada)
  })
  return copia
}

// ============================================================
// ICONOS
// ============================================================
const Icon = {
  Info:()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>,
  Edit:()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>,
  Trash:()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
  Plus:()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>,
  Chevron:({open})=><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{transform: open?'rotate(0deg)':'rotate(-90deg)',transition:'transform 0.15s'}}><path d="m6 9 6 6 6-6"/></svg>,
  ChevronR:()=><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>,
  Check:()=><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>,
  X:()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>,
  Back:()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>,
  Dots:()=><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>,
  Copy:()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>,
  Link:()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
  Lock:()=><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  Indent:()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8h18M3 4h18M9 16h12M5 12h16M5 20h16"/></svg>,
  Diamond:()=><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2 22 12 12 22 2 12z"/></svg>,
  Alert:()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4M12 17h.01"/></svg>,
  Flag:()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/></svg>,
  Search:()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>,
  Filter:()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>,
  Undo:()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6.7 2.3L3 13"/></svg>,
  Redo:()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6.7 2.3L21 13"/></svg>,
  Clock:()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  Paperclip:()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 17.93 8.83l-8.58 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>,
  Message:()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  History:()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/><path d="M12 7v5l4 2"/></svg>,
  Calendar:()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>,
  Users:()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  Download:()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>,
  Print:()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>,
  Tag:()=><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" x2="7.01" y1="7" y2="7"/></svg>,
  Zap:()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  Bars:()=><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
}

// ============================================================
// COMPONENTES BASE
// ============================================================
function Badge({ texto, mapa, tamano=11 }) {
  const c = mapa[texto] || { bg:'#F1F5F9', color:'#64748B' }
  return <span style={{ display:'inline-flex', alignItems:'center', fontSize:tamano, fontWeight:500, padding:'3px 10px', borderRadius:20, background:c.bg, color:c.color, letterSpacing:'-0.01em', whiteSpace:'nowrap' }}>{texto}</span>
}

function BarraAvance({ avance, color=COLORS.navy2, height=5 }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:100 }}>
      <div style={{ flex:1, height, background:'#EEF2F6', borderRadius:height/2, overflow:'hidden' }}>
        <div style={{ width:`${avance}%`, height:'100%', background: avance === 100 ? COLORS.teal : color, borderRadius:height/2, transition:'width 0.3s ease' }}/>
      </div>
      <span style={{ fontSize:11, fontWeight:600, color: avance === 100 ? COLORS.teal : color, minWidth:32, fontFamily:'var(--font-mono)' }}>{avance}%</span>
    </div>
  )
}

function Avatar({ nombre, size=28 }) {
  const iniciales = nombre?.split(' ').map(n=>n[0]).slice(0,2).join('').toUpperCase() || '?'
  const colors = ['#1B3A6B', '#0F6E56', '#C89B3C', '#6B4C9A', '#D97706', '#DC2626']
  const color = colors[(nombre?.length || 0) % colors.length]
  return <div style={{ width:size, height:size, borderRadius:'50%', background:color, color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontSize:size*0.38, fontWeight:600, flexShrink:0, letterSpacing:'-0.02em' }}>{iniciales}</div>
}

function IconBtn({ onClick, title, children, color=COLORS.slate500, active=false }) {
  const [hover, setHover] = useState(false)
  return (
    <button onClick={(e) => { e.stopPropagation(); onClick(e) }} title={title}
      onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)}
      style={{ width:26, height:26, borderRadius:6, border:'none', background: (hover||active) ? '#EEF2F6' : 'transparent', color: (hover||active) ? COLORS.navy : color, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', padding:0, transition:'all 0.15s', flexShrink:0 }}>
      {children}
    </button>
  )
}

function EditableText({ value, onChange, multiline=false, placeholder='', style={} }) {
  const [editing, setEditing] = useState(false)
  const [v, setV] = useState(value)
  useEffect(() => setV(value), [value])

  if (editing) {
    const Tag = multiline ? 'textarea' : 'input'
    return (
      <Tag autoFocus value={v} onChange={e => setV(e.target.value)}
        onBlur={() => { onChange(v); setEditing(false) }}
        onKeyDown={e => { if (e.key === 'Enter' && !multiline) { onChange(v); setEditing(false) } if (e.key === 'Escape') { setV(value); setEditing(false) } }}
        rows={multiline ? 4 : undefined}
        style={{ width:'100%', border:`1px solid ${COLORS.navy2}`, borderRadius:6, padding:'6px 10px', fontSize:'inherit', color:'inherit', outline:'none', fontFamily:'inherit', resize: multiline ? 'vertical' : 'none', background:'white', letterSpacing:'inherit', ...style }}/>
    )
  }
  return (
    <span onClick={() => setEditing(true)} style={{ cursor:'text', display:'inline-block', borderRadius:4, padding:'2px 6px', margin:'-2px -6px', transition:'background 0.1s', ...style }}
      onMouseEnter={e => e.currentTarget.style.background = COLORS.slate50}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
      {value || <span style={{ color:COLORS.slate400, fontStyle:'italic' }}>{placeholder}</span>}
    </span>
  )
}

const labelStyle = { fontSize:11, fontWeight:600, color:COLORS.slate500, textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:6 }
const inputStyle = { width:'100%', padding:'10px 12px', border:`1px solid ${COLORS.slate200}`, borderRadius:8, fontSize:13, color:COLORS.ink, outline:'none', boxSizing:'border-box', fontFamily:'var(--font-sans)' }
const selectStyle = { ...inputStyle, background:'white', cursor:'pointer' }
function Campo({ label, children }) { return <div><label style={labelStyle}>{label}</label>{children}</div> }

// ============================================================
// BUSCADOR CMD+K
// ============================================================
function Buscador({ open, onClose, actividades, onSelect }) {
  const [q, setQ] = useState('')
  const ref = useRef(null)
  useEffect(() => { if (open) setTimeout(() => ref.current?.focus(), 50) }, [open])
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose() }
    if (open) document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [open, onClose])

  if (!open) return null
  const results = actividades.filter(a =>
    a.nombre.toLowerCase().includes(q.toLowerCase()) ||
    a.responsable.toLowerCase().includes(q.toLowerCase()) ||
    a.fase.toLowerCase().includes(q.toLowerCase()) ||
    (a.tags||[]).some(t => t.toLowerCase().includes(q.toLowerCase()))
  ).slice(0, 8)

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(10,37,64,0.45)', zIndex:2000 }}/>
      <div style={{ position:'fixed', top:'20%', left:'50%', transform:'translateX(-50%)', width:560, background:'white', borderRadius:14, boxShadow:'0 20px 50px rgba(10,37,64,0.25)', zIndex:2001, overflow:'hidden' }}>
        <div style={{ padding:'14px 18px', borderBottom:`1px solid ${COLORS.slate100}`, display:'flex', alignItems:'center', gap:10 }}>
          <Icon.Search/>
          <input ref={ref} placeholder="Buscar actividades, personas, fases, tags..." value={q} onChange={e=>setQ(e.target.value)} style={{ flex:1, border:'none', outline:'none', fontSize:15, fontFamily:'var(--font-sans)' }}/>
          <span style={{ fontSize:10, color:COLORS.slate400, fontFamily:'var(--font-mono)', padding:'2px 6px', background:COLORS.slate50, borderRadius:4 }}>ESC</span>
        </div>
        <div style={{ maxHeight:420, overflow:'auto' }}>
          {results.length === 0 && <div style={{ padding:'30px 20px', textAlign:'center', color:COLORS.slate400, fontSize:13 }}>{q ? 'Sin resultados' : 'Empieza a escribir...'}</div>}
          {results.map(a => (
            <div key={a.id} onClick={() => { onSelect(a); onClose() }} style={{ padding:'12px 18px', display:'flex', alignItems:'center', gap:12, cursor:'pointer', borderBottom:`1px solid ${COLORS.slate100}` }}
              onMouseEnter={e => e.currentTarget.style.background = COLORS.slate50}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <span style={{ fontSize:10, fontFamily:'var(--font-mono)', color:COLORS.slate400, minWidth:28 }}>#{a.id}</span>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:500, color:COLORS.ink, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.nombre}</div>
                <div style={{ fontSize:11, color:COLORS.slate500, marginTop:2 }}>{a.fase} · {a.responsable}</div>
              </div>
              <Badge texto={a.estado} mapa={ESTADOS}/>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

// ============================================================
// SELECTOR DE PERSONAS
// ============================================================
function SelectorPersonas({ seleccionadas, onChange, onClose, x, y, multiple=true }) {
  const ref = useRef(null)
  const [temp, setTemp] = useState(seleccionadas)
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) { onChange(multiple ? temp : temp[0]); onClose() } }
    setTimeout(() => document.addEventListener('click', handler), 0)
    return () => document.removeEventListener('click', handler)
  }, [temp, onChange, onClose, multiple])
  const toggle = (n) => { if (multiple) setTemp(prev => prev.includes(n) ? prev.filter(x => x !== n) : [...prev, n]); else { onChange(n); onClose() } }
  return (
    <div ref={ref} style={{ position:'fixed', top:y, left:x, zIndex:1001, background:'white', borderRadius:10, padding:6, minWidth:260, border:`1px solid ${COLORS.slate200}`, boxShadow:'0 8px 24px rgba(10,37,64,0.15)' }}>
      <div style={{ padding:'8px 10px', fontSize:10, fontWeight:600, color:COLORS.slate500, textTransform:'uppercase', letterSpacing:'0.08em' }}>{multiple ? 'Seleccionar equipo' : 'Asignar persona'}</div>
      {NOMBRES.map(n => {
        const sel = multiple ? temp.includes(n) : temp[0] === n
        const colab = COLABORADORES.find(c => c.nombre === n)
        return (
          <div key={n} onClick={() => toggle(n)} style={{ padding:'8px 10px', display:'flex', alignItems:'center', gap:10, cursor:'pointer', borderRadius:6 }}
            onMouseEnter={e => e.currentTarget.style.background = '#F4F6FA'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            {multiple && <div style={{ width:16, height:16, borderRadius:4, border:`1.5px solid ${sel ? COLORS.teal : '#CBD5E1'}`, background: sel ? COLORS.teal : 'white', display:'flex', alignItems:'center', justifyContent:'center', color:'white' }}>{sel && <Icon.Check/>}</div>}
            <Avatar nombre={n} size={24}/>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:13, color:COLORS.ink }}>{n}</div>
              <div style={{ fontSize:10, color:COLORS.slate400 }}>{colab?.rol}</div>
            </div>
            {!multiple && sel && <Icon.Check/>}
          </div>
        )
      })}
      {multiple && (
        <div style={{ padding:'8px 10px', borderTop:`1px solid ${COLORS.slate100}`, marginTop:4 }}>
          <button onClick={() => { onChange(temp); onClose() }} style={{ width:'100%', padding:'6px 12px', background:COLORS.navy, color:'white', border:'none', borderRadius:6, fontSize:11, fontWeight:600, cursor:'pointer' }}>Aplicar ({temp.length})</button>
        </div>
      )}
    </div>
  )
}

// ============================================================
// SELECTOR DE DEPENDENCIAS CON TIPO Y LAG
// ============================================================
function SelectorDeps({ actividades, actividadActual, valor, onChange, onClose, x, y }) {
  const [deps, setDeps] = useState(valor || [])
  const ref = useRef(null)
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) { onChange(deps); onClose() } }
    setTimeout(() => document.addEventListener('click', handler), 0)
    return () => document.removeEventListener('click', handler)
  }, [deps, onChange, onClose])

  const disponibles = actividades.filter(a => a.id !== actividadActual.id)
  const toggle = (id) => {
    const existe = deps.find(d => d.id === id)
    if (existe) setDeps(deps.filter(d => d.id !== id))
    else setDeps([...deps, { id, tipo:'FS', lag:0 }])
  }
  const updateDep = (id, campo, val) => setDeps(deps.map(d => d.id === id ? {...d, [campo]:val} : d))

  return (
    <div ref={ref} style={{ position:'fixed', top:y, left:x, zIndex:1001, background:'white', borderRadius:10, padding:6, minWidth:380, maxHeight:440, border:`1px solid ${COLORS.slate200}`, boxShadow:'0 8px 24px rgba(10,37,64,0.15)', display:'flex', flexDirection:'column' }}>
      <div style={{ padding:'8px 10px', fontSize:10, fontWeight:600, color:COLORS.slate500, textTransform:'uppercase', letterSpacing:'0.08em' }}>Depende de</div>
      <div style={{ overflow:'auto', flex:1 }}>
        {disponibles.map(a => {
          const depExistente = deps.find(d => d.id === a.id)
          const seleccionada = !!depExistente
          return (
            <div key={a.id}>
              <div onClick={() => toggle(a.id)} style={{ padding:'7px 10px', display:'flex', alignItems:'center', gap:10, cursor:'pointer', borderRadius:6 }}
                onMouseEnter={e => e.currentTarget.style.background = '#F4F6FA'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <div style={{ width:16, height:16, borderRadius:4, border:`1.5px solid ${seleccionada ? COLORS.teal : '#CBD5E1'}`, background: seleccionada ? COLORS.teal : 'white', display:'flex', alignItems:'center', justifyContent:'center', color:'white', flexShrink:0 }}>{seleccionada && <Icon.Check/>}</div>
                <span style={{ fontSize:10, fontFamily:'var(--font-mono)', color:COLORS.slate400, minWidth:20 }}>#{a.id}</span>
                <span style={{ fontSize:12, color:COLORS.ink, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.nombre}</span>
              </div>
              {seleccionada && (
                <div style={{ padding:'4px 10px 8px 36px', display:'flex', gap:6, alignItems:'center' }}>
                  <select value={depExistente.tipo} onChange={e => updateDep(a.id, 'tipo', e.target.value)} style={{ fontSize:11, padding:'4px 6px', border:`1px solid ${COLORS.slate200}`, borderRadius:5, background:'white', fontFamily:'var(--font-sans)' }}>
                    {Object.entries(TIPOS_DEP).map(([k,v]) => <option key={k} value={k}>{k} · {v.label}</option>)}
                  </select>
                  <span style={{ fontSize:11, color:COLORS.slate500 }}>Lag:</span>
                  <input type="number" value={depExistente.lag} onChange={e => updateDep(a.id, 'lag', parseInt(e.target.value)||0)} style={{ width:50, fontSize:11, padding:'4px 6px', border:`1px solid ${COLORS.slate200}`, borderRadius:5, fontFamily:'var(--font-mono)' }}/>
                  <span style={{ fontSize:11, color:COLORS.slate500 }}>días</span>
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div style={{ padding:'8px 10px', borderTop:`1px solid ${COLORS.slate100}`, display:'flex', gap:6 }}>
        <button onClick={() => { setDeps([]); onChange([]); onClose() }} style={{ padding:'6px 10px', background:'transparent', border:`1px solid ${COLORS.slate200}`, borderRadius:6, fontSize:11, color:COLORS.slate500, cursor:'pointer', flex:1 }}>Limpiar</button>
        <button onClick={() => { onChange(deps); onClose() }} style={{ padding:'6px 12px', background:COLORS.navy, color:'white', border:'none', borderRadius:6, fontSize:11, fontWeight:600, cursor:'pointer', flex:1 }}>Aplicar ({deps.length})</button>
      </div>
    </div>
  )
}

// ============================================================
// MENU CONTEXTUAL
// ============================================================
function MenuContextual({ x, y, onClose, onAction }) {
  useEffect(() => {
    const handler = () => onClose()
    setTimeout(() => document.addEventListener('click', handler), 0)
    return () => document.removeEventListener('click', handler)
  }, [onClose])

  const items = [
    { id:'detalles', label:'Ver detalles', icon:<Icon.Info/> },
    { id:'duplicar', label:'Duplicar', icon:<Icon.Copy/> },
    { id:'link', label:'Copiar enlace', icon:<Icon.Link/> },
    { id:'divisor' },
    { id:'sub', label:'Añadir subtarea', icon:<Icon.Indent/> },
    { id:'milestone', label:'Convertir en hito', icon:<Icon.Diamond/> },
    { id:'estado', label:'Cambiar estado', icon:<Icon.ChevronR/>, submenu:['Sin iniciar','En progreso','Completada','Bloqueada','Retrasada'] },
    { id:'prioridad', label:'Prioridad', icon:<Icon.Flag/>, submenu:['Alta','Media','Baja'] },
    { id:'divisor2' },
    { id:'eliminar', label:'Eliminar', icon:<Icon.Trash/>, danger:true },
  ]
  const [subOpen, setSubOpen] = useState(null)

  return (
    <div style={{ position:'fixed', top:y, left:x, zIndex:1001, background:'white', borderRadius:10, padding:4, minWidth:220, border:`1px solid ${COLORS.slate200}`, boxShadow:'0 8px 24px rgba(10,37,64,0.12)' }} onClick={e => e.stopPropagation()}>
      {items.map(item => {
        if (item.id.startsWith('divisor')) return <div key={item.id} style={{ height:1, background:COLORS.slate100, margin:'4px 0' }}/>
        return (
          <div key={item.id} style={{ position:'relative' }}
            onMouseEnter={() => item.submenu && setSubOpen(item.id)}
            onMouseLeave={() => item.submenu && setSubOpen(null)}>
            <button onClick={() => { if (!item.submenu) { onAction(item.id); onClose() } }}
              style={{ width:'100%', padding:'8px 12px', background:'transparent', border:'none', fontSize:13, color: item.danger ? COLORS.red : COLORS.ink, cursor:'pointer', display:'flex', alignItems:'center', gap:10, borderRadius:6, textAlign:'left', fontFamily:'var(--font-sans)' }}
              onMouseEnter={e => e.currentTarget.style.background = '#F4F6FA'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <span style={{ color: item.danger ? COLORS.red : COLORS.slate500, display:'flex' }}>{item.icon}</span>
              <span style={{ flex:1 }}>{item.label}</span>
              {item.submenu && <Icon.ChevronR/>}
            </button>
            {item.submenu && subOpen === item.id && (
              <div style={{ position:'absolute', left:'100%', top:0, marginLeft:4, background:'white', borderRadius:10, padding:4, minWidth:160, border:`1px solid ${COLORS.slate200}`, boxShadow:'0 8px 24px rgba(10,37,64,0.12)' }}>
                {item.submenu.map(s => (
                  <button key={s} onClick={() => { onAction(`${item.id}:${s}`); onClose() }}
                    style={{ width:'100%', padding:'8px 12px', background:'transparent', border:'none', fontSize:13, color:COLORS.ink, cursor:'pointer', display:'flex', alignItems:'center', gap:10, borderRadius:6, textAlign:'left', fontFamily:'var(--font-sans)' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#F4F6FA'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <span style={{ width:8, height:8, borderRadius:'50%', background: (ESTADOS[s]?.color || PRIORIDADES[s]?.color || '#94A3B8') }}/>
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ============================================================
// ALERTA DE DESFASES
// ============================================================
function AlertaDesfases({ alertas, onAjustar, onIgnorar }) {
  if (alertas.length === 0) return null
  return (
    <div style={{ padding:'12px 16px', background:'#FEF3C7', border:'1px solid #FDE68A', borderRadius:10, marginBottom:16, display:'flex', alignItems:'flex-start', gap:12 }}>
      <span style={{ color:'#92400E', marginTop:2 }}><Icon.Alert/></span>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:13, fontWeight:600, color:'#92400E', marginBottom:4 }}>{alertas.length} actividad(es) deberían ajustarse</div>
        <div style={{ fontSize:12, color:'#92400E', marginBottom:8 }}>
          {alertas.slice(0,3).map((a,i) => <div key={i}>• #{a.actividad.id} {a.actividad.nombre} — debería iniciar el {a.deberiaIniciar}</div>)}
          {alertas.length > 3 && <div>• y {alertas.length - 3} más...</div>}
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={onAjustar} style={{ padding:'6px 12px', background:'#92400E', color:'white', border:'none', borderRadius:6, fontSize:12, fontWeight:600, cursor:'pointer' }}>Ajustar fechas automáticamente</button>
          <button onClick={onIgnorar} style={{ padding:'6px 12px', background:'transparent', color:'#92400E', border:'1px solid #FDE68A', borderRadius:6, fontSize:12, cursor:'pointer' }}>Ignorar</button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// PANEL DE DETALLE ENRIQUECIDO
// ============================================================
function PanelDetalle({ actividad, actividades, onClose, onSave, onDelete, baseline }) {
  const [form, setForm] = useState({ ...actividad, checklist: actividad.checklist||[], comentarios: actividad.comentarios||[], adjuntos: actividad.adjuntos||[], historial: actividad.historial||[], tags: actividad.tags||[], deps: actividad.deps||[] })
  const [tabPanel, setTabPanel] = useState('info') // info, comments, attachments, history
  const [nuevoComentario, setNuevoComentario] = useState('')
  const [nuevoTag, setNuevoTag] = useState('')

  const addChecklist = () => { const newId = Math.max(0, ...(form.checklist||[]).map(c=>c.id)) + 1; setForm({...form, checklist:[...form.checklist, {id:newId, texto:'', hecho:false}]}) }
  const updChecklist = (id, f, v) => setForm({...form, checklist: form.checklist.map(c => c.id===id ? {...c, [f]:v} : c)})
  const delChecklist = (id) => setForm({...form, checklist: form.checklist.filter(c => c.id !== id)})
  const addTag = () => { if (nuevoTag && !form.tags.includes(nuevoTag)) { setForm({...form, tags:[...form.tags, nuevoTag]}); setNuevoTag('') } }
  const addComentario = () => {
    if (!nuevoComentario.trim()) return
    const newId = Math.max(0, ...form.comentarios.map(c=>c.id)) + 1
    setForm({...form, comentarios:[...form.comentarios, { id:newId, autor:'Malio Martinez', fecha:new Date().toISOString().split('T')[0], texto:nuevoComentario }]})
    setNuevoComentario('')
  }

  const predecesoras = (form.deps || []).map(d => ({ ...actividades.find(a => a.id === d.id), depInfo:d })).filter(a => a.id)
  const bloqueada = predecesoras.some(p => !p.completada)
  const varianza = baseline ? diffDays(baseline.fin, form.fin) : null

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(10,37,64,0.25)', backdropFilter:'blur(2px)', zIndex:999 }}/>
      <div style={{ position:'fixed', top:0, right:0, bottom:0, width:520, background:'white', boxShadow:'-8px 0 32px rgba(10,37,64,0.12)', zIndex:1000, display:'flex', flexDirection:'column', animation:'slideIn 0.25s ease-out' }}>
        <style>{`@keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>

        <div style={{ padding:'22px 28px 0', borderBottom:`1px solid ${COLORS.slate100}` }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
            <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
              <span style={{ fontSize:10, fontFamily:'var(--font-mono)', color:COLORS.slate400, fontWeight:500 }}>#{form.id}</span>
              <Badge texto={form.fase} mapa={{[form.fase]:{bg:'#EEF2F6', color:COLORS.navy}}}/>
              {form.esMilestone && <Badge texto="Hito" mapa={{Hito:{bg:'#EEE', color:COLORS.navy}}}/>}
              {form.prioridad && <Badge texto={form.prioridad} mapa={PRIORIDADES}/>}
            </div>
            <IconBtn onClick={onClose} title="Cerrar"><Icon.X/></IconBtn>
          </div>
          <input value={form.nombre} onChange={e => setForm({...form, nombre:e.target.value})}
            style={{ fontSize:22, fontWeight:600, color:COLORS.ink, border:'none', outline:'none', width:'100%', background:'transparent', letterSpacing:'-0.02em', fontFamily:'var(--font-sans)', paddingBottom:14 }}/>

          <div style={{ display:'flex', gap:0, borderBottom:'none' }}>
            {[{k:'info',l:'Información'},{k:'comments',l:`Comentarios (${form.comentarios.length})`},{k:'attachments',l:`Archivos (${form.adjuntos.length})`},{k:'history',l:'Historial'}].map(t => (
              <button key={t.k} onClick={() => setTabPanel(t.k)} style={{ padding:'10px 14px', border:'none', background:'transparent', cursor:'pointer', fontSize:12, fontWeight: tabPanel===t.k?600:500, color: tabPanel===t.k?COLORS.navy:COLORS.slate500, borderBottom: tabPanel===t.k?`2px solid ${COLORS.navy}`:'2px solid transparent', marginBottom:-1 }}>{t.l}</button>
            ))}
          </div>
        </div>

        <div style={{ flex:1, overflow:'auto', padding:'22px 28px' }}>
          {tabPanel === 'info' && (
            <>
              {bloqueada && (
                <div style={{ padding:'10px 14px', background:'#FEF3C7', border:'1px solid #FDE68A', borderRadius:8, fontSize:12, color:'#92400E', marginBottom:16, display:'flex', alignItems:'center', gap:8 }}>
                  <Icon.Lock/><span>Esperando: {predecesoras.filter(p => !p.completada).map(p => `#${p.id}`).join(', ')}</span>
                </div>
              )}

              <div style={{ padding:14, background:COLORS.slate50, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:22, border:`1px solid ${COLORS.slate100}` }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <div onClick={() => setForm({...form, completada:!form.completada, avance:!form.completada?100:0, estado:!form.completada?'Completada':'Sin iniciar'})}
                    style={{ width:22, height:22, borderRadius:6, border:`2px solid ${form.completada ? COLORS.teal : '#CBD5E1'}`, background: form.completada ? COLORS.teal : 'white', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0, color:'white' }}>
                    {form.completada && <Icon.Check/>}
                  </div>
                  <span style={{ fontSize:14, fontWeight:500, color:COLORS.ink }}>{form.completada ? 'Completada' : 'Marcar como completada'}</span>
                </div>
                <Badge texto={form.estado} mapa={ESTADOS}/>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:20 }}>
                <Campo label="Estado"><select value={form.estado} onChange={e => setForm({...form, estado:e.target.value})} style={selectStyle}>{Object.keys(ESTADOS).map(s => <option key={s}>{s}</option>)}</select></Campo>
                <Campo label="Prioridad"><select value={form.prioridad} onChange={e => setForm({...form, prioridad:e.target.value})} style={selectStyle}>{Object.keys(PRIORIDADES).map(p => <option key={p}>{p}</option>)}</select></Campo>
              </div>

              <Campo label="Responsable"><input value={form.responsable} onChange={e => setForm({...form, responsable:e.target.value})} style={inputStyle}/></Campo>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginTop:20 }}>
                <Campo label="Fecha inicio"><input type="date" value={form.inicio} onChange={e => setForm({...form, inicio:e.target.value})} style={inputStyle}/></Campo>
                <Campo label="Fecha fin"><input type="date" value={form.fin} onChange={e => setForm({...form, fin:e.target.value})} style={inputStyle}/></Campo>
              </div>

              {baseline && (
                <div style={{ marginTop:16, padding:12, background:COLORS.slate50, borderRadius:8, fontSize:12 }}>
                  <div style={{ fontSize:10, fontWeight:600, color:COLORS.slate500, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:6 }}>Baseline (plan original)</div>
                  <div style={{ display:'flex', gap:16, color:COLORS.slate600 }}>
                    <span>Inicio: <b style={{ fontFamily:'var(--font-mono)' }}>{baseline.inicio}</b></span>
                    <span>Fin: <b style={{ fontFamily:'var(--font-mono)' }}>{baseline.fin}</b></span>
                    <span style={{ color: varianza > 0 ? COLORS.red : COLORS.teal, fontWeight:600 }}>Varianza: {varianza > 0 ? '+' : ''}{varianza}d</span>
                  </div>
                </div>
              )}

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginTop:20 }}>
                <Campo label="Avance (%)"><input type="number" min={0} max={100} value={form.avance} onChange={e => setForm({...form, avance:parseInt(e.target.value)||0})} style={inputStyle}/></Campo>
                <Campo label="Horas estimadas"><input type="number" min={0} value={form.horasEstimadas||0} onChange={e => setForm({...form, horasEstimadas:parseInt(e.target.value)||0})} style={inputStyle}/></Campo>
              </div>

              <div style={{ marginTop:16 }}>
                <Campo label={`Horas reales (${form.horasReales||0}h / ${form.horasEstimadas||0}h)`}>
                  <input type="number" min={0} value={form.horasReales||0} onChange={e => setForm({...form, horasReales:parseInt(e.target.value)||0})} style={inputStyle}/>
                </Campo>
              </div>

              <div style={{ marginTop:20, display:'flex', alignItems:'center', gap:10, padding:'10px 14px', background:COLORS.slate50, borderRadius:8 }}>
                <input type="checkbox" checked={form.esMilestone} onChange={e => setForm({...form, esMilestone:e.target.checked})} style={{ width:16, height:16, cursor:'pointer', accentColor:COLORS.navy }}/>
                <span style={{ fontSize:13, color:COLORS.ink }}>Es un hito / milestone</span>
              </div>

              <div style={{ marginTop:20 }}>
                <label style={labelStyle}>Tags / Etiquetas</label>
                <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:8 }}>
                  {form.tags.map(t => (
                    <span key={t} style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'3px 8px', background:COLORS.slate100, borderRadius:20, fontSize:11, color:COLORS.slate600 }}>
                      {t}
                      <button onClick={() => setForm({...form, tags:form.tags.filter(x=>x!==t)})} style={{ border:'none', background:'transparent', cursor:'pointer', color:COLORS.slate400, padding:0, display:'flex' }}><Icon.X/></button>
                    </span>
                  ))}
                </div>
                <div style={{ display:'flex', gap:6 }}>
                  <input value={nuevoTag} onChange={e => setNuevoTag(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }} placeholder="Nuevo tag..." style={{ ...inputStyle, fontSize:12 }}/>
                  <button onClick={addTag} style={{ padding:'8px 14px', background:COLORS.slate100, color:COLORS.slate600, border:'none', borderRadius:8, fontSize:12, cursor:'pointer' }}>+</button>
                </div>
              </div>

              <div style={{ marginTop:20 }}>
                <label style={labelStyle}>Depende de</label>
                {predecesoras.length === 0 ? (
                  <div style={{ padding:10, background:COLORS.slate50, borderRadius:8, fontSize:12, color:COLORS.slate400, fontStyle:'italic' }}>Sin dependencias</div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    {predecesoras.map(p => (
                      <div key={p.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', background:COLORS.slate50, borderRadius:8 }}>
                        <span style={{ fontSize:10, fontFamily:'var(--font-mono)', color:COLORS.slate400, fontWeight:600, minWidth:24 }}>#{p.id}</span>
                        <span style={{ fontSize:12, color:COLORS.ink, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.nombre}</span>
                        <span style={{ fontSize:10, color:COLORS.slate500, fontFamily:'var(--font-mono)', padding:'2px 6px', background:'white', borderRadius:4 }}>{p.depInfo.tipo}{p.depInfo.lag>0?`+${p.depInfo.lag}d`:p.depInfo.lag<0?`${p.depInfo.lag}d`:''}</span>
                        {p.completada ? <span style={{ fontSize:10, color:COLORS.teal, fontWeight:600 }}>✓</span> : <span style={{ fontSize:10, color:COLORS.amber, fontWeight:600 }}><Icon.Lock/></span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ marginTop:28 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                  <span style={labelStyle}>Subtareas</span>
                  <span style={{ fontSize:11, color:COLORS.slate400, fontFamily:'var(--font-mono)' }}>{form.checklist.filter(c=>c.hecho).length}/{form.checklist.length}</span>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  {form.checklist.map(item => (
                    <div key={item.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', background:COLORS.slate50, borderRadius:8 }}>
                      <div onClick={() => updChecklist(item.id, 'hecho', !item.hecho)} style={{ width:16, height:16, borderRadius:4, border:`1.5px solid ${item.hecho ? COLORS.teal : '#CBD5E1'}`, background: item.hecho ? COLORS.teal : 'white', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0, color:'white' }}>{item.hecho && <Icon.Check/>}</div>
                      <input value={item.texto} onChange={e => updChecklist(item.id, 'texto', e.target.value)} placeholder="Descripción..." style={{ flex:1, border:'none', outline:'none', background:'transparent', fontSize:13, color: item.hecho ? COLORS.slate400 : COLORS.ink, textDecoration: item.hecho ? 'line-through' : 'none' }}/>
                      <IconBtn onClick={() => delChecklist(item.id)} title="Eliminar"><Icon.Trash/></IconBtn>
                    </div>
                  ))}
                  <button onClick={addChecklist} style={{ marginTop:4, padding:'8px 12px', background:'transparent', border:`1px dashed ${COLORS.slate200}`, borderRadius:8, fontSize:12, color:COLORS.slate500, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}><Icon.Plus/> Agregar subtarea</button>
                </div>
              </div>

              <div style={{ marginTop:22 }}>
                <Campo label="Notas"><textarea value={form.notas} onChange={e => setForm({...form, notas:e.target.value})} rows={4} placeholder="Agrega notas..." style={{...inputStyle, resize:'vertical', fontFamily:'var(--font-sans)'}}/></Campo>
              </div>
            </>
          )}

          {tabPanel === 'comments' && (
            <>
              <div style={{ marginBottom:14 }}>
                <textarea value={nuevoComentario} onChange={e=>setNuevoComentario(e.target.value)} placeholder="Escribe un comentario... Usa @ para mencionar" rows={3} style={{...inputStyle, resize:'vertical', fontFamily:'var(--font-sans)'}}/>
                <button onClick={addComentario} disabled={!nuevoComentario.trim()} style={{ marginTop:8, padding:'8px 14px', background:nuevoComentario.trim()?COLORS.navy:COLORS.slate200, color:'white', border:'none', borderRadius:8, fontSize:12, fontWeight:600, cursor:nuevoComentario.trim()?'pointer':'not-allowed' }}>Publicar</button>
              </div>
              {form.comentarios.map(c => (
                <div key={c.id} style={{ padding:'12px 14px', background:COLORS.slate50, borderRadius:10, marginBottom:8 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                    <Avatar nombre={c.autor} size={24}/>
                    <span style={{ fontSize:12, fontWeight:600, color:COLORS.ink }}>{c.autor}</span>
                    <span style={{ fontSize:10, color:COLORS.slate400, fontFamily:'var(--font-mono)' }}>{c.fecha}</span>
                  </div>
                  <p style={{ fontSize:13, color:COLORS.slate600, margin:0, lineHeight:1.5 }}>{c.texto}</p>
                </div>
              ))}
              {form.comentarios.length === 0 && <div style={{ padding:30, textAlign:'center', color:COLORS.slate400, fontSize:13 }}>Sin comentarios</div>}
            </>
          )}

          {tabPanel === 'attachments' && (
            <>
              <div style={{ padding:24, border:`2px dashed ${COLORS.slate200}`, borderRadius:10, textAlign:'center', marginBottom:14 }}>
                <Icon.Paperclip/>
                <div style={{ fontSize:13, color:COLORS.slate500, marginTop:8 }}>Arrastra archivos aquí o haz clic para subir</div>
                <div style={{ fontSize:11, color:COLORS.slate400, marginTop:4 }}>(Próximamente con Supabase Storage)</div>
              </div>
              {form.adjuntos.map(a => (
                <div key={a.id} style={{ padding:'10px 14px', background:COLORS.slate50, borderRadius:8, marginBottom:6, display:'flex', alignItems:'center', gap:10 }}>
                  <Icon.Paperclip/>
                  <span style={{ flex:1, fontSize:13, color:COLORS.ink }}>{a.nombre}</span>
                  <span style={{ fontSize:11, color:COLORS.slate400, fontFamily:'var(--font-mono)' }}>{a.size}</span>
                  <IconBtn onClick={()=>{}} title="Descargar"><Icon.Download/></IconBtn>
                </div>
              ))}
              {form.adjuntos.length === 0 && <div style={{ padding:20, textAlign:'center', color:COLORS.slate400, fontSize:13 }}>Sin archivos adjuntos</div>}
            </>
          )}

          {tabPanel === 'history' && (
            <>
              {form.historial.length === 0 && <div style={{ padding:30, textAlign:'center', color:COLORS.slate400, fontSize:13 }}>Sin historial</div>}
              {form.historial.map(h => (
                <div key={h.id} style={{ padding:'10px 14px', borderLeft:`2px solid ${COLORS.slate200}`, marginBottom:6 }}>
                  <div style={{ fontSize:12, color:COLORS.ink }}>{h.accion}</div>
                  <div style={{ fontSize:11, color:COLORS.slate500, marginTop:2 }}>{h.autor} · {h.fecha}</div>
                </div>
              ))}
            </>
          )}
        </div>

        <div style={{ padding:'16px 28px', borderTop:`1px solid ${COLORS.slate100}`, display:'flex', gap:10, alignItems:'center' }}>
          <button onClick={() => onDelete(form.id)} style={{ padding:'10px 14px', background:'transparent', color:COLORS.red, border:`1px solid ${COLORS.slate200}`, borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer' }}>Eliminar</button>
          <div style={{ flex:1 }}/>
          <button onClick={onClose} style={{ padding:'10px 16px', background:'transparent', color:COLORS.slate600, border:`1px solid ${COLORS.slate200}`, borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer' }}>Cancelar</button>
          <button onClick={() => onSave(form)} style={{ padding:'10px 20px', background:COLORS.navy, color:'white', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer' }}>Guardar</button>
        </div>
      </div>
    </>
  )
}

// ============================================================
// TAB ACTIVIDADES
// ============================================================
function TabActividades({ actividades, onToggle, onUpdate, onDelete, onAgregar, onAbrirDetalle, onDuplicar, rutaCritica, mostrarCritica, filtro, agrupacion, baseline }) {
  const [hoveredId, setHoveredId] = useState(null)
  const [editandoId, setEditandoId] = useState(null)
  const [colapsados, setColapsados] = useState({})
  const [padresColapsados, setPadresColapsados] = useState({})
  const [menuContextual, setMenuContextual] = useState(null)
  const [selectorDeps, setSelectorDeps] = useState(null)
  const [selectorPersona, setSelectorPersona] = useState(null)

  let actsFiltradas = actividades
  if (filtro?.responsable) actsFiltradas = actsFiltradas.filter(a => a.responsable === filtro.responsable)
  if (filtro?.estado) actsFiltradas = actsFiltradas.filter(a => a.estado === filtro.estado)
  if (filtro?.prioridad) actsFiltradas = actsFiltradas.filter(a => a.prioridad === filtro.prioridad)
  if (filtro?.busqueda) actsFiltradas = actsFiltradas.filter(a => a.nombre.toLowerCase().includes(filtro.busqueda.toLowerCase()))

  // Agrupar por fase, responsable, prioridad o nada
  const grupos = useMemo(() => {
    if (agrupacion === 'responsable') return [...new Set(actsFiltradas.map(a => a.responsable))]
    if (agrupacion === 'prioridad') return ['Alta', 'Media', 'Baja']
    if (agrupacion === 'estado') return Object.keys(ESTADOS)
    return [...new Set(actsFiltradas.map(a => a.fase))]
  }, [actsFiltradas, agrupacion])

  const getActsDeGrupo = (g) => {
    if (agrupacion === 'responsable') return actsFiltradas.filter(a => a.responsable === g)
    if (agrupacion === 'prioridad') return actsFiltradas.filter(a => a.prioridad === g)
    if (agrupacion === 'estado') return actsFiltradas.filter(a => a.estado === g)
    return actsFiltradas.filter(a => a.fase === g)
  }

  const handleMenuAction = (a, action) => {
    if (action === 'detalles') onAbrirDetalle(a)
    else if (action === 'duplicar') onDuplicar(a)
    else if (action === 'sub') onAgregar(a.fase, a.id)
    else if (action === 'milestone') onUpdate({...a, esMilestone:!a.esMilestone, fin:a.inicio})
    else if (action === 'eliminar') onDelete(a.id)
    else if (action === 'link') navigator.clipboard?.writeText(`actividad-${a.id}`)
    else if (action.startsWith('estado:')) {
      const s = action.split(':')[1]
      onUpdate({...a, estado:s, completada:s==='Completada', avance:s==='Completada'?100:a.avance})
    } else if (action.startsWith('prioridad:')) {
      onUpdate({...a, prioridad:action.split(':')[1]})
    }
  }

  const esBloqueada = (a) => (a.deps || []).some(d => { const p = actividades.find(x => x.id === d.id); return p && !p.completada })

  return (
    <>
      {menuContextual && <MenuContextual x={menuContextual.x} y={menuContextual.y} onClose={() => setMenuContextual(null)} onAction={(ac) => handleMenuAction(menuContextual.actividad, ac)}/>}
      {selectorDeps && <SelectorDeps actividades={actividades} actividadActual={selectorDeps.actividad} valor={selectorDeps.actividad.deps || []} onChange={(deps) => onUpdate({...selectorDeps.actividad, deps})} onClose={() => setSelectorDeps(null)} x={selectorDeps.x} y={selectorDeps.y}/>}
      {selectorPersona && <SelectorPersonas seleccionadas={[selectorPersona.actividad.responsable]} multiple={false} onChange={(n) => onUpdate({...selectorPersona.actividad, responsable:n})} onClose={() => setSelectorPersona(null)} x={selectorPersona.x} y={selectorPersona.y}/>}

      <div style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, overflow:'hidden' }}>
        <div style={{ display:'grid', gridTemplateColumns:'44px 24px 1fr 130px 90px 90px 110px 90px 90px 90px 40px', gap:0, padding:'11px 16px', background:COLORS.slate50, borderBottom:`1px solid ${COLORS.slate100}`, fontSize:10, fontWeight:600, color:COLORS.slate500, textTransform:'uppercase', letterSpacing:'0.07em' }}>
          <div>ID</div><div></div><div>Actividad</div><div>Responsable</div><div>Inicio</div><div>Fin</div><div>Avance</div><div>Estado</div><div>Prioridad</div><div>Deps</div><div></div>
        </div>

        {grupos.map(g => {
          const actsG = getActsDeGrupo(g)
          const done = actsG.filter(a => a.completada).length
          const col = colapsados[g]

          return (
            <div key={g}>
              <div onClick={() => setColapsados(prev => ({...prev, [g]: !prev[g]}))}
                style={{ padding:'10px 16px', background:'#F4F6FA', borderBottom:`1px solid ${COLORS.slate100}`, display:'flex', alignItems:'center', gap:10, cursor:'pointer', fontSize:12, fontWeight:600, color:COLORS.navy }}>
                <Icon.Chevron open={!col}/>
                <span>{g}</span>
                <span style={{ fontSize:11, color:COLORS.slate500, fontWeight:400, marginLeft:'auto', fontFamily:'var(--font-mono)' }}>{done}/{actsG.length}</span>
              </div>

              {!col && actsG.filter(a => !a.parentId || !padresColapsados[a.parentId]).map(a => {
                const bloqueada = esBloqueada(a) && !a.completada
                const tieneHijos = actividades.some(x => x.parentId === a.id)
                const esHija = a.parentId != null
                const esCritica = mostrarCritica && rutaCritica.has(a.id)
                const base = baseline?.find(b => b.id === a.id)
                const varianza = base ? diffDays(base.fin, a.fin) : 0

                return (
                  <div key={a.id} onMouseEnter={() => setHoveredId(a.id)} onMouseLeave={() => setHoveredId(null)}
                    onContextMenu={(e) => { e.preventDefault(); setMenuContextual({ actividad:a, x:e.clientX, y:e.clientY }) }}
                    style={{ display:'grid', gridTemplateColumns:'44px 24px 1fr 130px 90px 90px 110px 90px 90px 90px 40px', gap:0, alignItems:'center', padding:'10px 16px', borderBottom:`1px solid ${COLORS.slate100}`, background: hoveredId === a.id ? '#FAFBFE' : (bloqueada ? '#FFFBF0' : (esCritica ? '#FEF2F2' : 'white')), transition:'background 0.1s', opacity: a.completada ? 0.7 : 1, borderLeft: esCritica ? `3px solid ${COLORS.red}` : '3px solid transparent' }}>
                    <div style={{ fontSize:10, fontFamily:'var(--font-mono)', color:COLORS.slate400, fontWeight:500 }}>#{a.id}</div>
                    <div onClick={() => onToggle(a.id)} style={{ width:17, height:17, borderRadius:5, border:`1.5px solid ${a.completada ? COLORS.teal : '#CBD5E1'}`, background: a.completada ? COLORS.teal : 'white', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'white' }}>{a.completada && <Icon.Check/>}</div>
                    <div style={{ display:'flex', alignItems:'center', gap:6, minWidth:0, paddingLeft: esHija ? 20 : 0 }}>
                      {tieneHijos && <button onClick={(e) => { e.stopPropagation(); setPadresColapsados(prev => ({...prev, [a.id]:!prev[a.id]})) }} style={{ width:18, height:18, border:'none', background:'transparent', cursor:'pointer', color:COLORS.slate500, padding:0 }}><Icon.Chevron open={!padresColapsados[a.id]}/></button>}
                      {a.esMilestone && <span style={{ color:COLORS.navy, flexShrink:0 }}><Icon.Diamond/></span>}
                      {bloqueada && <span style={{ color:COLORS.amber, flexShrink:0 }}><Icon.Lock/></span>}
                      {editandoId === a.id ? (
                        <input autoFocus value={a.nombre} onChange={e => onUpdate({...a, nombre:e.target.value})} onBlur={() => setEditandoId(null)} onKeyDown={e => { if(e.key==='Enter') setEditandoId(null) }} style={{ flex:1, border:`1px solid ${COLORS.navy2}`, borderRadius:5, padding:'4px 8px', fontSize:13, outline:'none', fontFamily:'var(--font-sans)' }}/>
                      ) : (
                        <span onDoubleClick={() => setEditandoId(a.id)} style={{ fontSize:13, fontWeight: tieneHijos ? 600 : 500, color:COLORS.ink, textDecoration: a.completada ? 'line-through' : 'none', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', cursor:'text', flex:1, minWidth:0 }}>{a.nombre}</span>
                      )}
                      {a.comentarios?.length > 0 && <span style={{ fontSize:10, color:COLORS.slate400, display:'flex', alignItems:'center', gap:2, flexShrink:0 }}><Icon.Message/>{a.comentarios.length}</span>}
                      {a.adjuntos?.length > 0 && <span style={{ fontSize:10, color:COLORS.slate400, display:'flex', alignItems:'center', gap:2, flexShrink:0 }}><Icon.Paperclip/>{a.adjuntos.length}</span>}
                      {a.checklist?.length > 0 && <span style={{ fontSize:10, color:COLORS.slate400, fontFamily:'var(--font-mono)', flexShrink:0 }}>☰ {a.checklist.filter(c=>c.hecho).length}/{a.checklist.length}</span>}
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', minWidth:0 }} onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setSelectorPersona({ actividad:a, x:r.left, y:r.bottom+4 }) }}>
                      <Avatar nombre={a.responsable} size={22}/>
                      <span style={{ fontSize:12, color:COLORS.slate600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.responsable}</span>
                    </div>
                    <input type="date" value={a.inicio} onChange={e => onUpdate({...a, inicio:e.target.value})} style={{ fontSize:11, color:COLORS.slate500, fontFamily:'var(--font-mono)', border:'none', background:'transparent', outline:'none', cursor:'pointer', padding:0 }}/>
                    <div style={{ display:'flex', flexDirection:'column' }}>
                      <input type="date" value={a.fin} onChange={e => onUpdate({...a, fin:e.target.value})} style={{ fontSize:11, color:COLORS.slate500, fontFamily:'var(--font-mono)', border:'none', background:'transparent', outline:'none', cursor:'pointer', padding:0 }}/>
                      {base && varianza !== 0 && <span style={{ fontSize:9, color:varianza>0?COLORS.red:COLORS.teal, fontFamily:'var(--font-mono)', fontWeight:600 }}>{varianza>0?'+':''}{varianza}d</span>}
                    </div>
                    <div><BarraAvance avance={a.avance}/></div>
                    <div><Badge texto={a.estado} mapa={ESTADOS}/></div>
                    <div>{a.prioridad && <Badge texto={a.prioridad} mapa={PRIORIDADES}/>}</div>
                    <div onClick={(e) => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); setSelectorDeps({ actividad:a, x:r.left-50, y:r.bottom+4 }) }} style={{ display:'flex', alignItems:'center', gap:4, cursor:'pointer', padding:'4px 6px', borderRadius:6 }}>
                      {a.deps && a.deps.length > 0 ? <span style={{ fontSize:11, fontWeight:500, color:COLORS.navy, fontFamily:'var(--font-mono)' }}>{a.deps.map(d => `#${d.id}${d.tipo!=='FS'?`(${d.tipo})`:''}`).join(',')}</span> : <span style={{ fontSize:11, color:COLORS.slate400 }}>—</span>}
                    </div>
                    <div style={{ display:'flex', justifyContent:'flex-end', opacity: hoveredId === a.id ? 1 : 0 }}>
                      <IconBtn onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setMenuContextual({ actividad:a, x:r.left-180, y:r.bottom+4 }) }} title="Más"><Icon.Dots/></IconBtn>
                    </div>
                  </div>
                )
              })}

              {!col && agrupacion === 'fase' && (
                <button onClick={() => onAgregar(g)} style={{ width:'100%', padding:'10px 16px', background:'transparent', border:'none', borderBottom:`1px solid ${COLORS.slate100}`, fontSize:12, color:COLORS.slate500, cursor:'pointer', display:'flex', alignItems:'center', gap:8, textAlign:'left' }}><Icon.Plus/> Agregar actividad</button>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}

// ============================================================
// TAB GANTT
// ============================================================
function TabGantt({ actividades, onToggle, onUpdate, onAbrirDetalle, onAgregar, rutaCritica, mostrarCritica, baseline, mostrarBaseline }) {
  const containerRef = useRef(null)
  const [containerWidth, setContainerWidth] = useState(0)
  const [hoveredId, setHoveredId] = useState(null)
  const [hoveredFlecha, setHoveredFlecha] = useState(null)
  const [fasesColapsadas, setFasesColapsadas] = useState({})
  const [zoom, setZoom] = useState('week')
  const [drag, setDrag] = useState(null)

  useEffect(() => {
    const update = () => { if (containerRef.current) setContainerWidth(containerRef.current.offsetWidth) }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const zoomDias = { day:30, week:90, month:240, quarter:450 }
  const fases = [...new Set(actividades.map(a => a.fase))]
  const hoy = new Date(); hoy.setHours(0,0,0,0)
  const fechaMin = new Date(Math.min(...actividades.map(a => toDate(a.inicio).getTime()))); fechaMin.setDate(fechaMin.getDate() - 3)
  const fechaMax = new Date(Math.max(...actividades.map(a => toDate(a.fin).getTime()))); fechaMax.setDate(fechaMax.getDate() + 7)
  const totalDias = Math.max(zoomDias[zoom], Math.ceil((fechaMax - fechaMin) / 86400000))
  const ROW_H = 42, FASE_H = 36, PANEL_W = 340
  const timelineW = Math.max(0, containerWidth - PANEL_W)
  const pxPorDia = timelineW / totalDias

  const dayToPx = (f) => Math.max(0, Math.round(((toDate(f) - fechaMin) / 86400000) * pxPorDia))

  const colorBarra = (a) => {
    if (a.completada) return COLORS.teal
    if (toDate(a.fin) < hoy && a.avance < 100) return COLORS.red
    if (a.estado === 'Bloqueada') return COLORS.amber
    if (a.estado === 'En progreso') return COLORS.navy2
    return COLORS.slate400
  }

  const encabezados = useMemo(() => {
    const result = []
    const cur = new Date(fechaMin)
    if (zoom === 'day' || zoom === 'week') {
      cur.setDate(1)
      while (cur <= fechaMax) {
        result.push({ label: cur.toLocaleDateString('es-MX',{month:'short',year:'numeric'}), px: dayToPx(toStr(cur)) })
        cur.setMonth(cur.getMonth()+1)
      }
    } else if (zoom === 'month') {
      cur.setMonth(Math.floor(cur.getMonth()/3)*3, 1)
      while (cur <= fechaMax) {
        result.push({ label: `Q${Math.floor(cur.getMonth()/3)+1} ${cur.getFullYear()}`, px: dayToPx(toStr(cur)) })
        cur.setMonth(cur.getMonth()+3)
      }
    } else {
      cur.setMonth(0,1)
      while (cur <= fechaMax) {
        result.push({ label: `${cur.getFullYear()}`, px: dayToPx(toStr(cur)) })
        cur.setFullYear(cur.getFullYear()+1)
      }
    }
    return result
  }, [fechaMin, fechaMax, zoom, pxPorDia])

  // Franjas de fines de semana (opcional, solo en day/week)
  const franjasFinSemana = useMemo(() => {
    if (zoom !== 'day' && zoom !== 'week') return []
    const result = []
    const cur = new Date(fechaMin)
    while (cur <= fechaMax) {
      const str = toStr(cur)
      if (esNoLaboral(str)) result.push({ px: dayToPx(str), width: pxPorDia })
      cur.setDate(cur.getDate() + 1)
    }
    return result
  }, [fechaMin, fechaMax, zoom, pxPorDia])

  const filas = []
  fases.forEach(fase => {
    filas.push({ tipo:'fase', fase })
    if (!fasesColapsadas[fase]) actividades.filter(a => a.fase === fase).forEach(a => filas.push({ tipo:'actividad', actividad:a }))
  })

  const rowY = {}
  let y = 0
  filas.forEach((f) => {
    if (f.tipo === 'actividad') rowY[f.actividad.id] = y + ROW_H/2
    y += f.tipo === 'fase' ? FASE_H : ROW_H
  })
  const totalH = y

  const flechas = []
  if (timelineW > 0) {
    actividades.forEach(a => {
      (a.deps || []).forEach(dep => {
        if (rowY[dep.id] === undefined || rowY[a.id] === undefined) return
        const from = actividades.find(x => x.id === dep.id)
        if (!from) return
        const tipo = dep.tipo || 'FS'
        let x1, x2
        if (tipo === 'FS') { x1 = dayToPx(from.fin) + (from.esMilestone ? 7 : 0); x2 = dayToPx(a.inicio) }
        else if (tipo === 'SS') { x1 = dayToPx(from.inicio); x2 = dayToPx(a.inicio) }
        else if (tipo === 'FF') { x1 = dayToPx(from.fin); x2 = dayToPx(a.fin) }
        else { x1 = dayToPx(from.inicio); x2 = dayToPx(a.fin) }
        const y1 = rowY[dep.id]
        const y2 = rowY[a.id]
        flechas.push({ x1, y1, x2, y2, key:`${dep.id}-${a.id}`, fromId:dep.id, toId:a.id, tipo, lag:dep.lag||0, critica: rutaCritica.has(dep.id) && rutaCritica.has(a.id) })
      })
    })
  }

  const handleMouseDown = (e, a, mode) => {
    e.stopPropagation(); e.preventDefault()
    setDrag({ id:a.id, mode, startX:e.clientX, initInicio:a.inicio, initFin:a.fin })
  }

  useEffect(() => {
    if (!drag) return
    const handleMove = (e) => {
      const deltaPx = e.clientX - drag.startX
      const deltaDias = Math.round(deltaPx / pxPorDia)
      const a = actividades.find(x => x.id === drag.id)
      if (!a) return
      if (drag.mode === 'move') {
        const ni = addDays(drag.initInicio, deltaDias)
        const nf = addDays(drag.initFin, deltaDias)
        if (ni !== a.inicio) onUpdate({...a, inicio:ni, fin:nf}, true)
      } else if (drag.mode === 'resize-end') {
        const nf = addDays(drag.initFin, deltaDias)
        if (toDate(nf) >= toDate(a.inicio) && nf !== a.fin) onUpdate({...a, fin:nf}, true)
      } else if (drag.mode === 'resize-start') {
        const ni = addDays(drag.initInicio, deltaDias)
        if (toDate(ni) <= toDate(a.fin) && ni !== a.inicio) onUpdate({...a, inicio:ni}, true)
      }
    }
    const handleUp = () => setDrag(null)
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    return () => { window.removeEventListener('mousemove', handleMove); window.removeEventListener('mouseup', handleUp) }
  }, [drag, pxPorDia, actividades, onUpdate])

  return (
    <div ref={containerRef} style={{ background:'white', borderRadius:12, border:`1px solid ${COLORS.slate100}`, overflow:'hidden' }}>
      <div style={{ padding:'10px 16px', borderBottom:`1px solid ${COLORS.slate100}`, display:'flex', alignItems:'center', gap:8, background:COLORS.slate50 }}>
        <span style={{ fontSize:11, fontWeight:600, color:COLORS.slate500, textTransform:'uppercase', letterSpacing:'0.08em', marginRight:4 }}>Zoom:</span>
        {['day','week','month','quarter'].map(z => (
          <button key={z} onClick={() => setZoom(z)} style={{ padding:'5px 12px', background: zoom === z ? COLORS.navy : 'white', color: zoom === z ? 'white' : COLORS.slate600, border:`1px solid ${zoom === z ? COLORS.navy : COLORS.slate200}`, borderRadius:6, fontSize:11, fontWeight:500, cursor:'pointer', textTransform:'capitalize' }}>{z === 'day' ? 'Día' : z === 'week' ? 'Semana' : z === 'month' ? 'Mes' : 'Trimestre'}</button>
        ))}
        <div style={{ flex:1 }}/>
        {mostrarBaseline && <span style={{ fontSize:11, color:COLORS.slate500, display:'flex', alignItems:'center', gap:6 }}><span style={{ width:14, height:6, background:'#C4B5FD', borderRadius:2 }}/> Baseline</span>}
        {mostrarCritica && <span style={{ fontSize:11, color:COLORS.slate500, display:'flex', alignItems:'center', gap:6 }}><span style={{ width:10, height:10, background:COLORS.red, borderRadius:2 }}/> Crítica</span>}
      </div>

      <div style={{ display:'flex', borderBottom:`1px solid ${COLORS.slate100}`, background:COLORS.slate50 }}>
        <div style={{ width:PANEL_W, flexShrink:0, padding:'12px 16px', fontSize:10, fontWeight:600, color:COLORS.slate500, textTransform:'uppercase', letterSpacing:'0.08em', borderRight:`1px solid ${COLORS.slate100}` }}>Actividad</div>
        <div style={{ flex:1, position:'relative', height:40, overflow:'hidden' }}>
          {encabezados.map((m,i) => (
            <div key={i} style={{ position:'absolute', left:m.px, top:0, bottom:0, display:'flex', alignItems:'center', paddingLeft:10, borderLeft:`1px solid ${COLORS.slate100}` }}>
              <span style={{ fontSize:11, fontWeight:500, color:COLORS.slate500, whiteSpace:'nowrap', textTransform:'uppercase', letterSpacing:'0.06em' }}>{m.label}</span>
            </div>
          ))}
          {timelineW > 0 && (
            <div style={{ position:'absolute', left:dayToPx(toStr(hoy)), top:0, bottom:0, width:2, background:COLORS.red, opacity:0.9, zIndex:2 }}>
              <span style={{ position:'absolute', top:4, left:6, fontSize:9, fontWeight:700, color:COLORS.red, letterSpacing:'0.08em' }}>HOY</span>
            </div>
          )}
        </div>
      </div>

      <div style={{ position:'relative' }}>
        {hoveredFlecha && (
          <div style={{ position:'absolute', left:hoveredFlecha.x + PANEL_W + 10, top:hoveredFlecha.y - 30, zIndex:100, background:COLORS.navy, color:'white', padding:'6px 10px', borderRadius:6, fontSize:11, pointerEvents:'none', boxShadow:'0 4px 12px rgba(0,0,0,0.15)', whiteSpace:'nowrap' }}>
            <div style={{ fontWeight:600 }}>{TIPOS_DEP[hoveredFlecha.tipo].label}</div>
            <div style={{ fontSize:10, opacity:0.9, marginTop:2 }}>#{hoveredFlecha.toId} depende de #{hoveredFlecha.fromId}{hoveredFlecha.lag!==0?` (${hoveredFlecha.lag>0?'+':''}${hoveredFlecha.lag}d)`:''}</div>
          </div>
        )}

        {timelineW > 0 && (
          <svg style={{ position:'absolute', left:PANEL_W, top:0, width:timelineW, height:totalH, pointerEvents:'none', zIndex:5, overflow:'visible' }}>
            <defs>
              <marker id="arr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 z" fill={COLORS.slate400}/></marker>
              <marker id="arrCrit" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 z" fill={COLORS.red}/></marker>
              <marker id="arrH" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L0,7 L7,3.5 z" fill={COLORS.navy}/></marker>
            </defs>
            {franjasFinSemana.map((f,i) => <rect key={i} x={f.px} y={0} width={f.width} height={totalH} fill="#F8FAFC" opacity={0.8}/>)}
            {flechas.map(f => {
              const isH = hoveredFlecha?.key === f.key
              const esC = mostrarCritica && f.critica
              const color = isH ? COLORS.navy : (esC ? COLORS.red : COLORS.slate400)
              const marker = isH ? 'url(#arrH)' : (esC ? 'url(#arrCrit)' : 'url(#arr)')
              return (
                <g key={f.key} style={{ pointerEvents:'auto', cursor:'pointer' }}
                  onMouseEnter={() => setHoveredFlecha({ ...f, x:(f.x1+f.x2)/2, y:(f.y1+f.y2)/2 })}
                  onMouseLeave={() => setHoveredFlecha(null)}>
                  <path d={`M${f.x1},${f.y1} C${(f.x1+f.x2)/2},${f.y1} ${(f.x1+f.x2)/2},${f.y2} ${f.x2},${f.y2}`} fill="none" stroke={color} strokeWidth={isH ? "2" : "1.5"} strokeDasharray={esC ? "" : "3,3"} markerEnd={marker}/>
                  <path d={`M${f.x1},${f.y1} C${(f.x1+f.x2)/2},${f.y1} ${(f.x1+f.x2)/2},${f.y2} ${f.x2},${f.y2}`} fill="none" stroke="transparent" strokeWidth="10"/>
                </g>
              )
            })}
          </svg>
        )}

        {filas.map((fila, i) => {
          if (fila.tipo === 'fase') {
            const col = fasesColapsadas[fila.fase]
            const actCount = actividades.filter(a => a.fase === fila.fase).length
            const done = actividades.filter(a => a.fase === fila.fase && a.completada).length
            return (
              <div key={fila.fase} style={{ display:'flex', alignItems:'center', height:FASE_H, background:'#F4F6FA', borderBottom:`1px solid ${COLORS.slate100}`, cursor:'pointer' }}
                onClick={() => setFasesColapsadas(prev => ({...prev, [fila.fase]: !prev[fila.fase]}))}>
                <div style={{ width:PANEL_W, flexShrink:0, padding:'0 16px', display:'flex', alignItems:'center', gap:10, borderRight:`1px solid ${COLORS.slate100}`, color:COLORS.navy }}>
                  <Icon.Chevron open={!col}/>
                  <span style={{ fontSize:12, fontWeight:600 }}>{fila.fase}</span>
                  <span style={{ fontSize:11, color:COLORS.slate500, fontWeight:400, marginLeft:'auto', fontFamily:'var(--font-mono)' }}>{done}/{actCount}</span>
                </div>
                <div style={{ flex:1, height:'100%' }}/>
              </div>
            )
          }

          const a = fila.actividad
          const esCritica = mostrarCritica && rutaCritica.has(a.id)
          const x = dayToPx(a.inicio)
          const w = a.esMilestone ? 14 : Math.max(8, dayToPx(a.fin) - x + pxPorDia)
          const base = baseline?.find(b => b.id === a.id)

          return (
            <div key={a.id} onMouseEnter={() => setHoveredId(a.id)} onMouseLeave={() => setHoveredId(null)}
              style={{ display:'flex', alignItems:'center', borderBottom:`1px solid ${COLORS.slate100}`, height:ROW_H, background: hoveredId===a.id ? '#FAFBFE' : (i%2===0?'white':'#FCFCFD') }}>
              <div style={{ width:PANEL_W, flexShrink:0, padding:'0 14px', display:'flex', alignItems:'center', gap:8, borderRight:`1px solid ${COLORS.slate100}`, height:'100%' }}>
                <span style={{ fontSize:10, fontFamily:'var(--font-mono)', color:COLORS.slate400, fontWeight:500, minWidth:24 }}>#{a.id}</span>
                <div onClick={() => onToggle(a.id)} style={{ width:15, height:15, borderRadius:4, border:`1.5px solid ${a.completada?COLORS.teal:'#CBD5E1'}`, background:a.completada?COLORS.teal:'white', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, cursor:'pointer', color:'white' }}>{a.completada && <Icon.Check/>}</div>
                {a.esMilestone && <span style={{ color:COLORS.navy, flexShrink:0 }}><Icon.Diamond/></span>}
                <span style={{ fontSize:12, color:a.completada?COLORS.slate400:COLORS.ink, textDecoration:a.completada?'line-through':'none', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontWeight:500, flex:1 }}>{a.nombre}</span>
                {hoveredId === a.id && <IconBtn onClick={() => onAbrirDetalle(a)} title="Ver detalles"><Icon.Info/></IconBtn>}
              </div>
              <div style={{ flex:1, position:'relative', height:'100%', overflow:'hidden' }}>
                {franjasFinSemana.map((f,fi) => <div key={fi} style={{ position:'absolute', left:f.px, top:0, bottom:0, width:f.width, background:'#F8FAFC', opacity:0.6, pointerEvents:'none' }}/>)}
                {encabezados.map((m,mi) => <div key={mi} style={{ position:'absolute', left:m.px, top:0, bottom:0, width:1, background:COLORS.slate100 }}/>)}
                {timelineW > 0 && <div style={{ position:'absolute', left:dayToPx(toStr(hoy)), top:0, bottom:0, width:2, background:COLORS.red, opacity:0.12, zIndex:1 }}/>}

                {/* Baseline bar */}
                {mostrarBaseline && base && timelineW > 0 && !a.esMilestone && (
                  <div style={{ position:'absolute', left:dayToPx(base.inicio), width:Math.max(8, dayToPx(base.fin) - dayToPx(base.inicio) + pxPorDia), top:'70%', height:5, background:'#C4B5FD', borderRadius:2, zIndex:2, opacity:0.7 }}/>
                )}

                {timelineW > 0 && (
                  a.esMilestone ? (
                    <div onClick={() => onAbrirDetalle(a)} style={{ position:'absolute', left:x-7, top:'50%', transform:'translateY(-50%) rotate(45deg)', width:14, height:14, background:COLORS.navy, zIndex:3, cursor:'pointer' }}/>
                  ) : (
                    <div style={{ position:'absolute', left:x, width:w, top:'22%', height:'46%', background:colorBarra(a), borderRadius:5, zIndex:3, opacity:a.estado==='Sin iniciar'&&!a.completada?0.5:1, overflow:'visible', boxShadow:'0 1px 3px rgba(10,37,64,0.15)', cursor: drag ? 'grabbing' : 'grab', border: esCritica ? `2px solid ${COLORS.red}` : 'none' }}>
                      <div onMouseDown={(e) => handleMouseDown(e, a, 'resize-start')} style={{ position:'absolute', left:0, top:0, bottom:0, width:6, cursor:'ew-resize', zIndex:4 }}/>
                      <div onMouseDown={(e) => handleMouseDown(e, a, 'move')} onClick={(e) => { if (!drag) onAbrirDetalle(a) }} style={{ position:'absolute', left:6, right:6, top:0, bottom:0, cursor:'grab', display:'flex', alignItems:'center', overflow:'hidden' }}>
                        <div style={{ position:'absolute', left:0, top:0, height:'100%', width:`${a.avance}%`, background:'rgba(255,255,255,0.22)' }}/>
                        <span style={{ fontSize:10, color:'white', fontWeight:600, paddingLeft:8, position:'relative', zIndex:1, whiteSpace:'nowrap', fontFamily:'var(--font-mono)' }}>{a.avance > 0 ? `${a.avance}%` : ''}</span>
                      </div>
                      <div onMouseDown={(e) => handleMouseDown(e, a, 'resize-end')} style={{ position:'absolute', right:0, top:0, bottom:0, width:6, cursor:'ew-resize', zIndex:4 }}/>
                    </div>
                  )
                )}
              </div>
            </div>
          )
        })}

        <button onClick={() => onAgregar(fases[fases.length-1] || 'Nueva fase')} style={{ width:'100%', padding:'10px 16px', background:'transparent', border:'none', fontSize:12, color:COLORS.slate500, cursor:'pointer', display:'flex', alignItems:'center', gap:8, textAlign:'left', borderTop:`1px solid ${COLORS.slate100}` }}><Icon.Plus/> Agregar actividad</button>
      </div>
    </div>
  )
}

// ============================================================
// TAB KANBAN
// ============================================================
function TabKanban({ actividades, onAbrirDetalle }) {
  const hoy = new Date(); hoy.setHours(0,0,0,0)
  const manana = new Date(hoy); manana.setDate(manana.getDate()+1)
  const semana = new Date(hoy); semana.setDate(semana.getDate()+7)
  const cols = [
    { key:'retraso', label:'Con retraso', color:COLORS.red, bg:'#FEF2F2', items: actividades.filter(a => toDate(a.fin)<hoy && a.avance<100) },
    { key:'hoy', label:'Hoy', color:COLORS.navy2, bg:'#E0EDFF', items: actividades.filter(a => { const f=toDate(a.fin); return f.getTime()===hoy.getTime()&&a.avance<100 }) },
    { key:'manana', label:'Mañana', color:COLORS.teal, bg:COLORS.tealLight, items: actividades.filter(a => { const f=toDate(a.fin); return f.getTime()===manana.getTime()&&a.avance<100 }) },
    { key:'semana', label:'Esta semana', color:COLORS.gold, bg:'#FEF3C7', items: actividades.filter(a => { const f=toDate(a.fin); return f>manana&&f<=semana&&a.avance<100 }) },
  ]
  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14 }}>
      {cols.map(col => (
        <div key={col.key}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10, padding:'10px 14px', background:col.bg, borderRadius:10 }}>
            <span style={{ fontSize:12, fontWeight:600, color:col.color }}>{col.label}</span>
            <span style={{ fontSize:11, fontWeight:600, color:col.color, background:'white', borderRadius:10, padding:'2px 8px', fontFamily:'var(--font-mono)' }}>{col.items.length}</span>
          </div>
          {col.items.length===0 && <div style={{ padding:20, textAlign:'center', color:COLORS.slate400, fontSize:12, border:`1px dashed ${COLORS.slate200}`, borderRadius:10 }}>Sin actividades</div>}
          {col.items.map(a => (
            <div key={a.id} onClick={() => onAbrirDetalle(a)} style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:10, padding:14, marginBottom:8, cursor:'pointer', transition:'all 0.15s', borderLeft:`3px solid ${PRIORIDADES[a.prioridad]?.color || COLORS.slate400}` }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(10,37,64,0.08)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}>
              <div style={{ fontSize:13, fontWeight:500, color:COLORS.ink, marginBottom:8 }}>{a.nombre}</div>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                <Avatar nombre={a.responsable} size={20}/>
                <span style={{ fontSize:11, color:COLORS.slate500 }}>{a.responsable}</span>
              </div>
              <div style={{ fontSize:10, color:COLORS.slate400, marginBottom:8, fontFamily:'var(--font-mono)' }}>Vence: {a.fin}</div>
              <BarraAvance avance={a.avance} color={col.color}/>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// ============================================================
// TAB WORKLOAD (carga por persona)
// ============================================================
function TabWorkload({ actividades, proyecto }) {
  const stats = proyecto.equipo.map(persona => {
    const asignadas = actividades.filter(a => a.responsable === persona && !a.completada && a.parentId === null)
    const horasTotal = asignadas.reduce((s, a) => s + (a.horasEstimadas || 0), 0)
    const horasReales = asignadas.reduce((s, a) => s + (a.horasReales || 0), 0)
    return { persona, asignadas, horasTotal, horasReales }
  })

  const maxHoras = Math.max(...stats.map(s => s.horasTotal), 100)

  return (
    <div style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, padding:24 }}>
      <h3 style={{ fontSize:14, fontWeight:600, color:COLORS.ink, margin:'0 0 6px' }}>Carga de trabajo por persona</h3>
      <p style={{ fontSize:12, color:COLORS.slate500, margin:'0 0 20px' }}>Horas estimadas pendientes vs horas reales registradas</p>

      {stats.map(s => (
        <div key={s.persona} style={{ marginBottom:20 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
            <Avatar nombre={s.persona} size={28}/>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:500, color:COLORS.ink }}>{s.persona}</div>
              <div style={{ fontSize:11, color:COLORS.slate500 }}>{s.asignadas.length} actividades activas</div>
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontSize:14, fontWeight:600, color:COLORS.navy, fontFamily:'var(--font-mono)' }}>{s.horasTotal}h</div>
              <div style={{ fontSize:10, color:COLORS.slate500, fontFamily:'var(--font-mono)' }}>registradas: {s.horasReales}h</div>
            </div>
          </div>
          <div style={{ height:8, background:COLORS.slate100, borderRadius:4, overflow:'hidden', display:'flex' }}>
            <div style={{ width:`${(s.horasTotal / maxHoras) * 100}%`, height:'100%', background: s.horasTotal > 160 ? COLORS.red : s.horasTotal > 80 ? COLORS.amber : COLORS.teal }}/>
          </div>
          {s.asignadas.length > 0 && (
            <div style={{ marginTop:8, display:'flex', flexWrap:'wrap', gap:4 }}>
              {s.asignadas.slice(0,5).map(a => (
                <span key={a.id} style={{ fontSize:10, padding:'2px 8px', background:COLORS.slate50, borderRadius:10, color:COLORS.slate600 }}>#{a.id} {a.nombre.slice(0,25)}{a.nombre.length>25?'...':''}</span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ============================================================
// TAB CALENDARIO
// ============================================================
function TabCalendario({ actividades, onAbrirDetalle }) {
  const [mes, setMes] = useState(new Date(2026, 5, 1))

  const primerDia = new Date(mes.getFullYear(), mes.getMonth(), 1)
  const ultimoDia = new Date(mes.getFullYear(), mes.getMonth()+1, 0)
  const diasAntes = primerDia.getDay()
  const totalDias = ultimoDia.getDate()

  const cells = []
  for (let i = 0; i < diasAntes; i++) cells.push(null)
  for (let d = 1; d <= totalDias; d++) cells.push(new Date(mes.getFullYear(), mes.getMonth(), d))

  const getActsDia = (fecha) => {
    if (!fecha) return []
    const fs = toStr(fecha)
    return actividades.filter(a => toDate(a.inicio) <= toDate(fs) && toDate(a.fin) >= toDate(fs))
  }

  return (
    <div style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, padding:20 }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
        <button onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth()-1, 1))} style={{ padding:'6px 10px', background:'white', border:`1px solid ${COLORS.slate200}`, borderRadius:6, cursor:'pointer', fontSize:12 }}>‹</button>
        <h3 style={{ fontSize:16, fontWeight:600, color:COLORS.ink, margin:0, flex:1, textTransform:'capitalize' }}>{mes.toLocaleDateString('es-MX', { month:'long', year:'numeric' })}</h3>
        <button onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth()+1, 1))} style={{ padding:'6px 10px', background:'white', border:`1px solid ${COLORS.slate200}`, borderRadius:6, cursor:'pointer', fontSize:12 }}>›</button>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:1, background:COLORS.slate100 }}>
        {['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'].map(d => <div key={d} style={{ background:COLORS.slate50, padding:'8px', textAlign:'center', fontSize:11, fontWeight:600, color:COLORS.slate500, textTransform:'uppercase' }}>{d}</div>)}
        {cells.map((cell, i) => {
          const acts = cell ? getActsDia(cell) : []
          const esHoy = cell && toStr(cell) === toStr(new Date())
          return (
            <div key={i} style={{ background:'white', minHeight:90, padding:6, position:'relative' }}>
              {cell && (
                <>
                  <div style={{ fontSize:11, fontWeight: esHoy ? 700 : 500, color: esHoy ? COLORS.red : COLORS.slate600, marginBottom:4 }}>{cell.getDate()}</div>
                  {acts.slice(0,3).map(a => (
                    <div key={a.id} onClick={() => onAbrirDetalle(a)} style={{ fontSize:10, padding:'2px 4px', background: ESTADOS[a.estado]?.bg, color: ESTADOS[a.estado]?.color, borderRadius:3, marginBottom:2, cursor:'pointer', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {a.nombre}
                    </div>
                  ))}
                  {acts.length > 3 && <div style={{ fontSize:9, color:COLORS.slate400 }}>+{acts.length-3} más</div>}
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ============================================================
// TAB RESUMEN
// ============================================================
function TabResumen({ proyecto, onUpdate, actividades }) {
  const [selectorEquipo, setSelectorEquipo] = useState(null)
  const [selectorDirector, setSelectorDirector] = useState(null)
  const [nuevoCampo, setNuevoCampo] = useState({ nombre:'', valor:'' })
  const diasRestantes = Math.ceil((toDate(proyecto.cierre) - new Date()) / 86400000)
  const avanceReal = actividades.length > 0 ? Math.round(actividades.filter(a=>!a.parentId).reduce((s,a) => s+a.avance,0) / actividades.filter(a=>!a.parentId).length) : 0
  const totalHorasEst = actividades.reduce((s,a) => s + (a.horasEstimadas||0), 0)
  const totalHorasReales = actividades.reduce((s,a) => s + (a.horasReales||0), 0)

  const addCustomField = () => {
    if (!nuevoCampo.nombre) return
    onUpdate({...proyecto, camposCustom:{...proyecto.camposCustom, [nuevoCampo.nombre]:nuevoCampo.valor}})
    setNuevoCampo({ nombre:'', valor:'' })
  }

  return (
    <>
      {selectorEquipo && <SelectorPersonas seleccionadas={proyecto.equipo} multiple={true} onChange={(eq) => onUpdate({...proyecto, equipo:eq})} onClose={() => setSelectorEquipo(null)} x={selectorEquipo.x} y={selectorEquipo.y}/>}
      {selectorDirector && <SelectorPersonas seleccionadas={[proyecto.director]} multiple={false} onChange={(n) => onUpdate({...proyecto, director:n})} onClose={() => setSelectorDirector(null)} x={selectorDirector.x} y={selectorDirector.y}/>}

      <div style={{ display:'grid', gridTemplateColumns:'1.3fr 1fr', gap:24 }}>
        <div>
          <div style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, padding:24 }}>
            <h3 style={{ fontSize:11, fontWeight:600, color:COLORS.slate500, marginBottom:16, textTransform:'uppercase', letterSpacing:'0.08em' }}>Información general</h3>
            <RowResumen label="Cliente"><EditableText value={proyecto.cliente} onChange={v => onUpdate({...proyecto, cliente:v})} style={{ fontSize:13, fontWeight:500, color:COLORS.ink }}/></RowResumen>
            <RowResumen label="Director">
              <span onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setSelectorDirector({ x:r.left, y:r.bottom+4 }) }} style={{ cursor:'pointer', display:'inline-flex', alignItems:'center', gap:8, padding:'2px 6px', margin:'-2px -6px', borderRadius:4 }}>
                <Avatar nombre={proyecto.director} size={22}/>
                <span style={{ fontSize:13, fontWeight:500, color:COLORS.ink }}>{proyecto.director}</span>
              </span>
            </RowResumen>
            <RowResumen label="Estado">
              <select value={proyecto.estado} onChange={e => onUpdate({...proyecto, estado:e.target.value})} style={{ border:'none', background:'transparent', fontSize:13, fontWeight:500, color:COLORS.ink, cursor:'pointer', outline:'none', fontFamily:'var(--font-sans)' }}>
                {Object.keys(ESTADOS_PROY).map(s => <option key={s}>{s}</option>)}
              </select>
            </RowResumen>
            <RowResumen label="Inicio"><input type="date" value={proyecto.inicio} onChange={e => onUpdate({...proyecto, inicio:e.target.value})} style={{ border:'none', background:'transparent', fontSize:13, fontWeight:500, color:COLORS.ink, fontFamily:'var(--font-mono)', cursor:'pointer', outline:'none' }}/></RowResumen>
            <RowResumen label="Cierre estimado"><input type="date" value={proyecto.cierre} onChange={e => onUpdate({...proyecto, cierre:e.target.value})} style={{ border:'none', background:'transparent', fontSize:13, fontWeight:500, color:COLORS.ink, fontFamily:'var(--font-mono)', cursor:'pointer', outline:'none' }}/></RowResumen>
            <RowResumen label="Días restantes"><span style={{ fontSize:13, fontWeight:500, color: diasRestantes<0?COLORS.red:COLORS.ink }}>{diasRestantes>0?`${diasRestantes} días`:`${Math.abs(diasRestantes)} días de retraso`}</span></RowResumen>
            <RowResumen label="Horas estimadas vs reales" last><span style={{ fontSize:13, fontWeight:500, color:COLORS.ink, fontFamily:'var(--font-mono)' }}>{totalHorasReales}h / {totalHorasEst}h</span></RowResumen>
          </div>

          <div style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, padding:24, marginTop:16 }}>
            <h3 style={{ fontSize:11, fontWeight:600, color:COLORS.slate500, marginBottom:12, textTransform:'uppercase', letterSpacing:'0.08em' }}>Alcance</h3>
            <EditableText value={proyecto.alcance} onChange={v => onUpdate({...proyecto, alcance:v})} multiline={true} style={{ fontSize:13, color:COLORS.slate600, lineHeight:1.65, display:'block' }}/>
          </div>

          <div style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, padding:24, marginTop:16 }}>
            <h3 style={{ fontSize:11, fontWeight:600, color:COLORS.slate500, marginBottom:14, textTransform:'uppercase', letterSpacing:'0.08em' }}>Campos personalizados</h3>
            {Object.entries(proyecto.camposCustom || {}).map(([k,v]) => (
              <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:`1px solid ${COLORS.slate100}` }}>
                <span style={{ fontSize:12, color:COLORS.slate500 }}>{k}</span>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <EditableText value={v} onChange={newV => onUpdate({...proyecto, camposCustom:{...proyecto.camposCustom, [k]:newV}})} style={{ fontSize:13, fontWeight:500, color:COLORS.ink }}/>
                  <IconBtn onClick={() => { const nuevo={...proyecto.camposCustom}; delete nuevo[k]; onUpdate({...proyecto, camposCustom:nuevo}) }} title="Eliminar"><Icon.X/></IconBtn>
                </div>
              </div>
            ))}
            <div style={{ display:'flex', gap:6, marginTop:12 }}>
              <input placeholder="Nombre del campo" value={nuevoCampo.nombre} onChange={e => setNuevoCampo({...nuevoCampo, nombre:e.target.value})} style={{ ...inputStyle, fontSize:12 }}/>
              <input placeholder="Valor" value={nuevoCampo.valor} onChange={e => setNuevoCampo({...nuevoCampo, valor:e.target.value})} style={{ ...inputStyle, fontSize:12 }}/>
              <button onClick={addCustomField} style={{ padding:'8px 14px', background:COLORS.navy, color:'white', border:'none', borderRadius:8, fontSize:12, cursor:'pointer', fontWeight:600 }}>+</button>
            </div>
          </div>
        </div>

        <div>
          <div style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, padding:28, marginBottom:16, textAlign:'center' }}>
            <h3 style={{ fontSize:11, fontWeight:600, color:COLORS.slate500, marginBottom:16, textTransform:'uppercase', letterSpacing:'0.08em' }}>Avance general</h3>
            <div style={{ fontSize:56, fontWeight:400, color:COLORS.navy, fontFamily:'var(--font-serif)', lineHeight:1, marginBottom:12 }}>{avanceReal}%</div>
            <BarraAvance avance={avanceReal} color={COLORS.navy2}/>
          </div>

          <div style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, padding:24 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
              <h3 style={{ fontSize:11, fontWeight:600, color:COLORS.slate500, textTransform:'uppercase', letterSpacing:'0.08em', margin:0 }}>Equipo ({proyecto.equipo.length})</h3>
              <button onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setSelectorEquipo({ x:r.left-200, y:r.bottom+4 }) }} style={{ padding:'4px 8px', background:'transparent', border:`1px solid ${COLORS.slate200}`, borderRadius:6, fontSize:11, color:COLORS.slate600, cursor:'pointer', display:'flex', alignItems:'center', gap:4 }}><Icon.Edit/> Editar</button>
            </div>
            {proyecto.equipo.map((n,i) => {
              const colab = COLABORADORES.find(c => c.nombre === n)
              return (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0' }}>
                  <Avatar nombre={n} size={32}/>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:500, color:COLORS.ink }}>{n}</div>
                    <div style={{ fontSize:11, color:COLORS.slate500 }}>{n === proyecto.director ? 'Director de Proyecto' : colab?.rol || 'Equipo'}</div>
                  </div>
                  {n !== proyecto.director && <IconBtn onClick={() => onUpdate({...proyecto, equipo: proyecto.equipo.filter(x => x !== n)})} title="Quitar"><Icon.X/></IconBtn>}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}

function RowResumen({ label, children, last=false }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 0', borderBottom: last ? 'none' : `1px solid ${COLORS.slate100}` }}>
      <span style={{ fontSize:12, color:COLORS.slate500 }}>{label}</span>
      <span>{children}</span>
    </div>
  )
}

// ============================================================
// DETALLE DE PROYECTO — CON TODO
// ============================================================
function DetalleProyecto({ proyecto: proyectoInicial, onVolver }) {
  const [proyecto, setProyecto] = useState(proyectoInicial)
  const [tab, setTab] = useState('resumen')
  const [panelActividad, setPanelActividad] = useState(null)
  const [mostrarCritica, setMostrarCritica] = useState(false)
  const [mostrarBaseline, setMostrarBaseline] = useState(false)
  const [alertasIgnoradas, setAlertasIgnoradas] = useState(false)
  const [buscadorOpen, setBuscadorOpen] = useState(false)
  const [filtro, setFiltro] = useState({})
  const [agrupacion, setAgrupacion] = useState('fase')
  const [menuFiltros, setMenuFiltros] = useState(false)

  // Undo/Redo
  const [historial, setHistorial] = useState([proyectoInicial])
  const [idxHist, setIdxHist] = useState(0)
  const puedeUndo = idxHist > 0
  const puedeRedo = idxHist < historial.length - 1

  const guardarHistorial = useCallback((nuevoProyecto) => {
    const nuevo = [...historial.slice(0, idxHist+1), nuevoProyecto]
    setHistorial(nuevo.slice(-30)) // max 30 pasos
    setIdxHist(Math.min(nuevo.length - 1, 29))
  }, [historial, idxHist])

  const undo = () => { if (puedeUndo) { setIdxHist(idxHist-1); setProyecto(historial[idxHist-1]) } }
  const redo = () => { if (puedeRedo) { setIdxHist(idxHist+1); setProyecto(historial[idxHist+1]) } }

  // Atajos Cmd+K, Cmd+Z, Cmd+Shift+Z
  useEffect(() => {
    const h = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setBuscadorOpen(true) }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); redo() }
    }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [undo, redo])

  const actividades = proyecto.actividades

  const updateProyecto = (nuevo, guardar=true) => {
    setProyecto(nuevo)
    if (guardar) guardarHistorial(nuevo)
  }

  const setActividades = (nuevas, guardar=true) => {
    const nuevasConRollup = aplicarRollup(nuevas)
    const nuevoProy = {...proyecto, actividades:nuevasConRollup}
    setProyecto(nuevoProy)
    if (guardar) guardarHistorial(nuevoProy)
  }

  const toggleActividad = (id) => setActividades(actividades.map(a => a.id===id ? {...a, completada:!a.completada, avance:!a.completada?100:0, estado:!a.completada?'Completada':'Sin iniciar'} : a))

  const updateActividad = (updated, conCascada=false) => {
    let nuevas = actividades.map(a => a.id===updated.id ? updated : a)
    if (conCascada) nuevas = recalcularCascada(nuevas, updated.id)
    setActividades(nuevas)
    if (panelActividad && panelActividad.id === updated.id) setPanelActividad(updated)
  }

  const ajustarFechasAuto = () => {
    let nuevas = [...actividades]
    const alertas = detectarAlertas(nuevas)
    alertas.forEach(alerta => {
      const idx = nuevas.findIndex(a => a.id === alerta.actividad.id)
      if (idx >= 0) {
        const duracion = diffDays(nuevas[idx].inicio, nuevas[idx].fin)
        nuevas[idx].inicio = alerta.deberiaIniciar
        nuevas[idx].fin = addDays(alerta.deberiaIniciar, duracion)
        nuevas = recalcularCascada(nuevas, nuevas[idx].id)
      }
    })
    setActividades(nuevas)
  }

  const deleteActividad = (id) => {
    setActividades(actividades.filter(a => a.id !== id && a.parentId !== id))
    setPanelActividad(null)
  }

  const duplicarActividad = (a) => {
    const newId = Math.max(...actividades.map(x=>x.id), 0) + 1
    setActividades([...actividades, {...a, id:newId, nombre:`${a.nombre} (copia)`, completada:false, avance:0, estado:'Sin iniciar', comentarios:[], historial:[], horasReales:0}])
  }

  const agregarActividad = (fase, parentId=null) => {
    const newId = Math.max(...actividades.map(x=>x.id), 0) + 1
    const hoy = new Date().toISOString().split('T')[0]
    const semana = new Date(); semana.setDate(semana.getDate()+7)
    setActividades([...actividades, {
      id:newId, nombre: parentId ? 'Nueva subtarea' : 'Nueva actividad', fase,
      responsable:proyecto.director, inicio:hoy, fin:semana.toISOString().split('T')[0],
      avance:0, estado:'Sin iniciar', deps:[], completada:false, notas:'', parentId, esMilestone:false,
      prioridad:'Media', tags:[], horasEstimadas:0, horasReales:0, checklist:[], comentarios:[], adjuntos:[], historial:[]
    }])
  }

  const setBaseline = () => {
    const snapshot = actividades.map(a => ({ id:a.id, inicio:a.inicio, fin:a.fin }))
    updateProyecto({...proyecto, baseline: snapshot})
    setMostrarBaseline(true)
  }

  const clearBaseline = () => {
    updateProyecto({...proyecto, baseline: null})
    setMostrarBaseline(false)
  }

  const exportarGantt = () => window.print()

  const rutaCritica = useMemo(() => calcularRutaCritica(actividades), [actividades])
  const alertas = useMemo(() => alertasIgnoradas ? [] : detectarAlertas(actividades), [actividades, alertasIgnoradas])

  const tabs = [
    { key:'resumen', label:'Resumen', icon:<Icon.Info/> },
    { key:'actividades', label:'Actividades', icon:<Icon.Bars/> },
    { key:'gantt', label:'Gantt', icon:<Icon.Zap/> },
    { key:'kanban', label:'Kanban', icon:<Icon.Bars/> },
    { key:'calendario', label:'Calendario', icon:<Icon.Calendar/> },
    { key:'workload', label:'Carga', icon:<Icon.Users/> },
  ]

  return (
    <div>
      <Buscador open={buscadorOpen} onClose={() => setBuscadorOpen(false)} actividades={actividades} onSelect={(a) => { setTab('actividades'); setPanelActividad(a) }}/>

      {panelActividad && (
        <PanelDetalle actividad={panelActividad} actividades={actividades}
          onClose={() => setPanelActividad(null)}
          onSave={(updated) => { updateActividad(updated, true); setPanelActividad(null) }}
          onDelete={(id) => deleteActividad(id)}
          baseline={proyecto.baseline?.find(b => b.id === panelActividad.id)}/>
      )}

      <div style={{ display:'flex', alignItems:'flex-start', gap:16, marginBottom:24 }}>
        <button onClick={onVolver} style={{ padding:'8px 12px', background:'white', border:`1px solid ${COLORS.slate200}`, borderRadius:8, fontSize:13, cursor:'pointer', color:COLORS.slate600, display:'flex', alignItems:'center', gap:6, fontWeight:500 }}>
          <Icon.Back/> Proyectos
        </button>
        <div style={{ flex:1 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
            <span style={{ fontSize:11, fontFamily:'var(--font-mono)', color:COLORS.slate400, fontWeight:500 }}>{proyecto.id}</span>
            <Badge texto={proyecto.estado} mapa={ESTADOS_PROY}/>
          </div>
          <EditableText value={proyecto.nombre} onChange={v => updateProyecto({...proyecto, nombre:v})} style={{ fontSize:28, fontWeight:500, color:COLORS.navy, letterSpacing:'-0.02em', fontFamily:'var(--font-serif)', lineHeight:1.15, display:'block' }}/>
          <p style={{ fontSize:13, color:COLORS.slate500, margin:'4px 0 0' }}>{proyecto.cliente}</p>
        </div>

        {/* Toolbar global */}
        <div style={{ display:'flex', gap:4 }}>
          <IconBtn onClick={undo} title="Deshacer (Cmd+Z)" active={!puedeUndo} color={puedeUndo ? COLORS.slate600 : COLORS.slate400}><Icon.Undo/></IconBtn>
          <IconBtn onClick={redo} title="Rehacer (Cmd+Shift+Z)" color={puedeRedo ? COLORS.slate600 : COLORS.slate400}><Icon.Redo/></IconBtn>
          <IconBtn onClick={() => setBuscadorOpen(true)} title="Buscar (Cmd+K)"><Icon.Search/></IconBtn>
          <IconBtn onClick={exportarGantt} title="Imprimir / PDF"><Icon.Print/></IconBtn>
        </div>

        <button onClick={() => setMostrarCritica(!mostrarCritica)} style={{ padding:'8px 14px', background: mostrarCritica ? COLORS.red : 'white', color: mostrarCritica ? 'white' : COLORS.slate600, border:`1px solid ${mostrarCritica ? COLORS.red : COLORS.slate200}`, borderRadius:8, fontSize:12, fontWeight:500, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
          <Icon.Flag/> Ruta crítica
        </button>

        {proyecto.baseline ? (
          <div style={{ display:'flex', gap:4 }}>
            <button onClick={() => setMostrarBaseline(!mostrarBaseline)} style={{ padding:'8px 14px', background: mostrarBaseline ? COLORS.purple : 'white', color: mostrarBaseline ? 'white' : COLORS.slate600, border:`1px solid ${mostrarBaseline ? COLORS.purple : COLORS.slate200}`, borderRadius:8, fontSize:12, fontWeight:500, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
              <Icon.History/> Baseline
            </button>
            <IconBtn onClick={clearBaseline} title="Quitar baseline"><Icon.X/></IconBtn>
          </div>
        ) : (
          <button onClick={setBaseline} style={{ padding:'8px 14px', background:'white', color:COLORS.slate600, border:`1px solid ${COLORS.slate200}`, borderRadius:8, fontSize:12, fontWeight:500, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
            <Icon.History/> Guardar baseline
          </button>
        )}
      </div>

      {(tab === 'actividades' || tab === 'gantt') && <AlertaDesfases alertas={alertas} onAjustar={ajustarFechasAuto} onIgnorar={() => setAlertasIgnoradas(true)}/>}

      <div style={{ display:'flex', borderBottom:`1px solid ${COLORS.slate200}`, marginBottom:24, gap:2, alignItems:'center' }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{ padding:'10px 16px', border:'none', background:'transparent', cursor:'pointer', fontSize:13, fontWeight: tab===t.key?600:500, color: tab===t.key?COLORS.navy:COLORS.slate500, borderBottom: tab===t.key?`2px solid ${COLORS.navy}`:'2px solid transparent', marginBottom:-1, display:'flex', alignItems:'center', gap:6 }}>
            {t.icon} {t.label}
          </button>
        ))}

        <div style={{ flex:1 }}/>

        {tab === 'actividades' && (
          <div style={{ display:'flex', gap:6, alignItems:'center' }}>
            <input placeholder="Buscar..." value={filtro.busqueda||''} onChange={e => setFiltro({...filtro, busqueda:e.target.value})} style={{ padding:'6px 10px', border:`1px solid ${COLORS.slate200}`, borderRadius:6, fontSize:12, outline:'none', width:160, fontFamily:'var(--font-sans)' }}/>
            <select value={filtro.responsable||''} onChange={e => setFiltro({...filtro, responsable:e.target.value||null})} style={{ padding:'6px 10px', border:`1px solid ${COLORS.slate200}`, borderRadius:6, fontSize:12, background:'white', cursor:'pointer', fontFamily:'var(--font-sans)' }}>
              <option value="">Todas las personas</option>
              {NOMBRES.map(n => <option key={n}>{n}</option>)}
            </select>
            <select value={filtro.estado||''} onChange={e => setFiltro({...filtro, estado:e.target.value||null})} style={{ padding:'6px 10px', border:`1px solid ${COLORS.slate200}`, borderRadius:6, fontSize:12, background:'white', cursor:'pointer', fontFamily:'var(--font-sans)' }}>
              <option value="">Todos los estados</option>
              {Object.keys(ESTADOS).map(s => <option key={s}>{s}</option>)}
            </select>
            <select value={agrupacion} onChange={e => setAgrupacion(e.target.value)} style={{ padding:'6px 10px', border:`1px solid ${COLORS.slate200}`, borderRadius:6, fontSize:12, background:'white', cursor:'pointer', fontFamily:'var(--font-sans)' }}>
              <option value="fase">Agrupar: Fase</option>
              <option value="responsable">Agrupar: Responsable</option>
              <option value="prioridad">Agrupar: Prioridad</option>
              <option value="estado">Agrupar: Estado</option>
            </select>
          </div>
        )}
      </div>

      {tab==='resumen' && <TabResumen proyecto={proyecto} onUpdate={updateProyecto} actividades={actividades}/>}
      {tab==='actividades' && <TabActividades actividades={actividades} onToggle={toggleActividad} onUpdate={(a) => updateActividad(a, true)} onDelete={deleteActividad} onAgregar={agregarActividad} onAbrirDetalle={setPanelActividad} onDuplicar={duplicarActividad} rutaCritica={rutaCritica} mostrarCritica={mostrarCritica} filtro={filtro} agrupacion={agrupacion} baseline={proyecto.baseline}/>}
      {tab==='gantt' && <TabGantt actividades={actividades} onToggle={toggleActividad} onUpdate={(a,cascada) => updateActividad(a, cascada)} onAbrirDetalle={setPanelActividad} onAgregar={agregarActividad} rutaCritica={rutaCritica} mostrarCritica={mostrarCritica} baseline={proyecto.baseline} mostrarBaseline={mostrarBaseline}/>}
      {tab==='kanban' && <TabKanban actividades={actividades} onAbrirDetalle={setPanelActividad}/>}
      {tab==='calendario' && <TabCalendario actividades={actividades} onAbrirDetalle={setPanelActividad}/>}
      {tab==='workload' && <TabWorkload actividades={actividades} proyecto={proyecto}/>}
    </div>
  )
}

// ============================================================
// LISTA DE PROYECTOS
// ============================================================
export default function Proyectos() {
  const [proyectos, setProyectos] = useState(PROYECTOS_INICIALES)
  const [proyectoSeleccionadoId, setProyectoSeleccionadoId] = useState(null)

  const proyectoSeleccionado = proyectos.find(p => p.id === proyectoSeleccionadoId)

  const onVolver = () => setProyectoSeleccionadoId(null)

  if (proyectoSeleccionado) return <DetalleProyecto key={proyectoSeleccionado.id} proyecto={proyectoSeleccionado} onVolver={onVolver}/>

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:28 }}>
        <div>
          <h1 style={{ fontSize:32, fontWeight:400, color:COLORS.navy, margin:0, letterSpacing:'-0.02em', fontFamily:'var(--font-serif)' }}>Proyectos</h1>
          <p style={{ color:COLORS.slate500, fontSize:13, marginTop:6 }}>{proyectos.length} proyectos en el sistema</p>
        </div>
        <button style={{ padding:'10px 20px', background:COLORS.navy, color:'white', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}><Icon.Plus/> Nuevo proyecto</button>
      </div>
      <div style={{ display:'grid', gap:10 }}>
        {proyectos.map(p => {
          const avance = p.actividades.filter(a=>!a.parentId).reduce((s,a)=>s+a.avance,0) / Math.max(1, p.actividades.filter(a=>!a.parentId).length)
          return (
            <div key={p.id} onClick={() => setProyectoSeleccionadoId(p.id)}
              style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderLeft:`3px solid ${ESTADOS_PROY[p.estado]?.bar || COLORS.slate400}`, borderRadius:12, padding:'18px 22px', cursor:'pointer', transition:'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow='0 4px 16px rgba(10,37,64,0.06)' }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow='none' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                    <span style={{ fontSize:11, fontFamily:'var(--font-mono)', color:COLORS.slate400, fontWeight:500 }}>{p.id}</span>
                    <Badge texto={p.estado} mapa={ESTADOS_PROY}/>
                  </div>
                  <div style={{ fontSize:17, fontWeight:500, color:COLORS.ink, marginBottom:3 }}>{p.nombre}</div>
                  <div style={{ fontSize:12, color:COLORS.slate500 }}>{p.cliente} · {p.director} · {p.equipo.length} personas</div>
                </div>
                <div style={{ fontSize:11, color:COLORS.slate400, fontFamily:'var(--font-mono)' }}>Cierre: {p.cierre}</div>
              </div>
              <BarraAvance avance={avance} color={COLORS.navy2}/>
            </div>
          )
        })}
      </div>
    </div>
  )
}