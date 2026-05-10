import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import {
  TrendingUp, TrendingDown, FileText, Calendar, AlertCircle,
  Clock, CheckCircle, Upload, Euro, BarChart3
} from 'lucide-react';
import StatCard from '@/components/ui/StatCard';
import StatusBadge from '@/components/ui/StatusBadge';
import PageHeader from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, startOfYear } from 'date-fns';
import { es } from 'date-fns/locale';

export default function Dashboard() {
  const { user, company, isAdmin } = useOutletContext() || {};
  const [invoices, setInvoices] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [obligations, setObligations] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [loading, setLoading] = useState(true);

  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear - 1, currentYear - 2].map(String);

  useEffect(() => {
    if (!company?.id) return;
    loadData();
  }, [company?.id, selectedYear]);

  const loadData = async () => {
    setLoading(true);
    const [inv, exp, obl, notif] = await Promise.all([
      base44.entities.Invoice.filter({ company_id: company.id, anio: parseInt(selectedYear) }),
      base44.entities.Expense.filter({ company_id: company.id, anio: parseInt(selectedYear) }),
      base44.entities.TaxObligation.filter({ company_id: company.id }),
      base44.entities.Notification.filter({ destinatario_email: user?.email, leida: false }),
    ]);
    setInvoices(inv || []);
    setExpenses(exp || []);
    setObligations(obl || []);
    setNotifications(notif || []);
    setLoading(false);
  };

  const totalIngresos = invoices.filter(i => i.tipo === 'emitida').reduce((s, i) => s + (i.total_factura || 0), 0);
  const totalGastos = expenses.filter(e => e.tipo === 'gasto').reduce((s, e) => s + (e.total || 0), 0);
  const resultado = totalIngresos - totalGastos;
  const ivaRepercutido = invoices.filter(i => i.tipo === 'emitida').reduce((s, i) => s + (i.cuota_iva || 0), 0);
  const ivaSoportado = invoices.filter(i => i.tipo === 'recibida').reduce((s, i) => s + (i.cuota_iva || 0), 0);
  const facturasPendientes = invoices.filter(i => i.estado_contable === 'pendiente').length;
  const obligacionesProximas = obligations.filter(o =>
    ['pendiente_documentacion', 'en_preparacion'].includes(o.estado)
  ).length;

  const recentActivity = [...invoices.slice(-3), ...expenses.slice(-3)]
    .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
    .slice(0, 5);

  return (
    <div>
      <PageHeader
        title={isAdmin ? 'Panel de Administración' : `Bienvenido, ${user?.full_name?.split(' ')[0] || 'Cliente'}`}
        subtitle={company?.razon_social || 'Selecciona una empresa para comenzar'}
      >
        <Select value={selectedYear} onValueChange={setSelectedYear}>
          <SelectTrigger className="w-32 h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
      </PageHeader>

      {/* Avisos del asesor */}
      {notifications.length > 0 && (
        <div className="mb-6 space-y-2">
          {notifications.map(n => (
            <div key={n.id} className="flex items-start gap-3 bg-teal/5 border border-teal/20 rounded-xl p-4">
              <AlertCircle className="w-4 h-4 text-teal mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">{n.titulo}</p>
                <p className="text-sm text-muted-foreground">{n.mensaje}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Total Ingresos"
          value={totalIngresos}
          icon={TrendingUp}
          colorClass="text-teal"
          bgClass="bg-teal-light"
        />
        <StatCard
          title="Total Gastos"
          value={totalGastos}
          icon={TrendingDown}
          colorClass="text-orange-600"
          bgClass="bg-orange-50"
        />
        <StatCard
          title="Resultado Estimado"
          value={resultado}
          icon={Euro}
          colorClass={resultado >= 0 ? "text-green-600" : "text-destructive"}
          bgClass={resultado >= 0 ? "bg-green-50" : "bg-red-50"}
        />
        <StatCard
          title="IVA Repercutido"
          value={ivaRepercutido}
          icon={BarChart3}
          colorClass="text-blue-600"
          bgClass="bg-blue-50"
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="IVA Soportado"
          value={ivaSoportado}
          icon={BarChart3}
          colorClass="text-purple-600"
          bgClass="bg-purple-50"
        />
        <StatCard
          title="Estimación IVA"
          value={ivaRepercutido - ivaSoportado}
          icon={Euro}
          colorClass="text-amber-600"
          bgClass="bg-amber-50"
        />
        <StatCard
          title="Facturas Pendientes"
          value={facturasPendientes}
          icon={Clock}
          suffix=""
          colorClass="text-amber-600"
          bgClass="bg-amber-50"
        />
        <StatCard
          title="Obligaciones Próximas"
          value={obligacionesProximas}
          icon={Calendar}
          suffix=""
          colorClass="text-red-600"
          bgClass="bg-red-50"
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Actividad reciente */}
        <div className="bg-card rounded-xl border border-border shadow-card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h3 className="font-jakarta font-600 text-foreground">Últimos movimientos</h3>
            <FileText className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="divide-y divide-border">
            {recentActivity.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                <p className="text-sm text-muted-foreground">No hay movimientos recientes</p>
                <Button size="sm" className="mt-3 bg-teal hover:bg-teal-dark" asChild>
                  <a href="/facturas">Subir primera factura</a>
                </Button>
              </div>
            ) : recentActivity.map((item, i) => (
              <div key={i} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {item.numero_factura || item.concepto || 'Movimiento'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {item.cliente_nombre || item.proveedor_cliente || '—'} · {item.fecha_emision || item.fecha || ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-foreground">
                    {((item.total_factura || item.total) || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                  </p>
                  <StatusBadge status={item.estado_contable || item.estado} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Obligaciones fiscales */}
        <div className="bg-card rounded-xl border border-border shadow-card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h3 className="font-jakarta font-600 text-foreground">Obligaciones Fiscales</h3>
            <Calendar className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="divide-y divide-border">
            {obligations.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Sin obligaciones pendientes</p>
              </div>
            ) : obligations.slice(0, 5).map((obl) => (
              <div key={obl.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground capitalize">
                    {obl.modelo?.replace(/_/g, ' ').replace('modelo ', 'Mod. ') || 'Obligación'}
                  </p>
                  <p className="text-xs text-muted-foreground">{obl.periodo} · Límite: {obl.fecha_limite}</p>
                </div>
                <StatusBadge status={obl.estado} />
              </div>
            ))}
          </div>
          <div className="px-5 py-3 border-t border-border">
            <a href="/obligaciones" className="text-sm text-teal hover:underline font-medium">
              Ver todas las obligaciones →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}