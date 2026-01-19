import { useState, useEffect, useRef } from 'react';
import { X, Loader2, Upload, FileText, Image, File, X as XIcon } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';

interface Course {
  id: string;
  title: string;
  description: string;
  youtube_url?: string | null;
  file_path?: string | null;
  file_name?: string | null;
  file_type?: string | null;
  file_size?: number | null;
  folder_id?: string | null;
  google_drive_link?: string | null;
  google_drive_folder_id?: string | null;
}

interface CreateCourseModalProps {
  course?: Course | null;
  type?: 'course' | 'document';
  folderId?: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateCourseModal({ course, type = 'course', folderId, onClose, onSuccess }: CreateCourseModalProps) {
  const { profile } = useAuth();
  const { tenantId } = useTenant();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [googleDriveLink, setGoogleDriveLink] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(folderId || null);
  const [folders, setFolders] = useState<Array<{ id: string; name: string }>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (course) {
      setTitle(course.title);
      setDescription(course.description);
      setYoutubeUrl(course.youtube_url || '');
      setGoogleDriveLink(course.google_drive_link || '');
      setSelectedFolderId(course.folder_id || null);
      // No cargamos el archivo existente en el estado, solo mostramos que existe
    } else if (folderId) {
      setSelectedFolderId(folderId);
    }
    fetchFolders();
  }, [course, type, folderId]);

  const fetchFolders = async () => {
    if (!tenantId) return;
    
    try {
      const { data, error } = await supabase
        .from('library_folders')
        .select('id, name')
        .eq('type', type)
        .eq('tenant_id', tenantId)
        .order('name', { ascending: true });

      if (error) throw error;
      setFolders(data || []);
    } catch (error) {
      console.error('Error fetching folders:', error);
    }
  };

  const validateYouTubeUrl = (url: string): boolean => {
    if (!url.trim()) return false;
    const patterns = [
      /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\/.+/,
    ];
    return patterns.some(pattern => pattern.test(url));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setYoutubeUrl(''); // Limpiar YouTube si se selecciona archivo
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uploadFile = async (): Promise<{ file_path: string; file_name: string; file_type: string; file_size: number } | null> => {
    if (!selectedFile || !profile) return null;

    try {
      setUploading(true);
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${profile.id}/${fileName}`;

      // Subir archivo a Storage
      const { error: uploadError } = await supabase.storage
        .from('library-course-files')
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;

      return {
        file_path: filePath,
        file_name: selectedFile.name,
        file_type: selectedFile.type,
        file_size: selectedFile.size,
      };
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('El título es requerido');
      return;
    }

    const hasYouTube = youtubeUrl.trim() && validateYouTubeUrl(youtubeUrl);
    const hasFile = selectedFile !== null;
    const hasGoogleDrive = googleDriveLink.trim() !== '';

    // Validar que solo haya una opción seleccionada
    const optionsCount = [hasYouTube, hasFile, hasGoogleDrive].filter(Boolean).length;
    if (optionsCount > 1) {
      setError('Solo puedes proporcionar una opción: URL de YouTube, archivo o link de Google Drive');
      return;
    }

    // Si es documento y tiene Google Drive, validar el link
    if (type === 'document' && hasGoogleDrive) {
      const folderId = extractFolderIdFromLink(googleDriveLink.trim());
      if (!folderId) {
        setError('El link de Google Drive no es válido. Debe ser un link a una carpeta de Google Drive.');
        return;
      }
    }

    if (!profile) {
      setError('No se pudo obtener la información del usuario');
      return;
    }

    if (!tenantId) {
      setError('No se pudo identificar el tenant. Por favor, recarga la página.');
      return;
    }

    try {
      setSaving(true);

      let fileData = null;
      if (selectedFile) {
        fileData = await uploadFile();
      }

      const courseData: any = {
        title: title.trim(),
        description: description.trim(),
        type: type,
        folder_id: selectedFolderId || null,
        updated_at: new Date().toISOString(),
      };

      if (hasYouTube) {
        courseData.youtube_url = youtubeUrl.trim();
        courseData.file_path = null;
        courseData.file_name = null;
        courseData.file_type = null;
        courseData.file_size = null;
        courseData.google_drive_link = null;
        courseData.google_drive_folder_id = null;
      } else if (hasGoogleDrive && type === 'document') {
        const folderId = extractFolderIdFromLink(googleDriveLink.trim());
        courseData.youtube_url = null;
        courseData.file_path = null;
        courseData.file_name = null;
        courseData.file_type = null;
        courseData.file_size = null;
        courseData.google_drive_link = googleDriveLink.trim();
        courseData.google_drive_folder_id = folderId;
      } else if (fileData) {
        courseData.youtube_url = null;
        courseData.file_path = fileData.file_path;
        courseData.file_name = fileData.file_name;
        courseData.file_type = fileData.file_type;
        courseData.file_size = fileData.file_size;
        courseData.google_drive_link = null;
        courseData.google_drive_folder_id = null;
      } else {
        // Si no hay ninguna opción, dejar todo en null
        courseData.youtube_url = null;
        courseData.file_path = null;
        courseData.file_name = null;
        courseData.file_type = null;
        courseData.file_size = null;
        courseData.google_drive_link = null;
        courseData.google_drive_folder_id = null;
      }

      if (course) {
        // Actualizar curso existente
        courseData.tenant_id = tenantId;
        const { error: updateError } = await supabase
          .from('library_courses')
          .update(courseData)
          .eq('id', course.id);

        if (updateError) throw updateError;
      } else {
        // Crear nuevo curso
        courseData.created_by = profile.id;
        courseData.tenant_id = tenantId;
        const { error: insertError } = await supabase
          .from('library_courses')
          .insert([courseData]);

        if (insertError) throw insertError;
      }

      onSuccess();
    } catch (error: any) {
      console.error('Error saving course:', error);
      setError(error.message || 'Error al guardar el curso');
    } finally {
      setSaving(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) {
      return <Image className="w-5 h-5 text-green-600 dark:text-green-400" />;
    } else if (fileType.includes('pdf')) {
      return <FileText className="w-5 h-5 text-red-600 dark:text-red-400" />;
    } else {
      return <File className="w-5 h-5 text-gray-600 dark:text-gray-400" />;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {course 
              ? (type === 'document' ? 'Editar Documento' : 'Editar Curso')
              : (type === 'document' ? 'Nuevo Documento' : 'Nuevo Curso')}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-lg p-4">
              <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
            </div>
          )}

          {/* Título */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {type === 'document' ? 'Título del Documento *' : 'Título del Curso *'}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
              placeholder="Ej: Introducción a React"
              required
            />
          </div>

          {/* Carpeta */}
          {folders.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Carpeta (opcional)
              </label>
              <select
                value={selectedFolderId || ''}
                onChange={(e) => setSelectedFolderId(e.target.value || null)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
              >
                <option value="">Sin carpeta</option>
                {folders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Descripción */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Descripción
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
              placeholder="Describe el contenido del curso..."
            />
          </div>

          {/* Contenido: YouTube, Google Drive (solo documentos) o Archivo (solo cursos) */}
          <div className="space-y-4">
            {type === 'course' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    URL de YouTube
                  </label>
                  <input
                    type="url"
                    value={youtubeUrl}
                    onChange={(e) => {
                      setYoutubeUrl(e.target.value);
                      if (e.target.value.trim()) {
                        setSelectedFile(null);
                        if (fileInputRef.current) {
                          fileInputRef.current.value = '';
                        }
                      }
                    }}
                    disabled={selectedFile !== null}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 dark:disabled:bg-slate-700 disabled:cursor-not-allowed bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                    placeholder="https://www.youtube.com/watch?v=..."
                  />
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    Puedes usar URLs de YouTube en formato: youtube.com/watch?v=... o youtu.be/...
                  </p>
                </div>

                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    O sube un archivo
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileSelect}
                    disabled={youtubeUrl.trim() !== ''}
                    className="hidden"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.mp4,.mp3,.zip,.rar,.csv"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={youtubeUrl.trim() !== '' || uploading}
                    className="w-full px-4 py-3 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 bg-white dark:bg-slate-800"
                  >
                    <Upload className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                    <span className="text-sm text-gray-600 dark:text-gray-300">
                      {selectedFile ? selectedFile.name : 'Seleccionar archivo'}
                    </span>
                  </button>
                  {selectedFile && (
                    <div className="mt-2 flex items-center gap-2 p-3 bg-gray-50 dark:bg-slate-700 rounded-lg border border-gray-200 dark:border-slate-600">
                      {getFileIcon(selectedFile.type)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900 dark:text-white truncate">{selectedFile.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{formatFileSize(selectedFile.size)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={removeFile}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-slate-600 rounded transition-colors"
                      >
                        <XIcon className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                      </button>
                    </div>
                  )}
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Formatos soportados: PDF, Word, Excel, PowerPoint, imágenes, videos, audio, ZIP, CSV
              </p>
                </div>
              </>
            )}

            {type === 'document' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Link de Google Drive *
                </label>
                <input
                  type="url"
                  value={googleDriveLink}
                  onChange={(e) => {
                    setGoogleDriveLink(e.target.value);
                    if (e.target.value.trim()) {
                      setSelectedFile(null);
                      setYoutubeUrl('');
                      if (fileInputRef.current) {
                        fileInputRef.current.value = '';
                      }
                    }
                  }}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                  placeholder="https://drive.google.com/drive/folders/1ABC..."
                  required={type === 'document'}
                />
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Ingresa el link completo de la carpeta de Google Drive. Se mostrará todo el contenido de la carpeta.
                </p>
                <p className="mt-1 text-xs text-blue-600 dark:text-blue-400">
                  Ejemplo: https://drive.google.com/drive/folders/1ABC123xyz...
                </p>
              </div>
            )}
          </div>

          {/* Botones */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-slate-700 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              disabled={saving || uploading}
            >
              {(saving || uploading) ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {uploading ? 'Subiendo archivo...' : 'Guardando...'}
                </>
              ) : (
                course ? 'Actualizar' : 'Crear'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

