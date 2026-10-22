// Generates disposable QA artifacts only. No network calls or Base44 SDK.
import fs from 'node:fs/promises';
import * as esbuild from 'esbuild';
const destination='public/__qa_mobile';
await fs.mkdir(destination,{recursive:true});
await esbuild.build({entryPoints:['scripts/mobile-controls-fixture.jsx'],bundle:true,format:'esm',platform:'browser',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'},alias:{'@':process.cwd()+'/src'},outfile:destination+'/controls.js'});
const css=(await fs.readdir('dist/assets')).find(path=>path.startsWith('index-')&&path.endsWith('.css'));
if(!css)throw Error('Build CSS missing');
await fs.copyFile('dist/assets/'+css,destination+'/controls.css');
console.log('Disposable standalone fixture built; no app or backend is mounted.');

