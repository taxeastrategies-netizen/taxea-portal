import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { cn } from '@/lib/utils';
import {
  BarChart2, Upload, FileText, AlertTriangle, CheckCircle2,
  Clock, Plus, ChevronRight, Sparkles, Info, TrendingUp
} from 'lucide-react';
import A3ImportWizard from './A3ImportWizard';
import AnalysisDashboard from './AnalysisDashboard';
import ReportViewer from './ReportViewer';

const ESTADO_CONFIG = {
  importado: { label: 'Importado', color: 'bg-slate-100 text-slate-600', icon: Clock },
  pendiente_mapeo: { label: 'Pendiente mapeo', color: 'bg-amber-50 text-amber-700', icon: AlertTriangle },
  pendiente_revision: { label: 'Pendiente revisión', color: 'bg-amber-50 text-amber-700', icon: AlertTriangle },
  analizado: { label: 'Analizado', color: 'bg-blue-50 text-blue-700', icon: BarChart2 },
  informe_generado: { label: 'Informe generado', color: 'bg-emerald-50 text-emerald-700', icon: CheckCircle2 },
  error: { label: 'Error', color: 'bg-red-50 text-red-600', icon: AlertTriangle },
};

const CALIDAD_CONFIG = {
  alta: { label: 'Alta', color: 'text-emerald-600' },
  media: { label: 'Media', color: 'text-amber-600' },
  baja: { label: 'Baja', color: 'text-red-600' },
  sin_evaluar: { label: 'Sin evaluar', color: 'text-slate-400' },
};

export default function AnalysisHome() {
  const ctx = useOutletContext() || {};
  const { company } = ctx;

  const [imports, setImports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('home'); // home | import | dashboard | report
  const [selectedImport, setSelectedImport] = useState(null);
  const [selectedReport, setSelectedReport] = useState(null);

  const companyId = company?.id;

  useEffect(() => {
    if (!companyId) { setLoading(false); return; }
    base44.entities.AccountingImport.filter({ company_id: companyId }, '-created_date', 10)
      .then(setImports).finally(() => setLoading(false));
  }, [companyId]);

  const refreshImports = () => {
    if (!companyId) return;
    base44.entities.AccountingImport.filter({ company_id: companyId }, '-created_date', 10).then(setImports);
  };

  const handleImportComplete = (imp) => {
    setSelectedImport(imp);
    refreshImports();
    setView('dashboard');
  };

  if (view === 'import') {
    return <A3ImportWizard companyId={companyId} company={company} onComplete={handleImportComplete} onCancel={() => setView('home')} />;
  }

  if (view === 'dashboard' && selectedImport) {
    return <AnalysisDashboard imp={selectedImport} companyId={companyId} company={company}
      onGenerateReport={(r) => { setSelectedReport(r); setView('report'); }}
      onBack={() => setView('home')} />;
  }

  if (view === 'report' && selectedReport) {
    return <ReportViewer report={selectedReport} imp={selectedImport} onBack={() => setView('dashboard')} />;
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BarChart2 className="w-5 h-5 text-emerald-600" />
            <h1 className="text-2xl font-jakarta font-bold text-foreground">Análisis Financiero</h1>
          </div>
          <p className="text-sm text-slate-500">Importa exportaciones contables de A3, Holded u otros formatos y genera informes financieros detallados.</p>
        </div>
        <button onClick={() => setView('import')}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-all shadow-sm flex-shrink-0">
          <Upload className="w-4 h-4" /> Importar A3 .dat
        </button>
      </div>

      {/* Aviso de alcance */}
      <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-2xl px-5 py-4">
        <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700 leading-relaxed">
          <span className="font-semibold">Análisis preliminar basado en los datos importados.</span> Los resultados dependen de la calidad y completitud del archivo. Este módulo no constituye auditoría, certificación contable ni validación fiscal definitiva. Consulta con tu asesor profesional para decisiones relevantes.
        </p>
      </div>

      {/* Stats rápidos */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Importaciones', value: imports.length, icon: Upload, color: 'text-slate-600' },
          { label: 'Analizados', value: imports.filter(i => ['analizado', 'informe_generado'].includes(i.estado)).length, icon: BarChart2, color: 'text-blue-600' },
          { label: 'Informes generados', value: imports.filter(i => i.estado === 'informe_generado').length, icon: FileText, color: 'text-emerald-600' },
          { label: 'Pendientes revisión', value: imports.filter(i => i.estado === 'pendiente_revision').length, icon: AlertTriangle, color: 'text-amber-600' },
        ].map((k, i) => {
          const Icon = k.icon;
          return (
            <div key={i} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
              <Icon className={cn("w-5 h-5 mb-2", k.color)} />
              <p className="text-2xl font-jakarta font-bold text-foreground">{k.value}</p>
              <p className="text-xs text-slate-400 mt-0.5">{k.label}</p>
            </div>
          );
        })}
      </div>

      {/* Lista importaciones */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : imports.length === 0 ? (
        <EmptyState onImport={() => setView('import')} />
      ) : (
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Importaciones recientes</p>
          </div>
          <div className="divide-y divide-slate-50">
            {imports.map((imp, i) => {
              const ec = ESTADO_CONFIG[imp.estado] || ESTADO_CONFIG.importado;
              const StatusIcon = ec.icon;
              const cal = CALIDAD_CONFIG[imp.calidad_dato] || CALIDAD_CONFIG.sin_evaluar;
              return (
                <div key={imp.id || i}
                  className="px-5 py-4 flex items-center gap-4 hover:bg-slate-50/50 cursor-pointer transition-colors"
                  onClick={() => { setSelectedImport(imp); setView('dashboard'); }}>
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{imp.nombre_archivo}</p>
                    <p className="text-xs text-slate-400">
                      {imp.origen?.toUpperCase()} · {imp.empresa_nombre || 'Sin empresa'} · {imp.total_lineas || 0} líneas
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-slate-400">{imp.periodo_inicio} – {imp.periodo_fin}</span>
                    <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1", ec.color)}>
                      <StatusIcon className="w-3 h-3" />{ec.label}
                    </span>
                    <span className={cn("text-[10px] font-semibold", cal.color)}>Calidad {cal.label}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Features preview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { icon: Upload, title: 'Importa A3 .dat', desc: 'Sube archivos .dat exportados desde A3 Asesor, A3 ERP o A3CON. Detectamos la estructura automáticamente.', color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { icon: BarChart2, title: 'Dashboard financiero', desc: 'PyG, balance, caja, ratios e indicadores. Visual, claro y con alertas sobre los datos.', color: 'text-blue-600', bg: 'bg-blue-50' },
          { icon: FileText, title: 'Informe detallado', desc: 'Genera un informe completo con resumen ejecutivo, alertas, ratios y recomendaciones.', color: 'text-violet-600', bg: 'bg-violet-50' },
        ].map((f, i) => {
          const Icon = f.icon;
          return (
            <div key={i} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
              <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center mb-3", f.bg)}>
                <Icon className={cn("w-5 h-5", f.color)} />
              </div>
              <p className="text-sm font-bold text-foreground mb-1">{f.title}</p>
              <p className="text-xs text-slate-500 leading-relaxed">{f.desc}</p>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

function EmptyState({ onImport }) {
  return (
    <div className="bg-white border border-slate-100 rounded-3xl p-12 text-center shadow-sm">
      <div className="w-16 h-16 rounded-3xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
        <Upload className="w-8 h-8 text-emerald-500" />
      </div>
      <h3 className="text-lg font-jakarta font-bold text-foreground mb-2">Sin importaciones todavía</h3>
      <p className="text-sm text-slate-500 mb-6 max-w-sm mx-auto">
        Sube tu exportación contable de A3, Holded u otro formato. Revisamos el archivo antes de analizarlo.
      </p>
      <button onClick={onImport}
        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-all shadow-sm">
        <Upload className="w-4 h-4" /> Importar A3 .dat
      </button>
    </div>
  );
}