import { useState } from 'react';
import { Shield, Lock, Monitor, LogOut, CheckCircle, AlertCircle, Eye, EyeOff, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { base44 } from '@/api/base44Client';

export default function TabSeguridad({ user }) {
  const [pwForm, setPwForm] = useState({ current: '', nueva: '', confirm: '' });
  const [showPw, setShowPw] = useState({ current: false, nueva: false });
  const [pwStatus, setPwStatus] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  const handleChangePassword = async () => {
    if (pwForm.nueva !== pwForm.confirm) { setPwStatus('mismatch'); return; }
    if (pwForm.nueva.length < 8) { setPwStatus('short'); return; }
    setSaving(true);
    setPwStatus(null);
    try {
      await base44.auth.updateMe({ password: pwForm.nueva });
      setPwStatus('success');
      setPwForm({ current: '', nueva: '', confirm: '' });
    } catch { setPwStatus('error'); }
    finally { setSaving(false); }
  };

  const handleLogout = () => base44.auth.logout('/login');

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== 'ELIMINAR') {
      setDeleteError('Debes escribir ELIMINAR para confirmar');
      return;
    }
    setDeleting(true);
    setDeleteError(null);
    try {
      await base44.auth.updateMe({ is_deleted: true, status: 'eliminado' });
      setDeleteOpen(false);
      base44.auth.logout('/login');
    } catch (err) {
      setDeleteError(err.message || 'Error al eliminar la cuenta');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Cambio contraseña */}
      <div className="bg-card border border-border rounded-xl shadow-card p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center"><Lock className="w-4 h-4 text-blue-600" /></div>
          <div>
            <h2 className="font-jakarta font-semibold text-foreground">Cambiar contraseña</h2>
            <p className="text-xs text-muted-foreground">Mínimo 8 caracteres</p>
          </div>
        </div>
        <div className="space-y-3 max-w-sm">
          <div className="space-y-1.5">
            <Label>Nueva contraseña</Label>
            <div className="relative">
              <Input type={showPw.nueva ? 'text' : 'password'} value={pwForm.nueva} onChange={e => setPwForm(p => ({ ...p, nueva: e.target.value }))} />
              <button type="button" onClick={() => setShowPw(p => ({ ...p, nueva: !p.nueva }))} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showPw.nueva ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Confirmar contraseña</Label>
            <Input type="password" value={pwForm.confirm} onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))} />
          </div>
          {pwStatus === 'mismatch' && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="w-3 h-3" />Las contraseñas no coinciden</p>}
          {pwStatus === 'short' && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="w-3 h-3" />Mínimo 8 caracteres</p>}
          {pwStatus === 'success' && <p className="text-xs text-green-600 flex items-center gap-1"><CheckCircle className="w-3 h-3" />Contraseña actualizada</p>}
          {pwStatus === 'error' && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="w-3 h-3" />Error al cambiar la contraseña</p>}
          <Button onClick={handleChangePassword} disabled={saving || !pwForm.nueva || !pwForm.confirm} size="sm" className="bg-teal hover:bg-teal-dark">
            {saving ? 'Guardando...' : 'Actualizar contraseña'}
          </Button>
        </div>
      </div>

      {/* 2FA info */}
      <div className="bg-card border border-border rounded-xl shadow-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center"><Shield className="w-4 h-4 text-blue-600" /></div>
          <div>
            <h2 className="font-jakarta font-semibold text-foreground">Autenticación en dos pasos (2FA)</h2>
            <p className="text-xs text-muted-foreground">Google Authenticator · Authy · Código por email</p>
          </div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm font-medium text-amber-700 mb-1">🔐 Próximamente disponible</p>
          <p className="text-xs text-amber-600">El módulo 2FA con TOTP, backup codes y detección de dispositivos está en desarrollo y se activará en la próxima actualización.</p>
        </div>
      </div>

      {/* Sesiones / dispositivos */}
      <div className="bg-card border border-border rounded-xl shadow-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 bg-secondary rounded-lg flex items-center justify-center"><Monitor className="w-4 h-4 text-muted-foreground" /></div>
          <div>
            <h2 className="font-jakarta font-semibold text-foreground">Sesión activa</h2>
            <p className="text-xs text-muted-foreground">{user?.email}</p>
          </div>
        </div>
        <div className="flex items-center justify-between p-3 bg-secondary/40 rounded-lg border border-border">
          <div>
            <p className="text-sm font-medium text-foreground">Este dispositivo</p>
            <p className="text-xs text-muted-foreground">{navigator.userAgent.includes('Mobile') ? '📱 Dispositivo móvil' : '💻 Ordenador'} · Sesión actual</p>
          </div>
          <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded font-medium">Activa</span>
        </div>
        <Button variant="outline" size="sm" className="mt-4 gap-2 text-destructive border-destructive/30 hover:bg-destructive/5" onClick={handleLogout}>
          <LogOut className="w-3.5 h-3.5" /> Cerrar sesión
        </Button>
      </div>

      {/* Privacidad */}
      <div className="bg-secondary/30 border border-border rounded-xl p-5">
        <p className="text-sm font-medium text-foreground mb-1">🔒 Privacidad y RGPD</p>
        <p className="text-xs text-muted-foreground leading-relaxed">Todos tus datos son privados y confidenciales. Solo tú y tu asesor de Taxea Strategies tienen acceso. Portal en cumplimiento con el RGPD y la LOPDGDD.</p>
      </div>

      {/* Zona de peligro — Eliminar cuenta */}
      <div className="bg-card border border-destructive/30 rounded-xl shadow-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 bg-destructive/10 rounded-lg flex items-center justify-center"><Trash2 className="w-4 h-4 text-destructive" /></div>
          <div>
            <h2 className="font-jakarta font-semibold text-foreground">Eliminar cuenta</h2>
            <p className="text-xs text-muted-foreground">Esta acción es irreversible</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
          Al eliminar tu cuenta, se marcará como eliminada y perderás acceso al portal. Tus datos fiscales y contables serán conservados según las obligaciones legales. Esta acción no se puede deshacer.
        </p>
        <Button variant="outline" size="sm" className="gap-2 text-destructive border-destructive/40 hover:bg-destructive/5" onClick={() => { setDeleteOpen(true); setDeleteConfirm(''); setDeleteError(null); }}>
          <Trash2 className="w-3.5 h-3.5" /> Eliminar mi cuenta
        </Button>
      </div>

      {/* Modal de confirmación */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Eliminar cuenta</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Estás a punto de eliminar tu cuenta de Taxea Strategies. Esta acción es <strong className="text-foreground">irreversible</strong>.
            </p>
            <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-2">Para confirmar, escribe <strong className="text-destructive">ELIMINAR</strong> en el campo:</p>
              <Input value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} placeholder="ELIMINAR" />
            </div>
            {deleteError && <p className="text-xs text-destructive">{deleteError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDeleteAccount} disabled={deleting || deleteConfirm !== 'ELIMINAR'}>
              {deleting ? 'Eliminando...' : 'Eliminar cuenta'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}