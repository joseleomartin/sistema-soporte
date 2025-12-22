/**
 * Módulo de Stock
 * Gestión de inventario: Materia Prima, Productos Fabricados, Productos de Reventa
 */

import { useState, useEffect } from 'react';
import { Package, Plus, Edit, Trash2, Save, X, Upload, Download, History, Calendar, DollarSign, Truck } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useTenant } from '../../../contexts/TenantContext';
import { Database } from '../../../lib/database.types';
import { parseProductName } from '../../../lib/fabinsaCalculations';

type PurchaseMaterial = Database['public']['Tables']['purchases_materials']['Row'];
type PurchaseProduct = Database['public']['Tables']['purchases_products']['Row'];
type InventoryMovement = Database['public']['Tables']['inventory_movements']['Row'];

type StockMaterial = Database['public']['Tables']['stock_materials']['Row'];
type StockMaterialInsert = Database['public']['Tables']['stock_materials']['Insert'];
type StockProduct = Database['public']['Tables']['stock_products']['Row'];
type StockProductInsert = Database['public']['Tables']['stock_products']['Insert'];
type ResaleProduct = Database['public']['Tables']['resale_products']['Row'];
type ResaleProductInsert = Database['public']['Tables']['resale_products']['Insert'];

type TabType = 'materials' | 'products' | 'resale';

export function StockModule() {
  const { tenantId } = useTenant();
  const [activeTab, setActiveTab] = useState<TabType>('materials');
  
  // Materia Prima
  const [materials, setMaterials] = useState<StockMaterial[]>([]);
  const [showMaterialForm, setShowMaterialForm] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<StockMaterial | null>(null);
  const [materialForm, setMaterialForm] = useState({
    nombre: '',
    material: '',
    kg: '',
    costo_kilo_usd: '',
    valor_dolar: '1',
    moneda: 'ARS' as 'ARS' | 'USD',
  });

  // Productos Fabricados
  const [products, setProducts] = useState<StockProduct[]>([]);
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<StockProduct | null>(null);
  const [productForm, setProductForm] = useState({
    nombre: '',
    cantidad: '',
    peso_unidad: '',
    costo_unit_total: '',
  });

  // Productos de Reventa
  const [resaleProducts, setResaleProducts] = useState<ResaleProduct[]>([]);
  const [showResaleForm, setShowResaleForm] = useState(false);
  const [editingResale, setEditingResale] = useState<ResaleProduct | null>(null);
  const [resaleForm, setResaleForm] = useState({
    nombre: '',
    cantidad: '',
    costo_unitario: '',
    otros_costos: '0',
    moneda: 'ARS' as 'ARS' | 'USD',
    valor_dolar: '',
  });

  const [loading, setLoading] = useState(true);

  // Modal de movimientos - Materia Prima
  const [selectedMaterial, setSelectedMaterial] = useState<StockMaterial | null>(null);
  const [showMovementsModal, setShowMovementsModal] = useState(false);
  const [materialPurchases, setMaterialPurchases] = useState<PurchaseMaterial[]>([]);
  const [inventoryMovements, setInventoryMovements] = useState<InventoryMovement[]>([]);
  const [loadingMovements, setLoadingMovements] = useState(false);

  // Modal de movimientos - Productos de Reventa
  const [selectedResaleProduct, setSelectedResaleProduct] = useState<ResaleProduct | null>(null);
  const [showResaleMovementsModal, setShowResaleMovementsModal] = useState(false);
  const [productPurchases, setProductPurchases] = useState<PurchaseProduct[]>([]);
  const [resaleInventoryMovements, setResaleInventoryMovements] = useState<InventoryMovement[]>([]);
  const [loadingResaleMovements, setLoadingResaleMovements] = useState(false);

  useEffect(() => {
    if (tenantId) {
      loadAllStock();
    }
  }, [tenantId]);

  const loadMaterialMovements = async (material: StockMaterial) => {
    if (!tenantId) return;
    setLoadingMovements(true);
    try {
      // Cargar compras relacionadas con esta materia prima
      const { data: purchases, error: purchasesError } = await supabase
        .from('purchases_materials')
        .select('*')
        .eq('tenant_id', tenantId)
        .ilike('material', material.material)
        .order('fecha', { ascending: false });

      if (purchasesError) throw purchasesError;
      setMaterialPurchases(purchases || []);

      // Cargar movimientos de inventario relacionados
      const { data: movements, error: movementsError } = await supabase
        .from('inventory_movements')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('tipo', 'ingreso_mp')
        .ilike('item_nombre', material.nombre)
        .order('created_at', { ascending: false });

      if (movementsError) throw movementsError;
      setInventoryMovements(movements || []);
    } catch (error) {
      console.error('Error loading movements:', error);
    } finally {
      setLoadingMovements(false);
    }
  };

  const openMovementsModal = async (material: StockMaterial) => {
    setSelectedMaterial(material);
    setShowMovementsModal(true);
    await loadMaterialMovements(material);
  };

  const loadResaleProductMovements = async (product: ResaleProduct) => {
    if (!tenantId) return;
    setLoadingResaleMovements(true);
    try {
      // Cargar compras relacionadas con este producto de reventa
      const { data: purchases, error: purchasesError } = await supabase
        .from('purchases_products')
        .select('*')
        .eq('tenant_id', tenantId)
        .ilike('producto', product.nombre)
        .order('fecha', { ascending: false });

      if (purchasesError) throw purchasesError;
      setProductPurchases(purchases || []);

      // Cargar movimientos de inventario relacionados
      const { data: movements, error: movementsError } = await supabase
        .from('inventory_movements')
        .select('*')
        .eq('tenant_id', tenantId)
        .in('tipo', ['ingreso_pr', 'egreso_pr'])
        .ilike('item_nombre', product.nombre)
        .order('created_at', { ascending: false });

      if (movementsError) throw movementsError;
      setResaleInventoryMovements(movements || []);
    } catch (error) {
      console.error('Error loading resale movements:', error);
    } finally {
      setLoadingResaleMovements(false);
    }
  };

  const openResaleMovementsModal = async (product: ResaleProduct) => {
    setSelectedResaleProduct(product);
    setShowResaleMovementsModal(true);
    await loadResaleProductMovements(product);
  };

  const loadAllStock = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      // Load materials
      const { data: mats } = await supabase
        .from('stock_materials')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });
      setMaterials(mats || []);

      // Load products
      const { data: prods } = await supabase
        .from('stock_products')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });
      setProducts(prods || []);

      // Load resale products
      const { data: resale } = await supabase
        .from('resale_products')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });
      setResaleProducts(resale || []);
    } catch (error) {
      console.error('Error loading stock:', error);
    } finally {
      setLoading(false);
    }
  };

  // Materia Prima handlers
  const handleMaterialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;

    try {
      const data: StockMaterialInsert = {
        tenant_id: tenantId,
        nombre: materialForm.nombre,
        material: materialForm.material,
        kg: parseFloat(materialForm.kg),
        costo_kilo_usd: parseFloat(materialForm.costo_kilo_usd),
        valor_dolar: parseFloat(materialForm.valor_dolar),
        moneda: materialForm.moneda,
      };

      if (editingMaterial) {
        await supabase.from('stock_materials').update(data).eq('id', editingMaterial.id);
      } else {
        await supabase.from('stock_materials').insert(data);
      }

      resetMaterialForm();
      loadAllStock();
    } catch (error) {
      console.error('Error saving material:', error);
      alert('Error al guardar');
    }
  };

  const resetMaterialForm = () => {
    setMaterialForm({
      nombre: '',
      material: '',
      kg: '',
      costo_kilo_usd: '',
      valor_dolar: '1',
      moneda: 'ARS',
    });
    setEditingMaterial(null);
    setShowMaterialForm(false);
  };

  // Productos Fabricados handlers
  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;

    try {
      const data: StockProductInsert = {
        tenant_id: tenantId,
        nombre: productForm.nombre,
        cantidad: parseInt(productForm.cantidad),
        peso_unidad: parseFloat(productForm.peso_unidad),
        costo_unit_total: productForm.costo_unit_total ? parseFloat(productForm.costo_unit_total) : null,
      };

      if (editingProduct) {
        await supabase.from('stock_products').update(data).eq('id', editingProduct.id);
      } else {
        await supabase.from('stock_products').insert(data);
      }

      resetProductForm();
      loadAllStock();
    } catch (error) {
      console.error('Error saving product:', error);
      alert('Error al guardar');
    }
  };

  const resetProductForm = () => {
    setProductForm({
      nombre: '',
      cantidad: '',
      peso_unidad: '',
      costo_unit_total: '',
    });
    setEditingProduct(null);
    setShowProductForm(false);
  };

  // Productos de Reventa handlers
  const handleResaleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;

    try {
      const costo_unitario = parseFloat(resaleForm.costo_unitario);
      const otros_costos = parseFloat(resaleForm.otros_costos) || 0;
      const costo_unitario_final = costo_unitario + otros_costos;

      const data: ResaleProductInsert = {
        tenant_id: tenantId,
        nombre: resaleForm.nombre,
        cantidad: parseInt(resaleForm.cantidad),
        costo_unitario,
        otros_costos,
        costo_unitario_final,
        moneda: resaleForm.moneda,
        valor_dolar: resaleForm.valor_dolar ? parseFloat(resaleForm.valor_dolar) : null,
      };

      if (editingResale) {
        await supabase.from('resale_products').update(data).eq('id', editingResale.id);
      } else {
        await supabase.from('resale_products').insert(data);
      }

      resetResaleForm();
      loadAllStock();
    } catch (error) {
      console.error('Error saving resale product:', error);
      alert('Error al guardar');
    }
  };

  const resetResaleForm = () => {
    setResaleForm({
      nombre: '',
      cantidad: '',
      costo_unitario: '',
      otros_costos: '0',
      moneda: 'ARS',
      valor_dolar: '',
    });
    setEditingResale(null);
    setShowResaleForm(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">Cargando stock...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 -mx-6 -mt-6 mb-6">
        <div className="flex items-center space-x-3 mb-2">
          <Package className="w-6 h-6 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Stock</h1>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300">Gestión de inventario: Materia Prima, Productos Fabricados, Productos de Reventa</p>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 mb-6">
        <div className="flex space-x-1">
          {[
            { id: 'materials' as TabType, label: 'Materia Prima' },
            { id: 'products' as TabType, label: 'Productos Fabricados' },
            { id: 'resale' as TabType, label: 'Productos de Reventa' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Materia Prima Tab */}
      {activeTab === 'materials' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Materia Prima</h2>
            <button
              onClick={() => setShowMaterialForm(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              <span>Agregar</span>
            </button>
          </div>

          {/* Material Form */}
          {showMaterialForm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {editingMaterial ? 'Editar Materia Prima' : 'Nueva Materia Prima'}
                  </h3>
                  <button onClick={resetMaterialForm} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <form onSubmit={handleMaterialSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Nombre *</label>
                      <input
                        type="text"
                        required
                        value={materialForm.nombre}
                        onChange={(e) => setMaterialForm({ ...materialForm, nombre: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Material *</label>
                      <input
                        type="text"
                        required
                        value={materialForm.material}
                        onChange={(e) => setMaterialForm({ ...materialForm, material: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Cantidad (kg) *</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={materialForm.kg}
                        onChange={(e) => setMaterialForm({ ...materialForm, kg: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Costo por kg *</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={materialForm.costo_kilo_usd}
                        onChange={(e) => setMaterialForm({ ...materialForm, costo_kilo_usd: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Moneda</label>
                      <select
                        value={materialForm.moneda}
                        onChange={(e) => setMaterialForm({ ...materialForm, moneda: e.target.value as 'ARS' | 'USD' })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="ARS">ARS</option>
                        <option value="USD">USD</option>
                      </select>
                    </div>
                  </div>
                  {materialForm.moneda === 'USD' && (
                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Valor del Dólar *</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={materialForm.valor_dolar}
                        onChange={(e) => setMaterialForm({ ...materialForm, valor_dolar: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                  )}
                  <div className="flex justify-end space-x-3">
                    <button type="button" onClick={resetMaterialForm} className="px-4 py-2 border rounded-md">
                      Cancelar
                    </button>
                    <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md">
                      Guardar
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Materials Table */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Nombre</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Material</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Cantidad (kg)</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Costo/kg</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Moneda</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {materials.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                      No hay materia prima registrada
                    </td>
                  </tr>
                ) : (
                  materials.map((mat) => (
                    <tr key={mat.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => openMovementsModal(mat)}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 hover:underline font-medium"
                        >
                          {mat.nombre}
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{mat.material}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{mat.kg.toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">${mat.costo_kilo_usd.toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{mat.moneda}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => {
                              setEditingMaterial(mat);
                              setMaterialForm({
                                nombre: mat.nombre,
                                material: mat.material,
                                kg: mat.kg.toString(),
                                costo_kilo_usd: mat.costo_kilo_usd.toString(),
                                valor_dolar: mat.valor_dolar.toString(),
                                moneda: mat.moneda,
                              });
                              setShowMaterialForm(true);
                            }}
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={async () => {
                              if (confirm('¿Eliminar?')) {
                                await supabase.from('stock_materials').delete().eq('id', mat.id);
                                loadAllStock();
                              }
                            }}
                            className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Modal de Movimientos */}
          {showMovementsModal && selectedMaterial && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-semibold flex items-center space-x-2 text-gray-900 dark:text-white">
                      <History className="w-5 h-5 text-blue-600" />
                      <span>Movimientos de {selectedMaterial.nombre}</span>
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                      Historial de compras y movimientos de inventario
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setShowMovementsModal(false);
                      setSelectedMaterial(null);
                      setMaterialPurchases([]);
                      setInventoryMovements([]);
                    }}
                    className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                  {loadingMovements ? (
                    <div className="text-center py-8">
                      <div className="text-gray-500 dark:text-gray-400">Cargando movimientos...</div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Compras */}
                      <div>
                        <h4 className="text-md font-semibold mb-4 flex items-center space-x-2 text-gray-900 dark:text-white">
                          <Truck className="w-4 h-4 text-blue-600" />
                          <span>Compras de Materia Prima</span>
                        </h4>
                        {materialPurchases.length === 0 ? (
                          <p className="text-sm text-gray-500 dark:text-gray-400 py-4">No hay compras registradas para esta materia prima</p>
                        ) : (
                          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg overflow-hidden">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
                              <thead className="bg-gray-100 dark:bg-gray-600">
                                <tr>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Fecha</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Proveedor</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Cantidad (kg)</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Precio Unitario</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Moneda</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Total</th>
                                </tr>
                              </thead>
                              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                {materialPurchases.map((purchase) => (
                                  <tr key={purchase.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                      <div className="flex items-center space-x-1">
                                        <Calendar className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                                        <span>{new Date(purchase.fecha).toLocaleDateString('es-AR')}</span>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{purchase.proveedor}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">{purchase.cantidad.toFixed(2)}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                      {purchase.moneda === 'USD' && purchase.valor_dolar ? (
                                        <div className="flex items-center space-x-1">
                                          <DollarSign className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                                          <span>${(purchase.precio / purchase.valor_dolar).toFixed(2)} USD</span>
                                        </div>
                                      ) : (
                                        <div className="flex items-center space-x-1">
                                          <DollarSign className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                                          <span>${purchase.precio.toFixed(2)} ARS</span>
                                        </div>
                                      )}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                                      <span className={`px-2 py-1 rounded text-xs ${
                                        purchase.moneda === 'USD' 
                                          ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' 
                                          : 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                                      }`}>
                                        {purchase.moneda}
                                      </span>
                                      {purchase.moneda === 'USD' && purchase.valor_dolar && (
                                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                          Dólar: ${purchase.valor_dolar.toFixed(2)}
                                        </div>
                                      )}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-white">
                                      ${purchase.total.toFixed(2)} ARS
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>

                      {/* Movimientos de Inventario */}
                      <div>
                        <h4 className="text-md font-semibold mb-4 flex items-center space-x-2 text-gray-900 dark:text-white">
                          <History className="w-4 h-4 text-blue-600" />
                          <span>Movimientos de Inventario</span>
                        </h4>
                        {inventoryMovements.length === 0 ? (
                          <p className="text-sm text-gray-500 dark:text-gray-400 py-4">No hay movimientos de inventario registrados</p>
                        ) : (
                          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg overflow-hidden">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
                              <thead className="bg-gray-100 dark:bg-gray-600">
                                <tr>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Fecha</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Tipo</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Cantidad (kg)</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Motivo</th>
                                </tr>
                              </thead>
                              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                {inventoryMovements.map((movement) => (
                                  <tr key={movement.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                      <div className="flex items-center space-x-1">
                                        <Calendar className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                                        <span>{new Date(movement.created_at).toLocaleDateString('es-AR')}</span>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                                      <span className={`px-2 py-1 rounded text-xs ${
                                        movement.tipo === 'ingreso_mp' 
                                          ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' 
                                          : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                                      }`}>
                                        {movement.tipo === 'ingreso_mp' ? 'Ingreso' : 'Egreso'}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                      {movement.cantidad.toFixed(2)}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                                      {movement.motivo || '-'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Productos Fabricados Tab */}
      {activeTab === 'products' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Productos Fabricados</h2>
            <button
              onClick={() => setShowProductForm(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              <span>Agregar</span>
            </button>
          </div>

          {/* Product Form */}
          {showProductForm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {editingProduct ? 'Editar Producto' : 'Nuevo Producto Fabricado'}
                  </h3>
                  <button onClick={resetProductForm} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <form onSubmit={handleProductSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Nombre *</label>
                    <input
                      type="text"
                      required
                      value={productForm.nombre}
                      onChange={(e) => setProductForm({ ...productForm, nombre: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Cantidad *</label>
                      <input
                        type="number"
                        required
                        value={productForm.cantidad}
                        onChange={(e) => setProductForm({ ...productForm, cantidad: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Peso por unidad (kg) *</label>
                      <input
                        type="number"
                        step="0.00001"
                        required
                        value={productForm.peso_unidad}
                        onChange={(e) => setProductForm({ ...productForm, peso_unidad: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Costo unitario total</label>
                      <input
                        type="number"
                        step="0.01"
                        value={productForm.costo_unit_total}
                        onChange={(e) => setProductForm({ ...productForm, costo_unit_total: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end space-x-3">
                    <button type="button" onClick={resetProductForm} className="px-4 py-2 border rounded-md">
                      Cancelar
                    </button>
                    <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md">
                      Guardar
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Products Table */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Nombre</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Cantidad</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Peso/unidad (kg)</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Costo unitario</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                      No hay productos fabricados registrados
                    </td>
                  </tr>
                ) : (
                  products.map((prod) => (
                    <tr key={prod.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{prod.nombre}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{prod.cantidad}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{prod.peso_unidad.toFixed(5)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {prod.costo_unit_total ? `$${prod.costo_unit_total.toFixed(2)}` : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => {
                              setEditingProduct(prod);
                              setProductForm({
                                nombre: prod.nombre,
                                cantidad: prod.cantidad.toString(),
                                peso_unidad: prod.peso_unidad.toString(),
                                costo_unit_total: prod.costo_unit_total?.toString() || '',
                              });
                              setShowProductForm(true);
                            }}
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={async () => {
                              if (confirm('¿Eliminar?')) {
                                await supabase.from('stock_products').delete().eq('id', prod.id);
                                loadAllStock();
                              }
                            }}
                            className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Productos de Reventa Tab */}
      {activeTab === 'resale' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Productos de Reventa</h2>
            <button
              onClick={() => setShowResaleForm(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              <span>Agregar</span>
            </button>
          </div>

          {/* Resale Form */}
          {showResaleForm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {editingResale ? 'Editar Producto' : 'Nuevo Producto de Reventa'}
                  </h3>
                  <button onClick={resetResaleForm} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <form onSubmit={handleResaleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Nombre *</label>
                    <input
                      type="text"
                      required
                      value={resaleForm.nombre}
                      onChange={(e) => setResaleForm({ ...resaleForm, nombre: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Cantidad *</label>
                      <input
                        type="number"
                        required
                        value={resaleForm.cantidad}
                        onChange={(e) => setResaleForm({ ...resaleForm, cantidad: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Costo unitario *</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={resaleForm.costo_unitario}
                        onChange={(e) => setResaleForm({ ...resaleForm, costo_unitario: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Otros costos</label>
                      <input
                        type="number"
                        step="0.01"
                        value={resaleForm.otros_costos}
                        onChange={(e) => setResaleForm({ ...resaleForm, otros_costos: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Moneda</label>
                      <select
                        value={resaleForm.moneda}
                        onChange={(e) => setResaleForm({ ...resaleForm, moneda: e.target.value as 'ARS' | 'USD' })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="ARS">ARS</option>
                        <option value="USD">USD</option>
                      </select>
                    </div>
                    {resaleForm.moneda === 'USD' && (
                      <div>
                        <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Valor del Dólar</label>
                        <input
                          type="number"
                          step="0.01"
                          value={resaleForm.valor_dolar}
                          onChange={(e) => setResaleForm({ ...resaleForm, valor_dolar: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                      </div>
                    )}
                  </div>
                  <div className="flex justify-end space-x-3">
                    <button type="button" onClick={resetResaleForm} className="px-4 py-2 border rounded-md">
                      Cancelar
                    </button>
                    <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md">
                      Guardar
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Resale Products Table */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Nombre</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Cantidad</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Costo unitario</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Costo final</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Moneda</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {resaleProducts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                      No hay productos de reventa registrados
                    </td>
                  </tr>
                ) : (
                  resaleProducts.map((prod) => (
                    <tr key={prod.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => openResaleMovementsModal(prod)}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 hover:underline font-medium"
                        >
                          {prod.nombre}
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{prod.cantidad}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">${prod.costo_unitario.toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">${prod.costo_unitario_final.toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{prod.moneda}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => {
                              setEditingResale(prod);
                              setResaleForm({
                                nombre: prod.nombre,
                                cantidad: prod.cantidad.toString(),
                                costo_unitario: prod.costo_unitario.toString(),
                                otros_costos: prod.otros_costos.toString(),
                                moneda: prod.moneda,
                                valor_dolar: prod.valor_dolar?.toString() || '',
                              });
                              setShowResaleForm(true);
                            }}
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={async () => {
                              if (confirm('¿Eliminar?')) {
                                await supabase.from('resale_products').delete().eq('id', prod.id);
                                loadAllStock();
                              }
                            }}
                            className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Modal de Movimientos - Productos de Reventa */}
          {showResaleMovementsModal && selectedResaleProduct && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-semibold flex items-center space-x-2 text-gray-900 dark:text-white">
                      <History className="w-5 h-5 text-blue-600" />
                      <span>Movimientos de {selectedResaleProduct.nombre}</span>
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                      Historial de compras y movimientos de inventario
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setShowResaleMovementsModal(false);
                      setSelectedResaleProduct(null);
                      setProductPurchases([]);
                      setResaleInventoryMovements([]);
                    }}
                    className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                  {loadingResaleMovements ? (
                    <div className="text-center py-8">
                      <div className="text-gray-500 dark:text-gray-400">Cargando movimientos...</div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Compras */}
                      <div>
                        <h4 className="text-md font-semibold mb-4 flex items-center space-x-2 text-gray-900 dark:text-white">
                          <Truck className="w-4 h-4 text-blue-600" />
                          <span>Compras de Productos</span>
                        </h4>
                        {productPurchases.length === 0 ? (
                          <p className="text-sm text-gray-500 dark:text-gray-400 py-4">No hay compras registradas para este producto</p>
                        ) : (
                          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg overflow-hidden">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
                              <thead className="bg-gray-100 dark:bg-gray-600">
                                <tr>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Fecha</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Proveedor</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Cantidad</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Precio Unitario</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Moneda</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Total</th>
                                </tr>
                              </thead>
                              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                {productPurchases.map((purchase) => (
                                  <tr key={purchase.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                      <div className="flex items-center space-x-1">
                                        <Calendar className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                                        <span>{new Date(purchase.fecha).toLocaleDateString('es-AR')}</span>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{purchase.proveedor}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">{purchase.cantidad}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                      {purchase.moneda === 'USD' && purchase.valor_dolar ? (
                                        <div className="flex items-center space-x-1">
                                          <DollarSign className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                                          <span>${(purchase.precio / purchase.valor_dolar).toFixed(2)} USD</span>
                                        </div>
                                      ) : (
                                        <div className="flex items-center space-x-1">
                                          <DollarSign className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                                          <span>${purchase.precio.toFixed(2)} ARS</span>
                                        </div>
                                      )}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                                      <span className={`px-2 py-1 rounded text-xs ${
                                        purchase.moneda === 'USD' 
                                          ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' 
                                          : 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                                      }`}>
                                        {purchase.moneda}
                                      </span>
                                      {purchase.moneda === 'USD' && purchase.valor_dolar && (
                                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                          Dólar: ${purchase.valor_dolar.toFixed(2)}
                                        </div>
                                      )}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-white">
                                      ${purchase.total.toFixed(2)} ARS
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>

                      {/* Movimientos de Inventario */}
                      <div>
                        <h4 className="text-md font-semibold mb-4 flex items-center space-x-2 text-gray-900 dark:text-white">
                          <History className="w-4 h-4 text-blue-600" />
                          <span>Movimientos de Inventario</span>
                        </h4>
                        {resaleInventoryMovements.length === 0 ? (
                          <p className="text-sm text-gray-500 dark:text-gray-400 py-4">No hay movimientos de inventario registrados</p>
                        ) : (
                          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg overflow-hidden">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
                              <thead className="bg-gray-100 dark:bg-gray-600">
                                <tr>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Fecha</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Tipo</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Cantidad</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Motivo</th>
                                </tr>
                              </thead>
                              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                {resaleInventoryMovements.map((movement) => (
                                  <tr key={movement.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                      <div className="flex items-center space-x-1">
                                        <Calendar className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                                        <span>{new Date(movement.created_at).toLocaleDateString('es-AR')}</span>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                                      <span className={`px-2 py-1 rounded text-xs ${
                                        movement.tipo === 'ingreso_pr' 
                                          ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' 
                                          : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                                      }`}>
                                        {movement.tipo === 'ingreso_pr' ? 'Ingreso' : 'Egreso'}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                      {movement.cantidad.toFixed(2)}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                                      {movement.motivo || '-'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
