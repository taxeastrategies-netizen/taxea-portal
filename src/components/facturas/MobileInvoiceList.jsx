import StatusBadge from '@/components/ui/StatusBadge';

const money = value => (value || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Presentation only: the desktop list and these cards share selection and actions.
export default function MobileInvoiceList({ invoices, selectedIds, allSelected, onSelectAll, onSelect, onOpen, renderActions }) {
  return (
    <div className="min-w-0" data-mobile-invoice-list>
      <label className="flex min-h-11 items-center gap-3 border-b border-border px-4 py-2 text-sm text-muted-foreground">
        <input type="checkbox" className="h-5 w-5 rounded border-border accent-primary" checked={allSelected} onChange={event => onSelectAll(event.target.checked)} />
        Seleccionar todas las facturas filtradas
      </label>
      <ul className="divide-y divide-border" aria-label="Facturas">
        {invoices.map(invoice => (
          <li key={invoice.id} className={`min-w-0 p-4 ${selectedIds.includes(invoice.id) ? 'bg-accent/50' : ''}`}>
            <div className="flex items-start gap-3">
              <label className="taxea-checkbox-target shrink-0">
                <span className="sr-only">Seleccionar factura {invoice.numero_factura || invoice.id}</span>
                <input type="checkbox" className="h-5 w-5 rounded border-border accent-primary" checked={selectedIds.includes(invoice.id)} onChange={event => onSelect(invoice.id, event.target.checked)} />
              </label>
              <button type="button" onClick={() => onOpen(invoice)} className="min-h-11 min-w-0 flex-1 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Abrir factura ${invoice.numero_factura || invoice.id}`}>
                <span className="block break-words text-sm font-semibold text-foreground">{invoice.numero_factura || 'Sin número'}</span>
                <span className="mt-1 block break-words text-sm text-muted-foreground">{invoice.tipo === 'recibida' ? (invoice.proveedor_nombre || invoice.cliente_nombre || '—') : (invoice.cliente_nombre || '—')}</span>
              </button>
            </div>
            <dl className="mt-3 grid min-w-0 grid-cols-2 gap-3 text-sm">
              <div><dt className="text-xs text-muted-foreground">Fecha</dt><dd className="mt-1 break-words text-foreground">{invoice.fecha_emision || '—'}</dd></div>
              <div className="text-right"><dt className="text-xs text-muted-foreground">Total</dt><dd className="mt-1 break-words font-semibold tabular-nums text-foreground">{money(invoice.total_factura)} €</dd></div>
              <div><dt className="text-xs text-muted-foreground">Base</dt><dd className="mt-1 break-words tabular-nums text-foreground">{money(invoice.base_imponible)} €</dd></div>
              <div className="min-w-0 text-right"><dt className="text-xs text-muted-foreground">{invoice.tipo === 'recibida' ? 'Pago' : 'Cobro'}</dt><dd className="mt-1"><StatusBadge status={invoice.estado_cobro} /></dd></div>
            </dl>
            {invoice.concepto && <p className="mt-3 break-words text-sm text-muted-foreground">{invoice.concepto}</p>}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2">
              <div className="flex flex-wrap gap-2"><StatusBadge status={invoice.estado_contable} />{invoice.anulada && <span className="rounded-md border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">ANULADA</span>}</div>
              {renderActions(invoice)}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
