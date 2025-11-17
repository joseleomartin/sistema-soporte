import { useState, useEffect } from 'react';
import { ArrowLeft, Calendar, User, AlertTriangle, Clock, Users, Building2, UserPlus, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { TaskChat } from './TaskChat';
import { AddUserToTaskModal } from './AddUserToTaskModal';

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
  const [task, setTask] = useState<Task>(initialTask);
  const [updating, setUpdating] = useState(false);
  const [isAssigned, setIsAssigned] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [taskManager, setTaskManager] = useState<{ id: string; full_name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    checkIfAssigned();
    loadAssignments();
    loadTaskManager();
  }, [profile, task.id]);

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

  const priority = priorityConfig[task.priority];
  const PriorityIcon = priority.icon;

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900 flex-1">{task.title}</h1>
          {profile?.role === 'admin' && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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

      {/* Content */}
      <div className="flex-1 overflow-auto min-h-0">
        <div className="max-w-6xl mx-auto p-6 h-full">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
            {/* Información de la Tarea */}
            <div className="lg:col-span-1 space-y-6">
              {/* Cliente */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-sm font-medium text-gray-500 mb-4">Información</h3>
                
                <div className="space-y-4">
                  {/* Cliente */}
                  {task.client_name && (
                    <div>
                      <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                        <User className="w-4 h-4" />
                        <span>Cliente</span>
                      </div>
                      <p className="text-base font-medium text-gray-900">{task.client_name}</p>
                    </div>
                  )}

                  {/* Timer de Tarea */}
                  <div>
                    <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                      <Clock className="w-4 h-4" />
                      <span>Tiempo</span>
                    </div>
                    <div className="flex flex-col gap-1 text-sm text-gray-700">
                      <span>⏱️ Creada hace {formatDuration(task.created_at)}</span>
                      {task.completed_at && (
                        <span>✅ Completada en {formatDuration(task.created_at, task.completed_at)}</span>
                      )}
                    </div>
                  </div>

                  {/* Administrador de Tarea */}
                  {taskManager && (
                    <div>
                      <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                        <User className="w-4 h-4" />
                        <span>Administrador</span>
                      </div>
                      <p className="text-base font-medium text-gray-900">{taskManager.full_name}</p>
                    </div>
                  )}

                  {/* Fecha Límite */}
                  <div>
                    <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                      <Calendar className="w-4 h-4" />
                      <span>Fecha Límite</span>
                    </div>
                    <p className="text-base font-medium text-gray-900">
                      {new Date(task.due_date).toLocaleString('es-ES', {
                        dateStyle: 'full',
                        timeStyle: 'short'
                      })}
                    </p>
                  </div>

                  {/* Prioridad */}
                  <div>
                    <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                      <PriorityIcon className="w-4 h-4" />
                      <span>Prioridad</span>
                    </div>
                    <span
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium"
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
                    <label className="block text-sm text-gray-500 mb-2">Estado</label>
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {statusOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    {!(
                      profile?.role === 'admin' || 
                      task.task_manager_id === profile?.id ||
                      isAssigned
                    ) && (
                      <p className="text-xs text-gray-500 mt-1">
                        Solo el administrador de la tarea, usuarios asignados o administradores pueden cambiar el estado
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Descripción */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-sm font-medium text-gray-500 mb-3">Descripción</h3>
                <p className="text-gray-700 whitespace-pre-wrap">{task.description}</p>
              </div>

              {/* Usuarios y Departamentos Asignados */}
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-gray-500">Asignados</h3>
                  {profile?.role === 'admin' && (
                    <button
                      onClick={() => setShowAddUserModal(true)}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    >
                      <UserPlus className="w-4 h-4" />
                      Agregar Usuario
                    </button>
                  )}
                </div>
                
                {((task.assigned_users && task.assigned_users.length > 0) || (task.assigned_departments && task.assigned_departments.length > 0)) ? (
                  <>
                  
                  {/* Usuarios Asignados */}
                  {task.assigned_users && task.assigned_users.length > 0 && (
                    <div className="mb-4">
                      <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
                        <Users className="w-4 h-4" />
                        <span>Usuarios ({task.assigned_users.length})</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {task.assigned_users.map((user) => {
                          const isCurrentUser = user.id === profile?.id;
                          return (
                            <div
                              key={user.id}
                              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                                isCurrentUser
                                  ? 'bg-indigo-600 text-white border-2 border-indigo-700'
                                  : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                              }`}
                            >
                              {user.avatar_url ? (
                                <img 
                                  src={user.avatar_url} 
                                  alt={user.full_name} 
                                  className={`w-6 h-6 rounded-full object-cover ${isCurrentUser ? 'ring-2 ring-white' : ''}`}
                                />
                              ) : (
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium ${
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
                      </div>
                    </div>
                  )}

                  {/* Departamentos Asignados */}
                  {task.assigned_departments && task.assigned_departments.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
                        <Building2 className="w-4 h-4" />
                        <span>Áreas ({task.assigned_departments.length})</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {task.assigned_departments.map((dept) => (
                          <div
                            key={dept.id}
                            className="flex items-center gap-2 px-3 py-2 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-sm"
                          >
                            <Users className="w-4 h-4" />
                            <span className="font-medium">{dept.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  </>
                ) : (
                  <p className="text-sm text-gray-500 text-center py-4">No hay usuarios asignados</p>
                )}
              </div>
            </div>

            {/* Chat */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-lg shadow-sm h-[600px] flex flex-col overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 flex-shrink-0">
                  <h3 className="text-lg font-semibold text-gray-900">Chat de la Tarea</h3>
                </div>
                <div className="flex-1 min-h-0 overflow-hidden">
                  <TaskChat taskId={task.id} />
                </div>
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
    </div>
  );
}

