import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Calendar, User, AlertTriangle, Clock, Users, Building2, UserPlus, Trash2, Edit } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { TaskChat } from './TaskChat';
import { AddUserToTaskModal } from './AddUserToTaskModal';
import { EditTaskModal } from './EditTaskModal';

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
  task_manager_id?: string | null;
  assigned_users?: Array<{ id: string; full_name: string; avatar_url?: string }>;
  assigned_departments?: Array<{ id: string; name: string }>;
  created_by_profile?: { id: string; full_name: string; avatar_url?: string | null };
}

interface TaskDetailProps {
  task: Task;
  onBack: () => void;
}

const priorityConfig = {
  urgent: {
    bg: '#FEE2E2',
    border: '#EF4444',
    text: '#991B1B',
    label: 'Urgente',
    icon: AlertTriangle
  },
  medium: {
    bg: '#DBEAFE',
    border: '#3B82F6',
    text: '#1E40AF',
    label: 'Media',
    icon: Clock
  },
  low: {
    bg: '#D1FAE5',
    border: '#10B981',
    text: '#065F46',
    label: 'Baja',
    icon: Clock
  }
};

const statusOptions = [
  { value: 'pending', label: 'Pendiente', color: '#6B7280' },
  { value: 'in_progress', label: 'En Progreso', color: '#3B82F6' },
  { value: 'completed', label: 'Completada', color: '#10B981' },
  { value: 'cancelled', label: 'Cancelada', color: '#EF4444' }
];

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

export function TaskDetail({ task: initialTask, onBack }: TaskDetailProps) {
  const { profile } = useAuth();

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
  const [task, setTask] = useState<Task>(initialTask);
  const [updating, setUpdating] = useState(false);
  const [isAssigned, setIsAssigned] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [taskManager, setTaskManager] = useState<{ id: string; full_name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const cardsContainerRef = useRef<HTMLDivElement>(null);
  const chatInnerRef = useRef<HTMLDivElement>(null);
  const [chatHeight, setChatHeight] = useState<number | null>(null);

  useEffect(() => {
    checkIfAssigned();
    loadAssignments();
    loadTaskManager();
  }, [profile, task.id]);

  // Medir la altura de ambas cards (Información y Asignados) y aplicarla al chat
  useEffect(() => {
    const updateChatHeight = () => {
      if (cardsContainerRef.current && chatInnerRef.current) {
        // Medir la altura total del contenedor que incluye ambas cards y el espacio entre ellas
        // Usar getBoundingClientRect para obtener la altura exacta
        const cardsRect = cardsContainerRef.current.getBoundingClientRect();
        setChatHeight(cardsRect.height);
      }
    };

    // Medir después de que el componente se monte
    updateChatHeight();

    // Medir cuando cambie el tamaño de la ventana
    window.addEventListener('resize', updateChatHeight);

    // Usar ResizeObserver para detectar cambios en las cards
    let resizeObserver: ResizeObserver | null = null;
    if (cardsContainerRef.current) {
      resizeObserver = new ResizeObserver(updateChatHeight);
      resizeObserver.observe(cardsContainerRef.current);
    }

    return () => {
      window.removeEventListener('resize', updateChatHeight);
      if (resizeObserver && cardsContainerRef.current) {
        resizeObserver.unobserve(cardsContainerRef.current);
      }
    };
  }, [task]);

  const loadAssignments = async () => {
    if (!task.id) return;

    try {
      // Obtener asignaciones con información de usuarios y departamentos
      // IMPORTANTE: Obtener TODAS las asignaciones de esta tarea, no solo las del usuario actual
      const { data: assignmentsData, error: assignError } = await supabase
        .from('task_assignments')
        .select(`
          task_id,
          assigned_to_user,
          assigned_to_department,
          profiles:assigned_to_user (id, full_name, avatar_url),
          departments:assigned_to_department (id, name)
        `)
        .eq('task_id', task.id);

      if (assignError) {
        console.error('Error fetching assignments:', assignError);
        throw assignError;
      }

      console.log('📋 Assignments data for task:', task.id, assignmentsData);
      console.log('📋 Total assignments found:', assignmentsData?.length);

      // Agrupar asignaciones (usar Maps para evitar duplicados)
      const assignedUsersMap = new Map<string, { id: string; full_name: string; avatar_url?: string }>();
      const assignedDepartmentsMap = new Map<string, { id: string; name: string }>();

      assignmentsData?.forEach(assignment => {
        // Agregar usuario si existe y no está duplicado
        if (assignment.profiles && assignment.assigned_to_user) {
          const userId = assignment.profiles.id;
          if (!assignedUsersMap.has(userId)) {
            assignedUsersMap.set(userId, assignment.profiles);
          }
        }
        // Agregar departamento si existe y no está duplicado
        if (assignment.departments && assignment.assigned_to_department) {
          const deptId = assignment.departments.id;
          if (!assignedDepartmentsMap.has(deptId)) {
            assignedDepartmentsMap.set(deptId, assignment.departments);
          }
        }
      });

      // Convertir Maps a Arrays
      const assignedUsers = Array.from(assignedUsersMap.values());
      const assignedDepartments = Array.from(assignedDepartmentsMap.values());

      // Actualizar la tarea con las asignaciones
      setTask(prev => ({
        ...prev,
        assigned_users: assignedUsers,
        assigned_departments: assignedDepartments
      }));
    } catch (error) {
      console.error('Error loading assignments:', error);
    }
  };

  const loadTaskManager = async () => {
    if (!task.task_manager_id) {
      setTaskManager(null);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('id', task.task_manager_id)
        .single();

      if (error) throw error;
      setTaskManager(data || null);
    } catch (error) {
      console.error('Error loading task manager:', error);
      setTaskManager(null);
    }
  };

  const checkIfAssigned = async () => {
    if (!profile) return;

    try {
      // Si es admin, siempre puede editar
      if (profile.role === 'admin') {
        setIsAssigned(true);
        return;
      }

      // Si es el creador de la tarea, puede editar
      if (task.created_by === profile.id) {
        setIsAssigned(true);
        return;
      }

      // Si es el administrador de la tarea, puede editar
      if (task.task_manager_id === profile.id) {
        setIsAssigned(true);
        return;
      }

      // Obtener departamentos del usuario
      const { data: userDepts } = await supabase
        .from('user_departments')
        .select('department_id')
        .eq('user_id', profile.id);

      const departmentIds = userDepts?.map(d => d.department_id) || [];

      // Verificar si el usuario está asignado directamente
      const { data: directAssignment } = await supabase
        .from('task_assignments')
        .select('*')
        .eq('task_id', task.id)
        .eq('assigned_to_user', profile.id)
        .maybeSingle();

      if (directAssignment) {
        setIsAssigned(true);
        return;
      }

      // Verificar si está asignado a través de departamento
      if (departmentIds.length > 0) {
        const { data: deptAssignment } = await supabase
          .from('task_assignments')
          .select('*')
          .eq('task_id', task.id)
          .in('assigned_to_department', departmentIds)
          .maybeSingle();

        setIsAssigned(!!deptAssignment);
      } else {
        setIsAssigned(false);
      }
    } catch (error) {
      console.error('Error checking assignment:', error);
    }
  };

  const canEdit = () => {
    if (!profile) return false;
    // Solo admin, creador o administrador de la tarea pueden editar
    // Los usuarios asignados NO pueden editar, solo cambiar el estado
    return (
      profile.role === 'admin' ||
      task.created_by === profile.id ||
      task.task_manager_id === profile.id
    );
  };

  const handleStatusChange = async (newStatus: string) => {
    // Verificar permisos: admin, task_manager, o usuario asignado
    const canChangeStatus = 
      profile?.role === 'admin' || 
      task.task_manager_id === profile?.id ||
      isAssigned;

    if (!canChangeStatus) {
      alert('No tienes permisos para cambiar el estado de esta tarea. Solo el administrador de la tarea, usuarios asignados o administradores del sistema pueden cambiar el estado.');
      return;
    }

    try {
      setUpdating(true);
      console.log('🔄 Updating task status to:', newStatus);

      const { data, error } = await supabase
        .from('tasks')
        .update({ status: newStatus })
        .eq('id', task.id)
        .select()
        .single();

      if (error) {
        console.error('❌ Error updating status:', error);
        throw error;
      }

      console.log('✅ Task status updated:', data);
      setTask(data);
      
      // Recargar asignaciones para asegurar que no se pierdan
      await loadAssignments();
    } catch (error: any) {
      console.error('❌ Error updating status:', error);
      alert(`Error al actualizar el estado: ${error.message || 'Error desconocido'}`);
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!profile || profile.role !== 'admin') {
      alert('Solo los administradores pueden eliminar tareas');
      return;
    }

    const confirmed = window.confirm(
      `¿Estás seguro de que deseas eliminar la tarea "${task.title}"?\n\nEsta acción no se puede deshacer y eliminará también todos los mensajes y archivos asociados.`
    );

    if (!confirmed) return;

    try {
      setDeleting(true);
      console.log('🗑️ Deleting task:', task.id);

      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', task.id);

      if (error) {
        console.error('❌ Error deleting task:', error);
        throw error;
      }

      console.log('✅ Task deleted successfully');
      alert('Tarea eliminada correctamente');
      onBack(); // Volver a la lista de tareas
    } catch (error: any) {
      console.error('❌ Error deleting task:', error);
      alert(`Error al eliminar la tarea: ${error.message || 'Error desconocido'}`);
    } finally {
      setDeleting(false);
    }
  };

  const fetchTask = async () => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          created_by_profile:profiles!tasks_created_by_fkey (
            id,
            full_name,
            avatar_url
          )
        `)
        .eq('id', task.id)
        .single();

      if (error) throw error;
      if (data) {
        setTask(data as Task);
        await loadAssignments();
        await loadTaskManager();
      }
    } catch (error) {
      console.error('Error fetching task:', error);
    }
  };

  const priority = priorityConfig[task.priority];
  const PriorityIcon = priority.icon;

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-slate-900">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 px-6 py-4 flex-shrink-0">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex-1 break-all max-w-full" style={{ wordBreak: 'break-all', overflowWrap: 'anywhere' }}>{task.title}</h1>
          <div className="flex items-center gap-2">
            {canEdit() && (
              <button
                onClick={() => setShowEditModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 dark:bg-indigo-500 text-white rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors"
                title="Editar tarea"
              >
                <Edit className="w-4 h-4" />
                <span>Editar</span>
              </button>
            )}
            {profile?.role === 'admin' && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 dark:bg-red-500 text-white rounded-lg hover:bg-red-700 dark:hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Eliminar tarea"
              >
                {deleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Eliminando...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Eliminar</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Banner de Descripción */}
      {task.description && (
        <div className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 border-b border-indigo-200 dark:border-indigo-800/50 px-6 py-4 flex-shrink-0">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                  <svg className="w-4 h-4 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 uppercase tracking-wide mb-1.5">Descripción</h3>
                <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">{task.description}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-hidden min-h-0">
        <div className="h-full flex flex-col lg:flex-row lg:items-start">
          {/* Información de la Tarea - Panel Izquierdo */}
          <div className="w-full lg:w-80 xl:w-96 flex-shrink-0 border-r border-gray-200 dark:border-slate-700 overflow-y-auto bg-gray-50 dark:bg-slate-900/50">
            <div ref={cardsContainerRef} className="p-4 lg:p-5 space-y-4">
              {/* Información Principal */}
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-5 border border-gray-200 dark:border-slate-700">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 uppercase tracking-wide">Información</h3>
                
                <div className="space-y-3.5">
                  {/* Cliente */}
                  {task.client_name && (
                    <div className="pb-3 border-b border-gray-100 dark:border-slate-700">
                      <div className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                        <User className="w-3.5 h-3.5" />
                        <span>Cliente</span>
                      </div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{task.client_name}</p>
                    </div>
                  )}

                  {/* Creador de la Tarea */}
                  {task.created_by_profile && (
                    <div className="pb-3 border-b border-gray-100 dark:border-slate-700">
                      <div className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                        <User className="w-3.5 h-3.5" />
                        <span>Creada por</span>
                      </div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{task.created_by_profile.full_name}</p>
                    </div>
                  )}

                  {/* Timer de Tarea */}
                  <div className="pb-3 border-b border-gray-100 dark:border-slate-700">
                    <div className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Tiempo</span>
                    </div>
                    <div className="flex flex-col gap-1 text-xs text-gray-700 dark:text-gray-300">
                      <span>⏱️ Creada hace {formatDuration(task.created_at)}</span>
                      {task.completed_at && (
                        <span>✅ Completada en {formatDuration(task.created_at, task.completed_at)}</span>
                      )}
                    </div>
                  </div>

                  {/* Administrador de Tarea */}
                  {taskManager && (
                    <div className="pb-3 border-b border-gray-100 dark:border-slate-700">
                      <div className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                        <User className="w-3.5 h-3.5" />
                        <span>Administrador</span>
                      </div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{taskManager.full_name}</p>
                    </div>
                  )}

                  {/* Fecha Límite - Solo mostrar si la tarea no está completada */}
                  {task.status !== 'completed' && (
                    <div className="pb-3 border-b border-gray-100 dark:border-slate-700">
                      <div className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Fecha Límite</span>
                      </div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {new Date(task.due_date).toLocaleString('es-ES', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  )}

                  {/* Prioridad y Estado en una fila */}
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    {/* Prioridad */}
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                        <PriorityIcon className="w-3.5 h-3.5" />
                        <span>Prioridad</span>
                      </div>
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium"
                        style={{
                          backgroundColor: priority.bg,
                          color: priority.text,
                          border: `1px solid ${priority.border}`
                        }}
                      >
                        {priority.label}
                      </span>
                    </div>

                    {/* Estado */}
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Estado</label>
                      <select
                        value={task.status}
                        onChange={(e) => handleStatusChange(e.target.value)}
                        disabled={
                          !(
                            profile?.role === 'admin' || 
                            task.task_manager_id === profile?.id ||
                            isAssigned
                          ) || updating
                        }
                        className="w-full px-2.5 py-1.5 text-xs border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {statusOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {!(
                    profile?.role === 'admin' || 
                    task.task_manager_id === profile?.id ||
                    isAssigned
                  ) && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      Solo el administrador de la tarea, usuarios asignados o administradores pueden cambiar el estado
                    </p>
                  )}
                </div>
              </div>

              {/* Usuarios y Departamentos Asignados */}
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-5 border border-gray-200 dark:border-slate-700">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Asignados</h3>
                  {profile?.role === 'admin' && (
                    <button
                      onClick={() => setShowAddUserModal(true)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-md transition-colors font-medium"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      Agregar
                    </button>
                  )}
                </div>
                
                {((task.assigned_users && task.assigned_users.length > 0) || (task.assigned_departments && task.assigned_departments.length > 0)) ? (
                  <>
                  
                  {/* Usuarios Asignados */}
                  {task.assigned_users && task.assigned_users.length > 0 && (
                    <div className="mb-4">
                      <div className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400 mb-2.5">
                        <Users className="w-3.5 h-3.5" />
                        <span>Usuarios ({task.assigned_users.length})</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {task.assigned_users.map((user) => {
                          const isCurrentUser = user.id === profile?.id;
                          return (
                            <div
                              key={user.id}
                              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs ${
                                isCurrentUser
                                  ? 'bg-indigo-600 dark:bg-indigo-500 text-white border border-indigo-700 dark:border-indigo-600'
                                  : 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700/50'
                              }`}
                            >
                              {getAvatarUrl(user.avatar_url) ? (
                                <img 
                                  src={getAvatarUrl(user.avatar_url)!} 
                                  alt={user.full_name} 
                                  className={`w-5 h-5 rounded-full object-cover ${isCurrentUser ? 'ring-1 ring-white' : ''}`}
                                />
                              ) : (
                                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-semibold ${
                                  isCurrentUser ? 'bg-indigo-800 dark:bg-indigo-700' : 'bg-indigo-600 dark:bg-indigo-500'
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
                      </div>
                    </div>
                  )}

                  {/* Departamentos Asignados */}
                  {task.assigned_departments && task.assigned_departments.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400 mb-2.5">
                        <Building2 className="w-3.5 h-3.5" />
                        <span>Áreas ({task.assigned_departments.length})</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {task.assigned_departments.map((dept) => (
                          <div
                            key={dept.id}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-700/50 rounded-md text-xs"
                          >
                            <Users className="w-3.5 h-3.5" />
                            <span className="font-medium">{dept.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  </>
                ) : (
                  <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-3">No hay usuarios asignados</p>
                )}
              </div>
            </div>
          </div>

          {/* Chat - Panel Derecho */}
          <div className="w-full lg:w-auto lg:flex-1 min-w-0 p-4 lg:p-5">
            <div ref={chatInnerRef} className="flex flex-col bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden" style={chatHeight ? { height: `${chatHeight}px` } : undefined}>
              <div className="px-4 lg:px-6 py-4 border-b border-gray-200 dark:border-slate-700 flex-shrink-0 bg-white dark:bg-slate-800">
                <h3 className="text-base lg:text-lg font-semibold text-gray-900 dark:text-white">Chat de la Tarea</h3>
              </div>
              <div className="flex-1 min-h-0 overflow-hidden">
                <TaskChat taskId={task.id} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal para agregar usuarios */}
      {showAddUserModal && (
        <AddUserToTaskModal
          taskId={task.id}
          existingUserIds={task.assigned_users?.map(u => u.id) || []}
          onClose={() => setShowAddUserModal(false)}
          onSuccess={() => {
            setShowAddUserModal(false);
            loadAssignments();
          }}
        />
      )}

      {/* Modal para editar tarea */}
      {showEditModal && (
        <EditTaskModal
          task={task}
          onClose={() => setShowEditModal(false)}
          onSuccess={() => {
            setShowEditModal(false);
            // Recargar la tarea actualizada
            fetchTask();
          }}
        />
      )}
    </div>
  );
}

