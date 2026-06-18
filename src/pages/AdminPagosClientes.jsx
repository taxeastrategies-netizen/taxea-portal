import { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Search, RefreshCw, ExternalLink, CreditCard, AlertTriangle, CheckCircle, XCircle, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const SUB_STATUS = {
  sin_suscripcion:      { label: 'Sin suscripción',    color: 'text-slate-400',  bg: 'bg-slate-50 border-slate-200' },
  pendiente_seleccion:  { label: 'Pend. selección',    color: 'text-amber-500',  bg: 'bg-amber-50 border-amber-200' },
  pendiente_pago:       { label: 'Pend. pago',         color: 'text-orange-500', bg: 'bg-orange-50 border-orange-200' },
  processing:           { label: 'En proceso',         color: 'text-orange-500', bg: 'bg-orange-50 border-orange-200' },
  paid_pending_activation: { label: 'Pago ok · pendiente activación', color: 'text-green-600', bg: 'bg-green-50 border-green-200' },
  activa:               { label: 'Activa',             color: 'text-blue-600',   bg: 'bg-blue-50 border-blue-200' },
  past_due:             { label: 'Impago',             color: 'text-red-500',    bg: 'bg-red-50 border-red-200' },
  suspendida:           { label: 'Suspendida',         color: 'text-red-500',    bg: 'bg-red-50 border-red-200' },
  cancelada:            { label: 'Cancelada',          color: 'text-slate-500',  bg: 'bg-slate-100 border-slate-200' },
  caducada:             { label: 'Caducada',           color: 'text-red-400',    bg: 'bg-red-50 border-red-200' },
};

const PAY_STATUS = {
  paid:    { label: 'Pagado',    color: 'text-green-600 bg-green-50' },
  failed:  { label: 'Fallido',  color: 'text-red-600 bg-red-50' },
  pending: { label: 'Pendiente',color: 'text-amber-600 bg-amber-50' },
  refunded:{ label: 'Devuelto', color: 'text-slate-500 bg-slate-100' },
};

function ClientRow({ u, sub, payments }) {
  const [expanded, setExpanded] = useState(false);
  const subCfg = SUB_STATUS[sub?.status] || SUB_STATUS.sin_suscripcion;
  const clientPayments = payments.filter(p => p.userId === u.id);
  const lastPayment = clientPayments[0];

  const openStripe = () => {
    if (sub?.stripeCustomerId) {
      window.open(`https://dashboard.stripe.com/test/customers/${sub.stripeCustomerId}`, '_blank');
    }
  };

  return (
    <>
      <tr className="hover:bg-secondary/20 transition-colors cursor-pointer" onClick={() => setExpanded(e => !e)}>
        <td className="px-4 py-3">
          <div>
            <p className="font-medium text-sm truncate max-w-[140px]">{u.full_name || '—'}</p>
            <p className="text-xs text-muted-foreground truncate max-w-[140px]">{u.email}</p>
          </div>
        </td>
        <td className="px-4 py-3">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-medium ${subCfg.bg} ${subCfg.color}`}>
            {subCfg.label}
          </span>
        </td>
        <td className="px-4 py-3 text-sm">
          {sub?.planName || sub?.plan || '—'}
        </td>
        <td className="px-4 py-3 text-sm font-medium">
          {sub?.amount != null ? `${Number(sub.amount).toFixed(2)} €` : '—'}
        </td>
        <td className="px-4 py-3 text-sm text-muted-foreground">
          {sub?.nextRenewalAt ? new Date(sub.nextRenewalAt).toLocaleDateString('es-ES') : '—'}
        </td>
        <td className="px-4 py-3">
          {lastPayment ? (
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${PAY_STATUS[lastPayment.status]?.color || 'text-slate-500 bg-slate-50'}`}>
              {PAY_STATUS[lastPayment.status]?.label || lastPayment.status}
            </span>
          ) : <span className="text-xs text-muted-foreground">—</span>}
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1">
            {sub?.stripeCustomerId && (
              <button
                onClick={e => { e.stopPropagation(); openStripe(); }}
                title="Ver en Stripe Dashboard"
                className="p-1.5 rounded-lg text-muted-foreground hover:bg-blue-50 hover:text-blue-600 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}
            <button className="p-1.5 rounded-lg text-muted-foreground hover:bg-secondary transition-colors">
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={7} className="bg-secondary/10 px-4 pb-4 pt-0">
            <div className="rounded-xl border border-border bg-card p-4 mt-1">
              {/* Info suscripción */}
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4 text-sm">
                {[
                  ['Stripe Customer ID', sub?.stripeCustomerId || '—'],
                  ['Stripe Sub ID', sub?.stripeSubscriptionId || '—'],
                  ['Método de pago', sub?.paymentMethodBrand ? `${sub.paymentMethodBrand} ····${sub.paymentMethodLast4}` : '—'],
                  ['Inicio suscripción', sub?.startedAt ? new Date(sub.startedAt).toLocaleDateString('es-ES') : '—'],
                  ['Periodo actual hasta', sub?.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString('es-ES') : '—'],
                  ['Cancelar al periodo', sub?.cancelAtPeriodEnd ? 'Sí' : 'No'],
                  ['Portal activo', u.isPortalActive ? 'Sí' : 'No'],
                  ['Estado acceso', u.accountAccessStatus || '—'],
                ].map(([k, v]) => (
                  <div key={k}>
                    <p className="text-xs text-muted-foreground">{k}</p>
                    <p className="font-medium truncate">{v}</p>
                  </div>
                ))}
              </div>

              {/* Historial de pagos */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Historial de pagos ({clientPayments.length})</p>
                {clientPayments.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Sin pagos registrados.</p>
                ) : (
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {clientPayments.map(p => (
                      <div key={p.id} className="flex items-center justify-between text-xs py-1.5 px-3 rounded-lg bg-secondary/40">
                        <div className="flex items-center gap-2">
                          <span className={`px-1.5 py-0.5 rounded font-medium ${PAY_STATUS[p.status]?.color || ''}`}>
                            {PAY_STATUS[p.status]?.label || p.status}
                          </span>
                          <span className="text-muted-foreground">
                            {p.paymentType === 'first_payment' ? 'Primer pago' : p.paymentType === 'renewal' ? 'Renovación' : p.paymentType}
                          </span>
                          <span className="text-muted-foreground">
                            {p.paidAt ? new Date(p.paidAt).toLocaleDateString('es-ES') : new Date(p.created_date).toLocaleDateString('es-ES')}
                          </span>
                        </div>
                        <span className="font-semibold">
                          {p.amount != null ? `${Number(p.amount).toFixed(2)} ${p.currency || 'EUR'}` : '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {sub?.stripeCustomerId && (
                <button
                  onClick={openStripe}
                  className="mt-3 flex items-center gap-1.5 text-xs text-blue-600 hover:underline"
                >
                  <ExternalLink className="w-3 h-3" />
                  Ver cliente en Stripe Dashboard
                </button>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function AdminPagosClientes() {
  const { isAdmin } = useOutletContext() || {};
  const [users, setUsers] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const loadData = async () => {
    setLoading(true);
    const [usersData, subsData, paymentsData] = await Promise.all([
      base44.asServiceRole.entities.User.list('-created_date', 200),
      base44.asServiceRole.entities.Subscription.list('-created_date', 200),
      base44.asServiceRole.entities.PaymentRecord.list('-created_date', 500),
    ]);
    setUsers((usersData || []).filter(u => !u.is_deleted && u.role === 'user'));
    setSubscriptions(subsData || []);
    setPayments(paymentsData || []);
    setLoading(false);
  };

  useEffect(() => { if (isAdmin) loadData(); }, [isAdmin]);

  const getSubForUser = (userId) => subscriptions.find(s => s.userId === userId);

  const filtered = useMemo(() => {
    return users.filter(u => {
      const sub = getSubForUser(u.id);
      const matchSearch = !search.trim() ||
        (u.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (u.email || '').toLowerCase().includes(search.toLowerCase());
      const matchStatus = filterStatus === 'all' || (sub?.status || 'sin_suscripcion') === filterStatus;
      return matchSearch && matchStatus;
    });
  }, [users, subscriptions, search, filterStatus]);

  // KPIs
  const kpis = useMemo(() => {
    const active = subscriptions.filter(s => s.status === 'activa').length;
    const pending = subscriptions.filter(s => s.status === 'paid_pending_activation').length;
    const pastDue = subscriptions.filter(s => s.status === 'past_due').length;
    const mrr = subscriptions.filter(s => s.status === 'activa').reduce((acc, s) => acc + (s.amount || 0), 0);
    return { active, pending, pastDue, mrr };
  }, [subscriptions]);

  if (!isAdmin) {
    return (
      <div className="p-12 text-center">
        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
        <p className="font-medium">Acceso restringido</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Control de Pagos por Cliente" subtitle="Visión completa del estado de suscripciones y pagos de cada usuario">
        <Button variant="outline" size="sm" onClick={loadData} className="gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" /> Actualizar
        </Button>
      </PageHeader>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Activas', value: kpis.active, icon: CheckCircle, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'MRR estimado', value: `${kpis.mrr.toFixed(0)} €`, icon: CreditCard, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Pend. activación', value: kpis.pending, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Impagos', value: kpis.pastDue, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' },
        ].map(k => (
          <div key={k.label} className={`${k.bg} border border-border rounded-xl px-4 py-3 flex items-center gap-3`}>
            <k.icon className={`w-5 h-5 ${k.color}`} />
            <div>
              <p className="text-xl font-jakarta font-bold">{k.value}</p>
              <p className="text-xs text-muted-foreground">{k.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-48 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre o email..." className="pl-9" />
        </div>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="h-9 px-3 rounded-md border border-input bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="all">Todos los estados</option>
          {Object.entries(SUB_STATUS).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {/* Tabla */}
      <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
        {loading ? (
          <div className="py-12 text-center">
            <div className="w-6 h-6 border-2 border-teal border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">No se encontraron usuarios.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 border-b border-border">
                <tr>
                  {['Cliente', 'Estado suscripción', 'Plan', 'Importe', 'Próx. renovación', 'Último pago', 'Acciones'].map(col => (
                    <th key={col} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(u => (
                  <ClientRow
                    key={u.id}
                    u={u}
                    sub={getSubForUser(u.id)}
                    payments={payments}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {!loading && (
        <p className="text-xs text-muted-foreground mt-2">{filtered.length} cliente{filtered.length !== 1 ? 's' : ''}</p>
      )}
    </div>
  );
}