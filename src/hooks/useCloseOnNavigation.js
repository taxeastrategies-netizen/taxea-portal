import {useEffect,useLayoutEffect,useRef} from 'react';
import {NAVIGATION_COMMITTED_EVENT} from '@/lib/mobileNavigation.mjs';
const useCommittedEffect=typeof window==='undefined'?useEffect:useLayoutEffect;

// Ephemeral pickers/menus, not invoice forms: a hidden cached screen must not
// leave a portal trapping focus over the route selected by system Back.
export default function useCloseOnNavigation(close){
  const handler=useRef(close);
  useCommittedEffect(()=>{handler.current=close;},[close]);
  useEffect(()=>{
    const listener=()=>handler.current();
    window.addEventListener(NAVIGATION_COMMITTED_EVENT,listener);
    return()=>window.removeEventListener(NAVIGATION_COMMITTED_EVENT,listener);
  },[]);
}

