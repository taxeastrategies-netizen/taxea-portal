import { useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { BookOpen, Search, Download, Plus, FileText, Folder } from 'lucide-react';

const CATS = ['Todas', 'Contratos', 'Plantillas', 'Estatutos', 'Escritos', 'Modelos', 'Formularios', 'Jurisprudencia', 'SOPs'];

const DOCS = [
  { nombre: 'Modelo Contrato NDA Bilateral', cat: 'Plantillas', tipo: 'DOCX', fecha: '2026-01-10', uso: 12 },
  { nombre: 'Estatutos Sociales SL — Modelo Premium', cat: 'Estatutos', tipo: 'DOCX', fecha: '2026-02-20', uso: 3 },
  { nombre: 'Recurso alzada TEAR — Modelo', cat: 'Escritos', tipo: 'DOCX', fecha: '2026-03-05', uso: 7 },
  { nombre: 'STS 1234/2024 — Deducción IVA vehículos', cat: 'Jurisprudencia', tipo: 'PDF', fecha: '2025-11-30', uso: 4 },
  { nombre: 'Formulario Alta Libro Socios', cat: 'Formularios', tipo: 'PDF', fecha: '2026-01-01', uso: 2 },
  { nombre: 'SOP — Due Diligence Legal M&A', cat: 'SOPs', tipo: 'PDF', fecha: '2026-04-15', uso: 1 },
  { nombre: 'Modelo Contrato SHA', cat: 'Contratos', tipo: 'DOCX', fecha: '2026-02-01', uso: 5 },
  { nombre: 'Consulta DGT V2345-23 — Teletrabajo', cat: 'Jurisprudencia', tipo: 'PDF', fecha: '2023-09-12', uso: 9 },
];

export default function LegalDocuments() {
  const [cat, setCat] = useState('Todas');
  const [search, setSearch] = useState('');

  const filtered = DOCS.filter(d => {
    const q = search.toLowerCase();
    const matchQ = !q || d.nombre.toLowerCase().includes(q);
    const matchC = cat === 'Todas' || d.cat === cat;
    return matchQ && matchC;
  });

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-violet-50 border border-violet-100 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <h2 className="text-xl font-jakarta font-bold text-foreground">Legal Documents</h2>
            <p className="text-sm text-slate-400">Plantillas · Estatutos · Escritos · Modelos · Jurisprudencia · SOPs</p>
          </div>
        </div>
        <button className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-taxea-red text-white hover:bg-taxea-red/90 transition-all shadow-sm">
          <Plus className="w-4 h-4" /> Subir documento
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar documento..."
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-200 bg-white" />
        </div>
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1 overflow-x-auto">
          {CATS.slice(0, 6).map(c => (
            <button key={c} onClick={() => setCat(c)}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all",
                cat === c ? "bg-white text-foreground shadow-sm" : "text-slate-500 hover:text-slate-700")}>
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((doc, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer group">
            <div className="flex items-start gap-3">
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0", doc.tipo === 'PDF' ? 'bg-red-50' : 'bg-blue-50')}>
                <FileText className={cn("w-5 h-5", doc.tipo === 'PDF' ? 'text-red-500' : 'text-blue-500')} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground leading-snug">{doc.nombre}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-slate-50 text-slate-500 border border-slate-100">{doc.cat}</span>
                  <span className="text-[10px] text-slate-400">{doc.fecha}</span>
                  <span className="text-[10px] text-slate-400">{doc.uso} usos</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium bg-slate-50 text-slate-600 border border-slate-100 hover:bg-slate-100 transition-colors">
                <Download className="w-3 h-3" /> Descargar
              </button>
              <button className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium bg-violet-50 text-violet-700 border border-violet-100 hover:bg-violet-100 transition-colors">
                Ver
              </button>
            </div>
          </motion.div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center py-16 text-slate-300 gap-2">
            <BookOpen className="w-10 h-10" />
            <p className="text-sm text-slate-400">Sin documentos en esta categoría.</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}