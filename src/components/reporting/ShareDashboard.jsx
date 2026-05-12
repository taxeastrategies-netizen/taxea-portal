import { useState } from 'react';
import { Share2, Link2, Copy, CheckCheck, Eye, Clock, Shield, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ShareDashboard({ company, financials }) {
  const [expiry, setExpiry] = useState('7d');
  const [password, setPassword] = useState('');
  const [sections, setSections] = useState(['kpis', 'cashflow', 'charts']);
  const [generated, setGenerated] = useState(false);
  const [copied, setCopied] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [emailSent, setEmailSent] = useState(false);

  const fakeLink = `https://app.taxea.com/share/rpt_${Math.random().toString(36).slice(2, 10)}`;

  const SECTION_OPTIONS = [
    { id: 'kpis', label: 'KPIs principales' },
    { id: 'cashflow', label: 'Cashflow & liquidez' },
    { id: 'charts', label: 'Gráficos evolución' },
    { id: 'debt', label: 'Posición deuda' },
    { id: 'ratios', label: 'Ratios financieros' },
    { id: 'scoring', label: 'Company Score' },
  ];

  const toggleSection = (id) => {
    setSections(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const generate = () => setGenerated(true);

  const copy = () => {
    navigator.clipboard.writeText(fakeLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sendEmail = () => {
    if (!emailTo) return;
    setEmailSent(true);
    setTimeout(() => setEmailSent(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-amber-700 to-amber-500 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center">
            <Share2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-jakarta font-bold">Dashboard Compartible</h3>
            <p className="text-amber-200 text-sm mt-0.5">Enlace seguro con acceso temporal y configuración de permisos</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Config */}
        <div className="space-y-4">
          {/* Sections */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <p className="text-sm font-semibold text-foreground mb-3">Secciones a compartir</p>
            <div className="space-y-2">
              {SECTION_OPTIONS.map(s => (
                <label key={s.id} className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={sections.includes(s.id)} onChange={() => toggleSection(s.id)}
                    className="w-4 h-4 rounded accent-amber-500" />
                  <span className="text-sm text-slate-600">{s.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Expiry */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-slate-500" />
              <p className="text-sm font-semibold text-foreground">Expiración del enlace</p>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[
                { id: '24h', label: '24h' }, { id: '7d', label: '7 días' },
                { id: '30d', label: '30 días' }, { id: 'never', label: 'Sin exp.' },
              ].map(e => (
                <button key={e.id} onClick={() => setExpiry(e.id)}
                  className={cn("py-2 rounded-lg text-xs font-medium border-2 transition-all",
                    expiry === e.id ? "border-amber-500 bg-amber-50 text-amber-700" : "border-slate-200 text-slate-600 hover:border-slate-300")}>
                  {e.label}
                </button>
              ))}
            </div>
          </div>

          {/* Password */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-4 h-4 text-slate-500" />
              <p className="text-sm font-semibold text-foreground">Contraseña (opcional)</p>
            </div>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Deja vacío para acceso libre"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300" />
          </div>
        </div>

        {/* Generate & share */}
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Eye className="w-4 h-4 text-slate-500" />
              <p className="text-sm font-semibold text-foreground">Vista previa configuración</p>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-500">Empresa</span>
                <span className="font-medium text-foreground">{company?.nombre_comercial || company?.razon_social || '—'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-500">Secciones</span>
                <span className="font-medium text-foreground">{sections.length} seleccionadas</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-50">
                <span className="text-slate-500">Expiración</span>
                <span className="font-medium text-foreground">{expiry === 'never' ? 'Sin expiración' : expiry}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-500">Contraseña</span>
                <span className="font-medium text-foreground">{password ? 'Sí' : 'No'}</span>
              </div>
            </div>
            <button onClick={generate}
              className="w-full mt-4 py-2.5 rounded-xl text-sm font-semibold bg-amber-500 text-white hover:bg-amber-600 transition-all shadow-sm">
              Generar enlace seguro
            </button>
          </div>

          {generated && (
            <div className="bg-white border border-emerald-200 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Link2 className="w-4 h-4 text-emerald-600" />
                <p className="text-sm font-semibold text-foreground">Enlace generado</p>
              </div>
              <div className="flex items-center gap-2 bg-slate-50 rounded-xl p-3 border border-slate-200 mb-3">
                <p className="text-xs text-slate-600 flex-1 truncate font-mono">{fakeLink}</p>
                <button onClick={copy} className="text-slate-500 hover:text-slate-700 transition-colors flex-shrink-0">
                  {copied ? <CheckCheck className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <div className="flex items-center gap-2 mt-4">
                <input type="email" value={emailTo} onChange={e => setEmailTo(e.target.value)}
                  placeholder="Enviar por email a..."
                  className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300" />
                <button onClick={sendEmail}
                  className={cn("flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all",
                    emailSent ? "bg-emerald-100 text-emerald-700" : "bg-amber-500 text-white hover:bg-amber-600")}>
                  {emailSent ? <CheckCheck className="w-3.5 h-3.5" /> : <Mail className="w-3.5 h-3.5" />}
                  {emailSent ? 'Enviado' : 'Enviar'}
                </button>
              </div>
            </div>
          )}

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-xs text-amber-700">
              <strong>Solo lectura.</strong> Los destinatarios verán el dashboard pero no podrán editar datos ni acceder al resto de la plataforma.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}