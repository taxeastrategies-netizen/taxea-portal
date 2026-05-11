import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useOutletContext } from 'react-router-dom';
import PageHeader from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Users, TrendingUp, CheckCircle2, AlertTriangle, Clock, Euro } from 'lucide-react';

const ESTADO_LABELS = {
  invitacion_enviada: 'Invitación enviada',
  registrado: 'Registrado',
  perfil_completado: 'Perfil completado',
  cliente_activo: 'Cliente activo',
  primer_pago: 'Primer pago',
  mes_1: 'Mes 1',
  mes_2: 'Mes 2',
  mes_3: 'Mes 3 completado',
  pendiente_validacion: 'Pendiente validación',
  recompensa_aprobada: 'Recompensa aprobada',
  recompensa_pagada: 'Recompensa pagada',
  rechazado: 'Rechazado',
  fraudulento: 'Fraude',
};

const ESTADO_COLORS = {
  pendiente_validacion: 'bg-purple-50 text-purple-700 border-purple-200',
  recompensa_aprobada: 'bg-green-50 text-green-700 border-green-200',
  recompensa_pagada: 'bg-green-100 text-green-800 border-green-300',
  rechazado: 'bg-red-50 text-red-700 border-red-200',
  fraudulento: 'bg-red-100 text-red-800 border-red-300',
  mes_3: 'bg-orange-50 text-orange-700 border-orange-200',
  cliente_activo: 'bg-teal-light text-teal border-teal/20',
};

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 shadow-card">
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}><Icon className="w-4 h-4" /></div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-jakarta font-bold text-foreground">{value}</p>
        </div>
      </div>
    </div>
  );
}

export default function AdminAfiliados() {
  const { isAdmin } = useOutletContext() || {};
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [nota, setNota] = useState('');
  const [saving, setSaving] = useState(false);
  const [filtro, setFiltro] = useState('todos');

  useEffect(() => {
    load();
  }, []);

  const load = () => {
    setLoading(true);
    base44.entities.Referral.list('-created_date', 200)
      .then(setReferrals)
      .finally(() => setLoading(false));
  };

  const handleAccion = async (referralId, nuevoEstado) => {
    setSaving(true);
    const updates = { estado: nuevoEstado };
    if (nota) updates.nota_admin = nota;
    if (nuevoEstado === 'recompensa_pagada') updates.recompensa_pagada = true;
    if (nuevoEstado === 'fraudulento') updates.fraude_flag = true;
    await base44.entities.Referral.update(referralId, updates);
    setSelected(null);
    setNota('');
    await load();
    setSaving(false);
  };

  const filtered = filtro === 'todos' ? referrals : referrals.filter(r => r.estado === filtro);

  const pendientes = referrals.filter(r => r.estado === 'pendiente_validacion').length;
  const pagadas = referrals.filter(r => r.recompensa_pagada).reduce((s, r) => s + (r.recompensa_eur || 0), 0);
  const aprobadas = referrals.filter(r => r.estado === 'recompensa_aprobada').reduce((s, r) => s + (r.recompensa_eur || 0), 0);
  const fraudes = referrals.filter(r => r.fraude_flag).length;

  if (!isAdmin) return <div className="p-8 text-center text-muted-foreground">Acceso restringido a administradores.</div>;

  return (
    <div>
      <PageHeader title="Panel de Afiliados" subtitle="Gestión y validación del programa de referidos" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard icon={Clock} label="Pendientes validación" value={pendientes} color="bg-purple-50 text-purple-600" />
        <StatCard icon={CheckCircle2} label="Recompensas pagadas" value={`${pagadas} €`} color="bg-green-50 text-green-600" />
        <StatCard icon={Euro} label="Pendiente de pago" value={`${aprobadas} €`} color="bg-amber-50 text-amber-600" />
        <StatCard icon={AlertTriangle} label="Posibles fraudes" value={fraudes} color="bg-red-50 text-red-600" />
      </div>

      {/* Filtro */}
      <div className="flex items-center gap-3 mb-4">
        <Select value={filtro} onValueChange={setFiltro}>
          <SelectTrigger className="w-56 h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los referrals</SelectItem>
            <SelectItem value="pendiente_validacion">Pendiente validación</SelectItem>
            <SelectItem value="recompensa_aprobada">Recompensa aprobada</SelectItem>
            <SelectItem value="recompensa_pagada">Recompensa pagada</SelectItem>
            <SelectItem value="fraudulento">Fraudes</SelectItem>
            <SelectItem value="mes_3">3 meses completados</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">{filtered.length} registros</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-6 h-6 border-2 border-teal border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="bg-card border border-border rounded-xl shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Referidor</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Referido</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Tipo</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Meses</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Estado</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Recompensa</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(r => (
                  <tr key={r.id} className="hover:bg-secondary/10">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground truncate max-w-[140px]">{r.referrer_email}</p>
                      <p className="text-xs text-muted-foreground font-mono">{r.referrer_code}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{r.referred_nombre || '—'}</p>
                      <p className="text-xs text-muted-foreground">{r.referred_email || '—'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs">{r.tipo_cliente === 'sociedad' ? '🏢 Sociedad' : '👤 Física'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {[1,2,3].map(m => (
                          <div key={m} className={`w-4 h-4 rounded-sm ${(r.meses_completados||0) >= m ? 'bg-teal' : 'bg-secondary'}`} />
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded border font-medium ${ESTADO_COLORS[r.estado] || 'bg-secondary text-muted-foreground border-border'}`}>
                        {ESTADO_LABELS[r.estado] || r.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-sm font-semibold ${r.recompensa_pagada ? 'text-green-600' : 'text-foreground'}`}>
                        {r.recompensa_eur ? `${r.recompensa_eur} €` : (r.tipo_cliente === 'sociedad' ? '100 €' : '50 €')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setSelected(r); setNota(r.nota_admin || ''); }}>
                        Gestionar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && <div className="text-center py-8 text-sm text-muted-foreground">No hay referrals con este filtro.</div>}
          </div>
        </div>
      )}

      {/* Modal gestión */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="font-jakarta font-bold text-foreground text-lg mb-1">Gestionar referral</h3>
            <p className="text-sm text-muted-foreground mb-4">{selected.referrer_email} → {selected.referred_email || selected.referred_nombre}</p>

            <div className="space-y-3 mb-5">
              <div className="p-3 bg-secondary/30 rounded-lg text-xs space-y-1">
                <p><span className="text-muted-foreground">Estado actual:</span> <strong>{ESTADO_LABELS[selected.estado]}</strong></p>
                <p><span className="text-muted-foreground">Meses completados:</span> <strong>{selected.meses_completados || 0}/3</strong></p>
                <p><span className="text-muted-foreground">Recompensa:</span> <strong>{selected.tipo_cliente === 'sociedad' ? '100 €' : '50 €'}</strong></p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Nota interna</label>
                <Textarea value={nota} onChange={e => setNota(e.target.value)} placeholder="Motivo de la decisión..." rows={2} className="text-sm" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-3">
              <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" disabled={saving}
                onClick={() => handleAccion(selected.id, 'recompensa_aprobada')}>
                ✅ Aprobar recompensa
              </Button>
              <Button size="sm" className="bg-teal hover:bg-teal-dark" disabled={saving}
                onClick={() => handleAccion(selected.id, 'recompensa_pagada')}>
                💰 Marcar pagada
              </Button>
              <Button size="sm" variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/5" disabled={saving}
                onClick={() => handleAccion(selected.id, 'rechazado')}>
                ✗ Rechazar
              </Button>
              <Button size="sm" variant="outline" className="text-red-800 border-red-300 hover:bg-red-50" disabled={saving}
                onClick={() => handleAccion(selected.id, 'fraudulento')}>
                ⚠️ Marcar fraude
              </Button>
            </div>

            <Button variant="ghost" size="sm" className="w-full" onClick={() => setSelected(null)}>Cancelar</Button>
          </div>
        </div>
      )}
    </div>
  );
}