import { useEffect, useState } from 'react';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { handleOAuthCallback, getReturnUrl, clearReturnUrl } from '../lib/googleAuthRedirect';

export function GoogleOAuthCallback() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const processCallback = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');
        const error = urlParams.get('error');

        // Si hay un error de Google
        if (error) {
          setStatus('error');
          let detailedMessage = `Error de Google: ${error}`;
          
          // Mensajes más específicos según el error
          if (error === 'invalid_client') {
            detailedMessage = `Error 401: invalid_client - Las credenciales de Google son incorrectas o el redirect_uri no está configurado.
            
Solución:
1. Ve a Google Cloud Console: https://console.cloud.google.com/apis/credentials
2. Selecciona tu Client ID
3. En "URI de redirección autorizados", agrega:
   ${window.location.origin}/google-oauth-callback
4. Guarda y espera 1-2 minutos
5. Verifica que el Client ID en el frontend coincida con el Client Secret en el backend`;
          } else if (error === 'redirect_uri_mismatch') {
            detailedMessage = `Error: redirect_uri_mismatch - La URL de redirección no está autorizada.
            
Solución:
1. Ve a Google Cloud Console: https://console.cloud.google.com/apis/credentials
2. Selecciona tu Client ID
3. En "URI de redirección autorizados", agrega:
   ${window.location.origin}/google-oauth-callback
4. Guarda y espera 1-2 minutos`;
          }
          
          setErrorMessage(detailedMessage);
          return;
        }

        // Si no hay código, error
        if (!code || !state) {
          setStatus('error');
          setErrorMessage('No se recibió el código de autorización de Google.');
          return;
        }

        // Intercambiar código por token
        await handleOAuthCallback(code, state);

        setStatus('success');

        // Redirigir a la URL de retorno o a la página principal
        const returnUrl = getReturnUrl();
        clearReturnUrl();

        setTimeout(() => {
          if (returnUrl) {
            window.location.href = returnUrl;
          } else {
            // Redirigir a la página principal (ajusta según tu estructura)
            window.location.href = window.location.origin;
          }
        }, 2000);
      } catch (err: any) {
        console.error('Error procesando callback:', err);
        setStatus('error');
        setErrorMessage(err.message || 'Error desconocido al procesar la autenticación.');
      }
    };

    processCallback();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        {status === 'loading' && (
          <>
            <Loader2 className="w-16 h-16 text-blue-600 animate-spin mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Procesando autenticación...
            </h2>
            <p className="text-gray-600">
              Por favor, espera mientras completamos tu autenticación con Google.
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              ¡Autenticación exitosa!
            </h2>
            <p className="text-gray-600">
              Serás redirigido en unos segundos...
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <AlertCircle className="w-16 h-16 text-red-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Error en la autenticación
            </h2>
            <div className="text-gray-600 mb-4 text-left">
              <p className="mb-2 whitespace-pre-line">
                {errorMessage || 'Ocurrió un error al procesar tu autenticación.'}
              </p>
            </div>
            <button
              onClick={() => window.location.href = window.location.origin}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
            >
              Volver al inicio
            </button>
          </>
        )}
      </div>
    </div>
  );
}

