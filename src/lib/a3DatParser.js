/**
 * A3 .dat Parser V2 — Taxea Business OS
 * Parser multi-estrategia, tolerante a fallos, con trazabilidad completa de líneas
 */

// ─── PGC Classification ────────────────────────────────────────────────────
const PGC_RULES = [
  { prefix: '57', tipo: 'tesoreria', label: 'Tesorería / Bancos', grupo: 5 },
  { prefix: '53', tipo: 'tesoreria', label: 'Inversiones financieras CP', grupo: 5 },
  { prefix: '43', tipo: 'cliente', label: 'Clientes', grupo: 4 },
  { prefix: '44', tipo: 'deudor', label: 'Deudores', grupo: 4 },
  { prefix: '40', tipo: 'proveedor', label: 'Proveedores', grupo: 4 },
  { prefix: '41', tipo: 'acreedor', label: 'Acreedores', grupo: 4 },
  { prefix: '46', tipo: 'pasivo_corriente', label: 'Personal', grupo: 4 },
  { prefix: '47', tipo: 'impuesto', label: 'Hacienda Pública / Impuestos', grupo: 4 },
  { prefix: '48', tipo: 'ajuste', label: 'Ajustes periodificación', grupo: 4 },
  { prefix: '7', tipo: 'ingreso', label: 'Ventas e ingresos', grupo: 7 },
  { prefix: '6', tipo: 'gasto', label: 'Compras y gastos', grupo: 6 },
  { prefix: '1', tipo: 'financiacion', label: 'Financiación básica', grupo: 1 },
  { prefix: '2', tipo: 'inmovilizado', label: 'Inmovilizado', grupo: 2 },
  { prefix: '3', tipo: 'existencias', label: 'Existencias', grupo: 3 },
  { prefix: '5', tipo: 'financiero', label: 'Cuentas financieras', grupo: 5 },
  { prefix: '8', tipo: 'patrimonio', label: 'Gastos imputados patrimonio', grupo: 8 },
  { prefix: '9', tipo: 'patrimonio', label: 'Ingresos imputados patrimonio', grupo: 9 },
];

export function classifyAccount(cuenta) {
  if (!cuenta || String(cuenta).trim() === '') return { tipo: 'sin_clasificar', label: 'Cuenta pendiente de clasificación', grupo: null };
  const c = String(cuenta).trim().replace(/^0+/, '');
  for (const rule of PGC_RULES) {
    if (c.startsWith(rule.prefix)) return { tipo: rule.tipo, label: rule.label, grupo: rule.grupo };
  }
  return { tipo: 'sin_clasificar', label: 'Cuenta pendiente de clasificación', grupo: null };
}

// ─── Encoding Detection ─────────────────────────────────────────────────────
export function detectEncoding(text) {
  const mojibake = /[Ã¡Ã©Ã­Ã³ÃºÃ±ÃÃ]/.test(text);
  const latin = /[áéíóúñüÁÉÍÓÚÑÜàèìòùçÇ]/.test(text);
  const suspicious = (text.match(/[^\x00-\x7F]/g) || []).length;
  const ratio = suspicious / Math.max(text.length, 1);
  if (mojibake) return { encoding: 'windows-1252', confidence: 'baja', ratio };
  if (latin && ratio < 0.1) return { encoding: 'utf-8', confidence: 'alta', ratio };
  if (ratio < 0.01) return { encoding: 'utf-8', confidence: 'alta', ratio };
  return { encoding: 'iso-8859-1', confidence: 'media', ratio };
}

// ─── Date Parsing ───────────────────────────────────────────────────────────
const DATE_PATTERNS = [
  { re: /^(\d{2})\/(\d{2})\/(\d{4})$/, fmt: 'dd/mm/yyyy', parse: (m) => `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}` },
  { re: /^(\d{2})-(\d{2})-(\d{4})$/, fmt: 'dd-mm-yyyy', parse: (m) => `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}` },
  { re: /^(\d{4})-(\d{2})-(\d{2})$/, fmt: 'yyyy-mm-dd', parse: (m) => `${m[1]}-${m[2]}-${m[3]}` },
  { re: /^(\d{2})(\d{2})(\d{4})$/, fmt: 'ddmmyyyy', parse: (m) => `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}` },
  { re: /^(\d{4})(\d{2})(\d{2})$/, fmt: 'yyyymmdd', parse: (m) => `${m[1]}-${m[2]}-${m[3]}` },
];

export function parseDate(str) {
  if (!str) return null;
  const s = String(str).trim();
  for (const p of DATE_PATTERNS) {
    const m = s.match(p.re);
    if (m) {
      try {
        const iso = p.parse(m);
        const d = new Date(iso);
        if (!isNaN(d.getTime()) && d.getFullYear() > 1990 && d.getFullYear() < 2040) return iso;
      } catch {}
    }
  }
  return null;
}

export function extractDateFromText(text) {
  const patterns = [
    /\b(\d{2}[\/\-]\d{2}[\/\-]\d{4})\b/,
    /\b(\d{4}[\/\-]\d{2}[\/\-]\d{2})\b/,
    /\b(\d{8})\b/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) { const d = parseDate(m[1]); if (d) return d; }
  }
  return null;
}

// ─── Amount Parsing ─────────────────────────────────────────────────────────
export function parseAmount(str) {
  if (!str) return null;
  const s = String(str).trim().replace(/[€$£\s]/g, '');
  if (!s || s === '-' || s === '') return null;
  let cleaned = s;
  // Spanish format: 1.234,56
  if (/\d\.\d{3},\d/.test(s)) cleaned = s.replace(/\./g, '').replace(',', '.');
  // Comma decimal: 1234,56
  else if (/,\d{1,2}$/.test(s) && !s.includes('.')) cleaned = s.replace(',', '.');
  // Dot thousands: 1.234.567
  else if (/\.\d{3}/.test(s) && !s.includes(',')) cleaned = s.replace(/\./g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

export function extractAmountsFromText(text) {
  const matches = [...text.matchAll(/-?[\d]+[.,]\d{2}/g)].map(m => parseAmount(m[0])).filter(n => n !== null);
  return matches;
}

// ─── Structure Detection ─────────────────────────────────────────────────────
function scoreStrategy(lines, sep) {
  if (!lines.length) return { score: 0, cols: 0, consistent: false };
  const colCounts = lines.slice(0, 30).map(l => l.split(sep).length);
  const mode = colCounts.sort((a,b)=>a-b)[Math.floor(colCounts.length/2)];
  const consistent = colCounts.filter(n => n === mode).length / colCounts.length;
  const hasDate = lines.slice(0, 10).some(l => l.split(sep).some(f => parseDate(f.trim())));
  const hasAmount = lines.slice(0, 10).some(l => l.split(sep).some(f => parseAmount(f.trim()) !== null));
  const score = (mode > 3 ? 0.3 : 0) + (consistent > 0.8 ? 0.4 : consistent * 0.4) + (hasDate ? 0.15 : 0) + (hasAmount ? 0.15 : 0);
  return { score, cols: mode, consistent, hasDate, hasAmount };
}

export function detectStructure(lines) {
  const nonEmpty = lines.filter(l => l.trim().length > 5);
  if (!nonEmpty.length) return { type: 'empty', separator: null, confidence: 0 };

  const strategies = [
    { sep: ';', name: 'semicolon' },
    { sep: '\t', name: 'tab' },
    { sep: '|', name: 'pipe' },
    { sep: ',', name: 'comma' },
  ];

  let best = { score: 0, sep: null, name: 'unknown' };
  for (const s of strategies) {
    const result = scoreStrategy(nonEmpty, s.sep);
    if (result.score > best.score) best = { ...result, ...s };
  }

  // Check fixed-width
  const lengths = nonEmpty.slice(0, 20).map(l => l.length);
  const avgLen = lengths.reduce((a,b)=>a+b,0)/lengths.length;
  const fixedConsistency = lengths.filter(n => Math.abs(n - avgLen) <= 3).length / lengths.length;

  if (fixedConsistency > 0.85 && avgLen > 30 && best.score < 0.5) {
    return { type: 'fixed_width', separator: null, confidence: fixedConsistency, lineLength: Math.round(avgLen) };
  }

  if (best.score > 0.4) {
    return { type: 'delimited', separator: best.sep, separatorName: best.name, confidence: best.score, cols: best.cols };
  }

  return { type: 'text_heuristic', separator: null, confidence: 0.2 };
}

// ─── Field Inference ─────────────────────────────────────────────────────────
function inferFieldMap(fields, colCount) {
  // Standard A3 patterns by column count
  const MAPS = {
    13: { asiento:0, apunte:1, diario:2, fecha:3, cuenta:4, nombre_cuenta:5, concepto:6, documento:7, debe:8, haber:9, saldo:10, tercero:11, vencimiento:12 },
    12: { asiento:0, apunte:1, diario:2, fecha:3, cuenta:4, nombre_cuenta:5, concepto:6, documento:7, debe:8, haber:9, saldo:10, tercero:11 },
    11: { asiento:0, apunte:1, fecha:2, cuenta:3, nombre_cuenta:4, concepto:5, documento:6, debe:7, haber:8, saldo:9, tercero:10 },
    10: { asiento:0, apunte:1, fecha:2, cuenta:3, nombre_cuenta:4, concepto:5, debe:6, haber:7, saldo:8, documento:9 },
    9:  { fecha:0, asiento:1, cuenta:2, nombre_cuenta:3, concepto:4, debe:5, haber:6, saldo:7, documento:8 },
    8:  { fecha:0, asiento:1, cuenta:2, concepto:3, debe:4, haber:5, saldo:6, documento:7 },
    7:  { fecha:0, cuenta:1, nombre_cuenta:2, concepto:3, debe:4, haber:5, saldo:6 },
    6:  { fecha:0, cuenta:1, concepto:2, debe:3, haber:4, saldo:5 },
    5:  { fecha:0, cuenta:1, concepto:2, debe:3, haber:4 },
    4:  { fecha:0, cuenta:1, concepto:2, importe:3 },
  };

  // Try exact match first
  if (MAPS[colCount]) return MAPS[colCount];

  // Heuristic: scan headers for known field names
  const heuristic = {};
  const knownFields = {
    fecha: /^(fecha|date|fec|dt|dia)/i,
    cuenta: /^(cuenta|cta|subcuenta|subctacta|account)/i,
    nombre_cuenta: /^(descripcion|nombre|desc|name|denominacion)/i,
    concepto: /^(concepto|texto|detalle|detail|concept)/i,
    debe: /^(debe|debit|db|deb)/i,
    haber: /^(haber|credit|cr|hab)/i,
    saldo: /^(saldo|balance|sdo)/i,
    asiento: /^(asiento|asi|entry|num)/i,
    documento: /^(documento|doc|ref|reference)/i,
    tercero: /^(tercero|proveedor|cliente|nif|cif)/i,
  };

  fields.forEach((f, i) => {
    const fStr = String(f).trim();
    for (const [key, re] of Object.entries(knownFields)) {
      if (re.test(fStr) && !heuristic[key]) { heuristic[key] = i; break; }
    }
  });

  return Object.keys(heuristic).length >= 3 ? heuristic : (MAPS[colCount] || MAPS[6]);
}

// ─── Main Parser ──────────────────────────────────────────────────────────────
export function parseA3Dat(rawText, template = null) {
  const allRawLines = rawText.split(/\r?\n/);
  const results = { lines: [], errors: [], rawLines: allRawLines.length, structure: null, diagnostics: {} };

  const nonEmpty = allRawLines.filter(l => l.trim().length > 0);
  results.structure = template?.structure || detectStructure(nonEmpty);

  const sep = results.structure.separator;
  let fieldMap = template?.fieldMap || null;
  let skippedHeaders = 0;

  // Detect header row
  let startIdx = 0;
  if (nonEmpty.length > 0) {
    const firstFields = nonEmpty[0].split(sep || ';');
    const isHeader = firstFields.some(f => /^(fecha|cuenta|debe|haber|concepto|asiento|date|debit|credit)/i.test(String(f).trim()));
    if (isHeader) { fieldMap = fieldMap || inferFieldMap(firstFields, firstFields.length); skippedHeaders = 1; startIdx = 1; }
  }

  const dataLines = nonEmpty.slice(startIdx);
  const failedLines = [];

  for (let rawIdx = 0; rawIdx < dataLines.length; rawIdx++) {
    const line = dataLines[rawIdx];
    const originalLineNum = rawIdx + startIdx + 1;

    try {
      let fields = {};
      let parseOk = false;
      let parseWarnings = [];

      // Strategy 1: delimited
      if (results.structure.type === 'delimited' || sep) {
        const parts = line.split(sep || ';');
        if (!fieldMap) fieldMap = inferFieldMap(parts, parts.length);
        fields = applyMap(parts, fieldMap);
        parseOk = !!(fields.fecha || fields.cuenta || fields.debe || fields.haber);
      }

      // Strategy 2: fixed width (if template has it)
      if (!parseOk && template?.fixedWidthMap) {
        fields = applyFixedWidth(line, template.fixedWidthMap);
        parseOk = !!(fields.fecha || fields.cuenta);
      }

      // Strategy 3: heuristic extraction
      if (!parseOk) {
        const dateFound = extractDateFromText(line);
        const amounts = extractAmountsFromText(line);
        const accountMatch = line.match(/\b([1-9]\d{3,7})\b/);
        fields = {
          fecha: dateFound,
          cuenta: accountMatch ? accountMatch[1] : '',
          concepto: line.substring(0, 60).trim(),
          debe: amounts[0] > 0 ? amounts[0] : 0,
          haber: amounts[1] > 0 ? amounts[1] : 0,
          importe: amounts[0] || 0,
        };
        if (dateFound || accountMatch) {
          parseOk = true;
          parseWarnings.push('Parseado por heurística — revisar campos');
        }
      }

      const fecha = parseDate(fields.fecha);
      const debe = parseAmount(fields.debe) || 0;
      const haber = parseAmount(fields.haber) || 0;
      const importe = parseAmount(fields.importe);

      // Single amount column: split by sign
      const finalDebe = debe || (importe !== null && importe < 0 ? Math.abs(importe) : (importe !== null && fields.tipo === 'D' ? importe : 0));
      const finalHaber = haber || (importe !== null && importe > 0 && fields.tipo !== 'D' ? importe : 0);

      const cuenta = String(fields.cuenta || '').trim();
      const classification = classifyAccount(cuenta);

      let lineStatus = 'ok';
      if (!fecha) { parseWarnings.push('Sin fecha reconocible'); }
      if (!cuenta) { parseWarnings.push('Sin cuenta contable'); }
      if (finalDebe === 0 && finalHaber === 0) { parseWarnings.push('Sin importes detectados'); }
      if (parseWarnings.length > 0 && parseOk) lineStatus = 'advertencia';
      if (!fecha && !cuenta && finalDebe === 0 && finalHaber === 0) { lineStatus = 'no_interpretable'; }

      if (lineStatus === 'no_interpretable') {
        failedLines.push({ linea: originalLineNum, raw: line, motivo: parseWarnings.join('; ') || 'Sin campos reconocibles', campos_detectados: fields, estrategia: results.structure.type });
        results.errors.push({ linea: originalLineNum, raw: line, error: parseWarnings.join('; ') || 'Sin campos reconocibles' });
        continue;
      }

      results.lines.push({
        linea: originalLineNum,
        estado: lineStatus,
        advertencias: parseWarnings,
        asiento: fields.asiento || '',
        apunte: fields.apunte || '',
        diario: fields.diario || '',
        fecha,
        cuenta,
        nombre_cuenta: fields.nombre_cuenta || '',
        concepto: fields.concepto || '',
        documento: fields.documento || '',
        contrapartida: fields.contrapartida || '',
        debe: finalDebe,
        haber: finalHaber,
        saldo: parseAmount(fields.saldo) || 0,
        tercero: fields.tercero || '',
        vencimiento: parseDate(fields.vencimiento),
        classification,
        raw: line,
        origen: 'dat',
      });
    } catch (e) {
      failedLines.push({ linea: originalLineNum, raw: line, motivo: `Error interno: ${e.message}`, campos_detectados: {}, estrategia: 'error' });
      results.errors.push({ linea: originalLineNum, raw: line, error: e.message });
    }
  }

  // Diagnostics for failed lines
  results.failedLines = failedLines;
  results.diagnostics = diagnoseFailed(failedLines, results.structure);

  return results;
}

function applyMap(parts, map) {
  const result = {};
  for (const [field, idx] of Object.entries(map)) {
    result[field] = parts[idx] !== undefined ? String(parts[idx]).trim() : '';
  }
  return result;
}

function applyFixedWidth(line, fwMap) {
  const result = {};
  for (const [field, { start, end }] of Object.entries(fwMap)) {
    result[field] = line.substring(start, end).trim();
  }
  return result;
}

function diagnoseFailed(failedLines, structure) {
  if (!failedLines.length) return { hasIssues: false };
  const lengths = failedLines.map(l => l.raw?.length || 0);
  const avgLen = lengths.reduce((a,b)=>a+b,0)/Math.max(lengths.length,1);
  const prefixes = {};
  failedLines.forEach(l => {
    const p = String(l.raw||'').substring(0,2);
    prefixes[p] = (prefixes[p]||0)+1;
  });
  const topPrefix = Object.entries(prefixes).sort((a,b)=>b[1]-a[1])[0];
  const hasNoDate = failedLines.filter(l => !extractDateFromText(l.raw||'')).length;
  const hasNoAmount = failedLines.filter(l => extractAmountsFromText(l.raw||'').length===0).length;

  return {
    hasIssues: true,
    total: failedLines.length,
    avgLength: Math.round(avgLen),
    dominantPrefix: topPrefix?.[0] || '',
    sinFecha: hasNoDate,
    sinImporte: hasNoAmount,
    posibleCabecera: failedLines.slice(0,3).some(l => /^(fecha|cuenta|debe|haber|asiento|desc)/i.test(String(l.raw||'').trim())),
    posiblePie: failedLines.slice(-3).some(l => /^(total|suma|saldo final)/i.test(String(l.raw||'').trim())),
    accionSugerida: hasNoDate > failedLines.length * 0.5 ? 'Revisar formato de fecha en plantilla' : hasNoAmount > failedLines.length * 0.5 ? 'Revisar separador decimal o columnas de importe' : 'Revisar separador y mapeo de campos',
  };
}

// ─── Metrics Calculation ──────────────────────────────────────────────────────
export function calcMetrics(lines) {
  const ingresos = lines.filter(l=>l.classification.tipo==='ingreso').reduce((s,l)=>s+l.haber,0);
  const gastos = lines.filter(l=>l.classification.tipo==='gasto').reduce((s,l)=>s+l.debe,0);
  const totalDebe = lines.reduce((s,l)=>s+l.debe,0);
  const totalHaber = lines.reduce((s,l)=>s+l.haber,0);
  const diferencia = Math.abs(totalDebe-totalHaber);

  const tesoreriaLines = lines.filter(l=>String(l.cuenta).startsWith('57'));
  const saldoTesoreria = tesoreriaLines.reduce((s,l)=>s+l.haber-l.debe,0);

  const byMonth = {};
  for (const l of lines) {
    if (!l.fecha) continue;
    const m = l.fecha.substring(0,7);
    if (!byMonth[m]) byMonth[m]={mes:m,ingresos:0,gastos:0};
    if (l.classification.tipo==='ingreso') byMonth[m].ingresos+=l.haber;
    if (l.classification.tipo==='gasto') byMonth[m].gastos+=l.debe;
  }

  const cuentaMap = {};
  for (const l of lines) {
    const k=l.cuenta;
    if (!k) continue;
    if (!cuentaMap[k]) cuentaMap[k]={cuenta:k,nombre:l.nombre_cuenta||k,tipo:l.classification.tipo,debe:0,haber:0};
    cuentaMap[k].debe+=l.debe;
    cuentaMap[k].haber+=l.haber;
  }

  const clientes = Object.values(cuentaMap).filter(c=>c.tipo==='cliente').sort((a,b)=>(b.haber-b.debe)-(a.haber-a.debe)).slice(0,6);
  const proveedores = Object.values(cuentaMap).filter(c=>c.tipo==='proveedor'||c.tipo==='acreedor').sort((a,b)=>(b.debe-b.haber)-(a.debe-a.haber)).slice(0,6);

  const activoCorriente = lines.filter(l=>['cliente','deudor','tesoreria','existencias'].includes(l.classification.tipo)).reduce((s,l)=>s+(l.debe-l.haber),0);
  const activoNoCorriente = lines.filter(l=>l.classification.tipo==='inmovilizado').reduce((s,l)=>s+(l.debe-l.haber),0);
  const pasivoCorriente = lines.filter(l=>['proveedor','acreedor','impuesto'].includes(l.classification.tipo)).reduce((s,l)=>s+(l.haber-l.debe),0);
  const patrimonio = lines.filter(l=>l.classification.tipo==='financiacion').reduce((s,l)=>s+(l.haber-l.debe),0);

  const gastosMap = {};
  for (const l of lines) {
    if (l.classification.tipo!=='gasto') continue;
    const key = l.nombre_cuenta||`${String(l.cuenta).substring(0,2)}x`;
    if (!gastosMap[key]) gastosMap[key]=0;
    gastosMap[key]+=l.debe;
  }

  const resultado = ingresos - gastos;
  const margen = ingresos>0 ? (resultado/ingresos)*100 : 0;

  return {
    ingresos,gastos,resultado,margen,totalDebe,totalHaber,diferencia,saldoTesoreria,
    mensual: Object.values(byMonth).sort((a,b)=>a.mes.localeCompare(b.mes)),
    clientes,proveedores,
    balance:{activoCorriente:Math.abs(activoCorriente),activoNoCorriente:Math.abs(activoNoCorriente),pasivoCorriente:Math.abs(pasivoCorriente),patrimonio:Math.abs(patrimonio)},
    gastosDistribucion: Object.entries(gastosMap).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([name,value])=>({name,value})),
    asientos:[...new Set(lines.map(l=>l.asiento).filter(Boolean))].length,
    apuntes:lines.length,
    cuentasSinClasificar:[...new Set(lines.filter(l=>l.classification.tipo==='sin_clasificar').map(l=>l.cuenta))],
    sinFecha:lines.filter(l=>!l.fecha).length,
    sinCuenta:lines.filter(l=>!l.cuenta).length,
    lineasConAdvertencia:lines.filter(l=>l.estado==='advertencia').length,
  };
}

export function generateAlerts(lines, metrics, source='dat') {
  const alerts = [];
  if (metrics.diferencia>1) alerts.push({nivel:'critico',titulo:'Descuadre Debe/Haber',desc:`Diferencia de ${metrics.diferencia.toFixed(2)}€. El libro diario no cuadra.`,area:'Contabilidad'});
  if (metrics.sinFecha>0) alerts.push({nivel:'revisar',titulo:`${metrics.sinFecha} apuntes sin fecha`,desc:'Afectan al análisis temporal y mensual.',area:'Calidad'});
  if (metrics.sinCuenta>0) alerts.push({nivel:'revisar',titulo:`${metrics.sinCuenta} apuntes sin cuenta`,desc:'No clasificables automáticamente.',area:'Calidad'});
  if (metrics.cuentasSinClasificar.length>0) alerts.push({nivel:'informativo',titulo:`${metrics.cuentasSinClasificar.length} cuentas sin clasificar`,desc:`Cuentas: ${metrics.cuentasSinClasificar.slice(0,4).join(', ')}${metrics.cuentasSinClasificar.length>4?'...':''}`,area:'Clasificación'});
  if (metrics.saldoTesoreria<0) alerts.push({nivel:'critico',titulo:'Saldo negativo en tesorería (cuentas 57x)',desc:'Puede indicar descuadre o descubierto bancario.',area:'Tesorería'});
  if (metrics.ingresos===0) alerts.push({nivel:'revisar',titulo:'Sin ingresos detectados (grupo 7)',desc:'El archivo puede ser solo de gastos o estar incompleto.',area:'PyG'});
  if (metrics.lineasConAdvertencia>0) alerts.push({nivel:'informativo',titulo:`${metrics.lineasConAdvertencia} líneas importadas con advertencias`,desc:'Revisar en "Líneas no reconocidas".',area:'Calidad'});
  alerts.push({nivel:'informativo',titulo:'Clasificación estimada por PGC',desc:'Toda clasificación es preliminar basada en rango de cuenta PGC. Pendiente de revisión profesional.',area:'General'});
  return alerts;
}

// ─── Excel Parser (simulated — Base44 reads file content as text) ────────────
export function parseExcelBalance(data) {
  // Expects array of row arrays from ExtractDataFromUploadedFile
  const lines = [];
  for (const row of data) {
    const cuenta = row.cuenta || row.Cuenta || row.CUENTA || '';
    const descripcion = row.descripcion || row.Descripcion || row.nombre || '';
    const saldoFinal = parseAmount(row.saldo_final || row.Saldo || row.saldo || row.SaldoFinal || '');
    const debe = parseAmount(row.debe || row.Debe || '');
    const haber = parseAmount(row.haber || row.Haber || '');
    if (!cuenta && !descripcion) continue;
    const classification = classifyAccount(String(cuenta));
    lines.push({ cuenta: String(cuenta), descripcion, debe: debe||0, haber: haber||0, saldoFinal: saldoFinal||0, classification, origen:'balance' });
  }
  return lines;
}

export function parseExcelPyG(data) {
  const lines = [];
  for (const row of data) {
    const cuenta = row.cuenta || row.Cuenta || '';
    const descripcion = row.descripcion || row.Descripcion || row.epigrafe || '';
    const importe = parseAmount(row.importe || row.Importe || row.periodo || row.saldo || '');
    if (!descripcion && !importe) continue;
    const classification = classifyAccount(String(cuenta));
    lines.push({ cuenta: String(cuenta), descripcion, importe: importe||0, tipo: classification.tipo, classification, origen:'pyg' });
  }
  return lines;
}

export function parseExcelDiary(data) {
  const lines = [];
  for (const row of data) {
    const fecha = parseDate(row.fecha || row.Fecha || '');
    const cuenta = row.cuenta || row.Cuenta || '';
    const debe = parseAmount(row.debe || row.Debe || '');
    const haber = parseAmount(row.haber || row.Haber || '');
    if (!fecha && !cuenta) continue;
    const classification = classifyAccount(String(cuenta));
    lines.push({ fecha, cuenta: String(cuenta), descripcion: row.descripcion||row.concepto||'', debe: debe||0, haber: haber||0, classification, origen:'diario' });
  }
  return lines;
}

// ─── Demo Data ────────────────────────────────────────────────────────────────
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

export const DEMO_BALANCE = [
  {cuenta:'430001',descripcion:'Cliente Omega SL',debe:12100,haber:12100,saldo_final:0},
  {cuenta:'430002',descripcion:'Cliente Beta SL',debe:14520,haber:0,saldo_final:14520},
  {cuenta:'400001',descripcion:'Proveedor Tech SA',debe:9680,haber:9680,saldo_final:0},
  {cuenta:'572001',descripcion:'Banco Santander c/c',debe:24200,haber:8900,saldo_final:15300},
  {cuenta:'700000',descripcion:'Ventas de servicios',debe:0,haber:22000,saldo_final:-22000},
  {cuenta:'600000',descripcion:'Compras mercaderías',debe:8000,haber:0,saldo_final:8000},
  {cuenta:'640000',descripcion:'Sueldos y salarios',debe:6500,haber:0,saldo_final:6500},
  {cuenta:'477000',descripcion:'HP IVA repercutido',debe:0,haber:4620,saldo_final:-4620},
  {cuenta:'472000',descripcion:'HP IVA soportado',debe:1680,haber:0,saldo_final:1680},
];

export const DEMO_PYG = [
  {cuenta:'700000',descripcion:'Ventas de servicios',importe:22000},
  {cuenta:'600000',descripcion:'Compras de mercaderías',importe:-8000},
  {cuenta:'640000',descripcion:'Sueldos y salarios',importe:-6500},
  {cuenta:'642000',descripcion:'Seguridad social',importe:-1950},
  {cuenta:'628000',descripcion:'Suministros',importe:-450},
];

export const DEMO_DIARIO = [
  {fecha:'01/01/2025',cuenta:'430001',descripcion:'Cliente Omega SL',debe:12100,haber:0},
  {fecha:'01/01/2025',cuenta:'700000',descripcion:'Ventas de servicios',debe:0,haber:10000},
  {fecha:'15/01/2025',cuenta:'600000',descripcion:'Compras',debe:8000,haber:0},
  {fecha:'01/02/2025',cuenta:'572001',descripcion:'Banco',debe:12100,haber:0},
  {fecha:'15/02/2025',cuenta:'640000',descripcion:'Sueldos',debe:6500,haber:0},
  {fecha:'01/03/2025',cuenta:'700000',descripcion:'Ventas',debe:0,haber:12000},
  {fecha:'15/03/2025',cuenta:'628000',descripcion:'Suministros',debe:450,haber:0},
];