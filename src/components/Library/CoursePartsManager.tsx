import { useState, useEffect, useRef } from 'react';
import { Plus, Edit2, Trash2, Play, Eye, Download, X, Loader2, FileText, Image, File, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface CourseFile {
  file_path: string;
  file_name: string;
  file_type: string | null;
  file_size: number | null;
}

interface CoursePart {
  id: string;
  course_id: string;
  part_number: number;
  title: string;
  description?: string | null;
  youtube_url?: string | null; // Mantener por compatibilidad
  file_path?: string | null; // Mantener por compatibilidad
  file_name?: string | null; // Mantener por compatibilidad
  file_type?: string | null; // Mantener por compatibilidad
  file_size?: number | null; // Mantener por compatibilidad
  youtube_urls?: string[] | null; // Nuevo: array de URLs
  files?: CourseFile[] | null; // Nuevo: array de archivos
  created_at: string;
  updated_at: string;
}

interface CoursePartsManagerProps {
  courseId: string;
  isAdmin: boolean;
}

// Funciones auxiliares compartidas
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

                {/* YouTube Videos - Nuevo formato (array) */}
                {part.youtube_urls && part.youtube_urls.length > 0 && (
                  <div className="mt-4 space-y-4">
                    <h5 className="text-sm font-semibold text-gray-700">Videos de YouTube:</h5>
                    {part.youtube_urls.map((url, index) => {
                      const videoId = getYouTubeVideoId(url);
                      if (!videoId) return null;
                      return (
                        <div key={index} className="space-y-2">
                          <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden">
                            <iframe
                              src={`https://www.youtube.com/embed/${videoId}`}
                              title={`${part.title} - Video ${index + 1}`}
                              className="w-full h-full"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                            />
                          </div>
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 hover:text-blue-700 inline-block"
                          >
                            Ver en YouTube
                          </a>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* YouTube Video - Formato antiguo (compatibilidad) */}
                {(!part.youtube_urls || part.youtube_urls.length === 0) && part.youtube_url && (() => {
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

                {/* Archivos - Nuevo formato (array) */}
                {part.files && part.files.length > 0 && (
                  <div className="mt-4 space-y-3">
                    <h5 className="text-sm font-semibold text-gray-700">Archivos:</h5>
                    {part.files.map((file, index) => (
                      <div key={index} className="border-2 border-dashed border-gray-300 rounded-lg p-4 bg-gray-50">
                        <div className="flex items-center gap-3">
                          {getFileIcon(file.file_type)}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{file.file_name}</p>
                            <p className="text-xs text-gray-500">{formatFileSize(file.file_size)}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {file.file_type?.includes('pdf') && (
                              <a
                                href={getFileUrl(file.file_path)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Ver archivo"
                              >
                                <Eye className="w-5 h-5" />
                              </a>
                            )}
                            <a
                              href={getFileUrl(file.file_path)}
                              download={file.file_name || 'archivo'}
                              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                              title="Descargar"
                            >
                              <Download className="w-5 h-5" />
                            </a>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Archivo - Formato antiguo (compatibilidad) */}
                {(!part.files || part.files.length === 0) && part.file_path && (
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
  const [youtubeUrls, setYoutubeUrls] = useState<string[]>(['']);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
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
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setSelectedFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const addYouTubeUrlField = () => {
    setYoutubeUrls(prev => [...prev, '']);
  };

  const removeYouTubeUrlField = (index: number) => {
    setYoutubeUrls(prev => prev.filter((_, i) => i !== index));
  };

  const updateYouTubeUrl = (index: number, value: string) => {
    setYoutubeUrls(prev => {
      const newUrls = [...prev];
      newUrls[index] = value;
      return newUrls;
    });
  };

  const uploadFiles = async (): Promise<CourseFile[]> => {
    if (selectedFiles.length === 0 || !profile) return [];

    const uploadedFiles: CourseFile[] = [];

    for (const file of selectedFiles) {
      try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${profile.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('library-course-files')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        uploadedFiles.push({
          file_path: filePath,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
        });
      } catch (error) {
        console.error('Error uploading file:', error);
        throw error;
      }
    }

    return uploadedFiles;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('El título es requerido');
      return;
    }

    // Validar URLs de YouTube
    const validYouTubeUrls = youtubeUrls
      .map(url => url.trim())
      .filter(url => url && validateYouTubeUrl(url));

    if (youtubeUrls.some(url => url.trim() && !validateYouTubeUrl(url.trim()))) {
      setError('Una o más URLs de YouTube no son válidas');
      return;
    }

    try {
      setSaving(true);

      // Subir archivos
      const uploadedFiles = await uploadFiles();

      const partData: any = {
        course_id: courseId,
        part_number: partNumber,
        title: title.trim(),
        description: description.trim() || null,
        youtube_urls: validYouTubeUrls.length > 0 ? validYouTubeUrls : null,
        files: uploadedFiles.length > 0 ? uploadedFiles : null,
        // Mantener campos antiguos como null para compatibilidad
        youtube_url: null,
        file_path: null,
        file_name: null,
        file_type: null,
        file_size: null,
      };

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
            URLs de YouTube (opcional) - Puedes agregar múltiples
          </label>
          <div className="space-y-2">
            {youtubeUrls.map((url, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  type="text"
                  value={url}
                  onChange={(e) => updateYouTubeUrl(index, e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {youtubeUrls.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeYouTubeUrlField(index)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Eliminar URL"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addYouTubeUrlField}
              className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              Agregar otra URL de YouTube
            </button>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Archivos (opcional) - Puedes subir múltiples
          </label>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,text/csv"
            onChange={handleFileSelect}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
          {selectedFiles.length > 0 && (
            <div className="mt-2 space-y-2">
              {selectedFiles.map((file, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-700 truncate flex-1">
                    {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                  </span>
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                    title="Eliminar archivo"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
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
  // Cargar URLs existentes (nuevo formato o formato antiguo)
  const [youtubeUrls, setYoutubeUrls] = useState<string[]>(() => {
    if (part.youtube_urls && part.youtube_urls.length > 0) {
      return part.youtube_urls;
    } else if (part.youtube_url) {
      return [part.youtube_url];
    }
    return [''];
  });
  const [existingFiles, setExistingFiles] = useState<CourseFile[]>(() => {
    if (part.files && part.files.length > 0) {
      return part.files;
    } else if (part.file_path) {
      return [{
        file_path: part.file_path,
        file_name: part.file_name || '',
        file_type: part.file_type,
        file_size: part.file_size,
      }];
    }
    return [];
  });
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
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
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setSelectedFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const removeExistingFile = (index: number) => {
    setExistingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const addYouTubeUrlField = () => {
    setYoutubeUrls(prev => [...prev, '']);
  };

  const removeYouTubeUrlField = (index: number) => {
    setYoutubeUrls(prev => prev.filter((_, i) => i !== index));
  };

  const updateYouTubeUrl = (index: number, value: string) => {
    setYoutubeUrls(prev => {
      const newUrls = [...prev];
      newUrls[index] = value;
      return newUrls;
    });
  };

  const uploadFiles = async (): Promise<CourseFile[]> => {
    if (selectedFiles.length === 0 || !profile) return [];

    const uploadedFiles: CourseFile[] = [];

    for (const file of selectedFiles) {
      try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${profile.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('library-course-files')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        uploadedFiles.push({
          file_path: filePath,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
        });
      } catch (error) {
        console.error('Error uploading file:', error);
        throw error;
      }
    }

    return uploadedFiles;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('El título es requerido');
      return;
    }

    // Validar URLs de YouTube
    const validYouTubeUrls = youtubeUrls
      .map(url => url.trim())
      .filter(url => url && validateYouTubeUrl(url));

    if (youtubeUrls.some(url => url.trim() && !validateYouTubeUrl(url.trim()))) {
      setError('Una o más URLs de YouTube no son válidas');
      return;
    }

    try {
      setSaving(true);

      // Subir nuevos archivos
      const uploadedFiles = await uploadFiles();

      // Combinar archivos existentes con los nuevos
      const allFiles = [...existingFiles, ...uploadedFiles];

      const updateData: any = {
        part_number: partNumber,
        title: title.trim(),
        description: description.trim() || null,
        youtube_urls: validYouTubeUrls.length > 0 ? validYouTubeUrls : null,
        files: allFiles.length > 0 ? allFiles : null,
        // Mantener campos antiguos como null para compatibilidad
        youtube_url: null,
        file_path: null,
        file_name: null,
        file_type: null,
        file_size: null,
      };

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
            URLs de YouTube (opcional) - Puedes agregar múltiples
          </label>
          <div className="space-y-2">
            {youtubeUrls.map((url, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  type="text"
                  value={url}
                  onChange={(e) => updateYouTubeUrl(index, e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {youtubeUrls.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeYouTubeUrlField(index)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Eliminar URL"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addYouTubeUrlField}
              className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              Agregar otra URL de YouTube
            </button>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Archivos existentes
          </label>
          {existingFiles.length > 0 && (
            <div className="mb-2 space-y-2">
              {existingFiles.map((file, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-700 truncate flex-1">
                    {file.file_name} ({formatFileSize(file.file_size)})
                  </span>
                  <button
                    type="button"
                    onClick={() => removeExistingFile(index)}
                    className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                    title="Eliminar archivo"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <label className="block text-sm font-medium text-gray-700 mb-1 mt-3">
            Agregar nuevos archivos (opcional) - Puedes subir múltiples
          </label>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,text/csv"
            onChange={handleFileSelect}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
          {selectedFiles.length > 0 && (
            <div className="mt-2 space-y-2">
              {selectedFiles.map((file, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-700 truncate flex-1">
                    {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                  </span>
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                    title="Eliminar archivo"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
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

