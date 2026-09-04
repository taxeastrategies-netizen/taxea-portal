import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, Building2, CheckCircle, FileSpreadsheet, Loader2, Search, Shield, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const PERMISSIONS = ['Consulta de saldos', 'Datos identificativos de la cuenta', 'Movimientos bancarios'];

function unwrap(response) {
  return response?.data ?? response;
}

function errorMessage(error, fallback) {
  return error?.response?.data?.error || error?.data?.error || error?.message || fallback;
}

export default function ConnectBankModal({ companyId, onClose, onConnected }) {
  const [mode, setMode] = useState('bank');
  const [institutions, setInstitutions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [psuType, setPsuType] = useState('business');
  const [error, setError] = useState('');
  const [csvForm, setCsvForm] = useState({ nombre_banco: '', iban: '', titular: '', saldo: '' });

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const status = unwrap(await base44.functions.invoke('openBanking', { action: 'status' }));
        if (!active) return;
        setConfigured(Boolean(status?.configured));
        if (!status?.configured) {
          setError('La conexión bancaria está preparada, pero falta registrar la aplicación de Enable Banking en Base44.');
          return;
        }
        const result = unwrap(await base44.functions.invoke('openBanking', { action: 'institutions', company_id: companyId, country: 'ES' }));
        if (!result?.ok) throw new Error(result?.error || 'No se pudo cargar el catálogo de bancos.');
        if (active) setInstitutions(result.institutions || []);
      } catch (caught) {
        if (active) setError(errorMessage(caught, 'No se pudo consultar el servicio Open Banking.'));
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [companyId]);

  const sandboxCatalog = useMemo(() =>
    institutions.some(item => /mock aspsp/i.test(item.name || '')),
    [institutions]
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return institutions;
    return institutions.filter(item => [item.name, item.bic].some(value => value?.toLowerCase().includes(needle)));
  }, [institutions, query]);

  const connectBank = async () => {
    if (!selected || !accepted || submitting) return;
    setSubmitting(true);
    setError('');
    let authWindow = null;
    try {
      authWindow = window.open('about:blank', 'taxea_open_banking');
      if (!authWindow && window.top !== window.self) {
        throw new Error('El navegador ha bloqueado la ventana bancaria. Abre taxeaportal.com directamente o permite ventanas emergentes.');
      }
      const result = unwrap(await base44.functions.invoke('openBanking', {
        action: 'create_link',
        company_id: companyId,
        institution_id: selected.id,
        redirect_url: `${window.location.origin}/finance/treasury`,
        psu_type: psuType,
      }));
      if (!result?.ok || !result?.link) throw new Error(result?.error || 'No se pudo iniciar la autorización bancaria.');
      if (authWindow && !authWindow.closed) {
        authWindow.opener = null;
        authWindow.location.replace(result.link);
        onClose?.();
      } else {
        window.location.assign(result.link);
      }
    } catch (caught) {
      if (authWindow && !authWindow.closed) authWindow.close();
      setError(errorMessage(caught, 'No se pudo iniciar la autorización bancaria.'));
      setSubmitting(false);
    }
  };

  const createCsvAccount = async () => {
    if (!accepted || !csvForm.nombre_banco.trim() || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const iban = csvForm.iban.replace(/\s/g, '');
      const account = await base44.entities.BankAccount.create({
        company_id: companyId,
        nombre_banco: csvForm.nombre_banco.trim(),
        proveedor: 'otro',
        tipo_banco: 'otro',
        iban,
        ultimos_4: iban.slice(-4),
        titular: csvForm.titular.trim(),
        moneda: 'EUR',
        saldo_disponible: Number(csvForm.saldo) || 0,
        saldo_contable: Number(csvForm.saldo) || 0,
        estado_conexion: 'pendiente',
        origen_datos: 'csv',
      });
      onConnected?.(account);
    } catch (caught) {
      setError(errorMessage(caught, 'No se pudo añadir la cuenta manual.'));
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4">
      <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/70 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <p className="text-sm font-semibold text-foreground">Conectar una cuenta bancaria</p>
            <p className="mt-0.5 text-xs text-slate-400">Acceso de solo lectura mediante Open Banking PSD2 · la autorización se abre en una pestaña segura</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-slate-100"><X className="h-4 w-4 text-slate-400" /></button>
        </div>

        <div className="flex gap-1 border-b border-slate-100 bg-slate-50 px-6 py-2">
          <button onClick={() => setMode('bank')} className={`rounded-lg px-3 py-2 text-xs font-medium ${mode === 'bank' ? 'bg-white text-foreground shadow-sm' : 'text-slate-500'}`}>
            Banco conectado
          </button>
          <button onClick={() => setMode('csv')} className={`rounded-lg px-3 py-2 text-xs font-medium ${mode === 'csv' ? 'bg-white text-foreground shadow-sm' : 'text-slate-500'}`}>
            Cuenta por CSV
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {mode === 'bank' ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 p-3">
                <Shield className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" />
                <p className="text-xs leading-5 text-blue-700">Taxea nunca recibe tus claves bancarias ni puede ordenar pagos. La autorización se realiza en la web de tu banco y puede revocarse en cualquier momento.</p>
              </div>

              {loading ? (
                <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /> Consultando bancos disponibles…</div>
              ) : !configured ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
                    <div>
                      <p className="text-sm font-semibold text-amber-800">Activación externa pendiente</p>
                      <p className="mt-1 text-xs leading-5 text-amber-700">{error}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setPsuType('business')}
                      className={`rounded-xl border px-3 py-2 text-xs font-medium ${psuType === 'business' ? 'border-taxea-red/40 bg-taxea-red/5 text-taxea-red' : 'border-slate-200 text-slate-500'}`}>Cuenta de empresa</button>
                    <button type="button" onClick={() => setPsuType('personal')}
                      className={`rounded-xl border px-3 py-2 text-xs font-medium ${psuType === 'personal' ? 'border-taxea-red/40 bg-taxea-red/5 text-taxea-red' : 'border-slate-200 text-slate-500'}`}>Cuenta particular</button>
                  </div>
                  {sandboxCatalog && (
                    <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
                      <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
                      <p className="text-xs leading-5 text-amber-800"><span className="font-semibold">Catálogo de pruebas.</span> Enable Banking limita los bancos disponibles en Sandbox. Al usar una aplicación Production, Taxea mostrará automáticamente todas las entidades AIS que el proveedor habilite para España y el contrato contratado.</p>
                    </div>
                  )}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar banco en España…"
                      className="h-10 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-taxea-red/20" />
                  </div>
                  <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
                    {filtered.map(institution => (
                      <button key={institution.id} onClick={() => setSelected(institution)}
                        className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all ${selected?.id === institution.id ? 'border-taxea-red/40 bg-taxea-red/5 ring-2 ring-taxea-red/10' : 'border-slate-200 hover:bg-slate-50'}`}>
                        {institution.logo ? <img src={institution.logo} alt="" className="h-9 w-9 rounded-lg object-contain" /> : <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100"><Building2 className="h-4 w-4 text-slate-500" /></div>}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">{institution.name}</p>
                          <p className="text-[10px] text-slate-400">Histórico sujeto a disponibilidad del banco{institution.max_access_valid_for_days ? ` · acceso hasta ${institution.max_access_valid_for_days} días` : ''}{institution.beta ? ' · conexión en beta' : ''}</p>
                        </div>
                        {selected?.id === institution.id && <CheckCircle className="h-4 w-4 text-taxea-red" />}
                      </button>
                    ))}
                    {!filtered.length && <p className="py-10 text-center text-sm text-slate-400">No se encontraron bancos con ese nombre.</p>}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-xl border border-violet-100 bg-violet-50 p-3">
                <FileSpreadsheet className="mt-0.5 h-4 w-4 text-violet-600" />
                <p className="text-xs leading-5 text-violet-700">Añade la cuenta y después importa el extracto. Estos datos se mostrarán como origen CSV, separados de la conexión bancaria automática.</p>
              </div>
              <input value={csvForm.nombre_banco} onChange={event => setCsvForm(value => ({ ...value, nombre_banco: event.target.value }))} placeholder="Nombre del banco *" className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:ring-2 focus:ring-taxea-red/20" />
              <input value={csvForm.iban} onChange={event => setCsvForm(value => ({ ...value, iban: event.target.value }))} placeholder="IBAN (opcional)" className="h-10 w-full rounded-xl border border-slate-200 px-3 font-mono text-sm outline-none focus:ring-2 focus:ring-taxea-red/20" />
              <input value={csvForm.titular} onChange={event => setCsvForm(value => ({ ...value, titular: event.target.value }))} placeholder="Titular (opcional)" className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:ring-2 focus:ring-taxea-red/20" />
              <input type="number" step="0.01" value={csvForm.saldo} onChange={event => setCsvForm(value => ({ ...value, saldo: event.target.value }))} placeholder="Saldo inicial (opcional)" className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:ring-2 focus:ring-taxea-red/20" />
            </div>
          )}

          {error && configured && <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3"><AlertCircle className="mt-0.5 h-4 w-4 text-red-500" /><p className="text-xs text-red-700">{error}</p></div>}

          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="mb-2 text-xs font-semibold text-slate-700">Permisos solicitados</p>
            {PERMISSIONS.map(item => <p key={item} className="flex items-center gap-2 py-0.5 text-xs text-slate-500"><CheckCircle className="h-3 w-3 text-emerald-500" />{item}</p>)}
          </div>
          <label className="mt-4 flex cursor-pointer items-start gap-2">
            <input type="checkbox" checked={accepted} onChange={event => setAccepted(event.target.checked)} className="mt-0.5 accent-taxea-red" />
            <span className="text-xs leading-5 text-slate-600">Autorizo este acceso de solo lectura para la empresa activa y confirmo que puedo revocarlo desde Tesorería.</span>
          </label>
        </div>

        <div className="border-t border-slate-100 px-6 py-4">
          <button disabled={submitting || !accepted || (mode === 'bank' ? !configured || !selected : !csvForm.nombre_banco.trim())}
            onClick={mode === 'bank' ? connectBank : createCsvAccount}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-taxea-red py-2.5 text-sm font-semibold text-white transition-all hover:bg-taxea-red/90 disabled:cursor-not-allowed disabled:opacity-40">
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? 'Preparando conexión…' : mode === 'bank' ? `Autorizar${selected ? ` con ${selected.name}` : ''}` : 'Añadir cuenta para importar CSV'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

