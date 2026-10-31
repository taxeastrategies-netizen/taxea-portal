import {isStorageAdmin,storageAccountEnabled,mayAccessStorageCompany,assetIdFromReference,authorizedAsset} from './storageRuntime.generated.mjs';
import {linkedStorageCompany} from './documentContexts.mjs';
import {MERCANTIL_FIELDS} from './mercantilFields.mjs';
const names=Object.keys(MERCANTIL_FIELDS),methods=['list','filter','get','create','bulkCreate','update','delete'];
const validId=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(value);
const norm=value=>String(value||'').trim().toLowerCase();
const failure=(status,message)=>Object.assign(new Error(message),{status});
const ownFields=(entity,input)=>{
 if(!input||typeof input!=='object'||Array.isArray(input)||JSON.stringify(input).length>64_000)throw failure(400,'Datos de Mercantil no válidos.');
 const result={};for(const[key,value]of Object.entries(input)){
  if(!MERCANTIL_FIELDS[entity].includes(key)||key.startsWith('documentOperationLock'))throw failure(400,'Campo de Mercantil no admitido.');
  result[key]=value;
 }return result;
};
const safeDto=(entity,row,admin)=>{if(!row)return row;const result={...row};delete result.documentOperationLockToken;delete result.documentOperationLockExpiresAt;if(!admin&&entity==='MercantilSociedad')delete result.observaciones;return result;};
export async function mercantilOperation(service,user,body){
 if(!user?.id)throw failure(401,'Inicia sesión.');
 if(!storageAccountEnabled(user))throw failure(403,'Acceso al portal suspendido.');
 const {entity,method}=body||{},args=body?.args??[];
 if(!names.includes(entity)||!methods.includes(method)||!Array.isArray(args)||args.length>4)throw failure(400,'Operación de Mercantil no admitida.');
 const admin=isStorageAdmin(user),socCache=new Map(),expCache=new Map();
 const getSoc=async id=>{
  if(!validId(id))throw failure(404,'Sociedad no disponible.');
  if(socCache.has(id))return socCache.get(id);
  const row=await service.entities.MercantilSociedad.get(id).catch(()=>null);if(!row)throw failure(404,'Sociedad no disponible.');
  let company;
  if(!admin&&row.visibilidadCliente!==true)throw failure(404,'Sociedad no disponible.');
  try{company=await linkedStorageCompany(service,user,row.clienteAccountId);}catch{throw failure(404,'Sociedad no disponible.');}
  const scoped={row,company};socCache.set(id,scoped);return scoped;
 };
 const getExp=async id=>{
  if(!validId(id))throw failure(404,'Expediente no disponible.');
  if(expCache.has(id))return expCache.get(id);
  const row=await service.entities.MercantilExpediente.get(id).catch(()=>null);if(!row)throw failure(404,'Expediente no disponible.');
  const scope=await getSoc(row.sociedadId),result={row,...scope};
  // Keep expediente separate from the society's row.
  result.expediente=row;expCache.set(id,result);return result;
 };
 const rowScope=async(name,row)=>{
  if(!row)throw failure(404,'Registro de Mercantil no disponible.');
  if(name==='MercantilSociedad')return getSoc(row.id);
  if(name==='MercantilExpediente')return getSoc(row.sociedadId);
  if(row.expedienteId){const scope=await getExp(row.expedienteId);if(row.sociedadId&&row.sociedadId!==scope.row.id)throw failure(404,'Registro de Mercantil no disponible.');return scope;}
  return getSoc(row.sociedadId);
 };
 const allPages=async(model,query,sort='created_date')=>{
  const rows=[];for(let offset=0;;offset+=500){const page=await model.filter(query,sort,500,offset);rows.push(...(page||[]));if(!page||page.length<500)return rows;if(offset>=100_000)throw failure(503,'Demasiados resultados. Selecciona un expediente.');}
 };
 const allowedSocietyIds=async()=>{
  const email=norm(user.email),companies=await allPages(service.entities.Company,{$or:[{owner_email:email},{usuarios_autorizados:{$in:[email]}}]});
  const configured=user.data?.company_id||user.company_id;
  if(validId(configured)&&!companies.some(x=>x.id===configured)){const extra=await service.entities.Company.get(configured).catch(()=>null);if(extra)companies.push(extra);}
  const owned=companies.filter(c=>mayAccessStorageCompany(user,c));if(!owned.length)return[];
  const accountRows=await allPages(service.entities.ClientAccount,{email:{$in:[...new Set(owned.map(x=>norm(x.owner_email)))]}});
  const ids=[...owned.map(x=>x.id),...accountRows.map(x=>x.id)];
  const candidates=await allPages(service.entities.MercantilSociedad,{clienteAccountId:{$in:ids},visibilidadCliente:true});
  const result=[];for(const row of candidates){try{await getSoc(row.id);result.push(row.id);}catch{/* Unlinked, ambiguous or foreign accounts stay hidden. */}}
  return result;
 };
 if(['list','filter'].includes(method)){
  const query=method==='filter'?(args[0]||{}):{},sort=method==='filter'?(args[1]||'-created_date'):(args[0]||'-created_date'),limit=Number((method==='filter'?args[2]:args[1])??100),offset=Number((method==='filter'?args[3]:args[2])??0);
  if(!query||typeof query!=='object'||Array.isArray(query)||Object.entries(query).some(([key,value])=>!['id',...MERCANTIL_FIELDS[entity]].includes(key)||!['string','boolean','number'].includes(typeof value)))throw failure(400,'Filtro de Mercantil no admitido.');
  if(typeof sort!=='string'||!/^[-]?[A-Za-z_][A-Za-z0-9_]*$/.test(sort)||!['id','created_date','updated_date',...MERCANTIL_FIELDS[entity]].includes(sort.replace(/^-/,' ' ).trim())||!Number.isInteger(limit)||limit<1||limit>500||!Number.isInteger(offset)||offset<0||offset>100_000)throw failure(400,'Página de Mercantil no válida.');
  let scoped=query;
  if(!admin){
   let constraint;
   if(entity==='MercantilSociedad')constraint={id:{$in:await allowedSocietyIds()}};
   else if(query.expedienteId){const scope=await getExp(query.expedienteId);constraint={sociedadId:scope.row.id};}
   else if(query.sociedadId){await getSoc(query.sociedadId);constraint={sociedadId:query.sociedadId};}
   else constraint={sociedadId:{$in:await allowedSocietyIds()}};
   scoped={$and:[query,constraint,...(entity==='MercantilHistorial'?[{tipoAccion:{$ne:'nota_interna'}}]:[])]};
  }
  const rows=await service.entities[entity].filter(scoped,sort,limit,offset),visible=[];
  for(const row of rows||[]){if(!admin){try{await rowScope(entity,row);}catch{continue;}}visible.push(safeDto(entity,row,admin));}
  return visible;
 }
 if(method==='get'){
  if(!validId(args[0]))throw failure(404,'Registro no disponible.');
  const row=await service.entities[entity].get(args[0]).catch(()=>null);if(!row)throw failure(404,'Registro no disponible.');
  if(!admin){await rowScope(entity,row);if(entity==='MercantilHistorial'&&row.tipoAccion==='nota_interna')throw failure(404,'Registro no disponible.');}
  return safeDto(entity,row,admin);
 }
 if(method==='bulkCreate'){
  if(!Array.isArray(args[0])||!args[0].length||args[0].length>20)throw failure(400,'Lote de Mercantil no válido.');
  // Preflight every scope before the first write. Only standard book rows are
  // bulk-created by the current UI; other entities need individual operations.
  if(entity!=='MercantilLibro')throw failure(400,'Lote no admitido para este registro.');
  let batchScope;const batch=[];
  for(const input of args[0]){
   let row=ownFields(entity,input);const scoped=await rowScope(entity,row);
   if(batchScope&&(scoped.row.id!==batchScope.row.id||row.expedienteId!==batch[0].expedienteId))throw failure(400,'Selecciona un único expediente para el lote.');
   batchScope=scoped;
   if(!admin){if(!['diario','inventarios_cuentas','balance_situacion','pyg','balance_sumas_saldos','socios','actas','otros'].includes(row.tipoLibro))throw failure(400,'Tipo de libro no válido.');row={expedienteId:row.expedienteId,sociedadId:scoped.row.id,tipoLibro:row.tipoLibro,aplica:true,estado:'pendiente'};}
   batch.push(row);
  }
  const token=crypto.randomUUID(),time=Date.now(),lease=await service.entities.MercantilSociedad.updateMany({id:batchScope.row.id,$or:[{documentOperationLockToken:{$in:[null,'']}},{documentOperationLockExpiresAt:{$lte:time}}]},{$set:{documentOperationLockToken:token,documentOperationLockExpiresAt:time+90_000}});
  if(Number(lease?.updated)!==1)throw failure(409,'Hay otra operación en curso. Actualiza antes de repetir.');
  try{
   const existing=await service.entities.MercantilLibro.filter({expedienteId:batch[0].expedienteId},'created_date',500,0),map=new Map();
   for(const row of existing){if(map.has(row.tipoLibro))throw failure(409,'Hay libros duplicados que debe revisar el asesor.');map.set(row.tipoLibro,row);}
   const pending=[];const seen=new Set();for(const row of batch)if(!map.has(row.tipoLibro)&&!seen.has(row.tipoLibro)){pending.push(row);seen.add(row.tipoLibro);}
   if(pending.length){const created=await service.entities.MercantilLibro.bulkCreate(pending);for(const row of created)map.set(row.tipoLibro,row);}
   return batch.map(row=>safeDto(entity,map.get(row.tipoLibro),admin));
  }finally{await service.entities.MercantilSociedad.updateMany({id:batchScope.row.id,documentOperationLockToken:token},{$set:{documentOperationLockToken:'',documentOperationLockExpiresAt:0}}).catch(()=>{});}
 }
 let existing,payload,scope;
 if(['update','delete'].includes(method)){
  if(!validId(args[0]))throw failure(404,'Registro no disponible.');
  existing=await service.entities[entity].get(args[0]).catch(()=>null);if(!existing)throw failure(404,'Registro no disponible.');
  scope=await rowScope(entity,existing);
  if(method==='delete'){if(!admin)throw failure(403,'Solo administración puede eliminar este registro.');await service.entities[entity].delete(existing.id);return true;}
  payload=ownFields(entity,args[1]);
  for(const key of ['sociedadId','expedienteId','clienteAccountId'])if(Object.hasOwn(payload,key)&&payload[key]!==existing[key])throw failure(409,'La vinculación requiere una revisión específica.');
 }else{
  payload=ownFields(entity,args[0]);
  if(entity==='MercantilSociedad'){if(!admin)throw failure(403,'Solo administración puede dar de alta sociedades.');return service.entities.MercantilSociedad.create(payload);}
  scope=await rowScope(entity,payload);
 }
 if(!admin){
  if(entity==='MercantilSociedad')throw failure(403,'Solo administración puede modificar esta sociedad.');
  if(method==='update'){
   const allowed=entity==='MercantilLibro'?['estado','aplica','archivoFuenteUrl','justificantePresentacionUrl','confirmacionRegistroUrl','fechaPreparacion','fechaPresentacion','observaciones']:entity==='MercantilDocumento'?['nombre','comentarios','estado','etiquetas']:entity==='MercantilExpediente'?MERCANTIL_FIELDS[entity].filter(key=>!['motivoCierreManual','sociedadId'].includes(key)):[];
   if(Object.keys(payload).some(key=>!allowed.includes(key))||payload.estadoGlobal==='cerrado')throw failure(403,'Esta operación requiere administración.');
  }else if(entity==='MercantilExpediente'){
   if(!/^\d{4}$/.test(String(payload.ejercicio||''))||Number(payload.ejercicio)<2000||Number(payload.ejercicio)>2100)throw failure(400,'Ejercicio no válido.');
   if(Object.entries(payload).some(([key,value])=>['estadoGlobal','estadoLibros','estadoCuentas'].includes(key)&&!['no_iniciado','pendiente'].includes(value)))throw failure(403,'El cliente no puede validar ni presentar expedientes.');
   payload={sociedadId:scope.row.id,sociedadNombre:scope.row.nombreFiscal,ejercicio:String(payload.ejercicio),estadoGlobal:'no_iniciado',estadoLibros:'pendiente',estadoCuentas:'pendiente',responsable:user.email,ultimaActualizacion:new Date().toISOString()};
  }else if(entity==='MercantilLibro'){
   if(!['diario','inventarios_cuentas','balance_situacion','pyg','balance_sumas_saldos','socios','actas','otros'].includes(payload.tipoLibro))throw failure(400,'Tipo de libro no válido.');
   payload={expedienteId:payload.expedienteId,sociedadId:scope.row.id,tipoLibro:payload.tipoLibro,aplica:true,estado:'pendiente'};
  }else if(entity==='MercantilDocumento'){
   payload={expedienteId:payload.expedienteId,sociedadId:scope.row.id,carpeta:String(payload.carpeta||'').slice(0,120),tipoDocumento:String(payload.tipoDocumento||'otro').slice(0,120),nombre:String(payload.nombre||'Documento').slice(0,240),fileUrl:payload.fileUrl,comentarios:String(payload.comentarios||'').slice(0,3000),etiquetas:Array.isArray(payload.etiquetas)?payload.etiquetas.slice(0,30):[],estado:'subido',fechaSubida:new Date().toISOString(),subidoPor:user.email,version:1,esBorrador:true};
  }else if(entity==='MercantilHistorial'){
   payload={expedienteId:payload.expedienteId,sociedadId:scope.row.id,fecha:new Date().toISOString(),usuario:user.email,tipoAccion:'documento_subido',accion:'Aportación documental del cliente',comentario:String(payload.comentario||'').slice(0,3000)};
  }
 }
 if(entity==='MercantilExpediente'&&Object.hasOwn(payload,'ejercicio'))payload.ejercicio=String(payload.ejercicio);
 for(const key of ['fileUrl','archivoFuenteUrl','justificantePresentacionUrl','confirmacionRegistroUrl','justificanteLibrosUrl','justificanteCuentasUrl']){
  if(!payload[key]||payload[key]===existing?.[key])continue;
  const asset=await authorizedAsset(service,user,assetIdFromReference(payload[key]));
  if(!asset||asset.company_id!==scope.company.id)throw failure(404,'El documento no pertenece a esta empresa.');
 }
 const lockToken=crypto.randomUUID(),time=Date.now(),lock=await service.entities.MercantilSociedad.updateMany({id:scope.row.id,$or:[{documentOperationLockToken:{$in:[null,'']}},{documentOperationLockExpiresAt:{$lte:time}}]},{$set:{documentOperationLockToken:lockToken,documentOperationLockExpiresAt:time+90_000}});
 if(Number(lock?.updated)!==1)throw failure(409,'Hay otra operación en curso. Actualiza antes de repetir.');
 try{
  if(method==='update')return safeDto(entity,await service.entities[entity].update(existing.id,payload),admin);
  const dedup=entity==='MercantilExpediente'?{sociedadId:scope.row.id,ejercicio:payload.ejercicio}:entity==='MercantilLibro'?{expedienteId:payload.expedienteId,tipoLibro:payload.tipoLibro}:entity==='MercantilDocumento'&&payload.fileUrl?{expedienteId:payload.expedienteId,fileUrl:payload.fileUrl,carpeta:payload.carpeta,tipoDocumento:payload.tipoDocumento}:null;
  if(dedup){const previous=await service.entities[entity].filter(dedup,'created_date',2,0);if(previous.length>1)throw failure(409,'Hay registros duplicados que debe revisar el asesor.');if(previous[0])return safeDto(entity,previous[0],admin);}
  return safeDto(entity,await service.entities[entity].create(payload),admin);
 }finally{await service.entities.MercantilSociedad.updateMany({id:scope.row.id,documentOperationLockToken:lockToken},{$set:{documentOperationLockToken:'',documentOperationLockExpiresAt:0}}).catch(()=>{});}
}
