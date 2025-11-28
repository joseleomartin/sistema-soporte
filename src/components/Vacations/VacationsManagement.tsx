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
  X
} from 'lucide-react';

interface Vacation {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  days_count: number;
  status: 'pending' | 'approved' | 'rejected';
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
  const [vacations, setVacations] = useState<Vacation[]>([]);
  const [filteredVacations, setFilteredVacations] = useState<Vacation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
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
    if (!profile?.id) return;

    try {
      let query = supabase
        .from('vacations')
        .select(`
          *,
          user_profile:profiles!vacations_user_id_fkey(full_name, email),
          approved_by_profile:profiles!vacations_approved_by_fkey(full_name)
        `)
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
    try {
      const { error } = await supabase
        .from('vacations')
        .update({
          status: 'approved',
          approved_by: profile?.id,
          approved_at: new Date().toISOString()
        })
        .eq('id', vacationId);

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

    try {
      const { error } = await supabase
        .from('vacations')
        .update({
          status: 'rejected',
          approved_by: profile?.id,
          approved_at: new Date().toISOString(),
          rejection_reason: reason
        })
        .eq('id', vacationId);

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

    try {
      const { error } = await supabase
        .from('vacations')
        .delete()
        .eq('id', vacationId);

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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const isAdmin = profile?.role === 'admin' || profile?.role === 'support';

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-3xl font-bold text-gray-900">Gestión de Vacaciones / Licencias</h2>
        {isAdmin ? (
          <button
            onClick={() => setShowAssignModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Asignar Vacaciones / Licencias
          </button>
        ) : (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Solicitar Vacaciones / Licencias
          </button>
        )}
      </div>

      {message && (
        <div className={`mb-6 rounded-lg p-4 flex items-start gap-3 ${
          message.type === 'success' 
            ? 'bg-green-50 border border-green-200' 
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

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, email o razón..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">Todos los estados</option>
              <option value="pending">Pendientes</option>
              <option value="approved">Aprobadas</option>
              <option value="rejected">Rechazadas</option>
            </select>
          </div>
        </div>
      </div>

      {/* Lista de vacaciones */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {filteredVacations.length === 0 ? (
          <div className="p-12 text-center">
            <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-400" />
            <p className="text-gray-500">No se encontraron vacaciones / licencias</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
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

  const startDate = new Date(vacation.start_date);
  const endDate = new Date(vacation.end_date);
  const canEdit = vacation.status === 'pending';

  const getStatusBadge = () => {
    switch (vacation.status) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
            <CheckCircle className="w-3 h-3" />
            Aprobada
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
            <XCircle className="w-3 h-3" />
            Rechazada
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
            <Clock className="w-3 h-3" />
            Pendiente
          </span>
        );
    }
  };

  return (
    <div className="p-6 hover:bg-gray-50 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-3">
            {getStatusBadge()}
            {isAdmin && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <User className="w-4 h-4" />
                <span>{vacation.user_profile?.full_name || 'Usuario'}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
            <div>
              <p className="text-xs text-gray-500 mb-1">Fecha de inicio</p>
              <p className="font-medium text-gray-900">
                {startDate.toLocaleDateString('es-ES', { 
                  weekday: 'short', 
                  year: 'numeric', 
                  month: 'short', 
                  day: 'numeric' 
                })}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Fecha de fin</p>
              <p className="font-medium text-gray-900">
                {endDate.toLocaleDateString('es-ES', { 
                  weekday: 'short', 
                  year: 'numeric', 
                  month: 'short', 
                  day: 'numeric' 
                })}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Días</p>
              <p className="font-medium text-gray-900">{vacation.days_count} día(s)</p>
            </div>
          </div>

          {vacation.reason && (
            <div className="mb-3">
              <p className="text-xs text-gray-500 mb-1">Razón</p>
              <p className="text-sm text-gray-700">{vacation.reason}</p>
            </div>
          )}

          {vacation.status === 'rejected' && vacation.rejection_reason && (
            <div className="mb-3 p-3 bg-red-50 rounded-lg">
              <p className="text-xs text-red-600 font-medium mb-1">Razón del rechazo</p>
              <p className="text-sm text-red-700">{vacation.rejection_reason}</p>
            </div>
          )}

          {vacation.status === 'approved' && vacation.approved_by_profile && (
            <p className="text-xs text-gray-500">
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
              className="px-3 py-1.5 text-sm font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
            >
              Aprobar
            </button>
            <button
              onClick={() => setShowRejectModal(true)}
              className="px-3 py-1.5 text-sm font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
            >
              Rechazar
            </button>
          </div>
        )}

        {canEdit && !isAdmin && (
          <button
            onClick={() => onDelete(vacation.id)}
            className="ml-4 px-3 py-1.5 text-sm font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
          >
            Eliminar
          </button>
        )}
      </div>

      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Rechazar Vacación / Licencia</h3>
            <p className="text-sm text-gray-600 mb-4">
              Por favor, proporciona una razón para rechazar esta solicitud de vacaciones / licencias.
            </p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Razón del rechazo..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent mb-4"
              rows={4}
            />
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectionReason('');
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  onReject(vacation.id, rejectionReason);
                  setShowRejectModal(false);
                  setRejectionReason('');
                }}
                className="px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
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

    if (!profile?.id) {
      setError('No se pudo identificar el usuario');
      return;
    }

    setLoading(true);

    try {
      const { error: insertError } = await supabase
        .from('vacations')
        .insert({
          user_id: profile.id,
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
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4">Solicitar Vacaciones / Licencias</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha de inicio *
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha de fin *
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate || new Date().toISOString().split('T')[0]}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Razón (opcional)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe el motivo de tus vacaciones / licencias..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
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
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
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

    if (!profile?.id) {
      setError('No se pudo identificar el administrador');
      return;
    }

    setLoading(true);

    try {
      // Asignar vacación directamente como aprobada
      const { error: insertError } = await supabase
        .from('vacations')
        .insert({
          user_id: selectedUserId,
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
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-900">Asignar Vacaciones / Licencias</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Usuario *
            </label>
            {loadingUsers ? (
              <div className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-500">
                Cargando usuarios...
              </div>
            ) : (
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha de inicio *
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha de fin *
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Razón (opcional)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Razón de las vacaciones / licencias..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || loadingUsers}
              className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Asignando...' : 'Asignar Vacaciones / Licencias'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

