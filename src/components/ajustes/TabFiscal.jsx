import { useOutletContext } from 'react-router-dom';
import FiscalProfileManager from './FiscalProfileManager';
import CounterpartyManager from './CounterpartyManager';
import FiscalRulesManager from './FiscalRulesManager';
import FiscalTestSimulator from './FiscalTestSimulator';

export default function TabFiscal() {
  const { company, user } = useOutletContext() || {};
  return (
    <div className="space-y-6">
      <FiscalProfileManager company={company} user={user} />
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-4 text-sm font-semibold">Terceros y criterios recurrentes</h3>
        <CounterpartyManager companyId={company?.id} />
      </div>
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-4 text-sm font-semibold">Reglas fiscales personalizadas</h3>
        <FiscalRulesManager companyId={company?.id} />
      </div>
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-4 text-sm font-semibold">Simulador fiscal</h3>
        <FiscalTestSimulator companyId={company?.id} />
      </div>
    </div>
  );
}

