// Mechanical hardening only: expired/invalid tokens resolve to a missing user
// and follow the existing deny branch, never an internal-error response.
import fs from 'node:fs';
const changed=[];
for(const name of fs.readdirSync('base44/functions')){
  const file=`base44/functions/${name}/entry.ts`;
  if(!fs.existsSync(file))continue;
  const before=fs.readFileSync(file,'utf8');
  const after=before.replace(/\.auth\.me\(\)(?!\s*\.catch\s*\()/g,'.auth.me().catch(() => null)');
  if(after!==before){fs.writeFileSync(file,after.trimEnd()+'\n');changed.push(name);}
}
console.log(JSON.stringify({authFailureGuardChanged:changed.length,functions:changed}));

