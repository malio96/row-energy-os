// ============================================================
// exportCotizacion.js — v15.8.2
// PDF de cotización refactorizado 1:1 con templates/COTIZACION_REFERENCIA.pdf
// (la versión PDF del Word real de Malio).
//
// Estructura:
//   Página 1 — Portada full-bleed con imagen hero
//   Página 2+ — Header constante (logo + folio + lugar/fecha) +
//               Footer constante (dirección + tel + url + página + banner turbinas)
//   Contenido: ¿Quiénes somos? → Presencia → Alcance → Propuesta Técnica
//              (cada servicio numerado con bullets verdes) → T&C doble columna
//              → Atentamente + firma Malio
// ============================================================
import pdfMake from 'pdfmake/build/pdfmake'
import * as pdfFonts from 'pdfmake/build/vfs_fonts'

pdfMake.vfs = pdfFonts.pdfMake?.vfs || pdfFonts.vfs || pdfFonts.default?.pdfMake?.vfs

// ============================================================
// COLORES — verde Row Energy en lugar de navy para títulos
// ============================================================
const NAVY = '#0a2540'
const SLATE = '#475569'
const TEAL = '#0F6E56'         // verde Row Energy para títulos y bullets
const LIGHT = '#f1f5f9'

// Datos de la empresa para header/footer
const EMPRESA = {
  nombre: 'ROW Energy',
  direccion: 'Av. México 3040, piso 10, oficina 1003/1004, Residencial Juan Manuel, Gdl, Jalisco.',
  telefono: 'Tel: 33 1119 5553',
  web: 'https://www.ROW-Energy-com.mx',
  ciudad: 'Guadalajara, Jalisco',
}

// ============================================================
// TEXTO FIJO DEL TEMPLATE
// ============================================================
const TEXTO_QUIENES_SOMOS =
  'ROW Energy es una empresa especializada en ofrecer soluciones integrales para el ahorro y gestión de la energía, entre sus servicios se encuentra el desarrollo de proyectos de generación y la consultoría y gestoría con los órganos operadores y reguladores del sector energético en México para la interconexión y conexión de Centrales Eléctricas y Centros de Carga a las Redes Generales de Distribución y Red Nacional de Transmisión.'

const TEXTO_EQUIPO =
  'Contamos con un equipo de profesionistas especializados en la industria eléctrica mexicana, con los conocimientos y la formación necesaria para realizar con eficacia y eficiencia las actividades necesarias para cumplir eficazmente con el objetivo general de los proyectos.'

const TC_CLAUSULAS = [
  { titulo: 'Literalidad', texto: 'Las actividades mencionadas en la cotización son indicativas mas no limitativas.' },
  { titulo: 'Servicios profesionales', texto: 'ROW Energy prestará los servicios en el lugar, plazo y fecha (o fechas) acordadas por las partes, y que están expresamente designados en la presente Propuesta Técnica – Económica, Orden de Compra o cualquier otro documento debidamente firmado por representantes de ambas partes (en lo sucesivo se hará referencia como "OC" a cualquier documento de dicha naturaleza en que se describan las condiciones del Servicio).' },
  { titulo: 'Tarifas de servicio y condiciones de pago', texto: 'El Cliente se compromete a abonar las tarifas que aparecen en la Propuesta Técnica – Económica y en las facturas presentadas por ROW Energy. Si una factura que no haya sido rechazada por el Cliente permanece impagada durante más de treinta (30) días, ROW Energy podrá suspender cualquier prestación de Servicios hasta el pago completo de la suma adeudada.' },
  { titulo: 'Impuestos', texto: 'Salvo que se añada como cláusula por separado o que se acuerde lo contrario por escrito, las tarifas y cantidades mencionadas no incluyen impuestos, los cuales deberán ser incluidos por el cliente en el pago por el servicio ofertado.' },
  { titulo: 'Moneda', texto: 'Los cobros mencionados en esta oferta están en pesos mexicanos.' },
  { titulo: 'Gastos', texto: 'Los gastos en que se incurra para la prestación de los servicios ofertados se encuentran incluidos en el precio pactado. En caso hubiese gastos no contemplados en la propuesta y sean por alguna responsabilidad del cliente, ROW Energy valorizará dichos gastos añadiendo un 10% por gastos administrativos, para su posterior aprobación del cliente y facturación de éste.' },
  { titulo: 'Confidencialidad', texto: 'Las Partes y sus empleados se abstendrán de divulgar, publicar o comunicar, directa o indirectamente a terceros la información, documentos o fotografías relacionada con los negocios y operaciones de cada una de ellas, subordinadas o matrices, o de sus contratistas, que conozcan en virtud del negocio jurídico que se esté desarrollando y de la ejecución de los servicios o por cualquier otra causa. Para estos efectos, las Partes convienen que divulgar o transmitir cualquier información que reciban de la otra Parte (Información Confidencial) puede lesionar sus negocios o su reputación, inclusive será causal de terminación del acuerdo y de indemnización de los daños y perjuicios sufridos.' },
  { titulo: 'Garantía', texto: 'ROW Energy garantiza que la prestación de Servicios se llevará a cabo de manera eficiente y profesional. ROW Energy se compromete a prestar de nuevo el Servicio, sin costo alguno, en caso de que las fallas que reportasen los equipos a intervenir no sean por causas de mala operación por parte del cliente o factores externos a ROW Energy.' },
  { titulo: 'Autorizaciones legales', texto: 'El Cliente deberá obtener cualquier autorización necesaria y cumplir todas las leyes, reglamentos y la normativa estatal y/o local en relación con todos los servicios, así como con la utilización de los servicios. Se incluyen a estos efectos, sin ánimo de exhaustividad, las leyes y reglamentos tales como la legislación laboral, medioambiental y de protección a consumidores y usuarios.' },
  { titulo: 'Fuerza mayor', texto: 'Las partes no serán responsables por los retrasos o incumplimientos de sus obligaciones (excluyendo las obligaciones de pago) cuando se deban a causas que escapen a su control, entre las que se incluyen sin ánimo de exhaustividad el dictado de normas estatales, los paros laborales, los fallos en el transporte o de proveedores, los incendios, casos de desobediencia civil, embargos, guerras, revueltas, ataques terroristas, terremotos, huelgas, epidemias, inundaciones, sucesos atmosféricos y otros eventos de similares características que, si se producen, ampliarán el plazo de que disponen las partes para ejecutar una OC.' },
]

const MESES_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

// ============================================================
// HELPERS
// ============================================================
function fmtMoney(n, moneda = 'MXN') {
  const v = Number(n || 0)
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: moneda || 'MXN', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)
}

function fmtFechaTextoLargo(iso) {
  const d = iso ? new Date(iso) : new Date()
  return `${EMPRESA.ciudad} a ${d.getDate()} de ${MESES_ES[d.getMonth()]} de ${d.getFullYear()}`
}

function fmtFechaCortaSlash(iso) {
  const d = iso ? new Date(iso) : new Date()
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()}`
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

// Renderiza la descripción de un servicio: si trae líneas con "- " o "• " las
// convierte en bullets verdes; si no, párrafo plano.
function descripcionAContenido(texto) {
  if (!texto || typeof texto !== 'string') return []
  const lineas = texto.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  if (lineas.length === 0) return []
  const sonBullets = lineas.length > 1 && lineas.every(l => /^[-•·*]\s+/.test(l))
  if (sonBullets) {
    return lineas.map(l => bulletVerde(l.replace(/^[-•·*]\s+/, '')))
  }
  return [{ text: texto, fontSize: 10, color: '#374151', lineHeight: 1.4, alignment: 'justify', margin: [0, 4, 0, 0] }]
}

// Bullet con marcador verde (mejor visual que ul plano)
function bulletVerde(texto) {
  return {
    columns: [
      { width: 18, text: '•', color: TEAL, alignment: 'center', fontSize: 14, lineHeight: 1 },
      { text: texto, fontSize: 10, color: '#374151', lineHeight: 1.4, alignment: 'justify' },
    ],
    columnGap: 0,
    margin: [0, 3, 0, 3],
  }
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

  // Cargar todas las imágenes en paralelo
  const [logo, hero, mapa, alcance, banner, firma] = await Promise.all([
    loadImage('/templates/row-logo.png'),
    loadImage('/templates/cot-hero.jpeg'),
    loadImage('/templates/cot-mapa.png'),
    loadImage('/templates/cot-alcance.png'),
    loadImage('/templates/banner-turbinas.jpeg'),
    loadImage('/templates/firma-malio.png'),
  ])

  // ============================================================
  // PORTADA — imagen hero full-bleed + textos abajo
  // ============================================================
  const portada = [
    // Imagen full-bleed: margen negativo para extender más allá del pageMargins
    // (pageMargins top = 100 para acomodar header; aquí -100 lo cancela y la imagen llega a y=0)
    ...(hero ? [{
      image: hero,
      width: 612,
      margin: [-50, -100, -50, 18],
    }] : []),

    // Línea de "ROW Energy" + fecha
    {
      columns: [
        { text: 'ROW Energy', fontSize: 16, bold: true, color: '#1f2937' },
        { text: fmtFechaCortaSlash(cot?.fecha_emision), fontSize: 10, color: SLATE, alignment: 'right' },
      ],
      margin: [0, 0, 0, 8],
    },
    // "Dirigida a:" en una línea
    {
      text: [
        { text: 'Dirigida a: ', fontSize: 11, bold: true, color: '#1f2937' },
        { text: cot?.cliente?.razon_social || '—', fontSize: 11, color: '#1f2937' },
      ],
    },

    { text: '', pageBreak: 'after' },
  ]

  // ============================================================
  // ¿QUIÉNES SOMOS? + EQUIPO + MAPA "Presencia en el país"
  // ============================================================
  const acercaDe = [
    { text: '¿Quiénes somos?', style: 'h2' },
    { text: TEXTO_QUIENES_SOMOS, style: 'parrafo', margin: [0, 4, 0, 8] },
    { text: TEXTO_EQUIPO, style: 'parrafo' },
    ...(mapa ? [{ image: mapa, width: 360, alignment: 'center', margin: [0, 18, 0, 0] }] : []),
  ]

  // ============================================================
  // PROPUESTA TÉCNICA con imagen "Alcance" arriba
  // ============================================================
  const propuestaTecnica = [
    ...(alcance ? [{ image: alcance, width: 480, alignment: 'center', margin: [0, 0, 0, 18], pageBreak: 'before' }] : [{ text: '', pageBreak: 'before' }]),
    { text: 'Propuesta Técnica', style: 'h2', margin: [0, 4, 0, 4] },
    ...items.flatMap((it, i) => {
      const descripcionContent = descripcionAContenido(it.descripcion)
      return [
        {
          text: `${i + 1}. ${it.servicio || ''}`,
          fontSize: 13,
          bold: true,
          color: '#1f2937',
          margin: [0, i === 0 ? 8 : 14, 0, 6],
        },
        ...descripcionContent,
      ]
    }),
    ...(items.length === 0 ? [{ text: 'Sin servicios cotizados.', color: SLATE, italics: true }] : []),
  ]

  // ============================================================
  // PROPUESTA ECONÓMICA — tabla + totales + condiciones de pago
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
      hLineColor: () => '#e2e8f0', vLineColor: () => '#e2e8f0',
      hLineWidth: (i) => (i === 0 || i === 1 ? 1 : 0.5),
      vLineWidth: () => 0.5,
      fillColor: (rowIndex) => (rowIndex === 0 ? TEAL : null),
      paddingTop: () => 7, paddingBottom: () => 7,
    },
  }

  let condicionesBlock
  if (items.length === 0) {
    condicionesBlock = { text: 'Sin servicios cotizados.', color: SLATE, fontSize: 10 }
  } else if (condicionesUniformes) {
    condicionesBlock = {
      stack: [
        bulletVerde(`${primero.porcentaje_anticipo}% de anticipo a la firma del contrato.`),
        bulletVerde(`${primero.porcentaje_avance}% contra avance acordado.`),
        bulletVerde(`${primero.porcentaje_finalizacion}% al concluir y entregar el servicio.`),
      ],
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
            fillColor: (rowIndex) => (rowIndex === 0 ? TEAL : null),
          },
        },
      ],
    }
  }

  const propuestaEconomica = [
    { text: 'Propuesta Económica', style: 'h2', margin: [0, 24, 0, 12] },
    itemsTable,
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
              [{ text: 'TOTAL', alignment: 'right', bold: true, fontSize: 12, color: TEAL }, { text: `${fmtMoney(total, moneda)} ${moneda}`, alignment: 'right', bold: true, fontSize: 12, color: TEAL }],
            ],
          },
          layout: {
            hLineWidth: (i, node) => (i === node.table.body.length - 1 || i === node.table.body.length ? 1 : 0),
            vLineWidth: () => 0, hLineColor: () => TEAL,
            paddingTop: () => 5, paddingBottom: () => 5,
          },
        },
      ],
      margin: [0, 0, 0, 18],
    },
    { text: 'Condiciones de pago', style: 'h3' },
    condicionesBlock,
    {
      margin: [0, 12, 0, 0],
      text: [
        { text: 'Vigencia de la cotización: ', bold: true, fontSize: 10 },
        { text: cot?.fecha_vigencia ? fmtFecha(cot.fecha_vigencia) : '—', fontSize: 10 },
      ],
    },
    ...(cot?.notas ? [
      { text: 'Observaciones', style: 'h3', margin: [0, 18, 0, 4] },
      { text: cot.notas, fontSize: 10, color: '#374151', lineHeight: 1.4 },
    ] : []),
  ]

  // ============================================================
  // T&C en doble columna (continúa numeración después de los items técnicos)
  // El template original numera las cláusulas a partir de un offset.
  // Mantengo numeración propia 1-10 para simplicidad.
  // ============================================================
  const tcMitad = Math.ceil(TC_CLAUSULAS.length / 2)
  const tcCol1 = TC_CLAUSULAS.slice(0, tcMitad)
  const tcCol2 = TC_CLAUSULAS.slice(tcMitad)
  const renderClausulas = (arr, offset) => arr.flatMap((c, i) => [
    {
      text: [
        { text: `${offset + i + 1}. ${c.titulo}. `, bold: true, color: '#1f2937' },
        { text: c.texto, color: '#374151' },
      ],
      fontSize: 9,
      lineHeight: 1.35,
      alignment: 'justify',
      margin: [0, i === 0 ? 0 : 8, 0, 0],
    },
  ])
  const terminos = [
    { text: 'Términos y Condiciones', style: 'h2', pageBreak: 'before', margin: [0, 4, 0, 12] },
    {
      columns: [
        { width: '*', stack: renderClausulas(tcCol1, 0) },
        { width: 18, text: '' },
        { width: '*', stack: renderClausulas(tcCol2, tcMitad) },
      ],
      columnGap: 0,
    },
  ]

  // ============================================================
  // CIERRE — Atentamente + firma centrada
  // ============================================================
  const cierre = [
    { text: 'Atentamente', fontSize: 18, bold: true, alignment: 'center', color: '#1f2937', margin: [0, 36, 0, 18] },
    ...(firma ? [{ image: firma, width: 110, alignment: 'center', margin: [0, 0, 0, 4] }] : []),
    { canvas: [{ type: 'line', x1: 175, y1: 0, x2: 345, y2: 0, lineWidth: 0.7, lineColor: '#1f2937' }] },
    { text: 'Malio Martínez Mariscal', fontSize: 11, bold: true, color: '#1f2937', alignment: 'center', margin: [0, 6, 0, 0] },
    { text: 'Representante Legal', fontSize: 10, color: SLATE, alignment: 'center' },
    { text: 'ROW Energy', fontSize: 10, color: SLATE, alignment: 'center' },
  ]

  // ============================================================
  // HEADER (todas las páginas excepto la portada)
  // ============================================================
  const header = (currentPage) => {
    if (currentPage === 1) return null
    return {
      margin: [50, 28, 50, 0],
      columns: [
        logo
          ? { image: logo, width: 90, alignment: 'left' }
          : { text: 'ROW ENERGY', bold: true, fontSize: 12, color: '#1f2937' },
        {
          alignment: 'right',
          stack: [
            { text: EMPRESA.nombre, fontSize: 11, bold: true, color: '#1f2937' },
            { text: cot?.codigo || '—', fontSize: 10, color: '#1f2937' },
            { text: fmtFechaTextoLargo(cot?.fecha_emision), fontSize: 10, color: '#1f2937' },
          ],
        },
      ],
    }
  }

  // ============================================================
  // FOOTER (todas las páginas excepto la portada)
  // Dirección + tel + url centrado, número de página a la derecha,
  // banner turbinas decorativo abajo.
  // ============================================================
  const footer = (currentPage, pageCount) => {
    if (currentPage === 1) return null
    return {
      stack: [
        {
          margin: [50, 0, 50, 4],
          columns: [
            {
              width: '*',
              stack: [
                { text: EMPRESA.direccion, fontSize: 8, color: SLATE, alignment: 'center' },
                { text: `${EMPRESA.telefono}    ${EMPRESA.web}`, fontSize: 8, color: SLATE, alignment: 'center' },
              ],
            },
            { text: String(currentPage - 1), fontSize: 9, color: SLATE, alignment: 'right', width: 30 },
          ],
        },
        ...(banner ? [{ image: banner, width: 612, margin: [0, 4, 0, 0] }] : []),
      ],
    }
  }

  // ============================================================
  // DOC DEFINITION
  // ============================================================
  const docDefinition = {
    pageSize: 'LETTER',
    pageMargins: [50, 100, 50, 70],  // top mayor para dejar espacio al header
    defaultStyle: { font: 'Roboto', fontSize: 10, color: '#1f2937', lineHeight: 1.35 },
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
      h2: { fontSize: 15, bold: true, color: TEAL, margin: [0, 0, 0, 6] },
      h3: { fontSize: 12, bold: true, color: TEAL, margin: [0, 0, 0, 6] },
      parrafo: { fontSize: 10.5, color: '#374151', lineHeight: 1.5, alignment: 'justify' },
    },
    header,
    footer,
  }

  pdfMake.createPdf(docDefinition).download(nombreArchivo(cot))
}
