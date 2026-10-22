import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import * as esbuild from 'esbuild';
import React from 'react';
import {renderToString} from 'react-dom/server';
import {nativeSelectModel,selectText} from '../src/lib/nativeSelect.mjs';
import {recordNavigation,safeBackTarget,referenceDestination} from '../src/lib/navigationStack.mjs';
import {savePreference} from '../src/lib/optimisticPreference.mjs';

let cases=0;const check=(condition,message)=>{assert.ok(condition,message);cases++;};
const loc=(key,pathname='/ajustes',search='')=>({key,pathname,search,hash:''});
let ledger=recordNavigation([],loc('a','/'),0,'POP');
ledger=recordNavigation(ledger,loc('b'),1,'PUSH');
assert.deepEqual(safeBackTarget(ledger,loc('b'),1),{delta:-1});cases++;
assert.deepEqual(safeBackTarget([],loc('reload','/herramientas/renombrador'),9),{to:'/herramientas',replace:true});cases++;
assert.deepEqual(safeBackTarget(ledger,loc('foreign'),8),{to:'/',replace:true});cases++;
assert.deepEqual(safeBackTarget([],loc('admin','/admin/users'),22),{to:'/',replace:true});cases++;
assert.deepEqual(safeBackTarget([],loc('doc','/documentos/qa'),7),{to:'/documentos',replace:true});cases++;
ledger=recordNavigation(ledger,loc('c','/ajustes','?tab=seguridad'),1,'REPLACE');
check(ledger.length===2&&ledger.at(-1).href==='/ajustes?tab=seguridad','REPLACE must not grow the stack');
ledger=recordNavigation(ledger,loc('a','/'),0,'POP');check(ledger.length===1,'POP truncates known entries');
ledger=recordNavigation(ledger,loc('unobserved'),12,'POP');check(ledger.length===1,'Unknown POP cannot trust foreign history');
for(let i=0;i<140;i++)ledger=recordNavigation(ledger,loc('bounded'+i),i,'PUSH');
check(ledger.length===100,'Memory must be bounded');
for(const unsafe of ['javascript:alert(1)','//foreign.invalid','/\\foreign.invalid','data:text/html,x','http://unsecured.invalid'])check(referenceDestination(unsafe)===null,'Unsafe reference rejected');
assert.deepEqual(referenceDestination('https://taxeaportal.com/ajustes?tab=seguridad','https://taxeaportal.com'),{internal:true,to:'/ajustes?tab=seguridad'});cases++;
assert.deepEqual(referenceDestination('https://example.org/official'),{internal:false,to:'https://example.org/official'});cases++;

const itemType='item',groupType='group',labelType='label',valueType='value';
const element=(type,props)=>({type,props});
const model=nativeSelectModel([element(valueType,{placeholder:'Cuenta'}),element(groupType,{children:[element(labelType,{children:'Clientes'}),element(itemType,{value:'43000012',children:[element('svg',{}),' Cliente ',element('span',{children:'nuevo'})]}),element(itemType,{value:'43000018',disabled:true,children:'Archivado'})]}),element(itemType,{value:'all',children:'Todos'})],{itemType,groupType,labelType,valueType});
assert.deepEqual(model,{placeholder:'Cuenta',options:[{value:'43000012',label:'Cliente nuevo',group:'Clientes',disabled:false},{value:'43000018',label:'Archivado',group:'Clientes',disabled:true},{value:'all',label:'Todos',group:'',disabled:false}]});cases++;
check(selectText([0,null,false,' €'])==='0 €','Zero labels and fragments survive');

// Render actual shared Select with real React/server, not an invented DOM.
const built=await esbuild.build({entryPoints:['src/components/ui/select.jsx'],bundle:true,write:false,format:'cjs',platform:'node',packages:'external',jsx:'automatic',alias:{'@':process.cwd()+'/src'}});
const exported={},window={matchMedia:()=>({matches:true,addEventListener(){},removeEventListener(){}})};
const sandbox={exports:exported,module:{exports:exported},require:createRequire(import.meta.url),window,document:{documentElement:{}},getComputedStyle:()=>({getPropertyValue:()=> '0px'}),console};
vm.runInNewContext(built.outputFiles[0].text,sandbox);
const ui=sandbox.module.exports,e=React.createElement;
const createSelect=extra=>e(ui.Select,{value:'b',name:'account',onValueChange(){},...extra},e(ui.SelectTrigger,{'aria-label':'Estado',id:'qa-selector'},e(ui.SelectValue,{placeholder:'Selecciona'})),e(ui.SelectContent,null,e(ui.SelectGroup,null,e(ui.SelectLabel,null,'Grupo'),e(ui.SelectItem,{value:'a'},'Primera'),e(ui.SelectItem,{value:'b'},'Segunda'),e(ui.SelectItem,{value:'c',disabled:true},'Inactiva'))));
const native=renderToString(createSelect());
check(native.includes('<select')&&native.includes('name="account"'),'Mobile uses a real native control');
check((native.match(/<select/g)||[]).length===1,'Exactly one form control, not a duplicated hidden input');
check(native.includes('<optgroup label="Grupo"'),'Native groups survive');
check(/value="b" selected=""/.test(native),'Controlled selection survives');
check(/value="c" disabled=""/.test(native),'Disabled choices survive');
check(native.includes('aria-label="Estado"')&&native.includes('id="qa-selector"'),'Accessible label/id survive');
window.matchMedia=()=>({matches:false});
const desktop=renderToString(createSelect());
check(desktop.includes('role="combobox"')&&!desktop.includes('taxea-native-select'),'Desktop retains accessible Radix');

let visible={summary:false},release,events=[];
const previous=visible,next={summary:true},gate=new Promise(resolve=>{release=resolve;});
const operation=savePreference({previous,next,optimistic:value=>{visible=value;events.push('optimistic');},persist:async()=>{events.push('persist');await gate;throw Error('offline-private-details');},rollback:value=>{visible=value;events.push('rollback');}});
check(visible===next,'Preference response is immediate before network settles');
release();const result=await operation;
check(!result.ok&&visible===previous,'Failure restores confirmed preference');
assert.deepEqual(events,['optimistic','persist','rollback']);cases++;
const success=await savePreference({previous,next,optimistic:value=>{visible=value;},persist:async()=>{},rollback(){throw Error('No rollback on success');}});
check(success.ok&&visible===next,'Successful persistence retains new preference');
const css=fs.readFileSync('src/index.css','utf8'),page=fs.readFileSync('src/components/layout/PageTransition.jsx','utf8');
check(css.includes('touch-action:manipulation')&&css.includes('user-select:text'),'Controls suppress accidental gestures without blocking copy/zoom');
check(!/preventDefault/.test(page)&&!/<motion.div[^>]+key=/.test(page),'Transition cannot remount forms or suppress gestures');
check(page.includes('useReducedMotion')&&page.includes("navigation.direction==='back'"),'Transitions respect motion preference and POP direction');
console.log(JSON.stringify({ok:true,cases,realReactSelectRender:true,externalCalls:0,financialWrites:0},null,2));

