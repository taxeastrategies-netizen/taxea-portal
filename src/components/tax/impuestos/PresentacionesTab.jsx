import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, ArrowRight, ExternalLink, FileCheck2, FileDown, FileText, Loader2, RefreshCw, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useCompanyContext } from '@/lib/useCompanyContext';
import { FILING_STATUS, formatDate, formatMoney, statusPill, taxWorkspaceKey, useTaxWorkspace } from './useTaxWorkspace';

const AUTHORITY_URL = {
  AEAT: 'https://sede.agenciatributaria.gob.es/Sede/irpf/declaraciones-presentadas/consulta-declaraciones-presentadas.html',
  ATC: 'https://www3.gobiernodecanarias.org/tributos/atc/c%C3%B3mo-presentar-los-modelos',
};

function apiErrorMessage(error, fallback = '') {
  const detail = /** @type {any} */ (error);
  return detail?.response?.data?.error || detail?.message || fallback;
}

function EvidenceEditor({ filing, companyId, onSaved, onCancel }) {
  const [form, setForm] = useState({ numeroJustificante: filing.numeroJustificante || '', csv: filing.csv || '', respuestaAdministracion: filing.respuestaAdministracion || '', confirmed: false });
  const [file, setFile] = useState(/** @type {File | null} */ (null));
  const [error, setError] = useState('');
  const save = useMutation({
    mutationFn: async () => {
      let justificantePdfUrl = '';
      if (file) justificantePdfUrl = (await base44.integrations.Core.UploadFile({ file })).file_url;
      return (await base44.functions.invoke('taxModelOperations', { action: 'attach_filing_evidence', companyId, filingId: filing.id, numeroJustificante: form.numeroJustificante, csv: form.csv, respuestaAdministracion: form.respuestaAdministracion, justificantePdfUrl, confirmEvidence: form.confirmed })).data;
    },
    onSuccess: onSaved,
    onError: err => setError(apiErrorMessage(err, 'No se pudo guardar la evidencia.')),
  });
  return <div className="mt-4 rounded-xl border border-cyan-200 bg-cyan-50/50 p-4">
    <h4 className="text-sm font-semibold text-slate-800">Acreditar o completar la presentación</h4><p className="mt-1 text-xs text-slate-600">Solo se añaden metadatos y documentos de evidencia. Las casillas y el resultado del snapshot quedan intactos.</p>
    <div className="mt-3 grid gap-3 md:grid-cols-2"><label className="text-xs text-slate-600">Número de justificante<input value={form.numeroJustificante} onChange={event => setForm(current => ({ ...current, numeroJustificante: event.target.value, confirmed: false }))} className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm" /></label><label className="text-xs text-slate-600">Código seguro de verificación<input value={form.csv} onChange={event => setForm(current => ({ ...current, csv: event.target.value, confirmed: false }))} className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm" /></label><label className="text-xs text-slate-600 md:col-span-2">Respuesta o referencia administrativa<input value={form.respuestaAdministracion} onChange={event => setForm(current => ({ ...current, respuestaAdministracion: event.target.value, confirmed: false }))} className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm" /></label><label className="cursor-pointer rounded-lg border border-dashed border-cyan-300 bg-white p-3 text-center text-xs text-cyan-800 md:col-span-2"><input type="file" accept="application/pdf,.pdf" className="hidden" onChange={event => { setFile(event.target.files?.[0] || null); setForm(current => ({ ...current, confirmed: false })); }} />{file ? file.name : 'Seleccionar justificante PDF'}</label></div>
    <label className="mt-3 flex items-start gap-2 text-xs text-slate-700"><input type="checkbox" checked={form.confirmed} onChange={event => setForm(current => ({ ...current, confirmed: event.target.checked }))} className="mt-0.5" /><span>Confirmo que estos datos corresponden a la presentación oficial del modelo {filing.modeloCodigo}, {filing.periodo} {filing.ejercicio}.</span></label>
    {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    <div className="mt-3 flex justify-end gap-2"><Button size="sm" variant="ghost" onClick={onCancel}>Cancelar</Button><Button size="sm" onClick={() => save.mutate()} disabled={!form.confirmed || save.isPending}>{save.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1 h-3.5 w-3.5" />}Guardar evidencia</Button></div>
  </div>;
}

function Metric({ label, value, tone = 'slate' }) {
  const colors = { slate: 'text-slate-900', amber: 'text-amber-700', red: 'text-red-700', emerald: 'text-emerald-700' };
  return <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">{label}</p><p className={`mt-1 text-2xl font-bold ${colors[tone]}`}>{value}</p></div>;
}

export default function PresentacionesTab({ onOpenModel }) {
  const { user } = useAuth();
  const { company } = useCompanyContext(user);
  const companyId = company?.id;
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [allVersions, setAllVersions] = useState(false);
  const [evidenceId, setEvidenceId] = useState(null);
  const [downloadError, setDownloadError] = useState('');
  const queryClient = useQueryClient();
  const workspace = useTaxWorkspace(companyId, year);
  const filings = useMemo(() => [...(allVersions ? workspace.data?.filings || [] : workspace.data?.latestFilings || [])].sort((a, b) => new Date(b.fechaPresentacion || b.fechaImportacion || 0).getTime() - new Date(a.fechaPresentacion || a.fechaImportacion || 0).getTime()), [workspace.data, allVersions]);
  const officialFiles = workspace.data?.officialFiles || [];
  const artifactDownload = useMutation({
    mutationFn: async (/** @type {any} */ file) => (await base44.functions.invoke('taxModelOperations', { action: 'download_official_file', companyId, fileId: file.id })).data,
    onSuccess: data => {
      setDownloadError('');
      const bytes = Uint8Array.from(atob(data.file.contentBase64), char => char.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }));
      const link = document.createElement('a'); link.href = url; link.download = data.file.filename; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
    onError: error => setDownloadError(apiErrorMessage(error, 'No se pudo recuperar el fichero.')),
  });
  const legacyPending = (workspace.data?.legacySubmissions || []).filter(item => !item.incorporadoAlHistorico);

  if (!companyId) return <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">Selecciona una empresa.</div>;

  const evidenceComplete = (workspace.data?.latestFilings || []).filter(item => item.numeroJustificante || item.csv || item.justificantePdfUrl || item.ficheroPresentadoUrl).length;
  const corrections = (workspace.data?.filings || []).filter(item => item.tipoDeclaracion !== 'original').length;
  const paid = (workspace.data?.latestFilings || []).reduce((sum, item) => sum + Math.max(0, Number(item.importeFinal) || 0), 0);
  const refresh = async () => { setEvidenceId(null); await queryClient.invalidateQueries({ queryKey: taxWorkspaceKey(companyId, year) }); };

  return <div className="mx-auto max-w-6xl space-y-5">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><h2 className="text-base font-semibold text-slate-900">Presentaciones acreditadas</h2><p className="mt-1 text-sm text-slate-500">Fuente única: snapshots de modelos realmente presentados e importados. Generar o descargar un fichero no equivale a presentarlo.</p></div><div className="flex flex-wrap gap-2"><select value={year} onChange={event => setYear(Number(event.target.value))} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm">{[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map(value => <option key={value}>{value}</option>)}</select><Button variant="outline" className="gap-2" onClick={() => workspace.refetch()} disabled={workspace.isFetching}><RefreshCw className={`h-4 w-4 ${workspace.isFetching ? 'animate-spin' : ''}`} />Actualizar</Button></div></div>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Periodos presentados" value={(workspace.data?.latestFilings || []).length} tone="emerald" /><Metric label="Con evidencia" value={evidenceComplete} tone={evidenceComplete === (workspace.data?.latestFilings || []).length ? 'emerald' : 'amber'} /><Metric label="Correcciones versionadas" value={corrections} /><Metric label="Resultado positivo acumulado" value={formatMoney(paid)} tone="red" /></div>

    <div className="grid gap-3 lg:grid-cols-2"><a href={AUTHORITY_URL.AEAT} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 hover:bg-blue-100"><span><strong>AEAT</strong><span className="mt-1 block text-xs">Consulta, cotejo y presentación en la sede oficial.</span></span><ExternalLink className="h-4 w-4" /></a><a href={AUTHORITY_URL.ATC} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-900 hover:bg-orange-100"><span><strong>Agencia Tributaria Canaria</strong><span className="mt-1 block text-xs">Presentación telemática mediante sede o programa de ayuda.</span></span><ExternalLink className="h-4 w-4" /></a></div>

    {legacyPending.length > 0 && <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" /><div className="flex-1"><p className="text-sm font-semibold text-amber-900">{legacyPending.length} presentación(es) antiguas sin casillas incorporadas</p><p className="mt-1 text-xs leading-5 text-amber-800">Se conservan, pero no alimentan arrastres. Importa la declaración oficial desde “Modelos y periodos” para convertirla en snapshot fiscal utilizable.</p></div></div>}

    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600"><span>La vista principal enseña la última declaración efectiva de cada periodo.</span><label className="flex items-center gap-2"><input type="checkbox" checked={allVersions} onChange={event => setAllVersions(event.target.checked)} />Ver originales y rectificativas anteriores</label></div>

    {workspace.isLoading ? <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-cyan-600" /></div>
      : workspace.isError ? <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{apiErrorMessage(workspace.error, 'No se pudieron cargar las presentaciones.')}</div>
      : filings.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center"><FileCheck2 className="mx-auto h-10 w-10 text-slate-300" /><p className="mt-3 text-sm font-semibold text-slate-700">No hay presentaciones acreditadas en {year}</p><p className="mx-auto mt-1 max-w-lg text-xs leading-5 text-slate-500">Si el modelo se presentó fuera de Taxea, impórtalo desde “Modelos y periodos”. No se marcará como presentado solo por generar un borrador o fichero.</p></div>
      : <div className="space-y-3">{filings.map(filing => {
        const status = statusPill(FILING_STATUS[filing.estadoPresentacion], filing.estadoPresentacion);
        const hasEvidence = filing.numeroJustificante || filing.csv || filing.justificantePdfUrl || filing.ficheroPresentadoUrl;
        return <article key={filing.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between"><div className="flex gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-sm font-bold text-emerald-800">{filing.modeloCodigo}</div><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-slate-900">Modelo {filing.modeloCodigo} · {filing.periodo} {filing.ejercicio}</h3><span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${status.className}`}>{status.label}</span><span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] text-violet-700">{filing.tipoDeclaracion} · v{filing.snapshotVersion}</span></div><p className="mt-1 text-xs text-slate-500">Presentado {formatDate(filing.fechaPresentacion)} · incorporado {formatDate(filing.fechaImportacion, true)} · {filing.via.replace(/_/g, ' ')}</p><p className="mt-1 font-mono text-[11px] text-slate-400">Snapshot {filing.snapshotHash || filing.hashFicheroImportado || 'sin huella histórica'}</p></div></div><div className="xl:text-right"><p className="text-xs text-slate-500">Resultado presentado</p><p className={`text-xl font-bold ${filing.importeFinal > 0 ? 'text-red-600' : filing.importeFinal < 0 ? 'text-emerald-700' : 'text-slate-700'}`}>{formatMoney(filing.importeFinal)}</p><p className="text-[11px] text-slate-400">{filing.resultadoDestino?.replace(/_/g, ' ') || 'destino no informado'}</p></div></div>
          <div className="mt-4 grid gap-2 text-xs md:grid-cols-3"><div className={`rounded-lg border p-3 ${hasEvidence ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}><p className="font-semibold">{hasEvidence ? 'Evidencia asociada' : 'Evidencia pendiente'}</p><p className="mt-1 text-slate-600">{filing.numeroJustificante ? `Justificante ${filing.numeroJustificante}` : filing.csv ? `CSV ${filing.csv}` : filing.justificantePdfUrl || filing.ficheroPresentadoUrl ? 'Documento disponible' : 'Añade justificante, CSV o PDF.'}</p></div><div className="rounded-lg border border-slate-200 bg-slate-50 p-3"><p className="font-semibold">Revisión de importación</p><p className="mt-1 text-slate-600">{filing.revisionImportacion.replace(/_/g, ' ')}</p></div><div className="rounded-lg border border-slate-200 bg-slate-50 p-3"><p className="font-semibold">Cadena de corrección</p><p className="mt-1 text-slate-600">{filing.declaracionAnteriorId ? 'Enlazada a la versión anterior' : 'Declaración de origen'}</p></div></div>
          <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4"><Button size="sm" variant="outline" onClick={() => onOpenModel?.({ modelCode: filing.modeloCodigo, year: filing.ejercicio, period: filing.periodo })}>Comparar con contabilidad <ArrowRight className="ml-1 h-3.5 w-3.5" /></Button><Button size="sm" variant="outline" onClick={() => setEvidenceId(evidenceId === filing.id ? null : filing.id)}><Upload className="mr-1 h-3.5 w-3.5" />{hasEvidence ? 'Completar evidencia' : 'Añadir evidencia'}</Button>{filing.justificantePdfUrl && <a href={filing.justificantePdfUrl} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center rounded-md px-3 text-xs font-medium text-cyan-700 hover:bg-cyan-50"><FileDown className="mr-1 h-3.5 w-3.5" />Justificante PDF</a>}{filing.ficheroPresentadoUrl && <a href={filing.ficheroPresentadoUrl} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center rounded-md px-3 text-xs font-medium text-cyan-700 hover:bg-cyan-50"><FileText className="mr-1 h-3.5 w-3.5" />Fichero presentado</a>}</div>
          {evidenceId === filing.id && <EvidenceEditor filing={filing} companyId={companyId} onSaved={refresh} onCancel={() => setEvidenceId(null)} />}
        </article>;
      })}</div>}

    <section className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex items-center justify-between"><div><h3 className="text-sm font-semibold text-slate-900">Ficheros generados</h3><p className="mt-1 text-xs text-slate-500">Trazabilidad de exportaciones. Su estado nunca convierte por sí solo el periodo en presentado.</p></div><span className="text-xs text-slate-400">{officialFiles.length} registros</span></div>{downloadError && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">{downloadError}</p>}{officialFiles.length === 0 ? <p className="mt-4 rounded-lg bg-slate-50 p-4 text-xs text-slate-500">No se generaron ficheros en {year}.</p> : <div className="mt-4 divide-y divide-slate-100">{officialFiles.map(file => <div key={file.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-medium text-slate-800">{file.nombreFichero || `Modelo ${file.modeloCodigo}`}</p><p className="text-xs text-slate-500">Modelo {file.modeloCodigo} · {file.periodo} {file.ejercicio} · {file.formato} · {file.estado}{file.immutable ? ' · inmutable' : ''}</p></div><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-[10px] text-slate-400">{file.hash?.slice(0, 16)}…</span>{file.hasStoredContent && <Button size="sm" variant="outline" onClick={() => artifactDownload.mutate(file)} disabled={artifactDownload.isPending}><FileDown className="mr-1 h-3.5 w-3.5" />Re-descargar exacto</Button>}{file.fileUrl && <a href={file.fileUrl} target="_blank" rel="noreferrer" className="text-xs font-medium text-cyan-700">Abrir archivo</a>}<Button size="sm" variant="ghost" onClick={() => onOpenModel?.({ modelCode: file.modeloCodigo, year: file.ejercicio, period: file.periodo })}>Abrir modelo <ArrowRight className="ml-1 h-3.5 w-3.5" /></Button></div></div>)}</div>}</section>
  </div>;
}
