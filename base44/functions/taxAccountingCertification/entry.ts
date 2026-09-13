import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';
import {
  PHASE0_CERTIFICATION_VERSION,
  buildPhase0Certification,
  evaluateCompanyAccess,
  runSyntheticCertificationSuite,
} from './certificationEngine.js';

const PAGE_SIZE = 5000;
const MAX_ROWS = 200000;

async function fetchAll(handler: any, filter: any, sort: string) {
  const rows: any[] = [];
  let skip = 0;
  while (rows.length < MAX_ROWS) {
    const page = await handler.filter(filter, sort, PAGE_SIZE, skip);
    rows.push(...(page || []));
    if (!page || page.length < PAGE_SIZE) return { rows, truncated: false };
    skip += page.length;
  }
  return { rows, truncated: true };
}

async function loadSource(handler: any, filter: any, sort: string) {
  try {
    return await fetchAll(handler, filter, sort);
  } catch (error) {
    return { rows: [], truncated: false, error: error?.message || 'No se pudo leer la fuente.' };
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Sesión no válida.' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || 'overview');

    if (action === 'self_test') {
      const suite = runSyntheticCertificationSuite();
      return Response.json({ success: suite.ok, suite });
    }

    if (action !== 'overview') return Response.json({ error: 'Acción no soportada.' }, { status: 400 });
    const companyId = String(body.companyId || user?.data?.company_id || '').trim();
    if (!companyId) return Response.json({ error: 'Selecciona una empresa activa.' }, { status: 400 });

    const svc = base44.asServiceRole;
    const company = await svc.entities.Company.get(companyId).catch(() => null);
    if (!company) return Response.json({ error: 'Empresa no encontrada.' }, { status: 404 });
    const access = evaluateCompanyAccess(user, company);
    if (!access.allowed) return Response.json({ error: 'No tienes una asignación válida para certificar esta empresa.' }, { status: 403 });

    const requests = {
      invoices: loadSource(svc.entities.Invoice, { company_id: companyId }, 'fecha_emision'),
      expenses: loadSource(svc.entities.Expense, { company_id: companyId }, 'fecha'),
      entries: loadSource(svc.entities.JournalEntry, { companyId }, 'date'),
      lines: loadSource(svc.entities.JournalEntryLine, { companyId }, 'journalEntryId'),
      taxLines: loadSource(svc.entities.InvoiceTaxLine, { companyId }, 'operationDate'),
      payments: loadSource(svc.entities.InvoicePayment, { company_id: companyId }, 'payment_date'),
      bankAccounts: loadSource(svc.entities.BankAccount, { company_id: companyId }, 'created_date'),
      bankTransactions: loadSource(svc.entities.BankTransaction, { company_id: companyId }, 'fecha_operacion'),
      accounts: loadSource(svc.entities.AccountingAccount, { companyId }, 'code'),
      taxDrafts: loadSource(svc.entities.TaxDraft, { companyId }, 'created_date'),
      taxFilings: loadSource(svc.entities.TaxFiling, { companyId }, 'fechaPresentacion'),
      taxOfficialFiles: loadSource(svc.entities.TaxOfficialFile, { companyId }, 'fechaGeneracion'),
      taxPeriods: loadSource(svc.entities.TaxPeriod, { companyId }, 'ejercicio'),
      taxModels: loadSource(svc.entities.TaxModel, { companyId }, 'codigo'),
      fiscalProfiles: loadSource(svc.entities.FiscalProfile, { company_id: companyId }, 'reviewedAt'),
    };
    const loaded = await Promise.all(Object.values(requests));
    const names = Object.keys(requests);
    const sources: Record<string, any[]> = {};
    const truncated: Record<string, boolean> = {};
    const sourceErrors: Record<string, string> = {};
    loaded.forEach((result: any, index) => {
      const name = names[index];
      sources[name] = result.rows || [];
      truncated[name] = result.truncated === true;
      if (result.error) sourceErrors[name] = result.error;
    });
    const certification = buildPhase0Certification({ companyId, sources, truncated, sourceErrors });
    return Response.json({
      success: true,
      version: PHASE0_CERTIFICATION_VERSION,
      company: { id: company.id, name: company.razon_social || company.nombre_comercial || 'Empresa' },
      access,
      sourceErrors,
      certification,
    });
  } catch (error) {
    console.error('taxAccountingCertification error', error);
    return Response.json({ error: error?.message || 'No se pudo completar la certificación.' }, { status: error?.status || 500 });
  }
});
