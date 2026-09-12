import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Database, Loader2, SearchCheck, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useCompanyContext } from '@/lib/useCompanyContext';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import FiscalProfileManager from '@/components/ajustes/FiscalProfileManager';
import FiscalTestSimulator from '@/components/ajustes/FiscalTestSimulator';
import { useTaxWorkspace } from './useTaxWorkspace';

function apiErrorMessage(error, fallback) {
  const detail = /** @type {any} */ (error);
  return detail?.response?.data?.error || detail?.message || fallback;
}

export default function ConfiguracionFiscal() {
  const { user } = useAuth();
  const { company } = useCompanyContext(user);
  const companyId = company?.id;
  const currentYear = new Date().getFullYear();
  const [auditYear, setAuditYear] = useState(currentYear);
  const [auditResult, setAuditResult] = useState(/** @type {any} */ (null));
  const [auditError, setAuditError] = useState('');
  const workspace = useTaxWorkspace(companyId, currentYear);
  const historicalAudit = useMutation({
    mutationFn: async () => (await base44.functions.invoke('taxModelOperations', { action: 'historical_fiscal_dry_run', companyId, ejercicio: auditYear, periodo: 'Anual' })).data,
    onSuccess: data => { setAuditResult(data); setAuditError(''); },
    onError: error => setAuditError(apiErrorMessage(error, 'No se pudo ejecutar el análisis histórico.')),
  });

  if (!companyId) return <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">Selecciona una empresa para configurar su fiscalidad.</div>;

  const profile = workspace.data?.profile;
  const activeModels = workspace.data?.models || [];
  const validated = profile?.profileStatus === 'validado_asesor';

  return <div className="mx-auto max-w-6xl space-y-5">
    <div><h2 className="text-base font-semibold text-slate-900">Configuración fiscal maestra</h2><p className="mt-1 text-sm text-slate-500">Esta configuración alimenta facturas, OCR, contabilidad, libros, calendario, modelos, validaciones y arrastres. Ya no existe una segunda lista manual de modelos desconectada.</p></div>

    <div className="grid gap-3 md:grid-cols-3">
      <div className={`rounded-xl border p-4 ${validated ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}><div className="flex items-center gap-2">{validated ? <CheckCircle2 className="h-4 w-4 text-emerald-700" /> : <AlertTriangle className="h-4 w-4 text-amber-700" />}<p className="text-sm font-semibold">Perfil fiscal</p></div><p className="mt-2 text-xs text-slate-600">{validated ? 'Validado por asesor' : profile ? 'Pendiente de validación profesional' : 'Sin perfil fiscal creado'}</p></div>
      <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-4"><div className="flex items-center gap-2"><Database className="h-4 w-4 text-cyan-700" /><p className="text-sm font-semibold">Fuente de verdad</p></div><p className="mt-2 text-xs text-slate-600">{activeModels.length} obligación(es) activas sincronizadas desde el perfil y el criterio confirmado.</p></div>
      <div className="rounded-xl border border-violet-200 bg-violet-50 p-4"><div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-violet-700" /><p className="text-sm font-semibold">Motor conectado</p></div><p className="mt-2 text-xs text-slate-600">Territorio {profile?.mainTerritory?.replace(/_/g, ' ') || 'pendiente'} · {String(profile?.indirectTaxDefault || 'sin impuesto').toUpperCase()} · motor {workspace.data?.engineVersion || 'cargando'}</p></div>
    </div>

    <FiscalProfileManager company={company} onChanged={() => workspace.refetch()} />

    <section className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex items-center gap-2"><SearchCheck className="h-4 w-4 text-indigo-700" /><h3 className="text-sm font-semibold text-slate-900">Reconstrucción histórica segura</h3></div><p className="mt-1 max-w-3xl text-xs leading-5 text-slate-600">Analiza facturas, líneas fiscales, asientos, totales y duplicados del ejercicio. Es siempre una simulación: no modifica ni elimina documentos de usuarios.</p></div><div className="flex gap-2"><select value={auditYear} onChange={event => { setAuditYear(Number(event.target.value)); setAuditResult(null); }} className="h-9 rounded-lg border border-indigo-200 bg-white px-3 text-sm">{[currentYear-3,currentYear-2,currentYear-1,currentYear].map(value => <option key={value}>{value}</option>)}</select><Button type="button" size="sm" onClick={() => historicalAudit.mutate()} disabled={historicalAudit.isPending}>{historicalAudit.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <SearchCheck className="mr-1 h-3.5 w-3.5" />}Analizar sin escribir</Button></div></div>
      {auditError && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">{auditError}</p>}
      {auditResult && <div className="mt-4"><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{Object.entries(auditResult.stats || {}).map(([key,value]) => <div key={key} className="rounded-lg border border-indigo-100 bg-white p-3"><p className="text-[11px] text-slate-500">{key.replace(/([A-Z])/g,' $1')}</p><p className="mt-1 text-xl font-bold text-slate-900">{value}</p></div>)}</div><p className="mt-3 text-xs font-medium text-emerald-700">{auditResult.message}</p></div>}
    </section>

    <section className="space-y-3"><div><h3 className="text-sm font-semibold text-slate-900">Prueba controlada de reglas</h3><p className="mt-1 text-xs text-slate-500">Comprueba una factura hipotética contra el perfil antes de aplicar el criterio a documentos reales.</p></div><FiscalTestSimulator companyId={companyId} /></section>

    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-800">Guardar el perfil no presenta impuestos ni modifica documentos históricos. Los cambios afectan a nuevas propuestas y a los cálculos que se vuelvan a ejecutar; las declaraciones ya presentadas permanecen bloqueadas como snapshots.</div>
  </div>;
}

