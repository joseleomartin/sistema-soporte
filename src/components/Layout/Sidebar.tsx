import { useState, useEffect } from 'react';
import { 
  Home, 
  Video, 
  Users as UsersIcon, 
  Building2, 
  Headphones, 
  Settings, 
  LogOut, 
  Sun, 
  User,
  ChevronDown,
  ChevronUp,
  FileText,
  BookOpen,
  Briefcase,
  Calendar,
  Heart,
  FolderOpen,
  Clock,
  CheckSquare,
  Wrench,
  Layers,
  Factory,
  Package,
  ShoppingCart,
  TrendingUp,
  DollarSign,
  Truck,
  Menu,
  X,
  CreditCard,
  BarChart3
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useExtraction } from '../../contexts/ExtractionContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useTenant } from '../../contexts/TenantContext';
import { useDepartmentPermissions } from '../../hooks/useDepartmentPermissions';
import { NotificationBell } from '../Notifications/NotificationBell';
import { supabase } from '../../lib/supabase';

interface SidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
  onNavigateToTicket: (ticketId: string) => void;
  onNavigateToForum: (subforumId: string) => void;
  onNavigateToTimeTracking: () => void;
  onNavigateToSocial?: () => void;
  onNavigateToProfessionalNews?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

type SubMenuItem = {
  icon: typeof FileText;
  label: string;
  view: string;
  roles: ('admin' | 'support' | 'user')[];
};

type MenuItem = {
  icon: typeof Home;
  label: string;
  view?: string;
  roles: ('admin' | 'support' | 'user')[];
  subItems?: SubMenuItem[];
};

const menuItems: MenuItem[] = [
  { icon: Home, label: 'Inicio', view: 'dashboard', roles: ['admin', 'support', 'user'] },
  { icon: Video, label: 'Sala de Reuniones', view: 'meetings', roles: ['admin', 'support', 'user'] },
  { 
    icon: UsersIcon, 
    label: 'Personas', 
    roles: ['admin', 'support', 'user'],
    subItems: [
      { icon: Layers, label: 'Áreas', view: 'departments', roles: ['admin', 'support', 'user'] },
      { icon: FileText, label: 'Onboarding y Políticas Internas', view: 'internal-policies', roles: ['admin', 'support', 'user'] },
      { icon: BookOpen, label: 'Bibliotecas y Cursos', view: 'library', roles: ['admin', 'support', 'user'] },
      { icon: Briefcase, label: 'Novedades Profesionales', view: 'professional-news', roles: ['admin', 'support', 'user'] },
      { icon: Calendar, label: 'Vacaciones y Licencias', view: 'vacations', roles: ['admin', 'support', 'user'] },
      { icon: Heart, label: 'Social', view: 'social', roles: ['admin', 'support', 'user'] },
    ]
  },
  { 
    icon: Building2, 
    label: 'Negocio', 
    roles: ['admin', 'support', 'user'],
    subItems: [
      { icon: Factory, label: 'Producción', view: 'fabinsa-production', roles: ['admin', 'support', 'user'] },
      { icon: UsersIcon, label: 'Empleados', view: 'fabinsa-employees', roles: ['admin', 'support', 'user'] },
      { icon: Package, label: 'Stock', view: 'fabinsa-stock', roles: ['admin', 'support', 'user'] },
      { icon: ShoppingCart, label: 'Ventas', view: 'fabinsa-sales', roles: ['admin', 'support', 'user'] },
      { icon: TrendingUp, label: 'Compras', view: 'fabinsa-purchases', roles: ['admin', 'support', 'user'] },
      { icon: DollarSign, label: 'Costos', view: 'fabinsa-costs', roles: ['admin', 'support', 'user'] },
      { icon: BarChart3, label: 'Métricas', view: 'fabinsa-metrics', roles: ['admin', 'support', 'user'] },
      { icon: Truck, label: 'Proveedores', view: 'fabinsa-suppliers', roles: ['admin', 'support', 'user'] },
      { icon: FolderOpen, label: 'Clientes', view: 'forums', roles: ['admin', 'support', 'user'] },
      { icon: Clock, label: 'Carga de Horas', view: 'time-tracking', roles: ['admin', 'support', 'user'] },
      { icon: CheckSquare, label: 'Tareas', view: 'tasks', roles: ['admin', 'support', 'user'] },
      { icon: Wrench, label: 'Herramientas', view: 'tools', roles: ['admin', 'support', 'user'] },
    ]
  },
  { icon: Headphones, label: 'Soporte', view: 'tickets', roles: ['admin', 'support', 'user'] },
  { icon: UsersIcon, label: 'Usuarios', view: 'users', roles: ['admin'] },
  { icon: CreditCard, label: 'Suscripción', view: 'subscription', roles: ['admin'] },
  { icon: Settings, label: 'Configuración', view: 'settings', roles: ['admin', 'support', 'user'] },
];

export function Sidebar({ currentView, onViewChange, onNavigateToTicket, onNavigateToForum, onNavigateToTimeTracking, onNavigateToSocial, onNavigateToProfessionalNews, isCollapsed = false, onToggleCollapse }: SidebarProps) {
  const { profile, signOut } = useAuth();
  const { tenant } = useTenant();
  const { activeJobsCount } = useExtraction();
  const { theme, toggleTheme } = useTheme();
  const { canView } = useDepartmentPermissions();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [logoError, setLogoError] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(new Set());
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved ? JSON.parse(saved) : false;
  });
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', JSON.stringify(sidebarCollapsed));
  }, [sidebarCollapsed]);

  const handleToggleCollapse = () => {
    if (sidebarCollapsed) {
      // Al expandir, cambiar inmediatamente
      const newState = false;
      setSidebarCollapsed(newState);
      setIsTransitioning(false);
      if (onToggleCollapse) {
        onToggleCollapse();
      }
    } else {
      // Al colapsar, esperar un momento para que se carguen los elementos
      setIsTransitioning(true);
      setTimeout(() => {
        const newState = true;
        setSidebarCollapsed(newState);
        setIsTransitioning(false);
        if (onToggleCollapse) {
          onToggleCollapse();
        }
      }, 150); // Esperar 150ms antes de colapsar
    }
  };

  const isSidebarCollapsed = isCollapsed !== undefined ? isCollapsed : sidebarCollapsed;

  useEffect(() => {
    if (profile?.avatar_url) {
      const getAvatarUrl = (avatarPath: string) => {
        if (avatarPath.startsWith('http://') || avatarPath.startsWith('https://')) {
          return avatarPath;
        }
        const { data } = supabase.storage.from('avatars').getPublicUrl(avatarPath);
        return data.publicUrl;
      };
      setAvatarUrl(getAvatarUrl(profile.avatar_url));
    }
  }, [profile?.avatar_url]);

  // Resetear error del logo cuando cambie el tenant o su logo
  useEffect(() => {
    setLogoError(false);
  }, [tenant?.logo_url, tenant?.id]);

  // Detectar si la vista actual está en un submenu y expandir automáticamente
  useEffect(() => {
    if (!profile) return;
    
    setExpandedMenus(prev => {
      const newExpanded = new Set(prev);
      menuItems.forEach((item) => {
        if (item.subItems) {
          const hasActiveSubItem = item.subItems.some(
            subItem => subItem.view === currentView && 
            subItem.roles.includes(profile.role)
          );
          if (hasActiveSubItem) {
            newExpanded.add(item.label);
          }
        }
      });
      return newExpanded;
    });
  }, [currentView, profile]);

  // Obtener módulos visibles del tenant (no del perfil individual)
  const visibleModules = tenant?.visible_modules as Record<string, boolean> | null | undefined;

  // Filtrar items por rol, módulos visibles del tenant y permisos de área
  const filteredItems = menuItems.filter(item => {
    // Verificar rol
    if (!profile || !item.roles.includes(profile.role)) {
      return false;
    }

    // Verificar permisos de área (si el usuario tiene áreas asignadas)
    if (item.view && !canView(item.view)) {
      return false;
    }

    // Verificar si el módulo principal está visible (según configuración del tenant)
    if (item.view) {
      // Si visible_modules existe y el módulo está explícitamente en false, ocultarlo
      // Si visible_modules es null/undefined, mostrar todos (comportamiento por defecto)
      if (visibleModules && visibleModules[item.view] === false) {
        return false;
      }
    }

    // Si tiene subitems, verificar que al menos uno esté visible
    if (item.subItems && item.subItems.length > 0) {
      const hasVisibleSubItem = item.subItems.some(subItem => {
        if (!subItem.roles.includes(profile.role)) return false;
        // Verificar permisos de área
        if (!canView(subItem.view)) return false;
        // Si visible_modules existe y el módulo está explícitamente en false, ocultarlo
        if (visibleModules && visibleModules[subItem.view] === false) {
          return false;
        }
        return true;
      });
      return hasVisibleSubItem;
    }

    return true;
  }).map(item => {
    // Filtrar subitems por módulos visibles del tenant y permisos de área
    if (item.subItems) {
      return {
        ...item,
        subItems: item.subItems.filter(subItem => {
          if (!profile || !subItem.roles.includes(profile.role)) return false;
          // Verificar permisos de área
          if (!canView(subItem.view)) return false;
          // Si visible_modules existe y el módulo está explícitamente en false, ocultarlo
          if (visibleModules && visibleModules[subItem.view] === false) {
            return false;
          }
          return true;
        })
      };
    }
    return item;
  });

  const handleNavigateToCalendar = () => {
    onViewChange('dashboard');
  };

  const toggleMenu = (menuLabel: string) => {
    setExpandedMenus(prev => {
      const newSet = new Set(prev);
      if (newSet.has(menuLabel)) {
        newSet.delete(menuLabel);
      } else {
        newSet.add(menuLabel);
      }
      return newSet;
    });
  };

  const isDark = theme === 'dark';

  const isViewActive = (view: string) => currentView === view;

  const isSubItemActive = (subItems?: SubMenuItem[]) => {
    if (!subItems) return false;
    return subItems.some(subItem => subItem.view === currentView);
  };

  return (
    <>
      <aside className={`transition-all duration-300 ease-in-out ${isSidebarCollapsed ? 'w-16' : 'w-64'} ${isDark ? 'bg-slate-800' : 'bg-white'} ${isDark ? 'border-slate-700' : 'border-gray-200'} border-r flex flex-col h-screen fixed left-0 top-0 z-40`}>
        {/* Overlay para prevenir interacciones durante la transición */}
        {isTransitioning && (
          <div className="absolute inset-0 bg-transparent z-50" />
        )}
        <div className={`${isSidebarCollapsed ? 'px-2' : 'px-4'} py-3 ${isDark ? 'border-slate-700' : 'border-gray-200'} border-b flex-shrink-0`}>
          <div className={`flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-between'} mb-3 gap-2`}>
            {(!isSidebarCollapsed || isTransitioning) && (
              <div className={`flex items-center flex-1 min-w-0 transition-opacity duration-200 ${isSidebarCollapsed && !isTransitioning ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'}`}>
                {tenant?.logo_url && !logoError ? (
                  <img 
                    src={tenant.logo_url} 
                    alt={tenant.name || 'Logo de la empresa'} 
                    className="h-16 w-auto object-contain max-w-[140px]"
                    onError={() => setLogoError(true)}
                  />
                ) : logoError ? (
                  <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {tenant?.name || 'EmaGroup'}
                  </h1>
                ) : (
                  <img 
                    src="/logo ema.png" 
                    alt="EmaGroup" 
                    className="h-16 w-auto object-contain"
                    onError={() => setLogoError(true)}
                  />
                )}
              </div>
            )}
            {isSidebarCollapsed && (
              <button
                onClick={handleToggleCollapse}
                className={`p-1.5 rounded-lg ${isDark ? 'text-white hover:bg-slate-700' : 'text-gray-700 hover:bg-gray-50'}`}
                title="Expandir menú"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}
            {!isSidebarCollapsed && (
              <div className="flex items-center gap-2">
                <NotificationBell 
                  onNavigateToTicket={onNavigateToTicket}
                  onNavigateToCalendar={handleNavigateToCalendar}
                  onNavigateToTasks={() => onViewChange('tasks')}
                  onNavigateToForum={onNavigateToForum}
                  onNavigateToSocial={onNavigateToSocial}
                  onNavigateToTimeTracking={onNavigateToTimeTracking}
                  onNavigateToProfessionalNews={onNavigateToProfessionalNews}
                />
                <button
                  onClick={handleToggleCollapse}
                  className={`p-1.5 rounded-lg ${isDark ? 'text-white hover:bg-slate-700' : 'text-gray-700 hover:bg-gray-50'}`}
                  title="Colapsar menú"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        {profile && (!isSidebarCollapsed || isTransitioning) && (
          <div className={`pt-4 ${isDark ? 'border-slate-700' : 'border-gray-100'} border-t transition-opacity duration-200 ${isSidebarCollapsed && !isTransitioning ? 'opacity-0 h-0 overflow-hidden' : 'opacity-100'}`}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-full overflow-hidden bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-6 h-6 text-white" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'} truncate`}>{profile.full_name || profile.email}</p>
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-gray-500'} truncate`}>{profile.email}</p>
              </div>
            </div>
            <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${
              profile.role === 'admin' 
                ? isDark ? 'bg-purple-600 text-white' : 'bg-purple-100 text-purple-700'
                : profile.role === 'support'
                ? isDark ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-700'
                : isDark ? 'bg-slate-700 text-white' : 'bg-gray-100 text-gray-700'
            }`}>
              {profile.role === 'admin' ? 'Administrador' :
               profile.role === 'support' ? 'Soporte' : 'Usuario'}
            </span>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto min-h-0">
        <ul className={`space-y-1 ${isSidebarCollapsed ? 'p-2' : 'p-4'}`}>
          {filteredItems.map((item) => {
          const Icon = item.icon;
          const hasSubItems = item.subItems && item.subItems.length > 0;
          const isExpanded = expandedMenus.has(item.label);
          const isActive = item.view ? isViewActive(item.view) : false;
          const hasActiveSubItem = isSubItemActive(item.subItems);
          const showBadge = item.view === 'tools' && activeJobsCount > 0;
          const isMenuActive = isActive || hasActiveSubItem;

          // Filtrar subitems por rol, permisos y módulos visibles
          const filteredSubItems = item.subItems?.filter(subItem => {
            if (!profile || !subItem.roles.includes(profile.role)) return false;
            // Verificar permisos de área
            if (!canView(subItem.view)) return false;
            // Si visible_modules existe y el módulo está explícitamente en false, ocultarlo
            if (visibleModules && visibleModules[subItem.view] === false) return false;
            return true;
          }) || [];

          // No renderizar items principales que solo tienen subitems si todos los subitems están desactivados
          // y el sidebar está colapsado (excepto durante la transición)
          if (hasSubItems && filteredSubItems.length === 0 && isSidebarCollapsed && !isTransitioning) {
            return null;
          }

          return (
            <li key={item.label}>
              <button
                onClick={() => {
                  if (hasSubItems && !isSidebarCollapsed) {
                    toggleMenu(item.label);
                  } else if (item.view) {
                    onViewChange(item.view);
                  } else if (hasSubItems && isSidebarCollapsed) {
                    // Si está colapsado y tiene subitems, expandir y mostrar el primero visible
                    toggleMenu(item.label);
                    if (filteredSubItems.length > 0) {
                      onViewChange(filteredSubItems[0].view);
                    }
                  }
                }}
                className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-2' : 'gap-3 px-4'} py-3 rounded-lg transition relative ${
                  isMenuActive
                    ? isDark 
                      ? 'bg-blue-600 text-white font-medium'
                      : 'bg-blue-50 text-blue-700 font-medium'
                    : isDark
                    ? 'text-white hover:bg-slate-700'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
                title={isSidebarCollapsed ? item.label : undefined}
              >
                <Icon className="w-5 h-5" />
                {(!isSidebarCollapsed || isTransitioning) && (
                  <div className={`flex-1 flex items-center gap-2 transition-opacity duration-200 ${isSidebarCollapsed && !isTransitioning ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'}`}>
                    <span className="text-left">{item.label}</span>
                    {hasSubItems && filteredSubItems.length > 0 && (
                      isExpanded ? (
                        <ChevronUp className="w-4 h-4 flex-shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 flex-shrink-0" />
                      )
                    )}
                    {showBadge && (
                      <span className="bg-blue-600 text-white text-xs font-bold rounded-full h-5 min-w-[20px] px-1.5 flex items-center justify-center animate-pulse">
                        {activeJobsCount}
                      </span>
                    )}
                  </div>
                )}
              </button>
              {hasSubItems && isExpanded && filteredSubItems.length > 0 && !isSidebarCollapsed && (
                <ul className="ml-4 mt-1 space-y-1">
                  {filteredSubItems.map((subItem) => {
                    const SubIcon = subItem.icon;
                    const isSubActive = isViewActive(subItem.view);
                    const showSubBadge = subItem.view === 'tools' && activeJobsCount > 0;
                    return (
                      <li key={subItem.view}>
                        <button
                          onClick={() => onViewChange(subItem.view)}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition relative ${
                            isSubActive
                              ? isDark 
                                ? 'bg-blue-600 text-white font-medium'
                                : 'bg-blue-50 text-blue-700 font-medium'
                              : isDark
                              ? 'text-white hover:bg-slate-700'
                              : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <SubIcon className="w-4 h-4" />
                          <span className="flex-1 text-left text-sm">{subItem.label}</span>
                          {showSubBadge && (
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

      <div className={`${isSidebarCollapsed ? 'p-2' : 'p-4'} ${isDark ? 'border-slate-700' : 'border-gray-200'} border-t flex-shrink-0 mt-auto space-y-1`}>
        <button
          onClick={toggleTheme}
          className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-2' : 'gap-3 px-4'} py-3 ${isDark ? 'text-white hover:bg-slate-700' : 'text-gray-700 hover:bg-gray-50'} rounded-lg transition`}
          title={isSidebarCollapsed ? (isDark ? 'Modo Claro' : 'Modo Oscuro') : undefined}
        >
          <Sun className="w-5 h-5" />
          {(!isSidebarCollapsed || isTransitioning) && (
            <span className={`transition-opacity duration-200 ${isSidebarCollapsed && !isTransitioning ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'}`}>
              {isDark ? 'Modo Claro' : 'Modo Oscuro'}
            </span>
          )}
        </button>
        <button
          onClick={signOut}
          className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-2' : 'gap-3 px-4'} py-3 ${isDark ? 'text-white hover:bg-slate-700' : 'text-gray-700 hover:bg-gray-50'} rounded-lg transition`}
          title={isSidebarCollapsed ? 'Cerrar Sesión' : undefined}
        >
          <LogOut className="w-5 h-5" />
          {(!isSidebarCollapsed || isTransitioning) && (
            <span className={`transition-opacity duration-200 ${isSidebarCollapsed && !isTransitioning ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'}`}>
              Cerrar Sesión
            </span>
          )}
        </button>
      </div>
    </aside>
    </>
  );
}












































