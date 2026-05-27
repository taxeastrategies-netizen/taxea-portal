/**
 * Plazos oficiales AEAT / ATC para modelos fiscales
 * Fuente: AEAT - Calendario del contribuyente
 * Última revisión: 2025/2026
 *
 * PRESENTACIÓN TELEMÁTICA (fecha fin):
 *   T1: 20 de abril | T2: 20 de julio | T3: 20 de octubre | T4: 30 de enero (año siguiente)
 *
 * DOMICILIACIÓN BANCARIA (el cargo se efectúa el último día del plazo):
 *   T1: 15 de abril | T2: 15 de julio | T3: 15 de octubre | T4: 25 de enero (año siguiente)
 *   (La domiciliación debe ordenarse antes del último día hábil del plazo de dom.)
 *
 * NRC / PAGO CON NÚMERO DE REFERENCIA COMPLETO:
 *   Mismo plazo que presentación telemática (obtener NRC en banco antes del último día)
 *
 * MODELOS ANUALES:
 *   390, 425: 1-30 de enero del año siguiente
 *   190, 180, 193: 1-31 de enero del año siguiente
 *   347, 415: 1-28 de febrero del año siguiente
 */

// Offset de días para alerta previa interna (gestión interna del asesor)
export const DIAS_AVISO_INTERNO = 7;

/**
 * Devuelve las fechas límite para un periodo dado de un modelo
 * @param {string} modeloCodigo - p.e. '303', '111'
 * @param {string} periodo - 'T1','T2','T3','T4','Anual','01'..'12'
 * @param {number} ejercicio - año fiscal
 * @returns {{ presentacion: string, domiciliacion: string, nrc: string, limiteInterno: string }}
 */
export function getDeadlines(modeloCodigo, periodo, ejercicio) {
  const anioSig = ejercicio + 1;

  // Modelos anuales
  const modelosAnuales390 = ['390', '425'];
  const modelosAnuales190 = ['190', '180', '193'];
  const modelosAnuales347 = ['347', '415'];

  if (modelosAnuales390.includes(modeloCodigo)) {
    return {
      presentacion: `${anioSig}-01-30`,
      domiciliacion: `${anioSig}-01-25`,
      nrc: `${anioSig}-01-30`,
      limiteInterno: `${anioSig}-01-23`,
      label: `Anual ${ejercicio}`,
    };
  }
  if (modelosAnuales190.includes(modeloCodigo)) {
    return {
      presentacion: `${anioSig}-01-31`,
      domiciliacion: `${anioSig}-01-27`,
      nrc: `${anioSig}-01-31`,
      limiteInterno: `${anioSig}-01-24`,
      label: `Anual ${ejercicio}`,
    };
  }
  if (modelosAnuales347.includes(modeloCodigo)) {
    return {
      presentacion: `${anioSig}-02-28`,
      domiciliacion: `${anioSig}-02-23`,
      nrc: `${anioSig}-02-28`,
      limiteInterno: `${anioSig}-02-21`,
      label: `Anual ${ejercicio}`,
    };
  }

  // Modelos trimestrales (303, 111, 115, 123, 130, 349, 420)
  const trimDeadlines = {
    T1: { presentacion: `${ejercicio}-04-20`, domiciliacion: `${ejercicio}-04-15`, nrc: `${ejercicio}-04-20`, limiteInterno: `${ejercicio}-04-13` },
    T2: { presentacion: `${ejercicio}-07-20`, domiciliacion: `${ejercicio}-07-15`, nrc: `${ejercicio}-07-20`, limiteInterno: `${ejercicio}-07-13` },
    T3: { presentacion: `${ejercicio}-10-20`, domiciliacion: `${ejercicio}-10-15`, nrc: `${ejercicio}-10-20`, limiteInterno: `${ejercicio}-10-13` },
    T4: { presentacion: `${anioSig}-01-30`, domiciliacion: `${anioSig}-01-25`, nrc: `${anioSig}-01-30`, limiteInterno: `${anioSig}-01-23` },
  };

  if (trimDeadlines[periodo]) {
    return { ...trimDeadlines[periodo], label: `${periodo} ${ejercicio}` };
  }

  // Mensuales (formato '01'-'12')
  const mesNum = parseInt(periodo, 10);
  if (!isNaN(mesNum)) {
    const mesStr = String(mesNum + 1).padStart(2, '0');
    const anioMes = mesNum === 12 ? anioSig : ejercicio;
    const mesFin = mesNum === 12 ? '01' : mesStr;
    return {
      presentacion: `${anioMes}-${mesFin}-20`,
      domiciliacion: `${anioMes}-${mesFin}-15`,
      nrc: `${anioMes}-${mesFin}-20`,
      limiteInterno: `${anioMes}-${mesFin}-13`,
      label: `M${periodo} ${ejercicio}`,
    };
  }

  return null;
}

/**
 * Genera todos los periodos aplicables para un modelo en un ejercicio
 */
export function getPeriodosDelModelo(modeloCodigo, ejercicio) {
  const modelosAnuales = ['390', '190', '180', '193', '347', '415', '425'];
  if (modelosAnuales.includes(modeloCodigo)) {
    const dl = getDeadlines(modeloCodigo, 'Anual', ejercicio);
    return [{ periodo: 'Anual', ejercicio, ...dl }];
  }
  return ['T1', 'T2', 'T3', 'T4'].map(p => ({
    periodo: p,
    ejercicio,
    ...getDeadlines(modeloCodigo, p, ejercicio),
  }));
}

/**
 * Mapa de trimestre a periodo label para Invoice entity
 */
export const TRIMESTRE_A_PERIODO = { T1: 'T1', T2: 'T2', T3: 'T3', T4: 'T4' };

/**
 * Dado un mes (1-12), retorna el trimestre
 */
export function mesATrimestreLabel(mes) {
  if (mes <= 3) return 'T1';
  if (mes <= 6) return 'T2';
  if (mes <= 9) return 'T3';
  return 'T4';
}