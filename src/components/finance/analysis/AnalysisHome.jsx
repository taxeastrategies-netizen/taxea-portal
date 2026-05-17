import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { cn } from '@/lib/utils';
import { BarChart2, Upload, FileText, AlertTriangle, CheckCircle2, Clock, ChevronRight, Info, Plus } from 'lucide-react';
import SourceSelector from './SourceSelector';
import PDFAnalysisEngine from './PDFAnalysisEngine';
import A3ImportWizard from './A3ImportWizard';
import ExcelImportWizard from './ExcelImportWizard';
import AnalysisDashboard from './AnalysisDashboard';
import PremiumReportViewer from './PremiumReportViewer';

const ESTADO_CONFIG = {
  importado:          { label: 'Importado',            color: 'bg-slate-100 text-slate-600',    icon: Clock },
  pdf_subido:         { label: 'PDF subido',           color: 'bg-blue-50 text-blue-600',       icon: FileText },
  ocr_proceso:        { label: 'OCR en curso',         color: 'bg-amber-50 text-amber-600',     icon: Clock },
  pendiente_revision: { label: 'Pendiente revisión',   color: 'bg-amber-50 text-amber-700',     icon: AlertTriangle },
  analizado:          { label: 'Analizado',             color: 'bg-blue-50 text-blue-700',       icon: BarChart2 },
  informe_generado:   { label: 'Informe generado',     color: 'bg-emerald-50 text-emerald-700', icon: CheckCircle2 },
  error:              { label: 'Error',                 color: 'bg-red-50 text-red-600',         icon: AlertTriangle },
};

const CALIDAD = {
  alta:       { label: 'Alta',   color: 'text-emerald-600' },
  media:      { label: 'Media',  color: 'text-amber-600'   },
  baja:       { label: 'Baja',   color: 'text-red-600'     },
  sin_evaluar:{ label: '—',      color: 'text-slate-400'   },
};

const ORIGEN_LABEL = {
  pdf_balance:   'PDF Balance',
  pdf_pyg:       'PDF PyG',
  pdf_combined:  'PDF Balance+PyG',
  pdf_auto:      'PDF (auto)',
  a3:            'A3 .dat',
  excel_balance: 'Excel Balance',
  excel_pyg:     'Excel PyG',
  excel_diario:  'Excel Diario',
  excel_combined:'Excel combinado',
};

export default function AnalysisHome() {
  const ctx = useOutletContext() || {};
  const { company } = ctx;
  const companyId = company?.id;

  const [imports, setImports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('home');
  const [importType, setImportType] = useState('');
  const [selectedImport, setSelectedImport] = useState(null);

  useEffect(() => {
    if (!companyId) { setLoading(false); return; }
    base44.entities.AccountingImport.filter({ company_id: companyId }, '-created_date', 15)
      .then(setImports).finally(() => setLoading(false));
  }, [companyId]);

  const refresh = () => {
    if (!companyId) return;
    base44.entities.AccountingImport.filter({ company_id: companyId }, '-created_date', 15).then(setImports);
  };

  const handleImportComplete = (imp) => {
    refresh();
    setSelectedImport(imp);
    setView('dashboard');
  };

  const handleSelectType = (type) => {
    setImportType(type);
    if (type.startsWith('pdf')) setView('import_pdf');
    else if (type === 'dat') setView('import_dat');
    else setView('import_excel');
  };

  if (view === 'selector')     return <SourceSelector onSelect={handleSelectType} onCancel={() => setView('home')} />;
  if (view === 'import_pdf')   return <PDFAnalysisEngine importType={importType} companyId={companyId} company={company} onComplete={handleImportComplete} onCancel={() => setView('selector')} />;
  if (view === 'import_dat')   return <A3ImportWizard companyId={companyId} company={company} onComplete={handleImportComplete} onCancel={() => setView('selector')} />;
  if (view === 'import_excel') return <ExcelImportWizard importType={importType} companyId={companyId} company={company} onComplete={handleImportComplete} onCancel={() => setView('selector')} />;
  if (view === 'dashboard' && selectedImport) return (
    <AnalysisDashboard imp={selectedImport} companyId={companyId} company={company}
      onGenerateReport={() => setView('report')} onBack={() => setView('home')} />
  );
  if (view === 'report' && selectedImport) return (
    <PremiumReportViewer imp={selectedImport} onBack={() => setView('dashboard')} />
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BarChart2 className="w-5 h-5 text-emerald-600" />
            <h1 className="text-2xl font-jakarta font-bold text-foreground">Análisis Financiero</h1>
          </div>
          <p className="text-sm text-slate-500 max-w-xl">Importa PDFs de Balance o PyG, Excel o archivos .dat de A3. La IA extrae, estructura y analiza los datos.</p>
        </div>
        <button onClick={() => setView('selector')}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-all shadow-sm flex-shrink-0">
          <Plus className="w-4 h-4" /> Nuevo análisis
        </button>
      </div>

      {/* Disclaimer */}
      <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-2xl px-5 py-4">
        <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700 leading-relaxed">
          <strong>Análisis preliminar basado en los datos importados.</strong> La extracción mediante IA/OCR puede requerir revisión. No constituye auditoría ni validación fiscal definitiva. Toda clasificación es estimada. Las cifras deben ser verificadas por un profesional.
        </p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Importaciones',       value: imports.length,                                                          icon: Upload,         color: 'text-slate-600'   },
          { label: 'PDFs analizados',     value: imports.filter(i => i.origen?.startsWith('pdf')).length,                 icon: FileText,       color: 'text-blue-600'    },
          { label: 'Informes generados',  value: imports.filter(i => i.estado === 'informe_generado').length,             icon: CheckCircle2,   color: 'text-emerald-600' },
          { label: 'Pendientes revisión', value: imports.filter(i => i.estado === 'pendiente_revision').length,           icon: AlertTriangle,  color: 'text-amber-600'   },
        ].map((k, i) => { const Icon = k.icon; return (
          <div key={i} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
            <Icon className={cn("w-5 h-5 mb-2", k.color)} />
            <p className="text-2xl font-jakarta font-bold text-foreground">{k.value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{k.label}</p>
          </div>
        ); })}
      </div>

      {/* Import list */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : imports.length === 0 ? (
        <EmptyState onImport={() => setView('selector')} />
      ) : (
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Análisis recientes</p>
            <button onClick={() => setView('selector')} className="text-xs font-semibold text-emerald-600 hover:underline">+ Nuevo</button>
          </div>
          <div className="divide-y divide-slate-50">
            {imports.map((imp, i) => {
              const ec = ESTADO_CONFIG[imp.estado] || ESTADO_CONFIG.importado;
              const StatusIcon = ec.icon;
              const cal = CALIDAD[imp.calidad_dato] || CALIDAD.sin_evaluar;
              const origenLabel = ORIGEN_LABEL[imp.origen] || imp.origen;
              return (
                <div key={imp.id || i}
                  className="px-5 py-4 flex items-center gap-4 hover:bg-slate-50/50 cursor-pointer transition-colors"
                  onClick={() => { setSelectedImport(imp); setView('dashboard'); }}>
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{imp.nombre_archivo}</p>
                    <p className="text-xs text-slate-400">{origenLabel} · {imp.empresa_nombre || 'Sin empresa'} · {imp.total_lineas || 0} líneas</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                    {imp.periodo_inicio && <span className="text-xs text-slate-400">{imp.periodo_inicio?.substring(0,7)}</span>}
                    <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1", ec.color)}>
                      <StatusIcon className="w-3 h-3" />{ec.label}
                    </span>
                    <span className={cn("text-[10px] font-semibold", cal.color)}>Cal. {cal.label}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Feature cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { emoji: '📄', title: 'PDF Balance / PyG', desc: 'Sube el PDF de tu balance o cuenta de resultados. La IA detecta tablas, extrae cifras y te permite revisar antes de analizar.', action: 'pdf_auto', color: 'bg-blue-50', iconColor: 'text-blue-600' },
          { emoji: '📊', title: 'Excel o A3 .dat', desc: 'Compatible con Excel de Balance, PyG y Diario, y con exportaciones .dat de A3 Asesor o A3 ERP. Parser multi-estrategia.', action: 'excel_combined', color: 'bg-emerald-50', iconColor: 'text-emerald-600' },
          { emoji: '📋', title: 'Informe con trazabilidad', desc: 'Cada cifra del informe indica su origen: página, tabla, confianza de extracción y si fue revisada o corregida manualmente.', action: null, color: 'bg-violet-50', iconColor: 'text-violet-600' },
        ].map((f, i) => (
          <div key={i}
            className={cn("bg-white border border-slate-100 rounded-2xl p-5 shadow-sm", f.action && "cursor-pointer hover:shadow-md transition-all")}
            onClick={() => f.action && handleSelectType(f.action)}>
            <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center mb-3 text-xl", f.color)}>
              {f.emoji}
            </div>
            <p className="text-sm font-bold text-foreground mb-1">{f.title}</p>
            <p className="text-xs text-slate-500 leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function EmptyState({ onImport }) {
  return (
    <div className="bg-white border border-slate-100 rounded-3xl p-12 text-center shadow-sm">
      <div className="text-5xl mb-4">📄</div>
      <h3 className="text-lg font-jakarta font-bold text-foreground mb-2">Sin análisis todavía</h3>
      <p className="text-sm text-slate-500 mb-6 max-w-sm mx-auto">
        Sube un PDF de Balance o PyG, un Excel contable o un archivo .dat de A3. La IA detecta, extrae y analiza los datos.
      </p>
      <button onClick={onImport}
        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-all shadow-sm">
        <Plus className="w-4 h-4" /> Nuevo análisis
      </button>
    </div>
  );
}