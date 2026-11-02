const roles=new Set(['admin','super_admin']);
const lower=value=>String(value||'').trim().toLowerCase();
const disabled=user=>[user,user?.data].filter(Boolean).some(v=>v.is_deleted===true||['eliminado','bloqueado','suspendido'].includes(lower(v.status))||['blocked','disabled','deleted','suspended'].includes(lower(v.accountAccessStatus)));
// auth.me is validated by Base44. A stored client record can never become the
// platform's virtual scheduler merely by supplying is_service or an email.
export async function recurringCallerIdentity(user,loadStoredUser){
 if(!user?.id||disabled(user))return {allowed:false,isService:false,isAdminUser:false,freshUser:null};
 let freshUser=null;
 try{freshUser=await loadStoredUser(user.id);}catch(error){if(Number(error?.response?.status||error?.status)!==404)throw error;}
 if(freshUser){if(disabled(freshUser))return {allowed:false,isService:false,isAdminUser:false,freshUser};return {allowed:true,isService:false,isAdminUser:roles.has(lower(freshUser.role)),freshUser};}
 const virtualService=user.is_service===true&&/^service\+[a-f0-9-]+@no-reply\.base44\.com$/i.test(String(user.email||''));
 return {allowed:virtualService,isService:virtualService,isAdminUser:false,freshUser:null};
}
