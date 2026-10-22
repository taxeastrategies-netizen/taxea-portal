import assert from 'node:assert/strict';
import fs from 'node:fs';
import postcss from 'postcss';
import {execFileSync} from 'node:child_process';
import {parse} from '@babel/parser';
import {focusableWorkspaceControls,topmostDismissibleLayer} from '../src/lib/fullscreenNavigation.mjs';

const controls=[
  {name:'back',tabIndex:0,disabled:false,visible:true,hidden:false},
  {name:'disabled',tabIndex:0,disabled:true,visible:true,hidden:false},
  {name:'native-form-proxy',tabIndex:-1,disabled:false,visible:true,hidden:false},
  {name:'inert-screen',tabIndex:0,disabled:false,visible:true,hidden:true},
  {name:'display-none',tabIndex:0,disabled:false,visible:false,hidden:false},
  {name:'last',tabIndex:0,disabled:false,visible:true,hidden:false},
].map(node=>({...node,getClientRects:()=>node.visible?[{}]:[],closest:()=>node.hidden?{}:null}));
assert.deepEqual(focusableWorkspaceControls({querySelectorAll:()=>controls}).map(c=>c.name),['back','last']);
const layer=(name,contains,visible=true,hidden=false)=>({name,contains:()=>contains,getClientRects:()=>visible?[{}]:[],closest:()=>hidden?{}:null});
const workspace=layer('workspace',true),picker=layer('nested-picker',true),hidden=layer('cached-workspace',true,true,true);
assert.equal(topmostDismissibleLayer({activeElement:{},querySelectorAll:()=>[workspace,picker,hidden]}).name,'nested-picker');
assert.equal(topmostDismissibleLayer({activeElement:{},querySelectorAll:()=>[layer('workspace',false),layer('last',false)]}).name,'last');
assert.equal(topmostDismissibleLayer({activeElement:{},querySelectorAll:()=>[hidden,layer('invisible',true,false)]}),null);
const css=fs.readFileSync('src/styles/fullscreen-workspace.css','utf8'),parsed=postcss.parse(css),padding={};
parsed.walkRules(rule=>{if(rule.selector==='.taxea-fullscreen-surface')rule.walkDecls(decl=>{if(decl.prop.startsWith('padding-'))padding[decl.prop]=decl.value;});});
for(const side of ['top','right','bottom','left'])assert.equal(padding['padding-'+side],`env(safe-area-inset-${side},0px)`);
const topbar=fs.readFileSync('src/components/layout/TopBar.jsx','utf8');
assert.match(topbar,/taxea-mobile-back min-w-11/);assert.ok(!topbar.includes('taxea-mobile-back md:hidden'));
const fullscreen=fs.readFileSync('src/components/layout/FullscreenWorkspace.jsx','utf8');
assert.match(fullscreen,/createPortal/);assert.match(fullscreen,/hidden=\{inactive\}/);assert.match(fullscreen,/inert=\{inactive/);assert.match(fullscreen,/NAVIGATION_COMMITTED_EVENT/);
assert.match(fullscreen,/!root.contains\(event.target\)/);assert.match(fullscreen,/if\(!busy\)onBack/);
for(const file of ['src/components/lector/OcrReviewWorkspace.jsx','src/components/facturas/InvoiceDocumentWorkspace.jsx'])assert.match(fs.readFileSync(file,'utf8'),/<FullscreenWorkspace/);
assert.match(fs.readFileSync('src/components/lector/MobileScanner.jsx','utf8'),/taxea-fullscreen-surface/);
assert.match(fs.readFileSync('src/components/facturas/InvoiceDocumentWorkspace.jsx','utf8'),/w-full shrink-0 border-t/);
// Send preview can change presentation only. Compare the complete current AST
// against the last released version, ignoring only the approved UI attributes.
function canonical(node){
  if(Array.isArray(node))return node.map(canonical).filter(Boolean);
  if(!node||typeof node!=='object')return node;
  if(node.type==='JSXAttribute'&&['className','type','aria-label'].includes(node.name.name))return null;
  const result={};for(const [key,value] of Object.entries(node)){if(['start','end','loc','extra','leadingComments','trailingComments','innerComments','comments','tokens'].includes(key))continue;result[key]=canonical(value);}return result;
}
const sendFile='src/components/facturas/SendInvoiceDocumentModal.jsx';
const baseline=execFileSync('git',['show','742fd5762bf5bc9f40582005b76096b7b8c2250c:'+sendFile],{encoding:'utf8'});
const ast=text=>canonical(parse(text,{sourceType:'module',plugins:['jsx']}).program);
assert.deepEqual(ast(fs.readFileSync(sendFile,'utf8')),ast(baseline),'Preview style/a11y changes must not alter any sending code or handler');
console.log('Fullscreen focus/layer priority and four-inset/layout contracts pass. Browser QA covers focus, Escape, nested picker and cached ownership separately. No external calls.');

