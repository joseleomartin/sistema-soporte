/**
 * Módulo de Métricas
 * Reportes y análisis de producción, ventas e inventario
 */

import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Package, DollarSign, Users, Factory, ShoppingCart, Percent, Activity, X, Settings, Download } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useTenant } from '../../../contexts/TenantContext';
import { Database } from '../../../lib/database.types';
import { writeFile, utils } from 'xlsx';

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
  // Estados temporales para los campos de fecha (para evitar actualizaciones mientras se escribe)
  const [tempStartDate, setTempStartDate] = useState(dateRange.start);
  const [tempEndDate, setTempEndDate] = useState(dateRange.end);
  const [showModal, setShowModal] = useState<string | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  
  // Configuración de métricas visibles
  const [visibleMetrics, setVisibleMetrics] = useState<Record<string, boolean>>(() => {
    // Cargar configuración desde localStorage o usar valores por defecto (todas visibles)
    const saved = localStorage.getItem('metrics-visible');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return {};
      }
    }
    // Por defecto, todas las métricas están visibles
    return {
      'kg-consumidos': true,
      'costo-mp': true,
      'costo-mo': true,
      'costo-produccion': true,
      'unidades-producidas': true,
      'unidades-vendidas': true,
      'ingresos-netos': true,
      'ganancia-total': true,
      'margen-ganancia': true,
      'ganancia-promedio': true,
      'ingreso-promedio': true,
      'rentabilidad-media': true,
      'total-ventas': true,
    };
  });

  useEffect(() => {
    if (tenantId) {
      loadMetrics();
    }
  }, [tenantId, dateRange]);

  // Sincronizar estados temporales cuando dateRange cambia externamente
  useEffect(() => {
    setTempStartDate(dateRange.start);
    setTempEndDate(dateRange.end);
  }, [dateRange.start, dateRange.end]);

  // Guardar configuración en localStorage cuando cambie
  useEffect(() => {
    localStorage.setItem('metrics-visible', JSON.stringify(visibleMetrics));
  }, [visibleMetrics]);

  const toggleMetric = (metricKey: string) => {
    setVisibleMetrics(prev => ({
      ...prev,
      [metricKey]: !prev[metricKey]
    }));
  };

  const selectAllMetrics = () => {
    const allTrue: Record<string, boolean> = {};
    Object.keys(visibleMetrics).forEach(key => {
      allTrue[key] = true;
    });
    setVisibleMetrics(allTrue);
  };

  const deselectAllMetrics = () => {
    const allFalse: Record<string, boolean> = {};
    Object.keys(visibleMetrics).forEach(key => {
      allFalse[key] = false;
    });
    setVisibleMetrics(allFalse);
  };

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
  
  // Calcular rentabilidad media basada en todas las ventas
  // Rentabilidad media = promedio de ganancia_total de todas las ventas
  const avgRentabilidad = sales.length > 0
    ? sales.reduce((sum, s) => sum + s.ganancia_total, 0) / sales.length
    : 0;
  
  // Calcular rentabilidad media en porcentaje sobre el costo total de producción
  // Rentabilidad % = (Ganancia Total / Costo Total de Producción) * 100
  const avgRentabilidadPercent = totalCostProduction > 0
    ? (totalProfit / totalCostProduction) * 100
    : 0;

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

  // Export to Excel function
  const exportToExcel = () => {
    const wb = utils.book_new();
    
    // Hoja 1: Resumen de Métricas
    const summaryData = [
      ['Métrica', 'Valor'],
      ['Kg Consumidos', totalKgConsumed.toFixed(2)],
      ['Costo Total MP', `$${totalCostMP.toFixed(2)}`],
      ['Costo Total MO', `$${totalCostMO.toFixed(2)}`],
      ['Costo Total Producción', `$${totalCostProduction.toFixed(2)}`],
      ['Unidades Producidas', totalUnitsProduced],
      ['Unidades Vendidas', totalUnitsSold],
      ['Ingresos Netos', `$${totalRevenue.toFixed(2)}`],
      ['Ganancia Total', `$${totalProfit.toFixed(2)}`],
      ['Margen de Ganancia', `${profitMargin.toFixed(2)}%`],
      ['Ganancia Promedio/Unidad', `$${avgProfitPerUnit.toFixed(2)}`],
      ['Ingreso Promedio/Venta', `$${avgRevenuePerSale.toFixed(2)}`],
      ['Rentabilidad Media', `$${avgRentabilidad.toFixed(2)}`],
      ['Rentabilidad Media %', `${avgRentabilidadPercent.toFixed(2)}%`],
      ['Total Ventas', sales.length],
      ['Período', `${dateRange.start} a ${dateRange.end}`],
    ];
    const ws1 = utils.aoa_to_sheet(summaryData);
    utils.book_append_sheet(wb, ws1, 'Resumen');

    // Hoja 2: Detalle de Ventas
    const salesData = [
      ['Fecha', 'Producto', 'Cantidad', 'Cliente', 'Ingreso Neto', 'Ganancia Total', 'Precio Unitario', 'IVA', 'Descuento', 'IIBB']
    ];
    sales.forEach(sale => {
      salesData.push([
        new Date(sale.fecha).toLocaleDateString('es-AR'),
        sale.producto,
        sale.cantidad,
        sale.cliente || 'N/A',
        sale.ingreso_neto.toFixed(2),
        sale.ganancia_total.toFixed(2),
        (sale.ingreso_neto / sale.cantidad).toFixed(2),
        sale.tiene_iva ? `${sale.iva_pct}%` : 'Sin IVA',
        sale.descuento_pct ? `${sale.descuento_pct}%` : '0%',
        sale.iib_pct ? `${sale.iib_pct}%` : '0%',
      ]);
    });
    const ws2 = utils.aoa_to_sheet(salesData);
    utils.book_append_sheet(wb, ws2, 'Ventas');

    // Hoja 3: Ingresos por Producto
    const revenueByProductData = [
      ['Producto', 'Ingreso Neto']
    ];
    Object.entries(salesByProduct)
      .sort(([, a], [, b]) => b - a)
      .forEach(([producto, ingreso]) => {
        revenueByProductData.push([producto, ingreso.toFixed(2)]);
      });
    const ws3 = utils.aoa_to_sheet(revenueByProductData);
    utils.book_append_sheet(wb, ws3, 'Ingresos por Producto');

    // Hoja 4: Ganancia por Producto
    const profitByProductData = [
      ['Producto', 'Ganancia Total']
    ];
    Object.entries(profitByProduct)
      .sort(([, a], [, b]) => b - a)
      .forEach(([producto, ganancia]) => {
        profitByProductData.push([producto, ganancia.toFixed(2)]);
      });
    const ws4 = utils.aoa_to_sheet(profitByProductData);
    utils.book_append_sheet(wb, ws4, 'Ganancia por Producto');

    // Hoja 5: Métricas de Producción
    const productionData = [
      ['Fecha', 'Producto', 'Cantidad', 'Kg Consumidos', 'Costo MP', 'Costo MO']
    ];
    productionMetrics.forEach(metric => {
      productionData.push([
        new Date(metric.fecha).toLocaleDateString('es-AR'),
        metric.producto,
        metric.cantidad,
        metric.kg_consumidos.toFixed(2),
        metric.costo_mp.toFixed(2),
        metric.costo_mo.toFixed(2),
      ]);
    });
    const ws5 = utils.aoa_to_sheet(productionData);
    utils.book_append_sheet(wb, ws5, 'Producción');

    // Hoja 6: Ingresos por Fecha
    const revenueByDateData = [
      ['Fecha', 'Ingreso Neto']
    ];
    Object.entries(revenueByDate)
      .sort(([a], [b]) => new Date(a.split('/').reverse().join('-')).getTime() - new Date(b.split('/').reverse().join('-')).getTime())
      .forEach(([fecha, ingreso]) => {
        revenueByDateData.push([fecha, ingreso.toFixed(2)]);
      });
    const ws6 = utils.aoa_to_sheet(revenueByDateData);
    utils.book_append_sheet(wb, ws6, 'Ingresos por Fecha');

    // Hoja 7: Ganancia por Fecha
    const profitByDateData = [
      ['Fecha', 'Ganancia Total']
    ];
    Object.entries(profitByDate)
      .sort(([a], [b]) => new Date(a.split('/').reverse().join('-')).getTime() - new Date(b.split('/').reverse().join('-')).getTime())
      .forEach(([fecha, ganancia]) => {
        profitByDateData.push([fecha, ganancia.toFixed(2)]);
      });
    const ws7 = utils.aoa_to_sheet(profitByDateData);
    utils.book_append_sheet(wb, ws7, 'Ganancia por Fecha');

    // Generar nombre de archivo con fecha
    const fileName = `metricas_${dateRange.start}_${dateRange.end}.xlsx`;
    writeFile(wb, fileName);
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
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-3">
            <BarChart3 className="w-6 h-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Métricas</h1>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={exportToExcel}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
              title="Exportar métricas a Excel"
            >
              <Download className="w-5 h-5" />
              <span className="text-sm font-medium">Exportar Excel</span>
            </button>
            <button
              onClick={() => setShowConfigModal(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
              title="Configurar métricas visibles"
            >
              <Settings className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Configurar</span>
            </button>
          </div>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300">Reportes y análisis de producción, ventas e inventario</p>
      </div>

      {/* Date Range Filter */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow mb-6">
        <div className="flex items-center space-x-4">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Rango de fechas:</label>
          <input
            type="date"
            value={tempStartDate}
            onChange={(e) => {
              // Solo actualizar el estado temporal mientras se escribe
              setTempStartDate(e.target.value);
            }}
            onBlur={(e) => {
              // Actualizar el estado real solo cuando el usuario termine de escribir
              const newDate = e.target.value;
              if (newDate !== dateRange.start && newDate) {
                setDateRange({ ...dateRange, start: newDate });
              } else if (!newDate) {
                // Si se borra, mantener el valor anterior
                setTempStartDate(dateRange.start);
              }
            }}
            onKeyDown={(e) => {
              // Si presiona Enter, aplicar el cambio
              if (e.key === 'Enter') {
                const newDate = tempStartDate;
                if (newDate !== dateRange.start && newDate) {
                  setDateRange({ ...dateRange, start: newDate });
                }
                e.currentTarget.blur();
              }
            }}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
          <span className="text-gray-700 dark:text-gray-300">a</span>
          <input
            type="date"
            value={tempEndDate}
            onChange={(e) => {
              // Solo actualizar el estado temporal mientras se escribe
              setTempEndDate(e.target.value);
            }}
            onBlur={(e) => {
              // Actualizar el estado real solo cuando el usuario termine de escribir
              const newDate = e.target.value;
              if (newDate !== dateRange.end && newDate) {
                setDateRange({ ...dateRange, end: newDate });
              } else if (!newDate) {
                // Si se borra, mantener el valor anterior
                setTempEndDate(dateRange.end);
              }
            }}
            onKeyDown={(e) => {
              // Si presiona Enter, aplicar el cambio
              if (e.key === 'Enter') {
                const newDate = tempEndDate;
                if (newDate !== dateRange.end && newDate) {
                  setDateRange({ ...dateRange, end: newDate });
                }
                e.currentTarget.blur();
              }
            }}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        {visibleMetrics['kg-consumidos'] && (
        <div 
          className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => setShowModal('kg-consumidos')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-300">Kg Consumidos</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalKgConsumed.toFixed(2)}</p>
            </div>
            <Package className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        )}

        {visibleMetrics['costo-mp'] && (
        <div 
          className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => setShowModal('costo-mp')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-300">Costo Total MP</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">${totalCostMP.toFixed(2)}</p>
            </div>
            <Package className="w-8 h-8 text-orange-600" />
          </div>
        </div>
        )}

        {visibleMetrics['costo-mo'] && (
        <div 
          className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => setShowModal('costo-mo')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-300">Costo Total MO</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">${totalCostMO.toFixed(2)}</p>
            </div>
            <Users className="w-8 h-8 text-purple-600" />
          </div>
        </div>
        )}

        {visibleMetrics['costo-produccion'] && (
        <div 
          className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => setShowModal('costo-produccion')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-300">Costo Total Producción</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">${totalCostProduction.toFixed(2)}</p>
            </div>
            <Factory className="w-8 h-8 text-indigo-600" />
          </div>
        </div>
        )}

        {visibleMetrics['unidades-producidas'] && (
        <div 
          className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => setShowModal('unidades-producidas')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-300">Unidades Producidas</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalUnitsProduced}</p>
            </div>
            <Activity className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        )}

        {visibleMetrics['unidades-vendidas'] && (
        <div 
          className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => setShowModal('unidades-vendidas')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-300">Unidades Vendidas</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalUnitsSold}</p>
            </div>
            <ShoppingCart className="w-8 h-8 text-teal-600" />
          </div>
        </div>
        )}

        {visibleMetrics['ingresos-netos'] && (
        <div 
          className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => setShowModal('ingresos-netos')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-300">Ingresos Netos</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">${totalRevenue.toFixed(2)}</p>
            </div>
            <DollarSign className="w-8 h-8 text-green-600" />
          </div>
        </div>
        )}

        {visibleMetrics['ganancia-total'] && (
        <div 
          className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => setShowModal('ganancia-total')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-300">Ganancia Total</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">${totalProfit.toFixed(2)}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-600" />
          </div>
        </div>
        )}

        {visibleMetrics['margen-ganancia'] && (
        <div 
          className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => setShowModal('margen-ganancia')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-300">Margen de Ganancia</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{profitMargin.toFixed(2)}%</p>
            </div>
            <Percent className="w-8 h-8 text-green-600" />
          </div>
        </div>
        )}

        {visibleMetrics['ganancia-promedio'] && (
        <div 
          className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => setShowModal('ganancia-promedio')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-300">Ganancia Promedio/Unidad</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">${avgProfitPerUnit.toFixed(2)}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-600" />
          </div>
        </div>
        )}

        {visibleMetrics['ingreso-promedio'] && (
        <div 
          className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => setShowModal('ingreso-promedio')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-300">Ingreso Promedio/Venta</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">${avgRevenuePerSale.toFixed(2)}</p>
            </div>
            <DollarSign className="w-8 h-8 text-green-600" />
          </div>
        </div>
        )}

        {visibleMetrics['rentabilidad-media'] && (
        <div 
          className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => setShowModal('rentabilidad-media')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-300">Rentabilidad Media</p>
              <p className={`text-2xl font-bold ${avgRentabilidad >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                ${avgRentabilidad.toFixed(2)}
              </p>
              <p className={`text-sm font-medium ${avgRentabilidadPercent >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {avgRentabilidadPercent.toFixed(2)}%
              </p>
            </div>
            <TrendingUp className={`w-8 h-8 ${avgRentabilidad >= 0 ? 'text-green-600' : 'text-red-600'}`} />
          </div>
        </div>
        )}

        {visibleMetrics['total-ventas'] && (
        <div 
          className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => setShowModal('total-ventas')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-300">Total Ventas</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{sales.length}</p>
            </div>
            <ShoppingCart className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        )}
      </div>

      {/* Modales de Detalle */}
      {showModal === 'unidades-producidas' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Unidades Producidas - Detalle</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Total: {totalUnitsProduced} unidades</p>
              </div>
              <button
                onClick={() => setShowModal(null)}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {productionMetrics.length === 0 ? (
                <p className="text-center text-gray-500 dark:text-gray-400 py-8">No hay producción registrada en el período seleccionado</p>
              ) : (
                <div className="space-y-4">
                  {productionMetrics.map((metric) => (
                    <div key={metric.id} className="bg-gray-50 dark:bg-slate-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Fecha</p>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {new Date(metric.fecha).toLocaleDateString('es-AR')}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Producto</p>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{metric.producto}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Cantidad Producida</p>
                          <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">{metric.cantidad} unidades</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Kg Consumidos</p>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{metric.kg_consumidos.toFixed(2)} kg</p>
                        </div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600 grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Costo MP</p>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">${metric.costo_mp.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Costo MO</p>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">${metric.costo_mo.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Costo Total</p>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">
                            ${(metric.costo_mp + metric.costo_mo).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showModal === 'unidades-vendidas' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Unidades Vendidas - Detalle</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Total: {totalUnitsSold} unidades</p>
              </div>
              <button
                onClick={() => setShowModal(null)}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {sales.length === 0 ? (
                <p className="text-center text-gray-500 dark:text-gray-400 py-8">No hay ventas registradas en el período seleccionado</p>
              ) : (
                <div className="space-y-4">
                  {sales.map((sale) => (
                    <div key={sale.id} className="bg-gray-50 dark:bg-slate-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Fecha</p>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {new Date(sale.fecha).toLocaleDateString('es-AR')}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Producto</p>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{sale.producto}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Cantidad Vendida</p>
                          <p className="text-sm font-semibold text-teal-600 dark:text-teal-400">{sale.cantidad} unidades</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Cliente</p>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{sale.cliente || 'N/A'}</p>
                        </div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600 grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Ingreso Neto</p>
                          <p className="text-sm font-semibold text-green-600 dark:text-green-400">${sale.ingreso_neto.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Ganancia</p>
                          <p className="text-sm font-semibold text-green-600 dark:text-green-400">${sale.ganancia_total.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Precio Unitario</p>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            ${(sale.ingreso_neto / sale.cantidad).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showModal === 'total-ventas' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Detalle de Ventas</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Total: {sales.length} ventas | Ingresos: ${totalRevenue.toFixed(2)} | Ganancia: ${totalProfit.toFixed(2)}</p>
              </div>
              <button
                onClick={() => setShowModal(null)}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {sales.length === 0 ? (
                <p className="text-center text-gray-500 dark:text-gray-400 py-8">No hay ventas registradas en el período seleccionado</p>
              ) : (
                <div className="space-y-4">
                  {sales.map((sale, index) => (
                    <div key={sale.id} className="bg-gray-50 dark:bg-slate-700 rounded-lg p-5 border border-gray-200 dark:border-gray-600">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                            <span className="text-blue-600 dark:text-blue-400 font-semibold">#{index + 1}</span>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">Venta del {new Date(sale.fecha).toLocaleDateString('es-AR')}</p>
                            <p className="text-xs text-gray-600 dark:text-gray-400">ID: {sale.id.substring(0, 8)}...</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-600 dark:text-gray-400">Total</p>
                          <p className="text-lg font-bold text-green-600 dark:text-green-400">${sale.ingreso_neto.toFixed(2)}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div className="bg-white dark:bg-slate-600 rounded-lg p-4">
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">Producto</p>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">{sale.producto}</p>
                        </div>
                        <div className="bg-white dark:bg-slate-600 rounded-lg p-4">
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">Cliente</p>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">{sale.cliente || 'Sin cliente asignado'}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Cantidad</p>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">{sale.cantidad} unidades</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Precio Unitario</p>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            ${(sale.ingreso_neto / sale.cantidad).toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Ingreso Neto</p>
                          <p className="text-sm font-semibold text-green-600 dark:text-green-400">${sale.ingreso_neto.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Ganancia</p>
                          <p className="text-sm font-semibold text-green-600 dark:text-green-400">${sale.ganancia_total.toFixed(2)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Kg Consumidos */}
      {showModal === 'kg-consumidos' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Kg Consumidos - Detalle</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Total: {totalKgConsumed.toFixed(2)} kg</p>
              </div>
              <button
                onClick={() => setShowModal(null)}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {Object.keys(productionByProduct).length === 0 ? (
                <p className="text-center text-gray-500 dark:text-gray-400 py-8">No hay consumo de materiales registrado</p>
              ) : (
                <div className="space-y-4">
                  <div className="bg-gray-50 dark:bg-slate-700 rounded-lg p-4 mb-4">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Resumen por Producto</p>
                    <div className="grid grid-cols-2 gap-4">
                      {Object.entries(productionByProduct)
                        .sort(([, a], [, b]) => b - a)
                        .map(([producto, kg]) => (
                          <div key={producto} className="bg-white dark:bg-slate-600 rounded p-3">
                            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">{producto}</p>
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">{kg.toFixed(2)} kg</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {((kg / totalKgConsumed) * 100).toFixed(1)}% del total
                            </p>
                          </div>
                        ))}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">Detalle por Producción</p>
                    {productionMetrics.map((metric) => (
                      <div key={metric.id} className="bg-gray-50 dark:bg-slate-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Fecha</p>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {new Date(metric.fecha).toLocaleDateString('es-AR')}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Producto</p>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{metric.producto}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Kg Consumidos</p>
                            <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">{metric.kg_consumidos.toFixed(2)} kg</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Unidades Producidas</p>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{metric.cantidad} unidades</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Costo Total MP */}
      {showModal === 'costo-mp' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Costo Total Materia Prima - Detalle</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Total: ${totalCostMP.toFixed(2)}</p>
              </div>
              <button
                onClick={() => setShowModal(null)}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {productionMetrics.length === 0 ? (
                <p className="text-center text-gray-500 dark:text-gray-400 py-8">No hay costos de materia prima registrados</p>
              ) : (
                <div className="space-y-4">
                  {productionMetrics.map((metric) => (
                    <div key={metric.id} className="bg-gray-50 dark:bg-slate-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Fecha</p>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {new Date(metric.fecha).toLocaleDateString('es-AR')}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Producto</p>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{metric.producto}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Costo MP</p>
                          <p className="text-sm font-semibold text-orange-600 dark:text-orange-400">${metric.costo_mp.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">% del Total</p>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {totalCostMP > 0 ? ((metric.costo_mp / totalCostMP) * 100).toFixed(1) : '0.0'}%
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Costo Total MO */}
      {showModal === 'costo-mo' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Costo Total Mano de Obra - Detalle</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Total: ${totalCostMO.toFixed(2)}</p>
              </div>
              <button
                onClick={() => setShowModal(null)}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {productionMetrics.length === 0 ? (
                <p className="text-center text-gray-500 dark:text-gray-400 py-8">No hay costos de mano de obra registrados</p>
              ) : (
                <div className="space-y-4">
                  {productionMetrics.map((metric) => (
                    <div key={metric.id} className="bg-gray-50 dark:bg-slate-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Fecha</p>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {new Date(metric.fecha).toLocaleDateString('es-AR')}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Producto</p>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{metric.producto}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Costo MO</p>
                          <p className="text-sm font-semibold text-purple-600 dark:text-purple-400">${metric.costo_mo.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">% del Total</p>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {totalCostMO > 0 ? ((metric.costo_mo / totalCostMO) * 100).toFixed(1) : '0.0'}%
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Costo Total Producción */}
      {showModal === 'costo-produccion' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Costo Total Producción - Detalle</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Total: ${totalCostProduction.toFixed(2)}</p>
              </div>
              <button
                onClick={() => setShowModal(null)}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="bg-gray-50 dark:bg-slate-700 rounded-lg p-4 mb-4">
                <p className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Desglose de Costos</p>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Materia Prima</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">${totalCostMP.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Mano de Obra</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">${totalCostMO.toFixed(2)}</span>
                  </div>
                  <div className="pt-3 border-t border-gray-300 dark:border-gray-600 flex justify-between items-center">
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">Total</span>
                    <span className="text-lg font-bold text-gray-900 dark:text-white">${totalCostProduction.toFixed(2)}</span>
                  </div>
                </div>
              </div>
              {productionMetrics.length === 0 ? (
                <p className="text-center text-gray-500 dark:text-gray-400 py-8">No hay costos de producción registrados</p>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">Detalle por Producción</p>
                  {productionMetrics.map((metric) => {
                    const costoTotal = metric.costo_mp + metric.costo_mo;
                    return (
                      <div key={metric.id} className="bg-gray-50 dark:bg-slate-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-3">
                          <div>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Fecha</p>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {new Date(metric.fecha).toLocaleDateString('es-AR')}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Producto</p>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{metric.producto}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Costo MP</p>
                            <p className="text-sm font-medium text-orange-600 dark:text-orange-400">${metric.costo_mp.toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Costo MO</p>
                            <p className="text-sm font-medium text-purple-600 dark:text-purple-400">${metric.costo_mo.toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Costo Total</p>
                            <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">${costoTotal.toFixed(2)}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Ingresos Netos */}
      {showModal === 'ingresos-netos' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Ingresos Netos - Detalle</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Total: ${totalRevenue.toFixed(2)}</p>
              </div>
              <button
                onClick={() => setShowModal(null)}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {sales.length === 0 ? (
                <p className="text-center text-gray-500 dark:text-gray-400 py-8">No hay ingresos registrados</p>
              ) : (
                <div className="space-y-4">
                  {sales.map((sale) => (
                    <div key={sale.id} className="bg-gray-50 dark:bg-slate-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Fecha</p>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {new Date(sale.fecha).toLocaleDateString('es-AR')}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Producto</p>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{sale.producto}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Ingreso Neto</p>
                          <p className="text-sm font-semibold text-green-600 dark:text-green-400">${sale.ingreso_neto.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">% del Total</p>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {totalRevenue > 0 ? ((sale.ingreso_neto / totalRevenue) * 100).toFixed(1) : '0.0'}%
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Ganancia Total */}
      {showModal === 'ganancia-total' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Ganancia Total - Detalle</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Total: ${totalProfit.toFixed(2)}</p>
              </div>
              <button
                onClick={() => setShowModal(null)}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {sales.length === 0 ? (
                <p className="text-center text-gray-500 dark:text-gray-400 py-8">No hay ganancias registradas</p>
              ) : (
                <div className="space-y-4">
                  {sales.map((sale) => (
                    <div key={sale.id} className="bg-gray-50 dark:bg-slate-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Fecha</p>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {new Date(sale.fecha).toLocaleDateString('es-AR')}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Producto</p>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{sale.producto}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Ganancia</p>
                          <p className="text-sm font-semibold text-green-600 dark:text-green-400">${sale.ganancia_total.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">% del Total</p>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {totalProfit > 0 ? ((sale.ganancia_total / totalProfit) * 100).toFixed(1) : '0.0'}%
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Margen de Ganancia */}
      {showModal === 'margen-ganancia' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Margen de Ganancia - Análisis</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Margen: {profitMargin.toFixed(2)}%</p>
              </div>
              <button
                onClick={() => setShowModal(null)}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="bg-gray-50 dark:bg-slate-700 rounded-lg p-4 mb-4">
                <p className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Resumen</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Ingresos Totales</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">${totalRevenue.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Ganancia Total</p>
                    <p className="text-sm font-semibold text-green-600 dark:text-green-400">${totalProfit.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Costos Totales</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">${totalCostProduction.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Margen de Ganancia</p>
                    <p className="text-lg font-bold text-green-600 dark:text-green-400">{profitMargin.toFixed(2)}%</p>
                  </div>
                </div>
              </div>
              {sales.length === 0 ? (
                <p className="text-center text-gray-500 dark:text-gray-400 py-8">No hay datos de ventas</p>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">Margen por Venta</p>
                  {sales.map((sale) => {
                    const margenVenta = sale.ingreso_neto > 0 ? (sale.ganancia_total / sale.ingreso_neto) * 100 : 0;
                    return (
                      <div key={sale.id} className="bg-gray-50 dark:bg-slate-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Fecha</p>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {new Date(sale.fecha).toLocaleDateString('es-AR')}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Producto</p>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{sale.producto}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Margen</p>
                            <p className="text-sm font-semibold text-green-600 dark:text-green-400">{margenVenta.toFixed(2)}%</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Ganancia</p>
                            <p className="text-sm font-medium text-green-600 dark:text-green-400">${sale.ganancia_total.toFixed(2)}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Ganancia Promedio/Unidad */}
      {showModal === 'ganancia-promedio' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Ganancia Promedio por Unidad - Análisis</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Promedio: ${avgProfitPerUnit.toFixed(2)} por unidad</p>
              </div>
              <button
                onClick={() => setShowModal(null)}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="bg-gray-50 dark:bg-slate-700 rounded-lg p-4 mb-4">
                <p className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Resumen</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Ganancia Total</p>
                    <p className="text-sm font-semibold text-green-600 dark:text-green-400">${totalProfit.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Unidades Vendidas</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{totalUnitsSold}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Ganancia Promedio/Unidad</p>
                    <p className="text-lg font-bold text-green-600 dark:text-green-400">${avgProfitPerUnit.toFixed(2)}</p>
                  </div>
                </div>
              </div>
              {sales.length === 0 ? (
                <p className="text-center text-gray-500 dark:text-gray-400 py-8">No hay datos de ventas</p>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">Ganancia por Unidad por Venta</p>
                  {sales.map((sale) => {
                    const gananciaPorUnidad = sale.cantidad > 0 ? sale.ganancia_total / sale.cantidad : 0;
                    return (
                      <div key={sale.id} className="bg-gray-50 dark:bg-slate-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Fecha</p>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {new Date(sale.fecha).toLocaleDateString('es-AR')}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Producto</p>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{sale.producto}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Ganancia/Unidad</p>
                            <p className="text-sm font-semibold text-green-600 dark:text-green-400">${gananciaPorUnidad.toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Cantidad</p>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{sale.cantidad} unidades</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Rentabilidad Media */}
      {showModal === 'rentabilidad-media' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Rentabilidad Media - Análisis</h3>
                <p className={`text-sm mt-1 ${avgRentabilidad >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  Promedio: ${avgRentabilidad.toFixed(2)} ({avgRentabilidadPercent.toFixed(2)}%)
                </p>
              </div>
              <button
                onClick={() => setShowModal(null)}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="bg-gray-50 dark:bg-slate-700 rounded-lg p-4 mb-4">
                <p className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Resumen</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Rentabilidad Media (por venta)</p>
                    <p className={`text-lg font-bold ${avgRentabilidad >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      ${avgRentabilidad.toFixed(2)}
                    </p>
                    <p className={`text-sm font-medium ${avgRentabilidadPercent >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {avgRentabilidadPercent.toFixed(2)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Total Ventas</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{sales.length}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Ganancia Total: ${totalProfit.toFixed(2)}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Costo Producción: ${totalCostProduction.toFixed(2)}</p>
                  </div>
                </div>
              </div>
              {sales.length === 0 ? (
                <p className="text-center text-gray-500 dark:text-gray-400 py-8">No hay ventas registradas</p>
              ) : (
                <div className="space-y-6">
                  {/* Rentabilidad por Producto */}
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Rentabilidad por Producto</p>
                    <div className="bg-gray-50 dark:bg-slate-700 rounded-lg p-4 mb-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {(() => {
                          // Agrupar ventas por producto
                          const rentabilidadPorProducto = sales.reduce((acc, sale) => {
                            if (!acc[sale.producto]) {
                              acc[sale.producto] = {
                                producto: sale.producto,
                                gananciaTotal: 0,
                                cantidadTotal: 0,
                                numVentas: 0,
                                ingresosTotal: 0,
                              };
                            }
                            acc[sale.producto].gananciaTotal += sale.ganancia_total;
                            acc[sale.producto].cantidadTotal += sale.cantidad;
                            acc[sale.producto].numVentas += 1;
                            acc[sale.producto].ingresosTotal += sale.ingreso_neto;
                            return acc;
                          }, {} as Record<string, {
                            producto: string;
                            gananciaTotal: number;
                            cantidadTotal: number;
                            numVentas: number;
                            ingresosTotal: number;
                          }>);

                          // Calcular costo estimado por producto
                          const productosConCosto = Object.values(rentabilidadPorProducto).map(item => {
                            // Buscar producción relacionada para calcular costo
                            const relatedProduction = productionMetrics
                              .filter(m => m.producto === item.producto)
                              .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())[0];
                            
                            const costoPorUnidad = relatedProduction && relatedProduction.cantidad > 0
                              ? (relatedProduction.costo_mp + relatedProduction.costo_mo) / relatedProduction.cantidad
                              : 0;
                            
                            const costoTotal = costoPorUnidad * item.cantidadTotal;
                            const rentabilidadPercent = costoTotal > 0 ? (item.gananciaTotal / costoTotal) * 100 : 0;
                            const gananciaPromedio = item.numVentas > 0 ? item.gananciaTotal / item.numVentas : 0;

                            return {
                              ...item,
                              costoTotal,
                              costoPorUnidad,
                              rentabilidadPercent,
                              gananciaPromedio,
                            };
                          });

                          return productosConCosto
                            .sort((a, b) => b.gananciaTotal - a.gananciaTotal)
                            .map((item) => (
                              <div key={item.producto} className="bg-white dark:bg-slate-600 rounded-lg p-4 border border-gray-200 dark:border-gray-500">
                                <p className="text-sm font-semibold text-gray-900 dark:text-white mb-3 truncate" title={item.producto}>
                                  {item.producto}
                                </p>
                                <div className="space-y-2">
                                  <div className="flex justify-between items-center">
                                    <span className="text-xs text-gray-600 dark:text-gray-400">Rentabilidad Total</span>
                                    <span className={`text-sm font-bold ${item.gananciaTotal >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                      ${item.gananciaTotal.toFixed(2)}
                                    </span>
                                  </div>
                                  {item.costoTotal > 0 && (
                                    <div className="flex justify-between items-center">
                                      <span className="text-xs text-gray-600 dark:text-gray-400">Rentabilidad %</span>
                                      <span className={`text-sm font-semibold ${item.rentabilidadPercent >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                        {item.rentabilidadPercent.toFixed(2)}%
                                      </span>
                                    </div>
                                  )}
                                  <div className="flex justify-between items-center">
                                    <span className="text-xs text-gray-600 dark:text-gray-400">Ventas</span>
                                    <span className="text-sm font-medium text-gray-900 dark:text-white">{item.numVentas}</span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-xs text-gray-600 dark:text-gray-400">Cantidad Total</span>
                                    <span className="text-sm font-medium text-gray-900 dark:text-white">{item.cantidadTotal} unidades</span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-xs text-gray-600 dark:text-gray-400">Rentabilidad Promedio</span>
                                    <span className={`text-sm font-medium ${item.gananciaPromedio >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                      ${item.gananciaPromedio.toFixed(2)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ));
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Rentabilidad por Venta */}
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Rentabilidad por Venta</p>
                    <div className="space-y-4">
                      {sales.map((sale) => {
                        // Calcular el costo de producción asociado a esta venta
                        // Buscar la producción del mismo producto más reciente antes de la venta
                        const relatedProduction = productionMetrics
                          .filter(m => m.producto === sale.producto && new Date(m.fecha) <= new Date(sale.fecha))
                          .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())[0];
                        
                        const costoVenta = relatedProduction 
                          ? (relatedProduction.costo_mp + relatedProduction.costo_mo) * (sale.cantidad / relatedProduction.cantidad)
                          : 0;
                        
                        const rentabilidadVenta = sale.ganancia_total;
                        const rentabilidadPercentVenta = costoVenta > 0 ? (rentabilidadVenta / costoVenta) * 100 : 0;
                        
                        return (
                          <div key={sale.id} className="bg-gray-50 dark:bg-slate-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                              <div>
                                <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Fecha</p>
                                <p className="text-sm font-medium text-gray-900 dark:text-white">
                                  {new Date(sale.fecha).toLocaleDateString('es-AR')}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Producto</p>
                                <p className="text-sm font-medium text-gray-900 dark:text-white">{sale.producto}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Cantidad</p>
                                <p className="text-sm font-medium text-gray-900 dark:text-white">{sale.cantidad} unidades</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Costo Estimado</p>
                                <p className="text-sm font-medium text-gray-900 dark:text-white">
                                  ${costoVenta > 0 ? costoVenta.toFixed(2) : 'N/A'}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Rentabilidad</p>
                                <p className={`text-sm font-semibold ${rentabilidadVenta >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                  ${rentabilidadVenta.toFixed(2)}
                                </p>
                                {costoVenta > 0 && (
                                  <p className={`text-xs font-medium ${rentabilidadPercentVenta >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                    {rentabilidadPercentVenta.toFixed(2)}%
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600 grid grid-cols-2 gap-4">
                              <div>
                                <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Diferencia vs Media ($)</p>
                                <p className={`text-sm font-medium ${(rentabilidadVenta - avgRentabilidad) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                  ${(rentabilidadVenta - avgRentabilidad).toFixed(2)}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Diferencia vs Media (%)</p>
                                {costoVenta > 0 && (
                                  <p className={`text-sm font-medium ${(rentabilidadPercentVenta - avgRentabilidadPercent) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                    {(rentabilidadPercentVenta - avgRentabilidadPercent).toFixed(2)}%
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Ingreso Promedio/Venta */}
      {showModal === 'ingreso-promedio' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Ingreso Promedio por Venta - Análisis</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Promedio: ${avgRevenuePerSale.toFixed(2)} por venta</p>
              </div>
              <button
                onClick={() => setShowModal(null)}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="bg-gray-50 dark:bg-slate-700 rounded-lg p-4 mb-4">
                <p className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Resumen</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Ingresos Totales</p>
                    <p className="text-sm font-semibold text-green-600 dark:text-green-400">${totalRevenue.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Total Ventas</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{sales.length}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Ingreso Promedio/Venta</p>
                    <p className="text-lg font-bold text-green-600 dark:text-green-400">${avgRevenuePerSale.toFixed(2)}</p>
                  </div>
                </div>
              </div>
              {sales.length === 0 ? (
                <p className="text-center text-gray-500 dark:text-gray-400 py-8">No hay datos de ventas</p>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">Ingreso por Venta</p>
                  {sales.map((sale) => (
                    <div key={sale.id} className="bg-gray-50 dark:bg-slate-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Fecha</p>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {new Date(sale.fecha).toLocaleDateString('es-AR')}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Producto</p>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{sale.producto}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Ingreso</p>
                          <p className="text-sm font-semibold text-green-600 dark:text-green-400">${sale.ingreso_neto.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Diferencia vs Promedio</p>
                          <p className={`text-sm font-medium ${sale.ingreso_neto >= avgRevenuePerSale ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            ${(sale.ingreso_neto - avgRevenuePerSale).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}


      {/* Modal de Configuración */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Configurar Métricas Visibles</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Selecciona qué métricas deseas mostrar en el dashboard</p>
              </div>
              <button
                onClick={() => setShowConfigModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="mb-4 flex gap-2">
                <button
                  onClick={selectAllMetrics}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Seleccionar Todas
                </button>
                <button
                  onClick={deselectAllMetrics}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Deseleccionar Todas
                </button>
              </div>
              <div className="space-y-3">
                {[
                  { key: 'kg-consumidos', label: 'Kg Consumidos' },
                  { key: 'costo-mp', label: 'Costo Total MP' },
                  { key: 'costo-mo', label: 'Costo Total MO' },
                  { key: 'costo-produccion', label: 'Costo Total Producción' },
                  { key: 'unidades-producidas', label: 'Unidades Producidas' },
                  { key: 'unidades-vendidas', label: 'Unidades Vendidas' },
                  { key: 'ingresos-netos', label: 'Ingresos Netos' },
                  { key: 'ganancia-total', label: 'Ganancia Total' },
                  { key: 'margen-ganancia', label: 'Margen de Ganancia' },
                  { key: 'ganancia-promedio', label: 'Ganancia Promedio/Unidad' },
                  { key: 'ingreso-promedio', label: 'Ingreso Promedio/Venta' },
                  { key: 'rentabilidad-media', label: 'Rentabilidad Media' },
                  { key: 'total-ventas', label: 'Total Ventas' },
                ].map((metric) => (
                  <label
                    key={metric.key}
                    className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-slate-700 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-600 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={visibleMetrics[metric.key] || false}
                      onChange={() => toggleMetric(metric.key)}
                      className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                    />
                    <span className="text-sm font-medium text-gray-900 dark:text-white flex-1">
                      {metric.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <button
                onClick={() => setShowConfigModal(false)}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                Guardar y Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
