import { useCallback, useRef, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Building2, Save, ImagePlus, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

function Field({ label, required, error, colSpan, children }) {
  return (
    <div className={`space-y-1.5${colSpan ? ' col-span-2' : ''}`}>
      <Label>{label}{required ? ' *' : ''}</Label>
      {children}
      {error && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="w-3 h-3" />{error}</p>}
    </div>
  );
}

const EMPTY_FORM = { nombre_comercial:'',razon_social:'',nif_cif:'',telefono:'',email:'',direccion_fiscal:'',regimen_fiscal:'',tipo_impuesto:'',actividad:'',datos_bancarios:'',logo_url:'' };

function validate(form) {
  const e = {};
  if (!form.razon_social?.trim()) e.razon_social = 'Obligatorio';
  if (!form.nif_cif?.trim()) e.nif_cif = 'Obligatorio';
  if (!form.email?.trim()) e.email = 'Obligatorio';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Email inválido';
  if (!form.regimen_fiscal) e.regimen_fiscal = 'Selecciona';
  if (!form.tipo_impuesto) e.tipo_impuesto = 'Selecciona';
  return e;
}

export default function TabEmpresa({ company, user, refreshCompany }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const [errors, setErrors] = useState({});
  const [dirty, setDirty] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (company && !loadedRef.current) {
      loadedRef.current = true;
      setForm({ nombre_comercial:company.nombre_comercial||'',razon_social:company.razon_social||'',nif_cif:company.nif_cif||'',telefono:company.telefono||'',email:company.email||'',direccion_fiscal:company.direccion_fiscal||'',regimen_fiscal:company.regimen_fiscal||'',tipo_impuesto:company.tipo_impuesto||'',actividad:company.actividad||'',datos_bancarios:company.datos_bancarios||'',logo_url:company.logo_url||'' });
    }
  }, [company]);

  const handleChange = useCallback((field) => (e) => {
    setForm(p => ({ ...p, [field]: e.target.value }));
    setDirty(true);
    setErrors(p => { if (!p[field]) return p; const n={...p}; delete n[field]; return n; });
  }, []);

  const handleSelect = useCallback((field) => (value) => {
    setForm(p => ({ ...p, [field]: value }));
    setDirty(true);
    setErrors(p => { if (!p[field]) return p; const n={...p}; delete n[field]; return n; });
  }, []);

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm(p => ({ ...p, logo_url: file_url }));
    setDirty(true);
    setUploadingLogo(false);
  };

  const handleSave = async () => {
    const errs = validate(form);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setSaving(true);
    setSaveStatus(null);
    try {
      const payload = { ...form, owner_email: user?.email, activa: true };
      if (company?.id) await base44.entities.Company.update(company.id, payload);
      else await base44.entities.Company.create(payload);
      setDirty(false);
      loadedRef.current = false;
      if (refreshCompany) refreshCompany();
      setSaveStatus('success');
      setTimeout(() => setSaveStatus(null), 4000);
    } catch { setSaveStatus('error'); }
    finally { setSaving(false); }
  };

  return (
    <div className="bg-card rounded-xl border border-border shadow-card p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 bg-teal-light rounded-lg flex items-center justify-center"><Building2 className="w-4 h-4 text-teal" /></div>
        <div>
          <h2 className="font-jakarta font-semibold text-foreground">Datos de la empresa</h2>
          {!company && <p className="text-xs text-amber-600 mt-0.5">Completa los datos para activar tu portal.</p>}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Nombre comercial" error={errors.nombre_comercial}><Input value={form.nombre_comercial} onChange={handleChange('nombre_comercial')} /></Field>
        <Field label="Razón social" required error={errors.razon_social}><Input value={form.razon_social} onChange={handleChange('razon_social')} className={errors.razon_social?'border-destructive':''} /></Field>
        <Field label="NIF / CIF" required error={errors.nif_cif}><Input value={form.nif_cif} onChange={handleChange('nif_cif')} className={errors.nif_cif?'border-destructive':''} /></Field>
        <Field label="Teléfono"><Input value={form.telefono} onChange={handleChange('telefono')} /></Field>
        <Field label="Email" required error={errors.email} colSpan><Input type="email" value={form.email} onChange={handleChange('email')} className={errors.email?'border-destructive':''} /></Field>
        <Field label="Dirección fiscal" colSpan><Input value={form.direccion_fiscal} onChange={handleChange('direccion_fiscal')} /></Field>
        <Field label="Régimen fiscal" required error={errors.regimen_fiscal}>
          <Select value={form.regimen_fiscal} onValueChange={handleSelect('regimen_fiscal')}>
            <SelectTrigger className={errors.regimen_fiscal?'border-destructive':''}><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
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
        <Field label="Tipo de impuesto" required error={errors.tipo_impuesto}>
          <Select value={form.tipo_impuesto} onValueChange={handleSelect('tipo_impuesto')}>
            <SelectTrigger className={errors.tipo_impuesto?'border-destructive':''}><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="iva">IVA</SelectItem>
              <SelectItem value="igic">IGIC (Canarias)</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Actividad económica" colSpan><Input value={form.actividad} onChange={handleChange('actividad')} /></Field>
        <div className="col-span-2 space-y-2">
          <Label>Logo de empresa</Label>
          <div className="flex items-center gap-4">
            {form.logo_url ? (
              <div className="relative">
                <img src={form.logo_url} alt="Logo" className="h-16 max-w-[160px] object-contain rounded-lg border border-border bg-white p-2" />
                <button onClick={() => { setForm(p => ({ ...p, logo_url: '' })); setDirty(true); }} className="absolute -top-2 -right-2 w-5 h-5 bg-destructive rounded-full flex items-center justify-center text-white"><X className="w-3 h-3" /></button>
              </div>
            ) : (
              <div className="w-16 h-16 rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-secondary/30"><ImagePlus className="w-5 h-5 text-muted-foreground" /></div>
            )}
            <div>
              <Button type="button" variant="outline" size="sm" disabled={uploadingLogo} onClick={() => logoInputRef.current?.click()}>
                {uploadingLogo ? 'Subiendo...' : form.logo_url ? 'Cambiar logo' : 'Subir logo'}
              </Button>
              <p className="text-xs text-muted-foreground mt-1">PNG, JPG, WebP · Máx. 5 MB</p>
              <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
            </div>
          </div>
        </div>
        <Field label="Datos bancarios" error={errors.datos_bancarios} colSpan><Textarea value={form.datos_bancarios} onChange={handleChange('datos_bancarios')} placeholder="IBAN y entidad bancaria" rows={2} /></Field>
      </div>
      {dirty && !saveStatus && <p className="mt-4 text-xs text-amber-600">Cambios sin guardar</p>}
      {saveStatus === 'success' && <div className="mt-4 flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2.5"><CheckCircle2 className="w-4 h-4" />Guardado correctamente.</div>}
      {saveStatus === 'error' && <div className="mt-4 flex items-center gap-2 text-sm text-destructive bg-red-50 border border-red-200 rounded-lg px-4 py-2.5"><AlertCircle className="w-4 h-4" />Error al guardar.</div>}
      <div className="flex justify-end mt-5">
        <Button onClick={handleSave} disabled={saving} className="bg-teal hover:bg-teal-dark">
          <Save className="w-4 h-4 mr-2" />{saving ? 'Guardando...' : 'Guardar cambios'}
        </Button>
      </div>
    </div>
  );
}