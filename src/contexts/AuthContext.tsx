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
    console.log('🔵 AuthContext: Iniciando...');
    
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('🔵 AuthContext: Sesión obtenida:', session?.user?.email || 'No hay sesión');
      setUser(session?.user ?? null);
      if (session?.user) {
        console.log('🔵 AuthContext: Cargando perfil para:', session.user.id);
        loadProfile(session.user.id);
      } else {
        console.log('🔵 AuthContext: No hay usuario, terminando carga');
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('🔵 AuthContext: Cambio de auth detectado:', _event);
      (async () => {
        setUser(session?.user ?? null);
        if (session?.user) {
          console.log('🔵 AuthContext: Cargando perfil (onAuthStateChange):', session.user.id);
          await loadProfile(session.user.id);
        } else {
          console.log('🔵 AuthContext: Usuario deslogueado');
          setProfile(null);
          setLoading(false);
        }
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadProfile = async (userId: string) => {
    console.log('🟢 loadProfile: Iniciando para userId:', userId);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      console.log('🟢 loadProfile: Respuesta recibida:', { data, error });

      if (error) {
        console.error('🔴 loadProfile: Error al cargar perfil:', error);
        // Si hay error, cerrar sesión para evitar estado inconsistente
        await supabase.auth.signOut();
        setProfile(null);
        setUser(null);
        setLoading(false);
        return;
      }

      if (!data) {
        console.error('🔴 loadProfile: Perfil no encontrado para userId:', userId);
        // Si no existe el perfil, cerrar sesión
        await supabase.auth.signOut();
        setProfile(null);
        setUser(null);
        setLoading(false);
        return;
      }

      console.log('✅ loadProfile: Perfil cargado exitosamente:', data.full_name, data.role);
      setProfile(data);
      setLoading(false);
    } catch (error) {
      console.error('🔴 loadProfile: Error inesperado:', error);
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
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role: 'user',
        },
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
