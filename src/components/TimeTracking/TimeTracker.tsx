import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Play, Pause, Square, Clock, FolderOpen, Save, Building2, Timer } from 'lucide-react';

interface Client {
  id: string;
  name: string;
}

interface Department {
  id: string;
  name: string;
}

interface TimeTrackerProps {
  clients: Client[];
  onTimeSaved: () => void;
}

export function TimeTracker({ clients, onTimeSaved }: TimeTrackerProps) {
  const { profile } = useAuth();
  const [selectedClient, setSelectedClient] = useState('');
  const [description, setDescription] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0); // en segundos
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const pausedTimeRef = useRef<number>(0);

  useEffect(() => {
    loadDepartments();
  }, []);

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

  useEffect(() => {
    // Limpiar intervalo anterior si existe
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Solo iniciar intervalo si está corriendo y no está pausado
    if (isRunning && !isPaused) {
      intervalRef.current = setInterval(() => {
        if (startTimeRef.current) {
          const now = Date.now();
          const elapsed = Math.floor((now - startTimeRef.current + pausedTimeRef.current) / 1000);
          setElapsedTime(elapsed);
        }
      }, 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning, isPaused]);

  const handleStart = () => {
    if (!selectedClient) {
      setError('Debes seleccionar un cliente');
      return;
    }

    setError('');
    
    // Limpiar cualquier intervalo existente
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    if (isPaused) {
      // Continuar desde donde se pausó
      // El tiempo acumulado ya está en pausedTimeRef.current
      startTimeRef.current = Date.now();
      setIsPaused(false);
    } else {
      // Iniciar nuevo cronómetro
      startTimeRef.current = Date.now();
      pausedTimeRef.current = 0;
      setElapsedTime(0);
    }
    setIsRunning(true);
  };

  const handlePause = () => {
    // Detener el intervalo inmediatamente
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    // Guardar el tiempo acumulado hasta ahora
    if (startTimeRef.current) {
      const currentElapsed = Date.now() - startTimeRef.current;
      pausedTimeRef.current = pausedTimeRef.current + currentElapsed;
      // Actualizar el tiempo mostrado con el tiempo acumulado
      setElapsedTime(Math.floor(pausedTimeRef.current / 1000));
    }
    
    setIsRunning(false);
    setIsPaused(true);
  };

  const handleStop = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsRunning(false);
    setIsPaused(false);
    if (startTimeRef.current) {
      pausedTimeRef.current = Date.now() - startTimeRef.current + pausedTimeRef.current;
    }
  };

  const handleReset = () => {
    handleStop();
    setElapsedTime(0);
    pausedTimeRef.current = 0;
    startTimeRef.current = null;
    setSelectedClient('');
    setDescription('');
    setDepartmentId('');
    setError('');
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const convertSecondsToDecimalHours = (seconds: number) => {
    return seconds / 3600;
  };

  const handleSave = async () => {
    if (!selectedClient) {
      setError('Debes seleccionar un cliente');
      return;
    }

    if (elapsedTime === 0) {
      setError('No hay tiempo registrado para guardar');
      return;
    }

    if (!profile?.id) {
      setError('No se pudo identificar el usuario');
      return;
    }

    setSaving(true);
    setError('');

    try {
      // Si el tiempo es menor a 1 minuto, redondear a 1 minuto (60 segundos)
      const timeToSave = elapsedTime < 60 ? 60 : elapsedTime;
      const totalDecimalHours = convertSecondsToDecimalHours(timeToSave);
      const today = new Date().toISOString().split('T')[0];

      const { error: insertError } = await supabase
        .from('time_entries')
        .insert({
          user_id: profile.id,
          client_id: selectedClient,
          entry_date: today,
          hours_worked: totalDecimalHours,
          description: description || null,
          department_id: departmentId || null
        });

      if (insertError) throw insertError;

      // Resetear cronómetro después de guardar
      handleReset();
      onTimeSaved();
    } catch (err: any) {
      console.error('Error saving time entry:', err);
      setError(err.message || 'Error al guardar las horas');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Timer className="w-8 h-8 text-blue-600" />
            Cronómetro de Trabajo
          </h2>
          <p className="text-gray-600 mt-2">Registra tu tiempo trabajado en tiempo real</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="space-y-4">
        {/* Selección de cliente */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Cliente *
          </label>
          <select
            value={selectedClient}
            onChange={(e) => setSelectedClient(e.target.value)}
            disabled={isRunning}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
            <option value="">Seleccionar cliente</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </div>

        {/* Área (opcional) */}
        {departments.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Building2 className="w-4 h-4 inline mr-1" />
              Área (opcional)
            </label>
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              disabled={isRunning}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
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

        {/* Descripción/Motivo */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Motivo / Descripción (opcional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isRunning}
            placeholder="Describe el trabajo que realizarás..."
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
        </div>

        {/* Cronómetro */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 text-center">
          <div className="text-5xl font-mono font-bold text-blue-600 mb-4">
            {formatTime(elapsedTime)}
          </div>
          <div className="flex items-center justify-center gap-2 text-sm text-gray-600 mb-4">
            <Clock className="w-4 h-4" />
            <span>
              {Math.floor(elapsedTime / 3600)} horas, {Math.floor((elapsedTime % 3600) / 60)} minutos
            </span>
          </div>

          {/* Controles */}
          <div className="flex items-center justify-center gap-3">
            {!isRunning && !isPaused && (
              <button
                onClick={handleStart}
                disabled={!selectedClient}
                className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
              >
                <Play className="w-5 h-5" />
                Iniciar
              </button>
            )}

            {isRunning && (
              <button
                onClick={handlePause}
                className="flex items-center gap-2 px-6 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors font-medium"
              >
                <Pause className="w-5 h-5" />
                Pausar
              </button>
            )}

            {isPaused && (
              <>
                <button
                  onClick={handleStart}
                  className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                >
                  <Play className="w-5 h-5" />
                  Continuar
                </button>
                <button
                  onClick={handleStop}
                  className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                >
                  <Square className="w-5 h-5" />
                  Detener
                </button>
              </>
            )}

            {(isPaused || elapsedTime > 0) && (
              <button
                onClick={handleReset}
                className="flex items-center gap-2 px-4 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors font-medium"
              >
                Reiniciar
              </button>
            )}
          </div>
        </div>

        {/* Guardar horas */}
        {elapsedTime > 0 && !isRunning && (
          <div className="pt-4 border-t border-gray-200">
            <button
              onClick={handleSave}
              disabled={saving || !selectedClient}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
            >
              <Save className="w-5 h-5" />
              {saving ? 'Guardando...' : 'Guardar Horas'}
            </button>
            <p className="text-xs text-gray-500 mt-2 text-center">
              Se guardarán {Math.floor((elapsedTime < 60 ? 60 : elapsedTime) / 3600)} horas y {Math.floor(((elapsedTime < 60 ? 60 : elapsedTime) % 3600) / 60)} minutos
            </p>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

