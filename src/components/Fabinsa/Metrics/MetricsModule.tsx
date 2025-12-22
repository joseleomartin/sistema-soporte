/**
 * Módulo de Métricas
 * Reportes y análisis de producción, ventas e inventario
 */

import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Package, DollarSign, Users, Factory, ShoppingCart, Percent, Activity } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useTenant } from '../../../contexts/TenantContext';
import { Database } from '../../../lib/database.types';

type ProductionMetric = Database['public']['Tables']['production_metrics']['Row'];
type Sale = Database['public']['Tables']['sales']['Row'];
type InventoryMovement = Database['public']['Tables']['inventory_movements']['Row'];

export function MetricsModule() {
  const { tenantId } = useTenant();
  const [productionMetrics, setProductionMetrics] = useState<ProductionMetric[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    if (tenantId) {
      loadMetrics();
    }
  }, [tenantId, dateRange]);

  const loadMetrics = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const startDate = new Date(dateRange.start).toISOString();
      const endDate = new Date(dateRange.end + 'T23:59:59').toISOString();

      // Load production metrics
      const { data: prod } = await supabase
        .from('production_metrics')
        .select('*')
        .eq('tenant_id', tenantId)
        .gte('fecha', startDate)
        .lte('fecha', endDate)
        .order('fecha', { ascending: false });
      setProductionMetrics(prod || []);

      // Load sales
      const { data: salesData } = await supabase
        .from('sales')
        .select('*')
        .eq('tenant_id', tenantId)
        .gte('fecha', startDate)
        .lte('fecha', endDate)
        .order('fecha', { ascending: false });
      setSales(salesData || []);

      // Load inventory movements
      const { data: movs } = await supabase
        .from('inventory_movements')
        .select('*')
        .eq('tenant_id', tenantId)
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .order('created_at', { ascending: false });
      setMovements(movs || []);
    } catch (error) {
      console.error('Error loading metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate totals
  const totalKgConsumed = productionMetrics.reduce((sum, m) => sum + m.kg_consumidos, 0);
  const totalCostMP = productionMetrics.reduce((sum, m) => sum + m.costo_mp, 0);
  const totalCostMO = productionMetrics.reduce((sum, m) => sum + m.costo_mo, 0);
  const totalCostProduction = totalCostMP + totalCostMO;
  const totalRevenue = sales.reduce((sum, s) => sum + s.ingreso_neto, 0);
  const totalProfit = sales.reduce((sum, s) => sum + s.ganancia_total, 0);
  const totalUnitsProduced = productionMetrics.reduce((sum, m) => sum + m.cantidad, 0);
  const totalUnitsSold = sales.reduce((sum, s) => sum + s.cantidad, 0);
  const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
  const avgProfitPerUnit = totalUnitsSold > 0 ? totalProfit / totalUnitsSold : 0;
  const avgRevenuePerSale = sales.length > 0 ? totalRevenue / sales.length : 0;

  // Group by product
  const productionByProduct = productionMetrics.reduce((acc, m) => {
    acc[m.producto] = (acc[m.producto] || 0) + m.kg_consumidos;
    return acc;
  }, {} as Record<string, number>);

  const salesByProduct = sales.reduce((acc, s) => {
    acc[s.producto] = (acc[s.producto] || 0) + s.ingreso_neto;
    return acc;
  }, {} as Record<string, number>);

  const profitByProduct = sales.reduce((acc, s) => {
    acc[s.producto] = (acc[s.producto] || 0) + s.ganancia_total;
    return acc;
  }, {} as Record<string, number>);

  // Group by date for trends
  const revenueByDate = sales.reduce((acc, s) => {
    const date = new Date(s.fecha).toLocaleDateString();
    acc[date] = (acc[date] || 0) + s.ingreso_neto;
    return acc;
  }, {} as Record<string, number>);

  const profitByDate = sales.reduce((acc, s) => {
    const date = new Date(s.fecha).toLocaleDateString();
    acc[date] = (acc[date] || 0) + s.ganancia_total;
    return acc;
  }, {} as Record<string, number>);

  // Top products
  const topProductsByRevenue = Object.entries(salesByProduct)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  const topProductsByProfit = Object.entries(profitByProduct)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  // Cost distribution
  const costDistribution = {
    mp: totalCostMP,
    mo: totalCostMO,
    total: totalCostProduction,
  };

  // Helper function to render bar chart
  const renderBarChart = (data: Record<string, number>, maxValue: number, color: string) => {
    const entries = Object.entries(data).slice(0, 10); // Top 10
    return (
      <div className="space-y-2">
        {entries.map(([key, value]) => {
          const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;
          return (
            <div key={key} className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-xs text-gray-600 dark:text-gray-300 truncate">{key}</div>
                <div className="text-xs font-semibold text-gray-900 dark:text-white">
                  {typeof value === 'number' && value.toFixed ? value.toFixed(2) : value}
                </div>
              </div>
              <div className="flex-1 h-6 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full ${color} transition-all`}
                  style={{ width: `${Math.min(percentage, 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">Cargando métricas...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 -mx-6 -mt-6 mb-6">
        <div className="flex items-center space-x-3 mb-2">
          <BarChart3 className="w-6 h-6 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Métricas</h1>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300">Reportes y análisis de producción, ventas e inventario</p>
      </div>

      {/* Date Range Filter */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow mb-6">
        <div className="flex items-center space-x-4">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Rango de fechas:</label>
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
          <span className="text-gray-700 dark:text-gray-300">a</span>
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-300">Kg Consumidos</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalKgConsumed.toFixed(2)}</p>
            </div>
            <Package className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-300">Costo Total MP</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">${totalCostMP.toFixed(2)}</p>
            </div>
            <Package className="w-8 h-8 text-orange-600" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-300">Costo Total MO</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">${totalCostMO.toFixed(2)}</p>
            </div>
            <Users className="w-8 h-8 text-purple-600" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-300">Costo Total Producción</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">${totalCostProduction.toFixed(2)}</p>
            </div>
            <Factory className="w-8 h-8 text-indigo-600" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-300">Unidades Producidas</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalUnitsProduced}</p>
            </div>
            <Activity className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-300">Unidades Vendidas</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalUnitsSold}</p>
            </div>
            <ShoppingCart className="w-8 h-8 text-teal-600" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-300">Ingresos Netos</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">${totalRevenue.toFixed(2)}</p>
            </div>
            <DollarSign className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-300">Ganancia Total</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">${totalProfit.toFixed(2)}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-300">Margen de Ganancia</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{profitMargin.toFixed(2)}%</p>
            </div>
            <Percent className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-300">Ganancia Promedio/Unidad</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">${avgProfitPerUnit.toFixed(2)}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-300">Ingreso Promedio/Venta</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">${avgRevenuePerSale.toFixed(2)}</p>
            </div>
            <DollarSign className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-300">Total Ventas</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{sales.length}</p>
            </div>
            <ShoppingCart className="w-8 h-8 text-blue-600" />
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Gráfico de Ingresos por Producto */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Ingresos por Producto</h3>
          {topProductsByRevenue.length > 0 ? (
            renderBarChart(
              Object.fromEntries(topProductsByRevenue),
              Math.max(...topProductsByRevenue.map(([, v]) => v)),
              'bg-green-500'
            )
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">No hay datos disponibles</p>
          )}
        </div>

        {/* Gráfico de Ganancia por Producto */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Ganancia por Producto</h3>
          {topProductsByProfit.length > 0 ? (
            renderBarChart(
              Object.fromEntries(topProductsByProfit),
              Math.max(...topProductsByProfit.map(([, v]) => v)),
              'bg-blue-500'
            )
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">No hay datos disponibles</p>
          )}
        </div>

        {/* Gráfico de Distribución de Costos */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Distribución de Costos de Producción</h3>
          {totalCostProduction > 0 ? (
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600 dark:text-gray-300">Materia Prima</span>
                  <span className="font-semibold text-gray-900 dark:text-white">${totalCostMP.toFixed(2)}</span>
                </div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-orange-500"
                    style={{ width: `${(totalCostMP / totalCostProduction) * 100}%` }}
                  />
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {((totalCostMP / totalCostProduction) * 100).toFixed(1)}%
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600 dark:text-gray-300">Mano de Obra</span>
                  <span className="font-semibold text-gray-900 dark:text-white">${totalCostMO.toFixed(2)}</span>
                </div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-500"
                    style={{ width: `${(totalCostMO / totalCostProduction) * 100}%` }}
                  />
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {((totalCostMO / totalCostProduction) * 100).toFixed(1)}%
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">No hay datos de producción</p>
          )}
        </div>

        {/* Gráfico de Kg Consumidos por Producto */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Kg Consumidos por Producto</h3>
          {Object.keys(productionByProduct).length > 0 ? (
            renderBarChart(
              productionByProduct,
              Math.max(...Object.values(productionByProduct)),
              'bg-blue-500'
            )
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">No hay datos disponibles</p>
          )}
        </div>
      </div>

      {/* Análisis Adicional */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Análisis de Rentabilidad */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Análisis de Rentabilidad</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded">
              <span className="text-sm text-gray-600 dark:text-gray-300">ROI (Retorno sobre Inversión)</span>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {totalCostProduction > 0 ? ((totalProfit / totalCostProduction) * 100).toFixed(2) : '0.00'}%
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded">
              <span className="text-sm text-gray-600 dark:text-gray-300">Relación Ingresos/Costos</span>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {totalCostProduction > 0 ? (totalRevenue / totalCostProduction).toFixed(2) : '0.00'}x
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded">
              <span className="text-sm text-gray-600 dark:text-gray-300">Eficiencia de Producción</span>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {totalUnitsProduced > 0 ? (totalRevenue / totalUnitsProduced).toFixed(2) : '0.00'} $/unidad
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded">
              <span className="text-sm text-gray-600 dark:text-gray-300">Costo por Kg Producido</span>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {totalKgConsumed > 0 ? (totalCostProduction / totalKgConsumed).toFixed(2) : '0.00'} $/kg
              </span>
            </div>
          </div>
        </div>

        {/* Resumen de Movimientos de Inventario */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Movimientos de Inventario</h3>
          <div className="space-y-3">
            {(() => {
              const movementsByType = movements.reduce((acc, m) => {
                acc[m.tipo] = (acc[m.tipo] || 0) + 1;
                return acc;
              }, {} as Record<string, number>);
              
              const typeLabels: Record<string, string> = {
                'ingreso_mp': 'Ingreso MP',
                'egreso_mp': 'Egreso MP',
                'ingreso_pr': 'Ingreso PR',
                'egreso_pr': 'Egreso PR',
                'ingreso_fab': 'Ingreso Fabricado',
                'egreso_fab': 'Egreso Fabricado',
              };

              return Object.entries(movementsByType).map(([type, count]) => (
                <div key={type} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded">
                  <span className="text-sm text-gray-600 dark:text-gray-300">{typeLabels[type] || type}</span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">{count}</span>
                </div>
              ));
            })()}
            {movements.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400">No hay movimientos en el período</p>
            )}
          </div>
        </div>
      </div>

      {/* Production Metrics Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Métricas de Producción</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Fecha</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Producto</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Cantidad</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Kg Consumidos</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Costo MP</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Costo MO</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Rentabilidad</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {productionMetrics.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                    No hay métricas de producción
                  </td>
                </tr>
              ) : (
                productionMetrics.map((metric) => (
                  <tr key={metric.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {new Date(metric.fecha).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{metric.producto}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{metric.cantidad}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{metric.kg_consumidos.toFixed(2)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">${metric.costo_mp.toFixed(2)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">${metric.costo_mo.toFixed(2)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {metric.rentabilidad_total ? (
                        <span className={metric.rentabilidad_total >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                          ${metric.rentabilidad_total.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-gray-500 dark:text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sales Summary */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Resumen de Ventas</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Fecha</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Producto</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Cantidad</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Ingreso Neto</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Ganancia</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {sales.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                    No hay ventas en el período seleccionado
                  </td>
                </tr>
              ) : (
                sales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {new Date(sale.fecha).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{sale.producto}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{sale.cantidad}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600 dark:text-green-400">
                      ${sale.ingreso_neto.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600 dark:text-green-400">
                      ${sale.ganancia_total.toFixed(2)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
