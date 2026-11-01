const failures=new WeakMap();

// Only messages deliberately constructed in this handler may reach its users.
export class PublicAccountingError extends Error {
  constructor(message,status=500){super(String(message));this.name='PublicAccountingError';this.publicMessage=String(message).slice(0,700);this.status=status;}
}

export function publicAccountingFailure(error){
  if(error instanceof PublicAccountingError)return {message:error.publicMessage,status:error.status,requestId:null};
  if(error&&typeof error==='object'&&failures.has(error))return failures.get(error);
  let status=500;
  try{const code=Number(error?.status??error?.response?.status);if(Number.isInteger(code)&&code>=400&&code<600)status=code;}catch{}
  const requestId=globalThis.crypto?.randomUUID?.()||'acct-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);
  const result={message:'No se pudo completar la operación contable. Referencia: '+requestId+'.',status,requestId};
  if(error&&typeof error==='object')failures.set(error,result);
  // Do not log provider bodies, request configuration, SQL or credentials.
  console.error('[accountingOperations]',{requestId,status,type:typeof error?.name==='string'&&/^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(error.name)?error.name:'Error'});
  return result;
}
