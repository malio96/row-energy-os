// ============================================================
// exportCotizacion.js — v15.3c
// PDF de cotización con formato Row Energy: portada con logo,
// ¿Quiénes somos?, propuesta técnica con bullets descriptivos,
// términos y condiciones, firma escaneada de Malio.
// Refleja el template templates/COTIZACIÓN BASE CC (1).docx
// ============================================================
import pdfMake from 'pdfmake/build/pdfmake'
import * as pdfFonts from 'pdfmake/build/vfs_fonts'

pdfMake.vfs = pdfFonts.pdfMake?.vfs || pdfFonts.vfs || pdfFonts.default?.pdfMake?.vfs

// ============================================================
// COLORES
// ============================================================
const NAVY = '#0a2540'
const SLATE = '#475569'
const LIGHT = '#f1f5f9'
const ACCENT = '#0F6E56'

// ============================================================
// TEXTO FIJO DEL TEMPLATE
// ============================================================
const TEXTO_QUIENES_SOMOS =
  'ROW Energy es una empresa especializada en ofrecer soluciones integrales para el ahorro y gestión de la energía. Entre sus servicios se encuentra el desarrollo de proyectos de generación y la consultoría y gestoría con los órganos operadores y reguladores del sector energético en México para la interconexión y conexión de Centrales Eléctricas y Centros de Carga a las Redes Generales de Distribución y Red Nacional de Transmisión.'

const TEXTO_EQUIPO =
  'Contamos con un equipo de profesionistas especializados en la industria eléctrica mexicana, con los conocimientos y la formación necesaria para realizar con eficacia y eficiencia las actividades necesarias para cumplir con el objetivo general de los proyectos.'

const TC_CLAUSULAS = [
  {
    titulo: 'Literalidad',
    texto: 'Las actividades mencionadas en la cotización son indicativas mas no limitativas.',
  },
  {
    titulo: 'Servicios profesionales',
    texto: 'ROW Energy prestará los servicios en el lugar, plazo y fecha (o fechas) acordadas por las partes, y que están expresamente designados en la presente Propuesta Técnica – Económica, Orden de Compra o cualquier otro documento debidamente firmado por representantes de ambas partes (en lo sucesivo se hará referencia como "OC" a cualquier documento de dicha naturaleza en que se describan las condiciones del Servicio).',
  },
  {
    titulo: 'Tarifas de servicio y condiciones de pago',
    texto: 'El Cliente se compromete a abonar las tarifas que aparecen en la Propuesta Técnica – Económica y en las facturas presentadas por ROW Energy. Si una factura que no haya sido rechazada por el Cliente permanece impagada durante más de treinta (30) días, ROW Energy podrá suspender cualquier prestación de Servicios hasta el pago completo de la suma adeudada.',
  },
  {
    titulo: 'Impuestos',
    texto: 'Salvo que se añada como cláusula por separado o que se acuerde lo contrario por escrito, las tarifas y cantidades mencionadas no incluyen impuestos, los cuales deberán ser incluidos por el cliente en el pago por el servicio ofertado.',
  },
  {
    titulo: 'Moneda',
    texto: 'Los cobros mencionados en esta oferta están en pesos mexicanos.',
  },
  {
    titulo: 'Gastos',
    texto: 'Los gastos en que se incurra para la prestación de los servicios ofertados se encuentran incluidos en el precio pactado. En caso hubiese gastos no contemplados en la propuesta y sean por alguna responsabilidad del cliente, ROW Energy valorizará dichos gastos añadiendo un 10% por gastos administrativos, para su posterior aprobación del cliente y facturación de éste.',
  },
  {
    titulo: 'Confidencialidad',
    texto: 'Las Partes y sus empleados se abstendrán de divulgar, publicar o comunicar, directa o indirectamente a terceros la información, documentos o fotografías relacionada con los negocios y operaciones de cada una de ellas, subordinadas o matrices, o de sus contratistas, que conozcan en virtud del negocio jurídico que se esté desarrollando y de la ejecución de los servicios o por cualquier otra causa. Para estos efectos, las Partes convienen que divulgar o transmitir cualquier información que reciban de la otra Parte (Información Confidencial) puede lesionar sus negocios o su reputación, inclusive será causal de terminación del acuerdo y de indemnización de los daños y perjuicios sufridos.',
  },
  {
    titulo: 'Garantía',
    texto: 'ROW Energy garantiza que la prestación de Servicios se llevará a cabo de manera eficiente y profesional. ROW Energy se compromete a prestar de nuevo el Servicio, sin costo alguno, en caso de que las fallas que reportasen los equipos a intervenir no sean por causas de mala operación por parte del cliente o factores externos a ROW Energy.',
  },
  {
    titulo: 'Autorizaciones legales',
    texto: 'El Cliente deberá obtener cualquier autorización necesaria y cumplir todas las leyes, reglamentos y la normativa estatal y/o local en relación con todos los servicios, así como con la utilización de los servicios. Se incluyen a estos efectos, sin ánimo de exhaustividad, las leyes y reglamentos tales como la legislación laboral, medioambiental y de protección a consumidores y usuarios.',
  },
  {
    titulo: 'Fuerza mayor',
    texto: 'Las partes no serán responsables por los retrasos o incumplimientos de sus obligaciones (excluyendo las obligaciones de pago) cuando se deban a causas que escapen a su control, entre las que se incluyen sin ánimo de exhaustividad el dictado de normas estatales, los paros laborales, los fallos en el transporte o de proveedores, los incendios, casos de desobediencia civil, embargos, guerras, revueltas, ataques terroristas, terremotos, huelgas, epidemias, inundaciones, sucesos atmosféricos y otros eventos de similares características que, si se producen, ampliarán el plazo de que disponen las partes para ejecutar una OC.',
  },
]

// ============================================================
// HELPERS
// ============================================================
function fmtMoney(n, moneda = 'MXN') {
  const v = Number(n || 0)
  return new Intl.NumberFormat('es-MX', {
    style: 'currency', currency: moneda || 'MXN',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(v)
}

function fmtFecha(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })
}

function fmtFechaCorta(iso) {
  if (!iso) return new Date().toLocaleDateString('es-MX')
  const d = new Date(iso)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd} / ${mm} / ${d.getFullYear()}`
}

function nombreArchivo(cot) {
  const codigo = (cot?.codigo || 'COT').replace(/\s+/g, '_')
  const cliente = (cot?.cliente?.razon_social || '').slice(0, 25).replace(/[^\w]+/g, '_')
  const fecha = new Date().toISOString().slice(0, 10)
  return `${codigo}${cliente ? '_' + cliente : ''}_${fecha}.pdf`
}

// Convierte una URL de imagen (en /public) a base64 para pdfmake
async function loadImage(url) {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch { return null }
}

// Detecta si una descripción tiene formato de bullets (líneas que empiezan con - o •)
// Devuelve un nodo pdfmake apropiado.
function descripcionABullets(texto) {
  if (!texto || typeof texto !== 'string') return null
  const lineas = texto.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  if (lineas.length === 0) return null
  const sonBullets = lineas.length > 1 && lineas.every(l => /^[-•·*]\s+/.test(l))
  if (sonBullets) {
    return {
      ul: lineas.map(l => l.replace(/^[-•·*]\s+/, '')),
      fontSize: 9,
      color: SLATE,
      margin: [12, 4, 0, 0],
    }
  }
  return { text: texto, fontSize: 9, color: SLATE, margin: [0, 4, 0, 0], lineHeight: 1.35 }
}

// ============================================================
// MAIN EXPORT
// ============================================================
export async function exportarCotizacionPDF(cot) {
  const items = (cot?.items || []).slice().sort((a, b) => (a.orden || 0) - (b.orden || 0))
  const moneda = cot?.moneda || 'MXN'

  const subtotal = items.reduce((s, it) => s + Number(it.total || 0), 0)
  const iva = subtotal * 0.16
  const total = subtotal + iva

  const primero = items[0]
  const condicionesUniformes = items.length > 0 && items.every(it =>
    Number(it.porcentaje_anticipo) === Number(primero.porcentaje_anticipo) &&
    Number(it.porcentaje_avance) === Number(primero.porcentaje_avance) &&
    Number(it.porcentaje_finalizacion) === Number(primero.porcentaje_finalizacion)
  )

  // Cargar imágenes (logo + firma) en paralelo
  const [logo, firma] = await Promise.all([
    loadImage('/templates/row-logo.png'),
    loadImage('/templates/firma-malio.png'),
  ])

  // ============================================================
  // PORTADA
  // ============================================================
  const portada = [
    {
      columns: [
        logo
          ? { image: logo, width: 130, alignment: 'left' }
          : { text: 'ROW ENERGY', fontSize: 18, bold: true, color: NAVY, characterSpacing: 1 },
        {
          alignment: 'right',
          stack: [
            { text: 'COTIZACIÓN', fontSize: 14, bold: true, color: NAVY, characterSpacing: 2 },
            { text: cot?.codigo || '—', fontSize: 11, color: SLATE, margin: [0, 4, 0, 0] },
            { text: fmtFechaCorta(cot?.fecha_emision), fontSize: 9, color: SLATE, margin: [0, 4, 0, 0] },
          ],
        },
      ],
      margin: [0, 0, 0, 30],
    },

    // Título de propuesta
    { text: 'Propuesta Técnica – Económica', fontSize: 22, bold: true, color: NAVY, font: 'Roboto', margin: [0, 60, 0, 12] },
    { text: cot?.nombre_proyecto || '', fontSize: 14, color: SLATE, margin: [0, 0, 0, 60] },

    {
      table: {
        widths: ['*'],
        body: [[{
          stack: [
            { text: 'DIRIGIDA A', fontSize: 9, bold: true, color: NAVY, characterSpacing: 1.5 },
            { text: cot?.cliente?.razon_social || 'Cliente', fontSize: 16, bold: true, color: NAVY, margin: [0, 6, 0, 4] },
            ...(cot?.cliente?.rfc ? [{ text: `RFC: ${cot.cliente.rfc}`, fontSize: 10, color: SLATE }] : []),
            ...(cot?.cliente?.industria ? [{ text: cot.cliente.industria, fontSize: 10, color: SLATE }] : []),
          ],
        }]],
      },
      layout: {
        hLineWidth: () => 0, vLineWidth: () => 0, fillColor: () => LIGHT,
        paddingLeft: () => 18, paddingRight: () => 18,
        paddingTop: () => 14, paddingBottom: () => 14,
      },
    },

    // Footer de portada con vendedor responsable
    {
      absolutePosition: { x: 50, y: 720 },
      stack: [
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 200, y2: 0, lineWidth: 0.7, lineColor: NAVY }] },
        { text: 'Responsable comercial', fontSize: 8, color: SLATE, characterSpacing: 1, margin: [0, 4, 0, 0] },
        { text: cot?.vendedor?.nombre || '—', fontSize: 11, bold: true, color: NAVY, margin: [0, 2, 0, 0] },
        ...(cot?.vendedor?.email ? [{ text: cot.vendedor.email, fontSize: 9, color: SLATE }] : []),
      ],
    },

    { text: '', pageBreak: 'after' },
  ]

  // ============================================================
  // QUIÉNES SOMOS + EQUIPO
  // ============================================================
  const acercaDe = [
    { text: '¿Quiénes somos?', style: 'h1' },
    { text: TEXTO_QUIENES_SOMOS, style: 'parrafo' },
    { text: 'Nuestro equipo', style: 'h1', margin: [0, 22, 0, 8] },
    { text: TEXTO_EQUIPO, style: 'parrafo' },
    { text: '', pageBreak: 'after' },
  ]

  // ============================================================
  // PROPUESTA TÉCNICA — descripción de servicios
  // ============================================================
  const propuestaTecnica = [
    { text: 'Propuesta Técnica', style: 'h1' },
    { text: 'Alcance de los servicios cotizados:', style: 'parrafo', margin: [0, 0, 0, 14] },
    ...items.flatMap((it, i) => {
      const descripcionNode = descripcionABullets(it.descripcion)
      return [
        {
          stack: [
            { text: `${i + 1}. ${it.servicio || ''}`, fontSize: 12, bold: true, color: NAVY, margin: [0, i === 0 ? 0 : 12, 0, 0] },
            ...(descripcionNode ? [descripcionNode] : []),
          ],
        },
      ]
    }),
    ...(items.length === 0 ? [{ text: 'Sin servicios cotizados.', color: SLATE, italics: true }] : []),
  ]

  // ============================================================
  // PROPUESTA ECONÓMICA — tabla + totales + condiciones
  // ============================================================
  const itemsTable = {
    table: {
      headerRows: 1,
      widths: [22, '*', 50, 75, 80],
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
          { text: it.servicio || '', fontSize: 10 },
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
      paddingTop: () => 7, paddingBottom: () => 7,
    },
  }

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
        { text: 'Las condiciones de pago varían por concepto:', fontSize: 10, margin: [0, 0, 0, 6] },
        {
          table: {
            widths: ['*', 55, 55, 70],
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
            hLineColor: () => '#e2e8f0', vLineColor: () => '#e2e8f0',
            hLineWidth: () => 0.5, vLineWidth: () => 0.5,
            fillColor: (rowIndex) => (rowIndex === 0 ? NAVY : null),
          },
        },
      ],
    }
  }

  const propuestaEconomica = [
    { text: 'Propuesta Económica', style: 'h1', pageBreak: 'before' },

    // Datos del proyecto
    {
      table: {
        widths: ['*', '*', '*'],
        body: [[
          { stack: [
            { text: 'Cliente', fontSize: 8, color: SLATE, characterSpacing: 1 },
            { text: cot?.cliente?.razon_social || '—', fontSize: 10, bold: true, color: NAVY, margin: [0, 2, 0, 0] },
          ]},
          { stack: [
            { text: 'Capacidad', fontSize: 8, color: SLATE, characterSpacing: 1 },
            { text: cot?.capacidad_mw ? `${cot.capacidad_mw} MW` : '—', fontSize: 10, bold: true, color: NAVY, margin: [0, 2, 0, 0] },
          ]},
          { stack: [
            { text: 'Ubicación', fontSize: 8, color: SLATE, characterSpacing: 1 },
            { text: cot?.ubicacion || '—', fontSize: 10, bold: true, color: NAVY, margin: [0, 2, 0, 0] },
          ]},
        ]],
      },
      layout: {
        hLineWidth: () => 0, vLineWidth: () => 0, fillColor: () => LIGHT,
        paddingLeft: () => 12, paddingRight: () => 12, paddingTop: () => 10, paddingBottom: () => 10,
      },
      margin: [0, 0, 0, 16],
    },

    itemsTable,

    // Totales
    {
      columns: [
        { width: '*', text: '' },
        {
          width: 230, margin: [0, 12, 0, 0],
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
            vLineWidth: () => 0, hLineColor: () => NAVY,
            paddingTop: () => 5, paddingBottom: () => 5,
          },
        },
      ],
      margin: [0, 0, 0, 22],
    },

    // Condiciones de pago + vigencia
    { text: 'Condiciones de pago', style: 'h2' },
    condicionesBlock,
    {
      margin: [0, 14, 0, 0],
      text: [
        { text: 'Vigencia de la cotización: ', bold: true, fontSize: 10 },
        { text: cot?.fecha_vigencia ? fmtFecha(cot.fecha_vigencia) : '—', fontSize: 10 },
      ],
    },

    ...(cot?.notas ? [
      { text: 'Observaciones', style: 'h2', margin: [0, 22, 0, 6] },
      { text: cot.notas, fontSize: 10, color: '#374151', lineHeight: 1.4 },
    ] : []),
  ]

  // ============================================================
  // TÉRMINOS Y CONDICIONES
  // ============================================================
  const terminos = [
    { text: 'Términos y Condiciones', style: 'h1', pageBreak: 'before' },
    ...TC_CLAUSULAS.flatMap((c, i) => [
      { text: `${i + 1}. ${c.titulo}`, fontSize: 11, bold: true, color: NAVY, margin: [0, i === 0 ? 0 : 10, 0, 4] },
      { text: c.texto, fontSize: 9.5, color: '#374151', lineHeight: 1.4, alignment: 'justify' },
    ]),
  ]

  // ============================================================
  // FIRMA / CIERRE
  // ============================================================
  const cierre = [
    { text: 'Atentamente,', fontSize: 11, color: NAVY, margin: [0, 60, 0, 30] },
    ...(firma ? [{ image: firma, width: 110, margin: [0, 0, 0, 4] }] : []),
    { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 200, y2: 0, lineWidth: 0.7, lineColor: NAVY }] },
    { text: 'Malio Martínez Mariscal', fontSize: 11, bold: true, color: NAVY, margin: [0, 6, 0, 0] },
    { text: 'Representante Legal', fontSize: 9, color: SLATE },
    { text: 'ROW Energy México', fontSize: 9, color: SLATE },
  ]

  // ============================================================
  // DOC DEFINITION
  // ============================================================
  const docDefinition = {
    pageSize: 'LETTER',
    pageMargins: [50, 50, 50, 60],
    defaultStyle: { font: 'Roboto', fontSize: 10, color: '#1f2937', lineHeight: 1.3 },
    info: {
      title: `Cotización ${cot?.codigo || ''}`,
      author: 'Row Energy México',
      subject: cot?.nombre_proyecto || 'Cotización de servicios',
    },
    content: [
      ...portada,
      ...acercaDe,
      ...propuestaTecnica,
      ...propuestaEconomica,
      ...terminos,
      ...cierre,
    ],
    styles: {
      th: { color: 'white', bold: true, fontSize: 9, characterSpacing: 0.5 },
      h1: { fontSize: 16, bold: true, color: NAVY, margin: [0, 0, 0, 10] },
      h2: { fontSize: 12, bold: true, color: NAVY, margin: [0, 0, 0, 8] },
      parrafo: { fontSize: 10.5, color: '#374151', lineHeight: 1.5, alignment: 'justify' },
    },
    footer: (currentPage, pageCount) => {
      // No mostrar footer en la portada
      if (currentPage === 1) return null
      return {
        columns: [
          { text: `${cot?.codigo || ''} · Row Energy México`, fontSize: 8, color: SLATE, alignment: 'left', margin: [50, 16, 0, 0] },
          { text: `${currentPage} / ${pageCount}`, fontSize: 8, color: SLATE, alignment: 'right', margin: [0, 16, 50, 0] },
        ],
      }
    },
  }

  pdfMake.createPdf(docDefinition).download(nombreArchivo(cot))
}
