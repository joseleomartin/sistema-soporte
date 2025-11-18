/**
 * Google OAuth 2.0 Authentication usando REDIRECCIÓN
 * Evita problemas con popups y Cross-Origin-Opener-Policy
 */

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

if (!GOOGLE_CLIENT_ID) {
  throw new Error('VITE_GOOGLE_CLIENT_ID no está configurada en las variables de entorno');
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
export function startGoogleAuth(): void {
  const state = generateState();
  const redirectUri = `${window.location.origin}/google-oauth-callback`;
  
  // Guardar el estado para verificación después
  localStorage.setItem(STATE_STORAGE_KEY, state);
  
  // Guardar la URL de retorno
  localStorage.setItem('google_oauth_return_url', window.location.href);
  
  // Construir URL de autorización
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
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
  // NOTA: Esto debe hacerse en el backend por seguridad
  // Llamar al endpoint del backend que maneja el intercambio
  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
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
    throw new Error(`Error al obtener token: ${error.error_description || error.error}`);
  }
  
  const tokenData = await tokenResponse.json();
  
  // Guardar token
  const expiryTime = Date.now() + (tokenData.expires_in * 1000);
  localStorage.setItem(TOKEN_STORAGE_KEY, tokenData.access_token);
  localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString());
  
  if (tokenData.refresh_token) {
    localStorage.setItem('google_drive_refresh_token', tokenData.refresh_token);
  }
  
  console.log('✅ Token guardado exitosamente');
  
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
  // NOTA: Esto debe hacerse en el backend por seguridad
  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
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

