// Render-contract test with hook/router doubles; real DOM navigation is checked
// separately in the browser. No provider connections or app data are involved.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import * as esbuild from 'esbuild';
let refs=[],cursor=0,location,outlet,effects=[],scrollListener;
const mocked={
  createContext:()=>({Provider:'provider'}),
  createElement:(type,props,...children)=>({type,key:props?.key,props:{...props,children:children.length===1?children[0]:children}}),
  Fragment:'fragment',useContext:()=>({location,navigationType:'PUSH'}),
  useRef:value=>{const index=cursor++;return refs[index]||= {current:value};},
  useEffect:fn=>effects.push(fn),useLayoutEffect:fn=>effects.push(fn),
  useState:value=>[typeof value==='function'?value():value,()=>{}],useTransition:()=>[false,fn=>fn()],
  useLocation:()=>location,useOutlet:()=>outlet,useNavigate:()=>()=>{},UNSAFE_LocationContext:{Provider:'location-provider'},
};
const result=await esbuild.build({entryPoints:['src/components/layout/MobileNavigation.jsx'],bundle:true,write:false,platform:'node',format:'cjs',jsx:'transform',jsxFactory:'React.createElement',jsxFragment:'React.Fragment',inject:[],plugins:[{name:'hooks',setup(b){
  b.onResolve({filter:/^(react|react\/jsx-runtime|react-router-dom)$/},args=>({path:args.path,namespace:'mock'}));
  b.onLoad({filter:/.*/,namespace:'mock'},args=>({loader:'js',contents:args.path==='react/jsx-runtime'?'export const Fragment="fragment";export const jsx=(type,props,key)=>({type,key,props});export const jsxs=jsx;':'const r=globalThis.__mock;export const {createContext,useContext,useEffect,useLayoutEffect,useRef,useState,useTransition,useLocation,useNavigate,useOutlet,UNSAFE_LocationContext}=r;'}));
  b.onResolve({filter:/^@\/lib\/mobileNavigation.mjs$/},()=>({path:process.cwd()+'/src/lib/mobileNavigation.mjs'}));
}}]});
const listeners=new Map();
const window={addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name),matchMedia:()=>({matches:false})};
const exported={},context=vm.createContext({__mock:mocked,React:mocked,exports:exported,module:{exports:exported},Map,window});
vm.runInContext(result.outputFiles[0].text,context);
const Cache=context.module.exports.MobileScreenCache;
const main={scrollTop:0,scrollTo:({top})=>{main.scrollTop=top;scrollListener?.();},addEventListener:(_name,fn)=>{scrollListener=fn;},removeEventListener:()=>{}};
function render(path,screen,enabled=true){cursor=0;effects=[];location={pathname:path,search:'',hash:''};outlet=screen;const view=Cache({context:{user:'fictitious'},enabled,mainRef:{current:main}});effects.forEach(fn=>fn());return view;}
const sections=view=>view.props.children[0];
const home={id:'home-form'},invoice={id:'invoice-filter'},settings={id:'settings-form'};
let view=render('/',home);assert.equal(sections(view).length,1);
main.scrollTop=270;scrollListener();
view=render('/facturas',invoice);assert.equal(sections(view).length,2);assert.equal(main.scrollTop,0);
assert.equal(sections(view)[0].props.hidden,true);assert.equal(sections(view)[0].props.children.props.children,home);
view=render('/ajustes',settings);assert.equal(sections(view).length,3);
view=render('/',home);assert.equal(main.scrollTop,270,'Restores main scroll for the tab URL');
assert.equal(sections(view)[0].props.hidden,false);assert.equal(sections(view)[1].props.hidden,true);
listeners.get('taxea:tab-reselect')({detail:{id:'invoices'}});assert.equal(main.scrollTop,270,'Wrong tab event cannot reset active scroll');
listeners.get('taxea:tab-reselect')({detail:{id:'home'}});assert.equal(main.scrollTop,0,'Active tab reselection scrolls to top without remount');
view=render('/finance/tesoreria',{id:'transient'});assert.equal(sections(view).length,3,'Transient departments do not grow the cache');
assert.equal(view.props.children[1].props.children.id,'transient');
const desktop=render('/facturas',invoice,false);assert.equal(desktop,invoice);
view=render('/ajustes',settings);assert.equal(sections(view).length,1,'Desktop transition clears the mobile cache');
refs=[];view=render('/',{id:'other-scope'});assert.equal(sections(view).length,1,'New keyed scope has no previous screens');
console.log('Mobile cache render contract: hidden mounted screens, frozen route locations, bounded cache, scroll restore, desktop and identity remount pass (hook doubles; browser QA separate).');
