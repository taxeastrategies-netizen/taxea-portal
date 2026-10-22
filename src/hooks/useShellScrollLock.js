import {useEffect} from 'react';

// Only authenticated shell routes use an internal main scroller. Public login,
// invoice and privacy pages regain normal document scrolling on unmount.
export default function useShellScrollLock(){
  useEffect(()=>{
    const nodes=[document.documentElement,document.body];
    nodes.forEach(node=>node.classList.add('taxea-shell-document'));
    return()=>nodes.forEach(node=>node.classList.remove('taxea-shell-document'));
  },[]);
}

