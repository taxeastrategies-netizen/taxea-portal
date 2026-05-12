import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Shield, CheckCircle, ChevronRight, AlertCircle, FileSpreadsheet, Wifi, Zap, ArrowLeft } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { cn } from '@/lib/utils';

const BANKS = [
  { id: 'revolut',   name: 'Revolut Business', tipo: 'neobanco',      color: 'bg-black text-white',          badge: 'API Directa', conexion: 'api' },
  { id: 'wise',      name: 'Wise Business',     tipo: 'neobanco',      color: 'bg-green-500 text-white',      badge: 'API Directa', conexion: 'api' },
  { id: 'qonto',     name: 'Qonto',             tipo: 'neobanco',      color: 'bg-violet-600 text-white',     badge: 'API Directa', conexion: 'api' },
  { id: 'bbva',      name: 'BBVA',              tipo: 'tradicional',   color: 'bg-blue-700 text-white',       badge: 'Open Banking', conexion: 'psd2' },
  { id: 'santander', name: 'Santander',         tipo: 'tradicional',   color: 'bg-red-600 text-white',        badge: 'Open Banking', conexion: 'psd2' },
  { id: 'caixabank', name: 'CaixaBank',         tipo: 'tradicional',   color: 'bg-blue-500 text-white',       badge: 'Open Banking', conexion: 'psd2' },
  { id: 'sabadell',  name: 'Sabadell',          tipo: 'tradicional',   color: 'bg-sky-600 text-white',        badge: 'Open Banking', conexion: 'psd2' },
  { id: 'bankinter', name: 'Bankinter',         tipo: 'tradicional',   color: 'bg-orange-500 text-white',     badge: 'Open Banking', conexion: 'psd2' },
  { id: 'ing',       name: 'ING',               tipo: 'tradicional',   color: 'bg-orange-400 text-white',     badge: 'Open Banking', conexion: 'psd2' },
  { id: 'stripe',    name: 'Stripe',            tipo: 'pasarela_pago', color: 'bg-indigo-600 text-white',     badge: 'API', conexion: 'api' },
  { id: 'otro',      name: 'Otro banco',        tipo: 'otro',          color: 'bg-slate-400 text-white',      badge: null, conexion: 'csv' },
];

const CONEXION_TYPES = {
  api: {
    label: 'API Directa', icon: Zap,
    desc: 'Conexión oficial mediante API bancaria. Más rápida y actualizada.',
    coming_soon: true,
  },
  psd2: {
    label: 'Open Banking PSD2', icon: Wifi,
    desc: 'Conexión segura regulada. Requiere autorización en tu banco.',
    coming_soon: true,
  },
  csv: {
    label: 'Importar CSV/Excel', icon: FileSpreadsheet,
    desc: 'Importa movimientos desde el extracto de tu banco.',
    coming_soon: false,
  },
};

const PERMISOS_PSD2 = ['Consulta de saldos', 'Historial de movimientos (90 días)', 'Identificación de cuenta (IBAN, titular)'];

export default function ConnectBankModal({ companyId, onClose, onConnected }) {
  const [step, setStep] = useState('select');
  const [selected, setSelected] = useState(null);
  const [conexionType, setConexionType] = useState(null);
  const [form, setForm] = useState({ nombre_banco: '', iban: '', titular: '', saldo_disponible: '', moneda: 'EUR' });
  const [loading, setLoading] = useState(false);
  const [accepted, setAccepted] = useState(false);

  const handleSelectBank = (bank) => {
    setSelected(bank);
    setForm(f => ({ ...f, nombre_banco: bank.name }));
    setStep('conexion');
  };

  const handleConexionType = (type) => {
    const cfg = CONEXION_TYPES[type];
    if (cfg.coming_soon && type !== 'csv') {
      // Para tipos que requieren integración real, ir directo a form manual + nota
      setConexionType(type);
      setStep('consent');
    } else {
      setConexionType(type);
      setStep('consent');
    }
  };

  const handleConnect = async () => {
    setLoading(true);
    await new Promise(r => setTimeout(r, 900));

    const account = await base44.entities.BankAccount.create({
      company_id: companyId,
      nombre_banco: form.nombre_banco || selected?.name,
      proveedor: selected?.id || 'otro',
      tipo_banco: selected?.tipo || 'otro',
      iban: form.iban,
      ultimos_4: form.iban ? form.iban.replace(/\s/g, '').slice(-4) : '',
      titular: form.titular,
      moneda: form.moneda || 'EUR',
      saldo_disponible: parseFloat(form.saldo_disponible) || 0,
      saldo_contable: parseFloat(form.saldo_disponible) || 0,
      estado_conexion: conexionType === 'csv' ? 'pendiente' : 'conectado',
      fecha_ultima_sync: new Date().toISOString(),
      permisos_concedidos: PERMISOS_PSD2,
    });

    // Registrar consentimiento
    if (accepted) {
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + 90);
      await base44.functions.invoke('bankSync', {
        action: 'create_consent',
        bank_account_id: account.id,
        company_id: companyId,
        proveedor: selected?.id || 'otro',
        tipo_conexion: conexionType || 'psd2',
        permisos: PERMISOS_PSD2,
      });
    }

    setLoading(false);
    setStep('success');
    setTimeout(() => { onConnected(account); }, 1600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            {step !== 'select' && step !== 'success' && (
              <button onClick={() => setStep(step === 'consent' || step === 'conexion' ? (step === 'consent' ? 'conexion' : 'select') : 'select')}
                className="p-1 hover:bg-slate-100 rounded-lg">
                <ArrowLeft className="w-4 h-4 text-slate-400" />
              </button>
            )}
            <div>
              <p className="text-sm font-semibold text-foreground">Conectar cuenta bancaria</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {step === 'select' ? 'Elige tu banco' :
                  step === 'conexion' ? `${selected?.name} — Tipo de conexión` :
                    step === 'consent' ? 'Consentimiento y datos' :
                      '¡Cuenta añadida!'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4 text-slate-400" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait">

            {/* Step 1: Seleccionar banco */}
            {step === 'select' && (
              <motion.div key="select" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}>
                <div className="grid grid-cols-2 gap-2 max-h-80 overflow-y-auto pr-1">
                  {BANKS.map(bank => (
                    <button key={bank.id} onClick={() => handleSelectBank(bank)}
                      className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all text-left group">
                      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0", bank.color)}>
                        {bank.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-foreground truncate">{bank.name}</p>
                        {bank.badge && (
                          <span className={cn("text-[10px] px-1.5 rounded font-medium",
                            bank.conexion === 'api' ? "bg-emerald-50 text-emerald-600" :
                              bank.conexion === 'psd2' ? "bg-blue-50 text-blue-600" : "bg-violet-50 text-violet-600"
                          )}>{bank.badge}</span>
                        )}
                      </div>
                      <ChevronRight className="w-3 h-3 text-slate-300 group-hover:text-slate-500 flex-shrink-0" />
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Step 2: Tipo de conexión */}
            {step === 'conexion' && (
              <motion.div key="conexion" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}
                className="space-y-3">
                <p className="text-xs text-slate-500 mb-2">Elige cómo conectar <strong>{selected?.name}</strong> a Taxea:</p>
                {Object.entries(CONEXION_TYPES).map(([key, cfg]) => {
                  const Icon = cfg.icon;
                  const isRecommended = key === selected?.conexion;
                  return (
                    <button key={key} onClick={() => handleConexionType(key)}
                      className={cn("w-full flex items-start gap-3 p-4 rounded-xl border text-left transition-all hover:shadow-sm",
                        isRecommended ? "border-taxea-red/30 bg-taxea-red/5" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                      )}>
                      <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0",
                        key === 'csv' ? "bg-violet-100" : key === 'api' ? "bg-emerald-100" : "bg-blue-100")}>
                        <Icon className={cn("w-4 h-4",
                          key === 'csv' ? "text-violet-600" : key === 'api' ? "text-emerald-600" : "text-blue-600")} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-foreground">{cfg.label}</p>
                          {isRecommended && <span className="text-[10px] bg-taxea-red/10 text-taxea-red px-1.5 py-0.5 rounded font-medium">Recomendado</span>}
                          {cfg.coming_soon && key !== 'csv' && <span className="text-[10px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded font-medium">Próximamente</span>}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{cfg.desc}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0 mt-0.5" />
                    </button>
                  );
                })}
              </motion.div>
            )}

            {/* Step 3: Consentimiento + datos */}
            {step === 'consent' && (
              <motion.div key="consent" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}
                className="space-y-4">
                {/* Nota conexión tipo */}
                {conexionType !== 'csv' && (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-100 flex items-start gap-2">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-600">
                      La conexión automática {conexionType === 'api' ? 'vía API' : 'Open Banking PSD2'} está en desarrollo. Añade la cuenta manualmente y usa <strong>Importar CSV</strong> para sincronizar movimientos.
                    </p>
                  </div>
                )}

                {/* PSD2 info */}
                <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 space-y-2">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-blue-600" />
                    <p className="text-xs font-semibold text-blue-700">Acceso regulado · Solo lectura</p>
                  </div>
                  <p className="text-xs text-blue-600">Taxea <strong>nunca</strong> podrá realizar pagos ni movimientos. Solo consulta.</p>
                  {PERMISOS_PSD2.map((p, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <CheckCircle className="w-3 h-3 text-blue-500 flex-shrink-0" />
                      <span className="text-xs text-blue-600">{p}</span>
                    </div>
                  ))}
                </div>

                {/* Form datos */}
                <div className="space-y-3">
                  {[
                    { key: 'iban', label: 'IBAN', placeholder: 'ES12 1234 1234 12 1234567890', mono: true },
                    { key: 'titular', label: 'Titular', placeholder: 'Nombre del titular' },
                    { key: 'saldo_disponible', label: 'Saldo inicial (€)', placeholder: '0.00', type: 'number' },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="block text-xs font-medium text-slate-600 mb-1">{f.label}</label>
                      <input type={f.type || 'text'} value={form[f.key]}
                        onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                        placeholder={f.placeholder}
                        className={cn("w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-taxea-red/30 bg-white", f.mono && "font-mono")} />
                    </div>
                  ))}
                </div>

                <label className="flex items-start gap-2 cursor-pointer">
                  <input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} className="mt-0.5 accent-taxea-red" />
                  <span className="text-xs text-slate-600">Acepto que Taxea acceda a los datos bancarios indicados de forma regulada. El consentimiento es válido 90 días y puedo revocarlo en cualquier momento.</span>
                </label>

                <button disabled={!accepted || loading} onClick={handleConnect}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold bg-taxea-red text-white disabled:opacity-40 hover:bg-taxea-red/90 transition-all flex items-center justify-center gap-2">
                  {loading
                    ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Guardando...</>
                    : `Añadir ${selected?.name}`
                  }
                </button>
              </motion.div>
            )}

            {/* Step 4: Éxito */}
            {step === 'success' && (
              <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-4 py-8 text-center">
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-emerald-600" />
                </div>
                <p className="text-sm font-semibold text-foreground">¡{selected?.name} añadido!</p>
                <p className="text-xs text-slate-400 max-w-xs">
                  {conexionType === 'csv'
                    ? 'Ahora puedes importar tus extractos CSV desde el panel de la cuenta.'
                    : 'La cuenta está activa. Importa un extracto CSV para cargar tus movimientos históricos.'}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}