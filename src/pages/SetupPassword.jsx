import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckCircle, Mail, Lock, ArrowRight, AlertTriangle, Eye, EyeOff } from 'lucide-react';

function PasswordStrength({ password }) {
  const checks = [
    { label: 'Mínimo 10 caracteres', ok: password.length >= 10 },
    { label: 'Una mayúscula', ok: /[A-Z]/.test(password) },
    { label: 'Una minúscula', ok: /[a-z]/.test(password) },
    { label: 'Un número', ok: /[0-9]/.test(password) },
    { label: 'Un símbolo (!@#$...)', ok: /[^A-Za-z0-9]/.test(password) },
  ];
  if (!password) return null;
  return (
    <div className="space-y-1 mt-2">
      {checks.map((c, i) => (
        <div key={i} className="flex items-center gap-1.5 text-xs">
          <div className={`w-3 h-3 rounded-full flex items-center justify-center flex-shrink-0 ${c.ok ? 'bg-green-500' : 'bg-slate-200'}`}>
            {c.ok && <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 8 8"><path d="M1 4l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>}
          </div>
          <span className={c.ok ? 'text-green-600' : 'text-slate-400'}>{c.label}</span>
        </div>
      ))}
    </div>
  );
}

export default function SetupPassword() {
  const params = new URLSearchParams(window.location.search);
  const urlToken = params.get('token');
  const urlEmail = params.get('email');

  const [mode, setMode] = useState(urlToken ? 'token' : 'request'); // 'token' | 'request' | 'sent' | 'invalid'
  const [clientAccount, setClientAccount] = useState(null);
  const [email, setEmail] = useState(urlEmail || '');
  const [loading, setLoading] = useState(!!urlToken);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Validate token on mount
  useEffect(() => {
    if (!urlToken) return;
    const validate = async () => {
      try {
        const accounts = await base44.entities.ClientAccount.filter({ setupToken: urlToken });
        const account = accounts?.[0];
        if (!account) { setMode('invalid'); setLoading(false); return; }
        // Check expiry
        if (account.setupTokenExpiresAt && new Date(account.setupTokenExpiresAt) < new Date()) {
          setMode('invalid'); setLoading(false); return;
        }
        setClientAccount(account);
        setEmail(account.email);
        setMode('token');
      } catch {
        setMode('invalid');
      } finally {
        setLoading(false);
      }
    };
    validate();
  }, [urlToken]);

  const handleRequestLink = async (e) => {
    e.preventDefault();
    setSending(true);
    setError('');
    try {
      // Only show generic success - don't reveal if email exists
      // Validate email belongs to a ClientAccount first (silently)
      const accounts = await base44.entities.ClientAccount.filter({ email: email.trim() });
      if (accounts?.length > 0) {
        // User exists - call resetPasswordRequest
        await base44.auth.resetPasswordRequest(email.trim());
      }
      // Always show success regardless
      setMode('sent');
    } catch {
      setMode('sent'); // generic success always
    } finally {
      setSending(false);
    }
  };

  const handleSendSetupLink = async () => {
    setSending(true);
    setError('');
    try {
      // Create user in auth system if needed
      try { await base44.users.inviteUser(email, 'user'); } catch {}
      // Send password reset (actual link to /reset-password?token=...)
      await base44.auth.resetPasswordRequest(email);
      // Mark token as used in ClientAccount
      if (clientAccount) {
        await base44.entities.ClientAccount.update(clientAccount.id, {
          setupTokenExpiresAt: new Date().toISOString(), // invalidate token
        });
        await base44.entities.ClientAccessAuditLog.create({
          clientAccountId: clientAccount.id,
          clientName: clientAccount.legalName,
          actionType: 'credenciales_generadas',
          actionBy: email,
          actionAt: new Date().toISOString(),
          details: 'Cliente solicitó enlace de establecimiento de contraseña desde /setup-password',
        });
      }
      setMode('sent');
    } catch (e) {
      setError('Ha ocurrido un error. Por favor, inténtalo de nuevo o contacta con Taxea Strategies.');
    } finally {
      setSending(false);
    }
  };

  const Logo = () => (
    <div className="flex justify-center mb-8">
      <img
        src="https://media.base44.com/images/public/6a00fec50cc522a74ddde4b2/b059a58db_ChatGPTImage7may202610_56_53pm.png"
        alt="Taxea Strategies"
        className="h-16 object-contain"
      />
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-taxea-red border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Logo />

        <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-8">

          {/* INVALID TOKEN */}
          {mode === 'invalid' && (
            <div className="text-center space-y-4">
              <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto">
                <AlertTriangle className="w-7 h-7 text-red-500" />
              </div>
              <h1 className="text-xl font-jakarta font-bold text-slate-800">Enlace no válido</h1>
              <p className="text-slate-500 text-sm leading-relaxed">
                El enlace no es válido o ha caducado. Solicita un nuevo enlace o contacta con Taxea Strategies.
              </p>
              <div className="flex flex-col gap-2 pt-2">
                <Button onClick={() => { setMode('request'); }} className="w-full bg-taxea-red hover:bg-taxea-red-dark">
                  Solicitar nuevo enlace
                </Button>
                <a href="/login" className="text-sm text-slate-400 hover:text-taxea-red text-center">
                  Ir al login →
                </a>
              </div>
            </div>
          )}

          {/* TOKEN VALID — show confirmation to send link */}
          {mode === 'token' && clientAccount && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Lock className="w-6 h-6 text-taxea-red" />
                </div>
                <h1 className="text-xl font-jakarta font-bold text-slate-800 mb-2">
                  Establece tu contraseña
                </h1>
                <p className="text-slate-500 text-sm leading-relaxed">
                  Hola, <strong className="text-slate-700">{clientAccount.legalName || email}</strong>.
                  Haz clic en el botón para recibir tu enlace de creación de contraseña.
                </p>
              </div>

              <div className="bg-slate-50 rounded-xl px-4 py-3 flex items-center gap-3">
                <Mail className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <span className="text-sm text-slate-700 font-medium">{email}</span>
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
              )}

              <Button
                onClick={handleSendSetupLink}
                disabled={sending}
                className="w-full h-11 bg-taxea-red hover:bg-taxea-red-dark gap-2"
              >
                {sending ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>Enviar enlace para crear contraseña <ArrowRight className="w-4 h-4" /></>
                )}
              </Button>
            </div>
          )}

          {/* REQUEST MODE — no token */}
          {mode === 'request' && (
            <form onSubmit={handleRequestLink} className="space-y-5">
              <div className="text-center mb-2">
                <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Lock className="w-6 h-6 text-taxea-red" />
                </div>
                <h1 className="text-xl font-jakarta font-bold text-slate-800 mb-2">
                  Establece tu contraseña
                </h1>
                <p className="text-slate-500 text-sm leading-relaxed">
                  Introduce tu correo electrónico y te enviaremos un enlace seguro para crear tu contraseña de acceso.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Correo electrónico</label>
                <Input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  required
                  className="h-11"
                  autoFocus
                />
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
              )}

              <Button type="submit" disabled={sending || !email.trim()} className="w-full h-11 bg-taxea-red hover:bg-taxea-red-dark gap-2">
                {sending
                  ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <>Enviar enlace de acceso <ArrowRight className="w-4 h-4" /></>
                }
              </Button>

              <p className="text-center text-xs text-slate-400">
                Si el correo corresponde a una cuenta creada por Taxea, recibirás un enlace seguro para establecer tu contraseña.
              </p>
            </form>
          )}

          {/* SENT */}
          {mode === 'sent' && (
            <div className="text-center py-2 space-y-4">
              <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-xl font-jakarta font-bold text-slate-800">¡Correo enviado!</h2>
              <p className="text-slate-500 text-sm leading-relaxed">
                Hemos enviado un enlace seguro a <strong className="text-slate-700">{email}</strong>.
                Revisa tu bandeja de entrada y la carpeta de spam, y haz clic en el enlace para crear tu contraseña.
              </p>

              <div className="bg-slate-50 rounded-xl p-4 text-left space-y-2.5">
                <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Próximos pasos:</p>
                {[
                  { icon: Mail, text: 'Abre el email de Taxea Strategies y haz clic en el enlace' },
                  { icon: Lock, text: 'Elige una contraseña segura' },
                  { icon: CheckCircle, text: 'Accede al portal con tu email y contraseña' },
                ].map(({ icon: Icon, text }, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-slate-500">
                    <Icon className="w-4 h-4 text-taxea-red mt-0.5 flex-shrink-0" />
                    <span>{text}</span>
                  </div>
                ))}
              </div>

              <a href="/login" className="inline-block text-sm text-taxea-red hover:underline mt-2">
                Ir al login →
              </a>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          © 2025 Taxea Strategies · Portal de Clientes
        </p>
      </div>
    </div>
  );
}