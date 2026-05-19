/**
 * InvoiceOperationalSidePanel — Panel lateral operativo de factura
 * Pestañas: General, Mensajes, Historial
 */
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { cn } from '@/lib/utils';
import {
  X, Send, Copy, Link, MoreVertical, ChevronRight,
  FileText, CreditCard, Clock, Mail, Tag, Paperclip,
  BookOpen, ExternalLink, CheckCircle2, AlertTriangle,
  User, Calendar, Building2, RefreshCw, Plus, Download,
  Eye, RotateCcw, MessageSquare, History
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';

// ── Helpers ────────────────────────────────────────────────────────────────────
const fmt = (n) => typeof n === 'number'
  ? n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
  : '—';

const fmtDate = (d) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
};

const fmtDateTime = (d) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }
  catch { return d; }
};

const isOverdue = (date) => date && new Date(date) < new Date();
const daysUntil = (date) => {
  if (!date) return null;
  return Math.ceil((new Date(date) - new Date()) / (1000 * 60 * 60 * 24));
};

// ── Estado de pago ─────────────────────────────────────────────────────────────
const PAYMENT_STATUS = {
  pendiente:    { label: 'Pendiente', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  cobrada:      { label: 'Cobrada', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  vencida:      { label: 'Vencida', color: 'bg-red-100 text-red-700 border-red-200' },
  parcial:      { label: 'Pago parcial', color: 'bg-blue-100 text-blue-700 border-blue-200' },
};

const SEND_STATUS = {
  enviada:      { label: 'Enviada', color: 'text-blue-600', icon: Mail },
  abierta:      { label: 'Abierta', color: 'text-emerald-600', icon: Eye },
  error_envio:  { label: 'Error de envío', color: 'text-red-600', icon: AlertTriangle },
  pendiente:    { label: 'No enviada', color: 'text-slate-400', icon: Mail },
};

// ── Componente de sección del panel ───────────────────────────────────────────
function Section({ title, icon: IconComp, children, defaultOpen = true }) {
  const Icon = IconComp;
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-border last:border-0">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-secondary/30 transition-colors">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-3.5 h-3.5 text-muted-foreground" />}
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{title}</span>
        </div>
        <ChevronRight className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform", open && "rotate-90")} />
      </button>
      {open && <div className="px-4 pb-3">{children}</div>}
    </div>
  );
}

function InfoRow({ label, value, valueClass = '' }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 border-b border-border/50 last:border-0">
      <span className="text-xs text-muted-foreground flex-shrink-0 w-28">{label}</span>
      <span className={cn("text-xs text-right break-all", valueClass || "text-foreground font-medium")}>{value || '—'}</span>
    </div>
  );
}

// ── Panel principal ────────────────────────────────────────────────────────────
export default function InvoiceOperationalSidePanel({ invoice, onClose, onSend, onEdit, onRefresh, company }) {
  const [tab, setTab] = useState('general');
  const [emailLogs, setEmailLogs] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!invoice?.id) return;
    loadEmailLogs();
    loadTimeline();
  }, [invoice?.id]);

  const loadEmailLogs = async () => {
    setLoadingLogs(true);
    try {
      const logs = await base44.entities.InvoiceEmailLog.filter({ invoice_id: invoice.id }, '-sent_at', 20);
      setEmailLogs(logs || []);
    } catch { setEmailLogs([]); }
    setLoadingLogs(false);
  };

  const loadTimeline = async () => {
    try {
      const events = await base44.entities.InvoiceTimelineEvent.filter({ invoice_id: invoice.id }, '-created_at', 50);
      setTimeline(events || []);
    } catch { setTimeline([]); }
  };

  const copyPortalLink = () => {
    const link = invoice.portal_link || `${window.location.origin}/portal/invoice/${invoice.id}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    // Registrar evento
    base44.entities.InvoiceTimelineEvent.create({
      invoice_id: invoice.id,
      company_id: company?.id,
      event_type: 'link_copiado',
      event_label: 'Enlace al portal copiado',
      event_detail: 'Enlace seguro copiado al portapapeles',
      created_at: new Date().toISOString(),
      origin: 'manual',
    }).catch(() => {});
  };

  const days = daysUntil(invoice?.fecha_vencimiento);
  const overdue = isOverdue(invoice?.fecha_vencimiento) && invoice?.estado_cobro !== 'cobrada';
  const ps = PAYMENT_STATUS[invoice?.estado_cobro] || PAYMENT_STATUS.pendiente;
  const lastEmail = emailLogs[0];

  if (!invoice) return null;

  // ── TABS ────────────────────────────────────────────────────────────────────
  const TABS = [
    { id: 'general', label: 'General', icon: FileText },
    { id: 'mensajes', label: 'Mensajes', icon: MessageSquare, count: emailLogs.length },
    { id: 'historial', label: 'Historial', icon: History, count: timeline.length },
  ];

  return (
    <div className="flex flex-col h-full bg-card border-l border-border overflow-hidden">

      {/* ── Cabecera ─────────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-b border-border">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="w-4 h-4 text-primary flex-shrink-0" />
            <span className="text-sm font-semibold truncate">{invoice.numero_factura || 'Factura'}</span>
            <span className={cn("text-xs px-2 py-0.5 rounded-full border font-medium", ps.color)}>{ps.label}</span>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={onRefresh} className="p-1.5 rounded hover:bg-secondary text-muted-foreground" title="Recargar">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-1.5 rounded hover:bg-secondary text-muted-foreground">
                  <MoreVertical className="w-3.5 h-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="text-sm">
                <DropdownMenuItem onClick={() => onEdit?.(invoice)}>Editar factura</DropdownMenuItem>
                {invoice.archivo_url && (
                  <DropdownMenuItem asChild>
                    <a href={invoice.archivo_url} target="_blank" rel="noreferrer" className="flex items-center gap-2">
                      <Download className="w-3.5 h-3.5" /> Descargar PDF
                    </a>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={copyPortalLink}>Copiar enlace portal</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <button onClick={onClose} className="p-1.5 rounded hover:bg-secondary text-muted-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Resumen compacto */}
        <div className="px-4 pb-3">
          <div className="text-2xl font-bold text-foreground">{fmt(invoice.total_factura)}</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {invoice.cliente_nombre || 'Sin cliente'} · {fmtDate(invoice.fecha_emision)}
          </div>
          {overdue && (
            <div className="flex items-center gap-1.5 mt-1.5 text-xs text-red-600 font-medium">
              <AlertTriangle className="w-3.5 h-3.5" /> Vencida hace {Math.abs(days)} días
            </div>
          )}
          {!overdue && days !== null && days <= 7 && days > 0 && (
            <div className="flex items-center gap-1.5 mt-1.5 text-xs text-amber-600 font-medium">
              <Clock className="w-3.5 h-3.5" /> Vence en {days} días
            </div>
          )}
        </div>

        {/* Botón principal Enviar */}
        <div className="px-4 pb-3">
          <Button onClick={() => onSend?.(invoice)} className="w-full bg-primary hover:bg-primary/90 h-8 text-sm gap-2">
            <Send className="w-3.5 h-3.5" /> Enviar factura
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex border-t border-border">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn("flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors border-b-2",
                tab === t.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground')}>
              <t.icon className="w-3 h-3" />
              {t.label}
              {t.count > 0 && <span className="text-[10px] bg-primary/10 text-primary px-1 rounded-full">{t.count}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* ── Contenido scrollable ─────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">

        {/* ━━━━━ TAB GENERAL ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {tab === 'general' && (
          <div>

            {/* Datos generales */}
            <Section title="Información" icon={FileText}>
              <InfoRow label="Nº Factura" value={invoice.numero_factura} valueClass="font-mono font-semibold text-foreground" />
              <InfoRow label="Cliente" value={invoice.cliente_nombre} />
              <InfoRow label="NIF / CIF" value={invoice.cliente_nif} />
              <InfoRow label="Emisión" value={fmtDate(invoice.fecha_emision)} />
              <InfoRow label="Vencimiento" value={fmtDate(invoice.fecha_vencimiento)} valueClass={overdue ? 'text-red-600 font-semibold' : 'text-foreground font-medium'} />
              <InfoRow label="Concepto" value={invoice.concepto} />
              <InfoRow label="Tipo" value={invoice.tipo === 'emitida' ? 'Factura emitida' : 'Factura recibida'} />
            </Section>

            {/* Importes */}
            <Section title="Importes" icon={CreditCard}>
              <InfoRow label="Base imponible" value={fmt(invoice.base_imponible)} />
              <InfoRow label={`IVA (${invoice.tipo_iva || 21}%)`} value={fmt(invoice.cuota_iva)} />
              {invoice.retencion_irpf > 0 && <InfoRow label="Retención IRPF" value={`−${fmt(invoice.retencion_irpf)}`} valueClass="text-red-600" />}
              <div className="flex items-center justify-between py-2 mt-1 bg-secondary/50 rounded-lg px-2">
                <span className="text-sm font-semibold text-foreground">Total factura</span>
                <span className="text-sm font-bold text-foreground">{fmt(invoice.total_factura)}</span>
              </div>
            </Section>

            {/* Pagos */}
            <Section title="Cobro y pagos" icon={CheckCircle2}>
              <div className="space-y-2 mb-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Estado cobro</span>
                  <span className={cn("text-xs px-2 py-0.5 rounded-full border font-medium", ps.color)}>{ps.label}</span>
                </div>
                {invoice.estado_cobro !== 'cobrada' && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Pendiente</span>
                    <span className="text-sm font-bold text-foreground">{fmt(invoice.total_factura)}</span>
                  </div>
                )}
                {invoice.metodo_pago && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Método de pago</span>
                    <span className="text-xs font-medium text-foreground capitalize">{invoice.metodo_pago}</span>
                  </div>
                )}
                {invoice.iban && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">IBAN</span>
                    <span className="text-xs font-mono text-foreground">{invoice.iban.replace(/(.{4})/g, '$1 ').trim().replace(/(\S+ \S+) .+/, '$1 ··· ').slice(0, 20)}</span>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button className="flex-1 text-xs border border-border rounded-lg py-1.5 hover:bg-secondary transition-colors text-foreground font-medium">
                  + Añadir pago
                </button>
                <button className="flex-1 text-xs border border-border rounded-lg py-1.5 hover:bg-secondary transition-colors text-foreground font-medium">
                  Conciliar
                </button>
              </div>
              {overdue && (
                <button onClick={() => onSend?.(invoice, 'recordatorio')}
                  className="w-full mt-2 text-xs border border-amber-200 bg-amber-50 text-amber-700 rounded-lg py-1.5 hover:bg-amber-100 transition-colors font-medium">
                  Enviar recordatorio de vencimiento
                </button>
              )}
            </Section>

            {/* Emails enviados (resumen) */}
            <Section title="Envíos por email" icon={Mail}>
              {lastEmail ? (
                <div className="space-y-2">
                  <div className="bg-secondary/50 rounded-lg p-2.5 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-foreground truncate">{lastEmail.to}</span>
                      <span className={cn("text-xs font-medium", SEND_STATUS[lastEmail.delivery_status]?.color || 'text-slate-500')}>
                        {SEND_STATUS[lastEmail.delivery_status]?.label || lastEmail.delivery_status}
                      </span>
                    </div>
                    <div className="text-[10px] text-muted-foreground">{fmtDateTime(lastEmail.sent_at)}</div>
                    {lastEmail.opened_at && (
                      <div className="flex items-center gap-1 text-[10px] text-emerald-600">
                        <Eye className="w-3 h-3" /> Abierta el {fmtDateTime(lastEmail.opened_at)}
                      </div>
                    )}
                  </div>
                  {emailLogs.length > 1 && (
                    <button onClick={() => setTab('mensajes')} className="text-xs text-primary hover:underline">
                      Ver todos los envíos ({emailLogs.length}) →
                    </button>
                  )}
                </div>
              ) : (
                <div className="text-center py-3">
                  <Mail className="w-6 h-6 text-muted-foreground mx-auto mb-1 opacity-40" />
                  <p className="text-xs text-muted-foreground">Todavía no se ha enviado esta factura por email.</p>
                </div>
              )}
              <button onClick={() => onSend?.(invoice)}
                className="w-full mt-2 text-xs border border-primary/30 text-primary rounded-lg py-1.5 hover:bg-primary/5 transition-colors font-medium">
                Enviar vía email
              </button>
            </Section>

            {/* Categorización */}
            <Section title="Categorización" icon={Tag} defaultOpen={false}>
              <InfoRow label="Estado contable" value={invoice.estado_contable} />
              <InfoRow label="Trimestre" value={invoice.trimestre} />
              <InfoRow label="Año" value={invoice.anio} />
              {invoice.cuenta_contable && <InfoRow label="Cuenta contable" value={invoice.cuenta_contable} valueClass="font-mono text-foreground" />}
              {invoice.categoria && <InfoRow label="Categoría" value={invoice.categoria} />}
            </Section>

            {/* Archivos */}
            <Section title="Archivos adjuntos" icon={Paperclip} defaultOpen={false}>
              {invoice.archivo_url ? (
                <div className="flex items-center gap-2 p-2 bg-secondary/50 rounded-lg mb-2">
                  <FileText className="w-4 h-4 text-primary flex-shrink-0" />
                  <span className="text-xs flex-1 truncate text-foreground font-medium">PDF Factura</span>
                  <a href={invoice.archivo_url} target="_blank" rel="noreferrer"
                    className="p-1 hover:bg-secondary rounded text-muted-foreground hover:text-foreground">
                    <Download className="w-3.5 h-3.5" />
                  </a>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground mb-2">Sin PDF generado.</p>
              )}
              <div className="border-2 border-dashed border-border rounded-lg p-3 text-center hover:bg-secondary/30 cursor-pointer transition-colors">
                <p className="text-xs text-muted-foreground">Haz clic o arrastra un archivo</p>
              </div>
            </Section>

            {/* Asiento contable */}
            <Section title="Asiento contable" icon={BookOpen} defaultOpen={false}>
              {invoice.estado_contable === 'contabilizada' ? (
                <div>
                  <table className="w-full text-xs mb-2">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-1 text-muted-foreground font-medium">Cuenta</th>
                        <th className="text-right py-1 text-muted-foreground font-medium">Debe</th>
                        <th className="text-right py-1 text-muted-foreground font-medium">Haber</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-border/50">
                        <td className="py-1 font-mono">430 · Clientes</td>
                        <td className="py-1 text-right">{fmt(invoice.total_factura)}</td>
                        <td className="py-1 text-right">—</td>
                      </tr>
                      <tr className="border-b border-border/50">
                        <td className="py-1 font-mono">700 · Ventas</td>
                        <td className="py-1 text-right">—</td>
                        <td className="py-1 text-right">{fmt(invoice.base_imponible)}</td>
                      </tr>
                      {invoice.cuota_iva > 0 && (
                        <tr className="border-b border-border/50">
                          <td className="py-1 font-mono">477 · IVA Repercutido</td>
                          <td className="py-1 text-right">—</td>
                          <td className="py-1 text-right">{fmt(invoice.cuota_iva)}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                  <p className="text-[10px] text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Asiento cuadrado
                  </p>
                </div>
              ) : (
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700">Asiento pendiente de validar. Marca la factura como contabilizada para generar el asiento.</p>
                </div>
              )}
            </Section>

            {/* Enlace portal cliente */}
            <Section title="Portal cliente" icon={Link} defaultOpen={false}>
              <div className="space-y-2">
                <div className="flex items-center gap-2 p-2.5 bg-secondary/50 rounded-lg">
                  <ExternalLink className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="text-xs text-muted-foreground flex-1 truncate font-mono">
                    {`/portal/invoice/${invoice.id}`}
                  </span>
                </div>
                <button onClick={copyPortalLink}
                  className={cn("w-full text-xs font-medium rounded-lg py-1.5 border transition-colors",
                    copied ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'border-border hover:bg-secondary text-foreground')}>
                  {copied ? '✓ Enlace copiado' : (
                    <span className="flex items-center justify-center gap-1.5"><Copy className="w-3.5 h-3.5" /> Copiar enlace del documento</span>
                  )}
                </button>
              </div>
            </Section>
          </div>
        )}

        {/* ━━━━━ TAB MENSAJES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {tab === 'mensajes' && (
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Envíos registrados</p>
              <button onClick={() => onSend?.(invoice)}
                className="text-xs text-primary hover:underline flex items-center gap-1">
                <Send className="w-3 h-3" /> Enviar
              </button>
            </div>

            {loadingLogs ? (
              <div className="flex justify-center py-6">
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : emailLogs.length === 0 ? (
              <div className="text-center py-10">
                <Mail className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-30" />
                <p className="text-sm text-muted-foreground font-medium">Todavía no se ha enviado esta factura por email.</p>
                <button onClick={() => onSend?.(invoice)} className="mt-3 text-xs text-primary hover:underline">
                  Enviar ahora →
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {emailLogs.map((log, i) => {
                  const ss = SEND_STATUS[log.delivery_status] || SEND_STATUS.pendiente;
                  const StatusIcon = ss.icon;
                  return (
                    <div key={log.id || i} className="border border-border rounded-xl p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-foreground truncate">{log.to}</p>
                          {log.subject && <p className="text-[10px] text-muted-foreground truncate mt-0.5">{log.subject}</p>}
                        </div>
                        <span className={cn("flex items-center gap-1 text-[10px] font-medium flex-shrink-0", ss.color)}>
                          <StatusIcon className="w-3 h-3" /> {ss.label}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>{fmtDateTime(log.sent_at)}</span>
                        {log.sent_by && <span>por {log.sent_by}</span>}
                      </div>
                      {log.opened_at && (
                        <div className="flex items-center gap-1 text-[10px] text-emerald-600">
                          <Eye className="w-3 h-3" /> Abierta el {fmtDateTime(log.opened_at)}
                        </div>
                      )}
                      {log.error_message && (
                        <div className="text-[10px] text-red-600 bg-red-50 rounded px-2 py-1">{log.error_message}</div>
                      )}
                      <div className="flex gap-2 pt-1">
                        <button onClick={() => onSend?.(invoice, 'reenvio', log)}
                          className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1">
                          <RotateCcw className="w-3 h-3" /> Reenviar
                        </button>
                        {log.body && (
                          <button className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1">
                            <Eye className="w-3 h-3" /> Ver mensaje
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ━━━━━ TAB HISTORIAL ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {tab === 'historial' && (
          <div className="p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Línea temporal</p>
            {timeline.length === 0 ? (
              <div className="text-center py-10">
                <History className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-30" />
                <p className="text-sm text-muted-foreground">Sin eventos registrados.</p>
              </div>
            ) : (
              <div className="relative">
                <div className="absolute left-3 top-0 bottom-0 w-px bg-border" />
                <div className="space-y-3 pl-7">
                  {timeline.map((ev, i) => (
                    <div key={ev.id || i} className="relative">
                      <div className="absolute -left-7 w-5 h-5 rounded-full bg-card border-2 border-border flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-primary/60" />
                      </div>
                      <div className="pb-1">
                        <p className="text-xs font-medium text-foreground">{ev.event_label}</p>
                        {ev.event_detail && <p className="text-[10px] text-muted-foreground mt-0.5">{ev.event_detail}</p>}
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-muted-foreground">{fmtDateTime(ev.created_at)}</span>
                          {ev.created_by && <span className="text-[10px] text-muted-foreground">· {ev.created_by}</span>}
                          {ev.origin && (
                            <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded text-muted-foreground capitalize">{ev.origin}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}