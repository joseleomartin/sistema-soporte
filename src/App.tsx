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

  const handleNavigateToTicket = (ticketId: string) => {
    setSelectedTicketId(ticketId);
    setCurrentView('tickets');
  };

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':
        // Todos los roles usan el mismo dashboard personalizado
        return <UserDashboard />;
      case 'tickets':
        return <TicketsList selectedTicketId={selectedTicketId} onClearSelection={() => setSelectedTicketId(null)} />;
      case 'forums':
        return <ForumsList />;
      case 'meetings':
        return <MeetingRoomsList />;
      case 'tools':
        return <ToolsPanel />;
      case 'users':
        return profile.role === 'admin' ? <UserManagement /> : <div>No autorizado</div>;
      case 'departments':
        return <DepartmentManagement />;
      case 'settings':
        return <ProfileSettings />;
      default:
        return <UserDashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar
        currentView={currentView}
        onViewChange={setCurrentView}
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
