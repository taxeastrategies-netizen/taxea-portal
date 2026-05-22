import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FileText, Download, CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AccountingExportHistoryModal({ client, open, onClose }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && client) load();
  }, [open, client]);

  const load = async () => {
    setLoading(true);
    const data = await base44.entities.AccountingExportHistory.filter(
      { clientAccountId: client.id },
      '-exportedAt',
      30
    ).catch(() => []);
    setHistory(data || []);
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-jakarta">
            Historial de exportaciones — {client?.legalName}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {loading ? (
            <div className="py-8 text-center">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : history.length === 0 ? (
            <div className="py-8 text-center">
              <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
              <p className="text-sm text-muted-foreground">Sin exportaciones registradas</p>
            </div>
          ) : history.map((item, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3 bg-secondary/30 rounded-lg">
              <div className={cn(
                'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                item.status === 'error' ? 'bg-red-100' : 'bg-emerald-100'
              )}>
                {item.status === 'error'
                  ? <AlertCircle className="w-4 h-4 text-red-600" />
                  : <CheckCircle className="w-4 h-4 text-emerald-600" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-foreground">
                    {item.exportYear} — {item.exportPeriod}
                  </span>
                  {item.onlyNew && (
                    <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">Solo nuevas</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {item.exportedAt ? new Date(item.exportedAt).toLocaleString('es-ES') : '—'} · por {item.exportedBy || '—'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {item.totalEmitted} emitidas · {item.totalReceived} recibidas
                  {(item.newEmittedCount > 0 || item.newReceivedCount > 0) && (
                    <span className="text-emerald-600 ml-1">· +{item.newEmittedCount + item.newReceivedCount} nuevas</span>
                  )}
                </p>
              </div>
              <div className="text-xs text-muted-foreground flex-shrink-0">
                {item.fileName && (
                  <span className="flex items-center gap-1">
                    <Download className="w-3 h-3" />
                    {item.fileName.slice(0, 30)}...
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}