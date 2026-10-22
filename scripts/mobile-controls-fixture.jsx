// Isolated browser QA: no SDK, auth, documents, messages, or backend writes.
import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Select,SelectContent,SelectItem,SelectGroup,SelectLabel,SelectTrigger,SelectValue} from '../src/components/ui/select';
import {NAVIGATION_COMMITTED_EVENT} from '../src/lib/mobileNavigation.mjs';
import useShellScrollLock from '../src/hooks/useShellScrollLock';
import {BrowserRouter} from 'react-router-dom';
import TopBar from '../src/components/layout/TopBar';
import NativeSelect from '../src/components/ui/NativeSelect';

function Fixture(){
  useShellScrollLock();
  const [banner,setBanner]=useState(false),[cutout,setCutout]=useState('portrait');
  const [legacy,setLegacy]=useState(''),[legacyChanges,setLegacyChanges]=useState(0),[legacyResult,setLegacyResult]=useState('Sin comprobar');
  useEffect(()=>{
    const values=cutout==='portrait'?{top:59,bottom:34,left:0,right:0}:{top:0,bottom:21,left:47,right:47};
    for(const [side,value] of Object.entries(values))document.documentElement.style.setProperty('--qa-env-safe-'+side,value+'px');
  },[cutout]);
  const [open,setOpen]=useState(false),[choice,setChoice]=useState('a'),[changes,setChanges]=useState(0),[custom,setCustom]=useState('x'),[clicks,setClicks]=useState(0),[submitted,setSubmitted]=useState(null),[submits,setSubmits]=useState(0),[fieldChanges,setFieldChanges]=useState(0),[screen,setScreen]=useState('primera');
  useEffect(()=>{const pop=()=>{setScreen('primera');window.dispatchEvent(new CustomEvent(NAVIGATION_COMMITTED_EVENT));};window.addEventListener('popstate',pop);return()=>window.removeEventListener('popstate',pop);},[]);
  return <div className="taxea-future-shell flex flex-col">
    {banner&&<div className="taxea-impersonation-safe-top"><p className="h-8">Banner ficticio</p></div>}
    <TopBar safeAreaTop={!banner} onMenuToggle={()=>{}} user={{full_name:'QA ficticio'}} companyName="Empresa ficticia"/>
    <main className="taxea-future-main flex-1 min-h-0 overflow-y-auto overscroll-none p-4 space-y-5">
    <h1>Taxea QA — controles ficticios sin backend</h1>
    <p>Esta página no accede a perfiles ni guarda documentos.</p>
    <form className="space-y-3 rounded-xl border p-4" onSubmit={event=>{event.preventDefault();setLegacyResult(JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))));}}>
      <label htmlFor="qa-legacy-account">Proveedor obligatorio ficticio</label>
      <NativeSelect className="w-full border rounded-lg" id="qa-legacy-account" name="legacyAccount" required value={legacy} onChange={event=>{setLegacy(event.target.value);setLegacyChanges(count=>count+1);}}><option value="">Elige proveedor</option><optgroup label="Proveedores ficticios"><option value="40000001">Proveedor Alpha</option><option value="40000002">Proveedor Beta</option><option value="40000003" disabled>Proveedor archivado</option></optgroup></NativeSelect>
      <button className="rounded-lg border p-3" type="submit">Comprobar proveedor</button><button className="rounded-lg border p-3" type="button" onClick={()=>setLegacy('')}>Vaciar proveedor</button>
      <p role="status" aria-label="Cambios legacy">{legacyChanges}</p><p role="status" aria-label="Resultado legacy">{legacyResult}</p><p role="status" aria-label="Valor legacy">{legacy}</p>
    </form>
    <button className="rounded-lg border p-3" onClick={()=>setBanner(value=>!value)}>Alternar banner ficticio</button><button className="rounded-lg border p-3" onClick={()=>setCutout(value=>value==='portrait'?'landscape':'portrait')}>Alternar insets simulados</button>
    <form className="space-y-3 rounded-xl border p-4" onSubmit={event=>{event.preventDefault();setSubmitted(Object.fromEntries(new FormData(event.currentTarget)));setSubmits(count=>count+1);}}>
      <label htmlFor="qa-account">Cuenta contable ficticia obligatoria</label>
      <Select name="account" required defaultValue="" onValueChange={()=>setFieldChanges(count=>count+1)}><SelectTrigger id="qa-account" aria-label="Cuenta formulario"><SelectValue placeholder="Elige cuenta ficticia"/></SelectTrigger><SelectContent><SelectGroup><SelectLabel>Clientes ficticios</SelectLabel><SelectItem value="43000001">Cliente Alpha</SelectItem><SelectItem value="43000002">Cliente Beta</SelectItem><SelectItem value="43000003" disabled>Cliente deshabilitado</SelectItem></SelectGroup></SelectContent></Select>
      <button className="border rounded-lg p-3" type="submit">Comprobar formulario</button><button className="border rounded-lg p-3" type="reset">Restablecer formulario</button>
      <p role="status" aria-label="Resultado del formulario">{submitted?JSON.stringify(submitted):'Sin comprobar'}</p><p role="status" aria-label="Envíos del formulario">{submits}</p><p role="status" aria-label="Cambios del formulario">{fieldChanges}</p>
    </form>
    <section className="space-y-3 rounded-xl border p-4"><h2>Control de apertura y valor</h2><button className="border rounded-lg p-3" onClick={()=>setOpen(true)}>Abrir selector controlado</button>
      <Select open={open} onOpenChange={setOpen} value={choice} onValueChange={value=>{setChoice(value);setChanges(count=>count+1);}}><SelectTrigger aria-label="Opciones controladas"><SelectValue placeholder="Elige opción"/></SelectTrigger><SelectContent><SelectItem value="a">Alpha controlada</SelectItem><SelectItem value="b">Beta controlada</SelectItem><SelectItem value="c" disabled>No disponible</SelectItem></SelectContent></Select>
      <p role="status" aria-label="Valor controlado">{choice}</p><p role="status" aria-label="Cambios controlados">{changes}</p>
    </section>
    <section className="space-y-3 rounded-xl border p-4"><h2>Trigger personalizado</h2><Select value={custom} onValueChange={setCustom}><SelectTrigger asChild aria-label="Selector personalizado"><button className="rounded-lg border p-3" onClick={()=>setClicks(count=>count+1)}>Personalizado: {custom}</button></SelectTrigger><SelectContent><SelectItem value="x">Opción X</SelectItem><SelectItem value="y">Opción Y</SelectItem></SelectContent></Select><p role="status" aria-label="Clicks personalizados">{clicks}</p></section>
    <button className="rounded-lg border p-3" onClick={()=>{history.pushState(null,'','?fixture=segunda');setScreen('segunda');window.dispatchEvent(new CustomEvent(NAVIGATION_COMMITTED_EVENT));}}>Avanzar fixture</button><p role="status" aria-label="Pantalla fixture">{screen}</p>
  </main></div>;
}
createRoot(document.getElementById('root')).render(<BrowserRouter><Fixture/></BrowserRouter>);

