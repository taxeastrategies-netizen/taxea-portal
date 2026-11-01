import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as esbuild from 'esbuild';
import {limitedTextResult} from '../src/lib/limitedCoreResult.mjs';
for (const [input, output] of [['texto','texto'], ['', ''], [{result:'resultado'},'resultado'], [{text:'alternativa'},'alternativa']]) assert.equal(limitedTextResult(input), output);
for (const input of [null, undefined, 3, true, [], {}, {result:7}, {text:{nested:true}}]) assert.throws(()=>limitedTextResult(input), /texto válido/);
const calls=[];
let result;
const core={InvokeLLM(){throw Error('Direct integration bypass forbidden');}};
const sdk={integrations:{Core:core},entities:{},auth:{},functions:{async invoke(name,params){calls.push({name,params});return {data:result};}}};
const build=await esbuild.build({entryPoints:['src/api/base44Client.js'],bundle:true,write:false,platform:'node',format:'cjs',alias:{'@':process.cwd()+'/src'},plugins:[{name:'server-mediation-double',setup(b){
 b.onResolve({filter:/^@base44\/sdk$/},()=>({path:'sdk',namespace:'mock'}));
 b.onResolve({filter:/app-params$/},()=>({path:'params',namespace:'mock'}));
 b.onResolve({filter:/sessionSecurity\.mjs$/},()=>({path:'session',namespace:'mock'}));
 b.onLoad({filter:/.*/,namespace:'mock'},a=>({loader:'js',contents:a.path==='sdk'?'export const createClient=()=>globalThis.__sdk':a.path==='params'?'export const appParams={}':'export function forgetSessionIdentity(){}'}));
}}]});
const module={exports:{}};
vm.runInNewContext(build.outputFiles[0].text,{module,exports:module.exports,__sdk:sdk,console});
const client=module.exports.base44;
for(const value of ['normal',{result:'legacy'},{text:'legacy text'}]){result={result:value};const output=await client.controlledCore.InvokeLLM({prompt:'Synthetic test'});assert.equal(typeof output,'string');assert.equal(output,limitedTextResult(value));}
const structured={amount:0,rows:[{label:'Synthetic'}]};result={result:structured};assert.equal(await client.controlledCore.InvokeLLM({prompt:'Synthetic JSON',response_json_schema:{type:'object'}}),structured);
result={result:{unexpected:3}};await assert.rejects(client.controlledCore.InvokeLLM({prompt:'Synthetic invalid'}),/texto válido/);
result={};await assert.rejects(client.controlledCore.InvokeLLM({prompt:'Synthetic missing'}),/solicitud de IA/);
assert.ok(calls.every(call=>call.name==='invokeLimitedLLM'));
assert.equal(fs.readFileSync('base44/functions/fiscalOperations/entry.ts','utf8').includes("['bundle', 'save_profile'].includes(action) ? svc.entities.FiscalProfileVersion.filter"),true);
console.log(JSON.stringify({ok:true,textCases:12,actualClientMediatedCalls:calls.length,structuredResultPreserved:true,externalCalls:0,customerWrites:0}));
