import { AlertTriangle, CheckCircle2, Database, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { useCompanyContext } from '@/lib/useCompanyContext';
import FiscalProfileManager from '@/components/ajustes/FiscalProfileManager';
import FiscalTestSimulator from '@/components/ajustes/FiscalTestSimulator';
import { useTaxWorkspace } from './useTaxWorkspace';

export default function ConfiguracionFiscal() {
  const { user } = useAuth();
  const { company } = useCompanyContext(user);
  const companyId = company?.id;
  const workspace = useTaxWorkspace(companyId, new Date().getFullYear());

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

    <FiscalProfileManager company={company} user={user} onChanged={() => workspace.refetch()} />

    <section className="space-y-3"><div><h3 className="text-sm font-semibold text-slate-900">Prueba controlada de reglas</h3><p className="mt-1 text-xs text-slate-500">Comprueba una factura hipotética contra el perfil antes de aplicar el criterio a documentos reales.</p></div><FiscalTestSimulator companyId={companyId} /></section>

    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-800">Guardar el perfil no presenta impuestos ni modifica documentos históricos. Los cambios afectan a nuevas propuestas y a los cálculos que se vuelvan a ejecutar; las declaraciones ya presentadas permanecen bloqueadas como snapshots.</div>
  </div>;
}

