import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, CheckCircle, AlertCircle, Clock, FileSpreadsheet, Wifi, RotateCcw, ChevronRight } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

const STATUS_CFG = {
  completado: { icon: CheckCircle,  color: 'text-emerald-600', bg: 'bg-emerald-50',  label: 'Completado' },
  error:      { icon: AlertCircle,  color: 'text-red-500',     bg: 'bg-red-50',      label: 'Error' },
  en_proceso: { icon: RefreshCw,    color: 'text-blue-500',    bg: 'bg-blue-50',     label: 'En proceso', spin: true },
  iniciado:   { icon: Clock,        color: 'text-amber-500',   bg: 'bg-amber-50',    label: 'Iniciado' },
  parcial:    { icon: AlertCircle,  color: 'text-amber-500',   bg: 'bg-amber-50',    label: 'Parcial' },
};

const TIPO_CFG = {
  csv_import:  { icon: FileSpreadsheet, label: 'Importación CSV', color: 'text-violet-600' },
  auto:        { icon: Wifi,            label: 'Sync automático',  color: 'text-blue-500' },
  manual:      { icon: RefreshCw,       label: 'Sync manual',      color: 'text-slate-500' },
  api_direct:  { icon: Wifi,            label: 'API directa',      color: 'text-emerald-600' },
  psd2:        { icon: Wifi,            label: 'Open Banking PSD2', color: 'text-indigo-600' },
};

export default function BankSyncPanel({ account, companyId }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [expanded, setExpanded] = useState(null);

  const loadLogs = async () => {
    setLoading(true);
    const data = await base44.entities.BankSyncLog.filter(
      { bank_account_id: account.id }, '-created_date', 20
    );
    setLogs(data);
    setLoading(false);
  };

  useEffect(() => { loadLogs(); }, [account.id]);

  const handleSync = async () => {
    setSyncing(true);
    await base44.functions.invoke('bankSync', {
      action: 'sync_mock',
      bank_account_id: account.id,
      company_id: companyId,
    });
    setSyncing(false);
    loadLogs();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="w-6 h-6 border-2 border-taxea-red border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">Historial de sincronización</p>
          <p className="text-xs text-slate-400">{account.nombre_banco} · {logs.length} registros</p>
        </div>
        <button onClick={handleSync} disabled={syncing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-all">
          <RefreshCw className={cn("w-3.5 h-3.5", syncing && "animate-spin")} />
          {syncing ? 'Sincronizando...' : 'Sync manual'}
        </button>
      </div>

      {logs.length === 0 ? (
        <div className="flex flex-col items-center py-10 text-center">
          <RotateCcw className="w-8 h-8 text-slate-200 mb-2" />
          <p className="text-sm text-slate-400">Sin historial de sincronizaciones</p>
          <p className="text-xs text-slate-300 mt-1">Los logs aparecerán aquí tras cada sync o importación.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((log, i) => {
            const st = STATUS_CFG[log.estado] || STATUS_CFG.iniciado;
            const tp = TIPO_CFG[log.tipo] || TIPO_CFG.manual;
            const StIcon = st.icon;
            const TpIcon = tp.icon;
            const isExpanded = expanded === log.id;

            return (
              <motion.div key={log.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="border border-slate-200 rounded-xl overflow-hidden">
                <button onClick={() => setExpanded(isExpanded ? null : log.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left">
                  <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0", st.bg)}>
                    <StIcon className={cn("w-3.5 h-3.5", st.color, st.spin && 'animate-spin')} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <TpIcon className={cn("w-3 h-3 flex-shrink-0", tp.color)} />
                      <p className="text-xs font-semibold text-foreground">{tp.label}</p>
                      <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded", st.bg, st.color)}>{st.label}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {log.created_date ? formatDistanceToNow(new Date(log.created_date), { addSuffix: true, locale: es }) : '—'}
                      {log.fuente_archivo && ` · ${log.fuente_archivo}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {log.movimientos_nuevos > 0 && (
                      <span className="text-xs font-bold text-emerald-600">+{log.movimientos_nuevos}</span>
                    )}
                    <ChevronRight className={cn("w-3.5 h-3.5 text-slate-300 transition-transform", isExpanded && "rotate-90")} />
                  </div>
                </button>

                {isExpanded && (
                  <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }}
                    className="overflow-hidden border-t border-slate-100 bg-slate-50 px-4 py-3 space-y-2">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div><span className="text-slate-400">Nuevos:</span> <span className="font-semibold text-emerald-600">{log.movimientos_nuevos ?? 0}</span></div>
                      <div><span className="text-slate-400">Duplicados:</span> <span className="font-semibold text-slate-500">{log.movimientos_duplicados ?? 0}</span></div>
                      {log.duracion_ms && <div><span className="text-slate-400">Duración:</span> <span className="font-semibold text-slate-600">{log.duracion_ms}ms</span></div>}
                      {log.iniciado_por && <div><span className="text-slate-400">Por:</span> <span className="font-semibold text-slate-600 truncate">{log.iniciado_por}</span></div>}
                    </div>
                    {log.error_detalle && (
                      <div className="p-2 rounded-lg bg-red-50 border border-red-100">
                        <p className="text-[10px] text-red-600">{log.error_detalle}</p>
                      </div>
                    )}
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}