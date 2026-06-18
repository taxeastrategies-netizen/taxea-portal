import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Lock, TrendingUp, Users, Filter, RefreshCw, Settings, ExternalLink, CheckCircle } from 'lucide-react';
import AdminOcrAdjustmentModal from '@/components/ocr/AdminOcrAdjustmentModal';

const STATUS_LABELS = {
  available: { label: 'Disponible', color: 'text-green-700 bg-green-50 border-green-200' },
  warning: { label: 'Aviso 80%', color: 'text-amber-700 bg-amber-50 border-amber-200' },
  critical: { label: 'Crítico 90%', color: 'text-orange-700 bg-orange-50 border-orange-200' },
  exhausted: { label: 'Agotado', color: 'text-red-700 bg-red-50 border-red-200' },
  manually_extended: { label: 'Ampliado', color: 'text-blue-700 bg-blue-50 border-blue-200' },
  unlimited: { label: 'Sin límite', color: 'text-primary bg-accent border-border' },
  suspended: { label: 'Suspendido', color: 'text-slate-600 bg-slate-50 border-slate-200' },
};

function getCurrentQuarterKey() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  const quarter = Math.ceil(month / 3);
  return `${year}-Q${quarter}`;
}

export default function AdminOcrCredits() {
  const { user, isAdmin } = useOutletContext() || {};
  const [periods, setPeriods] = useState([]);
  const [clients, setClients] = useState([]);
  const [plans, setPlans] = useState([]);
  const [reviewRequests, setReviewRequests] = useState([]);
  const [upgradeRequests, setUpgradeRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [quarterKey, setQuarterKey] = useState(getCurrentQuarterKey());
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [adjustModal, setAdjustModal] = useState(null);

  useEffect(() => {
    if (isAdmin) loadData();
  }, [isAdmin, quarterKey]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [periodsRes, clientsRes, plansRes, reviewRes, upgradeRes] = await Promise.all([
        base44.entities.OcrQuotaPeriod.filter({ quarterKey }),
        base44.entities.ClientAccount.list(),
        base44.entities.PlanCatalog.filter({ isActive: true }),
        base44.entities.OcrReviewRequest.list('-created_date', 50),
        base44.entities.PlanUpgradeRequest.list('-created_date', 50),
      ]);
      setPeriods(periodsRes || []);
      setClients(clientsRes || []);
      setPlans(plansRes || []);
      setReviewRequests(reviewRes || []);
      setUpgradeRequests(upgradeRes || []);
    } catch {}
    setLoading(false);
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Lock className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Acceso restringido a administradores.</p>
        </div>
      </div>
    );
  }

  const clientMap = {};
  clients.forEach(c => { clientMap[c.id] = c; });
  const planMap = {};
  plans.forEach(p => { planMap[p.planCode] = p; });

  const enriched = periods.map(p => ({
    ...p,
    client: clientMap[p.billingAccountId],
    planInfo: planMap[p.currentPlanCode],
    available: p.isUnlimited ? null : Math.max(0, (p.currentPlanLimit + p.manualCredits) - p.consumedCredits - p.reservedCredits),
    pct: (!p.isUnlimited && (p.currentPlanLimit + p.manualCredits) > 0)
      ? Math.round((p.consumedCredits / (p.currentPlanLimit + p.manualCredits)) * 100)
      : 0,
  }));

  const filtered = enriched.filter(p => {
    const client = p.client;
    const matchSearch = !search || (client?.legalName?.toLowerCase().includes(search.toLowerCase()) ||
      client?.taxId?.includes(search));
    const matchStatus = !filterStatus || p.status === filterStatus;
    return matchSearch && matchStatus;
  });

  // KPIs
  const totalConsumed = periods.reduce((s, p) => s + (p.consumedCredits || 0), 0);
  const exhaustedCount = periods.filter(p => p.status === 'exhausted').length;
  const warningCount = periods.filter(p => p.status === 'warning' || p.status === 'critical').length;
  const pendingReviews = reviewRequests.filter(r => r.status === 'Nueva' || r.status === 'En revisión').length;
  const pendingUpgrades = upgradeRequests.filter(r => r.status === 'payment_pending').length;

  const quarterOptions = [];
  const now = new Date();
  for (let i = 0; i < 4; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i * 3, 1));
    const yr = d.getUTCFullYear();
    const q = Math.ceil((d.getUTCMonth() + 1) / 3);
    quarterOptions.push(`${yr}-Q${q}`);
  }

  return (
    <div>
      <PageHeader
        title="Control de créditos OCR"
        subtitle="Gestión de límites trimestrales, ajustes manuales y escalado de planes"
        actions={
          <Button variant="outline" size="sm" onClick={loadData} className="gap-1">
            <RefreshCw className="w-3.5 h-3.5" /> Actualizar
          </Button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {[
          { label: 'Total procesadas', value: totalConsumed, Icon: CheckCircle, color: 'text-green-600' },
          { label: 'Agotados', value: exhaustedCount, Icon: Lock, color: 'text-red-600' },
          { label: 'Cerca del límite', value: warningCount, Icon: AlertTriangle, color: 'text-amber-600' },
          { label: 'Revisiones pendientes', value: pendingReviews, Icon: Users, color: 'text-blue-600' },
          { label: 'Ampliaciones pendientes', value: pendingUpgrades, Icon: TrendingUp, color: 'text-purple-600' },
        ].map(({ label, value, Icon, color }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-4 shadow-card">
            <div className="flex items-center gap-2 mb-1">
              <Icon className={`w-4 h-4 ${color}`} /> {/* eslint-disable-line */}
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
            <p className={`text-2xl font-jakarta font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Solicitudes pendientes */}
      {pendingReviews > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5 flex items-start gap-3">
          <Users className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-blue-800">{pendingReviews} solicitud{pendingReviews > 1 ? 'es' : ''} de revisión pendiente{pendingReviews > 1 ? 's' : ''}</p>
            <div className="mt-2 space-y-1">
              {reviewRequests.filter(r => r.status === 'Nueva' || r.status === 'En revisión').slice(0, 3).map(r => (
                <div key={r.id} className="text-xs text-blue-700 bg-white border border-blue-100 rounded px-2 py-1">
                  {clientMap[r.billingAccountId]?.legalName || r.billingAccountId} · {r.message?.substring(0, 80)}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar cliente o NIF..."
          className="h-9 px-3 rounded-md border border-input bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-ring w-56"
        />
        <select value={quarterKey} onChange={e => setQuarterKey(e.target.value)}
          className="h-9 px-3 rounded-md border border-input bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-ring">
          {quarterOptions.map(q => <option key={q} value={q}>{q}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="h-9 px-3 rounded-md border border-input bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-ring">
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_LABELS).map(([key, { label }]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground">
          No hay periodos OCR para el trimestre seleccionado.
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {['Cliente', 'Tipo', 'Plan', 'Cuota €/mes', 'Límite', 'Consumidas', 'Reservadas', 'Disponibles', '%', 'Estado', 'Acciones'].map(col => (
                    <th key={col} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(row => {
                  const client = row.client;
                  const planInfo = row.planInfo;
                  const sCfg = STATUS_LABELS[row.status] || STATUS_LABELS.available;
                  return (
                    <tr key={row.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-3 font-medium">{client?.legalName || row.billingAccountId?.substring(0, 8)}</td>
                      <td className="px-4 py-3 text-muted-foreground capitalize">{planInfo?.clientType || '—'}</td>
                      <td className="px-4 py-3">{planInfo?.displayName || row.currentPlanCode || '—'}</td>
                      <td className="px-4 py-3">{planInfo ? `${planInfo.monthlyBasePrice} €` : '—'}</td>
                      <td className="px-4 py-3 font-mono">
                        {row.isUnlimited ? '∞' : `${row.currentPlanLimit + (row.manualCredits || 0)}`}
                      </td>
                      <td className="px-4 py-3 font-mono">{row.consumedCredits || 0}</td>
                      <td className="px-4 py-3 font-mono">{row.reservedCredits || 0}</td>
                      <td className="px-4 py-3 font-mono">{row.isUnlimited ? '∞' : (row.available ?? 0)}</td>
                      <td className="px-4 py-3 font-mono">{row.isUnlimited ? '—' : `${row.pct}%`}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${sCfg.color}`}>{sCfg.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <Button size="sm" variant="outline" className="text-xs h-7"
                          onClick={() => setAdjustModal({ period: row, client, planInfo })}>
                          <Settings className="w-3 h-3 mr-1" /> Gestionar
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {adjustModal && (
        <AdminOcrAdjustmentModal
          period={adjustModal.period}
          client={adjustModal.client}
          planInfo={adjustModal.planInfo}
          adminUser={user}
          onClose={() => setAdjustModal(null)}
          onSaved={() => { setAdjustModal(null); loadData(); }}
        />
      )}
    </div>
  );
}