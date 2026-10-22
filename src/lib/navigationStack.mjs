import {internalHref,parentRoute} from './mobileNavigation.mjs';

// Memory-only ledger of entries observed during this authenticated scope. An
// arbitrary history.idx or an external referrer is not proof of a safe back target.
export function recordNavigation(entries,location,index,type){
  const entry={key:location.key,href:internalHref(location),index:Number.isInteger(index)?index:null};
  if(!entry.key)return [entry];
  const known=entries.findIndex(row=>row.key===entry.key);
  if(type==='POP')return known>=0?entries.slice(0,known+1):[entry];
  if(entries.at(-1)?.key===entry.key)return entries;
  if(type==='REPLACE')return [...entries.slice(0,-1),entry];
  return [...entries,entry].slice(-100);
}
export function safeBackTarget(entries,location,index){
  const last=entries.at(-1),previous=entries.at(-2);
  if(previous&&last?.key===location.key&&last.index===index&&previous.index===index-1)return {delta:-1};
  return {to:parentRoute(location.pathname),replace:true};
}
export function referenceDestination(value,origin){
  if(typeof value!=='string')return null;
  const path=value.trim();
  if(path.startsWith('/')&&!path.startsWith('//')&&!/[\\\u0000-\u001f]/.test(path))return {internal:true,to:path};
  try{const url=new URL(path);if(url.protocol==='https:')return url.origin===origin?{internal:true,to:url.pathname+url.search+url.hash}:{internal:false,to:url.href};}catch{/* Unsupported reference stays plain text. */}
  return null;
}

