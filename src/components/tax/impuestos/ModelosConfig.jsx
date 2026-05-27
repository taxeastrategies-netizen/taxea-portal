import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useCompanyContext } from '@/lib/useCompanyContext';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle, XCircle, Clock } from 'lucide-react';

export default function ModelosConfig() {
  const { user } = useAuth();
  const { company } = useCompanyContext(user);
  const companyId = company?.id;
  const qc = useQueryClient();

  const { data: modelos = [], isLoading } = useQuery({
    queryKey: ['taxModels', companyId],
    queryFn: () => base44.entities.TaxModel.filter({ companyId }),
    enabled: !!companyId,
  });

  const updateModel = useMutation({
    mutationFn: ({ id, data }) => base44.entities.TaxModel.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['taxModels', companyId] }),
  });

  const activeModelos = modelos.filter(m => m.activo);
  const inactiveModelos = modelos.filter(m => !m.activo);

  if (!companyId) return <div className="text-center py-16 text-sm text-muted-foreground">Selecciona un cliente.</div>;
  if (isLoading) return <div className="text-center py-16 text-sm text-muted-foreground">Cargando modelos...</div>;
  if (activeModelos.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground text-sm">
        No hay modelos activos. Ve a <strong>Configuración fiscal</strong> para activarlos.
      </div>
    );
  }

  const FUENTES = [
    { value: 'certificado_censal', label: 'Certificado censal' },
    { value: 'criterio_asesor', label: 'Criterio asesor' },
    { value: 'alta_manual', label: 'Alta manual' },
    { value: 'pendiente_confirmar', label: 'Pendiente de confirmar' },
  ];

  const renderModelo = (m) => (
    <div key={m.id} className="border border-border rounded-xl p-4 bg-white">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">{m.codigo}</div>
          <div>
            <p className="text-sm font-semibold text-foreground">{m.nombre}</p>
            <p className="text-xs text-muted-foreground">{m.administracion} · {m.impuesto} · <span className="capitalize">{m.periodicidad}</span></p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {m.activo ? <CheckCircle className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-gray-400" />}
          <span className={`text-xs font-medium ${m.activo ? 'text-green-600' : 'text-gray-400'}`}>{m.activo ? 'Activo' : 'Inactivo'}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-3">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Fuente de validación</p>
          <Select value={m.fuenteValidacion || 'pendiente_confirmar'} onValueChange={v => updateModel.mutate({ id: m.id, data: { fuenteValidacion: v } })}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FUENTES.map(f => <SelectItem key={f.value} value={f.value} className="text-xs">{f.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Periodicidad</p>
          <Select value={m.periodicidad || 'trimestral'} onValueChange={v => updateModel.mutate({ id: m.id, data: { periodicidad: v } })}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="trimestral" className="text-xs">Trimestral</SelectItem>
              <SelectItem value="mensual" className="text-xs">Mensual</SelectItem>
              <SelectItem value="anual" className="text-xs">Anual</SelectItem>
              <SelectItem value="segun_modelo" className="text-xs">Según modelo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          {m.fechaAlta && <>Alta: {m.fechaAlta}</>}
          {m.responsable && <> · Responsable: {m.responsable}</>}
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full ${
          m.estadoImplementacion === 'presentacion_directa' ? 'bg-green-100 text-green-700' :
          m.estadoImplementacion === 'exportacion' ? 'bg-blue-100 text-blue-700' :
          m.estadoImplementacion === 'borrador_interno' ? 'bg-indigo-100 text-indigo-700' :
          'bg-gray-100 text-gray-500'
        }`}>
          {m.estadoImplementacion === 'presentacion_directa' ? 'Presentación directa' :
           m.estadoImplementacion === 'exportacion' ? 'Exportación' :
           m.estadoImplementacion === 'borrador_interno' ? 'Borrador interno' : 'Configuración'}
        </span>
      </div>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3">Modelos activos ({activeModelos.length})</h2>
        <div className="space-y-3">{activeModelos.map(renderModelo)}</div>
      </div>
      {inactiveModelos.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground mb-3">Modelos inactivos ({inactiveModelos.length})</h2>
          <div className="space-y-3 opacity-60">{inactiveModelos.map(renderModelo)}</div>
        </div>
      )}
    </div>
  );
}