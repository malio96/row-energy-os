// ============================================================
// exportGantt.js — v15.2
// Helpers para exportar el cronograma (Gantt) a PDF y Excel.
// El export usa la lista de actividades planas (no la representación SVG).
// ============================================================
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'

// Construye las filas tabulares a partir de las actividades + usuarios
function construirFilas(actividades, usuarios) {
  const usuariosMap = (usuarios || []).reduce((acc, u) => { acc[u.id] = u; return acc }, {})
  return (actividades || [])
    .slice()
    .sort((a, b) => (a.numero || 0) - (b.numero || 0))
    .map(a => {
      const ini = a.inicio ? new Date(a.inicio) : null
      const fin = a.fin ? new Date(a.fin) : null
      const dias = ini && fin ? Math.max(1, Math.ceil((fin - ini) / 86400000) + 1) : ''
      const responsable = usuariosMap[a.responsable_id]?.nombre
        || usuariosMap[a.asignado_id]?.nombre
        || ''
      return {
        numero: a.numero || '',
        nombre: a.nombre || '',
        responsable,
        inicio: a.inicio || '',
        fin: a.fin || '',
        dias,
        estado: a.estado || '',
        avance: a.avance != null ? `${a.avance}%` : '',
      }
    })
}

function nombreArchivo(proyecto, ext) {
  const codigo = (proyecto?.codigo || 'proyecto').replace(/\s+/g, '_')
  const fecha = new Date().toISOString().slice(0, 10)
  return `${codigo}_cronograma_${fecha}.${ext}`
}

// ============================================================
// EXPORT PDF — render nativo jsPDF con visual de Gantt (barras + deps)
// Layout estilo Monday: columna izquierda con actividades + fechas,
// columna derecha con cronograma visual.
// ============================================================
const ESTADO_COLOR = {
  'Completada': [34, 197, 94],     // verde
  'En progreso': [251, 146, 60],   // naranja
  'Bloqueada':  [148, 163, 184],   // gris azul
  'Retrasada':  [220, 38, 38],     // rojo
  'Sin iniciar': [167, 139, 250],  // morado claro
}
const COL_DEFAULT = [203, 213, 225]
const TEXT_INK = [15, 23, 42]
const TEXT_MUTED = [100, 116, 139]
const GRID_LINE = [226, 232, 240]

function colorParaEstado(estado) {
  return ESTADO_COLOR[estado] || COL_DEFAULT
}

function fmtCompact(d) {
  if (!d) return '—'
  const dt = new Date(d)
  const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
  return `${dt.getUTCDate()} ${meses[dt.getUTCMonth()]} ${String(dt.getUTCFullYear()).slice(2)}`
}

export function exportarGanttPDF(proyecto, actividades, usuarios) {
  // Filtrar y ordenar actividades — incluye TODAS (root + sub) en orden de numero
  const actsOrdenadas = (actividades || [])
    .filter(a => a.inicio || a.fin)  // necesitan al menos una fecha para mostrarse en el gantt
    .slice()
    .sort((a, b) => (a.numero || 0) - (b.numero || 0))

  if (actsOrdenadas.length === 0) {
    alert('No hay actividades con fechas para exportar.')
    return
  }

  // Rango temporal global
  const fechas = []
  actsOrdenadas.forEach(a => {
    if (a.inicio) fechas.push(new Date(a.inicio))
    if (a.fin)    fechas.push(new Date(a.fin))
  })
  const minDate = new Date(Math.min(...fechas))
  const maxDate = new Date(Math.max(...fechas))
  // Padding 15 días a cada lado
  minDate.setUTCDate(minDate.getUTCDate() - 15)
  maxDate.setUTCDate(maxDate.getUTCDate() + 15)
  const rangoMs = maxDate - minDate
  if (rangoMs <= 0) {
    alert('Rango de fechas inválido.')
    return
  }

  // PDF en A3 landscape
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a3' })
  const PW = doc.internal.pageSize.getWidth()
  const PH = doc.internal.pageSize.getHeight()
  const MARGIN = 30
  const LEFT_COL_W = 320           // ancho columna izquierda (actividad + fechas)
  const ROW_H = 18                 // alto de cada fila
  const HEADER_TOP = 70            // y donde arranca el header del gantt
  const HEADER_H = 36              // alto del header de fechas
  const FOOTER_H = 40              // espacio para leyenda

  const ganttX = MARGIN + LEFT_COL_W + 10
  const ganttW = PW - ganttX - MARGIN
  const filaY0 = HEADER_TOP + HEADER_H + 4
  const maxFilasPorPagina = Math.floor((PH - filaY0 - FOOTER_H - 20) / ROW_H)

  // ID map para resolver dependencias
  const actById = {}
  actsOrdenadas.forEach((a, idx) => { actById[a.id] = { ...a, _idx: idx } })

  // ────────── Helpers de dibujo ──────────
  function xParaFecha(d) {
    if (!d) return ganttX
    const t = new Date(d) - minDate
    return ganttX + (t / rangoMs) * ganttW
  }

  function pintarHeaderProyecto() {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.setTextColor(...TEXT_INK)
    doc.text(proyecto?.nombre || 'Cronograma', MARGIN, 32)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...TEXT_MUTED)
    const sub = [
      proyecto?.codigo,
      proyecto?.cliente?.razon_social,
      proyecto?.tipo_proyecto,
      proyecto?.capacidad_mw ? `${proyecto.capacidad_mw} MW` : null,
    ].filter(Boolean).join(' · ')
    if (sub) doc.text(sub, MARGIN, 48)
    doc.setFontSize(8)
    const meta = `${actsOrdenadas.length} actividades · Generado ${new Date().toLocaleString('es-MX')}`
    doc.text(meta, PW - MARGIN - doc.getTextWidth(meta), 32)
  }

  function pintarHeaderFechas() {
    // Fondo header
    doc.setFillColor(248, 250, 252)
    doc.rect(MARGIN, HEADER_TOP, PW - 2*MARGIN, HEADER_H, 'F')
    doc.setDrawColor(...GRID_LINE)
    doc.setLineWidth(0.5)
    doc.line(MARGIN, HEADER_TOP + HEADER_H, PW - MARGIN, HEADER_TOP + HEADER_H)

    // Etiquetas de columna izquierda
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...TEXT_INK)
    doc.text('Actividad', MARGIN + 8, HEADER_TOP + HEADER_H/2 + 3)
    doc.text('Fechas', MARGIN + LEFT_COL_W - 90, HEADER_TOP + HEADER_H/2 + 3)

    // Escala de tiempo: años + quarters
    const yearTop = HEADER_TOP + 4
    const qTop = HEADER_TOP + 20
    const yearH = 14
    const qH = 14

    const yStart = minDate.getUTCFullYear()
    const yEnd = maxDate.getUTCFullYear()
    doc.setFontSize(10)
    for (let y = yStart; y <= yEnd; y++) {
      // años
      const xY1 = xParaFecha(new Date(Date.UTC(y, 0, 1)))
      const xY2 = xParaFecha(new Date(Date.UTC(y+1, 0, 1)))
      const xa = Math.max(xY1, ganttX)
      const xb = Math.min(xY2, ganttX + ganttW)
      if (xb - xa < 10) continue
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(...TEXT_INK)
      const tw = doc.getTextWidth(String(y))
      doc.text(String(y), Math.max(xa + (xb-xa)/2 - tw/2, xa + 2), yearTop + yearH - 3)
      // separador vertical año
      doc.setDrawColor(...GRID_LINE)
      doc.setLineWidth(0.4)
      doc.line(xY1, yearTop, xY1, HEADER_TOP + HEADER_H)

      // quarters
      for (let q = 0; q < 4; q++) {
        const qx1 = xParaFecha(new Date(Date.UTC(y, q*3, 1)))
        const qx2 = xParaFecha(new Date(Date.UTC(y, (q+1)*3, 1)))
        if (qx2 < ganttX || qx1 > ganttX + ganttW) continue
        const qa = Math.max(qx1, ganttX)
        const qb = Math.min(qx2, ganttX + ganttW)
        if (qb - qa < 6) continue
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7)
        doc.setTextColor(...TEXT_MUTED)
        const txt = `Q${q+1}`
        const ttw = doc.getTextWidth(txt)
        doc.text(txt, qa + (qb-qa)/2 - ttw/2, qTop + qH - 3)
        doc.setDrawColor(...GRID_LINE)
        doc.setLineWidth(0.2)
        doc.line(qx1, qTop, qx1, HEADER_TOP + HEADER_H)
      }
    }

    // Separador columna izquierda / gantt
    doc.setDrawColor(...GRID_LINE)
    doc.setLineWidth(0.6)
    doc.line(MARGIN + LEFT_COL_W, HEADER_TOP, MARGIN + LEFT_COL_W, PH - FOOTER_H)
  }

  function pintarHeaderGrupo(fase, yIdx) {
    const y = filaY0 + yIdx * ROW_H
    doc.setFillColor(238, 242, 247)
    doc.rect(MARGIN, y, PW - 2*MARGIN, ROW_H, 'F')
    doc.setDrawColor(15, 110, 86)
    doc.setLineWidth(2)
    doc.line(MARGIN, y, MARGIN, y + ROW_H)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.5)
    doc.setTextColor(...TEXT_INK)
    doc.text(fase, MARGIN + 8, y + ROW_H/2 + 3)
    // Separador horizontal
    doc.setDrawColor(...GRID_LINE)
    doc.setLineWidth(0.4)
    doc.line(MARGIN, y + ROW_H, PW - MARGIN, y + ROW_H)
  }

  function pintarFila(act, yIdx) {
    const y = filaY0 + yIdx * ROW_H
    // Fila alternada
    if (yIdx % 2 === 1) {
      doc.setFillColor(250, 251, 253)
      doc.rect(MARGIN, y, PW - 2*MARGIN, ROW_H, 'F')
    }
    // Línea divisora
    doc.setDrawColor(...GRID_LINE)
    doc.setLineWidth(0.2)
    doc.line(MARGIN, y + ROW_H, PW - MARGIN, y + ROW_H)

    // Texto actividad (truncado)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(...TEXT_INK)
    const isSub = !!act.parent_id
    const indent = isSub ? 16 : 4
    const nombre = `${act.numero ? act.numero + '. ' : ''}${act.nombre || ''}`
    const maxNombreW = LEFT_COL_W - indent - 100
    let txt = nombre
    while (doc.getTextWidth(txt) > maxNombreW && txt.length > 4) {
      txt = txt.slice(0, -2)
    }
    if (txt !== nombre) txt = txt.slice(0, -1) + '…'
    doc.text(txt, MARGIN + indent, y + ROW_H/2 + 3)

    // Fechas en columna izquierda
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...TEXT_MUTED)
    const fechas = `${fmtCompact(act.inicio)} → ${fmtCompact(act.fin)}`
    doc.text(fechas, MARGIN + LEFT_COL_W - 90, y + ROW_H/2 + 3)

    // Barra del gantt
    if (act.inicio && act.fin) {
      const x1 = xParaFecha(act.inicio)
      const x2 = Math.max(xParaFecha(act.fin), x1 + 2)
      const [r,g,b] = colorParaEstado(act.estado)
      const barH = 9
      const barY = y + (ROW_H - barH)/2
      doc.setFillColor(r, g, b)
      doc.roundedRect(x1, barY, x2 - x1, barH, 2, 2, 'F')
      // Avance overlay (más oscuro)
      if (act.avance > 0) {
        const advW = (x2 - x1) * Math.min(act.avance, 100) / 100
        doc.setFillColor(Math.max(0,r-40), Math.max(0,g-40), Math.max(0,b-40))
        doc.roundedRect(x1, barY, advW, barH, 2, 2, 'F')
      }
      // Etiqueta a la derecha
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      doc.setTextColor(...TEXT_INK)
      const lbl = txt.length > 30 ? '' : txt
      if (lbl && x2 + 4 + doc.getTextWidth(lbl) < PW - MARGIN) {
        doc.text(lbl, x2 + 4, y + ROW_H/2 + 2.5)
      }
    }
  }

  function pintarDependencias(actividadesEnPagina) {
    // Map id → {x_fin, y_centro} de las actividades visibles en esta página
    // (acepta nulls para mantener el yIdx de los headers de grupo)
    const visiblePos = {}
    actividadesEnPagina.forEach((act, yIdx) => {
      if (!act) return
      const y = filaY0 + yIdx * ROW_H
      if (act.inicio && act.fin) {
        visiblePos[act.id] = {
          xFin: xParaFecha(act.fin),
          xIni: xParaFecha(act.inicio),
          y: y + ROW_H/2,
        }
      }
    })

    doc.setDrawColor(100, 116, 139)
    doc.setLineWidth(0.4)
    actividadesEnPagina.forEach((act) => {
      if (!act) return
      const sucPos = visiblePos[act.id]
      if (!sucPos) return
      const deps = act.deps || []
      deps.forEach(dep => {
        const predPos = visiblePos[dep.id]
        if (!predPos) return
        // Línea ortogonal: desde xFin pred → xIni suc
        const x1 = predPos.xFin
        const y1 = predPos.y
        const x2 = sucPos.xIni
        const y2 = sucPos.y
        const midX = Math.max(x1 + 6, x2 - 6)
        // Horizontal salida → vertical → horizontal entrada
        doc.line(x1, y1, midX, y1)
        doc.line(midX, y1, midX, y2)
        doc.line(midX, y2, x2, y2)
        // Punta de flecha pequeña
        doc.setFillColor(100, 116, 139)
        const ah = 3
        doc.triangle(x2, y2, x2 - ah*1.4, y2 - ah*0.7, x2 - ah*1.4, y2 + ah*0.7, 'F')
      })
    })
  }

  function pintarLeyenda() {
    const ly = PH - FOOTER_H + 14
    let lx = MARGIN
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    Object.entries(ESTADO_COLOR).forEach(([estado, [r,g,b]]) => {
      doc.setFillColor(r, g, b)
      doc.roundedRect(lx, ly - 6, 10, 8, 1.5, 1.5, 'F')
      doc.setTextColor(...TEXT_INK)
      doc.text(estado, lx + 14, ly)
      lx += 14 + doc.getTextWidth(estado) + 18
    })
    // Marca al pie
    doc.setFontSize(7)
    doc.setTextColor(...TEXT_MUTED)
    const foot = `Row Energy OS · ${proyecto?.codigo || ''}`
    doc.text(foot, PW - MARGIN - doc.getTextWidth(foot), ly)
  }

  // ────────── Construir lista plana con headers de grupo intercalados ──────────
  // Cada item es { kind: 'header'|'fila', fase?, act? }
  const items = []
  let faseAnt = null
  actsOrdenadas.forEach(act => {
    const fase = (act.fase || '').trim()
    // Solo insertar header en cambios de fase a nivel root (no para subactividades)
    const esRoot = !act.parent_id
    if (esRoot && fase && fase !== faseAnt) {
      items.push({ kind: 'header', fase })
      faseAnt = fase
    } else if (esRoot && !fase) {
      faseAnt = null
    }
    items.push({ kind: 'fila', act })
  })

  // ────────── Render por páginas ──────────
  const totalPaginas = Math.ceil(items.length / maxFilasPorPagina)
  for (let p = 0; p < totalPaginas; p++) {
    if (p > 0) doc.addPage()
    pintarHeaderProyecto()
    pintarHeaderFechas()
    const inicio = p * maxFilasPorPagina
    const fin = Math.min(inicio + maxFilasPorPagina, items.length)
    const enPagina = items.slice(inicio, fin)
    const filasParaDeps = []
    enPagina.forEach((it, idx) => {
      if (it.kind === 'header') {
        pintarHeaderGrupo(it.fase, idx)
        filasParaDeps.push(null)
      } else {
        pintarFila(it.act, idx)
        filasParaDeps.push(it.act)
      }
    })
    // Pasar a pintarDependencias incluyendo nulls para mantener yIdx
    pintarDependencias(filasParaDeps)
    pintarLeyenda()
    if (totalPaginas > 1) {
      doc.setFontSize(7)
      doc.setTextColor(...TEXT_MUTED)
      const txt = `Página ${p+1} de ${totalPaginas}`
      doc.text(txt, MARGIN, PH - 8)
    }
  }

  doc.save(nombreArchivo(proyecto, 'pdf'))
}

// ============================================================
// EXPORT EXCEL — usa exceljs (sin vulns sin fix conocidas)
// ============================================================
export async function exportarGanttExcel(proyecto, actividades, usuarios) {
  const filas = construirFilas(actividades, usuarios)
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Row Energy OS'
  wb.created = new Date()

  const ws = wb.addWorksheet('Cronograma', {
    views: [{ state: 'frozen', ySplit: 1 }],
  })

  ws.columns = [
    { header: '#',           key: 'numero',      width: 6 },
    { header: 'Actividad',   key: 'nombre',      width: 40 },
    { header: 'Responsable', key: 'responsable', width: 20 },
    { header: 'Inicio',      key: 'inicio',      width: 12 },
    { header: 'Fin',         key: 'fin',         width: 12 },
    { header: 'Días',        key: 'dias',        width: 8 },
    { header: 'Estado',      key: 'estado',      width: 14 },
    { header: 'Avance',      key: 'avance',      width: 10 },
  ]

  // Header style
  ws.getRow(1).eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0A2540' } }
    cell.alignment = { vertical: 'middle', horizontal: 'left' }
  })

  filas.forEach(f => ws.addRow(f))

  // Metadata en una hoja aparte (para auditoría)
  const meta = wb.addWorksheet('Información')
  meta.columns = [{ width: 22 }, { width: 50 }]
  meta.addRows([
    ['Proyecto',  proyecto?.nombre || ''],
    ['Código',    proyecto?.codigo || ''],
    ['Cliente',   proyecto?.cliente?.razon_social || ''],
    ['Generado',  new Date().toLocaleString('es-MX')],
    ['Actividades', filas.length],
  ])
  meta.getColumn(1).font = { bold: true }

  const buffer = await wb.xlsx.writeBuffer()
  saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), nombreArchivo(proyecto, 'xlsx'))
}
