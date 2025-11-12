import { useState } from 'react';
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

function MainApp() {
  const { user, profile, loading } = useAuth();
  const [currentView, setCurrentView] = useState('dashboard');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [viewKey, setViewKey] = useState(0); // Key para forzar recarga

  console.log('🟡 MainApp: Estado actual:', { 
    loading, 
    hasUser: !!user, 
    hasProfile: !!profile,
    profileRole: profile?.role 
  });

  if (loading) {
    console.log('🟡 MainApp: Mostrando spinner de carga');
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user || !profile) {
    console.log('🟡 MainApp: No hay usuario o perfil, mostrando LoginForm');
    return <LoginForm />;
  }

  console.log('🟡 MainApp: Usuario autenticado, mostrando app');

  const handleViewChange = (view: string) => {
    setCurrentView(view);
    setViewKey(prev => prev + 1); // Incrementar key para forzar recarga
  };

  const handleNavigateToTicket = (ticketId: string) => {
    setSelectedTicketId(ticketId);
    setCurrentView('tickets');
    setViewKey(prev => prev + 1);
  };

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':
        // Todos los roles usan el mismo dashboard personalizado
        return <UserDashboard key={`dashboard-${viewKey}`} onNavigate={handleViewChange} />;
      case 'tickets':
        return <TicketsList key={`tickets-${viewKey}`} selectedTicketId={selectedTicketId} onClearSelection={() => setSelectedTicketId(null)} />;
      case 'forums':
        return <ForumsList key={`forums-${viewKey}`} />;
      case 'meetings':
        return <MeetingRoomsList key={`meetings-${viewKey}`} />;
      case 'tools':
        return <ToolsPanel key={`tools-${viewKey}`} />;
      case 'users':
        return profile.role === 'admin' ? <UserManagement key={`users-${viewKey}`} /> : <div>No autorizado</div>;
      case 'departments':
        return <DepartmentManagement key={`departments-${viewKey}`} />;
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
      />
      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto p-8">
          {renderContent()}
        </div>
      </main>
      <ExtractionNotifications />
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
