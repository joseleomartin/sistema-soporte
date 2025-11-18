import { useState, useRef, DragEvent } from 'react';
import { Upload, X, Check, AlertCircle, Loader2, File } from 'lucide-react';
import { getAccessToken } from '../../lib/googleAuthRedirect';
import { uploadFileToDrive } from '../../lib/googleDriveAPI';

interface FileWithProgress {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
}

interface GoogleDriveUploadProps {
  folderId: string;
  onUploadComplete: () => void;
  onError?: (error: string) => void;
}

export function GoogleDriveUpload({
  folderId,
  onUploadComplete,
  onError,
}: GoogleDriveUploadProps) {
  const [files, setFiles] = useState<FileWithProgress[]>([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    addFiles(droppedFiles);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    addFiles(selectedFiles);
  };

  const addFiles = (newFiles: File[]) => {
    const filesToAdd: FileWithProgress[] = newFiles.map((file) => ({
      file,
      progress: 0,
      status: 'pending',
    }));

    setFiles((prev) => [...prev, ...filesToAdd]);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0) return;

    setUploading(true);

    try {
      const token = await getAccessToken();

      // Subir archivos en secuencia
      for (let i = 0; i < files.length; i++) {
        const fileWithProgress = files[i];
        if (fileWithProgress.status !== 'pending') continue;

        // Actualizar estado a uploading
        setFiles((prev) => {
          const updated = [...prev];
          updated[i] = { ...updated[i], status: 'uploading', progress: 0 };
          return updated;
        });

        try {
          await uploadFileToDrive(
            fileWithProgress.file,
            folderId,
            token,
            (progress) => {
              // Actualizar progreso
              setFiles((prev) => {
                const updated = [...prev];
                updated[i] = { ...updated[i], progress };
                return updated;
              });
            }
          );

          // Marcar como éxito
          setFiles((prev) => {
            const updated = [...prev];
            updated[i] = { ...updated[i], status: 'success', progress: 100 };
            return updated;
          });
        } catch (error: any) {
          // Marcar como error
          setFiles((prev) => {
            const updated = [...prev];
            updated[i] = {
              ...updated[i],
              status: 'error',
              error: error.message || 'Error al subir archivo',
            };
            return updated;
          });
          onError?.(error.message || 'Error al subir archivo');
        }
      }

      // Esperar un momento antes de refrescar
      setTimeout(() => {
        onUploadComplete();
      }, 1000);
    } catch (error: any) {
      onError?.(error.message || 'Error al subir archivos');
    } finally {
      setUploading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const pendingFiles = files.filter((f) => f.status === 'pending');
  const hasPendingFiles = pendingFiles.length > 0;

  return (
    <div className="space-y-4">
      {/* Zona de drag & drop */}
      <div
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition
          ${
            dragging
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
          }
        `}
      >
        <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-700 font-medium mb-2">
          Arrastra archivos aquí o haz click para seleccionar
        </p>
        <p className="text-sm text-gray-500">
          Puedes subir múltiples archivos a la vez
        </p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* Lista de archivos seleccionados */}
      {files.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-gray-700">
            Archivos seleccionados ({files.length})
          </h4>
          {files.map((fileWithProgress, index) => (
            <div
              key={index}
              className="bg-gray-50 border border-gray-200 rounded-lg p-4"
            >
              <div className="flex items-start gap-3">
                <File className="w-5 h-5 text-gray-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate mb-1">
                    {fileWithProgress.file.name}
                  </p>
                  <p className="text-xs text-gray-500 mb-2">
                    {formatFileSize(fileWithProgress.file.size)}
                  </p>

                  {/* Barra de progreso */}
                  {fileWithProgress.status === 'uploading' && (
                    <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${fileWithProgress.progress}%` }}
                      />
                    </div>
                  )}

                  {/* Estado */}
                  {fileWithProgress.status === 'success' && (
                    <div className="flex items-center gap-2 text-green-600 text-sm">
                      <Check className="w-4 h-4" />
                      <span>Subido exitosamente</span>
                    </div>
                  )}

                  {fileWithProgress.status === 'error' && (
                    <div className="flex items-center gap-2 text-red-600 text-sm">
                      <AlertCircle className="w-4 h-4" />
                      <span>{fileWithProgress.error || 'Error al subir'}</span>
                    </div>
                  )}
                </div>

                {/* Botón remover */}
                {fileWithProgress.status === 'pending' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(index);
                    }}
                    className="p-1 text-gray-400 hover:text-red-600 transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* Botón subir */}
          {hasPendingFiles && (
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Subiendo...
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5" />
                  Subir {pendingFiles.length} {pendingFiles.length === 1 ? 'archivo' : 'archivos'}
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

