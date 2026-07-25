import { ShieldCheck, ShieldAlert, RefreshCw, Download, Plus, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';

export default function BillingHeader({ stripe, onSync, syncing, generatedAt }) {
  const configured = stripe?.configured;
  const isTest = stripe?.isTestMode;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <div>
        <h1 className="text-xl lg:text-2xl font-jakarta font-bold text-foreground">Clientes y cobros</h1>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {configured ? (
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1">
              <ShieldCheck className="w-3 h-3" /> Stripe conectado
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 gap-1">
              <ShieldAlert className="w-3 h-3" /> Stripe no configurado
            </Badge>
          )}
          {configured && (
            <Badge variant="outline" className={isTest ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-blue-50 text-blue-700 border-blue-200'}>
              {isTest ? 'Modo prueba' : 'Producción'}
            </Badge>
          )}
          {generatedAt && (
            <span className="text-xs text-muted-foreground">
              Actualizado: {new Date(generatedAt).toLocaleString('es-ES', { timeZone: 'Atlantic/Canary', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="outline" size="sm" onClick={onSync} disabled={syncing} className="gap-1.5">
          {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Sincronizar Stripe
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5" disabled>
          <Download className="w-4 h-4" /> Exportar cobros
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5" disabled>
          <Plus className="w-4 h-4" /> Nuevo cliente
        </Button>
        <Button variant="ghost" size="sm"><MoreHorizontal className="w-4 h-4" /></Button>
      </div>
    </div>
  );
}