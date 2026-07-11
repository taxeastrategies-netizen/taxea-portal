import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { RefreshCw, AlertTriangle, CreditCard } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';

export default function AdminRenovacion() {
  const { isAdmin } = useOutletContext() || {};
  const [loading, setLoading] = useState(true);
  const [recentPayments, setRecentPayments] = useState([]);

  useEffect(() => {
    if (!isAdmin) return;
    loadData();
  }, [isAdmin]);

  const loadData = async () => {
    setLoading(true);
    try {
      const payments = await base44.asServiceRole.entities.PaymentRecord.list('-created_date', 50);
      setRecentPayments(payments || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  if (!isAdmin) {
    return (
      <div className="p-12 text-center">
        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
        <p className="font-medium">Acceso denegado</p>
      </div>
    );
  }

  const STATUS_COLOR = { paid: 'text-green-600 bg-green-50', failed: 'text-red-600 bg-red-50', pending: 'text-amber-600 bg-amber-50', refunded: 'text-slate-500 bg-slate-50' };
  const TYPE_LABEL = { first_payment: 'Primer pago', renewal: 'Renovación', manual_exception: 'Manual' };

  return (
    <div>
      <PageHeader
        title="Control de Pagos y Domiciliación"
        subtitle="Gestión de pagos recurrentes y domiciliación mensual vía Stripe"
      />

      {loading ? (
        <div className="py-12 text-center"><div className="w-6 h-6 border-2 border-teal border-t-transparent rounded-full animate-spin mx-auto" /></div>
      ) : (
        <div className="max-w-3xl">
          <div className="bg-card border border-border rounded-xl shadow-card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-teal" />
                <h3 className="font-jakarta font-semibold">Historial de pagos</h3>
              </div>
              <Button variant="ghost" size="sm" onClick={loadData} className="gap-1.5 text-xs">
                <RefreshCw className="w-3.5 h-3.5" /> Actualizar
              </Button>
            </div>
            {recentPayments.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">No hay registros de pago aún.</div>
            ) : (
              <div className="divide-y divide-border max-h-[600px] overflow-y-auto">
                {recentPayments.map(p => (
                  <div key={p.id} className="px-5 py-3.5 flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[p.status] || 'text-slate-500 bg-slate-50'}`}>
                          {p.status === 'paid' ? 'Pagado' : p.status === 'failed' ? 'Fallido' : p.status === 'pending' ? 'Pendiente' : p.status}
                        </span>
                        <span className="text-xs text-muted-foreground">{TYPE_LABEL[p.paymentType] || p.paymentType}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {p.paidAt ? new Date(p.paidAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : new Date(p.created_date).toLocaleDateString('es-ES')}
                        {p.stripeInvoiceId && <span className="ml-2 opacity-60">{p.stripeInvoiceId.substring(0, 12)}…</span>}
                      </p>
                    </div>
                    <div className="text-right ml-3">
                      <p className={`font-semibold text-sm ${p.status === 'paid' ? 'text-green-600' : p.status === 'failed' ? 'text-red-500' : 'text-foreground'}`}>
                        {p.amount != null ? `${p.amount.toFixed(2)} ${p.currency || 'EUR'}` : '—'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}