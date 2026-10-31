export const MERCANTIL_ENTITIES=['MercantilSociedad','MercantilExpediente','MercantilLibro','MercantilDocumento','MercantilHistorial'];
const methods=new Set(['list','filter','get','create','bulkCreate','update','delete']);
export function createMercantilEntities(client){
 const cache=new Map();
 return new Proxy(client.entities,{get(target,name,receiver){
  if(!MERCANTIL_ENTITIES.includes(name))return Reflect.get(target,name,receiver);
  if(!cache.has(name))cache.set(name,new Proxy({}, {get(_,method){
   if(!methods.has(method))return undefined;
   return async(...args)=>{
    const response=await client.functions.invoke('mercantilDocumentOperations',{entity:name,method,args});
    const data=response?.data??response;
    if(data?.ok!==true||!Object.hasOwn(data,'result'))throw new Error(data?.error||'No se pudo completar la operación de Mercantil.');
    return data.result;
   };
  }}));
  return cache.get(name);
 }});
}
