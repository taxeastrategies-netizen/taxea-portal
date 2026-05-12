import { motion } from 'framer-motion';
import { RefreshCw, Download, Share2, Settings, Wifi, TrendingUp, TrendingDown } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export default function CashPositionHeader({ company, lastSync, loading, onRefresh }) {
  const now = new Date();
  const syncAgo = lastSync ? Math.round((now - lastSync) / 60000) : null;

  return (
    <div className="flex flex-col gap-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-white/35 font-medium">
        <span className="hover:text-emerald-400 cursor-pointer transition-colors">Finance</span>
        <span className="text-white/20">›</span>
        <span className="text-emerald-400">Cashflow Center</span>
      </div>

      {/* Main header row */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
              <svg className="w-6 h-6 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                <path d="M2 17l10 5 10-5"/>
                <path d="M2 12l10 5 10-5"/>
              </svg>
            </div>
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#0a0a0c] animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-jakarta font-bold text-white tracking-tight">Cashflow Center</h1>
            <p className="text-sm text-white/40 mt-0.5">{company?.nombre_comercial || company?.razon_social || 'Tu empresa'}</p>
          </div>
        </div>

        {/* Right — actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Sync status */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/8">
            <Wifi className="w-3 h-3 text-emerald-400" />
            <span className="text-xs text-white/50">
              {syncAgo !== null ? (syncAgo === 0 ? 'Ahora mismo' : `Hace ${syncAgo} min`) : 'En tiempo real'}
            </span>
          </div>

          <button
            onClick={onRefresh}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
              "bg-white/5 border border-white/8 text-white/50 hover:text-white hover:bg-white/10",
              loading && "animate-spin"
            )}
          >
            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
            <span className="hidden sm:inline">Actualizar</span>
          </button>

          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 border border-white/8 text-white/50 hover:text-white hover:bg-white/10 transition-all">
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Exportar</span>
          </button>

          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 border border-white/8 text-white/50 hover:text-white hover:bg-white/10 transition-all">
            <Share2 className="w-3.5 h-3.5" />
          </button>

          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 border border-white/8 text-white/50 hover:text-white hover:bg-white/10 transition-all">
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}