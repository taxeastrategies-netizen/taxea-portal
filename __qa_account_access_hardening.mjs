import fs from 'node:fs';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';

const names=['companyContextOperations','getCompanyContacts','getCompanyFinancials','invoiceOperations','documentBackupToDrive','importClientAccounting','sendEmail','invokeLimitedLLM','limitedCoreOperations'];
const helper=`
// Las propiedades ampliadas pueden llegar en la raíz o en data según la versión del SDK.
function isTaxeaAccountDisabled(account: any) {
  return [account, account?.data].filter(Boolean).some(state =>
    state.is_deleted === true
    || ['eliminado', 'bloqueado', 'suspendido'].includes(String(state.status || '').trim().toLowerCase())
    || ['suspended', 'blocked', 'disabled', 'deleted'].includes(String(state.accountAccessStatus || '').trim().toLowerCase()));
}
`;
const denial="    if (isTaxeaAccountDisabled(user)) return Response.json({ error: 'Acceso al portal suspendido.', code: 'ACCOUNT_DISABLED' }, { status: 403 });";
const previous="    if (user.is_deleted || ['eliminado', 'bloqueado', 'suspendido'].includes(user.status)\n      || user.accountAccessStatus === 'suspended') return Response.json({ error: 'Acceso al portal suspendido.', code: 'ACCOUNT_DISABLED' }, { status: 403 });";
const method="    if (req.method !== 'POST') return Response.json({ error: 'Método no permitido' }, { status: 405 });\n";
export function transform(name,source){
  if(!names.includes(name)||source.includes('function isTaxeaAccountDisabled'))throw Error('Unsupported or already modified source '+name);
  const imports=source.match(/^import \{ createClientFromRequest \} from 'npm:@base44\/sdk@[^']+';$/m);
  if(!imports)throw Error('SDK import anchor missing '+name);
  let candidate=source.replace(imports[0],imports[0]+'\n'+helper);
  if(candidate.includes(previous))candidate=candidate.replace(previous,denial);
  else{
    const anchor=candidate.match(/^    if \(!user(?:\?\.id \|\| !user\?\.email)?\) return Response\.json\([^\n]+status: 401[^\n]+;$/m);
    if(!anchor)throw Error('Authentication boundary not recognized '+name);
    candidate=candidate.replace(anchor[0],anchor[0]+'\n'+denial);
  }
  if(!candidate.includes("if (req.method !== 'POST')")){
    const marker='    const base44 = createClientFromRequest(req);';
    if(candidate.split(marker).length!==2)throw Error('Request boundary ambiguous '+name);
    candidate=candidate.replace(marker,method+marker);
  }
  if(name==='companyContextOperations'){
    const anchor="    const oldCompanyId = String(current.data?.company_id || current.company_id || '');";
    if(!candidate.includes(anchor))throw Error('Fresh identity boundary missing');
    candidate=candidate.replace(anchor,"    if (isTaxeaAccountDisabled(current)) return Response.json({ error: 'Acceso al portal suspendido.', code: 'ACCOUNT_DISABLED' }, { status: 403 });\n\n"+anchor);
  }
  return candidate;
}
const mode=process.argv[2];
if(mode){
 const paths=names.map(name=>'base44/functions/'+name+'/entry.ts');
 const actual=Object.fromEntries(paths.map(path=>[path,fs.readFileSync(path,'utf8')]));
 const candidates=Object.fromEntries(names.map((name,i)=>[paths[i],transform(name,actual[paths[i]])]));
 const manifestPath='/tmp/taxea-account-access-verified.json';
 const digest=source=>crypto.createHash('sha256').update(source).digest('hex');
 if(mode==='--pretest'){
  globalThis.__taxeaSecurityCandidate=candidates;
  await import(process.cwd()+'/scripts/test-security-account-access.mjs');
  await import(process.cwd()+'/scripts/test-security-server-downloads.mjs');
  fs.writeFileSync(manifestPath,JSON.stringify(Object.fromEntries(paths.map(path=>[path,{before:digest(actual[path]),after:digest(candidates[path])}]))));
  console.log(JSON.stringify({candidateVerified:true,functions:names.length,customerWrites:0}));
 }else if(mode==='--apply'){
  const verified=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
  for(const path of paths)if(verified[path]?.before!==digest(actual[path])||verified[path]?.after!==digest(candidates[path]))throw Error('Candidate changed since verification '+path);
  const status=execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
  if(status.some(line=>paths.some(path=>line.endsWith(path))))throw Error('Uncommitted concurrent sensitive-function changes; refusing overwrite.');
  for(const path of paths)fs.writeFileSync(path,candidates[path]);
  console.log(JSON.stringify({applied:true,functions:names.length,preverifiedHashes:true,customerWrites:0}));
 }else throw Error('Unknown mode');
}
