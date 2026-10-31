import{normalizeLegacyDocumentReference}from'./legacyNativeReference.mjs';
const hash=async b=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(n=>n.toString(16).padStart(2,'0')).join('');
export async function snapshotLegacyAliases(service,documents){
 const groups=new Map();
 for(const{source,record}of documents){const reference=normalizeLegacyDocumentReference(record[source.urlField]);if(!reference)continue;const companyId=record[source.companyField],digest=await hash(new TextEncoder().encode(reference)),key=companyId+'|'+digest;
  if(!groups.has(key))groups.set(key,{companyId,digest,refs:[]});groups.get(key).refs.push({entity:source.entity,recordId:record.__backupRecordId||record.id,fileField:source.urlField,companyId});
 }
 const byCompany=new Map();for(const g of groups.values()){if(!byCompany.has(g.companyId))byCompany.set(g.companyId,[]);byCompany.get(g.companyId).push(g);}
 const aliases=[],references=[];
 for(const[companyId,items]of byCompany)for(let at=0;at<items.length;at+=100){const batch=items.slice(at,at+100),digests=batch.map(g=>g.digest),rows=await service.entities.DocumentLegacyReference.filter({company_id:companyId,reference_digest:{$in:digests}},'id',batch.length+1),seen=new Set();
  if(rows.length>batch.length)throw Error('BACKUP_ALIAS_AMBIGUOUS');
  for(const row of rows){if(row.company_id!==companyId||!digests.includes(row.reference_digest)||seen.has(row.reference_digest)||row.status!=='verified'||!/^[A-Za-z0-9_-]{1,128}$/.test(row.asset_id||''))throw Error('BACKUP_ALIAS_UNVERIFIED');seen.add(row.reference_digest);
   const saved={};for(const k of ['id','company_id','reference_digest','asset_id','sha256','size','plan_id','protection_job_id','status','source_references','linked_by','linked_at','disabled_at'])if(row[k]!==undefined)saved[k]=row[k];aliases.push(saved);
   for(const ref of groups.get(companyId+'|'+row.reference_digest).refs)references.push({...ref,assetId:row.asset_id,legacyReferenceDigest:row.reference_digest});
  }
 }
 return{aliases,references};
}
