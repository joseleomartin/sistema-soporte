import { useState, useEffect } from 'react';
import { ArrowLeft, ExternalLink, Video } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

interface Room {
  id: string;
  name: string;
  description: string | null;
  jitsi_room_id: string;
}

interface MeetingRoomProps {
  room: Room;
  onBack: () => void;
}

export function MeetingRoom({ room, onBack }: MeetingRoomProps) {
  const { profile } = useAuth();
  const [showIframe, setShowIframe] = useState(false);

  const userName = encodeURIComponent(profile?.full_name || 'Usuario');
  const roomUrl = `https://meet.jit.si/${room.jitsi_room_id}#userInfo.displayName="${userName}"&config.prejoinPageEnabled=false`;

  // Registrar presencia cuando el usuario entra a la sala
  useEffect(() => {
    if (!profile || !showIframe) return;

    let heartbeatInterval: NodeJS.Timeout;

    const registerPresence = async () => {
      try {
        // Insertar o actualizar presencia
        await supabase
          .from('room_presence')
          .upsert({
            room_id: room.id,
            user_id: profile.id,
            user_name: profile.full_name,
            last_seen: new Date().toISOString()
          }, {
            onConflict: 'room_id,user_id'
          });
      } catch (error) {
        console.error('Error registering presence:', error);
      }
    };

    const removePresence = async () => {
      try {
        await supabase
          .from('room_presence')
          .delete()
          .eq('room_id', room.id)
          .eq('user_id', profile.id);
      } catch (error) {
        console.error('Error removing presence:', error);
      }
    };

    // Registrar presencia inicial
    registerPresence();

    // Actualizar presencia cada 30 segundos (heartbeat)
    heartbeatInterval = setInterval(registerPresence, 30000);

    // Limpiar al salir
    return () => {
      clearInterval(heartbeatInterval);
      removePresence();
    };
  }, [profile, room.id, showIframe]);

  const handleJoinInNewTab = () => {
    window.open(roomUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="h-full flex flex-col">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="w-5 h-5" />
        Volver a Salas
      </button>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-4">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">{room.name}</h2>
        {room.description && (
          <p className="text-gray-600 mb-2">{room.description}</p>
        )}
        <p className="text-sm text-gray-500">
          Sala permanente - Los participantes pueden unirse y salir en cualquier momento
        </p>
      </div>

      {!showIframe ? (
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden min-h-[600px] flex items-center justify-center">
          <div className="text-center max-w-md mx-auto p-8">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Video className="w-10 h-10 text-green-600" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-3">
              Unirse a la Sala
            </h3>
            <p className="text-gray-600 mb-6">
              Selecciona cómo quieres unirte a la videollamada
            </p>

            <div className="space-y-3">
              <button
                onClick={() => setShowIframe(true)}
                className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold text-lg shadow-md"
              >
                <Video className="w-5 h-5" />
                Unirse Aquí
              </button>

              <button
                onClick={handleJoinInNewTab}
                className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold text-lg shadow-md"
              >
                <ExternalLink className="w-5 h-5" />
                Abrir en Nueva Pestaña
              </button>
            </div>

            <p className="text-xs text-gray-500 mt-6">
              Recuerda permitir el acceso a tu cámara y micrófono cuando te lo solicite el navegador
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden relative">
          <div className="absolute top-4 right-4 z-10">
            <button
              onClick={handleJoinInNewTab}
              className="flex items-center gap-2 px-3 py-2 bg-white/90 backdrop-blur-sm text-gray-700 rounded-lg hover:bg-white transition shadow-lg text-sm font-medium border border-gray-200"
            >
              <ExternalLink className="w-4 h-4" />
              Abrir en Nueva Pestaña
            </button>
          </div>
          <iframe
            src={roomUrl}
            allow="camera; microphone; fullscreen; display-capture; autoplay"
            className="w-full h-full min-h-[600px]"
            title={room.name}
          />
        </div>
      )}
    </div>
  );
}
