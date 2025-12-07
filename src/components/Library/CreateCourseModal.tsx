import { useState, useEffect, useRef } from 'react';
import { X, Loader2, Upload, FileText, Image, File, X as XIcon } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

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
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(folderId || null);
  const [folders, setFolders] = useState<Array<{ id: string; name: string }>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (course) {
      setTitle(course.title);
      setDescription(course.description);
      setYoutubeUrl(course.youtube_url || '');
      setSelectedFolderId(course.folder_id || null);
      // No cargamos el archivo existente en el estado, solo mostramos que existe
    } else if (folderId) {
      setSelectedFolderId(folderId);
    }
    fetchFolders();
  }, [course, type, folderId]);

  const fetchFolders = async () => {
    try {
      const { data, error } = await supabase
        .from('library_folders')
        .select('id, name')
        .eq('type', type)
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

    if (hasYouTube && hasFile) {
      setError('Solo puedes proporcionar una URL de YouTube o un archivo, no ambos');
      return;
    }

    if (!profile) {
      setError('No se pudo obtener la información del usuario');
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
      } else if (fileData) {
        courseData.youtube_url = null;
        courseData.file_path = fileData.file_path;
        courseData.file_name = fileData.file_name;
        courseData.file_type = fileData.file_type;
        courseData.file_size = fileData.file_size;
      } else {
        // Si no hay ni YouTube ni archivo, dejar ambos en null
        courseData.youtube_url = null;
        courseData.file_path = null;
        courseData.file_name = null;
        courseData.file_type = null;
        courseData.file_size = null;
      }

      if (course) {
        // Actualizar curso existente
        const { error: updateError } = await supabase
          .from('library_courses')
          .update(courseData)
          .eq('id', course.id);

        if (updateError) throw updateError;
      } else {
        // Crear nuevo curso
        courseData.created_by = profile.id;
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
      return <Image className="w-5 h-5 text-green-600" />;
    } else if (fileType.includes('pdf')) {
      return <FileText className="w-5 h-5 text-red-600" />;
    } else {
      return <File className="w-5 h-5 text-gray-600" />;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            {course 
              ? (type === 'document' ? 'Editar Documento' : 'Editar Curso')
              : (type === 'document' ? 'Nuevo Documento' : 'Nuevo Curso')}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Título */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {type === 'document' ? 'Título del Documento *' : 'Título del Curso *'}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Ej: Introducción a React"
              required
            />
          </div>

          {/* Carpeta */}
          {folders.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Carpeta (opcional)
              </label>
              <select
                value={selectedFolderId || ''}
                onChange={(e) => setSelectedFolderId(e.target.value || null)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Descripción
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="Describe el contenido del curso..."
            />
          </div>

          {/* URL de YouTube o Archivo */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                placeholder="https://www.youtube.com/watch?v=..."
              />
              <p className="mt-2 text-xs text-gray-500">
                Puedes usar URLs de YouTube en formato: youtube.com/watch?v=... o youtu.be/...
              </p>
            </div>

            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                O sube un archivo
              </label>
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                disabled={youtubeUrl.trim() !== ''}
                className="hidden"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.mp4,.mp3,.zip,.rar"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={youtubeUrl.trim() !== '' || uploading}
                className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Upload className="w-5 h-5 text-gray-400" />
                <span className="text-sm text-gray-600">
                  {selectedFile ? selectedFile.name : 'Seleccionar archivo'}
                </span>
              </button>
              {selectedFile && (
                <div className="mt-2 flex items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  {getFileIcon(selectedFile.type)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 truncate">{selectedFile.name}</p>
                    <p className="text-xs text-gray-500">{formatFileSize(selectedFile.size)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={removeFile}
                    className="p-1 hover:bg-gray-200 rounded transition-colors"
                  >
                    <XIcon className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
              )}
              <p className="mt-2 text-xs text-gray-500">
                Formatos soportados: PDF, Word, Excel, PowerPoint, imágenes, videos, audio, ZIP
              </p>
            </div>
          </div>

          {/* Botones */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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

