import { useState, useEffect } from 'react';
import { X, Play, User, FileText, Image, File, Download, Eye, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { CoursePartsManager } from './CoursePartsManager';
import { GoogleDriveViewer } from '../Forums/GoogleDriveViewer';

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
}

interface CourseDetailModalProps {
  course: Course;
  onClose: () => void;
}

export function CourseDetailModal({ course, onClose }: CourseDetailModalProps) {
  const { profile } = useAuth();
  const [showVideo, setShowVideo] = useState(false);
  const [showFilePreview, setShowFilePreview] = useState(false);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const isAdmin = profile?.role === 'admin';

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

  // Extraer el ID del video de YouTube
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
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-start justify-between p-6 border-b border-gray-200 flex-shrink-0">
            <div className="flex-1 pr-4">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {course.title}
              </h2>
              {course.created_by_profile && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <User className="w-4 h-4" />
                  <span>Creado por: {course.created_by_profile.full_name}</span>
                  <span className="mx-2">•</span>
                  <span>
                    {new Date(course.created_at).toLocaleDateString('es-ES', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </span>
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Content - Scrollable */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Descripción completa */}
            {course.description && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Descripción</h3>
                <p className="text-gray-600 whitespace-pre-wrap leading-relaxed">
                  {course.description}
                </p>
              </div>
            )}

            {/* Video de YouTube */}
            {embedUrl && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Video</h3>
                <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden">
                  <iframe
                    src={embedUrl}
                    title={course.title}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
                <div className="mt-3">
                  <a
                    href={course.youtube_url || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-700 text-sm inline-flex items-center gap-1"
                  >
                    Ver en YouTube
                  </a>
                </div>
              </div>
            )}

            {/* Google Drive (solo para documentos) */}
            {course.google_drive_folder_id && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Contenido de Google Drive</h3>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <GoogleDriveViewer
                    folderId={course.google_drive_folder_id}
                    folderName={course.title}
                    webViewLink={course.google_drive_link || undefined}
                    onError={(error) => {
                      console.error('Error loading Google Drive:', error);
                    }}
                  />
                </div>
              </div>
            )}

            {/* Archivo (solo si no hay Google Drive) */}
            {hasFile && !course.google_drive_folder_id && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Archivo adjunto</h3>
                {!showFilePreview ? (
                  <div>
                    {isImage && fileUrl ? (
                      <div className="relative bg-gray-100 rounded-lg overflow-hidden mb-3">
                        <img
                          src={fileUrl}
                          alt={course.title}
                          className="w-full max-h-96 object-contain"
                        />
                      </div>
                    ) : isImage && !fileUrl ? (
                      <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center mb-3">
                        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                      </div>
                    ) : null}
                    
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 bg-gray-50">
                      <div className="flex items-center gap-4">
                        {getFileIcon()}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">{course.file_name}</p>
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
                  </div>
                ) : (
                  <div>
                    <div className="relative bg-gray-900 rounded-lg overflow-hidden mb-3">
                      {isImage ? (
                        <div className="relative">
                          <img
                            src={fileUrl || ''}
                            alt={course.title}
                            className="w-full max-h-[600px] object-contain"
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
                      className="text-sm text-gray-600 hover:text-gray-900"
                    >
                      Ocultar vista previa
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Gestor de Partes del Curso (solo para cursos, no para documentos) */}
            {course.type !== 'document' && (
              <CoursePartsManager courseId={course.id} isAdmin={isAdmin || false} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

