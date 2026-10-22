import fs from 'node:fs';
const changes={
  'src/components/layout/TopBar.jsx':[
    ['taxea-mobile-back md:hidden min-w-11','taxea-mobile-back min-w-11'],
  ],
  'src/components/layout/MobileNavigation.jsx':[
    ["import {recordNavigation,safeBackTarget} from '@/lib/navigationStack.mjs';","import {recordNavigation,safeBackTarget} from '@/lib/navigationStack.mjs';\nimport {topmostDismissibleLayer} from '@/lib/fullscreenNavigation.mjs';"],
    [`const modal=document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"], [role="listbox"][data-state="open"], [role="menu"][data-state="open"]');`,`const modal=topmostDismissibleLayer(document);`],
  ],
  'src/components/lector/OcrReviewWorkspace.jsx':[
    ["import { useEffect } from 'react';","import { useEffect } from 'react';\nimport FullscreenWorkspace from '@/components/layout/FullscreenWorkspace';"],
    ['if (busy || event.altKey || event.ctrlKey || event.metaKey ||',`if (busy || event.defaultPrevented || event.target?.closest('[data-vaul-drawer],[role="listbox"],[role="menu"]') || event.altKey || event.ctrlKey || event.metaKey ||`],
    ['<div className="fixed inset-0 z-[100] flex flex-col bg-background text-foreground" role="region" aria-label={`Revisión de facturas ${kind}`}>','<FullscreenWorkspace aria-label={`Revisión de facturas ${kind}`} onBack={onExit} busy={busy}>'],
    ['      </main>\n    </div>','      </main>\n    </FullscreenWorkspace>'],
  ],
  'src/components/facturas/InvoiceDocumentWorkspace.jsx':[
    ["import { useState } from 'react';","import { useState } from 'react';\nimport FullscreenWorkspace from '@/components/layout/FullscreenWorkspace';"],
    ["if (e.target?.tagName === 'INPUT' || e.target?.tagName === 'TEXTAREA' || e.target?.isContentEditable) return;",`if (e.defaultPrevented || e.target?.closest('[data-vaul-drawer],[role="listbox"],[role="menu"]') || ['INPUT','TEXTAREA','SELECT'].includes(e.target?.tagName) || e.target?.isContentEditable) return;`],
    ['<div className="fixed inset-0 z-40 bg-background flex flex-col">','<FullscreenWorkspace aria-label="Vista de factura" onBack={onClose}>'],
    ['<div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card flex-shrink-0 shadow-sm">','<header className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-border bg-card flex-shrink-0 shadow-sm">'],
    ['<button\n            onClick={onClose}', '<button\n            type="button"\n            aria-label="Volver al listado de facturas"\n            onClick={onClose}'],
    ['className="flex items-center gap-3 min-w-0"','className="flex flex-1 items-center gap-3 min-w-0"'],
    ['className="flex items-center gap-1.5 flex-shrink-0"','className="flex w-full flex-wrap justify-end items-center gap-1.5 flex-shrink-0 sm:w-auto"'],
    ['<button className="p-1.5 rounded-lg border border-border hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">','<button type="button" aria-label="Más opciones de la factura" className="p-1.5 rounded-lg border border-border hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">'],
    ['      </div>\n\n      {/* ── Layout principal: visor + panel ───────────────────────────── */}', '      </header>\n\n      {/* ── Layout principal: visor + panel ───────────────────────────── */}'],
    ['<div className="flex flex-1 min-h-0">','<div className="flex flex-1 min-h-0 flex-col overflow-y-auto overscroll-none lg:flex-row lg:overflow-hidden">'],
    ['<div className="flex-1 min-w-0 overflow-hidden">','<div className="h-[45dvh] min-h-[15rem] shrink-0 min-w-0 overflow-hidden lg:h-auto lg:min-h-0 lg:flex-1 lg:shrink">'],
    ['<div className="w-[440px] flex-shrink-0 border-l border-border overflow-hidden flex flex-col bg-card">','<div className="w-full shrink-0 border-t border-border flex flex-col bg-card lg:w-[440px] lg:border-t-0 lg:border-l lg:overflow-hidden">'],
    ['            onRefresh={onRefresh}\n          />\n        </div>\n      </div>\n    </div>', '            onRefresh={onRefresh}\n          />\n        </div>\n      </div>\n    </FullscreenWorkspace>'],
  ],
  'src/components/lector/MobileScanner.jsx':[
    ['className="fixed inset-0 z-[100] flex h-[100dvh] flex-col bg-slate-950 text-white outline-none" style={{ paddingTop: \'env(safe-area-inset-top)\', paddingBottom: \'env(safe-area-inset-bottom)\' }}','className="taxea-fullscreen-surface fixed inset-0 z-[100] flex h-[100dvh] flex-col bg-slate-950 text-white outline-none"'],
  ],
  'src/components/facturas/SendInvoiceDocumentModal.jsx':[
    ['className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4"','className="taxea-safe-overlay fixed inset-0 z-[110] bg-black/60 flex items-center justify-center p-4"'],
    ['className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col"','className="taxea-safe-preview bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col"'],
    ['<button onClick={() => setShowPreview(false)} className="p-1 rounded hover:bg-slate-100">','<button type="button" aria-label="Cerrar previsualización del email" onClick={() => setShowPreview(false)} className="p-1 rounded hover:bg-slate-100">'],
  ],
};
const prepared=[];
for(const [file,edits] of Object.entries(changes)){
  let source=fs.readFileSync(file,'utf8');
  for(const [oldText,newText] of edits){const count=source.split(oldText).length-1;if(count!==1)throw Error(`${file}: expected unique match, got ${count}: ${oldText.slice(0,65)}`);source=source.replace(oldText,newText);}
  prepared.push([file,source]);
}
for(const [file,source] of prepared)fs.writeFileSync(file,source);
console.log('Six presentation files updated; no handlers for financial actions changed.');

