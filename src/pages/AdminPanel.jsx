import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Users, Building2, FileText, AlertTriangle, Plus, Search, Eye } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function AdminPanel() {
  const { user, isAdmin } = useOutletContext() || {};
  const [companies, setCompanies] = useState([]);
  const [allInvoices, setAllInvoices] = useState([]);
  const [allObligation, setAllObligation] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showNewCompany, setShowNewCompany] = useState(false);
  const [newCompany, setNewCompany] = useState({ razon_social: '', nif_cif: '', owner_email: '', tipo_impuesto: 'iva', regimen_fiscal: 'autonomo' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    load();
  }, [isAdmin]);

  const load = async () => {
    setLoading(true);
    const [comps, invs, obls] = await Promise.all([
      base44.entities.Company.list(),
      base44.entities.Invoice.filter({ estado_contable: 'pendiente' }),
      base44.entities.TaxObligation.filter({ estado: 'pendiente_documentacion' }),
    ]);
    setCompanies(comps || []);
    setAllInvoices(invs || []);
    setAllObligation(obls || []);
    setLoading(false);
  };

  const handleCreateCompany = async () => {
    setSaving(true);
    await base44.entities.Company.create({ ...newCompany, activa: true });
    setSaving(false);
    setShowNewCompany(false);
    setNewCompany({ razon_social: '', nif_cif: '', owner_email: '', tipo_impuesto: 'iva', regimen_fiscal: 'autonomo' });
    load();
  };

  if (!isAdmin) {
    return (
      <div className="p-12 text-center">
        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
        <p className="font-medium text-foreground">Acceso denegado</p>
        <p className="text-sm text-muted-foreground">Solo los administradores pueden acceder a este panel.</p>
      </div>
    );
  }

  const filtered = companies.filter(c =>
    !search || c.razon_social?.toLowerCase().includes(search.toLowerCase()) || c.nif_cif?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <PageHeader title="Panel de Administración" subtitle="Gestión de clientes y empresas · Taxea Strategies">
        <Button onClick={() => setShowNewCompany(true)} className="bg-teal hover:bg-teal-dark h-9">
          <Plus className="w-4 h-4 mr-1.5" /> Nueva empresa
        </Button>
      </PageHeader>

      {/* Stats admin */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-card rounded-xl border border-border shadow-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Empresas activas</p>
          <p className="text-2xl font-jakarta font-bold text-foreground">{companies.filter(c => c.activa).length}</p>
        </div>
        <div className="bg-card rounded-xl border border-border shadow-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Facturas pendientes</p>
          <p className="text-2xl font-jakarta font-bold text-amber-600">{allInvoices.length}</p>
        </div>
        <div className="bg-card rounded-xl border border-border shadow-card p-4">
          <p className="text-xs text-muted-foreground mb-1">Obligaciones urgentes</p>
          <p className="text-2xl font-jakarta font-bold text-red-600">{allObligation.length}</p>
        </div>
        <div className="bg-teal/5 border border-teal/20 rounded-xl p-4">
          <p className="text-xs text-teal mb-1">Panel activo</p>
          <p className="text-sm font-medium text-teal">Taxea Strategies</p>
          <p className="text-xs text-muted-foreground">{user?.email}</p>
        </div>
      </div>

      {/* Lista clientes */}
      <div className="bg-card rounded-xl border border-border shadow-card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-jakarta font-semibold text-foreground">Empresas y Clientes</h3>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input placeholder="Buscar empresa..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm" />
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center"><div className="w-6 h-6 border-2 border-teal border-t-transparent rounded-full animate-spin mx-auto" /></div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Building2 className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="text-muted-foreground">Sin empresas registradas</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map(comp => (
              <div key={comp.id} className="px-5 py-4 flex items-center justify-between hover:bg-secondary/30 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-teal-light rounded-xl flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-teal" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{comp.razon_social || comp.nombre_comercial}</p>
                    <p className="text-xs text-muted-foreground">{comp.nif_cif} · {comp.owner_email || 'Sin email asignado'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${comp.activa ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                    {comp.activa ? 'Activa' : 'Inactiva'}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded bg-secondary text-muted-foreground capitalize">
                    {comp.tipo_impuesto || 'iva'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={showNewCompany} onOpenChange={setShowNewCompany}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nueva empresa / cliente</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5"><Label>Razón social *</Label><Input value={newCompany.razon_social} onChange={e => setNewCompany(f => ({ ...f, razon_social: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>NIF / CIF *</Label><Input value={newCompany.nif_cif} onChange={e => setNewCompany(f => ({ ...f, nif_cif: e.target.value }))} placeholder="B12345678" /></div>
            <div className="space-y-1.5"><Label>Email del cliente</Label><Input type="email" value={newCompany.owner_email} onChange={e => setNewCompany(f => ({ ...f, owner_email: e.target.value }))} placeholder="cliente@email.com" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Régimen fiscal</Label>
                <Select value={newCompany.regimen_fiscal} onValueChange={v => setNewCompany(f => ({ ...f, regimen_fiscal: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="autonomo">Autónomo</SelectItem>
                    <SelectItem value="sociedad_limitada">S.L.</SelectItem>
                    <SelectItem value="sociedad_anonima">S.A.</SelectItem>
                    <SelectItem value="otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Impuesto</Label>
                <Select value={newCompany.tipo_impuesto} onValueChange={v => setNewCompany(f => ({ ...f, tipo_impuesto: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="iva">IVA</SelectItem>
                    <SelectItem value="igic">IGIC</SelectItem>
                    <SelectItem value="exento">Exento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setShowNewCompany(false)}>Cancelar</Button>
            <Button onClick={handleCreateCompany} disabled={saving || !newCompany.razon_social} className="bg-teal hover:bg-teal-dark">{saving ? 'Creando...' : 'Crear empresa'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}