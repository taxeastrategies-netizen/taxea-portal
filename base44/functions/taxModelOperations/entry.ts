import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';

const ENGINE_VERSION = 'taxea-modelos-2026.09.10-v1';
const TARGET_MODELS = ['111', '115', '123', '130', '180', '190', '193', '303', '347', '390', '415', '420', '425'];

const DEFINITIONS: Record<string, any> = {
  '111': { name: 'Retenciones de trabajo y actividades económicas', authority: 'AEAT', frequency: 'trimestral/mensual', kind: 'withholding', design: 'EHA/3127/2009 v1.8', designYear: '2019+', officialExport: true },
  '115': { name: 'Retenciones por arrendamientos urbanos', authority: 'AEAT', frequency: 'trimestral/mensual', kind: 'withholding', design: 'EHA/3435/2007 v1.3', designYear: '2019+', officialExport: true },
  '123': { name: 'Retenciones de capital mobiliario y otras rentas', authority: 'AEAT', frequency: 'trimestral/mensual', kind: 'withholding', design: 'EHA/3435/2007 v2.0', designYear: '2024+', officialExport: true },
  '130': { name: 'Pago fraccionado IRPF en estimación directa', authority: 'AEAT', frequency: 'trimestral', kind: 'income_tax', design: 'HAP/258/2015 v1.2', designYear: '2019+', officialExport: true },
  '180': { name: 'Resumen anual de arrendamientos urbanos', authority: 'AEAT', frequency: 'anual', kind: 'informative', design: 'HAP/1732/2014', designYear: '2023+', officialExport: false },
  '190': { name: 'Resumen anual de trabajo y actividades económicas', authority: 'AEAT', frequency: 'anual', kind: 'informative', design: 'HAC/1431/2025', designYear: '2025+', officialExport: false },
  '193': { name: 'Resumen anual de capital mobiliario y otras rentas', authority: 'AEAT', frequency: 'anual', kind: 'informative', design: 'HAC/1430/2025', designYear: '2025+', officialExport: false },
  '303': { name: 'Autoliquidación IVA', authority: 'AEAT', frequency: 'trimestral/mensual', kind: 'indirect_tax', design: 'DR303e26 v1.01', designYear: '2026+', officialExport: true },
  '347': { name: 'Operaciones con terceras personas', authority: 'AEAT', frequency: 'anual', kind: 'informative', design: 'HAC/1431/2025', designYear: '2025+', officialExport: false },
  '390': { name: 'Resumen anual IVA', authority: 'AEAT', frequency: 'anual', kind: 'informative', design: 'DR390e2025', designYear: '2025', officialExport: false, designWarning: 'El diseño oficial del ejercicio 2026 todavía no está publicado/validado.' },
  '415': { name: 'Operaciones económicas con terceras personas', authority: 'ATC', frequency: 'anual', kind: 'informative', design: 'Programa de ayuda ATC', designYear: '2025', officialExport: false, designWarning: 'El fichero .dec se genera con el programa oficial de ayuda de la ATC; Taxea no debe fabricar un .dec sin especificación pública validada.' },
  '420': { name: 'Autoliquidación trimestral IGIC régimen general', authority: 'ATC', frequency: 'trimestral', kind: 'indirect_tax', design: 'Programa de ayuda ATC 2026', designYear: '2026', officialExport: false, designWarning: 'La ATC exige que el .dec se genere mediante su programa de ayuda.' },
  '425': { name: 'Resumen anual IGIC', authority: 'ATC', frequency: 'anual', kind: 'informative', design: 'Programa de ayuda ATC', designYear: '2025', officialExport: false, designWarning: 'El programa/diseño anual 2026 aún no está publicado/validado.' },
};

const SOURCES = [
  { title: 'AEAT - Diseños de registro, modelos 100 a 199', url: 'https://sede.agenciatributaria.gob.es/Sede/ayuda/disenos-registro/modelos-100-199.html' },
  { title: 'AEAT - Diseños de registro, modelos 300 a 399', url: 'https://sede.agenciatributaria.gob.es/Sede/ayuda/disenos-registro/modelos-300-399.html' },
  { title: 'AEAT - Instrucciones modelo 130', url: 'https://sede.agenciatributaria.gob.es/Sede/impuestos-tasas/impuesto-sobre-renta-personas-fisicas/modelo-130-irpf______esionales-estimacion-directa-fraccionado_/instrucciones.html' },
  { title: 'AEAT - Modelo 347, operaciones excluidas', url: 'https://sede.agenciatributaria.gob.es/Sede/todas-gestiones/impuestos-tasas/declaraciones-informativas/modelo-347-decla_____racion-anual-operaciones-personas_/operaciones-excluidas-modelo-347.html' },
  { title: 'ATC - Modelo 420', url: 'https://www3.gobiernodecanarias.org/tributos/atc/w/modelo-420' },
  { title: 'ATC - Modelo 415', url: 'https://www3.gobiernodecanarias.org/tributos/atc/w/modelo-415' },
  { title: 'ATC - Modelo 425', url: 'https://www3.gobiernodecanarias.org/tributos/atc/w/modelo-425' },
];

const money = (value: unknown) => Math.round((Number(value) || 0) * 100) / 100;
const clean = (value: unknown) => String(value ?? '').trim();
const unique = <T>(values: T[]) => [...new Set(values)];

function authorize(user: any, companyId: string) {
  const role = clean(user?.role).toLowerCase();
  if (['admin', 'super_admin', 'advisor', 'asesor'].includes(role)) return;
  if (!companyId || clean(user?.data?.company_id) !== companyId) {
    throw Object.assign(new Error('No tienes permiso para consultar la empresa seleccionada.'), { status: 403 });
  }
}

async function listAll(entity: any, filter: any, sort = '-created_date') {
  const rows: any[] = [];
  const limit = 500;
  for (let skip = 0; skip < 100000; skip += limit) {
    const page = await entity.filter(filter, sort, limit, skip);
    rows.push(...(page || []));
    if (!page || page.length < limit) break;
  }
  return rows;
}

function dateOf(item: any) {
  return clean(item.operationDate || item.fecha_operacion || item.fecha_emision || item.entryDate || item.date || item.fecha);
}

function bounds(year: number, period: string) {
  if (period === 'Anual') return { start: `${year}-01-01`, end: `${year}-12-31`, cumulativeStart: `${year}-01-01` };
  const monthMatch = /^(0[1-9]|1[0-2])$/.exec(period);
  if (monthMatch) {
    const month = Number(monthMatch[1]);
    const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return { start: `${year}-${period}-01`, end: `${year}-${period}-${String(last).padStart(2, '0')}`, cumulativeStart: `${year}-01-01` };
  }
  const quarter = Math.min(4, Math.max(1, Number(period.replace(/\D/g, '')) || 1));
  const firstMonth = (quarter - 1) * 3 + 1;
  const lastMonth = quarter * 3;
  const last = new Date(Date.UTC(year, lastMonth, 0)).getUTCDate();
  return {
    start: `${year}-${String(firstMonth).padStart(2, '0')}-01`,
    end: `${year}-${String(lastMonth).padStart(2, '0')}-${String(last).padStart(2, '0')}`,
    cumulativeStart: `${year}-01-01`,
  };
}

function inRange(item: any, start: string, end: string) {
  const date = dateOf(item).slice(0, 10);
  return !!date && date >= start && date <= end;
}

function invoiceCounterparty(invoice: any) {
  const received = invoice.tipo === 'recibida';
  return {
    id: clean(received ? invoice.proveedor_nif : invoice.cliente_nif),
    name: clean(received ? invoice.proveedor_nombre : invoice.cliente_nombre),
    province: clean(received ? invoice.proveedor_provincia : invoice.cliente_provincia),
    country: clean(received ? invoice.proveedor_pais : invoice.cliente_pais) || 'ES',
  };
}

function normalizedTaxLines(invoices: any[], taxLines: any[], warnings: string[], blockers: string[]) {
  const byInvoice = new Map<string, any[]>();
  taxLines.forEach(line => byInvoice.set(line.invoiceId, [...(byInvoice.get(line.invoiceId) || []), line]));
  const result: any[] = [];
  for (const invoice of invoices) {
    if (invoice.anulada) continue;
    const lines = byInvoice.get(invoice.id) || [];
    if (lines.length) {
      for (const line of lines) result.push({ ...line, invoice, sourceId: `InvoiceTaxLine:${line.id}`, date: dateOf(line) || dateOf(invoice) });
      continue;
    }
    const kind = clean(invoice.indirect_tax_kind || '').toLowerCase();
    const treatment = clean(invoice.fiscal_treatment || 'subject_taxed');
    result.push({
      invoice,
      sourceId: `Invoice:${invoice.id}`,
      date: dateOf(invoice),
      taxKind: kind || (invoice.tipo_iva != null ? 'iva' : 'no_aplica'),
      rate: Number(invoice.tipo_iva || 0),
      base: money(invoice.base_imponible),
      quota: money(invoice.cuota_iva),
      deductibleQuota: money(invoice.deductible_tax_amount ?? invoice.cuota_iva),
      nonDeductibleQuota: money(invoice.non_deductible_tax_amount),
      regime: clean(invoice.fiscal_treatment || 'general'),
      operationType: treatment,
      exemptionKey: clean(invoice.fiscal_exemption_key),
      legalBasis: clean(invoice.fiscal_legal_basis),
      reviewStatus: invoice.fiscal_review_status === 'validado' ? 'validado' : 'pendiente_revision',
      fallback: true,
    });
    warnings.push(`Factura ${invoice.numero_factura || invoice.id}: se usa la cabecera porque no tiene líneas fiscales normalizadas.`);
    if (invoice.fiscal_review_status !== 'validado') blockers.push(`Factura ${invoice.numero_factura || invoice.id}: tratamiento fiscal pendiente de revisión.`);
  }
  return result;
}

function addField(fields: any[], code: string, label: string, value: unknown, sourceIds: string[] = [], section = '') {
  fields.push({ code, label, value: money(value), sourceIds: unique(sourceIds), section });
}

function classifyRetainedInvoices(invoices: any[], periodBounds: any) {
  return invoices.filter(invoice => !invoice.anulada && invoice.tipo === 'recibida' && inRange(invoice, periodBounds.start, periodBounds.end) && money(invoice.importe_retencion || money(invoice.base_imponible) * Number(invoice.retencion_irpf || 0) / 100) !== 0);
}

function retentionAmount(invoice: any) {
  return money(invoice.importe_retencion || money(invoice.base_imponible) * Number(invoice.retencion_irpf || 0) / 100);
}

function calculate111(data: any, b: any) {
  const fields: any[] = [];
  const payrolls = data.payrolls.filter((p: any) => inRange(p, b.start, b.end));
  const invoices = classifyRetainedInvoices(data.invoices, b);
  const professional = invoices.filter((f: any) => f.categoria_gasto === 'servicios_profesionales');
  const unknown = invoices.filter((f: any) => !['servicios_profesionales', 'alquiler', 'gastos_financieros'].includes(f.categoria_gasto));
  const payrollBase = payrolls.reduce((s: number, p: any) => s + money(p.total_accruals ?? p.gross_salary), 0);
  const payrollTax = payrolls.reduce((s: number, p: any) => s + money(p.irpf_amount), 0);
  const proBase = professional.reduce((s: number, f: any) => s + money(f.base_imponible), 0);
  const proTax = professional.reduce((s: number, f: any) => s + retentionAmount(f), 0);
  if (unknown.length) data.blockers.push(`${unknown.length} factura(s) con retención sin clasificar como profesional, alquiler o capital mobiliario.`);
  const payrollIds = payrolls.map((p: any) => `PayrollExtraction:${p.id}`);
  const proIds = professional.map((f: any) => `Invoice:${f.id}`);
  addField(fields, '01', 'Perceptores rendimientos del trabajo dinerarios', unique(payrolls.map((p: any) => p.employee_tax_id || p.employee_name)).length, payrollIds, 'Trabajo');
  addField(fields, '02', 'Importe rendimientos del trabajo dinerarios', payrollBase, payrollIds, 'Trabajo');
  addField(fields, '03', 'Retenciones rendimientos del trabajo', payrollTax, payrollIds, 'Trabajo');
  addField(fields, '04', 'Perceptores actividades económicas dinerarias', unique(professional.map((f: any) => invoiceCounterparty(f).id || invoiceCounterparty(f).name)).length, proIds, 'Actividades económicas');
  addField(fields, '05', 'Importe actividades económicas dinerarias', proBase, proIds, 'Actividades económicas');
  addField(fields, '06', 'Retenciones actividades económicas', proTax, proIds, 'Actividades económicas');
  addField(fields, '28', 'Total retenciones e ingresos a cuenta', payrollTax + proTax, [...payrollIds, ...proIds], 'Liquidación');
  addField(fields, '30', 'Resultado a ingresar', payrollTax + proTax, [...payrollIds, ...proIds], 'Liquidación');
  if (payrolls.some((p: any) => p.confidence_global < 80 && !p.corrected_by_user)) data.blockers.push('Hay nóminas con confianza OCR inferior al 80% sin corrección validada.');
  return { fields, result: money(payrollTax + proTax), details: [...payrolls.map((p: any) => ({ type: 'nómina', id: p.id, name: p.employee_name, base: money(p.total_accruals ?? p.gross_salary), withholding: money(p.irpf_amount) })), ...professional.map((f: any) => ({ type: 'factura profesional', id: f.id, name: invoiceCounterparty(f).name, base: money(f.base_imponible), withholding: retentionAmount(f) }))] };
}

function calculateSimpleRetention(data: any, b: any, model: '115' | '123') {
  const category = model === '115' ? 'alquiler' : 'gastos_financieros';
  const invoices = classifyRetainedInvoices(data.invoices, b).filter((f: any) => f.categoria_gasto === category);
  const ids = invoices.map((f: any) => `Invoice:${f.id}`);
  const base = invoices.reduce((s: number, f: any) => s + money(f.base_imponible), 0);
  const tax = invoices.reduce((s: number, f: any) => s + retentionAmount(f), 0);
  const payees = unique(invoices.map((f: any) => invoiceCounterparty(f).id || invoiceCounterparty(f).name)).length;
  const fields: any[] = [];
  if (model === '115') {
    addField(fields, '01', 'Número de perceptores', payees, ids, 'Retenciones');
    addField(fields, '02', 'Base de retenciones', base, ids, 'Retenciones');
    addField(fields, '03', 'Retenciones e ingresos a cuenta', tax, ids, 'Retenciones');
    addField(fields, '05', 'Resultado a ingresar', tax, ids, 'Liquidación');
  } else {
    addField(fields, '03', 'Número total de rentas', payees, ids, 'Rentas');
    addField(fields, '06', 'Base total de retenciones', base, ids, 'Rentas');
    addField(fields, '09', 'Retenciones totales', tax, ids, 'Rentas');
    addField(fields, '12', 'Retenciones más regularización', tax, ids, 'Liquidación');
    addField(fields, '14', 'Resultado a ingresar', tax, ids, 'Liquidación');
  }
  return { fields, result: money(tax), details: invoices.map((f: any) => ({ type: model === '115' ? 'arrendamiento' : 'capital mobiliario', id: f.id, name: invoiceCounterparty(f).name, taxId: invoiceCounterparty(f).id, base: money(f.base_imponible), withholding: retentionAmount(f) })) };
}

function calculate130(data: any, b: any, adjustments: any) {
  const validEntryIds = new Set(data.entries.filter((e: any) => e.status === 'confirmado' && e.isBalanced !== false && inRange(e, b.cumulativeStart, b.end)).map((e: any) => e.id));
  const lines = data.entryLines.filter((line: any) => validEntryIds.has(line.journalEntryId));
  const account = (line: any) => clean(line.accountCode || line.subcuenta);
  const revenue = money(lines.filter((l: any) => /^7/.test(account(l))).reduce((s: number, l: any) => s + money(l.credit) - money(l.debit), 0));
  const expense = money(lines.filter((l: any) => /^6/.test(account(l))).reduce((s: number, l: any) => s + money(l.debit) - money(l.credit), 0));
  const net = money(revenue - expense);
  const grossPayment = money(Math.max(0, net * 0.2));
  const previous = money(adjustments.previousPayments);
  const withholdings = money(adjustments.withholdings ?? data.invoices.filter((f: any) => f.tipo === 'emitida' && inRange(f, b.cumulativeStart, b.end)).reduce((s: number, f: any) => s + retentionAmount(f), 0));
  const preliminary = money(grossPayment - previous - withholdings);
  const agricultureRevenue = money(adjustments.agricultureRevenue);
  const agricultureWithholdings = money(adjustments.agricultureWithholdings);
  const agriculturePayment = money(agricultureRevenue * 0.02 - agricultureWithholdings);
  const total = money(preliminary + agriculturePayment);
  const reduction = money(adjustments.article110Reduction);
  const priorNegative = money(adjustments.priorNegativeResults);
  const housing = money(adjustments.housingDeduction);
  const result = money(total - reduction - priorNegative - housing - money(adjustments.previousSamePeriodResult));
  const ids = lines.map((l: any) => `JournalEntryLine:${l.id}`);
  const fields: any[] = [];
  [['01','Ingresos computables acumulados',revenue],['02','Gastos fiscalmente deducibles acumulados',expense],['03','Rendimiento neto',net],['04','20% del rendimiento neto',grossPayment],['05','Pagos fraccionados anteriores',previous],['06','Retenciones soportadas acumuladas',withholdings],['07','Pago fraccionado previo',preliminary],['08','Ingresos agrícolas/ganaderos del trimestre',agricultureRevenue],['09','2% de ingresos agrícolas/ganaderos',money(agricultureRevenue * .02)],['10','Retenciones agrícolas/ganaderas',agricultureWithholdings],['11','Pago previo agrícola/ganadero',agriculturePayment],['12','Suma de pagos previos',total],['13','Minoración art. 110.3 RIRPF',reduction],['14','Diferencia',money(total-reduction)],['15','Resultados negativos anteriores',priorNegative],['16','Deducción vivienda habitual',housing],['17','Total',money(total-reduction-priorNegative-housing)],['19','Resultado de la autoliquidación',result]].forEach(([c,l,v]) => addField(fields, String(c), String(l), v, ids, 'Liquidación'));
  if (!lines.length) data.blockers.push('No hay asientos confirmados y cuadrados de grupos 6 y 7 para calcular el modelo 130.');
  if (data.profile?.irpfEstimation === 'objetiva_modulos') data.blockers.push('El perfil está en estimación objetiva: corresponde revisar el modelo 131, no el 130.');
  return { fields, result, details: [{ type: 'contabilidad acumulada', revenue, expense, entries: validEntryIds.size }] };
}

function calculateIndirectTax(data: any, b: any, kind: 'iva' | 'igic', annual = false) {
  const lines = data.taxLines.filter((line: any) => line.taxKind === kind && inRange(line, b.start, b.end));
  const fields: any[] = [];
  const rates = new Map<number, any>();
  const addRate = (rate: number, base: number, quota: number, id: string) => {
    const row = rates.get(rate) || { rate, base: 0, quota: 0, sourceIds: [] };
    row.base += base; row.quota += quota; row.sourceIds.push(id); rates.set(rate, row);
  };
  let deductibleBase = 0, deductibleQuota = 0, reverseBase = 0, reverseQuota = 0, intraBase = 0, intraQuota = 0;
  let exports = 0, intraSupplies = 0, exemptLimited = 0, nonSubject = 0, criterionCash = 0;
  for (const line of lines) {
    const invoice = line.invoice;
    const base = money(line.base), quota = money(line.quota), id = line.sourceId;
    const op = clean(line.operationType || 'subject_taxed');
    if (invoice.tipo === 'emitida') {
      if (['subject_taxed', 'subject_zero'].includes(op)) addRate(Number(line.rate || 0), base, quota, id);
      else if (op === 'intra_eu_supply') intraSupplies += base;
      else if (['export', 'exempt_full'].includes(op)) exports += base;
      else if (op === 'exempt_limited') exemptLimited += base;
      else if (['non_subject_article', 'non_subject_location', 'outside_scope'].includes(op)) nonSubject += base;
      else if (op === 'reverse_charge') reverseBase += base;
      if (line.regime === 'criterio_caja') criterionCash += base;
    } else {
      if (op === 'intra_eu_acquisition') { intraBase += base; intraQuota += quota; }
      else if (op === 'reverse_charge') { reverseBase += base; reverseQuota += quota; }
      deductibleBase += base;
      deductibleQuota += money(line.deductibleQuota ?? quota);
      if (line.reviewStatus !== 'validado') data.blockers.push(`Línea fiscal ${line.id || line.sourceId}: deducibilidad pendiente de revisión.`);
    }
  }
  for (const row of [...rates.values()].sort((a, z) => a.rate - z.rate)) addField(fields, `RATE_${row.rate}`, `Base y cuota al ${row.rate}%`, row.quota, row.sourceIds, `Devengado: base ${money(row.base).toFixed(2)} €`);
  const outputQuota = money([...rates.values()].reduce((s, r) => s + r.quota, 0) + intraQuota + reverseQuota);
  const result = money(outputQuota - deductibleQuota);
  addField(fields, 'DEVENGADO', 'Total cuota devengada', outputQuota, lines.filter((l: any) => l.invoice.tipo === 'emitida' || ['reverse_charge','intra_eu_acquisition'].includes(l.operationType)).map((l: any) => l.sourceId), 'Liquidación');
  addField(fields, 'DEDUCIBLE_BASE', 'Base de cuotas deducibles', deductibleBase, lines.filter((l: any) => l.invoice.tipo === 'recibida').map((l: any) => l.sourceId), 'Deducciones');
  addField(fields, 'DEDUCIBLE', 'Total cuota deducible', deductibleQuota, lines.filter((l: any) => l.invoice.tipo === 'recibida').map((l: any) => l.sourceId), 'Deducciones');
  addField(fields, 'RESULTADO', 'Resultado', result, lines.map((l: any) => l.sourceId), 'Liquidación');
  const operations = { rates: [...rates.values()].map(r => ({ ...r, base: money(r.base), quota: money(r.quota) })), outputQuota, deductibleBase: money(deductibleBase), deductibleQuota: money(deductibleQuota), reverseBase: money(reverseBase), reverseQuota: money(reverseQuota), intraBase: money(intraBase), intraQuota: money(intraQuota), exports: money(exports), intraSupplies: money(intraSupplies), exemptLimited: money(exemptLimited), nonSubject: money(nonSubject), criterionCash: money(criterionCash) };
  if (annual) return { fields, result, details: operations.rates, operations };
  return { fields, result, details: lines.map((l: any) => ({ type: l.invoice.tipo, id: l.invoice.id, invoice: l.invoice.numero_factura, operationType: l.operationType, rate: l.rate, base: money(l.base), quota: money(l.quota), deductibleQuota: money(l.deductibleQuota) })), operations };
}

function calculateThirdParties(data: any, b: any, model: '347' | '415') {
  const groups = new Map<string, any>();
  for (const invoice of data.invoices.filter((f: any) => !f.anulada && inRange(f, b.start, b.end))) {
    const cp = invoiceCounterparty(invoice);
    if (!cp.id) { data.blockers.push(`Factura ${invoice.numero_factura || invoice.id}: falta NIF de la contraparte.`); continue; }
    if (model === '347' && ['alquiler', 'servicios_profesionales', 'gastos_financieros'].includes(invoice.categoria_gasto) && retentionAmount(invoice) !== 0) continue;
    const row = groups.get(cp.id) || { taxId: cp.id, name: cp.name, country: cp.country, province: cp.province, total: 0, quarters: { T1: 0, T2: 0, T3: 0, T4: 0 }, invoices: [] };
    const amount = money(invoice.total_factura);
    row.total += amount;
    const month = Number(dateOf(invoice).slice(5, 7));
    const q = month <= 3 ? 'T1' : month <= 6 ? 'T2' : month <= 9 ? 'T3' : 'T4';
    row.quarters[q] += amount;
    row.invoices.push(invoice.id);
    groups.set(cp.id, row);
  }
  const details = [...groups.values()].filter(r => Math.abs(money(r.total)) > 3005.06).map(r => ({ ...r, total: money(r.total), quarters: Object.fromEntries(Object.entries(r.quarters).map(([k,v]) => [k,money(v)])) }));
  if (details.some(r => !r.name || (!r.province && (r.country === 'ES' || !r.country)))) data.blockers.push('Hay declarados sin nombre o provincia/código territorial obligatorio.');
  const fields: any[] = [];
  addField(fields, 'DECLARADOS', 'Terceros que superan 3.005,06 €', details.length, details.flatMap(r => r.invoices.map((id: string) => `Invoice:${id}`)), 'Resumen');
  addField(fields, 'IMPORTE', 'Importe anual declarado', details.reduce((s,r) => s + r.total, 0), details.flatMap(r => r.invoices.map((id: string) => `Invoice:${id}`)), 'Resumen');
  return { fields, result: 0, details };
}

function calculateAnnualRetention(data: any, b: any, model: '180'|'190'|'193') {
  if (model === '180') {
    const base = calculateSimpleRetention(data, b, '115');
    if (base.details.length) data.blockers.push('El modelo 180 exige referencia catastral, situación y dirección estructurada del inmueble; esos datos no existen todavía en la ficha de factura/contraparte.');
    return base;
  }
  if (model === '193') {
    const base = calculateSimpleRetention(data, b, '123');
    if (base.details.length) data.blockers.push('El modelo 193 exige clave de percepción, naturaleza, tipo de pago y datos identificativos adicionales por perceptor.');
    return base;
  }
  const base = calculate111(data, b);
  if (base.details.length) data.blockers.push('El modelo 190 exige clave/subclave, provincia, situación familiar y demás datos anuales del perceptor que no pueden inferirse de la nómina o factura.');
  return base;
}

function calculate(model: string, data: any, b: any, adjustments: any) {
  if (model === '111') return calculate111(data, b);
  if (model === '115' || model === '123') return calculateSimpleRetention(data, b, model);
  if (model === '130') return calculate130(data, b, adjustments);
  if (model === '303') return calculateIndirectTax(data, b, 'iva');
  if (model === '420') return calculateIndirectTax(data, b, 'igic');
  if (model === '390') return calculateIndirectTax(data, b, 'iva', true);
  if (model === '425') return calculateIndirectTax(data, b, 'igic', true);
  if (model === '347' || model === '415') return calculateThirdParties(data, b, model);
  if (model === '180' || model === '190' || model === '193') return calculateAnnualRetention(data, b, model);
  throw Object.assign(new Error(`Modelo ${model} no implementado.`), { status: 400 });
}

function normalizedText(value: unknown, length: number) {
  return clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9 &.,\/-]/g, ' ').replace(/\s+/g, ' ').slice(0, length).padEnd(length, ' ');
}

function numeric(value: unknown, length: number, signed = false, decimals = 2) {
  const amount = Number(value) || 0;
  const digits = String(Math.round(Math.abs(amount) * Math.pow(10, decimals)));
  if (signed && amount < 0) return `N${digits.padStart(length - 1, '0').slice(-(length - 1))}`;
  return digits.padStart(length, '0').slice(-length);
}

function place(buffer: string[], position: number, length: number, value: string) {
  const text = value.slice(0, length).padEnd(length, ' ');
  for (let i = 0; i < length; i++) buffer[position - 1 + i] = text[i];
}

function page(length: number, endPosition: number, endMarker: string) {
  const buffer = Array(length).fill(' ');
  place(buffer, endPosition, endMarker.length, endMarker);
  return buffer;
}

function fieldMap(calculation: any) {
  return Object.fromEntries((calculation.fields || []).map((f: any) => [f.code, Number(f.value) || 0]));
}

function declarationType(result: number) { return result > 0 ? 'I' : 'N'; }

function export111(company: any, year: number, period: string, calculation: any) {
  const values = fieldMap(calculation), p = page(1000, 989, '</T11101000>');
  place(p,1,11,'<T11101000>'); place(p,13,1,declarationType(calculation.result)); place(p,14,9,normalizedText(company.nif_cif,9)); place(p,23,60,normalizedText(company.razon_social,60)); place(p,83,20,' '.repeat(20)); place(p,103,4,String(year)); place(p,107,2,period);
  place(p,109,8,numeric(values['01'],8,false,0)); place(p,117,17,numeric(values['02'],17)); place(p,134,17,numeric(values['03'],17)); place(p,193,8,numeric(values['04'],8,false,0)); place(p,201,17,numeric(values['05'],17)); place(p,218,17,numeric(values['06'],17)); place(p,487,17,numeric(values['28'],17)); place(p,504,17,numeric(0,17,true)); place(p,521,17,numeric(values['30'],17));
  return p.join('');
}

function export115(company: any, year: number, period: string, calculation: any) {
  const v=fieldMap(calculation), p=page(500,489,'</T11501000>'); place(p,1,11,'<T11501000>'); place(p,13,1,declarationType(calculation.result)); place(p,14,9,normalizedText(company.nif_cif,9)); place(p,23,60,normalizedText(company.razon_social,60)); place(p,103,4,String(year)); place(p,107,2,period); place(p,109,15,numeric(v['01'],15,false,0)); place(p,124,17,numeric(v['02'],17)); place(p,141,17,numeric(v['03'],17)); place(p,158,17,numeric(0,17)); place(p,175,17,numeric(v['05'],17)); return p.join('');
}

function export123(company: any, year: number, period: string, calculation: any) {
  const v=fieldMap(calculation), p=page(600,589,'</T12301000>'); place(p,1,11,'<T12301000>'); place(p,13,1,declarationType(calculation.result)); place(p,14,9,normalizedText(company.nif_cif,9)); place(p,23,80,normalizedText(company.razon_social,80)); place(p,103,4,String(year)); place(p,107,2,period); place(p,109,15,numeric(0,15,false,0)); place(p,124,15,numeric(v['03'],15,false,0)); place(p,139,15,numeric(v['03'],15,false,0)); place(p,154,17,numeric(0,17)); place(p,171,17,numeric(v['06'],17)); place(p,188,17,numeric(v['06'],17)); place(p,205,17,numeric(0,17)); place(p,222,17,numeric(v['09'],17)); place(p,239,17,numeric(v['09'],17)); place(p,290,17,numeric(v['12'],17)); place(p,307,17,numeric(0,17)); place(p,324,17,numeric(v['14'],17)); return p.join('');
}

function export130(company: any, year: number, period: string, calculation: any) {
  const v=fieldMap(calculation), p=page(600,589,'</T13001000>'); place(p,1,11,'<T13001000>'); place(p,13,1,declarationType(calculation.result)); place(p,14,9,normalizedText(company.nif_cif,9)); place(p,23,60,normalizedText(company.razon_social,60)); place(p,103,4,String(year)); place(p,107,2,period);
  const positions:any={'01':109,'02':126,'03':143,'04':160,'05':177,'06':194,'07':211,'08':228,'09':245,'10':262,'11':279,'12':296,'13':313,'14':330,'15':347,'16':364,'17':381,'18':398,'19':415}; const signed=new Set(['03','07','11','14','17','19']); Object.entries(positions).forEach(([code,pos])=>place(p,Number(pos),17,numeric(v[code]||0,17,signed.has(code)))); return p.join('');
}

function export303(company: any, profile: any, year: number, period: string, calculation: any) {
  const o=calculation.operations||{}, rates=new Map((o.rates||[]).map((r:any)=>[Number(r.rate),r]));
  const p1=page(1581,1570,'</T30301000>'); place(p1,1,11,'<T30301000>'); place(p1,13,1,declarationType(calculation.result)); place(p1,14,9,normalizedText(company.nif_cif,9)); place(p1,23,80,normalizedText(company.razon_social,80)); place(p1,103,4,String(year)); place(p1,107,2,period); place(p1,109,1,'2'); place(p1,110,1,profile?.isREDEME?'1':'2'); place(p1,111,1,'3'); place(p1,112,1,'2'); place(p1,113,1,profile?.indirectTaxDefault==='criterio_caja'?'1':'2'); place(p1,114,1,'2'); place(p1,115,1,'2'); place(p1,116,1,'2'); place(p1,117,1,'2'); place(p1,127,1,profile?.usesSII?'1':'2'); place(p1,128,1,['4T','12'].includes(period)?'2':'0'); place(p1,129,1,['4T','12'].includes(period)?'1':'0'); place(p1,130,1,['01','1T','2T','3T','4T'].includes(period)?'0':'2');
  const rateFields:any={0:[131,148,153],4:[209,226,231],10:[287,304,309],21:[326,343,348]}; for(const [rate,positions] of Object.entries(rateFields)){const row:any=rates.get(Number(rate))||{}; place(p1,positions[0],17,numeric(row.base,17)); place(p1,positions[1],5,numeric(Number(rate),5,false,2)); place(p1,positions[2],17,numeric(row.quota,17));}
  place(p1,365,17,numeric(o.intraBase,17)); place(p1,382,17,numeric(o.intraQuota,17)); place(p1,399,17,numeric(o.reverseBase,17)); place(p1,416,17,numeric(o.reverseQuota,17)); place(p1,696,17,numeric(o.outputQuota,17,true)); place(p1,713,17,numeric(o.deductibleBase,17)); place(p1,730,17,numeric(o.deductibleQuota,17)); place(p1,1002,17,numeric(o.deductibleQuota,17,true)); place(p1,1019,17,numeric(calculation.result,17,true));
  const p3=page(1017,1006,'</T30303000>'); place(p3,1,11,'<T30303000>'); place(p3,12,17,numeric(o.intraSupplies,17,true)); place(p3,29,17,numeric(o.exports,17,true)); place(p3,46,17,numeric(o.nonSubject,17,true)); place(p3,63,17,numeric(o.reverseBase,17,true)); place(p3,199,17,numeric(calculation.result,17,true)); place(p3,216,5,numeric(100,5,false,2)); place(p3,221,17,numeric(calculation.result,17,true)); place(p3,340,17,numeric(calculation.result,17,true)); place(p3,408,17,numeric(calculation.result,17,true)); place(p3,425,1,(calculation.details||[]).length?' ':'X');
  return p1.join('')+p3.join('');
}

function wrap(model: string, year: number, period: string, pages: string, developerTaxId: string) {
  const prefix=`<T${model}0${year}${period}0000><AUX>${' '.repeat(70)}TX01${' '.repeat(4)}${normalizedText(developerTaxId,9)}${' '.repeat(213)}</AUX>`;
  const suffix=`</T${model}0${year}${period}0000>`;
  return prefix+pages+suffix;
}

async function sha256(text: string) {
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
}

function encodeBase64(text: string) {
  const bytes=new TextEncoder().encode(text); let binary=''; for(let i=0;i<bytes.length;i+=0x8000) binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000)); return btoa(binary);
}

Deno.serve(async (req) => {
  try {
    const base44=createClientFromRequest(req); const user=await base44.auth.me();
    if(!user) return Response.json({error:'Unauthorized'},{status:401});
    const body=await req.json().catch(()=>({})); const action=clean(body.action||'catalog');
    if(action==='catalog') return Response.json({ok:true,engineVersion:ENGINE_VERSION,models:TARGET_MODELS.map(code=>({code,...DEFINITIONS[code]})),recommendedExtensions:[{code:'349',reason:'Operaciones intracomunitarias'},{code:'131',reason:'Estimación objetiva'},{code:'417',reason:'IGIC con SII'},{code:'421',reason:'IGIC régimen simplificado'},{code:'216/296',reason:'Retenciones a no residentes'}],sources:SOURCES});
    if(action==='self_test') {
      const company={nif_cif:'B12345678',razon_social:'TAXEA PRUEBA'}; const profile={isREDEME:false,usesSII:false};
      const standard={result:21,fields:[{code:'01',value:1},{code:'02',value:100},{code:'03',value:15},{code:'04',value:1},{code:'05',value:100},{code:'06',value:15},{code:'28',value:30},{code:'30',value:30},{code:'09',value:19},{code:'12',value:19},{code:'14',value:19},{code:'19',value:20}],details:[{}],operations:{rates:[{rate:21,base:100,quota:21}],outputQuota:21,deductibleBase:0,deductibleQuota:0,reverseBase:0,reverseQuota:0,intraBase:0,intraQuota:0,exports:0,intraSupplies:0,nonSubject:0}};
      const samples:any={111:export111(company,2026,'1T',standard),115:export115(company,2026,'1T',standard),123:export123(company,2026,'1T',standard),130:export130(company,2026,'1T',standard),303:export303(company,profile,2026,'1T',standard)};
      const expected:any={111:1000,115:500,123:600,130:600,303:2598}; const checks=Object.entries(samples).map(([model,content]:any)=>({model,length:content.length,expected:expected[model],validLength:content.length===expected[model],hasEndMarker:content.includes(`</T${model}0`),hasNaN:content.includes('NaN')}));
      const wrappedChecks=Object.entries(samples).map(([model,content]:any)=>{const wrapped=wrap(model,2026,'1T',content,'B12345678'); return {model,length:wrapped.length,validEnvelope:wrapped.startsWith(`<T${model}020261T0000>`)&&wrapped.endsWith(`</T${model}020261T0000>`)}});
      const ok=checks.every((c:any)=>c.validLength&&c.hasEndMarker&&!c.hasNaN)&&wrappedChecks.every((c:any)=>c.validEnvelope); return Response.json({ok,engineVersion:ENGINE_VERSION,checks,wrappedChecks});
    }
    const companyId=clean(body.companyId); const model=clean(body.modeloCodigo); const year=Number(body.ejercicio); const period=clean(body.periodo||'Anual');
    if(!companyId||(!TARGET_MODELS.includes(model)&&action!=='calculate_bundle')||!year) return Response.json({error:'companyId, modeloCodigo y ejercicio son obligatorios.'},{status:400});
    authorize(user,companyId); const svc=base44.asServiceRole;
    const [company,profiles,activities,invoices,rawTaxLines,payrolls,entries,entryLines]=await Promise.all([
      svc.entities.Company.get(companyId), listAll(svc.entities.FiscalProfile,{company_id:companyId}), listAll(svc.entities.FiscalActivity,{company_id:companyId}), listAll(svc.entities.Invoice,{company_id:companyId}), listAll(svc.entities.InvoiceTaxLine,{companyId}), listAll(svc.entities.PayrollExtraction,{company_id:companyId}), listAll(svc.entities.JournalEntry,{companyId}), listAll(svc.entities.JournalEntryLine,{companyId}),
    ]);
    if(!company) return Response.json({error:'Empresa no encontrada.'},{status:404});
    const profile=profiles.find((p:any)=>p.active!==false)||profiles[0]||null; const blockers:string[]=[]; const warnings:string[]=[];
    if(!company.nif_cif) blockers.push('La empresa no tiene NIF/CIF configurado.');
    if(!profile) blockers.push('Falta el perfil fiscal de la empresa.'); else if(profile.profileStatus!=='validado_asesor') warnings.push('El perfil fiscal no consta como validado por asesor.');
    const taxLines=normalizedTaxLines(invoices,rawTaxLines,warnings,blockers); const b=bounds(year,period);
    const data={company,profile,activities,invoices,taxLines,payrolls,entries,entryLines,blockers,warnings};
    if(action==='calculate_bundle') {
      const models=TARGET_MODELS.map(code=>{
        const annual=['180','190','193','347','390','415','425'].includes(code); const modelBounds=bounds(year,annual?'Anual':'1T'); const modelData={...data,blockers:[...blockers],warnings:[...warnings]}; const modelCalculation=calculate(code,modelData,modelBounds,{}); return {code,fields:modelCalculation.fields?.length||0,details:modelCalculation.details?.length||0,result:money(modelCalculation.result),blockers:unique(modelData.blockers),warnings:unique(modelData.warnings)};
      });
      return Response.json({ok:true,engineVersion:ENGINE_VERSION,models,sourceStats:{invoices:invoices.length,taxLines:taxLines.length,payrolls:payrolls.length,journalEntries:entries.length}});
    }
    const calculation=calculate(model,data,b,body.adjustments||{}); const sourceIds=unique((calculation.fields||[]).flatMap((f:any)=>f.sourceIds||[])); const sourceHash=await sha256(JSON.stringify({model,year,period,sourceIds,values:(calculation.fields||[]).map((f:any)=>[f.code,f.value])}));
    const result={ok:true,engineVersion:ENGINE_VERSION,definition:{code:model,...DEFINITIONS[model]},company:{id:company.id,name:company.razon_social||company.nombre_comercial,taxId:company.nif_cif},period:{year,period,...b},calculation:{...calculation,result:money(calculation.result)},validation:{blockers:unique(blockers),warnings:unique(warnings),canSaveDraft:true,canExportOfficial:DEFINITIONS[model].officialExport&&blockers.length===0},source:{hash:sourceHash,count:sourceIds.length,ids:sourceIds,stats:{invoices:invoices.filter((f:any)=>!f.anulada&&inRange(f,b.start,b.end)).length,taxLines:taxLines.filter((l:any)=>inRange(l,b.start,b.end)).length,payrolls:payrolls.filter((p:any)=>inRange(p,b.start,b.end)).length,journalEntries:entries.filter((e:any)=>inRange(e,b.start,b.end)).length}},sources:SOURCES};
    if(action==='calculate') return Response.json(result);
    if(action==='save_draft') {
      const payload={companyId,modeloCodigo:model,ejercicio:year,periodo:period,version:1,origenDatos:`${ENGINE_VERSION}:${sourceHash}`,resumen:{definition:result.definition,calculation:result.calculation,source:result.source},validaciones:result.validation.warnings.map((message:string)=>({severity:'warning',message})),errores:result.validation.blockers.map((message:string)=>({severity:'blocker',message})),ajustesManuales:Object.entries(body.adjustments||{}).map(([field,value])=>({field,value,reason:clean(body.adjustmentReason)})),usuarioCreador:user.email,estado:result.validation.blockers.length?'en_revision':'borrador',notas:clean(body.notes)};
      const existing=await svc.entities.TaxDraft.filter({companyId,modeloCodigo:model,ejercicio:year,periodo:period},'-created_date',1); const draft=existing?.[0]?await svc.entities.TaxDraft.update(existing[0].id,{...payload,version:Number(existing[0].version||0)+1}):await svc.entities.TaxDraft.create(payload); return Response.json({...result,draft});
    }
    if(action==='export') {
      if(!DEFINITIONS[model].officialExport) return Response.json({ok:false,error:'El diseño no está habilitado para exportación oficial segura.',blockers:[DEFINITIONS[model].designWarning||'Falta validar el diseño y todos los datos de detalle exigidos por la Administración.']},{status:422});
      if(blockers.length) return Response.json({ok:false,error:'La exportación está bloqueada por incidencias fiscales.',blockers:unique(blockers),warnings:unique(warnings)},{status:422});
      if(['303'].includes(model)&&activities.some((a:any)=>['simplificado','grupo_entidades'].includes(a.indirectTaxRegime))) return Response.json({ok:false,error:'El perfil requiere páginas/regímenes especiales no exportables de forma automática.',blockers:['Revisa régimen simplificado/grupo de entidades y utiliza el modelo específico aplicable.']},{status:422});
      const developerTaxId=clean(Deno.env.get('TAXEA_DEVELOPER_NIF')); if(!developerTaxId) return Response.json({ok:false,error:'Falta configurar TAXEA_DEVELOPER_NIF para completar el diseño oficial AEAT.',blockers:['Añade el NIF de la entidad desarrolladora como secreto de backend antes de exportar.']},{status:422});
      const exporters:any={'111':export111,'115':export115,'123':export123,'130':export130}; const pages=model==='303'?export303(company,profile,year,period,calculation):exporters[model](company,year,period,calculation); const content=wrap(model,year,period,pages,developerTaxId); const hash=await sha256(content); const filename=`${clean(company.nif_cif).toUpperCase()}${year}${period}.${model}`;
      const record=await svc.entities.TaxOfficialFile.create({companyId,modeloCodigo:model,ejercicio:year,periodo:period,administracion:'AEAT',nombreFichero:filename,extension:model,formato:'Diseño de registro AEAT',versionDiseno:DEFINITIONS[model].design,hash,generadoPor:user.email,fechaGeneracion:new Date().toISOString(),estado:'generado',errores:[],avisos:unique(warnings),resumenLegible:JSON.stringify({engineVersion:ENGINE_VERSION,sourceHash,result:calculation.result})});
      return Response.json({...result,file:{id:record.id,filename,extension:model,format:'Diseño de registro AEAT',design:DEFINITIONS[model].design,hash,contentBase64:encodeBase64(content)}});
    }
    if(action==='export_review') {
      const content=JSON.stringify({...result,exportNotice:'Borrador técnico de revisión. No presentable ante AEAT/ATC.'},null,2); return Response.json({...result,file:{filename:`${model}_${year}_${period}_revision_taxea.json`,extension:'json',format:'Borrador técnico de revisión',hash:await sha256(content),contentBase64:encodeBase64(content)}});
    }
    return Response.json({error:'Acción no soportada.'},{status:400});
  } catch(error){const status=Number((error as any)?.status)||500; return Response.json({error:(error as Error).message||'Error interno'},{status});}
});

