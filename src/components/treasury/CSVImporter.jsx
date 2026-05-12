import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileSpreadsheet, X, CheckCircle, AlertCircle, ChevronDown, Info } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { cn } from '@/lib/utils';

const BANK_FORMATS = [
  { id: 'revolut',   name: 'Revolut Business',  cols: 'Completed Date, Description, Amount, Balance' },
  { id: 'wise',      name: 'Wise Business',      cols: 'Date, Description, Amount, Running Balance' },
  { id: 'qonto',     name: 'Qonto',             cols: 'Emitted Date, Label, Amount (EUR)' },
  { id: 'bbva',      name: 'BBVA',              cols: 'F.Operacion, Concepto, Importe, Saldo' },
  { id: 'santander', name: 'Santander',          cols: 'Fecha, Concepto, Cargo/Abono, Saldo' },
  { id: 'caixabank', name: 'CaixaBank',         cols: 'Fecha, Concepto, Importe, Saldo' },
  { id: 'sabadell',  name: 'Sabadell',           cols: 'Fecha operacion, Concepto, Importe' },
  { id: 'bankinter', name: 'Bankinter',          cols: 'Fecha, Concepto, Importe, Saldo' },
  { id: 'generic',   name: 'Otro banco (genérico)', cols: 'Fecha, Concepto, Importe, Saldo' },
];

export default function CSVImporter({ account, companyId, onImported, onClose }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showFormats, setShowFormats] = useState(false);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef();

  const readFile = (f) => {
    if (!f) return;
    setFile(f);
    setResult(null);
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const lines = text.split('\n').filter(l => l.trim());
      setPreview({
        headers: lines[0],
        sample: lines.slice(1, 4),
        total_lines: lines.length - 1,
        content: text,
      });
    };
    reader.readAsText(f, 'utf-8');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files[0];
    if (f && (f.name.endsWith('.csv') || f.name.endsWith('.txt'))) readFile(f);
    else setError('Solo se admiten archivos CSV o TXT');
  };

  const handleImport = async () => {
    if (!preview?.content) return;
    setLoading(true);
    setError(null);
    const res = await base44.functions.invoke('bankSync', {
      action: 'import_csv',
      bank_account_id: account.id,
      company_id: companyId,
      csv_content: preview.content,
      csv_filename: file.name,
    });
    setLoading(false);
    if (res.data?.ok) {
      setResult(res.data);
    } else {
      setError(res.data?.error || 'Error al importar');
    }
  };

  const handleDone = () => {
    if (result) onImported();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <div>
              <p className="text-sm font-semibold text-foreground">Importar extracto bancario</p>
              <p className="text-xs text-slate-400">{account.nombre_banco} · {account.iban ? account.iban.slice(-4) : '—'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <AnimatePresence mode="wait">

            {/* Resultado exitoso */}
            {result && (
              <motion.div key="result" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="space-y-4">
                <div className="flex flex-col items-center py-6 text-center gap-3">
                  <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center">
                    <CheckCircle className="w-7 h-7 text-emerald-600" />
                  </div>
                  <p className="text-base font-semibold text-foreground">¡Importación completada!</p>
                  <div className="flex gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-emerald-600">{result.movimientos_nuevos}</p>
                      <p className="text-xs text-slate-400">movimientos nuevos</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-slate-400">{result.movimientos_duplicados}</p>
                      <p className="text-xs text-slate-400">duplicados omitidos</p>
                    </div>
                  </div>
                  <div className="px-3 py-1.5 rounded-lg bg-slate-100 text-xs text-slate-500 font-mono">
                    Formato detectado: <span className="font-semibold text-slate-700">{result.format_detectado}</span>
                  </div>
                  {result.errores?.length > 0 && (
                    <div className="w-full p-3 rounded-xl bg-amber-50 border border-amber-200 text-left">
                      <p className="text-xs font-semibold text-amber-700 mb-1">Avisos ({result.errores.length})</p>
                      {result.errores.map((e, i) => <p key={i} className="text-xs text-amber-600">{e}</p>)}
                    </div>
                  )}
                </div>
                <button onClick={handleDone}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold bg-taxea-red text-white hover:bg-taxea-red/90 transition-all">
                  Ver movimientos
                </button>
              </motion.div>
            )}

            {/* Upload zone */}
            {!result && (
              <motion.div key="upload" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">

                {/* Formatos soportados */}
                <button onClick={() => setShowFormats(!showFormats)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-blue-50 border border-blue-100 text-left">
                  <div className="flex items-center gap-2">
                    <Info className="w-3.5 h-3.5 text-blue-500" />
                    <span className="text-xs text-blue-600 font-medium">Formatos bancarios soportados</span>
                  </div>
                  <ChevronDown className={cn("w-3.5 h-3.5 text-blue-400 transition-transform", showFormats && "rotate-180")} />
                </button>
                <AnimatePresence>
                  {showFormats && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden">
                      <div className="space-y-1.5 pb-2">
                        {BANK_FORMATS.map(b => (
                          <div key={b.id} className="flex items-start gap-3 px-3 py-2 rounded-lg bg-slate-50 border border-slate-100">
                            <div className="flex-1">
                              <p className="text-xs font-semibold text-foreground">{b.name}</p>
                              <p className="text-[10px] text-slate-400 font-mono">{b.cols}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Drop zone */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                  onDragLeave={() => setDrag(false)}
                  onDrop={handleDrop}
                  onClick={() => inputRef.current?.click()}
                  className={cn(
                    "border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all",
                    drag ? "border-taxea-red/40 bg-taxea-red/5" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                  )}
                >
                  <input ref={inputRef} type="file" accept=".csv,.txt" className="hidden"
                    onChange={e => readFile(e.target.files[0])} />
                  <Upload className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm font-medium text-slate-600">Arrastra tu extracto bancario aquí</p>
                  <p className="text-xs text-slate-400 mt-1">o haz clic para seleccionar · CSV / TXT</p>
                  <p className="text-[10px] text-slate-300 mt-3">El archivo se procesa en tu navegador. No se envían credenciales.</p>
                </div>

                {/* Preview */}
                {preview && (
                  <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-emerald-500" />
                        <p className="text-xs font-semibold text-foreground">{file.name}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">{preview.total_lines} filas</span>
                        <button onClick={() => { setFile(null); setPreview(null); }}
                          className="p-1 hover:bg-slate-100 rounded">
                          <X className="w-3 h-3 text-slate-400" />
                        </button>
                      </div>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3 overflow-x-auto">
                      <p className="text-[10px] text-slate-400 mb-1 font-medium">Cabeceras:</p>
                      <p className="text-xs font-mono text-slate-600 truncate">{preview.headers}</p>
                      {preview.sample.map((l, i) => (
                        <p key={i} className="text-[10px] font-mono text-slate-400 truncate mt-0.5">{l}</p>
                      ))}
                    </div>
                  </motion.div>
                )}

                {error && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200">
                    <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                    <p className="text-xs text-red-600">{error}</p>
                  </div>
                )}

                <button disabled={!preview || loading} onClick={handleImport}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold bg-taxea-red text-white disabled:opacity-40 hover:bg-taxea-red/90 transition-all flex items-center justify-center gap-2">
                  {loading
                    ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Procesando...</>
                    : <><Upload className="w-4 h-4" /> Importar movimientos</>
                  }
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}