import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Users, Ticket, MessageSquare, TrendingUp } from 'lucide-react';

interface Stats {
  totalUsers: number;
  totalTickets: number;
  openTickets: number;
  totalForums: number;
}

export function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    totalTickets: 0,
    openTickets: 0,
    totalForums: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [usersResult, ticketsResult, openTicketsResult, forumsResult] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('tickets').select('id', { count: 'exact', head: true }),
        supabase.from('tickets').select('id', { count: 'exact', head: true }).eq('status', 'open'),
        supabase.from('subforums').select('id', { count: 'exact', head: true }),
      ]);

      setStats({
        totalUsers: usersResult.count || 0,
        totalTickets: ticketsResult.count || 0,
        openTickets: openTicketsResult.count || 0,
        totalForums: forumsResult.count || 0,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
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
    { icon: Users, label: 'Total Usuarios', value: stats.totalUsers, color: 'blue' },
    { icon: Ticket, label: 'Total Tickets', value: stats.totalTickets, color: 'green' },
    { icon: TrendingUp, label: 'Tickets Abiertos', value: stats.openTickets, color: 'orange' },
    { icon: MessageSquare, label: 'Foros', value: stats.totalForums, color: 'purple' },
  ];

  return (
    <div>
      <h2 className="text-3xl font-bold text-gray-900 mb-8">Panel de Administración</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-2">{stat.value}</p>
                </div>
                <Icon className="w-6 h-6 text-gray-400" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}