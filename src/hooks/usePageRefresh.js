import {useEffect,useRef} from 'react';
// Legacy useState-based screens join the same read-only refresh contract as
// React Query. No mutation, OCR analysis or save action is replayed.
export default function usePageRefresh(refresh,paths){
  const latest=useRef(refresh);latest.current=refresh;
  const key=paths.join('|');
  useEffect(()=>{
    const accepted=new Set(key.split('|'));
    const listener=event=>{
      if(!accepted.has(event.detail?.pathname))return;
      event.detail.waitUntil(Promise.resolve().then(()=>latest.current()).then(value=>{if(value===false)throw new Error('Partial refresh failed');}));
    };
    window.addEventListener('taxea:refresh',listener);
    return ()=>window.removeEventListener('taxea:refresh',listener);
  },[key]);
}
