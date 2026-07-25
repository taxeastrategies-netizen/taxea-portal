import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Convierte Markdown a HTML básico para exportación.
 */
function markdownToHtml(md) {
  if (!md) return '';
  let html = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Tablas
  html = html.replace(/^\|(.+)\|\n\|([-: |]+)\|\n((?:\|.+\|\n?)*)/gm, (match, header, sep, body) => {
    const headers = header.split('|').map(h => h.trim()).filter(Boolean);
    const rows = body.trim().split('\n').map(r => r.split('|').map(c => c.trim()).filter(Boolean));
    let table = '<table style="width:100%;border-collapse:collapse;font-size:11px;margin:8px 0;">';
    table += '<tr>' + headers.map(h => `<th style="border:1px solid #999;padding:4px 6px;background:#f3f4f6;font-weight:600;">${h}</th>`).join('') + '</tr>';
    rows.forEach(row => {
      table += '<tr>' + row.map(c => `<td style="border:1px solid #ccc;padding:4px 6px;">${c}</td>`).join('') + '</tr>';
    });
    table += '</table>';
    return table;
  });

  html = html
    .replace(/^### (.+)$/gm, '<h3 style="font-size:14px;font-weight:600;margin:12px 0 4px;">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="font-size:16px;font-weight:700;margin:14px 0 6px;">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 style="font-size:18px;font-weight:700;margin:16px 0 8px;">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li style="margin-left:16px;">$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li style="margin-left:20px;list-style:decimal;">$1</li>')
    .replace(/`(.*?)`/g, '<code style="background:#f3f4f6;padding:1px 3px;border-radius:2px;font-family:monospace;font-size:10px;">$1</code>')
    .replace(/\n\n/g, '</p><p style="margin:4px 0;font-size:11px;line-height:1.5;">')
    .replace(/\n/g, '<br/>');

  return `<div style="font-family:Inter,sans-serif;color:#1a1a1a;"><p style="margin:4px 0;font-size:11px;line-height:1.5;">${html}</p></div>`;
}

/**
 * Exporta un informe de auditoría a PDF.
 */
export async function exportReportToPDF(report) {
  const container = document.createElement('div');
  container.style.cssText = 'position:absolute;left:-9999px;top:0;width:750px;padding:24px;background:#fff;';
  container.innerHTML = `
    <div style="border-bottom:2px solid #b81e2a;padding-bottom:8px;margin-bottom:16px;">
      <h1 style="font-size:20px;font-weight:700;color:#b81e2a;margin:0;">TAXEA Audit</h1>
      <p style="font-size:11px;color:#666;margin:2px 0 0;">${report.title} · v${report.version}</p>
    </div>
    ${markdownToHtml(report.markdownContent)}
    <div style="margin-top:24px;border-top:1px solid #ddd;padding-top:8px;">
      <p style="font-size:9px;color:#999;">Documento de trabajo interno. Borrador pendiente de revisión profesional. No sustituye asesoramiento fiscal, contable ni jurídico.</p>
    </div>
  `;
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, { scale: 2, useCORS: true, backgroundColor: '#fff' });
    const imgWidth = 210; // A4 width mm
    const pageHeight = 297;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;

    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgData = canvas.toDataURL('image/png');

    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(`${report.title}_v${report.version}.pdf`);
  } finally {
    document.body.removeChild(container);
  }
}

/**
 * Exporta un informe de auditoría a DOCX (formato HTML compatible con Word).
 */
export function exportReportToDOCX(report) {
  const html = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head><meta charset='utf-8'><title>${report.title}</title>
    <style>
      body { font-family: 'Calibri', sans-serif; font-size: 11pt; color: #1a1a1a; }
      h1 { color: #b81e2a; font-size: 16pt; }
      h2 { font-size: 14pt; } h3 { font-size: 12pt; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid #999; padding: 4px 8px; font-size: 10pt; }
      th { background: #f3f4f6; font-weight: bold; }
      .footer { margin-top: 20px; font-size: 8pt; color: #999; border-top: 1px solid #ddd; padding-top: 8px; }
    </style></head>
    <body>
    <h1>TAXEA Audit</h1>
    <p style="font-size:10pt;color:#666;">${report.title} · Versión ${report.version} · Generado por ${report.generatedBy || 'sistema'}</p>
    <hr/>
    ${markdownToHtml(report.markdownContent)}
    <div class="footer"><p>Documento de trabajo interno. Borrador pendiente de revisión profesional. No sustituye asesoramiento fiscal, contable ni jurídico.</p></div>
    </body></html>
  `;

  const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${report.title}_v${report.version}.doc`;
  a.click();
  URL.revokeObjectURL(url);
}