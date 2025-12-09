import { useEffect, useState } from 'react';
import {
  ExternalLink,
  FolderOpen,
  FileText,
  Image,
  File as FileIcon,
  RefreshCw,
  Loader2,
  AlertCircle,
  Download,
  Upload,
  ChevronRight,
  Home,
  Search,
  X,
  FolderPlus,
} from 'lucide-react';
import { startGoogleAuth, getAccessToken, isAuthenticated } from '../../lib/googleAuthRedirect';
import { listFilesInFolder, downloadFileFromDrive, getFolderInfo, searchFilesRecursively, createFolder, DriveFile, DriveFolder } from '../../lib/googleDriveAPI';
import { GoogleDriveUpload } from './GoogleDriveUpload';

interface GoogleDriveViewerProps {
  folderId: string;
  folderName?: string;
  webViewLink?: string;
  onError?: (error: string) => void;
}

interface BreadcrumbItem {
  id: string;
  name: string;
}

export function GoogleDriveViewer({ folderId: initialFolderId, folderName: initialFolderName, webViewLink, onError }: GoogleDriveViewerProps) {
  // Guardar la carpeta raíz del cliente (no se puede salir de aquí)
  const rootFolderId = initialFolderId;
  const rootFolderName = initialFolderName || 'Carpeta';
  
  const [currentFolderId, setCurrentFolderId] = useState(initialFolderId);
  const [currentFolderName, setCurrentFolderName] = useState(initialFolderName || 'Carpeta');
  const [folders, setFolders] = useState<DriveFile[]>([]);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<{ folders: DriveFile[]; files: DriveFile[] } | null>(null);
  // Breadcrumbs solo para subcarpetas (la raíz siempre se muestra por separado)
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([]);

  // Actualizar currentFolderId cuando cambia initialFolderId
  useEffect(() => {
    if (initialFolderId && initialFolderId !== currentFolderId) {
      setCurrentFolderId(initialFolderId);
      setCurrentFolderName(initialFolderName || 'Carpeta');
      setBreadcrumbs([]); // Limpiar breadcrumbs al volver a la raíz
      setSearchTerm(''); // Limpiar búsqueda al cambiar de carpeta raíz
    }
  }, [initialFolderId, initialFolderName]);

  useEffect(() => {
    checkAuthAndLoadFiles();
  }, [currentFolderId]);

  // Búsqueda recursiva cuando hay término de búsqueda
  useEffect(() => {
    const performSearch = async () => {
      if (!searchTerm.trim()) {
        setSearchResults(null);
        setSearching(false);
        return;
      }

      try {
        setSearching(true);
        const token = await getAccessToken();
        const results = await searchFilesRecursively(rootFolderId, searchTerm.trim(), token);
        setSearchResults(results);
      } catch (err: any) {
        console.error('Error en búsqueda recursiva:', err);
        // Si es error de autenticación, marcar como no autenticado
        if (err.message?.includes('401') || err.message?.includes('expirado') || err.message?.includes('Unauthorized')) {
          setAuthenticated(false);
          setError('Tu sesión expiró. Por favor, autentica nuevamente.');
        }
        setSearchResults({ folders: [], files: [] });
      } finally {
        setSearching(false);
      }
    };

    // Debounce: esperar 500ms después de que el usuario deje de escribir
    const timeoutId = setTimeout(performSearch, 500);
    return () => clearTimeout(timeoutId);
  }, [searchTerm, rootFolderId]);

  const checkAuthAndLoadFiles = async () => {
    try {
      setLoading(true);
      setError(null);

      const hasAuth = isAuthenticated();
      setAuthenticated(hasAuth);

      if (hasAuth) {
        await loadFiles();
      } else {
        setLoading(false);
      }
    } catch (err: any) {
      console.error('Error checking auth:', err);
      setError(err.message || 'Error al verificar autenticación');
      setLoading(false);
    }
  };

  const loadFiles = async (retryCount = 0) => {
    try {
      setError(null);
      setLoading(true);
      let token: string;
      try {
        token = await getAccessToken();
      } catch (tokenError: any) {
        // Si el token expiró, intentar refrescar
        if (tokenError.message.includes('expirado') || tokenError.message.includes('No hay token')) {
          console.log('🔄 Token expirado, intentando reconectar...');
          setAuthenticated(false);
          // Si hay refresh token, intentar autenticar de nuevo automáticamente
          const refreshToken = localStorage.getItem('google_drive_refresh_token');
          if (refreshToken && retryCount === 0) {
            // Esperar un momento y reintentar
            await new Promise(resolve => setTimeout(resolve, 1000));
            return loadFiles(1);
          }
        }
        throw tokenError;
      }
      
      // Primero intentar cargar contenido (lo más importante)
      let content;
      try {
        content = await listFilesInFolder(currentFolderId, token);
        setFolders(content.folders);
        setFiles(content.files);
      } catch (listError: any) {
        // Si falla listar, ese es el error principal
        const errorMessage = listError.message || 'Error al cargar archivos';
        setError(errorMessage);
        
        if (errorMessage.includes('Token expirado') || errorMessage.includes('401')) {
          setAuthenticated(false);
        }
        
        if (errorMessage.includes('404') || errorMessage.includes('no encontrada') || errorMessage.includes('File not found')) {
          setError('No se pudo acceder a esta carpeta. Verifica que el ID de la carpeta sea correcto y que tengas permisos para acceder a ella.');
        }
        
        onError?.(errorMessage);
        return;
      }
      
      // Luego intentar obtener información de la carpeta (opcional, no crítico)
      // Solo intentar si no tenemos nombre o si es la carpeta inicial
      if (!currentFolderName || currentFolderId === initialFolderId) {
        try {
          const folderInfo = await getFolderInfo(currentFolderId, token);
          setCurrentFolderName(folderInfo.name);
          
          // Actualizar breadcrumb actual si existe
          if (breadcrumbs.length > 0) {
            const lastBreadcrumb = breadcrumbs[breadcrumbs.length - 1];
            if (lastBreadcrumb.id === currentFolderId) {
              setBreadcrumbs(prev => {
                const newBreadcrumbs = [...prev];
                newBreadcrumbs[newBreadcrumbs.length - 1].name = folderInfo.name;
                return newBreadcrumbs;
              });
            }
          }
        } catch (err: any) {
          // Esto no es crítico, solo no podemos mostrar el nombre exacto
          // No loguear el error completo para evitar ruido en consola
          if (err.message?.includes('File not found')) {
            // Si la carpeta no existe, usar nombre genérico
            if (!currentFolderName) {
              setCurrentFolderName('Carpeta');
            }
          } else {
            // Otros errores, no crítico
            if (!currentFolderName) {
              setCurrentFolderName('Carpeta');
            }
          }
          // No mostrar error al usuario porque ya tenemos los archivos
        }
      }
    } catch (err: any) {
      // Error general (token, etc.)
      const errorMessage = err.message || 'Error al cargar archivos';
      setError(errorMessage);
      
      if (errorMessage.includes('Token expirado') || errorMessage.includes('401') || 
          errorMessage.includes('Unauthorized') || errorMessage.includes('No hay token')) {
        setAuthenticated(false);
        // Si hay refresh token, intentar reconectar automáticamente
        const refreshToken = localStorage.getItem('google_drive_refresh_token');
        if (refreshToken && retryCount === 0) {
          console.log('🔄 Intentando reconectar automáticamente...');
          setTimeout(() => {
            checkAuthAndLoadFiles();
          }, 2000);
        }
      }
      
      onError?.(errorMessage);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleAuthenticate = async () => {
    await startGoogleAuth();
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadFiles();
  };

  const handleUploadComplete = () => {
    loadFiles();
    setShowUpload(false);
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      setError('Por favor, ingresa un nombre para la carpeta');
      return;
    }

    try {
      setCreatingFolder(true);
      setError(null);
      const token = await getAccessToken();
      
      await createFolder(newFolderName.trim(), currentFolderId, token);
      
      // Limpiar y refrescar
      setNewFolderName('');
      setShowCreateFolder(false);
      await loadFiles();
    } catch (err: any) {
      setError(err.message || 'Error al crear carpeta');
      onError?.(err.message || 'Error al crear carpeta');
    } finally {
      setCreatingFolder(false);
    }
  };

  const handleFolderClick = async (folder: DriveFile) => {
    try {
      setLoading(true);
      setError(null);
      const token = await getAccessToken();
      
      // Intentar obtener información de la carpeta (opcional)
      let folderName = folder.name;
      try {
        const folderInfo = await getFolderInfo(folder.id, token);
        folderName = folderInfo.name;
      } catch (err) {
        // Usar el nombre que ya tenemos del listado
      }
      
      // Agregar a breadcrumbs (solo subcarpetas, la raíz siempre se muestra)
      setBreadcrumbs(prev => [...prev, { id: folder.id, name: folderName }]);
      
      // Navegar a la carpeta
      setCurrentFolderId(folder.id);
      setCurrentFolderName(folderName);
      setSearchTerm(''); // Limpiar búsqueda al cambiar de carpeta
    } catch (err: any) {
      setError(err.message || 'Error al abrir carpeta');
      setLoading(false);
    }
  };

  const handleBreadcrumbClick = async (breadcrumb: BreadcrumbItem, index: number) => {
    // index + 1 porque el índice 0 en breadcrumbs es la primera subcarpeta (no la raíz)
    const actualIndex = index + 1;
    
    if (actualIndex === breadcrumbs.length) return; // Ya estamos en esta carpeta
    
    try {
      setLoading(true);
      
      // Si hace clic en el índice 0 (primera subcarpeta), volver a la raíz
      if (index === 0) {
        setBreadcrumbs([]);
        setCurrentFolderId(rootFolderId);
        setCurrentFolderName(rootFolderName);
      } else {
        // Recortar breadcrumbs hasta el índice seleccionado
        setBreadcrumbs(prev => prev.slice(0, index + 1));
        
        // Navegar a la carpeta
        setCurrentFolderId(breadcrumb.id);
        setCurrentFolderName(breadcrumb.name);
      }
      
      setSearchTerm(''); // Limpiar búsqueda al cambiar de carpeta
    } catch (err: any) {
      setError(err.message || 'Error al navegar');
    }
  };

  const handleDownload = async (file: DriveFile) => {
    try {
      const token = await getAccessToken();
      await downloadFileFromDrive(file.id, file.name, token);
    } catch (err: any) {
      setError(err.message || 'Error al descargar archivo');
      onError?.(err.message || 'Error al descargar archivo');
    }
  };

  const openInDrive = () => {
    const folderUrl = webViewLink || `https://drive.google.com/drive/folders/${currentFolderId}`;
    window.open(folderUrl, '_blank', 'noopener,noreferrer');
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) {
      return <Image className="w-5 h-5 text-green-600" />;
    } else if (mimeType.includes('pdf')) {
      return <FileText className="w-5 h-5 text-red-600" />;
    } else if (mimeType.includes('sheet') || mimeType.includes('excel')) {
      return <FileText className="w-5 h-5 text-green-600" />;
    } else if (mimeType.includes('word') || mimeType.includes('document')) {
      return <FileText className="w-5 h-5 text-blue-600" />;
    } else {
      return <FileIcon className="w-5 h-5 text-gray-600" />;
    }
  };

  const formatFileSize = (bytes?: string) => {
    if (!bytes) return 'Tamaño desconocido';
    const size = parseInt(bytes, 10);
    if (size === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(size) / Math.log(k));
    return Math.round((size / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading && !authenticated) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="space-y-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
          <FolderOpen className="w-16 h-16 text-blue-600 mx-auto mb-4" />
          {currentFolderName && (
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{currentFolderName}</h3>
          )}
          <p className="text-gray-600 mb-6">
            Para ver los archivos directamente en la aplicación, necesitas autenticarte con Google Drive.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={handleAuthenticate}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium flex items-center gap-2"
            >
              <FolderOpen className="w-5 h-5" />
              Autenticar con Google
            </button>
            <button
              onClick={openInDrive}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium flex items-center gap-2"
            >
              <ExternalLink className="w-5 h-5" />
              Abrir en Drive
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}
      </div>
    );
  }

  // Si hay término de búsqueda, SIEMPRE usar búsqueda recursiva (no filtrado local)
  // Solo mostrar resultados cuando searchResults esté disponible
  const filteredFolders = searchTerm.trim()
    ? (searchResults ? searchResults.folders : [])
    : folders;

  const filteredFiles = searchTerm.trim()
    ? (searchResults ? searchResults.files : [])
    : files;

  const totalItems = folders.length + files.length;
  const filteredTotalItems = filteredFolders.length + filteredFiles.length;

  return (
    <div className="space-y-4">
      {/* Breadcrumbs - Siempre mostrar la carpeta raíz del cliente */}
      <div className="flex items-center gap-2 text-sm text-gray-600 flex-wrap">
        <div className="flex items-center gap-2">
          <Home className="w-4 h-4" />
          <button
            onClick={() => {
              if (currentFolderId !== rootFolderId) {
                setBreadcrumbs([]);
                setCurrentFolderId(rootFolderId);
                setCurrentFolderName(rootFolderName);
                setSearchTerm('');
              }
            }}
            className={`font-semibold transition ${
              currentFolderId === rootFolderId 
                ? 'text-gray-900 cursor-default' 
                : 'text-blue-600 hover:text-blue-700'
            }`}
          >
            {rootFolderName}
          </button>
        </div>
        {breadcrumbs.length > 0 && (
          <>
            <ChevronRight className="w-4 h-4" />
            {breadcrumbs.map((breadcrumb, index) => (
              <div key={breadcrumb.id} className="flex items-center gap-2">
                <button
                  onClick={() => handleBreadcrumbClick(breadcrumb, index)}
                  className={`hover:text-blue-600 transition ${
                    index === breadcrumbs.length - 1 ? 'font-semibold text-gray-900' : ''
                  }`}
                >
                  {breadcrumb.name}
                </button>
                {index < breadcrumbs.length - 1 && <ChevronRight className="w-4 h-4" />}
              </div>
            ))}
          </>
        )}
      </div>

      {/* Header con acciones */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-1">{currentFolderName}</h3>
          <p className="text-xs text-gray-500">
            {totalItems} {totalItems === 1 ? 'elemento' : 'elementos'} 
            {folders.length > 0 && ` (${folders.length} ${folders.length === 1 ? 'carpeta' : 'carpetas'})`}
            {files.length > 0 && `, ${files.length} ${files.length === 1 ? 'archivo' : 'archivos'}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreateFolder(true)}
            className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium text-sm flex items-center gap-2"
          >
            <FolderPlus className="w-4 h-4" />
            Nueva Carpeta
          </button>
          <button
            onClick={() => setShowUpload(!showUpload)}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium text-sm flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Subir Archivos
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition disabled:opacity-50"
            title="Actualizar lista"
          >
            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={openInDrive}
            className="px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium text-sm flex items-center gap-2"
          >
            <FolderOpen className="w-4 h-4" />
            Abrir en Drive
          </button>
        </div>
      </div>

      {/* Buscador */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar archivos y carpetas en todas las subcarpetas..."
          className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        {searching && (
          <Loader2 className="absolute right-10 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
        )}
        {searchTerm.trim() && !searching && (
          <button
            onClick={() => setSearchTerm('')}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
            title="Limpiar búsqueda"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      
      {/* Indicador de búsqueda recursiva */}
      {searchTerm.trim() && searchResults && (
        <div className="text-xs text-gray-500 bg-blue-50 border border-blue-200 rounded-lg p-2">
          🔍 Buscando en todas las subcarpetas de "{rootFolderName}"...
        </div>
      )}

      {/* Modal para crear carpeta */}
      {showCreateFolder && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <FolderPlus className="w-5 h-5 text-green-600" />
            <h3 className="font-semibold text-gray-900">Crear Nueva Carpeta</h3>
          </div>
          <div className="space-y-3">
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !creatingFolder) {
                  handleCreateFolder();
                } else if (e.key === 'Escape') {
                  setShowCreateFolder(false);
                  setNewFolderName('');
                }
              }}
              placeholder="Nombre de la carpeta..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              autoFocus
              disabled={creatingFolder}
            />
            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={() => {
                  setShowCreateFolder(false);
                  setNewFolderName('');
                }}
                disabled={creatingFolder}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateFolder}
                disabled={creatingFolder || !newFolderName.trim()}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 flex items-center gap-2"
              >
                {creatingFolder ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creando...
                  </>
                ) : (
                  <>
                    <FolderPlus className="w-4 h-4" />
                    Crear Carpeta
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Zona de subida */}
      {showUpload && (
        <GoogleDriveUpload
          folderId={currentFolderId}
          onUploadComplete={handleUploadComplete}
          onError={onError}
        />
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-red-700 text-sm font-medium mb-1">{error}</p>
            {error.includes('ID de la carpeta') && (
              <p className="text-red-600 text-xs mb-2">
                Puedes seleccionar una nueva carpeta desde el selector de carpetas.
              </p>
            )}
            {error.includes('Token expirado') && (
              <button
                onClick={handleAuthenticate}
                className="mt-2 text-sm text-red-600 hover:text-red-700 underline"
              >
                Re-autenticar
              </button>
            )}
          </div>
        </div>
      )}

      {/* Contenido */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
      ) : (searchTerm.trim() && searching) ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Buscando en todas las subcarpetas...</p>
          </div>
        </div>
      ) : (searchTerm.trim() && !searching && filteredTotalItems === 0) ? (
        <div className="text-center py-12">
          <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No se encontraron resultados
          </h3>
          <p className="text-gray-600 mb-4">
            No hay archivos o carpetas que coincidan con "{searchTerm}"
          </p>
          <button
            onClick={() => setSearchTerm('')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
          >
            Limpiar búsqueda
          </button>
        </div>
      ) : totalItems === 0 ? (
        <div className="text-center py-12">
          <FileIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Carpeta vacía
          </h3>
          <p className="text-gray-600 mb-4">
            Esta carpeta está vacía. Sube archivos para comenzar.
          </p>
          <button
            onClick={() => setShowUpload(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
          >
            Subir Archivos
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Carpetas primero */}
          {filteredFolders.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">
                Carpetas {searchTerm.trim() && `(${filteredFolders.length} encontradas)`}
              </h4>
              <div className="space-y-2">
                {filteredFolders.map((folder) => (
                  <button
                    key={folder.id}
                    onClick={() => handleFolderClick(folder)}
                    className="w-full flex items-center gap-4 p-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition text-left group"
                  >
                    <FolderOpen className="w-8 h-8 text-blue-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{folder.name}</p>
                      <p className="text-xs text-gray-500">
                        Carpeta • Modificado: {formatDate(folder.modifiedTime)}
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Archivos después */}
          {filteredFiles.length > 0 && (
            <div>
              {filteredFolders.length > 0 && <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2 mt-4">Archivos</h4>}
              {filteredFolders.length === 0 && <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Archivos {searchTerm.trim() && `(${filteredFiles.length} encontrados)`}</h4>}
              <div className="space-y-2">
                {filteredFiles.map((file) => (
                  <div
                    key={file.id}
                    className="bg-gray-50 border border-gray-200 rounded-lg p-4 hover:bg-gray-100 transition group"
                  >
                    <div className="flex items-start gap-4">
                      {/* Icono o miniatura */}
                      <div className="flex-shrink-0 w-12 h-12 bg-white rounded-lg flex items-center justify-center border border-gray-200">
                        {file.thumbnailLink ? (
                          <img
                            src={file.thumbnailLink}
                            alt={file.name}
                            className="w-full h-full object-cover rounded-lg"
                          />
                        ) : (
                          getFileIcon(file.mimeType)
                        )}
                      </div>

                      {/* Información del archivo */}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-gray-900 truncate mb-1">{file.name}</h4>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                          <span>{formatFileSize(file.size)}</span>
                          <span>•</span>
                          <span>{formatDate(file.modifiedTime)}</span>
                        </div>
                      </div>

                      {/* Acciones */}
                      <div className="flex-shrink-0 flex items-center gap-2">
                        <button
                          onClick={() => handleDownload(file)}
                          className="p-2.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="Descargar archivo"
                        >
                          <Download className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => window.open(file.webViewLink, '_blank', 'noopener,noreferrer')}
                          className="p-2.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="Ver archivo en Google Drive"
                        >
                          <ExternalLink className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
