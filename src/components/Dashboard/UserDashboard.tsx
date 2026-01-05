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
  ChevronDown,
  ChevronUp,
  CheckSquare,
  Plus,
  CheckCircle,
  XCircle,
  Share2,
  Cake,
  AtSign,
  Ticket,
  Bell,
  Heart,
  BookOpen
} from 'lucide-react';
import { CreateEventModal } from '../Calendar/CreateEventModal';
import { EventDetailsModal } from '../Calendar/EventDetailsModal';
import { VacationCalendar } from '../Vacations/VacationsManagement';

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
  type:
    | 'client'
    | 'meeting'
    | 'forum'
    | 'file'
    | 'social_post'
    | 'birthday'
    | 'task_assigned'
    | 'task_mention'
    | 'forum_mention'
    | 'ticket_comment'
    | 'notification'
    | 'calendar_event'
    | 'professional_news';
  title: string;
  date: string;
  icon: any;
  ticket_id?: string;
  task_id?: string;
  subforum_id?: string;
  social_post_id?: string;
  event_id?: string;
  metadata?: any;
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
  const [allVacations, setAllVacations] = useState<any[]>([]);
  const [vacationCalendarDate, setVacationCalendarDate] = useState(new Date());
  const [showVacationCalendarModal, setShowVacationCalendarModal] = useState(false);
  const [showCalendarModal, setShowCalendarModal] = useState(false);

  // Función helper para formatear horas decimales a horas y minutos
  const formatHoursMinutes = (decimalHours: number) => {
    const hours = Math.floor(decimalHours);
    const minutes = Math.round((decimalHours - hours) * 60);
    
    if (hours === 0 && minutes === 0) {
      return '0 min';
    }
    if (hours === 0) {
      return `${minutes} min`;
    }
    if (minutes === 0) {
      return `${hours} ${hours === 1 ? 'hora' : 'horas'}`;
    }
    return `${hours} ${hours === 1 ? 'hora' : 'horas'} ${minutes} min`;
  };

  useEffect(() => {
    if (profile?.id) {
      loadDashboardData();
      loadEvents();
      loadAllVacations(); // Cargar todas las vacaciones para el calendario
      if (profile.role !== 'admin' && profile.role !== 'support') {
        loadUserVacations();
      }
      if (profile.avatar_url) {
        setAvatarUrl(profile.avatar_url);
      }
    }
  }, [profile?.id, profile?.avatar_url, profile?.role]);

  // Detectar si se debe abrir el modal del calendario desde el email
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const openCalendar = urlParams.get('openCalendar');
    
    if (openCalendar === 'true') {
      // Abrir el modal del calendario
      setShowCalendarModal(true);
      
      // Limpiar el parámetro de la URL sin recargar la página
      const newUrl = window.location.pathname + (window.location.hash || '');
      window.history.replaceState({}, '', newUrl);
    }
  }, []);

  useEffect(() => {
    // Recargar eventos cuando cambia el mes
    if (profile?.id) {
      loadEvents();
    }
  }, [currentDate, profile?.id]);

  useEffect(() => {
    // Recargar vacaciones cuando cambia el mes del calendario
    if (profile?.id) {
      loadAllVacations();
    }
  }, [vacationCalendarDate, profile?.id]);

  const loadAllVacations = async () => {
    try {
      // Cargar todas las vacaciones aprobadas y pendientes con información del usuario
      // IMPORTANTE: Esta consulta debe funcionar para TODOS los usuarios, no solo admin/support
      const { data, error } = await supabase
        .from('vacations')
        .select(`
          *,
          user_profile:profiles!vacations_user_id_fkey(full_name, email)
        `)
        .in('status', ['approved', 'pending'])
        .order('start_date', { ascending: true });

      if (error) {
        console.error('Error cargando vacaciones:', error);
        console.error('Detalles del error:', JSON.stringify(error, null, 2));
        setAllVacations([]);
        return;
      }


      // Formatear los datos para el calendario
      const formattedVacations = (data || []).map((vacation: any) => ({
        ...vacation,
        user_profile: vacation.user_profile || { full_name: 'Usuario', email: '' }
      }));

      setAllVacations(formattedVacations);
    } catch (error) {
      console.error('Error cargando todas las vacaciones:', error);
      setAllVacations([]);
    }
  };

  const loadUserVacations = async () => {
    if (!profile?.id || !profile?.tenant_id) return;

    try {
      const { data, error } = await supabase
        .from('vacations')
        .select('*')
        .eq('user_id', profile.id)
        .eq('tenant_id', profile.tenant_id) // Filtrar por tenant_id para aislamiento multi-tenant
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

      // Obtener actividad reciente de múltiples fuentes
      const activities: RecentActivity[] = [];

      // 1. Obtener mensajes del foro del usuario
      const { data: recentMessages } = await supabase
        .from('forum_messages')
        .select('id, content, created_at, subforum_id, subforums(name)')
        .eq('created_by', profile.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (recentMessages) {
        recentMessages.forEach((msg: any) => {
          activities.push({
            id: msg.id,
            type: 'forum' as const,
            title: `Mensaje en ${msg.subforums?.name || 'cliente'}`,
            date: msg.created_at,
            icon: MessageSquare,
            subforum_id: msg.subforum_id,
          });
        });
      }

      // 2. Obtener publicaciones recientes en social (de todos los usuarios)
      const { data: recentSocialPosts } = await supabase
        .from('social_posts')
        .select('id, created_at, user_id, user_profile:profiles!social_posts_user_id_fkey(full_name)')
        .order('created_at', { ascending: false })
        .limit(10);

      if (recentSocialPosts) {
        recentSocialPosts.forEach((post: any) => {
          activities.push({
            id: post.id,
            type: 'social_post' as const,
            title: `${post.user_profile?.full_name || 'Alguien'} publicó en Social`,
            date: post.created_at,
            icon: Share2,
            social_post_id: post.id,
          });
        });
      }

      // 3. Obtener cumpleaños del día
      const today = new Date();
      const todayMonth = today.getMonth() + 1;
      const todayDay = today.getDate();
      
      const { data: birthdayUsers } = await supabase
        .from('profiles')
        .select('id, full_name, birthday')
        .not('birthday', 'is', null);

      if (birthdayUsers) {
        birthdayUsers.forEach((user: any) => {
          if (user.birthday) {
            // Parsear la fecha del cumpleaños (puede venir como string YYYY-MM-DD)
            let birthdayStr = user.birthday;
            if (typeof birthdayStr === 'string' && birthdayStr.includes('T')) {
              birthdayStr = birthdayStr.split('T')[0];
            }
            
            // Extraer mes y día del string
            if (/^\d{4}-\d{2}-\d{2}$/.test(birthdayStr)) {
              const [, month, day] = birthdayStr.split('-').map(Number);
              if (month === todayMonth && day === todayDay) {
                activities.push({
                  id: `birthday-${user.id}`,
                  type: 'birthday' as const,
                  title: `¡Es el cumpleaños de ${user.full_name}! 🎉`,
                  date: new Date().toISOString(),
                  icon: Cake,
                });
              }
            } else {
              // Fallback: usar Date
              const birthdayDate = new Date(birthdayStr + 'T12:00:00');
              if (birthdayDate.getMonth() + 1 === todayMonth && birthdayDate.getDate() === todayDay) {
                activities.push({
                  id: `birthday-${user.id}`,
                  type: 'birthday' as const,
                  title: `¡Es el cumpleaños de ${user.full_name}! 🎉`,
                  date: new Date().toISOString(),
                  icon: Cake,
                });
              }
            }
          }
        });
      }

      // 4. Obtener novedades profesionales recientes (para todos los usuarios)
      const { data: recentNews } = await supabase
        .from('professional_news')
        .select('id, title, created_at')
        .order('created_at', { ascending: false })
        .limit(10);

      if (recentNews) {
        recentNews.forEach((news: any) => {
          activities.push({
            id: `news-${news.id}`,
            type: 'professional_news' as const,
            title: `Nueva novedad profesional: ${news.title}`,
            date: news.created_at,
            icon: BookOpen,
          });
        });
      }

      // 5. Obtener notificaciones recientes (tareas asignadas, menciones, respuestas a tickets)
      const { data: recentNotifications } = await supabase
        .from('notifications')
        .select('id, type, title, message, created_at, task_id, ticket_id, subforum_id, metadata')
        .eq('user_id', profile.id)
        .in('type', ['task_assigned', 'task_mention', 'forum_mention', 'ticket_comment'])
        .order('created_at', { ascending: false })
        .limit(50);

      // Usar un Map para evitar duplicados basados en tipo + ticket_id/task_id
      // Solo guardamos la notificación más reciente de cada combinación
      const seenActivities = new Map<string, { 
        id: string; 
        date: string; 
        title: string; 
        icon: any; 
        type: string;
        ticket_id?: string;
        task_id?: string;
        subforum_id?: string;
        metadata?: any;
      }>();

      if (recentNotifications) {
        recentNotifications.forEach((notif: any) => {
          let icon = Bell;
          let activityTitle = notif.message || notif.title; // Usar el mensaje que es más específico

          // Crear una clave única para agrupar notificaciones similares
          // Para ticket_comment, agrupar por ticket_id
          // Para task_assigned/task_mention, agrupar por task_id
          // Para forum_mention, agrupar por subforum_id
          let uniqueKey: string;
          if (notif.type === 'ticket_comment' && notif.ticket_id) {
            uniqueKey = `ticket_comment-${notif.ticket_id}`;
          } else if ((notif.type === 'task_assigned' || notif.type === 'task_mention') && notif.task_id) {
            uniqueKey = `${notif.type}-${notif.task_id}`;
          } else if (notif.type === 'forum_mention' && notif.subforum_id) {
            uniqueKey = `forum_mention-${notif.subforum_id}`;
          } else {
            // Si no hay ID de referencia, usar el ID de la notificación
            uniqueKey = `${notif.type}-${notif.id}`;
          }

          switch (notif.type) {
            case 'task_assigned':
              icon = CheckSquare;
              activityTitle = activityTitle || 'Nueva tarea asignada';
              break;
            case 'task_mention':
              icon = AtSign;
              activityTitle = activityTitle || 'Fuiste mencionado en una tarea';
              break;
            case 'forum_mention':
              icon = AtSign;
              activityTitle = activityTitle || 'Fuiste mencionado en un chat';
              break;
            case 'ticket_comment':
              icon = Ticket;
              // Extraer información del mensaje para hacerlo más específico
              if (notif.message) {
                activityTitle = notif.message;
              } else {
                activityTitle = activityTitle || 'Nueva respuesta en ticket';
              }
              break;
          }

          // Solo guardar la notificación más reciente de cada grupo
          const existing = seenActivities.get(uniqueKey);
          if (!existing || new Date(notif.created_at) > new Date(existing.date)) {
            seenActivities.set(uniqueKey, {
              id: notif.id,
              date: notif.created_at,
              title: activityTitle,
              icon: icon,
              type: notif.type,
              ticket_id: notif.ticket_id,
              task_id: notif.task_id,
              subforum_id: notif.subforum_id,
              metadata: notif.metadata,
            });
          }
        });

        // Agregar las actividades únicas al array
        seenActivities.forEach((activity) => {
          activities.push({
            id: activity.id,
            type: activity.type as any,
            title: activity.title,
            date: activity.date,
            icon: activity.icon,
            ticket_id: activity.ticket_id,
            task_id: activity.task_id,
            subforum_id: activity.subforum_id,
            metadata: activity.metadata,
          });
        });
      }

      // 6. Obtener eventos de calendario asignados al usuario
      const { data: assignedEvents } = await supabase
        .from('calendar_events')
        .select('id, title, start_date, created_at, created_by_profile:profiles!calendar_events_created_by_fkey(full_name)')
        .eq('assigned_to', profile.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (assignedEvents) {
        assignedEvents.forEach((event: any) => {
          const creatorName = event.created_by_profile?.full_name || 'Un administrador';
          activities.push({
            id: event.id,
            type: 'calendar_event' as const,
            title: `${creatorName} te ha asignado el evento "${event.title}"`,
            date: event.created_at,
            icon: CalendarIcon,
            event_id: event.id,
            metadata: {
              start_date: event.start_date,
            },
          });
        });
      }

      // Ordenar todas las actividades por fecha (más recientes primero) y limitar a 10
      activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const limitedActivities = activities.slice(0, 10);

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

      setRecentActivities(limitedActivities);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadEvents = async () => {
    if (!profile?.id || !profile?.tenant_id) return;

    try {
      // Generar eventos recurrentes antes de cargar (silenciar errores para no bloquear la carga)
      try {
        await supabase.rpc('generate_recurring_events');
      } catch (rpcError) {
        console.warn('Error al generar eventos recurrentes (no crítico):', rpcError);
        // Continuar con la carga aunque falle la generación de eventos recurrentes
      }

      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59);

      // Obtener eventos personales del usuario
      const { data: personalEvents } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('created_by', profile.id)
        .eq('tenant_id', profile.tenant_id) // Filtrar por tenant_id para aislamiento multi-tenant
        .is('assigned_to', null)
        .gte('start_date', startOfMonth.toISOString())
        .lte('start_date', endOfMonth.toISOString());

      // Obtener eventos asignados al usuario
      const { data: assignedEvents } = await supabase
        .from('calendar_events')
        .select('*, created_by_profile:profiles!calendar_events_created_by_fkey(full_name)')
        .eq('assigned_to', profile.id)
        .eq('tenant_id', profile.tenant_id) // Filtrar por tenant_id para aislamiento multi-tenant
        .gte('start_date', startOfMonth.toISOString())
        .lte('start_date', endOfMonth.toISOString());

      // Obtener tareas asignadas al usuario para el mes actual
      let tasks: any[] = [];
      
      if (profile.role === 'admin') {
        // Admin ve todas las tareas de su tenant
        const { data: allTasks } = await supabase
          .from('tasks')
          .select('*, created_by_profile:profiles!tasks_created_by_fkey(full_name)')
          .eq('tenant_id', profile.tenant_id) // Filtrar por tenant_id para aislamiento multi-tenant
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
            .eq('tenant_id', profile.tenant_id) // Filtrar por tenant_id para aislamiento multi-tenant
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
      if (!profile?.tenant_id) {
        setEvents([]);
        return;
      }

      let vacationsQuery = supabase
        .from('vacations')
        .select('*, user_profile:profiles!vacations_user_id_fkey(full_name)')
        .eq('status', 'approved')
        .eq('tenant_id', profile.tenant_id) // Filtrar por tenant_id para aislamiento multi-tenant
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
        // Parsear fechas manualmente para evitar problemas de zona horaria
        const startParts = vacation.start_date.split('-');
        const endParts = vacation.end_date.split('-');
        const start = new Date(
          parseInt(startParts[0]),
          parseInt(startParts[1]) - 1, // Mes es 0-indexed
          parseInt(startParts[2])
        );
        const end = new Date(
          parseInt(endParts[0]),
          parseInt(endParts[1]) - 1, // Mes es 0-indexed
          parseInt(endParts[2])
        );
        
        // Solo crear eventos para días dentro del mes actual
        // Iterar sobre los días usando fechas locales para evitar problemas de zona horaria
        const currentDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
        const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
        
        while (currentDay <= endDay) {
          const dayYear = currentDay.getFullYear();
          const dayMonth = currentDay.getMonth();
          const dayDate = currentDay.getDate();
          
          if (
            dayMonth === currentDate.getMonth() &&
            dayYear === currentDate.getFullYear()
          ) {
            // Crear fecha en formato YYYY-MM-DD para el ID
            const dateStr = `${dayYear}-${String(dayMonth + 1).padStart(2, '0')}-${String(dayDate).padStart(2, '0')}`;
            
            const typeLabel = vacation.type === 'vacation' ? 'Vacaciones' : 'Licencia';
            const typeColor = vacation.type === 'vacation' ? '#F59E0B' : '#A855F7'; // Naranja para vacaciones, púrpura para licencias
            vacationEvents.push({
              id: `vacation-${vacation.id}-${dateStr}`,
              title: profile.role === 'admin' || profile.role === 'support'
                ? `${typeLabel}: ${vacation.user_profile?.full_name || 'Usuario'}`
                : typeLabel,
              start_date: `${dateStr}T00:00:00`,
              end_date: `${dateStr}T23:59:59`,
              color: typeColor,
              isPersonal: vacation.user_id === profile.id,
              isTask: false,
              isVacation: true,
              vacationType: vacation.type,
              vacationId: vacation.id,
              vacationDays: vacation.days_count,
              vacationUser: vacation.user_profile?.full_name
            });
          }
          // Avanzar al siguiente día usando fecha local
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
      // Establecer el parámetro task en la URL para que TasksList lo detecte y abra la tarea directamente
      window.history.replaceState(null, '', window.location.pathname + '#tasks?task=' + taskId);
      // Disparar evento como respaldo por si acaso
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('openTask', {
          detail: { taskId }
        }));
      }, 50);
    } else {
      // Fallback: usar window.location con el parámetro task
      window.location.hash = 'tasks?task=' + taskId;
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('openTask', {
          detail: { taskId }
        }));
      }, 50);
    }
  };

  const handleActivityClick = (activity: RecentActivity) => {
    if (!onNavigate) return;

    switch (activity.type) {
      case 'social_post':
      case 'birthday':
        onNavigate('social');
        break;
      case 'professional_news':
        onNavigate('professional-news');
        break;
      case 'ticket_comment':
        if (activity.ticket_id) {
          // Disparar evento para navegar al ticket específico
          // App.tsx escuchará este evento a través del Sidebar
          window.dispatchEvent(new CustomEvent('navigateToTicket', {
            detail: { ticketId: activity.ticket_id }
          }));
          onNavigate('tickets');
        } else {
          onNavigate('tickets');
        }
        break;
      case 'task_assigned':
      case 'task_mention':
        onNavigate('tasks');
        // Si hay task_id, disparar evento para abrir la tarea específica
        if (activity.task_id) {
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('openTask', {
              detail: { taskId: activity.task_id }
            }));
          }, 100);
        }
        break;
      case 'forum_mention':
      case 'forum':
        onNavigate('forums');
        // Si hay subforum_id, disparar evento para abrir el subforo específico
        if (activity.subforum_id) {
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('openForum', {
              detail: { subforumId: activity.subforum_id }
            }));
          }, 100);
        }
        break;
      case 'calendar_event':
        // Abrir el modal del calendario cuando se hace click en un evento asignado
        setShowCalendarModal(true);
        // Si hay event_id, podríamos seleccionar ese evento específico en el futuro
        if (activity.event_id && activity.metadata?.start_date) {
          // Establecer la fecha del evento en el calendario
          const eventDate = new Date(activity.metadata.start_date);
          setCurrentDate(eventDate);
          setSelectedDate(eventDate);
        }
        break;
      default:
        // Para otros tipos, no hacer nada
        break;
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
          <p className="text-gray-600 dark:text-gray-300 mb-4">Error al cargar el perfil</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-gray-900 dark:text-white rounded-lg hover:bg-blue-700 transition"
          >
            Recargar página
          </button>
        </div>
      </div>
    );
  }

  const statCards: Array<{
    icon: any;
    label: string;
    value: string | number;
    color: string;
    description: string;
    isText?: boolean;
    onClick?: () => void;
  }> = [
    { 
      icon: FolderOpen, 
      label: 'Clientes Asignados', 
      value: stats.clientsAccess, 
      color: 'bg-blue-50 dark:bg-blue-900/30 text-blue-600',
      description: 'Clientes con acceso'
    },
    { 
      icon: MessageSquare, 
      label: 'Mensajes Enviados', 
      value: stats.forumPosts, 
      color: 'bg-purple-50 dark:bg-purple-900/30 text-purple-400',
      description: 'En chats de clientes'
    },
    { 
      icon: CheckSquare, 
      label: 'Tareas Asignadas', 
      value: stats.tasksAssigned, 
      color: 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-400',
      description: 'Tareas pendientes',
      onClick: () => onNavigate?.('tasks')
    },
    { 
      icon: Clock, 
      label: 'Horas Cargadas', 
      value: formatHoursMinutes(stats.totalHours), 
      color: 'bg-orange-50 dark:bg-orange-900/30 text-orange-400',
      description: 'Horas del mes actual',
      isText: false,
      onClick: () => onNavigate?.('time-tracking')
    },
  ];

  const formatDate = (dateString: string) => {
    // Crear fechas en zona horaria local para comparación correcta
    const date = new Date(dateString);
    const now = new Date();
    
    // Obtener fechas en formato YYYY-MM-DD para comparación sin considerar la hora
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const nowOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Calcular diferencia en días
    const diffTime = Math.abs(nowOnly.getTime() - dateOnly.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Hoy';
    if (diffDays === 1) {
      // Verificar si realmente es ayer (no solo 1 día de diferencia)
      const yesterday = new Date(nowOnly);
      yesterday.setDate(yesterday.getDate() - 1);
      if (dateOnly.getTime() === yesterday.getTime()) {
        return 'Ayer';
      }
      return `Hace ${diffDays} días`;
    }
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
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shadow-lg p-4 sm:p-6 md:p-8 mb-4 sm:mb-6 md:mb-8 text-gray-900 dark:text-white">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden bg-white dark:bg-slate-800 flex items-center justify-center flex-shrink-0 ring-2 sm:ring-4 ring-white ring-opacity-50">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <User className="w-8 h-8 sm:w-10 sm:h-10 text-blue-600" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-1 sm:mb-2 truncate">¡Hola, {profile?.full_name}!</h2>
            <p className="text-blue-100 text-sm sm:text-base md:text-lg">
              Bienvenido a tu panel personal
            </p>
          </div>
          <div className="text-left sm:text-right w-full sm:w-auto">
            <p className="text-xs sm:text-sm text-blue-100 mb-1">Miembro desde</p>
            <p className="text-lg sm:text-xl font-semibold">
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6 mb-4 sm:mb-6 md:mb-8">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <div 
              key={stat.label} 
              className={`bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-4 sm:p-5 md:p-6 transition ${
                stat.onClick ? 'cursor-pointer hover:shadow-md hover:border-indigo-300 dark:hover:border-slate-600' : 'hover:shadow-md'
              }`}
              onClick={stat.onClick}
            >
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <div className={`p-2 sm:p-3 rounded-lg ${stat.color}`}>
                  <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
              </div>
              <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">{stat.label}</p>
              <p className={`${stat.isText ? 'text-xl sm:text-2xl' : 'text-2xl sm:text-3xl'} font-bold text-gray-900 dark:text-white mb-1`}>
                {stat.value}
              </p>
              <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">{stat.description}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6 mb-4 sm:mb-6 md:mb-8 items-start">
        {/* Calendario */}
        <div 
          className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-3 sm:p-5 flex flex-col max-h-[600px] overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setShowCalendarModal(true)}
          title="Click para expandir calendario"
        >
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400" />
              <span className="hidden sm:inline">Calendario</span>
            </h3>
            <div className="flex items-center gap-1 sm:gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  previousMonth();
                }}
                className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded transition"
              >
                <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600 dark:text-gray-300" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  nextMonth();
                }}
                className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded transition"
              >
                <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600 dark:text-gray-300" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowCalendarModal(true);
                }}
                className="p-1 sm:p-1.5 hover:bg-blue-50 dark:bg-blue-900/30 rounded transition text-blue-600"
                title="Expandir calendario"
              >
                <ChevronUp className="w-3 h-3 sm:w-4 sm:h-4" />
              </button>
            </div>
          </div>
          
          <div className="mb-2 sm:mb-3">
            <p className="text-center text-sm sm:text-base font-semibold text-gray-900 dark:text-white">
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </p>
          </div>

          {/* Días de la semana */}
          <div className="grid grid-cols-7 gap-0.5 sm:gap-1 mb-1 sm:mb-2">
            {dayNames.map((day) => (
              <div key={day} className="text-center text-[10px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 py-0.5 sm:py-1">
                {day}
              </div>
            ))}
          </div>

          {/* Días del mes */}
          <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
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
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDayClick(day);
                  }}
                  className={`
                    aspect-square flex flex-col items-center justify-center text-xs sm:text-sm rounded-lg transition relative
                    ${isToday(day) 
                      ? 'bg-blue-600 text-white font-bold' 
                      : isSelected(day)
                        ? 'bg-blue-100 dark:bg-blue-600/30 text-blue-900 dark:text-blue-300 font-semibold'
                        : 'hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300'
                    }
                  `}
                >
                  <span className="text-[10px] sm:text-xs">{day}</span>
                  {hasEvents && (
                    <div className="flex gap-0.5 mt-0.5">
                      {dayEvents.slice(0, 3).map((event, idx) => (
                        <div
                          key={idx}
                          className={`w-1 h-1 rounded-full ${
                            event.isTask 
                              ? event.taskPriority === 'urgent' 
                                ? 'bg-red-500 dark:bg-red-400' 
                                : event.taskPriority === 'medium' 
                                  ? 'bg-blue-500 dark:bg-blue-400' 
                                  : 'bg-green-500 dark:bg-green-400'
                              : event.isVacation
                                ? event.vacationType === 'vacation'
                                  ? 'bg-yellow-500 dark:bg-yellow-400'
                                  : 'bg-purple-500 dark:bg-purple-400'
                              : event.isPersonal 
                                ? 'bg-blue-500 dark:bg-blue-400' 
                                : 'bg-purple-500 dark:bg-purple-400'
                          }`}
                          title={
                            event.isTask 
                              ? `Tarea: ${event.title}` 
                              : event.isVacation
                                ? event.vacationType === 'vacation'
                                  ? 'Vacaciones'
                                  : 'Licencia'
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
            <div className="mt-3 sm:mt-4 space-y-1.5 sm:space-y-2 max-h-32 overflow-y-auto flex-shrink-0 dashboard-scroll">
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
                  className={`w-full text-left p-1.5 sm:p-2 rounded-lg text-[10px] sm:text-xs transition hover:shadow-md ${
                    event.isTask
                      ? event.taskPriority === 'urgent'
                        ? 'bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800/50 hover:bg-red-100 dark:hover:bg-red-900/40'
                        : event.taskPriority === 'medium'
                          ? 'bg-blue-50 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-700/50 hover:bg-blue-100 dark:hover:bg-blue-800/50'
                          : 'bg-green-50 dark:bg-green-900/40 border border-green-200 dark:border-green-700/50 hover:bg-green-100 dark:hover:bg-green-800/50'
                      : event.isPersonal 
                        ? 'bg-blue-50 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-700/50 hover:bg-blue-100 dark:hover:bg-blue-800/50' 
                        : 'bg-purple-50 dark:bg-purple-900/40 border border-purple-200 dark:border-purple-700/50 hover:bg-purple-100 dark:hover:bg-purple-800/50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {event.isTask && (
                      <CheckSquare className={`w-3 h-3 flex-shrink-0 ${
                        event.taskPriority === 'urgent' ? 'text-red-600 dark:text-red-400' :
                        event.taskPriority === 'medium' ? 'text-blue-600 dark:text-blue-400' : 'text-green-600 dark:text-green-400'
                      }`} />
                    )}
                    <p className={`font-medium flex-1 ${
                      event.isTask
                        ? event.taskPriority === 'urgent' ? 'text-red-900 dark:text-red-200' :
                          event.taskPriority === 'medium' ? 'text-blue-900 dark:text-blue-200' : 'text-green-900 dark:text-green-200'
                        : event.isPersonal ? 'text-blue-900 dark:text-blue-200' : 'text-purple-900 dark:text-purple-200'
                    }`}>
                      {event.title}
                    </p>
                  </div>
                  {event.isTask && (
                    <>
                      <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                        Cliente: {event.taskClient}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Estado: {event.taskStatus === 'pending' ? 'Pendiente' :
                                 event.taskStatus === 'in_progress' ? 'En Progreso' :
                                 event.taskStatus === 'completed' ? 'Completada' : 'Cancelada'}
                      </p>
                    </>
                  )}
                  {!event.isTask && !event.isPersonal && event.created_by_profile && (
                    <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                      Asignado por: {event.created_by_profile.full_name}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {event.isTask ? 'Click para ir a Tareas' : 'Click para ver detalles'}
                  </p>
                </button>
              ))}
              <button
                onClick={() => setShowEventModal(true)}
                className="w-full mt-2 px-2 sm:px-3 py-1 sm:py-1.5 bg-blue-600 text-white text-[10px] sm:text-xs rounded-lg hover:bg-blue-700 transition"
              >
                + Agregar evento
              </button>
            </div>
          )}

          {/* Desglose de eventos próximos */}
          <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-gray-200 dark:border-slate-700">
            <h4 className="text-[10px] sm:text-xs font-semibold text-gray-500 dark:text-gray-200 mb-1.5 sm:mb-2">Próximos eventos</h4>
            <div className="space-y-1 sm:space-y-1.5 max-h-[200px] sm:max-h-[280px] overflow-y-auto pr-1 sm:pr-2 dashboard-scroll">
              {events.length > 0 ? (
                events
                  .filter(event => {
                    const eventDate = new Date(event.start_date);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    return eventDate >= today;
                  })
                  .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
                  .slice(0, 10)
                  .map((event) => (
                    <button
                      key={event.id}
                      onClick={() => {
                        if (event.isTask) {
                          handleTaskClick(event.taskId);
                        } else {
                          setSelectedEvent(event);
                        }
                      }}
                      className="w-full text-left p-1 sm:p-1.5 rounded text-[10px] sm:text-xs hover:bg-gray-100 dark:hover:bg-slate-700 transition flex items-center gap-1.5 sm:gap-2"
                    >
                      <div className={`w-7 sm:w-8 text-center text-[9px] sm:text-[10px] font-medium flex-shrink-0 ${
                        event.isTask
                          ? event.taskPriority === 'urgent' ? 'text-red-600' :
                            event.taskPriority === 'medium' ? 'text-blue-600' : 'text-green-600'
                          : event.isPersonal ? 'text-blue-600' : 'text-purple-600'
                      }`}>
                        {new Date(event.start_date).getDate()} {new Date(event.start_date).toLocaleDateString('es-ES', { month: 'short' })}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-900 dark:text-white truncate font-medium text-[10px] sm:text-xs">{event.title}</p>
                        {event.isTask && event.taskClient && (
                          <p className="text-[9px] sm:text-[10px] text-gray-500 dark:text-gray-400 truncate">{event.taskClient}</p>
                        )}
                      </div>
                      {event.isTask && (
                        <CheckSquare className={`w-2.5 h-2.5 sm:w-3 sm:h-3 flex-shrink-0 ${
                          event.taskPriority === 'urgent' ? 'text-red-500' :
                          event.taskPriority === 'medium' ? 'text-blue-500' : 'text-green-500'
                        }`} />
                      )}
                      {!event.isTask && !event.isPersonal && (
                        <CalendarIcon className="w-2.5 h-2.5 sm:w-3 sm:h-3 flex-shrink-0 text-purple-500" />
                      )}
                      {event.isPersonal && (
                        <CalendarIcon className="w-2.5 h-2.5 sm:w-3 sm:h-3 flex-shrink-0 text-blue-500" />
                      )}
                    </button>
                  ))
              ) : (
                <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 text-center py-3 sm:py-4">No hay eventos próximos</p>
              )}
            </div>
          </div>
        </div>

        {/* Accesos Rápidos */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-3 sm:p-4 md:p-6 max-h-[600px] overflow-hidden">
          <div className="flex items-center gap-2 mb-3 sm:mb-4">
            <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Accesos Rápidos</h3>
          </div>
          <div className="space-y-2 sm:space-y-3 overflow-y-auto pr-1 sm:pr-2 max-h-[520px] dashboard-scroll">
            <button
              onClick={() => onNavigate?.('forums')}
              className="w-full flex items-center gap-2 sm:gap-3 p-3 sm:p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-800/40 transition cursor-pointer"
            >
              <FolderOpen className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
              <div className="text-left min-w-0">
                <p className="font-medium text-sm sm:text-base text-gray-900 dark:text-white truncate">Mis Clientes</p>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 truncate">Ver archivos y comunicación</p>
              </div>
            </button>
            <button
              onClick={() => onNavigate?.('meetings')}
              className="w-full flex items-center gap-2 sm:gap-3 p-3 sm:p-4 bg-green-50 dark:bg-green-900/30 rounded-lg hover:bg-green-100 dark:hover:bg-green-800/40 transition cursor-pointer"
            >
              <Video className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
              <div className="text-left min-w-0">
                <p className="font-medium text-sm sm:text-base text-gray-900 dark:text-white truncate">Salas de Reunión</p>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 truncate">Únete a videollamadas</p>
              </div>
            </button>
            <button
              onClick={() => onNavigate?.('tools')}
              className="w-full flex items-center gap-2 sm:gap-3 p-3 sm:p-4 bg-purple-50 dark:bg-purple-900/30 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-800/40 transition cursor-pointer"
            >
              <Wrench className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600 dark:text-purple-400 flex-shrink-0" />
              <div className="text-left min-w-0">
                <p className="font-medium text-sm sm:text-base text-gray-900 dark:text-white truncate">Herramientas</p>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 truncate">Extractor de tablas y OCR</p>
              </div>
            </button>
            <button
              onClick={() => onNavigate?.('time-tracking')}
              className="w-full flex items-center gap-2 sm:gap-3 p-3 sm:p-4 bg-orange-50 dark:bg-orange-900/30 rounded-lg hover:bg-orange-100 dark:hover:bg-orange-800/40 transition cursor-pointer"
            >
              <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600 dark:text-orange-400 flex-shrink-0" />
              <div className="text-left min-w-0">
                <p className="font-medium text-sm sm:text-base text-gray-900 dark:text-white truncate">Carga de Horas</p>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 truncate">Registra tus horas trabajadas</p>
              </div>
            </button>
            <button
              onClick={() => onNavigate?.('social')}
              className="w-full flex items-center gap-2 sm:gap-3 p-3 sm:p-4 bg-pink-50 dark:bg-pink-900/30 rounded-lg hover:bg-pink-100 dark:hover:bg-pink-800/40 transition cursor-pointer"
            >
              <Heart className="w-4 h-4 sm:w-5 sm:h-5 text-pink-600 dark:text-pink-400 flex-shrink-0" />
              <div className="text-left min-w-0">
                <p className="font-medium text-sm sm:text-base text-gray-900 dark:text-white truncate">Social</p>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 truncate">Comparte y conecta con tu equipo</p>
              </div>
            </button>
            <button
              onClick={() => onNavigate?.('tasks')}
              className="w-full flex items-center gap-2 sm:gap-3 p-3 sm:p-4 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-800/40 transition cursor-pointer"
            >
              <CheckSquare className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
              <div className="text-left min-w-0">
                <p className="font-medium text-sm sm:text-base text-gray-900 dark:text-white truncate">Tareas</p>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 truncate">Gestiona tus tareas asignadas</p>
              </div>
            </button>
            <button
              onClick={() => onNavigate?.('library')}
              className="w-full flex items-center gap-2 sm:gap-3 p-3 sm:p-4 bg-teal-50 dark:bg-teal-900/30 rounded-lg hover:bg-teal-100 dark:hover:bg-teal-800/40 transition cursor-pointer"
            >
              <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-teal-600 dark:text-teal-400 flex-shrink-0" />
              <div className="text-left min-w-0">
                <p className="font-medium text-sm sm:text-base text-gray-900 dark:text-white truncate">Biblioteca</p>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 truncate">Recursos y cursos disponibles</p>
              </div>
            </button>
          </div>
        </div>

        {/* Actividad Reciente */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-3 sm:p-4 md:p-6 max-h-[600px] flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 mb-3 sm:mb-4">
            <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Actividad Reciente</h3>
          </div>
          {recentActivities.length === 0 ? (
            <div className="text-center py-8 sm:py-12">
              <Activity className="w-10 h-10 sm:w-12 sm:h-12 text-gray-600 dark:text-gray-300 mx-auto mb-3" />
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 mb-2">Sin actividad reciente</p>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                Comienza interactuando con tus clientes
              </p>
            </div>
          ) : (
            <div className="space-y-2 sm:space-y-3 flex-1 overflow-y-auto pr-1 sm:pr-2 min-h-0 dashboard-scroll">
              {recentActivities.map((activity) => {
                const Icon = activity.icon;
                return (
                  <div 
                    key={activity.id} 
                    onClick={() => handleActivityClick(activity)}
                    className="flex items-start gap-2 sm:gap-3 p-2 sm:p-3 border border-gray-200 dark:border-slate-700 rounded-lg hover:border-purple-300 hover:bg-purple-50 dark:bg-purple-900/30 transition cursor-pointer"
                  >
                    <div className="p-1.5 sm:p-2 bg-purple-50 dark:bg-purple-900/30 rounded-lg flex-shrink-0">
                      <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-xs sm:text-sm text-gray-900 dark:text-white truncate">{activity.title}</p>
                      <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 mt-0.5 sm:mt-1">{formatDate(activity.date)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Sección de Vacaciones / Licencias - Solo para usuarios normales */}
      {profile?.role !== 'admin' && profile?.role !== 'support' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-4 sm:p-5 md:p-6 mb-4 sm:mb-6 md:mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3 sm:gap-0">
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600" />
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Vacaciones / Licencias</h3>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-1.5 w-full sm:w-auto">
              <button
                onClick={() => setShowVacationModal(true)}
                className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-xs sm:text-sm"
              >
                <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="truncate">Solicitar Vacaciones / Licencias</span>
              </button>
              <button
                onClick={() => setShowVacationCalendarModal(true)}
                className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs sm:text-sm"
              >
                <CalendarIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>Ver Calendario</span>
              </button>
            </div>
          </div>

          {/* Mis Vacaciones - Dentro de la misma tarjeta */}
          <div className="border-t border-gray-200 dark:border-slate-700 pt-4 mt-4">
            <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-4">Mis Vacaciones / Licencias</h4>

            {userVacations.length === 0 ? (
              <div className="text-center py-8">
                <CalendarIcon className="w-12 h-12 mx-auto mb-3 text-gray-500 dark:text-gray-400" />
                <p className="text-gray-500 dark:text-gray-400 mb-2">No tienes vacaciones / licencias registradas</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Solicita tus vacaciones / licencias haciendo clic en el botón de arriba</p>
              </div>
            ) : (
              <div className="space-y-3">
                {userVacations.map((vacation) => {
                  // Parsear fechas manualmente para evitar problemas de zona horaria
                  const startParts = vacation.start_date.split('-');
                  const endParts = vacation.end_date.split('-');
                  const startDate = new Date(
                    parseInt(startParts[0]),
                    parseInt(startParts[1]) - 1, // Mes es 0-indexed
                    parseInt(startParts[2])
                  );
                  const endDate = new Date(
                    parseInt(endParts[0]),
                    parseInt(endParts[1]) - 1, // Mes es 0-indexed
                    parseInt(endParts[2])
                  );
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
                    <div key={vacation.id} className="flex items-center justify-between p-4 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          {getStatusBadge()}
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {startDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} - {endDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                          <span className="text-sm text-gray-500 dark:text-gray-400">({vacation.days_count} día{vacation.days_count !== 1 ? 's' : ''})</span>
                        </div>
                        {vacation.reason && (
                          <p className="text-sm text-gray-600 dark:text-gray-300">{vacation.reason}</p>
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
        </div>
      )}

      {/* Información de Perfil */}
      <div className="bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-slate-800 dark:to-slate-700 rounded-xl border border-indigo-200 dark:border-slate-600 p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
            <Users className="w-6 h-6 text-indigo-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Tu Perfil</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">Nombre Completo</p>
                <p className="font-medium text-gray-900 dark:text-white">{profile?.full_name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">Email</p>
                <p className="font-medium text-gray-900 dark:text-white">{profile?.email}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">Rol</p>
                <p className="font-medium text-gray-900 dark:text-white capitalize">{profile?.role}</p>
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
          onClose={() => {
            setSelectedEvent(null);
            // Reabrir el modal del calendario si estaba abierto antes
            // El modal del calendario se cerró cuando se seleccionó el evento
            setShowCalendarModal(true);
          }}
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
            loadAllVacations(); // Recargar todas las vacaciones para el calendario
            loadEvents(); // Recargar eventos para mostrar las vacaciones en el calendario
          }}
        />
      )}

      {/* Modal para el calendario de vacaciones */}
      {showVacationCalendarModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-6xl w-full max-h-[90vh] overflow-auto">
            <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-orange-600" />
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Calendario de Vacaciones / Licencias</h2>
              </div>
              <button
                onClick={() => setShowVacationCalendarModal(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                aria-label="Cerrar"
              >
                <XCircle className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
            <div className="p-6">
              <VacationCalendar
                vacations={allVacations}
                currentDate={vacationCalendarDate}
                onDateChange={setVacationCalendarDate}
              />
            </div>
          </div>
        </div>
      )}

      {/* Modal expandido del calendario */}
      {showCalendarModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-0 sm:p-4 z-50" style={{ zIndex: selectedEvent ? 40 : 50 }} onClick={() => {
          if (!selectedEvent) {
            setShowCalendarModal(false);
          }
        }}>
          <div className="bg-white dark:bg-slate-800 rounded-none sm:rounded-xl shadow-xl max-w-6xl w-full h-full sm:h-auto sm:max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                <h2 className="text-lg sm:text-2xl font-semibold text-gray-900 dark:text-white">Calendario</h2>
              </div>
              <button
                onClick={() => setShowCalendarModal(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                aria-label="Cerrar"
              >
                <XCircle className="w-5 h-5 sm:w-6 sm:h-6 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
            <div className="p-2 sm:p-3 md:p-6">
              <div className="flex flex-col lg:flex-row gap-3 sm:gap-4 md:gap-6">
                {/* Calendario expandido */}
                <div className="flex-1 min-w-0 overflow-x-auto">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 gap-3">
                    <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
                      {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                    </h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={previousMonth}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition"
                      >
                        <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                      </button>
                      <button
                        onClick={nextMonth}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition"
                      >
                        <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                      </button>
                    </div>
                  </div>

                  {/* Días de la semana */}
                  <div className="grid grid-cols-7 gap-0.5 sm:gap-1 md:gap-2 mb-2 sm:mb-3 min-w-[280px]">
                    {dayNames.map((day) => (
                      <div key={day} className="text-center text-[10px] sm:text-xs md:text-sm font-semibold text-gray-700 dark:text-gray-300 py-0.5 sm:py-1 md:py-2">
                        {day}
                      </div>
                    ))}
                  </div>

                  {/* Días del mes - versión expandida */}
                  <div className="grid grid-cols-7 gap-0.5 sm:gap-1 md:gap-2 min-w-[280px]">
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
                            aspect-square flex flex-col items-start justify-start p-0.5 sm:p-1 md:p-2 text-[10px] sm:text-xs md:text-sm rounded-md sm:rounded-lg transition relative min-h-[50px] sm:min-h-[60px] md:min-h-[80px] border
                            ${isToday(day) 
                              ? 'bg-blue-600 text-white font-bold border-blue-700' 
                              : isSelected(day)
                                ? 'bg-blue-100 dark:bg-blue-600/30 text-blue-900 dark:text-blue-300 font-semibold border-blue-300 dark:border-blue-600'
                                : 'hover:bg-gray-100 dark:hover:bg-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-slate-700'
                            }
                          `}
                        >
                          <span className="mb-0.5 sm:mb-1 text-[10px] sm:text-xs md:text-sm font-medium">{day}</span>
                          {hasEvents && (
                            <div className="flex flex-col gap-0.5 sm:gap-1 w-full mt-0.5 sm:mt-1">
                              {dayEvents.slice(0, 2).map((event, idx) => (
                                <div
                                  key={idx}
                                  className={`text-[9px] sm:text-[10px] md:text-xs px-0.5 sm:px-1 md:px-1.5 py-0.5 rounded truncate ${
                                    event.isTask 
                                      ? event.taskPriority === 'urgent' 
                                        ? 'bg-red-200 dark:bg-red-900/50 text-red-900 dark:text-red-200 border border-red-300 dark:border-red-700/50' 
                                        : event.taskPriority === 'medium' 
                                          ? 'bg-blue-200 dark:bg-blue-800/60 text-blue-900 dark:text-blue-200 border border-blue-300 dark:border-blue-600/50' 
                                          : 'bg-green-200 dark:bg-green-800/60 text-green-900 dark:text-green-200 border border-green-300 dark:border-green-600/50'
                                      : event.isVacation
                                        ? event.vacationType === 'vacation'
                                          ? 'bg-yellow-200 dark:bg-yellow-900/50 text-yellow-900 dark:text-yellow-200 border border-yellow-300 dark:border-yellow-700/50'
                                          : 'bg-purple-200 dark:bg-purple-800/60 text-purple-900 dark:text-purple-200 border border-purple-300 dark:border-purple-600/50'
                                      : event.isPersonal 
                                        ? 'bg-blue-200 dark:bg-blue-800/60 text-blue-900 dark:text-blue-200 border border-blue-300 dark:border-blue-600/50' 
                                        : 'bg-purple-200 dark:bg-purple-800/60 text-purple-900 dark:text-purple-200 border border-purple-300 dark:border-purple-600/50'
                                  } ${isToday(day) ? 'bg-white dark:bg-slate-800 bg-opacity-30 dark:bg-opacity-50 text-gray-900 dark:text-white border-white/50 dark:border-slate-700/50' : ''}`}
                                  title={event.title}
                                >
                                  <span className="hidden md:inline">{event.title.length > 15 ? `${event.title.substring(0, 15)}...` : event.title}</span>
                                  <span className="hidden sm:inline md:hidden">{event.title.length > 10 ? `${event.title.substring(0, 10)}...` : event.title}</span>
                                  <span className="sm:hidden">{event.title.length > 6 ? `${event.title.substring(0, 6)}...` : event.title}</span>
                                </div>
                              ))}
                              {dayEvents.length > 2 && (
                                <div className={`text-[9px] sm:text-[10px] md:text-xs px-0.5 sm:px-1 md:px-1.5 py-0.5 rounded ${isToday(day) ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-300'}`}>
                                  +{dayEvents.length - 2} más
                                </div>
                              )}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Panel lateral con eventos */}
                <div className="w-full lg:w-80 flex-shrink-0 mt-4 lg:mt-0">
                  <div className="bg-gray-50 dark:bg-slate-900/50 rounded-lg p-3 sm:p-4 lg:sticky lg:top-20">
                    {selectedDayEvents.length > 0 ? (
                      <>
                        <h4 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900 dark:text-white mb-2 sm:mb-3 md:mb-4">
                          Eventos del {selectedDate ? `${selectedDate.getDate()} de ${monthNames[selectedDate.getMonth()]}` : 'día'}
                        </h4>
                        <div className="space-y-2 sm:space-y-3 max-h-[250px] sm:max-h-[400px] md:max-h-[500px] overflow-y-auto dashboard-scroll">
                          {selectedDayEvents.map((event) => (
                            <button
                              key={event.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (event.isTask) {
                                  handleTaskClick(event.taskId);
                                  setShowCalendarModal(false);
                                } else {
                                  setSelectedEvent(event);
                                  // Cerrar el modal del calendario para que el modal de detalles aparezca encima
                                  setShowCalendarModal(false);
                                }
                              }}
                              className={`w-full text-left p-2 sm:p-3 rounded-lg text-xs sm:text-sm transition hover:shadow-md ${
                                event.isTask
                                  ? event.taskPriority === 'urgent'
                                    ? 'bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800/50 hover:bg-red-100 dark:hover:bg-red-900/40'
                                    : event.taskPriority === 'medium'
                                      ? 'bg-blue-50 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-700/50 hover:bg-blue-100 dark:hover:bg-blue-800/50'
                                      : 'bg-green-50 dark:bg-green-900/40 border border-green-200 dark:border-green-700/50 hover:bg-green-100 dark:hover:bg-green-800/50'
                                  : event.isPersonal 
                                    ? 'bg-blue-50 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-700/50 hover:bg-blue-100 dark:hover:bg-blue-800/50' 
                                    : 'bg-purple-50 dark:bg-purple-900/40 border border-purple-200 dark:border-purple-700/50 hover:bg-purple-100 dark:hover:bg-purple-800/50'
                              }`}
                            >
                              <div className="flex items-center gap-2 mb-2">
                                {event.isTask && (
                                  <CheckSquare className={`w-4 h-4 flex-shrink-0 ${
                                    event.taskPriority === 'urgent' ? 'text-red-600 dark:text-red-400' :
                                    event.taskPriority === 'medium' ? 'text-blue-600 dark:text-blue-400' : 'text-green-600 dark:text-green-400'
                                  }`} />
                                )}
                                <p className={`font-semibold flex-1 ${
                                  event.isTask
                                    ? event.taskPriority === 'urgent' ? 'text-red-900 dark:text-red-200' :
                                      event.taskPriority === 'medium' ? 'text-blue-900 dark:text-blue-200' : 'text-green-900 dark:text-green-200'
                                    : event.isPersonal ? 'text-blue-900 dark:text-blue-200' : 'text-purple-900 dark:text-purple-200'
                                }`}>
                                  {event.title}
                                </p>
                              </div>
                              {event.isTask && (
                                <>
                                  <p className="text-xs text-gray-600 dark:text-gray-300 mb-1">
                                    Cliente: {event.taskClient}
                                  </p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Estado: {event.taskStatus === 'pending' ? 'Pendiente' :
                                             event.taskStatus === 'in_progress' ? 'En Progreso' :
                                             event.taskStatus === 'completed' ? 'Completada' : 'Cancelada'}
                                  </p>
                                </>
                              )}
                              {!event.isTask && !event.isPersonal && event.created_by_profile && (
                                <p className="text-xs text-purple-600 dark:text-purple-400">
                                  Asignado por: {event.created_by_profile.full_name}
                                </p>
                              )}
                            </button>
                          ))}
                        </div>
                        <button
                          onClick={() => setShowEventModal(true)}
                          className="w-full mt-3 sm:mt-4 px-3 sm:px-4 py-2 bg-blue-600 text-white text-xs sm:text-sm rounded-lg hover:bg-blue-700 transition"
                        >
                          + Agregar evento
                        </button>
                      </>
                    ) : (
                      <>
                        <h4 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4">Próximos eventos</h4>
                        <div className="space-y-2 max-h-[300px] sm:max-h-[500px] overflow-y-auto dashboard-scroll">
                          {events.length > 0 ? (
                            events
                              .filter(event => {
                                const eventDate = new Date(event.start_date);
                                const today = new Date();
                                today.setHours(0, 0, 0, 0);
                                return eventDate >= today;
                              })
                              .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
                              .slice(0, 15)
                              .map((event) => (
                                <button
                                  key={event.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (event.isTask) {
                                      handleTaskClick(event.taskId);
                                      setShowCalendarModal(false);
                                    } else {
                                      setSelectedEvent(event);
                                    }
                                  }}
                                  className="w-full text-left p-2 rounded text-xs sm:text-sm hover:bg-gray-100 dark:hover:bg-slate-700 transition flex items-center gap-2"
                                >
                                  <div className={`w-10 sm:w-12 text-center text-[10px] sm:text-xs font-medium flex-shrink-0 ${
                                    event.isTask
                                      ? event.taskPriority === 'urgent' ? 'text-red-600 dark:text-red-400' :
                                        event.taskPriority === 'medium' ? 'text-blue-600 dark:text-blue-400' : 'text-green-600 dark:text-green-400'
                                      : event.isPersonal ? 'text-blue-600 dark:text-blue-400' : 'text-purple-600 dark:text-purple-400'
                                  }`}>
                                    {new Date(event.start_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-gray-900 dark:text-white truncate">{event.title}</p>
                                    {event.isTask && event.taskClient && (
                                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{event.taskClient}</p>
                                    )}
                                  </div>
                                  {event.isTask ? (
                                    <CheckSquare className={`w-4 h-4 flex-shrink-0 ${
                                      event.taskPriority === 'urgent' ? 'text-red-500 dark:text-red-400' :
                                      event.taskPriority === 'medium' ? 'text-blue-500 dark:text-blue-400' : 'text-green-500 dark:text-green-400'
                                    }`} />
                                  ) : event.isPersonal ? (
                                    <CalendarIcon className="w-4 h-4 flex-shrink-0 text-blue-500 dark:text-blue-400" />
                                  ) : (
                                    <CalendarIcon className="w-4 h-4 flex-shrink-0 text-purple-500 dark:text-purple-400" />
                                  )}
                                </button>
                              ))
                          ) : (
                            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No hay eventos próximos</p>
                          )}
                        </div>
                        <button
                          onClick={() => setShowEventModal(true)}
                          className="w-full mt-4 px-4 py-2 bg-blue-600 text-gray-900 dark:text-white text-sm rounded-lg hover:bg-blue-700 transition"
                        >
                          + Agregar evento
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
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
  const [type, setType] = useState<'vacation' | 'license'>('vacation');
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

    if (!profile?.id || !profile?.tenant_id) {
      setError('No se pudo identificar el usuario o la empresa');
      return;
    }

    setLoading(true);

    try {
      const { error: insertError } = await supabase
        .from('vacations')
        .insert({
          user_id: profile.id,
          tenant_id: profile.tenant_id, // Asegurar aislamiento multi-tenant
          type: type,
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
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full p-6">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Solicitar Vacaciones / Licencias</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-200 mb-1">
              Tipo *
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setType('vacation')}
                className={`flex-1 px-4 py-2 rounded-lg border-2 transition-colors ${
                  type === 'vacation'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 font-medium'
                    : 'border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700'
                }`}
              >
                Vacaciones
              </button>
              <button
                type="button"
                onClick={() => setType('license')}
                className={`flex-1 px-4 py-2 rounded-lg border-2 transition-colors ${
                  type === 'license'
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30 text-purple-300 font-medium'
                    : 'border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700'
                }`}
              >
                Licencia
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-200 mb-1">
              Fecha de inicio *
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-gray-100 dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-200 mb-1">
              Fecha de fin *
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate || new Date().toISOString().split('T')[0]}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-gray-100 dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-200 mb-1">
              Razón (opcional)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe el motivo de tus vacaciones / licencias..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-gray-100 dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
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
              className="px-4 py-2 text-gray-200 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-gray-900 dark:text-white bg-orange-600 rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Enviando...' : 'Solicitar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
