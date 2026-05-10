import { FileText, TrendingUp, TrendingDown, Calendar, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

function SummaryCard({ icon: Icon, label, value, sub, colorClass, bgClass, href }) {
  const content = (
    <div className={cn(
      "bg-card border border-border rounded-xl p-5 shadow-card hover:shadow-card-hover transition-all duration-200",
      href && "cursor-pointer hover:border-primary/30"
    )}>
      <div className="flex items-start justify-between mb-3">
        <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", bgClass)}>
          <Icon className={cn("w-5 h-5", colorClass)} />
        </div>
      </div>
      <p className="text-xs text-muted-foreground font-medium mb-1">{label}</p>
      <p className={cn("text-2xl font-jakarta font-bold", colorClass)}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );

  if (href) return <a href={href}>{content}</a>;
  return content;
}

export default function SummaryCards({ invoices, expenses, obligations, currentMonth }) {
  const pendientes = invoices.filter(i => i.estado_contable === 'pendiente' || i.estado_cobro === 'pendiente');
  const vencidas = invoices.filter(i => i.estado_cobro === 'vencida');

  const mesActual = currentMonth || new Date().getMonth() + 1;
  const anioActual = new Date().getFullYear();

  const ingresosEsteMes = invoices
    .filter(i => i.tipo === 'emitida' && new Date(i.fecha_emision).getMonth() + 1 === mesActual && new Date(i.fecha_emision).getFullYear() === anioActual)
    .reduce((s, i) => s + (i.total_factura || 0), 0);

  const gastosEsteMes = expenses
    .filter(e => e.tipo === 'gasto' && new Date(e.fecha).getMonth() + 1 === mesActual && new Date(e.fecha).getFullYear() === anioActual)
    .reduce((s, e) => s + (e.total || 0), 0);

  const saldoMes = ingresosEsteMes - gastosEsteMes;

  const hoy = new Date();
  const en30dias = new Date(hoy); en30dias.setDate(hoy.getDate() + 30);
  const vencimientosProximos = obligations.filter(o => {
    const fecha = new Date(o.fecha_limite);
    return !['presentado', 'finalizado', 'domiciliado'].includes(o.estado) && fecha >= hoy && fecha <= en30dias;
  });

  const fmt = (n) => n.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' €';

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
      <SummaryCard
        icon={FileText}
        label="Facturas pendientes"
        value={pendientes.length}
        sub={vencidas.length > 0 ? `${vencidas.length} vencida${vencidas.length > 1 ? 's' : ''}` : 'Al día'}
        colorClass={pendientes.length > 0 ? "text-amber-600" : "text-green-600"}
        bgClass={pendientes.length > 0 ? "bg-amber-50" : "bg-green-50"}
        href="/facturas"
      />
      <SummaryCard
        icon={TrendingUp}
        label="Ingresos este mes"
        value={fmt(ingresosEsteMes)}
        sub={`Gastos: ${fmt(gastosEsteMes)}`}
        colorClass="text-green-600"
        bgClass="bg-green-50"
        href="/ingresos-gastos"
      />
      <SummaryCard
        icon={saldoMes >= 0 ? TrendingUp : TrendingDown}
        label="Resultado del mes"
        value={fmt(saldoMes)}
        sub={saldoMes >= 0 ? 'Saldo positivo' : 'Saldo negativo'}
        colorClass={saldoMes >= 0 ? "text-primary" : "text-destructive"}
        bgClass={saldoMes >= 0 ? "bg-accent" : "bg-red-50"}
      />
      <SummaryCard
        icon={Calendar}
        label="Vencimientos próximos"
        value={vencimientosProximos.length}
        sub={vencimientosProximos.length > 0 ? 'En los próximos 30 días' : 'Sin vencimientos urgentes'}
        colorClass={vencimientosProximos.length > 0 ? "text-red-600" : "text-green-600"}
        bgClass={vencimientosProximos.length > 0 ? "bg-red-50" : "bg-green-50"}
        href="/obligaciones"
      />
    </div>
  );
}