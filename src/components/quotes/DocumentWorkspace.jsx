/**
 * DocumentWorkspace — Vista completa para Presupuestos y Proformas
 * Layout: Cabecera · Visor visual izquierda · Panel operativo derecha
 */
import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  ArrowLeft, Send, Download, Printer, ZoomIn, ZoomOut,
  FileText, MoreVertical, CheckCircle2, XCircle, Clock,
  ArrowRight, Edit, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { base44 } from '@/api/base44Client';
import DocumentVisualRender from './DocumentVisualRender';
import SendDocumentEmailModal from './SendDocumentEmailModal';

const STATUS_CFG = {
  borrador:            { label: 'Borrador',            color: 'bg-slate-100 text-slate-600 border-slate-200' },
  enviado:             { label: 'Enviado',             color: 'bg-blue-100 text-blue-700 border-blue-200' },
  enviada:             { label: 'Enviada',             color: 'bg-blue-100 text-blue-700 border-blue-200' },
  aceptado:            { label: 'Aceptado',            color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  aceptada:            { label: 'Aceptada',            color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  rechazado:           { label: 'Rechazado',           color: 'bg-red-100 text-red-700 border-red-200' },
  convertido_factura:  { label: 'Convertido en factura', color: 'bg-violet-100 text-violet-700 border-violet-200' },
  convertida_factura:  { label: 'Convertida en factura', color: 'bg-violet-100 text-violet-700 border-violet-200' },
};

const fmt = (n) => typeof n === 'number' ? n.toLocaleString('es-ES', { minimumFractionDigits: 2 }) + ' €' : '—';
const fmtDate = (d) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }); }
  catch { return d; }
};

// ── Panel lateral derecho ──────────────────────────────────────────────────────
function SidePanel({ doc, docType, company, user, onEdit, onRefresh, onSend, onClose }) {
  const [converting, setConverting] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [showConvertDialog, setShowConvertDialog] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [convertError, setConvertError] = useState('');

  const isQuote = docType === 'quote';
  const entityName = isQuote ? 'Quote' : 'Proforma';
  const statusKey = doc?.estado || 'borrador';
  const statusCfg = STATUS_CFG[statusKey] || STATUS_CFG.borrador;
  const isConverted = statusKey === 'convertido_factura' || statusKey === 'convertida_factura';

  const convertToInvoice = async () => {
    const cleanNumber = invoiceNumber.trim();
    if (!cleanNumber || !invoiceDate) {
      setConvertError('Indica el número definitivo y la fecha de emisión.');
      return;
    }
    setConverting(true);
    setConvertError('');
    try {
      const estadoConvertido = isQuote ? 'convertido_factura' : 'convertida_factura';
      const sourceType = isQuote ? 'presupuesto' : 'proforma';
      const existingSource = await base44.entities.Invoice.filter({
        company_id: company.id,
        source_document_id: doc.id,
      });
      if ((existingSource || []).some(invoice => !invoice.anulada)) {
        await base44.entities[entityName].update(doc.id, { estado: estadoConvertido });
        setShowConvertDialog(false);
        onRefresh?.();
        return;
      }
      const duplicateNumber = await base44.entities.Invoice.filter({
        company_id: company.id,
        numero_factura: cleanNumber,
      });
      if ((duplicateNumber || []).some(invoice => !invoice.anulada)) {
        setConvertError('Ya existe una factura activa con ese número. Usa otra numeración.');
        return;
      }
      const base = Number(doc.base_imponible) || 0;
      const parsedTaxRate = Number(doc.tipo_impuesto);
      const taxRate = Number.isFinite(parsedTaxRate) ? parsedTaxRate : 0;
      const parsedTaxAmount = Number(doc.cuota_impuesto);
      const taxAmount = Number.isFinite(parsedTaxAmount) ? parsedTaxAmount : base * taxRate / 100;
      const parsedRetentionRate = Number(doc.retencion_irpf);
      const retentionRate = Number.isFinite(parsedRetentionRate) ? parsedRetentionRate : 0;
      const retentionAmount = base * retentionRate / 100;
      const date = new Date(`${invoiceDate}T12:00:00`);
      await base44.entities.Invoice.create({
        company_id: company.id,
        numero_factura: cleanNumber,
        fecha_emision: invoiceDate,
        fecha_operacion: invoiceDate,
        cliente_nombre: doc.cliente_nombre,
        cliente_nif: doc.cliente_nif,
        cliente_email: doc.cliente_email,
        cliente_direccion: doc.cliente_direccion,
        concepto: doc.concepto || '',
        base_imponible: base,
        tipo_iva: taxRate,
        cuota_iva: taxAmount,
        retencion_irpf: retentionRate,
        importe_retencion: retentionAmount,
        total_factura: Number(doc.total) || base + taxAmount - retentionAmount,
        forma_pago: doc.forma_pago,
        coletilla_fiscal: doc.coletilla_fiscal,
        tipo: 'emitida',
        estado_cobro: 'pendiente',
        estado_contable: 'pendiente',
        anio: date.getFullYear(),
        trimestre: ['T1', 'T2', 'T3', 'T4'][Math.floor(date.getMonth() / 3)],
        subido_por: user?.email,
        origin: sourceType,
        source_document_type: sourceType,
        source_document_id: doc.id,
      });
      await base44.entities[entityName].update(doc.id, { estado: estadoConvertido });
      setShowConvertDialog(false);
      onRefresh?.();
    } catch (error) {
      console.error('Error convirtiendo documento:', error);
      setConvertError('No se pudo crear la factura. No se ha marcado el documento como convertido.');
    } finally {
      setConverting(false);
    }
  };

  const updateStatus = async (estado) => {
    setUpdatingStatus(true);
    await base44.entities[entityName].update(doc.id, { estado });
    setUpdatingStatus(false);
    onRefresh?.();
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Estado */}
      <div className="px-5 py-4 border-b border-border">
        <p className="text-xs font-semibold text-muted-foreground mb-2">Estado</p>
        <span className={cn("text-xs px-3 py-1 rounded-full border font-medium", statusCfg.color)}>
          {statusCfg.label}
        </span>
      </div>

      {/* Datos del cliente */}
      <div className="px-5 py-4 border-b border-border space-y-2">
        <p className="text-xs font-semibold text-muted-foreground">Cliente</p>
        <p className="text-sm font-semibold text-foreground">{doc?.cliente_nombre || '—'}</p>
        {doc?.cliente_nif && <p className="text-xs text-muted-foreground">NIF: {doc.cliente_nif}</p>}
      </div>

      {/* Importes */}
      <div className="px-5 py-4 border-b border-border space-y-2">
        <p className="text-xs font-semibold text-muted-foreground mb-3">Importes</p>
        <div className="space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Base imponible</span>
            <span className="font-medium">{fmt(doc?.base_imponible)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Impuesto ({doc?.tipo_impuesto ?? 0}%)</span>
            <span className="font-medium">{fmt(doc?.cuota_impuesto ?? (doc?.base_imponible * (doc?.tipo_impuesto ?? 0) / 100))}</span>
          </div>
          <div className="flex justify-between text-sm font-bold pt-1 border-t border-border">
            <span>Total</span>
            <span className="text-primary">{fmt(doc?.total)}</span>
          </div>
        </div>
      </div>

      {/* Fechas */}
      <div className="px-5 py-4 border-b border-border space-y-2">
        <p className="text-xs font-semibold text-muted-foreground">Fechas</p>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Emisión</span>
          <span>{fmtDate(doc?.fecha)}</span>
        </div>
        {isQuote && doc?.validez_dias && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Validez</span>
            <span>{doc.validez_dias} días</span>
          </div>
        )}
      </div>

      {/* Acciones */}
      <div className="px-5 py-4 space-y-2">
        <p className="text-xs font-semibold text-muted-foreground mb-3">Acciones</p>

        {/* Enviar por email */}
        <Button onClick={() => onSend?.()} className="w-full bg-primary hover:bg-primary/90 h-9 text-sm gap-2">
          <Send className="w-3.5 h-3.5" /> Enviar por email
        </Button>

        {/* Editar */}
        {!isConverted && (
          <Button variant="outline" onClick={() => onEdit?.(doc)} className="w-full h-9 text-sm gap-2">
            <Edit className="w-3.5 h-3.5" /> Editar documento
          </Button>
        )}

        {/* Cambiar estado */}
        {!isConverted && (
          <div className="flex gap-2">
            {statusKey !== 'aceptado' && statusKey !== 'aceptada' && (
              <Button variant="outline" onClick={() => updateStatus(isQuote ? 'aceptado' : 'aceptada')}
                disabled={updatingStatus} className="flex-1 h-8 text-xs gap-1.5 text-emerald-700 border-emerald-200 hover:bg-emerald-50">
                <CheckCircle2 className="w-3 h-3" /> Aceptado
              </Button>
            )}
            {statusKey !== 'rechazado' && isQuote && (
              <Button variant="outline" onClick={() => updateStatus('rechazado')}
                disabled={updatingStatus} className="flex-1 h-8 text-xs gap-1.5 text-red-700 border-red-200 hover:bg-red-50">
                <XCircle className="w-3 h-3" /> Rechazado
              </Button>
            )}
          </div>
        )}

        {/* Convertir en factura */}
        {!isConverted && (
          <Button variant="outline" onClick={() => { setConvertError(''); setShowConvertDialog(true); }}
            className="w-full h-9 text-sm gap-2 text-violet-700 border-violet-200 hover:bg-violet-50">
            <ArrowRight className="w-3.5 h-3.5" /> Convertir en factura
          </Button>
        )}

        {isConverted && (
          <div className="flex items-center gap-2 bg-violet-50 border border-violet-200 rounded-lg px-3 py-2.5">
            <CheckCircle2 className="w-4 h-4 text-violet-600 flex-shrink-0" />
            <p className="text-xs text-violet-700 font-medium">Ya convertido en factura</p>
          </div>
        )}
      </div>

      <Dialog open={showConvertDialog} onOpenChange={setShowConvertDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Crear factura definitiva</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            La factura no podrá editarse después. Si hay un error habrá que anularla y emitir una nueva o rectificativa.
          </p>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Número de factura *</Label>
              <Input value={invoiceNumber} onChange={event => setInvoiceNumber(event.target.value)} placeholder="F-2026-001" />
            </div>
            <div className="space-y-1.5">
              <Label>Fecha de emisión *</Label>
              <Input type="date" value={invoiceDate} onChange={event => setInvoiceDate(event.target.value)} />
            </div>
          </div>
          {convertError && <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{convertError}</p>}
          <div className="flex justify-end gap-3 mt-2">
            <Button variant="outline" onClick={() => setShowConvertDialog(false)} disabled={converting}>Cancelar</Button>
            <Button onClick={convertToInvoice} disabled={converting} className="bg-violet-700 hover:bg-violet-800">
              {converting && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              Crear factura
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Workspace principal ────────────────────────────────────────────────────────
export default function DocumentWorkspace({ doc, docType, company, user, onClose, onEdit, onRefresh }) {
  const [zoom, setZoom] = useState(100);
  const [showSendModal, setShowSendModal] = useState(false);

  if (!doc) return null;

  const isQuote = docType === 'quote';
  const label = isQuote ? 'Presupuesto' : 'Proforma';
  const num = isQuote ? doc.numero_presupuesto : doc.numero_proforma;
  const statusKey = doc?.estado || 'borrador';
  const statusCfg = STATUS_CFG[statusKey] || STATUS_CFG.borrador;

  return (
    <div className="fixed inset-0 z-40 bg-background flex flex-col">

      {/* Cabecera */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card flex-shrink-0 shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onClose} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">{label}s</span>
          </button>
          <div className="w-px h-5 bg-border flex-shrink-0" />
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="w-4 h-4 text-primary flex-shrink-0" />
            <div className="min-w-0">
              <span className="text-sm font-semibold text-foreground truncate block">{label} — {num}</span>
              {doc.cliente_nombre && <span className="text-xs text-muted-foreground truncate block">{doc.cliente_nombre}</span>}
            </div>
          </div>
          <span className={cn("text-xs px-2.5 py-0.5 rounded-full border font-medium flex-shrink-0 hidden sm:inline-flex", statusCfg.color)}>
            {statusCfg.label}
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Button onClick={() => setShowSendModal(true)} className="bg-primary hover:bg-primary/90 h-9 text-sm gap-2">
            <Send className="w-3.5 h-3.5" /> Enviar
          </Button>
        </div>
      </div>

      {/* Layout principal */}
      <div className="flex flex-1 min-h-0">

        {/* Visor (izquierda) */}
        <div className="flex-1 min-w-0 overflow-hidden flex flex-col bg-slate-100">
          {/* Toolbar visor */}
          <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-border flex-shrink-0">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground font-medium">Vista previa del documento</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full border font-medium bg-blue-50 text-blue-700 border-blue-200">
                {label}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setZoom(z => Math.max(50, z - 10))} className="p-1.5 rounded hover:bg-secondary text-muted-foreground">
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs text-muted-foreground w-10 text-center">{zoom}%</span>
              <button onClick={() => setZoom(z => Math.min(150, z + 10))} className="p-1.5 rounded hover:bg-secondary text-muted-foreground">
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <div className="w-px h-4 bg-border mx-1" />
              <button onClick={() => window.print()} className="p-1.5 rounded hover:bg-secondary text-muted-foreground" title="Imprimir">
                <Printer className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          {/* Documento */}
          <div className="flex-1 overflow-auto flex items-start justify-center py-6 px-4">
            <div style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center', width: '100%', maxWidth: '680px' }} className="transition-transform duration-150">
              <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                <DocumentVisualRender doc={doc} company={company} docType={docType} />
              </div>
            </div>
          </div>
        </div>

        {/* Panel derecho */}
        <div className="w-[380px] flex-shrink-0 border-l border-border overflow-hidden flex flex-col bg-card">
          <SidePanel
            doc={doc}
            docType={docType}
            company={company}
            user={user}
            onEdit={onEdit}
            onRefresh={onRefresh}
            onSend={() => setShowSendModal(true)}
            onClose={onClose}
          />
        </div>
      </div>

      {/* Modal de envío */}
      <SendDocumentEmailModal
        open={showSendModal}
        onOpenChange={setShowSendModal}
        doc={doc}
        docType={docType}
        company={company}
        user={user}
        onSent={() => { setShowSendModal(false); onRefresh?.(); }}
      />
    </div>
  );
}