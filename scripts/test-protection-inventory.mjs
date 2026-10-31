import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {inventoryPreview} from '../base44/functions/documentBackupToDrive/inventoryPreview.mjs';
import {backupSnapshot} from '../base44/functions/documentBackupToDrive/backupRuntime.mjs';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex'),admin={id:'admin',role:'admin'};
let checks=0;const check=(ok,label)=>{assert.ok(ok,label);checks++;};
function fixture({lostAck=false,rejectLongStrings=false}={}){
 const files='https://media.base44.com/files/public/6a00fec50cc522a74ddde4b2/qa.pdf',rows={Document:[
  {id:'01',created_date:'2020-01-01',company_id:'A',archivo_url:files,nombre:'QA A',secretField:'EXCLUDE THIS'},
  {id:'02',created_date:'2020-01-01',company_id:'B',archivo_url:files,nombre:'QA B'},
  {id:'03',created_date:'2020-01-01',company_id:'A',archivo_url:'https://taxeaportal.com/private-document/private-a'},
  {id:'04',created_date:'2020-01-01',archivo_url:files},
  {id:'05',created_date:'2020-01-01',company_id:'A',archivo_url:'https://unrelated.example/file.pdf'},
 ],DocumentAsset:[{id:'private-a',created_date:'2020-01-01',company_id:'A',status:'ready',original_name:'QA.pdf',mime_type:'application/pdf',size:7}],BackupJob:[],BackupJobItem:[]};
 let calls=0,seq=0,failed=false;const mutations=[];
 const select=(list,q,sort,limit)=>list.filter(r=>Object.entries(q).every(([key,value])=>value&&typeof value==='object'?(value.$lte?r[key]<=value.$lte:value.$gt?r[key]>value.$gt:false):r[key]===value)).sort((a,b)=>sort==='id'?a.id.localeCompare(b.id):0).slice(0,limit);
 const service={entities:new Proxy({}, {get(_t,name){return{
  async filter(q,sort,limit=500){calls++;return select(rows[name]||[],q,sort,limit);},
  async get(id){calls++;const row=(rows[name]||[]).find(r=>r.id===id);if(!row)throw Object.assign(Error('missing'),{status:404});return structuredClone(row);},
  async create(value){calls++;if(rejectLongStrings&&Object.values(value).some(v=>typeof v==='string'&&v.length>10000))throw Object.assign(Error('Synthetic string field limit'),{status:400});if(!['BackupJob','BackupJobItem'].includes(name))throw Error('Unexpected business write');const row={...value,id:'qa-'+(++seq)};rows[name].push(row);mutations.push(name);if(name==='BackupJobItem'&&lostAck&&!failed){failed=true;throw Error('lost ack');}return structuredClone(row);},
  async update(id,patch){calls++;if(rejectLongStrings&&Object.values(patch).some(v=>typeof v==='string'&&v.length>10000))throw Object.assign(Error('Synthetic string field limit'),{status:400});if(name!=='BackupJob')throw Error('Unexpected business write');const row=rows[name].find(r=>r.id===id);Object.assign(row,patch);mutations.push(name);return structuredClone(row);}
 };}})};
 const execute=(body={},user=admin,scopeCompanyId='')=>inventoryPreview({service,user,body,scopeCompanyId,deadline:Date.now()+30000,hash,snapshot:backupSnapshot});
 return{rows,execute,mutations,get calls(){return calls;}};
}
let f=fixture(),result=await f.execute();check(result.ok&&result.status==='completed','inventory completes without copying source bytes');check(result.referencesScanned===5,'all valid references across private assets and documents counted');check(result.privateReferences===2&&result.privateUniqueFiles===1,'private references and physical assets distinguished');check(result.nativeReferences===3&&result.nativeFilesByCompany===3,'same native file scoped separately for each company and unassigned');check(result.sharedNativeReferenceGroups===1,'cross-company native reuse highlighted for ownership review');check(result.unassignedReferences===1&&result.externalReferencesExcluded===1,'unassigned and external references not silently attributed');check(result.sourceBytesCopied===0&&result.historicalDocumentsMigrated===0&&result.originalsDeleted===0&&result.financialWrites===0,'preview is metadata-only');check(!JSON.stringify(f.rows.BackupJobItem).includes('EXCLUDE THIS'),'irrelevant private record fields excluded');check(f.mutations.every(name=>['BackupJob','BackupJobItem'].includes(name)),'only inventory ledger models written');
const count=f.rows.BackupJobItem.length;result=await f.execute({inventoryJobId:result.inventoryJobId});check(result.ok&&f.rows.BackupJobItem.length===count,'replay verifies existing pages without creating duplicates');
f.rows.BackupJobItem[0].inventoryPageData=Object.fromEntries(Object.entries(f.rows.BackupJobItem[0].inventoryPageData).reverse());result=await f.execute({inventoryJobId:result.inventoryJobId});check(result.ok,'object-key reordering in database serialization does not corrupt the canonical hash');
f.rows.BackupJobItem[0].inventoryPageData={};result=await f.execute({inventoryJobId:result.inventoryJobId});check(!result.ok&&result.code==='BACKUP_INVENTORY_HASH_MISMATCH','stored metadata tampering detected');
f=fixture();result=await f.execute({},admin,'A');check(result.ok&&result.referencesScanned===3&&result.nativeReferences===1,'QA scope excludes company B and unassigned data');await assert.rejects(()=>f.execute({inventoryJobId:result.inventoryJobId},admin,'B'),/JOB_UNAVAILABLE/);checks++;
f=fixture();await assert.rejects(()=>f.execute({}, {id:'normal',role:'user'}),/ADMIN_ONLY/);checks++;check(f.calls===0,'non-admin denied before metadata access');
f=fixture({lostAck:true});result=await f.execute();check(!result.ok&&result.canResume&&result.inventoryJobId,'lost metadata acknowledgement keeps a resumable job');const firstId=f.rows.BackupJobItem[0].id;result=await f.execute({inventoryJobId:result.inventoryJobId});check(result.ok&&f.rows.BackupJobItem[0].id===firstId,'lost acknowledgement recovered by exact page hash');check(f.rows.BackupJobItem.length===2,'no duplicate inventory pages after retry');
f=fixture({rejectLongStrings:true});const seed=f.rows.Document[0];f.rows.Document=Array.from({length:100},(_,index)=>({...seed,id:String(index+1).padStart(24,'0')}));result=await f.execute();check(result.ok&&result.referencesScanned===101,'structured inventory pages survive a provider string-length limit on large batches');check(f.rows.BackupJobItem.some(page=>JSON.stringify(page.inventoryPageData).length>10000),'large metadata object actually exceeds the simulated string limit');
console.log(JSON.stringify({ok:true,checks,sourceBytesCopied:0,financialWrites:0,realDataRead:0}));
