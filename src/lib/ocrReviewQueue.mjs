export const REVIEWABLE_OCR_STATUSES = new Set(['review_required', 'validated']);

export function reviewableDocuments(documents) {
  return (documents || []).filter(doc => REVIEWABLE_OCR_STATUSES.has(doc.status));
}

export function nextReviewId(documents, currentId, { wrap = false } = {}) {
  const rows = reviewableDocuments(documents);
  const position = rows.findIndex(row => row.id === currentId);
  if (position < 0) return rows[0]?.id || null;
  return rows[position + 1]?.id || (wrap ? rows.find(row => row.id !== currentId)?.id || null : null);
}

export function previousReviewId(documents, currentId) {
  const rows = reviewableDocuments(documents);
  const position = rows.findIndex(row => row.id === currentId);
  return position > 0 ? rows[position - 1].id : null;
}

export function nextAfterConfirmation(documents, currentId) {
  const rows = reviewableDocuments(documents);
  const position = rows.findIndex(row => row.id === currentId);
  if (position < 0) return rows[0]?.id || null;
  return rows[position + 1]?.id || rows.find(row => row.id !== currentId)?.id || null;
}
