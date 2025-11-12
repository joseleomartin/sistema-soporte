import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { 
  User, 
  FolderOpen, 
  Video, 
  MessageSquare, 
  Calendar as CalendarIcon,
  Activity,
  TrendingUp,
  Clock,
  FileText,
  Users,
  Wrench,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { CreateEventModal } from '../Calendar/CreateEventModal';
import { EventDetailsModal } from '../Calendar/EventDetailsModal';

interface UserStats {
  clientsAccess: number;
  meetingsAttended: number;
  filesShared: number;
  forumPosts: number;
  accountAge: string;
  lastActivity: string;
}

interface RecentActivity {
  id: string;
  type: 'client' | 'meeting' | 'forum' | 'file';
  title: string;
  date: string;
  icon: any;
}

interface UserDashboardProps {
  onNavigate?: (view: string) => void;
}

export function UserDashboard({ onNavigate }: UserDashboardProps = {}) {
  const { profile } = useAuth();
  const [stats, setStats] = useState<UserStats>({
    clientsAccess: 0,
    meetingsAttended: 0,
    filesShared: 0,
    forumPosts: 0,
    accountAge: '0 días',
    lastActivity: 'Hoy',
  });
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [showEventModal, setShowEventModal] = useState(false);
  const [selectedDayEvents, setSelectedDayEvents] = useState<any[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  console.log('🟣 UserDashboard: Renderizando, profile:', profile?.full_name);

  useEffect(() => {
    console.log('🟣 UserDashboard: useEffect ejecutado, profile.id:', profile?.id);
    if (profile?.id) {
      loadDashboardData();
      loadEvents();
      if (profile.avatar_url) {
        setAvatarUrl(profile.avatar_url);
      }
    }
  }, [profile?.id, profile?.avatar_url]);

  useEffect(() => {
    // Recargar eventos cuando cambia el mes
    if (profile?.id) {
      loadEvents();
    }
  }, [currentDate, profile?.id]);

  const loadDashboardData = async () => {
    if (!profile?.id) return;

    try {
      // Obtener acceso a clientes
      const { count: clientsCount } = await supabase
        .from('subforum_permissions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        .eq('can_view', true);

      // Obtener mensajes en foros
      const { count: forumPostsCount } = await supabase
        .from('forum_messages')
        .select('*', { count: 'exact', head: true })
        .eq('created_by', profile.id);

      // Calcular antigüedad de cuenta
      const accountCreated = new Date(profile.created_at);
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - accountCreated.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const accountAge = diffDays < 30 
        ? `${diffDays} días` 
        : diffDays < 365 
          ? `${Math.floor(diffDays / 30)} meses`
          : `${Math.floor(diffDays / 365)} años`;

      // Obtener actividad reciente
      const { data: recentMessages } = await supabase
        .from('forum_messages')
        .select('id, content, created_at, subforum_id, subforums(name)')
        .eq('created_by', profile.id)
        .order('created_at', { ascending: false })
        .limit(5);

      const activities: RecentActivity[] = (recentMessages || []).map((msg: any) => ({
        id: msg.id,
        type: 'forum' as const,
        title: `Mensaje en ${msg.subforums?.name || 'cliente'}`,
        date: msg.created_at,
        icon: MessageSquare,
      }));

      setStats({
        clientsAccess: clientsCount || 0,
        meetingsAttended: 0, // TODO: Implementar tracking de reuniones
        filesShared: 0, // TODO: Contar archivos subidos
        forumPosts: forumPostsCount || 0,
        accountAge,
        lastActivity: activities.length > 0 ? 'Hoy' : 'Hace tiempo',
      });

      setRecentActivities(activities);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadEvents = async () => {
    if (!profile?.id) return;

    try {
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59);

      // Obtener eventos personales del usuario
      const { data: personalEvents } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('created_by', profile.id)
        .is('assigned_to', null)
        .gte('start_date', startOfMonth.toISOString())
        .lte('start_date', endOfMonth.toISOString());

      // Obtener eventos asignados al usuario
      const { data: assignedEvents } = await supabase
        .from('calendar_events')
        .select('*, created_by_profile:profiles!calendar_events_created_by_fkey(full_name)')
        .eq('assigned_to', profile.id)
        .gte('start_date', startOfMonth.toISOString())
        .lte('start_date', endOfMonth.toISOString());

      // Combinar ambos tipos de eventos
      const allEvents = [
        ...(personalEvents || []).map(e => ({ ...e, isPersonal: true })),
        ...(assignedEvents || []).map(e => ({ ...e, isPersonal: false }))
      ];

      setEvents(allEvents);
    } catch (error) {
      console.error('Error loading events:', error);
    }
  };

  const getEventsForDay = (day: number) => {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    return events.filter(event => {
      const eventDate = new Date(event.start_date);
      return (
        eventDate.getDate() === date.getDate() &&
        eventDate.getMonth() === date.getMonth() &&
        eventDate.getFullYear() === date.getFullYear()
      );
    });
  };

  const handleDayClick = (day: number) => {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    setSelectedDate(date);
    const dayEvents = getEventsForDay(day);
    setSelectedDayEvents(dayEvents);
    if (dayEvents.length === 0) {
      setShowEventModal(true);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Error al cargar el perfil</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Recargar página
          </button>
        </div>
      </div>
    );
  }

  const statCards = [
    { 
      icon: FolderOpen, 
      label: 'Clientes Asignados', 
      value: stats.clientsAccess, 
      color: 'bg-blue-50 text-blue-600',
      description: 'Clientes con acceso'
    },
    { 
      icon: MessageSquare, 
      label: 'Mensajes Enviados', 
      value: stats.forumPosts, 
      color: 'bg-purple-50 text-purple-600',
      description: 'En chats de clientes'
    },
    { 
      icon: CalendarIcon, 
      label: 'Antigüedad', 
      value: stats.accountAge, 
      color: 'bg-green-50 text-green-600',
      description: 'Tiempo en la plataforma',
      isText: true
    },
    { 
      icon: Activity, 
      label: 'Última Actividad', 
      value: stats.lastActivity, 
      color: 'bg-orange-50 text-orange-600',
      description: 'Actividad reciente',
      isText: true
    },
  ];

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Hoy';
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 7) return `Hace ${diffDays} días`;
    if (diffDays < 30) return `Hace ${Math.floor(diffDays / 7)} semanas`;
    return date.toLocaleDateString('es-ES');
  };

  // Funciones del calendario
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    return { daysInMonth, startingDayOfWeek };
  };

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const isToday = (day: number) => {
    const today = new Date();
    return (
      day === today.getDate() &&
      currentDate.getMonth() === today.getMonth() &&
      currentDate.getFullYear() === today.getFullYear()
    );
  };

  const isSelected = (day: number) => {
    if (!selectedDate) return false;
    return (
      day === selectedDate.getDate() &&
      currentDate.getMonth() === selectedDate.getMonth() &&
      currentDate.getFullYear() === selectedDate.getFullYear()
    );
  };

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  const { daysInMonth, startingDayOfWeek } = getDaysInMonth(currentDate);
  const calendarDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <div>
      {/* Header con información del perfil */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shadow-lg p-8 mb-8 text-white">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 rounded-full overflow-hidden bg-white flex items-center justify-center flex-shrink-0 ring-4 ring-white ring-opacity-50">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <User className="w-10 h-10 text-blue-600" />
            )}
          </div>
          <div className="flex-1">
            <h2 className="text-3xl font-bold mb-2">¡Hola, {profile?.full_name}!</h2>
            <p className="text-blue-100 text-lg">
              Bienvenido a tu panel personal
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-blue-100 mb-1">Miembro desde</p>
            <p className="text-xl font-semibold">{stats.accountAge}</p>
          </div>
        </div>
      </div>

      {/* Tarjetas de estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-lg ${stat.color}`}>
                  <Icon className="w-6 h-6" />
                </div>
              </div>
              <p className="text-sm font-medium text-gray-600 mb-1">{stat.label}</p>
              <p className={`${stat.isText ? 'text-2xl' : 'text-3xl'} font-bold text-gray-900 mb-1`}>
                {stat.value}
              </p>
              <p className="text-xs text-gray-500">{stat.description}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Calendario */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-blue-600" />
              Calendario
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={previousMonth}
                className="p-1 hover:bg-gray-100 rounded transition"
              >
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </button>
              <button
                onClick={nextMonth}
                className="p-1 hover:bg-gray-100 rounded transition"
              >
                <ChevronRight className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>
          
          <div className="mb-4">
            <p className="text-center font-semibold text-gray-900">
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </p>
          </div>

          {/* Días de la semana */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {dayNames.map((day) => (
              <div key={day} className="text-center text-xs font-medium text-gray-500 py-1">
                {day}
              </div>
            ))}
          </div>

          {/* Días del mes */}
          <div className="grid grid-cols-7 gap-1">
            {/* Espacios vacíos antes del primer día */}
            {Array.from({ length: startingDayOfWeek }).map((_, index) => (
              <div key={`empty-${index}`} className="aspect-square" />
            ))}
            
            {/* Días del mes */}
            {calendarDays.map((day) => {
              const dayEvents = getEventsForDay(day);
              const hasEvents = dayEvents.length > 0;
              
              return (
                <button
                  key={day}
                  onClick={() => handleDayClick(day)}
                  className={`
                    aspect-square flex flex-col items-center justify-center text-sm rounded-lg transition relative
                    ${isToday(day) 
                      ? 'bg-blue-600 text-white font-bold' 
                      : isSelected(day)
                        ? 'bg-blue-100 text-blue-900 font-semibold'
                        : 'hover:bg-gray-100 text-gray-700'
                    }
                  `}
                >
                  <span>{day}</span>
                  {hasEvents && (
                    <div className="flex gap-0.5 mt-0.5">
                      {dayEvents.slice(0, 3).map((event, idx) => (
                        <div
                          key={idx}
                          className={`w-1 h-1 rounded-full ${
                            event.isPersonal ? 'bg-blue-500' : 'bg-purple-500'
                          }`}
                          title={event.isPersonal ? 'Evento personal' : 'Evento asignado'}
                        />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {selectedDayEvents.length > 0 && (
            <div className="mt-4 space-y-2 max-h-40 overflow-y-auto">
              {selectedDayEvents.map((event) => (
                <button
                  key={event.id}
                  onClick={() => setSelectedEvent(event)}
                  className={`w-full text-left p-2 rounded-lg text-xs transition hover:shadow-md ${
                    event.isPersonal 
                      ? 'bg-blue-50 border border-blue-200 hover:bg-blue-100' 
                      : 'bg-purple-50 border border-purple-200 hover:bg-purple-100'
                  }`}
                >
                  <p className={`font-medium ${event.isPersonal ? 'text-blue-900' : 'text-purple-900'}`}>
                    {event.title}
                  </p>
                  {!event.isPersonal && event.created_by_profile && (
                    <p className="text-xs text-purple-600 mt-1">
                      Asignado por: {event.created_by_profile.full_name}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">Click para ver detalles</p>
                </button>
              ))}
              <button
                onClick={() => setShowEventModal(true)}
                className="w-full mt-2 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition"
              >
                + Agregar evento
              </button>
            </div>
          )}
        </div>

        {/* Accesos Rápidos */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Accesos Rápidos</h3>
          </div>
          <div className="space-y-3">
            <button
              onClick={() => onNavigate?.('forums')}
              className="w-full flex items-center gap-3 p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition cursor-pointer"
            >
              <FolderOpen className="w-5 h-5 text-blue-600" />
              <div className="text-left">
                <p className="font-medium text-gray-900">Mis Clientes</p>
                <p className="text-sm text-gray-600">Ver archivos y comunicación</p>
              </div>
            </button>
            <button
              onClick={() => onNavigate?.('meetings')}
              className="w-full flex items-center gap-3 p-4 bg-green-50 rounded-lg hover:bg-green-100 transition cursor-pointer"
            >
              <Video className="w-5 h-5 text-green-600" />
              <div className="text-left">
                <p className="font-medium text-gray-900">Salas de Reunión</p>
                <p className="text-sm text-gray-600">Únete a videollamadas</p>
              </div>
            </button>
            <button
              onClick={() => onNavigate?.('tools')}
              className="w-full flex items-center gap-3 p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition cursor-pointer"
            >
              <Wrench className="w-5 h-5 text-purple-600" />
              <div className="text-left">
                <p className="font-medium text-gray-900">Herramientas</p>
                <p className="text-sm text-gray-600">Extractor de tablas y OCR</p>
              </div>
            </button>
          </div>
        </div>

        {/* Actividad Reciente */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-purple-600" />
            <h3 className="text-lg font-semibold text-gray-900">Actividad Reciente</h3>
          </div>
          {recentActivities.length === 0 ? (
            <div className="text-center py-12">
              <Activity className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600 mb-2">Sin actividad reciente</p>
              <p className="text-sm text-gray-500">
                Comienza interactuando con tus clientes
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentActivities.map((activity) => {
                const Icon = activity.icon;
                return (
                  <div key={activity.id} className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg hover:border-purple-300 transition">
                    <div className="p-2 bg-purple-50 rounded-lg">
                      <Icon className="w-4 h-4 text-purple-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">{activity.title}</p>
                      <p className="text-xs text-gray-500 mt-1">{formatDate(activity.date)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Información de Perfil */}
      <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl border border-indigo-200 p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-white rounded-lg shadow-sm">
            <Users className="w-6 h-6 text-indigo-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Tu Perfil</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-600 mb-1">Nombre Completo</p>
                <p className="font-medium text-gray-900">{profile?.full_name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Email</p>
                <p className="font-medium text-gray-900">{profile?.email}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Rol</p>
                <p className="font-medium text-gray-900 capitalize">{profile?.role}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal para crear evento */}
      {showEventModal && (
        <CreateEventModal
          selectedDate={selectedDate}
          onClose={() => setShowEventModal(false)}
          onEventCreated={() => {
            loadEvents();
            setShowEventModal(false);
          }}
        />
      )}

      {/* Modal para ver detalles del evento */}
      {selectedEvent && (
        <EventDetailsModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onEventDeleted={() => {
            loadEvents();
            setSelectedEvent(null);
            setSelectedDayEvents([]);
          }}
          onEventUpdated={() => {
            loadEvents();
            setSelectedEvent(null);
          }}
        />
      )}
    </div>
  );
}
