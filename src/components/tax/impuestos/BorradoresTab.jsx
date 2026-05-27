import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useCompanyContext } from '@/lib/useCompanyContext';
import { Button } from '@/components/ui/button';
import { FilePen, Plus, Eye, CheckCircle, XCircle } from 'lucide-react';

const ESTADO_CONFIG = {
  borrador: { label: 'Borrador', color: 'bg-indigo-100 text-indigo-700' },
  en_revision: { label: 'En revisión', color: 'bg-yellow-100 text-yellow-700' },
  revisado: { label: 'Revisado', color: 'bg-teal-100 text-teal-700' },
  aprobado: { label: 'Aprobado', color: 'bg-green-100 text-green-700' },
  rechazado: { label: 'Rechazado', color: 'bg-red-100 text-red-700' },
};

export default function BorradoresTab() {
  const { user } = useAuth();
  const { company } = useCompanyContext(user);
  const companyId = company?.id;
  const qc = useQueryClient();

  const { data: drafts = [], isLoading } = useQuery({
    queryKey: ['taxDrafts', companyId],
    queryFn: () => base44.entities.TaxDraft.filter({ companyId }),
    enabled: !!companyId,
  });

  const updateDraft = useMutation({
    mutationFn: ({ id, data }) => base44.entities.TaxDraft.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['taxDrafts', companyId] }),
  });

  if (!companyId) return <div className="text-center py-16 text-sm text-muted-foreground">Selecciona un cliente.</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Borradores de modelos fiscales</h2>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Cargando...</div>
      ) : drafts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-border rounded-xl">
          <FilePen className="w-10 h-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium text-foreground mb-1">No hay borradores creados</p>
          <p className="text-xs text-muted-foreground max-w-sm">
            Para crear un borrador, ve al <strong>Panel</strong>, selecciona un período y pulsa "Crear borrador". Los importes se calcularán automáticamente desde facturas y asientos reales.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 border-b border-border">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground">Modelo</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground">Período</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground">Versión</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground">Creado por</th>
                <th className="text-center py-3 px-4 text-xs font-medium text-muted-foreground">Estado</th>
                <th className="text-center py-3 px-4 text-xs font-medium text-muted-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {drafts.map((d, i) => {
                const cfg = ESTADO_CONFIG[d.estado] || ESTADO_CONFIG.borrador;
                return (
                  <tr key={d.id} className={`border-b border-border/50 hover:bg-muted/20 ${i === drafts.length - 1 ? 'border-0' : ''}`}>
                    <td className="py-3 px-4 font-semibold text-primary">{d.modeloCodigo}</td>
                    <td className="py-3 px-4">{d.periodo} {d.ejercicio}</td>
                    <td className="py-3 px-4 text-muted-foreground">v{d.version}</td>
                    <td className="py-3 px-4 text-muted-foreground text-xs">{d.usuarioCreador || '—'}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>{cfg.label}</span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1"><Eye className="w-3 h-3" /> Ver</Button>
                        {d.estado === 'borrador' && (
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-blue-600 gap-1" onClick={() => updateDraft.mutate({ id: d.id, data: { estado: 'en_revision' } })}>
                            <CheckCircle className="w-3 h-3" /> Revisar
                          </Button>
                        )}
                        {d.estado === 'en_revision' && (
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-green-600 gap-1" onClick={() => updateDraft.mutate({ id: d.id, data: { estado: 'aprobado' } })}>
                            <CheckCircle className="w-3 h-3" /> Aprobar
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-700">
        Los borradores se generan a partir de facturas emitidas/recibidas y asientos contabilizados confirmados. Sin datos suficientes se mostrará "Sin datos suficientes para calcular el modelo".
      </div>
    </div>
  );
}