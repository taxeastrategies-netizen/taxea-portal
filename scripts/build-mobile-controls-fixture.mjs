// Generates disposable QA artifacts only. No network calls or Base44 SDK.
import fs from 'node:fs/promises';
import * as esbuild from 'esbuild';
const destination='public/__qa_mobile';
await fs.mkdir(destination,{recursive:true});
await esbuild.build({entryPoints:['scripts/mobile-controls-fixture.jsx'],bundle:true,format:'esm',platform:'browser',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'},plugins:[{name:'no-backend-fixture',setup(build){
  build.onResolve({filter:/^@\/api\/base44Client$/},()=>({path:'api',namespace:'qa'}));
  build.onResolve({filter:/OcrTopBarBadge$/},()=>({path:'badge',namespace:'qa'}));
  build.onLoad({filter:/.*/,namespace:'qa'},args=>({contents:args.path==='badge'?'export default function Badge(){return null;}':'export const base44={auth:{logout(){throw Error("No external actions in QA fixture");}}};',loader:'js'}));
}}],alias:{'@':process.cwd()+'/src'},outfile:destination+'/controls.js'});
const css=(await fs.readdir('dist/assets')).find(path=>path.startsWith('index-')&&path.endsWith('.css'));
if(!css)throw Error('Build CSS missing');
const styles=await fs.readFile('dist/assets/'+css,'utf8');
await fs.writeFile(destination+'/controls.css',styles.replace(/env\(safe-area-inset-(top|right|bottom|left)(?:,\s*0px)?\)/g,(_match,side)=>`var(--qa-env-safe-${side},0px)`));
console.log('Disposable standalone fixture built; SDK and badge replaced by no-network adapters; CSS env insets simulated.');

