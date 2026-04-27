import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
// v15.2: exportGantt se importa dinámicamente al hacer click (jspdf+exceljs son ~1.4MB)
import {
  supabase, getProyectos, getProyectoConActividades, getUsuarios, getClientes,
  getPlantillas, getPlantillaActividades, crearProyectoDesdePlantilla,
  actualizarActividad, crearActividad, desglosarActividadConPlantilla,
  agregarDependencia, quitarDependencia, recalcularFechasDesde,
  // v13.3: recalcular padre cuando se mueve un hijo
  recalcularPadre,
  // v7: helpers agregados
  getHitosProyecto, getNotasProyecto, crearNotaProyecto, eliminarNota, extraerMenciones,
  // v8: helpers nuevos
  duplicarActividad, eliminarActividad, cambiarImportancia,
  // v12: helpers nuevos
  duplicarProyecto, calcularAvancePonderado, validarSumaPesos, marcarCobrable,
  // v15.7: workflow SIM
  ETAPAS_SIM, ESTADOS_SIM, getProyectoSimEtapas, upsertEtapaSim,
} from './supabase'

// v14.1: helpers para persistir preferencias simples en localStorage
const loadPref = (key, fallback) => {
  try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v) }
  catch { return fallback }
}
const savePref = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch {}
}

const COLORS = {
  navy:'#0A2540', navy2:'#1B3A6B', teal:'#0F6E56', tealLight:'#E1F5EE',
  gold:'#C89B3C', red:'#DC2626', amber:'#D97706', purple:'#6B4C9A',
  blue:'#3B82F6', green:'#10B981',
  slate50:'#F8FAFC', slate100:'#F1F5F9', slate200:'#E2E8F0',
  slate400:'#94A3B8', slate500:'#64748B', slate600:'#475569', ink:'#1C2128'
}

const ESTADOS = {
  'Completada': { bg:'#E1F5EE', color:'#0F6E56', bar:'#10B981', gradient:'linear-gradient(135deg, #10B981 0%, #059669 100%)' },
  'En progreso': { bg:'#E0EDFF', color:'#1B3A6B', bar:'#3B82F6', gradient:'linear-gradient(135deg, #60A5FA 0%, #3B82F6 100%)' },
  'Sin iniciar': { bg:'#F1F5F9', color:'#64748B', bar:'#94A3B8', gradient:'linear-gradient(135deg, #CBD5E1 0%, #94A3B8 100%)' },
  'Retrasada': { bg:'#FEF2F2', color:'#DC2626', bar:'#EF4444', gradient:'linear-gradient(135deg, #F87171 0%, #DC2626 100%)' },
  'Bloqueada': { bg:'#FEF3C7', color:'#D97706', bar:'#F59E0B', gradient:'linear-gradient(135deg, #FBBF24 0%, #D97706 100%)' }
}

const ESTADOS_PROY = {
  'En curso': { bg:'#E0EDFF', color:'#1B3A6B', bar:'#1B3A6B' },
  'Terminado': { bg:'#E1F5EE', color:'#0F6E56', bar:'#0F6E56' },
  'Por iniciar': { bg:'#FEF3C7', color:'#D97706', bar:'#D97706' },
  'En pausa': { bg:'#FEF2F2', color:'#DC2626', bar:'#DC2626' },
  'Cancelado': { bg:'#FEF2F2', color:'#DC2626', bar:'#DC2626' }
}

const ESTADOS_HITO = {
  'Pagado': { bg:'#E1F5EE', color:'#0F6E56', sem:'#0F6E56' },
  'Facturado': { bg:'#E0EDFF', color:'#1B3A6B', sem:'#3B82F6' },
  'Pendiente': { bg:'#FEF3C7', color:'#D97706', sem:'#F59E0B' },
  'Vencido': { bg:'#FEF2F2', color:'#DC2626', sem:'#DC2626' },
  'Cancelado': { bg:'#F1F5F9', color:'#64748B', sem:'#94A3B8' },
}

// v8: Importancia (prioridad) de actividad
const IMPORTANCIA = {
  'alta':  { label:'Alta',  bg:'#FEF2F2', color:'#DC2626', dot:'#DC2626' },
  'media': { label:'Media', bg:'#FEF3C7', color:'#D97706', dot:'#F59E0B' },
  'baja':  { label:'Baja',  bg:'#E0EDFF', color:'#1B3A6B', dot:'#3B82F6' },
}

// v12: Clasificación A/B/C (pide Luis)
const CLASIFICACION = {
  'A': { label:'Clase A', bg:'#FEF2F2', color:'#991B1B', dot:'#DC2626' },
  'B': { label:'Clase B', bg:'#FEF3C7', color:'#854F0B', dot:'#D97706' },
  'C': { label:'Clase C', bg:'#E0EDFF', color:'#1E3A8A', dot:'#3B82F6' },
}

// v12: Prioridad Alta/Media/Baja
const PRIORIDAD = {
  'Alta':  { label:'Alta',  bg:'#FEF2F2', color:'#DC2626', dot:'#DC2626' },
  'Media': { label:'Media', bg:'#FEF3C7', color:'#D97706', dot:'#F59E0B' },
  'Baja':  { label:'Baja',  bg:'#F0FDF4', color:'#15803D', dot:'#22C55E' },
}

// v12: Tipos de proyecto
const TIPOS_PROYECTO = ['Conexión', 'Interconexión', 'Almacenamiento', 'Estudios Eléctricos', 'Otros']

// v12: Estados de cobro
const ESTADOS_COBRO = {
  'NA':         { label:'N/A',         bg:'#F1F5F9', color:'#64748B' },
  'Pendiente':  { label:'Pendiente',   bg:'#FEF3C7', color:'#D97706' },
  'En proceso': { label:'En proceso',  bg:'#E0EDFF', color:'#1B3A6B' },
  'Cobrado':    { label:'Cobrado',     bg:'#E1F5EE', color:'#0F6E56' },
}

const toDate = s => s ? new Date(s + 'T00:00:00') : new Date()
const toStr = d => d.toISOString().split('T')[0]
const diffDays = (a, b) => Math.round((toDate(b) - toDate(a)) / 86400000)
const addDays = (s, n) => { const d = toDate(s); d.setDate(d.getDate()+n); return toStr(d) }
const fmtDate = s => {
  if (!s) return '—'
  const d = toDate(s)
  const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
  return `${d.getDate()} ${meses[d.getMonth()]} ${d.getFullYear()}`
}
const fmtMoney = n => n == null ? '—' : n.toLocaleString('es-MX', { style:'currency', currency:'MXN', minimumFractionDigits:0 })

function generarNumeracion(actividades) {
  const porPadre = {}
  actividades.forEach(a => {
    const key = a.parent_id || 'root'
    if (!porPadre[key]) porPadre[key] = []
    porPadre[key].push(a)
  })
  Object.keys(porPadre).forEach(k => porPadre[k].sort((a,b) => (a.numero||0) - (b.numero||0)))
  const numeros = {}
  const asignar = (parentId, prefijo) => {
    const hijos = porPadre[parentId || 'root'] || []
    hijos.forEach((hijo, i) => {
      const nuevoNum = prefijo ? `${prefijo}.${i+1}` : `${i+1}`
      numeros[hijo.id] = nuevoNum
      asignar(hijo.id, nuevoNum)
    })
  }
  asignar(null, '')
  return numeros
}

// ============================================================
// v14.1 — CRITICAL PATH METHOD (CPM)
// Algoritmo estándar PMI/MS Project:
// 1. Forward pass: calcula ES (Early Start) y EF (Early Finish)
//    - ES = max(EF de predecesoras), EF = ES + duración
// 2. Backward pass: calcula LS (Late Start) y LF (Late Finish)
//    - LF = min(LS de sucesoras), LS = LF - duración
// 3. Total Float (holgura) = LS - ES
// 4. Actividad crítica ↔ float = 0 → retrasarla atrasa todo el proyecto
//
// Retorna un mapa: { [actId]: { es, ef, ls, lf, float, critica } }
// con fechas en ms desde epoch para cálculos precisos.
// ============================================================
function calcularRutaCritica(actividades) {
  // Solo trabajamos con actividades que NO son padres (hojas del árbol)
  // Los padres son contenedores visuales, no nodos del grafo CPM.
  const hijos = actividades.filter(a => !a.es_servicio_padre)
  if (hijos.length === 0) return {}

  const cpm = {}
  const byId = {}
  hijos.forEach(a => {
    byId[a.id] = a
    const iniMs = toDate(a.inicio).getTime()
    const finMs = toDate(a.fin).getTime()
    const durDias = Math.max(0, Math.round((finMs - iniMs) / 86400000))
    cpm[a.id] = {
      iniMs, finMs, durDias,
      es: null, ef: null, ls: null, lf: null,
      float: null, critica: false,
    }
  })

  // Filtrar deps: solo apuntan a hijos que existen en el mapa
  const depsDe = (actId) => {
    const act = byId[actId]
    if (!act || !act.deps) return []
    return act.deps.map(d => d.id).filter(id => byId[id])
  }

  // ========== FORWARD PASS ==========
  // Procesar en orden topológico (memoizado con DFS)
  const calcES = (id, pila = new Set()) => {
    if (cpm[id].es !== null) return cpm[id].ef
    if (pila.has(id)) return cpm[id].iniMs  // ciclo: fallback a fecha actual
    pila.add(id)

    const preds = depsDe(id)
    let es
    if (preds.length === 0) {
      // Sin predecesoras: ES = fecha planeada de inicio
      es = cpm[id].iniMs
    } else {
      // ES = max(EF de todas las predecesoras) + 1 día (FS)
      es = preds.reduce((max, predId) => {
        const predEf = calcES(predId, pila)
        const efSiguiente = predEf + 86400000  // +1 día por FS estricto
        return efSiguiente > max ? efSiguiente : max
      }, cpm[id].iniMs)  // o la fecha planeada original si es más tardía
    }

    cpm[id].es = es
    cpm[id].ef = es + cpm[id].durDias * 86400000
    pila.delete(id)
    return cpm[id].ef
  }

  hijos.forEach(a => calcES(a.id))

  // Fecha final del proyecto = max EF
  const projectEnd = Object.values(cpm).reduce((max, c) => c.ef > max ? c.ef : max, 0)

  // ========== BACKWARD PASS ==========
  // Sucesoras: actividades que tienen a `id` en sus deps
  const sucesorasDe = (id) => hijos.filter(h => (h.deps || []).some(d => d.id === id)).map(h => h.id)

  const calcLF = (id, pila = new Set()) => {
    if (cpm[id].lf !== null) return cpm[id].ls
    if (pila.has(id)) return cpm[id].ef
    pila.add(id)

    const sucs = sucesorasDe(id)
    let lf
    if (sucs.length === 0) {
      // Sin sucesoras: LF = fin del proyecto
      lf = projectEnd
    } else {
      // LF = min(LS de sucesoras) - 1 día (FS inverso)
      lf = sucs.reduce((min, sucId) => {
        const sucLs = calcLF(sucId, pila)
        const lsAnterior = sucLs - 86400000  // -1 día
        return lsAnterior < min ? lsAnterior : min
      }, Infinity)
    }

    cpm[id].lf = lf
    cpm[id].ls = lf - cpm[id].durDias * 86400000
    pila.delete(id)
    return cpm[id].ls
  }

  hijos.forEach(a => calcLF(a.id))

  // ========== FLOAT + CRÍTICAS ==========
  Object.keys(cpm).forEach(id => {
    const c = cpm[id]
    if (c.ls !== null && c.es !== null) {
      c.float = Math.round((c.ls - c.es) / 86400000)
      // Tolerancia: considerar crítica si float <= 0 (puede ser negativo si hay atraso)
      c.critica = c.float <= 0
    }
  })

  return cpm
}

// v15.4: Iconos locales estandarizados — stroke 1.8 + caps round (matching Sidebar)
// Excepciones: Check (3.5 por tamaño chico), Diamond (filled, sin stroke)
const Icon = {
  Back:()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>,
  Plus:()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>,
  X:()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>,
  Check:()=><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>,
  Search:()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>,
  Diamond:()=><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2 22 12 12 22 2 12z"/></svg>,
  Link:()=><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
  Trash:()=><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>,
  Scale:()=><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10M12 3v18M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/></svg>,
  Info:()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>,
  Pencil:()=><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>,
  ChevronDown:()=><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>,
  ChevronRight:()=><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>,
  Calendar:()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  User:()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  Lock:()=><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  Warning:()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  Folder:()=><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>,
  FileText:()=><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  Upload:()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  Send:()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  Kanban:()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="6" height="14" rx="1"/><rect x="10" y="3" width="6" height="10" rx="1"/><rect x="17" y="3" width="4" height="7" rx="1"/></svg>,
  Users:()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  Dollar:()=><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  // v8 — iconos menú contextual
  Copy:()=><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>,
  Flag:()=><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>,
  Duplicate:()=><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>,
  Eye:()=><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
}

function Badge({ texto, mapa, tamano=11 }) {
  const c = mapa[texto] || { bg:'#F1F5F9', color:'#64748B' }
  return <span style={{ display:'inline-flex', alignItems:'center', fontSize:tamano, fontWeight:500, padding:'3px 10px', borderRadius:20, background:c.bg, color:c.color, whiteSpace:'nowrap' }}>{texto}</span>
}

function BarraAvance({ avance, color=COLORS.navy2, height=5 }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:100 }}>
      <div style={{ flex:1, height, background:'#EEF2F6', borderRadius:height/2, overflow:'hidden' }}>
        <div style={{ width:`${avance||0}%`, height:'100%', background: avance===100?COLORS.teal:color, borderRadius:height/2, transition:'width 0.3s' }}/>
      </div>
      <span style={{ fontSize:11, fontWeight:600, color:avance===100?COLORS.teal:color, minWidth:32, fontFamily:'var(--font-mono)' }}>{avance||0}%</span>
    </div>
  )
}

function Avatar({ nombre, color, tamano=28 }) {
  const colores = [COLORS.navy, COLORS.teal, COLORS.gold, COLORS.purple, COLORS.blue]
  const parts = (nombre || '?').trim().split(' ')
  const init = ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?'
  const bg = color || colores[(nombre || '').length % colores.length]
  return (
    <div title={nombre} style={{
      width:tamano, height:tamano, borderRadius:'50%',
      background:bg, color:'white', display:'inline-flex',
      alignItems:'center', justifyContent:'center',
      fontSize: tamano * 0.36, fontWeight:700, flexShrink:0,
      border:'2px solid white', boxShadow:'0 1px 3px rgba(0,0,0,0.15)',
    }}>{init}</div>
  )
}

function useIsMobile() {
  const [m, setM] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false)
  useEffect(() => { const h = () => setM(window.innerWidth < 768); window.addEventListener('resize', h); return () => window.removeEventListener('resize', h) }, [])
  return m
}

const labelStyle = { fontSize:10, fontWeight:700, color:COLORS.slate500, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }
const miniLabel = { fontSize:10, fontWeight:600, color:COLORS.slate500, textTransform:'uppercase', letterSpacing:'0.05em', display:'block', marginBottom:4 }
const inputStyle = { width:'100%', padding:'9px 11px', border:`1px solid ${COLORS.slate200}`, borderRadius:7, fontSize:12, outline:'none', fontFamily:'var(--font-sans)', boxSizing:'border-box' }
const selectStyle = { ...inputStyle, background:'white', cursor:'pointer' }
const btnPrimary = { padding:'9px 20px', background:COLORS.navy, color:'white', border:'none', borderRadius:7, fontSize:12, fontWeight:600, cursor:'pointer', minHeight:40 }
const btnSecondary = { padding:'9px 16px', background:'transparent', color:COLORS.slate600, border:`1px solid ${COLORS.slate200}`, borderRadius:7, fontSize:12, fontWeight:500, cursor:'pointer', minHeight:40 }
const btnTeal = { padding:'9px 20px', background:COLORS.teal, color:'white', border:'none', borderRadius:7, fontSize:12, fontWeight:600, cursor:'pointer', minHeight:40 }
const cardStyle = { background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, padding:20 }

function Alerta({ tipo='info', children }) {
  const estilos = {
    info:{ bg:'#E0EDFF', border:COLORS.blue, color:'#1B3A6B' },
    warn:{ bg:'#FEF3C7', border:COLORS.amber, color:'#78350F' },
    danger:{ bg:'#FEF2F2', border:COLORS.red, color:'#7F1D1D' },
    success:{ bg:'#E1F5EE', border:COLORS.teal, color:'#064E3B' },
  }
  const e = estilos[tipo] || estilos.info
  return (
    <div style={{
      padding:'10px 14px', borderRadius:8, fontSize:12, marginBottom:10,
      display:'flex', alignItems:'center', gap:10,
      background:e.bg, border:`1px solid ${e.border}`, color:e.color,
    }}>{children}</div>
  )
}

function EditableText({ value, onSave, style, placeholder='Editar...' }) {
  const [editing, setEditing] = useState(false)
  const [temp, setTemp] = useState(value)
  const inputRef = useRef(null)

  useEffect(() => { setTemp(value) }, [value])
  useEffect(() => { if (editing && inputRef.current) { inputRef.current.focus(); inputRef.current.select?.() } }, [editing])

  const commit = () => {
    const v = (temp || '').trim()
    if (v && v !== value) onSave(v)
    else setTemp(value)
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={temp}
        onChange={e => setTemp(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Escape') { setTemp(value); setEditing(false) }; if (e.key === 'Enter') commit() }}
        placeholder={placeholder}
        style={{ ...inputStyle, ...style, padding:'4px 8px' }}
      />
    )
  }
  return (
    <span
      onDoubleClick={e => { e.stopPropagation(); setEditing(true) }}
      style={{ ...style, cursor:'text', padding:'2px 4px', borderRadius:4, display:'inline-block' }}
      title="Doble clic para editar"
      onMouseEnter={e => e.currentTarget.style.background = 'rgba(10,37,64,0.04)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      {value || <span style={{ color:COLORS.slate400, fontStyle:'italic' }}>{placeholder}</span>}
    </span>
  )
}

// ============================================================
// v8: BadgeImportancia - pequeño badge visual de prioridad
// ============================================================
function BadgeImportancia({ importancia, tamano='mini' }) {
  if (!importancia || !IMPORTANCIA[importancia]) return null
  const cfg = IMPORTANCIA[importancia]
  if (tamano === 'mini') {
    return (
      <span title={`Importancia: ${cfg.label}`} style={{ display:'inline-flex', alignItems:'center', gap:3, flexShrink:0 }}>
        <span style={{ width:6, height:6, borderRadius:'50%', background:cfg.dot }}/>
      </span>
    )
  }
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:10, fontWeight:600, padding:'2px 7px', borderRadius:10, background:cfg.bg, color:cfg.color }}>
      <span style={{ width:6, height:6, borderRadius:'50%', background:cfg.dot }}/>
      {cfg.label}
    </span>
  )
}

// v12: Badge genérico para Clasificación, Prioridad, Tipo
function BadgeChip({ texto, mapa, label, tamano='normal' }) {
  if (!texto) return null
  const cfg = mapa ? mapa[texto] : null
  const bg = cfg?.bg || '#F1F5F9'
  const color = cfg?.color || '#64748B'
  const labelFinal = cfg?.label || texto
  if (tamano === 'mini') {
    return <span title={label ? `${label}: ${labelFinal}` : labelFinal} style={{ width:6, height:6, borderRadius:'50%', background: cfg?.dot || color, flexShrink:0 }}/>
  }
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:4, background:bg, color, whiteSpace:'nowrap' }}>
      {labelFinal}
    </span>
  )
}

// ============================================================
// v8: MenuContextual - menú al click derecho sobre actividad
// ============================================================
function MenuContextual({ x, y, actividad, onClose, onAbrirInfo, onDuplicar, onEliminar, onToggleMilestone, onCambiarImportancia, onAgregarHijo, proyectoId }) {
  const menuRef = useRef(null)
  const [submenuImp, setSubmenuImp] = useState(false)

  // Cerrar al click fuera o escape
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose()
    }
    const escHandler = (e) => { if (e.key === 'Escape') onClose() }
    // timeout para que no capture el mismo click que lo abrió
    const t = setTimeout(() => {
      document.addEventListener('mousedown', handler)
      document.addEventListener('keydown', escHandler)
    }, 50)
    return () => {
      clearTimeout(t)
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', escHandler)
    }
  }, [onClose])

  // Ajustar posición si se sale de la pantalla
  const MENU_WIDTH = 220
  const MENU_HEIGHT = 380
  const adjX = Math.min(x, window.innerWidth - MENU_WIDTH - 10)
  const adjY = Math.min(y, window.innerHeight - MENU_HEIGHT - 10)

  const copiarEnlace = () => {
    const url = `${window.location.origin}/proyectos/${proyectoId}?actividad=${actividad.id}`
    navigator.clipboard.writeText(url)
      .then(() => alert('Enlace copiado al portapapeles'))
      .catch(() => alert('No se pudo copiar el enlace'))
    onClose()
  }

  const MenuItem = ({ icon, label, onClick, danger, shortcut, submenu }) => (
    <div
      onClick={submenu ? undefined : (e) => { e.stopPropagation(); onClick?.(); onClose() }}
      onMouseEnter={(e) => {
        if (submenu) setSubmenuImp(true)
        else setSubmenuImp(false)
        e.currentTarget.style.background = COLORS.slate50
      }}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      style={{
        display:'flex', alignItems:'center', gap:10,
        padding:'8px 14px', fontSize:12, cursor:'pointer',
        color: danger ? COLORS.red : COLORS.ink,
        position:'relative',
      }}
    >
      <span style={{ width:14, color: danger ? COLORS.red : COLORS.slate500, display:'flex' }}>{icon}</span>
      <span style={{ flex:1 }}>{label}</span>
      {shortcut && <span style={{ fontSize:10, color:COLORS.slate400, fontFamily:'var(--font-mono)' }}>{shortcut}</span>}
      {submenu && <span style={{ color:COLORS.slate400 }}>›</span>}
      {submenu && submenuImp && (
        <div style={{ position:'absolute', left:'100%', top:-4, background:'white', border:`1px solid ${COLORS.slate200}`, borderRadius:8, boxShadow:'0 6px 20px rgba(10,37,64,0.12)', minWidth:140, padding:'4px 0', zIndex:1 }}>
          {[
            { key:'alta', label:'Alta' },
            { key:'media', label:'Media' },
            { key:'baja', label:'Baja' },
            { key:null, label:'Ninguna' },
          ].map(opt => (
            <div key={String(opt.key)} onClick={(e) => { e.stopPropagation(); onCambiarImportancia(opt.key); onClose() }}
              onMouseEnter={e => e.currentTarget.style.background = COLORS.slate50}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              style={{ padding:'8px 14px', fontSize:12, cursor:'pointer', display:'flex', alignItems:'center', gap:8, color: actividad.importancia === opt.key ? COLORS.teal : COLORS.ink }}>
              {opt.key ? <span style={{ width:8, height:8, borderRadius:'50%', background:IMPORTANCIA[opt.key].dot }}/> : <span style={{ width:8 }}/>}
              {opt.label}
              {actividad.importancia === opt.key && <span style={{ marginLeft:'auto' }}><Icon.Check/></span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )

  const Separator = () => <div style={{ height:1, background:COLORS.slate100, margin:'4px 0' }}/>

  return (
    <div ref={menuRef} style={{
      position:'fixed', left:adjX, top:adjY, width:MENU_WIDTH,
      background:'white', border:`1px solid ${COLORS.slate200}`, borderRadius:10,
      boxShadow:'0 10px 32px rgba(10,37,64,0.18)',
      zIndex:2000, padding:'4px 0',
      animation:'rowFadeIn 0.1s ease-out',
    }}>
      <style>{`@keyframes rowFadeIn { from { opacity:0; transform:translateY(-4px); } to { opacity:1; transform:translateY(0); } }`}</style>

      <div style={{ padding:'8px 14px 6px', fontSize:10, color:COLORS.slate400, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', borderBottom:`1px solid ${COLORS.slate100}`, marginBottom:4 }}>
        {actividad.nombre.length > 24 ? actividad.nombre.substring(0, 24) + '...' : actividad.nombre}
      </div>

      <MenuItem icon={<Icon.Eye/>} label="Ver detalles" onClick={() => onAbrirInfo(actividad)}/>
      <MenuItem icon={<Icon.Copy/>} label="Copiar enlace" onClick={copiarEnlace}/>
      <Separator/>
      <MenuItem icon={<Icon.Plus/>} label="Agregar sub-actividad" onClick={() => onAgregarHijo(actividad)}/>
      <MenuItem icon={<Icon.Duplicate/>} label="Duplicar" onClick={() => onDuplicar(actividad)}/>
      <Separator/>
      <MenuItem icon={<Icon.Flag/>} label="Importancia" submenu/>
      <MenuItem
        icon={<Icon.Diamond/>}
        label={actividad.es_milestone ? 'Quitar hito' : 'Convertir en hito'}
        onClick={() => onToggleMilestone(actividad)}
      />
      <Separator/>
      <MenuItem icon={<Icon.Trash/>} label="Eliminar" onClick={() => onEliminar(actividad)} danger/>
    </div>
  )
}

function PanelActividad({ actividad, actividades, numeracion, usuarios, onClose, onCambio, onEliminar }) {
  const [loc, setLoc] = useState(actividad)
  const [guardando, setGuardando] = useState(false)
  const [predSel, setPredSel] = useState('')
  const isMobile = useIsMobile()

  useEffect(() => { setLoc(actividad) }, [actividad])

  const guardar = async (cambios) => {
    setLoc(prev => ({ ...prev, ...cambios }))
    setGuardando(true)
    try {
      await actualizarActividad(actividad.id, cambios)
      onCambio()
    } catch (e) { alert('Error: ' + e.message) }
    setGuardando(false)
  }

  const esDescendiente = (id, ancestroId) => {
    if (id === ancestroId) return true
    const a = actividades.find(x => x.id === id)
    if (!a || !a.parent_id) return false
    return esDescendiente(a.parent_id, ancestroId)
  }
  const candidatasDeps = actividades.filter(a => a.id !== actividad.id && !(loc.deps || []).some(d => d.id === a.id) && !esDescendiente(actividad.id, a.id))

  const agregarDep = async () => {
    if (!predSel) return
    setGuardando(true)
    try {
      await agregarDependencia(actividad.id, predSel, 'FS')
      setLoc(prev => ({ ...prev, deps: [...(prev.deps || []), { id: predSel, tipo: 'FS' }] }))
      setPredSel('')
      onCambio()
    } catch (e) { alert('Error: ' + e.message) }
    setGuardando(false)
  }

  const quitarDep = async (predId) => {
    setGuardando(true)
    try {
      await quitarDependencia(actividad.id, predId)
      setLoc(prev => ({ ...prev, deps: (prev.deps || []).filter(d => d.id !== predId) }))
      onCambio()
    } catch (e) { alert('Error: ' + e.message) }
    setGuardando(false)
  }

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(10,37,64,0.3)', zIndex:1100 }}/>
      <div style={{
        position:'fixed', top:0, right:0,
        width: isMobile ? '100%' : 460,
        height:'100vh', background:'white',
        boxShadow:'-8px 0 32px rgba(10,37,64,0.12)',
        zIndex:1101, display:'flex', flexDirection:'column',
        animation:'rowSlideIn 0.2s ease-out',
      }}>
        <style>{`@keyframes rowSlideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>
        <div style={{ padding:'16px 20px', borderBottom:`1px solid ${COLORS.slate100}`, display:'flex', justifyContent:'space-between', alignItems:'center', gap:10 }}>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:10, fontFamily:'var(--font-mono)', color:COLORS.slate400, fontWeight:700, marginBottom:2 }}>
              Actividad {numeracion[actividad.id] || ''} {guardando && <span style={{ color:COLORS.teal, marginLeft:8 }}>Guardando...</span>}
            </div>
            <div>
              <EditableText value={loc.nombre} onSave={v => guardar({ nombre: v })} style={{ fontSize:16, fontWeight:600, color:COLORS.navy, fontFamily:'var(--font-sans)' }}/>
            </div>
          </div>
          <button onClick={onClose} style={{ border:'none', background:COLORS.slate50, width:32, height:32, borderRadius:8, cursor:'pointer', flexShrink:0 }}><Icon.X/></button>
        </div>
        <div style={{ flex:1, overflow:'auto', padding:20 }}>
          <div style={{ marginBottom:16 }}>
            <label style={miniLabel}>Estado</label>
            <select value={loc.estado} onChange={e => guardar({ estado: e.target.value })} style={selectStyle}>
              {Object.keys(ESTADOS).map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          <div style={{ marginBottom:16 }}>
            <label style={miniLabel}>Importancia</label>
            <div style={{ display:'flex', gap:6 }}>
              {[
                { key:null, label:'Ninguna', color:COLORS.slate400 },
                { key:'baja', label:'Baja', color:IMPORTANCIA.baja.dot },
                { key:'media', label:'Media', color:IMPORTANCIA.media.dot },
                { key:'alta', label:'Alta', color:IMPORTANCIA.alta.dot },
              ].map(opt => {
                const active = (loc.importancia || null) === opt.key
                return (
                  <button key={String(opt.key)} onClick={() => guardar({ importancia: opt.key })}
                    style={{
                      flex:1, padding:'8px 10px', fontSize:11, fontWeight:600, cursor:'pointer',
                      border: active ? `1.5px solid ${opt.color}` : `1px solid ${COLORS.slate200}`,
                      background: active ? `${opt.color}18` : 'white',
                      color: active ? opt.color : COLORS.slate600,
                      borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center', gap:5,
                    }}>
                    {opt.key && <span style={{ width:8, height:8, borderRadius:'50%', background:opt.color }}/>}
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16 }}>
            <div>
              <label style={miniLabel}>Inicio</label>
              <input type="date" value={loc.inicio} onChange={e => guardar({ inicio: e.target.value })} style={inputStyle}/>
            </div>
            <div>
              <label style={miniLabel}>Fin</label>
              <input type="date" value={loc.fin} onChange={e => guardar({ fin: e.target.value })} style={inputStyle}/>
            </div>
          </div>
          <div style={{ marginBottom:16, padding:10, background:COLORS.slate50, borderRadius:8, fontSize:11, color:COLORS.slate600, fontFamily:'var(--font-mono)', textAlign:'center' }}>
            Duración: <strong style={{ color:COLORS.navy }}>{diffDays(loc.inicio, loc.fin) + 1} días</strong>
          </div>
          <div style={{ marginBottom:16 }}>
            <label style={miniLabel}>Progreso: {loc.avance || 0}%</label>
            <input type="range" min="0" max="100" step="5" value={loc.avance || 0}
              onChange={e => setLoc(prev => ({ ...prev, avance: parseInt(e.target.value) }))}
              onMouseUp={e => guardar({ avance: parseInt(e.target.value), completada: parseInt(e.target.value) === 100 })}
              onTouchEnd={e => guardar({ avance: parseInt(e.target.value), completada: parseInt(e.target.value) === 100 })}
              style={{ width:'100%', accentColor:COLORS.teal }}/>
            <BarraAvance avance={loc.avance || 0}/>
          </div>
          {usuarios && usuarios.length > 0 && (
            <div style={{ marginBottom:16 }}>
              <label style={miniLabel}>Responsable</label>
              <select value={loc.responsable_id || ''} onChange={e => guardar({ responsable_id: e.target.value || null })} style={selectStyle}>
                <option value="">Sin asignar</option>
                {usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
              </select>
            </div>
          )}
          <div style={{ marginBottom:16 }}>
            <label style={miniLabel}>Notas</label>
            <textarea
              value={loc.notas || ''}
              onChange={e => setLoc(prev => ({ ...prev, notas: e.target.value }))}
              onBlur={e => e.target.value !== (actividad.notas || '') && guardar({ notas: e.target.value })}
              placeholder="Agrega contexto o comentarios..."
              style={{ ...inputStyle, minHeight:80, resize:'vertical' }}
            />
          </div>
          <div style={{ marginBottom:16 }}>
            <label style={miniLabel}>Predecesoras ({(loc.deps || []).length})</label>
            {(loc.deps || []).length === 0 && <div style={{ padding:12, textAlign:'center', color:COLORS.slate400, fontSize:11, border:`1px dashed ${COLORS.slate200}`, borderRadius:8 }}>Sin dependencias.</div>}
            {(loc.deps || []).map(dep => {
              const pred = actividades.find(a => a.id === dep.id)
              if (!pred) return null
              return (
                <div key={dep.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', background:COLORS.slate50, borderRadius:8, marginBottom:4 }}>
                  <span style={{ fontSize:10, fontFamily:'var(--font-mono)', color:COLORS.navy, fontWeight:700, minWidth:30 }}>{numeracion[pred.id] || ''}</span>
                  <span style={{ flex:1, fontSize:12, color:COLORS.ink, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{pred.nombre}</span>
                  <button onClick={() => quitarDep(dep.id)} disabled={guardando} style={{ border:'none', background:'transparent', color:COLORS.red, cursor:'pointer', padding:4 }}><Icon.Trash/></button>
                </div>
              )
            })}
            <div style={{ display:'flex', gap:6, marginTop:6 }}>
              <select value={predSel} onChange={e => setPredSel(e.target.value)} style={{...selectStyle, flex:1, fontSize:11}}>
                <option value="">Agregar predecesora...</option>
                {candidatasDeps.map(a => <option key={a.id} value={a.id}>{numeracion[a.id] || ''} · {a.nombre}</option>)}
              </select>
              <button onClick={agregarDep} disabled={!predSel || guardando} style={{ padding:'8px 12px', background:COLORS.teal, color:'white', border:'none', borderRadius:7, fontSize:11, fontWeight:600, cursor:'pointer', opacity: !predSel ? 0.5 : 1 }}>+</button>
            </div>
          </div>

          {/* v12: Peso ponderado (solo dirección/admin) */}
          <div style={{ padding:'14px 12px', background:COLORS.slate50, borderRadius:8, marginBottom:10 }}>
            <label style={{ ...miniLabel, display:'flex', alignItems:'center', gap:6 }}>
              <Icon.Scale/> Peso ponderado (fórmula Luis)
            </label>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:6 }}>
              <input
                type="number" min="0" max="100" step="1"
                value={loc.peso || 0}
                onChange={e => {
                  const v = Math.min(100, Math.max(0, parseInt(e.target.value) || 0))
                  setLoc(prev => ({ ...prev, peso: v }))
                }}
                onBlur={() => guardar({ peso: loc.peso || 0 })}
                style={{ ...inputStyle, width:80, textAlign:'right', fontFamily:'var(--font-mono)', fontWeight:700 }}
              />
              <span style={{ fontSize:12, color:COLORS.slate500, fontWeight:600 }}>%</span>
              <span style={{ flex:1, fontSize:10, color:COLORS.slate500 }}>
                Los pesos de actividades hermanas deben sumar 100%
              </span>
            </div>
          </div>

          {/* v12: Actividad cobrable */}
          <div style={{ padding:'14px 12px', background: loc.es_cobrable ? '#F0FDF4' : COLORS.slate50, border: loc.es_cobrable ? `1px solid #86EFAC` : 'none', borderRadius:8, marginBottom:10 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom: loc.es_cobrable ? 10 : 0 }}>
              <input
                type="checkbox" id="cobrable"
                checked={!!loc.es_cobrable}
                onChange={e => {
                  const val = e.target.checked
                  setLoc(prev => ({ ...prev, es_cobrable: val, estado_cobro: val ? (prev.estado_cobro || 'Pendiente') : 'NA' }))
                  guardar({ es_cobrable: val, estado_cobro: val ? (loc.estado_cobro || 'Pendiente') : 'NA' })
                }}
              />
              <label htmlFor="cobrable" style={{ fontSize:12, color:COLORS.slate600, cursor:'pointer', fontWeight:600, display:'flex', alignItems:'center', gap:4 }}>
                <Icon.Dollar/> Es cobrable
              </label>
            </div>
            {loc.es_cobrable && (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <div>
                  <label style={miniLabel}>Estado</label>
                  <select
                    value={loc.estado_cobro || 'Pendiente'}
                    onChange={e => guardar({ estado_cobro: e.target.value })}
                    style={selectStyle}
                  >
                    {Object.keys(ESTADOS_COBRO).filter(k => k !== 'NA').map(k => <option key={k} value={k}>{ESTADOS_COBRO[k].label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={miniLabel}>Monto</label>
                  <input
                    type="number" step="0.01" min="0"
                    value={loc.monto_cobrable || ''}
                    onChange={e => setLoc(prev => ({ ...prev, monto_cobrable: e.target.value }))}
                    onBlur={e => guardar({ monto_cobrable: e.target.value ? parseFloat(e.target.value) : null })}
                    placeholder="0.00"
                    style={inputStyle}
                  />
                </div>
              </div>
            )}
          </div>

          <div style={{ display:'flex', gap:8, alignItems:'center', padding:'10px 12px', background:COLORS.slate50, borderRadius:8 }}>
            <input type="checkbox" id="mstone" checked={!!loc.es_milestone} onChange={e => guardar({ es_milestone: e.target.checked })}/>
            <label htmlFor="mstone" style={{ fontSize:12, color:COLORS.slate600, cursor:'pointer' }}>Es milestone (hito)</label>
          </div>

          {/* v11: Zona de peligro - Eliminar actividad */}
          {onEliminar && (
            <div style={{ marginTop:24, padding:'14px 14px', background:'#FEF2F2', border:`1px solid #FECACA`, borderRadius:10 }}>
              <div style={{ fontSize:10, fontWeight:700, color:COLORS.red, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>Zona de peligro</div>
              <button
                onClick={() => { onEliminar(actividad); onClose() }}
                disabled={guardando}
                style={{
                  width:'100%', padding:'10px 14px',
                  background:'white', color:COLORS.red,
                  border:`1.5px solid ${COLORS.red}`, borderRadius:8,
                  fontSize:12, fontWeight:600, cursor: guardando ? 'wait' : 'pointer',
                  display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                  transition:'all 0.15s'
                }}
                onMouseEnter={e => { e.currentTarget.style.background = COLORS.red; e.currentTarget.style.color = 'white' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.color = COLORS.red }}
              >
                <Icon.Trash/> Eliminar esta actividad
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function PanelProyecto({ proyecto, clientes, usuarios, onClose, onCambio }) {
  const [loc, setLoc] = useState(proyecto)
  const [guardando, setGuardando] = useState(false)
  const isMobile = useIsMobile()

  useEffect(() => { setLoc(proyecto) }, [proyecto])

  const guardar = async (cambios) => {
    setLoc(prev => ({ ...prev, ...cambios }))
    setGuardando(true)
    try {
      const { error } = await supabase.from('proyectos').update(cambios).eq('id', proyecto.id)
      if (error) throw error
      onCambio()
    } catch (e) { alert('Error: ' + e.message) }
    setGuardando(false)
  }

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(10,37,64,0.3)', zIndex:1100 }}/>
      <div style={{
        position:'fixed', top:0, right:0,
        width: isMobile ? '100%' : 460,
        height:'100vh', background:'white',
        boxShadow:'-8px 0 32px rgba(10,37,64,0.12)',
        zIndex:1101, display:'flex', flexDirection:'column',
        animation:'rowSlideIn 0.2s ease-out',
      }}>
        <div style={{ padding:'16px 20px', borderBottom:`1px solid ${COLORS.slate100}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:10, fontFamily:'var(--font-mono)', color:COLORS.slate400, fontWeight:700, marginBottom:2 }}>
              {proyecto.codigo} {guardando && <span style={{ color:COLORS.teal, marginLeft:8 }}>Guardando...</span>}
            </div>
            <EditableText value={loc.nombre} onSave={v => guardar({ nombre: v })} style={{ fontSize:16, fontWeight:600, color:COLORS.navy, fontFamily:'var(--font-sans)' }}/>
          </div>
          <button onClick={onClose} style={{ border:'none', background:COLORS.slate50, width:32, height:32, borderRadius:8, cursor:'pointer' }}><Icon.X/></button>
        </div>
        <div style={{ flex:1, overflow:'auto', padding:20 }}>
          <div style={{ marginBottom:16 }}>
            <label style={miniLabel}>Estado</label>
            <select value={loc.estado} onChange={e => guardar({ estado: e.target.value })} style={selectStyle}>
              {Object.keys(ESTADOS_PROY).map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          <div style={{ marginBottom:16 }}>
            <label style={miniLabel}>Cliente</label>
            <select value={loc.cliente_id || ''} onChange={e => guardar({ cliente_id: e.target.value })} style={selectStyle}>
              <option value="">Sin cliente</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.razon_social}</option>)}
            </select>
          </div>
          <div style={{ marginBottom:16 }}>
            <label style={miniLabel}>Director</label>
            <select value={loc.director_id || ''} onChange={e => guardar({ director_id: e.target.value })} style={selectStyle}>
              <option value="">Sin director</option>
              {usuarios.filter(u => ['direccion','director_proyectos'].includes(u.rol)).map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
            </select>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16 }}>
            <div><label style={miniLabel}>Inicio</label><input type="date" value={loc.inicio || ''} onChange={e => guardar({ inicio: e.target.value })} style={inputStyle}/></div>
            <div><label style={miniLabel}>Cierre</label><input type="date" value={loc.cierre || ''} onChange={e => guardar({ cierre: e.target.value })} style={inputStyle}/></div>
          </div>
          {/* v12: Clasificación, Prioridad, Tipo (Luis) */}
          <div style={{ padding:'12px 12px', background:COLORS.slate50, borderRadius:8, marginBottom:16 }}>
            <div style={{ ...miniLabel, marginBottom:8, fontWeight:700 }}>Clasificación</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
              <div>
                <label style={miniLabel}>Clase</label>
                <select value={loc.clasificacion || ''} onChange={e => guardar({ clasificacion: e.target.value || null })} style={selectStyle}>
                  <option value="">—</option>
                  <option value="A">A — Alta</option>
                  <option value="B">B — Media</option>
                  <option value="C">C — Baja</option>
                </select>
              </div>
              <div>
                <label style={miniLabel}>Prioridad</label>
                <select value={loc.prioridad || 'Media'} onChange={e => guardar({ prioridad: e.target.value })} style={selectStyle}>
                  <option value="Alta">Alta</option>
                  <option value="Media">Media</option>
                  <option value="Baja">Baja</option>
                </select>
              </div>
            </div>
            <div>
              <label style={miniLabel}>Tipo</label>
              <select value={loc.tipo_proyecto || 'Otros'} onChange={e => guardar({ tipo_proyecto: e.target.value })} style={selectStyle}>
                {TIPOS_PROYECTO.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16 }}>
            <div>
              <label style={miniLabel}>Capacidad MW</label>
              <input type="number" step="0.1" value={loc.capacidad_mw || ''}
                onChange={e => setLoc(prev => ({ ...prev, capacidad_mw: e.target.value }))}
                onBlur={e => guardar({ capacidad_mw: e.target.value ? parseFloat(e.target.value) : null })}
                style={inputStyle}/>
            </div>
            <div>
              <label style={miniLabel}>Ubicación</label>
              <input value={loc.ubicacion || ''}
                onChange={e => setLoc(prev => ({ ...prev, ubicacion: e.target.value }))}
                onBlur={e => guardar({ ubicacion: e.target.value || null })}
                style={inputStyle}/>
            </div>
          </div>
          <div style={{ marginBottom:16 }}>
            <label style={miniLabel}>Descripción</label>
            <textarea
              value={loc.descripcion || ''}
              onChange={e => setLoc(prev => ({ ...prev, descripcion: e.target.value }))}
              onBlur={e => guardar({ descripcion: e.target.value || null })}
              style={{ ...inputStyle, minHeight:80, resize:'vertical' }}
            />
          </div>
        </div>
      </div>
    </>
  )
}

function GanttInteractivo({ actividadesProp, proyecto, usuarios, onRecargar, onDesglosar, onAbrirInfo, onInlineUpdate, onNuevaActividad, onMenuContextual, onQuitarDep }) {
  const [zoom, setZoom] = useState('dia')
  const DAY_WIDTH = zoom === 'dia' ? 32 : (zoom === 'semana' ? 18 : 8)
  const ROW_HEIGHT = 42
  const HEADER_HEIGHT = 60
  const LEFT_PANEL = 320
  const BAR_VPAD = 10
  const BAR_HEIGHT = ROW_HEIGHT - BAR_VPAD * 2
  const BAR_HEIGHT_PADRE = ROW_HEIGHT - 16

  const containerRef = useRef(null)
  const scrollRef = useRef(null)
  const timelineRef = useRef(null)
  const dragStateRef = useRef(null)

  const [actividades, setActividades] = useState(actividadesProp)
  useEffect(() => { setActividades(actividadesProp) }, [actividadesProp])

  const [hoveredId, setHoveredId] = useState(null)
  const [depHover, setDepHover] = useState(null)  // v11: hover sobre flecha de dependencia (para borrarla)
  const [tooltip, setTooltip] = useState(null)
  const [drag, setDrag] = useState(null)
  const [dropTargetId, setDropTargetId] = useState(null)
  const [dragTick, setDragTick] = useState(0)  // v13.2: fuerza re-render del rubber-band
  // v14.1: toggle para mostrar/ocultar ruta crítica
  const [mostrarRutaCritica, setMostrarRutaCritica] = useState(() => loadPref('gantt.critical', false))
  useEffect(() => { savePref('gantt.critical', mostrarRutaCritica) }, [mostrarRutaCritica])

  const numeracion = useMemo(() => generarNumeracion(actividades), [actividades])

  // v14.1: calcular ruta crítica (CPM) una sola vez cuando cambian las actividades
  const cpm = useMemo(() => calcularRutaCritica(actividades), [actividades])
  const hayActividadesCriticas = useMemo(() =>
    Object.values(cpm).some(c => c.critica), [cpm])

  const fechaInicio = useMemo(() => {
    if (actividades.length === 0) return toDate(toStr(new Date()))
    const min = actividades.reduce((m, a) => a.inicio < m ? a.inicio : m, actividades[0].inicio)
    const d = toDate(min); d.setDate(d.getDate() - 3); return d
  }, [actividades])

  const fechaFin = useMemo(() => {
    if (actividades.length === 0) { const d = new Date(); d.setDate(d.getDate() + 90); return d }
    const max = actividades.reduce((m, a) => a.fin > m ? a.fin : m, actividades[0].fin)
    const d = toDate(max); d.setDate(d.getDate() + 14); return d
  }, [actividades])

  const totalDias = diffDays(toStr(fechaInicio), toStr(fechaFin))
  const totalWidth = totalDias * DAY_WIDTH
  const hoy = toStr(new Date())

  const dias = useMemo(() => {
    const arr = []
    for (let i = 0; i <= totalDias; i++) {
      const d = new Date(fechaInicio); d.setDate(d.getDate() + i)
      arr.push(d)
    }
    return arr
  }, [fechaInicio, totalDias])

  const meses = useMemo(() => {
    const arr = []; let current = null
    dias.forEach((d, i) => {
      const key = `${d.getFullYear()}-${d.getMonth()}`
      if (key !== current) {
        arr.push({ key, label: d.toLocaleDateString('es-MX', { month:'long', year:'numeric' }), inicio: i, dias: 1 })
        current = key
      } else arr[arr.length-1].dias++
    })
    return arr
  }, [dias])

  const getX = fecha => diffDays(toStr(fechaInicio), fecha) * DAY_WIDTH
  const getW = (inicio, fin) => Math.max((diffDays(inicio, fin) + 1) * DAY_WIDTH, DAY_WIDTH)

  const [collapsed, setCollapsed] = useState(new Set())
  const toggleCollapse = (id) => setCollapsed(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  const actOrdenadas = useMemo(() => {
    const padres = actividades.filter(a => !a.parent_id)
    const result = []
    padres.forEach(p => {
      result.push(p)
      if (!collapsed.has(p.id)) {
        actividades.filter(a => a.parent_id === p.id).forEach(h => result.push(h))
      }
    })
    return result
  }, [actividades, collapsed])

  const rowByActId = useMemo(() => {
    const r = {}
    actOrdenadas.forEach((a, i) => { r[a.id] = i })
    return r
  }, [actOrdenadas])

  const previewActividad = useCallback((act) => {
    const d = dragStateRef.current
    if (!d || d.actId !== act.id) return { inicio: act.inicio, fin: act.fin }
    const deltaDays = Math.round((d.mouseX - d.startX) / DAY_WIDTH)
    if (d.tipo === 'move') return { inicio: addDays(d.originalInicio, deltaDays), fin: addDays(d.originalFin, deltaDays) }
    if (d.tipo === 'resize-left') {
      const nuevoInicio = addDays(d.originalInicio, deltaDays)
      if (nuevoInicio >= d.originalFin) return { inicio: d.originalFin, fin: d.originalFin }
      return { inicio: nuevoInicio, fin: d.originalFin }
    }
    if (d.tipo === 'resize-right') {
      const nuevoFin = addDays(d.originalFin, deltaDays)
      if (nuevoFin <= d.originalInicio) return { inicio: d.originalInicio, fin: d.originalInicio }
      return { inicio: d.originalInicio, fin: nuevoFin }
    }
    return { inicio: act.inicio, fin: act.fin }
  }, [DAY_WIDTH])

  const creariaCiclo = useCallback((predId, sucId) => {
    if (predId === sucId) return true
    const visit = (id, seen) => {
      if (id === sucId) return true
      if (seen.has(id)) return false
      seen.add(id)
      const act = actividades.find(a => a.id === id)
      if (!act) return false
      for (const d of (act.deps || [])) if (visit(d.id, seen)) return true
      return false
    }
    return visit(predId, new Set())
  }, [actividades])

  useEffect(() => {
    if (!drag) return
    const onMove = (e) => {
      if (!dragStateRef.current) return
      dragStateRef.current.mouseX = e.clientX
      dragStateRef.current.mouseY = e.clientY
      setDragTick(t => t + 1)  // v13.2: Provoca re-render del rubber-band SVG
      if (drag.tipo === 'dep') {
        const el = document.elementFromPoint(e.clientX, e.clientY)
        const targetId = el?.closest('[data-act-id]')?.getAttribute('data-act-id')
        if (targetId && targetId !== drag.actId && !creariaCiclo(drag.actId, targetId)) {
          setDropTargetId(prev => prev !== targetId ? targetId : prev)
        } else {
          setDropTargetId(prev => prev ? null : prev)
        }
      }
    }
    const onUp = async (e) => {
      const d = dragStateRef.current
      setDrag(null); setDropTargetId(null)
      if (!d) return
      if (d.tipo === 'dep') {
        const el = document.elementFromPoint(e.clientX, e.clientY)
        const targetId = el?.closest('[data-act-id]')?.getAttribute('data-act-id')
        if (targetId && targetId !== d.actId && !creariaCiclo(d.actId, targetId)) {
          setActividades(prev => prev.map(a => a.id === targetId ? { ...a, deps: [...(a.deps || []), { id: d.actId, tipo: 'FS' }] } : a))
          try {
            await agregarDependencia(targetId, d.actId, 'FS')
            onRecargar()
          } catch (err) {
            setActividades(prev => prev.map(a => a.id === targetId ? { ...a, deps: (a.deps || []).filter(x => x.id !== d.actId) } : a))
            alert('No se pudo crear la dependencia: ' + err.message)
          }
        }
      } else {
        const deltaDays = Math.round((d.mouseX - d.startX) / DAY_WIDTH)
        if (deltaDays === 0) { dragStateRef.current = null; return }
        let cambios = {}
        if (d.tipo === 'move') {
          cambios.inicio = addDays(d.originalInicio, deltaDays)
          cambios.fin = addDays(d.originalFin, deltaDays)
        } else if (d.tipo === 'resize-left') {
          const nuevoInicio = addDays(d.originalInicio, deltaDays)
          if (nuevoInicio >= d.originalFin) { dragStateRef.current = null; return }
          cambios.inicio = nuevoInicio
        } else if (d.tipo === 'resize-right') {
          const nuevoFin = addDays(d.originalFin, deltaDays)
          if (nuevoFin <= d.originalInicio) { dragStateRef.current = null; return }
          cambios.fin = nuevoFin
        }
        // v13.3: actualización optimista — aplicar cambios también al padre si existe
        const actividadMovida = actividades.find(a => a.id === d.actId)
        const parentId = actividadMovida?.parent_id

        setActividades(prev => {
          const nuevo = prev.map(a => a.id === d.actId ? { ...a, ...cambios } : a)
          // Si esta actividad tiene padre, recalcular las fechas del padre
          if (parentId) {
            const hermanos = nuevo.filter(a => a.parent_id === parentId)
            if (hermanos.length > 0) {
              const minInicio = hermanos.reduce((min, h) => !min || h.inicio < min ? h.inicio : min, null)
              const maxFin = hermanos.reduce((max, h) => !max || h.fin > max ? h.fin : max, null)
              return nuevo.map(a => a.id === parentId ? { ...a, inicio: minInicio, fin: maxFin } : a)
            }
          }
          return nuevo
        })
        dragStateRef.current = null
        try {
          // v13.3: solo actualizar la actividad movida.
          // recalcularFechasDesde ahora respeta el movimiento del usuario (no jala hacia atrás).
          // recalcularPadre actualiza el padre si aplica.
          await actualizarActividad(d.actId, cambios)
          await recalcularFechasDesde(d.actId)
          if (parentId) await recalcularPadre(parentId)
          onRecargar()
        } catch (err) {
          setActividades(actividadesProp)
          alert('Error: ' + err.message)
        }
      }
      dragStateRef.current = null
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [drag, actividadesProp, onRecargar, creariaCiclo, DAY_WIDTH])

  const iniciarDrag = (e, act, tipo) => {
    e.stopPropagation(); e.preventDefault()
    setTooltip(null)
    const state = { tipo, actId: act.id, startX: e.clientX, mouseX: e.clientX, mouseY: e.clientY, originalInicio: act.inicio, originalFin: act.fin }
    dragStateRef.current = state
    setDrag(state)
  }

  // v13.3: buildOrthPath con distancia FIJA del codo
  // Problema anterior: midX = sx + (ex-sx)/2 → flechas largas cuando hay mucho espacio.
  // Ahora: codo siempre a ~12px después del fin de la predecesora → estilo MS Project.
  const buildOrthPath = (x1, y1, x2, y2) => {
    const STUB = 12       // distancia fija del codo después de predecesora
    const ARROW_STUB = 8  // distancia antes del target para el marcador
    const R = 4           // radio de esquinas
    const sx = x1 + STUB
    const ex = x2 - ARROW_STUB

    // Caso normal: suficiente espacio horizontal para codo en "L invertida"
    if (ex > sx + 8) {
      const midX = sx  // codo SIEMPRE a distancia STUB del origen (consistente)
      const goDown = y2 > y1
      const dir = goDown ? 1 : -1

      // Si están en la misma fila, línea recta
      if (Math.abs(y2 - y1) < 1) {
        return `M ${x1} ${y1} L ${ex} ${y2}`
      }

      // L normal: horizontal corto → esquina → vertical → esquina → horizontal al target
      return `M ${x1} ${y1} L ${midX - R} ${y1} Q ${midX} ${y1} ${midX} ${y1 + R*dir} L ${midX} ${y2 - R*dir} Q ${midX} ${y2} ${midX + R} ${y2} L ${ex} ${y2}`
    } else {
      // Caso "loop back": predecesora termina a la derecha del target (overlap)
      const goDown = y2 > y1
      const dir = goDown ? 1 : -1
      const midY = y1 + (ROW_HEIGHT/2) * dir
      const leftX = ex - 16
      return `M ${x1} ${y1} L ${sx - R} ${y1} Q ${sx} ${y1} ${sx} ${y1 + R*dir} L ${sx} ${midY - R*dir} Q ${sx} ${midY} ${sx - R} ${midY} L ${leftX + R} ${midY} Q ${leftX} ${midY} ${leftX} ${midY + R*dir} L ${leftX} ${y2 - R*dir} Q ${leftX} ${y2} ${leftX + R} ${y2} L ${ex} ${y2}`
    }
  }

  const lineasDeps = useMemo(() => {
    const lineas = []
    actOrdenadas.forEach((act, rowIdx) => {
      const { inicio, fin } = previewActividad(act)
      ;(act.deps || []).forEach(dep => {
        const pred = actividades.find(a => a.id === dep.id)
        if (!pred) return
        const predRow = rowByActId[pred.id]
        if (predRow === undefined) return
        const predPrev = previewActividad(pred)

        // v13.3.1: puntos de conexión especiales para milestones (rombos)
        // Un milestone se renderiza como rombo de 20px centrado en x + DAY_WIDTH/2
        // Por eso su punto "derecho" es centro+10 y su "izquierdo" es centro-10
        let x1, x2
        if (pred.es_milestone) {
          // Salida del rombo: lado derecho
          x1 = getX(predPrev.inicio) + DAY_WIDTH/2 + 10
        } else {
          x1 = getX(predPrev.inicio) + getW(predPrev.inicio, predPrev.fin)
        }
        if (act.es_milestone) {
          // Entrada al rombo: lado izquierdo
          x2 = getX(inicio) + DAY_WIDTH/2 - 10
        } else {
          x2 = getX(inicio)
        }

        const y1 = predRow * ROW_HEIGHT + ROW_HEIGHT / 2
        const y2 = rowIdx * ROW_HEIGHT + ROW_HEIGHT / 2
        lineas.push({
          id: `${pred.id}-${act.id}`,
          path: buildOrthPath(x1, y1, x2, y2),
          fromId: pred.id, toId: act.id,
          highlighted: hoveredId === pred.id || hoveredId === act.id,
        })
      })
    })
    return lineas
  }, [actOrdenadas, actividades, rowByActId, hoveredId, previewActividad, DAY_WIDTH, drag])

  const dragDepPath = useMemo(() => {
    if (!drag || drag.tipo !== 'dep' || !timelineRef.current || !dragStateRef.current) return null
    const act = actividades.find(a => a.id === drag.actId)
    if (!act) return null
    const prev = previewActividad(act)
    const rect = timelineRef.current.getBoundingClientRect()
    const scrollLeft = scrollRef.current?.scrollLeft || 0
    // v13.3.1: si el origen es milestone, el punto de salida es el lado derecho del rombo
    const x1 = act.es_milestone
      ? getX(prev.inicio) + DAY_WIDTH/2 + 10
      : getX(prev.inicio) + getW(prev.inicio, prev.fin)
    const y1 = rowByActId[act.id] * ROW_HEIGHT + ROW_HEIGHT / 2
    const x2 = dragStateRef.current.mouseX - rect.left + scrollLeft
    const y2 = dragStateRef.current.mouseY - rect.top
    return buildOrthPath(x1, y1, x2, y2)
  }, [drag, dragTick, actividades, rowByActId, previewActividad, DAY_WIDTH])

  const getNivel = id => (numeracion[id] || '').split('.').length - 1
  const totalHeight = actOrdenadas.length * ROW_HEIGHT

  const [nuevaNombre, setNuevaNombre] = useState('')
  const [creando, setCreando] = useState(false)
  const agregarActividadInline = async () => {
    if (!nuevaNombre.trim()) return
    setCreando(true)
    try { await onNuevaActividad({ nombre: nuevaNombre.trim() }); setNuevaNombre('') }
    catch (e) { alert('Error: ' + e.message) }
    setCreando(false)
  }

  return (
    <div ref={containerRef} style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, overflow:'hidden', position:'relative', userSelect: drag ? 'none' : 'auto' }}>
      <div style={{ padding:'10px 14px', borderBottom:`1px solid ${COLORS.slate100}`, background:COLORS.slate50, display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
        <div style={{ display:'flex', background:'white', border:`1px solid ${COLORS.slate200}`, borderRadius:7, overflow:'hidden' }}>
          {[{k:'dia',l:'Día'},{k:'semana',l:'Sem'},{k:'mes',l:'Mes'}].map(z => (
            <button key={z.k} onClick={() => setZoom(z.k)} style={{ padding:'6px 12px', border:'none', background: zoom === z.k ? COLORS.navy : 'transparent', color: zoom === z.k ? 'white' : COLORS.slate600, fontSize:11, fontWeight:600, cursor:'pointer' }}>{z.l}</button>
          ))}
        </div>
        <button onClick={() => {
          const hoyIdx = dias.findIndex(d => toStr(d) === hoy)
          if (hoyIdx >= 0 && scrollRef.current) scrollRef.current.scrollTo({ left: Math.max(0, hoyIdx * DAY_WIDTH - 200), behavior:'smooth' })
        }} style={{ padding:'6px 10px', background:'white', border:`1px solid ${COLORS.slate200}`, borderRadius:7, fontSize:11, fontWeight:600, cursor:'pointer', color:COLORS.slate600, display:'flex', alignItems:'center', gap:5 }}>
          <Icon.Calendar/> Ir a hoy
        </button>
        {/* v15.2: Export PDF / Excel — lazy-loaded para no inflar el bundle */}
        <button
          onClick={async () => {
            const m = await import('./exportGantt')
            await m.exportarGanttExcel(proyecto, actividades, usuarios)
          }}
          title="Descargar cronograma como Excel (.xlsx)"
          style={{ padding:'6px 10px', background:'white', border:`1px solid ${COLORS.slate200}`, borderRadius:7, fontSize:11, fontWeight:600, cursor:'pointer', color:COLORS.slate600, display:'flex', alignItems:'center', gap:5 }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M8 13h2l2 4 2-4h2"/></svg>
          Excel
        </button>
        <button
          onClick={async () => {
            const m = await import('./exportGantt')
            m.exportarGanttPDF(proyecto, actividades, usuarios)
          }}
          title="Descargar cronograma como PDF"
          style={{ padding:'6px 10px', background:'white', border:`1px solid ${COLORS.slate200}`, borderRadius:7, fontSize:11, fontWeight:600, cursor:'pointer', color:COLORS.slate600, display:'flex', alignItems:'center', gap:5 }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          PDF
        </button>
        {/* v14.1: Toggle Ruta Crítica */}
        <button
          onClick={() => setMostrarRutaCritica(v => !v)}
          title={mostrarRutaCritica ? 'Ocultar ruta crítica' : 'Mostrar ruta crítica (actividades que determinan la fecha final del proyecto)'}
          style={{
            padding:'6px 12px',
            background: mostrarRutaCritica ? COLORS.red : 'white',
            border: `1px solid ${mostrarRutaCritica ? COLORS.red : COLORS.slate200}`,
            borderRadius:7,
            fontSize:11, fontWeight:600, cursor:'pointer',
            color: mostrarRutaCritica ? 'white' : COLORS.slate600,
            display:'flex', alignItems:'center', gap:5,
            transition:'all 0.12s',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
          </svg>
          Ruta crítica
          {mostrarRutaCritica && hayActividadesCriticas && (
            <span style={{
              marginLeft:4, padding:'1px 6px',
              background:'rgba(255,255,255,0.25)',
              borderRadius:10, fontSize:10, fontWeight:700,
            }}>
              {Object.values(cpm).filter(c => c.critica).length}
            </span>
          )}
        </button>
        <div style={{ marginLeft:'auto', fontSize:10, color:COLORS.slate500, fontStyle:'italic' }}>
          Arrastra barras · doble clic para detalles · punto verde para dependencias
        </div>
      </div>

      {actividades.length === 0 ? (
        <div style={{ padding:60, textAlign:'center', color:COLORS.slate400 }}>
          <p style={{ marginBottom:16 }}>No hay actividades aún.</p>
          <div style={{ display:'flex', gap:8, maxWidth:400, margin:'0 auto' }}>
            <input value={nuevaNombre} onChange={e => setNuevaNombre(e.target.value)} onKeyDown={e => e.key === 'Enter' && agregarActividadInline()} placeholder="Nombre de la primera actividad..." style={{...inputStyle, flex:1}}/>
            <button onClick={agregarActividadInline} disabled={!nuevaNombre.trim() || creando} style={{...btnPrimary, opacity: !nuevaNombre.trim() ? 0.5 : 1}}>{creando ? '...' : 'Crear'}</button>
          </div>
        </div>
      ) : (
      <div style={{ display:'flex' }}>
        <div style={{ width:LEFT_PANEL, flexShrink:0, borderRight:`2px solid ${COLORS.slate100}`, background:'white', zIndex:2 }}>
          <div style={{ height:HEADER_HEIGHT, borderBottom:`1px solid ${COLORS.slate100}`, display:'flex', alignItems:'flex-end', padding:'0 16px 12px', background:COLORS.slate50 }}>
            <span style={{ fontSize:10, fontWeight:700, color:COLORS.slate500, textTransform:'uppercase', letterSpacing:'0.1em' }}>#  Actividad</span>
          </div>
          {actOrdenadas.map(act => {
            const esPadre = act.es_servicio_padre
            const tieneHijos = actividades.some(a => a.parent_id === act.id)
            const isCollapsed = collapsed.has(act.id)
            const nivel = getNivel(act.id)
            const num = numeracion[act.id] || `${act.numero}`
            const depsCount = (act.deps || []).length
            return (
              <div key={act.id}
                onMouseEnter={() => setHoveredId(act.id)} onMouseLeave={() => setHoveredId(null)}
                onContextMenu={(e) => { e.preventDefault(); onMenuContextual?.(act, e.clientX, e.clientY) }}
                style={{ height:ROW_HEIGHT, borderBottom:`1px solid ${COLORS.slate100}`, display:'flex', alignItems:'center', padding:'0 8px 0 12px', paddingLeft: 12 + nivel * 18, background: hoveredId === act.id ? COLORS.slate50 : (esPadre ? '#FAFBFE' : 'white'), gap:6 }}>
                {tieneHijos ? (
                  <button onClick={() => toggleCollapse(act.id)} style={{ border:'none', background:'transparent', cursor:'pointer', padding:0, color:COLORS.slate500, display:'flex' }}>
                    {isCollapsed ? <Icon.ChevronRight/> : <Icon.ChevronDown/>}
                  </button>
                ) : <span style={{ width:12 }}/>}
                <span style={{ fontSize:10, fontFamily:'var(--font-mono)', color: esPadre ? COLORS.navy : COLORS.slate400, fontWeight: esPadre ? 700 : 500, minWidth: 32 }}>{num}</span>
                {act.es_milestone && <span style={{ color:COLORS.navy }}><Icon.Diamond/></span>}
                <BadgeImportancia importancia={act.importancia} tamano="mini"/>
                <div style={{ fontSize:12, color:COLORS.ink, fontWeight: esPadre ? 600 : 400, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  <EditableText value={act.nombre} onSave={v => onInlineUpdate(act.id, { nombre: v })} style={{ fontSize:12, color:COLORS.ink, fontWeight: esPadre ? 600 : 400 }}/>
                </div>
                {depsCount > 0 && <span title={`${depsCount} dependencia(s)`} style={{ display:'inline-flex', alignItems:'center', gap:2, fontSize:9, color:COLORS.teal, background:COLORS.tealLight, padding:'2px 5px', borderRadius:10, fontWeight:700 }}><Icon.Link/>{depsCount}</span>}
                {hoveredId === act.id && (
                  <>
                    <button onClick={() => onAbrirInfo(act)} title="Información" style={{ border:'none', background:'transparent', color:COLORS.slate500, cursor:'pointer', padding:3, display:'flex' }}><Icon.Info/></button>
                    {esPadre && <button onClick={() => onDesglosar(act)} title="Desglosar" style={{ background:'transparent', border:'none', color:COLORS.teal, cursor:'pointer', padding:3, display:'flex' }}><Icon.Scale/></button>}
                  </>
                )}
              </div>
            )
          })}
          <div style={{ height:ROW_HEIGHT, borderBottom:`1px solid ${COLORS.slate100}`, display:'flex', alignItems:'center', padding:'0 12px', gap:6 }}>
            <span style={{ width:12 }}/>
            <span style={{ fontSize:10, fontFamily:'var(--font-mono)', color:COLORS.slate400, minWidth:32 }}>+</span>
            <input value={nuevaNombre} onChange={e => setNuevaNombre(e.target.value)} onKeyDown={e => e.key === 'Enter' && agregarActividadInline()} placeholder="Agregar actividad..." style={{ flex:1, border:'none', outline:'none', background:'transparent', fontSize:12, color:COLORS.ink, padding:'4px 0', fontFamily:'inherit' }}/>
            {nuevaNombre.trim() && (
              <button onClick={agregarActividadInline} disabled={creando} style={{ padding:'4px 10px', background:COLORS.teal, color:'white', border:'none', borderRadius:6, fontSize:10, fontWeight:600, cursor:'pointer' }}>{creando ? '...' : 'Agregar'}</button>
            )}
          </div>
        </div>

        <div ref={scrollRef} style={{ flex:1, overflowX:'auto', overflowY:'hidden' }}>
          <div style={{ width:totalWidth, position:'relative' }}>
            <div style={{ position:'sticky', top:0, zIndex:3, background:COLORS.slate50, borderBottom:`1px solid ${COLORS.slate100}` }}>
              <div style={{ display:'flex', height:HEADER_HEIGHT/2, borderBottom:`1px solid ${COLORS.slate100}` }}>
                {meses.map(m => <div key={m.key} style={{ width: m.dias * DAY_WIDTH, borderRight:`1px solid ${COLORS.slate200}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:600, color:COLORS.navy, textTransform:'capitalize', background:'white' }}>{m.label}</div>)}
              </div>
              <div style={{ display:'flex', height:HEADER_HEIGHT/2 }}>
                {dias.map((d, i) => {
                  const isWeekend = d.getDay() === 0 || d.getDay() === 6
                  const isToday = toStr(d) === hoy
                  return (
                    <div key={i} style={{ width: DAY_WIDTH, flexShrink:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background: isToday ? COLORS.tealLight : (isWeekend ? '#F8FAFC' : 'white'), borderRight:`1px solid ${COLORS.slate100}`, fontSize:10, color: isToday ? COLORS.teal : COLORS.slate500, fontWeight: isToday ? 700 : 500, fontFamily:'var(--font-mono)' }}>
                      {zoom === 'dia' && <div style={{ fontSize:9, opacity:0.7 }}>{['D','L','M','M','J','V','S'][d.getDay()]}</div>}
                      <div style={{ fontSize: zoom === 'mes' ? 8 : 10 }}>{d.getDate()}</div>
                    </div>
                  )
                })}
              </div>
            </div>
            <div ref={timelineRef} style={{ position:'relative', height: totalHeight + ROW_HEIGHT }}>
              <div style={{ position:'absolute', inset:0, pointerEvents:'none', zIndex:0 }}>
                {zoom !== 'mes' && dias.map((d, i) => {
                  const isWeekend = d.getDay() === 0 || d.getDay() === 6
                  if (!isWeekend) return null
                  return <div key={i} style={{ position:'absolute', left: i*DAY_WIDTH, top:0, width:DAY_WIDTH, height:'100%', background:'rgba(241, 245, 249, 0.5)' }}/>
                })}
                {(() => {
                  const idx = dias.findIndex(d => toStr(d) === hoy)
                  if (idx < 0) return null
                  return <div style={{ position:'absolute', left: idx*DAY_WIDTH + DAY_WIDTH/2, top:0, width:0, height:'100%', borderLeft:`1.5px dashed ${COLORS.red}`, opacity:0.85 }}/>
                })()}
              </div>
              {actOrdenadas.map((act, rowIdx) => (
                <div key={`row-${act.id}`} onMouseEnter={() => setHoveredId(act.id)} onMouseLeave={() => setHoveredId(null)}
                  style={{ position:'absolute', left:0, right:0, top: rowIdx * ROW_HEIGHT, height: ROW_HEIGHT, borderBottom:`1px solid ${COLORS.slate100}`, background: hoveredId === act.id ? 'rgba(10, 37, 64, 0.02)' : 'transparent', zIndex: 1 }}/>
              ))}
              <div style={{ position:'absolute', left:0, right:0, top: actOrdenadas.length * ROW_HEIGHT, height: ROW_HEIGHT, borderBottom:`1px solid ${COLORS.slate100}`, background:'transparent', zIndex:1 }}/>
              <svg style={{ position:'absolute', inset:0, width:totalWidth, height: totalHeight, zIndex:2, overflow:'visible' }}>
                <defs>
                  <marker id="dep-dot" markerWidth="8" markerHeight="8" refX="4" refY="4" markerUnits="userSpaceOnUse">
                    <circle cx="4" cy="4" r="3" fill={COLORS.slate500}/>
                  </marker>
                  <marker id="dep-dot-hl" markerWidth="8" markerHeight="8" refX="4" refY="4" markerUnits="userSpaceOnUse">
                    <circle cx="4" cy="4" r="3.5" fill={COLORS.teal}/>
                  </marker>
                  <marker id="dep-dot-ghost" markerWidth="8" markerHeight="8" refX="4" refY="4" markerUnits="userSpaceOnUse">
                    <circle cx="4" cy="4" r="3" fill={COLORS.teal}/>
                  </marker>
                  <marker id="dep-dot-del" markerWidth="8" markerHeight="8" refX="4" refY="4" markerUnits="userSpaceOnUse">
                    <circle cx="4" cy="4" r="3.5" fill={COLORS.red}/>
                  </marker>
                  {/* v13.2: marker verde para drop target válido */}
                  <marker id="dep-dot-valid" markerWidth="12" markerHeight="12" refX="6" refY="6" markerUnits="userSpaceOnUse">
                    <circle cx="6" cy="6" r="5" fill="#16A34A"/>
                    <circle cx="6" cy="6" r="2.5" fill="white"/>
                  </marker>
                  {/* v14.1: marker rojo para ruta crítica */}
                  <marker id="dep-dot-critical" markerWidth="10" markerHeight="10" refX="5" refY="5" markerUnits="userSpaceOnUse">
                    <circle cx="5" cy="5" r="4" fill={COLORS.red}/>
                  </marker>
                </defs>
                {lineasDeps.map(l => {
                  const isBeingDeleted = depHover === l.id
                  // v14.1: si ambas actividades de la flecha son críticas Y está activo el toggle, pintar rojo
                  const esCriticaFrom = mostrarRutaCritica && cpm[l.fromId]?.critica
                  const esCriticaTo = mostrarRutaCritica && cpm[l.toId]?.critica
                  const esFlechaCritica = esCriticaFrom && esCriticaTo
                  const stroke = isBeingDeleted
                    ? COLORS.red
                    : esFlechaCritica
                      ? COLORS.red
                      : (l.highlighted ? COLORS.teal : COLORS.slate400)
                  const markerId = isBeingDeleted
                    ? 'dep-dot-del'
                    : esFlechaCritica
                      ? 'dep-dot-critical'
                      : (l.highlighted ? 'dep-dot-hl' : 'dep-dot')
                  return (
                    <g key={l.id} style={{ pointerEvents:'auto' }}>
                      {/* Hit area invisible (grueso para fácil click) */}
                      <path d={l.path} fill="none" stroke="transparent" strokeWidth={14}
                        style={{ cursor:'pointer' }}
                        onMouseEnter={() => setDepHover(l.id)}
                        onMouseLeave={() => setDepHover(null)}
                        onClick={() => onQuitarDep?.(l.fromId, l.toId)}
                      />
                      {/* Flecha visible — más gruesa si es crítica */}
                      <path d={l.path} fill="none" stroke={stroke}
                        strokeWidth={esFlechaCritica ? 2.5 : (isBeingDeleted ? 2.2 : (l.highlighted ? 2 : 1.5))}
                        opacity={isBeingDeleted ? 1 : (esFlechaCritica ? 0.95 : (l.highlighted ? 1 : 0.55))}
                        markerEnd={`url(#${markerId})`}
                        style={{ transition: drag ? 'none' : 'stroke 0.15s, opacity 0.15s, stroke-width 0.15s', pointerEvents:'none' }}
                      />
                    </g>
                  )
                })}
                {/* v13.2: Rubber-band mejorado — cambia color según haya target válido */}
                {dragDepPath && (
                  <>
                    {/* Línea gruesa base, semi-transparente */}
                    <path
                      d={dragDepPath}
                      fill="none"
                      stroke={dropTargetId ? '#16A34A' : COLORS.teal}
                      strokeWidth={4}
                      strokeDasharray="6 4"
                      opacity={dropTargetId ? 0.35 : 0.2}
                      style={{ pointerEvents:'none' }}
                    />
                    {/* Línea principal */}
                    <path
                      d={dragDepPath}
                      fill="none"
                      stroke={dropTargetId ? '#16A34A' : COLORS.teal}
                      strokeWidth={2}
                      strokeDasharray="6 4"
                      markerEnd={dropTargetId ? 'url(#dep-dot-valid)' : 'url(#dep-dot-ghost)'}
                      style={{ pointerEvents:'none' }}
                    />
                  </>
                )}
              </svg>
              {actOrdenadas.map((act, rowIdx) => {
                const estadoCfg = ESTADOS[act.estado] || ESTADOS['Sin iniciar']
                const prev = previewActividad(act)
                const x = getX(prev.inicio)
                const w = getW(prev.inicio, prev.fin)
                const esPadre = act.es_servicio_padre
                const esMilestone = act.es_milestone
                const isDraggedNow = drag && drag.actId === act.id
                const isHovered = hoveredId === act.id
                const isDropTarget = dropTargetId === act.id
                const barTop = rowIdx * ROW_HEIGHT + (esPadre ? 8 : BAR_VPAD)
                const barH = esPadre ? BAR_HEIGHT_PADRE : BAR_HEIGHT
                // v14.1: info de ruta crítica para esta actividad
                const cpmInfo = cpm[act.id]
                const esCritica = mostrarRutaCritica && !esPadre && cpmInfo?.critica
                const holguraDias = cpmInfo?.float ?? null

                if (esMilestone) {
                  // v13.3.1: Milestone (rombo) con dots de dependencia
                  // Usa la misma lógica de hitbox extendida que las barras normales
                  const mLeft = x + DAY_WIDTH/2 - 10  // Posición izquierda del rombo (20px de ancho)
                  const mTop = rowIdx * ROW_HEIGHT + ROW_HEIGHT/2 - 10
                  const dragDepActivo = drag && drag.tipo === 'dep'
                  const esOrigen = dragDepActivo && drag.actId === act.id
                  const visibleNormal = (isHovered || isDraggedNow) && !dragDepActivo
                  const visibleComoOrigen = esOrigen
                  const visibleComoTarget = dragDepActivo && !esOrigen
                  const mostrarDots = visibleNormal || visibleComoOrigen || visibleComoTarget
                  const esTarget = visibleComoTarget && isDropTarget
                  const colorDot = esTarget ? '#16A34A' : COLORS.teal

                  const dotStyle = {
                    position:'absolute',
                    top:'50%', transform:'translateY(-50%)',
                    width:12, height:12, borderRadius:'50%',
                    background:'white',
                    border:`2px solid ${colorDot}`,
                    boxShadow:`0 2px 6px rgba(15,110,86,0.4)`,
                    cursor:'crosshair', zIndex:15,
                    borderStyle: visibleComoTarget && !esTarget ? 'dashed' : 'solid',
                    opacity: visibleComoTarget && !esTarget ? 0.5 : 1,
                    transition:'transform 0.08s, border-color 0.12s',
                  }

                  return (
                    <div key={act.id} data-act-id={act.id}
                      style={{
                        position:'absolute',
                        // Hitbox extendida: 20px a cada lado para capturar hover en dots
                        left: mLeft - 20,
                        top: mTop,
                        width: 20 + 40, // rombo (20) + 40px de hitbox
                        height: 20,
                        zIndex: isDraggedNow ? 10 : 3,
                      }}
                      onMouseEnter={(e) => { setHoveredId(act.id); setTooltip({ act, x: e.clientX, y: e.clientY }) }}
                      onMouseMove={(e) => !drag && setTooltip({ act, x: e.clientX, y: e.clientY })}
                      onMouseLeave={() => { setHoveredId(null); setTooltip(null) }}
                    >
                      {/* Contenedor relativo para posicionar rombo + dots */}
                      <div style={{ position:'relative', width:'100%', height:'100%' }}>
                        {/* EL ROMBO (el drag 'move' va aquí) */}
                        <div
                          onMouseDown={(e) => iniciarDrag(e, act, 'move')}
                          onContextMenu={(e) => { e.preventDefault(); onMenuContextual?.(act, e.clientX, e.clientY) }}
                          onDoubleClick={() => onAbrirInfo(act)}
                          style={{
                            position:'absolute',
                            left: 20,  // desplazado 20px dentro del hitbox
                            top: 0,
                            width: 20, height: 20,
                            // v14.1: rombo rojo si es crítico
                            background: esCritica ? COLORS.red : estadoCfg.bar,
                            transform:'rotate(45deg)',
                            borderRadius:3,
                            boxShadow: isDropTarget
                              ? `0 0 0 3px ${COLORS.teal}, 0 4px 12px rgba(15,110,86,0.5)`
                              : esCritica
                                ? `0 0 0 2px rgba(220,38,38,0.3), 0 3px 8px rgba(220,38,38,0.4)`
                                : (isHovered ? '0 4px 10px rgba(0,0,0,0.2)' : '0 2px 6px rgba(0,0,0,0.15)'),
                            cursor:'grab',
                            zIndex:3,
                            transition: drag ? 'none' : 'box-shadow 0.15s, background 0.2s',
                          }}
                        />

                        {/* DOT IZQUIERDO — separado del rombo */}
                        {mostrarDots && (visibleNormal || visibleComoTarget) && (
                          <div
                            onMouseDown={(e) => { e.stopPropagation(); iniciarDrag(e, act, 'dep') }}
                            title="Arrastra a otra actividad para crear dependencia"
                            style={{
                              ...dotStyle,
                              left: 4,  // 4px desde el borde izq del hitbox
                              transform: isHovered && !dragDepActivo
                                ? 'translateY(-50%) scale(1.15)'
                                : 'translateY(-50%)',
                            }}
                          />
                        )}

                        {/* DOT DERECHO */}
                        {mostrarDots && (
                          <div
                            onMouseDown={(e) => { e.stopPropagation(); iniciarDrag(e, act, 'dep') }}
                            title="Arrastra a otra actividad para crear dependencia"
                            style={{
                              ...dotStyle,
                              right: 4,  // 4px desde el borde der del hitbox
                              transform: isHovered && !dragDepActivo
                                ? 'translateY(-50%) scale(1.15)'
                                : 'translateY(-50%)',
                            }}
                          />
                        )}
                      </div>
                    </div>
                  )
                }
                return (
                  <div key={act.id} data-act-id={act.id}
                    style={{
                      position:'absolute',
                      // v13.2: hitbox extendida 20px en cada lado para capturar
                      // el hover cuando el mouse va hacia los dots que están AFUERA
                      left: x - 20,
                      top: barTop,
                      width: w + 40,
                      height: barH,
                      zIndex: isDraggedNow ? 10 : 3,
                      // El hover del wrapper activa todo lo de adentro sin dispararse
                      // mouseleave al cruzar entre barra visible y dots
                    }}
                    onMouseEnter={(e) => { setHoveredId(act.id); setTooltip({ act, x: e.clientX, y: e.clientY }) }}
                    onMouseMove={(e) => !drag && setTooltip({ act, x: e.clientX, y: e.clientY })}
                    onMouseLeave={() => { setHoveredId(null); setTooltip(null) }}
                  >
                    {/* Contenedor interno con offset de 20px para que la barra visible
                        quede posicionada correctamente. Padding transparente alrededor
                        actúa como hitbox extendida para el hover. */}
                    <div style={{ position:'absolute', left:20, top:0, width:w, height:'100%' }}>
                      {/* BARRA PRINCIPAL */}
                      <div
                        onMouseDown={(e) => iniciarDrag(e, act, 'move')}
                        onContextMenu={(e) => { e.preventDefault(); onMenuContextual?.(act, e.clientX, e.clientY) }}
                        onDoubleClick={() => onAbrirInfo(act)}
                        style={{
                          position:'absolute', inset:0,
                          // v14.1: si es crítica, gradiente rojo oscuro (estilo MS Project)
                          background: esPadre
                            ? `linear-gradient(135deg, ${COLORS.navy} 0%, ${COLORS.navy2} 100%)`
                            : esCritica
                              ? 'linear-gradient(135deg, #991B1B 0%, #DC2626 100%)'
                              : estadoCfg.gradient,
                          borderRadius: esPadre ? 4 : 7,
                          display:'flex', alignItems:'center', padding:'0 10px',
                          boxShadow: isDropTarget
                            ? `0 0 0 3px ${COLORS.teal}, 0 4px 16px rgba(15,110,86,0.5)`
                            : esCritica
                              ? `0 0 0 1px rgba(220,38,38,0.4), 0 2px 8px rgba(220,38,38,0.3)`
                              : (isHovered || isDraggedNow ? `0 4px 12px rgba(10, 37, 64, 0.25)` : '0 1px 3px rgba(10, 37, 64, 0.1)'),
                          transition: drag ? 'none' : 'box-shadow 0.15s, background 0.2s',
                          overflow:'hidden',
                          cursor: isDraggedNow && drag?.tipo === 'move' ? 'grabbing' : 'grab',
                        }}
                      >
                        {!esPadre && act.avance > 0 && <div style={{ position:'absolute', left:0, top:0, bottom:0, width:`${act.avance}%`, background:'rgba(255,255,255,0.25)', pointerEvents:'none' }}/>}
                        {w > 70 && <span style={{ position:'relative', fontSize:11, fontWeight:600, color:'white', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', textShadow:'0 1px 2px rgba(0,0,0,0.2)', pointerEvents:'none' }}>{act.nombre}{!esPadre && act.avance > 0 && <span style={{ opacity:0.9, fontSize:10 }}> · {act.avance}%</span>}</span>}
                        {/* v14.1: indicador visual sutil "crítica" en la barra cuando el toggle está on */}
                        {esCritica && w > 40 && (
                          <span style={{
                            position:'absolute', right:4, top:2,
                            fontSize:9, fontWeight:800,
                            color:'rgba(255,255,255,0.85)',
                            letterSpacing:'0.05em',
                            pointerEvents:'none',
                            textShadow:'0 1px 2px rgba(0,0,0,0.3)',
                          }}>!</span>
                        )}
                      </div>

                      {/* RESIZE HANDLES */}
                      <div
                        onMouseDown={(e) => { e.stopPropagation(); iniciarDrag(e, act, 'resize-left') }}
                        style={{
                          position:'absolute', left:0, top:0, width:8, height:'100%',
                          cursor:'ew-resize', zIndex:4,
                          background: isHovered && !isDraggedNow ? 'rgba(255,255,255,0.5)' : 'transparent',
                          borderLeft: isHovered && !isDraggedNow ? '2px solid rgba(255,255,255,0.8)' : 'none',
                          borderTopLeftRadius: esPadre ? 4 : 7, borderBottomLeftRadius: esPadre ? 4 : 7,
                          transition: 'background 0.12s, border-color 0.12s',
                        }}
                      />
                      <div
                        onMouseDown={(e) => { e.stopPropagation(); iniciarDrag(e, act, 'resize-right') }}
                        style={{
                          position:'absolute', right:0, top:0, width:8, height:'100%',
                          cursor:'ew-resize', zIndex:4,
                          background: isHovered && !isDraggedNow ? 'rgba(255,255,255,0.5)' : 'transparent',
                          borderRight: isHovered && !isDraggedNow ? '2px solid rgba(255,255,255,0.8)' : 'none',
                          borderTopRightRadius: esPadre ? 4 : 7, borderBottomRightRadius: esPadre ? 4 : 7,
                          transition: 'background 0.12s, border-color 0.12s',
                        }}
                      />

                      {/* v13.2: DOTS DE DEPENDENCIA — AFUERA de la barra (estilo MS Project/Kantata)
                          Visibilidad:
                          - Hover normal: ambos dots visibles en los bordes
                          - Arrastrando desde esta barra: solo dot derecho (origen)
                          - Otra barra está arrastrando: dots ghost punteados a ambos lados (como targets)
                          El hitbox del padre (wrapper de 40px extra) asegura que el mouse no
                          pierda el hover al moverse de la barra a los dots. */}
                      {(() => {
                        const dragDepActivo = drag && drag.tipo === 'dep'
                        const esOrigen = dragDepActivo && drag.actId === act.id
                        const visibleNormal = (isHovered || isDraggedNow) && !dragDepActivo
                        const visibleComoOrigen = esOrigen
                        const visibleComoTarget = dragDepActivo && !esOrigen
                        if (!visibleNormal && !visibleComoOrigen && !visibleComoTarget) return null

                        const esTarget = visibleComoTarget && isDropTarget
                        const colorDot = esTarget ? '#16A34A' : COLORS.teal

                        const dotStyle = {
                          position: 'absolute',
                          top: '50%', transform: 'translateY(-50%)',
                          width: 12, height: 12, borderRadius: '50%',
                          background: 'white',
                          border: `2px solid ${colorDot}`,
                          boxShadow: `0 2px 6px rgba(15,110,86,0.4)`,
                          cursor: 'crosshair',
                          zIndex: 15,
                          borderStyle: visibleComoTarget && !esTarget ? 'dashed' : 'solid',
                          opacity: visibleComoTarget && !esTarget ? 0.5 : 1,
                          transition: 'transform 0.08s, border-color 0.12s',
                        }

                        return (
                          <>
                            {/* DOT DERECHO — AFUERA (right: -14) */}
                            <div
                              onMouseDown={(e) => { e.stopPropagation(); iniciarDrag(e, act, 'dep') }}
                              title="Arrastra a otra actividad para crear dependencia"
                              style={{
                                ...dotStyle,
                                right: -14,
                                transform: isHovered && !dragDepActivo
                                  ? 'translateY(-50%) scale(1.15)'
                                  : 'translateY(-50%)',
                              }}
                            />
                            {/* DOT IZQUIERDO — AFUERA (left: -14) - solo hover normal */}
                            {(visibleNormal || visibleComoTarget) && (
                              <div
                                onMouseDown={(e) => { e.stopPropagation(); iniciarDrag(e, act, 'dep') }}
                                title="Arrastra a otra actividad para crear dependencia"
                                style={{
                                  ...dotStyle,
                                  left: -14,
                                  transform: isHovered && !dragDepActivo
                                    ? 'translateY(-50%) scale(1.15)'
                                    : 'translateY(-50%)',
                                }}
                              />
                            )}
                          </>
                        )
                      })()}

                      {/* Outline del drop target */}
                      {isDropTarget && (
                        <div style={{
                          position:'absolute', inset:-4,
                          border:`2.5px dashed ${COLORS.teal}`,
                          borderRadius: esPadre ? 6 : 9,
                          background:'rgba(15,110,86,0.08)',
                          pointerEvents:'none',
                          zIndex:5,
                        }}/>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
      )}

      {tooltip && !drag && (
        <div style={{ position:'fixed', left: Math.min(tooltip.x + 14, window.innerWidth - 280), top: tooltip.y + 14, background: 'white', border: `1px solid ${COLORS.slate200}`, borderRadius: 10, padding: '12px 14px', boxShadow: '0 8px 24px rgba(10, 37, 64, 0.18)', fontSize: 11, minWidth: 240, zIndex: 1000, pointerEvents: 'none' }}>
          <div style={{ fontSize:13, fontWeight:600, color:COLORS.navy, marginBottom:6 }}>{tooltip.act.nombre}</div>
          <div style={{ display:'flex', justifyContent:'space-between', color:COLORS.slate500, fontFamily:'var(--font-mono)', marginBottom:3, fontSize:11 }}><span>Inicio</span><span>{tooltip.act.inicio}</span></div>
          <div style={{ display:'flex', justifyContent:'space-between', color:COLORS.slate500, fontFamily:'var(--font-mono)', marginBottom:3, fontSize:11 }}><span>Fin</span><span>{tooltip.act.fin}</span></div>
          <div style={{ display:'flex', justifyContent:'space-between', color:COLORS.slate500, fontFamily:'var(--font-mono)', marginBottom:8, fontSize:11 }}><span>Duración</span><span>{diffDays(tooltip.act.inicio, tooltip.act.fin) + 1} días</span></div>
          {/* v14.1: Holgura / Ruta crítica cuando el toggle está ON */}
          {mostrarRutaCritica && cpm[tooltip.act.id] && !tooltip.act.es_servicio_padre && (
            cpm[tooltip.act.id].critica ? (
              <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8, padding:'6px 8px', background:'#FEF2F2', border:`1px solid ${COLORS.red}`, borderRadius:6 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={COLORS.red} strokeWidth="2.5" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <span style={{ fontSize:11, fontWeight:700, color:COLORS.red }}>RUTA CRÍTICA</span>
                <span style={{ fontSize:10, color:COLORS.slate500, marginLeft:'auto' }}>sin holgura</span>
              </div>
            ) : (
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8, padding:'5px 8px', background:COLORS.slate50, borderRadius:6, fontSize:10 }}>
                <span style={{ color:COLORS.slate600, fontWeight:600 }}>Holgura</span>
                <span style={{ color:COLORS.teal, fontWeight:700, fontFamily:'var(--font-mono)' }}>
                  +{cpm[tooltip.act.id].float} día{cpm[tooltip.act.id].float === 1 ? '' : 's'}
                </span>
              </div>
            )
          )}
          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom: tooltip.act.avance > 0 ? 8 : 0 }}>
            <Badge texto={tooltip.act.estado} mapa={ESTADOS} tamano={10}/>
            {(tooltip.act.deps || []).length > 0 && <span style={{ fontSize:9, color:COLORS.teal, background:COLORS.tealLight, padding:'2px 6px', borderRadius:10, fontWeight:700 }}>← {tooltip.act.deps.length} dep</span>}
          </div>
          {tooltip.act.avance > 0 && <BarraAvance avance={tooltip.act.avance} height={4}/>}
        </div>
      )}

      <div style={{ padding:'10px 20px', borderTop:`1px solid ${COLORS.slate100}`, background:COLORS.slate50, display:'flex', gap:16, flexWrap:'wrap', fontSize:11, alignItems:'center' }}>
        {Object.entries(ESTADOS).map(([key, cfg]) => (
          <div key={key} style={{ display:'flex', alignItems:'center', gap:5 }}>
            <div style={{ width:12, height:8, background:cfg.gradient, borderRadius:2 }}/>
            <span style={{ color:COLORS.slate600, fontSize:10 }}>{key}</span>
          </div>
        ))}
        <div style={{ display:'flex', alignItems:'center', gap:5 }}>
          <svg width="20" height="8"><path d="M 0 4 L 20 4" stroke={COLORS.slate400} strokeWidth="1.3" fill="none"/><circle cx="18" cy="4" r="2.2" fill={COLORS.slate500}/></svg>
          <span style={{ color:COLORS.slate600, fontSize:10 }}>Dep</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:5 }}>
          <div style={{ width:0, height:10, borderLeft:`1.5px dashed ${COLORS.red}` }}/>
          <span style={{ color:COLORS.slate600, fontSize:10 }}>Hoy</span>
        </div>
        {/* v14.1: leyenda ruta crítica cuando el toggle está ON */}
        {mostrarRutaCritica && (
          <div style={{ display:'flex', alignItems:'center', gap:5 }}>
            <div style={{ width:14, height:8, background:'linear-gradient(135deg, #991B1B 0%, #DC2626 100%)', borderRadius:2 }}/>
            <span style={{ color:COLORS.slate600, fontSize:10, fontWeight:600 }}>Ruta crítica</span>
          </div>
        )}
      </div>
    </div>
  )
}

function TabResumen({ proyecto, actividades, hitos, usuarios, puedeVerFinanciero }) {
  const padres = actividades.filter(a => !a.parent_id)
  const avance = padres.length > 0
    ? Math.round(padres.reduce((s,a) => s+(a.avance||0), 0) / padres.length)
    : 0
  const completadas = actividades.filter(a => a.completada).length
  const bloqueadas = actividades.filter(a => a.estado === 'Bloqueada').length
  const retrasadas = actividades.filter(a => a.estado === 'Retrasada').length

  const responsableIds = [...new Set(actividades.map(a => a.responsable_id).filter(Boolean))]
  const equipo = usuarios.filter(u => responsableIds.includes(u.id))
  const director = usuarios.find(u => u.id === proyecto.director_id)

  return (
    <div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:14, marginBottom:18 }}>
        <div style={cardStyle}>
          <div style={{ fontSize:11, color:COLORS.slate500, marginBottom:6 }}>Avance global</div>
          <div style={{ fontSize:32, fontWeight:400, color:COLORS.navy, fontFamily:'var(--font-sans)', marginBottom:6 }}>{avance}%</div>
          <BarraAvance avance={avance}/>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize:11, color:COLORS.slate500, marginBottom:6 }}>Estado</div>
          <div style={{ marginBottom:6, marginTop:10 }}><Badge texto={proyecto.estado} mapa={ESTADOS_PROY} tamano={13}/></div>
          <div style={{ fontSize:11, color:COLORS.slate400 }}>{completadas} de {actividades.length} actividades</div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize:11, color:COLORS.slate500, marginBottom:6 }}>Fecha de cierre</div>
          <div style={{ fontSize:18, fontWeight:500, color:COLORS.navy, fontFamily:'var(--font-sans)' }}>{fmtDate(proyecto.cierre)}</div>
          <div style={{ fontSize:11, color:COLORS.slate400, marginTop:4 }}>Inicio: {fmtDate(proyecto.inicio)}</div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize:11, color:COLORS.slate500, marginBottom:6 }}>Alertas</div>
          <div style={{ fontSize:32, fontWeight:400, color: (bloqueadas+retrasadas)>0 ? COLORS.red : COLORS.teal, fontFamily:'var(--font-sans)', marginBottom:4 }}>{bloqueadas + retrasadas}</div>
          <div style={{ fontSize:11, color:COLORS.slate400 }}>{bloqueadas} bloq · {retrasadas} retr</div>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
        <div style={cardStyle}>
          <div style={{ ...labelStyle, marginBottom:12 }}>Equipo asignado</div>
          {director && (
            <div style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderBottom:`1px solid ${COLORS.slate100}` }}>
              <Avatar nombre={director.nombre} color={COLORS.navy} tamano={36}/>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:600, color:COLORS.ink }}>{director.nombre}</div>
                <div style={{ fontSize:11, color:COLORS.slate500 }}>Director del proyecto</div>
              </div>
            </div>
          )}
          {equipo.length === 0 && !director && (
            <div style={{ padding:16, textAlign:'center', color:COLORS.slate400, fontSize:12 }}>Sin responsables asignados aún.</div>
          )}
          {equipo.filter(u => u.id !== proyecto.director_id).map(u => (
            <div key={u.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderBottom:`1px solid ${COLORS.slate100}` }}>
              <Avatar nombre={u.nombre} color={COLORS.teal} tamano={36}/>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:600, color:COLORS.ink }}>{u.nombre}</div>
                <div style={{ fontSize:11, color:COLORS.slate500 }}>
                  {actividades.filter(a => a.responsable_id === u.id).length} actividad(es)
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={cardStyle}>
          <div style={{ ...labelStyle, marginBottom:12 }}>Hitos de cobro</div>
          {!puedeVerFinanciero ? (
            <div style={{ padding:16, textAlign:'center', color:COLORS.slate500, fontSize:12, background:COLORS.slate50, borderRadius:8 }}>
              🔒 Información financiera restringida
            </div>
          ) : hitos.length === 0 ? (
            <div style={{ padding:16, textAlign:'center', color:COLORS.slate400, fontSize:12 }}>Sin hitos de cobro registrados.</div>
          ) : hitos.map(h => {
            const cfg = ESTADOS_HITO[h.estado] || ESTADOS_HITO['Pendiente']
            return (
              <div key={h.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 0', borderBottom:`1px solid ${COLORS.slate100}` }}>
                <div style={{ width:10, height:10, borderRadius:'50%', background:cfg.sem, flexShrink:0 }}/>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, fontWeight:600, color:COLORS.ink, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{h.descripcion || h.concepto || 'Hito'}</div>
                  <div style={{ fontSize:10, color:COLORS.slate500, fontFamily:'var(--font-mono)' }}>{fmtDate(h.fecha_vencimiento || h.fecha_pago)}</div>
                </div>
                <div style={{ fontSize:12, fontWeight:700, color:COLORS.navy, fontFamily:'var(--font-mono)' }}>{fmtMoney(h.monto)}</div>
                <Badge texto={h.estado} mapa={ESTADOS_HITO} tamano={10}/>
              </div>
            )
          })}
        </div>
      </div>

      {proyecto.descripcion && (
        <div style={cardStyle}>
          <div style={{ ...labelStyle, marginBottom:10 }}>Alcance técnico</div>
          <p style={{ fontSize:13, lineHeight:1.7, color:COLORS.slate600, margin:0 }}>{proyecto.descripcion}</p>
        </div>
      )}
    </div>
  )
}

function TabActividades({ actividades, numeracion, onToggle, onInlineUpdate, onAbrirInfo, onDesglosar, onNuevaActividad, onMenuContextual, onEliminar, puedeEditarPeso }) {
  const [nombreNueva, setNombreNueva] = useState('')
  const [creandoBajo, setCreandoBajo] = useState(null)
  const [creando, setCreando] = useState(false)

  const padres = actividades.filter(a => !a.parent_id).sort((a,b) => (a.numero||0) - (b.numero||0))
  const getNivel = id => (numeracion[id] || '').split('.').length - 1

  const crearBajo = async (parentId) => {
    if (!nombreNueva.trim()) return
    setCreando(true)
    try {
      await onNuevaActividad({ nombre: nombreNueva.trim(), parentId })
      setNombreNueva(''); setCreandoBajo(null)
    } catch (e) { alert('Error: ' + e.message) }
    setCreando(false)
  }

  return (
    <div>
      {padres.length === 0 ? (
        <div style={{ ...cardStyle, textAlign:'center', color:COLORS.slate400, padding:40 }}>
          Sin actividades aún. Usa el Gantt para agregar la primera.
        </div>
      ) : padres.map(padre => {
        const hijos = actividades.filter(a => a.parent_id === padre.id).sort((a,b) => (a.numero||0) - (b.numero||0))
        // v12: avance ponderado con fórmula Luis
        const padreAvance = hijos.length > 0
          ? calcularAvancePonderado(actividades, padre.id)
          : (padre.avance||0)
        // v12: validación suma de pesos
        const sumaPesos = hijos.reduce((s, h) => s + Number(h.peso || 0), 0)
        const sumaOk = sumaPesos === 0 || sumaPesos === 100
        return (
          <div key={padre.id} style={{ marginBottom:16 }}>
            <div
              onContextMenu={(e) => { e.preventDefault(); onMenuContextual?.(padre, e.clientX, e.clientY) }}
              style={{ background:'linear-gradient(to right, #F8FAFC, white)', padding:'12px 16px', border:`1px solid ${COLORS.slate100}`, borderRadius:10, marginBottom:2, display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ fontSize:11, fontFamily:'var(--font-mono)', color:COLORS.navy, fontWeight:700, minWidth:24 }}>{numeracion[padre.id]}</span>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:14, fontWeight:600, color:COLORS.navy, fontFamily:'var(--font-sans)' }}>
                  <EditableText value={padre.nombre} onSave={v => onInlineUpdate(padre.id, { nombre: v })} style={{ fontSize:14, fontWeight:600, color:COLORS.navy, fontFamily:'var(--font-sans)' }}/>
                </div>
                <div style={{ fontSize:10, color:COLORS.slate500, fontFamily:'var(--font-mono)', marginTop:2 }}>
                  {fmtDate(padre.inicio)} → {fmtDate(padre.fin)} · {hijos.length} sub-actividades
                  {/* v12: indicador de suma de pesos */}
                  {hijos.length > 0 && sumaPesos > 0 && (
                    <span style={{ marginLeft:10, padding:'1px 7px', borderRadius:4, background: sumaOk ? '#E1F5EE' : '#FEF2F2', color: sumaOk ? '#0F6E56' : '#DC2626', fontWeight:700 }}>
                      pesos: {sumaPesos}%{!sumaOk && ' ⚠'}
                    </span>
                  )}
                </div>
              </div>
              <BadgeImportancia importancia={padre.importancia} tamano="normal"/>
              <div style={{ width:140 }}><BarraAvance avance={padreAvance}/></div>
              <Badge texto={padre.estado} mapa={ESTADOS}/>
              <button onClick={() => onAbrirInfo(padre)} style={{ padding:'5px 10px', background:'transparent', color:COLORS.slate600, border:`1px solid ${COLORS.slate200}`, borderRadius:6, fontSize:10, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:3 }}><Icon.Info/></button>
              {padre.es_servicio_padre && <button onClick={() => onDesglosar(padre)} title="Desglosar con plantilla" style={{ padding:'5px 10px', background:COLORS.tealLight, color:COLORS.teal, border:'none', borderRadius:6, fontSize:10, fontWeight:600, cursor:'pointer' }}>⚖ Desglosar</button>}
              {/* v11: Botón eliminar visible */}
              <button onClick={() => onEliminar?.(padre)} title="Eliminar actividad" style={{ padding:'5px 9px', background:'transparent', color:COLORS.red, border:`1px solid #FECACA`, borderRadius:6, fontSize:10, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center' }}><Icon.Trash/></button>
            </div>
            {hijos.map(h => {
              const nivel = getNivel(h.id)
              const depsCount = (h.deps || []).length
              return (
                <div key={h.id}
                  onContextMenu={(e) => { e.preventDefault(); onMenuContextual?.(h, e.clientX, e.clientY) }}
                  style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 16px', background:'white', border:`1px solid ${COLORS.slate100}`, borderTop:'none', paddingLeft: 16 + nivel * 20 }}>
                  <div onClick={() => onToggle(h)} style={{ width:18, height:18, borderRadius:5, border:`1.5px solid ${h.completada?COLORS.teal:'#CBD5E1'}`, background:h.completada?COLORS.teal:'white', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'white', flexShrink:0 }}>{h.completada && <Icon.Check/>}</div>
                  <span style={{ fontSize:10, fontFamily:'var(--font-mono)', color:COLORS.slate400, fontWeight:500, minWidth:36 }}>{numeracion[h.id]}</span>
                  {h.es_milestone && <span style={{ color:COLORS.navy }}><Icon.Diamond/></span>}
                  <BadgeImportancia importancia={h.importancia} tamano="mini"/>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <span style={{ fontSize:13, color:COLORS.ink }}>
                        <EditableText value={h.nombre} onSave={v => onInlineUpdate(h.id, { nombre: v })} style={{ fontSize:13, color:COLORS.ink }}/>
                      </span>
                      {depsCount > 0 && <span style={{ display:'inline-flex', alignItems:'center', gap:3, background:COLORS.tealLight, color:COLORS.teal, padding:'2px 7px', borderRadius:10, fontSize:10, fontWeight:700 }}><Icon.Link/>{depsCount}</span>}
                      {/* v12: Badge cobrable */}
                      {h.es_cobrable && (
                        <span title={`Cobrable: ${h.estado_cobro || 'Pendiente'}`} style={{ display:'inline-flex', alignItems:'center', gap:3, background: ESTADOS_COBRO[h.estado_cobro]?.bg || '#E1F5EE', color: ESTADOS_COBRO[h.estado_cobro]?.color || '#0F6E56', padding:'2px 7px', borderRadius:4, fontSize:10, fontWeight:700 }}>
                          $ {ESTADOS_COBRO[h.estado_cobro]?.label || 'cobrable'}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize:10, color:COLORS.slate500, fontFamily:'var(--font-mono)', marginTop:2 }}>{fmtDate(h.inicio)} → {fmtDate(h.fin)} · {diffDays(h.inicio, h.fin) + 1}d</div>
                  </div>
                  {/* v12: Input peso % (editable solo por direccion/admin) */}
                  {(puedeEditarPeso) && (
                    <div title="Peso ponderado (Luis)" style={{ display:'flex', alignItems:'center', gap:2 }}>
                      <input
                        type="number" min="0" max="100" step="1"
                        value={h.peso || 0}
                        onChange={e => {
                          const v = Math.min(100, Math.max(0, parseInt(e.target.value) || 0))
                          onInlineUpdate(h.id, { peso: v })
                        }}
                        onClick={e => e.stopPropagation()}
                        style={{ width:42, padding:'3px 4px', textAlign:'right', border:`1px solid ${COLORS.slate200}`, borderRadius:5, fontSize:11, fontFamily:'var(--font-mono)', fontWeight:700, color: (h.peso || 0) > 0 ? COLORS.navy : COLORS.slate400, background: 'white' }}
                      />
                      <span style={{ fontSize:10, color:COLORS.slate500, fontWeight:700 }}>%</span>
                    </div>
                  )}
                  <BarraAvance avance={h.avance}/>
                  <select value={h.estado} onChange={e => onInlineUpdate(h.id, { estado: e.target.value })} style={{ padding:'4px 8px', border:`1px solid ${COLORS.slate200}`, borderRadius:6, fontSize:11, background: ESTADOS[h.estado]?.bg, color: ESTADOS[h.estado]?.color, fontWeight:500, cursor:'pointer', fontFamily:'inherit' }}>
                    {Object.keys(ESTADOS).map(k => <option key={k} value={k}>{k}</option>)}
                  </select>
                  <button onClick={() => onAbrirInfo(h)} title="Información" style={{ padding:'5px 9px', background:'transparent', color:COLORS.slate500, border:`1px solid ${COLORS.slate200}`, borderRadius:6, fontSize:10, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center' }}><Icon.Info/></button>
                  {/* v11: Botón eliminar visible */}
                  <button onClick={() => onEliminar?.(h)} title="Eliminar actividad" style={{ padding:'5px 9px', background:'transparent', color:COLORS.red, border:`1px solid #FECACA`, borderRadius:6, fontSize:10, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center' }}><Icon.Trash/></button>
                </div>
              )
            })}
            {creandoBajo === padre.id ? (
              <div style={{ display:'flex', gap:8, padding:'10px 16px', background:COLORS.slate50, border:`1px solid ${COLORS.slate100}`, borderTop:'none', borderBottomLeftRadius:10, borderBottomRightRadius:10 }}>
                <input value={nombreNueva} onChange={e => setNombreNueva(e.target.value)} onKeyDown={e => e.key === 'Enter' && crearBajo(padre.id)} autoFocus placeholder="Nombre de la sub-actividad..." style={{...inputStyle, flex:1}}/>
                <button onClick={() => crearBajo(padre.id)} disabled={!nombreNueva.trim() || creando} style={{...btnTeal, padding:'7px 14px'}}>{creando ? '...' : 'Crear'}</button>
                <button onClick={() => { setCreandoBajo(null); setNombreNueva('') }} style={{...btnSecondary, padding:'7px 14px'}}>Cancelar</button>
              </div>
            ) : (
              <div onClick={() => setCreandoBajo(padre.id)} style={{ padding:'10px 16px', background:COLORS.slate50, border:`1px dashed ${COLORS.slate200}`, borderTop:'none', borderBottomLeftRadius:10, borderBottomRightRadius:10, fontSize:11, color:COLORS.slate500, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
                <Icon.Plus/> Agregar sub-actividad a "{padre.nombre}"
              </div>
            )}
          </div>
        )
      })}
      <div style={{ marginTop:20 }}>
        {creandoBajo === 'root' ? (
          <div style={{ display:'flex', gap:8, padding:'12px 16px', background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:10 }}>
            <input value={nombreNueva} onChange={e => setNombreNueva(e.target.value)} onKeyDown={e => e.key === 'Enter' && crearBajo(null)} autoFocus placeholder="Nombre del nuevo servicio/fase..." style={{...inputStyle, flex:1}}/>
            <button onClick={() => crearBajo(null)} disabled={!nombreNueva.trim() || creando} style={btnPrimary}>{creando ? '...' : 'Crear'}</button>
            <button onClick={() => { setCreandoBajo(null); setNombreNueva('') }} style={btnSecondary}>Cancelar</button>
          </div>
        ) : (
          <button onClick={() => setCreandoBajo('root')} style={{ width:'100%', padding:'14px', background:'white', border:`2px dashed ${COLORS.slate200}`, borderRadius:10, color:COLORS.slate500, fontSize:13, fontWeight:500, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
            <Icon.Plus/> Agregar nuevo servicio / fase
          </button>
        )}
      </div>
    </div>
  )
}

function TabKanban({ actividades, onAbrirInfo, numeracion }) {
  // v14.1.1: Kanban rediseñado robusto — muestra TODAS las actividades no-padre
  // Bug anterior: filtro que ocultaba actividades padre intermedias y completadas
  // Nuevo: 6 columnas (incluyendo completadas colapsable) + milestones visibles

  const hoy = toStr(new Date())
  const semana = addDays(hoy, 7)
  const mes = addDays(hoy, 30)

  const [mostrarCompletadas, setMostrarCompletadas] = useState(false)

  const estaCompletada = (a) =>
    a.completada === true ||
    a.avance === 100 ||
    a.estado === 'Completada'

  // Clasificación simple: solo excluir servicios-padre "puros" (con hijos reales)
  // Los milestones, actividades con padre, actividades root sin hijos → todo entra
  const clasifica = (a) => {
    if (a.estado === 'Cancelada') return null
    if (estaCompletada(a)) return 'completadas'
    if (!a.fin) return 'sinFecha'
    if (a.fin < hoy) return 'retrasadas'
    if (a.fin <= semana) return 'semana'
    if (a.fin <= mes) return 'mes'
    return 'futuro'
  }

  const cols = { retrasadas: [], semana: [], mes: [], futuro: [], sinFecha: [], completadas: [] }
  actividades.forEach(a => {
    // Excluir solo los "servicios padre" (agrupadores visuales con hijos)
    // Los demás — incluyendo milestones — se muestran
    const tieneHijos = actividades.some(x => x.parent_id === a.id)
    if (a.es_servicio_padre && tieneHijos) return
    const c = clasifica(a)
    if (c) cols[c].push(a)
  })

  // Orden: por fecha fin ascendente (completadas por fin descendente)
  Object.keys(cols).forEach(k => {
    if (k === 'completadas') {
      cols[k].sort((a, b) => (b.fin || '').localeCompare(a.fin || ''))
    } else {
      cols[k].sort((a, b) => (a.fin || '').localeCompare(b.fin || ''))
    }
  })

  const colDef = [
    { k:'retrasadas',  titulo:'Con retraso',   emoji:'🔴', borde:COLORS.red,      bg:'#FEF2F2' },
    { k:'semana',      titulo:'Esta semana',   emoji:'🟡', borde:COLORS.amber,    bg:'#FEF3C7' },
    { k:'mes',         titulo:'Este mes',      emoji:'🔵', borde:COLORS.blue,     bg:'#E0EDFF' },
    { k:'futuro',      titulo:'Más adelante',  emoji:'🟢', borde:COLORS.teal,     bg:COLORS.tealLight },
    { k:'sinFecha',    titulo:'Sin fecha',     emoji:'⚪', borde:COLORS.slate400, bg:COLORS.slate50 },
  ]

  const totalMostrados = colDef.reduce((s, c) => s + cols[c.k].length, 0)
  const totalActividadesReales = actividades.filter(a => {
    const tieneHijos = actividades.some(x => x.parent_id === a.id)
    return !(a.es_servicio_padre && tieneHijos) && a.estado !== 'Cancelada'
  }).length

  const renderCard = (a, c) => {
    const diasFaltan = a.fin ? diffDays(hoy, a.fin) : null
    const esMilestone = a.es_milestone
    const completa = estaCompletada(a)
    return (
      <div key={a.id} onClick={() => onAbrirInfo(a)} style={{
        background:'white', borderRadius:8, padding:12,
        border:`1px solid ${COLORS.slate100}`,
        borderLeft:`3px solid ${completa ? COLORS.teal : c.borde}`,
        marginBottom:8, cursor:'pointer',
        transition:'all 0.15s',
        opacity: completa ? 0.75 : 1,
      }}
        onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 3px 10px rgba(0,0,0,0.08)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
        onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none' }}>
        <div style={{ fontSize:10, fontFamily:'var(--font-mono)', color:COLORS.slate400, fontWeight:700, marginBottom:4, display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
          <span>{numeracion[a.id]}</span>
          {esMilestone && <span title="Hito / Milestone" style={{ color:COLORS.navy, display:'inline-flex' }}><Icon.Diamond/></span>}
          {a.estado === 'Bloqueada' && <Icon.Lock/>}
          {a.importancia && <BadgeImportancia importancia={a.importancia} tamano="mini"/>}
        </div>
        <div style={{ fontSize:12, fontWeight:600, color:COLORS.ink, marginBottom:6, textDecoration: completa ? 'line-through' : 'none' }}>{a.nombre}</div>
        <div style={{ fontSize:10, color:COLORS.slate500, fontFamily:'var(--font-mono)', marginBottom:8 }}>
          {a.fin ? fmtDate(a.fin) : 'Sin fecha'}
          {!completa && diasFaltan !== null && diasFaltan > 0 && diasFaltan <= 60 && <> · <span style={{ color: diasFaltan <= 7 ? COLORS.amber : COLORS.slate500 }}>en {diasFaltan}d</span></>}
          {!completa && diasFaltan !== null && diasFaltan < 0 && <> · <span style={{ color:COLORS.red, fontWeight:700 }}>{Math.abs(diasFaltan)}d tarde</span></>}
        </div>
        {!completa && <BarraAvance avance={a.avance||0} height={4}/>}
        <div style={{ marginTop:6 }}><Badge texto={a.estado} mapa={ESTADOS} tamano={10}/></div>
      </div>
    )
  }

  return (
    <div>
      <Alerta tipo="info">
        <Icon.Info/>
        Kanban por urgencia · Hoy: <strong>{fmtDate(hoy)}</strong> · Mostrando <strong>{totalMostrados}</strong> de <strong>{totalActividadesReales}</strong> actividades
        {cols.completadas.length > 0 && (
          <>
            {' · '}
            <button
              onClick={() => setMostrarCompletadas(v => !v)}
              style={{ background:'transparent', border:'none', color:COLORS.teal, fontWeight:700, cursor:'pointer', textDecoration:'underline', fontSize:12, padding:0 }}
            >
              {mostrarCompletadas ? 'Ocultar' : 'Ver'} {cols.completadas.length} completadas
            </button>
          </>
        )}
      </Alerta>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:12, alignItems:'start' }}>
        {colDef.map(c => (
          <div key={c.k} style={{ background:'#F7F8FB', borderRadius:10, padding:12, minHeight:300 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10, paddingBottom:8, borderBottom:`2px solid ${c.borde}` }}>
              <span style={{ fontSize:12, fontWeight:700, color:COLORS.slate600 }}>{c.emoji} {c.titulo}</span>
              <span style={{ background:'white', color:COLORS.slate600, padding:'2px 10px', borderRadius:12, fontSize:11, fontWeight:600, border:`1px solid ${COLORS.slate200}` }}>{cols[c.k].length}</span>
            </div>
            {cols[c.k].length === 0 ? (
              <div style={{ padding:20, textAlign:'center', color:COLORS.slate400, fontSize:11 }}>Sin actividades</div>
            ) : cols[c.k].map(a => renderCard(a, c))}
          </div>
        ))}
      </div>

      {/* Columna Completadas — expandible */}
      {mostrarCompletadas && cols.completadas.length > 0 && (
        <div style={{ marginTop:16, background:'#F7F8FB', borderRadius:10, padding:12 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10, paddingBottom:8, borderBottom:`2px solid ${COLORS.teal}` }}>
            <span style={{ fontSize:12, fontWeight:700, color:COLORS.slate600 }}>✅ Completadas</span>
            <span style={{ background:'white', color:COLORS.slate600, padding:'2px 10px', borderRadius:12, fontSize:11, fontWeight:600, border:`1px solid ${COLORS.slate200}` }}>{cols.completadas.length}</span>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:8 }}>
            {cols.completadas.map(a => renderCard(a, { borde:COLORS.teal, bg:COLORS.tealLight }))}
          </div>
        </div>
      )}
    </div>
  )
}

function TabPorPersona({ actividades, usuarios, numeracion, onAbrirInfo }) {
  const responsableIds = [...new Set(actividades.map(a => a.responsable_id).filter(Boolean))]
  const equipo = usuarios.filter(u => responsableIds.includes(u.id))
  const [sel, setSel] = useState(equipo[0]?.id || '')

  if (equipo.length === 0) {
    return <div style={{ ...cardStyle, textAlign:'center', color:COLORS.slate400, padding:40 }}>
      Sin responsables asignados todavía. Asigna responsables desde el panel de información de cada actividad.
    </div>
  }

  const user = usuarios.find(u => u.id === sel) || equipo[0]
  const misActs = actividades.filter(a => a.responsable_id === user.id)
  const comp = misActs.filter(a => a.estado === 'Completada').length
  const inProg = misActs.filter(a => a.estado === 'En progreso').length
  const bloq = misActs.filter(a => a.estado === 'Bloqueada').length
  const retr = misActs.filter(a => a.estado === 'Retrasada').length

  return (
    <div>
      <div style={{ ...cardStyle, marginBottom:14, display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
        <span style={{ fontSize:12, fontWeight:600, color:COLORS.slate600 }}>Persona:</span>
        <select value={sel} onChange={e => setSel(e.target.value)} style={{...selectStyle, maxWidth:280}}>
          {equipo.map(u => (
            <option key={u.id} value={u.id}>
              {u.nombre} ({actividades.filter(a => a.responsable_id === u.id).length})
            </option>
          ))}
        </select>
        <div style={{ flex:1 }}/>
        <Avatar nombre={user.nombre} tamano={36}/>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:12, marginBottom:14 }}>
        <div style={cardStyle}>
          <div style={{ fontSize:11, color:COLORS.slate500, marginBottom:4 }}>Total</div>
          <div style={{ fontSize:26, fontWeight:400, color:COLORS.navy, fontFamily:'var(--font-sans)' }}>{misActs.length}</div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize:11, color:COLORS.slate500, marginBottom:4 }}>Completadas</div>
          <div style={{ fontSize:26, fontWeight:400, color:COLORS.teal, fontFamily:'var(--font-sans)' }}>{comp}</div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize:11, color:COLORS.slate500, marginBottom:4 }}>En progreso</div>
          <div style={{ fontSize:26, fontWeight:400, color:COLORS.blue, fontFamily:'var(--font-sans)' }}>{inProg}</div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize:11, color:COLORS.slate500, marginBottom:4 }}>Bloqueadas</div>
          <div style={{ fontSize:26, fontWeight:400, color: bloq>0 ? COLORS.amber : COLORS.slate400, fontFamily:'var(--font-sans)' }}>{bloq}</div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize:11, color:COLORS.slate500, marginBottom:4 }}>Retrasadas</div>
          <div style={{ fontSize:26, fontWeight:400, color: retr>0 ? COLORS.red : COLORS.slate400, fontFamily:'var(--font-sans)' }}>{retr}</div>
        </div>
      </div>
      <div style={{ ...cardStyle, padding:0, overflow:'hidden' }}>
        {misActs.length === 0 ? (
          <div style={{ padding:40, textAlign:'center', color:COLORS.slate400 }}>Sin actividades asignadas a {user.nombre}.</div>
        ) : misActs.map(a => (
          <div key={a.id} onClick={() => onAbrirInfo(a)} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', borderBottom:`1px solid ${COLORS.slate100}`, cursor:'pointer' }}
            onMouseEnter={e => e.currentTarget.style.background = COLORS.slate50}
            onMouseLeave={e => e.currentTarget.style.background = 'white'}>
            {a.estado === 'Bloqueada' && <Icon.Lock/>}
            <span style={{ fontSize:10, fontFamily:'var(--font-mono)', color:COLORS.slate400, fontWeight:700, minWidth:36 }}>{numeracion[a.id]}</span>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:13, fontWeight:500, color:COLORS.ink }}>{a.nombre}</div>
              <div style={{ fontSize:10, color:COLORS.slate500, fontFamily:'var(--font-mono)', marginTop:2 }}>{fmtDate(a.inicio)} → {fmtDate(a.fin)}</div>
            </div>
            <BarraAvance avance={a.avance}/>
            <Badge texto={a.estado} mapa={ESTADOS}/>
          </div>
        ))}
      </div>
    </div>
  )
}

function TabDocumentos({ proyecto }) {
  const carpetas = [
    { n:'Contratos', icon:'📝', color:COLORS.navy },
    { n:'Planos', icon:'📐', color:COLORS.blue },
    { n:'Entregables', icon:'📦', color:COLORS.teal },
    { n:'Fotos', icon:'📷', color:COLORS.gold },
    { n:'Facturas', icon:'🧾', color:COLORS.amber },
    { n:'Permisos', icon:'📑', color:COLORS.purple },
  ]
  return (
    <div>
      <Alerta tipo="info">
        <Icon.Info/> Documentos por carpeta · La carga de archivos se activará cuando conectemos a Supabase Storage.
      </Alerta>
      <div style={{ border:`2px dashed ${COLORS.slate200}`, borderRadius:10, padding:24, textAlign:'center', marginBottom:16, background:COLORS.slate50, cursor:'pointer' }}
        onClick={() => alert('Función de carga próximamente. Se integrará con Supabase Storage para manejar archivos por proyecto.')}>
        <div style={{ fontSize:28, marginBottom:6 }}>📤</div>
        <div style={{ fontSize:13, fontWeight:600, color:COLORS.navy }}>Arrastra archivos aquí o haz clic para subir</div>
        <div style={{ fontSize:11, color:COLORS.slate500, marginTop:4 }}>PDF, Word, Excel, JPG, PNG, ZIP · Máx. 50MB por archivo</div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:12 }}>
        {carpetas.map(c => (
          <div key={c.n} style={{ ...cardStyle, cursor:'pointer', transition:'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = c.color; e.currentTarget.style.transform = 'translateY(-2px)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = COLORS.slate100; e.currentTarget.style.transform = 'none' }}>
            <div style={{ fontSize:28, marginBottom:8 }}>{c.icon}</div>
            <div style={{ fontSize:14, fontWeight:600, color:COLORS.navy, marginBottom:2 }}>{c.n}</div>
            <div style={{ fontSize:11, color:COLORS.slate500 }}>0 archivos</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function TabNotas({ proyectoId, usuarios }) {
  const [notas, setNotas] = useState([])
  const [nuevo, setNuevo] = useState('')
  const [loading, setLoading] = useState(true)
  const [enviando, setEnviando] = useState(false)

  const cargar = useCallback(async () => {
    try {
      const data = await getNotasProyecto(proyectoId)
      setNotas(data || [])
    } catch (e) { console.error('Error cargando notas:', e) }
    setLoading(false)
  }, [proyectoId])

  useEffect(() => { cargar() }, [cargar])

  const enviar = async () => {
    if (!nuevo.trim()) return
    setEnviando(true)
    try {
      const menciones = extraerMenciones(nuevo, usuarios)
      await crearNotaProyecto({ proyectoId, contenido: nuevo.trim(), menciones })
      setNuevo('')
      cargar()
    } catch (e) { alert('Error: ' + e.message) }
    setEnviando(false)
  }

  const eliminar = async (id) => {
    if (!confirm('¿Eliminar esta nota?')) return
    try { await eliminarNota(id); cargar() }
    catch (e) { alert('Error: ' + e.message) }
  }

  const formatoContenido = (texto) => {
    return texto.replace(/@([A-ZÁ-ÚÑ][a-zá-úñ]+(?:\s+[A-ZÁ-ÚÑ][a-zá-úñ]+)?)/g,
      `<span style="color:${COLORS.navy};font-weight:600;background:${COLORS.tealLight};padding:1px 5px;border-radius:4px">@$1</span>`)
  }

  return (
    <div>
      <div style={{ ...cardStyle, marginBottom:14, padding:14 }}>
        <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
          <Avatar nombre="Yo" color={COLORS.navy} tamano={36}/>
          <div style={{ flex:1 }}>
            <textarea
              value={nuevo}
              onChange={e => setNuevo(e.target.value)}
              placeholder="Escribe una nota... Usa @Nombre Apellido para mencionar a alguien"
              style={{ ...inputStyle, minHeight:70, resize:'vertical' }}
            />
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:8, flexWrap:'wrap', gap:8 }}>
              <div style={{ fontSize:10, color:COLORS.slate400 }}>
                {usuarios.length > 0 ? `Menciones: ${usuarios.slice(0, 4).map(u => `@${u.nombre.split(' ')[0]}`).join(' · ')}${usuarios.length > 4 ? '...' : ''}` : ''}
              </div>
              <button onClick={enviar} disabled={!nuevo.trim() || enviando} style={{...btnPrimary, opacity: !nuevo.trim() ? 0.5 : 1, display:'flex', alignItems:'center', gap:6}}>
                <Icon.Send/> {enviando ? 'Enviando...' : 'Publicar'}
              </button>
            </div>
          </div>
        </div>
      </div>
      {loading ? (
        <div style={{ padding:40, textAlign:'center', color:COLORS.slate400 }}>Cargando notas...</div>
      ) : notas.length === 0 ? (
        <div style={{ ...cardStyle, textAlign:'center', color:COLORS.slate400, padding:40 }}>
          Aún no hay notas en este proyecto. Sé el primero en comentar.
        </div>
      ) : notas.slice().reverse().map(n => {
        const autor = n.autor || usuarios.find(u => u.id === n.autor_id)
        return (
          <div key={n.id} style={{ display:'flex', gap:12, marginBottom:16 }}>
            <Avatar nombre={autor?.nombre || '?'} tamano={36}/>
            <div style={{ flex:1 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:5 }}>
                <span style={{ fontSize:13, fontWeight:600, color:COLORS.ink }}>{autor?.nombre || 'Usuario'}</span>
                <span style={{ fontSize:10, color:COLORS.slate400, fontFamily:'var(--font-mono)' }}>
                  {new Date(n.created_at).toLocaleString('es-MX', { dateStyle:'medium', timeStyle:'short' })}
                </span>
                <button onClick={() => eliminar(n.id)} style={{ marginLeft:'auto', border:'none', background:'transparent', color:COLORS.slate400, cursor:'pointer', padding:4 }} title="Eliminar"><Icon.Trash/></button>
              </div>
              <div style={{ background:COLORS.slate50, borderRadius:10, padding:12, fontSize:13, lineHeight:1.6, color:COLORS.slate600 }}
                dangerouslySetInnerHTML={{ __html: formatoContenido(n.contenido) }}/>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function TabFinanciero({ proyecto, hitos, puedeVerFinanciero }) {
  if (!puedeVerFinanciero) {
    return (
      <div style={{ ...cardStyle, padding:40, textAlign:'center', color:COLORS.slate500 }}>
        <div style={{ marginBottom:10 }}><Icon.Lock/></div>
        <div style={{ fontSize:14, fontWeight:600, marginBottom:6 }}>Acceso restringido</div>
        <div style={{ fontSize:12 }}>La información financiera de este proyecto está restringida para tu rol.</div>
      </div>
    )
  }

  const cobrado = hitos.filter(h => h.estado === 'Pagado').reduce((s,h) => s + (h.monto || 0), 0)
  const pendiente = hitos.filter(h => h.estado !== 'Pagado' && h.estado !== 'Cancelado').reduce((s,h) => s + (h.monto || 0), 0)
  const total = (proyecto.monto_total || proyecto.monto || 0) || (cobrado + pendiente)

  return (
    <div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(180px, 1fr))', gap:14, marginBottom:18 }}>
        <div style={cardStyle}>
          <div style={{ fontSize:11, color:COLORS.slate500, marginBottom:6 }}>Monto total</div>
          <div style={{ fontSize:22, fontWeight:500, color:COLORS.navy, fontFamily:'var(--font-sans)' }}>{fmtMoney(total)}</div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize:11, color:COLORS.slate500, marginBottom:6 }}>Cobrado</div>
          <div style={{ fontSize:22, fontWeight:500, color:COLORS.teal, fontFamily:'var(--font-sans)' }}>{fmtMoney(cobrado)}</div>
          <div style={{ fontSize:11, color:COLORS.slate400, marginTop:4 }}>{total > 0 ? Math.round(cobrado/total*100) : 0}%</div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize:11, color:COLORS.slate500, marginBottom:6 }}>Por cobrar</div>
          <div style={{ fontSize:22, fontWeight:500, color:COLORS.amber, fontFamily:'var(--font-sans)' }}>{fmtMoney(pendiente)}</div>
        </div>
        <div style={cardStyle}>
          <div style={{ fontSize:11, color:COLORS.slate500, marginBottom:6 }}>Hitos</div>
          <div style={{ fontSize:22, fontWeight:500, color:COLORS.navy, fontFamily:'var(--font-sans)' }}>{hitos.length}</div>
          <div style={{ fontSize:11, color:COLORS.slate400, marginTop:4 }}>{hitos.filter(h => h.estado === 'Pagado').length} cobrados</div>
        </div>
      </div>
      <div style={{ ...cardStyle, padding:0, overflow:'hidden' }}>
        <div style={{ padding:'14px 18px', borderBottom:`1px solid ${COLORS.slate100}`, background:COLORS.slate50 }}>
          <div style={labelStyle}>Hitos de cobro</div>
        </div>
        {hitos.length === 0 ? (
          <div style={{ padding:40, textAlign:'center', color:COLORS.slate400, fontSize:12 }}>Sin hitos de cobro registrados para este proyecto.</div>
        ) : hitos.map(h => {
          const cfg = ESTADOS_HITO[h.estado] || ESTADOS_HITO['Pendiente']
          return (
            <div key={h.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 18px', borderBottom:`1px solid ${COLORS.slate100}` }}>
              <div style={{ width:10, height:10, borderRadius:'50%', background:cfg.sem, flexShrink:0 }}/>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:500, color:COLORS.ink }}>{h.descripcion || h.concepto || 'Hito'}</div>
                <div style={{ fontSize:10, color:COLORS.slate500, fontFamily:'var(--font-mono)', marginTop:2 }}>
                  Venc: {fmtDate(h.fecha_vencimiento)} {h.fecha_pago && `· Pago: ${fmtDate(h.fecha_pago)}`}
                </div>
              </div>
              <div style={{ fontSize:14, fontWeight:700, color:COLORS.navy, fontFamily:'var(--font-mono)' }}>{fmtMoney(h.monto)}</div>
              <Badge texto={h.estado} mapa={ESTADOS_HITO}/>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// v13.2: Modal propio para confirmar eliminación de dependencia
// Reemplaza el feo window.confirm() del navegador
function ConfirmDepDeleteModal({ data, onCancel, onConfirm }) {
  const { predNombre, actNombre } = data
  const isMobile = useIsMobile()

  // Cerrar con Escape
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onCancel() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onCancel])

  return (
    <>
      <div onClick={onCancel} style={{
        position:'fixed', inset:0,
        background:'rgba(10, 37, 64, 0.35)',
        backdropFilter:'blur(2px)',
        zIndex: 2000,
        display:'flex', alignItems:'center', justifyContent:'center',
      }}>
        <div onClick={(e) => e.stopPropagation()} style={{
          width: isMobile ? 'calc(100% - 32px)' : 460,
          background:'white',
          borderRadius: 14,
          boxShadow:'0 20px 60px rgba(10, 37, 64, 0.25)',
          overflow:'hidden',
        }}>
          {/* Header con icono */}
          <div style={{ padding:'22px 24px 14px', display:'flex', alignItems:'flex-start', gap:14 }}>
            <div style={{
              width:40, height:40, borderRadius:'50%',
              background:'#FEF2F2',
              display:'flex', alignItems:'center', justifyContent:'center',
              flexShrink:0,
              color: COLORS.red,
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                <line x1="4" y1="4" x2="20" y2="20"/>
              </svg>
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <h3 style={{
                margin:0, fontSize:16, fontWeight:600,
                color:COLORS.navy, fontFamily:'var(--font-sans)',
                letterSpacing:'-0.01em',
              }}>
                Quitar dependencia
              </h3>
              <p style={{
                margin:'6px 0 0', fontSize:13, color:COLORS.slate500,
                lineHeight:1.5,
              }}>
                La actividad <strong style={{ color:COLORS.ink }}>{actNombre}</strong> ya no dependerá de <strong style={{ color:COLORS.ink }}>{predNombre}</strong>. Esta acción no afectará las fechas.
              </p>
            </div>
          </div>

          {/* Footer con botones */}
          <div style={{
            padding:'14px 24px 18px',
            display:'flex', justifyContent:'flex-end', gap:10,
            background: COLORS.slate50,
            borderTop: `1px solid ${COLORS.slate100}`,
          }}>
            <button
              onClick={onCancel}
              style={{
                padding:'9px 18px',
                background:'white',
                color:COLORS.slate600,
                border:`1px solid ${COLORS.slate200}`,
                borderRadius:8,
                fontSize:13, fontWeight:600,
                cursor:'pointer',
                fontFamily:'inherit',
                transition:'all 0.12s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = COLORS.slate100 }}
              onMouseLeave={e => { e.currentTarget.style.background = 'white' }}
            >
              Cancelar
            </button>
            <button
              onClick={onConfirm}
              autoFocus
              style={{
                padding:'9px 18px',
                background: COLORS.red,
                color:'white',
                border:'none',
                borderRadius:8,
                fontSize:13, fontWeight:600,
                cursor:'pointer',
                fontFamily:'inherit',
                boxShadow:'0 2px 6px rgba(220,38,38,0.35)',
                transition:'all 0.12s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#B91C1C' }}
              onMouseLeave={e => { e.currentTarget.style.background = COLORS.red }}
            >
              Quitar dependencia
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// v13: Formulario inline para crear cliente rápido desde el modal de nuevo proyecto
function FormClienteInline({ onCancel, onCreated }) {
  const [form, setForm] = useState({ razon_social:'', rfc:'', contacto_nombre:'', email:'', telefono:'' })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)

  const crear = async () => {
    if (!form.razon_social.trim()) {
      setError('La razón social es obligatoria')
      return
    }
    setGuardando(true)
    setError(null)
    try {
      // Generar código auto: CLI-XXX
      const { count } = await supabase.from('clientes').select('*', { count:'exact', head:true })
      const codigo = `CLI-${String((count || 0) + 1).padStart(3, '0')}`

      const { data, error: insertError } = await supabase
        .from('clientes')
        .insert({
          codigo,
          razon_social: form.razon_social.trim(),
          rfc: form.rfc.trim() || null,
          contacto_nombre: form.contacto_nombre.trim() || null,
          email: form.email.trim() || null,
          telefono: form.telefono.trim() || null,
        })
        .select()
        .single()
      if (insertError) throw insertError
      onCreated(data)
    } catch (e) {
      setError(e.message)
      setGuardando(false)
    }
  }

  return (
    <div style={{ marginTop:8, padding:14, background:'#F0FDF4', border:`1px solid #86EFAC`, borderRadius:10 }}>
      <div style={{ fontSize:11, fontWeight:700, color:COLORS.teal, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10 }}>Crear cliente nuevo</div>
      <div style={{ display:'grid', gap:8 }}>
        <div>
          <label style={miniLabel}>Razón social *</label>
          <input
            value={form.razon_social}
            onChange={e => setForm({ ...form, razon_social: e.target.value })}
            placeholder="Intel Tecnología de México S.A. de C.V."
            autoFocus
            style={inputStyle}
          />
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
          <div>
            <label style={miniLabel}>RFC</label>
            <input
              value={form.rfc}
              onChange={e => setForm({ ...form, rfc: e.target.value.toUpperCase() })}
              placeholder="XAXX010101000"
              maxLength={13}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={miniLabel}>Teléfono</label>
            <input
              value={form.telefono}
              onChange={e => setForm({ ...form, telefono: e.target.value })}
              placeholder="55 1234 5678"
              style={inputStyle}
            />
          </div>
        </div>
        <div>
          <label style={miniLabel}>Contacto principal</label>
          <input
            value={form.contacto_nombre}
            onChange={e => setForm({ ...form, contacto_nombre: e.target.value })}
            placeholder="Nombre del contacto"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={miniLabel}>Email</label>
          <input
            type="email"
            value={form.email}
            onChange={e => setForm({ ...form, email: e.target.value })}
            placeholder="contacto@empresa.com"
            style={inputStyle}
          />
        </div>
        {error && (
          <div style={{ padding:'8px 12px', background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:7, fontSize:12, color:COLORS.red }}>
            {error}
          </div>
        )}
        <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:4 }}>
          <button
            type="button"
            onClick={onCancel}
            style={{ padding:'8px 14px', background:'white', color:COLORS.slate600, border:`1px solid ${COLORS.slate200}`, borderRadius:7, fontSize:12, fontWeight:600, cursor:'pointer' }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={crear}
            disabled={guardando || !form.razon_social.trim()}
            style={{ padding:'8px 16px', background: guardando || !form.razon_social.trim() ? COLORS.slate400 : COLORS.teal, color:'white', border:'none', borderRadius:7, fontSize:12, fontWeight:600, cursor: guardando ? 'wait' : 'pointer' }}
          >
            {guardando ? 'Creando...' : 'Crear cliente'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ModalNuevoProyecto({ onClose, onCreado }) {
  const [plantillas, setPlantillas] = useState([])
  const [clientes, setClientes] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [plantillaSel, setPlantillaSel] = useState(null)
  const [mostrarFormCliente, setMostrarFormCliente] = useState(false) // v13
  const [form, setForm] = useState({
    nombre:'', clienteId:'', directorId:'',
    capacidadMw:'', ubicacion:'',
    inicioFecha: new Date().toISOString().split('T')[0],
    // v12: campos nuevos
    clasificacion: 'B', prioridad: 'Media', tipo_proyecto: 'Otros',
  })
  const [creando, setCreando] = useState(false)
  const isMobile = useIsMobile()

  useEffect(() => {
    Promise.all([getPlantillas(), getClientes(), getUsuarios()]).then(([p, c, u]) => {
      setPlantillas(p); setClientes(c); setUsuarios(u)
      const director = u.find(x => x.rol === 'director_proyectos')
      if (director) setForm(f => ({ ...f, directorId: director.id }))
    })
  }, [])

  const crear = async () => {
    if (!plantillaSel || !form.nombre || !form.clienteId || !form.directorId) { alert('Completa los campos requeridos'); return }
    setCreando(true)
    try {
      const proyecto = await crearProyectoDesdePlantilla({
        plantillaId: plantillaSel.id, nombre: form.nombre, clienteId: form.clienteId, directorId: form.directorId,
        inicioFecha: form.inicioFecha, capacidadMw: form.capacidadMw ? parseFloat(form.capacidadMw) : null, ubicacion: form.ubicacion || null,
      })
      // v12: Actualizar los campos nuevos (clasificación/prioridad/tipo)
      try {
        await supabase.from('proyectos').update({
          clasificacion: form.clasificacion,
          prioridad: form.prioridad,
          tipo_proyecto: form.tipo_proyecto,
        }).eq('id', proyecto.id)
      } catch (e) { console.warn('No se pudo guardar clasificación:', e.message) }
      onCreado(proyecto)
    } catch (e) { alert('Error: ' + e.message); setCreando(false) }
  }

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(10,37,64,0.35)', zIndex:999 }}/>
      <div style={{ position:'fixed', top: isMobile ? 0 : '5%', left:'50%', transform:'translateX(-50%)', width: isMobile ? '100%' : 'min(880px, 95vw)', maxHeight: isMobile ? '100vh' : '90vh', background:'white', borderRadius: isMobile ? 0 : 16, zIndex:1000, display:'flex', flexDirection:'column' }}>
        <div style={{ padding:'18px 24px', borderBottom:`1px solid ${COLORS.slate100}`, display:'flex', justifyContent:'space-between' }}>
          <h2 style={{ fontSize:18, fontWeight:500, color:COLORS.navy, fontFamily:'var(--font-sans)', margin:0 }}>Nuevo proyecto</h2>
          <button onClick={onClose} style={{ width:32, height:32, border:'none', background:COLORS.slate50, borderRadius:8, cursor:'pointer' }}><Icon.X/></button>
        </div>
        <div style={{ flex:1, overflow:'auto', padding:20, display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap:20 }}>
          <div>
            <div style={labelStyle}>1. Plantilla ({plantillas.length})</div>
            <div style={{ display:'grid', gap:6, maxHeight: isMobile ? 200 : 500, overflow:'auto' }}>
              {plantillas.map(p => (
                <div key={p.id} onClick={() => setPlantillaSel(p)} style={{ padding:12, background: plantillaSel?.id === p.id ? COLORS.tealLight : 'white', border:`1.5px solid ${plantillaSel?.id === p.id ? COLORS.teal : COLORS.slate100}`, borderRadius:10, cursor:'pointer' }}>
                  <div style={{ fontSize:9, fontFamily:'var(--font-mono)', color:COLORS.slate400, fontWeight:600 }}>{p.codigo}</div>
                  <div style={{ fontSize:12, fontWeight:600, color:COLORS.ink }}>{p.nombre}</div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div style={labelStyle}>2. Datos</div>
            <div style={{ marginBottom:10 }}><label style={miniLabel}>Nombre *</label><input value={form.nombre} onChange={e=>setForm({...form, nombre:e.target.value})} style={inputStyle}/></div>
            <div style={{ marginBottom:10 }}>
              <label style={miniLabel}>Cliente *</label>
              <div style={{ display:'flex', gap:6 }}>
                <select value={form.clienteId} onChange={e=>setForm({...form, clienteId:e.target.value})} style={{...selectStyle, flex:1}}>
                  <option value="">Selecciona...</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.razon_social}</option>)}
                </select>
                <button
                  type="button"
                  onClick={() => setMostrarFormCliente(true)}
                  title="Crear cliente nuevo"
                  style={{ padding:'0 12px', background:COLORS.teal, color:'white', border:'none', borderRadius:8, fontSize:14, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}
                >
                  + Nuevo
                </button>
              </div>
              {mostrarFormCliente && (
                <FormClienteInline
                  onCancel={() => setMostrarFormCliente(false)}
                  onCreated={async (nuevoCliente) => {
                    setClientes(prev => [...prev, nuevoCliente])
                    setForm(f => ({ ...f, clienteId: nuevoCliente.id }))
                    setMostrarFormCliente(false)
                  }}
                />
              )}
            </div>
            <div style={{ marginBottom:10 }}><label style={miniLabel}>Director *</label><select value={form.directorId} onChange={e=>setForm({...form, directorId:e.target.value})} style={selectStyle}><option value="">Selecciona...</option>{usuarios.filter(u => ['direccion','director_proyectos'].includes(u.rol)).map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}</select></div>
            {/* v12: Clasificación/Prioridad/Tipo */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:10 }}>
              <div>
                <label style={miniLabel}>Clase</label>
                <select value={form.clasificacion} onChange={e=>setForm({...form, clasificacion:e.target.value})} style={selectStyle}>
                  <option value="A">A — Alta</option>
                  <option value="B">B — Media</option>
                  <option value="C">C — Baja</option>
                </select>
              </div>
              <div>
                <label style={miniLabel}>Prioridad</label>
                <select value={form.prioridad} onChange={e=>setForm({...form, prioridad:e.target.value})} style={selectStyle}>
                  <option value="Alta">Alta</option>
                  <option value="Media">Media</option>
                  <option value="Baja">Baja</option>
                </select>
              </div>
              <div>
                <label style={miniLabel}>Tipo</label>
                <select value={form.tipo_proyecto} onChange={e=>setForm({...form, tipo_proyecto:e.target.value})} style={selectStyle}>
                  {TIPOS_PROYECTO.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
              <div><label style={miniLabel}>MW</label><input type="number" step="0.1" value={form.capacidadMw} onChange={e=>setForm({...form, capacidadMw:e.target.value})} style={inputStyle}/></div>
              <div><label style={miniLabel}>Inicio</label><input type="date" value={form.inicioFecha} onChange={e=>setForm({...form, inicioFecha:e.target.value})} style={inputStyle}/></div>
            </div>
            <div><label style={miniLabel}>Ubicación</label><input value={form.ubicacion} onChange={e=>setForm({...form, ubicacion:e.target.value})} style={inputStyle}/></div>
          </div>
        </div>
        <div style={{ padding:'14px 24px', borderTop:`1px solid ${COLORS.slate100}`, display:'flex', justifyContent:'flex-end', gap:10 }}>
          <button onClick={onClose} style={btnSecondary}>Cancelar</button>
          <button onClick={crear} disabled={!plantillaSel || !form.nombre || !form.clienteId || creando} style={{...btnPrimary, opacity: (!plantillaSel || !form.nombre || !form.clienteId) ? 0.5 : 1 }}>{creando ? 'Creando...' : 'Crear proyecto'}</button>
        </div>
      </div>
    </>
  )
}

function ModalDesglose({ actividad, onClose, onDesglosado }) {
  const [plantillas, setPlantillas] = useState([])
  const [plantillaSel, setPlantillaSel] = useState(null)
  const [plantillaActs, setPlantillaActs] = useState([])
  const [desglosando, setDesglosando] = useState(false)
  const isMobile = useIsMobile()

  useEffect(() => { getPlantillas().then(setPlantillas) }, [])
  useEffect(() => { if (plantillaSel) getPlantillaActividades(plantillaSel.id).then(setPlantillaActs); else setPlantillaActs([]) }, [plantillaSel])

  const desglosar = async () => {
    if (!plantillaSel) return
    if (!confirm(`Se generarán ${plantillaActs.length} actividades. ¿Continuar?`)) return
    setDesglosando(true)
    try {
      const n = await desglosarActividadConPlantilla(actividad.id, plantillaSel.id)
      alert(`✓ Se generaron ${n} actividades`)
      onDesglosado()
    } catch (e) { alert('Error: ' + e.message); setDesglosando(false) }
  }

  return (
    <>
      <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(10,37,64,0.35)', zIndex:999 }}/>
      <div style={{ position:'fixed', top: isMobile ? 0 : '5%', left:'50%', transform:'translateX(-50%)', width: isMobile ? '100%' : 'min(880px, 95vw)', maxHeight: isMobile ? '100vh' : '90vh', background:'white', borderRadius: isMobile ? 0 : 16, zIndex:1000, display:'flex', flexDirection:'column' }}>
        <div style={{ padding:'18px 24px', borderBottom:`1px solid ${COLORS.slate100}`, display:'flex', justifyContent:'space-between' }}>
          <div>
            <h2 style={{ fontSize:18, fontWeight:500, color:COLORS.navy, fontFamily:'var(--font-sans)', margin:0 }}>Desglosar con plantilla</h2>
            <p style={{ fontSize:11, color:COLORS.slate500, margin:'3px 0 0' }}>Para: <strong>{actividad.nombre}</strong></p>
          </div>
          <button onClick={onClose} style={{ border:'none', background:'transparent', cursor:'pointer' }}><Icon.X/></button>
        </div>
        <div style={{ flex:1, overflow:'auto', padding:20, display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap:16 }}>
          <div>
            <div style={labelStyle}>Plantilla</div>
            <div style={{ display:'grid', gap:6, maxHeight:500, overflow:'auto' }}>
              {plantillas.map(p => (
                <div key={p.id} onClick={() => setPlantillaSel(p)} style={{ padding:10, background: plantillaSel?.id === p.id ? COLORS.tealLight : 'white', border:`1.5px solid ${plantillaSel?.id === p.id ? COLORS.teal : COLORS.slate100}`, borderRadius:8, cursor:'pointer' }}>
                  <div style={{ fontSize:9, fontFamily:'var(--font-mono)', color:COLORS.slate400 }}>{p.codigo}</div>
                  <div style={{ fontSize:12, fontWeight:600 }}>{p.nombre}</div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div style={labelStyle}>{plantillaSel ? `Previsualización (${plantillaActs.length})` : 'Selecciona plantilla'}</div>
            {plantillaActs.length > 0 && (
              <div style={{ padding:12, background:COLORS.slate50, borderRadius:10, maxHeight:500, overflow:'auto' }}>
                {plantillaActs.map(a => (
                  <div key={a.orden} style={{ padding:'6px 0', fontSize:11, borderBottom:`1px solid ${COLORS.slate100}` }}>
                    <span style={{ fontFamily:'var(--font-mono)', color:COLORS.slate400, marginRight:6 }}>#{a.orden}</span>
                    {a.es_milestone && <span style={{ color:COLORS.navy, marginRight:4 }}><Icon.Diamond/></span>}
                    <span>{a.nombre}</span>
                    <span style={{ float:'right', fontFamily:'var(--font-mono)', color:COLORS.slate500 }}>{a.duracion_dias}d</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div style={{ padding:'14px 24px', borderTop:`1px solid ${COLORS.slate100}`, display:'flex', justifyContent:'flex-end', gap:10 }}>
          <button onClick={onClose} style={btnSecondary}>Cancelar</button>
          <button onClick={desglosar} disabled={!plantillaSel || desglosando} style={{...btnPrimary, opacity: !plantillaSel ? 0.5 : 1}}>{desglosando ? 'Generando...' : 'Desglosar'}</button>
        </div>
      </div>
    </>
  )
}

function DetalleProyecto({ proyectoId, onVolver, usuarioActual, actividadInicialId }) {
  const [proyecto, setProyecto] = useState(null)
  const [hitos, setHitos] = useState([])
  const [tab, setTab] = useState('resumen')
  const [loading, setLoading] = useState(true)
  const [desglosarAct, setDesglosarAct] = useState(null)
  const [panelAct, setPanelAct] = useState(null)
  const [panelProy, setPanelProy] = useState(false)
  const [clientes, setClientes] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [menuCtx, setMenuCtx] = useState(null)  // v8: {actividad, x, y}
  const [confirmDepDelete, setConfirmDepDelete] = useState(null)  // v13.2: {predId, actId, predNombre, actNombre}
  const deepLinkActRef = useRef(false)
  const isMobile = useIsMobile()

  const puedeVerFinanciero = usuarioActual?.rol
    ? ['direccion', 'admin', 'cobranza', 'ventas'].includes(usuarioActual.rol)
    : true

  const esDirOAdmin = usuarioActual?.rol
    ? ['direccion', 'admin', 'director_proyectos'].includes(usuarioActual.rol)
    : true

  const cargar = useCallback(async () => {
    try {
      const p = await getProyectoConActividades(proyectoId)
      setProyecto(p)
      try {
        const h = await getHitosProyecto(proyectoId)
        setHitos(h)
      } catch (err) { console.warn('No se pudieron cargar hitos:', err) }
    } catch (e) { alert('Error cargando proyecto: ' + e.message) }
    setLoading(false)
  }, [proyectoId])

  useEffect(() => {
    cargar()
    Promise.all([getClientes(), getUsuarios()]).then(([c, u]) => { setClientes(c); setUsuarios(u) })
  }, [cargar])

  // Deep-link desde Centro de Alertas: abrir panel de actividad cuando proyecto cargue
  useEffect(() => {
    if (deepLinkActRef.current) return
    if (!proyecto || !actividadInicialId) return
    const act = (proyecto.actividades || []).find(a => a.id === actividadInicialId)
    if (act) setPanelAct(act)
    deepLinkActRef.current = true
  }, [proyecto, actividadInicialId])

  const numeracion = useMemo(() => generarNumeracion(proyecto?.actividades || []), [proyecto])

  const actualizarInline = useCallback(async (actId, cambios) => {
    setProyecto(prev => ({ ...prev, actividades: prev.actividades.map(a => a.id === actId ? { ...a, ...cambios } : a) }))
    try { await actualizarActividad(actId, cambios) }
    catch (e) { alert('Error: ' + e.message); cargar() }
  }, [cargar])

  const crearNuevaActividad = useCallback(async ({ nombre, parentId = null }) => {
    const acts = proyecto?.actividades || []
    const siblings = acts.filter(a => (a.parent_id || null) === parentId)
    const maxNum = siblings.reduce((m, a) => Math.max(m, a.numero || 0), 0)
    const lastFin = siblings.length > 0 ? siblings.reduce((m, a) => a.fin > m ? a.fin : m, siblings[0].fin) : (proyecto.inicio || new Date().toISOString().split('T')[0])
    const inicio = addDays(lastFin, 1)
    const fin = addDays(inicio, 4)
    await crearActividad({
      proyecto_id: proyectoId, parent_id: parentId, nombre,
      numero: maxNum + 1, inicio, fin, avance: 0,
      estado: 'Sin iniciar', es_milestone: false, es_servicio_padre: false,
    })
    await cargar()
  }, [proyecto, proyectoId, cargar])

  const toggleActividad = async (a) => {
    const nueva = { completada: !a.completada, avance: !a.completada ? 100 : 0, estado: !a.completada ? 'Completada' : 'Sin iniciar' }
    setProyecto(prev => ({ ...prev, actividades: prev.actividades.map(x => x.id === a.id ? { ...x, ...nueva } : x) }))
    try { await actualizarActividad(a.id, nueva) } catch (e) { alert('Error: ' + e.message); cargar() }
  }

  // v8: Handlers menú contextual
  const abrirMenuCtx = useCallback((actividad, x, y) => {
    setMenuCtx({ actividad, x, y })
  }, [])

  const handleDuplicar = useCallback(async (actividad) => {
    try {
      await duplicarActividad(actividad.id)
      await cargar()
    } catch (e) { alert('Error al duplicar: ' + e.message) }
  }, [cargar])

  const handleEliminar = useCallback(async (actividad) => {
    const tieneHijos = proyecto?.actividades?.some(a => a.parent_id === actividad.id)
    const msg = tieneHijos
      ? `¿Eliminar "${actividad.nombre}" y TODAS sus sub-actividades? Esta acción no se puede deshacer.`
      : `¿Eliminar "${actividad.nombre}"? Esta acción no se puede deshacer.`
    if (!confirm(msg)) return
    try {
      await eliminarActividad(actividad.id)
      await cargar()
    } catch (e) { alert('Error al eliminar: ' + e.message) }
  }, [proyecto, cargar])

  // v11: Handler para borrar dependencia desde click en flecha del Gantt
  // v13.2: Abre modal propio en vez de window.confirm()
  const handleQuitarDepGantt = useCallback((predId, actId) => {
    const pred = proyecto?.actividades?.find(a => a.id === predId)
    const act  = proyecto?.actividades?.find(a => a.id === actId)
    setConfirmDepDelete({
      predId, actId,
      predNombre: pred?.nombre || 'Actividad',
      actNombre: act?.nombre || 'Actividad',
    })
  }, [proyecto])

  const confirmarBorrarDep = useCallback(async () => {
    if (!confirmDepDelete) return
    const { predId, actId } = confirmDepDelete
    setConfirmDepDelete(null)
    try {
      await quitarDependencia(actId, predId)
      await cargar()
    } catch (e) { alert('Error al quitar dependencia: ' + e.message) }
  }, [confirmDepDelete, cargar])

  const handleToggleMilestone = useCallback(async (actividad) => {
    const nuevo = !actividad.es_milestone
    setProyecto(prev => ({ ...prev, actividades: prev.actividades.map(a => a.id === actividad.id ? { ...a, es_milestone: nuevo } : a) }))
    try { await actualizarActividad(actividad.id, { es_milestone: nuevo }) }
    catch (e) { alert('Error: ' + e.message); cargar() }
  }, [cargar])

  const handleCambiarImportancia = useCallback(async (actividad, importancia) => {
    setProyecto(prev => ({ ...prev, actividades: prev.actividades.map(a => a.id === actividad.id ? { ...a, importancia } : a) }))
    try { await cambiarImportancia(actividad.id, importancia) }
    catch (e) { alert('Error: ' + e.message); cargar() }
  }, [cargar])

  const handleAgregarHijo = useCallback(async (actividad) => {
    const nombre = prompt(`Nombre de la nueva sub-actividad de "${actividad.nombre}":`)
    if (!nombre?.trim()) return
    try { await crearNuevaActividad({ nombre: nombre.trim(), parentId: actividad.id }) }
    catch (e) { alert('Error: ' + e.message) }
  }, [crearNuevaActividad])

  if (loading) return <div style={{ padding:40, textAlign:'center', color:COLORS.slate400 }}>Cargando proyecto...</div>
  if (!proyecto) return <div style={{ padding:40, textAlign:'center', color:COLORS.red }}>Proyecto no encontrado</div>

  const actividades = proyecto.actividades || []
  const bloqueadas = actividades.filter(a => a.estado === 'Bloqueada').length
  const retrasadas = actividades.filter(a => a.estado === 'Retrasada').length

  const tabs = [
    { k:'resumen', l:'Resumen' },
    { k:'actividades', l:'Actividades' },
    { k:'gantt', l:'Gantt', icon:<Icon.Calendar/> },
    { k:'kanban', l:'Kanban', icon:<Icon.Kanban/> },
    { k:'personas', l:'Por Persona', icon:<Icon.Users/> },
    { k:'sim', l:'SIM', icon:<Icon.Check/> },  // v15.7: workflow Declaración Operación Comercial
    { k:'documentos', l:'Documentos', icon:<Icon.Folder/> },
    { k:'notas', l:'Notas' },
  ]
  if (puedeVerFinanciero) tabs.push({ k:'financiero', l:'Financiero', icon:<Icon.Dollar/> })

  return (
    <div>
      {desglosarAct && <ModalDesglose actividad={desglosarAct} onClose={() => setDesglosarAct(null)} onDesglosado={() => { setDesglosarAct(null); cargar() }}/>}
      {panelAct && <PanelActividad actividad={panelAct} actividades={actividades} numeracion={numeracion} usuarios={usuarios} onClose={() => setPanelAct(null)} onCambio={cargar} onEliminar={handleEliminar}/>}
      {panelProy && <PanelProyecto proyecto={proyecto} clientes={clientes} usuarios={usuarios} onClose={() => setPanelProy(false)} onCambio={cargar}/>}
      {menuCtx && (
        <MenuContextual
          x={menuCtx.x}
          y={menuCtx.y}
          actividad={menuCtx.actividad}
          proyectoId={proyectoId}
          onClose={() => setMenuCtx(null)}
          onAbrirInfo={setPanelAct}
          onDuplicar={handleDuplicar}
          onEliminar={handleEliminar}
          onToggleMilestone={handleToggleMilestone}
          onCambiarImportancia={(imp) => handleCambiarImportancia(menuCtx.actividad, imp)}
          onAgregarHijo={handleAgregarHijo}
        />
      )}

      {/* v13.2: Modal propio para confirmar eliminación de dependencia */}
      {confirmDepDelete && (
        <ConfirmDepDeleteModal
          data={confirmDepDelete}
          onCancel={() => setConfirmDepDelete(null)}
          onConfirm={confirmarBorrarDep}
        />
      )}

      <div style={{ display:'flex', alignItems:'flex-start', gap:12, marginBottom:16, flexWrap:'wrap' }}>
        <button onClick={onVolver} style={{ padding:'8px 12px', background:'white', border:`1px solid ${COLORS.slate200}`, borderRadius:8, fontSize:12, cursor:'pointer', color:COLORS.slate600, display:'flex', alignItems:'center', gap:6, fontWeight:500, minHeight:40 }}><Icon.Back/> Proyectos</button>
        <div style={{ flex:1, minWidth:200 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4, flexWrap:'wrap' }}>
            <span style={{ fontSize:11, fontFamily:'var(--font-mono)', color:COLORS.slate400 }}>{proyecto.codigo}</span>
            <Badge texto={proyecto.estado} mapa={ESTADOS_PROY}/>
            {bloqueadas > 0 && <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11, fontWeight:500, padding:'3px 10px', borderRadius:20, background:'#FEF3C7', color:'#D97706' }}><Icon.Lock/> {bloqueadas} bloqueadas</span>}
          </div>
          <h1 style={{ fontSize: isMobile ? 20 : 26, fontWeight:500, color:COLORS.navy, margin:0, fontFamily:'var(--font-sans)' }}>
            <EditableText value={proyecto.nombre} onSave={async v => {
              setProyecto(prev => ({ ...prev, nombre: v }))
              try { await supabase.from('proyectos').update({ nombre: v }).eq('id', proyectoId) }
              catch (e) { alert('Error: ' + e.message); cargar() }
            }} style={{ fontSize: isMobile ? 20 : 26, fontWeight:500, color:COLORS.navy, fontFamily:'var(--font-sans)' }}/>
          </h1>
          <p style={{ fontSize:12, color:COLORS.slate500, margin:'3px 0 0' }}>{proyecto.cliente?.razon_social || 'Sin cliente'} · {proyecto.director?.nombre || 'Sin director'}</p>
        </div>
        {esDirOAdmin && bloqueadas > 0 && (
          <button onClick={() => alert('Función "Autorizar avance": Registra pago del hito y desbloquea actividades automáticamente. Próximamente.')} style={{...btnTeal, display:'flex', alignItems:'center', gap:6}}>
            <Icon.Check/> Autorizar avance
          </button>
        )}
        <button onClick={() => setPanelProy(true)} title="Información del proyecto" style={{ padding:'8px 12px', background:'white', border:`1px solid ${COLORS.slate200}`, borderRadius:8, fontSize:12, cursor:'pointer', color:COLORS.slate600, display:'flex', alignItems:'center', gap:6, fontWeight:500, minHeight:40 }}><Icon.Info/> Info</button>
      </div>

      {bloqueadas > 0 && (
        <Alerta tipo="warn">
          <Icon.Lock/> <strong>{bloqueadas} actividades bloqueadas</strong> — Revisa los pagos pendientes para desbloquear el avance.
        </Alerta>
      )}
      {retrasadas > 0 && (
        <Alerta tipo="danger">
          <Icon.Warning/> <strong>{retrasadas} actividad(es) retrasada(s)</strong> — Requieren atención inmediata.
        </Alerta>
      )}

      <div style={{ display:'flex', borderBottom:`1px solid ${COLORS.slate200}`, marginBottom:20, gap:2, overflowX:'auto' }}>
        {tabs.map(t => (
          <button key={t.k} onClick={() => setTab(t.k)} style={{ padding:'10px 16px', border:'none', background:'transparent', cursor:'pointer', fontSize:13, fontWeight: tab===t.k?600:500, color: tab===t.k?COLORS.navy:COLORS.slate500, borderBottom: tab===t.k?`2px solid ${COLORS.navy}`:'2px solid transparent', marginBottom:-1, minHeight:44, display:'flex', alignItems:'center', gap:6, whiteSpace:'nowrap' }}>
            {t.icon}{t.l}
          </button>
        ))}
      </div>

      {tab === 'resumen' && <TabResumen proyecto={proyecto} actividades={actividades} hitos={hitos} usuarios={usuarios} puedeVerFinanciero={puedeVerFinanciero}/>}
      {tab === 'actividades' && <TabActividades actividades={actividades} numeracion={numeracion} onToggle={toggleActividad} onInlineUpdate={actualizarInline} onAbrirInfo={setPanelAct} onDesglosar={setDesglosarAct} onNuevaActividad={crearNuevaActividad} onMenuContextual={abrirMenuCtx} onEliminar={handleEliminar} puedeEditarPeso={esDirOAdmin}/>}
      {tab === 'gantt' && <GanttInteractivo actividadesProp={actividades} proyecto={proyecto} usuarios={usuarios} onRecargar={cargar} onDesglosar={setDesglosarAct} onAbrirInfo={setPanelAct} onInlineUpdate={actualizarInline} onNuevaActividad={crearNuevaActividad} onMenuContextual={abrirMenuCtx} onQuitarDep={handleQuitarDepGantt}/>}
      {tab === 'kanban' && <TabKanban actividades={actividades} onAbrirInfo={setPanelAct} numeracion={numeracion}/>}
      {tab === 'personas' && <TabPorPersona actividades={actividades} usuarios={usuarios} numeracion={numeracion} onAbrirInfo={setPanelAct}/>}
      {tab === 'sim' && <TabSIM proyectoId={proyectoId} usuarios={usuarios} usuarioActual={usuarioActual}/>}
      {tab === 'documentos' && <TabDocumentos proyecto={proyecto}/>}
      {tab === 'notas' && <TabNotas proyectoId={proyectoId} usuarios={usuarios}/>}
      {tab === 'financiero' && <TabFinanciero proyecto={proyecto} hitos={hitos} puedeVerFinanciero={puedeVerFinanciero}/>}
    </div>
  )
}

// ============================================================
// v15.7.0 — TAB SIM (Workflow Declaración Operación Comercial)
// Stepper vertical de 6 etapas con estado, fechas, responsable y notas.
// Edición restringida a direccion / director_proyectos / admin.
// ============================================================
function TabSIM({ proyectoId, usuarios, usuarioActual }) {
  const [etapas, setEtapas] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tablaNoExiste, setTablaNoExiste] = useState(false)
  const [editandoKey, setEditandoKey] = useState(null)
  const [guardando, setGuardando] = useState(false)

  const puedeEditar = ['direccion', 'director_proyectos', 'admin'].includes(usuarioActual?.rol)

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getProyectoSimEtapas(proyectoId)
      if (data === null) { setTablaNoExiste(true); setEtapas([]) }
      else { setEtapas(data); setTablaNoExiste(false) }
    } catch (e) { alert('Error cargando etapas SIM: ' + e.message) }
    setLoading(false)
  }, [proyectoId])

  useEffect(() => { cargar() }, [cargar])

  const guardar = async (etapaKey, cambios) => {
    setGuardando(true)
    try {
      await upsertEtapaSim(proyectoId, etapaKey, cambios)
      await cargar()
      setEditandoKey(null)
    } catch (e) {
      alert('Error guardando: ' + e.message)
    } finally { setGuardando(false) }
  }

  const cambiarEstado = (etapa, nuevoEstado) => {
    const cambios = { estado: nuevoEstado }
    if (nuevoEstado === 'en_curso' && !etapa.fecha_inicio) cambios.fecha_inicio = new Date().toISOString().slice(0, 10)
    if (nuevoEstado === 'completada' && !etapa.fecha_fin) cambios.fecha_fin = new Date().toISOString().slice(0, 10)
    guardar(etapa.etapa, cambios)
  }

  if (loading) return <div style={{ padding:40, textAlign:'center', color:COLORS.slate400, fontSize:13 }}>Cargando workflow SIM...</div>

  if (tablaNoExiste) {
    return (
      <div style={{ background:'#FEF3C7', border:`1px solid #FDE68A`, borderRadius:12, padding:18 }}>
        <h3 style={{ fontSize:13, fontWeight:600, color:'#92400E', margin:0, marginBottom:8 }}>Tabla SIM no configurada</h3>
        <p style={{ fontSize:12, color:'#92400E', margin:0, lineHeight:1.5 }}>
          Aplica el SQL en <strong>supabase/migrations/v15.7.0_proyecto_sim_etapas.sql</strong> en el SQL Editor de tu dashboard de Supabase. Una vez ejecutado, recarga esta vista.
        </p>
      </div>
    )
  }

  const completadas = etapas.filter(e => e.estado === 'completada').length
  const total = etapas.length
  const pct = total > 0 ? Math.round((completadas / total) * 100) : 0

  return (
    <div>
      {/* Header con progreso global */}
      <div style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:12, padding:18, marginBottom:16 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:10 }}>
          <h3 style={{ fontSize:14, fontWeight:600, color:COLORS.ink, margin:0 }}>Workflow SIM · Declaración Operación Comercial</h3>
          <span style={{ fontSize:12, color:COLORS.slate500 }}>{completadas} / {total} etapas · <strong style={{ color:pct === 100 ? COLORS.teal : COLORS.navy }}>{pct}%</strong></span>
        </div>
        <div style={{ height:8, background:COLORS.slate50, borderRadius:4, overflow:'hidden' }}>
          <div style={{ width:`${pct}%`, height:'100%', background: pct === 100 ? COLORS.teal : COLORS.navy, borderRadius:4, transition:'width 0.3s' }}/>
        </div>
        {!puedeEditar && (
          <div style={{ fontSize:10, color:COLORS.slate500, marginTop:8, fontStyle:'italic' }}>
            Solo dirección / director de proyectos pueden editar las etapas. Tienes acceso de lectura.
          </div>
        )}
      </div>

      {/* Stepper vertical */}
      <div style={{ display:'grid', gap:0 }}>
        {etapas.map((et, i) => {
          const meta = ETAPAS_SIM.find(m => m.key === et.etapa)
          const colors = ESTADOS_SIM[et.estado] || ESTADOS_SIM.pendiente
          const isLast = i === etapas.length - 1
          const isEditing = editandoKey === et.etapa
          const responsableNombre = et.responsable?.nombre || (et.responsable_id ? usuarios.find(u => u.id === et.responsable_id)?.nombre : null)

          return (
            <div key={et.etapa} style={{ display:'flex', gap:14 }}>
              {/* Columna izquierda: numero + línea conectora */}
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', flexShrink:0 }}>
                <div style={{
                  width:36, height:36, borderRadius:'50%',
                  background: colors.bg, color: colors.color,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:14, fontWeight:700, fontFamily:'var(--font-mono)',
                  border:`2px solid ${colors.color}`,
                }}>{i + 1}</div>
                {!isLast && <div style={{ flex:1, width:2, background: et.estado === 'completada' ? COLORS.teal : COLORS.slate100, minHeight:60, marginTop:4, marginBottom:4 }}/>}
              </div>

              {/* Card de la etapa */}
              <div style={{
                flex:1, marginBottom: isLast ? 0 : 12,
                background:'white', border:`1px solid ${COLORS.slate100}`,
                borderLeft:`3px solid ${colors.color}`, borderRadius:10, padding:14,
              }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:10, flexWrap:'wrap' }}>
                  <div style={{ flex:1, minWidth:200 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
                      <span style={{ fontSize:13, fontWeight:600, color:COLORS.ink }}>{meta?.label || et.etapa}</span>
                      <Badge texto={colors.label} mapa={ESTADOS_SIM} tamano={10}/>
                    </div>
                    <div style={{ fontSize:11, color:COLORS.slate500, lineHeight:1.4 }}>{meta?.descripcion}</div>
                    {(et.fecha_inicio || et.fecha_fin || responsableNombre) && (
                      <div style={{ fontSize:11, color:COLORS.slate600, marginTop:6, display:'flex', flexWrap:'wrap', gap:10 }}>
                        {et.fecha_inicio && <span><strong>Inicio:</strong> {et.fecha_inicio}</span>}
                        {et.fecha_fin && <span><strong>Fin:</strong> {et.fecha_fin}</span>}
                        {responsableNombre && <span><strong>Responsable:</strong> {responsableNombre}</span>}
                      </div>
                    )}
                    {et.notas && <div style={{ fontSize:11, color:COLORS.slate600, marginTop:6, padding:'6px 10px', background:COLORS.slate50, borderRadius:6, lineHeight:1.4 }}>{et.notas}</div>}
                  </div>
                  {puedeEditar && !isEditing && (
                    <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                      {et.estado === 'pendiente' && <button onClick={() => cambiarEstado(et, 'en_curso')} disabled={guardando} style={{ padding:'5px 10px', background:COLORS.teal, color:'white', border:'none', borderRadius:6, fontSize:10, fontWeight:600, cursor:'pointer' }}>Iniciar</button>}
                      {et.estado === 'en_curso' && <button onClick={() => cambiarEstado(et, 'completada')} disabled={guardando} style={{ padding:'5px 10px', background:COLORS.teal, color:'white', border:'none', borderRadius:6, fontSize:10, fontWeight:600, cursor:'pointer' }}>Completar</button>}
                      {et.estado !== 'completada' && et.estado !== 'bloqueada' && <button onClick={() => cambiarEstado(et, 'bloqueada')} disabled={guardando} style={{ padding:'5px 10px', background:'transparent', color:COLORS.red, border:`1px solid ${COLORS.red}`, borderRadius:6, fontSize:10, fontWeight:500, cursor:'pointer' }}>Bloquear</button>}
                      {et.estado === 'bloqueada' && <button onClick={() => cambiarEstado(et, 'en_curso')} disabled={guardando} style={{ padding:'5px 10px', background:COLORS.amber, color:'white', border:'none', borderRadius:6, fontSize:10, fontWeight:600, cursor:'pointer' }}>Desbloquear</button>}
                      {et.estado === 'completada' && <button onClick={() => cambiarEstado(et, 'en_curso')} disabled={guardando} style={{ padding:'5px 10px', background:'transparent', color:COLORS.slate600, border:`1px solid ${COLORS.slate200}`, borderRadius:6, fontSize:10, fontWeight:500, cursor:'pointer' }}>Reabrir</button>}
                      <button onClick={() => setEditandoKey(et.etapa)} disabled={guardando} style={{ padding:'5px 10px', background:'transparent', color:COLORS.slate600, border:`1px solid ${COLORS.slate200}`, borderRadius:6, fontSize:10, fontWeight:500, cursor:'pointer' }}>Editar detalles</button>
                    </div>
                  )}
                </div>

                {isEditing && (
                  <FormEditarEtapaSim
                    etapa={et}
                    usuarios={usuarios}
                    guardando={guardando}
                    onCancelar={() => setEditandoKey(null)}
                    onGuardar={(cambios) => guardar(et.etapa, cambios)}
                  />
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function FormEditarEtapaSim({ etapa, usuarios, guardando, onCancelar, onGuardar }) {
  const [form, setForm] = useState({
    estado: etapa.estado || 'pendiente',
    fecha_inicio: etapa.fecha_inicio || '',
    fecha_fin: etapa.fecha_fin || '',
    responsable_id: etapa.responsable_id || '',
    notas: etapa.notas || '',
  })

  const submit = () => {
    onGuardar({
      estado: form.estado,
      fecha_inicio: form.fecha_inicio || null,
      fecha_fin: form.fecha_fin || null,
      responsable_id: form.responsable_id || null,
      notas: form.notas || null,
    })
  }

  return (
    <div style={{ marginTop:12, padding:12, background:COLORS.slate50, borderRadius:8 }}>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
        <div>
          <label style={labelStyle}>Estado</label>
          <select value={form.estado} onChange={e=>setForm({...form, estado:e.target.value})} style={selectStyle}>
            {Object.entries(ESTADOS_SIM).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Responsable</label>
          <select value={form.responsable_id} onChange={e=>setForm({...form, responsable_id:e.target.value})} style={selectStyle}>
            <option value="">— Sin responsable —</option>
            {usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
          </select>
        </div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
        <div><label style={labelStyle}>Fecha inicio</label><input type="date" value={form.fecha_inicio} onChange={e=>setForm({...form, fecha_inicio:e.target.value})} style={inputStyle}/></div>
        <div><label style={labelStyle}>Fecha fin</label><input type="date" value={form.fecha_fin} onChange={e=>setForm({...form, fecha_fin:e.target.value})} style={inputStyle}/></div>
      </div>
      <div style={{ marginBottom:8 }}>
        <label style={labelStyle}>Notas</label>
        <textarea value={form.notas} onChange={e=>setForm({...form, notas:e.target.value})} rows={3} style={{...inputStyle, resize:'vertical', fontFamily:'inherit'}} placeholder="Acuerdos con CENACE, observaciones, próximos pasos..."/>
      </div>
      <div style={{ display:'flex', justifyContent:'flex-end', gap:8 }}>
        <button onClick={onCancelar} disabled={guardando} style={{ padding:'7px 14px', background:'transparent', color:COLORS.slate600, border:`1px solid ${COLORS.slate200}`, borderRadius:6, fontSize:11, cursor:'pointer' }}>Cancelar</button>
        <button onClick={submit} disabled={guardando} style={{ padding:'7px 16px', background:COLORS.navy, color:'white', border:'none', borderRadius:6, fontSize:11, fontWeight:600, cursor: guardando ? 'wait' : 'pointer' }}>{guardando ? 'Guardando...' : 'Guardar'}</button>
      </div>
    </div>
  )
}

export default function Proyectos({ usuario }) {
  const [searchParams, setSearchParams] = useSearchParams()
  // Deep-link desde Centro de Alertas: capturar params en el primer render para que sobrevivan al cleanup de URL
  const deepLinkRef = useRef({
    proyectoId: searchParams.get('proyecto'),
    actividadId: searchParams.get('actividad'),
    aplicado: false,
  })
  const [proyectos, setProyectos] = useState([])
  const [loading, setLoading] = useState(true)
  const [proyectoSel, setProyectoSel] = useState(null)
  const [deepLinkActividadId, setDeepLinkActividadId] = useState(null)
  const [modalNuevo, setModalNuevo] = useState(false)
  const [filtro, setFiltro] = useState('Activos')
  const [busqueda, setBusqueda] = useState('')
  const [duplicando, setDuplicando] = useState(false) // v12
  const isMobile = useIsMobile()

  const cargar = async () => { setLoading(true); setProyectos(await getProyectos()); setLoading(false) }
  useEffect(() => { cargar() }, [])

  // Deep-link: aplicar ?proyecto=X cuando los proyectos terminen de cargar; limpiar URL después
  useEffect(() => {
    if (deepLinkRef.current.aplicado) return
    if (proyectos.length === 0) return
    const { proyectoId, actividadId } = deepLinkRef.current
    if (proyectoId && proyectos.some(p => p.id === proyectoId)) {
      setProyectoSel(proyectoId)
      setDeepLinkActividadId(actividadId)
    }
    deepLinkRef.current.aplicado = true
    if (searchParams.get('proyecto') || searchParams.get('actividad')) {
      setSearchParams({}, { replace: true })
    }
  }, [proyectos, searchParams, setSearchParams])

  // v12: Duplicar proyecto completo
  const handleDuplicarProyecto = async (proyecto, e) => {
    e.stopPropagation()
    const nombreSugerido = `${proyecto.nombre} (copia)`
    const nuevoNombre = prompt(`Nombre del nuevo proyecto:`, nombreSugerido)
    if (!nuevoNombre?.trim()) return
    setDuplicando(true)
    try {
      const nuevoId = await duplicarProyecto(proyecto.id, nuevoNombre.trim())
      await cargar()
      setDuplicando(false)
      if (confirm(`✓ Proyecto duplicado.\n\n¿Abrir "${nuevoNombre}" ahora?`)) {
        setProyectoSel(nuevoId)
      }
    } catch (e) {
      setDuplicando(false)
      alert('Error al duplicar: ' + e.message)
    }
  }

  const filtrados = useMemo(() => {
    let r = proyectos
    if (filtro === 'Activos') r = r.filter(p => ['Por iniciar', 'En curso', 'En pausa'].includes(p.estado))
    else if (filtro === 'Terminados') r = r.filter(p => ['Terminado', 'Cancelado'].includes(p.estado))
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase()
      r = r.filter(p => p.nombre?.toLowerCase().includes(q) || p.cliente?.razon_social?.toLowerCase().includes(q) || p.codigo?.toLowerCase().includes(q))
    }
    return r
  }, [proyectos, filtro, busqueda])

  if (proyectoSel) return <DetalleProyecto proyectoId={proyectoSel} actividadInicialId={deepLinkActividadId} onVolver={() => { setProyectoSel(null); setDeepLinkActividadId(null); cargar() }} usuarioActual={usuario}/>

  return (
    <div>
      {duplicando && <div style={{ position:'fixed', top:20, right:20, background:COLORS.navy, color:'white', padding:'10px 16px', borderRadius:8, zIndex:2000, fontSize:12, fontWeight:600 }}>Duplicando proyecto...</div>}
      {modalNuevo && <ModalNuevoProyecto onClose={() => setModalNuevo(false)} onCreado={(p) => { setModalNuevo(false); cargar(); setProyectoSel(p.id) }}/>}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontSize: isMobile ? 24 : 32, fontWeight:400, color:COLORS.navy, margin:0, fontFamily:'var(--font-sans)' }}>Proyectos</h1>
          <p style={{ color:COLORS.slate500, fontSize:12, marginTop:4 }}>{filtrados.length} de {proyectos.length}</p>
        </div>
        <button onClick={() => setModalNuevo(true)} style={{ padding:'10px 18px', background:COLORS.navy, color:'white', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:6, minHeight:44 }}>
          <Icon.Plus/> {isMobile ? 'Nuevo' : 'Nuevo proyecto'}
        </button>
      </div>
      <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
        <div style={{ display:'flex', background:'white', border:`1px solid ${COLORS.slate100}`, borderRadius:10, padding:2 }}>
          {['Activos', 'Terminados', 'Todos'].map(f => (
            <button key={f} onClick={() => setFiltro(f)} style={{ padding:'7px 14px', border:'none', background: filtro === f ? COLORS.navy : 'transparent', color: filtro === f ? 'white' : COLORS.slate600, borderRadius:8, fontSize:12, fontWeight:600, cursor:'pointer' }}>{f}</button>
          ))}
        </div>
        <div style={{ flex:1, minWidth:200, position:'relative' }}>
          <div style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:COLORS.slate400 }}><Icon.Search/></div>
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar..." style={{ width:'100%', padding:'9px 14px 9px 36px', border:`1px solid ${COLORS.slate100}`, borderRadius:10, fontSize:12, outline:'none', minHeight:40, boxSizing:'border-box', fontFamily:'inherit' }}/>
        </div>
      </div>
      {loading && <div style={{ padding:40, textAlign:'center', color:COLORS.slate400 }}>Cargando...</div>}
      {!loading && filtrados.length === 0 && <div style={{ padding:50, background:'white', border:`1px dashed ${COLORS.slate200}`, borderRadius:12, textAlign:'center', color:COLORS.slate500 }}>{busqueda ? 'Sin resultados' : 'Sin proyectos'}</div>}
      {!loading && filtrados.length > 0 && (
        <div style={{ display:'grid', gap:8 }}>
          {filtrados.map(p => {
            const tieneBloqueadas = (p.actividades || []).some(a => a.estado === 'Bloqueada')
            // v12: avance ponderado del proyecto
            const avancePond = p.actividades && p.actividades.length > 0
              ? calcularAvancePonderado(p.actividades, null)
              : (p.avance || 0)
            return (
              <div key={p.id} onClick={() => setProyectoSel(p.id)} style={{ background:'white', border:`1px solid ${COLORS.slate100}`, borderLeft:`3px solid ${ESTADOS_PROY[p.estado]?.bar || COLORS.slate400}`, borderRadius:10, padding:16, cursor:'pointer', display:'flex', alignItems:'center', gap:12 }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:3, flexWrap:'wrap' }}>
                    <span style={{ fontSize:10, fontFamily:'var(--font-mono)', color:COLORS.slate400, fontWeight:600 }}>{p.codigo}</span>
                    <Badge texto={p.estado} mapa={ESTADOS_PROY}/>
                    {/* v12: Badges de clasificación, prioridad, tipo */}
                    {p.clasificacion && <BadgeChip texto={p.clasificacion} mapa={CLASIFICACION} label="Clase"/>}
                    {p.prioridad && p.prioridad !== 'Media' && <BadgeChip texto={p.prioridad} mapa={PRIORIDAD} label="Prioridad"/>}
                    {p.tipo_proyecto && p.tipo_proyecto !== 'Otros' && (
                      <span style={{ fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:4, background:COLORS.slate50, color:COLORS.slate600, whiteSpace:'nowrap' }}>{p.tipo_proyecto}</span>
                    )}
                    {tieneBloqueadas && <span title="Actividades bloqueadas" style={{ color:COLORS.amber, display:'inline-flex' }}><Icon.Lock/></span>}
                  </div>
                  <div style={{ fontSize:15, fontWeight:500, color:COLORS.ink, marginBottom:2 }}>{p.nombre}</div>
                  <div style={{ fontSize:11, color:COLORS.slate500 }}>{p.cliente?.razon_social || 'Sin cliente'}{p.director?.nombre && ` · ${p.director.nombre}`}</div>
                </div>
                {/* v12: Avance ponderado visual */}
                {!isMobile && (
                  <div style={{ minWidth:100, textAlign:'right' }}>
                    <div style={{ fontSize:10, color:COLORS.slate500, fontWeight:600, marginBottom:3 }}>Avance ponderado</div>
                    <div style={{ fontSize:14, fontFamily:'var(--font-mono)', fontWeight:700, color: avancePond >= 75 ? COLORS.teal : avancePond >= 40 ? COLORS.amber : COLORS.slate600 }}>{avancePond}%</div>
                  </div>
                )}
                {/* v12: Botón duplicar */}
                <button onClick={(e) => handleDuplicarProyecto(p, e)} title="Duplicar proyecto completo" style={{ padding:'6px 8px', background:'transparent', color:COLORS.slate500, border:`1px solid ${COLORS.slate200}`, borderRadius:6, cursor:'pointer', display:'flex', alignItems:'center' }}>
                  <Icon.Duplicate/>
                </button>
                <span style={{ color:COLORS.slate400 }}>›</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}