import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Sparkles } from 'lucide-react';

const DEMO_TRANSACTIONS = [
  { concepto: 'TRANSFERENCIA RECIBIDA - CLIENTE MARKETING SL', tipo: 'entrada', importe: 4840.00, categoria_ia: 'ingreso', estado_conciliacion: 'sugerida_ia', confianza_conciliacion: 'alta' },
  { concepto: 'PAGO A PROVEEDOR OFICINAS CANARIAS', tipo: 'salida', importe: 1210.00, categoria_ia: 'gasto', estado_conciliacion: 'sin_conciliar' },
  { concepto: 'HACIENDA TRIBUTARIA IVA T1', tipo: 'salida', importe: 2340.50, categoria_ia: 'impuesto', estado_conciliacion: 'conciliada_auto', confianza_conciliacion: 'alta' },
  { concepto: 'COBRO FACTURA F-2024-018 DESARROLLO WEB', tipo: 'entrada', importe: 3630.00, categoria_ia: 'ingreso', estado_conciliacion: 'sugerida_ia', confianza_conciliacion: 'media' },
  { concepto: 'COMISION MANTENIMIENTO CUENTA', tipo: 'salida', importe: 18.50, categoria_ia: 'comision_bancaria', estado_conciliacion: 'conciliada_auto', confianza_conciliacion: 'alta' },
  { concepto: 'TRANSFERENCIA INTERNA A CUENTA AHORRO', tipo: 'salida', importe: 5000.00, categoria_ia: 'transferencia_interna', estado_conciliacion: 'movimiento_interno' },
  { concepto: 'INGRESO VENTA PROYECTO ECOMMERCE', tipo: 'entrada', importe: 7260.00, categoria_ia: 'ingreso', estado_conciliacion: 'sin_conciliar' },
  { concepto: 'SUSCRIPCION SOFTWARE CONTABILIDAD', tipo: 'salida', importe: 89.00, categoria_ia: 'gasto', estado_conciliacion: 'conciliada_auto', confianza_conciliacion: 'alta' },
  { concepto: 'DEVOLUCION PROVEEDOR MATERIAL OFICINA', tipo: 'entrada', importe: 245.00, categoria_ia: 'devolucion', estado_conciliacion: 'revisar' },
  { concepto: 'PAGO SEGURIDAD SOCIAL AUTONOMO', tipo: 'salida', importe: 366.90, categoria_ia: 'nomina', estado_conciliacion: 'conciliada_manual', confianza_conciliacion: 'alta' },
];

export default function ImportDemoTransactions({ accounts, companyId, onImported }) {
  const [loading, setLoading] = useState(false);

  const handleImport = async () => {
    if (!accounts.length) return;
    setLoading(true);
    const accountId = accounts[0].id;
    const today = new Date();
    const txs = DEMO_TRANSACTIONS.map((t, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - i * 3);
      const dateStr = d.toISOString().split('T')[0];
      return { ...t, company_id: companyId, bank_account_id: accountId, fecha_operacion: dateStr, fecha_valor: dateStr, es_demo: true };
    });
    await base44.entities.BankTransaction.bulkCreate(txs);
    setLoading(false);
    onImported();
  };

  return (
    <button onClick={handleImport} disabled={loading}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-violet-200 text-violet-600 hover:bg-violet-50 disabled:opacity-50 transition-all">
      <Sparkles className="w-3.5 h-3.5" />
      {loading ? 'Importando...' : 'Demo data'}
    </button>
  );
}