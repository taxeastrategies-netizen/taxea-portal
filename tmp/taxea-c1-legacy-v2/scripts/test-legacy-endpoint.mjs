import assert from'node:assert/strict';import{createHash}from'node:crypto';import{build}from'esbuild';import vm from'node:vm';
const app='6a00fec50cc522a74ddde4b2',reference='https://media.base44.com/files/public/'+app+'/synthetic.pdf',digest=createHash('sha256').update(reference).digest('hex');
let user={id:'normal-a',email:'a@example.test',role:'user'},alias={id:'alias-a',company_id:'company-a',reference_digest:digest,asset_id:'asset-a',status:'verified',sha256:'a'.repeat(64),size:100},duplicates=false,queries=0,secretReads=0,handler,checks=0;
const company={id:'company-a',owner_email:'a@example.test',activa:true},asset={id:'asset-a',company_id:company.id,status:'ready',sha256:'a'.repeat(64),size:100,object_name:'companies/company-a/synthetic.pdf',generation:'123'};
const matches=(row,q)=>Object.entries(q).every(([k,v])=>typeof v==='object'&&v?.$in?v.$in.includes(row[k]):row[k]===v);
const entities={Company:{get:async id=>id===company.id?company:null},DocumentLegacyReference:{async filter(q){queries++;return alias&&matches(alias,q)?duplicates?[alias,{...alias,id:'duplicate'}]:[alias]:[];}},DocumentAsset:{async filter(q){queries++;return matches(asset,q)?[asset]:[];}}};
const bundle=await build({entryPoints:['base44/functions/documentStorage/entry.ts'],bundle:true,write:false,format:'cjs',platform:'node',plugins:[{name:'sdk',setup(b){b.onResolve({filter:/^npm:@base44\/sdk/},()=>({path:'sdk',namespace:'stub'}));b.onLoad({filter:/.*/,namespace:'stub'},()=>({contents:'export const createClientFromRequest=()=>globalThis.__client;',loader:'js'}));}}]});
vm.runInNewContext(bundle.outputFiles[0].text,{TextEncoder,TextDecoder,Uint8Array,URL,URLSearchParams,Request,Response,File,Blob,AbortController,AbortSignal,crypto:globalThis.crypto,atob,btoa,setTimeout,clearTimeout,console,__client:{auth:{me:async()=>user},asServiceRole:{entities}},Deno:{env:{get(){secretReads++;throw Error('NO SECRET READS IN ALIAS LOOKUP');}},serve(fn){handler=fn;}}});
async function invoke(body){const response=await handler(new Request('https://synthetic.test/storage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}));return{status:response.status,body:await response.json()};}
const body={action:'resolve_legacy_references',companyId:'company-a',references:[reference]},ok=(a,b)=>{assert.deepEqual(a,b);checks++;};
user=null;ok((await invoke(body)).status,401);ok(queries,0);
user={id:'normal-b',email:'b@example.test',role:'user',company_id:'company-a',advisor:true};ok((await invoke(body)).status,403);ok(queries,0);
user={id:'normal-a',email:'a@example.test',role:'user',data:{accountAccessStatus:'disabled'}};ok((await invoke(body)).status,403);ok(queries,0);
user={id:'normal-a',email:'a@example.test',role:'user'};
for(const references of [[],Array(21).fill(reference)]){ok((await invoke({...body,references})).status,400);}
ok((await invoke({...body,references:['https://outside.test/file.pdf']})).status,403);
const result=await invoke(body);ok(result.status,200);ok(result.body.mappings,[{index:0,mapped:true,file_url:'https://taxeaportal.com/private-document/asset-a'}]);ok(JSON.stringify(result.body).includes('object_name'),false);ok(JSON.stringify(result.body).includes('generation'),false);ok(JSON.stringify(result.body).includes('sha256'),false);
alias={...alias,status:'disabled'};ok((await invoke(body)).status,403);alias.status='verified';alias.sha256='b'.repeat(64);ok((await invoke(body)).status,403);alias.sha256=asset.sha256;duplicates=true;ok((await invoke(body)).status,403);duplicates=false;
alias=null;ok((await invoke(body)).body.mappings,[{index:0,mapped:false}]);
alias={id:'foreign-alias',company_id:'foreign',reference_digest:digest,asset_id:'foreign-asset',status:'verified',sha256:asset.sha256,size:asset.size};ok((await invoke(body)).status,403);
alias=null;ok((await invoke({...body,contextKind:'mercantil',contextId:'missing'})).status,403);ok((await invoke({...body,extra:'x'.repeat(17000)})).status,400);ok(secretReads,0);
console.log(JSON.stringify({ok:true,checks,actualHandler:true,cloudReads:0,financialWrites:0,aliasWrites:0,realCustomerData:0}));
