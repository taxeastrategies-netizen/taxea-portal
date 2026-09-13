import { base44 } from '@/api/base44Client';

export async function fetchCompanyFinancials(companyId, options = {}) {
  const year = 'year' in options ? options.year : undefined;
  if (!companyId) return { invoices: [], expenses: [], sourceTruth: null, summary: {} };
  const response = await base44.functions.invoke('getCompanyFinancials', {
    company_id: companyId,
    ...(year ? { anio: Number(year) } : {}),
  });
  const data = response?.data || response;
  if (data?.error) throw new Error(data.error);
  return {
    invoices: data?.invoices || [],
    expenses: data?.expenses || [],
    sourceTruth: data?.source_truth || null,
    summary: data?.summary || {},
  };
}
