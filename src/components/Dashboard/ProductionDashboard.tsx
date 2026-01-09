/**
 * Dashboard para Empresas de Producción
 * Muestra vacaciones/licencias y calendario con fechas importantes
 */

import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import { 
  Calendar as CalendarIcon,
  Plus,
  CheckCircle,
  XCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  X
} from 'lucide-react';
import { CreateEventModal } from '../Calendar/CreateEventModal';
import { EventDetailsModal } from '../Calendar/EventDetailsModal';

interface Vacation {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  days_count: number;
  status: 'pending' | 'approved' | 'rejected';
  type: 'vacation' | 'license';
  reason?: string;
  rejection_reason?: string;
  created_at: string;
}

export function ProductionDashboard() {
  const { profile } = useAuth();
  const { tenantId } = useTenant();
  const [loading, setLoading] = useState(true);
  const [userVacations, setUserVacations] = useState<Vacation[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [showEventModal, setShowEventModal] = useState(false);
  const [selectedDayEvents, setSelectedDayEvents] = useState<any[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
  const [showVacationModal, setShowVacationModal] = useState(false);
  const [showCalendarModal, setShowCalendarModal] = useState(false);

  useEffect(() => {
    if (profile?.id && tenantId) {
      loadUserVacations();
      loadEvents();
    }
  }, [profile?.id, tenantId]);

  useEffect(() => {
    if (profile?.id) {
      loadEvents();
    }
  }, [currentDate, profile?.id]);

  const loadUserVacations = async () => {
    if (!profile?.id || !tenantId) return;

    try {
      const { data, error } = await supabase
        .from('vacations')
        .select('*')
        .eq('user_id', profile.id)
        .eq('tenant_id', tenantId)
        .order('start_date', { ascending: false })
        .limit(10);

      if (error) throw error;
      setUserVacations(data || []);
    } catch (error) {
      console.error('Error loading vacations:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadEvents = async () => {
    if (!profile?.id || !tenantId) return;

    try {
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

      // Cargar eventos de calendario
      const { data: calendarEvents } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('tenant_id', tenantId)
        .or(`assigned_to.eq.${profile.id},assigned_to.is.null`)
        .gte('start_date', startOfMonth.toISOString().split('T')[0])
        .lte('start_date', endOfMonth.toISOString().split('T')[0])
        .order('start_date', { ascending: true });

      // Cargar vacaciones aprobadas del tenant para el calendario
      const { data: vacations } = await supabase
        .from('vacations')
        .select('*, user_profile:profiles!vacations_user_id_fkey(full_name)')
        .eq('tenant_id', tenantId)
        .eq('status', 'approved')
        .lte('start_date', endOfMonth.toISOString().split('T')[0])
        .gte('end_date', startOfMonth.toISOString().split('T')[0]);

      // Combinar eventos y vacaciones
      const allEvents = [
        ...(calendarEvents || []).map(e => ({ 
          ...e, 
          isPersonal: e.assigned_to === profile.id, 
          isVacation: false,
          type: 'event'
        })),
        ...(vacations || []).flatMap(vacation => {
          const start = new Date(vacation.start_date);
          const end = new Date(vacation.end_date);
          const vacationEvents = [];
          
          for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const year = d.getFullYear();
            const month = d.getMonth();
            const date = d.getDate();
            
            if (month === currentDate.getMonth() && year === currentDate.getFullYear()) {
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
              vacationEvents.push({
                id: `vacation-${vacation.id}-${dateStr}`,
                title: vacation.type === 'vacation' ? 'Vacaciones' : 'Licencia',
                start_date: `${dateStr}T00:00:00`,
                color: vacation.type === 'vacation' ? '#F59E0B' : '#A855F7',
                isVacation: true,
                type: 'vacation',
                vacationType: vacation.type,
                user_name: vacation.user_profile?.full_name || 'Usuario'
              });
            }
          }
          
          return vacationEvents;
        })
      ];

      setEvents(allEvents);
    } catch (error) {
      console.error('Error loading events:', error);
    }
  };

  const getEventsForDay = (day: number) => {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    return events.filter(event => {
      const eventDate = new Date(event.start_date);
      return (
        eventDate.getDate() === date.getDate() &&
        eventDate.getMonth() === date.getMonth() &&
        eventDate.getFullYear() === date.getFullYear()
      );
    });
  };

  const handleDayClick = (day: number) => {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    setSelectedDate(date);
    const dayEvents = getEventsForDay(day);
    setSelectedDayEvents(dayEvents);
    if (dayEvents.length === 0) {
      setShowEventModal(true);
    } else {
      setShowCalendarModal(true);
    }
  };

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const isToday = (day: number) => {
    const today = new Date();
    return (
      day === today.getDate() &&
      currentDate.getMonth() === today.getMonth() &&
      currentDate.getFullYear() === today.getFullYear()
    );
  };

  const isSelected = (day: number) => {
    if (!selectedDate) return false;
    return (
      day === selectedDate.getDate() &&
      currentDate.getMonth() === selectedDate.getMonth() &&
      currentDate.getFullYear() === selectedDate.getFullYear()
    );
  };

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    return { daysInMonth, startingDayOfWeek };
  };

  const { daysInMonth, startingDayOfWeek } = getDaysInMonth(currentDate);
  const calendarDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Inicio</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Gestiona tus vacaciones, licencias y consulta fechas importantes
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Widget de Vacaciones / Licencias */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-orange-600" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Vacaciones / Licencias</h3>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowVacationModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm"
              >
                <Plus className="w-4 h-4" />
                Solicitar
              </button>
            </div>
          </div>

          <div className="border-t border-gray-200 dark:border-slate-700 pt-4">
            <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-4">Mis Vacaciones / Licencias</h4>

            {userVacations.length === 0 ? (
              <div className="text-center py-8">
                <CalendarIcon className="w-12 h-12 mx-auto mb-3 text-gray-400 dark:text-gray-600" />
                <p className="text-gray-500 dark:text-gray-400 mb-2">No tienes vacaciones / licencias registradas</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Solicita tus vacaciones haciendo clic en el botón de arriba</p>
              </div>
            ) : (
              <div className="space-y-3">
                {userVacations.map((vacation) => {
                  const startParts = vacation.start_date.split('-');
                  const endParts = vacation.end_date.split('-');
                  const startDate = new Date(
                    parseInt(startParts[0]),
                    parseInt(startParts[1]) - 1,
                    parseInt(startParts[2])
                  );
                  const endDate = new Date(
                    parseInt(endParts[0]),
                    parseInt(endParts[1]) - 1,
                    parseInt(endParts[2])
                  );

                  const getStatusBadge = () => {
                    switch (vacation.status) {
                      case 'approved':
                        return (
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            Aprobada
                          </span>
                        );
                      case 'rejected':
                        return (
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 flex items-center gap-1">
                            <XCircle className="w-3 h-3" />
                            Rechazada
                          </span>
                        );
                      default:
                        return (
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Pendiente
                          </span>
                        );
                    }
                  };

                  return (
                    <div
                      key={vacation.id}
                      className="border border-gray-200 dark:border-slate-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {getStatusBadge()}
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {vacation.type === 'vacation' ? 'Vacaciones' : 'Licencia'}
                            </span>
                          </div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {startDate.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })} - {endDate.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            ({vacation.days_count} {vacation.days_count === 1 ? 'día' : 'días'})
                          </p>
                          {vacation.reason && (
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">{vacation.reason}</p>
                          )}
                          {vacation.status === 'rejected' && vacation.rejection_reason && (
                            <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                              Razón: {vacation.rejection_reason}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Calendario */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Calendario</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={previousMonth}
                className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              </button>
              <button
                onClick={nextMonth}
                className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded transition-colors"
              >
                <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
          </div>

          <div className="mb-4">
            <h4 className="text-md font-semibold text-gray-900 dark:text-white">
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h4>
          </div>

          {/* Días de la semana */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {dayNames.map((day) => (
              <div key={day} className="text-center text-xs font-medium text-gray-500 dark:text-gray-400 py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Días del mes */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: startingDayOfWeek }).map((_, index) => (
              <div key={`empty-${index}`} className="h-[100px]" />
            ))}

            {calendarDays.map((day) => {
              const dayEvents = getEventsForDay(day);
              const today = isToday(day);
              const selected = isSelected(day);

              return (
                <div
                  key={day}
                  onClick={() => handleDayClick(day)}
                  className={`
                    border border-gray-200 dark:border-slate-700 rounded p-2 h-[100px] cursor-pointer
                    ${today ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-600' : ''}
                    ${selected ? 'ring-2 ring-blue-500' : ''}
                    hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors
                    flex flex-col
                  `}
                >
                  <div className={`text-xs font-medium mb-1 ${today ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}>
                    {day}
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-1">
                    {dayEvents.slice(0, 2).map((event) => (
                      <div
                        key={event.id}
                        className="text-[10px] px-1.5 py-0.5 rounded truncate"
                        style={{ backgroundColor: event.color || '#3B82F6', color: 'white' }}
                        title={event.title}
                      >
                        {event.title}
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                      <div className="text-[10px] text-gray-500 dark:text-gray-400">
                        +{dayEvents.length - 2} más
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Próximos eventos */}
          <div className="mt-4 border-t border-gray-200 dark:border-slate-700 pt-4">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Próximos eventos</h4>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {events
                .filter(e => {
                  const eventDate = new Date(e.start_date);
                  return eventDate >= new Date();
                })
                .slice(0, 5)
                .map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400"
                  >
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: event.color || '#3B82F6' }}
                    />
                    <span className="truncate">
                      {new Date(event.start_date).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })} - {event.title}
                    </span>
                  </div>
                ))}
              {events.filter(e => new Date(e.start_date) >= new Date()).length === 0 && (
                <p className="text-xs text-gray-500 dark:text-gray-400">No hay eventos próximos</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal para solicitar vacaciones */}
      {showVacationModal && (
        <CreateVacationModal
          onClose={() => setShowVacationModal(false)}
          onSuccess={() => {
            setShowVacationModal(false);
            loadUserVacations();
            loadEvents();
          }}
        />
      )}

      {/* Modal de calendario para ver eventos de un día */}
      {showCalendarModal && selectedDate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Eventos - {selectedDate.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </h3>
              <button
                onClick={() => {
                  setShowCalendarModal(false);
                  setSelectedDate(null);
                  setSelectedDayEvents([]);
                }}
                className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded transition-colors"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {selectedDayEvents.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">No hay eventos en esta fecha</p>
              ) : (
                selectedDayEvents.map((event) => (
                  <div
                    key={event.id}
                    className="border border-gray-200 dark:border-slate-700 rounded-lg p-3"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: event.color || '#3B82F6' }}
                      />
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{event.title}</span>
                    </div>
                    {event.isVacation && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {event.vacationType === 'vacation' ? 'Vacaciones' : 'Licencia'}
                        {event.user_name && ` - ${event.user_name}`}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => {
                  setShowCalendarModal(false);
                  setSelectedDate(null);
                  setSelectedDayEvents([]);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para crear evento */}
      {showEventModal && selectedDate && (
        <CreateEventModal
          selectedDate={selectedDate}
          onClose={() => {
            setShowEventModal(false);
            setSelectedDate(null);
          }}
          onEventCreated={() => {
            setShowEventModal(false);
            setSelectedDate(null);
            loadEvents();
          }}
        />
      )}

      {/* Modal de detalles de evento */}
      {selectedEvent && (
        <EventDetailsModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onEventDeleted={() => {
            setSelectedEvent(null);
            loadEvents();
          }}
          onEventUpdated={() => {
            setSelectedEvent(null);
            loadEvents();
          }}
        />
      )}
    </div>
  );
}

// Componente modal para crear vacación
function CreateVacationModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { profile } = useAuth();
  const { tenantId } = useTenant();
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

    if (!profile?.id || !tenantId) {
      setError('No se pudo identificar el usuario o la empresa');
      return;
    }

    setLoading(true);

    try {
      const { error: insertError } = await supabase
        .from('vacations')
        .insert({
          user_id: profile.id,
          tenant_id: tenantId,
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
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-medium'
                    : 'border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-600'
                }`}
              >
                Vacaciones
              </button>
              <button
                type="button"
                onClick={() => setType('license')}
                className={`flex-1 px-4 py-2 rounded-lg border-2 transition-colors ${
                  type === 'license'
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 font-medium'
                    : 'border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-600'
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
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
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
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
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
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
              rows={3}
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Enviando...' : 'Solicitar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

