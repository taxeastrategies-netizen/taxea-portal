const CHARS=6000,MODE='tax-private-chunks-v1';
const fail=message=>Object.assign(new Error(message),{status:409,taxModelPublic:true});
const digest=async value=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',typeof value==='string'?new TextEncoder().encode(value):value))].map(n=>n.toString(16).padStart(2,'0')).join('');
const raw=base64=>Uint8Array.from(atob(base64),c=>c.charCodeAt(0));
async function chunks(svc,file){const rows=[];for(let skip=0;skip<10000;skip+=500){const page=await svc.entities.TaxOfficialFileChunk.filter({companyId:file.companyId,fileId:file.id},'index',500,skip);rows.push(...page);if(page.length<500)return rows;}throw fail('El archivo supera el límite de fragmentos de consulta segura.');}

export async function taxFileContent(svc,file){
 if(file.storageMode!==MODE)return String(file.contentBase64||'');
 if(file.storageState!=='ready')throw fail('El fichero fiscal aún no está completo. Repite su preparación exacta para reanudarlo.');
 const rows=await chunks(svc,file),count=Number(file.chunkCount);rows.sort((a,b)=>a.index-b.index);
 if(!Number.isInteger(count)||count<1||rows.length!==count)throw fail('La copia del fichero fiscal está incompleta.');
 for(let index=0;index<rows.length;index++)if(rows[index].index!==index||typeof rows[index].contentBase64!=='string'||rows[index].contentBase64.length>CHARS||await digest(rows[index].contentBase64)!==rows[index].hash)throw fail('Un fragmento fiscal está repetido o no coincide con su huella.');
 const value=rows.map(r=>r.contentBase64).join('');if(await digest(raw(value))!==String(file.hash).toLowerCase())throw fail('El contenido fiscal conservado no coincide con su huella.');return value;
}

export async function saveTaxFile(svc,metadata,contentBase64,existing=null){
 const hash=await digest(raw(contentBase64));if(hash!==metadata.hash)throw fail('La huella fiscal no corresponde al contenido preparado.');
 if(existing&&existing.storageState==='ready'){if(await taxFileContent(svc,existing)!==contentBase64)throw fail('El archivo conservado no corresponde a esta preparación.');return existing;}
 if(contentBase64.length<=CHARS&&!existing)return svc.entities.TaxOfficialFile.create({...metadata,contentBase64,storageState:'ready'});
 let file=existing;
 if(file&&file.hash!==hash)throw fail('El fichero parcial no corresponde al contenido exacto; no se sobrescribe.');
 if(!file)file=await svc.entities.TaxOfficialFile.create({...metadata,contentBase64:'',storageMode:MODE,storageState:'building',chunkCount:Math.ceil(contentBase64.length/CHARS)});
 if(file.storageMode!==MODE)throw fail('La copia anterior no permite una sustitución implícita.');
 try{
  const parts=[];for(let offset=0;offset<contentBase64.length;offset+=CHARS)parts.push(contentBase64.slice(offset,offset+CHARS));
  if(file.chunkCount!==parts.length)throw fail('El número de fragmentos fiscales difiere de la reserva original.');
  const rows=await chunks(svc,file),seen=new Set();
  for(const row of rows){if(!Number.isInteger(row.index)||row.index<0||row.index>=parts.length||seen.has(row.index)||row.contentBase64!==parts[row.index]||await digest(row.contentBase64)!==row.hash)throw fail('Una copia parcial contiene fragmentos fiscales distintos o repetidos.');seen.add(row.index);}
  const missing=[];for(let index=0;index<parts.length;index++)if(!seen.has(index))missing.push({companyId:file.companyId,fileId:file.id,index,contentBase64:parts[index],hash:await digest(parts[index]),createdAt:new Date().toISOString()});
  for(let offset=0;offset<missing.length;offset+=25)await svc.entities.TaxOfficialFileChunk.bulkCreate(missing.slice(offset,offset+25));
  const ready=await svc.entities.TaxOfficialFile.update(file.id,{storageState:'ready'});
  if(await taxFileContent(svc,ready)!==contentBase64)throw fail('La lectura del fichero fiscal no coincide con el original.');
  return ready;
 }catch(error){await svc.entities.TaxOfficialFile.update(file.id,{storageState:'failed'}).catch(()=>{});throw error;}
}

export async function hydrateTaxFile(svc,file){return {...file,contentBase64:await taxFileContent(svc,file)};}

export function taxStorageClient(service){
 const original=service.entities.TaxOfficialFile;
 const wrapped=new Proxy(original,{get(target,key){if(key==='create')return async payload=>{
  let release=async()=>{};
  if(!payload.exportKey){const token=crypto.randomUUID(),result=await service.entities.Company.updateMany({id:payload.companyId,$or:[{tax_artifact_lock_token:''},{tax_artifact_lock_token:null},{tax_artifact_lock_token:{$exists:false}}]},{$set:{tax_artifact_lock_token:token,tax_artifact_lock_started_at:new Date().toISOString()}});if(Number(result?.updated)!==1)throw fail('Ya existe una preparación fiscal en curso para esta empresa.');release=()=>service.entities.Company.updateMany({id:payload.companyId,tax_artifact_lock_token:token},{$set:{tax_artifact_lock_token:'',tax_artifact_lock_started_at:''}});}
  try{
   const storageKey=payload.exportKey||'blob:'+await digest(JSON.stringify({companyId:payload.companyId,model:payload.modeloCodigo,year:payload.ejercicio,period:payload.periodo,hash:payload.hash,name:payload.nombreFichero,sourceHash:payload.sourceHash||'',snapshotHash:payload.snapshotHash||''}));
   const candidates=await original.filter({companyId:payload.companyId,storageKey},'-fechaGeneracion',3);
   if(candidates.length>1)throw fail('Hay varias reservas para esta preparación fiscal.');
   const file=await saveTaxFile(service,{...payload,storageKey,contentBase64:undefined},payload.contentBase64,candidates[0]||null);
   return {...file,contentBase64:payload.contentBase64};
  }catch(error){if(Number(error?.response?.status||error?.status)===429)throw Object.assign(new Error('Base44 ha limitado temporalmente las peticiones. El archivo parcial se conserva: espera y repite la preparación para reanudarlo.'),{status:429,taxModelPublic:true});throw error;}
  finally{await release();}
 };const value=target[key];return typeof value==='function'?value.bind(target):value;}});
 return {...service,entities:new Proxy(service.entities,{get(target,key){return key==='TaxOfficialFile'?wrapped:target[key];}})};
}
