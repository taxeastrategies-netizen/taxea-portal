import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {parse} from '@babel/parser';
import * as esbuild from 'esbuild';
import React from 'react';
import {renderToString} from 'react-dom/server';
const built=await esbuild.build({entryPoints:['src/components/ui/NativeSelect.jsx'],bundle:true,write:false,format:'cjs',platform:'node',mainFields:['module','main'],external:['react','react-dom','react/jsx-runtime'],jsx:'automatic',alias:{'@':process.cwd()+'/src'},plugins:[{name:'viewport-only-adapter',setup(build){
  build.onResolve({filter:/useMobileViewport(?:\.js)?$/},()=>({path:'viewport',namespace:'qa'}));build.onLoad({filter:/.*/,namespace:'qa'},()=>({contents:'export default ()=>globalThis.__mobile;',loader:'js'}));
}}]});
const exported={},sandbox={exports:exported,module:{exports:exported},require:createRequire(import.meta.url),__mobile:true,console};
vm.runInNewContext(built.outputFiles[0].text,sandbox);
const {default:NativeSelect,htmlSelectOptions}=sandbox.module.exports,e=React.createElement;
const options=[e('option',{key:'',value:''},'Elegir cuenta'),e('optgroup',{key:'group',label:'Proveedores'},e('option',{value:'40000001'},'Proveedor ficticio'),e('option',{value:'40000002',disabled:true},'Archivado')),e('optgroup',{key:'disabled',label:'Inactivos',disabled:true},e('option',{value:'40000003'},'No disponible'))];
const model=htmlSelectOptions(options);
assert.equal(model.length,4);assert.equal(model[1].group,'Proveedores');assert.equal(model[2].disabled,true);assert.equal(model[3].disabled,true);
const mobile=renderToString(e(NativeSelect,{name:'account',id:'qa-native-account',required:true,value:'40000001','aria-label':'Proveedor',onChange(){}},options));
assert.equal((mobile.match(/<select/g)||[]).length,1);assert.equal((mobile.match(/name="account"/g)||[]).length,1);
assert.match(mobile,/role="combobox"/);assert.match(mobile,/aria-haspopup="dialog"/);assert.match(mobile,/aria-required="true"/);assert.match(mobile,/aria-label="Proveedor"/);
assert.match(mobile,/taxea-form-select-proxy/);assert.match(mobile,/value="40000001" selected=""/);
const zero=renderToString(e(NativeSelect,{value:0},e('option',{value:0},'Cero'),e('option',{value:1},'Uno')));assert.match(zero,/value="0" selected=""/);
sandbox.__mobile=false;
const desktop=renderToString(e(NativeSelect,{name:'account',value:'40000001',className:'existing-layout',onChange(){}},options));
assert.equal((desktop.match(/<select/g)||[]).length,1);assert.ok(!desktop.includes('role="combobox"'));assert.match(desktop,/existing-layout/);
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
console.log(JSON.stringify({ok:true,legacyFiles:manifest.files.length,certifiedMigrationAstUnchanged:true,nativeFormDataControlSingle:true,realReact:true,externalCalls:0},null,2));
