/**
 * PublicInvoiceViewer — Página pública de factura (sin login)
 * Ruta: /public/invoice/:token
 * No requiere sesión. Solo muestra la factura del token.
 */
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Download, Printer, FileText, AlertTriangle, ExternalLink, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const LOGO = 'https://media.base44.com/images/public/6a00fec50cc522a74ddde4b2/3ded74681_ChatGPTImage7may202610_56_53pm.png';

const fmt = (n) =>
  typeof n === 'number' ? n.toLocaleString('es-ES', { minimumFractionDigits: 2 }) + ' €' : '—';
const fmtDate = (d) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' }); }
  catch { return d; }
};

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

            {/* ── Visor PDF / placeholder ────────────────────────── */}
            <div className="lg:col-span-2">
              {invoice.archivo_url ? (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden" style={{ minHeight: '700px' }}>
                  <iframe
                    src={`${invoice.archivo_url}#toolbar=1&view=FitH`}
                    className="w-full"
                    style={{ height: '700px' }}
                    title={`Factura ${invoice.numero_factura}`}
                  />
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center" style={{ minHeight: '400px' }}>
                  <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500 font-medium">PDF no disponible</p>
                  <p className="text-sm text-slate-400 mt-1">El emisor no ha adjuntado el PDF a este enlace.</p>
                </div>
              )}
              {/* Descarga bajo el visor en móvil */}
              {invoice.archivo_url && (
                <button onClick={handleDownload}
                  className="w-full mt-3 flex items-center justify-center gap-2 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors lg:hidden">
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