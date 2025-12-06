import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Calculator, 
  Calendar, 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  FolderOpen,
  Building2,
  Save,
  Edit2,
  AlertCircle
} from 'lucide-react';

interface Department {
  id: string;
  name: string;
  hourly_cost: number | null;
}

interface ClientCostData {
  client_id: string;
  client_name: string;
  total_hours: number;
  entries_count: number;
  cost_by_area: { [areaId: string]: { hours: number; cost: number; areaName: string } };
  total_cost: number;
  price_to_charge: number;
  net_margin: number;
}

export function CostCalculation() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(1); // Primer día del mes actual
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [departments, setDepartments] = useState<Department[]>([]);
  const [clientCosts, setClientCosts] = useState<ClientCostData[]>([]);
  const [editingCosts, setEditingCosts] = useState<{ [clientId: string]: boolean }>({});
  const [priceInputs, setPriceInputs] = useState<{ [clientId: string]: string }>({});
  const [savingCost, setSavingCost] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.role === 'admin') {
      loadDepartments();
      calculateCosts();
    }
  }, [profile?.id, startDate, endDate]);

  useEffect(() => {
    if (departments.length > 0) {
      calculateCosts();
    }
  }, [departments, startDate, endDate]);

  const loadDepartments = async () => {
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('id, name, hourly_cost')
        .order('name');

      if (error) throw error;
      setDepartments(data || []);
    } catch (error) {
      console.error('Error loading departments:', error);
    }
  };

  const updateDepartmentCost = async (departmentId: string, cost: number) => {
    try {
      const { error } = await supabase
        .from('departments')
        .update({ hourly_cost: cost })
        .eq('id', departmentId);

      if (error) throw error;
      
      // Actualizar en el estado local
      setDepartments(prev => 
        prev.map(dept => 
          dept.id === departmentId ? { ...dept, hourly_cost: cost } : dept
        )
      );
    } catch (error) {
      console.error('Error updating department cost:', error);
      alert('Error al actualizar el costo del área');
    }
  };

  const calculateCosts = async () => {
    if (!startDate || !endDate) return;

    setLoading(true);
    try {
      // Obtener todas las entradas de tiempo en el rango de fechas
      const { data: timeEntries, error: entriesError } = await supabase
        .from('time_entries')
        .select(`
          client_id,
          hours_worked,
          department_id,
          client:subforums!time_entries_client_id_fkey(id, name)
        `)
        .gte('entry_date', startDate)
        .lte('entry_date', endDate);

      if (entriesError) throw entriesError;

      // Agrupar por cliente y calcular costos por área
      const clientMap = new Map<string, ClientCostData>();

      timeEntries?.forEach((entry: any) => {
        const clientId = entry.client_id;
        const hours = parseFloat(entry.hours_worked.toString());
        const departmentId = entry.department_id;
        const clientName = entry.client?.name || 'Cliente desconocido';

        if (!clientMap.has(clientId)) {
          clientMap.set(clientId, {
            client_id: clientId,
            client_name: clientName,
            total_hours: 0,
            entries_count: 0,
            cost_by_area: {},
            total_cost: 0,
            price_to_charge: 0,
            net_margin: 0
          });
        }

        const clientData = clientMap.get(clientId)!;
        clientData.total_hours += hours;
        clientData.entries_count += 1;

        // Si tiene departamento, calcular costo por área
        if (departmentId) {
          const department = departments.find(d => d.id === departmentId);
          if (department && department.hourly_cost) {
            if (!clientData.cost_by_area[departmentId]) {
              clientData.cost_by_area[departmentId] = {
                hours: 0,
                cost: 0,
                areaName: department.name
              };
            }
            clientData.cost_by_area[departmentId].hours += hours;
            clientData.cost_by_area[departmentId].cost += hours * department.hourly_cost;
          }
        }
      });

      // Calcular costo total por cliente
      const clientsWithCosts: ClientCostData[] = Array.from(clientMap.values()).map(client => {
        let totalCost = 0;
        Object.values(client.cost_by_area).forEach(areaData => {
          totalCost += areaData.cost;
        });

        // Obtener precio a cobrar guardado (si existe)
        const savedPrice = priceInputs[client.client_id] 
          ? parseFloat(priceInputs[client.client_id]) 
          : client.price_to_charge;

        const netMargin = savedPrice - totalCost;

        return {
          ...client,
          total_cost: totalCost,
          price_to_charge: savedPrice,
          net_margin: netMargin
        };
      });

      setClientCosts(clientsWithCosts.sort((a, b) => b.total_hours - a.total_hours));
    } catch (error) {
      console.error('Error calculating costs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePriceChange = (clientId: string, value: string) => {
    setPriceInputs(prev => ({
      ...prev,
      [clientId]: value
    }));

    // Recalcular margen neto inmediatamente
    setClientCosts(prev => prev.map(client => {
      if (client.client_id === clientId) {
        const price = parseFloat(value) || 0;
        const netMargin = price - client.total_cost;
        return {
          ...client,
          price_to_charge: price,
          net_margin: netMargin
        };
      }
      return client;
    }));
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const formatHoursMinutes = (decimalHours: number): string => {
    const hours = Math.floor(decimalHours);
    const minutes = Math.round((decimalHours - hours) * 60);
    if (hours === 0) {
      return `${minutes} min`;
    }
    if (minutes === 0) {
      return `${hours} ${hours === 1 ? 'hora' : 'horas'}`;
    }
    return `${hours} ${hours === 1 ? 'hora' : 'horas'} ${minutes} min`;
  };

  if (profile?.role !== 'admin') {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
        <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600">Solo los administradores pueden acceder a esta herramienta.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Calculator className="w-8 h-8 text-blue-600" />
          Cálculo de Costos
        </h2>
        <p className="text-gray-600 mt-2">
          Calcula el margen neto por cliente basado en costos de áreas y horas trabajadas
        </p>
      </div>

      {/* Filtros */}
      <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Rango de fechas */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rango de Fechas
            </label>
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <span className="text-gray-500">a</span>
              <div className="flex-1 relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Botón calcular */}
          <div className="flex items-end">
            <button
              onClick={calculateCosts}
              disabled={loading}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Calculando...
                </>
              ) : (
                <>
                  <Calculator className="w-5 h-5" />
                  Calcular
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Configuración de costos por área */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-600" />
            Costos por Área (Carga Manual)
          </h3>
        </div>
        <div className="space-y-3">
          {departments.map((dept) => (
            <div key={dept.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <p className="font-medium text-gray-900">{dept.name}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={dept.hourly_cost || 0}
                  onChange={(e) => {
                    const newCost = parseFloat(e.target.value) || 0;
                    updateDepartmentCost(dept.id, newCost);
                  }}
                  className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0.00"
                />
                <span className="text-sm text-gray-600">/hora</span>
              </div>
            </div>
          ))}
          {departments.length === 0 && (
            <p className="text-gray-500 text-center py-4">No hay áreas configuradas</p>
          )}
        </div>
      </div>

      {/* Resultados por cliente */}
      {clientCosts.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-blue-600" />
              Costos por Cliente
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cliente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Horas
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Costo Total
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Precio a Cobrar
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Margen Neto
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {clientCosts.map((client) => (
                  <tr key={client.client_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{client.client_name}</div>
                      <div className="text-sm text-gray-500">
                        {client.entries_count} {client.entries_count === 1 ? 'entrada' : 'entradas'}
                      </div>
                      {/* Desglose por área */}
                      {Object.keys(client.cost_by_area).length > 0 && (
                        <div className="mt-2 space-y-1">
                          {Object.values(client.cost_by_area).map((areaData, idx) => (
                            <div key={idx} className="text-xs text-gray-400">
                              {areaData.areaName}: {formatHoursMinutes(areaData.hours)} = {formatCurrency(areaData.cost)}
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {formatHoursMinutes(client.total_hours)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-gray-900">
                        {formatCurrency(client.total_cost)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={priceInputs[client.client_id] || client.price_to_charge || ''}
                          onChange={(e) => handlePriceChange(client.client_id, e.target.value)}
                          className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="0.00"
                        />
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm font-semibold flex items-center gap-1 ${
                        client.net_margin >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {client.net_margin >= 0 ? (
                          <TrendingUp className="w-4 h-4" />
                        ) : (
                          <TrendingDown className="w-4 h-4" />
                        )}
                        {formatCurrency(client.net_margin)}
                      </div>
                      {client.total_cost > 0 && (
                        <div className="text-xs text-gray-500 mt-1">
                          {((client.net_margin / client.total_cost) * 100).toFixed(1)}% margen
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              {/* Totales */}
              <tfoot className="bg-gray-50">
                <tr>
                  <td className="px-6 py-4 font-semibold text-gray-900">
                    Total
                  </td>
                  <td className="px-6 py-4 font-semibold text-gray-900">
                    {formatHoursMinutes(clientCosts.reduce((sum, c) => sum + c.total_hours, 0))}
                  </td>
                  <td className="px-6 py-4 font-semibold text-gray-900">
                    {formatCurrency(clientCosts.reduce((sum, c) => sum + c.total_cost, 0))}
                  </td>
                  <td className="px-6 py-4 font-semibold text-gray-900">
                    {formatCurrency(clientCosts.reduce((sum, c) => sum + c.price_to_charge, 0))}
                  </td>
                  <td className={`px-6 py-4 font-semibold flex items-center gap-1 ${
                    clientCosts.reduce((sum, c) => sum + c.net_margin, 0) >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {clientCosts.reduce((sum, c) => sum + c.net_margin, 0) >= 0 ? (
                      <TrendingUp className="w-4 h-4" />
                    ) : (
                      <TrendingDown className="w-4 h-4" />
                    )}
                    {formatCurrency(clientCosts.reduce((sum, c) => sum + c.net_margin, 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {!loading && clientCosts.length === 0 && startDate && endDate && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <Calculator className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">
            No hay horas registradas en el rango de fechas seleccionado.
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Selecciona un rango de fechas y haz clic en "Calcular" para ver los costos.
          </p>
        </div>
      )}
    </div>
  );
}

