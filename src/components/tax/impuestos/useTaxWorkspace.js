import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export const taxWorkspaceKey = (companyId, year) => ['tax-model-workspace', companyId, Number(year)];

export function useTaxWorkspace(companyId, year) {
  return useQuery({
    queryKey: taxWorkspaceKey(companyId, year),
    queryFn: async () => (await base44.functions.invoke('taxModelOperations', {
      action: 'workspace',
      companyId,
      ejercicio: Number(year),
    })).data,
    enabled: Boolean(companyId && year),
    staleTime: 20_000,
    refetchOnWindowFocus: true,
  });
}

export function formatMoney(value) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(Number(value) || 0);
}

export function formatDate(value, includeTime = false) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-ES', includeTime
    ? { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

export const DRAFT_STATUS = {
  borrador: { label: 'Borrador', className: 'border-slate-200 bg-slate-50 text-slate-700' },
  en_revision: { label: 'En revisión', className: 'border-amber-200 bg-amber-50 text-amber-800' },
  revisado: { label: 'Revisado', className: 'border-cyan-200 bg-cyan-50 text-cyan-800' },
  aprobado: { label: 'Aprobado', className: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
  rechazado: { label: 'Rechazado', className: 'border-red-200 bg-red-50 text-red-700' },
};

export const FILING_STATUS = {
  pendiente: { label: 'Pendiente', className: 'border-amber-200 bg-amber-50 text-amber-800' },
  en_proceso: { label: 'En proceso', className: 'border-blue-200 bg-blue-50 text-blue-800' },
  presentado: { label: 'Presentado', className: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
  rechazado: { label: 'Rechazado', className: 'border-red-200 bg-red-50 text-red-700' },
  con_requerimiento: { label: 'Con requerimiento', className: 'border-red-200 bg-red-50 text-red-700' },
  subsanado: { label: 'Subsanado', className: 'border-cyan-200 bg-cyan-50 text-cyan-800' },
};

export function statusPill(config, fallback) {
  return config || { label: fallback || 'Sin estado', className: 'border-slate-200 bg-slate-50 text-slate-600' };
}

export function isReviewer(user) {
  return ['admin', 'super_admin', 'advisor', 'asesor'].includes(String(user?.role || '').toLowerCase());
}

