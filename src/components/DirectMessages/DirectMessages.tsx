import { useEffect, useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Send, MessageSquare, User, Search, X, ArrowLeft } from 'lucide-react';

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
}

interface Conversation {
  other_user_id: string;
  other_user_name: string;
  other_user_email: string;
  other_user_role: string;
  last_message: string;
  last_message_at: string;
  unread_count: number;
}

export function DirectMessages() {
  const { profile } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadConversations();
  }, [profile?.id]);

  useEffect(() => {
    let channels: any = null;
    
    if (selectedConversation) {
      loadMessages(selectedConversation);
      channels = subscribeToMessages(selectedConversation);
      markAsRead(selectedConversation);
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
  }, [selectedConversation, profile?.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadConversations = async () => {
    if (!profile?.id) return;

    try {
      const { data, error } = await supabase.rpc('get_conversations');

      if (error) throw error;
      setConversations(data || []);
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
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
          receiver_profile:profiles!direct_messages_receiver_id_fkey(full_name, email, avatar_url)
        `)
        .or(`and(sender_id.eq.${profile.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${profile.id})`)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const subscribeToMessages = (otherUserId: string) => {
    if (!profile?.id) return null;

    console.log('🔔 Subscribing to direct_messages for conversation with:', otherUserId);

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
          console.log('📨 New message received (as sender):', payload);
          
          // Filtrar solo si es para la conversación actual
          if (payload.new.receiver_id === otherUserId) {
            await handleNewMessage(payload.new.id, otherUserId);
          }
        }
      )
      .subscribe(() => {
        // Subscription active
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
          console.log('📨 New message received (as receiver):', payload);
          
          // Filtrar solo si es de la conversación actual
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
          // Actualizar estado de lectura solo si es de la conversación actual
          if (payload.new.sender_id === otherUserId) {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === payload.new.id ? { ...msg, is_read: payload.new.is_read } : msg
              )
            );
          }
        }
      )
      .subscribe(() => {
        // Subscription active
      });

    return { channel1, channel2 };
  };

  const handleNewMessage = async (messageId: string, otherUserId: string) => {
    if (!profile?.id) return;

    try {
      const { data, error } = await supabase
        .from('direct_messages')
        .select(`
          *,
          sender_profile:profiles!direct_messages_sender_id_fkey(full_name, email, avatar_url),
          receiver_profile:profiles!direct_messages_receiver_id_fkey(full_name, email, avatar_url)
        `)
        .eq('id', messageId)
        .single();

      if (error) {
        console.error('❌ Error fetching new message:', error);
        return;
      }

      if (data) {
        console.log('✅ Adding message to state:', data);
        setMessages((prev) => {
          if (prev.some(msg => msg.id === data.id)) {
            console.log('⚠️ Message already exists, skipping');
            return prev;
          }
          return [...prev, data];
        });
        
        // Si el mensaje es para mí, marcarlo como leído
        if (data.receiver_id === profile.id) {
          markAsRead(otherUserId);
        }
        
        // Recargar conversaciones para actualizar contadores
        loadConversations();
      }
    } catch (error) {
      console.error('❌ Error in Realtime handler:', error);
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
      console.error('Error marking messages as read:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !profile?.id || sending) return;

    if (!profile?.tenant_id) {
      alert('No se pudo identificar la empresa');
      return;
    }

    setSending(true);
    try {
      const { error } = await supabase
        .from('direct_messages')
        .insert({
          sender_id: profile.id,
          receiver_id: selectedConversation,
          message: newMessage.trim(),
          tenant_id: profile.tenant_id // Agregar tenant_id para aislamiento multi-tenant
        });

      if (error) throw error;

      setNewMessage('');
      loadConversations();
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Error al enviar el mensaje');
    } finally {
      setSending(false);
    }
  };

  const getAvailableAdmins = async () => {
    if (!profile?.id) return [];

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .in('role', ['admin', 'support'])
        .neq('id', profile.id)
        .order('full_name');

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error loading admins:', error);
      return [];
    }
  };

  const startConversation = async (adminId: string) => {
    setSelectedConversation(adminId);
    await loadConversations();
    setShowAdminsList(false);
  };

  const filteredConversations = conversations.filter(conv =>
    conv.other_user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    conv.other_user_email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedConversationData = conversations.find(c => c.other_user_id === selectedConversation);

  // Para usuarios normales, mostrar lista de admins disponibles si no hay conversaciones
  const isNormalUser = profile?.role === 'user';
  const [availableAdmins, setAvailableAdmins] = useState<any[]>([]);
  const [showAdminsList, setShowAdminsList] = useState(false);

  useEffect(() => {
    if (isNormalUser && conversations.length === 0 && !selectedConversation) {
      getAvailableAdmins().then(setAvailableAdmins);
      setShowAdminsList(true);
    } else if (conversations.length > 0) {
      setShowAdminsList(false);
    }
  }, [isNormalUser, conversations.length, selectedConversation]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-500">Cargando conversaciones...</div>
      </div>
    );
  }

  const [showConversationsList, setShowConversationsList] = useState(false);

  // En desktop, siempre mostrar la lista
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setShowConversationsList(true);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700">
      <div className="flex h-full relative" style={{ minHeight: '600px' }}>
        {/* Overlay para móvil */}
        {showConversationsList && (
          <div 
            className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-10"
            onClick={() => setShowConversationsList(false)}
          />
        )}

        {/* Lista de conversaciones */}
        <div className={`${showConversationsList ? 'flex' : 'hidden'} lg:flex fixed lg:relative inset-y-0 left-0 lg:inset-auto z-20 lg:z-auto w-full lg:w-80 border-r border-gray-200 dark:border-slate-700 flex-col bg-white dark:bg-slate-800 shadow-lg lg:shadow-none`}>
          <div className="p-3 sm:p-4 border-b border-gray-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">Mensajes Directos</h2>
              <button
                onClick={() => setShowConversationsList(false)}
                className="lg:hidden p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 sm:left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
              <input
                type="text"
                placeholder="Buscar conversaciones..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 sm:pl-10 pr-3 sm:pr-4 py-1.5 sm:py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto messages-scroll">
            {showAdminsList && availableAdmins.length > 0 ? (
              <div className="p-4">
                <p className="text-sm text-gray-600 mb-3">Iniciar conversación con:</p>
                {availableAdmins.map((admin) => (
                  <button
                    key={admin.id}
                    onClick={() => startConversation(admin.id)}
                    className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition mb-2"
                  >
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <User className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-medium text-gray-900">{admin.full_name}</p>
                      <p className="text-xs text-gray-500">{admin.role === 'admin' ? 'Administrador' : 'Soporte'}</p>
                    </div>
                  </button>
                ))}
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                <MessageSquare className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>No hay conversaciones</p>
                {isNormalUser && (
                  <p className="text-sm mt-2">Inicia una conversación con un administrador o soporte</p>
                )}
              </div>
            ) : (
              <div>
                {filteredConversations.map((conv) => (
                  <button
                    key={conv.other_user_id}
                    onClick={() => {
                      setSelectedConversation(conv.other_user_id);
                      markAsRead(conv.other_user_id);
                      setShowConversationsList(false);
                    }}
                    className={`w-full flex items-center gap-2 sm:gap-3 p-3 sm:p-4 hover:bg-gray-50 dark:hover:bg-slate-700 transition ${
                      selectedConversation === conv.other_user_id ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-600' : ''
                    }`}
                  >
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <div className="flex items-center justify-between mb-0.5 sm:mb-1">
                        <p className="font-medium text-sm sm:text-base text-gray-900 dark:text-white truncate">{conv.other_user_name}</p>
                        {conv.unread_count > 0 && (
                          <span className="bg-blue-600 text-white text-[10px] sm:text-xs font-bold rounded-full w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center flex-shrink-0">
                            {conv.unread_count}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{conv.last_message || 'Sin mensajes'}</p>
                      <p className="text-[10px] sm:text-xs text-gray-400 dark:text-gray-500 mt-0.5 sm:mt-1">
                        {conv.last_message_at ? new Date(conv.last_message_at).toLocaleString('es-ES', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        }) : ''}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Área de chat */}
        <div className={`${showConversationsList ? 'hidden' : 'flex'} lg:flex flex-1 flex-col min-w-0 w-full`}>
          {selectedConversation ? (
            <>
              {/* Header del chat */}
              <div className="p-3 sm:p-4 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50">
                <div className="flex items-center gap-2 sm:gap-3">
                  <button
                    onClick={() => setShowConversationsList(true)}
                    className="lg:hidden p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm sm:text-base text-gray-900 dark:text-white truncate">{selectedConversationData?.other_user_name}</p>
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                      {selectedConversationData?.other_user_role === 'admin' ? 'Administrador' : 
                       selectedConversationData?.other_user_role === 'support' ? 'Soporte' : 'Usuario'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Mensajes */}
              <div
                ref={messagesContainerRef}
                className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4 messages-scroll"
                style={{ maxHeight: 'calc(100vh - 200px)' }}
              >
                {messages.length === 0 ? (
                  <div className="text-center text-gray-500 dark:text-gray-400 mt-6 sm:mt-8">
                    <MessageSquare className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
                    <p className="text-sm sm:text-base">No hay mensajes aún</p>
                    <p className="text-xs sm:text-sm mt-1">Envía el primer mensaje</p>
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
                          className={`max-w-[75%] sm:max-w-xs lg:max-w-md px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg ${
                            isMine
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 dark:bg-slate-700 text-gray-900 dark:text-white'
                          }`}
                        >
                          <p className="text-xs sm:text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                          <p
                            className={`text-[10px] sm:text-xs mt-1 ${
                              isMine ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'
                            }`}
                          >
                            {new Date(msg.created_at).toLocaleString('es-ES', {
                              day: '2-digit',
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                            {!isMine && !msg.is_read && (
                              <span className="ml-2">●</span>
                            )}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input de mensaje */}
              <div className="p-3 sm:p-4 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50">
                <div className="flex gap-1.5 sm:gap-2">
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
                    className="flex-1 px-3 sm:px-4 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm sm:text-base"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!newMessage.trim() || sending}
                    className="px-3 sm:px-4 lg:px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base"
                  >
                    <Send className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span className="hidden sm:inline">Enviar</span>
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400 p-4">
              <div className="text-center">
                <MessageSquare className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 text-gray-300 dark:text-gray-600" />
                <p className="text-base sm:text-lg font-medium">Selecciona una conversación</p>
                <p className="text-xs sm:text-sm mt-2">Elige una conversación de la lista para comenzar a chatear</p>
                <button
                  onClick={() => setShowConversationsList(true)}
                  className="lg:hidden mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  Ver conversaciones
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

