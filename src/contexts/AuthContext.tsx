import { createContext, useContext, useEffect, useState } from 'react';
import { User, AuthError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Database } from '../lib/database.types';

type Profile = Database['public']['Tables']['profiles']['Row'];

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Verificar si hay una sesión activa
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      (async () => {
        // Si el evento es SIGNED_OUT, asegurarse de limpiar todo
        if (event === 'SIGNED_OUT') {
          setUser(null);
          setProfile(null);
          setLoading(false);
          return;
        }
        
        setUser(session?.user ?? null);
        if (session?.user) {
          await loadProfile(session.user.id);
        } else {
          setProfile(null);
          setLoading(false);
        }
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        // Si hay error, cerrar sesión para evitar estado inconsistente
        await supabase.auth.signOut();
        setProfile(null);
        setUser(null);
        setLoading(false);
        return;
      }

      if (!data) {
        // Si no existe el perfil, cerrar sesión
        await supabase.auth.signOut();
        setProfile(null);
        setUser(null);
        setLoading(false);
        return;
      }

      setProfile(data);
      setLoading(false);
    } catch (error) {
      await supabase.auth.signOut();
      setProfile(null);
      setUser(null);
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    // Determinar la URL de redirección
    // Si la URL no está permitida en Supabase, no enviará el email
    // Por eso, solo usamos emailRedirectTo si estamos seguros de que la URL está permitida
    let redirectUrl: string | undefined;
    
    // Solo configurar redirect si no estamos en localhost o si tenemos URL de producción configurada
    if (import.meta.env.VITE_APP_URL) {
      // Si hay una variable de entorno configurada, usarla
      redirectUrl = `${import.meta.env.VITE_APP_URL}/confirm-email`;
    } else if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      // Solo usar redirect si NO estamos en localhost (es decir, estamos en producción)
      redirectUrl = `${window.location.origin}/confirm-email`;
    }
    // Si estamos en localhost y no hay VITE_APP_URL, no configuramos redirect
    // Esto permite que Supabase use su configuración por defecto
    
    const signUpOptions: any = {
      data: {
        full_name: fullName,
        role: 'user',
      },
    };
    
    // Solo agregar emailRedirectTo si tenemos una URL válida
    if (redirectUrl) {
      signUpOptions.emailRedirectTo = redirectUrl;
      console.log('📧 Usando URL de redirección:', redirectUrl);
    } else {
      console.log('📧 No se configuró emailRedirectTo - Supabase usará su configuración por defecto');
    }
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: signUpOptions,
    });
    
    // Si hay error relacionado con la URL de redirección, intentar sin ella
    if (error && redirectUrl && (error.message.includes('redirect') || error.message.includes('URL'))) {
      console.warn('⚠️ Error con URL de redirección, intentando sin ella:', error.message);
      const { error: retryError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role: 'user',
          },
        },
      });
      return { error: retryError };
    }
    
    return { error };
  };

  const signOut = async () => {
    try {
      // Limpiar el estado local primero para evitar que se restaure
      setProfile(null);
      setUser(null);
      setLoading(true);
      
      // Cerrar sesión en Supabase
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('Error al cerrar sesión:', error);
      }
      
      // Limpiar explícitamente el almacenamiento de Supabase
      // Supabase almacena la sesión en localStorage con claves específicas
      // El formato típico es: sb-{project-ref}-auth-token
      // IMPORTANTE: NO limpiar tokens de Google Drive para mantener la autenticación
      try {
        // Claves de Google Drive que NO debemos eliminar
        const googleDriveKeysToKeep = [
          'google_drive_token',
          'google_drive_token_expiry',
          'google_drive_access_token',
          'google_drive_token_expiry',
          'google_drive_refresh_token',
          'google_oauth_token',
          'google_oauth_token_expiry'
        ];
        
        // Buscar todas las claves de Supabase (excluyendo las de Google Drive)
        const allKeys = Object.keys(localStorage);
        const supabaseKeys = allKeys.filter(key => 
          (key.startsWith('sb-') || 
           key.includes('supabase') ||
           (key.includes('auth') && (key.includes('token') || key.includes('session')))) &&
          !googleDriveKeysToKeep.includes(key)
        );
        
        supabaseKeys.forEach(key => {
          localStorage.removeItem(key);
        });
        
        // También limpiar sessionStorage por si acaso (excluyendo Google Drive)
        const sessionKeys = Object.keys(sessionStorage).filter(key => 
          (key.startsWith('sb-') || 
           key.includes('supabase') ||
           (key.includes('auth') && (key.includes('token') || key.includes('session')))) &&
          !googleDriveKeysToKeep.includes(key)
        );
        sessionKeys.forEach(key => {
          sessionStorage.removeItem(key);
        });
      } catch (e) {
        console.warn('Error limpiando almacenamiento:', e);
      }
      
      // NO limpiar tokens de Google Drive - mantener la autenticación guardada
      // Los tokens de Google Drive se mantienen para que el usuario no tenga que volver a autenticar
      
      // Esperar un momento para asegurar que todo se limpie
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Forzar recarga completa de la página para limpiar todo el estado
      // Usar window.location.reload() para asegurar que se recargue completamente
      window.location.replace(window.location.origin);
    } catch (error) {
      console.error('Error inesperado al cerrar sesión:', error);
      // Forzar limpieza completa
      setProfile(null);
      setUser(null);
      setLoading(true);
      
      // Limpiar todo el almacenamiento relacionado con autenticación
      // IMPORTANTE: NO limpiar tokens de Google Drive
      try {
        // Claves de Google Drive que NO debemos eliminar
        const googleDriveKeysToKeep = [
          'google_drive_token',
          'google_drive_token_expiry',
          'google_drive_access_token',
          'google_drive_token_expiry',
          'google_drive_refresh_token',
          'google_oauth_token',
          'google_oauth_token_expiry'
        ];
        
        // Limpiar solo las claves relacionadas con auth, excluyendo Google Drive
        const authKeys = Object.keys(localStorage).filter(key => 
          (key.startsWith('sb-') || 
           key.includes('supabase') ||
           key.includes('auth')) &&
          !googleDriveKeysToKeep.includes(key) &&
          !key.toLowerCase().includes('google_drive') &&
          !key.toLowerCase().includes('gapi')
        );
        authKeys.forEach(key => localStorage.removeItem(key));
        
        const sessionAuthKeys = Object.keys(sessionStorage).filter(key => 
          (key.startsWith('sb-') || 
           key.includes('supabase') ||
           key.includes('auth')) &&
          !googleDriveKeysToKeep.includes(key)
        );
        sessionAuthKeys.forEach(key => sessionStorage.removeItem(key));
      } catch (e) {
        console.warn('Error limpiando almacenamiento:', e);
      }
      
      // Redirigir
      window.location.replace(window.location.origin);
    }
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error };
  };

  const value = {
    user,
    profile,
    loading,
    signIn,
    signUp,
    signOut,
    resetPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}