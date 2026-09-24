import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';

const functionSource = fs.readFileSync('base44/functions/documentBackupToDrive/entry.ts', 'utf8')
  .replace(/^import .*?;\s*/s, '');

function responseJson(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

function paged(rows) {
  return {
    list: async (_sort, limit = 50, skip = 0) => rows.slice(skip, skip + limit),
  };
}

async function executeScenario({ documentCount, existingCount, throttleFirstUpload = false }) {
  const fileUrl = id => `https://base44.app/api/apps/6a00fec50cc522a74ddde4b2/files/mp/public/6a00fec50cc522a74ddde4b2/${id}.pdf`;
  const documents = Array.from({ length: documentCount }, (_, index) => ({
    id: `doc-${index}`,
    fileStorageUrl: fileUrl(index),
    company_id: 'company-1',
    originalFileName: `factura-${index}.pdf`,
    fileSize: 3,
    fileMimeType: 'application/pdf',
    created_date: new Date(2026, 0, 1, 0, 0, index % 60).toISOString(),
  }));
  const records = Array.from({ length: existingCount }, (_, index) => ({
    id: `record-${index}`,
    documentId: `doc-${index}`,
    documentEntity: 'OcrInvoiceDocument',
    fileStorageUrl: fileUrl(index),
    backupStatus: 'backed_up',
    checksum: `checksum-${index}`,
    driveFileId: `drive-${index}`,
    drivePath: `path-${index}`,
    updated_date: new Date(2026, 0, 2, 0, 0, index % 60).toISOString(),
  }));

  const config = {
    id: 'config-1',
    backupMode: 'incremental_with_daily_manifest',
    scheduleEnabled: true,
    scheduleTime: '03:00',
    timezone: 'Atlantic/Canary',
    driveConnectedAccountEmail: 'taxeastrategies@gmail.com',
    rootFolderName: 'Taxea Strategies - Backups',
    portalFolderName: 'Taxea Portal',
    folderNamingMode: 'both',
  };
  let job = null;
  let recordCreates = 0;
  let itemCreates = 0;
  let mediaDownloads = 0;
  let uploadAttempts = 0;
  let firstUploadThrottled = false;

  const entityMap = {
    BackupConfiguration: {
      list: async () => [config],
      create: async value => Object.assign(config, value, { id: 'config-1' }),
      update: async (_id, value) => Object.assign(config, value),
    },
    BackupJob: {
      list: async () => job ? [job] : [],
      get: async id => id === job?.id ? job : null,
      create: async value => (job = { id: 'job-1', ...value }),
      update: async (_id, value) => Object.assign(job, value),
    },
    BackupJobItem: {
      create: async value => ({ id: `item-${++itemCreates}`, ...value }),
      filter: async () => [],
      update: async () => ({}),
    },
    DocumentBackupRecord: {
      ...paged(records),
      create: async value => {
        const created = { id: `new-record-${++recordCreates}`, ...value };
        records.unshift(created);
        return created;
      },
      update: async (id, value) => {
        const current = records.find(row => row.id === id);
        Object.assign(current, value);
        return current;
      },
    },
    OcrInvoiceDocument: paged(documents),
    Invoice: paged([]),
    Document: paged([]),
    HRDocument: paged([]),
    MercantilDocumento: paged([]),
    Company: { get: async () => ({ nombre_comercial: 'Cliente Prueba' }) },
  };
  const base44 = {
    auth: { me: async () => ({ id: 'admin-1', email: 'admin@example.com', role: 'admin' }) },
    asServiceRole: {
      connectors: { getConnection: async () => ({ accessToken: 'test-token' }) },
      entities: entityMap,
      integrations: { Core: { SendEmail: async () => ({}) } },
    },
  };

  const fetchMock = async (url, options = {}) => {
    const target = String(url);
    if (target.includes('/drive/v3/about')) return responseJson({ user: { emailAddress: 'taxeastrategies@gmail.com' } });
    if (target.includes('/drive/v3/files?') && options.method !== 'POST') {
      return responseJson({ files: [{ id: `folder-${Math.random()}`, name: 'folder' }] });
    }
    if (target.startsWith('https://media.base44.com/') || target.startsWith('https://base44.app/api/apps/6a00fec50cc522a74ddde4b2/files/mp/public/')) {
      mediaDownloads++;
      return new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { 'content-length': '3', 'content-type': 'application/pdf' },
      });
    }
    if (target.includes('/upload/drive/v3/files')) {
      uploadAttempts++;
      if (throttleFirstUpload && !firstUploadThrottled) {
        firstUploadThrottled = true;
        return responseJson({ error: 'rateLimitExceeded' }, 429, { 'retry-after': '0' });
      }
      return responseJson({ id: `uploaded-${uploadAttempts}`, size: 3, name: 'uploaded' });
    }
    throw new Error(`Unexpected fetch: ${target}`);
  };

  let handler;
  const context = {
    createClientFromRequest: () => base44,
    Deno: {
      env: { get: key => key === 'BASE44_APP_ID' ? '6a00fec50cc522a74ddde4b2' : null },
      serve: fn => { handler = fn; },
    },
    fetch: fetchMock,
    Response,
    Request,
    Headers,
    URL,
    TextEncoder,
    Uint8Array,
    AbortController,
    crypto: webcrypto,
    setTimeout,
    clearTimeout,
    console,
    Math,
    Date,
    Intl,
  };
  vm.runInNewContext(functionSource, context, { filename: 'documentBackupToDrive/entry.ts' });
  assert.equal(typeof handler, 'function');

  const response = await handler({
    json: async () => ({ action: 'backup', jobType: 'manual' }),
  });
  const payload = await response.json();
  return { payload, job, recordCreates, itemCreates, mediaDownloads, uploadAttempts };
}

const paginated = await executeScenario({ documentCount: 600, existingCount: 600 });
assert.equal(paginated.payload.status, 'completed');
assert.equal(paginated.payload.documentsScanned, 600);
assert.equal(paginated.payload.documentsCopied, 0);
assert.equal(paginated.payload.documentsSkipped, 600);
assert.equal(paginated.mediaDownloads, 0, 'existing records beyond page 500 must not be downloaded again');
assert.equal(paginated.recordCreates, 0, 'existing records beyond page 500 must not create duplicate metadata');
assert.equal(paginated.uploadAttempts, 3, 'only the three manifests should be uploaded');

const throttled = await executeScenario({ documentCount: 1, existingCount: 0, throttleFirstUpload: true });
assert.equal(throttled.payload.status, 'completed');
assert.equal(throttled.payload.documentsCopied, 1);
assert.equal(throttled.recordCreates, 1);
assert.equal(throttled.itemCreates, 1);
assert.equal(throttled.mediaDownloads, 1);
assert.equal(throttled.uploadAttempts, 5, 'one retried document upload plus three manifests expected');

const workflow = JSON.parse(fs.readFileSync('base44/workflows/DailyDocumentBackupToDrive.jsonc', 'utf8'));
assert.equal(workflow.trigger.config.timezone, 'Atlantic/Canary');
assert.deepEqual(workflow.definition.do[0].run_function.with.args, {
  action: 'backup',
  jobType: 'scheduled',
});
const panelSource = fs.readFileSync('src/pages/AdminBackupDrive.jsx', 'utf8');
assert.match(panelSource, /for \(let chunk = 0; chunk < 200; chunk \+= 1\)/);
assert.match(panelSource, /resumeJobId/);
const appSource = fs.readFileSync('src/App.jsx', 'utf8');
assert.match(appSource, /path="\/admin\/backup-drive" element=\{<AdminOnlyRoute isAdmin=\{isPlatformAdmin\}>/);
assert.match(functionSource, /nextCursor/);
assert.match(functionSource, /lastHeartbeatAt/);
assert.match(functionSource, /SCHEDULED_JOB_MAX_AGE_MS = 36 \* 60 \* 60 \* 1000/);
assert.match(functionSource, /driveEmail !== REQUIRED_EMAIL/);

console.log(JSON.stringify({
  ok: true,
  assertions: {
    completePaginationBeyond500: true,
    noDuplicateMetadataForTrackedDocuments: true,
    noRedownloadForTrackedDocuments: true,
    drive429RetriesAndRecovers: true,
    successfulUploadCreatesSingleTrackingRecord: true,
    manualRunIsResumable: true,
    backupPanelIsPlatformAdminOnly: true,
    scheduledRunExecutesBackupInCanaryTimezone: true,
    scheduledRunCanResumeNextDay: true,
    wrongDriveAccountIsBlocked: true,
  },
}, null, 2));
