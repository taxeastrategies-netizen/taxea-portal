/**
 * Shared utilities for OCR document upload, audit trail, and device detection.
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