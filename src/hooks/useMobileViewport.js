import {useEffect,useState} from 'react';
import {MOBILE_MEDIA} from '@/lib/mobileNavigation.mjs';

export default function useMobileViewport(){
  const [mobile,setMobile]=useState(()=>typeof window!=='undefined'&&window.matchMedia(MOBILE_MEDIA).matches);
  useEffect(()=>{
    const query=window.matchMedia(MOBILE_MEDIA),update=()=>setMobile(query.matches);
    update();query.addEventListener('change',update);
    return()=>query.removeEventListener('change',update);
  },[]);
  return mobile;
}
