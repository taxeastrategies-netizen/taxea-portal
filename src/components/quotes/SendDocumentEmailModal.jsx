/**
 * SendDocumentEmailModal — Envío de presupuestos y proformas por email
 */
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { cn } from '@/lib/utils';
import { X, Send, ChevronDown, Loader2, CheckCircle2, AlertTriangle, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent } from '@/components/ui/dialog';

const isValidEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

function EmailChip({ email, onRemove }) {
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
      isValidEmail(email) ? 'bg-primary/10 text-primary' : 'bg-red-100 text-red-700')}>
      {email}
      <button onClick={() => onRemove(email)}><X className="w-3 h-3" /></button>
    </span>
  );
}

function EmailInput({ label, chips, onAdd, onRemove, placeholder }) {
  const [val, setVal] = useState('');
  const commit = () => {
    const e = val.trim().replace(/,/g, '');
    if (e && !chips.includes(e)) onAdd(e);
    setVal('');
  };
  return (
    <div>
      <label className="block text-xs font-semibold text-muted-foreground mb-1">{label}</label>
      <div className="min-h-[38px] flex flex-wrap gap-1 items-center px-3 py-1.5 border border-input rounded-lg bg-background focus-within:ring-2 focus-within:ring-ring/30">
        {chips.map(e => <EmailChip key={e} email={e} onRemove={onRemove} />)}
        <input value={val} onChange={e => setVal(e.target.value)}
          onKeyDown={e => { if (['Enter',',','Tab'].includes(e.key)) { e.preventDefault(); commit(); } }}
          onBlur={commit}
          placeholder={chips.length === 0 ? placeholder : ''}
          className="flex-1 min-w-32 text-sm outline-none bg-transparent" />
      </div>
    </div>
  );
}

const buildSubject = (doc, docType, company) => {
  const label = docType === 'quote' ? 'Presupuesto' : 'Proforma';
  const num = docType === 'quote' ? doc?.numero_presupuesto : doc?.numero_proforma;
  const emisor = company?.nombre || 'Empresa';
  return `${label} ${num} - ${emisor}`;
};

const buildEmailBody = (doc, docType, company) => {
  const label = docType === 'quote' ? 'presupuesto' : 'proforma';
  const num = docType === 'quote' ? doc?.numero_presupuesto : doc?.numero_proforma;
  const total = doc?.total ? doc.total.toLocaleString('es-ES', { minimumFractionDigits: 2 }) + ' €' : '—';
  const emisor = company?.nombre || 'Empresa';
  const brandColor = '#b91c1c';

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/></head><body style="margin:0;padding:0;background:#f8f8f8;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px;">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.08);">
<tr><td style="background:${brandColor};padding:28px 32px;">
<p style="margin:0;font-size:22px;font-weight:700;color:#fff;letter-spacing:-0.3px;">${emisor}</p>
<p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,0.8);">Portal Fiscal y Financiero</p>
</td></tr>
<tr><td style="padding:32px;">
<p style="font-size:16px;font-weight:600;color:#1e293b;margin:0 0 8px;">Hola,</p>
<p style="font-size:14px;color:#475569;line-height:1.6;margin:0 0 24px;">Te adjuntamos el ${label} <strong>${num}</strong> para tu revisión.</p>
<table width="100%" cellpadding="12" cellspacing="0" style="background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:24px;">
<tr><td style="font-size:12px;color:#64748b;">Documento</td><td style="font-size:13px;font-weight:600;color:#1e293b;text-align:right;">${num}</td></tr>
<tr><td style="font-size:12px;color:#64748b;border-top:1px solid #e2e8f0;">Total</td><td style="font-size:14px;font-weight:700;color:${brandColor};text-align:right;border-top:1px solid #e2e8f0;">${total}</td></tr>
</table>
<p style="font-size:13px;color:#64748b;line-height:1.6;margin:0 0 8px;">Si tienes alguna pregunta o necesitas alguna modificación, no dudes en contactarnos.</p>
<p style="font-size:13px;color:#64748b;margin:0;">Un saludo,<br/><strong style="color:#1e293b;">${emisor}</strong></p>
</td></tr>
<tr><td style="padding:16px 32px;border-top:1px solid #f1f5f9;">
<p style="font-size:11px;color:#94a3b8;margin:0;text-align:center;">Documento gestionado con Taxea · Portal financiero y fiscal</p>
</td></tr>
</table></td></tr></table></body></html>`;
};

export default function SendDocumentEmailModal({ open, onOpenChange, doc, docType, company, user, onSent }) {
  const [to, setTo] = useState([]);
  const [cc, setCc] = useState([]);
  const [showCc, setShowCc] = useState(false);
  const [subject, setSubject] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [noEmailWarning, setNoEmailWarning] = useState(false);

  useEffect(() => {
    if (!open || !doc) return;
    setSent(false); setError('');
    setSubject(buildSubject(doc, docType, company));
    loadClientEmail();
  }, [open, doc?.id]);

  const loadClientEmail = async () => {
    if (!doc?.cliente_nombre || !company?.id) { setNoEmailWarning(true); return; }
    try {
      const contacts = await base44.entities.Contact.filter({ company_id: company.id }, '-created_date', 50);
      const match = contacts.find(c =>
        c.nombre?.toLowerCase().includes(doc.cliente_nombre.toLowerCase()) ||
        doc.cliente_nombre.toLowerCase().includes(c.nombre?.toLowerCase() || '')
      );
      if (match?.email_facturacion || match?.email) {
        setTo([match.email_facturacion || match.email]);
        setNoEmailWarning(false);
      } else {
        setTo([]);
        setNoEmailWarning(true);
      }
    } catch {
      setNoEmailWarning(true);
    }
  };

  const handleSend = async () => {
    setError('');
    if (to.length === 0) { setError('Añade al menos un destinatario.'); return; }
    const invalid = to.filter(e => !isValidEmail(e));
    if (invalid.length > 0) { setError(`Email inválido: ${invalid.join(', ')}`); return; }

    setSending(true);
    try {
      const senderName = user?.full_name || company?.nombre || 'Taxea Portal';
      const emailRes = await base44.functions.invoke('sendEmail', {
        to: to,
        cc: cc.length > 0 ? cc : undefined,
        from_name: senderName,
        subject,
        html: buildEmailBody(doc, docType, company),
      });
      if (!emailRes.data?.ok) throw new Error(emailRes.data?.error || 'Error al enviar');

      // Actualizar estado a enviado
      const entityName = docType === 'quote' ? 'Quote' : 'Proforma';
      const estadoEnviado = docType === 'quote' ? 'enviado' : 'enviada';
      if (doc.estado === 'borrador') {
        await base44.entities[entityName].update(doc.id, { estado: estadoEnviado });
      }

      setSent(true);
      onSent?.();
    } catch (e) {
      setError('No se pudo enviar el email. Inténtalo de nuevo.');
    }
    setSending(false);
  };

  const label = docType === 'quote' ? 'Presupuesto' : 'Proforma';
  const num = docType === 'quote' ? doc?.numero_presupuesto : doc?.numero_proforma;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-foreground">Enviar {label}</h2>
            {doc && <p className="text-xs text-muted-foreground mt-0.5">{doc.cliente_nombre || '—'} · {num}</p>}
          </div>
        </div>

        {sent ? (
          <div className="flex flex-col items-center justify-center p-8 text-center flex-1">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-3" />
            <h3 className="text-base font-semibold mb-1">Enviado correctamente</h3>
            <p className="text-sm text-muted-foreground mb-4">Email enviado a {to.join(', ')}</p>
            <Button onClick={() => onOpenChange(false)}>Cerrar</Button>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {noEmailWarning && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">No hay email guardado para este cliente. Escribe el destinatario manualmente.</p>
              </div>
            )}

            <EmailInput label="Para *" chips={to} onAdd={e => setTo(p => [...p, e])} onRemove={e => setTo(p => p.filter(x => x !== e))} placeholder="email@cliente.com" />

            <button onClick={() => setShowCc(!showCc)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 -mt-2">
              <ChevronDown className={cn("w-3 h-3 transition-transform", showCc && "rotate-180")} />
              {showCc ? 'Ocultar CC' : 'Añadir CC'}
            </button>
            {showCc && (
              <EmailInput label="CC" chips={cc} onAdd={e => setCc(p => [...p, e])} onRemove={e => setCc(p => p.filter(x => x !== e))} placeholder="copia@empresa.com" />
            )}

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">Asunto *</label>
              <Input value={subject} onChange={e => setSubject(e.target.value)} className="h-9" />
            </div>

            <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-lg px-3 py-2.5">
              <Mail className="w-3.5 h-3.5 text-primary flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-foreground">Email con diseño HTML</p>
                <p className="text-[10px] text-muted-foreground">Logo · Datos del documento · Importe total</p>
              </div>
            </div>

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
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending} className="h-8 text-sm">Cancelar</Button>
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