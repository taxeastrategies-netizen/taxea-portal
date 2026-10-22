import * as React from 'react';
import * as ToastPrimitive from '@radix-ui/react-toast';
import {cva} from 'class-variance-authority';
import {X} from 'lucide-react';
import {cn} from '@/lib/utils';

// A context provider must not be a fixed transparent hit-test layer. Only the
// single viewport is positioned; empty space passes taps through to the app.
const ToastProvider=({children,...props})=><ToastPrimitive.Provider label="Notificación" swipeDirection="right" {...props}>{children}</ToastPrimitive.Provider>;
const ToastViewport=React.forwardRef(({className,...props},ref)=><ToastPrimitive.Viewport ref={ref} label="Avisos ({hotkey})" className={cn('taxea-toast-viewport pointer-events-none fixed z-[100] flex w-full max-w-[420px] flex-col gap-2 p-3 list-none outline-none',className)} {...props}/>);
ToastViewport.displayName='ToastViewport';

const toastVariants=cva('group pointer-events-auto relative flex w-full items-center justify-between gap-3 overflow-hidden rounded-xl border p-4 pr-14 shadow-lg transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-2',{
  variants:{variant:{default:'border-border bg-card text-card-foreground',destructive:'destructive border-destructive bg-destructive text-destructive-foreground'}},defaultVariants:{variant:'default'},
});
const Toast=React.forwardRef(({className,variant,...props},ref)=><ToastPrimitive.Root ref={ref} className={cn(toastVariants({variant}),className)} {...props}/>);
Toast.displayName='Toast';
const ToastAction=React.forwardRef(({className,altText='Abrir la acción de este aviso',...props},ref)=><ToastPrimitive.Action ref={ref} altText={altText} className={cn('inline-flex min-h-11 items-center justify-center rounded-md border px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50',className)} {...props}/>);
ToastAction.displayName='ToastAction';
const ToastClose=React.forwardRef(({className,...props},ref)=><ToastPrimitive.Close ref={ref} aria-label="Cerrar notificación" className={cn('absolute right-1 top-1 flex min-h-11 min-w-11 items-center justify-center rounded-lg text-current opacity-75 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',className)} {...props}><X aria-hidden="true" className="h-4 w-4"/></ToastPrimitive.Close>);
ToastClose.displayName='ToastClose';
const ToastTitle=React.forwardRef(({className,...props},ref)=><ToastPrimitive.Title ref={ref} className={cn('text-sm font-semibold',className)} {...props}/>);
ToastTitle.displayName='ToastTitle';
const ToastDescription=React.forwardRef(({className,...props},ref)=><ToastPrimitive.Description ref={ref} className={cn('text-sm opacity-90',className)} {...props}/>);
ToastDescription.displayName='ToastDescription';
export {ToastProvider,ToastViewport,Toast,ToastTitle,ToastDescription,ToastClose,ToastAction};

