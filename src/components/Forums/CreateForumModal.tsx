import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { X, Folder, ExternalLink } from 'lucide-react';

interface CreateForumModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateForumModal({ onClose, onSuccess }: CreateForumModalProps) {
  const { profile } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [clientName, setClientName] = useState('');
  const [driveFolderLink, setDriveFolderLink] = useState('');
  const [cuit, setCuit] = useState('');
  const [email, setEmail] = useState('');
  const [secondaryEmail, setSecondaryEmail] = useState('');
  const [accessKeys, setAccessKeys] = useState({
    arca: { usuario: '', contraseña: '' },
    agip: { usuario: '', contraseña: '' },
    armba: { usuario: '', contraseña: '' },
  });
  const [economicLink, setEconomicLink] = useState('');
  const [contactFullName, setContactFullName] = useState('');
  const [clientType, setClientType] = useState('');
  const [phone, setPhone] = useState('');
  const [secondaryPhone, setSecondaryPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [driveLinkError, setDriveLinkError] = useState<string | null>(null);
  const [availableClients, setAvailableClients] = useState<string[]>([]);

  useEffect(() => {
    if (!profile?.id) return;

    const loadClients = async () => {
      const { data, error } = await supabase
        .from('subforums')
        .select('client_name')
        .order('client_name', { ascending: true });

      if (!error && data) {
        const names = Array.from(
          new Set(
            (data as any[])
              .map((s) => s.client_name as string | null)
              .filter((n): n is string => !!n)
          )
        );
        setAvailableClients(names);
      }
    };

    loadClients();
  }, [profile?.id]);

  // Extraer ID de carpeta desde un enlace de Google Drive
  const extractFolderIdFromLink = (link: string): string | null => {
    // Formato 1: https://drive.google.com/drive/folders/FOLDER_ID
    // Formato 2: https://drive.google.com/drive/u/0/folders/FOLDER_ID
    // Formato 3: https://drive.google.com/open?id=FOLDER_ID
    // Formato 4: FOLDER_ID directo
    
    // Intentar extraer de formato estándar
    const foldersMatch = link.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    if (foldersMatch) {
      return foldersMatch[1];
    }
    
    // Intentar extraer de formato open?id=
    const openMatch = link.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (openMatch) {
      return openMatch[1];
    }
    
    // Si es solo un ID (sin URL)
    if (/^[a-zA-Z0-9_-]+$/.test(link.trim())) {
      return link.trim();
    }
    
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id) return;

    setLoading(true);
    setError('');

    try {
      // Primero, obtener o crear un forum para este cliente
      let forumId: string;

      // Buscar si ya existe un forum con este nombre de cliente
      const { data: existingForum } = await supabase
        .from('forums')
        .select('id')
        .eq('name', clientName.trim())
        .single();

      if (existingForum) {
        forumId = existingForum.id;
      } else {
        // Crear un nuevo forum para este cliente
        const { data: newForum, error: forumError } = await supabase
          .from('forums')
          .insert({
            name: clientName.trim(),
            description: `Foro del cliente ${clientName.trim()}`,
            created_by: profile.id,
          })
          .select('id')
          .single();

        if (forumError) throw forumError;
        if (!newForum) throw new Error('No se pudo crear el forum');

        forumId = newForum.id;
      }

      // Preparar access_keys como JSONB
      const accessKeysJson = 
        (accessKeys.arca.usuario || accessKeys.arca.contraseña ||
         accessKeys.agip.usuario || accessKeys.agip.contraseña ||
         accessKeys.armba.usuario || accessKeys.armba.contraseña)
          ? accessKeys
          : null;

      const combinedEmail =
        [email.trim(), secondaryEmail.trim()].filter((v) => v.length > 0).join(' / ') || null;

      const combinedPhone =
        [phone.trim(), secondaryPhone.trim()].filter((v) => v.length > 0).join(' / ') || null;

      // Ahora crear el subforum con el forum_id
      const { data: newSubforum, error: createError } = await supabase
        .from('subforums')
        .insert({
          name: name.trim(),
          description: description.trim() || null,
          client_name: clientName.trim(),
          cuit: cuit.trim() || null,
          email: combinedEmail,
          access_keys: accessKeysJson,
          economic_link: economicLink.trim() || null,
          contact_full_name: contactFullName.trim() || null,
          client_type: clientType.trim() || null,
          phone: combinedPhone,
          forum_id: forumId,
          created_by: profile.id,
        })
        .select('id')
        .single();

      if (createError) throw createError;
      if (!newSubforum) throw new Error('No se pudo crear el subforo');

      // Si se proporcionó un enlace de Google Drive, guardar el mapeo
      if (driveFolderLink.trim() && newSubforum.id) {
        const folderId = extractFolderIdFromLink(driveFolderLink.trim());
        
        if (folderId) {
          try {
            // Usar la función RPC para guardar el mapeo
            const { error: driveError } = await supabase.rpc('save_client_drive_mapping', {
              p_subforum_id: newSubforum.id,
              p_google_drive_folder_id: folderId,
              p_folder_name: name.trim() || clientName.trim(),
            });
            
            if (driveError) {
              console.warn('No se pudo guardar el mapeo de Google Drive:', driveError);
              // No bloquear la creación del subforum si falla el mapeo de Drive
            }
          } catch (driveError: any) {
            // No bloquear la creación del subforum si falla el mapeo de Drive
            console.warn('No se pudo guardar el mapeo de Google Drive:', driveError);
          }
        } else if (driveFolderLink.trim()) {
          // Si hay un enlace pero no es válido, mostrar advertencia pero no bloquear
          console.warn('El enlace de Google Drive proporcionado no es válido');
        }
      }

      onSuccess();
    } catch (err: any) {
      console.error('Error creating subforum:', err);
      setError(err.message || 'Error al crear el subforo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700 flex-shrink-0">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Crear Subforo</h2>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form id="create-forum-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-3 forums-scroll">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Nombre del Subforo
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
              maxLength={100}
              placeholder="Ej: Soporte Técnico"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Cliente
            </label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
              maxLength={100}
              placeholder="Nombre del cliente"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Descripción (opcional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              maxLength={500}
              placeholder="Descripción del subforo..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                CUIT (opcional)
              </label>
              <input
                type="text"
                value={cuit}
                onChange={(e) => setCuit(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ej: 20-12345678-9"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email 1 (opcional)
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="correo@cliente.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email 2 (opcional)
              </label>
              <input
                type="email"
                value={secondaryEmail}
                onChange={(e) => setSecondaryEmail(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="otro-correo@cliente.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Claves de acceso / Portales (opcional)
            </label>
            <div className="space-y-3">
              {/* ARCA */}
              <div className="border border-gray-200 dark:border-slate-600 rounded-lg p-3 bg-gray-50 dark:bg-slate-900/50">
                <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">ARCA</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Usuario</label>
                    <input
                      type="text"
                      value={accessKeys.arca.usuario}
                      onChange={(e) => setAccessKeys({
                        ...accessKeys,
                        arca: { ...accessKeys.arca, usuario: e.target.value }
                      })}
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Usuario ARCA"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Contraseña</label>
                    <input
                      type="password"
                      value={accessKeys.arca.contraseña}
                      onChange={(e) => setAccessKeys({
                        ...accessKeys,
                        arca: { ...accessKeys.arca, contraseña: e.target.value }
                      })}
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Contraseña ARCA"
                    />
                  </div>
                </div>
              </div>

              {/* AGIP */}
              <div className="border border-gray-200 dark:border-slate-600 rounded-lg p-3 bg-gray-50 dark:bg-slate-900/50">
                <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">AGIP</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Usuario</label>
                    <input
                      type="text"
                      value={accessKeys.agip.usuario}
                      onChange={(e) => setAccessKeys({
                        ...accessKeys,
                        agip: { ...accessKeys.agip, usuario: e.target.value }
                      })}
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Usuario AGIP"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Contraseña</label>
                    <input
                      type="password"
                      value={accessKeys.agip.contraseña}
                      onChange={(e) => setAccessKeys({
                        ...accessKeys,
                        agip: { ...accessKeys.agip, contraseña: e.target.value }
                      })}
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Contraseña AGIP"
                    />
                  </div>
                </div>
              </div>

              {/* ARBA */}
              <div className="border border-gray-200 dark:border-slate-600 rounded-lg p-3 bg-gray-50 dark:bg-slate-900/50">
                <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">ARBA</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Usuario</label>
                    <input
                      type="text"
                      value={accessKeys.armba.usuario}
                      onChange={(e) => setAccessKeys({
                        ...accessKeys,
                        armba: { ...accessKeys.armba, usuario: e.target.value }
                      })}
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Usuario ARBA"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Contraseña</label>
                    <input
                      type="password"
                      value={accessKeys.armba.contraseña}
                      onChange={(e) => setAccessKeys({
                        ...accessKeys,
                        armba: { ...accessKeys.armba, contraseña: e.target.value }
                      })}
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Contraseña ARBA"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Vinculación económica (opcional)
            </label>
            <select
              value={economicLink}
              onChange={(e) => setEconomicLink(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Sin vinculación económica</option>
              {availableClients.map((client) => (
                <option key={client} value={client}>
                  {client}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Selecciona el cliente con el que este se encuentra vinculado económicamente.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nombre y apellido (contacto)
              </label>
              <input
                type="text"
                value={contactFullName}
                onChange={(e) => setContactFullName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Nombre del contacto principal"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Teléfono 1
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ej: +54 11 1234-5678"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Teléfono 2
              </label>
              <input
                type="text"
                value={secondaryPhone}
                onChange={(e) => setSecondaryPhone(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Otro teléfono de contacto"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Tipo de cliente
              </label>
              <select
                value={clientType}
                onChange={(e) => setClientType(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Seleccionar tipo de cliente</option>
                <option value="Monotributista">Monotributista</option>
                <option value="Responsable Inscripto">Responsable Inscripto</option>
                <option value="Persona Jurídica">Persona Jurídica</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              <div className="flex items-center gap-2">
                <Folder className="w-4 h-4" />
                Carpeta de Google Drive (opcional)
              </div>
            </label>
            <input
              type="text"
              value={driveFolderLink}
              onChange={(e) => {
                setDriveFolderLink(e.target.value);
                // Validar en tiempo real
                if (e.target.value.trim()) {
                  const folderId = extractFolderIdFromLink(e.target.value.trim());
                  if (!folderId) {
                    setDriveLinkError('El enlace no es válido. Debe ser un enlace de carpeta de Google Drive.');
                  } else {
                    setDriveLinkError(null);
                  }
                } else {
                  setDriveLinkError(null);
                }
              }}
              className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-white ${
                driveLinkError ? 'border-red-300 dark:border-red-600' : 'border-gray-300 dark:border-slate-600'
              }`}
              placeholder="https://drive.google.com/drive/folders/ABC123..."
            />
            {driveLinkError && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">{driveLinkError}</p>
            )}
            {!driveLinkError && driveFolderLink.trim() && (
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">✓ Enlace válido</p>
            )}
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Pega el enlace de la carpeta de Google Drive asociada a este cliente.
            </p>
            <button
              type="button"
              onClick={() => window.open('https://drive.google.com', '_blank', 'noopener,noreferrer')}
              className="mt-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1"
            >
              <ExternalLink className="w-3 h-3" />
              Abrir Google Drive
            </button>
          </div>

          {error && (
            <div className="p-2 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}
        </form>

        <div className="flex gap-3 p-4 border-t border-gray-200 dark:border-slate-700 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition font-medium"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="create-forum-form"
            disabled={loading}
            className="flex-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creando...' : 'Crear Subforo'}
          </button>
        </div>
      </div>
    </div>
  );
}
