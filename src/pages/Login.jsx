import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Eye, EyeOff, ArrowRight, Shield, CheckCircle2, FileText, Brain, Bell, Users, ChevronLeft, Mail, Lock, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TaxeaIsotipo } from '@/components/brand/TaxeaLogo';

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
      style={{ background: 'linear-gradient(160deg, #0f0f0f 0%, #1a0608 100%)' }}
    >
      <div className="absolute top-0 right-0 w-[480px] h-[480px] pointer-events-none"
        style={{ background: 'radial-gradient(circle at 80% 20%, rgba(184,37,53,0.12) 0%, transparent 65%)' }} />
      <div className="absolute bottom-0 left-0 w-[360px] h-[360px] pointer-events-none"
        style={{ background: 'radial-gradient(circle at 20% 90%, rgba(184,37,53,0.07) 0%, transparent 65%)' }} />
      <div className="absolute top-0 right-0 w-px h-full bg-gradient-to-b from-transparent via-white/5 to-transparent pointer-events-none" />

      <div className="relative z-10">
        <div className="mb-10">
          <div className="mb-6">
            <TaxeaLogoBlancoSVG />
          </div>
          <div className="flex items-center gap-3">
            <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg, rgba(184,37,53,0.5), transparent)' }} />
            <span className="text-xs font-medium tracking-[0.2em] uppercase" style={{ color: 'rgba(184,37,53,0.9)' }}>Portal Privado</span>
            <div className="h-px flex-1" style={{ background: 'linear-gradient(270deg, rgba(184,37,53,0.5), transparent)' }} />
          </div>
        </div>
        <h2 className="text-white font-jakarta text-4xl font-bold leading-tight mb-5 tracking-tight">
          Tu área privada<br /><span style={{ color: '#c9303f' }}>fiscal y contable.</span>
        </h2>
        <p className="text-sm leading-relaxed max-w-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
          Portal exclusivo para clientes de Taxea Strategies. Gestiona tu documentación, obligaciones fiscales y comunicación con tu asesor desde un entorno privado, seguro e inteligente.
        </p>
      </div>

      <div className="relative z-10 space-y-2.5">
        {FEATURES.map(({ icon: Icon, text }) => (
          <div key={text} className="flex items-center gap-3 group">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-200 group-hover:scale-105"
              style={{ background: 'rgba(184,37,53,0.12)', border: '1px solid rgba(184,37,53,0.25)' }}>
              <Icon className="w-3.5 h-3.5" style={{ color: '#c9303f' }} />
            </div>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>{text}</p>
          </div>
        ))}
        <div className="pt-5 mt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.18)' }}>
            Portal privado · Cifrado SSL · Cumplimiento RGPD · © {new Date().getFullYear()} Taxea Strategies
          </p>
        </div>
      </div>
    </div>
  );
}

function TaxeaLogoBlancoSVG() {
  return (
    <svg width="260" height="90" viewBox="0 0 260 90" fill="none" xmlns="http://www.w3.org/2000/svg">
      <text x="130" y="48" textAnchor="middle" fontFamily="Georgia, 'Times New Roman', serif" fontWeight="700" fontSize="46" letterSpacing="4" fill="white">TAXEA</text>
      <text x="130" y="66" textAnchor="middle" fontFamily="Georgia, 'Times New Roman', serif" fontWeight="400" fontSize="13" letterSpacing="6" fill="rgba(255,255,255,0.85)">STRATEGIES</text>
      <path d="M30 79 Q90 70 130 76 Q170 82 230 72" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export default function Login() {
  const [mode, setMode] = useState('login'); // login | forgot
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);

  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);

  const resetErrors = () => setError('');

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

      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 bg-background">
        <div className="w-full max-w-md">

          {/* Logo mobile */}
          <div className="lg:hidden mb-8">
            <img
              src="https://media.base44.com/images/public/6a00fec50cc522a74ddde4b2/35e9bbe29_IMG_20260111_164937_14712.webp"
              alt="Taxea Strategies"
              style={{ height: 44, width: 'auto', objectFit: 'contain', display: 'block' }}
            />
          </div>

          {/* LOGIN */}
          {mode === 'login' && (
            <div className="animate-fade-in">
              <div className="mb-8">
                <div className="inline-flex items-center gap-2 bg-taxea-red/8 border border-taxea-red/15 rounded-full px-3 py-1 mb-4">
                  <Shield className="w-3 h-3 text-taxea-red" />
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
                  {loading
                    ? <span className="flex items-center gap-2"><Spinner />Accediendo...</span>
                    : <span className="flex items-center gap-2">Acceder al portal <ArrowRight className="w-4 h-4" /></span>}
                </Button>

                <button type="button" onClick={() => { setMode('forgot'); resetErrors(); }}
                  className="w-full text-center text-sm text-muted-foreground hover:text-primary transition-colors py-1">
                  ¿Olvidaste tu contraseña?
                </button>
              </form>

              {/* Aviso acceso exclusivo — NO hay registro público */}
              <div className="mt-6 bg-secondary/60 border border-border rounded-xl p-4">
                <p className="text-xs text-muted-foreground text-center leading-relaxed">
                  Acceso exclusivo para clientes de Taxea con cuenta activa.<br />
                  <span className="text-foreground/60">Si eres cliente y no tienes acceso, contacta con tu asesor.</span>
                </p>
              </div>
            </div>
          )}

          {/* FORGOT */}
          {mode === 'forgot' && (
            <div className="animate-fade-in">
              <button onClick={() => { setMode('login'); resetErrors(); setForgotSent(false); }}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
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
                <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
                  <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-3" />
                  <p className="font-semibold text-foreground text-sm">Solicitud enviada</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Si el correo corresponde a una cuenta activa, recibirás instrucciones para recuperar el acceso.
                  </p>
                  <button onClick={() => { setMode('login'); setForgotSent(false); resetErrors(); }}
                    className="mt-5 text-sm text-taxea-red hover:underline font-medium">
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

          <p className="text-xs text-muted-foreground text-center mt-10">
            Portal privado · Cifrado SSL · Cumplimiento RGPD<br />© {new Date().getFullYear()} Taxea Strategies
          </p>
        </div>
      </div>
    </div>
  );
}

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