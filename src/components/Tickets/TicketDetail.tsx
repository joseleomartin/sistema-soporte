import { useEffect, useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { ArrowLeft, Clock, User, Calendar, MessageSquare, Send, AlertCircle, Paperclip, X, Download, FileText } from 'lucide-react';

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
        console.log('📡 Subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ Successfully subscribed to ticket_comments');
        } else if (status === 'CHANNEL_ERROR') {
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

    setSubmitting(true);
    setError('');

    try {
      const attachments = await uploadFiles();

      const { error: insertError } = await supabase.from('ticket_comments').insert({
        ticket_id: ticketId,
        message: newComment.trim(),
        user_id: profile.id,
        attachments,
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
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'resolved':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'closed':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'medium':
        return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'low':
        return 'text-green-600 bg-green-50 border-green-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Ticket no encontrado</h3>
        <button
          onClick={onClose}
          className="text-blue-600 hover:text-blue-700 font-medium"
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
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 font-medium"
      >
        <ArrowLeft className="w-5 h-5" />
        Volver a Tickets
      </button>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-gray-900 mb-3">{ticket.title}</h1>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-medium border ${getStatusColor(ticket.status)}`}>
                    {getStatusLabel(ticket.status)}
                  </span>
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-medium border ${getPriorityColor(ticket.priority)}`}>
                    Prioridad: {ticket.priority === 'high' ? 'Alta' : ticket.priority === 'medium' ? 'Media' : 'Baja'}
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-medium bg-gray-50 text-gray-700 border border-gray-200">
                    {ticket.category}
                  </span>
                </div>
              </div>
            </div>

            <div className="prose max-w-none">
              <p className="text-gray-700 whitespace-pre-wrap">{ticket.description}</p>
            </div>

            {/* Archivos Adjuntos del Ticket */}
            {ticket.attachments && ticket.attachments.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <h3 className="text-sm font-medium text-gray-900 mb-3">Archivos Adjuntos</h3>
                <div className="space-y-2">
                  {ticket.attachments.map((attachment, idx) => (
                    <button
                      key={idx}
                      onClick={() => downloadFile(attachment)}
                      className="flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-sm transition group w-full text-left"
                    >
                      <FileText className="w-4 h-4 text-gray-500" />
                      <span className="text-gray-700 flex-1">{attachment.name}</span>
                      <span className="text-gray-500 text-xs">{formatFileSize(attachment.size)}</span>
                      <Download className="w-4 h-4 text-gray-400 group-hover:text-blue-600" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Comentarios ({comments.length})
            </h2>

            <div className="max-h-[500px] overflow-y-auto space-y-4 mb-6 pr-2">
              {comments.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No hay comentarios aún</p>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <User className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{comment.profiles?.full_name ?? 'Usuario'}</p>
                          <p className="text-xs text-gray-500">
                            {comment.profiles?.role === 'admin'
                              ? 'Administrador'
                              : comment.profiles?.role === 'support'
                                ? 'Soporte'
                                : 'Usuario'}
                          </p>
                        </div>
                      </div>
                      <span className="text-sm text-gray-500">
                        {new Date(comment.created_at).toLocaleString('es-ES')}
                      </span>
                    </div>
                    <p className="text-gray-700 whitespace-pre-wrap">{comment.message}</p>
                    {comment.attachments && comment.attachments.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {comment.attachments.map((attachment, idx) => (
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
                ))
              )}
              <div ref={commentsEndRef} />
            </div>

            <form onSubmit={handleAddComment} className="border-t border-gray-200 pt-4">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Escribe un comentario..."
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition resize-none mb-3"
              />

              {selectedFiles.length > 0 && (
                <div className="mb-3 space-y-2">
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg">
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

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
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
                    className="flex items-center gap-2 px-3 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition cursor-pointer font-medium"
                  >
                    <Paperclip className="w-4 h-4" />
                    Adjuntar Archivos
                  </label>
                </div>
                <button
                  type="submit"
                  disabled={submitting || uploading || (!newComment.trim() && selectedFiles.length === 0)}
                  className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                  {uploading ? 'Subiendo archivos...' : submitting ? 'Enviando...' : 'Enviar Comentario'}
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Información</h3>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <User className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-600">Creado por</p>
                  <p className="font-medium text-gray-900">{ticket.profiles.full_name}</p>
                  <p className="text-sm text-gray-600">{ticket.profiles.email}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-600">Fecha de creación</p>
                  <p className="font-medium text-gray-900">
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
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Acciones</h3>
              <div className="space-y-3">
                {!ticket.assigned_to && (
                  <button
                    onClick={handleAssignToMe}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
                  >
                    Asignarme este ticket
                  </button>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cambiar Estado
                  </label>
                  <select
                    value={ticket.status}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
