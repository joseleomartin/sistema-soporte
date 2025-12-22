/**
 * Módulo de Producción
 * Gestión de productos y sus materiales
 */

import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Save, X, Factory, CheckCircle, Trash } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useTenant } from '../../../contexts/TenantContext';
import { Database } from '../../../lib/database.types';
import { formatProductName, parseProductName, calculateProductCosts, calculateAverageEmployeeHourValue } from '../../../lib/fabinsaCalculations';

type Product = Database['public']['Tables']['products']['Row'];
type ProductInsert = Database['public']['Tables']['products']['Insert'];
type ProductMaterial = Database['public']['Tables']['product_materials']['Row'];
type ProductMaterialInsert = Database['public']['Tables']['product_materials']['Insert'];
type StockMaterial = Database['public']['Tables']['stock_materials']['Row'];
type Employee = Database['public']['Tables']['employees']['Row'];

export function ProductionModule() {
  const { tenantId } = useTenant();
  const [products, setProducts] = useState<Product[]>([]);
  const [materials, setMaterials] = useState<Record<string, ProductMaterial[]>>({});
  const [stockMaterials, setStockMaterials] = useState<StockMaterial[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formMaterials, setFormMaterials] = useState<Array<{ material_name: string; kg_por_unidad: string }>>([]);
  const [newMaterial, setNewMaterial] = useState({ material_name: '', kg_por_unidad: '' });

  // Form state
  const [formData, setFormData] = useState({
    nombre: '',
    familia: '',
    medida: '',
    caracteristica: '',
    peso_unidad: '',
    precio_venta: '',
    cantidad_fabricar: '',
    cantidad_por_hora: '',
    iibb_porcentaje: '',
    moneda_precio: 'ARS' as 'ARS' | 'USD',
  });

  useEffect(() => {
    if (tenantId) {
      loadProducts();
      loadStockMaterials();
      loadEmployees();
    }
  }, [tenantId]);

  const loadProducts = async () => {
    if (!tenantId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setProducts(data || []);

      // Load materials for each product
      const materialsMap: Record<string, ProductMaterial[]> = {};
      for (const product of data || []) {
        const { data: mats } = await supabase
          .from('product_materials')
          .select('*')
          .eq('product_id', product.id);
        materialsMap[product.id] = mats || [];
      }
      setMaterials(materialsMap);
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStockMaterials = async () => {
    if (!tenantId) return;

    try {
      const { data, error } = await supabase
        .from('stock_materials')
        .select('*')
        .eq('tenant_id', tenantId);

      if (error) throw error;
      setStockMaterials(data || []);
    } catch (error) {
      console.error('Error loading stock materials:', error);
    }
  };

  const loadEmployees = async () => {
    if (!tenantId) return;

    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('tenant_id', tenantId);

      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      console.error('Error loading employees:', error);
    }
  };

  const calculateProductCost = (product: Product): { costoMP: number; costoMO: number; costoTotal: number } => {
    try {
      const productMaterials = materials[product.id] || [];
      const avgHourValue = calculateAverageEmployeeHourValue(employees);
      
      // Crear mapa de precios de materiales
      const materialPrices: Record<string, { costo_kilo_usd: number; valor_dolar: number; moneda: 'ARS' | 'USD' }> = {};
      stockMaterials.forEach(mat => {
        materialPrices[mat.material] = {
          costo_kilo_usd: mat.costo_kilo_usd,
          valor_dolar: mat.valor_dolar,
          moneda: mat.moneda,
        };
      });

      const costs = calculateProductCosts(
        product,
        productMaterials,
        materialPrices,
        avgHourValue
      );

      return {
        costoMP: costs.costo_unitario_mp,
        costoMO: costs.costo_unitario_mano_obra,
        costoTotal: costs.costo_base_unitario,
      };
    } catch (error) {
      console.error('Error calculating product cost:', error);
      return { costoMP: 0, costoMO: 0, costoTotal: 0 };
    }
  };

  const calculatePesoUnidad = (): number => {
    // Calcular peso como suma de los kg de los materiales
    return formMaterials.reduce((total, mat) => {
      return total + (parseFloat(mat.kg_por_unidad) || 0);
    }, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;

    // Validar que haya al menos un material
    if (formMaterials.length === 0) {
      alert('Debe agregar al menos un material al producto');
      return;
    }

    try {
      const nombre = formatProductName(formData.familia, formData.medida, formData.caracteristica);
      const pesoUnidad = calculatePesoUnidad();

      const productData: ProductInsert = {
        tenant_id: tenantId,
        nombre,
        familia: formData.familia || null,
        medida: formData.medida || null,
        caracteristica: formData.caracteristica || null,
        peso_unidad: pesoUnidad,
        precio_venta: formData.precio_venta ? parseFloat(formData.precio_venta) : null,
        cantidad_fabricar: parseInt(formData.cantidad_fabricar) || 0,
        cantidad_por_hora: parseFloat(formData.cantidad_por_hora) || 0,
        iibb_porcentaje: parseFloat(formData.iibb_porcentaje) || 0,
        moneda_precio: formData.moneda_precio,
      };

      let productId: string;

      if (editingProduct) {
        const { error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', editingProduct.id);

        if (error) throw error;
        productId = editingProduct.id;

        // Eliminar materiales existentes
        await supabase
          .from('product_materials')
          .delete()
          .eq('product_id', productId);
      } else {
        const { data, error } = await supabase
          .from('products')
          .insert(productData)
          .select()
          .single();

        if (error) throw error;
        productId = data.id;
      }

      // Guardar materiales
      if (formMaterials.length > 0) {
        const materialsData: ProductMaterialInsert[] = formMaterials.map(mat => ({
          product_id: productId,
          material_name: mat.material_name,
          kg_por_unidad: parseFloat(mat.kg_por_unidad),
        }));

        const { error: materialsError } = await supabase
          .from('product_materials')
          .insert(materialsData);

        if (materialsError) throw materialsError;
      }

      resetForm();
      loadProducts();
    } catch (error) {
      console.error('Error saving product:', error);
      alert('Error al guardar el producto');
    }
  };

  const handleEdit = async (product: Product) => {
    const parsed = parseProductName(product.nombre);
    setFormData({
      nombre: product.nombre,
      familia: parsed.familia,
      medida: parsed.medida,
      caracteristica: parsed.caracteristica,
      peso_unidad: '', // Ya no se usa, se calcula automáticamente
      precio_venta: product.precio_venta?.toString() || '',
      cantidad_fabricar: product.cantidad_fabricar.toString(),
      cantidad_por_hora: product.cantidad_por_hora.toString(),
      iibb_porcentaje: product.iibb_porcentaje.toString(),
      moneda_precio: product.moneda_precio,
    });
    
    // Cargar materiales del producto
    const { data: mats } = await supabase
      .from('product_materials')
      .select('*')
      .eq('product_id', product.id);
    
    if (mats) {
      setFormMaterials(mats.map(m => ({
        material_name: m.material_name,
        kg_por_unidad: m.kg_por_unidad.toString(),
      })));
    } else {
      setFormMaterials([]);
    }
    
    setEditingProduct(product);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Está seguro de eliminar este producto?')) return;

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadProducts();
    } catch (error) {
      console.error('Error deleting product:', error);
      alert('Error al eliminar el producto');
    }
  };

  const completeProduction = async (product: Product) => {
    if (!tenantId) {
      alert('Error: No se pudo identificar la empresa');
      return;
    }

    if (!confirm(`¿Desea completar la producción de "${product.nombre}" y enviarla al stock?`)) {
      return;
    }

    try {
      const productMaterials = materials[product.id] || [];
      const cantidad = product.cantidad_fabricar || 0;

      if (cantidad <= 0) {
        alert('La cantidad a fabricar debe ser mayor a 0');
        return;
      }

      // Validar stock de materiales
      for (const mat of productMaterials) {
        const stockMat = stockMaterials.find(m => m.material === mat.material_name);
        if (!stockMat) {
          alert(`No se encontró el material "${mat.material_name}" en el stock`);
          return;
        }
        const kgNecesarios = mat.kg_por_unidad * cantidad;
        if (stockMat.kg < kgNecesarios) {
          alert(`Stock insuficiente de "${mat.material_name}". Disponible: ${stockMat.kg.toFixed(2)} kg, Necesario: ${kgNecesarios.toFixed(2)} kg`);
          return;
        }
      }

      // Calcular costos
      const costs = calculateProductCost(product);
      const avgHourValue = calculateAverageEmployeeHourValue(employees);
      const materialPrices: Record<string, { costo_kilo_usd: number; valor_dolar: number; moneda: 'ARS' | 'USD' }> = {};
      stockMaterials.forEach(mat => {
        materialPrices[mat.material] = {
          costo_kilo_usd: mat.costo_kilo_usd,
          valor_dolar: mat.valor_dolar,
          moneda: mat.moneda,
        };
      });

      const fullCosts = calculateProductCosts(
        product,
        productMaterials,
        materialPrices,
        avgHourValue
      );

      // Descontar materiales del stock
      for (const mat of productMaterials) {
        const stockMat = stockMaterials.find(m => m.material === mat.material_name);
        if (stockMat) {
          const kgNecesarios = mat.kg_por_unidad * cantidad;
          const nuevoStock = stockMat.kg - kgNecesarios;
          
          await supabase
            .from('stock_materials')
            .update({ kg: nuevoStock })
            .eq('id', stockMat.id);

          // Registrar movimiento de egreso de materia prima
          await supabase.from('inventory_movements').insert({
            tenant_id: tenantId,
            tipo: 'egreso_mp',
            item_nombre: mat.material_name,
            cantidad: kgNecesarios,
            motivo: `Producción: ${product.nombre}`,
          });
        }
      }

      // Actualizar o crear stock de productos fabricados
      const { data: existingStock } = await supabase
        .from('stock_products')
        .select('*')
        .eq('tenant_id', tenantId)
        .ilike('nombre', product.nombre)
        .limit(1);

      if (existingStock && existingStock.length > 0) {
        await supabase
          .from('stock_products')
          .update({
            cantidad: existingStock[0].cantidad + cantidad,
            costo_unit_total: fullCosts.costo_base_unitario,
          })
          .eq('id', existingStock[0].id);
      } else {
        await supabase.from('stock_products').insert({
          tenant_id: tenantId,
          nombre: product.nombre,
          cantidad: cantidad,
          peso_unidad: product.peso_unidad,
          costo_unit_total: fullCosts.costo_base_unitario,
        });
      }

      // Registrar movimiento de inventario (ingreso de producto fabricado)
      await supabase.from('inventory_movements').insert({
        tenant_id: tenantId,
        tipo: 'ingreso_fab',
        item_nombre: product.nombre,
        cantidad: cantidad,
        motivo: 'Producción completada',
      });

      // Calcular kg consumidos
      let kgConsumidos = 0;
      productMaterials.forEach(mat => {
        kgConsumidos += mat.kg_por_unidad * cantidad;
      });

      // Registrar métrica de producción
      await supabase.from('production_metrics').insert({
        tenant_id: tenantId,
        fecha: new Date().toISOString(),
        producto: product.nombre,
        cantidad: cantidad,
        peso_unidad: product.peso_unidad,
        kg_consumidos: kgConsumidos,
        costo_mp: fullCosts.costo_total_mp,
        costo_mo: fullCosts.incidencia_mano_obra,
        costo_prod_unit: fullCosts.costo_base_unitario,
        costo_total_mp: fullCosts.costo_total_mp,
        precio_venta: product.precio_venta,
        rentabilidad_neta: fullCosts.rentabilidad_neta,
        rentabilidad_total: fullCosts.rentabilidad_neta_total,
      });

      // Eliminar la orden de producción (o podrías marcarla como completada)
      await supabase
        .from('products')
        .delete()
        .eq('id', product.id);

      alert(`Producción de "${product.nombre}" completada y enviada al stock`);
      loadProducts();
      loadStockMaterials(); // Recargar stock para actualizar los valores
    } catch (error: any) {
      console.error('Error completing production:', error);
      alert(`Error al completar la producción: ${error?.message || 'Error desconocido'}`);
    }
  };

  const resetForm = () => {
    setFormData({
      nombre: '',
      familia: '',
      medida: '',
      caracteristica: '',
      peso_unidad: '',
      precio_venta: '',
      cantidad_fabricar: '',
      cantidad_por_hora: '',
      iibb_porcentaje: '',
      moneda_precio: 'ARS',
    });
    setFormMaterials([]);
    setNewMaterial({ material_name: '', kg_por_unidad: '' });
    setEditingProduct(null);
    setShowForm(false);
  };

  const addMaterial = () => {
    if (!newMaterial.material_name || !newMaterial.kg_por_unidad) {
      alert('Por favor complete todos los campos del material');
      return;
    }
    if (parseFloat(newMaterial.kg_por_unidad) <= 0) {
      alert('El kg por unidad debe ser mayor a 0');
      return;
    }
    setFormMaterials([...formMaterials, { ...newMaterial }]);
    setNewMaterial({ material_name: '', kg_por_unidad: '' });
  };

  const removeMaterial = (index: number) => {
    setFormMaterials(formMaterials.filter((_, i) => i !== index));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">Cargando productos...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 -mx-6 -mt-6 mb-6">
        <div className="flex items-center space-x-3 mb-2">
          <Factory className="w-6 h-6 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Producción</h1>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300">Gestión de órdenes de producción. Complete las órdenes para enviarlas al stock de productos fabricados.</p>
      </div>

      {/* Header with Add Button */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Órdenes de Producción</h2>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          <span>Nuevo Producto</span>
        </button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
              </h3>
              <button onClick={resetForm} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Familia *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.familia}
                    onChange={(e) => setFormData({ ...formData, familia: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Medida
                  </label>
                  <input
                    type="text"
                    value={formData.medida}
                    onChange={(e) => setFormData({ ...formData, medida: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Característica
                  </label>
                  <input
                    type="text"
                    value={formData.caracteristica}
                    onChange={(e) => setFormData({ ...formData, caracteristica: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Precio de venta
                  </label>
                  <div className="flex">
                    <input
                      type="number"
                      step="0.01"
                      value={formData.precio_venta}
                      onChange={(e) => setFormData({ ...formData, precio_venta: e.target.value })}
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                    <select
                      value={formData.moneda_precio}
                      onChange={(e) => setFormData({ ...formData, moneda_precio: e.target.value as 'ARS' | 'USD' })}
                      className="px-3 py-2 border border-l-0 border-gray-300 dark:border-gray-600 rounded-r-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="ARS">ARS</option>
                      <option value="USD">USD</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Cantidad a fabricar
                  </label>
                  <input
                    type="number"
                    value={formData.cantidad_fabricar}
                    onChange={(e) => setFormData({ ...formData, cantidad_fabricar: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Cantidad por hora
                  </label>
                  <input
                    type="number"
                    step="0.00001"
                    value={formData.cantidad_por_hora}
                    onChange={(e) => setFormData({ ...formData, cantidad_por_hora: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    IIBB (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.iibb_porcentaje}
                    onChange={(e) => setFormData({ ...formData, iibb_porcentaje: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Sección de Materiales */}
              <div className="border-t pt-4 mt-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Materiales</h4>
                  {formMaterials.length > 0 && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Peso total: <strong>{calculatePesoUnidad().toFixed(5)} kg/unidad</strong>
                    </span>
                  )}
                </div>
                
                {/* Lista de materiales agregados */}
                {formMaterials.length > 0 && (
                  <div className="mb-4 space-y-2 max-h-32 overflow-y-auto">
                    {formMaterials.map((mat, index) => (
                      <div key={index} className="flex items-center justify-between gap-2 p-2 bg-gray-50 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600">
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          <strong className="font-medium">{mat.material_name}</strong> - {parseFloat(mat.kg_por_unidad).toFixed(5)} kg/unidad
                        </span>
                        <button
                          type="button"
                          onClick={() => removeMaterial(index)}
                          className="flex-shrink-0 p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition"
                          title="Eliminar material"
                        >
                          <Trash className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Formulario para agregar material */}
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                    <div className="md:col-span-7">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Material
                      </label>
                      <select
                        value={newMaterial.material_name}
                        onChange={(e) => setNewMaterial({ ...newMaterial, material_name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="">Seleccione un material</option>
                        {stockMaterials.map((mat) => (
                          <option key={mat.id} value={mat.material}>
                            {mat.material} (Stock: {mat.kg.toFixed(2)} kg)
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="md:col-span-4">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Kg por unidad
                      </label>
                      <input
                        type="number"
                        step="0.00001"
                        value={newMaterial.kg_por_unidad}
                        onChange={(e) => setNewMaterial({ ...newMaterial, kg_por_unidad: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="0.00000"
                      />
                    </div>
                    <div className="md:col-span-1 flex items-end">
                      <button
                        type="button"
                        onClick={addMaterial}
                        disabled={!newMaterial.material_name || !newMaterial.kg_por_unidad}
                        className="w-full px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition flex items-center justify-center"
                        title="Agregar material"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {stockMaterials.length === 0 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                      No hay materiales en stock. Agregue materiales en el módulo de Stock primero.
                    </p>
                  )}
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

      {/* Products Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Nombre
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Peso (kg)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Precio Venta
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Cant. Fabricar
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Productividad
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Costo MP (ARS)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Costo MO (ARS)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Costo Unitario (ARS)
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {products.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                    No hay órdenes de producción registradas
                  </td>
                </tr>
              ) : (
                products.map((product) => {
                  const costs = calculateProductCost(product);
                  return (
                    <tr key={product.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">{product.nombre}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {product.peso_unidad.toFixed(5)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {product.precio_venta
                          ? `$${product.precio_venta.toFixed(2)} (${product.moneda_precio})`
                          : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {product.cantidad_fabricar}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {product.cantidad_por_hora.toFixed(5)} u/h
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300 font-medium">
                        ${costs.costoMP.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300 font-medium">
                        ${costs.costoMO.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 dark:text-blue-400 font-semibold">
                        ${costs.costoTotal.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300">
                          Pendiente
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => completeProduction(product)}
                            className="text-green-600 dark:text-green-400 hover:text-green-900 dark:hover:text-green-300"
                            title="Completar producción y enviar al stock"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEdit(product)}
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
                            title="Editar orden"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(product.id)}
                            className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                            title="Eliminar orden"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

