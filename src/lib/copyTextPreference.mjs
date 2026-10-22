const KEY='taxea-copy-text';
function read(){try{const value=typeof window!=='undefined'?window.localStorage.getItem(KEY):null;return ['allow','deny'].includes(value)?value:'auto';}catch{return 'auto';}}
let current=read();const listeners=new Set();
const emit=()=>listeners.forEach(listener=>listener());
const sync=event=>{if(event.key===KEY){current=read();emit();}};
export function subscribeCopyText(listener){listeners.add(listener);if(listeners.size===1)window.addEventListener('storage',sync);return()=>{listeners.delete(listener);if(!listeners.size)window.removeEventListener('storage',sync);};}
export const getCopyTextMode=()=>current;
export function setCopyTextMode(mode){
  if(!['auto','allow','deny'].includes(mode))return false;
  current=mode;let saved=true;
  try{if(mode==='auto')window.localStorage.removeItem(KEY);else window.localStorage.setItem(KEY,mode);}catch{saved=false;}
  emit();return saved;
}
export const allowsCopyText=(mode,mobile)=>mode==='allow'||(mode==='auto'&&!mobile);
