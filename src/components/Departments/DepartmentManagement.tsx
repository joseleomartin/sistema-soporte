import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Building2, Plus, Edit2, Trash2, Users, CheckCircle, AlertCircle, X } from 'lucide-react';

interface Department {
  id: string;
  name: string;
  description: string;
  color: string;
  created_at: string;
}

interface UserDepartment {
  user_id: string;
  department_id: string;
  profiles: {
    full_name: string;
    email: string;
  };
}

export function DepartmentManagement() {
  const { profile } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    loadDepartments();
  }, []);

  const loadDepartments = async () => {
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .order('name');

      if (error) throw error;
      setDepartments(data || []);
    } catch (error) {
      console.error('Error loading departments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta área?')) return;

    try {
      const { error } = await supabase
        .from('departments')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setMessage({ type: 'success', text: 'Área eliminada correctamente' });
      setTimeout(() => setMessage(null), 3000);
      loadDepartments();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Error al eliminar área' });
      setTimeout(() => setMessage(null), 5000);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Building2 className="w-8 h-8 text-blue-600" />
            Gestión de Areas
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mt-2">
            Organiza usuarios en Areas y grupos de trabajo
          </p>
        </div>
        {profile?.role === 'admin' && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
          >
            <Plus className="w-5 h-5" />
            Nueva Área
          </button>
        )}
      </div>

      {message && (
        <div className={`mb-6 rounded-lg p-4 flex items-start gap-3 ${
          message.type === 'success' 
            ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50' 
            : 'bg-red-50 border border-red-200'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          )}
          <p className={message.type === 'success' ? 'text-green-700' : 'text-red-700'}>
            {message.text}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {departments.map((dept) => (
          <DepartmentCard
            key={dept.id}
            department={dept}
            onEdit={() => {
              setSelectedDepartment(dept);
              setShowEditModal(true);
            }}
            onDelete={() => handleDelete(dept.id)}
            onAssign={() => {
              setSelectedDepartment(dept);
              setShowAssignModal(true);
            }}
            isAdmin={profile?.role === 'admin'}
          />
        ))}
      </div>

      {showCreateModal && (
        <CreateDepartmentModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            loadDepartments();
            setMessage({ type: 'success', text: 'Área creada correctamente' });
            setTimeout(() => setMessage(null), 3000);
          }}
        />
      )}

      {showEditModal && selectedDepartment && (
        <EditDepartmentModal
          department={selectedDepartment}
          onClose={() => {
            setShowEditModal(false);
            setSelectedDepartment(null);
          }}
          onSuccess={() => {
            setShowEditModal(false);
            setSelectedDepartment(null);
            loadDepartments();
            setMessage({ type: 'success', text: 'Área actualizada correctamente' });
            setTimeout(() => setMessage(null), 3000);
          }}
        />
      )}

      {showAssignModal && selectedDepartment && (
        <AssignUsersModal
          department={selectedDepartment}
          onClose={() => {
            setShowAssignModal(false);
            setSelectedDepartment(null);
          }}
          onUpdate={() => {
            // Forzar actualización de los contadores
            loadDepartments();
          }}
        />
      )}
    </div>
  );
}

// Componente de tarjeta de departamento
function DepartmentCard({ department, onEdit, onDelete, onAssign, isAdmin }: {
  department: Department;
  onEdit: () => void;
  onDelete: () => void;
  onAssign: () => void;
  isAdmin: boolean;
}) {
  const [userCount, setUserCount] = useState(0);

  useEffect(() => {
    loadUserCount();

    // Suscripción en tiempo real para actualizar el contador
    const channel = supabase
      .channel(`department-${department.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_departments',
          filter: `department_id=eq.${department.id}`
        },
        (payload) => {
          console.log('🔄 Cambio detectado en departamento:', department.name, payload);
          // Recargar el contador después de un pequeño delay
          setTimeout(() => {
            loadUserCount();
          }, 100);
        }
      )
      .subscribe((status) => {
        console.log('📡 Estado de suscripción para', department.name, ':', status);
      });

    return () => {
      console.log('🔌 Desconectando suscripción para', department.name);
      supabase.removeChannel(channel);
    };
  }, [department.id]);

  const loadUserCount = async () => {
    const { count } = await supabase
      .from('user_departments')
      .select('*', { count: 'exact', head: true })
      .eq('department_id', department.id);

    setUserCount(count || 0);
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6 hover:shadow-md transition">
      <div className="flex items-start justify-between mb-4">
        <div
          className="w-12 h-12 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${department.color}20` }}
        >
          <Building2 className="w-6 h-6" style={{ color: department.color }} />
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <button
              onClick={onEdit}
              className="p-1.5 text-gray-400 hover:text-blue-600 transition"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={onDelete}
              className="p-1.5 text-gray-400 hover:text-red-600 transition"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{department.name}</h3>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 line-clamp-2">{department.description}</p>

      <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-slate-700">
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          <Users className="w-4 h-4" />
          <span>{userCount} {userCount === 1 ? 'usuario' : 'usuarios'}</span>
        </div>
        {isAdmin && (
          <button
            onClick={onAssign}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Asignar
          </button>
        )}
      </div>
    </div>
  );
}

// Modal para crear departamento
function CreateDepartmentModal({ onClose, onSuccess }: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { profile } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#3B82F6');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const colors = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444', 
    '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('El nombre es requerido');
      return;
    }

    if (!profile?.tenant_id) {
      setError('No se pudo identificar la empresa');
      return;
    }

    setLoading(true);

    try {
      const { error: insertError } = await supabase
        .from('departments')
        .insert({
          name: name.trim(),
          description: description.trim(),
          color,
          tenant_id: profile.tenant_id // Agregar tenant_id para aislamiento multi-tenant
        });

      if (insertError) throw insertError;
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Error al crear departamento');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full">
        <div className="border-b border-gray-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Nueva Área</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:text-gray-300">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Nombre <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Contadores"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Descripción
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descripción del área"
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Color
            </label>
            <div className="flex gap-2 flex-wrap">
              {colors.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-10 h-10 rounded-lg transition ${
                    color === c ? 'ring-2 ring-offset-2 ring-blue-500' : ''
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 transition font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50"
            >
              {loading ? 'Creando...' : 'Crear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Modal para editar departamento
function EditDepartmentModal({ department, onClose, onSuccess }: {
  department: Department;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState(department.name);
  const [description, setDescription] = useState(department.description);
  const [color, setColor] = useState(department.color);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const colors = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444', 
    '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('El nombre es requerido');
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase
        .from('departments')
        .update({
          name: name.trim(),
          description: description.trim(),
          color
        })
        .eq('id', department.id);

      if (updateError) throw updateError;
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Error al actualizar departamento');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full">
        <div className="border-b border-gray-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Editar Área</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:text-gray-300">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Nombre <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Descripción
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Color
            </label>
            <div className="flex gap-2 flex-wrap">
              {colors.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-10 h-10 rounded-lg transition ${
                    color === c ? 'ring-2 ring-offset-2 ring-blue-500' : ''
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 transition font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50"
            >
              {loading ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Modal para asignar usuarios
function AssignUsersModal({ department, onClose, onUpdate }: {
  department: Department;
  onClose: () => void;
  onUpdate?: () => void;
}) {
  const { profile } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [assignedUsers, setAssignedUsers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    loadData();
  }, [department.id]);

  const loadData = async () => {
    try {
      // Cargar todos los usuarios
      const { data: usersData } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .order('full_name');

      // Cargar usuarios ya asignados a este departamento
      const { data: assignedData } = await supabase
        .from('user_departments')
        .select('user_id')
        .eq('department_id', department.id);

      setUsers(usersData || []);
      setAssignedUsers(new Set(assignedData?.map(a => a.user_id) || []));
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleUser = async (userId: string) => {
    try {
      if (assignedUsers.has(userId)) {
        // Remover asignación
        console.log('🗑️ Removiendo usuario del departamento:', { userId, departmentId: department.id });
        
        const { error, data } = await supabase
          .from('user_departments')
          .delete()
          .eq('user_id', userId)
          .eq('department_id', department.id)
          .select();

        console.log('🗑️ Resultado del DELETE:', { error, data });

        if (error) throw error;

        setAssignedUsers(prev => {
          const newSet = new Set(prev);
          newSet.delete(userId);
          return newSet;
        });

        setMessage({ type: 'success', text: 'Usuario removido del área' });
      } else {
        // Agregar asignación
        console.log('➕ Agregando usuario al departamento:', { userId, departmentId: department.id });
        
        if (!profile?.tenant_id) {
          setMessage({ type: 'error', text: 'No se pudo identificar la empresa' });
          return;
        }

        const { error, data } = await supabase
          .from('user_departments')
          .insert({
            user_id: userId,
            department_id: department.id,
            assigned_by: profile?.id,
            tenant_id: profile.tenant_id // Agregar tenant_id para aislamiento multi-tenant
          })
          .select();

        console.log('➕ Resultado del INSERT:', { error, data });

        if (error) throw error;

        setAssignedUsers(prev => new Set([...prev, userId]));
        setMessage({ type: 'success', text: 'Usuario asignado al área' });
      }

      // Llamar al callback para actualizar el componente padre
      if (onUpdate) {
        console.log('🔄 Llamando a onUpdate para refrescar contadores');
        onUpdate();
      }

      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      console.error('❌ Error al actualizar asignación:', error);
      setMessage({ type: 'error', text: error.message || 'Error al actualizar asignación' });
      setTimeout(() => setMessage(null), 5000);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        <div className="border-b border-gray-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Asignar Usuarios</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{department.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:text-gray-300">
            <X className="w-6 h-6" />
          </button>
        </div>

        {message && (
          <div className={`mx-6 mt-4 rounded-lg p-3 flex items-start gap-2 ${
            message.type === 'success' 
              ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50' 
              : 'bg-red-50 border border-red-200'
          }`}>
            {message.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            )}
            <p className={`text-sm ${message.type === 'success' ? 'text-green-700' : 'text-red-700'}`}>
              {message.text}
            </p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="space-y-2">
              {users.map((user) => (
                <label
                  key={user.id}
                  className="flex items-center gap-3 p-3 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-50 cursor-pointer transition"
                >
                  <input
                    type="checkbox"
                    checked={assignedUsers.has(user.id)}
                    onChange={() => handleToggleUser(user.id)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 dark:text-white">{user.full_name}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">{user.email}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    user.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                    user.role === 'support' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-700 dark:text-gray-300'
                  }`}>
                    {user.role === 'admin' ? 'Admin' : user.role === 'support' ? 'Soporte' : 'Usuario'}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-gray-200 dark:border-slate-700 px-6 py-4">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

