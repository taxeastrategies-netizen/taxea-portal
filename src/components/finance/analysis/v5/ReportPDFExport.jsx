/**
 * ReportPDFExport V5 — Exportación PDF IDÉNTICA al visor web
 * Genera exactamente las mismas 14 páginas que ReportPages.jsx
 * Principio: una sola fuente de verdad. PDF = informe visible. Sin versión reducida.
 */
import { fmtEUR, fmtPct, fmtX, SOURCE } from './ReportEngine';

const LOGO = 'https://media.base44.com/images/public/6a00fec50cc522a74ddde4b2/3ded74681_ChatGPTImage7may202610_56_53pm.png';
const today = () => new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });

// ── Helpers ────────────────────────────────────────────────────────────────────
const sem = {
  verde: { color: '#059669', bg: '#f0fdf4', border: '#a7f3d0', label: 'FAVORABLE' },
  ambar: { color: '#d97706', bg: '#fffbeb', border: '#fcd34d', label: 'REVISAR' },
  rojo:  { color: '#dc2626', bg: '#fef2f2', border: '#fca5a5', label: 'ALERTA' },
  gris:  { color: '#94a3b8', bg: '#f8fafc', border: '#e2e8f0', label: 'SIN DATOS' },
};
const S = (e) => sem[e] || sem.gris;

const dot = (e) => `<span style="width:10px;height:10px;border-radius:50%;background:${S(e).color};display:inline-block;flex-shrink:0"></span>`;

const row = (label, value, color = '#0f172a', indent = false, note = '') =>
  `<tr>
    <td style="padding:5px 2px;font-size:8.5pt;color:${indent ? '#64748b' : '#374151'};font-weight:${indent ? '400' : '500'};${indent ? 'padding-left:14px;' : ''}vertical-align:top">
      ${label}${note ? `<br/><span style="font-size:7pt;color:#94a3b8">${note}</span>` : ''}
    </td>
    <td style="padding:5px 2px;font-size:8.5pt;font-weight:700;color:${color};text-align:right;white-space:nowrap">${value}</td>
  </tr>`;

const kpi = (label, value, color = '#0f172a') =>
  `<div style="border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;background:#f8fafc;break-inside:avoid">
    <div style="font-size:12pt;font-weight:700;color:${color}">${value || '—'}</div>
    <div style="font-size:7.5pt;color:#94a3b8;margin-top:2px">${label}</div>
  </div>`;

const ratioCard = (nombre, formula, valor, estado, ref, interpretacion, limitacion = '') => {
  const s = S(estado);
  return `<div style="border:1px solid ${s.border};background:${s.bg};border-radius:8px;padding:10px 12px;break-inside:avoid">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:2px">
      <span style="font-size:8pt;font-weight:700;color:#1e293b;flex:1;padding-right:6px">${nombre}</span>
      ${dot(estado)}
    </div>
    <div style="font-size:15pt;font-weight:700;color:${s.color};margin:2px 0">${valor || '—'}</div>
    <div style="font-size:7pt;color:#94a3b8">${formula}</div>
    ${ref ? `<div style="font-size:7pt;color:#94a3b8">Ref: ${ref}</div>` : ''}
    ${interpretacion ? `<div style="font-size:7.5pt;color:#475569;margin-top:4px;line-height:1.4">${interpretacion}</div>` : ''}
    ${limitacion ? `<div style="font-size:7pt;color:#d97706;margin-top:2px;font-style:italic">${limitacion}</div>` : ''}
  </div>`;
};

const semCard = (label, estado, desc) => {
  const s = S(estado);
  return `<div style="border:1px solid ${s.border};background:${s.bg};border-radius:8px;padding:10px 12px;break-inside:avoid">
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
      ${dot(estado)}
      <span style="font-size:8.5pt;font-weight:700;color:#1e293b;flex:1">${label}</span>
      <span style="font-size:7.5pt;font-weight:700;color:${s.color}">${s.label}</span>
    </div>
    <p style="font-size:7.5pt;color:#64748b;line-height:1.4;margin:0">${desc}</p>
  </div>`;
};

const alertBlock = (nivel, titulo, desc, area = '', accion = '') => {
  const cfg = {
    critico: { bg: '#fef2f2', border: '#fca5a5', badge: '#dc2626' },
    alta:    { bg: '#fef2f2', border: '#fdba74', badge: '#ea580c' },
    media:   { bg: '#fffbeb', border: '#fcd34d', badge: '#d97706' },
    baja:    { bg: '#eff6ff', border: '#93c5fd', badge: '#2563eb' },
    informativo: { bg: '#f8fafc', border: '#e2e8f0', badge: '#64748b' },
  };
  const c = cfg[nivel] || cfg.informativo;
  return `<div style="border:1px solid ${c.border};background:${c.bg};border-radius:8px;padding:10px 14px;margin-bottom:8px;break-inside:avoid">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap">
      <span style="font-size:7pt;font-weight:700;background:${c.badge};color:white;padding:2px 8px;border-radius:10px;text-transform:uppercase">${nivel}</span>
      <span style="font-size:9pt;font-weight:700;color:#1e293b;flex:1">${titulo}</span>
      ${area ? `<span style="font-size:7pt;color:#94a3b8;border:1px solid #e2e8f0;padding:1px 6px;border-radius:4px">${area}</span>` : ''}
    </div>
    <p style="font-size:8.5pt;color:#475569;line-height:1.5;margin:0">${desc}</p>
    ${accion ? `<p style="font-size:7.5pt;color:#64748b;margin-top:4px;font-style:italic;margin-bottom:0">Acción recomendada: ${accion}</p>` : ''}
  </div>`;
};

const limitNote = (text) =>
  `<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;padding:8px 12px;font-size:7.5pt;color:#1d4ed8;line-height:1.5;margin:8px 0">ℹ️ ${text}</div>`;

const pageHeader = (n, title, empresa, ejercicio) =>
  `<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:18px;padding-bottom:12px;border-bottom:2px solid #f1f5f9">
    <div>
      <div style="font-size:7.5pt;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;font-weight:600;margin-bottom:2px">Taxea Strategies · Informe Financiero Premium V5</div>
      <h2 style="font-size:14pt;font-weight:700;color:#0f172a;margin:0 0 3px">${title}</h2>
      <div style="font-size:9pt;color:#64748b">${empresa}${ejercicio ? ` · Ejercicio ${ejercicio}` : ''}</div>
    </div>
    <span style="font-size:8pt;font-family:monospace;color:#94a3b8;background:#f1f5f9;padding:2px 8px;border-radius:4px;flex-shrink:0">${n}</span>
  </div>`;

const footer = (empresa, genDate, pageNum, totalPages) =>
  `<div style="margin-top:auto;padding-top:10px;border-top:1px solid #e2e8f0;font-size:7.5pt;color:#94a3b8;display:flex;justify-content:space-between;align-items:center">
    <span>Taxea Strategies · ${empresa} · ${genDate}</span>
    <span>Página ${pageNum} de ${totalPages}</span>
  </div>`;

const sectionTitle = (t) =>
  `<div style="font-size:7.5pt;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin:14px 0 6px">${t}</div>`;

const narrativaBox = (titulo, texto) =>
  `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 14px;margin:10px 0;break-inside:avoid">
    <div style="font-size:7.5pt;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">${titulo}</div>
    <p style="font-size:8.5pt;color:#334155;line-height:1.6;margin:0">${texto}</p>
  </div>`;

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', Arial, sans-serif; color: #1e293b; background: white; font-size: 10pt; line-height: 1.5; }
  @page { margin: 14mm 13mm; size: A4 portrait; }
  @media print {
    .page { page-break-after: always; min-height: auto !important; }
    .page:last-child { page-break-after: auto; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
  .page {
    min-height: 269mm; max-width: 184mm; margin: 0 auto 32px;
    padding: 0; display: flex; flex-direction: column;
  }
  .content { flex: 1; }
  .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 10px 0; }
  .kpi-grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin: 10px 0; }
  .ratio-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 8px 0; }
  .ratio-grid-2 { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin: 8px 0; }
  .sem-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin: 8px 0; }
  .data-table { width: 100%; border-collapse: collapse; margin: 8px 0; }
  .data-table th { font-size:7.5pt;font-weight:600;color:#64748b;text-align:left;padding:5px 4px;border-bottom:1px solid #e2e8f0;background:#f8fafc; }
  .data-table td { font-size:8.5pt;padding:5px 4px;border-bottom:1px solid #f8fafc;vertical-align:top; }
  h3 { font-size: 10pt; font-weight: 700; color: #0f172a; margin: 10px 0 6px; }
`;

// ── Narrativas automáticas (paralelas a ReportPages) ───────────────────────────

function narrativaBalance(calc) {
  const { totalActivo, patrimonioNeto, activoCorriente, activoNoCorriente, pasivoCorriente, fondoManiobra, autonomia } = calc;
  const parts = [];
  if (totalActivo > 0) {
    const pctNC = totalActivo > 0 ? activoNoCorriente / totalActivo * 100 : 0;
    parts.push(`La estructura del activo muestra un ${fmtPct(pctNC)} de activos no corrientes y un ${fmtPct(100 - pctNC)} de activos corrientes sobre el total de ${fmtEUR(totalActivo)}.`);
  }
  if (patrimonioNeto > 0 && autonomia !== null) {
    parts.push(`El patrimonio neto (${fmtEUR(patrimonioNeto)}) financia el ${fmtPct(autonomia * 100)} del activo, indicando ${autonomia >= 0.4 ? 'una estructura patrimonial sólida' : autonomia >= 0.25 ? 'una dependencia moderada de recursos ajenos' : 'una alta dependencia de recursos ajenos'}.`);
  }
  if (patrimonioNeto < 0) parts.push(`El patrimonio neto es negativo (${fmtEUR(patrimonioNeto)}): situación que podría constituir causa de disolución legal según el artículo 363 LSC.`);
  if (fondoManiobra !== 0) parts.push(`El fondo de maniobra es ${fondoManiobra >= 0 ? 'positivo' : 'negativo'} (${fmtEUR(fondoManiobra)}), ${fondoManiobra >= 0 ? 'lo que indica equilibrio financiero en el corto plazo' : 'lo que puede generar tensiones de liquidez a corto plazo'}.`);
  return parts.join(' ');
}

function narrativaPyG(calc) {
  const { ingresos, gastos, resultado, ebitda, amortizacion, personalGasto, margenNeto } = calc;
  const parts = [];
  if (ingresos > 0) parts.push(`Los ingresos del ejercicio ascienden a ${fmtEUR(ingresos)}.`);
  if (gastos > 0 && ingresos > 0) parts.push(`La carga de gastos totales es de ${fmtEUR(gastos)}, representando el ${fmtPct(gastos / ingresos * 100)} de los ingresos.`);
  if (personalGasto > 0 && ingresos > 0) parts.push(`Los gastos de personal (${fmtEUR(personalGasto)}) suponen el ${fmtPct(personalGasto / ingresos * 100)} de la cifra de negocio.`);
  if (resultado !== 0) parts.push(`El resultado del ejercicio es ${resultado > 0 ? 'positivo' : 'negativo'} por ${fmtEUR(Math.abs(resultado))} (margen neto: ${fmtPct((margenNeto || 0) * 100)}).`);
  if (ebitda !== 0) parts.push(`El EBITDA (resultado + amortizaciones de ${fmtEUR(amortizacion)}) se sitúa en ${fmtEUR(ebitda)}.`);
  return parts.join(' ');
}

function narrativaLiquidez(calc) {
  const { ratioLiquidez, fondoManiobra, tesoreria, pruebaAcida, clientes, proveedores } = calc;
  const parts = [];
  if (ratioLiquidez !== null) {
    if (ratioLiquidez >= 1.5) parts.push(`La empresa presenta una posición de liquidez corriente sólida (${fmtX(ratioLiquidez)}), con activos corrientes que cubren holgadamente las obligaciones a corto plazo.`);
    else if (ratioLiquidez >= 1) parts.push(`El ratio de liquidez corriente (${fmtX(ratioLiquidez)}) es positivo pero ajustado: los activos corrientes cubren el pasivo corriente con escaso margen. Cualquier deterioro en el cobro de clientes o aceleración de pagos podría generar tensiones de tesorería.`);
    else parts.push(`El ratio de liquidez corriente (${fmtX(ratioLiquidez)}) es inferior a 1, lo que indica que el pasivo corriente supera al activo corriente. Esta situación requiere atención prioritaria.`);
  }
  if (fondoManiobra !== 0) {
    if (fondoManiobra >= 0) parts.push(`El fondo de maniobra es positivo (${fmtEUR(fondoManiobra)}), lo que indica que los activos corrientes financian en parte el capital de trabajo de forma estructural.`);
    else parts.push(`El fondo de maniobra negativo (${fmtEUR(fondoManiobra)}) señala una financiación del activo fijo con recursos a corto plazo, aumentando el riesgo financiero.`);
  }
  if (tesoreria > 0) parts.push(`La posición de tesorería disponible asciende a ${fmtEUR(tesoreria)} (cuentas 57x).`);
  if (clientes > 0 && proveedores > 0) parts.push(`Los saldos de clientes (${fmtEUR(clientes)}) frente a proveedores (${fmtEUR(proveedores)}) determinan la posición neta del circulante comercial.`);
  if (pruebaAcida !== null && ratioLiquidez !== null && pruebaAcida < ratioLiquidez * 0.7) parts.push(`La prueba ácida (${fmtX(pruebaAcida)}) muestra una diferencia significativa respecto al ratio corriente, indicando un peso relevante de existencias en el activo corriente.`);
  return parts.join(' ');
}

function narrativaEndeudamiento(calc) {
  const { autonomia, endeudamiento, deudaFinancieraTotal, deudaFinancieraNeta, deudaNetaEbitda, coberturaIntereses } = calc;
  const parts = [];
  if (autonomia !== null) {
    if (autonomia >= 0.5) parts.push(`La empresa presenta una sólida autonomía financiera del ${fmtPct(autonomia * 100)}: más de la mitad del activo está financiado con recursos propios.`);
    else if (autonomia >= 0.35) parts.push(`La autonomía financiera (${fmtPct(autonomia * 100)}) se sitúa en niveles razonables, aunque la dependencia de financiación ajena es considerable.`);
    else if (autonomia >= 0.2) parts.push(`La autonomía financiera es baja (${fmtPct(autonomia * 100)}): la empresa depende mayoritariamente de financiación ajena.`);
    else parts.push(`La autonomía financiera es muy reducida (${fmtPct(autonomia * 100)}). La casi totalidad del activo está financiada con recursos ajenos.`);
  }
  if (endeudamiento !== null) parts.push(`El ratio de endeudamiento (Pasivo/PN) es de ${fmtX(endeudamiento)}, ${endeudamiento < 1.5 ? 'dentro de parámetros conservadores' : endeudamiento < 2.5 ? 'en niveles moderados' : 'en niveles elevados que deben monitorizarse'}.`);
  if (deudaFinancieraTotal > 0 && deudaNetaEbitda !== null) parts.push(`La deuda financiera neta (DFN) equivale a ${fmtX(deudaNetaEbitda)} el EBITDA. ${deudaNetaEbitda < 2 ? 'Nivel conservador.' : deudaNetaEbitda < 3.5 ? 'Nivel estándar en operaciones de deuda bancaria.' : deudaNetaEbitda < 5 ? 'Nivel que puede limitar el acceso a nueva financiación.' : 'Nivel elevado que requiere un plan activo de desapalancamiento.'}`);
  if (coberturaIntereses !== null) parts.push(`La cobertura de intereses (EBITDA/Gasto financiero) es de ${fmtX(coberturaIntereses)}, ${coberturaIntereses > 5 ? 'muy holgada' : coberturaIntereses > 3 ? 'razonable' : 'ajustada'}.`);
  if (deudaFinancieraTotal === 0) parts.push('No se identifican cuentas de deuda financiera bancaria (17x/52x) en la documentación aportada.');
  return parts.join(' ');
}

function narrativaRentabilidad(calc) {
  const { margenNeto, margenEBITDA, roa, roe, pesPersonal, pesServicios, resultado, ebitda, ingresos } = calc;
  const parts = [];
  if (margenNeto !== null) {
    if (margenNeto > 0.15) parts.push(`La empresa presenta un margen neto excelente del ${fmtPct(margenNeto * 100)}: por cada euro de ingresos retiene más del 15% de beneficio neto.`);
    else if (margenNeto > 0.05) parts.push(`El margen neto (${fmtPct(margenNeto * 100)}) es positivo y razonable, aunque existe margen de mejora en la optimización de la estructura de costes.`);
    else if (margenNeto > 0) parts.push(`El margen neto es positivo pero muy ajustado (${fmtPct(margenNeto * 100)}). Pequeñas variaciones en ingresos o costes pueden llevar el resultado a territorio negativo.`);
    else parts.push(`El margen neto es negativo (${fmtPct(margenNeto * 100)}). La empresa consume más recursos de los que genera y es prioritario identificar las partidas de coste con mayor impacto.`);
  }
  if (margenEBITDA !== null) parts.push(`El margen EBITDA es del ${fmtPct(margenEBITDA * 100)} (EBITDA: ${fmtEUR(ebitda)}), que representa la generación de caja operativa antes de amortizaciones, intereses e impuestos.`);
  if (roa !== null) parts.push(`El ROA (${fmtPct(roa * 100)}) indica la rentabilidad que la empresa obtiene sobre sus activos totales.`);
  if (roe !== null) parts.push(`El ROE (${fmtPct(roe * 100)}) refleja el retorno generado sobre los fondos propios.`);
  if (pesPersonal !== null) parts.push(`El gasto de personal representa el ${fmtPct(pesPersonal * 100)} de los ingresos, ${pesPersonal < 0.35 ? 'dentro de parámetros eficientes' : pesPersonal < 0.5 ? 'en niveles que merecen seguimiento' : 'un nivel elevado que presiona la rentabilidad'}.`);
  return parts.join(' ');
}

// ── Constructor principal del HTML ─────────────────────────────────────────────
export function buildPDFHTML(calc, alertas, recs, aiContent, imp) {
  const { empresa, ejercicio } = calc;
  const genDate = today();
  const TOTAL_PAGES = 14;

  // ── Semáforos (idénticos a ReportPages) ────────────────────────────────────
  const semaforos = [
    { label: 'Liquidez', estado: calc.ratioLiquidez === null ? 'gris' : calc.ratioLiquidez >= 1.2 ? 'verde' : calc.ratioLiquidez >= 1 ? 'ambar' : 'rojo',
      desc: calc.ratioLiquidez !== null ? `Ratio corriente: ${fmtX(calc.ratioLiquidez)}. Fondo de maniobra: ${fmtEUR(calc.fondoManiobra)}.` : 'No calculable: falta balance completo.' },
    { label: 'Solvencia', estado: calc.autonomia === null ? 'gris' : calc.autonomia >= 0.35 ? 'verde' : calc.autonomia >= 0.2 ? 'ambar' : 'rojo',
      desc: calc.autonomia !== null ? `Autonomía financiera: ${fmtPct(calc.autonomia * 100)}. Endeudamiento: ${fmtX(calc.endeudamiento)}.` : 'No calculable: falta balance.' },
    { label: 'Rentabilidad', estado: !calc.hasPyG ? 'gris' : calc.resultado > 0 ? 'verde' : 'rojo',
      desc: calc.hasPyG ? `Resultado: ${fmtEUR(calc.resultado)}. Margen neto: ${fmtPct((calc.margenNeto || 0) * 100)}.` : 'No calculable: falta PyG.' },
    { label: 'Cashflow', estado: !calc.hasPyG ? 'gris' : calc.cashflowContable > 0 ? 'verde' : 'rojo',
      desc: calc.hasPyG ? `Cashflow contable estimado: ${fmtEUR(calc.cashflowContable)}.` : 'No calculable con seguridad sin PyG.' },
    { label: 'Fiscalidad', estado: 'ambar', desc: 'Análisis fiscal preliminar. Contrastar con modelos tributarios para conclusión definitiva.' },
    { label: 'Calidad contable', estado: calc.calidadScore >= 80 ? 'verde' : calc.calidadScore >= 60 ? 'ambar' : 'rojo',
      desc: `Calificación: ${calc.calidadLabel}. Puntuación: ${calc.calidadScore}/100.` },
    { label: 'Riesgo mercantil', estado: calc.patrimonioNeto < 0 ? 'rojo' : calc.patrimonioNeto < calc.totalActivo * 0.1 ? 'ambar' : 'verde',
      desc: calc.patrimonioNeto < 0 ? 'Patrimonio neto negativo. Posible causa de disolución.' : `Patrimonio neto: ${fmtEUR(calc.patrimonioNeto)} (${fmtPct((calc.autonomia || 0) * 100)} del activo).` },
    { label: 'M&A', estado: !calc.hasPyG ? 'gris' : calc.deudaNetaEbitda === null ? 'ambar' : calc.deudaNetaEbitda < 3 ? 'verde' : calc.deudaNetaEbitda < 5 ? 'ambar' : 'rojo',
      desc: calc.hasPyG ? `EBITDA: ${fmtEUR(calc.ebitda)}. DFN/EBITDA: ${calc.deudaNetaEbitda !== null ? fmtX(calc.deudaNetaEbitda) : 'N/D'}.` : 'Sin PyG, lectura M&A limitada.' },
  ];

  // ── Cuentas fiscales ────────────────────────────────────────────────────────
  const cuentasFiscales = (calc.cuentas || []).filter(c =>
    ['472','474','475','476','477','470','471'].some(p => String(c.cuenta).startsWith(p))
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // PÁGINAS (14 páginas — idénticas en estructura a ReportPages.jsx)
  // ─────────────────────────────────────────────────────────────────────────────

  // PÁGINA 1 — PORTADA
  const page1 = `<div class="page">
  <div class="content">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;padding-top:4px;margin-bottom:32px">
      <img src="${LOGO}" alt="Taxea Strategies" style="height:52px;object-fit:contain"/>
      <div style="text-align:right;font-size:7pt;color:#94a3b8;text-transform:uppercase;letter-spacing:1px">Análisis Financiero Premium V5<br/>Confidencial</div>
    </div>
    <div style="border-left:4px solid #0f172a;padding-left:20px;margin-bottom:28px">
      <div style="font-family:'Plus Jakarta Sans',sans-serif;font-size:22pt;font-weight:800;color:#0f172a;line-height:1.2">Informe Financiero<br/>Premium</div>
      <div style="font-size:11pt;color:#64748b;margin-top:6px">Análisis Integral de Estados Financieros</div>
    </div>
    <table style="width:100%;border-collapse:collapse;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px">
      ${[
        ['Sociedad analizada', empresa],
        ['Período analizado', `${imp?.periodo_inicio || '—'} — ${imp?.periodo_fin || '—'}`],
        ['Fuente documental', `${imp?.origen || '—'} · ${imp?.nombre_archivo || '—'}`],
        ['Fecha de generación', genDate],
        ['Nivel de revisión', 'Preliminar — pendiente validación contable definitiva'],
        ['Confianza extracción IA', calc.confianza ? `${calc.confianza}%` : 'N/D'],
        ['Motor análisis', 'Taxea IA V5 · Corporate Finance Grade'],
      ].map(([k, v]) => `<tr><td style="padding:6px 10px;font-size:8.5pt;color:#64748b;width:150px;font-weight:500">${k}</td><td style="padding:6px 10px;font-size:8.5pt;font-weight:700;color:#0f172a">${v}</td></tr>`).join('')}
    </table>
    <div style="margin-top:24px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 14px">
      <div style="font-size:7.5pt;font-weight:700;color:#94a3b8;text-transform:uppercase;margin-bottom:6px">Fuentes de datos aportadas</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
        ${[
          ['Balance de situación', calc.hasBalance],
          ['Cuenta de PyG', calc.hasPyG],
          ['Balance comparativo anterior', false],
          ['Modelos fiscales', false],
          ['Extractos bancarios', false],
          ['Libro diario / mayor', false],
        ].map(([label, ok]) => `<div style="display:flex;align-items:center;gap:6px;font-size:7.5pt;color:${ok ? '#059669' : '#94a3b8'}">${ok ? '✓' : '○'} ${label}</div>`).join('')}
      </div>
    </div>
    <div style="background:#0f172a;border-radius:8px;padding:10px 14px;margin-top:20px">
      <p style="font-size:7.5pt;color:#94a3b8;line-height:1.6;margin:0"><strong style="color:white">Aviso de alcance:</strong> Informe elaborado por Taxea Strategies con base en la documentación facilitada. Carácter preliminar. No constituye auditoría, certificación contable ni asesoramiento jurídico definitivo. Las conclusiones deben contrastarse con documentación soporte, modelos fiscales y libros contables.</p>
    </div>
  </div>
  ${footer(empresa, genDate, 1, TOTAL_PAGES)}
</div>`;

  // PÁGINA 2 — RESUMEN EJECUTIVO
  const page2 = `<div class="page">
  <div class="content">
    ${pageHeader('02', 'Resumen ejecutivo', empresa, ejercicio)}
    <div class="kpi-grid">
      ${kpi('Total Activo', fmtEUR(calc.totalActivo), '#1d4ed8')}
      ${kpi('Patrimonio Neto', fmtEUR(calc.patrimonioNeto), calc.patrimonioNeto >= 0 ? '#059669' : '#dc2626')}
      ${kpi('Fondo de Maniobra', fmtEUR(calc.fondoManiobra), calc.fondoManiobra >= 0 ? '#059669' : '#dc2626')}
      ${kpi('Ingresos', calc.hasPyG ? fmtEUR(calc.ingresos) : '—', '#059669')}
      ${kpi('Resultado', calc.hasPyG ? fmtEUR(calc.resultado) : '—', calc.resultado >= 0 ? '#059669' : '#dc2626')}
      ${kpi('EBITDA', calc.hasPyG ? fmtEUR(calc.ebitda) : '—', '#1d4ed8')}
      ${kpi('Tesorería', fmtEUR(calc.tesoreria), '#0f172a')}
      ${kpi('Deuda Financiera Neta', fmtEUR(calc.deudaFinancieraNeta), calc.deudaFinancieraNeta <= 0 ? '#059669' : '#d97706')}
      ${kpi('Runway estimado', calc.runwayBruto ? `${calc.runwayBruto.toFixed(1)} meses` : '—', calc.runwayBruto && calc.runwayBruto < 6 ? '#dc2626' : '#0f172a')}
    </div>
    ${aiContent?.diagnostico_ejecutivo ? narrativaBox('Diagnóstico ejecutivo', aiContent.diagnostico_ejecutivo) : ''}
    ${sectionTitle('Semáforo financiero Taxea Strategies — 8 áreas')}
    <div class="sem-grid">${semaforos.map(s => semCard(s.label, s.estado, s.desc)).join('')}</div>
  </div>
  ${footer(empresa, genDate, 2, TOTAL_PAGES)}
</div>`;

  // PÁGINA 3 — ALCANCE Y LIMITACIONES
  const page3 = `<div class="page">
  <div class="content">
    ${pageHeader('03', 'Alcance, fuentes y limitaciones', empresa, ejercicio)}
    <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:12px 14px;margin-bottom:14px">
      <div style="font-size:8.5pt;font-weight:700;color:#92400e;margin-bottom:4px">Principio fundamental de este informe</div>
      <p style="font-size:8.5pt;color:#78350f;line-height:1.6;margin:0">Este informe se construye exclusivamente sobre datos extraídos del documento aportado. No se inventan cifras. Si un dato no existe o no es calculable con seguridad, se indica expresamente. Las estimaciones y escenarios se presentan como tales, nunca como hechos.</p>
    </div>
    <table class="data-table">
      <tr><th>Fuente documental</th><th>Estado</th><th>Impacto si no disponible</th></tr>
      ${[
        ['Balance de situación', calc.hasBalance, 'Liquidez, solvencia y ratios de balance no calculables'],
        ['Cuenta de PyG', calc.hasPyG, 'Rentabilidad, cashflow y burn rate no calculables'],
        ['Balance comparativo anterior', false, 'Variaciones de WC y cashflow indirecto no calculables'],
        ['Libro diario / mayor', false, 'Trazabilidad de partidas y ajustes no verificable'],
        ['Modelos fiscales (303, 200...)', false, 'Análisis fiscal limitado a cuentas contables'],
        ['Extractos bancarios', false, 'Posición de tesorería no conciliada con movimientos reales'],
      ].map(([f, ok, imp2]) => `<tr>
        <td style="font-size:8.5pt;color:${ok ? '#059669' : '#94a3b8'}">${ok ? '✓' : '○'} ${f}</td>
        <td><span style="font-size:7pt;font-weight:700;padding:2px 8px;border-radius:10px;background:${ok ? '#d1fae5' : '#f1f5f9'};color:${ok ? '#059669' : '#64748b'}">${ok ? 'Disponible' : 'No aportado'}</span></td>
        <td style="font-size:7.5pt;color:#94a3b8">${ok ? 'Incluido en análisis' : imp2}</td>
      </tr>`).join('')}
    </table>
    ${sectionTitle('Limitaciones del análisis presente')}
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 14px">
      ${[
        !calc.hasPyG && 'Sin PyG: ratios de rentabilidad, cashflow y burn rate no son calculables con certeza.',
        !calc.hasBalance && 'Sin balance: ningún ratio de liquidez, endeudamiento o solvencia es calculable.',
        calc.descuadre && `Balance con descuadre detectado de ${fmtEUR(calc.diferencia)}: todos los ratios derivados deben tomarse con cautela hasta resolver la diferencia.`,
        'Sin balance comparativo: no es posible calcular variaciones de working capital ni cashflow indirecto.',
        'Sin modelos fiscales: el análisis fiscal tiene carácter exclusivamente preliminar.',
        'Sin extractos bancarios: la posición de tesorería no ha sido conciliada con movimientos reales.',
        'La extracción mediante IA/OCR puede contener errores de lectura que el usuario debe verificar.',
      ].filter(Boolean).map(l => `<div style="display:flex;align-items:flex-start;gap:8px;padding:4px 0;font-size:8.5pt;color:#475569;border-bottom:1px solid #f1f5f9">
        <span style="color:#94a3b8;flex-shrink:0">ℹ</span>${l}
      </div>`).join('')}
    </div>
  </div>
  ${footer(empresa, genDate, 3, TOTAL_PAGES)}
</div>`;

  // PÁGINA 4 — BALANCE
  const page4 = `<div class="page">
  <div class="content">
    ${pageHeader('04', 'Balance de situación reconstruido', empresa, ejercicio)}
    ${!calc.hasBalance
      ? limitNote('Balance no disponible en la documentación aportada. Para este bloque se requiere balance de situación o balance de sumas y saldos.')
      : `${!calc.balanceCuadra ? `<div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:8px 12px;margin-bottom:12px">
          <div style="font-size:8.5pt;font-weight:700;color:#dc2626">⚠ Descuadre detectado: diferencia de ${fmtEUR(calc.diferencia)} entre activo y PN+Pasivo. Revisar antes de validar.</div>
        </div>` : `<div style="background:#f0fdf4;border:1px solid #a7f3d0;border-radius:8px;padding:8px 12px;margin-bottom:12px">
          <div style="font-size:8.5pt;font-weight:700;color:#059669">✓ Balance cuadra — Activo = PN + Pasivo (${fmtEUR(calc.totalActivo)})</div>
        </div>`}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div>
          ${sectionTitle('Estructura patrimonial')}
          <table style="width:100%;border-collapse:collapse">
            ${row('Total Activo', fmtEUR(calc.totalActivo), '#1d4ed8')}
            ${row('Activo No Corriente', fmtEUR(calc.activoNoCorriente), '#374151', true, `${fmtPct(calc.totalActivo > 0 ? calc.activoNoCorriente / calc.totalActivo * 100 : 0)} del activo`)}
            ${row('Activo Corriente', fmtEUR(calc.activoCorriente), '#374151', true, `${fmtPct(calc.totalActivo > 0 ? calc.activoCorriente / calc.totalActivo * 100 : 0)} del activo`)}
            <tr><td colspan="2" style="border-top:2px solid #e2e8f0;padding:4px 0"></td></tr>
            ${row('Total PN + Pasivo', fmtEUR(calc.patrimonioNeto + calc.totalPasivo), calc.balanceCuadra ? '#059669' : '#dc2626')}
            ${row('Patrimonio Neto', fmtEUR(calc.patrimonioNeto), calc.patrimonioNeto >= 0 ? '#059669' : '#dc2626', true)}
            ${row('Pasivo No Corriente', fmtEUR(calc.pasivoNoCorriente), '#374151', true)}
            ${row('Pasivo Corriente', fmtEUR(calc.pasivoCorriente), '#374151', true)}
            <tr><td colspan="2" style="border-top:2px solid #e2e8f0;padding:4px 0"></td></tr>
            ${row('Fondo de Maniobra', fmtEUR(calc.fondoManiobra), calc.fondoManiobra >= 0 ? '#059669' : '#dc2626', false, 'Activo C − Pasivo C')}
            ${calc.tesoreria > 0 ? row('Tesorería disponible (57x)', fmtEUR(calc.tesoreria), '#0f172a', true) : ''}
            ${calc.clientes > 0 ? row('Saldo de clientes', fmtEUR(calc.clientes), '#374151', true) : ''}
            ${calc.proveedores > 0 ? row('Saldo de proveedores', fmtEUR(calc.proveedores), '#374151', true) : ''}
          </table>
        </div>
        <div>
          ${sectionTitle('Ratios de balance clave')}
          <div style="display:flex;flex-direction:column;gap:8px">
            ${ratioCard('Autonomía financiera', 'PN / Total Activo', fmtPct((calc.autonomia||0)*100),
              calc.autonomia === null ? 'gris' : calc.autonomia >= 0.35 ? 'verde' : calc.autonomia >= 0.2 ? 'ambar' : 'rojo', '≥ 35%',
              calc.autonomia >= 0.5 ? 'Estructura sólida: recursos propios mayoritarios.' : calc.autonomia >= 0.35 ? 'Razonable. Dependencia moderada de financiación ajena.' : 'Alta dependencia de recursos ajenos.')}
            ${ratioCard('Endeudamiento', 'Pasivo Total / PN', fmtX(calc.endeudamiento),
              calc.endeudamiento === null ? 'gris' : calc.endeudamiento < 1.5 ? 'verde' : calc.endeudamiento < 2.5 ? 'ambar' : 'rojo', '< 2,0x',
              calc.endeudamiento < 1.5 ? 'Nivel conservador.' : calc.endeudamiento < 2.5 ? 'Nivel moderado.' : 'Nivel elevado. Puede dificultar nueva financiación.')}
            ${ratioCard('Solvencia patrimonial', 'Total Activo / Pasivo', fmtX(calc.solvencia),
              calc.solvencia === null ? 'gris' : calc.solvencia >= 1.5 ? 'verde' : calc.solvencia >= 1.2 ? 'ambar' : 'rojo', '≥ 1,5',
              calc.solvencia >= 1.5 ? 'El activo cubre con holgura todas las deudas.' : calc.solvencia >= 1 ? 'Solvencia ajustada.' : 'Activo inferior al pasivo total.')}
          </div>
        </div>
      </div>
      ${narrativaBalance(calc) ? narrativaBox('Interpretación del balance', narrativaBalance(calc)) : ''}
      ${aiContent?.analisis_balance ? `${sectionTitle('Análisis narrativo IA')}
        ${Object.entries({ 'Activo no corriente': aiContent.analisis_balance.activo_no_corriente, 'Activo corriente': aiContent.analisis_balance.activo_corriente, 'Patrimonio neto': aiContent.analisis_balance.patrimonio_neto, 'Pasivo no corriente': aiContent.analisis_balance.pasivo_no_corriente, 'Pasivo corriente': aiContent.analisis_balance.pasivo_corriente }).filter(([,v]) => v).map(([k, v]) => `<p style="font-size:7.5pt;font-weight:700;color:#64748b;margin:6px 0 2px">${k}</p><p style="font-size:8.5pt;color:#334155;line-height:1.5;margin:0">${v}</p>`).join('')}` : ''}
    `}
  </div>
  ${footer(empresa, genDate, 4, TOTAL_PAGES)}
</div>`;

  // PÁGINA 5 — PyG
  const page5 = `<div class="page">
  <div class="content">
    ${pageHeader('05', 'Cuenta de pérdidas y ganancias', empresa, ejercicio)}
    ${!calc.hasPyG
      ? limitNote('Cuenta de PyG no disponible en la documentación aportada. Los ratios de rentabilidad, cashflow y burn rate no son calculables con seguridad.')
      : `<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <div>
            ${sectionTitle('Estructura de ingresos y gastos')}
            <table style="width:100%;border-collapse:collapse">
              ${row('Ingresos — Cifra de negocios (Grupo 7)', fmtEUR(calc.ingresos), '#059669')}
              ${row('Gastos de explotación totales', fmtEUR(calc.gastos))}
              ${calc.personalGasto > 0 ? row('Personal (64x)', `${fmtEUR(calc.personalGasto)}`, '#64748b', true, calc.ingresos > 0 ? `${fmtPct(calc.personalGasto/calc.ingresos*100)} s/ingresos` : '') : ''}
              ${calc.serviciosGasto > 0 ? row('Servicios exteriores (62x)', `${fmtEUR(calc.serviciosGasto)}`, '#64748b', true, calc.ingresos > 0 ? `${fmtPct(calc.serviciosGasto/calc.ingresos*100)} s/ingresos` : '') : ''}
              ${calc.gastoFinanciero > 0 ? row('Gasto financiero (66x)', fmtEUR(calc.gastoFinanciero), '#64748b', true) : ''}
              ${calc.amortizacion > 0 ? row('Amortizaciones (68x)', fmtEUR(calc.amortizacion), '#64748b', true) : ''}
              <tr><td colspan="2" style="border-top:2px solid #e2e8f0;padding:4px 0"></td></tr>
              ${row('Resultado del ejercicio', fmtEUR(calc.resultado), calc.resultado >= 0 ? '#059669' : '#dc2626')}
              ${row('EBITDA estimado', fmtEUR(calc.ebitda), '#1d4ed8', false, 'Resultado + Amortizaciones')}
              ${row('Margen neto', fmtPct((calc.margenNeto||0)*100), calc.resultado >= 0 ? '#059669' : '#dc2626')}
              ${row('Margen EBITDA', fmtPct((calc.margenEBITDA||0)*100), '#1d4ed8')}
            </table>
          </div>
          <div>
            ${sectionTitle('Ratios de rentabilidad')}
            <div style="display:flex;flex-direction:column;gap:8px">
              ${ratioCard('Margen neto', 'Resultado / Ingresos', fmtPct((calc.margenNeto||0)*100),
                calc.resultado > 0 ? 'verde' : 'rojo', '> 0%',
                calc.resultado > 0 ? `Resultado positivo: ${fmtEUR(calc.resultado)} de beneficio neto.` : `Resultado negativo: ${fmtEUR(calc.resultado)}. Revisar estructura de costes.`)}
              ${ratioCard('Margen EBITDA', 'EBITDA / Ingresos', fmtPct((calc.margenEBITDA||0)*100),
                calc.ebitda > 0 ? 'verde' : 'rojo', '> 10%',
                calc.ebitda > 0 ? `EBITDA positivo (${fmtEUR(calc.ebitda)}): genera caja antes de amortizaciones e intereses.` : 'EBITDA negativo: la operación no genera caja suficiente.')}
              ${ratioCard('Peso personal / ingresos', 'Gasto personal / Ingresos', fmtPct((calc.pesPersonal||0)*100),
                calc.pesPersonal === null ? 'gris' : calc.pesPersonal < 0.35 ? 'verde' : calc.pesPersonal < 0.5 ? 'ambar' : 'rojo', '< 35-40%',
                calc.pesPersonal < 0.35 ? 'Estructura salarial eficiente.' : calc.pesPersonal < 0.5 ? 'Coste de personal significativo. Monitorizar.' : 'Coste de personal elevado.')}
            </div>
          </div>
        </div>
        ${narrativaPyG(calc) ? narrativaBox('Interpretación de la PyG', narrativaPyG(calc)) : ''}
        ${aiContent?.analisis_pyg ? `${sectionTitle('Análisis narrativo IA')}
          ${Object.entries({ Ingresos: aiContent.analisis_pyg.ingresos, Gastos: aiContent.analisis_pyg.gastos, Resultado: aiContent.analisis_pyg.resultado }).filter(([,v]) => v).map(([k, v]) => `<p style="font-size:7.5pt;font-weight:700;color:#64748b;margin:6px 0 2px">${k}</p><p style="font-size:8.5pt;color:#334155;line-height:1.5;margin:0">${v}</p>`).join('')}` : ''}
      `}
  </div>
  ${footer(empresa, genDate, 5, TOTAL_PAGES)}
</div>`;

  // PÁGINA 6 — LIQUIDEZ, TESORERÍA Y RUNWAY
  const s1 = calc.ratioLiquidez === null ? 'gris' : calc.ratioLiquidez >= 1.5 ? 'verde' : calc.ratioLiquidez >= 1 ? 'ambar' : 'rojo';
  const s2 = calc.pruebaAcida === null ? 'gris' : calc.pruebaAcida >= 1 ? 'verde' : calc.pruebaAcida >= 0.7 ? 'ambar' : 'rojo';
  const s3 = calc.liquidezInmediata === null ? 'gris' : calc.liquidezInmediata >= 0.3 ? 'verde' : calc.liquidezInmediata >= 0.15 ? 'ambar' : 'rojo';

  const page6 = `<div class="page">
  <div class="content">
    ${pageHeader('06', 'Liquidez, tesorería y runway', empresa, ejercicio)}
    ${!calc.hasBalance
      ? limitNote('No calculable: falta balance de situación.')
      : `<div class="ratio-grid">
          ${ratioCard('Liquidez corriente', 'Activo C / Pasivo C', fmtX(calc.ratioLiquidez), s1, '≥ 1,5',
            s1 === 'verde' ? 'Nivel óptimo. Activo corriente cubre ampliamente el pasivo corriente.' :
            s1 === 'ambar' ? 'Nivel ajustado. Cubre el pasivo corriente pero con margen reducido.' :
            'Nivel crítico. El pasivo corriente supera el activo corriente.')}
          ${ratioCard('Prueba ácida', '(Activo C − Exist.) / Pasivo C', fmtX(calc.pruebaAcida), s2, '≥ 1,0',
            s2 === 'verde' ? 'Posición solvente excluyendo existencias.' :
            s2 === 'ambar' ? 'Cobertura ajustada sin existencias. Monitorizar.' :
            'Insuficiente sin existencias. Riesgo de liquidez.')}
          ${ratioCard('Liquidez inmediata', 'Tesorería / Pasivo C', fmtX(calc.liquidezInmediata), s3, '≥ 0,2',
            s3 === 'verde' ? 'Caja suficiente para cobertura inmediata de obligaciones.' :
            s3 === 'ambar' ? 'Cobertura de caja ajustada. Vigilar vencimientos.' :
            'Caja insuficiente para cobertura inmediata del pasivo corriente.')}
        </div>
        ${narrativaLiquidez(calc) ? narrativaBox('Diagnóstico de liquidez', narrativaLiquidez(calc)) : ''}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:10px">
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px">
            ${sectionTitle('Posición de tesorería')}
            <table style="width:100%;border-collapse:collapse">
              ${row('Tesorería disponible (57x)', fmtEUR(calc.tesoreria))}
              ${row('Fondo de maniobra', fmtEUR(calc.fondoManiobra), calc.fondoManiobra >= 0 ? '#059669' : '#dc2626')}
              ${calc.clientes > 0 ? row('Clientes pendientes de cobro', fmtEUR(calc.clientes)) : ''}
              ${calc.proveedores > 0 ? row('Proveedores pendientes de pago', fmtEUR(calc.proveedores)) : ''}
              ${calc.existencias > 0 ? row('Existencias en balance', fmtEUR(calc.existencias)) : ''}
            </table>
          </div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px">
            ${sectionTitle('Burn rate & runway')}
            ${calc.burnRateBruto
              ? `<table style="width:100%;border-collapse:collapse">
                  ${row('Burn rate bruto / mes', fmtEUR(calc.burnRateBruto), '#0f172a', false, calc.runwaySource === SOURCE.SUPUESTO ? '⚠ Supuesto usuario' : 'Calculado de PyG')}
                  ${row('Runway escenario base', calc.runwayBruto ? `${calc.runwayBruto.toFixed(1)} meses` : '—', calc.runwayBruto && calc.runwayBruto < 6 ? '#dc2626' : '#059669')}
                  ${calc.runwayEscenarioTension ? row('Runway tensión (+20% gastos)', `${calc.runwayEscenarioTension.toFixed(1)} meses`, '#d97706') : ''}
                  ${calc.runwayEscenarioEstres ? row('Runway estrés (+50% gastos)', `${calc.runwayEscenarioEstres.toFixed(1)} meses`, '#dc2626') : ''}
                </table>`
              : limitNote('Burn rate no calculable: aportar gastos mensuales en supuestos editables o adjuntar PyG.')
            }
          </div>
        </div>
        ${calc.runwaySource === SOURCE.SUPUESTO ? limitNote('El burn rate y runway mostrados son escenarios basados en supuestos introducidos por el usuario, no datos contables extraídos del documento.') : ''}
      `}
  </div>
  ${footer(empresa, genDate, 6, TOTAL_PAGES)}
</div>`;

  // PÁGINA 7 — ENDEUDAMIENTO Y SOLVENCIA
  const page7 = `<div class="page">
  <div class="content">
    ${pageHeader('07', 'Endeudamiento y solvencia', empresa, ejercicio)}
    ${!calc.hasBalance
      ? limitNote('No calculable sin balance de situación.')
      : `<div class="ratio-grid">
          ${ratioCard('Autonomía financiera', 'PN / Total Activo', fmtPct((calc.autonomia||0)*100),
            calc.autonomia >= 0.35 ? 'verde' : calc.autonomia >= 0.2 ? 'ambar' : 'rojo', '≥ 35%',
            calc.autonomia >= 0.5 ? 'Estructura sólida. Mayoría de activos financiados con recursos propios.' :
            calc.autonomia >= 0.35 ? 'Estructura razonable. Dependencia moderada de financiación ajena.' :
            'Alta dependencia de recursos ajenos. Riesgo estructural elevado.')}
          ${ratioCard('Endeudamiento total', 'Pasivo / PN', fmtX(calc.endeudamiento),
            calc.endeudamiento === null ? 'gris' : calc.endeudamiento < 1.5 ? 'verde' : calc.endeudamiento < 2.5 ? 'ambar' : 'rojo', '< 2,0x',
            calc.endeudamiento < 1.5 ? 'Endeudamiento conservador.' :
            calc.endeudamiento < 2.5 ? 'Endeudamiento moderado. Dentro de rangos habituales.' :
            'Endeudamiento elevado. Puede dificultar nueva financiación bancaria.')}
          ${ratioCard('Solvencia patrimonial', 'Total Activo / Pasivo', fmtX(calc.solvencia),
            calc.solvencia === null ? 'gris' : calc.solvencia >= 1.5 ? 'verde' : calc.solvencia >= 1.2 ? 'ambar' : 'rojo', '≥ 1,5',
            calc.solvencia >= 1.5 ? 'El activo cubre con holgura todas las deudas.' :
            calc.solvencia >= 1 ? 'Solvencia ajustada. Activo cubre deudas sin margen amplio.' :
            'Insolvencia técnica: el pasivo supera el activo total.')}
        </div>
        ${narrativaEndeudamiento(calc) ? narrativaBox('Diagnóstico de endeudamiento y solvencia', narrativaEndeudamiento(calc)) : ''}
        ${sectionTitle('Deuda financiera identificada (cuentas 17x / 52x)')}
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px">
          <table style="width:100%;border-collapse:collapse">
            ${row('Deuda financiera CP (52x)', fmtEUR(calc.deudaFinancieraCp))}
            ${row('Deuda financiera LP (17x)', fmtEUR(calc.deudaFinancieraLp))}
            ${row('Deuda financiera total', fmtEUR(calc.deudaFinancieraTotal), '#0f172a')}
            ${row('Tesorería disponible', fmtEUR(calc.tesoreria))}
            ${row('Deuda financiera neta (DFN)', fmtEUR(calc.deudaFinancieraNeta), calc.deudaFinancieraNeta <= 0 ? '#059669' : '#d97706', false, 'Deuda financiera bruta − Tesorería')}
            ${calc.deudaNetaEbitda !== null ? row('DFN / EBITDA', fmtX(calc.deudaNetaEbitda), calc.deudaNetaEbitda < 3 ? '#059669' : calc.deudaNetaEbitda < 5 ? '#d97706' : '#dc2626', false, 'Ref: < 3x conservador, < 5x transaccional') : ''}
            ${calc.coberturaIntereses !== null ? row('Cobertura de intereses', fmtX(calc.coberturaIntereses), calc.coberturaIntereses > 3 ? '#059669' : '#d97706', false, 'EBITDA / Gasto financiero. Ref: > 3x') : ''}
          </table>
        </div>
        ${calc.deudaFinancieraTotal === 0 ? limitNote('No se han identificado cuentas de deuda financiera (17x / 52x) en el documento. Confirmar si la empresa carece de deuda financiera o si no figura en la fuente aportada.') : ''}
      `}
  </div>
  ${footer(empresa, genDate, 7, TOTAL_PAGES)}
</div>`;

  // PÁGINA 8 — RENTABILIDAD Y EFICIENCIA
  const page8 = `<div class="page">
  <div class="content">
    ${pageHeader('08', 'Rentabilidad y eficiencia', empresa, ejercicio)}
    ${!calc.hasPyG
      ? limitNote('Ratios de rentabilidad no calculables: falta cuenta de PyG.')
      : `<div class="ratio-grid">
          ${ratioCard('Margen neto', 'Resultado / Ingresos', fmtPct((calc.margenNeto||0)*100),
            calc.resultado > 0 ? 'verde' : 'rojo', '> 0%',
            calc.resultado > 0 ? `Resultado positivo: ${fmtEUR(calc.resultado)} de beneficio neto en el ejercicio.` : `Resultado negativo: ${fmtEUR(calc.resultado)}. La empresa consume más recursos de los que genera.`)}
          ${ratioCard('Margen EBITDA', 'EBITDA / Ingresos', fmtPct((calc.margenEBITDA||0)*100),
            calc.ebitda > 0 ? 'verde' : 'rojo', '> 10%',
            calc.ebitda > 0 ? `EBITDA positivo (${fmtEUR(calc.ebitda)}): la operación genera caja antes de amortizaciones e intereses.` : 'EBITDA negativo: la operación no genera caja suficiente. Revisión urgente.')}
          ${ratioCard('ROA', 'Resultado / Total Activo', fmtPct((calc.roa||0)*100),
            calc.roa === null ? 'gris' : calc.roa > 0.05 ? 'verde' : calc.roa > 0 ? 'ambar' : 'rojo', '> 5%',
            calc.roa > 0.08 ? 'Buena eficiencia en el uso de activos.' : calc.roa > 0 ? 'Rentabilidad sobre activos positiva pero mejorable.' : 'Activos no generan retorno positivo.')}
          ${ratioCard('ROE', 'Resultado / PN', fmtPct((calc.roe||0)*100),
            calc.roe === null ? 'gris' : calc.roe > 0.1 ? 'verde' : calc.roe > 0 ? 'ambar' : 'rojo', '> 10%',
            calc.roe > 0.15 ? 'Retorno sobre equity atractivo.' : calc.roe > 0 ? 'Positivo pero por debajo del 10% de referencia.' : 'Fondos propios generan pérdidas.')}
          ${ratioCard('Peso personal / ingresos', 'Gasto personal / Ingresos', fmtPct((calc.pesPersonal||0)*100),
            calc.pesPersonal === null ? 'gris' : calc.pesPersonal < 0.35 ? 'verde' : calc.pesPersonal < 0.5 ? 'ambar' : 'rojo', '< 35-40%',
            calc.pesPersonal < 0.35 ? 'Estructura salarial eficiente.' : 'Coste de personal relevante respecto a ingresos. Revisar productividad.')}
          ${ratioCard('Peso servicios / ingresos', 'Serv. exteriores / Ingresos', fmtPct((calc.pesServicios||0)*100),
            calc.pesServicios === null ? 'gris' : calc.pesServicios < 0.3 ? 'verde' : calc.pesServicios < 0.45 ? 'ambar' : 'rojo', '< 30%',
            calc.pesServicios < 0.3 ? 'Gasto en servicios exteriores bajo control.' : 'Servicios exteriores representan una parte relevante del coste.')}
        </div>
        ${narrativaRentabilidad(calc) ? narrativaBox('Diagnóstico de rentabilidad', narrativaRentabilidad(calc)) : ''}
      `}
  </div>
  ${footer(empresa, genDate, 8, TOTAL_PAGES)}
</div>`;

  // PÁGINA 9 — CASHFLOW
  const page9 = `<div class="page">
  <div class="content">
    ${pageHeader('09', 'Cashflow y generación de caja', empresa, ejercicio)}
    ${!calc.hasPyG
      ? limitNote('Cashflow no calculable con seguridad con la documentación aportada. Se requiere: PyG del ejercicio, balance comparativo, detalle de amortizaciones y movimientos bancarios.')
      : `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin-bottom:12px">
          ${sectionTitle('Cashflow contable estimado (método indirecto simplificado)')}
          <table style="width:100%;border-collapse:collapse">
            ${row('Resultado neto', fmtEUR(calc.resultado), calc.resultado >= 0 ? '#059669' : '#dc2626')}
            ${row('(+) Amortizaciones y deterioros (68x)', fmtEUR(calc.amortizacion))}
            ${row('Cashflow contable estimado', fmtEUR(calc.cashflowContable), '#1d4ed8', false, 'Resultado + Amortizaciones')}
          </table>
        </div>
        ${limitNote('El cashflow contable es una aproximación (resultado + amortizaciones). No refleja variaciones de working capital, capex, ni movimientos financieros. Para cashflow libre real se requiere balance comparativo, diario o mayor contable.')}
        ${sectionTitle('Información adicional necesaria para cashflow completo')}
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px">
          ${['Balance de situación comparativo (ejercicio anterior)', 'Detalle de amortizaciones y deterioros de valor', 'Movimientos bancarios del período', 'Detalle de inversiones (capex)', 'Variaciones de deuda financiera', 'Calendario de cobros y pagos previstos'].map(i => `<div style="display:flex;align-items:center;gap:6px;font-size:8.5pt;color:#64748b;padding:4px 0;border-bottom:1px solid #f1f5f9">○ ${i}</div>`).join('')}
        </div>
      `}
  </div>
  ${footer(empresa, genDate, 9, TOTAL_PAGES)}
</div>`;

  // PÁGINA 10 — M&A
  const page10 = `<div class="page">
  <div class="content">
    ${pageHeader('10', 'Análisis M&A y corporate finance', empresa, ejercicio)}
    <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:10px 14px;margin-bottom:12px">
      <p style="font-size:8pt;color:#78350f;margin:0"><strong>Lectura M&A preliminar.</strong> Sin valoración de empresa, sin múltiplos de transacción ni rango de precio. El análisis identifica los parámetros disponibles y señala qué información adicional requeriría un comprador o inversor para completar una due diligence financiera.</p>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px">
        ${sectionTitle('Parámetros M&A disponibles')}
        <table style="width:100%;border-collapse:collapse">
          ${row('EBITDA reportado', calc.hasPyG ? fmtEUR(calc.ebitda) : '—', '#1d4ed8', false, 'Dato calculado')}
          ${row('EBITDA ajustado', calc.ebitdaAjustado !== null ? fmtEUR(calc.ebitdaAjustado) : '—', '#1d4ed8', false, calc.ebitdaAjustado ? 'Incluye ajustes de usuario' : 'Sin ajustes identificados')}
          ${row('Deuda financiera bruta', fmtEUR(calc.deudaFinancieraTotal))}
          ${row('Caja y equivalentes', fmtEUR(calc.tesoreria))}
          ${row('Deuda financiera neta (DFN)', fmtEUR(calc.deudaFinancieraNeta), calc.deudaFinancieraNeta <= 0 ? '#059669' : '#d97706')}
          ${calc.deudaNetaEbitda !== null ? row('DFN / EBITDA', fmtX(calc.deudaNetaEbitda), '#0f172a', false, 'Ref: < 3x conservador') : ''}
          ${row('Calidad de ingresos', calc.calidad_ingresos?.replace(/_/g, ' ') || '—')}
          ${row('Posición CF/DF (Cash-free, Debt-free)', calc.posicionCFDF || '—')}
        </table>
      </div>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px">
        ${sectionTitle('Información pendiente para DD financiera')}
        ${['Serie histórica PyG — mínimo 3 ejercicios', 'Detalle y documentación de ajustes EBITDA', 'Working capital normalizado (promedio histórico)', 'Pasivos contingentes conocidos (litigios, avales)', 'Capex recurrente y de mantenimiento', 'Concentración de clientes (top 5 clientes)', 'Recurrencia de ingresos y contratos en vigor', 'Deuda-like items (compromisos off-balance)', 'Cash-like items (depósitos restringidos)'].map(i => `<div style="display:flex;align-items:flex-start;gap:6px;font-size:7.5pt;color:#64748b;padding:3px 0">⚠ ${i}</div>`).join('')}
      </div>
    </div>
    <div style="background:#0f172a;border-radius:8px;padding:12px 14px;margin-top:12px">
      <div style="font-size:8pt;font-weight:700;color:white;margin-bottom:4px">Observaciones principales M&A (Taxea IA)</div>
      <p style="font-size:8pt;color:#94a3b8;line-height:1.6;margin:0">${calc.hasPyG
        ? `La empresa presenta ingresos de ${fmtEUR(calc.ingresos)} y EBITDA de ${fmtEUR(calc.ebitda)} para el período analizado, con una posición cash-free debt-free estimada de ${calc.posicionCFDF}. Sin serie histórica no es posible evaluar crecimiento ni recurrencia. La calidad del EBITDA requiere contraste con los ajustes identificados. No se emite valoración ni rango de múltiplo sin información adicional.`
        : 'Sin cuenta de PyG, la lectura M&A está significativamente limitada. No es posible calcular EBITDA, márgenes ni DFN/EBITDA. Se recomienda aportar PyG antes de cualquier proceso de valoración o due diligence.'
      }</p>
    </div>
  </div>
  ${footer(empresa, genDate, 10, TOTAL_PAGES)}
</div>`;

  // PÁGINA 11 — CALIDAD CONTABLE
  const indicadores = [
    { label: 'Balance cuadra A = PN + P', ok: calc.balanceCuadra !== false, detalle: calc.balanceCuadra ? 'Activo = PN + Pasivo' : `Diferencia: ${fmtEUR(calc.diferencia)}` },
    { label: 'Sin saldos negativos atípicos en activo', ok: calc.saldosNegativos === 0, detalle: calc.saldosNegativos > 0 ? `${calc.saldosNegativos} cuentas de activo con saldo negativo` : 'Sin anomalías detectadas' },
    { label: 'Cuentas clasificadas correctamente', ok: calc.cuentasSinClasificar <= 3, detalle: calc.cuentasSinClasificar > 0 ? `${calc.cuentasSinClasificar} cuentas sin clasificar` : 'Todas clasificadas' },
    { label: 'PyG disponible para el ejercicio', ok: calc.hasPyG, detalle: calc.hasPyG ? 'Cuenta de PyG presente' : 'No aportada' },
    { label: 'Cuentas sin revisión pendiente', ok: calc.pendientesRevision <= 2, detalle: `${calc.pendientesRevision} cuentas marcadas para revisión` },
  ];

  const page11 = `<div class="page">
  <div class="content">
    ${pageHeader('11', 'Calidad contable', empresa, ejercicio)}
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:14px">
      <div style="width:64px;height:64px;border-radius:12px;background:${calc.calidadScore >= 80 ? '#d1fae5' : calc.calidadScore >= 60 ? '#fef3c7' : '#fee2e2'};display:flex;align-items:center;justify-content:center;flex-shrink:0">
        <span style="font-size:18pt;font-weight:700;color:${calc.calidadScore >= 80 ? '#059669' : calc.calidadScore >= 60 ? '#d97706' : '#dc2626'}">${calc.calidadScore}</span>
      </div>
      <div>
        <div style="font-size:11pt;font-weight:700;color:#0f172a">Calidad ${calc.calidadLabel}</div>
        <div style="font-size:8.5pt;color:#64748b">Puntuación interna basada en validaciones automáticas. No equivale a auditoría.</div>
      </div>
    </div>
    <table class="data-table">
      <tr><th>Indicador</th><th>Estado</th><th>Detalle</th></tr>
      ${indicadores.map(ind => `<tr>
        <td style="font-size:8.5pt;font-weight:500;color:#374151">${ind.label}</td>
        <td><span style="font-size:7.5pt;font-weight:700;padding:2px 8px;border-radius:10px;background:${ind.ok ? '#d1fae5' : '#fef3c7'};color:${ind.ok ? '#059669' : '#d97706'}">${ind.ok ? '✓ Correcto' : '⚠ Revisar'}</span></td>
        <td style="font-size:8pt;color:#64748b">${ind.detalle}</td>
      </tr>`).join('')}
    </table>
    ${limitNote('Esta calificación de calidad contable es automática y orientativa. No sustituye una revisión contable profesional ni una auditoría de cuentas. Se basa exclusivamente en las validaciones técnicas aplicadas sobre los datos extraídos.')}
    ${sectionTitle('Recomendaciones de calidad contable')}
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px">
      ${[
        calc.descuadre && `Conciliar el balance cuenta a cuenta para resolver la diferencia de ${fmtEUR(calc.diferencia)}.`,
        calc.saldosNegativos > 0 && `Revisar el mayor contable de ${calc.saldosNegativos} cuenta(s) de activo con saldo negativo atípico.`,
        calc.cuentasSinClasificar > 3 && `Clasificar manualmente ${calc.cuentasSinClasificar} cuentas sin asignación de masa patrimonial.`,
        !calc.hasPyG && 'Aportar PyG del ejercicio para completar el análisis de rentabilidad y cashflow.',
        calc.pendientesRevision > 2 && `Validar o corregir ${calc.pendientesRevision} cuentas en estado "pendiente de revisión".`,
        'Contrastar con libros contables, modelos fiscales y documentación soporte antes de usar el informe para toma de decisiones.',
      ].filter(Boolean).map(r => `<div style="display:flex;align-items:flex-start;gap:6px;font-size:8.5pt;color:#475569;padding:4px 0;border-bottom:1px solid #f1f5f9">→ ${r}</div>`).join('')}
    </div>
  </div>
  ${footer(empresa, genDate, 11, TOTAL_PAGES)}
</div>`;

  // PÁGINA 12 — FISCALIDAD
  const page12 = `<div class="page">
  <div class="content">
    ${pageHeader('12', 'Fiscalidad — Análisis preliminar', empresa, ejercicio)}
    <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:10px 14px;margin-bottom:12px">
      <p style="font-size:8pt;color:#78350f;margin:0"><strong>Análisis fiscal preliminar</strong> basado exclusivamente en las cuentas contables aportadas. No sustituye revisión de modelos tributarios, liquidaciones oficiales ni dictamen fiscal. Para conclusiones definitivas es necesario contrastar con modelos 303/390/420/425/200/111/115 y libros registro.</p>
    </div>
    ${cuentasFiscales.length > 0 ? `
      ${sectionTitle('Cuentas fiscales identificadas (grupo 47x)')}
      <table class="data-table">
        <tr><th>Código</th><th>Descripción</th><th style="text-align:right">Importe</th><th>Masa</th></tr>
        ${cuentasFiscales.map(c => `<tr>
          <td style="font-size:8.5pt;font-family:monospace;font-weight:700;color:#374151">${c.cuenta}</td>
          <td style="font-size:8.5pt;color:#475569">${c.descripcion}</td>
          <td style="font-size:8.5pt;font-weight:700;text-align:right;color:#0f172a">${fmtEUR(c.importe_actual, 2)}</td>
          <td style="font-size:7.5pt;color:#94a3b8">${c.masa || '—'}</td>
        </tr>`).join('')}
      </table>` : limitNote('No se han identificado cuentas fiscales (47x) en el documento aportado. Para análisis fiscal completo aportar modelos tributarios.')}
    ${sectionTitle('Aspectos a revisar en una revisión fiscal completa')}
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px">
      ${['IVA soportado y repercutido — coherencia con ventas y compras del período',
         'Retenciones pendientes de ingreso (cuentas 473, 4751)',
         'Impuesto sobre sociedades — coherencia con resultado contable (cuenta 630)',
         'Hacienda Pública acreedora — vencimientos y riesgo de sanción por mora',
         'Seguridad Social acreedora — coherencia con gasto de personal',
         'Bases imponibles y posibles gastos no deducibles',
         'Diferencias permanentes y temporarias entre resultado contable y fiscal',
         'Pagos fraccionados del IS (cuentas 202 / 473)'
      ].map(i => `<div style="display:flex;align-items:flex-start;gap:6px;font-size:8.5pt;color:#475569;padding:3px 0;border-bottom:1px solid #f1f5f9">○ ${i}</div>`).join('')}
    </div>
    ${aiContent?.analisis_fiscal ? narrativaBox('Análisis fiscal narrativo IA', aiContent.analisis_fiscal) : ''}
  </div>
  ${footer(empresa, genDate, 12, TOTAL_PAGES)}
</div>`;

  // PÁGINA 13 — ALERTAS
  const page13 = `<div class="page">
  <div class="content">
    ${pageHeader('13', 'Alertas críticas detectadas', empresa, ejercicio)}
    ${alertas.length === 0
      ? `<div style="text-align:center;padding:32px 0">
          <div style="font-size:24pt;margin-bottom:8px">✓</div>
          <div style="font-size:11pt;font-weight:700;color:#059669">Sin alertas relevantes detectadas</div>
          <div style="font-size:8.5pt;color:#64748b;margin-top:4px">Los indicadores analizados no han generado señales de alerta con los datos disponibles.</div>
        </div>`
      : alertas.map(a => alertBlock(a.nivel, a.titulo, a.desc, a.area, a.accion)).join('')}
  </div>
  ${footer(empresa, genDate, 13, TOTAL_PAGES)}
</div>`;

  // PÁGINA 14 — PLAN DE ACCIÓN Y CONCLUSIONES
  const bloquesPlan = [
    { label: 'Acción inmediata', key: 'inmediata', color: '#dc2626' },
    { label: 'Corto plazo (< 3 meses)', key: 'corto', color: '#d97706' },
    { label: 'Medio plazo (3–12 meses)', key: 'medio', color: '#2563eb' },
    { label: 'Información adicional necesaria', key: 'info', color: '#64748b' },
  ];

  const page14 = `<div class="page">
  <div class="content">
    ${pageHeader('14', 'Recomendaciones y plan de acción', empresa, ejercicio)}
    ${bloquesPlan.filter(b => recs[b.key]?.length > 0).map(b => `
      <div style="border:1px solid ${b.color}33;background:${b.color}0d;border-radius:8px;padding:12px 14px;margin-bottom:10px;break-inside:avoid">
        <span style="font-size:7.5pt;font-weight:700;background:${b.color};color:white;padding:2px 12px;border-radius:10px;display:inline-block;margin-bottom:8px;text-transform:uppercase">${b.label}</span>
        ${recs[b.key].map(i => `<div style="display:flex;align-items:flex-start;gap:6px;font-size:8.5pt;color:#334155;padding:3px 0">→ ${i}</div>`).join('')}
      </div>`).join('')}
    ${aiContent?.conclusion_final ? `<div style="background:#0f172a;border-radius:8px;padding:14px;margin-top:12px">
      <div style="font-size:8pt;font-weight:700;color:white;margin-bottom:4px">Conclusión profesional Taxea IA</div>
      <p style="font-size:8.5pt;color:#94a3b8;line-height:1.6;margin:0">${aiContent.conclusion_final}</p>
    </div>` : ''}
    <div style="margin-top:20px;padding-top:10px;border-top:1px solid #e2e8f0;font-size:7.5pt;color:#94a3b8;line-height:1.6;font-style:italic">
      El presente informe ha sido elaborado por Taxea Strategies con base en la documentación facilitada y tiene carácter preliminar. Las conclusiones deben contrastarse con la documentación soporte, modelos fiscales presentados y libros contables. No sustituye auditoría, certificación contable ni asesoramiento jurídico.
    </div>
  </div>
  ${footer(empresa, genDate, 14, TOTAL_PAGES)}
</div>`;

  return `<!DOCTYPE html><html lang="es"><head>
<meta charset="UTF-8">
<title>Informe Financiero Premium Taxea — ${empresa} — ${ejercicio}</title>
<style>${CSS}</style>
</head><body>
${page1}${page2}${page3}${page4}${page5}${page6}${page7}${page8}${page9}${page10}${page11}${page12}${page13}${page14}
</body></html>`;
}