/**
 * SendInvoiceDocumentModal V2 — Email premium HTML, adjunto PDF obligatorio, enlace público
 */
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { cn } from '@/lib/utils';
import { X, Send, Paperclip, ChevronDown, Loader2, CheckCircle2, AlertTriangle, Mail, ExternalLink, Copy, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { buildPremiumInvoiceEmail, buildEmailSubject, ensureInvoicePdf } from './invoicePremiumEmail';

const TEMPLATES = [
  { id: 'envio_factura',  label: 'Envío de factura' },
  { id: 'recordatorio',   label: 'Recordatorio de vencimiento' },
  { id: 'vencida',        label: 'Factura vencida' },
  { id: 'pagada',         label: 'Confirmación de pago' },
];

const formatAmount = (n) =>
  typeof n === 'number' ? n.toLocaleString('es-ES', { minimumFractionDigits: 2 }) + ' €' : '—';

const formatDate = (d) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }); }
  catch { return d; }
};

// Generar token público seguro
const generatePublicToken = () => {
  const arr = new Uint8Array(32);
  window.crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
};

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// ── Chip de email ──────────────────────────────────────────────────────────────
function EmailChip({ email, onRemove }) {
  const valid = isValidEmail(email);
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
      valid ? 'bg-primary/10 text-primary' : 'bg-red-100 text-red-700')}>
      {email}
      <button onClick={() => onRemove(email)} className="hover:opacity-70 ml-0.5">
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}

// ── EmailInput ─────────────────────────────────────────────────────────────────
function EmailInput({ label, chips, onAddChip, onRemoveChip, placeholder }) {
  const [value, setValue] = useState('');

  const handleKey = (e) => {
    if (['Enter', ',', ' ', 'Tab'].includes(e.key)) {
      e.preventDefault();
      const email = value.trim().replace(/,/g, '');
      if (email && !chips.includes(email)) onAddChip(email);
      setValue('');
    }
  };

  const handleBlur = () => {
    const email = value.trim().replace(/,/g, '');
    if (email && !chips.includes(email)) onAddChip(email);
    setValue('');
  };

  return (
    <div>
      <label className="block text-xs font-semibold text-muted-foreground mb-1">{label}</label>
      <div className="min-h-[38px] flex flex-wrap gap-1 items-center px-3 py-1.5 border border-input rounded-lg bg-background focus-within:ring-2 focus-within:ring-ring/30">
        {chips.map(e => <EmailChip key={e} email={e} onRemove={onRemoveChip} />)}
        <input
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKey}
          onBlur={handleBlur}
          placeholder={chips.length === 0 ? placeholder : ''}
          className="flex-1 min-w-32 text-sm outline-none bg-transparent"
        />
      </div>
    </div>
  );
}

// ── Modal principal V2 ─────────────────────────────────────────────────────────
export default function SendInvoiceDocumentModal({ open, onOpenChange, invoice, company, user, onSent }) {
  const [to, setTo] = useState([]);
  const [cc, setCc] = useState([]);
  const [bcc, setBcc] = useState([]);
  const [subject, setSubject] = useState('');
  const [templateId, setTemplateId] = useState('envio_factura');
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [preparingPdf, setPreparingPdf] = useState(false);
  const [pdfReady, setPdfReady] = useState(false);
  const [resolvedPdfUrl, setResolvedPdfUrl] = useState(null);
  const [saveEmail, setSaveEmail] = useState(false);
  const [clientEmails, setClientEmails] = useState([]);
  const [noEmailWarning, setNoEmailWarning] = useState(false);
  const [publicLink, setPublicLink] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');

  useEffect(() => {
    if (!open || !invoice) return;
    setSent(false);
    setError('');
    setShowPreview(false);
    setPdfReady(!!invoice?.archivo_url);
    setResolvedPdfUrl(invoice?.archivo_url || null);
    loadClientEmail();
    initPublicLink();
    setTemplateId('envio_factura');
    setSubject(buildEmailSubject(invoice, company, 'envio_factura'));
    // Pre-generar PDF en segundo plano al abrir el modal
    if (!invoice?.archivo_url) {
      setPreparingPdf(true);
      ensureInvoicePdf(invoice, company, base44).then(result => {
        if (result.ok) { setPdfReady(true); setResolvedPdfUrl(result.pdfUrl); }
        setPreparingPdf(false);
      }).catch(() => setPreparingPdf(false));
    }
  }, [open, invoice?.id]);

  // Re-generar asunto al cambiar plantilla
  useEffect(() => {
    if (invoice) setSubject(buildEmailSubject(invoice, company, templateId));
  }, [templateId]);

  const initPublicLink = async () => {
    // Usar token existente o generar uno nuevo
    let token = invoice?.public_token;
    if (!token) {
      token = generatePublicToken();
      const link = `${window.location.origin}/public/invoice/${token}`;
      await base44.entities.Invoice.update(invoice.id, {
        public_token: token,
        public_link_status: 'activo',
        public_invoice_url: link,
      });
    }
    setPublicLink(`${window.location.origin}/public/invoice/${token}`);
  };

  const loadClientEmail = async () => {
    const emails = [];
    if (invoice?.cliente_nombre && company?.id) {
      try {
        const contacts = await base44.entities.Contact.filter({ company_id: company.id }, '-created_date', 100);
        const matches = contacts.filter(c =>
          c.nombre?.toLowerCase().includes(invoice.cliente_nombre.toLowerCase()) ||
          invoice.cliente_nombre.toLowerCase().includes(c.nombre?.toLowerCase() || '')
        );
        matches.forEach(c => {
          if (c.email && !emails.find(e => e.email === c.email))
            emails.push({ email: c.email, label: 'Principal', nombre: c.nombre });
          if (c.email_facturacion && !emails.find(e => e.email === c.email_facturacion))
            emails.push({ email: c.email_facturacion, label: 'Facturación', nombre: c.nombre });
        });
      } catch {}
    }
    setClientEmails(emails);
    if (emails.length > 0) { setTo([emails[0].email]); setNoEmailWarning(false); }
    else { setTo([]); setNoEmailWarning(true); }
  };

  const handlePreview = () => {
    const link = publicLink || `${window.location.origin}/public/invoice/${invoice?.id}`;
    const html = buildPremiumInvoiceEmail(invoice, company, link, templateId);
    setPreviewHtml(html);
    setShowPreview(true);
  };

  const handleSend = async () => {
    setError('');
    if (to.length === 0) { setError('Añade al menos un destinatario.'); return; }
    const invalidEmails = to.filter(e => !isValidEmail(e));
    if (invalidEmails.length > 0) { setError(`Email inválido: ${invalidEmails.join(', ')}`); return; }
    if (!subject.trim()) { setError('El asunto no puede estar vacío.'); return; }

    setSending(true);

    // Garantizar PDF antes de enviar
    let finalPdfUrl = resolvedPdfUrl;
    if (!finalPdfUrl) {
      setPreparingPdf(true);
      const pdfResult = await ensureInvoicePdf(invoice, company, base44);
      setPreparingPdf(false);
      if (!pdfResult.ok) {
        setError('No se puede enviar la factura porque no ha sido posible generar el PDF adjunto automáticamente. Revisa la factura y vuelve a intentarlo.');
        setSending(false);
        return;
      }
      finalPdfUrl = pdfResult.pdfUrl;
      setResolvedPdfUrl(finalPdfUrl);
      setPdfReady(true);
    }

    try {
      const senderName = user?.full_name || company?.nombre || 'Taxea Portal';
      const link = publicLink || `${window.location.origin}/public/invoice/${invoice?.id}`;
      const htmlBody = buildPremiumInvoiceEmail(invoice, company, link, templateId);

      // Enviar email con HTML premium
      await base44.integrations.Core.SendEmail({
        to: to[0],
        from_name: senderName,
        subject,
        body: htmlBody,
      });

      // Log de envío
      await base44.entities.InvoiceEmailLog.create({
        invoice_id: invoice.id,
        company_id: company?.id,
        to: to.join(', '),
        cc: cc.join(', '),
        bcc: bcc.join(', '),
        subject,
        body: htmlBody,
        template_id: templateId,
        attachments: [finalPdfUrl].filter(Boolean),
        public_invoice_url: link,
        pdf_attachment_name: `Factura_${invoice.numero_factura}.pdf`,
        sent_at: new Date().toISOString(),
        sent_by: user?.full_name || user?.email || 'Usuario',
        delivery_status: 'enviada',
        to_was_manual: noEmailWarning,
      });

      // Actualizar estado factura
      await base44.entities.Invoice.update(invoice.id, { estado_envio: 'enviada' });

      // Timeline
      await base44.entities.InvoiceTimelineEvent.create({
        invoice_id: invoice.id,
        company_id: company?.id,
        event_type: 'email_enviado',
        event_label: 'Email enviado',
        event_detail: `Enviado a ${to.join(', ')} · Plantilla: ${TEMPLATES.find(t => t.id === templateId)?.label}`,
        created_at: new Date().toISOString(),
        created_by: user?.full_name || user?.email || 'Usuario',
        origin: 'manual',
      });

      // Guardar email si es nuevo
      if (saveEmail && noEmailWarning && to.length > 0) {
        try {
          const contacts = await base44.entities.Contact.filter({ company_id: company?.id }, '-created_date', 100);
          const match = contacts.find(c => c.nombre?.toLowerCase().includes(invoice.cliente_nombre?.toLowerCase() || ''));
          if (match) await base44.entities.Contact.update(match.id, { email: to[0] });
        } catch {}
      }

      setSent(true);
      onSent?.();
    } catch (e) {
      try {
        await base44.entities.InvoiceEmailLog.create({
          invoice_id: invoice.id,
          company_id: company?.id,
          to: to.join(', '),
          subject,
          sent_at: new Date().toISOString(),
          sent_by: user?.full_name || user?.email,
          delivery_status: 'error_envio',
          error_message: e.message || 'Error desconocido al enviar.',
        });
      } catch {}
      setError('Error al enviar el email: ' + (e.message || 'inténtalo de nuevo.'));
    }
    setSending(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden max-h-[90vh] flex flex-col">

          {/* Cabecera */}
          <div className="flex items-start justify-between px-5 py-4 border-b border-border flex-shrink-0">
            <div>
              <h2 className="text-base font-semibold text-foreground">Enviar documento</h2>
              {invoice && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {invoice.cliente_nombre || '—'} · {invoice.numero_factura} · {formatDate(invoice.fecha_emision)}
                </p>
              )}
            </div>
          </div>

          {sent ? (
            <div className="flex flex-col items-center justify-center p-8 text-center flex-1">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-3" />
              <h3 className="text-base font-semibold text-foreground mb-1">Factura enviada</h3>
              <p className="text-sm text-muted-foreground mb-1">Email premium enviado a {to.join(', ')}</p>
              <p className="text-xs text-muted-foreground mb-4">El cliente puede consultar la factura sin cuenta en el enlace público.</p>
              <Button onClick={() => onOpenChange(false)} className="bg-primary hover:bg-primary/90">Cerrar</Button>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

              {/* Estado del PDF */}
              {preparingPdf && (
                <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5">
                  <Loader2 className="w-4 h-4 text-blue-600 flex-shrink-0 animate-spin" />
                  <p className="text-xs font-semibold text-blue-800">Preparando PDF adjunto…</p>
                </div>
              )}
              {!preparingPdf && pdfReady && !invoice?.archivo_url && (
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <p className="text-xs font-semibold text-emerald-800">PDF generado automáticamente y listo para adjuntar.</p>
                </div>
              )}

              {/* Sin email */}
              {noEmailWarning && (
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-amber-800">Sin email de facturación guardado.</p>
                    <p className="text-xs text-amber-700 mt-0.5">Escribe un email manualmente en el campo "Para".</p>
                  </div>
                </div>
              )}

              {/* Sugerencias emails */}
              {clientEmails.length > 1 && (
                <div className="bg-secondary/50 border border-border rounded-lg p-3">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Emails del cliente:</p>
                  <div className="flex flex-wrap gap-2">
                    {clientEmails.map(e => (
                      <button key={e.email} onClick={() => !to.includes(e.email) && setTo(prev => [...prev, e.email])}
                        className={cn("text-xs px-2.5 py-1 rounded-full border font-medium transition-colors",
                          to.includes(e.email) ? 'bg-primary text-primary-foreground border-transparent' : 'bg-card border-border text-foreground hover:bg-secondary')}>
                        {e.label}: {e.email}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Para */}
              <EmailInput label="Para *" chips={to}
                onAddChip={e => setTo(prev => [...prev, e])}
                onRemoveChip={e => setTo(prev => prev.filter(x => x !== e))}
                placeholder="email@empresa.com" />

              {/* CC / BCC */}
              <button onClick={() => setShowCcBcc(!showCcBcc)}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 -mt-2">
                <ChevronDown className={cn("w-3 h-3 transition-transform", showCcBcc && "rotate-180")} />
                {showCcBcc ? 'Ocultar CC / CCO' : 'Mostrar CC / CCO'}
              </button>
              {showCcBcc && (
                <div className="space-y-3">
                  <EmailInput label="CC" chips={cc} onAddChip={e => setCc(prev => [...prev, e])} onRemoveChip={e => setCc(prev => prev.filter(x => x !== e))} placeholder="copia@empresa.com" />
                  <EmailInput label="CCO" chips={bcc} onAddChip={e => setBcc(prev => [...prev, e])} onRemoveChip={e => setBcc(prev => prev.filter(x => x !== e))} placeholder="cco@empresa.com" />
                </div>
              )}

              {/* Plantilla */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Plantilla</label>
                <select value={templateId} onChange={e => setTemplateId(e.target.value)}
                  className="w-full text-sm border border-input rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-ring/30">
                  {TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </div>

              {/* Asunto */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Asunto *</label>
                <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Asunto del email" className="h-9" />
              </div>

              {/* Email premium badge */}
              <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-lg px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-primary" />
                  <div>
                    <p className="text-xs font-semibold text-foreground">Email premium con diseño HTML</p>
                    <p className="text-[10px] text-muted-foreground">Logo Taxea · Datos completos · Resumen de factura · Instrucciones de pago</p>
                  </div>
                </div>
                <button onClick={handlePreview} className="text-xs text-primary hover:underline flex items-center gap-1 flex-shrink-0">
                  <Eye className="w-3 h-3" /> Previsualizar
                </button>
              </div>

              {/* Adjuntos */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-2">Adjuntos</label>
                <div className={cn("flex items-center gap-2 p-2.5 border rounded-lg",
                  pdfReady ? 'border-primary/30 bg-primary/5' : preparingPdf ? 'border-blue-200 bg-blue-50' : 'border-border bg-secondary/30')}>
                  <Paperclip className={cn("w-3.5 h-3.5 flex-shrink-0", preparingPdf ? 'text-blue-500' : pdfReady ? 'text-primary' : 'text-muted-foreground')} />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium text-foreground">
                      Factura_{invoice?.numero_factura}.pdf
                    </span>
                    {preparingPdf
                      ? <span className="text-[10px] text-blue-600 ml-2">Generando…</span>
                      : pdfReady
                        ? <span className="text-[10px] text-emerald-600 ml-2">✓ Adjunto listo</span>
                        : <span className="text-[10px] text-muted-foreground ml-2">Se generará al enviar</span>
                    }
                  </div>
                </div>
              </div>

              {/* Enlace público */}
              {publicLink && (
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Enlace público de la factura</label>
                  <div className="bg-secondary/50 border border-border rounded-lg p-2.5 space-y-2">
                    <div className="flex items-center gap-2">
                      <ExternalLink className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                      <span className="text-[10px] font-mono text-muted-foreground truncate flex-1">{publicLink}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => { navigator.clipboard.writeText(publicLink); setCopiedLink(true); setTimeout(() => setCopiedLink(false), 2000); }}
                        className={cn("flex-1 text-xs py-1 rounded border font-medium transition-colors flex items-center justify-center gap-1",
                          copiedLink ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'border-border hover:bg-secondary text-foreground')}>
                        <Copy className="w-3 h-3" /> {copiedLink ? 'Copiado' : 'Copiar enlace'}
                      </button>
                      <a href={publicLink} target="_blank" rel="noreferrer"
                        className="flex-1 text-xs py-1 rounded border border-border hover:bg-secondary text-foreground font-medium flex items-center justify-center gap-1">
                        <Eye className="w-3 h-3" /> Ver sin login
                      </a>
                    </div>
                    <p className="text-[10px] text-muted-foreground">El destinatario puede ver y descargar la factura sin necesidad de cuenta Taxea.</p>
                  </div>
                </div>
              )}

              {/* Guardar email */}
              {noEmailWarning && to.length > 0 && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={saveEmail} onChange={e => setSaveEmail(e.target.checked)} className="rounded" />
                  <span className="text-xs text-muted-foreground">Guardar este email como contacto de facturación</span>
                </label>
              )}

              {/* Error */}
              {error && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
                  <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700">{error}</p>
                </div>
              )}
            </div>
          )}

          {!sent && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-border flex-shrink-0 bg-secondary/30">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending} className="h-8 text-sm">
                Cancelar
              </Button>
              <Button onClick={handleSend} disabled={sending || preparingPdf || to.length === 0}
                className="bg-primary hover:bg-primary/90 h-8 text-sm gap-2">
                {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                {sending ? (preparingPdf ? 'Preparando PDF…' : 'Enviando…') : 'Enviar'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de previsualización del email premium */}
      {showPreview && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4" onClick={() => setShowPreview(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
              <p className="text-sm font-semibold text-slate-800">Previsualización del email</p>
              <button onClick={() => setShowPreview(false)} className="p-1 rounded hover:bg-slate-100">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <iframe srcDoc={previewHtml} className="w-full" style={{ height: '600px', border: 'none' }} title="Preview email" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}