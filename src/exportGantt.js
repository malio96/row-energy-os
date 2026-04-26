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
// EXPORT PDF — usa jsPDF + autoTable
// ============================================================
export function exportarGanttPDF(proyecto, actividades, usuarios) {
  const filas = construirFilas(actividades, usuarios)
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' })

  // Encabezado
  doc.setFontSize(16)
  doc.setTextColor('#0a2540')
  doc.text(proyecto?.nombre || 'Cronograma', 40, 40)

  doc.setFontSize(10)
  doc.setTextColor('#64748b')
  const subtitulo = `${proyecto?.codigo || ''}${proyecto?.cliente?.razon_social ? ' · ' + proyecto.cliente.razon_social : ''}`
  doc.text(subtitulo, 40, 58)

  doc.setFontSize(8)
  doc.text(`Generado: ${new Date().toLocaleString('es-MX')}  ·  ${filas.length} actividades`, 40, 72)

  autoTable(doc, {
    startY: 90,
    head: [['#', 'Actividad', 'Responsable', 'Inicio', 'Fin', 'Días', 'Estado', 'Avance']],
    body: filas.map(f => [f.numero, f.nombre, f.responsable, f.inicio, f.fin, f.dias, f.estado, f.avance]),
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [10, 37, 64], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 36, halign: 'right' },
      1: { cellWidth: 220 },
      2: { cellWidth: 110 },
      3: { cellWidth: 70 },
      4: { cellWidth: 70 },
      5: { cellWidth: 40, halign: 'right' },
      6: { cellWidth: 80 },
      7: { cellWidth: 50, halign: 'right' },
    },
    margin: { left: 40, right: 40 },
  })

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
