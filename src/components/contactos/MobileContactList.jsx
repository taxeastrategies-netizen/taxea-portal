// Read-only presentation. Selection and actions are owned by Contactos so both
// layouts use the same records, pagination, exports and confirmation handlers.
export default function MobileContactList({ contacts, selected, allSelected, onSelectAll, onSelect, onEdit, describeContact, renderActions }) {
  return <div className="min-w-0 p-3 space-y-3">
    <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
      <span className="taxea-checkbox-target"><input type="checkbox" checked={allSelected} onChange={onSelectAll} aria-label="Seleccionar contactos de esta página" className="h-4 w-4 accent-teal" /></span>
      Seleccionar esta página
    </label>
    <ul aria-label="Contactos" className="space-y-3">
      {contacts.map(contact => {
        const info = describeContact(contact);
        return <li key={contact.id} className="min-w-0 rounded-xl border border-border bg-card p-3 text-card-foreground">
          <div className="flex min-w-0 items-start gap-2">
            <label className="taxea-checkbox-target shrink-0"><input type="checkbox" checked={selected.has(contact.id)} onChange={() => onSelect(contact.id)} aria-label={`Seleccionar ${contact.nombre}`} className="h-4 w-4 accent-teal" /></label>
            <button type="button" onClick={() => onEdit(contact)} className="min-h-11 min-w-0 flex-1 text-left rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <span className="block font-semibold break-words [overflow-wrap:anywhere]">{contact.nombre || 'Sin nombre'}</span>
              <span className="block text-xs text-muted-foreground break-words">{info.klass}{contact.persona_contacto ? ` · ${contact.persona_contacto}` : ''}</span>
            </button>
            <div className="shrink-0">{renderActions(contact)}</div>
          </div>
          <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
            <dt className="text-muted-foreground">ID fiscal</dt><dd className="min-w-0 break-words font-mono text-xs">{contact.nif_cif || '—'}</dd>
            <dt className="self-center text-muted-foreground">Email</dt><dd className="min-w-0">{info.email ? <a className="flex min-h-11 items-center break-all text-foreground underline underline-offset-4" href={`mailto:${info.email}`}>{info.email}</a> : '—'}</dd>
            <dt className="self-center text-muted-foreground">Teléfono</dt><dd className="min-w-0">{info.phone ? <a className="flex min-h-11 items-center break-all text-foreground underline underline-offset-4" href={`tel:${info.phone}`}>{info.phone}</a> : '—'}</dd>
            <dt className="text-muted-foreground">Dirección</dt><dd className="min-w-0 break-words [overflow-wrap:anywhere]">{info.address || '—'}</dd>
            <dt className="text-muted-foreground">País</dt><dd className="min-w-0 break-words">{contact.pais || '—'}</dd>
            <dt className="text-muted-foreground">Relación</dt><dd>{info.type}</dd>
            <dt className="text-muted-foreground">Origen</dt><dd>{info.source}</dd>
            <dt className="text-muted-foreground">Actividad</dt><dd>{info.activity}</dd>
          </dl>
        </li>;
      })}
    </ul>
  </div>;
}
