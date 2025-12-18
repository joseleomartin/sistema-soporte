import { useState, useEffect } from 'react';
import { X, AlertCircle, User, Check } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface AddUserToTaskModalProps {
  taskId: string;
  existingUserIds: string[];
  onClose: () => void;
  onSuccess: () => void;
}

interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

export function AddUserToTaskModal({ taskId, existingUserIds, onClose, onSuccess }: AddUserToTaskModalProps) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [users, setUsers] = useState<Profile[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .order('full_name');

      if (error) throw error;
      
      // Filtrar usuarios que ya están asignados
      const availableUsers = (data || []).filter(user => !existingUserIds.includes(user.id));
      setUsers(availableUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedUserIds.length === 0) {
      setError('Debes seleccionar al menos un usuario');
      return;
    }

    if (!profile) return;

    try {
      setLoading(true);
      setError('');

      // Crear asignaciones para los usuarios seleccionados
      const assignments = selectedUserIds.map(userId => ({
        task_id: taskId,
        assigned_to_user: userId,
        assigned_by: profile.id
      }));

      const { error: assignmentError } = await supabase
        .from('task_assignments')
        .insert(assignments);

      if (assignmentError) throw assignmentError;

      // Las notificaciones se crearán automáticamente por el trigger existente
      onSuccess();
    } catch (error: any) {
      console.error('Error adding users to task:', error);
      setError(error.message || 'Error al agregar usuarios a la tarea');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Agregar Usuarios a la Tarea</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Lista de Usuarios */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Selecciona uno o más usuarios:
            </label>
            <div className="max-h-64 overflow-y-auto border border-gray-300 rounded-lg p-3 bg-white task-dropdown-scroll">
              {users.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">
                  No hay usuarios disponibles para agregar
                </p>
              ) : (
                users.map((user) => (
                  <label
                    key={user.id}
                    className="flex items-center gap-3 p-3 hover:bg-indigo-50 rounded cursor-pointer transition-colors"
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
                    {selectedUserIds.includes(user.id) && (
                      <Check className="w-5 h-5 text-indigo-600" />
                    )}
                  </label>
                ))
              )}
            </div>
            {selectedUserIds.length > 0 && (
              <p className="text-sm text-indigo-600 font-medium mt-2">
                {selectedUserIds.length} usuario(s) seleccionado(s)
              </p>
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
              disabled={loading || selectedUserIds.length === 0}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading && (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              )}
              {loading ? 'Agregando...' : 'Agregar Usuarios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}



