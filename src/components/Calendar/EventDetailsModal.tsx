import { X, Calendar, Clock, User, FileText, Trash2, Edit } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useState } from 'react';

interface EventDetailsModalProps {
  event: any;
  onClose: () => void;
  onEventDeleted: () => void;
  onEventUpdated: () => void;
}

export function EventDetailsModal({ event, onClose, onEventDeleted, onEventUpdated }: EventDetailsModalProps) {
  const { profile } = useAuth();
  const [deleting, setDeleting] = useState(false);

  const canEdit = event.isPersonal || profile?.role === 'admin' || profile?.role === 'support';
  const canDelete = event.isPersonal || profile?.role === 'admin' || profile?.role === 'support';

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleDelete = async () => {
    if (!confirm('¿Estás seguro de que quieres eliminar este evento?')) return;

    setDeleting(true);
    try {
      const { error } = await supabase
        .from('calendar_events')
        .delete()
        .eq('id', event.id);

      if (error) throw error;

      onEventDeleted();
      onClose();
    } catch (error) {
      console.error('Error deleting event:', error);
      alert('Error al eliminar el evento');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full">
        {/* Header con color del evento */}
        <div 
          className="p-6 rounded-t-xl"
          style={{ backgroundColor: event.color || '#3B82F6' }}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-white mb-2">
                {event.title}
              </h2>
              {!event.isPersonal && event.created_by_profile && (
                <div className="flex items-center gap-2 text-white text-sm bg-white bg-opacity-20 rounded-lg px-3 py-1 inline-flex">
                  <User className="w-4 h-4" />
                  <span>Asignado por: {event.created_by_profile.full_name}</span>
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition text-white"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Contenido */}
        <div className="p-6 space-y-4">
          {/* Descripción */}
          {event.description && (
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-700 mb-1">Descripción</p>
                <p className="text-gray-600 whitespace-pre-wrap">{event.description}</p>
              </div>
            </div>
          )}

          {/* Fecha */}
          <div className="flex items-start gap-3">
            <Calendar className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-700 mb-1">Fecha</p>
              <p className="text-gray-600">{formatDate(event.start_date)}</p>
            </div>
          </div>

          {/* Hora */}
          {!event.all_day && (
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-700 mb-1">Horario</p>
                <p className="text-gray-600">
                  {formatTime(event.start_date)}
                  {event.end_date && ` - ${formatTime(event.end_date)}`}
                </p>
              </div>
            </div>
          )}

          {event.all_day && (
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-700 mb-1">Horario</p>
                <p className="text-gray-600">Todo el día</p>
              </div>
            </div>
          )}

          {/* Tipo de evento */}
          <div className="pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: event.color || '#3B82F6' }}
                />
                <span className="text-sm text-gray-600">
                  {event.isPersonal ? 'Evento personal' : 'Evento asignado'}
                </span>
              </div>
              <span className="text-xs text-gray-400">
                {new Date(event.created_at).toLocaleDateString('es-ES')}
              </span>
            </div>
          </div>
        </div>

        {/* Footer con acciones */}
        {(canEdit || canDelete) && (
          <div className="p-6 bg-gray-50 rounded-b-xl border-t border-gray-200">
            <div className="flex gap-3">
              {canDelete && (
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-4 h-4" />
                  {deleting ? 'Eliminando...' : 'Eliminar'}
                </button>
              )}
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition font-medium"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
















