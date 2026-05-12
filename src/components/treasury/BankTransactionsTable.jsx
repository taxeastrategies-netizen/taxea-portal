import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, Filter, ArrowUpRight, ArrowDownRight, CheckCircle, AlertCircle, Clock, Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

function fmt(n, sign = false) {
  if (n === null || n === undefined) return '—';
  const abs = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(Math.abs(n));
  if (!sign) return abs;
  return n >= 0 ? `+${abs}` : `-${abs}`;
}

const CONCILIACION_CFG = {
  sin_conciliar:      { label: 'Sin conciliar',   color: 'text-slate-400',   bg: 'bg-slate-50 border-slate-200' },
  sugerida_ia:        { label: 'Sugerida IA',      color: 'text-violet-600',  bg: 'bg-violet-50 border-violet-200' },
  conciliada_auto:    { label: 'Auto',             color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
  conciliada_manual:  { label: 'Manual',           color: 'text-blue-600',    bg: 'bg-blue-50 border-blue-200' },
  revisar:            { label: 'Revisar',          color: 'text-amber-600',   bg: 'bg-amber-50 border-amber-200' },
  descartada:         { label: 'Descartada',       color: 'text-red-400',     bg: 'bg-red-50 border-red-200' },
  movimiento_interno: { label: 'Interno',          color: 'text-slate-500',   bg: 'bg-slate-50 border-slate-200' },
};

const CATEGORIA_CFG = {
  ingreso:              { label: 'Ingreso',       color: 'text-emerald-600' },
  gasto:                { label: 'Gasto',         color: 'text-red-500' },
  transferencia_interna:{ label: 'Transferencia', color: 'text-blue-500' },
  impuesto:             { label: 'Impuesto',      color: 'text-amber-600' },
  nomina:               { label: 'Nómina',        color: 'text-violet-600' },
  comision_bancaria:    { label: 'Comisión',      color: 'text-slate-500' },
  devolucion:           { label: 'Devolución',    color: 'text-teal-600' },
  prestamo:             { label: 'Préstamo',      color: 'text-indigo-600' },
  otro:                 { label: 'Otro',          color: 'text-slate-400' },
};

export default function BankTransactionsTable({ transactions, accounts, onConciliar }) {
  const [search, setSearch] = useState('');
  const [filterConciliacion, setFilterConciliacion] = useState('all');
  const [filterBanco, setFilterBanco] = useState('all');

  const accountMap = useMemo(() => Object.fromEntries((accounts || []).map(a => [a.id, a])), [accounts]);

  const filtered = useMemo(() => {
    return transactions.filter(t => {
      const matchSearch = !search || [t.concepto, t.nombre_contraparte, t.referencia].some(f => f?.toLowerCase().includes(search.toLowerCase()));
      const matchConc = filterConciliacion === 'all' || t.estado_conciliacion === filterConciliacion;
      const matchBanco = filterBanco === 'all' || t.bank_account_id === filterBanco;
      return matchSearch && matchConc && matchBanco;
    });
  }, [transactions, search, filterConciliacion, filterBanco]);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 p-4 border-b border-slate-100">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar concepto, referencia, cliente..."
            className="w-full pl-8 pr-8 h-9 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-taxea-red/30 bg-white" />
          {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="w-3.5 h-3.5 text-slate-300 hover:text-slate-500" /></button>}
        </div>
        <select value={filterConciliacion} onChange={e => setFilterConciliacion(e.target.value)}
          className="h-9 px-3 text-xs border border-slate-200 rounded-lg focus:outline-none bg-white text-slate-600">
          <option value="all">Todas</option>
          {Object.entries(CONCILIACION_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        {accounts.length > 1 && (
          <select value={filterBanco} onChange={e => setFilterBanco(e.target.value)}
            className="h-9 px-3 text-xs border border-slate-200 rounded-lg focus:outline-none bg-white text-slate-600">
            <option value="all">Todos los bancos</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.nombre_banco}</option>)}
          </select>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              {['Fecha', 'Banco', 'Concepto', 'Categoría IA', 'Importe', 'Conciliación', ''].map(h => (
                <th key={h} className="text-left px-4 py-2.5 text-[10px] uppercase tracking-wider text-slate-400 font-semibold whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-slate-400">Sin movimientos</td></tr>
            ) : filtered.map((t, i) => {
              const conc = CONCILIACION_CFG[t.estado_conciliacion] || CONCILIACION_CFG.sin_conciliar;
              const cat = CATEGORIA_CFG[t.categoria_ia] || CATEGORIA_CFG.otro;
              const account = accountMap[t.bank_account_id];
              const isEntrada = t.tipo === 'entrada';
              const dateStr = t.fecha_operacion ? (() => { try { return format(parseISO(t.fecha_operacion), 'd MMM', { locale: es }); } catch { return t.fecha_operacion; } })() : '—';
              return (
                <tr key={t.id || i} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors group">
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{dateStr}</td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{account?.nombre_banco || '—'}</td>
                  <td className="px-4 py-3 max-w-[220px]">
                    <p className="text-slate-700 font-medium truncate">{t.concepto || '—'}</p>
                    {t.nombre_contraparte && <p className="text-slate-400 text-[10px] truncate">{t.nombre_contraparte}</p>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {t.categoria_ia ? (
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="w-3 h-3 text-violet-400" />
                        <span className={cn("font-medium", cat.color)}>{cat.label}</span>
                      </div>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right font-mono">
                    <div className="flex items-center gap-1 justify-end">
                      {isEntrada ? <ArrowUpRight className="w-3 h-3 text-emerald-500" /> : <ArrowDownRight className="w-3 h-3 text-red-400" />}
                      <span className={cn("font-semibold", isEntrada ? 'text-emerald-600' : 'text-red-500')}>
                        {fmt(Math.abs(t.importe || 0))}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full border", conc.bg, conc.color)}>{conc.label}</span>
                  </td>
                  <td className="px-4 py-3">
                    {(t.estado_conciliacion === 'sin_conciliar' || t.estado_conciliacion === 'sugerida_ia') && (
                      <button onClick={() => onConciliar(t)}
                        className="text-[10px] px-2.5 py-1 rounded-lg border border-taxea-red/30 text-taxea-red hover:bg-taxea-red/5 transition-all opacity-0 group-hover:opacity-100">
                        Conciliar
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-2.5 border-t border-slate-50 flex items-center justify-between">
        <span className="text-xs text-slate-400">{filtered.length} movimientos</span>
        <span className="text-xs text-slate-400">{transactions.filter(t => t.estado_conciliacion === 'sin_conciliar').length} sin conciliar</span>
      </div>
    </motion.div>
  );
}