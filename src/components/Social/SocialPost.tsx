import { useState, useEffect } from 'react';
import { Heart, MessageCircle, User, MoreVertical, Edit2, Trash2, X, Maximize2, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { PostComments } from './PostComments';

interface PostMedia {
  id: string;
  post_id: string;
  media_type: 'image' | 'video' | 'gif';
  media_url: string;
  display_order: number;
}

interface Post {
  id: string;
  user_id: string;
  content: string | null;
  media_type?: 'image' | 'video' | 'gif' | null; // Opcional para compatibilidad
  media_url?: string | null; // Opcional para compatibilidad
  created_at: string;
  updated_at: string;
  user_profile?: {
    full_name: string;
    avatar_url?: string | null;
  };
  likes_count?: number;
  comments_count?: number;
  user_liked?: boolean;
  media?: PostMedia[]; // Múltiples archivos de media
}

interface SocialPostProps {
  post: Post;
  onDelete?: () => void;
}

export function SocialPost({ post, onDelete }: SocialPostProps) {
  const { profile } = useAuth();
  const [likesCount, setLikesCount] = useState(post.likes_count || 0);
  const [userLiked, setUserLiked] = useState(post.user_liked || false);
  const [showComments, setShowComments] = useState(false);
  const [commentsCount, setCommentsCount] = useState(post.comments_count || 0);
  const [showMenu, setShowMenu] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [postMedia, setPostMedia] = useState<PostMedia[]>([]);
  const [likedUsers, setLikedUsers] = useState<Array<{ id: string; full_name: string; avatar_url?: string | null }>>([]);
  const [showLikedUsers, setShowLikedUsers] = useState(false);

  useEffect(() => {
    // Cargar media del post
    fetchPostMedia();
    
    // Verificar si el usuario dio like
    if (profile) {
      checkUserLike();
    }

    // Suscripción a cambios de likes en tiempo real
    const likesChannel = supabase
      .channel(`post_likes_${post.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'social_likes',
          filter: `post_id=eq.${post.id}`,
        },
        async () => {
          await fetchLikesCount();
          if (profile) {
            await checkUserLike();
          }
        }
      )
      .subscribe();

    // Suscripción a cambios de comentarios en tiempo real
    const commentsChannel = supabase
      .channel(`post_comments_count_${post.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'social_comments',
          filter: `post_id=eq.${post.id}`,
        },
        async () => {
          await fetchCommentsCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(likesChannel);
      supabase.removeChannel(commentsChannel);
    };
  }, [post.id, profile]);

  const fetchPostMedia = async () => {
    try {
      const { data, error } = await supabase
        .from('social_post_media')
        .select('*')
        .eq('post_id', post.id)
        .order('display_order', { ascending: true });

      if (error) throw error;
      
      // Si hay media en la nueva tabla, usarla
      if (data && data.length > 0) {
        setPostMedia(data as PostMedia[]);
      } else if (post.media_url && post.media_type) {
        // Compatibilidad con posts antiguos
        setPostMedia([{
          id: post.id,
          post_id: post.id,
          media_type: post.media_type,
          media_url: post.media_url,
          display_order: 0,
        }]);
      }
    } catch (error) {
      console.error('Error fetching post media:', error);
      // Fallback a media antiguo
      if (post.media_url && post.media_type) {
        setPostMedia([{
          id: post.id,
          post_id: post.id,
          media_type: post.media_type,
          media_url: post.media_url,
          display_order: 0,
        }]);
      }
    }
  };

  const checkUserLike = async () => {
    if (!profile) return;
    try {
      const { data, error } = await supabase
        .from('social_likes')
        .select('id')
        .eq('post_id', post.id)
        .eq('user_id', profile.id)
        .maybeSingle(); // Usar maybeSingle() en lugar de single() para manejar 0 o 1 resultado

      if (error) {
        console.error('Error checking like:', error);
        return;
      }

      setUserLiked(!!data);
    } catch (error) {
      console.error('Error checking user like:', error);
    }
  };

  const fetchLikesCount = async () => {
    try {
      const { count, error } = await supabase
        .from('social_likes')
        .select('*', { count: 'exact', head: true })
        .eq('post_id', post.id);

      if (error) throw error;
      setLikesCount(count || 0);
      
      // Si hay likes, obtener los usuarios que dieron like
      if (count && count > 0) {
        await fetchLikedUsers();
      } else {
        setLikedUsers([]);
      }
    } catch (error) {
      console.error('Error fetching likes count:', error);
    }
  };

  const fetchLikedUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('social_likes')
        .select(`
          user_id,
          profiles:user_id (
            id,
            full_name,
            avatar_url
          )
        `)
        .eq('post_id', post.id)
        .order('created_at', { ascending: false })
        .limit(10); // Limitar a 10 usuarios para no sobrecargar

      if (error) throw error;
      
      const users = (data || [])
        .map((like: any) => like.profiles)
        .filter(Boolean);
      
      setLikedUsers(users);
    } catch (error) {
      console.error('Error fetching liked users:', error);
    }
  };

  const fetchCommentsCount = async () => {
    try {
      const { count, error } = await supabase
        .from('social_comments')
        .select('*', { count: 'exact', head: true })
        .eq('post_id', post.id);

      if (error) throw error;
      setCommentsCount(count || 0);
    } catch (error) {
      console.error('Error fetching comments count:', error);
    }
  };

  const handleLike = async () => {
    if (!profile) return;

    // Optimistic update
    const wasLiked = userLiked;
    setUserLiked(!wasLiked);
    setLikesCount((prev) => (wasLiked ? prev - 1 : prev + 1));

    try {
      if (wasLiked) {
        // Quitar like
        const { error } = await supabase
          .from('social_likes')
          .delete()
          .eq('post_id', post.id)
          .eq('user_id', profile.id);

        if (error) throw error;
      } else {
        // Agregar like
        const { error } = await supabase
          .from('social_likes')
          .insert({
            post_id: post.id,
            user_id: profile.id,
          });

        if (error) throw error;
      }
      
      // Recargar usuarios que dieron like
      await fetchLikedUsers();
    } catch (error: any) {
      // Revertir en caso de error
      setUserLiked(wasLiked);
      setLikesCount((prev) => (wasLiked ? prev + 1 : prev - 1));
      console.error('Error toggling like:', error);
      alert('Error al actualizar el like');
    }
  };

  const handleDelete = async () => {
    if (!confirm('¿Estás seguro de que deseas eliminar este post?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('social_posts')
        .delete()
        .eq('id', post.id);

      if (error) throw error;
      if (onDelete) onDelete();
    } catch (error: any) {
      console.error('Error deleting post:', error);
      alert('Error al eliminar el post');
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

  const canEditOrDelete = profile && (profile.id === post.user_id || profile.role === 'admin');

  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden hover:shadow-lg transition-all duration-300 flex flex-col">
      {/* Header */}
      <div className="p-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {post.user_profile?.avatar_url ? (
            <img
              src={post.user_profile.avatar_url}
              alt={post.user_profile.full_name}
              className="w-8 h-8 rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
              <User className="w-4 h-4 text-gray-500" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-gray-900 text-sm truncate">
              {post.user_profile?.full_name || 'Usuario'}
            </p>
            <p className="text-xs text-gray-500">{formatTimeAgo(post.created_at)}</p>
          </div>
        </div>
        {canEditOrDelete && (
          <div className="relative flex-shrink-0">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      handleDelete();
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Eliminar
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Media - Se adapta al tamaño natural */}
      {postMedia.length > 0 && (
        <div className="w-full flex-shrink-0">
          {postMedia.length === 1 ? (
            // Una sola imagen/video
            <div className="relative group">
              {postMedia[0].media_type === 'image' || postMedia[0].media_type === 'gif' ? (
                <div className="relative">
                  <img
                    src={postMedia[0].media_url}
                    alt={post.content || 'Post image'}
                    className="w-full h-auto object-cover cursor-pointer"
                    loading="lazy"
                    onClick={() => {
                      setSelectedImageIndex(0);
                      setShowImageModal(true);
                    }}
                  />
                  <div 
                    className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-opacity duration-200 flex items-center justify-center cursor-pointer"
                    onClick={() => {
                      setSelectedImageIndex(0);
                      setShowImageModal(true);
                    }}
                  >
                    <Maximize2 className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                  </div>
                </div>
              ) : (
                <video
                  src={postMedia[0].media_url}
                  controls
                  className="w-full h-auto"
                />
              )}
            </div>
          ) : (
            // Múltiples imágenes - Grid
            <div className={`grid gap-1 ${
              postMedia.length === 2 ? 'grid-cols-2' :
              postMedia.length === 3 ? 'grid-cols-2' :
              postMedia.length === 4 ? 'grid-cols-2' :
              'grid-cols-2'
            }`}>
              {postMedia.slice(0, 4).map((media, index) => (
                <div
                  key={media.id}
                  className={`relative group cursor-pointer ${
                    postMedia.length === 3 && index === 0 ? 'row-span-2' : ''
                  }`}
                  onClick={() => {
                    setSelectedImageIndex(index);
                    setShowImageModal(true);
                  }}
                >
                  {media.media_type === 'image' || media.media_type === 'gif' ? (
                    <>
                      <img
                        src={media.media_url}
                        alt={`${post.content || 'Post image'} ${index + 1}`}
                        className="w-full h-full object-cover aspect-square"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-opacity duration-200" />
                      {postMedia.length > 4 && index === 3 && (
                        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                          <span className="text-white text-2xl font-bold">
                            +{postMedia.length - 4}
                          </span>
                        </div>
                      )}
                    </>
                  ) : (
                    <video
                      src={media.media_url}
                      controls
                      className="w-full h-full object-cover aspect-square"
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Content */}
      {post.content && (
        <div className="px-3 pt-2 pb-2 flex-shrink-0">
          <p className="text-gray-900 text-sm line-clamp-3 whitespace-pre-wrap">{post.content}</p>
        </div>
      )}

      {/* Actions */}
      <div className="px-3 py-2 border-t border-gray-100 mt-auto flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleLike();
              }}
              onMouseEnter={() => {
                if (likesCount > 0 && likedUsers.length === 0) {
                  fetchLikedUsers();
                }
                if (likesCount > 0) {
                  setShowLikedUsers(true);
                }
              }}
              onMouseLeave={() => setShowLikedUsers(false)}
              className="flex items-center gap-1.5 transition-all duration-200 hover:scale-110"
              disabled={!profile}
            >
              <Heart
                className={`w-5 h-5 transition-all duration-200 ${
                  userLiked
                    ? 'fill-red-500 text-red-500 scale-110'
                    : 'text-gray-400 hover:text-red-500'
                }`}
              />
              <span className={`text-sm font-medium ${
                userLiked ? 'text-red-500' : 'text-gray-600'
              }`}>
                {likesCount}
              </span>
            </button>
            
            {/* Tooltip con usuarios que dieron like */}
            {showLikedUsers && likedUsers.length > 0 && (
              <div className="absolute bottom-full left-0 mb-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 p-3 z-50">
                <p className="text-xs font-semibold text-gray-700 mb-2">
                  {likesCount === 1 ? 'A 1 persona le gusta' : `A ${likesCount} personas les gusta`}
                </p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {likedUsers.map((user) => (
                    <div key={user.id} className="flex items-center gap-2">
                      {user.avatar_url ? (
                        <img
                          src={user.avatar_url}
                          alt={user.full_name}
                          className="w-6 h-6 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center">
                          <User className="w-3 h-3 text-gray-500" />
                        </div>
                      )}
                      <span className="text-sm text-gray-900">{user.full_name}</span>
                    </div>
                  ))}
                  {likesCount > likedUsers.length && (
                    <p className="text-xs text-gray-500 pt-1">
                      y {likesCount - likedUsers.length} más...
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowComments(!showComments);
            }}
            className="flex items-center gap-1.5 text-gray-600 hover:text-blue-600 transition-colors"
          >
            <MessageCircle className="w-5 h-5" />
            <span className="text-sm font-medium">{commentsCount}</span>
          </button>
        </div>

        {/* Comentarios - Expandible */}
        {showComments && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <PostComments postId={post.id} />
          </div>
        )}
      </div>

      {/* Modal para imagen expandida */}
      {showImageModal && postMedia.length > 0 && postMedia[selectedImageIndex] && (postMedia[selectedImageIndex].media_type === 'image' || postMedia[selectedImageIndex].media_type === 'gif') && (
        <div 
          className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center p-4"
          onClick={() => setShowImageModal(false)}
        >
          <div className="relative max-w-7xl max-h-[90vh] w-full h-full flex items-center justify-center">
            <button
              onClick={() => setShowImageModal(false)}
              className="absolute top-4 right-4 p-2 bg-black bg-opacity-50 hover:bg-opacity-70 rounded-full text-white transition-colors z-10"
            >
              <X className="w-6 h-6" />
            </button>
            
            {/* Navegación entre imágenes */}
            {postMedia.length > 1 && (
              <>
                {selectedImageIndex > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedImageIndex(selectedImageIndex - 1);
                    }}
                    className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-black bg-opacity-50 hover:bg-opacity-70 rounded-full text-white transition-colors z-10"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                )}
                {selectedImageIndex < postMedia.length - 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedImageIndex(selectedImageIndex + 1);
                    }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-black bg-opacity-50 hover:bg-opacity-70 rounded-full text-white transition-colors z-10"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                )}
                <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black bg-opacity-50 rounded-full px-3 py-1 text-white text-sm z-10">
                  {selectedImageIndex + 1} / {postMedia.length}
                </div>
              </>
            )}
            
            <img
              src={postMedia[selectedImageIndex].media_url}
              alt={post.content || 'Post image'}
              className="max-w-full max-h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            
            {/* Información del post en el modal */}
            <div 
              className="absolute bottom-4 left-4 right-4 bg-black bg-opacity-50 rounded-lg p-4 text-white"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-2">
                {post.user_profile?.avatar_url ? (
                  <img
                    src={post.user_profile.avatar_url}
                    alt={post.user_profile.full_name}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                    <User className="w-4 h-4 text-gray-500" />
                  </div>
                )}
                <div>
                  <p className="font-semibold text-sm">
                    {post.user_profile?.full_name || 'Usuario'}
                  </p>
                  <p className="text-xs text-gray-300">{formatTimeAgo(post.created_at)}</p>
                </div>
              </div>
              {post.content && (
                <p className="text-sm mt-2">{post.content}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

