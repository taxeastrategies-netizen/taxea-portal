/**
 * DocumentVisualRender — Plantilla visual para Presupuestos y Proformas
 */
const LOGO = 'https://media.base44.com/images/public/6a00fec50cc522a74ddde4b2/3ded74681_ChatGPTImage7may202610_56_53pm.png';
const brandColor = '#b91c1c';

const fmt = (n) => typeof n === 'number' ? n.toLocaleString('es-ES', { minimumFractionDigits: 2 }) + ' €' : '—';
const fmtDate = (d) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }); }
  catch { return d; }
};

export default function DocumentVisualRender({ doc, company, docType }) {
  const isQuote = docType === 'quote';
  const title = isQuote ? 'PRESUPUESTO' : 'PROFORMA';
  const docNumber = isQuote ? doc?.numero_presupuesto : doc?.numero_proforma;
  const lineas = doc?.conceptos || [];

  const validezDate = isQuote && doc?.validez_dias && doc?.fecha
    ? new Date(new Date(doc.fecha).getTime() + (doc.validez_dias * 24 * 60 * 60 * 1000))
    : null;

  return (
    <div className="p-10 font-sans text-sm text-slate-800" style={{ minHeight: '1000px' }}>
      {/* Cabecera */}
      <div className="flex items-start justify-between mb-10">
        <div>
          {company?.logo_url ? (
            <img src={company.logo_url} alt={company.nombre} className="h-12 object-contain mb-2" />
          ) : (
            <img src={LOGO} alt="Taxea" className="h-8 object-contain mb-2" />
          )}
          <div className="text-xs text-slate-500 leading-relaxed mt-1">
            <p className="font-semibold text-slate-800">{company?.razon_social || company?.nombre_comercial || 'Empresa'}</p>
            {company?.nif_cif && <p>NIF/CIF: {company.nif_cif}</p>}
            {company?.direccion_fiscal && <p>{company.direccion_fiscal}</p>}
            {company?.email && <p>{company.email}</p>}
            {company?.telefono && <p>{company.telefono}</p>}
          </div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold mb-1" style={{ color: brandColor }}>{title}</div>
          <div className="text-lg font-semibold text-slate-700">{docNumber}</div>
          <div className="text-xs text-slate-500 mt-2 space-y-0.5">
            <p>Fecha: <span className="font-medium text-slate-700">{fmtDate(doc?.fecha)}</span></p>
            {isQuote && doc?.validez_dias && (
              <p>Válido hasta: <span className="font-medium text-slate-700">{validezDate ? fmtDate(validezDate.toISOString().split('T')[0]) : `${doc.validez_dias} días`}</span></p>
            )}
          </div>
        </div>
      </div>

      {/* Emisor / Cliente */}
      <div className="grid grid-cols-2 gap-8 mb-8">
        <div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">De</div>
          <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-700 space-y-0.5">
            <p className="font-semibold">{company?.razon_social || company?.nombre_comercial || '—'}</p>
            {company?.nif_cif && <p>NIF/CIF: {company.nif_cif}</p>}
            {company?.direccion_fiscal && <p>{company.direccion_fiscal}</p>}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Para</div>
          <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-700 space-y-0.5">
            <p className="font-semibold">{doc?.cliente_nombre || '—'}</p>
            {doc?.cliente_nif && <p>NIF/CIF: {doc.cliente_nif}</p>}
            {doc?.cliente_direccion && <p>{doc.cliente_direccion}</p>}
          </div>
        </div>
      </div>

      {/* Concepto único (proforma) */}
      {!isQuote && doc?.concepto && (
        <div className="mb-5">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Concepto</div>
          <p className="text-sm text-slate-700">{doc.concepto}</p>
        </div>
      )}

      {/* Líneas */}
      <table className="w-full text-xs mb-6 border-collapse">
        <thead>
          <tr style={{ backgroundColor: brandColor }} className="text-white">
            <th className="text-left px-3 py-2.5 font-semibold rounded-tl">Descripción</th>
            <th className="text-center px-3 py-2.5 font-semibold w-16">Cant.</th>
            <th className="text-right px-3 py-2.5 font-semibold w-24">Precio u.</th>
            <th className="text-right px-3 py-2.5 font-semibold w-20 rounded-tr">Importe</th>
          </tr>
        </thead>
        <tbody>
          {lineas.length > 0 ? lineas.map((l, i) => (
            <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
              <td className="px-3 py-2 border-b border-slate-100">{l.descripcion || '—'}</td>
              <td className="px-3 py-2 text-center border-b border-slate-100">{l.cantidad || 1}</td>
              <td className="px-3 py-2 text-right border-b border-slate-100">{fmt(l.precio_unitario)}</td>
              <td className="px-3 py-2 text-right font-medium border-b border-slate-100">{fmt(l.total || (l.cantidad * l.precio_unitario))}</td>
            </tr>
          )) : (
            <tr className="bg-white">
              <td className="px-3 py-2 border-b border-slate-100">{doc?.concepto || (isQuote ? 'Servicios profesionales' : 'Descripción del servicio')}</td>
              <td className="px-3 py-2 text-center border-b border-slate-100">1</td>
              <td className="px-3 py-2 text-right border-b border-slate-100">{fmt(doc?.base_imponible)}</td>
              <td className="px-3 py-2 text-right font-medium border-b border-slate-100">{fmt(doc?.base_imponible)}</td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Totales */}
      <div className="flex justify-end mb-8">
        <div className="w-64">
          <div className="flex justify-between py-1.5 text-sm border-b border-slate-100">
            <span className="text-slate-500">Base imponible</span>
            <span className="font-medium">{fmt(doc?.base_imponible)}</span>
          </div>
          <div className="flex justify-between py-1.5 text-sm border-b border-slate-100">
            <span className="text-slate-500">IVA ({doc?.tipo_impuesto || 21}%)</span>
            <span className="font-medium">{fmt(doc?.cuota_impuesto || (doc?.base_imponible * (doc?.tipo_impuesto || 21) / 100))}</span>
          </div>
          <div className="flex justify-between py-2 mt-1 rounded-lg px-2" style={{ backgroundColor: `${brandColor}10` }}>
            <span className="font-bold text-slate-800">Total</span>
            <span className="font-bold text-lg" style={{ color: brandColor }}>{fmt(doc?.total)}</span>
          </div>
        </div>
      </div>

      {/* Notas */}
      {doc?.notas && (
        <div className="border-t border-slate-200 pt-4 mb-4">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Notas</div>
          <p className="text-xs text-slate-600">{doc.notas}</p>
        </div>
      )}

      {/* Validez (presupuesto) */}
      {isQuote && doc?.validez_dias && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-slate-700 mb-4">
          <p>Este presupuesto tiene una validez de <strong>{doc.validez_dias} días</strong> desde la fecha de emisión.</p>
        </div>
      )}

      {/* Pie */}
      <div className="border-t border-slate-100 mt-8 pt-4 text-[10px] text-slate-400 text-center">
        Documento generado con Taxea Strategies · Portal de gestión financiera y fiscal
      </div>
    </div>
  );
}