import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { Zap, Cpu, BookOpen, BarChart2, TrendingUp, Flame, MapPin, Library, Target } from 'lucide-react';
import { cn } from '@/lib/utils';

import GrowthWarRoom from './premium/GrowthWarRoom';
import CampaignAutopilot from './premium/CampaignAutopilot';
import SectorPlaybooks from './premium/SectorPlaybooks';
import RevenueIntelligence from './premium/RevenueIntelligence';
import GrowthForecast from './premium/GrowthForecast';
import PainMining from './premium/PainMining';
import LocalGrowth from './premium/LocalGrowth';
import CampaignLibrary from './premium/CampaignLibrary';
import ActionPlan from './premium/ActionPlan';

const TABS = [
  { id: 'war-room', label: 'War Room', icon: Zap, desc: 'Vista ejecutiva' },
  { id: 'autopilot', label: 'Campaign Autopilot', icon: Cpu, desc: 'Genera campanas completas' },
  { id: 'playbooks', label: 'Sector Playbooks', icon: BookOpen, desc: '8 sectores accionables' },
  { id: 'intelligence', label: 'Revenue Intelligence', icon: BarChart2, desc: 'Insights de rentabilidad' },
  { id: 'forecast', label: 'Forecast', icon: TrendingUp, desc: 'Simula escenarios' },
  { id: 'pain-mining', label: 'Pain Mining', icon: Flame, desc: 'Dolores del mercado' },
  { id: 'local', label: 'Local Growth', icon: MapPin, desc: 'Domina tu mercado local' },
  { id: 'library', label: 'Campaign Library', icon: Library, desc: '10 campanas Taxea' },
  { id: 'action-plan', label: 'Action Plan', icon: Target, desc: '7, 30 o 90 dias' },
];

const COMPONENT_MAP = {
  'war-room': GrowthWarRoom,
  'autopilot': CampaignAutopilot,
  'playbooks': SectorPlaybooks,
  'intelligence': RevenueIntelligence,
  'forecast': GrowthForecast,
  'pain-mining': PainMining,
  'local': LocalGrowth,
  'library': CampaignLibrary,
  'action-plan': ActionPlan,
};

export default function GrowthPremiumHub() {
  const [activeTab, setActiveTab] = useState('war-room');
  const context = useOutletContext();
  const Component = COMPONENT_MAP[activeTab] || GrowthWarRoom;

  return (
    <div className="flex flex-col h-full">
      {/* Premium Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-6 pt-5 pb-0">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-lg bg-amber-400/20 flex items-center justify-center"><Zap className="w-4 h-4 text-amber-400" /></div>
          <div>
            <p className="text-white font-bold text-sm">Growth Premium</p>
            <p className="text-white/40 text-xs">Fase 3 — Innovacion &amp; Direccion IA</p>
          </div>
          <span className="ml-auto text-[10px] bg-amber-400/20 text-amber-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">Premium</span>
        </div>
        <div className="flex gap-1 overflow-x-auto pb-0">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={cn(
                'flex-shrink-0 flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-all rounded-t-lg border-b-2',
                activeTab === t.id
                  ? 'bg-white/10 text-white border-amber-400'
                  : 'text-white/50 border-transparent hover:text-white/80 hover:bg-white/5'
              )}
            >
              <t.icon className="w-3 h-3" />{t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <Component {...context} />
      </div>
    </div>
  );
}