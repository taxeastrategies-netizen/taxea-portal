import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Mail, Copy, Check, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';


export default function AdminClientCreateForm({ open, onOpenChange, onCreated }) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [copiedMsg, setCopiedMsg] = useState(false);
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
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const copyWelcomeMessage = () => {
    const msg = `Hola, ya tienes activa tu cuenta en Taxea Portal.\n\nPuedes acceder desde: https://taxea-flow-portal.base44.app/login\n\nRecibirás un email de invitación para establecer tu contraseña y activar el acceso.\n\nSi tienes dudas, contacta con tu asesor.`;
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

      // 2. Invitar usuario — envía email de invitación para que el cliente establezca su contraseña
      await base44.users.inviteUser(form.email, 'user');

      // 3. Audit log
      await base44.entities.ClientAccessAuditLog.create({
        clientAccountId: client.id,
        clientName: form.legalName,
        actionType: 'cuenta_creada',
        actionBy: 'admin',
        actionAt: new Date().toISOString(),
        details: `Cuenta creada. Email: ${form.email}. Régimen: ${form.taxRegime}. Plan: ${form.plan || '—'}`,
      });

      setCreatedClient(client);
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

        {/* STEP 2: Email y acceso */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
              <div className="flex items-start gap-2">
                <Mail className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div>
                  <strong>Acceso por invitación por email</strong>
                  <p className="mt-1 text-blue-700">Al crear la cuenta, el sistema enviará automáticamente un email de invitación al cliente. El cliente hace clic en el enlace del email para establecer su contraseña y acceder al portal.</p>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Email de acceso *</Label>
              <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="cliente@gmail.com" />
              <p className="text-xs text-muted-foreground">El cliente recibirá aquí el enlace de activación.</p>
            </div>

            <div className="bg-secondary/50 rounded-xl p-4 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Mensaje de bienvenida (opcional)</p>
              <p className="text-xs text-foreground bg-card border border-border rounded-lg p-3 whitespace-pre-line leading-relaxed">
                {`Hola, ya tienes activa tu cuenta en Taxea Portal.\n\nRecibirás un email de invitación para establecer tu contraseña y activar el acceso.\n\nPortal: https://taxea-flow-portal.base44.app/login`}
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
              <Send className="w-8 h-8 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-jakarta font-bold text-lg text-foreground">{createdClient.legalName}</h3>
              <p className="text-sm text-muted-foreground">{createdClient.email}</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-left text-sm text-blue-800">
              <p className="font-semibold mb-1">✓ Cuenta creada e invitación enviada.</p>
              <p>El cliente recibirá un email en <strong>{createdClient.email}</strong> con un enlace para activar su acceso y establecer su contraseña. Pídele que revise su bandeja de entrada (y la carpeta de spam).</p>
            </div>
            <Button onClick={handleClose} className="w-full">Cerrar</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}