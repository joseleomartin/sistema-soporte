import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Video, Plus, Users } from 'lucide-react';
import { MeetingRoom } from './MeetingRoom';
import { CreateRoomModal } from './CreateRoomModal';

interface Room {
  id: string;
  name: string;
  description: string | null;
  jitsi_room_id: string;
  is_active: boolean;
  created_at: string;
}

interface RoomWithPresence extends Room {
  activeUsers: number;
}

export function MeetingRoomsList() {
  const { profile } = useAuth();
  const [rooms, setRooms] = useState<RoomWithPresence[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRooms();
    
    // Suscribirse a cambios en room_presence
    const presenceChannel = supabase
      .channel('room_presence_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'room_presence'
        },
        () => {
          // Recargar contadores cuando hay cambios
          loadRooms();
        }
      )
      .subscribe();

    return () => {
      presenceChannel.unsubscribe();
    };
  }, [profile]);

  const loadRooms = async () => {
    if (!profile) return;

    try {
      const { data, error } = await supabase
        .from('meeting_rooms')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      if (data) {
        // Obtener contador de usuarios activos para cada sala
        const roomsWithPresence = await Promise.all(
          data.map(async (room) => {
            const { count } = await supabase
              .from('room_presence')
              .select('*', { count: 'exact', head: true })
              .eq('room_id', room.id)
              .gte('last_seen', new Date(Date.now() - 5 * 60 * 1000).toISOString()); // Últimos 5 minutos

            return {
              ...room,
              activeUsers: count || 0
            };
          })
        );
        
        setRooms(roomsWithPresence);
      }
    } catch (error) {
      console.error('Error loading rooms:', error);
    } finally {
      setLoading(false);
    }
  };

  if (selectedRoom) {
    const room = rooms.find(r => r.id === selectedRoom);
    if (room) {
      return (
        <MeetingRoom
          room={room}
          onBack={() => setSelectedRoom(null)}
        />
      );
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Salas de Reunión</h2>
          <p className="text-gray-600 mt-2">
            Salas permanentes de videoconferencia - Únete en cualquier momento
          </p>
        </div>
        {profile?.role === 'admin' && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
          >
            <Plus className="w-5 h-5" />
            Crear Sala
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rooms.length === 0 ? (
            <div className="col-span-full bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
              <Video className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">No hay salas de reunión disponibles</p>
              {profile?.role === 'admin' && (
                <p className="text-sm text-gray-400 mt-2">Crea la primera sala para comenzar</p>
              )}
            </div>
          ) : (
            rooms.map((room) => (
              <button
                key={room.id}
                onClick={() => setSelectedRoom(room.id)}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-lg hover:border-green-300 transition cursor-pointer text-left group relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-16 h-16 bg-green-500 rounded-bl-full opacity-10 group-hover:opacity-20 transition" />

                <div className="relative">
                  <div className="flex items-start gap-4 mb-4">
                    <div className="p-3 bg-green-100 rounded-lg group-hover:bg-green-200 transition">
                      <Video className="w-6 h-6 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-lg text-gray-900">{room.name}</h3>
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                          Activa
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {room.description || 'Sala de videollamada permanente disponible 24/7'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                    <div className="flex items-center gap-2">
                      {room.activeUsers > 0 ? (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-100 text-green-700 rounded-full">
                          <Users className="w-4 h-4" />
                          <span className="text-sm font-medium">
                            {room.activeUsers} {room.activeUsers === 1 ? 'conectado' : 'conectados'}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-sm text-gray-500">
                          <Users className="w-4 h-4" />
                          <span>Sin usuarios</span>
                        </div>
                      )}
                    </div>
                    <span className="text-sm font-medium text-green-600 group-hover:text-green-700">
                      Unirse ahora →
                    </span>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      )}

      {showCreateModal && (
        <CreateRoomModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            loadRooms();
          }}
        />
      )}
    </div>
  );
}
