import assert from'node:assert/strict';import{legacyProtectionFileFormat,privateFileFormat,saveLegacyProtectionAsset}from'../base44/functions/documentStorage/storageAssets.mjs';import{protectionFileName}from'../base44/functions/documentBackupToDrive/legacyProtectionExecutor.mjs';
const enc=s=>new TextEncoder().encode(s),join=(a,b)=>new Uint8Array([...a,...b]),body=enc('%PDF-1.7\n1 0 obj\n<<>>\nendobj\nstartxref\n9\n%%EOF\n');let checks=0;
for(const at of [1,201,1015]){const bytes=join(new Uint8Array(at),body),before=Buffer.from(bytes).toString('hex');assert.deepEqual(legacyProtectionFileFormat({name:'qa.pdf'},bytes),{ext:'pdf',mime:'application/pdf'});assert.equal(Buffer.from(bytes).toString('hex'),before);assert.throws(()=>privateFileFormat({name:'qa.pdf'},bytes),/UNSUPPORTED_FILE/);assert.equal(protectionFileName({originalName:'qa.pdf'},bytes),'qa.pdf');checks+=4;}
for(const bytes of [join(new Uint8Array(1025),body),join(enc('<html><script>'),body),join(enc('-----BEGIN PRIVATE KEY-----'),body),join(new Uint8Array(201),enc('%PDF-1.7\nno end marker')),join(new Uint8Array(201),enc('%PDF-invalid\n%%EOF\n'))]){assert.throws(()=>legacyProtectionFileFormat({name:'qa.pdf'},bytes),/UNSUPPORTED_FILE/);checks++;}
assert.throws(()=>legacyProtectionFileFormat({name:'qa.txt'},join(new Uint8Array(201),body)),/UNSUPPORTED_FILE/);checks++;
assert.deepEqual(legacyProtectionFileFormat({name:'qa.pdf'},body),privateFileFormat({name:'qa.pdf'},body));checks++;
// Exercise the actual saver, including complete prefixed bytes, readback hash and idempotency.
const bytes=join(new Uint8Array(201),body),rows=[],objects=new Map();let puts=0;
const matches=(r,q)=>Object.entries(q).every(([k,v])=>v&&typeof v==='object'?v.$in.includes(r[k]):r[k]===v);
const service={entities:{Company:{get:async()=>({id:'company-qa',activa:false})},DocumentAsset:{get:async id=>rows.find(r=>r.id===id),filter:async q=>rows.filter(r=>matches(r,q)),create:async p=>{const r={id:'asset-qa',...p};rows.push(r);return r;},update:async(id,p)=>Object.assign(rows.find(r=>r.id===id),p)}}};
const transport={metadata:async n=>objects.has(n)?{generation:'2',size:bytes.length}:null,put:async(n,b)=>{puts++;objects.set(n,b.slice());return{generation:'2',size:b.length};},get:async n=>objects.get(n)};
const args=[service,{id:'admin-qa',role:'admin'},'company-qa',new File([bytes],'qa.pdf'),{get:()=> 'true'},async()=>transport];
const saved=await saveLegacyProtectionAsset(...args);assert.equal(saved.asset.size,bytes.length);assert.deepEqual(objects.get(saved.asset.object_name),bytes);assert.equal(saved.asset.sha256,Buffer.from(await crypto.subtle.digest('SHA-256',bytes)).toString('hex'));assert.equal(puts,1);checks+=4;
assert.equal((await saveLegacyProtectionAsset(...args)).reused,true);assert.equal(puts,1);assert.equal(rows.length,1);checks+=3;
await assert.rejects(()=>saveLegacyProtectionAsset(service,{id:'normal',role:'user'},...args.slice(2)),/ADMIN_ONLY/);assert.equal(puts,1);checks+=2;
console.log(JSON.stringify({ok:true,checks,originalBytesPreserved:true,newUploadsRemainStrict:true,financialWrites:0,externalCalls:0}));
