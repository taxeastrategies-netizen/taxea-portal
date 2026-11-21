export class PublicDomainError extends Error{
 constructor(message,status=500){super(message);this.name='PublicDomainError';this.publicDomainError=true;this.status=status;}
}
export function publicServiceFailure(error,operation){
 if(error instanceof PublicDomainError&&[400,401,403,404,409,413,422,429,500].includes(Number(error.status)))return Response.json({error:String(error.message).slice(0,2000),code:'DOMAIN_VALIDATION'},{status:Number(error.status),headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 const requestId=globalThis.crypto?.randomUUID?.()||'internal-error';
 const status=Number(error?.response?.status||error?.status||500);
 console.error('taxea_backend_failure',{operation,requestId,upstreamStatus:Number.isInteger(status)&&status>=100&&status<=599?status:500});
 return Response.json({error:'No se pudo completar la operación. Reintenta o contacta con Taxea indicando esta referencia.',code:'INTERNAL_OPERATION_FAILED',requestId},{status:500,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
