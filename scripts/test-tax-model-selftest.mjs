import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import * as esbuild from 'esbuild';

const entry = path.resolve('base44/functions/taxModelOperations/entry.ts');
const source = fs.readFileSync(entry, 'utf8');
const build = await esbuild.build({
  stdin: { contents: source, loader: 'ts', resolveDir: path.dirname(entry), sourcefile: entry },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'cjs',
  plugins: [{
    name: 'base44-self-test-stub',
    setup(builder) {
      builder.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'base44-sdk', namespace: 'taxea-test' }));
      builder.onLoad({ filter: /.*/, namespace: 'taxea-test' }, () => ({
        loader: 'js',
        contents: `export function createClientFromRequest(){return globalThis.__base44TestClient}`,
      }));
    },
  }],
});

let handler;
let sequence = 0;
const records = {
  Company: [{ id: 'company-test', nif_cif: 'B12345678', razon_social: 'TAXEA QA', owner_email: 'qa@taxea.test', usuarios_autorizados: [] }],
  FiscalProfile: [{ id: 'profile-1', company_id: 'company-test', active: true, profileStatus: 'validado_asesor', mainTerritory: 'peninsula_baleares', taxAuthority: 'aeat', indirectTaxDefault: 'iva' }],
  FiscalActivity: [],
  Invoice: [{ id: 'invoice-trace', company_id: 'company-test', numero_factura: 'R-TRACE', fecha_emision: '2026-01-10', proveedor_nombre: 'PROVEEDOR QA', proveedor_nif: 'B87654321', concepto: 'Servicio QA', base_imponible: 100, cuota_iva: 21, total_factura: 121, tipo: 'recibida', fiscal_review_status: 'validado' }],
  InvoiceTaxLine: [{ id: 'tax-line-trace', companyId: 'company-test', invoiceId: 'invoice-trace', lineNumber: 1, operationDate: '2026-01-10', taxKind: 'iva', rate: 21, base: 100, quota: 21, deductibleQuota: 21, operationType: 'subject_taxed', regime: 'general', reviewStatus: 'validado' }],
  InvoicePayment: [], PayrollExtraction: [], Employee: [], JournalEntry: [], JournalEntryLine: [], TaxDeclarableRecord: [],
  TaxDraft: [
    { id: 'draft-old', companyId: 'company-test', modeloCodigo: '303', ejercicio: 2026, periodo: '1T', version: 1, estado: 'borrador', snapshotHash: 'old', resumen: { calculation: { result: 10 }, source: { hash: 'source-old', count: 1 } }, errores: [], validaciones: [], created_date: '2026-04-01T10:00:00Z', updated_date: '2026-04-01T10:00:00Z' },
    { id: 'draft-latest', companyId: 'company-test', modeloCodigo: '303', ejercicio: 2026, periodo: '1T', version: 2, estado: 'revisado', snapshotHash: 'latest', engineVersion: 'taxea-modelos-2026.09.12-v13', resumen: { definition: { code: '303', name: 'Autoliquidación IVA' }, calculation: { result: 12, fields: [{ code: 'DEDUCIBLE', label: 'Total cuota deducible', value: 21, section: 'Deducciones', formula: 'Suma de cuotas deducibles.', sourceIds: ['InvoiceTaxLine:tax-line-trace'] }, { code: 'DEVENGADO', label: 'Total cuota devengada', value: 33, section: 'Liquidación', sourceIds: [] }], operations: { rates: [], outputQuota: 33, deductibleBase: 100, deductibleQuota: 21, rawResult: 12, intraBase: 0, intraQuota: 0, reverseBase: 0, reverseQuota: 0, intraSupplies: 0, exports: 0, nonSubject: 0 } }, source: { hash: 'source-latest', count: 1, ids: ['InvoiceTaxLine:tax-line-trace'] } }, ajustesManuales: [{ field: 'previousCompensationBalance', value: 0 }], errores: [], validaciones: [], created_date: '2026-04-02T10:00:00Z', updated_date: '2026-04-02T10:00:00Z' },
  ],
  TaxFiling: [{ id: 'filing-1', companyId: 'company-test', modeloCodigo: '303', ejercicio: 2026, periodo: '1T', estadoPresentacion: 'presentado', snapshotVersion: 1, tipoDeclaracion: 'original', importeFinal: 12, resultadoDestino: 'a_ingresar', snapshotHash: 'filing-hash', revisionImportacion: 'validado_estructura', fechaPresentacion: '2026-04-20', fechaImportacion: '2026-04-20T12:00:00Z' }],
  TaxPeriod: [{ id: 'period-1', companyId: 'company-test', modeloCodigo: '303', ejercicio: 2026, periodo: '1T', estado: 'presentado' }],
  TaxOfficialFile: [{ id: 'file-1', companyId: 'company-test', modeloCodigo: '303', ejercicio: 2026, periodo: '1T', estado: 'generado', nombreFichero: '303-test', fechaGeneracion: '2026-04-19T12:00:00Z', hash: 'file-hash' }],
  FiscalError: [],
  TaxModel: [{ id: 'model-303', companyId: 'company-test', codigo: '303', nombre: 'Autoliquidación IVA', activo: true, periodicidad: 'trimestral', administracion: 'AEAT' }],
  TaxSubmission: [{ id: 'legacy-111', companyId: 'company-test', modeloCodigo: '111', ejercicio: 2026, periodo: '1T', estado: 'presentado', fechaEnvio: '2026-04-19T09:00:00Z' }],
};
const matches = (item, query = {}) => Object.entries(query).every(([key, value]) => item?.[key] === value);
const entity = name => ({
  async get(id) { return records[name].find(item => item.id === id) || null; },
  async filter(query = {}, sort = '-created_date', limit = 500, skip = 0) {
    const descending = String(sort).startsWith('-');
    const field = String(sort).replace(/^-/, '');
    return records[name].filter(item => matches(item, query)).sort((a, b) => {
      const left = a[field] || ''; const right = b[field] || '';
      return (left < right ? -1 : left > right ? 1 : 0) * (descending ? -1 : 1);
    }).slice(skip, skip + limit);
  },
  async create(payload) {
    const now = new Date().toISOString();
    const item = { ...payload, id: `${name.toLowerCase()}-${++sequence}`, created_date: now, updated_date: now };
    records[name].push(item); return item;
  },
  async update(id, payload) {
    const index = records[name].findIndex(item => item.id === id);
    if (index < 0) throw new Error(`${name} ${id} no existe`);
    records[name][index] = { ...records[name][index], ...payload, updated_date: new Date().toISOString() };
    return records[name][index];
  },
});
const entities = new Proxy({}, { get: (_target, name) => entity(String(name)) });
const testClient = { auth: { me: async () => ({ id: 'taxea-self-test', email: 'qa@taxea.test', role: 'admin', company_id: 'company-test' }) }, asServiceRole: { entities } };
const context = vm.createContext({
  console,
  Request,
  Response,
  TextEncoder,
  TextDecoder,
  crypto: webcrypto,
  atob,
  btoa,
  setTimeout,
  clearTimeout,
  __base44TestClient: testClient,
  Deno: { serve(fn) { handler = fn; }, env: { get() { return ''; } } },
});
vm.runInContext(build.outputFiles[0].text, context, { filename: 'taxModelOperations.bundle.cjs' });
if (typeof handler !== 'function') throw new Error('El módulo no registró el handler Deno.serve.');

async function invoke(body) {
  const response = await handler(new Request('https://taxea.test/functions/taxModelOperations', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));
  return { response, payload: await response.json() };
}

const selfTest = await invoke({ action: 'self_test' });
const workspace = await invoke({ action: 'workspace', companyId: 'company-test', ejercicio: 2026 });
const oldDraftStatus = await invoke({ action: 'update_draft_status', companyId: 'company-test', draftId: 'draft-old', status: 'aprobado' });
const latestDraftStatus = await invoke({ action: 'update_draft_status', companyId: 'company-test', draftId: 'draft-latest', status: 'aprobado' });
const evidence = await invoke({ action: 'attach_filing_evidence', companyId: 'company-test', filingId: 'filing-1', numeroJustificante: '3032026QA', csv: 'CSV-QA', justificantePdfUrl: 'https://taxea.test/qa.pdf', confirmEvidence: true });
const evidenceConflict = await invoke({ action: 'attach_filing_evidence', companyId: 'company-test', filingId: 'filing-1', numeroJustificante: 'OTRO', confirmEvidence: true });
const firstSave = await invoke({ action: 'save_draft', companyId: 'company-test', modeloCodigo: '111', ejercicio: 2026, periodo: '1T', adjustments: {} });
const secondSave = await invoke({ action: 'save_draft', companyId: 'company-test', modeloCodigo: '111', ejercicio: 2026, periodo: '1T', adjustments: {} });
const advisoryCalculation = await invoke({ action: 'calculate', companyId: 'company-test', modeloCodigo: '111', ejercicio: 2026, periodo: '1T', adjustments: {} });
const advisoryExport = await invoke({ action: 'export', companyId: 'company-test', modeloCodigo: '111', ejercicio: 2026, periodo: '1T', adjustments: {} });
const openedDraft = await invoke({ action: 'open_draft', companyId: 'company-test', draftId: 'draft-latest' });
const fieldTrace = await invoke({ action: 'field_trace', companyId: 'company-test', modeloCodigo: '303', ejercicio: 2026, periodo: '1T', draftId: 'draft-latest', fieldCode: 'DEDUCIBLE', fieldLabel: 'Total cuota deducible', fieldSection: 'Deducciones', page: 1, pageSize: 25 });
const frozenExport = await invoke({ action: 'export', companyId: 'company-test', modeloCodigo: '303', ejercicio: 2026, periodo: '1T', draftId: 'draft-latest' });

const workflowChecks = {
  workspaceLoads: workspace.response.ok && workspace.payload.latestDrafts?.length === 1 && workspace.payload.latestFilings?.length === 1,
  latestVersionSelected: workspace.payload.latestDrafts?.[0]?.id === 'draft-latest',
  legacyGapDetected: workspace.payload.validationIssues?.some(item => item.code === 'LEGACY-SIN-MIGRAR'),
  evidenceGapDetected: workspace.payload.validationIssues?.some(item => item.code === 'PRESENTACION-EVIDENCIA'),
  oldVersionLocked: oldDraftStatus.response.status === 409,
  latestVersionApproved: latestDraftStatus.response.ok && latestDraftStatus.payload.draft?.estado === 'aprobado',
  evidenceAttached: evidence.response.ok && evidence.payload.filing?.numeroJustificante === '3032026QA',
  evidenceConflictBlocked: evidenceConflict.response.status === 409,
  draftVersionCreated: firstSave.response.ok && firstSave.payload.alreadySaved === false && firstSave.payload.draft?.version === 1,
  duplicateDraftAvoided: secondSave.response.ok && secondSave.payload.alreadySaved === true && secondSave.payload.draft?.id === firstSave.payload.draft?.id,
  savedDraftCanBeReopened: openedDraft.response.ok && openedDraft.payload.frozen === true && openedDraft.payload.draft?.id === 'draft-latest' && openedDraft.payload.calculation?.fields?.[0]?.code === 'DEDUCIBLE' && openedDraft.payload.adjustments?.previousCompensationBalance === 0,
  savedBoxHasSourceTrace: fieldTrace.response.ok && fieldTrace.payload.frozen === true && fieldTrace.payload.field?.code === 'DEDUCIBLE' && fieldTrace.payload.sources?.[0]?.invoiceId === 'invoice-trace' && fieldTrace.payload.sources?.[0]?.invoiceNumber === 'R-TRACE' && fieldTrace.payload.unresolvedCount === 0,
  savedDraftExportsFrozenSnapshot: frozenExport.response.ok && frozenExport.payload.frozen === true && frozenExport.payload.draft?.id === 'draft-latest' && frozenExport.payload.calculation?.result === 12 && frozenExport.payload.file?.contentBase64?.length > 0,
  recommendationsDoNotBlockExport: advisoryCalculation.response.ok
    && advisoryCalculation.payload.validation?.recommendations?.length > 0
    && advisoryCalculation.payload.validation?.blockers?.length === 0
    && advisoryCalculation.payload.validation?.canExport === true
    && advisoryExport.response.ok
    && advisoryExport.payload.file?.contentBase64?.length > 0,
};
const diagnostics = { frozenExport: { status: frozenExport.response.status, error: frozenExport.payload?.error, blockers: frozenExport.payload?.blockers, frozen: frozenExport.payload?.frozen, draftId: frozenExport.payload?.draft?.id, result: frozenExport.payload?.calculation?.result, fileLength: frozenExport.payload?.file?.contentBase64?.length || 0 } };
const output = { ...selfTest.payload, workflowChecks, diagnostics, ok: selfTest.response.ok && selfTest.payload.ok && Object.values(workflowChecks).every(Boolean) };
console.log(JSON.stringify(output, null, 2));
if (!output.ok) process.exitCode = 1;

