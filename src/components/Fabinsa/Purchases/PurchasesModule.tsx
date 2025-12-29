/**
 * Módulo de Compras
 * Registro de compras de materia prima y productos
 */

import { useState, useEffect, useRef } from 'react';
import { TrendingUp, Plus, Edit, Trash2, Save, X, ChevronDown } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useTenant } from '../../../contexts/TenantContext';
import { Database } from '../../../lib/database.types';
import { useDepartmentPermissions } from '../../../hooks/useDepartmentPermissions';

type PurchaseMaterial = Database['public']['Tables']['purchases_materials']['Row'];
type PurchaseMaterialInsert = Database['public']['Tables']['purchases_materials']['Insert'];
type PurchaseProduct = Database['public']['Tables']['purchases_products']['Row'];
type PurchaseProductInsert = Database['public']['Tables']['purchases_products']['Insert'];
type Supplier = Database['public']['Tables']['suppliers']['Row'];

type TabType = 'materials' | 'products';

export function PurchasesModule() {
  const { tenantId } = useTenant();
  const { canCreate, canEdit, canDelete } = useDepartmentPermissions();
  const [activeTab, setActiveTab] = useState<TabType>('materials');
  
  // Compras de Materia Prima
  const [materialPurchases, setMaterialPurchases] = useState<PurchaseMaterial[]>([]);
  const [showMaterialForm, setShowMaterialForm] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<PurchaseMaterial | null>(null);
  const [materialForm, setMaterialForm] = useState({
    fecha: new Date().toISOString().split('T')[0],
    material: '',
    cantidad: '',
    precio: '',
    proveedor: '',
    moneda: 'ARS' as 'ARS' | 'USD',
    valor_dolar: '',
  });

  // Compras de Productos
  const [productPurchases, setProductPurchases] = useState<PurchaseProduct[]>([]);
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<PurchaseProduct | null>(null);
  const [productForm, setProductForm] = useState({
    fecha: new Date().toISOString().split('T')[0],
    producto: '',
    cantidad: '',
    precio: '',
    proveedor: '',
    moneda: 'ARS' as 'ARS' | 'USD',
    valor_dolar: '',
  });

  const [loading, setLoading] = useState(true);
  
  // Proveedores para combobox
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [showSupplierDropdownMaterial, setShowSupplierDropdownMaterial] = useState(false);
  const [showSupplierDropdownProduct, setShowSupplierDropdownProduct] = useState(false);
  const supplierInputRefMaterial = useRef<HTMLInputElement>(null);
  const supplierInputRefProduct = useRef<HTMLInputElement>(null);

  // Materiales del stock para dropdown
  type StockMaterial = Database['public']['Tables']['stock_materials']['Row'];
  const [stockMaterials, setStockMaterials] = useState<StockMaterial[]>([]);
  const [showMaterialDropdown, setShowMaterialDropdown] = useState(false);
  const materialInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (tenantId) {
      loadPurchases();
      loadSuppliers();
      loadStockMaterials();
    }
  }, [tenantId]);

  const loadStockMaterials = async () => {
    if (!tenantId) return;
    try {
      const { data, error } = await supabase
        .from('stock_materials')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('nombre', { ascending: true });

      if (error) throw error;
      setStockMaterials(data || []);
    } catch (error) {
      console.error('Error loading stock materials:', error);
    }
  };

  const loadSuppliers = async () => {
    if (!tenantId) return;
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('nombre', { ascending: true });

      if (error) throw error;
      setSuppliers(data || []);
    } catch (error) {
      console.error('Error loading suppliers:', error);
    }
  };

  const getFilteredSuppliers = (searchTerm: string) => {
    if (!searchTerm) return suppliers;
    const term = searchTerm.toLowerCase();
    return suppliers.filter(s => 
      s.nombre.toLowerCase().includes(term) ||
      (s.razon_social && s.razon_social.toLowerCase().includes(term)) ||
      (s.cuit && s.cuit.includes(term))
    );
  };

  const getFilteredMaterials = (searchTerm: string) => {
    if (!searchTerm) return stockMaterials;
    const term = searchTerm.toLowerCase();
    return stockMaterials.filter(m => 
      m.material.toLowerCase().includes(term) ||
      m.nombre.toLowerCase().includes(term)
    );
  };

  const loadPurchases = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const { data: mats } = await supabase
        .from('purchases_materials')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('fecha', { ascending: false });
      setMaterialPurchases(mats || []);

      const { data: prods } = await supabase
        .from('purchases_products')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('fecha', { ascending: false });
      setProductPurchases(prods || []);
    } catch (error) {
      console.error('Error loading purchases:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMaterialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;

    try {
      const cantidad = parseFloat(materialForm.cantidad);
      const precio = parseFloat(materialForm.precio);
      const valorDolar = materialForm.moneda === 'USD' ? parseFloat(materialForm.valor_dolar) : 1;
      const precioARS = materialForm.moneda === 'USD' ? precio * valorDolar : precio;
      const total = cantidad * precioARS;

      const data: PurchaseMaterialInsert = {
        tenant_id: tenantId,
        fecha: new Date(materialForm.fecha).toISOString(),
        material: materialForm.material,
        cantidad,
        precio: precioARS,
        proveedor: materialForm.proveedor,
        moneda: materialForm.moneda,
        valor_dolar: materialForm.moneda === 'USD' ? valorDolar : null,
        total,
      };

      if (editingMaterial) {
        await supabase.from('purchases_materials').update(data).eq('id', editingMaterial.id);
      } else {
        await supabase.from('purchases_materials').insert(data);
        
        // Actualizar stock automáticamente
        await updateStockOnPurchase('material', materialForm.material, cantidad, precioARS, materialForm.moneda, valorDolar);
      }

      resetMaterialForm();
      loadPurchases();
    } catch (error) {
      console.error('Error saving purchase:', error);
      alert('Error al guardar la compra');
    }
  };

  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;

    try {
      const cantidad = parseInt(productForm.cantidad);
      const precio = parseFloat(productForm.precio);
      const valorDolar = productForm.moneda === 'USD' ? parseFloat(productForm.valor_dolar) : 1;
      const precioARS = productForm.moneda === 'USD' ? precio * valorDolar : precio;
      const total = cantidad * precioARS;

      const data: PurchaseProductInsert = {
        tenant_id: tenantId,
        fecha: new Date(productForm.fecha).toISOString(),
        producto: productForm.producto,
        cantidad,
        precio: precioARS,
        proveedor: productForm.proveedor,
        moneda: productForm.moneda,
        valor_dolar: productForm.moneda === 'USD' ? valorDolar : null,
        total,
      };

      if (editingProduct) {
        await supabase.from('purchases_products').update(data).eq('id', editingProduct.id);
      } else {
        await supabase.from('purchases_products').insert(data);
        
        // Actualizar stock automáticamente
        await updateStockOnPurchase('product', productForm.producto, cantidad, precioARS, productForm.moneda, valorDolar);
      }

      resetProductForm();
      loadPurchases();
    } catch (error) {
      console.error('Error saving purchase:', error);
      alert('Error al guardar la compra');
    }
  };

  const updateStockOnPurchase = async (
    type: 'material' | 'product',
    itemName: string,
    quantity: number,
    price: number,
    currency: 'ARS' | 'USD',
    dollarValue: number
  ) => {
    if (!tenantId) return;

    try {
      if (type === 'material') {
        // Buscar si existe en stock_materials
        const { data: existing } = await supabase
          .from('stock_materials')
          .select('*')
          .eq('tenant_id', tenantId)
          .ilike('nombre', itemName)
          .limit(1);

        if (existing && existing.length > 0) {
          // Actualizar cantidad existente
          await supabase
            .from('stock_materials')
            .update({
              kg: existing[0].kg + quantity,
              costo_kilo_usd: currency === 'USD' ? price / dollarValue : price,
              valor_dolar: currency === 'USD' ? dollarValue : 1,
              moneda: currency,
            })
            .eq('id', existing[0].id);
        } else {
          // Crear nuevo registro
          await supabase.from('stock_materials').insert({
            tenant_id: tenantId,
            nombre: itemName,
            material: itemName,
            kg: quantity,
            costo_kilo_usd: currency === 'USD' ? price / dollarValue : price,
            valor_dolar: currency === 'USD' ? dollarValue : 1,
            moneda: currency,
          });
        }

        // Registrar movimiento
        await supabase.from('inventory_movements').insert({
          tenant_id: tenantId,
          tipo: 'ingreso_mp',
          item_nombre: itemName,
          cantidad: quantity,
          motivo: 'Compra de materia prima',
        });
      } else {
        // Buscar si existe en resale_products
        const { data: existing } = await supabase
          .from('resale_products')
          .select('*')
          .eq('tenant_id', tenantId)
          .ilike('nombre', itemName)
          .limit(1);

        const costoUnitario = price;
        const costoFinal = costoUnitario;

        if (existing && existing.length > 0) {
          // Actualizar cantidad existente
          await supabase
            .from('resale_products')
            .update({
              cantidad: existing[0].cantidad + quantity,
              costo_unitario: costoUnitario,
              costo_unitario_final: costoFinal,
              moneda: currency,
              valor_dolar: currency === 'USD' ? dollarValue : null,
            })
            .eq('id', existing[0].id);
        } else {
          // Crear nuevo registro
          await supabase.from('resale_products').insert({
            tenant_id: tenantId,
            nombre: itemName,
            cantidad: quantity,
            costo_unitario: costoUnitario,
            otros_costos: 0,
            costo_unitario_final: costoFinal,
            moneda: currency,
            valor_dolar: currency === 'USD' ? dollarValue : null,
          });
        }

        // Registrar movimiento
        await supabase.from('inventory_movements').insert({
          tenant_id: tenantId,
          tipo: 'ingreso_pr',
          item_nombre: itemName,
          cantidad: quantity,
          motivo: 'Compra de producto',
        });
      }
    } catch (error) {
      console.error('Error updating stock:', error);
    }
  };

  const resetMaterialForm = () => {
    setMaterialForm({
      fecha: new Date().toISOString().split('T')[0],
      material: '',
      cantidad: '',
      precio: '',
      proveedor: '',
      moneda: 'ARS',
      valor_dolar: '',
    });
    setEditingMaterial(null);
    setShowMaterialForm(false);
  };

  const resetProductForm = () => {
    setProductForm({
      fecha: new Date().toISOString().split('T')[0],
      producto: '',
      cantidad: '',
      precio: '',
      proveedor: '',
      moneda: 'ARS',
      valor_dolar: '',
    });
    setEditingProduct(null);
    setShowProductForm(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Cargando compras...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 -mx-6 -mt-6 mb-6">
        <div className="flex items-center space-x-3 mb-2">
          <TrendingUp className="w-6 h-6 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900">Compras</h1>
        </div>
        <p className="text-sm text-gray-600">Registro de compras de materia prima y productos</p>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 mb-6">
        <div className="flex space-x-1">
          {[
            { id: 'materials' as TabType, label: 'Compras de Materia Prima' },
            { id: 'products' as TabType, label: 'Compras de Productos' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
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
            <h2 className="text-lg font-semibold">Compras de Materia Prima</h2>
            {canCreate('fabinsa-purchases') && (
              <button
                onClick={() => setShowMaterialForm(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
                <span>Nueva Compra</span>
              </button>
            )}
          </div>

          {/* Material Purchase Form */}
          {showMaterialForm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">
                    {editingMaterial ? 'Editar Compra' : 'Nueva Compra de Materia Prima'}
                  </h3>
                  <button onClick={resetMaterialForm} className="text-gray-500">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <form onSubmit={handleMaterialSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Fecha *</label>
                      <input
                        type="date"
                        required
                        value={materialForm.fecha}
                        onChange={(e) => setMaterialForm({ ...materialForm, fecha: e.target.value })}
                        className="w-full px-3 py-2 border rounded-md"
                      />
                    </div>
                    <div className="relative">
                      <label className="block text-sm font-medium mb-1">Proveedor *</label>
                      <div className="relative">
                        <input
                          ref={supplierInputRefMaterial}
                          type="text"
                          required
                          value={materialForm.proveedor}
                          onChange={(e) => {
                            setMaterialForm({ ...materialForm, proveedor: e.target.value });
                            setShowSupplierDropdownMaterial(e.target.value.length > 0 && getFilteredSuppliers(e.target.value).length > 0);
                          }}
                          onFocus={() => {
                            if (getFilteredSuppliers(materialForm.proveedor).length > 0) {
                              setShowSupplierDropdownMaterial(true);
                            }
                          }}
                          onBlur={() => {
                            setTimeout(() => setShowSupplierDropdownMaterial(false), 200);
                          }}
                          className="w-full px-3 py-2 pr-8 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Escribe o selecciona un proveedor"
                        />
                        <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        {showSupplierDropdownMaterial && getFilteredSuppliers(materialForm.proveedor).length > 0 && (
                          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                            {getFilteredSuppliers(materialForm.proveedor).map((supplier) => (
                              <button
                                key={supplier.id}
                                type="button"
                                onClick={() => {
                                  setMaterialForm({ ...materialForm, proveedor: supplier.nombre });
                                  setShowSupplierDropdownMaterial(false);
                                }}
                                className="w-full text-left px-4 py-2 hover:bg-blue-50 focus:bg-blue-50 focus:outline-none"
                              >
                                <div className="font-medium">{supplier.nombre}</div>
                                {supplier.razon_social && (
                                  <div className="text-sm text-gray-500">{supplier.razon_social}</div>
                                )}
                                {supplier.cuit && (
                                  <div className="text-xs text-gray-400">CUIT: {supplier.cuit}</div>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="relative">
                    <label className="block text-sm font-medium mb-1">Material *</label>
                    <div className="relative">
                      <input
                        ref={materialInputRef}
                        type="text"
                        required
                        value={materialForm.material}
                        onChange={(e) => {
                          setMaterialForm({ ...materialForm, material: e.target.value });
                          setShowMaterialDropdown(e.target.value.length > 0 && getFilteredMaterials(e.target.value).length > 0);
                        }}
                        onFocus={() => {
                          if (getFilteredMaterials(materialForm.material).length > 0) {
                            setShowMaterialDropdown(true);
                          }
                        }}
                        onBlur={() => {
                          setTimeout(() => setShowMaterialDropdown(false), 200);
                        }}
                        className="w-full px-3 py-2 pr-8 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Selecciona o escribe un material"
                      />
                      <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                      {showMaterialDropdown && getFilteredMaterials(materialForm.material).length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                          {getFilteredMaterials(materialForm.material).map((material) => (
                            <button
                              key={material.id}
                              type="button"
                              onClick={() => {
                                setMaterialForm({ ...materialForm, material: material.material });
                                setShowMaterialDropdown(false);
                              }}
                              className="w-full text-left px-4 py-2 hover:bg-blue-50 focus:bg-blue-50 focus:outline-none"
                            >
                              <div className="font-medium">{material.material}</div>
                              <div className="text-sm text-gray-500">Stock: {material.kg.toFixed(2)} kg</div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Cantidad (kg) *</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={materialForm.cantidad}
                        onChange={(e) => setMaterialForm({ ...materialForm, cantidad: e.target.value })}
                        className="w-full px-3 py-2 border rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Precio unitario *</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={materialForm.precio}
                        onChange={(e) => setMaterialForm({ ...materialForm, precio: e.target.value })}
                        className="w-full px-3 py-2 border rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Moneda</label>
                      <select
                        value={materialForm.moneda}
                        onChange={(e) => setMaterialForm({ ...materialForm, moneda: e.target.value as 'ARS' | 'USD' })}
                        className="w-full px-3 py-2 border rounded-md"
                      >
                        <option value="ARS">ARS</option>
                        <option value="USD">USD</option>
                      </select>
                    </div>
                  </div>
                  {materialForm.moneda === 'USD' && (
                    <div>
                      <label className="block text-sm font-medium mb-1">Valor del Dólar *</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={materialForm.valor_dolar}
                        onChange={(e) => setMaterialForm({ ...materialForm, valor_dolar: e.target.value })}
                        className="w-full px-3 py-2 border rounded-md"
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

          {/* Material Purchases Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Material</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cantidad</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Precio</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Proveedor</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {materialPurchases.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                      No hay compras registradas
                    </td>
                  </tr>
                ) : (
                  materialPurchases.map((purchase) => (
                    <tr key={purchase.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {new Date(purchase.fecha).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">{purchase.material}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">{purchase.cantidad.toFixed(2)} kg</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        ${purchase.precio.toFixed(2)} ({purchase.moneda})
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">{purchase.proveedor}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">
                        ${purchase.total.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        {canDelete('fabinsa-purchases') && (
                          <button
                            onClick={async () => {
                              if (confirm('¿Eliminar esta compra?')) {
                                await supabase.from('purchases_materials').delete().eq('id', purchase.id);
                                loadPurchases();
                              }
                            }}
                            className="text-red-600 hover:text-red-900"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Productos Tab */}
      {activeTab === 'products' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Compras de Productos</h2>
            {canCreate('fabinsa-purchases') && (
              <button
                onClick={() => setShowProductForm(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
                <span>Nueva Compra</span>
              </button>
            )}
          </div>

          {/* Product Purchase Form */}
          {showProductForm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">
                    {editingProduct ? 'Editar Compra' : 'Nueva Compra de Producto'}
                  </h3>
                  <button onClick={resetProductForm} className="text-gray-500">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <form onSubmit={handleProductSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Fecha *</label>
                      <input
                        type="date"
                        required
                        value={productForm.fecha}
                        onChange={(e) => setProductForm({ ...productForm, fecha: e.target.value })}
                        className="w-full px-3 py-2 border rounded-md"
                      />
                    </div>
                    <div className="relative">
                      <label className="block text-sm font-medium mb-1">Proveedor *</label>
                      <div className="relative">
                        <input
                          ref={supplierInputRefProduct}
                          type="text"
                          required
                          value={productForm.proveedor}
                          onChange={(e) => {
                            setProductForm({ ...productForm, proveedor: e.target.value });
                            setShowSupplierDropdownProduct(e.target.value.length > 0 && getFilteredSuppliers(e.target.value).length > 0);
                          }}
                          onFocus={() => {
                            if (getFilteredSuppliers(productForm.proveedor).length > 0) {
                              setShowSupplierDropdownProduct(true);
                            }
                          }}
                          onBlur={() => {
                            setTimeout(() => setShowSupplierDropdownProduct(false), 200);
                          }}
                          className="w-full px-3 py-2 pr-8 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Escribe o selecciona un proveedor"
                        />
                        <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        {showSupplierDropdownProduct && getFilteredSuppliers(productForm.proveedor).length > 0 && (
                          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                            {getFilteredSuppliers(productForm.proveedor).map((supplier) => (
                              <button
                                key={supplier.id}
                                type="button"
                                onClick={() => {
                                  setProductForm({ ...productForm, proveedor: supplier.nombre });
                                  setShowSupplierDropdownProduct(false);
                                }}
                                className="w-full text-left px-4 py-2 hover:bg-blue-50 focus:bg-blue-50 focus:outline-none"
                              >
                                <div className="font-medium">{supplier.nombre}</div>
                                {supplier.razon_social && (
                                  <div className="text-sm text-gray-500">{supplier.razon_social}</div>
                                )}
                                {supplier.cuit && (
                                  <div className="text-xs text-gray-400">CUIT: {supplier.cuit}</div>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Producto *</label>
                    <input
                      type="text"
                      required
                      value={productForm.producto}
                      onChange={(e) => setProductForm({ ...productForm, producto: e.target.value })}
                      className="w-full px-3 py-2 border rounded-md"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Cantidad *</label>
                      <input
                        type="number"
                        required
                        value={productForm.cantidad}
                        onChange={(e) => setProductForm({ ...productForm, cantidad: e.target.value })}
                        className="w-full px-3 py-2 border rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Precio unitario *</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={productForm.precio}
                        onChange={(e) => setProductForm({ ...productForm, precio: e.target.value })}
                        className="w-full px-3 py-2 border rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Moneda</label>
                      <select
                        value={productForm.moneda}
                        onChange={(e) => setProductForm({ ...productForm, moneda: e.target.value as 'ARS' | 'USD' })}
                        className="w-full px-3 py-2 border rounded-md"
                      >
                        <option value="ARS">ARS</option>
                        <option value="USD">USD</option>
                      </select>
                    </div>
                  </div>
                  {productForm.moneda === 'USD' && (
                    <div>
                      <label className="block text-sm font-medium mb-1">Valor del Dólar *</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={productForm.valor_dolar}
                        onChange={(e) => setProductForm({ ...productForm, valor_dolar: e.target.value })}
                        className="w-full px-3 py-2 border rounded-md"
                      />
                    </div>
                  )}
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

          {/* Product Purchases Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cantidad</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Precio</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Proveedor</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {productPurchases.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                      No hay compras registradas
                    </td>
                  </tr>
                ) : (
                  productPurchases.map((purchase) => (
                    <tr key={purchase.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {new Date(purchase.fecha).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">{purchase.producto}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">{purchase.cantidad} u</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        ${purchase.precio.toFixed(2)} ({purchase.moneda})
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">{purchase.proveedor}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">
                        ${purchase.total.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        {canDelete('fabinsa-purchases') && (
                          <button
                            onClick={async () => {
                              if (confirm('¿Eliminar esta compra?')) {
                                await supabase.from('purchases_products').delete().eq('id', purchase.id);
                                loadPurchases();
                              }
                            }}
                            className="text-red-600 hover:text-red-900"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
