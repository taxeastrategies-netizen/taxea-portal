import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createHash, webcrypto } from 'node:crypto';
import * as esbuild from 'esbuild';

const entry = path.resolve('base44/functions/taxModelOperations/entry.ts');
const originalSource = fs.readFileSync(entry, 'utf8');
const fixtureCaptureNeedle = 'const ok=checks.every';
const fixtureCapture = `
      const qaCompany={...company,nif_cif:'B12345674',razon_social:'ENTIDAD PRUEBA TAXEA'};
      const qa202Calculation=calculate202({company:{...qaCompany,cnae:'6920'},warnings:[],blockers:[]},bounds(2026,'1P'),{method:'40_3',cnae:'6920',fiscalPeriodStart:'2026-01-01',corporateTaxRateText:'25',currentTaxableBase:10000,paymentPercentage:17,withholdings:100,previousInstalmentPayments:200,commonTerritoryPercentage:100});
      globalThis.__taxeaFixtureMatrix={
        '111':wrap('111',2026,'1T',export111(qaCompany,2026,'1T',standard),'12345678Z'),
        '115':wrap('115',2026,'1T',export115(qaCompany,2026,'1T',standard),'12345678Z'),
        '123':wrap('123',2026,'1T',export123(qaCompany,2026,'1T',standard),'12345678Z'),
        '130':wrap('130',2026,'1T',export130(qaCompany,2026,'1T',standard),'12345678Z'),
        '131':wrap('131',2026,'1T',export131(qaCompany,2026,'1T',sample131),'12345678Z'),
        '180':export180(qaCompany,2025,annual180,'1801234567890'),
        '190':export190(qaCompany,2025,annual190Full,'1901234567891'),
        '193':export193(qaCompany,2025,annual193Expense,'1931234567891'),
        '202':wrap('202',2026,'1P',export202(qaCompany,2026,'1P',qa202Calculation),'12345678Z'),
        '216':wrap('216',2026,'1T',export216(qaCompany,2026,'1T',standard),'12345678Z'),
        '296':export296(qaCompany,2025,info296,'2961234567890'),
        '303':wrap('303',2026,'1T',export303(qaCompany,profile,2026,'1T',standard),'12345678Z'),
        '347':export347(qaCompany,2025,thirdParties,'3471234567890'),
        '349':export349(qaCompany,2026,'1T',info349,'3491234567890'),
        '390':wrap('390',2025,'0A',export390(qaCompany,profile,[],2025,standard,[]),'12345678Z'),
        '415':export415Import(qaCompany,2025,thirdParties),
        '200':export200(qaCompany,2025,sample200,'12345678Z'),
        '232':export232(qaCompany,2025,sample232,'12345678Z'),
        '417-guided':exportAtcHandoff('417',qaCompany,2026,'01',result417,{blockers:[],warnings:[]},'qa-fixture'),
        '420-guided':exportAtcHandoff('420',qaCompany,2026,'1T',standard,{blockers:[],warnings:[]},'qa-fixture'),
        '421-guided':exportAtcHandoff('421',qaCompany,2026,'4T',result421,{blockers:[],warnings:[]},'qa-fixture'),
        '425-guided':exportAtcHandoff('425',qaCompany,2025,'Anual',standard,{blockers:[],warnings:[]},'qa-fixture'),
      };
      `;
let source = originalSource;
if (process.env.TAXEA_FIXTURE_MATRIX_DIR) {
  if (!source.includes(fixtureCaptureNeedle)) throw new Error('No se encontró el punto de captura de las muestras fiscales.');
  source = source.replace(fixtureCaptureNeedle, `${fixtureCapture}${fixtureCaptureNeedle}`);
}
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
  Company: [{ id: 'company-test', nif_cif: 'B12345674', razon_social: 'ENTIDAD PRUEBA TAXEA', owner_email: 'qa@taxea.test', usuarios_autorizados: [] }],
  FiscalProfile: [{ id: 'profile-1', company_id: 'company-test', active: true, profileStatus: 'validado_asesor', mainTerritory: 'peninsula_baleares', taxAuthority: 'aeat', indirectTaxDefault: 'iva' }],
  FiscalActivity: [],
  Invoice: [{ id: 'invoice-trace', company_id: 'company-test', numero_factura: 'R-TRACE', fecha_emision: '2026-01-10', proveedor_nombre: 'PROVEEDOR QA', proveedor_nif: 'B87654321', concepto: 'Servicio QA', base_imponible: 100, cuota_iva: 21, total_factura: 121, tipo: 'recibida', fiscal_review_status: 'validado' }],
  InvoiceTaxLine: [{ id: 'tax-line-trace', companyId: 'company-test', invoiceId: 'invoice-trace', lineNumber: 1, operationDate: '2026-01-10', taxKind: 'iva', rate: 21, base: 100, quota: 21, deductibleQuota: 21, operationType: 'subject_taxed', regime: 'general', reviewStatus: 'validado' }],
  InvoicePayment: [], AccountingPostingOperation: [], PayrollExtraction: [], Employee: [], JournalEntry: [], JournalEntryLine: [], TaxDeclarableRecord: [],
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
  async delete(id) {
    const index = records[name].findIndex(item => item.id === id);
    if (index < 0) throw new Error(`${name} ${id} no existe`);
    records[name].splice(index, 1);
    return { id };
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
  Deno: { serve(fn) { handler = fn; }, env: { get(name) { return name === 'TAXEA_DEVELOPER_NIF' ? '12345678Z' : ''; } } },
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
const model202Export = await invoke({ action: 'export', companyId: 'company-test', modeloCodigo: '202', ejercicio: 2026, periodo: '1P', adjustments: { method: '40_3', fiscalPeriodStart: '2026-01-01', cnae: '6920', corporateTaxRateText: '25', currentTaxableBase: 10000, paymentPercentage: 17, withholdings: 100, previousInstalmentPayments: 200, commonTerritoryPercentage: 100 } });
const model200Export = await invoke({ action: 'export', companyId: 'company-test', modeloCodigo: '200', ejercicio: 2025, periodo: 'Anual', adjustments: { cnae: '6920', fiscalPeriodStart: '2025-01-01', fiscalPeriodEnd: '2025-12-31', taxRate: 25, officialDataReviewed: true } });
const model232Record = await invoke({ action: 'upsert_declarable', companyId: 'company-test', modeloCodigo: '232', ejercicio: 2025, periodo: 'Anual', recordKey: 'M232:QA', reviewStatus: 'validado_asesor', payload: { category: 'related', relatedPartyTaxId: 'B87654321', relatedPartyName: 'ENTIDAD VINCULADA QA', entityTypeKey: 'J', countryOrProvinceCode: '38', relationType: 'A', operationType: '06', incomePayment: 'I', valuationMethod: '1A', amount: 4000, specialDataConfirmed: true } });
const model232Export = await invoke({ action: 'export', companyId: 'company-test', modeloCodigo: '232', ejercicio: 2025, periodo: 'Anual', adjustments: { cnae: '6920', fiscalPeriodStart: '2025-01-01', fiscalPeriodEnd: '2025-12-31', exerciseType: '1' } });
const openedDraft = await invoke({ action: 'open_draft', companyId: 'company-test', draftId: 'draft-latest' });
const fieldTrace = await invoke({ action: 'field_trace', companyId: 'company-test', modeloCodigo: '303', ejercicio: 2026, periodo: '1T', draftId: 'draft-latest', fieldCode: 'DEDUCIBLE', fieldLabel: 'Total cuota deducible', fieldSection: 'Deducciones', page: 1, pageSize: 25 });
const frozenExport = await invoke({ action: 'export', companyId: 'company-test', modeloCodigo: '303', ejercicio: 2026, periodo: '1T', draftId: 'draft-latest' });
const exactDownload = await invoke({ action: 'download_official_file', companyId: 'company-test', fileId: frozenExport.payload.file?.id });
const catalog = await invoke({ action: 'catalog' });
const historicalDryRun = await invoke({ action: 'historical_fiscal_dry_run', companyId: 'company-test', ejercicio: 2026 });
const periodClosePreview = await invoke({ action: 'preview_period_close', companyId: 'company-test', modeloCodigo: '303', ejercicio: 2026, periodo: '1T' });
const periodClose = await invoke({ action: 'close_period', companyId: 'company-test', modeloCodigo: '303', ejercicio: 2026, periodo: '1T', confirmClose: true });
const periodReopen = await invoke({ action: 'reopen_period', companyId: 'company-test', modeloCodigo: '303', ejercicio: 2026, periodo: '1T', confirmReopen: true, reason: 'Nueva documentación recibida' });
const declarableSave = await invoke({ action: 'upsert_declarable', companyId: 'company-test', modeloCodigo: '216', ejercicio: 2026, periodo: '1T', recordKey: 'QA-NR-1', payload: { recipientTaxId: 'X1234567L', recipientName: 'PERCEPTOR QA', country: 'FR', incomeKey: '02', accruedAmount: 1000, withholdingBase: 1000, withholdingAmount: 190, paymentDate: '2026-02-01' } });
const declarableDelete = await invoke({ action: 'delete_declarable', companyId: 'company-test', modeloCodigo: '216', ejercicio: 2026, periodo: '1T', recordId: declarableSave.payload.record?.id });
records.TaxDeclarableRecord.push({ id: 'm296-parent', companyId: 'company-test', modeloCodigo: '296', ejercicio: 2025, recordKey: 'M296:PARENT', reviewStatus: 'validado_asesor', payload: { recipientTaxId: 'FR12345678901', foreignTaxId: 'FR12345678901', recipientName: 'MEDIADOR EXTRANJERO QA', country: 'FR', personalityKey: 'J', incomeKey: '01', subkey: '01', nature: 'D', paymentDate: '2025-06-30', accruedAmount: 1000, withholdingBase: 1000, withholdingRate: 19, withholdingAmount: 190, paymentRole: '2', mediatorCode: '2', issuerCodeType: '2', issuerCode: 'ES0000000001', recordOrder: '00000001' } });
records.TaxFiling.push({ id: 'filing-296', companyId: 'company-test', modeloCodigo: '296', ejercicio: 2025, periodo: 'Anual', estadoPresentacion: 'presentado', snapshotVersion: 1, tipoDeclaracion: 'original', numeroJustificante: '2961234567890', snapshotHash: 'filing-296-hash', fechaPresentacion: '2026-01-30' });
const annexAInput = { parentRecordOrder: '00000001', contributorPersonality: 'J', contributorLei: '529900T8BM49AURSDO55', contributorName: 'CONTRIBUYENTE QA', netPayment: 810, withholdingRate: 19, withholdingAmount: 190, address: '1 RUE QA', city: 'PARIS', postalCode: '75001', addressCountry: 'FR', model210Receipt: '2101234567890', foreignTaxId: 'FR-QA-001', residenceCountry: 'FR' };
const annexA = await invoke({ action: 'upsert_296_annex', companyId: 'company-test', modeloCodigo: '296', ejercicio: 2025, periodo: 'Anual', annexType: 'A', reviewStatus: 'validado_asesor', payload: annexAInput });
const annexADuplicate = await invoke({ action: 'upsert_296_annex', companyId: 'company-test', modeloCodigo: '296', ejercicio: 2025, periodo: 'Anual', annexType: 'A', reviewStatus: 'validado_asesor', payload: annexAInput });
const annexB = await invoke({ action: 'upsert_296_annex', companyId: 'company-test', modeloCodigo: '296', ejercicio: 2025, periodo: 'Anual', annexType: 'B', reviewStatus: 'validado_asesor', payload: { linkedAnnexARecordId: annexA.payload.record?.id, securitiesAccount: 'ACCOUNT-QA-1', accountHolderLei: '529900T8BM49AURSDO55', accountHolderName: 'CUSTODIO QA', totalSecurities: 100, contributorSecurities: 100, paymentDate: '2025-06-30', grossIncome: 1000, withholdingAmount: 190, withholdingRate: 19, model210PresentationDate: '2026-03-10' } });
const annexCalculation = await invoke({ action: 'calculate', companyId: 'company-test', modeloCodigo: '296', ejercicio: 2025, periodo: 'Anual' });
const annexExport = await invoke({ action: 'export_296_annexes', companyId: 'company-test', modeloCodigo: '296', ejercicio: 2025, periodo: 'Anual' });
const annexExportRepeat = await invoke({ action: 'export_296_annexes', companyId: 'company-test', modeloCodigo: '296', ejercicio: 2025, periodo: 'Anual' });
const annexContent = annexExport.payload.file?.contentBase64 ? Buffer.from(annexExport.payload.file.contentBase64, 'base64').toString('utf8') : '';
const annexRecords = annexContent.split(/\r?\n/).filter(Boolean);
testClient.auth.me = async () => ({ id: 'taxea-user-test', email: 'qa@taxea.test', role: 'user', company_id: 'company-test' });
const annexProtectedDelete = await invoke({ action: 'delete_declarable', companyId: 'company-test', modeloCodigo: '296', ejercicio: 2025, periodo: 'Anual', recordId: annexA.payload.record?.id });
const annexUserEdit = await invoke({ action: 'upsert_296_annex', companyId: 'company-test', modeloCodigo: '296', ejercicio: 2025, periodo: 'Anual', annexType: 'A', recordId: annexA.payload.record?.id, reviewStatus: 'validado_asesor', payload: annexAInput });
testClient.auth.me = async () => ({ id: 'taxea-self-test', email: 'qa@taxea.test', role: 'admin', company_id: 'company-test' });
const model202Content = model202Export.payload.file?.contentBase64 ? Buffer.from(model202Export.payload.file.contentBase64, 'base64').toString('utf8') : '';
const model202PageStart = model202Content.indexOf('<T20201000>');
const model200Content = model200Export.payload.file?.contentBase64 ? Buffer.from(model200Export.payload.file.contentBase64, 'base64').toString('utf8') : '';
const model232Content = model232Export.payload.file?.contentBase64 ? Buffer.from(model232Export.payload.file.contentBase64, 'base64').toString('utf8') : '';

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
  exactExportCanBeRedownloaded: exactDownload.response.ok
    && exactDownload.payload.file?.contentBase64 === frozenExport.payload.file?.contentBase64
    && exactDownload.payload.file?.hash === frozenExport.payload.file?.hash
    && exactDownload.payload.file?.immutable === true,
  fullCatalogAvailable: catalog.response.ok
    && catalog.payload.engineVersion === 'taxea-modelos-2026.09.20-v25'
    && catalog.payload.models?.length === 22
    && ['349', '131', '216', '296', '417', '421', '200', '202', '232'].every(model => catalog.payload.models.some(item => item.code === model)),
  historicalAuditIsReadOnly: historicalDryRun.response.ok
    && historicalDryRun.payload.dryRun === true
    && historicalDryRun.payload.writeOperations === 0
    && historicalDryRun.payload.stats?.invoices === 1,
  periodClosePreviewed: periodClosePreview.response.ok
    && periodClosePreview.payload.canClose === true
    && periodClosePreview.payload.latestDraft?.id === 'draft-latest',
  periodClosedWithoutPresentationSideEffect: periodClose.response.ok
    && periodClose.payload.period?.closureStatus === 'closed'
    && periodClose.payload.period?.closureDraftId === 'draft-latest',
  periodReopenedWithAuditTrail: periodReopen.response.ok
    && periodReopen.payload.period?.closureStatus === 'reopened'
    && periodReopen.payload.period?.reopenReason === 'Nueva documentación recibida',
  declarableCrudWorks: declarableSave.response.ok
    && declarableSave.payload.record?.modeloCodigo === '216'
    && declarableDelete.response.ok
    && declarableDelete.payload.deletedId === declarableSave.payload.record?.id
    && records.TaxDeclarableRecord.every(item => item.modeloCodigo !== '216'),
  recommendationsDoNotBlockExport: advisoryCalculation.response.ok
    && advisoryCalculation.payload.validation?.recommendations?.length > 0
    && advisoryCalculation.payload.validation?.blockers?.length === 0
    && advisoryCalculation.payload.validation?.canExport === true
    && advisoryExport.response.ok
    && advisoryExport.payload.file?.contentBase64?.length > 0,
  model202OfficialExport: model202Export.response.ok
    && model202Export.payload.definition?.officialExport === true
    && model202Export.payload.definition?.exportMode === 'aeat_official_record'
    && model202Export.payload.calculation?.result === 1400
    && model202Export.payload.file?.extension === '202'
    && model202Export.payload.file?.filename === 'B1234567420261P.202'
    && model202Content.length === 1946
    && model202Content.startsWith('<T202020261P0000>')
    && model202Content.includes('<T20201000>')
    && model202Content.includes('<T20202000>')
    && model202PageStart >= 0
    && model202Content.slice(model202PageStart + 131, model202PageStart + 146).trim() === '25'
    && model202Content.endsWith('</T202020261P0000>'),
  model200OfficialExport: model200Export.response.ok
    && model200Export.payload.definition?.officialExport === true
    && model200Export.payload.definition?.exportMode === 'aeat_official_record'
    && model200Export.payload.file?.filename === 'B1234567420250A.200'
    && model200Content.startsWith('<T200020250A0000><AUX>')
    && model200Content.includes('<T20001000>')
    && model200Content.includes('<T20014000>')
    && model200Content.includes('<T200DID00>')
    && model200Content.endsWith('</T200020250A0000>'),
  model296AnnexABWorkflow: annexA.response.ok
    && annexADuplicate.response.ok
    && annexADuplicate.payload.reusedExisting === true
    && annexADuplicate.payload.record?.id === annexA.payload.record?.id
    && records.TaxDeclarableRecord.filter(record => record.payload?.annexType === 'A').length === 1
    && annexB.response.ok
    && annexCalculation.response.ok
    && annexCalculation.payload.calculation?.details?.length === 1
    && annexCalculation.payload.calculation?.annexes?.ready === true
    && annexExport.response.ok
    && annexExportRepeat.response.ok
    && annexExportRepeat.payload.alreadyGenerated === true
    && annexExportRepeat.payload.file?.id === annexExport.payload.file?.id
    && records.TaxOfficialFile.filter(file => file.modeloCodigo === '296').length === 1
    && annexRecords.length === 2
    && annexRecords.every(record => record.length === 500 && record.startsWith('2296'))
    && annexRecords[0][499] === 'A'
    && annexRecords[1][499] === 'B'
    && annexRecords[0].slice(76, 84) === annexRecords[1].slice(76, 84)
    && annexRecords[0].slice(416, 429) === annexRecords[1].slice(288, 301)
    && annexProtectedDelete.response.status === 403
    && annexUserEdit.response.ok
    && annexUserEdit.payload.record?.reviewStatus === 'pendiente_revision',
  model232OfficialExport: model232Record.response.ok
    && model232Export.response.ok
    && model232Export.payload.definition?.officialExport === true
    && model232Export.payload.definition?.exportMode === 'aeat_official_record'
    && model232Export.payload.file?.filename === 'B1234567420250A.232'
    && model232Content.startsWith('<T232020250A0000><AUX>')
    && model232Content.includes('<T23201000>')
    && model232Content.endsWith('</T232020250A0000>'),
};
const diagnostics = { frozenExport: { status: frozenExport.response.status, error: frozenExport.payload?.error, blockers: frozenExport.payload?.blockers, frozen: frozenExport.payload?.frozen, draftId: frozenExport.payload?.draft?.id, result: frozenExport.payload?.calculation?.result, fileLength: frozenExport.payload?.file?.contentBase64?.length || 0 } };
const output = { ...selfTest.payload, workflowChecks, diagnostics, ok: selfTest.response.ok && selfTest.payload.ok && Object.values(workflowChecks).every(Boolean) };
if (process.env.TAXEA_MODEL202_FIXTURE_PATH) {
  fs.writeFileSync(path.resolve(process.env.TAXEA_MODEL202_FIXTURE_PATH), model202Content, 'utf8');
}
if (process.env.TAXEA_FIXTURE_MATRIX_DIR) {
  const outputDirectory = path.resolve(process.env.TAXEA_FIXTURE_MATRIX_DIR);
  fs.mkdirSync(outputDirectory, { recursive: true });
  const filenames = {
    '111': 'B1234567420261T.111', '115': 'B1234567420261T.115', '123': 'B1234567420261T.123',
    '130': 'B1234567420261T.130', '131': 'B1234567420261T.131', '180': 'B1234567420250A.180',
    '190': 'B1234567420250A.190', '193': 'B1234567420250A.193', '202': 'B1234567420261P.202',
    '216': 'B1234567420261T.216', '296': 'B1234567420250A.296', '303': 'B1234567420261T.303',
    '347': 'B1234567420250A.347', '349': 'B1234567420261T.349', '390': 'B1234567420250A.390',
    '415': 'B1234567420250A_415_ATC.txt', '200': 'B1234567420250A.200',
    '232': 'B1234567420250A.232', '417-guided': 'B12345674202601_417_GUIADO.csv',
    '420-guided': 'B1234567420261T_420_GUIADO.csv', '421-guided': 'B1234567420264T_421_GUIADO.csv',
    '425-guided': 'B123456742025_425_GUIADO.csv',
  };
  const matrix = context.__taxeaFixtureMatrix || {};
  const manifest = [];
  for (const [model, content] of Object.entries(matrix)) {
    const filename = filenames[model];
    if (!filename || typeof content !== 'string' || !content.length) throw new Error(`Muestra no generada para ${model}.`);
    const target = path.join(outputDirectory, filename);
    fs.writeFileSync(target, content, 'utf8');
    manifest.push({ model, filename, bytes: Buffer.byteLength(content, 'utf8'), characters: content.length, sha256: createHash('sha256').update(content, 'utf8').digest('hex').toUpperCase() });
  }
  fs.writeFileSync(path.join(outputDirectory, 'manifest.json'), `${JSON.stringify({ generatedAt: new Date().toISOString(), synthetic: true, engineVersion: selfTest.payload.engineVersion, fixtures: manifest }, null, 2)}\n`, 'utf8');
}
console.log(JSON.stringify(output, null, 2));
if (!output.ok) process.exitCode = 1;

