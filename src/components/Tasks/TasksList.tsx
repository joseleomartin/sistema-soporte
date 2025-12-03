import { useState, useEffect } from 'react';
import { CheckSquare, Plus, Search, Filter, Calendar, User, AlertCircle, Users, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { CreateTaskModal } from './CreateTaskModal';
import { TaskDetail } from './TaskDetail';

interface Task {
  id: string;
  title: string;
  description: string;
  client_name: string | null;
  due_date: string;
  priority: 'low' | 'medium' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  created_by: string;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
  assigned_users?: Array<{ id: string; full_name: string; avatar_url?: string }>;
  assigned_departments?: Array<{ id: string; name: string }>;
}

// Función para formatear duración
const formatDuration = (startDate: string, endDate?: string | null): string => {
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : new Date();
  const diffMs = end.getTime() - start.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (diffDays > 0) {
    return `${diffDays} día${diffDays !== 1 ? 's' : ''}`;
  } else if (diffHours > 0) {
    return `${diffHours} hora${diffHours !== 1 ? 's' : ''}`;
  } else {
    return `${diffMinutes} minuto${diffMinutes !== 1 ? 's' : ''}`;
  }
};

const priorityConfig = {
  urgent: {
    bg: '#FEE2E2',
    border: '#EF4444',
    text: '#991B1B',
    label: 'Urgente'
  },
  medium: {
    bg: '#DBEAFE',
    border: '#3B82F6',
    text: '#1E40AF',
    label: 'Media'
  },
  low: {
    bg: '#D1FAE5',
    border: '#10B981',
    text: '#065F46',
    label: 'Baja'
  }
};

const statusConfig = {
  pending: { label: 'Pendiente', color: '#6B7280' },
  in_progress: { label: 'En Progreso', color: '#3B82F6' },
  completed: { label: 'Completada', color: '#10B981' },
  cancelled: { label: 'Cancelada', color: '#EF4444' }
};

export function TasksList() {
  const { profile } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  const getAvatarUrl = (avatarPath: string | null | undefined) => {
    if (!avatarPath) return null;
    
    // Si ya es una URL completa, usarla directamente
    if (avatarPath.startsWith('http://') || avatarPath.startsWith('https://')) {
      return avatarPath;
    }
    
    // Si es un path relativo, obtener la URL pública
    const { data } = supabase.storage
      .from('avatars')
      .getPublicUrl(avatarPath);
    
    return data.publicUrl;
  };

  useEffect(() => {
    fetchTasks();
  }, [profile]);

  // Verificar si hay un parámetro task en la URL después de cargar las tareas
  useEffect(() => {
    if (loading || tasks.length === 0) return;
    
    const hash = window.location.hash;
    const taskMatch = hash.match(/[?&]task=([^&]+)/);
    if (taskMatch) {
      const taskId = taskMatch[1];
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        setSelectedTask(task);
        // Limpiar el parámetro de la URL
        window.history.replaceState(null, '', window.location.pathname + '#tasks');
      }
    }
  }, [loading, tasks]);

  useEffect(() => {
    filterTasks();
  }, [tasks, searchQuery, statusFilter, priorityFilter]);

  // Escuchar evento para abrir tarea desde notificación
  useEffect(() => {
    const handleOpenTask = async (event: CustomEvent) => {
      const { taskId } = event.detail;
      if (!taskId) return;

      // Función auxiliar para abrir la tarea
      const openTaskById = async (taskIdToOpen: string) => {
        // Si las tareas ya están cargadas, buscar la tarea
        if (tasks.length > 0) {
          const task = tasks.find(t => t.id === taskIdToOpen);
          if (task) {
            setSelectedTask(task);
            return;
          }
        }

        // Si no está en la lista, cargarla directamente desde la base de datos
        try {
          const { data, error } = await supabase
            .from('tasks')
            .select('*')
            .eq('id', taskIdToOpen)
            .single();

          if (error) throw error;
          if (data) {
            setSelectedTask(data as Task);
          }
        } catch (error) {
          console.error('Error al cargar la tarea:', error);
        }
      };

      // Si las tareas aún no están cargadas, esperar un poco y reintentar
      if (loading) {
        // Esperar a que termine de cargar
        const checkInterval = setInterval(() => {
          if (!loading && tasks.length > 0) {
            clearInterval(checkInterval);
            openTaskById(taskId);
          }
        }, 100);

        // Timeout después de 3 segundos
        setTimeout(() => {
          clearInterval(checkInterval);
          openTaskById(taskId);
        }, 3000);
      } else {
        openTaskById(taskId);
      }
    };

    window.addEventListener('openTask', handleOpenTask as EventListener);

    return () => {
      window.removeEventListener('openTask', handleOpenTask as EventListener);
    };
  }, [tasks, loading]);

  const fetchTasks = async () => {
    if (!profile) return;

    try {
      setLoading(true);

      // Obtener tareas con sus asignaciones
      let tasksData: Task[] = [];
      
      // Si es admin, obtener todas las tareas
      if (profile.role === 'admin') {
        const { data, error } = await supabase
          .from('tasks')
          .select('*')
          .order('due_date', { ascending: true });

        if (error) throw error;
        tasksData = data || [];
      } else {
        // Si es usuario regular, obtener departamentos del usuario
        const { data: userDepts, error: deptsError } = await supabase
          .from('user_departments')
          .select('department_id')
          .eq('user_id', profile.id);

        if (deptsError) throw deptsError;

        const departmentIds = userDepts?.map(d => d.department_id) || [];

        // Obtener tareas asignadas directamente al usuario O a sus departamentos
        let query = supabase
          .from('task_assignments')
          .select('task_id')
          .eq('assigned_to_user', profile.id);

        // Si el usuario tiene departamentos, agregar esas tareas también
        if (departmentIds.length > 0) {
          const { data: deptAssignments, error: deptError } = await supabase
            .from('task_assignments')
            .select('task_id')
            .in('assigned_to_department', departmentIds);

          if (deptError) throw deptError;

          const { data: userAssignments, error: userError } = await query;
          if (userError) throw userError;

          // Combinar ambos sets de task_ids (sin duplicados)
          const allTaskIds = new Set([
            ...(userAssignments?.map(a => a.task_id) || []),
            ...(deptAssignments?.map(a => a.task_id) || [])
          ]);

          const taskIds = Array.from(allTaskIds);

          if (taskIds.length > 0) {
            const { data, error } = await supabase
              .from('tasks')
              .select('*')
              .in('id', taskIds)
              .order('due_date', { ascending: true });

            if (error) throw error;
            tasksData = data || [];
          }
        } else {
          // Solo tareas asignadas directamente al usuario
          const { data: assignments, error: assignError } = await query;
          if (assignError) throw assignError;

          const taskIds = assignments?.map(a => a.task_id) || [];

          if (taskIds.length > 0) {
            const { data, error } = await supabase
              .from('tasks')
              .select('*')
              .in('id', taskIds)
              .order('due_date', { ascending: true });

            if (error) throw error;
            tasksData = data || [];
          }
        }
      }

      // Cargar asignaciones de usuarios y departamentos para cada tarea
      if (tasksData.length > 0) {
        const taskIds = tasksData.map(t => t.id);
        
        // Obtener asignaciones con información de usuarios
        // IMPORTANTE: No filtrar por usuario, obtener TODAS las asignaciones de estas tareas
        const { data: assignmentsData, error: assignError } = await supabase
          .from('task_assignments')
          .select(`
            task_id,
            assigned_to_user,
            assigned_to_department,
            profiles:assigned_to_user (id, full_name, avatar_url),
            departments:assigned_to_department (id, name)
          `)
          .in('task_id', taskIds);

        if (assignError) {
          console.error('Error fetching assignments:', assignError);
          throw assignError;
        }

        console.log('📋 Assignments data for tasks:', assignmentsData);
        console.log('📋 Total assignments found:', assignmentsData?.length);

        // Agrupar asignaciones por task_id
        const taskAssignments = new Map();
        assignmentsData?.forEach(assignment => {
          if (!taskAssignments.has(assignment.task_id)) {
            taskAssignments.set(assignment.task_id, { 
              users: new Map(), // Usar Map para evitar duplicados
              departments: new Map() 
            });
          }
          // Agregar usuario si existe y no está duplicado
          if (assignment.profiles && assignment.assigned_to_user) {
            const userId = assignment.profiles.id;
            if (!taskAssignments.get(assignment.task_id).users.has(userId)) {
              taskAssignments.get(assignment.task_id).users.set(userId, assignment.profiles);
            }
          }
          // Agregar departamento si existe y no está duplicado
          if (assignment.departments && assignment.assigned_to_department) {
            const deptId = assignment.departments.id;
            if (!taskAssignments.get(assignment.task_id).departments.has(deptId)) {
              taskAssignments.get(assignment.task_id).departments.set(deptId, assignment.departments);
            }
          }
        });

        // Convertir Maps a Arrays
        taskAssignments.forEach((value, taskId) => {
          taskAssignments.set(taskId, {
            users: Array.from(value.users.values()),
            departments: Array.from(value.departments.values())
          });
        });

        // Agregar asignaciones a las tareas
        tasksData = tasksData.map(task => ({
          ...task,
          assigned_users: taskAssignments.get(task.id)?.users || [],
          assigned_departments: taskAssignments.get(task.id)?.departments || []
        }));
      }

      setTasks(tasksData);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterTasks = () => {
    let filtered = [...tasks];

    // Filtro de búsqueda
    if (searchQuery) {
      filtered = filtered.filter(task =>
        task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (task.client_name && task.client_name.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    // Filtro de estado
    if (statusFilter !== 'all') {
      filtered = filtered.filter(task => task.status === statusFilter);
    }

    // Filtro de prioridad
    if (priorityFilter !== 'all') {
      filtered = filtered.filter(task => task.priority === priorityFilter);
    }

    setFilteredTasks(filtered);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    
    // Comparar solo las fechas (sin hora) para determinar si es hoy, mañana, etc.
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const nowOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffDays = Math.round((dateOnly.getTime() - nowOnly.getTime()) / (1000 * 60 * 60 * 24));

    // Verificar si está vencida (comparando fecha y hora completa)
    const diffTime = date.getTime() - now.getTime();
    const isOverdue = diffTime < 0;

    if (isOverdue) {
      return { text: 'Vencida', color: '#EF4444' };
    } else if (diffDays === 0) {
      return { text: 'Hoy', color: '#F59E0B' };
    } else if (diffDays === 1) {
      return { text: 'Mañana', color: '#F59E0B' };
    } else if (diffDays <= 7) {
      return { text: `En ${diffDays} días`, color: '#3B82F6' };
    } else {
      return { text: date.toLocaleDateString(), color: '#6B7280' };
    }
  };

  if (selectedTask) {
    return (
      <TaskDetail
        task={selectedTask}
        onBack={() => {
          setSelectedTask(null);
          fetchTasks();
        }}
      />
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <CheckSquare className="w-6 h-6 text-indigo-600" />
            <h1 className="text-2xl font-bold text-gray-900">Tareas</h1>
          </div>
          {profile?.role === 'admin' && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Nueva Tarea
            </button>
          )}
        </div>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Búsqueda */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por título o cliente..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {/* Filtro de estado */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            <option value="all">Todos los estados</option>
            <option value="pending">Pendiente</option>
            <option value="in_progress">En Progreso</option>
            <option value="completed">Completada</option>
            <option value="cancelled">Cancelada</option>
          </select>

          {/* Filtro de prioridad */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            <option value="all">Todas las prioridades</option>
            <option value="urgent">Urgente</option>
            <option value="medium">Media</option>
            <option value="low">Baja</option>
          </select>
        </div>
      </div>

      {/* Lista de Tareas */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <CheckSquare className="w-16 h-16 mb-4 opacity-50" />
            <p className="text-lg font-medium">No hay tareas</p>
            <p className="text-sm">
              {searchQuery || statusFilter !== 'all' || priorityFilter !== 'all'
                ? 'No se encontraron tareas con los filtros aplicados'
                : 'Aún no hay tareas asignadas'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTasks.map((task) => {
              const priority = priorityConfig[task.priority];
              const status = statusConfig[task.status];
              const dueDate = formatDate(task.due_date);

              return (
                <div
                  key={task.id}
                  onClick={() => setSelectedTask(task)}
                  className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer overflow-hidden"
                  style={{ borderLeft: `4px solid ${priority.border}` }}
                >
                  <div className="p-4">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="font-semibold text-gray-900 text-lg flex-1 pr-2">
                        {task.title}
                      </h3>
                      <span
                        className="px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap"
                        style={{
                          backgroundColor: priority.bg,
                          color: priority.text,
                          border: `1px solid ${priority.border}`
                        }}
                      >
                        {priority.label}
                      </span>
                    </div>

                    {/* Cliente */}
                    {task.client_name && (
                      <div className="flex items-center gap-2 mb-2 text-sm text-gray-600">
                        <User className="w-4 h-4" />
                        <span>{task.client_name}</span>
                      </div>
                    )}

                    {/* Timer de Tarea */}
                    <div className="flex items-center gap-2 mb-2 text-xs text-gray-500">
                      <Clock className="w-3.5 h-3.5" />
                      <span>⏱️ Creada hace {formatDuration(task.created_at)}</span>
                      {task.completed_at && (
                        <span className="ml-2">✅ Completada en {formatDuration(task.created_at, task.completed_at)}</span>
                      )}
                    </div>

                    {/* Fecha límite - Solo mostrar si la tarea no está completada */}
                    {task.status !== 'completed' && (
                      <div className="flex items-center gap-2 mb-3 text-sm">
                        <Calendar className="w-4 h-4" style={{ color: dueDate.color }} />
                        <span style={{ color: dueDate.color }} className="font-medium">
                          {dueDate.text}
                        </span>
                      </div>
                    )}

                    {/* Estado */}
                    <div className="flex items-center justify-between">
                      <span
                        className="px-2 py-1 rounded-full text-xs font-medium"
                        style={{
                          backgroundColor: `${status.color}20`,
                          color: status.color
                        }}
                      >
                        {status.label}
                      </span>
                      {dueDate.color === '#EF4444' && (
                        <AlertCircle className="w-5 h-5 text-red-500" />
                      )}
                    </div>

                    {/* Usuarios Asignados */}
                    {((task.assigned_users && task.assigned_users.length > 0) || (task.assigned_departments && task.assigned_departments.length > 0)) && (
                      <div className="flex items-start gap-2 mt-3 pt-3 border-t border-gray-200">
                        <Users className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                        <div className="flex flex-wrap gap-2 flex-1">
                          {task.assigned_users?.map((user) => {
                            const isCurrentUser = user.id === profile?.id;
                            return (
                              <div
                                key={user.id}
                                className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs ${
                                  isCurrentUser
                                    ? 'bg-indigo-600 text-white border-2 border-indigo-700'
                                    : 'bg-indigo-50 text-indigo-700'
                                }`}
                                title={isCurrentUser ? 'Tú' : user.full_name}
                              >
                                {getAvatarUrl(user.avatar_url) ? (
                                  <img 
                                    src={getAvatarUrl(user.avatar_url)!} 
                                    alt={user.full_name} 
                                    className={`w-5 h-5 rounded-full object-cover ${isCurrentUser ? 'ring-2 ring-white' : ''}`}
                                  />
                                ) : (
                                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-medium ${
                                    isCurrentUser ? 'bg-indigo-800' : 'bg-indigo-600'
                                  }`}>
                                    {user.full_name.charAt(0).toUpperCase()}
                                  </div>
                                )}
                                <span className="font-medium">
                                  {isCurrentUser ? 'Tú' : user.full_name}
                                </span>
                              </div>
                            );
                          })}
                          {task.assigned_departments?.map((dept) => (
                            <div
                              key={dept.id}
                              className="flex items-center gap-1.5 px-2 py-1 bg-purple-50 rounded-full text-xs text-purple-700"
                              title={`Área: ${dept.name}`}
                            >
                              <Users className="w-3.5 h-3.5" />
                              <span className="font-medium">{dept.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal de Crear Tarea */}
      {showCreateModal && (
        <CreateTaskModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            fetchTasks();
          }}
        />
      )}
    </div>
  );
}

