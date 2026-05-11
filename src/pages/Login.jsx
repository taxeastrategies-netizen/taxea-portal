import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Eye, EyeOff, ArrowRight, Shield, CheckCircle2, FileText, Brain, Bell, Users, ChevronLeft, Phone, Mail, Lock, User, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// ─── Branding panel izquierdo ───────────────────────────────────────────────
const FEATURES = [
  { icon: FileText, text: 'Documentación 100% privada y segura' },
  { icon: Brain,    text: 'IA que lee y clasifica tus facturas' },
  { icon: Bell,     text: 'Seguimiento fiscal en tiempo real' },
  { icon: Users,    text: 'Comunicación directa con tu asesor' },
  { icon: Shield,   text: 'Control centralizado de tu negocio' },
];

function BrandingPanel() {
  return (
    <div
      className="hidden lg:flex lg:w-5/12 flex-col justify-between p-12 relative overflow-hidden select-none"
      style={{ background: 'linear-gradient(160deg, #141414 60%, #1f0a0d 100%)' }}
    >
      {/* Decoración */}
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-taxea-red/6 -translate-y-1/2 translate-x-1/3 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full bg-taxea-red/4 translate-y-1/3 -translate-x-1/4 blur-2xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 w-px h-40 bg-gradient-to-b from-transparent via-taxea-red/20 to-transparent pointer-events-none" />

      {/* Logo + tagline */}
      <div className="relative z-10">
        <div className="mb-10">
          <div className="mb-3">
            <div className="bg-white rounded-2xl px-6 py-4 inline-block">
              <img
                src="https://media.base44.com/images/public/6a00fec50cc522a74ddde4b2/35e9bbe29_IMG_20260111_164937_14712.webp"
                alt="Taxea Strategies"
                className="h-24 w-auto object-contain"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-taxea-red/30" />
            <span className="text-taxea-red text-xs font-medium tracking-widest uppercase">Portal Privado</span>
            <div className="h-px flex-1 bg-taxea-red/30" />
          </div>
        </div>

        <h2 className="text-white font-jakarta text-4xl font-bold leading-tight mb-5">
          Tu área privada<br />
          <span className="text-taxea-red">fiscal y contable.</span>
        </h2>
        <p className="text-white/50 text-sm leading-relaxed max-w-xs">
          Portal exclusivo para clientes de Taxea Strategies. Gestiona tu documentación, obligaciones fiscales y comunicación con tu asesor desde un entorno privado, seguro e inteligente.
        </p>
      </div>

      {/* Features */}
      <div className="relative z-10 space-y-3">
        {FEATURES.map(({ icon: Icon, text }) => (
          <div key={text} className="flex items-center gap-3 group">
            <div className="w-8 h-8 rounded-lg bg-taxea-red/10 border border-taxea-red/20 flex items-center justify-center flex-shrink-0 group-hover:bg-taxea-red/20 transition-colors">
              <Icon className="w-3.5 h-3.5 text-taxea-red" />
            </div>
            <p className="text-white/55 text-sm">{text}</p>
          </div>
        ))}
        <div className="pt-5 mt-2 border-t border-white/8">
          <p className="text-white/20 text-xs">Portal privado · Cifrado SSL · Cumplimiento RGPD · © {new Date().getFullYear()} Taxea Strategies</p>
        </div>
      </div>
    </div>
  );
}

// ─── Panel formulario ────────────────────────────────────────────────────────
export default function Login() {
  const [mode, setMode] = useState('login'); // login | register | forgot | otp | success
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Login
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);

  // Registro
  const [regNombre, setRegNombre] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regTel, setRegTel] = useState('');
  const [regPass, setRegPass] = useState('');
  const [regPassConf, setRegPassConf] = useState('');
  const [showRegPass, setShowRegPass] = useState(false);
  const [rgpdMain, setRgpdMain] = useState(false);
  const [rgpdComms, setRgpdComms] = useState(false);

  // OTP
  const [otpCode, setOtpCode] = useState('');

  // Forgot
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);

  const resetErrors = () => setError('');

  // ── LOGIN ──
  const handleLogin = async (e) => {
    e.preventDefault();
    resetErrors();
    setLoading(true);
    try {
      await base44.auth.loginViaEmailPassword(email, password);
      window.location.href = '/';
    } catch (err) {
      setError(err.message || 'Credenciales incorrectas. Comprueba tu email y contraseña.');
    } finally {
      setLoading(false);
    }
  };

  // ── REGISTRO ──
  const handleRegister = async (e) => {
    e.preventDefault();
    resetErrors();
    if (!rgpdMain) { setError('Debes aceptar la política de privacidad para continuar.'); return; }
    if (regPass.length < 8) { setError('La contraseña debe tener al menos 8 caracteres.'); return; }
    if (regPass !== regPassConf) { setError('Las contraseñas no coinciden.'); return; }
    setLoading(true);
    try {
      await base44.auth.register({ email: regEmail, password: regPass, full_name: regNombre });
      setMode('otp');
    } catch (err) {
      const msg = err.message || '';
      if (msg.toLowerCase().includes('exist') || msg.toLowerCase().includes('already')) {
        setError('Este correo ya está registrado. ¿Quieres iniciar sesión?');
      } else {
        setError(msg || 'Error al crear la cuenta. Inténtalo de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  };

  // ── OTP ──
  const handleOtp = async (e) => {
    e.preventDefault();
    resetErrors();
    setLoading(true);
    try {
      const res = await base44.auth.verifyOtp({ email: regEmail, otpCode });
      if (res?.access_token) base44.auth.setToken(res.access_token);
      // Crear lead CRM
      try {
        await base44.entities.ClientCRM.create({
          company_id: 'pendiente',
          estado_comercial: 'lead',
          rentabilidad: 'media',
          observaciones_internas: `Registro portal: ${new Date().toLocaleDateString('es-ES')} | Tel: ${regTel || 'no proporcionado'} | Comms: ${rgpdComms}`,
          etiquetas: ['portal_registro', rgpdComms ? 'acepta_comms' : 'sin_comms'],
        });
      } catch {}
      setMode('success');
    } catch (err) {
      setError(err.message || 'Código incorrecto. Revisa tu correo.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    try { await base44.auth.resendOtp(regEmail); } catch {}
  };

  // ── FORGOT ──
  const handleForgot = async (e) => {
    e.preventDefault();
    setLoading(true);
    try { await base44.auth.resetPasswordRequest(forgotEmail); } catch {}
    setForgotSent(true);
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex bg-background">
      <BrandingPanel />

      {/* Panel derecho */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 bg-background">
        <div className="w-full max-w-md">

          {/* Logo mobile */}
          <div className="lg:hidden mb-8">
            <img
              src="https://media.base44.com/images/public/6a00fec50cc522a74ddde4b2/35e9bbe29_IMG_20260111_164937_14712.webp"
              alt="Taxea Strategies"
              className="h-12 w-auto object-contain"
            />
          </div>

          {/* ── LOGIN ── */}
          {mode === 'login' && (
            <div className="animate-fade-in">
              <div className="mb-8">
                <div className="inline-flex items-center gap-2 bg-taxea-red/8 border border-taxea-red/15 rounded-full px-3 py-1 mb-4">
                  <Sparkles className="w-3 h-3 text-taxea-red" />
                  <span className="text-xs text-taxea-red font-medium">Área privada de cliente</span>
                </div>
                <h1 className="text-3xl font-jakarta font-bold text-foreground">Iniciar sesión</h1>
                <p className="text-muted-foreground mt-1.5 text-sm">Accede a tu portal fiscal personalizado</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-sm font-medium">Correo electrónico</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input id="email" type="email" placeholder="tu@email.com" value={email} onChange={e => setEmail(e.target.value)} required className="h-12 pl-10 text-sm" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-sm font-medium">Contraseña</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input id="password" type={showPass ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required className="h-12 pl-10 pr-11 text-sm" />
                    <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1">
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {error && <ErrorBox message={error} />}

                <Button type="submit" className="w-full h-12 text-sm font-semibold" disabled={loading} style={{ background: 'hsl(350 75% 40%)', color: 'white' }}>
                  {loading ? <span className="flex items-center gap-2"><Spinner />Accediendo...</span> : <span className="flex items-center gap-2">Acceder al portal <ArrowRight className="w-4 h-4" /></span>}
                </Button>

                <button type="button" onClick={() => { setMode('forgot'); resetErrors(); }} className="w-full text-center text-sm text-muted-foreground hover:text-primary transition-colors py-1">
                  ¿Olvidaste tu contraseña?
                </button>
              </form>

              {/* Separador */}
              <div className="my-6 flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">¿Aún no tienes cuenta?</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <button
                type="button"
                onClick={() => { setMode('register'); resetErrors(); }}
                className="w-full h-12 rounded-lg border-2 border-taxea-red/30 hover:border-taxea-red/60 text-taxea-red hover:bg-taxea-red/5 font-semibold text-sm transition-all flex items-center justify-center gap-2"
              >
                <Users className="w-4 h-4" />
                Crear acceso al portal
              </button>
              <p className="text-center text-xs text-muted-foreground mt-2">Solicita tu acceso a Taxea Portal</p>
            </div>
          )}

          {/* ── REGISTRO ── */}
          {mode === 'register' && (
            <div className="animate-fade-in">
              <button onClick={() => { setMode('login'); resetErrors(); }} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
                <ChevronLeft className="w-4 h-4" /> Volver al acceso
              </button>
              <div className="mb-7">
                <div className="inline-flex items-center gap-2 bg-taxea-red/8 border border-taxea-red/15 rounded-full px-3 py-1 mb-4">
                  <Sparkles className="w-3 h-3 text-taxea-red" />
                  <span className="text-xs text-taxea-red font-medium">Nuevo acceso</span>
                </div>
                <h1 className="text-2xl font-jakarta font-bold text-foreground">Crear cuenta</h1>
                <p className="text-muted-foreground mt-1 text-sm">Accede al portal fiscal de Taxea Strategies</p>
              </div>

              <form onSubmit={handleRegister} className="space-y-3.5">
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Nombre y apellidos *</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input type="text" placeholder="Ana García Martínez" value={regNombre} onChange={e => setRegNombre(e.target.value)} required className="h-11 pl-10 text-sm" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Correo electrónico *</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input type="email" placeholder="tu@email.com" value={regEmail} onChange={e => setRegEmail(e.target.value)} required className="h-11 pl-10 text-sm" />
                  </div>
                </div>

                {/* Teléfono opcional con incentivo */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    Teléfono <span className="text-xs text-muted-foreground font-normal">(opcional)</span>
                  </Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input type="tel" placeholder="+34 600 000 000" value={regTel} onChange={e => setRegTel(e.target.value)} className="h-11 pl-10 text-sm" />
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Bell className="w-3 h-3 text-taxea-red flex-shrink-0" />
                    Añádelo para recibir avisos fiscales importantes y soporte más rápido
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Contraseña *</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input type={showRegPass ? 'text' : 'password'} placeholder="Mínimo 8 caracteres" value={regPass} onChange={e => setRegPass(e.target.value)} required className="h-11 pl-10 pr-11 text-sm" />
                    <button type="button" onClick={() => setShowRegPass(!showRegPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1">
                      {showRegPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {regPass.length > 0 && regPass.length < 8 && (
                    <p className="text-xs text-destructive">Mínimo 8 caracteres</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Confirmar contraseña *</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input type="password" placeholder="Repite la contraseña" value={regPassConf} onChange={e => setRegPassConf(e.target.value)} required className="h-11 pl-10 text-sm" />
                  </div>
                  {regPassConf.length > 0 && regPass !== regPassConf && (
                    <p className="text-xs text-destructive">Las contraseñas no coinciden</p>
                  )}
                </div>

                {/* RGPD */}
                <div className="bg-secondary/50 rounded-xl p-4 space-y-3 mt-2">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input type="checkbox" checked={rgpdMain} onChange={e => setRgpdMain(e.target.checked)} className="mt-0.5 w-4 h-4 rounded accent-taxea-red flex-shrink-0" />
                    <span className="text-xs text-muted-foreground leading-snug">
                      He leído y acepto la <span className="text-primary underline cursor-pointer">política de privacidad</span> y el tratamiento de mis datos por Taxea Strategies. <span className="text-destructive font-medium">*</span>
                    </span>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input type="checkbox" checked={rgpdComms} onChange={e => setRgpdComms(e.target.checked)} className="mt-0.5 w-4 h-4 rounded accent-taxea-red flex-shrink-0" />
                    <span className="text-xs text-muted-foreground leading-snug">
                      Deseo recibir avisos fiscales, novedades y comunicaciones de Taxea Strategies
                    </span>
                  </label>
                </div>

                {error && <ErrorBox message={error} />}

                <Button type="submit" className="w-full h-12 text-sm font-semibold mt-1" disabled={loading || !rgpdMain} style={{ background: !rgpdMain ? undefined : 'hsl(350 75% 40%)', color: 'white' }}>
                  {loading ? <span className="flex items-center gap-2"><Spinner />Creando cuenta...</span> : <span className="flex items-center gap-2">Crear mi acceso <ArrowRight className="w-4 h-4" /></span>}
                </Button>
              </form>
            </div>
          )}

          {/* ── OTP ── */}
          {mode === 'otp' && (
            <div className="animate-fade-in">
              <div className="mb-8">
                <div className="w-16 h-16 rounded-2xl bg-taxea-red/10 border border-taxea-red/20 flex items-center justify-center mb-5">
                  <Mail className="w-8 h-8 text-taxea-red" />
                </div>
                <h1 className="text-2xl font-jakarta font-bold text-foreground">Verifica tu correo</h1>
                <p className="text-muted-foreground mt-1.5 text-sm">
                  Hemos enviado un código de verificación a <strong>{regEmail}</strong>
                </p>
              </div>
              <form onSubmit={handleOtp} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Código de verificación</Label>
                  <Input
                    type="text"
                    placeholder="Introduce el código de 6 dígitos"
                    value={otpCode}
                    onChange={e => setOtpCode(e.target.value)}
                    required
                    className="h-12 text-center text-lg tracking-widest font-mono"
                    maxLength={6}
                  />
                </div>
                {error && <ErrorBox message={error} />}
                <Button type="submit" className="w-full h-12 text-sm font-semibold" disabled={loading} style={{ background: 'hsl(350 75% 40%)', color: 'white' }}>
                  {loading ? <span className="flex items-center gap-2"><Spinner />Verificando...</span> : 'Verificar y acceder'}
                </Button>
                <button type="button" onClick={handleResendOtp} className="w-full text-center text-sm text-muted-foreground hover:text-primary transition-colors">
                  ¿No recibiste el código? Reenviar
                </button>
              </form>
            </div>
          )}

          {/* ── SUCCESS ── */}
          {mode === 'success' && (
            <div className="animate-fade-in text-center">
              <div className="w-20 h-20 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-10 h-10 text-green-500" />
              </div>
              <div className="mb-2 inline-flex items-center gap-2 bg-taxea-red/8 border border-taxea-red/15 rounded-full px-3 py-1">
                <Sparkles className="w-3 h-3 text-taxea-red" />
                <span className="text-xs text-taxea-red font-medium">¡Bienvenido a Taxea!</span>
              </div>
              <h1 className="text-2xl font-jakarta font-bold text-foreground mt-3 mb-2">Acceso creado correctamente</h1>
              <p className="text-muted-foreground text-sm mb-8 leading-relaxed">
                Tu cuenta en Taxea Portal ha sido activada. Un asesor revisará tu acceso y se pondrá en contacto contigo en breve.
              </p>
              <div className="space-y-3">
                <Button
                  onClick={() => { window.location.href = '/'; }}
                  className="w-full h-12 text-sm font-semibold"
                  style={{ background: 'hsl(350 75% 40%)', color: 'white' }}
                >
                  Acceder al portal <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
                <a
                  href="mailto:info@taxea.es"
                  className="w-full h-12 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-all flex items-center justify-center gap-2"
                >
                  <Mail className="w-4 h-4" /> Contactar con Taxea
                </a>
              </div>
            </div>
          )}

          {/* ── FORGOT ── */}
          {mode === 'forgot' && (
            <div className="animate-fade-in">
              <button onClick={() => { setMode('login'); resetErrors(); setForgotSent(false); }} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
                <ChevronLeft className="w-4 h-4" /> Volver al acceso
              </button>
              <div className="mb-7">
                <div className="w-14 h-14 rounded-xl bg-taxea-red/10 border border-taxea-red/20 flex items-center justify-center mb-5">
                  <Lock className="w-7 h-7 text-taxea-red" />
                </div>
                <h1 className="text-2xl font-jakarta font-bold text-foreground">Recuperar contraseña</h1>
                <p className="text-muted-foreground mt-1.5 text-sm">Introduce tu correo y te enviaremos un enlace seguro</p>
              </div>
              {forgotSent ? (
                <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800/30 rounded-xl p-6 text-center">
                  <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-3" />
                  <p className="font-semibold text-foreground text-sm">Correo enviado</p>
                  <p className="text-sm text-muted-foreground mt-1">Si el correo existe en nuestro sistema, recibirás instrucciones en tu bandeja de entrada</p>
                  <button onClick={() => { setMode('login'); setForgotSent(false); resetErrors(); }} className="mt-5 text-sm text-taxea-red hover:underline font-medium">
                    Volver al acceso
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgot} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Correo electrónico</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                      <Input type="email" placeholder="tu@email.com" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} required className="h-12 pl-10 text-sm" />
                    </div>
                  </div>
                  <Button type="submit" className="w-full h-12 text-sm font-semibold" disabled={loading} style={{ background: 'hsl(350 75% 40%)', color: 'white' }}>
                    {loading ? <span className="flex items-center gap-2"><Spinner />Enviando...</span> : 'Enviar enlace de recuperación'}
                  </Button>
                </form>
              )}
            </div>
          )}

          {/* Footer */}
          <p className="text-xs text-muted-foreground text-center mt-10">
            Portal privado · Cifrado SSL · Cumplimiento RGPD<br />© {new Date().getFullYear()} Taxea Strategies
          </p>
        </div>
      </div>
    </div>
  );
}

// Micro-componentes
function ErrorBox({ message }) {
  return (
    <div className="bg-destructive/8 border border-destructive/20 text-destructive text-sm px-4 py-3 rounded-lg flex items-start gap-2">
      <span className="flex-shrink-0 mt-0.5">⚠</span>
      <span>{message}</span>
    </div>
  );
}

function Spinner() {
  return <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />;
}