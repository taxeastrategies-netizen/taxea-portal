import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { AlertTriangle, CheckCircle2, ChevronRight, RefreshCw } from 'lucide-react';

const CLOSED = new Set(['presentado', 'domiciliado', 'pagado', 'finalizado', 'no_aplica']);
const style = { ready: 'border-emerald-200 bg-emerald-50 text-emerald-800', review: 'border-amber-200 bg-amber-50 text-amber-900', unknown: 'border-slate-200 bg-slate-50 text-slate-700' };
const quarterOf = date => { const month = Number(String(date || '').slice(5, 7)); return month >= 1 && month <= 12 ? Math.ceil(month / 3) : null; };

export default function QuarterCloseGuide({ companyId, bundle, fiscalYear }) {
  const [quarter, setQuarter] = useState(Math.ceil((new Date().getMonth() + 1) / 3));
  const [extra, setExtra] = useState(null);
  const [loading, setLoading] = useState(false);
  const load = async () => {
    if (!companyId) return;
    setLoading(true);
    const [financial, bank] = await Promise.allSettled([
      base44.functions.invoke('getCompanyFinancials', { company_id: companyId, anio: fiscalYear }),
      base44.functions.invoke('openBanking', { action: 'treasury_snapshot', company_id: companyId }),
    ]);
    setExtra({
      invoices: financial.status === 'fulfilled' ? (financial.value?.data || financial.value)?.invoices || [] : null,
      bank: bank.status === 'fulfilled' && (bank.value?.data || bank.value)?.ok ? bank.value?.data || bank.value : null,
    });
    setLoading(false);
  };
  useEffect(() => { load(); }, [companyId, fiscalYear]);
  const modelItems = useMemo(() => (bundle?.items || []).filter(row => Number(row.fiscalYear) === Number(fiscalYear) && (row.period === 'T' + quarter || row.period === String(quarter) + 'T' || row.period === '0' + quarter + 'T' || row.period === String(quarter))), [bundle, fiscalYear, quarter]);
  const invoices = useMemo(() => extra?.invoices?.filter(row => !row.anulada && Number(String(row.fecha_emision || '').slice(0, 4)) === Number(fiscalYear) && quarterOf(row.fecha_emision) === quarter) || [], [extra, fiscalYear, quarter]);
  const accountingExceptions = invoices.filter(row => row.estado_contable !== 'contabilizada' || !row.linked_journal_entry_id);
  const invoicesKnown = Array.isArray(extra?.invoices);
  const bankKnown = Boolean(extra?.bank?.accounts?.some(row => row.estado_conexion === 'conectado' && row.origen_datos === 'open_banking'));
  const transactions = extra?.bank?.transactions || [];
  const bankExceptions = transactions.filter(row => !row.es_demo && row.estado_proveedor !== 'pending' && Number(String(row.fecha_operacion || '').slice(0, 4)) === Number(fiscalYear) && quarterOf(row.fecha_operacion) === quarter && ['sin_conciliar', 'sugerida_ia', 'revisar'].includes(row.estado_conciliacion));
  const profileValid = bundle?.profile?.profileStatus === 'validado_asesor';
  const unlinked = bundle?.unlinkedDocuments?.length || 0;
  const modelPending = modelItems.filter(row => !CLOSED.has(row.state));
  const checks = [
    { name: 'Perfil y obligaciones', detail: profileValid ? 'Perfil fiscal validado por asesor' : 'Confirmar territorio, actividad y regímenes', status: profileValid ? 'ready' : 'review', to: '/tax-accounting/contabilidad' },
    { name: 'Documentación', detail: unlinked ? unlinked + ' documento(s) fiscal(es) sin vincular' : 'Documentos fiscales vinculados o sin incidencias conocidas', status: unlinked ? 'review' : 'ready', to: '/tax-accounting/obligaciones' },
    { name: 'Facturas y asientos', detail: !invoicesKnown ? 'No se pudieron consultar facturas' : accountingExceptions.length + ' de ' + invoices.length + ' factura(s) requieren revisión contable', status: !invoicesKnown ? 'unknown' : accountingExceptions.length ? 'review' : 'ready', to: '/tax-accounting/contabilidad' },
    { name: 'Banco y conciliación', detail: !bankKnown ? 'Sin banco conectado y verificable' : bankExceptions.length + ' movimiento(s) pendientes en el trimestre', status: !bankKnown ? 'unknown' : bankExceptions.length ? 'review' : 'ready', to: '/finance/treasury' },
    { name: 'Modelos del periodo', detail: modelItems.length ? modelPending.length + ' de ' + modelItems.length + ' modelo(s) sin estado final' : 'Ningún modelo trimestral detectado: comprobar perfil y calendario', status: modelItems.length && !modelPending.length ? 'ready' : 'review', to: '/tax-accounting/impuestos' },
  ];
  const ready = checks.every(row => row.status === 'ready');
  return <section className="space-y-4">
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-jakarta text-lg font-bold">Preparación del cierre trimestral</h2><p className="mt-1 text-xs text-muted-foreground">Cruza las fuentes existentes; no contabiliza, presenta ni declara cerrado un periodo.</p></div><button type="button" disabled={loading} onClick={load} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs disabled:opacity-50"><RefreshCw className={'h-3.5 w-3.5 ' + (loading ? 'animate-spin' : '')} />Actualizar</button></div>
      <div className="mt-4 flex flex-wrap gap-2">{[1, 2, 3, 4].map(value => <button type="button" key={value} onClick={() => setQuarter(value)} className={'rounded-lg px-3 py-1.5 text-xs font-semibold ' + (value === quarter ? 'bg-taxea-red text-white' : 'bg-secondary text-muted-foreground')}>T{value} {fiscalYear}</button>)}</div>
    </div>
    <div className={'rounded-xl border p-4 text-sm ' + (ready ? style.ready : style.review)}>{ready ? <CheckCircle2 className="mr-2 inline h-4 w-4" /> : <AlertTriangle className="mr-2 inline h-4 w-4" />}{ready ? 'Sin incidencias detectadas en estas cinco comprobaciones. Falta siempre la revisión profesional y la presentación oficial.' : 'Hay comprobaciones pendientes o datos no verificables. No se considera cerrado el trimestre.'}</div>
    <div className="grid gap-3 md:grid-cols-2">{checks.map(row => <Link to={row.to} key={row.name} className={'flex items-center gap-3 rounded-xl border p-4 hover:shadow-sm ' + style[row.status]}><div className="min-w-0 flex-1"><p className="text-sm font-bold">{row.name}</p><p className="mt-1 text-xs">{row.detail}</p></div><ChevronRight className="h-4 w-4 shrink-0" /></Link>)}</div>
    <div className="rounded-xl border border-border bg-card p-4"><p className="text-xs font-bold">Modelos de T{quarter} {fiscalYear}</p><div className="mt-2 divide-y divide-border">{modelItems.map(row => <div key={row.key} className="flex justify-between gap-3 py-2 text-xs"><span>Modelo {row.code} · {row.name}</span><span className="text-muted-foreground">{row.state || 'Pendiente'} · {row.filingDeadline || 'Plazo por confirmar'}</span></div>)}{!modelItems.length && <p className="py-2 text-xs text-muted-foreground">No se han detectado modelos para este trimestre. Confirma que el perfil fiscal está configurado.</p>}</div></div>
  </section>;
}
