import { useEffect, useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { ArrowLeft, Send, Paperclip, X, Download, FileText, Search, Filter, Trash2 } from 'lucide-react';

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
  const [showDeleteForumConfirm, setShowDeleteForumConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
      });

    return () => {
      console.log('Unsubscribing from channel');
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

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && selectedFiles.length === 0) || !profile?.id) return;

    setSubmitting(true);

    try {
      const attachments = await uploadFiles();

      const { error } = await supabase.from('forum_messages').insert({
        subforum_id: subforumId,
        content: newMessage.trim(),
        created_by: profile.id,
        attachments,
      });

      if (error) throw error;

      setNewMessage('');
      setSelectedFiles([]);
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
      const { error } = await supabase
        .from('forum_messages')
        .delete()
        .eq('id', messageId);

      if (error) throw error;

      setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
    } catch (error) {
      console.error('Error deleting message:', error);
      alert('Error al eliminar el mensaje');
    } finally {
      setDeletingMessage(null);
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
      <div className="mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-5 h-5" />
          Volver a Foros
        </button>

        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">{subforum?.name}</h2>
            {subforum?.description && (
              <p className="text-gray-600 mt-1">{subforum.description}</p>
            )}
            <p className="text-sm text-gray-500 mt-1">Cliente: {subforum?.client_name}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowFileSearch(!showFileSearch)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition font-medium"
            >
              <Search className="w-4 h-4" />
              Buscar Archivos ({getAllAttachments().length})
            </button>
            {canModerate && (
              <button
                onClick={() => setShowDeleteForumConfirm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 hover:bg-red-200 rounded-lg transition font-medium"
                title="Eliminar subforo"
              >
                <Trash2 className="w-4 h-4" />
                Eliminar Subforo
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden relative">
        {showFileSearch && (
          <div className="absolute top-0 left-0 right-0 bg-white border-b border-gray-200 z-10 shadow-md">
            <div className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <Filter className="w-5 h-5 text-gray-500" />
                <h3 className="font-semibold text-gray-900">Buscador de Archivos</h3>
                <button
                  onClick={() => setShowFileSearch(false)}
                  className="ml-auto text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <input
                type="text"
                placeholder="Buscar por nombre de archivo..."
                value={fileSearchTerm}
                onChange={(e) => setFileSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-3"
              />

              <div className="max-h-48 overflow-y-auto space-y-2">
                {filteredAttachments.length === 0 ? (
                  <p className="text-gray-500 text-center py-4 text-sm">
                    {fileSearchTerm ? 'No se encontraron archivos' : 'No hay archivos en este foro'}
                  </p>
                ) : (
                  filteredAttachments.map((attachment, idx) => (
                    <button
                      key={idx}
                      onClick={() => downloadFile(attachment)}
                      className="w-full flex items-center gap-3 px-3 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-sm transition group"
                    >
                      <FileText className="w-4 h-4 text-gray-500 flex-shrink-0" />
                      <div className="flex-1 text-left min-w-0">
                        <p className="font-medium text-gray-900 truncate">{attachment.name}</p>
                        <p className="text-xs text-gray-500 truncate">
                          {attachment.author} • {new Date(attachment.date).toLocaleDateString('es-ES')} •{' '}
                          {formatFileSize(attachment.size)}
                        </p>
                      </div>
                      <Download className="w-4 h-4 text-gray-400 group-hover:text-blue-600 flex-shrink-0" />
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-500">No hay mensajes aún. Sé el primero en escribir!</p>
            </div>
          ) : (
            messages.map((message) => (
              <div key={message.id} className="flex gap-3 group">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-600 font-semibold text-sm">
                    {message.profiles.full_name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="font-semibold text-gray-900">
                      {message.profiles.full_name}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        message.profiles.role === 'admin'
                          ? 'bg-purple-100 text-purple-700'
                          : message.profiles.role === 'support'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {message.profiles.role === 'admin'
                        ? 'Admin'
                        : message.profiles.role === 'support'
                        ? 'Soporte'
                        : 'Usuario'}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(message.created_at).toLocaleString('es-ES')}
                    </span>
                    {(canModerate || message.created_by === profile?.id) && (
                      <button
                        onClick={() => handleDeleteMessage(message.id)}
                        disabled={deletingMessage === message.id}
                        className="ml-auto opacity-0 group-hover:opacity-100 text-red-600 hover:text-red-700 transition p-1 disabled:opacity-50"
                        title="Eliminar mensaje"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <p className="text-gray-700 whitespace-pre-wrap">{message.content}</p>
                  {message.attachments && message.attachments.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {message.attachments.map((attachment, idx) => (
                        <button
                          key={idx}
                          onClick={() => downloadFile(attachment)}
                          className="flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-sm transition group"
                        >
                          <FileText className="w-4 h-4 text-gray-500" />
                          <span className="text-gray-700 flex-1 text-left">{attachment.name}</span>
                          <span className="text-gray-500 text-xs">{formatFileSize(attachment.size)}</span>
                          <Download className="w-4 h-4 text-gray-400 group-hover:text-blue-600" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSendMessage} className="border-t border-gray-200 p-4">
          {selectedFiles.length > 0 && (
            <div className="mb-3 space-y-2">
              {selectedFiles.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg"
                >
                  <Paperclip className="w-4 h-4 text-gray-500" />
                  <span className="text-sm text-gray-700 flex-1">{file.name}</span>
                  <span className="text-xs text-gray-500">{formatFileSize(file.size)}</span>
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    className="text-gray-400 hover:text-red-600 transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-end gap-2">
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Escribe un mensaje..."
              rows={2}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
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
              className="px-3 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition cursor-pointer"
            >
              <Paperclip className="w-5 h-5" />
            </label>
            <button
              type="submit"
              disabled={submitting || uploading || (!newMessage.trim() && selectedFiles.length === 0)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Send className="w-5 h-5" />
              {uploading ? 'Subiendo...' : submitting ? 'Enviando...' : 'Enviar'}
            </button>
          </div>
        </form>
      </div>

      {showDeleteForumConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Eliminar Subforo</h3>
                <p className="text-sm text-gray-600">Esta acción no se puede deshacer</p>
              </div>
            </div>

            <p className="text-gray-700 mb-6">
              ¿Estás seguro de que deseas eliminar el subforo <strong>{subforum?.name}</strong>?
              Todos los mensajes y archivos se perderán permanentemente.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteForumConfirm(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  setShowDeleteForumConfirm(false);
                  handleDeleteForum();
                }}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium"
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
