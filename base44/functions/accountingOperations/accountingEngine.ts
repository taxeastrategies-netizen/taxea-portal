import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';

export const SCHEMA_VERSION = 'pgc8-v1';
const money = (value) => Math.round((Number(value) || 0) * 100) / 100;
const clean = (value) => String(value || '').trim();
const normalizeTaxId = (value) => clean(value).toUpperCase().replace(/[^A-Z0-9]/g, '');
export const canonical8 = (value) => {
  const digits = clean(value).replace(/\D/g, '');
  if (!digits || digits.length > 8) throw new Error(`La cuenta ${value || 'vacía'} no es válida.`);
  return digits.padEnd(8, '0');
};
export const isCanonical8 = (value) => /^\d{8}$/.test(clean(value));

const ACCOUNT_DEFS = {
  '10000000': ['Capital social', 'patrimonio'],
  '10200000': ['Capital', 'patrimonio'],
  '11300000': ['Reservas voluntarias', 'patrimonio'],
  '12900000': ['Resultado del ejercicio', 'patrimonio'],
  '17000000': ['Deudas a largo plazo con entidades de crédito', 'pasivo'],
  '20600000': ['Aplicaciones informáticas', 'activo'],
  '21600000': ['Mobiliario', 'activo'],
  '21700000': ['Equipos para procesos de información', 'activo'],
  '28060000': ['Amortización acumulada de aplicaciones informáticas', 'amortizacion'],
  '28160000': ['Amortización acumulada de mobiliario', 'amortizacion'],
  '28170000': ['Amortización acumulada de equipos informáticos', 'amortizacion'],
  '30000000': ['Mercaderías', 'activo'],
  '40000000': ['Proveedores', 'proveedor'],
  '41000000': ['Acreedores por prestaciones de servicios', 'proveedor'],
  '43000000': ['Clientes', 'cliente'],
  '43100000': ['Clientes, efectos comerciales a cobrar', 'cliente'],
  '43600000': ['Clientes de dudoso cobro', 'cliente'],
  '43800000': ['Anticipos de clientes', 'pasivo'],
  '44000000': ['Deudores', 'activo'],
  '46500000': ['Remuneraciones pendientes de pago', 'pasivo'],
  '47000000': ['Hacienda Pública, deudora por diversos conceptos', 'impuesto'],
  '47070000': ['Hacienda Pública, deudora por IGIC', 'impuesto'],
  '47200000': ['Hacienda Pública, IVA soportado', 'impuesto'],
  '47270000': ['Hacienda Pública, IGIC soportado', 'impuesto'],
  '47300000': ['Hacienda Pública, retenciones y pagos a cuenta', 'impuesto'],
  '47500000': ['Hacienda Pública, acreedora por conceptos fiscales', 'impuesto'],
  '47500001': ['Hacienda Pública, acreedora por IVA', 'impuesto'],
  '47510000': ['Hacienda Pública, acreedora por retenciones practicadas', 'impuesto'],
  '47520000': ['Hacienda Pública, acreedora por Impuesto sobre Sociedades', 'impuesto'],
  '47570000': ['Hacienda Pública, acreedora por IGIC', 'impuesto'],
  '47600000': ['Organismos de la Seguridad Social, acreedores', 'pasivo'],
  '47700000': ['Hacienda Pública, IVA repercutido', 'impuesto'],
  '47770000': ['Hacienda Pública, IGIC repercutido', 'impuesto'],
  '52000000': ['Deudas a corto plazo con entidades de crédito', 'pasivo'],
  '55100000': ['Cuenta corriente con socios y administradores', 'otro'],
  '55500000': ['Partidas pendientes de aplicación', 'pasivo'],
  '57000000': ['Caja, euros', 'banco'],
  '57200000': ['Bancos e instituciones de crédito c/c vista, euros', 'banco'],
  '60000000': ['Compras de mercaderías', 'gasto'],
  '60600000': ['Descuentos sobre compras por pronto pago', 'ingreso'],
  '60800000': ['Devoluciones de compras y operaciones similares', 'ingreso'],
  '61000000': ['Variación de existencias de mercaderías', 'gasto'],
  '62100000': ['Arrendamientos y cánones', 'gasto'],
  '62200000': ['Reparaciones y conservación', 'gasto'],
  '62300000': ['Servicios de profesionales independientes', 'gasto'],
  '62400000': ['Transportes', 'gasto'],
  '62500000': ['Primas de seguros', 'gasto'],
  '62600000': ['Servicios bancarios y similares', 'gasto'],
  '62700000': ['Publicidad, propaganda y relaciones públicas', 'gasto'],
  '62800000': ['Suministros', 'gasto'],
  '62900000': ['Otros servicios', 'gasto'],
  '62910000': ['Software y servicios digitales', 'gasto'],
  '62920000': ['Dietas y manutención', 'gasto'],
  '64000000': ['Sueldos y salarios', 'gasto'],
  '64200000': ['Seguridad Social a cargo de la empresa', 'gasto'],
  '66200000': ['Intereses de deudas', 'gasto'],
  '66900000': ['Otros gastos financieros', 'gasto'],
  '68100000': ['Amortización del inmovilizado material', 'gasto'],
  '70000000': ['Ventas de mercaderías', 'ingreso'],
  '70500000': ['Prestaciones de servicios', 'ingreso'],
  '70600000': ['Descuentos sobre ventas por pronto pago', 'gasto'],
  '70800000': ['Devoluciones de ventas y operaciones similares', 'gasto'],
  '75200000': ['Ingresos por arrendamientos', 'ingreso'],
  '76900000': ['Otros ingresos financieros', 'ingreso'],
};

const CATEGORY_ACCOUNT = {
  ventas_servicios: '70500000',
  compras: '60000000',
  suministros: '62800000',
  alquiler: '62100000',
  publicidad_marketing: '62700000',
  servicios_profesionales: '62300000',
  software: '62910000',
  transporte: '62400000',
  dietas: '62920000',
  gastos_financieros: '66900000',
  seguros: '62500000',
  otros: '62900000',
};

export async function ensureAccount(svc, companyId, codeInput, name, type = 'otro', extra = {}) {
  const code = canonical8(codeInput);
  const existing = await svc.entities.AccountingAccount.filter({ companyId, code }, '-created_date', 1);
  if (existing?.[0]) {
    const current = existing[0];
    if (code === '55500000' && (current.type !== 'pasivo' || current.presentationRole !== 'pasivo_corriente_otras_deudas')) {
      return await svc.entities.AccountingAccount.update(current.id, {
        type: 'pasivo',
        presentationRole: 'pasivo_corriente_otras_deudas',
        normalSide: 'haber',
        maturity: 'corriente',
        description: current.description || 'Cobros recibidos cuya causa no puede identificarse temporalmente. Requiere aplicación posterior.',
      });
    }
    return current;
  }
  const def = ACCOUNT_DEFS[code] || [name || `Cuenta ${code}`, type];
  return await svc.entities.AccountingAccount.create({
    companyId,
    code,
    name: name || def[0],
    type: type === 'otro' ? def[1] : type,
    group: code.slice(0, 1),
    subgroup1: code.slice(0, 2),
    subgroup2: code.slice(0, 3),
    subgroup3: code.slice(0, 4),
    status: 'activa',
    isSystemAccount: Boolean(ACCOUNT_DEFS[code]),
    canonical8: true,
    codeLength: 8,
    accountingSchemaVersion: SCHEMA_VERSION,
    ...extra,
  });
}

export async function seedOperationalPgc(svc, companyId) {
  const created = [];
  const existing = await svc.entities.AccountingAccount.filter({ companyId }, 'code', 5000);
  const knownCodes = new Set((existing || []).map(account => clean(account.code)));
  for (const [code, [name, type]] of Object.entries(ACCOUNT_DEFS)) {
    if (!knownCodes.has(code)) {
      created.push((await ensureAccount(svc, companyId, code, name, type)).id);
      knownCodes.add(code);
    }
  }
  return { total: Object.keys(ACCOUNT_DEFS).length, created: created.length };
}

async function nextCounterpartyCode(svc, companyId, prefix) {
  const accounts = await svc.entities.AccountingAccount.filter({ companyId }, '-code', 5000);
  const used = new Set((accounts || []).map(a => clean(a.code)));
  let max = 0;
  for (const code of used) {
    if (code.startsWith(prefix) && /^\d{8}$/.test(code)) max = Math.max(max, Number(code.slice(4)));
  }
  for (let seq = max + 1; seq <= 9999; seq += 1) {
    const code = `${prefix}${String(seq).padStart(4, '0')}`;
    if (!used.has(code)) return code;
  }
  throw new Error(`No quedan subcuentas disponibles para el prefijo ${prefix}.`);
}

async function ensureCounterparty(svc, companyId, invoice) {
  const isCustomer = invoice.tipo === 'emitida';
  const name = clean(isCustomer ? invoice.cliente_nombre : invoice.proveedor_nombre) || (isCustomer ? 'Cliente sin identificar' : 'Proveedor sin identificar');
  const taxId = normalizeTaxId(isCustomer ? invoice.cliente_nif : invoice.proveedor_nif);
  const role = isCustomer ? 'cliente' : (invoice.categoria_gasto === 'compras' ? 'proveedor' : 'acreedor');
  const prefix = role === 'cliente' ? '4300' : role === 'proveedor' ? '4000' : '4100';
  let profiles = taxId
    ? await svc.entities.CounterpartyFiscalProfile.filter({ company_id: companyId, taxId }, '-created_date', 10)
    : await svc.entities.CounterpartyFiscalProfile.filter({ company_id: companyId, name }, '-created_date', 10);
  let profile = (profiles || []).find(p => p.accountingAccountCode && p.accountingRole === role)
    || (profiles || []).find(p => p.accountingAccountCode);
  if (profile?.accountingAccountCode) {
    const account = await ensureAccount(svc, companyId, profile.accountingAccountCode, name, isCustomer ? 'cliente' : 'proveedor', {
      nif: taxId,
      counterpartyProfileId: profile.id,
      sequencePrefix: prefix,
    });
    return { profile, account, role };
  }

  let code;
  let account;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    code = await nextCounterpartyCode(svc, companyId, prefix);
    const collision = await svc.entities.AccountingAccount.filter({ companyId, code }, '-created_date', 1);
    if (collision?.length) continue;
    account = await ensureAccount(svc, companyId, code, name, isCustomer ? 'cliente' : 'proveedor', {
      nif: taxId,
      sequencePrefix: prefix,
    });
    break;
  }
  if (!account) throw new Error('No se pudo asignar una subcuenta correlativa al tercero.');

  if (!profile) {
    profile = await svc.entities.CounterpartyFiscalProfile.create({
      company_id: companyId,
      name,
      taxId,
      isBusiness: Boolean(taxId),
      accountingRole: role,
      accountingAccountId: account.id,
      accountingAccountCode: account.code,
      accountingAssignedAt: new Date().toISOString(),
      accountingSchemaVersion: SCHEMA_VERSION,
    });
  } else {
    await svc.entities.CounterpartyFiscalProfile.update(profile.id, {
      accountingRole: role,
      accountingAccountId: account.id,
      accountingAccountCode: account.code,
      accountingAssignedAt: new Date().toISOString(),
      accountingSchemaVersion: SCHEMA_VERSION,
    });
  }
  await svc.entities.AccountingAccount.update(account.id, { counterpartyProfileId: profile.id });
  return { profile: { ...profile, accountingAccountCode: account.code }, account, role };
}

async function getTaxKind(svc, companyId, invoice) {
  const explicit = clean(invoice.indirect_tax_kind).toLowerCase();
  if (['iva', 'igic', 'no_aplica'].includes(explicit)) return explicit;
  const treatment = clean(invoice.fiscal_treatment).toLowerCase();
  if (treatment.includes('igic')) return 'igic';
  const profiles = await svc.entities.FiscalProfile.filter({ company_id: companyId, active: true }, '-reviewedAt', 1);
  const profile = profiles?.[0];
  const defaultKind = profile?.indirectTaxDefault || (profile?.mainTerritory === 'canarias' ? 'igic' : 'iva');
  if (defaultKind === 'mixto') {
    if (treatment.includes('igic')) return 'igic';
    if (treatment.includes('iva')) return 'iva';
    throw new Error('El perfil fiscal es mixto. Indica IVA o IGIC en la factura antes de contabilizar.');
  }
  return defaultKind;
}

export async function buildInvoicePosting(svc, companyId, invoice) {
  const counterparty = await ensureCounterparty(svc, companyId, invoice);
  const taxKind = await getTaxKind(svc, companyId, invoice);
  const base = money(invoice.base_imponible);
  const tax = money(invoice.cuota_iva);
  const deductibleTax = invoice.tipo === 'recibida' && invoice.deductible_tax_amount != null
    ? money(invoice.deductible_tax_amount)
    : tax;
  const nonDeductibleTax = invoice.tipo === 'recibida'
    ? money(invoice.non_deductible_tax_amount != null ? invoice.non_deductible_tax_amount : tax - deductibleTax)
    : 0;
  const withholding = money(invoice.importe_retencion != null ? invoice.importe_retencion : (base * Number(invoice.retencion_irpf || 0) / 100));
  const total = money(invoice.total_factura || base + tax - withholding);
  if (!invoice.es_rectificativa && base <= 0) throw new Error('La base imponible debe ser positiva salvo factura rectificativa.');
  const sign = base < 0 ? -1 : 1;
  const absBase = Math.abs(base);
  const absTax = Math.abs(tax);
  const absDeductibleTax = Math.abs(deductibleTax);
  const absNonDeductibleTax = Math.abs(nonDeductibleTax);
  const taxPostingAmount = invoice.tipo === 'recibida' ? absDeductibleTax : absTax;
  const resultPostingAmount = invoice.tipo === 'recibida' ? absBase + absNonDeductibleTax : absBase;
  const absWithholding = Math.abs(withholding);
  const absTotal = Math.abs(total);
  const category = invoice.categoria_gasto || (invoice.tipo === 'emitida' ? 'ventas_servicios' : 'otros');
  let configuredCode = '';
  let configuredName = '';
  try {
    const configurations = await svc.entities.AccountingConfiguration.filter({ companyId }, '-updatedAt', 1);
    const mappings = JSON.parse(configurations?.[0]?.mappingsJson || '[]');
    const mapped = Array.isArray(mappings)
      ? mappings.find(item => item.categoria === category && item.tipo === (invoice.tipo === 'emitida' ? 'ingreso' : 'gasto'))
      : null;
    configuredCode = mapped?.cuenta ? canonical8(mapped.cuenta) : '';
    configuredName = clean(mapped?.nombre);
  } catch (error) {
    console.warn('[accountingEngine] Configuración contable no aplicable:', error.message);
  }
  const resultCode = invoice.revenue_expense_account_code
    ? canonical8(invoice.revenue_expense_account_code)
    : configuredCode || CATEGORY_ACCOUNT[category] || (invoice.tipo === 'emitida' ? '70500000' : '62900000');
  const resultDef = ACCOUNT_DEFS[resultCode] || [configuredName || (invoice.tipo === 'emitida' ? 'Ingresos' : 'Gastos'), invoice.tipo === 'emitida' ? 'ingreso' : 'gasto'];
  const resultAccount = await ensureAccount(svc, companyId, resultCode, resultDef[0], resultDef[1]);
  const taxCode = taxKind === 'igic'
    ? (invoice.tipo === 'emitida' ? '47770000' : '47270000')
    : (invoice.tipo === 'emitida' ? '47700000' : '47200000');
  const taxAccount = taxPostingAmount > 0 && taxKind !== 'no_aplica'
    ? await ensureAccount(svc, companyId, taxCode, ACCOUNT_DEFS[taxCode][0], 'impuesto')
    : null;
  const retentionCode = invoice.tipo === 'emitida' ? '47300000' : '47510000';
  const retentionAccount = absWithholding > 0
    ? await ensureAccount(svc, companyId, retentionCode, ACCOUNT_DEFS[retentionCode][0], 'impuesto')
    : null;
  const description = clean(invoice.concepto) || `Factura ${invoice.numero_factura}`;
  const line = (account, debit, credit, sourceLineType) => ({
    accountId: account.id,
    accountCode: account.code,
    accountName: account.name,
    description,
    debit: money(debit),
    credit: money(credit),
    counterpartyAccountId: counterparty.account.id,
    counterpartyAccountCode: counterparty.account.code,
    taxCode: taxKind,
    sourceLineType,
  });
  let lines;
  if (invoice.tipo === 'emitida') {
    lines = [
      line(counterparty.account, sign * absTotal > 0 ? absTotal : 0, sign * absTotal < 0 ? absTotal : 0, 'tercero'),
      ...(absWithholding ? [line(retentionAccount, sign > 0 ? absWithholding : 0, sign < 0 ? absWithholding : 0, 'retencion')] : []),
      line(resultAccount, sign < 0 ? resultPostingAmount : 0, sign > 0 ? resultPostingAmount : 0, 'ingreso'),
      ...(taxAccount ? [line(taxAccount, sign < 0 ? taxPostingAmount : 0, sign > 0 ? taxPostingAmount : 0, 'impuesto')] : []),
    ];
  } else {
    lines = [
      line(resultAccount, sign > 0 ? resultPostingAmount : 0, sign < 0 ? resultPostingAmount : 0, 'gasto'),
      ...(taxAccount ? [line(taxAccount, sign > 0 ? taxPostingAmount : 0, sign < 0 ? taxPostingAmount : 0, 'impuesto')] : []),
      line(counterparty.account, sign < 0 ? absTotal : 0, sign > 0 ? absTotal : 0, 'tercero'),
      ...(absWithholding ? [line(retentionAccount, sign < 0 ? absWithholding : 0, sign > 0 ? absWithholding : 0, 'retencion')] : []),
    ];
  }
  return { lines, counterparty, resultAccount, taxKind, base, tax, withholding, total };
}

function validateLines(lines) {
  if (!Array.isArray(lines) || lines.length < 2) throw new Error('Se necesitan al menos dos líneas.');
  for (const item of lines) {
    if (!isCanonical8(item.accountCode)) throw new Error(`La cuenta ${item.accountCode || 'vacía'} debe tener exactamente 8 dígitos.`);
    const debit = money(item.debit);
    const credit = money(item.credit);
    if (debit < 0 || credit < 0 || (debit > 0 && credit > 0) || (debit === 0 && credit === 0)) {
      throw new Error('Cada línea debe tener un importe positivo solo en Debe o solo en Haber.');
    }
  }
  const debit = money(lines.reduce((sum, item) => sum + money(item.debit), 0));
  const credit = money(lines.reduce((sum, item) => sum + money(item.credit), 0));
  if (Math.abs(debit - credit) > 0.01) throw new Error(`El asiento no cuadra: Debe ${debit.toFixed(2)} / Haber ${credit.toFixed(2)}.`);
  return { debit, credit };
}

export async function assertAccountingDateOpen(svc, companyId, date, options = {}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) throw new Error('La fecha contable no es válida.');
  const year = Number(String(date).slice(0, 4));
  const periods = await svc.entities.AccountingFiscalYear.filter({ companyId, year }, '-created_date', 5);
  const period = periods?.[0];
  if (!period) return { year, period: null };
  if (period.status === 'cerrado') throw new Error(`El ejercicio ${year} está cerrado.`);
  if (!options.systemOverride && period.lockedThroughDate && String(date) <= String(period.lockedThroughDate)) {
    throw new Error(`El período está bloqueado hasta ${period.lockedThroughDate}.`);
  }
  if (String(date) < String(period.startDate) || String(date) > String(period.endDate)) {
    throw new Error(`La fecha queda fuera del ejercicio contable ${year}.`);
  }
  return { year, period };
}

async function reserveEntryNumber(svc, companyId, year, series = 'GENERAL') {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const [entries, reservations] = await Promise.all([
      svc.entities.JournalEntry.filter({ companyId, ejercicio: year }, '-entryNumber', 5000),
      svc.entities.AccountingEntryNumberReservation.filter({ companyId, year, series }, '-number', 5000),
    ]);
    const entryMaximum = (entries || []).reduce((max, entry) => {
      const match = clean(entry.entryNumber).match(/(\d+)$/);
      return Math.max(max, match ? Number(match[1]) : 0);
    }, 0);
    const reservationMaximum = (reservations || []).reduce((max, item) => Math.max(max, Number(item.number || 0)), 0);
    const number = Math.max(entryMaximum, reservationMaximum) + 1;
    const reservationKey = `${companyId}:${year}:${series}:${number}`;
    const reservation = await svc.entities.AccountingEntryNumberReservation.create({
      companyId,
      year,
      series,
      number,
      reservationKey,
      token: crypto.randomUUID(),
      status: 'reservado',
      reservedAt: new Date().toISOString(),
    });
    await new Promise(resolve => setTimeout(resolve, 50));
    const contenders = await svc.entities.AccountingEntryNumberReservation.filter({ companyId, reservationKey }, 'created_date', 50);
    const winner = [...(contenders || [])].sort((a, b) => String(a.created_date).localeCompare(String(b.created_date)) || String(a.id).localeCompare(String(b.id)))[0];
    if (winner?.id === reservation.id) {
      return {
        entryNumber: series === 'GENERAL' ? `${year}-${String(number).padStart(6, '0')}` : `${series}-${year}-${String(number).padStart(6, '0')}`,
        reservation,
      };
    }
    await svc.entities.AccountingEntryNumberReservation.delete(reservation.id).catch(() => null);
  }
  throw new Error('No se pudo reservar un número de asiento único. Inténtalo de nuevo.');
}

export async function createJournalEntry(svc, companyId, payload, userEmail) {
  const normalized = [];
  for (const item of payload.lines || []) {
    const code = canonical8(item.accountCode || item.cuenta);
    const existing = await svc.entities.AccountingAccount.filter({ companyId, code }, '-created_date', 1);
    if (!existing?.[0]) throw new Error(`La cuenta ${code} no existe en el plan contable de la empresa.`);
    normalized.push({
      ...item,
      accountId: existing[0].id,
      accountCode: code,
      accountName: item.accountName || item.nombre || existing[0].name,
      debit: money(item.debit ?? item.debe),
      credit: money(item.credit ?? item.haber),
    });
  }
  const totals = validateLines(normalized);
  const date = payload.date;
  const { year } = await assertAccountingDateOpen(svc, companyId, date, { systemOverride: payload.systemOverride === true && payload.source === 'sistema' });
  const series = clean(payload.series || 'GENERAL').toUpperCase();
  const currency = clean(payload.currency || 'EUR').toUpperCase();
  const fxRate = Number(payload.fxRate || 1);
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('La divisa debe indicarse con tres letras.');
  if (currency !== 'EUR' && (!Number.isFinite(fxRate) || fxRate <= 0)) {
    throw new Error('Indica un tipo de cambio válido para contabilizar una operación en divisa distinta de EUR.');
  }
  const reserved = await reserveEntryNumber(svc, companyId, year, series);
  const now = new Date().toISOString();
  const status = payload.status || 'confirmado';
  let entry;
  try {
    entry = await svc.entities.JournalEntry.create({
      companyId,
      entryNumber: reserved.entryNumber,
      numberReservationId: reserved.reservation.id,
      series,
      date,
      ejercicio: year,
      type: payload.type || 'manual',
      description: clean(payload.description),
      documentId: payload.documentId || '',
      ocrDocumentId: payload.ocrDocumentId || '',
      source: payload.source || 'manual',
      sourceEvent: payload.sourceEvent || '',
      status,
      totalDebit: totals.debit,
      totalCredit: totals.credit,
      isBalanced: true,
      confirmedAt: status === 'confirmado' ? now : null,
      confirmedBy: status === 'confirmado' ? userEmail : '',
      validationStatus: status === 'confirmado' ? 'CONFIRMADO' : 'BORRADOR_PENDIENTE_REVISION',
      postingKey: payload.postingKey || '',
      currency,
      fxRate,
      originalAmount: payload.originalAmount == null ? null : money(payload.originalAmount),
      costCenterId: payload.costCenterId || '',
      projectId: payload.projectId || '',
      accountingSchemaVersion: SCHEMA_VERSION,
    });
    const linePayloads = normalized.map((item, index) => ({
      journalEntryId: entry.id,
      companyId,
      lineNumber: index + 1,
      accountId: item.accountId,
      accountCode: item.accountCode,
      accountName: item.accountName,
      description: item.description || payload.description,
      debit: item.debit,
      credit: item.credit,
      taxCode: item.taxCode || '',
      counterpartyAccountId: item.counterpartyAccountId || '',
      counterpartyAccountCode: item.counterpartyAccountCode || '',
      documentId: payload.documentId || '',
      bankTransactionId: item.bankTransactionId || '',
      isReconciled: Boolean(item.isReconciled),
      reconciledAt: item.reconciledAt || null,
      entryStatus: status,
      entryDate: date,
      ejercicio: year,
      subcuenta: item.accountCode,
      cuenta4: item.accountCode.slice(0, 4),
      cuenta3: item.accountCode.slice(0, 3),
      grupo: item.accountCode.slice(0, 1),
      sourceLineType: item.sourceLineType || 'manual',
      currency: item.currency || currency,
      fxRate: Number(item.fxRate || fxRate),
      originalDebit: item.originalDebit == null ? null : money(item.originalDebit),
      originalCredit: item.originalCredit == null ? null : money(item.originalCredit),
      costCenterId: item.costCenterId || payload.costCenterId || '',
      projectId: item.projectId || payload.projectId || '',
      validationStatus: status === 'confirmado' ? 'CONFIRMADO' : 'BORRADOR_PENDIENTE_REVISION',
      accountingSchemaVersion: SCHEMA_VERSION,
    }));
    const rows = await svc.entities.JournalEntryLine.bulkCreate(linePayloads);
    await svc.entities.AccountingEntryNumberReservation.update(reserved.reservation.id, {
      status: 'asignado',
      entryId: entry.id,
      assignedAt: new Date().toISOString(),
    });
    return { entry, lines: rows };
  } catch (error) {
    if (entry?.id) {
      await svc.entities.JournalEntry.delete(entry.id).catch(async () => {
        await svc.entities.JournalEntry.update(entry.id, {
          status: 'pendiente_revision',
          validationStatus: 'ERROR_CREACION_LINEAS',
          notes: `Error atómico creando líneas: ${error.message}`,
        }).catch(() => null);
      });
    }
    await svc.entities.AccountingEntryNumberReservation.delete(reserved.reservation.id).catch(() => null);
    throw error;
  }
}

async function requireHealthyPosting(svc, companyId, entry, context) {
  if (!entry || entry.companyId !== companyId || entry.status === 'anulado') return null;
  let lines = await svc.entities.JournalEntryLine.filter({ companyId, journalEntryId: entry.id }, 'lineNumber', 5000);
  if ((!lines || !lines.length) && entry.importKey) {
    lines = await svc.entities.JournalEntryLine.filter({ companyId, journalEntryId: entry.importKey }, 'lineNumber', 5000);
  }
  const debit = money((lines || []).reduce((sum, item) => sum + Number(item.debit || item.debeE || 0), 0));
  const credit = money((lines || []).reduce((sum, item) => sum + Number(item.credit || item.haberE || 0), 0));
  if ((lines || []).length < 2 || Math.abs(debit - credit) > 0.01) {
    throw new Error(`${context}: existe un asiento previo incompleto o descuadrado. Revísalo antes de reintentar para evitar duplicados.`);
  }
  return lines;
}

export async function postBankReconciliation(svc, companyId, transaction, bankAccount, counterpartyAccount, userEmail, options = {}) {
  const amount = money(Math.abs(Number(transaction.importe) || 0));
  if (amount <= 0) throw new Error('El movimiento bancario no tiene un importe válido.');
  if (!bankAccount?.id || bankAccount.companyId !== companyId || bankAccount.status === 'inactiva') {
    throw new Error('La cuenta contable bancaria no pertenece a la empresa o está inactiva.');
  }
  if (!counterpartyAccount?.id || counterpartyAccount.companyId !== companyId || counterpartyAccount.status === 'inactiva') {
    throw new Error('La cuenta de contrapartida no pertenece a la empresa o está inactiva.');
  }
  if (bankAccount.id === counterpartyAccount.id) throw new Error('Banco y contrapartida no pueden ser la misma cuenta.');
  const postingKey = `bank:${transaction.id}:${SCHEMA_VERSION}`;
  const duplicate = await svc.entities.JournalEntry.filter({ companyId, postingKey }, '-created_date', 1);
  if (duplicate?.[0]) {
    const lines = await requireHealthyPosting(svc, companyId, duplicate[0], 'Conciliación bancaria');
    if (options.documentId && duplicate[0].documentId && duplicate[0].documentId !== options.documentId) {
      throw new Error('El movimiento ya tiene un asiento vinculado a otro documento.');
    }
    if (!(lines || []).some(item => item.accountId === counterpartyAccount.id)) {
      throw new Error('El asiento bancario existente utiliza otra contrapartida.');
    }
    return { alreadyPosted: true, entry: duplicate[0], lines };
  }
  const now = new Date().toISOString();
  const description = clean(options.description || transaction.concepto || 'Conciliación bancaria');
  const incoming = transaction.tipo === 'entrada';
  const line = (account, debit, credit, sourceLineType) => ({
    accountId: account.id,
    accountCode: account.code,
    accountName: account.name,
    description,
    debit: money(debit),
    credit: money(credit),
    bankTransactionId: transaction.id,
    isReconciled: true,
    reconciledAt: now,
    sourceLineType,
  });
  return await createJournalEntry(svc, companyId, {
    date: transaction.fecha_operacion,
    description,
    type: incoming ? 'cobro' : 'pago',
    source: 'conciliacion',
    documentId: options.documentId || transaction.id,
    postingKey,
    status: options.status || 'confirmado',
    lines: incoming
      ? [line(bankAccount, amount, 0, 'banco'), line(counterpartyAccount, 0, amount, options.counterpartyLineType || 'ajuste')]
      : [line(counterpartyAccount, amount, 0, options.counterpartyLineType || 'ajuste'), line(bankAccount, 0, amount, 'banco')],
  }, userEmail);
}

export async function postInvoice(svc, companyId, invoice, userEmail, options = {}) {
  if (invoice.anulada) throw new Error('No se puede contabilizar una factura anulada.');
  if (invoice.linked_journal_entry_id) {
    const linked = await svc.entities.JournalEntry.get(invoice.linked_journal_entry_id).catch(() => null);
    if (linked && linked.companyId === companyId && linked.status !== 'anulado') {
      await requireHealthyPosting(svc, companyId, linked, 'Contabilización de factura');
      return { alreadyPosted: true, entry: linked };
    }
  }
  const postingKey = `invoice:${invoice.id}:${SCHEMA_VERSION}`;
  const duplicate = await svc.entities.JournalEntry.filter({ companyId, postingKey }, '-created_date', 1);
  if (duplicate?.[0]) {
    await requireHealthyPosting(svc, companyId, duplicate[0], 'Contabilización de factura');
    await svc.entities.Invoice.update(invoice.id, {
      linked_journal_entry_id: duplicate[0].id,
      estado_contable: duplicate[0].status === 'confirmado' ? 'contabilizada' : 'asiento_propuesto',
    });
    return { alreadyPosted: true, entry: duplicate[0] };
  }
  const generatedProposal = await buildInvoicePosting(svc, companyId, invoice);
  const currency = clean(invoice.moneda || 'EUR').toUpperCase();
  const fxRate = Number(options.fxRate || invoice.exchange_rate || invoice.tipo_cambio || 1);
  if (currency !== 'EUR' && (!Number.isFinite(fxRate) || fxRate <= 0 || fxRate === 1)) {
    throw new Error(`La factura está en ${currency}. Indica el tipo de cambio a EUR antes de contabilizarla.`);
  }
  const sourceLines = options.lines?.length ? options.lines : generatedProposal.lines;
  const proposal = {
    ...generatedProposal,
    lines: sourceLines.map(line => currency === 'EUR' ? line : {
      ...line,
      originalDebit: money(line.debit),
      originalCredit: money(line.credit),
      debit: money(line.debit * fxRate),
      credit: money(line.credit * fxRate),
      currency,
      fxRate,
    }),
  };
  const created = await createJournalEntry(svc, companyId, {
    date: options.date || invoice.fecha_emision,
    description: options.description || invoice.concepto || `Factura ${invoice.numero_factura}`,
    type: invoice.tipo === 'emitida' ? 'ingreso' : 'gasto',
    source: options.source || (invoice.origin === 'ocr' ? 'OCR' : invoice.tipo === 'emitida' ? 'factura_emitida' : 'factura_recibida'),
    documentId: invoice.id,
    ocrDocumentId: options.ocrDocumentId || invoice.ocr_document_id || '',
    postingKey,
    status: options.status || 'confirmado',
    currency,
    fxRate,
    originalAmount: currency === 'EUR' ? null : money(invoice.total_factura),
    lines: proposal.lines,
  }, userEmail);
  const now = new Date().toISOString();
  await svc.entities.Invoice.update(invoice.id, {
    estado_contable: created.entry.status === 'confirmado' ? 'contabilizada' : 'asiento_propuesto',
    linked_journal_entry_id: created.entry.id,
    fecha_contabilizacion: created.entry.status === 'confirmado' ? now : null,
    confirmado_por: created.entry.status === 'confirmado' ? userEmail : '',
    counterparty_account_id: proposal.counterparty?.account?.id || '',
    counterparty_account_code: proposal.counterparty?.account?.code || '',
    revenue_expense_account_id: proposal.resultAccount?.id || '',
    revenue_expense_account_code: proposal.resultAccount?.code || '',
    indirect_tax_kind: proposal.taxKind || invoice.indirect_tax_kind || '',
    accounting_schema_version: SCHEMA_VERSION,
    accounting_review_status: created.entry.status === 'confirmado' ? 'validada_contabilizada' : 'pendiente_revision',
  });
  try {
    const existingTaxLines = await svc.entities.InvoiceTaxLine.filter({ companyId, invoiceId: invoice.id }, 'lineNumber', 100);
    if (!existingTaxLines?.length) {
      const deductibleQuota = invoice.tipo === 'recibida'
        ? money(invoice.deductible_tax_amount != null ? invoice.deductible_tax_amount : proposal.tax)
        : money(proposal.tax);
      const nonDeductibleQuota = invoice.tipo === 'recibida'
        ? money(invoice.non_deductible_tax_amount != null ? invoice.non_deductible_tax_amount : proposal.tax - deductibleQuota)
        : 0;
      await svc.entities.InvoiceTaxLine.create({
        companyId,
        invoiceId: invoice.id,
        lineNumber: 1,
        operationDate: invoice.fecha_operacion || invoice.fecha_emision,
        taxKind: proposal.taxKind || 'no_aplica',
        rate: Number(invoice.tipo_iva || 0),
        base: money(proposal.base),
        quota: money(proposal.tax),
        deductibleQuota,
        nonDeductibleQuota,
        surchargeRate: Number(invoice.recargo_equivalencia || 0),
        surchargeQuota: Number(invoice.cuota_recargo || 0),
        regime: invoice.fiscal_treatment || 'general',
        deductible: invoice.tipo !== 'recibida' || nonDeductibleQuota === 0,
        source: invoice.origin === 'ocr' ? 'ocr' : 'sistema',
        reviewStatus: invoice.tipo_iva != null ? 'validado' : 'pendiente_revision',
        schemaVersion: SCHEMA_VERSION,
      });
    }
  } catch (error) {
    console.warn('[accountingEngine] InvoiceTaxLine:', error.message);
  }
  try {
    await svc.entities.DocumentAccountingSource.create({
      companyId,
      documentType: invoice.tipo === 'emitida' ? 'factura_emitida' : 'factura_recibida',
      documentNumber: invoice.numero_factura,
      issueDate: invoice.fecha_emision,
      accountingDate: created.entry.date,
      supplierOrCustomerName: invoice.cliente_nombre || invoice.proveedor_nombre || '',
      supplierOrCustomerTaxId: invoice.cliente_nif || invoice.proveedor_nif || '',
      baseAmount: money(invoice.base_imponible),
      taxAmount: money(invoice.cuota_iva),
      withholdingAmount: money(invoice.importe_retencion),
      totalAmount: money(invoice.total_factura),
      currency: invoice.moneda || 'EUR',
      reviewStatus: 'confirmado',
      linkedJournalEntryId: created.entry.id,
      invoiceId: invoice.id,
      ocrDocumentId: options.ocrDocumentId || invoice.ocr_document_id || '',
      counterpartyAccountCode: proposal.counterparty?.account?.code || '',
      resultAccountCode: proposal.resultAccount?.code || '',
      accountingSchemaVersion: SCHEMA_VERSION,
      evidence: invoice.archivo_url || '',
    });
  } catch (error) {
    console.warn('[accountingEngine] DocumentAccountingSource:', error.message);
  }
  return { ...created, proposal };
}