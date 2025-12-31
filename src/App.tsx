import { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { TenantProvider } from './contexts/TenantContext';
import { ExtractionProvider } from './contexts/ExtractionContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { LoginForm } from './components/Auth/LoginForm';
import { Sidebar } from './components/Layout/Sidebar';
import { UserDashboard } from './components/Dashboard/UserDashboard';
import { TicketsList } from './components/Tickets/TicketsList';
import { ForumsList } from './components/Forums/ForumsList';
import { MeetingRoomsList } from './components/Meetings/MeetingRoomsList';
import { UserManagement } from './components/Users/UserManagement';
import { ToolsPanel } from './components/Tools/ToolsPanel';
import { ExtractionNotifications } from './components/Notifications/ExtractionNotifications';
import { DepartmentManagement } from './components/Departments/DepartmentManagement';
import { ProfileSettings } from './components/Profile/ProfileSettings';
import { TasksList } from './components/Tasks/TasksList';
import { VacationsManagement } from './components/Vacations/VacationsManagement';
import { TimeTracking } from './components/TimeTracking/TimeTracking';
import { LibraryAndCourses } from './components/Library/LibraryAndCourses';
import { InternalPolicies } from './components/InternalPolicies/InternalPolicies';
import { SocialFeed } from './components/Social/SocialFeed';
import { ProfessionalNews } from './components/ProfessionalNews/ProfessionalNews';
import { MessagesBell } from './components/DirectMessages/MessagesBell';
import { ProductionModule } from './components/Fabinsa/Production/ProductionModule';
import { EmployeesModule } from './components/Fabinsa/Employees/EmployeesModule';
import { StockModule } from './components/Fabinsa/Stock/StockModule';
import { SalesModule } from './components/Fabinsa/Sales/SalesModule';
import { PurchasesModule } from './components/Fabinsa/Purchases/PurchasesModule';
import { MetricsModule } from './components/Fabinsa/Metrics/MetricsModule';
import { CostsModule } from './components/Fabinsa/Costs/CostsModule';
import { SuppliersModule } from './components/Fabinsa/Suppliers/SuppliersModule';
import { ClientsModule } from './components/Fabinsa/Clients/ClientsModule';
import { SubscriptionManagement } from './components/Subscription/SubscriptionManagement';
import { useTenant } from './contexts/TenantContext';
import { GoogleOAuthCallback } from './pages/GoogleOAuthCallback';
import { EmailConfirmation } from './pages/EmailConfirmation';

function MainApp() {
  const { user, profile, loading } = useAuth();
  const { tenant } = useTenant();
  const [currentView, setCurrentView] = useState('dashboard');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [selectedSubforumId, setSelectedSubforumId] = useState<string | null>(null);
  const [viewKey, setViewKey] = useState(0); // Key para forzar recarga
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved ? JSON.parse(saved) : false;
  });

  // Definir handlers antes de los hooks usando useCallback para evitar recreaciones
  const handleViewChange = useCallback((view: string) => {
    setCurrentView(view);
    setViewKey(prev => prev + 1); // Incrementar key para forzar recarga
  }, []);

  const handleNavigateToTicket = useCallback((ticketId: string) => {
    setSelectedTicketId(ticketId);
    setCurrentView('tickets');
    setViewKey(prev => prev + 1);
  }, []);

  const handleNavigateToForum = useCallback((subforumId: string) => {
    setSelectedSubforumId(subforumId);
    setCurrentView('forums');
    setViewKey(prev => prev + 1);
  }, []);

  const handleNavigateToTimeTracking = useCallback(() => {
    setCurrentView('time-tracking');
    setViewKey(prev => prev + 1);
  }, []);

  const handleNavigateToSocial = useCallback(() => {
    setCurrentView('social');
    setViewKey(prev => prev + 1);
  }, []);

  const handleNavigateToProfessionalNews = useCallback(() => {
    setCurrentView('professional-news');
    setViewKey(prev => prev + 1);
  }, []);

  // Verificar si estamos en el callback de OAuth
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    
    if (code && state && window.location.pathname.includes('google-oauth-callback')) {
      // Estamos en el callback, no hacer nada más aquí
      // El componente GoogleOAuthCallback se encargará
      return;
    }
  }, []);

  // Escuchar eventos de navegación desde actividades del dashboard
  useEffect(() => {
    const handleNavigateToTicketEvent = (event: CustomEvent) => {
      const { ticketId } = event.detail;
      if (ticketId) {
        handleNavigateToTicket(ticketId);
      }
    };

    window.addEventListener('navigateToTicket', handleNavigateToTicketEvent as EventListener);

    return () => {
      window.removeEventListener('navigateToTicket', handleNavigateToTicketEvent as EventListener);
    };
  }, [handleNavigateToTicket]);

  // Detectar si se debe navegar a un ticket específico desde el email
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const ticketId = urlParams.get('ticketId');
    
    if (ticketId && user && profile) {
      // Navegar al ticket específico
      handleNavigateToTicket(ticketId);
      
      // Limpiar el parámetro de la URL sin recargar la página
      const newUrl = window.location.pathname + (window.location.hash || '');
      window.history.replaceState({}, '', newUrl);
    }
  }, [user, profile, handleNavigateToTicket]);

  // Si estamos en la ruta de callback, mostrar el componente de callback
  if (window.location.pathname.includes('google-oauth-callback')) {
    return <GoogleOAuthCallback />;
  }

  // Si estamos en la ruta de confirmación de email, mostrar el componente de confirmación
  // Supabase puede redirigir con hash fragments (#access_token=...) o con query params
  const isEmailConfirmation = 
    window.location.pathname.includes('confirm-email') || 
    window.location.hash.includes('access_token') || 
    window.location.hash.includes('type=signup') ||
    window.location.hash.includes('type=recovery') ||
    (window.location.search.includes('token') && window.location.search.includes('type=signup'));
  
  if (isEmailConfirmation) {
    return <EmailConfirmation />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user || !profile) {
    return <LoginForm />;
  }

  const renderContent = () => {
    // Verificar si es empresa de producción (reutilizable)
    const isProductionCompany = tenant?.loadout_type === 'produccion' || 
      (tenant?.visible_modules && 
       tenant.visible_modules['fabinsa-production'] === true &&
       tenant.visible_modules['fabinsa-stock'] === true);

    switch (currentView) {
      case 'dashboard':
        // Si es empresa de producción, mostrar Métricas en lugar del dashboard normal
        if (isProductionCompany) {
          return <MetricsModule key={`dashboard-metrics-${viewKey}`} />;
        }
        // Todos los roles usan el mismo dashboard personalizado
        return <UserDashboard key={`dashboard-${viewKey}`} onNavigate={handleViewChange} />;
      case 'tickets':
        return <TicketsList key={`tickets-${viewKey}`} selectedTicketId={selectedTicketId} onClearSelection={() => setSelectedTicketId(null)} />;
      case 'forums':
        // Si es empresa de producción, mostrar ClientsModule en lugar de ForumsList
        if (isProductionCompany) {
          return <ClientsModule key={`clients-${viewKey}`} />;
        }
        return <ForumsList key={`forums-${viewKey}`} initialSubforumId={selectedSubforumId} onSubforumChange={setSelectedSubforumId} />;
      case 'meetings':
        return <MeetingRoomsList key={`meetings-${viewKey}`} />;
      case 'tools':
        return <ToolsPanel key={`tools-${viewKey}`} />;
      case 'tasks':
        return <TasksList key={`tasks-${viewKey}`} />;
      case 'users':
        return profile.role === 'admin' ? <UserManagement key={`users-${viewKey}`} /> : <div>No autorizado</div>;
      case 'departments':
        return <DepartmentManagement key={`departments-${viewKey}`} />;
      case 'vacations':
        return <VacationsManagement key={`vacations-${viewKey}`} />;
      case 'time-tracking':
        return <TimeTracking key={`time-tracking-${viewKey}`} />;
      case 'library':
        return <LibraryAndCourses key={`library-${viewKey}`} />;
      case 'internal-policies':
        return <InternalPolicies key={`internal-policies-${viewKey}`} />;
      case 'social':
        return <SocialFeed key={`social-${viewKey}`} />;
      case 'professional-news':
        return <ProfessionalNews key={`professional-news-${viewKey}`} />;
      case 'fabinsa-production':
        return <ProductionModule key={`fabinsa-production-${viewKey}`} />;
      case 'fabinsa-employees':
        return <EmployeesModule key={`fabinsa-employees-${viewKey}`} />;
      case 'fabinsa-stock':
        return <StockModule key={`fabinsa-stock-${viewKey}`} />;
      case 'fabinsa-sales':
        return <SalesModule key={`fabinsa-sales-${viewKey}`} />;
      case 'fabinsa-purchases':
        return <PurchasesModule key={`fabinsa-purchases-${viewKey}`} />;
      case 'fabinsa-metrics':
        return <MetricsModule key={`fabinsa-metrics-${viewKey}`} />;
      case 'fabinsa-costs':
        return <CostsModule key={`fabinsa-costs-${viewKey}`} />;
      case 'fabinsa-suppliers':
        return <SuppliersModule key={`fabinsa-suppliers-${viewKey}`} />;
      case 'settings':
        return <ProfileSettings key={`settings-${viewKey}`} />;
      case 'subscription':
        return profile.role === 'admin' ? <SubscriptionManagement key={`subscription-${viewKey}`} /> : <div>No autorizado</div>;
      default:
        return <UserDashboard key={`dashboard-${viewKey}`} onNavigate={handleViewChange} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex">
      <Sidebar
        currentView={currentView}
        onViewChange={handleViewChange}
        onNavigateToTicket={handleNavigateToTicket}
        onNavigateToForum={handleNavigateToForum}
        onNavigateToTimeTracking={handleNavigateToTimeTracking}
        onNavigateToSocial={handleNavigateToSocial}
        onNavigateToProfessionalNews={handleNavigateToProfessionalNews}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <main className={`flex-1 overflow-auto bg-gray-50 dark:bg-slate-900 transition-all duration-300 ${!sidebarCollapsed ? 'lg:ml-64' : ''}`}>
        <div className={`${currentView === 'social' || currentView === 'fabinsa-costs' || currentView === 'forums' || currentView === 'fabinsa-suppliers' ? 'max-w-full' : 'max-w-7xl'} mx-auto p-2 sm:p-4 md:p-6 lg:p-8`}>
          {renderContent()}
        </div>
      </main>
      <ExtractionNotifications />
      {/* Mostrar MessagesBell solo si el módulo está activado */}
      {(!tenant?.visible_modules || tenant.visible_modules['direct-messages'] !== false) && (
        <MessagesBell />
      )}
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <TenantProvider>
          <ExtractionProvider>
            <MainApp />
          </ExtractionProvider>
        </TenantProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
