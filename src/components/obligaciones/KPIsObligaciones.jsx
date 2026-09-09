import { AlertTriangle, CheckCircle2, Clock3, FileCheck2, Landmark } from 'lucide-react';

const CLOSED = new Set(['presentado', 'pagado', 'finalizado', 'no_aplica']);
const daysUntil = value => value ? Math.ceil((new Date(`${value}T23:59:59`) - new Date()) / 86400000) : null;

export default function KPIsObligaciones({ obligations = [], profile }) {
  const pending = obligations.filter(row => !CLOSED.has(row.state));
  const overdue = pending.filter(row => daysUntil(row.filingDeadline) < 0).length;
  const next15 = pending.filter(row => {
    const days = daysUntil(row.filingDeadline);
    return days !== null && days >= 0 && days <= 15;
  }).length;
  const filed = obligations.filter(row => CLOSED.has(row.state)).length;
  const withDocuments = obligations.filter(row => row.documents?.length > 0).length;
  const cards = [
    { label: 'Obligaciones del perfil', value: obligations.length, icon: Landmark, tone: 'bg-slate-100 text-slate-700' },
    { label: 'Próximas 15 días', value: next15, icon: Clock3, tone: next15 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-50 text-emerald-700' },
    { label: 'Vencidas pendientes', value: overdue, icon: AlertTriangle, tone: overdue ? 'bg-red-100 text-red-700' : 'bg-emerald-50 text-emerald-700' },
    { label: 'Presentadas / cerradas', value: filed, icon: CheckCircle2, tone: 'bg-emerald-100 text-emerald-700' },
    { label: 'Con documentos', value: withDocuments, icon: FileCheck2, tone: 'bg-blue-100 text-blue-700' },
  ];

  return (
    <div className="space-y-3 mb-5">
      {profile && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{profile.fiscalName || 'Perfil fiscal'}</span>
          <span>·</span>
          <span>{profile.mainTerritory === 'canarias' ? 'Canarias / ATC' : 'Territorio IVA / AEAT'}</span>
          <span className={profile.profileStatus === 'validado_asesor' ? 'text-emerald-700' : 'text-amber-700'}>
            · {profile.profileStatus === 'validado_asesor' ? 'Validado por asesor' : 'Pendiente de validación'}
          </span>
        </div>
      )}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {cards.map(card => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-card border border-border rounded-xl p-4 shadow-card">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${card.tone}`}>
                <Icon className="w-4 h-4" />
              </div>
              <p className="text-2xl font-semibold mt-3 tabular-nums">{card.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{card.label}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

