import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { CompanyRegistration } from './CompanyRegistration';
import { LogIn } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export function LoginForm() {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [showCompanyRegistration, setShowCompanyRegistration] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [showResendEmail, setShowResendEmail] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const { signIn, signUp, resetPassword } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (isForgotPassword) {
        const { error } = await resetPassword(email);
        if (error) throw error;
        setSuccess('Se ha enviado un correo para restablecer tu contraseña. Revisa tu bandeja de entrada.');
        setEmail('');
      } else if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          // Si el error es "Email not confirmed", ofrecer reenviar el email
          if (error.message?.includes('Email not confirmed') || error.message?.includes('email not confirmed')) {
            setError('Tu email no ha sido confirmado. Puedes: 1) Hacer clic en el botón de abajo para reenviar el email, o 2) Confirmar el email manualmente desde el Dashboard de Supabase (Authentication → Users → [Tu usuario] → Confirm email).');
            setShowResendEmail(true);
            setLoading(false);
            return;
          }
          throw error;
        }
      } else {
        if (!fullName.trim()) {
          throw new Error('El nombre completo es requerido');
        }
        const { error } = await signUp(email, password, fullName);
        if (error) throw error;
        // Mostrar mensaje de éxito indicando que se envió el email
        setSuccess(`Se ha enviado un correo de verificación a ${email}. Por favor, revisa tu bandeja de entrada y haz clic en el enlace para confirmar tu cuenta.`);
        // Limpiar el formulario
        setEmail('');
        setPassword('');
        setFullName('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al autenticar');
    } finally {
      setLoading(false);
    }
  };

  const handleResendConfirmationEmail = async () => {
    if (!email) {
      setError('Por favor, ingresa tu email primero');
      return;
    }

    setResendingEmail(true);
    setError('');
    setSuccess('');

    try {
      // Determinar la URL de redirección
      let redirectUrl: string | undefined;
      if (import.meta.env.VITE_APP_URL) {
        redirectUrl = `${import.meta.env.VITE_APP_URL}/confirm-email`;
      } else if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        redirectUrl = `${window.location.origin}/confirm-email`;
      } else {
        redirectUrl = `${window.location.origin}/confirm-email`;
      }

      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: redirectUrl,
        },
      });

      if (resendError) {
        // Si es error 429 (Too Many Requests), mostrar mensaje especial
        if (resendError.message?.includes('429') || resendError.message?.includes('Too Many Requests') || resendError.message?.includes('rate limit')) {
          setError('Has enviado demasiados emails. Por favor, espera unos minutos antes de intentar nuevamente. El servicio de email tiene límites de tasa. Si el problema persiste, contacta al administrador o configura SMTP personalizado.');
          setShowResendEmail(false);
          // Establecer cooldown de 5 minutos
          setResendCooldown(300);
          const interval = setInterval(() => {
            setResendCooldown((prev) => {
              if (prev <= 1) {
                clearInterval(interval);
                return 0;
              }
              return prev - 1;
            });
          }, 1000);
        } else {
          setError('Error al reenviar el email: ' + resendError.message);
          setShowResendEmail(false);
        }
      } else {
        setSuccess(`Se ha reenviado el email de confirmación a ${email}. Por favor, revisa tu bandeja de entrada (y la carpeta de spam).`);
        setShowResendEmail(false);
      }
    } catch (err) {
      setError('Error al reenviar el email: ' + (err instanceof Error ? err.message : 'Error desconocido'));
    } finally {
      setResendingEmail(false);
    }
  };

  if (showCompanyRegistration) {
    return (
      <CompanyRegistration
        onSuccess={() => {
          setShowCompanyRegistration(false);
          setIsLogin(true);
          setSuccess('Empresa creada exitosamente. Revisa tu correo para confirmar tu cuenta.');
        }}
        onCancel={() => {
          setShowCompanyRegistration(false);
          setError('');
          setSuccess('');
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="flex items-center justify-center mb-8">
          <div className="bg-blue-600 p-3 rounded-xl">
            <LogIn className="w-8 h-8 text-white" />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-center text-gray-900 mb-2">
          {isForgotPassword ? 'Recuperar Contraseña' : isLogin ? 'Iniciar Sesión' : 'Crear Cuenta'}
        </h1>
        <p className="text-center text-gray-600 mb-8">
          {isForgotPassword ? 'Ingresa tu email para recuperar tu contraseña' : isLogin ? 'Accede a tu cuenta' : 'Regístrate para comenzar'}
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            <p>{error}</p>
            {showResendEmail && (
              <button
                type="button"
                onClick={handleResendConfirmationEmail}
                disabled={resendingEmail || resendCooldown > 0}
                className="mt-3 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {resendingEmail 
                  ? 'Enviando...' 
                  : resendCooldown > 0
                  ? `Espera ${Math.floor(resendCooldown / 60)}:${String(resendCooldown % 60).padStart(2, '0')} antes de intentar nuevamente`
                  : 'Reenviar Email de Confirmación'}
              </button>
            )}
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {!isLogin && !isForgotPassword && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nombre Completo
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                placeholder="Juan Pérez"
                required={!isLogin}
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              placeholder="tu@email.com"
              required
            />
          </div>

          {!isForgotPassword && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>
          )}

          {isLogin && !isForgotPassword && (
            <div className="text-right">
              <button
                type="button"
                onClick={() => {
                  setIsForgotPassword(true);
                  setError('');
                  setSuccess('');
                }}
                className="text-sm text-blue-600 hover:text-blue-700 transition"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Procesando...' : isForgotPassword ? 'Enviar Correo' : isLogin ? 'Iniciar Sesión' : 'Crear Cuenta'}
          </button>
        </form>

        <div className="mt-6 text-center space-y-2">
          {isForgotPassword ? (
            <button
              onClick={() => {
                setIsForgotPassword(false);
                setIsLogin(true);
                setError('');
                setSuccess('');
              }}
              className="text-blue-600 hover:text-blue-700 font-medium transition"
            >
              Volver al inicio de sesión
            </button>
          ) : (
            <>
              <button
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError('');
                  setSuccess('');
                }}
                className="text-blue-600 hover:text-blue-700 font-medium transition"
              >
                {isLogin ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
              </button>
              {isLogin && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCompanyRegistration(true);
                      setError('');
                      setSuccess('');
                    }}
                    className="text-sm text-gray-600 hover:text-gray-700 font-medium transition"
                  >
                    ¿Quieres crear una nueva empresa?
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
