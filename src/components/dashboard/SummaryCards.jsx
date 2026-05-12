import { FileText, TrendingUp, TrendingDown, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

function SummaryCard({ icon: Icon, label, value, sub, colorClass, bgClass, href, accentColor, index }) {
  const content = (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.06 }}
      className={cn(
        "group relative bg-card border border-border rounded-2xl p-5 overflow-hidden",
        "hover:shadow-[0_8px_30px_rgba(0,0,0,0.09)] hover:-translate-y-0.5 transition-all duration-300",
        href && "cursor-pointer"
      )}
    >
      {/* Top accent */}
      <div className={cn("absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl opacity-60", accentColor)} />

      {/* Glow behind icon */}
      <div className={cn("absolute -top-8 -right-8 w-24 h-24 rounded-full blur-3xl opacity-0 group-hover:opacity-20 transition-opacity duration-500", bgClass)} />

      <div className="flex items-start justify-between mb-4">
        <div className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center shadow-sm",
          "border border-white/20 backdrop-blur-sm",
          bgClass
        )}>
          <Icon className={cn("w-5 h-5", colorClass)} />
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-widest mb-1.5">{label}</p>
      <p className={cn("text-2xl font-jakarta font-bold", colorClass)}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1.5 font-medium">{sub}</p>}
    </motion.div>
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
        index={0}
        icon={FileText}
        label="Facturas pendientes"
        value={pendientes.length}
        sub={vencidas.length > 0 ? `${vencidas.length} vencida${vencidas.length > 1 ? 's' : ''}` : 'Al día'}
        colorClass={pendientes.length > 0 ? "text-amber-600" : "text-emerald-600"}
        bgClass={pendientes.length > 0 ? "bg-amber-50" : "bg-emerald-50"}
        accentColor={pendientes.length > 0 ? "bg-amber-400" : "bg-emerald-400"}
        href="/tax-accounting/facturas"
      />
      <SummaryCard
        index={1}
        icon={TrendingUp}
        label="Ingresos este mes"
        value={fmt(ingresosEsteMes)}
        sub={`Gastos: ${fmt(gastosEsteMes)}`}
        colorClass="text-emerald-600"
        bgClass="bg-emerald-50"
        accentColor="bg-emerald-400"
        href="/tax-accounting/ingresos-gastos"
      />
      <SummaryCard
        index={2}
        icon={saldoMes >= 0 ? TrendingUp : TrendingDown}
        label="Resultado del mes"
        value={fmt(saldoMes)}
        sub={saldoMes >= 0 ? 'Saldo positivo' : 'Saldo negativo'}
        colorClass={saldoMes >= 0 ? "text-primary" : "text-destructive"}
        bgClass={saldoMes >= 0 ? "bg-accent" : "bg-red-50"}
        accentColor={saldoMes >= 0 ? "bg-taxea-red" : "bg-red-400"}
      />
      <SummaryCard
        index={3}
        icon={Calendar}
        label="Vencimientos próximos"
        value={vencimientosProximos.length}
        sub={vencimientosProximos.length > 0 ? 'En los próximos 30 días' : 'Sin vencimientos urgentes'}
        colorClass={vencimientosProximos.length > 0 ? "text-red-600" : "text-emerald-600"}
        bgClass={vencimientosProximos.length > 0 ? "bg-red-50" : "bg-emerald-50"}
        accentColor={vencimientosProximos.length > 0 ? "bg-red-400" : "bg-emerald-400"}
        href="/tax-accounting/obligaciones"
      />
    </div>
  );
}