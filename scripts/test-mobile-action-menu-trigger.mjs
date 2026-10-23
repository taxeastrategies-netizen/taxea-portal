import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import * as esbuild from 'esbuild';
import * as React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

// Real wrapper/context/handlers and React renderer. The primitive is an inert
// capture point so we can prove which event is allowed to open the sheet.
let captured,changes=[],mobile=true;
const nativeRequire=createRequire(import.meta.url);
const primitive={Root:({children})=>children,Trigger:React.forwardRef((props,ref)=>{captured=props;return React.createElement('button',{ref,type:'button'},props.children);})};
const built=await esbuild.build({entryPoints:['src/components/ui/dropdown-menu.jsx'],bundle:true,write:false,platform:'node',format:'cjs',jsx:'automatic',alias:{'@':process.cwd()+'/src'},external:['react','react-dom','react/jsx-runtime'],plugins:[{name:'event-contract',setup(build){
  build.onResolve({filter:/^@radix-ui\/react-dropdown-menu$/},()=>({path:'radix',namespace:'qa'}));
  build.onResolve({filter:/useMobileViewport$/},()=>({path:'mobile',namespace:'qa'}));
  build.onLoad({filter:/.*/,namespace:'qa'},args=>({contents:args.path==='radix'?'export const {Root,Trigger,Group,Portal,Sub,RadioGroup,SubTrigger,SubContent,Content,Item,CheckboxItem,RadioItem,Label,Separator}=globalThis.__primitive;':'export default ()=>globalThis.__mobile();',loader:'js'}));
}}]});
const exported={},context={exports:exported,module:{exports:exported},require:nativeRequire,__primitive:primitive,__mobile:()=>mobile};
vm.runInNewContext(built.outputFiles[0].text,context);
const ui=context.module.exports;
const render=(triggerProps={})=>{renderToStaticMarkup(React.createElement(ui.DropdownMenu,{open:false,onOpenChange:value=>changes.push(value)},React.createElement(ui.DropdownMenuTrigger,triggerProps,'Open QA menu')));return captured;};
const event=(extra={})=>({button:0,ctrlKey:false,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;},...extra});
let handler=render(),down=event();handler.onPointerDown(down);
assert.equal(down.defaultPrevented,true,'Radix pointerdown opener is suppressed on mobile');assert.deepEqual(changes,[],'No menu can appear under a still-pressed pointer');
handler.onClick(event());assert.deepEqual(changes,[true],'One released click opens the sheet exactly once');
changes=[];handler=render();const right=event({button:2});handler.onPointerDown(right);handler.onClick(right);assert.equal(right.defaultPrevented,false);assert.deepEqual(changes,[]);
handler=render({disabled:true});handler.onClick(event());assert.deepEqual(changes,[],'Disabled triggers cannot open');
handler=render({onClick:e=>e.preventDefault()});handler.onClick(event());assert.deepEqual(changes,[],'Caller cancellation survives');
handler=render({onPointerDown:e=>e.preventDefault()});handler.onPointerDown(event());handler.onClick(event());assert.deepEqual(changes,[],'Caller pointerdown cancellation survives');
handler=render();handler.onClick(event());assert.deepEqual(changes,[true],'Accessibility click opens without a synthetic pointerdown');
mobile=false;changes=[];handler=render();down=event();handler.onPointerDown(down);handler.onClick(event());assert.equal(down.defaultPrevented,false);assert.deepEqual(changes,[],'Desktop opening stays owned by the actual Radix primitive');
let keys=0;handler=render({onKeyDown:()=>{keys++;}});const key=event({key:'Enter'});handler.onKeyDown(key);assert.equal(keys,1);assert.equal(key.defaultPrevented,false,'Radix keeps keyboard event ownership');
console.log(JSON.stringify({ok:true,realReactContext:true,mobileOpensOnRelease:true,noPointerdownActivation:true,accessibleClick:true,callerCancellation:true,desktopAndKeyboardPreserved:true,externalCalls:0}));

