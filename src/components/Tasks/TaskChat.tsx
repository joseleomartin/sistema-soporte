import { useState, useEffect, useRef } from 'react';
import { Send, Paperclip, Download, X, FileText, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { TaskMentionAutocomplete } from './TaskMentionAutocomplete';
import { EmojiPicker } from '../EmojiPicker';

interface Message {
  id: string;
  task_id: string;
  user_id: string;
  message: string;
  created_at: string;
  profiles: {
    full_name: string;
    avatar_url: string | null;
  };
  task_attachments: Attachment[];
}

interface Attachment {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  file_type: string;
}

interface TaskChatProps {
  taskId: string;
}

export function TaskChat({ taskId }: TaskChatProps) {
  const { profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const channelRef = useRef<any>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Estados para menciones
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionPosition, setMentionPosition] = useState(0);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const [mentionedUsers, setMentionedUsers] = useState<Map<string, { id: string; full_name: string }>>(new Map());

  useEffect(() => {
    fetchMessages();
    const channel = subscribeToMessages();
    channelRef.current = channel;

    return () => {
      // Cleanup: unsubscribe cuando el componente se desmonte o cambie el taskId
      if (channelRef.current) {
        console.log('🔌 Unsubscribing from task_messages channel');
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [taskId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchMessages = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('task_messages')
        .select(`
          *,
          profiles!task_messages_user_id_fkey (
            full_name,
            avatar_url
          ),
          task_attachments (
            id,
            file_name,
            file_path,
            file_size,
            file_type
          )
        `)
        .eq('task_id', taskId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToMessages = () => {
    console.log('🔔 Subscribing to task_messages for task:', taskId);
    
    const channel = supabase
      .channel(`task_messages:${taskId}:${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'task_messages',
          filter: `task_id=eq.${taskId}`
        },
        async (payload) => {
          console.log('📨 New message received via Realtime:', payload);
          
          try {
            // Esperar un poco para que los archivos se suban (si hay)
            // Si el mensaje está vacío o es muy corto, probablemente tiene archivos
            const messageText = payload.new.message as string;
            const hasAttachment = !messageText || messageText.trim() === '' || messageText.length < 10;
            const delay = hasAttachment ? 1000 : 300; // 1 segundo si hay archivo, 300ms si no
            
            await new Promise(resolve => setTimeout(resolve, delay));
            
            // Fetch el mensaje completo con relaciones (con retry si hay archivos)
            let data, error;
            let retries = hasAttachment ? 3 : 1;
            
            for (let i = 0; i < retries; i++) {
              const result = await supabase
              .from('task_messages')
              .select(`
                *,
                profiles!task_messages_user_id_fkey (
                  full_name,
                  avatar_url
                ),
                task_attachments (
                  id,
                  file_name,
                  file_path,
                  file_size,
                  file_type
                )
              `)
              .eq('id', payload.new.id)
              .single();
              
              data = result.data;
              error = result.error;
              
              // Si hay archivos y no se encontraron, esperar un poco más y reintentar
              if (hasAttachment && !error && (!data?.task_attachments || data.task_attachments.length === 0) && i < retries - 1) {
                await new Promise(resolve => setTimeout(resolve, 500));
                continue;
              }
              
              break;
            }

            if (error) {
              console.error('❌ Error fetching new message:', error);
              return;
            }

            if (data) {
              console.log('✅ Adding message to state:', data);
              setMessages((prev) => {
                // Evitar duplicados
                if (prev.some(msg => msg.id === data.id)) {
                  console.log('⚠️ Message already exists, skipping');
                  return prev;
                }
                return [...prev, data];
              });
            }
          } catch (error) {
            console.error('❌ Error in Realtime handler:', error);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'task_attachments',
          filter: `task_id=eq.${taskId}`
        },
        async (payload) => {
          console.log('📎 New attachment received via Realtime:', payload);
          
          try {
            // Actualizar el mensaje correspondiente para incluir el nuevo archivo
            const attachment = payload.new;
            if (attachment.message_id) {
              setMessages((prev) => {
                return prev.map((msg) => {
                  if (msg.id === attachment.message_id) {
                    // Verificar si el archivo ya existe
                    const attachmentExists = msg.task_attachments?.some(
                      (att) => att.id === attachment.id
                    );
                    
                    if (!attachmentExists) {
                      return {
                        ...msg,
                        task_attachments: [
                          ...(msg.task_attachments || []),
                          {
                            id: attachment.id,
                            file_name: attachment.file_name,
                            file_path: attachment.file_path,
                            file_size: attachment.file_size,
                            file_type: attachment.file_type,
                          },
                        ],
                      };
                    }
                  }
                  return msg;
                });
              });
            }
          } catch (error) {
            console.error('❌ Error updating message with attachment:', error);
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ Successfully subscribed to task_messages and task_attachments');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Channel subscription error');
        } else if (status === 'TIMED_OUT') {
          console.error('❌ Subscription timed out');
        }
      });

    return channel;
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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

  const uploadFile = async (file: File, messageId: string) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${taskId}/${fileName}`;

      // Subir archivo a Storage
      const { error: uploadError } = await supabase.storage
        .from('task-attachments')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Guardar metadata en la base de datos
      const { error: dbError } = await supabase
        .from('task_attachments')
        .insert([
          {
            task_id: taskId,
            message_id: messageId,
            file_name: file.name,
            file_path: filePath,
            file_size: file.size,
            file_type: file.type,
            uploaded_by: profile?.id
          }
        ]);

      if (dbError) throw dbError;
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  };

  const handleSend = async () => {
    if (!newMessage.trim() && selectedFiles.length === 0) return;
    if (!profile) return;

    try {
      setSending(true);

      // Convertir menciones visibles (@Nombre) al formato técnico (@[Nombre](user_id))
      const rawMessage = newMessage.trim() || '';
      const messageText = formatMentionsForStorage(rawMessage);

      // Crear mensaje
      const { data: messageData, error: messageError } = await supabase
        .from('task_messages')
        .insert([
          {
            task_id: taskId,
            user_id: profile.id,
            message: messageText
          }
        ])
        .select()
        .single();

      if (messageError) throw messageError;

      // Extraer menciones y crear notificaciones
      const mentionedUserIds = extractMentions(messageText);
      if (mentionedUserIds.length > 0 && messageData) {
        const messagePreview = messageText.substring(0, 100);
        await supabase.rpc('create_task_mention_notifications', {
          p_task_id: taskId,
          p_mentioned_user_ids: mentionedUserIds,
          p_mentioner_id: profile.id,
          p_message_preview: messagePreview.length < messageText.length 
            ? messagePreview + '...' 
            : messagePreview,
        });
      }

      // Subir archivos si hay
      if (selectedFiles.length > 0) {
        setUploading(true);
        for (const file of selectedFiles) {
          await uploadFile(file, messageData.id);
        }
      }

      setNewMessage('');
      setSelectedFiles([]);
      setMentionedUsers(new Map());
      setShowMentions(false);
      
      // Refrescar mensajes para mostrar archivos
      if (selectedFiles.length > 0) {
        await fetchMessages();
      }
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Error al enviar el mensaje');
    } finally {
      setSending(false);
      setUploading(false);
    }
  };

  const handleDownload = async (attachment: Attachment) => {
    try {
      const { data, error } = await supabase.storage
        .from('task-attachments')
        .download(attachment.file_path);

      if (error) throw error;

      // Crear URL y descargar
      const url = URL.createObjectURL(data);
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

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Funciones para manejar menciones
  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart;
    
    setNewMessage(value);
    
    // Buscar @ antes del cursor
    const textBeforeCursor = value.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex !== -1) {
      // Verificar que no haya espacio entre @ y el cursor
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      // No mostrar autocompletado si ya hay una mención completa (terminada con espacio o salto de línea)
      if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
        const searchTerm = textAfterAt;
        setMentionSearch(searchTerm);
        setMentionPosition(cursorPos);
        setShowMentions(true);
        setSelectedMentionIndex(0);
        return;
      }
    }
    
    setShowMentions(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMentions) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === 'Escape') {
        e.preventDefault();
        if (e.key === 'ArrowDown') {
          handleMentionNavigate('down', 9);
        } else if (e.key === 'ArrowUp') {
          handleMentionNavigate('up', 9);
        } else if (e.key === 'Enter') {
          // La selección se manejará en el componente de autocompletado
          // No hacer nada aquí, el componente TaskMentionAutocomplete manejará el Enter
          return;
        } else if (e.key === 'Escape') {
          setShowMentions(false);
        }
        return; // Prevenir comportamiento por defecto para estas teclas
      }
    }
    
    // Si no hay menciones abiertas, permitir Enter normal
    if (e.key === 'Enter' && !e.shiftKey && !showMentions) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleMentionSelect = (user: { id: string; full_name: string }) => {
    const textBeforeCursor = newMessage.substring(0, mentionPosition);
    const textAfterCursor = newMessage.substring(mentionPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    const beforeAt = newMessage.substring(0, lastAtIndex);
    const afterAt = newMessage.substring(mentionPosition);
    // Mostrar solo @Nombre en el textarea (sin el formato técnico)
    const newText = `${beforeAt}@${user.full_name} ${afterAt}`;
    
    // Guardar el usuario mencionado en el Map para poder convertirlo al formato técnico al enviar
    setMentionedUsers(prev => {
      const newMap = new Map(prev);
      newMap.set(`@${user.full_name}`, { id: user.id, full_name: user.full_name });
      return newMap;
    });
    
    setNewMessage(newText);
    setShowMentions(false);
    setMentionSearch('');
    
    // Restaurar el foco al textarea
    setTimeout(() => {
      textareaRef.current?.focus();
      const newCursorPos = lastAtIndex + user.full_name.length + 2; // +2 por @ y espacio
      textareaRef.current?.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const handleMentionNavigate = (direction: 'up' | 'down', maxIndex: number) => {
    if (direction === 'down') {
      setSelectedMentionIndex((prev) => (prev < maxIndex ? prev + 1 : prev));
    } else {
      setSelectedMentionIndex((prev) => (prev > 0 ? prev - 1 : 0));
    }
  };

  // Función para convertir menciones visibles (@Nombre) al formato técnico (@[Nombre](user_id))
  const formatMentionsForStorage = (text: string): string => {
    let formatted = text;
    mentionedUsers.forEach((user, mentionText) => {
      // Reemplazar @Nombre con @[Nombre](user_id)
      const regex = new RegExp(mentionText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      formatted = formatted.replace(regex, `@[${user.full_name}](${user.id})`);
    });
    return formatted;
  };

  // Función para extraer menciones del texto (formato @[Nombre](user_id))
  const extractMentions = (text: string): string[] => {
    const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
    const userIds: string[] = [];
    let match;

    while ((match = mentionRegex.exec(text)) !== null) {
      userIds.push(match[2]); // El segundo grupo captura el user_id
    }

    return [...new Set(userIds)]; // Eliminar duplicados
  };

  // Renderizar menciones en los mensajes
  const renderMessageWithMentions = (message: string, isOwn: boolean) => {
    // Buscar menciones en el formato @[Nombre](user_id)
    const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
    const parts: Array<{ text: string; isMention: boolean; mentionName?: string }> = [];
    let lastIndex = 0;
    let match;

    while ((match = mentionRegex.exec(message)) !== null) {
      // Agregar texto antes de la mención
      if (match.index > lastIndex) {
        parts.push({ text: message.substring(lastIndex, match.index), isMention: false });
      }
      
      // Agregar la mención (mostrar solo el nombre, no el formato completo)
      parts.push({ text: `@${match[1]}`, isMention: true, mentionName: match[1] });
      lastIndex = match.index + match[0].length;
    }

    // Agregar texto restante
    if (lastIndex < message.length) {
      parts.push({ text: message.substring(lastIndex), isMention: false });
    }

    // Si no hay menciones, devolver el texto normal
    if (parts.length === 0) {
      return <span>{message}</span>;
    }

    return (
      <>
        {parts.map((part, index) => 
          part.isMention ? (
            <span 
              key={index} 
              className={`font-semibold px-1 rounded ${
                isOwn 
                  ? 'text-indigo-200 bg-indigo-800' 
                  : 'text-indigo-700 bg-indigo-100'
              }`}
            >
              {part.text}
            </span>
          ) : (
            <span key={index}>{part.text}</span>
          )
        )}
      </>
    );
  };

  const getAvatarUrl = (avatarPath: string | null) => {
    if (!avatarPath) return null;
    
    // Si ya es una URL completa, usarla directamente
    if (avatarPath.startsWith('http://') || avatarPath.startsWith('https://')) {
      return avatarPath;
    }
    
    // Si es un path relativo, obtener la URL pública
    const { data } = supabase.storage
      .from('avatars')
      .getPublicUrl(avatarPath);
    
    return data.publicUrl;
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Mensajes */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <p>No hay mensajes aún</p>
            <p className="text-sm">Sé el primero en escribir</p>
          </div>
        ) : (
          messages.map((message) => {
            const isOwn = message.user_id === profile?.id;
            const avatarUrl = getAvatarUrl(message.profiles.avatar_url);

            return (
              <div
                key={message.id}
                className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}
              >
                {/* Avatar */}
                <div className="flex-shrink-0">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={message.profiles.full_name}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                      <span className="text-sm font-medium text-indigo-600">
                        {message.profiles.full_name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>

                {/* Mensaje */}
                <div className={`flex-1 max-w-md ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-gray-900">
                      {message.profiles.full_name}
                    </span>
                    <span className="text-xs text-gray-500">
                      {(() => {
                        const messageDate = new Date(message.created_at);
                        const today = new Date();
                        const yesterday = new Date(today);
                        yesterday.setDate(yesterday.getDate() - 1);
                        
                        // Verificar si es hoy
                        const isToday = messageDate.toDateString() === today.toDateString();
                        // Verificar si es ayer
                        const isYesterday = messageDate.toDateString() === yesterday.toDateString();
                        
                        if (isToday) {
                          return messageDate.toLocaleTimeString('es-ES', {
                            hour: '2-digit',
                            minute: '2-digit'
                          });
                        } else if (isYesterday) {
                          return `Ayer ${messageDate.toLocaleTimeString('es-ES', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}`;
                        } else {
                          return messageDate.toLocaleString('es-ES', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit'
                          });
                        }
                      })()}
                    </span>
                  </div>
                  
                  {message.message && message.message.trim() !== '' && message.message !== '(archivo adjunto)' && (
                    <div
                      className={`px-4 py-2 rounded-lg ${
                        isOwn
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      <p className={`text-sm whitespace-pre-wrap break-words ${isOwn ? 'text-white' : ''}`}>
                        {renderMessageWithMentions(message.message, isOwn)}
                      </p>
                    </div>
                  )}

                  {/* Archivos Adjuntos */}
                  {message.task_attachments && message.task_attachments.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {message.task_attachments.map((attachment) => (
                        <div
                          key={attachment.id}
                          className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200"
                        >
                          <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-900 truncate">{attachment.file_name}</p>
                            <p className="text-xs text-gray-500">{formatFileSize(attachment.file_size)}</p>
                          </div>
                          <button
                            onClick={() => handleDownload(attachment)}
                            className="p-1 hover:bg-gray-200 rounded transition-colors"
                            title="Descargar"
                          >
                            <Download className="w-4 h-4 text-gray-600" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 p-4 flex-shrink-0 bg-white">
        {/* Archivos Seleccionados */}
        {selectedFiles.length > 0 && (
          <div className="mb-3 space-y-2 max-h-32 overflow-y-auto">
            {selectedFiles.map((file, index) => (
              <div
                key={index}
                className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200"
              >
                <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
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

        {/* Input de Mensaje */}
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
          <div className="flex-1 relative">
          <textarea
              ref={textareaRef}
            value={newMessage}
              onChange={(e) => handleMessageChange(e)}
              onKeyDown={(e) => handleKeyDown(e)}
              onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && !showMentions && handleSend()}
              placeholder="Escribe un mensaje... (usa @ para mencionar usuarios)"
            rows={2}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none max-h-32 overflow-y-auto"
            disabled={sending || uploading}
          />
            {showMentions && (
              <TaskMentionAutocomplete
                taskId={taskId}
                searchTerm={mentionSearch}
                cursorPosition={mentionPosition}
                selectedIndex={selectedMentionIndex}
                onSelect={handleMentionSelect}
                onClose={() => setShowMentions(false)}
                onNavigate={handleMentionNavigate}
              />
            )}
          </div>
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
            onClick={handleSend}
            disabled={(!newMessage.trim() && selectedFiles.length === 0) || sending || uploading}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {(sending || uploading) ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

