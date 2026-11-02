// Legacy company assignment is trusted only after reading the persisted User row.
// User.company_id is admin-write-only in its schema. Never authorize from session data.
const text=v=>String(v??'').trim(),lower=v=>text(v).toLowerCase();
export async function verifiedCompanyAssignment(svc,user,companyId){
 if(!user?.id||!user?.email||!companyId||typeof svc?.entities?.User?.get!=='function')return false;
 const stored=await svc.entities.User.get(user.id).catch(()=>null);
 if(!stored||stored.id!==user.id||lower(stored.email)!==lower(user.email))return false;
 if([stored,stored.data].filter(Boolean).some(row=>row.is_deleted===true||['eliminado','bloqueado','suspendido'].includes(lower(row.status))||['deleted','blocked','disabled','suspended'].includes(lower(row.accountAccessStatus))))return false;
 return text(stored.data?.company_id||stored.company_id)===text(companyId);
}
