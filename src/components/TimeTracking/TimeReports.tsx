import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Clock, 
  BarChart3, 
  Users, 
  FolderOpen, 
  Building2,
  Download,
  Calendar,
  Filter,
  AlertCircle,
  X,
  ChevronDown,
  ChevronRight
} from 'lucide-react';

interface ReportData {
  client_id: string;
  client_name: string;
  total_hours: number;
  entries_count: number;
}

interface UserReportData {
  user_id: string;
  user_name: string;
  user_email: string;
  total_hours: number;
  entries_count: number;
}

interface DepartmentReportData {
  department_id: string;
  department_name: string;
  total_hours: number;
  entries_count: number;
}

export function TimeReports() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  // Función para obtener la fecha local en formato YYYY-MM-DD
  const getLocalDateString = (date: Date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(1); // Primer día del mes actual
    return getLocalDateString(date);
  });
  const [endDate, setEndDate] = useState(getLocalDateString());
  const [reportType, setReportType] = useState<'client' | 'user' | 'department'>('client');
  
  const [clientReports, setClientReports] = useState<ReportData[]>([]);
  const [userReports, setUserReports] = useState<UserReportData[]>([]);
  const [departmentReports, setDepartmentReports] = useState<DepartmentReportData[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [clientEntriesByArea, setClientEntriesByArea] = useState<Map<string, { hours: number; entries: number; areaName: string; entriesList: any[] }>>(new Map());
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userEntriesByClient, setUserEntriesByClient] = useState<Map<string, { hours: number; entries: number; clientName: string; entriesList: any[] }>>(new Map());
  const [loadingEntries, setLoadingEntries] = useState(false);

  useEffect(() => {
    if (profile?.id && (profile.role === 'admin' || profile.role === 'support')) {
      loadReports();
      // Cerrar desglose al cambiar filtros
      setSelectedClientId(null);
      setClientEntriesByArea(new Map());
      setSelectedUserId(null);
      setUserEntriesByClient(new Map());
    }
  }, [profile?.id, startDate, endDate, reportType]);

  const loadReports = async () => {
    setLoading(true);
    try {
      if (reportType === 'client') {
        await loadClientReports();
      } else if (reportType === 'user') {
        await loadUserReports();
      } else if (reportType === 'department') {
        await loadDepartmentReports();
      }
    } catch (error) {
      console.error('Error loading reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadClientReports = async () => {
    const { data, error } = await supabase
      .from('time_entries')
      .select(`
        client_id,
        hours_worked,
        client:subforums!time_entries_client_id_fkey(id, name)
      `)
      .gte('entry_date', startDate)
      .lte('entry_date', endDate);

    if (error) throw error;

    const grouped = new Map<string, ReportData>();
    
    data?.forEach((entry: any) => {
      const clientId = entry.client_id;
      const hours = parseFloat(entry.hours_worked.toString());
      
      if (!grouped.has(clientId)) {
        grouped.set(clientId, {
          client_id: clientId,
          client_name: entry.client?.name || 'Cliente desconocido',
          total_hours: 0,
          entries_count: 0
        });
      }
      
      const report = grouped.get(clientId)!;
      report.total_hours += hours;
      report.entries_count += 1;
    });

    setClientReports(Array.from(grouped.values()).sort((a, b) => b.total_hours - a.total_hours));
  };

  const loadUserReports = async () => {
    const { data, error } = await supabase
      .from('time_entries')
      .select(`
        user_id,
        hours_worked,
        user:profiles!time_entries_user_id_fkey(id, full_name, email)
      `)
      .gte('entry_date', startDate)
      .lte('entry_date', endDate);

    if (error) throw error;

    const grouped = new Map<string, UserReportData>();
    
    data?.forEach((entry: any) => {
      const userId = entry.user_id;
      const hours = parseFloat(entry.hours_worked.toString());
      
      if (!grouped.has(userId)) {
        grouped.set(userId, {
          user_id: userId,
          user_name: entry.user?.full_name || 'Usuario desconocido',
          user_email: entry.user?.email || '',
          total_hours: 0,
          entries_count: 0
        });
      }
      
      const report = grouped.get(userId)!;
      report.total_hours += hours;
      report.entries_count += 1;
    });

    setUserReports(Array.from(grouped.values()).sort((a, b) => b.total_hours - a.total_hours));
  };

  const loadDepartmentReports = async () => {
    const { data, error } = await supabase
      .from('time_entries')
      .select(`
        department_id,
        hours_worked,
        department:departments!time_entries_department_id_fkey(id, name)
      `)
      .gte('entry_date', startDate)
      .lte('entry_date', endDate)
      .not('department_id', 'is', null);

    if (error) throw error;

    const grouped = new Map<string, DepartmentReportData>();
    
    data?.forEach((entry: any) => {
      if (!entry.department_id) return;
      
      const deptId = entry.department_id;
      const hours = parseFloat(entry.hours_worked.toString());
      
      if (!grouped.has(deptId)) {
        grouped.set(deptId, {
          department_id: deptId,
          department_name: entry.department?.name || 'Área desconocida',
          total_hours: 0,
          entries_count: 0
        });
      }
      
      const report = grouped.get(deptId)!;
      report.total_hours += hours;
      report.entries_count += 1;
    });

    setDepartmentReports(Array.from(grouped.values()).sort((a, b) => b.total_hours - a.total_hours));
  };

  const getTotalHours = () => {
    if (reportType === 'client') {
      return clientReports.reduce((sum, r) => sum + r.total_hours, 0);
    } else if (reportType === 'user') {
      return userReports.reduce((sum, r) => sum + r.total_hours, 0);
    } else {
      return departmentReports.reduce((sum, r) => sum + r.total_hours, 0);
    }
  };

  // Función helper para formatear horas decimales a horas y minutos
  const formatHoursMinutes = (decimalHours: number) => {
    const hours = Math.floor(decimalHours);
    const minutes = Math.round((decimalHours - hours) * 60);
    
    if (hours === 0 && minutes === 0) {
      return '0 min';
    }
    if (hours === 0) {
      return `${minutes} min`;
    }
    if (minutes === 0) {
      return `${hours} ${hours === 1 ? 'hora' : 'horas'}`;
    }
    return `${hours} ${hours === 1 ? 'hora' : 'horas'} ${minutes} min`;
  };

  const loadClientEntries = async (clientId: string) => {
    if (selectedClientId === clientId && clientEntriesByArea.size > 0) {
      // Si ya está seleccionado y tiene datos, cerrar
      setSelectedClientId(null);
      setClientEntriesByArea(new Map());
      return;
    }

    setLoadingEntries(true);
    setSelectedClientId(clientId);
    
    try {
      const { data, error } = await supabase
        .from('time_entries')
        .select(`
          *,
          department:departments!time_entries_department_id_fkey(id, name)
        `)
        .eq('client_id', clientId)
        .gte('entry_date', startDate)
        .lte('entry_date', endDate);

      if (error) throw error;

      // Agrupar por área
      const areaMap = new Map<string, { hours: number; entries: number; areaName: string; entriesList: any[] }>();
      
      data?.forEach((entry: any) => {
        const areaId = entry.department_id || 'sin-area';
        const areaName = entry.department?.name || 'Sin área asignada';
        const hours = parseFloat(entry.hours_worked.toString());
        
        if (!areaMap.has(areaId)) {
          areaMap.set(areaId, {
            hours: 0,
            entries: 0,
            areaName,
            entriesList: []
          });
        }
        
        const areaData = areaMap.get(areaId)!;
        areaData.hours += hours;
        areaData.entries += 1;
        areaData.entriesList.push(entry);
      });

      setClientEntriesByArea(areaMap);
    } catch (error) {
      console.error('Error loading client entries:', error);
    } finally {
      setLoadingEntries(false);
    }
  };

  const loadUserEntries = async (userId: string) => {
    if (selectedUserId === userId && userEntriesByClient.size > 0) {
      // Si ya está seleccionado y tiene datos, cerrar
      setSelectedUserId(null);
      setUserEntriesByClient(new Map());
      return;
    }

    setLoadingEntries(true);
    setSelectedUserId(userId);
    
    try {
      const { data, error } = await supabase
        .from('time_entries')
        .select(`
          *,
          client:subforums!time_entries_client_id_fkey(id, name)
        `)
        .eq('user_id', userId)
        .gte('entry_date', startDate)
        .lte('entry_date', endDate);

      if (error) throw error;

      // Agrupar por cliente
      const clientMap = new Map<string, { hours: number; entries: number; clientName: string; entriesList: any[] }>();
      
      data?.forEach((entry: any) => {
        const clientId = entry.client_id;
        const clientName = entry.client?.name || 'Cliente desconocido';
        const hours = parseFloat(entry.hours_worked.toString());
        
        if (!clientMap.has(clientId)) {
          clientMap.set(clientId, {
            hours: 0,
            entries: 0,
            clientName,
            entriesList: []
          });
        }
        
        const clientData = clientMap.get(clientId)!;
        clientData.hours += hours;
        clientData.entries += 1;
        clientData.entriesList.push(entry);
      });

      setUserEntriesByClient(clientMap);
    } catch (error) {
      console.error('Error loading user entries:', error);
    } finally {
      setLoadingEntries(false);
    }
  };

  if (profile?.role !== 'admin' && profile?.role !== 'support') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-3 text-red-500" />
          <p className="text-gray-600">No tienes permisos para ver los reportes</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-8 h-8 text-blue-600" />
            Reportes de Horas
          </h2>
          <p className="text-gray-600 mt-2">Análisis de horas trabajadas por cliente, empleado y área</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-gray-400" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <span className="text-gray-500">a</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-400" />
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value as any)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="client">Por Cliente</option>
              <option value="user">Por Empleado</option>
              <option value="department">Por Área</option>
            </select>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-lg ml-auto">
            <Clock className="w-5 h-5 text-blue-600" />
            <span className="font-semibold text-blue-900">
              Total: {formatHoursMinutes(getTotalHours())}
            </span>
          </div>
        </div>
      </div>

      {/* Reportes */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {reportType === 'client' && (
            <div className="divide-y divide-gray-200">
              {clientReports.length === 0 ? (
                <div className="p-12 text-center">
                  <FolderOpen className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                  <p className="text-gray-500">No hay datos para el período seleccionado</p>
                </div>
              ) : (
                <>
                  <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
                    <div className="grid grid-cols-3 gap-4 font-semibold text-sm text-gray-700">
                      <div>Cliente</div>
                      <div className="text-center">Entradas</div>
                      <div className="text-right">Total Horas</div>
                    </div>
                  </div>
                  {clientReports.map((report) => {
                    const isExpanded = selectedClientId === report.client_id;
                    return (
                      <div key={report.client_id}>
                        <div 
                          onClick={() => loadClientEntries(report.client_id)}
                          className="px-6 py-4 hover:bg-gray-50 transition-colors cursor-pointer"
                        >
                          <div className="grid grid-cols-3 gap-4 items-center">
                            <div className="flex items-center gap-2">
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-gray-400" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-gray-400" />
                              )}
                              <FolderOpen className="w-5 h-5 text-blue-600" />
                              <span className="font-medium text-gray-900">{report.client_name}</span>
                            </div>
                            <div className="text-center text-gray-600">{report.entries_count}</div>
                            <div className="text-right font-semibold text-blue-600">
                              {formatHoursMinutes(report.total_hours)}
                            </div>
                          </div>
                        </div>
                        {isExpanded && (
                          <div className="bg-gray-50 border-t border-gray-200 px-6 py-4">
                            {loadingEntries ? (
                              <div className="flex items-center justify-center py-4">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                              </div>
                            ) : clientEntriesByArea.size === 0 ? (
                              <p className="text-sm text-gray-500 text-center py-2">No hay entradas para este cliente</p>
                            ) : (
                              <div className="space-y-3">
                                <h4 className="font-semibold text-gray-900 mb-3 text-sm">
                                  Horas por Área
                                </h4>
                                <div className="space-y-2">
                                  {Array.from(clientEntriesByArea.entries())
                                    .sort((a, b) => b[1].hours - a[1].hours)
                                    .map(([areaId, areaData]) => (
                                    <div 
                                      key={areaId} 
                                      className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow"
                                    >
                                      <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                          <Building2 className="w-5 h-5 text-blue-600" />
                                          <div>
                                            <div className="font-medium text-gray-900">{areaData.areaName}</div>
                                            <div className="text-xs text-gray-500">{areaData.entries} {areaData.entries === 1 ? 'entrada' : 'entradas'}</div>
                                          </div>
                                        </div>
                                        <div className="text-right">
                                          <div className="font-semibold text-blue-600">
                                            {formatHoursMinutes(areaData.hours)}
                                          </div>
                                        </div>
                                      </div>
                                      {areaData.entriesList.length > 0 && (
                                        <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                                          {areaData.entriesList.map((entry) => {
                                            // Parsear fecha manualmente para evitar problemas de zona horaria
                                            const dateParts = entry.entry_date.split('-');
                                            const entryDate = new Date(
                                              parseInt(dateParts[0]),
                                              parseInt(dateParts[1]) - 1,
                                              parseInt(dateParts[2])
                                            );
                                            
                                            return (
                                              <div key={entry.id} className="text-sm">
                                                <div className="flex items-center gap-2 mb-1">
                                                  <span className="text-gray-500 text-xs">
                                                    {entryDate.toLocaleDateString('es-ES', {
                                                      day: 'numeric',
                                                      month: 'short'
                                                    })}
                                                  </span>
                                                  <span className="text-blue-600 font-medium text-xs">
                                                    {formatHoursMinutes(parseFloat(entry.hours_worked.toString()))}
                                                  </span>
                                                </div>
                                                {entry.description && (
                                                  <p className="text-gray-700 text-xs pl-1">{entry.description}</p>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          )}

          {reportType === 'user' && (
            <div className="divide-y divide-gray-200">
              {userReports.length === 0 ? (
                <div className="p-12 text-center">
                  <Users className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                  <p className="text-gray-500">No hay datos para el período seleccionado</p>
                </div>
              ) : (
                <>
                  <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
                    <div className="grid grid-cols-3 gap-4 font-semibold text-sm text-gray-700">
                      <div>Empleado</div>
                      <div className="text-center">Entradas</div>
                      <div className="text-right">Total Horas</div>
                    </div>
                  </div>
                  {userReports.map((report) => {
                    const isExpanded = selectedUserId === report.user_id;
                    return (
                      <div key={report.user_id}>
                        <div 
                          onClick={() => loadUserEntries(report.user_id)}
                          className="px-6 py-4 hover:bg-gray-50 transition-colors cursor-pointer"
                        >
                          <div className="grid grid-cols-3 gap-4 items-center">
                            <div className="flex items-center gap-2">
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-gray-400" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-gray-400" />
                              )}
                              <Users className="w-5 h-5 text-blue-600" />
                              <div>
                                <div className="font-medium text-gray-900">{report.user_name}</div>
                                <div className="text-xs text-gray-500">{report.user_email}</div>
                              </div>
                            </div>
                            <div className="text-center text-gray-600">{report.entries_count}</div>
                            <div className="text-right font-semibold text-blue-600">
                              {formatHoursMinutes(report.total_hours)}
                            </div>
                          </div>
                        </div>
                        {isExpanded && (
                          <div className="bg-gray-50 border-t border-gray-200 px-6 py-4">
                            {loadingEntries ? (
                              <div className="flex items-center justify-center py-4">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                              </div>
                            ) : userEntriesByClient.size === 0 ? (
                              <p className="text-sm text-gray-500 text-center py-2">No hay entradas para este empleado</p>
                            ) : (
                              <div className="space-y-3">
                                <h4 className="font-semibold text-gray-900 mb-3 text-sm">
                                  Horas por Cliente
                                </h4>
                                <div className="space-y-2">
                                  {Array.from(userEntriesByClient.entries())
                                    .sort((a, b) => b[1].hours - a[1].hours)
                                    .map(([clientId, clientData]) => (
                                    <div 
                                      key={clientId} 
                                      className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow"
                                    >
                                      <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                          <FolderOpen className="w-5 h-5 text-blue-600" />
                                          <div>
                                            <div className="font-medium text-gray-900">{clientData.clientName}</div>
                                            <div className="text-xs text-gray-500">{clientData.entries} {clientData.entries === 1 ? 'entrada' : 'entradas'}</div>
                                          </div>
                                        </div>
                                        <div className="text-right">
                                          <div className="font-semibold text-blue-600">
                                            {formatHoursMinutes(clientData.hours)}
                                          </div>
                                        </div>
                                      </div>
                                      {clientData.entriesList.length > 0 && (
                                        <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                                          {clientData.entriesList.map((entry) => {
                                            // Parsear fecha manualmente para evitar problemas de zona horaria
                                            const dateParts = entry.entry_date.split('-');
                                            const entryDate = new Date(
                                              parseInt(dateParts[0]),
                                              parseInt(dateParts[1]) - 1,
                                              parseInt(dateParts[2])
                                            );
                                            
                                            return (
                                              <div key={entry.id} className="text-sm">
                                                <div className="flex items-center gap-2 mb-1">
                                                  <span className="text-gray-500 text-xs">
                                                    {entryDate.toLocaleDateString('es-ES', {
                                                      day: 'numeric',
                                                      month: 'short'
                                                    })}
                                                  </span>
                                                  <span className="text-blue-600 font-medium text-xs">
                                                    {formatHoursMinutes(parseFloat(entry.hours_worked.toString()))}
                                                  </span>
                                                </div>
                                                {entry.description && (
                                                  <p className="text-gray-700 text-xs pl-1">{entry.description}</p>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          )}

          {reportType === 'department' && (
            <div className="divide-y divide-gray-200">
              {departmentReports.length === 0 ? (
                <div className="p-12 text-center">
                  <Building2 className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                  <p className="text-gray-500">No hay datos para el período seleccionado</p>
                </div>
              ) : (
                <>
                  <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
                    <div className="grid grid-cols-3 gap-4 font-semibold text-sm text-gray-700">
                      <div>Área</div>
                      <div className="text-center">Entradas</div>
                      <div className="text-right">Total Horas</div>
                    </div>
                  </div>
                  {departmentReports.map((report) => (
                    <div key={report.department_id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                      <div className="grid grid-cols-3 gap-4 items-center">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-5 h-5 text-blue-600" />
                          <span className="font-medium text-gray-900">{report.department_name}</span>
                        </div>
                        <div className="text-center text-gray-600">{report.entries_count}</div>
                        <div className="text-right font-semibold text-blue-600">
                          {formatHoursMinutes(report.total_hours)}
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

