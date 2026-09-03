import { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { AlertTriangle, Building2, CalendarDays, CheckCircle2, Loader2, Landmark } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent } from '@/components/ui/dialog';

const fmt = value => (Number(value) || 0).toLocaleString('es-ES', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}) + ' €';

const today = () => new Date().toISOString().slice(0, 10);

export default function InvoicePaymentReconciliationModal({ open, mode, invoice, company, onOpenChange, onChanged }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [outstanding, setOutstanding] = useState(0);
  const [paid, setPaid] = useState(0);
  const [payments, setPayments] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [selectedTransaction, setSelectedTransaction] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(today());
  const [method, setMethod] = useState('transferencia');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState('');

  const isReconciliation = mode === 'reconcile';
  const isCreditNote = Number(invoice?.total_factura) < 0;
  const expectedDirection = invoice?.tipo === 'recibida'
    ? (isCreditNote ? 'entradas' : 'salidas')
    : (isCreditNote ? 'salidas' : 'entradas');
  const counterparty = invoice?.tipo === 'recibida'
    ? invoice?.proveedor_nombre || invoice?.cliente_nombre || 'Proveedor'
    : invoice?.cliente_nombre || 'Cliente';

  const selected = useMemo(
    () => candidates.find(candidate => candidate.id === selectedTransaction),
    [candidates, selectedTransaction],
  );

  useEffect(() => {
    if (!open || !invoice?.id) return;
    setError('');
    setSuccess('');
    setSelectedTransaction('');
    setPaymentDate(today());
    setMethod('transferencia');
    setReference('');
    setNotes('');
    setIdempotencyKey(crypto.randomUUID());
    loadData();
  }, [open, mode, invoice?.id]);

  const invoke = async payload => {
    const response = await base44.functions.invoke('invoiceOperations', {
      invoice_id: invoice.id,
      company_id: company?.id,
      ...payload,
    });
    return response?.data || response;
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await invoke({ action: isReconciliation ? 'list_reconciliation_candidates' : 'list_payments' });
      if (!data?.ok) throw new Error(data?.error || 'No se pudo cargar la información.');
      setOutstanding(Number(data.outstanding) || 0);
      setPaid(Number(data.paid) || 0);
      setPayments(data.payments || []);
      setCandidates(data.candidates || []);
      setAmount(String(Number(data.outstanding) || 0));
    } catch (e) {
      setError(e?.response?.data?.error || e?.response?.data?.message || e.message || 'No se pudo cargar la información.');
    }
    setLoading(false);
  };

  const handleAddPayment = async () => {
    setError('');
    setSaving(true);
    try {
      const data = await invoke({
        action: 'add_payment',
        amount: Number(String(amount).replace(',', '.')),
        payment_date: paymentDate,
        method,
        reference,
        notes,
        idempotency_key: idempotencyKey,
      });
      if (!data?.ok) throw new Error(data?.error || 'No se pudo registrar el pago.');
      setOutstanding(Number(data.outstanding) || 0);
      setPaid(Number(data.paid) || 0);
      setPayments(data.payments || []);
      setSuccess(invoice.tipo === 'recibida' ? 'Pago registrado correctamente.' : 'Cobro registrado correctamente.');
      await onChanged?.();
    } catch (e) {
      setError(e?.response?.data?.error || e?.response?.data?.message || e.message || 'No se pudo registrar el pago.');
    }
    setSaving(false);
  };

  const handleReconcile = async () => {
    if (!selectedTransaction) return;
    setError('');
    setSaving(true);
    try {
      const data = await invoke({ action: 'reconcile', bank_transaction_id: selectedTransaction });
      if (!data?.ok) throw new Error(data?.error || 'No se pudo conciliar el movimiento.');
      setOutstanding(Number(data.outstanding) || 0);
      setPaid(Number(data.paid) || 0);
      setSuccess('Movimiento conciliado con la factura.');
      setCandidates(current => current.filter(candidate => candidate.id !== selectedTransaction));
      setSelectedTransaction('');
      await onChanged?.();
    } catch (e) {
      setError(e?.response?.data?.error || e?.response?.data?.message || e.message || 'No se pudo conciliar el movimiento.');
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 gap-0 overflow-hidden max-h-[88vh] flex flex-col">
        <div className="px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            {isReconciliation ? <Landmark className="w-4 h-4 text-primary" /> : <CheckCircle2 className="w-4 h-4 text-primary" />}
            <h2 className="text-base font-semibold">
              {isReconciliation ? 'Conciliar factura' : invoice?.tipo === 'recibida' ? 'Añadir pago' : 'Añadir cobro'}
            </h2>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {invoice?.numero_factura} · {counterparty}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 px-5 py-3 bg-secondary/30 border-b border-border">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Registrado</p>
            <p className="text-lg font-bold text-emerald-600">{fmt(paid)}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Pendiente</p>
            <p className="text-lg font-bold text-foreground">{fmt(outstanding)}</p>
          </div>
        </div>

        <div className="p-5 overflow-y-auto flex-1">
          {loading ? (
            <div className="py-12 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
          ) : isReconciliation ? (
            <div className="space-y-3">
              <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg p-3">
                <Building2 className="w-4 h-4 text-blue-600 mt-0.5" />
                <p className="text-xs text-blue-800">Solo se muestran movimientos reales de la empresa activa y del sentido correcto: {expectedDirection}.</p>
              </div>
              {candidates.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-border rounded-xl">
                  <Landmark className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm font-medium">No hay movimientos compatibles</p>
                  <p className="text-xs text-muted-foreground mt-1">Importa o sincroniza movimientos desde Finanzas y vuelve a intentarlo.</p>
                </div>
              ) : candidates.map(candidate => {
                const active = candidate.id === selectedTransaction;
                const exact = Math.abs(Number(candidate.importe) - outstanding) <= 0.01;
                return (
                  <button key={candidate.id} onClick={() => setSelectedTransaction(candidate.id)}
                    className={`w-full text-left border rounded-xl p-3 transition-colors ${active ? 'border-primary bg-primary/5 ring-2 ring-primary/10' : 'border-border hover:bg-secondary/40'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{candidate.concepto || 'Movimiento bancario'}</p>
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <CalendarDays className="w-3 h-3" /> {candidate.fecha_operacion}
                          {candidate.nombre_contraparte ? ` · ${candidate.nombre_contraparte}` : ''}
                        </p>
                        {candidate.referencia && <p className="text-[10px] text-muted-foreground mt-1 truncate">Ref. {candidate.referencia}</p>}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold">{fmt(candidate.importe)}</p>
                        {exact && <span className="text-[10px] text-emerald-600 font-semibold">Importe exacto</span>}
                      </div>
                    </div>
                  </button>
                );
              })}
              {selected && Number(selected.importe) > outstanding + 0.01 && (
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5" />
                  <p className="text-xs text-amber-800">Este movimiento supera el importe pendiente. Por seguridad no se conciliará hasta poder dividir movimientos desde Finanzas.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">Importe *</label>
                  <Input value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">Fecha *</label>
                  <Input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Método</label>
                <select value={method} onChange={e => setMethod(e.target.value)} className="w-full h-10 px-3 border border-input rounded-md bg-background text-sm">
                  <option value="transferencia">Transferencia</option>
                  <option value="tarjeta">Tarjeta</option>
                  <option value="efectivo">Efectivo</option>
                  <option value="domiciliacion">Domiciliación</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Referencia</label>
                <Input value={reference} onChange={e => setReference(e.target.value)} placeholder="Referencia bancaria o interna" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Notas</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm resize-none" />
              </div>
              {payments.length > 0 && (
                <div className="pt-3 border-t border-border">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Pagos registrados</p>
                  <div className="space-y-1.5">
                    {payments.slice(0, 5).map(payment => (
                      <div key={payment.id} className="flex justify-between text-xs bg-secondary/40 rounded-lg px-3 py-2">
                        <span>{payment.payment_date} · {payment.method}</span>
                        <span className="font-semibold">{fmt(payment.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {success && <div className="mt-4 flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg p-3 text-xs"><CheckCircle2 className="w-4 h-4" /> {success}</div>}
          {error && <div className="mt-4 flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-xs"><AlertTriangle className="w-4 h-4 mt-0.5" /> {error}</div>}
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-secondary/30">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
          {isReconciliation ? (
            <Button onClick={handleReconcile} disabled={saving || !selectedTransaction || (selected && Number(selected.importe) > outstanding + 0.01)}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Conciliar movimiento
            </Button>
          ) : (
            <Button onClick={handleAddPayment} disabled={saving || !amount || !paymentDate || outstanding <= 0.01}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Registrar
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

