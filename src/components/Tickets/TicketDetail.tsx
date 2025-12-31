import { useEffect, useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { ArrowLeft, Clock, User, Calendar, MessageSquare, Send, AlertCircle, Paperclip, X, Download, FileText } from 'lucide-react';
import { EmojiPicker } from '../EmojiPicker';

interface TicketDetailProps {
  ticketId: string;
  onClose: () => void;
}

interface Ticket {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  category: string;
  created_at: string;
  created_by: string;
  assigned_to: string | null;
  attachments?: Attachment[];
  profiles: {
    full_name: string;
    email: string;
  };
}

interface Attachment {
  name: string;
  path: string;
  size: number;
  type: string;
}

interface Comment {
  id: string;
  message: string;
  created_at: string;
  user_id: string;
  attachments?: Attachment[];
  profiles?: {
    full_name: string;
    role: string;
  };
}

export function TicketDetail({ ticketId, onClose }: TicketDetailProps) {
  const { profile } = useAuth();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const channelRef = useRef<any>(null);
  const commentsEndRef = useRef<HTMLDivElement>(null);
  const commentTextareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    loadTicketData();
    const channel = subscribeToComments();
    channelRef.current = channel;

    return () => {
      // Cleanup: unsubscribe cuando el componente se desmonte o cambie el ticketId
      if (channelRef.current) {
        console.log('🔌 Unsubscribing from ticket_comments channel');
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [ticketId]);

  // Scroll automático al último comentario cuando se agregan nuevos
  useEffect(() => {
    scrollToBottom();
  }, [comments]);

  const loadTicketData = async () => {
    try {
      // Cargar ticket
      const { data: ticketData, error: ticketError } = await supabase
        .from('tickets')
        .select('*')
        .eq('id', ticketId)
        .maybeSingle();

      if (ticketError) throw ticketError;
      if (!ticketData) throw new Error('Ticket no encontrado');

      // Cargar perfil del creador
      const { data: creatorProfile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', ticketData.created_by)
        .single();

      // Cargar comentarios
      const { data: commentsData, error: commentsError } = await supabase
        .from('ticket_comments')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

      if (commentsError) throw commentsError;

      // Cargar perfiles de usuarios que comentaron
      const userIds = [...new Set(commentsData?.map(c => c.user_id) || [])];
      const { data: usersData } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .in('id', userIds);

      const usersMap = new Map(usersData?.map(u => [u.id, u]) || []);

      // Combinar datos
      const ticketWithProfile = {
        ...ticketData,
        attachments: ticketData.attachments || [],
        profiles: creatorProfile
      };

      const commentsWithProfiles: Comment[] = commentsData?.map(comment => ({
        id: comment.id,
        message: comment.message,
        created_at: comment.created_at,
        user_id: comment.user_id,
        attachments: comment.attachments,
        profiles: usersMap.get(comment.user_id)
      })) || [];

      setTicket(ticketWithProfile);
      setComments(commentsWithProfiles);
    } catch (error) {
      console.error('Error loading ticket:', error);
      setError('Error al cargar el ticket');
    } finally {
      setLoading(false);
    }
  };

  const subscribeToComments = () => {
    console.log('🔔 Subscribing to ticket_comments for ticket:', ticketId);
    
    const channel = supabase
      .channel(`ticket_comments:${ticketId}:${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ticket_comments',
          filter: `ticket_id=eq.${ticketId}`
        },
        async (payload) => {
          console.log('📨 New comment received via Realtime:', payload);
          
          try {
            // Fetch el comentario completo con relaciones
            const { data, error } = await supabase
              .from('ticket_comments')
              .select('*')
              .eq('id', payload.new.id)
              .single();

            if (error) {
              console.error('❌ Error fetching new comment:', error);
              return;
            }

            if (data) {
              // Cargar perfil del usuario que comentó
              const { data: userData } = await supabase
                .from('profiles')
                .select('id, full_name, role')
                .eq('id', data.user_id)
                .single();

              const newComment: Comment = {
                id: data.id,
                message: data.message,
                created_at: data.created_at,
                user_id: data.user_id,
                attachments: data.attachments,
                profiles: userData || undefined
              };

              console.log('✅ Adding comment to state:', newComment);
              setComments((prev) => {
                // Evitar duplicados
                if (prev.some(comment => comment.id === newComment.id)) {
                  console.log('⚠️ Comment already exists, skipping');
                  return prev;
                }
                return [...prev, newComment];
              });
            }
          } catch (error) {
            console.error('❌ Error in Realtime handler:', error);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.error('❌ Channel subscription error');
        } else if (status === 'TIMED_OUT') {
          console.error('❌ Subscription timed out');
        }
      });

    return channel;
  };

  const scrollToBottom = () => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedFiles(prev => [...prev, ...files]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFiles = async (): Promise<Attachment[]> => {
    if (selectedFiles.length === 0) return [];

    setUploading(true);
    const attachments: Attachment[] = [];

    try {
      for (const file of selectedFiles) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${profile?.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('ticket-attachments')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('ticket-attachments')
          .getPublicUrl(fileName);

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

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newComment.trim() && selectedFiles.length === 0) || !profile?.id) return;

    if (!profile?.tenant_id) {
      setError('No se pudo identificar la empresa');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const attachments = await uploadFiles();

      const { error: insertError } = await supabase.from('ticket_comments').insert({
        ticket_id: ticketId,
        message: newComment.trim(),
        user_id: profile.id,
        attachments,
        tenant_id: profile.tenant_id, // Agregar tenant_id para aislamiento multi-tenant
      });

      if (insertError) throw insertError;

      setNewComment('');
      setSelectedFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      // No necesitamos recargar manualmente, Realtime lo hará automáticamente
    } catch (error) {
      console.error('Error adding comment:', error);
      setError('Error al agregar el comentario');
    } finally {
      setSubmitting(false);
    }
  };

  const downloadFile = async (attachment: Attachment) => {
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
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!profile?.id) return;

    try {
      const { error: updateError } = await supabase
        .from('tickets')
        .update({ status: newStatus })
        .eq('id', ticketId);

      if (updateError) throw updateError;

      await loadTicketData();
    } catch (error) {
      console.error('Error updating status:', error);
      setError('Error al actualizar el estado');
    }
  };

  const handleAssignToMe = async () => {
    if (!profile?.id) return;

    try {
      const { error: updateError } = await supabase
        .from('tickets')
        .update({
          assigned_to: profile.id,
          status: 'in_progress'
        })
        .eq('id', ticketId);

      if (updateError) throw updateError;

      await loadTicketData();
    } catch (error) {
      console.error('Error assigning ticket:', error);
      setError('Error al asignar el ticket');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-orange-100 dark:bg-orange-900/20 text-orange-800 dark:text-orange-300 border-orange-200 dark:border-orange-700/50';
      case 'in_progress':
        return 'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-700/50';
      case 'resolved':
        return 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300 border-green-200 dark:border-green-700/50';
      case 'closed':
        return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-600';
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-600';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700/50';
      case 'medium':
        return 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-700/50';
      case 'low':
        return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700/50';
      default:
        return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'open':
        return 'Abierto';
      case 'in_progress':
        return 'En Progreso';
      case 'resolved':
        return 'Resuelto';
      case 'closed':
        return 'Cerrado';
      default:
        return status;
    }
  };

  const canManageTicket = profile?.role === 'admin' || profile?.role === 'support';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400"></div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-16 h-16 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Ticket no encontrado</h3>
        <button
          onClick={onClose}
          className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-500 font-medium"
        >
          Volver a la lista
        </button>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={onClose}
        className="flex items-center gap-1.5 sm:gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4 sm:mb-6 font-medium text-sm sm:text-base"
      >
        <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
        <span className="hidden sm:inline">Volver a Tickets</span>
        <span className="sm:hidden">Volver</span>
      </button>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-lg p-4 mb-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-4 sm:p-6">
            <div className="flex items-start justify-between mb-3 sm:mb-4">
              <div className="flex-1 min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-2 sm:mb-3">{ticket.title}</h1>
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                  <span className={`inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-0.5 sm:py-1 rounded-lg text-xs sm:text-sm font-medium border ${getStatusColor(ticket.status)}`}>
                    {getStatusLabel(ticket.status)}
                  </span>
                  <span className={`inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-0.5 sm:py-1 rounded-lg text-xs sm:text-sm font-medium border ${getPriorityColor(ticket.priority)}`}>
                    <span className="hidden sm:inline">Prioridad: </span>
                    {ticket.priority === 'high' ? 'Alta' : ticket.priority === 'medium' ? 'Media' : 'Baja'}
                  </span>
                  <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-0.5 sm:py-1 rounded-lg text-xs sm:text-sm font-medium bg-gray-50 dark:bg-slate-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-slate-600">
                    {ticket.category}
                  </span>
                </div>
              </div>
            </div>

            <div className="prose max-w-none">
              <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{ticket.description}</p>
            </div>

            {/* Archivos Adjuntos del Ticket */}
            {ticket.attachments && ticket.attachments.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-slate-700">
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Archivos Adjuntos</h3>
                <div className="space-y-2">
                  {ticket.attachments.map((attachment, idx) => (
                    <button
                      key={idx}
                      onClick={() => downloadFile(attachment)}
                      className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-slate-700 hover:bg-gray-100 dark:hover:bg-slate-600 border border-gray-200 dark:border-slate-600 rounded-lg text-sm transition group w-full text-left"
                    >
                      <FileText className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                      <span className="text-gray-700 dark:text-white flex-1">{attachment.name}</span>
                      <span className="text-gray-500 dark:text-gray-400 text-xs">{formatFileSize(attachment.size)}</span>
                      <Download className="w-4 h-4 text-gray-400 dark:text-gray-500 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-4 sm:p-6">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4 flex items-center gap-1.5 sm:gap-2">
              <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5" />
              Comentarios ({comments.length})
            </h2>

            <div className="max-h-[400px] sm:max-h-[500px] overflow-y-auto space-y-3 sm:space-y-4 mb-4 sm:mb-6 pr-1 sm:pr-2">
              {comments.length === 0 ? (
                <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 text-center py-6 sm:py-8">No hay comentarios aún</p>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className="border border-gray-200 dark:border-slate-700 rounded-lg p-3 sm:p-4 bg-gray-50 dark:bg-slate-700/50">
                    <div className="flex items-start justify-between mb-1.5 sm:mb-2">
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
                        <div className="w-7 h-7 sm:w-8 sm:h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                          <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm sm:text-base text-gray-900 dark:text-white truncate">{comment.profiles?.full_name ?? 'Usuario'}</p>
                          <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">
                            {comment.profiles?.role === 'admin'
                              ? 'Administrador'
                              : comment.profiles?.role === 'support'
                                ? 'Soporte'
                                : 'Usuario'}
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 flex-shrink-0 ml-2">
                        {new Date(comment.created_at).toLocaleString('es-ES', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                    <p className="text-sm sm:text-base text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">{comment.message}</p>
                    {comment.attachments && comment.attachments.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {comment.attachments.map((attachment, idx) => (
                          <button
                            key={idx}
                            onClick={() => downloadFile(attachment)}
                            className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-slate-600 hover:bg-gray-100 dark:hover:bg-slate-500 border border-gray-200 dark:border-slate-600 rounded-lg text-sm transition group"
                          >
                            <FileText className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                            <span className="text-gray-700 dark:text-white flex-1 text-left">{attachment.name}</span>
                            <span className="text-gray-500 dark:text-gray-400 text-xs">{formatFileSize(attachment.size)}</span>
                            <Download className="w-4 h-4 text-gray-400 dark:text-gray-500 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
              <div ref={commentsEndRef} />
            </div>

            <form onSubmit={handleAddComment} className="border-t border-gray-200 dark:border-slate-700 pt-3 sm:pt-4">
              <textarea
                ref={commentTextareaRef}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Escribe un comentario..."
                rows={3}
                className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition resize-none mb-2 sm:mb-3 text-sm sm:text-base"
              />

              {selectedFiles.length > 0 && (
                <div className="mb-3 space-y-2">
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg">
                      <Paperclip className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                      <span className="text-sm text-gray-700 dark:text-white flex-1">{file.name}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">{formatFileSize(file.size)}</span>
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className="text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-2">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                    id="file-upload"
                  />
                  <label
                    htmlFor="file-upload"
                    className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-lg transition cursor-pointer font-medium"
                  >
                    <Paperclip className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="hidden sm:inline">Adjuntar Archivos</span>
                    <span className="sm:hidden">Archivos</span>
                  </label>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <EmojiPicker
                    onEmojiSelect={(emoji) => {
                      const textarea = commentTextareaRef.current;
                      if (textarea) {
                        const cursorPos = textarea.selectionStart || 0;
                        const textBefore = newComment.substring(0, cursorPos);
                        const textAfter = newComment.substring(cursorPos);
                        setNewComment(textBefore + emoji + textAfter);
                        setTimeout(() => {
                          textarea.focus();
                          textarea.setSelectionRange(cursorPos + emoji.length, cursorPos + emoji.length);
                        }, 0);
                      }
                    }}
                  />
                  <button
                    type="submit"
                    disabled={submitting || uploading || (!newComment.trim() && selectedFiles.length === 0)}
                    className="flex items-center justify-center gap-1.5 sm:gap-2 bg-blue-600 dark:bg-blue-500 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm flex-1 sm:flex-initial"
                  >
                    <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="hidden sm:inline">{uploading ? 'Subiendo archivos...' : submitting ? 'Enviando...' : 'Enviar Comentario'}</span>
                    <span className="sm:hidden">{uploading ? 'Subiendo...' : submitting ? 'Enviando...' : 'Enviar'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>

        <div className="space-y-4 sm:space-y-6">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4">Información</h3>
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-start gap-3">
                <User className="w-5 h-5 text-gray-400 dark:text-gray-500 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Creado por</p>
                  <p className="font-medium text-gray-900 dark:text-white">{ticket.profiles.full_name}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{ticket.profiles.email}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-gray-400 dark:text-gray-500 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Fecha de creación</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {new Date(ticket.created_at).toLocaleDateString('es-ES', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {canManageTicket && (
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-4 sm:p-6">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4">Acciones</h3>
              <div className="space-y-2.5 sm:space-y-3">
                {!ticket.assigned_to && (
                  <button
                    onClick={handleAssignToMe}
                    className="w-full px-3 sm:px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition font-medium text-sm sm:text-base"
                  >
                    Asignarme este ticket
                  </button>
                )}

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                    Cambiar Estado
                  </label>
                  <select
                    value={ticket.status}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    className="w-full px-2.5 sm:px-3 py-1.5 sm:py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                  >
                    <option value="open">Abierto</option>
                    <option value="in_progress">En Progreso</option>
                    <option value="resolved">Resuelto</option>
                    <option value="closed">Cerrado</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
