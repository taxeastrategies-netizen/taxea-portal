import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Users, Copy, CheckCircle, Link2, Trophy, Star, Medal, Crown, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

function getReferralCode(email) {
  const str = email || 'user';
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  return `TXA-${Math.abs(hash).toString(36).toUpperCase().slice(0, 6).padEnd(6, '0')}`;
}

const ESTADO_LABELS = {
  invitacion_enviada: 'Invitación enviada',
  registrado: 'Registrado',
  perfil_completado: 'Perfil completado',
  cliente_activo: 'Cliente activo',
  primer_pago: 'Primer pago realizado',
  mes_1: 'Mes 1 completado',
  mes_2: 'Mes 2 completado',
  mes_3: 'Mes 3 completado',
  pendiente_validacion: 'Pendiente validación',
  recompensa_aprobada: '✅ Recompensa aprobada',
  recompensa_pagada: '💰 Recompensa pagada',
  rechazado: 'Rechazado',
  fraudulento: '⚠️ Fraude',
};

const ESTADO_COLORS = {
  invitacion_enviada: 'bg-secondary text-muted-foreground',
  registrado: 'bg-blue-50 text-blue-700',
  perfil_completado: 'bg-blue-50 text-blue-700',
  cliente_activo: 'bg-teal-light text-teal',
  primer_pago: 'bg-teal-light text-teal',
  mes_1: 'bg-amber-50 text-amber-700',
  mes_2: 'bg-amber-50 text-amber-700',
  mes_3: 'bg-orange-50 text-orange-700',
  pendiente_validacion: 'bg-purple-50 text-purple-700',
  recompensa_aprobada: 'bg-green-50 text-green-700',
  recompensa_pagada: 'bg-green-100 text-green-800',
  rechazado: 'bg-red-50 text-red-700',
  fraudulento: 'bg-red-100 text-red-800',
};

const NIVELES = [
  { id: 'bronce', label: 'Bronce', min: 0, max: 2, icon: Medal, color: 'text-amber-600 bg-amber-50' },
  { id: 'plata', label: 'Plata', min: 3, max: 9, icon: Star, color: 'text-slate-500 bg-slate-100' },
  { id: 'oro', label: 'Oro', min: 10, max: 24, icon: Trophy, color: 'text-yellow-600 bg-yellow-50' },
  { id: 'partner', label: 'Partner', min: 25, max: Infinity, icon: Crown, color: 'text-purple-600 bg-purple-50' },
];

function getNivel(activos) {
  return NIVELES.find(n => activos >= n.min && activos <= n.max) || NIVELES[0];
}

function BarraProgreso({ meses }) {
  const pct = Math.min((meses / 3) * 100, 100);
  return (
    <div className="mt-1">
      <div className="flex justify-between text-xs text-muted-foreground mb-1">
        <span>Permanencia</span><span>{meses}/3 meses</span>
      </div>
      <div className="h-2 bg-secondary rounded-full overflow-hidden">
        <div className="h-full bg-teal rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function TabAfiliados({ user }) {
  const [copied, setCopied] = useState(false);
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);

  const code = getReferralCode(user?.email);
  const refLink = `${window.location.origin}/login?ref=${code}`;

  useEffect(() => {
    if (!user?.email) return;
    base44.entities.Referral.filter({ referrer_email: user.email })
      .then(setReferrals)
      .finally(() => setLoading(false));
  }, [user]);

  const copyLink = () => {
    navigator.clipboard.writeText(refLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const activos = referrals.filter(r => ['cliente_activo','primer_pago','mes_1','mes_2','mes_3','pendiente_validacion','recompensa_aprobada','recompensa_pagada'].includes(r.estado)).length;
  const ganado = referrals.filter(r => r.recompensa_pagada).reduce((s, r) => s + (r.recompensa_eur || 0), 0);
  const pendiente = referrals.filter(r => r.estado === 'recompensa_aprobada').reduce((s, r) => s + (r.recompensa_eur || 0), 0);
  const nivel = getNivel(activos);
  const NivelIcon = nivel.icon;

  return (
    <div className="space-y-5">
      {/* Código + nivel */}
      <div className="bg-card border border-border rounded-xl shadow-card p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-teal-light rounded-lg flex items-center justify-center"><Users className="w-4 h-4 text-teal" /></div>
            <div>
              <h2 className="font-jakarta font-semibold text-foreground">Programa de referidos</h2>
              <p className="text-xs text-muted-foreground">Recomienda Taxea y gana recompensas</p>
            </div>
          </div>
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold ${nivel.color}`}>
            <NivelIcon className="w-4 h-4" />{nivel.label}
          </div>
        </div>

        {/* Código */}
        <div className="bg-teal-light/50 border border-teal/20 rounded-xl p-5 mb-4">
          <p className="text-xs font-medium text-teal uppercase tracking-wider mb-1">Tu código referral</p>
          <span className="font-jakarta font-bold text-3xl tracking-widest text-teal">{code}</span>
        </div>

        {/* Enlace */}
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 bg-secondary/50 border border-border rounded-lg px-3 py-2.5 min-w-0">
            <Link2 className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
            <p className="text-xs text-foreground truncate font-mono">{refLink}</p>
          </div>
          <Button size="sm" variant="outline" className="gap-1.5 flex-shrink-0" onClick={copyLink}>
            {copied ? <><CheckCircle className="w-3.5 h-3.5 text-green-500" />Copiado</> : <><Copy className="w-3.5 h-3.5" />Copiar</>}
          </Button>
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card border border-border rounded-xl p-4 shadow-card">
          <p className="text-xs text-muted-foreground mb-1">Referidos activos</p>
          <p className="text-2xl font-jakarta font-bold text-foreground">{activos}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 shadow-card">
          <p className="text-xs text-muted-foreground mb-1">Total referrals</p>
          <p className="text-2xl font-jakarta font-bold text-foreground">{referrals.length}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 shadow-card">
          <p className="text-xs text-muted-foreground mb-1">Total ganado</p>
          <p className="text-2xl font-jakarta font-bold text-green-600">{ganado} €</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 shadow-card">
          <p className="text-xs text-muted-foreground mb-1">Pendiente de cobro</p>
          <p className="text-2xl font-jakarta font-bold text-amber-600">{pendiente} €</p>
        </div>
      </div>

      {/* Lista referidos */}
      {loading ? (
        <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-teal border-t-transparent rounded-full animate-spin" /></div>
      ) : referrals.length > 0 ? (
        <div className="bg-card border border-border rounded-xl shadow-card overflow-hidden">
          <div className="px-5 py-3 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">Mis referidos</h3>
          </div>
          <div className="divide-y divide-border">
            {referrals.map(r => (
              <div key={r.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <p className="text-sm font-medium text-foreground">{r.referred_nombre || r.referred_email}</p>
                    <p className="text-xs text-muted-foreground">{r.tipo_cliente === 'sociedad' ? 'Sociedad' : 'Persona física'} · Recompensa: {r.tipo_cliente === 'sociedad' ? '100 €' : '50 €'}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded font-medium flex-shrink-0 ${ESTADO_COLORS[r.estado] || 'bg-secondary text-muted-foreground'}`}>
                    {ESTADO_LABELS[r.estado] || r.estado}
                  </span>
                </div>
                <BarraProgreso meses={r.meses_completados || 0} />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl shadow-card p-8 text-center">
          <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground mb-1">Aún no tienes referidos</p>
          <p className="text-xs text-muted-foreground">Comparte tu enlace y empieza a ganar recompensas</p>
        </div>
      )}

      {/* Condiciones */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-700 mb-1">Condiciones del programa</p>
            <p className="text-xs text-amber-600 leading-relaxed">La recompensa solo será válida si el cliente referido mantiene una permanencia mínima de 3 meses como cliente activo y al corriente de pago. Las recompensas no se liberan automáticamente y requieren validación manual por parte de Taxea Strategies.</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="bg-white border border-amber-200 rounded-lg p-2.5 text-center">
                <p className="text-xs text-amber-600 font-medium">Persona física</p>
                <p className="text-lg font-jakarta font-bold text-amber-700">50 €</p>
                <p className="text-xs text-amber-600">plan desde 30 €/mes</p>
              </div>
              <div className="bg-white border border-amber-200 rounded-lg p-2.5 text-center">
                <p className="text-xs text-amber-600 font-medium">Sociedad</p>
                <p className="text-lg font-jakarta font-bold text-amber-700">100 €</p>
                <p className="text-xs text-amber-600">plan desde 50 €/mes</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Niveles */}
      <div className="bg-card border border-border rounded-xl shadow-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-3">Niveles de afiliado</h3>
        <div className="grid grid-cols-2 gap-2">
          {NIVELES.map(n => {
            const Icon = n.icon;
            const activo = nivel.id === n.id;
            return (
              <div key={n.id} className={`flex items-center gap-2 p-3 rounded-lg border ${activo ? 'border-teal bg-teal-light/30' : 'border-border bg-secondary/20'}`}>
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${n.color}`}><Icon className="w-4 h-4" /></div>
                <div>
                  <p className={`text-xs font-semibold ${activo ? 'text-teal' : 'text-foreground'}`}>{n.label}</p>
                  <p className="text-xs text-muted-foreground">{n.id === 'partner' ? '25+' : `${n.min}–${n.max}`} activos</p>
                </div>
                {activo && <span className="ml-auto text-xs text-teal font-medium">Actual</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}