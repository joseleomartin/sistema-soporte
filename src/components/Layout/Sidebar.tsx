import { Home, Ticket, FolderOpen, Video, Users, Settings, LogOut, Wrench, Building2, User, CheckSquare } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useExtraction } from '../../contexts/ExtractionContext';
import { NotificationBell } from '../Notifications/NotificationBell';
import { useState, useEffect } from 'react';

type MenuItem = {
  icon: typeof Home;
  label: string;
  view: string;
  roles: ('admin' | 'support' | 'user')[];
};

const menuItems: MenuItem[] = [
  { icon: Home, label: 'Dashboard', view: 'dashboard', roles: ['admin', 'support', 'user'] },
  { icon: FolderOpen, label: 'Clientes', view: 'forums', roles: ['admin', 'support', 'user'] },
  { icon: Video, label: 'Salas de Reunión', view: 'meetings', roles: ['admin', 'support', 'user'] },
  { icon: Wrench, label: 'Herramientas', view: 'tools', roles: ['admin', 'support', 'user'] },
  { icon: CheckSquare, label: 'Tareas', view: 'tasks', roles: ['admin', 'support', 'user'] },
  { icon: Building2, label: 'Areas', view: 'departments', roles: ['admin', 'support', 'user'] },
  { icon: Users, label: 'Usuarios', view: 'users', roles: ['admin'] },
  { icon: Settings, label: 'Mi Perfil', view: 'settings', roles: ['admin', 'support', 'user'] },
  { icon: Ticket, label: 'Soporte', view: 'tickets', roles: ['admin', 'support', 'user'] },
];

interface SidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
  onNavigateToTicket?: (ticketId: string) => void;
  onNavigateToTask?: (taskId: string) => void;
}

export function Sidebar({ currentView, onViewChange, onNavigateToTicket, onNavigateToTask }: SidebarProps) {
  const { profile, signOut } = useAuth();
  const { activeJobsCount } = useExtraction();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.avatar_url) {
      setAvatarUrl(profile.avatar_url);
    }
  }, [profile?.avatar_url]);

  const filteredItems = menuItems.filter(item =>
    profile && item.roles.includes(profile.role)
  );

  const handleNavigateToCalendar = () => {
    onViewChange('dashboard'); // El calendario está en el dashboard
  };

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900">EmaGroup</h1>
          <NotificationBell 
            onNavigateToTicket={onNavigateToTicket}
            onNavigateToCalendar={handleNavigateToCalendar}
            onNavigateToTasks={() => onViewChange('tasks')}
          />
        </div>
        {profile && (
          <div className="pt-4 border-t border-gray-100">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-full overflow-hidden bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-6 h-6 text-white" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{profile.full_name}</p>
                <p className="text-xs text-gray-500 truncate">{profile.email}</p>
              </div>
            </div>
            <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${
              profile.role === 'admin' ? 'bg-purple-100 text-purple-700' :
              profile.role === 'support' ? 'bg-blue-100 text-blue-700' :
              'bg-gray-100 text-gray-700'
            }`}>
              {profile.role === 'admin' ? 'Administrador' :
               profile.role === 'support' ? 'Soporte' : 'Usuario'}
            </span>
          </div>
        )}
      </div>

      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          {filteredItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.view;
            const showBadge = item.view === 'tools' && activeJobsCount > 0;
            return (
              <li key={item.view}>
                <button
                  onClick={() => onViewChange(item.view)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition relative ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="flex-1 text-left">{item.label}</span>
                  {showBadge && (
                    <span className="bg-blue-600 text-white text-xs font-bold rounded-full h-5 min-w-[20px] px-1.5 flex items-center justify-center animate-pulse">
                      {activeJobsCount}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-4 border-t border-gray-200">
        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-lg transition"
        >
          <LogOut className="w-5 h-5" />
          <span>Cerrar Sesión</span>
        </button>
      </div>
    </aside>
  );
}
