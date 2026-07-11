import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Search, FileSpreadsheet, BookOpen, Receipt, Scale } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const fmt = (n) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n || 0);

export default function ImpTaxTab({ companyId, ejercicio }) {
  const [subtab, setSubtab] = useState('diario');
  const [search, setSearch] = useState('');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const filter = { companyId, ejercicio: Number(ejercicio) };
    let query;
    if (subtab === 'diario') query = base44.entities.JournalEntry.filter(filter, '-date', 100);
    else if (subtab === 'lineas') query = base44.entities.JournalEntryLine.filter(filter, '-created_date', 200);
    else if (subtab === 'cuentas') query = base44.entities.AccountingAccount.filter(filter, 'code', 200);
    else if (subtab === 'iva') query = base44.entities.VATRecord.filter(filter, '-fecha', 100);
    else if (subtab === 'sumas') query = base44.entities.TrialBalanceLine.filter(filter, 'cuenta', 200);
    else query = Promise.resolve([]);
    query.then(d => { setData(d || []); setLoading(false); }).catch(() => { setLoading(false); setData([]); });
  }, [companyId, ejercicio, subtab]);

  const SUBTABS = [
    { key: 'diario', label: 'Asientos', icon: FileSpreadsheet },
    { key: 'lineas', label: 'Líneas diario', icon: BookOpen },
    { key: 'cuentas', label: 'Plan contable', icon: BookOpen },
    { key: 'iva', label: 'IVA', icon: Receipt },
    { key: 'sumas', label: 'Sumas y saldos', icon: Scale },
  ];

  const filtered = data.filter(d => {
    if (!search) return true;
    const s = search.toLowerCase();
    return JSON.stringify(d).toLowerCase().includes(s);
  });

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        {SUBTABS.map(st => (
          <button key={st.key} onClick={() => setSubtab(st.key)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
              subtab === st.key ? "bg-teal text-white" : "bg-secondary text-muted-foreground hover:bg-secondary/70"
            )}>
            <st.icon className="w-3.5 h-3.5" /> {st.label}
          </button>
        ))}
        <div className="relative flex-1 min-w-40 ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="w-6 h-6 border-2 border-teal border-t-transparent rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center text-sm text-muted-foreground">
          Sin datos para este ejercicio y sección.
        </div>
      ) : subtab === 'diario' ? (
        <DiarioTable rows={filtered} />
      ) : subtab === 'lineas' ? (
        <LineasTable rows={filtered} />
      ) : subtab === 'cuentas' ? (
        <CuentasTable rows={filtered} />
      ) : subtab === 'iva' ? (
        <IvaTable rows={filtered} />
      ) : (
        <SumasTable rows={filtered} />
      )}
    </div>
  );
}

function DiarioTable({ rows }) {
  return (
    <div className="bg-card border border-border rounded-xl shadow-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/30">
              <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Asiento</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Fecha</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground hidden md:table-cell">Clase</th>
              <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Débito</th>
              <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Crédito</th>
              <th className="text-center px-3 py-2 text-xs font-semibold text-muted-foreground">Cuadrado</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground hidden lg:table-cell">Concepto</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r, i) => (
              <tr key={i} className="hover:bg-secondary/20">
                <td className="px-3 py-2 font-medium">{r.entryNumber}</td>
                <td className="px-3 py-2 text-muted-foreground">{r.date}</td>
                <td className="px-3 py-2 text-muted-foreground hidden md:table-cell">{r.claseAsiento}</td>
                <td className="px-3 py-2 text-right">{fmt(r.totalDebit)}</td>
                <td className="px-3 py-2 text-right">{fmt(r.totalCredit)}</td>
                <td className="px-3 py-2 text-center">
                  <span className={cn("text-xs px-1.5 py-0.5 rounded font-medium",
                    r.isBalanced ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700")}>
                    {r.cuadrado || (r.isBalanced ? 'SI' : 'NO')}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground hidden lg:table-cell max-w-xs truncate">{r.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LineasTable({ rows }) {
  return (
    <div className="bg-card border border-border rounded-xl shadow-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/30">
              <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Asiento</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Subcuenta</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground hidden md:table-cell">Nombre</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground hidden lg:table-cell">Concepto</th>
              <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Débito</th>
              <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Crédito</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r, i) => (
              <tr key={i} className="hover:bg-secondary/20">
                <td className="px-3 py-2 text-xs">{r.asientoNumero}</td>
                <td className="px-3 py-2 font-mono text-xs">{r.subcuenta}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground hidden md:table-cell">{r.nombreSubcuenta}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground hidden lg:table-cell max-w-xs truncate">{r.concepto}</td>
                <td className="px-3 py-2 text-right">{r.debit ? fmt(r.debit) : ''}</td>
                <td className="px-3 py-2 text-right">{r.credit ? fmt(r.credit) : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CuentasTable({ rows }) {
  return (
    <div className="bg-card border border-border rounded-xl shadow-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/30">
              <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Código</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Nombre</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground hidden md:table-cell">Grupo</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground hidden lg:table-cell">NIF</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r, i) => (
              <tr key={i} className="hover:bg-secondary/20">
                <td className="px-3 py-2 font-mono text-xs">{r.code}</td>
                <td className="px-3 py-2 text-xs">{r.name}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground hidden md:table-cell">{r.grupoNombre}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground hidden lg:table-cell">{r.nif || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function IvaTable({ rows }) {
  return (
    <div className="bg-card border border-border rounded-xl shadow-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/30">
              <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Fecha</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Factura</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground hidden md:table-cell">Subcuenta</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">V/C</th>
              <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Base</th>
              <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">% IVA</th>
              <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Cuota</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r, i) => (
              <tr key={i} className="hover:bg-secondary/20">
                <td className="px-3 py-2 text-xs">{r.fecha}</td>
                <td className="px-3 py-2 text-xs font-medium">{r.factura}</td>
                <td className="px-3 py-2 text-xs font-mono hidden md:table-cell">{r.subcuenta}</td>
                <td className="px-3 py-2 text-xs">{r.venCom}</td>
                <td className="px-3 py-2 text-right">{fmt(r.baseimp)}</td>
                <td className="px-3 py-2 text-right">{r.iva}%</td>
                <td className="px-3 py-2 text-right">{fmt(r.cuota)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SumasTable({ rows }) {
  return (
    <div className="bg-card border border-border rounded-xl shadow-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/30">
              <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Cuenta</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground hidden md:table-cell">Nombre</th>
              <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Saldo Inicial</th>
              <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Debe</th>
              <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Haber</th>
              <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Saldo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r, i) => (
              <tr key={i} className="hover:bg-secondary/20">
                <td className="px-3 py-2 font-mono text-xs">{r.cuenta}</td>
                <td className="px-3 py-2 text-xs hidden md:table-cell">{r.nombre}</td>
                <td className="px-3 py-2 text-right">{fmt(r.saldoInicial)}</td>
                <td className="px-3 py-2 text-right">{fmt(r.debePeriodo)}</td>
                <td className="px-3 py-2 text-right">{fmt(r.haberPeriodo)}</td>
                <td className="px-3 py-2 text-right font-medium">{fmt(r.saldoFirmado)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}