import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Shield, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('login'); // login | forgot
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
    try {
      await base44.auth.resetPasswordRequest(email);
    } catch {}
    setForgotSent(true);
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex">
      {/* Panel izquierdo - imagen/branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-sidebar flex-col justify-between p-12 relative overflow-hidden">
        {/* Decoración */}
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-teal/10 -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-96 h-96 rounded-full bg-teal/5 translate-y-1/2 -translate-x-1/2" />

        <div className="relative">
          <div className="flex items-center gap-3 mb-16">
            <div className="w-10 h-10 rounded-xl bg-teal flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-white font-jakarta font-bold text-lg leading-none">Taxea Portal</p>
              <p className="text-white/40 text-xs mt-0.5">Strategies</p>
            </div>
          </div>

          <h2 className="text-white font-jakarta text-4xl font-bold leading-tight mb-6">
            Tu área privada<br />
            <span className="text-teal">fiscal y contable.</span>
          </h2>

          <p className="text-white/50 text-lg leading-relaxed max-w-sm">
            Gestiona tus facturas, obligaciones fiscales y documentación con la tranquilidad de tener a tu asesor siempre disponible.
          </p>
        </div>

        <div className="relative space-y-4">
          {['Documentación 100% segura y privada', 'Gestión fiscal en tiempo real', 'Comunicación directa con tu asesor'].map((item) => (
            <div key={item} className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full bg-teal/30 border border-teal flex items-center justify-center flex-shrink-0">
                <div className="w-2 h-2 rounded-full bg-teal" />
              </div>
              <p className="text-white/60 text-sm">{item}</p>
            </div>
          ))}
          <p className="text-white/20 text-xs mt-6 pt-6 border-t border-white/10">
            Portal privado y confidencial. Cumplimiento RGPD.
          </p>
        </div>
      </div>

      {/* Panel derecho - formulario */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 bg-background">
        <div className="w-full max-w-md">
          {/* Logo mobile */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-9 h-9 rounded-xl bg-teal flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="font-jakarta font-bold text-lg text-foreground leading-none">Taxea Portal</p>
              <p className="text-muted-foreground text-xs">Strategies</p>
            </div>
          </div>

          {mode === 'login' ? (
            <>
              <div className="mb-8">
                <h1 className="text-2xl font-jakarta font-bold text-foreground">Iniciar sesión</h1>
                <p className="text-muted-foreground mt-1.5">Accede a tu área privada de cliente</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Correo electrónico</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="tu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Contraseña</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPass ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="h-11 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm px-4 py-3 rounded-lg">
                    {error}
                  </div>
                )}

                <Button type="submit" className="w-full h-11 bg-teal hover:bg-teal-dark" disabled={loading}>
                  {loading ? 'Accediendo...' : (
                    <span className="flex items-center gap-2">
                      Acceder al portal
                      <ArrowRight className="w-4 h-4" />
                    </span>
                  )}
                </Button>

                <button
                  type="button"
                  onClick={() => setMode('forgot')}
                  className="w-full text-center text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="mb-8">
                <h1 className="text-2xl font-jakarta font-bold text-foreground">Recuperar contraseña</h1>
                <p className="text-muted-foreground mt-1.5">Te enviaremos un enlace de recuperación</p>
              </div>

              {forgotSent ? (
                <div className="bg-teal/10 border border-teal/20 rounded-xl p-6 text-center">
                  <div className="w-12 h-12 bg-teal/20 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Shield className="w-6 h-6 text-teal" />
                  </div>
                  <p className="font-medium text-foreground">Correo enviado</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Si el correo está registrado, recibirás las instrucciones en breve.
                  </p>
                  <button
                    onClick={() => { setMode('login'); setForgotSent(false); }}
                    className="mt-4 text-sm text-teal hover:underline"
                  >
                    Volver al login
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgot} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email-forgot">Correo electrónico</Label>
                    <Input
                      id="email-forgot"
                      type="email"
                      placeholder="tu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="h-11"
                    />
                  </div>
                  <Button type="submit" className="w-full h-11 bg-teal hover:bg-teal-dark" disabled={loading}>
                    {loading ? 'Enviando...' : 'Enviar enlace'}
                  </Button>
                  <button
                    type="button"
                    onClick={() => setMode('login')}
                    className="w-full text-center text-sm text-muted-foreground hover:text-primary"
                  >
                    ← Volver al login
                  </button>
                </form>
              )}
            </>
          )}

          <p className="text-xs text-muted-foreground text-center mt-8">
            Portal privado y confidencial · Protección de datos RGPD<br />
            © {new Date().getFullYear()} Taxea Strategies. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </div>
  );
}