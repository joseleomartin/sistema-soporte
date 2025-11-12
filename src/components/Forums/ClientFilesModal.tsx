import { useEffect, useState } from 'react';
import { X, FileText, Image, File, Download, Calendar, User, Loader2, Search, ExternalLink } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface FileAttachment {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size: number;
  uploaded_at: string;
  uploader_name: string;
}

interface ClientFilesModalProps {
  subforumId: string;
  subforumName: string;
  onClose: () => void;
}

export function ClientFilesModal({ subforumId, subforumName, onClose }: ClientFilesModalProps) {
  const [files, setFiles] = useState<FileAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadFiles();
  }, [subforumId]);

  const loadFiles = async () => {
    try {
      setLoading(true);
      setError(null);

      // Obtener todos los mensajes con archivos adjuntos del subforo
      const { data: messages, error: messagesError } = await supabase
        .from('forum_messages')
        .select(`
          id,
          attachments,
          created_at,
          created_by
        `)
        .eq('subforum_id', subforumId)
        .not('attachments', 'is', null)
        .order('created_at', { ascending: false });

      if (messagesError) throw messagesError;

      // Obtener IDs únicos de usuarios
      const userIds = messages ? [...new Set(messages.map((m: any) => m.created_by).filter(Boolean))] : [];
      
      // Obtener información de usuarios
      const usersMap = new Map<string, string>();
      if (userIds.length > 0) {
        const { data: users } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', userIds);
        
        if (users) {
          users.forEach((user: any) => {
            usersMap.set(user.id, user.full_name);
          });
        }
      }

      // Extraer todos los archivos de los mensajes
      const allFiles: FileAttachment[] = [];
      
      if (messages) {
        messages.forEach((message: any) => {
          if (message.attachments && Array.isArray(message.attachments)) {
            message.attachments.forEach((attachment: any) => {
              // Generar URL pública desde el path
              const { data: urlData } = supabase.storage
                .from('ticket-attachments')
                .getPublicUrl(attachment.path);

              console.log('📁 Archivo encontrado:', {
                name: attachment.name,
                path: attachment.path,
                publicUrl: urlData.publicUrl
              });

              allFiles.push({
                id: `${message.id}-${attachment.name}`,
                file_name: attachment.name,
                file_url: urlData.publicUrl,
                file_type: attachment.type,
                file_size: attachment.size,
                uploaded_at: message.created_at,
                uploader_name: usersMap.get(message.created_by) || 'Usuario desconocido'
              });
            });
          }
        });
      }

      console.log(`✅ Total de archivos cargados: ${allFiles.length}`);
      setFiles(allFiles);
    } catch (err: any) {
      console.error('Error loading files:', err);
      setError(err.message || 'Error al cargar los archivos');
    } finally {
      setLoading(false);
    }
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) {
      return <Image className="w-5 h-5 text-green-600" />;
    } else if (fileType.includes('pdf')) {
      return <FileText className="w-5 h-5 text-red-600" />;
    } else if (fileType.includes('sheet') || fileType.includes('excel')) {
      return <FileText className="w-5 h-5 text-green-600" />;
    } else if (fileType.includes('word') || fileType.includes('document')) {
      return <FileText className="w-5 h-5 text-blue-600" />;
    } else {
      return <File className="w-5 h-5 text-gray-600" />;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const handleDownload = async (fileUrl: string, fileName: string) => {
    try {
      // Descargar el archivo usando fetch y crear un blob
      const response = await fetch(fileUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/octet-stream',
        },
      });

      if (!response.ok) {
        throw new Error('Error al descargar el archivo');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      
      // Limpiar
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
      alert('Error al descargar el archivo. Por favor, verifica tu conexión e intenta de nuevo.');
    }
  };

  const handleView = (fileUrl: string) => {
    try {
      // Abrir en nueva pestaña
      const newWindow = window.open(fileUrl, '_blank', 'noopener,noreferrer');
      if (!newWindow) {
        alert('Por favor, permite las ventanas emergentes para ver el archivo.');
      }
    } catch (error) {
      console.error('Error opening file:', error);
      alert('Error al abrir el archivo. Por favor, intenta de nuevo.');
    }
  };

  const filteredFiles = files.filter(file => 
    file.file_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    file.uploader_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <File className="w-6 h-6 text-blue-600" />
                Archivos de {subforumName}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {files.length} {files.length === 1 ? 'archivo' : 'archivos'} en total
                {searchTerm && ` • ${filteredFiles.length} ${filteredFiles.length === 1 ? 'resultado' : 'resultados'}`}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              <X className="w-6 h-6 text-gray-500" />
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre de archivo o usuario..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
              <p className="text-red-700">{error}</p>
            </div>
          ) : files.length === 0 ? (
            <div className="text-center py-12">
              <File className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No hay archivos
              </h3>
              <p className="text-gray-600">
                Este cliente aún no tiene archivos adjuntos
              </p>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="text-center py-12">
              <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No se encontraron archivos
              </h3>
              <p className="text-gray-600">
                No hay archivos que coincidan con "{searchTerm}"
              </p>
              <button
                onClick={() => setSearchTerm('')}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Limpiar búsqueda
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredFiles.map((file) => (
                <div
                  key={file.id}
                  className="bg-gray-50 border border-gray-200 rounded-lg p-4 hover:bg-gray-100 transition group"
                >
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className="flex-shrink-0 w-12 h-12 bg-white rounded-lg flex items-center justify-center border border-gray-200">
                      {getFileIcon(file.file_type)}
                    </div>

                    {/* File Info */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900 truncate mb-1">
                        {file.file_name}
                      </h4>
                      
                      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {file.uploader_name}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(file.uploaded_at).toLocaleDateString('es-ES', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </span>
                        <span className="font-medium">
                          {formatFileSize(file.file_size)}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex-shrink-0 flex items-center gap-2">
                      <button
                        onClick={() => handleView(file.file_url)}
                        className="p-2.5 text-blue-600 hover:bg-blue-50 rounded-lg transition flex items-center gap-1.5 font-medium text-sm"
                        title="Ver archivo en nueva pestaña"
                      >
                        <ExternalLink className="w-5 h-5" />
                        <span className="hidden sm:inline">Ver</span>
                      </button>
                      <button
                        onClick={() => handleDownload(file.file_url, file.file_name)}
                        className="p-2.5 text-green-600 hover:bg-green-50 rounded-lg transition flex items-center gap-1.5 font-medium text-sm"
                        title="Descargar archivo"
                      >
                        <Download className="w-5 h-5" />
                        <span className="hidden sm:inline">Descargar</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {files.length > 0 && (
          <div className="border-t border-gray-200 p-4 bg-gray-50">
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>
                Total: {files.reduce((acc, file) => acc + file.file_size, 0) > 0 
                  ? formatFileSize(files.reduce((acc, file) => acc + file.file_size, 0))
                  : '0 Bytes'}
              </span>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

