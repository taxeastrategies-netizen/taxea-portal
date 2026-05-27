import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertCircle, CheckCircle, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const fmt = (n) => n != null ? Number(n).toFixed(2) : '0.00';

function buildProposal(invoice) {
  const base = invoice.base_imponible || 0;
  const iva = invoice.cuota_iva || (base * (invoice.tipo_iva || 0) / 100);
  const retencion = invoice.retencion_irpf || 0;
  const total = invoice.total_factura || (base + iva - retencion);

  if (invoice.tipo === 'emitida') {
    // total_factura ya es neto (base + iva - retención)
    // Debe: 430 por el importe neto que paga el cliente (total_factura)
    // Debe: 473 por la retención que retiene Hacienda
    // Haber: 705 base imponible
    // Haber: 477 IVA repercutido
    const lines = [
      { cuenta: '430', nombre: 'Clientes', debe: total, haber: 0 },
    ];
    if (retencion > 0) lines.push({ cuenta: '473', nombre: 'H.P. retenciones e ingresos a cuenta', debe: retencion, haber: 0 });
    lines.push({ cuenta: '705', nombre: 'Prestaciones de servicios', debe: 0, haber: base });
    if (iva > 0) lines.push({ cuenta: '477', nombre: 'IVA repercutido', debe: 0, haber: iva });
    return lines;
  } else {
    // total_factura ya es neto (base + iva - retención)
    // Debe: 6XX gasto
    // Debe: 472 IVA soportado
    // Haber: 410 por el importe neto que pagamos (total_factura)
    // Haber: 4751 retención que practicamos al proveedor
    const lines = [
      { cuenta: '629', nombre: 'Gasto (pendiente de clasificar)', debe: base, haber: 0 },
    ];
    if (iva > 0) lines.push({ cuenta: '472', nombre: 'IVA soportado', debe: iva, haber: 0 });
    lines.push({ cuenta: '410', nombre: 'Proveedores', debe: 0, haber: total });
    if (retencion > 0) lines.push({ cuenta: '4751', nombre: 'Retenciones practicadas', debe: 0, haber: retencion });
    return lines;
  }
}

export default function AsientoProposalModal({ invoice, onClose, onConfirmed }) {
  const [lines, setLines] = useState(() => buildProposal(invoice));
  const [descripcion, setDescripcion] = useState(invoice.concepto || `Factura ${invoice.numero_factura}`);
  const [fecha, setFecha] = useState(invoice.fecha_emision || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const totalDebe = lines.reduce((s, l) => s + (Number(l.debe) || 0), 0);
  const totalHaber = lines.reduce((s, l) => s + (Number(l.haber) || 0), 0);
  const cuadra = Math.abs(totalDebe - totalHaber) < 0.005;

  const updateLine = (idx, field, value) => {
    setLines(prev => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l));
  };

  const addLine = () => setLines(prev => [...prev, { cuenta: '', nombre: '', debe: 0, haber: 0 }]);
  const removeLine = (idx) => setLines(prev => prev.filter((_, i) => i !== idx));

  const confirm = async () => {
    setError('');
    if (!fecha) { setError('La fecha del asiento es obligatoria.'); return; }
    if (!cuadra) { setError('El asiento no cuadra: el total debe ≠ total haber.'); return; }
    if (lines.some(l => !l.cuenta)) { setError('Todas las líneas deben tener cuenta contable.'); return; }

    setSaving(true);
    const source = invoice.tipo === 'emitida' ? 'factura_emitida' : 'factura_recibida';
    const entry = await base44.entities.JournalEntry.create({
      companyId: invoice.company_id,
      date: fecha,
      type: invoice.tipo === 'emitida' ? 'ingreso' : 'gasto',
      description: descripcion,
      documentId: invoice.id,
      source,
      status: 'confirmado',
      totalDebit: totalDebe,
      totalCredit: totalHaber,
      isBalanced: true,
      confirmedAt: new Date().toISOString(),
    });

    await base44.entities.JournalEntryLine.bulkCreate(
      lines.map((l, i) => ({
        journalEntryId: entry.id,
        companyId: invoice.company_id,
        lineNumber: i + 1,
        accountCode: l.cuenta,
        accountName: l.nombre,
        description: descripcion,
        debit: Number(l.debe) || 0,
        credit: Number(l.haber) || 0,
        documentId: invoice.id,
        entryStatus: 'confirmado',
      }))
    );

    await base44.entities.Invoice.update(invoice.id, {
      estado_contable: 'contabilizada',
      linked_journal_entry_id: entry.id,
      fecha_contabilizacion: new Date().toISOString(),
    });

    setSaving(false);
    onConfirmed();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-jakarta">
            Propuesta de asiento — {invoice.numero_factura}
            <span className={cn('ml-2 text-xs font-normal px-2 py-0.5 rounded-full', invoice.tipo === 'emitida' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700')}>
              Factura {invoice.tipo}
            </span>
          </DialogTitle>
        </DialogHeader>

        {/* Invoice summary */}
        <div className="bg-muted/30 rounded-lg p-3 text-xs space-y-1 border border-border">
          <div className="grid grid-cols-3 gap-2">
            <div><span className="text-muted-foreground">Nº:</span> <span className="font-mono font-medium">{invoice.numero_factura}</span></div>
            <div><span className="text-muted-foreground">Fecha:</span> {invoice.fecha_emision}</div>
            <div><span className="text-muted-foreground">{invoice.tipo === 'emitida' ? 'Cliente:' : 'Proveedor:'}</span> {invoice.cliente_nombre || invoice.proveedor_nombre || '—'}</div>
            <div><span className="text-muted-foreground">Base:</span> <span className="font-mono">{fmt(invoice.base_imponible)} €</span></div>
            <div><span className="text-muted-foreground">IVA ({invoice.tipo_iva}%):</span> <span className="font-mono">{fmt(invoice.cuota_iva)} €</span></div>
            <div><span className="text-muted-foreground">Total:</span> <span className="font-mono font-bold">{fmt(invoice.total_factura)} €</span></div>
          </div>
        </div>

        {/* Entry fields */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium">Fecha asiento *</label>
            <Input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="h-8 text-xs" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Descripción</label>
            <Input value={descripcion} onChange={e => setDescripcion(e.target.value)} className="h-8 text-xs" />
          </div>
        </div>

        {/* Lines */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold">Líneas del asiento</p>
            <p className="text-[10px] text-muted-foreground italic">Propuesta orientativa — editable</p>
          </div>
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted/40">
                <tr>
                  <th className="px-3 py-2 text-left text-muted-foreground font-medium">Cuenta</th>
                  <th className="px-3 py-2 text-left text-muted-foreground font-medium">Nombre</th>
                  <th className="px-3 py-2 text-right text-muted-foreground font-medium">Debe (€)</th>
                  <th className="px-3 py-2 text-right text-muted-foreground font-medium">Haber (€)</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {lines.map((line, idx) => (
                  <tr key={idx}>
                    <td className="px-2 py-1.5">
                      <Input value={line.cuenta} onChange={e => updateLine(idx, 'cuenta', e.target.value)} className="h-7 w-20 font-mono text-xs" placeholder="430" />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input value={line.nombre} onChange={e => updateLine(idx, 'nombre', e.target.value)} className="h-7 text-xs" placeholder="Nombre cuenta" />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input type="number" value={line.debe} onChange={e => updateLine(idx, 'debe', e.target.value)} className="h-7 w-24 text-right font-mono text-xs" />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input type="number" value={line.haber} onChange={e => updateLine(idx, 'haber', e.target.value)} className="h-7 w-24 text-right font-mono text-xs" />
                    </td>
                    <td className="px-1.5 py-1.5">
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-muted-foreground hover:text-red-500" onClick={() => removeLine(idx)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-muted/20 border-t border-border">
                <tr>
                  <td colSpan={2} className="px-3 py-2 text-xs font-semibold">TOTALES</td>
                  <td className="px-3 py-2 text-right font-mono font-bold text-xs">{fmt(totalDebe)}</td>
                  <td className="px-3 py-2 text-right font-mono font-bold text-xs">{fmt(totalHaber)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={addLine}>
            <Plus className="w-3 h-3" /> Añadir línea
          </Button>
        </div>

        {/* Balance indicator */}
        <div className={cn('flex items-center gap-2 text-xs rounded-lg px-3 py-2', cuadra ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200')}>
          {cuadra ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
          {cuadra ? 'El asiento cuadra correctamente.' : `Descuadre: ${fmt(Math.abs(totalDebe - totalHaber))} €. El asiento debe cuadrar antes de confirmar.`}
        </div>

        {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={confirm} disabled={saving || !cuadra} className="gap-2">
            {saving ? 'Confirmando...' : <><CheckCircle className="w-4 h-4" />Confirmar y contabilizar</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}