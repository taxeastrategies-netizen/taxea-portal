// Disposable preview-only harness. Actual page components, in-memory API only.
import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {MemoryRouter, Routes, Route, Outlet, useLocation, useNavigate} from 'react-router-dom';
import {ThemeProvider, useTheme} from 'next-themes';
import Contactos from '../src/pages/Contactos';
import AnalysisHome from '../src/components/finance/analysis/AnalysisHome';
import TopBar from '../src/components/layout/TopBar';
import {MobileNavigationProvider} from '../src/components/layout/MobileNavigation';
import useShellScrollLock from '../src/hooks/useShellScrollLock';

function Fixture(){
  useShellScrollLock();
  const location=useLocation(),navigate=useNavigate(),{theme,setTheme}=useTheme();
  const [actions,setActions]=useState(0);
  return <div className="taxea-future-shell flex flex-col bg-background text-foreground">
    <TopBar user={{full_name:'QA ficticio'}} companyName="Empresa ficticia" onMenuToggle={()=>setActions(n=>n+1)}/>
    <main className="taxea-future-main min-h-0 flex-1 overflow-y-auto p-4 space-y-4">
      <div className="rounded-xl border p-3 space-y-2"><h1 className="text-lg font-semibold">QA móvil — sin backend</h1><p className="text-sm text-muted-foreground">Datos ficticios. Ningún cambio llega a cuentas o documentos reales.</p>
        <div className="flex flex-wrap gap-2"><button className="rounded border p-2" onClick={()=>navigate('/contactos')}>Ver contactos QA</button><button className="rounded border p-2" onClick={()=>navigate('/finance/analysis')}>Ver análisis QA</button><button className="rounded border p-2" onClick={()=>setTheme(theme==='dark'?'light':'dark')}>Cambiar tema QA</button></div>
        <p role="status">Tema: {theme}. Acciones simuladas: {actions}</p>
      </div>
      {location.pathname==='/contactos'?<Contactos/>:<AnalysisHome/>}
    </main>
  </div>;
}
createRoot(document.getElementById('root')).render(<ThemeProvider attribute="class" defaultTheme="system" storageKey="taxea-disposable-qa-theme"><MemoryRouter initialEntries={['/contactos']}><MobileNavigationProvider><Routes><Route element={<Outlet context={{company:{id:'qa-only',nombre:'EMPRESA FICTICIA'},loadingCompany:false}}/>}><Route path="*" element={<Fixture/>}/></Route></Routes></MobileNavigationProvider></MemoryRouter></ThemeProvider>);

