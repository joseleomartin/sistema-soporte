import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { ArrowLeft, Plus, Search, Pin } from 'lucide-react';
import { ThreadDetail } from './ThreadDetail';
import { CreateThreadModal } from './CreateThreadModal';

interface Thread {
  id: string;
  title: string;
  content: string;
  created_at: string;
  is_pinned: boolean;
  created_by: string;
  creator: {
    full_name: string;
  };
}

interface Subforum {
  id: string;
  name: string;
  description: string | null;
  client_name: string;
}

interface ForumDetailProps {
  subforumId: string;
  onBack: () => void;
}

export function ForumDetail({ subforumId, onBack }: ForumDetailProps) {
  const { profile } = useAuth();
  const [subforum, setSubforum] = useState<Subforum | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [filteredThreads, setFilteredThreads] = useState<Thread[]>([]);
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [canPost, setCanPost] = useState(false);

  useEffect(() => {
    loadForumData();
  }, [subforumId, profile]);

  useEffect(() => {
    filterThreads();
  }, [threads, searchTerm]);

  const loadForumData = async () => {
    if (!profile) return;

    try {
      const { data: forumData } = await supabase
        .from('subforums')
        .select('*')
        .eq('id', subforumId)
        .single();

      if (forumData) {
        setSubforum(forumData);
      }

      const { data: threadsData } = await supabase
        .from('forum_threads')
        .select(`
          *,
          creator:profiles!forum_threads_created_by_fkey(full_name)
        `)
        .eq('subforum_id', subforumId)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

      if (threadsData) {
        setThreads(threadsData as unknown as Thread[]);
      }

      if (profile.role === 'admin') {
        setCanPost(true);
      } else {
        const { data: permission } = await supabase
          .from('subforum_permissions')
          .select('can_post')
          .eq('subforum_id', subforumId)
          .eq('user_id', profile.id)
          .maybeSingle();

        setCanPost(permission?.can_post || false);
      }
    } catch (error) {
      console.error('Error loading forum:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterThreads = () => {
    if (!searchTerm) {
      setFilteredThreads(threads);
      return;
    }

    const filtered = threads.filter(thread =>
      thread.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      thread.content.toLowerCase().includes(searchTerm.toLowerCase())
    );

    setFilteredThreads(filtered);
  };

  if (selectedThread) {
    return (
      <ThreadDetail
        threadId={selectedThread}
        onBack={() => {
          setSelectedThread(null);
          loadForumData();
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
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="w-5 h-5" />
        Volver a Clientes
      </button>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">{subforum?.name}</h2>
          {subforum?.description && (
            <p className="text-gray-600 mt-2">{subforum.description}</p>
          )}
          <p className="text-sm text-gray-500 mt-1">Cliente: {subforum?.client_name}</p>
        </div>
        {canPost && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Plus className="w-5 h-5" />
            Nuevo Hilo
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar en hilos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="divide-y divide-gray-200">
          {filteredThreads.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {searchTerm ? 'No se encontraron hilos' : 'No hay hilos en este foro'}
            </div>
          ) : (
            filteredThreads.map((thread) => (
              <div
                key={thread.id}
                onClick={() => setSelectedThread(thread.id)}
                className="p-6 hover:bg-gray-50 transition cursor-pointer"
              >
                <div className="flex items-start gap-4">
                  {thread.is_pinned && (
                    <Pin className="w-5 h-5 text-blue-600 flex-shrink-0 mt-1" />
                  )}
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg text-gray-900 mb-2">
                      {thread.title}
                    </h3>
                    <p className="text-gray-600 text-sm line-clamp-2 mb-3">
                      {thread.content}
                    </p>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span>Por: {thread.creator.full_name}</span>
                      <span>{new Date(thread.created_at).toLocaleDateString('es-ES')}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {showCreateModal && (
        <CreateThreadModal
          subforumId={subforumId}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            loadForumData();
          }}
        />
      )}
    </div>
  );
}
