import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useOutletContext } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  Scale, Calculator, Briefcase, TrendingUp, Brain, FileText,
  Shield, Gavel, Building2, BookOpen, ChevronRight, Sparkles,
  AlertTriangle, Clock, CheckCircle2, Circle
} from 'lucide-react';

const SUBDEPTS = [
  {
    id: 'tax',
    label: 'Tax Law',
    subtitle: 'Derecho Tributario & Fiscal',
    description: 'Litigación fiscal, inspecciones AEAT, compliance tributario, DGT, TEAC, TEAR, IA tributaria.',
    icon: Calculator,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    border: 'border-amber-100',
    gradient: 'from-amber-500 to-orange-600',
    modules: ['Tax Dashboard', 'Tax Compliance', 'Tax Litigation', 'Inspections', 'DGT & Rulings', 'TEAC/TEAR', 'Tax AI'],
    path: '/law/tax/dashboard',
  },
  {
    id: 'business',
    label: 'Business Law',
    subtitle: 'Derecho Empresarial & Societario',
    description: 'Contratos, societario, compliance, firmas, documentos, poderes, libros corporativos, IA jurídica.',
    icon: Briefcase,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-100',
    gradient: 'from-blue-600 to-indigo-700',
    modules: ['Legal Dashboard', 'Contracts', 'Corporate', 'Compliance', 'Signatures', 'Documents', 'Legal AI'],
    path: '/law/business/dashboard',
  },
  {
    id: 'ma',
    label: 'M&A Center',
    subtitle: 'Fusiones, Adquisiciones & Corporate Finance',
    description: 'Deal pipeline, due diligence, data rooms, valoraciones, SPA, SHA, IA M&A enterprise.',
    icon: TrendingUp,
    color: 'text-violet-600',
    bg: 'bg-violet-50',
    border: 'border-violet-100',
    gradient: 'from-violet-600 to-purple-700',
    modules: ['M&A Dashboard', 'Deal Pipeline', 'Due Diligence', 'Data Rooms', 'Valuation', 'SPA Docs', 'M&A AI'],
    path: '/law/ma/dashboard',
  },
];

const QUICK_STATS = [
  { label: 'Módulos legales', value: '30+', icon: BookOpen },
  { label: 'IA especializada', value: '3 AIs', icon: Brain },
  { label: 'Fuentes jurídicas', value: 'BOE · DGT · CENDOJ', icon: Scale },
  { label: 'Deal intelligence', value: 'M&A grade', icon: TrendingUp },
];

export default function LawHome() {
  const navigate = useNavigate();
  const ctx = useOutletContext() || {};
  const { company } = ctx;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8 pb-12">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 text-white shadow-2xl">
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, #7c3aed 0%, transparent 50%), radial-gradient(circle at 80% 20%, #2563eb 0%, transparent 50%)' }} />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center">
              <Scale className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-slate-400 text-xs uppercase tracking-widest font-semibold">Taxea Business OS</p>
              <h1 className="text-2xl font-jakarta font-bold">LAW — Legal Operating System</h1>
            </div>
          </div>
          <p className="text-slate-300 text-sm max-w-2xl leading-relaxed">
            La infraestructura legal centralizada de tu empresa. Contratos, societario, compliance, fiscalidad, litigación, M&A y jurisprudencia IA — todo en un solo ecosistema enterprise.
          </p>
          <div className="flex flex-wrap gap-2 mt-5">
            {['Harvey AI', 'Ironclad', 'vLex', 'Lefebvre', 'Clio', 'iManage'].map(t => (
              <span key={t} className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-white/8 text-slate-400 border border-white/10 uppercase tracking-wider">{t}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {QUICK_STATS.map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
              className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm text-center">
              <Icon className="w-5 h-5 text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-bold text-foreground">{s.value}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">{s.label}</p>
            </motion.div>
          );
        })}
      </div>

      {/* Subdepartments */}
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">Selecciona el área jurídica</p>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {SUBDEPTS.map((dept, i) => {
            const Icon = dept.icon;
            return (
              <motion.div key={dept.id}
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                onClick={() => navigate(dept.path)}
                className="group cursor-pointer bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                <div className={cn("h-2 bg-gradient-to-r", dept.gradient)} />
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", dept.bg, dept.border, "border")}>
                      <Icon className={cn("w-6 h-6", dept.color)} />
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-1 transition-all mt-1" />
                  </div>
                  <h3 className="text-lg font-jakarta font-bold text-foreground">{dept.label}</h3>
                  <p className={cn("text-xs font-semibold mt-0.5", dept.color)}>{dept.subtitle}</p>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">{dept.description}</p>
                  <div className="flex flex-wrap gap-1.5 mt-4">
                    {dept.modules.map(m => (
                      <span key={m} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-50 text-slate-500 border border-slate-100">
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Knowledge Engine CTA */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
        onClick={() => navigate('/law/knowledge')}
        className="cursor-pointer group bg-gradient-to-br from-slate-50 to-white border-2 border-dashed border-slate-200 hover:border-violet-300 hover:bg-violet-50/30 rounded-3xl p-6 transition-all duration-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-violet-100 flex items-center justify-center">
              <Brain className="w-6 h-6 text-violet-600" />
            </div>
            <div>
              <h3 className="text-base font-jakarta font-bold text-foreground">Legal Knowledge Engine</h3>
              <p className="text-xs text-slate-400 mt-0.5">Búsqueda semántica · BOE · DGT · CENDOJ · TEAC · TEAR · TS · AN · vLex · Lefebvre · Tirant · Westlaw</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 text-white text-xs font-semibold group-hover:bg-violet-700 transition-colors">
            <Sparkles className="w-3.5 h-3.5" /> Abrir IA Jurídica
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}