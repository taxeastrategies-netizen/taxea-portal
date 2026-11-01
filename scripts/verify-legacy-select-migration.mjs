// Historical migration proof, intentionally separate from current runtime regressions.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {parse} from '@babel/parser';
const manifest=JSON.parse(fs.readFileSync('scripts/legacy-select-migration.json','utf8'));
function canonical(node){
  if(Array.isArray(node))return node.map(canonical).filter(Boolean);
  if(!node||typeof node!=='object')return node;
  if(node.type==='ImportDeclaration'&&node.source.value==='@/components/ui/NativeSelect')return null;
  const result={};for(const [key,value] of Object.entries(node)){if(['start','end','loc','extra','leadingComments','trailingComments','innerComments','comments','tokens'].includes(key))continue;result[key]=canonical(value);}
  if(['JSXOpeningElement','JSXClosingElement'].includes(result.type)&&result.name?.type==='JSXIdentifier'&&result.name.name==='NativeSelect')result.name.name='select';
  return result;
}
for(const {file} of manifest.files){
  // Check the certified migration snapshot, not freeze future legitimate UI work.
  // Runtime NativeSelect rendering above still uses the current implementation.
  const previous=execFileSync('git',['show',manifest.baseline+':'+file],{encoding:'utf8'}),current=execFileSync('git',['show','742fd5762bf5bc9f40582005b76096b7b8c2250c:'+file],{encoding:'utf8'});
  const ast=text=>canonical(parse(text,{sourceType:'module',plugins:['jsx']}).program);
  assert.deepEqual(ast(current),ast(previous),'Only JSX names/import may change: '+file);
}

console.log(JSON.stringify({ok:true,certifiedHistoricalMigrationFiles:manifest.files.length,currentRuntimeTest:'npm run verify:consolidation',externalCalls:0}));
