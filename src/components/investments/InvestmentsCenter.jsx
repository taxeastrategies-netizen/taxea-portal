import { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { TrendingUp, Zap, BarChart2, Settings, Link2, PieChart, Sliders, Shield, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import LiquidityRadar from './LiquidityRadar';
import PartnerCards from './PartnerCards';
import ReferralEngine from './ReferralEngine';
import AffiliateTracking from './AffiliateTracking';
import PartnerDashboard from './PartnerDashboard';
import TreasuryYield from './TreasuryYield';
import InvestSimulator from './InvestSimulator';
import AdminInvestConsole from './AdminInvestConsole';

const TABS = [
  { id: 'liquidez',   label: 'Exceso liquidez',     icon: Zap },
  { id: 'plataformas',label: 'Plataformas',          icon: TrendingUp },
  { id: 'yield',      label: 'Treasury Yield',       icon: PieChart },
  { id: 'simulator',  label: 'Simulador',            icon: Sliders },
  { id: 'referrals',  label: 'Referral Engine',      icon: Link2 },
  { id: 'tracking',   label: 'Affiliate Tracking',   icon: BarChart2 },
  { id: 'partners',   label: 'Partner Dashboard',    icon: Shield },
  { id: 'console',    label: 'Admin Console',        icon: Settings },
];

export default function InvestmentsCenter() {
  const ctx = useOutletContext() || {};
  const { company, user } = ctx;
  const companyId = company?.id;

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  const [tab, setTab] = useState('liquidez');
  const [partners, setPartners] = useState([]);
  const [clicks, setClicks] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    const [pts, cls, banks, inv] = await Promise.all([
      base44.entities.InvestmentPartner.list('-orden', 100),
      base44.entities.ReferralClick.list('-created_date', 500),
      companyId ? base44.entities.BankAccount.filter({ company_id: companyId }) : Promise.resolve([]),
      companyId ? base44.entities.Invoice.filter({ company_id: companyId }) : Promise.resolve([]),
    ]);
    setPartners(pts || []);
    setClicks(cls || []);
    setBankAccounts(banks || []);
    setInvoices(inv || []);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [companyId]);

  const liquidez = useMemo(() => {
    const saldo = bankAccounts.reduce((s, b) => s + (b.saldo_disponible || 0), 0);
    const gastosM = invoices.filter(i => i.tipo === 'recibida').reduce((s, i) => s + (i.total_factura || 0), 0) / 12;
    const minOperativa = gastosM * 3;
    const exceso = Math.max(0, saldo - minOperativa);
    return { saldo, minOperativa, exceso, gastosM };
  }, [bankAccounts, invoices]);

  const affiliateKpis = useMemo(() => {
    const totalClicks = clicks.filter(c => c.tipo_evento === 'click').length;
    const totalRegistros = clicks.filter(c => c.tipo_evento === 'registro').length;
    const totalConversiones = clicks.filter(c => c.tipo_evento === 'conversion').length;
    const ingresos = clicks.filter(c => c.tipo_evento === 'payout').reduce((s, c) => s + (c.importe || 0), 0);
    return { totalClicks, totalRegistros, totalConversiones, ingresos };
  }, [clicks]);

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
          <Lock className="w-8 h-8 text-slate-300" />
        </div>
        <p className="text-sm font-semibold text-slate-400">Acceso restringido</p>
        <p className="text-xs text-slate-300 mt-1">Este módulo es de uso interno.</p>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-md">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-jakarta font-bold text-foreground">Investments & Partners</h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200">ADMIN ONLY</span>
            </div>
            <p className="text-sm text-slate-400 mt-0.5">Infraestructura treasury, partnerships financieros y referral engine</p>
          </div>
        </div>
        <div className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-[10px] text-slate-400 font-medium">
          ⚠ Información orientativa · No asesoramiento financiero
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 flex-wrap">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn("flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium transition-all",
                tab === t.id ? "bg-white text-foreground shadow-sm" : "text-slate-500 hover:text-slate-700")}>
              <Icon className="w-3.5 h-3.5" />{t.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {tab === 'liquidez'    && <LiquidityRadar liquidez={liquidez} bankAccounts={bankAccounts} />}
          {tab === 'plataformas' && <PartnerCards partners={partners.filter(p => p.estado === 'activo')} companyId={companyId} onClickTrack={loadData} />}
          {tab === 'yield'       && <TreasuryYield liquidez={liquidez} />}
          {tab === 'simulator'   && <InvestSimulator liquidez={liquidez} />}
          {tab === 'referrals'   && <ReferralEngine partners={partners} onRefresh={loadData} />}
          {tab === 'tracking'    && <AffiliateTracking clicks={clicks} partners={partners} kpis={affiliateKpis} />}
          {tab === 'partners'    && <PartnerDashboard partners={partners} clicks={clicks} kpis={affiliateKpis} onRefresh={loadData} />}
          {tab === 'console'     && <AdminInvestConsole partners={partners} onRefresh={loadData} />}
        </>
      )}

      {/* Disclaimer */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
        <p className="text-[10px] text-slate-400">
          ⚠ <strong>Información orientativa.</strong> Taxea no presta asesoramiento financiero, de inversión ni recomendaciones reguladas. 
          Las plataformas y datos mostrados tienen carácter meramente informativo. Consúltese con un asesor financiero regulado antes de tomar decisiones de inversión.
        </p>
      </div>
    </motion.div>
  );
}