import assert from 'node:assert/strict';
import {knowledgeAdmin,normalizeKnowledge,knowledgeDigest,trustedKnowledge,saveKnowledge,KNOWLEDGE_APPROVAL_VERSION} from '../base44/functions/fiscalKnowledgeOperations/knowledgePolicy.mjs';
let checks=0;const ok=(a,b)=>{assert.deepEqual(a,b);checks++;};
const admin={id:'admin-qa',role:'admin',email:'qa@example.invalid'};
const valid={titulo:'QA',pregunta_tipo:'Pregunta ficticia',respuesta:'Respuesta sintética, no es criterio fiscal',palabras_clave:['qa','ficticia'],nivel_riesgo:'verde',impuesto:'general',activa:true,aprobada:true};
for(const user of [null,{id:'normal',role:'user'},{...admin,role:'advisor'},{...admin,status:'bloqueado',accountAccessStatus:'active'},{...admin,data:{accountAccessStatus:'suspended'}},{...admin,is_deleted:true}]){ok(knowledgeAdmin(user),false);await assert.rejects(()=>saveKnowledge(new Proxy({},{get(){throw Error('Service must not be read');}}),user,{action:'save',data:valid}),/KNOWLEDGE_ADMIN_ONLY/);checks++;}
ok(knowledgeAdmin(admin),true);ok(knowledgeAdmin({...admin,role:'super_admin'}),true);
ok(await trustedKnowledge(valid),false);
let state=null,created=0,writes=0,race=false;
const service={entities:{AIRespuestaBase:{async create(data){created++;state={...data,id:'qa-entry',updated_date:'2026-10-31T20:35:12.598851Z'};return state;},async get(){return {...state,updated_date:state.updated_date.replace(/Z$/,'')};},async updateMany(q,change){if(race||(typeof q.approval_revision==='string'?q.approval_revision!==state.approval_revision:!!state.approval_revision))return{updated:0};writes++;state={...state,...change.$set,updated_date:'2026-10-31T20:35:13.598851Z'};return{updated:1};}}}};
const saved=await saveKnowledge(service,admin,{action:'save',data:{...valid,approved_by_admin_id:'forged',approval_sha256:'forged',creada_por:'forged'}});
ok(created,1);ok(saved.approved_by_admin_id,admin.id);ok(saved.creada_por,admin.email);ok(saved.approval_version,KNOWLEDGE_APPROVAL_VERSION);ok(await trustedKnowledge(saved),true);
for(const key of ['titulo','pregunta_tipo','respuesta','palabras_clave','nivel_riesgo','impuesto','activa','aprobada']){let value=key==='palabras_clave'?['poison']:typeof saved[key]==='boolean'?!saved[key]:'poison';ok(await trustedKnowledge({...saved,[key]:value}),false);}
for(const patch of [{approval_version:''},{approved_by_admin_id:''},{approved_at:'bad-date'},{approval_sha256:'0'.repeat(64)},{palabras_clave:[null]}])ok(await trustedKnowledge({...saved,...patch}),false);
for(const patch of [{titulo:''},{respuesta:'x'.repeat(16001)},{palabras_clave:[42]},{impuesto:'bad'},{aprobada:'true'}]){assert.throws(()=>normalizeKnowledge({...valid,...patch}));checks++;}
const oldRevision=state.approval_revision;
const unapproved=await saveKnowledge(service,admin,{action:'save',id:state.id,expectedRevision:state.approval_revision,data:{aprobada:false}});ok(unapproved.approved_by_admin_id,'');ok(await trustedKnowledge(unapproved),false);ok(oldRevision!==unapproved.approval_revision,true);
await assert.rejects(()=>saveKnowledge(service,admin,{action:'save',id:state.id,expectedRevision:oldRevision,data:{aprobada:true}}),/KNOWLEDGE_CHANGED/);checks++;
race=true;await assert.rejects(()=>saveKnowledge(service,admin,{action:'save',id:state.id,expectedRevision:state.approval_revision,data:{aprobada:true}}),/KNOWLEDGE_CHANGED/);checks++;
ok(writes,1);ok(created,1);ok(await knowledgeDigest(normalizeKnowledge(valid)),await knowledgeDigest(normalizeKnowledge({...valid,nota_interna:'Nota no compartida'})));
console.log(JSON.stringify({ok:true,checks,externalCalls:0,realKnowledgeWrites:0,financialWrites:0,coverage:'Admin authority, legacy quarantine, exact approved-content digest, denied users, payload allowlist and CAS conflicts'}));
