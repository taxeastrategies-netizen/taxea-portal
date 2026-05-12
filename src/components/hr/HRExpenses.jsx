import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { DollarSign, Upload, Receipt, CheckCircle2, Clock, Plus } from 'lucide-react';

export default function HRExpenses() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-10">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center">
          <DollarSign className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <h2 className="text-xl font-jakarta font-bold text-foreground">HR Expenses</h2>
          <p className="text-sm text-slate-400">Gastos empleado, tickets, reembolsos y aprobaciones</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Gastos pendientes', value: '3', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Aprobados', value: '12', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Total mes', value: '€2,340', icon: Receipt, color: 'text-foreground', bg: 'bg-slate-50' },
          { label: 'Reembolsados', value: '€1,890', icon: DollarSign, color: 'text-blue-600', bg: 'bg-blue-50' },
        ].map((k, i) => {
          const Icon = k.icon;
          return (
            <div key={i} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", k.bg)}>
                  <Icon className={cn("w-3.5 h-3.5", k.color)} />
                </div>
                <p className="text-xs text-slate-400">{k.label}</p>
              </div>
              <p className={cn("text-2xl font-jakarta font-bold", k.color)}>{k.value}</p>
            </div>
          );
        })}
      </div>

      <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm text-center py-16">
        <Receipt className="w-14 h-14 text-slate-200 mx-auto mb-3" />
        <p className="text-base font-semibold text-foreground mb-1">Gastos & Reembolsos</p>
        <p className="text-sm text-slate-400 max-w-sm mx-auto">OCR de tickets, hojas de gasto, aprobaciones y exportación contable conectada con Finance & Tax.</p>
        <button className="mt-4 flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold bg-taxea-red text-white hover:bg-taxea-red/90 transition-all shadow-sm mx-auto">
          <Plus className="w-4 h-4" /> Nuevo gasto
        </button>
      </div>
    </motion.div>
  );
}