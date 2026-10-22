import {useEffect} from 'react';
import {suppressChromeGesture} from '@/lib/appGestures.mjs';

export default function useAppGestures(ref,mobile){
  useEffect(()=>{
    const shell=ref.current;if(!shell||!mobile)return;
    const handle=event=>{if(suppressChromeGesture(event.target))event.preventDefault();};
    for(const name of ['contextmenu','selectstart','dragstart'])shell.addEventListener(name,handle);
    return()=>{for(const name of ['contextmenu','selectstart','dragstart'])shell.removeEventListener(name,handle);};
  },[ref,mobile]);
}

