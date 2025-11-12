import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { ArrowLeft, User, Calendar } from 'lucide-react';

interface Thread {
  id: string;
  title: string;
  content: string;
  created_at: string;
  created_by: string;
  creator: {
    full_name: string;
    email: string;
    role: string;
  };
}

interface ThreadDetailProps {
  threadId: string;
  onBack: () => void;
}

export function ThreadDetail({ threadId, onBack }: ThreadDetailProps) {
  const [thread, setThread] = useState<Thread | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadThread();
  }, [threadId]);

  const loadThread = async () => {
    try {
      const { data, error } = await supabase
        .from('forum_threads')
        .select(`
          *,
          creator:profiles!forum_threads_created_by_fkey(full_name, email, role)
        `)
        .eq('id', threadId)
        .single();

      if (error) throw error;
      if (data) {
        setThread(data as unknown as Thread);
      }
    } catch (error) {
      console.error('Error loading thread:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!thread) {
    return <div className="text-center text-gray-500 p-8">Hilo no encontrado</div>;
  }

  return (
    <div>
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="w-5 h-5" />
        Volver al foro
      </button>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">{thread.title}</h1>

        <div className="flex items-center gap-6 text-sm text-gray-600 mb-8 pb-6 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4" />
            <span>{thread.creator.full_name}</span>
            <span className={`ml-2 px-2 py-0.5 text-xs font-medium rounded ${
              thread.creator.role === 'admin' ? 'bg-purple-100 text-purple-700' :
              thread.creator.role === 'support' ? 'bg-blue-100 text-blue-700' :
              'bg-gray-100 text-gray-700'
            }`}>
              {thread.creator.role === 'admin' ? 'Admin' :
               thread.creator.role === 'support' ? 'Soporte' : 'Usuario'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            <span>{new Date(thread.created_at).toLocaleDateString('es-ES', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}</span>
          </div>
        </div>

        <div className="prose max-w-none">
          <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{thread.content}</p>
        </div>
      </div>
    </div>
  );
}
