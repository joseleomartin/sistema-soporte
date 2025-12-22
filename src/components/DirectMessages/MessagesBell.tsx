import { useEffect, useState, useRef, memo, useLayoutEffect, useCallback } from 'react';
import { MessageSquare, X, Send, Paperclip, Download, Image, FileText, File } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { EmojiPicker } from '../EmojiPicker';

interface Attachment {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  file_type: string;
}

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  is_read: boolean;
  created_at: string;
  sender_profile?: {
    full_name: string;
    email: string;
    avatar_url?: string;
  };
  receiver_profile?: {
    full_name: string;
    email: string;
    avatar_url?: string;
  };
  direct_message_attachments?: Attachment[];
}

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  role: string;
  avatar_url?: string;
}

interface Conversation {
  other_user_id: string;
  other_user_name: string;
  other_user_email: string;
  other_user_role: string;
  last_message: string;
  last_message_at: string;
  unread_count: number;
  avatar_url?: string;
}

// Componente de preview de imagen optimizado con memo
const ImagePreview = memo(({ 
  attachment, 
  isMine, 
  onDownload,
  urlCache 
}: { 
  attachment: Attachment; 
  isMine: boolean;
  onDownload: () => void;
  urlCache: React.MutableRefObject<Map<string, { url: string; expiresAt: number }>>;
}) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const loadImage = async () => {
      try {
        // Verificar sesión primero
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) {
          console.error('❌ No hay sesión activa:', sessionError);
          setError(true);
          setLoading(false);
          return;
        }

        console.log('🔍 Intentando cargar imagen:', {
          file_path: attachment.file_path,
          user_id: session.user.id,
          path_parts: attachment.file_path.split('/')
        });

        // Verificar cache
        const cached = urlCache.current.get(attachment.file_path);
        const now = Date.now();

        if (cached && cached.expiresAt > now) {
          setImageUrl(cached.url);
          setLoading(false);
          return;
        }

        // Verificar permisos del usuario con el path
        const pathParts = attachment.file_path.split('/');
        const isSender = pathParts[0] === session.user.id;
        const isReceiver = pathParts[1] === session.user.id;
        
        console.log('🔐 Verificación de permisos:', {
          isSender,
          isReceiver,
          sender_id: pathParts[0],
          receiver_id: pathParts[1],
          current_user: session.user.id
        });

        if (!isSender && !isReceiver) {
          console.error('❌ Usuario no tiene permisos para este archivo');
          setError(true);
          setLoading(false);
          return;
        }

        const { data, error: signedUrlError } = await supabase.storage
          .from('direct-message-attachments')
          .createSignedUrl(attachment.file_path, 3600);

        if (signedUrlError || !data?.signedUrl) {
          // Si falla con 400, intentar con download como fallback
          console.warn('⚠️ Error creando signed URL, intentando download directo:', {
            error: signedUrlError,
            message: signedUrlError?.message,
            statusCode: (signedUrlError as any)?.statusCode,
            file_path: attachment.file_path
          });
          
          try {
            const { data: downloadData, error: downloadError } = await supabase.storage
              .from('direct-message-attachments')
              .download(attachment.file_path);

            if (downloadError) {
              console.error('❌ Error en download también:', {
                error: downloadError,
                message: downloadError.message,
                statusCode: (downloadError as any)?.statusCode,
                file_path: attachment.file_path,
                user_id: session.user.id,
                path_parts: attachment.file_path.split('/')
              });
              
              // Mostrar mensaje más descriptivo al usuario
              console.error('💡 Posibles causas:');
              console.error('   1. Las políticas RLS no están configuradas correctamente');
              console.error('   2. El usuario no tiene permisos para este archivo');
              console.error('   3. El archivo no existe en storage');
              console.error('   4. El path del archivo no coincide con el usuario actual');
              
              setError(true);
              setLoading(false);
              return;
            }

            // Crear URL local desde el blob
            const blobUrl = URL.createObjectURL(downloadData);
            
            // Cachear la URL del blob (válida mientras la página esté abierta)
            urlCache.current.set(attachment.file_path, {
              url: blobUrl,
              expiresAt: now + 50 * 60 * 1000
            });

            setImageUrl(blobUrl);
            setLoading(false);
            return;
          } catch (fallbackError) {
            console.error('Error en fallback:', fallbackError);
            setError(true);
            setLoading(false);
            return;
          }
        }

        // Cachear
        urlCache.current.set(attachment.file_path, {
          url: data.signedUrl,
          expiresAt: now + 50 * 60 * 1000
        });

        setImageUrl(data.signedUrl);
        setLoading(false);
      } catch (err) {
        setError(true);
        setLoading(false);
      }
    };

    loadImage();
  }, [attachment.file_path, urlCache]);

  if (loading) {
    return (
      <div className={`p-3 rounded ${isMine ? 'bg-blue-500 dark:bg-blue-600' : 'bg-gray-100 dark:bg-slate-700'}`}>
        <div className="flex items-center gap-2">
          <div className={`w-4 h-4 border-2 ${isMine ? 'border-white' : 'border-gray-600 dark:border-gray-300'} border-t-transparent rounded-full animate-spin`} />
          <span className={`text-xs ${isMine ? 'text-white' : 'text-gray-600 dark:text-gray-300'}`}>Cargando imagen...</span>
        </div>
      </div>
    );
  }

  if (error || !imageUrl) {
    return (
      <div className={`p-3 rounded ${isMine ? 'bg-blue-500 dark:bg-blue-600' : 'bg-gray-100 dark:bg-slate-700'}`}>
        <p className={`text-xs ${isMine ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
          No se pudo cargar la imagen
        </p>
      </div>
    );
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="relative group">
      <img
        src={imageUrl}
        alt={attachment.file_name}
        className="max-w-[280px] max-h-[300px] rounded-lg object-contain cursor-pointer shadow-md"
        onClick={() => window.open(imageUrl, '_blank')}
      />
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDownload();
        }}
        className={`absolute top-2 right-2 p-2 rounded-full shadow-lg ${
          isMine ? 'bg-blue-600 dark:bg-blue-700' : 'bg-gray-800 dark:bg-slate-700'
        } text-white opacity-0 group-hover:opacity-100 transition-opacity`}
      >
        <Download className="w-4 h-4" />
      </button>
      <p className={`text-xs mt-1 ${isMine ? 'text-blue-100 dark:text-blue-200' : 'text-gray-500 dark:text-gray-400'}`}>
        {attachment.file_name} ({formatFileSize(attachment.file_size)})
      </p>
    </div>
  );
});

ImagePreview.displayName = 'ImagePreview';

export function MessagesBell() {
  const { profile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [showUserSelector, setShowUserSelector] = useState(false); // Nueva vista de selección
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [otherUser, setOtherUser] = useState<UserProfile | null>(null);
  const [availableUsers, setAvailableUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [unreadByUser, setUnreadByUser] = useState<Map<string, number>>(new Map());
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [searching, setSearching] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const signedUrlCacheRef = useRef<Map<string, { url: string; expiresAt: number }>>(new Map());
  const isInitialLoadRef = useRef<boolean>(true);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastMessageCountRef = useRef<number>(0);
  const isScrollingRef = useRef<boolean>(false);
  const addingTempMessageRef = useRef<boolean>(false);
  
  const isNormalUser = profile?.role === 'user';
  const isAdmin = profile?.role === 'admin' || profile?.role === 'support';

  // Cargar usuarios disponibles y conversaciones
  useEffect(() => {
    if (!profile?.id) return;

    const loadData = async () => {
      if (isNormalUser) {
        // Usuario normal: cargar lista de admin/support disponibles
        const { data } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, avatar_url')
        .in('role', ['admin', 'support'])
        .order('full_name');

        if (data) {
          setAvailableUsers(data || []);
        }
      } else if (isAdmin) {
        // Admin: cargar conversaciones activas
        const { data: convData } = await (supabase as any).rpc('get_conversations');
        if (convData) {
          // Enriquecer conversaciones con avatares de profiles
          const conversationsWithAvatars = await Promise.all(
            (convData || []).map(async (conv: Conversation) => {
              // Si ya tiene avatar_url, usarlo
              if (conv.avatar_url) return conv;
              
              // Si no, obtenerlo de profiles
              const { data: profileData } = await supabase
                .from('profiles')
                .select('avatar_url')
                .eq('id', conv.other_user_id)
                .single();
              
              return {
                ...conv,
                avatar_url: (profileData as any)?.avatar_url || null
              };
            })
          );
          
          setConversations(conversationsWithAvatars);
        }
      }
    };

    loadData();

    // Recargar inmediatamente cuando se abre el selector
    if (showUserSelector) {
      loadData();
    }

    // Actualizar cada 5 segundos cuando está en selector
    if (showUserSelector) {
      const interval = setInterval(loadData, 5000);
      return () => clearInterval(interval);
    }
  }, [profile?.id, isNormalUser, isAdmin, showUserSelector]);

  // Resetear flags de scroll cuando cambia la conversación
  useEffect(() => {
    if (otherUser?.id && isOpen) {
      isInitialLoadRef.current = true;
      lastMessageCountRef.current = 0;
      isScrollingRef.current = false;
    }
  }, [otherUser?.id, isOpen]);

  // Cargar mensajes cuando se selecciona un usuario
  useEffect(() => {
    if (!profile?.id || !otherUser?.id || !isOpen) return;

    loadMessages();
    subscribeToMessages();
    markMessagesAsRead();

    return () => {
      cleanupSubscription();
    };
  }, [profile?.id, otherUser?.id, isOpen]);

  // Escuchar evento para abrir chat desde notificación
  useEffect(() => {
    const handleOpenDirectMessage = async (event: CustomEvent) => {
      const { senderId } = event.detail;
      if (!senderId || !profile?.id) return;

      // Obtener información del usuario remitente
      const { data: senderProfile } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, avatar_url')
        .eq('id', senderId)
        .single();

      if (senderProfile) {
        setOtherUser({
          id: senderProfile.id,
          full_name: senderProfile.full_name,
          email: senderProfile.email,
          role: senderProfile.role,
          avatar_url: senderProfile.avatar_url
        });
        setShowUserSelector(false);
        setIsOpen(true);
      }
    };

    window.addEventListener('openDirectMessage', handleOpenDirectMessage as EventListener);

    return () => {
      window.removeEventListener('openDirectMessage', handleOpenDirectMessage as EventListener);
    };
  }, [profile?.id]);

  // Función para cargar contador de no leídos
  const loadUnreadCount = useCallback(async () => {
    if (!profile?.id) return;

    if (isNormalUser) {
      // Usuario normal: contar mensajes no leídos de todos los admins/soporte
      const { count } = await supabase
        .from('direct_messages')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', profile.id)
        .eq('is_read', false);

      setUnreadCount(count || 0);

      // Cargar contadores individuales por usuario
      if (showUserSelector && availableUsers.length > 0) {
        const unreadMap = new Map<string, number>();
        
        for (const user of availableUsers) {
          const { count: userCount } = await supabase
            .from('direct_messages')
            .select('*', { count: 'exact', head: true })
            .eq('receiver_id', profile.id)
            .eq('sender_id', user.id)
            .eq('is_read', false);
          
          if (userCount && userCount > 0) {
            unreadMap.set(user.id, userCount);
          }
        }
        
        setUnreadByUser(unreadMap);
      }
    } else if (otherUser?.id) {
      // Admin: contar solo del usuario seleccionado
      const { count } = await supabase
        .from('direct_messages')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', profile.id)
        .eq('sender_id', otherUser.id)
        .eq('is_read', false);

      setUnreadCount(count || 0);
    } else {
      // Admin sin usuario seleccionado: contar todos los mensajes no leídos
      const { count } = await supabase
        .from('direct_messages')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', profile.id)
        .eq('is_read', false);

      setUnreadCount(count || 0);
    }
  }, [profile?.id, isNormalUser, otherUser?.id, showUserSelector, availableUsers]);

  // Cargar contador de no leídos
  useEffect(() => {
    if (!profile?.id) return;

    loadUnreadCount();

    // Actualizar cada 5 segundos cuando está cerrado o en selector
    if (!isOpen || showUserSelector) {
      const interval = setInterval(loadUnreadCount, 5000);
      return () => clearInterval(interval);
    }
  }, [profile?.id, otherUser?.id, isOpen, showUserSelector, isNormalUser, availableUsers]);

  // Suscripción en tiempo real para actualizar contador cuando llega un mensaje nuevo
  useEffect(() => {
    if (!profile?.id) return;

    // Suscribirse a nuevos mensajes donde el usuario es receptor
    const channel = supabase
      .channel(`unread_count_${profile.id}_${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
          filter: `receiver_id=eq.${profile.id}`
        },
        (payload: any) => {
          // Si el mensaje no está leído, actualizar contador
          if (!payload.new.is_read) {
            loadUnreadCount();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'direct_messages',
          filter: `receiver_id=eq.${profile.id}`
        },
        (payload: any) => {
          // Si el mensaje cambió a leído, actualizar contador
          if (payload.new.is_read !== payload.old.is_read) {
            loadUnreadCount();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id, loadUnreadCount]);

  // Scroll automático - useLayoutEffect para carga inicial (sin flash)
  useLayoutEffect(() => {
    if (messages.length > 0 && !loading && isInitialLoadRef.current) {
      // Scroll instantáneo en carga inicial (antes del paint)
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      }
      lastMessageCountRef.current = messages.length;
      isInitialLoadRef.current = false;
    }
  }, [messages.length, loading]);

  // useLayoutEffect para scroll cuando se agrega mensaje temporal (antes del paint)
  useLayoutEffect(() => {
    if (addingTempMessageRef.current && messagesContainerRef.current) {
      // Scroll instantáneo antes del paint para evitar refresh visual
      const container = messagesContainerRef.current;
      // Usar scrollTop directamente para evitar cualquier animación
      container.scrollTop = container.scrollHeight;
    }
  }, [messages.length]);

  // Scroll automático - useEffect para nuevos mensajes (con animación)
  useEffect(() => {
    // No hacer scroll si estamos agregando un mensaje temporal (useLayoutEffect lo maneja)
    if (addingTempMessageRef.current) {
      // Actualizar contador pero no hacer scroll
      if (messages.length > lastMessageCountRef.current) {
        lastMessageCountRef.current = messages.length;
      }
      return;
    }
    
    // Solo hacer scroll si hay nuevos mensajes y no está en proceso de scroll
    const hasNewMessages = messages.length > lastMessageCountRef.current;
    
    if (hasNewMessages && !loading && !sending && !isInitialLoadRef.current && !isScrollingRef.current) {
      // Verificar si ya estamos cerca del final (evitar scroll innecesario)
      if (messagesContainerRef.current) {
        const container = messagesContainerRef.current;
        const scrollBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
        
        // Solo hacer scroll si no estamos cerca del final (más de 100px de diferencia)
        if (scrollBottom > 100) {
          // El usuario está scrolleando hacia arriba, no hacer scroll automático
          lastMessageCountRef.current = messages.length;
          return;
        }
      }
      
      lastMessageCountRef.current = messages.length;
      
      // Usar requestAnimationFrame para scroll suave sin refresh
      requestAnimationFrame(() => {
        scrollToBottom(false);
      });
    } else if (messages.length > 0) {
      // Actualizar contador siempre para mantener sincronizado
      lastMessageCountRef.current = messages.length;
    }
  }, [messages.length, loading, sending]);

  const scrollToBottom = (instant = false) => {
    if (!messagesContainerRef.current || isScrollingRef.current) return;
    
    const container = messagesContainerRef.current;
    const targetScroll = container.scrollHeight;
    const currentScroll = container.scrollTop;
    const distance = targetScroll - currentScroll;
    
    if (instant || Math.abs(distance) < 5) {
      // Scroll instantáneo sin animación
      container.scrollTop = targetScroll;
      return;
    }
    
    // Scroll suave pero muy rápido para minimizar movimiento de barra
    isScrollingRef.current = true;
    const duration = 150; // ms - muy rápido
    let startTime: number | null = null;
    
    const animateScroll = (currentTime: number) => {
      if (startTime === null) startTime = currentTime;
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing más agresivo (ease-in-out-cubic) para movimiento más suave
      const easeInOutCubic = progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;
      
      container.scrollTop = currentScroll + (distance * easeInOutCubic);
      
      if (progress < 1) {
        requestAnimationFrame(animateScroll);
      } else {
        container.scrollTop = targetScroll; // Asegurar posición final exacta
        isScrollingRef.current = false;
      }
    };
    
    requestAnimationFrame(animateScroll);
  };

  const cleanupSubscription = () => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  };

  const loadMessages = async () => {
    if (!profile?.id || !otherUser?.id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('direct_messages')
        .select(`
          *,
          sender_profile:profiles!direct_messages_sender_id_fkey(full_name, email, avatar_url),
          receiver_profile:profiles!direct_messages_receiver_id_fkey(full_name, email, avatar_url),
          direct_message_attachments(*)
        `)
        .or(`and(sender_id.eq.${profile.id},receiver_id.eq.${otherUser.id}),and(sender_id.eq.${otherUser.id},receiver_id.eq.${profile.id})`)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      // Eliminar duplicados por ID antes de establecer
      const messagesData = (data as any) || [];
      const uniqueMessages = messagesData.reduce((acc: any[], msg: any) => {
        if (!acc.find(m => m.id === msg.id)) {
          // También eliminar attachments duplicados dentro de cada mensaje
          if (msg.direct_message_attachments && Array.isArray(msg.direct_message_attachments)) {
            msg.direct_message_attachments = msg.direct_message_attachments.filter(
              (attachment: any, index: number, self: any[]) =>
                index === self.findIndex((a: any) => a.id === attachment.id)
            );
          }
          acc.push(msg);
        }
        return acc;
      }, []);
      
      setMessages(uniqueMessages);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToMessages = () => {
    if (!profile?.id || !otherUser?.id) return;

    cleanupSubscription();

    const channel = supabase
      .channel(`chat_${profile.id}_${otherUser.id}_${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
          filter: `sender_id=eq.${otherUser.id}`
        },
        async (payload: any) => {
          if (payload.new.receiver_id === profile.id) {
            await handleNewMessage(payload.new.id);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
          filter: `sender_id=eq.${profile.id}`
        },
        async (payload: any) => {
          if (payload.new.receiver_id === otherUser.id) {
            await handleNewMessage(payload.new.id);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_message_attachments'
        },
        async (payload: any) => {
          if (payload.new.message_id) {
            await handleNewMessage(payload.new.message_id);
          }
        }
      )
      .subscribe();

    channelRef.current = channel;
  };

  const handleNewMessage = async (messageId: string) => {
    if (!profile?.id) return;

    // Verificar si el mensaje ya existe en el estado actual
    const messageExists = messages.some(m => m.id === messageId);
    
    if (messageExists) {
      // Actualizar el mensaje existente (por si tiene nuevos attachments)
      try {
        const { data } = await supabase
          .from('direct_messages')
          .select(`
            *,
            sender_profile:profiles!direct_messages_sender_id_fkey(full_name, email, avatar_url),
            receiver_profile:profiles!direct_messages_receiver_id_fkey(full_name, email, avatar_url),
            direct_message_attachments(*)
          `)
          .eq('id', messageId)
          .single();

        if (data) {
          const messageData = data as any;
          
          // Eliminar attachments duplicados dentro del mensaje
          if (messageData.direct_message_attachments && Array.isArray(messageData.direct_message_attachments)) {
            messageData.direct_message_attachments = messageData.direct_message_attachments.filter(
              (attachment: any, index: number, self: any[]) =>
                index === self.findIndex((a: any) => a.id === attachment.id)
            );
          }
          
          setMessages(prev => {
            // Asegurar que solo hay un mensaje con este ID
            const filtered = prev.filter(msg => msg.id !== messageId);
            return [...filtered, messageData];
          });
        }
      } catch (error) {
        console.error('Error updating message:', error);
      }
      return;
    }

    // Cargar nuevo mensaje
    try {
      const { data } = await supabase
        .from('direct_messages')
        .select(`
          *,
          sender_profile:profiles!direct_messages_sender_id_fkey(full_name, email, avatar_url),
          receiver_profile:profiles!direct_messages_receiver_id_fkey(full_name, email, avatar_url),
          direct_message_attachments(*)
        `)
        .eq('id', messageId)
        .single();

      if (data) {
        setMessages(prev => {
          const messageData = data as any;
          
          // Eliminar attachments duplicados dentro del mensaje
          if (messageData.direct_message_attachments && Array.isArray(messageData.direct_message_attachments)) {
            messageData.direct_message_attachments = messageData.direct_message_attachments.filter(
              (attachment: any, index: number, self: any[]) =>
                index === self.findIndex((a: any) => a.id === attachment.id)
            );
          }
          
          // Verificar si el mensaje ya existe
          const existingIndex = prev.findIndex(m => m.id === messageId);
          
          if (existingIndex !== -1) {
            // Si existe, actualizarlo
            return prev.map((msg, index) => 
              index === existingIndex ? messageData : msg
            );
          }
          
          // Si no existe, filtrar mensajes temporales similares y agregarlo
          // Buscar mensaje temporal que corresponde a este mensaje real
          const tempMessageIndex = prev.findIndex(m => 
            m.id.startsWith('temp-') && 
            m.sender_id === messageData.sender_id &&
            m.receiver_id === messageData.receiver_id &&
            Math.abs(
              new Date(m.created_at).getTime() - new Date(messageData.created_at).getTime()
            ) < 5000
          );
          
          if (tempMessageIndex !== -1) {
            // Reemplazar mensaje temporal con el real en la misma posición
            // Esto mantiene el mismo length, evitando scroll innecesario
            const newMessages = [...prev];
            newMessages[tempMessageIndex] = messageData;
            // Desmarcar flag cuando se reemplaza el mensaje temporal
            addingTempMessageRef.current = false;
            return newMessages;
          }
          
          // Si no hay mensaje temporal, agregar normalmente
          const filtered = prev.filter(m => {
            if (m.id === messageId) return false;
            if (!m.id.startsWith('temp-')) return true;
            const timeDiff = Math.abs(
              new Date(m.created_at).getTime() - new Date(messageData.created_at).getTime()
            );
            return timeDiff > 5000;
          });
          
          return [...filtered, messageData];
        });

        // Si es mensaje recibido, marcar como leído y actualizar contador
        if ((data as any).receiver_id === profile.id && isOpen) {
          markMessagesAsRead();
        } else if ((data as any).receiver_id === profile.id && !isOpen) {
          // Si el chat está cerrado, actualizar contador de no leídos
          loadUnreadCount();
        }
      }
    } catch (error) {
      console.error('Error handling new message:', error);
    }
  };

  const markMessagesAsRead = async () => {
    if (!profile?.id || !otherUser?.id || !isOpen) return;

    try {
      await (supabase as any).rpc('mark_messages_as_read', {
        conversation_user_id: otherUser.id
      });
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const sendMessage = async () => {
    if ((!newMessage.trim() && selectedFiles.length === 0) || !otherUser?.id || sending || uploading) return;

    const messageText = newMessage.trim();
    const tempId = `temp-${Date.now()}`;

    setNewMessage('');
    setSending(true);

    // Mensaje optimista
    const tempMessage: Message = {
      id: tempId,
      sender_id: profile!.id,
      receiver_id: otherUser.id,
      message: messageText || (selectedFiles.length > 0 ? '📎 Archivo adjunto' : ''),
      is_read: false,
      created_at: new Date().toISOString(),
      sender_profile: {
        full_name: profile!.full_name || '',
        email: profile!.email || '',
        avatar_url: profile!.avatar_url || undefined
      },
      direct_message_attachments: []
    };

    // Marcar que estamos agregando mensaje temporal
    addingTempMessageRef.current = true;
    
    // Agregar mensaje temporal - useLayoutEffect manejará el scroll
    setMessages(prev => [...prev, tempMessage]);

    if (!profile?.tenant_id) {
      alert('No se pudo identificar la empresa');
      setSending(false);
      addingTempMessageRef.current = false;
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setNewMessage(messageText);
      return;
    }

    try {
      // Crear mensaje
      const { data, error } = await (supabase as any)
        .from('direct_messages')
        .insert({
          sender_id: profile!.id,
          receiver_id: otherUser.id,
          message: messageText || (selectedFiles.length > 0 ? '📎 Archivo adjunto' : ''),
          tenant_id: profile.tenant_id // Agregar tenant_id para aislamiento multi-tenant
        })
        .select('id')
        .single();

      if (error) throw error;

      const messageId = (data as any).id;

      // Subir archivos si hay
      if (selectedFiles.length > 0) {
        await uploadFiles(messageId);
      }

      // NO remover el mensaje temporal aquí
      // El mensaje real llegará por suscripción y reemplazará al temporal automáticamente
      // Esto evita el cambio de length que causa el refresh
      
      // Limpiar archivos
      setSelectedFiles([]);
      
      // El flag addingTempMessageRef se desmarcará cuando el mensaje real reemplace al temporal
    } catch (error) {
      console.error('Error sending message:', error);
      addingTempMessageRef.current = false;
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setNewMessage(messageText);
      alert('Error al enviar el mensaje');
    } finally {
      setSending(false);
    }
  };

  const uploadFiles = async (messageId: string) => {
    if (selectedFiles.length === 0 || !profile?.id || !otherUser?.id) return;

    setUploading(true);
    try {
      for (const file of selectedFiles) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${profile.id}/${otherUser.id}/${fileName}`;

        // Subir a storage
        const { error: uploadError } = await supabase.storage
          .from('direct-message-attachments')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        // Guardar en BD
        if (!profile?.tenant_id) {
          throw new Error('No se pudo identificar la empresa');
        }

        const { error: dbError } = await (supabase as any)
          .from('direct_message_attachments')
          .insert({
            message_id: messageId,
            file_name: file.name,
            file_path: filePath,
            file_size: file.size,
            file_type: file.type,
            uploaded_by: profile.id,
            tenant_id: profile.tenant_id // Agregar tenant_id para aislamiento multi-tenant
          });

        if (dbError) throw dbError;
      }
    } catch (error) {
      console.error('Error uploading files:', error);
      throw error;
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setSelectedFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) {
      return <Image className="w-4 h-4 text-green-600 dark:text-green-400" />;
    } else if (fileType.includes('pdf')) {
      return <FileText className="w-4 h-4 text-red-600 dark:text-red-400" />;
    } else {
      return <File className="w-4 h-4 text-gray-600 dark:text-gray-400" />;
    }
  };

  const handleDownloadFile = async (attachment: Attachment) => {
    try {
      // Verificar cache
      const cached = signedUrlCacheRef.current.get(attachment.file_path);
      const now = Date.now();

      let signedUrl: string;

      if (cached && cached.expiresAt > now) {
        signedUrl = cached.url;
      } else {
        const { data, error } = await supabase.storage
          .from('direct-message-attachments')
          .createSignedUrl(attachment.file_path, 3600);

        if (error || !data?.signedUrl) {
          throw new Error('No se pudo generar la URL de descarga');
        }

        signedUrl = data.signedUrl;
        signedUrlCacheRef.current.set(attachment.file_path, {
          url: signedUrl,
          expiresAt: now + 50 * 60 * 1000
        });
      }

      // Descargar
      const response = await fetch(signedUrl);
      if (!response.ok) throw new Error('Error al descargar');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
      alert('Error al descargar el archivo');
    }
  };


  // Función para seleccionar usuario y abrir chat
  const selectUserAndOpenChat = (user: UserProfile | Conversation) => {
    const userData: UserProfile = 'other_user_id' in user ? {
      id: user.other_user_id,
      full_name: user.other_user_name,
      email: user.other_user_email,
      role: user.other_user_role,
      avatar_url: user.avatar_url
    } : user;
    
    setOtherUser(userData);
    setShowUserSelector(false);
    setIsOpen(true);
    setSearchTerm('');
    setSearchResults([]);
  };

  // Función de búsqueda de usuarios (solo para admins)
  const searchUsers = async (query: string) => {
    if (!query.trim() || !profile?.id) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, avatar_url')
        .neq('id', profile.id)
        .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
        .order('full_name')
        .limit(10);

      setSearchResults(data || []);
    } catch (error) {
      console.error('Error searching users:', error);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  // Debounce de búsqueda
  useEffect(() => {
    if (searchTerm.trim() && isAdmin && showUserSelector) {
      const timeoutId = setTimeout(() => {
        searchUsers(searchTerm);
      }, 300);

      return () => clearTimeout(timeoutId);
    } else {
      setSearchResults([]);
    }
  }, [searchTerm, isAdmin, showUserSelector]);

  // Cerrar desplegable al hacer clic fuera (solo para el desplegable de búsqueda)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const isSearchInput = target.closest('input[placeholder*="Buscar"]');
      const isDropdown = target.closest('.search-dropdown');
      
      if (!isSearchInput && !isDropdown && searchResults.length > 0) {
        setSearchResults([]);
      }
    };

    if (searchResults.length > 0) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [searchResults]);

  // Botón flotante
  if (!isOpen && !showUserSelector) {
    return (
      <button
        onClick={() => {
          // Ambos usuarios y admins muestran selector ahora
          setShowUserSelector(true);
        }}
        className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-all hover:scale-110 flex items-center justify-center z-50"
      >
        <MessageSquare className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold text-white bg-red-600 rounded-full">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
    );
  }

  // Vista de selección - Usuarios Normales
  if (showUserSelector && isNormalUser) {
    return (
      <div className="fixed bottom-0 right-0 sm:bottom-4 sm:right-4 w-full sm:w-[550px] sm:max-w-[calc(100vw-1rem)] max-h-[calc(100vh)] sm:max-h-[calc(100vh-2rem)] bg-white dark:bg-slate-800 rounded-t-2xl sm:rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 z-50 flex flex-col overflow-hidden" style={{ height: 'clamp(400px, 600px, calc(100vh))', maxWidth: '100vw' }}>
        <div className="p-4 border-b border-gray-200 dark:border-slate-700 bg-gradient-to-r from-blue-600 to-blue-700 rounded-t-2xl flex-shrink-0">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-semibold">Selecciona un administrador</h3>
            <button
              onClick={() => setShowUserSelector(false)}
              className="p-1 hover:bg-blue-500 rounded transition text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 messages-scroll">
          {availableUsers.length === 0 ? (
            <div className="p-10 text-center text-gray-500 dark:text-gray-400">
              <MessageSquare className="w-16 h-16 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
              <p className="text-base font-medium">No hay administradores disponibles</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-slate-700">
              {availableUsers.map((user) => {
                const userUnreadCount = unreadByUser.get(user.id) || 0;
                return (
                  <button
                    key={user.id}
                    onClick={() => selectUserAndOpenChat(user)}
                    className="w-full flex items-center gap-4 p-5 hover:bg-blue-50 dark:hover:bg-slate-700 transition-colors text-left group"
                  >
                    <div className="relative flex-shrink-0">
                      {user.avatar_url ? (
                        <img
                          src={user.avatar_url}
                          alt={user.full_name}
                          className="w-14 h-14 rounded-full object-cover ring-2 ring-blue-100 dark:ring-blue-900/50 group-hover:ring-blue-300 dark:group-hover:ring-blue-700 transition-all"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center ring-2 ring-blue-100 dark:ring-blue-900/50 group-hover:ring-blue-300 dark:group-hover:ring-blue-700 transition-all">
                          <span className="text-white font-bold text-xl">
                            {user.full_name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      {userUnreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[22px] h-6 px-2 text-xs font-bold text-white bg-red-600 rounded-full shadow-lg">
                          {userUnreadCount > 9 ? '9+' : userUnreadCount}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-white text-base truncate">{user.full_name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 truncate mt-0.5">{user.email}</p>
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 mt-2">
                        {user.role === 'admin' ? 'Administrador' : '🛠️ Soporte'}
                      </span>
                    </div>
                    <div className="text-blue-600 dark:text-blue-400 flex-shrink-0">
                      <MessageSquare className="w-6 h-6" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-3 border-t border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-700 text-center rounded-b-2xl flex-shrink-0">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Selecciona con quién deseas conversar
          </p>
        </div>
      </div>
    );
  }

  // Vista de selección - Administradores (Conversaciones + Buscador)
  if (showUserSelector && isAdmin) {
    const filteredConversations = searchTerm.trim() 
      ? conversations.filter(conv =>
          conv.other_user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          conv.other_user_email.toLowerCase().includes(searchTerm.toLowerCase())
        )
      : conversations;

    return (
      <div className="fixed bottom-0 right-0 sm:bottom-4 sm:right-4 w-full sm:w-[500px] sm:max-w-[calc(100vw-1rem)] max-h-[calc(100vh)] sm:max-h-[calc(100vh-2rem)] bg-white dark:bg-slate-800 rounded-t-2xl sm:rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 z-50 flex flex-col overflow-hidden" style={{ height: 'clamp(500px, 800px, calc(100vh))', maxWidth: '100vw' }}>
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-slate-700 bg-gradient-to-r from-blue-600 to-blue-700 rounded-t-2xl">
                <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-semibold">Mensajes</h3>
                  <button
              onClick={() => {
                setShowUserSelector(false);
                setSearchTerm('');
                setSearchResults([]);
              }}
              className="p-1 hover:bg-blue-500 rounded transition text-white"
            >
              <X className="w-5 h-5" />
                  </button>
                </div>

          {/* Buscador */}
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar usuario para iniciar conversación..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={() => {
                if (searchTerm.trim()) {
                  searchUsers(searchTerm);
                }
              }}
              className="w-full px-4 py-3 text-sm border-0 rounded-lg focus:ring-2 focus:ring-white bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
            />
            {searching && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            
            {/* Desplegable de resultados de búsqueda */}
            {searchTerm.trim().length > 0 && searchResults.length > 0 && (
              <div className="search-dropdown absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-gray-200 dark:border-slate-700 max-h-80 overflow-y-auto z-50 messages-scroll">
                <div className="p-2 bg-gray-50 dark:bg-slate-700 border-b border-gray-100 dark:border-slate-600">
                  <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 px-2">
                    Usuarios encontrados ({searchResults.length})
                  </p>
                </div>
                {searchResults.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => selectUserAndOpenChat(user)}
                    className="w-full flex items-center gap-3 p-3 hover:bg-blue-50 dark:hover:bg-slate-700 transition-colors text-left border-b border-gray-50 dark:border-slate-700 last:border-b-0"
                  >
                    {user.avatar_url ? (
                      <img
                        src={user.avatar_url}
                        alt={user.full_name}
                        className="w-11 h-11 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0">
                        <span className="text-white font-semibold text-lg">
                          {user.full_name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">{user.full_name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 mt-1">
                        {user.role === 'admin' ? 'Admin' : user.role === 'support' ? '🛠️ Soporte' : '👤 Usuario'}
                      </span>
                    </div>
                    <MessageSquare className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                  </button>
                ))}
              </div>
            )}
            
            {/* Mensaje cuando no hay resultados */}
            {searchTerm.trim().length > 0 && !searching && searchResults.length === 0 && (
              <div className="search-dropdown absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-gray-200 dark:border-slate-700 p-4 text-center z-50">
                <p className="text-sm text-gray-500 dark:text-gray-400">No se encontraron usuarios</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Intenta con otro nombre o email</p>
              </div>
            )}
          </div>
        </div>

        {/* Lista de conversaciones */}
        <div className="flex-1 overflow-y-auto messages-scroll">
          {filteredConversations.length > 0 ? (
            // Conversaciones activas
            <div className="divide-y divide-gray-100 dark:divide-slate-700">
              {filteredConversations.map((conv) => (
                <button
                  key={conv.other_user_id}
                  onClick={() => selectUserAndOpenChat(conv)}
                  className="w-full flex items-center gap-4 p-5 hover:bg-blue-50 dark:hover:bg-slate-700 transition-colors text-left group"
                >
                  <div className="relative flex-shrink-0">
                    {conv.avatar_url ? (
                      <img
                        src={conv.avatar_url}
                        alt={conv.other_user_name}
                        className="w-14 h-14 rounded-full object-cover ring-2 ring-gray-100 dark:ring-slate-700 group-hover:ring-blue-200 dark:group-hover:ring-blue-700 transition-all"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center ring-2 ring-gray-100 dark:ring-slate-700 group-hover:ring-blue-200 dark:group-hover:ring-blue-700 transition-all">
                        <span className="text-white font-bold text-xl">
                          {conv.other_user_name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    {conv.unread_count > 0 && (
                      <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[22px] h-6 px-2 text-xs font-bold text-white bg-red-600 rounded-full shadow-lg">
                        {conv.unread_count > 9 ? '9+' : conv.unread_count}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="font-semibold text-gray-900 dark:text-white text-base truncate">
                        {conv.other_user_name}
                      </p>
                      {conv.last_message_at && (
                        <span className="text-xs text-gray-400 dark:text-gray-500 ml-2 flex-shrink-0">
                          {new Date(conv.last_message_at).toLocaleDateString('es-ES', { 
                            day: '2-digit', 
                            month: '2-digit' 
                          })}
                        </span>
                      )}
                    </div>
                    {conv.last_message && (
                      <p className="text-sm text-gray-600 dark:text-gray-300 truncate font-normal">
                        {conv.last_message}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            // Sin conversaciones
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              <MessageSquare className="w-12 h-12 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
              <p className="text-sm">
                {searchTerm.trim() ? 'No se encontraron resultados' : 'No hay conversaciones activas'}
              </p>
              <p className="text-xs mt-1 text-gray-400 dark:text-gray-500">
                Usa el buscador para iniciar una conversación
              </p>
                  </div>
                )}
              </div>

        {/* Footer */}
        <div className="p-3 border-t border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-700 text-center rounded-b-2xl">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {conversations.length} conversacion{conversations.length !== 1 ? 'es' : ''} activa{conversations.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 right-0 sm:bottom-4 sm:right-4 w-full sm:w-[500px] sm:max-w-[calc(100vw-1rem)] max-h-[100vh] sm:max-h-[calc(100vh-2rem)] bg-white dark:bg-slate-800 rounded-t-2xl sm:rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 z-50 flex flex-col overflow-hidden" style={{ height: 'clamp(400px, 800px, 100vh)', maxWidth: '100vw' }}>
      {/* Header */}
      <div className="p-2 sm:p-4 border-b border-gray-200 dark:border-slate-700 bg-gradient-to-r from-blue-600 to-blue-700 rounded-t-2xl flex-shrink-0">
                <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
            {otherUser?.avatar_url ? (
              <img
                src={otherUser.avatar_url}
                alt={otherUser.full_name}
                className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover border-2 border-white flex-shrink-0"
              />
            ) : (
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                <span className="text-blue-600 dark:text-blue-400 font-semibold text-base sm:text-lg">
                  {otherUser?.full_name?.charAt(0).toUpperCase() || '?'}
                      </span>
                    </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-white text-xs sm:text-sm truncate">
                {otherUser?.full_name || 'Cargando...'}
              </p>
              <p className="text-xs sm:text-xs text-blue-100 truncate">
                {otherUser?.role === 'admin' ? 'Administrador' :
                 otherUser?.role === 'support' ? 'Soporte' : 'Usuario'}
                      </p>
                    </div>
                  </div>
          <button
            onClick={() => {
              setIsOpen(false);
              cleanupSubscription();
              signedUrlCacheRef.current.clear();
              setMessages([]);
              setNewMessage('');
              setSelectedFiles([]);
              // Volver al selector (listado)
              setShowUserSelector(true);
            }}
            className="p-1 hover:bg-blue-500 rounded transition text-white flex-shrink-0"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
                </div>
              </div>

      {/* Messages Area */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-2 sm:p-4 space-y-2 sm:space-y-3 bg-gray-50 dark:bg-slate-900 min-h-0 messages-scroll" 
        style={{ 
          minHeight: '200px',
          scrollBehavior: 'auto', // Desactivar smooth scroll para scroll programático
          willChange: 'scroll-position' // Optimización para scroll
        }}
      >
        {loading ? (
          <div className="flex items-center justify-center h-full min-h-[200px]">
            <div className="text-center">
              <div className="w-6 h-6 sm:w-8 sm:h-8 border-2 border-gray-300 dark:border-gray-600 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Cargando mensajes...</p>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full min-h-[200px]">
            <div className="text-center text-gray-500 dark:text-gray-400">
                    <MessageSquare className="w-8 h-8 sm:w-12 sm:h-12 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
                    <p className="text-xs sm:text-sm">No hay mensajes aún</p>
              <p className="text-xs mt-1">Envía un mensaje para comenzar</p>
            </div>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isMine = msg.sender_id === profile?.id;
                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[85%] sm:max-w-xs px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm ${
                            isMine
                              ? 'bg-blue-600 dark:bg-blue-500 text-white'
                              : 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white border border-gray-200 dark:border-slate-600'
                          }`}
                        >
                  {msg.message && msg.message !== '📎 Archivo adjunto' && (
                    <p className="whitespace-pre-wrap break-words mb-1">{msg.message}</p>
                          )}
                          
                          {msg.direct_message_attachments && msg.direct_message_attachments.length > 0 && (
                    <div className="space-y-2 mb-1">
                      {msg.direct_message_attachments
                        .filter((attachment, index, self) => 
                          // Eliminar attachments duplicados por ID
                          index === self.findIndex(a => a.id === attachment.id)
                        )
                        .map((attachment) => {
                        const isImage = attachment.file_type.startsWith('image/') ||
                          ['.png', '.jpg', '.jpeg', '.gif', '.webp'].some(ext =>
                            attachment.file_name.toLowerCase().endsWith(ext)
                          );

                        if (isImage) {
                                return (
                            <ImagePreview
                                    key={attachment.id}
                              attachment={attachment}
                              isMine={isMine}
                              onDownload={() => handleDownloadFile(attachment)}
                              urlCache={signedUrlCacheRef}
                            />
                          );
                        }

                        return (
                          <button
                            key={attachment.id}
                            onClick={() => handleDownloadFile(attachment)}
                            className={`w-full flex items-center gap-2 p-2 rounded ${
                              isMine ? 'bg-blue-500 dark:bg-blue-600 hover:bg-blue-400 dark:hover:bg-blue-500' : 'bg-gray-100 dark:bg-slate-600 hover:bg-gray-200 dark:hover:bg-slate-500'
                                    } transition`}
                                  >
                                    {getFileIcon(attachment.file_type)}
                            <div className="flex-1 text-left min-w-0">
                                      <p className={`text-xs truncate ${isMine ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                                        {attachment.file_name}
                                      </p>
                                      <p className={`text-xs ${isMine ? 'text-blue-100 dark:text-blue-200' : 'text-gray-500 dark:text-gray-400'}`}>
                                        {formatFileSize(attachment.file_size)}
                                      </p>
                                    </div>
                                    <Download className={`w-4 h-4 ${isMine ? 'text-white' : 'text-gray-600 dark:text-gray-400'}`} />
                          </button>
                                );
                              })}
                            </div>
                          )}
                          
                  <p className={`text-xs ${isMine ? 'text-blue-100 dark:text-blue-200' : 'text-gray-500 dark:text-gray-400'}`}>
                            {new Date(msg.created_at).toLocaleTimeString('es-ES', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

      {/* Input Area */}
              <div className="p-2 sm:p-4 border-t border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-b-2xl flex-shrink-0">
                {selectedFiles.length > 0 && (
                  <div className="mb-2 sm:mb-3 space-y-2 max-h-24 sm:max-h-32 overflow-y-auto messages-scroll">
                    {selectedFiles.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 p-1.5 sm:p-2 bg-gray-50 dark:bg-slate-700 rounded-lg border border-gray-200 dark:border-slate-600"
                      >
                        {getFileIcon(file.type)}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs sm:text-sm text-gray-900 dark:text-white truncate">{file.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{formatFileSize(file.size)}</p>
                        </div>
                        <button
                          onClick={() => removeFile(index)}
                  className="p-1 hover:bg-gray-200 dark:hover:bg-slate-600 rounded flex-shrink-0"
                        >
                          <X className="w-3 h-3 sm:w-4 sm:h-4 text-gray-600 dark:text-gray-400" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-1.5 sm:gap-2 items-end">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    className="hidden"
                    multiple
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
            className="p-1.5 sm:p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition flex-shrink-0"
                    disabled={sending || uploading}
                  >
                    <Paperclip className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                  <textarea
                    ref={textareaRef}
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder="Escribe un mensaje..."
                    rows={1}
                    className="flex-1 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none min-h-[36px] sm:min-h-[40px] max-h-32 overflow-y-auto messages-scroll"
                    disabled={sending || uploading}
                  />
                  <EmojiPicker
                    onEmojiSelect={(emoji) => {
                      const textarea = textareaRef.current;
                      if (textarea) {
                        const cursorPos = textarea.selectionStart || 0;
                        const textBefore = newMessage.substring(0, cursorPos);
                        const textAfter = newMessage.substring(cursorPos);
                        setNewMessage(textBefore + emoji + textAfter);
                        setTimeout(() => {
                          textarea.focus();
                          textarea.setSelectionRange(cursorPos + emoji.length, cursorPos + emoji.length);
                        }, 0);
                      }
                    }}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={(!newMessage.trim() && selectedFiles.length === 0) || sending || uploading}
                    className="p-2 sm:px-4 sm:py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-1 sm:gap-2 flex-shrink-0 min-w-[36px] sm:min-w-[auto]"
                  >
            {sending || uploading ? (
                      <div className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Send className="w-3 h-3 sm:w-4 sm:h-4" />
                    )}
                  </button>
                </div>
              </div>
    </div>
  );
}
