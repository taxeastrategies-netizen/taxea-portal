// Document references only. No invoice, journal or account is written by this module.
const direct=(entity,urlField,companyField='company_id',extra={})=>({entity,urlField,companyField,...extra});
export const canonicalInventoryJson=value=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
export const BACKUP_DOCUMENT_SOURCES=[
 direct('OcrInvoiceDocument','fileStorageUrl','company_id',{mimeField:'fileMimeType',sizeField:'fileSize'}),
 direct('Invoice','archivo_url'),direct('Invoice','qr_pdf_url','company_id',{variant:true}),
 direct('Document','archivo_url'),direct('HRDocument','archivo_url'),
 direct('MercantilDocumento','fileUrl','__backupCompanyId',{relation:'mercantil',nameField:'nombre'}),
 direct('DocumentAsset','__backupUrl','company_id',{asset:true,nameField:'original_name',mimeField:'mime_type',sizeField:'size'}),
 direct('TaxImporterEvidence','evidenceUrl','companyId'),
 direct('TaxeaAuditFile','storagePath','__backupCompanyId',{relation:'audit',nameField:'originalName',mimeField:'mimeType'}),
 direct('TaxeaAuditReport','pdfUrl','__backupCompanyId',{relation:'audit',nameField:'title'}),
 direct('TaxFiling','justificantePdfUrl','companyId'),direct('TaxFiling','ficheroPresentadoUrl','companyId',{variant:true}),
 direct('Sugerencia','archivo_url'),direct('UtilityDocument','file_uri'),direct('DebtInstrument','documento_url'),
 direct('HRCandidate','cv_url'),direct('Employee','foto_url'),
 direct('InvoiceAttachment','file_uri','company_id',{nameField:'filename',mimeField:'mime_type'}),
 direct('Expense','archivo_url'),direct('TaxOfficialFile','fileUrl','companyId'),
 direct('PaymentRecord','manualEvidenceUrl','__backupCompanyId',{relation:'clientAccount'}),
 direct('TaxObligation','justificante_url'),
 direct('LaborOcrDocument','file_url','company_id',{nameField:'original_file_name'}),
 direct('MercantilExpediente','justificanteLibrosUrl','__backupCompanyId',{relation:'mercantil'}),
 direct('MercantilExpediente','justificanteCuentasUrl','__backupCompanyId',{relation:'mercantil',variant:true}),
 direct('MercantilLibro','archivoFuenteUrl','__backupCompanyId',{relation:'mercantil'}),
 direct('MercantilLibro','justificantePresentacionUrl','__backupCompanyId',{relation:'mercantil',variant:true}),
 direct('MercantilLibro','confirmacionRegistroUrl','__backupCompanyId',{relation:'mercantil',variant:true}),
 direct('TaxSubmission','justificantePdfUrl','companyId'),direct('TaxSubmission','ficheroPresentadoUrl','companyId',{variant:true}),
];
const app='6a00fec50cc522a74ddde4b2';
export function isBackupReference(value){
 if(typeof value==='string'&&new RegExp('^mp/(public|private)/'+app+'/[A-Za-z0-9_./%() -]+$').test(value)&&!value.includes('..'))return true;
 try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&!u.hash&&(
  (u.hostname==='taxeaportal.com'&&/^\/private-document\/[A-Za-z0-9_-]{1,128}$/.test(u.pathname)&&!u.search)||
  (u.hostname==='media.base44.com'&&['files','images'].some(kind=>['public','private'].some(access=>u.pathname.startsWith('/'+kind+'/'+access+'/'+app+'/'))))||
  (u.hostname==='base44.app'&&['public','private'].some(access=>u.pathname.startsWith('/api/apps/'+app+'/files/mp/'+access+'/'+app+'/'))));
 }catch{return false;}
}
export function createBackupContextResolver(service){
 const cache=new Map(),get=(entity,id)=>{const key=entity+':'+id;if(!cache.has(key))cache.set(key,service.entities[entity].get(id).catch(error=>{if(Number(error?.status||error?.response?.status)===404)return null;throw error;}));return cache.get(key);};
 const accountCompany=async id=>{
  if(!id)return '__admin_unassigned__';const company=await get('Company',id);if(company)return company.id;
  const account=await get('ClientAccount',id);if(!account)return '__admin_unassigned__';
  const email=String(account.email||'').trim().toLowerCase(),tax=String(account.taxId||'').replace(/[^A-Za-z0-9]/g,'').toUpperCase();
  if(!email||!tax)return '__admin_unassigned__';
  const companies=await service.entities.Company.filter({owner_email:email},'id',100);
  const matches=companies.filter(c=>String(c.nif_cif||'').replace(/[^A-Za-z0-9]/g,'').toUpperCase()===tax);
  if(matches.length!==1)return '__admin_unassigned__';return matches[0].id;
 };
 return async(source,record)=>{
  if(source.relation==='audit'){const audit=record.auditCaseId?await get('TaxeaAuditCase',record.auditCaseId):null;return accountCompany(audit?.clientId);}
  if(source.relation==='mercantil'){
   let societyId=record.sociedadId;if(!societyId&&record.expedienteId)societyId=(await get('MercantilExpediente',record.expedienteId))?.sociedadId;
   const society=societyId?await get('MercantilSociedad',societyId):null;return accountCompany(society?.clienteAccountId);
  }
  if(source.relation==='clientAccount')return accountCompany(record.clientAccountId);
  return record[source.companyField]||'__admin_unassigned__';
 };
}
export function freshInventory(jobId,cutoff,scopeCompanyId=''){
 if(!jobId||!Number.isFinite(Date.parse(cutoff)))throw Error('BACKUP_INVENTORY_INVALID');
 return{version:1,jobId,cutoff,scopeCompanyId,source:0,afterId:'',parts:[],count:0,rowsRead:0,unassigned:0,excludedExternal:0,done:false};
}
export async function advanceDocumentInventory({service,state,resolveCompany,uploadPage,persist,now=Date.now,deadline,pageSize=500,sources=BACKUP_DOCUMENT_SOURCES}){
 if(state?.version!==1||!Array.isArray(state.parts)||!Number.isInteger(state.source)||state.source<0||state.source>sources.length)throw Error('BACKUP_INVENTORY_INVALID');
 let current=structuredClone(state);
 while(current.source<sources.length&&now()<deadline-10000){
  const source=sources[current.source],query={created_date:{$lte:current.cutoff}};
  if(current.afterId)query.id={$gt:current.afterId};
  if(current.scopeCompanyId&&!source.relation)query[source.companyField]=current.scopeCompanyId;
  if(source.asset)query.status='ready';
  const rows=await service.entities[source.entity].filter(query,'id',pageSize);
  if(!Array.isArray(rows)||rows.length>pageSize)throw Error('BACKUP_INVENTORY_PAGE_INVALID');
  let previous=current.afterId;for(const row of rows){if(typeof row.id!=='string'||row.id<=previous)throw Error('BACKUP_INVENTORY_ORDER_INVALID');previous=row.id;}
  const documents=[];let unassigned=0,excludedExternal=0;
  for(const row of rows){
   const reference=source.asset?'https://taxeaportal.com/private-document/'+row.id:row[source.urlField];
   if(typeof reference!=='string'||!reference.trim())continue;
   if(!isBackupReference(reference)){excludedExternal++;continue;}
   const companyId=await resolveCompany(source,row);
   if(current.scopeCompanyId&&companyId!==current.scopeCompanyId)continue;
   const record={id:row.id,[source.urlField]:reference,[source.companyField]:companyId,__backupRecordId:row.id,__backupField:source.urlField};
   for(const key of [source.nameField,source.mimeField,source.sizeField,'numero_factura','tipo','nombre','documentType','originalFileName','fileName','sociedadId','expedienteId','auditCaseId'].filter(Boolean))if(row[key]!==undefined)record[key]=row[key];
   if(source.variant)record.id=row.id+'@'+source.urlField;
   if(companyId==='__admin_unassigned__')unassigned++;
   documents.push({record,source});
  }
  let part=null;
  if(documents.length){
   const index=current.parts.length;
   part=await uploadPage({version:1,jobId:current.jobId,scopeCompanyId:current.scopeCompanyId,index,documents});
   if(!part?.id||!/^[a-f0-9]{64}$/.test(part.sha256))throw Error('BACKUP_INVENTORY_PART_INVALID');
   part={id:part.id,sha256:part.sha256,count:documents.length,index};
  }
  const finished=rows.length<pageSize;
  current={...current,source:current.source+(finished?1:0),afterId:finished?'':previous,parts:part?[...current.parts,part]:current.parts,count:current.count+documents.length,rowsRead:current.rowsRead+rows.length,unassigned:current.unassigned+unassigned,excludedExternal:current.excludedExternal+excludedExternal};
  current.done=current.source===sources.length;
  await persist(current);
 }
 return current;
}
export async function loadInventoryDocuments(state,loadPage,hash){
 if(!state?.done)throw Error('BACKUP_INVENTORY_INCOMPLETE');
 const documents=[],seen=new Set();
 for(const part of state.parts){
  const bytes=await loadPage(part.id);if(await hash(bytes)!==part.sha256)throw Error('BACKUP_INVENTORY_HASH_MISMATCH');
  const page=JSON.parse(new TextDecoder().decode(bytes));
  if(page.version!==1||page.jobId!==state.jobId||page.scopeCompanyId!==state.scopeCompanyId||page.index!==part.index||!Array.isArray(page.documents)||page.documents.length!==part.count)throw Error('BACKUP_INVENTORY_PART_INVALID');
  for(const doc of page.documents){const key=doc.source.entity+':'+doc.record.id;if(seen.has(key))throw Error('BACKUP_INDEX_DUPLICATE');seen.add(key);documents.push(doc);}
 }
 if(documents.length!==state.count)throw Error('BACKUP_INVENTORY_COUNT_MISMATCH');return documents;
}
