const normalized=value=>String(value||'').trim().toLowerCase();
export function taxModelUserEnabled(user){return !!user?.id&&![user,user.data].filter(Boolean).some(s=>s.is_deleted===true||['eliminado','bloqueado','suspendido'].includes(normalized(s.status))||['disabled','deleted','blocked','suspended'].includes(normalized(s.accountAccessStatus)));}
export function taxModelCompanyAllowed(user,companyId,company){
 if(!taxModelUserEnabled(user)||!company||String(company.id||'')!==companyId)return false;
 if(['admin','super_admin'].includes(normalized(user.role)))return true;
 if(company.activa===false)return false;
 const email=normalized(user.email);if(!email)return false;
 return email===normalized(company.owner_email)||(Array.isArray(company.usuarios_autorizados)&&company.usuarios_autorizados.some(v=>normalized(v)===email));
}
export function taxModelValidation(message,status=422){return Object.assign(new Error(message),{status,taxModelPublic:true});}
export function taxModelPublicError(error){
 if(error?.taxModelPublic===true&&[400,401,403,404,409,413,422,429].includes(Number(error.status)))return{status:Number(error.status),message:String(error.message||'Solicitud no válida.').slice(0,2000),code:'TAX_MODEL_VALIDATION'};
 return{status:500,message:'No se pudo completar la operación del modelo tributario. Reintenta o contacta con Taxea.',code:'TAX_MODEL_UNAVAILABLE'};
}
