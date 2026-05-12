import { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Briefcase, Plus, Search, X, User, Mail, Star, ChevronRight } from 'lucide-react';

const STAGES = ['aplicado', 'screening', 'entrevista_rrhh', 'entrevista_tecnica', 'oferta', 'contratado', 'descartado'];
const STAGE_LABELS = { aplicado: 'Aplicado', screening: 'Screening', entrevista_rrhh: 'Entrevista RRHH', entrevista_tecnica: 'Entrevista Técnica', oferta: 'Oferta', contratado: 'Contratado', descartado: 'Descartado' };
const STAGE_COLORS = { aplicado: 'bg-slate-100 text-slate-600', screening: 'bg-blue-50 text-blue-600', entrevista_rrhh: 'bg-violet-50 text-violet-600', entrevista_tecnica: 'bg-indigo-50 text-indigo-600', oferta: 'bg-amber-50 text-amber-700', contratado: 'bg-emerald-50 text-emerald-700', descartado: 'bg-red-50 text-red-600' };

export default function Recruiting() {
  const ctx = useOutletContext() || {};
  const { company } = ctx;
  const companyId = company?.id;
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ nombre: '', apellidos: '', email: '', cargo_aplicado: '', departamento: '' });

  const load = async () => {
    if (!companyId) { setLoading(false); return; }
    setLoading(true);
    const data = await base44.entities.HRCandidate.filter({ company_id: companyId }, '-created_date', 200);
    setCandidates(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [companyId]);

  const addCandidate = async () => {
    if (!form.nombre || !form.email) return;
    await base44.entities.HRCandidate.create({ ...form, company_id: companyId, etapa: 'aplicado' });
    setShowForm(false);
    setForm({ nombre: '', apellidos: '', email: '', cargo_aplicado: '', departamento: '' });
    load();
  };

  const moveStage = async (id, stage) => {
    await base44.entities.HRCandidate.update(id, { etapa: stage });
    load();
  };

  const pipeline = STAGES.filter(s => s !== 'descartado');
  const pipelineCounts = pipeline.map(s => ({ stage: s, count: candidates.filter(c => c.etapa === s).length }));

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-pink-50 border border-pink-100 flex items-center justify-center">
            <Briefcase className="w-5 h-5 text-pink-600" />
          </div>
          <div>
            <h2 className="text-xl font-jakarta font-bold text-foreground">Recruiting</h2>
            <p className="text-sm text-slate-400">{candidates.length} candidatos · Pipeline de contratación</p>
          </div>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-taxea-red text-white hover:bg-taxea-red/90 transition-all shadow-sm self-start sm:self-auto">
          <Plus className="w-4 h-4" /> Añadir candidato
        </button>
      </div>

      {/* Pipeline visual */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {pipelineCounts.map((p, i) => (
          <div key={p.stage} className="flex items-center gap-2">
            <div className={cn("px-4 py-2 rounded-xl text-center min-w-[100px]", STAGE_COLORS[p.stage])}>
              <p className="text-[10px] font-semibold uppercase tracking-wider">{STAGE_LABELS[p.stage]}</p>
              <p className="text-lg font-jakarta font-bold">{p.count}</p>
            </div>
            {i < pipelineCounts.length - 1 && <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />}
          </div>
        ))}
      </div>

      {/* Candidate list */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
        {candidates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-300 gap-2">
            <Briefcase className="w-12 h-12" />
            <p className="text-sm text-slate-400">Sin candidatos. Añade el primero.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {candidates.map(c => (
              <div key={c.id} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50/50 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-600 flex-shrink-0">
                  {c.nombre?.[0]}{c.apellidos?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{c.nombre} {c.apellidos}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-xs text-slate-400">{c.cargo_aplicado || '—'}</span>
                    <span className="text-xs text-slate-400 flex items-center gap-1"><Mail className="w-3 h-3" />{c.email}</span>
                    {c.score_ia > 0 && <span className="text-xs text-amber-500 flex items-center gap-0.5"><Star className="w-3 h-3" />{c.score_ia}</span>}
                  </div>
                </div>
                <select value={c.etapa} onChange={e => moveStage(c.id, e.target.value)}
                  className={cn("text-[11px] font-semibold px-2 py-1 rounded-full border cursor-pointer", STAGE_COLORS[c.etapa])}>
                  {STAGES.map(s => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
                </select>
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="text-base font-semibold text-foreground">Nuevo candidato</p>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            {[
              { label: 'Nombre *', key: 'nombre' }, { label: 'Apellidos', key: 'apellidos' },
              { label: 'Email *', key: 'email', type: 'email' }, { label: 'Cargo aplicado', key: 'cargo_aplicado' },
              { label: 'Departamento', key: 'departamento' },
            ].map(f => (
              <div key={f.key}>
                <label className="text-xs font-medium text-slate-500 mb-1 block">{f.label}</label>
                <input type={f.type || 'text'} value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-200" />
              </div>
            ))}
            <button onClick={addCandidate} className="w-full py-2.5 rounded-xl text-sm font-semibold bg-taxea-red text-white hover:bg-taxea-red/90 transition-all shadow-sm">
              Añadir candidato
            </button>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}