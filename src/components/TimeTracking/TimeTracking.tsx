import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { TimeEntry } from './TimeEntry';
import { TimeReports } from './TimeReports';
import { TimeTracker } from './TimeTracker';
import { CostCalculation } from './CostCalculation';
import { Clock, BarChart3, Timer, Calculator } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Client {
  id: string;
  name: string;
}

export function TimeTracking() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'entry' | 'timer' | 'reports' | 'costs'>('entry');
  const [clients, setClients] = useState<Client[]>([]);

  const isAdmin = profile?.role === 'admin' || profile?.role === 'support';

  useEffect(() => {
    loadClients();
  }, [profile?.id]);

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

  const handleTimeSaved = () => {
    // Recargar clientes si es necesario
    loadClients();
    // Cambiar a la pestaña de "Cargar Horas" para ver la entrada guardada
    setActiveTab('entry');
  };

  return (
    <div>
      <div className="mb-6 border-b border-gray-200 dark:border-slate-700">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('entry')}
            className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
              activeTab === 'entry'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Cargar Horas
            </div>
          </button>
          {isAdmin && (
            <button
              onClick={() => setActiveTab('timer')}
              className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'timer'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Timer className="w-4 h-4" />
                Cronómetro
              </div>
            </button>
          )}
          {isAdmin && (
            <button
              onClick={() => setActiveTab('reports')}
              className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'reports'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Reportes
              </div>
            </button>
          )}
          {profile?.role === 'admin' && (
            <button
              onClick={() => setActiveTab('costs')}
              className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'costs'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:text-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Calculator className="w-4 h-4" />
                Cálculo de Costos
              </div>
            </button>
          )}
        </nav>
      </div>

      {activeTab === 'entry' && <TimeEntry key={activeTab} />}
      {activeTab === 'timer' && isAdmin && <TimeTracker clients={clients} onTimeSaved={handleTimeSaved} />}
      {activeTab === 'reports' && isAdmin && <TimeReports />}
      {activeTab === 'costs' && profile?.role === 'admin' && <CostCalculation />}
    </div>
  );
}



