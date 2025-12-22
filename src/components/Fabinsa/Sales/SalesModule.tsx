/**
 * Módulo de Ventas
 * Registro y gestión de ventas
 */

import { useState, useEffect } from 'react';
import { ShoppingCart, Plus, Trash2 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useTenant } from '../../../contexts/TenantContext';
import { Database } from '../../../lib/database.types';
import { calculateSaleValues } from '../../../lib/fabinsaCalculations';

type Sale = Database['public']['Tables']['sales']['Row'];
type SaleInsert = Database['public']['Tables']['sales']['Insert'];
type StockProduct = Database['public']['Tables']['stock_products']['Row'];
type ResaleProduct = Database['public']['Tables']['resale_products']['Row'];

export function SalesModule() {
  const { tenantId } = useTenant();
  const [sales, setSales] = useState<Sale[]>([]);
  const [fabricatedProducts, setFabricatedProducts] = useState<StockProduct[]>([]);
  const [resaleProducts, setResaleProducts] = useState<ResaleProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [productType, setProductType] = useState<'fabricado' | 'reventa'>('fabricado');
  
  const [formData, setFormData] = useState({
    producto: '',
    cantidad: '',
    precio_unitario: '',
    descuento_pct: '0',
    iib_pct: '0',
  });

  const [calculatedValues, setCalculatedValues] = useState({
    precio_final: 0,
    ingreso_bruto: 0,
    ingreso_neto: 0,
    ganancia_un: 0,
    ganancia_total: 0,
  });

  useEffect(() => {
    if (tenantId) {
      loadData();
    }
  }, [tenantId]);

  useEffect(() => {
    // Recalcular valores cuando cambian los inputs
    if (formData.precio_unitario && formData.cantidad) {
      const precio = parseFloat(formData.precio_unitario);
      const cantidad = parseInt(formData.cantidad);
      const iibPct = parseFloat(formData.iib_pct) || 0;
      const discountPct = parseFloat(formData.descuento_pct) || 0;

      // Obtener costo unitario del producto seleccionado
      let unitCost = 0;
      if (productType === 'fabricado') {
        const prod = fabricatedProducts.find(p => p.nombre === formData.producto);
        unitCost = prod?.costo_unit_total || 0;
      } else {
        const prod = resaleProducts.find(p => p.nombre === formData.producto);
        unitCost = prod?.costo_unitario_final || 0;
      }

      const values = calculateSaleValues(precio, cantidad, iibPct, discountPct, unitCost);
      setCalculatedValues(values);
    }
  }, [formData, productType, fabricatedProducts, resaleProducts]);

  const loadData = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      // Load sales
      const { data: salesData } = await supabase
        .from('sales')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('fecha', { ascending: false });
      setSales(salesData || []);

      // Load stock products
      const { data: prods } = await supabase
        .from('stock_products')
        .select('*')
        .eq('tenant_id', tenantId)
        .gt('cantidad', 0);
      setFabricatedProducts(prods || []);

      // Load resale products
      const { data: resale } = await supabase
        .from('resale_products')
        .select('*')
        .eq('tenant_id', tenantId)
        .gt('cantidad', 0);
      setResaleProducts(resale || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;

    try {
      const cantidad = parseInt(formData.cantidad);
      const precioUnitario = parseFloat(formData.precio_unitario);
      const iibPct = parseFloat(formData.iib_pct) || 0;
      const discountPct = parseFloat(formData.descuento_pct) || 0;

      // Obtener stock actual y costo
      let stockActual = 0;
      let unitCost = 0;
      let stockId = '';

      if (productType === 'fabricado') {
        const prod = fabricatedProducts.find(p => p.nombre === formData.producto);
        if (!prod) {
          alert('Producto no encontrado');
          return;
        }
        stockActual = prod.cantidad;
        unitCost = prod.costo_unit_total || 0;
        stockId = prod.id;
      } else {
        const prod = resaleProducts.find(p => p.nombre === formData.producto);
        if (!prod) {
          alert('Producto no encontrado');
          return;
        }
        stockActual = prod.cantidad;
        unitCost = prod.costo_unitario_final;
        stockId = prod.id;
      }

      if (cantidad > stockActual) {
        alert(`Stock insuficiente. Disponible: ${stockActual}`);
        return;
      }

      // Calcular valores
      const values = calculateSaleValues(precioUnitario, cantidad, iibPct, discountPct, unitCost);

      // Crear registro de venta
      const saleData: SaleInsert = {
        tenant_id: tenantId,
        fecha: new Date().toISOString(),
        producto: formData.producto,
        tipo_producto: productType,
        cantidad,
        precio_unitario: precioUnitario,
        descuento_pct: discountPct,
        iib_pct: iibPct,
        precio_final: values.precio_final,
        costo_unitario: unitCost,
        ingreso_bruto: values.ingreso_bruto,
        ingreso_neto: values.ingreso_neto,
        ganancia_un: values.ganancia_un,
        ganancia_total: values.ganancia_total,
        stock_antes: stockActual,
        stock_despues: stockActual - cantidad,
      };

      await supabase.from('sales').insert(saleData);

      // Actualizar stock
      if (productType === 'fabricado') {
        await supabase
          .from('stock_products')
          .update({ cantidad: stockActual - cantidad })
          .eq('id', stockId);
      } else {
        await supabase
          .from('resale_products')
          .update({ cantidad: stockActual - cantidad })
          .eq('id', stockId);
      }

      // Registrar movimiento
      await supabase.from('inventory_movements').insert({
        tenant_id: tenantId,
        tipo: productType === 'fabricado' ? 'egreso_fab' : 'egreso_pr',
        item_nombre: formData.producto,
        cantidad,
        motivo: 'Venta',
      });

      resetForm();
      loadData();
    } catch (error) {
      console.error('Error saving sale:', error);
      alert('Error al registrar la venta');
    }
  };

  const resetForm = () => {
    setFormData({
      producto: '',
      cantidad: '',
      precio_unitario: '',
      descuento_pct: '0',
      iib_pct: '0',
    });
    setCalculatedValues({
      precio_final: 0,
      ingreso_bruto: 0,
      ingreso_neto: 0,
      ganancia_un: 0,
      ganancia_total: 0,
    });
    setShowForm(false);
  };

  const availableProducts = productType === 'fabricado' ? fabricatedProducts : resaleProducts;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">Cargando datos...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 -mx-6 -mt-6 mb-6">
        <div className="flex items-center space-x-3 mb-2">
          <ShoppingCart className="w-6 h-6 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Ventas</h1>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300">Registro y gestión de ventas</p>
      </div>

      {/* Header with Add Button */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Registro de Ventas</h2>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          <span>Nueva Venta</span>
        </button>
      </div>

      {/* Sales Form */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Nueva Venta</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Tipo de Producto *</label>
                <select
                  value={productType}
                  onChange={(e) => {
                    setProductType(e.target.value as 'fabricado' | 'reventa');
                    setFormData({ ...formData, producto: '' });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="fabricado">Producto Fabricado</option>
                  <option value="reventa">Producto de Reventa</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Producto *</label>
                <select
                  required
                  value={formData.producto}
                  onChange={(e) => setFormData({ ...formData, producto: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Seleccione un producto</option>
                  {availableProducts.map((prod) => (
                    <option key={prod.id} value={prod.nombre}>
                      {prod.nombre} (Stock: {prod.cantidad})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Cantidad *</label>
                  <input
                    type="number"
                    required
                    value={formData.cantidad}
                    onChange={(e) => setFormData({ ...formData, cantidad: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Precio Unitario *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.precio_unitario}
                    onChange={(e) => setFormData({ ...formData, precio_unitario: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Mostrar costo unitario cuando hay un producto seleccionado */}
              {formData.producto && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Costo Unitario del Producto:</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      ${(() => {
                        let unitCost = 0;
                        if (productType === 'fabricado') {
                          const prod = fabricatedProducts.find(p => p.nombre === formData.producto);
                          unitCost = prod?.costo_unit_total || 0;
                        } else {
                          const prod = resaleProducts.find(p => p.nombre === formData.producto);
                          unitCost = prod?.costo_unitario_final || 0;
                        }
                        return unitCost.toFixed(2);
                      })()}
                    </span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">IIBB (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.iib_pct}
                    onChange={(e) => setFormData({ ...formData, iib_pct: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Descuento (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.descuento_pct}
                    onChange={(e) => setFormData({ ...formData, descuento_pct: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Calculated Values Display */}
              {calculatedValues.precio_final > 0 && (
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md space-y-2">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600 dark:text-gray-300">Costo Unitario:</span>
                      <span className="ml-2 font-semibold text-gray-700 dark:text-white">
                        ${(() => {
                          let unitCost = 0;
                          if (productType === 'fabricado') {
                            const prod = fabricatedProducts.find(p => p.nombre === formData.producto);
                            unitCost = prod?.costo_unit_total || 0;
                          } else {
                            const prod = resaleProducts.find(p => p.nombre === formData.producto);
                            unitCost = prod?.costo_unitario_final || 0;
                          }
                          return unitCost.toFixed(2);
                        })()}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-300">Precio Final:</span>
                      <span className="ml-2 font-semibold text-gray-900 dark:text-white">${calculatedValues.precio_final.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-300">Ingreso Bruto:</span>
                      <span className="ml-2 font-semibold text-gray-900 dark:text-white">${calculatedValues.ingreso_bruto.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-300">Ingreso Neto:</span>
                      <span className="ml-2 font-semibold text-green-600 dark:text-green-400">
                        ${calculatedValues.ingreso_neto.toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-300">Ganancia Total:</span>
                      <span className="ml-2 font-semibold text-green-600 dark:text-green-400">
                        ${calculatedValues.ganancia_total.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-3">
                <button type="button" onClick={resetForm} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
                  Cancelar
                </button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                  Registrar Venta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sales Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Fecha</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Producto</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Tipo</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Cantidad</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Precio Unit.</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Costo Unit.</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Ingreso Neto</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Ganancia</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {sales.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                  No hay ventas registradas
                </td>
              </tr>
            ) : (
              sales.map((sale) => (
                <tr key={sale.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {new Date(sale.fecha).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{sale.producto}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`px-2 py-1 rounded text-xs ${
                      sale.tipo_producto === 'fabricado' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300' : 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                    }`}>
                      {sale.tipo_producto}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{sale.cantidad}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">${sale.precio_unitario.toFixed(2)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300 font-medium">
                    ${sale.costo_unitario.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600 dark:text-green-400">
                    ${sale.ingreso_neto.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600 dark:text-green-400">
                    ${sale.ganancia_total.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                    <button
                      onClick={async () => {
                        if (confirm('¿Eliminar esta venta? Esto restaurará el stock.')) {
                          // Restaurar stock
                          if (sale.tipo_producto === 'fabricado') {
                            const { data: prod } = await supabase
                              .from('stock_products')
                              .select('*')
                              .eq('tenant_id', tenantId)
                              .ilike('nombre', sale.producto)
                              .limit(1);
                            if (prod && prod[0]) {
                              await supabase
                                .from('stock_products')
                                .update({ cantidad: prod[0].cantidad + sale.cantidad })
                                .eq('id', prod[0].id);
                            }
                          } else {
                            const { data: prod } = await supabase
                              .from('resale_products')
                              .select('*')
                              .eq('tenant_id', tenantId)
                              .ilike('nombre', sale.producto)
                              .limit(1);
                            if (prod && prod[0]) {
                              await supabase
                                .from('resale_products')
                                .update({ cantidad: prod[0].cantidad + sale.cantidad })
                                .eq('id', prod[0].id);
                            }
                          }
                          await supabase.from('sales').delete().eq('id', sale.id);
                          loadData();
                        }
                      }}
                      className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
