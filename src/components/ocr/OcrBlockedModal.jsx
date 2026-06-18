import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Lock, TrendingUp, MessageSquare, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export default function OcrBlockedModal({ usage, billingAccountId, quotaPeriodId, onClose }) {
  const navigate = useNavigate();
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewMsg, setReviewMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const period = usage?.period;
  const limit = period?.currentPlanLimit + (period?.manualCredits || 0);
  const planInfo = usage?.planInfo;

  const handleRequestReview = async () => {
    if (!reviewMsg.trim()) return;
    setSending(true);
    try {
      await base44.entities.OcrReviewRequest.create({
        billingAccountId,
        quotaPeriodId,
        requestedByUserId: '',
        message: reviewMsg,
        status: 'Nueva',
      });
      await base44.entities.AdminNotification.create({
        type: 'discrepancia_stripe',
        title: 'Solicitud de revisión OCR',
        message: `Cliente solicita revisión de créditos OCR. Plan: ${planInfo?.displayName}, Trimestre: ${usage?.quarterKey}. Mensaje: ${reviewMsg}`,
        isRead: false,
      });
      setSent(true);
    } catch {}
    setSending(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center">
              <Lock className="w-5 h-5 text-red-600" />
            </div>
            <h2 className="font-jakarta font-bold text-lg">Límite OCR alcanzado</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <p className="text-sm text-muted-foreground mb-5">
            Has utilizado las <strong>{limit}</strong> facturas incluidas en tu plan para este trimestre ({usage?.quarterKey}).
            El procesamiento OCR está bloqueado hasta que amplíes tu plan o comience el siguiente trimestre.
          </p>

          {sent ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800 mb-4">
              Solicitud enviada. Taxea revisará tu caso y te responderá pronto.
            </div>
          ) : showReviewForm ? (
            <div className="mb-5 space-y-3">
              <label className="text-sm font-medium">Mensaje para Taxea</label>
              <textarea
                value={reviewMsg}
                onChange={e => setReviewMsg(e.target.value)}
                rows={3}
                placeholder="Explica brevemente tu situación..."
                className="w-full px-3 py-2 rounded-md border border-input bg-transparent text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setShowReviewForm(false)}>Cancelar</Button>
                <Button size="sm" disabled={!reviewMsg.trim() || sending} onClick={handleRequestReview}
                  className="bg-primary hover:bg-primary/90">
                  {sending ? 'Enviando...' : 'Enviar solicitud'}
                </Button>
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            {planInfo?.nextPlanCode && (
              <Button className="w-full bg-primary hover:bg-primary/90 gap-2"
                onClick={() => { onClose(); navigate('/suscripcion?action=upgrade'); }}>
                <TrendingUp className="w-4 h-4" />
                Ampliar al siguiente plan
              </Button>
            )}
            {!showReviewForm && !sent && (
              <Button variant="outline" className="w-full gap-2" onClick={() => setShowReviewForm(true)}>
                <MessageSquare className="w-4 h-4" />
                Solicitar revisión a Taxea
              </Button>
            )}
            <Button variant="ghost" className="w-full text-muted-foreground" onClick={onClose}>
              Volver
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}