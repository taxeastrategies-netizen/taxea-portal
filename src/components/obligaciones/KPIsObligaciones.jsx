import { AlertTriangle, CheckCircle2, Clock, FileText, TrendingUp } from 'lucide-react';

export default function KPIsObligaciones({ obligations }) {
  const total = obligations.length;
  const pendientes = obligations.filter(o => ['pendiente_documentacion', 'en_preparacion'].includes(o.estado)).length;
  const presentadas = obligations.filter(o => ['presentado', 'finalizado', 'pagado', 'domiciliado'].includes(o.estado)).length;
  const now = new Date();
  const vencidas = obligations.filter(o => {
    if (!o.fecha_limite) return false;
    return new Date(o.fecha_limite) < now && !['finalizado', 'presentado', 'pagado', 'domiciliado'].includes(o.estado);
  }).length;
  const proximas = obligations.filter(o => {
    if (!o.fecha_limite) return false;
    const diff = (new Date(o.fecha_limite) - now) / 86400000;
    return diff >= 0 && diff <= 15 && !['finalizado', 'presentado', 'pagado', 'domiciliado'].includes(o.estado);
  }).length;
  const pct = total > 0 ? Math.round((presentadas / total) * 100) : 0;

  const cards = [
    { label: 'Total obligaciones', value: total, icon: FileText, color: 'bg-secondary text-muted-foreground' },
    { label: 'Pendientes', value: pendientes, icon: Clock, color: 'bg-amber-50 text-amber-600' },
    { label: 'Presentadas', value: presentadas, icon: CheckCircle2, color: 'bg-green-50 text-green-600' },
    { label: 'Vencidas', value: vencidas, icon: AlertTriangle, color: 'bg-red-50 text-red-600' },
    { label: 'Próximas (15d)', value: proximas, icon: Clock, color: 'bg-orange-50 text-orange-600' },
  ];

  return (
    <div className="space-y-3 mb-6">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {cards.map(c => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="bg-card border border-border rounded-xl p-4 shadow-card">
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${c.color}`}><Icon className="w-3.5 h-3.5" /></div>
              </div>
              <p className="text-xl font-jakarta font-bold text-foreground">{c.value}</p>
              <p className="text-xs text-muted-foreground">{c.label}</p>
            </div>
          );
        })}
      </div>
      {/* Barra cumplimiento */}
      {total > 0 && (
        <div className="bg-card border border-border rounded-xl p-4 shadow-card">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-teal" />
              <span className="text-sm font-medium text-foreground">Cumplimiento fiscal</span>
            </div>
            <span className="text-sm font-bold text-teal">{pct}%</span>
          </div>
          <div className="h-2.5 bg-secondary rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}