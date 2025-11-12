import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Ticket, Clock, CheckCircle, AlertCircle, TrendingUp, User } from 'lucide-react';

interface Stats {
  totalTickets: number;
  openTickets: number;
  inProgressTickets: number;
  resolvedTickets: number;
  myAssignedTickets: number;
  unassignedTickets: number;
}

interface RecentTicket {
  id: string;
  title: string;
  status: string;
  priority: string;
  created_at: string;
  profiles: {
    full_name: string;
  };
}

export function SupportDashboard() {
  const [stats, setStats] = useState<Stats>({
    totalTickets: 0,
    openTickets: 0,
    inProgressTickets: 0,
    resolvedTickets: 0,
    myAssignedTickets: 0,
    unassignedTickets: 0,
  });
  const [recentTickets, setRecentTickets] = useState<RecentTicket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [
        totalResult,
        openResult,
        inProgressResult,
        resolvedResult,
        myAssignedResult,
        unassignedResult,
        recentResult,
      ] = await Promise.all([
        supabase.from('tickets').select('id', { count: 'exact', head: true }),
        supabase.from('tickets').select('id', { count: 'exact', head: true }).eq('status', 'open'),
        supabase.from('tickets').select('id', { count: 'exact', head: true }).eq('status', 'in_progress'),
        supabase.from('tickets').select('id', { count: 'exact', head: true }).eq('status', 'resolved'),
        supabase.from('tickets').select('id', { count: 'exact', head: true }).eq('assigned_to', user.id),
        supabase.from('tickets').select('id', { count: 'exact', head: true }).is('assigned_to', null),
        supabase
          .from('tickets')
          .select(`
            id,
            title,
            status,
            priority,
            created_at,
            profiles:created_by(full_name)
          `)
          .in('status', ['open', 'in_progress'])
          .order('created_at', { ascending: false })
          .limit(10),
      ]);

      setStats({
        totalTickets: totalResult.count || 0,
        openTickets: openResult.count || 0,
        inProgressTickets: inProgressResult.count || 0,
        resolvedTickets: resolvedResult.count || 0,
        myAssignedTickets: myAssignedResult.count || 0,
        unassignedTickets: unassignedResult.count || 0,
      });

      setRecentTickets(recentResult.data || []);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-orange-100 text-orange-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'resolved':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'text-red-600';
      case 'medium':
        return 'text-orange-600';
      case 'low':
        return 'text-green-600';
      default:
        return 'text-gray-600';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'open':
        return 'Abierto';
      case 'in_progress':
        return 'En Progreso';
      case 'resolved':
        return 'Resuelto';
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const statCards = [
    {
      icon: Ticket,
      label: 'Total Tickets',
      value: stats.totalTickets,
      color: 'bg-blue-50 text-blue-600',
      description: 'Todos los tickets del sistema',
    },
    {
      icon: Clock,
      label: 'Tickets Abiertos',
      value: stats.openTickets,
      color: 'bg-orange-50 text-orange-600',
      description: 'Esperando asignación',
    },
    {
      icon: TrendingUp,
      label: 'En Progreso',
      value: stats.inProgressTickets,
      color: 'bg-blue-50 text-blue-600',
      description: 'Siendo atendidos',
    },
    {
      icon: CheckCircle,
      label: 'Resueltos',
      value: stats.resolvedTickets,
      color: 'bg-green-50 text-green-600',
      description: 'Completados exitosamente',
    },
    {
      icon: User,
      label: 'Mis Tickets Asignados',
      value: stats.myAssignedTickets,
      color: 'bg-purple-50 text-purple-600',
      description: 'Asignados a ti',
    },
    {
      icon: AlertCircle,
      label: 'Sin Asignar',
      value: stats.unassignedTickets,
      color: 'bg-red-50 text-red-600',
      description: 'Necesitan atención',
    },
  ];

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900">Panel de Soporte</h2>
        <p className="text-gray-600 mt-1">Vista general de todos los tickets del sistema</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-3">
                <div className={`p-3 rounded-lg ${stat.color}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
              </div>
              <p className="text-sm font-medium text-gray-900 mb-1">{stat.label}</p>
              <p className="text-xs text-gray-600">{stat.description}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Tickets Recientes</h3>
            <a href="#" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
              Ver todos
            </a>
          </div>
          {recentTickets.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">No hay tickets activos</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentTickets.map((ticket) => (
                <div key={ticket.id} className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium text-gray-900 flex-1 pr-2">{ticket.title}</h4>
                    <span className={`text-xs font-medium px-2 py-1 rounded whitespace-nowrap ${getStatusColor(ticket.status)}`}>
                      {getStatusLabel(ticket.status)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-gray-600">{ticket.profiles.full_name}</span>
                    <span className="text-gray-400">•</span>
                    <span className={`font-medium ${getPriorityColor(ticket.priority)}`}>
                      {ticket.priority === 'high' ? 'Alta' : ticket.priority === 'medium' ? 'Media' : 'Baja'}
                    </span>
                    <span className="text-gray-400">•</span>
                    <span className="text-gray-600">{new Date(ticket.created_at).toLocaleDateString('es-ES')}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Acciones Rápidas</h3>
          <div className="space-y-3">
            <a
              href="#"
              className="flex items-center gap-3 p-4 bg-orange-50 rounded-lg hover:bg-orange-100 transition"
            >
              <Clock className="w-5 h-5 text-orange-600" />
              <div>
                <p className="font-medium text-gray-900">Tickets Sin Asignar</p>
                <p className="text-sm text-gray-600">{stats.unassignedTickets} tickets esperando atención</p>
              </div>
            </a>
            <a
              href="#"
              className="flex items-center gap-3 p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition"
            >
              <User className="w-5 h-5 text-purple-600" />
              <div>
                <p className="font-medium text-gray-900">Mis Tickets Asignados</p>
                <p className="text-sm text-gray-600">{stats.myAssignedTickets} tickets bajo tu responsabilidad</p>
              </div>
            </a>
            <a
              href="#"
              className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition"
            >
              <TrendingUp className="w-5 h-5 text-blue-600" />
              <div>
                <p className="font-medium text-gray-900">Tickets En Progreso</p>
                <p className="text-sm text-gray-600">{stats.inProgressTickets} tickets siendo atendidos</p>
              </div>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
