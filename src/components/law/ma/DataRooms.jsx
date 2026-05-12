import { useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Lock, Folder, FileText, Users, Eye, Plus, Shield } from 'lucide-react';

const ROOMS = [
  {
    nombre: 'Data Room — Adquisición TechStart', deal: 'TechStart SL', estado: 'activo',
    archivos: 47, carpetas: 8, accesos: 4, ultima_actividad: 'Hace 2 horas',
    nda_firmados: 4, logs: 23,
  },
  {
    nombre: 'Data Room — Fusión Logística Norte', deal: 'Logística Norte SA', estado: 'activo',
    archivos: 112, carpetas: 15, accesos: 6, ultima_actividad: 'Hace 1 día',
    nda_firmados: 6, logs: 87,
  },
  {
    nombre: 'Data Room — Serie A Round', deal: 'Startup B', estado: 'preparacion',
    archivos: 12, carpetas: 4, accesos: 0, ultima_actividad: 'Hoy',
    nda_firmados: 0, logs: 0,
  },
];

const CARPETAS_MODELO = ['01 — Información corporativa', '02 — Contratos clave', '03 — Información financiera', '04 — Fiscal & Compliance', '05 — Laboral & RRHH', '06 — Propiedad intelectual', '07 — Tecnología & IT', '08 — Litigios & procedimientos'];

export default function DataRooms() {
  const [selected, setSelected] = useState(0);
  const room = ROOMS[selected];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center">
            <Lock className="w-5 h-5 text-slate-600" />
          </div>
          <div>
            <h2 className="text-xl font-jakarta font-bold text-foreground">Data Rooms</h2>
            <p className="text-sm text-slate-400">Carpetas seguras · Permisos granulares · NDA · Logs de acceso · M&A</p>
          </div>
        </div>
        <button className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-taxea-red text-white hover:bg-taxea-red/90 transition-all shadow-sm">
          <Plus className="w-4 h-4" /> Crear Data Room
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Room list */}
        <div className="space-y-3">
          {ROOMS.map((r, i) => (
            <button key={i} onClick={() => setSelected(i)}
              className={cn("w-full p-4 rounded-2xl border text-left transition-all",
                selected === i ? "border-violet-300 bg-violet-50 shadow-sm" : "border-slate-100 bg-white hover:border-slate-200 shadow-sm hover:shadow-md")}>
              <div className="flex items-start justify-between mb-2">
                <Lock className={cn("w-4 h-4", selected === i ? "text-violet-600" : "text-slate-400")} />
                <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full",
                  r.estado === 'activo' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700')}>
                  {r.estado.toUpperCase()}
                </span>
              </div>
              <p className="text-sm font-bold text-foreground leading-snug">{r.nombre}</p>
              <p className="text-xs text-slate-400 mt-1">{r.archivos} archivos · {r.accesos} usuarios</p>
            </button>
          ))}
        </div>

        {/* Room detail */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-5 text-white">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-slate-400 text-xs uppercase tracking-widest font-semibold mb-1">Data Room</p>
                <h3 className="text-lg font-jakarta font-bold">{room.nombre}</h3>
                <p className="text-slate-300 text-sm mt-0.5">Deal: {room.deal} · Última actividad: {room.ultima_actividad}</p>
              </div>
              <Shield className="w-6 h-6 text-slate-400" />
            </div>
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: 'Archivos', value: room.archivos },
                { label: 'Carpetas', value: room.carpetas },
                { label: 'Usuarios', value: room.accesos },
                { label: 'NDAs firmados', value: room.nda_firmados },
              ].map(k => (
                <div key={k.label} className="bg-white/8 rounded-xl p-3 text-center">
                  <p className="text-xl font-jakarta font-bold">{k.value}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{k.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Carpetas */}
          <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-50 flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">Estructura de carpetas</p>
              <button className="flex items-center gap-1 text-xs font-medium text-taxea-red hover:underline">
                <Plus className="w-3 h-3" /> Nueva carpeta
              </button>
            </div>
            <div className="divide-y divide-slate-50">
              {CARPETAS_MODELO.map((c, i) => (
                <div key={i} className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50/50 cursor-pointer transition-colors">
                  <Folder className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <span className="text-sm text-foreground flex-1">{c}</span>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <FileText className="w-3.5 h-3.5" />
                    <span>{Math.floor(Math.random() * 12) + 1} docs</span>
                    <Eye className="w-3.5 h-3.5 ml-1" />
                    <Users className="w-3.5 h-3.5" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}