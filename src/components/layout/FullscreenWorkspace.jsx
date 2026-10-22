import {useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {cn} from '@/lib/utils';
import {focusableWorkspaceControls} from '@/lib/fullscreenNavigation.mjs';
import {NAVIGATION_COMMITTED_EVENT} from '@/lib/mobileNavigation.mjs';
import useMobileViewport from '@/hooks/useMobileViewport';
import useCopyTextPreference from '@/hooks/useCopyTextPreference';
import useAppGestures from '@/hooks/useAppGestures';
import {allowsCopyText} from '@/lib/copyTextPreference.mjs';

// A full-screen workspace must escape the animated page's containing/stacking
// context. Its four safe insets are owned once, independently from AppLayout.
export default function FullscreenWorkspace({children,onBack,busy=false,className,...props}){
  const rootRef=useRef(null),anchorRef=useRef(null);
  const mobile=useMobileViewport(),copyMode=useCopyTextPreference();
  useAppGestures(rootRef,mobile);
  const [inactive,setInactive]=useState(false);
  useLayoutEffect(()=>{
    const previous=document.activeElement;
    const update=()=>setInactive(!!anchorRef.current?.parentElement?.closest('[hidden],[inert]'));
    update();window.addEventListener(NAVIGATION_COMMITTED_EVENT,update);
    return()=>{window.removeEventListener(NAVIGATION_COMMITTED_EVENT,update);if(previous?.isConnected&&!previous.closest('[hidden],[inert]'))previous.focus?.({preventScroll:true});};
  },[]);
  useLayoutEffect(()=>{
    if(inactive||anchorRef.current?.parentElement?.closest('[hidden],[inert]'))return;
    const root=rootRef.current;(focusableWorkspaceControls(root)[0]||root).focus({preventScroll:true});
  },[inactive]);
  const onKeyDown=event=>{
    const root=rootRef.current;
    // Nested Radix/Vaul portals own Escape and Tab themselves. Never intercept
    // keys from their React event bubbling outside this root's actual DOM.
    if(event.defaultPrevented||!root.contains(event.target))return;
    const nested=event.target.closest('[role="dialog"],[role="alertdialog"],[role="listbox"],[role="menu"]');
    if(nested&&nested!==root)return;
    if(event.key==='Escape'){
      event.preventDefault();event.stopPropagation();if(!busy)onBack?.();return;
    }
    if(event.key!=='Tab')return;
    const controls=focusableWorkspaceControls(root),first=controls[0],last=controls.at(-1);
    if(!first){event.preventDefault();root.focus({preventScroll:true});return;}
    if(event.shiftKey&&(document.activeElement===first||document.activeElement===root)){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  };
  // Above the isolated app shell, below its normal z-50 Radix/Vaul portals.
  // A cached screen can become hidden without unmounting: hide this portal too,
  // retaining its form state rather than leaking it over another tab.
  return <><span ref={anchorRef} aria-hidden="true" style={{display:'none'}}/>{createPortal(<div {...props} ref={rootRef} role="dialog" aria-modal="true" data-copy-text={allowsCopyText(copyMode,mobile)?'true':'false'} data-state={inactive?'closed':'open'} hidden={inactive} inert={inactive?'':undefined} aria-hidden={inactive?true:undefined} tabIndex={-1} onKeyDown={onKeyDown} className={cn('taxea-fullscreen-surface fixed inset-0 z-[45] flex flex-col bg-background text-foreground outline-none select-none',className)}>{children}</div>,document.body)}</>;
}

