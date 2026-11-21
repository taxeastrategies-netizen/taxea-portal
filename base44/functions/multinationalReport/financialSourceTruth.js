// Decimal arithmetic at the currency boundary: never round a binary FX product.
function decimalFraction(value){
 const n=Number(value);if(!Number.isFinite(n))return null;
 const [mantissa,exponent='0']=String(n).toLowerCase().split('e');
 const negative=mantissa.startsWith('-'),parts=mantissa.replace(/^[-+]/,'').split('.');
 let coefficient=BigInt((parts[0]||'0')+(parts[1]||'')),scale=(parts[1]||'').length-Number(exponent);
 if(scale<0){coefficient*=10n**BigInt(-scale);scale=0;}
 return {coefficient:negative?-coefficient:coefficient,denominator:10n**BigInt(scale)};
}
function roundedDecimalEuro(numerator,denominator){
 if(denominator===0n)return NaN;
 if(denominator<0n){numerator=-numerator;denominator=-denominator;}
 const sign=numerator<0n?-1:1,absolute=numerator<0n?-numerator:numerator,scaled=absolute*100n;
 const cents=scaled/denominator+(scaled%denominator*2n>=denominator?1n:0n);
 return sign*Number(cents)/100;
}
export function fxMoney(value,...multipliers){
 let numerator=1n,denominator=1n;
 for(const valuePart of [value,...multipliers]){const part=decimalFraction(valuePart);if(!part)return NaN;numerator*=part.coefficient;denominator*=part.denominator;}
 return roundedDecimalEuro(numerator,denominator);
}
export function fxRatioMoney(value,numerator,denominator){
 const a=decimalFraction(value),b=decimalFraction(numerator),c=decimalFraction(denominator);
 if(!a||!b||!c||c.coefficient===0n)return NaN;
 return roundedDecimalEuro(a.coefficient*b.coefficient*c.denominator,a.denominator*b.denominator*c.coefficient);
}

export function invoiceEuroAmount(invoice,field='total_factura'){
 const currency=String(invoice?.moneda||invoice?.currency||'EUR').toUpperCase();
 if(field==='importe_pendiente'){
   let metadata={};try{metadata=JSON.parse(invoice?.recc_metadata||'{}');}catch{/* La incidencia fiscal se revisa por separado. */}
   const credit=invoice?.es_rectificativa?metadata.advanceCreditBook:null;
   const face=invoice?.es_rectificativa&&metadata.documentKind==='advance'?Number(metadata.refundCashAmount??Math.abs(Number(invoice.total_factura))):Math.abs(Number(invoice?.total_factura)||0);
   const pending=Math.max(0,Number(invoice?.importe_pendiente??(face-Math.abs(Number(invoice?.importe_pagado)||0))));
   const total=credit?Number(credit.paidTotalEur):currency==='EUR'&&invoice?.es_rectificativa&&metadata.documentKind==='advance'?face:Math.abs(invoiceEuroAmount(invoice,'total_factura'));
   return face>0?money(total-fxRatioMoney(total,Math.max(0,Math.min(face,face-pending)),face)):0;
 }
 const raw=field==='importe_retencion'&&invoice?.importe_retencion==null?Number(invoice?.base_imponible||0)*Number(invoice?.retencion_irpf||0)/100:invoice?.[field];
 if(currency==='EUR')return money(raw);
 const rate=Number(invoice?.exchange_rate);if(!Number.isFinite(rate)||rate<=0)return 0;
 let metadata={};try{metadata=JSON.parse(invoice?.recc_metadata||'{}');}catch{/* Se conserva la referencia documental sin inventar un ajuste histórico. */}
 const credit=invoice?.es_rectificativa?metadata.advanceCreditBook:null;
 if(credit){const nondeduct=invoice.tipo==='recibida'?money(credit.taxEur-credit.deductibleEur):0;
  const values={base_imponible:-money(credit.costEur-nondeduct),cuota_iva:-credit.taxEur,deductible_tax_amount:invoice.tipo==='recibida'?-credit.deductibleEur:0,non_deductible_tax_amount:-nondeduct,importe_retencion:-credit.retentionEur,total_factura:-credit.totalEur};if(field in values)return money(values[field]);
 }
 return fxMoney(Number(raw||0),rate);
}
/** @param {any} value @param {any} invoice */
export function formatInvoiceMoney(value,invoice={}){
 const currency=String(invoice.moneda||invoice.currency||'EUR').toUpperCase();
 return Number(value||0).toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})+(currency==='EUR'?' €':' '+currency);
}
const money = value => Math.round((Number(value) || 0) * 100) / 100;
const text = value => String(value ?? '').trim();
const normalizedText = value => text(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toUpperCase()
  .replace(/[^A-Z0-9]/g, '');

const directionOfInvoice = invoice => invoice?.tipo === 'recibida' ? 'gasto' : 'ingreso';
const directionOfExpense = expense => expense?.tipo === 'ingreso' ? 'ingreso' : 'gasto';
const invoiceDate = invoice => text(invoice?.fecha_operacion || invoice?.fecha_emision || invoice?.created_date).slice(0, 10);
const expenseDate = expense => text(expense?.fecha || expense?.created_date).slice(0, 10);
const invoiceAmount = invoice => Math.abs(money(invoice?.total_factura));
const expenseAmount = expense => Math.abs(money(expense?.total));
const invoiceTaxId = invoice => normalizedText(invoice?.tipo === 'recibida' ? invoice?.proveedor_nif : invoice?.cliente_nif);
const expenseTaxId = expense => normalizedText(expense?.tax_id || expense?.proveedor_cliente_nif || expense?.nif);
const invoiceParty = invoice => normalizedText(invoice?.tipo === 'recibida'
  ? (invoice?.proveedor_nombre || invoice?.cliente_nombre)
  : (invoice?.cliente_nombre || invoice?.proveedor_nombre));
const expenseParty = expense => normalizedText(expense?.proveedor_cliente);
const invoiceNumber = invoice => normalizedText(invoice?.numero_factura);
const expenseNumber = expense => normalizedText(expense?.document_number || expense?.numero_factura);

function daysBetween(left, right) {
  if (!left || !right) return Number.POSITIVE_INFINITY;
  const a = Date.parse(`${left}T00:00:00Z`);
  const b = Date.parse(`${right}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return Number.POSITIVE_INFINITY;
  return Math.abs(a - b) / 86400000;
}

function partyComparable(left, right) {
  if (!left || !right || Math.min(left.length, right.length) < 4) return false;
  return left === right || (Math.min(left.length, right.length) >= 8 && (left.includes(right) || right.includes(left)));
}

export function financialDocumentFingerprint(row, source = 'invoice') {
  const invoice = source === 'invoice';
  const direction = invoice ? directionOfInvoice(row) : directionOfExpense(row);
  const date = invoice ? invoiceDate(row) : expenseDate(row);
  const amount = invoice ? invoiceAmount(row) : expenseAmount(row);
  const taxId = invoice ? invoiceTaxId(row) : expenseTaxId(row);
  const party = invoice ? invoiceParty(row) : expenseParty(row);
  const number = invoice ? invoiceNumber(row) : expenseNumber(row);
  const currency=String(row.moneda||row.currency||'EUR').toUpperCase(); return [direction,date,currency==='EUR'?amount.toFixed(2):currency+':'+amount.toFixed(2),number||taxId||party].join('|');
}

export function compareLegacyExpenseToInvoice(expense, invoice) {
  if (!expense || !invoice) return null;
  if (text(expense.company_id) !== text(invoice.company_id)) return null;
  if (directionOfExpense(expense) !== directionOfInvoice(invoice)) return null;

  const linkedInvoiceId = text(expense.canonical_invoice_id);
  if (linkedInvoiceId) {
    return linkedInvoiceId === text(invoice.id)
      ? { confidence: 'exact', reason: 'canonical_invoice_id' }
      : null;
  }

  if(String(expense.moneda||expense.currency||'EUR').toUpperCase()!==String(invoice.moneda||invoice.currency||'EUR').toUpperCase())return null;
  const amountMatches = Math.abs(expenseAmount(expense) - invoiceAmount(invoice)) <= 0.01;
  if (!amountMatches) return null;
  const dateDistance = daysBetween(expenseDate(expense), invoiceDate(invoice));
  const leftNumber = expenseNumber(expense);
  const rightNumber = invoiceNumber(invoice);
  if (leftNumber && rightNumber && leftNumber === rightNumber) {
    return { confidence: 'high', reason: 'document_number_amount' };
  }

  const leftTaxId = expenseTaxId(expense);
  const rightTaxId = invoiceTaxId(invoice);
  const taxIdMatches = Boolean(leftTaxId && rightTaxId && leftTaxId === rightTaxId);
  const partyMatches = partyComparable(expenseParty(expense), invoiceParty(invoice));
  if (dateDistance === 0 && (taxIdMatches || partyMatches)) {
    return { confidence: 'high', reason: taxIdMatches ? 'date_amount_tax_id' : 'date_amount_counterparty' };
  }
  if (dateDistance <= 3 && (taxIdMatches || partyMatches)) {
    return { confidence: 'review', reason: taxIdMatches ? 'near_date_amount_tax_id' : 'near_date_amount_counterparty' };
  }
  return null;
}

export function reconcileFinancialSources(invoices = [], expenses = []) {
  const canonicalInvoices = Array.isArray(invoices) ? invoices : [];
  const sourceExpenses = Array.isArray(expenses) ? expenses : [];
  const suppressedExpenseIds = new Set();
  const duplicateLinks = [];
  const reviewCandidates = [];

  for (const expense of sourceExpenses) {
    let best = null;
    for (const invoice of canonicalInvoices) {
      const match = compareLegacyExpenseToInvoice(expense, invoice);
      if (!match) continue;
      const candidate = { expenseId: expense.id, invoiceId: invoice.id, ...match };
      if (match.confidence === 'exact') { best = candidate; break; }
      if (match.confidence === 'high' && best?.confidence !== 'exact') best = candidate;
      if (match.confidence === 'review' && !best) best = candidate;
    }
    if (!best) continue;
    if (best.confidence === 'exact' || best.confidence === 'high') {
      suppressedExpenseIds.add(expense.id);
      duplicateLinks.push(best);
    } else {
      reviewCandidates.push(best);
    }
  }

  const legacyExpenses = sourceExpenses.filter(expense => !suppressedExpenseIds.has(expense.id));
  return {
    invoices: canonicalInvoices,
    expenses: legacyExpenses,
    duplicateLinks,
    reviewCandidates,
    sourceTruth: {
      version: 'financial-source-truth-v1',
      canonicalInvoiceCount: canonicalInvoices.length,
      rawExpenseCount: sourceExpenses.length,
      includedManualRecordCount: legacyExpenses.length,
      suppressedDuplicateCount: duplicateLinks.length,
      reviewCandidateCount: reviewCandidates.length,
      policy: 'invoice_precedence_high_confidence_only',
    },
  };
}

export function buildFinancialSummary(invoices = [], expenses = []) {
  const reconciled = reconcileFinancialSources(invoices, expenses);
  const activeInvoices = reconciled.invoices.filter(invoice => !invoice.anulada);
  const activeExpenses = reconciled.expenses.filter(expense => !expense.anulada);
  const issued = activeInvoices.filter(invoice => invoice.tipo !== 'recibida');
  const received = activeInvoices.filter(invoice => invoice.tipo === 'recibida');
  const manualIncome = activeExpenses.filter(expense => expense.tipo === 'ingreso');
  const manualExpense = activeExpenses.filter(expense => expense.tipo !== 'ingreso');
  const outstanding=invoice=>invoiceEuroAmount(invoice,'importe_pendiente');
  const open = invoice => !['cobrada', 'pagada', 'anulada', 'cancelada'].includes(text(invoice.estado_cobro).toLowerCase())
    && outstanding(invoice) > 0.01;
  const totalIncome = money(issued.reduce((sum, row) => sum + invoiceEuroAmount(row,'total_factura'), 0)
    + manualIncome.reduce((sum, row) => sum + invoiceEuroAmount(row,'total'), 0));
  const totalExpenses = money(received.reduce((sum, row) => sum + invoiceEuroAmount(row,'total_factura'), 0)
    + manualExpense.reduce((sum, row) => sum + invoiceEuroAmount(row,'total'), 0));
  return {
    total_ingresos: totalIncome,
    total_gastos: totalExpenses,
    resultado: money(totalIncome - totalExpenses),
    base_ingresos: money(issued.reduce((sum, row) => sum + invoiceEuroAmount(row,'base_imponible'), 0)
      + manualIncome.reduce((sum, row) => sum + invoiceEuroAmount(row,'base_imponible'), 0)),
    base_gastos: money(received.reduce((sum, row) => sum + invoiceEuroAmount(row,'base_imponible'), 0)
      + manualExpense.reduce((sum, row) => sum + invoiceEuroAmount(row,'base_imponible'), 0)),
    iva_repercutido: money(issued.reduce((sum, row) => sum + invoiceEuroAmount(row,'cuota_iva'), 0)
      + manualIncome.reduce((sum, row) => sum + invoiceEuroAmount(row,'cuota_impuesto'), 0)),
    iva_soportado: money(received.reduce((sum, row) => sum + invoiceEuroAmount(row,'cuota_iva'), 0)
      + manualExpense.reduce((sum, row) => sum + invoiceEuroAmount(row,'cuota_impuesto'), 0)),
    cobros_pendientes: money(issued.filter(open).reduce((sum, row) => sum + outstanding(row), 0)),
    pagos_pendientes: money(received.filter(open).reduce((sum, row) => sum + outstanding(row), 0)),
    facturas_emitidas: issued.length,
    facturas_recibidas: received.length,
    registros_manuales: activeExpenses.length,
    ...([...activeInvoices,...activeExpenses].some(row=>String(row.moneda||row.currency||'EUR').toUpperCase()!=='EUR')?{currency:'EUR',
    currencyIssueCount:[...activeInvoices,...activeExpenses].filter(row=>String(row.moneda||row.currency||'EUR').toUpperCase()!=='EUR'&&!(Number(row.exchange_rate)>0)).length}:{}),
    ...reconciled.sourceTruth,
  };
}
