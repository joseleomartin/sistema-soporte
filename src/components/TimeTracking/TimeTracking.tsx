import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { TimeEntry } from './TimeEntry';
import { TimeReports } from './TimeReports';
import { Clock, BarChart3 } from 'lucide-react';

export function TimeTracking() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'entry' | 'reports'>('entry');

  const isAdmin = profile?.role === 'admin' || profile?.role === 'support';

  return (
    <div>
      {isAdmin && (
        <div className="mb-6 border-b border-gray-200">
          <nav className="flex gap-4">
            <button
              onClick={() => setActiveTab('entry')}
              className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'entry'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Cargar Horas
              </div>
            </button>
            <button
              onClick={() => setActiveTab('reports')}
              className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'reports'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Reportes
              </div>
            </button>
          </nav>
        </div>
      )}

      {activeTab === 'entry' || !isAdmin ? (
        <TimeEntry />
      ) : (
        <TimeReports />
      )}
    </div>
  );
}

