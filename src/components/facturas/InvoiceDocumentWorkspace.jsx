/**
 * InvoiceDocumentWorkspace V3 — Vista completa de documento
 * Layout: Cabecera superior · Visor PDF/factura izquierda · Panel operativo derecha
 */
import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  ArrowLeft, Share2, MoreVertical, Send, Download,
  Printer, ZoomIn, ZoomOut, FileText, ChevronRight,
  ExternalLink, Copy, CheckCircle2, Clock, AlertTriangle,
  Mail, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import InvoiceOperationalSidePanel from './InvoiceOperationalSidePanel';

// ── Estado visual de factura ───────────────────────────────────────────────────
const STATUS_CFG = {
  borrador:             { label: 'Borrador',              color: 'bg-slate-100 text-slate-600 border-slate-200' },
  emitida:              { label: 'Emitida',               color: 'bg-blue-100 text-blue-700 border-blue-200' },
  enviada:              { label: 'Enviada',               color: 'bg-violet-100 text-violet-700 border-violet-200' },
  pendiente:            { label: 'Pendiente de pago',     color: 'bg-amber-100 text-amber-700 border-amber-200' },
  cobrada:              { label: 'Cobrada',               color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  vencida:              { label: 'Vencida',               color: 'bg-red-100 text-red-700 border-red-200' },
  contabilizada:        { label: 'Contabilizada',         color: 'bg-teal-100 text-teal-700 border-teal-200' },
  pendiente_pago:       { label: 'Pendiente de pago',     color: 'bg-amber-100 text-amber-700 border-amber-200' },
  parcialmente_pagada:  { label: 'Pago parcial',          color: 'bg-blue-100 text-blue-700 border-blue-200' },
  anulada:              { label: 'Anulada',               color: 'bg-slate-100 text-slate-500 border-slate-200 line-through' },
};

function resolveStatus(invoice) {
  const overdue = invoice.fecha_vencimiento && new Date(invoice.fecha_vencimiento) < new Date() && invoice.estado_cobro !== 'cobrada';
  if (overdue) return STATUS_CFG.vencida;
  const key = invoice.estado_cobro || invoice.estado_contable || 'emitida';
  return STATUS_CFG[key] || STATUS_CFG.emitida;
}

// ── Visor de factura ───────────────────────────────────────────────────────────
function InvoiceDocumentPreviewPane({ invoice, company }) {
  const [zoom, setZoom] = useState(100);
  const hasPdf = !!invoice?.archivo_url;

  const fmt = (n) => typeof n === 'number'
    ? n.toLocaleString('es-ES', { minimumFractionDigits: 2 }) + ' €'
    : '—';

  const fmtDate = (d) => {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }); }
    catch { return d; }
  };

  return (
    <div className="flex flex-col h-full bg-slate-100">
      {/* Toolbar del visor — propia de Taxea, sin toolbar nativa PDF */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground font-medium">
            Vista previa del documento
          </span>
          <span className={cn(
            "text-[10px] px-2 py-0.5 rounded-full border font-medium",
            hasPdf ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
          )}>
            {hasPdf ? 'PDF generado' : 'Render de datos'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setZoom(z => Math.max(50, z - 10))}
            className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            title="Reducir zoom">
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs text-muted-foreground w-10 text-center">{zoom}%</span>
          <button
            onClick={() => setZoom(z => Math.min(150, z + 10))}
            className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            title="Ampliar zoom">
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-4 bg-border mx-1" />
          <button
            onClick={() => window.print()}
            className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            title="Imprimir">
            <Printer className="w-3.5 h-3.5" />
          </button>
          {hasPdf && (
            <a
              href={invoice.archivo_url}
              download={`Factura_${invoice.numero_factura}.pdf`}
              className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
              title="Descargar PDF">
              <Download className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>

      {/* Área de visualización — siempre render HTML propio, nunca iframe PDF nativo */}
      <div className="flex-1 overflow-auto flex items-start justify-center py-6 px-4">
        <div
          style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center', width: '100%', maxWidth: '680px' }}
          className="transition-transform duration-150">
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <InvoiceVisualRender invoice={invoice} company={company} fmt={fmt} fmtDate={fmtDate} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Render visual de la factura (cuando no hay PDF) ───────────────────────────
function InvoiceVisualRender({ invoice, company, fmt, fmtDate }) {
  const LOGO = 'https://media.base44.com/images/public/6a00fec50cc522a74ddde4b2/3ded74681_ChatGPTImage7may202610_56_53pm.png';
  const brandColor = '#b91c1c';

  const lineas = invoice?.lineas || [];

  return (
    <div className="p-10 font-sans text-sm text-slate-800" style={{ minHeight: '1100px' }}>
      {/* Cabecera */}
      <div className="flex items-start justify-between mb-10">
        <div>
          {company?.logo_url ? (
            <img src={company.logo_url} alt={company.nombre} className="h-12 object-contain mb-2" />
          ) : (
            <div className="flex items-center gap-2 mb-2">
              <img src={LOGO} alt="Taxea Strategies" className="h-8 object-contain" />
            </div>
          )}
          <div className="text-xs text-slate-500 leading-relaxed mt-1">
            <p className="font-semibold text-slate-800">{company?.nombre || company?.razon_social || 'Emisor'}</p>
            {company?.nif && <p>NIF: {company.nif}</p>}
            {company?.direccion_fiscal && <p>{company.direccion_fiscal}</p>}
            {company?.email && <p>{company.email}</p>}
            {company?.telefono && <p>{company.telefono}</p>}
          </div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold mb-1" style={{ color: brandColor }}>FACTURA</div>
          <div className="text-lg font-semibold text-slate-700">{invoice.numero_factura}</div>
          <div className="text-xs text-slate-500 mt-2 space-y-0.5">
            <p>Fecha de emisión: <span className="font-medium text-slate-700">{fmtDate(invoice.fecha_emision)}</span></p>
            {invoice.fecha_vencimiento && (
              <p>Vencimiento: <span className="font-medium text-slate-700">{fmtDate(invoice.fecha_vencimiento)}</span></p>
            )}
          </div>
        </div>
      </div>

      {/* Emisor / Receptor */}
      <div className="grid grid-cols-2 gap-8 mb-8">
        <div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Emisor</div>
          <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-700 space-y-0.5">
            <p className="font-semibold">{company?.nombre || '—'}</p>
            {company?.nif && <p>NIF: {company.nif}</p>}
            {company?.direccion_fiscal && <p>{company.direccion_fiscal}</p>}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Receptor / Cliente</div>
          <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-700 space-y-0.5">
            <p className="font-semibold">{invoice.cliente_nombre || '—'}</p>
            {invoice.cliente_nif && <p>NIF/CIF: {invoice.cliente_nif}</p>}
            {invoice.cliente_direccion && <p>{invoice.cliente_direccion}</p>}
          </div>
        </div>
      </div>

      {/* Concepto */}
      {invoice.concepto && (
        <div className="mb-5">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Concepto</div>
          <p className="text-sm text-slate-700">{invoice.concepto}</p>
        </div>
      )}

      {/* Líneas de factura */}
      <table className="w-full text-xs mb-6 border-collapse">
        <thead>
          <tr style={{ backgroundColor: brandColor }} className="text-white">
            <th className="text-left px-3 py-2.5 font-semibold rounded-tl">Descripción</th>
            <th className="text-center px-3 py-2.5 font-semibold w-16">Cant.</th>
            <th className="text-right px-3 py-2.5 font-semibold w-24">Precio u.</th>
            <th className="text-right px-3 py-2.5 font-semibold w-20 rounded-tr">Importe</th>
          </tr>
        </thead>
        <tbody>
          {lineas.length > 0 ? lineas.map((l, i) => (
            <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
              <td className="px-3 py-2 border-b border-slate-100">{l.descripcion || l.concepto || '—'}</td>
              <td className="px-3 py-2 text-center border-b border-slate-100">{l.cantidad || 1}</td>
              <td className="px-3 py-2 text-right border-b border-slate-100">{fmt(l.precio_unitario || l.precio)}</td>
              <td className="px-3 py-2 text-right font-medium border-b border-slate-100">{fmt(l.importe || (l.cantidad * l.precio_unitario))}</td>
            </tr>
          )) : (
            <tr className="bg-white">
              <td className="px-3 py-2 border-b border-slate-100">{invoice.concepto || 'Servicio profesional'}</td>
              <td className="px-3 py-2 text-center border-b border-slate-100">1</td>
              <td className="px-3 py-2 text-right border-b border-slate-100">{fmt(invoice.base_imponible)}</td>
              <td className="px-3 py-2 text-right font-medium border-b border-slate-100">{fmt(invoice.base_imponible)}</td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Totales */}
      <div className="flex justify-end mb-8">
        <div className="w-64">
          <div className="flex justify-between py-1.5 text-sm border-b border-slate-100">
            <span className="text-slate-500">Base imponible</span>
            <span className="font-medium">{fmt(invoice.base_imponible)}</span>
          </div>
          <div className="flex justify-between py-1.5 text-sm border-b border-slate-100">
            <span className="text-slate-500">IVA ({invoice.tipo_iva || 21}%)</span>
            <span className="font-medium">{fmt(invoice.cuota_iva)}</span>
          </div>
          {invoice.retencion_irpf > 0 && (
            <div className="flex justify-between py-1.5 text-sm border-b border-slate-100">
              <span className="text-slate-500">Retención IRPF</span>
              <span className="font-medium text-red-600">−{fmt(invoice.retencion_irpf)}</span>
            </div>
          )}
          <div className="flex justify-between py-2 mt-1 rounded-lg px-2" style={{ backgroundColor: `${brandColor}10` }}>
            <span className="font-bold text-slate-800">Total</span>
            <span className="font-bold text-lg" style={{ color: brandColor }}>{fmt(invoice.total_factura)}</span>
          </div>
        </div>
      </div>

      {/* Método de pago */}
      {(invoice.metodo_pago || invoice.iban) && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-xs text-slate-700 mb-6">
          <p className="font-semibold text-emerald-800 mb-2">Instrucciones de pago</p>
          {invoice.metodo_pago && <p><span className="text-slate-500">Método: </span>{invoice.metodo_pago}</p>}
          {invoice.iban && <p><span className="text-slate-500">IBAN: </span>{invoice.iban}</p>}
          <p className="text-slate-500 mt-1">Indica el número <strong>{invoice.numero_factura}</strong> como referencia del pago.</p>
        </div>
      )}

      {/* Notas */}
      {invoice.notas && (
        <div className="border-t border-slate-200 pt-4 text-xs text-slate-500">
          <p>{invoice.notas}</p>
        </div>
      )}

      {/* Pie */}
      <div className="border-t border-slate-100 mt-8 pt-4 text-[10px] text-slate-400 text-center">
        Documento generado con Taxea Strategies · Portal de gestión financiera y fiscal
      </div>
    </div>
  );
}

// ── Workspace principal ────────────────────────────────────────────────────────
export default function InvoiceDocumentWorkspace({
  invoice,
  company,
  user,
  isAdmin,
  onClose,
  onSend,
  onEdit,
  onRefresh,
}) {
  const [copiedLink, setCopiedLink] = useState(false);

  if (!invoice) return null;

  const status = resolveStatus(invoice);
  const publicUrl = invoice.public_token
    ? `${window.location.origin}/public/invoice/${invoice.public_token}`
    : null;

  const handleCopyLink = () => {
    if (publicUrl) {
      navigator.clipboard.writeText(publicUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-40 bg-background flex flex-col">

      {/* ── Cabecera superior ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card flex-shrink-0 shadow-sm">

        {/* Izquierda: volver + título */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Facturas</span>
          </button>
          <div className="w-px h-5 bg-border flex-shrink-0" />
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="w-4 h-4 text-primary flex-shrink-0" />
            <div className="min-w-0">
              <span className="text-sm font-semibold text-foreground truncate block">
                Factura — {invoice.numero_factura}
              </span>
              {invoice.cliente_nombre && (
                <span className="text-xs text-muted-foreground truncate block">{invoice.cliente_nombre}</span>
              )}
            </div>
          </div>
          <span className={cn("text-xs px-2.5 py-0.5 rounded-full border font-medium flex-shrink-0 hidden sm:inline-flex", status.color)}>
            {status.label}
          </span>
        </div>

        {/* Derecha: acciones */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Compartir enlace */}
          {publicUrl && (
            <button
              onClick={handleCopyLink}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors",
                copiedLink
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : 'border-border hover:bg-secondary text-muted-foreground hover:text-foreground'
              )}
              title="Copiar enlace público">
              {copiedLink ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
              <span className="hidden md:inline">{copiedLink ? 'Copiado' : 'Compartir'}</span>
            </button>
          )}

          {/* Más acciones */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-1.5 rounded-lg border border-border hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                <MoreVertical className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="text-sm w-44">
              <DropdownMenuItem onClick={() => onEdit?.(invoice)}>
                Editar factura
              </DropdownMenuItem>
              {invoice.archivo_url && (
                <DropdownMenuItem asChild>
                  <a href={invoice.archivo_url} target="_blank" rel="noreferrer" className="flex items-center gap-2">
                    <Download className="w-3.5 h-3.5" /> Descargar PDF
                  </a>
                </DropdownMenuItem>
              )}
              {publicUrl && (
                <DropdownMenuItem asChild>
                  <a href={publicUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2">
                    <ExternalLink className="w-3.5 h-3.5" /> Ver enlace público
                  </a>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={handleCopyLink}>
                <Copy className="w-3.5 h-3.5 mr-2" /> Copiar enlace
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Botón principal Enviar */}
          <Button
            onClick={() => onSend?.(invoice)}
            className="bg-primary hover:bg-primary/90 h-9 text-sm gap-2">
            <Send className="w-3.5 h-3.5" />
            <span>Enviar</span>
          </Button>
        </div>
      </div>

      {/* ── Layout principal: visor + panel ───────────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* Zona visor (izquierda/centro) */}
        <div className="flex-1 min-w-0 overflow-hidden">
          <InvoiceDocumentPreviewPane invoice={invoice} company={company} />
        </div>

        {/* Panel operativo (derecha) */}
        <div className="w-[440px] flex-shrink-0 border-l border-border overflow-hidden flex flex-col bg-card">
          <InvoiceOperationalSidePanel
            invoice={invoice}
            company={company}
            user={user}
            isAdmin={isAdmin}
            onClose={onClose}
            onSend={onSend}
            onEdit={onEdit}
            onRefresh={onRefresh}
          />
        </div>
      </div>
    </div>
  );
}