/**
 * Generador de mensajes WhatsApp premium — Taxea Strategies
 * Estilo: asesor de alto nivel, banca privada, fintech premium
 */

const MODELO_NOMBRES_CORTOS = {
  modelo_303: 'Modelo 303 (IVA)',
  modelo_390: 'Modelo 390 (Resumen IVA)',
  modelo_130: 'Modelo 130 (Pago Fraccionado IRPF)',
  modelo_111: 'Modelo 111 (Retenciones IRPF)',
  modelo_115: 'Modelo 115 (Retenciones Arrendamientos)',
  modelo_202: 'Modelo 202 (Pago Fraccionado Sociedades)',
  modelo_200: 'Modelo 200 (Impuesto de Sociedades)',
  modelo_349: 'Modelo 349 (Operaciones Intracomunitarias)',
  modelo_420_igic: 'Modelo 420 (IGIC)',
  modelo_425_igic: 'Modelo 425 (Resumen IGIC)',
  renta: 'Declaración de la Renta',
  cuentas_anuales: 'Cuentas Anuales',
  libros_contables: 'Libros Contables',
  otra: 'Declaración Fiscal',
};

function formatEuro(amount) {
  if (!amount && amount !== 0) return null;
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount);
}

function getLineaPago(ex) {
  if (ex.nrc) {
    return `Forma de pago: NRC — Importe ya abonado`;
  }
  if (ex.resultado === 'a_devolver') {
    return `Resultado: A devolver por la AEAT`;
  }
  if (!ex.importe || ex.importe === 0) {
    return `Resultado: Sin importe a ingresar`;
  }
  const imp = formatEuro(ex.importe);
  return `Forma de pago: Domiciliación bancaria${imp ? `\nImporte: ${imp}` : ''}`;
}

function getLineaAccion(ex) {
  if (ex.nrc) {
    return `El importe ya ha sido abonado mediante NRC bancario. No es necesaria ninguna acción adicional.`;
  }
  if (ex.resultado === 'a_devolver') {
    return `La AEAT iniciará el proceso de devolución en los plazos establecidos. No es necesaria ninguna acción por tu parte.`;
  }
  if (!ex.importe || ex.importe === 0) {
    return `La declaración ha sido presentada sin importe. No es necesaria ninguna acción adicional.`;
  }
  return `El importe será cargado automáticamente por la Agencia Tributaria. No es necesaria ninguna acción por tu parte.`;
}

/**
 * Mensaje individual para un modelo
 */
export function generarMensajeWhatsApp({ nombreCliente, modeloKey, ejercicio, periodo, importe, csv, nrc, resultado, portalUrl }) {
  const modelo = MODELO_NOMBRES_CORTOS[modeloKey] || (modeloKey || 'Declaración').replace(/_/g, ' ');
  const portal = portalUrl || 'https://portal.taxea.es';
  const ex = { importe, csv, nrc, resultado };
  const lineaPago = getLineaPago(ex);
  const lineaAccion = getLineaAccion(ex);
  const nombre = nombreCliente ? nombreCliente.split(' ')[0] : 'cliente';

  const lineasDetalle = [
    `• Modelo: ${modelo}`,
    ejercicio && periodo ? `• Período: ${periodo} ${ejercicio}` : ejercicio ? `• Ejercicio: ${ejercicio}` : periodo ? `• Período: ${periodo}` : null,
    `• ${lineaPago}`,
    `• Estado: ✅ Presentado correctamente`,
  ].filter(Boolean).join('\n');

  return `Hola ${nombre},

Te confirmamos que ya hemos presentado correctamente tu declaración fiscal ante la Administración Tributaria.

${lineasDetalle}

${lineaAccion}

Tanto el justificante oficial como el detalle completo ya están disponibles en tu área privada de Taxea Portal:
${portal}/obligaciones

Además, te hemos enviado un correo electrónico con toda la información detallada y el justificante oficial de presentación.

Un saludo,
Alexis Expósito Acosta
CEO — Taxea Strategies`;
}

/**
 * Mensaje agrupado para varios modelos del mismo cliente
 */
export function generarMensajeWhatsAppAgrupado({ nombreCliente, modelos, portalUrl }) {
  const portal = portalUrl || 'https://portal.taxea.es';
  const nombre = nombreCliente ? nombreCliente.split(' ')[0] : 'cliente';

  const lineasModelos = modelos.map(m => {
    const label = MODELO_NOMBRES_CORTOS[m.modeloKey] || (m.modeloKey || 'Declaración').replace(/_/g, ' ');
    const periodo = [m.periodo, m.ejercicio].filter(Boolean).join(' ');
    return `✅ ${label}${periodo ? ` — ${periodo}` : ''}`;
  }).join('\n');

  return `Hola ${nombre},

Hoy hemos actualizado varias obligaciones fiscales en tu portal. Tu situación tributaria se encuentra completamente al día.

${lineasModelos}

Toda la documentación y justificantes oficiales ya se encuentran disponibles en tu área privada:
${portal}/obligaciones

Además, te hemos enviado un correo electrónico con el detalle completo de cada presentación.

Un saludo,
Alexis Expósito Acosta
CEO — Taxea Strategies`;
}

/**
 * Formatea número de teléfono a formato internacional E.164
 * Asume España (+34) si no tiene prefijo
 */
export function formatearTelefono(tel) {
  if (!tel) return null;
  const limpio = tel.replace(/\s+/g, '').replace(/-/g, '').replace(/\./g, '');
  if (limpio.startsWith('+')) return limpio;
  if (limpio.startsWith('00')) return '+' + limpio.slice(2);
  // Asumir España
  if (limpio.length === 9 && /^[67]/.test(limpio)) return '+34' + limpio;
  return '+34' + limpio;
}