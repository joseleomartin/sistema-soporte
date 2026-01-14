/**
 * Google OAuth 2.0 Authentication
 * Maneja la autenticación con Google Drive API
 */

// Obtener Client ID de las variables de entorno
// Vite solo carga .env al iniciar el servidor, así que si no está disponible,
// intentamos obtenerlo de localStorage como fallback
const getGoogleClientId = (): string | undefined => {
  console.log('🔍 [getGoogleClientId] Iniciando búsqueda de Client ID...');
  
  // Primero intentar desde import.meta.env (variable de entorno)
  console.log('📦 [getGoogleClientId] Verificando import.meta.env...');
  console.log('📦 [getGoogleClientId] import.meta.env completo:', import.meta.env);
  console.log('📦 [getGoogleClientId] import.meta.env.MODE:', import.meta.env.MODE);
  console.log('📦 [getGoogleClientId] import.meta.env.DEV:', import.meta.env.DEV);
  console.log('📦 [getGoogleClientId] import.meta.env.PROD:', import.meta.env.PROD);
  
  const envClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  console.log('📦 [getGoogleClientId] import.meta.env.VITE_GOOGLE_CLIENT_ID:', envClientId);
  console.log('📦 [getGoogleClientId] Tipo de envClientId:', typeof envClientId);
  console.log('📦 [getGoogleClientId] envClientId es truthy?', !!envClientId);
  
  if (envClientId) {
    console.log('✅ [getGoogleClientId] Client ID encontrado en import.meta.env:', envClientId.substring(0, 20) + '...');
    return envClientId;
  }
  
  console.log('⚠️ [getGoogleClientId] No se encontró en import.meta.env, buscando en localStorage...');
  
  // Fallback 1: intentar desde localStorage (útil si se configuró manualmente)
  if (typeof window !== 'undefined') {
    const storedClientId = localStorage.getItem('GOOGLE_CLIENT_ID');
    console.log('💾 [getGoogleClientId] localStorage GOOGLE_CLIENT_ID:', storedClientId ? 'ENCONTRADO' : 'NO ENCONTRADO');
    if (storedClientId) {
      console.log('✅ [getGoogleClientId] Client ID encontrado en localStorage');
      return storedClientId;
    }
  }
  
  // No usar Client ID hardcodeado - esto causa errores si el Client ID no existe
  console.error('❌ [getGoogleClientId] No se encontró Client ID en variables de entorno ni en localStorage');
  console.error('❌ NO se usará un Client ID hardcodeado para evitar errores');
  return undefined;
};

// Client ID de Google - debe obtenerse de variables de entorno o backend
const GOOGLE_CLIENT_ID = getGoogleClientId();
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const TOKEN_STORAGE_KEY = 'google_drive_token';
const TOKEN_EXPIRY_KEY = 'google_drive_token_expiry';

// Debug: Verificar variables de entorno
if (typeof window !== 'undefined') {
  console.log('🔍 ========== DIAGNÓSTICO DE VARIABLES DE ENTORNO ==========');
  console.log('🔍 GOOGLE_CLIENT_ID final:', GOOGLE_CLIENT_ID || 'NO CONFIGURADA');
  console.log('🔍 Todas las variables VITE_*:', Object.keys(import.meta.env).filter(key => key.startsWith('VITE_')));
  console.log('🔍 import.meta.env completo:', import.meta.env);
  console.log('🔍 import.meta.env.MODE:', import.meta.env.MODE);
  console.log('🔍 import.meta.env.BASE_URL:', import.meta.env.BASE_URL);
  
  // Listar todas las propiedades de import.meta.env
  console.log('🔍 Todas las propiedades de import.meta.env:');
  Object.keys(import.meta.env).forEach(key => {
    console.log(`  - ${key}:`, import.meta.env[key]);
  });
  
  // Si no está configurada, mostrar instrucciones
  if (!GOOGLE_CLIENT_ID) {
    console.error('❌ ========== ERROR: VITE_GOOGLE_CLIENT_ID NO CONFIGURADA ==========');
    console.error('❌ VITE_GOOGLE_CLIENT_ID no está configurada en las variables de entorno.');
    console.log('📝 Instrucciones para solucionar:');
    console.log('1. Verifica que el archivo .env existe en: project/.env');
    console.log('2. El archivo debe contener exactamente: VITE_GOOGLE_CLIENT_ID=355638125084-lecv3ob03pj367159gpd41r5qm773439.apps.googleusercontent.com');
    console.log('3. NO debe haber espacios alrededor del signo =');
    console.log('4. NO debe haber comillas alrededor del valor');
    console.log('5. REINICIA el servidor de desarrollo completamente:');
    console.log('   - Detén el servidor (Ctrl+C)');
    console.log('   - Inicia de nuevo: npm run dev');
    console.log('6. Vite solo carga variables de entorno al INICIAR el servidor');
    console.log('7. Recarga la página después de reiniciar el servidor');
    console.log('');
    console.log('💡 Solución temporal (solo para pruebas):');
    console.log('   Ejecuta en la consola del navegador:');
    console.log('   localStorage.setItem("GOOGLE_CLIENT_ID", "355638125084-lecv3ob03pj367159gpd41r5qm773439.apps.googleusercontent.com");');
    console.log('   Luego recarga la página (F5)');
  } else {
    console.log('✅ Client ID configurado correctamente:', GOOGLE_CLIENT_ID.substring(0, 30) + '...');
  }
  console.log('🔍 ========================================================');
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

/**
 * Espera a que Google API esté cargada
 */
async function waitForGoogleAPI(maxWait = 10000): Promise<void> {
  const startTime = Date.now();
  
  while (typeof window === 'undefined' || !window.gapi) {
    if (Date.now() - startTime > maxWait) {
      throw new Error('Google API no se cargó después de 10 segundos. Verifica que los scripts estén en index.html');
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

/**
 * Inicializa Google API client
 */
export async function initializeGoogleAPI(): Promise<void> {
  // Esperar a que Google API esté cargada
  await waitForGoogleAPI();

  return new Promise((resolve, reject) => {
    // Verificar que gapi esté disponible
    if (!window.gapi) {
      reject(new Error('Google API no está cargada. Asegúrate de incluir los scripts en index.html'));
      return;
    }

    // Verificar Client ID
    if (!GOOGLE_CLIENT_ID) {
      reject(new Error('VITE_GOOGLE_CLIENT_ID no está configurada. Verifica tu archivo .env'));
      return;
    }

    // Cargar cliente de autenticación
    window.gapi.load('client:auth2', () => {
      window.gapi.client
        .init({
          clientId: GOOGLE_CLIENT_ID,
          scope: DRIVE_SCOPE,
        })
        .then(() => {
          console.log('✅ Google API inicializada correctamente');
          resolve();
        })
        .catch((error: any) => {
          console.error('❌ Error inicializando Google API:', error);
          
          let errorMessage = `Error al inicializar Google API: ${error.error || error.message || 'Error desconocido'}`;
          
          // Mensaje específico para origen no autorizado
          if (error.error === 'idpiframe_initialization_failed' || error.details?.includes('Not a valid origin') || error.details?.includes('new client application')) {
            errorMessage = `El origen ${window.location.origin} no está autorizado en Google Cloud Console. ` +
              `Ve a Google Cloud Console → Credenciales → Tu Client ID → Agrega "${window.location.origin}" en "Orígenes JavaScript autorizados".`;
            console.error('📝 ========== INSTRUCCIONES DETALLADAS ==========');
            console.error('El Client ID debe ser de tipo "Aplicación web" (no "Escritorio")');
            console.error('');
            console.error('PASOS:');
            console.error('1. Ve a https://console.cloud.google.com/');
            console.error('2. Selecciona tu proyecto');
            console.error('3. Ve a "APIs y servicios" → "Credenciales"');
            console.error(`4. Busca y haz clic en tu Client ID: ${GOOGLE_CLIENT_ID?.substring(0, 40)}...`);
            console.error('5. VERIFICA que el tipo sea "Aplicación web" (si es "Escritorio", cámbialo)');
            console.error(`6. En "Orígenes JavaScript autorizados", agrega:`);
            console.error(`   - ${window.location.origin}`);
            console.error(`   - http://127.0.0.1:5173 (alternativa)`);
            console.error('7. En "URI de redirección autorizados", agrega:');
            console.error(`   - ${window.location.origin}`);
            console.error(`   - http://127.0.0.1:5173 (alternativa)`);
            console.error('8. Haz clic en "GUARDAR"');
            console.error('9. Espera 1-2 minutos para que los cambios se propaguen');
            console.error('10. Recarga esta página y vuelve a intentar');
            console.error('===============================================');
          }
          
          reject(new Error(errorMessage));
        });
    });
  });
}

/**
 * Autentica al usuario con Google OAuth 2.0
 */
export async function authenticateGoogle(): Promise<string> {
  console.log('🔐 ========== INICIANDO AUTENTICACIÓN CON GOOGLE ==========');
  console.log('🔐 [authenticateGoogle] Verificando Client ID...');
  console.log('🔐 [authenticateGoogle] GOOGLE_CLIENT_ID:', GOOGLE_CLIENT_ID || 'NO CONFIGURADA');
  console.log('🔐 [authenticateGoogle] Tipo:', typeof GOOGLE_CLIENT_ID);
  console.log('🔐 [authenticateGoogle] Es truthy?', !!GOOGLE_CLIENT_ID);
  
  if (!GOOGLE_CLIENT_ID) {
    const errorMsg = 'VITE_GOOGLE_CLIENT_ID no está configurada en las variables de entorno. Verifica tu archivo .env';
    console.error('❌ [authenticateGoogle]', errorMsg);
    console.error('❌ [authenticateGoogle] Revisa la consola para ver el diagnóstico completo de variables de entorno');
    throw new Error(errorMsg);
  }

  console.log('✅ [authenticateGoogle] Client ID configurado:', GOOGLE_CLIENT_ID.substring(0, 20) + '...');

  try {
    // Esperar a que Google API esté cargada
    await waitForGoogleAPI();

    // Inicializar si no está inicializado
    if (!window.gapi.auth2) {
      console.log('🔄 Inicializando Google API...');
      await initializeGoogleAPI();
    }

    console.log('🔑 Obteniendo instancia de autenticación...');
    const authInstance = window.gapi.auth2.getAuthInstance();
    
    if (!authInstance) {
      throw new Error('No se pudo obtener la instancia de autenticación de Google');
    }

    console.log('👤 Iniciando flujo de autenticación...');
    console.log('💡 NOTA: Se abrirá una ventana emergente. Asegúrate de permitir ventanas emergentes para este sitio.');
    
    // Verificar si ya hay una sesión activa
    const currentUser = authInstance.currentUser.get();
    if (currentUser && currentUser.isSignedIn()) {
      console.log('✅ Usuario ya autenticado, verificando token...');
      const existingAuthResponse = currentUser.getAuthResponse();
      if (existingAuthResponse && existingAuthResponse.access_token) {
        // Verificar si el token aún es válido
        const storedExpiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
        if (storedExpiry) {
          const expiryTime = parseInt(storedExpiry, 10);
          const now = Date.now();
          const margin = 5 * 60 * 1000; // 5 minutos
          
          if (now < expiryTime - margin) {
            console.log('✅ Token existente aún válido, usando sesión actual');
            return existingAuthResponse.access_token;
          }
        }
      }
    }

    // Si no hay sesión válida, iniciar nuevo flujo
    console.log('🔄 Iniciando nuevo flujo de autenticación...');
    console.log('⏳ Esperando respuesta de Google (esto puede tardar unos segundos)...');
    console.log('📋 Instrucciones:');
    console.log('   - Se abrirá una ventana emergente');
    console.log('   - Completa la autenticación en esa ventana');
    console.log('   - NO cierres la ventana hasta que veas "Acceso concedido" o similar');
    console.log('   - La ventana se cerrará automáticamente cuando termine');
    
    // Crear una promesa con timeout para detectar si el popup se cierra prematuramente
    const signInPromise = authInstance.signIn({
      scope: DRIVE_SCOPE,
      // No usar prompt para evitar que se cierre el popup
    });
    
    // Timeout de seguridad (5 minutos)
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('Timeout: La autenticación tardó demasiado. Por favor, intenta nuevamente.'));
      }, 5 * 60 * 1000); // 5 minutos
    });
    
    const user = await Promise.race([signInPromise, timeoutPromise]) as any;

    const authResponse = user.getAuthResponse();
    if (!authResponse || !authResponse.access_token) {
      throw new Error('No se recibió token de acceso de Google');
    }

    const token = authResponse.access_token;
    const expiresIn = authResponse.expires_in;

    console.log('✅ Autenticación exitosa, guardando token...');

    // Guardar token con timestamp de expiración
    const expiryTime = Date.now() + expiresIn * 1000;
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString());

    return token;
  } catch (error: any) {
    console.error('❌ Error en autenticación Google:', error);
    
    // Mensajes de error más específicos
    let errorMessage = 'Error desconocido';
    
    if (error.error === 'popup_closed_by_user') {
      errorMessage = 'La ventana de autenticación fue cerrada. ' +
        'Si no la cerraste manualmente, tu navegador puede estar bloqueando ventanas emergentes. ' +
        'Por favor, permite ventanas emergentes para este sitio e intenta nuevamente.';
      console.warn('⚠️ La ventana emergente fue cerrada. Posibles causas:');
      console.warn('1. El navegador bloqueó la ventana emergente');
      console.warn('2. El usuario cerró la ventana manualmente');
      console.warn('3. Problema con Cross-Origin-Opener-Policy');
      console.warn('💡 Solución: Verifica la configuración de ventanas emergentes en tu navegador');
    } else if (error.error === 'access_denied') {
      // Verificar si es por modo de prueba
      if (error.details?.includes('verification') || error.details?.includes('test') || 
          error.message?.includes('verificación') || error.message?.includes('test')) {
        errorMessage = 'La aplicación está en modo de prueba. ' +
          'Ve a Google Cloud Console → Pantalla de consentimiento OAuth → Agrega tu email como "Usuario de prueba" o publica la aplicación.';
        console.error('📝 ========== SOLUCIÓN: MODO DE PRUEBA ==========');
        console.error('Tu aplicación OAuth está en modo de prueba.');
        console.error('OPCIÓN 1: Agregar usuarios de prueba (recomendado para desarrollo)');
        console.error('1. Ve a https://console.cloud.google.com/');
        console.error('2. Selecciona tu proyecto');
        console.error('3. Ve a "APIs y servicios" → "Pantalla de consentimiento OAuth"');
        console.error('4. Haz clic en "Agregar usuarios" en la sección "Usuarios de prueba"');
        console.error('5. Agrega tu email: leojosemartin@gmail.com');
        console.error('6. Guarda los cambios');
        console.error('');
        console.error('OPCIÓN 2: Publicar la aplicación (para producción)');
        console.error('1. Ve a "Pantalla de consentimiento OAuth"');
        console.error('2. Haz clic en "PUBLICAR APLICACIÓN"');
        console.error('3. Sigue el proceso de verificación (puede tardar varios días)');
        console.error('===============================================');
      } else {
        errorMessage = 'Acceso denegado. Por favor, acepta los permisos necesarios.';
      }
    } else if (error.error === 'popup_blocked') {
      errorMessage = 'El navegador bloqueó la ventana emergente. Por favor, permite ventanas emergentes para este sitio.';
    } else if (error.error) {
      errorMessage = `Error de Google: ${error.error}`;
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    throw new Error(`Error al autenticar con Google: ${errorMessage}`);
  }
}

/**
 * Obtiene el token de acceso válido (verifica expiración y refresca si es necesario)
 */
export async function getAccessToken(): Promise<string> {
  const storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
  const storedExpiry = localStorage.getItem(TOKEN_EXPIRY_KEY);

  // Si no hay token guardado, autenticar
  if (!storedToken || !storedExpiry) {
    return await authenticateGoogle();
  }

  // Verificar si el token expiró (con margen de 5 minutos)
  const expiryTime = parseInt(storedExpiry, 10);
  const now = Date.now();
  const margin = 5 * 60 * 1000; // 5 minutos

  if (now >= expiryTime - margin) {
    // Token expirado o próximo a expirar, re-autenticar
    console.log('Token expirado, re-autenticando...');
    return await authenticateGoogle();
  }

  return storedToken;
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
 * Cierra la sesión de Google
 */
export async function signOutGoogle(): Promise<void> {
  if (typeof window === 'undefined' || !window.gapi) {
    return;
  }

  try {
    const authInstance = window.gapi.auth2.getAuthInstance();
    if (authInstance) {
      await authInstance.signOut();
    }
  } catch (error) {
    console.error('Error al cerrar sesión:', error);
  }

  // Limpiar localStorage
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
}

// Extender Window interface para TypeScript
declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

