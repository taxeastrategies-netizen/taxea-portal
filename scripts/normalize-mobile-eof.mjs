// Formatting only: PowerShell pipes add an extra CR/LF to sandbox writes.
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const paths=execFileSync('git',['diff','--name-only','d03e762ff263402d4f51c52a258437d10b65a6b7'],{encoding:'utf8'}).trim().split('\n');
for(const file of paths){
  if(!/^(src\/|scripts\/(test-mobile-|normalize-mobile-eof)|base44\/(entities\/AccountDeletionRequest|functions\/accountDeletionOperations\/))/.test(file))throw new Error('Unexpected file outside mobile task: '+file);
  const before=fs.readFileSync(file,'utf8'),after=before.trimEnd()+'\n';
  if(before!==after)fs.writeFileSync(file,after);
}
console.log('Normalised EOF whitespace in task files only.');

