import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import * as esbuild from 'esbuild';

async function compile(entry) {
  const build = await esbuild.build({
    entryPoints: [path.resolve(entry)], bundle: true, write: false, platform: 'node', format: 'cjs',
    plugins: [{ name: 'sdk-stub', setup(builder) {
      builder.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'sdk', namespace: 'stub' }));
      builder.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ loader: 'js', contents: 'export const createClientFromRequest=()=>globalThis.__client;' }));
    } }],
  });
  return build.outputFiles[0].text;
}

function entity(records, name, writes) {
  records[name] ||= [];
  const match = (row, filter = {}) => Object.entries(filter).every(([key, value]) => row[key] === value);
  return {
    list: async (_sort, limit = 50, skip = 0) => records[name].slice(skip, skip + limit),
    filter: async (filter, _sort, limit = 50, skip = 0) => records[name].filter(row => match(row, filter)).slice(skip, skip + limit),
    get: async id => records[name].find(row => row.id === id) || null,
    create: async data => { const row = { id: `${name}-${records[name].length + 1}`, created_date: new Date().toISOString(), ...data }; records[name].push(row); writes.push({ name, action: 'create', row }); return row; },
    update: async (id, data) => { const row = records[name].find(item => item.id === id); if (!row) throw new Error('missing'); Object.assign(row, data); writes.push({ name, action: 'update', row: { ...row } }); return row; },
    delete: async id => { const index = records[name].findIndex(item => item.id === id); if (index >= 0) records[name].splice(index, 1); writes.push({ name, action: 'delete', id }); },
  };
}

async function harness(entry, records, initialUser) {
  let handler;
  let user = initialUser;
  const writes = [];
  const entities = new Proxy({}, { get: (_target, name) => entity(records, String(name), writes) });
  const client = { auth: { me: async () => user }, asServiceRole: { entities } };
  const code = await compile(entry);
  const context = vm.createContext({ Response, Request, URL, TextEncoder, TextDecoder, crypto: webcrypto, Date, console, __client: client, Deno: { serve: fn => { handler = fn; } } });
  vm.runInContext(code, context, { filename: entry });
  return {
    writes,
    setUser(next) { user = next; },
    async call(body) {
      const response = await handler(new Request('https://test.invalid', { method: 'POST', body: JSON.stringify(body) }));
      return { status: response.status, data: await response.json() };
    },
  };
}

const advisorRecords = {
  Company: [
    { id: 'company-a', razon_social: 'Empresa A', owner_email: 'client-a@test.invalid', usuarios_autorizados: ['advisor@test.invalid'], activa: true },
    { id: 'company-b', razon_social: 'Empresa B', owner_email: 'client-b@test.invalid', usuarios_autorizados: [], activa: true },
  ],
  ClientAccount: [
    { id: 'client-a', legalName: 'Empresa A', email: 'client-a@test.invalid', internalOwner: 'advisor@test.invalid' },
    { id: 'client-b', legalName: 'Empresa B', email: 'client-b@test.invalid', internalOwner: 'other@test.invalid' },
  ],
  FiscalProfile: [{ id: 'profile-a', company_id: 'company-a', active: true, profileStatus: 'validado_asesor', version: 2 }],
  Invoice: [{ id: 'invoice-a', company_id: 'company-a', numero_factura: 'A-1', fecha_emision: '2026-01-10', anio: 2026, total_factura: 121, estado_contable: 'contabilizada', fiscal_treatment: 'subject_taxed', fiscal_review_status: 'validado', linked_journal_entry_id: 'entry-a' }],
  InvoiceTaxLine: [{ id: 'tax-a', companyId: 'company-a', invoiceId: 'invoice-a', lineNumber: 1, taxKind: 'iva', quota: 21, reviewStatus: 'validado' }],
  JournalEntry: [{ id: 'entry-a', companyId: 'company-a', entryNumber: '1', date: '2026-01-10', ejercicio: 2026, status: 'confirmado', isBalanced: true, totalDebit: 121 }],
  JournalEntryLine: [{ id: 'line-a', companyId: 'company-a', journalEntryId: 'entry-a', accountCode: '430000', debit: 121, credit: 0 }],
  InvoicePayment: [{ id: 'payment-a', company_id: 'company-a', invoice_id: 'invoice-a', amount: 121, payment_date: '2026-01-20', bank_transaction_id: 'bank-a', journal_entry_id: 'entry-a', operation_status: 'committed' }],
  BankTransaction: [{ id: 'bank-a', company_id: 'company-a', fecha_operacion: '2026-01-20', concepto: 'Cobro A-1', importe: 121, estado_conciliacion: 'conciliada_manual', entidad_tipo: 'Invoice', entidad_id: 'invoice-a', journal_entry_id: 'entry-a' }],
  TaxDraft: [], TaxPeriod: [], TaxObligation: [{ id: 'obligation-a', company_id: 'company-a', anio: 2026, modelo_codigo: '303', periodo: '3T', estado: 'pendiente', fecha_limite_presentacion: '2026-09-25' }], FiscalError: [],
  AccountingConfiguration: [{ id: 'cfg-a', companyId: 'company-a', frameworkReviewStatus: 'validated' }],
  AdvisorSavedView: [],
};
const workspace = await harness('base44/functions/advisorWorkspaceOperations/entry.ts', advisorRecords, { email: 'admin@test.invalid', full_name: 'Admin Test', role: 'admin', data: {} });
const workspaceSelf = await workspace.call({ action: 'self_test' });
const overview = await workspace.call({ action: 'overview', year: 2026 });
const trace = await workspace.call({ action: 'trace', companyId: 'company-a', entityType: 'Invoice', entityId: 'invoice-a' });
const save = await workspace.call({ action: 'save_view', name: 'Urgentes', filters: { severity: 'critical' } });
const saveAgain = await workspace.call({ action: 'save_view', name: 'Urgentes', filters: { severity: 'high' } });
const assigned = await workspace.call({ action: 'assign_advisor', companyId: 'company-b', advisorEmail: 'advisor2@test.invalid' });
const assignedAgain = await workspace.call({ action: 'assign_advisor', companyId: 'company-b', advisorEmail: 'advisor2@test.invalid' });
workspace.setUser({ email: 'advisor@test.invalid', role: 'advisor', data: {} });
const advisorOverview = await workspace.call({ action: 'overview', year: 2026 });
const advisorSavedViews = await workspace.call({ action: 'saved_views' });
const advisorTrace = await workspace.call({ action: 'trace', companyId: 'company-a', entityType: 'Invoice', entityId: 'invoice-a' });
workspace.setUser({ email: 'client-a@test.invalid', role: 'user', data: { company_id: 'company-a' } });
const userOverview = await workspace.call({ action: 'overview', year: 2026 });
const userTrace = await workspace.call({ action: 'trace', companyId: 'company-a', entityType: 'Invoice', entityId: 'invoice-a' });
const crossTrace = await workspace.call({ action: 'trace', companyId: 'company-b', entityType: 'Invoice', entityId: 'invoice-a' });

const fiscalRecords = {
  Company: [{ id: 'company-a', razon_social: 'Empresa A', owner_email: 'client-a@test.invalid', usuarios_autorizados: ['advisor@test.invalid'] }],
  FiscalProfile: [], FiscalProfileVersion: [], FiscalActivity: [], TaxModel: [], InvoiceTaxLine: [],
};
const fiscal = await harness('base44/functions/fiscalOperations/entry.ts', fiscalRecords, { email: 'client-a@test.invalid', role: 'user', data: { company_id: 'company-a' } });
const profileBase = { fiscalName: 'Empresa A', taxId: 'B12345678', mainTerritory: 'peninsula_baleares', indirectTaxDefault: 'iva', profileStatus: 'validado_asesor', effectiveFrom: '2026-01-01', lastChangeReason: 'Alta sintética' };
const first = await fiscal.call({ action: 'save_profile', companyId: 'company-a', profile: profileBase });
const duplicate = await fiscal.call({ action: 'save_profile', companyId: 'company-a', profile: profileBase });
fiscal.setUser({ email: 'advisor@test.invalid', role: 'advisor', data: {} });
const validated = await fiscal.call({ action: 'save_profile', companyId: 'company-a', profile: { ...profileBase, profileStatus: 'validado_asesor', lastChangeReason: 'Validación profesional' } });
const fiscalBundle = await fiscal.call({ action: 'bundle', companyId: 'company-a' });

const nodeTypes = new Set((trace.data.trace?.nodes || []).map(item => item.type));
const advisorUi = fs.readFileSync('src/components/tax/advisor/AdvisorWorkspace.jsx', 'utf8');
const sidebarUi = fs.readFileSync('src/components/layout/Sidebar.jsx', 'utf8');
const taxAccountingUi = fs.readFileSync('src/pages/TaxAccounting.jsx', 'utf8');
const profileUi = fs.readFileSync('src/components/ajustes/FiscalProfileManager.jsx', 'utf8');
const modelUi = fs.readFileSync('src/components/tax/impuestos/TaxModelWorkbench.jsx', 'utf8');
const invoiceUi = fs.readFileSync('src/components/facturas/InvoiceOperationalSidePanel.jsx', 'utf8');
const checks = {
  workspaceSelfTest: workspaceSelf.status === 200 && workspaceSelf.data.ok,
  adminPortfolioGlobal: overview.status === 200 && overview.data.rows.length === 2 && overview.data.scope === 'global_admin',
  sourceAlertsDeduplicated: overview.data.rows.find(row => row.company.id === 'company-a')?.alerts.filter(alert => alert.sourceId === 'obligation-a').length === 1 && overview.data.rows.find(row => row.company.id === 'company-a')?.alerts.find(alert => alert.sourceId === 'obligation-a')?.severity === 'critical',
  advisorNoPortfolio: advisorOverview.status === 403,
  advisorNoSavedViews: advisorSavedViews.status === 403,
  advisorAssignedTrace: advisorTrace.status === 200,
  completeTrace: trace.status === 200 && ['Invoice', 'InvoiceTaxLine', 'JournalEntry', 'JournalEntryLine', 'InvoicePayment', 'BankTransaction'].every(type => nodeTypes.has(type)),
  savedViewIdempotent: save.status === 200 && saveAgain.status === 200 && advisorRecords.AdvisorSavedView.length === 1 && advisorRecords.AdvisorSavedView[0].filters.severity === 'high',
  adminAssignmentIdempotent: assigned.status === 200 && assignedAgain.data.alreadyAssigned === true && advisorRecords.Company[1].usuarios_autorizados.filter(email => email === 'advisor2@test.invalid').length === 1,
  adminOnlyInboxNavigation: sidebarUi.includes("id: 'asesoria'") && sidebarUi.includes("path: '/tax-accounting/asesoria', adminOnly: true") && !sidebarUi.includes("path: '/tax-accounting/asesoria', reviewerOnly: true"),
  directInboxRouteGuard: taxAccountingUi.includes("case 'asesoria': return isPlatformAdmin ? <AdvisorWorkspace /> : <Navigate to=\"/tax-accounting/dashboard\" replace />;"),
  adminOnlyWorkspaceUi: advisorUi.includes("const ADMIN_ROLES = ['admin', 'super_admin'];"),
  normalUserNoPortfolio: userOverview.status === 403,
  normalUserOwnTrace: userTrace.status === 200,
  crossCompanyHidden: crossTrace.status === 404,
  userCannotSelfValidate: first.status === 200 && first.data.profile.profileStatus === 'pendiente_revision',
  firstVersionCreated: first.data.versionCreated === true && fiscalRecords.FiscalProfileVersion.length >= 1,
  duplicateProfileNoVersion: duplicate.status === 200 && duplicate.data.versionCreated === false,
  advisorCanValidate: validated.status === 200 && validated.data.profile.profileStatus === 'validado_asesor',
  versionHistoryReturned: fiscalBundle.status === 200 && fiscalBundle.data.profileVersions.length === 2,
  responsivePortfolio: advisorUi.includes('sm:flex-row') && advisorUi.includes('xl:grid-cols-6') && advisorUi.includes('pageSize'),
  largeVolumeControls: advisorUi.includes('50 empresas') && advisorUi.includes('pagination.totalPages'),
  savedFiltersAndExport: advisorUi.includes('saved_views') && advisorUi.includes('save_view') && advisorUi.includes('text/csv;charset=utf-8'),
  liveRefresh: advisorUi.includes('refetchInterval: 60000') && advisorUi.includes('refetchOnWindowFocus: true'),
  responsiveHistoryTable: profileUi.includes('overflow-x-auto') && profileUi.includes('min-w-[680px]'),
  bidirectionalTraceUi: modelUi.includes('Cadena completa') && invoiceUi.includes('Trazabilidad completa'),
};
console.log(JSON.stringify({ ok: Object.values(checks).every(Boolean), checks, workspaceWrites: workspace.writes.length, fiscalWrites: fiscal.writes.length }, null, 2));
if (!Object.values(checks).every(Boolean)) process.exitCode = 1;
