import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useCompanyContext } from '@/lib/useCompanyContext';
import { AlertCircle, AlertTriangle, Calculator, CheckCircle2, Download, FileCheck2, FileJson, Loader2, Plus, RefreshCw, Save, ShieldCheck, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';

const PERIODS = {
  anual: ['Anual'],
  trimestral: ['1T', '2T', '3T', '4T'],
  mensual: ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'],
};

const MODEL_130_ADJUSTMENTS = [
  ['previousPayments', 'Pagos fraccionados anteriores (casilla 05)'],
  ['withholdings', 'Retenciones soportadas acumuladas (casilla 06)'],
  ['article110Reduction', 'Minoración art. 110.3 RIRPF (casilla 13)'],
  ['priorNegativeResults', 'Resultados negativos anteriores (casilla 15)'],
  ['housingDeduction', 'Deducción vivienda habitual (casilla 16)'],
  ['previousSamePeriodResult', 'Resultado previo de la misma autoliquidación'],
  ['agricultureRevenue', 'Ingresos agrícolas/ganaderos del trimestre'],
  ['agricultureWithholdings', 'Retenciones agrícolas/ganaderas'],
];

const INDIRECT_TAX_MODELS = ['303', '420'];

const MODEL_180_FIELDS = [
  ['recipientProvinceCode', 'Provincia perceptor (2 dígitos)', 'text'],
  ['cadastralReference', 'Referencia catastral', 'text'],
  ['roadType', 'Tipo vía INE', 'text'], ['roadName', 'Nombre de la vía', 'text'], ['houseNumber', 'Número', 'text'],
  ['locality', 'Localidad', 'text'], ['municipality', 'Municipio', 'text'], ['municipalityCode', 'Código municipio INE (5 dígitos)', 'text'],
  ['propertyProvinceCode', 'Provincia inmueble (2 dígitos)', 'text'], ['postalCode', 'Código postal', 'text'],
  ['complement', 'Complemento de dirección', 'text'], ['representativeTaxId', 'NIF representante (si procede)', 'text'],
];

const MODEL_190_NUMERIC_FIELDS = [
  ['reductions', 'Reducciones aplicables'], ['deductibleExpenses', 'Gastos deducibles'],
  ['compensatoryPensions', 'Pensiones compensatorias'], ['childSupport', 'Anualidades por alimentos'],
];

const MODEL_193_NATURES = {
  A: [['01', 'Primas por asistencia'], ['02', 'Dividendos y beneficios'], ['03', 'Otros activos con participación'], ['04', 'Derechos de uso sobre valores'], ['05', 'Otras utilidades de socio'], ['06', 'Rendimientos exentos'], ['07', 'Dividendos IIC'], ['08', 'Dividendos sin retención']],
  B: [['01', 'Intereses de títulos privados'], ['02', 'Intereses de títulos públicos'], ['03', 'Intereses de préstamos no bancarios'], ['04', 'Régimen transitorio financiero'], ['05', 'Cesión de crédito por entidad financiera'], ['06', 'Otros rendimientos'], ['07', 'Rendimientos exentos']],
  C: [['01', 'Propiedad intelectual, no autor'], ['02', 'Propiedad industrial'], ['03', 'Asistencia técnica'], ['04', 'Arrendamiento de muebles, negocios o minas'], ['05', 'Rentas vitalicias o temporales'], ['06', 'Derechos de imagen IRPF'], ['07', 'Subarrendamiento urbano IRPF'], ['08', 'Derechos de imagen IS/IRNR-EP'], ['09', 'Premios IS/IRNR-EP'], ['10', 'Administradores IS/IRNR-EP'], ['11', 'Rendimientos exentos'], ['12', 'Otros · base general'], ['13', 'Otros · base del ahorro'], ['14', 'Otros · no IRPF'], ['15', 'Anticipos de derechos de autor']],
  D: [['01', 'Intereses de títulos privados'], ['02', 'Intereses de títulos públicos'], ['03', 'Intereses de préstamos no bancarios'], ['04', 'Régimen transitorio financiero'], ['05', 'Cesión de crédito por entidad financiera'], ['06', 'Otros rendimientos'], ['07', 'Rendimientos exentos']],
};

const MODEL_193_MONEY_FIELDS = [
  ['perceptionAmount', 'Importe íntegro de la percepción'], ['reductions', 'Reducciones'], ['retentionBase', 'Base de retención'], ['retentionRate', 'Último tipo de retención (%)'], ['penalties', 'Penalizaciones'],
];

const THIRD_PARTY_SPECIAL_FIELDS = [
  ['cashAmount', 'Cobros en metálico (> 6.000 €)'], ['cashAccountingAnnualAmount', 'Devengado anual por criterio de caja'],
  ['propertyRentAmount', 'Arrendamientos de locales · anual'], ['propertyTransferAmount', 'Transmisiones de inmuebles · anual'],
];

const PROPERTY_FIELDS = [
  ['cadastralReference', 'Referencia catastral'], ['roadType', 'Tipo de vía'], ['roadName', 'Nombre de la vía'], ['numberingType', 'Tipo número'],
  ['houseNumber', 'Número'], ['numberQualifier', 'Calificador'], ['block', 'Bloque'], ['portal', 'Portal'], ['stair', 'Escalera'], ['floor', 'Piso'], ['door', 'Puerta'],
  ['complement', 'Complemento'], ['locality', 'Localidad'], ['municipality', 'Municipio'], ['municipalityCode', 'Código INE municipio'], ['provinceCode', 'Provincia'], ['postalCode', 'Código postal'],
];


function formatMoney(value) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(Number(value) || 0);
}

function periodsFor(definition, fiscalProfile) {
  if (definition.frequency === 'anual') return PERIODS.anual;
  if (definition.code === '130' || definition.code === '420') return PERIODS.trimestral;
  if (definition.frequency.includes('mensual') && (fiscalProfile?.isLargeCompany || fiscalProfile?.isREDEME || fiscalProfile?.usesSII)) return PERIODS.mensual;
  return PERIODS.trimestral;
}

function downloadBase64(file) {
  if (!file?.contentBase64) return;
  const bytes = Uint8Array.from(atob(file.contentBase64), char => char.charCodeAt(0));
  const blob = new Blob([bytes], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.filename;
  link.click();
  URL.revokeObjectURL(url);
}

function boxesToText(boxes = {}) {
  return Object.entries(boxes).sort(([a], [b]) => a.localeCompare(b, 'es', { numeric: true })).map(([code, value]) => `${code}=${value}`).join('\n');
}

function boxesFromText(text) {
  return Object.fromEntries(String(text || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(line => {
    const [code, ...rest] = line.split(/[=:;]/);
    const normalized = rest.join('.').trim().replace(/\s|€|EUR/gi, '').replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.');
    return [String(code || '').trim().toUpperCase().replace(/^CASILLA\s*/i, ''), Number(normalized)];
  }).filter(([code, value]) => code && Number.isFinite(value)));
}

async function fileSha256(file) {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
}

function FiledReturnImport({ companyId, modelCode, year, period, onImported }) {
  const [open, setOpen] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [fileInfo, setFileInfo] = useState(null);
  const [form, setForm] = useState({ presentationDate: '', justificationNumber: '', previousJustificationNumber: '', declarationType: 'original', result: '', resultDisposition: '', boxesText: '', confirmed: false });

  const reset = () => { setError(''); setNotice(''); setFileInfo(null); setForm({ presentationDate: '', justificationNumber: '', previousJustificationNumber: '', declarationType: 'original', result: '', resultDisposition: '', boxesText: '', confirmed: false }); };

  async function analyzeFile(file) {
    if (!file) return;
    setWorking(true); setError(''); setNotice('');
    try {
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      const [hash, upload] = await Promise.all([fileSha256(file), base44.integrations.Core.UploadFile({ file })]);
      let rawContent = '';
      let extracted = {};
      if (isPdf) {
        const response = await base44.integrations.Core.ExtractDataFromUploadedFile({
          file_url: upload.file_url,
          json_schema: {
            type: 'object',
            properties: {
              modelo: { type: 'string' }, ejercicio: { type: 'number' }, periodo: { type: 'string' }, nif_cif: { type: 'string' },
              fechaPresentacion: { type: 'string' }, numeroJustificante: { type: 'string' }, tipoDeclaracion: { type: 'string' }, importeFinal: { type: 'number' }, resultadoDestino: { type: 'string' },
              fields: { type: 'array', items: { type: 'object', properties: { code: { type: 'string' }, label: { type: 'string' }, value: { type: 'number' } } } },
            },
          },
        });
        extracted = response?.output || response || {};
      } else {
        rawContent = await file.text();
        if (rawContent.length > 2000000) throw new Error('El fichero supera el límite de 2 MB para lectura estructurada.');
      }
      const response = await base44.functions.invoke('taxModelOperations', {
        action: 'preview_filed_return', companyId, modeloCodigo: modelCode, ejercicio: year, periodo: period,
        rawContent, extracted, fileUrl: upload.file_url, fileName: file.name, fileHash: hash,
        presentationDate: extracted.fechaPresentacion || '', justificationNumber: extracted.numeroJustificante || '', declarationType: extracted.tipoDeclaracion || 'original',
      });
      const data = response.data;
      setFileInfo({ fileUrl: upload.file_url, fileName: file.name, fileHash: hash, rawContent, extracted, preview: data.preview, warnings: data.warnings || [] });
      setForm(current => ({ ...current, presentationDate: data.preview?.presentationDate || current.presentationDate, justificationNumber: data.preview?.justificationNumber || current.justificationNumber, declarationType: data.preview?.declarationType || 'original', result: data.preview?.result ?? '', resultDisposition: data.preview?.resultDisposition || '', boxesText: boxesToText(data.preview?.boxes), confirmed: false }));
      if (data.errors?.length) setError(data.errors.join(' '));
      if (data.warnings?.length) setNotice(data.warnings.join(' '));
    } catch (caught) {
      setError(caught?.response?.data?.error || caught?.message || 'No se pudo analizar el modelo presentado.');
    } finally { setWorking(false); }
  }

  async function importSnapshot() {
    if (!fileInfo) return setError('Selecciona el fichero o justificante presentado.');
    if (!form.confirmed) return setError('Confirma que las casillas coinciden con la declaración presentada.');
    setWorking(true); setError(''); setNotice('');
    try {
      const response = await base44.functions.invoke('taxModelOperations', {
        action: 'import_filed_return', companyId, modeloCodigo: modelCode, ejercicio: year, periodo: period,
        rawContent: fileInfo.rawContent, extracted: fileInfo.extracted, fileUrl: fileInfo.fileUrl, fileName: fileInfo.fileName, fileHash: fileInfo.fileHash,
        presentationDate: form.presentationDate, justificationNumber: form.justificationNumber, previousJustificationNumber: form.previousJustificationNumber,
        declarationType: form.declarationType, importeFinal: form.result === '' ? undefined : Number(form.result), resultDisposition: form.resultDisposition, presentedBoxes: boxesFromText(form.boxesText), confirmImport: true,
      });
      setNotice(response.data?.alreadyImported ? 'Este modelo ya estaba guardado; no se creó un duplicado.' : 'Modelo presentado guardado. Los períodos posteriores ya pueden usar su arrastre.');
      onImported?.();
    } catch (caught) {
      const payload = caught?.response?.data;
      setError(payload?.blockers?.join(' ') || payload?.error || caught?.message || 'No se pudo guardar el modelo presentado.');
    } finally { setWorking(false); }
  }

  return (
    <section className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><h3 className="text-sm font-semibold text-slate-800">Histórico presentado y arrastres</h3><p className="mt-1 text-xs leading-5 text-slate-600">Importa la declaración realmente presentada. Taxea conserva sus casillas como una foto, evita duplicados y compara las facturas incorporadas después.</p></div>
        <Button type="button" variant="outline" className="gap-2 border-blue-300 bg-white" onClick={() => { setOpen(value => !value); if (open) reset(); }}><Upload className="h-4 w-4" />{open ? 'Cerrar importación' : 'Importar modelo presentado'}</Button>
      </div>
      {open && <div className="mt-4 space-y-3 rounded-xl border border-blue-200 bg-white p-4">
        <label className="block cursor-pointer rounded-xl border border-dashed border-blue-300 bg-blue-50/40 p-4 text-center text-xs text-blue-800"><input type="file" className="hidden" accept=".pdf,.txt,.111,.115,.123,.130,.180,.190,.193,.303,.347,.390,.415,.420,.425,application/pdf,text/plain" onChange={event => analyzeFile(event.target.files?.[0])} />{working ? <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Analizando…</span> : fileInfo ? fileInfo.fileName : 'Seleccionar fichero oficial o justificante PDF'}</label>
        {fileInfo && <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="text-xs text-slate-600">Fecha de presentación<input type="date" value={form.presentationDate} onChange={event => setForm(current => ({ ...current, presentationDate: event.target.value, confirmed: false }))} className="mt-1 h-9 w-full rounded border px-2" /></label>
            <label className="text-xs text-slate-600">Justificante o CSV<input value={form.justificationNumber} onChange={event => setForm(current => ({ ...current, justificationNumber: event.target.value, confirmed: false }))} className="mt-1 h-9 w-full rounded border px-2" /></label>
            <label className="text-xs text-slate-600">Tipo de declaración<select value={form.declarationType} onChange={event => setForm(current => ({ ...current, declarationType: event.target.value, confirmed: false }))} className="mt-1 h-9 w-full rounded border px-2"><option value="original">Original</option><option value="complementaria">Complementaria</option><option value="rectificativa">Rectificativa</option><option value="sustitutiva">Sustitutiva</option></select></label>
            <label className="text-xs text-slate-600">Resultado presentado<input type="number" step="0.01" value={form.result} onChange={event => setForm(current => ({ ...current, result: event.target.value, confirmed: false }))} className="mt-1 h-9 w-full rounded border px-2" /></label>
          </div>
          {['303', '420'].includes(modelCode) && Number(form.result) < 0 && <label className="block text-xs text-slate-600">Destino del resultado negativo presentado<select value={form.resultDisposition} onChange={event => setForm(current => ({ ...current, resultDisposition: event.target.value, confirmed: false }))} className="mt-1 h-9 w-full rounded border px-2"><option value="">Seleccionar</option><option value="a_compensar">Quedó a compensar</option><option value="a_devolver">Se solicitó a devolver</option></select></label>}
          {form.declarationType !== 'original' && <label className="block text-xs text-slate-600">Justificante anterior<input value={form.previousJustificationNumber} onChange={event => setForm(current => ({ ...current, previousJustificationNumber: event.target.value, confirmed: false }))} className="mt-1 h-9 w-full rounded border px-2" /></label>}
          <label className="block text-xs text-slate-600">Casillas presentadas · una por línea (`01=1000.00`)<textarea rows={7} value={form.boxesText} onChange={event => setForm(current => ({ ...current, boxesText: event.target.value, confirmed: false }))} className="mt-1 w-full rounded border p-2 font-mono text-xs" /></label>
          <label className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs leading-5 text-emerald-800"><input className="mt-1" type="checkbox" checked={form.confirmed} onChange={event => setForm(current => ({ ...current, confirmed: event.target.checked }))} />He contrastado modelo, ejercicio, período, NIF, resultado y casillas con la declaración efectivamente presentada.</label>
          <Button type="button" onClick={importSnapshot} disabled={working || !form.confirmed} className="gap-2 bg-blue-700 hover:bg-blue-800">{working ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Guardar histórico presentado</Button>
        </>}
        {error && <p className="text-xs leading-5 text-red-700">{error}</p>}
        {notice && <p className="text-xs leading-5 text-amber-700">{notice}</p>}
      </div>}
    </section>
  );
}

function HistoryAndCarryforwardPanel({ result, modelCode }) {
  const history = result?.history;
  const carryforward = history?.carryforward || result?.calculation?.carryforward;
  const applied = carryforward?.carry || [];
  const review = carryforward?.review || [];
  const deferred = carryforward?.deferred || [];
  const prior130 = carryforward?.type === 'irpf_cumulative' ? carryforward.previousFilings || [] : [];
  const missing130 = carryforward?.type === 'irpf_cumulative' ? carryforward.missingPeriods || [] : [];
  const indirectCarry = ['iva_deduction', 'igic_deduction'].includes(carryforward?.type) ? carryforward : null;
  const hasContent = history?.presented || history?.importedCount || applied.length || review.length || deferred.length || prior130.length || missing130.length || indirectCarry;
  if (!hasContent) return null;
  return (
    <section className="space-y-4 rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4">
      <div className="flex items-start gap-3">
        <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 text-indigo-700" />
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Histórico, diferencias y arrastres</h3>
          <p className="mt-1 text-xs leading-5 text-slate-600">La declaración presentada queda congelada. Los documentos posteriores se analizan sin alterar aquella foto ni mover el devengo contable.</p>
        </div>
      </div>

      {history?.presented && <div className="rounded-xl border border-amber-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Período ya presentado</p><p className="mt-1 text-sm text-slate-700">{history.filing?.date || 'Fecha no disponible'} · versión {history.filing?.snapshotVersion || 1}{history.filing?.justificationNumber ? ` · justificante ${history.filing.justificationNumber}` : ''}</p></div>
          <div className="text-right"><p className="text-xs text-slate-500">Presentado / cálculo actual</p><p className="text-sm font-semibold text-slate-900">{formatMoney(history.filing?.result)} / {formatMoney(result.calculation?.result)}</p></div>
        </div>
        {!!history.differences?.length ? <div className="mt-3 overflow-auto rounded-lg border border-amber-100">
          <table className="w-full min-w-[480px] text-xs"><thead className="bg-amber-50 text-slate-500"><tr><th className="px-3 py-2 text-left">Casilla</th><th className="px-3 py-2 text-right">Presentada</th><th className="px-3 py-2 text-right">Actual</th><th className="px-3 py-2 text-right">Diferencia</th></tr></thead><tbody>{history.differences.map(row => <tr key={row.code} className="border-t border-amber-100"><td className="px-3 py-2 font-mono font-semibold text-indigo-700">{row.code}</td><td className="px-3 py-2 text-right">{formatMoney(row.presented)}</td><td className="px-3 py-2 text-right">{formatMoney(row.current)}</td><td className={`px-3 py-2 text-right font-semibold ${Number(row.difference) > 0 ? 'text-red-700' : 'text-emerald-700'}`}>{formatMoney(row.difference)}</td></tr>)}</tbody></table>
        </div> : <p className="mt-3 text-xs text-emerald-700">El cálculo actual coincide con las casillas importadas.</p>}
      </div>}

      {carryforward?.type === 'irpf_cumulative' && <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-indigo-100 bg-white p-3"><p className="text-xs font-semibold text-slate-700">Pagos anteriores usados en la casilla 05</p><p className="mt-2 text-xl font-bold text-indigo-800">{prior130.length}</p><p className="mt-1 text-xs text-slate-500">{carryforward.previousPaymentsSource === 'filed_returns' ? 'Suma de casillas 07 positivas menos casillas 16 de los modelos importados.' : carryforward.previousPaymentsSource === 'manual' ? 'Confirmados manualmente para este cálculo.' : 'Falta completar el histórico anterior.'}</p>{prior130.map(row => <p key={row.id} className="mt-1 text-xs text-slate-600">{row.period}: {formatMoney(row.amount)} · {row.date}</p>)}</div>
        <div className={`rounded-xl border p-3 ${missing130.length || carryforward.missingNegativePeriods?.length ? 'border-red-200 bg-red-50' : 'border-emerald-200 bg-emerald-50'}`}><p className="text-xs font-semibold text-slate-700">Continuidad acumulativa</p><p className="mt-2 text-xs leading-5 text-slate-600">Los ingresos y gastos de grupos 6 y 7 se recalculan desde el 1 de enero. Una factura tardía conserva su ejercicio de devengo y entra en el siguiente trimestre abierto.</p><p className="mt-2 text-xs text-slate-600">Casilla 15: {formatMoney(carryforward.priorNegativeApplied)} aplicada · {formatMoney(carryforward.priorNegativeRemaining)} pendiente.</p>{!!missing130.length && <p className="mt-2 text-xs font-medium text-red-700">Falta casilla 05: {missing130.join(', ')}.</p>}{!!carryforward.missingNegativePeriods?.length && <p className="mt-2 text-xs font-medium text-red-700">Falta casilla 19: {carryforward.missingNegativePeriods.join(', ')}.</p>}</div>
      </div>}

      {indirectCarry && <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-indigo-100 bg-white p-3"><p className="text-xs text-slate-500">Saldo anterior</p><p className="mt-1 text-lg font-bold text-indigo-800">{formatMoney(indirectCarry.previousBalance)}</p><p className="text-xs text-slate-500">{indirectCarry.balanceSource === 'filed_return' ? `Importado de ${indirectCarry.previousFiling?.period || ''} ${indirectCarry.previousFiling?.year || ''}` : indirectCarry.balanceSource === 'manual' ? 'Confirmado manualmente' : 'Histórico pendiente'}</p></div>
        <div className="rounded-xl border border-cyan-100 bg-white p-3"><p className="text-xs text-slate-500">Aplicado ahora</p><p className="mt-1 text-lg font-bold text-cyan-800">{formatMoney(indirectCarry.appliedPrevious)}</p></div>
        <div className="rounded-xl border border-amber-100 bg-white p-3"><p className="text-xs text-slate-500">Nuevo saldo generado</p><p className="mt-1 text-lg font-bold text-amber-800">{formatMoney(indirectCarry.newCompensation)}</p><p className="text-xs text-slate-500">{indirectCarry.resultDisposition === 'a_compensar' ? 'A compensar' : indirectCarry.resultDisposition === 'a_devolver' ? 'A devolver' : 'Pendiente de decisión'}</p></div>
        <div className="rounded-xl border border-emerald-100 bg-white p-3"><p className="text-xs text-slate-500">Saldo para el próximo período</p><p className="mt-1 text-lg font-bold text-emerald-800">{formatMoney(indirectCarry.nextBalance)}</p></div>
      </div>}

      {(applied.length > 0 || review.length > 0 || deferred.length > 0) && <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-emerald-200 bg-white p-3"><p className="text-xs text-slate-500">Deducciones tardías aplicadas</p><p className="mt-1 text-xl font-bold text-emerald-700">{applied.length}</p><p className="text-xs text-slate-500">{formatMoney(applied.reduce((sum, row) => sum + Number(row.quota || 0), 0))}</p></div>
        <div className="rounded-xl border border-red-200 bg-white p-3"><p className="text-xs text-slate-500">Requieren revisión</p><p className="mt-1 text-xl font-bold text-red-700">{review.length}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-xs text-slate-500">Pendientes de período futuro</p><p className="mt-1 text-xl font-bold text-slate-700">{deferred.length}</p></div>
      </div>}

      {!!history?.lateItems?.length && <div className="rounded-xl border border-red-200 bg-red-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-red-700">Altas posteriores que afectan al período presentado</p>
        <div className="mt-3 space-y-2">{history.lateItems.map(item => <div key={item.sourceId} className="rounded-lg border border-red-100 bg-white p-3 text-xs"><div className="flex flex-wrap justify-between gap-2"><span className="font-semibold text-slate-800">{item.document}</span><span className="text-slate-500">Devengo/pago {item.operationDate} · alta {item.addedAt}</span></div><p className="mt-1 leading-5 text-red-700">{item.reason}</p>{Number(item.amount) !== 0 && <p className="mt-1 font-medium text-slate-700">Efecto detectado: {formatMoney(item.amount)}</p>}</div>)}</div>
      </div>}

      {['111', '115', '123', '303', '420'].includes(modelCode) && history?.presented && <p className="rounded-lg border border-indigo-100 bg-white p-3 text-xs leading-5 text-slate-600">Las ventas, cuotas devengadas y retenciones omitidas no se pasan automáticamente a otro período: Taxea las separa para revisar el procedimiento corrector aplicable al período original.</p>}
    </section>
  );
}

function Annual180Editor({ details, values, onChange, onSave, saving, canReview }) {
  if (!details?.length) return null;
  return (
    <section className="rounded-2xl border border-violet-200 bg-violet-50/40 p-4">
      <div className="flex items-start gap-3">
        <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0 text-violet-700" />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-slate-800">Fichas de inmueble obligatorias del modelo 180</h3>
          <p className="mt-1 text-xs leading-5 text-slate-600">Cada pago conserva su factura de origen. La ficha debe completarse y quedar validada por asesor antes de habilitar el fichero AEAT.</p>
          <div className="mt-3 space-y-3">
            {details.map(detail => {
              const payload = values[detail.recordKey] || detail.manual || {};
              return (
                <details key={detail.recordKey} className="rounded-xl border border-violet-200 bg-white p-3">
                  <summary className="cursor-pointer text-sm font-medium text-slate-800">
                    {detail.name || detail.taxId} · {formatMoney(detail.base)} · <span className={detail.reviewStatus === 'validado_asesor' && !detail.missingFields?.length ? 'text-emerald-700' : 'text-amber-700'}>{detail.reviewStatus === 'validado_asesor' && !detail.missingFields?.length ? 'Validado' : `${detail.missingFields?.length || 0} dato(s) pendiente(s)`}</span>
                  </summary>
                  <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <label className="text-xs font-medium text-slate-600">Situación inmueble
                      <select value={payload.propertySituation || ''} onChange={event => onChange(detail.recordKey, 'propertySituation', event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-violet-200 bg-white px-3 text-sm">
                        <option value="">Seleccionar</option><option value="1">1 · España salvo País Vasco/Navarra, con referencia</option><option value="2">2 · País Vasco, con referencia</option><option value="3">3 · Navarra, con referencia</option><option value="4">4 · Sin referencia catastral</option>
                      </select>
                    </label>
                    <label className="text-xs font-medium text-slate-600">Modalidad
                      <select value={payload.modality || '1'} onChange={event => onChange(detail.recordKey, 'modality', event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-violet-200 bg-white px-3 text-sm"><option value="1">1 · Dineraria</option><option value="2">2 · En especie</option></select>
                    </label>
                    {MODEL_180_FIELDS.map(([key, label, type]) => <label key={key} className="text-xs font-medium text-slate-600">{label}<input type={type} value={payload[key] ?? ''} onChange={event => onChange(detail.recordKey, key, event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-violet-200 bg-white px-3 text-sm" /></label>)}
                  </div>
                  {!!detail.missingFields?.length && <p className="mt-3 text-xs text-amber-700">Pendiente: {detail.missingFields.join(', ')}.</p>}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => onSave(detail, 'pendiente_revision')} disabled={saving}><Save className="mr-2 h-3.5 w-3.5" />Guardar ficha</Button>
                    {canReview && <Button size="sm" className="bg-violet-700 hover:bg-violet-800" onClick={() => onSave(detail, 'validado_asesor')} disabled={saving || !!detail.missingFields?.length}><ShieldCheck className="mr-2 h-3.5 w-3.5" />Validar como asesor</Button>}
                  </div>
                </details>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function Annual190Editor({ details, values, onChange, onSave, saving, canReview }) {
  if (!details?.length) return null;
  return (
    <section className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4">
      <div className="flex items-start gap-3">
        <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0 text-indigo-700" />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-slate-800">Fichas de perceptores del modelo 190</h3>
          <p className="mt-1 text-xs leading-5 text-slate-600">Taxea agrupa nóminas en clave A y facturas profesionales pagadas en clave G. Los datos personales y fiscales deben confirmarse y quedar validados por asesor antes de generar el fichero AEAT.</p>
          <div className="mt-3 space-y-3">
            {details.map(detail => {
              const payload = values[detail.recordKey] || detail.manual || {};
              const isPayroll = (payload.key || detail.key) === 'A';
              return (
                <details key={detail.recordKey} className="rounded-xl border border-indigo-200 bg-white p-3">
                  <summary className="cursor-pointer text-sm font-medium text-slate-800">
                    {payload.key || detail.key} · {detail.name || detail.taxId} · {formatMoney(detail.base)} · <span className={detail.reviewStatus === 'validado_asesor' && !detail.missingFields?.length ? 'text-emerald-700' : 'text-amber-700'}>{detail.reviewStatus === 'validado_asesor' && !detail.missingFields?.length ? 'Validado' : `${detail.missingFields?.length || 0} dato(s) pendiente(s)`}</span>
                  </summary>
                  <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <label className="text-xs font-medium text-slate-600">Provincia del perceptor
                      <input inputMode="numeric" maxLength={2} value={payload.provinceCode ?? ''} onChange={event => onChange(detail.recordKey, 'provinceCode', event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-indigo-200 bg-white px-3 text-sm" />
                    </label>
                    <label className="text-xs font-medium text-slate-600">Clave
                      <select value={payload.key || detail.key || ''} onChange={event => onChange(detail.recordKey, 'key', event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-indigo-200 bg-white px-3 text-sm"><option value="A">A · Rendimientos del trabajo</option><option value="G">G · Actividades profesionales</option></select>
                    </label>
                    {!isPayroll && <label className="text-xs font-medium text-slate-600">Subclave G
                      <select value={payload.subkey || detail.subkey || '01'} onChange={event => onChange(detail.recordKey, 'subkey', event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-indigo-200 bg-white px-3 text-sm"><option value="01">01 · Profesional general</option><option value="02">02 · Recaudadores municipales y similares</option><option value="03">03 · Inicio de actividad</option><option value="04">04 · Actividades especiales</option><option value="05">05 · Rendimientos artísticos</option><option value="06">06 · Anticipos cesión de derechos de autor</option><option value="07">07 · Propiedad intelectual</option><option value="08">08 · Otras percepciones profesionales</option></select>
                    </label>}
                    <label className="text-xs font-medium text-slate-600">Ejercicio de devengo atrasado
                      <input inputMode="numeric" maxLength={4} placeholder="Vacío si es el actual" value={payload.accrualYear ?? ''} onChange={event => onChange(detail.recordKey, 'accrualYear', event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-indigo-200 bg-white px-3 text-sm" />
                    </label>
                    <label className="text-xs font-medium text-slate-600">NIF representante (si procede)
                      <input maxLength={9} value={payload.representativeTaxId ?? ''} onChange={event => onChange(detail.recordKey, 'representativeTaxId', event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-indigo-200 bg-white px-3 text-sm uppercase" />
                    </label>
                    {isPayroll && <>
                      <label className="text-xs font-medium text-slate-600">Año de nacimiento<input inputMode="numeric" maxLength={4} value={payload.birthYear ?? ''} onChange={event => onChange(detail.recordKey, 'birthYear', event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-indigo-200 bg-white px-3 text-sm" /></label>
                      <label className="text-xs font-medium text-slate-600">Situación familiar<select value={payload.familySituation ?? ''} onChange={event => onChange(detail.recordKey, 'familySituation', event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-indigo-200 bg-white px-3 text-sm"><option value="">Seleccionar</option><option value="1">1 · Soltero/viudo/divorciado con hijos</option><option value="2">2 · Casado, cónyuge sin rentas suficientes</option><option value="3">3 · Otras situaciones</option></select></label>
                      <label className="text-xs font-medium text-slate-600">NIF del cónyuge (situación 2)<input maxLength={9} value={payload.spouseTaxId ?? ''} onChange={event => onChange(detail.recordKey, 'spouseTaxId', event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-indigo-200 bg-white px-3 text-sm uppercase" /></label>
                      <label className="text-xs font-medium text-slate-600">Discapacidad<select value={payload.disability || '0'} onChange={event => onChange(detail.recordKey, 'disability', event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-indigo-200 bg-white px-3 text-sm"><option value="0">0 · Sin discapacidad</option><option value="1">1 · Entre 33% y 65%</option><option value="2">2 · Entre 33% y 65% con movilidad reducida</option><option value="3">3 · Igual o superior al 65%</option></select></label>
                      <label className="text-xs font-medium text-slate-600">Contrato o relación<select value={payload.contractType ?? ''} onChange={event => onChange(detail.recordKey, 'contractType', event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-indigo-200 bg-white px-3 text-sm"><option value="">Seleccionar</option><option value="1">1 · General</option><option value="2">2 · Menos de un año</option><option value="3">3 · Relación laboral especial</option><option value="4">4 · Peonadas o jornales diarios</option></select></label>
                    </>}
                    {MODEL_190_NUMERIC_FIELDS.map(([key, label]) => <label key={key} className="text-xs font-medium text-slate-600">{label}<input type="number" step="0.01" value={payload[key] ?? ''} onChange={event => onChange(detail.recordKey, key, event.target.value === '' ? '' : Number(event.target.value))} className="mt-1 h-9 w-full rounded-lg border border-indigo-200 bg-white px-3 text-sm" /></label>)}
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700"><input type="checkbox" checked={!!payload.ceutaMelilla} onChange={event => onChange(detail.recordKey, 'ceutaMelilla', event.target.checked)} />Rentas obtenidas en Ceuta o Melilla</label>
                    <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700"><input type="checkbox" checked={!!payload.mobility} onChange={event => onChange(detail.recordKey, 'mobility', event.target.checked)} />Movilidad geográfica aplicable</label>
                  </div>
                  <label className="mt-3 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs leading-5 text-emerald-800"><input className="mt-1" type="checkbox" checked={!!payload.specialDataConfirmed} onChange={event => onChange(detail.recordKey, 'specialDataConfirmed', event.target.checked)} />Confirmo que la clave, subclave, provincia, devengo, datos personales y reducciones de este perceptor han sido revisados.</label>
                  {!!detail.missingFields?.length && <p className="mt-3 text-xs text-amber-700">Pendiente: {detail.missingFields.join('; ')}.</p>}
                  <div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => onSave(detail, 'pendiente_revision')} disabled={saving}><Save className="mr-2 h-3.5 w-3.5" />Guardar ficha</Button>{canReview && <Button size="sm" className="bg-indigo-700 hover:bg-indigo-800" onClick={() => onSave(detail, 'validado_asesor')} disabled={saving || !!detail.missingFields?.length}><ShieldCheck className="mr-2 h-3.5 w-3.5" />Validar como asesor</Button>}</div>
                </details>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function Annual193Editor({ details, declaration, values, onChange, onSave, saving, canReview }) {
  if (!details?.length) return null;
  const declarationPayload = values[declaration?.recordKey] || declaration?.manual || {};
  const specialDeclarant = !!declarationPayload.declarantNatureSpecial;
  return (
    <section className="rounded-2xl border border-fuchsia-200 bg-fuchsia-50/40 p-4">
      <div className="flex items-start gap-3">
        <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0 text-fuchsia-700" />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-slate-800">Clasificación anual del modelo 193</h3>
          <p className="mt-1 text-xs leading-5 text-slate-600">Las facturas financieras pagadas aportan importes y retenciones. La naturaleza de la renta, emisor, mercado y papel del pagador se completan aquí conforme al diseño AEAT.</p>
          <div className="mt-3 rounded-xl border border-fuchsia-200 bg-white p-3">
            <p className="text-xs font-semibold text-slate-800">Configuración de la declaración</p>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              <label className="flex items-start gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs leading-5 text-slate-700"><input className="mt-1" type="checkbox" checked={specialDeclarant} onChange={event => onChange(declaration.recordKey, 'declarantNatureSpecial', event.target.checked)} />Marcar “S” porque el declarante no pertenece a las categorías especiales indicadas en el diseño 193.</label>
              <label className="flex items-start gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs leading-5 text-slate-700"><input className="mt-1" type="checkbox" checked={!!declarationPayload.expenseAnnexNotApplicable} onChange={event => onChange(declaration.recordKey, 'expenseAnnexNotApplicable', event.target.checked)} />Confirmo que no procede la relación de gastos del art. 26.1.a LIRPF.</label>
            </div>
            <label className="mt-2 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs leading-5 text-emerald-800"><input className="mt-1" type="checkbox" checked={!!declarationPayload.specialDataConfirmed} onChange={event => onChange(declaration.recordKey, 'specialDataConfirmed', event.target.checked)} />Confirmo que se ha revisado la naturaleza del declarante y que el fichero no requiere registros de relación de gastos.</label>
            {!!declaration?.missingFields?.length && <p className="mt-2 text-xs text-amber-700">Pendiente: {declaration.missingFields.join('; ')}.</p>}
            <div className="mt-2 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => onSave(declaration, 'pendiente_revision')} disabled={saving}><Save className="mr-2 h-3.5 w-3.5" />Guardar configuración</Button>{canReview && <Button size="sm" className="bg-fuchsia-700 hover:bg-fuchsia-800" onClick={() => onSave(declaration, 'validado_asesor')} disabled={saving || !!declaration?.missingFields?.length}><ShieldCheck className="mr-2 h-3.5 w-3.5" />Validar configuración</Button>}</div>
          </div>
          <div className="mt-3 space-y-3">
            {details.map(detail => {
              const payload = values[detail.recordKey] || detail.manual || {};
              const perceptionKey = payload.perceptionKey || detail.perceptionKey || '';
              const capital = ['A', 'B', 'D'].includes(perceptionKey);
              return (
                <details key={detail.recordKey} className="rounded-xl border border-fuchsia-200 bg-white p-3">
                  <summary className="cursor-pointer text-sm font-medium text-slate-800">{perceptionKey || 'Sin clasificar'} · {detail.name || detail.taxId} · {formatMoney(detail.base)} · <span className={detail.reviewStatus === 'validado_asesor' && !detail.missingFields?.length ? 'text-emerald-700' : 'text-amber-700'}>{detail.reviewStatus === 'validado_asesor' && !detail.missingFields?.length ? 'Validado' : `${detail.missingFields?.length || 0} dato(s) pendiente(s)`}</span></summary>
                  <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <label className="text-xs font-medium text-slate-600">Provincia<input inputMode="numeric" maxLength={2} value={payload.provinceCode ?? ''} onChange={event => onChange(detail.recordKey, 'provinceCode', event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-fuchsia-200 px-3 text-sm" /></label>
                    <label className="text-xs font-medium text-slate-600">Clave de percepción<select value={perceptionKey} onChange={event => onChange(detail.recordKey, 'perceptionKey', event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-fuchsia-200 px-3 text-sm"><option value="">Seleccionar</option><option value="A">A · Fondos propios</option><option value="B">B · Cesión de capitales</option><option value="C">C · Otros rendimientos</option><option value="D">D · Capitales a entidad vinculada</option></select></label>
                    <label className="text-xs font-medium text-slate-600">Naturaleza<select value={payload.nature || ''} onChange={event => onChange(detail.recordKey, 'nature', event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-fuchsia-200 px-3 text-sm"><option value="">Seleccionar</option>{(MODEL_193_NATURES[perceptionKey] || []).map(([code, label]) => <option key={code} value={code}>{code} · {label}</option>)}</select></label>
                    <label className="text-xs font-medium text-slate-600">Tipo de percepción<select value={payload.perceptionType || '1'} onChange={event => onChange(detail.recordKey, 'perceptionType', event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-fuchsia-200 px-3 text-sm"><option value="1">1 · Dineraria</option><option value="2">2 · En especie</option></select></label>
                    <label className="text-xs font-medium text-slate-600">NIF representante<input maxLength={9} value={payload.representativeTaxId ?? ''} onChange={event => onChange(detail.recordKey, 'representativeTaxId', event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-fuchsia-200 px-3 text-sm uppercase" /></label>
                    <label className="text-xs font-medium text-slate-600">Ejercicio de devengo anterior<input inputMode="numeric" maxLength={4} value={payload.accrualYear ?? ''} onChange={event => onChange(detail.recordKey, 'accrualYear', event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-fuchsia-200 px-3 text-sm" /></label>
                    {MODEL_193_MONEY_FIELDS.map(([key, label]) => <label key={key} className="text-xs font-medium text-slate-600">{label}<input type="number" step="0.01" value={payload[key] ?? ''} onChange={event => onChange(detail.recordKey, key, event.target.value === '' ? '' : Number(event.target.value))} className="mt-1 h-9 w-full rounded-lg border border-fuchsia-200 px-3 text-sm" /></label>)}
                  </div>
                  {capital && !specialDeclarant && <div className="mt-3 rounded-lg border border-indigo-100 bg-indigo-50/40 p-3"><p className="text-xs font-semibold text-slate-800">Identificación del emisor y pago</p><div className="mt-2 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <label className="text-xs text-slate-600">Clave código<select value={payload.keyCode || ''} onChange={event => onChange(detail.recordKey, 'keyCode', event.target.value)} className="mt-1 h-9 w-full rounded border px-2"><option value="">Seleccionar</option><option value="1">1 · NIF emisor</option><option value="2">2 · ISIN</option><option value="3">3 · Extranjero sin ISIN</option><option value="4">4 · NIF + ISIN</option></select></label>
                    <label className="text-xs text-slate-600">Código emisor<input value={payload.issuerCode ?? ''} onChange={event => onChange(detail.recordKey, 'issuerCode', event.target.value)} className="mt-1 h-9 w-full rounded border px-2 uppercase" /></label>
                    <label className="text-xs text-slate-600">ISIN<input maxLength={12} value={payload.isin ?? ''} onChange={event => onChange(detail.recordKey, 'isin', event.target.value)} className="mt-1 h-9 w-full rounded border px-2 uppercase" /></label>
                    <label className="text-xs text-slate-600">Papel del pagador<select value={payload.paymentRole || ''} onChange={event => onChange(detail.recordKey, 'paymentRole', event.target.value)} className="mt-1 h-9 w-full rounded border px-2"><option value="">Seleccionar</option><option value="1">1 · Emisor</option><option value="2">2 · Mediador nacional</option><option value="3">3 · Mediador extranjero</option><option value="4">4 · Mediador extranjero no retenedor</option><option value="5">5 · Mediador de otras rentas B-06</option></select></label>
                    <label className="text-xs text-slate-600">Tipo código cuenta<select value={payload.accountCodeType || ''} onChange={event => onChange(detail.recordKey, 'accountCodeType', event.target.value)} className="mt-1 h-9 w-full rounded border px-2"><option value="">Sin contenido</option><option value="C">C · Código cuenta</option><option value="O">O · Otra identificación</option><option value="P">P · Préstamo de valores</option></select></label>
                    <label className="text-xs text-slate-600">Cuenta/operación<input maxLength={20} value={payload.accountCode ?? ''} onChange={event => onChange(detail.recordKey, 'accountCode', event.target.value)} className="mt-1 h-9 w-full rounded border px-2" /></label>
                    <label className="text-xs text-slate-600">Mercado<select value={payload.marketKey || ''} onChange={event => onChange(detail.recordKey, 'marketKey', event.target.value)} className="mt-1 h-9 w-full rounded border px-2"><option value="">Seleccionar</option><option value="A">A · Mercado español</option><option value="B">B · Mercado UE</option><option value="C">C · Otro mercado oficial extranjero</option><option value="D">D · Otros</option></select></label>
                    <label className="text-xs text-slate-600">NIF pagador anterior<input maxLength={9} value={payload.previousPayerTaxId ?? ''} onChange={event => onChange(detail.recordKey, 'previousPayerTaxId', event.target.value)} className="mt-1 h-9 w-full rounded border px-2 uppercase" /></label>
                    {perceptionKey === 'A' && <label className="text-xs text-slate-600">Fecha de devengo<input type="date" value={payload.accrualDate ?? ''} onChange={event => onChange(detail.recordKey, 'accrualDate', event.target.value)} className="mt-1 h-9 w-full rounded border px-2" /></label>}
                  </div><label className="mt-2 flex items-center gap-2 text-xs text-slate-700"><input type="checkbox" checked={!!payload.recipientMediator} onChange={event => onChange(detail.recordKey, 'recipientMediator', event.target.checked)} />El perceptor es mediador</label></div>}
                  <details className="mt-3 rounded-lg border border-slate-200 p-3"><summary className="cursor-pointer text-xs font-semibold text-slate-700">Campos especiales y distribución territorial</summary><div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <label className="text-xs text-slate-600">Ceuta/Melilla/La Palma<select value={payload.ceutaPalmaCode || '0'} onChange={event => onChange(detail.recordKey, 'ceutaPalmaCode', event.target.value)} className="mt-1 h-9 w-full rounded border px-2"><option value="0">0 · No aplica</option><option value="1">1 · Ceuta o Melilla</option><option value="2">2 · Isla de La Palma</option></select></label>
                    {[['stateWithholding','Hacienda estatal'],['navarraWithholding','Navarra'],['alavaWithholding','Álava'],['gipuzkoaWithholding','Gipuzkoa'],['bizkaiaWithholding','Bizkaia'],['loanCompensation','Compensaciones préstamo'],['loanGuarantees','Garantías préstamo']].map(([key,label]) => <label key={key} className="text-xs text-slate-600">{label}<input type="number" step="0.01" value={payload[key] ?? ''} onChange={event => onChange(detail.recordKey, key, event.target.value === '' ? '' : Number(event.target.value))} className="mt-1 h-9 w-full rounded border px-2" /></label>)}
                    {payload.accountCodeType === 'P' && <><label className="text-xs text-slate-600">Inicio préstamo<input type="date" value={payload.loanStartDate ?? ''} onChange={event => onChange(detail.recordKey, 'loanStartDate', event.target.value)} className="mt-1 h-9 w-full rounded border px-2" /></label><label className="text-xs text-slate-600">Vencimiento préstamo<input type="date" value={payload.loanEndDate ?? ''} onChange={event => onChange(detail.recordKey, 'loanEndDate', event.target.value)} className="mt-1 h-9 w-full rounded border px-2" /></label></>}
                  </div></details>
                  <label className="mt-3 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs leading-5 text-emerald-800"><input className="mt-1" type="checkbox" checked={!!payload.specialDataConfirmed} onChange={event => onChange(detail.recordKey, 'specialDataConfirmed', event.target.checked)} />Confirmo que la clasificación, importes, identificación financiera y territorialidad del perceptor han sido revisados.</label>
                  {!!detail.missingFields?.length && <p className="mt-3 text-xs text-amber-700">Pendiente: {detail.missingFields.join('; ')}.</p>}
                  <div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => onSave(detail, 'pendiente_revision')} disabled={saving}><Save className="mr-2 h-3.5 w-3.5" />Guardar ficha</Button>{canReview && <Button size="sm" className="bg-fuchsia-700 hover:bg-fuchsia-800" onClick={() => onSave(detail, 'validado_asesor')} disabled={saving || !!detail.missingFields?.length}><ShieldCheck className="mr-2 h-3.5 w-3.5" />Validar como asesor</Button>}</div>
                </details>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function ThirdPartyEditor({ modelCode, details, values, onChange, onPropertyChange, onAddProperty, onRemoveProperty, onSave, saving, canReview }) {
  if (!details?.length) return null;
  return (
    <section className="rounded-2xl border border-cyan-200 bg-cyan-50/40 p-4">
      <div className="flex items-start gap-3">
        <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-700" />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-slate-800">Control de declarados del modelo {modelCode}</h3>
          <p className="mt-1 text-xs leading-5 text-slate-600">Taxea propone los importes desde facturas y pagos. Un asesor debe confirmar por tercero el efectivo, el criterio de caja y las operaciones inmobiliarias antes de habilitar el fichero.</p>
          <div className="mt-3 space-y-3">
            {details.map(detail => {
              const payload = values[detail.recordKey] || detail.manual || {};
              const properties = payload.properties || [];
              return (
                <details key={detail.recordKey} className="rounded-xl border border-cyan-200 bg-white p-3">
                  <summary className="cursor-pointer text-sm font-medium text-slate-800">
                    {detail.operationKey} · {detail.name || detail.taxId} · {formatMoney(detail.total)} · <span className={detail.reviewStatus === 'validado_asesor' && !detail.missingFields?.length ? 'text-emerald-700' : 'text-amber-700'}>{detail.reviewStatus === 'validado_asesor' && !detail.missingFields?.length ? 'Validado' : `${detail.missingFields?.length || 0} control(es) pendiente(s)`}</span>
                  </summary>
                  <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {THIRD_PARTY_SPECIAL_FIELDS.filter(([key]) => modelCode === '415' || key !== 'propertyRentAmount').map(([key, label]) => (
                      <label key={key} className="text-xs font-medium text-slate-600">{label}<input type="number" step="0.01" value={payload[key] ?? ''} onChange={event => onChange(detail.recordKey, key, event.target.value === '' ? '' : Number(event.target.value))} className="mt-1 h-9 w-full rounded-lg border border-cyan-200 bg-white px-3 text-sm" /></label>
                    ))}
                    <label className="text-xs font-medium text-slate-600">Ejercicio origen del metálico<input type="text" inputMode="numeric" maxLength={4} value={payload.cashYear ?? ''} onChange={event => onChange(detail.recordKey, 'cashYear', event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-cyan-200 bg-white px-3 text-sm" /></label>
                    <label className="text-xs font-medium text-slate-600">NIF representante (si procede)<input type="text" maxLength={9} value={payload.representativeTaxId ?? ''} onChange={event => onChange(detail.recordKey, 'representativeTaxId', event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-cyan-200 bg-white px-3 text-sm uppercase" /></label>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    {[['cashAccounting', 'Operación IGIC/IVA de caja'], ['reverseCharge', 'Inversión del sujeto pasivo'], ['exemptArticle13', 'Exenta art. 13 Ley 20/1991']].filter(([key]) => modelCode === '415' || key !== 'exemptArticle13').map(([key, label]) => <label key={key} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700"><input type="checkbox" checked={!!payload[key]} onChange={event => onChange(detail.recordKey, key, event.target.checked)} />{label}</label>)}
                  </div>
                  <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full min-w-[760px] text-xs"><thead className="bg-slate-50 text-slate-500"><tr><th className="px-3 py-2 text-left">Desglose</th>{['T1','T2','T3','T4'].map(q => <th key={q} className="px-3 py-2 text-right">{q}</th>)}</tr></thead><tbody>
                      {modelCode === '415' && <tr className="border-t"><td className="px-3 py-2 font-medium">Arrendamientos</td>{['T1','T2','T3','T4'].map(q => <td key={q} className="px-2 py-1"><input type="number" step="0.01" value={payload[`propertyRent${q}`] ?? ''} onChange={event => onChange(detail.recordKey, `propertyRent${q}`, event.target.value === '' ? '' : Number(event.target.value))} className="h-8 w-full rounded border border-slate-200 px-2 text-right" /></td>)}</tr>}
                      <tr className="border-t"><td className="px-3 py-2 font-medium">Transmisiones de inmuebles</td>{['T1','T2','T3','T4'].map(q => <td key={q} className="px-2 py-1"><input type="number" step="0.01" value={payload[`propertyTransfer${q}`] ?? ''} onChange={event => onChange(detail.recordKey, `propertyTransfer${q}`, event.target.value === '' ? '' : Number(event.target.value))} className="h-8 w-full rounded border border-slate-200 px-2 text-right" /></td>)}</tr>
                    </tbody></table>
                  </div>
                  {modelCode === '415' && detail.operationKey === 'B' && Number(payload.propertyRentAmount || 0) !== 0 && (
                    <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50/40 p-3">
                      <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold text-slate-800">Anexo de locales arrendados</p><p className="mt-0.5 text-[11px] text-slate-500">Obligatorio para el arrendador. Se exporta como registro tipo 3 del importador ATC.</p></div><Button size="sm" variant="outline" onClick={() => onAddProperty(detail.recordKey)}><Plus className="mr-1 h-3.5 w-3.5" />Inmueble</Button></div>
                      <div className="mt-3 space-y-3">{properties.map((property, propertyIndex) => <div key={propertyIndex} className="rounded-lg border border-violet-200 bg-white p-3"><div className="flex items-center justify-between"><p className="text-xs font-semibold">Inmueble {propertyIndex + 1}</p><Button size="icon" variant="ghost" onClick={() => onRemoveProperty(detail.recordKey, propertyIndex)}><Trash2 className="h-4 w-4 text-red-600" /></Button></div><div className="mt-2 grid gap-2 md:grid-cols-3 xl:grid-cols-5"><label className="text-[11px] text-slate-600">Importe anual<input type="number" step="0.01" value={property.amount ?? ''} onChange={event => onPropertyChange(detail.recordKey, propertyIndex, 'amount', event.target.value === '' ? '' : Number(event.target.value))} className="mt-1 h-8 w-full rounded border px-2" /></label>{PROPERTY_FIELDS.map(([key, label]) => <label key={key} className="text-[11px] text-slate-600">{label}<input value={property[key] ?? ''} onChange={event => onPropertyChange(detail.recordKey, propertyIndex, key, event.target.value)} className="mt-1 h-8 w-full rounded border px-2" /></label>)}</div><label className="mt-2 flex items-center gap-2 text-[11px] text-slate-600"><input type="checkbox" checked={!!property.cadastralUnavailable} onChange={event => onPropertyChange(detail.recordKey, propertyIndex, 'cadastralUnavailable', event.target.checked)} />Inmueble sin referencia catastral</label></div>)}</div>
                    </div>
                  )}
                  <label className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800"><input className="mt-1" type="checkbox" checked={!!payload.specialDataConfirmed} onChange={event => onChange(detail.recordKey, 'specialDataConfirmed', event.target.checked)} /><span>Confirmo que he revisado efectivo, arrendamientos, transmisiones, criterio de caja, inversión del sujeto pasivo y exención aplicable.</span></label>
                  {!!detail.missingFields?.length && <p className="mt-3 text-xs text-amber-700">Pendiente: {detail.missingFields.join('; ')}.</p>}
                  <div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => onSave(detail, 'pendiente_revision')} disabled={saving}><Save className="mr-2 h-3.5 w-3.5" />Guardar control</Button>{canReview && <Button size="sm" className="bg-cyan-700 hover:bg-cyan-800" onClick={() => onSave(detail, 'validado_asesor')} disabled={saving || !!detail.missingFields?.length}><ShieldCheck className="mr-2 h-3.5 w-3.5" />Validar como asesor</Button>}</div>
                </details>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}


function StatusBadge({ model }) {
  if (model.exportMode === 'atc_guided_packet') return <span className="rounded-full bg-cyan-50 px-2 py-0.5 text-[11px] font-medium text-cyan-700 border border-cyan-200">Traspaso controlado ATC</span>;
  if (model.exportMode === 'atc_program_import') return <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 border border-amber-200">Importable en ATC</span>;
  if (model.officialExport) return <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 border border-emerald-200">Diseño AEAT</span>;
  if (model.authority === 'ATC') return <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 border border-amber-200">Programa ATC</span>;
  return <span className="rounded-full bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600 border border-slate-200">Borrador validable</span>;
}

export default function TaxModelWorkbench() {
  const { user } = useAuth();
  const { company } = useCompanyContext(user);
  const companyId = company?.id;
  const [modelCode, setModelCode] = useState('303');
  const [year, setYear] = useState(new Date().getFullYear());
  const [period, setPeriod] = useState('1T');
  const [result, setResult] = useState(null);
  const [actionError, setActionError] = useState('');
  const [lastExportInfo, setLastExportInfo] = useState(null);
  const [adjustments, setAdjustments] = useState({});
  const [annualRecordEdits, setAnnualRecordEdits] = useState({});
  const [annual190RecordEdits, setAnnual190RecordEdits] = useState({});
  const [annual193RecordEdits, setAnnual193RecordEdits] = useState({});
  const [thirdPartyRecordEdits, setThirdPartyRecordEdits] = useState({});

  const { data: catalogResponse, isLoading: loadingCatalog } = useQuery({
    queryKey: ['tax-model-engine-catalog'],
    queryFn: async () => (await base44.functions.invoke('taxModelOperations', { action: 'catalog' })).data,
  });

  const { data: fiscalContext } = useQuery({
    queryKey: ['fiscal-profile-tax-models', companyId],
    queryFn: async () => (await base44.functions.invoke('taxModelOperations', { action: 'context', companyId })).data,
    enabled: !!companyId,
  });

  const profile = fiscalContext?.profile;
  const models = catalogResponse?.models || [];
  const definition = models.find(item => item.code === modelCode) || models[0];
  const periodOptions = useMemo(() => definition ? periodsFor(definition, profile) : PERIODS.trimestral, [definition, profile]);

  useEffect(() => {
    if (definition && !periodOptions.includes(period)) setPeriod(periodOptions[0]);
    setResult(null);
    setActionError('');
    setLastExportInfo(null);
    setAdjustments({});
  }, [modelCode, year, definition?.frequency, periodOptions]);

  useEffect(() => {
    if (modelCode !== '180' || !result?.calculation?.details) return;
    setAnnualRecordEdits(Object.fromEntries(result.calculation.details.map(detail => [detail.recordKey, { ...(detail.manual || {}) }])));
  }, [modelCode, result?.source?.hash]);

  useEffect(() => {
    if (modelCode !== '190' || !result?.calculation?.details) return;
    setAnnual190RecordEdits(Object.fromEntries(result.calculation.details.map(detail => [detail.recordKey, { ...(detail.manual || {}) }])));
  }, [modelCode, result?.source?.hash]);

  useEffect(() => {
    if (modelCode !== '193' || !result?.calculation?.details) return;
    const declaration = result.calculation.declaration;
    setAnnual193RecordEdits(Object.fromEntries([
      ...(declaration ? [[declaration.recordKey, { ...(declaration.manual || {}) }]] : []),
      ...result.calculation.details.map(detail => [detail.recordKey, { ...(detail.manual || {}) }]),
    ]));
  }, [modelCode, result?.source?.hash]);

  useEffect(() => {
    if (!['347', '415'].includes(modelCode) || !result?.calculation?.details) return;
    setThirdPartyRecordEdits(Object.fromEntries(result.calculation.details.map(detail => [detail.recordKey, { ...(detail.manual || {}), properties: (detail.manual?.properties || []).map(property => ({ ...property })) }])));
  }, [modelCode, result?.source?.hash]);

  const invoke = useMutation({
    mutationFn: async ({ action }) => {
      const response = await base44.functions.invoke('taxModelOperations', {
        action,
        companyId,
        modeloCodigo: modelCode,
        ejercicio: year,
        periodo: period,
        adjustments: modelCode === '130' || INDIRECT_TAX_MODELS.includes(modelCode) ? adjustments : {},
      });
      return response.data;
    },
    onSuccess: (data, variables) => {
      setActionError('');
      if (variables.action === 'calculate' || variables.action === 'save_draft') setResult(data);
      if (['export', 'export_review', 'export_handoff'].includes(variables.action)) {
        downloadBase64(data.file);
        setLastExportInfo({ filename: data.file?.filename, nextStep: data.file?.nextStep, isReview: variables.action === 'export_review', isHandoff: variables.action === 'export_handoff' });
      }
    },
    onError: error => {
      const payload = error?.response?.data;
      const messages = payload?.blockers?.length ? payload.blockers.join(' ') : payload?.error || error?.message || 'No se pudo completar la operación.';
      setActionError(messages);
    },
  });

  const saveDeclarable = useMutation({
    mutationFn: async ({ detail, reviewStatus, targetModel = modelCode }) => (await base44.functions.invoke('taxModelOperations', {
      action: 'upsert_declarable', companyId, modeloCodigo: targetModel, ejercicio: year, periodo: 'Anual',
      recordKey: detail.recordKey,
      sourceType: targetModel === '180' ? 'Invoice' : ['190', '193'].includes(targetModel) ? detail.sourceType : 'ThirdPartyAggregate',
      sourceId: targetModel === '180' ? detail.id : ['190', '193'].includes(targetModel) ? (detail.sourceIds || []).join('|') : (detail.invoices || []).join('|'),
      payload: targetModel === '180' ? (annualRecordEdits[detail.recordKey] || detail.manual || {}) : targetModel === '190' ? (annual190RecordEdits[detail.recordKey] || detail.manual || {}) : targetModel === '193' ? (annual193RecordEdits[detail.recordKey] || detail.manual || {}) : (thirdPartyRecordEdits[detail.recordKey] || detail.manual || {}), reviewStatus,
    })).data,
    onSuccess: () => { setActionError(''); invoke.mutate({ action: 'calculate' }); },
    onError: error => setActionError(error?.response?.data?.error || error?.message || 'No se pudo guardar la ficha anual.'),
  });
  const canReviewAnnual = ['admin', 'super_admin', 'advisor', 'asesor'].includes(String(user?.role || '').toLowerCase());
  const updateAnnualRecord = (recordKey, key, value) => setAnnualRecordEdits(current => ({ ...current, [recordKey]: { ...(current[recordKey] || {}), [key]: value } }));
  const updateAnnual190Record = (recordKey, key, value) => setAnnual190RecordEdits(current => ({ ...current, [recordKey]: { ...(current[recordKey] || {}), [key]: value } }));
  const updateAnnual193Record = (recordKey, key, value) => setAnnual193RecordEdits(current => ({ ...current, [recordKey]: { ...(current[recordKey] || {}), [key]: value } }));
  const updateThirdPartyRecord = (recordKey, key, value) => setThirdPartyRecordEdits(current => ({ ...current, [recordKey]: { ...(current[recordKey] || {}), [key]: value } }));
  const updateThirdPartyProperty = (recordKey, propertyIndex, key, value) => setThirdPartyRecordEdits(current => {
    const record = { ...(current[recordKey] || {}) };
    const properties = (record.properties || []).map(property => ({ ...property }));
    properties[propertyIndex] = { ...(properties[propertyIndex] || {}), [key]: value };
    return { ...current, [recordKey]: { ...record, properties } };
  });
  const addThirdPartyProperty = recordKey => setThirdPartyRecordEdits(current => ({ ...current, [recordKey]: { ...(current[recordKey] || {}), properties: [...(current[recordKey]?.properties || []), { amount: '', cadastralUnavailable: false, numberingType: 'NUM' }] } }));
  const removeThirdPartyProperty = (recordKey, propertyIndex) => setThirdPartyRecordEdits(current => ({ ...current, [recordKey]: { ...(current[recordKey] || {}), properties: (current[recordKey]?.properties || []).filter((_, index) => index !== propertyIndex) } }));

  if (!companyId) return <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">Selecciona una empresa para preparar sus modelos.</div>;

  return (
    <div className="grid min-h-[690px] grid-cols-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="border-b border-slate-200 bg-slate-950 lg:border-b-0 lg:border-r">
        <div className="border-b border-white/10 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">Motor tributario</p>
          <p className="mt-2 text-sm text-slate-300">Modelos calculados desde contabilidad y documentos reales.</p>
        </div>
        <div className="max-h-[620px] overflow-y-auto p-2">
          {loadingCatalog ? <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-cyan-300" /></div> : models.map(model => (
            <button
              key={model.code}
              onClick={() => setModelCode(model.code)}
              className={`mb-1 w-full rounded-xl px-3 py-3 text-left transition ${model.code === modelCode ? 'bg-cyan-400/15 ring-1 ring-cyan-300/40' : 'hover:bg-white/5'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={`text-sm font-bold ${model.code === modelCode ? 'text-cyan-200' : 'text-white'}`}>{model.code}</span>
                <span className="text-[10px] uppercase tracking-wide text-slate-400">{model.authority}</span>
              </div>
              <p className="mt-1 line-clamp-2 text-xs leading-4 text-slate-400">{model.name}</p>
            </button>
          ))}
        </div>
      </aside>

      <main className="min-w-0 bg-gradient-to-br from-slate-50 via-white to-cyan-50/40">
        <div className="border-b border-slate-200 bg-white/90 p-5 backdrop-blur">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900">Modelo {definition?.code}</h2>
                {definition && <StatusBadge model={definition} />}
              </div>
              <p className="mt-1 text-sm text-slate-500">{definition?.name}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select value={year} onChange={event => setYear(Number(event.target.value))} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700">
                {[year - 2, year - 1, year, year + 1].filter((value, index, array) => array.indexOf(value) === index).map(value => <option key={value}>{value}</option>)}
              </select>
              <select value={period} onChange={event => { setPeriod(event.target.value); setResult(null); setAdjustments({}); }} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700">
                {periodOptions.map(value => <option key={value}>{value}</option>)}
              </select>
              <Button onClick={() => invoke.mutate({ action: 'calculate' })} disabled={invoke.isPending} className="gap-2 bg-slate-950 text-white hover:bg-slate-800">
                {invoke.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
                Calcular borrador
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-5 p-5">
          {definition?.designWarning && (
            <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div><p className="font-semibold">Límite de exportación oficial</p><p className="mt-0.5 text-xs leading-5">{definition.designWarning}</p></div>
            </div>
          )}

          {actionError && (
            <div className="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{actionError}</span></div>
          )}
          {lastExportInfo && (
            <div className="flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><FileCheck2 className="mt-0.5 h-4 w-4 shrink-0" /><div><p className="font-semibold">{lastExportInfo.isReview ? 'Borrador descargado' : lastExportInfo.isHandoff ? 'Traspaso ATC descargado' : 'Fichero generado'}: {lastExportInfo.filename}</p>{lastExportInfo.nextStep && <p className="mt-1 text-xs leading-5">{lastExportInfo.nextStep}</p>}</div></div>
          )}

          <FiledReturnImport key={`${companyId}-${modelCode}-${year}-${period}`} companyId={companyId} modelCode={modelCode} year={year} period={period} onImported={() => invoke.mutate({ action: 'calculate' })} />

          {modelCode === '130' && (
            <section className="rounded-2xl border border-cyan-200 bg-cyan-50/60 p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-cyan-700" />
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-slate-800">Ajustes fiscales revisables del modelo 130</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-600">La contabilidad calcula ingresos y gastos acumulados. Estas casillas no se inventan: confírmalas cuando procedan; en 2T–4T los pagos anteriores son obligatorios para exportar.</p>
                  <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {MODEL_130_ADJUSTMENTS.map(([key, label]) => (
                      <label key={key} className="text-xs font-medium text-slate-600">
                        {label}
                        <input
                          type="number"
                          step="0.01"
                          value={adjustments[key] ?? ''}
                          onChange={event => { setAdjustments(current => ({ ...current, [key]: event.target.value === '' ? undefined : Number(event.target.value) })); setResult(null); }}
                          className="mt-1 h-9 w-full rounded-lg border border-cyan-200 bg-white px-3 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-cyan-300"
                        />
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          )}

          {INDIRECT_TAX_MODELS.includes(modelCode) && (
            <section className="rounded-2xl border border-cyan-200 bg-cyan-50/60 p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-cyan-700" />
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-slate-800">Cartera de cuotas y destino del resultado</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-600">Taxea toma el saldo del período presentado anterior. Si no existe histórico, confirma el saldo manualmente, incluso con cero. Los datos importados prevalecen salvo ajuste revisado.</p>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <label className="text-xs font-medium text-slate-600">Saldo anterior a compensar<input type="number" min="0" step="0.01" value={adjustments.previousCompensationBalance ?? ''} onChange={event => { setAdjustments(current => ({ ...current, previousCompensationBalance: event.target.value === '' ? undefined : Number(event.target.value) })); setResult(null); }} placeholder="Automático desde el modelo importado" className="mt-1 h-9 w-full rounded-lg border border-cyan-200 bg-white px-3 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-cyan-300" /></label>
                    <label className="text-xs font-medium text-slate-600">Si el resultado es negativo<select value={adjustments.resultDisposition || ''} onChange={event => { setAdjustments(current => ({ ...current, resultDisposition: event.target.value || undefined })); setResult(null); }} className="mt-1 h-9 w-full rounded-lg border border-cyan-200 bg-white px-3 text-sm text-slate-800"><option value="">Seleccionar al calcular</option><option value="a_compensar">Dejar a compensar</option><option value="a_devolver">Solicitar devolución (último período)</option></select></label>
                  </div>
                </div>
              </div>
            </section>
          )}

          {modelCode === '180' && result && <Annual180Editor details={result.calculation?.details} values={annualRecordEdits} onChange={updateAnnualRecord} onSave={(detail, reviewStatus) => saveDeclarable.mutate({ detail, reviewStatus, targetModel: '180' })} saving={saveDeclarable.isPending} canReview={canReviewAnnual} />}
          {modelCode === '190' && result && <Annual190Editor details={result.calculation?.details} values={annual190RecordEdits} onChange={updateAnnual190Record} onSave={(detail, reviewStatus) => saveDeclarable.mutate({ detail, reviewStatus, targetModel: '190' })} saving={saveDeclarable.isPending} canReview={canReviewAnnual} />}
          {modelCode === '193' && result && <Annual193Editor details={result.calculation?.details} declaration={result.calculation?.declaration} values={annual193RecordEdits} onChange={updateAnnual193Record} onSave={(detail, reviewStatus) => saveDeclarable.mutate({ detail, reviewStatus, targetModel: '193' })} saving={saveDeclarable.isPending} canReview={canReviewAnnual} />}
          {['347', '415'].includes(modelCode) && result && <ThirdPartyEditor modelCode={modelCode} details={result.calculation?.details} values={thirdPartyRecordEdits} onChange={updateThirdPartyRecord} onPropertyChange={updateThirdPartyProperty} onAddProperty={addThirdPartyProperty} onRemoveProperty={removeThirdPartyProperty} onSave={(detail, reviewStatus) => saveDeclarable.mutate({ detail, reviewStatus, targetModel: modelCode })} saving={saveDeclarable.isPending} canReview={canReviewAnnual} />}

          {!result ? (
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-5"><RefreshCw className="h-5 w-5 text-cyan-600" /><h3 className="mt-4 text-sm font-semibold text-slate-800">Fuente única</h3><p className="mt-1 text-xs leading-5 text-slate-500">Cruza líneas fiscales, facturas, nóminas y asientos confirmados sin alterar ningún registro.</p></div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5"><ShieldCheck className="h-5 w-5 text-emerald-600" /><h3 className="mt-4 text-sm font-semibold text-slate-800">Validación previa</h3><p className="mt-1 text-xs leading-5 text-slate-500">Los datos obligatorios ausentes bloquean la exportación. Un aviso nunca se convierte en una cifra inventada.</p></div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5"><FileCheck2 className="h-5 w-5 text-violet-600" /><h3 className="mt-4 text-sm font-semibold text-slate-800">Trazabilidad</h3><p className="mt-1 text-xs leading-5 text-slate-500">Cada casilla conserva los identificadores de sus facturas, nóminas o líneas contables de origen.</p></div>
            </div>
          ) : (
            <>
              <HistoryAndCarryforwardPanel result={result} modelCode={modelCode} />

              <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-medium text-slate-500">Resultado</p><p className={`mt-2 text-2xl font-bold ${Number(result.calculation?.result) > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{definition?.kind === 'informative' ? 'Informativo' : formatMoney(result.calculation?.result)}</p></div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-medium text-slate-500">Documentos trazados</p><p className="mt-2 text-2xl font-bold text-slate-900">{result.source?.count || 0}</p><p className="mt-1 text-[11px] text-slate-400">Hash {result.source?.hash?.slice(0, 12)}…</p></div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-medium text-slate-500">Incidencias bloqueantes</p><p className={`mt-2 text-2xl font-bold ${result.validation?.blockers?.length ? 'text-red-600' : 'text-emerald-600'}`}>{result.validation?.blockers?.length || 0}</p></div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-medium text-slate-500">Diseño</p><p className="mt-2 text-sm font-bold text-slate-900">{result.definition?.design}</p><p className="mt-1 text-[11px] text-slate-400">Motor {result.engineVersion}</p></div>
              </section>

              <section className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(310px,0.7fr)]">
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <div className="border-b border-slate-200 px-4 py-3"><h3 className="text-sm font-semibold text-slate-800">Casillas calculadas</h3><p className="mt-0.5 text-xs text-slate-500">Importes y recuentos obtenidos de sus fuentes.</p></div>
                  <div className="max-h-[390px] overflow-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-slate-50 text-xs text-slate-500"><tr><th className="px-4 py-2 text-left">Casilla</th><th className="px-4 py-2 text-left">Concepto</th><th className="px-4 py-2 text-right">Valor</th><th className="px-4 py-2 text-right">Fuentes</th></tr></thead>
                      <tbody>{(result.calculation?.fields || []).map(field => <tr key={`${field.code}-${field.label}`} className="border-t border-slate-100"><td className="px-4 py-2 font-mono text-xs font-semibold text-cyan-700">{field.code}</td><td className="px-4 py-2 text-slate-700"><p>{field.label}</p>{field.section && <p className="text-[11px] text-slate-400">{field.section}</p>}</td><td className="px-4 py-2 text-right font-medium text-slate-900">{field.code === 'DECLARADOS' || /Perceptores|Número/.test(field.label) ? Number(field.value).toLocaleString('es-ES') : formatMoney(field.value)}</td><td className="px-4 py-2 text-right text-xs text-slate-400">{field.sourceIds?.length || 0}</td></tr>)}</tbody>
                    </table>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className={`rounded-2xl border p-4 ${result.validation?.blockers?.length ? 'border-red-200 bg-red-50' : 'border-emerald-200 bg-emerald-50'}`}>
                    <div className="flex items-center gap-2"><CheckCircle2 className={`h-4 w-4 ${result.validation?.blockers?.length ? 'text-red-600' : 'text-emerald-600'}`} /><h3 className="text-sm font-semibold text-slate-800">Control previo</h3></div>
                    {result.validation?.blockers?.length ? <ul className="mt-3 space-y-2 text-xs leading-5 text-red-700">{result.validation.blockers.map((message, index) => <li key={index}>• {message}</li>)}</ul> : <p className="mt-2 text-xs text-emerald-700">No se han detectado bloqueos con los datos disponibles.</p>}
                    {!!result.validation?.warnings?.length && <ul className="mt-3 space-y-2 border-t border-amber-200 pt-3 text-xs leading-5 text-amber-700">{result.validation.warnings.map((message, index) => <li key={index}>• {message}</li>)}</ul>}
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <h3 className="text-sm font-semibold text-slate-800">Cobertura del cálculo</h3>
                    <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">{Object.entries(result.source?.stats || {}).map(([key, value]) => <div key={key} className="rounded-lg bg-slate-50 p-2"><dt className="capitalize text-slate-400">{key.replace(/([A-Z])/g, ' $1')}</dt><dd className="mt-1 text-lg font-bold text-slate-800">{value}</dd></div>)}</dl>
                  </div>
                </div>
              </section>

              {!!result.calculation?.details?.length && (
                <details className="rounded-2xl border border-slate-200 bg-white p-4"><summary className="cursor-pointer text-sm font-semibold text-slate-800">Ver detalle de declarados y documentos ({result.calculation.details.length})</summary><div className="mt-3 max-h-72 overflow-auto rounded-lg bg-slate-950 p-3 font-mono text-[11px] leading-5 text-slate-300"><pre className="whitespace-pre-wrap">{JSON.stringify(result.calculation.details, null, 2)}</pre></div></details>
              )}

              <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-4">
                <Button variant="outline" className="gap-2" onClick={() => invoke.mutate({ action: 'save_draft' })} disabled={invoke.isPending}><Save className="h-4 w-4" />Guardar versión</Button>
                <Button variant="outline" className="gap-2" onClick={() => invoke.mutate({ action: 'export_review' })} disabled={invoke.isPending}><FileJson className="h-4 w-4" />Descargar revisión</Button>
                {definition?.exportMode === 'atc_guided_packet' && <Button variant="outline" className="gap-2 border-cyan-300 text-cyan-800 hover:bg-cyan-50" onClick={() => invoke.mutate({ action: 'export_handoff' })} disabled={invoke.isPending}><Download className="h-4 w-4" />Descargar traspaso ATC</Button>}
                {definition?.officialExport && <Button className="gap-2 bg-emerald-700 hover:bg-emerald-800" onClick={() => invoke.mutate({ action: 'export' })} disabled={invoke.isPending || !result.validation?.canExportOfficial}><Download className="h-4 w-4" />{definition?.exportMode === 'atc_program_import' ? 'Exportar para programa ATC' : 'Exportar diseño oficial'}</Button>}
                {!result.validation?.canExportOfficial && <p className="flex items-center text-xs text-slate-500">{definition?.exportMode === 'atc_guided_packet' ? 'El traspaso ayuda a cumplimentar; el .dec se genera y valida siempre en el programa oficial.' : 'Resuelve los bloqueos o usa el programa oficial indicado antes de presentar.'}</p>}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}


