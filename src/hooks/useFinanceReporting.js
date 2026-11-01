import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { civilDay, shiftDay } from '@/lib/reportingPeriods.mjs';

export function useFinancePeriod(companyId, period = '30d') {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ['finance-period', companyId, period, civilDay(new Date())],
    enabled: Boolean(companyId), staleTime: 60000, retry: 1,
    queryFn: async () => {
      const { data } = await base44.functions.invoke('businessDashboardOperations', { action: 'finance_period', companyId, period });
      if (!data?.success || data.companyId !== companyId || data.window?.period !== period) throw new Error('No se pudo verificar el resultado contable del periodo.');
      return data;
    },
  });
  useEffect(() => {
    if (!companyId) return;
    let timer;
    const refresh = () => { window.clearTimeout(timer); timer = window.setTimeout(() => client.invalidateQueries({ queryKey: ['finance-period', companyId] }), 600); };
    const unsubscribe = ['JournalEntry', 'JournalEntryLine', 'AccountingPostingOperation', 'AccountingConfiguration'].map(name => { try { return base44.entities[name].subscribe(refresh); } catch { return null; } }).filter(Boolean);
    window.addEventListener('financials:refresh', refresh);
    return () => { window.clearTimeout(timer); unsubscribe.forEach(stop => stop()); window.removeEventListener('financials:refresh', refresh); };
  }, [companyId, client]);
  return query;
}

export function useFinanceObligations(companyId) {
  const client = useQueryClient();
  useEffect(() => {
    if (!companyId) return;
    let timer;
    const refresh = () => { window.clearTimeout(timer); timer = window.setTimeout(() => client.invalidateQueries({ queryKey: ['finance-obligations', companyId] }), 600); };
    const unsubscribe = ['FiscalProfile','FiscalActivity','TaxModel','TaxObligation','TaxPeriod','TaxFiling','Document'].map(name => { try { return base44.entities[name].subscribe(refresh); } catch { return null; } }).filter(Boolean);
    window.addEventListener('financials:refresh', refresh);
    return () => { window.clearTimeout(timer); unsubscribe.forEach(stop => stop()); window.removeEventListener('financials:refresh', refresh); };
  }, [companyId, client]);
  const today = civilDay(new Date());
  const currentYear = Number(today.slice(0, 4));
  const lastYear = Number(shiftDay(today, 90).slice(0, 4));
  return useQuery({
    queryKey: ['finance-obligations', companyId, currentYear, lastYear],
    enabled: Boolean(companyId), staleTime: 60000, retry: 1,
    queryFn: async () => {
      const years = currentYear === lastYear ? [currentYear] : [currentYear, lastYear];
      const responses = await Promise.all(years.map(fiscalYear => base44.functions.invoke('fiscalCalendarOperations', { action: 'bundle', companyId, fiscalYear })));
      const payloads = responses.map(response => response.data);
      if (payloads.some(payload => !payload?.success || payload.companyId !== companyId)) throw new Error('No se pudo verificar el calendario fiscal de esta empresa.');
      const rows = payloads.flatMap(payload => (payload.items || []).map(item => ({ ...item, id: item.calendarKey || item.key, modelo: item.code, periodo: item.period, fecha_limite: item.filingDeadline, estado: item.state, calendarVerified: Number(payload.fiscalYear) <= Number(payload.verifiedCalendarYear), importe_a_pagar: item.filing?.importeFinal ?? item.taxPeriod?.importeConfirmado ?? item.obligation?.importe ?? null, importe: item.filing?.importeFinal ?? item.taxPeriod?.importeConfirmado ?? item.obligation?.importe ?? null, resultado: item.result || 'pendiente', modelo_codigo: item.code, fecha_limite_presentacion: item.filingDeadline, fecha_limite_domiciliacion: item.domicileDeadline })));
      return { profile: payloads[0]?.profile || null, configuredModels: payloads[0]?.models?.length || 0, rows: [...new Map(rows.map(row => [row.id || `${row.modelo}|${row.periodo}|${row.fecha_limite}`, row])).values()], provisionalDates: payloads.some(payload => Number(payload.fiscalYear) > Number(payload.verifiedCalendarYear)), generatedAt: payloads.map(payload => payload.generatedAt).sort().at(-1) };
    },
  });
}
