import { useState, useEffect } from 'react';
import { Calendar, Plus, Search, Filter, AlertCircle, Users, Clock, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import { CreateVencimientoModal } from './CreateVencimientoModal';
import { VencimientoDetail } from './VencimientoDetail';
import { useDepartmentPermissions } from '../../hooks/useDepartmentPermissions';

export interface Vencimiento {
  id: string;
  title: string;
  description: string | null;
  client_name: string;
  client_cuit: string | null;
  vencimiento_tipo: string;
  periodo: string;
  fecha_vencimiento: string;
  fecha_vencimiento_original: string | null;
  priority: 'low' | 'medium' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  created_by: string;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
  assigned_users?: Array<{ id: string; full_name: string; avatar_url?: string }>;
  assigned_departments?: Array<{ id: string; name: string }>;
  created_by_profile?: { id: string; full_name: string; avatar_url?: string | null };
}

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

export function VencimientosList() {
  const { profile } = useAuth();
  const { tenantId } = useTenant();
  const { canCreate } = useDepartmentPermissions();
  const [vencimientos, setVencimientos] = useState<Vencimiento[]>([]);
  const [filteredVencimientos, setFilteredVencimientos] = useState<Vencimiento[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedVencimiento, setSelectedVencimiento] = useState<Vencimiento | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [hideCompleted, setHideCompleted] = useState<boolean>(true);

  useEffect(() => {
    fetchVencimientos();
  }, [profile, tenantId]);

  useEffect(() => {
    filterVencimientos();
  }, [vencimientos, searchQuery, statusFilter, priorityFilter, hideCompleted]);

  const fetchVencimientos = async () => {
    if (!profile || !tenantId) return;

    try {
      setLoading(true);

      let vencimientosData: Vencimiento[] = [];

      if (profile.role === 'admin') {
        const { data, error } = await supabase
          .from('vencimientos_gestion')
          .select(`
            *,
            created_by_profile:profiles!vencimientos_gestion_created_by_fkey (
              id,
              full_name,
              avatar_url
            )
          `)
          .eq('tenant_id', tenantId)
          .order('fecha_vencimiento', { ascending: true });

        if (error) throw error;
        vencimientosData = data || [];
      } else {
        // Obtener departamentos del usuario
        const { data: userDepts, error: deptsError } = await supabase
          .from('user_departments')
          .select('department_id')
          .eq('user_id', profile.id)
          .eq('tenant_id', tenantId);

        if (deptsError) throw deptsError;

        const departmentIds = userDepts?.map(d => d.department_id) || [];

        // Obtener vencimientos asignados
        let query = supabase
          .from('vencimientos_gestion_assignments')
          .select('vencimiento_id')
          .eq('assigned_to_user', profile.id)
          .eq('tenant_id', tenantId);

        if (departmentIds.length > 0) {
          const { data: deptAssignments, error: deptError } = await supabase
            .from('vencimientos_gestion_assignments')
            .select('vencimiento_id')
            .in('assigned_to_department', departmentIds)
            .eq('tenant_id', tenantId);

          if (deptError) throw deptError;

          const { data: userAssignments, error: userError } = await query;
          if (userError) throw userError;

          const allVencimientoIds = new Set([
            ...(userAssignments?.map(a => a.vencimiento_id) || []),
            ...(deptAssignments?.map(a => a.vencimiento_id) || [])
          ]);

          if (allVencimientoIds.size > 0) {
            const { data, error } = await supabase
              .from('vencimientos_gestion')
              .select(`
                *,
                created_by_profile:profiles!vencimientos_gestion_created_by_fkey (
                  id,
                  full_name,
                  avatar_url
                )
              `)
              .in('id', Array.from(allVencimientoIds))
              .eq('tenant_id', tenantId)
              .order('fecha_vencimiento', { ascending: true });

            if (error) throw error;
            vencimientosData = data || [];
          }
        } else {
          const { data: userAssignments, error: userError } = await query;
          if (userError) throw userError;

          if (userAssignments && userAssignments.length > 0) {
            const { data, error } = await supabase
              .from('vencimientos_gestion')
              .select(`
                *,
                created_by_profile:profiles!vencimientos_gestion_created_by_fkey (
                  id,
                  full_name,
                  avatar_url
                )
              `)
              .in('id', userAssignments.map(a => a.vencimiento_id))
              .eq('tenant_id', tenantId)
              .order('fecha_vencimiento', { ascending: true });

            if (error) throw error;
            vencimientosData = data || [];
          }
        }
      }

      // Cargar asignaciones para cada vencimiento
      const vencimientosWithAssignments = await Promise.all(
        vencimientosData.map(async (venc) => {
          const { data: assignments } = await supabase
            .from('vencimientos_gestion_assignments')
            .select(`
              assigned_to_user,
              assigned_to_department,
              profiles:assigned_to_user (id, full_name, avatar_url),
              departments:assigned_to_department (id, name)
            `)
            .eq('vencimiento_id', venc.id)
            .eq('tenant_id', tenantId);

          const assignedUsers = assignments
            ?.filter(a => a.assigned_to_user)
            .map(a => a.profiles)
            .filter(Boolean) || [];

          const assignedDepartments = assignments
            ?.filter(a => a.assigned_to_department)
            .map(a => a.departments)
            .filter(Boolean) || [];

          return {
            ...venc,
            assigned_users: assignedUsers as any,
            assigned_departments: assignedDepartments as any
          };
        })
      );

      setVencimientos(vencimientosWithAssignments);
    } catch (error) {
      console.error('Error fetching vencimientos:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterVencimientos = () => {
    let filtered = [...vencimientos];

    // Filtro por búsqueda
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (v) =>
          v.title.toLowerCase().includes(query) ||
          v.client_name.toLowerCase().includes(query) ||
          v.vencimiento_tipo.toLowerCase().includes(query) ||
          v.periodo.toLowerCase().includes(query)
      );
    }

    // Filtro por estado
    if (statusFilter !== 'all') {
      filtered = filtered.filter((v) => v.status === statusFilter);
    }

    // Filtro por prioridad
    if (priorityFilter !== 'all') {
      filtered = filtered.filter((v) => v.priority === priorityFilter);
    }

    // Ocultar completados
    if (hideCompleted) {
      filtered = filtered.filter((v) => v.status !== 'completed');
    }

    setFilteredVencimientos(filtered);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (selectedVencimiento) {
    return (
      <VencimientoDetail
        vencimiento={selectedVencimiento}
        onBack={() => {
          setSelectedVencimiento(null);
          fetchVencimientos();
        }}
        onUpdate={(updatedVencimiento) => {
          // Actualizar el vencimiento en la lista
          setVencimientos((prev) =>
            prev.map((v) => (v.id === updatedVencimiento.id ? updatedVencimiento : v))
          );
          // Actualizar también el vencimiento seleccionado
          setSelectedVencimiento(updatedVencimiento);
        }}
      />
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Calendar className="w-6 h-6 sm:w-8 sm:h-8 text-orange-600" />
            Vencimientos
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mt-1">
            Gestiona y controla los vencimientos de tus clientes
          </p>
        </div>
        {canCreate('vencimientos') && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition"
          >
            <Plus className="w-5 h-5" />
            <span className="hidden sm:inline">Nuevo Vencimiento</span>
            <span className="sm:hidden">Nuevo</span>
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar vencimientos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
          >
            <option value="all">Todos los estados</option>
            <option value="pending">Pendiente</option>
            <option value="in_progress">En Progreso</option>
            <option value="completed">Completada</option>
            <option value="cancelled">Cancelada</option>
          </select>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
          >
            <option value="all">Todas las prioridades</option>
            <option value="urgent">Urgente</option>
            <option value="medium">Media</option>
            <option value="low">Baja</option>
          </select>
          <label className="flex items-center gap-2 px-4 py-2 cursor-pointer">
            <input
              type="checkbox"
              checked={hideCompleted}
              onChange={(e) => setHideCompleted(e.target.checked)}
              className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Ocultar completados</span>
          </label>
        </div>
      </div>

      {/* Lista de vencimientos */}
      {filteredVencimientos.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-8 text-center">
          <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-300">
            {searchQuery || statusFilter !== 'all' || priorityFilter !== 'all'
              ? 'No se encontraron vencimientos con los filtros aplicados'
              : 'No hay vencimientos registrados'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredVencimientos.map((venc) => (
            <div
              key={venc.id}
              onClick={() => setSelectedVencimiento(venc)}
              className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-4 sm:p-6 hover:shadow-md transition cursor-pointer"
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                      {venc.title}
                    </h3>
                    <span
                      className="px-2 py-1 rounded text-xs font-medium"
                      style={{
                        backgroundColor: priorityConfig[venc.priority].bg,
                        borderColor: priorityConfig[venc.priority].border,
                        color: priorityConfig[venc.priority].text
                      }}
                    >
                      {priorityConfig[venc.priority].label}
                    </span>
                    <span
                      className="px-2 py-1 rounded text-xs font-medium"
                      style={{
                        backgroundColor: statusConfig[venc.status].color + '20',
                        color: statusConfig[venc.status].color
                      }}
                    >
                      {statusConfig[venc.status].label}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-300">
                    <div className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      <span>{venc.client_name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      <span>{formatDate(venc.fecha_vencimiento)}</span>
                    </div>
                    <div>
                      <span className="font-medium">{venc.vencimiento_tipo}</span> - {venc.periodo}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <CreateVencimientoModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            fetchVencimientos();
          }}
        />
      )}
    </div>
  );
}
