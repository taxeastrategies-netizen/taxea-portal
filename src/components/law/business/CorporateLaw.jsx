import { useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Building2, Users, BookOpen, FileText, Calendar, Plus, ChevronRight, Sparkles } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const TABS = [
  { id: 'sociedades', label: 'Sociedades' },
  { id: 'juntas', label: 'Juntas & Actas' },
  { id: 'libros', label: 'Libros Corporativos' },
  { id: 'poderes', label: 'Poderes' },
];

const SOCIEDADES = [
  { nombre: 'Taxea Strategies SL', tipo: 'SL', cif: 'B12345678', capital: '€10.000', socios: 3, sede: 'Santa Cruz de Tenerife', estado: 'activa' },
  { nombre: 'Taxea Canarias SA', tipo: 'SA', cif: 'A87654321', capital: '€60.101', socios: 5, sede: 'Las Palmas de GC', estado: 'activa' },
];

const JUNTAS = [
  { tipo: 'Ordinaria', sociedad: 'Taxea Strategies SL', fecha: '2026-06-30', estado: 'programada', asistentes: 3 },
  { tipo: 'Extraordinaria', sociedad: 'Taxea Canarias SA', fecha: '2026-05-20', estado: 'celebrada', asistentes: 5 },
  { tipo: 'Ordinaria', sociedad: 'Taxea Canarias SA', fecha: '2025-06-28', estado: 'celebrada', asistentes: 4 },
];

export default function CorporateLaw() {
  const [tab, setTab] = useState('sociedades');
  const [generatingActa, setGeneratingActa] = useState(false);
  const [actaGenerada, setActaGenerada] = useState('');

  const generarActa = async () => {
    setGeneratingActa(true);
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `Genera un modelo de Acta de Junta General Ordinaria para una Sociedad de Responsabilidad Limitada española llamada "Taxea Strategies SL", con CIF B12345678. La junta se celebra el 30 de junio de 2026 en Santa Cruz de Tenerife. Socios presentes: 3 socios que representan el 100% del capital social. Orden del día: 1) Aprobación cuentas anuales 2025, 2) Aplicación resultado ejercicio, 3) Renovación cargo administrador único. Formato profesional con todos los elementos legalmente requeridos por la LSC.`,
    });
    setActaGenerada(res);
    setGeneratingActa(false);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-xl font-jakarta font-bold text-foreground">Corporate / Societario</h2>
            <p className="text-sm text-slate-400">Sociedades · Juntas · Actas · Libros · Poderes · Holdings</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cn("flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all",
              tab === t.id ? "bg-white text-foreground shadow-sm" : "text-slate-500 hover:text-slate-700")}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'sociedades' && (
        <div className="space-y-4">
          {SOCIEDADES.map((soc, i) => (
            <div key={i} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-base font-bold text-foreground">{soc.nombre}</p>
                  <p className="text-xs text-slate-400">{soc.tipo} · {soc.cif} · {soc.sede}</p>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">ACTIVA</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Capital social', value: soc.capital },
                  { label: 'Nº socios', value: soc.socios },
                  { label: 'Sede', value: soc.sede },
                ].map(f => (
                  <div key={f.label} className="bg-slate-50 rounded-xl p-3">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">{f.label}</p>
                    <p className="text-xs font-bold text-foreground">{f.value}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-4">
                {['Ver libro socios', 'Ver actas', 'Poderes', 'Libro contable'].map(a => (
                  <button key={a} className="text-[11px] px-2.5 py-1.5 rounded-lg bg-slate-50 text-slate-600 border border-slate-100 hover:bg-slate-100 transition-colors font-medium">
                    {a}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'juntas' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm font-semibold text-foreground">Juntas corporativas</p>
            <div className="flex gap-2">
              <button onClick={generarActa} disabled={generatingActa}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-all">
                {generatingActa ? <span className="w-3.5 h-3.5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                Generar acta con IA
              </button>
              <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold bg-taxea-red text-white hover:bg-taxea-red/90 transition-all shadow-sm">
                <Plus className="w-3.5 h-3.5" /> Nueva junta
              </button>
            </div>
          </div>
          {actaGenerada && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5">
              <p className="text-xs font-bold text-indigo-700 mb-2 uppercase tracking-wide">Acta generada por IA</p>
              <div className="bg-white rounded-xl p-4 text-xs text-slate-700 whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto font-mono">
                {actaGenerada}
              </div>
              <button className="mt-3 text-xs font-semibold text-indigo-700 hover:underline">Copiar texto</button>
            </div>
          )}
          <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="divide-y divide-slate-50">
              {JUNTAS.map((j, i) => (
                <div key={i} className="px-5 py-4 flex items-center gap-4 hover:bg-slate-50/50 cursor-pointer transition-colors">
                  <div className={cn("w-2 h-2 rounded-full flex-shrink-0", j.estado === 'programada' ? 'bg-blue-400' : 'bg-slate-300')} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">Junta {j.tipo} — {j.sociedad}</p>
                    <p className="text-xs text-slate-400">{j.fecha} · {j.asistentes} asistentes</p>
                  </div>
                  <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border",
                    j.estado === 'programada' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-50 text-slate-500 border-slate-200')}>
                    {j.estado}
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-300" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'libros' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { label: 'Libro de Socios', desc: 'Registro actualizado de socios, participaciones y transmisiones', icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Libro de Actas', desc: 'Actas de Junta General y Consejo de Administración', icon: BookOpen, color: 'text-indigo-600', bg: 'bg-indigo-50' },
            { label: 'Libro Registro de Acciones', desc: 'Registro nominativo de acciones y transmisiones (SA)', icon: FileText, color: 'text-violet-600', bg: 'bg-violet-50' },
            { label: 'Libro de Contratos', desc: 'Contratos vinculados con las sociedades del grupo', icon: FileText, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          ].map((libro, i) => {
            const Icon = libro.icon;
            return (
              <div key={i} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer group">
                <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center mb-3", libro.bg)}>
                  <Icon className={cn("w-5 h-5", libro.color)} />
                </div>
                <p className="text-sm font-bold text-foreground">{libro.label}</p>
                <p className="text-xs text-slate-400 mt-1">{libro.desc}</p>
                <button className="mt-3 text-xs font-semibold text-taxea-red flex items-center gap-1 hover:gap-2 transition-all">
                  Abrir libro <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'poderes' && (
        <div className="flex flex-col items-center justify-center py-16 bg-white border border-slate-100 rounded-2xl shadow-sm">
          <Building2 className="w-12 h-12 text-slate-200 mb-3" />
          <p className="text-sm font-semibold text-foreground">Gestión de Poderes & Autorizaciones</p>
          <p className="text-xs text-slate-400 mt-1 mb-4">Apoderados · Facultades · Vigencias · Revocaciones</p>
          <button className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-taxea-red text-white hover:bg-taxea-red/90 transition-all shadow-sm">
            <Plus className="w-4 h-4" /> Registrar nuevo poder
          </button>
        </div>
      )}
    </motion.div>
  );
}