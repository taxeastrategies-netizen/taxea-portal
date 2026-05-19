/**
 * PublicInvoiceViewer — Página pública de factura (sin login)
 * Ruta: /public/invoice/:token
 * No requiere sesión. Solo muestra la factura del token.
 */
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Download, Printer, AlertTriangle, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const LOGO = 'https://media.base44.com/images/public/6a00fec50cc522a74ddde4b2/3ded74681_ChatGPTImage7may202610_56_53pm.png';

const fmt = (n) =>
  typeof n === 'number' ? n.toLocaleString('es-ES', { minimumFractionDigits: 2 }) + ' €' : '—';
const fmtDate = (d) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }); }
  catch { return d; }
};

// ── Render visual de la factura (sin iframe) ──────────────────────────────────
function InvoicePublicRender({ invoice, company }) {
  const brandColor = '#b91c1c';
  const LOGO_URL = 'https://media.base44.com/images/public/6a00fec50cc522a74ddde4b2/3ded74681_ChatGPTImage7may202610_56_53pm.png';
  const lineas = invoice?.lineas || [];

  return (
    <div className="p-8 font-sans text-sm text-slate-800" style={{ minHeight: '900px' }}>
      {/* Cabecera */}
      <div className="flex items-start justify-between mb-8">
        <div>
          {company?.logo_url
            ? <img src={company.logo_url} alt={company.nombre} className="h-10 object-contain mb-2" />
            : <img src={LOGO_URL} alt="Taxea Strategies" className="h-8 object-contain mb-2" />
          }
          <div className="text-xs text-slate-500 leading-relaxed mt-1 space-y-0.5">
            <p className="font-semibold text-slate-800">{company?.nombre || company?.razon_social || 'Emisor'}</p>
            {company?.nif && <p>NIF: {company.nif}</p>}
            {company?.direccion_fiscal && <p>{company.direccion_fiscal}</p>}
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold mb-1" style={{ color: brandColor }}>FACTURA</div>
          <div className="text-lg font-semibold text-slate-700">{invoice.numero_factura}</div>
          <div className="text-xs text-slate-500 mt-1.5 space-y-0.5">
            <p>Fecha: <span className="font-medium text-slate-700">{fmtDate(invoice.fecha_emision)}</span></p>
            {invoice.fecha_vencimiento && <p>Vencimiento: <span className="font-medium text-slate-700">{fmtDate(invoice.fecha_vencimiento)}</span></p>}
          </div>
        </div>
      </div>

      {/* Emisor / Receptor */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        <div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Emisor</div>
          <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-700 space-y-0.5">
            <p className="font-semibold">{company?.nombre || '—'}</p>
            {company?.nif && <p>NIF: {company.nif}</p>}
            {company?.direccion_fiscal && <p>{company.direccion_fiscal}</p>}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Destinatario</div>
          <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-700 space-y-0.5">
            <p className="font-semibold">{invoice.cliente_nombre || '—'}</p>
            {invoice.cliente_nif && <p>NIF/CIF: {invoice.cliente_nif}</p>}
          </div>
        </div>
      </div>

      {/* Concepto */}
      {invoice.concepto && (
        <div className="mb-5">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Concepto</div>
          <p className="text-sm text-slate-700">{invoice.concepto}</p>
        </div>
      )}

      {/* Líneas */}
      <table className="w-full text-xs mb-5 border-collapse">
        <thead>
          <tr style={{ backgroundColor: brandColor }} className="text-white">
            <th className="text-left px-3 py-2 font-semibold">Descripción</th>
            <th className="text-center px-3 py-2 font-semibold w-14">Cant.</th>
            <th className="text-right px-3 py-2 font-semibold w-20">Precio u.</th>
            <th className="text-right px-3 py-2 font-semibold w-18">Importe</th>
          </tr>
        </thead>
        <tbody>
          {lineas.length > 0 ? lineas.map((l, i) => (
            <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
              <td className="px-3 py-2 border-b border-slate-100">{l.descripcion || l.concepto || '—'}</td>
              <td className="px-3 py-2 text-center border-b border-slate-100">{l.cantidad || 1}</td>
              <td className="px-3 py-2 text-right border-b border-slate-100">{fmt(l.precio_unitario || l.precio)}</td>
              <td className="px-3 py-2 text-right font-medium border-b border-slate-100">{fmt(l.importe || (l.cantidad * l.precio_unitario))}</td>
            </tr>
          )) : (
            <tr className="bg-white">
              <td className="px-3 py-2 border-b border-slate-100">{invoice.concepto || 'Servicio profesional'}</td>
              <td className="px-3 py-2 text-center border-b border-slate-100">1</td>
              <td className="px-3 py-2 text-right border-b border-slate-100">{fmt(invoice.base_imponible)}</td>
              <td className="px-3 py-2 text-right font-medium border-b border-slate-100">{fmt(invoice.base_imponible)}</td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Totales */}
      <div className="flex justify-end mb-6">
        <div className="w-56">
          <div className="flex justify-between py-1.5 text-xs border-b border-slate-100">
            <span className="text-slate-500">Base imponible</span>
            <span className="font-medium">{fmt(invoice.base_imponible)}</span>
          </div>
          <div className="flex justify-between py-1.5 text-xs border-b border-slate-100">
            <span className="text-slate-500">IVA ({invoice.tipo_iva || 21}%)</span>
            <span className="font-medium">{fmt(invoice.cuota_iva)}</span>
          </div>
          {invoice.retencion_irpf > 0 && (
            <div className="flex justify-between py-1.5 text-xs border-b border-slate-100">
              <span className="text-slate-500">Retención IRPF</span>
              <span className="font-medium text-red-600">−{fmt(invoice.retencion_irpf)}</span>
            </div>
          )}
          <div className="flex justify-between py-2 mt-1 rounded-lg px-2" style={{ backgroundColor: `${brandColor}10` }}>
            <span className="font-bold text-slate-800 text-sm">Total</span>
            <span className="font-bold text-sm" style={{ color: brandColor }}>{fmt(invoice.total_factura)}</span>
          </div>
        </div>
      </div>

      {/* Método de pago */}
      {invoice.metodo_pago && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-xs text-slate-700 mb-4">
          <p className="font-semibold text-emerald-800 mb-1.5">Instrucciones de pago</p>
          <p><span className="text-slate-500">Método: </span>{invoice.metodo_pago}</p>
          {invoice.iban_cobro && <p><span className="text-slate-500">IBAN: </span>{invoice.iban_cobro}</p>}
          <p className="text-slate-500 mt-1">Indica el número <strong>{invoice.numero_factura}</strong> como referencia del pago.</p>
        </div>
      )}

      {/* Pie */}
      <div className="border-t border-slate-100 mt-6 pt-4 text-[10px] text-slate-400 text-center">
        Documento gestionado con Taxea Strategies · Portal de gestión financiera y fiscal
      </div>
    </div>
  );
}

export default function PublicInvoiceViewer() {
  const [invoice, setInvoice] = useState(null);
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [token, setToken] = useState('');

  useEffect(() => {
    // Extraer token de la URL: /public/invoice/:token
    const parts = window.location.pathname.split('/');
    const t = parts[parts.length - 1];
    if (!t || t.length < 10) {
      setError('Enlace inválido o caducado.');
      setLoading(false);
      return;
    }
    setToken(t);
    loadInvoice(t);
  }, []);

  const loadInvoice = async (t) => {
    try {
      // Buscar factura por public_token
      const invoices = await base44.entities.Invoice.filter({ public_token: t });
      if (!invoices || invoices.length === 0) {
        setError('La factura no existe, ha sido desactivada o el enlace ha caducado.');
        setLoading(false);
        return;
      }
      const inv = invoices[0];
      if (inv.public_link_status === 'desactivado') {
        setError('Este enlace ha sido desactivado por el emisor.');
        setLoading(false);
        return;
      }
      setInvoice(inv);

      // Registrar apertura
      base44.entities.InvoiceTimelineEvent.create({
        invoice_id: inv.id,
        company_id: inv.company_id,
        event_type: 'enlace_publico_abierto',
        event_label: 'Factura vista por destinatario',
        event_detail: 'El destinatario ha abierto el enlace público de la factura.',
        created_at: new Date().toISOString(),
        origin: 'cliente',
      }).catch(() => {});

      // Actualizar public_opened_at si no estaba registrado
      if (!inv.public_opened_at) {
        base44.entities.Invoice.update(inv.id, { public_opened_at: new Date().toISOString() }).catch(() => {});
      }

      // Cargar datos del emisor (company) — solo lo necesario, sin datos internos
      if (inv.company_id) {
        const comps = await base44.entities.Company.filter({ id: inv.company_id });
        if (comps?.length > 0) setCompany(comps[0]);
      }
    } catch (e) {
      setError('Error al cargar la factura. Inténtalo de nuevo.');
    }
    setLoading(false);
  };

  const handleDownload = () => {
    if (!invoice?.archivo_url) return;
    const a = document.createElement('a');
    a.href = invoice.archivo_url;
    a.download = `Factura_${invoice.numero_factura || token}.pdf`;
    a.target = '_blank';
    a.click();
    // Registrar descarga
    base44.entities.InvoiceTimelineEvent.create({
      invoice_id: invoice.id,
      company_id: invoice.company_id,
      event_type: 'enlace_publico_descarga',
      event_label: 'PDF descargado por destinatario',
      event_detail: 'El destinatario ha descargado el PDF desde el enlace público.',
      created_at: new Date().toISOString(),
      origin: 'cliente',
    }).catch(() => {});
    if (!invoice.public_downloaded_at) {
      base44.entities.Invoice.update(invoice.id, { public_downloaded_at: new Date().toISOString() }).catch(() => {});
    }
  };

  const isOverdue = invoice?.fecha_vencimiento && new Date(invoice.fecha_vencimiento) < new Date()
    && invoice?.estado_cobro !== 'cobrada';

  // ── ESTADOS ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-slate-500">Cargando documento...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 max-w-md w-full text-center">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
        <h1 className="text-lg font-semibold text-slate-800 mb-2">Documento no disponible</h1>
        <p className="text-sm text-slate-500">{error}</p>
        <div className="mt-6 pt-6 border-t border-slate-100">
          <img src={LOGO} alt="Taxea Strategies" className="h-7 mx-auto opacity-50" />
          <p className="text-xs text-slate-400 mt-2">Taxea Strategies</p>
        </div>
      </div>
    </div>
  );

  if (!invoice) return null;

  const paymentStatusCfg = {
    pendiente: { label: 'Pendiente de pago', color: 'bg-amber-100 text-amber-700 border-amber-200' },
    cobrada:   { label: 'Pagada', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    vencida:   { label: 'Vencida', color: 'bg-red-100 text-red-700 border-red-200' },
  };
  const ps = paymentStatusCfg[invoice.estado_cobro] || paymentStatusCfg.pendiente;

  return (
    <>
      {/* Meta noindex para no indexar */}
      {typeof document !== 'undefined' && (() => {
        const meta = document.querySelector('meta[name="robots"]') || document.createElement('meta');
        meta.setAttribute('name', 'robots');
        meta.setAttribute('content', 'noindex, nofollow');
        if (!document.querySelector('meta[name="robots"]')) document.head.appendChild(meta);
        return null;
      })()}

      <div className="min-h-screen bg-slate-100">
        {/* ── Barra superior ──────────────────────────────────────── */}
        <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <img src={LOGO} alt="Taxea Strategies" className="h-7 object-contain flex-shrink-0" />
              <div className="h-4 w-px bg-slate-200" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">Factura {invoice.numero_factura}</p>
                <p className="text-xs text-slate-400 truncate">{invoice.cliente_nombre}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {invoice.archivo_url && (
                <Button onClick={handleDownload} variant="outline" size="sm" className="gap-2 h-8 text-xs">
                  <Download className="w-3.5 h-3.5" /> Descargar PDF
                </Button>
              )}
              <Button onClick={() => window.print()} variant="ghost" size="sm" className="gap-2 h-8 text-xs">
                <Printer className="w-3.5 h-3.5" /> Imprimir
              </Button>
            </div>
          </div>
        </div>

        {/* ── Contenido ──────────────────────────────────────────── */}
        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

            {/* ── Visor de factura — render HTML propio, sin iframe oscuro ── */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <InvoicePublicRender invoice={invoice} company={company} />
              </div>
              {invoice.archivo_url && (
                <button onClick={handleDownload}
                  className="w-full mt-3 flex items-center justify-center gap-2 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                  <Download className="w-4 h-4" /> Descargar PDF
                </button>
              )}
            </div>

            {/* ── Panel de detalles ──────────────────────────────── */}
            <div className="space-y-4">
              {/* Estado */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Estado</p>
                  <span className={`text-xs px-2.5 py-1 rounded-full border font-semibold ${ps.color}`}>{ps.label}</span>
                </div>
                <div className="text-3xl font-bold text-slate-900">{fmt(invoice.total_factura)}</div>
                {isOverdue && (
                  <div className="flex items-center gap-1.5 mt-2 text-xs text-red-600 font-medium">
                    <AlertTriangle className="w-3.5 h-3.5" /> Vencida el {fmtDate(invoice.fecha_vencimiento)}
                  </div>
                )}
              </div>

              {/* Detalle factura */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Datos del documento</p>
                {[
                  { label: 'Nº Factura', value: invoice.numero_factura, mono: true },
                  { label: 'Fecha emisión', value: fmtDate(invoice.fecha_emision) },
                  { label: 'Vencimiento', value: fmtDate(invoice.fecha_vencimiento), warn: isOverdue },
                  { label: 'Concepto', value: invoice.concepto },
                ].filter(r => r.value && r.value !== '—').map((r, i) => (
                  <div key={i} className="flex justify-between gap-2">
                    <span className="text-xs text-slate-400">{r.label}</span>
                    <span className={`text-xs text-right font-medium ${r.mono ? 'font-mono' : ''} ${r.warn ? 'text-red-600 font-semibold' : 'text-slate-800'}`}>{r.value}</span>
                  </div>
                ))}
              </div>

              {/* Emisor */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-2">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" /> Emisor
                </p>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{company?.nombre || company?.razon_social || '—'}</p>
                  {company?.nif && <p className="text-xs text-slate-500 mt-0.5">NIF/CIF: {company.nif}</p>}
                  {company?.direccion_fiscal && <p className="text-xs text-slate-500 mt-0.5">{company.direccion_fiscal}</p>}
                  {company?.email_contacto && <p className="text-xs text-slate-500 mt-0.5">{company.email_contacto}</p>}
                </div>
              </div>

              {/* Receptor */}
              {invoice.cliente_nombre && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-2">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Destinatario</p>
                  <p className="text-sm font-semibold text-slate-800">{invoice.cliente_nombre}</p>
                  {invoice.cliente_nif && <p className="text-xs text-slate-500">NIF/CIF: {invoice.cliente_nif}</p>}
                </div>
              )}

              {/* Importes */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Importes</p>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Base imponible</span>
                    <span className="font-medium text-slate-800">{fmt(invoice.base_imponible)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">IVA ({invoice.tipo_iva || 21}%)</span>
                    <span className="font-medium text-slate-800">{fmt(invoice.cuota_iva)}</span>
                  </div>
                  {invoice.retencion_irpf > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Retención IRPF</span>
                      <span className="font-medium text-red-600">−{fmt(invoice.retencion_irpf)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-bold border-t border-slate-100 pt-2 mt-1">
                    <span className="text-slate-800">Total</span>
                    <span className="text-slate-900">{fmt(invoice.total_factura)}</span>
                  </div>
                </div>
              </div>

              {/* Método de pago */}
              {invoice.metodo_pago && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                  <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-2">Método de pago</p>
                  <p className="text-sm font-medium text-slate-800 capitalize">{invoice.metodo_pago}</p>
                  {invoice.iban_cobro && (
                    <p className="text-xs font-mono text-slate-600 mt-1">{invoice.iban_cobro}</p>
                  )}
                </div>
              )}

              {/* Powered by Taxea */}
              <div className="text-center pt-2">
                <img src={LOGO} alt="Taxea Strategies" className="h-6 mx-auto opacity-40 mb-1" />
                <p className="text-[10px] text-slate-400">Documento gestionado con Taxea Strategies</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}