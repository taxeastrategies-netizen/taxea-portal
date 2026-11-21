import { verifiedCompanyAssignment } from './verifiedCompanyAssignment.mjs';
import { PublicDomainError } from './publicServiceError.mjs';
const lower=v=>String(v||'').trim().toLowerCase();
export function accountDisabled(user){return [user,user?.data].filter(Boolean).some(r=>r.is_deleted===true||['eliminado','bloqueado','suspendido'].includes(lower(r.status))||['suspended','blocked','disabled','deleted'].includes(lower(r.accountAccessStatus)));}
export async function authorizeReport(svc,user,companyId){
  if(!user)throw new PublicDomainError('Necesitas iniciar sesión.',401);
  if(accountDisabled(user))throw new PublicDomainError('Acceso al portal suspendido.',403);
  if(typeof companyId!=='string'||!/^[a-zA-Z0-9_-]{8,100}$/.test(companyId))throw new PublicDomainError('Empresa no válida.',400);
  const company=await svc.entities.Company.get(companyId).catch(()=>null);
  if(!company)throw new PublicDomainError('No tienes acceso a esta empresa.',403);
  const email=lower(user.email),admin=['admin','super_admin'].includes(lower(user.role||user.data?.role));
  const allowed=admin||(email&&email===lower(company.owner_email))||(email&&(company.usuarios_autorizados||[]).some(v=>lower(v)===email))||await verifiedCompanyAssignment(svc,user,companyId);
  if(!allowed||(!admin&&company.activa===false))throw new PublicDomainError('No tienes acceso a esta empresa.',403);
  return company;
}
