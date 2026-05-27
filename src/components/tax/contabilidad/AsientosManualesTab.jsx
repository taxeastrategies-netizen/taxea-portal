import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { PenLine, Plus, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import JournalEntryForm from './JournalEntryForm';

const STATUS_CFG = {
  borrador:           { label: 'Borrador',           color: 'bg-slate-100 text-slate-600' },
  pendiente_revision: { label: 'Pdte. revisión',     color: 'bg-amber-100 text-amber-700' },
  confirmado:         { label: 'Confirmado',         color: 'bg-emerald-100 text-emerald-700' },
  anulado:            { label: 'Anulado',            color: 'bg-red-100 text-red-700' },
};

const fmt = (n) => n != null ? new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n) : '—';

export default function AsientosManualesTab() {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['journal-manuales'],
    queryFn: () => base44.entities.JournalEntry.filter({ source: 'manual' }, '-date', 100),
  });

  const { data: allLines = [] } = useQuery({
    queryKey: ['journal-lines-manuales'],
    queryFn: () => base44.entities.JournalEntryLine.list('-created_date', 500),
  });

  if (isLoading) return <div className="p-10 text-center text-muted-foreground text-sm">Cargando asientos...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-jakarta font-semibold text-foreground">Asientos manuales</p>
          <p className="text-xs text-muted-foreground mt-0.5">Solo asientos creados manualmente por el asesor. Solo los confirmados afectan al diario y balances.</p>
        </div>
        <Button size="sm" className="gap-1.5 h-8" onClick={() => setShowForm(true)}>
          <Plus className="w-3.5 h-3.5" /> Nuevo asiento manual
        </Button>
      </div>

      {entries.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-16 text-center space-y-3">
          <PenLine className="w-10 h-10 text-muted-foreground/40 mx-auto" />
          <p className="font-semibold text-foreground">No hay asientos manuales confirmados</p>
          <p className="text-sm text-muted-foreground">Crea asientos de apertura, ajustes, amortizaciones u otros movimientos que no provengan de facturas.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 border-b border-border">
              <tr>
                <th className="w-8" />
                <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground">Fecha</th>
                <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground">Descripción</th>
                <th className="px-4 py-2.5 text-right font-semibold text-muted-foreground">Debe</th>
                <th className="px-4 py-2.5 text-right font-semibold text-muted-foreground">Haber</th>
                <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {entries.map(entry => {
                const lines = allLines.filter(l => l.journalEntryId === entry.id);
                const cfg = STATUS_CFG[entry.status] || STATUS_CFG.borrador;
                const isOpen = expanded === entry.id;
                return (
                  <>
                    <tr key={entry.id} className="hover:bg-muted/20 cursor-pointer" onClick={() => setExpanded(isOpen ? null : entry.id)}>
                      <td className="px-2 py-2.5 text-muted-foreground">
                        {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      </td>
                      <td className="px-4 py-2.5 font-mono">{entry.date}</td>
                      <td className="px-4 py-2.5">{entry.description}</td>
                      <td className="px-4 py-2.5 text-right font-mono">{fmt(entry.totalDebit)}</td>
                      <td className="px-4 py-2.5 text-right font-mono">{fmt(entry.totalCredit)}</td>
                      <td className="px-4 py-2.5">
                        <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full', cfg.color)}>{cfg.label}</span>
                      </td>
                    </tr>
                    {isOpen && lines.map((line, i) => (
                      <tr key={`${entry.id}-l${i}`} className="bg-muted/10">
                        <td />
                        <td colSpan={2} className="px-8 py-1.5 font-mono text-muted-foreground">
                          <span className="font-semibold text-foreground">{line.accountCode}</span> — {line.accountName || line.description}
                        </td>
                        <td className="px-4 py-1.5 text-right font-mono text-muted-foreground">{line.debit > 0 ? fmt(line.debit) : ''}</td>
                        <td className="px-4 py-1.5 text-right font-mono text-muted-foreground">{line.credit > 0 ? fmt(line.credit) : ''}</td>
                        <td />
                      </tr>
                    ))}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showForm && <JournalEntryForm open onClose={() => setShowForm(false)} onSaved={() => { qc.invalidateQueries({ queryKey: ['journal-manuales'] }); setShowForm(false); }} />}
    </div>
  );
}