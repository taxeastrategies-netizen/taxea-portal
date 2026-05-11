import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import NoCompanyState from '@/components/ui/NoCompanyState';
import { base44 } from '@/api/base44Client';
import { BookOpen, Download, Filter } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function LibroRegistros() {
  const { company, isAdmin } = useOutletContext() || {};
  const [invoices, setInvoices] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('emitidas');
  const [filterTrimestre, setFilterTrimestre] = useState('all');
  const [filterAnio, setFilterAnio] = useState(new Date().getFullYear().toString());

  useEffect(() => { if (company?.id) load(); }, [company?.id, filterAnio]);

  const load = async () => {
    setLoading(true);
    const [inv, exp] = await Promise.all([
      base44.entities.Invoice.filter({ company_id: company.id, anio: parseInt(filterAnio) }),
      base44.entities.Expense.filter({ company_id: company.id, anio: parseInt(filterAnio) }),
    ]);
    setInvoices(inv || []);
    setExpenses(exp || []);
    setLoading(false);
  };

  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear - 1, currentYear - 2].map(String);

  const filteredInvoices = invoices.filter(i => {
    const matchT = filterTrimestre === 'all' || i.trimestre === filterTrimestre;
    const matchTipo = activeTab === 'emitidas' ? i.tipo === 'emitida' : i.tipo === 'recibida';
    return matchT && matchTipo;
  });

  const filteredExpenses = expenses.filter(e => filterTrimestre === 'all' || e.trimestre === filterTrimestre);

  const totalBase = filteredInvoices.reduce((s, i) => s + (i.base_imponible || 0), 0);
  const totalCuota = filteredInvoices.reduce((s, i) => s + (i.cuota_iva || 0), 0);
  const totalTotal = filteredInvoices.reduce((s, i) => s + (i.total_factura || 0), 0);

  const tabs = [
    { key: 'emitidas', label: 'Facturas Emitidas' },
    { key: 'recibidas', label: 'Facturas Recibidas' },
    { key: 'gastos', label: 'Gastos' },
  ];

  const activeData = activeTab === 'gastos' ? filteredExpenses : filteredInvoices;

  return (
    <div>
      <PageHeader title="Libro de Registros" subtitle="Registro contable oficial de facturas y gastos">
        <div className="flex items-center gap-2">
          <Select value={filterAnio} onValueChange={setFilterAnio}>
            <SelectTrigger className="w-28 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>{years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={filterTrimestre} onValueChange={setFilterTrimestre}>
            <SelectTrigger className="w-28 h-9"><SelectValue placeholder="Trimestre" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="T1">T1</SelectItem>
              <SelectItem value="T2">T2</SelectItem>
              <SelectItem value="T3">T3</SelectItem>
              <SelectItem value="T4">T4</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </PageHeader>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-secondary rounded-lg w-fit mb-5">
        {tabs.map(t => (
          <button key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === t.key ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Resumen */}
      {activeTab !== 'gastos' && (
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Total Base</p>
            <p className="text-lg font-jakarta font-bold text-foreground">{totalBase.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Total IVA/IGIC</p>
            <p className="text-lg font-jakarta font-bold text-teal">{totalCuota.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Total Facturas</p>
            <p className="text-lg font-jakarta font-bold text-foreground">{totalTotal.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</p>
          </div>
        </div>
      )}

      <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center"><div className="w-6 h-6 border-2 border-teal border-t-transparent rounded-full animate-spin mx-auto" /></div>
        ) : activeData.length === 0 ? (
          <div className="p-12 text-center">
            <BookOpen className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="text-muted-foreground font-medium">Sin registros para este período</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="text-left px-3 py-3 font-medium text-muted-foreground text-xs">Fecha</th>
                  {activeTab !== 'gastos' && <th className="text-left px-3 py-3 font-medium text-muted-foreground text-xs">Nº Factura</th>}
                  <th className="text-left px-3 py-3 font-medium text-muted-foreground text-xs">Cliente/Proveedor</th>
                  <th className="text-left px-3 py-3 font-medium text-muted-foreground text-xs hidden md:table-cell">Concepto</th>
                  <th className="text-right px-3 py-3 font-medium text-muted-foreground text-xs">Base</th>
                  <th className="text-right px-3 py-3 font-medium text-muted-foreground text-xs hidden lg:table-cell">Tipo</th>
                  <th className="text-right px-3 py-3 font-medium text-muted-foreground text-xs hidden lg:table-cell">Cuota</th>
                  <th className="text-right px-3 py-3 font-medium text-muted-foreground text-xs">Total</th>
                  <th className="text-left px-3 py-3 font-medium text-muted-foreground text-xs">T</th>
                  <th className="text-left px-3 py-3 font-medium text-muted-foreground text-xs">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {activeData.map(item => (
                  <tr key={item.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-3 py-2.5 text-muted-foreground">{item.fecha_emision || item.fecha}</td>
                    {activeTab !== 'gastos' && <td className="px-3 py-2.5 font-medium text-foreground">{item.numero_factura || '—'}</td>}
                    <td className="px-3 py-2.5 text-foreground">{item.cliente_nombre || item.proveedor_cliente || '—'}</td>
                    <td className="px-3 py-2.5 text-muted-foreground hidden md:table-cell max-w-xs truncate">{item.concepto || '—'}</td>
                    <td className="px-3 py-2.5 text-right">{(item.base_imponible || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</td>
                    <td className="px-3 py-2.5 text-right text-muted-foreground hidden lg:table-cell">{item.tipo_iva || item.tipo_impuesto || 0}%</td>
                    <td className="px-3 py-2.5 text-right text-muted-foreground hidden lg:table-cell">{(item.cuota_iva || item.cuota_impuesto || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</td>
                    <td className="px-3 py-2.5 text-right font-semibold">{(item.total_factura || item.total || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs font-medium text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">{item.trimestre}</span>
                    </td>
                    <td className="px-3 py-2.5"><StatusBadge status={item.estado_contable || item.estado} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}