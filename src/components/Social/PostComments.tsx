import { useState, useEffect, useRef } from 'react';
import { Send, Edit2, Trash2, User } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { EmojiPicker } from '../EmojiPicker';

interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  user_profile?: {
    full_name: string;
    avatar_url?: string | null;
  };
}

interface PostCommentsProps {
  postId: string;
}

export function PostComments({ postId }: PostCommentsProps) {
  const { profile } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const commentsEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchComments();
    
    // Suscripción a cambios en tiempo real
    const channel = supabase
      .channel(`post_comments_${postId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'social_comments',
          filter: `post_id=eq.${postId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            fetchCommentWithProfile(payload.new.id).then((comment) => {
              if (comment) {
                setComments((prev) => [comment, ...prev]);
                scrollToBottom();
              }
            });
          } else if (payload.eventType === 'UPDATE') {
            fetchCommentWithProfile(payload.new.id).then((comment) => {
              if (comment) {
                setComments((prev) =>
                  prev.map((c) => (c.id === comment.id ? comment : c))
                );
              }
            });
          } else if (payload.eventType === 'DELETE') {
            setComments((prev) => prev.filter((c) => c.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [postId]);

  const fetchCommentWithProfile = async (commentId: string): Promise<Comment | null> => {
      const { data, error } = await supabase
        .from('social_comments')
        .select(`
          *,
          user_profile:profiles!social_comments_user_id_fkey (
            full_name,
            avatar_url
          )
        `)
        .eq('id', commentId)
        .maybeSingle();

    if (error) {
      console.error('Error fetching comment:', error);
      return null;
    }

    return data as Comment;
  };

  const fetchComments = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('social_comments')
        .select(`
          *,
          user_profile:profiles!social_comments_user_id_fkey (
            full_name,
            avatar_url
          )
        `)
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setComments(data || []);
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setLoading(false);
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !profile) return;
    if (newComment.length > 1000) {
      alert('El comentario no puede exceder 1000 caracteres');
      return;
    }

    try {
      setSubmitting(true);
      const { error } = await supabase
        .from('social_comments')
        .insert({
          post_id: postId,
          user_id: profile.id,
          content: newComment.trim(),
        });

      if (error) throw error;
      setNewComment('');
    } catch (error: any) {
      console.error('Error submitting comment:', error);
      alert('Error al publicar el comentario');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (comment: Comment) => {
    setEditingId(comment.id);
    setEditContent(comment.content);
  };

  const handleSaveEdit = async (commentId: string) => {
    if (!editContent.trim()) return;
    if (editContent.length > 1000) {
      alert('El comentario no puede exceder 1000 caracteres');
      return;
    }

    try {
      const { error } = await supabase
        .from('social_comments')
        .update({ content: editContent.trim() })
        .eq('id', commentId);

      if (error) throw error;
      setEditingId(null);
      setEditContent('');
    } catch (error: any) {
      console.error('Error updating comment:', error);
      alert('Error al actualizar el comentario');
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este comentario?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('social_comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;
    } catch (error: any) {
      console.error('Error deleting comment:', error);
      alert('Error al eliminar el comentario');
    }
  };

  const formatTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'hace un momento';
    if (diffInSeconds < 3600) return `hace ${Math.floor(diffInSeconds / 60)} minutos`;
    if (diffInSeconds < 86400) return `hace ${Math.floor(diffInSeconds / 3600)} horas`;
    if (diffInSeconds < 604800) return `hace ${Math.floor(diffInSeconds / 86400)} días`;
    
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="p-4 text-center text-gray-500">
        Cargando comentarios...
      </div>
    );
  }

  return (
    <div>
      {/* Lista de comentarios */}
      <div className="space-y-3 mb-3 max-h-48 overflow-y-auto">
        {comments.length === 0 ? (
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-2">
            No hay comentarios aún
          </p>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="flex gap-2">
              {/* Avatar */}
              <div className="flex-shrink-0">
                {comment.user_profile?.avatar_url ? (
                  <img
                    src={comment.user_profile.avatar_url}
                    alt={comment.user_profile.full_name}
                    className="w-6 h-6 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-slate-700 flex items-center justify-center">
                    <User className="w-3 h-3 text-gray-500 dark:text-gray-400" />
                  </div>
                )}
              </div>

              {/* Contenido */}
              <div className="flex-1 min-w-0">
                <div className="bg-gray-50 dark:bg-slate-700 rounded-lg p-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      {comment.user_profile?.full_name || 'Usuario'}
                    </span>
                    {profile && (profile.id === comment.user_id || profile.role === 'admin') && (
                      <div className="flex items-center gap-1">
                        {profile.id === comment.user_id && (
                          <button
                            onClick={() => handleEdit(comment)}
                            className="p-0.5 text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                            title="Editar"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(comment.id)}
                          className="p-0.5 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                  {editingId === comment.id ? (
                    <div className="space-y-1.5">
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full p-1.5 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        rows={2}
                        maxLength={1000}
                      />
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleSaveEdit(comment.id)}
                          className="text-xs px-2 py-0.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                        >
                          Guardar
                        </button>
                        <button
                          onClick={() => {
                            setEditingId(null);
                            setEditContent('');
                          }}
                          className="text-xs px-2 py-0.5 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap line-clamp-3">
                      {comment.content}
                    </p>
                  )}
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 block">
                  {formatTimeAgo(comment.created_at)}
                </span>
              </div>
            </div>
          ))
        )}
        <div ref={commentsEndRef} />
      </div>

      {/* Input para nuevo comentario */}
      {profile && (
        <form onSubmit={handleSubmit} className="flex gap-2">
          <div className="flex-shrink-0">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.full_name}
                className="w-6 h-6 rounded-full object-cover"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-slate-700 flex items-center justify-center">
                <User className="w-3 h-3 text-gray-500 dark:text-gray-400" />
              </div>
            )}
          </div>
          <div className="flex-1 flex gap-1.5">
            <input
              ref={inputRef}
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Escribe un comentario..."
              className="flex-1 px-2 py-1.5 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              maxLength={1000}
            />
            <EmojiPicker
              onEmojiSelect={(emoji) => {
                const input = inputRef.current;
                if (input) {
                  const cursorPos = input.selectionStart || 0;
                  const textBefore = newComment.substring(0, cursorPos);
                  const textAfter = newComment.substring(cursorPos);
                  setNewComment(textBefore + emoji + textAfter);
                  setTimeout(() => {
                    input.focus();
                    input.setSelectionRange(cursorPos + emoji.length, cursorPos + emoji.length);
                  }, 0);
                }
              }}
            />
            <button
              type="submit"
              disabled={!newComment.trim() || submitting}
              className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

