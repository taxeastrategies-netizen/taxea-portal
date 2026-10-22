import {useEffect,useState} from 'react';
import {collisionInsets} from '@/lib/safeArea.mjs';
function read(){
  if(typeof window==='undefined')return collisionInsets();
  const style=getComputedStyle(document.documentElement);
  return collisionInsets(Object.fromEntries(['top','right','bottom','left'].map(side=>[side,style.getPropertyValue(`--taxea-safe-${side}`)])));
}
export default function useSafeAreaCollision(){
  const [padding,setPadding]=useState(read);
  useEffect(()=>{
    const update=()=>setPadding(old=>{const next=read();return Object.keys(next).every(key=>old[key]===next[key])?old:next;});
    update();window.addEventListener('resize',update);window.addEventListener('orientationchange',update);window.visualViewport?.addEventListener('resize',update);
    return ()=>{window.removeEventListener('resize',update);window.removeEventListener('orientationchange',update);window.visualViewport?.removeEventListener('resize',update);};
  },[]);
  return padding;
}

