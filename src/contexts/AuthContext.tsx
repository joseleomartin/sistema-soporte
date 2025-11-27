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
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
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
    await supabase.auth.signOut();
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
