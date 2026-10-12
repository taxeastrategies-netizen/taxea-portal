import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import InvoiceFiscalReview from './InvoiceFiscalReview';
const money=value=>new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(Number(value||0));
const err=error=>error?.response?.data?.error||error?.message||'No se pudo completar la revisión.';
async function fiscal(body) {
  const response=await base44.functions.invoke('fiscalOperations',body),result=response?.data??response;
  if(!result?.success||result.error) throw new Error(result?.error||'Error de revisión fiscal.');
  return result;
}
export default function FiscalReviewInbox({companyId}) {
  const [page,setPage]=useState(0),[filters,setFilters]=useState({type:'',from:'',to:''});
  const [excluded,setExcluded]=useState(new Set()),[processing,setProcessing]=useState(false);
  const [selected,setSelected]=useState(new Set()),[allFiltered,setAllFiltered]=useState(false);
  const [batch,setBatch]=useState(null),[running,setRunning]=useState(false),[error,setError]=useState('');
  const [results,setResults]=useState([]),[resultPage,setResultPage]=useState(0),[moreResults,setMoreResults]=useState(false);
  const [recoveryReason,setRecoveryReason]=useState(''),[stopped,setStopped]=useState(false);
  const generation=useRef(0);
  const query=useQuery({queryKey:['fiscal-review-inbox',companyId,filters,page],enabled:Boolean(companyId),staleTime:15000,
    queryFn:async()=>{const response=await base44.functions.invoke('invoiceOperations',{action:'list_fiscal_review',company_id:companyId,filters,page});
      const result=response?.data??response;if(!result?.ok) throw new Error(result?.error||'No se pudo cargar la bandeja.');return result;}});
  const jobs=useQuery({queryKey:['fiscal-review-batches',companyId],enabled:Boolean(companyId),staleTime:15000,
    queryFn:()=>fiscal({action:'list_review_batches',companyId})});
  useEffect(()=>{generation.current++;setBatch(null);setRunning(false);setSelected(new Set());setExcluded(new Set());setAllFiltered(false);setPage(0);setResults([]);setError('');},[companyId]);
  useEffect(()=>{const refresh=()=>query.refetch();window.addEventListener('financials:refresh',refresh);
    return()=>window.removeEventListener('financials:refresh',refresh);},[query.refetch]);
  const loadResults=async(job,p=0)=>{
    const data=await fiscal({action:'get_review_batch',companyId,batchId:job.id,resultPage:p});
    setBatch(data.batch);setResults(data.results||[]);setResultPage(p);setMoreResults(data.hasMore);
  };
  useEffect(()=>{
    if(!running||!batch?.id) return;
    let cancelled=false;const version=generation.current,jobId=batch.id;
    (async()=>{
      try{
        while(!cancelled&&generation.current===version){
          setProcessing(true);
          const data=await fiscal({action:'process_review_batch',companyId,batchId:jobId});
          setProcessing(false);
          if(generation.current===version) setBatch(previous=>previous?.id===jobId?data.batch:previous);
          if(cancelled||generation.current!==version) break;
          if(data.lastResult) setResults(previous=>[data.lastResult,...previous].slice(0,50));
          if(['completed','failed'].includes(data.batch.status)) {
            setRunning(false);await Promise.all([query.refetch(),jobs.refetch()]);await loadResults(data.batch);break;
          }
        }
      }catch(e){if(!cancelled&&generation.current===version){setError(err(e));setRunning(false);}}
      finally{if(generation.current===version)setProcessing(false);}
    })();
    return()=>{cancelled=true;};
  },[running,batch?.id,companyId]);
  const rows=query.data?.invoices||[];
  const changeFilter=(key,value)=>{setFilters(old=>({...old,[key]:value}));setPage(0);setSelected(new Set());setExcluded(new Set());setAllFiltered(false);};
  const toggle=id=>{if(allFiltered){setExcluded(old=>{const next=new Set(old);next.has(id)?next.delete(id):next.add(id);return next;});return;}setSelected(old=>{const next=new Set(old);next.has(id)?next.delete(id):next.add(id);return next;});};
  const selectPage=checked=>{if(allFiltered){setExcluded(old=>{const next=new Set(old);rows.forEach(row=>checked?next.delete(row.id):next.add(row.id));return next;});return;}setSelected(old=>{const next=new Set(old);rows.forEach(row=>checked?next.add(row.id):next.delete(row.id));return next;});};
  const createBatch=async(criteria,invoiceIds)=>{
    setError('');
    const data=await fiscal({action:'create_review_batch',companyId,requestId:crypto.randomUUID(),confirmReviewed:true,criteria,
      allFiltered:invoiceIds?false:allFiltered,excludedIds:invoiceIds?[]:[...excluded],filters,invoiceIds:invoiceIds||[...selected]});
    setBatch(data.batch);setResults([]);setExcluded(new Set());setSelected(new Set());setAllFiltered(false);setRunning(true);await jobs.refetch();
  };
  const failedIds=results.filter(row=>row.status==='failed').map(row=>row.invoice_id);
  return <section className="rounded-xl border border-slate-200 bg-white p-5">
    <h2 className="font-semibold text-slate-900">Revisión fiscal del asesor</h2>
    <p className="mt-1 text-xs text-slate-600">El criterio del asesor prevalece sobre las propuestas del perfil. Revisión individual o por lotes, con trazabilidad y sin duplicar asientos.</p>
    <div className="my-4 flex flex-wrap items-end gap-3">
      <label className="text-xs">Tipo<select aria-label="Tipo de factura" className="mt-1 block rounded border p-2" value={filters.type} onChange={e=>changeFilter('type',e.target.value)}>
        <option value="">Emitidas y recibidas</option><option value="emitida">Emitidas</option><option value="recibida">Recibidas</option></select></label>
      <label className="text-xs">Desde<input aria-label="Desde" type="date" className="mt-1 block rounded border p-2" value={filters.from} onChange={e=>changeFilter('from',e.target.value)} /></label>
      <label className="text-xs">Hasta<input aria-label="Hasta" type="date" className="mt-1 block rounded border p-2" value={filters.to} onChange={e=>changeFilter('to',e.target.value)} /></label>
      <button type="button" className="rounded border px-3 py-2 text-xs" onClick={()=>query.refetch()}>Actualizar pendientes</button>
    </div>
    {query.isLoading&&<p className="text-sm text-slate-500">Cargando pendientes…</p>}
    {(query.isError||error)&&<div role="alert" className="my-3 rounded bg-red-50 p-3 text-sm text-red-700">{error||err(query.error)}</div>}
    <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 p-3 text-xs">
      <label className="flex gap-2"><input type="checkbox" aria-label="Seleccionar página" checked={rows.length>0&&rows.every(row=>allFiltered?!excluded.has(row.id):selected.has(row.id))} onChange={e=>selectPage(e.target.checked)} />Seleccionar página</label>
      <button type="button" disabled={!rows.length} className="font-semibold text-cyan-700 disabled:opacity-50" onClick={()=>{setAllFiltered(true);setSelected(new Set());setExcluded(new Set());}}>Seleccionar TODO lo filtrado (incluye otras páginas)</button>
      <button type="button" onClick={()=>{setAllFiltered(false);setSelected(new Set());setExcluded(new Set());}}>Limpiar selección</button>
      <span>{allFiltered?'Todas las pendientes filtradas'+(excluded.size?' excepto '+excluded.size:''):selected.size+' seleccionadas'}</span>
      {(allFiltered||selected.size>0)&&rows[0]&&!running&&!processing&&<InvoiceFiscalReview key={companyId+filters.type} companyId={companyId} invoice={rows[0]} advisorAccess bulkCount={allFiltered?-1:selected.size} onBulkConfirm={createBatch} />}
    </div>
    {!query.isLoading&&!rows.length&&<p className="text-sm text-slate-500">No hay propuestas pendientes con estos filtros.</p>}
    <div className="space-y-2">{rows.map(invoice=><div key={invoice.id} className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50/40 p-3">
      <label className="flex min-w-0 items-center gap-3">
        <input type="checkbox" aria-label={'Seleccionar factura '+(invoice.numero_factura||invoice.id)} checked={allFiltered?!excluded.has(invoice.id):selected.has(invoice.id)} onChange={()=>toggle(invoice.id)} />
        <span><span className="block text-sm font-semibold">{invoice.numero_factura||'Sin número'} · {invoice.tipo==='recibida'?'Recibida':'Emitida'}</span>
        <span className="block text-xs text-slate-600">{invoice.fecha_emision} · {invoice.proveedor_nombre||invoice.cliente_nombre||'Sin tercero'} · {money(invoice.total_factura)}</span>
        <span className="block text-xs text-amber-800">{invoice.fiscal_review_status==='validado'?'Criterio guardado; falta finalizar asiento':'Pendiente de revisión profesional'}</span></span>
      </label><InvoiceFiscalReview companyId={companyId} invoice={invoice} advisorAccess /></div>)}</div>
    <div className="mt-3 flex justify-end gap-3 text-xs">
      <button type="button" disabled={page===0} onClick={()=>setPage(p=>p-1)}>Anterior</button><span>Página {page+1}</span>
      <button type="button" disabled={!query.data?.hasMore} onClick={()=>setPage(p=>p+1)}>Siguiente</button>
    </div>
    <div className="mt-5 rounded-xl border border-cyan-200 bg-cyan-50/40 p-4">
      <h3 className="text-sm font-semibold">Lotes guardados · reanudar y revisar incidencias</h3>
      <select aria-label="Lote guardado" className="my-2 max-w-full rounded border p-2 text-xs" value={batch?.id||''} disabled={running||processing}
        onChange={e=>{const job=jobs.data?.batches?.find(row=>row.id===e.target.value);if(job) loadResults(job).catch(e=>setError(err(e)));}}>
        <option value="">Seleccionar lote</option>{(jobs.data?.batches||[]).map(job=><option key={job.id} value={job.id}>{job.created_date?.slice(0,16)} · {job.processed}/{job.total} · {job.status}</option>)}
      </select>
      {batch&&<><p className="text-xs">{batch.processed}/{batch.total} procesadas · {batch.succeeded} confirmadas y contabilizadas · {batch.failed} incidencias · {batch.pending_accounting} pendientes de circuito contable.</p>
        <progress aria-label="Progreso del lote" className="my-2 w-full" max={batch.total||1} value={batch.processed||0} />
        <p className="text-xs text-slate-500">La pestaña procesa de forma acotada. Al pausarla o cerrarla termina la factura en curso; puedes reanudar sin repetir las completadas.</p>
        <div className="my-3 flex flex-wrap gap-3 text-xs">
          {running?<button type="button" onClick={()=>setRunning(false)}>Pausar después de la factura actual</button>:<>
            {!['completed','failed','preparing'].includes(batch.status)&&<button type="button" disabled={processing} className="rounded bg-slate-900 px-3 py-2 text-white" onClick={()=>{setError('');setRunning(true);}}>Reanudar lote</button>}
            <button type="button" onClick={()=>loadResults(batch,resultPage).catch(e=>setError(err(e)))}>Actualizar estado e incidencias</button>
            {failedIds.length>0&&!processing&&<button type="button" onClick={()=>createBatch(batch.criteria,failedIds).catch(e=>setError(err(e)))}>Reintentar incidencias de esta página ({failedIds.length})</button>}
          </>}
        </div>
        {batch.lock_token&&!running&&<div className="my-3 rounded border border-amber-300 p-3 text-xs">
          Proceso en curso o interrumpido. Recuperación manual disponible después de 10 minutos, nunca mientras otra pestaña siga trabajando.
          <input aria-label="Motivo de recuperación" placeholder="Motivo de recuperación" className="my-2 block w-full rounded border p-2" value={recoveryReason} onChange={e=>setRecoveryReason(e.target.value)} />
          <label className="flex gap-2"><input type="checkbox" checked={stopped} onChange={e=>setStopped(e.target.checked)} />Confirmo que ya no hay ningún proceso ejecutándose</label>
          <button type="button" className="mt-2 underline" onClick={()=>fiscal({action:'recover_review_batch',companyId,batchId:batch.id,expectedToken:batch.lock_token,processStopped:stopped,reason:recoveryReason}).then(data=>setBatch(data.batch)).catch(e=>setError(err(e)))}>Recuperar lote con trazabilidad</button>
        </div>}
        <div className="max-h-64 overflow-auto">{results.map((row,index)=><div key={row.invoice_id+'-'+index} className={'border-b py-2 text-xs '+(row.status==='succeeded'?'text-emerald-800':'text-amber-900')}>
          <strong>{row.number||row.invoice_id}</strong> · {row.message}</div>)}</div>
        <div className="mt-2 flex gap-3 text-xs"><button type="button" disabled={resultPage===0||running} onClick={()=>loadResults(batch,resultPage-1).catch(e=>setError(err(e)))}>Resultados anteriores</button>
          <button type="button" disabled={!moreResults||running} onClick={()=>loadResults(batch,resultPage+1).catch(e=>setError(err(e)))}>Más resultados</button></div>
      </>}
    </div>
  </section>;
}

