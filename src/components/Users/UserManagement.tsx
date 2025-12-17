import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Users, Search, CheckCircle, AlertCircle, Building2, X, Plus } from 'lucide-react';

interface Department {
  id: string;
  name: string;
  color: string;
}

interface User {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'support' | 'user';
  created_at: string;
  departments?: Department[];
}

export function UserManagement() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    filterUsers();
  }, [users, searchTerm]);

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) {
        // Cargar áreas para cada usuario
        const usersWithDepartments = await Promise.all(
          data.map(async (user) => {
            const { data: deptData } = await supabase
              .from('user_departments')
              .select(`
                department_id,
                departments:department_id (id, name, color)
              `)
              .eq('user_id', user.id);

            const departments = deptData?.map((d: any) => d.departments).filter(Boolean) || [];
            return { ...user, departments };
          })
        );
        setUsers(usersWithDepartments);
      }
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterUsers = () => {
    if (!searchTerm) {
      setFilteredUsers(users);
      return;
    }

    const filtered = users.filter(user =>
      user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    setFilteredUsers(filtered);
  };

  const handleRoleChange = async (userId: string, newRole: 'admin' | 'support' | 'user') => {
    try {
      console.log('🔄 Intentando actualizar rol:', { userId, newRole });
      
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);

      if (error) {
        console.error('❌ Error al actualizar rol:', error);
        throw error;
      }

      console.log('✅ Rol actualizado exitosamente');
      setMessage({ type: 'success', text: 'Rol actualizado correctamente' });
      setTimeout(() => setMessage(null), 3000);
      
      await loadUsers();
    } catch (error: any) {
      console.error('Error updating role:', error);
      setMessage({ 
        type: 'error', 
        text: error.message || 'Error al actualizar el rol. Verifica tus permisos.' 
      });
      setTimeout(() => setMessage(null), 5000);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400"></div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Gestión de Usuarios</h2>

      {message && (
        <div className={`mb-6 rounded-lg p-4 flex items-start gap-3 ${
          message.type === 'success' 
            ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50' 
            : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          )}
          <p className={message.type === 'success' ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}>
            {message.text}
          </p>
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 mb-6 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            placeholder="Buscar usuarios..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-slate-700 border-b border-gray-200 dark:border-slate-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Usuario
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Rol
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Áreas
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Fecha de Registro
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                  <Users className="w-12 h-12 mx-auto mb-2 text-gray-400 dark:text-gray-600" />
                  <p>No se encontraron usuarios</p>
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900 dark:text-white">{user.full_name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-600 dark:text-gray-300">{user.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <select
                      value={user.role}
                      onChange={(e) => handleRoleChange(user.id, e.target.value as 'admin' | 'support' | 'user')}
                      className={`px-3 py-1 text-xs font-medium rounded-full border-0 ${
                        user.role === 'admin' ? 'bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300' :
                        user.role === 'support' ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' :
                        'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      <option value="user">Usuario</option>
                      <option value="support">Soporte</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      {user.departments && user.departments.length > 0 ? (
                        user.departments.map((dept) => (
                          <span
                            key={dept.id}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-700/50"
                            style={{ borderColor: dept.color || '#9333EA' }}
                          >
                            <Building2 className="w-3 h-3" />
                            {dept.name}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-gray-400 dark:text-gray-500">Sin áreas</span>
                      )}
                      <button
                        onClick={() => {
                          setSelectedUser(user);
                          setShowAssignModal(true);
                        }}
                        className="ml-2 inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                        title="Asignar áreas"
                      >
                        <Plus className="w-3 h-3" />
                        Gestionar
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                    {new Date(user.created_at).toLocaleDateString('es-ES')}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showAssignModal && selectedUser && (
        <AssignAreasModal
          user={selectedUser}
          onClose={() => {
            setShowAssignModal(false);
            setSelectedUser(null);
          }}
          onUpdate={loadUsers}
        />
      )}
    </div>
  );
}

// Modal para asignar áreas a un usuario
function AssignAreasModal({ user, onClose, onUpdate }: {
  user: User;
  onClose: () => void;
  onUpdate?: () => void;
}) {
  const { profile } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [assignedDepartments, setAssignedDepartments] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    loadData();
  }, [user.id]);

  const loadData = async () => {
    try {
      // Cargar todas las áreas disponibles
      const { data: deptData } = await supabase
        .from('departments')
        .select('id, name, color')
        .order('name');

      // Cargar áreas ya asignadas a este usuario
      const { data: assignedData } = await supabase
        .from('user_departments')
        .select('department_id')
        .eq('user_id', user.id);

      setDepartments(deptData || []);
      setAssignedDepartments(new Set(assignedData?.map(a => a.department_id) || []));
    } catch (error) {
      console.error('Error loading data:', error);
      setMessage({ type: 'error', text: 'Error al cargar las áreas' });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleDepartment = async (departmentId: string) => {
    try {
      if (assignedDepartments.has(departmentId)) {
        // Remover asignación
        const { error } = await supabase
          .from('user_departments')
          .delete()
          .eq('user_id', user.id)
          .eq('department_id', departmentId);

        if (error) throw error;

        setAssignedDepartments(prev => {
          const newSet = new Set(prev);
          newSet.delete(departmentId);
          return newSet;
        });

        setMessage({ type: 'success', text: 'Área removida del usuario' });
      } else {
        // Agregar asignación
        const { error } = await supabase
          .from('user_departments')
          .insert({
            user_id: user.id,
            department_id: departmentId,
            assigned_by: profile?.id
          });

        if (error) throw error;

        setAssignedDepartments(prev => new Set([...prev, departmentId]));
        setMessage({ type: 'success', text: 'Área asignada al usuario' });
      }

      if (onUpdate) {
        onUpdate();
      }

      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      console.error('Error al actualizar asignación:', error);
      setMessage({ type: 'error', text: error.message || 'Error al actualizar asignación' });
      setTimeout(() => setMessage(null), 5000);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-slate-700">
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Asignar Áreas</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{user.full_name} ({user.email})</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:text-gray-300 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Mensajes */}
        {message && (
          <div className={`mx-6 mt-4 rounded-lg p-3 flex items-start gap-2 ${
            message.type === 'success' 
              ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50' 
              : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50'
          }`}>
            {message.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            )}
            <p className={message.type === 'success' ? 'text-green-700 dark:text-green-300 text-sm' : 'text-red-700 dark:text-red-300 text-sm'}>
              {message.text}
            </p>
          </div>
        )}

        {/* Contenido */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400"></div>
            </div>
          ) : departments.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="w-12 h-12 mx-auto mb-3 text-gray-400 dark:text-gray-600" />
              <p className="text-gray-500 dark:text-gray-400">No hay áreas disponibles</p>
            </div>
          ) : (
            <div className="space-y-2">
              {departments.map((dept) => {
                const isAssigned = assignedDepartments.has(dept.id);
                return (
                  <button
                    key={dept.id}
                    onClick={() => handleToggleDepartment(dept.id)}
                    className={`w-full flex items-center justify-between p-4 rounded-lg border-2 transition-all ${
                      isAssigned
                        ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-300 dark:border-purple-600 hover:bg-purple-100 dark:hover:bg-purple-900/30'
                        : 'bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600 hover:border-gray-300 dark:hover:border-slate-500 hover:bg-gray-50 dark:hover:bg-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                          isAssigned
                            ? 'bg-purple-600 dark:bg-purple-500 border-purple-600 dark:border-purple-500'
                            : 'border-gray-300 dark:border-slate-500'
                        }`}
                      >
                        {isAssigned && (
                          <CheckCircle className="w-3 h-3 text-white" />
                        )}
                      </div>
                      <Building2 
                        className="w-5 h-5" 
                        style={{ color: dept.color || '#9333EA' }}
                      />
                      <span className="font-medium text-gray-900 dark:text-white">{dept.name}</span>
                    </div>
                    {isAssigned && (
                      <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">Asignada</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-slate-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-slate-700 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
