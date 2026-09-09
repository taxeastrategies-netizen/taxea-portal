import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Settings2, Plus, Trash2, Save, Info, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const CATEGORIAS_GASTO = [
  { value: 'ventas_servicios', label: 'Ventas / Servicios prestados' },
  { value: 'compras', label: 'Compras de mercancía' },
  { value: 'suministros', label: 'Suministros' },
  { value: 'alquiler', label: 'Alquiler de local/oficina' },
  { value: 'publicidad', label: 'Publicidad' },
  { value: 'publicidad_marketing', label: 'Publicidad y marketing' },
  { value: 'servicios_profesionales', label: 'Servicios profesionales' },
  { value: 'software', label: 'Software / SaaS' },
  { value: 'transporte', label: 'Transporte y mensajería' },
  { value: 'dietas', label: 'Dietas y manutención' },
  { value: 'gastos_financieros', label: 'Gastos financieros' },
  { value: 'seguros', label: 'Seguros' },
  { value: 'otros', label: 'Otros gastos' },
];

const DEFAULT_MAPPINGS = [
  { categoria: 'ventas_servicios', tipo: 'ingreso', cuenta: '70500000', nombre: 'Prestaciones de servicios' },
  { categoria: 'compras', tipo: 'gasto', cuenta: '60000000', nombre: 'Compras de mercancías' },
  { categoria: 'suministros', tipo: 'gasto', cuenta: '62800000', nombre: 'Suministros' },
  { categoria: 'alquiler', tipo: 'gasto', cuenta: '62100000', nombre: 'Arrendamientos y cánones' },
  { categoria: 'publicidad', tipo: 'gasto', cuenta: '62700000', nombre: 'Publicidad, propaganda y relaciones públicas' },
  { categoria: 'publicidad_marketing', tipo: 'gasto', cuenta: '62700000', nombre: 'Publicidad, propaganda y relaciones públicas' },
  { categoria: 'servicios_profesionales', tipo: 'gasto', cuenta: '62300000', nombre: 'Servicios de profesionales independientes' },
  { categoria: 'software', tipo: 'gasto', cuenta: '62910000', nombre: 'Software y servicios digitales' },
  { categoria: 'transporte', tipo: 'gasto', cuenta: '62400000', nombre: 'Transportes' },
  { categoria: 'dietas', tipo: 'gasto', cuenta: '62920000', nombre: 'Dietas y manutención' },
  { categoria: 'gastos_financieros', tipo: 'gasto', cuenta: '66900000', nombre: 'Otros gastos financieros' },
  { categoria: 'seguros', tipo: 'gasto', cuenta: '62500000', nombre: 'Primas de seguros' },
  { categoria: 'otros', tipo: 'gasto', cuenta: '62900000', nombre: 'Otros servicios' },
];

export default function ConfigContable({ companyId }) {
  const [mappings, setMappings] = useState(DEFAULT_MAPPINGS);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [error, setError] = useState('');
  const [diagnostics, setDiagnostics] = useState(null);
  const [refreshSeq, setRefreshSeq] = useState(0);

  useEffect(() => {
    if (!companyId) return;
    let active = true;
    base44.functions.invoke('accountingOperations', { action: 'get_accounting_configuration', companyId })
      .then(response => {
        if (response?.data?.error || response?.data?.success === false) throw new Error(response.data.error || 'No se pudo analizar la configuración.');
        const record = response?.data?.configuration || null;
        if (!active) return;
        setDiagnostics(response?.data?.diagnostics || null);
        if (!record) return;
        try {
          const parsed = JSON.parse(record.mappingsJson || '[]');
          if (Array.isArray(parsed) && parsed.length) {
            setMappings(parsed.map(item => ({
              ...item,
              cuenta: String(item.cuenta || '').replace(/\D/g, '').padEnd(8, '0').slice(0, 8),
            })));
          }
        } catch {
          setError('La configuración guardada no se pudo leer; se muestran los valores estándar.');
        }
      })
      .catch(() => setError('No se pudo cargar la configuración contable.'))
    return () => { active = false; };
  }, [companyId, refreshSeq]);

  useEffect(() => {
    const refresh = () => setRefreshSeq(value => value + 1);
    window.addEventListener('financials:refresh', refresh);
    return () => window.removeEventListener('financials:refresh', refresh);
  }, []);

  const update = (idx, field, val) => {
    setMappings(prev => prev.map((m, i) => i === idx ? { ...m, [field]: val } : m));
    setSaved(false);
  };
  const remove = (idx) => { setMappings(prev => prev.filter((_, i) => i !== idx)); setSaved(false); };
  const add = () => { setMappings(prev => [...prev, { categoria: 'otros', tipo: 'gasto', cuenta: '', nombre: '' }]); setSaved(false); };
  const save = async () => {
    if (!companyId) { setError('No se ha identificado la empresa activa.'); return; }
    if (mappings.some(item => !/^\d{8}$/.test(item.cuenta))) {
      setError('Todas las cuentas del mapeo deben tener exactamente 8 dígitos.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const response = await base44.functions.invoke('accountingOperations', {
        action: 'save_accounting_configuration',
        companyId,
        mappingsJson: JSON.stringify(mappings),
        accountingModel: 'interno_simplificado',
        baseCurrency: 'EUR',
        unmatchedOutgoingMode: 'revision',
      });
      if (response?.data?.error || response?.data?.success === false) throw new Error(response.data.error || 'No se pudo guardar la configuración.');
      setDiagnostics(response?.data?.diagnostics || null);
      setSaved(true);
    } catch (err) {
      setError(err?.message || 'No se pudo guardar la configuración contable.');
    } finally {
      setSaving(false);
    }
  };

  const initializePlan = async () => {
    if (!companyId) return;
    setInitializing(true);
    setError('');
    try {
      const response = await base44.functions.invoke('accountingOperations', { action: 'seed_pgc', companyId });
      if (response.data?.error) throw new Error(response.data.error);
      setSaved(false);
      setRefreshSeq(value => value + 1);
      setError(response.data?.created
        ? 'Plan completado: ' + response.data.created + ' cuentas nuevas.'
        : 'El plan contable estándar ya estaba completo.');
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'No se pudo completar el plan contable.');
    } finally {
      setInitializing(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings2 className="w-5 h-5 text-primary" />
          <div>
            <p className="font-jakarta font-semibold">Configuración contable</p>
            <p className="text-xs text-muted-foreground">Mapea categorías de factura a cuentas contables del PGC. Estas reglas guían las propuestas de asiento.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={initializePlan} disabled={initializing}>
            <Database className="h-3.5 w-3.5" /> {initializing ? 'Completando…' : 'Completar PGC'}
          </Button>
          <Button size="sm" className="gap-1.5 h-8" onClick={save} disabled={saving}>
            <Save className="w-3.5 h-3.5" /> {saving ? 'Guardando...' : saved ? 'Guardado' : 'Guardar cambios'}
          </Button>
        </div>
      </div>

      {diagnostics && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Preparación', `${diagnostics.readinessScore || 0}%`],
            ['Plan contable', `${diagnostics.accounts?.active || 0} cuentas activas`],
            ['Bancos', `${diagnostics.banking?.mapped || 0}/${diagnostics.banking?.active || 0} vinculados`],
            ['Ejercicio actual', diagnostics.periods?.currentYearConfigured ? diagnostics.periods.currentYearStatus : 'sin configurar'],
          ].map(([label, value]) => <div key={label} className="rounded-xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-sm font-semibold">{value}</p></div>)}
          {(diagnostics.accounts?.invalidMappingCodes?.length > 0 || diagnostics.categories?.unmapped?.length > 0 || diagnostics.banking?.orphanLedgerCodes?.length > 0) && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-800 sm:col-span-2 lg:col-span-4">Revisión inteligente: {diagnostics.accounts?.invalidMappingCodes?.length || 0} cuentas de mapeo inválidas, {diagnostics.categories?.unmapped?.length || 0} categorías sin regla y {diagnostics.banking?.orphanLedgerCodes?.length || 0} subcuentas bancarias huérfanas.</div>
          )}
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex items-start gap-2 text-xs text-blue-800">
        <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
        <p>Estas reglas se usan como <strong>propuesta orientativa</strong> al generar asientos desde facturas. El asesor siempre puede modificar las cuentas antes de confirmar el asiento. Si una categoría no tiene mapeo, se marcará como "Cuenta pendiente de asignar".</p>
      </div>

      {/* IVA accounts */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <p className="text-sm font-semibold">Cuentas de IVA / IGIC a 8 dígitos</p>
        <div className="grid grid-cols-2 gap-3 text-xs">
          {[
            { label: 'IVA repercutido (ventas)', cuenta: '47700000' },
            { label: 'IVA soportado deducible (compras)', cuenta: '47200000' },
            { label: 'IGIC repercutido (ventas)', cuenta: '47770000' },
            { label: 'IGIC soportado deducible (compras)', cuenta: '47270000' },
            { label: 'Clientes: cabecera de secuencia', cuenta: '43000000' },
            { label: 'Acreedores: cabecera de secuencia', cuenta: '41000000' },
            { label: 'Retenciones soportadas', cuenta: '47300000' },
            { label: 'Retenciones practicadas', cuenta: '47510000' },
          ].map(item => (
            <div key={item.label} className="flex items-center justify-between border border-border rounded-lg px-3 py-2">
              <span className="text-muted-foreground">{item.label}</span>
              <span className="font-mono font-semibold text-foreground">{item.cuenta}</span>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground italic">Cuentas PGC estándar. Los mapeos personalizados de esta empresa se guardan y se aplican en sus propuestas de asiento.</p>
      </div>

      {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}

      {/* Category mappings */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <p className="text-sm font-semibold">Mapeo categoría → cuenta contable</p>
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={add}>
            <Plus className="w-3 h-3" /> Añadir regla
          </Button>
        </div>
        <table className="w-full text-xs">
          <thead className="bg-muted/40">
            <tr>
              <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground">Categoría de factura</th>
              <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground">Tipo</th>
              <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground">Cuenta contable</th>
              <th className="px-4 py-2.5 text-left font-semibold text-muted-foreground">Nombre cuenta</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {mappings.map((m, idx) => (
              <tr key={idx} className="hover:bg-muted/20">
                <td className="px-3 py-1.5">
                  <Select value={m.categoria} onValueChange={v => update(idx, 'categoria', v)}>
                    <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIAS_GASTO.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-3 py-1.5">
                  <Select value={m.tipo} onValueChange={v => update(idx, 'tipo', v)}>
                    <SelectTrigger className="h-7 w-24 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ingreso">Ingreso</SelectItem>
                      <SelectItem value="gasto">Gasto</SelectItem>
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-3 py-1.5">
                  <Input value={m.cuenta} onChange={e => update(idx, 'cuenta', e.target.value.replace(/\D/g, '').slice(0, 8))} className="h-7 w-28 font-mono text-xs" placeholder="00000000" inputMode="numeric" maxLength={8} />
                </td>
                <td className="px-3 py-1.5">
                  <Input value={m.nombre} onChange={e => update(idx, 'nombre', e.target.value)} className="h-7 text-xs" placeholder="Nombre de la cuenta..." />
                </td>
                <td className="px-2">
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-muted-foreground hover:text-red-500" onClick={() => remove(idx)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}