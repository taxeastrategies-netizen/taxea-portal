import assert from 'node:assert/strict';
import {QueryClient,MutationObserver} from '@tanstack/react-query';
import {notificationReadOptions} from '../src/lib/notificationMutation.mjs';
import * as esbuild from 'esbuild';
import vm from 'node:vm';

const client=new QueryClient({defaultOptions:{mutations:{retry:false},queries:{retry:false}}}),key=['notifications','qa-only'],otherKey=['notifications','another-fictitious-user'];
const rows=[{id:'a',leida:false},{id:'b',leida:false},{id:'already',leida:true}];
client.setQueryData(key,rows);client.setQueryData(otherKey,[{id:'not-owned',leida:false}]);
let release,started,writeCalls=[];
const gate=new Promise(resolve=>{release=resolve;}),began=new Promise(resolve=>{started=resolve;});
const options=notificationReadOptions({queryClient:client,queryKey:key,persist:async id=>{writeCalls.push(id);started();await gate;if(id==='b')throw Error('offline');}});
const observer=new MutationObserver(client,options);
const pending=observer.mutate({rows,ids:['a','a','b','already','outside']});
await began;
assert.equal(client.getQueryData(key)[0].leida,true,'Actual onMutate updates before the persistence gate settles');
assert.equal(client.getQueryData(key)[1].leida,true);
assert.equal(client.getQueryData(otherKey)[0].leida,false,'Other user cache is untouched');
release();const result=await pending;
assert.deepEqual(writeCalls.sort(),['a','b']);assert.deepEqual(result.failed,['b']);
assert.equal(client.getQueryData(key)[0].leida,true);assert.equal(client.getQueryData(key)[1].leida,false,'Only the failed read marker rolls back');
assert.equal(client.getQueryData(key)[2].leida,true,'A previously read notification cannot become unread');

const before=client.getQueryData(key),fatal=new MutationObserver(client,{...options,mutationFn:async()=>{throw Error('Synthetic unexpected mutation failure');}});
await assert.rejects(fatal.mutate({rows:before,ids:['b']}));
assert.deepEqual(client.getQueryData(key),before,'Actual onError restores the affected flag without replacing unrelated data');
let duplicates=0;
const duplicateObserver=new MutationObserver(client,notificationReadOptions({queryClient:client,queryKey:key,persist:async()=>{duplicates++;}}));
await duplicateObserver.mutate({rows:[{id:'b',leida:false},{id:'b',leida:false}],ids:['b','b']});
assert.equal(duplicates,1,'Duplicate API rows are persisted once');
const none=await duplicateObserver.mutate({rows:[],ids:['not-owned']});
assert.deepEqual(none,{updated:[],failed:[]});assert.equal(duplicates,1);
observer.reset();fatal.reset();duplicateObserver.reset();client.clear();

// Execute the shell-only scroll-lock effect with DOM class-list adapters.
const effects=[],classes=[new Set(),new Set()];
const node=index=>({classList:{add:value=>classes[index].add(value),remove:value=>classes[index].delete(value)}});
const built=await esbuild.build({entryPoints:['src/hooks/useShellScrollLock.js'],bundle:true,write:false,platform:'node',format:'cjs',plugins:[{name:'lifecycle',setup(build){build.onResolve({filter:/^react$/},()=>({path:'react',namespace:'qa-hook'}));build.onLoad({filter:/.*/,namespace:'qa-hook'},()=>({contents:'export const useEffect=globalThis.__effect;',loader:'js'}));}}]});
const exported={},context={exports:exported,module:{exports:exported},__effect:effect=>effects.push(effect),document:{documentElement:node(0),body:node(1)}};
vm.runInNewContext(built.outputFiles[0].text,context);context.module.exports.default();
const cleanup=effects[0]();assert.ok(classes.every(set=>set.has('taxea-shell-document')));
cleanup();assert.ok(classes.every(set=>!set.has('taxea-shell-document')),'Public pages regain document scrolling on shell unmount');
console.log(JSON.stringify({ok:true,actualTanstackMutationObserver:true,optimisticBeforeNetwork:true,partialRollback:true,errorRollback:true,deduplicated:true,scopeIsolation:true,shellScrollCleanup:true,externalCalls:0,financialWrites:0},null,2));

