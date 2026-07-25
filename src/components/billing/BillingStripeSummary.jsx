import { TrendingUp, TrendingDown, Banknote, Wallet, AlertCircle, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function SummaryRow({ label, value, icon: Icon, iconColor }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-2">
        {Icon && <Icon className={`w-4 h-4 ${iconColor || 'text-muted-foreground'}`} />}
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <span className="text-sm font-semibold tabular-nums">{value}</span>
    </div>
  );
}

export default function BillingStripeSummary({ stripe }) {
  if (!stripe?.configured) {
    return (
      <Card className="mb-6 border-amber-200">
        <CardContent className="pt-5">
          <div className="flex items-center gap-2 text-amber-700">
            <AlertCircle className="w-5 h-5" />
            <p className="text-sm font-medium">Stripe no está configurado</p>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Conecta Stripe desde Dashboard → Integraciones para ver el resumen económico.</p>
        </CardContent>
      </Card>
    );
  }

  if (stripe.error) {
    return (
      <Card className="mb-6 border-red-200">
        <CardContent className="pt-5">
          <div className="flex items-center gap-2 text-red-700">
            <AlertCircle className="w-5 h-5" />
            <p className="text-sm font-medium">Error de conexión con Stripe</p>
          </div>
          <p className="text-xs text-red-600 mt-1">{stripe.error}</p>
        </CardContent>
      </Card>
    );
  }

  const fmt = (n) => (n || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Wallet className="w-5 h-5 text-teal" /> Resumen económico Stripe
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8">
          <div>
            <SummaryRow label="Cobrado bruto" value={fmt(stripe.grossCharged)} icon={TrendingUp} iconColor="text-emerald-500" />
            <SummaryRow label="Devoluciones" value={`- ${fmt(stripe.refunds)}`} icon={TrendingDown} iconColor="text-orange-500" />
            <SummaryRow label="Disputas" value={`- ${fmt(stripe.disputes)}`} icon={AlertCircle} iconColor="text-red-500" />
          </div>
          <div>
            <SummaryRow label="Comisiones Stripe" value={`- ${fmt(stripe.fees)}`} icon={TrendingDown} iconColor="text-muted-foreground" />
            <SummaryRow label="Neto Stripe" value={fmt(stripe.net)} icon={Banknote} iconColor="text-teal" />
            <SummaryRow label="Clientes Stripe" value={stripe.customersCount} />
          </div>
          <div>
            <SummaryRow label="Saldo disponible" value={fmt(stripe.availableBalance)} icon={Wallet} iconColor="text-emerald-500" />
            <SummaryRow label="Saldo pendiente" value={fmt(stripe.pendingBalance)} icon={Clock} iconColor="text-amber-500" />
            <SummaryRow label="Abonos enviados" value={fmt(stripe.payoutsPaid)} icon={Banknote} iconColor="text-blue-500" />
            {stripe.payoutsFailed > 0 && <SummaryRow label="Abonos fallidos" value={stripe.payoutsFailed} icon={AlertCircle} iconColor="text-red-500" />}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}