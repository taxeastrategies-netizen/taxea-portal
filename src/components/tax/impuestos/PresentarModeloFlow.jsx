/**
 * PresentarModeloFlow — Modal de 5 pasos para presentación fiscal real
 * Implementa el flujo: Validación → Generar fichero → Elegir vía → Confirmación → Respuesta
 *
 * Arquitectura: Tax Filing Connector Layer
 */

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import {
  AlertCircle, CheckCircle, FileDown, ExternalLink, Upload,
  Loader2, FileText, Shield, ChevronRight, X, AlertTriangle
} from 'lucide-react';

const AEAT_URLS = {
  '303': 'https://sede.agenciatributaria.gob.es/Sede/iva/modelo-303.html',
  '111': 'https://sede.agenciatributaria.gob.es/Sede/retenciones-ingresos-cuenta/modelo-111.html',
  '115': 'https://sede.agenciatributaria.gob.es/Sede/retenciones-ingresos-cuenta/modelo-115.html',
  '130': 'https://sede.agenciatributaria.gob.es/Sede/rendimientos-actividades-economicas/pagos-fraccionados/estimacion-directa/modelo-130.html',
  '390': 'https://sede.agenciatributaria.gob.es/Sede/iva/modelo-390.html',
  '347': 'https://sede.agenciatributaria.gob.es/Sede/declaraciones-informativas/modelo-347.html',
  '349': 'https://sede.agenciatributaria.gob.es/Sede/iva/modelo-349.html',
  '190': 'https://sede.agenciatributaria.gob.es/Sede/retenciones-ingresos-cuenta/modelo-190.html',
  '180': 'https://sede.agenciatributaria.gob.es/Sede/retenciones-ingresos-cuenta/modelo-180.html',
  '193': 'https://sede.agenciatributaria.gob.es/Sede/retenciones-ingresos-cuenta/modelo-193.html',
  '123': 'https://sede.agenciatributaria.gob.es/Sede/retenciones-ingresos-cuenta/modelo-123.html',
};

const ATC_URLS = {
  '420': 'https://www3.gobiernodecanarias.org/tributos/portaltributos/index.html',
  '425': 'https://www3.gobiernodecanarias.org/tributos/portaltributos/index.html',
  '415': 'https://www3.gobiernodecanarias.org/tributos/portaltributos/index.html',
};

const ADMINISTRACION_POR_MODELO = {
  '303': 'AEAT', '390': 'AEAT', '349': 'AEAT', '347': 'AEAT',
  '130': 'AEAT', '111': 'AEAT', '123': 'AEAT', '115': 'AEAT',
  '180': 'AEAT', '190': 'AEAT', '193': 'AEAT',
  '420': 'ATC',  '425': 'ATC',  '415': 'ATC',
};

function StepIndicator({ step, current }) {
  const done = current > step;
  const active = current === step;
  return (
    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all
      ${done ? 'bg-green-500 border-green-500 text-white' : active ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-300 text-gray-400'}`}>
      {done ? <CheckCircle className="w-4 h-4" /> : step}
    </div>
  );
}

export default function PresentarModeloFlow({ modelo, companyId, clienteNif, clienteNombre, ejercicio, periodo, onClose, onPresentado }) {
  const qc = useQueryClient();
  const [step, setStep] = useState(1);
  const [fichero, setFichero] = useState(null);
  const [resumen, setResumen] = useState(null);
  const [avisos, setAvisos] = useState([]);
  const [erroresBloqueo, setErroresBloqueo] = useState([]);
  const [viaSeleccionada, setViaSeleccionada] = useState(null);
  const [confirmado, setConfirmado] = useState(false);
  const [justificanteNum, setJustificanteNum] = useState('');
  const [csvCode, setCsvCode] = useState('');
  const [submissionResult, setSubmissionResult] = useState(null);
  const [justificanteFile, setJustificanteFile] = useState(null);

  const administracion = ADMINISTRACION_POR_MODELO[modelo] || 'AEAT';
  const sedeUrl = administracion === 'ATC' ? ATC_URLS[modelo] : AEAT_URLS[modelo];

  // ── Step 1 → 2: Validar y generar fichero
  const generarFichero = useMutation({
    mutationFn: () => base44.functions.invoke('generateFiscalFile', {
      modeloCodigo: modelo,
      companyId,
      ejercicio,
      periodo,
    }),
    onSuccess: (res) => {
      const data = res.data;
      if (!data.ok) {
        setErroresBloqueo(data.erroresBloqueo || []);
        setAvisos(data.avisos || []);
        return;
      }
      setFichero(data.fichero);
      setResumen(data.resumen);
      setAvisos(data.avisos || []);
      setErroresBloqueo([]);
      setStep(2);
    },
    onError: (err) => setErroresBloqueo([err.message || 'Error generando fichero.']),
  });

  // ── Registrar presentación final
  const registrarSubmission = useMutation({
    mutationFn: (data) => base44.entities.TaxSubmission.create(data),
    onSuccess: (sub) => {
      setSubmissionResult(sub);
      qc.invalidateQueries({ queryKey: ['taxFilings', companyId] });
      qc.invalidateQueries({ queryKey: ['taxSubmissions', companyId] });
      if (onPresentado) onPresentado(sub);
      setStep(5);
    },
  });

  // ── Descarga local del fichero desde base64
  function descargarFichero() {
    if (!fichero?.contenidoBase64) return;
    const bytes = Uint8Array.from(atob(fichero.contenidoBase64), c => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fichero.nombreFichero;
    a.click();
    URL.revokeObjectURL(url);
    // Mark as downloaded
    base44.entities.TaxOfficialFile.update(fichero.id, { estado: 'descargado' });
  }

  function abrirSede() {
    if (sedeUrl) window.open(sedeUrl, '_blank');
  }

  function confirmarPresentacion() {
    registrarSubmission.mutate({
      companyId,
      clienteNif,
      modeloCodigo: modelo,
      ejercicio,
      periodo,
      administracion,
      viaPresentacion: viaSeleccionada,
      taxOfficialFileId: fichero?.id || null,
      usuarioPresentador: 'asesor',
      fechaEnvio: new Date().toISOString(),
      estado: viaSeleccionada === 'presentacion_manual_externa' ? 'pendiente' : 'enviado',
      numeroJustificante: justificanteNum || null,
      csv: csvCode || null,
      importeFinal: parseFloat(resumen?.resultado || 0),
      confirmacionExplicitaUsuario: true,
    });
  }

  const STEPS = ['Validación', 'Fichero', 'Vía', 'Confirmación', 'Resultado'];

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-base font-bold text-gray-900">Presentar modelo {modelo}</h2>
            <p className="text-xs text-gray-500">{clienteNombre} · {clienteNif} · {periodo} {ejercicio} · {administracion}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-0 px-6 py-4 border-b border-gray-100">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center">
              <div className="flex flex-col items-center gap-1">
                <StepIndicator step={i + 1} current={step} />
                <span className={`text-xs hidden sm:block ${step === i + 1 ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>{s}</span>
              </div>
              {i < STEPS.length - 1 && <div className={`w-8 sm:w-12 h-0.5 mx-1 ${step > i + 1 ? 'bg-green-400' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-4">

          {/* PASO 1 — Validación previa */}
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-800">Paso 1 — Validación previa</h3>

              {/* Resumen del modelo */}
              <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 text-sm space-y-2">
                {[
                  ['Modelo', modelo],
                  ['Administración', administracion],
                  ['Cliente', clienteNombre],
                  ['NIF/CIF', clienteNif || '⚠ No configurado'],
                  ['Ejercicio', ejercicio],
                  ['Período', periodo],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-gray-500">{k}</span>
                    <span className={`font-medium ${v?.toString().startsWith('⚠') ? 'text-red-600' : 'text-gray-800'}`}>{v}</span>
                  </div>
                ))}
              </div>

              {administracion === 'ATC' && (
                <div className="flex gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg text-xs text-orange-700">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  Este modelo pertenece a la Agencia Tributaria Canaria. No se presentará en AEAT.
                </div>
              )}

              {erroresBloqueo.length > 0 && (
                <div className="space-y-2">
                  {erroresBloqueo.map((e, i) => (
                    <div key={i} className="flex gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />{e}
                    </div>
                  ))}
                </div>
              )}

              {avisos.length > 0 && (
                <div className="space-y-1">
                  {avisos.map((a, i) => (
                    <div key={i} className="flex gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />{a}
                    </div>
                  ))}
                </div>
              )}

              <Button className="w-full gap-2" onClick={() => generarFichero.mutate()} disabled={generarFichero.isPending}>
                {generarFichero.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                {generarFichero.isPending ? 'Validando datos y generando fichero…' : 'Validar y generar fichero oficial'}
              </Button>
            </div>
          )}

          {/* PASO 2 — Fichero generado */}
          {step === 2 && fichero && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-800">Paso 2 — Fichero oficial generado</h3>

              <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="font-semibold text-green-800">Fichero generado correctamente</span>
                </div>
                {[
                  ['Nombre', fichero.nombreFichero],
                  ['Extensión', `.${fichero.extension}`],
                  ['Formato', fichero.formato],
                  ['Versión diseño', fichero.versionDiseno],
                  ['Administración', fichero.administracion],
                  ['Hash SHA-256', <span className="font-mono text-xs">{fichero.hash?.slice(0, 20)}…</span>],
                  ['Generado', new Date(fichero.fechaGeneracion).toLocaleString('es-ES')],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4">
                    <span className="text-gray-500 flex-shrink-0">{k}</span>
                    <span className="font-medium text-gray-800 text-right">{v}</span>
                  </div>
                ))}
              </div>

              {fichero.avisos?.length > 0 && fichero.avisos.map((a, i) => (
                <div key={i} className="flex gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />{a}
                </div>
              ))}

              {resumen && (
                <div className="grid grid-cols-3 gap-3 text-xs">
                  {[
                    ['Cuota repercutida', `${resumen.cuota_repercutida} €`, 'text-blue-700'],
                    ['Cuota soportada', `${resumen.cuota_soportada} €`, 'text-orange-600'],
                    ['Resultado', `${resumen.resultado} €`, parseFloat(resumen.resultado) >= 0 ? 'text-red-600' : 'text-green-600'],
                  ].map(([k, v, c]) => (
                    <div key={k} className="bg-white border border-gray-200 rounded-lg p-3">
                      <p className="text-gray-500 mb-1">{k}</p>
                      <p className={`font-bold ${c}`}>{v}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 gap-2" onClick={descargarFichero}>
                  <FileDown className="w-4 h-4" /> Descargar fichero
                </Button>
                <Button className="flex-1 gap-2" onClick={() => setStep(3)}>
                  Elegir vía de presentación <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* PASO 3 — Elegir vía */}
          {step === 3 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-800">Paso 3 — Elige la vía de presentación</h3>
              <p className="text-xs text-gray-500">Solo se muestran las opciones aplicables a este modelo y administración.</p>

              <div className="space-y-2">
                {administracion === 'AEAT' && (
                  <ViaOption
                    id="fichero_oficial_sede"
                    selected={viaSeleccionada}
                    onSelect={setViaSeleccionada}
                    title="Subir fichero en sede AEAT"
                    desc="Descarga el fichero .dat y súbelo en la Sede Electrónica de la AEAT. Recomendado cuando no existe API directa validada."
                    badge="Flujo asistido"
                    badgeColor="bg-blue-100 text-blue-700"
                    icon={<ExternalLink className="w-4 h-4 text-blue-600" />}
                  />
                )}
                {administracion === 'ATC' && (
                  <ViaOption
                    id="fichero_oficial_sede"
                    selected={viaSeleccionada}
                    onSelect={setViaSeleccionada}
                    title="Subir fichero en sede ATC"
                    desc="Descarga el fichero y súbelo en la sede de la Agencia Tributaria Canaria."
                    badge="Flujo asistido"
                    badgeColor="bg-orange-100 text-orange-700"
                    icon={<ExternalLink className="w-4 h-4 text-orange-600" />}
                  />
                )}
                <ViaOption
                  id="exportacion_a3"
                  selected={viaSeleccionada}
                  onSelect={setViaSeleccionada}
                  title="Exportar paquete para A3"
                  desc="Genera un paquete auxiliar para revisión e importación en A3. Exportación auxiliar — no garantizada hasta validación."
                  badge="Auxiliar revisión"
                  badgeColor="bg-purple-100 text-purple-700"
                  icon={<FileDown className="w-4 h-4 text-purple-600" />}
                />
                <ViaOption
                  id="presentacion_manual_externa"
                  selected={viaSeleccionada}
                  onSelect={setViaSeleccionada}
                  title="Marcar presentado externamente"
                  desc="La presentación se ha realizado fuera de Taxea. Registra el justificante para cerrar la obligación fiscal."
                  badge="Presentación manual"
                  badgeColor="bg-gray-100 text-gray-600"
                  icon={<Upload className="w-4 h-4 text-gray-500" />}
                />
              </div>

              {viaSeleccionada === 'fichero_oficial_sede' && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700 space-y-2">
                  <p className="font-medium">Instrucciones para flujo asistido:</p>
                  <ol className="list-decimal ml-4 space-y-1">
                    <li>Descarga el fichero <span className="font-mono">{fichero?.nombreFichero}</span> (paso anterior).</li>
                    <li>Abre la sede electrónica {administracion}.</li>
                    <li>Selecciona el Modelo {modelo} → Presentación telemática por fichero.</li>
                    <li>Sube el fichero descargado.</li>
                    <li>Anota el número de justificante y CSV que te devuelva la sede.</li>
                    <li>Vuelve aquí y registra el justificante.</li>
                  </ol>
                  {sedeUrl && (
                    <Button size="sm" variant="outline" className="gap-1.5 mt-2 text-xs h-7 border-blue-300 text-blue-700" onClick={abrirSede}>
                      <ExternalLink className="w-3 h-3" /> Abrir sede {administracion}
                    </Button>
                  )}
                </div>
              )}

              <Button className="w-full" disabled={!viaSeleccionada} onClick={() => setStep(4)}>
                Continuar <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          )}

          {/* PASO 4 — Confirmación */}
          {step === 4 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-gray-800">Paso 4 — Confirmación</h3>

              <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 text-sm space-y-2">
                {[
                  ['Modelo', modelo],
                  ['Cliente / NIF', `${clienteNombre} / ${clienteNif}`],
                  ['Período', `${periodo} ${ejercicio}`],
                  ['Administración', administracion],
                  ['Vía', viaSeleccionada?.replace(/_/g, ' ')],
                  ['Fichero', fichero?.nombreFichero],
                  ['Hash', <span className="font-mono text-xs">{fichero?.hash?.slice(0, 16)}…</span>],
                  ['Resultado', `${resumen?.resultado || '—'} €`],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4">
                    <span className="text-gray-500">{k}</span>
                    <span className="font-medium text-gray-800 text-right">{v}</span>
                  </div>
                ))}
              </div>

              {viaSeleccionada !== 'exportacion_a3' && (
                <div className="space-y-3">
                  <p className="text-xs font-medium text-gray-600">Si ya tienes el justificante de {administracion}:</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Nº Justificante</label>
                      <input value={justificanteNum} onChange={e => setJustificanteNum(e.target.value)}
                        placeholder="Ej: 2520303000001"
                        className="w-full text-sm border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">CSV</label>
                      <input value={csvCode} onChange={e => setCsvCode(e.target.value)}
                        placeholder="Código seguro verificación"
                        className="w-full text-sm border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400" />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <input type="checkbox" id="confirm" checked={confirmado} onChange={e => setConfirmado(e.target.checked)}
                  className="mt-0.5 flex-shrink-0" />
                <label htmlFor="confirm" className="text-xs text-amber-800 cursor-pointer">
                  <strong>Confirmo que he revisado los datos del modelo {modelo}, período {periodo} {ejercicio}</strong>
                  {' '}y autorizo registrar esta presentación en Taxea Portal.
                  No se puede deshacer una vez marcado como presentado.
                </label>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setStep(3)}>Volver</Button>
                <Button className="flex-1 gap-2" disabled={!confirmado || registrarSubmission.isPending}
                  onClick={confirmarPresentacion}>
                  {registrarSubmission.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                  Registrar presentación
                </Button>
              </div>
            </div>
          )}

          {/* PASO 5 — Resultado */}
          {step === 5 && submissionResult && (
            <div className="space-y-4">
              <div className="flex flex-col items-center py-4 text-center">
                <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mb-3">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-base font-bold text-gray-900">Presentación registrada</h3>
                <p className="text-sm text-gray-500 mt-1">
                  El modelo {modelo} — {periodo} {ejercicio} ha sido registrado en Taxea.
                </p>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm space-y-2">
                {[
                  ['ID Presentación', submissionResult.id?.slice(0, 12) + '…'],
                  ['Vía', submissionResult.viaPresentacion?.replace(/_/g, ' ')],
                  ['Estado', submissionResult.estado],
                  ['Nº Justificante', submissionResult.numeroJustificante || '— (pendiente añadir)'],
                  ['CSV', submissionResult.csv || '— (pendiente añadir)'],
                  ['Importe', `${submissionResult.importeFinal?.toFixed(2) || '0.00'} €`],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-gray-500">{k}</span>
                    <span className="font-medium text-gray-800">{v}</span>
                  </div>
                ))}
              </div>

              {(submissionResult.viaPresentacion === 'fichero_oficial_sede' || submissionResult.viaPresentacion === 'flujo_asistido') && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
                  Sube el justificante oficial para cerrar la obligación fiscal. Puedes añadirlo desde la pestaña <strong>Presentaciones</strong>.
                </div>
              )}

              <Button className="w-full" onClick={onClose}>Cerrar</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ViaOption({ id, selected, onSelect, title, desc, badge, badgeColor, icon }) {
  const isSelected = selected === id;
  return (
    <button onClick={() => onSelect(id)}
      className={`w-full text-left p-3.5 rounded-xl border-2 transition-all flex items-start gap-3
        ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${isSelected ? 'bg-blue-100' : 'bg-gray-100'}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-sm font-semibold ${isSelected ? 'text-blue-800' : 'text-gray-800'}`}>{title}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${badgeColor}`}>{badge}</span>
        </div>
        <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
      </div>
      <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-1 ${isSelected ? 'border-blue-500 bg-blue-500' : 'border-gray-300'}`}>
        {isSelected && <div className="w-full h-full rounded-full flex items-center justify-center"><div className="w-2 h-2 rounded-full bg-white" /></div>}
      </div>
    </button>
  );
}