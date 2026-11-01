import { allowedFeedUrl, readFeed, SOURCES } from './core.ts';
export type Source = keyof typeof SOURCES;
export type FeedPage = { rows: any[]; next: string | null; updated: string | null; examined: number };
export type CachedPage = FeedPage & { fetchedAt: string; cacheStored?: boolean };
const SOURCES_SET = new Set(Object.keys(SOURCES));
export const isSource = (value: unknown): value is Source => typeof value === 'string' && SOURCES_SET.has(value);
const CHUNK_SIZE = 7000;
async function packRows(rows: any[]): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(rows));
  const zipped = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
  let binary = '';
  for (let i = 0; i < zipped.length; i += 8192) binary += String.fromCharCode(...zipped.slice(i, i + 8192));
  return btoa(binary);
}
async function unpackRows(encoded: string): Promise<any[]> {
  if (encoded.length > CHUNK_SIZE * 20) throw new Error('Invalid tender cache size');
  const binary = atob(encoded), bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();
  const decoder = new TextDecoder(); let json = '', size = 0;
  try { while (true) { const item = await stream.read(); if (item.done) break; size += item.value.byteLength; if (size > 8_000_000) { await stream.cancel(); throw new Error('Invalid expanded cache size'); } json += decoder.decode(item.value, {stream:true}); } json += decoder.decode(); } finally { stream.releaseLock(); }
  const rows = JSON.parse(json);
  if (!Array.isArray(rows) || rows.length > 5000) throw new Error('Invalid tender cache');
  return rows;
}
async function decodeBatch(found: any[], batchId: string, source: Source): Promise<CachedPage | null> {
  const parts = found.filter(row => row.batchId === batchId).sort((a, b) => a.part - b.part), first = parts[0];
  if (!first || first.source !== source || first.payloadEncoding !== 'gzip-base64' || !Number.isInteger(first.totalParts) || first.totalParts < 1 || first.totalParts > 20 || parts.length !== first.totalParts || !Number.isFinite(Date.parse(first.fetchedAt)) || parts.some((part, i) => part.part !== i || part.source !== source || part.totalParts !== first.totalParts || part.fetchedAt !== first.fetchedAt || part.payloadEncoding !== first.payloadEncoding)) return null;
  try { return { rows: await unpackRows(parts.map(part => part.rowsJson).join('')), next: first.nextUrl ? allowedFeedUrl(source, first.nextUrl) : null, updated: first.sourceUpdated || null, examined: Number(first.examined) || 0, fetchedAt: first.fetchedAt, cacheStored: true }; } catch { return null; }
}
export async function getSnapshot(sdk: any, source: Source): Promise<CachedPage | null> {
  let found: any[];
  try { found = await sdk.asServiceRole.entities.TenderFeedSnapshot.filter({ source }, '-fetchedAt', 120); } catch { return null; }
  for (const batchId of [...new Set(found.map(row => row.batchId).filter(Boolean))]) { const page = await decodeBatch(found, batchId as string, source); if (page) return page; }
  return null;
}
async function concurrent<T>(items: T[], action: (item: T) => Promise<unknown>) {
  const results = []; for (let i = 0; i < items.length; i += 3) results.push(...await Promise.allSettled(items.slice(i, i + 3).map(action))); return results;
}
export async function refreshSnapshot(sdk: any, source: Source): Promise<CachedPage> {
  const feed = await readFeed(source, null, { force: true });
  const fetchedAt = feed.observedAt, batchId = crypto.randomUUID();
  const entity = sdk.asServiceRole.entities.TenderFeedSnapshot;
  try {
    const encoded = await packRows(feed.rows), chunks = encoded.match(new RegExp('.{1,' + CHUNK_SIZE + '}', 'g')) || [''];
    if (chunks.length > 20) throw new Error('Tender cache has too many parts');
    const created = await concurrent(chunks.map((rowsJson, part) => ({ source, fetchedAt, sourceUpdated: feed.updated || '', nextUrl: feed.next || '', examined: feed.examined, rowsJson, batchId, part, totalParts: chunks.length, payloadEncoding: 'gzip-base64' })), row => entity.create(row));
    // Read-back also resolves an ambiguous create acknowledgement; only the exact complete batch may succeed.
    const persisted = await entity.filter({ source, batchId }, 'part', 20);
    const verified = await decodeBatch(persisted, batchId, source);
    if (!verified || persisted.length !== chunks.length || persisted.some((row: any) => row.rowsJson !== chunks[row.part]) || JSON.stringify(verified.rows) !== JSON.stringify(feed.rows)) throw new Error('Stored tender batch did not verify');
    try {
      const old = await entity.filter({ source }, '-fetchedAt', 120), retain = new Set([batchId]);
      for (const previous of [...new Set(old.map((row: any) => row.batchId).filter((id: string) => id && id !== batchId))]) { if (await decodeBatch(old, previous as string, source)) { retain.add(previous as string); break; } }
      await concurrent(old.filter((row: any) => !retain.has(row.batchId)), row => entity.delete((row as any).id));
    } catch { /* Verified data remains usable if cache maintenance fails. */ }
    return { ...feed, fetchedAt, cacheStored: true };
  } catch (error) {
    // Remove only this failed public-feed batch. Never touch the previous good snapshot.
    try { const partial = await entity.filter({ source, batchId }, 'part', 20); await concurrent(partial, row => entity.delete((row as any).id)); } catch { /* Previous complete batches remain readable. */ }
    console.error('Tender snapshot not verified for ' + source + ': ' + String((error as Error)?.message || error).slice(0, 180));
    return { ...feed, fetchedAt, cacheStored: false };
  }
}
