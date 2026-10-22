// Disposable browser QA. No real data, SDK, files, approvals or communications.
import React,{useLayoutEffect,useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter} from 'react-router-dom';
import TopBar from '../src/components/layout/TopBar';
import {MobileNavigationProvider} from '../src/components/layout/MobileNavigation';
import FullscreenWorkspace from '../src/components/layout/FullscreenWorkspace';
import OcrReviewWorkspace from '../src/components/lector/OcrReviewWorkspace';
import NativeSelect from '../src/components/ui/NativeSelect';
import useShellScrollLock from '../src/hooks/useShellScrollLock';
import {NAVIGATION_COMMITTED_EVENT} from '../src/lib/mobileNavigation.mjs';

function WorkspaceBody({onBack,busy,setBusy}){
  const [draft,setDraft]=useState(''),[account,setAccount]=useState('a');
  return <>
    <header className="flex shrink-0 items-center gap-3 border-b p-3"><button className="rounded-lg border p-3" disabled={busy} onClick={onBack}>Volver al panel ficticio</button><h2>Workspace ficticio</h2></header>
    <main className="min-h-0 flex-1 overflow-y-auto overscroll-none p-4 space-y-4">
      <label className="block">Borrador ficticio<input className="block w-full rounded border p-3" value={draft} onChange={e=>setDraft(e.target.value)}/></label>
      <label className="block">Cuenta ficticia<NativeSelect className="block w-full border rounded" value={account} onChange={e=>setAccount(e.target.value)}><option value="a">Cuenta Alpha</option><option value="b">Cuenta Beta</option></NativeSelect></label>
      <label className="flex items-center gap-2"><input type="checkbox" checked={busy} onChange={e=>setBusy(e.target.checked)}/>Simular proceso activo</label>
      <p>No se guarda ni envía nada.</p>
    </main><footer className="shrink-0 border-t p-3"><button className="rounded border p-3">Último control ficticio</button></footer>
  </>;
}
function Fixture(){
  useShellScrollLock();
  const [kind,setKind]=useState(null),[ownerHidden,setOwnerHidden]=useState(false),[busy,setBusy]=useState(false),[cutout,setCutout]=useState('portrait'),[selectedId,setSelectedId]=useState('qa-doc-1');
  useEffect(()=>{const pop=()=>setOwnerHidden(true);window.addEventListener('popstate',pop);return()=>window.removeEventListener('popstate',pop);},[]);
  useLayoutEffect(()=>{window.dispatchEvent(new CustomEvent(NAVIGATION_COMMITTED_EVENT));},[ownerHidden]);
  useLayoutEffect(()=>{const values=cutout==='portrait'?{top:59,right:0,bottom:34,left:0}:{top:0,right:47,bottom:21,left:47};for(const [side,value] of Object.entries(values))document.documentElement.style.setProperty('--qa-env-safe-'+side,value+'px');},[cutout]);
  const enter=next=>{history.pushState({fixture:true},'','?workspace='+next);setOwnerHidden(false);setBusy(false);setKind(next);};
  const documents=[{id:'qa-doc-1',status:'review_required'},{id:'qa-doc-2',status:'review_required'}];
  return <div className="taxea-future-shell isolate flex flex-col">
    <TopBar user={{full_name:'QA ficticio'}} companyName="Empresa ficticia" onMenuToggle={()=>{}}/>
    <main className="taxea-future-main min-h-0 flex-1 overflow-y-auto p-4 space-y-4">
      <h1>Taxea QA — pantallas completas sin backend</h1><p>Insets simulados; ningún documento real.</p>
      <button className="rounded border p-3" onClick={()=>enter('panel')}>Abrir panel ficticio</button>
      <button className="rounded border p-3" onClick={()=>enter('ocr')}>Abrir OCR ficticio</button>
      <button className="rounded border p-3" onClick={()=>setCutout(value=>value==='portrait'?'landscape':'portrait')}>Cambiar insets simulados</button>
      {ownerHidden&&<button className="rounded border p-3" onClick={()=>setOwnerHidden(false)}>Regresar a pantalla ficticia</button>}
      <p role="status" aria-label="Documento seleccionado">{selectedId}</p>
      <div style={{transform:'translateX(6px)'}}><section hidden={ownerHidden} inert={ownerHidden?'':undefined}>
        {kind==='panel'&&<FullscreenWorkspace aria-label="Panel QA completo" onBack={()=>setKind(null)} busy={busy}><WorkspaceBody onBack={()=>setKind(null)} busy={busy} setBusy={setBusy}/></FullscreenWorkspace>}
        {kind==='ocr'&&<OcrReviewWorkspace kind="recibidas" documents={documents} selectedId={selectedId} busy={false} onExit={()=>setKind(null)} onNavigate={setSelectedId}><div className="h-full overflow-auto p-4 space-y-4"><p>Documento ficticio sin acciones de aprobación</p><label>Proveedor ficticio<NativeSelect className="block border rounded w-full" value="a" onChange={()=>{}}><option value="a">Proveedor Alpha</option><option value="b">Proveedor Beta</option></NativeSelect></label></div></OcrReviewWorkspace>}
      </section></div>
    </main>
  </div>;
}
createRoot(document.getElementById('root')).render(<BrowserRouter><MobileNavigationProvider><Fixture/></MobileNavigationProvider></BrowserRouter>);

