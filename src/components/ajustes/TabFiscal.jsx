import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Building2, Briefcase, Shield, Loader2, CheckCircle, AlertTriangle, Plus, Trash2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';

const TERRITORIOS = [
  { value: 'peninsula_baleares', label: 'Península/Baleares (IVA)' },
  { value: 'canarias', label: 'Canarias (IGIC)' },
  { value: 'ceuta_melilla', label: 'Ceuta/Melilla' },
  { value: 'ue', label: 'Extranjero UE' },
  { value: 'no_ue', label: 'Extranjero no UE' },
];

const ENTITY_TYPES = [
  { value: 'autonomo', label: 'Autónomo (Persona física)' },
  { value: 'sociedad', label: 'Sociedad mercantil' },
  { value: 'comunidad_bienes', label: 'Comunidad de bienes' },
  { value: 'sociedad_civil', label: 'Sociedad civil' },
  { value: 'asociacion_fundacion', label: 'Asociación/Fundación' },
  { value: 'entidad_publica', label: 'Entidad pública' },
  { value: 'otra', label: 'Otra' },
];

const ACTIVITY_TYPES = [
  { value: 'profesional', label: 'Profesional' },
  { value: 'empresarial', label: 'Empresarial' },
  { value: 'comercial_minorista', label: 'Comercio minorista' },
  { value: 'agricola_ganadera', label: 'Agrícola/Ganadera' },
  { value: 'inmobiliaria', label: 'Inmobiliaria' },
  { value: 'sanitaria', label: 'Sanitaria' },
  { value: 'educativa', label: 'Educativa' },
  { value: 'hosteleria', label: 'Hostelería' },
  { value: 'ecommerce', label: 'E-commerce' },
  { value: 'construccion_inmuebles', label: 'Construcción/Inmuebles' },
  { value: 'transporte', label: 'Transporte' },
  { value: 'otra', label: 'Otra' },
];

const REGIMENES = [
  { value: 'general', label: 'Régimen general' },
  { value: 'exenta_limitada', label: 'Exenta limitada' },
  { value: 'exenta_plena', label: 'Exenta plena' },
  { value: 'no_sujeta', label: 'No sujeta' },
  { value: 'simplificado', label: 'Simplificado' },
  { value: 'recargo_equivalencia', label: 'Recargo de equivalencia' },
  { value: 'criterio_caja', label: 'Criterio de caja' },
  { value: 'comerciante_minorista_igic', label: 'Comerciante minorista IGIC' },
  { value: 'pequeno_empresario_igic', label: 'Pequeño empresario IGIC' },
  { value: 'mixto', label: 'Mixto' },
];

const DEDUCCION = [
  { value: 'pleno', label: 'Derecho pleno' },
  { value: 'limitado', label: 'Limitado' },
  { value: 'sin_derecho', label: 'Sin derecho' },
  { value: 'prorrata_general', label: 'Prorrata general' },
  { value: 'prorrata_especial', label: 'Prorrata especial' },
  { value: 'sector_diferenciado', label: 'Sector diferenciado' },
];

export default function TabFiscal() {
  const { company, user, isAdmin } = useOutletContext() || {};
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState(null);
  const [activities, setActivities] = useState([]);
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [newActivity, setNewActivity] = useState({ name: '', iaeCode: '', activityType: 'profesional', indirectTax: 'iva', indirectTaxRegime: 'general', deductionRight: 'pleno', proRataPercent: 100, defaultTaxRate: 21, defaultWithholdingRate: 0, automationLevel: 'proponer_revisar', active: true });
  const [savedToast, setSavedToast] = useState(false);

  useEffect(() => {
    if (company?.id) loadFiscalData();
    else setLoading(false);
  }, [company?.id]);

  const loadFiscalData = async () => {
    setLoading(true);
    try {
      const [profiles, acts] = await Promise.all([
        base44.entities.FiscalProfile.filter({ company_id: company.id }),
        base44.entities.FiscalActivity.filter({ company_id: company.id }),
      ]);
      if (profiles?.length > 0) {
        setProfile(profiles[0]);
      } else {
        setProfile({
          company_id: company.id,
          fiscalName: company.razon_social || company.nombre_comercial || '',
          taxId: company.nif_cif || '',
          entityType: 'autonomo',
          mainTerritory: 'peninsula_baleares',
          taxAuthority: 'aeat',
          filingFrequency: 'trimestral',
          indirectTaxDefault: 'iva',
          defaultVatRate: 21,
          defaultIgicRate: 7,
          subjectToIRPF: false,
          irpfEstimation: 'no_aplica',
          defaultWithholdingRate: 0,
          isProfessionalWithRetention: false,
          isPropertyLessor: false,
          active: true,
        });
      }
      setActivities(acts || []);
    } catch (e) {
      console.error('Error loading fiscal data:', e);
    }
    setLoading(false);
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      if (profile.id) {
        await base44.entities.FiscalProfile.update(profile.id, { ...profile, reviewedAt: new Date().toISOString(), reviewedBy: user?.email });
      } else {
        const created = await base44.entities.FiscalProfile.create({ ...profile, reviewedAt: new Date().toISOString(), reviewedBy: user?.email });
        setProfile(created);
      }
      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 3000);
    } catch (e) {
      console.error('Error saving profile:', e);
    }
    setSaving(false);
  };

  const handleAddActivity = async () => {
    if (!newActivity.name) return;
    try {
      const created = await base44.entities.FiscalActivity.create({
        ...newActivity,
        company_id: company.id,
        fiscalProfileId: profile?.id || '',
      });
      setActivities(prev => [...prev, created]);
      setNewActivity({ name: '', iaeCode: '', activityType: 'profesional', indirectTax: 'iva', indirectTaxRegime: 'general', deductionRight: 'pleno', proRataPercent: 100, defaultTaxRate: 21, defaultWithholdingRate: 0, automationLevel: 'proponer_revisar', active: true });
      setShowActivityForm(false);
    } catch (e) {
      console.error('Error adding activity:', e);
    }
  };

  const handleDeleteActivity = async (id) => {
    try {
      await base44.entities.FiscalActivity.delete(id);
      setActivities(prev => prev.filter(a => a.id !== id));
    } catch (e) {
      console.error('Error deleting activity:', e);
    }
  };

  const set = (k, v) => setProfile(p => ({ ...p, [k]: v }));

  if (loading) return <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></div>;

  return (
    <div className="space-y-6">
      {savedToast && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-green-600" />
          <span className="text-sm text-green-800">Configuración fiscal guardada correctamente</span>
        </div>
      )}

      {/* Sección 1: Identidad fiscal */}
      <div className="bg-card rounded-xl border border-border shadow-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Building2 className="w-5 h-5 text-primary" />
          <h3 className="font-jakarta font-semibold text-foreground text-sm">1. Identidad fiscal del cliente</h3>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-xs">Nombre fiscal</Label>
            <Input value={profile?.fiscalName || ''} onChange={e => set('fiscalName', e.target.value)} className="h-9 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">NIF/CIF</Label>
            <Input value={profile?.taxId || ''} onChange={e => set('taxId', e.target.value)} className="h-9 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Tipo de cliente *</Label>
            <Select value={profile?.entityType || 'autonomo'} onValueChange={v => set('entityType', v)}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>{ENTITY_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Territorio fiscal *</Label>
            <Select value={profile?.mainTerritory || 'peninsula_baleares'} onValueChange={v => set('mainTerritory', v)}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>{TERRITORIOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Administración tributaria</Label>
            <Select value={profile?.taxAuthority || 'aeat'} onValueChange={v => set('taxAuthority', v)}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="aeat">AEAT</SelectItem>
                <SelectItem value="atc">ATC (Canarias)</SelectItem>
                <SelectItem value="ambas">Ambas</SelectItem>
                <SelectItem value="otra">Otra</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Periodicidad declarativa</Label>
            <Select value={profile?.filingFrequency || 'trimestral'} onValueChange={v => set('filingFrequency', v)}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="trimestral">Trimestral</SelectItem>
                <SelectItem value="mensual">Mensual</SelectItem>
                <SelectItem value="anual">Anual</SelectItem>
                <SelectItem value="ocasional">Ocasional</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 mt-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={profile?.isLargeCompany || false} onCheckedChange={v => set('isLargeCompany', v === true)} />
            <span className="text-xs text-foreground">Gran empresa</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={profile?.isREDEME || false} onCheckedChange={v => set('isREDEME', v === true)} />
            <span className="text-xs text-foreground">REDEME</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={profile?.usesSII || false} onCheckedChange={v => set('usesSII', v === true)} />
            <span className="text-xs text-foreground">SII</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={profile?.usesVeriFactu || false} onCheckedChange={v => set('usesVeriFactu', v === true)} />
            <span className="text-xs text-foreground">VERI*FACTU</span>
          </label>
        </div>

        <div className="flex justify-end mt-4">
          <Button onClick={handleSaveProfile} disabled={saving} className="bg-teal hover:bg-teal-dark h-9 gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Guardando...' : 'Guardar identidad fiscal'}
          </Button>
        </div>
      </div>

      {/* Sección 2: Configuración impuesto indirecto */}
      <div className="bg-card rounded-xl border border-border shadow-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-primary" />
          <h3 className="font-jakarta font-semibold text-foreground text-sm">2. Configuración IVA / IGIC</h3>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-xs">Impuesto indirecto principal</Label>
            <Select value={profile?.indirectTaxDefault || 'iva'} onValueChange={v => set('indirectTaxDefault', v)}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="iva">IVA</SelectItem>
                <SelectItem value="igic">IGIC</SelectItem>
                <SelectItem value="mixto">Mixto</SelectItem>
                <SelectItem value="no_aplica">No aplica</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Tipo IVA por defecto (%)</Label>
            <Input type="number" value={profile?.defaultVatRate ?? 21} onChange={e => set('defaultVatRate', parseFloat(e.target.value))} className="h-9 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Tipo IGIC por defecto (%)</Label>
            <Input type="number" value={profile?.defaultIgicRate ?? 7} onChange={e => set('defaultIgicRate', parseFloat(e.target.value))} className="h-9 text-sm" />
          </div>
        </div>
      </div>

      {/* Sección 3: IRPF y retenciones */}
      <div className="bg-card rounded-xl border border-border shadow-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Briefcase className="w-5 h-5 text-primary" />
          <h3 className="font-jakarta font-semibold text-foreground text-sm">3. IRPF y retenciones</h3>
        </div>
        <div className="flex flex-wrap gap-4 mb-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={profile?.subjectToIRPF || false} onCheckedChange={v => set('subjectToIRPF', v === true)} />
            <span className="text-xs text-foreground">Sujeto a IRPF</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={profile?.isProfessionalWithRetention || false} onCheckedChange={v => set('isProfessionalWithRetention', v === true)} />
            <span className="text-xs text-foreground">Actividad profesional con retención</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={profile?.isPropertyLessor || false} onCheckedChange={v => set('isPropertyLessor', v === true)} />
            <span className="text-xs text-foreground">Arrendador de inmueble urbano</span>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-xs">Estimación IRPF</Label>
            <Select value={profile?.irpfEstimation || 'no_aplica'} onValueChange={v => set('irpfEstimation', v)}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="no_aplica">No aplica</SelectItem>
                <SelectItem value="directa_normal">Directa normal</SelectItem>
                <SelectItem value="directa_simplificada">Directa simplificada</SelectItem>
                <SelectItem value="objetiva_modulos">Objetiva/módulos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Retención por defecto (%)</Label>
            <Input type="number" value={profile?.defaultWithholdingRate ?? 0} onChange={e => set('defaultWithholdingRate', parseFloat(e.target.value))} className="h-9 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Fecha inicio actividad profesional</Label>
            <Input type="date" value={profile?.professionalActivityStartDate || ''} onChange={e => set('professionalActivityStartDate', e.target.value)} className="h-9 text-sm" />
          </div>
        </div>
        {profile?.isProfessionalWithRetention && profile?.professionalActivityStartDate && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 mt-3">
            <p className="text-xs text-blue-700">
              {Math.floor((new Date() - new Date(profile.professionalActivityStartDate)) / (365.25 * 24 * 60 * 60 * 1000)) <= 2
                ? '✓ Detectado profesional de nuevo inicio (≤2 años): retención aplicable 7%'
                : 'Profesional con más de 2 años de actividad: retención general 15%'}
            </p>
          </div>
        )}
        <div className="flex justify-end mt-4">
          <Button onClick={handleSaveProfile} disabled={saving} className="bg-teal hover:bg-teal-dark h-9 gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar IRPF
          </Button>
        </div>
      </div>

      {/* Sección 4: Actividades económicas */}
      <div className="bg-card rounded-xl border border-border shadow-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-primary" />
            <h3 className="font-jakarta font-semibold text-foreground text-sm">4. Actividades económicas ({activities.length})</h3>
          </div>
          <Button size="sm" variant="outline" onClick={() => setShowActivityForm(!showActivityForm)} className="h-8 gap-1 text-xs">
            <Plus className="w-3.5 h-3.5" /> Añadir actividad
          </Button>
        </div>

        {activities.length === 0 && !showActivityForm && (
          <div className="text-center py-6">
            <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No hay actividades configuradas. El motor fiscal no puede clasificar facturas sin actividad vinculada.</p>
          </div>
        )}

        {showActivityForm && (
          <div className="bg-secondary/30 rounded-lg p-4 mb-3 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Nombre interno *</Label>
                <Input value={newActivity.name} onChange={e => setNewActivity(a => ({ ...a, name: e.target.value }))} className="h-9 text-sm" placeholder="Ej: Asesoría fiscal" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Epígrafe IAE</Label>
                <Input value={newActivity.iaeCode} onChange={e => setNewActivity(a => ({ ...a, iaeCode: e.target.value }))} className="h-9 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tipo de actividad</Label>
                <Select value={newActivity.activityType} onValueChange={v => setNewActivity(a => ({ ...a, activityType: v }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{ACTIVITY_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Impuesto indirecto</Label>
                <Select value={newActivity.indirectTax} onValueChange={v => setNewActivity(a => ({ ...a, indirectTax: v }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="iva">IVA</SelectItem>
                    <SelectItem value="igic">IGIC</SelectItem>
                    <SelectItem value="mixto">Mixto</SelectItem>
                    <SelectItem value="no_aplica">No aplica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Régimen</Label>
                <Select value={newActivity.indirectTaxRegime} onValueChange={v => setNewActivity(a => ({ ...a, indirectTaxRegime: v }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{REGIMENES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Derecho a deducción</Label>
                <Select value={newActivity.deductionRight} onValueChange={v => setNewActivity(a => ({ ...a, deductionRight: v }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{DEDUCCION.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">% Prorrata</Label>
                <Input type="number" value={newActivity.proRataPercent} onChange={e => setNewActivity(a => ({ ...a, proRataPercent: parseFloat(e.target.value) }))} className="h-9 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tipo impositivo defecto (%)</Label>
                <Input type="number" value={newActivity.defaultTaxRate} onChange={e => setNewActivity(a => ({ ...a, defaultTaxRate: parseFloat(e.target.value) }))} className="h-9 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Nivel de automatización</Label>
                <Select value={newActivity.automationLevel} onValueChange={v => setNewActivity(a => ({ ...a, automationLevel: v }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="automatico">Automático</SelectItem>
                    <SelectItem value="proponer_revisar">Proponer y revisar</SelectItem>
                    <SelectItem value="siempre_revisar">Siempre revisar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setShowActivityForm(false)}>Cancelar</Button>
              <Button size="sm" onClick={handleAddActivity} className="bg-teal hover:bg-teal-dark">Crear actividad</Button>
            </div>
          </div>
        )}

        {activities.length > 0 && (
          <div className="space-y-2">
            {activities.map(act => (
              <div key={act.id} className="flex items-center justify-between border border-border rounded-lg p-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{act.name}</span>
                    <Badge variant="outline" className="text-[10px]">{act.activityType}</Badge>
                    <Badge variant="outline" className="text-[10px]">{act.indirectTax?.toUpperCase()}</Badge>
                    <Badge variant="outline" className="text-[10px]">{act.indirectTaxRegime}</Badge>
                  </div>
                  {act.iaeCode && <span className="text-xs text-muted-foreground">IAE: {act.iaeCode}</span>}
                  <span className="text-xs text-muted-foreground ml-2">· Deducción: {act.deductionRight} · Auto: {act.automationLevel}</span>
                </div>
                <button onClick={() => handleDeleteActivity(act.id)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {profile?.reviewedAt && (
        <div className="text-xs text-muted-foreground text-right">
          Última revisión: {new Date(profile.reviewedAt).toLocaleDateString('es-ES')} por {profile.reviewedBy || '—'}
        </div>
      )}
    </div>
  );
}