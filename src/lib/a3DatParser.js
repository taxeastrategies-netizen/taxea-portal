/**
 * A3 .dat Parser — Taxea Business OS
 * Interpreta archivos contables exportados desde A3 en formato .dat
 * Soporta: texto delimitado, ancho fijo, codificaciones ANSI/Windows-1252/ISO-8859-1/UTF-8
 */

// PGC group classification
const PGC_GROUPS = {
  1: { label: 'Financiación básica', tipo: 'pasivo_no_corriente' },
  2: { label: 'Inmovilizado', tipo: 'activo_no_corriente' },
  3: { label: 'Existencias', tipo: 'activo_corriente' },
  40: { label: 'Proveedores', tipo: 'proveedor' },
  41: { label: 'Acreedores', tipo: 'acreedor' },
  43: { label: 'Clientes', tipo: 'cliente' },
  44: { label: 'Deudores', tipo: 'deudor' },
  46: { label: 'Personal', tipo: 'pasivo_corriente' },
  47: { label: 'Hacienda Pública', tipo: 'impuesto' },
  48: { label: 'Ajustes por periodificación', tipo: 'ajuste' },
  49: { label: 'Deterioros', tipo: 'deterioro' },
  5: { label: 'Cuentas financieras', tipo: 'tesoreria' },
  57: { label: 'Tesorería', tipo: 'tesoreria' },
  6: { label: 'Compras y gastos', tipo: 'gasto' },
  7: { label: 'Ventas e ingresos', tipo: 'ingreso' },
  8: { label: 'Gastos imputados al patrimonio', tipo: 'patrimonio' },
  9: { label: 'Ingresos imputados al patrimonio', tipo: 'patrimonio' },
};

export function classifyAccount(cuenta) {
  if (!cuenta) return { grupo: null, tipo: 'sin_clasificar', label: 'Cuenta pendiente de clasificación' };
  const c = String(cuenta).trim();
  const g2 = parseInt(c.substring(0, 2));
  const g1 = parseInt(c.substring(0, 1));
  if (PGC_GROUPS[g2]) return { grupo: g2, ...PGC_GROUPS[g2] };
  if (PGC_GROUPS[g1]) return { grupo: g1, ...PGC_GROUPS[g1] };
  return { grupo: null, tipo: 'sin_clasificar', label: 'Cuenta pendiente de clasificación' };
}

export function detectEncoding(text) {
  // Heuristic: check for common ANSI/Latin chars that get mangled
  const hasLatin = /[áéíóúñüÁÉÍÓÚÑÜàèìòùÀÈÌÒÙ]/.test(text);
  const hasMojibake = /[Ã¡Ã©Ã­Ã³ÃºÃ±]/.test(text);
  if (hasMojibake) return 'windows-1252';
  if (hasLatin) return 'utf-8';
  return 'iso-8859-1';
}

export function detectStructure(lines) {
  if (!lines || lines.length === 0) return { type: 'unknown', separator: null, fixedWidth: false };

  const sample = lines.slice(0, Math.min(20, lines.length)).filter(l => l.trim().length > 0);

  // Count separator candidates
  const separators = [';', '|', '\t', ','];
  const counts = {};
  for (const sep of separators) {
    const occurrences = sample.map(l => (l.split(sep).length - 1));
    const avg = occurrences.reduce((a, b) => a + b, 0) / occurrences.length;
    const consistent = occurrences.every(n => Math.abs(n - avg) <= 1) && avg > 1;
    if (consistent) counts[sep] = avg;
  }

  const bestSep = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  if (bestSep) {
    return { type: 'delimited', separator: bestSep[0], fixedWidth: false, cols: Math.round(bestSep[1]) + 1 };
  }

  // Fixed width detection
  const lengths = sample.map(l => l.length);
  const consistent = lengths.every(n => Math.abs(n - lengths[0]) <= 2);
  if (consistent && lengths[0] > 20) {
    return { type: 'fixed_width', separator: null, fixedWidth: true, lineLength: lengths[0] };
  }

  return { type: 'text', separator: null, fixedWidth: false };
}

export function detectDateFormat(str) {
  if (!str) return null;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) return 'dd/mm/yyyy';
  if (/^\d{2}-\d{2}-\d{4}$/.test(str)) return 'dd-mm-yyyy';
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return 'yyyy-mm-dd';
  if (/^\d{8}$/.test(str)) return 'ddmmyyyy';
  return null;
}

export function parseDate(str, format) {
  if (!str) return null;
  const s = String(str).trim();
  try {
    if (format === 'dd/mm/yyyy' || format === 'dd-mm-yyyy') {
      const [d, m, y] = s.split(/[\/\-]/);
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    if (format === 'yyyy-mm-dd') return s;
    if (format === 'ddmmyyyy' && s.length === 8) {
      return `${s.slice(4)}-${s.slice(2, 4)}-${s.slice(0, 2)}`;
    }
  } catch {}
  return null;
}

export function parseAmount(str) {
  if (!str) return 0;
  const s = String(str).trim();
  // Remove currency symbols, thousands separators
  let cleaned = s.replace(/[€$£\s]/g, '');
  // Detect decimal separator
  if (/,\d{1,2}$/.test(cleaned)) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  }
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

/**
 * Main parser: reads raw text and returns structured lines
 */
export function parseA3Dat(rawText, template = null) {
  const lines = rawText.split(/\r?\n/).filter(l => l.trim().length > 0);
  const structure = template?.structure || detectStructure(lines);

  const parsed = [];
  const errors = [];
  let dateFormat = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let fields = {};

    if (structure.type === 'delimited') {
      const parts = line.split(structure.separator);
      // Use template mapping or auto-detect common A3 patterns
      const map = template?.fieldMap || autoDetectFieldMap(parts, structure.cols);
      fields = applyFieldMap(parts, map);
    } else if (structure.type === 'fixed_width' && template?.fixedWidthMap) {
      fields = applyFixedWidthMap(line, template.fixedWidthMap);
    } else {
      // Best-effort parsing for unknown format
      fields = heuristicParse(line);
    }

    // Detect date format from first valid date
    if (!dateFormat && fields.fecha) {
      dateFormat = detectDateFormat(fields.fecha) || 'dd/mm/yyyy';
    }

    const fecha = parseDate(fields.fecha, dateFormat || 'dd/mm/yyyy');
    const debe = parseAmount(fields.debe);
    const haber = parseAmount(fields.haber);
    const importe = parseAmount(fields.importe);

    // If single importe column, split by sign or type indicator
    const finalDebe = debe || (importe > 0 && fields.tipo === 'D' ? Math.abs(importe) : 0);
    const finalHaber = haber || (importe > 0 && fields.tipo === 'H' ? Math.abs(importe) : 0);

    if (!fields.cuenta && !fecha && !finalDebe && !finalHaber) {
      errors.push({ linea: i + 1, raw: line, error: 'Línea sin datos reconocibles' });
      continue;
    }

    const cuenta = String(fields.cuenta || '').trim();
    const classification = classifyAccount(cuenta);

    parsed.push({
      linea: i + 1,
      asiento: fields.asiento || '',
      apunte: fields.apunte || '',
      diario: fields.diario || '',
      fecha: fecha || null,
      cuenta,
      nombre_cuenta: fields.nombre_cuenta || '',
      concepto: fields.concepto || '',
      documento: fields.documento || '',
      contrapartida: fields.contrapartida || '',
      debe: finalDebe,
      haber: finalHaber,
      saldo: parseAmount(fields.saldo),
      tercero: fields.tercero || '',
      vencimiento: parseDate(fields.vencimiento, dateFormat) || null,
      classification,
    });
  }

  return { lines: parsed, errors, structure, dateFormat, rawLineCount: lines.length };
}

function autoDetectFieldMap(parts, colCount) {
  // Common A3 column orders based on col count
  if (colCount >= 12) {
    return { asiento: 0, apunte: 1, diario: 2, fecha: 3, cuenta: 4, nombre_cuenta: 5, concepto: 6, documento: 7, debe: 8, haber: 9, saldo: 10, tercero: 11 };
  }
  if (colCount >= 9) {
    return { fecha: 0, asiento: 1, cuenta: 2, nombre_cuenta: 3, concepto: 4, debe: 5, haber: 6, saldo: 7, documento: 8 };
  }
  if (colCount >= 6) {
    return { fecha: 0, cuenta: 1, concepto: 2, debe: 3, haber: 4, saldo: 5 };
  }
  if (colCount >= 4) {
    return { fecha: 0, cuenta: 1, concepto: 2, importe: 3 };
  }
  return { fecha: 0, concepto: 1, importe: 2 };
}

function applyFieldMap(parts, map) {
  const result = {};
  for (const [field, idx] of Object.entries(map)) {
    result[field] = parts[idx] !== undefined ? String(parts[idx]).trim() : '';
  }
  return result;
}

function applyFixedWidthMap(line, fixedWidthMap) {
  const result = {};
  for (const [field, { start, end }] of Object.entries(fixedWidthMap)) {
    result[field] = line.substring(start, end).trim();
  }
  return result;
}

function heuristicParse(line) {
  // Try to extract date, numbers, and text from unknown format
  const dateMatch = line.match(/\b(\d{2}[\/\-]\d{2}[\/\-]\d{4}|\d{8})\b/);
  const numbersMatch = [...line.matchAll(/[\d.,]+/g)].map(m => m[0]);
  const textMatch = line.replace(/[\d\/\-.,;|]+/g, ' ').trim();
  return {
    fecha: dateMatch ? dateMatch[0] : '',
    concepto: textMatch.substring(0, 60),
    importe: numbersMatch[numbersMatch.length - 1] || '0',
  };
}

/**
 * Calculate financial metrics from parsed lines
 */
export function calcMetrics(lines) {
  const ingresos = lines.filter(l => l.classification.tipo === 'ingreso').reduce((s, l) => s + l.haber, 0);
  const gastos = lines.filter(l => l.classification.tipo === 'gasto').reduce((s, l) => s + l.debe, 0);
  const totalDebe = lines.reduce((s, l) => s + l.debe, 0);
  const totalHaber = lines.reduce((s, l) => s + l.haber, 0);
  const diferencia = Math.abs(totalDebe - totalHaber);

  // Tesorería: group 57
  const tesoreriaLines = lines.filter(l => String(l.cuenta).startsWith('57'));
  const saldoTesoreria = tesoreriaLines.reduce((s, l) => s + l.haber - l.debe, 0);

  // By month
  const byMonth = {};
  for (const l of lines) {
    if (!l.fecha) continue;
    const m = l.fecha.substring(0, 7);
    if (!byMonth[m]) byMonth[m] = { mes: m, ingresos: 0, gastos: 0 };
    if (l.classification.tipo === 'ingreso') byMonth[m].ingresos += l.haber;
    if (l.classification.tipo === 'gasto') byMonth[m].gastos += l.debe;
  }

  // Clientes (43x) and Proveedores (40x/41x)
  const cuentasCliente = {};
  const cuentasProveedor = {};
  for (const l of lines) {
    if (l.classification.tipo === 'cliente') {
      const key = l.cuenta;
      if (!cuentasCliente[key]) cuentasCliente[key] = { cuenta: key, nombre: l.nombre_cuenta || l.tercero || key, debe: 0, haber: 0 };
      cuentasCliente[key].debe += l.debe;
      cuentasCliente[key].haber += l.haber;
    }
    if (l.classification.tipo === 'proveedor' || l.classification.tipo === 'acreedor') {
      const key = l.cuenta;
      if (!cuentasProveedor[key]) cuentasProveedor[key] = { cuenta: key, nombre: l.nombre_cuenta || l.tercero || key, debe: 0, haber: 0 };
      cuentasProveedor[key].debe += l.debe;
      cuentasProveedor[key].haber += l.haber;
    }
  }

  // Balance items
  const activoCorriente = lines.filter(l => ['cliente', 'deudor', 'tesoreria', 'activo_corriente'].includes(l.classification.tipo)).reduce((s, l) => s + l.debe - l.haber, 0);
  const activoNoCorriente = lines.filter(l => l.classification.tipo === 'activo_no_corriente').reduce((s, l) => s + l.debe - l.haber, 0);
  const pasivoCorriente = lines.filter(l => ['proveedor', 'acreedor', 'impuesto'].includes(l.classification.tipo)).reduce((s, l) => s + l.haber - l.debe, 0);
  const patrimonio = lines.filter(l => l.classification.tipo === 'patrimonio').reduce((s, l) => s + l.haber - l.debe, 0);

  const resultado = ingresos - gastos;
  const margen = ingresos > 0 ? (resultado / ingresos) * 100 : 0;

  // Gastos distribution
  const gastosByCuenta = {};
  for (const l of lines) {
    if (l.classification.tipo !== 'gasto') continue;
    const g = String(l.cuenta).substring(0, 2);
    const key = l.nombre_cuenta || `Cuenta ${g}x`;
    if (!gastosByCuenta[key]) gastosByCuenta[key] = 0;
    gastosByCuenta[key] += l.debe;
  }
  const gastosDistribucion = Object.entries(gastosByCuenta)
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([name, value]) => ({ name, value }));

  return {
    ingresos, gastos, resultado, margen,
    totalDebe, totalHaber, diferencia,
    saldoTesoreria,
    mensual: Object.values(byMonth).sort((a, b) => a.mes.localeCompare(b.mes)),
    clientes: Object.values(cuentasCliente).sort((a, b) => (b.haber - b.debe) - (a.haber - a.debe)).slice(0, 5),
    proveedores: Object.values(cuentasProveedor).sort((a, b) => (b.debe - b.haber) - (a.debe - a.haber)).slice(0, 5),
    balance: { activoCorriente: Math.abs(activoCorriente), activoNoCorriente: Math.abs(activoNoCorriente), pasivoCorriente: Math.abs(pasivoCorriente), patrimonio: Math.abs(patrimonio) },
    gastosDistribucion,
    asientos: [...new Set(lines.map(l => l.asiento).filter(Boolean))].length,
    apuntes: lines.length,
    sinFecha: lines.filter(l => !l.fecha).length,
    sinCuenta: lines.filter(l => !l.cuenta).length,
    cuentasSinClasificar: [...new Set(lines.filter(l => l.classification.tipo === 'sin_clasificar').map(l => l.cuenta))],
  };
}

/**
 * Generate validation alerts from parsed lines and metrics
 */
export function generateAlerts(lines, metrics) {
  const alerts = [];

  if (metrics.diferencia > 1) {
    alerts.push({ nivel: 'critico', titulo: 'Descuadre entre Debe y Haber', desc: `La diferencia entre Debe (${metrics.totalDebe.toFixed(2)}€) y Haber (${metrics.totalHaber.toFixed(2)}€) es de ${metrics.diferencia.toFixed(2)}€. El libro diario no cuadra.`, area: 'Contabilidad' });
  }
  if (metrics.sinFecha > 0) {
    alerts.push({ nivel: 'revisar', titulo: 'Apuntes sin fecha', desc: `${metrics.sinFecha} apunte(s) no tienen fecha reconocible. Pueden afectar al análisis temporal.`, area: 'Calidad del dato' });
  }
  if (metrics.sinCuenta > 0) {
    alerts.push({ nivel: 'revisar', titulo: 'Apuntes sin cuenta contable', desc: `${metrics.sinCuenta} apunte(s) no tienen cuenta contable identificada. No se pueden clasificar.`, area: 'Calidad del dato' });
  }
  if (metrics.cuentasSinClasificar.length > 0) {
    alerts.push({ nivel: 'informativo', titulo: 'Cuentas pendientes de clasificación', desc: `${metrics.cuentasSinClasificar.length} cuenta(s) no han podido clasificarse automáticamente: ${metrics.cuentasSinClasificar.slice(0, 5).join(', ')}${metrics.cuentasSinClasificar.length > 5 ? '...' : ''}`, area: 'Clasificación contable' });
  }
  if (metrics.clientes.length > 0) {
    const topCliente = metrics.clientes[0];
    const totalClientes = metrics.clientes.reduce((s, c) => s + (c.haber - c.debe), 0);
    const pct = totalClientes > 0 ? ((topCliente.haber - topCliente.debe) / totalClientes * 100) : 0;
    if (pct > 40) {
      alerts.push({ nivel: 'revisar', titulo: 'Alta concentración en clientes', desc: `El cliente "${topCliente.nombre}" representa el ${pct.toFixed(0)}% de los saldos de clientes detectados. Riesgo de dependencia.`, area: 'Clientes' });
    }
  }
  if (metrics.saldoTesoreria < 0) {
    alerts.push({ nivel: 'critico', titulo: 'Saldo negativo en cuentas de tesorería', desc: `Las cuentas del grupo 57 muestran un saldo negativo estimado. Puede indicar un descuadre o un saldo en descubierto.`, area: 'Tesorería' });
  }
  if (metrics.ingresos === 0) {
    alerts.push({ nivel: 'revisar', titulo: 'Sin ingresos detectados', desc: 'No se han detectado movimientos en cuentas del grupo 7 (ventas e ingresos). El archivo puede ser un mayor de gastos o puede estar incompleto.', area: 'PyG' });
  }
  alerts.push({ nivel: 'informativo', titulo: 'Análisis preliminar', desc: 'Toda la clasificación contable es estimada basada en el rango de cuenta PGC. Pendiente de revisión profesional.', area: 'General' });

  return alerts;
}

// Demo A3 .dat content (fictitious)
export const DEMO_DAT_CONTENT = `01;001;DI;01/01/2025;430001;Cliente Omega SL;Factura FV-2025-001;FV001;12100;0;12100;
01;002;DI;01/01/2025;700000;Ventas de servicios;Factura FV-2025-001;FV001;0;10000;-10000;
01;003;DI;01/01/2025;477000;H.P. IVA repercutido;IVA 21%;FV001;0;2100;-2100;
02;001;DI;15/01/2025;600000;Compras de mercaderías;Compra proveedor Tech;FC001;8000;0;8000;
02;002;DI;15/01/2025;472000;H.P. IVA soportado;IVA Proveedor Tech;FC001;1680;0;1680;
02;003;DI;15/01/2025;400001;Proveedor Tech SA;Compra materiales;FC001;0;9680;-9680;
03;001;DI;01/02/2025;572001;Banco Santander c/c;Cobro Cliente Omega;TR001;12100;0;12100;
03;002;DI;01/02/2025;430001;Cliente Omega SL;Cobro fac FV-2025-001;TR001;0;12100;0;
04;001;DI;15/02/2025;640000;Sueldos y salarios;Nóminas febrero 2025;NOM02;6500;0;6500;
04;002;DI;15/02/2025;642000;Seguridad social;SS empresa feb 2025;NOM02;1950;0;1950;
04;003;DI;15/02/2025;572001;Banco Santander c/c;Pago nóminas feb;NOM02;0;8450;3650;
05;001;DI;01/03/2025;430002;Cliente Beta SL;Factura FV-2025-002;FV002;14520;0;14520;
05;002;DI;01/03/2025;700000;Ventas de servicios;Serv. consultoría mar;FV002;0;12000;-12000;
05;003;DI;01/03/2025;477000;H.P. IVA repercutido;IVA 21%;FV002;0;2520;-2520;
06;001;DI;15/03/2025;628000;Suministros;Electricidad+internet;SUM03;450;0;450;
06;002;DI;15/03/2025;572001;Banco Santander c/c;Pago suministros;SUM03;0;450;3200;`;