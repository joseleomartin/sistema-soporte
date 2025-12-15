import { useEffect, useState } from 'react';
import { Bell, X, Calendar, MessageSquare, AlertCircle, CheckSquare, Cake, Ticket, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface Notification {
  id: string;
  type:
    | 'calendar_event'
    | 'ticket_comment'
    | 'ticket_status'
    | 'task_assigned'
    | 'forum_mention'
    | 'task_mention'
    | 'direct_message'
    | 'birthday'
    | 'ticket_created'
    | 'time_entry_reminder'
    | 'social_post'
    | 'professional_news';
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  ticket_id?: string;
  event_id?: string;
  task_id?: string;
  subforum_id?: string;
  direct_message_id?: string;
  metadata?: any;
}

interface NotificationBellProps {
  onNavigateToTicket?: (ticketId: string) => void;
  onNavigateToCalendar?: () => void;
  onNavigateToTasks?: () => void;
  onNavigateToForum?: (subforumId: string) => void;
  onNavigateToSocial?: () => void;
  onNavigateToTimeTracking?: () => void;
  onNavigateToProfessionalNews?: () => void;
}

export function NotificationBell({ onNavigateToTicket, onNavigateToCalendar, onNavigateToTasks, onNavigateToForum, onNavigateToSocial, onNavigateToTimeTracking, onNavigateToProfessionalNews }: NotificationBellProps) {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Actualizar título de la pestaña con el contador de notificaciones
  useEffect(() => {
    if (unreadCount > 0) {
      document.title = `EmaGroup (${unreadCount})`;
    } else {
      document.title = 'EmaGroup';
    }
  }, [unreadCount]);

  useEffect(() => {
    if (!profile?.id) return;

    loadNotifications();

    // Crear canal con configuración específica
    const channel = supabase
      .channel(`notifications:${profile.id}`, {
        config: {
          broadcast: { self: true },
          presence: { key: profile.id }
        }
      })
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${profile.id}`,
        },
        (payload) => {
          const newNotification = payload.new as Notification;
          // Ignorar notificaciones de mensajes directos
          if (newNotification.type === 'direct_message') {
            return;
          }
          setNotifications(prev => [newNotification, ...prev]);
          setUnreadCount(prev => prev + 1);

          showBrowserNotification(newNotification.title);
        }
      )
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR') {
          console.error('❌ Error en canal de notificaciones:', err);
        } else if (status === 'TIMED_OUT') {
          console.error('⏱️ Timeout en suscripción de notificaciones');
        }
      });

    // Polling de respaldo cada 10 segundos
    const pollingInterval = setInterval(() => {
      loadNotifications();
    }, 10000);

    return () => {
      clearInterval(pollingInterval);
      supabase.removeChannel(channel);
    };
  }, [profile?.id]);

  const loadNotifications = async () => {
    if (!profile?.id) return;

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', profile.id)
        .neq('type', 'direct_message') // Excluir notificaciones de mensajes directos
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error('Error cargando notificaciones:', error);
        return;
      }

      if (data) {
        // Filtrar también en el frontend por si acaso
        const filteredData = data.filter(n => n.type !== 'direct_message');
        const newUnreadCount = filteredData.filter(n => !n.read).length;
        
        // Solo actualizar si hay cambios
        if (JSON.stringify(filteredData) !== JSON.stringify(notifications)) {
          setNotifications(filteredData);
          setUnreadCount(newUnreadCount);
        }
      }
    } catch (error) {
      console.error('Error en loadNotifications:', error);
    }
  };

  const showBrowserNotification = (message: string) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Nueva notificación', {
        body: message,
        icon: '/favicon.ico',
      });
    }
  };

  const requestNotificationPermission = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  };

  useEffect(() => {
    requestNotificationPermission();
  }, []);

  const markAsRead = async (notificationId: string) => {
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId);

    setNotifications(prev =>
      prev.map(n => (n.id === notificationId ? { ...n, read: true } : n))
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const markAllAsRead = async () => {
    if (!profile?.id) return;

    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', profile.id)
      .eq('read', false);

    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const handleNotificationClick = async (notification: Notification) => {
    await markAsRead(notification.id);
    setShowDropdown(false);
    
    // Navegar según el tipo de notificación
    if (notification.type === 'calendar_event') {
      const isHoursReminder =
        notification.title.toLowerCase().includes('recordatorio de carga de horas') ||
        notification.message.toLowerCase().includes('recordatorio diario para que cargues las horas') ||
        notification.metadata?.type === 'time_entry_reminder';

      if (isHoursReminder) {
        // Ir a Carga de Horas
        if (onNavigateToTimeTracking) {
          onNavigateToTimeTracking();
        } else {
          window.location.hash = 'time-tracking';
        }
      } else if (onNavigateToCalendar) {
        // Otros eventos de calendario → calendario
        onNavigateToCalendar();
      }
    } else if ((notification.type === 'ticket_comment' || notification.type === 'ticket_status') && notification.ticket_id && onNavigateToTicket) {
      onNavigateToTicket(notification.ticket_id);
    } else if (notification.type === 'task_assigned' && notification.task_id) {
      // Navegar a tareas
      if (onNavigateToTasks) {
        onNavigateToTasks();
      } else {
        // Fallback: usar window.location si no hay callback
        window.location.hash = 'tasks';
      }
    } else if (notification.type === 'task_mention' && notification.task_id) {
      // Navegar a tareas y abrir la tarea específica
      if (onNavigateToTasks) {
        onNavigateToTasks();
      } else {
        // Fallback: usar window.location si no hay callback
        window.location.hash = 'tasks';
      }
      // Disparar evento personalizado para abrir la tarea específica
      // Esto se ejecutará después de que se navegue a la sección de tareas
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('openTask', {
          detail: { taskId: notification.task_id }
        }));
      }, 100);
    } else if (notification.type === 'forum_mention' && notification.subforum_id) {
      // Navegar al foro/cliente
      if (onNavigateToForum) {
        onNavigateToForum(notification.subforum_id);
      } else {
        // Fallback: usar window.location si no hay callback
        window.location.hash = 'forums';
      }
      // Disparar evento personalizado para abrir el subforo específico
      // Esto se ejecutará después de que se navegue a la sección de foros
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('openForum', {
          detail: { subforumId: notification.subforum_id }
        }));
      }, 100);
    } else if (notification.type === 'direct_message' && notification.metadata?.sender_id) {
      // Abrir chat de mensajes directos con el remitente
      // Disparar evento personalizado que MessagesBell escuchará
      window.dispatchEvent(new CustomEvent('openDirectMessage', {
        detail: { senderId: notification.metadata.sender_id }
      }));
    } else if (notification.type === 'birthday') {
      // Navegar a Social
      if (onNavigateToSocial) {
        onNavigateToSocial();
      } else {
        // Fallback: usar window.location si no hay callback
        window.location.hash = 'social';
      }
    } else if (notification.type === 'social_post') {
      // Navegar al feed Social
      if (onNavigateToSocial) {
        onNavigateToSocial();
      } else {
        window.location.hash = 'social';
      }
    } else if (notification.type === 'professional_news') {
      // Navegar a Novedades Profesionales
      if (onNavigateToProfessionalNews) {
        onNavigateToProfessionalNews();
      } else {
        window.location.hash = 'professional-news';
      }
    } else if (notification.type === 'ticket_created' && notification.ticket_id) {
      // Navegar al ticket específico
      if (onNavigateToTicket) {
        onNavigateToTicket(notification.ticket_id);
      } else {
        // Fallback: usar window.location si no hay callback
        window.location.hash = `tickets?ticket=${notification.ticket_id}`;
      }
    } else if (notification.type === 'time_entry_reminder') {
      // Navegar a Carga de Horas
      if (onNavigateToTimeTracking) {
        onNavigateToTimeTracking();
      } else {
        // Fallback: usar window.location si no hay callback
        window.location.hash = 'time-tracking';
      }
    }
  };

  // Función para limpiar menciones del mensaje (remover UUID)
  const cleanMentionMessage = (message: string): string => {
    // Reemplazar @[Nombre](uuid) con @Nombre
    return message.replace(/@\[([^\]]+)\]\([^)]+\)/g, '@$1');
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'calendar_event':
        return <Calendar className="w-5 h-5 text-blue-600" />;
      case 'ticket_comment':
        return <MessageSquare className="w-5 h-5 text-green-600" />;
      case 'ticket_status':
        return <AlertCircle className="w-5 h-5 text-orange-600" />;
      case 'task_assigned':
        return <CheckSquare className="w-5 h-5 text-indigo-600" />;
      case 'task_mention':
        return <MessageSquare className="w-5 h-5 text-purple-600" />;
      case 'forum_mention':
        return <MessageSquare className="w-5 h-5 text-purple-600" />;
      case 'direct_message':
        return <MessageSquare className="w-5 h-5 text-cyan-600" />;
      case 'birthday':
        return <Cake className="w-5 h-5 text-pink-600" />;
      case 'ticket_created':
        return <Ticket className="w-5 h-5 text-orange-600" />;
      case 'time_entry_reminder':
        return <Clock className="w-5 h-5 text-blue-600" />;
      case 'social_post':
        return <MessageSquare className="w-5 h-5 text-pink-600" />;
      case 'professional_news':
        return <MessageSquare className="w-5 h-5 text-indigo-600" />;
      default:
        return <Bell className="w-5 h-5 text-gray-600" />;
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold text-white bg-red-600 rounded-full shadow-lg animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {showDropdown && (
        <>
          {/* Overlay para cerrar al hacer clic fuera */}
          <div 
            className="fixed inset-0 z-[9998]" 
            onClick={() => setShowDropdown(false)}
          />
          
          {/* Dropdown de notificaciones */}
          <div className="absolute top-full mt-2 right-0 sm:left-1/2 sm:-translate-x-1/2 transform w-80 max-w-[calc(100vw-2rem)] bg-white rounded-lg shadow-xl border border-gray-200 z-[9999] origin-top-right sm:origin-top">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Notificaciones</h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium whitespace-nowrap"
                  >
                    Marcar todas leídas
                  </button>
                )}
                <button
                  onClick={() => setShowDropdown(false)}
                  className="text-gray-400 hover:text-gray-600 flex-shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Bell className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>No hay notificaciones</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {notifications.map((notification) => (
                  <button
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`w-full text-left p-4 hover:bg-gray-50 transition ${
                      !notification.read ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-0.5">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${!notification.read ? 'text-gray-900' : 'text-gray-700'}`}>
                          {notification.title}
                        </p>
                        <p className={`text-sm mt-0.5 ${!notification.read ? 'text-gray-700' : 'text-gray-600'}`}>
                          {(notification.type === 'forum_mention' || notification.type === 'task_mention')
                            ? cleanMentionMessage(notification.message)
                            : notification.message}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(notification.created_at).toLocaleString('es-ES', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          </div>
        </>
      )}
    </div>
  );
}
