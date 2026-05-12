import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Activity, FileSpreadsheet, Shield, ChevronRight, AlertTriangle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { cn } from '@/lib/utils';
import BankSyncPanel from './BankSyncPanel';
import CSVImporter from './CSVImporter';

const TABS = [
  { id: 'sync',     label: 'Sincronización', icon: Activity },
  { id: 'import',   label: 'Importar CSV',   icon: FileSpreadsheet },
  { id: 'consent',  label: 'Consentimiento', icon: Shield },
];

export default function BankDetailPanel({ account, companyId, onClose, onRefresh }) {
  const [tab, setTab] = useState('sync');
  const [showCSV, setShowCSV] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [revoked, setRevoked] = useState(false);

  const handleRevoke = async () => {
    if (!window.confirm('¿Estás seguro de que quieres revocar el consentimiento bancario? La cuenta quedará desconectada.')) return;
    setRevoking(true);
    await base44.functions.invoke('bankSync', {
      action: 'revoke_consent',
      bank_account_id: account.id,
      company_id: companyId,
      motivo: 'Revocado manualmente por el usuario',
    });
    setRevoking(false);
    setRevoked(true);
    onRefresh();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 backdrop-blur-sm p-0 sm:p-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-xl max-h-[85vh] flex flex-col overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
            <div>
              <p className="text-sm font-semibold text-foreground">{account.nombre_banco}</p>
              <p className="text-xs text-slate-400 font-mono">{account.iban ? `•••• ${account.iban.slice(-4)}` : '—'} · {account.titular || '—'}</p>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg">
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 px-5 pt-3 pb-0 flex-shrink-0">
            {TABS.map(t => {
              const Icon = t.icon;
              return (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={cn("flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-xs font-medium border-b-2 transition-all -mb-px",
                    tab === t.id ? "border-taxea-red text-taxea-red" : "border-transparent text-slate-400 hover:text-slate-600")}>
                  <Icon className="w-3 h-3" /> {t.label}
                </button>
              );
            })}
          </div>
          <div className="h-px bg-slate-200 mx-5 flex-shrink-0" />

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-5">
            {tab === 'sync' && (
              <BankSyncPanel account={account} companyId={companyId} />
            )}

            {tab === 'import' && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-blue-50 border border-blue-100">
                  <p className="text-xs font-semibold text-blue-700 mb-1">Importación de extractos CSV/Excel</p>
                  <p className="text-xs text-blue-600">Descarga el extracto desde tu banca online y súbelo aquí. Soportamos los formatos de Revolut, Wise, Qonto, BBVA, Santander, CaixaBank, Sabadell, Bankinter y formato genérico.</p>
                </div>
                <button onClick={() => setShowCSV(true)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-slate-200 hover:border-taxea-red/30 hover:bg-taxea-red/5 transition-all group">
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="w-5 h-5 text-taxea-red" />
                    <div className="text-left">
                      <p className="text-sm font-semibold text-foreground">Subir extracto bancario</p>
                      <p className="text-xs text-slate-400">Detección automática del formato · CSV / TXT</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-taxea-red transition-colors" />
                </button>
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-100 flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-600">Los movimientos duplicados se detectan y omiten automáticamente. Puedes importar múltiples extractos sin riesgo.</p>
                </div>
              </div>
            )}

            {tab === 'consent' && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <p className="text-xs font-semibold text-slate-700">Estado del consentimiento bancario</p>
                  <div className="flex items-center gap-2">
                    <Shield className={cn("w-4 h-4", revoked ? "text-slate-300" : "text-emerald-500")} />
                    <p className={cn("text-xs font-medium", revoked ? "text-slate-400" : "text-emerald-600")}>
                      {revoked ? "Consentimiento revocado" : (account.estado_conexion === 'conectado' ? "Consentimiento activo" : "Sin consentimiento activo")}
                    </p>
                  </div>
                  <div className="space-y-1.5 text-xs text-slate-500">
                    <p>✓ Solo lectura — Taxea nunca realiza pagos</p>
                    <p>✓ Regulado bajo PSD2 / GDPR</p>
                    <p>✓ Datos cifrados en tránsito y reposo</p>
                    <p>✓ Revocable en cualquier momento</p>
                  </div>
                </div>

                {!revoked && account.estado_conexion === 'conectado' && (
                  <button onClick={handleRevoke} disabled={revoking}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 transition-all">
                    {revoking
                      ? <><div className="w-4 h-4 border-2 border-red-300 border-t-red-600 rounded-full animate-spin" /> Revocando...</>
                      : '⊘ Revocar consentimiento y desconectar'
                    }
                  </button>
                )}

                <p className="text-[10px] text-slate-400 text-center">
                  Al revocar, los movimientos ya importados se conservan. Solo se cancela el acceso futuro.
                </p>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {showCSV && (
        <CSVImporter
          account={account}
          companyId={companyId}
          onClose={() => setShowCSV(false)}
          onImported={() => { setShowCSV(false); onRefresh(); }}
        />
      )}
    </>
  );
}