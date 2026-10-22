import {useCallback,useEffect,useRef,useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {pullGesture} from '@/lib/mobileNavigation.mjs';

const NO_PULL='input,textarea,select,button,a,canvas,video,[role="dialog"],[role="slider"],[role="combobox"],[contenteditable="true"],[data-no-pull-refresh]';
function nestedScroller(target,root){
  for(let node=target;node&&node!==root;node=node.parentElement){
    if(node.scrollHeight>node.clientHeight+2&&node.scrollTop>0)return true;
  }
  return false;
}
export default function usePullToRefresh(mainRef,pathname,enabled){
  const queryClient=useQueryClient(),flight=useRef(false),gesture=useRef(null);
  const [distance,setDistance]=useState(0),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const refresh=useCallback(async()=>{
    if(flight.current)return;
    // Refetch data only: never reload/remount a form or repeat mutation requests.
    if(navigator.onLine===false){setMessage('Sin conexión. Se conserva la información disponible.');return;}
    flight.current=true;setBusy(true);setMessage('Actualizando…');setDistance(0);
    let timeout;
    try {
      const pending=[queryClient.invalidateQueries({refetchType:'active'},{throwOnError:true})];
      window.dispatchEvent(new CustomEvent('taxea:refresh',{detail:{pathname,waitUntil:promise=>pending.push(Promise.resolve(promise))}}));
      await Promise.race([Promise.all(pending),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error('timeout')),15000);})]);
      setMessage('Datos actualizados');
    } catch {setMessage('No se pudo actualizar todo. Se conserva la última información; puedes reintentar.');}
    finally{clearTimeout(timeout);flight.current=false;setBusy(false);}
  },[queryClient,pathname]);
  useEffect(()=>{
    const root=mainRef.current;if(!root||!enabled)return;
    const start=event=>{
      gesture.current=null;
      if(flight.current||event.touches.length!==1||root.scrollTop>0||event.target.closest?.(NO_PULL)||document.querySelector('[role="dialog"][data-state="open"]'))return;
      gesture.current={x:event.touches[0].clientX,y:event.touches[0].clientY,target:event.target};
    };
    const move=event=>{
      if(!gesture.current)return;
      const touch=event.touches[0];if(!touch)return;
      const result=pullGesture(gesture.current,touch.clientX,touch.clientY,{touches:event.touches.length,nestedScroll:root.scrollTop>0||nestedScroller(gesture.current.target,root)});
      if(result.cancelled){gesture.current=null;setDistance(0);return;}
      gesture.current.armed=result.armed;setDistance(result.distance);
      if(result.distance>8&&event.cancelable)event.preventDefault();
    };
    const end=()=>{const armed=gesture.current?.armed;gesture.current=null;setDistance(0);if(armed)void refresh();};
    const cancel=()=>{gesture.current=null;setDistance(0);};
    root.addEventListener('touchstart',start,{passive:true});root.addEventListener('touchmove',move,{passive:false});
    root.addEventListener('touchend',end,{passive:true});root.addEventListener('touchcancel',cancel,{passive:true});
    return ()=>{root.removeEventListener('touchstart',start);root.removeEventListener('touchmove',move);root.removeEventListener('touchend',end);root.removeEventListener('touchcancel',cancel);};
  },[enabled,mainRef,refresh]);
  return {refresh,busy,distance,message};
}

