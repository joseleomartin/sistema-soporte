import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
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
  const [buttonPosition, setButtonPosition] = useState<{ top: number; left: number; bellCenterX?: number; bellCenterY?: number; bellTop?: number; bellLeft?: number; transformOriginX?: number; transformOriginY?: number } | null>(null);

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

  const buttonRef = useRef<HTMLButtonElement>(null);

  // Calcular posición cuando se abre el dropdown - Superponer las campanitas perfectamente
  useEffect(() => {
    if (showDropdown && buttonRef.current) {
      // Esperar un frame para que el DOM se actualice
      requestAnimationFrame(() => {
        if (!buttonRef.current) return;
        
        const rect = buttonRef.current.getBoundingClientRect();
        const headerPadding = 20; // Padding del header (p-5 = 20px)
        const bellContainerSize = 40; // Tamaño del contenedor de la campanita en el header (w-10 h-10 = 40px)
        
        // Calcular la posición exacta del CENTRO del icono Bell en el navbar
        // El botón tiene p-2 (8px padding en todos los lados)
        // El icono Bell tiene w-5 h-5 (20px x 20px) y está centrado dentro del botón
        // El rect del botón incluye el padding, así que el centro del botón = centro del icono
        const bellNavbarIconCenterX = rect.left + (rect.width / 2);
        const bellNavbarIconCenterY = rect.top + (rect.height / 2);
        
        // Calcular la posición del CENTRO del icono Bell en el header del dropdown
        // El header tiene p-5 (20px padding en todos los lados)
        // El contenedor de la campanita tiene w-10 h-10 (40px x 40px)
        // El icono dentro tiene w-5 h-5 (20px x 20px) y está centrado dentro del contenedor
        // El contenedor está dentro de un div con gap-3, pero está al inicio
        // - Centro X del icono = padding-left (20px) + mitad del contenedor (20px) = 40px desde la izquierda del dropdown
        // - Centro Y del icono = padding-top (20px) + mitad del contenedor (20px) = 40px desde arriba del dropdown
        const bellHeaderIconCenterX = headerPadding + (bellContainerSize / 2);
        const bellHeaderIconCenterY = headerPadding + (bellContainerSize / 2);
        
        // Guardar estos valores para usar en transformOrigin (la animación debe originarse desde el centro del icono)
        const transformOriginX = bellHeaderIconCenterX;
        const transformOriginY = bellHeaderIconCenterY;
        
        // Posicionar el dropdown para que el CENTRO del icono del header se superponga EXACTAMENTE con el CENTRO del icono del navbar
        // left: para que bellNavbarIconCenterX = left + bellHeaderIconCenterX
        let left = bellNavbarIconCenterX - bellHeaderIconCenterX;
        // top: para que bellNavbarIconCenterY = top + bellHeaderIconCenterY
        let top = bellNavbarIconCenterY - bellHeaderIconCenterY;
        
        // PRIORIDAD ABSOLUTA: Mantener la alineación perfecta de las campanitas
        // NO ajustar left/top - las campanitas DEBEN estar superpuestas perfectamente
        // La campanita del navbar se oculta cuando el dropdown está abierto, así que solo se ve la del header
        
        setButtonPosition({
          top: top,
          left: left,
          bellCenterX: bellNavbarIconCenterX,
          bellCenterY: bellNavbarIconCenterY,
          bellTop: rect.top,
          bellLeft: rect.left,
          transformOriginX: transformOriginX,
          transformOriginY: transformOriginY,
        });
      });
    } else {
      setButtonPosition(null);
    }
  }, [showDropdown]);

  const handleToggleDropdown = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Campanita clickeada, showDropdown actual:', showDropdown);
    setShowDropdown(prev => {
      console.log('Cambiando showDropdown de', prev, 'a', !prev);
      return !prev;
    });
  };

  return (
    <div className="relative" style={{ zIndex: 1000001 }}>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggleDropdown}
        onMouseDown={(e) => e.stopPropagation()}
        className="relative p-2 text-white hover:text-white/80 hover:bg-white/10 rounded-lg transition-all duration-200 cursor-pointer"
        style={{ 
          position: 'relative', 
          zIndex: 10000002, // Por encima del overlay para que sea clickeable
          opacity: showDropdown ? 0 : 1, // Ocultar la campanita del navbar cuando el dropdown está abierto
          pointerEvents: 'auto' // Mantener clickeable incluso cuando está oculto para poder cerrar el dropdown
        }}
      >
        <Bell className="w-5 h-5 pointer-events-none" />
        {unreadCount > 0 && !showDropdown && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold text-white bg-gradient-to-r from-red-500 to-red-600 rounded-full shadow-lg animate-pulse ring-2 ring-white pointer-events-none">
            {unreadCount > 99 ? '99+' : unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {showDropdown ? createPortal(
        <>
          {/* Overlay para cerrar al hacer clic fuera - Solo cubre el área del dropdown */}
          <div 
            className="fixed inset-0 bg-black/20" 
            style={{ zIndex: 10000000 }}
            onClick={() => {
              setShowDropdown(false);
              setButtonPosition(null);
            }}
          />
          
          {/* Dropdown de notificaciones - Se abre directamente desde la campanita, superponiéndose al navbar */}
          <div 
            className="fixed w-[420px] max-w-[calc(100vw-2rem)] bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border border-gray-200 dark:border-slate-700/50 backdrop-blur-xl overflow-hidden"
            style={{
              top: buttonPosition ? `${buttonPosition.top}px` : '80px',
              left: buttonPosition ? `${buttonPosition.left}px` : '280px',
              maxWidth: 'calc(100vw - 2rem)',
              boxShadow: '0 20px 60px -15px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.5)',
              animation: 'openFromBell 0.25s ease-out',
              transformOrigin: buttonPosition && buttonPosition.transformOriginX !== undefined && buttonPosition.transformOriginY !== undefined ? 
                `${buttonPosition.transformOriginX}px ${buttonPosition.transformOriginY}px` : 
                '40px 40px',
              zIndex: 10000001, // Por encima del overlay y del navbar (z-40)
            }}
            onClick={(e) => e.stopPropagation()} // Prevenir que el clic en el dropdown lo cierre
          >
            {/* Header con diseño más sutil */}
            <div className="relative flex items-center justify-between p-5 bg-gradient-to-r from-slate-700 to-slate-600 overflow-hidden border-b border-white/10">
              {/* Efecto sutil de brillo */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent"></div>
              
              <div className="relative z-10 flex items-center gap-3">
                <button
                  onClick={() => {
                    setShowDropdown(false);
                    setButtonPosition(null);
                  }}
                  className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30 hover:bg-white/30 transition-all duration-200 cursor-pointer"
                  title="Cerrar notificaciones"
                >
                  <Bell className="w-5 h-5 text-white" />
                </button>
                <div>
                  <h3 className="font-bold text-lg text-white drop-shadow-lg">Notificaciones</h3>
                  {unreadCount > 0 && (
                    <p className="text-xs text-white/80 font-medium">{unreadCount} sin leer</p>
                  )}
                </div>
              </div>
              
              <div className="relative z-10 flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-xs text-gray-700 dark:text-white hover:text-gray-900 dark:hover:text-white/90 font-semibold whitespace-nowrap px-3 py-1.5 rounded-lg bg-white/80 dark:bg-white/20 hover:bg-white dark:hover:bg-white/30 backdrop-blur-sm border border-gray-300 dark:border-white/30 transition-all duration-200 hover:scale-105"
                  >
                    Marcar todas
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowDropdown(false);
                    setButtonPosition(null);
                  }}
                    className="text-gray-700 dark:text-white hover:text-gray-900 dark:hover:text-white/80 flex-shrink-0 p-2 rounded-lg bg-white/80 dark:bg-white/20 hover:bg-white dark:hover:bg-white/30 backdrop-blur-sm border border-gray-300 dark:border-white/30 transition-all duration-200 hover:scale-110 hover:rotate-90"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Contenido con scroll - Estilo original */}
            <div className="max-h-[500px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-600/50 scrollbar-track-transparent bg-slate-800">
              {notifications.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="relative inline-block mb-4">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-200 to-purple-200 flex items-center justify-center animate-pulse">
                      <Bell className="w-10 h-10 text-blue-600" />
                    </div>
                    <div className="absolute -top-1 -right-1 w-6 h-6 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full animate-bounce"></div>
                  </div>
                  <p className="text-gray-200 font-semibold text-lg">No hay notificaciones</p>
                  <p className="text-gray-400 text-sm mt-1">Todo está al día</p>
                </div>
              ) : (
                <div className="p-3 space-y-2">
                  {notifications.map((notification, index) => (
                    <button
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      className={`group w-full text-left p-4 rounded-2xl border-2 transition-all duration-300 hover:shadow-xl hover:scale-[1.02] relative overflow-hidden ${
                        !notification.read 
                          ? 'bg-slate-700 border-slate-600/50 shadow-lg' 
                          : 'bg-slate-700/90 backdrop-blur-sm border-slate-600/30 hover:border-slate-500/50 hover:bg-slate-700'
                      }`}
                      style={{
                        animationDelay: `${index * 50}ms`,
                      }}
                    >
                      {/* Efecto de brillo en hover */}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 -translate-x-full group-hover:translate-x-full"></div>
                      
                      {/* Indicador de no leída */}
                      {!notification.read && (
                        <div className="absolute top-3 right-3 w-3 h-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full animate-pulse ring-2 ring-blue-200"></div>
                      )}
                      
                      <div className="relative flex items-start gap-4">
                        {/* Icono con fondo decorativo */}
                        <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-110 ${
                          !notification.read 
                            ? 'bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg shadow-blue-500/30' 
                            : 'bg-gradient-to-br from-gray-100 to-gray-200 group-hover:from-blue-100 group-hover:to-purple-100'
                        }`}>
                          <div className="text-white scale-90">
                            {getNotificationIcon(notification.type)}
                          </div>
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <p className={`text-sm font-bold leading-tight ${
                              !notification.read 
                                ? 'text-white' 
                                : 'text-gray-200 group-hover:text-white'
                            }`}>
                              {notification.title}
                            </p>
                          </div>
                          
                          <p className={`text-sm mt-2 leading-relaxed line-clamp-2 ${
                            !notification.read 
                              ? 'text-gray-200' 
                              : 'text-gray-300 group-hover:text-gray-200'
                          }`}>
                            {(notification.type === 'forum_mention' || notification.type === 'task_mention')
                              ? cleanMentionMessage(notification.message)
                              : notification.message}
                          </p>
                          
                          <div className="flex items-center gap-2 mt-3">
                            <div className={`w-1.5 h-1.5 rounded-full ${
                              !notification.read ? 'bg-blue-500' : 'bg-gray-300'
                            }`}></div>
                            <p className="text-xs font-medium text-gray-400">
                              {new Date(notification.created_at).toLocaleString('es-ES', {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>,
        document.body
      ) : null}
    </div>
  );
}
