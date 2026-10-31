export async function readPublicInvoiceRequest(req){
 if(Number(req.headers.get('content-length')||0)>8192)throw new Error('INVALID_PUBLIC_REQUEST');
 const reader=req.body?.getReader();if(!reader)throw new Error('INVALID_PUBLIC_REQUEST');
 let timer,size=0;const parts=[];
 const expired=new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('INVALID_PUBLIC_REQUEST')),5000);});
 try{for(;;){const {done,value}=await Promise.race([reader.read(),expired]);if(done)break;size+=value.length;if(size>8192)throw new Error('INVALID_PUBLIC_REQUEST');parts.push(value);}
  const bytes=new Uint8Array(size);let at=0;for(const p of parts){bytes.set(p,at);at+=p.length;}
  const body=JSON.parse(new TextDecoder().decode(bytes));if(!body||typeof body!=='object'||Array.isArray(body))throw new Error('INVALID_PUBLIC_REQUEST');return body;
 }finally{clearTimeout(timer);void reader.cancel().catch(()=>{});reader.releaseLock();}
}
