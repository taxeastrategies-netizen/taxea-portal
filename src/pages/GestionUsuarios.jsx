import { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Search, Pencil, UserCheck, Trash2, ShieldCheck, X, AlertTriangle, Shield } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const ROLE_CONFIG = {
  user:        { label: 'Usuario',       bg: 'bg-blue-50 border-blue-200',    text: 'text-blue-700' },
  admin:       { label: 'Administrador', bg: 'bg-amber-50 border-amber-200',  text: 'text-amber-700' },
  super_admin: { label: 'Super Admin',   bg: 'bg-yellow-50 border-yellow-200',text: 'text-yellow-700' },
};

const SUB_CFG = {
  sin_suscripcion:      { label: 'Sin suscripción',  color: 'text-slate-400' },
  pendiente_seleccion:  { label: 'Pend. selección',  color: 'text-amber-500' },
  pendiente_pago:       { label: 'Pend. pago',       color: 'text-orange-500' },
  pendiente_validacion: { label: 'Pend. validación', color: 'text-blue-500' },
  activa:               { label: 'Activa',           color: 'text-green-600' },
  suspendida:           { label: 'Suspendida',       color: 'text-red-500' },
  cancelada:            { label: 'Cancelada',        color: 'text-slate-500' },
  prueba:               { label: 'En prueba',        color: 'text-purple-500' },
  caducada:             { label: 'Caducada',         color: 'text-red-400' },
};

const STATUS_OPTS = ['activo', 'pendiente', 'suspendido', 'bloqueado', 'eliminado'];
const BIZ_OPTS    = [{ value: 'autonomo', label: 'Autónomo' }, { value: 'empresa', label: 'Empresa' }];

function ModalShell({ title, onClose, children, maxW = 'max-w-md' }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`bg-card rounded-2xl shadow-xl w-full ${maxW} max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="font-jakarta font-bold text-lg">{title}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 pb-6">{children}</div>
      </div>
    </div>
  );
}

function ActionBtn({ title, onClick, danger, children }) {
  return (
    <button title={title} onClick={onClick}
      className={`p-1.5 rounded-lg transition-colors ${
        danger ? 'text-muted-foreground hover:bg-red-50 hover:text-red-600'
               : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
      }`}>
      {children}
    </button>
  );
}

function EditUserModal({ targetUser, onClose, onSaved }) {
  const [form, setForm] = useState({
    phone: targetUser.phone || '',
    username: targetUser.username || '',
    business_type: targetUser.business_type || '',
    status: targetUser.status || 'activo',
    notes: targetUser.notes || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await base44.entities.User.update(targetUser.id, form);
    await base44.entities.UserAuditLog.create({
      userId: targetUser.id, actionType: 'usuario_editado',
      actionBy: 'admin', actionAt: new Date().toISOString(),
      details: 'Perfil editado por administrador',
    });
    setSaving(false);
    onSaved();
  };

  return (
    <ModalShell title="Editar usuario" onClose={onClose}>
      <div className="space-y-4 py-4">
        <div><Label className="text-sm font-medium mb-1.5 block">Teléfono</Label>
          <Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} className="h-10" /></div>
        <div><Label className="text-sm font-medium mb-1.5 block">Nombre de usuario</Label>
          <Input value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))} className="h-10" /></div>
        <div><Label className="text-sm font-medium mb-1.5 block">Tipo de negocio</Label>
          <select value={form.business_type} onChange={e => setForm(p => ({ ...p, business_type: e.target.value }))}
            className="w-full h-10 px-3 rounded-md border border-input bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-ring">
            <option value="">— Seleccionar —</option>
            {BIZ_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select></div>
        <div><Label className="text-sm font-medium mb-1.5 block">Estado</Label>
          <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
            className="w-full h-10 px-3 rounded-md border border-input bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-ring">
            {STATUS_OPTS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select></div>
        <div><Label className="text-sm font-medium mb-1.5 block">Notas internas</Label>
          <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
            rows={3} className="w-full px-3 py-2 rounded-md border border-input bg-transparent text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring" /></div>
      </div>
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button onClick={handleSave} disabled={saving} className="bg-teal hover:bg-teal-dark">
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </Button>
      </div>
    </ModalShell>
  );
}

function ViewProfileModal({ targetUser, subscription, adminUser, onClose }) {
  useEffect(() => {
    base44.entities.UserAuditLog.create({
      userId: targetUser.id, actionType: 'admin_accedió_perfil',
      actionBy: adminUser?.email || 'admin', actionAt: new Date().toISOString(),
      details: `Administrador accedió al perfil de ${targetUser.full_name || targetUser.email}`,
    });
  }, []);

  const subCfg = SUB_CFG[subscription?.status] || SUB_CFG.sin_suscripcion;
  const roleCfg = ROLE_CONFIG[targetUser.role] || ROLE_CONFIG.user;

  return (
    <ModalShell title={`Perfil: ${targetUser.full_name || targetUser.email}`} onClose={onClose}>
      <div className="py-4 space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700 flex items-center gap-2">
          <Shield className="w-3.5 h-3.5 flex-shrink-0" /> Acceso registrado en el historial de auditoría.
        </div>
        <div className="bg-secondary/40 rounded-xl p-4 space-y-2">
          {[
            ['Nombre', targetUser.full_name], ['Email', targetUser.email],
            ['Teléfono', targetUser.phone], ['Usuario', targetUser.username],
            ['NIF/CIF', targetUser.nif], ['Provincia', targetUser.provincia],
            ['Estado', targetUser.status ? targetUser.status.charAt(0).toUpperCase() + targetUser.status.slice(1) : null],
            ['Registro', targetUser.created_date ? new Date(targetUser.created_date).toLocaleDateString('es-ES') : null],
          ].map(([label, value]) => value ? (
            <div key={label} className="flex justify-between text-sm border-b border-border/40 pb-1.5 last:border-0">
              <span className="text-muted-foreground">{label}</span>
              <span className="font-medium text-right max-w-[60%] truncate">{value}</span>
            </div>
          ) : null)}
        </div>
        <div className="flex items-center gap-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Rol</p>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full border text-xs font-medium ${roleCfg.bg} ${roleCfg.text}`}>
              {roleCfg.label}
            </span>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Suscripción</p>
            <span className={`text-sm font-medium ${subCfg.color}`}>{subCfg.label}</span>
          </div>
        </div>
        {targetUser.notes && (
          <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
            <p className="text-xs font-semibold text-amber-800 mb-1">Notas internas</p>
            <p className="text-xs text-amber-700">{targetUser.notes}</p>
          </div>
        )}
      </div>
      <div className="flex justify-end"><Button onClick={onClose}>Cerrar</Button></div>
    </ModalShell>
  );
}

function DeleteUserModal({ targetUser, currentUser, onClose, onDeleted }) {
  const [deleting, setDeleting] = useState(false);
  const isSelf = targetUser.id === currentUser?.id;
  const isAdminUser = ['admin', 'super_admin'].includes(targetUser.role);

  const handleDelete = async () => {
    setDeleting(true);
    await base44.entities.User.update(targetUser.id, { is_deleted: true, status: 'eliminado' });
    await base44.entities.UserAuditLog.create({
      userId: targetUser.id, actionType: 'usuario_eliminado',
      actionBy: currentUser?.email || 'admin', actionAt: new Date().toISOString(),
      details: 'Usuario eliminado (soft delete) por administrador',
    });
    setDeleting(false);
    onDeleted();
  };

  return (
    <ModalShell title="Eliminar usuario" onClose={onClose}>
      <div className="py-4">
        {isSelf || isAdminUser ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
            {isSelf ? 'No puedes eliminar tu propia cuenta de administrador.'
                    : 'No se puede eliminar una cuenta con permisos de administrador.'}
          </div>
        ) : (
          <>
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">Vas a eliminar este usuario. Esta acción puede impedirle acceder a Taxea Portal.</p>
            </div>
            <p className="text-sm text-muted-foreground">
              Usuario: <strong className="text-foreground">{targetUser.full_name || targetUser.email}</strong>
            </p>
          </>
        )}
      </div>
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        {!isSelf && !isAdminUser && (
          <Button onClick={handleDelete} disabled={deleting} variant="destructive">
            {deleting ? 'Eliminando...' : 'Eliminar usuario'}
          </Button>
        )}
      </div>
    </ModalShell>
  );
}

function ChangeRoleModal({ targetUser, currentUser, onClose, onChanged }) {
  const [role, setRole] = useState(targetUser.role || 'user');
  const [saving, setSaving] = useState(false);
  const isSelf = targetUser.id === currentUser?.id;

  const handleChange = async () => {
    setSaving(true);
    await base44.entities.User.update(targetUser.id, { role });
    await base44.entities.UserAuditLog.create({
      userId: targetUser.id, actionType: 'rol_cambiado',
      actionBy: currentUser?.email || 'admin', actionAt: new Date().toISOString(),
      details: `Rol cambiado de "${targetUser.role}" a "${role}"`,
    });
    setSaving(false);
    onChanged();
  };

  return (
    <ModalShell title="Cambiar rol" onClose={onClose}>
      <div className="py-4 space-y-4">
        {isSelf && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
            No puedes cambiar tu propio rol de administrador.
          </div>
        )}
        <p className="text-sm text-muted-foreground">
          Usuario: <strong className="text-foreground">{targetUser.full_name || targetUser.email}</strong>
        </p>
        <div className="space-y-2">
          {[
            { value: 'user',  label: 'Usuario',       desc: 'Acceso estándar, sin funciones de administración' },
            { value: 'admin', label: 'Administrador', desc: 'Acceso completo y gestión de usuarios' },
          ].map(r => (
            <button key={r.value} onClick={() => !isSelf && setRole(r.value)} disabled={isSelf}
              className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all ${
                role === r.value ? 'border-teal bg-teal/5' : 'border-border'
              } ${isSelf ? 'opacity-50 cursor-not-allowed' : 'hover:border-teal/50'}`}>
              <p className="text-sm font-semibold">{r.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{r.desc}</p>
            </button>
          ))}
        </div>
        {role === 'admin' && role !== targetUser.role && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
            Estás asignando permisos de administración. Revisa que sea correcto.
          </div>
        )}
      </div>
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        {!isSelf && (
          <Button onClick={handleChange} disabled={saving || role === targetUser.role} className="bg-teal hover:bg-teal-dark">
            {saving ? 'Guardando...' : 'Cambiar rol'}
          </Button>
        )}
      </div>
    </ModalShell>
  );
}

export default function GestionUsuarios() {
  const { user, isAdmin } = useOutletContext() || {};
  const [users, setUsers] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [viewingUser, setViewingUser] = useState(null);
  const [deletingUser, setDeletingUser] = useState(null);
  const [changingRoleUser, setChangingRoleUser] = useState(null);

  const loadData = async () => {
    setLoading(true);
    const [usersData, subsData] = await Promise.all([
      base44.entities.User.list('-created_date'),
      base44.entities.Subscription.list(),
    ]);
    setUsers((usersData || []).filter(u => !u.is_deleted));
    setSubscriptions(subsData || []);
    setLoading(false);
  };

  useEffect(() => { if (isAdmin) loadData(); }, [isAdmin]);

  const filteredUsers = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter(u =>
      (u.full_name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.username || '').toLowerCase().includes(q) ||
      (u.phone || '').includes(q)
    );
  }, [users, search]);

  const getSubForUser = (userId) => subscriptions.find(s => s.userId === userId);
  const closeModals = () => { setEditingUser(null); setViewingUser(null); setDeletingUser(null); setChangingRoleUser(null); };
  const handleSaved = () => { closeModals(); loadData(); };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Shield className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
          <p className="font-semibold">Acceso restringido</p>
          <p className="text-sm text-muted-foreground mt-1">No tienes permisos para acceder a esta sección.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Gestión de Usuarios" subtitle="Administración de cuentas, roles y suscripciones" />

      <div className="mb-5 relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nombre, email, usuario..." className="pl-9" />
      </div>

      <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
        {loading ? (
          <div className="py-12 text-center">
            <div className="w-6 h-6 border-2 border-teal border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <p className="py-12 text-center text-muted-foreground text-sm">
            {search ? 'No se encontraron usuarios con ese criterio.' : 'Aún no hay usuarios registrados.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 border-b border-border">
                <tr>
                  {['Nombre', 'Email', 'Usuario', 'Rol', 'Suscripción', 'Registro', 'Acciones'].map(col => (
                    <th key={col} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredUsers.map(u => {
                  const roleCfg = ROLE_CONFIG[u.role] || ROLE_CONFIG.user;
                  const sub = getSubForUser(u.id);
                  const subCfg = SUB_CFG[sub?.status] || SUB_CFG.sin_suscripcion;
                  return (
                    <tr key={u.id} className="hover:bg-secondary/20 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium truncate max-w-[140px]">{u.full_name || '—'}</p>
                        {u.phone && <p className="text-xs text-muted-foreground">{u.phone}</p>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground truncate max-w-[160px]">{u.email}</td>
                      <td className="px-4 py-3 text-muted-foreground">{u.username || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-medium ${roleCfg.bg} ${roleCfg.text}`}>
                          {roleCfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium ${subCfg.color}`}>{subCfg.label}</span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                        {u.created_date ? new Date(u.created_date).toLocaleDateString('es-ES') : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-0.5">
                          <ActionBtn title="Editar usuario" onClick={() => setEditingUser(u)}><Pencil className="w-3.5 h-3.5" /></ActionBtn>
                          <ActionBtn title="Acceder al perfil" onClick={() => setViewingUser(u)}><UserCheck className="w-3.5 h-3.5" /></ActionBtn>
                          <ActionBtn title="Eliminar usuario" onClick={() => setDeletingUser(u)} danger><Trash2 className="w-3.5 h-3.5" /></ActionBtn>
                          <ActionBtn title="Cambiar rol" onClick={() => setChangingRoleUser(u)}><ShieldCheck className="w-3.5 h-3.5" /></ActionBtn>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && (
        <p className="text-xs text-muted-foreground mt-3">
          {filteredUsers.length} usuario{filteredUsers.length !== 1 ? 's' : ''} {search ? 'encontrado' : 'registrado'}{filteredUsers.length !== 1 ? 's' : ''}
        </p>
      )}

      {editingUser && <EditUserModal targetUser={editingUser} onClose={closeModals} onSaved={handleSaved} />}
      {viewingUser && <ViewProfileModal targetUser={viewingUser} subscription={getSubForUser(viewingUser.id)} adminUser={user} onClose={closeModals} />}
      {deletingUser && <DeleteUserModal targetUser={deletingUser} currentUser={user} onClose={closeModals} onDeleted={handleSaved} />}
      {changingRoleUser && <ChangeRoleModal targetUser={changingRoleUser} currentUser={user} onClose={closeModals} onChanged={handleSaved} />}
    </div>
  );
}