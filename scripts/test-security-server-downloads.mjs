import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { webcrypto, generateKeyPairSync, createHash } from 'node:crypto';
import * as esbuild from 'esbuild';

const appId = '6a00fec50cc522a74ddde4b2';
const companyId = 'qa-company';
const pdfUrl = `https://base44.app/api/apps/${appId}/files/mp/public/${appId}/qa.pdf`;
const mediaUrl = `https://media.base44.com/files/public/${appId}/qa.pdf`;
const marker = 'INTERNAL_PROVIDER_SECRET_MUST_NOT_LEAK';
const privatePdfUrl='https://taxeaportal.com/private-document/qa-private-asset';
const syntheticPdf=new TextEncoder().encode('%PDF-1.7\nSynthetic document only');
const {privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const syntheticCredentials={type:'service_account',project_id:'plasma-minutia-510419-c4',client_email:'taxea-portal-storage@plasma-minutia-510419-c4.iam.gserviceaccount.com',private_key:privateKey.export({format:'pem',type:'pkcs8'}),token_uri:'https://oauth2.googleapis.com/token'};
let checks = 0;
const check = (value, label) => { assert.ok(value, label); checks++; };
const sourceOf = path => globalThis.__taxeaSecurityCandidate?.[path] ?? fs.readFileSync(path, 'utf8');

async function load(name, settings = {}) {
  let handler, serviceReads = 0, providerCalls = 0, gmailCalls = 0, creates = 0, cancelled = 0, envReads = 0;
  const urls = [];
  const user = settings.user ?? { id: 'qa-user', email: 'qa@example.test', role: 'user', data: { company_id: companyId } };
  const invoice = { id: 'qa-invoice', company_id: companyId, tipo: 'emitida', qr_url: 'https://aeat.invalid.test/qa', qr_pdf_url: settings.pdfUrl ?? pdfUrl, public_token: 'qa-token' };
  const entities = new Proxy({}, { get(_, entity) { return {
    async get(id) {
      if (entity === 'Company') return id === companyId ? { id, owner_email: user.email, activa: settings.companyActive ?? true } : null;
      if (entity === 'DocumentAsset') return {id:'qa-private-asset',company_id:companyId,object_name:'companies/'+companyId+'/11111111-1111-4111-8111-111111111111.pdf',generation:'123',status:'ready',mime_type:'application/pdf',size:syntheticPdf.length,sha256:createHash('sha256').update(syntheticPdf).digest('hex'),...settings.asset};
      if (entity === 'Invoice') return id === invoice.id ? invoice : null;
      throw Error('Unexpected read ' + entity);
    },
    async filter() { return []; },
    async update(id, patch) { return { id, ...patch }; },
    async create(row) { creates++; return { id: 'qa-row', ...row }; },
  }; } });
  const service = { entities, connectors: { async getCurrentAppUserConnection() { return { accessToken: 'synthetic-not-a-credential', connectionConfig: { email: user.email } }; } }, integrations: { Core: new Proxy({}, { get() { return async () => { providerCalls++; return { synthetic: true }; }; } }) } };
  const client = { auth: { async me() { return user; } }, get asServiceRole() { serviceReads++; return service; } };
  const built = await esbuild.build({
    stdin: { contents: sourceOf(`base44/functions/${name}/entry.ts`), loader: 'ts', resolveDir: process.cwd()+'/base44/functions/'+name },
    bundle: true, write: false, platform: 'node', format: 'cjs',
    plugins: [{ name: 'synthetic-sdk', setup(b) {
      b.onResolve({ filter: /^npm:@base44\/sdk/ }, () => ({ path: 'sdk', namespace: 'qa' }));
      b.onLoad({ filter: /.*/, namespace: 'qa' }, () => ({ contents: 'export const createClientFromRequest=()=>globalThis.__client;', loader: 'js' }));
    } }],
  });
  const fakeFetch = async (url, options) => {
    if (url === 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send') { gmailCalls++; return Response.json({ id: 'qa-gmail-id' }); }
    if (url==='https://oauth2.googleapis.com/token') { urls.push('synthetic-oauth'); return Response.json({access_token:'synthetic-only',token_type:'Bearer'}); }
    if (String(url).startsWith('https://storage.googleapis.com/storage/v1/')) { urls.push('synthetic-storage'); return new Response(settings.corruptPrivate ? new Uint8Array([0,1,2]) : syntheticPdf); }
    urls.push(String(url));
    check(options?.redirect === 'manual', 'PDF download must never follow unchecked redirects');
    check(options?.signal instanceof AbortSignal, 'PDF download must have an abort signal');
    if (settings.fetch) return settings.fetch(url, options, () => { cancelled++; });
    return new Response('%PDF-1.7\nSynthetic document only', { headers: { 'content-type': 'application/pdf' } });
  };
  const context = vm.createContext({
    __client: client, Request, Response, URL, URLSearchParams, TextEncoder, Uint8Array, AbortController, crypto: webcrypto, btoa, atob, TextDecoder, Blob, AbortSignal,
    setTimeout: settings.setTimeout ?? setTimeout, clearTimeout: settings.clearTimeout ?? clearTimeout,
    fetch: fakeFetch, console: { log() {}, warn() {}, error() {} }, Deno: { env:{get(name){envReads++;return ({TAXEA_GCS_CREDENTIALS_JSON:JSON.stringify(syntheticCredentials),TAXEA_GCS_BUCKET:'taxea-portal-private-es-6a00fec5',TAXEA_GCS_PROJECT_ID:'plasma-minutia-510419-c4'})[name];}}, serve(fn) { handler = fn; } },
  });
  vm.runInContext(built.outputFiles[0].text, context);
  return {
    async invoke(extra = {}, method = 'POST') {
      const body = { action: 'send', company_id: companyId, invoice_id: invoice.id, public_invoice_url: 'https://taxeaportal.com/public/invoice/qa-token', to: ['recipient@example.test'], subject: 'QA', html: '<p>QA</p>', attachments: [{ url: settings.pdfUrl ?? pdfUrl, name: 'qa.pdf' }], ...extra };
      const response = await handler(new Request('https://qa.invalid.test/' + name, { method, ...(method === 'GET' ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }) }));
      return { status: response.status, body: await response.json() };
    },
    counts() { return { serviceReads, providerCalls, gmailCalls, creates, cancelled, envReads, urls }; },
  };
}

for (const name of ['sendEmail', 'invokeLimitedLLM', 'limitedCoreOperations']) {
  for (const blocked of [{ is_deleted: true }, { status: 'eliminado' }, { status: 'bloqueado' }, { status: 'suspendido' }, { accountAccessStatus: 'suspended' }]) {
    const r = await load(name, { user: { id: 'qa-user', email: 'qa@example.test', role: 'user', ...blocked } });
    const response = await r.invoke();
    check(response.status === 403 && response.body.code === 'ACCOUNT_DISABLED', `${name}: disabled account denied`);
    check(r.counts().serviceReads === 0, `${name}: no service access before disabled-account rejection`);
    check(r.counts().gmailCalls + r.counts().providerCalls === 0, `${name}: no transmission for disabled account`);
  }
  const r = await load(name);
  check((await r.invoke({}, 'GET')).status === 405, `${name}: GET cannot cause side effects`);
  check(r.counts().serviceReads === 0, `${name}: wrong method rejected before privileged data`);
}

for (const operation of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
  const r = await load('limitedCoreOperations');
  check((await r.invoke({ operation, companyId })).status === 400, 'Inherited operation must not bypass allowlist');
  check(r.counts().serviceReads === 0, 'Unknown operation denied before data access');
}

for (const url of ['http://localhost/x', 'https://127.0.0.1/x', 'https://169.254.169.254/x', 'https://external.invalid.test/qa.pdf', 'https://base44.app.evil.invalid.test/x', `https://base44.app/api/apps/foreign/files/mp/public/qa.pdf`, `https://media.base44.com/files/private/foreign/qa.pdf`, `https://user:pass@base44.app/api/apps/${appId}/files/mp/public/qa.pdf`, pdfUrl + '#ignored', pdfUrl.replace('.app/', '.app:444/')]) {
  const r = await load('invokeLimitedLLM');
  const response = await r.invoke({ prompt: 'Synthetic QA', file_urls: [url] });
  check(response.status === 400, 'Untrusted AI file URL rejected');
  check(r.counts().providerCalls === 0 && r.counts().creates === 0, 'Untrusted AI URL never reaches provider or quota reservation');
}
for (const url of [pdfUrl, mediaUrl, `https://media.base44.com/files/private/${appId}/qa.pdf?synthetic_signature=not-a-token`]) {
  const r = await load('invokeLimitedLLM');
  check((await r.invoke({ prompt: 'Synthetic QA', file_urls: [url] })).status === 200, 'Taxea file URLs remain usable by OCR');
  check(r.counts().providerCalls === 1, 'Valid request has exactly one synthetic provider call');
}

const direct = await load('sendEmail');
check((await direct.invoke()).status === 200, 'Ordinary invoice send remains functional in simulation');
check(direct.counts().gmailCalls === 1, 'Exactly one synthetic Gmail send after successful PDF validation');
const redirected = await load('sendEmail', { fetch: async url => url === pdfUrl
  ? new Response(null, { status: 302, headers: { location: mediaUrl } })
  : new Response('%PDF-1.7\nSynthetic PDF') });
check((await redirected.invoke()).status === 200, 'Documented same-app CDN redirect remains usable');
check(redirected.counts().urls.length === 2, 'Exactly two validated download hops');

for (const location of ['https://127.0.0.1/private', 'https://evil.invalid.test/qa', `https://media.base44.com/files/public/foreign/qa.pdf`]) {
  const r = await load('sendEmail', { fetch: async () => new Response(null, { status: 302, headers: { location } }) });
  check((await r.invoke()).status === 400, 'Unsafe redirect rejected');
  check(r.counts().urls.length === 1 && r.counts().gmailCalls === 0, 'Unsafe target never fetched or emailed');
}
const loop = await load('sendEmail', { fetch: async () => new Response(null, { status: 302, headers: { location: mediaUrl } }) });
check((await loop.invoke()).status === 502, 'Redirect loop bounded');
check(loop.counts().urls.length === 4 && loop.counts().gmailCalls === 0, 'At most four fetches and no send on redirect loop');

for (const body of ['', '<html>Not a PDF</html>']) {
  const r = await load('sendEmail', { fetch: async () => new Response(body) });
  check([400, 415].includes((await r.invoke()).status), 'Empty/HTML payload cannot masquerade as PDF');
  check(r.counts().gmailCalls === 0, 'No email when PDF content invalid');
}
const declared = await load('sendEmail', { fetch: async () => new Response('%PDF-', { headers: { 'content-length': String(10 * 1024 * 1024 + 1) } }) });
check((await declared.invoke()).status === 413, 'Oversized Content-Length rejected before buffering');
check(declared.counts().gmailCalls === 0, 'No send after declared-size limit');
const streamed = await load('sendEmail', { fetch: async (url, options, onCancel) => new Response(new ReadableStream({
  pull(c) { c.enqueue(new Uint8Array(1024 * 1024)); }, cancel() { onCancel(); },
})) });
check((await streamed.invoke()).status === 413, 'Unbounded stream stopped at byte cap');
check(streamed.counts().cancelled === 1 && streamed.counts().gmailCalls === 0, 'Oversized stream cancelled; nothing sent');
let abortDownload;
const timeout = await load('sendEmail', { setTimeout(fn) { abortDownload = fn; return 1; }, clearTimeout() {},
  fetch: async (url, options) => { abortDownload(); throw Error('Synthetic timeout'); } });
check((await timeout.invoke()).status === 504, 'Timeout returns controlled no-send response');
check(timeout.counts().gmailCalls === 0, 'No send after download timeout');

for (const public_invoice_url of ['https://evil.invalid.test/public/invoice/qa-token', 'https://taxeaportal.com.evil.invalid.test/public/invoice/qa-token', 'https://evil.invalid.test/https://taxeaportal.com/public/invoice/qa-token', 'https://taxeaportal.com/public/invoice/qa-token?redirect=evil', 'https://user:pass@taxeaportal.com/public/invoice/qa-token']) {
  const r = await load('sendEmail');
  check((await r.invoke({ public_invoice_url })).status === 409, 'Untrusted public link cannot enter outbound email');
  check(r.counts().urls.length === 0 && r.counts().gmailCalls === 0, 'No download/send for invalid public link');
}
const inactiveCompany = await load('sendEmail', { companyActive: false });
check((await inactiveCompany.invoke()).status === 403, 'Inactive company cannot send');
check(inactiveCompany.counts().gmailCalls === 0, 'No Gmail use for inactive company');
console.log(JSON.stringify({ ok: true, checks, realSends: 0, realCustomerData: 0, test: 'server-download-security' }));

const privateInvoice=await load('sendEmail',{pdfUrl:privatePdfUrl});
const privateResponse=await privateInvoice.invoke(); check(privateResponse.status===200,'Private PDF send supported in simulation: '+JSON.stringify(privateResponse));
check(privateInvoice.counts().gmailCalls===1,'One simulated Gmail call for a verified private PDF');
check(privateInvoice.counts().urls.every(x=>x.startsWith('synthetic-')),'Private reference is never fetched as a public URL');
for(const settings of [
 {asset:{company_id:'foreign-company'},expected:404},
 {asset:{mime_type:'text/html'},expected:415},
 {asset:{size:10*1024*1024+1},expected:413},
 {asset:{status:'failed'},expected:404},
]){
 const run=await load('sendEmail',{pdfUrl:privatePdfUrl,...settings});
 check((await run.invoke()).status===settings.expected,'Invalid private asset rejected');
 check(run.counts().gmailCalls===0&&run.counts().urls.length===0&&run.counts().envReads===0,'Private asset rejection occurs before secret reads and network');
}
const corruptPrivate=await load('sendEmail',{pdfUrl:privatePdfUrl,corruptPrivate:true});
check((await corruptPrivate.invoke()).status===502,'Corrupt private download rejected');
check(corruptPrivate.counts().gmailCalls===0,'Hash mismatch never sends mail');
const substituted=await load('sendEmail',{pdfUrl:privatePdfUrl});
check((await substituted.invoke({attachments:[{url:privatePdfUrl+'-other'}]})).status===400,'Private attachment cannot be substituted');
check(substituted.counts().gmailCalls===0&&substituted.counts().envReads===0,'Substitution rejected before secrets');
console.log(JSON.stringify({ok:true,checks,privatePdfAttachmentTests:true,realSends:0,realCustomerData:0}));
