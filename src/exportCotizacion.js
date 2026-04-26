// ============================================================
// exportCotizacion.js — v15.3
// Genera PDF de cotización usando pdfmake (puro client-side).
// Diseño: convención estándar mexicana de cotización profesional.
// Cuando se reciba COTIZACIO_N_BASE_CC.docx, se ajustará para replicarlo.
// ============================================================
import pdfMake from 'pdfmake/build/pdfmake'
import * as pdfFonts from 'pdfmake/build/vfs_fonts'

// Algunas builds exponen vfs en `default.pdfMake.vfs` y otras en `pdfMake.vfs`
pdfMake.vfs = pdfFonts.pdfMake?.vfs || pdfFonts.vfs || pdfFonts.default?.pdfMake?.vfs

// ============================================================
// HELPERS
// ============================================================
const NAVY = '#0a2540'
const SLATE = '#64748b'
const LIGHT = '#f1f5f9'

function fmtMoney(n, moneda = 'MXN') {
  const v = Number(n || 0)
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: moneda || 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v)
}

function fmtFecha(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })
}

function nombreArchivo(cot) {
  const codigo = (cot?.codigo || 'COT').replace(/\s+/g, '_')
  const cliente = (cot?.cliente?.razon_social || '').slice(0, 25).replace(/[^\w]+/g, '_')
  const fecha = new Date().toISOString().slice(0, 10)
  return `${codigo}${cliente ? '_' + cliente : ''}_${fecha}.pdf`
}

// ============================================================
// MAIN EXPORT
// ============================================================
export function exportarCotizacionPDF(cot) {
  const items = (cot?.items || []).slice().sort((a, b) => (a.orden || 0) - (b.orden || 0))
  const moneda = cot?.moneda || 'MXN'

  const subtotal = items.reduce((s, it) => s + Number(it.total || 0), 0)
  const iva = subtotal * 0.16
  const total = subtotal + iva

  // ¿Todas las condiciones son iguales? entonces consolidamos
  const primero = items[0]
  const condicionesUniformes = items.length > 0 && items.every(it =>
    Number(it.porcentaje_anticipo) === Number(primero.porcentaje_anticipo) &&
    Number(it.porcentaje_avance) === Number(primero.porcentaje_avance) &&
    Number(it.porcentaje_finalizacion) === Number(primero.porcentaje_finalizacion)
  )

  // Tabla de items
  const itemsTable = {
    table: {
      headerRows: 1,
      widths: [22, '*', 50, 80, 80],
      body: [
        [
          { text: '#', style: 'th', alignment: 'right' },
          { text: 'Servicio', style: 'th' },
          { text: 'Cant.', style: 'th', alignment: 'right' },
          { text: 'Precio unit.', style: 'th', alignment: 'right' },
          { text: 'Importe', style: 'th', alignment: 'right' },
        ],
        ...items.map(it => [
          { text: String(it.orden ?? ''), alignment: 'right', color: SLATE, fontSize: 9 },
          {
            stack: [
              { text: it.servicio || '', bold: true, fontSize: 10 },
              ...(it.descripcion ? [{ text: it.descripcion, color: SLATE, fontSize: 9, margin: [0, 2, 0, 0] }] : []),
            ],
          },
          { text: String(it.cantidad ?? 1), alignment: 'right', fontSize: 9 },
          { text: fmtMoney(it.precio_unitario, moneda), alignment: 'right', fontSize: 9 },
          { text: fmtMoney(it.total, moneda), alignment: 'right', bold: true, fontSize: 10 },
        ]),
      ],
    },
    layout: {
      hLineColor: () => '#e2e8f0',
      vLineColor: () => '#e2e8f0',
      hLineWidth: (i) => (i === 0 || i === 1 ? 1 : 0.5),
      vLineWidth: () => 0.5,
      fillColor: (rowIndex) => (rowIndex === 0 ? NAVY : null),
      paddingTop: () => 6,
      paddingBottom: () => 6,
    },
  }

  // Bloque de condiciones de pago
  let condicionesBlock
  if (items.length === 0) {
    condicionesBlock = { text: 'Sin servicios cotizados.', color: SLATE, fontSize: 10 }
  } else if (condicionesUniformes) {
    condicionesBlock = {
      ul: [
        `${primero.porcentaje_anticipo}% de anticipo a la firma del contrato.`,
        `${primero.porcentaje_avance}% contra avance acordado.`,
        `${primero.porcentaje_finalizacion}% al concluir y entregar el servicio.`,
      ],
      fontSize: 10,
    }
  } else {
    condicionesBlock = {
      stack: [
        { text: 'Las condiciones de pago varían por concepto:', fontSize: 10, margin: [0, 0, 0, 4] },
        {
          table: {
            widths: ['*', 50, 50, 70],
            body: [
              [
                { text: 'Servicio', style: 'th' },
                { text: 'Anticipo', style: 'th', alignment: 'right' },
                { text: 'Avance', style: 'th', alignment: 'right' },
                { text: 'Finalización', style: 'th', alignment: 'right' },
              ],
              ...items.map(it => [
                { text: it.servicio || '', fontSize: 9 },
                { text: `${it.porcentaje_anticipo}%`, alignment: 'right', fontSize: 9 },
                { text: `${it.porcentaje_avance}%`, alignment: 'right', fontSize: 9 },
                { text: `${it.porcentaje_finalizacion}%`, alignment: 'right', fontSize: 9 },
              ]),
            ],
          },
          layout: {
            hLineColor: () => '#e2e8f0',
            vLineColor: () => '#e2e8f0',
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            fillColor: (rowIndex) => (rowIndex === 0 ? NAVY : null),
          },
        },
      ],
    }
  }

  const docDefinition = {
    pageSize: 'LETTER',
    pageMargins: [50, 50, 50, 70],
    defaultStyle: { font: 'Roboto', fontSize: 10, color: '#1f2937', lineHeight: 1.3 },
    info: {
      title: `Cotización ${cot?.codigo || ''}`,
      author: 'Row Energy México',
      subject: cot?.nombre_proyecto || 'Cotización de servicios',
    },
    content: [
      // ENCABEZADO
      {
        columns: [
          {
            stack: [
              { text: 'ROW ENERGY', fontSize: 18, bold: true, color: NAVY, characterSpacing: 1 },
              { text: 'México · Energía e interconexiones', color: SLATE, fontSize: 9, margin: [0, 2, 0, 0] },
            ],
          },
          {
            alignment: 'right',
            stack: [
              { text: 'COTIZACIÓN', fontSize: 16, bold: true, color: NAVY, characterSpacing: 2 },
              { text: cot?.codigo || '—', fontSize: 11, color: SLATE, font: 'Roboto', margin: [0, 4, 0, 0] },
              { text: `Emisión: ${fmtFecha(cot?.fecha_emision)}`, fontSize: 9, color: SLATE, margin: [0, 6, 0, 0] },
              { text: `Vigencia: ${fmtFecha(cot?.fecha_vigencia)}`, fontSize: 9, color: SLATE },
            ],
          },
        ],
      },
      // Línea separadora
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1.5, lineColor: NAVY }], margin: [0, 14, 0, 14] },

      // CLIENTE + PROYECTO
      {
        columns: [
          {
            width: '*',
            stack: [
              { text: 'CLIENTE', style: 'sectionTitle' },
              { text: cot?.cliente?.razon_social || '—', bold: true, fontSize: 11, margin: [0, 4, 0, 0] },
              ...(cot?.cliente?.rfc ? [{ text: `RFC: ${cot.cliente.rfc}`, color: SLATE, fontSize: 9, margin: [0, 2, 0, 0] }] : []),
              ...(cot?.cliente?.industria ? [{ text: cot.cliente.industria, color: SLATE, fontSize: 9 }] : []),
            ],
          },
          {
            width: '*',
            stack: [
              { text: 'RESPONSABLE COMERCIAL', style: 'sectionTitle' },
              { text: cot?.vendedor?.nombre || '—', bold: true, fontSize: 11, margin: [0, 4, 0, 0] },
              ...(cot?.vendedor?.email ? [{ text: cot.vendedor.email, color: SLATE, fontSize: 9, margin: [0, 2, 0, 0] }] : []),
            ],
          },
        ],
        margin: [0, 0, 0, 16],
      },

      // PROYECTO
      {
        table: {
          widths: ['*'],
          body: [[{
            stack: [
              { text: 'PROYECTO', style: 'sectionTitle' },
              { text: cot?.nombre_proyecto || '—', bold: true, fontSize: 12, color: NAVY, margin: [0, 4, 0, 4] },
              {
                columns: [
                  ...(cot?.capacidad_mw ? [{ width: 'auto', text: `Capacidad: ${cot.capacidad_mw} MW`, fontSize: 9, color: SLATE, margin: [0, 0, 16, 0] }] : []),
                  ...(cot?.ubicacion ? [{ width: 'auto', text: `Ubicación: ${cot.ubicacion}`, fontSize: 9, color: SLATE }] : []),
                ],
              },
            ],
          }]],
        },
        layout: {
          hLineWidth: () => 0,
          vLineWidth: () => 0,
          fillColor: () => LIGHT,
          paddingLeft: () => 12, paddingRight: () => 12,
          paddingTop: () => 10, paddingBottom: () => 10,
        },
        margin: [0, 0, 0, 18],
      },

      // SERVICIOS
      { text: 'SERVICIOS COTIZADOS', style: 'sectionTitle', margin: [0, 0, 0, 8] },
      itemsTable,

      // TOTALES
      {
        columns: [
          { width: '*', text: '' },
          {
            width: 230,
            margin: [0, 12, 0, 0],
            table: {
              widths: ['*', 90],
              body: [
                [{ text: 'Subtotal', alignment: 'right', color: SLATE }, { text: fmtMoney(subtotal, moneda), alignment: 'right' }],
                [{ text: 'IVA 16%', alignment: 'right', color: SLATE }, { text: fmtMoney(iva, moneda), alignment: 'right' }],
                [{ text: 'TOTAL', alignment: 'right', bold: true, fontSize: 12, color: NAVY }, { text: `${fmtMoney(total, moneda)} ${moneda}`, alignment: 'right', bold: true, fontSize: 12, color: NAVY }],
              ],
            },
            layout: {
              hLineWidth: (i, node) => (i === node.table.body.length - 1 || i === node.table.body.length ? 1 : 0),
              vLineWidth: () => 0,
              hLineColor: () => NAVY,
              paddingTop: () => 5, paddingBottom: () => 5,
            },
          },
        ],
        margin: [0, 0, 0, 18],
      },

      // CONDICIONES DE PAGO
      { text: 'CONDICIONES DE PAGO', style: 'sectionTitle', margin: [0, 6, 0, 6] },
      condicionesBlock,

      // NOTAS
      ...(cot?.notas ? [
        { text: 'OBSERVACIONES', style: 'sectionTitle', margin: [0, 18, 0, 6] },
        { text: cot.notas, fontSize: 10, color: '#374151' },
      ] : []),

      // FIRMA
      {
        margin: [0, 36, 0, 0],
        columns: [
          {
            width: '*',
            stack: [
              { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 200, y2: 0, lineWidth: 0.7, lineColor: NAVY }] },
              { text: cot?.vendedor?.nombre || 'Vendedor', bold: true, fontSize: 10, margin: [0, 4, 0, 0] },
              { text: 'Row Energy México', fontSize: 9, color: SLATE },
            ],
          },
          { width: '*', text: '' },
        ],
      },
    ],
    styles: {
      th: { color: 'white', bold: true, fontSize: 9, characterSpacing: 0.5 },
      sectionTitle: { fontSize: 9, color: NAVY, bold: true, characterSpacing: 1.2 },
    },
    footer: (currentPage, pageCount) => ({
      columns: [
        { text: 'Row Energy México · contacto@row.energy', fontSize: 8, color: SLATE, alignment: 'left', margin: [50, 16, 0, 0] },
        { text: `${currentPage} / ${pageCount}`, fontSize: 8, color: SLATE, alignment: 'right', margin: [0, 16, 50, 0] },
      ],
    }),
  }

  pdfMake.createPdf(docDefinition).download(nombreArchivo(cot))
}
