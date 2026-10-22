import { useEffect } from 'react';
import FullscreenWorkspace from '@/components/layout/FullscreenWorkspace';
import { ArrowLeft, ArrowRight, CheckCircle2, ChevronLeft, ChevronRight, Keyboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { reviewableDocuments, nextReviewId, previousReviewId } from '@/lib/ocrReviewQueue.mjs';

export default function OcrReviewWorkspace({ kind, documents, selectedId, loading, busy = false, message = '', onNavigate, onExit, children }) {
  const rows = reviewableDocuments(documents);
  const position = rows.findIndex(row => row.id === selectedId);
  const previousId = previousReviewId(documents, selectedId);
  const nextId = nextReviewId(documents, selectedId);

  useEffect(() => {
    const onKeyDown = event => {
      const tag = event.target?.tagName?.toLowerCase();
      if (busy || event.defaultPrevented || event.target?.closest('[data-vaul-drawer],[role="listbox"],[role="menu"]') || event.altKey || event.ctrlKey || event.metaKey || ['input', 'textarea', 'select'].includes(tag)
        || event.target?.isContentEditable) return;
      if (event.key === 'ArrowLeft' && previousId) { event.preventDefault(); onNavigate(previousId); }
      if (event.key === 'ArrowRight' && nextId) { event.preventDefault(); onNavigate(nextId); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [busy, previousId, nextId, onNavigate]);

  return (
    <FullscreenWorkspace aria-label={`Revisión de facturas ${kind}`} onBack={onExit} busy={busy}>
      <header className="shrink-0 border-b border-border bg-card px-4 py-3 md:px-6">
        <div className="mx-auto flex max-w-[1800px] flex-wrap items-center gap-3">
          <Button variant="outline" size="sm" disabled={busy} onClick={onExit} className="gap-2"><ArrowLeft className="h-4 w-4" /> Volver al OCR</Button>
          <div className="min-w-0 flex-1">
            <h1 className="font-jakarta text-base font-semibold md:text-lg">Revisión ágil · facturas {kind}</h1>
            <p className="text-xs text-muted-foreground">
              {position >= 0 ? `Factura ${position + 1} de ${rows.length} pendientes de revisión` : `${rows.length} pendientes de revisión`}
              <span className="ml-3 hidden items-center gap-1 md:inline-flex"><Keyboard className="h-3.5 w-3.5" /> Usa ← y → fuera de los campos</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={busy || !previousId} onClick={() => onNavigate(previousId)} className="gap-1"><ChevronLeft className="h-4 w-4" /> Anterior</Button>
            <Button variant="outline" size="sm" disabled={busy || !nextId} onClick={() => onNavigate(nextId)} className="gap-1">Siguiente <ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
        {message && <p role="status" className="mx-auto mt-2 max-w-[1800px] text-xs text-emerald-700">{message}</p>}
      </header>
      <main className="min-h-0 flex-1 p-3 md:p-5">
        <div className="mx-auto h-full max-w-[1800px]">
          {position >= 0 ? (children || <div className="flex h-full items-center justify-center rounded-xl border bg-card text-sm text-muted-foreground">Preparando la siguiente factura…</div>) : (
            <div className="flex h-full flex-col items-center justify-center gap-4 rounded-xl border border-border bg-card p-8 text-center">
              {loading ? <p className="text-muted-foreground">Cargando documentos…</p> : (
                <>
                  <CheckCircle2 className="h-10 w-10 text-emerald-600" />
                  <h2 className="font-jakarta text-xl font-semibold">{rows.length ? 'Esta factura ya no está pendiente' : 'Revisión terminada'}</h2>
                  <p className="max-w-lg text-sm text-muted-foreground">{rows.length ? 'Puedes continuar con otra factura pendiente o volver al lector.' : 'No quedan documentos pendientes de revisión en este OCR.'}</p>
                  <div className="flex gap-2">
                    {rows.length > 0 && <Button onClick={() => onNavigate(rows[0].id)}>Abrir siguiente pendiente <ArrowRight className="ml-2 h-4 w-4" /></Button>}
                    <Button variant="outline" onClick={onExit}>Volver al OCR</Button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </main>
    </FullscreenWorkspace>
  );
}
