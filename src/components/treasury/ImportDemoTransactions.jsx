import { Sparkles } from 'lucide-react';

export default function ImportDemoTransactions() {
  return (
    <button type="button" disabled title="Los datos de demostración están desactivados para proteger la tesorería real"
      className="flex cursor-not-allowed items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-400 opacity-70">
      <Sparkles className="w-3.5 h-3.5" />
      Demo desactivada
    </button>
  );
}
