import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Bell, X, Calendar, MessageSquare, AlertCircle, CheckSquare, Cake, Ticket, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useMobile } from '../../hooks/useMobile';

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
    | 'professional_news'
    | 'vacation_request';
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  ticket_id?: string;
  event_id?: string;
  task_id?: string;
  subforum_id?: string;
  direct_message_id?: string;
  vacation_id?: string;
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
  onNavigateToVacations?: () => void;
}

export function NotificationBell({ onNavigateToTicket, onNavigateToCalendar, onNavigateToTasks, onNavigateToForum, onNavigateToSocial, onNavigateToTimeTracking, onNavigateToProfessionalNews, onNavigateToVacations }: NotificationBellProps) {
  const { profile } = useAuth();
  const { theme } = useTheme();
  const isMobile = useMobile();
  const isDark = theme === 'dark';
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
        const filteredData = (data as Notification[]).filter(n => n.type !== 'direct_message');
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
    await (supabase as any)
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

    await (supabase as any)
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
      // Navegar a tareas y abrir la tarea específica directamente
      if (onNavigateToTasks) {
        onNavigateToTasks();
        // Establecer el parámetro task en la URL para que TasksList lo detecte y abra la tarea directamente
        window.history.replaceState(null, '', window.location.pathname + '#tasks?task=' + notification.task_id);
        // Disparar evento como respaldo por si acaso
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('openTask', {
            detail: { taskId: notification.task_id }
          }));
        }, 50);
      } else {
        // Fallback: usar window.location con el parámetro task
        window.location.hash = 'tasks?task=' + notification.task_id;
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('openTask', {
            detail: { taskId: notification.task_id }
          }));
        }, 50);
      }
    } else if (notification.type === 'task_mention' && notification.task_id) {
      // Navegar a tareas y abrir la tarea específica directamente
      if (onNavigateToTasks) {
        onNavigateToTasks();
        // Establecer el parámetro task en la URL para que TasksList lo detecte y abra la tarea directamente
        window.history.replaceState(null, '', window.location.pathname + '#tasks?task=' + notification.task_id);
        // Disparar evento como respaldo por si acaso
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('openTask', {
            detail: { taskId: notification.task_id }
          }));
        }, 50);
      } else {
        // Fallback: usar window.location con el parámetro task
        window.location.hash = 'tasks?task=' + notification.task_id;
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('openTask', {
            detail: { taskId: notification.task_id }
          }));
        }, 50);
      }
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
    } else if (notification.type === 'vacation_request') {
      // Navegar a Gestión de Vacaciones
      if (onNavigateToVacations) {
        onNavigateToVacations();
      } else {
        // Fallback: usar window.location si no hay callback
        window.location.hash = 'vacations';
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
      case 'vacation_request':
        return <Calendar className="w-5 h-5 text-orange-600" />;
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
        className={`relative p-2 rounded-lg transition-all duration-200 cursor-pointer ${
          isDark 
            ? 'text-white hover:text-white/80 hover:bg-white/10' 
            : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'
        }`}
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
          {/* Overlay para cerrar al hacer clic fuera - Adaptado para móviles */}
          <div 
            className={`fixed inset-0 ${isMobile ? 'bg-black/50' : 'bg-black/20'}`}
            style={{ zIndex: 10000000 }}
            onClick={() => {
              setShowDropdown(false);
              setButtonPosition(null);
            }}
          />
          
          {/* Dropdown de notificaciones - Adaptado para móviles */}
          <div 
            className={`fixed ${isMobile ? 'inset-0 w-full h-full rounded-none' : 'w-[320px] max-w-[calc(100vw-2rem)] rounded-2xl'} bg-white/95 dark:bg-slate-900/95 shadow-2xl border border-gray-200/50 dark:border-slate-700/30 backdrop-blur-2xl overflow-hidden`}
            style={{
              ...(isMobile ? {
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                maxWidth: '100vw',
                maxHeight: '100vh',
              } : {
                top: buttonPosition ? `${buttonPosition.top}px` : '80px',
                left: buttonPosition ? `${buttonPosition.left}px` : '280px',
                maxWidth: 'calc(100vw - 2rem)',
                transformOrigin: buttonPosition && buttonPosition.transformOriginX !== undefined && buttonPosition.transformOriginY !== undefined ? 
                  `${buttonPosition.transformOriginX}px ${buttonPosition.transformOriginY}px` : 
                  '40px 40px',
                animation: 'openFromBell 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
              }),
              boxShadow: isMobile ? 'none' : '0 25px 80px -12px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
              zIndex: 10000001, // Por encima del overlay y del navbar (z-40)
            }}
            onClick={(e) => e.stopPropagation()} // Prevenir que el clic en el dropdown lo cierre
          >
            {/* Header con diseño más orgánico */}
            <div className={`relative flex items-center justify-between ${isMobile ? 'p-4' : 'p-3'} bg-gradient-to-br from-slate-800 via-slate-700 to-slate-800 overflow-hidden border-b border-white/10 dark:border-slate-600/20`}>
              {/* Efecto de brillo animado más orgánico */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-50 animate-shimmer"></div>
              {/* Efecto de profundidad */}
              <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent"></div>
              
              <div className="relative z-10 flex items-center gap-2 sm:gap-2.5">
                {!isMobile && (
                  <button
                    onClick={() => {
                      setShowDropdown(false);
                      setButtonPosition(null);
                    }}
                    className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20 hover:bg-white/25 hover:border-white/30 transition-all duration-300 cursor-pointer touch-manipulation shadow-lg shadow-black/10 hover:shadow-xl hover:shadow-black/20 hover:scale-105"
                    title="Cerrar notificaciones"
                  >
                    <Bell className="w-4 h-4 text-white drop-shadow-sm" />
                  </button>
                )}
                <div>
                  <h3 className={`font-bold ${isMobile ? 'text-base' : 'text-base'} text-white drop-shadow-md tracking-tight`}>Notificaciones</h3>
                  {unreadCount > 0 && (
                    <p className={`${isMobile ? 'text-xs' : 'text-xs'} text-white/70 font-medium mt-0.5`}>{unreadCount} sin leer</p>
                  )}
                </div>
              </div>
              
              <div className="relative z-10 flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className={`${isMobile ? 'text-xs px-3 py-1.5' : 'text-xs px-3 py-1.5'} text-white hover:text-white font-semibold whitespace-nowrap rounded-lg bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/20 hover:border-white/30 transition-all duration-300 shadow-md shadow-black/10 hover:shadow-lg hover:shadow-black/20 ${isMobile ? 'touch-manipulation' : 'hover:scale-105 active:scale-95'}`}
                  >
                    Marcar todas
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowDropdown(false);
                    setButtonPosition(null);
                  }}
                  className={`text-white hover:text-white flex-shrink-0 ${isMobile ? 'p-2.5' : 'p-2'} rounded-lg bg-white/15 hover:bg-white/25 backdrop-blur-md border border-white/20 hover:border-white/30 transition-all duration-300 shadow-md shadow-black/10 hover:shadow-lg hover:shadow-black/20 ${isMobile ? 'touch-manipulation' : 'hover:scale-110 hover:rotate-90 active:scale-95'}`}
                >
                  <X className={`${isMobile ? 'w-4 h-4' : 'w-3.5 h-3.5'}`} />
                </button>
              </div>
            </div>

            {/* Contenido con scroll - Adaptado para móviles */}
            <div className={`${isMobile ? 'flex-1 overflow-y-auto' : 'max-h-[400px] overflow-y-auto'} notifications-scroll bg-gradient-to-b from-slate-900/50 to-slate-900`}>
              {notifications.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="relative inline-block mb-4">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-400/20 via-purple-400/20 to-pink-400/20 backdrop-blur-xl flex items-center justify-center animate-pulse border border-white/10 shadow-2xl">
                      <Bell className="w-10 h-10 text-blue-400 drop-shadow-lg" />
                    </div>
                    <div className="absolute -top-2 -right-2 w-6 h-6 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full animate-bounce shadow-lg ring-2 ring-yellow-400/30"></div>
                  </div>
                  <p className="text-gray-100 font-bold text-lg mb-1">No hay notificaciones</p>
                  <p className="text-gray-400 text-sm">Todo está al día ✨</p>
                </div>
              ) : (
                <div className={`${isMobile ? 'p-2.5' : 'p-2.5'} space-y-2`}>
                  {notifications.map((notification, index) => (
                    <button
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      className={`group w-full text-left ${isMobile ? 'p-3' : 'p-3'} ${isMobile ? 'rounded-xl' : 'rounded-xl'} border transition-all duration-300 ${isMobile ? 'active:scale-[0.98] touch-manipulation' : 'hover:shadow-2xl hover:scale-[1.01]'} relative overflow-hidden backdrop-blur-sm ${
                        !notification.read 
                          ? 'bg-gradient-to-br from-slate-800/90 to-slate-700/90 border-blue-500/30 shadow-xl shadow-blue-500/10' 
                          : 'bg-gradient-to-br from-slate-800/60 to-slate-700/60 border-slate-600/20 hover:border-slate-500/40 hover:bg-gradient-to-br hover:from-slate-800/80 hover:to-slate-700/80 shadow-md'
                      }`}
                      style={{
                        animationDelay: `${index * 40}ms`,
                      }}
                    >
                      {/* Efecto de brillo en hover más orgánico */}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 -translate-x-full group-hover:translate-x-full"></div>
                      
                      {/* Efecto de profundidad */}
                      <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                      
                      {/* Indicador de no leída más orgánico */}
                      {!notification.read && (
                        <div className="absolute top-3 right-3 w-2 h-2 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full animate-pulse ring-2 ring-blue-400/50 shadow-lg shadow-blue-500/50"></div>
                      )}
                      
                      <div className={`relative flex items-start ${isMobile ? 'gap-2.5' : 'gap-3'}`}>
                        {/* Icono con fondo decorativo más orgánico */}
                        <div className={`flex-shrink-0 ${isMobile ? 'w-10 h-10' : 'w-10 h-10'} rounded-xl flex items-center justify-center transition-all duration-300 ${isMobile ? '' : 'group-hover:scale-110 group-hover:rotate-3'} shadow-lg ${
                          !notification.read 
                            ? 'bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 shadow-xl shadow-blue-500/40 ring-2 ring-blue-400/30' 
                            : 'bg-gradient-to-br from-slate-600 to-slate-700 group-hover:from-blue-500/80 group-hover:to-purple-500/80 group-hover:shadow-xl group-hover:shadow-blue-500/30 border border-slate-500/30 group-hover:border-blue-400/50'
                        }`}>
                          <div className={`${!notification.read ? 'text-white' : 'text-gray-300 group-hover:text-white'} transition-colors duration-300 scale-90`}>
                            {getNotificationIcon(notification.type)}
                          </div>
                        </div>
                        
                        <div className="flex-1 min-w-0 pt-0.5">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <p className={`${isMobile ? 'text-sm' : 'text-sm'} font-bold leading-tight tracking-tight ${
                              !notification.read 
                                ? 'text-white' 
                                : 'text-gray-200 group-hover:text-white'
                            } transition-colors duration-300`}>
                              {notification.title}
                            </p>
                          </div>
                          
                          <p className={`${isMobile ? 'text-xs' : 'text-xs'} mt-1.5 leading-relaxed ${isMobile ? 'line-clamp-3' : 'line-clamp-2'} ${
                            !notification.read 
                              ? 'text-gray-200' 
                              : 'text-gray-300 group-hover:text-gray-200'
                          } transition-colors duration-300`}>
                            {(notification.type === 'forum_mention' || notification.type === 'task_mention')
                              ? cleanMentionMessage(notification.message)
                              : notification.message}
                          </p>
                          
                          <div className="flex items-center gap-2 mt-2.5">
                            <div className={`${isMobile ? 'w-1.5 h-1.5' : 'w-1.5 h-1.5'} rounded-full ${
                              !notification.read ? 'bg-gradient-to-br from-blue-400 to-purple-500 shadow-sm' : 'bg-gray-500'
                            } transition-all duration-300`}></div>
                            <p className={`${isMobile ? 'text-xs' : 'text-xs'} font-medium text-gray-400 group-hover:text-gray-300 transition-colors duration-300`}>
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
