import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import * as esbuild from 'esbuild';
import * as React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {QueryClient, MutationObserver} from '@tanstack/react-query';
import {documentStatusOptions, documentStatusKey} from '../src/lib/documentStatusMutation.mjs';

const client = new QueryClient({defaultOptions:{mutations:{retry:false}}});
const previous={id:'qa-document',company_id:'qa-company',estado:'pendiente',nombre:'Archivo ficticio.pdf',notas:'Inicial'};
let visible={...previous},current={userId:'qa-user',companyId:'qa-company'},writes=0,release,started;
const isCurrent=v=>current.userId===v.userId&&current.companyId===v.companyId;
const variables={documentId:previous.id,companyId:previous.company_id,userId:'qa-user',previous,nextStatus:'aprobado'};
const onVisible=(_v,patch)=>{visible={...visible,...patch};};
let began=new Promise(resolve=>{started=resolve;});
const options=documentStatusOptions({queryClient:client,isCurrent,onVisible,persist:async(id,patch)=>{
  writes++; assert.equal(id,previous.id); assert.deepEqual(patch,{estado:'aprobado'}); started();
  await new Promise(resolve=>{release=resolve;}); throw Error('Synthetic offline');
}});
const observer=new MutationObserver(client,options),result=observer.mutate(variables);
await began;
assert.equal(visible.estado,'aprobado');assert.equal(visible._taxeaStatusPending,true,'Optimistic value is explicitly pending, not confirmed');
assert.equal(client.getQueryData(documentStatusKey(variables))._taxeaStatusPending,true);
visible.notas='Concurrent metadata edit'; release();await assert.rejects(result);
assert.equal(visible.estado,'pendiente');assert.equal(visible._taxeaStatusPending,false);assert.equal(visible.notas,'Concurrent metadata edit','Rollback only touches status, never overwrites other edits');
assert.equal(writes,1,'No automatic retry');
const success=new MutationObserver(client,documentStatusOptions({queryClient:client,isCurrent,onVisible,persist:async(id,patch)=>{writes++;return {...previous,id,estado:patch.estado};}}));
await success.mutate(variables);assert.equal(visible.estado,'aprobado');assert.equal(visible._taxeaStatusPending,false);
assert.equal(client.getQueryData(documentStatusKey(variables)).estado,'aprobado');
await assert.rejects(success.mutate({...variables,nextStatus:'pagada'}));assert.equal(writes,2,'Financial statuses cannot enter this metadata circuit');
await assert.rejects(success.mutate({...variables,companyId:'other-company'}));assert.equal(writes,2);
current={userId:'other-user',companyId:'qa-company'};
await assert.rejects(success.mutate(variables));assert.equal(writes,2,'Identity checked before persistence');
current={userId:'qa-user',companyId:'qa-company'};
const mismatch=new MutationObserver(client,documentStatusOptions({queryClient:client,isCurrent,onVisible,persist:async()=>({...previous,estado:'pendiente'})}));
await assert.rejects(mismatch.mutate(variables));assert.equal(visible.estado,'pendiente','An unconfirmed/mismatched response cannot report success');
began=new Promise(resolve=>{started=resolve;});
const inFlight=new MutationObserver(client,documentStatusOptions({queryClient:client,isCurrent,onVisible,persist:async()=>{started();await new Promise(resolve=>{release=resolve;});return {...previous,estado:'aprobado'};}}));
const oldResult=inFlight.mutate(variables);await began;
current={userId:'new-user',companyId:'new-company'};visible={id:'qa-document',company_id:'new-company',estado:'pendiente'};
release();await oldResult;assert.equal(visible.estado,'pendiente','Old response cannot touch a newly selected company');
for(const mutation of [observer,success,mismatch,inFlight])mutation.reset();client.clear();

// Execute the actual hook callbacks with real TanStack lifecycle and an SDK stub.
const slots=[],nativeRequire=createRequire(import.meta.url),hookClient=new QueryClient();
let cursor=0,hookDocs=[{...previous}],hookObserver,hookPending,hookRelease,hookStarted,hookWrites=0,fail=false;
let identity={companyId:'qa-company',userId:'qa-user',isAdmin:true};
const react={...React,useState:initial=>{const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value;}];},useRef:initial=>{const i=cursor++;if(!(i in slots))slots[i]={current:initial};return slots[i];},useEffect:()=>{}};
const built=await esbuild.build({entryPoints:['src/hooks/useDocumentStatus.js'],bundle:true,write:false,format:'cjs',platform:'node',alias:{'@':process.cwd()+'/src'},external:['react'],plugins:[{name:'isolated-hook',setup(build){
  build.onResolve({filter:/base44Client$/},()=>({path:'api',namespace:'qa'}));
  build.onResolve({filter:/^@tanstack\/react-query$/},()=>({path:'query',namespace:'qa'}));
  build.onLoad({filter:/.*/,namespace:'qa'},args=>({contents:args.path==='api'?'export const base44={entities:{Document:{update:(id,patch)=>globalThis.__persist(id,patch)}}};':'export const useQueryClient=()=>globalThis.__client;export const useMutation=options=>globalThis.__mutation(options);',loader:'js'}));
}}]});
const exported={},context={exports:exported,module:{exports:exported},require:name=>name==='react'?react:nativeRequire(name),console,__client:hookClient,
  __persist:async(id,patch)=>{hookWrites++;assert.equal(id,previous.id);assert.deepEqual(Object.keys(patch),['estado']);hookStarted();await new Promise(resolve=>{hookRelease=resolve;});if(fail)throw Error('Synthetic network failure');return {...previous,estado:patch.estado};},
  __mutation:options=>{if(!hookObserver)hookObserver=new MutationObserver(hookClient,options);else hookObserver.setOptions(options);return {isPending:hookObserver.getCurrentResult().isPending,mutateAsync:vars=>{hookPending=hookObserver.mutate(vars);return hookPending;}};},
};
vm.runInNewContext(built.outputFiles[0].text,context);
const render=()=>{cursor=0;return context.module.exports.default({...identity,docs:hookDocs,setDocs:update=>{hookDocs=typeof update==='function'?update(hookDocs):update;}});};
let hook=render(),hookBegan=new Promise(resolve=>{hookStarted=resolve;});
hook.changeStatus(previous.id,{estado:'revisado'});hook.changeStatus(previous.id,{estado:'rechazado'});await hookBegan;
hook=render();assert.equal(hookDocs[0].estado,'revisado');assert.equal(hookDocs[0]._taxeaStatusPending,true);assert.equal(hook.pending,true);assert.equal(hookWrites,1,'Fast double taps only persist once');
hookRelease();await hookPending;await new Promise(setImmediate);hook=render();assert.equal(hookDocs[0]._taxeaStatusPending,false);assert.ok(hook.message.includes('actualizado'));
hook.changeStatus(previous.id,{estado:'revisado'});await new Promise(setImmediate);assert.equal(hookWrites,1,'Repeated submission of the already-confirmed state is a local no-op');
fail=true;hookBegan=new Promise(resolve=>{hookStarted=resolve;});hook.changeStatus(previous.id,{estado:'rechazado'});await hookBegan;
hookDocs[0].notas='Latest local note';hookRelease();await assert.rejects(hookPending);await new Promise(setImmediate);hook=render();
assert.equal(hookDocs[0].estado,'revisado');assert.equal(hookDocs[0].notas,'Latest local note');assert.ok(hook.error.includes('estado anterior'));
hook.changeStatus(previous.id,{estado:'aprobado',company_id:'attacker'});await new Promise(setImmediate);assert.equal(hookWrites,2,'Caller cannot change ownership or sneak another field');
identity={...identity,isAdmin:false};hook=render();hook.changeStatus(previous.id,{estado:'aprobado'});await new Promise(setImmediate);assert.equal(hookWrites,2,'Normal clients cannot approve document review metadata');
fail=false;identity={...identity,isAdmin:true};hook=render();hookBegan=new Promise(resolve=>{hookStarted=resolve;});
hook.changeStatus(previous.id,{estado:'aprobado'});await hookBegan;
identity={...identity,isAdmin:false};hook=render();hookRelease();await hookPending;await new Promise(setImmediate);hook=render();
assert.equal(hookDocs[0]._taxeaStatusPending,false,'Revoking the role mid-request cannot leave an eternal provisional badge');
assert.equal(hookDocs[0].estado,'revisado','Role revocation does not show a provisional approval as confirmed');
identity={...identity,isAdmin:true};hook=render();hookBegan=new Promise(resolve=>{hookStarted=resolve;});
hook.changeStatus(previous.id,{estado:'aprobado'});await hookBegan;
identity={companyId:'new-company',userId:'new-user',isAdmin:true};hookDocs=[{...previous,company_id:'new-company',estado:'pendiente'}];hook=render();
hookRelease();await hookPending;await new Promise(setImmediate);hook=render();assert.equal(hookDocs[0].estado,'pendiente');assert.equal(hookDocs[0]._taxeaStatusPending,undefined,'A response cannot insert pending/confirmed metadata into a different company');
hookClient.clear();

// Render actual cards. Only presentation, no download, external API or approval.
const cardBuild=await esbuild.build({entryPoints:['src/components/documentos/DocCard.jsx'],bundle:true,write:false,format:'cjs',platform:'node',jsx:'automatic',alias:{'@':process.cwd()+'/src'},external:['react','react-dom','react/jsx-runtime']});
const cardExports={},cardContext={exports:cardExports,module:{exports:cardExports},require:nativeRequire};vm.runInNewContext(cardBuild.outputFiles[0].text,cardContext);
const Card=cardContext.module.exports.default;
const pendingCard=renderToStaticMarkup(React.createElement(Card,{doc:{...previous,estado:'aprobado',_taxeaStatusPending:true},isAdmin:true,busy:true,onUpdate(){}}));
assert.ok(pendingCard.includes('Guardando: ')&&pendingCard.includes('role="status"')&&pendingCard.includes('aria-busy="true"'));
assert.ok(pendingCard.includes('Acciones del documento Archivo ficticio.pdf')&&!pendingCard.includes('opacity-0'),'Mobile action trigger cannot be invisible or unnamed');
const confirmedCard=renderToStaticMarkup(React.createElement(Card,{doc:{...previous,estado:'aprobado'},isAdmin:true,onUpdate(){}}));
assert.ok(!confirmedCard.includes('Guardando: ')&&confirmedCard.includes('dark:text-green-200'));
const page=fs.readFileSync('src/pages/Documentos.jsx','utf8');
assert.ok(page.includes('d.estado === filterEstado || d._taxeaStatusPending'),'Pending row remains visible until confirmation or rollback');
assert.equal((page.match(/busy=\{updatingStatus\}/g)||[]).length,2,'Both views block repeated status changes');
console.log(JSON.stringify({ok:true,actualMutationObserver:true,actualHookCallbacks:true,realReactCardRender:true,optimisticPendingBeforeNetwork:true,serverConfirmationRequired:true,targetedRollback:true,noAutoRetry:true,scopeIsolation:true,doubleTapGuard:true,explicitFieldAllowlist:true,externalCalls:0,financialWrites:0}));
