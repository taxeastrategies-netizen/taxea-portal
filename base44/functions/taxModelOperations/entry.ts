import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';

const ENGINE_VERSION = 'taxea-modelos-2026.09.10-v4';
const TARGET_MODELS = ['111', '115', '123', '130', '180', '190', '193', '303', '347', '390', '415', '420', '425'];

const DEFINITIONS: Record<string, any> = {
  '111': { name: 'Retenciones de trabajo y actividades económicas', authority: 'AEAT', frequency: 'trimestral/mensual', kind: 'withholding', design: 'EHA/3127/2009 v1.8', designYear: '2019+', officialExport: true },
  '115': { name: 'Retenciones por arrendamientos urbanos', authority: 'AEAT', frequency: 'trimestral/mensual', kind: 'withholding', design: 'EHA/3435/2007 v1.3', designYear: '2019+', officialExport: true },
  '123': { name: 'Retenciones de capital mobiliario y otras rentas', authority: 'AEAT', frequency: 'trimestral/mensual', kind: 'withholding', design: 'EHA/3435/2007 v2.0', designYear: '2024+', officialExport: true },
  '130': { name: 'Pago fraccionado IRPF en estimación directa', authority: 'AEAT', frequency: 'trimestral', kind: 'income_tax', design: 'HAP/258/2015 v1.2', designYear: '2019+', officialExport: true },
  '180': { name: 'Resumen anual de arrendamientos urbanos', authority: 'AEAT', frequency: 'anual', kind: 'informative', design: 'HAP/1732/2014 - diseño vigente ejercicio 2023+', designYear: '2023+', officialExport: true, exportMode: 'aeat_record_design' },
  '190': { name: 'Resumen anual de trabajo y actividades económicas', authority: 'AEAT', frequency: 'anual', kind: 'informative', design: 'HAC/1431/2025', designYear: '2025+', officialExport: false },
  '193': { name: 'Resumen anual de capital mobiliario y otras rentas', authority: 'AEAT', frequency: 'anual', kind: 'informative', design: 'HAC/1430/2025', designYear: '2025+', officialExport: false },
  '303': { name: 'Autoliquidación IVA', authority: 'AEAT', frequency: 'trimestral/mensual', kind: 'indirect_tax', design: 'DR303e26 v1.01', designYear: '2026+', officialExport: true },
  '347': { name: 'Operaciones con terceras personas', authority: 'AEAT', frequency: 'anual', kind: 'informative', design: 'HAC/1431/2025', designYear: '2025+', officialExport: true, exportMode: 'aeat_record_design' },
  '390': { name: 'Resumen anual IVA', authority: 'AEAT', frequency: 'anual', kind: 'informative', design: 'DR390e2025', designYear: '2025', officialExport: false, designWarning: 'El diseño oficial del ejercicio 2026 todavía no está publicado/validado.' },
  '415': { name: 'Operaciones económicas con terceras personas', authority: 'ATC', frequency: 'anual', kind: 'informative', design: 'BOC 41/2015 + Programa de ayuda ATC 2025', designYear: '2025', officialExport: true, exportMode: 'atc_program_import', designWarning: 'Taxea genera el soporte oficial de importación de declarados. El programa ATC debe importarlo, validarlo y generar el .dec final.' },
  '420': { name: 'Autoliquidación trimestral IGIC régimen general', authority: 'ATC', frequency: 'trimestral', kind: 'indirect_tax', design: 'Programa de ayuda ATC 2026 v9.3.0', designYear: '2026', officialExport: false, exportMode: 'atc_guided_packet', handoffExport: true, designWarning: 'La ATC no publica un formato de importación externo para este modelo: el .dec presentable debe generarse y validarse en su programa de ayuda.' },
  '425': { name: 'Resumen anual IGIC', authority: 'ATC', frequency: 'anual', kind: 'informative', design: 'Programa de ayuda ATC 2025 v6.3.1', designYear: '2025', officialExport: false, exportMode: 'atc_guided_packet', handoffExport: true, designWarning: 'La ATC no publica un formato de importación externo para este modelo y el programa anual 2026 aún no está disponible. El .dec presentable debe generarse y validarse en el programa oficial.' },
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
  const direct = clean(item.operationDate || item.payment_date || item.fecha_operacion || item.fecha_emision || item.entryDate || item.date || item.fecha || item.ultimo_pago_at);
  if (direct) return direct;
  const label = clean(item.period_label);
  const yearMonth = /^(\d{4})[-/](\d{1,2})/.exec(label);
  if (yearMonth) return `${yearMonth[1]}-${String(Number(yearMonth[2])).padStart(2, '0')}-01`;
  const monthYear = /^(\d{1,2})[-/](\d{4})/.exec(label);
  if (monthYear) return `${monthYear[2]}-${String(Number(monthYear[1])).padStart(2, '0')}-01`;
  return '';
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

const PROVINCE_CODES: Record<string, string> = {
  ALAVA:'01',ARABA:'01',ALBACETE:'02',ALICANTE:'03',ALACANT:'03',ALMERIA:'04',AVILA:'05',BADAJOZ:'06',BALEARES:'07','ILLES BALEARS':'07',BARCELONA:'08',BURGOS:'09',CACERES:'10',CADIZ:'11',CASTELLON:'12',CASTELLO:'12','CIUDAD REAL':'13',CORDOBA:'14','A CORUNA':'15',CORUNA:'15',CUENCA:'16',GIRONA:'17',GRANADA:'18',GUADALAJARA:'19',GUIPUZCOA:'20',GIPUZKOA:'20',HUELVA:'21',HUESCA:'22',JAEN:'23',LEON:'24',LLEIDA:'25','LA RIOJA':'26',RIOJA:'26',LUGO:'27',MADRID:'28',MALAGA:'29',MURCIA:'30',NAVARRA:'31',OURENSE:'32',ASTURIAS:'33',PALENCIA:'34','LAS PALMAS':'35',PALMAS:'35',PONTEVEDRA:'36',SALAMANCA:'37','SANTA CRUZ DE TENERIFE':'38','S C TENERIFE':'38',TENERIFE:'38',CANTABRIA:'39',SEGOVIA:'40',SEVILLA:'41',SORIA:'42',TARRAGONA:'43',TERUEL:'44',TOLEDO:'45',VALENCIA:'46',VALLADOLID:'47',VIZCAYA:'48',BIZKAIA:'48',ZAMORA:'49',ZARAGOZA:'50',CEUTA:'51',MELILLA:'52','ISLA DE LA PALMA':'53','LA PALMA':'53',
};

function canonical(value: unknown) {
  return clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizedCountry(value: unknown) {
  const code = canonical(value);
  if (!code || ['ES', 'ESPANA', 'SPAIN'].includes(code)) return 'ES';
  return /^[A-Z]{2}$/.test(code) ? code : '';
}

function provinceCode(value: unknown) {
  const code = canonical(value);
  if (/^\d{2}$/.test(code)) return code;
  return PROVINCE_CODES[code] || '';
}

function validSpanishTaxId(value: unknown) {
  return /^[A-Z0-9]{9}$/.test(canonical(value).replace(/\s/g, ''));
}

function normalizedTaxLines(invoices: any[], taxLines: any[], warnings: string[], blockers: string[]) {
  const byInvoice = new Map<string, any[]>();
  taxLines.forEach(line => byInvoice.set(line.invoiceId, [...(byInvoice.get(line.invoiceId) || []), line]));
  const result: any[] = [];
  let fallbackCount = 0;
  let pendingFallbackCount = 0;
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
    fallbackCount += 1;
    if (invoice.fiscal_review_status !== 'validado') pendingFallbackCount += 1;
  }
  if (fallbackCount) warnings.push(`${fallbackCount} factura(s) usan temporalmente la cabecera porque no tienen líneas fiscales normalizadas.`);
  if (pendingFallbackCount) warnings.push(`${pendingFallbackCount} factura(s) sin líneas fiscales normalizadas siguen pendientes de revisión; solo bloquearán los modelos IVA/IGIC afectados.`);
  return result;
}

function addField(fields: any[], code: string, label: string, value: unknown, sourceIds: string[] = [], section = '') {
  fields.push({ code, label, value: money(value), sourceIds: unique(sourceIds), section });
}

function retentionAmount(invoice: any) {
  return money(invoice.importe_retencion || money(invoice.base_imponible) * Number(invoice.retencion_irpf || 0) / 100);
}

function retainedPaymentEvents(data: any, periodBounds: any) {
  const paymentsByInvoice = new Map<string, any[]>();
  for (const payment of data.invoicePayments || []) {
    if (!inRange(payment, periodBounds.start, periodBounds.end)) continue;
    paymentsByInvoice.set(payment.invoice_id, [...(paymentsByInvoice.get(payment.invoice_id) || []), payment]);
  }
  const events: any[] = [];
  let missingPaymentTrace = 0;
  for (const invoice of data.invoices.filter((item: any) => !item.anulada && item.tipo === 'recibida' && retentionAmount(item) !== 0)) {
    const payments = paymentsByInvoice.get(invoice.id) || [];
    let factor = 0;
    let sourceIds: string[] = [];
    if (payments.length) {
      const paidInPeriod = payments.reduce((sum: number, payment: any) => sum + Math.abs(money(payment.amount)), 0);
      const payable = Math.abs(money(invoice.total_factura)) || Math.abs(money(invoice.base_imponible) + money(invoice.cuota_iva) - retentionAmount(invoice));
      factor = payable ? Math.min(1, paidInPeriod / payable) : 0;
      sourceIds = payments.map((payment: any) => `InvoicePayment:${payment.id}`);
    } else if (invoice.estado_cobro === 'cobrada' && invoice.ultimo_pago_at && inRange({ date: invoice.ultimo_pago_at }, periodBounds.start, periodBounds.end)) {
      factor = 1;
      sourceIds = [`Invoice:${invoice.id}`];
      data.warnings.push(`La factura ${clean(invoice.numero_factura) || invoice.id} usa ultimo_pago_at porque no tiene detalle InvoicePayment.`);
    } else if (inRange(invoice, periodBounds.start, periodBounds.end)) {
      missingPaymentTrace += 1;
    }
    if (factor > 0) events.push({ invoice, factor, sourceIds, base: money(money(invoice.base_imponible) * factor), withholding: money(retentionAmount(invoice) * factor) });
  }
  if (missingPaymentTrace) data.blockers.push(`${missingPaymentTrace} factura(s) con retención del periodo no tienen pago trazado; las retenciones se declaran por el pago y no se han incluido automáticamente.`);
  return events;
}

function calculate111(data: any, b: any) {
  const fields: any[] = [];
  const payrolls = data.payrolls.filter((p: any) => inRange(p, b.start, b.end));
  const payments = retainedPaymentEvents(data, b);
  const professional = payments.filter((event: any) => event.invoice.categoria_gasto === 'servicios_profesionales');
  const unknown = payments.filter((event: any) => !['servicios_profesionales', 'alquiler', 'gastos_financieros'].includes(event.invoice.categoria_gasto));
  const payrollBase = payrolls.reduce((s: number, p: any) => s + money(p.total_accruals ?? p.gross_salary), 0);
  const payrollTax = payrolls.reduce((s: number, p: any) => s + money(p.irpf_amount), 0);
  const proBase = professional.reduce((s: number, event: any) => s + event.base, 0);
  const proTax = professional.reduce((s: number, event: any) => s + event.withholding, 0);
  if (unknown.length) data.blockers.push(`${unknown.length} factura(s) con retención sin clasificar como profesional, alquiler o capital mobiliario.`);
  const payrollIds = payrolls.map((p: any) => `PayrollExtraction:${p.id}`);
  const proIds = professional.flatMap((event: any) => event.sourceIds);
  addField(fields, '01', 'Perceptores rendimientos del trabajo dinerarios', unique(payrolls.map((p: any) => p.employee_tax_id || p.employee_name)).length, payrollIds, 'Trabajo');
  addField(fields, '02', 'Importe rendimientos del trabajo dinerarios', payrollBase, payrollIds, 'Trabajo');
  addField(fields, '03', 'Retenciones rendimientos del trabajo', payrollTax, payrollIds, 'Trabajo');
  addField(fields, '04', 'Perceptores actividades económicas dinerarias', unique(professional.map((event: any) => invoiceCounterparty(event.invoice).id || invoiceCounterparty(event.invoice).name)).length, proIds, 'Actividades económicas');
  addField(fields, '05', 'Importe actividades económicas dinerarias', proBase, proIds, 'Actividades económicas');
  addField(fields, '06', 'Retenciones actividades económicas', proTax, proIds, 'Actividades económicas');
  addField(fields, '28', 'Total retenciones e ingresos a cuenta', payrollTax + proTax, [...payrollIds, ...proIds], 'Liquidación');
  addField(fields, '30', 'Resultado a ingresar', payrollTax + proTax, [...payrollIds, ...proIds], 'Liquidación');
  if (payrolls.some((p: any) => p.confidence_global < 80 && !p.corrected_by_user)) data.blockers.push('Hay nóminas con confianza OCR inferior al 80% sin corrección validada.');
  if (data.payrolls.some((p: any) => !dateOf(p))) data.blockers.push('Hay nóminas sin periodo normalizado; no se han podido asignar con seguridad al modelo 111.');
  return { fields, result: money(payrollTax + proTax), details: [...payrolls.map((p: any) => ({ type: 'nómina', id: p.id, name: p.employee_name, base: money(p.total_accruals ?? p.gross_salary), withholding: money(p.irpf_amount) })), ...professional.map((event: any) => ({ type: 'factura profesional pagada', id: event.invoice.id, name: invoiceCounterparty(event.invoice).name, base: event.base, withholding: event.withholding, paymentSources: event.sourceIds }))] };
}

function calculateSimpleRetention(data: any, b: any, model: '115' | '123') {
  const category = model === '115' ? 'alquiler' : 'gastos_financieros';
  const events = retainedPaymentEvents(data, b).filter((event: any) => event.invoice.categoria_gasto === category);
  const ids = events.flatMap((event: any) => event.sourceIds);
  const base = events.reduce((sum: number, event: any) => sum + event.base, 0);
  const tax = events.reduce((sum: number, event: any) => sum + event.withholding, 0);
  const payees = unique(events.map((event: any) => invoiceCounterparty(event.invoice).id || invoiceCounterparty(event.invoice).name)).length;
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
  return { fields, result: money(tax), details: events.map((event: any) => ({ type: model === '115' ? 'arrendamiento pagado' : 'capital mobiliario pagado', id: event.invoice.id, name: invoiceCounterparty(event.invoice).name, taxId: invoiceCounterparty(event.invoice).id, base: event.base, withholding: event.withholding, paymentSources: event.sourceIds })) };
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
  if (data.period !== '1T' && adjustments.previousPayments == null) data.blockers.push('En 2T, 3T o 4T debe confirmarse manualmente el importe de pagos fraccionados anteriores (casilla 05).');
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
  let pendingReviewLines = 0;
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
    }
    if (line.reviewStatus !== 'validado') pendingReviewLines += 1;
  }
  if (pendingReviewLines) data.blockers.push(`${pendingReviewLines} línea(s) fiscales recibidas tienen la deducibilidad pendiente de revisión.`);
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
  const totalsByTaxId = new Map<string, number>();
  const missingGroups = new Map<string, number>();
  let excluded347 = 0;
  for (const invoice of data.invoices.filter((f: any) => !f.anulada && inRange(f, b.start, b.end))) {
    const cp = invoiceCounterparty(invoice);
    const amount = money(invoice.total_factura);
    if (!cp.id) {
      const missingKey = cp.name || 'CONTRAPARTE_SIN_IDENTIFICAR';
      missingGroups.set(missingKey, money((missingGroups.get(missingKey) || 0) + Math.abs(amount)));
      continue;
    }
    const operation = clean(invoice.fiscal_treatment || invoice.indirect_tax_treatment);
    const separatelyReported = ['alquiler', 'servicios_profesionales', 'gastos_financieros'].includes(invoice.categoria_gasto) && retentionAmount(invoice) !== 0;
    const territoriallyExcluded = ['import', 'export', 'canary_peninsula_goods', 'intra_eu_supply', 'intra_eu_acquisition'].includes(operation);
    if (model === '347' && (separatelyReported || territoriallyExcluded)) { excluded347 += 1; continue; }
    const operationKey = invoice.tipo === 'emitida' ? 'B' : 'A';
    const normalizedTaxId = canonical(cp.id).replace(/\s/g, '');
    const groupKey = `${normalizedTaxId}|${operationKey}`;
    const row = groups.get(groupKey) || {
      taxId: normalizedTaxId, name: cp.name, country: normalizedCountry(cp.country), province: cp.province,
      provinceCode: provinceCode(cp.province), operationKey, total: 0,
      quarters: { T1: 0, T2: 0, T3: 0, T4: 0 }, invoices: [],
      cashAmount: 0, propertyTransferAmount: 0, propertyRentAmount: 0,
      cashAccounting: false, reverseCharge: false, exempt: false,
    };
    row.total += amount;
    const month = Number(dateOf(invoice).slice(5, 7));
    const quarter = month <= 3 ? 'T1' : month <= 6 ? 'T2' : month <= 9 ? 'T3' : 'T4';
    row.quarters[quarter] += amount;
    row.cashAccounting ||= clean(invoice.indirect_tax_regime || invoice.regimen_iva) === 'criterio_caja';
    row.reverseCharge ||= operation === 'reverse_charge';
    row.exempt ||= ['exempt_full', 'exempt_limited', 'subject_exempt'].includes(operation);
    row.invoices.push(invoice.id);
    groups.set(groupKey, row);
    totalsByTaxId.set(normalizedTaxId, money((totalsByTaxId.get(normalizedTaxId) || 0) + Math.abs(amount)));
  }
  const missingAboveThreshold = [...missingGroups.entries()].filter(([, total]) => total > 3005.06);
  if (missingAboveThreshold.length) data.blockers.push(`${missingAboveThreshold.length} contraparte(s) podrían superar 3.005,06 € pero no tienen NIF y no pueden declararse.`);
  if (model === '347' && excluded347) data.warnings.push(`${excluded347} factura(s) se excluyeron del 347 por retenciones ya informadas u operaciones territoriales declarables en otros modelos; deben revisarse antes del cierre.`);
  const roundQuarter = (quarters: any) => Object.fromEntries(Object.entries(quarters).map(([key, value]) => [key, money(value)]));
  const details = [...groups.values()]
    .filter(row => (totalsByTaxId.get(row.taxId) || 0) > 3005.06)
    .map(row => ({ ...row, total: money(row.total), quarters: roundQuarter(row.quarters) }));
  if (details.some(row => !row.name)) data.blockers.push('Hay registros declarables sin nombre o razón social.');
  if (details.some(row => row.country === 'ES' && !validSpanishTaxId(row.taxId))) data.blockers.push('Hay NIF españoles que no tienen exactamente nueve caracteres válidos para el diseño oficial.');
  if (details.some(row => row.country === 'ES' && !row.provinceCode)) data.blockers.push('Hay declarados españoles sin código de provincia oficial resoluble.');
  if (details.some(row => !row.country)) data.blockers.push('Hay declarados con país no normalizado al código ISO de dos letras.');
  const fields: any[] = [];
  addField(fields, 'DECLARADOS', 'Registros A/B que superan el umbral por tercero', details.length, details.flatMap(row => row.invoices.map((id: string) => `Invoice:${id}`)), 'Resumen');
  addField(fields, 'IMPORTE', 'Importe anual declarado', details.reduce((sum, row) => sum + row.total, 0), details.flatMap(row => row.invoices.map((id: string) => `Invoice:${id}`)), 'Resumen');
  return { fields, result: 0, details };
}

function applyModelValidation(model: string, data: any, calculation: any) {
  const profile = data.profile;
  const indirect = clean(profile?.indirectTaxDefault);
  const year = Number(data.year);
  if (model === '347' && indirect === 'igic') data.blockers.push('El perfil está en territorio IGIC: corresponde el modelo 415, no el 347.');
  if (model === '347' && indirect === 'mixto') data.blockers.push('El perfil fiscal es mixto: separa y confirma manualmente las operaciones de territorio IVA antes de exportar el 347.');
  if (model === '347' && year > 2025) data.blockers.push('El diseño anual AEAT del ejercicio 2026 todavía no está publicado; solo se habilita el último diseño oficialmente disponible.');
  if (model === '415' && year > 2025) data.blockers.push('La ATC todavía no ha publicado el programa anual 415 del ejercicio 2026.');
  if (model === '130') {
    if (profile?.entityType !== 'autonomo' || !profile?.subjectToIRPF || profile?.irpfEstimation === 'no_aplica') data.blockers.push('El modelo 130 solo es aplicable a personas físicas en estimación directa sujetas a pago fraccionado.');
    if (profile?.model130ExemptionConfirmed) data.blockers.push('El perfil marca exención del modelo 130 por porcentaje de ingresos sometidos a retención; revise la obligación censal antes de generar fichero.');
  }
  if (model === '303' && !['iva', 'mixto'].includes(indirect)) data.blockers.push('El perfil no está configurado en territorio IVA; no corresponde exportar el modelo 303.');
  if (model === '420' && !['igic', 'mixto'].includes(indirect)) data.blockers.push('El perfil no está configurado en IGIC; no corresponde preparar el modelo 420.');
  if (model === '420' && profile?.usesSII) data.blockers.push('Los sujetos IGIC incluidos en SII deben revisar el modelo 417, no el 420 ordinario.');
  if (model === '420' && ['incluido', 'transitorio_2026'].includes(profile?.repepStatus)) data.blockers.push('El perfil consta incluido en REPEP: no procede el modelo 420 periódico; debe revisarse el resumen anual 425 y las excepciones que correspondan.');
  if (model === '420' && data.activities.length && data.activities.every((activity: any) => ['pequeno_empresario_igic', 'exenta_limitada', 'no_sujeta'].includes(activity.indirectTaxRegime))) data.blockers.push('Ninguna actividad activa está configurada en régimen general IGIC liquidable mediante el modelo 420.');
  if (model === '425' && !['igic', 'mixto'].includes(indirect)) data.blockers.push('El modelo 425 solo corresponde a sujetos y operaciones en el ámbito del IGIC canario.');
  if (model === '425' && year > 2025) data.blockers.push('La ATC todavía no ha publicado el programa anual 425 del ejercicio 2026.');
  if (model === '390' && !['iva', 'mixto'].includes(indirect)) data.blockers.push('El modelo 390 solo corresponde a sujetos y operaciones en territorio IVA.');
  if (model === '390' && year > 2025) data.blockers.push('La AEAT todavía no ha publicado el diseño anual 390 del ejercicio 2026.');
  if (model === '180' && year > 2025) data.blockers.push('El modelo anual 180 del ejercicio 2026 todavía no está abierto ni contrastado con la campaña AEAT correspondiente.');
  if (model === '347' && profile?.usesSII) data.blockers.push('El perfil está adscrito al SII y, con carácter general, queda excluido de presentar el modelo 347; confirme cualquier excepción censal.');
  if (model === '415' && !['igic', 'mixto'].includes(indirect)) data.blockers.push('El modelo 415 solo corresponde a operaciones en el ámbito del IGIC canario.');
  if (['347', '415'].includes(model) && !(calculation.details || []).length) data.blockers.push('No existen operaciones que superen el umbral por tercero; no procede generar una declaración vacía.');
  if (['111', '115', '123'].includes(model) && !(calculation.details || []).length) data.blockers.push(`No se han detectado pagos sometidos a retención para el modelo ${model}; no debe generarse una autoliquidación negativa por ausencia de rentas pagadas.`);
}

function calculateAnnualRetention(data: any, b: any, model: '180'|'190'|'193') {
  if (model === '180') {
    const base = calculateSimpleRetention(data, b, '115');
    const records = new Map((data.declarables || []).filter((row: any) => row.modeloCodigo === '180').map((row: any) => [row.recordKey, row]));
    let incomplete = 0;
    let pendingReview = 0;
    const details = base.details.map((detail: any) => {
      const recordKey = `Invoice:${detail.id}`;
      const stored: any = records.get(recordKey);
      const invoice = data.invoices.find((item: any) => item.id === detail.id);
      const payload = stored?.payload || {};
      const derivedRate = detail.base ? money(Math.abs(detail.withholding / detail.base) * 100) : 0;
      const manual = {
        representativeTaxId: clean(payload.representativeTaxId),
        recipientProvinceCode: clean(payload.recipientProvinceCode) || provinceCode(invoiceCounterparty(invoice || {}).province),
        modality: ['1','2'].includes(clean(payload.modality)) ? clean(payload.modality) : '1',
        withholdingRate: payload.withholdingRate == null ? derivedRate : money(payload.withholdingRate),
        accrualYear: /^\d{4}$/.test(clean(payload.accrualYear)) ? clean(payload.accrualYear) : '0000',
        propertySituation: clean(payload.propertySituation),
        cadastralReference: clean(payload.cadastralReference),
        roadType: clean(payload.roadType), roadName: clean(payload.roadName), numberingType: clean(payload.numberingType) || 'NUM',
        houseNumber: clean(payload.houseNumber), numberQualifier: clean(payload.numberQualifier), block: clean(payload.block), portal: clean(payload.portal),
        stair: clean(payload.stair), floor: clean(payload.floor), door: clean(payload.door), complement: clean(payload.complement),
        locality: clean(payload.locality), municipality: clean(payload.municipality), municipalityCode: clean(payload.municipalityCode),
        propertyProvinceCode: clean(payload.propertyProvinceCode), postalCode: clean(payload.postalCode),
      };
      const missingFields: string[] = [];
      if (!/^\d{2}$/.test(manual.recipientProvinceCode)) missingFields.push('provincia del perceptor');
      if (!['1','2','3','4'].includes(manual.propertySituation)) missingFields.push('situación del inmueble');
      if (manual.propertySituation !== '4' && !manual.cadastralReference) missingFields.push('referencia catastral');
      if (!manual.roadType) missingFields.push('tipo de vía');
      if (!manual.roadName) missingFields.push('nombre de vía');
      if (!manual.municipality) missingFields.push('municipio');
      if (!/^\d{5}$/.test(manual.municipalityCode)) missingFields.push('código INE de municipio');
      if (!/^\d{2}$/.test(manual.propertyProvinceCode)) missingFields.push('provincia del inmueble');
      if (!/^\d{5}$/.test(manual.postalCode)) missingFields.push('código postal');
      if (missingFields.length) incomplete += 1;
      if (stored?.reviewStatus !== 'validado_asesor') pendingReview += 1;
      return { ...detail, recordKey, manual, enrichmentId: stored?.id, reviewStatus: stored?.reviewStatus || 'pendiente_revision', missingFields };
    });
    if (incomplete) data.blockers.push(`${incomplete} registro(s) del modelo 180 no tienen completa la ficha oficial del inmueble.`);
    if (pendingReview) data.blockers.push(`${pendingReview} registro(s) del modelo 180 no han sido validados por un asesor.`);
    if (!details.length) data.blockers.push('No se han detectado pagos de alquiler con retención para el resumen anual 180.');
    return { ...base, details };
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

function signedAmount(value: unknown, length = 16) {
  const amount = Number(value) || 0;
  return `${amount < 0 ? 'N' : ' '}${numeric(amount, length - 1)}`;
}

function sequentialDeclarationNumber(model: string) {
  return `${model}${String(Math.floor(Date.now() / 1000)).padStart(10, '0').slice(-10)}`;
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
  const p1=page(1581,1570,'</T30301000>'); place(p1,1,11,'<T30301000>'); place(p1,13,1,declarationType(calculation.result)); place(p1,14,9,normalizedText(company.nif_cif,9)); place(p1,23,80,normalizedText(company.razon_social,80)); place(p1,103,4,String(year)); place(p1,107,2,period); place(p1,109,1,'2'); place(p1,110,1,profile?.isREDEME?'1':'2'); place(p1,111,1,'3'); place(p1,112,1,'2'); place(p1,113,1,o.criterionCash?'1':'2'); place(p1,114,1,'2'); place(p1,115,1,'2'); place(p1,116,1,'2'); place(p1,117,1,'2'); place(p1,127,1,profile?.usesSII?'1':'2'); place(p1,128,1,['4T','12'].includes(period)?'2':'0'); place(p1,129,1,['4T','12'].includes(period)?'1':'0'); place(p1,130,1,['01','1T','2T','3T','4T'].includes(period)?'0':'2');
  const rateFields:Record<string, number[]>={0:[131,148,153],4:[209,226,231],10:[287,304,309],21:[326,343,348]}; for(const [rate,positions] of Object.entries(rateFields)){const row:any=rates.get(Number(rate))||{}; place(p1,positions[0],17,numeric(row.base,17)); place(p1,positions[1],5,numeric(Number(rate),5,false,2)); place(p1,positions[2],17,numeric(row.quota,17));}
  place(p1,365,17,numeric(o.intraBase,17)); place(p1,382,17,numeric(o.intraQuota,17)); place(p1,399,17,numeric(o.reverseBase,17)); place(p1,416,17,numeric(o.reverseQuota,17)); place(p1,696,17,numeric(o.outputQuota,17,true)); place(p1,713,17,numeric(o.deductibleBase,17)); place(p1,730,17,numeric(o.deductibleQuota,17)); place(p1,1002,17,numeric(o.deductibleQuota,17,true)); place(p1,1019,17,numeric(calculation.result,17,true));
  const p3=page(1017,1006,'</T30303000>'); place(p3,1,11,'<T30303000>'); place(p3,12,17,numeric(o.intraSupplies,17,true)); place(p3,29,17,numeric(o.exports,17,true)); place(p3,46,17,numeric(o.nonSubject,17,true)); place(p3,63,17,numeric(o.reverseBase,17,true)); place(p3,199,17,numeric(calculation.result,17,true)); place(p3,216,5,numeric(100,5,false,2)); place(p3,221,17,numeric(calculation.result,17,true)); place(p3,340,17,numeric(calculation.result,17,true)); place(p3,408,17,numeric(calculation.result,17,true)); place(p3,425,1,(calculation.details||[]).length?' ':'X');
  return p1.join('')+p3.join('');
}

function export180(company: any, year: number, calculation: any, declarationNumber: string) {
  const details = calculation.details || [];
  const header = Array(500).fill(' ');
  place(header,1,1,'1'); place(header,2,3,'180'); place(header,5,4,String(year)); place(header,9,9,normalizedText(company.nif_cif,9));
  place(header,18,40,normalizedText(company.razon_social,40)); place(header,58,1,'T');
  place(header,59,9,numeric(clean(company.telefono).replace(/\D/g,''),9,false,0)); place(header,68,40,normalizedText(company.razon_social,40));
  place(header,108,13,declarationNumber); place(header,121,2,'  '); place(header,123,13,numeric(0,13,false,0));
  place(header,136,9,numeric(details.length,9,false,0)); place(header,145,16,signedAmount(details.reduce((sum:number,row:any)=>sum+money(row.base),0),16));
  place(header,161,15,numeric(details.reduce((sum:number,row:any)=>sum+Math.abs(money(row.withholding)),0),15));
  const records=details.map((row:any)=>{
    const m=row.manual||{}; const record=Array(500).fill(' ');
    place(record,1,1,'2'); place(record,2,3,'180'); place(record,5,4,String(year)); place(record,9,9,normalizedText(company.nif_cif,9));
    place(record,18,9,normalizedText(row.taxId,9)); place(record,27,9,normalizedText(m.representativeTaxId,9)); place(record,36,40,normalizedText(row.name,40));
    place(record,76,2,numeric(m.recipientProvinceCode,2,false,0)); place(record,78,1,m.modality||'1'); place(record,79,14,signedAmount(row.base,14));
    place(record,93,4,numeric(m.withholdingRate,4,false,2)); place(record,97,13,numeric(Math.abs(money(row.withholding)),13)); place(record,110,4,numeric(m.accrualYear||0,4,false,0));
    place(record,114,1,m.propertySituation); place(record,115,20,normalizedText(m.cadastralReference,20));
    place(record,135,5,normalizedText(m.roadType,5)); place(record,140,50,normalizedText(m.roadName,50)); place(record,190,3,normalizedText(m.numberingType,3));
    place(record,193,5,normalizedText(m.houseNumber,5)); place(record,198,3,normalizedText(m.numberQualifier,3)); place(record,201,3,normalizedText(m.block,3));
    place(record,204,3,normalizedText(m.portal,3)); place(record,207,3,normalizedText(m.stair,3)); place(record,210,3,normalizedText(m.floor,3)); place(record,213,3,normalizedText(m.door,3));
    place(record,216,40,normalizedText(m.complement,40)); place(record,256,30,normalizedText(m.locality,30)); place(record,286,30,normalizedText(m.municipality,30));
    place(record,316,5,numeric(m.municipalityCode,5,false,0)); place(record,321,2,numeric(m.propertyProvinceCode,2,false,0)); place(record,323,5,numeric(m.postalCode,5,false,0));
    return record.join('');
  });
  return [header.join(''),...records].join('\r\n');
}

function export347(company: any, year: number, calculation: any, declarationNumber: string) {
  const details = [...(calculation.details || [])].sort((a: any, b: any) => `${a.taxId}|${a.operationKey}`.localeCompare(`${b.taxId}|${b.operationKey}`));
  const header = Array(500).fill(' ');
  place(header, 1, 1, '1'); place(header, 2, 3, '347'); place(header, 5, 4, String(year));
  place(header, 9, 9, normalizedText(company.nif_cif, 9)); place(header, 18, 40, normalizedText(company.razon_social, 40));
  place(header, 58, 1, 'T'); place(header, 59, 9, numeric(clean(company.telefono).replace(/\D/g, ''), 9, false, 0));
  place(header, 108, 13, declarationNumber); place(header, 123, 13, numeric(0, 13, false, 0));
  place(header, 136, 9, numeric(details.length, 9, false, 0));
  place(header, 145, 16, signedAmount(details.reduce((sum: number, row: any) => sum + money(row.total), 0)));
  place(header, 161, 9, numeric(0, 9, false, 0)); place(header, 170, 16, signedAmount(0));
  const records = details.map((row: any) => {
    const record = Array(500).fill(' ');
    const country = normalizedCountry(row.country) || 'ES';
    place(record, 1, 1, '2'); place(record, 2, 3, '347'); place(record, 5, 4, String(year)); place(record, 9, 9, normalizedText(company.nif_cif, 9));
    if (country === 'ES') place(record, 18, 9, normalizedText(row.taxId, 9));
    place(record, 36, 40, normalizedText(row.name, 40)); place(record, 76, 1, 'D');
    place(record, 77, 2, country === 'ES' ? row.provinceCode : '99'); place(record, 79, 2, country === 'ES' ? '  ' : country);
    place(record, 82, 1, row.operationKey); place(record, 83, 16, signedAmount(row.total));
    place(record, 101, 15, numeric(row.cashAmount, 15)); place(record, 116, 16, signedAmount(row.propertyTransferAmount));
    place(record, 132, 4, row.cashAmount ? String(year) : '0000');
    place(record, 136, 16, signedAmount(row.quarters?.T1)); place(record, 152, 16, signedAmount(0));
    place(record, 168, 16, signedAmount(row.quarters?.T2)); place(record, 184, 16, signedAmount(0));
    place(record, 200, 16, signedAmount(row.quarters?.T3)); place(record, 216, 16, signedAmount(0));
    place(record, 232, 16, signedAmount(row.quarters?.T4)); place(record, 248, 16, signedAmount(0));
    if (country !== 'ES') place(record, 264, 17, normalizedText(row.taxId, 17));
    place(record, 281, 1, row.cashAccounting ? 'X' : ' '); place(record, 282, 1, row.reverseCharge ? 'X' : ' ');
    place(record, 284, 16, signedAmount(row.cashAccounting ? row.total : 0)); place(record, 300, 6, numeric(0, 6, false, 0));
    return record.join('');
  });
  return [header.join(''), ...records].join('\r\n');
}

function export415Import(company: any, year: number, calculation: any) {
  const details = [...(calculation.details || [])].sort((a: any, b: any) => `${a.taxId}|${a.operationKey}`.localeCompare(`${b.taxId}|${b.operationKey}`));
  const keys = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
  const summary = Object.fromEntries(keys.map(key => [key, {
    count: details.filter((row: any) => row.operationKey === key).length,
    amount: details.filter((row: any) => row.operationKey === key).reduce((sum: number, row: any) => sum + money(row.total), 0),
  }]));
  const declaration = [
    '1', '415', String(year), normalizedText(company.nif_cif, 9), normalizedText(company.razon_social, 40),
    ...keys.flatMap(key => [numeric(summary[key].count, 9, false, 0), signedAmount(summary[key].amount)]),
    ' ', ' '.repeat(13),
  ].join('');
  const records = details.map((row: any) => {
    const country = normalizedCountry(row.country) || 'ES';
    return [
      '2', '415', String(year), normalizedText(company.nif_cif, 9), row.operationKey,
      country === 'ES' ? normalizedText(row.taxId, 9) : ' '.repeat(9), normalizedText(row.name, 40), ' '.repeat(9), country === 'ES' ? '  ' : country,
      row.cashAccounting ? 'X' : ' ', row.reverseCharge ? 'X' : ' ', row.exempt ? 'X' : ' ', signedAmount(row.cashAccounting ? row.total : 0),
      signedAmount(row.total), numeric(row.cashAmount, 15), signedAmount(row.propertyRentAmount), signedAmount(row.propertyTransferAmount), row.cashAmount ? String(year) : '0000',
      signedAmount(row.quarters?.T1), signedAmount(0), signedAmount(0),
      signedAmount(row.quarters?.T2), signedAmount(0), signedAmount(0),
      signedAmount(row.quarters?.T3), signedAmount(0), signedAmount(0),
      signedAmount(row.quarters?.T4), signedAmount(0), signedAmount(0),
    ].join('');
  });
  return [declaration, ...records].join('\r\n');
}

function csvCell(value: unknown) {
  const text = String(value ?? '').replace(/\r?\n/g, ' ').trim();
  return `"${text.replace(/"/g, '""')}"`;
}

function exportAtcHandoff(model: '420' | '425', company: any, year: number, period: string, calculation: any, validation: any, sourceHash: string) {
  const rows: any[][] = [
    ['TIPO', 'MODELO', 'EJERCICIO', 'PERIODO', 'CODIGO', 'CONCEPTO', 'VALOR', 'FUENTES'],
    ['METADATO', model, year, period, 'DECLARANTE_NIF', 'NIF del declarante', clean(company.nif_cif).toUpperCase(), 'Company'],
    ['METADATO', model, year, period, 'DECLARANTE_NOMBRE', 'Nombre o razón social', clean(company.razon_social), 'Company'],
    ['METADATO', model, year, period, 'MOTOR', 'Versión del motor Taxea', ENGINE_VERSION, sourceHash],
  ];
  for (const field of calculation.fields || []) {
    rows.push(['CASILLA', model, year, period, field.code, field.label, money(field.value).toFixed(2), (field.sourceIds || []).join('|')]);
  }
  const operations = calculation.operations || {};
  for (const rate of operations.rates || []) {
    rows.push(['DESGLOSE', model, year, period, `DEVENGADO_${rate.rate}_BASE`, `Base IGIC devengado al ${rate.rate}%`, money(rate.base).toFixed(2), (rate.sourceIds || []).join('|')]);
    rows.push(['DESGLOSE', model, year, period, `DEVENGADO_${rate.rate}_TIPO`, `Tipo IGIC devengado ${rate.rate}%`, money(rate.rate).toFixed(2), (rate.sourceIds || []).join('|')]);
    rows.push(['DESGLOSE', model, year, period, `DEVENGADO_${rate.rate}_CUOTA`, `Cuota IGIC devengada al ${rate.rate}%`, money(rate.quota).toFixed(2), (rate.sourceIds || []).join('|')]);
  }
  const operationRows = [
    ['ISP_BASE', 'Base de operaciones con inversión del sujeto pasivo', operations.reverseBase],
    ['ISP_CUOTA', 'Cuota de operaciones con inversión del sujeto pasivo', operations.reverseQuota],
    ['DEDUCIBLE_BASE', 'Base de operaciones con cuota deducible', operations.deductibleBase],
    ['DEDUCIBLE_CUOTA', 'Total cuotas deducibles', operations.deductibleQuota],
    ['EXPORTACIONES', 'Exportaciones y operaciones exentas con derecho a deducción', operations.exports],
    ['NO_SUJETAS', 'Operaciones no sujetas', operations.nonSubject],
    ['CRITERIO_CAJA', 'Operaciones en régimen especial del criterio de caja', operations.criterionCash],
    ['RESULTADO', 'Resultado calculado', calculation.result],
  ];
  for (const [code, label, value] of operationRows) rows.push(['DESGLOSE', model, year, period, code, label, money(value).toFixed(2), sourceHash]);
  for (const message of validation.blockers || []) rows.push(['INCIDENCIA_BLOQUEANTE', model, year, period, '', message, '', '']);
  for (const message of validation.warnings || []) rows.push(['AVISO', model, year, period, '', message, '', '']);
  rows.push(['INSTRUCCION', model, year, period, 'PASO_FINAL', 'Trasladar los importes al programa oficial, resolver sus validaciones y generar allí el fichero .dec. Este CSV no es presentable.', '', 'ATC']);
  return rows.map(row => row.map(csvCell).join(';')).join('\r\n');
}

function transferLayoutErrors(model: string, content: string) {
  const records = content.split('\r\n');
  if (model === '180') {
    const errors = records.length < 2 ? ['El 180 debe incluir cabecera y al menos un perceptor.'] : [];
    if (!records.every(record => record.length === 500)) errors.push('Todos los registros del 180 deben tener exactamente 500 posiciones.');
    if (!records[0]?.startsWith('1180')) errors.push('La cabecera del 180 no tiene el identificador oficial esperado.');
    if (records.slice(1).some(record => !record.startsWith('2180'))) errors.push('Hay registros de perceptor 180 con identificador inválido.');
    return errors;
  }
  if (model === '347') {
    const errors = records.length < 2 ? ['El 347 debe incluir cabecera y al menos un declarado.'] : [];
    if (!records.every(record => record.length === 500)) errors.push('Todos los registros del 347 deben tener exactamente 500 posiciones.');
    if (!records[0]?.startsWith('1347')) errors.push('La cabecera del 347 no tiene el identificador oficial esperado.');
    if (records.slice(1).some(record => !record.startsWith('2347') || record[75] !== 'D')) errors.push('Hay registros de declarado 347 con tipo de hoja inválido.');
    return errors;
  }
  if (model === '415') {
    const errors = records.length < 2 ? ['El soporte 415 debe incluir declaración y al menos un declarado.'] : [];
    if (records[0]?.length !== 246 || !records[0]?.startsWith('1415')) errors.push('La cabecera de importación 415 no cumple las 246 posiciones del programa ATC.');
    if (records.slice(1).some(record => record.length !== 356 || !record.startsWith('2415'))) errors.push('Hay registros de declarado 415 que no cumplen las 356 posiciones del importador ATC.');
    return errors;
  }
  return [];
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
      const company={nif_cif:'B12345678',razon_social:'TAXEA PRUEBA',telefono:'922000000'}; const profile={isREDEME:false,usesSII:false};
      const standard={result:21,fields:[{code:'01',value:1},{code:'02',value:100},{code:'03',value:15},{code:'04',value:1},{code:'05',value:100},{code:'06',value:15},{code:'28',value:30},{code:'30',value:30},{code:'09',value:19},{code:'12',value:19},{code:'14',value:19},{code:'19',value:20}],details:[{}],operations:{rates:[{rate:21,base:100,quota:21}],outputQuota:21,deductibleBase:0,deductibleQuota:0,reverseBase:0,reverseQuota:0,intraBase:0,intraQuota:0,exports:0,intraSupplies:0,nonSubject:0}};
      const thirdParties={result:0,details:[{taxId:'B87654321',name:'CLIENTE PRUEBA',country:'ES',provinceCode:'38',operationKey:'B',total:3500,quarters:{T1:1000,T2:1000,T3:1000,T4:500},cashAmount:0,propertyTransferAmount:0,propertyRentAmount:0,cashAccounting:false,reverseCharge:false,exempt:false}]};
      const annual180={result:0,details:[{id:'invoice-test',taxId:'B87654321',name:'ARRENDADOR PRUEBA',base:12000,withholding:2280,manual:{representativeTaxId:'',recipientProvinceCode:'38',modality:'1',withholdingRate:19,accrualYear:'0000',propertySituation:'1',cadastralReference:'1234567CS7413S0001AB',roadType:'CL',roadName:'PRUEBA',numberingType:'NUM',houseNumber:'1',municipality:'SANTA CRUZ DE TENERIFE',municipalityCode:'38038',propertyProvinceCode:'38',postalCode:'38001'}}]};
      const samples:any={111:export111(company,2026,'1T',standard),115:export115(company,2026,'1T',standard),123:export123(company,2026,'1T',standard),130:export130(company,2026,'1T',standard),303:export303(company,profile,2026,'1T',standard)};
      const expected:any={111:1000,115:500,123:600,130:600,303:2598}; const checks=Object.entries(samples).map(([model,content]:any)=>({model,length:content.length,expected:expected[model],validLength:content.length===expected[model],hasEndMarker:content.includes(`</T${model}0`),hasNaN:content.includes('NaN')}));
      const wrappedChecks=Object.entries(samples).map(([model,content]:any)=>{const wrapped=wrap(model,2026,'1T',content,'B12345678'); return {model,length:wrapped.length,validEnvelope:wrapped.startsWith(`<T${model}020261T0000>`)&&wrapped.endsWith(`</T${model}020261T0000>`)}});
      const record180=export180(company,2025,annual180,'1801234567890').split('\r\n');
      const record347=export347(company,2025,thirdParties,'3471234567890').split('\r\n');
      const import415=export415Import(company,2025,thirdParties).split('\r\n');
      const transferChecks=[
        {model:'180',records:record180.length,recordLengths:record180.map(line=>line.length),valid:record180.length===2&&record180.every(line=>line.length===500)&&record180[1].startsWith('2180')},
        {model:'347',records:record347.length,recordLengths:record347.map(line=>line.length),valid:record347.length===2&&record347.every(line=>line.length===500)&&record347[1][75]==='D'},
        {model:'415',records:import415.length,recordLengths:import415.map(line=>line.length),valid:import415.length===2&&import415[0].length===246&&import415[1].length===356&&import415[1].startsWith('2415')},
      ];
      const handoff420=exportAtcHandoff('420',company,2026,'1T',standard,{blockers:[],warnings:[]},'self-test'); const handoffCheck={model:'420/425 handoff',valid:handoff420.includes('PASO_FINAL')&&handoff420.includes('DEVENGADO_21_BASE')&&handoff420.split('\r\n').length>8};
      const ok=checks.every((c:any)=>c.validLength&&c.hasEndMarker&&!c.hasNaN)&&wrappedChecks.every((c:any)=>c.validEnvelope)&&transferChecks.every(item=>item.valid)&&handoffCheck.valid; return Response.json({ok,engineVersion:ENGINE_VERSION,checks,wrappedChecks,transferChecks,handoffCheck});
    }
    const companyId=clean(body.companyId); const model=clean(body.modeloCodigo); const year=Number(body.ejercicio); const period=clean(body.periodo||'Anual');
    if(!companyId||(!TARGET_MODELS.includes(model)&&action!=='calculate_bundle')||!year) return Response.json({error:'companyId, modeloCodigo y ejercicio son obligatorios.'},{status:400});
    authorize(user,companyId); const svc=base44.asServiceRole;
    const [company,profiles,activities,invoices,rawTaxLines,invoicePayments,payrolls,entries,entryLines,declarables]=await Promise.all([
      svc.entities.Company.get(companyId), listAll(svc.entities.FiscalProfile,{company_id:companyId}), listAll(svc.entities.FiscalActivity,{company_id:companyId}), listAll(svc.entities.Invoice,{company_id:companyId}), listAll(svc.entities.InvoiceTaxLine,{companyId}), listAll(svc.entities.InvoicePayment,{company_id:companyId}), listAll(svc.entities.PayrollExtraction,{company_id:companyId}), listAll(svc.entities.JournalEntry,{companyId}), listAll(svc.entities.JournalEntryLine,{companyId}), listAll(svc.entities.TaxDeclarableRecord,{companyId,ejercicio:year}),
    ]);
    if(!company) return Response.json({error:'Empresa no encontrada.'},{status:404});
    const profile=profiles.find((p:any)=>p.active!==false)||profiles[0]||null; const blockers:string[]=[]; const warnings:string[]=[];
    if(!company.nif_cif) blockers.push('La empresa no tiene NIF/CIF configurado.');
    else if(!validSpanishTaxId(company.nif_cif)) blockers.push('El NIF/CIF de la empresa no tiene nueve caracteres válidos para los diseños oficiales.');
    if(!company.razon_social) blockers.push('La empresa no tiene razón social legal configurada.');
    if(!profile) blockers.push('Falta el perfil fiscal de la empresa.'); else if(profile.profileStatus!=='validado_asesor') warnings.push('El perfil fiscal no consta como validado por asesor.');
    const taxLines=normalizedTaxLines(invoices,rawTaxLines,warnings,blockers); const b=bounds(year,period);
    const data={company,profile,activities,invoices,taxLines,invoicePayments,payrolls,entries,entryLines,declarables,blockers,warnings,period,year};
    if(action==='upsert_declarable') {
      if(!['180','190','193'].includes(model)) return Response.json({error:'Modelo anual no soportado para enriquecimiento manual.'},{status:400});
      const recordKey=clean(body.recordKey); if(!recordKey) return Response.json({error:'recordKey es obligatorio.'},{status:400});
      const sourceId=clean(body.sourceId); const sourceType=clean(body.sourceType)||'manual'; const input=body.payload||{};
      const allowed180=['representativeTaxId','recipientProvinceCode','modality','withholdingRate','accrualYear','propertySituation','cadastralReference','roadType','roadName','numberingType','houseNumber','numberQualifier','block','portal','stair','floor','door','complement','locality','municipality','municipalityCode','propertyProvinceCode','postalCode'];
      const allowed=model==='180'?allowed180:[]; const payload=Object.fromEntries(allowed.map(key=>[key,key==='withholdingRate'?money(input[key]):clean(input[key])]).filter(([,value])=>value!==''&&value!=null));
      const role=clean(user?.role).toLowerCase(); const canReview=['admin','super_admin','advisor','asesor'].includes(role); const reviewRequested=body.reviewStatus==='validado_asesor';
      const reviewStatus=reviewRequested&&canReview?'validado_asesor':'pendiente_revision'; const recordPayload:any={companyId,modeloCodigo:model,ejercicio:year,recordKey,sourceType,sourceId,payload,reviewStatus,notes:clean(body.notes)};
      if(reviewStatus==='validado_asesor'){recordPayload.reviewedBy=user.email;recordPayload.reviewedAt=new Date().toISOString();}
      const existing=await svc.entities.TaxDeclarableRecord.filter({companyId,modeloCodigo:model,ejercicio:year,recordKey},'-created_date',1); const record=existing?.[0]?await svc.entities.TaxDeclarableRecord.update(existing[0].id,recordPayload):await svc.entities.TaxDeclarableRecord.create(recordPayload);
      return Response.json({ok:true,record});
    }
    if(action==='calculate_bundle') {
      const models=TARGET_MODELS.map(code=>{
        const annual=['180','190','193','347','390','415','425'].includes(code); const modelPeriod=annual?'Anual':'1T'; const modelBounds=bounds(year,modelPeriod); const modelData={...data,period:modelPeriod,blockers:[...blockers],warnings:[...warnings]}; const modelCalculation=calculate(code,modelData,modelBounds,{}); applyModelValidation(code,modelData,modelCalculation); return {code,fields:modelCalculation.fields?.length||0,details:modelCalculation.details?.length||0,result:money(modelCalculation.result),blockers:unique(modelData.blockers),warnings:unique(modelData.warnings)};
      });
      return Response.json({ok:true,engineVersion:ENGINE_VERSION,models,sourceStats:{invoices:invoices.length,taxLines:taxLines.length,invoicePayments:invoicePayments.length,payrolls:payrolls.length,journalEntries:entries.length}});
    }
    const adjustments=body.adjustments||{}; const calculation=calculate(model,data,b,adjustments); applyModelValidation(model,data,calculation); const sourceIds=unique((calculation.fields||[]).flatMap((f:any)=>f.sourceIds||[])); const sourceHash=await sha256(JSON.stringify({model,year,period,sourceIds,adjustments,values:(calculation.fields||[]).map((f:any)=>[f.code,f.value])}));
    const result={ok:true,engineVersion:ENGINE_VERSION,definition:{code:model,...DEFINITIONS[model]},company:{id:company.id,name:company.razon_social||company.nombre_comercial,taxId:company.nif_cif},period:{year,period,...b},calculation:{...calculation,result:money(calculation.result)},validation:{blockers:unique(blockers),warnings:unique(warnings),canSaveDraft:true,canExportOfficial:DEFINITIONS[model].officialExport&&blockers.length===0},source:{hash:sourceHash,count:sourceIds.length,ids:sourceIds,stats:{invoices:invoices.filter((f:any)=>!f.anulada&&inRange(f,b.start,b.end)).length,taxLines:taxLines.filter((l:any)=>inRange(l,b.start,b.end)).length,invoicePayments:invoicePayments.filter((p:any)=>inRange(p,b.start,b.end)).length,payrolls:payrolls.filter((p:any)=>inRange(p,b.start,b.end)).length,journalEntries:entries.filter((e:any)=>inRange(e,b.start,b.end)).length}},sources:SOURCES};
    if(action==='calculate') return Response.json(result);
    if(action==='export_handoff') {
      if(!['420','425'].includes(model)) return Response.json({error:'El traspaso guiado solo está disponible para los modelos 420 y 425.'},{status:400});
      const content=exportAtcHandoff(model as '420'|'425',company,year,period,calculation,result.validation,sourceHash);
      const filename=`${clean(company.nif_cif).toUpperCase()}_${year}_${period}_${model}_traspaso_ATC.csv`;
      return Response.json({...result,file:{filename,extension:'csv',format:'Paquete de traspaso revisable al programa oficial ATC',design:DEFINITIONS[model].design,hash:await sha256(content),contentBase64:encodeBase64(content),nextStep:'Abre el programa oficial de ayuda de la ATC para este ejercicio, crea la declaración, traslada y contrasta las casillas del CSV, resuelve sus validaciones y genera allí el .dec presentable.'}});
    }
    if(action==='save_draft') {
      const payload={companyId,modeloCodigo:model,ejercicio:year,periodo:period,version:1,origenDatos:`${ENGINE_VERSION}:${sourceHash}`,resumen:{definition:result.definition,calculation:result.calculation,source:result.source},validaciones:result.validation.warnings.map((message:string)=>({severity:'warning',message})),errores:result.validation.blockers.map((message:string)=>({severity:'blocker',message})),ajustesManuales:Object.entries(body.adjustments||{}).map(([field,value])=>({field,value,reason:clean(body.adjustmentReason)})),usuarioCreador:user.email,estado:result.validation.blockers.length?'en_revision':'borrador',notas:clean(body.notes)};
      const existing=await svc.entities.TaxDraft.filter({companyId,modeloCodigo:model,ejercicio:year,periodo:period},'-created_date',1); const draft=existing?.[0]?await svc.entities.TaxDraft.update(existing[0].id,{...payload,version:Number(existing[0].version||0)+1}):await svc.entities.TaxDraft.create(payload); return Response.json({...result,draft});
    }
    if(action==='export') {
      if(!DEFINITIONS[model].officialExport) return Response.json({ok:false,error:'El diseño no está habilitado para exportación oficial segura.',blockers:[DEFINITIONS[model].designWarning||'Falta validar el diseño y todos los datos de detalle exigidos por la Administración.']},{status:422});
      if(blockers.length) return Response.json({ok:false,error:'La exportación está bloqueada por incidencias fiscales.',blockers:unique(blockers),warnings:unique(warnings)},{status:422});
      if(['303'].includes(model)&&activities.some((a:any)=>['simplificado','grupo_entidades'].includes(a.indirectTaxRegime))) return Response.json({ok:false,error:'El perfil requiere páginas/regímenes especiales no exportables de forma automática.',blockers:['Revisa régimen simplificado/grupo de entidades y utiliza el modelo específico aplicable.']},{status:422});
      let content=''; let filename=''; let extension=''; let format=''; let administration=DEFINITIONS[model].authority;
      if(model==='180') {
        content=export180(company,year,calculation,sequentialDeclarationNumber('180'));
        filename=`${clean(company.nif_cif).toUpperCase()}_${year}_180.txt`; extension='txt'; format='Diseño de registro AEAT modelo 180';
      } else if(model==='347') {
        content=export347(company,year,calculation,sequentialDeclarationNumber('347'));
        filename=`${clean(company.nif_cif).toUpperCase()}_${year}_347.txt`; extension='txt'; format='Diseño de registro AEAT modelo 347';
      } else if(model==='415') {
        content=export415Import(company,year,calculation);
        filename=`${clean(company.nif_cif).toUpperCase()}_${year}_415_importacion.txt`; extension='txt'; format='Soporte de importación oficial programa ATC 415';
      } else {
        const developerTaxId=clean(Deno.env.get('TAXEA_DEVELOPER_NIF')); if(!developerTaxId) return Response.json({ok:false,error:'Falta configurar TAXEA_DEVELOPER_NIF para completar el diseño oficial AEAT.',blockers:['Añade el NIF de la entidad desarrolladora como secreto de backend antes de exportar.']},{status:422});
        const exporters:any={'111':export111,'115':export115,'123':export123,'130':export130}; const pages=model==='303'?export303(company,profile,year,period,calculation):exporters[model](company,year,period,calculation);
        content=wrap(model,year,period,pages,developerTaxId); filename=`${clean(company.nif_cif).toUpperCase()}${year}${period}.${model}`; extension=model; format='Diseño de registro AEAT';
      }
      const layoutErrors=transferLayoutErrors(model,content);
      if(layoutErrors.length) return Response.json({ok:false,error:'El fichero generado no supera la validación estructural interna.',blockers:layoutErrors},{status:500});
      const hash=await sha256(content);
      const record=await svc.entities.TaxOfficialFile.create({companyId,modeloCodigo:model,ejercicio:year,periodo:period,administracion:administration,nombreFichero:filename,extension,formato:format,versionDiseno:DEFINITIONS[model].design,hash,generadoPor:user.email,fechaGeneracion:new Date().toISOString(),estado:'generado',errores:[],avisos:unique(warnings),resumenLegible:JSON.stringify({engineVersion:ENGINE_VERSION,sourceHash,result:calculation.result,workflow:model==='415'?'Importar en el programa ATC, validar y generar .dec':undefined})});
      return Response.json({...result,file:{id:record.id,filename,extension,format,design:DEFINITIONS[model].design,hash,contentBase64:encodeBase64(content),nextStep:model==='415'?'Importa este fichero en Herramientas > Importar ficheros declarados del programa oficial 415. Corrige cualquier incidencia y genera allí el .dec.':undefined}});
    }
    if(action==='export_review') {
      const content=JSON.stringify({...result,exportNotice:'Borrador técnico de revisión. No presentable ante AEAT/ATC.'},null,2); return Response.json({...result,file:{filename:`${model}_${year}_${period}_revision_taxea.json`,extension:'json',format:'Borrador técnico de revisión',hash:await sha256(content),contentBase64:encodeBase64(content)}});
    }
    return Response.json({error:'Acción no soportada.'},{status:400});
  } catch(error){const status=Number((error as any)?.status)||500; return Response.json({error:(error as Error).message||'Error interno'},{status});}
});


