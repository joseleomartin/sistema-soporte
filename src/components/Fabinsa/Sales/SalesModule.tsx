/**
 * Módulo de Ventas
 * Registro y gestión de ventas
 */

import React, { useState, useEffect, useRef } from 'react';
import { ShoppingCart, Plus, Trash2, ChevronDown, X } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useTenant } from '../../../contexts/TenantContext';
import { Database } from '../../../lib/database.types';
import { calculateSaleValues } from '../../../lib/fabinsaCalculations';
import { useDepartmentPermissions } from '../../../hooks/useDepartmentPermissions';

type Sale = Database['public']['Tables']['sales']['Row'];
type SaleInsert = Database['public']['Tables']['sales']['Insert'];
type StockProduct = Database['public']['Tables']['stock_products']['Row'];
type ResaleProduct = Database['public']['Tables']['resale_products']['Row'];
type Client = Database['public']['Tables']['clients']['Row'];

interface SaleItem {
  id: string;
  producto: string;
  tipo_producto: 'fabricado' | 'reventa';
  cantidad: number;
  precio_unitario: number;
  descuento_pct: number;
  iib_pct: number;
  costo_unitario: number;
  precio_final: number;
  ingreso_bruto: number;
  ingreso_neto: number;
  ganancia_un: number;
  ganancia_total: number;
  stock_antes: number;
  stock_despues: number;
  stockId: string;
}

export function SalesModule() {
  const { tenantId } = useTenant();
  const { canCreate, canDelete } = useDepartmentPermissions();
  const [sales, setSales] = useState<Sale[]>([]);
  const [fabricatedProducts, setFabricatedProducts] = useState<StockProduct[]>([]);
  const [resaleProducts, setResaleProducts] = useState<ResaleProduct[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [productType, setProductType] = useState<'fabricado' | 'reventa'>('fabricado');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const clientInputRef = useRef<HTMLInputElement>(null);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  
  const [formData, setFormData] = useState({
    producto: '',
    cantidad: '',
    precio_unitario: '',
    descuento_pct: '0',
    iib_pct: '0',
    cliente: '',
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
        .order('fecha', { ascending: false })
        .order('created_at', { ascending: false });
      
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

      // Load clients
      const { data: clientsData } = await supabase
        .from('clients')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('nombre', { ascending: true });
      setClients(clientsData || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredClients = (searchTerm: string) => {
    if (!searchTerm) return clients;
    const term = searchTerm.toLowerCase();
    return clients.filter(c => 
      c.nombre.toLowerCase().includes(term) ||
      (c.razon_social && c.razon_social.toLowerCase().includes(term)) ||
      (c.cuit && c.cuit.includes(term))
    );
  };

  const handleAddProduct = () => {
    if (!formData.producto || !formData.cantidad || !formData.precio_unitario) {
      alert('Complete todos los campos requeridos');
      return;
    }

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

    // Verificar si ya existe el producto en la lista
    const existingItem = saleItems.find(item => item.producto === formData.producto && item.tipo_producto === productType);
    if (existingItem) {
      alert('Este producto ya está en la lista. Elimínelo primero si desea cambiarlo.');
      return;
    }

    // Calcular valores
    const values = calculateSaleValues(precioUnitario, cantidad, iibPct, discountPct, unitCost);

    // Agregar a la lista
    const newItem: SaleItem = {
      id: Date.now().toString(),
      producto: formData.producto,
      tipo_producto: productType,
      cantidad,
      precio_unitario: precioUnitario,
      descuento_pct: discountPct,
      iib_pct: iibPct,
      costo_unitario: unitCost,
      precio_final: values.precio_final,
      ingreso_bruto: values.ingreso_bruto,
      ingreso_neto: values.ingreso_neto,
      ganancia_un: values.ganancia_un,
      ganancia_total: values.ganancia_total,
      stock_antes: stockActual,
      stock_despues: stockActual - cantidad,
      stockId,
    };

    setSaleItems([...saleItems, newItem]);

    // Limpiar campos del producto (mantener cliente)
    setFormData({
      ...formData,
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
  };

  const handleRemoveItem = (id: string) => {
    setSaleItems(saleItems.filter(item => item.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;

    if (saleItems.length === 0) {
      alert('Agregue al menos un producto a la venta');
      return;
    }

    try {
      const fecha = new Date().toISOString();
      const cliente = formData.cliente || null;
      
      // Generar un order_id único para agrupar todos los productos de esta venta
      const orderId = crypto.randomUUID();

      // Crear registros de venta para cada producto con el mismo order_id
      for (const item of saleItems) {
        const saleData: SaleInsert & { order_id?: string } = {
          tenant_id: tenantId,
          fecha,
          producto: item.producto,
          tipo_producto: item.tipo_producto,
          cantidad: item.cantidad,
          precio_unitario: item.precio_unitario,
          descuento_pct: item.descuento_pct,
          iib_pct: item.iib_pct,
          precio_final: item.precio_final,
          costo_unitario: item.costo_unitario,
          ingreso_bruto: item.ingreso_bruto,
          ingreso_neto: item.ingreso_neto,
          ganancia_un: item.ganancia_un,
          ganancia_total: item.ganancia_total,
          stock_antes: item.stock_antes,
          stock_despues: item.stock_despues,
          cliente,
          order_id: orderId,
        } as any;

        await supabase.from('sales').insert(saleData);

        // Actualizar stock
        if (item.tipo_producto === 'fabricado') {
          await supabase
            .from('stock_products')
            .update({ cantidad: item.stock_despues })
            .eq('id', item.stockId);
        } else {
          await supabase
            .from('resale_products')
            .update({ cantidad: item.stock_despues })
            .eq('id', item.stockId);
        }

        // Registrar movimiento
        await supabase.from('inventory_movements').insert({
          tenant_id: tenantId,
          tipo: item.tipo_producto === 'fabricado' ? 'egreso_fab' : 'egreso_pr',
          item_nombre: item.producto,
          cantidad: item.cantidad,
          motivo: 'Venta',
        });
      }

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
      cliente: '',
    });
    setCalculatedValues({
      precio_final: 0,
      ingreso_bruto: 0,
      ingreso_neto: 0,
      ganancia_un: 0,
      ganancia_total: 0,
    });
    setSaleItems([]);
    setShowForm(false);
    setShowClientDropdown(false);
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
        {canCreate('fabinsa-sales') && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Venta</span>
          </button>
        )}
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
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                  Producto {saleItems.length === 0 ? '*' : ''}
                </label>
                <select
                  required={saleItems.length === 0}
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

              <div className="relative">
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Cliente</label>
                <div className="relative">
                  <input
                    ref={clientInputRef}
                    type="text"
                    value={formData.cliente}
                    onChange={(e) => {
                      setFormData({ ...formData, cliente: e.target.value });
                      setShowClientDropdown(e.target.value.length > 0 && getFilteredClients(e.target.value).length > 0);
                    }}
                    onFocus={() => {
                      if (getFilteredClients(formData.cliente).length > 0) {
                        setShowClientDropdown(true);
                      }
                    }}
                    onBlur={() => {
                      setTimeout(() => setShowClientDropdown(false), 200);
                    }}
                    className="w-full px-3 py-2 pr-8 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Escribe o selecciona un cliente"
                  />
                  <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
                  {showClientDropdown && getFilteredClients(formData.cliente).length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-auto">
                      {getFilteredClients(formData.cliente).map((client) => (
                        <button
                          key={client.id}
                          type="button"
                          onClick={() => {
                            setFormData({ ...formData, cliente: client.nombre });
                            setShowClientDropdown(false);
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-blue-50 dark:hover:bg-gray-700 focus:bg-blue-50 dark:focus:bg-gray-700 focus:outline-none text-gray-900 dark:text-white"
                        >
                          <div className="font-medium">{client.nombre}</div>
                          {client.razon_social && (
                            <div className="text-sm text-gray-500 dark:text-gray-400">{client.razon_social}</div>
                          )}
                          {client.cuit && (
                            <div className="text-xs text-gray-400 dark:text-gray-500">CUIT: {client.cuit}</div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                    Cantidad {saleItems.length === 0 ? '*' : ''}
                  </label>
                  <input
                    type="number"
                    required={saleItems.length === 0}
                    value={formData.cantidad}
                    onChange={(e) => setFormData({ ...formData, cantidad: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                    Precio Unitario {saleItems.length === 0 ? '*' : ''}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required={saleItems.length === 0}
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

              {/* Botón Agregar Producto */}
              {formData.producto && formData.cantidad && formData.precio_unitario && (
                <button
                  type="button"
                  onClick={handleAddProduct}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center justify-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Agregar Producto a la Venta</span>
                </button>
              )}

              {/* Mensaje informativo si ya hay productos */}
              {saleItems.length > 0 && !formData.producto && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-3">
                  <p className="text-sm text-blue-800 dark:text-blue-300">
                    ✓ Tienes {saleItems.length} producto{saleItems.length > 1 ? 's' : ''} agregado{saleItems.length > 1 ? 's' : ''}. Puedes agregar más productos o hacer clic en "Registrar Venta" para finalizar.
                  </p>
                </div>
              )}

              {/* Lista de Productos Agregados */}
              {saleItems.length > 0 && (
                <div className="border border-gray-300 dark:border-gray-600 rounded-md p-4">
                  <h4 className="text-sm font-semibold mb-3 text-gray-900 dark:text-white">Productos en la Venta ({saleItems.length})</h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {saleItems.map((item) => (
                      <div key={item.id} className="bg-gray-50 dark:bg-gray-700 p-3 rounded-md flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium text-gray-900 dark:text-white">{item.producto}</span>
                            <span className={`px-2 py-1 rounded text-xs ${
                              item.tipo_producto === 'fabricado' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300' : 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                            }`}>
                              {item.tipo_producto}
                            </span>
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            Cantidad: {item.cantidad} | Precio: ${item.precio_unitario.toFixed(2)} | Total: ${item.ingreso_neto.toFixed(2)}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          className="ml-2 text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-300 dark:border-gray-600">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Total Ingreso Neto:</span>
                      <span className="text-lg font-bold text-green-600 dark:text-green-400">
                        ${saleItems.reduce((sum, item) => sum + item.ingreso_neto, 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Total Ganancia:</span>
                      <span className="text-lg font-bold text-green-600 dark:text-green-400">
                        ${saleItems.reduce((sum, item) => sum + item.ganancia_total, 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-3">
                <button type="button" onClick={resetForm} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
                  Cancelar
                </button>
                {saleItems.length > 0 ? (
                  <button 
                    type="submit" 
                    className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-semibold shadow-lg"
                  >
                    ✓ Registrar Venta ({saleItems.length} producto{saleItems.length > 1 ? 's' : ''})
                  </button>
                ) : (
                  <button 
                    type="button" 
                    disabled
                    className="px-4 py-2 bg-gray-400 text-gray-200 rounded-md cursor-not-allowed"
                  >
                    Agregue al menos un producto
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sales Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Fecha</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Cliente</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Producto</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Tipo</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Cantidad</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Precio Unit.</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Costo Unit.</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Ingreso Neto</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Ganancia</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {sales.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                  No hay ventas registradas
                </td>
              </tr>
            ) : (
              (() => {
                // Agrupar ventas por order_id
                const groupedSales = sales.reduce((acc: any, sale: any) => {
                  if (sale.order_id) {
                    if (!acc[sale.order_id]) {
                      acc[sale.order_id] = {
                        order_id: sale.order_id,
                        fecha: sale.fecha,
                        cliente: sale.cliente,
                        items: [],
                        total_ingreso_neto: 0,
                        total_ganancia: 0,
                      };
                    }
                    acc[sale.order_id].items.push(sale);
                    acc[sale.order_id].total_ingreso_neto += sale.ingreso_neto;
                    acc[sale.order_id].total_ganancia += sale.ganancia_total;
                  } else {
                    // Ventas sin order_id (antiguas) se muestran individualmente
                    if (!acc.individual) acc.individual = [];
                    acc.individual.push(sale);
                  }
                  return acc;
                }, {});

                const orders = Object.values(groupedSales).filter((g: any) => g.order_id);
                const individualSales = groupedSales.individual || [];

                return (
                  <>
                    {/* Mostrar órdenes agrupadas */}
                    {orders.map((order: any) => {
                      const isExpanded = expandedOrders.has(order.order_id);
                      return (
                        <React.Fragment key={order.order_id}>
                          {/* Fila resumen de la orden */}
                          <tr className="bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30">
                            <td className="px-6 py-3 text-sm font-medium text-gray-900 dark:text-white">
                              {new Date(order.fecha).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-3 text-sm font-medium text-gray-900 dark:text-white">
                              {order.cliente || '-'}
                            </td>
                            <td className="px-6 py-3 text-sm font-medium text-gray-900 dark:text-white" colSpan={3}>
                              <button
                                onClick={() => {
                                  const newExpanded = new Set(expandedOrders);
                                  if (isExpanded) {
                                    newExpanded.delete(order.order_id);
                                  } else {
                                    newExpanded.add(order.order_id);
                                  }
                                  setExpandedOrders(newExpanded);
                                }}
                                className="flex items-center space-x-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                              >
                                <span>Orden con {order.items.length} producto{order.items.length > 1 ? 's' : ''}</span>
                                <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                              </button>
                            </td>
                            <td className="px-6 py-3 text-sm font-medium text-gray-900 dark:text-white" colSpan={2}>
                              Total
                            </td>
                            <td className="px-6 py-3 text-sm font-semibold text-green-600 dark:text-green-400">
                              ${order.total_ingreso_neto.toFixed(2)}
                            </td>
                            <td className="px-6 py-3 text-sm font-semibold text-green-600 dark:text-green-400">
                              ${order.total_ganancia.toFixed(2)}
                            </td>
                            <td className="px-6 py-3 text-right text-sm">
                              {canDelete('fabinsa-sales') && (
                                <button
                                  onClick={async () => {
                                    if (confirm(`¿Eliminar toda la orden con ${order.items.length} producto${order.items.length > 1 ? 's' : ''}? Esto restaurará el stock.`)) {
                                      for (const item of order.items) {
                                        // Restaurar stock
                                        if (item.tipo_producto === 'fabricado') {
                                          const { data: prod } = await supabase
                                            .from('stock_products')
                                            .select('*')
                                            .eq('tenant_id', tenantId)
                                            .ilike('nombre', item.producto)
                                            .limit(1);
                                          if (prod && prod[0]) {
                                            await supabase
                                              .from('stock_products')
                                              .update({ cantidad: prod[0].cantidad + item.cantidad })
                                              .eq('id', prod[0].id);
                                          }
                                        } else {
                                          const { data: prod } = await supabase
                                            .from('resale_products')
                                            .select('*')
                                            .eq('tenant_id', tenantId)
                                            .ilike('nombre', item.producto)
                                            .limit(1);
                                          if (prod && prod[0]) {
                                            await supabase
                                              .from('resale_products')
                                              .update({ cantidad: prod[0].cantidad + item.cantidad })
                                              .eq('id', prod[0].id);
                                          }
                                        }
                                      }
                                      await supabase.from('sales').delete().eq('order_id', order.order_id);
                                      loadData();
                                    }
                                  }}
                                  className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </td>
                          </tr>
                          {/* Filas de productos (si está expandida) */}
                          {isExpanded && order.items.map((item: any) => (
                            <tr key={item.id} className="bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800">
                              <td className="px-6 py-2 text-sm text-gray-600 dark:text-gray-400"></td>
                              <td className="px-6 py-2 text-sm text-gray-600 dark:text-gray-400"></td>
                              <td className="px-6 py-2 text-sm text-gray-900 dark:text-white pl-8">
                                • {item.producto}
                              </td>
                              <td className="px-6 py-2 text-sm">
                                <span className={`px-2 py-1 rounded text-xs ${
                                  item.tipo_producto === 'fabricado' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300' : 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                                }`}>
                                  {item.tipo_producto}
                                </span>
                              </td>
                              <td className="px-6 py-2 text-sm text-gray-900 dark:text-white">{item.cantidad}</td>
                              <td className="px-6 py-2 text-sm text-gray-900 dark:text-white">${item.precio_unitario.toFixed(2)}</td>
                              <td className="px-6 py-2 text-sm text-gray-700 dark:text-gray-300">${item.costo_unitario.toFixed(2)}</td>
                              <td className="px-6 py-2 text-sm text-green-600 dark:text-green-400">${item.ingreso_neto.toFixed(2)}</td>
                              <td className="px-6 py-2 text-sm text-green-600 dark:text-green-400">${item.ganancia_total.toFixed(2)}</td>
                              <td className="px-6 py-2 text-sm"></td>
                            </tr>
                          ))}
                        </React.Fragment>
                      );
                    })}
                    {/* Mostrar ventas individuales (sin order_id) */}
                    {individualSales.map((sale: any) => (
                      <tr key={sale.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {new Date(sale.fecha).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {sale.cliente || '-'}
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
                          {canDelete('fabinsa-sales') && (
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
                          )}
                        </td>
                      </tr>
                    ))}
                  </>
                );
              })()
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
