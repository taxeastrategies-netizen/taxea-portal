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
  return [direction, date, amount.toFixed(2), number || taxId || party].join('|');
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
  const outstanding = invoice => {
    const total = Math.abs(money(invoice.total_factura));
    if (invoice.importe_pendiente !== null && invoice.importe_pendiente !== undefined) {
      return Math.max(0, money(invoice.importe_pendiente));
    }
    return Math.max(0, money(total - Math.abs(money(invoice.importe_pagado))));
  };
  const open = invoice => !['cobrada', 'pagada', 'anulada', 'cancelada'].includes(text(invoice.estado_cobro).toLowerCase())
    && outstanding(invoice) > 0.01;
  const totalIncome = money(issued.reduce((sum, row) => sum + Number(row.total_factura || 0), 0)
    + manualIncome.reduce((sum, row) => sum + Number(row.total || 0), 0));
  const totalExpenses = money(received.reduce((sum, row) => sum + Number(row.total_factura || 0), 0)
    + manualExpense.reduce((sum, row) => sum + Number(row.total || 0), 0));
  return {
    total_ingresos: totalIncome,
    total_gastos: totalExpenses,
    resultado: money(totalIncome - totalExpenses),
    base_ingresos: money(issued.reduce((sum, row) => sum + Number(row.base_imponible || 0), 0)
      + manualIncome.reduce((sum, row) => sum + Number(row.base_imponible || 0), 0)),
    base_gastos: money(received.reduce((sum, row) => sum + Number(row.base_imponible || 0), 0)
      + manualExpense.reduce((sum, row) => sum + Number(row.base_imponible || 0), 0)),
    iva_repercutido: money(issued.reduce((sum, row) => sum + Number(row.cuota_iva || 0), 0)
      + manualIncome.reduce((sum, row) => sum + Number(row.cuota_impuesto || 0), 0)),
    iva_soportado: money(received.reduce((sum, row) => sum + Number(row.cuota_iva || 0), 0)
      + manualExpense.reduce((sum, row) => sum + Number(row.cuota_impuesto || 0), 0)),
    cobros_pendientes: money(issued.filter(open).reduce((sum, row) => sum + outstanding(row), 0)),
    pagos_pendientes: money(received.filter(open).reduce((sum, row) => sum + outstanding(row), 0)),
    facturas_emitidas: issued.length,
    facturas_recibidas: received.length,
    registros_manuales: activeExpenses.length,
    ...reconciled.sourceTruth,
  };
}
