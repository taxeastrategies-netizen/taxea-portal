"use client"

import * as React from "react"
import * as SelectPrimitive from "@radix-ui/react-select"
import {Slot} from '@radix-ui/react-slot';
import { Check, ChevronDown, ChevronUp } from "lucide-react"

import { cn } from "@/lib/utils"
import useSafeAreaCollision from '@/hooks/useSafeAreaCollision';
import useMobileViewport from '@/hooks/useMobileViewport';
import {nativeSelectModel,resetUncontrolledSelect,syncNativeSelectDefaults} from '@/lib/nativeSelect.mjs';
import {Drawer} from './drawer';
import MobileSelectPicker from './MobileSelectPicker';
import useCloseOnNavigation from '@/hooks/useCloseOnNavigation';
import NativeSelect from './NativeSelect';

const SelectUiContext=React.createContext(null);
const useControlLayoutEffect=typeof window==='undefined'?React.useEffect:React.useLayoutEffect;
function Select({children,value,defaultValue,onValueChange,...props}){
  const mobile=useMobileViewport();
  const [localValue,setLocalValue]=React.useState(defaultValue??'');
  const [localOpen,setLocalOpen]=React.useState(props.defaultOpen??false),contentId=React.useId(),triggerRef=React.useRef(null);
  const open=props.open===undefined?localOpen:props.open;
  const setOpen=next=>{if(props.open===undefined)setLocalOpen(next);props.onOpenChange?.(next);};
  useCloseOnNavigation(()=>{if(open)setOpen(false);});
  const model=nativeSelectModel(children,{itemType:SelectItem,groupType:SelectGroup,labelType:SelectLabel,valueType:SelectValue,triggerType:SelectTrigger});
  const current=value===undefined?localValue:value;
  const change=next=>{if(value===undefined)setLocalValue(next);onValueChange?.(next);};
  const customTrigger=React.Children.toArray(children).some(child=>child.type===SelectTrigger&&child.props.asChild);
  // Form controls retain native validation/FormData. Their visual picker is
  // adaptive too; ordinary application choices use the direct drawer path.
  const nativeForm=!!(props.name||props.required)&&!customTrigger&&!props.defaultOpen&&props.open===undefined&&props.onOpenChange===undefined;
  const sheet=mobile&&model.options.length>0&&!nativeForm&&!(props.name||props.required),uncontrolled=value===undefined;
  React.useEffect(()=>{
    if(!uncontrolled)return;
    const form=props.form?document.getElementById(props.form):triggerRef.current?.closest('form');
    const reset=()=>{void resetUncontrolledSelect(defaultValue,triggerRef,setLocalValue);};
    form?.addEventListener('reset',reset);return()=>form?.removeEventListener('reset',reset);
  },[uncontrolled,defaultValue,props.form]);
  useControlLayoutEffect(()=>{if(nativeForm)syncNativeSelectDefaults(triggerRef.current,uncontrolled?defaultValue:current,current);},[nativeForm,uncontrolled,defaultValue,current,model.options]);
  const picker={...model,mobile,mode:nativeForm?'native':sheet?'sheet':'desktop',value:current,change,open,setOpen,contentId,triggerRef,disabled:props.disabled,name:props.name,required:props.required,form:props.form,dir:props.dir};
  // The mobile path mounts only its picker, not a hidden desktop popup or its
  // form listeners. Desktop and real native HTML forms retain their own paths.
  return <SelectUiContext.Provider value={picker}>
    {nativeForm?children:sheet?<>{children}<Drawer open={open} onOpenChange={setOpen} shouldScaleBackground={false} repositionInputs handleOnly>{open&&<MobileSelectPicker picker={picker}/>}</Drawer></>:<SelectPrimitive.Root {...props} value={current} onValueChange={change} open={open} onOpenChange={setOpen}>
      {children}
    </SelectPrimitive.Root>}
  </SelectUiContext.Provider>;
}

const SelectGroup = SelectPrimitive.Group

const SelectValue = React.forwardRef(({children,placeholder,...props},ref)=>{
  const picker=React.useContext(SelectUiContext);
  if(picker?.mode!=='desktop'&&picker)return <span {...props} ref={ref}>{children??picker.options.find(option=>option.value===String(picker.value))?.label??placeholder??''}</span>;
  return <SelectPrimitive.Value {...props} placeholder={placeholder} ref={ref}>{children}</SelectPrimitive.Value>;
});
SelectValue.displayName='SelectValue';

const SelectTrigger = React.forwardRef(({ className, children,asChild,...props }, ref) => {
  const picker=React.useContext(SelectUiContext);
  const registeredTrigger=picker?.triggerRef;
  const assignedRef=React.useCallback(node=>{if(registeredTrigger)registeredTrigger.current=node;if(typeof ref==='function')ref(node);else if(ref)ref.current=node;},[registeredTrigger,ref]);
  if(picker?.mode==='native'){
    const groups=[...new Set(picker.options.map(option=>option.group))];
    const option=entry=><option key={entry.value} value={entry.value} disabled={entry.disabled}>{entry.label}</option>;
    return <span className={cn('taxea-native-select relative inline-flex w-full',className)}><NativeSelect {...props} ref={assignedRef} className="w-full min-w-0 min-h-11 appearance-none rounded-md border border-input bg-background px-3 pr-9 text-base text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50" aria-label={props['aria-label']||(!props['aria-labelledby']?picker.placeholder||'Seleccionar opción':undefined)} name={picker.name} required={picker.required} form={picker.form} disabled={picker.disabled||props.disabled} dir={picker.dir} value={picker.value??''} onChange={event=>picker.change(event.target.value)}>
      <option value="" disabled hidden>{picker.placeholder||'Selecciona una opción'}</option>
      {picker.value&&!picker.options.some(entry=>entry.value===String(picker.value))&&<option value={picker.value} disabled>{picker.value} · no disponible</option>}
      {groups.map(group=>group?<optgroup key={group} label={group}>{picker.options.filter(entry=>entry.group===group).map(option)}</optgroup>:picker.options.filter(entry=>!entry.group).map(option))}
    </NativeSelect><ChevronDown aria-hidden="true" className={picker.mobile?'hidden':'pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50'}/></span>;
  }
  if(picker?.mode==='sheet'){
    const Trigger=asChild?Slot:'button';
    return <Trigger {...props} ref={assignedRef} type="button" role="combobox" aria-haspopup="dialog" aria-expanded={picker.open} aria-controls={picker.contentId} aria-label={props['aria-label']||(!props['aria-labelledby']?picker.placeholder||'Seleccionar opción':undefined)} disabled={picker.disabled||props.disabled} onClick={event=>{props.onClick?.(event);if(!event.defaultPrevented)picker.setOpen(true);}} onKeyDown={event=>{props.onKeyDown?.(event);if(!event.defaultPrevented&&['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();picker.setOpen(true);}}} className={cn('flex min-h-11 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-sm text-left shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',className)}>
      {asChild?children:<><span className="truncate">{picker.options.find(option=>option.value===String(picker.value))?.label||(picker.value?`${picker.value} · no disponible`:picker.placeholder||'Seleccionar opción')}</span><ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 opacity-50"/></>}
    </Trigger>;
  }
  return (
  <SelectPrimitive.Trigger
    ref={assignedRef}
    asChild={asChild}
    className={cn(
      "flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background data-[placeholder]:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
      className
    )}
    {...props}>
    {asChild?children:<>{children}<SelectPrimitive.Icon asChild><ChevronDown className="h-4 w-4 opacity-50" /></SelectPrimitive.Icon></>}
  </SelectPrimitive.Trigger>
  );
})
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName

const SelectScrollUpButton = React.forwardRef(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollUpButton
    ref={ref}
    className={cn("flex cursor-default items-center justify-center py-1", className)}
    {...props}>
    <ChevronUp className="h-4 w-4" />
  </SelectPrimitive.ScrollUpButton>
))
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName

const SelectScrollDownButton = React.forwardRef(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollDownButton
    ref={ref}
    className={cn("flex cursor-default items-center justify-center py-1", className)}
    {...props}>
    <ChevronDown className="h-4 w-4" />
  </SelectPrimitive.ScrollDownButton>
))
SelectScrollDownButton.displayName =
  SelectPrimitive.ScrollDownButton.displayName

const SelectContent = React.forwardRef(({ className, children, position = "popper", ...props }, ref) => {
  const safePadding=useSafeAreaCollision();
  const picker=React.useContext(SelectUiContext);
  if(picker?.mode==='native'||picker?.mode==='sheet')return null;
  return (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      collisionPadding={safePadding}
      className={cn(
        "taxea-select-content relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        position === "popper" &&
          "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
        className
      )}
      position={position}
      {...props}>
      <SelectScrollUpButton />
      <SelectPrimitive.Viewport
        className={cn("p-1", position === "popper" &&
          "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]")}>
        {children}
      </SelectPrimitive.Viewport>
      <SelectScrollDownButton />
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
  );
})
SelectContent.displayName = SelectPrimitive.Content.displayName

const SelectLabel = React.forwardRef(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn("px-2 py-1.5 text-sm font-semibold", className)}
    {...props} />
))
SelectLabel.displayName = SelectPrimitive.Label.displayName

const SelectItem = React.forwardRef(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    {...props}>
    <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
))
SelectItem.displayName = SelectPrimitive.Item.displayName

const SelectSeparator = React.forwardRef(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-muted", className)}
    {...props} />
))
SelectSeparator.displayName = SelectPrimitive.Separator.displayName

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
}
