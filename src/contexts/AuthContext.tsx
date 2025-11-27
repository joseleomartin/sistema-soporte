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
    // Prioridad: 1) VITE_APP_URL (producción), 2) Detectar si estamos en localhost y usar producción, 3) URL actual
    let redirectUrl: string;
    
    if (import.meta.env.VITE_APP_URL) {
      // Si hay una variable de entorno configurada, usarla
      redirectUrl = `${import.meta.env.VITE_APP_URL}/confirm-email`;
    } else if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      // Si estamos en localhost, intentar usar la URL de producción desde Vercel
      // Esto es importante porque los emails de confirmación deben apuntar a producción
      const vercelUrl = import.meta.env.VITE_VERCEL_URL || import.meta.env.VERCEL_URL;
      if (vercelUrl) {
        redirectUrl = `https://${vercelUrl}/confirm-email`;
      } else {
        // Si no hay URL de producción, usar la URL actual (pero esto causará problemas)
        // Mejor usar una URL de producción hardcodeada o mostrar un error
        console.warn('⚠️ Registro desde localhost sin URL de producción configurada. El email de confirmación puede no funcionar correctamente.');
        redirectUrl = `${window.location.origin}/confirm-email`;
      }
    } else {
      // Si no estamos en localhost, usar la URL actual (debería ser producción)
      redirectUrl = `${window.location.origin}/confirm-email`;
    }
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role: 'user',
        },
        emailRedirectTo: redirectUrl,
      },
    });
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
