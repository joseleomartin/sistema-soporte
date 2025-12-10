import { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ExtractionProvider } from './contexts/ExtractionContext';
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
import { SocialFeed } from './components/Social/SocialFeed';
import { MessagesBell } from './components/DirectMessages/MessagesBell';
import { GoogleOAuthCallback } from './pages/GoogleOAuthCallback';
import { EmailConfirmation } from './pages/EmailConfirmation';

function MainApp() {
  const { user, profile, loading } = useAuth();
  const [currentView, setCurrentView] = useState('dashboard');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [selectedSubforumId, setSelectedSubforumId] = useState<string | null>(null);
  const [viewKey, setViewKey] = useState(0); // Key para forzar recarga

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
    switch (currentView) {
      case 'dashboard':
        // Todos los roles usan el mismo dashboard personalizado
        return <UserDashboard key={`dashboard-${viewKey}`} onNavigate={handleViewChange} />;
      case 'tickets':
        return <TicketsList key={`tickets-${viewKey}`} selectedTicketId={selectedTicketId} onClearSelection={() => setSelectedTicketId(null)} />;
      case 'forums':
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
      case 'social':
        return <SocialFeed key={`social-${viewKey}`} />;
      case 'settings':
        return <ProfileSettings key={`settings-${viewKey}`} />;
      default:
        return <UserDashboard key={`dashboard-${viewKey}`} onNavigate={handleViewChange} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar
        currentView={currentView}
        onViewChange={handleViewChange}
        onNavigateToTicket={handleNavigateToTicket}
        onNavigateToForum={handleNavigateToForum}
      />
      <main className="flex-1 overflow-auto ml-64">
        <div className={`${currentView === 'social' ? 'max-w-full' : 'max-w-7xl'} mx-auto p-8`}>
          {renderContent()}
        </div>
      </main>
      <ExtractionNotifications />
      <MessagesBell />
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <ExtractionProvider>
        <MainApp />
      </ExtractionProvider>
    </AuthProvider>
  );
}

export default App;
