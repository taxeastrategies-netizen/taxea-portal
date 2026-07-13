import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Users, Plus, Trash2, Loader2, Search, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

const TERRITORIOS_CP = [
  { value: 'tai', label: 'TAI (Península/Baleares)' },
  { value: 'canarias', label: 'Canarias' },
  { value: 'ceuta_melilla', label: 'Ceuta/Melilla' },
  { value: 'ue_iva', label: 'UE (NIF-IVA)' },
  { value: 'no_ue', label: 'No UE' },
  { value: 'desconocido', label: 'Desconocido' },
];

const TIPOS_CP = [
  { value: 'particular', label: 'Particular' },
  { value: 'autonomo', label: 'Autónomo' },
  { value: 'sociedad', label: 'Sociedad' },
  { value: 'entidad_publica', label: 'Entidad pública' },
  { value: 'no_residente', label: 'No residente' },
  { value: 'plataforma_digital', label: 'Plataforma digital' },
  { value: 'proveedor_extranjero', label: 'Proveedor extranjero' },
  { value: 'otro', label: 'Otro' },
];

export default function CounterpartyManager({ companyId }) {
  const [loading, setLoading] = useState(true);
  const [counterparties, setCounterparties] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [newCp, setNewCp] = useState({ name: '', taxId: '', vatId: '', country: 'ES', territory: 'desconocido', counterpartyType: 'sociedad', isBusiness: true, viesStatus: 'no_aplica', knownRegime: '', defaultTaxTreatment: '', defaultWithholdingRate: 0, isRecurrentRule: false, approvedRule: '', notes: '' });

  useEffect(() => {
    if (companyId) load();
    else setLoading(false);
  }, [companyId]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.CounterpartyFiscalProfile.filter({ company_id: companyId });
      setCounterparties(data || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleAdd = async () => {
    if (!newCp.name) return;
    try {
      const created = await base44.entities.CounterpartyFiscalProfile.create({
        ...newCp,
        company_id: companyId,
        reviewedAt: new Date().toISOString(),
      });
      setCounterparties(prev => [...prev, created]);
      setNewCp({ name: '', taxId: '', vatId: '', country: 'ES', territory: 'desconocido', counterpartyType: 'sociedad', isBusiness: true, viesStatus: 'no_aplica', knownRegime: '', defaultTaxTreatment: '', defaultWithholdingRate: 0, isRecurrentRule: false, approvedRule: '', notes: '' });
      setShowForm(false);
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (id) => {
    try { await base44.entities.CounterpartyFiscalProfile.delete(id); setCounterparties(prev => prev.filter(c => c.id !== id)); }
    catch (e) { console.error(e); }
  };

  const filtered = counterparties.filter(c =>
    !search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.taxId?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="p-4 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-primary" /></div>;

  return (
    <div className="bg-card rounded-xl border border-border shadow-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          <h3 className="font-jakarta font-semibold text-foreground text-sm">5. Contrapartes fiscales ({counterparties.length})</h3>
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowForm(!showForm)} className="h-8 gap-1 text-xs">
          <Plus className="w-3.5 h-3.5" /> Añadir contraparte
        </Button>
      </div>

      {counterparties.length > 0 && (
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar por nombre o NIF..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
        </div>
      )}

      {showForm && (
        <div className="bg-secondary/30 rounded-lg p-4 mb-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Nombre *</Label>
              <Input value={newCp.name} onChange={e => setNewCp(c => ({ ...c, name: e.target.value }))} className="h-9 text-sm" placeholder="Ej: Google Ireland" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">NIF / Tax ID</Label>
              <Input value={newCp.taxId} onChange={e => setNewCp(c => ({ ...c, taxId: e.target.value }))} className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">NIF-IVA (VAT UE)</Label>
              <Input value={newCp.vatId} onChange={e => setNewCp(c => ({ ...c, vatId: e.target.value }))} className="h-9 text-sm" placeholder="Ej: IE6388047V" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">País</Label>
              <Input value={newCp.country} onChange={e => setNewCp(c => ({ ...c, country: e.target.value }))} className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Territorio fiscal</Label>
              <Select value={newCp.territory} onValueChange={v => setNewCp(c => ({ ...c, territory: v }))}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{TERRITORIOS_CP.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tipo</Label>
              <Select value={newCp.counterpartyType} onValueChange={v => setNewCp(c => ({ ...c, counterpartyType: v }))}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{TIPOS_CP.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">VIES</Label>
              <Select value={newCp.viesStatus} onValueChange={v => setNewCp(c => ({ ...c, viesStatus: v }))}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="no_aplica">No aplica</SelectItem>
                  <SelectItem value="validado">Validado</SelectItem>
                  <SelectItem value="no_validado">No validado</SelectItem>
                  <SelectItem value="pendiente">Pendiente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Retención por defecto (%)</Label>
              <Input type="number" value={newCp.defaultWithholdingRate} onChange={e => setNewCp(c => ({ ...c, defaultWithholdingRate: parseFloat(e.target.value) }))} className="h-9 text-sm" />
            </div>
            <div className="space-y-1 col-span-2">
              <Label className="text-xs">Régimen conocido / tratamiento recurrente</Label>
              <Input value={newCp.knownRegime} onChange={e => setNewCp(c => ({ ...c, knownRegime: e.target.value }))} className="h-9 text-sm" placeholder="Ej: ISP, intracomunitario, profesional con retención 15%" />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={newCp.isRecurrentRule} onChange={e => setNewCp(c => ({ ...c, isRecurrentRule: e.target.checked }))} className="rounded border-border" />
            <span className="text-xs text-foreground">Marcar como regla recurrente aprobada</span>
          </label>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleAdd} className="bg-teal hover:bg-teal-dark">Crear contraparte</Button>
          </div>
        </div>
      )}

      {filtered.length === 0 && !showForm ? (
        <div className="text-center py-6">
          <Users className="w-8 h-8 text-muted-foreground opacity-30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No hay contrapartes registradas. Crea fichas para proveedores y clientes recurrentes.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(cp => (
            <div key={cp.id} className="flex items-center justify-between border border-border rounded-lg p-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-foreground truncate">{cp.name}</span>
                  <Badge variant="outline" className="text-[10px]">{cp.counterpartyType}</Badge>
                  <Badge variant="outline" className="text-[10px]">{cp.territory}</Badge>
                  {cp.viesStatus === 'validado' && <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-200">VIES ✓</Badge>}
                  {cp.isRecurrentRule && <Badge className="text-[10px] bg-blue-100 text-blue-700 border-blue-200">Regla recurrente</Badge>}
                </div>
                {cp.taxId && <span className="text-xs text-muted-foreground">NIF: {cp.taxId}</span>}
                {cp.knownRegime && <span className="text-xs text-muted-foreground ml-2">· {cp.knownRegime}</span>}
                {cp.defaultWithholdingRate > 0 && <span className="text-xs text-muted-foreground ml-2">· Ret. {cp.defaultWithholdingRate}%</span>}
              </div>
              <button onClick={() => handleDelete(cp.id)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}