import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, Loader2, Lock, Mail } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export function ResetPassword() {
  const [status, setStatus] = useState<'loading' | 'error' | 'form' | 'success'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [showResendForm, setShowResendForm] = useState(false);
  const { resetPassword } = useAuth();

  useEffect(() => {
    const handleResetPassword = async () => {
      try {
        // Obtener los parámetros del hash de la URL
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const type = hashParams.get('type');
        const error = hashParams.get('error');
        const errorCode = hashParams.get('error_code');
        const errorDescription = hashParams.get('error_description');

        // Si hay un error en la URL (enlace expirado o inválido)
        if (error) {
          setStatus('error');
          if (errorCode === 'otp_expired' || errorDescription?.includes('expired') || errorDescription?.includes('expirado')) {
            setErrorMessage('El enlace para restablecer tu contraseña ha expirado. Por favor, solicita un nuevo enlace.');
            setShowResendForm(true);
          } else {
            setErrorMessage(errorDescription || 'El enlace para restablecer tu contraseña es inválido. Por favor, solicita un nuevo enlace.');
            setShowResendForm(true);
          }
          return;
        }

        // Si no hay tokens, mostrar error
        if (!accessToken && !refreshToken) {
          setStatus('error');
          setErrorMessage('No se encontró información de restablecimiento de contraseña. Por favor, solicita un nuevo enlace.');
          setShowResendForm(true);
          return;
        }

        // Si hay tokens y es tipo recovery, establecer la sesión
        if (accessToken && refreshToken && type === 'recovery') {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (sessionError) {
            setStatus('error');
            setErrorMessage(sessionError.message || 'Error al establecer la sesión');
            setShowResendForm(true);
            return;
          }

          // Obtener el email del usuario
          const { data: { user } } = await supabase.auth.getUser();
          if (user?.email) {
            setEmail(user.email);
          }

          // Mostrar formulario para cambiar contraseña
          setStatus('form');
        } else {
          setStatus('error');
          setErrorMessage('El enlace no es válido para restablecer la contraseña.');
          setShowResendForm(true);
        }
      } catch (err) {
        console.error('Error en reset password:', err);
        setStatus('error');
        setErrorMessage('Error al procesar el enlace de restablecimiento de contraseña.');
        setShowResendForm(true);
      }
    };

    handleResetPassword();
  }, []);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    // Validaciones
    if (!newPassword || !confirmPassword) {
      setErrorMessage('Por favor, completa todos los campos');
      setLoading(false);
      return;
    }

    if (newPassword.length < 6) {
      setErrorMessage('La contraseña debe tener al menos 6 caracteres');
      setLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('Las contraseñas no coinciden');
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      setStatus('success');
      // Redirigir al login después de 3 segundos
      setTimeout(() => {
        window.location.href = window.location.origin;
      }, 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al actualizar la contraseña');
      setStatus('form');
    } finally {
      setLoading(false);
    }
  };

  const handleResendResetLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    if (!email.trim()) {
      setErrorMessage('Por favor, ingresa tu email');
      setLoading(false);
      return;
    }

    try {
      const { error } = await resetPassword(email);
      if (error) throw error;

      setStatus('success');
      setErrorMessage(null);
      setTimeout(() => {
        window.location.href = window.location.origin;
      }, 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al enviar el enlace de restablecimiento');
      setLoading(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Procesando enlace de restablecimiento...</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-8 max-w-md w-full">
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white text-center mb-4">
            Enlace Inválido o Expirado
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-center mb-6">
            {errorMessage || 'El enlace para restablecer tu contraseña no es válido o ha expirado.'}
          </p>

          {showResendForm && (
            <form onSubmit={handleResendResetLink} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="tu@email.com"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Enviando...</span>
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4" />
                    <span>Solicitar Nuevo Enlace</span>
                  </>
                )}
              </button>
            </form>
          )}

          <div className="mt-6 text-center">
            <a
              href={window.location.origin}
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              Volver al inicio de sesión
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'form') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-8 max-w-md w-full">
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
              <Lock className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white text-center mb-2">
            Restablecer Contraseña
          </h2>
          {email && (
            <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-6">
              Para: {email}
            </p>
          )}

          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Nueva Contraseña
              </label>
              <input
                type="password"
                id="newPassword"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Mínimo 6 caracteres"
                required
                minLength={6}
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Confirmar Contraseña
              </label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Confirma tu nueva contraseña"
                required
                minLength={6}
              />
            </div>

            {errorMessage && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <p className="text-sm text-red-600 dark:text-red-400">{errorMessage}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Actualizando...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Actualizar Contraseña</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <a
              href={window.location.origin}
              className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
            >
              Volver al inicio de sesión
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            {showResendForm ? 'Enlace Enviado' : 'Contraseña Actualizada'}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {showResendForm
              ? 'Se ha enviado un nuevo enlace a tu correo electrónico. Revisa tu bandeja de entrada.'
              : 'Tu contraseña ha sido actualizada exitosamente. Serás redirigido al inicio de sesión.'}
          </p>
        </div>
      </div>
    );
  }

  return null;
}
