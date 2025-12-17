import { useEffect, useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { 
  FileText, 
  Video, 
  Plus, 
  X, 
  Upload, 
  Trash2, 
  Eye,
  Download,
  Loader2,
  AlertCircle,
  CheckCircle
} from 'lucide-react';

interface InternalPolicy {
  id: string;
  title: string;
  description?: string;
  type: 'document' | 'video';
  youtube_url?: string;
  file_path?: string;
  file_name?: string;
  file_type?: string;
  file_size?: number;
  created_at: string;
  created_by_profile?: {
    full_name: string;
  };
}

export function InternalPolicies() {
  const { profile } = useAuth();
  const [policies, setPolicies] = useState<InternalPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'document' | 'video'>('all');

  const isAdmin = profile?.role === 'admin';

  useEffect(() => {
    loadPolicies();
  }, [profile?.id]);

  const loadPolicies = async () => {
    try {
      const { data, error } = await supabase
        .from('internal_policies')
        .select(`
          *,
          created_by_profile:profiles!internal_policies_created_by_fkey(full_name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPolicies(data || []);
    } catch (error: any) {
      console.error('Error loading policies:', error);
      setMessage({ type: 'error', text: 'Error al cargar las políticas de onboarding' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar esta política interna?')) return;

    try {
      const policy = policies.find(p => p.id === id);
      
      // Si tiene archivo, eliminarlo del storage
      if (policy?.file_path) {
        const { error: deleteError } = await supabase.storage
          .from('internal-policies')
          .remove([policy.file_path]);
        
        if (deleteError) {
          console.error('Error deleting file:', deleteError);
        }
      }

      const { error } = await supabase
        .from('internal_policies')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setMessage({ type: 'success', text: 'Política eliminada correctamente' });
      setTimeout(() => setMessage(null), 3000);
      await loadPolicies();
    } catch (error: any) {
      console.error('Error deleting policy:', error);
      setMessage({ type: 'error', text: 'Error al eliminar la política' });
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const getFileUrl = (filePath: string) => {
    const { data } = supabase.storage
      .from('internal-policies')
      .getPublicUrl(filePath);
    return data.publicUrl;
  };

  const getYouTubeVideoId = (url: string) => {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/);
    return match ? match[1] : null;
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const filteredPolicies = policies.filter(policy => {
    const matchesSearch = !searchTerm || 
      policy.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      policy.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = typeFilter === 'all' || policy.type === typeFilter;
    
    return matchesSearch && matchesType;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Onboarding / Políticas internas</h2>
          <p className="text-gray-600 dark:text-gray-300 mt-2">
            Documentos y videos de onboarding y políticas internas de la empresa
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Agregar Política
          </button>
        )}
      </div>

          {message && (
        <div className={`mb-6 rounded-lg p-4 flex items-start gap-3 ${
          message.type === 'success' 
            ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50' 
            : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          )}
          <p className={message.type === 'success' ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}>
            {message.text}
          </p>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 mb-6 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Buscar por título o descripción..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
            />
            <FileText className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
          >
            <option value="all">Todos los tipos</option>
            <option value="document">Documentos</option>
            <option value="video">Videos</option>
          </select>
        </div>
      </div>

      {/* Lista de políticas */}
      {filteredPolicies.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-12 text-center">
          <FileText className="w-16 h-16 mx-auto mb-4 text-gray-400 dark:text-gray-600" />
          <p className="text-gray-500 dark:text-gray-400 text-lg mb-2">
            {searchTerm || typeFilter !== 'all' 
              ? 'No se encontraron políticas con los filtros aplicados' 
              : 'No hay políticas de onboarding disponibles'}
          </p>
          {isAdmin && !searchTerm && typeFilter === 'all' && (
            <p className="text-sm text-gray-400 dark:text-gray-500">
              Haz clic en "Agregar Política" para comenzar
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPolicies.map((policy) => (
            <PolicyCard
              key={policy.id}
              policy={policy}
              isAdmin={isAdmin}
              onDelete={handleDelete}
              getFileUrl={getFileUrl}
              getYouTubeVideoId={getYouTubeVideoId}
              formatFileSize={formatFileSize}
            />
          ))}
        </div>
      )}

      {showCreateModal && isAdmin && (
        <CreatePolicyModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            loadPolicies();
          }}
        />
      )}
    </div>
  );
}

// Componente para mostrar una tarjeta de política
function PolicyCard({
  policy,
  isAdmin,
  onDelete,
  getFileUrl,
  getYouTubeVideoId,
  formatFileSize
}: {
  policy: InternalPolicy;
  isAdmin: boolean;
  onDelete: (id: string) => void;
  getFileUrl: (path: string) => string;
  getYouTubeVideoId: (url: string) => string | null;
  formatFileSize: (bytes?: number) => string;
}) {
  const [showViewer, setShowViewer] = useState(false);

  const isVideo = policy.type === 'video';
  const videoId = policy.youtube_url ? getYouTubeVideoId(policy.youtube_url) : null;
  const youtubeThumbnail = videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : null;
  const fileUrl = policy.file_path ? getFileUrl(policy.file_path) : null;
  const isImage = policy.file_type?.startsWith('image/');
  const isPdf = policy.file_type === 'application/pdf';

  return (
    <>
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden hover:shadow-md transition-shadow flex flex-col relative">
        {/* Botón eliminar en la esquina superior derecha */}
        {isAdmin && (
          <button
            onClick={() => onDelete(policy.id)}
            className="absolute top-3 right-3 p-1.5 text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors z-10 shadow-lg"
            title="Eliminar"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}

        {/* Previsualización */}
        {isVideo && youtubeThumbnail ? (
          <div className="w-full h-48 bg-gray-100 dark:bg-slate-700 overflow-hidden cursor-pointer relative group" onClick={() => setShowViewer(true)}>
            <img
              src={youtubeThumbnail}
              alt={policy.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center group-hover:bg-opacity-40 transition-opacity">
              <div className="bg-red-600 rounded-full p-4">
                <Video className="w-8 h-8 text-white" />
              </div>
            </div>
          </div>
        ) : isImage && fileUrl ? (
          <div className="w-full h-48 bg-gray-100 dark:bg-slate-700 overflow-hidden cursor-pointer" onClick={() => setShowViewer(true)}>
            <img
              src={fileUrl}
              alt={policy.title}
              className="w-full h-full object-cover"
            />
          </div>
        ) : isPdf && fileUrl ? (
          <div 
            className="w-full h-48 bg-gray-900 overflow-hidden cursor-pointer relative group border-b border-gray-200 dark:border-slate-700"
            onClick={() => setShowViewer(true)}
          >
            <iframe
              src={`${fileUrl}#toolbar=0&navpanes=0&scrollbar=0&view=Fit&zoom=50`}
              className="w-full h-full opacity-90 group-hover:opacity-100 transition-opacity"
              title={`Preview: ${policy.title}`}
              style={{ pointerEvents: 'none' }}
            />
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 via-black/30 to-transparent p-2 pointer-events-none">
              <div className="flex items-center gap-2 text-white text-xs">
                <FileText className="w-4 h-4" />
                <span className="font-medium">PDF</span>
                {policy.file_size && (
                  <span className="opacity-75">• {formatFileSize(policy.file_size)}</span>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div 
            className={`w-full h-48 flex items-center justify-center cursor-pointer hover:opacity-90 transition-opacity ${
              isVideo ? 'bg-red-50 dark:bg-red-900/20' : 'bg-blue-50 dark:bg-blue-900/20'
            }`}
            onClick={() => setShowViewer(true)}
          >
            {isVideo ? (
              <div className="text-center">
                <Video className="w-16 h-16 text-red-600 dark:text-red-400 mx-auto mb-2" />
                <p className="text-sm text-red-700 dark:text-red-300 font-medium">Video</p>
              </div>
            ) : (
              <div className="text-center">
                <FileText className="w-16 h-16 text-blue-600 dark:text-blue-400 mx-auto mb-2" />
                <p className="text-sm text-blue-700 dark:text-blue-300 font-medium">
                  {policy.file_name?.split('.').pop()?.toUpperCase() || 'Documento'}
                </p>
                {policy.file_size && (
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">{formatFileSize(policy.file_size)}</p>
                )}
              </div>
            )}
          </div>
        )}

        <div className="p-6 flex-1 flex flex-col">
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-semibold text-gray-900 dark:text-white truncate flex-1">{policy.title}</h3>
              <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded flex-shrink-0 ${
                isVideo ? 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300' : 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
              }`}>
                {isVideo ? 'Video' : 'Documento'}
              </span>
            </div>
          </div>

          {policy.description && (
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 line-clamp-2 flex-1">{policy.description}</p>
          )}

          <div className="mt-auto pt-4 border-t border-gray-200 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {policy.created_by_profile?.full_name && (
                  <p>Creado por: {policy.created_by_profile.full_name}</p>
                )}
                <p>{new Date(policy.created_at).toLocaleDateString('es-ES')}</p>
              </div>
              <button
                onClick={() => setShowViewer(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 dark:bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
              >
                <Eye className="w-4 h-4" />
                Ver
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal para ver la política */}
      {showViewer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={() => setShowViewer(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between z-10">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">{policy.title}</h3>
              <button
                onClick={() => setShowViewer(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
            <div className="p-6">
              {policy.description && (
                <p className="text-gray-700 dark:text-gray-300 mb-6">{policy.description}</p>
              )}
              
              {isVideo && videoId ? (
                <div className="aspect-video w-full">
                  <iframe
                    src={`https://www.youtube.com/embed/${videoId}`}
                    title={policy.title}
                    className="w-full h-full rounded-lg"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              ) : policy.file_path ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-700 rounded-lg">
                    <div className="flex items-center gap-3">
                      <FileText className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{policy.file_name}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{formatFileSize(policy.file_size)}</p>
                      </div>
                    </div>
                    <a
                      href={getFileUrl(policy.file_path)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      Descargar
                    </a>
                  </div>
                  
                  {/* Mostrar imágenes */}
                  {policy.file_type?.startsWith('image/') && (
                    <div className="w-full">
                      <img
                        src={getFileUrl(policy.file_path)}
                        alt={policy.title}
                        className="w-full rounded-lg border border-gray-200 dark:border-slate-700"
                      />
                    </div>
                  )}
                  
                  {/* Mostrar PDFs */}
                  {policy.file_type === 'application/pdf' && (
                    <div className="w-full border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden bg-gray-50 dark:bg-slate-800">
                      <iframe
                        src={`${getFileUrl(policy.file_path)}#toolbar=1`}
                        className="w-full h-[600px]"
                        title={policy.title}
                      />
                    </div>
                  )}
                  
                  {/* Para otros tipos de documentos, intentar mostrar en iframe o embed */}
                  {!policy.file_type?.startsWith('image/') && policy.file_type !== 'application/pdf' && (
                    <div className="w-full space-y-4">
                      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-lg p-4">
                        <p className="text-sm text-blue-800 mb-2">
                          Este tipo de archivo no se puede visualizar directamente en el navegador.
                        </p>
                        <p className="text-sm text-blue-700">
                          Haz clic en "Descargar" para abrir el archivo con la aplicación correspondiente.
                        </p>
                      </div>
                      
                      {/* Intentar mostrar en iframe para algunos tipos comunes */}
                      {(policy.file_type?.includes('text/') || 
                        policy.file_type?.includes('application/vnd.openxmlformats') ||
                        policy.file_name?.endsWith('.txt') ||
                        policy.file_name?.endsWith('.csv')) && (
                        <div className="w-full border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden bg-white dark:bg-slate-800">
                          <iframe
                            src={getFileUrl(policy.file_path)}
                            className="w-full h-[600px]"
                            title={policy.title}
                            onError={(e) => {
                              // Si falla, ocultar el iframe
                              (e.target as HTMLIFrameElement).style.display = 'none';
                            }}
                          />
                        </div>
                      )}
                      
                      {/* Para archivos de Office o otros, mostrar vista previa de Google Viewer */}
                      {(policy.file_name?.endsWith('.doc') || 
                        policy.file_name?.endsWith('.docx') ||
                        policy.file_name?.endsWith('.xls') ||
                        policy.file_name?.endsWith('.xlsx') ||
                        policy.file_name?.endsWith('.ppt') ||
                        policy.file_name?.endsWith('.pptx')) && (
                        <div className="w-full border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden bg-gray-50 dark:bg-slate-800">
                          <iframe
                            src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(getFileUrl(policy.file_path))}`}
                            className="w-full h-[600px]"
                            title={policy.title}
                            onError={(e) => {
                              // Si falla, mostrar mensaje
                              (e.target as HTMLIFrameElement).style.display = 'none';
                            }}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Modal para crear una nueva política
function CreatePolicyModal({ onClose, onSuccess }: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { profile } = useAuth();
  const [type, setType] = useState<'document' | 'video'>('document');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setYoutubeUrl(''); // Limpiar YouTube URL si se selecciona archivo
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('El título es requerido');
      return;
    }

    if (type === 'video' && !youtubeUrl.trim()) {
      setError('Debes proporcionar una URL de YouTube');
      return;
    }

    if (type === 'document' && !selectedFile) {
      setError('Debes seleccionar un archivo');
      return;
    }

    if (!profile?.id) {
      setError('No se pudo identificar el usuario');
      return;
    }

    setUploading(true);

    try {
      let filePath = null;
      let fileName = null;
      let fileType = null;
      let fileSize = null;

      // Si es documento, subir el archivo
      if (type === 'document' && selectedFile) {
        const fileExt = selectedFile.name.split('.').pop();
        const fileNameUnique = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePathStorage = `${profile.id}/${fileNameUnique}`;

        const { error: uploadError } = await supabase.storage
          .from('internal-policies')
          .upload(filePathStorage, selectedFile);

        if (uploadError) throw uploadError;

        filePath = filePathStorage;
        fileName = selectedFile.name;
        fileType = selectedFile.type;
        fileSize = selectedFile.size;
      }

      // Crear la política
      const { error: insertError } = await supabase
        .from('internal_policies')
        .insert({
          title: title.trim(),
          description: description.trim() || null,
          type: type,
          youtube_url: type === 'video' ? youtubeUrl.trim() : null,
          file_path: type === 'document' ? filePath : null,
          file_name: type === 'document' ? fileName : null,
          file_type: type === 'document' ? fileType : null,
          file_size: type === 'document' ? fileSize : null,
          created_by: profile.id
        });

      if (insertError) throw insertError;

      onSuccess();
    } catch (err: any) {
      console.error('Error creating policy:', err);
      setError(err.message || 'Error al crear la política interna');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">Agregar Política</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Tipo *
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setType('document');
                  setYoutubeUrl('');
                  setSelectedFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className={`flex-1 px-4 py-2 rounded-lg border-2 transition-colors ${
                  type === 'document'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 font-medium'
                    : 'border-gray-300 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50'
                }`}
              >
                Documento
              </button>
              <button
                type="button"
                onClick={() => {
                  setType('video');
                  setSelectedFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className={`flex-1 px-4 py-2 rounded-lg border-2 transition-colors ${
                  type === 'video'
                    ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 font-medium'
                    : 'border-gray-300 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50'
                }`}
              >
                Video (YouTube)
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Título *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Descripción (opcional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
              rows={3}
            />
          </div>

          {type === 'video' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                URL de YouTube *
              </label>
              <input
                type="url"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                required
              />
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Puedes usar URLs de YouTube en formato: youtube.com/watch?v=... o youtu.be/...
              </p>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Archivo *
              </label>
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.mp4,.mp3,.zip,.rar,.csv"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full px-4 py-3 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 transition-colors flex items-center justify-center gap-2 bg-white dark:bg-slate-800"
              >
                <Upload className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  {selectedFile ? selectedFile.name : 'Seleccionar archivo'}
                </span>
              </button>
              {selectedFile && (
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              )}
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-lg">
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-slate-700 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={uploading}
              className="px-4 py-2 text-white bg-blue-600 dark:bg-blue-500 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Subiendo...
                </>
              ) : (
                'Crear Política'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

