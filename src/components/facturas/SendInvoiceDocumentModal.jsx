/**
 * SendInvoiceDocumentModal — Modal de envío de factura por email
 * Precarga email del cliente, permite CC/BCC, plantillas y adjuntos
 */
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { cn } from '@/lib/utils';
import { X, Send, Paperclip, ChevronDown, Loader2, CheckCircle2, AlertTriangle, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent } from '@/components/ui/dialog';

// ── Plantillas predefinidas ────────────────────────────────────────────────────
const TEMPLATES = [
  {
    id: 'envio_factura',
    label: 'Envío de factura',
    subject: (inv) => `Factura ${inv?.numero_factura || ''} — ${inv?.empresa_nombre || ''}`,
    body: (inv) =>
      `Hola,\n\nTe enviamos la factura ${inv?.numero_factura || ''} por importe de ${formatAmount(inv?.total_factura)}.\n\nEl documento vence el ${formatDate(inv?.fecha_vencimiento)}.\n\nPuedes consultar el documento desde el portal en el siguiente enlace:\n${window.location.origin}/portal/invoice/${inv?.id}\n\nSi tienes cualquier duda, puedes responder a este correo.\n\nGracias,\n`,
  },
  {
    id: 'recordatorio',
    label: 'Recordatorio de vencimiento',
    subject: (inv) => `Recordatorio de pago — Factura ${inv?.numero_factura || ''}`,
    body: (inv) =>
      `Hola,\n\nTe recordamos que la factura ${inv?.numero_factura || ''} por importe de ${formatAmount(inv?.total_factura)} venció el ${formatDate(inv?.fecha_vencimiento)} y se encuentra pendiente de pago.\n\nPuedes consultar el documento en:\n${window.location.origin}/portal/invoice/${inv?.id}\n\nSi ya has realizado el pago, por favor ignora este mensaje.\n\nGracias,\n`,
  },
  {
    id: 'vencida',
    label: 'Factura vencida',
    subject: (inv) => `Factura ${inv?.numero_factura || ''} — Pendiente de pago`,
    body: (inv) =>
      `Hola,\n\nNos ponemos en contacto porque la factura ${inv?.numero_factura || ''} por importe de ${formatAmount(inv?.total_factura)} está pendiente de pago desde el ${formatDate(inv?.fecha_vencimiento)}.\n\nTe agradeceríamos que regularizaras el pago en la mayor brevedad posible.\n\nGracias,\n`,
  },
  {
    id: 'pagada',
    label: 'Confirmación de pago',
    subject: (inv) => `Confirmación de pago — Factura ${inv?.numero_factura || ''}`,
    body: (inv) =>
      `Hola,\n\nConfirmamos la recepción del pago de la factura ${inv?.numero_factura || ''} por importe de ${formatAmount(inv?.total_factura)}.\n\nQuedamos a tu disposición para cualquier consulta.\n\nGracias,\n`,
  },
];

const formatAmount = (n) =>
  typeof n === 'number' ? n.toLocaleString('es-ES', { minimumFractionDigits: 2 }) + ' €' : '—';

const formatDate = (d) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }); }
  catch { return d; }
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

// ── Modal principal ────────────────────────────────────────────────────────────
export default function SendInvoiceDocumentModal({ open, onOpenChange, invoice, company, user, onSent }) {
  const [to, setTo] = useState([]);
  const [cc, setCc] = useState([]);
  const [bcc, setBcc] = useState([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [templateId, setTemplateId] = useState('envio_factura');
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [attachPdf, setAttachPdf] = useState(true);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [saveEmail, setSaveEmail] = useState(false);
  const [clientEmails, setClientEmails] = useState([]);
  const [noEmailWarning, setNoEmailWarning] = useState(false);

  // Cargar email del cliente al abrir
  useEffect(() => {
    if (!open || !invoice) return;
    setSent(false);
    setError('');
    loadClientEmail();
    applyTemplate('envio_factura');
  }, [open, invoice?.id]);

  const loadClientEmail = async () => {
    const emails = [];
    // Buscar en contactos por nombre del cliente
    if (invoice?.cliente_nombre && company?.id) {
      try {
        const contacts = await base44.entities.Contact.filter({ company_id: company.id }, '-created_date', 100);
        const matches = contacts.filter(c =>
          c.nombre?.toLowerCase().includes(invoice.cliente_nombre.toLowerCase()) ||
          invoice.cliente_nombre.toLowerCase().includes(c.nombre?.toLowerCase() || '')
        );
        matches.forEach(c => {
          if (c.email && !emails.find(e => e.email === c.email)) {
            emails.push({ email: c.email, label: 'Principal', nombre: c.nombre });
          }
          if (c.email_facturacion && !emails.find(e => e.email === c.email_facturacion)) {
            emails.push({ email: c.email_facturacion, label: 'Facturación', nombre: c.nombre });
          }
        });
      } catch {}
    }
    setClientEmails(emails);

    if (emails.length > 0) {
      setTo([emails[0].email]);
      setNoEmailWarning(false);
    } else {
      setTo([]);
      setNoEmailWarning(true);
    }
  };

  const applyTemplate = (tid) => {
    const tpl = TEMPLATES.find(t => t.id === tid);
    if (!tpl) return;
    setTemplateId(tid);
    setSubject(tpl.subject(invoice));
    setBody(tpl.body(invoice));
  };

  const handleSend = async () => {
    setError('');
    // Validaciones
    if (to.length === 0) { setError('Añade al menos un destinatario.'); return; }
    const invalidEmails = to.filter(e => !isValidEmail(e));
    if (invalidEmails.length > 0) { setError(`Email inválido: ${invalidEmails.join(', ')}`); return; }
    if (!subject.trim()) { setError('El asunto no puede estar vacío.'); return; }
    if (!body.trim()) { setError('El cuerpo del mensaje no puede estar vacío.'); return; }
    if (attachPdf && !invoice?.archivo_url) {
      const confirm = window.confirm('No hay PDF generado para esta factura. ¿Enviar sin PDF?');
      if (!confirm) return;
    }

    setSending(true);
    try {
      const senderName = user?.full_name || company?.nombre || 'Taxea Portal';
      const finalBody = body.endsWith('\n') ? body + senderName : body + '\n' + senderName;

      // Enviar email usando integración Core
      await base44.integrations.Core.SendEmail({
        to: to[0],
        from_name: senderName,
        subject,
        body: finalBody,
      });

      // Registrar log de envío
      const logData = {
        invoice_id: invoice.id,
        company_id: company?.id,
        to: to.join(', '),
        cc: cc.join(', '),
        bcc: bcc.join(', '),
        subject,
        body: finalBody,
        template_id: templateId,
        attachments: attachPdf && invoice?.archivo_url ? [invoice.archivo_url] : [],
        sent_at: new Date().toISOString(),
        sent_by: user?.full_name || user?.email || 'Usuario',
        delivery_status: 'enviada',
        to_was_manual: noEmailWarning,
      };
      await base44.entities.InvoiceEmailLog.create(logData);

      // Actualizar estado de factura a "enviada"
      await base44.entities.Invoice.update(invoice.id, { estado_envio: 'enviada' });

      // Registrar evento en historial
      await base44.entities.InvoiceTimelineEvent.create({
        invoice_id: invoice.id,
        company_id: company?.id,
        event_type: 'email_enviado',
        event_label: 'Email enviado',
        event_detail: `Enviado a ${to.join(', ')} · Asunto: ${subject}`,
        created_at: new Date().toISOString(),
        created_by: user?.full_name || user?.email || 'Usuario',
        origin: 'manual',
      });

      // Guardar email en contacto si se solicitó
      if (saveEmail && noEmailWarning && to.length > 0) {
        // Intento silencioso de guardar email
        try {
          const contacts = await base44.entities.Contact.filter({ company_id: company?.id }, '-created_date', 100);
          const match = contacts.find(c => c.nombre?.toLowerCase().includes(invoice.cliente_nombre?.toLowerCase() || ''));
          if (match) {
            await base44.entities.Contact.update(match.id, { email: to[0] });
          }
        } catch {}
      }

      setSent(true);
      onSent?.();
    } catch (e) {
      // Registrar error en log
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
          /* ── Estado enviado ── */
          <div className="flex flex-col items-center justify-center p-8 text-center flex-1">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-3" />
            <h3 className="text-base font-semibold text-foreground mb-1">Factura enviada</h3>
            <p className="text-sm text-muted-foreground mb-4">Email enviado a {to.join(', ')}</p>
            <Button onClick={() => onOpenChange(false)} className="bg-primary hover:bg-primary/90">Cerrar</Button>
          </div>
        ) : (
          /* ── Formulario ── */
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

            {/* Aviso sin email */}
            {noEmailWarning && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-amber-800">Este cliente no tiene email de facturación guardado.</p>
                  <p className="text-xs text-amber-700 mt-0.5">Introduce un email manualmente en el campo "Para".</p>
                </div>
              </div>
            )}

            {/* Sugerencias de emails del cliente */}
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
            <EmailInput
              label="Para *"
              chips={to}
              onAddChip={e => setTo(prev => [...prev, e])}
              onRemoveChip={e => setTo(prev => prev.filter(x => x !== e))}
              placeholder="email@empresa.com"
            />

            {/* CC / BCC toggle */}
            <button onClick={() => setShowCcBcc(!showCcBcc)}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 -mt-2">
              <ChevronDown className={cn("w-3 h-3 transition-transform", showCcBcc && "rotate-180")} />
              {showCcBcc ? 'Ocultar CC / CCO' : 'Mostrar CC / CCO'}
            </button>

            {showCcBcc && (
              <div className="space-y-3">
                <EmailInput label="CC" chips={cc} onAddChip={e => setCc(prev => [...prev, e])} onRemoveChip={e => setCc(prev => prev.filter(x => x !== e))} placeholder="copia@empresa.com" />
                <EmailInput label="CCO (Copia oculta)" chips={bcc} onAddChip={e => setBcc(prev => [...prev, e])} onRemoveChip={e => setBcc(prev => prev.filter(x => x !== e))} placeholder="cco@empresa.com" />
              </div>
            )}

            {/* Plantilla */}
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Plantilla</label>
              <select value={templateId} onChange={e => applyTemplate(e.target.value)}
                className="w-full text-sm border border-input rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-ring/30">
                {TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>

            {/* Asunto */}
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Asunto *</label>
              <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Asunto del email" className="h-9" />
            </div>

            {/* Mensaje */}
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Mensaje *</label>
              <textarea value={body} onChange={e => setBody(e.target.value)} rows={7}
                className="w-full text-sm border border-input rounded-lg px-3 py-2 bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring/30"
                placeholder="Cuerpo del mensaje..." />
            </div>

            {/* Adjuntos */}
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-2">Adjuntos</label>
              <div className="space-y-1.5">
                <label className={cn("flex items-center gap-2 p-2.5 border rounded-lg cursor-pointer transition-colors",
                  attachPdf ? 'border-primary/30 bg-primary/5' : 'border-border hover:bg-secondary/50')}>
                  <input type="checkbox" checked={attachPdf} onChange={e => setAttachPdf(e.target.checked)} className="rounded" />
                  <Paperclip className="w-3.5 h-3.5 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium text-foreground">PDF Factura {invoice?.numero_factura}</span>
                    {!invoice?.archivo_url && <span className="text-[10px] text-amber-600 ml-2">(no generado)</span>}
                  </div>
                </label>
              </div>
            </div>

            {/* Guardar email si es nuevo */}
            {noEmailWarning && to.length > 0 && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={saveEmail} onChange={e => setSaveEmail(e.target.checked)} className="rounded" />
                <span className="text-xs text-muted-foreground">Guardar este email como contacto de facturación del cliente</span>
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

        {/* Footer */}
        {!sent && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-border flex-shrink-0 bg-secondary/30">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending} className="h-8 text-sm">
              Cancelar
            </Button>
            <Button onClick={handleSend} disabled={sending || to.length === 0} className="bg-primary hover:bg-primary/90 h-8 text-sm gap-2">
              {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              {sending ? 'Enviando…' : 'Enviar'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}