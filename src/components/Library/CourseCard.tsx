import { useState, useEffect } from 'react';
import { Edit, Trash2, Play, User, FileText, Image, File, Download, Eye, X, Loader2, List } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Course {
  id: string;
  title: string;
  description: string;
  youtube_url?: string | null;
  file_path?: string | null;
  file_name?: string | null;
  file_type?: string | null;
  file_size?: number | null;
  google_drive_link?: string | null;
  google_drive_folder_id?: string | null;
  type?: 'course' | 'document';
  created_by: string;
  created_at: string;
  updated_at: string;
  created_by_profile?: {
    full_name: string;
    avatar_url?: string | null;
  };
  parts_count?: number;
}

interface CourseCardProps {
  course: Course;
  onEdit?: () => void;
  onDelete?: () => void;
  onClick?: () => void;
}

export function CourseCard({ course, onEdit, onDelete, onClick }: CourseCardProps) {
  const [showVideo, setShowVideo] = useState(false);
  const [showFilePreview, setShowFilePreview] = useState(false);
  const [fileUrl, setFileUrl] = useState<string | null>(null);

  // Obtener URL del archivo
  const getFileUrl = async () => {
    if (!course.file_path) return null;
    try {
      const { data } = supabase.storage
        .from('library-course-files')
        .getPublicUrl(course.file_path);
      return data.publicUrl;
    } catch (error) {
      console.error('Error getting file URL:', error);
      return null;
    }
  };

  // Cargar URL del archivo cuando el componente se monta
  useEffect(() => {
    const loadFileUrl = async () => {
      if (course.file_path && !fileUrl) {
        const url = await getFileUrl();
        if (url) setFileUrl(url);
      }
    };
    loadFileUrl();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course.file_path]);

  // Extraer el ID del video de YouTube de diferentes formatos de URL
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

  const videoId = getYouTubeVideoId(course.youtube_url);
  const embedUrl = videoId ? `https://www.youtube.com/embed/${videoId}` : null;
  const hasFile = course.file_path && course.file_name && !course.google_drive_folder_id;
  const isImage = course.file_type?.startsWith('image/');
  const isPDF = course.file_type?.includes('pdf');

  const handleViewFile = async () => {
    if (!fileUrl) {
      const url = await getFileUrl();
      if (url) {
        setFileUrl(url);
        setShowFilePreview(true);
      }
    } else {
      setShowFilePreview(true);
    }
  };

  const handleDownloadFile = async () => {
    if (!course.file_path || !course.file_name) return;
    
    try {
      const url = fileUrl || await getFileUrl();
      if (!url) return;

      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = course.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Error downloading file:', error);
      alert('Error al descargar el archivo');
    }
  };

  const formatFileSize = (bytes: number | null | undefined): string => {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getFileIcon = () => {
    if (isImage) {
      return <Image className="w-5 h-5 text-green-600" />;
    } else if (isPDF) {
      return <FileText className="w-5 h-5 text-red-600" />;
    } else {
      return <File className="w-5 h-5 text-gray-600" />;
    }
  };

  return (
    <div 
      className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
      onClick={onClick}
    >
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-lg font-semibold text-gray-900 line-clamp-2">
                {course.title}
              </h3>
              {course.parts_count !== undefined && course.parts_count > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                  <List className="w-3 h-3" />
                  {course.parts_count} {course.parts_count === 1 ? 'parte' : 'partes'}
                </span>
              )}
            </div>
            {course.created_by_profile && (
              <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                <User className="w-3.5 h-3.5" />
                <span>Creado por: {course.created_by_profile.full_name}</span>
              </div>
            )}
          </div>
          {(onEdit || onDelete) && (
            <div className="flex items-center gap-2 ml-2">
              {onEdit && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit();
                  }}
                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                  title="Editar"
                >
                  <Edit className="w-4 h-4" />
                </button>
              )}
              {onDelete && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                  title="Eliminar"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Descripción */}
        {course.description && (
          <p className="text-sm text-gray-600 mb-4 line-clamp-3">
            {course.description}
          </p>
        )}

        {/* Indicador de Google Drive (solo para documentos) */}
        {course.google_drive_folder_id && (
          <div className="mb-4">
            <div className="border-2 border-dashed border-blue-300 rounded-lg p-4 bg-blue-50">
              <div className="flex items-center gap-3">
                <FileText className="w-8 h-8 text-blue-600" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-900">Carpeta de Google Drive</p>
                  <p className="text-xs text-blue-700">Contenido disponible en Google Drive</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Video o Archivo Preview */}
        {embedUrl && !showVideo && (
          <div className="mb-4">
            <div className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden">
              <img
                src={`https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`}
                alt={course.title}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
                }}
              />
              <button
                onClick={() => setShowVideo(true)}
                className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 hover:bg-opacity-50 transition-opacity group"
              >
                <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Play className="w-8 h-8 text-white ml-1" />
                </div>
              </button>
            </div>
          </div>
        )}

        {embedUrl && showVideo && (
          <div className="mb-4">
            <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden">
              <iframe
                src={embedUrl}
                title={course.title}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
            <button
              onClick={() => setShowVideo(false)}
              className="mt-2 text-sm text-gray-600 hover:text-gray-900"
            >
              Ocultar video
            </button>
          </div>
        )}

        {hasFile && !showFilePreview && (
          <div className="mb-4">
            {isImage && fileUrl ? (
              <div className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden">
                <img
                  src={fileUrl}
                  alt={course.title}
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={handleViewFile}
                  className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 hover:bg-opacity-50 transition-opacity group"
                >
                  <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Eye className="w-8 h-8 text-white" />
                  </div>
                </button>
              </div>
            ) : isImage && !fileUrl ? (
              <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
              </div>
            ) : (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 bg-gray-50">
                <div className="flex items-center gap-4">
                  {getFileIcon()}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{course.file_name}</p>
                    <p className="text-xs text-gray-500">{formatFileSize(course.file_size)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isPDF && (
                      <button
                        onClick={handleViewFile}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Ver archivo"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                    )}
                    <button
                      onClick={handleDownloadFile}
                      className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Descargar"
                    >
                      <Download className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {hasFile && showFilePreview && (
          <div className="mb-4">
            <div className="relative bg-gray-900 rounded-lg overflow-hidden">
              {isImage ? (
                <div className="relative">
                  <img
                    src={fileUrl || ''}
                    alt={course.title}
                    className="w-full max-h-96 object-contain"
                  />
                  <button
                    onClick={() => setShowFilePreview(false)}
                    className="absolute top-2 right-2 p-2 bg-black bg-opacity-50 hover:bg-opacity-70 rounded-full text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              ) : isPDF ? (
                <div className="relative" style={{ height: '600px' }}>
                  <iframe
                    src={fileUrl || ''}
                    title={course.title}
                    className="w-full h-full"
                  />
                  <button
                    onClick={() => setShowFilePreview(false)}
                    className="absolute top-2 right-2 p-2 bg-black bg-opacity-50 hover:bg-opacity-70 rounded-full text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <div className="p-8 text-center text-white">
                  <p className="mb-4">Vista previa no disponible para este tipo de archivo</p>
                  <button
                    onClick={handleDownloadFile}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                  >
                    <Download className="w-5 h-5" />
                    Descargar archivo
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={() => setShowFilePreview(false)}
              className="mt-2 text-sm text-gray-600 hover:text-gray-900"
            >
              Ocultar vista previa
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>
            {new Date(course.created_at).toLocaleDateString('es-ES', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </span>
          <div className="flex items-center gap-3">
            {embedUrl && (
              <a
                href={course.youtube_url || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                Ver en YouTube
              </a>
            )}
            {hasFile && !showFilePreview && (
              <button
                onClick={handleDownloadFile}
                className="text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <Download className="w-3.5 h-3.5" />
                Descargar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

