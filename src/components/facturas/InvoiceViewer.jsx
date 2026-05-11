import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, Download, Printer, FileText } from 'lucide-react';
import InvoiceTemplate from './InvoiceTemplate';

export default function InvoiceViewer({ open, onOpenChange, invoice, company }) {
  if (!invoice) return null;

  const isPdf = invoice.archivo_url?.toLowerCase().endsWith('.pdf');
  const isImage = invoice.archivo_url && /\.(jpg|jpeg|png|webp)$/i.test(invoice.archivo_url);
  const showTemplate = invoice.tipo === 'emitida' || !invoice.archivo_url;

  const handleDownload = () => {
    const content = document.getElementById('invoice-print-area');
    if (!content) return;
    const w = window.open('', '_blank');
    const filename = `Factura_${invoice.numero_factura}_${(invoice.cliente_nombre || '').replace(/\s+/g, '_')}_${invoice.fecha_emision}.pdf`;
    w.document.write(`<!DOCTYPE html><html><head>
      <meta charset="utf-8"/>
      <title>${filename}</title>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
      <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family: 'Inter', sans-serif; background: #fff; }
        @media print {
          @page { margin: 0; size: A4; }
          body { margin: 0; }
        }
      </style>
    </head><body>${content.outerHTML}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 600);
  };

  const handlePrint = () => {
    const content = document.getElementById('invoice-print-area');
    if (!content) return;
    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html><html><head>
      <meta charset="utf-8"/>
      <title>Factura ${invoice.numero_factura}</title>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
      <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family: 'Inter', sans-serif; }
        @media print { @page { margin: 10mm; } }
      </style>
    </head><body>${content.outerHTML}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); w.close(); }, 600);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-hidden flex flex-col p-0">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-5 py-3 bg-card border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <span className="font-jakarta font-semibold text-foreground text-sm">
              {invoice.numero_factura}
            </span>
            {invoice.cliente_nombre && (
              <span className="text-muted-foreground text-sm">· {invoice.cliente_nombre}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint} className="h-8 gap-1.5 hidden sm:flex">
              <Printer className="w-3.5 h-3.5" /> Imprimir
            </Button>
            <Button size="sm" onClick={handleDownload} className="h-8 gap-1.5 bg-teal hover:bg-teal-dark">
              <Download className="w-3.5 h-3.5" /> Descargar PDF
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onOpenChange(false)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 bg-gray-100 p-4">
          {/* Archivo adjunto (no emitida) */}
          {!showTemplate && isPdf && (
            <iframe src={invoice.archivo_url} className="w-full rounded-lg border bg-white shadow"
              style={{ height: '75vh' }} title="Factura PDF" />
          )}
          {!showTemplate && isImage && (
            <img src={invoice.archivo_url} alt="Factura"
              className="max-w-full mx-auto rounded-lg border shadow bg-white" />
          )}
          {!showTemplate && !isPdf && !isImage && (
            <div className="text-center py-16 bg-white rounded-xl border">
              <FileText className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-40" />
              <p className="text-muted-foreground">No se puede previsualizar este archivo.</p>
              <Button variant="outline" size="sm" className="mt-3" asChild>
                <a href={invoice.archivo_url} target="_blank" rel="noreferrer">Descargar para revisar</a>
              </Button>
            </div>
          )}

          {/* Plantilla generada */}
          {showTemplate && (
            <div className="rounded-xl overflow-hidden shadow-lg">
              <InvoiceTemplate invoice={invoice} company={company} />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}