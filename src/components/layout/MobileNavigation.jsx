import {createContext,useContext,useEffect,useLayoutEffect,useRef,useState,useTransition} from 'react';
import {useLocation,useNavigate,useNavigationType,useOutlet,UNSAFE_LocationContext} from 'react-router-dom';
import {MOBILE_TABS,MOBILE_MEDIA,NAVIGATION_COMMITTED_EVENT,mobileTabId,internalHref} from '@/lib/mobileNavigation.mjs';
import {recordNavigation,safeBackTarget} from '@/lib/navigationStack.mjs';

const NavigationContext=createContext(null);
export function useMobileNavigation(){return useContext(NavigationContext);}
export function MobileNavigationProvider({children}) {
  const location=useLocation(),navigate=useNavigate();
  const navigationType=useNavigationType();
  const [mobile,setMobile]=useState(()=>typeof window!=='undefined'&&window.matchMedia(MOBILE_MEDIA).matches);
  const lastRoutes=useRef({});
  const entries=useRef([]);
  const [pending,startTransition]=useTransition();
  useEffect(()=>{
    const media=window.matchMedia(MOBILE_MEDIA);
    const changed=()=>setMobile(media.matches);changed();
    media.addEventListener?.('change',changed);
    return ()=>media.removeEventListener?.('change',changed);
  },[]);
  useLayoutEffect(()=>{const id=mobileTabId(location.pathname);if(id)lastRoutes.current[id]=internalHref(location);},[location]);
  useLayoutEffect(()=>{entries.current=recordNavigation(entries.current,location,window.history.state?.idx,navigationType);window.dispatchEvent(new CustomEvent(NAVIGATION_COMMITTED_EVENT));},[location,navigationType]);
  const currentTab=mobileTabId(location.pathname);
  const selectTab=id=>{
    if(id===currentTab){window.dispatchEvent(new CustomEvent('taxea:tab-reselect',{detail:{id}}));return;}
    const tab=MOBILE_TABS.find(item=>item.id===id);
    if(tab)startTransition(()=>navigate(lastRoutes.current[id]||tab.to));
  };
  const goBack=()=>{
    // Dismiss a modal before leaving its underlying form. Radix owns Escape and
    // focus restoration; never intercept the native iOS edge-back gesture.
    const modal=document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"], [role="listbox"][data-state="open"], [role="menu"][data-state="open"]');
    if(modal){modal.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',code:'Escape',bubbles:true}));return;}
    const target=safeBackTarget(entries.current,location,window.history.state?.idx);
    startTransition(()=>target.delta?navigate(target.delta):navigate(target.to,{replace:true}));
  };
  return <NavigationContext.Provider value={{mobile,currentTab,selectTab,goBack,pending,direction:navigationType==='POP'?'back':'forward'}}>{children}</NavigationContext.Provider>;
}

// Keep only the five explicitly visited quick-access screens in memory. No
// serialisation of forms/invoices to storage, no preloading of unvisited pages.
// AppLayout keys this component by user/company and disables it for impersonation.
export function MobileScreenCache({context,enabled,mainRef}) {
  const outlet=useOutlet(context),location=useLocation();
  const routerLocation=useContext(UNSAFE_LocationContext);
  const cache=useRef(new Map()),positions=useRef(new Map());
  const id=mobileTabId(location.pathname),href=internalHref(location);
  if(enabled&&id)cache.current.set(id,{outlet,location,routerLocation});
  useLayoutEffect(()=>{
    const main=mainRef.current;if(!main)return;
    const save=()=>positions.current.set(href,main.scrollTop);
    main.scrollTop=positions.current.get(href)||0;
    main.addEventListener('scroll',save,{passive:true});
    return ()=>main.removeEventListener('scroll',save);
  },[href,mainRef]);
  useEffect(()=>{if(!enabled)cache.current.clear();},[enabled]);
  useEffect(()=>{
    const reselect=event=>{if(event.detail?.id!==id)return;const main=mainRef.current;if(!main)return;
      positions.current.set(href,0);main.scrollTo({top:0,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
    };
    window.addEventListener('taxea:tab-reselect',reselect);return()=>window.removeEventListener('taxea:tab-reselect',reselect);
  },[id,href,mainRef]);
  if(!enabled)return outlet;
  return <>
    {[...cache.current].map(([key,entry])=><section className="taxea-mobile-screen" key={key} hidden={key!==id} inert={key!==id?'':undefined} aria-hidden={key!==id?true:undefined} data-mobile-screen={key}>
      <UNSAFE_LocationContext.Provider value={{...entry.routerLocation,location:entry.location}}>{key===id?outlet:entry.outlet}</UNSAFE_LocationContext.Provider>
    </section>)}
    {!id&&<section className="taxea-mobile-screen" key={href}>{outlet}</section>}
  </>;
}
