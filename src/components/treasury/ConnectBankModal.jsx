import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Shield, CheckCircle, ChevronRight, AlertCircle, FileSpreadsheet, Wifi, Zap, ArrowLeft, ExternalLink, Key, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { cn } from '@/lib/utils';

// Bancos con API directa real
const BANKS = [
  {
    id: 'revolut', name: 'Revolut Business', tipo: 'neobanco',
    color: 'bg-black text-white', conexion: 'api_token',
    badge: 'API Directa', badgeColor: 'bg-emerald-50 text-emerald-600',
    desc: 'Conecta tu cuenta Revolut Business vía API. Saldo y movimientos en tiempo real.',
    apiDocs: 'https://developer.revolut.com/docs/business/business-api',
    tokenLabel: 'Access Token Revolut Business',
    tokenPlaceholder: 'ey... (JWT token de Revolut)',
    tokenHelp: 'Obtén tu token en developer.revolut.com → Business API → Producción',
  },
  {
    id: 'wise', name: 'Wise Business', tipo: 'neobanco',
    color: 'bg-green-500 text-white', conexion: 'api_token',
    badge: 'API Directa', badgeColor: 'bg-emerald-50 text-emerald-600',
    desc: 'Conecta tu cuenta Wise Business. Saldo y transferencias al instante.',
    apiDocs: 'https://docs.wise.com/api-docs/features/personal-tokens',
    tokenLabel: 'API Token Wise',
    tokenPlaceholder: 'Token de acceso Wise (read-only)',
    tokenHelp: 'wise.com → Ajustes → API Tokens → Crear token de solo lectura',
  },
  {
    id: 'qonto', name: 'Qonto', tipo: 'neobanco',
    color: 'bg-violet-600 text-white', conexion: 'api_token',
    badge: 'API Directa', badgeColor: 'bg-emerald-50 text-emerald-600',
    desc: 'Conecta tu cuenta Qonto con API oficial. Movimientos y saldo en tiempo real.',
    apiDocs: 'https://api-doc.qonto.com/',
    tokenLabel: 'Qonto API Key',
    tokenPlaceholder: 'Secret key de Qonto',
    tokenHelp: 'app.qonto.com → Ajustes → Integraciones → API Keys',
    extraField: { key: 'qonto_login', label: 'Qonto Login (slug org)', placeholder: 'mi-empresa-1234' },
  },
  {
    id: 'bbva', name: 'BBVA', tipo: 'tradicional',
    color: 'bg-blue-700 text-white', conexion: 'open_banking',
    badge: 'Open Banking PSD2', badgeColor: 'bg-blue-50 text-blue-600',
    institution_id: 'BBVA_BBBVESMMXXX',
    desc: 'Autoriza el acceso a BBVA mediante Open Banking regulado PSD2. Solo lectura.',
  },
  {
    id: 'santander', name: 'Santander', tipo: 'tradicional',
    color: 'bg-red-600 text-white', conexion: 'open_banking',
    badge: 'Open Banking PSD2', badgeColor: 'bg-blue-50 text-blue-600',
    institution_id: 'SANTANDER_BSCHESMMXXX',
    desc: 'Autoriza Santander con PSD2. Historial de 90 días y saldo en tiempo real.',
  },
  {
    id: 'caixabank', name: 'CaixaBank', tipo: 'tradicional',
    color: 'bg-blue-500 text-white', conexion: 'open_banking',
    badge: 'Open Banking PSD2', badgeColor: 'bg-blue-50 text-blue-600',
    institution_id: 'CAIXABANK_CAIXESBBXXX',
    desc: 'Conecta CaixaBank de forma segura y regulada mediante PSD2.',
  },
  {
    id: 'sabadell', name: 'Sabadell', tipo: 'tradicional',
    color: 'bg-sky-600 text-white', conexion: 'open_banking',
    badge: 'Open Banking PSD2', badgeColor: 'bg-blue-50 text-blue-600',
    institution_id: 'SABADELL_BSABESBBXXX',
    desc: 'Acceso regulado a Sabadell con historial de movimientos PSD2.',
  },
  {
    id: 'bankinter', name: 'Bankinter', tipo: 'tradicional',
    color: 'bg-orange-500 text-white', conexion: 'open_banking',
    badge: 'Open Banking PSD2', badgeColor: 'bg-blue-50 text-blue-600',
    institution_id: 'BANKINTER_BKBKESMMXXX',
    desc: 'Conecta Bankinter vía Open Banking. Saldo y movimientos automáticos.',
  },
  {
    id: 'ing', name: 'ING', tipo: 'tradicional',
    color: 'bg-orange-400 text-white', conexion: 'open_banking',
    badge: 'Open Banking PSD2', badgeColor: 'bg-blue-50 text-blue-600',
    institution_id: 'ING_INGDESMMXXX',
    desc: 'Conecta ING con PSD2. Sincronización automática de movimientos.',
  },
  {
    id: 'stripe', name: 'Stripe', tipo: 'pasarela_pago',
    color: 'bg-indigo-600 text-white', conexion: 'api_token',
    badge: 'API', badgeColor: 'bg-indigo-50 text-indigo-600',
    desc: 'Conecta tu cuenta Stripe para ver cobros y pagos automáticamente.',
    apiDocs: 'https://stripe.com/docs/keys',
    tokenLabel: 'Stripe Secret Key',
    tokenPlaceholder: 'sk_live_...',
    tokenHelp: 'dashboard.stripe.com → Desarrolladores → Claves API → Clave secreta',
  },
  {
    id: 'otro', name: 'Otro banco (CSV)', tipo: 'otro',
    color: 'bg-slate-400 text-white', conexion: 'csv',
    badge: 'Importar CSV', badgeColor: 'bg-violet-50 text-violet-600',
    desc: 'Importa movimientos de cualquier banco desde un extracto CSV/Excel.',
  },
];

const PERMISOS = ['Consulta de saldos (solo lectura)', 'Historial de movimientos 90 días', 'Identificación de cuenta (IBAN/titular)'];

export default function ConnectBankModal({ companyId, onClose, onConnected }) {
  const [step, setStep] = useState('select');
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ iban: '', titular: '', saldo_disponible: '', moneda: 'EUR', api_token: '', qonto_login: '' });
  const [loading, setLoading] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [oauthPending, setOauthPending] = useState(false);
  const [oauthLink, setOauthLink] = useState(null);
  const [createdAccount, setCreatedAccount] = useState(null);

  const handleSelectBank = (bank) => {
    setSelected(bank);
    setForm(f => ({ ...f, nombre_banco: bank.name }));
    setStep('configure');
  };

  const goBack = () => {
    if (step === 'configure') setStep('select');
    else if (step === 'oauth_waiting') setStep('configure');
  };

  // Para bancos API token (Revolut, Wise, Qonto, Stripe)
  const handleApiTokenConnect = async () => {
    if (!form.api_token || !accepted) return;
    setLoading(true);

    const account = await base44.entities.BankAccount.create({
      company_id: companyId,
      nombre_banco: selected.name,
      proveedor: selected.id,
      tipo_banco: selected.tipo,
      iban: form.iban,
      ultimos_4: form.iban ? form.iban.replace(/\s/g, '').slice(-4) : '',
      titular: form.titular,
      moneda: form.moneda || 'EUR',
      saldo_disponible: parseFloat(form.saldo_disponible) || 0,
      saldo_contable: parseFloat(form.saldo_disponible) || 0,
      estado_conexion: 'sincronizando',
      proveedor_integracion: selected.id,
      permisos_concedidos: PERMISOS,
    });

    // Guardar token cifrado como nota interna y hacer primera sincronización
    const payload = {
      action: 'api_sync',
      bank_account_id: account.id,
      company_id: companyId,
      proveedor: selected.id,
      access_token: form.api_token,
    };
    if (selected.id === 'qonto' && form.qonto_login) {
      payload.qonto_login = form.qonto_login;
    }

    const res = await base44.functions.invoke('bankSync', payload);
    setLoading(false);

    if (res.data?.ok) {
      await base44.functions.invoke('bankSync', {
        action: 'create_consent',
        bank_account_id: account.id,
        company_id: companyId,
        proveedor: selected.id,
        tipo_conexion: 'api_directa',
        permisos: PERMISOS,
      });
      setStep('success');
      setTimeout(() => onConnected(account), 1800);
    } else {
      await base44.entities.BankAccount.update(account.id, { estado_conexion: 'error' });
      alert(`Error conectando: ${res.data?.error || 'Verifica el token API'}`);
    }
  };

  // Para bancos Open Banking PSD2 (BBVA, Santander, CaixaBank, etc.)
  const handleOpenBankingConnect = async () => {
    if (!accepted) return;
    setLoading(true);

    const account = await base44.entities.BankAccount.create({
      company_id: companyId,
      nombre_banco: selected.name,
      proveedor: selected.id,
      tipo_banco: selected.tipo,
      iban: form.iban,
      titular: form.titular,
      moneda: 'EUR',
      saldo_disponible: 0,
      estado_conexion: 'pendiente',
      proveedor_integracion: 'gocardless',
      permisos_concedidos: PERMISOS,
    });

    setCreatedAccount(account);

    // Crear link de autorización en GoCardless/Nordigen
    const res = await base44.functions.invoke('bankSync', {
      action: 'create_gocardless_link',
      bank_account_id: account.id,
      company_id: companyId,
      institution_id: selected.institution_id,
      redirect_url: window.location.origin + '/finance/treasury',
    });

    setLoading(false);

    if (res.data?.link) {
      setOauthLink(res.data.link);
      setStep('oauth_waiting');
      // Abrir autorización del banco en ventana nueva
      window.open(res.data.link, '_blank', 'width=900,height=700');
    } else {
      await base44.entities.BankAccount.update(account.id, { estado_conexion: 'error' });
      alert(`Error creando autorización: ${res.data?.error || 'Verifica configuración GoCardless'}`);
    }
  };

  // Para bancos CSV
  const handleCsvConnect = async () => {
    if (!accepted) return;
    setLoading(true);
    const account = await base44.entities.BankAccount.create({
      company_id: companyId,
      nombre_banco: form.nombre_banco || 'Mi banco',
      proveedor: 'otro',
      tipo_banco: 'otro',
      iban: form.iban,
      titular: form.titular,
      moneda: form.moneda || 'EUR',
      saldo_disponible: parseFloat(form.saldo_disponible) || 0,
      estado_conexion: 'pendiente',
    });
    setLoading(false);
    setStep('success');
    setTimeout(() => onConnected(account), 1800);
  };

  // Una vez vuelve del banco, sincronizar
  const handleSyncAfterOAuth = async () => {
    if (!createdAccount) return;
    setLoading(true);
    const res = await base44.functions.invoke('bankSync', {
      action: 'api_sync',
      bank_account_id: createdAccount.id,
      company_id: companyId,
      proveedor: selected.id,
      // requisition_id se guardó en proveedor_integracion al crear el link
    });
    setLoading(false);
    if (res.data?.ok) {
      setStep('success');
      setTimeout(() => onConnected(createdAccount), 1800);
    } else {
      alert(`Error al sincronizar: ${res.data?.error || 'Inténtalo de nuevo'}`);
    }
  };

  const canSubmit = () => {
    if (!accepted) return false;
    if (selected?.conexion === 'api_token') return !!form.api_token;
    if (selected?.conexion === 'open_banking') return true;
    if (selected?.conexion === 'csv') return true;
    return false;
  };

  const handleConnect = () => {
    if (selected?.conexion === 'api_token') return handleApiTokenConnect();
    if (selected?.conexion === 'open_banking') return handleOpenBankingConnect();
    if (selected?.conexion === 'csv') return handleCsvConnect();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            {step !== 'select' && step !== 'success' && (
              <button onClick={goBack} className="p-1 hover:bg-slate-100 rounded-lg">
                <ArrowLeft className="w-4 h-4 text-slate-400" />
              </button>
            )}
            <div>
              <p className="text-sm font-semibold text-foreground">Conectar cuenta bancaria</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {step === 'select' ? 'Elige tu banco o pasarela de pago' :
                  step === 'configure' ? `Configurar ${selected?.name}` :
                    step === 'oauth_waiting' ? `Autorizar ${selected?.name} en tu banco` :
                      '¡Conectado!'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg"><X className="w-4 h-4 text-slate-400" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait">

            {/* STEP 1: Seleccionar banco */}
            {step === 'select' && (
              <motion.div key="select" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}>
                <div className="space-y-1.5">
                  {BANKS.map(bank => (
                    <button key={bank.id} onClick={() => handleSelectBank(bank)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all text-left group">
                      <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0", bank.color)}>
                        {bank.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{bank.name}</p>
                        <p className="text-xs text-slate-400 truncate">{bank.desc}</p>
                      </div>
                      <span className={cn("text-[10px] px-2 py-0.5 rounded-lg font-semibold flex-shrink-0", bank.badgeColor)}>{bank.badge}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 flex-shrink-0" />
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* STEP 2: Configurar conexión */}
            {step === 'configure' && selected && (
              <motion.div key="configure" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}
                className="space-y-4">

                {/* Tipo de conexión */}
                <div className={cn("p-4 rounded-xl border space-y-2",
                  selected.conexion === 'api_token' ? "bg-emerald-50 border-emerald-200" :
                    selected.conexion === 'open_banking' ? "bg-blue-50 border-blue-200" : "bg-violet-50 border-violet-200"
                )}>
                  <div className="flex items-center gap-2">
                    {selected.conexion === 'api_token' ? <Zap className="w-4 h-4 text-emerald-600" /> :
                      selected.conexion === 'open_banking' ? <Wifi className="w-4 h-4 text-blue-600" /> :
                        <FileSpreadsheet className="w-4 h-4 text-violet-600" />}
                    <p className={cn("text-xs font-semibold",
                      selected.conexion === 'api_token' ? "text-emerald-700" :
                        selected.conexion === 'open_banking' ? "text-blue-700" : "text-violet-700"
                    )}>
                      {selected.conexion === 'api_token' ? 'Conexión API Directa — Tiempo real' :
                        selected.conexion === 'open_banking' ? 'Open Banking PSD2 — Solo lectura regulado' :
                          'Importación manual CSV/Excel'}
                    </p>
                  </div>
                  <p className={cn("text-xs",
                    selected.conexion === 'api_token' ? "text-emerald-600" :
                      selected.conexion === 'open_banking' ? "text-blue-600" : "text-violet-600"
                  )}>{selected.desc}</p>
                  {selected.apiDocs && (
                    <a href={selected.apiDocs} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:underline">
                      <ExternalLink className="w-3 h-3" /> Ver documentación API
                    </a>
                  )}
                </div>

                {/* Open Banking: info flujo OAuth */}
                {selected.conexion === 'open_banking' && (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2">
                    <Shield className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700">
                      Se abrirá la web oficial de <strong>{selected.name}</strong> para que autorices el acceso. Taxea nunca ve tu contraseña bancaria.
                    </p>
                  </div>
                )}

                {/* Campos API token */}
                {selected.conexion === 'api_token' && (
                  <div className="space-y-3">
                    {selected.extraField && (
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">{selected.extraField.label}</label>
                        <input type="text" value={form.qonto_login}
                          onChange={e => setForm(f => ({ ...f, qonto_login: e.target.value }))}
                          placeholder={selected.extraField.placeholder}
                          className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-taxea-red/30 bg-white" />
                      </div>
                    )}
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        <Key className="w-3 h-3 inline mr-1" />{selected.tokenLabel}
                      </label>
                      <input type="password" value={form.api_token}
                        onChange={e => setForm(f => ({ ...f, api_token: e.target.value }))}
                        placeholder={selected.tokenPlaceholder}
                        className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-taxea-red/30 bg-white font-mono" />
                      <p className="text-[10px] text-slate-400 mt-1">{selected.tokenHelp}</p>
                    </div>
                  </div>
                )}

                {/* Datos de la cuenta (IBAN, titular) */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-slate-500">Datos de la cuenta (opcionales)</p>
                  <input type="text" value={form.iban} onChange={e => setForm(f => ({ ...f, iban: e.target.value }))}
                    placeholder="IBAN (ES12 1234...)" className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-taxea-red/30" />
                  <input type="text" value={form.titular} onChange={e => setForm(f => ({ ...f, titular: e.target.value }))}
                    placeholder="Nombre del titular" className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-taxea-red/30" />
                </div>

                {/* Permisos */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                  <p className="text-xs font-semibold text-slate-600 flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" /> Taxea solo accede a:</p>
                  {PERMISOS.map((p, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <CheckCircle className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                      <span className="text-xs text-slate-500">{p}</span>
                    </div>
                  ))}
                </div>

                <label className="flex items-start gap-2 cursor-pointer">
                  <input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} className="mt-0.5 accent-taxea-red" />
                  <span className="text-xs text-slate-600">Autorizo a Taxea a acceder a los datos indicados de forma regulada. El acceso es de solo lectura y puedo revocarlo en cualquier momento.</span>
                </label>

                <button disabled={!canSubmit() || loading} onClick={handleConnect}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold bg-taxea-red text-white disabled:opacity-40 hover:bg-taxea-red/90 transition-all flex items-center justify-center gap-2">
                  {loading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> {selected.conexion === 'open_banking' ? 'Preparando autorización...' : 'Conectando y sincronizando...'}</>
                    : selected.conexion === 'open_banking' ? `Autorizar con ${selected.name}` :
                      selected.conexion === 'csv' ? `Añadir cuenta` : `Conectar y sincronizar`
                  }
                </button>
              </motion.div>
            )}

            {/* STEP 3: Esperando OAuth (bancos PSD2) */}
            {step === 'oauth_waiting' && (
              <motion.div key="oauth_waiting" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}
                className="space-y-5">
                <div className="flex flex-col items-center text-center py-4">
                  <div className="w-14 h-14 rounded-2xl bg-blue-100 flex items-center justify-center mb-3">
                    <ExternalLink className="w-7 h-7 text-blue-600" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">Autoriza en {selected?.name}</p>
                  <p className="text-xs text-slate-400 max-w-xs mt-1">
                    Se ha abierto la página oficial de {selected?.name}. Acepta el acceso de solo lectura y vuelve aquí.
                  </p>
                </div>
                {oauthLink && (
                  <a href={oauthLink} target="_blank" rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-blue-200 text-sm text-blue-600 hover:bg-blue-50 transition-all">
                    <ExternalLink className="w-3.5 h-3.5" /> Abrir de nuevo la autorización
                  </a>
                )}
                <button onClick={handleSyncAfterOAuth} disabled={loading}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold bg-taxea-red text-white disabled:opacity-40 hover:bg-taxea-red/90 transition-all flex items-center justify-center gap-2">
                  {loading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Sincronizando datos...</>
                    : '✓ Ya autoricé — Sincronizar ahora'
                  }
                </button>
                <p className="text-xs text-slate-400 text-center">Pulsa el botón de arriba después de completar la autorización en tu banco.</p>
              </motion.div>
            )}

            {/* STEP 4: Éxito */}
            {step === 'success' && (
              <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-4 py-8 text-center">
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">¡{selected?.name} conectado!</p>
                  <p className="text-xs text-slate-400 max-w-xs mt-1">
                    {selected?.conexion === 'api_token'
                      ? 'Saldo y movimientos sincronizados. A partir de ahora se actualiza automáticamente.'
                      : selected?.conexion === 'open_banking'
                        ? 'Cuenta autorizada y sincronizada. Los datos se actualizarán con cada sync.'
                        : 'Cuenta añadida. Importa un extracto CSV para cargar tus movimientos.'}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}