import { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertCircle, CheckCircle, Loader2, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const fmt = value => Number(value || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const validCode = value => /^\d{8}$/.test(String(value || ''));

export default function AsientoProposalModal({ invoice, onClose, onConfirmed }) {
  const [lines, setLines] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [descripcion, setDescripcion] = useState(invoice.concepto || `Factura ${invoice.numero_factura}`);
  const [fecha, setFecha] = useState(invoice.fecha_emision || '');
  const [counterparty, setCounterparty] = useState(null);
  const [taxKind, setTaxKind] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      base44.functions.invoke('accountingOperations', {
        action: 'preview_invoice',
        companyId: invoice.company_id,
        invoiceId: invoice.id,
      }),
      base44.entities.AccountingAccount.filter({ companyId: invoice.company_id, status: 'activa' }, 'code', 5000),
    ]).then(([previewResponse, accountRows]) => {
      if (!active) return;
      const preview = previewResponse?.data || previewResponse;
      setLines((preview.lines || []).map(line => ({
        accountId: line.accountId,
        accountCode: line.accountCode,
        accountName: line.accountName,
        description: line.description,
        debit: Number(line.debit || 0),
        credit: Number(line.credit || 0),
        counterpartyAccountId: line.counterpartyAccountId,
        counterpartyAccountCode: line.counterpartyAccountCode,
        taxCode: line.taxCode,
        sourceLineType: line.sourceLineType,
      })));
      setCounterparty(preview.counterparty || null);
      setTaxKind(preview.taxKind || '');
      setAccounts(accountRows || []);
    }).catch(err => {
      if (active) setError(err?.response?.data?.error || err?.message || 'No se pudo generar la propuesta contable.');
    }).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [invoice.id, invoice.company_id]);

  const totals = useMemo(() => {
    const debit = lines.reduce((sum, line) => sum + Number(line.debit || 0), 0);
    const credit = lines.reduce((sum, line) => sum + Number(line.credit || 0), 0);
    return { debit, credit, balanced: Math.abs(debit - credit) < 0.005 && debit > 0 };
  }, [lines]);

  const updateLine = (index, field, value) => {
    setLines(previous => previous.map((line, position) => {
      if (position !== index) return line;
      const next = { ...line, [field]: value };
      if (field === 'accountCode') {
        const account = accounts.find(item => item.code === value);
        next.accountId = account?.id || '';
        next.accountName = account?.name || '';
      }
      if (field === 'debit' && Number(value) > 0) next.credit = 0;
      if (field === 'credit' && Number(value) > 0) next.debit = 0;
      return next;
    }));
  };

  const confirm = async () => {
    setError('');
    if (!fecha) return setError('La fecha del asiento es obligatoria.');
    if (!totals.balanced) return setError('El asiento debe estar cuadrado.');
    if (lines.some(line => !validCode(line.accountCode))) return setError('Todas las cuentas deben tener exactamente 8 dígitos.');
    if (lines.some(line => !accounts.some(account => account.code === line.accountCode))) {
      return setError('Todas las cuentas deben existir en el plan contable de la empresa.');
    }
    setSaving(true);
    try {
      await base44.functions.invoke('accountingOperations', {
        action: 'post_invoice',
        companyId: invoice.company_id,
        invoiceId: invoice.id,
        date: fecha,
        description: descripcion,
        lines,
      });
      onConfirmed();
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'No se pudo contabilizar la factura.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-jakarta">
            Revisar y contabilizar — {invoice.numero_factura}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-16 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Generando asiento y subcuenta del tercero…
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-muted/30 rounded-lg p-3 text-xs border border-border grid grid-cols-2 md:grid-cols-4 gap-2">
              <div><span className="text-muted-foreground">Tipo:</span> {invoice.tipo === 'emitida' ? 'Emitida' : 'Recibida'}</div>
              <div><span className="text-muted-foreground">Base:</span> {fmt(invoice.base_imponible)} €</div>
              <div><span className="text-muted-foreground">{taxKind === 'igic' ? 'IGIC' : 'IVA'}:</span> {fmt(invoice.cuota_iva)} €</div>
              <div><span className="text-muted-foreground">Total:</span> <strong>{fmt(invoice.total_factura)} €</strong></div>
              {counterparty && (
                <div className="col-span-2 md:col-span-4 text-primary">
                  Subcuenta asignada: <span className="font-mono font-semibold">{counterparty.accountCode}</span> — {counterparty.accountName}
                </div>
              )}
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium">Fecha contable *</label>
                <Input type="date" value={fecha} onChange={event => setFecha(event.target.value)} className="h-8 text-xs mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium">Descripción *</label>
                <Input value={descripcion} onChange={event => setDescripcion(event.target.value)} className="h-8 text-xs mt-1" />
              </div>
            </div>

            <div className="border border-border rounded-lg overflow-x-auto">
              <table className="w-full min-w-[700px] text-xs">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="px-3 py-2 text-left">Cuenta (8 dígitos)</th>
                    <th className="px-3 py-2 text-left">Nombre</th>
                    <th className="px-3 py-2 text-right">Debe</th>
                    <th className="px-3 py-2 text-right">Haber</th>
                    <th />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {lines.map((line, index) => (
                    <tr key={index}>
                      <td className="px-2 py-1.5">
                        <Input
                          value={line.accountCode}
                          onChange={event => updateLine(index, 'accountCode', event.target.value.replace(/\D/g, '').slice(0, 8))}
                          list={`account-list-${index}`}
                          className={cn('h-8 w-32 font-mono', !validCode(line.accountCode) && 'border-red-400')}
                        />
                        <datalist id={`account-list-${index}`}>
                          {accounts.map(account => <option key={account.id} value={account.code}>{account.name}</option>)}
                        </datalist>
                      </td>
                      <td className="px-2 py-1.5 text-muted-foreground">{line.accountName || 'Cuenta no encontrada'}</td>
                      <td className="px-2 py-1.5"><Input type="number" min="0" step="0.01" value={line.debit} onChange={event => updateLine(index, 'debit', event.target.value)} className="h-8 text-right font-mono" /></td>
                      <td className="px-2 py-1.5"><Input type="number" min="0" step="0.01" value={line.credit} onChange={event => updateLine(index, 'credit', event.target.value)} className="h-8 text-right font-mono" /></td>
                      <td className="px-2"><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setLines(previous => previous.filter((_, position) => position !== index))}><Trash2 className="w-3 h-3" /></Button></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-muted/20 font-semibold">
                  <tr>
                    <td colSpan={2} className="px-3 py-2">Totales</td>
                    <td className="px-3 py-2 text-right font-mono">{fmt(totals.debit)}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmt(totals.credit)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>

            <Button variant="outline" size="sm" onClick={() => setLines(previous => [...previous, { accountCode: '', accountName: '', debit: 0, credit: 0, sourceLineType: 'ajuste' }])}>
              <Plus className="w-3 h-3 mr-1" /> Añadir línea
            </Button>

            <div className={cn('flex items-center gap-2 text-xs rounded-lg px-3 py-2 border', totals.balanced ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200')}>
              {totals.balanced ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              {totals.balanced ? 'Asiento cuadrado y listo para validar.' : `Descuadre: ${fmt(Math.abs(totals.debit - totals.credit))} €`}
            </div>

            {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-xs">{error}</div>}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
              <Button onClick={confirm} disabled={saving || loading || !totals.balanced}>
                {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Contabilizando…</> : <><CheckCircle className="w-4 h-4 mr-2" />Validar y contabilizar</>}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
