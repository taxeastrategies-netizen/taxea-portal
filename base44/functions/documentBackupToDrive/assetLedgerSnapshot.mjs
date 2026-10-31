import{snapshotLegacyAliases}from'./legacyAliasSnapshot.mjs';
const privateId=value=>{try{const u=new URL(value);if(u.origin!=='https://taxeaportal.com'||u.search||u.hash)return'';return u.pathname.match(/^\/private-document\/([A-Za-z0-9_-]{1,128})$/)?.[1]||'';}catch{return'';}};
export async function snapshotPrivateAssetLedger(service,user,documents,manifest){
 if(!user?.id||!['admin','super_admin'].includes(user.role)||[user,user.data].filter(Boolean).some(s=>s.is_deleted||['eliminado','bloqueado','suspendido'].includes(String(s.status||'').toLowerCase())||['disabled','deleted','blocked','suspended'].includes(String(s.accountAccessStatus||'').toLowerCase())))throw Error('BACKUP_LEDGER_ADMIN_ONLY');
 const refs=[],companies=new Map();
 for(const{source,record}of documents){const id=privateId(record[source.urlField]);if(!id)continue;const companyId=record[source.companyField];if(companies.has(id)&&companies.get(id)!==companyId)throw Error('BACKUP_LEDGER_COMPANY_MISMATCH');companies.set(id,companyId);refs.push({entity:source.entity,recordId:record.__backupRecordId||record.id,fileField:source.urlField,assetId:id,companyId});}
 const legacy=await snapshotLegacyAliases(service,documents);
 for(const ref of legacy.references){if(companies.has(ref.assetId)&&companies.get(ref.assetId)!==ref.companyId)throw Error('BACKUP_LEDGER_COMPANY_MISMATCH');companies.set(ref.assetId,ref.companyId);refs.push(ref);}
 const assets=[];
 for(const[id,companyId]of companies){
  const row=await service.entities.DocumentAsset.get(id).catch(()=>null);
  if(!row||row.company_id!==companyId||row.status!=='ready'||!String(row.object_name||'').startsWith('companies/'+companyId+'/')||!/^\d+$/.test(row.generation||'')||!/^[a-f0-9]{64}$/.test(row.sha256||'')||!Number.isSafeInteger(row.size)||row.size<1)throw Error('BACKUP_LEDGER_UNVERIFIED');
  for(const alias of legacy.aliases.filter(a=>a.asset_id===id)){if(alias.company_id!==row.company_id||alias.sha256!==row.sha256||alias.size!==row.size)throw Error('BACKUP_ALIAS_UNVERIFIED');}
  const saved={};for(const key of ['id','company_id','object_name','generation','sha256','size','mime_type','original_name','status','storage_provider','uploaded_by','purpose','verified_at','restored_at','restore_source_generation'])if(row[key]!==undefined)saved[key]=row[key];
  const copies=manifest.filter(m=>m.clientAccountId===companyId&&m.checksum===row.sha256&&m.size===row.size&&m.driveFileId&&['copied','skipped_existing','skipped_unchanged','backed_up'].includes(m.status));
  saved.backupReady=copies.length>0;saved.backupFileIds=[...new Set(copies.map(m=>m.driveFileId))];assets.push(saved);
 }
 return{version:2,legacyAliasCount:legacy.aliases.length,legacyAliases:legacy.aliases,assetCount:assets.length,referenceCount:refs.length,assets,references:refs,scope:'DocumentAsset metadata and attachment relations only; no invoice, journal or account data',restoresExecuted:0};
}
