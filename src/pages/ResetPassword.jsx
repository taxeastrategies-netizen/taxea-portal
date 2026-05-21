import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckCircle, Lock, Eye, EyeOff, AlertTriangle } from 'lucide-react';

export default function ResetPassword() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-8 w-full max-w-md text-center space-y-4">
          <AlertTriangle className="w-10 h-10 text-red-500 mx-auto" />
          <h1 className="text-xl font-jakarta font-bold text-slate-800">Enlace no válido</h1>
          <p className="text-slate-500 text-sm">El enlace de restablecimiento no es válido o ha expirado.</p>
          <a href="/setup-password" className="block text-sm text-taxea-red hover:underline">Solicitar nuevo enlace →</a>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres.'); return; }
    if (password !== confirm) { setError('Las contraseñas no coinciden.'); return; }
    setLoading(true);
    try {
      await base44.auth.resetPassword({ resetToken: token, newPassword: password });
      setDone(true);
    } catch (e) {
      setError(e.message || 'Error al establecer la contraseña. El enlace puede haber expirado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <img
            src="https://media.base44.com/images/public/6a00fec50cc522a74ddde4b2/b059a58db_ChatGPTImage7may202610_56_53pm.png"
            alt="Taxea Strategies"
            className="h-16 object-contain"
          />
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-8">
          {done ? (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-xl font-jakarta font-bold text-slate-800">¡Contraseña establecida!</h2>
              <p className="text-slate-500 text-sm">Ya puedes acceder al portal con tu nueva contraseña.</p>
              <Button onClick={() => { window.location.href = '/login'; }} className="w-full bg-taxea-red hover:bg-taxea-red-dark">
                Ir al portal →
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="text-center mb-2">
                <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Lock className="w-6 h-6 text-taxea-red" />
                </div>
                <h1 className="text-xl font-jakarta font-bold text-slate-800 mb-2">Crea tu contraseña</h1>
                <p className="text-slate-500 text-sm">Elige una contraseña segura para acceder al portal.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Nueva contraseña</label>
                <div className="relative">
                  <Input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    required
                    className="h-11 pr-10"
                    autoFocus
                  />
                  <button type="button" onClick={() => setShowPass(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirmar contraseña</label>
                <div className="relative">
                  <Input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="Repite la contraseña"
                    required
                    className="h-11 pr-10"
                  />
                  <button type="button" onClick={() => setShowConfirm(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
              )}

              <Button type="submit" disabled={loading || !password || !confirm} className="w-full h-11 bg-taxea-red hover:bg-taxea-red-dark">
                {loading
                  ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : 'Establecer contraseña'
                }
              </Button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          © 2025 Taxea Strategies · Portal de Clientes
        </p>
      </div>
    </div>
  );
}