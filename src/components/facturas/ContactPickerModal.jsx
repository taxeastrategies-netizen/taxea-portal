import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, UserCheck } from 'lucide-react';

export default function ContactPickerModal({ open, onOpenChange, companyId, tipo = 'all', onSelect }) {
  const [contacts, setContacts] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !companyId) return;
    setSearch('');
    setLoading(true);
    base44.entities.Contact.filter({ company_id: companyId })
      .then(data => setContacts((data || []).filter(c => c.activo !== false)))
      .finally(() => setLoading(false));
  }, [open, companyId]);

  const filtered = contacts.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !q || c.nombre?.toLowerCase().includes(q) || c.nif_cif?.toLowerCase().includes(q);
    const matchTipo = tipo === 'all' || c.tipo === tipo || c.tipo === 'ambos';
    return matchSearch && matchTipo;
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Seleccionar contacto</DialogTitle>
        </DialogHeader>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar por nombre o NIF..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" autoFocus />
        </div>
        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="py-8 text-center"><div className="w-5 h-5 border-2 border-teal border-t-transparent rounded-full animate-spin mx-auto" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">No hay contactos guardados</p>
          ) : (
            <div className="space-y-1">
              {filtered.map(c => (
                <button
                  key={c.id}
                  onClick={() => { onSelect(c); onOpenChange(false); }}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl hover:bg-secondary/60 transition-colors text-left"
                >
                  <div>
                    <p className="font-medium text-sm text-foreground">{c.nombre}</p>
                    <p className="text-xs text-muted-foreground">{c.nif_cif || '—'}{c.email ? ` · ${c.email}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${c.tipo === 'cliente' ? 'bg-teal-light text-teal' : c.tipo === 'proveedor' ? 'bg-orange-50 text-orange-700' : 'bg-blue-50 text-blue-700'}`}>
                      {c.tipo === 'cliente' ? 'Cliente' : c.tipo === 'proveedor' ? 'Proveedor' : 'Ambos'}
                    </span>
                    <UserCheck className="w-4 h-4 text-teal" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}