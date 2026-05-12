import { useState } from 'react';
import { cn } from '@/lib/utils';
import { RefreshCw, Eye, Unplug, AlertCircle, CheckCircle, Clock, Wifi, WifiOff, Loader2, Settings, FileSpreadsheet } from 'lucide-react';
import { motion } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import BankDetailPanel from './BankDetailPanel';
import CSVImporter from './CSVImporter';

function fmt(n) {
  if (n === null || n === undefined) return '—';
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n);
}

const BANK_LOGOS = {
  revolut:    { bg: 'bg-black',       text: 'text-white',  initials: 'R' },
  wise:       { bg: 'bg-green-500',   text: 'text-white',  initials: 'W' },
  qonto:      { bg: 'bg-violet-600',  text: 'text-white',  initials: 'Q' },
  bbva:       { bg: 'bg-blue-700',    text: 'text-white',  initials: 'B' },
  santander:  { bg: 'bg-red-600',     text: 'text-white',  initials: 'S' },
  caixabank:  { bg: 'bg-blue-500',    text: 'text-white',  initials: 'C' },
  sabadell:   { bg: 'bg-sky-600',     text: 'text-white',  initials: 'SB' },
  bankinter:  { bg: 'bg-orange-500',  text: 'text-white',  initials: 'BK' },
  ing:        { bg: 'bg-orange-400',  text: 'text-white',  initials: 'ING' },
  stripe:     { bg: 'bg-indigo-600',  text: 'text-white',  initials: 'ST' },
  paypal:     { bg: 'bg-blue-600',    text: 'text-white',  initials: 'PP' },
  otro:       { bg: 'bg-slate-500',   text: 'text-white',  initials: '?' },
};

const STATUS_CFG = {
  conectado:           { icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200', label: 'Conectado' },
  pendiente:           { icon: Clock,       color: 'text-amber-500',   bg: 'bg-amber-50 border-amber-200',     label: 'Pendiente' },
  error:               { icon: AlertCircle, color: 'text-red-600',     bg: 'bg-red-50 border-red-200',         label: 'Error' },
  requiere_renovacion: { icon: AlertCircle, color: 'text-orange-500',  bg: 'bg-orange-50 border-orange-200',   label: 'Renovar' },
  sincronizando:       { icon: Loader2,     color: 'text-blue-500',    bg: 'bg-blue-50 border-blue-200',       label: 'Sincronizando' },
  desconectado:        { icon: WifiOff,     color: 'text-slate-400',   bg: 'bg-slate-50 border-slate-200',     label: 'Desconectado' },
};

export default function BankCard({ account, companyId, onViewMovements, onDisconnect, onRefresh, delay = 0 }) {
  const [showDetail, setShowDetail] = useState(false);
  const [showCSV, setShowCSV] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const logo = BANK_LOGOS[account.proveedor] || BANK_LOGOS.otro;
  const status = STATUS_CFG[account.estado_conexion] || STATUS_CFG.desconectado;
  const StatusIcon = status.icon;

  const syncAgo = account.fecha_ultima_sync
    ? Math.round((new Date() - new Date(account.fecha_ultima_sync)) / 60000)
    : null;

  const handleSync = async (e) => {
    e.stopPropagation();
    setSyncing(true);
    await base44.functions.invoke('bankSync', {
      action: 'sync_mock',
      bank_account_id: account.id,
      company_id: companyId,
    });
    setSyncing(false);
    onRefresh?.();
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay, duration: 0.3 }}
        className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 group"
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0", logo.bg, logo.text)}>
              {getInitials(account.nombre_banco, account.proveedor, logo)}
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{account.nombre_banco}</p>
              <p className="text-xs text-slate-400 font-mono">
                {account.iban ? maskIban(account.iban) : (account.ultimos_4 ? `•••• ${account.ultimos_4}` : '—')}
              </p>
            </div>
          </div>
          <span className={cn("text-[10px] font-semibold px-2 py-1 rounded-lg border flex items-center gap-1", status.bg)}>
            <StatusIcon className={cn("w-3 h-3", status.color, account.estado_conexion === 'sincronizando' && 'animate-spin')} />
            <span className={status.color}>{status.label}</span>
          </span>
        </div>

        {/* Balance */}
        <div className="mb-3">
          <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">Saldo disponible</p>
          <p className="text-2xl font-jakarta font-bold text-foreground">{fmt(account.saldo_disponible)}</p>
          {account.saldo_retenido > 0 && (
            <p className="text-xs text-amber-500 mt-0.5">{fmt(account.saldo_retenido)} retenido</p>
          )}
          <p className="text-xs text-slate-300 mt-0.5">{account.moneda || 'EUR'} · {account.titular || '—'}</p>
        </div>

        {/* Sync info */}
        <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-4">
          <Wifi className="w-3 h-3" />
          <span>
            {syncing ? 'Sincronizando...' :
              syncAgo !== null ? (syncAgo < 2 ? 'Recién sincronizado' : `Sync hace ${syncAgo} min`) : 'Sin sincronizar'}
          </span>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-4 gap-1.5 pt-3 border-t border-slate-100">
          <button onClick={() => onViewMovements(account)}
            className="flex flex-col items-center justify-center gap-1 py-2 text-slate-500 hover:text-foreground bg-slate-50 hover:bg-slate-100 rounded-xl transition-all">
            <Eye className="w-3.5 h-3.5" />
            <span className="text-[9px] font-medium">Mov.</span>
          </button>
          <button onClick={(e) => { e.stopPropagation(); setShowCSV(true); }}
            className="flex flex-col items-center justify-center gap-1 py-2 text-violet-500 hover:text-violet-700 bg-violet-50 hover:bg-violet-100 rounded-xl transition-all">
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span className="text-[9px] font-medium">CSV</span>
          </button>
          <button onClick={handleSync} disabled={syncing}
            className="flex flex-col items-center justify-center gap-1 py-2 text-blue-500 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-xl transition-all disabled:opacity-50">
            <RefreshCw className={cn("w-3.5 h-3.5", syncing && "animate-spin")} />
            <span className="text-[9px] font-medium">Sync</span>
          </button>
          <button onClick={() => setShowDetail(true)}
            className="flex flex-col items-center justify-center gap-1 py-2 text-slate-500 hover:text-foreground bg-slate-50 hover:bg-slate-100 rounded-xl transition-all">
            <Settings className="w-3.5 h-3.5" />
            <span className="text-[9px] font-medium">Config</span>
          </button>
        </div>
      </motion.div>

      {showDetail && (
        <BankDetailPanel
          account={account}
          companyId={companyId}
          onClose={() => setShowDetail(false)}
          onRefresh={() => { setShowDetail(false); onRefresh?.(); }}
        />
      )}
      {showCSV && (
        <CSVImporter
          account={account}
          companyId={companyId}
          onClose={() => setShowCSV(false)}
          onImported={() => { setShowCSV(false); onRefresh?.(); }}
        />
      )}
    </>
  );
}

function getInitials(nombre, proveedor, logo) {
  const known = BANK_LOGOS[proveedor];
  if (known && known.initials !== '?') return known.initials;
  return (nombre || '?').substring(0, 2).toUpperCase();
}

function maskIban(iban) {
  if (!iban || iban.length < 8) return iban;
  return iban.substring(0, 4) + ' •••• •••• ' + iban.slice(-4);
}