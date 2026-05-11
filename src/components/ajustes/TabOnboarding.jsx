import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { CheckCircle2, Circle, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const STEPS = [
  { id: 'perfil', label: 'Completar perfil de empresa', desc: 'Razón social, NIF y dirección fiscal', path: '/ajustes', check: (c) => !!(c?.razon_social && c?.nif_cif && c?.direccion_fiscal) },
  { id: 'impuesto', label: 'Configurar IVA / IGIC', desc: 'Indica el tipo de impuesto de tu empresa', path: '/ajustes', check: (c) => !!c?.tipo_impuesto },
  { id: 'banco', label: 'Añadir datos bancarios', desc: 'Necesarios para imprimir en facturas', path: '/ajustes', check: (c) => !!c?.datos_bancarios },
  { id: 'logo', label: 'Subir logo de empresa', desc: 'Aparecerá en tus facturas emitidas', path: '/ajustes', check: (c) => !!c?.logo_url },
  { id: 'factura', label: 'Crear primera factura', desc: 'Emite tu primera factura desde el portal', path: '/facturas', check: null },
  { id: 'gasto', label: 'Registrar primer gasto', desc: 'Sube un ticket o factura recibida', path: '/lector-gastos', check: null },
  { id: 'lector', label: 'Probar el Lector IA', desc: 'Extrae datos automáticamente con IA', path: '/lector-ingresos', check: null },
  { id: 'dashboard', label: 'Revisar el Dashboard fiscal', desc: 'Conoce tu situación fiscal en tiempo real', path: '/', check: null },
];

export default function TabOnboarding({ company }) {
  const [invoiceCount, setInvoiceCount] = useState(null);
  const [expenseCount, setExpenseCount] = useState(null);

  useEffect(() => {
    if (!company) return;
    Promise.all([
      base44.entities.Invoice.filter({ company_id: company.id }),
      base44.entities.Expense.filter({ company_id: company.id }),
    ]).then(([inv, exp]) => {
      setInvoiceCount(inv.length);
      setExpenseCount(exp.length);
    });
  }, [company]);

  const isComplete = (step) => {
    if (step.check) return step.check(company);
    if (step.id === 'factura') return invoiceCount != null && invoiceCount > 0;
    if (step.id === 'gasto') return expenseCount != null && expenseCount > 0;
    if (step.id === 'lector') return expenseCount != null && expenseCount > 0;
    if (step.id === 'dashboard') return true;
    return false;
  };

  const completedCount = STEPS.filter(s => isComplete(s)).length;
  const pct = Math.round((completedCount / STEPS.length) * 100);

  return (
    <div className="space-y-5">
      {/* Progreso */}
      <div className="bg-card border border-border rounded-xl shadow-card p-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-jakarta font-semibold text-foreground">Primeros pasos</h2>
            <p className="text-xs text-muted-foreground">{completedCount} de {STEPS.length} completados</p>
          </div>
          <div className="text-right">
            <span className="text-2xl font-jakarta font-bold text-teal">{pct}%</span>
          </div>
        </div>
        <div className="w-full h-2.5 bg-secondary rounded-full overflow-hidden">
          <div className="h-full bg-teal rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
        {pct === 100 && (
          <div className="mt-3 flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2.5">
            <CheckCircle2 className="w-4 h-4" /> ¡Onboarding completado! Tu portal está listo.
          </div>
        )}
      </div>

      {/* Lista */}
      <div className="bg-card border border-border rounded-xl shadow-card divide-y divide-border overflow-hidden">
        {STEPS.map((step, i) => {
          const done = isComplete(step);
          return (
            <Link key={step.id} to={step.path} className="flex items-center gap-4 px-5 py-4 hover:bg-secondary/20 transition-colors">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${done ? 'bg-teal text-white' : 'border-2 border-border text-muted-foreground'}`}>
                {done ? <CheckCircle2 className="w-4 h-4" /> : <span className="text-xs font-bold">{i + 1}</span>}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${done ? 'line-through text-muted-foreground' : 'text-foreground'}`}>{step.label}</p>
                <p className="text-xs text-muted-foreground">{step.desc}</p>
              </div>
              {!done && <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
            </Link>
          );
        })}
      </div>
    </div>
  );
}