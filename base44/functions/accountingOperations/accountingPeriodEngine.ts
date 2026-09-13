import { canonical8, createJournalEntry, ensureAccount, SCHEMA_VERSION } from './accountingEngine.ts';
import { fetchAll } from './accountingReportEngine.ts';

const money = (value) => Math.round((Number(value) || 0) * 100) / 100;
const isoDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));

async function findPeriod(svc, companyId, year) {
  const rows = await svc.entities.AccountingFiscalYear.filter({ companyId, year }, '-created_date', 10);
  return rows?.[0] || null;
}

export async function listFiscalYears(svc, companyId) {
  return await fetchAll(svc.entities.AccountingFiscalYear, { companyId }, '-year', 1000);
}

export async function saveFiscalYear(svc, companyId, body, userEmail) {
  const year = Number(body.year);
  const startDate = String(body.startDate || `${year}-01-01`);
  const endDate = String(body.endDate || `${year}-12-31`);
  if (!Number.isInteger(year) || year < 1900 || year > 2200 || !isoDate(startDate) || !isoDate(endDate)) {
    throw new Error('Ejercicio y fechas no válidos.');
  }
  if (startDate > endDate || Number(startDate.slice(0, 4)) !== year || Number(endDate.slice(0, 4)) !== year) {
    throw new Error('El ejercicio debe empezar y terminar dentro del año indicado.');
  }
  const existing = await findPeriod(svc, companyId, year);
  const configurations = await svc.entities.AccountingConfiguration.filter({ companyId }, '-created_date', 1);
  const configuration = configurations?.[0] || null;
  const payload = {
    companyId,
    year,
    startDate,
    endDate,
    accountingModel: body.accountingModel || existing?.accountingModel || 'interno_simplificado',
    accountingFramework: body.accountingFramework || existing?.accountingFramework || configuration?.accountingFramework || 'pgc_pymes',
    annualAccountsModel: body.annualAccountsModel || existing?.annualAccountsModel || configuration?.annualAccountsModel || 'pyme',
    notes: String(body.notes || existing?.notes || ''),
    schemaVersion: SCHEMA_VERSION,
    updatedBy: userEmail,
  };
  if (existing) {
    if (existing.status === 'cerrado' && (existing.startDate !== startDate || existing.endDate !== endDate)) {
      throw new Error('No se pueden cambiar las fechas de un ejercicio cerrado.');
    }
    return await svc.entities.AccountingFiscalYear.update(existing.id, payload);
  }
  return await svc.entities.AccountingFiscalYear.create({ ...payload, status: 'abierto' });
}

export async function setPeriodLock(svc, companyId, body, userEmail) {
  const year = Number(body.year);
  const period = await findPeriod(svc, companyId, year);
  if (!period) throw new Error('Configura primero el ejercicio contable.');
  if (period.status === 'cerrado') throw new Error('El ejercicio está cerrado.');
  const lockedThroughDate = body.lockedThroughDate ? String(body.lockedThroughDate) : '';
  if (lockedThroughDate && (!isoDate(lockedThroughDate) || lockedThroughDate < period.startDate || lockedThroughDate > period.endDate)) {
    throw new Error('La fecha de bloqueo queda fuera del ejercicio.');
  }
  if (!lockedThroughDate && !String(body.reason || '').trim()) throw new Error('Indica el motivo del desbloqueo.');
  return await svc.entities.AccountingFiscalYear.update(period.id, {
    lockedThroughDate: lockedThroughDate || null,
    reopenedAt: lockedThroughDate ? null : new Date().toISOString(),
    reopenedBy: lockedThroughDate ? '' : userEmail,
    reopenReason: lockedThroughDate ? '' : String(body.reason).trim(),
  });
}

async function yearModel(svc, companyId, year) {
  const [entries, lines, accounts] = await Promise.all([
    fetchAll(svc.entities.JournalEntry, { companyId, ejercicio: year }, 'date', 100000),
    fetchAll(svc.entities.JournalEntryLine, { companyId, ejercicio: year }, 'journalEntryId', 100000),
    fetchAll(svc.entities.AccountingAccount, { companyId }, 'code', 10000),
  ]);
  const active = entries.filter(entry => entry.status !== 'anulado');
  const entryByKey = new Map();
  for (const entry of active) {
    entryByKey.set(entry.id, entry);
    if (entry.importKey) entryByKey.set(entry.importKey, entry);
  }
  const grouped = new Map(active.map(entry => [entry.id, []]));
  let unresolvedLines = 0;
  for (const line of lines) {
    const entry = entryByKey.get(line.journalEntryId) || entryByKey.get(line.importKey) || entryByKey.get(line.asientoKey);
    if (!entry) { unresolvedLines += 1; continue; }
    grouped.get(entry.id).push(line);
  }
  const unbalanced = [];
  const totals = new Map();
  for (const entry of active.filter(item => item.status === 'confirmado')) {
    const rows = grouped.get(entry.id) || [];
    const debit = money(rows.reduce((sum, line) => sum + Number(line.debit || line.debeE || 0), 0));
    const credit = money(rows.reduce((sum, line) => sum + Number(line.credit || line.haberE || 0), 0));
    if (rows.length < 2 || Math.abs(debit - credit) > 0.01) { unbalanced.push(entry.id); continue; }
    for (const line of rows) {
      const code = String(line.accountCode || line.subcuenta || '');
      if (!/^\d{8}$/.test(code)) continue;
      const current = totals.get(code) || { debit: 0, credit: 0 };
      current.debit += Number(line.debit || line.debeE || 0);
      current.credit += Number(line.credit || line.haberE || 0);
      totals.set(code, current);
    }
  }
  return {
    entries: active,
    accounts,
    totals,
    pending: active.filter(entry => ['borrador', 'pendiente_revision'].includes(entry.status)),
    unbalanced,
    unresolvedLines,
  };
}

export async function closingPreview(svc, companyId, yearInput) {
  const year = Number(yearInput);
  const period = await findPeriod(svc, companyId, year);
  if (!period) throw new Error('Configura primero el ejercicio contable.');
  const [model, invoices, taxLines, bankTransactions, profiles, activities] = await Promise.all([
    yearModel(svc, companyId, year),
    fetchAll(svc.entities.Invoice, { company_id: companyId, anio: year }, 'fecha_emision', 100000),
    fetchAll(svc.entities.InvoiceTaxLine, { companyId }, 'operationDate', 100000),
    fetchAll(svc.entities.BankTransaction, { company_id: companyId }, 'fecha_operacion', 100000),
    fetchAll(svc.entities.FiscalProfile, { company_id: companyId, active: true }, '-reviewedAt', 100),
    fetchAll(svc.entities.FiscalActivity, { company_id: companyId, active: true }, 'name', 5000),
  ]);
  const profitLoss = [...model.totals.entries()].filter(([code]) => /^[67]/.test(code)).map(([code, total]) => ({
    code,
    balance: money(total.debit - total.credit),
    account: model.accounts.find(item => item.code === code) || null,
  })).filter(item => Math.abs(item.balance) > 0.01);
  const activeInvoices = invoices.filter(invoice => !invoice.anulada && Number(invoice.anio || String(invoice.fecha_emision || '').slice(0, 4)) === year);
  const pendingInvoices = activeInvoices.filter(invoice => invoice.estado_contable !== 'contabilizada' || ['pendiente_revision', 'requiere_correccion'].includes(invoice.accounting_review_status));
  const taxLinesForYear = taxLines.filter(line => Number(String(line.operationDate || '').slice(0, 4)) === year);
  const detailedInvoiceIds = new Set(taxLinesForYear.map(line => line.invoiceId));
  const legacyFiscalInvoices = activeInvoices.filter(invoice => invoice.estado_contable === 'contabilizada' && !detailedInvoiceIds.has(invoice.id));
  const pendingFiscalLines = taxLinesForYear.filter(line => line.reviewStatus !== 'validado');
  const bankForYear = bankTransactions.filter(item => Number(String(item.fecha_operacion || '').slice(0, 4)) === year && item.estado_proveedor !== 'pending');
  const unreconciledBank = bankForYear.filter(item => !item.journal_entry_id || !['conciliada_auto', 'conciliada_manual', 'movimiento_interno'].includes(item.estado_conciliacion));
  const profile = profiles?.[0] || null;
  const currencyIssues = model.entries.filter(entry => entry.status === 'confirmado' && String(entry.currency || 'EUR').toUpperCase() !== 'EUR' && (!Number.isFinite(Number(entry.fxRate)) || Number(entry.fxRate) <= 0 || Number(entry.fxRate) === 1));
  const pending555Balance = money((model.totals.get('55500000')?.debit || 0) - (model.totals.get('55500000')?.credit || 0));
  const today = new Date().toISOString().slice(0, 10);
  const blockers = [];
  if (today <= period.endDate) blockers.push(`el ejercicio no puede cerrarse antes de finalizar el ${period.endDate}`);
  if (model.pending.length) blockers.push(`${model.pending.length} asientos pendientes de revision`);
  if (model.unbalanced.length) blockers.push(`${model.unbalanced.length} asientos descuadrados o sin lineas`);
  if (model.unresolvedLines) blockers.push(`${model.unresolvedLines} apuntes sin cabecera localizable`);
  if (pendingInvoices.length) blockers.push(`${pendingInvoices.length} facturas activas sin contabilizacion validada`);
  if (Math.abs(pending555Balance) > 0.01) blockers.push(`saldo pendiente en 55500000: ${pending555Balance.toFixed(2)} EUR`);
  if (unreconciledBank.length) blockers.push(`${unreconciledBank.length} movimientos bancarios sin conciliacion contable definitiva`);
  if (!profile || profile.profileStatus !== 'validado_asesor') blockers.push('perfil fiscal no validado por asesor');
  if (!activities.length) blockers.push('no hay actividades fiscales activas');
  if (legacyFiscalInvoices.length) blockers.push(`${legacyFiscalInvoices.length} facturas contabilizadas sin desglose fiscal estructurado`);
   if (pendingFiscalLines.length) blockers.push(`${pendingFiscalLines.length} lineas fiscales pendientes de revision`);
  if (currencyIssues.length) blockers.push(`${currencyIssues.length} asientos en divisa sin tipo de cambio EUR valido`);
  return {
    year,
    period,
    blockers,
    canClose: period.status !== 'cerrado' && blockers.length === 0,
    pendingEntries: model.pending.length,
    unbalancedEntries: model.unbalanced.length,
    unresolvedLines: model.unresolvedLines,
    pendingInvoices: pendingInvoices.length,
    pending555Balance,
    unreconciledBankTransactions: unreconciledBank.length,
    legacyFiscalInvoices: legacyFiscalInvoices.length,
    pendingFiscalLines: pendingFiscalLines.length,
    currencyIssues: currencyIssues.length,
    fiscalProfileValidated: Boolean(profile?.profileStatus === 'validado_asesor'),
    fiscalActivities: activities.length,
    closeDateReached: today > period.endDate,
    resultBeforeTax: money(profitLoss.reduce((sum, item) => sum - item.balance, 0)),
    profitLossAccounts: profitLoss.length,
  };
}

async function existingByKey(svc, companyId, postingKey) {
  const rows = await svc.entities.JournalEntry.filter({ companyId, postingKey }, '-created_date', 10);
  return rows?.find(item => item.status !== 'anulado') || null;
}

async function recordAccountingAudit(svc, companyId, eventType, eventKey, year, reason, userEmail, before, after, relatedEntryIds = []) {
  const duplicate = await svc.entities.AccountingAuditLog.filter({ companyId, eventKey }, '-occurredAt', 1);
  if (duplicate?.[0]) return duplicate[0];
  return await svc.entities.AccountingAuditLog.create({
    companyId,
    eventType,
    eventKey,
    fiscalYear: Number(year),
    reason: String(reason || ''),
    actor: userEmail || '',
    occurredAt: new Date().toISOString(),
    beforeJson: JSON.stringify(before || {}),
    afterJson: JSON.stringify(after || {}),
    relatedEntryIds: relatedEntryIds.filter(Boolean),
    schemaVersion: SCHEMA_VERSION,
  });
}

async function reverseSystemEntry(svc, companyId, entryId, date, reason, userEmail, year, cycle) {
  if (!entryId) return null;
  const original = await svc.entities.JournalEntry.get(entryId).catch(() => null);
  if (!original || original.companyId !== companyId || original.status !== 'confirmado') throw new Error('No se encontró un asiento confirmado del cierre que deba revertirse.');
  const postingKey = `reopen:${companyId}:${year}:${cycle}:${original.id}:${SCHEMA_VERSION}`;
  const existing = await existingByKey(svc, companyId, postingKey);
  if (existing) return existing;
  let lines = await svc.entities.JournalEntryLine.filter({ companyId, journalEntryId: original.id }, 'lineNumber', 5000);
  if ((!lines || !lines.length) && original.importKey) lines = await svc.entities.JournalEntryLine.filter({ companyId, journalEntryId: original.importKey }, 'lineNumber', 5000);
  if (!lines || lines.length < 2) throw new Error(`El asiento ${original.entryNumber || original.id} no tiene líneas suficientes para revertirse.`);
  const reversed = await createJournalEntry(svc, companyId, {
    date,
    description: `Reapertura ${year}: reversión ${original.entryNumber || ''} · ${reason}`,
    type: 'ajuste',
    source: 'sistema',
    sourceEvent: 'reopen_fiscal_year',
    postingKey,
    status: 'confirmado',
    systemOverride: true,
    reopeningOverride: true,
    reversalOfEntryId: original.id,
    lines: lines.map(line => ({
      accountCode: canonical8(line.accountCode || line.subcuenta),
      accountName: line.accountName || '',
      description: `Reapertura: ${line.description || original.description || reason}`,
      debit: money(line.credit ?? line.haberE),
      credit: money(line.debit ?? line.debeE),
      taxCode: line.taxCode || '',
      counterpartyAccountId: line.counterpartyAccountId || '',
      counterpartyAccountCode: line.counterpartyAccountCode || '',
      sourceLineType: line.sourceLineType || 'ajuste',
    })),
  }, userEmail);
  return reversed.entry;
}

export async function executeClosing(svc, companyId, body, userEmail) {
  const year = Number(body.year);
  if (String(body.confirmation || '').trim().toUpperCase() !== `CERRAR ${year}`) {
    throw new Error(`Escribe CERRAR ${year} para confirmar el cierre.`);
  }
  const preview = await closingPreview(svc, companyId, year);
  if (!preview.canClose) throw new Error(preview.blockers.join('. ') || 'El ejercicio no se puede cerrar.');
  const period = preview.period;
  const modelBefore = await yearModel(svc, companyId, year);
  const accountByCode = new Map(modelBefore.accounts.map(account => [account.code, account]));
  const resultAccount = await ensureAccount(svc, companyId, '12900000', 'Resultado del ejercicio', 'patrimonio');
  const cycle = Number(period.closeSequence || 0) + 1;
  const regularizationKey = `regularization:${companyId}:${year}:${cycle}:${SCHEMA_VERSION}`;
  let regularization = await existingByKey(svc, companyId, regularizationKey);
  if (!regularization) {
    const lines = [];
    let debit129 = 0;
    let credit129 = 0;
    for (const [code, total] of modelBefore.totals.entries()) {
      if (!/^[67]/.test(code)) continue;
      const balance = money(total.debit - total.credit);
      if (Math.abs(balance) <= 0.01) continue;
      const account = accountByCode.get(code);
      if (!account) throw new Error(`La cuenta ${code} no existe en el plan contable.`);
      if (balance > 0) { lines.push({ accountCode: code, accountName: account.name, debit: 0, credit: balance }); debit129 += balance; }
      else { lines.push({ accountCode: code, accountName: account.name, debit: -balance, credit: 0 }); credit129 += -balance; }
    }
    const netDebit = money(debit129 - credit129);
    if (netDebit > 0) lines.push({ accountCode: resultAccount.code, accountName: resultAccount.name, debit: netDebit, credit: 0 });
    if (netDebit < 0) lines.push({ accountCode: resultAccount.code, accountName: resultAccount.name, debit: 0, credit: -netDebit });
    if (lines.length >= 2) {
      regularization = (await createJournalEntry(svc, companyId, {
        date: period.endDate, description: `Regularización del ejercicio ${year}`, type: 'regularizacion', source: 'sistema', sourceEvent: 'cierre_ejercicio', postingKey: regularizationKey, status: 'confirmado', systemOverride: true, lines,
      }, userEmail)).entry;
    }
  }
  const modelAfter = await yearModel(svc, companyId, year);
  const closingKey = `closing:${companyId}:${year}:${cycle}:${SCHEMA_VERSION}`;
  let closing = await existingByKey(svc, companyId, closingKey);
  let closingLines = [];
  if (!closing) {
    for (const [code, total] of modelAfter.totals.entries()) {
      if (!/^[1-5]/.test(code)) continue;
      const balance = money(total.debit - total.credit);
      if (Math.abs(balance) <= 0.01) continue;
      const account = accountByCode.get(code) || await ensureAccount(svc, companyId, code, `Cuenta ${code}`);
      closingLines.push({ accountCode: code, accountName: account.name, debit: balance < 0 ? -balance : 0, credit: balance > 0 ? balance : 0 });
    }
    if (closingLines.length >= 2) {
      closing = (await createJournalEntry(svc, companyId, {
        date: period.endDate, description: `Cierre del ejercicio ${year}`, type: 'cierre', source: 'sistema', sourceEvent: 'cierre_ejercicio', postingKey: closingKey, status: 'confirmado', systemOverride: true, lines: closingLines,
      }, userEmail)).entry;
    }
  }
  const nextYear = year + 1;
  let nextPeriod = await findPeriod(svc, companyId, nextYear);
  if (!nextPeriod) nextPeriod = await saveFiscalYear(svc, companyId, { year: nextYear }, userEmail);
  const openingKey = `opening:${companyId}:${nextYear}:from-${year}:${cycle}:${SCHEMA_VERSION}`;
  let opening = await existingByKey(svc, companyId, openingKey);
  if (!opening && closingLines.length >= 2) {
    opening = (await createJournalEntry(svc, companyId, {
      date: nextPeriod.startDate, description: `Apertura del ejercicio ${nextYear}`, type: 'apertura', source: 'sistema', sourceEvent: 'apertura_ejercicio', postingKey: openingKey, status: 'confirmado',
      lines: closingLines.map(line => ({ ...line, debit: line.credit, credit: line.debit })),
    }, userEmail)).entry;
  }
  await svc.entities.AccountingFiscalYear.update(period.id, {
    status: 'cerrado', lockedThroughDate: period.endDate, regularizationEntryId: regularization?.id || '', closingEntryId: closing?.id || '', closedAt: new Date().toISOString(), closedBy: userEmail, closeSequence: cycle,
  });
  if (opening?.id) await svc.entities.AccountingFiscalYear.update(nextPeriod.id, { openingEntryId: opening.id, previousYearId: period.id });
  await recordAccountingAudit(svc, companyId, 'fiscal_year_closed', `close:${companyId}:${year}:${cycle}`, year, body.reason || 'Cierre confirmado', userEmail, period, { status: 'cerrado', cycle }, [regularization?.id, closing?.id, opening?.id]);
  return { year, cycle, regularizationEntryId: regularization?.id || '', closingEntryId: closing?.id || '', openingEntryId: opening?.id || '', idempotent: false };
}

export async function reopenFiscalYear(svc, companyId, body, userEmail) {
  const year = Number(body.year);
  const reason = String(body.reason || '').trim();
  if (!reason) throw new Error('Indica el motivo documentado de la reapertura.');
  if (String(body.confirmation || '').trim().toUpperCase() !== `REABRIR ${year}`) throw new Error(`Escribe REABRIR ${year} para confirmar la reapertura.`);
  const period = await findPeriod(svc, companyId, year);
  if (!period) throw new Error('El ejercicio no está configurado.');
  if (period.status !== 'cerrado') return { year, alreadyOpen: true, reversalEntryIds: period.reopenReversalEntryIds || [] };
  const cycle = Number(period.closeSequence || 1);
  const nextPeriod = await findPeriod(svc, companyId, year + 1);
  if (!nextPeriod) throw new Error('No se encontró el ejercicio siguiente generado por el cierre.');
  const nextEntries = await fetchAll(svc.entities.JournalEntry, { companyId, ejercicio: year + 1 }, 'date', 100000);
  const allowed = new Set([nextPeriod.openingEntryId, ...(nextPeriod.reopenReversalEntryIds || [])].filter(Boolean));
  const subsequentActivity = nextEntries.filter(entry => entry.status === 'confirmado' && !allowed.has(entry.id) && entry.reversalOfEntryId !== nextPeriod.openingEntryId);
  if (subsequentActivity.length) throw new Error(`No se puede reabrir: el ejercicio ${year + 1} ya tiene ${subsequentActivity.length} asientos confirmados posteriores a la apertura.`);
  const reversalEntries = [];
  const openingReversal = await reverseSystemEntry(svc, companyId, nextPeriod.openingEntryId, nextPeriod.startDate, reason, userEmail, year, cycle);
  if (openingReversal) reversalEntries.push(openingReversal);
  const closingReversal = await reverseSystemEntry(svc, companyId, period.closingEntryId, period.endDate, reason, userEmail, year, cycle);
  if (closingReversal) reversalEntries.push(closingReversal);
  const regularizationReversal = await reverseSystemEntry(svc, companyId, period.regularizationEntryId, period.endDate, reason, userEmail, year, cycle);
  if (regularizationReversal) reversalEntries.push(regularizationReversal);
  const now = new Date().toISOString();
  const reversalEntryIds = reversalEntries.map(entry => entry.id);
  const reopened = await svc.entities.AccountingFiscalYear.update(period.id, {
    status: 'abierto',
    lockedThroughDate: null,
    reopenedAt: now,
    reopenedBy: userEmail || '',
    reopenReason: reason,
    reopenReversalEntryIds: reversalEntryIds,
  });
  await svc.entities.AccountingFiscalYear.update(nextPeriod.id, {
    reopenReversalEntryIds: [...new Set([...(nextPeriod.reopenReversalEntryIds || []), openingReversal?.id].filter(Boolean))],
  });
  await recordAccountingAudit(svc, companyId, 'fiscal_year_reopened', `reopen:${companyId}:${year}:${cycle}`, year, reason, userEmail, period, reopened, reversalEntryIds);
  return { year, cycle, reversalEntryIds, period: reopened };
}

