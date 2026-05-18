/**
 * ReportPDFExport V5 — Exportación PDF fiel al diseño visible en pantalla
 * Genera HTML completo para impresión A4 con logo y branding Taxea
 */
import { fmtEUR, fmtPct, fmtX } from './ReportEngine';

const LOGO = 'https://media.base44.com/images/public/6a00fec50cc522a74ddde4b2/3ded74681_ChatGPTImage7may202610_56_53pm.png';
const today = () => new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });

const semColor = { verde: '#059669', ambar: '#d97706', rojo: '#dc2626', gris: '#94a3b8' };
const semBg = { verde: '#f0fdf4', ambar: '#fffbeb', rojo: '#fef2f2', gris: '#f8fafc' };
const semBorder = { verde: '#a7f3d0', ambar: '#fcd34d', rojo: '#fca5a5', gris: '#e2e8f0' };

const getSem = (estado) => ({ color: semColor[estado]||semColor.gris, bg: semBg[estado]||semBg.gris, border: semBorder[estado]||semBorder.gris });

function row(label, value, color = '#0f172a', indent = false) {
  return `<tr><td style="padding:5px 0;font-size:9pt;color:#64748b;${indent?'padding-left:16px;':''}">${label}</td><td style="padding:5px 0;font-size:9pt;font-weight:700;color:${color};text-align:right;">${value}</td></tr>`;
}

function ratioCard(nombre, formula, valor, estado, interpretacion) {
  const s = getSem(estado);
  return `<div style="border:1px solid ${s.border};background:${s.bg};border-radius:8px;padding:10px 12px;break-inside:avoid">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
      <span style="font-size:8.5pt;font-weight:700;color:#1e293b">${nombre}</span>
      <span style="width:10px;height:10px;border-radius:50%;background:${s.color};display:inline-block"></span>
    </div>
    <div style="font-size:16pt;font-weight:700;color:${s.color}">${valor || '—'}</div>
    <div style="font-size:7.5pt;color:#94a3b8;margin-top:2px">${formula}</div>
    ${interpretacion ? `<div style="font-size:7.5pt;color:#64748b;margin-top:4px;line-height:1.4">${interpretacion}</div>` : ''}
  </div>`;
}

function alertBlock(nivel, titulo, desc, area, accion) {
  const nivCfg = {
    critico: { bg: '#fef2f2', border: '#fca5a5', badge: '#dc2626' },
    alta:    { bg: '#fef2f2', border: '#fdba74', badge: '#ea580c' },
    media:   { bg: '#fffbeb', border: '#fcd34d', badge: '#d97706' },
    baja:    { bg: '#eff6ff', border: '#93c5fd', badge: '#2563eb' },
    informativo: { bg: '#f8fafc', border: '#e2e8f0', badge: '#64748b' },
  };
  const c = nivCfg[nivel] || nivCfg.informativo;
  return `<div style="border:1px solid ${c.border};background:${c.bg};border-radius:8px;padding:10px 14px;margin-bottom:8px;break-inside:avoid">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap">
      <span style="font-size:7pt;font-weight:700;background:${c.badge};color:white;padding:2px 8px;border-radius:10px;text-transform:uppercase">${nivel}</span>
      <span style="font-size:9pt;font-weight:700;color:#1e293b;flex:1">${titulo}</span>
      ${area ? `<span style="font-size:7pt;color:#94a3b8;border:1px solid #e2e8f0;padding:1px 6px;border-radius:4px">${area}</span>` : ''}
    </div>
    <p style="font-size:8.5pt;color:#475569;line-height:1.5;margin:0">${desc}</p>
    ${accion ? `<p style="font-size:7.5pt;color:#64748b;margin-top:4px;font-style:italic;margin-bottom:0">Acción: ${accion}</p>` : ''}
  </div>`;
}

const PAGE_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', Arial, sans-serif; color: #1e293b; background: white; font-size: 10pt; line-height: 1.5; }
  @page { margin: 16mm 14mm; size: A4; }
  @media print { 
    .page { page-break-after: always; min-height: auto !important; } 
    .page:last-child { page-break-after: auto; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } 
  }
  .page { min-height: 267mm; max-width: 182mm; margin: 0 auto 32px; padding: 0; }
  h2 { font-size: 14pt; font-weight: 700; color: #0f172a; margin: 0 0 4px; }
  .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 2px solid #f1f5f9; }
  .page-meta { font-size: 7.5pt; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; }
  .page-num { font-size: 8pt; font-family: monospace; color: #94a3b8; background: #f1f5f9; padding: 2px 8px; border-radius: 4px; }
  .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 12px 0; }
  .kpi { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; background: #f8fafc; }
  .kpi .val { font-size: 12pt; font-weight: 700; }
  .kpi .lbl { font-size: 7.5pt; color: #94a3b8; margin-top: 2px; }
  .sem-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin: 12px 0; }
  .ratio-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 12px 0; }
  .table-data { width: 100%; border-collapse: collapse; margin: 8px 0; }
  .table-data th { font-size: 8pt; font-weight: 600; color: #64748b; text-align: left; padding: 5px 4px; border-bottom: 1px solid #e2e8f0; background: #f8fafc; }
  .table-data td { font-size: 8.5pt; padding: 5px 4px; border-bottom: 1px solid #f8fafc; }
  .limit-note { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 8px 12px; font-size: 7.5pt; color: #1d4ed8; line-height: 1.5; margin: 8px 0; }
  .divider { border: none; border-top: 1px solid #f1f5f9; margin: 12px 0; }
  .section-title { font-size: 7.5pt; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin: 12px 0 6px; }
  .footer { margin-top: 20px; padding-top: 10px; border-top: 1px solid #e2e8f0; font-size: 7.5pt; color: #94a3b8; display: flex; justify-content: space-between; }
`;

export function buildPDFHTML(calc, alertas, recs, aiContent, imp) {
  const { empresa, ejercicio } = calc;
  const genDate = today();
  const pfx = (label, value, c = '#0f172a', indent = false) => row(label, value, c, indent);

  const semaforos = [
    { label: 'Liquidez', estado: calc.ratioLiquidez === null ? 'gris' : calc.ratioLiquidez >= 1.2 ? 'verde' : calc.ratioLiquidez >= 1 ? 'ambar' : 'rojo', desc: calc.ratioLiquidez !== null ? `RC: ${fmtX(calc.ratioLiquidez)} · FM: ${fmtEUR(calc.fondoManiobra)}` : 'Sin datos suficientes' },
    { label: 'Solvencia', estado: calc.autonomia === null ? 'gris' : calc.autonomia >= 0.35 ? 'verde' : calc.autonomia >= 0.2 ? 'ambar' : 'rojo', desc: calc.autonomia !== null ? `Autonomía: ${fmtPct(calc.autonomia * 100)} · Endeud.: ${fmtX(calc.endeudamiento)}` : 'Sin datos suficientes' },
    { label: 'Rentabilidad', estado: !calc.hasPyG ? 'gris' : calc.resultado > 0 ? 'verde' : 'rojo', desc: calc.hasPyG ? `Resultado: ${fmtEUR(calc.resultado)} · Margen: ${fmtPct((calc.margenNeto||0)*100)}` : 'Sin PyG' },
    { label: 'Cashflow', estado: !calc.hasPyG ? 'gris' : calc.cashflowContable > 0 ? 'verde' : 'rojo', desc: calc.hasPyG ? `CF contable est.: ${fmtEUR(calc.cashflowContable)}` : 'Sin PyG' },
    { label: 'Fiscalidad', estado: 'ambar', desc: 'Análisis preliminar. Contrastar con modelos.' },
    { label: 'Calidad contable', estado: calc.calidadScore >= 80 ? 'verde' : calc.calidadScore >= 60 ? 'ambar' : 'rojo', desc: `${calc.calidadLabel} · Score: ${calc.calidadScore}/100` },
    { label: 'Riesgo mercantil', estado: calc.patrimonioNeto < 0 ? 'rojo' : calc.patrimonioNeto < calc.totalActivo * 0.1 ? 'ambar' : 'verde', desc: `PN: ${fmtEUR(calc.patrimonioNeto)}` },
    { label: 'M&A', estado: !calc.hasPyG ? 'gris' : calc.deudaNetaEbitda === null ? 'ambar' : calc.deudaNetaEbitda < 3 ? 'verde' : calc.deudaNetaEbitda < 5 ? 'ambar' : 'rojo', desc: calc.hasPyG ? `EBITDA: ${fmtEUR(calc.ebitda)} · DFN/EBITDA: ${calc.deudaNetaEbitda !== null ? fmtX(calc.deudaNetaEbitda) : 'N/D'}` : 'Sin PyG' },
  ];

  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>Informe Financiero Premium Taxea — ${empresa} — ${ejercicio}</title>
<style>${PAGE_CSS}</style>
</head><body>

<!-- PORTADA -->
<div class="page">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;padding-top:8px">
    <img src="${LOGO}" alt="Taxea Strategies" style="height:56px;object-fit:contain"/>
    <div style="text-align:right;font-size:7.5pt;color:#94a3b8;text-transform:uppercase;letter-spacing:1px">Análisis Financiero Premium V5<br/>Confidencial</div>
  </div>
  <div style="padding:48px 0 32px;border-left:4px solid #0f172a;padding-left:20px;margin-top:32px">
    <div style="font-size:24pt;font-weight:700;color:#0f172a;line-height:1.2">Informe Financiero<br/>Premium</div>
    <div style="font-size:11pt;color:#64748b;margin-top:4px">Análisis Integral de Estados Financieros</div>
  </div>
  <table style="width:100%;border-collapse:collapse;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-top:16px">
    ${[['Sociedad analizada', empresa], ['Período', `${imp?.periodo_inicio||'—'} — ${imp?.periodo_fin||'—'}`], ['Fuente', `${imp?.origen||'—'} · ${imp?.nombre_archivo||'—'}`], ['Fecha generación', genDate], ['Nivel revisión', 'Preliminar — pendiente validación definitiva'], ['Confianza extracción', calc.confianza ? `${calc.confianza}%` : 'N/D'], ['Motor análisis', 'Taxea IA V5 · Corporate Finance Grade']].map(([k,v]) => `<tr><td style="padding:5px 8px;font-size:9pt;color:#64748b;width:160px">${k}</td><td style="padding:5px 8px;font-size:9pt;font-weight:600;color:#0f172a">${v}</td></tr>`).join('')}
  </table>
  <div style="background:#0f172a;color:#94a3b8;font-size:7.5pt;padding:10px 14px;border-radius:6px;margin-top:20px;line-height:1.6"><strong style="color:white">Aviso de alcance:</strong> Informe preliminar. No constituye auditoría ni certificación contable. Taxea Strategies.</div>
  <div class="footer"><span>© ${new Date().getFullYear()} Taxea Strategies</span><span>Informe Financiero Premium V5</span></div>
</div>

<!-- RESUMEN EJECUTIVO -->
<div class="page">
  <div class="page-header">
    <div><div class="page-meta">Taxea Strategies · Informe Financiero Premium V5</div><h2>Resumen ejecutivo</h2><div style="font-size:9pt;color:#64748b">${empresa} · Ejercicio ${ejercicio}</div></div>
    <span class="page-num">02</span>
  </div>
  <div class="kpi-grid">
    ${[['Total Activo', fmtEUR(calc.totalActivo), '#1d4ed8'], ['Patrimonio Neto', fmtEUR(calc.patrimonioNeto), calc.patrimonioNeto >= 0 ? '#059669' : '#dc2626'], ['Fondo de Maniobra', fmtEUR(calc.fondoManiobra), calc.fondoManiobra >= 0 ? '#059669' : '#dc2626'], ['Ingresos', calc.hasPyG ? fmtEUR(calc.ingresos) : '—', '#059669'], ['Resultado', calc.hasPyG ? fmtEUR(calc.resultado) : '—', calc.resultado >= 0 ? '#059669' : '#dc2626'], ['EBITDA', calc.hasPyG ? fmtEUR(calc.ebitda) : '—', '#1d4ed8'], ['Tesorería', fmtEUR(calc.tesoreria), '#0f172a'], ['DFN', fmtEUR(calc.deudaFinancieraNeta), calc.deudaFinancieraNeta <= 0 ? '#059669' : '#d97706'], ['Runway', calc.runwayBruto ? `${calc.runwayBruto.toFixed(1)} m.` : '—', calc.runwayBruto && calc.runwayBruto < 6 ? '#dc2626' : '#0f172a']].map(([l,v,c]) => `<div class="kpi"><div class="val" style="color:${c}">${v}</div><div class="lbl">${l}</div></div>`).join('')}
  </div>
  ${aiContent?.diagnostico_ejecutivo ? `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 14px;margin:12px 0"><div class="section-title">Diagnóstico ejecutivo</div><p style="font-size:8.5pt;color:#334155;line-height:1.6">${aiContent.diagnostico_ejecutivo}</p></div>` : ''}
  <div class="section-title">Semáforo financiero Taxea Strategies — 8 áreas</div>
  <div class="sem-grid">${semaforos.map(s => { const c = getSem(s.estado); return `<div style="border:1px solid ${c.border};background:${c.bg};border-radius:8px;padding:10px 12px"><div style="display:flex;align-items:center;gap:6px;margin-bottom:4px"><span style="width:8px;height:8px;border-radius:50%;background:${c.color};display:inline-block;flex-shrink:0"></span><span style="font-size:8.5pt;font-weight:700;color:#1e293b">${s.label}</span><span style="margin-left:auto;font-size:7.5pt;font-weight:700;color:${c.color}">${s.estado==='verde'?'FAVORABLE':s.estado==='ambar'?'REVISAR':s.estado==='rojo'?'ALERTA':'SIN DATOS'}</span></div><p style="font-size:7.5pt;color:#64748b;line-height:1.4;margin:0">${s.desc}</p></div>`; }).join('')}</div>
  <div class="footer"><span>Taxea Strategies · ${empresa} · ${ejercicio}</span><span>Generado ${genDate}</span></div>
</div>

<!-- BALANCE -->
<div class="page">
  <div class="page-header"><div><div class="page-meta">Taxea Strategies · Informe Financiero Premium V5</div><h2>Balance de situación reconstruido</h2></div><span class="page-num">03</span></div>
  ${!calc.hasBalance ? '<div class="limit-note">Balance no disponible en la documentación aportada.</div>' : `
  ${!calc.balanceCuadra ? `<div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:8px 12px;margin-bottom:12px;font-size:8.5pt;color:#dc2626;font-weight:600">⚠ Descuadre: diferencia de ${fmtEUR(calc.diferencia)} entre activo y PN+Pasivo.</div>` : ''}
  <table class="table-data">
    <tr><th>Masa patrimonial</th><th style="text-align:right">Importe</th><th style="text-align:right">% Activo</th></tr>
    ${pfx('ACTIVO NO CORRIENTE', fmtEUR(calc.activoNoCorriente), '#1d4ed8')}
    ${pfx('ACTIVO CORRIENTE', fmtEUR(calc.activoCorriente), '#1d4ed8')}
    <tr><td colspan="3" style="border-top:1px solid #e2e8f0"></td></tr>
    ${pfx('PATRIMONIO NETO', fmtEUR(calc.patrimonioNeto), calc.patrimonioNeto >= 0 ? '#059669' : '#dc2626')}
    ${pfx('PASIVO NO CORRIENTE', fmtEUR(calc.pasivoNoCorriente))}
    ${pfx('PASIVO CORRIENTE', fmtEUR(calc.pasivoCorriente))}
    <tr><td colspan="3" style="border-top:2px solid #e2e8f0"></td></tr>
    <tr><td style="padding:5px 0;font-size:9.5pt;font-weight:700">TOTAL ACTIVO</td><td style="padding:5px 0;text-align:right;font-size:9.5pt;font-weight:700">${fmtEUR(calc.totalActivo)}</td><td style="padding:5px 0;text-align:right;font-size:9pt">100%</td></tr>
    <tr><td style="padding:5px 0;font-size:9pt">Fondo de maniobra</td><td style="padding:5px 0;text-align:right;font-size:9pt;font-weight:700;color:${calc.fondoManiobra>=0?'#059669':'#dc2626'}">${fmtEUR(calc.fondoManiobra)}</td><td></td></tr>
  </table>
  ${aiContent?.analisis_balance ? `
    <div class="section-title">Análisis narrativo del balance</div>
    ${Object.entries({Activo_no_corriente: aiContent.analisis_balance.activo_no_corriente, Activo_corriente: aiContent.analisis_balance.activo_corriente, Patrimonio_neto: aiContent.analisis_balance.patrimonio_neto, Pasivo_no_corriente: aiContent.analisis_balance.pasivo_no_corriente, Pasivo_corriente: aiContent.analisis_balance.pasivo_corriente}).map(([k,v]) => v ? `<div style="margin-bottom:8px"><p style="font-size:7.5pt;font-weight:700;color:#64748b">${k.replace(/_/g,' ')}</p><p style="font-size:8.5pt;color:#334155;line-height:1.5">${v}</p></div>` : '').join('')}` : ''}
  `}
  <div class="footer"><span>Taxea Strategies · ${empresa}</span><span>${genDate}</span></div>
</div>

<!-- PyG -->
<div class="page">
  <div class="page-header"><div><div class="page-meta">Taxea Strategies · Informe Financiero Premium V5</div><h2>Cuenta de pérdidas y ganancias</h2></div><span class="page-num">04</span></div>
  ${!calc.hasPyG ? '<div class="limit-note">Cuenta de PyG no disponible. Ratios de rentabilidad y cashflow no calculables con seguridad.</div>' : `
  <table class="table-data">
    ${pfx('Ingresos — Cifra de negocios (Grupo 7)', fmtEUR(calc.ingresos), '#059669')}
    ${pfx('Gastos de explotación', fmtEUR(calc.gastos))}
    ${calc.personalGasto > 0 ? pfx('  Personal (64x)', `${fmtEUR(calc.personalGasto)} — ${fmtPct(calc.personalGasto/calc.ingresos*100)} s/ing`, '#64748b', true) : ''}
    ${calc.serviciosGasto > 0 ? pfx('  Servicios exteriores (62x)', `${fmtEUR(calc.serviciosGasto)} — ${fmtPct(calc.serviciosGasto/calc.ingresos*100)} s/ing`, '#64748b', true) : ''}
    ${calc.amortizacion > 0 ? pfx('  Amortizaciones (68x)', fmtEUR(calc.amortizacion), '#64748b', true) : ''}
    <tr><td colspan="2" style="border-top:2px solid #e2e8f0"></td></tr>
    ${pfx('Resultado del ejercicio', fmtEUR(calc.resultado), calc.resultado>=0?'#059669':'#dc2626')}
    ${pfx('EBITDA estimado', fmtEUR(calc.ebitda), '#1d4ed8')}
    ${pfx('Margen neto', fmtPct((calc.margenNeto||0)*100), calc.resultado>=0?'#059669':'#dc2626')}
    ${pfx('Margen EBITDA', fmtPct((calc.margenEBITDA||0)*100))}
  </table>
  ${aiContent?.analisis_pyg ? `<div class="section-title">Análisis narrativo PyG</div>${Object.entries({Ingresos: aiContent.analisis_pyg.ingresos, Gastos: aiContent.analisis_pyg.gastos, Resultado: aiContent.analisis_pyg.resultado}).map(([k,v]) => v ? `<p style="font-size:7.5pt;font-weight:700;color:#64748b;margin-top:8px">${k}</p><p style="font-size:8.5pt;color:#334155;line-height:1.5">${v}</p>` : '').join('')}` : ''}
  `}
  <div class="footer"><span>Taxea Strategies · ${empresa}</span><span>${genDate}</span></div>
</div>

<!-- RATIOS LIQUIDEZ + ENDEUDAMIENTO + RENTABILIDAD -->
<div class="page">
  <div class="page-header"><div><div class="page-meta">Taxea Strategies · Informe Financiero Premium V5</div><h2>Ratios financieros automáticos</h2></div><span class="page-num">05</span></div>
  <div class="section-title">Liquidez y circulante</div>
  <div class="ratio-grid">
    ${ratioCard('Liquidez corriente', 'Activo C / Pasivo C', fmtX(calc.ratioLiquidez), calc.ratioLiquidez===null?'gris':calc.ratioLiquidez>=1.5?'verde':calc.ratioLiquidez>=1?'ambar':'rojo', 'Ref ≥ 1,5. Cubre obligaciones CP.')}
    ${ratioCard('Prueba ácida', '(Activo C−Exist.) / Pasivo C', fmtX(calc.pruebaAcida), calc.pruebaAcida===null?'gris':calc.pruebaAcida>=1?'verde':calc.pruebaAcida>=0.7?'ambar':'rojo', 'Ref ≥ 1,0.')}
    ${ratioCard('Liquidez inmediata', 'Tesorería / Pasivo C', fmtX(calc.liquidezInmediata), calc.liquidezInmediata===null?'gris':calc.liquidezInmediata>=0.3?'verde':calc.liquidezInmediata>=0.15?'ambar':'rojo', 'Ref ≥ 0,2.')}
  </div>
  <div class="section-title">Endeudamiento y solvencia</div>
  <div class="ratio-grid">
    ${ratioCard('Autonomía financiera', 'PN / Total Activo', fmtPct((calc.autonomia||0)*100), calc.autonomia===null?'gris':calc.autonomia>=0.35?'verde':calc.autonomia>=0.2?'ambar':'rojo', 'Ref ≥ 35%.')}
    ${ratioCard('Endeudamiento total', 'Pasivo / PN', fmtX(calc.endeudamiento), calc.endeudamiento===null?'gris':calc.endeudamiento<1.5?'verde':calc.endeudamiento<2.5?'ambar':'rojo', 'Ref < 2,0x.')}
    ${ratioCard('DFN / EBITDA', 'DFN / EBITDA', calc.deudaNetaEbitda!==null?fmtX(calc.deudaNetaEbitda):'N/D', calc.deudaNetaEbitda===null?'gris':calc.deudaNetaEbitda<3?'verde':calc.deudaNetaEbitda<5?'ambar':'rojo', 'Ref < 3x conservador, < 5x transaccional.')}
  </div>
  <div class="section-title">Rentabilidad</div>
  <div class="ratio-grid">
    ${ratioCard('Margen neto', 'Resultado / Ingresos', fmtPct((calc.margenNeto||0)*100), !calc.hasPyG?'gris':calc.resultado>0?'verde':'rojo', 'Ref > 0%.')}
    ${ratioCard('Margen EBITDA', 'EBITDA / Ingresos', fmtPct((calc.margenEBITDA||0)*100), !calc.hasPyG?'gris':calc.ebitda>0?'verde':'rojo', 'Ref > 10%.')}
    ${ratioCard('ROE', 'Resultado / PN', fmtPct((calc.roe||0)*100), calc.roe===null?'gris':calc.roe>0.1?'verde':calc.roe>0?'ambar':'rojo', 'Ref > 10%.')}
  </div>
  <div class="footer"><span>Taxea Strategies · ${empresa}</span><span>${genDate}</span></div>
</div>

<!-- ALERTAS -->
<div class="page">
  <div class="page-header"><div><div class="page-meta">Taxea Strategies · Informe Financiero Premium V5</div><h2>Alertas detectadas</h2></div><span class="page-num">06</span></div>
  ${alertas.length === 0 ? '<p style="font-size:9pt;color:#64748b">Sin alertas relevantes detectadas.</p>' : alertas.map(a => alertBlock(a.nivel, a.titulo, a.desc, a.area, a.accion)).join('')}
  <div class="footer"><span>Taxea Strategies · ${empresa}</span><span>${genDate}</span></div>
</div>

<!-- PLAN DE ACCIÓN -->
<div class="page">
  <div class="page-header"><div><div class="page-meta">Taxea Strategies · Informe Financiero Premium V5</div><h2>Recomendaciones y plan de acción</h2></div><span class="page-num">07</span></div>
  ${[['Acción inmediata', 'inmediata', '#dc2626'], ['Corto plazo (< 3 meses)', 'corto', '#d97706'], ['Medio plazo (3-12 meses)', 'medio', '#2563eb'], ['Información adicional necesaria', 'info', '#64748b']].filter(([,k]) => recs[k]?.length > 0).map(([l, k, c]) => `
    <div style="border:1px solid ${c}33;background:${c}0a;border-radius:8px;padding:12px 14px;margin-bottom:10px;break-inside:avoid">
      <span style="font-size:7.5pt;font-weight:700;background:${c};color:white;padding:2px 10px;border-radius:10px;display:inline-block;margin-bottom:8px;text-transform:uppercase">${l}</span>
      <ul style="list-style:none">
        ${recs[k].map(i => `<li style="font-size:8.5pt;color:#334155;padding:2px 0;display:flex;gap:6px"><span style="color:#94a3b8">→</span>${i}</li>`).join('')}
      </ul>
    </div>`).join('')}
  ${aiContent?.conclusion_final ? `<div style="background:#0f172a;color:#94a3b8;border-radius:8px;padding:14px;margin-top:12px"><p style="font-size:7.5pt;font-weight:700;color:white;margin-bottom:4px">Conclusión Taxea IA</p><p style="font-size:8.5pt;line-height:1.6">${aiContent.conclusion_final}</p></div>` : ''}
  <div style="margin-top:20px;padding-top:10px;border-top:1px solid #e2e8f0;font-size:7.5pt;color:#94a3b8;line-height:1.6;font-style:italic">El presente informe ha sido elaborado por Taxea Strategies con base en la documentación facilitada y tiene carácter preliminar. No constituye auditoría ni certificación contable. Las conclusiones deben contrastarse con documentación soporte y modelos fiscales.</div>
  <div class="footer"><span>Taxea Strategies · © ${new Date().getFullYear()}</span><span>${genDate}</span></div>
</div>

</body></html>`;
}