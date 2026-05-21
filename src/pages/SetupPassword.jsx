import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckCircle, Mail, Lock, ArrowRight } from 'lucide-react';

export default function SetupPassword() {
  const [step, setStep] = useState('form'); // 'form' | 'sent'
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError('');
    try {
      await base44.auth.resetPasswordRequest(email.trim());
      setStep('sent');
    } catch {
      setError('No encontramos ese correo. Verifica que sea el mismo con el que te registramos.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <img
            src="https://media.base44.com/images/public/6a00fec50cc522a74ddde4b2/b059a58db_ChatGPTImage7may202610_56_53pm.png"
            alt="Taxea Strategies"
            className="h-20 object-contain"
          />
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-8">
          {step === 'form' ? (
            <>
              <div className="text-center mb-6">
                <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Lock className="w-6 h-6 text-taxea-red" />
                </div>
                <h1 className="text-2xl font-jakarta font-bold text-slate-800 mb-2">
                  Establece tu contraseña
                </h1>
                <p className="text-slate-500 text-sm leading-relaxed">
                  Introduce tu correo electrónico y te enviaremos un enlace seguro para crear tu contraseña de acceso al portal.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Correo electrónico
                  </label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@email.com"
                    required
                    className="h-11"
                    autoFocus
                  />
                </div>

                {error && (
                  <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
                )}

                <Button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className="w-full h-11 bg-taxea-red hover:bg-taxea-red-dark gap-2"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>Enviar enlace de acceso <ArrowRight className="w-4 h-4" /></>
                  )}
                </Button>
              </form>

              <p className="text-center text-xs text-slate-400 mt-6">
                ¿Problemas para acceder? Contacta con{' '}
                <a href="mailto:info@taxeastrategies.com" className="text-taxea-red hover:underline">
                  info@taxeastrategies.com
                </a>
              </p>
            </>
          ) : (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-xl font-jakarta font-bold text-slate-800 mb-2">
                ¡Correo enviado!
              </h2>
              <p className="text-slate-500 text-sm leading-relaxed mb-6">
                Hemos enviado un enlace seguro a <strong className="text-slate-700">{email}</strong>.
                Revisa tu bandeja de entrada (y la carpeta de spam) y haz clic en el enlace para crear tu contraseña.
              </p>
              <div className="bg-slate-50 rounded-xl p-4 text-left space-y-2 mb-6">
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Próximos pasos:</p>
                <div className="flex items-start gap-2 text-sm text-slate-500">
                  <Mail className="w-4 h-4 text-taxea-red mt-0.5 flex-shrink-0" />
                  <span>Abre el email de Taxea Strategies y haz clic en el enlace</span>
                </div>
                <div className="flex items-start gap-2 text-sm text-slate-500">
                  <Lock className="w-4 h-4 text-taxea-red mt-0.5 flex-shrink-0" />
                  <span>Elige una contraseña segura</span>
                </div>
                <div className="flex items-start gap-2 text-sm text-slate-500">
                  <CheckCircle className="w-4 h-4 text-taxea-red mt-0.5 flex-shrink-0" />
                  <span>Accede al portal con tu email y contraseña</span>
                </div>
              </div>
              <a href="/login" className="text-sm text-taxea-red hover:underline">
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