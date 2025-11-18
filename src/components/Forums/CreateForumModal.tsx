import { useState } from 'react';
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [driveLinkError, setDriveLinkError] = useState<string | null>(null);

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

      // Ahora crear el subforum con el forum_id
      const { data: newSubforum, error: createError } = await supabase
        .from('subforums')
        .insert({
          name: name.trim(),
          description: description.trim() || null,
          client_name: clientName.trim(),
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
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Crear Subforo</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nombre del Subforo
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
              maxLength={100}
              placeholder="Ej: Soporte Técnico"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cliente
            </label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
              maxLength={100}
              placeholder="Nombre del cliente"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Descripción (opcional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              maxLength={500}
              placeholder="Descripción del subforo..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
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
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                driveLinkError ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="https://drive.google.com/drive/folders/ABC123..."
            />
            {driveLinkError && (
              <p className="text-xs text-red-600 mt-1">{driveLinkError}</p>
            )}
            {!driveLinkError && driveFolderLink.trim() && (
              <p className="text-xs text-green-600 mt-1">✓ Enlace válido</p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              Pega el enlace de la carpeta de Google Drive asociada a este cliente. 
              Esto permitirá ver y gestionar los archivos directamente desde la aplicación.
            </p>
            <button
              type="button"
              onClick={() => window.open('https://drive.google.com', '_blank', 'noopener,noreferrer')}
              className="mt-2 text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <ExternalLink className="w-3 h-3" />
              Abrir Google Drive
            </button>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creando...' : 'Crear Subforo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
