import { useState, useEffect, useRef } from 'react';
import { Send, Paperclip, Download, X, FileText, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

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
            // Fetch el mensaje completo con relaciones
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
              .eq('id', payload.new.id)
              .single();

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
      .subscribe((status) => {
        console.log('📡 Subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ Successfully subscribed to task_messages');
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

      // Crear mensaje
      const { data: messageData, error: messageError } = await supabase
        .from('task_messages')
        .insert([
          {
            task_id: taskId,
            user_id: profile.id,
            message: newMessage.trim() || '(archivo adjunto)'
          }
        ])
        .select()
        .single();

      if (messageError) throw messageError;

      // Subir archivos si hay
      if (selectedFiles.length > 0) {
        setUploading(true);
        for (const file of selectedFiles) {
          await uploadFile(file, messageData.id);
        }
      }

      setNewMessage('');
      setSelectedFiles([]);
      
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

  const getAvatarUrl = (avatarPath: string | null) => {
    if (!avatarPath) return null;
    
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
                      {new Date(message.created_at).toLocaleTimeString('es-ES', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                  
                  {message.message && (
                    <div
                      className={`px-4 py-2 rounded-lg ${
                        isOwn
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap break-words">{message.message}</p>
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
          <textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Escribe un mensaje..."
            rows={2}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none max-h-32 overflow-y-auto"
            disabled={sending || uploading}
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

