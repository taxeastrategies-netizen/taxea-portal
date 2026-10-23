// Only memory owned by Taxea is reset. Never clear unrelated browser storage.
const cleanups = new Set();
let principal;

export function registerSessionCleanup(cleanup) {
  cleanups.add(cleanup);
  return () => cleanups.delete(cleanup);
}

export function clearPrivateSessionState() {
  for (const cleanup of cleanups) {
    try { cleanup(); } catch { /* A failed cleanup must not skip the others. */ }
  }
}

export function acceptSessionIdentity(user) {
  const next = user?.id ? String(user.id) + '::' + String(user.role || 'user') : null;
  if (principal !== undefined && next !== principal) clearPrivateSessionState();
  principal = next;
}

export function forgetSessionIdentity() {
  principal = null;
  clearPrivateSessionState();
}
