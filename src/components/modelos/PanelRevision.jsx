import { useState } from 'react';
import { CheckCircle2, RotateCcw, X, User, Search, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

const CONFIANZA_COLORS = {
  alta: 'bg-green-50 border-green-200 text-green-700',
  media: 'bg-amber-50 border-amber-200 text-amber-700',
  baja: 'bg-red-50 border-red-200 text-red-700',
};

export default function PanelRevision({ item, companies, onConfirmar, onIgnorar, onReprocesar }) {
  const [clienteOverride, setClienteOverride] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [mostrarBusqueda, setMostrarBusqueda] = useState(false);

  if (!item) return (
    <div className="flex-1 flex items-center justify-center text-center p-8">
      <div>
        <div className="w-12 h-12 bg-secondary rounded-xl mx-auto mb-3 flex items-center justify-center">
          <User className="w-6 h-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">Selecciona un documento para revisar</p>
      </div>
    </div>
  );

  const ex = item.extraccion || {};
  const empresaAsignada = clienteOverride || (ex.company_id ? companies.find(c => c.id === ex.company_id) : null);
  const confianza = ex.confianza || 'baja';
  const empresasFiltradas = companies.filter(c =>
    !busqueda || c.razon_social?.toLowerCase().includes(busqueda.toLowerCase()) ||
    c.nif_cif?.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground text-sm">{item.file.name}</h3>
          <span className={cn('text-xs px-2 py-0.5 rounded border font-medium', CONFIANZA_COLORS[confianza])}>
            Confianza {confianza}
          </span>
        </div>
      </div>

      {/* Vista PDF */}
      {item.previewUrl && (
        <div className="mx-4 mt-4 border border-border rounded-xl overflow-hidden bg-secondary/20" style={{ height: 280 }}>
          <iframe src={item.previewUrl} className="w-full h-full" title="Preview PDF" />
        </div>
      )}

      <div className="p-4 space-y-4 flex-1">
        {/* Datos extraídos */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Datos extraídos por IA</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Modelo', val: ex.modelo },
              { label: 'Ejercicio', val: ex.ejercicio },
              { label: 'Periodo', val: ex.periodo },
              { label: 'Trimestre', val: ex.trimestre },
              { label: 'NIF/CIF', val: ex.nif_cif },
              { label: 'Razón Social', val: ex.razon_social },
              { label: 'Importe', val: ex.importe != null ? `${ex.importe} €` : null },
              { label: 'CSV/NRC', val: ex.csv || ex.nrc },
            ].filter(f => f.val).map(f => (
              <div key={f.label} className="bg-secondary/40 rounded-lg p-2">
                <p className="text-xs text-muted-foreground">{f.label}</p>
                <p className="text-sm font-medium text-foreground truncate">{f.val}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Cliente asignado */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Cliente asignado</p>
          {empresaAsignada ? (
            <div className="flex items-center gap-3 p-3 bg-teal/5 border border-teal/20 rounded-xl">
              <div className="w-9 h-9 bg-teal-light rounded-full flex items-center justify-center text-teal font-bold text-sm">
                {empresaAsignada.razon_social?.[0] || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">{empresaAsignada.razon_social}</p>
                <p className="text-xs text-muted-foreground">{empresaAsignada.nif_cif}</p>
              </div>
              <button onClick={() => { setClienteOverride(null); setMostrarBusqueda(true); }}
                className="text-xs text-teal hover:underline">Cambiar</button>
            </div>
          ) : (
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
              <p className="text-sm text-amber-700">Cliente no identificado</p>
              <button onClick={() => setMostrarBusqueda(true)} className="ml-auto text-xs text-amber-700 underline">Asignar</button>
            </div>
          )}
        </div>

        {/* Buscador clientes */}
        {mostrarBusqueda && (
          <div className="border border-border rounded-xl p-3 space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input className="pl-8 h-8 text-sm" placeholder="Buscar cliente..." value={busqueda} onChange={e => setBusqueda(e.target.value)} autoFocus />
            </div>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {empresasFiltradas.slice(0, 10).map(c => (
                <button key={c.id} onClick={() => { setClienteOverride(c); setMostrarBusqueda(false); setBusqueda(''); }}
                  className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-secondary/50 transition-colors">
                  <p className="text-sm font-medium text-foreground">{c.razon_social}</p>
                  <p className="text-xs text-muted-foreground">{c.nif_cif}</p>
                </button>
              ))}
              {empresasFiltradas.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">Sin resultados</p>}
            </div>
          </div>
        )}

        {/* Acciones */}
        <div className="flex flex-col gap-2 pt-2">
          <Button onClick={() => onConfirmar(item, clienteOverride || (ex.company_id ? companies.find(c => c.id === ex.company_id) : null))}
            disabled={!empresaAsignada || item.estado === 'confirmado'}
            className="bg-teal hover:bg-teal-dark w-full">
            <CheckCircle2 className="w-4 h-4 mr-2" />
            {item.estado === 'confirmado' ? '✓ Confirmado' : 'Confirmar y archivar'}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onReprocesar(item.id)} className="flex-1">
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Reprocesar
            </Button>
            <Button variant="outline" size="sm" onClick={() => onIgnorar(item.id)} className="flex-1 text-muted-foreground">
              <X className="w-3.5 h-3.5 mr-1.5" /> Ignorar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}