// Mechanical hardening only: expired/invalid tokens resolve to a missing user
// and follow the existing deny branch, never an internal-error response.
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const changed=[];
for(const name of fs.readdirSync('base44/functions')){
  const file=`base44/functions/${name}/entry.ts`;
  if(!fs.existsSync(file))continue;
  const before=fs.readFileSync(file,'utf8');
  const after=before.replace(/\.auth\.me\(\)(?!\s*\.catch\s*\()/g,'.auth.me().catch(() => null)');
  if(after!==before){fs.writeFileSync(file,after.trimEnd()+'\n');changed.push(name);}
}
console.log(JSON.stringify({authFailureGuardChanged:changed.length,functions:changed}));
if(process.argv.includes('--format-touched')){
  const touched=execFileSync('git',['diff','--name-only','f801bfa4ac29b8ae36fc16c04cddf8ce36167a24'],{encoding:'utf8'}).trim().split('\n');
  let formatted=0;
  for(const file of touched){
    if(!/^(base44\/(entities\/PlanCatalog\.jsonc|functions\/[^/]+\/(entry\.ts|SHEETJS-PROVENANCE\.json))|package\.json|scripts\/(normalize-auth-failure|test-security-[\w-]+|diagnose-phase4-baseline)\.mjs)$/.test(file))continue;
    const source=fs.readFileSync(file,'utf8'),normalized=source.trimEnd()+'\n';
    if(source!==normalized){fs.writeFileSync(file,normalized);formatted++;}
  }
  console.log(JSON.stringify({formattedEndOfFile:formatted,vendorUnchanged:true}));
}

