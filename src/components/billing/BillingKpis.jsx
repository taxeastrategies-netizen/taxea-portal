import { Users, CheckCircle, Clock, AlertTriangle, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

function KpiCard({ icon: Icon, iconColor, value, label, sub }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <Icon className={`w-5 h-5 mb-1 ${iconColor}`} />
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
        {sub && <p className="text-[11px] text-muted-foreground/70 mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export default function BillingKpis({ kpis }) {
  if (!kpis) return null;
  const fmt = (n) => (n || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
      <KpiCard icon={Users} iconColor="text-blue-500" value={kpis.totalActivos} label="Total activos" sub={`${fmt(kpis.totalActivosMrr)}/m neto`} />
      <KpiCard icon={CheckCircle} iconColor="text-emerald-500" value={kpis.alDia} label="Al día" sub={`${kpis.alDiaPorcentaje}% · ${fmt(kpis.alDiaMrr)}/m`} />
      <KpiCard icon={Clock} iconColor="text-purple-500" value={kpis.enProceso} label="En proceso" sub="SEPA, onboarding, 1er pago" />
      <KpiCard icon={AlertTriangle} iconColor="text-red-500" value={kpis.pagoFallido} label="Pago fallido" sub={`${fmt(kpis.pagoFallidoImporte)}/m neto`} />
      <KpiCard icon={Sparkles} iconColor="text-amber-500" value={kpis.nuevosEsteMes} label="Nuevos este mes" sub="Altas desde día 1" />
    </div>
  );
}