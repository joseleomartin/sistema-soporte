import { useEffect, useState, useRef } from 'react';
import { MessageSquare, X, Send, User, Search, Paperclip, FileText, Download, Image, File } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface Attachment {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  file_type: string;
}

interface DirectMessage {
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

export function MessagesBell() {
  const { profile } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showUserSearch, setShowUserSearch] = useState(false);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [totalUnread, setTotalUnread] = useState(0);
  const [availableAdmins, setAvailableAdmins] = useState<any[]>([]);
  const [allConversations, setAllConversations] = useState<Conversation[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const isNormalUser = profile?.role === 'user';
  const isAdmin = profile?.role === 'admin' || profile?.role === 'support';

  const getAvailableAdmins = async () => {
    if (!profile?.id) return [];

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, avatar_url')
        .in('role', ['admin', 'support'])
        .neq('id', profile.id)
        .order('full_name');

      if (error) throw error;
      return data || [];
    } catch (error) {
      return [];
    }
  };

  useEffect(() => {
    if (profile?.id) {
      loadConversations();
      
      // Para usuarios normales, cargar admin/support disponibles
      if (profile.role === 'user') {
        getAvailableAdmins().then(setAvailableAdmins);
      }
      
      // Actualizar conversaciones periódicamente cuando el dropdown está abierto
      const interval = setInterval(() => {
        if (showDropdown) {
          loadConversations();
          if (profile.role === 'user') {
            getAvailableAdmins().then(setAvailableAdmins);
          }
        }
      }, 5000); // Cada 5 segundos
      
      return () => clearInterval(interval);
    }
  }, [profile?.id, profile?.role, profile?.avatar_url, showDropdown]);

  useEffect(() => {
    let channels: any = null;
    
    if (showDropdown && selectedConversation) {
      // Cargar perfil si no está en las conversaciones o recargar para obtener avatar actualizado
      const existingConv = conversations.find(c => c.other_user_id === selectedConversation);
      if (!existingConv) {
        // Solo cargar si no tenemos el perfil ya cargado
        if (!selectedConversationProfile || selectedConversationProfile.id !== selectedConversation) {
          loadUserProfile(selectedConversation);
        }
      } else {
        // Recargar el perfil para obtener el avatar_url más reciente incluso si existe la conversación
        loadUserProfile(selectedConversation);
      }

      loadMessages(selectedConversation);
      channels = subscribeToMessages(selectedConversation);
      
      // Solo marcar como leído si hay mensajes
      const hasMessages = messages.length > 0;
      if (hasMessages) {
        markAsRead(selectedConversation);
      }
    }
    
    return () => {
      if (channels) {
        if (channels.channel1) {
          supabase.removeChannel(channels.channel1);
        }
        if (channels.channel2) {
          supabase.removeChannel(channels.channel2);
        }
      }
    };
  }, [selectedConversation, showDropdown, profile?.id]);

  // Limpiar perfil cuando se cambia de conversación
  useEffect(() => {
    if (!selectedConversation) {
      setSelectedConversationProfile(null);
    } else {
      // Si la conversación está en la lista, limpiar el perfil temporal
      const conv = conversations.find(c => c.other_user_id === selectedConversation);
      if (conv) {
        setSelectedConversationProfile(null);
      }
    }
  }, [selectedConversation, conversations]);

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages]);

  useEffect(() => {
    // Calcular total de mensajes no leídos
    const total = conversations.reduce((sum, conv) => sum + conv.unread_count, 0);
    setTotalUnread(total);
  }, [conversations]);

  useEffect(() => {
    // Cerrar dropdown al hacer clic fuera
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
        setSelectedConversation(null);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadConversations = async () => {
    if (!profile?.id) return;

    try {
      // Obtener conversaciones con avatar_url actualizado
      const { data, error } = await supabase.rpc('get_conversations');

      if (error) throw error;
      
      // Preservar los avatar_url que ya se han cargado previamente
      setConversations(prev => {
        const prevMap = new Map(prev.map(conv => [conv.other_user_id, conv]));
        
        const conversationsWithAvatars = (data || []).map((conv: any) => {
          // Si ya tenemos un avatar_url cargado previamente, preservarlo
          const prevConv = prevMap.get(conv.other_user_id);
          const preservedAvatarUrl = prevConv?.avatar_url || conv.avatar_url || null;
          
          return {
            ...conv,
            avatar_url: preservedAvatarUrl // Usar el preservado o el de la DB
          };
        });
        
        return conversationsWithAvatars;
      });
    } catch (error) {
    }
  };

  const loadMessages = async (otherUserId: string) => {
    if (!profile?.id) return;

    try {
      const { data, error } = await supabase
        .from('direct_messages')
        .select(`
          *,
          sender_profile:profiles!direct_messages_sender_id_fkey(full_name, email, avatar_url),
          receiver_profile:profiles!direct_messages_receiver_id_fkey(full_name, email, avatar_url),
          direct_message_attachments(*)
        `)
        .or(`and(sender_id.eq.${profile.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${profile.id})`)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      // Procesar mensajes para incluir URLs públicas de los archivos
      const processedMessages = (data || []).map((msg: any) => ({
        ...msg,
        direct_message_attachments: msg.direct_message_attachments?.map((att: any) => ({
          ...att,
          file_url: supabase.storage
            .from('direct-message-attachments')
            .getPublicUrl(att.file_path).data.publicUrl
        })) || []
      }));
      
      setMessages(processedMessages);
    } catch (error) {
    }
  };

  const subscribeToMessages = (otherUserId: string) => {
    if (!profile?.id) return null;


    // Suscribirse a mensajes donde el usuario es remitente
    const channel1 = supabase
      .channel(`direct_messages_sender:${otherUserId}:${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
          filter: `sender_id=eq.${profile.id}`
        },
        async (payload: any) => {
          if (payload.new.receiver_id === otherUserId) {
            await handleNewMessage(payload.new.id, otherUserId);
          }
        }
      )
      .subscribe((status) => {
        // Subscription status handled silently
      });

    // Suscribirse a mensajes donde el usuario es destinatario
    const channel2 = supabase
      .channel(`direct_messages_receiver:${otherUserId}:${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
          filter: `receiver_id=eq.${profile.id}`
        },
        async (payload: any) => {
          if (payload.new.sender_id === otherUserId) {
            await handleNewMessage(payload.new.id, otherUserId);
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
          // Actualizar estado de lectura
          if (payload.new.sender_id === otherUserId) {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === payload.new.id ? { ...msg, is_read: payload.new.is_read } : msg
              )
            );
          }
        }
      )
      // Suscribirse a cambios en archivos adjuntos para actualizar mensajes existentes
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_message_attachments'
        },
        async (payload: any) => {
          // Recargar el mensaje para obtener los archivos adjuntos
          if (payload.new.message_id) {
            // Recargar el mensaje completo con los archivos adjuntos
            await handleNewMessage(payload.new.message_id, otherUserId);
          }
        }
      )
      .subscribe((status) => {
        // Subscription status handled silently
      });

    return { channel1, channel2 };
  };

  const handleNewMessage = async (messageId: string, otherUserId: string) => {
    if (!profile?.id) return;

    try {
      // Intentar obtener el mensaje varias veces para asegurar que los archivos estén asociados
      let messageData = null;
      let attempts = 0;
      const maxAttempts = 5;
      
      while (attempts < maxAttempts && !messageData) {
        const { data, error } = await supabase
          .from('direct_messages')
          .select(`
            *,
            sender_profile:profiles!direct_messages_sender_id_fkey(full_name, email, avatar_url),
            receiver_profile:profiles!direct_messages_receiver_id_fkey(full_name, email, avatar_url),
            direct_message_attachments(*)
          `)
          .eq('id', messageId)
          .single();

        if (error) {
          // Si es el primer intento y hay error, esperar un poco antes de reintentar
          if (attempts === 0) {
            await new Promise(resolve => setTimeout(resolve, 500));
            attempts++;
            continue;
          }
          return;
        }

        if (data) {
          messageData = data;
          // Si el mensaje tiene archivos adjuntos, verificar que estén todos cargados
          // Si no tiene archivos pero el mensaje dice "📎 Archivo adjunto", esperar un poco más
          if (data.message === '📎 Archivo adjunto' && (!data.direct_message_attachments || data.direct_message_attachments.length === 0)) {
            if (attempts < maxAttempts - 1) {
              await new Promise(resolve => setTimeout(resolve, 500));
              attempts++;
              continue;
            }
          }
          break;
        }
        
        attempts++;
        if (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }

      if (messageData) {
        // Procesar archivos adjuntos para incluir URLs públicas
        const processedMessage = {
          ...messageData,
          direct_message_attachments: messageData.direct_message_attachments?.map((att: any) => ({
            ...att,
            file_url: supabase.storage
              .from('direct-message-attachments')
              .getPublicUrl(att.file_path).data.publicUrl
          })) || []
        };
        
        setMessages((prev) => {
          // Evitar duplicados por ID
          if (prev.some(msg => msg.id === processedMessage.id)) {
            // Si el mensaje ya existe, actualizarlo con los archivos adjuntos
            return prev.map(msg => 
              msg.id === processedMessage.id 
                ? processedMessage 
                : msg
            );
          }
          // Remover mensajes temporales que puedan ser del mismo mensaje
          const filtered = prev.filter(msg => 
            !msg.id.startsWith('temp-') || 
            !(msg.sender_id === processedMessage.sender_id && 
              msg.receiver_id === processedMessage.receiver_id && 
              Math.abs(new Date(msg.created_at).getTime() - new Date(processedMessage.created_at).getTime()) < 5000)
          );
          return [...filtered, processedMessage];
        });
        
        if (messageData.receiver_id === profile.id) {
          markAsRead(otherUserId);
        }
        
        loadConversations();
      }
    } catch (error) {
    }
  };

  const markAsRead = async (otherUserId: string) => {
    if (!profile?.id) return;

    try {
      await supabase.rpc('mark_messages_as_read', {
        conversation_user_id: otherUserId
      });
      loadConversations();
    } catch (error) {
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setSelectedFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) {
      return <Image className="w-4 h-4 text-green-600" />;
    } else if (fileType.includes('pdf')) {
      return <FileText className="w-4 h-4 text-red-600" />;
    } else {
      return <File className="w-4 h-4 text-gray-600" />;
    }
  };

  const uploadFiles = async (messageId: string): Promise<void> => {
    if (selectedFiles.length === 0 || !profile?.id) return;

    setUploading(true);
    try {
      for (const file of selectedFiles) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${profile.id}/${selectedConversation}/${fileName}`;

        // Subir archivo a Storage
        const { error: uploadError } = await supabase.storage
          .from('direct-message-attachments')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        // Guardar metadata en la base de datos
        const { error: dbError } = await supabase
          .from('direct_message_attachments')
          .insert({
            message_id: messageId,
            file_name: file.name,
            file_path: filePath,
            file_size: file.size,
            file_type: file.type,
            uploaded_by: profile.id
          });

        if (dbError) throw dbError;
      }
    } catch (error) {
      throw error;
    } finally {
      setUploading(false);
    }
  };

  const sendMessage = async () => {
    if ((!newMessage.trim() && selectedFiles.length === 0) || !selectedConversation || !profile?.id || sending || uploading) return;

    const messageText = newMessage.trim();
    setNewMessage('');
    setSending(true);

    // Optimistic update: agregar el mensaje inmediatamente al estado
    const tempMessage: DirectMessage = {
      id: `temp-${Date.now()}`,
      sender_id: profile.id,
      receiver_id: selectedConversation,
      message: messageText || (selectedFiles.length > 0 ? '📎 Archivo adjunto' : ''),
      is_read: false,
      created_at: new Date().toISOString(),
      sender_profile: {
        full_name: profile.full_name || '',
        email: profile.email || '',
        avatar_url: profile.avatar_url || undefined
      },
      direct_message_attachments: selectedFiles.map((file, index) => ({
        id: `temp-${index}`,
        file_name: file.name,
        file_path: '',
        file_size: file.size,
        file_type: file.type
      }))
    };

    setMessages(prev => [...prev, tempMessage]);
    scrollToBottom();

    try {
      // Subir archivos primero si hay
      let messageId: string | null = null;
      
      // Crear el mensaje primero
      const { data, error } = await supabase
        .from('direct_messages')
        .insert({
          sender_id: profile.id,
          receiver_id: selectedConversation,
          message: messageText || (selectedFiles.length > 0 ? '📎 Archivo adjunto' : '')
        })
        .select(`
          *,
          sender_profile:profiles!direct_messages_sender_id_fkey(full_name, email, avatar_url),
          receiver_profile:profiles!direct_messages_receiver_id_fkey(full_name, email, avatar_url),
          direct_message_attachments(*)
        `)
        .single();

      if (error) throw error;
      
      if (!data) throw new Error('No se pudo crear el mensaje');

      messageId = data.id;

      // Subir archivos si hay
      if (selectedFiles.length > 0 && messageId) {
        try {
          await uploadFiles(messageId);
          // Esperar un momento para que los archivos se asocien correctamente
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (fileError) {
          // Si falla la subida, mantener el mensaje pero sin archivos
        }
      }

      // Obtener el mensaje actualizado con los archivos adjuntos
      // Intentar varias veces si es necesario para asegurar que los archivos estén asociados
      let updatedMessage = null;
      let attempts = 0;
      const maxAttempts = 3;
      
      while (attempts < maxAttempts && !updatedMessage) {
        const { data: messageData, error: fetchError } = await supabase
          .from('direct_messages')
          .select(`
            *,
            sender_profile:profiles!direct_messages_sender_id_fkey(full_name, email, avatar_url),
            receiver_profile:profiles!direct_messages_receiver_id_fkey(full_name, email, avatar_url),
            direct_message_attachments(*)
          `)
          .eq('id', messageId)
          .single();

        if (!fetchError && messageData) {
          updatedMessage = messageData;
          // Si hay archivos seleccionados, verificar que estén en el mensaje
          if (selectedFiles.length > 0) {
            const attachmentsCount = messageData.direct_message_attachments?.length || 0;
            if (attachmentsCount < selectedFiles.length && attempts < maxAttempts - 1) {
              // Esperar un poco más y reintentar
              await new Promise(resolve => setTimeout(resolve, 500));
              attempts++;
              continue;
            }
          }
          break;
        } else if (fetchError) {
        }
        attempts++;
        if (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }

      // Reemplazar el mensaje temporal con el real (ahora con archivos)
      if (updatedMessage) {
        // Procesar los archivos adjuntos para incluir las URLs públicas
        const processedMessage = {
          ...updatedMessage,
          direct_message_attachments: updatedMessage.direct_message_attachments?.map((att: any) => ({
            ...att,
            file_url: supabase.storage
              .from('direct-message-attachments')
              .getPublicUrl(att.file_path).data.publicUrl
          })) || []
        };
        
        setMessages(prev => {
          // Remover mensaje temporal y cualquier duplicado del mensaje real
          const filtered = prev.filter(m => 
            m.id !== tempMessage.id && 
            m.id !== processedMessage.id
          );
          return [...filtered, processedMessage];
        });
      } else if (data) {
        // Si no se pudo obtener el mensaje actualizado, recargar todos los mensajes
        await loadMessages(selectedConversation);
      }

      // Recargar conversaciones para actualizar el último mensaje
      loadConversations();

      setSelectedFiles([]); // Limpiar archivos seleccionados
    } catch (error) {
      // Remover el mensaje temporal en caso de error
      setMessages(prev => prev.filter(m => m.id !== tempMessage.id));
      setNewMessage(messageText); // Restaurar el texto del mensaje
      alert('Error al enviar el mensaje');
    } finally {
      setSending(false);
    }
  };

  const loadUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, avatar_url')
        .eq('id', userId)
        .single();

      if (error) throw error;
      if (data) {
        setSelectedConversationProfile(data);
        
        // Actualizar también la conversación en la lista si existe
        setConversations(prev => prev.map(conv => 
          conv.other_user_id === userId 
            ? { ...conv, avatar_url: data.avatar_url }
            : conv
        ));
        
        // Actualizar también en allConversations si existe
        setAllConversations(prev => prev.map(conv => 
          conv.other_user_id === userId 
            ? { ...conv, avatar_url: data.avatar_url }
            : conv
        ));
      }
    } catch (error) {
      setSelectedConversationProfile(null);
    }
  };

  const startConversation = async (userId: string) => {
    setSelectedConversation(userId);
    setMessages([]); // Limpiar mensajes anteriores
    setSelectedFiles([]); // Limpiar archivos seleccionados
    
    // Cargar perfil del usuario si no está en las conversaciones
    const existingConv = conversations.find(c => c.other_user_id === userId);
    if (!existingConv) {
      await loadUserProfile(userId);
    } else {
      setSelectedConversationProfile(null);
    }
    
    await loadConversations();
    setShowUserSearch(false);
    setUserSearchTerm('');
    setSearchResults([]);
  };

  const searchUsers = async (searchQuery: string) => {
    if (!searchQuery.trim() || !profile?.id) {
      setSearchResults([]);
      return;
    }

    setSearchingUsers(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, avatar_url')
        .neq('id', profile.id)
        .or(`full_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`)
        .order('full_name')
        .limit(10);

      if (error) throw error;
      setSearchResults(data || []);
    } catch (error) {
      setSearchResults([]);
    } finally {
      setSearchingUsers(false);
    }
  };

  useEffect(() => {
    if (userSearchTerm.trim()) {
      const timeoutId = setTimeout(() => {
        searchUsers(userSearchTerm);
      }, 300); // Debounce de 300ms

      return () => clearTimeout(timeoutId);
    } else {
      setSearchResults([]);
    }
  }, [userSearchTerm]);

  const conversationsToShow = isNormalUser ? allConversations : conversations;
  const filteredConversations = conversationsToShow.filter(conv =>
    conv.other_user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    conv.other_user_email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const [selectedConversationProfile, setSelectedConversationProfile] = useState<any>(null);

  // Obtener datos de la conversación seleccionada
  const selectedConversationData = selectedConversation ? (
    conversations.find(c => c.other_user_id === selectedConversation) || 
    (selectedConversationProfile ? {
      other_user_id: selectedConversationProfile.id,
      other_user_name: selectedConversationProfile.full_name,
      other_user_email: selectedConversationProfile.email,
      other_user_role: selectedConversationProfile.role,
      avatar_url: selectedConversationProfile.avatar_url
    } : null)
  ) : null;

  useEffect(() => {
    if (isNormalUser && availableAdmins.length > 0) {
      // Combinar conversaciones existentes con admin/support que no tienen conversación
      const existingAdminIds = conversations.map(c => c.other_user_id);
      const missingAdmins = availableAdmins.filter(a => !existingAdminIds.includes(a.id));
      
      // Crear conversaciones "vacías" para admin/support sin mensajes
      const emptyConversations: Conversation[] = missingAdmins.map(admin => ({
        other_user_id: admin.id,
        other_user_name: admin.full_name,
        other_user_email: admin.email,
        other_user_role: admin.role,
        last_message: '',
        last_message_at: '',
        unread_count: 0,
        avatar_url: admin.avatar_url
      }));
      
      // Crear un mapa de conversaciones existentes para preservar avatar_url
      const conversationsMap = new Map(conversations.map(c => [c.other_user_id, c]));
      
      // Actualizar emptyConversations con avatar_url preservados si existen
      const emptyConversationsWithAvatars = emptyConversations.map(emptyConv => {
        const existingConv = conversationsMap.get(emptyConv.other_user_id);
        return {
          ...emptyConv,
          avatar_url: existingConv?.avatar_url || emptyConv.avatar_url || null
        };
      });
      
      // Combinar conversaciones existentes con las nuevas, preservando avatar_url
      const combined = [...conversations, ...emptyConversationsWithAvatars];
      combined.sort((a, b) => {
        // Primero las que tienen mensajes (por fecha), luego las vacías (por nombre)
        if (a.last_message_at && !b.last_message_at) return -1;
        if (!a.last_message_at && b.last_message_at) return 1;
        if (a.last_message_at && b.last_message_at) {
          return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime();
        }
        return a.other_user_name.localeCompare(b.other_user_name);
      });
      
      setAllConversations(combined);
    } else {
      setAllConversations(conversations);
    }
  }, [isNormalUser, conversations, availableAdmins]);

  // Cargar perfiles de usuarios sin avatar_url (solo una vez por usuario)
  const loadedProfilesRef = useRef<Set<string>>(new Set());
  
  useEffect(() => {
    const conversationsToCheck = isNormalUser ? allConversations : conversations;
    conversationsToCheck.forEach(conv => {
      if (!conv.avatar_url && conv.other_user_id && !loadedProfilesRef.current.has(conv.other_user_id)) {
        // Marcar como cargado para evitar múltiples llamadas
        loadedProfilesRef.current.add(conv.other_user_id);
        // Cargar perfil en background para obtener avatar_url actualizado
        loadUserProfile(conv.other_user_id);
      }
    });
  }, [conversations, allConversations, isNormalUser]);

  return (
    <div className="fixed bottom-6 right-6 z-50" ref={dropdownRef}>
      {showDropdown ? (
        <div className="w-[500px] max-w-[calc(100vw-2rem)] bg-white rounded-lg shadow-2xl border border-gray-200 mb-2" style={{ maxHeight: '800px', display: 'flex', flexDirection: 'column' }}>
          {!selectedConversation ? (
            // Vista de lista de conversaciones
            <>
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-gray-900">Mensajes</h3>
                  <button
                    onClick={() => setShowDropdown(false)}
                    className="p-1 hover:bg-gray-100 rounded transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {isAdmin && (
                  <div className="mb-3 relative">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Buscar usuarios..."
                        value={userSearchTerm}
                        onChange={(e) => {
                          setUserSearchTerm(e.target.value);
                          setShowUserSearch(e.target.value.trim().length > 0);
                        }}
                        onFocus={() => {
                          if (userSearchTerm.trim().length > 0) {
                            setShowUserSearch(true);
                          }
                        }}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      />
                    </div>
                    {showUserSearch && searchResults.length > 0 && (
                      <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-y-auto">
                        {searchResults.map((user) => (
                          <button
                            key={user.id}
                            onClick={() => startConversation(user.id)}
                            className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 transition border-b border-gray-100 last:border-b-0"
                          >
                            {user.avatar_url ? (
                              <img
                                src={user.avatar_url}
                                alt={user.full_name}
                                className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                  const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                                  if (fallback) fallback.style.display = 'flex';
                                }}
                              />
                            ) : null}
                            <div 
                              className={`w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 ${user.avatar_url ? 'hidden' : ''}`}
                            >
                              <span className="text-blue-600 font-semibold">
                                {user.full_name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div className="flex-1 text-left min-w-0">
                              <p className="font-medium text-gray-900 text-sm truncate">{user.full_name}</p>
                              <p className="text-xs text-gray-500 truncate">{user.email}</p>
                              <p className="text-xs text-gray-400">
                                {user.role === 'admin' ? 'Administrador' : 
                                 user.role === 'support' ? 'Soporte' : 'Usuario'}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    {showUserSearch && userSearchTerm.trim().length > 0 && !searchingUsers && searchResults.length === 0 && (
                      <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg p-4 text-center text-gray-500 text-sm">
                        No se encontraron usuarios
                      </div>
                    )}
                  </div>
                )}
                {isAdmin && (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Buscar conversaciones..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto" style={{ minHeight: '400px', maxHeight: '500px' }}>
                {filteredConversations.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <MessageSquare className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm">No hay conversaciones</p>
                  </div>
                ) : (
                  <div>
                    {filteredConversations.map((conv) => (
                        <button
                          key={conv.other_user_id}
                          onClick={() => {
                            setSelectedConversation(conv.other_user_id);
                            setMessages([]); // Limpiar mensajes anteriores
                            setSelectedFiles([]); // Limpiar archivos seleccionados
                            setSelectedConversationProfile(null); // Limpiar perfil temporal
                            // Forzar recarga del perfil para obtener avatar_url actualizado
                            loadUserProfile(conv.other_user_id);
                            if (conv.last_message) {
                              markAsRead(conv.other_user_id);
                            }
                          }}
                          className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition border-b border-gray-100"
                        >
                          {conv.avatar_url ? (
                            <img
                              src={conv.avatar_url}
                              alt={conv.other_user_name}
                              className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                              onError={(e) => {
                                // Si la imagen falla al cargar, ocultar y mostrar fallback
                                e.currentTarget.style.display = 'none';
                                const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                                if (fallback) {
                                  fallback.style.display = 'flex';
                                  fallback.classList.remove('hidden');
                                }
                                // Intentar recargar el perfil
                                if (conv.other_user_id) {
                                  loadUserProfile(conv.other_user_id);
                                }
                              }}
                              onLoad={() => {
                              }}
                            />
                          ) : null}
                          <div 
                            className={`w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 ${conv.avatar_url ? 'hidden' : ''}`}
                            style={{ display: conv.avatar_url ? 'none' : 'flex' }}
                          >
                            <span className="text-blue-600 font-semibold text-lg">
                              {conv.other_user_name?.charAt(0).toUpperCase() || '?'}
                            </span>
                          </div>
                        <div className="flex-1 text-left min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <p className="font-medium text-gray-900 text-sm truncate">{conv.other_user_name}</p>
                            {conv.unread_count > 0 && (
                              <span className="bg-blue-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">
                                {conv.unread_count}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 truncate">
                            {conv.last_message || (isNormalUser ? 'Disponible para chatear' : 'Sin mensajes')}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            // Vista de chat
            <>
              <div className="p-4 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setSelectedConversation(null)}
                      className="p-1 hover:bg-gray-200 rounded transition"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    {selectedConversationData?.avatar_url ? (
                      <img
                        src={selectedConversationData.avatar_url}
                        alt={selectedConversationData.other_user_name}
                        className="w-8 h-8 rounded-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                          if (fallback) fallback.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div 
                      className={`w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center ${selectedConversationData?.avatar_url ? 'hidden' : ''}`}
                    >
                      <span className="text-blue-600 font-semibold text-sm">
                        {selectedConversationData?.other_user_name?.charAt(0).toUpperCase() || '?'}
                      </span>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">
                        {selectedConversationData?.other_user_name || 'Cargando...'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {selectedConversationData?.other_user_role === 'admin' ? 'Administrador' : 
                         selectedConversationData?.other_user_role === 'support' ? 'Soporte' : 
                         selectedConversationData?.other_user_role ? 'Usuario' : ''}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50" style={{ minHeight: '450px', maxHeight: '550px' }}>
                {messages.length === 0 ? (
                  <div className="text-center text-gray-500 mt-8">
                    <MessageSquare className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm">No hay mensajes aún</p>
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
                          className={`max-w-xs px-3 py-2 rounded-lg text-sm ${
                            isMine
                              ? 'bg-blue-600 text-white'
                              : 'bg-white text-gray-900 border border-gray-200'
                          }`}
                        >
                          {msg.message && (
                            <p className="whitespace-pre-wrap break-words mb-2">{msg.message}</p>
                          )}
                          
                          {/* Archivos adjuntos */}
                          {msg.direct_message_attachments && msg.direct_message_attachments.length > 0 && (
                            <div className="space-y-2 mb-2">
                              {msg.direct_message_attachments.map((attachment: any) => {
                                // Usar file_url si está disponible, sino calcularlo
                                const fileUrl = attachment.file_url || supabase.storage
                                  .from('direct-message-attachments')
                                  .getPublicUrl(attachment.file_path).data.publicUrl;
                                
                                return (
                                  <a
                                    key={attachment.id}
                                    href={fileUrl}
                                    download={attachment.file_name}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`flex items-center gap-2 p-2 rounded ${
                                      isMine
                                        ? 'bg-blue-500 hover:bg-blue-400'
                                        : 'bg-gray-100 hover:bg-gray-200'
                                    } transition`}
                                  >
                                    {getFileIcon(attachment.file_type)}
                                    <div className="flex-1 min-w-0">
                                      <p className={`text-xs truncate ${isMine ? 'text-white' : 'text-gray-900'}`}>
                                        {attachment.file_name}
                                      </p>
                                      <p className={`text-xs ${isMine ? 'text-blue-100' : 'text-gray-500'}`}>
                                        {formatFileSize(attachment.file_size)}
                                      </p>
                                    </div>
                                    <Download className={`w-4 h-4 ${isMine ? 'text-white' : 'text-gray-600'}`} />
                                  </a>
                                );
                              })}
                            </div>
                          )}
                          
                          <p
                            className={`text-xs mt-1 ${
                              isMine ? 'text-blue-100' : 'text-gray-500'
                            }`}
                          >
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

              <div className="p-4 border-t border-gray-200 bg-white">
                {/* Archivos Seleccionados */}
                {selectedFiles.length > 0 && (
                  <div className="mb-3 space-y-2 max-h-32 overflow-y-auto">
                    {selectedFiles.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200"
                      >
                        {getFileIcon(file.type)}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-900 truncate">{file.name}</p>
                          <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                        </div>
                        <button
                          onClick={() => removeFile(index)}
                          className="p-1 hover:bg-gray-200 rounded transition-colors"
                        >
                          <X className="w-4 h-4 text-gray-600" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    className="hidden"
                    multiple
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Adjuntar archivo"
                    disabled={sending || uploading}
                  >
                    <Paperclip className="w-5 h-5" />
                  </button>
                  <textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder="Escribe un mensaje..."
                    rows={2}
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    disabled={sending || uploading}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={(!newMessage.trim() && selectedFiles.length === 0) || sending || uploading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
                  >
                    {(sending || uploading) ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      ) : (
        <button
          onClick={() => setShowDropdown(true)}
          className="relative w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-all hover:scale-110 flex items-center justify-center"
        >
          <MessageSquare className="w-6 h-6" />
          {totalUnread > 0 && (
            <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold text-white bg-red-600 rounded-full">
              {totalUnread > 9 ? '9+' : totalUnread}
            </span>
          )}
        </button>
      )}
    </div>
  );
}

