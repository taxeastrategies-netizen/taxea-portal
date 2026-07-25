import { Clock, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

function daysOverdue(dueDate) {
  if (!dueDate) return 0;
  const now = new Date();
  const due = new Date(dueDate);
  return Math.max(0, Math.floor((now - due) / (1000 * 60 * 60 * 24)));
}

export default function BillingOverdueList({ clients }) {
  const overdue = clients.filter(c =>
    c.overdueAmount > 0 || c.billingStatus === 'pago_fallido' || c.billingStatus === 'transferencia_pendiente'
  ).sort((a, b) => (b.overdueAmount || 0) - (a.overdueAmount || 0));

  const total = overdue.reduce((s, c) => s + (c.overdueAmount || 0), 0);

  if (overdue.length === 0) {
    return (
      <Card className="mb-6 border-emerald-200 bg-emerald-50/50">
        <CardContent className="pt-5 flex items-center gap-3">
          <CheckCircle className="w-6 h-6 text-emerald-600" />
          <div>
            <p className="text-sm font-medium text-emerald-900">Sin cobros pendientes</p>
            <p className="text-xs text-emerald-700">No hay incidencias de cobro activas.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-6 border-orange-200 bg-orange-50/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2 text-orange-700">
            <Clock className="w-5 h-5" /> {overdue.length} Cobros Pendientes de Recibir
          </CardTitle>
          <span className="text-sm font-bold text-orange-700">
            Total: {total.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {overdue.slice(0, 10).map(c => {
          const days = daysOverdue(c.nextRenewalDate || c.subscription?.currentPeriodEnd);
          const isManual = c.billingMethod === 'transfer' || c.billingMethod === 'cash' || c.billingMethod === 'external_sepa';
          return (
            <div key={c.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white border border-orange-100 rounded-lg p-3">
              <div className="flex items-center gap-3">
                <div>
                  <p className="text-sm font-medium">{c.displayName || c.legalName}</p>
                  <p className="text-xs text-muted-foreground">
                    {(c.overdueAmount || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                    {c.nextRenewalDate && ` · Fecha cobro: ${new Date(c.nextRenewalDate).toLocaleDateString('es-ES')}`}
                  </p>
                </div>
                {days > 0 && (
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700 whitespace-nowrap">
                    {days} días de retraso
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground hidden sm:inline">
                  {isManual ? 'Transferencia manual' : 'Stripe'}
                </span>
                {isManual ? (
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 h-8">
                    <CheckCircle className="w-3.5 h-3.5" /> Registrar cobro
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" className="h-8">Ver detalle</Button>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}