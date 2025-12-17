import { useState, useRef } from 'react';
import { X, Upload, Loader2, Image, Video, FileImage, Link2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface CreatePostModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface FileWithPreview {
  file: File;
  preview: string;
  id: string;
}

export function CreatePostModal({ onClose, onSuccess }: CreatePostModalProps) {
  const { profile } = useAuth();
  const [content, setContent] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<FileWithPreview[]>([]);
  const [reelUrl, setReelUrl] = useState('');
  const [reelPlatform, setReelPlatform] = useState<'instagram' | 'tiktok' | 'x' | 'twitter' | 'facebook' | null>(null);
  const [postType, setPostType] = useState<'media' | 'reel'>('media');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const isSubmittingRef = useRef(false);

  const validateFile = (file: File): string | null => {
    // Validar tipo
    const validImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const validVideoTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
    const isValidType = validImageTypes.includes(file.type) || validVideoTypes.includes(file.type);
    
    if (!isValidType) {
      return 'Tipo de archivo no permitido. Solo se permiten imágenes (JPEG, PNG, GIF, WebP) y videos (MP4, WebM, QuickTime)';
    }

    // Validar tamaño
    const isImage = validImageTypes.includes(file.type);
    const maxSize = isImage ? 10 * 1024 * 1024 : 50 * 1024 * 1024; // 10MB para imágenes, 50MB para videos
    if (file.size > maxSize) {
      return isImage 
        ? 'El archivo es demasiado grande. Máximo 10MB para imágenes'
        : 'El archivo es demasiado grande. Máximo 50MB para videos';
    }

    return null;
  };

  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newFiles: FileWithPreview[] = [];
    let hasError = false;

    Array.from(files).forEach((file) => {
      const validationError = validateFile(file);
      if (validationError && !hasError) {
        setError(validationError);
        hasError = true;
        return;
      }

      if (!hasError) {
        const preview = URL.createObjectURL(file);
        newFiles.push({
          file,
          preview,
          id: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
        });
      }
    });

    if (!hasError && newFiles.length > 0) {
      setError(null);
      setSelectedFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(e.target.files);
    // Resetear el input para permitir seleccionar el mismo archivo de nuevo
    if (e.target) {
      e.target.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const removeFile = (id: string) => {
    setSelectedFiles((prev) => {
      const fileToRemove = prev.find((f) => f.id === id);
      if (fileToRemove) {
        URL.revokeObjectURL(fileToRemove.preview);
      }
      return prev.filter((f) => f.id !== id);
    });
  };

  const getMediaType = (file: File): 'image' | 'video' | 'gif' => {
    if (file.type === 'image/gif') return 'gif';
    if (file.type.startsWith('image/')) return 'image';
    if (file.type.startsWith('video/')) return 'video';
    return 'image'; // default
  };

  const detectReelPlatform = (url: string): 'instagram' | 'tiktok' | 'x' | 'twitter' | 'facebook' | null => {
    if (!url || !url.trim()) return null;
    
    const lowerUrl = url.toLowerCase().trim();
    
    // Instagram: instagram.com/reel/, instagram.com/p/, instagram.com/tv/, instagr.am
    if (lowerUrl.includes('instagram.com/reel/') || 
        lowerUrl.includes('instagram.com/p/') ||
        lowerUrl.includes('instagram.com/tv/') ||
        lowerUrl.includes('instagram.com/') ||
        lowerUrl.includes('instagr.am/p/') ||
        lowerUrl.includes('instagr.am/reel/') ||
        lowerUrl.includes('instagr.am/')) {
      return 'instagram';
    }
    
    // TikTok: tiktok.com/@ o vm.tiktok.com
    if (lowerUrl.includes('tiktok.com/') || lowerUrl.includes('vm.tiktok.com/')) {
      return 'tiktok';
    }
    
    // X (Twitter): x.com o twitter.com
    if (lowerUrl.includes('x.com/') || lowerUrl.includes('twitter.com/')) {
      return 'x';
    }
    
    // Facebook: facebook.com, fb.com, m.facebook.com
    if (lowerUrl.includes('facebook.com/') || 
        lowerUrl.includes('fb.com/') ||
        lowerUrl.includes('m.facebook.com/')) {
      return 'facebook';
    }
    
    return null;
  };

  const handleReelUrlChange = (url: string) => {
    setReelUrl(url);
    const platform = detectReelPlatform(url);
    setReelPlatform(platform);
    if (url && !platform) {
      setError('URL no reconocida. Por favor, pega un link de Instagram, TikTok, X o Facebook');
    } else {
      setError(null);
    }
  };

  const uploadFiles = async (): Promise<Array<{ url: string; type: 'image' | 'video' | 'gif' }>> => {
    if (selectedFiles.length === 0 || !profile) throw new Error('No hay archivos seleccionados');

    const uploadPromises = selectedFiles.map(async (fileWithPreview, index) => {
      const file = fileWithPreview.file;
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${index}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${profile.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('social-media')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('social-media')
        .getPublicUrl(filePath);

      return {
        url: data.publicUrl,
        type: getMediaType(file),
      };
    });

    return Promise.all(uploadPromises);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevenir doble envío
    if (isSubmittingRef.current || uploading) {
      return;
    }

    setError(null);

    // Validar según el tipo de post
    if (postType === 'media' && selectedFiles.length === 0) {
      setError('Debes subir al menos una imagen, video o GIF, o compartir un reel');
      return;
    }

    if (postType === 'reel' && !reelUrl.trim()) {
      setError('Debes pegar un link de Instagram, TikTok, X o Facebook');
      return;
    }

    if (postType === 'reel' && !reelPlatform) {
      setError('URL no reconocida. Por favor, pega un link válido de Instagram, TikTok, X o Facebook');
      return;
    }

    if (content.length > 500) {
      setError('El texto del post no puede exceder 500 caracteres');
      return;
    }

    if (!profile) {
      setError('No se pudo obtener la información del usuario');
      return;
    }

    try {
      isSubmittingRef.current = true;
      setUploading(true);

      let uploadedMedia: Array<{ url: string; type: 'image' | 'video' | 'gif' }> = [];

      // Si es tipo media, subir archivos
      if (postType === 'media' && selectedFiles.length > 0) {
        uploadedMedia = await uploadFiles();
      }

      // Crear el post
      const { data: postData, error: insertError } = await supabase
        .from('social_posts')
        .insert({
          user_id: profile.id,
          content: content.trim() || null,
          media_type: null, // Ya no es requerido
          media_url: null, // Ya no es requerido
          reel_url: postType === 'reel' ? reelUrl.trim() : null,
          reel_platform: postType === 'reel' ? reelPlatform : null,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Crear registros en social_post_media solo si hay archivos
      if (postData && uploadedMedia.length > 0) {
        const mediaRecords = uploadedMedia.map((media, index) => ({
          post_id: postData.id,
          media_type: media.type,
          media_url: media.url,
          display_order: index,
        }));

        const { error: mediaError } = await supabase
          .from('social_post_media')
          .insert(mediaRecords);

        if (mediaError) throw mediaError;
      }

      // Limpiar
      selectedFiles.forEach((f) => URL.revokeObjectURL(f.preview));
      setContent('');
      setSelectedFiles([]);
      setReelUrl('');
      setReelPlatform(null);
      setPostType('media');
      
      onSuccess();
    } catch (error: any) {
      console.error('Error creating post:', error);
      setError(error.message || 'Error al crear el post');
    } finally {
      setUploading(false);
      isSubmittingRef.current = false;
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={onClose} />
        
        <div className="relative bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-2xl w-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-slate-700">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Crear Publicación</h2>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <form onSubmit={handleSubmit} className="p-6">
            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-lg text-red-700 dark:text-red-300 text-sm">
                {error}
              </div>
            )}

            {/* Text input */}
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="¿Qué quieres compartir?"
              className="w-full p-3 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4"
              rows={4}
              maxLength={500}
            />
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-4 text-right">
              {content.length}/500
            </div>

            {/* Tipo de post: Media o Reel */}
            <div className="mb-4 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setPostType('media');
                  setReelUrl('');
                  setReelPlatform(null);
                  setError(null);
                }}
                className={`flex-1 px-4 py-2 rounded-lg border-2 transition-colors ${
                  postType === 'media'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                    : 'border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-slate-500'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <Upload className="w-4 h-4" />
                  <span className="font-medium">Subir Media</span>
                </div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setPostType('reel');
                  setSelectedFiles([]);
                  setError(null);
                }}
                className={`flex-1 px-4 py-2 rounded-lg border-2 transition-colors ${
                  postType === 'reel'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                    : 'border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-slate-500'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <Link2 className="w-4 h-4" />
                  <span className="font-medium">Compartir Post/Reel</span>
                </div>
              </button>
            </div>

            {/* Reel URL input */}
            {postType === 'reel' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Pega el link del post o reel (Instagram, TikTok, X o Facebook)
                </label>
                <input
                  type="url"
                  value={reelUrl}
                  onChange={(e) => handleReelUrlChange(e.target.value)}
                  placeholder="https://www.instagram.com/p/... o https://www.tiktok.com/... o https://x.com/... o https://www.facebook.com/..."
                  className="w-full p-3 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {reelPlatform && (
                  <div className="mt-2 flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
                    <Link2 className="w-4 h-4" />
                    <span>
                      {reelPlatform === 'instagram' && 'Instagram Post/Reel detectado'}
                      {reelPlatform === 'tiktok' && 'TikTok detectado'}
                      {(reelPlatform === 'x' || reelPlatform === 'twitter') && 'X (Twitter) detectado'}
                      {reelPlatform === 'facebook' && 'Facebook detectado'}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* File upload area */}
            {postType === 'media' && (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-4 transition-colors mb-4 ${
                isDragging
                  ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-300 dark:border-slate-600 hover:border-gray-400 dark:hover:border-slate-500'
              }`}
            >
              {selectedFiles.length === 0 ? (
                <div className="text-center py-4">
                  <Upload className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-300 mb-2">
                    Arrastra y suelta imágenes, videos o GIFs aquí
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    o haz clic para seleccionar
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/quicktime"
                    onChange={handleFileInputChange}
                    multiple
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Seleccionar archivos
                  </button>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
                    Máximo 10MB para imágenes/GIFs, 50MB para videos. Puedes seleccionar múltiples archivos.
                  </p>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {selectedFiles.length} archivo{selectedFiles.length !== 1 ? 's' : ''} seleccionado{selectedFiles.length !== 1 ? 's' : ''}
                    </p>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                    >
                      + Agregar más
                    </button>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/quicktime"
                    onChange={handleFileInputChange}
                    multiple
                    className="hidden"
                  />
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {selectedFiles.map((fileWithPreview) => (
                      <div key={fileWithPreview.id} className="relative group">
                        <div className="relative rounded-lg overflow-hidden border border-gray-200 dark:border-slate-700 aspect-square">
                          {fileWithPreview.file.type.startsWith('image/') ? (
                            <img
                              src={fileWithPreview.preview}
                              alt="Preview"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <video
                              src={fileWithPreview.preview}
                              className="w-full h-full object-cover"
                              muted
                            />
                          )}
                          <button
                            type="button"
                            onClick={() => removeFile(fileWithPreview.id)}
                            className="absolute top-1 right-1 p-1.5 bg-black bg-opacity-50 hover:bg-opacity-70 rounded-full text-white transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 truncate">
                          {fileWithPreview.file.name}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-slate-700 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
                disabled={uploading}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={uploading || (postType === 'media' && selectedFiles.length === 0) || (postType === 'reel' && !reelUrl.trim())}
                className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Publicando...
                  </>
                ) : (
                  'Publicar'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

