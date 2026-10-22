import {useMemo,useRef,useState} from 'react';
import {Check,Search,X} from 'lucide-react';
import {DrawerContent,DrawerTitle,DrawerDescription,DrawerClose} from './drawer';
import {filterPickerOptions} from '@/lib/nativeSelect.mjs';

export default function MobileSelectPicker({picker}){
  const [query,setQuery]=useState(''),[limit,setLimit]=useState(150),title=useRef(null);
  const options=useMemo(()=>filterPickerOptions(picker.options,query),[picker.options,query]);
  return <DrawerContent id={picker.contentId} className="taxea-mobile-picker" onOpenAutoFocus={event=>{event.preventDefault();title.current?.focus({preventScroll:true});}}>
    <div className="flex items-start justify-between gap-3 px-4 py-3">
      <div><DrawerTitle ref={title} tabIndex={-1} className="outline-none">{picker.placeholder||'Seleccionar opción'}</DrawerTitle><DrawerDescription>Busca y selecciona una opción. Se conserva el valor si cierras sin elegir.</DrawerDescription></div>
      <DrawerClose aria-label="Cerrar selector" className="min-h-11 min-w-11 flex items-center justify-center rounded-lg border border-border"><X aria-hidden="true" className="h-5 w-5"/></DrawerClose>
    </div>
    <div className="relative mx-4 mb-3"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground"/><input aria-label="Buscar opción" value={query} onChange={event=>{setQuery(event.target.value);setLimit(150);}} className="w-full h-11 rounded-xl border bg-background pl-9 pr-3 text-base" placeholder="Buscar…" type="search"/></div>
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3" data-vaul-no-drag="" aria-label="Opciones disponibles">
      {options.slice(0,limit).map((option,index)=><div key={option.value}>
        {option.group&&options[index-1]?.group!==option.group&&<p className="px-3 pt-3 pb-1 text-xs font-semibold text-muted-foreground">{option.group}</p>}
        <button type="button" disabled={option.disabled} aria-pressed={String(picker.value)===option.value} onClick={()=>{picker.change(option.value);picker.setOpen(false);}} className="w-full min-h-11 rounded-lg px-3 py-3 text-left flex items-center justify-between gap-3 text-sm disabled:opacity-40 aria-pressed:bg-primary/10 aria-pressed:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring hover:bg-secondary"><span>{option.label}</span>{String(picker.value)===option.value&&<Check aria-hidden="true" className="h-4 w-4 shrink-0"/>}</button>
      </div>)}
      {!options.length&&<p role="status" className="p-5 text-center text-muted-foreground text-sm">No hay opciones que coincidan.</p>}
      {options.length>limit&&<button type="button" className="w-full min-h-11 rounded-lg border text-sm" onClick={()=>setLimit(value=>value+150)}>Mostrar más ({options.length-limit} restantes)</button>}
    </div>
  </DrawerContent>;
}

