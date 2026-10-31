import assert from 'node:assert/strict';import fs from 'node:fs';
import {mercantilOperation} from '../base44/functions/mercantilDocumentOperations/mercantilOperations.mjs';
import {createMercantilEntities,MERCANTIL_ENTITIES} from '../src/lib/mercantilEntities.mjs';
let checks=0;const check=(condition,label)=>{assert.ok(condition,label);checks++;};
const a={id:'company-a',owner_email:'a@example.test',nif_cif:'QAA',activa:true},b={id:'company-b',owner_email:'b@example.test',nif_cif:'QAB',activa:true};
const owner={id:'user-a',email:a.owner_email,role:'user',data:{company_id:a.id}},admin={id:'qa-admin',email:'admin@example.test',role:'admin'};
function matches(row,query){return Object.entries(query||{}).every(([key,value])=>{
 if(key==='$and')return value.every(x=>matches(row,x));if(key==='$or')return value.some(x=>matches(row,x));
 const actual=row[key];if(value&&typeof value==='object'&&!Array.isArray(value))return Object.entries(value).every(([op,test])=>op==='$in'?test.some(x=>Array.isArray(actual)?actual.includes(x):x===actual||(x===null&&actual===undefined)):op==='$ne'?actual!==test:op==='$lte'?actual<=test:false);
 return actual===value;
});}
function fixture(){
 const tables={Company:[a,b],ClientAccount:[{id:'client-a',email:a.owner_email,taxId:'QAA'},{id:'client-b',email:b.owner_email,taxId:'QAB'}],
 MercantilSociedad:[{id:'soc-a',clienteAccountId:'client-a',nombreFiscal:'QA A',visibilidadCliente:true,observaciones:'internal note'},{id:'soc-b',clienteAccountId:'client-b',nombreFiscal:'QA B',visibilidadCliente:true},{id:'soc-hidden',clienteAccountId:a.id,visibilidadCliente:false}],
 MercantilExpediente:[{id:'exp-a',sociedadId:'soc-a',ejercicio:'2026',estadoGlobal:'no_iniciado'},{id:'exp-b',sociedadId:'soc-b',ejercicio:'2026'}],MercantilLibro:[],MercantilDocumento:[],MercantilHistorial:[{id:'history-internal',sociedadId:'soc-a',expedienteId:'exp-a',tipoAccion:'nota_interna',accion:'admin internal'},{id:'history-client',sociedadId:'soc-a',expedienteId:'exp-a',tipoAccion:'documento_subido',accion:'QA upload'}],
 DocumentAsset:[{id:'asset-a',company_id:a.id,object_name:'companies/'+a.id+'/a.pdf',status:'ready'},{id:'asset-b',company_id:b.id,object_name:'companies/'+b.id+'/b.pdf',status:'ready'}]};
 let writes=[],serial=0;const entities={};for(const[name,rows]of Object.entries(tables))entities[name]={
  async get(id){return structuredClone(rows.find(x=>x.id===id)||null);},
  async filter(query,sort,limit=100,offset=0){const filtered=rows.filter(row=>matches(row,query));return structuredClone(filtered.slice(offset,offset+limit));},
  async create(input){const row={id:'new-'+(++serial),...structuredClone(input)};rows.push(row);writes.push({name,method:'create',id:row.id});return structuredClone(row);},
  async bulkCreate(inputs){return Promise.all(inputs.map(input=>entities[name].create(input)));},
  async update(id,patch){const row=rows.find(x=>x.id===id);Object.assign(row,structuredClone(patch));writes.push({name,method:'update',id,patch});return structuredClone(row);},
  async updateMany(query,update){const selected=rows.filter(x=>matches(x,query));for(const row of selected)Object.assign(row,structuredClone(update.$set));return{updated:selected.length};},
  async delete(id){const i=rows.findIndex(x=>x.id===id);if(i>=0)rows.splice(i,1);writes.push({name,method:'delete',id});}
 };
 const service={entities};return{tables,writes,service,invoke:(entity,method,args,user=owner)=>mercantilOperation(service,user,{entity,method,args})};
}
let f=fixture();let rows=await f.invoke('MercantilSociedad','list',[]);check(rows.length===1&&rows[0].id==='soc-a','normal user lists linked visible society via exact account mapping');check(rows[0].observaciones===undefined,'internal society note hidden');
rows=await f.invoke('MercantilExpediente','list',['-ultimaActualizacion',500]);check(rows.length===1&&rows[0].id==='exp-a','existing expediente visible despite society ID differing from company ID');
check((await f.invoke('MercantilExpediente','get',['exp-a'])).ejercicio==='2026','own expediente opens');
for(const [entity,id]of [['MercantilSociedad','soc-b'],['MercantilSociedad','soc-hidden'],['MercantilExpediente','exp-b']]){await assert.rejects(()=>f.invoke(entity,'get',[id]),e=>e.status===404);checks++;}
rows=await f.invoke('MercantilHistorial','filter',[{expedienteId:'exp-a'}]);check(rows.length===1&&rows[0].id==='history-client','client sees shared history, not internal notes');
await assert.rejects(()=>f.invoke('MercantilHistorial','get',['history-internal']),e=>e.status===404);checks++;
for(const invalid of [{entity:'Invoice',method:'list',args:[]},{entity:'MercantilSociedad',method:'constructor',args:[]},{entity:'MercantilSociedad',method:'filter',args:[{$where:'attack'}]},{entity:'MercantilSociedad',method:'filter',args:[{clienteAccountId:{$in:[a.id,b.id]}}]}]){await assert.rejects(()=>mercantilOperation(f.service,owner,invalid),e=>e.status===400);checks++;}
await assert.rejects(()=>mercantilOperation(f.service,null,{entity:'MercantilSociedad',method:'list',args:[]}),e=>e.status===401);checks++;
await assert.rejects(()=>f.invoke('MercantilSociedad','list',[],{...owner,data:{accountAccessStatus:'disabled'}}),e=>e.status===403);checks++;
rows=await f.invoke('MercantilExpediente','list',[],{...owner,data:{company_id:b.id}});check(rows.length===1&&rows[0].id==='exp-a','forged active company cannot authorize foreign records');
await assert.rejects(()=>f.invoke('MercantilExpediente','update',['exp-b',{estadoGlobal:'en_preparacion'}]),e=>e.status===404);checks++;
await assert.rejects(()=>f.invoke('MercantilExpediente','update',['exp-a',{sociedadId:'soc-b'}]),e=>e.status===409);checks++;
await assert.rejects(()=>f.invoke('MercantilExpediente','update',['exp-a',{estadoGlobal:'cerrado'}]),e=>e.status===403);checks++;
check(f.writes.length===0,'read and denied operations write nothing');
const request={sociedadId:'soc-a',ejercicio:'2026',estadoGlobal:'no_iniciado',estadoLibros:'pendiente',estadoCuentas:'pendiente'};
const existing=await f.invoke('MercantilExpediente','create',[request]);check(existing.id==='exp-a'&&f.tables.MercantilExpediente.length===2,'creating an existing year returns its original ID');
const responses=await Promise.allSettled([f.invoke('MercantilExpediente','create',[{...request,ejercicio:'2027'}]),f.invoke('MercantilExpediente','create',[{...request,ejercicio:'2027'}])]);
check(f.tables.MercantilExpediente.filter(x=>x.sociedadId==='soc-a'&&x.ejercicio==='2027').length===1,'simultaneous creates produce one expediente');check(responses.some(x=>x.status==='fulfilled'),'one concurrent request succeeds');
const retried=await f.invoke('MercantilExpediente','create',[{...request,ejercicio:'2027'}]);check(retried.id===f.tables.MercantilExpediente.find(x=>x.ejercicio==='2027').id,'retry recovers same expediente');
await assert.rejects(()=>f.invoke('MercantilLibro','bulkCreate',[[{expedienteId:'exp-a',sociedadId:'soc-a',tipoLibro:'diario'},{expedienteId:'exp-b',sociedadId:'soc-b',tipoLibro:'diario'}]]),e=>e.status===404);checks++;check(f.tables.MercantilLibro.length===0,'mixed-company bulk preflight writes nothing');
const book=await f.invoke('MercantilLibro','create',[{expedienteId:'exp-a',sociedadId:'soc-a',tipoLibro:'diario'}]);
check((await f.invoke('MercantilLibro','create',[{expedienteId:'exp-a',sociedadId:'soc-a',tipoLibro:'diario'}])).id===book.id,'default books idempotent');
const booksRequest=[{expedienteId:'exp-a',sociedadId:'soc-a',tipoLibro:'diario'},{expedienteId:'exp-a',sociedadId:'soc-a',tipoLibro:'pyg'}];
check((await f.invoke('MercantilLibro','bulkCreate',[booksRequest])).length===2&&f.tables.MercantilLibro.length===2,'bulk initialization adds only missing books');
check((await f.invoke('MercantilLibro','bulkCreate',[booksRequest]))[0].id===book.id&&f.tables.MercantilLibro.length===2,'repeated bulk keeps original IDs');
await f.invoke('MercantilLibro','update',[book.id,{archivoFuenteUrl:'https://taxeaportal.com/private-document/asset-a'}]);
await assert.rejects(()=>f.invoke('MercantilLibro','update',[book.id,{archivoFuenteUrl:'https://taxeaportal.com/private-document/asset-b'}]),e=>e.status===404);checks++;
await assert.rejects(()=>f.invoke('MercantilLibro','update',[book.id,{archivoFuenteUrl:'https://evil.example.test/leak'}]),e=>e.status===404);checks++;
const document={expedienteId:'exp-a',sociedadId:'soc-a',fileUrl:'https://taxeaportal.com/private-document/asset-a',nombre:'QA file',carpeta:'test',tipoDocumento:'otro',estado:'aprobado',subidoPor:'forged-admin'};
const doc=await f.invoke('MercantilDocumento','create',[document]);check(doc.subidoPor===owner.email&&doc.estado==='subido','new client upload is attributed to real caller and remains unreviewed');check((await f.invoke('MercantilDocumento','create',[document])).id===doc.id,'retrying file archival does not duplicate metadata');
await assert.rejects(()=>f.invoke('MercantilDocumento','create',[{...document,sociedadId:'soc-b'}]),e=>e.status===404);checks++;
await assert.rejects(()=>f.invoke('MercantilDocumento','create',[{...document,fileUrl:'https://taxeaportal.com/private-document/asset-b'}]),e=>e.status===404);checks++;
await assert.rejects(()=>f.invoke('MercantilDocumento','delete',[doc.id]),e=>e.status===403);checks++;
const history=await f.invoke('MercantilHistorial','create',[{sociedadId:'soc-a',expedienteId:'exp-a',accion:'spoofed admin',usuario:'admin@example.test',tipoAccion:'legalizado'}]);check(history.usuario===owner.email&&history.tipoAccion==='documento_subido','client cannot impersonate adviser in history');
rows=await f.invoke('MercantilExpediente','list',[],admin);check(rows.some(x=>x.id==='exp-b'),'admin retains cross-company read');
await f.invoke('MercantilExpediente','update',['exp-a',{estadoGlobal:'cerrado',motivoCierreManual:'QA synthetic'}],admin);check(f.tables.MercantilExpediente[0].estadoGlobal==='cerrado','admin retains closing action');
check(!f.writes.some(x=>['Invoice','JournalEntry','AccountingAccount','Contact'].includes(x.name)),'bridge never writes accounting or client subaccounts');
for(const name of MERCANTIL_ENTITIES){const schema=JSON.parse(fs.readFileSync('base44/entities/'+name+'.jsonc','utf8'));for(const method of ['create','read','update','delete'])check(schema.rls[method]===false,name+' denies bypass through direct SDK '+method);}
const sdk={entities:{Invoice:{synthetic:true}},functions:{invoke:async(name,body)=>{check(name==='mercantilDocumentOperations','client uses the scoped bridge');return{data:{ok:true,result:await f.invoke(body.entity,body.method,body.args)}};}}};
const proxy=createMercantilEntities(sdk);check((await proxy.MercantilExpediente.get('exp-a')).id==='exp-a','real client adapter unwraps the result envelope');check(proxy.Invoice===sdk.entities.Invoice,'unrelated invoice API preserved');
console.log(JSON.stringify({ok:true,checks,realDataWrites:0,coverage:'actual ownership joins, role boundaries, RLS bypass denial, exact file binding, concurrency/idempotency and client contract'}));
