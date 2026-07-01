import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { Play, Loader2, CheckCircle, AlertCircle, Copy } from 'lucide-react';
import { formatFrequency } from '@/lib/recurringUtils';

const fmt = n => (n || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = d => d ? d.split('-').reverse().join('/') : '—';

export default function GenerateRecurringModal({ open, onOpenChange, onDone }) {
  const [phase, setPhase] = useState('loading'); // loading → preview → generating → done
  const [preview, setPreview] = useState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setPhase('loading');
    setError('');
    setPreview([]);
    setResult(null);
    loadPreview();
  }, [open]);

  const loadPreview = async () => {
    try {
      const res = await base44.functions.invoke('generateRecurringInvoices', { action: 'preview' });
      const data = res?.data || res;
      setPreview(data?.preview || []);
      setPhase('preview');
    } catch (e) {
      setError('No se pudo cargar la previsualización.');
      setPhase('preview');
    }
  };

  const handleGenerate = async () => {
    setPhase('generating');
    try {
      const res = await base44.functions.invoke('generateRecurringInvoices', { action: 'generate', runType: 'manual' });
      const data = res?.data || res;
      setResult(data);
      setPhase('done');
      onDone?.();
    } catch (e) {
      setError('Error al generar las facturas recurrentes.');
      setPhase('done');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="w-5 h-5 text-teal" />
            Generar facturas recurrentes
          </DialogTitle>
        </DialogHeader>

        {phase === 'loading' && (
          <div className="py-8 text-center">
            <Loader2 className="w-6 h-6 text-teal animate-spin mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Buscando facturas recurrentes pendientes...</p>
          </div>
        )}

        {phase === 'preview' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Se generarán las facturas recurrentes pendientes hasta hoy. Las facturas ya generadas no se duplicarán.
            </p>

            {error && <p className="text-sm text-destructive">{error}</p>}

            {preview.length === 0 ? (
              <div className="py-6 text-center">
                <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
                <p className="text-sm font-medium">No hay facturas recurrentes pendientes de generar.</p>
              </div>
            ) : (
              <>
                <div className="bg-secondary/40 rounded-xl border border-border divide-y divide-border max-h-64 overflow-y-auto">
                  {preview.map((item, i) => (
                    <div key={i} className="flex items-center justify-between px-4 py-2.5 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{item.clientName || '—'}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {item.concept || '—'} · {fmtDate(item.periodStart)}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground ml-3 flex-shrink-0">
                        {formatFrequency(item)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                  <Button onClick={handleGenerate} className="bg-teal hover:bg-teal-dark">
                    <Play className="w-4 h-4 mr-1.5" /> Generar {preview.length} pendiente{preview.length > 1 ? 's' : ''}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {phase === 'generating' && (
          <div className="py-8 text-center">
            <Loader2 className="w-6 h-6 text-teal animate-spin mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Generando facturas recurrentes...</p>
          </div>
        )}

        {phase === 'done' && (
          <div className="space-y-4">
            {result ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-green-700">{result.generated || 0}</p>
                    <p className="text-xs text-green-700">Generadas</p>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-amber-700">{result.skipped || 0}</p>
                    <p className="text-xs text-amber-700">Omitidas (duplicado)</p>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-blue-700">{result.drafts || 0}</p>
                    <p className="text-xs text-blue-700">Borradores</p>
                  </div>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-red-700">{result.errors || 0}</p>
                    <p className="text-xs text-red-700">Con error</p>
                  </div>
                </div>
                {(result.generated > 0 || result.drafts > 0) && (
                  <p className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    Se han generado {result.generated + (result.drafts || 0)} factura(s) recurrentes. {result.skipped > 0 && `${result.skipped} ya existían y no se han duplicado.`}
                  </p>
                )}
                {result.generated === 0 && result.drafts === 0 && result.skipped > 0 && (
                  <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Las facturas ya fueron generadas para este periodo. No se ha duplicado.
                  </p>
                )}
                {result.errors > 0 && (
                  <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                    {result.errors} recurrencia(s) no se pudieron generar por datos incompletos. Revísalas antes de continuar.
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-destructive">{error || 'Error al generar las facturas recurrentes.'}</p>
            )}
            <div className="flex justify-end">
              <Button onClick={() => onOpenChange(false)}>Cerrar</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}