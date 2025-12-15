import { Home, Ticket, FolderOpen, Video, Users, Settings, LogOut, Wrench, Building2, User, CheckSquare, Calendar, Clock, BookOpen, Heart, FileText, ChevronDown, ChevronRight, Briefcase } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useExtraction } from '../../contexts/ExtractionContext';
import { NotificationBell } from '../Notifications/NotificationBell';
import { useState, useEffect } from 'react';

type MenuItem = {
  icon: typeof Home;
  label: string;
  view: string;
  roles: ('admin' | 'support' | 'user')[];
  children?: MenuItem[];
};

const menuItems: MenuItem[] = [
  { icon: Home, label: 'Inicio', view: 'dashboard', roles: ['admin', 'support', 'user'] },
  { icon: Video, label: 'Sala de Reuniones', view: 'meetings', roles: ['admin', 'support', 'user'] },
  {
    icon: Users,
    label: 'Personas',
    view: 'personas',
    roles: ['admin', 'support', 'user'],
    children: [
      { icon: FileText, label: 'Onboarding y Políticas Internas', view: 'internal-policies', roles: ['admin', 'support', 'user'] },
      { icon: BookOpen, label: 'Bibliotecas y Cursos', view: 'library', roles: ['admin', 'support', 'user'] },
      { icon: Briefcase, label: 'Novedades Profesionales', view: 'professional-news', roles: ['admin', 'support', 'user'] },
      { icon: Calendar, label: 'Vacaciones y Licencias', view: 'vacations', roles: ['admin', 'support'] },
      { icon: Heart, label: 'Social', view: 'social', roles: ['admin', 'support', 'user'] },
    ]
  },
  {
    icon: Building2,
    label: 'Negocio',
    view: 'negocio',
    roles: ['admin', 'support', 'user'],
    children: [
      { icon: FolderOpen, label: 'Clientes', view: 'forums', roles: ['admin', 'support', 'user'] },
      { icon: Clock, label: 'Carga de Horas', view: 'time-tracking', roles: ['admin', 'support', 'user'] },
      { icon: CheckSquare, label: 'Tareas', view: 'tasks', roles: ['admin', 'support', 'user'] },
      { icon: Wrench, label: 'Herramientas', view: 'tools', roles: ['admin', 'support', 'user'] },
    ]
  },
  { icon: Ticket, label: 'Soporte', view: 'tickets', roles: ['admin', 'support', 'user'] },
  { icon: Users, label: 'Usuarios', view: 'users', roles: ['admin'] },
  { icon: Settings, label: 'Mi Perfil', view: 'settings', roles: ['admin', 'support', 'user'] },
];

interface SidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
  onNavigateToTicket?: (ticketId: string) => void;
  onNavigateToTask?: (taskId: string) => void;
  onNavigateToForum?: (subforumId: string) => void;
  onNavigateToTimeTracking?: () => void;
}

export function Sidebar({ currentView, onViewChange, onNavigateToTicket, onNavigateToTask, onNavigateToForum, onNavigateToTimeTracking }: SidebarProps) {
  const { profile, signOut } = useAuth();
  const { activeJobsCount } = useExtraction();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [logoError, setLogoError] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [openSubmenus, setOpenSubmenus] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (profile?.avatar_url) {
      setAvatarUrl(profile.avatar_url);
    }
  }, [profile?.avatar_url]);

  const filteredItems = menuItems.filter(item =>
    profile && item.roles.includes(profile.role)
  );

  const toggleSubmenu = (view: string) => {
    setOpenSubmenus(prev => {
      const newSet = new Set(prev);
      if (newSet.has(view)) {
        newSet.delete(view);
      } else {
        newSet.add(view);
      }
      return newSet;
    });
  };

  const isSubmenuOpen = (view: string) => openSubmenus.has(view);

  const isItemActive = (item: MenuItem): boolean => {
    if (item.view === currentView) return true;
    if (item.children) {
      return item.children.some(child => child.view === currentView);
    }
    return false;
  };

  // Auto-abrir submenús si el item activo está dentro
  useEffect(() => {
    const itemsToOpen = new Set<string>();
    filteredItems.forEach(item => {
      if (item.children) {
        const hasActiveChild = item.children.some(child => 
          profile && child.roles.includes(profile.role) && child.view === currentView
        );
        if (hasActiveChild) {
          itemsToOpen.add(item.view);
        }
      }
    });
    if (itemsToOpen.size > 0) {
      setOpenSubmenus(prev => {
        const newSet = new Set(prev);
        itemsToOpen.forEach(view => newSet.add(view));
        return newSet;
      });
    }
  }, [currentView, profile?.role]);

  const handleNavigateToCalendar = () => {
    onViewChange('dashboard'); // El calendario está en el dashboard
  };

  const handleSignOut = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isSigningOut) return; // Evitar múltiples clics
    
    setIsSigningOut(true);
    try {
      await signOut();
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
      setIsSigningOut(false);
    }
  };

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col h-screen fixed left-0 top-0">
      <div className="px-4 py-3 border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center justify-between mb-3 gap-2">
          <div className="flex items-center flex-1 min-w-0">
            {logoError ? (
              <h1 className="text-2xl font-bold text-gray-900">EmaGroup</h1>
            ) : (
              <img 
                src="/logo%20ema.png" 
                alt="EmaGroup" 
                className="h-16 w-auto object-contain"
                onError={() => setLogoError(true)}
              />
            )}
          </div>
          <NotificationBell 
            onNavigateToTicket={onNavigateToTicket}
            onNavigateToCalendar={handleNavigateToCalendar}
            onNavigateToTasks={() => onViewChange('tasks')}
            onNavigateToForum={onNavigateToForum || ((subforumId) => {
              onViewChange('forums');
            })}
            onNavigateToSocial={() => onViewChange('social')}
            onNavigateToTimeTracking={onNavigateToTimeTracking || (() => onViewChange('time-tracking'))}
            onNavigateToProfessionalNews={() => onViewChange('professional-news')}
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

      <nav className="flex-1 p-4 overflow-y-auto min-h-0">
        <ul className="space-y-1">
          {filteredItems.map((item) => {
            const Icon = item.icon;
            const hasChildren = item.children && item.children.length > 0;
            const isActive = isItemActive(item);
            const isOpen = isSubmenuOpen(item.view);
            const showBadge = item.view === 'tools' && activeJobsCount > 0;
            const filteredChildren = item.children?.filter(child =>
              profile && child.roles.includes(profile.role)
            );

            return (
              <li key={item.view}>
                <button
                  onClick={() => {
                    if (hasChildren) {
                      toggleSubmenu(item.view);
                    } else {
                      onViewChange(item.view);
                    }
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition relative ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="flex-1 text-left">{item.label}</span>
                  {hasChildren && (
                    isOpen ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )
                  )}
                  {showBadge && (
                    <span className="bg-blue-600 text-white text-xs font-bold rounded-full h-5 min-w-[20px] px-1.5 flex items-center justify-center animate-pulse">
                      {activeJobsCount}
                    </span>
                  )}
                </button>
                {hasChildren && isOpen && filteredChildren && filteredChildren.length > 0 && (
                  <ul className="ml-4 mt-1 space-y-1 border-l-2 border-gray-200 pl-2">
                    {filteredChildren.map((child) => {
                      const ChildIcon = child.icon;
                      const isChildActive = currentView === child.view;
                      const showChildBadge = child.view === 'tools' && activeJobsCount > 0;
                      return (
                        <li key={child.view}>
                          <button
                            onClick={() => onViewChange(child.view)}
                            className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg transition relative ${
                              isChildActive
                                ? 'bg-blue-50 text-blue-700 font-medium'
                                : 'text-gray-600 hover:bg-gray-50'
                            }`}
                          >
                            <ChildIcon className="w-4 h-4" />
                            <span className="flex-1 text-left text-sm">{child.label}</span>
                            {showChildBadge && (
                              <span className="bg-blue-600 text-white text-xs font-bold rounded-full h-5 min-w-[20px] px-1.5 flex items-center justify-center animate-pulse">
                                {activeJobsCount}
                              </span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-4 border-t border-gray-200 flex-shrink-0 mt-auto">
        <button
          onClick={handleSignOut}
          disabled={isSigningOut}
          className={`w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-lg transition ${
            isSigningOut ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          <LogOut className="w-5 h-5" />
          <span>{isSigningOut ? 'Cerrando sesión...' : 'Cerrar Sesión'}</span>
        </button>
      </div>
    </aside>
  );
}