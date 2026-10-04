import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { getOutstandingAmount } from '@/lib/financialCore';
import { AlertTriangle, ArrowUpRight, RefreshCw } from 'lucide-react';

const CLOSED = new Set(['presentado', 'domiciliado', 'pagado', 'completado', 'finalizado', 'cerrado', 'no_aplica']);
const DONE_TASK = new Set(['completada', 'cancelada']);
const today = () => new Date().toISOString().slice(0, 10);
const dateValue = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : '';
const eur = amount => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(Number(amount) || 0);
const urgency = (date, base = 1) => !date ? base : date < today() ? 4 : date <= new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10) ? 3 : base;

export function buildActionItems({ tasks = [], invoices = [], transactions = [], obligations = [], bankAccounts = [], unlinkedDocuments = [], fiscalProfile = null, isAdmin = false } = {}) {
  const items = [];
  for (const task of tasks) {
    if (DONE_TASK.has(task.estado) || (task.interna && !isAdmin)) continue;
    items.push({ id: 'task:' + task.id, title: task.titulo, detail: task.descripcion || 'Tarea asignada', source: 'Tareas', owner: task.responsable === 'taxea' ? 'Taxea' : 'Cliente', due: dateValue(task.fecha_limite), weight: urgency(dateValue(task.fecha_limite), task.prioridad === 'urgente' ? 4 : task.prioridad === 'alta' ? 3 : 2), route: '/tareas' });
  }
  for (const tx of transactions) {
    if (tx.estado_proveedor === 'pending' || tx.es_demo || !['sin_conciliar', 'sugerida_ia', 'revisar'].includes(tx.estado_conciliacion)) continue;
    items.push({ id: 'bank:' + tx.id, title: tx.concepto || 'Movimiento sin concepto', detail: eur(Math.abs(tx.importe)) + ' · ' + (tx.nombre_contraparte || 'Sin tercero identificado'), source: 'Banco', owner: 'Taxea', due: dateValue(tx.fecha_operacion), weight: tx.estado_conciliacion === 'revisar' ? 4 : 2, route: '/finance/treasury?bank_transaction_id=' + encodeURIComponent(tx.id) });
  }
  for (const invoice of invoices) {
    if (invoice.anulada || getOutstandingAmount(invoice) <= 0.009) continue;
    const due = dateValue(invoice.fecha_vencimiento);
    if (!due || due > today()) continue;
    items.push({ id: 'invoice:' + invoice.id, title: (invoice.tipo === 'recibida' ? 'Pago pendiente · ' : 'Cobro pendiente · ') + (invoice.numero_factura || 'Factura'), detail: eur(getOutstandingAmount(invoice)) + ' · ' + (invoice.tipo === 'recibida' ? invoice.proveedor_nombre || 'Proveedor' : invoice.cliente_nombre || 'Cliente'), source: 'Facturas', owner: 'Cliente', due, weight: urgency(due, 3), route: invoice.tipo === 'recibida' ? '/finance/ap' : '/finance/ar' });
  }
  for (const item of obligations) {
    if (CLOSED.has(item.state)) continue;
    const due = dateValue(item.filingDeadline || item.internalDeadline);
    if (!due || due > new Date(Date.now() + 45 * 86400000).toISOString().slice(0, 10)) continue;
    items.push({ id: 'tax:' + item.key, title: 'Modelo ' + (item.code || '') + ' · ' + (item.period || ''), detail: item.name || 'Obligación fiscal', source: 'Fiscalidad', owner: 'Taxea', due, weight: urgency(due, 2), route: '/tax-accounting/obligaciones' });
  }
  for (const account of bankAccounts) {
    if (account.estado_conexion === 'requiere_renovacion' || account.estado_conexion === 'error') items.push({ id: 'connection:' + account.id, title: 'Revisar conexión bancaria · ' + account.nombre_banco, detail: 'Los datos financieros podrían estar desactualizados', source: 'Banco', owner: 'Cliente', due: '', weight: 4, route: '/finance/treasury' });
  }
  if (!fiscalProfile) items.push({ id: 'profile:missing', title: 'Completar perfil fiscal', detail: 'No se puede confirmar el calendario individual sin perfil', source: 'Fiscalidad', owner: 'Taxea', due: '', weight: 4, route: '/tax-accounting/contabilidad' });
  if (unlinkedDocuments.length) items.push({ id: 'documents:unlinked', title: unlinkedDocuments.length + ' documento(s) fiscal(es) sin vincular', detail: 'Revisar modelo, ejercicio y periodo', source: 'Documentos', owner: 'Taxea', due: '', weight: 3, route: '/tax-accounting/obligaciones' });
  return items.sort((a, b) => b.weight - a.weight || (a.due || '9999').localeCompare(b.due || '9999') || a.title.localeCompare(b.title, 'es'));
}

export default function ActionCenter({ companyId, tasks = [], isAdmin = false }) {
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState([]);
  const [limit, setLimit] = useState(18);
  const refresh = async () => {
    if (!companyId) return;
    setLoading(true);
    const [fin, bank, fiscal] = await Promise.allSettled([
      base44.functions.invoke('getCompanyFinancials', { company_id: companyId }),
      base44.functions.invoke('openBanking', { action: 'treasury_snapshot', company_id: companyId }),
      base44.functions.invoke('fiscalCalendarOperations', { action: 'bundle', companyId, fiscalYear: new Date().getFullYear() }),
    ]);
    const value = result => result.status === 'fulfilled' ? result.value?.data || result.value : null;
    const failed = [];
    if (!value(fin) || value(fin).error) failed.push('facturas');
    if (!value(bank)?.ok) failed.push('bancos');
    if (!value(fiscal) || value(fiscal).error) failed.push('calendario');
    setErrors(failed);
    setSnapshot({ invoices: value(fin)?.invoices || [], transactions: value(bank)?.transactions || [], bankAccounts: value(bank)?.accounts || [], obligations: value(fiscal)?.items || [], unlinkedDocuments: value(fiscal)?.unlinkedDocuments || [], fiscalProfile: value(fiscal)?.profile || null, fiscalLoaded: !failed.includes('calendario') });
    setLoading(false);
  };
  useEffect(() => { refresh(); }, [companyId]);
  const items = useMemo(() => buildActionItems({ tasks, ...snapshot, fiscalProfile: snapshot?.fiscalLoaded ? snapshot.fiscalProfile : true, isAdmin }), [tasks, snapshot, isAdmin]);
  const counts = useMemo(() => ({ bank: items.filter(row => row.source === 'Banco').length, invoices: items.filter(row => row.source === 'Facturas').length, tax: items.filter(row => row.source === 'Fiscalidad').length }), [items]);
  return <section className="mb-7 overflow-hidden rounded-2xl border border-border bg-card">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-slate-950 px-5 py-4 text-white">
      <div><h2 className="font-jakarta text-base font-bold">Centro de pendientes</h2><p className="mt-1 text-xs text-slate-300">Una vista de tareas, facturas, bancos y fiscalidad. Cada acción abre su herramienta original.</p></div>
      <button type="button" onClick={refresh} disabled={loading} className="flex items-center gap-1.5 rounded-lg border border-white/20 px-3 py-2 text-xs disabled:opacity-50"><RefreshCw className={'h-3.5 w-3.5 ' + (loading ? 'animate-spin' : '')} />Actualizar</button>
    </div>
    <div className="flex flex-wrap gap-2 p-4 text-xs"><span className="rounded-full bg-secondary px-3 py-1">Total: {items.length}</span><span className="rounded-full bg-secondary px-3 py-1">Banco: {counts.bank}</span><span className="rounded-full bg-secondary px-3 py-1">Facturas: {counts.invoices}</span><span className="rounded-full bg-secondary px-3 py-1">Fiscalidad: {counts.tax}</span></div>
    {errors.length > 0 && <p role="alert" className="mx-4 mb-3 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800"><AlertTriangle className="h-4 w-4 shrink-0" />Vista parcial: no se pudieron consultar {errors.join(', ')}. No interpretes la ausencia de pendientes como cero.</p>}
    <div className="max-h-[590px] overflow-auto divide-y divide-border">{items.slice(0, limit).map(row => <Link key={row.id} to={row.route} className="flex flex-col gap-1 px-5 py-3 hover:bg-secondary/40 sm:flex-row sm:items-center sm:gap-4"><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{row.title}</span><span className="block truncate text-xs text-muted-foreground">{row.detail}</span></span><span className="text-[11px] text-muted-foreground sm:w-20">{row.source}</span><span className="text-[11px] text-muted-foreground sm:w-16">{row.owner}</span><span className="text-[11px] text-muted-foreground sm:w-24">{row.due || 'Sin plazo'}</span><ArrowUpRight className="hidden h-4 w-4 text-taxea-red sm:block" /></Link>)}{!items.length && !loading && <p className="px-5 py-8 text-center text-sm text-muted-foreground">No hay pendientes detectados en las fuentes disponibles.</p>}</div>
    {items.length > limit && <button type="button" onClick={() => setLimit(n => n + 25)} className="w-full border-t border-border px-4 py-3 text-xs font-semibold text-taxea-red">Mostrar más ({items.length - limit} restantes)</button>}
    <p className="border-t border-border px-5 py-3 text-[11px] text-muted-foreground">Lista informativa: no crea, anula ni concilia registros por sí sola. Las decisiones contables y fiscales se confirman en el módulo de origen.</p>
  </section>;
}
