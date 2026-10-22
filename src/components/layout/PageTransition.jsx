import {useLayoutEffect,useRef} from 'react';
import {useLocation} from 'react-router-dom';
import {motion,useAnimationControls,useReducedMotion} from 'framer-motion';
import {useMobileNavigation} from './MobileNavigation';

// Animate a stable wrapper, never key/remount the invoice or OCR form. Pending
// navigation is announced by AppLayout; POP gets a reversed, short transition.
export default function PageTransition({children,mainRef}){
  const location=useLocation(),navigation=useMobileNavigation();
  const controls=useAnimationControls(),reduced=useReducedMotion();
  const previous=useRef(location.pathname);
  useLayoutEffect(()=>{
    if(previous.current===location.pathname){if(reduced)controls.set({opacity:1,x:0});return;}
    previous.current=location.pathname;
    mainRef.current?.focus({preventScroll:true});
    if(reduced||!navigation?.mobile){controls.set({opacity:1,x:0});return;}
    controls.set({opacity:.8,x:navigation.direction==='back'?-6:6});
    controls.start({opacity:1,x:0,transition:{duration:.16,ease:'easeOut'}});
    return()=>{controls.stop();controls.set({opacity:1,x:0});};
  },[location.pathname,navigation?.direction,navigation?.mobile,reduced,controls,mainRef]);
  return <motion.div initial={false} animate={controls} className="taxea-page-transition min-w-0">{children}</motion.div>;
}

