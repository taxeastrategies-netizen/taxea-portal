import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { PenLine, Clock, CheckCircle2, Plus, Users, AlertTriangle } from 'lucide-react';

const SIGNATURES = [
  { doc: 'NDA — TechSoft SL', firmantes: ['Ana García (CEO)', 'Pedro López (TechSoft)'], estado: 'pendiente', creado: '2026-05-10', plazo: '2026-05-25' },
  { doc: 'SHA — Serie A', firmantes: ['Ana García (CEO)', 'VC Fund I', 'Co-Founder B', 'Co-Founder C'], estado: 'en_proceso', creado: '2026-05-05', plazo: '2026-05-20' },
  { doc: 'Contrato Servicios IT', firmantes: ['Ana García (CEO)', 'Global Corp SA'], estado: 'completado', creado: '2026-04-20', plazo: '2026-04-30' },
  { doc: 'Addenda Alquiler', firmantes: ['Ana García (CEO)', 'Inmobiliaria Centro SL'], estado: 'completado', creado: '2026-04-10', plazo: '2026-04-15' },
];

const ESTADO_CONFIG = {
  pendiente: { label: 'Pendiente de firma', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: Clock },
  en_proceso: { label: 'En proceso', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: Users },
  completado: { label: 'Completado', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
};

export default function SignaturesApprovals() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center">
            <PenLine className="w-5 h-5 text-rose-600" />
          </div>
          <div>
            <h2 className="text-xl font-jakarta font-bold text-foreground">Signatures & Approvals</h2>
            <p className="text-sm text-slate-400">Firma electrónica · Multi-firma · Workflows · Auditoría · Logs</p>
          </div>
        </div>
        <button className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-taxea-red text-white hover:bg-taxea-red/90 transition-all shadow-sm">
          <Plus className="w-4 h-4" /> Nuevo proceso firma
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Pendientes de firma', value: SIGNATURES.filter(s => s.estado === 'pendiente').length, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-100', icon: Clock },
          { label: 'En proceso', value: SIGNATURES.filter(s => s.estado === 'en_proceso').length, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-100', icon: Users },
          { label: 'Completados', value: SIGNATURES.filter(s => s.estado === 'completado').length, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100', icon: CheckCircle2 },
        ].map((k, i) => {
          const Icon = k.icon;
          return (
            <div key={i} className={cn("bg-white border rounded-2xl p-4 shadow-sm", k.bg)}>
              <Icon className={cn("w-5 h-5 mb-2", k.color)} />
              <p className={cn("text-2xl font-jakarta font-bold", k.color)}>{k.value}</p>
              <p className="text-xs text-slate-400 mt-0.5">{k.label}</p>
            </div>
          );
        })}
      </div>

      {/* Signature list */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="divide-y divide-slate-50">
          {SIGNATURES.map((s, i) => {
            const ec = ESTADO_CONFIG[s.estado];
            const StatusIcon = ec.icon;
            const firmadasCount = s.estado === 'completado' ? s.firmantes.length : s.estado === 'en_proceso' ? 1 : 0;
            return (
              <div key={i} className="px-5 py-4 hover:bg-slate-50/50 cursor-pointer transition-colors">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{s.doc}</p>
                    <p className="text-xs text-slate-400">Creado: {s.creado} · Plazo: {s.plazo}</p>
                  </div>
                  <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0 flex items-center gap-1", ec.color)}>
                    <StatusIcon className="w-3 h-3" />{ec.label}
                  </span>
                </div>
                {/* Firmantes */}
                <div className="flex flex-wrap gap-2">
                  {s.firmantes.map((f, j) => (
                    <div key={j} className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium",
                      j < firmadasCount ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-500 border-slate-200')}>
                      {j < firmadasCount ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                      {f}
                    </div>
                  ))}
                </div>
                {/* Progress */}
                <div className="flex items-center gap-2 mt-3">
                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${(firmadasCount / s.firmantes.length) * 100}%` }} />
                  </div>
                  <span className="text-[10px] text-slate-400">{firmadasCount}/{s.firmantes.length} firmado{firmadasCount !== 1 ? 's' : ''}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}