import { useState, useEffect, useRef } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { SocialPost } from './SocialPost';
import { CreatePostModal } from './CreatePostModal';
import { BirthdayCard } from './BirthdayCard';

interface Post {
  id: string;
  user_id: string;
  content: string | null;
  media_type: 'image' | 'video' | 'gif';
  media_url: string;
  created_at: string;
  updated_at: string;
  user_profile?: {
    full_name: string;
    avatar_url?: string | null;
  };
  likes_count?: number;
  comments_count?: number;
  user_liked?: boolean;
}

interface BirthdayUser {
  id: string;
  full_name: string;
  avatar_url?: string | null;
  birthday: string;
}

export function SocialFeed() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [birthdayUsers, setBirthdayUsers] = useState<BirthdayUser[]>([]);
  const loadingRef = useRef(false);
  const postsPerPage = 10;

  useEffect(() => {
    fetchPosts();
    fetchBirthdayUsers();

    // Suscripción a nuevos posts en tiempo real
    const channel = supabase
      .channel('social_posts_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'social_posts',
        },
        async (payload) => {
          // Obtener el nuevo post con toda su información
          const newPost = await fetchPostWithDetails(payload.new.id);
          if (newPost) {
            setPosts((prev) => [newPost, ...prev]);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'social_posts',
        },
        (payload) => {
          setPosts((prev) => prev.filter((p) => p.id !== payload.old.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchBirthdayUsers = async () => {
    try {
      const today = new Date();
      const month = today.getMonth() + 1; // JavaScript months are 0-indexed
      const day = today.getDate();

      // Obtener todos los usuarios con cumpleaños
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, birthday')
        .not('birthday', 'is', null);

      if (error) throw error;

      // Filtrar usuarios que cumplen años hoy
      const todayBirthdays = (data || []).filter((user) => {
        if (!user.birthday) return false;
        const birthday = new Date(user.birthday);
        return birthday.getMonth() + 1 === month && birthday.getDate() === day;
      });

      setBirthdayUsers(todayBirthdays as BirthdayUser[]);
    } catch (error) {
      console.error('Error fetching birthday users:', error);
    }
  };

  const fetchPostWithDetails = async (postId: string): Promise<Post | null> => {
    try {
      const { data, error } = await supabase
        .from('social_posts')
        .select(`
          *,
          user_profile:profiles!social_posts_user_id_fkey (
            full_name,
            avatar_url
          )
        `)
        .eq('id', postId)
        .maybeSingle();

      if (error) throw error;

      // Obtener conteo de likes y comentarios
      const [likesResult, commentsResult, userLikeResult] = await Promise.all([
        supabase
          .from('social_likes')
          .select('*', { count: 'exact', head: true })
          .eq('post_id', postId),
        supabase
          .from('social_comments')
          .select('*', { count: 'exact', head: true })
          .eq('post_id', postId),
        supabase.auth.getUser().then(async (userResult) => {
          if (userResult.data.user) {
            const { data: likeData } = await supabase
              .from('social_likes')
              .select('id')
              .eq('post_id', postId)
              .eq('user_id', userResult.data.user.id)
              .maybeSingle();
            return !!likeData;
          }
          return false;
        }),
      ]);

      return {
        ...data,
        likes_count: likesResult.count || 0,
        comments_count: commentsResult.count || 0,
        user_liked: userLikeResult,
      } as Post;
    } catch (error) {
      console.error('Error fetching post details:', error);
      return null;
    }
  };

  const fetchPosts = async (pageNum: number = 0) => {
    if (loadingRef.current) return;
    
    try {
      loadingRef.current = true;
      setLoading(pageNum === 0);

      const { data, error } = await supabase
        .from('social_posts')
        .select(`
          *,
          user_profile:profiles!social_posts_user_id_fkey (
            full_name,
            avatar_url
          )
        `)
        .order('created_at', { ascending: false })
        .range(pageNum * postsPerPage, (pageNum + 1) * postsPerPage - 1);

      if (error) throw error;

      if (!data || data.length === 0) {
        setHasMore(false);
        setLoading(false);
        return;
      }

      // Obtener conteos de likes y comentarios para cada post
      const postsWithCounts = await Promise.all(
        data.map(async (post) => {
          const [likesResult, commentsResult, userLikeResult] = await Promise.all([
            supabase
              .from('social_likes')
              .select('*', { count: 'exact', head: true })
              .eq('post_id', post.id),
            supabase
              .from('social_comments')
              .select('*', { count: 'exact', head: true })
              .eq('post_id', post.id),
            supabase.auth.getUser().then(async (userResult) => {
              if (userResult.data.user) {
                const { data: likeData } = await supabase
                  .from('social_likes')
                  .select('id')
                  .eq('post_id', post.id)
                  .eq('user_id', userResult.data.user.id)
                  .maybeSingle();
                return !!likeData;
              }
              return false;
            }),
          ]);

          return {
            ...post,
            likes_count: likesResult.count || 0,
            comments_count: commentsResult.count || 0,
            user_liked: userLikeResult,
          } as Post;
        })
      );

      if (pageNum === 0) {
        setPosts(postsWithCounts);
      } else {
        setPosts((prev) => [...prev, ...postsWithCounts]);
      }

      setHasMore(postsWithCounts.length === postsPerPage);
      setPage(pageNum);
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  };

  const handleLoadMore = () => {
    if (!loadingRef.current && hasMore) {
      fetchPosts(page + 1);
    }
  };

  const handleDeletePost = (postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  if (loading && posts.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Social</h1>
          <p className="text-gray-600">
            Comparte momentos, ideas y contenido con tu equipo
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Plus className="w-5 h-5" />
          Nueva Publicación
        </button>
      </div>

      {/* Posts Feed */}
      {posts.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <p className="text-lg font-semibold text-gray-900 mb-2">
            No hay publicaciones aún
          </p>
          <p className="text-gray-600 mb-4">
            Sé el primero en compartir algo con tu equipo
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Crear Primera Publicación
          </button>
        </div>
      ) : (
        <>
          {/* Tarjetas de cumpleaños */}
          {birthdayUsers.length > 0 && (
            <div className="mb-6">
              <BirthdayCard users={birthdayUsers} />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 auto-rows-min">
            {posts.map((post) => (
              <SocialPost
                key={post.id}
                post={post}
                onDelete={() => handleDeletePost(post.id)}
              />
            ))}
          </div>
          
          {/* Load More Button */}
          {hasMore && (
            <div className="text-center py-6 mt-6">
              <button
                onClick={handleLoadMore}
                disabled={loadingRef.current}
                className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 mx-auto"
              >
                {loadingRef.current ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Cargando...
                  </>
                ) : (
                  'Cargar más'
                )}
              </button>
            </div>
          )}
        </>
      )}

      {/* Floating Action Button (Mobile) */}
      <button
        onClick={() => setShowCreateModal(true)}
        className="fixed bottom-6 right-6 md:hidden w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors flex items-center justify-center z-10"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Create Post Modal */}
      {showCreateModal && (
        <CreatePostModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            fetchPosts(0); // Recargar desde el inicio
          }}
        />
      )}
    </div>
  );
}

