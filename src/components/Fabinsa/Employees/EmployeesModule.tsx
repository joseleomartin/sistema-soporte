/**
 * Módulo de Empleados
 * Gestión de empleados y cálculo de mano de obra
 */

import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Save, X, Users, Upload } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useTenant } from '../../../contexts/TenantContext';
import { Database } from '../../../lib/database.types';
import { calculateEmployeeMetrics, EmployeeMetrics } from '../../../lib/fabinsaCalculations';
import { useDepartmentPermissions } from '../../../hooks/useDepartmentPermissions';
import { BulkImportEmployeesModal } from './BulkImportEmployeesModal';

type Employee = Database['public']['Tables']['employees']['Row'];
type EmployeeInsert = Database['public']['Tables']['employees']['Insert'];

export function EmployeesModule() {
  const { tenantId } = useTenant();
  const { canCreate, canEdit, canDelete } = useDepartmentPermissions();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [metrics, setMetrics] = useState<Record<string, EmployeeMetrics>>({});
  const [error, setError] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    nombre: '',
    valor_hora: '',
    dias_trabajados: '',
    horas_dia: '8',
    ausencias: '0',
    vacaciones: '0',
    feriados: '0',
    lic_enfermedad: '0',
    otras_licencias: '0',
    horas_descanso: '0',
    carga_social: '43',
    horas_extras: '0',
    feriados_trabajados: '0',
  });

  useEffect(() => {
    if (tenantId) {
      loadEmployees();
    }
  }, [tenantId]);

  useEffect(() => {
    // Calcular métricas para cada empleado
    const newMetrics: Record<string, EmployeeMetrics> = {};
    employees.forEach(emp => {
      newMetrics[emp.id] = calculateEmployeeMetrics(emp);
    });
    setMetrics(newMetrics);
  }, [employees]);

  const loadEmployees = async () => {
    if (!tenantId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      console.error('Error loading employees:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) {
      alert('Error: No se pudo identificar la empresa (tenant_id)');
      return;
    }

    // Validar campos requeridos
    if (!formData.nombre.trim()) {
      alert('El nombre es requerido');
      return;
    }

    if (!formData.valor_hora || parseFloat(formData.valor_hora) <= 0) {
      alert('El valor hora debe ser mayor a 0');
      return;
    }

    try {
      const employeeData: EmployeeInsert = {
        tenant_id: tenantId,
        nombre: formData.nombre.trim(),
        valor_hora: parseFloat(formData.valor_hora),
        dias_trabajados: parseInt(formData.dias_trabajados) || 0,
        horas_dia: parseFloat(formData.horas_dia) || 8,
        ausencias: parseInt(formData.ausencias) || 0,
        vacaciones: parseInt(formData.vacaciones) || 0,
        feriados: parseInt(formData.feriados) || 0,
        lic_enfermedad: parseInt(formData.lic_enfermedad) || 0,
        otras_licencias: parseInt(formData.otras_licencias) || 0,
        horas_descanso: parseFloat(formData.horas_descanso) || 0,
        carga_social: parseFloat(formData.carga_social) || 43,
        horas_extras: parseFloat(formData.horas_extras) || 0,
        feriados_trabajados: parseInt(formData.feriados_trabajados) || 0,
      };

      console.log('Datos a guardar:', employeeData);

      if (editingEmployee) {
        const { data, error } = await supabase
          .from('employees')
          .update(employeeData)
          .eq('id', editingEmployee.id)
          .select();

        if (error) {
          console.error('Error actualizando empleado:', error);
          throw error;
        }
        console.log('Empleado actualizado:', data);
      } else {
        const { data, error } = await supabase
          .from('employees')
          .insert(employeeData)
          .select();

        if (error) {
          console.error('Error insertando empleado:', error);
          throw error;
        }
        console.log('Empleado creado:', data);
      }

      resetForm();
      setError(null);
      loadEmployees();
    } catch (error: any) {
      console.error('Error saving employee:', error);
      const errorMessage = error?.message || error?.details || error?.hint || 'Error desconocido al guardar el empleado';
      setError(errorMessage);
      alert(`Error al guardar el empleado: ${errorMessage}`);
    }
  };

  const handleEdit = (employee: Employee) => {
    setFormData({
      nombre: employee.nombre,
      valor_hora: employee.valor_hora.toString(),
      dias_trabajados: employee.dias_trabajados.toString(),
      horas_dia: employee.horas_dia.toString(),
      ausencias: employee.ausencias.toString(),
      vacaciones: employee.vacaciones.toString(),
      feriados: employee.feriados.toString(),
      lic_enfermedad: employee.lic_enfermedad.toString(),
      otras_licencias: employee.otras_licencias.toString(),
      horas_descanso: employee.horas_descanso.toString(),
      carga_social: employee.carga_social.toString(),
      horas_extras: employee.horas_extras.toString(),
      feriados_trabajados: employee.feriados_trabajados.toString(),
    });
    setEditingEmployee(employee);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Está seguro de eliminar este empleado?')) return;

    try {
      const { error } = await supabase
        .from('employees')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadEmployees();
    } catch (error) {
      console.error('Error deleting employee:', error);
      alert('Error al eliminar el empleado');
    }
  };

  const resetForm = () => {
    setFormData({
      nombre: '',
      valor_hora: '',
      dias_trabajados: '',
      horas_dia: '8',
      ausencias: '0',
      vacaciones: '0',
      feriados: '0',
      lic_enfermedad: '0',
      otras_licencias: '0',
      horas_descanso: '0',
      carga_social: '43',
      horas_extras: '0',
      feriados_trabajados: '0',
    });
    setEditingEmployee(null);
    setShowForm(false);
    setError(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">Cargando empleados...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 -mx-6 -mt-6 mb-6">
        <div className="flex items-center space-x-3 mb-2">
          <Users className="w-6 h-6 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Empleados</h1>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300">Gestión de empleados y cálculo de mano de obra</p>
      </div>

      {/* Header with Add Button */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Lista de Empleados</h2>
        {canCreate('fabinsa-employees') && (
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Upload className="w-4 h-4" />
              <span>Importar</span>
            </button>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Empleado</span>
            </button>
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingEmployee ? 'Editar Empleado' : 'Nuevo Empleado'}
              </h3>
              <button onClick={resetForm} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Nombre *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Valor Hora *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.valor_hora}
                    onChange={(e) => setFormData({ ...formData, valor_hora: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Días Trabajados
                  </label>
                  <input
                    type="number"
                    value={formData.dias_trabajados}
                    onChange={(e) => setFormData({ ...formData, dias_trabajados: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Horas por Día
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.horas_dia}
                    onChange={(e) => setFormData({ ...formData, horas_dia: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Carga Social (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.carga_social}
                    onChange={(e) => setFormData({ ...formData, carga_social: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Ausencias
                  </label>
                  <input
                    type="number"
                    value={formData.ausencias}
                    onChange={(e) => setFormData({ ...formData, ausencias: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Vacaciones
                  </label>
                  <input
                    type="number"
                    value={formData.vacaciones}
                    onChange={(e) => setFormData({ ...formData, vacaciones: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Feriados
                  </label>
                  <input
                    type="number"
                    value={formData.feriados}
                    onChange={(e) => setFormData({ ...formData, feriados: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Lic. Enfermedad
                  </label>
                  <input
                    type="number"
                    value={formData.lic_enfermedad}
                    onChange={(e) => setFormData({ ...formData, lic_enfermedad: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Otras Licencias
                  </label>
                  <input
                    type="number"
                    value={formData.otras_licencias}
                    onChange={(e) => setFormData({ ...formData, otras_licencias: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Horas Descanso/día
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.horas_descanso}
                    onChange={(e) => setFormData({ ...formData, horas_descanso: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Horas Extras
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.horas_extras}
                    onChange={(e) => setFormData({ ...formData, horas_extras: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Feriados Trabajados
                  </label>
                  <input
                    type="number"
                    value={formData.feriados_trabajados}
                    onChange={(e) => setFormData({ ...formData, feriados_trabajados: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center space-x-2"
                >
                  <Save className="w-4 h-4" />
                  <span>Guardar</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Employees Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Nombre
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Valor Hora
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Valor Hora Ajustado
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Horas Productivas
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Índice Ajustado
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {employees.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                  No hay empleados registrados
                </td>
              </tr>
            ) : (
              employees.map((employee) => {
                const empMetrics = metrics[employee.id];
                return (
                  <tr key={employee.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{employee.nombre}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      ${employee.valor_hora.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {empMetrics ? `$${empMetrics.valor_hora_ajustado.toFixed(5)}` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {empMetrics ? empMetrics.horas_productivas.toFixed(2) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {empMetrics ? `${empMetrics.indice_ajustado.toFixed(2)}%` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        {canEdit('fabinsa-employees') && (
                          <button
                            onClick={() => handleEdit(employee)}
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        )}
                        {canDelete('fabinsa-employees') && (
                          <button
                            onClick={() => handleDelete(employee.id)}
                            className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de Importación */}
      {showImportModal && (
        <BulkImportEmployeesModal
          onClose={() => setShowImportModal(false)}
          onSuccess={() => {
            loadEmployees();
            setShowImportModal(false);
          }}
        />
      )}
    </div>
  );
}
