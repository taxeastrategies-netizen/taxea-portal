import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { BarChart2, Plus, MoreVertical, TrendingUp, AlertTriangle, Star, Lock } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

const SERVICIOS_LIST = ['Contabilidad', 'Fiscal trimestral', 'Renta', 'Sociedades', 'IGIC', 'IVA', 'Laboral', 'Mercantil', 'Consultoría', 'Requerimientos', 'Planificación fiscal', 'Asesoramiento puntual'];

const CALIDAD = {
  excelente: { label: 'Excelente', class: 'text-green-700 bg-green-50' },
  bueno: { label: 'Bueno', class: 'text-blue-700 bg-blue-50' },
  normal: { label: 'Normal', class: 'text-slate-600 bg-slate-100' },
  problematico: { label: 'Problemático', class: 'text-orange-700 bg-orange-50' },
  no_recomendable: { label: 'No recom.', class: 'text-red-700 bg-red-50' },
};

const RENTABILIDAD = {
  alta: { label: 'Alta', class: 'text-green-700 bg-green-50' },
  media: { label: 'Media', class: 'text-blue-700 bg-blue-50' },
  baja: { label: 'Baja', class: 'text-amber-700 bg-amber-50' },
  negativa: { label: 'Negativa', class: 'text-red-700 bg-red-50' },
};

const EMPTY_CRM = {
  honorarios_mensuales: '', honorarios_anuales: '', fecha_alta: '',
  origen_cliente: '', estado_comercial: 'cliente_activo', rentabilidad: 'media',
  horas_estimadas: '', horas_reales: '', complejidad: 'media', calidad_cliente: 'bueno',
  servicios: [], etiquetas: [], health_score: 75, observaciones_internas: '',
  proxima_accion: '', potencial_crecimiento: 'medio', estado_fiscal: 'gris'
};

export default function CRMInterno() {
  const { company, user, isAdmin } = useOutletContext() || {};
  const [companies, setCompanies] = useState([]);
  const [crmData, setCrmData] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_CRM);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  const load = async () => {
    setLoading(true);
    const [comps, crms] = await Promise.all([
      base44.entities.Company.list(),
      base44.entities.ClientCRM.list(),
    ]);
    setCompanies(comps || []);
    const crmMap = {};
    (crms || []).forEach(c => { crmMap[c.company_id] = c; });
    setCrmData(crmMap);
    setLoading(false);
  };

  const openCRM = (comp) => {
    setSelectedCompany(comp);
    const existing = crmData[comp.id] || {};
    setForm({ ...EMPTY_CRM, ...existing });
    setShowForm(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const existing = crmData[selectedCompany.id];
    const payload = {
      ...form,
      company_id: selectedCompany.id,
      honorarios_mensuales: parseFloat(form.honorarios_mensuales) || 0,
      honorarios_anuales: parseFloat(form.honorarios_anuales) || 0,
      horas_estimadas: parseFloat(form.horas_estimadas) || 0,
      horas_reales: parseFloat(form.horas_reales) || 0,
      health_score: parseFloat(form.health_score) || 75,
    };
    if (existing) await base44.entities.ClientCRM.update(existing.id, payload);
    else await base44.entities.ClientCRM.create(payload);
    setSaving(false);
    setShowForm(false);
    load();
  };

  const getHealthColor = (score) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-blue-600';
    if (score >= 40) return 'text-amber-600';
    return 'text-red-600';
  };

  const getHealthBg = (score) => {
    if (score >= 80) return 'bg-green-50 border-green-200';
    if (score >= 60) return 'bg-blue-50 border-blue-200';
    if (score >= 40) return 'bg-amber-50 border-amber-200';
    return 'bg-red-50 border-red-200';
  };

  if (!isAdmin) {
    return (
      <div className="p-12 text-center">
        <Lock className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
        <p className="font-medium text-foreground">Acceso restringido</p>
        <p className="text-sm text-muted-foreground">Solo los administradores pueden acceder al CRM interno.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <Lock className="w-4 h-4 text-amber-500" />
        <p className="text-xs font-medium text-amber-600">CRM interno confidencial — No visible para clientes</p>
      </div>
      <PageHeader title="CRM Interno" subtitle="Gestión de rentabilidad y calidad de clientes" />

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-6 h-6 border-2 border-taxea-red border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Empresa</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Estado</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Health</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Honorarios/mes</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Rentabilidad</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden xl:table-cell">Calidad</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden xl:table-cell">Complejidad</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {companies.map(comp => {
                const crm = crmData[comp.id];
                const score = crm?.health_score || 75;
                return (
                  <tr key={comp.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{comp.razon_social || comp.nombre_comercial}</p>
                      <p className="text-xs text-muted-foreground">{comp.nif_cif}</p>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-xs bg-secondary text-muted-foreground px-2 py-0.5 rounded capitalize">
                        {crm?.estado_comercial?.replace(/_/g, ' ') || 'Sin datos'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className={cn("inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-sm font-bold", getHealthBg(score))}>
                        <span className={getHealthColor(score)}>{score}/100</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-medium hidden lg:table-cell">
                      {crm?.honorarios_mensuales ? `${crm.honorarios_mensuales.toLocaleString('es-ES')} €` : '—'}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {crm?.rentabilidad ? (
                        <span className={cn("text-xs px-2 py-0.5 rounded font-medium", RENTABILIDAD[crm.rentabilidad]?.class)}>
                          {RENTABILIDAD[crm.rentabilidad]?.label}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 hidden xl:table-cell">
                      {crm?.calidad_cliente ? (
                        <span className={cn("text-xs px-2 py-0.5 rounded font-medium", CALIDAD[crm.calidad_cliente]?.class)}>
                          {CALIDAD[crm.calidad_cliente]?.label}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 hidden xl:table-cell text-muted-foreground capitalize text-xs">
                      {crm?.complejidad?.replace(/_/g, ' ') || '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="outline" onClick={() => openCRM(comp)} className="h-7 text-xs">Editar CRM</Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={showForm} onOpenChange={v => { setShowForm(v); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>CRM — {selectedCompany?.razon_social}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div className="space-y-1.5"><Label>Honorarios mensuales (€)</Label><Input type="number" value={form.honorarios_mensuales} onChange={e => setForm(f => ({ ...f, honorarios_mensuales: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Honorarios anuales (€)</Label><Input type="number" value={form.honorarios_anuales} onChange={e => setForm(f => ({ ...f, honorarios_anuales: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Health Score (0-100)</Label><Input type="number" min="0" max="100" value={form.health_score} onChange={e => setForm(f => ({ ...f, health_score: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Estado comercial</Label>
              <Select value={form.estado_comercial} onValueChange={v => setForm(f => ({ ...f, estado_comercial: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cliente_activo">Cliente activo</SelectItem>
                  <SelectItem value="cliente_pausado">Cliente pausado</SelectItem>
                  <SelectItem value="cliente_baja">Cliente baja</SelectItem>
                  <SelectItem value="lead">Lead</SelectItem>
                  <SelectItem value="propuesta_enviada">Propuesta enviada</SelectItem>
                  <SelectItem value="no_recomendable">No recomendable</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Rentabilidad</Label>
              <Select value={form.rentabilidad} onValueChange={v => setForm(f => ({ ...f, rentabilidad: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="media">Media</SelectItem>
                  <SelectItem value="baja">Baja</SelectItem>
                  <SelectItem value="negativa">Negativa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Calidad cliente</Label>
              <Select value={form.calidad_cliente} onValueChange={v => setForm(f => ({ ...f, calidad_cliente: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="excelente">Excelente</SelectItem>
                  <SelectItem value="bueno">Bueno</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="problematico">Problemático</SelectItem>
                  <SelectItem value="no_recomendable">No recomendable</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Complejidad</Label>
              <Select value={form.complejidad} onValueChange={v => setForm(f => ({ ...f, complejidad: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="baja">Baja</SelectItem>
                  <SelectItem value="media">Media</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="muy_alta">Muy alta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Potencial crecimiento</Label>
              <Select value={form.potencial_crecimiento} onValueChange={v => setForm(f => ({ ...f, potencial_crecimiento: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bajo">Bajo</SelectItem>
                  <SelectItem value="medio">Medio</SelectItem>
                  <SelectItem value="alto">Alto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Horas estimadas/mes</Label><Input type="number" value={form.horas_estimadas} onChange={e => setForm(f => ({ ...f, horas_estimadas: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Horas reales/mes</Label><Input type="number" value={form.horas_reales} onChange={e => setForm(f => ({ ...f, horas_reales: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Origen cliente</Label><Input value={form.origen_cliente || ''} onChange={e => setForm(f => ({ ...f, origen_cliente: e.target.value }))} placeholder="Referido, web, publicidad..." /></div>
            <div className="space-y-1.5"><Label>Próxima acción</Label><Input value={form.proxima_accion || ''} onChange={e => setForm(f => ({ ...f, proxima_accion: e.target.value }))} /></div>
            <div className="col-span-2 space-y-1.5"><Label>Observaciones internas (confidencial)</Label>
              <Textarea value={form.observaciones_internas || ''} onChange={e => setForm(f => ({ ...f, observaciones_internas: e.target.value }))} rows={3} placeholder="Notas internas, incidencias, recomendaciones..." />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-taxea-red hover:bg-taxea-accent text-white">{saving ? 'Guardando...' : 'Guardar CRM'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}