// Shared date and formatting helpers for recurring invoices (frontend).

export const DOW_LABELS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
export const MONTH_LABELS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export function addMonths(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDate();
  const month = d.getMonth();
  const year = d.getFullYear();
  let newMonth = month + n;
  let newYear = year + Math.floor(newMonth / 12);
  newMonth = ((newMonth % 12) + 12) % 12;
  const lastDay = new Date(newYear, newMonth + 1, 0).getDate();
  const newDay = Math.min(day, lastDay);
  return new Date(newYear, newMonth, newDay).toISOString().slice(0, 10);
}

export function addYears(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDate();
  const month = d.getMonth();
  const year = d.getFullYear() + n;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const newDay = Math.min(day, lastDay);
  return new Date(year, month, newDay).toISOString().slice(0, 10);
}

export function calculateNextRun(config, currentDate) {
  const { frequency, interval, dayOfMonth } = config;
  const intv = Math.max(1, interval || 1);
  if (frequency === 'daily') return addDays(currentDate, intv);
  if (frequency === 'weekly') return addDays(currentDate, intv * 7);
  if (frequency === 'monthly') {
    // Preserve dayOfMonth if set, otherwise use current day
    if (dayOfMonth && dayOfMonth > 0) {
      const d = new Date(currentDate + 'T00:00:00');
      const lastDayThisMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      const dayThisMonth = Math.min(dayOfMonth, lastDayThisMonth);
      const baseDate = new Date(d.getFullYear(), d.getMonth(), dayThisMonth).toISOString().slice(0, 10);
      return addMonths(baseDate, intv);
    }
    return addMonths(currentDate, intv);
  }
  if (frequency === 'yearly') return addYears(currentDate, intv);
  return addMonths(currentDate, 1);
}

export function calculateDueDate(config, issueDate) {
  const { dueDateMode, dueDaysAfterIssue, dueDayOfMonth } = config;
  if (dueDateMode === 'same_day') return issueDate;
  if (dueDateMode === 'days_after') return addDays(issueDate, dueDaysAfterIssue || 30);
  if (dueDateMode === 'fixed_day') {
    const d = new Date(issueDate + 'T00:00:00');
    const day = dueDayOfMonth || 15;
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const newDay = Math.min(day, lastDay);
    return new Date(d.getFullYear(), d.getMonth(), newDay).toISOString().slice(0, 10);
  }
  return issueDate;
}

export function getTrimestre(dateStr) {
  const m = new Date(dateStr + 'T00:00:00').getMonth() + 1;
  return m <= 3 ? 'T1' : m <= 6 ? 'T2' : m <= 9 ? 'T3' : 'T4';
}

export function formatFrequency(config) {
  const { frequency, interval, dayOfWeek, dayOfMonth, monthOfYear } = config;
  const intv = Math.max(1, interval || 1);
  const prefix = intv > 1 ? `Cada ${intv} ` : 'Cada ';
  if (frequency === 'daily') return `${prefix}${intv > 1 ? 'días' : 'día'}`;
  if (frequency === 'weekly') {
    const dow = DOW_LABELS[dayOfWeek ?? 1];
    return `${prefix}${intv > 1 ? 'semanas' : 'semana'}${intv === 1 ? ` (${dow})` : ''}`;
  }
  if (frequency === 'monthly') {
    const dom = dayOfMonth || 1;
    return `Día ${dom} ${intv > 1 ? `cada ${intv} meses` : 'de cada mes'}`;
  }
  if (frequency === 'yearly') {
    const month = MONTH_LABELS[(monthOfYear || 1) - 1];
    return `Cada ${intv > 1 ? `${intv} años` : 'año'} (${month})`;
  }
  return '—';
}

export function buildPeriodKey(templateId, periodStart, periodEnd) {
  return `${templateId}_${periodStart}_${periodEnd}`;
}

export const FREQUENCY_LABELS = {
  daily: 'Diaria',
  weekly: 'Semanal',
  monthly: 'Mensual',
  yearly: 'Anual',
};

export const STATUS_LABELS = {
  active: { label: 'Activa', cls: 'bg-green-100 text-green-700' },
  paused: { label: 'Pausada', cls: 'bg-amber-100 text-amber-700' },
  finished: { label: 'Finalizada', cls: 'bg-muted text-muted-foreground' },
  error: { label: 'Con error', cls: 'bg-red-100 text-red-700' },
  pending_review: { label: 'Pendiente de revisión', cls: 'bg-blue-100 text-blue-700' },
  insufficient_data: { label: 'Sin datos suficientes', cls: 'bg-orange-100 text-orange-700' },
};

export const MODE_LABELS = {
  auto_issue: 'Emitir automáticamente',
  draft_review: 'Crear borrador',
};

export function getDefaultRecurring() {
  return {
    enabled: false,
    frequency: 'monthly',
    interval: 1,
    startDate: new Date().toISOString().slice(0, 10),
    endDate: '',
    dayOfWeek: 1,
    dayOfMonth: 1,
    monthOfYear: 1,
    dayOfMonthYearly: 1,
    dueDateMode: 'days_after',
    dueDaysAfterIssue: 30,
    dueDayOfMonth: 15,
    mode: 'auto_issue',
  };
}