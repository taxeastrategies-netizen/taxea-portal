import { useState } from 'react';
import { differenceInDays, parseISO } from 'date-fns';
import { Search, Pencil, Trash2, CheckCircle, AlertCircle, Clock, XCircle, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { base44 } from '@/api/base44Client';

function fmt(n) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);
}

const TIPO_LABELS = {
  prestamo_bancario: 'Préstamo bancario', prestamo_socio: 'Préstamo socio',
  ico: 'ICO', leasing: 'Leasing', renting: 'Renting',
  linea_credito: 'Línea crédito', poliza: 'Póliza',
  prestamo_participativo: 'Participativo', deuda_convertible: 'Convertible',
  financiacion_puente: 'Puente', otro: 'Otro',
};

const TIPO_BADGE = {
  prestamo_bancario: 'bg-blue-50 text-blue-700 border-blue-200',
  ico: 'bg-taxea-red/8 text-taxea-red border-taxea-red/20',
  leasing: 'bg-violet-50 text-violet-700 border-violet-200',
  renting: 'bg-slate-100 text-slate-600 border-slate-200',
  linea_credito: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  poliza: 'bg-amber-50 text-amber-700 border-amber-200',
  prestamo_socio: 'bg-indigo-50 text-indigo-700 border-indigo-200',
};

const ESTADO_CFG = {
  activo:       { label: 'Activo',       icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
  carencia:     { label: 'Carencia',     icon: Clock,       color: 'text-amber-600',   bg: 'bg-amber-50 border-amber-200' },
  cancelado:    { label: 'Cancelado',    icon: XCircle,     color: 'text-slate-400',   bg: 'bg-slate-50 border-slate-200' },
  vencido:      { label: 'Vencido',      icon: AlertCircle, color: 'text-red-600',     bg: 'bg-red-50 border-red-200' },
  refinanciado: { label: 'Refinanciado', icon: TrendingDown,color: 'text-blue-600',    bg: 'bg-blue-50 border-blue-200' },
};

const TIPO_FILTERS = ['todos', 'prestamo_bancario', 'ico', 'leasing', 'renting', 'linea_credito', 'poliza'];

export default function DebtList({ debts, onEdit, onRefresh }) {
  const [search, setSearch] = useState('');
  const [filterTipo, setFilterTipo] = useState('todos');
  const [filterEstado, setFilterEstado] = useState('activo');

  const filtered = debts.filter(d => {
    const matchSearch = !search || d.nombre?.toLowerCase().includes(search.toLowerCase()) || d.entidad?.toLowerCase().includes(search.toLowerCase());
    const matchTipo = filterTipo === 'todos' || d.tipo === filterTipo;
    const matchEstado = filterEstado === 'todos' || d.estado === filterEstado;
    return matchSearch && matchTipo && matchEstado;
  });

  const handleDelete = async (d) => {
    if (!window.confirm(`¿Eliminar "${d.nombre}"?`)) return;
    await base44.entities.DebtInstrument.delete(d.id);
    onRefresh();
  };

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar instrumento..."
            className="w-full pl-9 h-9 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-taxea-red/20" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {['todos', 'activo', 'carencia', 'vencido', 'cancelado'].map(s => (
            <button key={s} onClick={() => setFilterEstado(s)}
              className={cn("px-3 h-9 rounded-lg text-xs font-medium border transition-all capitalize",
                filterEstado === s ? "bg-taxea-red text-white border-taxea-red" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300")}>
              {s === 'todos' ? 'Todos' : ESTADO_CFG[s]?.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tipo pills */}
      <div className="flex gap-1.5 flex-wrap">
        {TIPO_FILTERS.map(t => (
          <button key={t} onClick={() => setFilterTipo(t)}
            className={cn("px-2.5 h-7 rounded-lg text-[11px] font-medium border transition-all",
              filterTipo === t ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300")}>
            {t === 'todos' ? 'Todos los tipos' : TIPO_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Grid cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.length === 0 && (
          <div className="col-span-3 text-center py-12 text-xs text-slate-400">No hay instrumentos con estos filtros.</div>
        )}
        {filtered.map(d => {
          const cap = d.capital_pendiente || d.importe_inicial || 0;
          const pctAmort = d.importe_inicial > 0 ? ((d.capital_amortizado || 0) / d.importe_inicial) * 100 : 0;
          const estado = ESTADO_CFG[d.estado] || ESTADO_CFG.activo;
          const EstadoIcon = estado.icon;
          const now = new Date();
          const diasVenc = d.fecha_vencimiento ? differenceInDays(parseISO(d.fecha_vencimiento), now) : null;
          const badgeCls = TIPO_BADGE[d.tipo] || 'bg-slate-100 text-slate-600 border-slate-200';
          const isLinea = d.tipo === 'linea_credito' || d.tipo === 'poliza';
          const util = isLinea && d.limite_credito > 0 ? (d.dispuesto / d.limite_credito) * 100 : null;

          return (
            <div key={d.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 group">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-lg border", badgeCls)}>
                      {TIPO_LABELS[d.tipo] || d.tipo}
                    </span>
                    <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-lg border flex items-center gap-1", estado.bg)}>
                      <EstadoIcon className={cn("w-2.5 h-2.5", estado.color)} />{estado.label}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-foreground truncate">{d.nombre}</p>
                  <p className="text-[11px] text-slate-400">{d.entidad || '—'}</p>
                </div>
              </div>

              {/* Capital */}
              <div className="mb-3">
                <p className="text-[10px] text-slate-400 mb-0.5">{isLinea ? 'Dispuesto' : 'Capital pendiente'}</p>
                <p className="text-2xl font-jakarta font-bold text-foreground">{fmt(isLinea ? d.dispuesto : cap)}</p>
                {!isLinea && d.importe_inicial > 0 && (
                  <>
                    <div className="h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden">
                      <div className="h-full bg-blue-400 rounded-full" style={{ width: `${pctAmort}%` }} />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">{pctAmort.toFixed(0)}% amortizado · {fmt(d.importe_inicial)} inicial</p>
                  </>
                )}
                {isLinea && d.limite_credito > 0 && (
                  <>
                    <div className="h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden">
                      <div className={cn("h-full rounded-full", util > 80 ? "bg-red-400" : util > 50 ? "bg-amber-400" : "bg-emerald-400")} style={{ width: `${util}%` }} />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">{util?.toFixed(0)}% utilizado · Límite {fmt(d.limite_credito)}</p>
                  </>
                )}
              </div>

              {/* Meta */}
              <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400 mb-4">
                {d.tin > 0 && <span>TIN {d.tin}%</span>}
                {d.cuota > 0 && <span>Cuota {fmt(d.cuota)}/{d.periodicidad?.substring(0, 3)}</span>}
                {d.fecha_vencimiento && (
                  <span className={cn("font-medium", diasVenc !== null && diasVenc < 30 ? "text-red-500" : diasVenc !== null && diasVenc < 90 ? "text-amber-500" : "")}>
                    {diasVenc !== null && diasVenc < 0 ? `Vencido` : `Vence ${d.fecha_vencimiento}`}
                  </span>
                )}
                {d.activo_asociado && <span className="truncate">{d.activo_asociado}</span>}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-3 border-t border-slate-100 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => onEdit(d)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 text-xs font-medium transition-all">
                  <Pencil className="w-3 h-3" /> Editar
                </button>
                <button onClick={() => handleDelete(d)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 text-xs font-medium transition-all">
                  <Trash2 className="w-3 h-3" /> Eliminar
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-slate-400">{filtered.length} instrumentos</p>
    </div>
  );
}