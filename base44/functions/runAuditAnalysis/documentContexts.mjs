import {isStorageAdmin,storageCompany} from './storageRuntime.generated.mjs';
const valid=value=>/^[A-Za-z0-9_-]{1,128}$/.test(value||'');
const norm=value=>String(value||'').trim().toLowerCase();
const tax=value=>String(value||'').replace(/[^a-z0-9]/gi,'').toUpperCase();
export async function linkedStorageCompany(service,user,reference){
 if(reference&&valid(reference)){
  const direct=await service.entities.Company.get(reference).catch(()=>null);
  if(direct){const company=await storageCompany(service,user,direct.id);if(!company)throw Error('STORAGE_CONTEXT_FORBIDDEN');return company;}
  const account=await service.entities.ClientAccount.get(reference).catch(()=>null);
  if(account){
   // Account IDs and Company IDs are separate namespaces. Do not link by name,
   // approximate NIF, AI output or whichever company happens to be active.
   const email=norm(account.email),nif=tax(account.taxId);
   if(email&&nif){
    const matches=await service.entities.Company.filter({owner_email:email},'-created_date',100,0);
    const exact=(matches||[]).filter(row=>norm(row.owner_email)===email&&tax(row.nif_cif)===nif);
    if(exact.length===1){const company=await storageCompany(service,user,exact[0].id);if(!company)throw Error('STORAGE_CONTEXT_FORBIDDEN');return company;}
    if(exact.length>1)throw Error('STORAGE_CONTEXT_AMBIGUOUS');
   }
  }
 }
 if(!isStorageAdmin(user))throw Error('STORAGE_CONTEXT_UNLINKED');
 // Unassigned administrative files remain private and admin-only until an
 // adviser explicitly assigns them. No real profile or subaccount is changed.
 return{id:'__admin_staging__',activa:true,private_document_storage_enabled:true};
}
export async function contextStorageCompany(service,user,kind,id){
 if(!valid(id)||!['audit','mercantil'].includes(kind))throw Error('STORAGE_CONTEXT_INVALID');
 if(kind==='audit'&&!isStorageAdmin(user))throw Error('STORAGE_CONTEXT_FORBIDDEN');
 const record=await service.entities[kind==='audit'?'TaxeaAuditCase':'MercantilSociedad'].get(id).catch(()=>null);
 if(!record)throw Error('STORAGE_CONTEXT_NOT_FOUND');
 return linkedStorageCompany(service,user,kind==='audit'?record.clientId:record.clienteAccountId);
}
