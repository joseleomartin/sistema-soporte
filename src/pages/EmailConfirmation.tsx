import { useEffect, useState } from 'react';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

export function EmailConfirmation() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const handleEmailConfirmation = async () => {
      try {
        // Obtener los parámetros de la URL
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const type = hashParams.get('type');
        const error = hashParams.get('error');
        const errorDescription = hashParams.get('error_description');

        // Si hay un error en la URL
        if (error) {
          setStatus('error');
          setErrorMessage(errorDescription || 'Error al confirmar el email');
          return;
        }

        // Si no hay tokens, puede ser que ya esté confirmado o que falte información
        if (!accessToken && !refreshToken) {
          // Verificar si hay parámetros en query string (algunos casos)
          const urlParams = new URLSearchParams(window.location.search);
          const token = urlParams.get('token');
          const typeParam = urlParams.get('type');

          if (token && typeParam === 'signup') {
            // Intentar verificar con el token
            const { error: verifyError } = await supabase.auth.verifyOtp({
              token_hash: token,
              type: 'signup',
            });

            if (verifyError) {
              setStatus('error');
              setErrorMessage(verifyError.message || 'Error al verificar el email');
              return;
            }

            // Después de verificar, cerrar sesión para que el usuario inicie sesión manualmente
            await supabase.auth.signOut();
            setStatus('success');
            setTimeout(() => {
              window.location.href = window.location.origin;
            }, 3000);
            return;
          } else {
            // Si no hay tokens ni parámetros, puede ser que ya esté confirmado
            // Verificar el estado de la sesión
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
              // Si ya hay sesión, cerrarla para que el usuario inicie sesión manualmente
              await supabase.auth.signOut();
              setStatus('success');
              setTimeout(() => {
                window.location.href = window.location.origin;
              }, 3000);
              return;
            } else {
              setStatus('error');
              setErrorMessage('No se pudo confirmar el email. Por favor, intenta nuevamente.');
              return;
            }
          }
        }

        // Si hay tokens, establecer la sesión para confirmar el email
        if (accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (sessionError) {
            setStatus('error');
            setErrorMessage(sessionError.message || 'Error al establecer la sesión');
            return;
          }

          // Después de confirmar el email, cerrar sesión para que el usuario inicie sesión manualmente
          await supabase.auth.signOut();
        }

        // Si todo salió bien
        setStatus('success');

        // Limpiar la URL
        window.history.replaceState({}, document.title, window.location.pathname);

        // Redirigir al login después de 3 segundos
        // Siempre usar la URL de origen actual (será la correcta si el usuario hace clic desde el email)
        setTimeout(() => {
          // Si estamos en localhost y el servidor no está corriendo, mostrar mensaje
          if (window.location.hostname === 'localhost') {
            // Intentar redirigir, pero si falla, el usuario puede usar el botón
            window.location.href = window.location.origin;
          } else {
            window.location.href = window.location.origin;
          }
        }, 3000);
      } catch (err: any) {
        console.error('Error procesando confirmación de email:', err);
        setStatus('error');
        setErrorMessage(err.message || 'Error desconocido al confirmar el email.');
      }
    };

    handleEmailConfirmation();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 text-center">
        {status === 'loading' && (
          <>
            <Loader2 className="w-16 h-16 text-blue-600 animate-spin mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Verificando tu email...
            </h2>
            <p className="text-gray-600">
              Por favor, espera mientras confirmamos tu cuenta.
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              ¡Registrado con éxito!
            </h2>
            <p className="text-gray-600 mb-6">
              Tu cuenta ha sido verificada correctamente. Serás redirigido al inicio de sesión en unos segundos...
            </p>
            <button
              onClick={() => {
                window.location.href = window.location.origin;
              }}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
            >
              Ir al inicio de sesión
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-10 h-10 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Error en la verificación
            </h2>
            <p className="text-gray-600 mb-6">
              {errorMessage || 'Ocurrió un error al verificar tu email. Por favor, intenta nuevamente.'}
            </p>
            <button
              onClick={() => {
                window.location.href = window.location.origin;
              }}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
            >
              Volver al inicio
            </button>
          </>
        )}
      </div>
    </div>
  );
}

