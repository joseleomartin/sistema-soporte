import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Clock, 
  Plus, 
  Calendar, 
  FolderOpen, 
  Edit, 
  Trash2, 
  CheckCircle,
  AlertCircle,
  Search,
  Filter,
  Building2,
  User
} from 'lucide-react';

interface TimeEntry {
  id: string;
  user_id: string;
  client_id: string;
  entry_date: string;
  hours_worked: number;
  description?: string;
  department_id?: string;
  created_at: string;
  updated_at: string;
  client?: {
    id: string;
    name: string;
  };
  department?: {
    id: string;
    name: string;
  };
  user?: {
    id: string;
    full_name: string;
    email: string;
  };
}

interface Client {
  id: string;
  name: string;
}

export function TimeEntry() {
  const { profile } = useAuth();
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [filteredEntries, setFilteredEntries] = useState<TimeEntry[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    if (profile?.id) {
      loadClients();
      loadTimeEntries();
    }
  }, [profile?.id, selectedDate]);

  useEffect(() => {
    filterEntries();
  }, [timeEntries, searchTerm]);

  const loadClients = async () => {
    if (!profile?.id) return;

    try {
      let data;
      let error;

      if (profile.role === 'user') {
        // Para usuarios normales, obtener solo los clientes asignados
        const { data: permData, error: permError } = await supabase
          .from('subforum_permissions')
          .select('subforum_id')
          .eq('user_id', profile.id)
          .eq('can_view', true);

        if (permError) throw permError;

        const subforumIds = permData?.map((p) => p.subforum_id) || [];

        if (subforumIds.length === 0) {
          setClients([]);
          return;
        }

        const result = await supabase
          .from('subforums')
          .select('id, name')
          .in('id', subforumIds)
          .order('name');

        data = result.data;
        error = result.error;
      } else {
        // Para admin/support, obtener todos los clientes
        const result = await supabase
          .from('subforums')
          .select('id, name')
          .order('name');

        data = result.data;
        error = result.error;
      }

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Error loading clients:', error);
    }
  };

  const loadTimeEntries = async () => {
    if (!profile?.id) return;

    try {
      let query = supabase
        .from('time_entries')
        .select(`
          *,
          client:subforums!time_entries_client_id_fkey(id, name),
          department:departments!time_entries_department_id_fkey(id, name),
          user:profiles!time_entries_user_id_fkey(id, full_name, email)
        `)
        .eq('entry_date', selectedDate)
        .order('created_at', { ascending: false });

      // Si no es admin/support, solo ver sus propias horas
      if (profile.role !== 'admin' && profile.role !== 'support') {
        query = query.eq('user_id', profile.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      setTimeEntries(data || []);
    } catch (error: any) {
      console.error('Error loading time entries:', error);
      setMessage({ type: 'error', text: 'Error al cargar las horas' });
    } finally {
      setLoading(false);
    }
  };

  const filterEntries = () => {
    let filtered = timeEntries;

    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(entry =>
        entry.client?.name?.toLowerCase().includes(searchLower) ||
        entry.description?.toLowerCase().includes(searchLower)
      );
    }

    setFilteredEntries(filtered);
  };

  const handleDelete = async (entryId: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar esta entrada de horas?')) return;

    try {
      const { error } = await supabase
        .from('time_entries')
        .delete()
        .eq('id', entryId);

      if (error) throw error;

      setMessage({ type: 'success', text: 'Entrada eliminada correctamente' });
      setTimeout(() => setMessage(null), 3000);
      await loadTimeEntries();
    } catch (error: any) {
      console.error('Error deleting entry:', error);
      setMessage({ type: 'error', text: 'Error al eliminar la entrada' });
      setTimeout(() => setMessage(null), 5000);
    }
  };

  // Función helper para formatear horas decimales a horas y minutos
  const formatHoursMinutes = (decimalHours: number) => {
    const hours = Math.floor(decimalHours);
    const minutes = Math.round((decimalHours - hours) * 60);
    
    if (hours === 0 && minutes === 0) {
      return '0 min';
    }
    if (hours === 0) {
      return `${minutes} min`;
    }
    if (minutes === 0) {
      return `${hours} ${hours === 1 ? 'hora' : 'horas'}`;
    }
    return `${hours} ${hours === 1 ? 'hora' : 'horas'} ${minutes} min`;
  };

  const totalHours = filteredEntries.reduce((sum, entry) => sum + parseFloat(entry.hours_worked.toString()), 0);

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
          <h2 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Clock className="w-8 h-8 text-blue-600" />
            Carga de Horas
          </h2>
          <p className="text-gray-600 mt-2">Registra las horas trabajadas por cliente</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Cargar Horas
        </button>
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
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-gray-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por cliente o descripción..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-lg">
            <Clock className="w-5 h-5 text-blue-600" />
            <span className="font-semibold text-blue-900">
              Total: {formatHoursMinutes(totalHours)}
            </span>
          </div>
        </div>
      </div>

      {/* Lista de entradas */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {filteredEntries.length === 0 ? (
          <div className="p-12 text-center">
            <Clock className="w-12 h-12 mx-auto mb-3 text-gray-400" />
            <p className="text-gray-500">No hay horas cargadas para esta fecha</p>
            <p className="text-sm text-gray-400 mt-1">Haz clic en "Cargar Horas" para agregar una entrada</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredEntries.map((entry) => (
              <div key={entry.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <FolderOpen className="w-5 h-5 text-blue-600" />
                      <h3 className="font-semibold text-gray-900">{entry.client?.name || 'Cliente desconocido'}</h3>
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                        {formatHoursMinutes(parseFloat(entry.hours_worked.toString()))}
                      </span>
                    </div>
                    {entry.user && (
                      <div className="flex items-center gap-2 ml-8 mb-2">
                        <User className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-600 font-medium">{entry.user.full_name}</span>
                        {profile?.role === 'admin' || profile?.role === 'support' ? (
                          <span className="text-xs text-gray-400">({entry.user.email})</span>
                        ) : null}
                      </div>
                    )}
                    {entry.description && (
                      <p className="text-sm text-gray-600 ml-8 mb-2">{entry.description}</p>
                    )}
                    {entry.department && (
                      <div className="flex items-center gap-2 ml-8 mb-1">
                        <Building2 className="w-4 h-4 text-gray-400" />
                        <span className="text-xs text-gray-500">{entry.department.name}</span>
                      </div>
                    )}
                    <p className="text-xs text-gray-400 ml-8 mt-1">
                      {new Date(entry.created_at).toLocaleString('es-ES')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditingEntry(entry)}
                      className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Editar"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(entry.id)}
                      className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {(showCreateModal || editingEntry) && (
        <TimeEntryModal
          entry={editingEntry}
          clients={clients}
          selectedDate={selectedDate}
          onClose={() => {
            setShowCreateModal(false);
            setEditingEntry(null);
          }}
          onSuccess={() => {
            setShowCreateModal(false);
            setEditingEntry(null);
            loadTimeEntries();
          }}
        />
      )}
    </div>
  );
}

// Modal para crear/editar entrada de horas
function TimeEntryModal({ 
  entry, 
  clients, 
  selectedDate, 
  onClose, 
  onSuccess 
}: {
  entry?: TimeEntry | null;
  clients: Client[];
  selectedDate: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { profile } = useAuth();
  const [clientId, setClientId] = useState(entry?.client_id || '');
  const [date, setDate] = useState(entry?.entry_date || selectedDate);
  
  // Convertir horas decimales a horas y minutos para mostrar
  const convertDecimalToHoursMinutes = (decimalHours: number) => {
    const hours = Math.floor(decimalHours);
    const minutes = Math.round((decimalHours - hours) * 60);
    return { hours, minutes };
  };
  
  const initialTime = entry?.hours_worked 
    ? convertDecimalToHoursMinutes(parseFloat(entry.hours_worked.toString()))
    : { hours: 0, minutes: 0 };
  
  const [hoursInput, setHoursInput] = useState(initialTime.hours.toString());
  const [minutesInput, setMinutesInput] = useState(initialTime.minutes.toString());
  const [description, setDescription] = useState(entry?.description || '');
  const [departmentId, setDepartmentId] = useState(entry?.department_id || '');
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadDepartments();
  }, []);

  // Actualizar campos cuando cambie la entrada
  useEffect(() => {
    if (entry?.hours_worked) {
      const time = convertDecimalToHoursMinutes(parseFloat(entry.hours_worked.toString()));
      setHoursInput(time.hours.toString());
      setMinutesInput(time.minutes.toString());
    } else {
      setHoursInput('0');
      setMinutesInput('0');
    }
    setClientId(entry?.client_id || '');
    setDate(entry?.entry_date || selectedDate);
    setDescription(entry?.description || '');
    setDepartmentId(entry?.department_id || '');
  }, [entry, selectedDate]);

  const loadDepartments = async () => {
    if (!profile?.id) return;

    try {
      let deptIds: string[] = [];

      if (profile.role === 'user') {
        // Obtener áreas del usuario
        const { data: userDepts } = await supabase
          .from('user_departments')
          .select('department_id')
          .eq('user_id', profile.id);

        deptIds = userDepts?.map(d => d.department_id) || [];
      } else {
        // Admin/support: todas las áreas
        const { data: allDepts } = await supabase
          .from('departments')
          .select('id');
        
        deptIds = allDepts?.map(d => d.id) || [];
      }

      if (deptIds.length > 0) {
        const { data: deptsData } = await supabase
          .from('departments')
          .select('id, name')
          .in('id', deptIds)
          .order('name');

        setDepartments(deptsData || []);
      }
    } catch (error) {
      console.error('Error loading departments:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!clientId) {
      setError('Debes seleccionar un cliente');
      return;
    }

    // Validar y convertir horas y minutos a decimal
    const hours = parseInt(hoursInput) || 0;
    const minutes = parseInt(minutesInput) || 0;

    if (hours === 0 && minutes === 0) {
      setError('Debes ingresar al menos 1 minuto');
      return;
    }

    if (minutes < 0 || minutes >= 60) {
      setError('Los minutos deben estar entre 0 y 59');
      return;
    }

    // Convertir a horas decimales
    const totalDecimalHours = hours + (minutes / 60);

    if (totalDecimalHours > 24) {
      setError('El tiempo total no puede exceder 24 horas');
      return;
    }

    if (!profile?.id) {
      setError('No se pudo identificar el usuario');
      return;
    }

    setLoading(true);

    try {
      const entryData = {
        user_id: profile.id,
        client_id: clientId,
        entry_date: date,
        hours_worked: totalDecimalHours,
        description: description || null,
        department_id: departmentId || null
      };

      if (entry) {
        // Actualizar
        const { error: updateError } = await supabase
          .from('time_entries')
          .update(entryData)
          .eq('id', entry.id);

        if (updateError) throw updateError;
      } else {
        // Crear
        const { error: insertError } = await supabase
          .from('time_entries')
          .insert(entryData);

        if (insertError) throw insertError;
      }

      onSuccess();
    } catch (err: any) {
      console.error('Error saving time entry:', err);
      setError(err.message || 'Error al guardar la entrada de horas');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4">
          {entry ? 'Editar Horas' : 'Cargar Horas'}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cliente *
            </label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
              disabled={!!entry}
            >
              <option value="">Seleccionar cliente</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fecha *
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Horas trabajadas *
            </label>
            <div className="flex gap-3">
              <div className="flex-1">
                <input
                  type="number"
                  min="0"
                  max="24"
                  value={hoursInput}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '' || (parseInt(val) >= 0 && parseInt(val) <= 24)) {
                      setHoursInput(val);
                    }
                  }}
                  placeholder="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">Horas (0-24)</p>
              </div>
              <div className="flex-1">
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={minutesInput}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '' || (parseInt(val) >= 0 && parseInt(val) <= 59)) {
                      setMinutesInput(val);
                    }
                  }}
                  placeholder="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">Minutos (0-59)</p>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Ejemplo: 1 hora y 10 minutos, o solo 10 minutos (0 horas y 10 minutos)
            </p>
          </div>

          {departments.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Área (opcional)
              </label>
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Sin área específica</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descripción (opcional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe el trabajo realizado..."
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
              {loading ? 'Guardando...' : entry ? 'Actualizar' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

