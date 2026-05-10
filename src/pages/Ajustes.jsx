import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Settings, Building2, Save, User, Shield } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';

export default function Ajustes() {
  const { company, user, isAdmin } = useOutletContext() || {};
  const [companyForm, setCompanyForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (company) setCompanyForm({ ...company });
  }, [company]);

  const handleSave = async () => {
    if (!company?.id) return;
    setSaving(true);
    await base44.entities.Company.update(company.id, companyForm);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div>
      <PageHeader title="Ajustes" subtitle="Configuración de empresa y perfil" />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Datos de empresa */}
          <div className="bg-card rounded-xl border border-border shadow-card p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 bg-teal-light rounded-lg flex items-center justify-center">
                <Building2 className="w-4 h-4 text-teal" />
              </div>
              <h2 className="font-jakarta font-semibold text-foreground">Datos de la empresa</h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Nombre comercial</Label>
                <Input value={companyForm.nombre_comercial || ''} onChange={e => setCompanyForm(f => ({ ...f, nombre_comercial: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Razón social *</Label>
                <Input value={companyForm.razon_social || ''} onChange={e => setCompanyForm(f => ({ ...f, razon_social: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>NIF / CIF *</Label>
                <Input value={companyForm.nif_cif || ''} onChange={e => setCompanyForm(f => ({ ...f, nif_cif: e.target.value }))} placeholder="B12345678" />
              </div>
              <div className="space-y-1.5">
                <Label>Teléfono</Label>
                <Input value={companyForm.telefono || ''} onChange={e => setCompanyForm(f => ({ ...f, telefono: e.target.value }))} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={companyForm.email || ''} onChange={e => setCompanyForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Dirección fiscal</Label>
                <Input value={companyForm.direccion_fiscal || ''} onChange={e => setCompanyForm(f => ({ ...f, direccion_fiscal: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Régimen fiscal</Label>
                <Select value={companyForm.regimen_fiscal || ''} onValueChange={v => setCompanyForm(f => ({ ...f, regimen_fiscal: v }))}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="autonomo">Autónomo</SelectItem>
                    <SelectItem value="sociedad_limitada">Sociedad Limitada</SelectItem>
                    <SelectItem value="sociedad_anonima">Sociedad Anónima</SelectItem>
                    <SelectItem value="comunidad_bienes">Comunidad de Bienes</SelectItem>
                    <SelectItem value="asociacion">Asociación</SelectItem>
                    <SelectItem value="otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Tipo de impuesto</Label>
                <Select value={companyForm.tipo_impuesto || ''} onValueChange={v => setCompanyForm(f => ({ ...f, tipo_impuesto: v }))}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="iva">IVA</SelectItem>
                    <SelectItem value="igic">IGIC (Canarias)</SelectItem>
                    <SelectItem value="exento">Exento</SelectItem>
                    <SelectItem value="mixto">Mixto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Actividad económica</Label>
                <Input value={companyForm.actividad || ''} onChange={e => setCompanyForm(f => ({ ...f, actividad: e.target.value }))} placeholder="Ej: Consultoría informática" />
              </div>
              <div className="space-y-1.5">
                <Label>Epígrafe IAE</Label>
                <Input value={companyForm.epigrafe_iae || ''} onChange={e => setCompanyForm(f => ({ ...f, epigrafe_iae: e.target.value }))} placeholder="Ej: 773" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Datos bancarios (opcional)</Label>
                <Textarea
                  value={companyForm.datos_bancarios || ''}
                  onChange={e => setCompanyForm(f => ({ ...f, datos_bancarios: e.target.value }))}
                  placeholder="IBAN, entidad bancaria..."
                  rows={2}
                />
              </div>
            </div>
            <div className="flex justify-end mt-5">
              <Button onClick={handleSave} disabled={saving} className="bg-teal hover:bg-teal-dark">
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Guardando...' : saved ? '¡Guardado!' : 'Guardar cambios'}
              </Button>
            </div>
          </div>
        </div>

        {/* Panel derecho */}
        <div className="space-y-4">
          {/* Info usuario */}
          <div className="bg-card rounded-xl border border-border shadow-card p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 bg-teal-light rounded-lg flex items-center justify-center">
                <User className="w-4 h-4 text-teal" />
              </div>
              <h3 className="font-jakarta font-semibold text-foreground text-sm">Mi perfil</h3>
            </div>
            <div className="space-y-2">
              <div>
                <p className="text-xs text-muted-foreground">Nombre</p>
                <p className="text-sm font-medium text-foreground">{user?.full_name || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="text-sm text-foreground">{user?.email || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Rol</p>
                <span className={`text-xs px-2 py-0.5 rounded font-medium ${isAdmin ? 'bg-gold-light text-yellow-700' : 'bg-teal-light text-teal'}`}>
                  {isAdmin ? 'Administrador' : 'Cliente'}
                </span>
              </div>
            </div>
          </div>

          {/* Info seguridad */}
          <div className="bg-card rounded-xl border border-border shadow-card p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
                <Shield className="w-4 h-4 text-blue-600" />
              </div>
              <h3 className="font-jakarta font-semibold text-foreground text-sm">Seguridad y privacidad</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Todos tus datos son privados y confidenciales. Solo tú y tu asesor de Taxea Strategies tienen acceso a tu información fiscal y contable.
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed mt-2">
              Portal en cumplimiento con el RGPD y la LOPDGDD.
            </p>
          </div>

          {/* Contacto asesor */}
          <div className="bg-teal/5 border border-teal/20 rounded-xl p-5">
            <p className="text-sm font-medium text-teal mb-1">¿Necesitas ayuda?</p>
            <p className="text-xs text-muted-foreground">
              Tu asesor de Taxea Strategies está disponible para resolver cualquier duda sobre tu gestión fiscal y contable.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}