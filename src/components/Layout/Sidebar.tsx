import { Home, Ticket, FolderOpen, Video, Users, Settings, LogOut, Wrench, Building2, User, CheckSquare, Calendar, Clock, BookOpen, Heart, FileText, ChevronDown, ChevronRight, ChevronLeft, Briefcase, Sun, Moon, Menu, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useExtraction } from '../../contexts/ExtractionContext';
import { useTheme } from '../../contexts/ThemeContext';
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
  isCollapsed?: boolean;
  onCollapseChange?: (collapsed: boolean) => void;
}

export function Sidebar({ currentView, onViewChange, onNavigateToTicket, onNavigateToTask, onNavigateToForum, onNavigateToTimeTracking, isCollapsed: externalIsCollapsed, onCollapseChange }: SidebarProps) {
  const { profile, signOut } = useAuth();
  const { activeJobsCount } = useExtraction();
  const { theme, toggleTheme } = useTheme();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [logoError, setLogoError] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [openSubmenus, setOpenSubmenus] = useState<Set<string>>(new Set());
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [internalIsCollapsed, setInternalIsCollapsed] = useState(false);
  
  const isCollapsed = externalIsCollapsed !== undefined ? externalIsCollapsed : internalIsCollapsed;
  
  const handleCollapseToggle = () => {
    const newCollapsed = !isCollapsed;
    if (onCollapseChange) {
      onCollapseChange(newCollapsed);
    } else {
      setInternalIsCollapsed(newCollapsed);
    }
  };

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
    <>
      {/* Botón hamburguesa para móvil */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-[#173548] text-white rounded-lg shadow-lg hover:bg-[#1a3d52] transition-colors"
        aria-label="Toggle menu"
      >
        {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Overlay para móvil */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <aside className={`${isCollapsed ? 'w-0' : 'w-64'} bg-[#173548] border-r border-gray-700/30 flex flex-col h-screen fixed left-0 top-0 shadow-xl z-40 transform transition-all duration-300 ease-in-out overflow-hidden ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
      {/* Header con logo y notificaciones */}
      <div className={`px-5 py-4 border-b border-gray-700/30 flex-shrink-0 bg-[#173548] ${isCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        <div className="flex items-center justify-between mb-4 gap-2">
          <button
            onClick={() => onViewChange('dashboard')}
            className="flex items-center flex-1 min-w-0 cursor-pointer hover:opacity-80 transition-opacity"
            title="Ir al inicio"
          >
            {logoError ? (
              <h1 className="text-2xl font-bold text-white">EmaGroup</h1>
            ) : (
              <img 
                src="/logo%20ema.png" 
                alt="EmaGroup" 
                className="h-16 w-auto object-contain drop-shadow-sm"
                onError={() => setLogoError(true)}
              />
            )}
          </button>
          {!isCollapsed && (
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
          )}
        </div>
        {profile && !isCollapsed && (
          <div className="pt-4 border-t border-gray-700/30 bg-[#173548]">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-xl overflow-hidden bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0 shadow-lg ring-2 ring-white/50">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-6 h-6 text-white" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{profile.full_name}</p>
                <p className="text-xs text-gray-300 truncate">{profile.email}</p>
              </div>
            </div>
            <span className={`inline-block px-3 py-1.5 text-xs font-semibold rounded-lg shadow-sm ${
              profile.role === 'admin' ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white' :
              profile.role === 'support' ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white' :
              'bg-gradient-to-r from-gray-500 to-gray-600 text-white'
            }`}>
              {profile.role === 'admin' ? 'Administrador' :
               profile.role === 'support' ? 'Soporte' : 'Usuario'}
            </span>
          </div>
        )}
      </div>

      {/* Navegación */}
      <nav className={`flex-1 p-3 overflow-y-auto min-h-0 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent ${isCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        <ul className="space-y-1.5">
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
                      setIsMobileMenuOpen(false); // Cerrar menú en móvil al seleccionar
                    }
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 relative group ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30 font-semibold scale-[1.02]'
                      : 'text-white/90 hover:bg-white/10 hover:text-white hover:shadow-md hover:scale-[1.01]'
                  }`}
                >
                  <Icon className={`w-5 h-5 transition-transform duration-200 ${isActive ? 'text-white' : 'text-white/80 group-hover:text-white'}`} />
                  <span className="flex-1 text-left">{item.label}</span>
                  {hasChildren && (
                    <div className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
                      {isOpen ? (
                        <ChevronDown className={`w-4 h-4 ${isActive ? 'text-white' : 'text-white/70'}`} />
                    ) : (
                        <ChevronRight className={`w-4 h-4 ${isActive ? 'text-white' : 'text-white/70'}`} />
                      )}
                    </div>
                  )}
                  {showBadge && (
                    <span className="bg-white text-blue-600 text-xs font-bold rounded-full h-5 min-w-[20px] px-1.5 flex items-center justify-center shadow-md animate-pulse">
                      {activeJobsCount}
                    </span>
                  )}
                </button>
                {hasChildren && isOpen && filteredChildren && filteredChildren.length > 0 && (
                  <ul className="ml-6 mt-1.5 space-y-1 border-l-2 border-white/20 pl-3 animate-in slide-in-from-top-2 duration-200">
                    {filteredChildren.map((child) => {
                      const ChildIcon = child.icon;
                      const isChildActive = currentView === child.view;
                      const showChildBadge = child.view === 'tools' && activeJobsCount > 0;
                      return (
                        <li key={child.view}>
                          <button
                            onClick={() => {
                              onViewChange(child.view);
                              setIsMobileMenuOpen(false); // Cerrar menú en móvil al seleccionar
                            }}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 relative group ${
                              isChildActive
                                ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md shadow-blue-500/20 font-medium scale-[1.01]'
                                : 'text-white/80 hover:bg-white/10 hover:text-white hover:shadow-sm'
                            }`}
                          >
                            <ChildIcon className={`w-4 h-4 transition-colors ${isChildActive ? 'text-white' : 'text-white/70 group-hover:text-white'}`} />
                            <span className="flex-1 text-left text-sm">{child.label}</span>
                            {showChildBadge && (
                              <span className="bg-white text-blue-600 text-xs font-bold rounded-full h-5 min-w-[20px] px-1.5 flex items-center justify-center shadow-sm animate-pulse">
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

      {/* Footer con toggle de tema y botón de cerrar sesión */}
      <div className={`p-4 border-t border-gray-700/30 flex-shrink-0 mt-auto bg-[#173548] space-y-2 ${isCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        {/* Toggle de tema */}
        <button
          onClick={() => {
            toggleTheme();
            setIsMobileMenuOpen(false); // Cerrar menú en móvil
          }}
          className="w-full flex items-center gap-3 px-4 py-3 text-white/90 hover:bg-white/10 hover:text-white rounded-xl transition-all duration-200 font-medium shadow-sm hover:shadow-md"
          title={theme === 'light' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
        >
          {theme === 'light' ? (
            <Moon className="w-5 h-5" />
          ) : (
            <Sun className="w-5 h-5" />
          )}
          <span>{theme === 'light' ? 'Modo Oscuro' : 'Modo Claro'}</span>
        </button>
        
        {/* Botón de cerrar sesión */}
        <button
          onClick={handleSignOut}
          disabled={isSigningOut}
          className={`w-full flex items-center gap-3 px-4 py-3 text-white/90 hover:bg-white/10 hover:text-white rounded-xl transition-all duration-200 font-medium shadow-sm hover:shadow-md ${
            isSigningOut ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          <LogOut className="w-5 h-5" />
          <span>{isSigningOut ? 'Cerrando sesión...' : 'Cerrar Sesión'}</span>
        </button>
      </div>
    </aside>

    {/* Botón para colapsar/expandir sidebar (solo desktop) */}
    <button
      onClick={handleCollapseToggle}
      className={`hidden lg:flex fixed top-4 z-50 w-6 h-6 bg-[#173548] border-2 border-gray-700/30 text-white rounded-full items-center justify-center shadow-lg hover:bg-[#1a3d52] transition-all duration-300 ${
        isCollapsed ? 'left-2' : 'left-[248px]'
      }`}
      title={isCollapsed ? 'Mostrar menú' : 'Ocultar menú'}
    >
      {isCollapsed ? (
        <ChevronRight className="w-4 h-4" />
      ) : (
        <ChevronLeft className="w-4 h-4" />
      )}
    </button>
    </>
  );
}
