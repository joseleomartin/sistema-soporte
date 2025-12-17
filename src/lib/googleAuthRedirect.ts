/**
 * Google OAuth 2.0 Authentication (Redirect Flow)
 */

const TOKEN_STORAGE_KEY = 'google_drive_token';
const TOKEN_EXPIRY_KEY = 'google_drive_token_expiry';
const RETURN_URL_KEY = 'google_oauth_return_url';

async function getGoogleClientId(): Promise<string> {
  const backendUrl = import.meta.env.VITE_BACKEND_URL;
  if (backendUrl) {
    try {
      const response = await fetch(`${backendUrl}/api/google/client-id`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (response.ok) {
        const data = await response.json();
        if (data.client_id) return data.client_id;
      }
    } catch (error) {
      console.warn('No se pudo obtener Client ID del backend');
    }
  }
  const envClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (envClientId) return envClientId;
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('GOOGLE_CLIENT_ID');
    if (stored) return stored;
  }
  throw new Error('No se encontrÃ³ Google Client ID');
}

export async function startGoogleAuth(returnUrl?: string): Promise<void> {
  try {
    const clientId = await getGoogleClientId();
    if (returnUrl) localStorage.setItem(RETURN_URL_KEY, returnUrl);
    const redirectUri = `${window.location.origin}/google-oauth-callback`;
    const state = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('google_oauth_state', state);
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file');
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('prompt', 'consent');
    authUrl.searchParams.set('state', state);
    window.location.href = authUrl.toString();
  } catch (error: any) {
    throw new Error(`Error al iniciar autenticaciÃ³n: ${error.message}`);
  }
}

export async function handleOAuthCallback(code: string, state: string): Promise<string> {
  const storedState = localStorage.getItem('google_oauth_state');
  if (storedState !== state) throw new Error('El estado de OAuth no coincide');
  localStorage.removeItem('google_oauth_state');
  const redirectUri = `${window.location.origin}/google-oauth-callback`;
  const backendUrl = import.meta.env.VITE_BACKEND_URL;
  if (backendUrl) {
    try {
      const tokenResponse = await fetch(`${backendUrl}/api/google/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, redirect_uri: redirectUri }),
      });
      if (!tokenResponse.ok) {
        const error = await tokenResponse.json().catch(() => ({}));
        throw new Error(error.error_description || error.error || 'Error desconocido');
      }
      const tokenData = await tokenResponse.json();
      const expiryTime = Date.now() + (tokenData.expires_in * 1000);
      localStorage.setItem(TOKEN_STORAGE_KEY, tokenData.access_token);
      localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString());
      if (tokenData.refresh_token) {
        localStorage.setItem('google_drive_refresh_token', tokenData.refresh_token);
      }
      return tokenData.access_token;
    } catch (error: any) {
      console.warn('Backend no disponible, usando mÃ©todo directo');
    }
  }
  const clientSecret = import.meta.env.VITE_GOOGLE_CLIENT_SECRET;
  if (!clientSecret) throw new Error('No se puede autenticar');
  const clientId = await getGoogleClientId();
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
  });
  if (!tokenResponse.ok) {
    const error = await tokenResponse.json().catch(() => ({}));
    throw new Error(error.error_description || error.error || 'Error desconocido');
  }
  const tokenData = await tokenResponse.json();
  const expiryTime = Date.now() + (tokenData.expires_in * 1000);
  localStorage.setItem(TOKEN_STORAGE_KEY, tokenData.access_token);
  localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString());
  if (tokenData.refresh_token) {
    localStorage.setItem('google_drive_refresh_token', tokenData.refresh_token);
  }
  return tokenData.access_token;
}

async function refreshAccessToken(refreshToken: string): Promise<string> {
  const backendUrl = import.meta.env.VITE_BACKEND_URL;
  if (backendUrl) {
    try {
      const tokenResponse = await fetch(`${backendUrl}/api/google/oauth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
        signal: AbortSignal.timeout(10000),
      });
      if (!tokenResponse.ok) {
        let error;
        try { error = await tokenResponse.json(); } catch { error = { error: 'Error desconocido', message: `HTTP ${tokenResponse.status}` }; }
        const errorMessage = error.error_description || error.error || error.message || 'Error desconocido';
        if (tokenResponse.status === 401 || error.error === 'unauthorized_client' || errorMessage.toLowerCase().includes('unauthorized')) {
          console.warn(`Refresh token invÃ¡lido, limpiando tokens...`);
          localStorage.removeItem('google_drive_refresh_token');
          localStorage.removeItem(TOKEN_STORAGE_KEY);
          localStorage.removeItem(TOKEN_EXPIRY_KEY);
          throw new Error('REAUTH_REQUIRED: El token de renovaciÃ³n expirÃ³ o fue revocado. Por favor, autentica nuevamente.');
        }
        if (tokenResponse.status === 401) {
          const hasClientSecret = !!import.meta.env.VITE_GOOGLE_CLIENT_SECRET;
          if (hasClientSecret) throw new Error('BACKEND_ERROR');
          throw new Error(`El backend no tiene las credenciales configuradas`);
        }
        if (tokenResponse.status >= 500) throw new Error('BACKEND_ERROR');
        throw new Error(`Error al refrescar token: ${errorMessage}`);
      }
      const tokenData = await tokenResponse.json();
      const expiryTime = Date.now() + (tokenData.expires_in * 1000);
      localStorage.setItem(TOKEN_STORAGE_KEY, tokenData.access_token);
      localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString());
      if (tokenData.refresh_token) {
        localStorage.setItem('google_drive_refresh_token', tokenData.refresh_token);
      }
      return tokenData.access_token;
    } catch (fetchError: any) {
      if (fetchError.name === 'AbortError' || fetchError.message?.includes('timeout') || fetchError.message?.includes('network')) {
        throw new Error('BACKEND_TIMEOUT');
      }
      throw fetchError;
    }
  }
  const clientSecret = import.meta.env.VITE_GOOGLE_CLIENT_SECRET;
  if (!clientSecret) throw new Error('No se puede refrescar el token');
  const clientId = await getGoogleClientId();
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }),
  });
  if (!tokenResponse.ok) {
    const error = await tokenResponse.json().catch(() => ({}));
    const errorMessage = error.error_description || error.error || 'Error desconocido';
    if (error.error === 'invalid_grant' || error.error === 'unauthorized_client' || errorMessage.includes('invalid_grant') || errorMessage.toLowerCase().includes('unauthorized') || errorMessage.toLowerCase().includes('unauthorized_client')) {
      console.warn(`Refresh token invÃ¡lido, limpiando tokens...`);
      localStorage.removeItem('google_drive_refresh_token');
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      localStorage.removeItem(TOKEN_EXPIRY_KEY);
      throw new Error('REAUTH_REQUIRED: El token de renovaciÃ³n expirÃ³ o fue revocado. Por favor, autentica nuevamente.');
    }
    throw new Error(`Error al refrescar token: ${errorMessage}`);
  }
  const tokenData = await tokenResponse.json();
  const expiryTime = Date.now() + (tokenData.expires_in * 1000);
  localStorage.setItem(TOKEN_STORAGE_KEY, tokenData.access_token);
  localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString());
  if (tokenData.refresh_token) {
    localStorage.setItem('google_drive_refresh_token', tokenData.refresh_token);
  }
  return tokenData.access_token;
}

export async function getAccessToken(retryCount = 0): Promise<string> {
  const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
  const storedExpiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
  const refreshToken = localStorage.getItem('google_drive_refresh_token');
  if (!storedToken || !storedExpiry) {
    if (refreshToken) {
      try {
        return await refreshAccessToken(refreshToken);
      } catch (error: any) {
        localStorage.removeItem('google_drive_refresh_token');
        throw new Error('REAUTH_REQUIRED: No hay token vÃ¡lido. Por favor, autentica nuevamente.');
      }
    }
    throw new Error('REAUTH_REQUIRED: No hay token guardado. Por favor, autentica con Google.');
  }
  const expiryTime = parseInt(storedExpiry, 10);
  const now = Date.now();
  const margin = 10 * 60 * 1000;
  if (now >= expiryTime - margin) {
    if (refreshToken) {
      try {
        return await refreshAccessToken(refreshToken);
      } catch (error: any) {
        console.error('Error refrescando token:', error);
        if (retryCount < 2 && (error.message?.includes('network') || error.message?.includes('fetch') || error.message?.includes('timeout') || error.message?.includes('BACKEND'))) {
          console.log(`ðŸ”„ Reintentando renovaciÃ³n de token (intento ${retryCount + 1}/2)...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
          return await getAccessToken(retryCount + 1);
        }
        if (error.message?.includes('REAUTH_REQUIRED') || error.message?.includes('invalid_grant') || error.message?.includes('unauthorized_client') || error.message?.includes('Unauthorized') || error.message?.includes('invalid')) {
          localStorage.removeItem('google_drive_refresh_token');
          localStorage.removeItem(TOKEN_STORAGE_KEY);
          localStorage.removeItem(TOKEN_EXPIRY_KEY);
          throw new Error('REAUTH_REQUIRED: El token de renovaciÃ³n expirÃ³ o fue revocado. Por favor, autentica nuevamente.');
        }
        throw new Error('No se pudo renovar el token automÃ¡ticamente. Por favor, autentica nuevamente.');
      }
    } else {
      throw new Error('REAUTH_REQUIRED: Token expirado y no hay token de renovaciÃ³n. Por favor, autentica nuevamente.');
    }
  }
  return storedToken;
}

export function isAuthenticated(): boolean {
  const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
  const storedExpiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
  const refreshToken = localStorage.getItem('google_drive_refresh_token');
  if (storedToken && storedExpiry) {
    const expiryTime = parseInt(storedExpiry, 10);
    const now = Date.now();
    const margin = 5 * 60 * 1000;
    if (now < expiryTime - margin) return true;
  }
  return !!refreshToken;
}

export async function refreshTokenIfNeeded(): Promise<void> {
  try {
    const storedExpiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
    const refreshToken = localStorage.getItem('google_drive_refresh_token');
    if (!storedExpiry || !refreshToken) return;
    const expiryTime = parseInt(storedExpiry, 10);
    const now = Date.now();
    const margin = 10 * 60 * 1000;
    if (now >= expiryTime - margin) {
      console.log('ðŸ”„ Refrescando token proactivamente...');
      await refreshAccessToken(refreshToken);
      console.log('âœ… Token refrescado exitosamente');
    }
  } catch (error: any) {
    console.warn('No se pudo refrescar el token proactivamente:', error.message);
  }
}

export function getReturnUrl(): string | null {
  return localStorage.getItem(RETURN_URL_KEY);
}

export function clearReturnUrl(): void {
  localStorage.removeItem(RETURN_URL_KEY);
}