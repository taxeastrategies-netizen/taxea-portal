const ADMIN_ONLY_MODULES = new Set(['impuestos', 'contabilidad', 'registro-mercantil', 'labor-ocr']);

export function hasPlatformAdminRole(role) {
  return ['admin', 'super_admin'].includes(String(role || '').toLowerCase());
}

export function canAccessTaxModule(module, role) {
  return !ADMIN_ONLY_MODULES.has(module) || hasPlatformAdminRole(role);
}
