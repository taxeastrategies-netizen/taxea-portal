import {build} from 'esbuild';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const source='base44/functions/documentStorage/storageAssets.mjs';
const modules=['storageAssets.mjs','storageCredentials.mjs','storageTransport.mjs','storageSigning.mjs'];
const digest=createHash('sha256');
for(const name of modules)digest.update(name+'\n'+await readFile('base44/functions/documentStorage/'+name));
const hash=digest.digest('hex');
const result=await build({entryPoints:[source],bundle:true,write:false,format:'esm',platform:'neutral',target:'es2022',minify:false});
const output='// GENERATED from documentStorage modules. Run node scripts/build-storage-runtime.mjs.\n// canonical-sha256: '+hash+'\n'+result.outputFiles[0].text;
const targets=process.argv.slice(2);
if(!targets.length)throw new Error('Specify consumer function names.');
for(const name of targets){if(!/^[A-Za-z][A-Za-z0-9]+$/.test(name))throw new Error('Invalid consumer');const directory='base44/functions/'+name;await mkdir(directory,{recursive:true});await writeFile(directory+'/storageRuntime.generated.mjs',output);}
console.log(JSON.stringify({ok:true,canonicalSha256:hash,bytes:Buffer.byteLength(output),consumers:targets}));
