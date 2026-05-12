import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  Briefcase, FileText, Building2, Shield, PenLine, BookOpen, Brain,
  ChevronRight, AlertTriangle, Clock, CheckCircle2, Calendar,
  Users, Plus, Zap, Lock
} from 'lucide-react';

const MODULES = [
  { id: 'contracts', label: 'Contracts Center', icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50', path: '/law/business/contracts', desc: 'NDA · SPA · SHA · Servicios · Alquiler' },
  { id: 'corporate', label: 'Corporate / Societario', icon: Building2, color: 'text-indigo-600', bg: 'bg-indigo-50', path: '/law/business/corporate', desc: 'Juntas · Actas · Libros · Holdings' },
  { id: 'compliance', label: 'Compliance Center', icon: Shield, color: 'text-emerald-600', bg: 'bg-emerald-50', path: '/law/business/compliance', desc: 'AML · KYC · RGPD · Whistleblowing' },
  { id: 'documents', label: 'Legal Documents', icon: BookOpen, color: 'text-violet-600', bg: 'bg-violet-50', path: '/law/business/documents', desc: 'Plantillas · Escritos · Modelos · Estatutos' },
  { id: 'signatures', label: 'Signatures & Approvals', icon: PenLine, color: 'text-rose-600', bg: 'bg-rose-50', path: '/law/business/signatures', desc: 'Firma electrónica · Workflows · Auditoría' },
  { id: 'ai', label: 'Legal AI Assistant', icon: Brain, color: 'text-slate-600', bg: 'bg-slate-100', path: '/law/business/ai', desc: 'IA jurídica · Contratos · Actas · Cláusulas' },
];

const SAMPLE_CONTRACTS = [
  { nombre: 'NDA — Proveedor TechSoft SL', tipo: 'NDA', estado: 'firma_pendiente', vencimiento: '2026-06-30', riesgo: 'bajo' },
  { nombre: 'Contrato Servicios — Cliente A', tipo: 'Servicios', estado: 'activo', vencimiento: '2026-12-31', riesgo: 'medio' },
  { nombre: 'SHA — Ronda Serie A', tipo: 'SHA', estado: 'negociacion', vencimiento: '2026-05-20', riesgo: 'alto' },
  { nombre: 'Alquiler oficina Madrid', tipo: 'Alquiler', estado: 'activo', vencimiento: '2027-01-15', riesgo: 'bajo' },
];

const ESTADO_CONFIG = {
  activo: { label: 'Activo', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  firma_pendiente: { label: 'Firma pendiente', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  negociacion: { label: 'En negociación', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  vencido: { label: 'Vencido', color: 'bg-red-50 text-red-700 border-red-200' },
};

export default function LegalDashboard() {
  const navigate = useNavigate();

  const kpis = [
    { label: 'Contratos activos', value: 14, icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Firmas pendientes', value: 3, icon: PenLine, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Compliance score', value: '91%', icon: Shield, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Vencen en 30d', value: 2, icon: Clock, color: 'text-red-500', bg: 'bg-red-50' },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-10">
      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-800 to-slate-950 p-6 text-white shadow-xl">
        <div className="absolute inset-0 opacity-15" style={{ backgroundImage: 'radial-gradient(circle at 70% 30%, #3b82f6, transparent 60%)' }} />
        <div className="relative z-10 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Briefcase className="w-5 h-5 text-blue-300" />
              <span className="text-blue-300 text-xs font-semibold uppercase tracking-widest">Business Law</span>
            </div>
            <h2 className="text-2xl font-jakarta font-bold">Legal Dashboard</h2>
            <p className="text-slate-300 text-sm mt-1">Contratos · Societario · Compliance · Firmas · Documentos</p>
          </div>
          <button onClick={() => navigate('/law/business/ai')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-all backdrop-blur border border-white/15">
            <Brain className="w-3.5 h-3.5" /> Legal AI
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k, i) => {
          const Icon = k.icon;
          return (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
              className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
              <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center mb-3", k.bg)}>
                <Icon className={cn("w-4 h-4", k.color)} />
              </div>
              <p className="text-2xl font-jakarta font-bold text-foreground">{k.value}</p>
              <p className="text-xs text-slate-400 mt-0.5">{k.label}</p>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Módulos */}
        <div className="lg:col-span-2 space-y-2">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Módulos Business Law</p>
          {MODULES.map(mod => {
            const Icon = mod.icon;
            return (
              <button key={mod.id} onClick={() => navigate(mod.path)}
                className="w-full flex items-center gap-3 p-3.5 bg-white border border-slate-100 rounded-2xl hover:border-blue-200 hover:shadow-sm transition-all group text-left">
                <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0", mod.bg)}>
                  <Icon className={cn("w-4 h-4", mod.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{mod.label}</p>
                  <p className="text-[11px] text-slate-400">{mod.desc}</p>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 transition-all" />
              </button>
            );
          })}
        </div>

        {/* Contracts table */}
        <div className="lg:col-span-3 bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Contratos recientes</p>
            <button onClick={() => navigate('/law/business/contracts')} className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700">
              <Plus className="w-3 h-3" /> Ver todos
            </button>
          </div>
          <div className="divide-y divide-slate-50">
            {SAMPLE_CONTRACTS.map((c, i) => {
              const ec = ESTADO_CONFIG[c.estado] || ESTADO_CONFIG.activo;
              return (
                <div key={i} className="px-5 py-3.5 hover:bg-slate-50/50 cursor-pointer transition-colors">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{c.nombre}</p>
                      <p className="text-xs text-slate-400">{c.tipo} · Vence {c.vencimiento}</p>
                    </div>
                    <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0", ec.color)}>{ec.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Calendar preview */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-foreground">Calendario jurídico — próximos 30 días</p>
          <Calendar className="w-4 h-4 text-slate-400" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: 'Junta Ordinaria SA — 18 mayo', tipo: 'Junta', days: 6, color: 'border-l-blue-400' },
            { label: 'Vencimiento NDA — TechSoft', tipo: 'Contrato', days: 18, color: 'border-l-amber-400' },
            { label: 'Renovación licencia marca', tipo: 'IP', days: 28, color: 'border-l-violet-400' },
          ].map((ev, i) => (
            <div key={i} className={cn("border-l-2 pl-3 py-2 rounded-r-lg bg-slate-50", ev.color)}>
              <p className="text-xs font-semibold text-foreground">{ev.label}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{ev.tipo} · En {ev.days} días</p>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}