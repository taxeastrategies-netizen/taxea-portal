import {createContext,useContext,useEffect,useLayoutEffect,useRef,useState} from 'react';
import {useLocation,useNavigate,useOutlet,UNSAFE_LocationContext} from 'react-router-dom';
import {MOBILE_TABS,mobileTabId,internalHref,parentRoute} from '@/lib/mobileNavigation.mjs';

const NavigationContext=createContext(null);
export function useMobileNavigation(){return useContext(NavigationContext);}
export function MobileNavigationProvider({children}) {
  const location=useLocation(),navigate=useNavigate();
  const [mobile,setMobile]=useState(()=>typeof window!=='undefined'&&window.matchMedia('(max-width: 767px)').matches);
  const lastRoutes=useRef({});
  useEffect(()=>{
    const media=window.matchMedia('(max-width: 767px)');
    const changed=()=>setMobile(media.matches);changed();
    media.addEventListener?.('change',changed);
    return ()=>media.removeEventListener?.('change',changed);
  },[]);
  useLayoutEffect(()=>{const id=mobileTabId(location.pathname);if(id)lastRoutes.current[id]=internalHref(location);},[location]);
  const currentTab=mobileTabId(location.pathname);
  const selectTab=id=>{
    if(id===currentTab)return;
    const tab=MOBILE_TABS.find(item=>item.id===id);
    if(tab)navigate(lastRoutes.current[id]||tab.to);
  };
  const goBack=()=>{
    // React Router's index counts same-document entries, not external history.
    if(Number(window.history.state?.idx)>0)navigate(-1);
    else navigate(parentRoute(location.pathname),{replace:true});
  };
  return <NavigationContext.Provider value={{mobile,currentTab,selectTab,goBack}}>{children}</NavigationContext.Provider>;
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
  if(!enabled)return outlet;
  return <>
    {[...cache.current].map(([key,entry])=><section key={key} hidden={key!==id} inert={key!==id?'':undefined} aria-hidden={key!==id?true:undefined} data-mobile-screen={key}>
      <UNSAFE_LocationContext.Provider value={{...entry.routerLocation,location:entry.location}}>{key===id?outlet:entry.outlet}</UNSAFE_LocationContext.Provider>
    </section>)}
    {!id&&<section key={href}>{outlet}</section>}
  </>;
}
