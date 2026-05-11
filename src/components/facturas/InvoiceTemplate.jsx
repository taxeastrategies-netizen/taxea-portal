// InvoiceTemplate — plantilla premium Taxea Portal
// Inspirada en la factura real F260009 de Taxea Strategies

function fmt(n) {
  return (parseFloat(n) || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function initials(name) {
  if (!name) return '?';
  return name.split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase()).join('');
}

const TAXEA_RED = '#8B1A2C';
const TAXEA_RED_LIGHT = '#f5e8ea';

export default function InvoiceTemplate({ invoice, company }) {
  const taxType = company?.tipo_impuesto === 'igic' ? 'IGIC' : 'IVA';
  const hasRetention = (parseFloat(invoice?.retencion_irpf) || 0) > 0;
  const base = parseFloat(invoice?.base_imponible) || 0;
  const cuota = parseFloat(invoice?.cuota_iva) || (base * (parseFloat(invoice?.tipo_iva) || 0) / 100);
  const retencionPct = parseFloat(invoice?.retencion_irpf) || 0;
  const retencionImporte = base * retencionPct / 100;
  const total = parseFloat(invoice?.total_factura) || (base + cuota - retencionImporte);

  const s = {
    page: {
      background: '#fff',
      color: '#1a1a1a',
      fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
      fontSize: 13,
      lineHeight: 1.5,
      padding: '48px 56px',
      maxWidth: 860,
      margin: '0 auto',
    },
    // ── CABECERA ──
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 32,
      gap: 24,
    },
    logoArea: { display: 'flex', alignItems: 'flex-start', gap: 16 },
    logoImg: { height: 64, maxWidth: 150, objectFit: 'contain' },
    logoInitials: {
      width: 56, height: 56, borderRadius: 10,
      background: TAXEA_RED, color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 19, fontWeight: 800, flexShrink: 0, letterSpacing: 1,
    },
    emisorInfo: { display: 'flex', flexDirection: 'column', gap: 1 },
    emisorName: { fontSize: 14, fontWeight: 700, color: '#111', marginBottom: 2 },
    emisorMeta: { fontSize: 11.5, color: '#555', lineHeight: 1.7 },
    // derecha
    invoiceTitle: { textAlign: 'right', flexShrink: 0 },
    invoiceLabel: { fontSize: 11, fontWeight: 700, color: '#888', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 },
    invoiceNumber: { fontSize: 22, fontWeight: 800, color: TAXEA_RED, letterSpacing: '-0.5px' },
    invoiceMeta: { fontSize: 11.5, color: '#555', marginTop: 8, lineHeight: 1.9 },
    divider: { borderTop: `2px solid ${TAXEA_RED}`, margin: '0 0 28px 0' },
    dividerLight: { borderTop: '1px solid #e8e8e8', margin: '20px 0' },
    // ── BLOQUE INFO ──
    infoRow: { display: 'flex', gap: 24, marginBottom: 28, alignItems: 'flex-start' },
    infoBox: {
      flex: 1, background: '#fafafa',
      borderRadius: 8, padding: '16px 18px',
      border: '1px solid #ebebeb',
    },
    infoBoxHighlight: {
      background: TAXEA_RED_LIGHT,
      border: `1px solid ${TAXEA_RED}22`,
    },
    infoBoxLabel: {
      fontSize: 9.5, fontWeight: 700, color: TAXEA_RED,
      textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 8,
    },
    infoBoxName: { fontSize: 13, fontWeight: 700, color: '#111', marginBottom: 3 },
    infoBoxMeta: { fontSize: 11.5, color: '#555', lineHeight: 1.7 },
    // total highlight
    totalHighlight: {
      flex: '0 0 auto', minWidth: 180,
      background: TAXEA_RED, color: '#fff',
      borderRadius: 10, padding: '20px 22px',
      textAlign: 'right',
    },
    totalLabel: { fontSize: 10, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase', opacity: 0.85, marginBottom: 6 },
    totalAmount: { fontSize: 24, fontWeight: 800, letterSpacing: '-0.5px' },
    // ── TABLA ──
    table: { width: '100%', borderCollapse: 'collapse', fontSize: 12.5, marginBottom: 28 },
    thead: { background: '#111', color: '#fff' },
    th: { padding: '10px 14px', textAlign: 'left', fontWeight: 600, fontSize: 11, letterSpacing: 0.3 },
    thRight: { padding: '10px 14px', textAlign: 'right', fontWeight: 600, fontSize: 11, letterSpacing: 0.3 },
    tdConcepto: { padding: '14px 14px', verticalAlign: 'top', borderBottom: '1px solid #efefef' },
    tdRight: { padding: '14px 14px', textAlign: 'right', verticalAlign: 'top', borderBottom: '1px solid #efefef', whiteSpace: 'nowrap' },
    trEven: { background: '#fafafa' },
    conceptoTitle: { fontWeight: 700, color: '#111', marginBottom: 4, fontSize: 13 },
    conceptoDesc: { color: '#555', fontSize: 11.5, lineHeight: 1.6, whiteSpace: 'pre-wrap' },
    // ── TOTALES ──
    totalesSection: { display: 'flex', justifyContent: 'flex-end', marginBottom: 28 },
    totalesBox: {
      minWidth: 300,
      border: '1px solid #ebebeb',
      borderRadius: 8, overflow: 'hidden',
    },
    totalesRow: {
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '9px 18px', borderBottom: '1px solid #efefef', fontSize: 13,
    },
    totalesRowTotal: {
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '13px 18px', background: '#111', color: '#fff',
      fontSize: 15, fontWeight: 800,
    },
    totalesLabel: { color: '#555' },
    totalesValue: { fontWeight: 600, color: '#111' },
    totalesRetValue: { fontWeight: 600, color: '#c00' },
    totalesTotalValue: { color: '#fff', fontWeight: 800 },
    // ── PIE ──
    footer: {
      borderTop: '1px solid #e0e0e0', paddingTop: 20, marginTop: 12,
      display: 'flex', flexDirection: 'column', gap: 10,
    },
    footerPago: {
      background: '#fafafa', borderRadius: 8,
      padding: '14px 18px', border: '1px solid #ebebeb',
    },
    footerPagoLabel: { fontSize: 9.5, fontWeight: 700, color: TAXEA_RED, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 6 },
    footerPagoText: { fontSize: 12, color: '#333', lineHeight: 1.7 },
    footerColetilla: {
      borderLeft: `3px solid ${TAXEA_RED}`, paddingLeft: 14,
      background: '#fdf8f8', borderRadius: '0 6px 6px 0',
      padding: '12px 16px 12px 14px',
    },
    footerColetillaText: { fontSize: 11.5, color: '#555', fontStyle: 'italic', lineHeight: 1.6 },
    footerBrand: { textAlign: 'center', fontSize: 10, color: '#bbb', marginTop: 4 },
  };

  // conceptos — si hay array de líneas, mostrarlos; si no, la factura es de un solo concepto
  const lineas = invoice?.lineas_factura?.length
    ? invoice.lineas_factura
    : [{
        titulo: invoice?.concepto || 'Servicios profesionales',
        descripcion: '',
        precio: base,
        unidades: 1,
        subtotal: base,
        total: base,
      }];

  return (
    <div id="invoice-print-area" style={s.page}>
      {/* ── CABECERA ── */}
      <div style={s.header}>
        {/* Emisor */}
        <div style={s.logoArea}>
          {company?.logo_url ? (
            <img src={company.logo_url} alt="Logo" style={s.logoImg} />
          ) : (
            <div style={s.logoInitials}>
              {initials(company?.nombre_comercial || company?.razon_social)}
            </div>
          )}
          <div style={s.emisorInfo}>
            <div style={s.emisorName}>{company?.nombre_comercial || company?.razon_social || '—'}</div>
            <div style={s.emisorMeta}>
              {company?.nif_cif && <div>{company.nif_cif}</div>}
              {company?.direccion_fiscal && <div>{company.direccion_fiscal}</div>}
              {company?.email && <div>{company.email}</div>}
              {company?.telefono && <div>{company.telefono}</div>}
            </div>
          </div>
        </div>

        {/* Datos factura */}
        <div style={s.invoiceTitle}>
          <div style={s.invoiceLabel}>Factura</div>
          <div style={s.invoiceNumber}>#{invoice?.numero_factura}</div>
          <div style={s.invoiceMeta}>
            <div>Fecha: <strong>{invoice?.fecha_emision}</strong></div>
            {invoice?.fecha_vencimiento && <div>Vencimiento: <strong>{invoice.fecha_vencimiento}</strong></div>}
          </div>
        </div>
      </div>

      <div style={s.divider} />

      {/* ── INFO CLIENTE + TOTAL ── */}
      <div style={s.infoRow}>
        {/* Facturar a */}
        <div style={{ ...s.infoBox, flex: 1 }}>
          <div style={s.infoBoxLabel}>Facturar a</div>
          <div style={s.infoBoxName}>{invoice?.cliente_nombre || '—'}</div>
          <div style={s.infoBoxMeta}>
            {invoice?.cliente_nif && <div>{invoice.cliente_nif}</div>}
            {invoice?.cliente_direccion && <div>{invoice.cliente_direccion}</div>}
            {invoice?.cliente_email && <div>{invoice.cliente_email}</div>}
          </div>
        </div>

        {/* Total destacado */}
        <div style={s.totalHighlight}>
          <div style={s.totalLabel}>Total factura</div>
          <div style={s.totalAmount}>{fmt(total)} €</div>
          {invoice?.fecha_vencimiento && (
            <div style={{ fontSize: 10.5, marginTop: 8, opacity: 0.8 }}>
              Vence: {invoice.fecha_vencimiento}
            </div>
          )}
          {invoice?.forma_pago && (
            <div style={{ fontSize: 10.5, marginTop: 4, opacity: 0.75 }}>
              {invoice.forma_pago}
            </div>
          )}
        </div>
      </div>

      {/* ── TABLA CONCEPTOS ── */}
      <table style={s.table}>
        <thead style={s.thead}>
          <tr>
            <th style={{ ...s.th, width: '45%' }}>Concepto</th>
            <th style={s.thRight}>Precio u.</th>
            <th style={s.thRight}>Uds.</th>
            <th style={s.thRight}>Subtotal</th>
            <th style={s.thRight}>Total</th>
          </tr>
        </thead>
        <tbody>
          {lineas.map((l, i) => (
            <tr key={i} style={i % 2 === 1 ? s.trEven : {}}>
              <td style={s.tdConcepto}>
                <div style={s.conceptoTitle}>{l.titulo || l.concepto || 'Servicio'}</div>
                {l.descripcion && <div style={s.conceptoDesc}>{l.descripcion}</div>}
              </td>
              <td style={s.tdRight}>{fmt(l.precio ?? l.precio_unitario)} €</td>
              <td style={s.tdRight}>{l.unidades ?? 1}</td>
              <td style={s.tdRight}>{fmt(l.subtotal ?? l.precio)} €</td>
              <td style={{ ...s.tdRight, fontWeight: 700, color: '#111' }}>{fmt(l.total ?? l.subtotal ?? l.precio)} €</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── RESUMEN TOTALES ── */}
      <div style={s.totalesSection}>
        <div style={s.totalesBox}>
          <div style={s.totalesRow}>
            <span style={s.totalesLabel}>Base imponible</span>
            <span style={s.totalesValue}>{fmt(base)} €</span>
          </div>
          <div style={s.totalesRow}>
            <span style={s.totalesLabel}>{taxType} {invoice?.tipo_iva ?? 0} %</span>
            <span style={s.totalesValue}>{fmt(cuota)} €</span>
          </div>
          {hasRetention && (
            <div style={s.totalesRow}>
              <span style={s.totalesLabel}>Retención IRPF {retencionPct} %</span>
              <span style={s.totalesRetValue}>-{fmt(retencionImporte)} €</span>
            </div>
          )}
          <div style={s.totalesRowTotal}>
            <span>TOTAL</span>
            <span style={s.totalesTotalValue}>{fmt(total)} €</span>
          </div>
        </div>
      </div>

      {/* ── PIE ── */}
      <div style={s.footer}>
        {/* Forma de pago */}
        {(invoice?.forma_pago || company?.datos_bancarios) && (
          <div style={s.footerPago}>
            <div style={s.footerPagoLabel}>Forma de pago</div>
            <div style={s.footerPagoText}>
              {invoice?.forma_pago && (
                <div>{invoice.forma_pago}{company?.razon_social ? ` a nombre de ${company.razon_social}` : ''}</div>
              )}
              {company?.datos_bancarios && (
                <div style={{ marginTop: 4, whiteSpace: 'pre-line' }}>{company.datos_bancarios}</div>
              )}
            </div>
          </div>
        )}

        {/* Coletilla fiscal */}
        {invoice?.coletilla_fiscal && (
          <div style={s.footerColetilla}>
            <div style={s.footerColetillaText}>"{invoice.coletilla_fiscal}"</div>
          </div>
        )}

        {/* Observaciones */}
        {invoice?.comentarios && (
          <div style={{ ...s.footerPago, borderLeft: '3px solid #ddd' }}>
            <div style={{ ...s.footerPagoLabel, color: '#888' }}>Observaciones</div>
            <div style={{ fontSize: 12, color: '#555', lineHeight: 1.6 }}>{invoice.comentarios}</div>
          </div>
        )}

        <div style={s.footerBrand}>Factura generada mediante Taxea Portal · taxeaportal.es</div>
      </div>
    </div>
  );
}