import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useCompanyContext } from '@/lib/useCompanyContext';
import { Button } from '@/components/ui/button';
import { Send, Upload, CheckCircle, FileText } from 'lucide-react';
import { useState } from 'react';

const ESTADO_CONFIG = {
  pendiente: { label: 'Pendiente', color: 'bg-amber-100 text-amber-700' },
  en_proceso: { label: 'En proceso', color: 'bg-blue-100 text-blue-700' },
  presentado: { label: 'Presentado', color: 'bg-green-100 text-green-700' },
  rechazado: { label: 'Rechazado', color: 'bg-red-100 text-red-700' },
  con_requerimiento: { label: 'Con requerimiento', color: 'bg-red-200 text-red-800' },
  subsanado: { label: 'Subsanado', color: 'bg-teal-100 text-teal-700' },
};

export default function PresentacionesTab() {
  const { user } = useAuth();
  const { company } = useCompanyContext(user);
  const companyId = company?.id;
  const qc = useQueryClient();

  const { data: filings = [], isLoading } = useQuery({
    queryKey: ['taxFilings', companyId],
    queryFn: () => base44.entities.TaxFiling.filter({ companyId }),
    enabled: !!companyId,
  });

  const updateFiling = useMutation({
    mutationFn: ({ id, data }) => base44.entities.TaxFiling.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['taxFilings', companyId] }),
  });

  if (!companyId) return <div className="text-center py-16 text-sm text-muted-foreground">Selecciona un cliente.</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Presentaciones</h2>
      </div>

      {/* Info connectors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border border-border rounded-xl p-4 bg-white">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-md bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700">AEAT</div>
            <p className="text-sm font-medium">Conector AEAT</p>
          </div>
          <p className="text-xs text-muted-foreground">Presentación directa AEAT no disponible todavía. Puedes generar borrador o fichero para presentación externa.</p>
          <Button size="sm" variant="outline" className="mt-3 text-xs h-7" disabled>Próximamente</Button>
        </div>
        <div className="border border-border rounded-xl p-4 bg-white">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-md bg-orange-100 flex items-center justify-center text-xs font-bold text-orange-700">ATC</div>
            <p className="text-sm font-medium">Conector Agencia Tributaria Canaria</p>
          </div>
          <p className="text-xs text-muted-foreground">Presentación directa ATC no disponible todavía. Puedes generar borrador o fichero para presentación externa.</p>
          <Button size="sm" variant="outline" className="mt-3 text-xs h-7" disabled>Próximamente</Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Cargando...</div>
      ) : filings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-border rounded-xl">
          <Send className="w-10 h-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium text-foreground mb-1">No hay presentaciones registradas</p>
          <p className="text-xs text-muted-foreground max-w-sm">
            Las presentaciones se registran tras aprobar un borrador y marcar el modelo como presentado externamente o a través del conector.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 border-b border-border">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground">Modelo</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground">Período</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground">Vía</th>
                <th className="text-right py-3 px-4 text-xs font-medium text-muted-foreground">Importe</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground">Fecha</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground">Justificante</th>
                <th className="text-center py-3 px-4 text-xs font-medium text-muted-foreground">Estado</th>
                <th className="text-center py-3 px-4 text-xs font-medium text-muted-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filings.map((f, i) => {
                const cfg = ESTADO_CONFIG[f.estadoPresentacion] || ESTADO_CONFIG.pendiente;
                return (
                  <tr key={f.id} className={`border-b border-border/50 hover:bg-muted/20 ${i === filings.length - 1 ? 'border-0' : ''}`}>
                    <td className="py-3 px-4 font-semibold text-primary">{f.modeloCodigo}</td>
                    <td className="py-3 px-4">{f.periodo} {f.ejercicio}</td>
                    <td className="py-3 px-4 text-xs text-muted-foreground capitalize">{f.via?.replace('_', ' ') || '—'}</td>
                    <td className="py-3 px-4 text-right font-medium">{f.importeFinal != null ? `${f.importeFinal.toFixed(2)} €` : '—'}</td>
                    <td className="py-3 px-4 text-xs text-muted-foreground">{f.fechaPresentacion || '—'}</td>
                    <td className="py-3 px-4 text-xs">
                      {f.numeroJustificante ? (
                        <span className="font-mono text-xs">{f.numeroJustificante}</span>
                      ) : f.justificantePdfUrl ? (
                        <a href={f.justificantePdfUrl} target="_blank" className="text-primary hover:underline flex items-center gap-1"><FileText className="w-3 h-3" /> Ver PDF</a>
                      ) : '—'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>{cfg.label}</span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Button size="sm" variant="ghost" className="h-7 text-xs gap-1">
                        <Upload className="w-3 h-3" /> Justificante
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}