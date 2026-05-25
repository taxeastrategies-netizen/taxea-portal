import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, AlertTriangle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const fmt = n => Number(n || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function JournalEntryForm({ open, onClose, onSaved, accounts = [], companyId }) {
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), type: 'manual', description: '', source: 'manual', tags: [] });
  const [lines, setLines] = useState([
    { accountCode: '', accountName: '', description: '', debit: '', credit: '' },
    { accountCode: '', accountName: '', description: '', debit: '', credit: '' },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const totalDebit = lines.reduce((s, l) => s + Number(l.debit || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + Number(l.credit || 0), 0);
  const diff = Math.round((totalDebit - totalCredit) * 100) / 100;
  const isBalanced = diff === 0 && totalDebit > 0;

  const updateLine = (i, field, val) => {
    setLines(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: val } : l));
    if (field === 'accountCode') {
      const acc = accounts.find(a => a.code === val);
      if (acc) setLines(prev => prev.map((l, idx) => idx === i ? { ...l, accountName: acc.name } : l));
    }
  };

  const addLine = () => setLines(prev => [...prev, { accountCode: '', accountName: '', description: '', debit: '', credit: '' }]);
  const removeLine = i => setLines(prev => prev.filter((_, idx) => idx !== i));

  const handleSave = async (asStatus) => {
    setError('');
    if (!form.date || !form.description) { setError('Fecha y descripción son obligatorias.'); return; }
    if (asStatus === 'confirmado' && !isBalanced) { setError('El asiento no cuadra. Debe = Haber para confirmar.'); return; }
    const validLines = lines.filter(l => l.accountCode && (Number(l.debit) > 0 || Number(l.credit) > 0));
    if (validLines.length < 2) { setError('Se necesitan al menos 2 líneas con cuenta e importe.'); return; }

    setSaving(true);
    const entry = await base44.entities.JournalEntry.create({
      ...form,
      companyId,
      totalDebit,
      totalCredit,
      isBalanced,
      status: asStatus,
      entryNumber: `A-${Date.now().toString().slice(-6)}`,
    });

    await base44.entities.JournalEntryLine.bulkCreate(
      validLines.map((l, i) => ({
        journalEntryId: entry.id,
        companyId,
        lineNumber: i + 1,
        accountCode: l.accountCode,
        accountName: l.accountName,
        description: l.description || form.description,
        debit: Number(l.debit || 0),
        credit: Number(l.credit || 0),
        entryStatus: asStatus,
      }))
    );

    setSaving(false);
    onSaved?.();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-jakarta">Nuevo asiento contable</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Header fields */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Fecha contable *</Label>
              <Input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tipo</Label>
              <Select value={form.type} onValueChange={v => setForm(p => ({ ...p, type: v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['manual','gasto','ingreso','pago','cobro','banco','nomina','amortizacion','apertura','cierre','ajuste'].map(t => (
                    <SelectItem key={t} value={t} className="text-xs capitalize">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Descripción *</Label>
              <Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Concepto del asiento..." className="h-8 text-sm" />
            </div>
          </div>

          {/* Lines */}
          <div className="border border-border rounded-xl overflow-hidden">
            <div className="grid grid-cols-[2fr_3fr_1fr_1fr_auto] gap-0 bg-secondary/50 px-3 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              <span>Cuenta</span><span>Descripción</span><span className="text-right">Debe</span><span className="text-right">Haber</span><span />
            </div>
            <div className="divide-y divide-border">
              {lines.map((line, i) => (
                <div key={i} className="grid grid-cols-[2fr_3fr_1fr_1fr_auto] gap-2 px-3 py-2 items-center">
                  <div className="flex items-center gap-1">
                    <Input
                      value={line.accountCode}
                      onChange={e => updateLine(i, 'accountCode', e.target.value)}
                      placeholder="Cta."
                      className="h-7 text-xs w-20 flex-shrink-0"
                      list={`accs-${i}`}
                    />
                    <datalist id={`accs-${i}`}>
                      {accounts.map(a => <option key={a.id} value={a.code}>{a.code} - {a.name}</option>)}
                    </datalist>
                    <span className="text-[10px] text-muted-foreground truncate">{line.accountName}</span>
                  </div>
                  <Input value={line.description} onChange={e => updateLine(i, 'description', e.target.value)} placeholder="Detalle..." className="h-7 text-xs" />
                  <Input value={line.debit} onChange={e => updateLine(i, 'debit', e.target.value)} type="number" min="0" step="0.01" placeholder="0,00" className="h-7 text-xs text-right" />
                  <Input value={line.credit} onChange={e => updateLine(i, 'credit', e.target.value)} type="number" min="0" step="0.01" placeholder="0,00" className="h-7 text-xs text-right" />
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeLine(i)} disabled={lines.length <= 2}>
                    <Trash2 className="w-3 h-3 text-muted-foreground" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between px-3 py-2 bg-secondary/30 border-t border-border">
              <Button size="sm" variant="ghost" onClick={addLine} className="gap-1.5 text-xs h-7">
                <Plus className="w-3 h-3" />Añadir línea
              </Button>
              <div className="flex items-center gap-4 text-sm font-semibold">
                <span>Debe: <span className="font-mono">{fmt(totalDebit)}</span></span>
                <span>Haber: <span className="font-mono">{fmt(totalCredit)}</span></span>
                <span className={cn('flex items-center gap-1', isBalanced ? 'text-emerald-600' : diff !== 0 ? 'text-red-600' : 'text-muted-foreground')}>
                  {isBalanced ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                  {isBalanced ? 'Cuadrado' : `Dif: ${fmt(Math.abs(diff))}`}
                </span>
              </div>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />{error}
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button variant="outline" size="sm" onClick={() => handleSave('borrador')} disabled={saving}>Guardar borrador</Button>
            <Button size="sm" onClick={() => handleSave('confirmado')} disabled={saving || !isBalanced}>
              {saving ? 'Guardando...' : 'Confirmar asiento'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}