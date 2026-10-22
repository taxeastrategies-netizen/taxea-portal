"use client"

import * as React from "react"
import * as SelectPrimitive from "@radix-ui/react-select"
import { Check, ChevronDown, ChevronUp } from "lucide-react"

import { cn } from "@/lib/utils"
import useSafeAreaCollision from '@/hooks/useSafeAreaCollision';
import useMobileViewport from '@/hooks/useMobileViewport';
import {nativeSelectModel} from '@/lib/nativeSelect.mjs';

const NativeSelectContext=React.createContext(null);
function Select({children,value,defaultValue,onValueChange,...props}){
  const mobile=useMobileViewport();
  const [localValue,setLocalValue]=React.useState(defaultValue??'');
  const model=nativeSelectModel(children,{itemType:SelectItem,groupType:SelectGroup,labelType:SelectLabel,valueType:SelectValue});
  // Explicitly controlled popup APIs keep Radix; ordinary choices use the OS
  // picker on phones. No duplicated hidden inputs or parallel form submission.
  const customTrigger=React.Children.toArray(children).some(child=>child.type===SelectTrigger&&child.props.asChild);
  const native=mobile&&model.options.length>0&&!customTrigger&&!props.defaultOpen&&props.open===undefined&&props.onOpenChange===undefined;
  const current=value===undefined?localValue:value;
  const change=next=>{if(value===undefined)setLocalValue(next);onValueChange?.(next);};
  return <NativeSelectContext.Provider value={native?{...model,value:current,change,disabled:props.disabled,name:props.name,required:props.required,dir:props.dir}:null}>
    {native?children:<SelectPrimitive.Root {...props} value={current} onValueChange={change}>{children}</SelectPrimitive.Root>}
  </NativeSelectContext.Provider>;
}

const SelectGroup = SelectPrimitive.Group

const SelectValue = SelectPrimitive.Value

const SelectTrigger = React.forwardRef(({ className, children, ...props }, ref) => {
  const native=React.useContext(NativeSelectContext);
  if(native){
    const groups=[...new Set(native.options.map(option=>option.group))];
    const option=entry=><option key={entry.value} value={entry.value} disabled={entry.disabled}>{entry.label}</option>;
    return <span className={cn('taxea-native-select relative inline-flex w-full',className)}>
      <select {...props} ref={ref} className="w-full min-w-0 min-h-11 appearance-none rounded-md border border-input bg-background px-3 pr-9 text-base text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        aria-label={props['aria-label']||(!props['aria-labelledby']?native.placeholder||'Seleccionar opción':undefined)}
        name={native.name} required={native.required} disabled={native.disabled||props.disabled} dir={native.dir} value={native.value??''} onChange={event=>native.change(event.target.value)}>
        <option value="" disabled hidden>{native.placeholder||'Selecciona una opción'}</option>
        {native.value&&!native.options.some(entry=>entry.value===String(native.value))&&<option value={native.value} disabled>{native.value} · no disponible</option>}
        {groups.map(group=>group?<optgroup key={group} label={group}>{native.options.filter(entry=>entry.group===group).map(option)}</optgroup>:native.options.filter(entry=>!entry.group).map(option))}
      </select>
      <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50"/>
    </span>;
  }
  return (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      "flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background data-[placeholder]:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
      className
    )}
    {...props}>
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 opacity-50" />
    </SelectPrimitive.Icon>
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
  const native=React.useContext(NativeSelectContext);
  if(native)return null;
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
