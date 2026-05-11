import { useState, useEffect, useCallback, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Building2, Save, User, Shield, AlertCircle, CheckCircle2 } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

// ─── Field helper — defined OUTSIDE the page component so it never gets
//     re-created on each render (which would destroy/remount the <input>
//     and cause focus loss on every keystroke).
function Field({ label, name, required, error, colSpan, children }) {
  return (
    <div className={`space-y-1.5${colSpan ? ' col-span-2' : ''}`}>
      <Label>{label}{required ? ' *' : ''}</Label>
      {children}
      {error && (
        <p className="text-xs text-destructive flex items-center gap-1">
          <AlertCircle className="w-3 h-3" /> {error}
        </p>
      )}
    </div>
  );
}

const EMPTY_FORM = {
  nombre_comercial: '',
  razon_social: '',
  nif_cif: '',
  telefono: '',
  email: '',
  direccion_fiscal: '',
  regimen_fiscal: '',
  tipo_impuesto: '',
  actividad: '',
  datos_bancarios: '',
};

function validate(form) {
  const e = {};
  if (!form.razon_social?.trim()) e.razon_social = 'Campo obligatorio';
  if (!form.nif_cif?.trim()) e.nif_cif = 'Campo obligatorio';
  if (!form.email?.trim()) e.email = 'Campo obligatorio';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Formato de email no válido';
  if (!form.direccion_fiscal?.trim()) e.direccion_fiscal = 'Campo obligatorio';
  if (!form.regimen_fiscal) e.regimen_fiscal = 'Selecciona una opción';
  if (!form.tipo_impuesto) e.tipo_impuesto = 'Selecciona una opción';
  if (!form.actividad?.trim()) e.actividad = 'Campo obligatorio';
  if (!form.datos_bancarios?.trim()) e.datos_bancarios = 'Campo obligatorio';
  return e;
}

export default function Ajustes() {
  const { company, user, isAdmin, refreshCompany } = useOutletContext() || {};

  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // 'success' | 'error'
  const [errors, setErrors] = useState({});
  const [dirty, setDirty] = useState(false);

  // Load initial data once (when company first becomes available)
  const loadedRef = useRef(false);
  useEffect(() => {
    if (company && !loadedRef.current) {
      loadedRef.current = true;
      setForm({
        nombre_comercial: company.nombre_comercial || '',
        razon_social: company.razon_social || '',
        nif_cif: company.nif_cif || '',
        telefono: company.telefono || '',
        email: company.email || '',
        direccion_fiscal: company.direccion_fiscal || '',
        regimen_fiscal: company.regimen_fiscal || '',
        tipo_impuesto: company.tipo_impuesto || '',
        actividad: company.actividad || '',
        datos_bancarios: company.datos_bancarios || '',
      });
    }
  }, [company]);

  // Generic text input handler — stable reference via useCallback
  const handleChange = useCallback((field) => (e) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }));
    setDirty(true);
    setErrors(prev => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  // Select handler
  const handleSelect = useCallback((field) => (value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setDirty(true);
    setErrors(prev => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const handleSave = async () => {
    const validationErrors = validate(form);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSaving(true);
    setSaveStatus(null);

    try {
      const payload = { ...form, owner_email: user?.email, activa: true };

      if (company?.id) {
        await base44.entities.Company.update(company.id, payload);
      } else {
        await base44.entities.Company.create(payload);
      }

      setDirty(false);
      loadedRef.current = false; // allow re-load on next company refresh
      if (refreshCompany) refreshCompany();
      setSaveStatus('success');
      setTimeout(() => setSaveStatus(null), 4000);
    } catch {
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader title="Ajustes" subtitle="Configuración de empresa y perfil" />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card rounded-xl border border-border shadow-card p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 bg-teal-light rounded-lg flex items-center justify-center">
                <Building2 className="w-4 h-4 text-teal" />
              </div>
              <div>
                <h2 className="font-jakarta font-semibold text-foreground">Datos de la empresa</h2>
                {!company && (
                  <p className="text-xs text-amber-600 mt-0.5">
                    Completa los datos de tu empresa para poder crear facturas y utilizar Taxea Portal.
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Nombre comercial" name="nombre_comercial" error={errors.nombre_comercial}>
                <Input value={form.nombre_comercial} onChange={handleChange('nombre_comercial')} placeholder="Nombre con el que opera" />
              </Field>

              <Field label="Razón social" name="razon_social" required error={errors.razon_social}>
                <Input value={form.razon_social} onChange={handleChange('razon_social')} placeholder="Nombre fiscal completo" className={errors.razon_social ? 'border-destructive' : ''} />
              </Field>

              <Field label="NIF / CIF" name="nif_cif" required error={errors.nif_cif}>
                <Input value={form.nif_cif} onChange={handleChange('nif_cif')} placeholder="B12345678" className={errors.nif_cif ? 'border-destructive' : ''} />
              </Field>

              <Field label="Teléfono" name="telefono" error={errors.telefono}>
                <Input value={form.telefono} onChange={handleChange('telefono')} placeholder="+34 600 000 000" />
              </Field>

              <Field label="Email" name="email" required error={errors.email} colSpan>
                <Input type="email" value={form.email} onChange={handleChange('email')} placeholder="empresa@ejemplo.com" className={errors.email ? 'border-destructive' : ''} />
              </Field>

              <Field label="Dirección fiscal" name="direccion_fiscal" required error={errors.direccion_fiscal} colSpan>
                <Input value={form.direccion_fiscal} onChange={handleChange('direccion_fiscal')} placeholder="Calle, número, CP, municipio, provincia" className={errors.direccion_fiscal ? 'border-destructive' : ''} />
              </Field>

              <Field label="Régimen fiscal" name="regimen_fiscal" required error={errors.regimen_fiscal}>
                <Select value={form.regimen_fiscal} onValueChange={handleSelect('regimen_fiscal')}>
                  <SelectTrigger className={errors.regimen_fiscal ? 'border-destructive' : ''}>
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="autonomo">Autónomo</SelectItem>
                    <SelectItem value="sociedad_limitada">Sociedad Limitada</SelectItem>
                    <SelectItem value="profesional">Profesional</SelectItem>
                    <SelectItem value="empresario_individual">Empresario individual</SelectItem>
                    <SelectItem value="comunidad_bienes">Comunidad de Bienes</SelectItem>
                    <SelectItem value="otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Tipo de impuesto" name="tipo_impuesto" required error={errors.tipo_impuesto}>
                <Select value={form.tipo_impuesto} onValueChange={handleSelect('tipo_impuesto')}>
                  <SelectTrigger className={errors.tipo_impuesto ? 'border-destructive' : ''}>
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="iva">IVA</SelectItem>
                    <SelectItem value="igic">IGIC (Canarias)</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Actividad económica" name="actividad" required error={errors.actividad} colSpan>
                <Input value={form.actividad} onChange={handleChange('actividad')} placeholder="Ej: Consultoría informática" className={errors.actividad ? 'border-destructive' : ''} />
              </Field>

              <Field label="Datos bancarios *" name="datos_bancarios" error={errors.datos_bancarios} colSpan>
                <Textarea value={form.datos_bancarios} onChange={handleChange('datos_bancarios')} placeholder="IBAN y entidad bancaria" rows={2} className={errors.datos_bancarios ? 'border-destructive' : ''} />
              </Field>
            </div>

            {/* Status messages */}
            {dirty && !saveStatus && (
              <p className="mt-4 text-xs text-amber-600">Cambios sin guardar</p>
            )}
            {saveStatus === 'success' && (
              <div className="mt-4 flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2.5">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                Datos de empresa guardados correctamente.
              </div>
            )}
            {saveStatus === 'error' && (
              <div className="mt-4 flex items-center gap-2 text-sm text-destructive bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                No se pudieron guardar los cambios. Revisa los campos e inténtalo de nuevo.
              </div>
            )}

            <div className="flex justify-end mt-5">
              <Button onClick={handleSave} disabled={saving} className="bg-teal hover:bg-teal-dark">
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </Button>
            </div>
          </div>
        </div>

        {/* Panel derecho */}
        <div className="space-y-4">
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