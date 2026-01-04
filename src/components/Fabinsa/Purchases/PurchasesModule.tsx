/**
 * Módulo de Compras
 * Registro de compras de materia prima y productos
 */

import React, { useState, useEffect, useRef } from 'react';
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

interface MaterialItem {
  id: string;
  material: string;
  cantidad: number;
  precio: number;
  moneda: 'ARS' | 'USD';
  valor_dolar: number;
  precioARS: number;
  total: number;
}

interface ProductItem {
  id: string;
  producto: string;
  cantidad: number;
  precio: number;
  moneda: 'ARS' | 'USD';
  valor_dolar: number;
  precioARS: number;
  total: number;
}

export function PurchasesModule() {
  const { tenantId } = useTenant();
  const { canCreate, canEdit, canDelete } = useDepartmentPermissions();
  const [activeTab, setActiveTab] = useState<TabType>('materials');
  
  // Compras de Materia Prima
  const [materialPurchases, setMaterialPurchases] = useState<PurchaseMaterial[]>([]);
  const [showMaterialForm, setShowMaterialForm] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<PurchaseMaterial | null>(null);
  const [materialItems, setMaterialItems] = useState<MaterialItem[]>([]);
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
  const [productItems, setProductItems] = useState<ProductItem[]>([]);
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
  const [expandedMaterialOrders, setExpandedMaterialOrders] = useState<Set<string>>(new Set());
  const [expandedProductOrders, setExpandedProductOrders] = useState<Set<string>>(new Set());
  
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

  const handleAddMaterial = () => {
    if (!materialForm.material || !materialForm.cantidad || !materialForm.precio) {
      alert('Complete todos los campos requeridos');
      return;
    }

    if (materialForm.moneda === 'USD' && !materialForm.valor_dolar) {
      alert('Ingrese el valor del dólar');
      return;
    }

    const cantidad = parseFloat(materialForm.cantidad);
    const precio = parseFloat(materialForm.precio);
    const valorDolar = materialForm.moneda === 'USD' ? parseFloat(materialForm.valor_dolar) : 1;
    const precioARS = materialForm.moneda === 'USD' ? precio * valorDolar : precio;
    const total = cantidad * precioARS;

    // Verificar si ya existe el material en la lista
    const existingItem = materialItems.find(item => item.material === materialForm.material);
    if (existingItem) {
      alert('Este material ya está en la lista. Elimínelo primero si desea cambiarlo.');
      return;
    }

    const newItem: MaterialItem = {
      id: Date.now().toString(),
      material: materialForm.material,
      cantidad,
      precio,
      moneda: materialForm.moneda,
      valor_dolar: valorDolar,
      precioARS,
      total,
    };

    setMaterialItems([...materialItems, newItem]);

    // Limpiar campos del material (mantener fecha y proveedor)
    setMaterialForm({
      ...materialForm,
      material: '',
      cantidad: '',
      precio: '',
      moneda: 'ARS',
      valor_dolar: '',
    });
  };

  const handleRemoveMaterial = (id: string) => {
    setMaterialItems(materialItems.filter(item => item.id !== id));
  };

  const handleMaterialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;

    if (materialItems.length === 0) {
      alert('Agregue al menos un material a la compra');
      return;
    }

    if (!materialForm.proveedor) {
      alert('Seleccione un proveedor');
      return;
    }

    try {
      // Crear fecha en zona horaria local para evitar problemas de UTC
      const fechaLocal = new Date(materialForm.fecha + 'T00:00:00');
      const fecha = fechaLocal.toISOString();
      const proveedor = materialForm.proveedor;
      
      // Generar un order_id único para agrupar todos los materiales de esta compra
      const orderId = crypto.randomUUID();

      // Crear registros de compra para cada material con el mismo order_id
      for (const item of materialItems) {
        const data: PurchaseMaterialInsert & { order_id?: string } = {
          tenant_id: tenantId,
          fecha,
          material: item.material,
          cantidad: item.cantidad,
          precio: item.precioARS,
          proveedor,
          moneda: item.moneda,
          valor_dolar: item.moneda === 'USD' ? item.valor_dolar : null,
          total: item.total,
          order_id: orderId,
        } as any;

        await supabase.from('purchases_materials').insert(data);
        
        // Actualizar stock automáticamente
        await updateStockOnPurchase('material', item.material, item.cantidad, item.precioARS, item.moneda, item.valor_dolar);
      }

      resetMaterialForm();
      loadPurchases();
    } catch (error) {
      console.error('Error saving purchase:', error);
      alert('Error al guardar la compra');
    }
  };

  const handleAddProduct = () => {
    if (!productForm.producto || !productForm.cantidad || !productForm.precio) {
      alert('Complete todos los campos requeridos');
      return;
    }

    if (productForm.moneda === 'USD' && !productForm.valor_dolar) {
      alert('Ingrese el valor del dólar');
      return;
    }

    const cantidad = parseInt(productForm.cantidad);
    const precio = parseFloat(productForm.precio);
    const valorDolar = productForm.moneda === 'USD' ? parseFloat(productForm.valor_dolar) : 1;
    const precioARS = productForm.moneda === 'USD' ? precio * valorDolar : precio;
    const total = cantidad * precioARS;

    // Verificar si ya existe el producto en la lista
    const existingItem = productItems.find(item => item.producto === productForm.producto);
    if (existingItem) {
      alert('Este producto ya está en la lista. Elimínelo primero si desea cambiarlo.');
      return;
    }

    const newItem: ProductItem = {
      id: Date.now().toString(),
      producto: productForm.producto,
      cantidad,
      precio,
      moneda: productForm.moneda,
      valor_dolar: valorDolar,
      precioARS,
      total,
    };

    setProductItems([...productItems, newItem]);

    // Limpiar campos del producto (mantener fecha y proveedor)
    setProductForm({
      ...productForm,
      producto: '',
      cantidad: '',
      precio: '',
      moneda: 'ARS',
      valor_dolar: '',
    });
  };

  const handleRemoveProduct = (id: string) => {
    setProductItems(productItems.filter(item => item.id !== id));
  };

  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;

    if (productItems.length === 0) {
      alert('Agregue al menos un producto a la compra');
      return;
    }

    if (!productForm.proveedor) {
      alert('Seleccione un proveedor');
      return;
    }

    try {
      // Crear fecha en zona horaria local para evitar problemas de UTC
      const fechaLocal = new Date(productForm.fecha + 'T00:00:00');
      const fecha = fechaLocal.toISOString();
      const proveedor = productForm.proveedor;
      
      // Generar un order_id único para agrupar todos los productos de esta compra
      const orderId = crypto.randomUUID();

      // Crear registros de compra para cada producto con el mismo order_id
      for (const item of productItems) {
        const data: PurchaseProductInsert & { order_id?: string } = {
          tenant_id: tenantId,
          fecha,
          producto: item.producto,
          cantidad: item.cantidad,
          precio: item.precioARS,
          proveedor,
          moneda: item.moneda,
          valor_dolar: item.moneda === 'USD' ? item.valor_dolar : null,
          total: item.total,
          order_id: orderId,
        } as any;

        await supabase.from('purchases_products').insert(data);
        
        // Actualizar stock automáticamente
        await updateStockOnPurchase('product', item.producto, item.cantidad, item.precioARS, item.moneda, item.valor_dolar);
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
    setMaterialItems([]);
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
    setProductItems([]);
    setEditingProduct(null);
    setShowProductForm(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">Cargando compras...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 -mx-6 -mt-6 mb-6">
        <div className="flex items-center space-x-3 mb-2">
          <TrendingUp className="w-6 h-6 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Compras</h1>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400">Registro de compras de materia prima y productos</p>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-gray-700 mb-6">
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
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Compras de Materia Prima</h2>
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
              <div className="bg-white dark:bg-slate-800 rounded-lg p-6 w-full max-w-2xl">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {editingMaterial ? 'Editar Compra' : 'Nueva Compra de Materia Prima'}
                  </h3>
                  <button onClick={resetMaterialForm} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <form onSubmit={handleMaterialSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Fecha *</label>
                      <input
                        type="date"
                        required
                        value={materialForm.fecha}
                        onChange={(e) => setMaterialForm({ ...materialForm, fecha: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div className="relative">
                      <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Proveedor *</label>
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
                          className="w-full px-3 py-2 pr-8 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Escribe o selecciona un proveedor"
                        />
                        <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
                        {showSupplierDropdownMaterial && getFilteredSuppliers(materialForm.proveedor).length > 0 && (
                          <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-auto">
                            {getFilteredSuppliers(materialForm.proveedor).map((supplier) => (
                              <button
                                key={supplier.id}
                                type="button"
                                onClick={() => {
                                  setMaterialForm({ ...materialForm, proveedor: supplier.nombre });
                                  setShowSupplierDropdownMaterial(false);
                                }}
                                className="w-full text-left px-4 py-2 hover:bg-blue-50 dark:hover:bg-slate-600 focus:bg-blue-50 dark:focus:bg-slate-600 focus:outline-none text-gray-900 dark:text-white"
                              >
                                <div className="font-medium">{supplier.nombre}</div>
                                {supplier.razon_social && (
                                  <div className="text-sm text-gray-500 dark:text-gray-400">{supplier.razon_social}</div>
                                )}
                                {supplier.cuit && (
                                  <div className="text-xs text-gray-400 dark:text-gray-500">CUIT: {supplier.cuit}</div>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="relative">
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                      Material {materialItems.length === 0 ? '*' : ''}
                    </label>
                    <div className="relative">
                      <input
                        ref={materialInputRef}
                        type="text"
                        required={materialItems.length === 0}
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
                        className="w-full px-3 py-2 pr-8 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Selecciona o escribe un material"
                      />
                      <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
                      {showMaterialDropdown && getFilteredMaterials(materialForm.material).length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-auto">
                          {getFilteredMaterials(materialForm.material).map((material) => (
                            <button
                              key={material.id}
                              type="button"
                              onClick={() => {
                                setMaterialForm({ ...materialForm, material: material.material });
                                setShowMaterialDropdown(false);
                              }}
                              className="w-full text-left px-4 py-2 hover:bg-blue-50 dark:hover:bg-slate-600 focus:bg-blue-50 dark:focus:bg-slate-600 focus:outline-none text-gray-900 dark:text-white"
                            >
                              <div className="font-medium">{material.material}</div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">Stock: {material.kg.toFixed(2)} kg</div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                        Cantidad (kg) {materialItems.length === 0 ? '*' : ''}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        required={materialItems.length === 0}
                        value={materialForm.cantidad}
                        onChange={(e) => setMaterialForm({ ...materialForm, cantidad: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                        Precio unitario {materialItems.length === 0 ? '*' : ''}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        required={materialItems.length === 0}
                        value={materialForm.precio}
                        onChange={(e) => setMaterialForm({ ...materialForm, precio: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Moneda</label>
                      <select
                        value={materialForm.moneda}
                        onChange={(e) => setMaterialForm({ ...materialForm, moneda: e.target.value as 'ARS' | 'USD' })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                      >
                        <option value="ARS">ARS</option>
                        <option value="USD">USD</option>
                      </select>
                    </div>
                  </div>
                  {materialForm.moneda === 'USD' && (
                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                        Valor del Dólar {materialItems.length === 0 ? '*' : ''}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        required={materialItems.length === 0}
                        value={materialForm.valor_dolar}
                        onChange={(e) => setMaterialForm({ ...materialForm, valor_dolar: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                      />
                    </div>
                  )}

                  {/* Botón Agregar Material */}
                  {materialForm.material && materialForm.cantidad && materialForm.precio && (
                    <button
                      type="button"
                      onClick={handleAddMaterial}
                      className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center justify-center space-x-2"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Agregar Material a la Compra</span>
                    </button>
                  )}

                  {/* Lista de Materiales Agregados */}
                  {materialItems.length > 0 && (
                    <div className="border border-gray-300 dark:border-gray-600 rounded-md p-4 bg-gray-50 dark:bg-slate-700">
                      <h4 className="text-sm font-semibold mb-3 text-gray-900 dark:text-white">Materiales en la Compra ({materialItems.length})</h4>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {materialItems.map((item) => (
                          <div key={item.id} className="bg-white dark:bg-slate-600 p-3 rounded-md flex justify-between items-start">
                            <div className="flex-1">
                              <div className="font-medium text-gray-900 dark:text-white">{item.material}</div>
                              <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                Cantidad: {item.cantidad.toFixed(2)} kg | Precio: ${item.precio.toFixed(2)} ({item.moneda}) | Total: ${item.total.toFixed(2)}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveMaterial(item.id)}
                              className="ml-2 text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 pt-3 border-t border-gray-300 dark:border-gray-600">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">Total Compra:</span>
                          <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                            ${materialItems.reduce((sum, item) => sum + item.total, 0).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Mensaje informativo si ya hay materiales */}
                  {materialItems.length > 0 && !materialForm.material && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-3">
                      <p className="text-sm text-blue-800 dark:text-blue-300">
                        ✓ Tienes {materialItems.length} material{materialItems.length > 1 ? 'es' : ''} agregado{materialItems.length > 1 ? 's' : ''}. Puedes agregar más materiales o hacer clic en "Guardar Compra" para finalizar.
                      </p>
                    </div>
                  )}

                  <div className="flex justify-end space-x-3">
                    <button type="button" onClick={resetMaterialForm} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-700 hover:bg-gray-50 dark:hover:bg-slate-600">
                      Cancelar
                    </button>
                    {materialItems.length > 0 ? (
                      <button 
                        type="submit" 
                        className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-semibold shadow-lg"
                      >
                        ✓ Guardar Compra ({materialItems.length} material{materialItems.length > 1 ? 'es' : ''})
                      </button>
                    ) : (
                      <button 
                        type="button" 
                        disabled
                        className="px-4 py-2 bg-gray-400 text-gray-200 rounded-md cursor-not-allowed"
                      >
                        Agregue al menos un material
                      </button>
                    )}
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Material Purchases Table */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-slate-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Fecha</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Material</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Cantidad</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Precio</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Proveedor</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Total</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-gray-700">
                {materialPurchases.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                      No hay compras registradas
                    </td>
                  </tr>
                ) : (
                  (() => {
                    // Agrupar compras por order_id
                    const groupedPurchases = materialPurchases.reduce((acc: any, purchase: any) => {
                      if (purchase.order_id) {
                        if (!acc[purchase.order_id]) {
                          acc[purchase.order_id] = {
                            order_id: purchase.order_id,
                            fecha: purchase.fecha,
                            proveedor: purchase.proveedor,
                            items: [],
                            total_compra: 0,
                          };
                        }
                        acc[purchase.order_id].items.push(purchase);
                        acc[purchase.order_id].total_compra += purchase.total;
                      } else {
                        // Compras sin order_id (antiguas) se muestran individualmente
                        if (!acc.individual) acc.individual = [];
                        acc.individual.push(purchase);
                      }
                      return acc;
                    }, {});

                    const orders = Object.values(groupedPurchases).filter((g: any) => g.order_id);
                    const individualPurchases = groupedPurchases.individual || [];

                    return (
                      <>
                        {/* Mostrar órdenes agrupadas */}
                        {orders.map((order: any) => {
                          const isExpanded = expandedMaterialOrders.has(order.order_id);
                          return (
                            <React.Fragment key={order.order_id}>
                              {/* Fila resumen de la orden */}
                              <tr className="bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30">
                                <td className="px-6 py-3 text-sm font-medium text-gray-900 dark:text-white">
                                  {new Date(order.fecha).toLocaleDateString('es-AR')}
                                </td>
                                <td className="px-6 py-3 text-sm font-medium text-gray-900 dark:text-white" colSpan={2}>
                                  <button
                                    onClick={() => {
                                      const newExpanded = new Set(expandedMaterialOrders);
                                      if (isExpanded) {
                                        newExpanded.delete(order.order_id);
                                      } else {
                                        newExpanded.add(order.order_id);
                                      }
                                      setExpandedMaterialOrders(newExpanded);
                                    }}
                                    className="flex items-center space-x-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                                  >
                                    <span>Orden con {order.items.length} material{order.items.length > 1 ? 'es' : ''}</span>
                                    <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                  </button>
                                </td>
                                <td className="px-6 py-3 text-sm font-medium text-gray-900 dark:text-white"></td>
                                <td className="px-6 py-3 text-sm font-medium text-gray-900 dark:text-white">{order.proveedor}</td>
                                <td className="px-6 py-3 text-sm font-semibold text-blue-600 dark:text-blue-400">
                                  ${order.total_compra.toFixed(2)}
                                </td>
                                <td className="px-6 py-3 text-right text-sm">
                                  {canDelete('fabinsa-purchases') && (
                                    <button
                                      onClick={async () => {
                                        if (confirm(`¿Eliminar toda la orden con ${order.items.length} material${order.items.length > 1 ? 'es' : ''}?`)) {
                                          await supabase.from('purchases_materials').delete().eq('order_id', order.order_id);
                                          loadPurchases();
                                        }
                                      }}
                                      className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                </td>
                              </tr>
                              {/* Filas de materiales (si está expandida) */}
                              {isExpanded && order.items.map((item: any) => {
                                // El precio guardado es el precio unitario en ARS
                                // Si la moneda original era USD, necesitamos convertir de vuelta a USD
                                const precioUnitarioMostrar = item.moneda === 'USD' && item.valor_dolar 
                                  ? item.precio / item.valor_dolar 
                                  : item.precio;
                                
                                return (
                                  <tr key={item.id} className="bg-gray-50 dark:bg-slate-700 hover:bg-gray-100 dark:hover:bg-slate-600">
                                    <td className="px-6 py-2 text-sm text-gray-600 dark:text-gray-400"></td>
                                    <td className="px-6 py-2 text-sm text-gray-900 dark:text-white pl-8">
                                      • {item.material}
                                    </td>
                                    <td className="px-6 py-2 text-sm text-gray-900 dark:text-white">{item.cantidad.toFixed(2)} kg</td>
                                    <td className="px-6 py-2 text-sm text-gray-900 dark:text-white">
                                      ${precioUnitarioMostrar.toFixed(2)} ({item.moneda})
                                    </td>
                                    <td className="px-6 py-2 text-sm text-gray-600 dark:text-gray-400"></td>
                                    <td className="px-6 py-2 text-sm text-gray-900 dark:text-white">${item.total.toFixed(2)}</td>
                                    <td className="px-6 py-2 text-sm"></td>
                                  </tr>
                                );
                              })}
                            </React.Fragment>
                          );
                        })}
                        {/* Mostrar compras individuales (sin order_id) */}
                        {individualPurchases.map((purchase: any) => (
                          <tr key={purchase.id} className="hover:bg-gray-50 dark:hover:bg-slate-700">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                              {new Date(purchase.fecha).toLocaleDateString('es-AR')}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{purchase.material}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{purchase.cantidad.toFixed(2)} kg</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                              ${purchase.precio.toFixed(2)} ({purchase.moneda})
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{purchase.proveedor}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-white">
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
      )}

      {/* Productos Tab */}
      {activeTab === 'products' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Compras de Productos</h2>
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
              <div className="bg-white dark:bg-slate-800 rounded-lg p-6 w-full max-w-2xl">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {editingProduct ? 'Editar Compra' : 'Nueva Compra de Producto'}
                  </h3>
                  <button onClick={resetProductForm} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <form onSubmit={handleProductSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Fecha *</label>
                      <input
                        type="date"
                        required
                        value={productForm.fecha}
                        onChange={(e) => setProductForm({ ...productForm, fecha: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
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
                          className="w-full px-3 py-2 pr-8 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Escribe o selecciona un proveedor"
                        />
                        <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
                        {showSupplierDropdownProduct && getFilteredSuppliers(productForm.proveedor).length > 0 && (
                          <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-auto">
                            {getFilteredSuppliers(productForm.proveedor).map((supplier) => (
                              <button
                                key={supplier.id}
                                type="button"
                                onClick={() => {
                                  setProductForm({ ...productForm, proveedor: supplier.nombre });
                                  setShowSupplierDropdownProduct(false);
                                }}
                                className="w-full text-left px-4 py-2 hover:bg-blue-50 dark:hover:bg-slate-600 focus:bg-blue-50 dark:focus:bg-slate-600 focus:outline-none text-gray-900 dark:text-white"
                              >
                                <div className="font-medium">{supplier.nombre}</div>
                                {supplier.razon_social && (
                                  <div className="text-sm text-gray-500 dark:text-gray-400">{supplier.razon_social}</div>
                                )}
                                {supplier.cuit && (
                                  <div className="text-xs text-gray-400 dark:text-gray-500">CUIT: {supplier.cuit}</div>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                      Producto {productItems.length === 0 ? '*' : ''}
                    </label>
                    <input
                      type="text"
                      required={productItems.length === 0}
                      value={productForm.producto}
                      onChange={(e) => setProductForm({ ...productForm, producto: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                        Cantidad {productItems.length === 0 ? '*' : ''}
                      </label>
                      <input
                        type="number"
                        required={productItems.length === 0}
                        value={productForm.cantidad}
                        onChange={(e) => setProductForm({ ...productForm, cantidad: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                        Precio unitario {productItems.length === 0 ? '*' : ''}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        required={productItems.length === 0}
                        value={productForm.precio}
                        onChange={(e) => setProductForm({ ...productForm, precio: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Moneda</label>
                      <select
                        value={productForm.moneda}
                        onChange={(e) => setProductForm({ ...productForm, moneda: e.target.value as 'ARS' | 'USD' })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                      >
                        <option value="ARS">ARS</option>
                        <option value="USD">USD</option>
                      </select>
                    </div>
                  </div>
                  {productForm.moneda === 'USD' && (
                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                        Valor del Dólar {productItems.length === 0 ? '*' : ''}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        required={productItems.length === 0}
                        value={productForm.valor_dolar}
                        onChange={(e) => setProductForm({ ...productForm, valor_dolar: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                      />
                    </div>
                  )}

                  {/* Botón Agregar Producto */}
                  {productForm.producto && productForm.cantidad && productForm.precio && (
                    <button
                      type="button"
                      onClick={handleAddProduct}
                      className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center justify-center space-x-2"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Agregar Producto a la Compra</span>
                    </button>
                  )}

                  {/* Lista de Productos Agregados */}
                  {productItems.length > 0 && (
                    <div className="border border-gray-300 dark:border-gray-600 rounded-md p-4 bg-gray-50 dark:bg-slate-700">
                      <h4 className="text-sm font-semibold mb-3 text-gray-900 dark:text-white">Productos en la Compra ({productItems.length})</h4>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {productItems.map((item) => (
                          <div key={item.id} className="bg-white dark:bg-slate-600 p-3 rounded-md flex justify-between items-start">
                            <div className="flex-1">
                              <div className="font-medium text-gray-900 dark:text-white">{item.producto}</div>
                              <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                Cantidad: {item.cantidad} u | Precio: ${item.precio.toFixed(2)} ({item.moneda}) | Total: ${item.total.toFixed(2)}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveProduct(item.id)}
                              className="ml-2 text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 pt-3 border-t border-gray-300 dark:border-gray-600">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">Total Compra:</span>
                          <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                            ${productItems.reduce((sum, item) => sum + item.total, 0).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Mensaje informativo si ya hay productos */}
                  {productItems.length > 0 && !productForm.producto && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-3">
                      <p className="text-sm text-blue-800 dark:text-blue-300">
                        ✓ Tienes {productItems.length} producto{productItems.length > 1 ? 's' : ''} agregado{productItems.length > 1 ? 's' : ''}. Puedes agregar más productos o hacer clic en "Guardar Compra" para finalizar.
                      </p>
                    </div>
                  )}

                  <div className="flex justify-end space-x-3">
                    <button type="button" onClick={resetProductForm} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-slate-700 hover:bg-gray-50 dark:hover:bg-slate-600">
                      Cancelar
                    </button>
                    {productItems.length > 0 ? (
                      <button 
                        type="submit" 
                        className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-semibold shadow-lg"
                      >
                        ✓ Guardar Compra ({productItems.length} producto{productItems.length > 1 ? 's' : ''})
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

          {/* Product Purchases Table */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-slate-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Fecha</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Producto</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Cantidad</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Precio</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Proveedor</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Total</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-gray-700">
                {productPurchases.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                      No hay compras registradas
                    </td>
                  </tr>
                ) : (
                  (() => {
                    // Agrupar compras por order_id
                    const groupedPurchases = productPurchases.reduce((acc: any, purchase: any) => {
                      if (purchase.order_id) {
                        if (!acc[purchase.order_id]) {
                          acc[purchase.order_id] = {
                            order_id: purchase.order_id,
                            fecha: purchase.fecha,
                            proveedor: purchase.proveedor,
                            items: [],
                            total_compra: 0,
                          };
                        }
                        acc[purchase.order_id].items.push(purchase);
                        acc[purchase.order_id].total_compra += purchase.total;
                      } else {
                        // Compras sin order_id (antiguas) se muestran individualmente
                        if (!acc.individual) acc.individual = [];
                        acc.individual.push(purchase);
                      }
                      return acc;
                    }, {});

                    const orders = Object.values(groupedPurchases).filter((g: any) => g.order_id);
                    const individualPurchases = groupedPurchases.individual || [];

                    return (
                      <>
                        {/* Mostrar órdenes agrupadas */}
                        {orders.map((order: any) => {
                          const isExpanded = expandedProductOrders.has(order.order_id);
                          return (
                            <React.Fragment key={order.order_id}>
                              {/* Fila resumen de la orden */}
                              <tr className="bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30">
                                <td className="px-6 py-3 text-sm font-medium text-gray-900 dark:text-white">
                                  {new Date(order.fecha).toLocaleDateString('es-AR')}
                                </td>
                                <td className="px-6 py-3 text-sm font-medium text-gray-900 dark:text-white" colSpan={2}>
                                  <button
                                    onClick={() => {
                                      const newExpanded = new Set(expandedProductOrders);
                                      if (isExpanded) {
                                        newExpanded.delete(order.order_id);
                                      } else {
                                        newExpanded.add(order.order_id);
                                      }
                                      setExpandedProductOrders(newExpanded);
                                    }}
                                    className="flex items-center space-x-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                                  >
                                    <span>Orden con {order.items.length} producto{order.items.length > 1 ? 's' : ''}</span>
                                    <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                  </button>
                                </td>
                                <td className="px-6 py-3 text-sm font-medium text-gray-900 dark:text-white"></td>
                                <td className="px-6 py-3 text-sm font-medium text-gray-900 dark:text-white">{order.proveedor}</td>
                                <td className="px-6 py-3 text-sm font-semibold text-blue-600 dark:text-blue-400">
                                  ${order.total_compra.toFixed(2)}
                                </td>
                                <td className="px-6 py-3 text-right text-sm">
                                  {canDelete('fabinsa-purchases') && (
                                    <button
                                      onClick={async () => {
                                        if (confirm(`¿Eliminar toda la orden con ${order.items.length} producto${order.items.length > 1 ? 's' : ''}?`)) {
                                          await supabase.from('purchases_products').delete().eq('order_id', order.order_id);
                                          loadPurchases();
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
                              {isExpanded && order.items.map((item: any) => {
                                // El precio guardado es el precio unitario en ARS
                                // Si la moneda original era USD, necesitamos convertir de vuelta a USD
                                const precioUnitarioMostrar = item.moneda === 'USD' && item.valor_dolar 
                                  ? item.precio / item.valor_dolar 
                                  : item.precio;
                                
                                return (
                                  <tr key={item.id} className="bg-gray-50 dark:bg-slate-700 hover:bg-gray-100 dark:hover:bg-slate-600">
                                    <td className="px-6 py-2 text-sm text-gray-600 dark:text-gray-400"></td>
                                    <td className="px-6 py-2 text-sm text-gray-900 dark:text-white pl-8">
                                      • {item.producto}
                                    </td>
                                    <td className="px-6 py-2 text-sm text-gray-900 dark:text-white">{item.cantidad} u</td>
                                    <td className="px-6 py-2 text-sm text-gray-900 dark:text-white">
                                      ${precioUnitarioMostrar.toFixed(2)} ({item.moneda})
                                    </td>
                                    <td className="px-6 py-2 text-sm text-gray-600 dark:text-gray-400"></td>
                                    <td className="px-6 py-2 text-sm text-gray-900 dark:text-white">${item.total.toFixed(2)}</td>
                                    <td className="px-6 py-2 text-sm"></td>
                                  </tr>
                                );
                              })}
                            </React.Fragment>
                          );
                        })}
                        {/* Mostrar compras individuales (sin order_id) */}
                        {individualPurchases.map((purchase: any) => (
                          <tr key={purchase.id} className="hover:bg-gray-50 dark:hover:bg-slate-700">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                              {new Date(purchase.fecha).toLocaleDateString('es-AR')}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{purchase.producto}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{purchase.cantidad} u</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                              ${purchase.precio.toFixed(2)} ({purchase.moneda})
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{purchase.proveedor}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-white">
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
      )}
    </div>
  );
}
