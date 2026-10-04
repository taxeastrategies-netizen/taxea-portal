import { readFeed, SOURCES } from './core.ts';

export type Source = keyof typeof SOURCES;
export type FeedPage = { rows: any[]; next: string | null; updated: string | null; examined: number };
export type CachedPage = FeedPage & { fetchedAt: string };
const SOURCES_SET = new Set(Object.keys(SOURCES));
export const isSource = (value: unknown): value is Source => typeof value === 'string' && SOURCES_SET.has(value);

export async function getSnapshot(sdk: any, source: Source): Promise<CachedPage | null> {
  const found = await sdk.asServiceRole.entities.TenderFeedSnapshot.filter({ source }, '-fetchedAt', 1);
  const record = found?.[0];
  if (!record?.rowsJson || !record?.fetchedAt) return null;
  try {
    const rows = JSON.parse(record.rowsJson);
    if (!Array.isArray(rows) || rows.length > 5000) return null;
    return {
      rows, next: record.nextUrl || null, updated: record.sourceUpdated || null,
      examined: Number(record.examined) || 0, fetchedAt: record.fetchedAt,
    };
  } catch { return null; }
}

export async function refreshSnapshot(sdk: any, source: Source): Promise<CachedPage> {
  const feed = await readFeed(source);
  const fetchedAt = new Date().toISOString();
  const data = {
    source, fetchedAt, sourceUpdated: feed.updated || '',
    nextUrl: feed.next || '', examined: feed.examined,
    rowsJson: JSON.stringify(feed.rows),
  };
  const found = await sdk.asServiceRole.entities.TenderFeedSnapshot.filter({ source }, '-fetchedAt', 1);
  if (found?.[0]?.id) await sdk.asServiceRole.entities.TenderFeedSnapshot.update(found[0].id, data);
  else await sdk.asServiceRole.entities.TenderFeedSnapshot.create(data);
  return { ...feed, fetchedAt };
}
