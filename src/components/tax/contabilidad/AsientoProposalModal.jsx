import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertCircle, CheckCircle, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getWithholdingAmount } from '@/lib/accountingUtils';

const fmt = (n) => n != null ? Number(n).toFixed(2) : '0.00';

function buildProposal(invoice, config = {}) {
  const base = invoice.base_imponible || 0;
  const iva = invoice.cuota_iva || (base * (invoice.tipo_iva || 0) / 100);
  const retencion = getWithholdingAmount(invoice);
  const mappings = Array.isArray(config.mappings) ? config.mappings : [];
  const category = invoice.categoria_gasto || invoice.categoria || (invoice.tipo === 'emitida' ? 'ventas_servicios' : 'otros');
  const mapped = mappings.find(item => item.categoria === category && item.tipo === (invoice.tipo === 'emitida' ? 'ingreso' : 'gasto'));
  const total = invoice.total_factura || (base + iva - retencion);

  if (invoice.tipo === 'emitida') {
    // total_factura ya es neto (base + iva - retención)
    // Debe: 430 por el importe neto que paga el cliente (total_factura)
    // Debe: 473 por la retención que retiene Hacienda
    // Haber: 705 base imponible
    // Haber: 477 IVA repercutido
    const lines = [
      { cuenta: config.clientAccount || '430', nombre: 'Clientes', debe: total, haber: 0 },
    ];
    if (retencion > 0) lines.push({ cuenta: config.withholdingReceivableAccount || '473', nombre: 'H.P. retenciones e ingresos a cuenta', debe: retencion, haber: 0 });
    lines.push({ cuenta: mapped?.cuenta || '705', nombre: mapped?.nombre || 'Prestaciones de servicios', debe: 0, haber: base });
    if (iva > 0) lines.push({ cuenta: config.outputTaxAccount || '477', nombre: 'Impuesto repercutido', debe: 0, haber: iva });
    return lines;
  } else {
    // total_factura ya es neto (base + iva - retención)
    // Debe: 6XX gasto
    // Debe: 472 IVA soportado
    // Haber: 410 por el importe neto que pagamos (total_factura)
    // Haber: 4751 retención que practicamos al proveedor
    const lines = [
      { cuenta: mapped?.cuenta || '629', nombre: mapped?.nombre || 'Gasto (pendiente de clasificar)', debe: base, haber: 0 },
    ];
    if (iva > 0) lines.push({ cuenta: config.inputTaxAccount || '472', nombre: 'Impuesto soportado deducible', debe: iva, haber: 0 });
    lines.push({ cuenta: config.supplierAccount || '410', nombre: 'Proveedores', debe: 0, haber: total });
    if (retencion > 0) lines.push({ cuenta: config.withholdingPayableAccount || '4751', nombre: 'Retenciones practicadas', debe: 0, haber: retencion });
    return lines;
  }
}

export default function AsientoProposalModal({ invoice, onClose, onConfirmed }) {
  const [lines, setLines] = useState(() => buildProposal(invoice));
  const [descripcion, setDescripcion] = useState(invoice.concepto || `Factura ${invoice.numero_factura}`);
  const [fecha, setFecha] = useState(invoice.fecha_emision || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!invoice.company_id) return;
    base44.entities.AccountingConfiguration.filter({ companyId: invoice.company_id }, '-updatedAt', 1)
      .then(records => {
        const config = records?.[0];
        if (!config) return;
        let mappings = [];
        try { mappings = JSON.parse(config.mappingsJson || '[]'); } catch { mappings = []; }
        setLines(buildProposal(invoice, { ...config, mappings }));
      })
      .catch(() => {});
  }, [invoice.id, invoice.company_id]);

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