import { base44 } from '@/api/base44Client';
import { ExternalLink, Zap, Shield, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

const RISK_CFG = {
  muy_bajo: { label: 'Muy bajo', color: 'text-emerald-600', bg: 'bg-emerald-50' },
  bajo: { label: 'Bajo', color: 'text-emerald-600', bg: 'bg-emerald-50' },
  moderado: { label: 'Moderado', color: 'text-amber-600', bg: 'bg-amber-50' },
  alto: { label: 'Alto', color: 'text-orange-600', bg: 'bg-orange-50' },
  muy_alto: { label: 'Muy alto', color: 'text-red-600', bg: 'bg-red-50' },
};

const LIQUIDEZ_CFG = {
  inmediata: { label: 'Inmediata', icon: Zap },
  '1_7_dias': { label: '1-7 días', icon: Clock },
  '1_mes': { label: '1 mes', icon: Clock },
  '3_meses': { label: '3 meses', icon: Clock },
  limitada: { label: 'Limitada', icon: Shield },
};

const CAT_BADGE = {
  neobank: 'bg-blue-50 text-blue-700 border-blue-200',
  broker: 'bg-violet-50 text-violet-700 border-violet-200',
  crypto: 'bg-amber-50 text-amber-700 border-amber-200',
  fondos: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  depositos: 'bg-slate-100 text-slate-700 border-slate-200',
  treasury: 'bg-indigo-50 text-indigo-700 border-indigo-200',
};

// Hardcoded default partners shown if none in DB
const DEFAULT_PARTNERS = [
  { id: '_tr', nombre: 'Trade Republic', categoria: 'broker', descripcion: 'Broker europeo regulado. Cuenta de tesorería con rentabilidad orientativa en efectivo.', rentabilidad_orientativa: '~3.75% TAE (orientativo)', liquidez: 'inmediata', riesgo: 'bajo', tipo_producto: 'Cuenta efectivo · ETFs · Acciones', referral_link: '#', estado: 'activo' },
  { id: '_rev', nombre: 'Revolut Business', categoria: 'neobank', descripcion: 'Neobank con cuentas multimoneda, tarjetas y funciones de tesorería básica.', rentabilidad_orientativa: 'Variable', liquidez: 'inmediata', riesgo: 'muy_bajo', tipo_producto: 'Cuenta corriente · Multi-divisa', referral_link: '#', estado: 'activo' },
  { id: '_myinv', nombre: 'MyInvestor', categoria: 'fondos', descripcion: 'Plataforma española de fondos indexados y cuentas remuneradas para empresas.', rentabilidad_orientativa: 'Variable según fondo', liquidez: '1_7_dias', riesgo: 'bajo', tipo_producto: 'Fondos monetarios · Indexados', referral_link: '#', estado: 'activo' },
  { id: '_idx', nombre: 'Indexa Capital', categoria: 'fondos', descripcion: 'Gestión automatizada de carteras indexadas diversificadas.', rentabilidad_orientativa: 'Variable histórico', liquidez: '1_7_dias', riesgo: 'moderado', tipo_producto: 'Carteras indexadas', referral_link: '#', estado: 'activo' },
  { id: '_wise', nombre: 'Wise Business', categoria: 'neobank', descripcion: 'Cuenta business multimoneda con intereses en efectivo y pagos internacionales.', rentabilidad_orientativa: 'Variable', liquidez: 'inmediata', riesgo: 'muy_bajo', tipo_producto: 'Cuenta · Multi-divisa · Pagos', referral_link: '#', estado: 'activo' },
  { id: '_qonto', nombre: 'Qonto', categoria: 'neobank', descripcion: 'Neobank para pymes con servicios financieros integrados.', rentabilidad_orientativa: 'N/D', liquidez: 'inmediata', riesgo: 'muy_bajo', tipo_producto: 'Cuenta business · Pagos', referral_link: '#', estado: 'activo' },
];

export default function PartnerCards({ partners, companyId, onClickTrack }) {
  const displayPartners = partners.length > 0 ? partners : DEFAULT_PARTNERS;

  const handleClick = async (p) => {
    if (p.id?.startsWith('_')) { window.open('#', '_blank'); return; }
    await base44.entities.ReferralClick.create({
      partner_id: p.id,
      partner_nombre: p.nombre,
      company_id: companyId || '',
      tipo_evento: 'click',
      origen: 'plataformas_tab',
    }).catch(() => {});
    await base44.entities.InvestmentPartner.update(p.id, {
      total_clicks: (p.total_clicks || 0) + 1,
    }).catch(() => {});
    onClickTrack?.();
    if (p.referral_link && p.referral_link !== '#') {
      window.open(p.referral_link, '_blank', 'noopener noreferrer');
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2">
        <Shield className="w-4 h-4 text-amber-500 flex-shrink-0" />
        <p className="text-xs text-amber-700">
          <strong>Información orientativa.</strong> Las plataformas mostradas son herramientas externas de terceros. Taxea no presta asesoramiento financiero ni garantiza rendimientos. Consulta con un asesor regulado.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {displayPartners.map(p => {
          const riskCfg = RISK_CFG[p.riesgo] || RISK_CFG.bajo;
          const liqCfg = LIQUIDEZ_CFG[p.liquidez] || LIQUIDEZ_CFG.inmediata;
          const LiqIcon = liqCfg.icon;
          const catBadge = CAT_BADGE[p.categoria] || 'bg-slate-100 text-slate-600 border-slate-200';

          return (
            <div key={p.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all flex flex-col">
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-bold text-foreground">{p.nombre}</p>
                    {p.destacado && <span className="text-[9px] bg-amber-400 text-white font-bold px-1.5 py-0.5 rounded-full">DESTACADO</span>}
                  </div>
                  <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-lg border", catBadge)}>
                    {p.categoria?.replace('_', ' ')}
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-500 flex-1 mb-4">{p.descripcion}</p>

              {/* Stats */}
              <div className="space-y-2 mb-4">
                {p.tipo_producto && (
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-400">Producto</span>
                    <span className="font-medium text-foreground">{p.tipo_producto}</span>
                  </div>
                )}
                {p.rentabilidad_orientativa && (
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-400">Rentabilidad orient.</span>
                    <span className="font-semibold text-emerald-600">{p.rentabilidad_orientativa}</span>
                  </div>
                )}
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">Liquidez</span>
                  <span className="flex items-center gap-1 font-medium text-foreground"><LiqIcon className="w-3 h-3" />{liqCfg.label}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">Riesgo general</span>
                  <span className={cn("font-semibold", riskCfg.color)}>{riskCfg.label}</span>
                </div>
              </div>

              {/* CTA */}
              <button onClick={() => handleClick(p)}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-700 transition-all">
                <ExternalLink className="w-3.5 h-3.5" /> Acceder a la plataforma
              </button>
              <p className="text-[9px] text-slate-300 text-center mt-1.5">Herramienta de terceros · Información orientativa</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}