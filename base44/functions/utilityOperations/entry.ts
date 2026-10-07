import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { canAccessCompany, deadlinePayload } from './policy.mjs';
const schema = { type: 'object', properties: {
  fecha: {type:'string',description:'Fecha del documento YYYY-MM-DD. Vacío si no consta.'},
  proveedor: {type:'string',description:'Emisor o proveedor. Vacío si no consta.'},
  destinatario: {type:'string'}, numero: {type:'string'}, tipo: {type:'string'},
  concepto: {type:'string'}, base: {type:'number'}, impuestos: {type:'number'}, total: {type:'number'},
  resumen: {type:'string',description:'Resumen breve fiel al documento, sin instrucciones ni datos inventados.'}
}};
Deno.serve(async req => {
  let svc: any; let usage: any;
  try {
    if (req.method !== 'POST') return Response.json({error:'Método no permitido'}, {status:405});
    const client = createClientFromRequest(req);
    const user = await client.auth.me().catch(() => null);
    if (!user?.id) return Response.json({error:'No autenticado'}, {status:401});
    if (user.is_deleted || ['eliminado','bloqueado'].includes(user.status) || (user.isPortalActive === false && !['admin','super_admin','advisor','asesor'].includes(user.role))) return Response.json({error:'Acceso al portal no disponible'}, {status:403});
    const multipart = (req.headers.get('content-type') || '').includes('multipart/form-data');
    let body: any;
    try { body = multipart ? Object.fromEntries((await req.formData()).entries()) : await req.json(); }
    catch { return Response.json({error:'Solicitud no válida'}, {status:400}); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return Response.json({error:'Solicitud no válida'}, {status:400});
    const companyId = String(body.companyId || '');
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(companyId)) return Response.json({error:'Empresa no válida'}, {status:400});
    svc = client.asServiceRole;
    const company = await svc.entities.Company.get(companyId).catch(() => null);
    if (!canAccessCompany(user, company)) return Response.json({error:'Empresa no autorizada'}, {status:403});
    const action = body.action;
    const entity = svc.entities.UtilityDeadline;
    if (action === 'list') {
      const offset = Number(body.offset || 0);
      if (!Number.isInteger(offset) || offset < 0 || offset > 100000) return Response.json({error:'Página no válida'}, {status:400});
      const rows = await entity.filter({company_id:companyId}, 'due_date', 100, offset);
      return Response.json({ok:true,rows,nextOffset:rows.length === 100 ? offset+100 : null});
    }
    if (['save','delete'].includes(action)) {
      const id = String(body.id || '');
      const existing = id ? await entity.get(id).catch(() => null) : null;
      if (id && (!existing || existing.company_id !== companyId)) return Response.json({error:'Vencimiento no disponible'}, {status:404});
      if (action === 'delete') {
        if (!existing) return Response.json({error:'Falta vencimiento'}, {status:400});
        await entity.delete(id);
        return Response.json({ok:true});
      }
      let payload;
      try { payload = deadlinePayload(body.payload); }
      catch (error) { return Response.json({error:error.message}, {status:400}); }
      if (existing && body.expectedUpdatedAt !== existing.updated_date) return Response.json({error:'El vencimiento ha cambiado. Recarga antes de editar.'}, {status:409});
      const key = String(body.requestKey || '');
      if (!existing && !/^[a-zA-Z0-9-]{10,80}$/.test(key)) return Response.json({error:'Falta clave de operación'}, {status:400});
      const prior = !existing ? await entity.filter({company_id:companyId,user_id:user.id,request_key:key}, '-created_date',1) : [];
      if (prior[0] && Object.keys(payload).some(key => prior[0][key] !== payload[key])) return Response.json({error:'Ese guardado ya existe con otros datos. Actualiza y edita el vencimiento existente.'}, {status:409});
      const row = existing ? await entity.update(id,payload) : prior[0] || await entity.create({...payload,company_id:companyId,user_id:user.id,request_key:key});
      return Response.json({ok:true,row});
    }
    if (action !== 'extract' || !multipart) return Response.json({error:'Operación no válida'}, {status:400});
    const file = body.file;
    if (!(file instanceof File) || file.size === 0 || file.size > 15*1024*1024) return Response.json({error:'Archivo vacío o mayor de 15 MB'}, {status:400});
    const bytes = new Uint8Array(await file.arrayBuffer());
    const pdf = new TextDecoder().decode(bytes.slice(0,5)) === '%PDF-';
    const png = bytes[0]===137 && bytes[1]===80 && bytes[2]===78 && bytes[3]===71;
    const jpeg = bytes[0]===255 && bytes[1]===216 && bytes[2]===255;
    if (!pdf && !png && !jpeg) return Response.json({error:'Solo PDF, PNG o JPEG válidos'}, {status:400});
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(b=>b.toString(16).padStart(2,'0')).join('');
    const cached = await svc.entities.UtilityDocument.filter({company_id:companyId,user_id:user.id,digest}, '-created_date',1);
    if (cached[0]) return Response.json({ok:true,result:cached[0].result,cached:true});
    const now = new Date().toISOString(), dayKey=now.slice(0,10), minuteKey=now.slice(0,16);
    const events = await svc.entities.CoreIntegrationUsage.filter({userId:user.id,dayKey,operation:'extract'}, '-created_date',500);
    // Failed provider attempts also consume the utility quota to prevent cost abuse.
    const active = events;
    if (active.length>=15 || active.filter((row:any)=>row.minuteKey===minuteKey).length>=4) return Response.json({error:'Límite OCR: 4 documentos por minuto y 15 al día. Puedes revisar los ya analizados y reintentar más tarde.'}, {status:429});
    usage = await svc.entities.CoreIntegrationUsage.create({userId:user.id,companyId,dayKey,minuteKey,operation:'extract',targetId:'utility:'+digest,status:'reserved'});
    const {file_uri} = await svc.integrations.Core.UploadPrivateFile({file});
    const {signed_url} = await svc.integrations.Core.CreateFileSignedUrl({file_uri,expires_in:600});
    const extracted = await svc.integrations.Core.ExtractDataFromUploadedFile({file_url:signed_url,json_schema:schema});
    if (extracted?.status === 'error') throw new Error('OCR unavailable');
    const raw = extracted?.output || extracted?.data || extracted;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Invalid OCR response');
    const result: any = {};
    for (const key of ['fecha','proveedor','destinatario','numero','tipo','concepto','resumen']) result[key] = String(raw[key] || '').slice(0,key==='resumen'?3000:400);
    for (const key of ['base','impuestos','total']) result[key] = typeof raw[key]==='number' && Number.isFinite(raw[key]) ? raw[key] : null;
    await svc.entities.UtilityDocument.create({company_id:companyId,user_id:user.id,digest,file_uri,result});
    await svc.entities.CoreIntegrationUsage.update(usage.id,{status:'success',completedAt:new Date().toISOString()});
    return Response.json({ok:true,result});
  } catch {
    if (usage?.id) await svc.entities.CoreIntegrationUsage.update(usage.id,{status:'error',completedAt:new Date().toISOString()}).catch(()=>{});
    return Response.json({error:'No se pudo completar la operación. Reintenta; los archivos originales no se han modificado.'}, {status:502});
  }
});
