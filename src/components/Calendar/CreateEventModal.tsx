import { useState, useEffect } from 'react';
import { X, Calendar, Clock, User, Users as UsersIcon, Building2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface CreateEventModalProps {
  selectedDate: Date | null;
  onClose: () => void;
  onEventCreated: () => void;
}

export function CreateEventModal({ selectedDate, onClose, onEventCreated }: CreateEventModalProps) {
  const { profile } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [allDay, setAllDay] = useState(false);
  const [color, setColor] = useState('#3B82F6');
  const [assignMode, setAssignMode] = useState<'users' | 'departments'>('users');
  const [assignTo, setAssignTo] = useState<string[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState<string>('');
  const [recurrenceCount, setRecurrenceCount] = useState<number>(12);
  const [recurrenceMode, setRecurrenceMode] = useState<'day_of_month' | 'weekday'>('day_of_month');
  const [recurrenceWeekday, setRecurrenceWeekday] = useState<number | null>(null);
  const [recurrenceWeekPosition, setRecurrenceWeekPosition] = useState<number | null>(null);

  const canAssignEvents = profile?.role === 'admin' || profile?.role === 'support';

  useEffect(() => {
    if (canAssignEvents) {
      loadUsers();
      loadDepartments();
    }
  }, [canAssignEvents]);

  const loadUsers = async () => {
    try {
      // Admin puede asignar a users y support
      // Support solo puede asignar a users
      let query = supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .order('full_name');

      if (profile?.role === 'admin') {
        // Admin ve users y support
        query = query.in('role', ['user', 'support']);
      } else {
        // Support solo ve users
        query = query.eq('role', 'user');
      }

      const { data } = await query;
      setUsers(data || []);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const loadDepartments = async () => {
    try {
      const { data } = await supabase
        .from('departments')
        .select('id, name, color')
        .order('name');

      setDepartments(data || []);
    } catch (error) {
      console.error('Error loading departments:', error);
    }
  };

  const toggleItem = (itemId: string) => {
    setAssignTo(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !selectedDate || !profile) return;

    setLoading(true);
    setError(null);

    try {
      const startDate = new Date(selectedDate);
      if (!allDay) {
        const [hours, minutes] = startTime.split(':');
        startDate.setHours(parseInt(hours), parseInt(minutes));
      }

      let endDate = null;
      if (!allDay && endTime) {
        endDate = new Date(selectedDate);
        const [hours, minutes] = endTime.split(':');
        endDate.setHours(parseInt(hours), parseInt(minutes));
      }

      if (!profile.tenant_id) {
        setError('No se pudo identificar la empresa');
        setLoading(false);
        return;
      }

      // Preparar datos base del evento
      const baseEventData = {
        title: title.trim(),
        description: description.trim() || null,
        start_date: startDate.toISOString(),
        end_date: endDate?.toISOString() || null,
        all_day: allDay,
        color,
        created_by: profile.id,
        tenant_id: profile.tenant_id, // Agregar tenant_id para aislamiento multi-tenant
        event_type: 'personal' as const,
        is_recurring: isRecurring,
        recurrence_pattern: isRecurring ? 'monthly' : null,
        recurrence_end_date: isRecurring && recurrenceEndDate ? new Date(recurrenceEndDate + 'T23:59:59').toISOString() : null,
        recurrence_count: isRecurring && !recurrenceEndDate ? recurrenceCount : null,
        recurrence_original_date: isRecurring ? startDate.toISOString() : null,
        parent_event_id: null,
        recurrence_weekday: isRecurring && recurrenceMode === 'weekday' ? recurrenceWeekday : null,
        recurrence_week_position: isRecurring && recurrenceMode === 'weekday' ? recurrenceWeekPosition : null,
      };

      // Si no hay usuarios/departamentos asignados, crear evento personal
      if (assignTo.length === 0) {
        const eventData = {
          ...baseEventData,
          assigned_to: null,
        };

        const { error: insertError } = await supabase
          .from('calendar_events')
          .insert(eventData);

        if (insertError) {
          console.error('Error al crear evento personal:', insertError);
          throw new Error(`Error al crear evento: ${insertError.message}`);
        }

        // Si es recurrente, generar eventos futuros
        if (isRecurring) {
          // Validar que si es modo weekday, tenga los valores necesarios
          if (recurrenceMode === 'weekday' && (recurrenceWeekday === null || recurrenceWeekPosition === null)) {
            throw new Error('Por favor, selecciona el día de la semana y la posición en el mes para eventos recurrentes por día de la semana.');
          }
          try {
            await supabase.rpc('generate_recurring_events');
          } catch (rpcError) {
            console.warn('Error al generar eventos recurrentes (no crítico):', rpcError);
            // Continuar aunque falle la generación de eventos recurrentes
          }
        }
      } else if (assignMode === 'departments') {
        // Asignar a todos los usuarios de los departamentos seleccionados
        const userIds: string[] = [];
        
        for (const deptId of assignTo) {
          const { data: deptUsers } = await supabase
            .from('user_departments')
            .select('user_id')
            .eq('department_id', deptId);
          
          if (deptUsers) {
            userIds.push(...deptUsers.map(u => u.user_id));
          }
        }

        // Eliminar duplicados
        const uniqueUserIds = [...new Set(userIds)];

        if (uniqueUserIds.length === 0) {
          throw new Error('Los departamentos seleccionados no tienen usuarios asignados');
        }

        // Crear un evento para cada usuario
        const events = uniqueUserIds.map(userId => ({
          ...baseEventData,
          assigned_to: userId,
          event_type: 'assigned' as const,
        }));

        const { error: insertError } = await supabase
          .from('calendar_events')
          .insert(events);

        if (insertError) {
          console.error('Error al crear eventos por departamento:', insertError);
          throw new Error(`Error al crear eventos: ${insertError.message}`);
        }

        // Si es recurrente, generar eventos futuros
        if (isRecurring) {
          // Validar que si es modo weekday, tenga los valores necesarios
          if (recurrenceMode === 'weekday' && (recurrenceWeekday === null || recurrenceWeekPosition === null)) {
            throw new Error('Por favor, selecciona el día de la semana y la posición en el mes para eventos recurrentes por día de la semana.');
          }
          try {
            await supabase.rpc('generate_recurring_events');
          } catch (rpcError) {
            console.warn('Error al generar eventos recurrentes (no crítico):', rpcError);
            // Continuar aunque falle la generación de eventos recurrentes
          }
        }
      } else {
        // Crear un evento para cada usuario seleccionado
        const events = assignTo.map(userId => ({
          ...baseEventData,
          assigned_to: userId,
          event_type: 'assigned' as const,
        }));

        const { error: insertError } = await supabase
          .from('calendar_events')
          .insert(events);

        if (insertError) {
          console.error('Error al crear eventos asignados:', insertError);
          throw new Error(`Error al crear eventos: ${insertError.message}`);
        }

        // Si es recurrente, generar eventos futuros
        if (isRecurring) {
          // Validar que si es modo weekday, tenga los valores necesarios
          if (recurrenceMode === 'weekday' && (recurrenceWeekday === null || recurrenceWeekPosition === null)) {
            throw new Error('Por favor, selecciona el día de la semana y la posición en el mes para eventos recurrentes por día de la semana.');
          }
          try {
            await supabase.rpc('generate_recurring_events');
          } catch (rpcError) {
            console.warn('Error al generar eventos recurrentes (no crítico):', rpcError);
            // Continuar aunque falle la generación de eventos recurrentes
          }
        }
      }

      onEventCreated();
      onClose();
    } catch (err: any) {
      console.error('Error creating event:', err);
      setError(err.message || 'Error al crear el evento. Por favor, intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const colors = [
    { value: '#3B82F6', label: 'Azul' },
    { value: '#8B5CF6', label: 'Púrpura' },
    { value: '#10B981', label: 'Verde' },
    { value: '#F59E0B', label: 'Naranja' },
    { value: '#EF4444', label: 'Rojo' },
    { value: '#6B7280', label: 'Gris' },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-slate-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            Nuevo Evento
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Mensaje de error */}
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-lg">
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          {/* Título */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Título *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Reunión con cliente"
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Descripción
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalles del evento..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Fecha */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Fecha
            </label>
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-lg">
              <Calendar className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {selectedDate?.toLocaleDateString('es-ES', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </span>
            </div>
          </div>

          {/* Todo el día */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="allDay"
              checked={allDay}
              onChange={(e) => setAllDay(e.target.checked)}
              className="w-4 h-4 text-blue-600 dark:text-blue-400 border-gray-300 dark:border-slate-600 rounded focus:ring-blue-500"
            />
            <label htmlFor="allDay" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Todo el día
            </label>
          </div>

          {/* Horarios */}
          {!allDay && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Hora inicio
                </label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Hora fin
                </label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Color */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Color
            </label>
            <div className="flex gap-2">
              {colors.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  className={`w-8 h-8 rounded-full transition ${
                    color === c.value ? 'ring-2 ring-offset-2 ring-blue-500' : ''
                  }`}
                  style={{ backgroundColor: c.value }}
                  title={c.label}
                />
              ))}
            </div>
          </div>

          {/* Evento Recurrente */}
          <div className="border-t border-gray-200 dark:border-slate-700 pt-4">
            <div className="flex items-center gap-2 mb-3">
              <input
                type="checkbox"
                id="isRecurring"
                checked={isRecurring}
                onChange={(e) => {
                  setIsRecurring(e.target.checked);
                  if (!e.target.checked) {
                    setRecurrenceMode('day_of_month');
                    setRecurrenceWeekday(null);
                    setRecurrenceWeekPosition(null);
                  }
                }}
                className="w-4 h-4 text-blue-600 dark:text-blue-400 border-gray-300 dark:border-slate-600 rounded focus:ring-blue-500"
              />
              <label htmlFor="isRecurring" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Evento recurrente (se repite mensualmente)
              </label>
            </div>

            {isRecurring && (
              <div className="ml-6 space-y-4 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800/50">
                {/* Modo de recurrencia */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Tipo de recurrencia
                  </label>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        id="recurrenceDayOfMonth"
                        name="recurrenceMode"
                        checked={recurrenceMode === 'day_of_month'}
                        onChange={() => {
                          setRecurrenceMode('day_of_month');
                          setRecurrenceWeekday(null);
                          setRecurrenceWeekPosition(null);
                        }}
                        className="w-4 h-4 text-blue-600 dark:text-blue-400 border-gray-300 dark:border-slate-600 focus:ring-blue-500"
                      />
                      <label htmlFor="recurrenceDayOfMonth" className="text-sm text-gray-700 dark:text-gray-300">
                        Mismo día del mes (ej: día 15 de cada mes)
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        id="recurrenceWeekday"
                        name="recurrenceMode"
                        checked={recurrenceMode === 'weekday'}
                        onChange={() => {
                          setRecurrenceMode('weekday');
                          // Establecer valores por defecto si no están configurados
                          if (recurrenceWeekday === null && selectedDate) {
                            const dayOfWeek = selectedDate.getDay(); // 0 = domingo, 1 = lunes, etc.
                            setRecurrenceWeekday(dayOfWeek);
                            // Calcular la posición en el mes (primer, segundo, etc.)
                            const dayOfMonth = selectedDate.getDate();
                            const weekPosition = Math.ceil(dayOfMonth / 7);
                            setRecurrenceWeekPosition(Math.min(weekPosition, 4));
                          }
                        }}
                        className="w-4 h-4 text-blue-600 dark:text-blue-400 border-gray-300 dark:border-slate-600 focus:ring-blue-500"
                      />
                      <label htmlFor="recurrenceWeekday" className="text-sm text-gray-700 dark:text-gray-300">
                        Día de la semana específico (ej: primer jueves de cada mes)
                      </label>
                    </div>
                  </div>
                </div>

                {/* Configuración de día de la semana */}
                {recurrenceMode === 'weekday' && (
                  <div className="space-y-3 bg-white dark:bg-slate-700 p-3 rounded border border-blue-200 dark:border-blue-800/50">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Día de la semana
                      </label>
                      <div className="grid grid-cols-7 gap-1">
                        {[
                          { value: 0, label: 'D', full: 'Domingo' },
                          { value: 1, label: 'L', full: 'Lunes' },
                          { value: 2, label: 'M', full: 'Martes' },
                          { value: 3, label: 'X', full: 'Miércoles' },
                          { value: 4, label: 'J', full: 'Jueves' },
                          { value: 5, label: 'V', full: 'Viernes' },
                          { value: 6, label: 'S', full: 'Sábado' },
                        ].map((day) => (
                          <button
                            key={day.value}
                            type="button"
                            onClick={() => setRecurrenceWeekday(day.value)}
                            className={`px-2 py-2 text-sm font-medium rounded transition ${
                              recurrenceWeekday === day.value
                                ? 'bg-blue-600 dark:bg-blue-500 text-white'
                                : 'bg-gray-100 dark:bg-slate-600 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-500'
                            }`}
                            title={day.full}
                          >
                            {day.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Posición en el mes
                      </label>
                      <div className="grid grid-cols-5 gap-2">
                        {[
                          { value: 1, label: 'Primer' },
                          { value: 2, label: 'Segundo' },
                          { value: 3, label: 'Tercer' },
                          { value: 4, label: 'Cuarto' },
                          { value: -1, label: 'Último' },
                        ].map((pos) => (
                          <button
                            key={pos.value}
                            type="button"
                            onClick={() => setRecurrenceWeekPosition(pos.value)}
                            className={`px-3 py-2 text-sm font-medium rounded transition ${
                              recurrenceWeekPosition === pos.value
                                ? 'bg-blue-600 dark:bg-blue-500 text-white'
                                : 'bg-gray-100 dark:bg-slate-600 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-500'
                            }`}
                          >
                            {pos.label}
                          </button>
                        ))}
                      </div>
                      {recurrenceWeekday !== null && recurrenceWeekPosition !== null && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                          El evento será el{' '}
                          {recurrenceWeekPosition === -1 ? 'último' : ['', 'primer', 'segundo', 'tercer', 'cuarto'][recurrenceWeekPosition]}{' '}
                          {['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'][recurrenceWeekday]} de cada mes
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Configuración de fin de recurrencia */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    ¿Cuándo termina la recurrencia?
                  </label>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        id="recurrenceEndDate"
                        name="recurrenceType"
                        checked={recurrenceEndDate !== ''}
                        onChange={() => {
                          setRecurrenceCount(12);
                          if (!recurrenceEndDate) {
                            const endDate = new Date(selectedDate || new Date());
                            endDate.setMonth(endDate.getMonth() + 12);
                            setRecurrenceEndDate(endDate.toISOString().split('T')[0]);
                          }
                        }}
                        className="w-4 h-4 text-blue-600 dark:text-blue-400 border-gray-300 dark:border-slate-600 focus:ring-blue-500"
                      />
                      <label htmlFor="recurrenceEndDate" className="text-sm text-gray-700 dark:text-gray-300">
                        Hasta una fecha específica
                      </label>
                    </div>
                    {recurrenceEndDate && (
                      <div className="ml-6">
                        <input
                          type="date"
                          value={recurrenceEndDate}
                          onChange={(e) => setRecurrenceEndDate(e.target.value)}
                          min={selectedDate?.toISOString().split('T')[0]}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        id="recurrenceCount"
                        name="recurrenceType"
                        checked={recurrenceEndDate === ''}
                        onChange={() => {
                          setRecurrenceEndDate('');
                        }}
                        className="w-4 h-4 text-blue-600 dark:text-blue-400 border-gray-300 dark:border-slate-600 focus:ring-blue-500"
                      />
                      <label htmlFor="recurrenceCount" className="text-sm text-gray-700 dark:text-gray-300">
                        Número de ocurrencias
                      </label>
                    </div>
                    {!recurrenceEndDate && (
                      <div className="ml-6">
                        <input
                          type="number"
                          value={recurrenceCount}
                          onChange={(e) => setRecurrenceCount(Math.max(1, parseInt(e.target.value) || 1))}
                          min={1}
                          max={60}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          El evento se repetirá {recurrenceCount} {recurrenceCount === 1 ? 'vez' : 'veces'} (mensualmente)
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Asignar a usuarios o departamentos (solo admin/support) */}
          {canAssignEvents && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Asignar evento (opcional)
              </label>
              
              {/* Tabs */}
              <div className="flex gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => {
                    setAssignMode('users');
                    setAssignTo([]);
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition ${
                    assignMode === 'users'
                      ? 'bg-blue-600 dark:bg-blue-500 text-white'
                      : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                  }`}
                >
                  <UsersIcon className="w-4 h-4" />
                  <span className="text-sm font-medium">Usuarios</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAssignMode('departments');
                    setAssignTo([]);
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition ${
                    assignMode === 'departments'
                      ? 'bg-blue-600 dark:bg-blue-500 text-white'
                      : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                  }`}
                >
                  <Building2 className="w-4 h-4" />
                  <span className="text-sm font-medium">Departamentos</span>
                </button>
              </div>

              {/* Lista de usuarios o departamentos */}
              <div className="border border-gray-300 dark:border-slate-600 rounded-lg p-3 max-h-48 overflow-y-auto bg-gray-50 dark:bg-slate-700">
                {assignMode === 'users' ? (
                  users.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">
                      No hay usuarios disponibles
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {users.map((user) => (
                        <label
                          key={user.id}
                          className="flex items-center gap-3 p-2 hover:bg-white dark:hover:bg-slate-600 rounded-lg cursor-pointer transition"
                        >
                          <input
                            type="checkbox"
                            checked={assignTo.includes(user.id)}
                            onChange={() => toggleItem(user.id)}
                            className="w-4 h-4 text-blue-600 dark:text-blue-400 border-gray-300 dark:border-slate-600 rounded focus:ring-blue-500"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {user.full_name}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                              {user.email}
                              {user.role === 'support' && (
                                <span className="ml-2 px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 rounded text-xs font-medium">
                                  Support
                                </span>
                              )}
                            </p>
                          </div>
                        </label>
                      ))}
                    </div>
                  )
                ) : (
                  departments.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">
                      No hay departamentos disponibles
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {departments.map((dept) => (
                        <label
                          key={dept.id}
                          className="flex items-center gap-3 p-2 hover:bg-white dark:hover:bg-slate-600 rounded-lg cursor-pointer transition"
                        >
                          <input
                            type="checkbox"
                            checked={assignTo.includes(dept.id)}
                            onChange={() => toggleItem(dept.id)}
                            className="w-4 h-4 text-blue-600 dark:text-blue-400 border-gray-300 dark:border-slate-600 rounded focus:ring-blue-500"
                          />
                          <div className="flex items-center gap-2 flex-1">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: dept.color }}
                            />
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {dept.name}
                            </p>
                          </div>
                        </label>
                      ))}
                    </div>
                  )
                )}
              </div>
              
              {assignTo.length > 0 && (
                <p className="mt-2 text-xs text-purple-600 dark:text-purple-400 flex items-center gap-1">
                  {assignMode === 'users' ? (
                    <>
                      <UsersIcon className="w-3 h-3" />
                      Este evento será visible para {assignTo.length} {assignTo.length === 1 ? 'usuario' : 'usuarios'}
                    </>
                  ) : (
                    <>
                      <Building2 className="w-3 h-3" />
                      Este evento se enviará a todos los usuarios de {assignTo.length} {assignTo.length === 1 ? 'departamento' : 'departamentos'}
                    </>
                  )}
                </p>
              )}
            </div>
          )}

          {/* Botones */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-600 transition font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !title.trim()}
              className="flex-1 px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creando...' : 'Crear Evento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

