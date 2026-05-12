import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, X, ArrowRight, Sparkles, AlertCircle, RefreshCw, SplitSquareHorizontal } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { cn } from '@/lib/utils';

function fmt(n) {
  if (!n && n !== 0) return '—';
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n);
}

const CONFIDENCE_CFG = {
  alta:  { label: 'Alta confianza',  color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
  media: { label: 'Media confianza', color: 'text-amber-600',   bg: 'bg-amber-50 border-amber-200' },
  baja:  { label: 'Baja confianza',  color: 'text-red-500',     bg: 'bg-red-50 border-red-200' },
};

function scoreMatch(transaction, candidate) {
  let score = 0;
  const tAmt = Math.abs(transaction.importe || 0);
  const cAmt = candidate.total_factura || candidate.total || 0;
  if (Math.abs(tAmt - cAmt) < 0.01) score += 50;
  else if (Math.abs(tAmt - cAmt) < cAmt * 0.05) score += 20;
  const concept = (transaction.concepto || '').toLowerCase();
  const clientName = (candidate.cliente_nombre || candidate.proveedor_cliente || '').toLowerCase();
  if (clientName && concept.includes(clientName.split(' ')[0])) score += 25;
  const numFact = (candidate.numero_factura || '').toLowerCase();
  if (numFact && concept.includes(numFact)) score += 30;
  return score;
}

export default function ReconciliationPanel({ transaction, invoices, expenses, onClose, onReconciled }) {
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);

  const candidates = useMemo(() => {
    if (!transaction) return [];
    const isEntrada = transaction.tipo === 'entrada';
    const pool = isEntrada
      ? invoices.filter(inv => inv.tipo === 'emitida' && inv.estado_cobro !== 'cobrada')
      : [...invoices.filter(inv => inv.tipo === 'recibida'), ...expenses.filter(e => e.estado !== 'contabilizado')];
    return pool.map(c => {
      const score = scoreMatch(transaction, c);
      const conf = score >= 70 ? 'alta' : score >= 35 ? 'media' : 'baja';
      return { ...c, _score: score, _conf: conf, _entityType: c.numero_factura ? 'Invoice' : 'Expense' };
    }).sort((a, b) => b._score - a._score).slice(0, 6);
  }, [transaction, invoices, expenses]);

  const handleConfirm = async () => {
    if (!selected) return;
    setLoading(true);
    await base44.entities.BankTransaction.update(transaction.id, {
      estado_conciliacion: 'conciliada_manual',
      entidad_tipo: selected._entityType,
      entidad_id: selected.id,
      confianza_conciliacion: selected._conf,
    });
    if (selected._entityType === 'Invoice' && transaction.tipo === 'entrada') {
      await base44.entities.Invoice.update(selected.id, { estado_cobro: 'cobrada' });
    }
    setLoading(false);
    onReconciled();
    onClose();
  };

  const handleInternal = async () => {
    setLoading(true);
    await base44.entities.BankTransaction.update(transaction.id, { estado_conciliacion: 'movimiento_interno', categoria_ia: 'transferencia_interna' });
    setLoading(false);
    onReconciled();
    onClose();
  };

  const handleDiscard = async () => {
    setLoading(true);
    await base44.entities.BankTransaction.update(transaction.id, { estado_conciliacion: 'descartada' });
    setLoading(false);
    onReconciled();
    onClose();
  };

  if (!transaction) return null;

  const tAmt = Math.abs(transaction.importe || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-violet-500" />
            <h2 className="text-sm font-semibold text-foreground">Conciliación IA</h2>
          </div>
          <button onClick={onClose}><X className="w-4 h-4 text-slate-400 hover:text-slate-700" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Transaction card */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-2">Movimiento bancario</p>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">{transaction.concepto || '—'}</p>
                {transaction.nombre_contraparte && <p className="text-xs text-slate-400 mt-0.5">{transaction.nombre_contraparte}</p>}
                <p className="text-xs text-slate-400 mt-0.5">{transaction.fecha_operacion}</p>
              </div>
              <p className={cn("text-lg font-bold font-mono flex-shrink-0", transaction.tipo === 'entrada' ? 'text-emerald-600' : 'text-red-500')}>
                {transaction.tipo === 'entrada' ? '+' : '-'}{fmt(tAmt)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-100" />
            <ArrowRight className="w-4 h-4 text-slate-300" />
            <p className="text-xs text-slate-400 font-medium">Sugerencias IA ({candidates.length})</p>
            <div className="flex-1 h-px bg-slate-100" />
          </div>

          {candidates.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No se encontraron candidatos</p>
              <p className="text-xs text-slate-300 mt-1">Puedes marcar como interno o crear un gasto nuevo</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {candidates.map((c, i) => {
                const conf = CONFIDENCE_CFG[c._conf];
                const amount = c.total_factura || c.total || 0;
                const diff = Math.abs(tAmt - amount);
                const isSelected = selected?.id === c.id;
                return (
                  <motion.button key={c.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                    onClick={() => setSelected(isSelected ? null : c)}
                    className={cn("w-full text-left p-4 rounded-xl border transition-all",
                      isSelected ? "border-taxea-red/40 bg-taxea-red/5 ring-2 ring-taxea-red/20" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50")}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate">
                          {c.numero_factura ? `Factura ${c.numero_factura}` : (c.concepto || 'Gasto')}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5 truncate">{c.cliente_nombre || c.proveedor_cliente || '—'}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <p className="text-sm font-bold text-foreground font-mono">{fmt(amount)}</p>
                        {diff > 0.01 && <p className="text-[10px] text-amber-500">Δ {fmt(diff)}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full border", conf.bg, conf.color)}>{conf.label}</span>
                      <span className="text-[10px] text-slate-400">{c._entityType}</span>
                      {isSelected && <CheckCircle className="w-3.5 h-3.5 text-taxea-red ml-auto" />}
                    </div>
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 px-6 py-4 border-t border-slate-100 flex-shrink-0">
          <button disabled={!selected || loading} onClick={handleConfirm}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold bg-taxea-red text-white disabled:opacity-40 hover:bg-taxea-red/90 transition-all">
            {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            Confirmar conciliación
          </button>
          <button onClick={handleInternal} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all">
            <SplitSquareHorizontal className="w-3.5 h-3.5" /> Interno
          </button>
          <button onClick={handleDiscard} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-medium border border-red-100 text-red-500 hover:bg-red-50 transition-all">
            <X className="w-3.5 h-3.5" /> Descartar
          </button>
        </div>
      </motion.div>
    </div>
  );
}