import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useCompanyContext } from '@/lib/useCompanyContext';
import { Button } from '@/components/ui/button';
import { Send, Upload, CheckCircle, FileText, ExternalLink, FileDown, AlertTriangle } from 'lucide-react';

const ESTADO_CONFIG = {
  pendiente:             { label: 'Pendiente',        color: 'bg-amber-100 text-amber-700' },
  enviado:               { label: 'Enviado',          color: 'bg-blue-100 text-blue-700' },
  validado:              { label: 'Validado',         color: 'bg-teal-100 text-teal-700' },
  presentado:            { label: 'Presentado',       color: 'bg-green-100 text-green-700' },
  rechazado:             { label: 'Rechazado',        color: 'bg-red-100 text-red-700' },
  requiere_subsanacion:  { label: 'Subsanación',      color: 'bg-red-200 text-red-800' },
  presentado_parcialmente: { label: 'Parcial',        color: 'bg-yellow-100 text-yellow-700' },
};

const VIA_LABELS = {
  conector_directo:       'Conector directo',
  fichero_oficial_sede:   'Fichero en sede',
  flujo_asistido:         'Flujo asistido',
  exportacion_a3:         'Exportación A3',
  presentacion_manual_externa: 'Manual externa',
};

export default function PresentacionesTab() {
  const { user } = useAuth();
  const { company } = useCompanyContext(user);
  const companyId = company?.id;
  const qc = useQueryClient();
  const [uploadingId, setUploadingId] = useState(null);

  const { data: submissions = [], isLoading } = useQuery({
    queryKey: ['taxSubmissions', companyId],
    queryFn: () => base44.entities.TaxSubmission.filter({ companyId }),
    enabled: !!companyId,
  });

  const { data: officialFiles = [] } = useQuery({
    queryKey: ['taxOfficialFiles', companyId],
    queryFn: () => base44.entities.TaxOfficialFile.filter({ companyId }),
    enabled: !!companyId,
  });

  const updateSubmission = useMutation({
    mutationFn: ({ id, data }) => base44.entities.TaxSubmission.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['taxSubmissions', companyId] }),
  });

  async function handleJustificanteUpload(submissionId, file) {
    setUploadingId(submissionId);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    await updateSubmission.mutateAsync({
      id: submissionId,
      data: { justificantePdfUrl: file_url, estado: 'presentado' },
    });
    setUploadingId(null);
  }

  if (!companyId) return <div className="text-center py-16 text-sm text-muted-foreground">Selecciona un cliente.</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Presentaciones y ficheros oficiales</h2>
        <p className="text-xs text-muted-foreground">{submissions.length} registros</p>
      </div>

      {/* Conectores */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border border-gray-200 rounded-xl p-4 bg-white">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-md bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700">AEAT</div>
            <div>
              <p className="text-sm font-medium">Conector AEAT</p>
              <p className="text-xs text-gray-400">Modelos 303, 111, 115, 130, 390, 347, 349, 190, 180, 193, 123</p>
            </div>
          </div>
          <p className="text-xs text-gray-500 mb-3">Presentación por fichero .dat en Sede Electrónica AEAT. El botón <strong>Presentar modelo</strong> genera el fichero oficial y abre el flujo asistido.</p>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-medium flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Flujo asistido activo
            </span>
            <a href="https://sede.agenciatributaria.gob.es" target="_blank" className="text-xs text-blue-600 hover:underline flex items-center gap-0.5">
              Sede AEAT <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
        <div className="border border-gray-200 rounded-xl p-4 bg-white">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-md bg-orange-100 flex items-center justify-center text-xs font-bold text-orange-700">ATC</div>
            <div>
              <p className="text-sm font-medium">Agencia Tributaria Canaria</p>
              <p className="text-xs text-gray-400">Modelos 420, 425, 415 (IGIC)</p>
            </div>
          </div>
          <p className="text-xs text-gray-500 mb-3">Modelos IGIC — no se presentan en AEAT. El fichero se genera en formato de exportación auxiliar ATC pendiente de validación con diseño oficial.</p>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded font-medium flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Diseño registro pendiente validación
            </span>
            <a href="https://www3.gobiernodecanarias.org/tributos" target="_blank" className="text-xs text-orange-600 hover:underline flex items-center gap-0.5">
              Sede ATC <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>

      {/* Ficheros oficiales generados */}
      {officialFiles.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Ficheros oficiales generados</p>
            <span className="text-xs text-gray-400">{officialFiles.length} ficheros</span>
          </div>
          <div className="divide-y divide-gray-100">
            {officialFiles.slice(0, 10).map(f => (
              <div key={f.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center">
                    <FileText className="w-4 h-4 text-gray-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{f.nombreFichero}</p>
                    <p className="text-xs text-gray-400">{f.formato} · v{f.versionDiseno} · {f.administracion}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-gray-400">{f.hash?.slice(0, 12)}…</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    f.estado === 'presentado' ? 'bg-green-100 text-green-700' :
                    f.estado === 'descargado' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                  }`}>{f.estado}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Presentaciones */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Cargando…</div>
      ) : submissions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-gray-200 rounded-xl">
          <Send className="w-10 h-10 text-gray-300 mb-3" />
          <p className="text-sm font-medium text-gray-600 mb-1">No hay presentaciones registradas</p>
          <p className="text-xs text-gray-400 max-w-sm">
            Usa el botón <strong>Presentar</strong> en la tabla de períodos del Panel de Impuestos para iniciar el flujo de presentación.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Registro de presentaciones</p>
          </div>
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200">
              <tr>
                {['Modelo', 'Período', 'Vía', 'Importe', 'Fecha', 'Justificante', 'Estado', 'Acciones'].map(h => (
                  <th key={h} className="text-left py-2.5 px-3 text-xs font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {submissions.map((s, i) => {
                const cfg = ESTADO_CONFIG[s.estado] || ESTADO_CONFIG.pendiente;
                return (
                  <tr key={s.id} className={`border-b border-gray-100 hover:bg-gray-50 ${i === submissions.length - 1 ? 'border-0' : ''}`}>
                    <td className="py-3 px-3 font-bold text-primary">{s.modeloCodigo}</td>
                    <td className="py-3 px-3 text-gray-700">{s.periodo} {s.ejercicio}</td>
                    <td className="py-3 px-3 text-xs text-gray-500">{VIA_LABELS[s.viaPresentacion] || s.viaPresentacion}</td>
                    <td className="py-3 px-3 font-medium text-gray-800">{s.importeFinal != null ? `${s.importeFinal.toFixed(2)} €` : '—'}</td>
                    <td className="py-3 px-3 text-xs text-gray-400">{s.fechaEnvio ? new Date(s.fechaEnvio).toLocaleDateString('es-ES') : '—'}</td>
                    <td className="py-3 px-3 text-xs">
                      {s.numeroJustificante ? (
                        <span className="font-mono">{s.numeroJustificante}</span>
                      ) : s.justificantePdfUrl ? (
                        <a href={s.justificantePdfUrl} target="_blank" className="text-blue-600 hover:underline flex items-center gap-1">
                          <FileDown className="w-3 h-3" /> PDF
                        </a>
                      ) : (
                        <span className="text-gray-300">Pendiente</span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>{cfg.label}</span>
                    </td>
                    <td className="py-3 px-3">
                      {!s.justificantePdfUrl && s.estado !== 'presentado' && (
                        <label className="cursor-pointer">
                          <input type="file" accept="application/pdf" className="hidden"
                            onChange={e => e.target.files[0] && handleJustificanteUpload(s.id, e.target.files[0])} />
                          <span className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1">
                            {uploadingId === s.id ? 'Subiendo…' : <><Upload className="w-3 h-3" /> Justificante</>}
                          </span>
                        </label>
                      )}
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