import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const REQUIRED_EMAIL = 'taxeastrategies@gmail.com';
const BACKUP_APP_ID = '6a00fec50cc522a74ddde4b2';
const BACKUP_MEDIA_HOST = 'media.base44.com';
const BACKUP_FILE_PREFIX = `/files/public/${BACKUP_APP_ID}/`;
const MAX_BACKUP_FILE_BYTES = 50 * 1024 * 1024;
const BACKUP_DOWNLOAD_TIMEOUT_MS = 20_000;
const DRIVE_RETRY_ATTEMPTS = 4;
const MANUAL_TIME_BUDGET_MS = 40_000;
const SCHEDULED_TIME_BUDGET_MS = 210_000;
const BACKUP_BATCH_SIZE = 3;
const MANUAL_JOB_MAX_AGE_MS = 30 * 60 * 1000;
const SCHEDULED_JOB_MAX_AGE_MS = 36 * 60 * 60 * 1000;

// ── Helpers ──

function sanitizeName(name) {
  if (!name) return 'SinNombre';
  return String(name)
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 100);
}

function validateBackupFileUrl(value) {
  let url;
  try {
    url = new URL(String(value || ''));
  } catch {
    throw new Error('La URL del documento no es válida.');
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) {
    throw new Error('La URL del documento debe usar HTTPS sin credenciales ni puerto personalizado.');
  }
  if (url.hostname.toLowerCase() !== BACKUP_MEDIA_HOST || !url.pathname.startsWith(BACKUP_FILE_PREFIX)) {
    throw new Error('El documento no pertenece al almacenamiento autorizado de Taxea Portal.');
  }
  url.hash = '';
  return url.toString();
}

async function downloadBackupFile(value) {
  const fileUrl = validateBackupFileUrl(value);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), BACKUP_DOWNLOAD_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(fileUrl, { redirect: 'error', signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const declaredLength = Number(response.headers.get('content-length') || 0);
  if (declaredLength > MAX_BACKUP_FILE_BYTES) throw new Error('El documento supera el límite de 50 MB.');
  const arrayBuffer = await response.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_BACKUP_FILE_BYTES) throw new Error('El documento supera el límite de 50 MB.');
  return new Uint8Array(arrayBuffer);
}

function getCanaryDate() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Atlantic/Canary',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const y = parts.find(p => p.type === 'year').value;
  const m = parts.find(p => p.type === 'month').value;
  const d = parts.find(p => p.type === 'day').value;
  return { year: y, month: m, day: d, full: `${y}-${m}-${d}`, iso: now.toISOString() };
}

async function computeChecksum(arrayBuffer) {
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function guessMimeType(fileName, fallback) {
  if (fallback) return fallback;
  const ext = (fileName || '').split('.').pop()?.toLowerCase();
  const map = {
    pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    png: 'image/png', webp: 'image/webp', gif: 'image/gif',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    txt: 'text/plain', csv: 'text/csv', json: 'application/json',
  };
  return map[ext] || 'application/octet-stream';
}

function getSubfolder(entityName, record) {
  if (entityName === 'OcrInvoiceDocument') return record.documentType === 'income_invoice' ? 'ingresos' : 'gastos';
  if (entityName === 'Invoice') return record.tipo === 'emitida' ? 'ingresos' : 'gastos';
  if (entityName === 'Document') return 'otros';
  if (entityName === 'HRDocument') return 'rrhh';
  if (entityName === 'MercantilDocumento') return 'mercantil';
  return 'otros';
}

function getDisplayName(entityName, record) {
  if (entityName === 'OcrInvoiceDocument') return record.originalFileName || record.fileName || 'documento';
  if (entityName === 'Invoice') return `factura_${record.numero_factura || record.id}`.substring(0, 80);
  if (entityName === 'Document') return record.nombre || 'documento';
  if (entityName === 'HRDocument') return `${record.tipo || 'documento'}_${record.nombre || ''}`.substring(0, 80);
  if (entityName === 'MercantilDocumento') return record.nombre || 'documento';
  return 'documento';
}

// ── Google Drive API helpers ──

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function driveFetch(url, options = {}) {
  let lastResponse = null;
  let lastError = null;
  for (let attempt = 0; attempt < DRIVE_RETRY_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(url, options);
      lastResponse = response;
      if (response.status !== 429 && response.status < 500) return response;
      if (attempt === DRIVE_RETRY_ATTEMPTS - 1) return response;
      const retryAfter = Number(response.headers.get('retry-after') || 0);
      const delay = retryAfter > 0 ? retryAfter * 1000 : 400 * (2 ** attempt) + Math.floor(Math.random() * 200);
      await sleep(Math.min(delay, 5000));
    } catch (error) {
      lastError = error;
      if (attempt === DRIVE_RETRY_ATTEMPTS - 1) throw error;
      await sleep(400 * (2 ** attempt));
    }
  }
  if (lastResponse) return lastResponse;
  throw lastError || new Error('No se pudo contactar con Google Drive.');
}

async function driveGet(url, token) {
  return driveFetch(url, { headers: { Authorization: `Bearer ${token}` } });
}

async function getDriveUserEmail(token) {
  try {
    const res = await driveGet(`${DRIVE_API}/about?fields=user`, token);
    if (!res.ok) return null;
    const data = await res.json();
    return data.user?.emailAddress || null;
  } catch { return null; }
}

async function findOrCreateFolder(name, parentId, token) {
  const escaped = name.replace(/'/g, "\\'");
  let query = `name='${escaped}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  if (parentId) query += ` and '${parentId}' in parents`;
  const searchRes = await driveGet(`${DRIVE_API}/files?q=${encodeURIComponent(query)}&fields=files(id,name)`, token);
  if (!searchRes.ok) throw new Error(`No se pudo buscar la carpeta \"${name}\": ${searchRes.status}`);
  const found = await searchRes.json();
  if (found.files?.length > 0) return found.files[0];
  const body = { name, mimeType: 'application/vnd.google-apps.folder' };
  if (parentId) body.parents = [parentId];
  const createRes = await driveFetch(`${DRIVE_API}/files?fields=id,name`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!createRes.ok) throw new Error(`No se pudo crear carpeta "${name}": ${createRes.status}`);
  return await createRes.json();
}

// Folder cache to avoid redundant Drive API calls during backup
const folderCache = new Map();
async function findOrCreateFolderCached(name, parentId, token) {
  const key = `${parentId || 'root'}:${name}`;
  if (folderCache.has(key)) return folderCache.get(key);
  const promise = findOrCreateFolder(name, parentId, token);
  folderCache.set(key, promise);
  try {
    return await promise;
  } catch (e) {
    folderCache.delete(key);
    throw e;
  }
}

async function uploadFileToDrive(name, parentId, contentBytes, mimeType, token) {
  const boundary = 'taxea_backup_' + Math.random().toString(36).slice(2);
  const metadata = JSON.stringify({ name, parents: parentId ? [parentId] : [] });
  const encoder = new TextEncoder();
  const header = encoder.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
    `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`
  );
  const footer = encoder.encode(`\r\n--${boundary}--`);
  const fullBody = new Uint8Array(header.length + contentBytes.length + footer.length);
  fullBody.set(header, 0);
  fullBody.set(contentBytes, header.length);
  fullBody.set(footer, header.length + contentBytes.length);
  const res = await driveFetch(`${DRIVE_UPLOAD}/files?uploadType=multipart&fields=id,size,name`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
    body: fullBody,
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Drive upload failed (${res.status}): ${errText.substring(0, 200)}`);
  }
  return await res.json();
}

async function uploadTextFile(name, parentId, text, token) {
  return uploadFileToDrive(name, parentId, new TextEncoder().encode(text), 'text/plain', token);
}

async function verifyDriveFile(fileId, token) {
  const res = await driveGet(`${DRIVE_API}/files/${fileId}?fields=id,size,name`, token);
  return res.ok;
}

// ── Document sources ──

const DOC_SOURCES = [
  { entity: 'OcrInvoiceDocument', urlField: 'fileStorageUrl', companyField: 'company_id', mimeField: 'fileMimeType', sizeField: 'fileSize' },
  { entity: 'Invoice', urlField: 'archivo_url', companyField: 'company_id', mimeField: null, sizeField: null },
  { entity: 'Document', urlField: 'archivo_url', companyField: 'company_id', mimeField: null, sizeField: null },
  { entity: 'HRDocument', urlField: 'archivo_url', companyField: 'company_id', mimeField: null, sizeField: null },
  { entity: 'MercantilDocumento', urlField: 'fileUrl', companyField: 'sociedadId', mimeField: null, sizeField: null },
];

async function listAllEntity(entity, sort = '-created_date', maximum = 10000) {
  const rows = [];
  const pageSize = Math.min(500, maximum);
  for (let skip = 0; skip < maximum; skip += pageSize) {
    const page = await entity.list(sort, pageSize, skip);
    rows.push(...(page || []));
    if (!page || page.length < pageSize) break;
  }
  return rows.slice(0, maximum);
}

function latestBackupRecordMap(records) {
  const map = {};
  for (const record of records) {
    const key = `${record.documentEntity}:${record.documentId}`;
    const current = map[key];
    const recordTime = String(record.updated_date || record.lastBackedUpAt || record.created_date || '');
    const currentTime = String(current?.updated_date || current?.lastBackedUpAt || current?.created_date || '');
    if (!current || recordTime > currentTime) map[key] = record;
  }
  return map;
}

async function scanDocumentSource(base44, src) {
  const all = [];
  for (let skip = 0; skip < 10000; skip += 500) {
    // Oldest-first keeps cursor pagination stable when new documents arrive during a resumed run.
    const batch = await base44.asServiceRole.entities[src.entity].list('created_date', 500, skip);
    if (!batch?.length) break;
    for (const rec of batch) {
      const url = rec[src.urlField];
      if (!url || typeof url !== 'string' || url.trim() === '') continue;
      all.push({ record: rec, source: src });
    }
    if (batch.length < 500) break;
  }
  return all;
}

async function scanAllDocuments(base44) {
  const groups = await Promise.all(DOC_SOURCES.map(src => scanDocumentSource(base44, src)));
  return groups.flat();
}

async function getCompanyName(companyId, base44, cache) {
  if (!companyId) return 'SinEmpresa';
  if (cache[companyId]) return cache[companyId];
  try {
    const c = await base44.asServiceRole.entities.Company.get(companyId);
    const name = c?.nombre_comercial || c?.razon_social || 'SinNombre';
    cache[companyId] = name;
    return name;
  } catch {
    cache[companyId] = 'SinNombre';
    return 'SinNombre';
  }
}

function clientFolderName(companyId, companyName, mode) {
  const safeName = sanitizeName(companyName);
  const safeId = (companyId || 'unknown').substring(0, 8);
  if (mode === 'client_name') return safeName;
  if (mode === 'client_id') return safeId;
  return `${safeId} - ${safeName}`;
}

// ── Main handler ──

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const action = body.action || 'status';

    // El respaldo contiene documentación sensible: toda ejecución requiere una sesión administradora.
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 });
    if (user.role !== 'admin' && user.role !== 'super_admin') {
      return Response.json({ error: 'Forbidden — solo admin' }, { status: 403 });
    }
    const isManual = body.jobType !== 'scheduled';

    // Get Drive connection
    let accessToken;
    try {
      const conn = await base44.asServiceRole.connectors.getConnection('googledrive');
      accessToken = conn.accessToken;
    } catch (e) {
      return Response.json({ error: 'Google Drive no conectado', detail: e.message }, { status: 503 });
    }

    const driveEmail = await getDriveUserEmail(accessToken);
    if (action !== 'status' && driveEmail !== REQUIRED_EMAIL) {
      return Response.json({
        error: `La copia requiere Google Drive conectado como ${REQUIRED_EMAIL}.`,
        connectedEmail: driveEmail,
        requiredEmail: REQUIRED_EMAIL,
      }, { status: 409 });
    }

    // Load config
    let configs = await base44.asServiceRole.entities.BackupConfiguration.list();
    let config = configs?.[0];
    if (!config) {
      config = await base44.asServiceRole.entities.BackupConfiguration.create({
        backupMode: 'incremental_with_daily_manifest',
        scheduleEnabled: true,
        scheduleTime: '03:00',
        timezone: 'Atlantic/Canary',
        driveConnectedAccountEmail: driveEmail,
        retentionPolicy: 'indefinite_until_manual_policy',
        folderNamingMode: 'both',
        rootFolderName: 'Taxea Strategies - Backups',
        portalFolderName: 'Taxea Portal',
        lastBackupStatus: 'never',
      });
    }

    // ── STATUS action ──
    if (action === 'status') {
      const [recentJobs, allRecords] = await Promise.all([
        base44.asServiceRole.entities.BackupJob.list('-startedAt', 20),
        listAllEntity(base44.asServiceRole.entities.DocumentBackupRecord, '-updated_date', 10000),
      ]);
      const canonicalRecords = Object.values(latestBackupRecordMap(allRecords));
      return Response.json({
        connected: !!driveEmail,
        connectedEmail: driveEmail,
        isCorrectAccount: driveEmail === REQUIRED_EMAIL,
        requiredEmail: REQUIRED_EMAIL,
        config,
        recentJobs: recentJobs || [],
        pendingCount: canonicalRecords.filter(record => record.backupStatus === 'pending').length,
        failedCount: canonicalRecords.filter(record => record.backupStatus === 'failed').length,
        trackedDocuments: canonicalRecords.length,
        metadataDuplicateCount: Math.max(0, allRecords.length - canonicalRecords.length),
      });
    }

    // ── VERIFY action ──
    if (action === 'verify') {
      const recentCompleted = await base44.asServiceRole.entities.BackupJob.list('-startedAt', 50);
      const lastJob = recentCompleted?.find(item => ['completed', 'completed_with_errors'].includes(item.status) && item.manifestDriveFileId);
      if (!lastJob) return Response.json({ error: 'No hay copias finalizadas para verificar' }, { status: 404 });

      const items = await base44.asServiceRole.entities.BackupJobItem.filter({ backupJobId: lastJob.id });
      let verified = 0, missing = 0;
      const missingItems = [];
      for (const item of items) {
        if (!item.driveFileId) continue;
        const exists = await verifyDriveFile(item.driveFileId, accessToken);
        if (exists) {
          verified++;
          await base44.asServiceRole.entities.BackupJobItem.update(item.id, { status: 'verified' });
        } else {
          missing++;
          missingItems.push({ documentId: item.documentId, name: item.clientName });
        }
      }
      if (lastJob.manifestDriveFileId) {
        const manifestOk = await verifyDriveFile(lastJob.manifestDriveFileId, accessToken);
        if (!manifestOk) missing++;
      }
      return Response.json({ jobId: lastJob.id, verified, missing, missingItems, status: missing === 0 ? 'ok' : 'incidents' });
    }

    // ── BACKUP action ──
    const now = getCanaryDate();
    const requestedJobId = String(body.resumeJobId || '').trim();
    let job = requestedJobId ? await base44.asServiceRole.entities.BackupJob.get(requestedJobId).catch(() => null) : null;
    const requestedJobType = isManual ? 'manual' : 'scheduled';
    if (job && (!['preparing', 'copying'].includes(job.status) || job.jobType !== requestedJobType)) job = null;
    if (!job) {
      const recentJobs = await base44.asServiceRole.entities.BackupJob.list('-startedAt', 50);
      const nowMs = Date.now();
      const maxJobAge = item => item.jobType === 'scheduled' ? SCHEDULED_JOB_MAX_AGE_MS : MANUAL_JOB_MAX_AGE_MS;
      job = recentJobs?.find(item =>
        item.jobType === requestedJobType &&
        ['preparing', 'copying'].includes(item.status) &&
        nowMs - new Date(item.lastHeartbeatAt || item.startedAt || 0).getTime() < maxJobAge(item)
      ) || null;
      for (const stale of recentJobs || []) {
        if (!['preparing', 'copying'].includes(stale.status)) continue;
        if (nowMs - new Date(stale.lastHeartbeatAt || stale.startedAt || 0).getTime() < maxJobAge(stale)) continue;
        await base44.asServiceRole.entities.BackupJob.update(stale.id, {
          status: 'failed', completedAt: new Date().toISOString(), internalErrorCode: 'STALE_INTERRUPTED',
          safeErrorMessage: 'Ejecución interrumpida; puede iniciarse una nueva copia sin duplicar documentos.',
        }).catch(() => {});
      }
    }
    if (!job) {
      job = await base44.asServiceRole.entities.BackupJob.create({
        jobType: isManual ? 'manual' : 'scheduled',
        status: 'preparing',
        startedAt: new Date().toISOString(),
        lastHeartbeatAt: new Date().toISOString(),
        triggeredByUserId: user?.id || null,
        triggeredByEmail: user?.email || 'sistema',
        driveAccountEmail: driveEmail,
        backupMode: config.backupMode,
        nextCursor: 0,
        runVersion: 'resumable-v2',
        documentsScanned: 0, documentsCopied: 0, documentsSkipped: 0, documentsFailed: 0, bytesCopied: 0,
      });
    }

    try {
      // Update config with connected email
      if (driveEmail && config.driveConnectedAccountEmail !== driveEmail) {
        config = await base44.asServiceRole.entities.BackupConfiguration.update(config.id, { driveConnectedAccountEmail: driveEmail });
      }

      // Ensure folder structure
      const rootFolder = await findOrCreateFolder(config.rootFolderName || 'Taxea Strategies - Backups', null, accessToken);
      const portalFolder = await findOrCreateFolder(config.portalFolderName || 'Taxea Portal', rootFolder.id, accessToken);
      const yearFolder = await findOrCreateFolder(now.year, portalFolder.id, accessToken);
      const monthFolder = await findOrCreateFolder(now.month, yearFolder.id, accessToken);
      const dayFolder = job.driveBackupFolderId
        ? { id: job.driveBackupFolderId, name: now.full }
        : await findOrCreateFolder(now.full, monthFolder.id, accessToken);

      await base44.asServiceRole.entities.BackupJob.update(job.id, {
        status: 'copying',
        lastHeartbeatAt: new Date().toISOString(),
        driveRootFolderId: rootFolder.id,
        driveBackupFolderId: dayFolder.id,
        driveBackupFolderPath: `${config.rootFolderName}/${config.portalFolderName}/${now.year}/${now.month}/${now.full}`,
      });
      await base44.asServiceRole.entities.BackupConfiguration.update(config.id, { lastBackupStatus: 'running' });

      // Load the complete history and keep one canonical record per source document.
      const existingRecords = await listAllEntity(base44.asServiceRole.entities.DocumentBackupRecord, '-updated_date', 10000);
      const recordMap = latestBackupRecordMap(existingRecords);

      const companyCache = {};
      const isFullCopy = config.backupMode === 'full_daily_copy';
      let copied = Number(job.documentsCopied || 0);
      let skipped = Number(job.documentsSkipped || 0);
      let failed = Number(job.documentsFailed || 0);
      let bytesCopied = Number(job.bytesCopied || 0);
      const failedItems = [];

      // Scan all documents
      const documents = await scanAllDocuments(base44);
      const startCursor = Math.min(Math.max(0, Number(job.nextCursor || 0)), documents.length);
      await base44.asServiceRole.entities.BackupJob.update(job.id, {
        documentsScanned: documents.length,
        lastHeartbeatAt: new Date().toISOString(),
      });

      // Per-document processing (extracted for parallel batching)
      const processDoc = async ({ record, source }) => {
        const fileUrl = record[source.urlField];
        const docId = record.id;
        const key = `${source.entity}:${docId}`;
        const existing = recordMap[key];
        const sourceUnchanged = !existing?.fileStorageUrl || existing.fileStorageUrl === fileUrl;
        const skipExisting = !isFullCopy && existing && ['backed_up', 'verified'].includes(existing.backupStatus) && sourceUnchanged;

        const companyName = await getCompanyName(record[source.companyField], base44, companyCache);
        const subfolder = getSubfolder(source.entity, record);
        const displayName = getDisplayName(source.entity, record);
        const safeFileName = sanitizeName(displayName) || sanitizeName(fileUrl.split('/').pop() || 'documento');
        const mimeType = guessMimeType(displayName, source.mimeField ? record[source.mimeField] : null);

        if (skipExisting) {
          return { type: 'skipped', manifest: {
            documentId: docId, documentEntity: source.entity,
            clientAccountId: record[source.companyField], clientName: companyName,
            type: source.entity, originalFileName: displayName,
            size: source.sizeField ? record[source.sizeField] : 0,
            mimeType, checksum: existing?.checksum || '',
            driveFileId: existing?.driveFileId || '', drivePath: existing?.drivePath || '',
            status: 'skipped_existing', lastVerifiedAt: existing?.lastVerifiedAt || '',
          }};
        }

        // Download file from storage
        let contentBytes;
        try {
          contentBytes = await downloadBackupFile(fileUrl);
        } catch (e) {
          await base44.asServiceRole.entities.BackupJobItem.create({
            backupJobId: job.id, documentId: docId, documentEntity: source.entity,
            clientAccountId: record[source.companyField], clientName: companyName,
            status: 'failed', action: 'fail', safeErrorMessage: `download: ${e.message}`, attempts: 1,
          });
          if (existing) {
            await base44.asServiceRole.entities.DocumentBackupRecord.update(existing.id, { backupStatus: 'failed', safeErrorMessage: `download: ${e.message}` });
          }
          return { type: 'failed', docId, error: `download: ${e.message}` };
        }

        const checksum = await computeChecksum(contentBytes);
        const fileSize = contentBytes.length;

        // If the URL changed but the bytes did not, refresh metadata without creating another Drive copy.
        if (!isFullCopy && existing && ['backed_up', 'verified'].includes(existing.backupStatus) && existing.checksum === checksum) {
          const nowIso = new Date().toISOString();
          const refreshed = await base44.asServiceRole.entities.DocumentBackupRecord.update(existing.id, {
            backupStatus: 'backed_up', originalFileName: displayName, fileStorageUrl: fileUrl,
            fileSize, mimeType, lastVerifiedAt: nowIso, safeErrorMessage: '',
          });
          recordMap[key] = { ...existing, ...refreshed, fileStorageUrl: fileUrl, lastVerifiedAt: nowIso };
          return { type: 'skipped', manifest: {
            documentId: docId, documentEntity: source.entity,
            clientAccountId: record[source.companyField], clientName: companyName,
            type: source.entity, originalFileName: displayName, size: fileSize,
            mimeType, checksum, driveFileId: existing.driveFileId, drivePath: existing.drivePath,
            status: 'skipped_unchanged', lastVerifiedAt: nowIso,
          }};
        }

        // Folder creation and upload are one recoverable operation. Drive throttling is retried by driveFetch.
        try {
          const cFolderName = clientFolderName(record[source.companyField], companyName, config.folderNamingMode);
          const clientFolder = await findOrCreateFolderCached(cFolderName, dayFolder.id, accessToken);
          const subFolder = await findOrCreateFolderCached(subfolder, clientFolder.id, accessToken);
          const drivePath = `${now.full}/${cFolderName}/${subfolder}/${safeFileName}`;
          const uploaded = await uploadFileToDrive(safeFileName, subFolder.id, contentBytes, mimeType, accessToken);
          const nowIso = new Date().toISOString();
          let persisted;
          if (existing) {
            persisted = await base44.asServiceRole.entities.DocumentBackupRecord.update(existing.id, {
              backupStatus: 'backed_up', originalFileName: displayName, fileStorageUrl: fileUrl,
              driveFileId: uploaded.id, driveFolderId: subFolder.id,
              drivePath, checksum, fileSize, mimeType, lastBackedUpAt: nowIso, lastVerifiedAt: nowIso,
              version: (existing.version || 1) + 1, safeErrorMessage: '',
            });
          } else {
            persisted = await base44.asServiceRole.entities.DocumentBackupRecord.create({
              documentId: docId, documentEntity: source.entity,
              clientAccountId: record[source.companyField], clientName: companyName,
              documentType: source.entity, sourceModule: subfolder,
              originalFileName: displayName, fileStorageUrl: fileUrl,
              fileSize, mimeType, checksum,
              driveFileId: uploaded.id, driveFolderId: subFolder.id, drivePath,
              backupStatus: 'backed_up', lastBackedUpAt: nowIso, lastVerifiedAt: nowIso, version: 1,
            });
          }
          recordMap[key] = persisted;
          await base44.asServiceRole.entities.BackupJobItem.create({
            backupJobId: job.id, documentId: docId, documentEntity: source.entity,
            clientAccountId: record[source.companyField], clientName: companyName,
            status: 'copied', action: 'copy', driveFileId: uploaded.id, drivePath, checksum, fileSize,
          });
          return { type: 'copied', fileSize, manifest: {
            documentId: docId, documentEntity: source.entity,
            clientAccountId: record[source.companyField], clientName: companyName,
            type: source.entity, originalFileName: displayName, size: fileSize,
            mimeType, checksum, driveFileId: uploaded.id, drivePath,
            status: 'copied', lastVerifiedAt: nowIso,
          }};
        } catch (e) {
          await base44.asServiceRole.entities.BackupJobItem.create({
            backupJobId: job.id, documentId: docId, documentEntity: source.entity,
            clientAccountId: record[source.companyField], clientName: companyName,
            status: 'failed', action: 'fail', safeErrorMessage: `upload: ${e.message}`, attempts: DRIVE_RETRY_ATTEMPTS,
          });
          if (existing) {
            const failedRecord = await base44.asServiceRole.entities.DocumentBackupRecord.update(existing.id, {
              backupStatus: 'failed', safeErrorMessage: `upload: ${e.message}`,
            });
            recordMap[key] = { ...existing, ...failedRecord, backupStatus: 'failed' };
          }
          return { type: 'failed', docId, error: `upload: ${e.message}` };
        }
      };

      // Process a bounded chunk and persist the cursor. Manual runs continue through short requests
      // instead of keeping one request open for four minutes.
      const invocationStartedAt = Date.now();
      const timeBudgetMs = isManual ? MANUAL_TIME_BUDGET_MS : SCHEDULED_TIME_BUDGET_MS;
      let nextCursor = startCursor;

      for (let i = startCursor; i < documents.length; i += BACKUP_BATCH_SIZE) {
        if (Date.now() - invocationStartedAt >= timeBudgetMs) break;
        const batch = documents.slice(i, i + BACKUP_BATCH_SIZE);
        const results = await Promise.allSettled(batch.map(doc => processDoc(doc)));
        for (const result of results) {
          if (result.status === 'fulfilled') {
            const item = result.value;
            if (item.type === 'copied') { copied++; bytesCopied += item.fileSize; }
            else if (item.type === 'skipped') skipped++;
            else if (item.type === 'failed') {
              failed++;
              failedItems.push({ documentId: item.docId, error: item.error });
            }
          } else {
            failed++;
            failedItems.push({ documentId: 'unknown', error: result.reason?.message || 'Error no identificado' });
          }
        }
        nextCursor = i + batch.length;
        await base44.asServiceRole.entities.BackupJob.update(job.id, {
          status: 'copying',
          documentsScanned: documents.length,
          documentsCopied: copied,
          documentsSkipped: skipped,
          documentsFailed: failed,
          bytesCopied,
          nextCursor,
          lastHeartbeatAt: new Date().toISOString(),
        });
      }

      if (nextCursor < documents.length) {
        return Response.json({
          status: 'copying',
          jobId: job.id,
          continueRequired: true,
          documentsScanned: documents.length,
          documentsProcessed: nextCursor,
          documentsRemaining: documents.length - nextCursor,
          documentsCopied: copied,
          documentsSkipped: skipped,
          documentsFailed: failed,
          bytesCopied,
          progressPercent: documents.length ? Math.round((nextCursor / documents.length) * 100) : 100,
          failedItems: failedItems.slice(0, 20),
        }, { status: 202 });
      }

      // Build the final manifest from the canonical records, not only from this invocation.
      const manifestEntries = [];
      for (const { record, source } of documents) {
        const backupRecord = recordMap[`${source.entity}:${record.id}`];
        const displayName = getDisplayName(source.entity, record);
        const companyName = await getCompanyName(record[source.companyField], base44, companyCache);
        const isBackedUp = ['backed_up', 'verified'].includes(backupRecord?.backupStatus);
        manifestEntries.push({
          documentId: record.id,
          documentEntity: source.entity,
          clientAccountId: record[source.companyField],
          clientName: companyName,
          type: source.entity,
          originalFileName: displayName,
          size: backupRecord?.fileSize || (source.sizeField ? record[source.sizeField] : 0) || 0,
          mimeType: backupRecord?.mimeType || guessMimeType(displayName, source.mimeField ? record[source.mimeField] : null),
          checksum: backupRecord?.checksum || '',
          driveFileId: backupRecord?.driveFileId || '',
          drivePath: backupRecord?.drivePath || '',
          status: isBackedUp ? 'backed_up' : (backupRecord?.backupStatus || 'missing'),
          lastVerifiedAt: backupRecord?.lastVerifiedAt || '',
        });
      }

      // ── Verification phase ──
      await base44.asServiceRole.entities.BackupJob.update(job.id, {
        status: 'verifying',
        nextCursor: documents.length,
        lastHeartbeatAt: new Date().toISOString(),
      });

      // ── Create manifests ──
      const manifestJson = JSON.stringify({
        backupDate: now.full,
        mode: config.backupMode,
        environment: Deno.env.get('BASE44_APP_ID') || 'taxea-portal',
        totalDocuments: documents.length,
        totalBytes: bytesCopied,
        newDocuments: copied,
        modifiedDocuments: 0,
        skippedDocuments: skipped,
        failedDocuments: failed,
        documents: manifestEntries,
      }, null, 2);

      const csvHeader = 'documentId,entity,clientAccountId,clientName,type,originalFileName,size,mimeType,checksum,driveFileId,drivePath,status,lastVerifiedAt';
      const csvRows = manifestEntries.map(e =>
        [e.documentId, e.documentEntity, e.clientAccountId, e.clientName, e.type, `"${(e.originalFileName || '').replace(/"/g, '""')}"`,
         e.size, e.mimeType, e.checksum, e.driveFileId, e.drivePath, e.status, e.lastVerifiedAt].join(',')
      );
      const manifestCsv = csvHeader + '\n' + csvRows.join('\n');

      const summary = [
        `BACKUP TAXEA PORTAL — ${now.full}`,
        `=====================================`,
        `Fecha: ${now.full}`,
        `Modo: ${config.backupMode}`,
        `Cuenta Drive: ${driveEmail}`,
        ``,
        `Documentos revisados: ${documents.length}`,
        `Documentos copiados: ${copied}`,
        `Documentos omitidos (ya respaldados): ${skipped}`,
        `Documentos con error: ${failed}`,
        `Tamaño total copiado: ${(bytesCopied / 1024 / 1024).toFixed(2)} MB`,
        ``,
        `Estado: ${failed === 0 ? 'Completada correctamente' : 'Completada con incidencias'}`,
        failed > 0 ? `\nIncidencias:\n${failedItems.map(f => `  - ${f.documentId}: ${f.error}`).join('\n')}` : '',
      ].join('\n');

      let manifestFileId = '', csvFileId = '', summaryFileId = '';
      const manifestErrors = [];
      try {
        const mj = await uploadTextFile('manifest.json', dayFolder.id, manifestJson, accessToken);
        manifestFileId = mj.id;
      } catch (error) {
        manifestErrors.push(`manifest.json: ${error.message}`);
      }
      try {
        const mc = await uploadTextFile('manifest.csv', dayFolder.id, manifestCsv, accessToken);
        csvFileId = mc.id;
      } catch (error) {
        manifestErrors.push(`manifest.csv: ${error.message}`);
      }
      try {
        const sf = await uploadTextFile('resumen_backup.txt', dayFolder.id, summary, accessToken);
        summaryFileId = sf.id;
      } catch (error) {
        manifestErrors.push(`resumen_backup.txt: ${error.message}`);
      }

      // ── Finalize job ──
      const completedAt = new Date().toISOString();
      const durationSeconds = Math.round((new Date(completedAt).getTime() - new Date(job.startedAt).getTime()) / 1000);
      const finalStatus = failed === 0 && manifestErrors.length === 0 ? 'completed' : 'completed_with_errors';
      const finalErrorMessage = [...failedItems.map(item => `${item.documentId}: ${item.error}`), ...manifestErrors]
        .join(' | ')
        .substring(0, 500);

      await base44.asServiceRole.entities.BackupJob.update(job.id, {
        status: finalStatus,
        completedAt, durationSeconds,
        lastHeartbeatAt: completedAt,
        nextCursor: documents.length,
        documentsScanned: documents.length, documentsCopied: copied,
        documentsSkipped: skipped, documentsFailed: failed,
        bytesCopied, manifestDriveFileId: manifestFileId,
        manifestCsvDriveFileId: csvFileId, summaryDriveFileId: summaryFileId,
        manifestChecksum: await computeChecksum(new TextEncoder().encode(manifestJson)),
        safeErrorMessage: finalErrorMessage,
      });

      await base44.asServiceRole.entities.BackupConfiguration.update(config.id, {
        lastSuccessfulBackupAt: finalStatus === 'completed' ? completedAt : config.lastSuccessfulBackupAt,
        lastBackupStatus: finalStatus === 'completed' ? 'success' : 'completed_with_errors',
        driveRootFolderId: rootFolder.id,
        driveRootFolderPath: `${config.rootFolderName}/${config.portalFolderName}`,
      });

      // ── Alert email on failures ──
      if (finalStatus !== 'completed') {
        const alertEmail = config.alertEmail || Deno.env.get('ENVIO_FACTURAS');
        if (alertEmail) {
          try {
            await base44.asServiceRole.integrations.Core.SendEmail({
              to: alertEmail,
              subject: `[Taxea Portal] Copia de seguridad con incidencias — ${now.full}`,
              body: `La copia de seguridad del ${now.full} terminó con incidencias.\n\nDocumentos revisados: ${documents.length}\nCopiados: ${copied}\nOmitidos: ${skipped}\nFallidos: ${failed}\nIncidencias de manifiesto: ${manifestErrors.length}\n\nRevisa el panel de administración para más detalles.`,
            });
          } catch {}
        }
      }

      return Response.json({
        status: finalStatus,
        jobId: job.id,
        continueRequired: false,
        progressPercent: 100,
        documentsScanned: documents.length,
        documentsCopied: copied,
        documentsSkipped: skipped,
        documentsFailed: failed,
        bytesCopied,
        durationSeconds,
        driveFolderPath: `${config.rootFolderName}/${config.portalFolderName}/${now.year}/${now.month}/${now.full}`,
        failedItems: failedItems.slice(0, 20),
        manifestErrors,
      });

    } catch (error) {
      const failAt = new Date().toISOString();
      await base44.asServiceRole.entities.BackupJob.update(job.id, {
        status: 'failed', completedAt: failAt, lastHeartbeatAt: failAt,
        durationSeconds: Math.max(0, Math.round((new Date(failAt).getTime() - new Date(job.startedAt || failAt).getTime()) / 1000)),
        safeErrorMessage: error.message?.substring(0, 500) || 'Error no identificado',
      });
      await base44.asServiceRole.entities.BackupConfiguration.update(config.id, { lastBackupStatus: 'failed' });
      return Response.json({ error: error.message, jobId: job.id }, { status: 500 });
    }

  } catch (error) {
    console.error('[documentBackupToDrive]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

