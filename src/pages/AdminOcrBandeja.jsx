import { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  RefreshCw, Eye, Play, CheckCircle, Loader2, Ban, FileText, Image,
  Filter, Inbox, AlertTriangle, Clock, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { buildAuditEntry, appendAuditTrail } from '@/lib/ocrUploadUtils';

const STATUS_CONFIG = {
  pending:               { label: 'Pendiente',                  color: 'text-amber-600',  bg: 'bg-amber-50' },
  queued_for_analysis:   { label: 'En cola',                    color: 'text-blue-600',   bg: 'bg-blue-50' },
  processing:            { label: 'Procesando',                 color: 'text-blue-600',   bg: 'bg-blue-50' },
  analysis_failed:       { label: 'Error de analisis',          color: 'text-red-600',    bg: 'bg-red-50' },
  review_required:       { label: 'Pendiente de revision',      color: 'text-orange-600', bg: 'bg-orange-50' },
  validated:             { label: 'Validado',                   color: 'text-green-600',  bg: 'bg-green-50' },
  accounted:             { label: 'Contabilizado',              color: 'text-green-700',  bg: 'bg-green-50' },
  rejected:              { label: 'Rechazado',                  color: 'text-red-600',    bg: 'bg-red-50' },
  replacement_requested: { label: 'Sustitucion solicitada',     color: 'text-orange-600', bg: 'bg-orange-50' },
  cancelled_by_client:   { label: 'Retirado',                   color: 'text-slate-500',  bg: 'bg-slate-50' },
};

const TYPE_LABELS = {
  income_invoice: 'Ingreso',
  expense_invoice: 'Gasto',
};

const SOURCE_LABELS = {
  mobile_camera: 'Camara movil',
  mobile_upload: 'Subida movil',
  desktop_upload: 'Subida PC',
  admin_upload: 'Admin',
};

const STATUS_FILTERS = [
  { key: 'all',     label: 'Todos',        match: () => true },
  { key: 'pending', label: 'Pendientes',   match: (s) => s === 'pending' },
  { key: 'active',  label: 'En proceso',   match: (s) => ['queued_for_analysis','processing','review_required','analysis_failed'].includes(s) },
  { key: 'done',    label: 'Procesados',   match: (s) => ['validated','accounted'].includes(s) },
  { key: 'closed',  label: 'Cerrados',     match: (s) => ['rejected','replacement_requested','cancelled_by_client'].includes(s) },
];

function fileIcon(name) {
  const ext = name?.split('.').pop()?.toLowerCase();
  return ['jpg','jpeg','png','webp'].includes(ext) ? Image : FileText;
}

export default function AdminOcrBandeja() {
  const { user, isAdmin } = useOutletContext() || {};
  const [documents, setDocuments] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingIds, setProcessingIds] = useState(new Set());
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterClient, setFilterClient] = useState('all');
  const [rejectModal, setRejectModal] = useState(null);
  const [auditModal, setAuditModal] = useState(null);

  const loadDocs = useCallback(async () => {
    setLoading(true);
    try {
      const [docs, comps] = await Promise.all([
        base44.entities.OcrInvoiceDocument.list('-uploadedAt', 500),
        base44.entities.Company.list('-created_date', 200).catch(() => []),
      ]);
      setDocuments(docs || []);
      setCompanies(comps || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { if (isAdmin) loadDocs(); }, [isAdmin, loadDocs]);

  useEffect(() => {
    if (!isAdmin) return;
    const unsub = base44.entities.OcrInvoiceDocument.subscribe(() => loadDocs());
    return unsub;
  }, [isAdmin, loadDocs]);

  const companyMap = companies.reduce((acc, c) => { acc[c.id] = c; return acc; }, {});

  const filtered = documents.filter(doc => {
    if (filterStatus !== 'all') {
      const sf = STATUS_FILTERS.find(f => f.key === filterStatus);
      if (sf && !sf.match(doc.status)) return false;
    }
    if (filterType !== 'all' && doc.documentType !== filterType) return false;
    if (filterClient !== 'all' && doc.company_id !== filterClient) return false;
    if (search) {
      const q = search.toLowerCase();
      const compName = companyMap[doc.company_id]?.razon_social || companyMap[doc.company_id]?.nombre_comercial || '';
      if (!doc.originalFileName?.toLowerCase().includes(q) &&
          !doc.uploadedByEmail?.toLowerCase().includes(q) &&
          !compName.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const counts = STATUS_FILTERS.reduce((acc, f) => {
    acc[f.key] = documents.filter(d => f.match(d.status)).length;
    return acc;
  }, {});

  const processOcr = async (doc) => {
    setProcessingIds(prev => new Set([...prev, doc.id]));
    const now = new Date().toISOString();
    await base44.entities.OcrInvoiceDocument.update(doc.id, {
      status: 'processing',
      analysisStartedAt: now,
      lastStatusChangedAt: now,
      safeErrorMessage: '',
      auditTrail: appendAuditTrail(doc.auditTrail, buildAuditEntry({ user, action: 'ocr_iniciado', prevStatus: doc.status, newStatus: 'processing' })),
    });
    loadDocs();

    const isExpense = doc.documentType === 'expense_invoice';
    const prompt = isExpense
      ? `Analiza este documento fiscal (factura, ticket o justificante de gasto) y extrae los datos en JSON. Si no encuentras un dato, usa null. Datos: proveedor, nif_proveedor, fecha (YYYY-MM-DD), numero_factura, base_imponible (numero), tipo_impuesto (numero %), cuota_impuesto (numero), total (numero), categoria_sugerida, concepto.`
      : `Analiza esta factura emitida y extrae los datos en JSON. Si no encuentras un dato, usa null. Datos: numero_factura, fecha (YYYY-MM-DD), cliente_nombre, cliente_nif, concepto, base_imponible (numero), tipo_iva (numero %), cuota_iva (numero), total_factura (numero), fecha_vencimiento (YYYY-MM-DD).`;

    const schema = {
      type: 'object',
      properties: isExpense
        ? { proveedor: {type:'string'}, nif_proveedor: {type:'string'}, fecha: {type:'string'}, numero_factura: {type:'string'}, base_imponible: {type:'number'}, tipo_impuesto: {type:'number'}, cuota_impuesto: {type:'number'}, total: {type:'number'}, categoria_sugerida: {type:'string'}, concepto: {type:'string'} }
        : { numero_factura: {type:'string'}, fecha: {type:'string'}, cliente_nombre: {type:'string'}, cliente_nif: {type:'string'}, concepto: {type:'string'}, base_imponible: {type:'number'}, tipo_iva: {type:'number'}, cuota_iva: {type:'number'}, total_factura: {type:'number'}, fecha_vencimiento: {type:'string'} },
    };

    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt, file_urls: [doc.fileStorageUrl], response_json_schema: schema,
      });
      const doneNow = new Date().toISOString();
      await base44.entities.OcrInvoiceDocument.update(doc.id, {
        status: 'review_required',
        extractedData: JSON.stringify(result),
        analysisCompletedAt: doneNow,
        lastStatusChangedAt: doneNow,
        auditTrail: appendAuditTrail(doc.auditTrail, buildAuditEntry({ user, action: 'ocr_completado', prevStatus: 'processing', newStatus: 'review_required' })),
      });
    } catch {
      const failNow = new Date().toISOString();
      await base44.entities.OcrInvoiceDocument.update(doc.id, {
        status: 'analysis_failed',
        safeErrorMessage: 'No se ha podido analizar automaticamente. El documento sigue guardado para revision manual.',
        lastStatusChangedAt: failNow,
        auditTrail: appendAuditTrail(doc.auditTrail, buildAuditEntry({ user, action: 'ocr_fallido', prevStatus: 'processing', newStatus: 'analysis_failed' })),
      });
    }
    setProcessingIds(prev => { const n = new Set(prev); n.delete(doc.id); return n; });
    loadDocs();
  };

  const handleValidate = async (doc) => {
    const now = new Date().toISOString();
    await base44.entities.OcrInvoiceDocument.update(doc.id, {
      status: 'validated',
      reviewedAt: now,
      reviewedByAdminId: user?.id,
      lastStatusChangedAt: now,
      auditTrail: appendAuditTrail(doc.auditTrail, buildAuditEntry({ user, action: 'validado', prevStatus: doc.status, newStatus: 'validated' })),
    });
    loadDocs();
  };

  const handleAccount = async (doc) => {
    const now = new Date().toISOString();
    await base44.entities.OcrInvoiceDocument.update(doc.id, {
      status: 'accounted',
      accountedAt: now,
      reviewedByAdminId: user?.id,
      lastStatusChangedAt: now,
      auditTrail: appendAuditTrail(doc.auditTrail, buildAuditEntry({ user, action: 'contabilizado', prevStatus: doc.status, newStatus: 'accounted' })),
    });
    loadDocs();
  };

  const handleReject = async (docId, reason) => {
    const doc = documents.find(d => d.id === docId);
    const now = new Date().toISOString();
    await base44.entities.OcrInvoiceDocument.update(docId, {
      status: 'rejected',
      rejectedAt: now,
      rejectionReason: reason,
      reviewedByAdminId: user?.id,
      lastStatusChangedAt: now,
      auditTrail: appendAuditTrail(doc?.auditTrail, buildAuditEntry({ user, action: 'rechazado', prevStatus: doc?.status, newStatus: 'rejected', detail: reason })),
    });
    setRejectModal(null);
    loadDocs();
  };

  const handleRequestReplacement = async (doc) => {
    const now = new Date().toISOString();
    await base44.entities.OcrInvoiceDocument.update(doc.id, {
      status: 'replacement_requested',
      reviewedByAdminId: user?.id,
      lastStatusChangedAt: now,
      auditTrail: appendAuditTrail(doc.auditTrail, buildAuditEntry({ user, action: 'sustitucion_solicitada', prevStatus: doc.status, newStatus: 'replacement_requested' })),
    });
    loadDocs();
  };

  if (!isAdmin) {
    return (
      <div className="p-12 text-center">
        <AlertTriangle className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">Acceso restringido a administradores.</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Bandeja OCR Pendiente"
        subtitle="Cola cross-cliente de facturas entregadas · Ingresos y gastos"
      >
        <Button onClick={loadDocs} variant="outline" size="sm" className="gap-2">
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} /> Actualizar
        </Button>
      </PageHeader>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <KpiCard icon={Clock} label="Pendientes" value={counts.pending} color="text-amber-600" bg="bg-amber-50" />
        <KpiCard icon={Loader2} label="En proceso" value={counts.active} color="text-blue-600" bg="bg-blue-50" />
        <KpiCard icon={CheckCircle} label="Procesados" value={counts.done} color="text-green-600" bg="bg-green-50" />
        <KpiCard icon={Inbox} label="Total" value={documents.length} color="text-foreground" bg="bg-secondary" />
      </div>

      {/* Filters */}
      <div className="bg-card border border-border rounded-xl shadow-card mb-5">
        <div className="flex flex-wrap gap-2 p-3 border-b border-border">
          {STATUS_FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilterStatus(f.key)}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors',
                filterStatus === f.key ? 'bg-teal text-white' : 'text-muted-foreground hover:bg-secondary'
              )}
            >
              {f.label} ({counts[f.key]})
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 p-3">
          <Input
            placeholder="Buscar por archivo, email o cliente..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-8 max-w-xs text-sm"
          />
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="h-8 text-sm border border-input rounded-md px-2 bg-transparent"
          >
            <option value="all">Todos los tipos</option>
            <option value="income_invoice">Ingresos</option>
            <option value="expense_invoice">Gastos</option>
          </select>
          <select
            value={filterClient}
            onChange={e => setFilterClient(e.target.value)}
            className="h-8 text-sm border border-input rounded-md px-2 bg-transparent max-w-[200px]"
          >
            <option value="all">Todos los clientes</option>
            {companies.map(c => (
              <option key={c.id} value={c.id}>{c.razon_social || c.nombre_comercial || c.id}</option>
            ))}
          </select>
          {(search || filterType !== 'all' || filterClient !== 'all') && (
            <Button variant="ghost" size="sm" className="h-8 gap-1" onClick={() => { setSearch(''); setFilterType('all'); setFilterClient('all'); }}>
              <X className="w-3 h-3" /> Limpiar
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl shadow-card overflow-hidden">
        {loading ? (
          <div className="py-12 text-center">
            <div className="w-6 h-6 border-2 border-teal border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center">
            <Inbox className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No hay documentos que coincidan con los filtros.</p>
          </div>
        ) : (
          <div className="divide-y divide-border max-h-[700px] overflow-y-auto">
            {filtered.map(doc => {
              const cfg = STATUS_CONFIG[doc.status] || STATUS_CONFIG.pending;
              const Icon = fileIcon(doc.originalFileName);
              const isProcessing = processingIds.has(doc.id);
              const comp = companyMap[doc.company_id];
              return (
                <div key={doc.id} className="px-4 py-3 hover:bg-secondary/20 transition-colors">
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-foreground truncate">{doc.originalFileName || 'Documento'}</p>
                        <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0',
                          doc.documentType === 'income_invoice' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700')}>
                          {TYPE_LABELS[doc.documentType] || doc.documentType}
                        </span>
                        {doc.duplicateWarning && (
                          <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">Duplicado</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {comp?.razon_social || comp?.nombre_comercial || 'Cliente desconocido'}
                        {' · '}
                        {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                        {doc.uploadedByEmail ? ` · ${doc.uploadedByEmail}` : ''}
                        {doc.uploadSource ? ` · ${SOURCE_LABELS[doc.uploadSource] || doc.uploadSource}` : ''}
                      </p>
                    </div>
                    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0', cfg.bg, cfg.color)}>
                      {isProcessing && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                      {cfg.label}
                    </span>
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      {doc.fileStorageUrl && (
                        <a href={doc.fileStorageUrl} target="_blank" rel="noreferrer" className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-teal" title="Ver documento">
                          <Eye className="w-3.5 h-3.5" />
                        </a>
                      )}
                      {(doc.status === 'pending' || doc.status === 'analysis_failed') && (
                        <button onClick={() => processOcr(doc)} disabled={isProcessing} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-teal disabled:opacity-50" title="Procesar OCR">
                          {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                        </button>
                      )}
                      {doc.status === 'review_required' && (
                        <>
                          <button onClick={() => handleValidate(doc)} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-green-600" title="Validar">
                            <CheckCircle className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleAccount(doc)} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-green-700" title="Contabilizar">
                            <FileText className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleRequestReplacement(doc)} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-orange-600" title="Pedir sustitucion">
                            <AlertTriangle className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setRejectModal(doc)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive" title="Rechazar">
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                      <button onClick={() => setAuditModal(doc)} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground" title="Ver historial">
                        <Clock className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  {doc.safeErrorMessage && (
                    <p className="text-xs text-red-500 mt-1.5 pl-7">{doc.safeErrorMessage}</p>
                  )}
                  {doc.rejectionReason && (
                    <p className="text-xs text-red-500 mt-1.5 pl-7">Motivo: {doc.rejectionReason}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Reject modal */}
      {rejectModal && (
        <RejectDialog
          doc={rejectModal}
          onClose={() => setRejectModal(null)}
          onConfirm={(reason) => handleReject(rejectModal.id, reason)}
        />
      )}

      {/* Audit trail modal */}
      {auditModal && (
        <Dialog open onOpenChange={() => setAuditModal(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Historial del documento</DialogTitle>
            </DialogHeader>
            <div className="max-h-[400px] overflow-y-auto space-y-1">
              {auditModal.auditTrail?.length > 0 ? (
                auditModal.auditTrail.map((entry, i) => (
                  <div key={i} className="text-xs font-mono bg-secondary/50 rounded p-2 border border-border">
                    {entry}
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">Sin eventos registrados.</p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAuditModal(null)}>Cerrar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, color, bg }) {
  return (
    <div className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3">
      <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0', bg)}>
        <Icon className={cn('w-4 h-4', color)} />
      </div>
      <div>
        <p className={cn('text-xl font-bold', color)}>{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function RejectDialog({ doc, onClose, onConfirm }) {
  const [reason, setReason] = useState('');
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Rechazar documento</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{doc.originalFileName}</p>
          <Textarea
            placeholder="Motivo del rechazo..."
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={3}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button variant="destructive" disabled={!reason.trim()} onClick={() => onConfirm(reason.trim())}>
            Rechazar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}