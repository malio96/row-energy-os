// ============================================================
// exportCotizacion.js — v16.3.0
// PDF de cotización refactorizado 1:1 con el DOCX base oficial
// (templates/COTIZACIÓN BASE CC (1).docx → renderizado en PDF).
//
// Cambios v16.3.0 vs v15.8.2:
//   - Color de títulos NAVY (#1F3864) en lugar de TEAL verde Row Energy.
//   - Numeración multi-nivel a)/b)/c) en sub-items en vez de bullets verdes.
//   - 17 cláusulas literales de T&C (vs 10 que tenía v15.8.2).
//   - Sin IVA visible en la tabla de Propuesta Económica (match DOCX).
//   - Portada con CO--XX debajo del título "ROW Energy".
//
// Estructura:
//   Página 1 — Portada full-bleed con imagen hero
//   Página 2+ — Header constante (logo + folio + lugar/fecha) +
//               Footer constante (dirección + tel + url + página + banner turbinas)
//   Contenido: ¿Quiénes somos? → Presencia → Alcance → Propuesta Técnica
//              (cada servicio numerado con sub-items a/b/c) → Propuesta Económica
//              → T&C doble columna → Atentamente + firma Malio
// ============================================================
import pdfMake from 'pdfmake/build/pdfmake'
import * as pdfFonts from 'pdfmake/build/vfs_fonts'

pdfMake.vfs = pdfFonts.pdfMake?.vfs || pdfFonts.vfs || pdfFonts.default?.pdfMake?.vfs

// ============================================================
// COLORES — navy oscuro match del DOCX base
// ============================================================
const NAVY = '#1F3864'   // títulos: Propuesta Técnica, Propuesta Económica, T&C
const INK = '#1f2937'    // texto fuerte (header, "ROW Energy" portada)
const SLATE = '#475569'  // texto secundario (footer, sub-texto)
const BODY = '#374151'   // texto cuerpo párrafos
const LIGHT = '#f1f5f9'  // fondos suaves

const EMPRESA = {
  nombre: 'ROW Energy',
  direccion: 'Av. México 3040, piso 10, oficina 1003/1004, Residencial Juan Manuel, Gdl, Jalisco.',
  telefono: 'Tel: 33 1119 5553',
  web: 'https://www.ROWEnergy.com.mx',
  ciudad: 'Guadalajara, Jalisco',
}

// ============================================================
// TEXTO FIJO DEL TEMPLATE
// ============================================================
const TEXTO_QUIENES_SOMOS =
  'ROW Energy es una empresa especializada en ofrecer soluciones integrales para el ahorro y gestión de la energía, entre sus servicios se encuentra el desarrollo de proyectos de generación y la consultoría y gestoría con los órganos operadores y reguladores del sector energético en México para la interconexión y conexión de Centrales Eléctricas y Centros de Carga a las Redes Generales de Distribución y Red Nacional de Transmisión.'

const TEXTO_EQUIPO =
  'Contamos con un equipo de profesionistas especializados en la industria eléctrica mexicana, con los conocimientos y la formación necesaria para realizar con eficacia y eficiencia las actividades necesarias para cumplir eficazmente con el objetivo general de los proyectos.'

// 17 cláusulas literales del DOCX base
// `subitems` puede ser:
//   - array de strings → enumerados a, b, c... como sub-bullets simples
//   - array de objetos {titulo, texto} → "a. Forma de pago. Pago de..."
const TC_CLAUSULAS = [
  {
    titulo: 'Aceptación',
    texto: 'En caso de querer entablar una relación comercial, es necesario confirmar la cotización mediante la firma del representante legal y/o encargado del proyecto, consintiendo el contenido de la misma para proceder a la elaboración del contrato en base a los servicios anteriormente mencionados, aunado a un convenio de confidencialidad y la documentación necesaria para la celebración del mismo.',
  },
  {
    titulo: 'Inicio de servicio',
    texto: 'Para el inicio las actividades descritas en la propuesta técnica, es necesario tener el alta del cliente y contar con una OS (Orden de servicio).',
  },
  {
    titulo: 'Condiciones',
    texto: 'Condiciones generales por considerar en el contrato bilateral:',
    subitems: [
      'Las partes involucradas.',
      'Duración del contrato.',
      'Garantía de pago.',
      'Penalización por cancelación de contrato.',
      'Montos por viáticos.',
      'Subcontratación de servicios.',
      'Responsabilidades de las partes.',
      'Modificaciones al contrato.',
    ],
  },
  {
    titulo: 'Vigencia',
    texto: 'La vigencia de la oferta es de 30 días naturales. Nada del contenido en la presente oferta se considerará como vinculante por parte de ROW Energy a la Empresa.',
  },
  {
    titulo: 'Negociación',
    texto: 'La oferta está sujeta a discusión únicamente con Empresa por lo que cualquier acuerdo obligatorio entre ambas empresas sólo surgirían de la negociación y suscripción del contrato entre las partes.',
  },
  {
    titulo: 'Límites',
    texto: 'Las actividades mencionadas solamente son por gestoría y consultoría, no incluye equipos, pago de derechos, lo anterior es indicativo mas no limitativo.',
    subitems: [
      {
        titulo: 'Forma de pago',
        texto: 'Pago de un anticipo general del 50 por ciento, el 40% restante con a contra entrega de cada hito descrito en la cotización y el 10% restante del total a la entrega de la cartad y finalización de los servicios por parte de ROW Energy.',
      },
    ],
  },
  {
    titulo: 'Pago',
    texto: 'La presente cotización se considerará un título ejecutivo, por lo que el cliente se compromete a pagar incondicionalmente la cantidad acordada.',
  },
  {
    titulo: 'Literalidad',
    texto: 'Las actividades mencionadas en la cotización son indicativas mas no limitativas.',
  },
  {
    titulo: 'Servicios Profesionales',
    texto: 'ROW Energy prestará los servicios en el lugar, plazo y fecha (o fechas) acordadas por las partes, y que están expresamente designados en la presente Propuesta Técnica – Económica, Orden de Compra o cualquier otro documento debidamente firmado por representantes de ambas partes (en lo sucesivo se hará referencia como "OC" a cualquier documento de dicha naturaleza en que se describan las condiciones del Servicio).',
  },
  {
    titulo: 'Tarifas de Servicio y Condiciones de Pago',
    texto: 'El Cliente se compromete a abonar las tarifas que aparecen en la Propuesta Técnica – Económica y en las facturas presentadas por ROW Energy. Si una factura que no haya sido rechazada por el Cliente permanece impagada durante más de treinta (30), ROW Energy podrá suspender cualquier prestación de Servicios hasta el pago completo de la suma adeudada.',
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
    texto: 'Los gastos que se incurra para la prestación de los servicios ofertados se encuentran incluidos en el precio pactado. En caso hubiese gastos no contemplados en la propuesta y sean por alguna responsabilidad del cliente, ROW Energy valorizara dichos gastos añadiendo un 10% por gastos administrativos, para su posterior aprobación del cliente y facturación de este.',
  },
  {
    titulo: 'Confidencialidad',
    texto: 'Las Partes y sus empleados se abstendrán de divulgar, publicar o comunicar, directa o indirectamente a terceros la información, documentos o fotografías, relacionada con los negocios y operaciones de cada una de ellas, subordinadas o matrices, o de sus contratistas, que conozcan en virtud del negocio jurídico que se esté desarrollando y de la ejecución de los servicios o por cualquier otra causa. Para estos efectos, las Partes convienen que divulgar o transmitir cualquier información que reciban de la otra Parte (Información Confidencial) puede lesionar sus negocios o su reputación, inclusive será causal de terminación del acuerdo y de indemnización de los daños y perjuicios sufridos.',
  },
  {
    titulo: 'Garantía',
    texto: 'ROW Energy garantiza que la prestación de Servicios se llevará a cabo de manera eficiente y profesional. ROW Energy se compromete a prestar de nuevo el Servicio, sin costo alguno, en caso de que las fallas que reportasen los equipos a intervenir no sean por causas de mala operación por parte del cliente o factores externos a ROW Energy.',
  },
  {
    titulo: 'Autorizaciones legales',
    texto: 'El Cliente deberá obtener cualquier autorización necesaria y cumplir todas las leyes, reglamento y la normativa estatal y/o local en relación con todos los servicios, así como a la utilización de los servicios. Se incluyen a estos efectos, sin ánimo de exhaustividad, las leyes y reglamentos tales como la legislación laboral, medioambientales y de protección a consumidores y usuarios.',
  },
  {
    titulo: 'Fuerza mayor',
    texto: 'Las partes no serán responsables por los retrasos o incumplimientos de sus obligaciones (excluyendo las obligaciones de pago) cuando se deban a causas que escapen a su control, entre las que se incluyen sin ánimo de exhaustividad el dictado de normas estatales, los paros laborales, los fallos en el transporte o de proveedores, los incendios, casos de desobediencia civil, embargos, guerras, revueltas, ataques terroristas, terremotos, huelgas, epidemias, inundaciones, sucesos atmosféricos y otros eventos de similares características que, si se producen, ampliarán el plazo de que disponen las partes para ejecutar una OC.',
  },
]

const MESES_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

const LETRAS_ABC = 'abcdefghijklmnopqrstuvwxyz'

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

// Renderiza una sub-lista a) b) c)... (texto plano)
// Las líneas que empiezan con "- " o "• " se convierten a sub-items numerados con letra.
function descripcionAContenido(texto) {
  if (!texto || typeof texto !== 'string') return []
  const lineas = texto.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  if (lineas.length === 0) return []
  const sonBullets = lineas.length > 1 && lineas.every(l => /^[-•·*]\s+/.test(l))
  if (sonBullets) {
    return lineas.map((l, idx) => subItemLetra(idx, l.replace(/^[-•·*]\s+/, '')))
  }
  return [{ text: texto, fontSize: 10, color: BODY, lineHeight: 1.4, alignment: 'justify', margin: [22, 4, 0, 0] }]
}

function subItemLetra(idx, texto) {
  const letra = LETRAS_ABC[idx % LETRAS_ABC.length]
  return {
    columns: [
      { width: 22, text: `${letra})`, color: BODY, alignment: 'left', fontSize: 10, lineHeight: 1.4 },
      { text: texto, fontSize: 10, color: BODY, lineHeight: 1.4, alignment: 'justify' },
    ],
    columnGap: 0,
    margin: [12, 3, 0, 3],
  }
}

// ============================================================
// MAIN EXPORT
// ============================================================
export async function exportarCotizacionPDF(cot) {
  const items = (cot?.items || []).slice().sort((a, b) => (a.orden || 0) - (b.orden || 0))
  const moneda = cot?.moneda || 'MXN'

  const subtotal = items.reduce((s, it) => s + Number(it.total || 0), 0)

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
    ...(hero ? [{
      image: hero,
      width: 612,
      margin: [-50, -100, -50, 18],
    }] : []),

    // "ROW Energy" + fecha derecha
    {
      columns: [
        { text: 'ROW Energy', fontSize: 24, bold: true, color: INK },
        { text: fmtFechaCortaSlash(cot?.fecha_emision), fontSize: 10, color: SLATE, alignment: 'right', margin: [0, 12, 0, 0] },
      ],
      margin: [0, 0, 0, 8],
    },
    // Folio
    {
      text: cot?.codigo || '—',
      fontSize: 11,
      color: SLATE,
      margin: [0, 4, 0, 18],
    },
    // "Dirigida a:" en una línea
    {
      text: [
        { text: 'Dirigida a: ', fontSize: 11, bold: true, color: INK },
        { text: cot?.cliente?.razon_social || '—', fontSize: 11, color: INK },
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
          color: NAVY,
          margin: [0, i === 0 ? 8 : 14, 0, 6],
        },
        ...descripcionContent,
      ]
    }),
    ...(items.length === 0 ? [{ text: 'Sin servicios cotizados.', color: SLATE, italics: true }] : []),
  ]

  // ============================================================
  // PROPUESTA ECONÓMICA — tabla simple sin IVA (match DOCX base)
  // Columnas: N° / NOMBRE SERVICIO / CANTIDAD / PRECIO UNITARIO / SUBTOTAL
  // ============================================================
  const itemsTable = {
    table: {
      headerRows: 1,
      widths: [32, '*', 60, 90, 90],
      body: [
        [
          { text: 'N°', style: 'th', alignment: 'center' },
          { text: 'NOMBRE SERVICIO', style: 'th', alignment: 'center' },
          { text: 'CANTIDAD', style: 'th', alignment: 'center' },
          { text: 'PRECIO UNITARIO', style: 'th', alignment: 'center' },
          { text: 'SUBTOTAL', style: 'th', alignment: 'center' },
        ],
        ...items.map(it => [
          { text: String(it.orden ?? ''), alignment: 'center', color: BODY, fontSize: 10, margin: [0, 6, 0, 6] },
          { text: it.servicio || '', fontSize: 10, alignment: 'center', margin: [0, 6, 0, 6] },
          { text: String(it.cantidad ?? 1), alignment: 'center', fontSize: 10, margin: [0, 6, 0, 6] },
          { text: fmtMoney(it.precio_unitario, moneda), alignment: 'center', fontSize: 10, margin: [0, 6, 0, 6] },
          { text: fmtMoney(it.total, moneda), alignment: 'center', bold: true, fontSize: 10, margin: [0, 6, 0, 6] },
        ]),
      ],
    },
    layout: {
      hLineColor: () => '#cbd5e1',
      vLineColor: () => '#cbd5e1',
      hLineWidth: () => 0.7,
      vLineWidth: () => 0.7,
      fillColor: (rowIndex) => (rowIndex === 0 ? '#D9E1F2' : null),
      paddingTop: () => 4,
      paddingBottom: () => 4,
    },
  }

  const propuestaEconomica = [
    { text: 'Propuesta Económica', style: 'h2', margin: [0, 24, 0, 14] },
    itemsTable,
    ...(items.length === 0 ? [{ text: 'Sin servicios cotizados.', color: SLATE, fontSize: 10, italics: true, margin: [0, 8, 0, 0] }] : []),
  ]

  // ============================================================
  // T&C en doble columna — 17 cláusulas literales del DOCX base
  // ============================================================
  // Renderiza una cláusula (con su título bold y texto)
  const renderClausula = (c, num) => {
    const blocks = [
      {
        text: [
          { text: `${num}. ${c.titulo}. `, bold: true, color: INK },
          { text: c.texto || '', color: BODY },
        ],
        fontSize: 9,
        lineHeight: 1.35,
        alignment: 'justify',
        margin: [0, num === 1 ? 0 : 8, 0, 0],
      },
    ]
    if (c.subitems && c.subitems.length > 0) {
      c.subitems.forEach((sub, idx) => {
        const letra = LETRAS_ABC[idx % LETRAS_ABC.length]
        if (typeof sub === 'string') {
          blocks.push({
            columns: [
              { width: 18, text: `${letra}.`, color: BODY, fontSize: 9, lineHeight: 1.35 },
              { text: sub, fontSize: 9, color: BODY, lineHeight: 1.35, alignment: 'justify' },
            ],
            columnGap: 0,
            margin: [12, 2, 0, 0],
          })
        } else {
          // Objeto {titulo, texto}
          blocks.push({
            columns: [
              { width: 18, text: `${letra}.`, color: BODY, fontSize: 9, lineHeight: 1.35 },
              {
                text: [
                  { text: `${sub.titulo}. `, bold: true, color: INK },
                  { text: sub.texto || '', color: BODY },
                ],
                fontSize: 9,
                lineHeight: 1.35,
                alignment: 'justify',
              },
            ],
            columnGap: 0,
            margin: [12, 4, 0, 0],
          })
        }
      })
    }
    return blocks
  }

  // Reparto las 17 cláusulas en dos columnas balanceadas
  const tcMitad = Math.ceil(TC_CLAUSULAS.length / 2)
  const tcCol1 = TC_CLAUSULAS.slice(0, tcMitad)
  const tcCol2 = TC_CLAUSULAS.slice(tcMitad)
  const stack1 = tcCol1.flatMap((c, i) => renderClausula(c, i + 1))
  const stack2 = tcCol2.flatMap((c, i) => renderClausula(c, tcMitad + i + 1))

  const terminos = [
    { text: 'Términos y condiciones', style: 'h2', pageBreak: 'before', margin: [0, 4, 0, 12] },
    {
      columns: [
        { width: '*', stack: stack1 },
        { width: 14, text: '' },
        { width: '*', stack: stack2 },
      ],
      columnGap: 0,
    },
  ]

  // ============================================================
  // CIERRE — Atentamente + firma centrada
  // ============================================================
  const cierre = [
    { text: 'Atentamente', fontSize: 18, bold: true, alignment: 'center', color: INK, margin: [0, 28, 0, 14] },
    ...(firma ? [{ image: firma, width: 110, alignment: 'center', margin: [0, 0, 0, 4] }] : []),
    { canvas: [{ type: 'line', x1: 175, y1: 0, x2: 345, y2: 0, lineWidth: 0.7, lineColor: INK }] },
    { text: 'Malio Martínez Mariscal', fontSize: 11, bold: true, color: INK, alignment: 'center', margin: [0, 6, 0, 0] },
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
          : { text: 'ROW ENERGY', bold: true, fontSize: 12, color: INK },
        {
          alignment: 'right',
          stack: [
            { text: EMPRESA.nombre, fontSize: 11, bold: true, color: INK },
            { text: cot?.codigo || '—', fontSize: 10, color: INK },
            { text: fmtFechaTextoLargo(cot?.fecha_emision), fontSize: 10, color: INK },
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
  const footer = (currentPage) => {
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
            { text: String(currentPage - 1), fontSize: 9, color: INK, alignment: 'right', width: 30 },
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
    pageMargins: [50, 100, 50, 70],
    defaultStyle: { font: 'Roboto', fontSize: 10, color: INK, lineHeight: 1.35 },
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
      th: { color: INK, bold: true, fontSize: 9, characterSpacing: 0.5 },
      h2: { fontSize: 18, color: NAVY, margin: [0, 0, 0, 6] },
      h3: { fontSize: 12, bold: true, color: NAVY, margin: [0, 0, 0, 6] },
      parrafo: { fontSize: 10.5, color: BODY, lineHeight: 1.5, alignment: 'justify' },
    },
    header,
    footer,
  }

  pdfMake.createPdf(docDefinition).download(nombreArchivo(cot))
}
