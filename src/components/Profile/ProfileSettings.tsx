import { useState, useRef, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import { Camera, User, Upload, CheckCircle, AlertCircle, Building2, Calendar, Eye, EyeOff, Home, Video, Users as UsersIcon, FolderOpen, Clock, CheckSquare, Wrench, Headphones, Settings, Layers, FileText, BookOpen, Briefcase, Heart, MessageSquare } from 'lucide-react';

export function ProfileSettings() {
  const { profile, user, refreshProfile } = useAuth();
  const { tenant, refreshTenant } = useTenant();
  const [uploading, setUploading] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [departments, setDepartments] = useState<any[]>([]);
  const [birthday, setBirthday] = useState<string>('');
  const [savingBirthday, setSavingBirthday] = useState(false);
  const [birthdayInitialized, setBirthdayInitialized] = useState(false);
  const [visibleModules, setVisibleModules] = useState<Record<string, boolean>>({});
  const [savingModules, setSavingModules] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Definir todos los módulos disponibles
  const allModules = [
    { key: 'dashboard', label: 'Inicio', icon: Home, category: 'main' },
    { key: 'meetings', label: 'Sala de Reuniones', icon: Video, category: 'main' },
    { key: 'departments', label: 'Áreas', icon: Layers, category: 'personas' },
    { key: 'internal-policies', label: 'Onboarding y Políticas Internas', icon: FileText, category: 'personas' },
    { key: 'library', label: 'Bibliotecas y Cursos', icon: BookOpen, category: 'personas' },
    { key: 'professional-news', label: 'Novedades Profesionales', icon: Briefcase, category: 'personas' },
    { key: 'vacations', label: 'Vacaciones y Licencias', icon: Calendar, category: 'personas' },
    { key: 'social', label: 'Social', icon: Heart, category: 'personas' },
    { key: 'forums', label: 'Clientes', icon: FolderOpen, category: 'negocio' },
    { key: 'time-tracking', label: 'Carga de Horas', icon: Clock, category: 'negocio' },
    { key: 'tasks', label: 'Tareas', icon: CheckSquare, category: 'negocio' },
    { key: 'tools', label: 'Herramientas', icon: Wrench, category: 'negocio' },
    { key: 'tickets', label: 'Soporte', icon: Headphones, category: 'main' },
    { key: 'direct-messages', label: 'Chat / Mensajes Directos', icon: MessageSquare, category: 'main' },
  ];

  useEffect(() => {
    if (profile?.avatar_url) {
      setAvatarUrl(profile.avatar_url);
    }
    if (tenant?.logo_url) {
      setLogoUrl(tenant.logo_url);
    }
    // Solo inicializar el birthday una vez cuando se carga el perfil
    if (!birthdayInitialized && profile) {
      if (profile.birthday) {
        // Parsear la fecha directamente del string para evitar problemas de zona horaria
        // La fecha viene en formato ISO (YYYY-MM-DD) o como string de fecha
        let dateStr = profile.birthday;
        
        // Si es un objeto Date o string ISO completo, extraer solo la parte de fecha
        if (dateStr.includes('T')) {
          dateStr = dateStr.split('T')[0];
        }
        
        // Verificar que tenga el formato correcto YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
          setBirthday(dateStr);
        } else {
          // Fallback: intentar parsear con Date pero usando solo fecha local
          const date = new Date(dateStr + 'T12:00:00'); // Usar mediodía para evitar cambios de día
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          setBirthday(`${year}-${month}-${day}`);
        }
      } else {
        setBirthday('');
      }
      setBirthdayInitialized(true);
    }
    loadDepartments();
    if (profile?.role === 'admin') {
      loadVisibleModules();
    }
  }, [profile?.id, profile?.birthday, profile?.role, birthdayInitialized, tenant?.logo_url, tenant?.id]);

  const loadVisibleModules = async () => {
    if (!profile?.id || !tenant?.id) return;

    try {
      // Cargar módulos visibles del tenant (no del perfil individual)
      const { data } = await supabase
        .from('tenants')
        .select('visible_modules')
        .eq('id', tenant.id)
        .single();

      if (data?.visible_modules) {
        const modules = data.visible_modules as Record<string, boolean> | null;
        if (modules && typeof modules === 'object') {
          setVisibleModules(modules);
        } else {
          // Si no hay configuración válida, todos los módulos están visibles por defecto
          const defaultModules: Record<string, boolean> = {};
          allModules.forEach(module => {
            defaultModules[module.key] = true;
          });
          setVisibleModules(defaultModules);
        }
      } else {
        // Si no hay configuración, todos los módulos están visibles por defecto
        const defaultModules: Record<string, boolean> = {};
        allModules.forEach(module => {
          defaultModules[module.key] = true;
        });
        setVisibleModules(defaultModules);
      }
    } catch (error) {
      console.error('Error loading visible modules:', error);
      // En caso de error, todos los módulos están visibles por defecto
      const defaultModules: Record<string, boolean> = {};
      allModules.forEach(module => {
        defaultModules[module.key] = true;
      });
      setVisibleModules(defaultModules);
    }
  };

  const handleModuleToggle = async (moduleKey: string) => {
    if (!profile?.id || !tenant?.id) return;

    const newModules = {
      ...visibleModules,
      [moduleKey]: !visibleModules[moduleKey]
    };
    
    setVisibleModules(newModules);
    setSavingModules(true);

    try {
      // Guardar en tenants, no en profiles
      const { error } = await supabase
        .from('tenants')
        .update({ visible_modules: newModules })
        .eq('id', tenant.id);

      if (error) throw error;

      // Recargar el tenant para actualizar el contexto
      await refreshTenant();

      setMessage({ type: 'success', text: 'Módulos actualizados correctamente. Los cambios se aplicarán a todos los usuarios de la empresa.' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      console.error('Error saving visible modules:', error);
      setMessage({ type: 'error', text: 'Error al guardar los módulos' });
      // Revertir el cambio
      setVisibleModules(visibleModules);
    } finally {
      setSavingModules(false);
    }
  };

  const loadDepartments = async () => {
    if (!profile?.id) return;

    try {
      const { data } = await supabase
        .from('user_departments')
        .select(`
          departments (
            id,
            name,
            color
          )
        `)
        .eq('user_id', profile.id);

      setDepartments(data?.map((d: any) => d.departments) || []);
    } catch (error) {
      console.error('Error loading departments:', error);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      setMessage(null);

      if (!e.target.files || e.target.files.length === 0) {
        return;
      }

      const file = e.target.files[0];

      // Validar tipo de archivo
      if (!file.type.startsWith('image/')) {
        setMessage({ type: 'error', text: 'Por favor selecciona una imagen válida' });
        return;
      }

      // Validar tamaño (máximo 2MB)
      if (file.size > 2 * 1024 * 1024) {
        setMessage({ type: 'error', text: 'La imagen no debe superar los 2MB' });
        return;
      }

      // Eliminar avatar anterior si existe
      if (profile?.avatar_url) {
        const oldPath = profile.avatar_url.split('/').pop();
        if (oldPath) {
          await supabase.storage
            .from('avatars')
            .remove([`${user?.id}/${oldPath}`]);
        }
      }

      // Subir nueva imagen
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${user?.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Obtener URL pública
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Actualizar perfil
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: urlData.publicUrl })
        .eq('id', user?.id);

      if (updateError) throw updateError;

      setAvatarUrl(urlData.publicUrl);
      setMessage({ type: 'success', text: 'Foto de perfil actualizada correctamente' });
      setTimeout(() => setMessage(null), 3000);

      // Recargar la página para actualizar el avatar en toda la aplicación
      setTimeout(() => window.location.reload(), 1000);
    } catch (error: any) {
      console.error('Error uploading avatar:', error);
      setMessage({ type: 'error', text: error.message || 'Error al subir la imagen' });
    } finally {
      setUploading(false);
    }
  };

  const handleBirthdayInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBirthday(e.target.value);
  };

  const handleBirthdaySave = async () => {
    if (!user?.id) return;

    try {
      setSavingBirthday(true);
      
      // Si birthday está vacío, establecer null para eliminar la fecha
      let birthdayValue: string | null = birthday.trim() || null;
      
      // Validar formato de fecha antes de guardar (YYYY-MM-DD)
      if (birthdayValue && !/^\d{4}-\d{2}-\d{2}$/.test(birthdayValue)) {
        throw new Error('Formato de fecha inválido. Use el formato dd/mm/aaaa');
      }
      
      const { error } = await supabase
        .from('profiles')
        .update({ birthday: birthdayValue })
        .eq('id', user.id);

      if (error) throw error;
      
      setMessage({ type: 'success', text: 'Fecha de cumpleaños actualizada correctamente' });
      setTimeout(() => setMessage(null), 3000);
      
      // Marcar como inicializado para evitar que se resetee
      setBirthdayInitialized(true);
    } catch (error: any) {
      console.error('Error updating birthday:', error);
      setMessage({ type: 'error', text: error.message || 'Error al actualizar la fecha de cumpleaños' });
    } finally {
      setSavingBirthday(false);
    }
  };

  const handleLogoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!profile || profile.role !== 'admin' || !tenant?.id) {
      setMessage({ type: 'error', text: 'Solo los administradores pueden subir el logo de la empresa' });
      return;
    }

    try {
      setUploadingLogo(true);
      setMessage(null);

      if (!e.target.files || e.target.files.length === 0) {
        return;
      }

      const file = e.target.files[0];

      // Validar tipo de archivo
      if (!file.type.startsWith('image/')) {
        setMessage({ type: 'error', text: 'Por favor selecciona una imagen válida' });
        return;
      }

      // Validar tamaño (máximo 2MB)
      if (file.size > 2 * 1024 * 1024) {
        setMessage({ type: 'error', text: 'La imagen no debe superar los 2MB' });
        return;
      }

      // Eliminar logo anterior si existe
      if (tenant.logo_url) {
        try {
          // Extraer el path completo del logo anterior
          // El formato de la URL es: https://...supabase.co/storage/v1/object/public/company-logos/TENANT_ID/filename.png
          const urlParts = tenant.logo_url.split('/company-logos/');
          if (urlParts.length > 1) {
            const oldPath = urlParts[1]; // Esto incluye TENANT_ID/filename.png
            await supabase.storage
              .from('company-logos')
              .remove([oldPath]);
          } else {
            // Fallback: intentar extraer solo el nombre del archivo
            const oldPath = tenant.logo_url.split('/').pop();
            if (oldPath) {
              await supabase.storage
                .from('company-logos')
                .remove([`${tenant.id}/${oldPath}`]);
            }
          }
        } catch (deleteError) {
          console.warn('Error al eliminar logo anterior:', deleteError);
          // Continuar aunque falle la eliminación del logo anterior
        }
      }

      // Subir nueva imagen
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${tenant.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('company-logos')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Obtener URL pública
      const { data: urlData } = supabase.storage
        .from('company-logos')
        .getPublicUrl(filePath);

      // Actualizar tenant
      const { error: updateError } = await supabase
        .from('tenants')
        .update({ logo_url: urlData.publicUrl })
        .eq('id', tenant.id);

      if (updateError) throw updateError;

      setLogoUrl(urlData.publicUrl);
      
      // Actualizar el contexto del tenant sin recargar la página
      await refreshTenant();
      
      setMessage({ type: 'success', text: 'Logo de la empresa actualizado correctamente' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      console.error('Error uploading logo:', error);
      setMessage({ type: 'error', text: error.message || 'Error al subir el logo' });
    } finally {
      setUploadingLogo(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Configuración de Perfil</h2>

      {message && (
        <div className={`mb-6 rounded-lg p-4 flex items-start gap-3 ${
          message.type === 'success' 
            ? 'bg-green-50 border border-green-200' 
            : 'bg-red-50 border border-red-200'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          )}
          <p className={message.type === 'success' ? 'text-green-700' : 'text-red-700'}>
            {message.text}
          </p>
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-8">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Avatar Section */}
          <div className="flex flex-col items-center">
            <div className="relative group">
              <div className="w-32 h-32 rounded-full overflow-hidden bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-16 h-16 text-white" />
                )}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute bottom-0 right-0 p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition shadow-lg disabled:opacity-50"
              >
                {uploading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                  <Camera className="w-5 h-5" />
                )}
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-4 text-center">
              Haz clic en el ícono para cambiar tu foto
              <br />
              <span className="text-xs text-gray-500 dark:text-gray-400">Máximo 2MB</span>
            </p>
          </div>

          {/* Profile Info */}
          <div className="flex-1 space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Nombre Completo
              </label>
              <input
                type="text"
                value={profile?.full_name || ''}
                disabled
                className="w-full px-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg bg-gray-50 dark:bg-slate-700 text-gray-700 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Email
              </label>
              <input
                type="email"
                value={profile?.email || ''}
                disabled
                className="w-full px-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg bg-gray-50 dark:bg-slate-700 text-gray-700 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Rol
              </label>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                profile?.role === 'admin' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' :
                profile?.role === 'support' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' :
                'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}>
                {profile?.role === 'admin' ? 'Administrador' : 
                 profile?.role === 'support' ? 'Soporte' : 
                 'Usuario'}
              </span>
            </div>

            {departments.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Departamentos
                </label>
                <div className="flex flex-wrap gap-2">
                  {departments.map((dept) => (
                    <span
                      key={dept.id}
                      className="inline-flex items-center gap-2 px-3 py-1 rounded-lg text-sm font-medium"
                      style={{ 
                        backgroundColor: `${dept.color}20`,
                        color: dept.color
                      }}
                    >
                      <Building2 className="w-4 h-4" />
                      {dept.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Fecha de Cumpleaños
                </div>
              </label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={birthday}
                  onChange={handleBirthdayInputChange}
                  onBlur={handleBirthdaySave}
                  disabled={savingBirthday}
                  max={new Date().toISOString().split('T')[0]}
                  className="flex-1 px-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                />
                {savingBirthday && (
                  <div className="flex items-center px-4">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Tu cumpleaños aparecerá en la sección Social cuando sea tu día especial
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Company Logo Section - Solo para administradores */}
      {profile?.role === 'admin' && tenant && (
        <div className="mt-8 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-8">
          <div className="flex items-center gap-3 mb-6">
            <Building2 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Logo de la Empresa</h3>
          </div>

          <div className="flex flex-col md:flex-row gap-8">
            {/* Logo Preview */}
            <div className="flex flex-col items-center">
              <div className="relative group">
                <div className="w-32 h-32 rounded-lg overflow-hidden bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center border-2 border-gray-200 dark:border-slate-600">
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt="Logo de la empresa"
                      className="w-full h-full object-contain p-2"
                    />
                  ) : (
                    <Building2 className="w-16 h-16 text-white" />
                  )}
                </div>
                <button
                  onClick={() => logoInputRef.current?.click()}
                  disabled={uploadingLogo}
                  className="absolute bottom-0 right-0 p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition shadow-lg disabled:opacity-50"
                >
                  {uploadingLogo ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  ) : (
                    <Camera className="w-5 h-5" />
                  )}
                </button>
              </div>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoSelect}
                className="hidden"
              />
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-4 text-center">
                Haz clic en el ícono para cambiar el logo
                <br />
                <span className="text-xs text-gray-500 dark:text-gray-400">Máximo 2MB</span>
              </p>
            </div>

            {/* Company Info */}
            <div className="flex-1 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Nombre de la Empresa
                </label>
                <input
                  type="text"
                  value={tenant.name || ''}
                  disabled
                  className="w-full px-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg bg-gray-50 dark:bg-slate-700 text-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Slug
                </label>
                <input
                  type="text"
                  value={tenant.slug || ''}
                  disabled
                  className="w-full px-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg bg-gray-50 dark:bg-slate-700 text-gray-700 dark:text-white"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Módulos Visibles - Solo para administradores */}
      {profile?.role === 'admin' && (
        <div className="mt-8 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-8">
          <div className="flex items-center gap-3 mb-6">
            <Eye className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Módulos Visibles</h3>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            Selecciona qué módulos estarán visibles para <strong>todos los usuarios</strong> de la empresa. Los módulos desactivados no aparecerán en la navegación de ningún usuario.
          </p>

        <div className="space-y-6">
          {/* Módulos Principales */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Módulos Principales</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {allModules.filter(m => m.category === 'main').map((module) => {
                const Icon = module.icon;
                const isVisible = visibleModules[module.key] !== false; // Por defecto true
                return (
                  <label
                    key={module.key}
                    className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition ${
                      isVisible
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isVisible}
                      onChange={() => handleModuleToggle(module.key)}
                      disabled={savingModules}
                      className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <Icon className={`w-5 h-5 ${isVisible ? 'text-blue-600' : 'text-gray-400'}`} />
                    <span className={`flex-1 font-medium ${isVisible ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                      {module.label}
                    </span>
                    {isVisible ? (
                      <Eye className="w-4 h-4 text-blue-600" />
                    ) : (
                      <EyeOff className="w-4 h-4 text-gray-400" />
                    )}
                  </label>
                );
              })}
            </div>
          </div>

          {/* Módulos de Personas */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Personas</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {allModules.filter(m => m.category === 'personas').map((module) => {
                const Icon = module.icon;
                const isVisible = visibleModules[module.key] !== false; // Por defecto true
                return (
                  <label
                    key={module.key}
                    className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition ${
                      isVisible
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isVisible}
                      onChange={() => handleModuleToggle(module.key)}
                      disabled={savingModules}
                      className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <Icon className={`w-5 h-5 ${isVisible ? 'text-blue-600' : 'text-gray-400'}`} />
                    <span className={`flex-1 font-medium ${isVisible ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                      {module.label}
                    </span>
                    {isVisible ? (
                      <Eye className="w-4 h-4 text-blue-600" />
                    ) : (
                      <EyeOff className="w-4 h-4 text-gray-400" />
                    )}
                  </label>
                );
              })}
            </div>
          </div>

          {/* Módulos de Negocio */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Negocio</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {allModules.filter(m => m.category === 'negocio').map((module) => {
                const Icon = module.icon;
                const isVisible = visibleModules[module.key] !== false; // Por defecto true
                return (
                  <label
                    key={module.key}
                    className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition ${
                      isVisible
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isVisible}
                      onChange={() => handleModuleToggle(module.key)}
                      disabled={savingModules}
                      className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <Icon className={`w-5 h-5 ${isVisible ? 'text-blue-600' : 'text-gray-400'}`} />
                    <span className={`flex-1 font-medium ${isVisible ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                      {module.label}
                    </span>
                    {isVisible ? (
                      <Eye className="w-4 h-4 text-blue-600" />
                    ) : (
                      <EyeOff className="w-4 h-4 text-gray-400" />
                    )}
                  </label>
                );
              })}
            </div>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-xl p-6">
        <div className="flex items-start gap-3">
          <Upload className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium text-blue-900 dark:text-blue-300 mb-1">Consejos para tu foto de perfil</h3>
            <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
              <li>• Usa una imagen clara y profesional</li>
              <li>• Asegúrate de que tu rostro sea visible</li>
              <li>• Formatos aceptados: JPG, PNG, GIF, WEBP</li>
              <li>• Tamaño máximo: 2MB</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}













