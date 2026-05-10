import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, BookMarked, MoreVertical, ToggleLeft, ToggleRight } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

const DEFAULT_NOTES = [
  { titulo: 'Operación no sujeta a IVA', texto: 'Operación no sujeta a IVA por aplicación de las reglas de localización (Art. 69 LIVA).', categoria: 'IVA', impuesto_relacionado: 'IVA', activa: true },
  { titulo: 'Inversión del sujeto pasivo', texto: 'Operación sujeta y exenta de IVA. Inversión del sujeto pasivo (Art. 84.1.2 LIVA).', categoria: 'IVA', impuesto_relacionado: 'IVA', activa: true },
  { titulo: 'Operación exenta de IVA', texto: 'Operación exenta de IVA conforme al artículo 20 de la Ley 37/1992.', categoria: 'IVA', impuesto_relacionado: 'IVA', activa: true },
  { titulo: 'REPEP - Sin IGIC', texto: 'Factura emitida sin IGIC por aplicación del Régimen Especial del Pequeño Empresario o Profesional (REPEP).', categoria: 'IGIC', impuesto_relacionado: 'IGIC', activa: true },
  { titulo: 'Retención profesional', texto: 'Sujeto a retención del IRPF según normativa vigente.', categoria: 'IRPF', impuesto_relacionado: 'IRPF', activa: true },
  { titulo: 'Servicios intracomunitarios', texto: 'Prestación de servicios intracomunitaria. Operación no sujeta a IVA español (Art. 69 LIVA).', categoria: 'IVA', impuesto_relacionado: 'IVA', activa: true },
  { titulo: 'Exportación de servicios', texto: 'Exportación de servicios. Operación no sujeta a IVA por reglas de localización.', categoria: 'IVA', impuesto_relacionado: 'IVA', activa: true },
  { titulo: 'Factura rectificativa', texto: 'Factura rectificativa emitida conforme al Art. 15 del Reglamento de Facturación (RD 1619/2012).', categoria: 'General', impuesto_relacionado: 'General', activa: true },
];

const EMPTY = { titulo: '', texto: '', categoria: '', impuesto_relacionado: '', activa: true };

export default function NotasPredefinidas() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const data = await base44.entities.PredefinedNote.list();
    if (!data || data.length === 0) {
      await base44.entities.PredefinedNote.bulkCreate(DEFAULT_NOTES);
      const fresh = await base44.entities.PredefinedNote.list();
      setNotes(fresh || []);
    } else {
      setNotes(data);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    if (editing) await base44.entities.PredefinedNote.update(editing.id, form);
    else await base44.entities.PredefinedNote.create(form);
    setSaving(false); setShowForm(false); setEditing(null); setForm(EMPTY); load();
  };

  return (
    <div>
      <PageHeader title="Notas Predefinidas" subtitle="Textos legales y fiscales reutilizables para facturas">
        <Button onClick={() => { setEditing(null); setForm(EMPTY); setShowForm(true); }} className="bg-teal hover:bg-teal-dark h-9">
          <Plus className="w-4 h-4 mr-1.5" /> Nueva nota
        </Button>
      </PageHeader>

      {loading ? (
        <div className="p-12 text-center"><div className="w-6 h-6 border-2 border-teal border-t-transparent rounded-full animate-spin mx-auto" /></div>
      ) : (
        <div className="grid gap-3">
          {notes.map(note => (
            <div key={note.id} className={`bg-card rounded-xl border shadow-card p-5 ${note.activa ? 'border-border' : 'border-border opacity-50'}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <p className="font-jakarta font-semibold text-foreground text-sm">{note.titulo}</p>
                    {note.categoria && (
                      <span className="text-xs px-2 py-0.5 bg-teal-light text-teal rounded font-medium">{note.categoria}</span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{note.texto}</p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="p-1.5 rounded hover:bg-secondary text-muted-foreground flex-shrink-0"><MoreVertical className="w-4 h-4" /></button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => { setEditing(note); setForm({ ...note }); setShowForm(true); }}>Editar</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => base44.entities.PredefinedNote.update(note.id, { activa: !note.activa }).then(load)}>
                      {note.activa ? 'Desactivar' : 'Activar'}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={v => { setShowForm(v); if (!v) { setEditing(null); setForm(EMPTY); } }}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{editing ? 'Editar nota' : 'Nueva nota predefinida'}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5"><Label>Título *</Label><Input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Texto completo *</Label><Textarea value={form.texto} onChange={e => setForm(f => ({ ...f, texto: e.target.value }))} rows={4} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Categoría</Label><Input value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))} placeholder="IVA, IGIC, IRPF..." /></div>
              <div className="space-y-1.5"><Label>Impuesto relacionado</Label><Input value={form.impuesto_relacionado} onChange={e => setForm(f => ({ ...f, impuesto_relacionado: e.target.value }))} /></div>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-teal hover:bg-teal-dark">{saving ? 'Guardando...' : 'Guardar'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}