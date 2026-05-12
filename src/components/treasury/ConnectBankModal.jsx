import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Shield, CheckCircle, ChevronRight, AlertCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { cn } from '@/lib/utils';

const BANKS = [
  { id: 'revolut',   name: 'Revolut Business', tipo: 'neobanco',    color: 'bg-black text-white',       badge: 'Popular' },
  { id: 'wise',      name: 'Wise Business',     tipo: 'neobanco',    color: 'bg-green-500 text-white',   badge: 'Popular' },
  { id: 'qonto',     name: 'Qonto',             tipo: 'neobanco',    color: 'bg-violet-600 text-white',  badge: 'Popular' },
  { id: 'bbva',      name: 'BBVA',              tipo: 'tradicional', color: 'bg-blue-700 text-white',    badge: null },
  { id: 'santander', name: 'Santander',         tipo: 'tradicional', color: 'bg-red-600 text-white',     badge: null },
  { id: 'caixabank', name: 'CaixaBank',         tipo: 'tradicional', color: 'bg-blue-500 text-white',    badge: null },
  { id: 'sabadell',  name: 'Sabadell',          tipo: 'tradicional', color: 'bg-sky-600 text-white',     badge: null },
  { id: 'bankinter', name: 'Bankinter',         tipo: 'tradicional', color: 'bg-orange-500 text-white',  badge: null },
  { id: 'ing',       name: 'ING',               tipo: 'tradicional', color: 'bg-orange-400 text-white',  badge: null },
  { id: 'stripe',    name: 'Stripe',            tipo: 'pasarela_pago', color: 'bg-indigo-600 text-white', badge: 'API' },
  { id: 'otro',      name: 'Otro banco',        tipo: 'otro',        color: 'bg-slate-400 text-white',   badge: null },
];

const PERMISOS_PSD2 = ['Consulta de saldos', 'Historial de movimientos (90 días)', 'Identificación de cuenta (IBAN, titular)'];

export default function ConnectBankModal({ companyId, onClose, onConnected }) {
  const [step, setStep] = useState('select'); // select | consent | form | success
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ nombre_banco: '', iban: '', titular: '', saldo_disponible: '', moneda: 'EUR' });
  const [loading, setLoading] = useState(false);
  const [accepted, setAccepted] = useState(false);

  const handleSelectBank = (bank) => {
    setSelected(bank);
    setForm(f => ({ ...f, nombre_banco: bank.name }));
    setStep('consent');
  };

  const handleConsent = () => setStep('form');

  const handleConnect = async () => {
    setLoading(true);
    await new Promise(r => setTimeout(r, 1200));
    const account = await base44.entities.BankAccount.create({
      company_id: companyId,
      nombre_banco: form.nombre_banco || selected?.name,
      proveedor: selected?.id || 'otro',
      tipo_banco: selected?.tipo || 'otro',
      iban: form.iban,
      ultimos_4: form.iban ? form.iban.slice(-4) : '',
      titular: form.titular,
      moneda: form.moneda,
      saldo_disponible: parseFloat(form.saldo_disponible) || 0,
      saldo_contable: parseFloat(form.saldo_disponible) || 0,
      estado_conexion: 'conectado',
      fecha_ultima_sync: new Date().toISOString(),
      permisos_concedidos: PERMISOS_PSD2,
    });
    setLoading(false);
    setStep('success');
    setTimeout(() => { onConnected(account); onClose(); }, 1800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Conectar cuenta bancaria</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {step === 'select' ? 'Selecciona tu banco' : step === 'consent' ? 'Consentimiento PSD2' : step === 'form' ? 'Datos de cuenta' : '¡Conectado!'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors"><X className="w-4 h-4 text-slate-400" /></button>
        </div>

        <div className="p-6">
          <AnimatePresence mode="wait">
            {step === 'select' && (
              <motion.div key="select" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
                <div className="grid grid-cols-2 gap-2.5 max-h-80 overflow-y-auto pr-1">
                  {BANKS.map(bank => (
                    <button key={bank.id} onClick={() => handleSelectBank(bank)}
                      className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all text-left group">
                      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0", bank.color)}>
                        {bank.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{bank.name}</p>
                        {bank.badge && <span className="text-[10px] bg-taxea-red/10 text-taxea-red px-1.5 rounded font-medium">{bank.badge}</span>}
                      </div>
                      <ChevronRight className="w-3 h-3 text-slate-300 group-hover:text-slate-500 ml-auto flex-shrink-0" />
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {step === 'consent' && (
              <motion.div key="consent" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-4">
                <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold", selected?.color)}>
                    {selected?.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{selected?.name}</p>
                    <p className="text-xs text-slate-400">{selected?.tipo}</p>
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 space-y-3">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-blue-600" />
                    <p className="text-xs font-semibold text-blue-700">Acceso regulado PSD2 — Solo lectura</p>
                  </div>
                  <p className="text-xs text-blue-600">Taxea solicitará acceso de solo lectura. <strong>Nunca</strong> podrá realizar pagos ni movimientos.</p>
                  <div className="space-y-1.5">
                    {PERMISOS_PSD2.map((p, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <CheckCircle className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                        <span className="text-xs text-blue-600">{p}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-100 flex items-start gap-2">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-600">El consentimiento es válido 90 días. Podrás revocarlo en cualquier momento desde Ajustes.</p>
                </div>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} className="mt-0.5 accent-taxea-red" />
                  <span className="text-xs text-slate-600">Acepto que Taxea acceda a los datos bancarios indicados de forma regulada y segura.</span>
                </label>
                <button disabled={!accepted} onClick={handleConsent}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold bg-taxea-red text-white disabled:opacity-40 hover:bg-taxea-red/90 transition-all">
                  Continuar con {selected?.name}
                </button>
              </motion.div>
            )}

            {step === 'form' && (
              <motion.div key="form" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-3">
                <p className="text-xs text-slate-500">Introduce los datos de tu cuenta para activar el seguimiento.</p>
                {[
                  { key: 'iban', label: 'IBAN', placeholder: 'ES12 1234 1234 12 1234567890', mono: true },
                  { key: 'titular', label: 'Titular', placeholder: 'Nombre del titular' },
                  { key: 'saldo_disponible', label: 'Saldo inicial (€)', placeholder: '0.00', type: 'number' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-xs font-medium text-slate-600 mb-1">{f.label}</label>
                    <input type={f.type || 'text'} value={form[f.key]} onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      className={cn("w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-taxea-red/30 bg-white", f.mono && "font-mono")} />
                  </div>
                ))}
                <button disabled={loading} onClick={handleConnect}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold bg-taxea-red text-white disabled:opacity-50 hover:bg-taxea-red/90 transition-all flex items-center justify-center gap-2">
                  {loading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Conectando...</> : `Conectar ${selected?.name}`}
                </button>
              </motion.div>
            )}

            {step === 'success' && (
              <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-4 py-8">
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-emerald-600" />
                </div>
                <p className="text-sm font-semibold text-foreground">¡{selected?.name} conectado!</p>
                <p className="text-xs text-slate-400 text-center">La cuenta ya está activa y comenzará a sincronizarse.</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}