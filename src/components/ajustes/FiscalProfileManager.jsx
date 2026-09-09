import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import iaeCatalog from '@/data/iaeCatalog.json';
import { AlertTriangle, BookOpenCheck, ChevronDown, ChevronUp, ExternalLink, Loader2, Plus, Save, Search, ShieldCheck, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

const unwrap = (response) => response?.data || response || {};
const invoke = async (payload) => {
  const data = unwrap(await base44.functions.invoke('fiscalOperations', payload));
  if (data.error || data.success === false) throw new Error(data.error || 'No se pudo completar la operacion fiscal.');
  return data;
};
const emptyProfile = (company) => ({
  fiscalName: company?.razon_social || company?.nombre_comercial || '', taxId: company?.nif_cif || '', entityType: 'autonomo',
  mainTerritory: String(company?.tipo_impuesto || '').toLowerCase() === 'igic' ? 'canarias' : 'peninsula_baleares',
  taxAuthority: String(company?.tipo_impuesto || '').toLowerCase() === 'igic' ? 'atc' : 'aeat', filingFrequency: 'trimestral',
  indirectTaxDefault: String(company?.tipo_impuesto || '').toLowerCase() === 'igic' ? 'igic' : 'iva', defaultVatRate: 21, defaultIgicRate: 7,
  subjectToIRPF: false, irpfEstimation: 'no_aplica', retainedIncomePercent: 0, model130ExemptionConfirmed: false,
  repepStatus: 'no_aplica', profileStatus: 'pendiente_revision', censusValidationSource: 'pendiente_confirmar', active: true,
});
const emptyActivity = (profile) => ({
  name: '', iaeCode: '', iaeActivityCode: '', startDate: '', territory: profile?.mainTerritory || 'peninsula_baleares',
  activityType: 'empresarial', indirectTax: profile?.indirectTaxDefault === 'igic' ? 'igic' : 'iva', indirectTaxRegime: 'general',
  incomeDefaultTreatment: 'subject_taxed', expenseDefaultTreatment: 'subject_taxed', deductionRight: 'pleno', proRataPercent: 100,
  defaultTaxRate: profile?.indirectTaxDefault === 'igic' ? 7 : 21, defaultWithholdingRate: 0, automationLevel: 'proponer_revisar', active: true,
  exemptionKey: '', exemptionLegalBasis: '', newProfessionalRateConfirmed: false, hasIntraCommunityOperations: false,
});

export default function FiscalProfileManager({ company, user }) {
  const companyId = company?.id;
  const queryClient = useQueryClient();
  const [profileDraft, setProfileDraft] = useState(null);
  const [activityDraft, setActivityDraft] = useState(null);
  const [iaeSearch, setIaeSearch] = useState('');
  const [showSources, setShowSources] = useState(false);
  const bundle = useQuery({ queryKey: ['fiscal-bundle', companyId], enabled: Boolean(companyId), queryFn: () => invoke({ action: 'bundle', companyId }), staleTime: 0 });
  const catalog = useQuery({ queryKey: ['fiscal-catalog', companyId], enabled: Boolean(companyId), queryFn: () => invoke({ action: 'catalog', companyId }), staleTime: 60 * 60 * 1000 });
  const profile = profileDraft || bundle.data?.profile || emptyProfile(company);
  const activities = bundle.data?.activities || [];
  const recommendations = bundle.data?.recommendations || [];
  const mutate = useMutation({
    mutationFn: invoke,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['fiscal-bundle', companyId] }),
    onError: (error) => toast.error(error.message),
  });
  const set = (key, value) => setProfileDraft({ ...profile, [key]: value });
  const iaeMatches = useMemo(() => {
    const term = iaeSearch.trim().toLocaleLowerCase('es');
    if (term.length < 2) return [];
    return iaeCatalog.entries.filter(item => `${item.activityCode} ${item.iaeCode} ${item.description}`.toLocaleLowerCase('es').includes(term)).slice(0, 40);
  }, [iaeSearch]);
  const regimes = (catalog.data?.regimes?.[activityDraft?.indirectTax || 'iva'] || []).map(([value, label]) => ({ value, label }));
  const operations = (catalog.data?.operations || []).map(([value, label]) => ({ value, label }));
  const exemptions = (catalog.data?.exemptionKeys?.[activityDraft?.indirectTax || 'iva'] || []).map(([value, label]) => ({ value, label }));

  if (!companyId) return <div className="rounded-xl border p-6 text-sm text-muted-foreground">Selecciona una empresa.</div>;
  if (bundle.isLoading || catalog.isLoading) return <div className="p-12 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /><p className="mt-2 text-sm text-muted-foreground">Cargando configuracion fiscal…</p></div>;
  if (bundle.isError || catalog.isError) return <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{bundle.error?.message || catalog.error?.message}</div>;

  const saveProfile = async () => {
    await mutate.mutateAsync({ action: 'save_profile', companyId, profile });
    setProfileDraft(null);
    toast.success('Perfil fiscal guardado con trazabilidad.');
  };
  const saveActivity = async () => {
    await mutate.mutateAsync({ action: 'save_activity', companyId, activity: activityDraft });
    setActivityDraft(null); setIaeSearch('');
    toast.success('Actividad fiscal guardada.');
  };

  return <div className="space-y-5">
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
      <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 text-primary" /><div><h3 className="font-semibold">Perfil fiscal maestro</h3><p className="mt-1 text-xs text-muted-foreground">El cliente o su asesor debe confirmar territorio, actividades, regimenes y obligaciones. Las reglas automaticas son propuestas versionadas; cada factura permite correccion manual motivada.</p><div className="mt-2 flex flex-wrap gap-2"><Badge variant="outline">{bundle.data?.ruleSetVersion}</Badge><Badge variant={profile.profileStatus === 'validado_asesor' ? 'default' : 'secondary'}>{profile.profileStatus === 'validado_asesor' ? 'Validado por asesor' : 'Pendiente de validacion'}</Badge></div></div></div>
    </div>

    <section className="rounded-xl border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between"><div><h4 className="font-semibold">1. Identidad, territorio y vigencia</h4><p className="text-xs text-muted-foreground">La fiscalidad no se infiere solo por domicilio; confirma el censo y la actividad real.</p></div><Button onClick={saveProfile} disabled={mutate.isPending}><Save className="mr-2 h-4 w-4" />Guardar perfil</Button></div>
      <div className="grid gap-3 md:grid-cols-3">
        <Field label="Nombre fiscal"><Input value={profile.fiscalName || ''} onChange={e => set('fiscalName', e.target.value)} /></Field>
        <Field label="NIF/CIF"><Input value={profile.taxId || ''} onChange={e => set('taxId', e.target.value)} /></Field>
        <Field label="Tipo de entidad"><Select value={profile.entityType || 'autonomo'} onValueChange={v => set('entityType', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[['autonomo','Autonomo / persona fisica'],['sociedad','Sociedad mercantil'],['comunidad_bienes','Comunidad de bienes'],['sociedad_civil','Sociedad civil'],['asociacion_fundacion','Asociacion / fundacion'],['entidad_publica','Entidad publica'],['otra','Otra']].map(([v,l])=><SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select></Field>
        <Field label="Territorio principal"><Select value={profile.mainTerritory || 'peninsula_baleares'} onValueChange={v => set('mainTerritory', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[['peninsula_baleares','Peninsula y Baleares - IVA'],['canarias','Canarias - IGIC'],['ceuta_melilla','Ceuta y Melilla'],['ue','Union Europea'],['no_ue','Fuera de la UE']].map(([v,l])=><SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select></Field>
        <Field label="Impuesto indirecto principal"><Select value={profile.indirectTaxDefault || 'iva'} onValueChange={v => set('indirectTaxDefault', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[['iva','IVA'],['igic','IGIC'],['mixto','Mixto'],['no_aplica','No aplica']].map(([v,l])=><SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select></Field>
        <Field label="Validacion censal"><Select value={profile.censusValidationSource || 'pendiente_confirmar'} onValueChange={v => set('censusValidationSource', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[['pendiente_confirmar','Pendiente de confirmar'],['modelo_036','Modelo 036'],['modelo_400','Modelo 400 ATC'],['certificado_censal','Certificado censal'],['criterio_asesor','Criterio del asesor']].map(([v,l])=><SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select></Field>
        <Field label="Estado del perfil"><Select value={profile.profileStatus || 'pendiente_revision'} onValueChange={v => set('profileStatus', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="incompleto">Incompleto</SelectItem><SelectItem value="pendiente_revision">Pendiente de revision</SelectItem><SelectItem value="validado_asesor">Validado por asesor</SelectItem></SelectContent></Select></Field>
      </div>
      <div className="flex flex-wrap gap-5"><Check checked={profile.isLargeCompany} onChange={v=>set('isLargeCompany',v)} label="Gran empresa" /><Check checked={profile.isREDEME} onChange={v=>set('isREDEME',v)} label="REDEME" /><Check checked={profile.usesSII} onChange={v=>set('usesSII',v)} label="SII" /><Check checked={profile.usesVeriFactu} onChange={v=>set('usesVeriFactu',v)} label="VERI*FACTU" /></div>
    </section>

    <section className="rounded-xl border bg-card p-5 space-y-4">
      <div><h4 className="font-semibold">2. IRPF y retenciones</h4><p className="text-xs text-muted-foreground">El 7% profesional no se aplica por defecto: debe confirmarse el nuevo inicio y que el destinatario sea retenedor. El modelo 130 solo se excluye cuando se confirma el umbral del 70% aplicable.</p></div>
      <div className="grid gap-3 md:grid-cols-4">
        <Check checked={profile.subjectToIRPF} onChange={v=>set('subjectToIRPF',v)} label="Sujeto a IRPF" />
        <Field label="Metodo"><Select value={profile.irpfEstimation || 'no_aplica'} onValueChange={v=>set('irpfEstimation',v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[['no_aplica','No aplica'],['directa_normal','Directa normal'],['directa_simplificada','Directa simplificada'],['objetiva_modulos','Estimacion objetiva / modulos']].map(([v,l])=><SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select></Field>
        <Field label="Ingresos sometidos a retencion (%)"><Input type="number" min="0" max="100" value={profile.retainedIncomePercent ?? 0} onChange={e=>set('retainedIncomePercent',Number(e.target.value))} /></Field>
        <Check checked={profile.model130ExemptionConfirmed} onChange={v=>set('model130ExemptionConfirmed',v)} label="Exclusion 130 revisada" />
      </div>
    </section>

    <section className="rounded-xl border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between"><div><h4 className="font-semibold">3. Actividades economicas e IAE oficial</h4><p className="text-xs text-muted-foreground">Catalogo AEAT {iaeCatalog.schemaVersion}: {iaeCatalog.count.toLocaleString('es-ES')} actividades publicadas. Selecciona una actividad por cada sector diferenciado.</p></div><Button variant="outline" onClick={()=>setActivityDraft(emptyActivity(profile))}><Plus className="mr-2 h-4 w-4" />Añadir actividad</Button></div>
      {activities.length === 0 && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800"><AlertTriangle className="mr-2 inline h-4 w-4" />Sin actividad validada, el motor fiscal bloqueara la contabilizacion automatica.</div>}
      <div className="space-y-2">{activities.map(item=><div key={item.id} className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 ${item.active === false ? 'opacity-50' : ''}`}><div><p className="text-sm font-medium">{item.name}</p><p className="text-xs text-muted-foreground">{item.iaeActivityCode || 'Sin codigo AEAT'} · IAE {item.iaeCode || 'sin epigrafe'} · {String(item.indirectTax || '').toUpperCase()} · {item.indirectTaxRegime}</p></div><div className="flex gap-2"><Button size="sm" variant="outline" onClick={()=>{setActivityDraft({...item});setIaeSearch(item.iaeCode || item.name)}}>Editar</Button>{item.active !== false && <Button size="sm" variant="ghost" className="text-red-600" onClick={async()=>{await mutate.mutateAsync({action:'deactivate_activity',companyId,activityId:item.id});toast.success('Actividad desactivada sin borrar el historico.')}}><Trash2 className="mr-1 h-3 w-3" />Desactivar</Button>}</div></div>)}</div>
      {activityDraft && <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-4">
        <div className="flex justify-between"><h5 className="font-medium">{activityDraft.id ? 'Editar actividad' : 'Nueva actividad'}</h5><Button size="sm" variant="ghost" onClick={()=>setActivityDraft(null)}>Cerrar</Button></div>
        <Field label="Buscar actividad oficial AEAT"><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={iaeSearch} onChange={e=>setIaeSearch(e.target.value)} placeholder="Descripcion, codigo de actividad o epigrafe IAE" /></div>{iaeMatches.length>0&&<div className="mt-1 max-h-56 overflow-auto rounded-lg border bg-background">{iaeMatches.map(item=><button type="button" key={item.id} className="block w-full border-b px-3 py-2 text-left text-xs hover:bg-muted" onClick={()=>{setActivityDraft({...activityDraft,name:item.description,iaeCode:item.iaeCode,iaeActivityCode:item.activityCode});setIaeSearch(`${item.activityCode} · ${item.iaeCode || 'sin IAE'} · ${item.description}`)}}><span className="font-mono font-semibold">{item.activityCode} · {item.iaeCode || 'sin epigrafe'}</span> — {item.description}</button>)}</div>}</Field>
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Nombre"><Input value={activityDraft.name||''} onChange={e=>setActivityDraft({...activityDraft,name:e.target.value})} /></Field>
          <Field label="Tipo de actividad"><Select value={activityDraft.activityType||'empresarial'} onValueChange={v=>setActivityDraft({...activityDraft,activityType:v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[['empresarial','Empresarial'],['profesional','Profesional'],['agricola_ganadera','Agricola / ganadera'],['forestal','Forestal'],['comercial_minorista','Comercio minorista'],['inmobiliaria','Inmobiliaria'],['sanitaria','Sanitaria'],['educativa','Educativa'],['financiera_seguros','Financiera / seguros'],['cultural_deportiva','Cultural / deportiva'],['hosteleria','Hosteleria'],['ecommerce','E-commerce'],['servicios_digitales','Servicios digitales'],['construccion_inmuebles','Construccion / inmuebles'],['transporte','Transporte'],['otra','Otra']].map(([v,l])=><SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select></Field>
          <Field label="Fecha de inicio"><Input type="date" value={activityDraft.startDate||''} onChange={e=>setActivityDraft({...activityDraft,startDate:e.target.value})} /></Field>
          <Field label="Impuesto"><Select value={activityDraft.indirectTax||'iva'} onValueChange={v=>setActivityDraft({...activityDraft,indirectTax:v,indirectTaxRegime:'general',defaultTaxRate:v==='igic'?7:21})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="iva">IVA</SelectItem><SelectItem value="igic">IGIC</SelectItem><SelectItem value="no_aplica">No aplica</SelectItem><SelectItem value="mixto">Mixto</SelectItem></SelectContent></Select></Field>
          <Field label="Regimen"><Select value={activityDraft.indirectTaxRegime||'general'} onValueChange={v=>setActivityDraft({...activityDraft,indirectTaxRegime:v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{regimes.map(item=><SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></Field>
          <Field label="Derecho a deduccion"><Select value={activityDraft.deductionRight||'pleno'} onValueChange={v=>setActivityDraft({...activityDraft,deductionRight:v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[['pleno','Pleno'],['sin_derecho','Sin derecho'],['prorrata_general','Prorrata general'],['prorrata_especial','Prorrata especial'],['sector_diferenciado','Sector diferenciado'],['limitado','Limitado']].map(([v,l])=><SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent></Select></Field>
          <Field label="Prorrata / deducible (%)"><Input type="number" min="0" max="100" value={activityDraft.proRataPercent??100} onChange={e=>setActivityDraft({...activityDraft,proRataPercent:Number(e.target.value)})} /></Field>
          <Field label="Tratamiento ventas"><Select value={activityDraft.incomeDefaultTreatment||'subject_taxed'} onValueChange={v=>setActivityDraft({...activityDraft,incomeDefaultTreatment:v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{operations.map(item=><SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></Field>
          <Field label="Tratamiento compras"><Select value={activityDraft.expenseDefaultTreatment||'subject_taxed'} onValueChange={v=>setActivityDraft({...activityDraft,expenseDefaultTreatment:v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{operations.map(item=><SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></Field>
          <Field label="Causa de exencion"><Select value={activityDraft.exemptionKey||'ninguna'} onValueChange={v=>setActivityDraft({...activityDraft,exemptionKey:v==='ninguna'?'':v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ninguna">No aplica</SelectItem>{exemptions.map(item=><SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></Field>
          <Field label="Fundamento legal / criterio"><Input value={activityDraft.exemptionLegalBasis||''} onChange={e=>setActivityDraft({...activityDraft,exemptionLegalBasis:e.target.value})} placeholder="Articulo y motivo revisado" /></Field>
          <Field label="Automatizacion"><Select value={activityDraft.automationLevel||'proponer_revisar'} onValueChange={v=>setActivityDraft({...activityDraft,automationLevel:v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="automatico">Automatico solo reglas inequívocas</SelectItem><SelectItem value="proponer_revisar">Proponer y revisar</SelectItem><SelectItem value="siempre_revisar">Siempre revisar</SelectItem></SelectContent></Select></Field>
        </div>
        {activityDraft.indirectTaxRegime==='pequeno_empresario_igic'&&<div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">REPEP: ventas/servicios propios exentos, IGIC soportado no deducible, modelo 425 anual y 412 solo si nace una obligacion ocasional. En 2026 la inclusion excepcional entre 30.000 y 50.000 euros exige opcion censal valida; desde 2027 el limite general pasa a 50.000 euros.</div>}
        <div className="flex flex-wrap gap-4"><Check checked={activityDraft.newProfessionalRateConfirmed} onChange={v=>setActivityDraft({...activityDraft,newProfessionalRateConfirmed:v})} label="7% profesional de nuevo inicio confirmado" /><Check checked={activityDraft.hasIntraCommunityOperations} onChange={v=>setActivityDraft({...activityDraft,hasIntraCommunityOperations:v})} label="Opera intracomunitariamente" /></div>
        <div className="flex justify-end"><Button onClick={saveActivity} disabled={mutate.isPending||!activityDraft.name}>{mutate.isPending?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<Save className="mr-2 h-4 w-4"/>}Guardar actividad</Button></div>
      </div>}
    </section>

    <section className="rounded-xl border bg-card p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="font-semibold">4. Obligaciones fiscales propuestas</h4><p className="text-xs text-muted-foreground">Se añaden de forma idempotente; no se desactiva ninguna obligacion existente. Las marcadas para revisar requieren criterio del asesor.</p></div><Button variant="outline" onClick={async()=>{const d=await mutate.mutateAsync({action:'sync_obligations',companyId,apply:true});toast.success(`${d.created} modelos creados y ${d.updated} actualizados.`)}} disabled={mutate.isPending||!bundle.data?.profile}><BookOpenCheck className="mr-2 h-4 w-4" />Sincronizar obligaciones</Button></div>
      <div className="grid gap-2 md:grid-cols-2">{recommendations.map(item=><div key={item.code} className="rounded-lg border p-3"><div className="flex items-center justify-between"><p className="text-sm font-semibold">Modelo {item.code}</p><Badge variant={item.certainty==='recommended'?'default':'secondary'}>{item.certainty==='recommended'?'Propuesto':'Revisar'}</Badge></div><p className="text-xs">{item.name}</p><p className="mt-1 text-[11px] text-muted-foreground">{item.reasons.join(' · ')}</p></div>)}</div>
      <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4"><Check checked={profile.paysEmploymentOrProfessionalIncome} onChange={v=>set('paysEmploymentOrProfessionalIncome',v)} label="Paga trabajo/profesionales (111/190)" /><Check checked={profile.paysUrbanRent} onChange={v=>set('paysUrbanRent',v)} label="Paga alquiler urbano (115/180)" /><Check checked={profile.paysCapitalIncome} onChange={v=>set('paysCapitalIncome',v)} label="Paga rentas de capital (123/193)" /><Check checked={profile.hasNonResidentOperations} onChange={v=>set('hasNonResidentOperations',v)} label="Operaciones con no residentes" /><Check checked={profile.hasThirdPartyReporting} onChange={v=>set('hasThirdPartyReporting',v)} label="Declaracion terceros 347/415" /></div>
    </section>

    <section className="rounded-xl border bg-card p-5">
      <button className="flex w-full items-center justify-between text-left" onClick={()=>setShowSources(!showSources)}><div><h4 className="font-semibold">5. Fuentes y control normativo</h4><p className="text-xs text-muted-foreground">Normas y guias oficiales usadas por el motor. Deben revisarse cuando cambie la normativa.</p></div>{showSources?<ChevronUp className="h-4 w-4"/>:<ChevronDown className="h-4 w-4"/>}</button>
      {showSources&&<div className="mt-4 grid gap-2 md:grid-cols-2">{(bundle.data?.sources||[]).map(source=><a key={source.id} href={source.url} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-lg border p-3 text-xs hover:bg-muted"><span>{source.title}</span><ExternalLink className="h-3 w-3"/></a>)}<a href={iaeCatalog.sourceFile} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-lg border p-3 text-xs hover:bg-muted"><span>Fichero AEAT del catalogo IAE integrado</span><ExternalLink className="h-3 w-3"/></a></div>}
    </section>
  </div>;
}

function Field({ label, children }) { return <div className="space-y-1"><Label className="text-xs">{label}</Label>{children}</div>; }
function Check({ checked, onChange, label }) { return <label className="flex items-center gap-2 text-xs"><Checkbox checked={Boolean(checked)} onCheckedChange={value=>onChange(value===true)} /><span>{label}</span></label>; }

