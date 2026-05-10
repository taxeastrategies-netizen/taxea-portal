import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Eye, EyeOff, ArrowRight, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('login');
  const [forgotSent, setForgotSent] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await base44.auth.loginViaEmailPassword(email, password);
      window.location.href = '/';
    } catch (err) {
      setError(err.message || 'Credenciales incorrectas. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    setLoading(true);
    try { await base44.auth.resetPasswordRequest(email); } catch {}
    setForgotSent(true);
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Panel izquierdo — branding Taxea */}
      <div className="hidden lg:flex lg:w-5/12 flex-col justify-between p-12 relative overflow-hidden" style={{ backgroundColor: '#1a1a1a' }}>
        {/* Elementos decorativos */}
        <div className="absolute top-0 right-0 w-80 h-80 rounded-full bg-taxea-red/5 -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-96 h-96 rounded-full bg-taxea-red/3 translate-y-1/3 -translate-x-1/3" />

        <div className="relative">
          {/* Logo */}
          <div className="mb-12">
            <img
              src="https://media.base44.com/images/public/6a00fec50cc522a74ddde4b2/8e45ad4fc_file_00000000a33871f499fac1209cc581e2.png"
              alt="Taxea Strategies"
              className="h-20 w-auto object-contain brightness-0 invert"
            />
          </div>

          <h2 className="text-white font-jakarta text-3xl font-bold leading-tight mb-4">
            Tu área privada<br />
            <span className="text-taxea-red">fiscal y contable.</span>
          </h2>
          <p className="text-white/50 text-base leading-relaxed max-w-sm">
            Portal exclusivo para clientes de Taxea Strategies. Gestiona tu documentación, obligaciones fiscales y comunícate con tu asesor en un entorno seguro.
          </p>
        </div>

        <div className="relative space-y-3">
          {[
            'Documentación 100% segura y privada',
            'IA que lee y clasifica tus facturas',
            'Comunicación directa con tu asesor',
            'Seguimiento de obligaciones fiscales',
          ].map((item) => (
            <div key={item} className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full bg-taxea-red/20 border border-taxea-red flex items-center justify-center flex-shrink-0">
                <div className="w-2 h-2 rounded-full bg-taxea-red" />
              </div>
              <p className="text-white/60 text-sm">{item}</p>
            </div>
          ))}
          <p className="text-white/20 text-xs mt-6 pt-5 border-t border-white/10">
            Portal privado y confidencial · Cumplimiento RGPD · © {new Date().getFullYear()} Taxea Strategies
          </p>
        </div>
      </div>

      {/* Panel derecho — formulario */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          {/* Logo mobile */}
          <div className="lg:hidden mb-8">
            <img
              src="https://media.base44.com/images/public/6a00fec50cc522a74ddde4b2/8e45ad4fc_file_00000000a33871f499fac1209cc581e2.png"
              alt="Taxea Strategies"
              className="h-12 w-auto object-contain"
            />
          </div>

          {mode === 'login' ? (
            <>
              <div className="mb-7">
                <h1 className="text-2xl font-jakarta font-bold text-foreground">Iniciar sesión</h1>
                <p className="text-muted-foreground mt-1">Accede a tu área privada de cliente</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Correo electrónico</Label>
                  <Input id="email" type="email" placeholder="tu@email.com" value={email} onChange={e => setEmail(e.target.value)} required className="h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Contraseña</Label>
                  <div className="relative">
                    <Input id="password" type={showPass ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required className="h-11 pr-10" />
                    <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm px-4 py-3 rounded-lg">{error}</div>
                )}

                <Button type="submit" className="w-full h-11 bg-taxea-red hover:bg-taxea-accent text-white" disabled={loading}>
                  {loading ? 'Accediendo...' : (
                    <span className="flex items-center gap-2">Acceder al portal <ArrowRight className="w-4 h-4" /></span>
                  )}
                </Button>

                <button type="button" onClick={() => setMode('forgot')} className="w-full text-center text-sm text-muted-foreground hover:text-primary transition-colors">
                  ¿Olvidaste tu contraseña?
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="mb-7">
                <h1 className="text-2xl font-jakarta font-bold text-foreground">Recuperar contraseña</h1>
                <p className="text-muted-foreground mt-1">Te enviaremos un enlace de recuperación</p>
              </div>
              {forgotSent ? (
                <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
                  <Shield className="w-10 h-10 text-green-500 mx-auto mb-3" />
                  <p className="font-semibold text-foreground">Correo enviado</p>
                  <p className="text-sm text-muted-foreground mt-1">Revisa tu bandeja de entrada</p>
                  <button onClick={() => { setMode('login'); setForgotSent(false); }} className="mt-4 text-sm text-taxea-red hover:underline">
                    Volver al login
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgot} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Correo electrónico</Label>
                    <Input type="email" placeholder="tu@email.com" value={email} onChange={e => setEmail(e.target.value)} required className="h-11" />
                  </div>
                  <Button type="submit" className="w-full h-11 bg-taxea-red hover:bg-taxea-accent text-white" disabled={loading}>
                    {loading ? 'Enviando...' : 'Enviar enlace'}
                  </Button>
                  <button type="button" onClick={() => setMode('login')} className="w-full text-center text-sm text-muted-foreground hover:text-primary">
                    ← Volver al login
                  </button>
                </form>
              )}
            </>
          )}

          <p className="text-xs text-muted-foreground text-center mt-8">
            Portal privado · Protección de datos RGPD<br />
            © {new Date().getFullYear()} Taxea Strategies
          </p>
        </div>
      </div>
    </div>
  );
}