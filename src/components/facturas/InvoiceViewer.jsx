import { useRef } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, Download, Printer, FileText } from 'lucide-react';

function fmt(n) {
  return (parseFloat(n) || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function initials(name) {
  if (!name) return '?';
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

function InvoiceTemplate({ invoice, company }) {
  const taxType = company?.tipo_impuesto === 'igic' ? 'IGIC' : 'IVA';
  const hasRetention = (parseFloat(invoice.retencion_irpf) || 0) > 0;
  const retencionImporte = (parseFloat(invoice.base_imponible) || 0) * (parseFloat(invoice.retencion_irpf) || 0) / 100;

  return (
    <div id="invoice-print-area" className="bg-white text-gray-900 font-sans" style={{ fontFamily: 'Inter, sans-serif', minHeight: '297mm', padding: '40px 48px' }}>
      {/* CABECERA */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 40 }}>
        {/* Emisor */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          {company?.logo_url ? (
            <img src={company.logo_url} alt="Logo" style={{ height: 56, maxWidth: 140, objectFit: 'contain' }} />
          ) : (
            <div style={{
              width: 56, height: 56, borderRadius: 12,
              backgroundColor: '#8B1A2C', color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, fontWeight: 700, flexShrink: 0,
            }}>
              {initials(company?.nombre_comercial || company?.razon_social)}
            </div>
          )}
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#111', lineHeight: 1.2 }}>
              {company?.nombre_comercial || company?.razon_social || '—'}
            </div>
            {company?.nombre_comercial && company?.razon_social && (
              <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>{company.razon_social}</div>
            )}
            <div style={{ fontSize: 12, color: '#555', marginTop: 4, lineHeight: 1.6 }}>
              {company?.nif_cif && <div>NIF/CIF: {company.nif_cif}</div>}
              {company?.direccion_fiscal && <div>{company.direccion_fiscal}</div>}
              {company?.email && <div>{company.email}</div>}
              {company?.telefono && <div>{company.telefono}</div>}
            </div>
          </div>
        </div>

        {/* FACTURA + número + fecha */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#8B1A2C', letterSpacing: '-0.5px' }}>FACTURA</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#111', marginTop: 4 }}>{invoice.numero_factura}</div>
          <div style={{ fontSize: 12, color: '#555', marginTop: 8, lineHeight: 1.8 }}>
            <div>Fecha: <strong>{invoice.fecha_emision}</strong></div>
            {invoice.fecha_vencimiento && <div>Vencimiento: <strong>{invoice.fecha_vencimiento}</strong></div>}
          </div>
        </div>
      </div>

      {/* Línea divisoria */}
      <div style={{ borderTop: '2px solid #8B1A2C', marginBottom: 32 }} />

      {/* BLOQUES EMISOR / RECEPTOR */}
      <div style={{ display: 'flex', gap: 40, marginBottom: 32 }}>
        {/* Datos bancarios emisor */}
        {company?.datos_bancarios && (
          <div style={{ flex: 1, backgroundColor: '#fafafa', borderRadius: 8, padding: '14px 16px', border: '1px solid #eee' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#8B1A2C', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Datos bancarios</div>
            <div style={{ fontSize: 12, color: '#444', lineHeight: 1.6, whiteSpace: 'pre-line' }}>{company.datos_bancarios}</div>
          </div>
        )}

        {/* Facturar a */}
        <div style={{ flex: 1, backgroundColor: '#fafafa', borderRadius: 8, padding: '14px 16px', border: '1px solid #eee' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#8B1A2C', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Facturar a</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>{invoice.cliente_nombre || '—'}</div>
          {invoice.cliente_nif && <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>NIF/CIF: {invoice.cliente_nif}</div>}
        </div>
      </div>

      {/* TABLA CONCEPTO */}
      <div style={{ marginBottom: 32 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ backgroundColor: '#8B1A2C', color: 'white' }}>
              <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, borderRadius: '6px 0 0 6px' }}>Descripción</th>
              <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600 }}>Base imponible</th>
              <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600 }}>{taxType} %</th>
              <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600 }}>Cuota {taxType}</th>
              {hasRetention && <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600 }}>Retención</th>}
              <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, borderRadius: '0 6px 6px 0' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ backgroundColor: '#f9f9f9' }}>
              <td style={{ padding: '12px 14px', color: '#333', borderBottom: '1px solid #eee' }}>{invoice.concepto || 'Servicios profesionales'}</td>
              <td style={{ padding: '12px 14px', textAlign: 'right', borderBottom: '1px solid #eee' }}>{fmt(invoice.base_imponible)} €</td>
              <td style={{ padding: '12px 14px', textAlign: 'right', borderBottom: '1px solid #eee' }}>{invoice.tipo_iva ?? '—'} %</td>
              <td style={{ padding: '12px 14px', textAlign: 'right', borderBottom: '1px solid #eee' }}>{fmt(invoice.cuota_iva)} €</td>
              {hasRetention && <td style={{ padding: '12px 14px', textAlign: 'right', color: '#c00', borderBottom: '1px solid #eee' }}>-{fmt(retencionImporte)} €</td>}
              <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, borderBottom: '1px solid #eee' }}>{fmt(invoice.total_factura)} €</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* RESUMEN TOTALES */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 32 }}>
        <div style={{ minWidth: 280 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, borderBottom: '1px solid #eee' }}>
            <span style={{ color: '#555' }}>Base imponible</span>
            <span>{fmt(invoice.base_imponible)} €</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, borderBottom: hasRetention ? '1px solid #eee' : '2px solid #8B1A2C' }}>
            <span style={{ color: '#555' }}>{taxType} {invoice.tipo_iva} %</span>
            <span>+ {fmt(invoice.cuota_iva)} €</span>
          </div>
          {hasRetention && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, borderBottom: '2px solid #8B1A2C', color: '#c00' }}>
              <span>Retención IRPF {invoice.retencion_irpf} %</span>
              <span>- {fmt(retencionImporte)} €</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', fontSize: 17, fontWeight: 800, color: '#8B1A2C' }}>
            <span>TOTAL FACTURA</span>
            <span>{fmt(invoice.total_factura)} €</span>
          </div>
        </div>
      </div>

      {/* NOTAS / COMENTARIOS */}
      {invoice.comentarios && (
        <div style={{ backgroundColor: '#fafafa', borderRadius: 8, padding: '14px 16px', border: '1px solid #eee', marginBottom: 24 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#8B1A2C', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Notas</div>
          <div style={{ fontSize: 12, color: '#555', lineHeight: 1.6 }}>{invoice.comentarios}</div>
        </div>
      )}

      {/* PIE */}
      <div style={{ borderTop: '1px solid #eee', paddingTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 10, color: '#aaa' }}>Factura generada mediante Taxea Portal</div>
        <div style={{ fontSize: 10, color: '#aaa' }}>{new Date().toLocaleDateString('es-ES')}</div>
      </div>
    </div>
  );
}

export default function InvoiceViewer({ open, onOpenChange, invoice, company }) {
  const printRef = useRef();

  if (!invoice) return null;

  const isGenerated = !invoice.archivo_url || invoice.tipo === 'emitida';
  const isPdf = invoice.archivo_url?.toLowerCase().endsWith('.pdf');
  const isImage = invoice.archivo_url && /\.(jpg|jpeg|png|webp)$/i.test(invoice.archivo_url);

  const handlePrint = () => window.print();

  const handleDownload = () => {
    // Simple print-to-PDF via browser
    const content = document.getElementById('invoice-print-area');
    if (!content) return;
    const w = window.open('', '_blank');
    w.document.write(`
      <html><head><title>Factura ${invoice.numero_factura}</title>
      <style>body{margin:0;font-family:Inter,sans-serif;}</style>
      </head><body>${content.outerHTML}</body></html>
    `);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); w.close(); }, 500);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto p-0">
        {/* Toolbar */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-3 bg-card border-b border-border">
          <div>
            <span className="font-jakarta font-semibold text-foreground text-sm">
              Factura {invoice.numero_factura}
            </span>
            {invoice.cliente_nombre && (
              <span className="text-muted-foreground text-sm ml-2">· {invoice.cliente_nombre}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleDownload} className="h-8 gap-1.5">
              <Download className="w-3.5 h-3.5" /> Descargar PDF
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onOpenChange(false)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4" ref={printRef}>
          {/* Si tiene archivo adjunto */}
          {invoice.archivo_url && isPdf && (
            <iframe src={invoice.archivo_url} className="w-full rounded-lg border" style={{ height: '75vh' }} title="Factura PDF" />
          )}
          {invoice.archivo_url && isImage && (
            <img src={invoice.archivo_url} alt="Factura" className="max-w-full mx-auto rounded-lg border shadow" />
          )}
          {invoice.archivo_url && !isPdf && !isImage && (
            <div className="text-center py-16 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p>No se puede previsualizar este archivo.</p>
              <Button variant="outline" size="sm" className="mt-3" asChild>
                <a href={invoice.archivo_url} target="_blank" rel="noreferrer">Descargar para revisar</a>
              </Button>
            </div>
          )}

          {/* Plantilla generada si es emitida sin archivo o se quiere ver la plantilla */}
          {(!invoice.archivo_url || invoice.tipo === 'emitida') && (
            <div className="rounded-xl border border-border shadow-card overflow-hidden">
              <InvoiceTemplate invoice={invoice} company={company} />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}