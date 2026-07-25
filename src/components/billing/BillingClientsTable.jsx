import { useState, useMemo } from 'react';
import { Search, AlertTriangle, Eye, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const TABS = [
  { id: 'todos', label: 'Todos' },
  { id: 'al_dia', label: 'Al día' },
  { id: 'en_proceso', label: 'En proceso' },
  { id: 'pago_fallido', label: 'Pago fallido' },
  { id: 'transferencia_pendiente', label: 'Transferencia pendiente' },
  { id: 'pendiente_vincular', label: 'Pendiente de vincular' },
  { id: 'cancelados', label: 'Cancelados' },
  { id: 'calidad', label: 'Calidad de datos' },
];

const BILLING_STATUS_STYLE = {
  al_dia: 'bg-emerald-100 text-emerald-700',
  en_proceso: 'bg-blue-100 text-blue-700',
  pago_fallido: 'bg-red-100 text-red-700',
  transferencia_pendiente: 'bg-amber-100 text-amber-700',
  pendiente_vincular: 'bg-purple-100 text-purple-700',
  cancelado: 'bg-slate-100 text-slate-600',
};

function filterClients(clients, tab, search) {
  let filtered = clients;
  if (tab === 'calidad') return [];
  if (tab === 'cancelados') filtered = clients.filter(c => c.accessStatus === 'baja' || c.accessStatus === 'archivada');
  else if (tab === 'todos') filtered = clients.filter(c => c.accessStatus !== 'baja' && c.accessStatus !== 'archivada');
  else filtered = filtered.filter(c => c.billingStatus === tab || (!c.billingStatus && tab === 'al_dia' && c.paymentStatus === 'al_dia'));

  if (search.trim()) {
    const q = search.toLowerCase();
    filtered = filtered.filter(c =>
      (c.displayName || c.legalName || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.taxId || '').toLowerCase().includes(q)
    );
  }
  return filtered;
}

function MobileClientCard({ c }) {
  return (
    <div className="border border-border rounded-lg p-3 space-y-2">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium text-sm">{c.displayName || c.legalName}</p>
          <p className="text-xs text-muted-foreground">{c.email} · {c.taxId || '—'}</p>
        </div>
        <span className={cn('text-[11px] font-medium px-2 py-0.5 rounded-full', BILLING_STATUS_STYLE[c.billingStatus] || 'bg-slate-100 text-slate-600')}>
          {c.billingStatus || c.paymentStatus || '—'}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div><span className="text-muted-foreground">Plan:</span> {c.subscription?.planName || c.plan || '—'}</div>
        <div><span className="text-muted-foreground">Tarifa:</span> {(c.monthlyFee || 0).toFixed(2)}€</div>
        <div><span className="text-muted-foreground">Método:</span> {c.billingMethod || '—'}</div>
      </div>
      <div className="flex justify-end">
        <Button size="sm" variant="ghost" className="h-8 gap-1">Ver ficha <ChevronRight className="w-3.5 h-3.5" /></Button>
      </div>
    </div>
  );
}

export default function BillingClientsTable({ clients, issues }) {
  const [tab, setTab] = useState('todos');
  const [search, setSearch] = useState('');
  const [stripeOnly, setStripeOnly] = useState(false);

  const filtered = useMemo(() => {
    let result = filterClients(clients, tab, search);
    if (stripeOnly) result = result.filter(c => !!c.stripeCustomerId);
    return result;
  }, [clients, tab, search, stripeOnly]);

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 flex-1 flex-wrap">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar cliente, NIF, email..." className="pl-8 h-9" />
            </div>
            <button
              onClick={() => setStripeOnly(s => !s)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors',
                stripeOnly ? 'bg-primary text-primary-foreground border-primary' : 'text-muted-foreground border-border hover:bg-accent'
              )}
            >
              Solo Stripe
            </button>
          </div>
        </div>

        <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors',
                tab === t.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'
              )}
            >
              {t.label}
              {t.id === 'calidad' && issues?.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px]">{issues.length}</span>
              )}
            </button>
          ))}
        </div>

        {tab === 'calidad' ? (
          <div className="space-y-2">
            {issues?.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sin incidencias de calidad de datos.</p>
            ) : issues?.map((iss, i) => (
              <div key={i} className="flex items-start gap-2 p-3 border border-border rounded-lg">
                <AlertTriangle className={cn('w-4 h-4 flex-shrink-0 mt-0.5', iss.severity === 'alta' || iss.severity === 'critica' ? 'text-red-500' : iss.severity === 'media' ? 'text-amber-500' : 'text-muted-foreground')} />
                <div>
                  <p className="text-sm font-medium">{iss.clientName || '—'}</p>
                  <p className="text-xs text-muted-foreground">{iss.explanation}</p>
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground/60">{iss.type}</span>
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No hay clientes en este filtro.</p>
        ) : (
          <>
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="pb-2 pr-3 font-medium">Cliente</th>
                    <th className="pb-2 pr-3 font-medium">NIF/CIF</th>
                    <th className="pb-2 pr-3 font-medium">Plan</th>
                    <th className="pb-2 pr-3 font-medium text-right">Tarifa</th>
                    <th className="pb-2 pr-3 font-medium">Método</th>
                    <th className="pb-2 pr-3 font-medium">Estado</th>
                    <th className="pb-2 pr-3 font-medium">Próx. cobro</th>
                    <th className="pb-2 font-medium text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(c => (
                    <tr key={c.id} className="border-b border-border/50 hover:bg-accent/30">
                      <td className="py-2.5 pr-3">
                        <p className="font-medium">{c.displayName || c.legalName}</p>
                        <p className="text-xs text-muted-foreground">{c.email}</p>
                      </td>
                      <td className="py-2.5 pr-3 text-xs">{c.taxId || '—'}</td>
                      <td className="py-2.5 pr-3 text-xs">{c.subscription?.planName || c.plan || '—'}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">{(c.monthlyFee || 0).toFixed(2)}€</td>
                      <td className="py-2.5 pr-3 text-xs">{c.billingMethod || '—'}</td>
                      <td className="py-2.5 pr-3">
                        <span className={cn('text-[11px] font-medium px-2 py-0.5 rounded-full', BILLING_STATUS_STYLE[c.billingStatus] || 'bg-slate-100 text-slate-600')}>
                          {c.billingStatus || c.paymentStatus || '—'}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-xs whitespace-nowrap">
                        {c.subscription?.nextRenewalAt ? new Date(c.subscription.nextRenewalAt).toLocaleDateString('es-ES') : c.nextRenewalDate ? new Date(c.nextRenewalDate).toLocaleDateString('es-ES') : '—'}
                      </td>
                      <td className="py-2.5 text-right">
                        <Button size="sm" variant="ghost" className="h-7"><Eye className="w-3.5 h-3.5" /></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="lg:hidden space-y-2">
              {filtered.map(c => <MobileClientCard key={c.id} c={c} />)}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}