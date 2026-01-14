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
      // Headers para evitar la página de interceptación de ngrok
      const headers: HeadersInit = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      };
      
      // Si es ngrok, agregar headers adicionales para evitar la página de interceptación
      if (backendUrl.includes('ngrok')) {
        headers['ngrok-skip-browser-warning'] = 'true';
        headers['User-Agent'] = 'Mozilla/5.0';
      }
      
      const response = await fetch(`${backendUrl}/api/google/client-id`, {
        method: 'GET',
        headers,
      });
      
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await response.json();
          if (data.client_id) {
            cachedClientId = data.client_id;
            console.log('✅ Client ID obtenido del backend:', data.client_id);
            console.log('✅ Client ID completo (para verificar):', data.client_id);
            
            // Validar que sea el Client ID correcto
            if (data.client_id !== '355638125084-lecv3ob03pj367159gpd41r5qm773439.apps.googleusercontent.com') {
              console.error('❌ ADVERTENCIA: El Client ID del backend NO coincide con el esperado');
              console.error('❌ Client ID recibido:', data.client_id);
              console.error('❌ Client ID esperado: 355638125084-lecv3ob03pj367159gpd41r5qm773439.apps.googleusercontent.com');
              console.error('❌ Verifica que el backend tenga el Client ID correcto configurado');
            }
            
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
        console.warn('⚠️ Verifica que el backend esté corriendo y que las credenciales estén configuradas');
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
    const errorMessage = 
      'VITE_GOOGLE_CLIENT_ID no está configurada en las variables de entorno.\n\n' +
      'SOLUCIÓN:\n' +
      '1. Si usas backend: Configura VITE_BACKEND_URL en Vercel para obtener el Client ID del backend\n' +
      '2. Si no usas backend: Agrega VITE_GOOGLE_CLIENT_ID en Vercel (Settings → Environment Variables)\n\n' +
      'IMPORTANTE: El Client ID debe existir en Google Cloud Console y ser de tipo "Aplicación web"';
    console.error('❌', errorMessage);
    throw new Error(errorMessage);
  }
  
  // Validar formato del Client ID
  if (!clientId.includes('.apps.googleusercontent.com')) {
    const errorMessage = 
      `El Client ID no tiene el formato correcto: ${clientId}\n\n` +
      'Un Client ID válido debe terminar en .apps.googleusercontent.com\n' +
      'Verifica que el Client ID esté correctamente configurado en las variables de entorno.';
    console.error('❌', errorMessage);
    throw new Error(errorMessage);
  }
  
  cachedClientId = clientId;
  console.log('✅ Client ID obtenido de variable de entorno:', clientId.substring(0, 30) + '...');
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
 * Detecta si estamos en un entorno de desarrollo local
 */
function isLocalDevelopment(): boolean {
  const origin = window.location.origin;
  return origin.includes('localhost') || 
         origin.includes('127.0.0.1') || 
         origin.includes('192.168.') ||
         origin.includes('0.0.0.0') ||
         origin.startsWith('http://');
}

/**
 * Obtiene todas las URLs de redirección posibles (producción y desarrollo)
 */
function getRedirectUris(): string[] {
  const origin = window.location.origin;
  const redirectUri = `${origin}/google-oauth-callback`;
  
  const uris = [redirectUri];
  
  // Si estamos en producción, también agregar localhost para desarrollo
  if (!isLocalDevelopment()) {
    uris.push('http://localhost:5173/google-oauth-callback');
    uris.push('http://localhost:3000/google-oauth-callback');
    uris.push('http://127.0.0.1:5173/google-oauth-callback');
    uris.push('http://127.0.0.1:3000/google-oauth-callback');
  }
  
  return uris;
}

/**
 * Obtiene todos los orígenes JavaScript posibles (producción y desarrollo)
 */
function getJavaScriptOrigins(): string[] {
  const origin = window.location.origin;
  
  const origins = [origin];
  
  // Si estamos en producción, también agregar localhost para desarrollo
  if (!isLocalDevelopment()) {
    origins.push('http://localhost:5173');
    origins.push('http://localhost:3000');
    origins.push('http://127.0.0.1:5173');
    origins.push('http://127.0.0.1:3000');
  }
  
  return origins;
}

/**
 * Inicia el flujo de autenticación OAuth con redirección
 */
export async function startGoogleAuth(): Promise<void> {
  const clientId = await getGoogleClientId();
  const state = generateState();
  const redirectUri = `${window.location.origin}/google-oauth-callback`;
  const isLocal = isLocalDevelopment();
  
  // Guardar el estado para verificación después
  localStorage.setItem(STATE_STORAGE_KEY, state);
  
  // Guardar la URL de retorno
  localStorage.setItem('google_oauth_return_url', window.location.href);
  
  // Verificar si ya tenemos un refresh token
  // Si lo tenemos, no forzar consent (para mantener sesión)
  // Si no lo tenemos, forzar consent para obtener refresh token
  const hasRefreshToken = !!localStorage.getItem('google_drive_refresh_token');
  
  // Construir URL de autorización
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', DRIVE_SCOPE);
  authUrl.searchParams.set('access_type', 'offline'); // Necesario para obtener refresh token
  // Solo forzar consent si no tenemos refresh token (primera vez)
  if (!hasRefreshToken) {
    authUrl.searchParams.set('prompt', 'consent');
  }
  authUrl.searchParams.set('state', state);
  
  console.log('🔐 Redirigiendo a Google para autenticación...');
  console.log('📍 Entorno:', isLocal ? '🛠️ DESARROLLO LOCAL' : '🚀 PRODUCCIÓN');
  console.log('📍 Client ID usado:', clientId);
  console.log('📍 Client ID completo (para copiar):', clientId);
  console.log('📍 URL de retorno:', redirectUri);
  console.log('📍 Origen actual:', window.location.origin);
  console.log('');
  
  // Guardar en localStorage para poder verlo después de la redirección
  if (typeof window !== 'undefined') {
    localStorage.setItem('last_used_google_client_id', clientId);
    localStorage.setItem('last_used_redirect_uri', redirectUri);
  }
  
  if (isLocal) {
    console.log('🛠️ MODO DESARROLLO LOCAL DETECTADO');
    console.log('');
    console.log('⚠️ IMPORTANTE: Para que funcione en localhost, debes configurar en Google Cloud Console:');
    console.log('');
    console.log('   1. Ve a: https://console.cloud.google.com/apis/credentials');
    console.log('   2. Selecciona tu Client ID:', clientId);
    console.log('   3. En "URI de redirección autorizados", agrega TODAS estas URLs:');
    getRedirectUris().forEach((uri, index) => {
      console.log(`      ${index + 1}. ${uri}`);
    });
    console.log('   4. En "Orígenes JavaScript autorizados", agrega TODOS estos orígenes:');
    getJavaScriptOrigins().forEach((origin, index) => {
      console.log(`      ${index + 1}. ${origin}`);
    });
    console.log('   5. Guarda los cambios y espera 1-2 minutos');
    console.log('');
  }
  
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
      // Headers para evitar la página de interceptación de ngrok
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      };
      
      // Si es ngrok, agregar headers adicionales
      if (backendUrl.includes('ngrok')) {
        headers['ngrok-skip-browser-warning'] = 'true';
        headers['User-Agent'] = 'Mozilla/5.0';
      }
      
      const tokenResponse = await fetch(`${backendUrl}/api/google/oauth/token`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          code,
          redirect_uri: redirectUri,
        }),
      });
      
      if (!tokenResponse.ok) {
        let errorMessage = 'Error desconocido';
        try {
          const error = await tokenResponse.json();
          errorMessage = error.error_description || error.error || error.message || JSON.stringify(error);
          
          // Mensajes más específicos según el error
          if (error.error === 'invalid_grant') {
            errorMessage = 'El código de autorización es inválido o expiró. Por favor, intenta autenticarte nuevamente.';
          } else if (error.error === 'invalid_client') {
            errorMessage = 'Error de autenticación con Google. Por favor, contacta al administrador del sistema.';
          } else if (error.error === 'redirect_uri_mismatch') {
            errorMessage = `La URL de redirección no coincide. Verifica que ${redirectUri} esté configurada en Google Cloud Console.`;
          }
        } catch (e) {
          // Si no se puede parsear el JSON, usar el texto de respuesta
          const text = await tokenResponse.text();
          errorMessage = `Error ${tokenResponse.status}: ${text.substring(0, 200)}`;
        }
        throw new Error(`Error al obtener token: ${errorMessage}`);
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
  
  // Obtener client_id (async)
  const clientId = await getGoogleClientId();
  
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      code,
      client_id: clientId,
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
 * Intenta renovar automáticamente si está próximo a expirar o expiró
 */
export async function getAccessToken(retryCount = 0): Promise<string> {
  const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
  const storedExpiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
  const refreshToken = localStorage.getItem('google_drive_refresh_token');
  
  // Si no hay token pero hay refresh token, intentar renovar directamente
  if ((!storedToken || !storedExpiry) && refreshToken) {
    console.log('🔄 No hay token guardado, pero hay refresh token. Renovando...');
    try {
      return await refreshAccessToken(refreshToken);
    } catch (error) {
      console.error('Error renovando token sin token guardado:', error);
      throw new Error('No se pudo renovar el token. Por favor, autentica nuevamente.');
    }
  }
  
  if (!storedToken || !storedExpiry) {
    throw new Error('No hay token guardado. Por favor, autentica primero.');
  }
  
  // Verificar si el token expiró (con margen de 10 minutos para renovar proactivamente)
  const expiryTime = parseInt(storedExpiry, 10);
  const now = Date.now();
  const margin = 10 * 60 * 1000; // 10 minutos (renovación proactiva)
  
  if (now >= expiryTime - margin) {
    // Intentar refrescar el token automáticamente
    if (refreshToken) {
      try {
        return await refreshAccessToken(refreshToken);
      } catch (error: any) {
        console.error('Error refrescando token:', error);
        
        // Si el error es que el Client ID no existe, mostrar mensaje específico
        if (error.message?.includes('Client ID no existe') || error.message?.includes('OAuth client was not found')) {
          throw error; // Re-lanzar el error con el mensaje específico
        }
        
        // Si es un error recuperable y no hemos intentado demasiadas veces, reintentar
        if (retryCount < 2 && (
          error.message?.includes('network') || 
          error.message?.includes('fetch') ||
          error.message?.includes('timeout') ||
          error.message?.includes('BACKEND')
        )) {
          console.log(`🔄 Reintentando renovación de token (intento ${retryCount + 1}/2)...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))); // Backoff exponencial
          return await getAccessToken(retryCount + 1);
        }
        
        // Si el error es que el refresh token es inválido, no lanzar error genérico
        if (error.message?.includes('invalid_grant') || (error.message?.includes('invalid') && !error.message?.includes('Client ID'))) {
          throw new Error('El token de renovación es inválido. Por favor, autentica nuevamente.');
        }
        
        throw error; // Re-lanzar el error original para mantener el mensaje específico
      }
    } else {
      throw new Error('Token expirado y no hay token de renovación. Por favor, autentica nuevamente.');
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
      // Agregar headers de ngrok si es necesario
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      
      if (backendUrl.includes('ngrok')) {
        headers['ngrok-skip-browser-warning'] = 'true';
        headers['User-Agent'] = 'Mozilla/5.0';
      }
      
      // Agregar timeout para evitar que se quede colgado
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 segundos
      
      let tokenResponse: Response;
      try {
        tokenResponse = await fetch(`${backendUrl}/api/google/oauth/refresh`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            refresh_token: refreshToken,
          }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        // Si es un error de red o timeout, intentar método directo
        if (fetchError.name === 'AbortError' || fetchError.message?.includes('fetch')) {
          console.warn('Backend no disponible (timeout o error de red), usando método directo');
          throw new Error('BACKEND_TIMEOUT');
        }
        throw fetchError;
      }
      
      if (!tokenResponse.ok) {
        let error;
        try {
          error = await tokenResponse.json();
        } catch {
          error = { error: 'Error desconocido', message: `HTTP ${tokenResponse.status}` };
        }
        
        const errorMessage = error.error_description || error.error || error.message || 'Error desconocido';
        
        // Si es 401, verificar si es invalid_client (Client ID no existe) u otro error
        if (tokenResponse.status === 401) {
          const isInvalidClient = error.error === 'invalid_client' || errorMessage.includes('invalid_client') || errorMessage.includes('OAuth client was not found');
          
          if (isInvalidClient) {
            // El Client ID no existe en Google Cloud Console
            throw new Error('Error de autenticación con Google. Por favor, contacta al administrador del sistema.');
          }
          
          // Si es otro error 401, intentar método directo como fallback solo si VITE_GOOGLE_CLIENT_SECRET está disponible
          const hasClientSecret = !!import.meta.env.VITE_GOOGLE_CLIENT_SECRET;
          if (hasClientSecret) {
            console.warn(`Backend devolvió error 401 (${errorMessage}), intentando método directo como fallback`);
            throw new Error('BACKEND_ERROR');
          } else {
            // Si no hay client secret, el problema es que el backend no tiene las credenciales configuradas
            throw new Error(`El backend no tiene las credenciales de Google configuradas (error 401: ${errorMessage}). Por favor, configura GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en el backend o configura VITE_GOOGLE_CLIENT_SECRET en Vercel.`);
          }
        }
        
        // Si es 500 o error del servidor, intentar método directo como fallback
        if (tokenResponse.status >= 500) {
          console.warn(`Backend devolvió error ${tokenResponse.status} (${errorMessage}), intentando método directo como fallback`);
          throw new Error('BACKEND_ERROR');
        }
        
        // Para otros errores (400, 403, etc.), lanzar el error
        throw new Error(`Error al refrescar token: ${errorMessage}`);
      }
      
      const tokenData = await tokenResponse.json();
      
      // Guardar nuevo token
      const expiryTime = Date.now() + (tokenData.expires_in * 1000);
      localStorage.setItem(TOKEN_STORAGE_KEY, tokenData.access_token);
      localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString());
      
      // Si Google devuelve un nuevo refresh token, guardarlo también
      // (a veces Google devuelve un nuevo refresh token)
      if (tokenData.refresh_token) {
        localStorage.setItem('google_drive_refresh_token', tokenData.refresh_token);
        console.log('✅ Nuevo refresh token guardado');
      }
      
      return tokenData.access_token;
    } catch (error: any) {
      // Si el backend falla con timeout, error de red, 401 o 500, intentar método directo como fallback
      if (error.message === 'BACKEND_TIMEOUT' || error.message === 'BACKEND_ERROR' || 
          error.message?.includes('fetch') || error.message?.includes('network') ||
          error.message?.includes('Failed to fetch')) {
        console.warn('Backend no disponible para refresh, usando método directo:', error.message);
      } else {
        // Si es otro tipo de error que no podemos manejar, relanzarlo
        throw error;
      }
    }
  }
  
  // Fallback: método directo (menos seguro)
  const clientSecret = import.meta.env.VITE_GOOGLE_CLIENT_SECRET;
  
  if (!clientSecret) {
    // Si llegamos aquí, significa que el backend falló y no hay client secret configurado
    const errorMessage = backendUrl 
      ? 'No se puede refrescar el token automáticamente. El backend no tiene las credenciales de Google configuradas y VITE_GOOGLE_CLIENT_SECRET no está configurada en Vercel. ' +
        'Por favor, configura GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en el backend (variables de entorno) ' +
        'o configura VITE_GOOGLE_CLIENT_SECRET en Vercel (Settings → Environment Variables).'
      : 'VITE_GOOGLE_CLIENT_SECRET no está configurada. ' +
        'Por favor, agrega esta variable en Vercel (Settings → Environment Variables).';
    
    throw new Error(`No se puede refrescar token: ${errorMessage}`);
  }
  
  // Usar función async para obtener client_id
  const clientId = await getGoogleClientId();
  
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  
  if (!tokenResponse.ok) {
    const error = await tokenResponse.json().catch(() => ({}));
    const errorMessage = error.error_description || error.error || 'Error desconocido';
    
    // Si el error es invalid_grant, el refresh token es inválido o expiró
    // En este caso, necesitamos re-autenticar
    if (error.error === 'invalid_grant' || errorMessage.includes('invalid_grant')) {
      // Limpiar el refresh token inválido
      localStorage.removeItem('google_drive_refresh_token');
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      localStorage.removeItem(TOKEN_EXPIRY_KEY);
      throw new Error('El token de renovación expiró o es inválido. Por favor, autentica nuevamente.');
    }
    
    throw new Error(`Error al refrescar token: ${errorMessage}`);
  }
  
  const tokenData = await tokenResponse.json();
  
  // Guardar nuevo token
  const expiryTime = Date.now() + (tokenData.expires_in * 1000);
  localStorage.setItem(TOKEN_STORAGE_KEY, tokenData.access_token);
  localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString());
  
  // Si Google devuelve un nuevo refresh token, guardarlo también
  // (a veces Google devuelve un nuevo refresh token)
  if (tokenData.refresh_token) {
    localStorage.setItem('google_drive_refresh_token', tokenData.refresh_token);
    console.log('✅ Nuevo refresh token guardado');
  }
  
  return tokenData.access_token;
}

/**
 * Verifica si el usuario está autenticado
 * Considera autenticado si tiene un token válido O un refresh token (puede refrescar)
 */
export function isAuthenticated(): boolean {
  const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
  const storedExpiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
  const refreshToken = localStorage.getItem('google_drive_refresh_token');
  
  // Si tiene refresh token, está autenticado (puede refrescar el access token)
  // Esto es lo más importante: si hay refresh token, siempre consideramos autenticado
  if (refreshToken) {
    return true;
  }
  
  // Si no tiene refresh token, verificar si el access token es válido
  if (!storedToken || !storedExpiry) {
    return false;
  }
  
  const expiryTime = parseInt(storedExpiry, 10);
  const now = Date.now();
  const margin = 5 * 60 * 1000; // 5 minutos
  
  return now < expiryTime - margin;
}

/**
 * Renueva el token proactivamente si está próximo a expirar
 * Esta función puede ser llamada periódicamente para mantener la sesión activa
 */
export async function refreshTokenIfNeeded(): Promise<void> {
  const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
  const storedExpiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
  const refreshToken = localStorage.getItem('google_drive_refresh_token');
  
  // Solo renovar si hay refresh token y el token está próximo a expirar
  if (!refreshToken || !storedToken || !storedExpiry) {
    return;
  }
  
  const expiryTime = parseInt(storedExpiry, 10);
  const now = Date.now();
  const margin = 15 * 60 * 1000; // 15 minutos antes de expirar
  
  // Si el token expira en menos de 15 minutos, renovarlo proactivamente
  if (now >= expiryTime - margin) {
    try {
      console.log('🔄 Renovando token proactivamente...');
      await refreshAccessToken(refreshToken);
      console.log('✅ Token renovado exitosamente');
    } catch (error) {
      // No lanzar error, solo loguear. El token se renovará cuando se necesite
      console.warn('⚠️ No se pudo renovar el token proactivamente:', error);
    }
  }
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

