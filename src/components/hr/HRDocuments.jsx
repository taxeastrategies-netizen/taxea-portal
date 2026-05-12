import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { FileText, Upload, Search, Filter, File, CheckCircle2, Clock, AlertTriangle, X, Plus, ExternalLink } from 'lucide-react';

const TYPE_LABELS = { contrato: 'Contrato', nomina: 'Nómina', dni: 'DNI', certificado: 'Certificado', convenio: 'Convenio', anexo: 'Anexo', prl: 'PRL', formacion: 'Formación', otro: 'Otro' };
const SIGN_STATUS = { sin_firma: { label: 'Sin firma', cls: 'bg-slate-50 text-slate-500 border-slate-200' }, pendiente_firma: { label: 'Pendiente firma', cls: 'bg-amber-50 text-amber-700 border-amber-200' }, firmado: { label: 'Firmado', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' }, rechazado: { label: 'Rechazado', cls: 'bg-red-50 text-red-700 border-red-200' }, expirado: { label: 'Expirado', cls: 'bg-orange-50 text-orange-700 border-orange-200' } };

export default function HRDocuments() {
  const ctx = useOutletContext() || {};
  const { company } = ctx;
  const companyId = company?.id;
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [form, setForm] = useState({ nombre: '', tipo: 'contrato', employee_id: '' });
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    if (!companyId) { setLoading(false); return; }
    setLoading(true);
    const data = await base44.entities.HRDocument.filter({ company_id: companyId }, '-created_date', 200);
    setDocs(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [companyId]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    await base44.entities.HRDocument.create({ company_id: companyId, nombre: form.nombre || file.name, tipo: form.tipo, archivo_url: file_url, employee_id: form.employee_id });
    setUploading(false);
    setShowUpload(false);
    setForm({ nombre: '', tipo: 'contrato', employee_id: '' });
    load();
  };

  const filtered = docs.filter(d => {
    const q = search.toLowerCase();
    const matchQ = !q || `${d.nombre} ${d.employee_id}`.toLowerCase().includes(q);
    const matchT = !typeFilter || d.tipo === typeFilter;
    return matchQ && matchT;
  });

  const byType = Object.entries(TYPE_LABELS).map(([k, v]) => ({ tipo: k, label: v, count: docs.filter(d => d.tipo === k).length })).filter(t => t.count > 0);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-violet-50 border border-violet-100 flex items-center justify-center">
            <FileText className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <h2 className="text-xl font-jakarta font-bold text-foreground">Documents & Signatures</h2>
            <p className="text-sm text-slate-400">{docs.length} documentos · Gestión documental y firma digital</p>
          </div>
        </div>
        <button onClick={() => setShowUpload(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-taxea-red text-white hover:bg-taxea-red/90 transition-all shadow-sm self-start sm:self-auto">
          <Upload className="w-4 h-4" /> Subir documento
        </button>
      </div>

      {/* Type breakdown */}
      {byType.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setTypeFilter('')}
            className={cn("px-3 py-1.5 rounded-full text-xs font-medium border transition-all", !typeFilter ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300')}>
            Todos ({docs.length})
          </button>
          {byType.map(t => (
            <button key={t.tipo} onClick={() => setTypeFilter(t.tipo === typeFilter ? '' : t.tipo)}
              className={cn("px-3 py-1.5 rounded-full text-xs font-medium border transition-all", typeFilter === t.tipo ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300')}>
              {t.label} ({t.count})
            </button>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar documento…"
          className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-200 bg-white" />
      </div>

      {/* Document list */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-300 gap-2">
            <File className="w-12 h-12" />
            <p className="text-sm text-slate-400">{search || typeFilter ? 'Sin resultados.' : 'Sube el primer documento.'}</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {filtered.map(d => {
              const ss = SIGN_STATUS[d.estado_firma] || SIGN_STATUS.sin_firma;
              return (
                <div key={d.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50/50 transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5 text-slate-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{d.nombre}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-slate-400">{TYPE_LABELS[d.tipo] || d.tipo}</span>
                      {d.employee_id && <><span className="text-slate-200">·</span><span className="text-xs text-slate-400">{d.employee_id}</span></>}
                    </div>
                  </div>
                  <span className={cn("text-[11px] font-semibold px-2 py-1 rounded-full border", ss.cls)}>{ss.label}</span>
                  {d.archivo_url && (
                    <a href={d.archivo_url} target="_blank" rel="noopener noreferrer"
                      className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Upload modal */}
      {showUpload && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowUpload(false)}>
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="text-base font-semibold text-foreground">Subir documento</p>
              <button onClick={() => setShowUpload(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Nombre</label>
              <input value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} placeholder="Nombre del documento"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-200" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Tipo</label>
              <select value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-200">
                {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Archivo</label>
              <input type="file" onChange={handleUpload} disabled={uploading}
                className="w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-violet-50 file:text-violet-600 hover:file:bg-violet-100" />
              {uploading && <p className="text-xs text-violet-500 mt-1 animate-pulse">Subiendo…</p>}
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}