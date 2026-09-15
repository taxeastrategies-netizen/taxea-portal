import { createClientFromRequest } from 'npm:@base44/sdk@0.8.48';

const clean = (value: unknown) => String(value ?? '').trim();
const lower = (value: unknown) => clean(value).toLowerCase();
const SHA256 = /^[a-f0-9]{64}$/;
const REVIEWER_ROLES = new Set(['admin', 'super_admin', 'advisor', 'asesor']);

function companyAccess(user: any, company: any) {
  const role = lower(user?.role);
  const email = lower(user?.email);
  const id = clean(company?.id);
  return ['admin', 'super_admin'].includes(role)
    || (id && clean(user?.data?.company_id || user?.company_id) === id)
    || (email && (email === lower(company?.owner_email)
      || (Array.isArray(company?.usuarios_autorizados) && company.usuarios_autorizados.some((item: unknown) => lower(item) === email))));
}

function eligibleFile(file: any) {
  const format = lower(file?.formato);
  return Boolean(file?.immutable !== false && clean(file?.contentBase64) && SHA256.test(lower(file?.hash))
    && !format.includes('traspaso revisable') && !format.includes('borrador técnico de revisión'));
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
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Sesión no válida.' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const action = clean(body.action || 'list');

    if (action === 'self_test') {
      const sample = { immutable: true, contentBase64: 'YQ==', hash: 'a'.repeat(64), formato: 'Diseño de registro AEAT' };
      return Response.json({ ok: true, checks: {
        officialOnly: eligibleFile(sample) && !eligibleFile({ ...sample, formato: 'Paquete de traspaso revisable ATC' }),
        evidenceRequired: validEvidence({ resultado: 'aceptado', respuestaImportador: 'Fichero aceptado', evidenceUrl: 'https://example.test/evidence.pdf', fechaPrueba: new Date().toISOString() })
          && !validEvidence({ resultado: 'aceptado', respuestaImportador: 'Fichero aceptado', fechaPrueba: new Date().toISOString() }),
        accessBoundary: companyAccess({ email: 'owner@test.invalid', role: 'user', data: {} }, { id: 'x', owner_email: 'owner@test.invalid' })
          && !companyAccess({ email: 'other@test.invalid', role: 'user', data: {} }, { id: 'x', owner_email: 'owner@test.invalid' }),
      } });
    }

    const companyId = clean(body.companyId || user?.data?.company_id);
    if (!companyId) return Response.json({ error: 'Selecciona una empresa.' }, { status: 400 });
    const svc = base44.asServiceRole;
    const company = await svc.entities.Company.get(companyId).catch(() => null);
    if (!company) return Response.json({ error: 'Empresa no encontrada.' }, { status: 404 });
    if (!companyAccess(user, company)) return Response.json({ error: 'Sin permiso para esta empresa.' }, { status: 403 });

    if (action === 'list') {
      const year = Number(body.ejercicio);
      const rows = await allRows(svc.entities.TaxImporterEvidence, Number.isInteger(year) && year > 2000 ? { companyId, ejercicio: year } : { companyId });
      return Response.json({ ok: true, rows: rows.map((item: any) => ({
        id: item.id, taxOfficialFileId: item.taxOfficialFileId, modeloCodigo: item.modeloCodigo,
        ejercicio: item.ejercicio, periodo: item.periodo, administracion: item.administracion,
        nombreFichero: item.nombreFichero, versionDiseno: item.versionDiseno, fileHashSha256: item.fileHashSha256,
        resultado: item.resultado, fechaPrueba: item.fechaPrueba, respuestaImportador: item.respuestaImportador,
        evidenceUrl: item.evidenceUrl, registradoPor: item.registradoPor, fechaRegistro: item.fechaRegistro,
        revisionAsesor: item.revisionAsesor || 'pendiente', revisadoPor: item.revisadoPor || '',
      })) });
    }

    if (action === 'record') {
      if (body.confirmation !== true || !validEvidence(body)) return Response.json({ error: 'Confirma el resultado oficial y adjunta su respuesta y evidencia HTTPS.' }, { status: 400 });
      const fileId = clean(body.fileId);
      if (!fileId) return Response.json({ error: 'Selecciona el fichero exacto.' }, { status: 400 });
      const file = await svc.entities.TaxOfficialFile.get(fileId).catch(() => null);
      if (!file || clean(file.companyId) !== companyId) return Response.json({ error: 'Fichero ajeno o inexistente.' }, { status: 404 });
      if (!eligibleFile(file)) return Response.json({ error: 'Solo se certifican ficheros exactos con SHA-256; los traspasos guiados no son importaciones oficiales.' }, { status: 409 });
      const hash = await contentHash(clean(file.contentBase64));
      if (hash !== lower(file.hash)) return Response.json({ error: 'El contenido conservado no coincide con la huella SHA-256 del fichero.' }, { status: 409 });
      const existing = await allRows(svc.entities.TaxImporterEvidence, { companyId, taxOfficialFileId: fileId });
      const matched = existing.find((item: any) => item.resultado === clean(body.resultado)
        && item.fechaPrueba === new Date(clean(body.fechaPrueba)).toISOString()
        && item.evidenceUrl === clean(body.evidenceUrl));
      if (matched) return Response.json({ ok: true, alreadyExisted: true, record: matched });
      const saved = await svc.entities.TaxImporterEvidence.create({
        companyId, taxOfficialFileId: file.id, modeloCodigo: clean(file.modeloCodigo), ejercicio: Number(file.ejercicio),
        periodo: clean(file.periodo), administracion: clean(file.administracion), nombreFichero: clean(file.nombreFichero),
        versionDiseno: clean(file.versionDiseno), fileHashSha256: hash, resultado: clean(body.resultado),
        fechaPrueba: new Date(clean(body.fechaPrueba)).toISOString(), respuestaImportador: clean(body.respuestaImportador),
        evidenceUrl: clean(body.evidenceUrl), registradoPor: clean(user.email), fechaRegistro: new Date().toISOString(),
        revisionAsesor: 'pendiente',
      });
      return Response.json({ ok: true, alreadyExisted: false, record: saved });
    }

    if (action === 'review') {
      if (!REVIEWER_ROLES.has(lower(user?.role))) return Response.json({ error: 'Solo un asesor o administrador puede revisar la evidencia.' }, { status: 403 });
      if (body.confirmation !== true) return Response.json({ error: 'Confirma la revisión.' }, { status: 400 });
      const row = await svc.entities.TaxImporterEvidence.get(clean(body.recordId)).catch(() => null);
      if (!row || clean(row.companyId) !== companyId) return Response.json({ error: 'Evidencia ajena o inexistente.' }, { status: 404 });
      if (row.revisionAsesor === 'revisada') return Response.json({ ok: true, alreadyExisted: true, record: row });
      const saved = await svc.entities.TaxImporterEvidence.update(row.id, {
        revisionAsesor: 'revisada', revisadoPor: clean(user.email), fechaRevision: new Date().toISOString(),
      });
      return Response.json({ ok: true, alreadyExisted: false, record: saved });
    }

    return Response.json({ error: 'Acción no soportada.' }, { status: 400 });
  } catch (error) {
    console.error('taxImporterCertification error', error);
    return Response.json({ error: error?.message || 'No se pudo registrar la prueba del importador.' }, { status: error?.status || 500 });
  }
});
