import { useEffect, useState } from 'react';
import { Folder, Search, Loader2, AlertCircle, FolderOpen } from 'lucide-react';
import { startGoogleAuth, getAccessToken, isAuthenticated } from '../../lib/googleAuthRedirect';
import { searchFoldersByName, searchAllFolders, DriveFolder } from '../../lib/googleDriveAPI';

interface GoogleDriveFolderSelectorProps {
  clientName: string;
  onSelectFolder: (folder: DriveFolder) => void;
  onError?: (error: string) => void;
}

export function GoogleDriveFolderSelector({
  clientName,
  onSelectFolder,
  onError,
}: GoogleDriveFolderSelectorProps) {
  const [loading, setLoading] = useState(false);
  const [suggestedFolders, setSuggestedFolders] = useState<DriveFolder[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<DriveFolder[]>([]);
  const [searching, setSearching] = useState(false);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    // Verificar autenticación y cargar carpetas sugeridas al montar
    const checkAuth = async () => {
      const hasAuth = isAuthenticated();
      setAuthenticated(hasAuth);
      
      if (hasAuth && clientName) {
        await loadSuggestedFolders();
      }
    };
    
    checkAuth();
  }, [clientName]);

  const handleAuthenticate = () => {
    // Usar redirección en lugar de popup
    startGoogleAuth();
  };

  const loadSuggestedFolders = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = await getAccessToken();
      const folders = await searchFoldersByName(clientName, token);
      setSuggestedFolders(folders);
    } catch (err: any) {
      const errorMessage = err.message || 'Error al buscar carpetas sugeridas';
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setSearching(true);
      setError(null);
      const token = await getAccessToken();
      const result = await searchAllFolders(searchTerm, token);
      setSearchResults(result.folders);
      setNextPageToken(result.nextPageToken);
    } catch (err: any) {
      const errorMessage = err.message || 'Error al buscar carpetas';
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setSearching(false);
    }
  };

  const loadMoreFolders = async () => {
    if (!nextPageToken || !searchTerm.trim()) return;

    try {
      setSearching(true);
      const token = await getAccessToken();
      const result = await searchAllFolders(searchTerm, token, nextPageToken);
      setSearchResults((prev) => [...prev, ...result.folders]);
      setNextPageToken(result.nextPageToken);
    } catch (err: any) {
      const errorMessage = err.message || 'Error al cargar más carpetas';
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setSearching(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  if (!authenticated) {
    return (
      <div className="text-center py-12">
        <Folder className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Conectar con Google Drive
        </h3>
        <p className="text-gray-600 mb-6">
          Necesitas autenticarte con Google para buscar y seleccionar carpetas de Drive
        </p>
        <button
          onClick={handleAuthenticate}
          disabled={loading}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 mx-auto"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Autenticando...
            </>
          ) : (
            <>
              <FolderOpen className="w-5 h-5" />
              Autenticar con Google
            </>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Búsqueda manual */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Buscar carpeta manualmente
        </label>
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre de carpeta..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSearch();
                }
              }}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={searching || !searchTerm.trim()}
            className="px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {searching ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Search className="w-5 h-5" />
            )}
            Buscar
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-red-700 text-sm">{error}</p>
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

      {/* Carpetas sugeridas */}
      {suggestedFolders.length > 0 && searchResults.length === 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            Carpetas sugeridas para "{clientName}"
          </h3>
          <div className="space-y-2">
            {suggestedFolders.map((folder) => (
              <button
                key={folder.id}
                onClick={() => onSelectFolder(folder)}
                className="w-full flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition text-left"
              >
                <Folder className="w-5 h-5 text-blue-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{folder.name}</p>
                  <p className="text-xs text-gray-500">
                    Modificado: {formatDate(folder.modifiedTime)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Resultados de búsqueda */}
      {searchResults.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            Resultados de búsqueda
          </h3>
          <div className="space-y-2">
            {searchResults.map((folder) => (
              <button
                key={folder.id}
                onClick={() => onSelectFolder(folder)}
                className="w-full flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition text-left"
              >
                <Folder className="w-5 h-5 text-blue-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{folder.name}</p>
                  <p className="text-xs text-gray-500">
                    Modificado: {formatDate(folder.modifiedTime)}
                  </p>
                </div>
              </button>
            ))}
          </div>
          {nextPageToken && (
            <button
              onClick={loadMoreFolders}
              disabled={searching}
              className="mt-4 w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {searching ? 'Cargando...' : 'Cargar más carpetas'}
            </button>
          )}
        </div>
      )}

      {/* Sin resultados */}
      {!loading &&
        !searching &&
        suggestedFolders.length === 0 &&
        searchResults.length === 0 &&
        searchTerm && (
          <div className="text-center py-8">
            <Folder className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600">
              No se encontraron carpetas que coincidan con "{searchTerm}"
            </p>
          </div>
        )}

      {/* Loading */}
      {(loading || searching) && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
      )}
    </div>
  );
}
