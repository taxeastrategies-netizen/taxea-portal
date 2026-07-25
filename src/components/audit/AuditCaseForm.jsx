import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const AUDIT_TYPES = [
  { value: 'revision_modelo_fiscal', label: 'Revisión modelo fiscal' },
  { value: 'revision_modelo_200', label: 'Revisión Modelo 200' },
  { value: 'revision_iva', label: 'Revisión IVA' },
  { value: 'revision_igic', label: 'Revisión IGIC' },
  { value: 'revision_irpf', label: 'Revisión IRPF' },
  { value: 'revision_retenciones', label: 'Revisión retenciones' },
  { value: 'revision_contable', label: 'Revisión contable' },
  { value: 'revision_escrituras_societarias', label: 'Escrituras y operaciones societarias' },
  { value: 'revision_contratos', label: 'Revisión contratos' },
  { value: 'revision_operaciones_vinculadas', label: 'Operaciones vinculadas' },
  { value: 'revision_requerimiento_aeat_atc', label: 'Requerimiento AEAT/ATC' },
  { value: 'revision_cierre_anual', label: 'Cierre anual' },
  { value: 'revision_cierre_trimestral', label: 'Cierre trimestral' },
  { value: 'due_diligence_documental', label: 'Due diligence documental' },
  { value: 'auditoria_libre', label: 'Auditoría libre' },
];

export default function AuditCaseForm({ open, onOpenChange, onSubmit, saving }) {
  const [form, setForm] = useState({
    title: '',
    clientName: '',
    clientNif: '',
    auditType: 'auditoria_libre',
    jurisdiction: 'espana_aeat',
    taxYear: new Date().getFullYear(),
    period: '',
    notes: ''
  });

  const handleSubmit = () => {
    if (!form.title) return;
    onSubmit(form);
    setForm({ title: '', clientName: '', clientNif: '', auditType: 'auditoria_libre', jurisdiction: 'espana_aeat', taxYear: new Date().getFullYear(), period: '', notes: '' });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuevo expediente de auditoría</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          <div className="space-y-1.5">
            <Label>Título del expediente *</Label>
            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Ej: Revisión Modelo 200 - Cliente X 2025" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Cliente</Label>
              <Input value={form.clientName} onChange={e => setForm(f => ({ ...f, clientName: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>NIF/CIF cliente</Label>
              <Input value={form.clientNif} onChange={e => setForm(f => ({ ...f, clientNif: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo de auditoría</Label>
              <Select value={form.auditType} onValueChange={v => setForm(f => ({ ...f, auditType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-60">
                  {AUDIT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Jurisdicción</Label>
              <Select value={form.jurisdiction} onValueChange={v => setForm(f => ({ ...f, jurisdiction: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="espana_aeat">España - AEAT</SelectItem>
                  <SelectItem value="canarias_atc">Canarias - ATC/IGIC</SelectItem>
                  <SelectItem value="ccaa">Comunidad Autónoma</SelectItem>
                  <SelectItem value="ue">Unión Europea</SelectItem>
                  <SelectItem value="otro">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Ejercicio fiscal</Label>
              <Input type="number" value={form.taxYear} onChange={e => setForm(f => ({ ...f, taxYear: parseInt(e.target.value) || new Date().getFullYear() }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Período</Label>
              <Input value={form.period} onChange={e => setForm(f => ({ ...f, period: e.target.value }))} placeholder="Ej: T1, Anual, 1T2026" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notas internas</Label>
            <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Contexto, alcance, observaciones..." />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={saving || !form.title} className="bg-teal hover:bg-teal-dark">
            {saving ? 'Creando...' : 'Crear expediente'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}