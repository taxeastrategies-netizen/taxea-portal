/**
 * Shared utilities for OCR document upload, audit trail, device detection,
 * error classification, and idempotency.
 */

export function detectDeviceType() {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent || '';
  if (/tablet|ipad/i.test(ua)) return 'tablet';
  if (/mobile|iphone|ipod|android.*mobile|windows phone/i.test(ua)) return 'mobile';
  return 'desktop';
}

export function detectUploadSource(captureMethod, isAdmin, deviceType) {
  if (isAdmin) return 'admin_upload';
  if (captureMethod === 'camera') return 'mobile_camera';
  if (deviceType === 'mobile' || deviceType === 'tablet') return 'mobile_upload';
  return 'desktop_upload';
}

export function buildAuditEntry({ user, action, prevStatus, newStatus, detail }) {
  const ts = new Date().toISOString();
  const email = user?.email || 'sistema';
  const role = user?.role || 'user';
  const parts = [
    `[${ts}]`,
    `user=${email}`,
    `role=${role}`,
    `action=${action}`,
  ];
  if (prevStatus) parts.push(`from=${prevStatus}`);
  if (newStatus) parts.push(`to=${newStatus}`);
  if (detail) parts.push(`detail=${detail}`);
  return parts.join(' ');
}

export function appendAuditTrail(existingTrail, newEntry) {
  const arr = Array.isArray(existingTrail) ? [...existingTrail] : [];
  arr.push(newEntry);
  return arr;
}

/**
 * Generates a short unique trace ID for each upload attempt.
 */
export function generateTraceId() {
  return `trace-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Generates an idempotency key from file metadata + company + user.
 * Prevents duplicate documents on retry.
 */
export function generateIdempotencyKey(file, companyId, userId) {
  const data = `${file.name}|${file.size}|${file.lastModified || 0}|${companyId}|${userId || ''}`;
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) - hash) + data.charCodeAt(i);
    hash = hash & hash;
  }
  return `ocr-${Math.abs(hash).toString(36)}-${Date.now().toString(36)}`;
}

/**
 * Classifies an upload error into a safe user-facing message + internal code.
 * Never returns raw backend details to the user.
 */
export function classifyUploadError(err) {
  const rawMsg = err?.message || String(err || '');
  const msg = rawMsg.toLowerCase();
  const status = err?.status || err?.response?.status || err?.statusCode;

  if (msg === 'timeout' || msg.includes('timeout')) {
    return { safeMessage: 'La subida tardó demasiado. Revisa tu conexión e inténtalo de nuevo.', retryable: true, errorCode: 'TIMEOUT' };
  }
  if (status === 401 || msg.includes('unauthorized') || msg.includes('token') || msg.includes('expir')) {
    return { safeMessage: 'Tu sesión ha caducado. Cierra sesión y vuelve a entrar.', retryable: true, errorCode: 'AUTH_EXPIRED' };
  }
  if (status === 403 || msg.includes('forbidden') || msg.includes('permission') || msg.includes('permiso')) {
    return { safeMessage: 'No tienes permisos para subir documentos en este cliente. Contacta con Taxea.', retryable: false, errorCode: 'FORBIDDEN' };
  }
  if (status === 413 || msg.includes('too large') || msg.includes('tamaño') || msg.includes('size limit')) {
    return { safeMessage: 'El archivo supera el límite permitido de 10 MB.', retryable: false, errorCode: 'FILE_TOO_LARGE' };
  }
  if (status === 415 || msg.includes('mime') || msg.includes('format') || msg.includes('unsupported media')) {
    return { safeMessage: 'Este formato no está admitido. Sube PDF, JPG o PNG.', retryable: false, errorCode: 'UNSUPPORTED_TYPE' };
  }
  if (status === 429) {
    return { safeMessage: 'Demasiadas subidas a la vez. Espera un momento e inténtalo de nuevo.', retryable: true, errorCode: 'RATE_LIMITED' };
  }
  if (msg.includes('no se recibió') || msg.includes('no url') || msg.includes('file_url')) {
    return { safeMessage: 'El servidor no confirmó la subida. Inténtalo de nuevo.', retryable: true, errorCode: 'NO_URL_RETURNED' };
  }
  if (msg.includes('network') || msg.includes('fetch') || msg.includes('failed to fetch') || err?.name === 'TypeError') {
    return { safeMessage: 'No se ha podido conectar con el servidor. Revisa la conexión y vuelve a intentarlo.', retryable: true, errorCode: 'NETWORK_ERROR' };
  }
  if (status >= 500) {
    return { safeMessage: 'No se ha podido guardar el archivo. Inténtalo de nuevo en unos minutos. Si se repite, Taxea revisará la incidencia.', retryable: true, errorCode: 'SERVER_ERROR' };
  }

  // Fallback — still gives the user a useful message but we log the raw error internally
  return { safeMessage: 'No se ha podido guardar el archivo. Inténtalo de nuevo en unos minutos. Si se repite, Taxea revisará la incidencia.', retryable: true, errorCode: 'UNKNOWN', rawError: rawMsg };
}

const ALLOWED_EXTS = ['pdf', 'jpg', 'jpeg', 'png', 'webp'];
const ALLOWED_MIMES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

/**
 * Pre-validates a file before attempting upload.
 * Returns { valid: boolean, errorCode?: string, message?: string }.
 */
export function validateFile(file, maxMB = 10) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (!ALLOWED_EXTS.includes(ext)) {
    return { valid: false, errorCode: 'UNSUPPORTED_TYPE', message: 'Este formato no está admitido. Sube PDF, JPG o PNG.' };
  }
  if (file.size > maxMB * 1024 * 1024) {
    return { valid: false, errorCode: 'FILE_TOO_LARGE', message: `El archivo supera el límite permitido de ${maxMB} MB.` };
  }
  if (file.size === 0) {
    return { valid: false, errorCode: 'EMPTY_FILE', message: 'El archivo está vacío.' };
  }
  return { valid: true };
}