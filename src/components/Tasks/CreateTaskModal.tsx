import { useState, useEffect } from 'react';
import { X, AlertCircle, Users, User } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface CreateTaskModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

interface Department {
  id: string;
  name: string;
  description: string | null;
}

export function CreateTaskModal({ onClose, onSuccess }: CreateTaskModalProps) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Form fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [clientName, setClientName] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'urgent'>('medium');
  const [assignmentType, setAssignmentType] = useState<'user' | 'department'>('user');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('');
  
  // Data
  const [users, setUsers] = useState<Profile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  useEffect(() => {
    fetchUsers();
    fetchDepartments();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .order('full_name');

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchDepartments = async () => {
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .order('name');

      if (error) throw error;
      setDepartments(data || []);
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  const validateForm = (): string | null => {
    if (!title.trim()) return 'El título es requerido';
    if (!description.trim()) return 'La descripción es requerida';
    if (!clientName.trim()) return 'El nombre del cliente es requerido';
    if (!dueDate) return 'La fecha límite es requerida';
    
    const selectedDate = new Date(dueDate);
    const now = new Date();
    if (selectedDate < now) {
      return 'La fecha límite debe ser futura';
    }

    if (assignmentType === 'user' && selectedUserIds.length === 0) {
      return 'Debes seleccionar al menos un usuario';
    }

    if (assignmentType === 'department' && !selectedDepartmentId) {
      return 'Debes seleccionar un departamento';
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!profile) return;

    try {
      setLoading(true);
      setError('');

      // Crear la tarea
      const { data: taskData, error: taskError } = await supabase
        .from('tasks')
        .insert([
          {
            title: title.trim(),
            description: description.trim(),
            client_name: clientName.trim(),
            due_date: dueDate,
            priority,
            status: 'pending',
            created_by: profile.id
          }
        ])
        .select()
        .single();

      if (taskError) throw taskError;

      // Crear las asignaciones (puede ser múltiples usuarios o un departamento)
      const assignments = [];

      if (assignmentType === 'user') {
        // Crear una asignación por cada usuario seleccionado
        for (const userId of selectedUserIds) {
          assignments.push({
            task_id: taskData.id,
            assigned_to_user: userId,
            assigned_by: profile.id
          });
        }
      } else {
        // Crear una asignación para el departamento
        assignments.push({
          task_id: taskData.id,
          assigned_to_department: selectedDepartmentId,
          assigned_by: profile.id
        });
      }

      const { error: assignmentError } = await supabase
        .from('task_assignments')
        .insert(assignments);

      if (assignmentError) throw assignmentError;

      onSuccess();
    } catch (error: any) {
      console.error('Error creating task:', error);
      setError(error.message || 'Error al crear la tarea');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">Nueva Tarea</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Título */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Título <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Título de la tarea"
              required
            />
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Descripción <span className="text-red-500">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              placeholder="Descripción detallada de la tarea"
              required
            />
          </div>

          {/* Cliente */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cliente <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Nombre del cliente"
              required
            />
          </div>

          {/* Fecha y Hora de Finalización */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fecha y Hora Límite <span className="text-red-500">*</span>
            </label>
            <input
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              required
            />
          </div>

          {/* Prioridad */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Prioridad <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setPriority('low')}
                className={`p-3 rounded-lg border-2 transition-all ${
                  priority === 'low'
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <div className="text-center">
                  <div className="w-4 h-4 rounded-full bg-green-500 mx-auto mb-2"></div>
                  <span className="text-sm font-medium text-gray-900">Baja</span>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setPriority('medium')}
                className={`p-3 rounded-lg border-2 transition-all ${
                  priority === 'medium'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <div className="text-center">
                  <div className="w-4 h-4 rounded-full bg-blue-500 mx-auto mb-2"></div>
                  <span className="text-sm font-medium text-gray-900">Media</span>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setPriority('urgent')}
                className={`p-3 rounded-lg border-2 transition-all ${
                  priority === 'urgent'
                    ? 'border-red-500 bg-red-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <div className="text-center">
                  <div className="w-4 h-4 rounded-full bg-red-500 mx-auto mb-2"></div>
                  <span className="text-sm font-medium text-gray-900">Urgente</span>
                </div>
              </button>
            </div>
          </div>

          {/* Tipo de Asignación */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Asignar a <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                type="button"
                onClick={() => setAssignmentType('user')}
                className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all ${
                  assignmentType === 'user'
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <User className="w-5 h-5" />
                <span className="font-medium">Usuario Individual</span>
              </button>
              <button
                type="button"
                onClick={() => setAssignmentType('department')}
                className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all ${
                  assignmentType === 'department'
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <Users className="w-5 h-5" />
                <span className="font-medium">Departamento</span>
              </button>
            </div>

            {/* Selector de Usuarios Múltiples */}
            {assignmentType === 'user' && (
              <div className="space-y-2">
                <p className="text-sm text-gray-600">Selecciona uno o más usuarios:</p>
                <div className="max-h-48 overflow-y-auto border border-gray-300 rounded-lg p-3 bg-white">
                  {users.length === 0 ? (
                    <p className="text-gray-500 text-sm">No hay usuarios disponibles</p>
                  ) : (
                    users.map((user) => (
                      <label
                        key={user.id}
                        className="flex items-center gap-3 p-2 hover:bg-indigo-50 rounded cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={selectedUserIds.includes(user.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedUserIds([...selectedUserIds, user.id]);
                            } else {
                              setSelectedUserIds(selectedUserIds.filter(id => id !== user.id));
                            }
                          }}
                          className="w-4 h-4 text-indigo-600 rounded focus:ring-2 focus:ring-indigo-500"
                        />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{user.full_name}</p>
                          <p className="text-xs text-gray-500">{user.email}</p>
                        </div>
                      </label>
                    ))
                  )}
                </div>
                {selectedUserIds.length > 0 && (
                  <p className="text-sm text-indigo-600 font-medium">
                    {selectedUserIds.length} usuario(s) seleccionado(s)
                  </p>
                )}
              </div>
            )}

            {/* Selector de Departamento */}
            {assignmentType === 'department' && (
              <select
                value={selectedDepartmentId}
                onChange={(e) => setSelectedDepartmentId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
              >
                <option value="">Selecciona un departamento</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading && (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              )}
              {loading ? 'Creando...' : 'Crear Tarea'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

