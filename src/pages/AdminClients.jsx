import { useState, useEffect } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { startImpersonation } from '@/lib/impersonation';
import {
  Users, Plus, Search, AlertTriangle, Shield, Clock, CheckCircle,
  XCircle, RotateCcw, Archive, Eye, ChevronRight, Building2, User,
  Lock, Unlock, RefreshCw, Copy, Check, ArrowLeft, Calendar, Euro,
  FileText, Activity, LogIn
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import AdminClientCreateForm from '@/components/admin/AdminClientCreateForm';

const ACCESS_STATUS_CONFIG = {
  activa: { label: 'Activa', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  pendiente_primer_acceso: { label: 'Pdte. 1er acceso', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  pendiente_pago: { label: 'Pdte. pago', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  suspendida: { label: 'Suspendida', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  baja: { label: 'Baja', color: 'bg-slate-100 text-slate-600 border-slate-200' },
  bloqueada: { label: 'Bloqueada', color: 'bg-red-100 text-red-700 border-red-200' },
  archivada: { label: 'Archivada', color: 'bg-slate-100 text-slate-400 border-slate-200' },
};

const PAYMENT_STATUS_CONFIG = {
  al_dia: { label: 'Al día', color: 'text-emerald-600' },
  pendiente: { label: 'Pendiente', color: 'text-amber-600' },
  revision: { label: 'En revisión', color: 'text-orange-600' },
  no_aplica: { label: '—', color: 'text-muted-foreground' },
};

function AccessBadge({ status }) {
  const cfg = ACCESS_STATUS_CONFIG[status] || { label: status, color: 'bg-secondary text-foreground border-border' };
  return (
    <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full border', cfg.color)}>
      {cfg.label}
    </span>
  );
}

function KpiCard({ title, value, color, sub }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <p className={cn('text-2xl font-bold', color)}>{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{title}</p>
      {sub && <p className="text-[10px] text-muted-foreground/60 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function AdminClients() {
  const { isAdmin, user } = useOutletContext() || {};
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPayment, setFilterPayment] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [activeTab, setActiveTab] = useState('resumen');
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [impersonateModal, setImpersonateModal] = useState(null);
  const [impersonateReason, setImpersonateReason] = useState('');

  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  const load = async () => {
    setLoading(true);
    const [cls, logs] = await Promise.all([
      base44.entities.ClientAccount.list('-created_date', 100),
      base44.entities.ClientAccessAuditLog.list('-actionAt', 50).catch(() => []),
    ]);
    setClients(cls || []);
    setAuditLogs(logs || []);
    setLoading(false);
  };

  const logAction = async (clientId, clientName, actionType, details) => {
    await base44.entities.ClientAccessAuditLog.create({
      clientAccountId: clientId,
      clientName,
      actionType,
      actionBy: user?.email || 'admin',
      actionAt: new Date().toISOString(),
      details,
    });
  };

  const handleStatusChange = async (client, newStatus) => {
    setActionLoading(true);
    const actionMap = {
      suspendida: 'cuenta_suspendida',
      activa: 'cuenta_reactivada',
      bloqueada: 'cuenta_bloqueada',
      archivada: 'cuenta_archivada',
    };
    await base44.entities.ClientAccount.update(client.id, { accessStatus: newStatus });
    await logAction(client.id, client.legalName, actionMap[newStatus] || 'datos_editados', `Estado cambiado a: ${newStatus}`);
    await load();
    if (selectedClient?.id === client.id) setSelectedClient(prev => ({ ...prev, accessStatus: newStatus }));
    setActionLoading(false);
    setConfirmAction(null);
  };

  const handleStartImpersonation = async () => {
    const client = impersonateModal;
    if (!client) return;
    setActionLoading(true);
    await logAction(client.id, client.legalName, 'nota_interna',
      `Admin ${user?.email || 'admin'} inició sesión directa como cliente. Motivo: ${impersonateReason || 'Sin especificar'}`);
    startImpersonation({ clientAccountId: client.id, clientName: client.legalName, clientEmail: client.email });
    setImpersonateModal(null);
    setImpersonateReason('');
    setActionLoading(false);
    navigate('/');
    window.location.reload();
  };

  const handleResetPassword = async (client) => {
    setActionLoading(true);
    try {
      await base44.auth.resetPasswordRequest(client.email);
      await base44.entities.ClientAccount.update(client.id, { forcePasswordChange: true, passwordChangedByClient: false });
      await logAction(client.id, client.legalName, 'contrasena_reseteada_admin', 'Admin envió enlace de reset de contraseña al cliente.');
      await load();
    } catch {}
    setActionLoading(false);
  };

  const handleResendInvite = async (client) => {
    setActionLoading(true);
    try {
      const newToken = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : (Math.random().toString(36).slice(2) + Date.now().toString(36));
      const setupTokenExpiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
      const setupUrl = `${window.location.origin}/setup-password?token=${newToken}&email=${encodeURIComponent(client.email)}`;
      await base44.entities.ClientAccount.update(client.id, { setupToken: newToken, setupTokenExpiresAt, inviteEmailSentAt: new Date().toISOString() });
      await base44.functions.invoke('sendClientInviteEmail', { email: client.email, clientName: client.legalName, setupUrl, isResend: true });
      await logAction(client.id, client.legalName, 'credenciales_generadas', 'Admin reenvió enlace de acceso al cliente.');
      await load();
      if (selectedClient?.id === client.id) setSelectedClient(prev => ({ ...prev, setupToken: newToken, setupTokenExpiresAt, inviteEmailSentAt: new Date().toISOString() }));
    } catch (e) { alert('Error al reenviar: ' + e.message); }
    setActionLoading(false);
  };

  if (!isAdmin) return (
    <div className="p-12 text-center">
      <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
      <p className="font-medium">Acceso denegado</p>
    </div>
  );

  // KPIs
  const total = clients.length;
  const activos = clients.filter(c => c.accessStatus === 'activa').length;
  const pendPrimerAcceso = clients.filter(c => c.accessStatus === 'pendiente_primer_acceso').length;
  const pendPago = clients.filter(c => c.paymentStatus === 'pendiente').length;
  const suspendidos = clients.filter(c => ['suspendida', 'bloqueada'].includes(c.accessStatus)).length;
  const passNoCambiada = clients.filter(c => !c.passwordChangedByClient && c.firstAccessCompleted).length;
  const tempNoCompartida = clients.filter(c => !c.tempPasswordShared && c.accessStatus === 'pendiente_primer_acceso').length;

  const now = new Date();
  const thisMonth = clients.filter(c => {
    if (!c.created_date) return false;
    const d = new Date(c.created_date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const filtered = clients.filter(c => {
    const matchSearch = !search ||
      c.legalName?.toLowerCase().includes(search.toLowerCase()) ||
      c.displayName?.toLowerCase().includes(search.toLowerCase()) ||
      c.taxId?.toLowerCase().includes(search.toLowerCase()) ||
      c.email?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || c.accessStatus === filterStatus;
    const matchPayment = filterPayment === 'all' || c.paymentStatus === filterPayment;
    return matchSearch && matchStatus && matchPayment;
  });

  // ── DETAIL VIEW ──
  if (selectedClient) {
    const clientLogs = auditLogs.filter(l => l.clientAccountId === selectedClient.id);
    const tabs = ['resumen', 'fiscal', 'acceso', 'plan', 'historial'];
    const tabLabels = { resumen: 'Resumen', fiscal: 'Datos fiscales', acceso: 'Acceso portal', plan: 'Plan y pago', historial: 'Historial' };

    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setSelectedClient(null)} className="gap-1.5">
            <ArrowLeft className="w-4 h-4" />Clientes
          </Button>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm font-medium">{selectedClient.legalName}</span>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                {selectedClient.clientType === 'empresa' ? <Building2 className="w-5 h-5 text-primary" /> : <User className="w-5 h-5 text-primary" />}
              </div>
              <div>
                <h2 className="font-jakarta font-bold text-foreground">{selectedClient.legalName}</h2>
                <p className="text-xs text-muted-foreground">{selectedClient.taxId} · {selectedClient.email}</p>
              </div>
            </div>
            <AccessBadge status={selectedClient.accessStatus} />
          </div>

          <div className="flex border-b border-border overflow-x-auto">
            {tabs.map(t => (
              <button key={t} onClick={() => setActiveTab(t)}
                className={cn('px-5 py-3 text-sm font-medium whitespace-nowrap transition-colors',
                  activeTab === t ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground')}>
                {tabLabels[t]}
              </button>
            ))}
          </div>

          <div className="p-6">
            {activeTab === 'resumen' && (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { label: 'Tipo', value: selectedClient.clientType === 'empresa' ? 'Empresa' : 'Autónomo' },
                  { label: 'Estado acceso', value: <AccessBadge status={selectedClient.accessStatus} /> },
                  { label: 'Estado pago', value: <span className={PAYMENT_STATUS_CONFIG[selectedClient.paymentStatus]?.color}>{PAYMENT_STATUS_CONFIG[selectedClient.paymentStatus]?.label || '—'}</span> },
                  { label: 'Plan', value: selectedClient.plan || '—' },
                  { label: 'Mensualidad', value: selectedClient.monthlyFee ? `${selectedClient.monthlyFee} €` : '—' },
                  { label: 'Último acceso', value: selectedClient.lastLoginAt ? new Date(selectedClient.lastLoginAt).toLocaleDateString('es-ES') : 'Nunca' },
                  { label: 'Primer acceso', value: selectedClient.firstAccessCompleted ? 'Sí' : 'No' },
                  { label: 'Contraseña cambiada', value: selectedClient.passwordChangedByClient ? 'Sí' : 'No' },
                  { label: 'Responsable', value: selectedClient.internalOwner || '—' },
                ].map((item, i) => (
                  <div key={i} className="bg-secondary/30 rounded-lg p-3">
                    <p className="text-[11px] text-muted-foreground mb-1">{item.label}</p>
                    <div className="text-sm font-medium text-foreground">{item.value}</div>
                  </div>
                ))}
                {selectedClient.notes && (
                  <div className="col-span-2 lg:col-span-3 bg-amber-50/50 border border-amber-100 rounded-lg p-3">
                    <p className="text-[11px] text-muted-foreground mb-1">Notas internas</p>
                    <p className="text-sm text-foreground">{selectedClient.notes}</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'fiscal' && (
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Razón social', value: selectedClient.legalName },
                  { label: selectedClient.clientType === 'empresa' ? 'CIF' : 'NIF/NIE', value: selectedClient.taxId },
                  { label: 'Régimen fiscal', value: selectedClient.taxRegime?.toUpperCase() },
                  { label: 'Actividad', value: selectedClient.activity || '—' },
                  { label: 'Provincia', value: selectedClient.province || '—' },
                  { label: 'País', value: selectedClient.country || 'España' },
                  ...(selectedClient.clientType === 'empresa' ? [
                    { label: 'Representante', value: selectedClient.representativeName || '—' },
                    { label: 'NIF representante', value: selectedClient.representativeTaxId || '—' },
                  ] : []),
                ].map((item, i) => (
                  <div key={i} className="bg-secondary/30 rounded-lg p-3">
                    <p className="text-[11px] text-muted-foreground mb-1">{item.label}</p>
                    <p className="text-sm font-medium text-foreground">{item.value || '—'}</p>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'acceso' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Email de acceso', value: selectedClient.email },
                    { label: 'Estado cuenta', value: <AccessBadge status={selectedClient.accessStatus} /> },
                    { label: 'Invitación enviada', value: selectedClient.inviteEmailSentAt ? `Sí — ${new Date(selectedClient.inviteEmailSentAt).toLocaleDateString('es-ES')}` : 'No' },
                    { label: 'Contraseña establecida', value: selectedClient.passwordChangedByClient ? `Sí — ${selectedClient.lastPasswordChangeAt ? new Date(selectedClient.lastPasswordChangeAt).toLocaleDateString('es-ES') : ''}` : 'No' },
                    { label: 'Primer acceso realizado', value: selectedClient.firstAccessCompleted ? 'Sí' : 'No' },
                    { label: 'Último acceso', value: selectedClient.lastLoginAt ? new Date(selectedClient.lastLoginAt).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Nunca' },
                    { label: 'Enlace válido hasta', value: selectedClient.setupTokenExpiresAt ? (new Date(selectedClient.setupTokenExpiresAt) > new Date() ? `Activo — ${new Date(selectedClient.setupTokenExpiresAt).toLocaleDateString('es-ES')}` : 'Caducado') : '—' },
                    { label: 'Intentos fallidos', value: selectedClient.failedLoginAttempts || 0 },
                  ].map((item, i) => (
                    <div key={i} className="bg-secondary/30 rounded-lg p-3">
                      <p className="text-[11px] text-muted-foreground mb-1">{item.label}</p>
                      <div className="text-sm font-medium text-foreground">{item.value}</div>
                    </div>
                  ))}
                </div>

                {selectedClient.setupToken && (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 space-y-2">
                    <p className="text-xs font-semibold text-slate-600">Enlace de acceso activo:</p>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-500 flex-1 break-all">{`${window.location.origin}/setup-password?token=${selectedClient.setupToken}&email=${encodeURIComponent(selectedClient.email)}`}</span>
                      <Button size="sm" variant="ghost" className="h-7 px-2 flex-shrink-0" onClick={() => navigator.clipboard.writeText(`${window.location.origin}/setup-password?token=${selectedClient.setupToken}&email=${encodeURIComponent(selectedClient.email)}`)}>
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                )}

                <div className="border-t border-border pt-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Acciones de acceso</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedClient.accessStatus === 'activa' ? (
                      <Button size="sm" onClick={() => { setImpersonateModal(selectedClient); setImpersonateReason(''); }} className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white">
                        <LogIn className="w-3.5 h-3.5" />Entrar como cliente
                      </Button>
                    ) : (
                      <Button size="sm" disabled title="Solo puedes iniciar sesión directa en cuentas activas." className="gap-1.5 opacity-40">
                        <LogIn className="w-3.5 h-3.5" />Entrar como cliente
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => handleResendInvite(selectedClient)} disabled={actionLoading} className="gap-1.5 border-blue-300 text-blue-700 hover:bg-blue-50">
                      <RefreshCw className="w-3.5 h-3.5" />Reenviar enlace de acceso
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleResetPassword(selectedClient)} disabled={actionLoading} className="gap-1.5">
                      <Lock className="w-3.5 h-3.5" />Enviar reset de contraseña
                    </Button>
                    {selectedClient.accessStatus !== 'suspendida' && selectedClient.accessStatus !== 'bloqueada' ? (
                      <Button variant="outline" size="sm" onClick={() => setConfirmAction({ type: 'suspend', client: selectedClient })} className="gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-50">
                        <XCircle className="w-3.5 h-3.5" />Suspender acceso
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => handleStatusChange(selectedClient, 'activa')} disabled={actionLoading} className="gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50">
                        <CheckCircle className="w-3.5 h-3.5" />Reactivar acceso
                      </Button>
                    )}
                    {selectedClient.accessStatus !== 'bloqueada' ? (
                      <Button variant="outline" size="sm" onClick={() => setConfirmAction({ type: 'block', client: selectedClient })} className="gap-1.5 border-red-300 text-red-700 hover:bg-red-50">
                        <Lock className="w-3.5 h-3.5" />Bloquear cuenta
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => handleStatusChange(selectedClient, 'activa')} disabled={actionLoading} className="gap-1.5">
                        <Unlock className="w-3.5 h-3.5" />Desbloquear
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'plan' && (
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Plan contratado', value: selectedClient.plan || '—' },
                  { label: 'Mensualidad', value: selectedClient.monthlyFee ? `${selectedClient.monthlyFee} €` : '—' },
                  { label: 'Estado de pago', value: <span className={PAYMENT_STATUS_CONFIG[selectedClient.paymentStatus]?.color}>{PAYMENT_STATUS_CONFIG[selectedClient.paymentStatus]?.label}</span> },
                  { label: 'Fecha de alta', value: selectedClient.registrationDate || '—' },
                  { label: 'Próxima renovación', value: selectedClient.nextRenewalDate || '—' },
                  { label: 'Servicio contratado', value: selectedClient.contractedService || '—' },
                ].map((item, i) => (
                  <div key={i} className="bg-secondary/30 rounded-lg p-3">
                    <p className="text-[11px] text-muted-foreground mb-1">{item.label}</p>
                    <div className="text-sm font-medium text-foreground">{item.value || '—'}</div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'historial' && (
              <div className="space-y-2">
                {clientLogs.length === 0 ? (
                  <div className="text-center py-8">
                    <Activity className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
                    <p className="text-sm text-muted-foreground">Sin registros de actividad</p>
                  </div>
                ) : clientLogs.map((log, i) => (
                  <div key={i} className="flex items-start gap-3 px-4 py-3 bg-secondary/30 rounded-lg">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground capitalize">{log.actionType?.replace(/_/g, ' ')}</p>
                      {log.details && <p className="text-xs text-muted-foreground mt-0.5">{log.details}</p>}
                    </div>
                    <p className="text-[11px] text-muted-foreground flex-shrink-0">
                      {log.actionAt ? new Date(log.actionAt).toLocaleDateString('es-ES') : '—'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Confirm dialog */}
        {confirmAction && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-card rounded-xl border border-border p-6 max-w-sm w-full shadow-xl">
              <h3 className="font-jakarta font-bold text-foreground mb-2">
                {confirmAction.type === 'suspend' ? 'Suspender acceso' : 'Bloquear cuenta'}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {confirmAction.type === 'suspend'
                  ? `¿Confirmas suspender el acceso de ${confirmAction.client.legalName}? El cliente no podrá acceder al portal.`
                  : `¿Confirmas bloquear la cuenta de ${confirmAction.client.legalName}? Esta acción requerirá desbloqueo manual.`}
              </p>
              <div className="flex gap-3 justify-end">
                <Button variant="outline" size="sm" onClick={() => setConfirmAction(null)}>Cancelar</Button>
                <Button size="sm" variant="destructive"
                  onClick={() => handleStatusChange(confirmAction.client, confirmAction.type === 'suspend' ? 'suspendida' : 'bloqueada')}
                  disabled={actionLoading}>
                  {actionLoading ? 'Procesando...' : 'Confirmar'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {impersonateModal && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-card rounded-xl border border-border p-6 max-w-md w-full shadow-xl space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                  <LogIn className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="font-jakarta font-bold text-foreground">Iniciar sesión como cliente</h3>
                  <p className="text-xs text-muted-foreground">Esta acción quedará registrada en el historial</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Vas a entrar al portal como <strong className="text-foreground">{impersonateModal.legalName}</strong>.
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1 text-xs text-amber-800">
                <p>· Verás el portal desde la perspectiva del cliente.</p>
                <p>· No se mostrarán datos de otros clientes.</p>
                <p>· Las acciones realizadas quedarán asociadas a tu usuario admin.</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Motivo del acceso (opcional)</Label>
                <select
                  value={impersonateReason}
                  onChange={e => setImpersonateReason(e.target.value)}
                  className="w-full h-9 px-3 text-sm border border-input rounded-md bg-transparent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                  <option value="">Selecciona un motivo...</option>
                  <option>Revisión de facturas</option>
                  <option>Soporte al cliente</option>
                  <option>Validación de datos</option>
                  <option>Revisión fiscal/contable</option>
                  <option>Prueba de acceso</option>
                  <option>Incidencia técnica</option>
                  <option>Otro</option>
                </select>
              </div>
              <div className="flex gap-3 justify-end">
                <Button variant="outline" size="sm" onClick={() => setImpersonateModal(null)}>Cancelar</Button>
                <Button size="sm" onClick={handleStartImpersonation} disabled={actionLoading} className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5">
                  <LogIn className="w-3.5 h-3.5" />
                  {actionLoading ? 'Entrando...' : 'Entrar como cliente'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── LIST VIEW ──
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-jakarta font-bold text-foreground">Clientes y accesos</h1>
          <p className="text-sm text-muted-foreground">Gestión de cuentas del portal privado</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="w-4 h-4" />Nuevo cliente
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Clientes activos" value={activos} color="text-emerald-600" sub={`${total} total`} />
        <KpiCard title="Pdte. primer acceso" value={pendPrimerAcceso} color={pendPrimerAcceso > 0 ? 'text-blue-600' : 'text-foreground'} />
        <KpiCard title="Pendientes de pago" value={pendPago} color={pendPago > 0 ? 'text-amber-600' : 'text-foreground'} />
        <KpiCard title="Suspendidos / Bloqueados" value={suspendidos} color={suspendidos > 0 ? 'text-red-600' : 'text-foreground'} />
      </div>

      {/* Alertas */}
      {(pendPrimerAcceso > 0 || pendPago > 0 || passNoCambiada > 0) && (
        <div className="space-y-2">
          {pendPrimerAcceso > 0 && (
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 text-sm text-blue-800">
              <Clock className="w-4 h-4 flex-shrink-0" />
              <span>{pendPrimerAcceso} cuenta{pendPrimerAcceso > 1 ? 's' : ''} sin primer acceso realizado</span>
            </div>
          )}
          {pendPago > 0 && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 text-sm text-amber-800">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{pendPago} cliente{pendPago > 1 ? 's' : ''} con pago pendiente — revisar acceso</span>
            </div>
          )}
          {passNoCambiada > 0 && (
            <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-lg px-4 py-2.5 text-sm text-orange-800">
              <Shield className="w-4 h-4 flex-shrink-0" />
              <span>{passNoCambiada} cliente{passNoCambiada > 1 ? 's' : ''} con contraseña temporal sin cambiar</span>
            </div>
          )}
        </div>
      )}

      {/* Tabla */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-border">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input placeholder="Buscar por nombre, NIF, email..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm" />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-44 h-8 text-xs"><SelectValue placeholder="Estado acceso" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              {Object.entries(ACCESS_STATUS_CONFIG).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterPayment} onValueChange={setFilterPayment}>
            <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Pago" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los pagos</SelectItem>
              <SelectItem value="al_dia">Al día</SelectItem>
              <SelectItem value="pendiente">Pendiente</SelectItem>
              <SelectItem value="revision">Revisión</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="p-12 text-center"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" /></div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="text-muted-foreground text-sm">Sin clientes registrados</p>
            <Button onClick={() => setShowCreate(true)} className="mt-4 gap-2" size="sm">
              <Plus className="w-4 h-4" />Crear primer cliente
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map(client => (
              <div key={client.id} className="px-5 py-3.5 flex items-center justify-between hover:bg-secondary/20 transition-colors group">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    {client.clientType === 'empresa' ? <Building2 className="w-4 h-4 text-primary" /> : <User className="w-4 h-4 text-primary" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{client.legalName}</p>
                    <p className="text-[11px] text-muted-foreground">{client.taxId} · {client.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                  <span className={cn('text-[11px] font-medium', PAYMENT_STATUS_CONFIG[client.paymentStatus]?.color)}>
                    {PAYMENT_STATUS_CONFIG[client.paymentStatus]?.label}
                  </span>
                  <AccessBadge status={client.accessStatus} />
                  <span className="text-[11px] text-muted-foreground hidden lg:block">
                    {client.firstAccessCompleted ? '✓ Acceso' : '○ Sin acceso'}
                  </span>
                  {client.accessStatus === 'activa' && (
                    <Button size="sm" variant="ghost" onClick={() => { setImpersonateModal(client); setImpersonateReason(''); }}
                      className="h-7 px-2 opacity-0 group-hover:opacity-100 transition-opacity text-amber-600 hover:bg-amber-50" title="Entrar como cliente">
                      <LogIn className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => { setSelectedClient(client); setActiveTab('resumen'); }}
                    className="h-7 px-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Eye className="w-3.5 h-3.5 mr-1" />Ver
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AdminClientCreateForm open={showCreate} onOpenChange={setShowCreate} onCreated={load} />
    </div>
  );
}