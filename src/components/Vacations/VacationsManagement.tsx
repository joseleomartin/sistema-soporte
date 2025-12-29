import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Calendar, 
  Plus, 
  CheckCircle, 
  XCircle, 
  Clock, 
  User,
  AlertCircle,
  Search,
  Filter,
  X,
  List,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useDepartmentPermissions } from '../../hooks/useDepartmentPermissions';

interface Vacation {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  days_count: number;
  status: 'pending' | 'approved' | 'rejected';
  type: 'vacation' | 'license';
  reason?: string;
  approved_by?: string;
  approved_at?: string;
  rejection_reason?: string;
  created_at: string;
  user_profile?: {
    full_name: string;
    email: string;
  };
  approved_by_profile?: {
    full_name: string;
  };
}

export function VacationsManagement() {
  const { profile } = useAuth();
  const { canCreate } = useDepartmentPermissions();
  const [vacations, setVacations] = useState<Vacation[]>([]);
  const [filteredVacations, setFilteredVacations] = useState<Vacation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    loadVacations();
  }, [profile?.id]);

  useEffect(() => {
    filterVacations();
  }, [vacations, searchTerm, statusFilter]);

  const loadVacations = async () => {
    if (!profile?.id || !profile?.tenant_id) return;

    try {
      let query = supabase
        .from('vacations')
        .select(`
          *,
          user_profile:profiles!vacations_user_id_fkey(full_name, email),
          approved_by_profile:profiles!vacations_approved_by_fkey(full_name)
        `)
        // Filtrar por tenant_id para asegurar aislamiento multi-tenant
        .eq('tenant_id', profile.tenant_id)
        .order('start_date', { ascending: false });

      // Si no es admin/support, solo ver sus propias vacaciones
      if (profile.role !== 'admin' && profile.role !== 'support') {
        query = query.eq('user_id', profile.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      setVacations(data || []);
    } catch (error: any) {
      console.error('Error loading vacations:', error);
      setMessage({ type: 'error', text: 'Error al cargar las vacaciones' });
    } finally {
      setLoading(false);
    }
  };

  const filterVacations = () => {
    let filtered = vacations;

    // Filtrar por estado
    if (statusFilter !== 'all') {
      filtered = filtered.filter(v => v.status === statusFilter);
    }

    // Filtrar por búsqueda
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(v => 
        v.user_profile?.full_name?.toLowerCase().includes(searchLower) ||
        v.user_profile?.email?.toLowerCase().includes(searchLower) ||
        v.reason?.toLowerCase().includes(searchLower)
      );
    }

    setFilteredVacations(filtered);
  };

  const handleApprove = async (vacationId: string) => {
    if (!profile?.tenant_id) return;
    
    try {
      const { error } = await supabase
        .from('vacations')
        .update({
          status: 'approved',
          approved_by: profile?.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', vacationId)
        .eq('tenant_id', profile.tenant_id); // Filtrar por tenant_id para seguridad

      if (error) throw error;

      setMessage({ type: 'success', text: 'Vacación / Licencia aprobada correctamente' });
      setTimeout(() => setMessage(null), 3000);
      await loadVacations();
    } catch (error: any) {
      console.error('Error approving vacation:', error);
      setMessage({ type: 'error', text: 'Error al aprobar la vacación / licencia' });
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const handleReject = async (vacationId: string, reason: string) => {
    if (!reason.trim()) {
      setMessage({ type: 'error', text: 'Debes proporcionar una razón para rechazar' });
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    if (!profile?.tenant_id) return;

    try {
      const { error } = await supabase
        .from('vacations')
        .update({
          status: 'rejected',
          approved_by: profile?.id,
          approved_at: new Date().toISOString(),
          rejection_reason: reason
        })
        .eq('id', vacationId)
        .eq('tenant_id', profile.tenant_id); // Filtrar por tenant_id para seguridad

      if (error) throw error;

      setMessage({ type: 'success', text: 'Vacación / Licencia rechazada' });
      setTimeout(() => setMessage(null), 3000);
      await loadVacations();
    } catch (error: any) {
      console.error('Error rejecting vacation:', error);
      setMessage({ type: 'error', text: 'Error al rechazar la vacación / licencia' });
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const handleDelete = async (vacationId: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar esta vacación / licencia?')) return;

    if (!profile?.tenant_id) return;

    try {
      const { error } = await supabase
        .from('vacations')
        .delete()
        .eq('id', vacationId)
        .eq('tenant_id', profile.tenant_id); // Filtrar por tenant_id para seguridad

      if (error) throw error;

      setMessage({ type: 'success', text: 'Vacación / Licencia eliminada correctamente' });
      setTimeout(() => setMessage(null), 3000);
      await loadVacations();
    } catch (error: any) {
      console.error('Error deleting vacation:', error);
      setMessage({ type: 'error', text: 'Error al eliminar la vacación / licencia' });
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

  const isAdmin = profile?.role === 'admin' || profile?.role === 'support';

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Gestión de Vacaciones / Licencias</h2>
        {canCreate('vacations') && (
          <>
            {isAdmin ? (
              <button
                onClick={() => setShowAssignModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
              >
                <Plus className="w-5 h-5" />
                Asignar Vacaciones / Licencias
              </button>
            ) : (
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
              >
                <Plus className="w-5 h-5" />
                Solicitar Vacaciones / Licencias
              </button>
            )}
          </>
        )}
      </div>

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

      {/* Filtros y Vista */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 mb-6 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              placeholder="Buscar por nombre, email o razón..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-400 dark:text-gray-500" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-4 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todos los estados</option>
              <option value="pending">Pendientes</option>
              <option value="approved">Aprobadas</option>
              <option value="rejected">Rechazadas</option>
            </select>
            <div className="flex items-center gap-1 border border-gray-300 dark:border-slate-600 rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-2 transition-colors ${
                  viewMode === 'list'
                    ? 'bg-blue-600 dark:bg-blue-500 text-white'
                    : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700'
                }`}
                title="Vista de lista"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('calendar')}
                className={`px-3 py-2 transition-colors ${
                  viewMode === 'calendar'
                    ? 'bg-blue-600 dark:bg-blue-500 text-white'
                    : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700'
                }`}
                title="Vista de calendario"
              >
                <Calendar className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido según vista */}
      {viewMode === 'list' ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
          {filteredVacations.length === 0 ? (
            <div className="p-12 text-center">
              <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-400 dark:text-gray-600" />
              <p className="text-gray-500 dark:text-gray-400">No se encontraron vacaciones / licencias</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-slate-700">
              {filteredVacations.map((vacation) => (
                <VacationCard
                  key={vacation.id}
                  vacation={vacation}
                  isAdmin={isAdmin}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <VacationCalendar
          vacations={filteredVacations.filter(v => v.status === 'approved' || v.status === 'pending')}
          currentDate={currentDate}
          onDateChange={setCurrentDate}
        />
      )}

      {showCreateModal && (
        <CreateVacationModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            loadVacations();
          }}
        />
      )}

      {showAssignModal && isAdmin && (
        <AssignVacationModal
          onClose={() => setShowAssignModal(false)}
          onSuccess={() => {
            setShowAssignModal(false);
            loadVacations();
          }}
        />
      )}
    </div>
  );
}

// Componente para mostrar una tarjeta de vacación
function VacationCard({ 
  vacation, 
  isAdmin, 
  onApprove, 
  onReject, 
  onDelete 
}: {
  vacation: Vacation;
  isAdmin: boolean;
  onApprove: (id: string) => void;
  onReject: (id: string, reason: string) => void;
  onDelete: (id: string) => void;
}) {
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

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
  const canEdit = vacation.status === 'pending';

  const getStatusBadge = () => {
    switch (vacation.status) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:text-green-300">
            <CheckCircle className="w-3 h-3" />
            Aprobada
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300">
            <XCircle className="w-3 h-3" />
            Rechazada
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300">
            <Clock className="w-3 h-3" />
            Pendiente
          </span>
        );
    }
  };

  return (
    <div className="p-6 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-3">
            {getStatusBadge()}
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
              vacation.type === 'vacation' 
                ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' 
                : 'bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300'
            }`}>
              {vacation.type === 'vacation' ? 'Vacaciones' : 'Licencia'}
            </span>
            {isAdmin && (
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                <User className="w-4 h-4" />
                <span>{vacation.user_profile?.full_name || 'Usuario'}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Fecha de inicio</p>
              <p className="font-medium text-gray-900 dark:text-white">
                {startDate.toLocaleDateString('es-ES', { 
                  weekday: 'short', 
                  year: 'numeric', 
                  month: 'short', 
                  day: 'numeric' 
                })}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Fecha de fin</p>
              <p className="font-medium text-gray-900 dark:text-white">
                {endDate.toLocaleDateString('es-ES', { 
                  weekday: 'short', 
                  year: 'numeric', 
                  month: 'short', 
                  day: 'numeric' 
                })}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Días</p>
              <p className="font-medium text-gray-900 dark:text-white">{vacation.days_count} día(s)</p>
            </div>
          </div>

          {vacation.reason && (
            <div className="mb-3">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Razón</p>
              <p className="text-sm text-gray-700 dark:text-gray-300">{vacation.reason}</p>
            </div>
          )}

          {vacation.status === 'rejected' && vacation.rejection_reason && (
            <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800/50">
              <p className="text-xs text-red-600 dark:text-red-400 font-medium mb-1">Razón del rechazo</p>
              <p className="text-sm text-red-700 dark:text-red-300">{vacation.rejection_reason}</p>
            </div>
          )}

          {vacation.status === 'approved' && vacation.approved_by_profile && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Aprobada por: {vacation.approved_by_profile.full_name}
              {vacation.approved_at && (
                <> el {new Date(vacation.approved_at).toLocaleDateString('es-ES')}</>
              )}
            </p>
          )}
        </div>

        {/* Acciones */}
        {isAdmin && vacation.status === 'pending' && (
          <div className="flex items-center gap-2 ml-4">
            <button
              onClick={() => onApprove(vacation.id)}
              className="px-3 py-1.5 text-sm font-medium text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/20 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors"
            >
              Aprobar
            </button>
            <button
              onClick={() => setShowRejectModal(true)}
              className="px-3 py-1.5 text-sm font-medium text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
            >
              Rechazar
            </button>
          </div>
        )}

        {canEdit && !isAdmin && (
          <button
            onClick={() => onDelete(vacation.id)}
            className="ml-4 px-3 py-1.5 text-sm font-medium text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
          >
            Eliminar
          </button>
        )}
      </div>

      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Rechazar Vacación / Licencia</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              Por favor, proporciona una razón para rechazar esta solicitud de vacaciones / licencias.
            </p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Razón del rechazo..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent mb-4"
              rows={4}
            />
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectionReason('');
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-slate-700 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  onReject(vacation.id, rejectionReason);
                  setShowRejectModal(false);
                  setRejectionReason('');
                }}
                className="px-4 py-2 text-white bg-red-600 dark:bg-red-500 rounded-lg hover:bg-red-700 dark:hover:bg-red-600 transition-colors"
              >
                Rechazar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Modal para crear vacación
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Tipo *
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setType('vacation')}
                className={`flex-1 px-4 py-2 rounded-lg border-2 transition-colors ${
                  type === 'vacation'
                    ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                    : 'border-gray-300 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50'
                }`}
              >
                Vacaciones
              </button>
              <button
                type="button"
                onClick={() => setType('license')}
                className={`flex-1 px-4 py-2 rounded-lg border-2 transition-colors ${
                  type === 'license'
                    ? 'border-purple-500 bg-purple-50 text-purple-700 font-medium'
                    : 'border-gray-300 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50'
                }`}
              >
                Licencia
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Fecha de inicio *
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Fecha de fin *
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate || new Date().toISOString().split('T')[0]}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Razón (opcional)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe el motivo de tus vacaciones / licencias..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-lg">
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-slate-700 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-white bg-blue-600 dark:bg-blue-500 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors disabled:opacity-50"
            >
              {loading ? 'Enviando...' : 'Solicitar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Modal para asignar vacaciones directamente (solo para admins)
function AssignVacationModal({ onClose, onSuccess }: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { profile } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [type, setType] = useState<'vacation' | 'license'>('vacation');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    if (!profile?.tenant_id) {
      setLoadingUsers(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('tenant_id', profile.tenant_id) // Filtrar solo usuarios del mismo tenant
        .order('full_name');

      if (error) throw error;
      setUsers(data || []);
    } catch (err: any) {
      console.error('Error loading users:', err);
      setError('Error al cargar los usuarios');
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedUserId) {
      setError('Debes seleccionar un usuario');
      return;
    }

    if (!startDate || !endDate) {
      setError('Debes seleccionar ambas fechas');
      return;
    }

    if (new Date(endDate) < new Date(startDate)) {
      setError('La fecha de fin debe ser posterior a la fecha de inicio');
      return;
    }

    if (!profile?.id || !profile?.tenant_id) {
      setError('No se pudo identificar el administrador o la empresa');
      return;
    }

    setLoading(true);

    try {
      // Asignar vacación directamente como aprobada
      const { error: insertError } = await supabase
        .from('vacations')
        .insert({
          user_id: selectedUserId,
          tenant_id: profile.tenant_id, // Asegurar aislamiento multi-tenant
          type: type,
          start_date: startDate,
          end_date: endDate,
          reason: reason || null,
          status: 'approved',
          approved_by: profile.id,
          approved_at: new Date().toISOString()
        });

      if (insertError) throw insertError;

      onSuccess();
    } catch (err: any) {
      console.error('Error assigning vacation:', err);
      setError(err.message || 'Error al asignar la vacación / licencia');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">Asignar Vacaciones / Licencias</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:text-gray-300 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Tipo *
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setType('vacation')}
                className={`flex-1 px-4 py-2 rounded-lg border-2 transition-colors ${
                  type === 'vacation'
                    ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                    : 'border-gray-300 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50'
                }`}
              >
                Vacaciones
              </button>
              <button
                type="button"
                onClick={() => setType('license')}
                className={`flex-1 px-4 py-2 rounded-lg border-2 transition-colors ${
                  type === 'license'
                    ? 'border-purple-500 bg-purple-50 text-purple-700 font-medium'
                    : 'border-gray-300 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50'
                }`}
              >
                Licencia
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Usuario *
            </label>
            {loadingUsers ? (
              <div className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm text-gray-500 dark:text-gray-400 bg-white dark:bg-slate-700">
                Cargando usuarios...
              </div>
            ) : (
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="">Seleccionar usuario</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.full_name} ({user.email})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Fecha de inicio *
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Fecha de fin *
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Razón (opcional)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Razón de las vacaciones / licencias..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-lg">
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-slate-700 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || loadingUsers}
              className="px-4 py-2 text-white bg-blue-600 dark:bg-blue-500 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors disabled:opacity-50"
            >
              {loading ? 'Asignando...' : 'Asignar Vacaciones / Licencias'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Componente de calendario para visualizar vacaciones
export function VacationCalendar({
  vacations,
  currentDate,
  onDateChange
}: {
  vacations: Vacation[];
  currentDate: Date;
  onDateChange: (date: Date) => void;
}) {
  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const weekDays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Obtener el primer día del mes y cuántos días tiene
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const daysInMonth = lastDayOfMonth.getDate();
  const startingDayOfWeek = firstDayOfMonth.getDay();

  // Generar array de días del mes
  const calendarDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Obtener vacaciones para un día específico
  const getVacationsForDay = (day: number) => {
    return vacations.filter(vacation => {
      // Parsear fechas directamente desde el string (formato YYYY-MM-DD)
      // para evitar problemas de zona horaria
      const startParts = vacation.start_date.split('-');
      const endParts = vacation.end_date.split('-');
      
      const startYear = parseInt(startParts[0]);
      const startMonth = parseInt(startParts[1]) - 1; // Mes en JS es 0-indexed
      const startDay = parseInt(startParts[2]);
      
      const endYear = parseInt(endParts[0]);
      const endMonth = parseInt(endParts[1]) - 1; // Mes en JS es 0-indexed
      const endDay = parseInt(endParts[2]);
      
      // Fecha actual del calendario
      const currentYear = year;
      const currentMonth = month; // Ya está en formato 0-indexed
      const currentDay = day;
      
      // Crear objetos de fecha para comparación
      const startDate = new Date(startYear, startMonth, startDay);
      const endDate = new Date(endYear, endMonth, endDay);
      const currentDate = new Date(currentYear, currentMonth, currentDay);
      
      // Comparar fechas directamente (sin hora)
      return currentDate >= startDate && currentDate <= endDate;
    });
  };

  // Verificar si es hoy
  const isToday = (day: number) => {
    const today = new Date();
    return (
      day === today.getDate() &&
      month === today.getMonth() &&
      year === today.getFullYear()
    );
  };

  // Navegar al mes anterior
  const goToPreviousMonth = () => {
    onDateChange(new Date(year, month - 1, 1));
  };

  // Navegar al mes siguiente
  const goToNextMonth = () => {
    onDateChange(new Date(year, month + 1, 1));
  };

  // Ir al mes actual
  const goToCurrentMonth = () => {
    onDateChange(new Date());
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-5 max-w-full mx-auto">
      {/* Header del calendario */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={goToPreviousMonth}
            className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded transition-colors"
            title="Mes anterior"
          >
            <ChevronLeft className="w-3.5 h-3.5 text-gray-600 dark:text-gray-300" />
          </button>
          <h3 className="text-base font-bold text-gray-900 dark:text-white">
            {monthNames[month]} {year}
          </h3>
          <button
            onClick={goToNextMonth}
            className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded transition-colors"
            title="Mes siguiente"
          >
            <ChevronRight className="w-3.5 h-3.5 text-gray-600 dark:text-gray-300" />
          </button>
        </div>
        <button
          onClick={goToCurrentMonth}
          className="px-2.5 py-1 text-[10px] text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
        >
          Hoy
        </button>
      </div>

      {/* Días de la semana */}
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {weekDays.map((day) => (
          <div
            key={day}
            className="text-center text-[10px] font-semibold text-gray-600 dark:text-gray-300 py-0.5"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Días del mes */}
      <div className="grid grid-cols-7 gap-1">
        {/* Espacios vacíos antes del primer día */}
        {Array.from({ length: startingDayOfWeek }).map((_, index) => (
          <div key={`empty-${index}`} className="h-[140px]" />
        ))}

        {/* Días del mes */}
        {calendarDays.map((day) => {
          const dayVacations = getVacationsForDay(day);
          const today = isToday(day);

          return (
            <div
              key={day}
              className={`
                border border-gray-200 dark:border-slate-700 rounded p-2 flex flex-col h-[140px]
                ${today ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-600' : 'bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700'}
                transition-colors
              `}
            >
              <div className={`text-[10px] font-medium mb-0.5 ${today ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}>
                {day}
              </div>
              <div className="flex-1 overflow-y-auto space-y-0.5">
                {dayVacations.slice(0, 5).map((vacation) => {
                  const isApproved = vacation.status === 'approved';
                  const isPending = vacation.status === 'pending';
                  const isVacation = vacation.type === 'vacation';
                  
                  return (
                    <div
                      key={vacation.id}
                      className={`text-[9px] px-0.5 py-0.5 rounded truncate leading-tight ${
                        isApproved
                          ? isVacation
                            ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-700/50'
                            : 'bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-700/50'
                          : isPending
                          ? isVacation
                            ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-700/50'
                            : 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-300 border border-purple-200 dark:border-purple-700/50'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-slate-600'
                      }`}
                      title={`${vacation.user_profile?.full_name || 'Usuario'}: ${isVacation ? 'Vacaciones' : 'Licencia'} - ${vacation.reason || ''} (${isApproved ? 'Aprobada' : isPending ? 'Pendiente' : 'Rechazada'})`}
                    >
                      {vacation.user_profile?.full_name || 'Usuario'}
                    </div>
                  );
                })}
                {dayVacations.length > 5 && (
                  <div className="text-[9px] px-0.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded border border-gray-200 dark:border-slate-600">
                    +{dayVacations.length - 5}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Leyenda */}
      <div className="mt-3 pt-2 border-t border-gray-200 dark:border-slate-700">
        <div className="flex flex-wrap items-center gap-2 text-[10px]">
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 bg-green-100 dark:bg-green-900/20 border border-green-300 dark:border-green-700/50 rounded"></div>
            <span className="text-gray-600 dark:text-gray-300">Vacaciones aprobadas</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700/50 rounded"></div>
            <span className="text-gray-600 dark:text-gray-300">Vacaciones pendientes</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 bg-purple-100 dark:bg-purple-900/20 border border-purple-300 dark:border-purple-700/50 rounded"></div>
            <span className="text-gray-600 dark:text-gray-300">Licencias</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-600 rounded"></div>
            <span className="text-gray-600 dark:text-gray-300">Día actual</span>
          </div>
        </div>
      </div>
    </div>
  );
}

