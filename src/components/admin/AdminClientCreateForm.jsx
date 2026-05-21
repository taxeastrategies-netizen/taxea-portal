import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Eye, EyeOff, RefreshCw, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

function generatePassword() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*';
  let pass = '';
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const nums = '0123456789';
  const syms = '!@#$%&*';
  pass += upper[Math.floor(Math.random() * upper.length)];
  pass += lower[Math.floor(Math.random() * lower.length)];
  pass += nums[Math.floor(Math.random() * nums.length)];
  pass += syms[Math.floor(Math.random() * syms.length)];
  for (let i = 4; i < 12; i++) pass += chars[Math.floor(Math.random() * chars.length)];
  return pass.split('').sort(() => Math.random() - 0.5).join('');
}

export default function AdminClientCreateForm({ open, onOpenChange, onCreated }) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [copiedMsg, setCopiedMsg] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [createdClient, setCreatedClient] = useState(null);

  const [form, setForm] = useState({
    clientType: 'empresa',
    legalName: '',
    displayName: '',
    taxId: '',
    representativeName: '',
    representativeTaxId: '',
    representativeRole: '',
    email: '',
    phone: '',
    activity: '',
    province: '',
    country: 'España',
    taxRegime: 'iva',
    plan: '',
    monthlyFee: '',
    paymentStatus: 'al_dia',
    accessStatus: 'pendiente_primer_acceso',
    internalOwner: '',
    registrationDate: new Date().toISOString().split('T')[0],
    notes: '',
    tempPassword: generatePassword(),
    forcePasswordChange: true,
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleGenPass = () => set('tempPassword', generatePassword());

  const copyWelcomeMessage = () => {
    const msg = `Hola, ya tienes activa tu cuenta en Taxea Portal.\n\nPuedes acceder desde: https://taxea-flow-portal.base44.app/login\n\nUsuario: ${form.email}\nContraseña temporal: ${form.tempPassword}\n\nPor seguridad, te recomendamos cambiarla tras el primer acceso.`;
    navigator.clipboard.writeText(msg);
    setCopiedMsg(true);
    setTimeout(() => setCopiedMsg(false), 2000);
  };

  const handleSubmit = async () => {
    setError('');
    if (!form.legalName || !form.taxId || !form.email) {
      setError('Razón social, NIF/CIF y email son obligatorios.');
      return;
    }
    if (form.tempPassword.length < 10) {
      setError('La contraseña temporal debe tener al menos 10 caracteres.');
      return;
    }
    setSaving(true);
    try {
      // 1. Crear ClientAccount
      const client = await base44.entities.ClientAccount.create({
        clientType: form.clientType,
        legalName: form.legalName,
        displayName: form.displayName || form.legalName,
        taxId: form.taxId,
        representativeName: form.representativeName,
        representativeTaxId: form.representativeTaxId,
        representativeRole: form.representativeRole,
        email: form.email,
        phone: form.phone,
        activity: form.activity,
        province: form.province,
        country: form.country,
        taxRegime: form.taxRegime,
        plan: form.plan,
        monthlyFee: parseFloat(form.monthlyFee) || 0,
        paymentStatus: form.paymentStatus,
        accessStatus: form.accessStatus,
        internalOwner: form.internalOwner,
        registrationDate: form.registrationDate,
        notes: form.notes,
        forcePasswordChange: form.forcePasswordChange,
        firstAccessCompleted: false,
        passwordChangedByClient: false,
        tempPasswordShared: false,
      });

      // 2. Invitar usuario en la plataforma
      try {
        await base44.users.inviteUser(form.email, 'user');
      } catch {}

      // 3. Audit log
      await base44.entities.ClientAccessAuditLog.create({
        clientAccountId: client.id,
        clientName: form.legalName,
        actionType: 'cuenta_creada',
        actionBy: 'admin',
        actionAt: new Date().toISOString(),
        details: `Cuenta creada. Email: ${form.email}. Régimen: ${form.taxRegime}. Plan: ${form.plan || '—'}`,
      });

      setCreatedClient({ ...client, tempPassword: form.tempPassword });
      setStep(3);
      onCreated?.();
    } catch (e) {
      setError(e.message || 'Error al crear el cliente.');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setStep(1);
    setCreatedClient(null);
    setError('');
    setForm({
      clientType: 'empresa', legalName: '', displayName: '', taxId: '',
      representativeName: '', representativeTaxId: '', representativeRole: '',
      email: '', phone: '', activity: '', province: '', country: 'España',
      taxRegime: 'iva', plan: '', monthlyFee: '', paymentStatus: 'al_dia',
      accessStatus: 'pendiente_primer_acceso', internalOwner: '', notes: '',
      registrationDate: new Date().toISOString().split('T')[0],
      tempPassword: generatePassword(), forcePasswordChange: true,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === 3 ? 'Cuenta creada correctamente' : 'Nuevo cliente / empresa'}
          </DialogTitle>
        </DialogHeader>

        {/* Step indicators */}
        {step < 3 && (
          <div className="flex gap-2 mb-2">
            {[1, 2].map(s => (
              <div key={s} className={`h-1.5 flex-1 rounded-full ${step >= s ? 'bg-primary' : 'bg-border'}`} />
            ))}
          </div>
        )}

        {/* STEP 1: Datos fiscales */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Tipo de cliente *</Label>
              <div className="grid grid-cols-2 gap-2">
                {['empresa', 'autonomo'].map(t => (
                  <button key={t} type="button"
                    onClick={() => set('clientType', t)}
                    className={`h-10 rounded-lg border text-sm font-medium transition-all ${form.clientType === t ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:border-primary/40'}`}>
                    {t === 'empresa' ? 'Empresa / S.L. / S.A.' : 'Autónomo / Persona física'}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label>{form.clientType === 'empresa' ? 'Razón social *' : 'Nombre completo *'}</Label>
                <Input value={form.legalName} onChange={e => set('legalName', e.target.value)} placeholder={form.clientType === 'empresa' ? 'EMPRESA SL' : 'Ana García Martínez'} />
              </div>
              <div className="space-y-1.5">
                <Label>Nombre comercial</Label>
                <Input value={form.displayName} onChange={e => set('displayName', e.target.value)} placeholder="Nombre visible" />
              </div>
              <div className="space-y-1.5">
                <Label>{form.clientType === 'empresa' ? 'CIF *' : 'NIF/NIE *'}</Label>
                <Input value={form.taxId} onChange={e => set('taxId', e.target.value)} placeholder={form.clientType === 'empresa' ? 'B12345678' : '12345678A'} />
              </div>
            </div>

            {form.clientType === 'empresa' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Representante</Label>
                  <Input value={form.representativeName} onChange={e => set('representativeName', e.target.value)} placeholder="Nombre del representante" />
                </div>
                <div className="space-y-1.5">
                  <Label>NIF representante</Label>
                  <Input value={form.representativeTaxId} onChange={e => set('representativeTaxId', e.target.value)} placeholder="12345678A" />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Régimen fiscal *</Label>
                <Select value={form.taxRegime} onValueChange={v => set('taxRegime', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="iva">IVA</SelectItem>
                    <SelectItem value="igic">IGIC (Canarias)</SelectItem>
                    <SelectItem value="exento">Exento</SelectItem>
                    <SelectItem value="mixto">Mixto</SelectItem>
                    <SelectItem value="pendiente">Pendiente confirmar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Actividad</Label>
                <Input value={form.activity} onChange={e => set('activity', e.target.value)} placeholder="Descripción actividad" />
              </div>
              <div className="space-y-1.5">
                <Label>Provincia</Label>
                <Input value={form.province} onChange={e => set('province', e.target.value)} placeholder="Madrid, Barcelona..." />
              </div>
              <div className="space-y-1.5">
                <Label>Teléfono</Label>
                <Input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+34 600 000 000" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Plan contratado</Label>
                <Input value={form.plan} onChange={e => set('plan', e.target.value)} placeholder="Básico, Premium..." />
              </div>
              <div className="space-y-1.5">
                <Label>Mensualidad (€)</Label>
                <Input type="number" value={form.monthlyFee} onChange={e => set('monthlyFee', e.target.value)} placeholder="0" />
              </div>
              <div className="space-y-1.5">
                <Label>Estado pago</Label>
                <Select value={form.paymentStatus} onValueChange={v => set('paymentStatus', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="al_dia">Al día</SelectItem>
                    <SelectItem value="pendiente">Pendiente</SelectItem>
                    <SelectItem value="no_aplica">No aplica</SelectItem>
                    <SelectItem value="revision">En revisión</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Responsable interno</Label>
                <Input value={form.internalOwner} onChange={e => set('internalOwner', e.target.value)} placeholder="Nombre del asesor" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Notas internas</Label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
                className="w-full h-20 px-3 py-2 text-sm border border-input rounded-md bg-transparent resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="Observaciones internas..." />
            </div>

            <div className="flex justify-end">
              <Button onClick={() => setStep(2)}>Continuar → Acceso al portal</Button>
            </div>
          </div>
        )}

        {/* STEP 2: Credenciales */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
              <strong>Seguridad:</strong> La contraseña temporal solo se mostrará en este momento. Cópiala antes de continuar.
            </div>

            <div className="space-y-1.5">
              <Label>Email de acceso *</Label>
              <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="cliente@email.com" />
            </div>

            <div className="space-y-1.5">
              <Label>Contraseña temporal *</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showPass ? 'text' : 'password'}
                    value={form.tempPassword}
                    onChange={e => set('tempPassword', e.target.value)}
                    className="pr-10 font-mono"
                  />
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <Button type="button" variant="outline" onClick={handleGenPass} title="Generar nueva">
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Mín. 10 caracteres, mayúscula, minúscula, número y símbolo.</p>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.forcePasswordChange} onChange={e => set('forcePasswordChange', e.target.checked)}
                  className="w-4 h-4 accent-taxea-red rounded" />
                <span className="text-sm font-medium">Forzar cambio en primer acceso <span className="text-xs text-muted-foreground">(recomendado)</span></span>
              </label>
            </div>

            <div className="bg-secondary/50 rounded-xl p-4 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Mensaje de bienvenida</p>
              <p className="text-xs text-foreground font-mono bg-card border border-border rounded-lg p-3 whitespace-pre-line leading-relaxed">
                {`Hola, ya tienes activa tu cuenta en Taxea Portal.\n\nAcceso: https://taxea-flow-portal.base44.app/login\nUsuario: ${form.email || '[email]'}\nContraseña temporal: ${showPass ? form.tempPassword : '••••••••••'}\n\nTe recomendamos cambiarla tras el primer acceso.`}
              </p>
              <Button type="button" variant="outline" size="sm" onClick={copyWelcomeMessage} className="gap-2">
                {copiedMsg ? <><Check className="w-3.5 h-3.5 text-emerald-600" />Copiado</> : <><Copy className="w-3.5 h-3.5" />Copiar mensaje</>}
              </Button>
            </div>

            {error && (
              <div className="bg-destructive/8 border border-destructive/20 text-destructive text-sm px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <div className="flex justify-between gap-3">
              <Button variant="outline" onClick={() => setStep(1)}>← Volver</Button>
              <Button onClick={handleSubmit} disabled={saving} className="bg-primary text-primary-foreground">
                {saving ? 'Creando cuenta...' : 'Crear cuenta de cliente'}
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: Confirmación */}
        {step === 3 && createdClient && (
          <div className="space-y-4 text-center py-2">
            <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto">
              <Check className="w-8 h-8 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-jakarta font-bold text-lg text-foreground">{createdClient.legalName}</h3>
              <p className="text-sm text-muted-foreground">{createdClient.email}</p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-left text-sm text-amber-800">
              <p className="font-semibold mb-1">Cuenta creada correctamente.</p>
              <p>Entrega las credenciales temporales al cliente por un canal seguro. La contraseña no podrá consultarse después.</p>
            </div>
            <Button onClick={handleClose} className="w-full">Cerrar</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}