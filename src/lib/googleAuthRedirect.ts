/**
 * Google OAuth 2.0 Authentication usando REDIRECCIÓN
 * Evita problemas con popups y Cross-Origin-Opener-Policy
 */

// Cache para el Client ID obtenido del backend
let cachedClientId: string | null = null;

/**
 * Obtiene el Client ID de Google desde el backend o variables de entorno
 * Lanza un error solo cuando se intenta usar, no al cargar el módulo
 */
async function getGoogleClientId(): Promise<string> {
  // Si ya tenemos el Client ID en caché, usarlo
  if (cachedClientId) {
    return cachedClientId;
  }

  // Intentar obtener del backend primero (si está configurado)
  const backendUrl = import.meta.env.VITE_BACKEND_URL;
  
  if (backendUrl) {
    try {
      const response = await fetch(`${backendUrl}/api/google/client-id`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });
      
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await response.json();
          if (data.client_id) {
            cachedClientId = data.client_id;
            console.log('✅ Client ID obtenido del backend');
            return cachedClientId;
          }
        } else {
          // El backend devolvió HTML en lugar de JSON (probablemente un error 404 o similar)
          const text = await response.text();
          console.warn('⚠️ El backend devolvió HTML en lugar de JSON. URL:', `${backendUrl}/api/google/client-id`);
          console.warn('⚠️ Respuesta:', text.substring(0, 200));
        }
      } else {
        // El backend respondió con un error HTTP
        const errorText = await response.text().catch(() => 'Error desconocido');
        console.warn(`⚠️ El backend respondió con error ${response.status}:`, errorText.substring(0, 200));
      }
    } catch (error: any) {
      console.warn('⚠️ No se pudo obtener Client ID del backend:', error.message);
      console.warn('⚠️ URL intentada:', `${backendUrl}/api/google/client-id`);
      console.warn('⚠️ Verifica que VITE_BACKEND_URL esté correctamente configurado y que el backend esté accesible');
    }
  }

  // Fallback: usar variable de entorno del frontend
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error(
      'VITE_GOOGLE_CLIENT_ID no está configurada en las variables de entorno. ' +
      'Por favor, agrega VITE_GOOGLE_CLIENT_ID=tu_client_id en tu archivo .env ' +
      'o configura VITE_BACKEND_URL para obtenerlo del backend.'
    );
  }
  
  cachedClientId = clientId;
  return clientId;
}

// Scope para leer y escribir archivos en Drive
// drive.file: solo archivos creados por la app
// drive.readonly: leer todos los archivos accesibles
// drive: leer y escribir todos los archivos accesibles (más permisos)
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive';
const TOKEN_STORAGE_KEY = 'google_drive_access_token';
const TOKEN_EXPIRY_KEY = 'google_drive_token_expiry';
const STATE_STORAGE_KEY = 'google_oauth_state';

/**
 * Genera un estado aleatorio para prevenir CSRF
 */
function generateState(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

/**
 * Inicia el flujo de autenticación OAuth con redirección
 */
export async function startGoogleAuth(): Promise<void> {
  const clientId = await getGoogleClientId();
  const state = generateState();
  const redirectUri = `${window.location.origin}/google-oauth-callback`;
  
  // Guardar el estado para verificación después
  localStorage.setItem(STATE_STORAGE_KEY, state);
  
  // Guardar la URL de retorno
  localStorage.setItem('google_oauth_return_url', window.location.href);
  
  // Construir URL de autorización
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', DRIVE_SCOPE);
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');
  authUrl.searchParams.set('state', state);
  
  console.log('🔐 Redirigiendo a Google para autenticación...');
  console.log('📍 URL de retorno:', redirectUri);
  
  // Redirigir a Google
  window.location.href = authUrl.toString();
}

/**
 * Maneja el callback de OAuth después de la redirección
 */
export async function handleOAuthCallback(code: string, state: string): Promise<string> {
  // Verificar el estado
  const savedState = localStorage.getItem(STATE_STORAGE_KEY);
  if (!savedState || savedState !== state) {
    throw new Error('Estado de OAuth inválido. Posible ataque CSRF.');
  }
  
  // Limpiar el estado
  localStorage.removeItem(STATE_STORAGE_KEY);
  
  const redirectUri = `${window.location.origin}/google-oauth-callback`;
  
  // Intercambiar código por token
  // Intentar usar el backend primero (más seguro)
  const backendUrl = import.meta.env.VITE_BACKEND_URL;
  
  if (backendUrl) {
    // Usar backend para intercambio de tokens (recomendado)
    try {
      const tokenResponse = await fetch(`${backendUrl}/api/google/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code,
          redirect_uri: redirectUri,
        }),
      });
      
      if (!tokenResponse.ok) {
        const error = await tokenResponse.json();
        throw new Error(`Error al obtener token: ${error.error_description || error.error || error.message || 'Error desconocido'}`);
      }
      
      const tokenData = await tokenResponse.json();
      
      // Guardar token
      const expiryTime = Date.now() + (tokenData.expires_in * 1000);
      localStorage.setItem(TOKEN_STORAGE_KEY, tokenData.access_token);
      localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString());
      
      if (tokenData.refresh_token) {
        localStorage.setItem('google_drive_refresh_token', tokenData.refresh_token);
      }
      
      return tokenData.access_token;
    } catch (error: any) {
      // Si el backend falla, intentar método directo como fallback
      console.warn('Backend no disponible, usando método directo (menos seguro):', error.message);
    }
  }
  
  // Fallback: método directo (menos seguro, pero funciona)
  const clientSecret = import.meta.env.VITE_GOOGLE_CLIENT_SECRET;
  
  if (!clientSecret) {
    throw new Error(
      'No se puede autenticar: ' +
      (backendUrl 
        ? 'El backend no está disponible y VITE_GOOGLE_CLIENT_SECRET no está configurada. ' +
          'Configura VITE_BACKEND_URL o VITE_GOOGLE_CLIENT_SECRET en Vercel.'
        : 'VITE_GOOGLE_CLIENT_SECRET no está configurada. ' +
          'Por favor, agrega esta variable en Vercel (Settings → Environment Variables). ' +
          'NOTA: Para mayor seguridad, configura VITE_BACKEND_URL para usar el backend.')
    );
  }
  
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      code,
      client_id: getGoogleClientId(),
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  
  if (!tokenResponse.ok) {
    const error = await tokenResponse.json();
    throw new Error(`Error al obtener token: ${error.error_description || error.error}`);
  }
  
  const tokenData = await tokenResponse.json();
  
  // Guardar token (solo si no se guardó antes en el bloque del backend)
  const expiryTime = Date.now() + (tokenData.expires_in * 1000);
  localStorage.setItem(TOKEN_STORAGE_KEY, tokenData.access_token);
  localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString());
  
  if (tokenData.refresh_token) {
    localStorage.setItem('google_drive_refresh_token', tokenData.refresh_token);
  }
  
  return tokenData.access_token;
}

/**
 * Obtiene el token de acceso válido
 */
export async function getAccessToken(): Promise<string> {
  const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
  const storedExpiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
  
  if (!storedToken || !storedExpiry) {
    throw new Error('No hay token guardado. Por favor, autentica primero.');
  }
  
  // Verificar si el token expiró (con margen de 5 minutos)
  const expiryTime = parseInt(storedExpiry, 10);
  const now = Date.now();
  const margin = 5 * 60 * 1000; // 5 minutos
  
  if (now >= expiryTime - margin) {
    // Intentar refrescar el token
    const refreshToken = localStorage.getItem('google_drive_refresh_token');
    if (refreshToken) {
      try {
        return await refreshAccessToken(refreshToken);
      } catch (error) {
        console.error('Error refrescando token:', error);
        throw new Error('Token expirado. Por favor, autentica nuevamente.');
      }
    } else {
      throw new Error('Token expirado. Por favor, autentica nuevamente.');
    }
  }
  
  return storedToken;
}

/**
 * Refresca el token de acceso usando el refresh token
 */
async function refreshAccessToken(refreshToken: string): Promise<string> {
  // Intentar usar el backend primero (más seguro)
  const backendUrl = import.meta.env.VITE_BACKEND_URL;
  
  if (backendUrl) {
    try {
      const tokenResponse = await fetch(`${backendUrl}/api/google/oauth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refresh_token: refreshToken,
        }),
      });
      
      if (!tokenResponse.ok) {
        const error = await tokenResponse.json();
        throw new Error(`Error al refrescar token: ${error.error_description || error.error || error.message || 'Error desconocido'}`);
      }
      
      const tokenData = await tokenResponse.json();
      
      // Guardar nuevo token
      const expiryTime = Date.now() + (tokenData.expires_in * 1000);
      localStorage.setItem(TOKEN_STORAGE_KEY, tokenData.access_token);
      localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString());
      
      return tokenData.access_token;
    } catch (error: any) {
      // Si el backend falla, intentar método directo como fallback
      console.warn('Backend no disponible para refresh, usando método directo:', error.message);
    }
  }
  
  // Fallback: método directo (menos seguro)
  const clientSecret = import.meta.env.VITE_GOOGLE_CLIENT_SECRET;
  
  if (!clientSecret) {
    throw new Error(
      'No se puede refrescar token: ' +
      (backendUrl 
        ? 'El backend no está disponible y VITE_GOOGLE_CLIENT_SECRET no está configurada.'
        : 'VITE_GOOGLE_CLIENT_SECRET no está configurada.')
    );
  }
  
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: getGoogleClientId(),
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  
  if (!tokenResponse.ok) {
    throw new Error('Error al refrescar token');
  }
  
  const tokenData = await tokenResponse.json();
  
  // Guardar nuevo token
  const expiryTime = Date.now() + (tokenData.expires_in * 1000);
  localStorage.setItem(TOKEN_STORAGE_KEY, tokenData.access_token);
  localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString());
  
  return tokenData.access_token;
}

/**
 * Verifica si el usuario está autenticado
 */
export function isAuthenticated(): boolean {
  const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
  const storedExpiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
  
  if (!storedToken || !storedExpiry) {
    return false;
  }
  
  const expiryTime = parseInt(storedExpiry, 10);
  const now = Date.now();
  const margin = 5 * 60 * 1000; // 5 minutos
  
  return now < expiryTime - margin;
}

/**
 * Cierra sesión de Google
 */
export function signOutGoogle(): void {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
  localStorage.removeItem('google_drive_refresh_token');
  localStorage.removeItem(STATE_STORAGE_KEY);
  localStorage.removeItem('google_oauth_return_url');
}

/**
 * Obtiene la URL de retorno guardada
 */
export function getReturnUrl(): string | null {
  return localStorage.getItem('google_oauth_return_url');
}

/**
 * Limpia la URL de retorno
 */
export function clearReturnUrl(): void {
  localStorage.removeItem('google_oauth_return_url');
}

