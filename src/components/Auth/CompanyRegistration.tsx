import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { AuthError } from '@supabase/supabase-js';

interface CompanyRegistrationProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function CompanyRegistration({ onSuccess, onCancel }: CompanyRegistrationProps) {
  const [formData, setFormData] = useState({
    companyName: '',
    companySlug: '',
    email: '',
    password: '',
    fullName: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  const handleCompanyNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setFormData({
      ...formData,
      companyName: name,
      companySlug: generateSlug(name),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      // 1. Verificar que el slug sea único
      const { data: existingTenant } = await supabase
        .from('tenants')
        .select('id')
        .eq('slug', formData.companySlug)
        .maybeSingle();

      if (existingTenant) {
        setError('Este nombre de empresa ya está en uso. Por favor, elige otro.');
        setLoading(false);
        return;
      }

      // 2. Crear el tenant (empresa) PRIMERO usando función SECURITY DEFINER
      const { data: tenantId, error: tenantError } = await supabase.rpc(
        'create_tenant_for_registration',
        {
          tenant_name: formData.companyName,
          tenant_slug: formData.companySlug,
          tenant_settings: {},
        }
      );

      if (tenantError) {
        console.error('Error al crear tenant:', tenantError);
        setError(tenantError.message || 'Error al crear la empresa');
        setLoading(false);
        return;
      }

      // La función retorna el UUID directamente
      if (!tenantId) {
        console.error('No se recibió tenantId de la función RPC');
        setError('Error al crear la empresa: no se recibió el ID del tenant');
        setLoading(false);
        return;
      }

      // Validar que tenantId es un UUID válido
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(String(tenantId))) {
        console.error('TenantId no es un UUID válido:', tenantId);
        setError('Error al crear la empresa: ID de tenant inválido');
        setLoading(false);
        // Limpiar el tenant creado si es posible
        try {
          await supabase.from('tenants').delete().eq('id', tenantId);
        } catch (e) {
          console.error('Error al limpiar tenant:', e);
        }
        return;
      }

      console.log('Tenant creado con ID:', tenantId);
      console.log('Tenant ID validado como UUID válido');

      // 3. Determinar la URL de redirección para el email de confirmación
      let redirectUrl: string | undefined;
      if (import.meta.env.VITE_APP_URL) {
        redirectUrl = `${import.meta.env.VITE_APP_URL}/confirm-email`;
      } else if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        redirectUrl = `${window.location.origin}/confirm-email`;
      } else {
        // En localhost, usar la URL actual
        redirectUrl = `${window.location.origin}/confirm-email`;
      }

      console.log('📧 URL de redirección para email:', redirectUrl);

      // 4. Crear el usuario en Supabase Auth CON el tenant_id en metadata
      // IMPORTANTE: El tenant_id debe ser un string UUID válido
      console.log('Creando usuario con tenant_id:', tenantId);
      console.log('Tenant ID tipo:', typeof tenantId);
      console.log('Tenant ID como string:', String(tenantId));
      
      // 4. Crear el usuario en Supabase Auth CON el tenant_id en metadata
      // El email se enviará automáticamente durante el signUp si emailRedirectTo está configurado
      console.log('Creando usuario con tenant_id:', tenantId);
      console.log('📧 Email se enviará automáticamente a:', formData.email);
      console.log('📧 URL de redirección:', redirectUrl);
      
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: redirectUrl, // Esto hace que Supabase envíe el email automáticamente
          data: {
            full_name: formData.fullName,
            role: 'admin',
            tenant_id: String(tenantId), // Asegurar que sea string
          },
        },
      });

      console.log('Usuario creado:', authData?.user?.id);
      console.log('Email confirmado:', authData?.user?.email_confirmed_at);

      // Manejar el caso donde el usuario se crea pero el trigger falla
      if (signUpError) {
        console.error('Error al crear usuario:', signUpError);
        
        // Si el error es "Database error saving new user", el usuario podría haberse creado
        // pero el trigger falló. Intentar crear el perfil manualmente.
        if (signUpError.message?.includes('Database error saving new user') && authData?.user) {
          console.log('Usuario creado pero trigger falló. Intentando crear perfil manualmente...');
          
          // Intentar crear el perfil manualmente usando una función RPC
          const { error: profileCreateError } = await supabase.rpc('create_profile_for_user', {
            user_id: authData.user.id,
            user_email: formData.email,
            user_full_name: formData.fullName,
            user_role: 'admin',
            user_tenant_id: tenantId
          });
          
          if (profileCreateError) {
            console.error('Error al crear perfil manualmente:', profileCreateError);
            // Si falla, eliminar tenant y usuario
            try {
              await supabase.from('tenants').delete().eq('id', tenantId);
            } catch (deleteError) {
              console.error('Error al eliminar tenant:', deleteError);
            }
            setError('Error al crear el perfil del usuario. Por favor, contacta al administrador.');
            setLoading(false);
            return;
          } else {
            // Perfil creado exitosamente, continuar
            console.log('Perfil creado manualmente exitosamente');
          }
        } else {
          // Error real, eliminar tenant
          try {
            await supabase.from('tenants').delete().eq('id', tenantId);
          } catch (deleteError) {
            console.error('Error al eliminar tenant:', deleteError);
          }
          setError(signUpError.message || 'Error al crear el usuario. Por favor, verifica los datos e intenta de nuevo.');
          setLoading(false);
          return;
        }
      }

      if (!authData?.user) {
        // Si no se creó el usuario, eliminar el tenant
        try {
          await supabase.from('tenants').delete().eq('id', tenantId);
        } catch (deleteError) {
          console.error('Error al eliminar tenant:', deleteError);
        }
        setError('Error al crear el usuario');
        setLoading(false);
        return;
      }

      // 4. El trigger handle_new_user debería crear el perfil automáticamente
      // Esperamos un momento para que el trigger complete
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log('✅ Usuario creado exitosamente. El trigger debería haber creado el perfil automáticamente.');

      // 5. Mostrar mensaje de éxito
      // El email se envía automáticamente durante signUp si emailRedirectTo está configurado
      if (authData.user?.email_confirmed_at) {
        setMessage(`¡Empresa creada exitosamente! Tu cuenta ya está confirmada. Puedes iniciar sesión ahora.`);
      } else {
        setMessage(`¡Empresa creada exitosamente! Se ha enviado un correo de verificación a ${formData.email}. Por favor, revisa tu bandeja de entrada (y la carpeta de spam) y haz clic en el enlace para confirmar tu cuenta antes de iniciar sesión.`);
      }
      
      // Esperar un momento antes de llamar a onSuccess
      setTimeout(() => {
        if (onSuccess) {
          onSuccess();
        }
      }, 2000);
    } catch (err) {
      console.error('Error en registro:', err);
      setError('Ocurrió un error inesperado. Por favor, intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
          Registrar Nueva Empresa
        </h2>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded text-green-700 dark:text-green-400 text-sm">
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Nombre de la Empresa <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.companyName}
              onChange={handleCompanyNameChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
              placeholder="Mi Empresa S.A."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Slug (URL) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.companySlug}
              onChange={(e) => setFormData({ ...formData, companySlug: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
              placeholder="mi-empresa"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Se usará para identificar tu empresa en el sistema
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Nombre Completo <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
              placeholder="Juan Pérez"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
              placeholder="tu@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Contraseña <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white"
              placeholder="Mínimo 6 caracteres"
            />
          </div>

          <div className="flex gap-3 pt-4">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                disabled={loading}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50"
              >
                Cancelar
              </button>
            )}
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creando...' : 'Crear Empresa'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

