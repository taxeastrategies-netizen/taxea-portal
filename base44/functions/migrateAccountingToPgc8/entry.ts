import { createClientFromRequest } from 'npm:@base44/sdk@0.8.41';
import {
  SCHEMA_VERSION,
  buildInvoicePosting,
  canonical8,
  postInvoice,
  seedOperationalPgc,
} from './accountingEngine.ts';

const nowIso = () => new Date().toISOString();

Deno.serve(async (req) => {
  const startedAt = nowIso();
  let log = null;
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    const isAdmin = user && (user.role === 'admin' || user.role === 'super_admin');
    if (!isAdmin) return Response.json({ error: 'Esta migración requiere permisos de administrador.' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const apply = body.mode === 'apply';
    const batchId = body.batchId || `pgc8-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`;
    const svc = base44.asServiceRole;
    const companies = body.companyId
      ? [await svc.entities.Company.get(body.companyId)]
      : await svc.entities.Company.list('-created_date', 500);

    const totals = {
      companies: 0,
      accountsScanned: 0,
      accountsCreated: 0,
      accountsUpdated: 0,
      linesScanned: 0,
      linesUpdated: 0,
      entriesUpdated: 0,
      invoicesScanned: 0,
      invoicesMetadataUpdated: 0,
      invoicesBackfilled: 0,
      configurationsUpdated: 0,
      warnings: [],
      errors: [],
    };

    for (const company of companies || []) {
      if (!company?.id) continue;
      const companyId = company.id;
      totals.companies += 1;

      if (apply) await seedOperationalPgc(svc, companyId);

      const accounts = await svc.entities.AccountingAccount.filter({ companyId }, 'code', 5000);
      totals.accountsScanned += accounts.length;
      const byCode = new Map(accounts.map(account => [String(account.code || ''), account]));

      for (const account of accounts) {
        let targetCode;
        try {
          targetCode = canonical8(account.code);
        } catch (error) {
          totals.warnings.push(`${companyId}: cuenta inválida ${account.code || '(vacía)'} — ${error.message}`);
          continue;
        }
        if (targetCode === account.code && account.canonical8 === true && account.accountingSchemaVersion === SCHEMA_VERSION) continue;
        let target = byCode.get(targetCode);
        if (apply && !target) {
          target = await svc.entities.AccountingAccount.create({
            ...Object.fromEntries(Object.entries(account).filter(([key]) => !['id', 'created_date', 'updated_date', 'created_by'].includes(key))),
            companyId,
            code: targetCode,
            name: account.name || `Cuenta ${targetCode}`,
            group: targetCode.slice(0, 1),
            subgroup1: targetCode.slice(0, 2),
            subgroup2: targetCode.slice(0, 3),
            subgroup3: targetCode.slice(0, 4),
            canonical8: true,
            codeLength: 8,
            migratedFromCode: account.code,
            migrationBatch: batchId,
            accountingSchemaVersion: SCHEMA_VERSION,
          });
          byCode.set(targetCode, target);
          totals.accountsCreated += 1;
        }
        if (apply && target && account.id !== target.id) {
          await svc.entities.AccountingAccount.update(account.id, {
            status: 'inactiva',
            migratedFromCode: account.code,
            migrationBatch: batchId,
            accountingSchemaVersion: SCHEMA_VERSION,
            notes: [account.notes, `Sustituida por ${targetCode} en migración ${batchId}`].filter(Boolean).join(' · '),
          });
          totals.accountsUpdated += 1;
        } else if (apply && account.id === target?.id) {
          await svc.entities.AccountingAccount.update(account.id, {
            canonical8: true,
            codeLength: 8,
            group: targetCode.slice(0, 1),
            subgroup1: targetCode.slice(0, 2),
            subgroup2: targetCode.slice(0, 3),
            subgroup3: targetCode.slice(0, 4),
            migrationBatch: batchId,
            accountingSchemaVersion: SCHEMA_VERSION,
          });
          totals.accountsUpdated += 1;
        }
      }

      const lines = await svc.entities.JournalEntryLine.filter({ companyId }, '-created_date', 10000);
      totals.linesScanned += lines.length;
      const touchedEntries = new Set();
      for (const line of lines) {
        let targetCode;
        try {
          targetCode = canonical8(line.accountCode || line.subcuenta);
        } catch (error) {
          totals.warnings.push(`${companyId}: apunte ${line.id} sin cuenta migrable`);
          continue;
        }
        let target = byCode.get(targetCode);
        if (apply && !target) {
          target = await svc.entities.AccountingAccount.create({
            companyId,
            code: targetCode,
            name: line.accountName || line.nombreSubcuenta || `Cuenta ${targetCode}`,
            group: targetCode.slice(0, 1),
            subgroup1: targetCode.slice(0, 2),
            subgroup2: targetCode.slice(0, 3),
            subgroup3: targetCode.slice(0, 4),
            type: targetCode.startsWith('43') ? 'cliente' : targetCode.startsWith('40') || targetCode.startsWith('41') ? 'proveedor' : targetCode.startsWith('6') ? 'gasto' : targetCode.startsWith('7') ? 'ingreso' : targetCode.startsWith('47') ? 'impuesto' : 'otro',
            status: 'activa',
            canonical8: true,
            codeLength: 8,
            migratedFromCode: line.accountCode || line.subcuenta || '',
            migrationBatch: batchId,
            accountingSchemaVersion: SCHEMA_VERSION,
          });
          byCode.set(targetCode, target);
          totals.accountsCreated += 1;
        }
        const needsUpdate = line.accountCode !== targetCode || line.accountId !== target?.id || line.accountingSchemaVersion !== SCHEMA_VERSION;
        if (apply && needsUpdate) {
          await svc.entities.JournalEntryLine.update(line.id, {
            accountId: target?.id || line.accountId || '',
            accountCode: targetCode,
            accountName: line.accountName || target?.name || '',
            subcuenta: targetCode,
            nombreSubcuenta: line.nombreSubcuenta || target?.name || '',
            cuenta4: targetCode.slice(0, 4),
            cuenta3: targetCode.slice(0, 3),
            grupo: targetCode.slice(0, 1),
            migratedFromCode: line.accountCode || line.subcuenta || '',
            migrationBatch: batchId,
            accountingSchemaVersion: SCHEMA_VERSION,
          });
          totals.linesUpdated += 1;
          if (line.journalEntryId) touchedEntries.add(line.journalEntryId);
        } else if (!apply && needsUpdate) {
          totals.linesUpdated += 1;
        }
      }

      if (apply) {
        for (const entryId of touchedEntries) {
          await svc.entities.JournalEntry.update(entryId, {
            accountingSchemaVersion: SCHEMA_VERSION,
            migrationBatch: batchId,
          });
          totals.entriesUpdated += 1;
        }
      } else {
        totals.entriesUpdated += touchedEntries.size;
      }

      const configs = await svc.entities.AccountingConfiguration.filter({ companyId }, '-updatedAt', 20);
      for (const config of configs) {
        let mappings = [];
        try {
          mappings = JSON.parse(config.mappingsJson || '[]');
        } catch {
          totals.warnings.push(`${companyId}: configuración ${config.id} con mapeos no válidos`);
        }
        const normalized = Array.isArray(mappings) ? mappings.map(item => ({
          ...item,
          cuenta: item.cuenta ? canonical8(item.cuenta) : '',
        })) : [];
        const configNeedsUpdate = config.accountDigits !== 8
          || config.accountingSchemaVersion !== SCHEMA_VERSION
          || JSON.stringify(normalized) !== JSON.stringify(mappings);
        if (configNeedsUpdate) {
          totals.configurationsUpdated += 1;
          if (apply) {
            await svc.entities.AccountingConfiguration.update(config.id, {
              mappingsJson: JSON.stringify(normalized),
              clientAccount: '43000000',
              supplierAccount: '41000000',
              outputTaxAccount: '47700000',
              inputTaxAccount: '47200000',
              withholdingReceivableAccount: '47300000',
              withholdingPayableAccount: '47510000',
              accountDigits: 8,
              customerSequencePrefix: '4300',
              supplierSequencePrefix: '4000',
              creditorSequencePrefix: '4100',
              accountingSchemaVersion: SCHEMA_VERSION,
              updatedBy: user.email,
              updatedAt: nowIso(),
            });
          }
        }
      }

      const invoices = await svc.entities.Invoice.filter({ company_id: companyId }, '-fecha_emision', 5000);
      totals.invoicesScanned += invoices.length;
      for (const invoice of invoices) {
        if (invoice.anulada) continue;
        if (!apply) {
          if (invoice.accounting_schema_version !== SCHEMA_VERSION) totals.invoicesMetadataUpdated += 1;
          if (invoice.estado_contable === 'contabilizada' && !invoice.linked_journal_entry_id) totals.invoicesBackfilled += 1;
          continue;
        }
        try {
          if (invoice.estado_contable === 'contabilizada' && !invoice.linked_journal_entry_id) {
            const posting = await postInvoice(svc, companyId, invoice, user.email, {
              source: invoice.origin === 'ocr' ? 'OCR' : invoice.tipo === 'emitida' ? 'factura_emitida' : 'factura_recibida',
              ocrDocumentId: invoice.ocr_document_id || '',
              status: 'confirmado',
            });
            if (!posting.alreadyPosted) totals.invoicesBackfilled += 1;
          } else {
            const proposal = await buildInvoicePosting(svc, companyId, invoice);
            await svc.entities.Invoice.update(invoice.id, {
              counterparty_account_id: proposal.counterparty.account.id,
              counterparty_account_code: proposal.counterparty.account.code,
              revenue_expense_account_id: proposal.resultAccount.id,
              revenue_expense_account_code: proposal.resultAccount.code,
              indirect_tax_kind: proposal.taxKind,
              accounting_schema_version: SCHEMA_VERSION,
              accounting_review_status: invoice.linked_journal_entry_id ? 'validada_contabilizada' : 'pendiente_revision',
            });
            totals.invoicesMetadataUpdated += 1;
          }
        } catch (error) {
          totals.warnings.push(`${companyId}: factura ${invoice.numero_factura || invoice.id} no regularizada — ${error.message}`);
          await svc.entities.Invoice.update(invoice.id, {
            estado_contable: invoice.linked_journal_entry_id ? invoice.estado_contable : 'requiere_correccion',
            accounting_review_status: 'requiere_correccion',
            accounting_schema_version: SCHEMA_VERSION,
          }).catch(() => null);
        }
      }

      if (apply) {
        log = await svc.entities.AccountingMigrationLog.create({
          companyId,
          batchId,
          schemaVersion: SCHEMA_VERSION,
          mode: 'apply',
          status: 'completed',
          startedAt,
          completedAt: nowIso(),
          accountsScanned: accounts.length,
          accountsCreated: totals.accountsCreated,
          accountsUpdated: totals.accountsUpdated,
          linesScanned: lines.length,
          linesUpdated: totals.linesUpdated,
          invoicesScanned: invoices.length,
          invoicesBackfilled: totals.invoicesBackfilled,
          warnings: totals.warnings.slice(-200),
          errors: totals.errors.slice(-200),
          executedBy: user.email,
          checkpointId: body.checkpointId || '',
        });
      }
    }

    return Response.json({
      success: true,
      mode: apply ? 'apply' : 'dry_run',
      batchId,
      schemaVersion: SCHEMA_VERSION,
      totals,
      logId: log?.id || '',
    });
  } catch (error) {
    console.error('[migrateAccountingToPgc8]', error);
    return Response.json({ error: error.message || 'Error interno durante la migración.' }, { status: 500 });
  }
});
