/**
 * ReportEngine V5 — Motor de cálculo financiero completo
 * Calcula todos los ratios aplicables según datos disponibles.
 * Principio: nunca inventar. Si falta dato, marcar como NO_CALCULABLE.
 */

export const NO_CALC = null;
export const SOURCE = {
  EXTRAIDO: 'dato_extraido',
  CALCULADO: 'dato_calculado',
  ESTIMACION: 'estimacion',
  SUPUESTO: 'supuesto_usuario',
  NO_DISPONIBLE: 'no_disponible',
};

// ── Formateadores ─────────────────────────────────────────────────────────────
export const fmtEUR = (n, decimals = 0) =>
  typeof n === 'number'
    ? new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: decimals, minimumFractionDigits: decimals }).format(n)
    : '—';

export const fmtPct = (n, d = 1) =>
  typeof n === 'number' ? `${n.toFixed(d)}%` : '—';

export const fmtX = (n, d = 2) =>
  typeof n === 'number' ? `${n.toFixed(d)}x` : '—';

// ── Semáforo ──────────────────────────────────────────────────────────────────
export function semaforo(value, thresholds) {
  // thresholds: { verde: [min, max], ambar: [min, max] }
  if (value === null || value === undefined) return 'gris';
  if (thresholds.verde) {
    const [lo, hi] = thresholds.verde;
    if (value >= lo && (hi === null || value <= hi)) return 'verde';
  }
  if (thresholds.ambar) {
    const [lo, hi] = thresholds.ambar;
    if (value >= lo && (hi === null || value <= hi)) return 'ambar';
  }
  return 'rojo';
}

// ── Extractor de cuentas PGC ──────────────────────────────────────────────────
export function sumCuentas(cuentas, prefixes) {
  if (!cuentas?.length) return 0;
  return cuentas
    .filter(c => !c.excluida && prefixes.some(p => String(c.cuenta || '').startsWith(p)))
    .reduce((s, c) => s + (c.importe_actual || 0), 0);
}

// ── Deuda financiera (PGC) ────────────────────────────────────────────────────
export function calcDeudaFinanciera(cuentas) {
  const largo = Math.abs(sumCuentas(cuentas, ['170', '171', '172', '173', '174', '175', '176', '177', '178', '179']));
  const corto = Math.abs(sumCuentas(cuentas, ['520', '521', '522', '523', '524', '525', '526', '527', '528', '529']));
  return { largo, corto, total: largo + corto };
}

// ── Motor principal ───────────────────────────────────────────────────────────
export function calcularMetricas(imp, supuestos = {}) {
  const m = imp?.metricas_calculadas || {};
  const balance = m.balance || {};
  const pyg = m.pyg || {};
  const cuentas = m.cuentas || [];
  const hasPyG = pyg.ingresos > 0;
  const hasBalance = balance.totalActivo > 0;

  // ── Balance ─────────────────────────────────────────────────────────────────
  const totalActivo = balance.totalActivo || 0;
  const patrimonioNeto = balance.patrimonioNeto || 0;
  const activoCorriente = balance.activoCorriente || 0;
  const activoNoCorriente = totalActivo - activoCorriente;
  const pasivoCorriente = balance.pasivoCorriente || 0;
  const pasivoNoCorriente = balance.pasivoNoCorriente || 0;
  const totalPasivo = pasivoCorriente + pasivoNoCorriente;

  // ── PyG ──────────────────────────────────────────────────────────────────────
  const ingresos = pyg.ingresos || 0;
  const gastos = pyg.gastos || 0;
  const resultado = pyg.resultado || 0;
  const ebitda = pyg.ebitda || 0;
  const amortizacion = pyg.amortizacion || 0;
  const personalGasto = Math.abs(sumCuentas(cuentas, ['640', '641', '642', '643', '644', '645', '646', '647', '648']));
  const serviciosGasto = Math.abs(sumCuentas(cuentas, ['620', '621', '622', '623', '624', '625', '626', '627', '628', '629']));
  const gastoFinanciero = Math.abs(sumCuentas(cuentas, ['660', '661', '662', '663', '664', '665', '666', '667', '668', '669']));

  // ── Tesorería ────────────────────────────────────────────────────────────────
  const tesoreria = Math.abs(sumCuentas(cuentas, ['570', '571', '572', '573', '574', '575']));
  const tesoreriaFinal = tesoreria || supuestos.tesoreria || 0;

  // ── Deuda financiera ─────────────────────────────────────────────────────────
  const deuda = calcDeudaFinanciera(cuentas);
  const deudaFinancieraTotal = deuda.total > 0 ? deuda.total : (supuestos.deudaFinanciera || 0);
  const deudaFinancieraNeta = deudaFinancieraTotal - tesoreriaFinal;

  // ── Fondo de maniobra ────────────────────────────────────────────────────────
  const fondoManiobra = activoCorriente - pasivoCorriente;

  // ── Clientes / Proveedores ───────────────────────────────────────────────────
  const clientes = Math.abs(sumCuentas(cuentas, ['430', '431', '432', '433', '434', '435', '436']));
  const proveedores = Math.abs(sumCuentas(cuentas, ['400', '401', '402', '403', '404', '405']));
  const existencias = Math.abs(sumCuentas(cuentas, ['300', '301', '302', '310', '320', '330', '340', '350', '360', '390']));

  // ── Burn rate & runway ───────────────────────────────────────────────────────
  const gastosOperativosMes = supuestos.gastosMensuales || (hasPyG ? gastos / 12 : null);
  const ingresosMes = supuestos.ingresosMensuales || (hasPyG ? ingresos / 12 : null);
  const burnRateBruto = gastosOperativosMes;
  const burnRateNeto = gastosOperativosMes && ingresosMes ? gastosOperativosMes - ingresosMes : null;
  const runwayBruto = burnRateBruto > 0 ? tesoreriaFinal / burnRateBruto : null;
  const runwayNeto = burnRateNeto > 0 ? tesoreriaFinal / burnRateNeto : null;
  const runwaySource = supuestos.gastosMensuales ? SOURCE.SUPUESTO : hasPyG ? SOURCE.CALCULADO : SOURCE.NO_DISPONIBLE;

  // Escenarios runway
  const runwayEscenarioTension = burnRateBruto > 0 ? tesoreriaFinal / (burnRateBruto * 1.2) : null;
  const runwayEscenarioEstres = burnRateBruto > 0 ? tesoreriaFinal / (burnRateBruto * 1.5) : null;

  // ── RATIOS ───────────────────────────────────────────────────────────────────

  // Liquidez
  const ratioLiquidez = hasBalance && pasivoCorriente > 0 ? activoCorriente / pasivoCorriente : null;
  const pruebaAcida = hasBalance && pasivoCorriente > 0 ? (activoCorriente - existencias) / pasivoCorriente : null;
  const liquidezInmediata = hasBalance && pasivoCorriente > 0 ? tesoreriaFinal / pasivoCorriente : null;
  const tesoreriaOverActivo = hasBalance && totalActivo > 0 ? tesoreriaFinal / totalActivo : null;
  const coberturaMeses = burnRateBruto > 0 ? tesoreriaFinal / burnRateBruto : null;

  // Endeudamiento
  const autonomia = hasBalance && totalActivo > 0 ? patrimonioNeto / totalActivo : null;
  const endeudamiento = hasBalance && patrimonioNeto > 0 ? totalPasivo / patrimonioNeto : null;
  const solvencia = hasBalance && totalPasivo > 0 ? totalActivo / totalPasivo : null;
  const deudaFinancieraRatio = hasBalance && totalActivo > 0 ? deudaFinancieraTotal / totalActivo : null;
  const deudaNetaEbitda = ebitda > 0 ? deudaFinancieraNeta / ebitda : null;
  const coberturaIntereses = gastoFinanciero > 0 && ebitda > 0 ? ebitda / gastoFinanciero : null;
  const pasivoCorrientePct = totalPasivo > 0 ? pasivoCorriente / totalPasivo : null;

  // Rentabilidad
  const margenBruto = hasPyG && ingresos > 0 ? (ingresos - Math.abs(sumCuentas(cuentas, ['600', '601', '602', '607', '608']))) / ingresos : null;
  const margenEBITDA = hasPyG && ingresos > 0 ? ebitda / ingresos : null;
  const margenNeto = hasPyG && ingresos > 0 ? resultado / ingresos : null;
  const margenExplotacion = hasPyG && ingresos > 0 ? (ingresos - gastos) / ingresos : null;
  const roa = hasBalance && hasPyG && totalActivo > 0 ? resultado / totalActivo : null;
  const roe = hasBalance && hasPyG && patrimonioNeto > 0 ? resultado / patrimonioNeto : null;
  const pesPersonal = hasPyG && ingresos > 0 ? personalGasto / ingresos : null;
  const pesServicios = hasPyG && ingresos > 0 ? serviciosGasto / ingresos : null;
  const pesGastoFinanciero = hasPyG && ingresos > 0 ? gastoFinanciero / ingresos : null;

  // Cashflow contable (solo si hay PyG)
  const cashflowContable = hasPyG ? resultado + amortizacion : null;
  const cashflowSource = hasPyG ? SOURCE.CALCULADO : SOURCE.NO_DISPONIBLE;

  // ── M&A ───────────────────────────────────────────────────────────────────────
  const ebitdaAjustado = supuestos.ajustesEbitda ? ebitda + supuestos.ajustesEbitda : null;
  const ebitdaBase = ebitdaAjustado || ebitda;
  const calidad_ingresos = !hasPyG ? 'no_evaluable' : ingresos > 0 && resultado > 0 ? 'aparentemente_positiva' : 'revisar';
  const posicionCFDF = `Caja: ${fmtEUR(tesoreriaFinal)} / Deuda financiera: ${fmtEUR(deudaFinancieraTotal)} / DFN: ${fmtEUR(deudaFinancieraNeta)}`;

  // Calidad contable
  const descuadre = !balance.cuadra && totalActivo > 0;
  const cuentasSinClasificar = cuentas.filter(c => !c.masa || c.masa === 'sin_clasificar').length;
  const saldosNegativos = cuentas.filter(c => {
    const isActivo = ['activo_corriente', 'activo_no_corriente'].includes(c.masa);
    return isActivo && c.importe_actual < 0;
  }).length;
  const pendientesRevision = cuentas.filter(c => c.estado === 'pendiente_revision').length;

  let calidadScore = 100;
  if (descuadre) calidadScore -= 40;
  if (cuentasSinClasificar > 5) calidadScore -= 15;
  if (saldosNegativos > 0) calidadScore -= 15;
  if (pendientesRevision > 3) calidadScore -= 10;
  if (!hasPyG) calidadScore -= 20;

  const calidadLabel =
    calidadScore >= 80 ? 'Alta' :
    calidadScore >= 60 ? 'Razonable con puntos de revisión' :
    calidadScore >= 40 ? 'Limitada' : 'No evaluable';

  return {
    // Meta
    hasBalance, hasPyG,
    ejercicio: imp?.periodo_fin?.substring(0, 4) || '—',
    empresa: imp?.empresa_nombre || '—',
    origen: imp?.origen || '—',
    confianza: m.confianza_media,

    // Balance
    totalActivo, patrimonioNeto, activoCorriente, activoNoCorriente,
    pasivoCorriente, pasivoNoCorriente, totalPasivo,
    fondoManiobra, tesoreria: tesoreriaFinal,
    clientes, proveedores, existencias,
    balanceCuadra: balance.cuadra,
    diferencia: balance.diferencia,

    // PyG
    ingresos, gastos, resultado, ebitda, amortizacion,
    personalGasto, serviciosGasto, gastoFinanciero,

    // Deuda
    deudaFinancieraCp: deuda.corto,
    deudaFinancieraLp: deuda.largo,
    deudaFinancieraTotal,
    deudaFinancieraNeta,

    // Burn rate & runway
    gastosOperativosMes, ingresosMes,
    burnRateBruto, burnRateNeto,
    runwayBruto, runwayNeto, runwaySource,
    runwayEscenarioTension, runwayEscenarioEstres,

    // Ratios liquidez
    ratioLiquidez, pruebaAcida, liquidezInmediata,
    tesoreriaOverActivo, coberturaMeses,

    // Ratios endeudamiento
    autonomia, endeudamiento, solvencia,
    deudaFinancieraRatio, deudaNetaEbitda, coberturaIntereses, pasivoCorrientePct,

    // Ratios rentabilidad
    margenBruto, margenEBITDA, margenNeto, margenExplotacion,
    roa, roe, pesPersonal, pesServicios, pesGastoFinanciero,

    // Cashflow
    cashflowContable, cashflowSource,

    // M&A
    ebitdaAjustado, ebitdaBase, calidad_ingresos, posicionCFDF,

    // Calidad contable
    descuadre, cuentasSinClasificar, saldosNegativos, pendientesRevision,
    calidadScore, calidadLabel,

    // Raw
    cuentas, supuestos,
  };
}

// ── Alertas inteligentes V5 ───────────────────────────────────────────────────
export function generarAlertas(calc) {
  const alertas = [];

  if (calc.descuadre) alertas.push({
    nivel: 'critico', area: 'Calidad contable',
    titulo: 'Descuadre balance activo / pasivo+PN',
    desc: `El total activo no coincide con patrimonio neto más pasivo. Diferencia detectada: ${fmtEUR(calc.diferencia)}. Esta divergencia debe resolverse antes de considerar definitivo el cierre contable.`,
    accion: 'Contrastar con mayor contable cuenta a cuenta y conciliar todas las masas patrimoniales.'
  });

  if (calc.patrimonioNeto < 0) alertas.push({
    nivel: 'critico', area: 'Riesgo mercantil',
    titulo: 'Patrimonio neto negativo',
    desc: `El patrimonio neto asciende a ${fmtEUR(calc.patrimonioNeto)}, lo que podría constituir causa de disolución conforme al artículo 363 LSC si las pérdidas reducen el patrimonio neto por debajo de la mitad del capital social.`,
    accion: 'Validar con asesoría jurídica-mercantil. Analizar aportaciones de socios, capitalización o restructuración.'
  });

  if (calc.fondoManiobra < 0 && calc.hasBalance) alertas.push({
    nivel: 'alta', area: 'Liquidez',
    titulo: 'Fondo de maniobra negativo',
    desc: `El activo corriente (${fmtEUR(calc.activoCorriente)}) no cubre el pasivo corriente (${fmtEUR(calc.pasivoCorriente)}). Fondo de maniobra: ${fmtEUR(calc.fondoManiobra)}. Puede existir tensión de liquidez a corto plazo.`,
    accion: 'Negociar aplazamientos con proveedores, acelerar cobros de clientes, revisar vencimientos de deuda.'
  });

  if (calc.ratioLiquidez !== null && calc.ratioLiquidez < 1) alertas.push({
    nivel: 'alta', area: 'Liquidez',
    titulo: 'Ratio de liquidez corriente inferior a 1',
    desc: `El ratio de liquidez corriente es ${fmtX(calc.ratioLiquidez)}. Por debajo de 1,0 indica que la empresa no dispone de activos corrientes suficientes para cubrir las obligaciones de corto plazo con sus activos corrientes.`,
    accion: 'Revisar estructura de circulante, refinanciar deuda corto plazo, mejorar gestión de cobros.'
  });

  if (calc.endeudamiento !== null && calc.endeudamiento > 3) alertas.push({
    nivel: 'alta', area: 'Endeudamiento',
    titulo: 'Endeudamiento elevado',
    desc: `El ratio de endeudamiento total es ${fmtX(calc.endeudamiento)} (pasivo / PN). Por encima de 2-3x suele considerarse elevado y puede limitar la capacidad de obtener financiación adicional.`,
    accion: 'Analizar estructura de deuda, amortizaciones previstas y capacidad de servicio de la deuda.'
  });

  if (calc.deudaNetaEbitda !== null && calc.deudaNetaEbitda > 4) alertas.push({
    nivel: 'alta', area: 'M&A / Deuda',
    titulo: 'DFN/EBITDA superior a 4x',
    desc: `La deuda financiera neta equivale a ${fmtX(calc.deudaNetaEbitda)} el EBITDA. Por encima de 4-5x se considera nivel elevado en transacciones de M&A y puede dificultar la obtención de financiación o la venta de la empresa.`,
    accion: 'Priorizar desapalancamiento, revisar generación de caja operativa y plan de refinanciación.'
  });

  if (calc.saldosNegativos > 0) alertas.push({
    nivel: 'media', area: 'Calidad contable',
    titulo: `${calc.saldosNegativos} cuentas de activo con saldo negativo`,
    desc: 'Se detectan saldos negativos en cuentas de activo. Pueden responder a abonos, anticipos, errores de imputación o partidas sin conciliar.',
    accion: 'Revisar el mayor contable de cada cuenta afectada y conciliar con documentación soporte.'
  });

  if (!calc.hasPyG) alertas.push({
    nivel: 'media', area: 'Datos',
    titulo: 'Cuenta de PyG no disponible',
    desc: 'No se ha podido extraer la cuenta de pérdidas y ganancias del documento aportado. Los ratios de rentabilidad, cashflow y burn rate no son calculables con seguridad.',
    accion: 'Aportar PyG del ejercicio, balance comparativo y, si es posible, diario o mayor contable.'
  });

  if (calc.runwayBruto !== null && calc.runwayBruto < 6) alertas.push({
    nivel: calc.runwayBruto < 3 ? 'critico' : 'alta', area: 'Liquidez / Runway',
    titulo: `Runway limitado: ${calc.runwayBruto.toFixed(1)} meses`,
    desc: `Con los gastos operativos actuales, la tesorería disponible (${fmtEUR(calc.tesoreria)}) cubriría aproximadamente ${calc.runwayBruto.toFixed(1)} meses. ${calc.runwaySource === SOURCE.SUPUESTO ? 'Calculado sobre supuestos editables, no dato contable extraído.' : 'Calculado a partir de la PyG anualizada.'}`,
    accion: 'Revisar con urgencia generación de ingresos, control de gastos y alternativas de financiación.'
  });

  if (calc.cuentasSinClasificar > 5) alertas.push({
    nivel: 'baja', area: 'Trazabilidad',
    titulo: `${calc.cuentasSinClasificar} cuentas sin clasificar`,
    desc: 'Existen cuentas contables que no han podido clasificarse automáticamente por masa patrimonial. Pueden afectar a la fiabilidad de los ratios calculados.',
    accion: 'Revisar y clasificar manualmente las cuentas no reconocidas antes de validar el informe.'
  });

  return alertas;
}

// ── Recomendaciones accionables V5 ───────────────────────────────────────────
export function generarRecomendaciones(calc) {
  const recs = { inmediata: [], corto: [], medio: [], info: [] };

  if (calc.descuadre) recs.inmediata.push('Conciliar el balance: revisar todas las masas patrimoniales hasta identificar y corregir la diferencia de ' + fmtEUR(calc.diferencia) + '.');
  if (calc.fondoManiobra < 0) recs.inmediata.push('El fondo de maniobra negativo (' + fmtEUR(calc.fondoManiobra) + ') requiere atención inmediata: negociar aplazamiento de pasivo corriente o acelerar cobros de clientes.');
  if (calc.patrimonioNeto < 0) recs.inmediata.push('Patrimonioneto negativo: analizar con asesoría jurídica la situación mercantil y las opciones de regularización patrimonial.');
  if (!calc.hasPyG) recs.inmediata.push('Aportar PyG del ejercicio para completar el análisis de rentabilidad, cashflow y burn rate.');

  if (calc.ratioLiquidez !== null && calc.ratioLiquidez < 1.2) recs.corto.push('Mejorar ratio de liquidez (' + fmtX(calc.ratioLiquidez) + '): reducir pasivo corriente, ampliar plazo de pago a proveedores o mejorar cobros.');
  if (calc.clientes > calc.activoCorriente * 0.5) recs.corto.push('Los saldos de clientes representan más del 50% del activo corriente. Revisar aging y gestionar activamente el cobro.');
  if (calc.endeudamiento !== null && calc.endeudamiento > 2) recs.corto.push('Endeudamiento (' + fmtX(calc.endeudamiento) + ') elevado: evaluar refinanciación, capitalización o reducción de pasivo.');
  if (calc.hasPyG && calc.margenNeto !== null && calc.margenNeto < 0.05) recs.corto.push('Margen neto reducido (' + fmtPct(calc.margenNeto * 100) + '): revisar estructura de costes e identificar partidas susceptibles de optimización.');

  if (calc.hasPyG && calc.pesPersonal !== null && calc.pesPersonal > 0.4) recs.medio.push('Gasto de personal representa ' + fmtPct(calc.pesPersonal * 100) + ' de los ingresos. Analizar productividad por empleado y modelo de contratación.');
  if (calc.deudaNetaEbitda !== null && calc.deudaNetaEbitda > 3) recs.medio.push('DFN/EBITDA de ' + fmtX(calc.deudaNetaEbitda) + ': diseñar plan de desapalancamiento a 2-3 años con foco en generación de caja operativa.');
  recs.medio.push('Implementar cuadro de mando financiero mensual con seguimiento de KPIs: margen, tesorería, DSO, DPO y cobertura de gastos.');

  if (!calc.hasPyG) recs.info.push('Para cálculo de cashflow, rentabilidad y burn rate real: PyG del ejercicio, balance comparativo y, idealmente, diario o mayor contable.');
  if (calc.deudaFinancieraTotal === 0) recs.info.push('No se han identificado cuentas de deuda financiera (17x / 52x). Confirmar si la empresa carece de deuda financiera o si estas cuentas no figuran en el documento aportado.');
  recs.info.push('Para análisis M&A completo: aportar serie histórica de PyG (mínimo 3 ejercicios), detalle de ajustes EBITDA, contratos relevantes y pasivos contingentes conocidos.');

  return recs;
}