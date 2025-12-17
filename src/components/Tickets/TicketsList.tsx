import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Plus, Filter, Search, Clock, CheckCircle, XCircle, Loader } from 'lucide-react';
import { CreateTicketModal } from './CreateTicketModal';
import { TicketDetail } from './TicketDetail';

interface Ticket {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  category: string;
  created_at: string;
  created_by: string;
  assigned_to: string | null;
  profiles: {
    full_name: string;
    email: string;
  };
}

interface TicketsListProps {
  selectedTicketId?: string | null;
  onClearSelection?: () => void;
}

export function TicketsList({ selectedTicketId, onClearSelection }: TicketsListProps) {
  const { profile } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<string | null>(selectedTicketId || null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  useEffect(() => {
    if (selectedTicketId) {
      setSelectedTicket(selectedTicketId);
    }
  }, [selectedTicketId]);

  useEffect(() => {
    loadTickets();
  }, [profile?.id, profile?.role]);

  const loadTickets = async () => {
    if (!profile?.id) return;

    try {
      let query = supabase
        .from('tickets')
        .select(`
          id,
          title,
          description,
          status,
          priority,
          category,
          created_at,
          created_by,
          assigned_to,
          profiles:created_by(full_name, email)
        `)
        .order('created_at', { ascending: false });

      if (profile.role === 'user') {
        query = query.eq('created_by', profile.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      setTickets(data || []);
    } catch (error) {
      console.error('Error loading tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTickets = tickets.filter((ticket) => {
    const matchesSearch =
      ticket.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.category.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || ticket.priority === priorityFilter;

    return matchesSearch && matchesStatus && matchesPriority;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-orange-100 dark:bg-orange-900/20 text-orange-800 dark:text-orange-300 border-orange-200 dark:border-orange-700/50';
      case 'in_progress':
        return 'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-700/50';
      case 'resolved':
        return 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300 border-green-200 dark:border-green-700/50';
      case 'closed':
        return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 border-gray-200 dark:border-slate-600';
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 border-gray-200 dark:border-slate-600';
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
        return 'text-gray-600 dark:text-gray-300';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open':
        return Clock;
      case 'in_progress':
        return Loader;
      case 'resolved':
        return CheckCircle;
      case 'closed':
        return XCircle;
      default:
        return Clock;
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
      case 'closed':
        return 'Cerrado';
      default:
        return status;
    }
  };

  const stats = {
    total: tickets.length,
    open: tickets.filter((t) => t.status === 'open').length,
    inProgress: tickets.filter((t) => t.status === 'in_progress').length,
    resolved: tickets.filter((t) => t.status === 'resolved').length,
  };

  if (selectedTicket) {
    return (
      <TicketDetail
        ticketId={selectedTicket}
        onClose={() => {
          setSelectedTicket(null);
          if (onClearSelection) onClearSelection();
          loadTickets();
        }}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Tickets de Soporte</h2>
          <p className="text-gray-600 dark:text-gray-300 mt-1">
            {profile?.role === 'user' ? 'Gestiona tus tickets de soporte' : 'Gestiona todos los tickets del sistema'}
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition font-medium"
        >
          <Plus className="w-5 h-5" />
          Crear Ticket
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4">
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">Total</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-orange-200 dark:border-orange-700/50 p-4">
          <p className="text-sm text-orange-600 dark:text-orange-400 mb-1">Abiertos</p>
          <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{stats.open}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-blue-200 dark:border-blue-700/50 p-4">
          <p className="text-sm text-blue-600 dark:text-blue-400 mb-1">En Progreso</p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.inProgress}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-green-200 dark:border-green-700/50 p-4">
          <p className="text-sm text-green-600 dark:text-green-400 mb-1">Resueltos</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.resolved}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 mb-6">
        <div className="p-6 border-b border-gray-200 dark:border-slate-700">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar tickets..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex gap-3">
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                >
                  <option value="all">Todos los estados</option>
                  <option value="open">Abiertos</option>
                  <option value="in_progress">En Progreso</option>
                  <option value="resolved">Resueltos</option>
                  <option value="closed">Cerrados</option>
                </select>
              </div>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
              >
                <option value="all">Todas las prioridades</option>
                <option value="high">Alta</option>
                <option value="medium">Media</option>
                <option value="low">Baja</option>
              </select>
            </div>
          </div>
        </div>

        <div className="divide-y divide-gray-200 dark:divide-slate-700">
          {filteredTickets.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-gray-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-gray-400 dark:text-gray-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No se encontraron tickets</h3>
              <p className="text-gray-600 dark:text-gray-300">
                {searchTerm || statusFilter !== 'all' || priorityFilter !== 'all'
                  ? 'Intenta ajustar los filtros de búsqueda'
                  : profile?.role === 'user'
                  ? 'Crea tu primer ticket para comenzar'
                  : 'No hay tickets en el sistema'}
              </p>
            </div>
          ) : (
            filteredTickets.map((ticket) => {
              const StatusIcon = getStatusIcon(ticket.status);
              return (
                <div
                  key={ticket.id}
                  onClick={() => setSelectedTicket(ticket.id)}
                  className="p-6 hover:bg-gray-50 dark:hover:bg-slate-700 cursor-pointer transition border-b border-gray-200 dark:border-slate-700"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-gray-900 dark:text-white truncate">{ticket.title}</h3>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${getStatusColor(ticket.status)}`}>
                          <StatusIcon className="w-3.5 h-3.5" />
                          {getStatusLabel(ticket.status)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-300 mb-3 line-clamp-2">{ticket.description}</p>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-gray-500 dark:text-gray-400">
                          <span className="font-medium">Categoría:</span> {ticket.category}
                        </span>
                        <span className={`font-medium ${getPriorityColor(ticket.priority)}`}>
                          Prioridad: {ticket.priority === 'high' ? 'Alta' : ticket.priority === 'medium' ? 'Media' : 'Baja'}
                        </span>
                        <span className="text-gray-500 dark:text-gray-400">{new Date(ticket.created_at).toLocaleDateString('es-ES')}</span>
                        {profile?.role !== 'user' && (
                          <span className="text-gray-500 dark:text-gray-400">
                            <span className="font-medium">Usuario:</span> {ticket.profiles.full_name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {showCreateModal && (
        <CreateTicketModal
          onClose={() => {
            setShowCreateModal(false);
            loadTickets();
          }}
        />
      )}
    </div>
  );
}
