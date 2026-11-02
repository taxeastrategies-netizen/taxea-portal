import {useState} from 'react';
import {base44} from '@/api/base44Client';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import NativeSelect from '@/components/ui/NativeSelect';
import {useAuth} from '@/lib/AuthContext';
import {toast} from 'sonner';
import {useQuery} from '@tanstack/react-query';
const euro=value=>Number(value||0).toLocaleString('es-ES',{style:'currency',currency:'EUR'});
export default function C5DeductionPanel({companyId,activities=[]}){
 const {user}=useAuth(),canConfirm=['admin','super_admin','asesor','advisor'].includes(String(user?.role||'').toLowerCase());
 const [form,setForm]=useState({year:new Date().getFullYear(),useConfirmedPercent:false,confirmedPercent:'',activityId:'',kind:'prorata',assetId:'',realEstate:false,definitivePercent:0,initialPercent:'',reason:'',sourceOverrides:{},investmentQualificationConfirmed:false});
 const [preview,setPreview]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [visibleRows,setVisibleRows]=useState(100);
 const context=useQuery({queryKey:['c5-deduction-context',companyId,form.year],enabled:!!companyId,queryFn:async()=>{const r=await base44.functions.invoke('accountingOperations',{action:'c5_deduction_context',companyId,year:form.year});return r?.data||r;},staleTime:30000});
 const set=(key,value)=>{setForm(current=>({...current,[key]:value}));setPreview(null);};
 const editSource=(sourceId,key,value)=>{const id=sourceId.replace('InvoiceTaxLine:','');setForm(current=>({...current,sourceOverrides:{...current.sourceOverrides,[id]:{...current.sourceOverrides[id],[key]:value}}}));setPreview(current=>({...current,requiresReview:true,fingerprint:null,dirty:true}));};
 const run=async(action)=>{
  setBusy(true);setError('');
  try{
   const payload={...form,companyId,action,confirmReviewed:action==='c5_deduction_post',expectedFingerprint:preview?.fingerprint};
   if(payload.initialPercent==='')delete payload.initialPercent;
   const response=await base44.functions.invoke('accountingOperations',payload),data=response?.data||response;
   if(data.error||data.success===false)throw Error(data.error||'No se pudo completar la regularización.');
   setPreview(data);setVisibleRows(100);
   if(action==='c5_deduction_post')toast.success(data.noChanges||data.alreadyPosted?'El ajuste ya está registrado. No se duplica.':'Regularización confirmada con asiento separado.');
  }catch(failure){setError(failure?.response?.data?.error||failure.message||'No se pudo calcular.');}
  finally{setBusy(false);}
 };
 return <section className="min-w-0 w-full max-w-full rounded-xl border bg-card p-4 space-y-4" aria-label="Regularización de deducciones">
  <div><h4 className="font-semibold">Regularización de deducciones · IVA e IGIC</h4><p className="mt-1 text-xs text-muted-foreground">Analiza la prorrata general/especial o un bien de inversión. El asesor confirma el ajuste; se conserva cada factura, subcuenta y asiento original. Un sector agrupa sus actividades; sin sector se analiza la actividad elegida.</p></div>
  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
   <label className="text-xs space-y-1"><span>Ejercicio</span><Input aria-label="Ejercicio regularización" type="number" min="2000" max="2100" value={form.year} onChange={e=>set('year',Number(e.target.value))}/></label>
   <label className="text-xs space-y-1"><span>Actividad / sector</span><NativeSelect aria-label="Actividad regularización" value={form.activityId} onChange={e=>set('activityId',e.target.value)} className="w-full min-h-9 rounded border bg-background px-2"><option value="">Selecciona actividad</option>{activities.filter(a=>['iva','igic'].includes(a.indirectTax)).map(a=><option key={a.id} value={a.id}>{a.name}{a.sectorId?' · '+a.sectorId:''}</option>)}</NativeSelect></label>
   <label className="text-xs space-y-1"><span>Tipo de regularización</span><NativeSelect aria-label="Tipo de regularización" value={form.kind} onChange={e=>set('kind',e.target.value)} className="w-full min-h-9 rounded border bg-background px-2"><option value="prorata">Prorrata anual</option><option value="investment">Bien de inversión</option></NativeSelect></label>
   <label className="text-xs space-y-1"><span>Motivo / evidencia revisada</span><Input aria-label="Motivo regularización" value={form.reason} onChange={e=>setForm(current=>({...current,reason:e.target.value}))} placeholder="Cierre anual, censo, hechos comprobados…"/></label>
  </div>
  {form.kind==='prorata'&&<div className="flex flex-wrap items-center gap-3 text-xs"><label className="flex gap-2"><input type="checkbox" checked={form.useConfirmedPercent} onChange={e=>set('useConfirmedPercent',e.target.checked)}/>Usar porcentaje definitivo confirmado por el asesor en un supuesto específico.</label>{form.useConfirmedPercent&&<Input aria-label="Prorrata definitiva confirmada" type="number" min="0" max="100" value={form.confirmedPercent} onChange={e=>set('confirmedPercent',e.target.value)} className="max-w-32"/>}</div>}
  {form.kind==='investment'&&<div className="grid gap-3 sm:grid-cols-2">
   <label className="text-xs space-y-1"><span>Activo contable con factura de origen</span><NativeSelect aria-label="Activo regularización" value={form.assetId} onChange={e=>set('assetId',e.target.value)} className="w-full min-h-9 rounded border bg-background px-2"><option value="">Selecciona activo</option>{(context.data?.assets||[]).filter(a=>a.sourceInvoiceId).map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</NativeSelect></label>
   <label className="text-xs space-y-1"><span>Porcentaje definitivo del año de adquisición</span><Input aria-label="Porcentaje inicial inversión" type="number" min="0" max="100" value={form.initialPercent} onChange={e=>set('initialPercent',e.target.value)}/></label>
   <label className="text-xs space-y-1"><span>Porcentaje definitivo del ejercicio regularizado</span><Input aria-label="Porcentaje definitivo inversión" type="number" min="0" max="100" value={form.definitivePercent} onChange={e=>set('definitivePercent',Number(e.target.value))}/></label>
   <label className="text-xs space-y-1"><span>Clase de bien</span><NativeSelect aria-label="Clase inversión" value={form.realEstate?'property':'movable'} onChange={e=>set('realEstate',e.target.value==='property')} className="w-full min-h-9 rounded border bg-background px-2"><option value="movable">Mueble · periodo de 5 años</option><option value="property">Terreno / edificación · 10 años</option></NativeSelect></label>
   <label className="flex gap-2 text-xs"><input type="checkbox" checked={form.investmentQualificationConfirmed} onChange={e=>set('investmentQualificationConfirmed',e.target.checked)}/>He verificado que cumple la definición fiscal de bien de inversión.</label>
  </div>}
  <div className="flex flex-col gap-2 sm:flex-row"><Button variant="outline" disabled={busy||!form.activityId} onClick={()=>run('c5_deduction_preview')}>{busy?'Procesando…':'Analizar regularización'}</Button><Button disabled={busy||!canConfirm||!preview||!form.reason.trim()||(!preview.delta&&!preview.fiscalDelta)||preview.requiresReview||!preview.fingerprint} onClick={()=>run('c5_deduction_post')}>Confirmar ajuste del asesor</Button></div>
  {!canConfirm&&<p className="text-xs text-muted-foreground">Puedes consultar y simular; la confirmación contable corresponde al asesor o administrador.</p>}
  {error&&<p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">{error}</p>}
  {preview?.reviewMessage&&<p role="status" className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">{preview.reviewMessage}</p>}
  {preview?.dirty&&<p role="status" className="text-xs">Clasificaciones modificadas. Pulsa Analizar regularización para recalcular antes de confirmar.</p>}
  {preview&&<div className="space-y-3">
   <div className="grid gap-2 sm:grid-cols-3"><p className="rounded-lg bg-muted p-3 text-sm">Prorrata definitiva: <strong>{preview.calculation?.percent==null?'—':preview.calculation.percent+' %'}</strong></p><p className="rounded-lg bg-muted p-3 text-sm">Ajustes ya registrados: <strong>{euro(preview.postedAmount)}</strong></p><p className="rounded-lg bg-primary/10 p-3 text-sm">Ajuste contable: <strong>{euro(preview.delta)}</strong></p></div>
   {preview.calculation?.mandatorySpecial&&<p role="status" className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">La deducción general supera en al menos un 10 % la especial: se propone aplicar la especial por obligación legal. No son diez puntos porcentuales.</p>}
   {preview.calculation?.transitionalRepep&&<p className="text-xs">Transición REPEP 2026: prorrata del 1 de enero al 30 de junio; las cuotas del segundo semestre no se recuperan.</p>}
   <p className="text-sm">Regularización fiscal del modelo: <strong>{euro(preview.fiscalDelta??preview.delta)}</strong>. El ajuste contable puede diferir en RECC cuando cambió la prorrata provisional entre ejercicios.</p><p className="text-xs text-muted-foreground">{preview.activityNames?.join(' · ')} · {preview.start} → {preview.end} · {preview.calculation?.legalBasis}</p>
   <details><summary className="cursor-pointer text-sm font-medium">Ver origen del cálculo ({preview.sourceRows?.length||0} líneas)</summary><div className="overflow-auto"><table className="w-full min-w-[650px] text-xs"><thead><tr><th className="p-2 text-left">Factura</th><th>Fecha</th><th>Base</th><th>Cuota</th><th>Deducción provisional</th><th>Destino / volumen</th></tr></thead><tbody>{preview.sourceRows?.slice(0,visibleRows).map((row,index)=><tr key={row.sourceId+'-'+index} className="border-t"><td className="p-2">{row.number}</td><td>{row.date||'—'}</td><td>{euro(row.base)}</td><td>{euro(row.quota)}</td><td>{euro(row.deductibleQuota)}</td><td>{['emitida','recibida'].includes(row.direction)?<NativeSelect aria-label={'Clasificación '+row.number} className="rounded border bg-background p-1" value={form.sourceOverrides[row.sourceId.replace('InvoiceTaxLine:','')]?.[row.direction==='emitida'?'volumeClass':'deductionUse']??(row.direction==='emitida'?row.volumeClass:row.deductionUse)??''} onChange={e=>editSource(row.sourceId,row.direction==='emitida'?'volumeClass':'deductionUse',e.target.value)}><option value="">Selecciona clasificación</option>{(row.direction==='emitida'?[['with_right','Con derecho'],['without_right','Sin derecho'],['exclude','Excluida del volumen']]:[['shared','Común'],['exclusive_right','Exclusivo con derecho'],['exclusive_no_right','Exclusivo sin derecho']]).map(([value,label])=><option key={value} value={value}>{label}</option>)}</NativeSelect>:'Bien de inversión'}</td></tr>)}</tbody></table></div>{preview.sourceRows?.length>visibleRows&&<Button variant="outline" onClick={()=>setVisibleRows(count=>count+100)}>Mostrar 100 líneas más</Button>}</details>
   {preview.noJournalRequired&&<p role="status" className="text-xs text-primary">Regularización fiscal registrada. No necesita un segundo asiento porque la cuota contable ya está correcta.</p>}
   {preview.journalEntryId&&<p role="status" className="text-xs text-primary">Regularización registrada en el Diario{preview.entryNumber?' · asiento '+preview.entryNumber:''}. Destino fiscal: modelo {preview.targetModel||'correspondiente'}. No presenta ningún impuesto.</p>}
  </div>}
 </section>;
}
