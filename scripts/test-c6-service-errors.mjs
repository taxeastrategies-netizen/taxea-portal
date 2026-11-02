import assert from 'node:assert/strict';import vm from 'node:vm';import * as esbuild from 'esbuild';import{webcrypto}from'node:crypto';
import {PublicDomainError,publicServiceFailure} from '../base44/functions/anularFacturas/publicServiceError.mjs';
const secret='SYNTHETIC_PRIVATE_PROVIDER_VALUE',logs=[],original=console.error;console.error=(...args)=>logs.push(args);
try{
 for(const error of [new Error(secret),Object.assign(new Error(secret),{status:403,response:{status:403,data:{error:secret}}}),{message:secret,status:422,publicDomainError:true},null]){
  const response=publicServiceFailure(error,'synthetic-qa'),body=await response.text();assert.equal(response.status,500);assert(!body.includes(secret));assert(body.includes('INTERNAL_OPERATION_FAILED'));
 }
 for(const status of [403,404,422,500]){const response=publicServiceFailure(new PublicDomainError('Mensaje de negocio revisado',status),'qa');assert.equal(response.status,status);assert.equal((await response.json()).error,'Mensaje de negocio revisado');}
 assert(!JSON.stringify(logs).includes(secret));
}finally{console.error=original;}
for(const name of ['anularFacturas','getCompanyFinancials']){
 let handler;const sdk={auth:{me:async()=>{throw Error(secret);}}};
 const build=await esbuild.build({entryPoints:['base44/functions/'+name+'/entry.ts'],bundle:true,write:false,platform:'node',format:'cjs',plugins:[{name:'sdk-fault',setup(b){b.onResolve({filter:/^npm:@base44\/sdk/},()=>({path:'sdk',namespace:'qa'}));b.onLoad({filter:/.*/,namespace:'qa'},()=>({loader:'js',contents:'export const createClientFromRequest=()=>globalThis.__sdk;'}));}}]});
 vm.runInContext(build.outputFiles[0].text,vm.createContext({Response,Request,crypto:webcrypto,console:{error:()=>{},log:()=>{}},__sdk:sdk,Deno:{serve:fn=>handler=fn}}));
 const response=await handler(new Request('https://qa.invalid',{method:'POST',body:'{}'})),body=await response.text();assert(!body.includes(secret));assert([401,500].includes(response.status));
}
console.log(JSON.stringify({ok:true,providerErrorsHidden:true,reviewedMessagesAndStatusesPreserved:true,logsContainNoProviderPayload:true,compiledFaultCases:2,financialWrites:0,externalCalls:0}));
