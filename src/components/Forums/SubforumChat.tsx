import { useEffect, useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { ArrowLeft, Send, Paperclip, X, Download, FileText, Search, Filter, Trash2, Edit2, Check, X as XIcon } from 'lucide-react';
import { MentionAutocomplete } from './MentionAutocomplete';
import { EmojiPicker } from '../EmojiPicker';

interface Attachment {
  name: string;
  path: string;
  size: number;
  type: string;
}

interface Message {
  id: string;
  content: string;
  created_at: string;
  created_by: string;
  attachments: Attachment[];
  profiles: {
    full_name: string;
    role: string;
  };
}

interface MentionedUser {
  id: string;
  full_name: string;
}

interface Subforum {
  id: string;
  name: string;
  description: string | null;
  client_name: string;
}

interface SubforumChatProps {
  subforumId: string;
  onBack: () => void;
}

export function SubforumChat({ subforumId, onBack }: SubforumChatProps) {
  const { profile } = useAuth();
  const [subforum, setSubforum] = useState<Subforum | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showFileSearch, setShowFileSearch] = useState(false);
  const [fileSearchTerm, setFileSearchTerm] = useState('');
  const [deletingMessage, setDeletingMessage] = useState<string | null>(null);
  const [editingMessage, setEditingMessage] = useState<string | null>(null);
  const [editMessageContent, setEditMessageContent] = useState('');
  const [updatingMessage, setUpdatingMessage] = useState(false);
  const [showDeleteForumConfirm, setShowDeleteForumConfirm] = useState(false);
  const [showMentionAutocomplete, setShowMentionAutocomplete] = useState(false);
  const [mentionSearchTerm, setMentionSearchTerm] = useState('');
  const [mentionCursorPosition, setMentionCursorPosition] = useState(0);
  const [mentionSelectedIndex, setMentionSelectedIndex] = useState(0);
  const [mentionedUsers, setMentionedUsers] = useState<Map<string, MentionedUser>>(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const canModerate = profile?.role === 'admin' || profile?.role === 'support';

  useEffect(() => {
    loadSubforumData();

    const channel = supabase
      .channel(`subforum-messages-${subforumId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'forum_messages',
          filter: `subforum_id=eq.${subforumId}`,
        },
        async (payload: any) => {
          console.log('New message received:', payload);

          const { data: newMessageData } = await supabase
            .from('forum_messages')
            .select(`
              id,
              content,
              created_at,
              created_by,
              attachments,
              profiles:created_by(full_name, role)
            `)
            .eq('id', payload.new.id)
            .single();

          if (newMessageData) {
            setMessages((prev) => [...prev, newMessageData as unknown as Message]);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'forum_messages',
          filter: `subforum_id=eq.${subforumId}`,
        },
        (payload: any) => {
          console.log('Message updated:', payload);
          // Actualizar el contenido del mensaje editado
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === payload.new.id ? { ...msg, content: payload.new.content } : msg
            )
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'forum_messages',
          filter: `subforum_id=eq.${subforumId}`,
        },
        (payload: any) => {
          console.log('Message deleted:', payload);
          // Eliminar el mensaje de la lista
          if (payload.old && payload.old.id) {
            setMessages((prev) => prev.filter((msg) => msg.id !== payload.old.id));
          }
        }
      )
      .subscribe(() => {
        // Subscription active
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [subforumId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadSubforumData = async () => {
    try {
      const { data: forumData } = await supabase
        .from('subforums')
        .select('*')
        .eq('id', subforumId)
        .single();

      if (forumData) {
        setSubforum(forumData);
      }

      await loadMessages();
    } catch (error) {
      console.error('Error loading subforum:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async () => {
    const { data } = await supabase
      .from('forum_messages')
      .select(`
        id,
        content,
        created_at,
        created_by,
        attachments,
        profiles:created_by(full_name, role)
      `)
      .eq('subforum_id', subforumId)
      .order('created_at', { ascending: true });

    if (data) {
      setMessages(data as unknown as Message[]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedFiles((prev) => [...prev, ...files]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadFiles = async (): Promise<Attachment[]> => {
    if (selectedFiles.length === 0) return [];

    setUploading(true);
    const attachments: Attachment[] = [];

    try {
      for (const file of selectedFiles) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${profile?.id}/${Date.now()}-${Math.random()
          .toString(36)
          .substring(7)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('ticket-attachments')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        attachments.push({
          name: file.name,
          path: fileName,
          size: file.size,
          type: file.type,
        });
      }
    } finally {
      setUploading(false);
    }

    return attachments;
  };

  // Función para extraer menciones del texto
  const extractMentions = (text: string): string[] => {
    const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
    const userIds: string[] = [];
    let match;

    while ((match = mentionRegex.exec(text)) !== null) {
      const userId = match[2]; // El segundo grupo captura el user_id
      userIds.push(userId);
      console.log(`🔍 Encontrada mención: @${match[1]} -> ${userId}`);
    }

    const uniqueIds = [...new Set(userIds)]; // Eliminar duplicados
    console.log(`📋 User IDs únicos extraídos:`, uniqueIds);
    return uniqueIds;
  };

  // Función para reemplazar @nombre con formato de mención
  const formatMentions = async (text: string): Promise<string> => {
    // Reemplazar @Nombre Usuario con @[Nombre Usuario](user_id)
    let formatted = text;
    
    // Si el texto ya tiene menciones formateadas, no hacer nada
    if (/@\[([^\]]+)\]\([^)]+\)/.test(formatted)) {
      console.log('📝 El mensaje ya tiene menciones formateadas');
      return formatted;
    }
    
    // Obtener usuarios accesibles al subforo para buscar menciones por nombre
    try {
      const { data: accessibleUsers, error: usersError } = await supabase.rpc('get_subforum_accessible_users', {
        p_subforum_id: subforumId,
      });
      
      if (usersError) {
        console.error('❌ Error al obtener usuarios accesibles:', usersError);
        // Si falla, intentar con el Map existente
        if (mentionedUsers.size > 0) {
          mentionedUsers.forEach((user, userId) => {
            const escapedName = user.full_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`@${escapedName}(?=\\s|$|\\n|\\r)`, 'gi');
            formatted = formatted.replace(regex, `@[${user.full_name}](${userId})`);
          });
        }
        return formatted;
      }
      
      // Buscar menciones en el texto y reemplazarlas
      const mentionPattern = /@(\w+(?:\s+\w+)*)/g;
      let match;
      const processedMentions = new Set<string>();
      
      while ((match = mentionPattern.exec(text)) !== null) {
        const mentionText = match[1].trim(); // Nombre después del @
        
        // Evitar procesar la misma mención dos veces
        if (processedMentions.has(mentionText.toLowerCase())) continue;
        processedMentions.add(mentionText.toLowerCase());
        
        // Buscar usuario por nombre (coincidencia exacta o parcial)
        const matchedUser = accessibleUsers?.find((user: any) => 
          user.full_name.toLowerCase() === mentionText.toLowerCase() ||
          user.full_name.toLowerCase().startsWith(mentionText.toLowerCase() + ' ') ||
          user.full_name.toLowerCase().endsWith(' ' + mentionText.toLowerCase())
        );
        
        if (matchedUser) {
          // Reemplazar @Nombre con @[Nombre](user_id)
          const escapedName = mentionText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(`@${escapedName}(?=\\s|$|\\n|\\r)`, 'gi');
          formatted = formatted.replace(regex, `@[${matchedUser.full_name}](${matchedUser.id})`);
          console.log(`✅ Reemplazado: @${mentionText} -> @[${matchedUser.full_name}](${matchedUser.id})`);
          
          // También agregar al Map para consistencia
          setMentionedUsers((prev) => {
            const updated = new Map(prev);
            updated.set(matchedUser.id, { id: matchedUser.id, full_name: matchedUser.full_name });
            return updated;
          });
        } else {
          console.warn(`⚠️ No se encontró usuario para: @${mentionText}`);
        }
      }
      
      // También procesar usuarios del Map (por si acaso)
      if (mentionedUsers.size > 0) {
        mentionedUsers.forEach((user, userId) => {
          const escapedName = user.full_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(`@${escapedName}(?=\\s|$|\\n|\\r)`, 'gi');
          const beforeReplace = formatted;
          formatted = formatted.replace(regex, `@[${user.full_name}](${userId})`);
          if (beforeReplace !== formatted) {
            console.log(`✅ Reemplazado desde Map: @${user.full_name} -> @[${user.full_name}](${userId})`);
          }
        });
      }
      
    } catch (error) {
      console.error('❌ Error en formatMentions:', error);
    }
    
    return formatted;
  };

  // Función para renderizar menciones en el mensaje
  const renderMessageWithMentions = (content: string) => {
    const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
    const parts: (string | JSX.Element)[] = [];
    let lastIndex = 0;
    let match;

    while ((match = mentionRegex.exec(content)) !== null) {
      // Agregar texto antes de la mención
      if (match.index > lastIndex) {
        parts.push(content.substring(lastIndex, match.index));
      }

      // Agregar la mención resaltada
      parts.push(
        <span key={match.index} className="text-blue-600 font-medium bg-blue-50 px-1 rounded">
          @{match[1]}
        </span>
      );

      lastIndex = match.index + match[0].length;
    }

    // Agregar texto restante
    if (lastIndex < content.length) {
      parts.push(content.substring(lastIndex));
    }

    return parts.length > 0 ? parts : content;
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && selectedFiles.length === 0) || !profile?.id) return;

    setSubmitting(true);

    try {
      const attachments = await uploadFiles();

      // Formatear menciones en el mensaje
      console.log('📝 Mensaje original:', newMessage.trim());
      console.log('👥 Usuarios mencionados en Map:', Array.from(mentionedUsers.values()));
      const formattedMessage = await formatMentions(newMessage.trim());
      console.log('📝 Mensaje formateado:', formattedMessage);

      // Verificar que tenemos tenant_id
      if (!profile?.tenant_id) {
        throw new Error('No se pudo identificar la empresa');
      }

      // Insertar mensaje
      const { data: messageData, error } = await supabase
        .from('forum_messages')
        .insert({
          subforum_id: subforumId,
          content: formattedMessage,
          created_by: profile.id,
          tenant_id: profile.tenant_id, // Agregar tenant_id para aislamiento multi-tenant
          attachments,
        })
        .select()
        .single();

      if (error) throw error;

      // Extraer menciones y crear notificaciones
      const mentionedUserIds = extractMentions(formattedMessage);
      console.log('🔍 User IDs extraídos de menciones:', mentionedUserIds);
      
      if (mentionedUserIds.length > 0 && messageData) {
        const messagePreview = formattedMessage.substring(0, 100);
        console.log('📧 Creando notificaciones para:', mentionedUserIds);
        const { error: notificationError } = await supabase.rpc('create_forum_mention_notifications', {
          p_subforum_id: subforumId,
          p_mentioned_user_ids: mentionedUserIds,
          p_mentioner_id: profile.id,
          p_message_preview: messagePreview.length < formattedMessage.length 
            ? messagePreview + '...' 
            : messagePreview,
        });
        
        if (notificationError) {
          console.error('❌ Error al crear notificaciones de menciones:', notificationError);
        } else {
          console.log('✅ Notificaciones de menciones creadas para usuarios:', mentionedUserIds);
        }
      } else {
        console.warn('⚠️ No se encontraron menciones o no hay messageData. Menciones extraídas:', mentionedUserIds.length, 'MessageData:', !!messageData);
      }

      setNewMessage('');
      setSelectedFiles([]);
      setMentionedUsers(new Map());
      setShowMentionAutocomplete(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const downloadFile = (attachment: Attachment) => {
    const { data } = supabase.storage
      .from('ticket-attachments')
      .getPublicUrl(attachment.path);

    window.open(data.publicUrl, '_blank');
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const getAllAttachments = (): (Attachment & { messageId: string; date: string; author: string })[] => {
    const allAttachments: (Attachment & { messageId: string; date: string; author: string })[] = [];

    messages.forEach((message) => {
      if (message.attachments && message.attachments.length > 0) {
        message.attachments.forEach((attachment) => {
          allAttachments.push({
            ...attachment,
            messageId: message.id,
            date: message.created_at,
            author: message.profiles.full_name,
          });
        });
      }
    });

    return allAttachments;
  };

  const filteredAttachments = getAllAttachments().filter((attachment) =>
    attachment.name.toLowerCase().includes(fileSearchTerm.toLowerCase())
  );

  const handleDeleteMessage = async (messageId: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este mensaje?')) return;

    setDeletingMessage(messageId);
    try {
      console.log('Deleting message:', messageId);
      
      const { data, error } = await supabase
        .from('forum_messages')
        .delete()
        .eq('id', messageId)
        .select('id');

      if (error) {
        console.error('Error deleting message:', error);
        alert(`Error al eliminar el mensaje: ${error.message}`);
        setDeletingMessage(null);
        return;
      }

      if (!data || data.length === 0) {
        console.error('No rows deleted - possible RLS issue');
        alert('No se pudo eliminar el mensaje. Verifica que tengas permisos para eliminar este mensaje.');
        setDeletingMessage(null);
        return;
      }

      console.log('Message deleted successfully:', data);

      setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
    } catch (error: any) {
      console.error('Error deleting message:', error);
      alert(`Error al eliminar el mensaje: ${error?.message || 'Error desconocido'}`);
    } finally {
      setDeletingMessage(null);
    }
  };

  const handleStartEdit = (message: Message) => {
    setEditingMessage(message.id);
    setEditMessageContent(message.content);
  };

  const handleCancelEdit = () => {
    setEditingMessage(null);
    setEditMessageContent('');
  };

  const handleUpdateMessage = async (messageId: string) => {
    if (!editMessageContent.trim()) return;

    setUpdatingMessage(true);
    try {
      console.log('Updating message:', { messageId, content: editMessageContent.trim() });
      
      // Primero actualizar el mensaje
      const { data: updateData, error: updateError } = await supabase
        .from('forum_messages')
        .update({ content: editMessageContent.trim() })
        .eq('id', messageId)
        .select('id');

      if (updateError) {
        console.error('Error updating message:', updateError);
        alert(`Error al actualizar el mensaje: ${updateError.message}`);
        setUpdatingMessage(false);
        return;
      }

      if (!updateData || updateData.length === 0) {
        console.error('No rows updated - possible RLS issue');
        alert('No se pudo actualizar el mensaje. Verifica que tengas permisos para editar este mensaje.');
        setUpdatingMessage(false);
        return;
      }

      console.log('Message updated successfully:', updateData);

      // Luego obtener el mensaje actualizado con sus relaciones
      const { data, error: selectError } = await supabase
        .from('forum_messages')
        .select(`
          id,
          content,
          created_at,
          created_by,
          attachments,
          profiles:created_by(full_name, role)
        `)
        .eq('id', messageId)
        .single();

      if (selectError) {
        console.error('Error fetching updated message:', selectError);
        // Aún así actualizar el estado local con el contenido editado
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId ? { ...msg, content: editMessageContent.trim() } : msg
          )
        );
      } else if (data) {
        console.log('Fetched updated message:', data);
        // Actualizar el estado local con los datos de la base de datos
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId ? data as unknown as Message : msg
          )
        );
      }

      setEditingMessage(null);
      setEditMessageContent('');
    } catch (error: any) {
      console.error('Error updating message:', error);
      alert(`Error al actualizar el mensaje: ${error?.message || 'Error desconocido'}`);
    } finally {
      setUpdatingMessage(false);
    }
  };

  const handleDeleteForum = async () => {
    try {
      const { error } = await supabase.rpc('delete_subforum', {
        subforum_uuid: subforumId,
      });

      if (error) throw error;

      onBack();
    } catch (error) {
      console.error('Error deleting subforum:', error);
      alert('Error al eliminar el subforo: ' + (error as Error).message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)]">
      <div className="mb-4 sm:mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 sm:gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-3 sm:mb-4 text-sm sm:text-base"
        >
          <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="hidden sm:inline">Volver a Foros</span>
          <span className="sm:hidden">Volver</span>
        </button>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex-1 min-w-0">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 dark:text-white truncate">{subforum?.name}</h2>
            {subforum?.description && (
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 mt-1 line-clamp-2">{subforum.description}</p>
            )}
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">Cliente: {subforum?.client_name}</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <button
              onClick={() => setShowFileSearch(!showFileSearch)}
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-lg transition font-medium text-gray-700 dark:text-gray-300 text-xs sm:text-sm"
            >
              <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Buscar Archivos</span>
              <span className="sm:hidden">Archivos</span>
              <span className="ml-0.5 sm:ml-0">({getAllAttachments().length})</span>
            </button>
            {canModerate && (
              <button
                onClick={() => setShowDeleteForumConfirm(true)}
                className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/30 rounded-lg transition font-medium text-xs sm:text-sm"
                title="Eliminar subforo"
              >
                <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Eliminar Subforo</span>
                <span className="sm:hidden">Eliminar</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 flex flex-col overflow-hidden relative">
        {showFileSearch && (
          <div className="absolute top-0 left-0 right-0 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 z-10 shadow-md">
            <div className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <Filter className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                <h3 className="font-semibold text-gray-900 dark:text-white">Buscador de Archivos</h3>
                <button
                  onClick={() => setShowFileSearch(false)}
                  className="ml-auto text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <input
                type="text"
                placeholder="Buscar por nombre de archivo..."
                value={fileSearchTerm}
                onChange={(e) => setFileSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-3"
              />

              <div className="max-h-48 overflow-y-auto space-y-2 forums-scroll">
                {filteredAttachments.length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-4 text-sm">
                    {fileSearchTerm ? 'No se encontraron archivos' : 'No hay archivos en este foro'}
                  </p>
                ) : (
                  filteredAttachments.map((attachment, idx) => (
                    <button
                      key={idx}
                      onClick={() => downloadFile(attachment)}
                      className="w-full flex items-center gap-3 px-3 py-2 bg-gray-50 dark:bg-slate-700 hover:bg-gray-100 dark:hover:bg-slate-600 border border-gray-200 dark:border-slate-600 rounded-lg text-sm transition group"
                    >
                      <FileText className="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                      <div className="flex-1 text-left min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white truncate">{attachment.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {attachment.author} • {new Date(attachment.date).toLocaleDateString('es-ES')} •{' '}
                          {formatFileSize(attachment.size)}
                        </p>
                      </div>
                      <Download className="w-4 h-4 text-gray-400 dark:text-gray-500 group-hover:text-blue-600 dark:group-hover:text-blue-400 flex-shrink-0" />
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4 forums-scroll">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 text-center px-4">No hay mensajes aún. Sé el primero en escribir!</p>
            </div>
          ) : (
            messages.map((message) => (
              <div key={message.id} className="flex gap-2 sm:gap-3 group">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-600 dark:text-blue-400 font-semibold text-xs sm:text-sm">
                    {message.profiles.full_name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0 flex gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1.5 sm:gap-2 mb-0.5 sm:mb-1 flex-wrap">
                      <span className="font-semibold text-sm sm:text-base text-gray-900 dark:text-white truncate">
                        {message.profiles.full_name}
                      </span>
                      <span
                        className={`text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full flex-shrink-0 ${
                          message.profiles.role === 'admin'
                            ? 'bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300'
                            : message.profiles.role === 'support'
                            ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {message.profiles.role === 'admin'
                          ? 'Admin'
                          : message.profiles.role === 'support'
                          ? 'Soporte'
                          : 'Usuario'}
                      </span>
                      <span className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                        {new Date(message.created_at).toLocaleString('es-ES', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                    {editingMessage === message.id ? (
                      <textarea
                        value={editMessageContent}
                        onChange={(e) => setEditMessageContent(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                            e.preventDefault();
                            handleUpdateMessage(message.id);
                          } else if (e.key === 'Escape') {
                            e.preventDefault();
                            handleCancelEdit();
                          }
                        }}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm sm:text-base"
                        rows={3}
                        autoFocus
                      />
                    ) : (
                      <p className="text-sm sm:text-base text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
                        {renderMessageWithMentions(message.content)}
                      </p>
                    )}
                    {message.attachments && message.attachments.length > 0 && (
                      <div className="mt-2 space-y-2">
                        {message.attachments.map((attachment, idx) => (
                          <button
                            key={idx}
                            onClick={() => downloadFile(attachment)}
                            className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-slate-700 hover:bg-gray-100 dark:hover:bg-slate-600 border border-gray-200 dark:border-slate-600 rounded-lg text-sm transition group"
                          >
                            <FileText className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                            <span className="text-gray-700 dark:text-gray-300 flex-1 text-left">{attachment.name}</span>
                            <span className="text-gray-500 dark:text-gray-400 text-xs">{formatFileSize(attachment.size)}</span>
                            <Download className="w-4 h-4 text-gray-400 dark:text-gray-500 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {(canModerate || message.created_by === profile?.id) && (
                    <div className="flex flex-col items-start gap-1 flex-shrink-0 pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {editingMessage === message.id ? (
                        <>
                          <button
                            onClick={() => handleUpdateMessage(message.id)}
                            disabled={updatingMessage}
                            className="bg-green-600/80 dark:bg-green-500/80 hover:bg-green-700/90 dark:hover:bg-green-600/90 text-white rounded transition p-1 disabled:opacity-50 backdrop-blur-sm"
                            title="Guardar cambios"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            disabled={updatingMessage}
                            className="bg-gray-200/80 dark:bg-gray-700/80 hover:bg-gray-300/90 dark:hover:bg-gray-600/90 text-gray-700 dark:text-gray-300 rounded transition p-1 disabled:opacity-50 backdrop-blur-sm"
                            title="Cancelar edición"
                          >
                            <XIcon className="w-3 h-3" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleStartEdit(message)}
                            className="bg-blue-600/80 dark:bg-blue-500/80 hover:bg-blue-700/90 dark:hover:bg-blue-600/90 text-white rounded transition p-1 backdrop-blur-sm"
                            title="Editar mensaje"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleDeleteMessage(message.id)}
                            disabled={deletingMessage === message.id}
                            className="bg-red-600/80 dark:bg-red-500/80 hover:bg-red-700/90 dark:hover:bg-red-600/90 text-white rounded transition p-1 disabled:opacity-50 backdrop-blur-sm"
                            title="Eliminar mensaje"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSendMessage} className="border-t border-gray-200 dark:border-slate-700 p-3 sm:p-4">
          {selectedFiles.length > 0 && (
            <div className="mb-2 sm:mb-3 space-y-1.5 sm:space-y-2">
              {selectedFiles.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg"
                >
                  <Paperclip className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                  <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 flex-1 truncate">{file.name}</span>
                  <span className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">{formatFileSize(file.size)}</span>
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    className="text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition flex-shrink-0"
                  >
                    <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-end gap-1.5 sm:gap-2 relative">
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={newMessage}
                onChange={(e) => {
                  const value = e.target.value;
                  const cursorPos = e.target.selectionStart || 0;
                  setNewMessage(value);

                  // Detectar @ para mostrar autocompletado
                  const textBeforeCursor = value.substring(0, cursorPos);
                  const lastAtIndex = textBeforeCursor.lastIndexOf('@');
                  
                    if (lastAtIndex !== -1) {
                      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
                      // Si no hay espacio después del @, mostrar autocompletado
                      if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
                        setMentionSearchTerm(textAfterAt);
                        setMentionCursorPosition(cursorPos);
                        setShowMentionAutocomplete(true);
                        // Resetear índice cuando se detecta un nuevo @
                        if (textAfterAt === '') {
                          setMentionSelectedIndex(0);
                        }
                      } else {
                        setShowMentionAutocomplete(false);
                        setMentionSearchTerm('');
                        setMentionSelectedIndex(0);
                      }
                    } else {
                      setShowMentionAutocomplete(false);
                      setMentionSearchTerm('');
                      setMentionSelectedIndex(0);
                    }
                }}
                onKeyDown={(e) => {
                  // Si el autocompletado está visible, manejar teclas especiales
                  if (showMentionAutocomplete) {
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      setShowMentionAutocomplete(false);
                    } else if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setMentionSelectedIndex((prev) => {
                        // El límite se manejará en MentionAutocomplete
                        return prev + 1;
                      });
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setMentionSelectedIndex((prev) => Math.max(0, prev - 1));
                    } else if (e.key === 'Enter') {
                      e.preventDefault();
                      // Intentar seleccionar usuario del autocompletado si hay uno disponible
                      const selectFunction = (window as any).__mentionAutocompleteSelect;
                      if (selectFunction && typeof selectFunction === 'function') {
                        selectFunction();
                      } else {
                        // Si no hay función disponible, cerrar autocompletado y enviar mensaje
                        setShowMentionAutocomplete(false);
                        // Permitir que el formulario se envíe normalmente
                        const form = textareaRef.current?.closest('form');
                        if (form) {
                          form.requestSubmit();
                        }
                      }
                    }
                  }
                }}
                onBlur={() => {
                  // Cerrar autocompletado al perder foco (con delay para permitir click en autocompletado)
                  setTimeout(() => setShowMentionAutocomplete(false), 200);
                }}
                placeholder="Escribe un mensaje... (usa @ para mencionar)"
                rows={2}
                className="w-full px-3 sm:px-4 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm sm:text-base"
              />
              {showMentionAutocomplete && (
                <MentionAutocomplete
                  subforumId={subforumId}
                  searchTerm={mentionSearchTerm}
                  cursorPosition={mentionCursorPosition}
                  selectedIndex={mentionSelectedIndex}
                  onNavigate={(direction, maxIndex) => {
                    if (direction === 'down') {
                      setMentionSelectedIndex((prev) => Math.min(maxIndex, prev + 1));
                    } else {
                      setMentionSelectedIndex((prev) => Math.max(0, prev - 1));
                    }
                  }}
                  onSelect={(user) => {
                    const textarea = textareaRef.current;
                    if (!textarea) return;

                    const currentCursorPos = textarea.selectionStart || 0;
                    const textBeforeCursor = newMessage.substring(0, currentCursorPos);
                    const textAfterCursor = newMessage.substring(currentCursorPos);
                    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
                    
                    if (lastAtIndex !== -1) {
                      // Reemplazar desde el @ hasta la posición actual del cursor
                      const textBeforeAt = newMessage.substring(0, lastAtIndex);
                      const newText = 
                        textBeforeAt +
                        `@${user.full_name} ` +
                        textAfterCursor;
                      
                      setNewMessage(newText);
                      setMentionedUsers((prev) => {
                        const updated = new Map(prev);
                        updated.set(user.id, { id: user.id, full_name: user.full_name });
                        return updated;
                      });
                      setShowMentionAutocomplete(false);
                      setMentionSearchTerm('');
                      setMentionSelectedIndex(0);
                      
                      // Restaurar foco y posición del cursor
                      setTimeout(() => {
                        if (textarea) {
                          const newCursorPos = textBeforeAt.length + user.full_name.length + 2; // +2 por @ y espacio
                          textarea.focus();
                          textarea.setSelectionRange(newCursorPos, newCursorPos);
                        }
                      }, 0);
                    }
                  }}
                  onClose={() => setShowMentionAutocomplete(false)}
                />
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              className="hidden"
              id="forum-file-upload"
            />
            <label
              htmlFor="forum-file-upload"
              className="px-2.5 sm:px-3 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-lg transition cursor-pointer flex-shrink-0"
            >
              <Paperclip className="w-4 h-4 sm:w-5 sm:h-5" />
            </label>
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
              type="submit"
              disabled={submitting || uploading || (!newMessage.trim() && selectedFiles.length === 0)}
              className="px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base"
            >
              <Send className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">{uploading ? 'Subiendo...' : submitting ? 'Enviando...' : 'Enviar'}</span>
              <span className="sm:hidden">{uploading ? 'Subiendo...' : submitting ? 'Enviando...' : 'Enviar'}</span>
            </button>
          </div>
        </form>
      </div>

      {showDeleteForumConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-0 sm:p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-none sm:rounded-xl shadow-xl max-w-md w-full h-full sm:h-auto p-4 sm:p-6">
            <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 sm:w-6 sm:h-6 text-red-600 dark:text-red-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">Eliminar Subforo</h3>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Esta acción no se puede deshacer</p>
              </div>
            </div>

            <p className="text-sm sm:text-base text-gray-700 dark:text-gray-300 mb-4 sm:mb-6">
              ¿Estás seguro de que deseas eliminar el subforo <strong className="text-gray-900 dark:text-white">{subforum?.name}</strong>?
              Todos los mensajes y archivos se perderán permanentemente.
            </p>

            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3">
              <button
                onClick={() => setShowDeleteForumConfirm(false)}
                className="flex-1 px-3 sm:px-4 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition font-medium text-sm sm:text-base"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  setShowDeleteForumConfirm(false);
                  handleDeleteForum();
                }}
                className="flex-1 px-3 sm:px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium text-sm sm:text-base"
              >
                Eliminar Subforo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
