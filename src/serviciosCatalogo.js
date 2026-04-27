// ============================================================
// serviciosCatalogo.js — v15.6.0
// Catálogo de servicios estándar de Row Energy con descripciones
// técnicas oficiales (bullets que aparecen en cotizaciones).
//
// Origen de los datos: PRECIOS AMPERE.xlsx (nombres) + COTIZACIÓN BASE CC.docx (bullets).
//
// El catálogo vive en código (no en BD) — para actualizar nombres,
// descripciones o agregar servicios, edita este archivo y haz commit.
// El pricing por capacidad MW vendrá en v15.7 (engine completo).
// ============================================================

export const TIPOS_SERVICIO = {
  CC: 'Centros de Carga',
  CE: 'Centrales Eléctricas',
  AMBOS: 'Ambos',
}

// Cada entrada:
// - id: clave única (slug)
// - nombre: como aparece en la cotización (oficial)
// - tipo: CC | CE | AMBOS
// - descripcion: prosa o bullets pre-formateados (con "- " al inicio para que el PDF los renderice como lista)
export const SERVICIOS_CATALOGO = [
  {
    id: 'estudio-impacto-ampere',
    nombre: 'Estudio de Impacto Ampere',
    tipo: 'AMBOS',
    descripcion: [
      '- Elaboración o revisión del Anexo IV del Manual para la Interconexión y Conexión.',
      '- Diagrama geográfico, unifilar y detallado.',
      '- Características de la carga instalada y perfiles de carga.',
      '- Características de los transformadores y de la línea de conexión.',
      '- Características de los circuitos de media tensión.',
      '- Información de calidad de la potencia y carta de uso de modelos genéricos.',
      '- Elementos de compensación.',
      '- Gestión para la elaboración del Anexo IIIB del Manual de Conexión de Centros de Carga.',
      '- Aplicación de la normativa del Manual para la Interconexión a lo largo del proceso de Estudios.',
      '- Integración y envío de información al CENACE (vía SIASIC) para el estudio de conexión.',
      '- Gestión de pagos para los estudios por SIASIC.',
      '- Atención de requerimientos de información del CENACE.',
      '- Seguimiento al proceso de estudios de conexión para minimizar tiempos.',
      '- Trámites, consultas, aclaraciones y diligencias con el CENACE a nombre del solicitante.',
      '- Participación en reuniones con el CENACE y con el solicitante.',
    ].join('\n'),
  },
  {
    id: 'impacto-version-rapida',
    nombre: 'Impacto versión rápida',
    tipo: 'CE',
    descripcion: [
      '- Elaboración acelerada del Anexo IV con alcance reducido.',
      '- Diagramas geográfico, unifilar y de protecciones.',
      '- Información de calidad de potencia y modelos genéricos.',
      '- Atención básica de requerimientos del CENACE.',
    ].join('\n'),
  },
  {
    id: 'estudio-indicativo-ampere',
    nombre: 'Estudio de indicativo Ampere',
    tipo: 'CE',
    descripcion: [
      '- Pre-evaluación técnica del proyecto antes del estudio formal.',
      '- Análisis preliminar de capacidad disponible en el punto de interconexión.',
      '- Estimación de tiempos y costos del proceso completo.',
    ].join('\n'),
  },
  {
    id: 'estudio-rapido-ampere',
    nombre: 'Estudio rápido Ampere',
    tipo: 'AMBOS',
    descripcion: [
      '- Variante simplificada del estudio formal cuando el cliente requiere validación temprana.',
      '- Diagrama unifilar y caracterización básica.',
      '- Soporte ante CENACE para acreditar viabilidad inicial.',
    ].join('\n'),
  },
  {
    id: 'estudio-instalaciones-ampere',
    nombre: 'Estudio de Instalaciones Ampere',
    tipo: 'AMBOS',
    descripcion: [
      '- Elaboración, integración y envío al CENACE (vía SIASIC) del estudio de instalaciones.',
      '- Gestión de pagos para los estudios por SIASIC.',
      '- Atención a requerimientos de información del CENACE.',
      '- Aplicación de la normativa del Manual para la Interconexión.',
      '- Trámites, consultas y aclaraciones con el CENACE.',
      '- Participación en reuniones con CENACE y con el solicitante.',
    ].join('\n'),
  },
  {
    id: 'contrato-conexion-ampere',
    nombre: 'Contrato de Conexión Ampere',
    tipo: 'CC',
    descripcion: [
      '- Integración, revisión, carga y envío de información para la solicitud del contrato por SIASIC.',
      '- Cálculo de garantías financieras y entrega del borrador del formato de Carta de Crédito Stand By.',
      '- Elaboración del borrador del Escrito de Aceptación de los Estudios de Conexión.',
      '- Gestión y asesoramiento para la comprobación de posesión del predio.',
      '- Propuesta de programa de trabajo para construcción de obras de conexión y refuerzo.',
      '- Atención a observaciones del CENACE para la aceptación de la solicitud.',
      '- Seguimiento a tiempos del Manual de Interconexión para evitar pérdida de vigencia.',
      '- Integración de información solicitada por CFE Transmisión / Distribución.',
      '- Elaboración de escritos de compromiso (construcción de obras y sistema de medición).',
    ].join('\n'),
  },
  {
    id: 'contrato-interconexion-ampere',
    nombre: 'Contrato de Interconexión Ampere',
    tipo: 'CE',
    descripcion: [
      '- Misma gestión que Contrato de Conexión pero aplicado a Centrales Eléctricas.',
      '- Coordinación con CENACE para la formalización del Contrato de Interconexión.',
      '- Integración con CFE Transmisión / Distribución según corresponda.',
      '- Programa de trabajo de obras de conexión y refuerzo asociadas.',
    ].join('\n'),
  },
  {
    id: 'anexo-1-poc',
    nombre: 'Anexo 1 del POC (Puesta en Servicio de la CE)',
    tipo: 'CE',
    descripcion: [
      '- Gestión de la entrega de requerimientos para la Puesta en Servicio antes de la energización.',
      '- Elaboración y entrega del escrito del titular para la nomenclatura oficial ante la GCR.',
      '- Diagrama geográfico, unifilar de protecciones e ingeniería básica de subestación aprobada por CFE.',
      '- Seguimiento al registro en SAPPSE por personal autorizado por la GCR.',
      '- Coordinación de personal operativo acreditado y contactos para licencias.',
      '- Procedimiento de Interacción Operativa firmado por el solicitante.',
      '- Programa de energización y solicitudes de licencias asociadas.',
    ].join('\n'),
  },
  {
    id: 'anexo-2-poc',
    nombre: 'Anexo 2 del POC',
    tipo: 'AMBOS',
    descripcion: [
      '- Entrega de parámetros de equipos instalados en campo (Anexo IV del Manual).',
      '- Validación de modelos vs comportamiento real registrado en pruebas.',
      '- Atención a requerimientos del CENACE para cierre del POC.',
    ].join('\n'),
  },
  {
    id: 'sappse',
    nombre: 'SAPPSE',
    tipo: 'AMBOS',
    descripcion: [
      '- Registro y gestión en el Sistema de Administración del Proceso para Puesta en Servicio de Equipo.',
      '- Coordinación con personal autorizado por la Gerencia de Control Regional.',
      '- Cumplimiento del Manual de Requerimientos de TIC del SEN y MEM.',
    ].join('\n'),
  },
  {
    id: 'modelado-psse',
    nombre: 'Modelado en PSSE',
    tipo: 'CE',
    descripcion: [
      '- Modelado dinámico de la Central Eléctrica en PSS®E.',
      '- Construcción del modelo electromecánico para análisis de estabilidad.',
      '- Entrega de archivo .dyr y .raw conforme al estándar CENACE.',
    ].join('\n'),
  },
  {
    id: 'modelado-emtp',
    nombre: 'Modelado en EMTP',
    tipo: 'CE',
    descripcion: [
      '- Modelado electromagnético en EMTP-RV.',
      '- Análisis de transitorios electromagnéticos y respuesta ante fallas.',
      '- Entrega de modelo conforme al estándar CENACE.',
    ].join('\n'),
  },
  {
    id: 'validacion-modelos-psse',
    nombre: 'Validación de modelos en PSSE',
    tipo: 'CE',
    descripcion: [
      '- Validación del modelo PSS®E contra mediciones reales de pruebas.',
      '- Ajuste de parámetros para reproducir comportamiento medido.',
      '- Reporte de validación conforme a Código de Red.',
    ].join('\n'),
  },
  {
    id: 'validacion-modelos-emtp',
    nombre: 'Validación de modelos en EMTP',
    tipo: 'CE',
    descripcion: [
      '- Validación del modelo EMTP contra registros de pruebas.',
      '- Calibración de parámetros electromagnéticos.',
      '- Reporte conforme a Código de Red.',
    ].join('\n'),
  },
  {
    id: 'estudios-calidad-energia',
    nombre: 'Estudios de calidad de la energía',
    tipo: 'AMBOS',
    descripcion: [
      '- Mediciones de calidad de potencia (armónicos, flicker, desbalance, hueco de tensión).',
      '- Cumplimiento de los límites del Código de Red y NOM-001-SEDE.',
      '- Reporte con propuestas de mitigación si aplica.',
    ].join('\n'),
  },
  {
    id: 'pruebas-ce',
    nombre: 'Pruebas de la CE',
    tipo: 'CE',
    descripcion: [
      '- Coordinación de pruebas de comportamiento de la Central Eléctrica.',
      '- Pruebas de regulación de tensión, frecuencia, potencia reactiva.',
      '- Reporte conforme a requerimientos del CENACE.',
    ].join('\n'),
  },
  {
    id: 'primera-energizacion',
    nombre: 'Primera energización',
    tipo: 'CE',
    descripcion: [
      '- Coordinación con CENACE y CFE para la primera energización de la CE.',
      '- Programa de energización y solicitudes de licencias.',
      '- Acompañamiento operativo durante la maniobra.',
    ].join('\n'),
  },
  {
    id: 'pruebas-comportamiento-asincronas',
    nombre: 'Pruebas de comportamiento de la CE (Asíncronas)',
    tipo: 'CE',
    descripcion: [
      '- Pruebas de comportamiento aplicables a centrales asíncronas (eólica, fotovoltaica).',
      '- Validación de respuesta ante perturbaciones según Código de Red.',
      '- Reporte de cumplimiento.',
    ].join('\n'),
  },
  {
    id: 'codigo-red-asincronas',
    nombre: 'Código de Red de la CE (Asíncronas)',
    tipo: 'CE',
    descripcion: [
      '- Cumplimiento integral del Código de Red para centrales asíncronas.',
      '- Documentación técnica y reportes de pruebas.',
      '- Acompañamiento ante CENACE.',
    ].join('\n'),
  },
  {
    id: 'permiso-generacion',
    nombre: 'Permiso de Generación',
    tipo: 'CE',
    descripcion: [
      '- Trámite del Permiso de Generación ante la CRE.',
      '- Integración de la información técnica, legal y financiera requerida.',
      '- Atención de prevenciones y requerimientos.',
      '- Seguimiento hasta la emisión del permiso.',
    ].join('\n'),
  },
  {
    id: 'operacion-comercial',
    nombre: 'Operación comercial',
    tipo: 'CE',
    descripcion: [
      '- Gestión integral de la Declaración de Operación Comercial.',
      '- Coordinación con CENACE para el alta como Participante del Mercado.',
      '- Soporte en pruebas y entregables finales.',
    ].join('\n'),
  },
  {
    id: 'elaboracion-diagramas-detallados',
    nombre: 'Elaboración de Diagramas Detallados',
    tipo: 'AMBOS',
    descripcion: [
      '- Diagrama geográfico, unifilar y de protecciones a detalle.',
      '- Cumplimiento del estándar CENACE para entrega de diagramas.',
      '- Entrega en formato editable y PDF.',
    ].join('\n'),
  },
]

// Helper: busca un servicio por id o por nombre exacto
export function buscarServicio(idONombre) {
  return SERVICIOS_CATALOGO.find(s => s.id === idONombre || s.nombre === idONombre)
}
