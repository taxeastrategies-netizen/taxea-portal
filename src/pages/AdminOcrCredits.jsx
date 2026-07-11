import { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Lock, RefreshCw, ScanLine, Search } from 'lucide-react';

const PERIOD_TYPES = [
  { value: 'day', label: 'Día' },
  { value: 'month', label: 'Mes' },
  { value: 'quarter', label: 'Trimestre' },
  { value: 'year', label: 'Año' },
  { value: 'all', label: 'Histórico' },
];

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export default function AdminOcrCredits() {
  const { isAdmin } = useOutletContext() || {};
  const [clients, setClients] = useState([]);
  const [usageData, setUsageData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const now = new Date();
  const [periodType, setPeriodType] = useState('quarter');
  const [year, setYear] = useState(String(now.getUTCFullYear()));
  const [month, setMonth] = useState(String(now.getUTCMonth() + 1));
  const [quarter, setQuarter] = useState(String(Math.ceil((now.getUTCMonth() + 1) / 3)));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [clientsRes, usageRes] = await Promise.all([
        base44.entities.ClientAccount.list('-created_date', 500),
        base44.functions.invoke('getOcrUsageByClient', { periodType, year, month, quarter }),
      ]);
      setClients(clientsRes || []);
      setUsageData(usageRes?.data || null);
    } catch (err) {
      console.error('[AdminOcrCredits] Error:', err);
    }
    setLoading(false);
  }, [periodType, year, month, quarter]);

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

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

  const clientCounts = usageData?.clientCounts || {};
  const clientCountsAllTime = usageData?.clientCountsAllTime || {};
  const periodCount = usageData?.totalScans || 0;

  // Build rows: all clients with their scan counts
  const rows = clients.map(c => ({
    id: c.id,
    name: c.displayName || c.legalName || c.email || 'Sin nombre',
    taxId: c.taxId || '—',
    email: c.email || '—',
    clientType: c.clientType || '—',
    scans: clientCounts[c.id] || 0,
    scansAllTime: clientCountsAllTime[c.id] || 0,
  }));

  // Also include unknown clients that have scans but no ClientAccount record
  const knownIds = new Set(clients.map(c => c.id));
  Object.entries(clientCounts).forEach(([cid, count]) => {
    if (!knownIds.has(cid) && cid !== 'unknown') {
      rows.push({
        id: cid,
        name: `Cliente no registrado (${cid.substring(0, 8)})`,
        taxId: '—',
        email: '—',
        clientType: '—',
        scans: count,
        scansAllTime: clientCountsAllTime[cid] || 0,
      });
    }
  });

  // Sort by scans descending
  rows.sort((a, b) => b.scans - a.scans);

  const filtered = rows.filter(r => {
    if (!search) return true;
    const s = search.toLowerCase();
    return r.name.toLowerCase().includes(s) || r.taxId.toLowerCase().includes(s) || r.email.toLowerCase().includes(s);
  });

  const totalScans = rows.reduce((s, r) => s + r.scans, 0);
  const activeClients = rows.filter(r => r.scans > 0).length;

  const yearOptions = [];
  for (let y = now.getUTCFullYear(); y >= 2024; y--) yearOptions.push(String(y));

  return (
    <div>
      <PageHeader
        title="Créditos OCR por cliente"
        subtitle="Escaneos OCR realizados por cada cliente — filtra por día, mes, trimestre o año"
        actions={
          <Button variant="outline" size="sm" onClick={load} className="gap-1">
            <RefreshCw className="w-3.5 h-3.5" /> Actualizar
          </Button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-card border border-border rounded-xl p-4 shadow-card">
          <div className="flex items-center gap-2 mb-1">
            <ScanLine className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground">Escaneos del periodo</span>
          </div>
          <p className="text-2xl font-jakarta font-bold text-primary">{totalScans}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 shadow-card">
          <div className="flex items-center gap-2 mb-1">
            <ScanLine className="w-4 h-4 text-emerald-600" />
            <span className="text-xs text-muted-foreground">Clientes activos</span>
          </div>
          <p className="text-2xl font-jakarta font-bold text-emerald-600">{activeClients}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 shadow-card">
          <div className="flex items-center gap-2 mb-1">
            <ScanLine className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Total clientes</span>
          </div>
          <p className="text-2xl font-jakarta font-bold text-foreground">{rows.length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar cliente, NIF o email..."
            className="h-9 pl-9 pr-3 rounded-md border border-input bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-ring w-64"
          />
        </div>

        <div className="flex items-center gap-1 bg-muted/50 rounded-md p-0.5">
          {PERIOD_TYPES.map(p => (
            <button
              key={p.value}
              onClick={() => setPeriodType(p.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                periodType === p.value ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {periodType === 'day' && (
          <input
            type="date"
            value={`${year}-${month.padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`}
            onChange={e => {
              const [y, m] = e.target.value.split('-');
              setYear(y); setMonth(String(parseInt(m)));
            }}
            className="h-9 px-3 rounded-md border border-input bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        )}

        {periodType === 'month' && (
          <>
            <select value={month} onChange={e => setMonth(e.target.value)}
              className="h-9 px-3 rounded-md border border-input bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-ring">
              {MONTHS.map((m, i) => <option key={i} value={String(i + 1)}>{m}</option>)}
            </select>
            <select value={year} onChange={e => setYear(e.target.value)}
              className="h-9 px-3 rounded-md border border-input bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-ring">
              {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </>
        )}

        {periodType === 'quarter' && (
          <>
            <select value={quarter} onChange={e => setQuarter(e.target.value)}
              className="h-9 px-3 rounded-md border border-input bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-ring">
              <option value="1">T1 (Ene-Mar)</option>
              <option value="2">T2 (Abr-Jun)</option>
              <option value="3">T3 (Jul-Sep)</option>
              <option value="4">T4 (Oct-Dic)</option>
            </select>
            <select value={year} onChange={e => setYear(e.target.value)}
              className="h-9 px-3 rounded-md border border-input bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-ring">
              {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </>
        )}

        {periodType === 'year' && (
          <select value={year} onChange={e => setYear(e.target.value)}
            className="h-9 px-3 rounded-md border border-input bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-ring">
            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground">
          No hay clientes ni escaneos para los filtros seleccionados.
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Cliente</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">NIF/CIF</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Tipo</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">Escaneos (periodo)</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">Escaneos (histórico)</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(row => (
                  <tr key={row.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium">{row.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.taxId}</td>
                    <td className="px-4 py-3 text-muted-foreground capitalize">{row.clientType}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-mono font-semibold ${row.scans > 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                        {row.scans}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-muted-foreground">{row.scansAllTime}</td>
                  </tr>
                ))}
                {/* Summary row */}
                <tr className="bg-muted/30 font-semibold border-t-2 border-border">
                  <td className="px-4 py-3" colSpan={3}>Total</td>
                  <td className="px-4 py-3 text-right font-mono text-primary">{totalScans}</td>
                  <td className="px-4 py-3 text-right font-mono text-muted-foreground">{usageData?.totalScansAllTime || 0}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}