import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';

export default function useInvoiceNumberSuggestion(companyId, date, active, rectifying = false) {
  const [result, setResult] = useState(null);
  const key = [companyId, date, rectifying].join('|');

  useEffect(() => {
    if (!active || !companyId || !date) return;
    let current = true;
    setResult(null);
    base44.functions.invoke('invoiceOperations', {
      action: 'next_invoice_number', company_id: companyId, issue_date: date, rectifying,
    }).then(response => {
      const data = response?.data ?? response;
      if (current) setResult({ key, number: data?.number || '' });
    }).catch(() => {
      if (current) setResult({ key, number: '' });
    });
    return () => { current = false; };
  }, [active, companyId, date, key, rectifying]);

  return active && result?.key === key ? result.number : '';
}
