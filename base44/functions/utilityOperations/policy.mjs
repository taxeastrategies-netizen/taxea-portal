export const norm = value => String(value || '').trim().toLowerCase();
export function canAccessCompany(user, company) {
  return !!(user?.id && company?.id && company.activa !== false && (
    ['admin','super_admin'].includes(user.role) || norm(company.owner_email) === norm(user.email) ||
    (Array.isArray(company.usuarios_autorizados) && company.usuarios_autorizados.some(email => norm(email) === norm(user.email)))
  ));
}
export function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const date = new Date(value + 'T12:00:00Z');
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0,10) === value;
}
export function deadlinePayload(raw = {}) {
  const title = String(raw.title || '').trim();
  if (!title || title.length > 160 || !validDate(raw.due_date)) throw new Error('Indica título y fecha válidos.');
  const days = Number(raw.remind_days);
  if (!Number.isInteger(days) || days < 0 || days > 365) throw new Error('El aviso debe estar entre 0 y 365 días.');
  if (!['certificado','seguro','contrato','renovacion','otro'].includes(raw.kind)) throw new Error('Tipo no válido.');
  if (!['pending','done'].includes(raw.status)) throw new Error('Estado no válido.');
  if (String(raw.notes || '').length > 2000) throw new Error('Notas demasiado largas.');
  return { title, due_date: raw.due_date, remind_days: days, kind: raw.kind, status: raw.status, notes: String(raw.notes || '') };
}
