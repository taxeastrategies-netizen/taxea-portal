import * as React from 'react';
import {ChevronDown} from 'lucide-react';
import useMobileViewport from '@/hooks/useMobileViewport';
import useCloseOnNavigation from '@/hooks/useCloseOnNavigation';
import {Drawer} from './drawer';
import MobileSelectPicker from './MobileSelectPicker';
import {selectText,syncNativeSelectDefaults} from '@/lib/nativeSelect.mjs';
import {cn} from '@/lib/utils';

const useClientLayoutEffect=typeof window==='undefined'?React.useEffect:React.useLayoutEffect;
export function htmlSelectOptions(children){
  const options=[];
  function walk(node,group='',disabled=false){
    if(Array.isArray(node)){node.forEach(child=>walk(child,group,disabled));return;}
    if(!node?.props)return;
    if(node.type==='option'){
      const label=String(node.props.label??selectText(node.props.children)).replace(/\s+/g,' ').trim();
      options.push({value:String(node.props.value??label),label,group,disabled:disabled||!!node.props.disabled});return;
    }
    if(node.type==='optgroup'){group=node.props.label||'';disabled=disabled||!!node.props.disabled;}
    walk(node.props.children,group,disabled);
  }
  walk(children);return options;
}

// A normal HTML select on desktop; a searchable picker on mobile. The single
// native form control remains responsible for FormData and constraint validity.
// Selection dispatches its real change event, preserving existing event handlers.
const NativeSelect=React.forwardRef(function NativeSelect({children,value,defaultValue,className,style,onChange,onInvalid,onFocus,...props},ref){
  const mobile=useMobileViewport(),options=React.useMemo(()=>htmlSelectOptions(children),[children]);
  const initial=defaultValue??options.find(option=>!option.disabled)?.value??'';
  const [localValue,setLocalValue]=React.useState(String(initial)),[open,setOpen]=React.useState(false),[invalid,setInvalid]=React.useState(false),[fieldLabel,setFieldLabel]=React.useState('');
  const nativeRef=React.useRef(null),triggerRef=React.useRef(null),generatedId=React.useId(),contentId=React.useId(),errorId=React.useId();
  const controlled=value!==undefined,current=String(controlled?(value??''):localValue);
  const adaptive=mobile&&!props.multiple&&!(Number(props.size)>1);
  const selected=options.find(option=>option.value===current);
  const label=props['aria-label']||fieldLabel||props.title||'Seleccionar opción';
  const assignedRef=React.useCallback(node=>{nativeRef.current=node;if(typeof ref==='function')ref(node);else if(ref)ref.current=node;},[ref]);
  useCloseOnNavigation(()=>setOpen(false));
  React.useEffect(()=>{if(!adaptive)setOpen(false);},[adaptive]);
  useClientLayoutEffect(()=>{
    const native=nativeRef.current;if(!native)return;
    syncNativeSelectDefaults(native,controlled?current:initial,current);
    const labels=[...(native.labels||[])].map(element=>{
      const walker=document.createTreeWalker(element,NodeFilter.SHOW_TEXT,{acceptNode:node=>node.parentElement?.closest('select,button')?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT});
      const parts=[];while(walker.nextNode())parts.push(walker.currentNode.textContent);return parts.join(' ');
    }).join(' ').replace(/\s+/g,' ').trim();
    setFieldLabel(previous=>previous===labels?previous:labels);
  },[controlled,current,initial,options,adaptive]);
  React.useEffect(()=>{
    const native=nativeRef.current,form=native?.form;if(!form)return;
    const reset=()=>{void Promise.resolve().then(()=>{
      if(nativeRef.current!==native)return;
      if(!controlled){native.value=String(initial);setLocalValue(String(initial));}
      else native.value=current;
      setInvalid(false);setOpen(false);
    });};
    form.addEventListener('reset',reset);return()=>form.removeEventListener('reset',reset);
  },[controlled,initial,current]);
  const handleChange=event=>{
    if(!controlled)setLocalValue(event.currentTarget.value);
    setInvalid(false);onChange?.(event);
  };
  const choose=next=>{
    const native=nativeRef.current;if(!native||props.disabled)return;
    native.value=next;
    native.dispatchEvent(new Event('change',{bubbles:true}));
    setOpen(false);
  };
  const nativeProps={...props,ref:assignedRef,value:current,onChange:handleChange,onInvalid:event=>{
    onInvalid?.(event);if(adaptive){event.preventDefault();setInvalid(true);triggerRef.current?.focus({preventScroll:true});}
  },onFocus:event=>{onFocus?.(event);if(adaptive)triggerRef.current?.focus({preventScroll:true});}};
  const nativeChildren=<>{current&&!selected&&<option value={current} disabled>{current} · no disponible</option>}{children}</>;
  if(!adaptive)return <select {...nativeProps} className={className} style={style}>{nativeChildren}</select>;
  const picker={options,placeholder:label,value:current,change:choose,open,setOpen,contentId,triggerRef};
  return <span className={cn('taxea-legacy-select relative inline-flex max-w-full min-h-11',className)} style={style}>
    <select {...nativeProps} className="taxea-form-select-proxy" aria-hidden="true" tabIndex={-1}>{nativeChildren}</select>
    <button type="button" id={props.id?props.id+'-picker':generatedId} ref={triggerRef} role="combobox" aria-label={label} aria-labelledby={props['aria-labelledby']} aria-describedby={[props['aria-describedby'],invalid?errorId:''].filter(Boolean).join(' ')||undefined} aria-required={props.required||undefined} aria-invalid={invalid||undefined} aria-haspopup="dialog" aria-expanded={open} aria-controls={contentId} disabled={props.disabled} className="flex w-full min-h-11 min-w-0 items-center justify-between gap-2 rounded-[inherit] bg-transparent px-3 text-left text-inherit focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50" onClick={()=>setOpen(true)} onKeyDown={event=>{if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();setOpen(true);}}}>
      <span className="truncate">{selected?.label||(current?`${current} · no disponible`:'Seleccionar…')}</span><ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 opacity-60"/>
    </button>
    {invalid&&<span id={errorId} role="alert" className="sr-only">Selecciona una opción válida para {label}.</span>}
    <Drawer open={open} onOpenChange={setOpen} shouldScaleBackground={false} repositionInputs handleOnly>{open&&<MobileSelectPicker picker={picker}/>}</Drawer>
  </span>;
});
export default NativeSelect;
