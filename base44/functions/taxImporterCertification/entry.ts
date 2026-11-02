import {hydrateTaxFile} from './taxFileStorage.mjs';
import {queuedAccountingClient} from './privateRequestQueue.mjs';
import {verifiedCompanyAssignment} from './verifiedCompanyAssignment.mjs';
import {exportCapability} from './exportCapabilities.mjs';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';

const clean = (value: unknown) => String(value ?? '').trim();
const lower = (value: unknown) => clean(value).toLowerCase();
const SHA256 = /^[a-f0-9]{64}$/;
const REVIEWER_ROLES = new Set(['admin', 'super_admin', 'advisor', 'asesor']);
const CERTIFIABLE_MODELS = new Set(['111','115','123','130','131','180','190','193','200','202','216','232','296','303','347','349','390','415']);

async function companyAccess(svc:any,user:any,company:any){
 const role=lower(user?.role),email=lower(user?.email),id=clean(company?.id);
 if(['admin','super_admin'].includes(role))return true;
 if(email&&(email===lower(company?.owner_email)||(Array.isArray(company?.usuarios_autorizados)&&company.usuarios_autorizados.some((value:any)=>lower(value)===email))))return true;
 return !!id&&company.activa!==false&&await verifiedCompanyAssignment(svc,user,id);
}

function eligibleFile(file: any) {
  const format = lower(file?.formato);
  const model = clean(file?.modeloCodigo);
  const authority = clean(file?.administracion);
  const officialFormat = model === '415'
    ? authority === 'ATC' && format.startsWith('soporte de importación oficial programa atc 415')
    : authority === 'AEAT' && (format.startsWith('diseño de registro aeat') || format.startsWith('diseño lógico aeat'));
  return Boolean(CERTIFIABLE_MODELS.has(model) && exportCapability(model,Number(file?.ejercicio)).canExportOfficial && officialFormat && file?.immutable === true
    && (clean(file?.contentBase64)||(file?.storageMode==='tax-private-chunks-v1'&&file?.storageState==='ready')) && SHA256.test(lower(file?.hash)));
}

function validEvidence(body: any) {
  const outcome = clean(body.resultado);
  const answer = clean(body.respuestaImportador);
  const url = clean(body.evidenceUrl);
  const testedAt = new Date(clean(body.fechaPrueba));
  return ['aceptado', 'rechazado'].includes(outcome)
    && answer.length >= 8 && answer.length <= 4000
    && /^https:\/\//i.test(url) && url.length <= 2000
    && Number.isFinite(testedAt.getTime())
    && testedAt.getTime() <= Date.now() + 86400000;
}

async function contentHash(base64: string) {
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function allRows(entity: any, filter: any) {
  const rows: any[] = [];
  for (let skip = 0; skip < 50000; skip += 500) {
    const page = await entity.filter(filter, '-fechaRegistro', 500, skip);
    rows.push(...(page || []));
    if (!page || page.length < 500) return rows;
  }
  throw Object.assign(new Error('La lista de evidencias supera el límite de consulta segura.'), { status: 413 });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user?.id) return Response.json({ error: 'Sesión no válida.' }, { status: 401 });
    if([user,user.data].filter(Boolean).some(s=>s.is_deleted===true||['eliminado','bloqueado','suspendido'].includes(lower(s.status))||['suspended','blocked','disabled','deleted'].includes(lower(s.accountAccessStatus))))return Response.json({error:'Cuenta no habilitada.'},{status:403});
    const body = await req.json().catch(() => ({}));
    const action = clean(body.action || 'list');

    if (action === 'self_test') {
      const sample = { ejercicio:2025,modeloCodigo: '190', administracion: 'AEAT', immutable: true, contentBase64: 'YQ==', hash: 'a'.repeat(64), formato: 'Diseño de registro AEAT' };
      return Response.json({ ok: true, checks: {
        officialOnly: eligibleFile(sample) && !eligibleFile({ ...sample, formato: 'Paquete de traspaso revisable ATC' }),
        evidenceRequired: validEvidence({ resultado: 'aceptado', respuestaImportador: 'Fichero aceptado', evidenceUrl: 'https://example.test/evidence.pdf', fechaPrueba: new Date().toISOString() })
          && !validEvidence({ resultado: 'aceptado', respuestaImportador: 'Fichero aceptado', fechaPrueba: new Date().toISOString() }),
        accessBoundary: await companyAccess(base44.asServiceRole, { email: 'owner@test.invalid', role: 'user', data: {} }, { id: 'x', owner_email: 'owner@test.invalid' })
          && !await companyAccess(base44.asServiceRole, { email: 'other@test.invalid', role: 'user', data: {} }, { id: 'x', owner_email: 'owner@test.invalid' }),
      } });
    }

    const companyId = clean(body.companyId || user?.company_id || user?.data?.company_id);
    if (!companyId) return Response.json({ error: 'Selecciona una empresa.' }, { status: 400 });
    const svc = queuedAccountingClient(base44.asServiceRole,{intervalMs:150,readRetries:3});
    const company = await svc.entities.Company.get(companyId).catch(() => null);
    if (!company) return Response.json({ error: 'Empresa no encontrada.' }, { status: 404 });
    if (!(await companyAccess(svc,user, company))) return Response.json({ error: 'Sin permiso para esta empresa.' }, { status: 403 });

    if(company.activa===false&&!['admin','super_admin'].includes(lower(user.role)))return Response.json({error:'Empresa no habilitada.'},{status:403});
    if(action==='readiness'){
      const year=Number(body.ejercicio);if(!Number.isInteger(year)||year<2019||year>2100)return Response.json({error:'Selecciona un ejercicio válido.'},{status:400});
      const files=await allRows(svc.entities.TaxOfficialFile,{companyId,ejercicio:year});
      const evidence=await allRows(svc.entities.TaxImporterEvidence,{companyId,ejercicio:year});
      const integrity=await Promise.all(files.map(async file=>({id:file.id,valid:eligibleFile(file)&&await hydrateTaxFile(svc,file).then(f=>contentHash(clean(f.contentBase64))).catch(()=>false)===lower(file.hash)})));
      const models=[...CERTIFIABLE_MODELS,...['417','420','421','425']].map(model=>{const own=files.filter(f=>clean(f.modeloCodigo)===model&&integrity.some(i=>i.id===f.id&&i.valid));const accepted=own.flatMap(file=>{const reviewed=evidence.filter(e=>e.taxOfficialFileId===file.id&&lower(e.fileHashSha256)===lower(file.hash)&&e.revisionAsesor==='revisada'&&Array.isArray(e.reviewedRegimeCodes)).sort((a,b)=>Date.parse(b.fechaRevision||b.fechaRegistro||b.fechaPrueba)-Date.parse(a.fechaRevision||a.fechaRegistro||a.fechaPrueba)||(a.resultado==='rechazado'?-1:b.resultado==='rechazado'?1:0));const seen=new Set();return reviewed.flatMap(e=>{const fresh=e.reviewedRegimeCodes.filter(r=>r!=='sin_especificar'&&!seen.has(r));for(const r of e.reviewedRegimeCodes)seen.add(r);return e.resultado==='aceptado'&&fresh.length?[{fileId:file.id,hash:file.hash,design:file.versionDiseno,period:file.periodo,regimes:fresh,evidenceId:e.id}]:[];});});const corruptFiles=files.filter(f=>clean(f.modeloCodigo)===model&&eligibleFile(f)&&!integrity.some(i=>i.id===f.id&&i.valid)).length;return {model,capability:exportCapability(model,year),files:own.length,corruptFiles,acceptedFiles:accepted,status:corruptFiles?'integrity_failed':accepted.length?'accepted_exact_files_only':own.length?'generated_not_tested':'no_official_file',completeForAllRegimes:false};});
      return Response.json({ok:true,year,models,notice:'Una aceptación se refiere al archivo, campaña y alcance revisados; no certifica otros regímenes ni una presentación.'});
    }
    if (action === 'list') {
      const year = Number(body.ejercicio);
      const rows = await allRows(svc.entities.TaxImporterEvidence, Number.isInteger(year) && year > 2000 ? { companyId, ejercicio: year } : { companyId });
      return Response.json({ ok: true, rows: rows.map((item: any) => ({
        id: item.id, taxOfficialFileId: item.taxOfficialFileId, modeloCodigo: item.modeloCodigo,
        ejercicio: item.ejercicio, periodo: item.periodo, administracion: item.administracion,
        nombreFichero: item.nombreFichero, versionDiseno: item.versionDiseno, fileHashSha256: item.fileHashSha256,
        resultado: item.resultado, fechaPrueba: item.fechaPrueba, respuestaImportador: item.respuestaImportador,
        regimeCodes:item.regimeCodes||[],reviewedRegimeCodes:item.reviewedRegimeCodes||[],caseCodes:item.caseCodes||[],evidenceUrl: item.evidenceUrl, registradoPor: item.registradoPor, fechaRegistro: item.fechaRegistro,
        revisionAsesor: item.revisionAsesor || 'pendiente', revisadoPor: item.revisadoPor || '',
      })) });
    }

    if (action === 'record') {
      if (body.confirmation !== true || !validEvidence(body)) return Response.json({ error: 'Confirma el resultado oficial y adjunta su respuesta y evidencia HTTPS.' }, { status: 400 });
      const fileId = clean(body.fileId);
      if (!fileId) return Response.json({ error: 'Selecciona el fichero exacto.' }, { status: 400 });
      const file = await svc.entities.TaxOfficialFile.get(fileId).catch(() => null);
      if (!file || clean(file.companyId) !== companyId) return Response.json({ error: 'Fichero ajeno o inexistente.' }, { status: 404 });
      if(!exportCapability(file.modeloCodigo,Number(file.ejercicio)).canExportOfficial)return Response.json({error:'El ejercicio del fichero no coincide con un diseño habilitado.'},{status:409});
      if (!eligibleFile(file)) return Response.json({ error: 'Solo se certifican ficheros inmutables exactos con SHA-256; los traspasos guiados no son importaciones oficiales.' }, { status: 409 });
      const expectedAuthority = clean(file.modeloCodigo) === '415' ? 'ATC' : 'AEAT';
      if (clean(file.administracion) !== expectedAuthority) return Response.json({ error: `El modelo ${file.modeloCodigo} debe certificarse en ${expectedAuthority}, no en ${file.administracion || 'un importador sin identificar'}.` }, { status: 409 });
      const hash = await contentHash(clean((await hydrateTaxFile(svc,file)).contentBase64));
      if (hash !== lower(file.hash)) return Response.json({ error: 'El contenido conservado no coincide con la huella SHA-256 del fichero.' }, { status: 409 });
      const existing = await allRows(svc.entities.TaxImporterEvidence, { companyId, taxOfficialFileId: fileId });
      const matched = existing.find((item: any) => item.resultado === clean(body.resultado) && item.respuestaImportador===clean(body.respuestaImportador)
        && item.fechaPrueba === new Date(clean(body.fechaPrueba)).toISOString()
        && item.evidenceUrl === clean(body.evidenceUrl));
      if (matched) return Response.json({ ok: true, alreadyExisted: true, record: matched });
      const saved = await svc.entities.TaxImporterEvidence.create({
        companyId, taxOfficialFileId: file.id, modeloCodigo: clean(file.modeloCodigo), ejercicio: Number(file.ejercicio),
        periodo: clean(file.periodo), administracion: clean(file.administracion), nombreFichero: clean(file.nombreFichero),
        versionDiseno: clean(file.versionDiseno), fileHashSha256: hash, resultado: clean(body.resultado),
        fechaPrueba: new Date(clean(body.fechaPrueba)).toISOString(), respuestaImportador: clean(body.respuestaImportador),
        evidenceUrl: clean(body.evidenceUrl), registradoPor: clean(user.email), fechaRegistro: new Date().toISOString(),
        revisionAsesor: 'pendiente',scopeVersion:'taxea-c6-v1',regimeCodes:[...new Set((Array.isArray(body.regimeCodes)?body.regimeCodes:Array.isArray(file.regimeCodes)?file.regimeCodes:['sin_especificar']).map(clean).filter(v=>/^[A-Za-z0-9_:.|/-]{1,120}$/.test(v)))],caseCodes:Array.isArray(file.caseCodes)?file.caseCodes:[],
      });
      return Response.json({ ok: true, alreadyExisted: false, record: saved });
    }

    if (action === 'review') {
      if (!REVIEWER_ROLES.has(lower(user?.role))) return Response.json({ error: 'Solo un asesor o administrador puede revisar la evidencia.' }, { status: 403 });
      if (body.confirmation !== true) return Response.json({ error: 'Confirma la revisión.' }, { status: 400 });
      const row = await svc.entities.TaxImporterEvidence.get(clean(body.recordId)).catch(() => null);
      if (!row || clean(row.companyId) !== companyId) return Response.json({ error: 'Evidencia ajena o inexistente.' }, { status: 404 });
      const originalFile = await svc.entities.TaxOfficialFile.get(clean(row.taxOfficialFileId)).catch(() => null);
      if (!originalFile || clean(originalFile.companyId) !== companyId || !eligibleFile(originalFile)
        || lower(originalFile.hash) !== lower(row.fileHashSha256)
        || await contentHash(clean((await hydrateTaxFile(svc,originalFile)).contentBase64)) !== lower(row.fileHashSha256)) return Response.json({ error: 'No se puede revisar: el fichero original ya no coincide con la evidencia conservada.' }, { status: 409 });
      const reviewedRegimes=[...new Set((Array.isArray(body.regimeCodes)?body.regimeCodes:row.regimeCodes||[]).map(clean).filter(v=>v!=='sin_especificar'&&/^[A-Za-z0-9_:.|/-]{1,120}$/.test(v)))];
      if(!reviewedRegimes.length)return Response.json({error:'Delimita al menos un régimen/caso revisado. Una aceptación no certifica todos los regímenes.'},{status:422});
      if (row.revisionAsesor === 'revisada' && JSON.stringify(row.reviewedRegimeCodes)===JSON.stringify(reviewedRegimes)) return Response.json({ ok: true, alreadyExisted: true, record: row });
      const saved = await svc.entities.TaxImporterEvidence.update(row.id, {
        revisionAsesor: 'revisada',reviewedRegimeCodes:reviewedRegimes,scopeVersion:'taxea-c6-v1', revisadoPor: clean(user.email), fechaRevision: new Date().toISOString(),
      });
      return Response.json({ ok: true, alreadyExisted: false, record: saved });
    }

    return Response.json({ error: 'Acción no soportada.' }, { status: 400 });
  } catch (error) {
    console.error('taxImporterCertification failed',{status:500});
    return Response.json({ error:'No se pudo registrar la prueba del importador.',code:'IMPORTER_EVIDENCE_UNAVAILABLE' }, { status:500 });
  }
});
