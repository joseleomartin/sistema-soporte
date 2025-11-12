import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Plus, FolderOpen, Users, Search, Settings, FileText, Image, File, Building2 } from 'lucide-react';
import { CreateForumModal } from './CreateForumModal';
import { SubforumChat } from './SubforumChat';
import { ManagePermissionsModal } from './ManagePermissionsModal';
import { ClientFilesModal } from './ClientFilesModal';
import { ManageDepartmentPermissionsModal } from './ManageDepartmentPermissionsModal';

interface Subforum {
  id: string;
  name: string;
  description: string | null;
  client_name: string;
  forum_id: string;
  created_at: string;
  message_count?: number;
}

export function ForumsList() {
  const { profile } = useAuth();
  const [subforums, setSubforums] = useState<Subforum[]>([]);
  const [filteredSubforums, setFilteredSubforums] = useState<Subforum[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedSubforum, setSelectedSubforum] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [managePermissionsFor, setManagePermissionsFor] = useState<Subforum | null>(null);
  const [manageDeptPermissionsFor, setManageDeptPermissionsFor] = useState<{ forumId: string, forumName: string } | null>(null);
  const [showFilesFor, setShowFilesFor] = useState<Subforum | null>(null);

  const canCreateForum = profile?.role === 'admin' || profile?.role === 'support';

  useEffect(() => {
    loadSubforums();
  }, [profile?.id]);

  useEffect(() => {
    filterSubforums();
  }, [subforums, searchTerm]);

  const loadSubforums = async () => {
    if (!profile?.id) return;

    try {
      let data;
      let error;

      if (profile.role === 'user') {
        const { data: permData, error: permError } = await supabase
          .from('subforum_permissions')
          .select('subforum_id')
          .eq('user_id', profile.id)
          .eq('can_view', true);

        if (permError) throw permError;

        const subforumIds = permData?.map((p) => p.subforum_id) || [];

        if (subforumIds.length === 0) {
          setSubforums([]);
          setLoading(false);
          return;
        }

        const result = await supabase
          .from('subforums')
          .select('*')
          .in('id', subforumIds)
          .order('created_at', { ascending: false });

        data = result.data;
        error = result.error;
      } else {
        const result = await supabase
          .from('subforums')
          .select('*')
          .order('created_at', { ascending: false });

        data = result.data;
        error = result.error;
      }

      if (error) throw error;

      if (data) {
        const forumsWithCounts = await Promise.all(
          data.map(async (forum) => {
            // Contar archivos adjuntos en los mensajes
            const { data: messages } = await supabase
              .from('forum_messages')
              .select('attachments')
              .eq('subforum_id', forum.id);

            // Contar el total de archivos en todos los mensajes
            let fileCount = 0;
            messages?.forEach((message: any) => {
              if (message.attachments && Array.isArray(message.attachments)) {
                fileCount += message.attachments.length;
              }
            });

            return {
              ...forum,
              message_count: fileCount, // Ahora es cantidad de archivos
            };
          })
        );

        setSubforums(forumsWithCounts);
      }
    } catch (error) {
      console.error('Error loading subforums:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterSubforums = () => {
    if (!searchTerm) {
      setFilteredSubforums(subforums);
      return;
    }

    const filtered = subforums.filter(
      (forum) =>
        forum.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        forum.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        forum.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    setFilteredSubforums(filtered);
  };

  if (selectedSubforum) {
    return (
      <SubforumChat
        subforumId={selectedSubforum}
        onBack={() => {
          setSelectedSubforum(null);
          loadSubforums();
        }}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex-1">
          <h2 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <FolderOpen className="w-8 h-8 text-blue-600" />
            Gestión de Clientes
          </h2>
          <p className="text-gray-600 mt-2">
            Base de datos completa de clientes con archivos, documentos y comunicación centralizada
          </p>
        </div>
        {canCreateForum && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
          >
            <Plus className="w-5 h-5" />
            Nuevo Cliente
          </button>
        )}
      </div>

      {/* Banner informativo sobre funcionalidades */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6 mb-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-3 flex items-center gap-2">
          <File className="w-5 h-5" />
          Sistema Completo de Gestión
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-start gap-3">
            <div className="bg-white rounded-lg p-2">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="font-medium text-blue-900 text-sm">Documentos</p>
              <p className="text-xs text-blue-700">PDFs, Excel, Word y más</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="bg-white rounded-lg p-2">
              <Image className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="font-medium text-blue-900 text-sm">Multimedia</p>
              <p className="text-xs text-blue-700">Fotos, videos e imágenes</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="bg-white rounded-lg p-2">
              <Users className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="font-medium text-blue-900 text-sm">Comunicación</p>
              <p className="text-xs text-blue-700">Chat y mensajería en tiempo real</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar clientes por nombre..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {filteredSubforums.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <FolderOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            {searchTerm ? 'No se encontraron clientes' : 'No hay clientes disponibles'}
          </h3>
          <p className="text-gray-600">
            {canCreateForum && !searchTerm
              ? 'Crea el primer cliente para comenzar a gestionar archivos y comunicación'
              : 'No tienes acceso a ningún cliente todavía'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSubforums.map((forum) => (
            <div
              key={forum.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition relative group"
            >
              {canCreateForum && (
                <div className="absolute top-4 right-4 flex gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setManageDeptPermissionsFor({ forumId: forum.forum_id, forumName: forum.name });
                    }}
                    className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition"
                    title="Permisos por departamento"
                  >
                    <Building2 className="w-5 h-5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setManagePermissionsFor(forum);
                    }}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                    title="Permisos por usuario"
                  >
                    <Users className="w-5 h-5" />
                  </button>
                </div>
              )}

              <div className="flex items-start justify-between mb-4">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowFilesFor(forum);
                  }}
                  className="w-12 h-12 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-lg flex items-center justify-center hover:scale-110 transition cursor-pointer hover:from-blue-200 hover:to-indigo-200"
                  title="Ver archivos del cliente"
                >
                  <FolderOpen className="w-6 h-6 text-blue-600" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowFilesFor(forum);
                  }}
                  className="flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600 transition"
                  title="Ver archivos"
                >
                  <File className="w-4 h-4" />
                  <span>{forum.message_count || 0}</span>
                </button>
              </div>

              <button
                onClick={() => setSelectedSubforum(forum.id)}
                className="w-full text-left"
              >
                <h3 className="text-xl font-bold text-gray-900 mb-2">{forum.name}</h3>

                {forum.description && (
                  <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                    {forum.description}
                  </p>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <span className="text-xs font-medium text-gray-500">
                    Cliente: {forum.client_name}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(forum.created_at).toLocaleDateString('es-ES')}
                  </span>
                </div>
              </button>
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <CreateForumModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            loadSubforums();
          }}
        />
      )}

      {managePermissionsFor && (
        <ManagePermissionsModal
          subforumId={managePermissionsFor.id}
          subforumName={managePermissionsFor.name}
          onClose={() => setManagePermissionsFor(null)}
        />
      )}

      {showFilesFor && (
        <ClientFilesModal
          subforumId={showFilesFor.id}
          subforumName={showFilesFor.name}
          onClose={() => setShowFilesFor(null)}
        />
      )}

      {manageDeptPermissionsFor && (
        <ManageDepartmentPermissionsModal
          forumId={manageDeptPermissionsFor.forumId}
          forumName={manageDeptPermissionsFor.forumName}
          onClose={() => setManageDeptPermissionsFor(null)}
        />
      )}
    </div>
  );
}
