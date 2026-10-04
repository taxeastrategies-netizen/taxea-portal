import { readFeed, SOURCES } from './core.ts';

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
  const binary = atob(encoded);
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  const json = await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
  const rows = JSON.parse(json);
  if (!Array.isArray(rows) || rows.length > 5000) throw new Error('Invalid tender cache');
  return rows;
}

export async function getSnapshot(sdk: any, source: Source): Promise<CachedPage | null> {
  let found: any[];
  try { found = await sdk.asServiceRole.entities.TenderFeedSnapshot.filter({ source }, '-fetchedAt', 40); }
  catch { return null; }
  const batches = [...new Set(found.map(row => row.batchId).filter(Boolean))];
  for (const batchId of batches) {
    const parts = found.filter(row => row.batchId === batchId).sort((a, b) => a.part - b.part);
    const first = parts[0];
    if (!first || first.payloadEncoding !== 'gzip-base64' || !Number.isInteger(first.totalParts) || first.totalParts < 1 || first.totalParts > 20 || parts.length !== first.totalParts || parts.some((part, i) => part.part !== i)) continue;
    try {
      return {
        rows: await unpackRows(parts.map(part => part.rowsJson).join('')),
        next: first.nextUrl || null, updated: first.sourceUpdated || null,
        examined: Number(first.examined) || 0, fetchedAt: first.fetchedAt,
        cacheStored: true,
      };
    } catch { /* Ignore incomplete or invalid batch and try the previous good snapshot. */ }
  }
  return null;
}

export async function refreshSnapshot(sdk: any, source: Source): Promise<CachedPage> {
  const feed = await readFeed(source);
  const fetchedAt = new Date().toISOString();
  try {
    const encoded = await packRows(feed.rows);
    const chunks = encoded.match(new RegExp('.{1,' + CHUNK_SIZE + '}', 'g')) || [''];
    if (chunks.length > 20) throw new Error('Tender cache has too many parts');
    const batchId = crypto.randomUUID();
    await Promise.all(chunks.map((rowsJson, part) => sdk.asServiceRole.entities.TenderFeedSnapshot.create({
      source, fetchedAt, sourceUpdated: feed.updated || '', nextUrl: feed.next || '',
      examined: feed.examined, rowsJson, batchId, part, totalParts: chunks.length,
      payloadEncoding: 'gzip-base64',
    })));
    try {
      const old = await sdk.asServiceRole.entities.TenderFeedSnapshot.filter({ source }, '-fetchedAt', 40);
      const retain = new Set([batchId, ...old.map((row: any) => row.batchId).filter((id: string) => id && id !== batchId).slice(0, 1)]);
      await Promise.allSettled(old.filter((row: any) => !retain.has(row.batchId)).map((row: any) => sdk.asServiceRole.entities.TenderFeedSnapshot.delete(row.id)));
    } catch { /* Cache cleanup never blocks the search. */ }
    return { ...feed, fetchedAt, cacheStored: true };
  } catch (error) {
    console.error('Could not store tender snapshot for ' + source + ': ' + String((error as Error)?.message || error).slice(0, 200));
    return { ...feed, fetchedAt, cacheStored: false };
  }
}
