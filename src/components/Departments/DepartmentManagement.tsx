import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import { Database } from '../../lib/database.types';
import { Building2, Plus, Edit2, Trash2, Users, CheckCircle, AlertCircle, X, Settings, Eye, PlusCircle, Edit, Trash, ChevronDown, ChevronUp, FileText } from 'lucide-react';
import { useDepartmentPermissions } from '../../hooks/useDepartmentPermissions';

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
  const { canCreate, canEdit, canDelete } = useDepartmentPermissions();
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
        {canCreate('departments') && (
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
            canEdit={canEdit('departments')}
            canDelete={canDelete('departments')}
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
function DepartmentCard({ department, onEdit, onDelete, onAssign, canEdit, canDelete, isAdmin }: {
  department: Department;
  onEdit: () => void;
  onDelete: () => void;
  onAssign: () => void;
  canEdit: boolean;
  canDelete: boolean;
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
      <div className="flex items-start gap-4 mb-4">
        <div
          className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${department.color}20` }}
        >
          <Building2 className="w-6 h-6" style={{ color: department.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">{department.name}</h3>
          <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">{department.description}</p>
        </div>
      </div>

      {/* Sección de configuración más visible */}
      {(canEdit || canDelete) && (
        <div className="mb-4 pt-4 border-t border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-2 flex-wrap">
            {canEdit && (
              <button
                onClick={onEdit}
                className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition font-medium text-sm"
                title="Editar área"
              >
                <Edit2 className="w-4 h-4" />
                <span>Editar</span>
              </button>
            )}
            {canDelete && (
              <button
                onClick={onDelete}
                className="flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition font-medium text-sm"
                title="Eliminar área"
              >
                <Trash2 className="w-4 h-4" />
                <span>Eliminar</span>
              </button>
            )}
          </div>
        </div>
      )}

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
  const { tenantId } = useTenant();
  const [activeTab, setActiveTab] = useState<'info' | 'permissions'>('info');
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
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        <div className="border-b border-gray-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Editar Área</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:text-gray-300">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-slate-700 px-6">
          <div className="flex space-x-1">
            <button
              type="button"
              onClick={() => setActiveTab('info')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'info'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Información
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('permissions')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'permissions'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Settings className="w-4 h-4 inline mr-2" />
              Permisos
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {activeTab === 'info' ? (
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
          ) : (
            <DepartmentPermissionsConfig 
              departmentId={department.id} 
              tenantId={tenantId || ''}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// Componente para configurar permisos del área
function DepartmentPermissionsConfig({ departmentId, tenantId }: { departmentId: string; tenantId: string }) {
  type DepartmentPermission = Database['public']['Tables']['department_permissions']['Row'];
  const { tenant } = useTenant();
  
  // Obtener módulos visibles del tenant
  const visibleModules = tenant?.visible_modules as Record<string, boolean> | null | undefined;
  
  // Función para verificar si un módulo está visible
  const isModuleVisible = (moduleView: string): boolean => {
    // Si no hay configuración de módulos visibles, todos están visibles por defecto
    if (!visibleModules) return true;
    // Si el módulo no está en la configuración, está visible por defecto
    return visibleModules[moduleView] !== false;
  };
  
  // Estructura jerárquica de módulos (igual que en Sidebar)
  const allModuleStructure = [
    { view: 'dashboard', label: 'Inicio', hasSubItems: false },
    { view: 'meetings', label: 'Sala de Reuniones', hasSubItems: false },
    { 
      label: 'Personas', 
      hasSubItems: true,
      subItems: [
        { view: 'departments', label: 'Áreas' },
        { view: 'internal-policies', label: 'Onboarding y Políticas Internas' },
        { view: 'library', label: 'Recursos' },
        { view: 'professional-news', label: 'Novedades Profesionales' },
        { view: 'vacations', label: 'Vacaciones y Licencias' },
        { view: 'social', label: 'Social' },
      ]
    },
    { 
      label: 'Negocio', 
      hasSubItems: true,
      subItems: [
        { view: 'fabinsa-production', label: 'Producción' },
        { view: 'fabinsa-employees', label: 'Empleados' },
        { view: 'fabinsa-stock', label: 'Stock' },
        { view: 'fabinsa-sales', label: 'Ventas' },
        { view: 'fabinsa-purchases', label: 'Compras' },
        { view: 'fabinsa-costs', label: 'Costos' },
        { view: 'fabinsa-suppliers', label: 'Proveedores' },
        { view: 'forums', label: 'Clientes' },
        { view: 'time-tracking', label: 'Carga de Horas' },
        { view: 'tasks', label: 'Tareas' },
        { view: 'tools', label: 'Herramientas' },
      ]
    },
    { view: 'tickets', label: 'Soporte', hasSubItems: false },
    { view: 'users', label: 'Usuarios', hasSubItems: false },
    { view: 'settings', label: 'Configuración', hasSubItems: false },
  ];
  
  // Filtrar módulos según los activos en el tenant
  const moduleStructure = allModuleStructure
    .map(module => {
      if (module.hasSubItems && module.subItems) {
        // Filtrar sub-items que están visibles
        const visibleSubItems = module.subItems.filter(sub => isModuleVisible(sub.view));
        // Si hay sub-items visibles, incluir el módulo principal
        if (visibleSubItems.length > 0) {
          return {
            ...module,
            subItems: visibleSubItems
          };
        }
        // Si no hay sub-items visibles, no incluir el módulo
        return null;
      } else {
        // Para módulos sin sub-items, verificar si están visibles
        return isModuleVisible(module.view) ? module : null;
      }
    })
    .filter((module): module is NonNullable<typeof module> => module !== null);

  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set(['Personas', 'Negocio']));

  const [permissions, setPermissions] = useState<Record<string, DepartmentPermission>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    loadPermissions();
  }, [departmentId, tenantId]);

  const loadPermissions = async () => {
    try {
      const { data, error } = await supabase
        .from('department_permissions')
        .select('*')
        .eq('department_id', departmentId)
        .eq('tenant_id', tenantId);

      if (error) throw error;

      // Crear un mapa de permisos por module_view
      const permissionsMap: Record<string, DepartmentPermission> = {};
      (data || []).forEach(perm => {
        permissionsMap[perm.module_view] = perm;
      });
      setPermissions(permissionsMap);
    } catch (error) {
      console.error('Error loading permissions:', error);
      setMessage({ type: 'error', text: 'Error al cargar permisos' });
    } finally {
      setLoading(false);
    }
  };

  const updatePermission = async (moduleView: string, field: 'can_view' | 'can_create' | 'can_edit' | 'can_delete' | 'can_print', value: boolean) => {
    if (!tenantId) return;

    setSaving(true);
    try {
      const existing = permissions[moduleView];
      
      if (existing) {
        // Actualizar permiso existente
        const { error } = await supabase
          .from('department_permissions')
          .update({ [field]: value })
          .eq('id', existing.id);

        if (error) throw error;

        setPermissions(prev => ({
          ...prev,
          [moduleView]: { ...prev[moduleView], [field]: value }
        }));
      } else {
        // Crear nuevo permiso
        const { data, error } = await supabase
          .from('department_permissions')
          .insert({
            department_id: departmentId,
            tenant_id: tenantId,
            module_view: moduleView,
            can_view: field === 'can_view' ? value : true,
            can_create: field === 'can_create' ? value : false,
            can_edit: field === 'can_edit' ? value : false,
            can_delete: field === 'can_delete' ? value : false,
            can_print: field === 'can_print' ? value : false,
          })
          .select()
          .single();

        if (error) throw error;

        setPermissions(prev => ({
          ...prev,
          [moduleView]: data
        }));
      }

      setMessage({ type: 'success', text: 'Permisos actualizados' });
      setTimeout(() => setMessage(null), 2000);
    } catch (error: any) {
      console.error('Error updating permission:', error);
      setMessage({ type: 'error', text: error.message || 'Error al actualizar permiso' });
    } finally {
      setSaving(false);
    }
  };

  const getPermission = (moduleView: string) => {
    return permissions[moduleView] || {
      can_view: false,
      can_create: false,
      can_edit: false,
      can_delete: false,
      can_print: false,
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {message && (
        <div className={`mb-4 rounded-lg p-3 flex items-start gap-2 ${
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

      <div className="mb-4">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Configura qué módulos y sub-áreas pueden ver y qué acciones pueden realizar los usuarios de esta área.
          Haz clic en los módulos principales (Personas, Negocio) para expandir y configurar permisos individuales de cada sub-área.
        </p>
      </div>

      <div className="space-y-3 max-h-[60vh] overflow-y-auto">
        {moduleStructure.map((module) => {
          if (module.hasSubItems && module.subItems) {
            // Módulo con sub-items
            const isExpanded = expandedModules.has(module.label);
            const allSubItemsVisible = module.subItems.every(sub => {
              const subPerm = getPermission(sub.view);
              return subPerm.can_view;
            });
            const someSubItemsVisible = module.subItems.some(sub => {
              const subPerm = getPermission(sub.view);
              return subPerm.can_view;
            });

            return (
              <div 
                key={module.label}
                className="border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden"
              >
                {/* Header del módulo principal */}
                <div 
                  className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-700/50 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700"
                  onClick={() => {
                    setExpandedModules(prev => {
                      const newSet = new Set(prev);
                      if (newSet.has(module.label)) {
                        newSet.delete(module.label);
                      } else {
                        newSet.add(module.label);
                      }
                      return newSet;
                    });
                  }}
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? (
                      <ChevronDown className="w-5 h-5 text-gray-500" />
                    ) : (
                      <ChevronUp className="w-5 h-5 text-gray-500" />
                    )}
                    <h4 className="font-semibold text-gray-900 dark:text-white">{module.label}</h4>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      ({module.subItems.length} {module.subItems.length === 1 ? 'sub-área' : 'sub-áreas'})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <label 
                      className="flex items-center gap-2 cursor-pointer"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={allSubItemsVisible}
                        ref={(input) => {
                          if (input) {
                            input.indeterminate = someSubItemsVisible && !allSubItemsVisible;
                          }
                        }}
                        onChange={(e) => {
                          // Aplicar el mismo permiso de "ver" a todos los sub-items
                          module.subItems!.forEach(sub => {
                            updatePermission(sub.view, 'can_view', e.target.checked);
                          });
                        }}
                        disabled={saving}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                      />
                      <Eye className="w-4 h-4 text-gray-500" />
                      <span className="text-sm text-gray-600 dark:text-gray-300">Ver todo</span>
                    </label>
                  </div>
                </div>

                {/* Sub-items expandibles */}
                {isExpanded && (
                  <div className="border-t border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                    {module.subItems.map((subItem) => {
                      const subPerm = getPermission(subItem.view);
                      return (
                        <div 
                          key={subItem.view}
                          className="border-b border-gray-100 dark:border-slate-700/50 last:border-b-0 p-4 pl-12"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <h5 className="font-medium text-gray-800 dark:text-gray-200">{subItem.label}</h5>
                            <div className="flex items-center gap-2">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={subPerm.can_view}
                                  onChange={(e) => updatePermission(subItem.view, 'can_view', e.target.checked)}
                                  disabled={saving}
                                  className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                                />
                                <Eye className="w-4 h-4 text-gray-500" />
                                <span className="text-sm text-gray-600 dark:text-gray-300">Ver</span>
                              </label>
                            </div>
                          </div>

                          {subPerm.can_view && (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 pt-3 border-t border-gray-200 dark:border-slate-700">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={subPerm.can_create}
                                  onChange={(e) => updatePermission(subItem.view, 'can_create', e.target.checked)}
                                  disabled={saving}
                                  className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                                />
                                <PlusCircle className="w-4 h-4 text-gray-500" />
                                <span className="text-sm text-gray-600 dark:text-gray-300">Crear</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={subPerm.can_edit}
                                  onChange={(e) => updatePermission(subItem.view, 'can_edit', e.target.checked)}
                                  disabled={saving}
                                  className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                                />
                                <Edit className="w-4 h-4 text-gray-500" />
                                <span className="text-sm text-gray-600 dark:text-gray-300">Editar</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={subPerm.can_delete}
                                  onChange={(e) => updatePermission(subItem.view, 'can_delete', e.target.checked)}
                                  disabled={saving}
                                  className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                                />
                                <Trash className="w-4 h-4 text-gray-500" />
                                <span className="text-sm text-gray-600 dark:text-gray-300">Eliminar</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={subPerm.can_print}
                                  onChange={(e) => updatePermission(subItem.view, 'can_print', e.target.checked)}
                                  disabled={saving}
                                  className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                                />
                                <FileText className="w-4 h-4 text-gray-500" />
                                <span className="text-sm text-gray-600 dark:text-gray-300">Imprimir</span>
                              </label>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          } else {
            // Módulo sin sub-items
            const perm = getPermission(module.view!);
            return (
              <div 
                key={module.view}
                className="border border-gray-200 dark:border-slate-700 rounded-lg p-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-gray-900 dark:text-white">{module.label}</h4>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={perm.can_view}
                        onChange={(e) => updatePermission(module.view!, 'can_view', e.target.checked)}
                        disabled={saving}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                      />
                      <Eye className="w-4 h-4 text-gray-500" />
                      <span className="text-sm text-gray-600 dark:text-gray-300">Ver</span>
                    </label>
                  </div>
                </div>

                {perm.can_view && (
                  <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-gray-200 dark:border-slate-700">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={perm.can_create}
                        onChange={(e) => updatePermission(module.view!, 'can_create', e.target.checked)}
                        disabled={saving}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                      />
                      <PlusCircle className="w-4 h-4 text-gray-500" />
                      <span className="text-sm text-gray-600 dark:text-gray-300">Crear</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={perm.can_edit}
                        onChange={(e) => updatePermission(module.view!, 'can_edit', e.target.checked)}
                        disabled={saving}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                      />
                      <Edit className="w-4 h-4 text-gray-500" />
                      <span className="text-sm text-gray-600 dark:text-gray-300">Editar</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={perm.can_delete}
                        onChange={(e) => updatePermission(module.view!, 'can_delete', e.target.checked)}
                        disabled={saving}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                      />
                      <Trash className="w-4 h-4 text-gray-500" />
                      <span className="text-sm text-gray-600 dark:text-gray-300">Eliminar</span>
                    </label>
                  </div>
                )}
              </div>
            );
          }
        })}
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

