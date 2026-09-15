import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileCheck2, FileWarning, Loader2, Upload } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';
import { formatDate, isReviewer } from './useTaxWorkspace';

const key = (companyId, year) => ['tax-importer-evidence', companyId, Number(year)];
const eligible = file => file.hasStoredContent && /^[a-f0-9]{64}$/i.test(file.hash || '')
  && !/traspaso revisable|borrador técnico de revisión/i.test(file.formato || '');

export default function ImporterCertificationPanel({ companyId, year, officialFiles }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState('');
  const [form, setForm] = useState({ resultado: 'aceptado', fechaPrueba: new Date().toISOString().slice(0, 10), respuestaImportador: '', confirmed: false });
  const [proof, setProof] = useState(null);
  const [error, setError] = useState('');
  const [reviewConfirmId, setReviewConfirmId] = useState('');
  const files = useMemo(() => (officialFiles || []).filter(eligible), [officialFiles]);
  const evidence = useQuery({
    queryKey: key(companyId, year),
    queryFn: async () => (await base44.functions.invoke('taxImporterCertification', { action: 'list', companyId, ejercicio: Number(year) })).data,
    enabled: Boolean(companyId && year),
    staleTime: 20_000,
  });
  const refresh = async () => { await queryClient.invalidateQueries({ queryKey: key(companyId, year) }); setSelectedId(''); setProof(null); };
  const save = useMutation({
    mutationFn: async () => {
      if (!proof) throw new Error('Adjunta una respuesta o captura de la validación oficial.');
      const upload = await base44.integrations.Core.UploadFile({ file: proof });
      const evidenceUrl = upload?.file_url;
      if (!evidenceUrl) throw new Error('No se obtuvo la URL de la evidencia.');
      return (await base44.functions.invoke('taxImporterCertification', {
        action: 'record', companyId, fileId: selectedId, resultado: form.resultado,
        fechaPrueba: new Date(form.fechaPrueba + 'T12:00:00Z').toISOString(),
        respuestaImportador: form.respuestaImportador, evidenceUrl, confirmation: form.confirmed,
      })).data;
    },
    onSuccess: refresh,
    onError: err => setError((/** @type {any} */ (err))?.response?.data?.error || err?.message || 'No se pudo registrar la prueba.'),
  });
  const review = useMutation({
    mutationFn: async (/** @type {string} */ recordId) => (await base44.functions.invoke('taxImporterCertification', {
      action: 'review', companyId, recordId, confirmation: reviewConfirmId === recordId,
    })).data,
    onSuccess: async () => { setReviewConfirmId(''); await queryClient.invalidateQueries({ queryKey: key(companyId, year) }); },
    onError: err => setError((/** @type {any} */ (err))?.response?.data?.error || err?.message || 'No se pudo revisar la evidencia.'),
  });
  const rows = evidence.data?.rows || [];
  const latest = new Map();
  for (const item of rows) if (!latest.has(item.taxOfficialFileId)) latest.set(item.taxOfficialFileId, item);
  const pending = files.filter(file => !latest.has(file.id)).length;
  return <section className="rounded-2xl border border-cyan-200 bg-white p-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-sm font-semibold text-slate-900">Certificación del importador oficial</h3><p className="mt-1 max-w-3xl text-xs leading-5 text-slate-600">La prueba queda enlazada al fichero exacto, su SHA-256 y versión de diseño. Aceptación de importación no es presentación. Los paquetes de traspaso guiado no se certifican como ficheros oficiales.</p></div><div className="rounded-full bg-cyan-50 px-3 py-1 text-xs text-cyan-800">{pending} fichero(s) sin prueba</div></div>
    {error && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</p>}
    {evidence.isError && <p className="mt-3 text-xs text-red-700">No se pudieron consultar las evidencias. No se presume aceptación.</p>}
    {evidence.isLoading && <Loader2 className="mt-4 h-5 w-5 animate-spin text-cyan-700" />}
    {files.length === 0 ? <p className="mt-4 rounded-lg bg-slate-50 p-4 text-xs text-slate-500">No hay ficheros oficiales exactos del ejercicio con contenido y SHA-256 conservados.</p> :
      <div className="mt-4 divide-y divide-slate-100">{files.map(file => {
        const last = latest.get(file.id);
        return <div key={file.id} className="py-3">
          <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-sm font-medium text-slate-800">{file.nombreFichero}</p><p className="mt-1 text-xs text-slate-500">Modelo {file.modeloCodigo} · {file.periodo} {file.ejercicio} · {file.administracion} · diseño {file.versionDiseno || 'no informado'}</p><p className="mt-1 break-all font-mono text-[10px] text-slate-500">SHA-256 {file.hash}</p></div><div className="flex items-center gap-2">{last ? <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] ${last.resultado === 'aceptado' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>{last.resultado === 'aceptado' ? <FileCheck2 className="h-3.5 w-3.5" /> : <FileWarning className="h-3.5 w-3.5" />}{last.resultado === 'aceptado' ? 'Importación aceptada' : 'Importación rechazada'} · {last.revisionAsesor === 'revisada' ? 'revisada' : 'sin revisión'}</span> : <span className="text-xs text-amber-700">Sin prueba oficial</span>}<Button size="sm" variant="outline" onClick={() => { setSelectedId(selectedId === file.id ? '' : file.id); setError(''); }}>Registrar prueba</Button></div></div>
          {last && <div className="mt-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-600"><p>Prueba {formatDate(last.fechaPrueba)} · registrada {formatDate(last.fechaRegistro, true)} por {last.registradoPor}</p><p className="mt-1 whitespace-pre-wrap">{last.respuestaImportador}</p><a href={last.evidenceUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block font-medium text-cyan-700">Ver respuesta/captura adjunta</a>{isReviewer(user) && last.revisionAsesor !== 'revisada' && <div className="mt-2 flex flex-wrap items-center gap-2"><label className="flex items-center gap-1"><input type="checkbox" checked={reviewConfirmId === last.id} onChange={event => setReviewConfirmId(event.target.checked ? last.id : '')} />He cotejado la evidencia</label><Button size="sm" variant="outline" disabled={reviewConfirmId !== last.id || review.isPending} onClick={() => review.mutate(last.id)}>Marcar revisada</Button></div>}</div>}
          {selectedId === file.id && <div className="mt-3 grid gap-3 rounded-xl border border-cyan-200 bg-cyan-50/40 p-4 md:grid-cols-2"><label className="text-xs text-slate-700">Resultado del importador<select value={form.resultado} onChange={event => setForm(current => ({ ...current, resultado: event.target.value, confirmed: false }))} className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3"><option value="aceptado">Aceptado</option><option value="rechazado">Rechazado</option></select></label><label className="text-xs text-slate-700">Fecha de la prueba<input type="date" value={form.fechaPrueba} onChange={event => setForm(current => ({ ...current, fechaPrueba: event.target.value, confirmed: false }))} className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3" /></label><label className="text-xs text-slate-700 md:col-span-2">Respuesta literal o referencia del importador<textarea value={form.respuestaImportador} onChange={event => setForm(current => ({ ...current, respuestaImportador: event.target.value, confirmed: false }))} rows={3} className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2" /></label><label className="text-xs text-slate-700 md:col-span-2">Captura o PDF de la respuesta<input type="file" accept="image/png,image/jpeg,application/pdf,.png,.jpg,.jpeg,.pdf" onChange={event => { setProof(event.target.files?.[0] || null); setForm(current => ({ ...current, confirmed: false })); }} className="mt-1 block w-full text-xs" /></label><label className="flex items-start gap-2 text-xs text-slate-700 md:col-span-2"><input type="checkbox" checked={form.confirmed} onChange={event => setForm(current => ({ ...current, confirmed: event.target.checked }))} /><span>Confirmo que la respuesta y la captura pertenecen a este fichero SHA-256, no a otro borrador ni a una presentación.</span></label><div className="md:col-span-2 flex justify-end"><Button size="sm" disabled={!form.confirmed || !proof || form.respuestaImportador.trim().length < 8 || save.isPending} onClick={() => save.mutate()}>{save.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1 h-3.5 w-3.5" />}Guardar prueba</Button></div></div>}
        </div>;
      })}</div>}
  </section>;
}
