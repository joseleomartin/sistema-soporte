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
  ChevronRight,
  CheckSquare,
  Plus,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { CreateEventModal } from '../Calendar/CreateEventModal';
import { EventDetailsModal } from '../Calendar/EventDetailsModal';

interface UserStats {
  clientsAccess: number;
  meetingsAttended: number;
  filesShared: number;
  forumPosts: number;
  tasksAssigned: number;
  totalHours: number;
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
    tasksAssigned: 0,
    totalHours: 0,
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
  const [userVacations, setUserVacations] = useState<any[]>([]);
  const [showVacationModal, setShowVacationModal] = useState(false);

  useEffect(() => {
    if (profile?.id) {
      loadDashboardData();
      loadEvents();
      if (profile.role !== 'admin' && profile.role !== 'support') {
        loadUserVacations();
      }
      if (profile.avatar_url) {
        setAvatarUrl(profile.avatar_url);
      }
    }
  }, [profile?.id, profile?.avatar_url, profile?.role]);

  useEffect(() => {
    // Recargar eventos cuando cambia el mes
    if (profile?.id) {
      loadEvents();
    }
  }, [currentDate, profile?.id]);

  const loadUserVacations = async () => {
    if (!profile?.id) return;

    try {
      const { data, error } = await supabase
        .from('vacations')
        .select('*')
        .eq('user_id', profile.id)
        .order('start_date', { ascending: false })
        .limit(5);

      if (error) throw error;
      setUserVacations(data || []);
    } catch (error) {
      console.error('Error loading vacations:', error);
    }
  };

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

      // Contar tareas asignadas al usuario
      let tasksCount = 0;
      
      if (profile.role === 'admin') {
        // Admin cuenta solo tareas pendientes o en progreso (no completadas)
        const { count: pendingTasksCount, error: tasksError } = await supabase
          .from('tasks')
          .select('*', { count: 'exact', head: true })
          .in('status', ['pending', 'in_progress']);
        
        if (tasksError) {
          // Si hay error, intentar contar de otra manera
          const { data: pendingTasks, error: tasksDataError } = await supabase
            .from('tasks')
            .select('id')
            .in('status', ['pending', 'in_progress']);
          if (!tasksDataError && pendingTasks) {
            tasksCount = pendingTasks.length;
          }
        } else {
          tasksCount = pendingTasksCount || 0;
        }
      } else {
        // Usuario regular: contar tareas asignadas directamente o por departamento
        // Obtener departamentos del usuario
        const { data: userDepts } = await supabase
          .from('user_departments')
          .select('department_id')
          .eq('user_id', profile.id);

        const departmentIds = userDepts?.map(d => d.department_id) || [];

        // Contar asignaciones directas
        const { count: directAssignments } = await supabase
          .from('task_assignments')
          .select('*', { count: 'exact', head: true })
          .eq('assigned_to_user', profile.id);

        // Contar asignaciones por departamento
        let deptAssignmentsCount = 0;
        if (departmentIds.length > 0) {
          const { count: deptCount } = await supabase
            .from('task_assignments')
            .select('*', { count: 'exact', head: true })
            .in('assigned_to_department', departmentIds);
          deptAssignmentsCount = deptCount || 0;
        }

        // Obtener task_ids únicos (puede haber duplicados si está asignado directo y por dept)
        const { data: directTasks } = await supabase
          .from('task_assignments')
          .select('task_id')
          .eq('assigned_to_user', profile.id);

        const { data: deptTasks } = departmentIds.length > 0
          ? await supabase
              .from('task_assignments')
              .select('task_id')
              .in('assigned_to_department', departmentIds)
          : { data: [] };

        // Combinar y obtener únicos
        const allTaskIds = new Set([
          ...(directTasks?.map(t => t.task_id) || []),
          ...(deptTasks?.map(t => t.task_id) || [])
        ]);

        // Contar solo tareas pendientes o en progreso (no completadas)
        if (allTaskIds.size > 0) {
          const { count: pendingTasksCount } = await supabase
            .from('tasks')
            .select('*', { count: 'exact', head: true })
            .in('id', Array.from(allTaskIds))
            .in('status', ['pending', 'in_progress']);
          
          tasksCount = pendingTasksCount || 0;
        } else {
          tasksCount = 0;
        }
      }

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

      // Obtener total de horas cargadas (del mes actual)
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const endOfMonth = new Date();
      endOfMonth.setMonth(endOfMonth.getMonth() + 1);
      endOfMonth.setDate(0);
      endOfMonth.setHours(23, 59, 59, 999);

      const { data: timeEntries } = await supabase
        .from('time_entries')
        .select('hours_worked')
        .eq('user_id', profile.id)
        .gte('entry_date', startOfMonth.toISOString().split('T')[0])
        .lte('entry_date', endOfMonth.toISOString().split('T')[0]);

      const totalHours = timeEntries?.reduce((sum, entry) => 
        sum + parseFloat(entry.hours_worked.toString()), 0) || 0;

      setStats({
        clientsAccess: clientsCount || 0,
        meetingsAttended: 0, // TODO: Implementar tracking de reuniones
        filesShared: 0, // TODO: Contar archivos subidos
        forumPosts: forumPostsCount || 0,
        tasksAssigned: tasksCount,
        totalHours: totalHours,
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

      // Obtener tareas asignadas al usuario para el mes actual
      let tasks: any[] = [];
      
      if (profile.role === 'admin') {
        // Admin ve todas las tareas
        const { data: allTasks } = await supabase
          .from('tasks')
          .select('*, created_by_profile:profiles!tasks_created_by_fkey(full_name)')
          .not('due_date', 'is', null)
          .gte('due_date', startOfMonth.toISOString())
          .lte('due_date', endOfMonth.toISOString());
        tasks = allTasks || [];
      } else {
        // Usuario regular: obtener tareas asignadas
        const { data: userDepts } = await supabase
          .from('user_departments')
          .select('department_id')
          .eq('user_id', profile.id);

        const departmentIds = userDepts?.map(d => d.department_id) || [];

        // Obtener task_ids asignadas
        const { data: directTasks } = await supabase
          .from('task_assignments')
          .select('task_id')
          .eq('assigned_to_user', profile.id);

        const { data: deptTasks } = departmentIds.length > 0
          ? await supabase
              .from('task_assignments')
              .select('task_id')
              .in('assigned_to_department', departmentIds)
          : { data: [] };

        // Combinar y obtener únicos
        const allTaskIds = new Set([
          ...(directTasks?.map(t => t.task_id) || []),
          ...(deptTasks?.map(t => t.task_id) || [])
        ]);

        if (allTaskIds.size > 0) {
          const { data: userTasks } = await supabase
            .from('tasks')
            .select('*, created_by_profile:profiles!tasks_created_by_fkey(full_name)')
            .in('id', Array.from(allTaskIds))
            .not('due_date', 'is', null)
            .gte('due_date', startOfMonth.toISOString())
            .lte('due_date', endOfMonth.toISOString());
          tasks = userTasks || [];
        }
      }

      // Convertir tareas a formato de evento para el calendario
      // Solo incluir tareas que tengan due_date
      const tasksAsEvents = (tasks || [])
        .filter(task => task.due_date) // Filtrar tareas sin fecha de vencimiento
        .map(task => ({
          id: `task-${task.id}`,
          title: task.title,
          start_date: task.due_date,
          end_date: task.due_date,
          color: task.priority === 'urgent' ? '#EF4444' : task.priority === 'medium' ? '#3B82F6' : '#10B981',
          isPersonal: false,
          isTask: true,
          taskId: task.id,
          taskPriority: task.priority,
          taskStatus: task.status,
          taskClient: task.client_name,
          created_by_profile: task.created_by_profile
        }));

      // Obtener vacaciones aprobadas
      let vacationsQuery = supabase
        .from('vacations')
        .select('*, user_profile:profiles!vacations_user_id_fkey(full_name)')
        .eq('status', 'approved')
        .lte('start_date', endOfMonth.toISOString().split('T')[0])
        .gte('end_date', startOfMonth.toISOString().split('T')[0]);

      // Si no es admin/support, solo ver sus propias vacaciones
      if (profile.role !== 'admin' && profile.role !== 'support') {
        vacationsQuery = vacationsQuery.eq('user_id', profile.id);
      }

      const { data: vacations } = await vacationsQuery;

      // Convertir vacaciones a eventos del calendario
      const vacationsAsEvents = (vacations || []).map((vacation: any) => {
        // Crear un evento por cada día de vacaciones
        const vacationEvents = [];
        const start = new Date(vacation.start_date);
        const end = new Date(vacation.end_date);
        
        // Solo crear eventos para días dentro del mes actual
        const currentDay = new Date(start);
        while (currentDay <= end) {
          const dayDate = new Date(currentDay);
          if (
            dayDate.getMonth() === currentDate.getMonth() &&
            dayDate.getFullYear() === currentDate.getFullYear()
          ) {
            vacationEvents.push({
              id: `vacation-${vacation.id}-${dayDate.toISOString().split('T')[0]}`,
              title: profile.role === 'admin' || profile.role === 'support'
                ? `Vacaciones / Licencias: ${vacation.user_profile?.full_name || 'Usuario'}`
                : 'Vacaciones / Licencias',
              start_date: dayDate.toISOString(),
              end_date: dayDate.toISOString(),
              color: '#F59E0B', // Color naranja/ámbar para vacaciones
              isPersonal: vacation.user_id === profile.id,
              isTask: false,
              isVacation: true,
              vacationId: vacation.id,
              vacationDays: vacation.days_count,
              vacationUser: vacation.user_profile?.full_name
            });
          }
          currentDay.setDate(currentDay.getDate() + 1);
        }
        
        return vacationEvents;
      }).flat();

      // Combinar eventos, tareas y vacaciones
      const allEvents = [
        ...(personalEvents || []).map(e => ({ ...e, isPersonal: true, isTask: false, isVacation: false })),
        ...(assignedEvents || []).map(e => ({ ...e, isPersonal: false, isTask: false, isVacation: false })),
        ...tasksAsEvents.map(e => ({ ...e, isVacation: false })),
        ...vacationsAsEvents
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
  
  const handleTaskClick = (taskId: string) => {
    if (onNavigate) {
      onNavigate('tasks');
    }
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
      icon: CheckSquare, 
      label: 'Tareas Asignadas', 
      value: stats.tasksAssigned, 
      color: 'bg-indigo-50 text-indigo-600',
      description: 'Tareas pendientes'
    },
    { 
      icon: Clock, 
      label: 'Horas Cargadas', 
      value: `${stats.totalHours.toFixed(2)}h`, 
      color: 'bg-orange-50 text-orange-600',
      description: 'Horas del mes actual',
      isText: false
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
            <p className="text-xl font-semibold">
              {(() => {
                const accountCreated = new Date(profile?.created_at || new Date());
                const now = new Date();
                const diffTime = Math.abs(now.getTime() - accountCreated.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                if (diffDays < 30) return `${diffDays} días`;
                if (diffDays < 365) return `${Math.floor(diffDays / 30)} meses`;
                return `${Math.floor(diffDays / 365)} años`;
              })()}
            </p>
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
                            event.isTask 
                              ? event.taskPriority === 'urgent' 
                                ? 'bg-red-500' 
                                : event.taskPriority === 'medium' 
                                  ? 'bg-blue-500' 
                                  : 'bg-green-500'
                              : event.isPersonal 
                                ? 'bg-blue-500' 
                                : 'bg-purple-500'
                          }`}
                          title={
                            event.isTask 
                              ? `Tarea: ${event.title}` 
                              : event.isPersonal 
                                ? 'Evento personal' 
                                : 'Evento asignado'
                          }
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
                  onClick={() => {
                    if (event.isTask) {
                      handleTaskClick(event.taskId);
                    } else {
                      setSelectedEvent(event);
                    }
                  }}
                  className={`w-full text-left p-2 rounded-lg text-xs transition hover:shadow-md ${
                    event.isTask
                      ? event.taskPriority === 'urgent'
                        ? 'bg-red-50 border border-red-200 hover:bg-red-100'
                        : event.taskPriority === 'medium'
                          ? 'bg-blue-50 border border-blue-200 hover:bg-blue-100'
                          : 'bg-green-50 border border-green-200 hover:bg-green-100'
                      : event.isPersonal 
                        ? 'bg-blue-50 border border-blue-200 hover:bg-blue-100' 
                        : 'bg-purple-50 border border-purple-200 hover:bg-purple-100'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {event.isTask && (
                      <CheckSquare className={`w-3 h-3 flex-shrink-0 ${
                        event.taskPriority === 'urgent' ? 'text-red-600' :
                        event.taskPriority === 'medium' ? 'text-blue-600' : 'text-green-600'
                      }`} />
                    )}
                    <p className={`font-medium flex-1 ${
                      event.isTask
                        ? event.taskPriority === 'urgent' ? 'text-red-900' :
                          event.taskPriority === 'medium' ? 'text-blue-900' : 'text-green-900'
                        : event.isPersonal ? 'text-blue-900' : 'text-purple-900'
                    }`}>
                      {event.title}
                    </p>
                  </div>
                  {event.isTask && (
                    <>
                      <p className="text-xs text-gray-600 mt-1">
                        Cliente: {event.taskClient}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Estado: {event.taskStatus === 'pending' ? 'Pendiente' :
                                 event.taskStatus === 'in_progress' ? 'En Progreso' :
                                 event.taskStatus === 'completed' ? 'Completada' : 'Cancelada'}
                      </p>
                    </>
                  )}
                  {!event.isTask && !event.isPersonal && event.created_by_profile && (
                    <p className="text-xs text-purple-600 mt-1">
                      Asignado por: {event.created_by_profile.full_name}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    {event.isTask ? 'Click para ir a Tareas' : 'Click para ver detalles'}
                  </p>
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

      {/* Sección de Vacaciones - Solo para usuarios normales */}
      {profile?.role !== 'admin' && profile?.role !== 'support' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-orange-600" />
              <h3 className="text-lg font-semibold text-gray-900">Mis Vacaciones / Licencias</h3>
            </div>
            <button
              onClick={() => setShowVacationModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm"
            >
              <Plus className="w-4 h-4" />
              Solicitar Vacaciones / Licencias
            </button>
          </div>

          {userVacations.length === 0 ? (
            <div className="text-center py-8">
              <CalendarIcon className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p className="text-gray-500 mb-2">No tienes vacaciones / licencias registradas</p>
              <p className="text-sm text-gray-400">Solicita tus vacaciones / licencias haciendo clic en el botón de arriba</p>
            </div>
          ) : (
            <div className="space-y-3">
              {userVacations.map((vacation) => {
                const startDate = new Date(vacation.start_date);
                const endDate = new Date(vacation.end_date);
                const getStatusBadge = () => {
                  switch (vacation.status) {
                    case 'approved':
                      return (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          <CheckCircle className="w-3 h-3" />
                          Aprobada
                        </span>
                      );
                    case 'rejected':
                      return (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                          <XCircle className="w-3 h-3" />
                          Rechazada
                        </span>
                      );
                    default:
                      return (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                          <Clock className="w-3 h-3" />
                          Pendiente
                        </span>
                      );
                  }
                };

                return (
                  <div key={vacation.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        {getStatusBadge()}
                        <span className="text-sm font-medium text-gray-900">
                          {startDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} - {endDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                        <span className="text-sm text-gray-500">({vacation.days_count} día{vacation.days_count !== 1 ? 's' : ''})</span>
                      </div>
                      {vacation.reason && (
                        <p className="text-sm text-gray-600">{vacation.reason}</p>
                      )}
                      {vacation.status === 'rejected' && vacation.rejection_reason && (
                        <p className="text-xs text-red-600 mt-1">Razón: {vacation.rejection_reason}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

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

      {/* Modal para solicitar vacaciones - Solo para usuarios normales */}
      {showVacationModal && profile?.role !== 'admin' && profile?.role !== 'support' && (
        <CreateVacationModal
          onClose={() => {
            setShowVacationModal(false);
          }}
          onSuccess={() => {
            setShowVacationModal(false);
            loadUserVacations();
            loadEvents(); // Recargar eventos para mostrar las vacaciones en el calendario
          }}
        />
      )}
    </div>
  );
}

// Modal simplificado para crear vacación (solo para usuarios normales)
function CreateVacationModal({ onClose, onSuccess }: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { profile } = useAuth();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!startDate || !endDate) {
      setError('Debes seleccionar ambas fechas');
      return;
    }

    if (new Date(endDate) < new Date(startDate)) {
      setError('La fecha de fin debe ser posterior a la fecha de inicio');
      return;
    }

    if (!profile?.id) {
      setError('No se pudo identificar el usuario');
      return;
    }

    setLoading(true);

    try {
      const { error: insertError } = await supabase
        .from('vacations')
        .insert({
          user_id: profile.id,
          start_date: startDate,
          end_date: endDate,
          reason: reason || null
        });

      if (insertError) throw insertError;

      onSuccess();
    } catch (err: any) {
      console.error('Error creating vacation:', err);
      setError(err.message || 'Error al crear la solicitud de vacaciones / licencias');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4">Solicitar Vacaciones / Licencias</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha de inicio *
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha de fin *
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate || new Date().toISOString().split('T')[0]}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Razón (opcional)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe el motivo de tus vacaciones / licencias..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              rows={3}
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-white bg-orange-600 rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Enviando...' : 'Solicitar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
