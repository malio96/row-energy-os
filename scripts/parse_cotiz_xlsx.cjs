// One-off: parsea "Seguimiento cotizaciones.xlsx" (hojas 2024/2025/2026) y emite
// un bloque VALUES SQL de staging para reconciliar contra la tabla cotizaciones.
// No escribe en BD. Salida: /tmp/stage_cotiz.sql  +  resumen por stdout.
const ExcelJS = require('exceljs')
const fs = require('fs')

const SRC = '/Users/maliomartinez/Downloads/Seguimiento cotizaciones.xlsx'
const OUT = '/tmp/stage_cotiz.sql'

function mapEstado(v) {
  const s = String(v ?? '').trim().toUpperCase()
  if (s === 'ACEPTADA') return 'Aprobada'
  if (s === 'PENDIENTE') return 'Enviada'
  if (s === 'RECHAZADA') return 'Rechazada'
  if (s === 'CANCELADA') return 'Rechazada'
  return null
}
function num(v) {
  if (v == null) return null
  if (typeof v === 'object') v = v.result // celda con fórmula
  if (typeof v === 'string') { v = v.replace(/[, $]/g, ''); if (v === '-' || v === '') return null }
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
function txt(v) {
  if (v == null) return null
  if (typeof v === 'object') v = (v.richText ? v.richText.map(t => t.text).join('') : v.result ?? v.text)
  const s = String(v ?? '').trim()
  return s === '' ? null : s
}
function norm(code) { return String(code ?? '').toUpperCase().replace(/\s+/g, '') }
function sqlStr(s) { return s == null ? 'NULL' : `'${String(s).replace(/'/g, "''")}'` }
function sqlNum(n) { return n == null ? 'NULL' : String(n) }

;(async () => {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(SRC)
  const sheets = ['2024', '2025', '2026']
  const rows = []
  const seen = new Set()
  const stats = {}

  for (const name of sheets) {
    const ws = wb.getWorksheet(name)
    stats[name] = { real: 0, dupCodigo: 0 }
    ws.eachRow((row) => {
      const codigoRaw = txt(row.getCell('E').value)
      const nombre = txt(row.getCell('D').value)
      if (!codigoRaw || !nombre) return            // placeholders / encabezados / vacíos
      if (codigoRaw === 'N° COTIZACIÓN') return
      const estado = mapEstado(row.getCell('F').value)
      const subtotal = num(row.getCell('G').value)
      const total = name === '2024'
        ? num(row.getCell('H').value)
        : (subtotal != null ? Math.round(subtotal * 1.16 * 100) / 100 : null)
      const notas = txt(row.getCell('J').value)
      const cn = norm(codigoRaw)
      stats[name].real++
      if (seen.has(cn)) { stats[name].dupCodigo++; return } // dedupe por código normalizado
      seen.add(cn)
      rows.push({ cn, codigoRaw, nombre, estado, subtotal, total, notas, year: name })
    })
  }

  const values = rows.map(r =>
    `(${sqlStr(r.cn)},${sqlStr(r.codigoRaw)},${sqlStr(r.nombre)},${r.estado ? sqlStr(r.estado) : 'NULL'},` +
    `${sqlNum(r.subtotal)},${sqlNum(r.total)},${sqlStr(r.notas)},${sqlStr(r.year)})`
  ).join(',\n')

  fs.writeFileSync(OUT, values)
  console.log('Filas staged (únicas):', rows.length)
  console.log('Por hoja:', JSON.stringify(stats))
  console.log('Salida:', OUT)
})().catch(e => { console.error(e); process.exit(1) })
