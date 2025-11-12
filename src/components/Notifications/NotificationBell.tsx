import { useEffect, useState } from 'react';
import { Bell, X, Calendar, MessageSquare, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface Notification {
  id: string;
  type: 'calendar_event' | 'ticket_comment' | 'ticket_status';
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  ticket_id?: string;
  event_id?: string;
  metadata?: any;
}

interface NotificationBellProps {
  onNavigateToTicket?: (ticketId: string) => void;
  onNavigateToCalendar?: () => void;
}

export function NotificationBell({ onNavigateToTicket, onNavigateToCalendar }: NotificationBellProps) {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!profile?.id) return;

    console.log('🔔 NotificationBell: Inicializando suscripción para usuario:', profile.id);
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
          console.log('🔔 Nueva notificación recibida:', payload);
          const newNotification = payload.new as Notification;
          setNotifications(prev => [newNotification, ...prev]);
          setUnreadCount(prev => prev + 1);

          showBrowserNotification(newNotification.title);
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Suscripción a notificaciones activa');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Error en canal de notificaciones:', err);
        } else if (status === 'TIMED_OUT') {
          console.error('⏱️ Timeout en suscripción de notificaciones');
        } else {
          console.log('🔔 Estado de suscripción:', status);
        }
      });

    // Polling de respaldo cada 30 segundos
    const pollingInterval = setInterval(() => {
      console.log('🔄 Polling de notificaciones (respaldo)');
      loadNotifications();
    }, 30000);

    return () => {
      console.log('🔔 Limpiando suscripción y polling');
      clearInterval(pollingInterval);
      supabase.removeChannel(channel);
    };
  }, [profile?.id]);

  const loadNotifications = async () => {
    if (!profile?.id) return;

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (!error && data) {
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.read).length);
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
    if (notification.type === 'calendar_event' && onNavigateToCalendar) {
      onNavigateToCalendar();
    } else if ((notification.type === 'ticket_comment' || notification.type === 'ticket_status') && notification.ticket_id && onNavigateToTicket) {
      onNavigateToTicket(notification.ticket_id);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'calendar_event':
        return <Calendar className="w-5 h-5 text-blue-600" />;
      case 'ticket_comment':
        return <MessageSquare className="w-5 h-5 text-green-600" />;
      case 'ticket_status':
        return <AlertCircle className="w-5 h-5 text-orange-600" />;
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
          <span className="absolute top-0 right-0 flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-600 rounded-full">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {showDropdown && (
        <>
          {/* Overlay para cerrar al hacer clic fuera */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setShowDropdown(false)}
          />
          
          {/* Dropdown de notificaciones */}
          <div className="absolute top-full mt-2 right-0 sm:left-1/2 sm:-translate-x-1/2 transform w-80 max-w-[calc(100vw-2rem)] bg-white rounded-lg shadow-xl border border-gray-200 z-50 origin-top-right sm:origin-top">
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
                          {notification.message}
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
