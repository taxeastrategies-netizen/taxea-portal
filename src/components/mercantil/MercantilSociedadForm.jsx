import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const PROVINCIAS_RM = [
  'Madrid','Barcelona','Valencia','Sevilla','Zaragoza','Málaga','Murcia','Palma','Las Palmas',
  'Bilbao','Alicante','Córdoba','Valladolid','Vigo','Gijón','Hospitalet','Vitoria','Granada',
  'La Coruña','Elche','Oviedo','Tenerife','Badalona','Cartagena','Terrassa','Jerez','Sabadell',
  'Santander','Pamplona','Almería','San Sebastián','Leganés','Burgos','Albacete','Getafe',
  'Logroño','Alcalá de Henares','Toledo','Badajoz','Huelva','Salamanca','Lleida','Tarragona',
  'Girona','Cáceres','Mérida','León','Jaén','Lugo','Ourense','Pontevedra','Ávila','Segovia',
  'Soria','Cuenca','Ciudad Real','Guadalajara','Palencia','Zamora','Teruel','Huesca','Castellón'
];

export default function MercantilSociedadForm({ open, onClose, onSaved }) {
  const [form, setForm] = useState({
    nombreFiscal: '', nif: '', tipoEntidad: 'sl', provincia: '', registroMercantil: '',
    fechaConstitucion: '', ejercicioFiscal: 'enero-diciembre', responsableInterno: '',
    estadoDocumental: 'activa', observaciones: '',
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.nombreFiscal || !form.nif) return;
    setSaving(true);
    await base44.entities.MercantilSociedad.create(form);
    setSaving(false);
    onSaved?.();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-jakarta">Nueva sociedad</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Nombre fiscal *</Label>
              <Input value={form.nombreFiscal} onChange={e => set('nombreFiscal', e.target.value)} className="h-8 text-sm" placeholder="Empresa S.L." />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">NIF *</Label>
              <Input value={form.nif} onChange={e => set('nif', e.target.value)} className="h-8 text-sm" placeholder="B12345678" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tipo de entidad</Label>
              <Select value={form.tipoEntidad} onValueChange={v => set('tipoEntidad', v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sl">Sociedad Limitada</SelectItem>
                  <SelectItem value="sa">Sociedad Anónima</SelectItem>
                  <SelectItem value="otra_mercantil">Otra soc. mercantil</SelectItem>
                  <SelectItem value="persona_fisica">Persona física</SelectItem>
                  <SelectItem value="comunidad_bienes">Comunidad de bienes</SelectItem>
                  <SelectItem value="asociacion">Asociación</SelectItem>
                  <SelectItem value="otra">Otra</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Provincia del Registro Mercantil</Label>
              <Select value={form.provincia} onValueChange={v => set('provincia', v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>
                  {PROVINCIAS_RM.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Registro Mercantil (referencia)</Label>
              <Input value={form.registroMercantil} onChange={e => set('registroMercantil', e.target.value)} className="h-8 text-sm" placeholder="RM Madrid Tomo..." />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Fecha de constitución</Label>
              <Input type="date" value={form.fechaConstitucion} onChange={e => set('fechaConstitucion', e.target.value)} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Responsable interno</Label>
              <Input value={form.responsableInterno} onChange={e => set('responsableInterno', e.target.value)} className="h-8 text-sm" placeholder="Email o nombre" />
            </div>
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Observaciones internas</Label>
              <textarea value={form.observaciones} onChange={e => set('observaciones', e.target.value)} rows={2}
                className="w-full text-sm border border-input rounded-md px-3 py-1.5 bg-transparent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
            <Button size="sm" onClick={handleSave} disabled={saving || !form.nombreFiscal || !form.nif}>
              {saving ? 'Guardando...' : 'Crear sociedad'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}