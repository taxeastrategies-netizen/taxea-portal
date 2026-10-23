// Offline contract and memory tests; these do not certify provider-side RLS.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
const root = path.resolve(process.argv[2] || '.');
const read = p => fs.readFile(path.join(root, p), 'utf8');
let checks = 0;
function check(condition, message) { assert.ok(condition, message); checks++; }
function allows(rule, role) {
  if (typeof rule === 'boolean') return rule;
  if (rule?.$or) return rule.$or.some(item => allows(item, role));
  return rule?.user_condition?.role === role;
}
const user = JSON.parse(await read('base44/entities/User.jsonc'));
for (const key of ['role','company_id','stripeCustomerId','status','is_deleted','accountAccessStatus','adminActivationStatus','isPortalActive','activatedAt','activatedBy']) {
  check(!allows(user.properties[key].rls.write, 'user'), key + ' is not self-assignable');
  check(allows(user.properties[key].rls.write, 'admin'), key + ' remains admin-editable');
}
check(!user.properties.phone.rls, 'Normal profile field remains editable');
const notes = JSON.parse(await read('base44/entities/PredefinedNote.jsonc'));
check(!allows(notes.rls.read, undefined), 'Anonymous cannot read shared notes');
for (const role of ['user','admin','super_admin','advisor','asesor']) check(allows(notes.rls.read, role), 'Authenticated shared-note role ' + role);
const app = await read('src/App.jsx');
for (const route of ['/admin','/admin-asistente','/admin-sugerencias','/admin-afiliados','/subida-modelos','/admin-whatsapp','/admin/clients','/admin/users','/admin/audit','/admin/ocr-credits','/admin/ocr-bandeja']) {
  const line = app.split('\n').find(line => line.includes('path="' + route + '"'));
  check(line?.includes('element={<AdminOnlyRoute isAdmin={isAdmin}>'), route + ' is centrally guarded');
}
const session = await import('data:text/javascript;base64,' + Buffer.from(await read('src/lib/sessionSecurity.mjs')).toString('base64'));
let privateValue = 'A', resets = 0, otherCleanup = 0;
session.registerSessionCleanup(() => { privateValue = null; resets++; });
const unsubscribe = session.registerSessionCleanup(() => { throw new Error('QA isolated cleanup failure'); });
session.registerSessionCleanup(() => otherCleanup++);
session.acceptSessionIdentity({id:'A',role:'user'});
check(privateValue === 'A', 'First authenticated check preserves same-tab advisor context');
session.acceptSessionIdentity({id:'A',role:'user'});
check(resets === 0, 'Repeated me does not reset active forms');
session.acceptSessionIdentity({id:'B',role:'user'});
check(privateValue === null && resets === 1 && otherCleanup === 1, 'Account transition resets every private cache');
session.acceptSessionIdentity({id:'B',role:'admin'});
check(resets === 2, 'Role transition resets private cache');
unsubscribe();
session.forgetSessionIdentity();
check(resets === 3, 'Logout resets private state');
const cleanups = [];
const storage = new Map([['taxea_impersonation','QA'],['unrelated-setting','keep']]);
const context = vm.createContext({
  registerSessionCleanup: fn => cleanups.push(fn),
  sessionStorage: {getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
  QueryClient: class {cancelQueries(){this.cancelled=true;} clear(){this.cleared=true;}},
});
const strip = source => source.replace(/^import .*;\s*$/gm, '').replace(/\bexport\s+(const|function)/g,'$1');
vm.runInContext(strip(await read('src/lib/query-client.js')), context);
vm.runInContext(strip(await read('src/lib/impersonation.js')), context);
vm.runInContext(strip(await read('src/lib/useCompanyContext.jsx')), context);
vm.runInContext("companyCache.set('QA-company',{synthetic:true})", context);
cleanups.forEach(fn => fn());
check(vm.runInContext('companyCache.size === 0',context), 'Company cache actually clears');
check(vm.runInContext('queryClientInstance.cancelled && queryClientInstance.cleared',context), 'Query cache actually clears and cancels');
check(!storage.has('taxea_impersonation') && storage.has('unrelated-setting'), 'Only advisor-session storage is removed');
const client = await read('src/api/base44Client.js');
check(client.includes("if (property === 'auth') return sessionAuth"), 'Direct SDK logout uses protected proxy');
const auth = await read('src/lib/AuthContext.jsx');
check(auth.includes('forgetSessionIdentity();\n      setUser(null);'), 'Authentication failure forgets stale identity');
console.log(JSON.stringify({ok:true,offline:true,checks,providerRlsProven:false,realCustomerWrites:0}));
