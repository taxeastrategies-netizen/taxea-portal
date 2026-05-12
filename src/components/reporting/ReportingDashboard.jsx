import { motion } from 'framer-motion';
import { FileText, BarChart2, Users, Building2, Brain, Award, TrendingUp, Download, Share2, Zap, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const fmt = n => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);
const fmtPct = n => `${(n || 0).toFixed(1)}%`;

const REPORT_TYPES = [
  {
    id: 'monthly', title: 'Monthly Financial Report', desc: 'Informe mensual automático para socios y dirección',
    icon: BarChart2, color: 'bg-blue-50 border-blue-100', iconColor: 'text-blue-600', badge: 'AUTO'
  },
  {
    id: 'board', title: 'Board Report', desc: 'Reporting ejecutivo para consejo de administración',
    icon: Users, color: 'bg-violet-50 border-violet-100', iconColor: 'text-violet-600', badge: 'PREMIUM'
  },
  {
    id: 'investor', title: 'Investor Report', desc: 'Informe para inversores, BA, fondos y VC',
    icon: TrendingUp, color: 'bg-emerald-50 border-emerald-100', iconColor: 'text-emerald-600', badge: 'PREMIUM'
  },
  {
    id: 'bank', title: 'Bank Report', desc: 'Informe bancario para financiación e ICOs',
    icon: Building2, color: 'bg-indigo-50 border-indigo-100', iconColor: 'text-indigo-600', badge: null
  },
  {
    id: 'ai', title: 'Financial Intelligence AI', desc: 'Análisis CFO profundo con inteligencia artificial',
    icon: Brain, color: 'bg-red-50 border-red-100', iconColor: 'text-taxea-red', badge: 'IA'
  },
  {
    id: 'scoring', title: 'Company Scoring', desc: 'Score financiero 0-100 con análisis de salud',
    icon: Award, color: 'bg-amber-50 border-amber-100', iconColor: 'text-amber-600', badge: 'NEW'
  },
  {
    id: 'mna', title: 'M&A Preliminary', desc: 'Análisis preliminar para operaciones corporativas',
    icon: FileText, color: 'bg-slate-50 border-slate-100', iconColor: 'text-slate-600', badge: null
  },
  {
    id: 'excel', title: 'Export Excel', desc: 'Exportación multi-pestaña con KPIs y ratios',
    icon: Download, color: 'bg-green-50 border-green-100', iconColor: 'text-green-600', badge: null
  },
  {
    id: 'share', title: 'Dashboard Compartible', desc: 'Enlace seguro con acceso temporal y contraseña',
    icon: Share2, color: 'bg-amber-50 border-amber-100', iconColor: 'text-amber-600', badge: null
  },
  {
    id: 'auto', title: 'Informes Automáticos', desc: 'Generación y envío periódico programado',
    icon: Zap, color: 'bg-orange-50 border-orange-100', iconColor: 'text-orange-500', badge: 'PRO'
  },
];

export default function ReportingDashboard({ financials, company, loading, onNavigate }) {
  const f = financials || {};

  const KPIS = [
    { label: 'Ingresos totales', value: fmt(f.ingresos), sub: 'Total período', color: 'text-emerald-600' },
    { label: 'EBITDA', value: fmt(f.ebitda), sub: fmtPct(f.margen) + ' margen', color: 'text-blue-600' },
    { label: 'Caja disponible', value: fmt(f.cashTotal), sub: f.runway ? `${f.runway.toFixed(1)} meses runway` : '—', color: 'text-violet-600' },
    { label: 'Deuda activa', value: fmt(f.deudaTotal), sub: `${fmt(f.cuotasMensuales)}/mes cuotas`, color: 'text-amber-600' },
  ];

  return (
    <div className="space-y-6">
      {/* KPI strip */}
      {!loading && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {KPIS.map((k, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
              className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
              <p className="text-xs text-slate-400 mb-1">{k.label}</p>
              <p className={cn("text-xl font-jakarta font-bold", k.color)}>{k.value}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">{k.sub}</p>
            </motion.div>
          ))}
        </div>
      )}

      {/* Report cards */}
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Tipos de informe disponibles</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {REPORT_TYPES.map((r, i) => {
            const Icon = r.icon;
            return (
              <motion.button key={r.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                onClick={() => onNavigate(r.id)}
                className={cn("group text-left p-4 rounded-2xl border transition-all hover:shadow-md hover:-translate-y-0.5", r.color)}>
                <div className="flex items-start justify-between mb-3">
                  <div className={cn("w-9 h-9 rounded-xl bg-white shadow-sm flex items-center justify-center")}>
                    <Icon className={cn("w-4 h-4", r.iconColor)} />
                  </div>
                  <div className="flex items-center gap-1">
                    {r.badge && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-white/80 text-slate-500 border border-slate-200">{r.badge}</span>}
                    <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 transition-all group-hover:translate-x-0.5" />
                  </div>
                </div>
                <p className="text-sm font-semibold text-foreground mb-1">{r.title}</p>
                <p className="text-xs text-slate-500 leading-relaxed">{r.desc}</p>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Footer disclaimer */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
        <p className="text-[11px] text-slate-400">
          <strong>Taxea Reporting Center</strong> — Los informes generados son de carácter orientativo e informativo. 
          No constituyen asesoramiento financiero, contable ni legal regulado. 
          Consulte con asesores especializados antes de tomar decisiones empresariales relevantes.
        </p>
      </div>
    </div>
  );
}