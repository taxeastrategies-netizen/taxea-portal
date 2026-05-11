import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Users, Copy, CheckCircle, Link2, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

function getReferralCode(email) {
  // Determinístico basado en email
  const str = email || 'user';
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  const code = Math.abs(hash).toString(36).toUpperCase().slice(0, 6).padEnd(6, '0');
  return `TXA-${code}`;
}

export default function TabAfiliados({ user }) {
  const [copied, setCopied] = useState(false);
  const [referred, setReferred] = useState([]);
  const [loading, setLoading] = useState(true);

  const code = getReferralCode(user?.email);
  const refLink = `${window.location.origin}/login?ref=${code}`;

  useEffect(() => {
    if (!user?.email) return;
    // Buscar empresas donde owner_email sea de usuarios referidos por este código
    // Por ahora mostramos un placeholder — arquitectura preparada
    setLoading(false);
  }, [user]);

  const copyLink = () => {
    navigator.clipboard.writeText(refLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-5">
      {/* Panel principal */}
      <div className="bg-card border border-border rounded-xl shadow-card p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 bg-teal-light rounded-lg flex items-center justify-center"><Users className="w-4 h-4 text-teal" /></div>
          <div>
            <h2 className="font-jakarta font-semibold text-foreground">Programa de referidos</h2>
            <p className="text-xs text-muted-foreground">Recomienda Taxea Portal y gana recompensas</p>
          </div>
        </div>

        {/* Código */}
        <div className="bg-teal-light/50 border border-teal/20 rounded-xl p-5 mb-5">
          <p className="text-xs font-medium text-teal uppercase tracking-wider mb-2">Tu código de referido</p>
          <div className="flex items-center gap-3">
            <span className="font-jakarta font-bold text-3xl tracking-widest text-teal">{code}</span>
          </div>
        </div>

        {/* Enlace */}
        <div>
          <p className="text-xs text-muted-foreground font-medium mb-2">Tu enlace único</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 bg-secondary/50 border border-border rounded-lg px-3 py-2.5">
              <Link2 className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              <p className="text-xs text-foreground truncate font-mono">{refLink}</p>
            </div>
            <Button size="sm" variant="outline" className="gap-1.5 h-9 flex-shrink-0" onClick={copyLink}>
              {copied ? <><CheckCircle className="w-3.5 h-3.5 text-green-500" />Copiado</> : <><Copy className="w-3.5 h-3.5" />Copiar</>}
            </Button>
          </div>
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Invitados', val: 0, icon: Users, color: 'text-blue-600 bg-blue-50' },
          { label: 'Activos', val: 0, icon: CheckCircle, color: 'text-green-600 bg-green-50' },
          { label: 'Recompensas', val: '—', icon: TrendingUp, color: 'text-gold bg-gold-light' },
        ].map(m => {
          const Icon = m.icon;
          return (
            <div key={m.label} className="bg-card border border-border rounded-xl p-4 text-center shadow-card">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center mx-auto mb-2 ${m.color}`}>
                <Icon className="w-4 h-4" />
              </div>
              <p className="text-lg font-jakarta font-bold text-foreground">{m.val}</p>
              <p className="text-xs text-muted-foreground">{m.label}</p>
            </div>
          );
        })}
      </div>

      <div className="bg-secondary/40 border border-border rounded-xl p-4">
        <p className="text-xs text-muted-foreground leading-relaxed">
          🚀 <strong>Próximamente:</strong> Comisiones, descuentos y recompensas por referidos activos. El sistema de conversiones y tracking está en desarrollo.
        </p>
      </div>
    </div>
  );
}