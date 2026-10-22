import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import * as esbuild from 'esbuild';
import * as React from 'react';
import {QueryClient,MutationObserver} from '@tanstack/react-query';

// Actual component callbacks + actual MutationObserver. Only React hook storage
// and SDK persistence are adapted; no account or notification settings are saved.
const slots=[],nativeRequire=createRequire(import.meta.url),client=new QueryClient();
let cursor=0,release,started,pending,writes=0,rejectNext=true;
const hooks={...React,useState:initial=>{const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value;}];},useRef:initial=>{const i=cursor++;if(!(i in slots))slots[i]={current:initial};return slots[i];},useEffect:()=>{}};
const built=await esbuild.build({entryPoints:['src/components/ajustes/TabNotificaciones.jsx'],bundle:true,write:false,format:'cjs',platform:'node',jsx:'automatic',alias:{'@':process.cwd()+'/src'},external:['react','react-dom','react/jsx-runtime'],plugins:[{name:'test-boundaries',setup(build){
  build.onResolve({filter:/base44Client$/},()=>({path:'sdk',namespace:'test'}));
  build.onResolve({filter:/^@tanstack\/react-query$/},()=>({path:'query',namespace:'test'}));
  build.onLoad({filter:/.*/,namespace:'test'},args=>({contents:args.path==='sdk'?'export const base44={auth:{updateMe:value=>globalThis.__persist(value)}};':'export const useQueryClient=()=>globalThis.__client;export const useMutation=options=>({mutateAsync:vars=>globalThis.__mutate(options,vars)});',loader:'js'}));
}}]});
const exported={},context={exports:exported,module:{exports:exported},console,require:name=>name==='react'?hooks:nativeRequire(name),__client:client,
  __persist:async value=>{writes++;assert.equal(value.notification_prefs.email_resumen,false);started();await new Promise(resolve=>{release=resolve;});if(rejectNext)throw Error('Synthetic offline');return {id:'fictitious-user'};},
  __mutate:(options,variables)=>{const observer=new MutationObserver(client,options);pending=observer.mutate(variables);return pending;},
};
vm.runInNewContext(built.outputFiles[0].text,context);
const render=()=>{cursor=0;return context.module.exports.default({user:{id:'fictitious-user',email:'nobody@example.invalid'}});};
const find=(element,predicate)=>{if(!element||typeof element!=='object')return null;if(predicate(element))return element;for(const child of React.Children.toArray(element.props?.children)){const match=find(child,predicate);if(match)return match;}return null;};
let tree=render(),toggle=find(tree,element=>element.props?.label==='Resumen periódico por email');
assert.equal(toggle.props.checked,true);
let began=new Promise(resolve=>{started=resolve;});toggle.props.onChange(false);await began;
tree=render();toggle=find(tree,element=>element.props?.label==='Resumen periódico por email');assert.equal(toggle.props.checked,false,'Actual switch changes before the persistence gate');
assert.equal(find(tree,element=>element.type==='fieldset').props.disabled,true,'Rapid repeated changes are blocked while saving');
release();await assert.rejects(pending);await Promise.resolve();tree=render();toggle=find(tree,element=>element.props?.label==='Resumen periódico por email');assert.equal(toggle.props.checked,true,'Actual component restores the confirmed value');
const error=find(tree,element=>element.props?.role==='alert');assert.ok(error,'A failed automatic save is visible');
rejectNext=false;began=new Promise(resolve=>{started=resolve;});
const retry=find(error,element=>element.props?.children==='Reintentar el cambio');retry.props.onClick();await began;
tree=render();assert.equal(find(tree,element=>element.props?.label==='Resumen periódico por email').props.checked,false);
release();await pending;await Promise.resolve();tree=render();assert.equal(find(tree,element=>element.props?.label==='Resumen periódico por email').props.checked,false);
assert.equal(find(tree,element=>element.type==='fieldset').props.disabled,false);assert.equal(writes,2);
client.clear();console.log(JSON.stringify({ok:true,actualComponentCallbacks:true,hookStorageAdapter:true,actualMutationObserver:true,automaticSave:true,errorRollback:true,explicitRetry:true,externalCalls:0,financialWrites:0}));
