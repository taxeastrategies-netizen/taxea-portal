import { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileText, Loader2, CheckCircle, AlertTriangle, Zap, Download, ArrowRight, X, RefreshCw, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

function fmt(n) {
  if (!n && n !== 0) return '—';
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n);
}

const TIPO_BADGE = {
  prestamo_bancario: 'bg-blue-50 text-blue-700 border-blue-200',
  ico: 'bg-taxea-red/8 text-taxea-red border-taxea-red/20',
  leasing: 'bg-violet-50 text-violet-700 border-violet-200',
  renting: 'bg-slate-100 text-slate-600 border-slate-200',
  linea_credito: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  poliza: 'bg-amber-50 text-amber-700 border-amber-200',
  prestamo_socio: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  aval: 'bg-rose-50 text-rose-700 border-rose-200',
  cuadro_amortizacion: 'bg-cyan-50 text-cyan-700 border-cyan-200',
};

const TIPO_LABELS = {
  prestamo_bancario: 'Préstamo bancario', ico: 'ICO', leasing: 'Leasing', renting: 'Renting',
  linea_credito: 'Línea de crédito', poliza: 'Póliza de crédito', prestamo_socio: 'Préstamo socio',
  prestamo_participativo: 'Préstamo participativo', aval: 'Aval bancario',
  cuadro_amortizacion: 'Cuadro amortización', oferta_bancaria: 'Oferta bancaria',
  refinanciacion: 'Refinanciación', recibo_cuota: 'Recibo cuota', otro: 'Otro',
};

export default function DebtOCR({ companyId, onImported }) {
  const [step, setStep] = useState('upload'); // upload | analyzing | result
  const [file, setFile] = useState(null);
  const [fileUrl, setFileUrl] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef();

  const handleFile = async (f) => {
    if (!f) return;
    setFile(f);
    setStep('analyzing');
    setAnalysis(null);

    // Upload file
    const { file_url } = await base44.integrations.Core.UploadFile({ file: f });
    setFileUrl(file_url);

    // Extract + analyze with LLM
    const extracted = await base44.integrations.Core.ExtractDataFromUploadedFile({
      file_url,
      json_schema: {
        type: 'object',
        properties: {
          raw_text: { type: 'string' }
        }
      }
    }).catch(() => ({ output: { raw_text: '' } }));

    const rawText = extracted?.output?.raw_text || '';

    const result = await base44.integrations.Core.InvokeLLM({
      model: 'claude_sonnet_4_6',
      prompt: `Eres un experto en análisis de documentos financieros y bancarios españoles. Analiza el siguiente documento y extrae TODOS los datos financieros que puedas identificar.

DOCUMENTO:
${rawText || '[Documento adjunto — analiza la imagen/PDF directamente]'}

Extrae y devuelve un JSON COMPLETO con todos los campos que puedas identificar. Si no encuentras un valor, pon null.

Instrucciones especiales:
- Clasifica el tipo_documento entre: prestamo_bancario, ico, leasing, renting, linea_credito, poliza, prestamo_socio, prestamo_participativo, aval, cuadro_amortizacion, oferta_bancaria, refinanciacion, recibo_cuota, otro
- El scoring_financiero debe ser de 0 a 100 (100 = condiciones excelentes, 0 = muy caras/riesgosas)
- El análisis_ia debe ser detallado, profesional y en español
- Las alertas deben ser concretas y accionables`,
      file_urls: [file_url],
      response_json_schema: {
        type: 'object',
        properties: {
          tipo_documento: { type: 'string' },
          entidad: { type: 'string' },
          titular: { type: 'string' },
          nif_cif: { type: 'string' },
          numero_contrato: { type: 'string' },
          fecha_firma: { type: 'string' },
          fecha_inicio: { type: 'string' },
          fecha_vencimiento: { type: 'string' },
          importe_inicial: { type: 'number' },
          capital_pendiente: { type: 'number' },
          moneda: { type: 'string' },
          tin: { type: 'number' },
          tae: { type: 'number' },
          tipo_interes: { type: 'string' },
          euribor_diferencial: { type: 'string' },
          cuota: { type: 'number' },
          periodicidad: { type: 'string' },
          plazo_meses: { type: 'number' },
          num_cuotas: { type: 'number' },
          cuotas_pendientes: { type: 'number' },
          intereses_totales: { type: 'number' },
          coste_total: { type: 'number' },
          comision_apertura: { type: 'number' },
          comision_estudio: { type: 'number' },
          comision_cancelacion: { type: 'number' },
          otros_gastos: { type: 'number' },
          carencia_meses: { type: 'number' },
          fecha_fin_carencia: { type: 'string' },
          avales: { type: 'string' },
          garantias: { type: 'string' },
          limite_credito: { type: 'number' },
          dispuesto: { type: 'number' },
          activo_asociado: { type: 'string' },
          opcion_compra: { type: 'number' },
          iban_asociado: { type: 'string' },
          scoring_financiero: { type: 'number' },
          scoring_razon: { type: 'string' },
          analisis_ia: { type: 'string' },
          conclusion: { type: 'string' },
          alertas: { type: 'array', items: { type: 'string' } },
          recomendacion: { type: 'string' },
          comparativa_mercado: { type: 'string' },
          nombre_sugerido: { type: 'string' },
        }
      }
    });

    setAnalysis(result);
    setStep('result');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleImport = async () => {
    if (!analysis || !companyId) return;
    setImporting(true);

    const a = analysis;
    const tipoMap = {
      prestamo_bancario: 'prestamo_bancario', ico: 'ico', leasing: 'leasing', renting: 'renting',
      linea_credito: 'linea_credito', poliza: 'poliza', prestamo_socio: 'prestamo_socio',
      prestamo_participativo: 'prestamo_participativo', otro: 'otro',
    };
    const tipo = tipoMap[a.tipo_documento] || 'otro';
    const isLinea = tipo === 'linea_credito' || tipo === 'poliza';

    await base44.entities.DebtInstrument.create({
      company_id: companyId,
      tipo,
      nombre: a.nombre_sugerido || `${a.entidad || 'Instrumento'} — ${a.fecha_firma || new Date().getFullYear()}`,
      entidad: a.entidad || '',
      numero_contrato: a.numero_contrato || '',
      importe_inicial: a.importe_inicial || 0,
      capital_pendiente: a.capital_pendiente || a.importe_inicial || 0,
      tin: a.tin || 0,
      tae: a.tae || 0,
      plazo_meses: a.plazo_meses || 0,
      fecha_inicio: a.fecha_inicio || '',
      fecha_vencimiento: a.fecha_vencimiento || '',
      periodicidad: a.periodicidad || 'mensual',
      cuota: a.cuota || 0,
      estado: 'activo',
      en_carencia: (a.carencia_meses || 0) > 0,
      fecha_fin_carencia: a.fecha_fin_carencia || '',
      avales: a.avales || '',
      garantias: a.garantias || '',
      moneda: a.moneda || 'EUR',
      limite_credito: isLinea ? (a.limite_credito || 0) : 0,
      dispuesto: isLinea ? (a.dispuesto || 0) : 0,
      activo_asociado: a.activo_asociado || '',
      opcion_compra: a.opcion_compra || 0,
      intereses_pagados: 0,
      capital_amortizado: 0,
      documento_url: fileUrl || '',
      notas: `Importado vía OCR Financiero IA. ${a.analisis_ia ? 'Análisis IA adjunto.' : ''}`,
    });

    // Also save document reference
    if (fileUrl && file) {
      await base44.entities.Document.create({
        company_id: companyId,
        nombre: file.name,
        carpeta: 'Finanzas / Deuda y Financiación',
        archivo_url: fileUrl,
        tipo_archivo: file.type,
        anio: new Date().getFullYear(),
        estado: 'revisado',
        etiquetas: ['deuda', 'financiacion', a.tipo_documento || 'otro'],
        comentarios: `Importado desde OCR Financiero. Entidad: ${a.entidad || '—'}`,
      }).catch(() => {});
    }

    setImporting(false);
    setImported(true);
    setTimeout(() => onImported?.(), 1500);
  };

  const handleReset = () => {
    setStep('upload');
    setFile(null);
    setFileUrl(null);
    setAnalysis(null);
    setImported(false);
  };

  const score = analysis?.scoring_financiero ?? null;
  const scoreStatus = score === null ? null : score >= 70 ? 'green' : score >= 45 ? 'amber' : 'red';

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Zap className="w-4 h-4 text-blue-600" /> OCR Financiero IA
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">Sube un documento bancario y la IA extrae, analiza e importa automáticamente los datos</p>
        </div>
        {step !== 'upload' && (
          <button onClick={handleReset} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-500 hover:bg-slate-100 border border-slate-200 transition-all">
            <RefreshCw className="w-3.5 h-3.5" /> Nuevo análisis
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">

        {/* UPLOAD */}
        {step === 'upload' && (
          <motion.div key="upload" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              className={cn(
                "border-2 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center cursor-pointer transition-all",
                dragging ? "border-taxea-red bg-taxea-red/5 scale-[1.01]" : "border-slate-200 hover:border-taxea-red/40 hover:bg-slate-50"
              )}>
              <input ref={inputRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.xlsx,.csv" className="hidden"
                onChange={e => e.target.files[0] && handleFile(e.target.files[0])} />
              <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center mb-4">
                <Upload className="w-7 h-7 text-blue-500" />
              </div>
              <p className="text-sm font-semibold text-foreground mb-1">Sube tu documento financiero</p>
              <p className="text-xs text-slate-400 text-center max-w-xs">
                Arrastra o haz clic para subir. PDF, imagen o Excel.<br />
                Contratos, cuadros de amortización, leasings, ICOs, pólizas...
              </p>
              <div className="flex gap-2 mt-4 flex-wrap justify-center">
                {['PDF', 'PNG', 'JPG', 'XLSX'].map(ext => (
                  <span key={ext} className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-slate-100 text-slate-500">{ext}</span>
                ))}
              </div>
            </div>

            {/* Tipos soportados */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mt-4">
              {['Préstamo bancario', 'Leasing', 'ICO', 'Póliza crédito', 'Cuadro amortización', 'Renting', 'Aval', 'Refinanciación', 'Oferta bancaria', 'Recibo cuota'].map(t => (
                <div key={t} className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-slate-50 border border-slate-100">
                  <FileText className="w-3 h-3 text-slate-300 flex-shrink-0" />
                  <span className="text-[10px] text-slate-500">{t}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ANALYZING */}
        {step === 'analyzing' && (
          <motion.div key="analyzing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-20 gap-5">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center">
                <FileText className="w-8 h-8 text-blue-400" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-taxea-red rounded-full flex items-center justify-center">
                <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
              </div>
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-foreground mb-1">Analizando documento...</p>
              <p className="text-xs text-slate-400">La IA está leyendo y extrayendo los datos financieros</p>
              {file && <p className="text-[11px] text-slate-300 mt-2 font-mono">{file.name}</p>}
            </div>
            <div className="flex flex-col gap-2 text-xs text-slate-400 text-center">
              {['Leyendo documento...', 'Extrayendo condiciones financieras...', 'Calculando scoring...', 'Generando análisis IA...'].map((s, i) => (
                <div key={i} className="flex items-center gap-2 justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" style={{ animationDelay: `${i * 0.3}s` }} />
                  <span>{s}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* RESULT */}
        {step === 'result' && analysis && (
          <motion.div key="result" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

              {/* LEFT — Documento preview */}
              <div className="space-y-4">
                {/* File info */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-3 shadow-sm">
                  <div className="w-10 h-10 bg-red-50 border border-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5 text-red-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">{file?.name}</p>
                    <p className="text-[10px] text-slate-400">{file ? (file.size / 1024).toFixed(1) + ' KB' : ''} · Procesado con IA</p>
                  </div>
                  {fileUrl && (
                    <a href={fileUrl} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 text-xs font-medium">
                      <Download className="w-3 h-3" /> Ver
                    </a>
                  )}
                </div>

                {/* Datos extraídos */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm font-semibold text-foreground">Datos extraídos</p>
                    {analysis.tipo_documento && (
                      <span className={cn("text-[10px] font-bold px-2.5 py-1 rounded-lg border", TIPO_BADGE[analysis.tipo_documento] || 'bg-slate-100 text-slate-600 border-slate-200')}>
                        {TIPO_LABELS[analysis.tipo_documento] || analysis.tipo_documento}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                    {[
                      { label: 'Entidad', value: analysis.entidad },
                      { label: 'Número contrato', value: analysis.numero_contrato },
                      { label: 'Fecha firma', value: analysis.fecha_firma },
                      { label: 'Fecha vencimiento', value: analysis.fecha_vencimiento },
                      { label: 'Importe concedido', value: analysis.importe_inicial ? fmt(analysis.importe_inicial) : null },
                      { label: 'Capital pendiente', value: analysis.capital_pendiente ? fmt(analysis.capital_pendiente) : null },
                      { label: 'TIN', value: analysis.tin ? `${analysis.tin}%` : null },
                      { label: 'TAE', value: analysis.tae ? `${analysis.tae}%` : null },
                      { label: 'Cuota', value: analysis.cuota ? fmt(analysis.cuota) : null },
                      { label: 'Periodicidad', value: analysis.periodicidad },
                      { label: 'Plazo', value: analysis.plazo_meses ? `${analysis.plazo_meses} meses` : null },
                      { label: 'Intereses totales', value: analysis.intereses_totales ? fmt(analysis.intereses_totales) : null },
                      { label: 'Coste total', value: analysis.coste_total ? fmt(analysis.coste_total) : null },
                      { label: 'Com. apertura', value: analysis.comision_apertura ? fmt(analysis.comision_apertura) : null },
                      { label: 'Carencia', value: analysis.carencia_meses ? `${analysis.carencia_meses} meses` : null },
                      { label: 'Avales', value: analysis.avales },
                      { label: 'IBAN asociado', value: analysis.iban_asociado },
                      { label: 'Tipo interés', value: analysis.tipo_interes },
                    ].filter(f => f.value).map((f, i) => (
                      <div key={i}>
                        <p className="text-[10px] text-slate-400">{f.label}</p>
                        <p className="text-xs font-semibold text-foreground">{f.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* RIGHT — Análisis IA */}
              <div className="space-y-4">
                {/* Scoring */}
                {score !== null && (
                  <div className={cn("rounded-2xl p-5 border shadow-sm",
                    scoreStatus === 'green' ? "bg-emerald-50 border-emerald-200" :
                    scoreStatus === 'amber' ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200")}>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-xs font-semibold text-slate-500 mb-0.5">Scoring financiero IA</p>
                        <p className={cn("text-xs", scoreStatus === 'green' ? "text-emerald-600" : scoreStatus === 'amber' ? "text-amber-600" : "text-red-600")}>
                          {scoreStatus === 'green' ? 'Financiación saludable' : scoreStatus === 'amber' ? 'Revisar condiciones' : 'Financiación cara / riesgosa'}
                        </p>
                      </div>
                      <div className={cn("text-4xl font-jakarta font-bold", scoreStatus === 'green' ? "text-emerald-600" : scoreStatus === 'amber' ? "text-amber-600" : "text-red-600")}>
                        {score}<span className="text-lg font-normal text-slate-400">/100</span>
                      </div>
                    </div>
                    <div className="h-2.5 bg-white/60 rounded-full overflow-hidden">
                      <div className={cn("h-full rounded-full transition-all", scoreStatus === 'green' ? "bg-emerald-500" : scoreStatus === 'amber' ? "bg-amber-500" : "bg-red-500")}
                        style={{ width: `${score}%` }} />
                    </div>
                    {analysis.scoring_razon && <p className="text-[10px] text-slate-500 mt-2">{analysis.scoring_razon}</p>}
                  </div>
                )}

                {/* Análisis IA */}
                {analysis.analisis_ia && (
                  <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-lg">🤖</span>
                      <p className="text-xs font-semibold text-blue-800">Análisis financiero IA</p>
                    </div>
                    <p className="text-xs text-blue-700 leading-relaxed">{analysis.analisis_ia}</p>
                  </div>
                )}

                {/* Conclusión */}
                {analysis.conclusion && (
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                    <p className="text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
                      <Star className="w-3.5 h-3.5 text-amber-400" /> Conclusión
                    </p>
                    <p className="text-xs text-slate-600">{analysis.conclusion}</p>
                  </div>
                )}

                {/* Alertas */}
                {analysis.alertas?.length > 0 && (
                  <div className="space-y-2">
                    {analysis.alertas.map((a, i) => (
                      <div key={i} className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-200">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-700">{a}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Recomendación */}
                {analysis.recomendacion && (
                  <div className="bg-violet-50 border border-violet-200 rounded-2xl p-4">
                    <p className="text-xs font-semibold text-violet-700 mb-1">💡 Recomendación IA</p>
                    <p className="text-xs text-violet-600">{analysis.recomendacion}</p>
                  </div>
                )}

                {/* Comparativa */}
                {analysis.comparativa_mercado && (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                    <p className="text-[10px] font-semibold text-slate-500 mb-1">Comparativa de mercado (orientativa)</p>
                    <p className="text-[11px] text-slate-400">{analysis.comparativa_mercado}</p>
                    <p className="text-[9px] text-slate-300 mt-1">No vinculante · Requiere revisión por asesor financiero</p>
                  </div>
                )}

                {/* CTA Importar */}
                <div className="bg-white border-2 border-taxea-red/20 rounded-2xl p-5 shadow-sm">
                  <p className="text-xs font-semibold text-foreground mb-1">¿Importar a Debt & Financing?</p>
                  <p className="text-[11px] text-slate-400 mb-4">
                    Se creará el instrumento de deuda, se actualizará el calendario, los ratios y el dashboard financiero.
                  </p>
                  {imported ? (
                    <div className="flex items-center gap-2 text-emerald-600 text-sm font-semibold">
                      <CheckCircle className="w-4 h-4" /> ¡Importado correctamente!
                    </div>
                  ) : (
                    <button onClick={handleImport} disabled={importing}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-taxea-red text-white text-sm font-semibold hover:bg-taxea-red/90 transition-all disabled:opacity-40">
                      {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                      {importing ? 'Importando...' : 'Confirmar e importar instrumento'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}