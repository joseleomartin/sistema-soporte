import { useState, useRef, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Camera, User, Upload, CheckCircle, AlertCircle, Building2, Calendar } from 'lucide-react';

export function ProfileSettings() {
  const { profile, user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [departments, setDepartments] = useState<any[]>([]);
  const [birthday, setBirthday] = useState<string>('');
  const [savingBirthday, setSavingBirthday] = useState(false);
  const [birthdayInitialized, setBirthdayInitialized] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile?.avatar_url) {
      setAvatarUrl(profile.avatar_url);
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
  }, [profile?.id, profile?.birthday, birthdayInitialized]);

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

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold text-gray-900 mb-8">Configuración de Perfil</h2>

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

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
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
            <p className="text-sm text-gray-600 mt-4 text-center">
              Haz clic en el ícono para cambiar tu foto
              <br />
              <span className="text-xs text-gray-500">Máximo 2MB</span>
            </p>
          </div>

          {/* Profile Info */}
          <div className="flex-1 space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nombre Completo
              </label>
              <input
                type="text"
                value={profile?.full_name || ''}
                disabled
                className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-700"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                type="email"
                value={profile?.email || ''}
                disabled
                className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-700"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Rol
              </label>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                profile?.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                profile?.role === 'support' ? 'bg-blue-100 text-blue-700' :
                'bg-gray-100 text-gray-700'
              }`}>
                {profile?.role === 'admin' ? 'Administrador' : 
                 profile?.role === 'support' ? 'Soporte' : 
                 'Usuario'}
              </span>
            </div>

            {departments.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
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
              <label className="block text-sm font-medium text-gray-700 mb-2">
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
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                />
                {savingBirthday && (
                  <div className="flex items-center px-4">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Tu cumpleaños aparecerá en la sección Social cuando sea tu día especial
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-6">
        <div className="flex items-start gap-3">
          <Upload className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium text-blue-900 mb-1">Consejos para tu foto de perfil</h3>
            <ul className="text-sm text-blue-700 space-y-1">
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













