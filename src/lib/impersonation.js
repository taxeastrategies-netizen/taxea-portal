const KEY = 'taxea_impersonation';

export function getImpersonation() {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function startImpersonation({ clientAccountId, clientName, clientEmail }) {
  sessionStorage.setItem(KEY, JSON.stringify({
    clientAccountId,
    clientName,
    clientEmail,
    startedAt: new Date().toISOString(),
  }));
}

export function endImpersonation() {
  sessionStorage.removeItem(KEY);
}