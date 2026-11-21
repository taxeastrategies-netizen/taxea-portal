export function memoizeCopyVerification(check) {
  const pending = new Map();
  return record => {
    const key = JSON.stringify([record.clientAccountId, record.driveFileId, record.checksum, record.fileSize]);
    if (!pending.has(key)) {
      const promise = Promise.resolve().then(() => check(record));
      pending.set(key, promise);
      promise.catch(() => pending.delete(key));
    }
    return pending.get(key);
  };
}

export async function preloadBackupRecords(entity, documents, recordMap, canonical) {
  const groups = new Map();
  for (const { source, record } of documents) {
    const key = source.entity + ':' + record.id;
    if (Object.hasOwn(recordMap, key)) continue;
    const companyId = record[source.companyField];
    const groupKey = JSON.stringify([source.entity, companyId]);
    if (!groups.has(groupKey)) groups.set(groupKey, { entity: source.entity, companyId, ids: [] });
    groups.get(groupKey).ids.push(record.id);
  }
  for (const group of groups.values()) {
    const rows = await entity.filter({
      documentEntity: group.entity, clientAccountId: group.companyId, documentId: { $in: group.ids },
    }, '-lastBackedUpAt', 501);
    if (!Array.isArray(rows) || rows.length >= 501) throw new Error('BACKUP_METADATA_LIMIT_REACHED');
    const scoped = rows.filter(row => row.documentEntity === group.entity && row.clientAccountId === group.companyId && group.ids.includes(row.documentId));
    const selected = canonical(scoped);
    for (const id of group.ids) recordMap[group.entity + ':' + id] = selected[group.entity + ':' + id] || null;
  }
}

export function createBackupContentReuse({ findCandidates, verifyCopy }) {
  const pending = new Map();
  return ({ companyId, checksum, fileSize, documentKey, upload }) => {
    const contentKey = JSON.stringify([companyId, checksum, fileSize]);
    if (!pending.has(contentKey)) {
      const promise = (async () => {
        const candidates = await findCandidates(companyId, checksum);
        for (const record of candidates) {
          if (record.clientAccountId === companyId && record.checksum === checksum
            && Number(record.fileSize) === fileSize && record.driveFileId
            && ['backed_up', 'verified'].includes(record.backupStatus) && await verifyCopy(record)) {
            return { storage: record, copiedBy: null };
          }
        }
        return { storage: await upload(), copiedBy: documentKey };
      })();
      pending.set(contentKey, promise);
      promise.catch(() => pending.delete(contentKey));
    }
    return pending.get(contentKey);
  };
}

