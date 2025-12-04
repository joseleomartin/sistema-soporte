import { useState, useEffect, useRef } from 'react';
import { Plus, Edit2, Trash2, Play, Eye, Download, X, Loader2, FileText, Image, File, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface CoursePart {
  id: string;
  course_id: string;
  part_number: number;
  title: string;
  description?: string | null;
  youtube_url?: string | null;
  file_path?: string | null;
  file_name?: string | null;
  file_type?: string | null;
  file_size?: number | null;
  created_at: string;
  updated_at: string;
}

interface CoursePartsManagerProps {
  courseId: string;
  isAdmin: boolean;
}

export function CoursePartsManager({ courseId, isAdmin }: CoursePartsManagerProps) {
  const { profile } = useAuth();
  const [parts, setParts] = useState<CoursePart[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedParts, setExpandedParts] = useState<{ [key: string]: boolean }>({});
  const [editingPart, setEditingPart] = useState<CoursePart | null>(null);
  const [showAddPart, setShowAddPart] = useState(false);

  useEffect(() => {
    fetchParts();
  }, [courseId]);

  const fetchParts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('course_parts')
        .select('*')
        .eq('course_id', courseId)
        .order('part_number', { ascending: true });

      if (error) throw error;
      setParts(data || []);
    } catch (error) {
      console.error('Error fetching parts:', error);
    } finally {
      setLoading(false);
    }
  };

  const togglePart = (partId: string) => {
    setExpandedParts((prev) => ({
      ...prev,
      [partId]: !prev[partId],
    }));
  };

  const handleDeletePart = async (partId: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar esta parte?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('course_parts')
        .delete()
        .eq('id', partId);

      if (error) throw error;
      fetchParts();
    } catch (error) {
      console.error('Error deleting part:', error);
      alert('Error al eliminar la parte');
    }
  };

  const getFileUrl = (filePath: string): string => {
    const { data } = supabase.storage
      .from('library-course-files')
      .getPublicUrl(filePath);
    return data.publicUrl;
  };

  const formatFileSize = (bytes: number | null | undefined): string => {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getFileIcon = (fileType: string | null | undefined) => {
    if (!fileType) return <File className="w-5 h-5 text-gray-600" />;
    if (fileType.startsWith('image/')) {
      return <Image className="w-5 h-5 text-green-600" />;
    } else if (fileType.includes('pdf')) {
      return <FileText className="w-5 h-5 text-red-600" />;
    } else {
      return <File className="w-5 h-5 text-gray-600" />;
    }
  };

  const getYouTubeVideoId = (url: string | null | undefined): string | null => {
    if (!url) return null;
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/watch\?.*v=([^&\n?#]+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }

  if (parts.length === 0) {
    return (
      <div className="mt-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Partes del Curso</h3>
          {isAdmin && (
            <button
              onClick={() => setShowAddPart(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              <Plus className="w-4 h-4" />
              Agregar Parte
            </button>
          )}
        </div>
        <div className="bg-gray-50 rounded-lg p-6 text-center text-gray-500">
          <p>Este curso aún no tiene partes. {isAdmin && 'Agrega la primera parte para comenzar.'}</p>
        </div>
        {isAdmin && showAddPart && (
          <AddPartForm
            courseId={courseId}
            onSuccess={() => {
              setShowAddPart(false);
              fetchParts();
            }}
            onCancel={() => setShowAddPart(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Partes del Curso ({parts.length})</h3>
        {isAdmin && (
          <button
            onClick={() => setShowAddPart(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            Agregar Parte
          </button>
        )}
      </div>

      <div className="space-y-3">
        {parts.map((part) => (
          <div
            key={part.id}
            className="bg-white border border-gray-200 rounded-lg overflow-hidden"
          >
            <div
              className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => togglePart(part.id)}
            >
              <div className="flex items-center gap-3 flex-1">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-semibold">
                  {part.part_number}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-gray-900">{part.title}</h4>
                  {part.description && (
                    <p className="text-sm text-gray-600 line-clamp-1">{part.description}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isAdmin && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingPart(part);
                      }}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      title="Editar"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeletePart(part.id);
                      }}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
                {expandedParts[part.id] ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </div>
            </div>

            {expandedParts[part.id] && (
              <div className="px-4 pb-4 border-t border-gray-100">
                {part.description && (
                  <p className="text-sm text-gray-700 mt-3 whitespace-pre-wrap">{part.description}</p>
                )}

                {/* YouTube Video */}
                {part.youtube_url && (() => {
                  const videoId = getYouTubeVideoId(part.youtube_url);
                  if (videoId) {
                    return (
                      <div className="mt-4">
                        <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden">
                          <iframe
                            src={`https://www.youtube.com/embed/${videoId}`}
                            title={part.title}
                            className="w-full h-full"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        </div>
                        <a
                          href={part.youtube_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:text-blue-700 mt-2 inline-block"
                        >
                          Ver en YouTube
                        </a>
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* Archivo */}
                {part.file_path && (
                  <div className="mt-4">
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 bg-gray-50">
                      <div className="flex items-center gap-3">
                        {getFileIcon(part.file_type)}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{part.file_name}</p>
                          <p className="text-xs text-gray-500">{formatFileSize(part.file_size)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {part.file_type?.includes('pdf') && (
                            <a
                              href={getFileUrl(part.file_path)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Ver archivo"
                            >
                              <Eye className="w-5 h-5" />
                            </a>
                          )}
                          <a
                            href={getFileUrl(part.file_path)}
                            download={part.file_name || 'archivo'}
                            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Descargar"
                          >
                            <Download className="w-5 h-5" />
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {isAdmin && showAddPart && (
        <AddPartForm
          courseId={courseId}
          onSuccess={() => {
            setShowAddPart(false);
            fetchParts();
          }}
          onCancel={() => setShowAddPart(false)}
        />
      )}

      {isAdmin && editingPart && (
        <EditPartForm
          part={editingPart}
          onSuccess={() => {
            setEditingPart(null);
            fetchParts();
          }}
          onCancel={() => setEditingPart(null)}
        />
      )}
    </div>
  );
}

// Componente para agregar una nueva parte
function AddPartForm({ courseId, onSuccess, onCancel }: { courseId: string; onSuccess: () => void; onCancel: () => void }) {
  const { profile } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [partNumber, setPartNumber] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Obtener el siguiente número de parte
  useEffect(() => {
    const fetchNextPartNumber = async () => {
      const { data } = await supabase
        .from('course_parts')
        .select('part_number')
        .eq('course_id', courseId)
        .order('part_number', { ascending: false })
        .limit(1)
        .single();

      if (data) {
        setPartNumber(data.part_number + 1);
      }
    };
    fetchNextPartNumber();
  }, [courseId]);

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

  const uploadFile = async (): Promise<{ file_path: string; file_name: string; file_type: string; file_size: number } | null> => {
    if (!selectedFile || !profile) return null;

    try {
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${profile.id}/${fileName}`;

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

    try {
      setSaving(true);

      let fileData = null;
      if (selectedFile) {
        fileData = await uploadFile();
      }

      const partData: any = {
        course_id: courseId,
        part_number: partNumber,
        title: title.trim(),
        description: description.trim() || null,
      };

      if (hasYouTube) {
        partData.youtube_url = youtubeUrl.trim();
        partData.file_path = null;
        partData.file_name = null;
        partData.file_type = null;
        partData.file_size = null;
      } else if (fileData) {
        partData.youtube_url = null;
        partData.file_path = fileData.file_path;
        partData.file_name = fileData.file_name;
        partData.file_type = fileData.file_type;
        partData.file_size = fileData.file_size;
      } else {
        // Sin YouTube ni archivo - ambos son null
        partData.youtube_url = null;
        partData.file_path = null;
        partData.file_name = null;
        partData.file_type = null;
        partData.file_size = null;
      }

      const { error: insertError } = await supabase
        .from('course_parts')
        .insert(partData);

      if (insertError) throw insertError;

      onSuccess();
    } catch (error: any) {
      console.error('Error creating part:', error);
      setError(error.message || 'Error al crear la parte');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-4 bg-gray-50 rounded-lg p-4 border border-gray-200">
      <h4 className="font-semibold text-gray-900 mb-3">Agregar Nueva Parte</h4>
      {error && (
        <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Número de Parte
          </label>
          <input
            type="number"
            value={partNumber}
            onChange={(e) => setPartNumber(parseInt(e.target.value) || 1)}
            min={1}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Título de la Parte *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Descripción
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={3}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            URL de YouTube (opcional)
          </label>
          <input
            type="text"
            value={youtubeUrl}
            onChange={(e) => {
              setYoutubeUrl(e.target.value);
              if (e.target.value) setSelectedFile(null);
            }}
            placeholder="https://www.youtube.com/watch?v=..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            O sube un archivo (opcional)
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
            onChange={handleFileSelect}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
          {selectedFile && (
            <p className="text-sm text-gray-600 mt-1">
              {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Guardando...' : 'Guardar Parte'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}

// Componente para editar una parte
function EditPartForm({ part, onSuccess, onCancel }: { part: CoursePart; onSuccess: () => void; onCancel: () => void }) {
  const { profile } = useAuth();
  const [title, setTitle] = useState(part.title);
  const [description, setDescription] = useState(part.description || '');
  const [youtubeUrl, setYoutubeUrl] = useState(part.youtube_url || '');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [partNumber, setPartNumber] = useState(part.part_number);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const uploadFile = async (): Promise<{ file_path: string; file_name: string; file_type: string; file_size: number } | null> => {
    if (!selectedFile || !profile) return null;

    try {
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${profile.id}/${fileName}`;

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
    const hasExistingFile = part.file_path !== null;

    if (hasYouTube && (hasFile || hasExistingFile)) {
      setError('Solo puedes proporcionar una URL de YouTube o un archivo, no ambos');
      return;
    }

    try {
      setSaving(true);

      let fileData = null;
      if (selectedFile) {
        fileData = await uploadFile();
      }

      const updateData: any = {
        part_number: partNumber,
        title: title.trim(),
        description: description.trim() || null,
      };

      if (hasYouTube) {
        updateData.youtube_url = youtubeUrl.trim();
        updateData.file_path = null;
        updateData.file_name = null;
        updateData.file_type = null;
        updateData.file_size = null;
      } else if (fileData) {
        updateData.youtube_url = null;
        updateData.file_path = fileData.file_path;
        updateData.file_name = fileData.file_name;
        updateData.file_type = fileData.file_type;
        updateData.file_size = fileData.file_size;
      } else if (hasExistingFile) {
        // Mantener el archivo existente
        updateData.youtube_url = null;
      } else {
        // Sin YouTube ni archivo - ambos son null
        updateData.youtube_url = null;
        updateData.file_path = null;
        updateData.file_name = null;
        updateData.file_type = null;
        updateData.file_size = null;
      }

      const { error: updateError } = await supabase
        .from('course_parts')
        .update(updateData)
        .eq('id', part.id);

      if (updateError) throw updateError;

      onSuccess();
    } catch (error: any) {
      console.error('Error updating part:', error);
      setError(error.message || 'Error al actualizar la parte');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-4 bg-gray-50 rounded-lg p-4 border border-gray-200">
      <h4 className="font-semibold text-gray-900 mb-3">Editar Parte</h4>
      {error && (
        <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Número de Parte
          </label>
          <input
            type="number"
            value={partNumber}
            onChange={(e) => setPartNumber(parseInt(e.target.value) || 1)}
            min={1}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Título de la Parte *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Descripción
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={3}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            URL de YouTube (opcional)
          </label>
          <input
            type="text"
            value={youtubeUrl}
            onChange={(e) => {
              setYoutubeUrl(e.target.value);
              if (e.target.value) setSelectedFile(null);
            }}
            placeholder="https://www.youtube.com/watch?v=..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            O sube un archivo nuevo (opcional - dejar vacío para mantener el actual o eliminar)
          </label>
          {part.file_name && !selectedFile && (
            <p className="text-sm text-gray-600 mb-2">
              Archivo actual: {part.file_name}
            </p>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
            onChange={handleFileSelect}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
          {selectedFile && (
            <p className="text-sm text-gray-600 mt-1">
              {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}

