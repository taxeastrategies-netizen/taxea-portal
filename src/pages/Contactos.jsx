import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import NoCompanyState from '@/components/ui/NoCompanyState';
import { base44 } from '@/api/base44Client';
import {
  ArrowDownAZ,
  ArrowUpAZ,
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Mail,
  MoreHorizontal,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Trash2,
  UserRound,
  Users,
} from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';

const PAGE_SIZE_OPTIONS = [25, 50, 100];
const AVATAR_COLORS = [
  'bg-teal-100 text-teal-800',
  'bg-blue-100 text-blue-800',
  'bg-violet-100 text-violet-800',
  'bg-amber-100 text-amber-800',
  'bg-rose-100 text-rose-800',
  'bg-emerald-100 text-emerald-800',
];

const EMPTY = {
  nombre: '',
  nif_cif: '',
  tipo: 'cliente',
  clase_contacto: 'empresa',
  email: '',
  telefono: '',
  direccion_fiscal: '',
  codigo_postal: '',
  ciudad: '',
  provincia: '',
  pais: 'España',
  organismo_publico: false,
  persona_contacto: '',
  notas: '',
};

const text = (value) => String(value || '').trim();
const normalized = (value) => text(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const taxKey = (value) => text(value).replace(/[^A-Za-z0-9]/g, '').toUpperCase();

function contactClass(contact) {
  if (contact.clase_contacto === 'empresa' || contact.clase_contacto === 'persona') return contact.clase_contacto;
  const localTaxId = taxKey(contact.nif_cif).replace(/^[A-Z]{2}(?=[A-Z0-9]{8,})/, '');
  const looksLikeCompanyTaxId = /^[ABCDEFGHJNPQRSUVW]/.test(localTaxId);
  const looksLikeCompanyName = /\b(s\.?l\.?u?|s\.?a\.?u?|s\.?c\.?p\.?|c\.?b\.?|coop(?:erativa)?|asociacion|fundacion|sociedad|comunidad de bienes)\b/i.test(normalized(contact.nombre));
  return looksLikeCompanyTaxId || looksLikeCompanyName ? 'empresa' : 'persona';
}

function initials(name) {
  const parts = text(name).split(/\s+/).filter(Boolean);
  if (!parts.length) return '—';
  return (parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function avatarColor(name) {
  const score = [...text(name)].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return AVATAR_COLORS[score % AVATAR_COLORS.length];
}

function firstEmail(contact) {
  return text(contact.email) || text(contact.emails?.[0]);
}

function firstPhone(contact) {
  return text(contact.telefono) || text(contact.telefonos?.[0]);
}

function fullAddress(contact) {
  return [contact.direccion_fiscal, contact.codigo_postal, contact.ciudad, contact.provincia].map(text).filter(Boolean).join(', ');
}

function lastActivity(contact) {
  return contact.ultima_deteccion_at || contact.updated_date || contact.created_date || '';
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

function csvCell(value) {
  let safe = String(value ?? '').replace(/"/g, '""');
  if (/^[=+\-@]/.test(safe)) safe = `'${safe}`;
  return `"${safe}"`;
}

function typeLabel(type) {
  if (type === 'proveedor') return 'Proveedor';
  if (type === 'ambos') return 'Cliente y proveedor';
  return 'Cliente';
}

function sourceLabel(contact) {
  const sources = contact.fuentes || [];
  if (sources.some((source) => String(source).includes('ocr'))) return 'OCR';
  if (sources.length || contact.origen_automatico) return 'Factura';
  return 'Manual';
}

export default function Contactos() {
  const { company, loadingCompany } = useOutletContext() || {};
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const [filterClass, setFilterClass] = useState('all');
  const [filterTipo, setFilterTipo] = useState('all');
  const [sortBy, setSortBy] = useState('az');
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (company?.id) syncFromInvoices();
    else if (!loadingCompany) setLoading(false);
  }, [company?.id, loadingCompany]);

  useEffect(() => {
    setPage(1);
    setSelected(new Set());
  }, [search, filterClass, filterTipo, sortBy, pageSize]);

  const load = async () => {
    if (!company?.id) return;
    setLoading(true);
    setError('');
    try {
      const res = await base44.functions.invoke('getCompanyContacts', { companyId: company.id });
      const data = res?.data?.contacts || [];
      setContacts(data.filter((contact) => contact.activo !== false && !contact.merged_into_contact_id));
    } catch (loadError) {
      console.error('[Contactos] Load failed:', loadError);
      setError('No se pudieron cargar los contactos. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const syncFromInvoices = async () => {
    if (!company?.id) return;
    setSyncing(true);
    setError('');
    try {
      await base44.functions.invoke('syncInvoiceContacts', {
        action: 'sync_company',
        companyId: company.id,
      });
    } catch (syncError) {
      console.error('[Contactos] Automatic sync failed:', syncError);
      setError('Los contactos existentes se han cargado, pero la actualización automática no ha podido completarse.');
    } finally {
      setSyncing(false);
      await load();
    }
  };

  const counts = useMemo(() => contacts.reduce((result, contact) => {
    result.total += 1;
    result[contactClass(contact)] += 1;
    return result;
  }, { total: 0, empresa: 0, persona: 0 }), [contacts]);

  const filtered = useMemo(() => {
    const query = normalized(search);
    const result = contacts.filter((contact) => {
      const searchable = [
        contact.nombre,
        contact.razon_social,
        contact.nif_cif,
        contact.email,
        ...(contact.emails || []),
        contact.telefono,
        ...(contact.telefonos || []),
        contact.direccion_fiscal,
        contact.codigo_postal,
        contact.ciudad,
        contact.provincia,
        contact.pais,
        contact.persona_contacto,
      ].map(normalized).join(' ');
      const matchesSearch = !query || searchable.includes(query);
      const matchesClass = filterClass === 'all' || contactClass(contact) === filterClass;
      const matchesType = filterTipo === 'all' || contact.tipo === filterTipo || (filterTipo !== 'ambos' && contact.tipo === 'ambos');
      return matchesSearch && matchesClass && matchesType;
    });

    return result.sort((a, b) => {
      if (sortBy === 'za') return text(b.nombre).localeCompare(text(a.nombre), 'es', { sensitivity: 'base' });
      if (sortBy === 'recent') return new Date(b.created_date || 0).getTime() - new Date(a.created_date || 0).getTime();
      if (sortBy === 'activity') return new Date(lastActivity(b) || 0).getTime() - new Date(lastActivity(a) || 0).getTime();
      return text(a.nombre).localeCompare(text(b.nombre), 'es', { sensitivity: 'base' });
    });
  }, [contacts, search, filterClass, filterTipo, sortBy]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const allVisibleSelected = visible.length > 0 && visible.every((contact) => selected.has(contact.id));

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY);
    setError('');
    setShowForm(true);
  };

  const openEdit = (contact) => {
    setEditing(contact);
    setForm({
      ...EMPTY,
      ...contact,
      clase_contacto: contactClass(contact),
      email: firstEmail(contact),
      telefono: firstPhone(contact),
    });
    setError('');
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditing(null);
    setForm(EMPTY);
  };

  const handleSave = async () => {
    if (!text(form.nombre)) {
      setError('Indica el nombre o la razón social del contacto.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const emails = [...new Set([...(editing?.emails || []), form.email].map(text).filter(Boolean))];
      const telefonos = [...new Set([...(editing?.telefonos || []), form.telefono].map(text).filter(Boolean))];
      const payload = {
        nombre: text(form.nombre),
        razon_social: form.clase_contacto === 'empresa' ? text(form.nombre) : text(form.razon_social),
        nif_cif: text(form.nif_cif).toUpperCase(),
        tipo: form.tipo,
        clase_contacto: form.clase_contacto,
        email: text(form.email),
        telefono: text(form.telefono),
        emails,
        telefonos,
        direccion_fiscal: text(form.direccion_fiscal),
        codigo_postal: text(form.codigo_postal),
        ciudad: text(form.ciudad),
        provincia: text(form.provincia),
        pais: text(form.pais) || 'España',
        organismo_publico: !!form.organismo_publico,
        persona_contacto: text(form.persona_contacto),
        notas: text(form.notas),
        company_id: company.id,
        activo: true,
        origen_automatico: editing?.origen_automatico || false,
      };
      if (editing) await base44.entities.Contact.update(editing.id, payload);
      else await base44.entities.Contact.create(payload);
      closeForm();
      await load();
    } catch (saveError) {
      console.error('[Contactos] Save failed:', saveError);
      setError('No se pudo guardar el contacto. Revisa los datos e inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (contact) => {
    if (!window.confirm(`¿Quieres retirar “${contact.nombre}” de Contactos? Sus facturas no se eliminarán.`)) return;
    try {
      await base44.entities.Contact.update(contact.id, { activo: false });
      setSelected((current) => {
        const next = new Set(current);
        next.delete(contact.id);
        return next;
      });
      await load();
    } catch (deleteError) {
      console.error('[Contactos] Delete failed:', deleteError);
      setError('No se pudo retirar el contacto.');
    }
  };

  const toggleVisible = () => {
    setSelected((current) => {
      const next = new Set(current);
      visible.forEach((contact) => {
        if (allVisibleSelected) next.delete(contact.id);
        else next.add(contact.id);
      });
      return next;
    });
  };

  const toggleOne = (id) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exportCsv = (rows) => {
    const headers = ['Nombre', 'Clase', 'NIF/CIF/DNI', 'Email', 'Teléfono', 'Dirección', 'Código postal', 'Ciudad', 'Provincia', 'País', 'Tipo', 'Origen', 'Última actividad'];
    const lines = rows.map((contact) => [
      contact.nombre,
      contactClass(contact) === 'empresa' ? 'Empresa' : 'Persona',
      contact.nif_cif,
      firstEmail(contact),
      firstPhone(contact),
      contact.direccion_fiscal,
      contact.codigo_postal,
      contact.ciudad,
      contact.provincia,
      contact.pais,
      typeLabel(contact.tipo),
      sourceLabel(contact),
      formatDate(lastActivity(contact)),
    ].map(csvCell).join(';'));
    const csv = '\uFEFF' + [headers.map(csvCell).join(';'), ...lines].join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `contactos-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const selectedRows = contacts.filter((contact) => selected.has(contact.id));

  if (loadingCompany && loading) {
    return <div className="p-12 text-center"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" /></div>;
  }
  if (!company && !loadingCompany) return <NoCompanyState pageName="Contactos" />;

  return (
    <div className="pb-8">
      <PageHeader title="Contactos" subtitle="Agenda de clientes y proveedores creada automáticamente desde facturas y OCR">
        <div className="flex flex-wrap items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-9 gap-1.5">
                Acciones <ChevronDown className="w-3.5 h-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => exportCsv(filtered)} disabled={!filtered.length}>
                <Download className="w-4 h-4 mr-2" /> Exportar resultados
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportCsv(selectedRows)} disabled={!selectedRows.length}>
                <Download className="w-4 h-4 mr-2" /> Exportar selección
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={syncFromInvoices} disabled={syncing}>
                <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                Revisar facturas y OCR
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={openNew} className="bg-teal hover:bg-teal-dark h-9">
            <Plus className="w-4 h-4 mr-1.5" /> Nuevo contacto
          </Button>
        </div>
      </PageHeader>

      {error && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {error}
        </div>
      )}

      <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
        <div className="p-3 border-b border-border flex flex-col xl:flex-row xl:items-center gap-3">
          <div className="inline-flex self-start rounded-lg border border-border bg-secondary/30 p-0.5">
            {[
              { value: 'all', label: 'Todos', count: counts.total, icon: Users },
              { value: 'empresa', label: 'Empresas', count: counts.empresa, icon: Building2 },
              { value: 'persona', label: 'Personas', count: counts.persona, icon: UserRound },
            ].map((item) => {
              const Icon = item.icon;
              const active = filterClass === item.value;
              return (
                <button
                  key={item.value}
                  onClick={() => setFilterClass(item.value)}
                  className={`h-8 px-3 rounded-md text-sm font-medium inline-flex items-center gap-1.5 transition-colors ${active ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {item.label}
                  <span className={`text-[11px] tabular-nums ${active ? 'text-teal' : 'text-muted-foreground'}`}>{item.count}</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[170px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="az">Contactos A-Z</SelectItem>
                <SelectItem value="za">Contactos Z-A</SelectItem>
                <SelectItem value="recent">Más recientes</SelectItem>
                <SelectItem value="activity">Última actividad</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant={showFilters || filterTipo !== 'all' ? 'secondary' : 'ghost'}
              className="h-9 gap-1.5"
              onClick={() => setShowFilters((value) => !value)}
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filtros
              {filterTipo !== 'all' && <span className="w-5 h-5 rounded-full bg-teal text-white text-[11px] grid place-items-center">1</span>}
            </Button>
          </div>

          <div className="relative xl:ml-auto w-full xl:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              aria-label="Buscar contactos"
              placeholder="Nombre, NIF, email, teléfono..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={() => exportCsv(filtered)} disabled={!filtered.length} title="Exportar contactos">
            <Download className="w-4 h-4" />
          </Button>
        </div>

        {showFilters && (
          <div className="px-4 py-3 border-b border-border bg-secondary/20 flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Relación</Label>
              <Select value={filterTipo} onValueChange={setFilterTipo}>
                <SelectTrigger className="w-48 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los tipos</SelectItem>
                  <SelectItem value="cliente">Clientes</SelectItem>
                  <SelectItem value="proveedor">Proveedores</SelectItem>
                  <SelectItem value="ambos">Cliente y proveedor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="ghost" className="h-9" onClick={() => { setFilterTipo('all'); setSearch(''); }}>
              Limpiar filtros
            </Button>
          </div>
        )}

        {selected.size > 0 && (
          <div className="px-4 py-2.5 border-b border-border bg-teal-light/50 flex items-center gap-3 text-sm">
            <span className="font-medium text-foreground">{selected.size} seleccionados</span>
            <button className="text-teal hover:underline" onClick={() => exportCsv(selectedRows)}>Exportar selección</button>
            <button className="text-muted-foreground hover:text-foreground ml-auto" onClick={() => setSelected(new Set())}>Quitar selección</button>
          </div>
        )}

        {loading ? (
          <div className="p-16 text-center">
            <div className="w-6 h-6 border-2 border-teal border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-muted-foreground mt-3">Cargando contactos...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center">
            <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="font-medium text-foreground mb-1">{contacts.length ? 'No hay coincidencias' : 'Todavía no hay contactos'}</p>
            <p className="text-sm text-muted-foreground max-w-lg mx-auto">
              {contacts.length
                ? 'Prueba con otro término o limpia los filtros.'
                : 'Los clientes y proveedores aparecerán aquí al crear o escanear facturas. También puedes añadir uno manualmente.'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1380px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/40">
                    <th className="w-12 px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        aria-label="Seleccionar contactos visibles"
                        checked={allVisibleSelected}
                        onChange={toggleVisible}
                        className="w-4 h-4 rounded border-border accent-teal"
                      />
                    </th>
                    <th className="min-w-[250px] px-2 py-3 text-left text-xs font-semibold text-muted-foreground">
                      <span className="inline-flex items-center gap-1">Nombre {sortBy === 'za' ? <ArrowDownAZ className="w-3.5 h-3.5" /> : <ArrowUpAZ className="w-3.5 h-3.5" />}</span>
                    </th>
                    <th className="min-w-[140px] px-3 py-3 text-left text-xs font-semibold text-muted-foreground">ID fiscal</th>
                    <th className="min-w-[220px] px-3 py-3 text-left text-xs font-semibold text-muted-foreground">Email</th>
                    <th className="min-w-[150px] px-3 py-3 text-left text-xs font-semibold text-muted-foreground">Teléfono</th>
                    <th className="min-w-[270px] px-3 py-3 text-left text-xs font-semibold text-muted-foreground">Dirección</th>
                    <th className="min-w-[110px] px-3 py-3 text-left text-xs font-semibold text-muted-foreground">País</th>
                    <th className="min-w-[145px] px-3 py-3 text-left text-xs font-semibold text-muted-foreground">Tipo</th>
                    <th className="min-w-[100px] px-3 py-3 text-left text-xs font-semibold text-muted-foreground">Origen</th>
                    <th className="min-w-[125px] px-3 py-3 text-left text-xs font-semibold text-muted-foreground">Actividad</th>
                    <th className="w-14 px-3 py-3 text-right text-xs font-semibold text-muted-foreground">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((contact) => {
                    const email = firstEmail(contact);
                    const phone = firstPhone(contact);
                    const address = fullAddress(contact);
                    const klass = contactClass(contact);
                    return (
                      <tr key={contact.id} className="border-b border-border last:border-0 hover:bg-secondary/20 transition-colors">
                        <td className="px-4 py-2.5">
                          <input
                            type="checkbox"
                            aria-label={`Seleccionar ${contact.nombre}`}
                            checked={selected.has(contact.id)}
                            onChange={() => toggleOne(contact.id)}
                            className="w-4 h-4 rounded border-border accent-teal"
                          />
                        </td>
                        <td className="px-2 py-2.5">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className={`w-8 h-8 rounded-lg grid place-items-center text-[11px] font-bold shrink-0 ${avatarColor(contact.nombre)}`}>
                              {initials(contact.nombre)}
                            </div>
                            <div className="min-w-0">
                              <button onClick={() => openEdit(contact)} className="font-semibold text-foreground hover:text-teal text-left max-w-[210px] truncate block">
                                {contact.nombre}
                              </button>
                              <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                                {klass === 'empresa' ? <Building2 className="w-3 h-3" /> : <UserRound className="w-3 h-3" />}
                                {klass === 'empresa' ? 'Empresa' : 'Persona'}
                                {contact.persona_contacto ? ` · ${contact.persona_contacto}` : ''}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{contact.nif_cif || '—'}</td>
                        <td className="px-3 py-2.5">
                          {email ? <a href={`mailto:${email}`} className="text-foreground hover:text-teal truncate max-w-[205px] block">{email}</a> : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-3 py-2.5">
                          {phone ? <a href={`tel:${phone}`} className="text-foreground hover:text-teal whitespace-nowrap">{phone}</a> : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground"><span className="block max-w-[250px] truncate" title={address}>{address || '—'}</span></td>
                        <td className="px-3 py-2.5 text-muted-foreground">{contact.pais || '—'}</td>
                        <td className="px-3 py-2.5">
                          <span className={`inline-flex rounded-md px-2 py-1 text-[11px] font-semibold ${contact.tipo === 'cliente' ? 'bg-teal-50 text-teal-700' : contact.tipo === 'proveedor' ? 'bg-orange-50 text-orange-700' : 'bg-blue-50 text-blue-700'}`}>
                            {typeLabel(contact.tipo)}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${contact.origen_automatico ? 'bg-violet-50 text-violet-700' : 'bg-secondary text-muted-foreground'}`}>
                            {sourceLabel(contact)}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{formatDate(lastActivity(contact))}</td>
                        <td className="px-3 py-2.5 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Acciones para ${contact.nombre}`}>
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem onClick={() => openEdit(contact)}>
                                <Pencil className="w-4 h-4 mr-2" /> Editar contacto
                              </DropdownMenuItem>
                              {contact.nif_cif && (
                                <DropdownMenuItem onClick={() => navigator.clipboard.writeText(contact.nif_cif)}>
                                  <Copy className="w-4 h-4 mr-2" /> Copiar NIF/CIF
                                </DropdownMenuItem>
                              )}
                              {email && (
                                <DropdownMenuItem asChild>
                                  <a href={`mailto:${email}`}><Mail className="w-4 h-4 mr-2" /> Enviar email</a>
                                </DropdownMenuItem>
                              )}
                              {phone && (
                                <DropdownMenuItem asChild>
                                  <a href={`tel:${phone}`}><Phone className="w-4 h-4 mr-2" /> Llamar</a>
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(contact)}>
                                <Trash2 className="w-4 h-4 mr-2" /> Retirar contacto
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="px-4 py-3 border-t border-border flex flex-col sm:flex-row sm:items-center gap-3 text-sm">
              <p className="text-muted-foreground">
                Mostrando <span className="font-medium text-foreground">{(currentPage - 1) * pageSize + 1}</span>–<span className="font-medium text-foreground">{Math.min(currentPage * pageSize, filtered.length)}</span> de <span className="font-medium text-foreground">{filtered.length}</span>
              </p>
              <div className="sm:ml-auto flex items-center gap-2">
                <Select value={String(pageSize)} onValueChange={(value) => setPageSize(Number(value))}>
                  <SelectTrigger className="w-[105px] h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZE_OPTIONS.map((size) => <SelectItem key={size} value={String(size)}>{size} / pág.</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="min-w-20 text-center text-xs text-muted-foreground">Pág. {currentPage} de {pageCount}</span>
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      <Dialog open={showForm} onOpenChange={(open) => { if (!open) closeForm(); else setShowForm(true); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar contacto' : 'Nuevo contacto'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Nombre / Razón social *</Label>
              <Input value={form.nombre} onChange={(event) => setForm((current) => ({ ...current, nombre: event.target.value }))} placeholder="Nombre del contacto" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label>Clase de contacto</Label>
              <Select value={form.clase_contacto} onValueChange={(value) => setForm((current) => ({ ...current, clase_contacto: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="empresa">Empresa</SelectItem>
                  <SelectItem value="persona">Persona</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Relación</Label>
              <Select value={form.tipo} onValueChange={(value) => setForm((current) => ({ ...current, tipo: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cliente">Cliente</SelectItem>
                  <SelectItem value="proveedor">Proveedor</SelectItem>
                  <SelectItem value="ambos">Cliente y proveedor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>NIF / CIF / DNI</Label>
              <Input value={form.nif_cif} onChange={(event) => setForm((current) => ({ ...current, nif_cif: event.target.value }))} placeholder="B12345678" />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} placeholder="contacto@ejemplo.com" />
            </div>
            <div className="space-y-1.5">
              <Label>Teléfono</Label>
              <Input value={form.telefono} onChange={(event) => setForm((current) => ({ ...current, telefono: event.target.value }))} placeholder="+34 600 000 000" />
            </div>
            <div className="space-y-1.5">
              <Label>Persona de contacto</Label>
              <Input value={form.persona_contacto} onChange={(event) => setForm((current) => ({ ...current, persona_contacto: event.target.value }))} placeholder="Nombre de la persona" />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Dirección fiscal</Label>
              <Input value={form.direccion_fiscal} onChange={(event) => setForm((current) => ({ ...current, direccion_fiscal: event.target.value }))} placeholder="Calle, número, piso..." />
            </div>
            <div className="space-y-1.5">
              <Label>Código postal</Label>
              <Input value={form.codigo_postal} onChange={(event) => setForm((current) => ({ ...current, codigo_postal: event.target.value }))} placeholder="28001" />
            </div>
            <div className="space-y-1.5">
              <Label>Ciudad</Label>
              <Input value={form.ciudad} onChange={(event) => setForm((current) => ({ ...current, ciudad: event.target.value }))} placeholder="Madrid" />
            </div>
            <div className="space-y-1.5">
              <Label>Provincia</Label>
              <Input value={form.provincia} onChange={(event) => setForm((current) => ({ ...current, provincia: event.target.value }))} placeholder="Madrid" />
            </div>
            <div className="space-y-1.5">
              <Label>País</Label>
              <Input value={form.pais} onChange={(event) => setForm((current) => ({ ...current, pais: event.target.value }))} />
            </div>
            <div className="sm:col-span-2 flex items-center justify-between bg-secondary/50 border border-border rounded-xl px-4 py-3">
              <div>
                <p className="text-sm font-medium text-foreground">Organismo público</p>
                <p className="text-xs text-muted-foreground">Actívalo si es una Administración Pública (FacturaE).</p>
              </div>
              <Switch checked={!!form.organismo_publico} onCheckedChange={(value) => setForm((current) => ({ ...current, organismo_publico: value }))} />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Notas</Label>
              <Textarea value={form.notas} onChange={(event) => setForm((current) => ({ ...current, notas: event.target.value }))} rows={3} />
            </div>
          </div>
          {error && <p className="text-sm text-destructive mt-2">{error}</p>}
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={closeForm}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-teal hover:bg-teal-dark">
              {saving ? 'Guardando...' : 'Guardar contacto'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}