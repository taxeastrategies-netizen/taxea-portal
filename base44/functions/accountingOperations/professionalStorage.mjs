import {ExportError,sha256} from './a3Importia.mjs';
import {base64,fromBase64} from './professionalFiles.mjs';

// Base44 limits individual string fields. Each private chunk stays below the
// size already accepted by the live service; the logical file keeps one hash.
export const PRIVATE_EXPORT_CHUNK_CHARS=6000;
const MODE='private-chunks-v1';
const problem=message=>new ExportError(message,409);

async function chunksFor(svc,companyId,file,fetchAll){
 return fetchAll(svc.entities.ProfessionalExportChunk,{companyId,batchId:file.batchId,fileId:file.id},'index',500);
}

export async function readFileContent(svc,companyId,file,fetchAll){
 if(file.companyId!==companyId)throw problem('El archivo no pertenece a esta empresa.');
 if(file.storageMode!==MODE)return String(file.contentBase64||'');
 if(file.contentBase64)throw problem('El archivo mezcla dos versiones de almacenamiento.');
 const count=Number(file.chunkCount),rows=await chunksFor(svc,companyId,file,fetchAll);
 if(!Number.isInteger(count)||count<1||count>200||rows.length!==count)throw problem('Faltan fragmentos del archivo privado. Puedes reanudar la preparación sin sustituir lo ya guardado.');
 rows.sort((a,b)=>a.index-b.index);
 for(let index=0;index<count;index++){
  const row=rows[index];
  if(row.index!==index||typeof row.contentBase64!=='string'||row.contentBase64.length>PRIVATE_EXPORT_CHUNK_CHARS||await sha256(row.contentBase64)!==row.hash)throw problem('Un fragmento privado falta, está duplicado o no coincide con su huella.');
 }
 return rows.map(r=>r.contentBase64).join('');
}

export async function storeProfessionalFile({svc,companyId,batchId,file,existing,fetchAll}){
 const hash=await sha256(file.bytes),encoded=base64(file.bytes),found=existing.filter(f=>f.name===file.name);
 if(found.length>1)throw problem('Hay dos registros para un mismo archivo; se conservan para revisión.');
 let stored=found[0];
 if(stored&&(stored.hash!==hash||Number(stored.size)!==file.bytes.length||stored.kind!==file.kind))throw problem('La copia parcial pertenece a otro contenido; no se sobrescribe.');
 if(!stored){stored=await svc.entities.ProfessionalExportFile.create({companyId,batchId,name:file.name,kind:file.kind,hash,size:file.bytes.length,contentBase64:'',storageMode:MODE,chunkCount:Math.ceil(encoded.length/PRIVATE_EXPORT_CHUNK_CHARS),immutable:true,createdAt:new Date().toISOString()});existing.push(stored);}
 if(stored.storageMode!==MODE){if(await sha256(fromBase64(stored.contentBase64))!==hash)throw problem('La copia anterior no coincide con su huella.');return stored;}
 const values=[];for(let offset=0;offset<encoded.length;offset+=PRIVATE_EXPORT_CHUNK_CHARS)values.push(encoded.slice(offset,offset+PRIVATE_EXPORT_CHUNK_CHARS));
 if(stored.chunkCount!==values.length)throw problem('El número de fragmentos guardado no coincide con el archivo exacto.');
 const rows=await chunksFor(svc,companyId,stored,fetchAll),seen=new Set();
 for(const row of rows){if(!Number.isInteger(row.index)||row.index<0||row.index>=values.length||seen.has(row.index)||row.contentBase64!==values[row.index]||await sha256(row.contentBase64)!==row.hash)throw problem('Una copia parcial contiene fragmentos distintos o repetidos; se conserva para revisión.');seen.add(row.index);}
 const missing=[];for(let index=0;index<values.length;index++)if(!seen.has(index))missing.push({companyId,batchId,fileId:stored.id,index,contentBase64:values[index],hash:await sha256(values[index]),createdAt:new Date().toISOString()});
 for(let offset=0;offset<missing.length;offset+=25)await svc.entities.ProfessionalExportChunk.bulkCreate(missing.slice(offset,offset+25));
 const readback=await readFileContent(svc,companyId,stored,fetchAll);
 if(readback!==encoded||await sha256(fromBase64(readback))!==hash)throw problem('La lectura posterior de los fragmentos no coincide con el archivo preparado.');
 return stored;
}

export async function hydrateFiles(svc,companyId,files,fetchAll){
 const result=[];
 for(let offset=0;offset<files.length;offset+=4)result.push(...await Promise.all(files.slice(offset,offset+4).map(async file=>({...file,contentBase64:await readFileContent(svc,companyId,file,fetchAll)}))));
 return result;
}
