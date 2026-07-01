import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const REQUIRED_EMAIL = 'taxeastrategies@gmail.com';

// ── Helpers ──

function sanitizeName(name) {
  if (!name) return 'SinNombre';
  return String(name)
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 100);
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

async function driveGet(url, token) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  return res;
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
  if (searchRes.ok) {
    const found = await searchRes.json();
    if (found.files?.length > 0) return found.files[0];
  }
  const body = { name, mimeType: 'application/vnd.google-apps.folder' };
  if (parentId) body.parents = [parentId];
  const createRes = await fetch(`${DRIVE_API}/files?fields=id,name`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!createRes.ok) throw new Error(`No se pudo crear carpeta "${name}": ${createRes.status}`);
  return await createRes.json();
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
  const res = await fetch(`${DRIVE_UPLOAD}/files?uploadType=multipart&fields=id,size,name`, {
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

async function scanAllDocuments(base44) {
  const all = [];
  for (const src of DOC_SOURCES) {
    let skip = 0;
    while (true) {
      let batch;
      try {
        batch = await base44.asServiceRole.entities[src.entity].list('-created_date', 200, skip);
      } catch { break; }
      if (!batch || batch.length === 0) break;
      for (const rec of batch) {
        const url = rec[src.urlField];
        if (!url || typeof url !== 'string' || url.trim() === '') continue;
        all.push({ record: rec, source: src });
      }
      if (batch.length < 200) break;
      skip += 200;
    }
  }
  return all;
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

    // Auth: manual calls require admin; scheduled calls have no user
    let user = null;
    let isManual = false;
    try {
      user = await base44.auth.me();
      if (user) {
        if (user.role !== 'admin' && user.role !== 'super_admin') {
          return Response.json({ error: 'Forbidden — solo admin' }, { status: 403 });
        }
        isManual = true;
      }
    } catch { /* scheduled — no user */ }

    // Get Drive connection
    let accessToken;
    try {
      const conn = await base44.asServiceRole.connectors.getConnection('googledrive');
      accessToken = conn.accessToken;
    } catch (e) {
      return Response.json({ error: 'Google Drive no conectado', detail: e.message }, { status: 503 });
    }

    const driveEmail = await getDriveUserEmail(accessToken);

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
      const recentJobs = await base44.asServiceRole.entities.BackupJob.list('-startedAt', 20);
      const pendingRecords = await base44.asServiceRole.entities.DocumentBackupRecord.filter({ backupStatus: 'pending' });
      const failedRecords = await base44.asServiceRole.entities.DocumentBackupRecord.filter({ backupStatus: 'failed' });
      return Response.json({
        connected: !!driveEmail,
        connectedEmail: driveEmail,
        isCorrectAccount: driveEmail === REQUIRED_EMAIL,
        requiredEmail: REQUIRED_EMAIL,
        config,
        recentJobs: recentJobs || [],
        pendingCount: pendingRecords?.length || 0,
        failedCount: failedRecords?.length || 0,
      });
    }

    // ── VERIFY action ──
    if (action === 'verify') {
      const lastJob = (await base44.asServiceRole.entities.BackupJob.list('-startedAt', 1))?.[0];
      if (!lastJob) return Response.json({ error: 'No hay copias previas para verificar' }, { status: 404 });

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
    const job = await base44.asServiceRole.entities.BackupJob.create({
      jobType: isManual ? 'manual' : 'scheduled',
      status: 'preparing',
      startedAt: new Date().toISOString(),
      triggeredByUserId: user?.id || null,
      triggeredByEmail: user?.email || 'sistema',
      driveAccountEmail: driveEmail,
      backupMode: config.backupMode,
      documentsScanned: 0, documentsCopied: 0, documentsSkipped: 0, documentsFailed: 0, bytesCopied: 0,
    });

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
      const dayFolder = await findOrCreateFolder(now.full, monthFolder.id, accessToken);

      await base44.asServiceRole.entities.BackupJob.update(job.id, {
        status: 'copying',
        driveRootFolderId: rootFolder.id,
        driveBackupFolderId: dayFolder.id,
        driveBackupFolderPath: `${config.rootFolderName}/${config.portalFolderName}/${now.year}/${now.month}/${now.full}`,
      });

      // Load existing backup records
      const existingRecords = await base44.asServiceRole.entities.DocumentBackupRecord.list('-created_date', 500);
      const recordMap = {};
      for (const r of existingRecords) {
        recordMap[`${r.documentEntity}:${r.documentId}`] = r;
      }

      const companyCache = {};
      const isFullCopy = config.backupMode === 'full_daily_copy';
      const manifestEntries = [];
      let copied = 0, skipped = 0, failed = 0, bytesCopied = 0;
      const failedItems = [];

      // Scan all documents
      const documents = await scanAllDocuments(base44);
      await base44.asServiceRole.entities.BackupJob.update(job.id, { documentsScanned: documents.length });

      for (const { record, source } of documents) {
        const fileUrl = record[source.urlField];
        const docId = record.id;
        const key = `${source.entity}:${docId}`;
        const existing = recordMap[key];
        const skipExisting = !isFullCopy && existing && existing.backupStatus === 'backed_up';

        const companyName = await getCompanyName(record[source.companyField], base44, companyCache);
        const subfolder = getSubfolder(source.entity, record);
        const displayName = getDisplayName(source.entity, record);
        const safeFileName = sanitizeName(displayName) || sanitizeName(fileUrl.split('/').pop() || 'documento');
        const mimeType = guessMimeType(displayName, source.mimeField ? record[source.mimeField] : null);

        if (skipExisting) {
          skipped++;
          manifestEntries.push({
            documentId: docId, documentEntity: source.entity,
            clientAccountId: record[source.companyField], clientName: companyName,
            type: source.entity, originalFileName: displayName,
            size: source.sizeField ? record[source.sizeField] : 0,
            mimeType, checksum: existing?.checksum || '',
            driveFileId: existing?.driveFileId || '', drivePath: existing?.drivePath || '',
            status: 'skipped_existing', lastVerifiedAt: existing?.lastVerifiedAt || '',
          });
          continue;
        }

        // Download file from storage
        let contentBytes;
        try {
          const dlRes = await fetch(fileUrl);
          if (!dlRes.ok) throw new Error(`HTTP ${dlRes.status}`);
          contentBytes = new Uint8Array(await dlRes.arrayBuffer());
        } catch (e) {
          failed++;
          failedItems.push({ documentId: docId, error: `download: ${e.message}` });
          await base44.asServiceRole.entities.BackupJobItem.create({
            backupJobId: job.id, documentId: docId, documentEntity: source.entity,
            clientAccountId: record[source.companyField], clientName: companyName,
            status: 'failed', action: 'fail', safeErrorMessage: `download: ${e.message}`, attempts: 1,
          });
          if (existing) {
            await base44.asServiceRole.entities.DocumentBackupRecord.update(existing.id, { backupStatus: 'failed', safeErrorMessage: `download: ${e.message}` });
          }
          continue;
        }

        const checksum = await computeChecksum(contentBytes);
        const fileSize = contentBytes.length;

        // Check if content changed (checksum mismatch with existing)
        if (!isFullCopy && existing && existing.backupStatus === 'backed_up' && existing.checksum === checksum) {
          skipped++;
          manifestEntries.push({
            documentId: docId, documentEntity: source.entity,
            clientAccountId: record[source.companyField], clientName: companyName,
            type: source.entity, originalFileName: displayName, size: fileSize,
            mimeType, checksum, driveFileId: existing.driveFileId, drivePath: existing.drivePath,
            status: 'skipped_existing', lastVerifiedAt: existing.lastVerifiedAt || '',
          });
          continue;
        }

        // Create client folder + subfolder
        const cFolderName = clientFolderName(record[source.companyField], companyName, config.folderNamingMode);
        const clientFolder = await findOrCreateFolder(cFolderName, dayFolder.id, accessToken);
        const subFolder = await findOrCreateFolder(subfolder, clientFolder.id, accessToken);
        const drivePath = `${now.full}/${cFolderName}/${subfolder}/${safeFileName}`;

        // Upload to Drive
        try {
          const uploaded = await uploadFileToDrive(safeFileName, subFolder.id, contentBytes, mimeType, accessToken);
          copied++;
          bytesCopied += fileSize;

          const nowIso = new Date().toISOString();
          if (existing) {
            await base44.asServiceRole.entities.DocumentBackupRecord.update(existing.id, {
              backupStatus: 'backed_up', driveFileId: uploaded.id, driveFolderId: subFolder.id,
              drivePath, checksum, fileSize, mimeType, lastBackedUpAt: nowIso, lastVerifiedAt: nowIso,
              version: (existing.version || 1) + 1, safeErrorMessage: '',
            });
          } else {
            await base44.asServiceRole.entities.DocumentBackupRecord.create({
              documentId: docId, documentEntity: source.entity,
              clientAccountId: record[source.companyField], clientName: companyName,
              documentType: source.entity, sourceModule: subfolder,
              originalFileName: displayName, fileStorageUrl: fileUrl,
              fileSize, mimeType, checksum,
              driveFileId: uploaded.id, driveFolderId: subFolder.id, drivePath,
              backupStatus: 'backed_up', lastBackedUpAt: nowIso, lastVerifiedAt: nowIso, version: 1,
            });
          }
          await base44.asServiceRole.entities.BackupJobItem.create({
            backupJobId: job.id, documentId: docId, documentEntity: source.entity,
            clientAccountId: record[source.companyField], clientName: companyName,
            status: 'copied', action: 'copy', driveFileId: uploaded.id, drivePath, checksum, fileSize,
          });
          manifestEntries.push({
            documentId: docId, documentEntity: source.entity,
            clientAccountId: record[source.companyField], clientName: companyName,
            type: source.entity, originalFileName: displayName, size: fileSize,
            mimeType, checksum, driveFileId: uploaded.id, drivePath,
            status: 'copied', lastVerifiedAt: nowIso,
          });
        } catch (e) {
          failed++;
          failedItems.push({ documentId: docId, error: `upload: ${e.message}` });
          await base44.asServiceRole.entities.BackupJobItem.create({
            backupJobId: job.id, documentId: docId, documentEntity: source.entity,
            clientAccountId: record[source.companyField], clientName: companyName,
            status: 'failed', action: 'fail', safeErrorMessage: `upload: ${e.message}`, attempts: 1,
          });
          if (existing) {
            await base44.asServiceRole.entities.DocumentBackupRecord.update(existing.id, { backupStatus: 'failed', safeErrorMessage: `upload: ${e.message}` });
          }
        }
      }

      // ── Verification phase ──
      await base44.asServiceRole.entities.BackupJob.update(job.id, { status: 'verifying' });

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
      try {
        const mj = await uploadTextFile('manifest.json', dayFolder.id, manifestJson, accessToken);
        manifestFileId = mj.id;
      } catch {}
      try {
        const mc = await uploadTextFile('manifest.csv', dayFolder.id, manifestCsv, accessToken);
        csvFileId = mc.id;
      } catch {}
      try {
        const sf = await uploadTextFile('resumen_backup.txt', dayFolder.id, summary, accessToken);
        summaryFileId = sf.id;
      } catch {}

      // ── Finalize job ──
      const completedAt = new Date().toISOString();
      const durationSeconds = Math.round((new Date(completedAt).getTime() - new Date(job.startedAt).getTime()) / 1000);
      const finalStatus = failed === 0 ? 'completed' : 'completed_with_errors';

      await base44.asServiceRole.entities.BackupJob.update(job.id, {
        status: finalStatus,
        completedAt, durationSeconds,
        documentsScanned: documents.length, documentsCopied: copied,
        documentsSkipped: skipped, documentsFailed: failed,
        bytesCopied, manifestDriveFileId: manifestFileId,
        manifestCsvDriveFileId: csvFileId, summaryDriveFileId: summaryFileId,
        manifestChecksum: await computeChecksum(new TextEncoder().encode(manifestJson)),
      });

      await base44.asServiceRole.entities.BackupConfiguration.update(config.id, {
        lastSuccessfulBackupAt: finalStatus === 'completed' ? completedAt : config.lastSuccessfulBackupAt,
        lastBackupStatus: finalStatus === 'completed' ? 'success' : 'completed_with_errors',
        driveRootFolderId: rootFolder.id,
        driveRootFolderPath: `${config.rootFolderName}/${config.portalFolderName}`,
      });

      // ── Alert email on failures ──
      if (failed > 0) {
        const alertEmail = config.alertEmail || Deno.env.get('ENVIO_FACTURAS');
        if (alertEmail) {
          try {
            await base44.asServiceRole.integrations.Core.SendEmail({
              to: alertEmail,
              subject: `[Taxea Portal] Copia de seguridad con incidencias — ${now.full}`,
              body: `La copia de seguridad del ${now.full} se completó con ${failed} documento(s) con error de un total de ${documents.length} revisados.\n\nDocumentos copiados: ${copied}\nOmitidos: ${skipped}\nFallidos: ${failed}\n\nRevisa el panel de administración para más detalles.`,
            });
          } catch {}
        }
      }

      return Response.json({
        status: finalStatus,
        jobId: job.id,
        documentsScanned: documents.length,
        documentsCopied: copied,
        documentsSkipped: skipped,
        documentsFailed: failed,
        bytesCopied,
        durationSeconds,
        driveFolderPath: `${config.rootFolderName}/${config.portalFolderName}/${now.year}/${now.month}/${now.full}`,
        failedItems: failedItems.slice(0, 20),
      });

    } catch (error) {
      const failAt = new Date().toISOString();
      await base44.asServiceRole.entities.BackupJob.update(job.id, {
        status: 'failed', completedAt: failAt,
        safeErrorMessage: error.message?.substring(0, 500) || 'Unknown error',
      });
      await base44.asServiceRole.entities.BackupConfiguration.update(config.id, { lastBackupStatus: 'failed' });
      return Response.json({ error: error.message, jobId: job.id }, { status: 500 });
    }

  } catch (error) {
    console.error('[documentBackupToDrive]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});