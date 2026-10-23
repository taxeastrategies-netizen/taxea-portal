import * as React from "react"
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu"
import { Check, ChevronRight, Circle } from "lucide-react"

import { cn } from "@/lib/utils"
import useSafeAreaCollision from '@/hooks/useSafeAreaCollision';
import useCloseOnNavigation from '@/hooks/useCloseOnNavigation';
import useMobileViewport from '@/hooks/useMobileViewport';

const ActionMenuContext = React.createContext(null);

function DropdownMenu({open,defaultOpen=false,onOpenChange,...props}){
  const mobile=useMobileViewport();
  const [localOpen,setLocalOpen]=React.useState(defaultOpen);
  const change=next=>{if(open===undefined)setLocalOpen(next);onOpenChange?.(next);};
  useCloseOnNavigation(()=>{if(open===undefined?localOpen:open)change(false);});
  const effectiveOpen=open===undefined?localOpen:open;
  return <ActionMenuContext.Provider value={{mobile,open:effectiveOpen,change}}><DropdownMenuPrimitive.Root {...props} open={effectiveOpen} onOpenChange={change}/></ActionMenuContext.Provider>;
}

// The mobile menu is repositioned as a bottom action sheet. Opening on
// pointerdown can put an item under the still-pressed pointer and select it on
// release. Wait for click/release; keyboard handling stays with Radix.
const DropdownMenuTrigger = React.forwardRef(({onPointerDown,onClick,onKeyDown,...props},ref)=>{
  const menu=React.useContext(ActionMenuContext),blockedClick=React.useRef(false);
  return <DropdownMenuPrimitive.Trigger {...props} ref={ref}
    onPointerDown={event=>{
      onPointerDown?.(event);blockedClick.current=event.defaultPrevented;
      if(menu?.mobile&&!event.defaultPrevented&&event.button===0&&!event.ctrlKey)event.preventDefault();
    }}
    onClick={event=>{
      onClick?.(event);const blocked=blockedClick.current;blockedClick.current=false;
      if(menu?.mobile&&!blocked&&!props.disabled&&!event.defaultPrevented&&event.button===0&&!event.ctrlKey)menu.change(!menu.open);
    }}
    onKeyDown={event=>{blockedClick.current=false;onKeyDown?.(event);}}
  />;
});
DropdownMenuTrigger.displayName=DropdownMenuPrimitive.Trigger.displayName;

const DropdownMenuGroup = DropdownMenuPrimitive.Group

const DropdownMenuPortal = DropdownMenuPrimitive.Portal

const DropdownMenuSub = DropdownMenuPrimitive.Sub

const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup

const DropdownMenuSubTrigger = React.forwardRef(({ className, inset, children, ...props }, ref) => (
  <DropdownMenuPrimitive.SubTrigger
    ref={ref}
    className={cn(
      "flex cursor-default gap-2 select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent data-[state=open]:bg-accent [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
      inset && "pl-8",
      className
    )}
    {...props}>
    {children}
    <ChevronRight className="ml-auto" />
  </DropdownMenuPrimitive.SubTrigger>
))
DropdownMenuSubTrigger.displayName =
  DropdownMenuPrimitive.SubTrigger.displayName

const DropdownMenuSubContent = React.forwardRef(({ className, ...props }, ref) => {
  const safePadding=useSafeAreaCollision();return (
  <DropdownMenuPrimitive.SubContent
    ref={ref}
    collisionPadding={safePadding}
    className={cn(
      "taxea-dropdown-content z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
      className
    )}
    {...props} />
  );
})
DropdownMenuSubContent.displayName =
  DropdownMenuPrimitive.SubContent.displayName

const DropdownMenuContent = React.forwardRef(({ className, sideOffset = 4, children,...props }, ref) => {
  const safePadding=useSafeAreaCollision(),mobile=useMobileViewport();return (
  <>
    {mobile&&<DropdownMenuPrimitive.Portal><div aria-hidden="true" className="taxea-action-menu-backdrop fixed inset-0 z-50 bg-black/40" style={{pointerEvents:'auto'}}/></DropdownMenuPrimitive.Portal>}
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      collisionPadding={safePadding}
      sideOffset={sideOffset}
      className={cn(
        "taxea-dropdown-content taxea-action-menu z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md",
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className
      )}
      {...props}>
      {children}
      {mobile&&<><DropdownMenuPrimitive.Separator className="my-2 h-px bg-border"/><DropdownMenuPrimitive.Item className="flex min-h-11 cursor-default select-none items-center justify-center rounded-xl px-3 text-sm font-semibold outline-none focus:bg-accent">Cancelar</DropdownMenuPrimitive.Item></>}
    </DropdownMenuPrimitive.Content>
  </DropdownMenuPrimitive.Portal>
  </>
  );
})
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName

const DropdownMenuItem = React.forwardRef(({ className, inset, ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&>svg]:size-4 [&>svg]:shrink-0",
      inset && "pl-8",
      className
    )}
    {...props} />
))
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName

const DropdownMenuCheckboxItem = React.forwardRef(({ className, children, checked, ...props }, ref) => (
  <DropdownMenuPrimitive.CheckboxItem
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    checked={checked}
    {...props}>
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.CheckboxItem>
))
DropdownMenuCheckboxItem.displayName =
  DropdownMenuPrimitive.CheckboxItem.displayName

const DropdownMenuRadioItem = React.forwardRef(({ className, children, ...props }, ref) => (
  <DropdownMenuPrimitive.RadioItem
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    {...props}>
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <Circle className="h-2 w-2 fill-current" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.RadioItem>
))
DropdownMenuRadioItem.displayName = DropdownMenuPrimitive.RadioItem.displayName

const DropdownMenuLabel = React.forwardRef(({ className, inset, ...props }, ref) => (
  <DropdownMenuPrimitive.Label
    ref={ref}
    className={cn("px-2 py-1.5 text-sm font-semibold", inset && "pl-8", className)}
    {...props} />
))
DropdownMenuLabel.displayName = DropdownMenuPrimitive.Label.displayName

const DropdownMenuSeparator = React.forwardRef(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-muted", className)}
    {...props} />
))
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName

const DropdownMenuShortcut = ({
  className,
  ...props
}) => {
  return (
    (<span
      className={cn("ml-auto text-xs tracking-widest opacity-60", className)}
      {...props} />)
  );
}
DropdownMenuShortcut.displayName = "DropdownMenuShortcut"

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
}

