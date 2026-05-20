import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import NoCompanyState from '@/components/ui/NoCompanyState';
import { base44 } from '@/api/base44Client';
import { Plus, Receipt, MoreVertical } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import DocumentWorkspace from '@/components/quotes/DocumentWorkspace';
import DocumentForm from '@/components/quotes/DocumentForm';



export default function Proformas() {
  const { company, user, loadingCompany } = useOutletContext() || {};
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selectedDoc, setSelectedDoc] = useState(null);

  useEffect(() => {
    if (company?.id) { load(); }
    else if (!loadingCompany) { setLoading(false); }
  }, [company?.id, loadingCompany]);

  const load = async () => {
    setLoading(true);
    const data = await base44.entities.Proforma.filter({ company_id: company.id });
    setItems(data || []);
    if (selectedDoc) {
      const updated = (data || []).find(d => d.id === selectedDoc.id);
      if (updated) setSelectedDoc(updated);
    }
    setLoading(false);
  };



  if (loadingCompany && loading) return (
    <div className="p-12 text-center"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" /></div>
  );
  if (!company && !loadingCompany) return <NoCompanyState pageName="Proformas" />;

  // Vista del workspace al seleccionar una proforma
  if (selectedDoc) {
    return (
      <DocumentWorkspace
        doc={selectedDoc}
        docType="proforma"
        company={company}
        user={user}
        onClose={() => setSelectedDoc(null)}
        onEdit={(p) => { setEditing(p); setSelectedDoc(null); setShowForm(true); }}
        onRefresh={load}
      />
    );
  }

  return (
    <div>
      <PageHeader title="Facturas Proforma" subtitle={`${items.length} proformas`}>
        <Button onClick={() => { setEditing(null); setShowForm(true); }} className="bg-teal hover:bg-teal-dark h-9">
          <Plus className="w-4 h-4 mr-1.5" /> Nueva proforma
        </Button>
      </PageHeader>

      <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
        {loading ? <div className="p-12 text-center"><div className="w-6 h-6 border-2 border-teal border-t-transparent rounded-full animate-spin mx-auto" /></div>
        : items.length === 0 ? (
          <div className="p-12 text-center">
            <Receipt className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="text-muted-foreground font-medium">Sin proformas</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Nº Proforma</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Fecha</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Cliente</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Concepto</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Total</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Estado</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map(p => (
                  <tr key={p.id} className="hover:bg-secondary/30 cursor-pointer" onClick={() => setSelectedDoc(p)}>
                    <td className="px-4 py-3 font-medium text-foreground">{p.numero_proforma}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.fecha}</td>
                    <td className="px-4 py-3">{p.cliente_nombre || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell truncate max-w-xs">{p.concepto || '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold">{(p.total || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</td>
                    <td className="px-4 py-3"><StatusBadge status={p.estado} /></td>
                    <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-1.5 rounded hover:bg-secondary text-muted-foreground"><MoreVertical className="w-4 h-4" /></button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setSelectedDoc(p)}>Ver documento</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setEditing(p); setShowForm(true); }}>Editar</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <DocumentForm
        open={showForm}
        onOpenChange={v => { setShowForm(v); if (!v) setEditing(null); }}
        editing={editing}
        docType="proforma"
        company={company}
        user={user}
        onSaved={() => { setEditing(null); load(); }}
      />
    </div>
  );
}