import { useEffect, useState } from 'react';
import { X, FileText, Image, File, Download, Calendar, User, Loader2, Search, ExternalLink, Folder } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { GoogleDriveFolderSelector } from './GoogleDriveFolderSelector';
import { GoogleDriveViewer } from './GoogleDriveViewer';
import { DriveFolder } from '../../lib/googleDriveAPI';
import { startGoogleAuth, isAuthenticated } from '../../lib/googleAuthRedirect';

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
  const [activeTab, setActiveTab] = useState<'chat' | 'drive'>('chat');
  const [files, setFiles] = useState<FileAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Google Drive states
  const [driveFolderId, setDriveFolderId] = useState<string | null>(null);
  const [driveFolderName, setDriveFolderName] = useState<string | null>(null);
  const [driveFolderLink, setDriveFolderLink] = useState<string | null>(null);
  const [loadingDriveMapping, setLoadingDriveMapping] = useState(true);
  const [driveAuthenticated, setDriveAuthenticated] = useState(false);
  const [loadingDriveAuth, setLoadingDriveAuth] = useState(false);

  useEffect(() => {
    loadFiles();
    loadDriveMapping();
  }, [subforumId]);

  useEffect(() => {
    // Verificar autenticación de Google Drive cuando se cambia a la pestaña "drive"
    if (activeTab === 'drive') {
      const checkAuth = async () => {
        try {
          const hasAuth = isAuthenticated();
          setDriveAuthenticated(hasAuth);
        } catch (error) {
          console.error('Error verificando autenticación:', error);
          setDriveAuthenticated(false);
        }
      };
      checkAuth();
      
      // También verificar periódicamente si el usuario regresó de la autenticación
      const interval = setInterval(() => {
        if (activeTab === 'drive' && !driveAuthenticated) {
          const hasAuth = isAuthenticated();
          if (hasAuth) {
            setDriveAuthenticated(true);
            clearInterval(interval);
          }
        }
      }, 1000);
      
      return () => clearInterval(interval);
    }
  }, [activeTab, driveAuthenticated]);

  const loadDriveMapping = async () => {
    try {
      setLoadingDriveMapping(true);
      // Usar maybeSingle() en lugar de single() para evitar error 406 cuando no hay datos
      const { data, error } = await supabase
        .from('client_drive_mapping')
        .select('google_drive_folder_id, folder_name')
        .eq('subforum_id', subforumId)
        .maybeSingle();

      if (error) {
        // Si es error 406 o de tabla no encontrada, puede ser que la migración no se haya ejecutado
        if (error.code === 'PGRST301' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
          console.warn('Tabla client_drive_mapping no encontrada. Asegúrate de ejecutar la migración SQL.');
        } else if (error.code !== 'PGRST116') {
          // PGRST116 = no rows returned, es normal si no hay mapeo
          console.error('Error loading drive mapping:', error);
        }
      } else if (data) {
        setDriveFolderId(data.google_drive_folder_id);
        setDriveFolderName(data.folder_name);
        // Construir el enlace si no está guardado
        if (data.google_drive_folder_id) {
          setDriveFolderLink(`https://drive.google.com/drive/folders/${data.google_drive_folder_id}`);
        }
      }
    } catch (err: any) {
      console.error('Error loading drive mapping:', err);
      // Si es error 406, probablemente la tabla no existe
      if (err.message?.includes('406') || err.status === 406) {
        console.warn('Error 406: La tabla client_drive_mapping puede no existir. Ejecuta la migración SQL.');
      }
    } finally {
      setLoadingDriveMapping(false);
    }
  };

  const handleSelectFolder = async (folder: DriveFolder) => {
    try {
      // Usar función RPC para guardar mapeo (evita problemas con RLS)
      const { data, error } = await supabase.rpc('save_client_drive_mapping', {
        p_subforum_id: subforumId,
        p_google_drive_folder_id: folder.id,
        p_folder_name: folder.name,
      });

      if (error) {
        // Si es error de función no encontrada
        if (error.code === '42883' || error.message?.includes('function') || error.message?.includes('does not exist')) {
          throw new Error('La función save_client_drive_mapping no existe. Por favor, ejecuta la migración SQL en Supabase.');
        }
        // Si es error de permisos
        if (error.message?.includes('Solo administradores')) {
          throw new Error('Solo administradores y soporte pueden configurar carpetas de Drive.');
        }
        throw error;
      }

      setDriveFolderId(folder.id);
      setDriveFolderName(folder.name);
      setDriveFolderLink(folder.webViewLink);
    } catch (err: any) {
      console.error('Error saving drive mapping:', err);
      const errorMessage = err.message || 'Error desconocido';
      alert(`Error al guardar carpeta: ${errorMessage}`);
    }
  };

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
      return <File className="w-5 h-5 text-gray-600 dark:text-gray-400" />;
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
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <File className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                Archivos de {subforumName}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {activeTab === 'chat' && (
                  <>
                    {files.length} {files.length === 1 ? 'archivo' : 'archivos'} en total
                    {searchTerm && ` • ${filteredFiles.length} ${filteredFiles.length === 1 ? 'resultado' : 'resultados'}`}
                  </>
                )}
                {activeTab === 'drive' && driveFolderName && (
                  <>Carpeta: {driveFolderName}</>
                )}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition"
            >
              <X className="w-6 h-6 text-gray-500 dark:text-gray-400" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-gray-200 dark:border-slate-700">
            <button
              onClick={() => setActiveTab('chat')}
              className={`px-4 py-2 font-medium text-sm transition ${
                activeTab === 'chat'
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <FileText className="w-4 h-4 inline mr-2" />
              Archivos del Chat
            </button>
            <button
              onClick={() => setActiveTab('drive')}
              className={`px-4 py-2 font-medium text-sm transition ${
                activeTab === 'drive'
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Folder className="w-4 h-4 inline mr-2" />
              Google Drive del Cliente
            </button>
          </div>

          {/* Search Bar - Solo en pestaña de chat */}
          {activeTab === 'chat' && (
            <div className="relative mt-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
              <input
                type="text"
                placeholder="Buscar por nombre de archivo o usuario..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 forums-scroll">
          {activeTab === 'chat' ? (
            <>
              {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
          ) : error ? (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-lg p-4 text-center">
              <p className="text-red-700 dark:text-red-300">{error}</p>
            </div>
          ) : files.length === 0 ? (
            <div className="text-center py-12">
              <File className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                No hay archivos
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Este cliente aún no tiene archivos adjuntos
              </p>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="text-center py-12">
              <Search className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                No se encontraron archivos
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                No hay archivos que coincidan con "{searchTerm}"
              </p>
              <button
                onClick={() => setSearchTerm('')}
                className="mt-4 px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition"
              >
                Limpiar búsqueda
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredFiles.map((file) => (
                <div
                  key={file.id}
                  className="bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg p-4 hover:bg-gray-100 dark:hover:bg-slate-600 transition group"
                >
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className="flex-shrink-0 w-12 h-12 bg-white dark:bg-slate-800 rounded-lg flex items-center justify-center border border-gray-200 dark:border-slate-600">
                      {getFileIcon(file.file_type)}
                    </div>

                    {/* File Info */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900 dark:text-white truncate mb-1">
                        {file.file_name}
                      </h4>
                      
                      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
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
                        className="p-2.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition flex items-center gap-1.5 font-medium text-sm"
                        title="Ver archivo en nueva pestaña"
                      >
                        <ExternalLink className="w-5 h-5" />
                        <span className="hidden sm:inline">Ver</span>
                      </button>
                      <button
                        onClick={() => handleDownload(file.file_url, file.file_name)}
                        className="p-2.5 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition flex items-center gap-1.5 font-medium text-sm"
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
            </>
          ) : activeTab === 'drive' ? (
            <>
              {loadingDriveMapping ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                </div>
              ) : driveFolderId ? (
                <div className="space-y-4">
                  {/* Botón para conectar cuenta personal si no está autenticado */}
                  {!driveAuthenticated && (
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <Folder className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">Conecta tu cuenta de Google Drive</p>
                            <p className="text-sm text-gray-600 dark:text-gray-300">Necesitas autenticarte para acceder a la carpeta del cliente</p>
                          </div>
                        </div>
                        <button
                          onClick={async () => {
                            try {
                              setLoadingDriveAuth(true);
                              await startGoogleAuth();
                            } catch (error: any) {
                              console.error('Error al autenticar:', error);
                              alert(`Error al autenticar: ${error?.message || 'Error desconocido'}`);
                              setLoadingDriveAuth(false);
                            }
                          }}
                          disabled={loadingDriveAuth}
                          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                          <Folder className="w-4 h-4" />
                          {loadingDriveAuth ? 'Conectando...' : 'Conectar mi cuenta'}
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {driveAuthenticated ? (
                    <GoogleDriveViewer
                      folderId={driveFolderId}
                      folderName={driveFolderName || undefined}
                      webViewLink={driveFolderLink || undefined}
                      onError={(err) => {
                        setError(err);
                        // Si hay error, permitir seleccionar nueva carpeta
                        setDriveFolderId(null);
                        setDriveFolderName(null);
                        setDriveFolderLink(null);
                      }}
                    />
                  ) : (
                    <div className="text-center py-8">
                      <Folder className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                      <p className="text-gray-600 dark:text-gray-300">Conecta tu cuenta de Google Drive para ver los archivos</p>
                    </div>
                  )}
                </div>
              ) : (
                <GoogleDriveFolderSelector
                  clientName={subforumName}
                  onSelectFolder={handleSelectFolder}
                  onError={(err) => setError(err)}
                />
              )}
            </>
          ) : null}
        </div>

        {/* Footer */}
        {files.length > 0 && (
          <div className="border-t border-gray-200 dark:border-slate-700 p-4 bg-gray-50 dark:bg-slate-700">
            <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-300">
              <span>
                Total: {files.reduce((acc, file) => acc + file.file_size, 0) > 0 
                  ? formatFileSize(files.reduce((acc, file) => acc + file.file_size, 0))
                  : '0 Bytes'}
              </span>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-200 dark:bg-slate-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-500 transition font-medium"
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

