import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Eye, EyeOff, ArrowRight, Shield, FileText, Brain, Bell, Users, ChevronLeft, Mail, Lock, CheckCircle2, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Link } from 'react-router-dom';

const FEATURES = [
  { icon: FileText, text: 'Documentación 100% privada y segura' },
  { icon: Brain,    text: 'IA que lee y clasifica tus facturas' },
  { icon: Bell,     text: 'Seguimiento fiscal en tiempo real' },
  { icon: Users,    text: 'Comunicación directa con tu asesor' },
  { icon: Shield,   text: 'Control centralizado de tu negocio' },
];

function TaxeaLogoBlancoSVG() {
  return (
    <svg width="260" height="90" viewBox="0 0 260 90" fill="none" xmlns="http://www.w3.org/2000/svg">
      <text x="130" y="48" textAnchor="middle" fontFamily="Georgia, 'Times New Roman', serif" fontWeight="700" fontSize="46" letterSpacing="4" fill="white">TAXEA</text>
      <text x="130" y="66" textAnchor="middle" fontFamily="Georgia, 'Times New Roman', serif" fontWeight="400" fontSize="13" letterSpacing="6" fill="rgba(255,255,255,0.85)">STRATEGIES</text>
      <path d="M30 79 Q90 70 130 76 Q170 82 230 72" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

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
          <div className="mb-6"><TaxeaLogoBlancoSVG /></div>
          <div className="flex items-center gap-3">
            <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg, rgba(184,37,53,0.5), transparent)' }} />
            <span className="text-xs font-medium tracking-[0.2em] uppercase" style={{ color: 'rgba(184,37,53,0.9)' }}>Portal Privado</span>
            <div className="h-px flex-1" style={{ background: 'linear-gradient(270deg, rgba(184,37,53,0.5), transparent)' }} />
          </div>
        </div>
        <h2 className="text-white font-jakarta text-4xl font-bold leading-tight mb-5 tracking-tight">
          Solicita acceso<br /><span style={{ color: '#c9303f' }}>a tu portal fiscal.</span>
        </h2>
        <p className="text-sm leading-relaxed max-w-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
          Crea tu cuenta en el portal privado de Taxea Strategies. Tras registrarte, un asesor revisará tu solicitud y activará tu acceso completo.
        </p>
      </div>

      <div className="relative z-10 space-y-2.5">
        {FEATURES.map(({ icon: Icon, text }) => (
          <div key={text} className="flex items-center gap-3 group">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
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

export default function Register() {
  const [step, setStep] = useState('form'); // form | otp | done
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [resending, setResending] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) { setError('Las contraseñas no coinciden.'); return; }
    if (password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres.'); return; }
    setLoading(true);
    try {
      await base44.auth.register({ email, password, full_name: fullName });
      setStep('otp');
    } catch (err) {
      setError(err.message || 'Error al crear la cuenta. Comprueba los datos.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await base44.auth.verifyOtp({ email, otpCode });
      base44.auth.setToken(res.access_token);
      window.location.href = '/';
    } catch (err) {
      setError(err.message || 'Código incorrecto. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setResending(true);
    try { await base44.auth.resendOtp(email); } catch {}
    setResending(false);
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

          {/* FORM */}
          {step === 'form' && (
            <div className="animate-fade-in">
              <div className="mb-8">
                <div className="inline-flex items-center gap-2 bg-taxea-red/8 border border-taxea-red/15 rounded-full px-3 py-1 mb-4">
                  <Shield className="w-3 h-3 text-taxea-red" />
                  <span className="text-xs text-taxea-red font-medium">Solicitud de acceso</span>
                </div>
                <h1 className="text-3xl font-jakarta font-bold text-foreground">Crear cuenta</h1>
                <p className="text-muted-foreground mt-1.5 text-sm">Completa el formulario para solicitar acceso al portal</p>
              </div>

              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="fullName" className="text-sm font-medium">Nombre completo</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input id="fullName" type="text" placeholder="Tu nombre y apellidos" value={fullName} onChange={e => setFullName(e.target.value)} required className="h-12 pl-10 text-sm" />
                  </div>
                </div>
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
                    <Input id="password" type={showPass ? 'text' : 'password'} placeholder="Mínimo 8 caracteres" value={password} onChange={e => setPassword(e.target.value)} required className="h-12 pl-10 pr-11 text-sm" />
                    <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1">
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword" className="text-sm font-medium">Confirmar contraseña</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input id="confirmPassword" type={showPass ? 'text' : 'password'} placeholder="Repite la contraseña" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required className="h-12 pl-10 text-sm" />
                  </div>
                </div>

                {error && <ErrorBox message={error} />}

                <Button type="submit" className="w-full h-12 text-sm font-semibold" disabled={loading} style={{ background: 'hsl(350 75% 40%)', color: 'white' }}>
                  {loading
                    ? <span className="flex items-center gap-2"><Spinner />Creando cuenta...</span>
                    : <span className="flex items-center gap-2">Solicitar acceso <ArrowRight className="w-4 h-4" /></span>}
                </Button>
              </form>

              <div className="mt-5 text-center">
                <span className="text-sm text-muted-foreground">¿Ya tienes cuenta? </span>
                <Link to="/login" className="text-sm text-taxea-red hover:underline font-medium">Iniciar sesión</Link>
              </div>

              <div className="mt-5 bg-secondary/60 border border-border rounded-xl p-4">
                <p className="text-xs text-muted-foreground text-center leading-relaxed">
                  Tras registrarte, un asesor de Taxea revisará tu solicitud.<br />
                  <span className="text-foreground/60">El acceso completo se activa manualmente por el equipo.</span>
                </p>
              </div>
            </div>
          )}

          {/* OTP */}
          {step === 'otp' && (
            <div className="animate-fade-in">
              <button onClick={() => { setStep('form'); setError(''); }}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
                <ChevronLeft className="w-4 h-4" /> Volver
              </button>
              <div className="mb-7">
                <div className="w-14 h-14 rounded-xl bg-taxea-red/10 border border-taxea-red/20 flex items-center justify-center mb-5">
                  <Mail className="w-7 h-7 text-taxea-red" />
                </div>
                <h1 className="text-2xl font-jakarta font-bold text-foreground">Verifica tu email</h1>
                <p className="text-muted-foreground mt-1.5 text-sm">
                  Hemos enviado un código a <strong>{email}</strong>. Introdúcelo para continuar.
                </p>
              </div>
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Código de verificación</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="123456"
                    value={otpCode}
                    onChange={e => setOtpCode(e.target.value)}
                    required
                    maxLength={8}
                    className="h-12 text-center text-lg tracking-widest"
                  />
                </div>
                {error && <ErrorBox message={error} />}
                <Button type="submit" className="w-full h-12 text-sm font-semibold" disabled={loading} style={{ background: 'hsl(350 75% 40%)', color: 'white' }}>
                  {loading ? <span className="flex items-center gap-2"><Spinner />Verificando...</span> : 'Verificar y acceder'}
                </Button>
              </form>
              <button onClick={handleResendOtp} disabled={resending}
                className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-primary transition-colors py-1 disabled:opacity-50">
                {resending ? 'Reenviando...' : '¿No recibiste el código? Reenviar'}
              </button>
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