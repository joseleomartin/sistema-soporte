/**
 * Módulo de Stock
 * Gestión de inventario: Materia Prima, Productos Fabricados, Productos de Reventa
 */

import { useState, useEffect } from 'react';
import { Package, Plus, Edit, Trash2, Save, X, Upload, Download, History, Calendar, DollarSign, Truck, Eye } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useTenant } from '../../../contexts/TenantContext';
import { Database } from '../../../lib/database.types';
import { parseProductName } from '../../../lib/fabinsaCalculations';
import { useDepartmentPermissions } from '../../../hooks/useDepartmentPermissions';
import { useMobile } from '../../../hooks/useMobile';
import { BulkImportStockModal } from './BulkImportStockModal';

type PurchaseMaterial = Database['public']['Tables']['purchases_materials']['Row'];
type PurchaseProduct = Database['public']['Tables']['purchases_products']['Row'];
type Sale = Database['public']['Tables']['sales']['Row'];
type InventoryMovement = Database['public']['Tables']['inventory_movements']['Row'];

type StockMaterial = Database['public']['Tables']['stock_materials']['Row'];
type StockMaterialInsert = Database['public']['Tables']['stock_materials']['Insert'];
type StockProduct = Database['public']['Tables']['stock_products']['Row'];
type StockProductInsert = Database['public']['Tables']['stock_products']['Insert'];
type ResaleProduct = Database['public']['Tables']['resale_products']['Row'];
type ResaleProductInsert = Database['public']['Tables']['resale_products']['Insert'];

type TabType = 'materials' | 'products' | 'resale' | 'reception';

export function StockModule() {
  const { tenantId } = useTenant();
  const { canCreate, canEdit, canDelete } = useDepartmentPermissions();
  const isMobile = useMobile();
  const [activeTab, setActiveTab] = useState<TabType>('materials');
  
  // Materia Prima
  const [materials, setMaterials] = useState<StockMaterial[]>([]);
  const [showMaterialForm, setShowMaterialForm] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<StockMaterial | null>(null);
  const [materialForm, setMaterialForm] = useState({
    nombre: '',
    material: '',
    stock_minimo: '',
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
    stock_minimo: '',
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
    stock_minimo: '',
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
  const [productSales, setProductSales] = useState<Sale[]>([]);
  const [resaleInventoryMovements, setResaleInventoryMovements] = useState<InventoryMovement[]>([]);
  const [loadingResaleMovements, setLoadingResaleMovements] = useState(false);

  // Modal de importación
  const [showImportModal, setShowImportModal] = useState(false);

  // Control de Recepción (Compras)
  const [receptionControls, setReceptionControls] = useState<any[]>([]);
  const [receptionItems, setReceptionItems] = useState<Record<string, any[]>>({});
  const [receptionQuantities, setReceptionQuantities] = useState<Record<string, Record<string, number>>>({});
  const [loadingReception, setLoadingReception] = useState(false);
  const [receptionFilter, setReceptionFilter] = useState<'all' | 'completed' | 'pending'>('all');

  const loadReceptionControls = async () => {
    if (!tenantId) return;
    setLoadingReception(true);
    try {
      console.log('Cargando controles de recepción para tenant:', tenantId);
      
      // Cargar controles (pendientes y completados)
      const { data: controls, error } = await supabase
        .from('purchase_reception_control')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error al cargar controles de recepción:', error);
        throw error;
      }

      console.log('Controles encontrados:', controls?.length || 0, controls);
      setReceptionControls(controls || []);

      // Cargar items de cada control
      const itemsMap: Record<string, any[]> = {};
      const quantitiesMap: Record<string, Record<string, number>> = {};

      for (const control of controls || []) {
        const { data: items, error: itemsError } = await supabase
          .from('purchase_reception_items')
          .select('*')
          .eq('reception_control_id', control.id)
          .order('created_at', { ascending: true });

        if (itemsError) {
          console.error('Error al cargar items del control:', control.id, itemsError);
          throw itemsError;
        }
        
        console.log(`Items para control ${control.id}:`, items?.length || 0);
        itemsMap[control.id] = items || [];

        // Inicializar cantidades recibidas (usar cantidad_recibida si existe, sino cantidad_esperada)
        const qtyMap: Record<string, number> = {};
        (items || []).forEach((item: any) => {
          // Si el control está completado, usar cantidad_recibida guardada
          // Si está pendiente, usar cantidad_esperada como valor inicial
          qtyMap[item.id] = control.estado === 'completado' 
            ? (item.cantidad_recibida || item.cantidad_esperada)
            : (item.cantidad_recibida || item.cantidad_esperada);
        });
        quantitiesMap[control.id] = qtyMap;
      }

      setReceptionItems(itemsMap);
      setReceptionQuantities(quantitiesMap);
    } catch (error) {
      console.error('Error loading reception controls:', error);
      alert('Error al cargar controles de recepción. Verifica la consola para más detalles.');
    } finally {
      setLoadingReception(false);
    }
  };

  const handleUpdateReceptionQuantity = (controlId: string, itemId: string, quantity: number) => {
    setReceptionQuantities(prev => ({
      ...prev,
      [controlId]: {
        ...prev[controlId],
        [itemId]: quantity,
      },
    }));
  };

  const handleCompleteReception = async (control: any) => {
    if (!tenantId) return;
    
    const items = receptionItems[control.id] || [];
    const quantities = receptionQuantities[control.id] || {};

    // Validar que todas las cantidades estén ingresadas
    for (const item of items) {
      if (!quantities[item.id] || quantities[item.id] <= 0) {
        alert(`Por favor ingrese la cantidad recibida para ${item.item_nombre}`);
        return;
      }
    }

    if (!confirm('¿Confirmar el control de recepción y actualizar el stock?')) {
      return;
    }

    try {
      // Actualizar cantidades recibidas en los items
      for (const item of items) {
        const { error: updateError } = await supabase
          .from('purchase_reception_items')
          .update({ cantidad_recibida: quantities[item.id] })
          .eq('id', item.id);

        if (updateError) throw updateError;
      }

      // Actualizar stock según el tipo de compra
      if (control.purchase_type === 'material') {
        // Cargar la orden de compra para obtener los materiales
        const { data: purchases, error: purchasesError } = await supabase
          .from('purchases_materials')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('order_id', control.order_id);

        if (purchasesError) throw purchasesError;

        for (const purchase of purchases || []) {
          // Buscar el item de recepción correspondiente
          const receptionItem = items.find((item: any) => item.item_nombre === purchase.material);
          if (!receptionItem) {
            console.warn(`No se encontró item de recepción para material: ${purchase.material}`);
            continue;
          }

          // Obtener cantidad recibida, usar cantidad_recibida del item si no está en quantities
          const cantidadRecibida = quantities[receptionItem.id] ?? receptionItem.cantidad_recibida ?? receptionItem.cantidad_esperada;
          
          if (!cantidadRecibida || cantidadRecibida <= 0) {
            console.warn(`Cantidad recibida inválida para material: ${purchase.material}`, cantidadRecibida);
            continue;
          }

          // Buscar o crear el material en stock
          const { data: existingMaterial, error: findError } = await supabase
            .from('stock_materials')
            .select('*')
            .eq('tenant_id', tenantId)
            .eq('nombre', purchase.material)
            .maybeSingle();

          if (findError && findError.code !== 'PGRST116') {
            console.error('Error buscando material:', findError);
            throw findError;
          }

          if (existingMaterial) {
            // Actualizar cantidad existente (usar kg)
            // purchase.precio siempre está en ARS (es precioARS guardado en la compra)
            // Si la compra fue en USD, necesitamos convertir de vuelta a USD para actualizar costo_kilo_usd
            const costoKiloUSD = purchase.moneda === 'USD' && purchase.valor_dolar
              ? purchase.precio / purchase.valor_dolar  // Convertir de ARS a USD
              : purchase.precio; // Si fue en ARS, el precio ya está en ARS
            
            const { error: updateError } = await supabase
              .from('stock_materials')
              .update({ 
                kg: (existingMaterial.kg || 0) + cantidadRecibida,
                costo_kilo_usd: costoKiloUSD,
                valor_dolar: purchase.valor_dolar || existingMaterial.valor_dolar || 1,
                moneda: purchase.moneda || existingMaterial.moneda || 'ARS',
              })
              .eq('id', existingMaterial.id);

            if (updateError) {
              console.error('Error actualizando material:', updateError);
              throw updateError;
            }
          } else {
            // Crear nuevo material en stock
            // purchase.precio siempre está en ARS (es precioARS guardado en la compra)
            // Si la compra fue en USD, necesitamos convertir de vuelta a USD para guardar en costo_kilo_usd
            const costoKiloUSD = purchase.moneda === 'USD' && purchase.valor_dolar
              ? purchase.precio / purchase.valor_dolar  // Convertir de ARS a USD
              : purchase.precio; // Si fue en ARS, el precio ya está en ARS
            
            const { error: insertError } = await supabase
              .from('stock_materials')
              .insert({
                tenant_id: tenantId,
                nombre: purchase.material,
                material: purchase.material,
                kg: cantidadRecibida,
                costo_kilo_usd: costoKiloUSD,
                valor_dolar: purchase.valor_dolar || 1,
                moneda: purchase.moneda || 'ARS',
              });

            if (insertError) {
              console.error('Error insertando material:', insertError);
              throw insertError;
            }
          }

          // Registrar movimiento de inventario
          const { error: movementError } = await supabase.from('inventory_movements').insert({
            tenant_id: tenantId,
            tipo: 'ingreso_mp',
            item_nombre: purchase.material,
            cantidad: cantidadRecibida,
            motivo: `Recepción de compra - Orden ${control.order_id.substring(0, 8)}`,
          });

          if (movementError) {
            console.error('Error insertando movimiento de inventario:', movementError);
            throw movementError;
          }
        }
      } else if (control.purchase_type === 'product') {
        // Similar para productos
        const { data: purchases, error: purchasesError } = await supabase
          .from('purchases_products')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('order_id', control.order_id);

        if (purchasesError) throw purchasesError;

        for (const purchase of purchases || []) {
          const receptionItem = items.find((item: any) => item.item_nombre === purchase.producto);
          if (!receptionItem) {
            console.warn(`No se encontró item de recepción para producto: ${purchase.producto}`);
            continue;
          }

          // Obtener cantidad recibida, usar cantidad_recibida del item si no está en quantities
          const cantidadRecibida = quantities[receptionItem.id] ?? receptionItem.cantidad_recibida ?? receptionItem.cantidad_esperada;
          
          if (!cantidadRecibida || cantidadRecibida <= 0) {
            console.warn(`Cantidad recibida inválida para producto: ${purchase.producto}`, cantidadRecibida);
            continue;
          }

          const { data: existingProduct, error: findError } = await supabase
            .from('resale_products')
            .select('*')
            .eq('tenant_id', tenantId)
            .eq('nombre', purchase.producto)
            .maybeSingle();

          if (findError && findError.code !== 'PGRST116') {
            console.error('Error buscando producto de reventa:', findError);
            throw findError;
          }

          // purchase.precio siempre está en ARS (es precioARS guardado en la compra)
          // Si la compra fue en USD, necesitamos convertir de vuelta a USD para guardar en costo_unitario
          const costo_unitario = purchase.moneda === 'USD' && purchase.valor_dolar
            ? purchase.precio / purchase.valor_dolar  // Convertir de ARS a USD
            : purchase.precio; // Si fue en ARS, el precio ya está en ARS
          
          // Calcular costo final siempre en pesos
          const costo_unitario_en_pesos = purchase.moneda === 'USD' && purchase.valor_dolar
            ? costo_unitario * purchase.valor_dolar
            : costo_unitario;
          const costo_unitario_final = costo_unitario_en_pesos; // Sin otros costos por defecto

          if (existingProduct) {
            const { error: updateError } = await supabase
              .from('resale_products')
              .update({ 
                cantidad: (existingProduct.cantidad || 0) + cantidadRecibida,
                costo_unitario: costo_unitario,
                costo_unitario_final: costo_unitario_final,
                valor_dolar: purchase.valor_dolar || existingProduct.valor_dolar || null,
                moneda: purchase.moneda || existingProduct.moneda || 'ARS',
              })
              .eq('id', existingProduct.id);

            if (updateError) {
              console.error('Error actualizando producto de reventa:', updateError);
              throw updateError;
            }
          } else {
            const { error: insertError } = await supabase
              .from('resale_products')
              .insert({
                tenant_id: tenantId,
                nombre: purchase.producto,
                cantidad: cantidadRecibida,
                costo_unitario: costo_unitario,
                otros_costos: 0,
                costo_unitario_final: costo_unitario_final,
                moneda: purchase.moneda || 'ARS',
                valor_dolar: purchase.valor_dolar || null,
              });

            if (insertError) {
              console.error('Error insertando producto de reventa:', insertError);
              throw insertError;
            }
          }

          const { error: movementError } = await supabase.from('inventory_movements').insert({
            tenant_id: tenantId,
            tipo: 'ingreso_pr',
            item_nombre: purchase.producto,
            cantidad: cantidadRecibida,
            motivo: `Recepción de compra - Orden ${control.order_id.substring(0, 8)}`,
          });

          if (movementError) {
            console.error('Error insertando movimiento de inventario:', movementError);
            throw movementError;
          }
        }
      }

      // Marcar control como completado
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id || null;
      
      const { error: completeError } = await supabase
        .from('purchase_reception_control')
        .update({
          estado: 'completado',
          fecha_control: new Date().toISOString(),
          controlado_por: userId,
        })
        .eq('id', control.id);

      if (completeError) throw completeError;

      alert('Control de recepción completado y stock actualizado');
      await loadReceptionControls();
      await loadAllStock();
    } catch (error) {
      console.error('Error completing reception:', error);
      alert('Error al completar el control de recepción');
    }
  };


  useEffect(() => {
    if (tenantId) {
      loadAllStock();
      if (activeTab === 'reception') {
        loadReceptionControls();
      }
    }
  }, [tenantId, activeTab]);

  const loadMaterialMovements = async (material: StockMaterial) => {
    if (!tenantId) return;
    setLoadingMovements(true);
    try {
      // Cargar compras relacionadas con esta materia prima (incluyendo campos de IVA)
      // Buscar por nombre o material para mayor compatibilidad
      const materialSearchTerm = material.nombre || material.material || '';
      const { data: purchases, error: purchasesError } = await supabase
        .from('purchases_materials')
        .select('*, tiene_iva, iva_pct')
        .eq('tenant_id', tenantId)
        .ilike('material', `%${materialSearchTerm}%`)
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
      // Cargar compras relacionadas con este producto de reventa (incluyendo campos de IVA)
      const { data: purchases, error: purchasesError } = await supabase
        .from('purchases_products')
        .select('*, tiene_iva, iva_pct')
        .eq('tenant_id', tenantId)
        .ilike('producto', product.nombre)
        .order('fecha', { ascending: false });

      if (purchasesError) throw purchasesError;
      setProductPurchases(purchases || []);

      // Cargar ventas relacionadas con este producto de reventa
      const { data: sales, error: salesError } = await supabase
        .from('sales')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('tipo_producto', 'reventa')
        .ilike('producto', product.nombre)
        .order('fecha', { ascending: false });

      if (salesError) throw salesError;
      setProductSales(sales || []);

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
      // Load materials - cargar todos sin límite
      const { data: mats, error: matsError, count } = await supabase
        .from('stock_materials')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });
      
      if (matsError) {
        console.error('Error cargando materiales:', matsError);
        throw matsError;
      }
      
      console.log(`Materiales cargados: ${mats?.length || 0} de ${count || 'desconocido'}`);
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
        kg: 0, // Se actualiza automáticamente con las compras
        costo_kilo_usd: 0, // Se actualiza automáticamente con las compras
        valor_dolar: 1,
        moneda: 'ARS',
        stock_minimo: materialForm.stock_minimo ? parseFloat(materialForm.stock_minimo) : 0,
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
      stock_minimo: '',
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
        stock_minimo: productForm.stock_minimo ? parseInt(productForm.stock_minimo) : 0,
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
      stock_minimo: '',
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
      const valor_dolar = resaleForm.valor_dolar ? parseFloat(resaleForm.valor_dolar) : 1;
      
      // Calcular costo final siempre en pesos
      // Si el costo unitario está en USD, convertirlo a pesos multiplicando por valor_dolar
      const costo_unitario_en_pesos = resaleForm.moneda === 'USD' 
        ? costo_unitario * valor_dolar 
        : costo_unitario;
      
      // El costo final es el costo unitario en pesos + otros costos (que siempre están en pesos)
      const costo_unitario_final = costo_unitario_en_pesos + otros_costos;

      const data: ResaleProductInsert = {
        tenant_id: tenantId,
        nombre: resaleForm.nombre,
        cantidad: parseInt(resaleForm.cantidad),
        costo_unitario,
        otros_costos,
        costo_unitario_final,
        moneda: resaleForm.moneda,
        valor_dolar: resaleForm.valor_dolar ? parseFloat(resaleForm.valor_dolar) : null,
        stock_minimo: resaleForm.stock_minimo ? parseInt(resaleForm.stock_minimo) : 0,
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
      stock_minimo: '',
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
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-4 -mx-4 sm:-mx-6 -mt-4 sm:-mt-6 mb-4 sm:mb-6">
        <div className="flex items-center space-x-2 sm:space-x-3 mb-2">
          <Package className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Stock</h1>
        </div>
        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">Gestión de inventario: Materia Prima, Productos Fabricados, Productos de Reventa</p>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 mb-4 sm:mb-6">
        <div className={`flex ${isMobile ? 'overflow-x-auto scrollbar-hide' : 'space-x-1'}`}>
          {[
            { id: 'materials' as TabType, label: 'Materia Prima' },
            { id: 'products' as TabType, label: 'Productos Fabricados' },
            { id: 'resale' as TabType, label: 'Productos de Reventa' },
            { id: 'reception' as TabType, label: 'Control de Recepción' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`${isMobile ? 'px-3 py-2 text-xs whitespace-nowrap flex-shrink-0' : 'px-4 py-3 text-sm'} font-medium border-b-2 transition-colors ${
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
          <div className={`flex ${isMobile ? 'flex-col gap-3' : 'justify-between items-center'} mb-4`}>
            <div>
              <h2 className={`${isMobile ? 'text-base' : 'text-lg'} font-semibold text-gray-900 dark:text-white`}>Materia Prima</h2>
              {materials.length > 0 && (
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Total: {materials.length} material{materials.length !== 1 ? 'es' : ''}
                </p>
              )}
            </div>
            <div className={`flex ${isMobile ? 'flex-col w-full gap-2' : 'items-center space-x-2'}`}>
              {canCreate('fabinsa-stock') && (
                <>
                  <button
                    onClick={() => {
                      setShowImportModal(true);
                    }}
                    className={`flex items-center justify-center space-x-2 ${isMobile ? 'w-full px-4 py-3' : 'px-4 py-2'} bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors touch-manipulation`}
                  >
                    <Upload className="w-4 h-4" />
                    <span>Importar</span>
                  </button>
                  <button
                    onClick={() => setShowMaterialForm(true)}
                    className={`flex items-center justify-center space-x-2 ${isMobile ? 'w-full px-4 py-3' : 'px-4 py-2'} bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors touch-manipulation`}
                  >
                    <Plus className="w-4 h-4" />
                    <span>Agregar</span>
                  </button>
                </>
              )}
            </div>
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
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Stock Mínimo (kg)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={materialForm.stock_minimo}
                      onChange={(e) => setMaterialForm({ ...materialForm, stock_minimo: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="Cantidad mínima de stock en kilos"
                    />
                  </div>
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

          {/* Materials - Mobile Cards View */}
          {isMobile ? (
            <div className="space-y-3">
              {materials.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center text-gray-500 dark:text-gray-400">
                  No hay materia prima registrada
                </div>
              ) : (
                materials.map((mat) => {
                  const stockMinimo = mat.stock_minimo || 0;
                  const stockBajo = mat.kg < stockMinimo;
                  return (
                    <div
                      key={mat.id}
                      className={`bg-white dark:bg-gray-800 rounded-lg shadow p-4 border-l-4 ${
                        stockBajo ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : 'border-transparent'
                      }`}
                    >
                      {/* Header */}
                      <div className="mb-3">
                        <button
                          onClick={() => openMovementsModal(mat)}
                          className="text-base font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 hover:underline mb-1"
                        >
                          {mat.nombre}
                        </button>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{mat.material}</p>
                      </div>

                      {/* Información principal */}
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Cantidad (kg)</p>
                          <p className={`text-sm font-medium ${
                            stockBajo ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'
                          }`}>
                            {mat.kg.toFixed(2)}
                            {stockBajo && (
                              <span className="ml-2 px-2 py-0.5 text-xs bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded">
                                ⚠ Bajo
                              </span>
                            )}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Stock Mínimo (kg)</p>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{stockMinimo.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Costo/kg</p>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            ${mat.costo_kilo_usd.toFixed(2)} {mat.moneda}
                            {mat.moneda === 'USD' && mat.valor_dolar && (
                              <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                (${(mat.costo_kilo_usd * mat.valor_dolar).toFixed(2)} ARS)
                              </span>
                            )}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Moneda</p>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{mat.moneda}</p>
                        </div>
                      </div>

                      {/* Botones de acción */}
                      <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                        {canEdit('fabinsa-stock') && (
                          <button
                            onClick={() => {
                              setEditingMaterial(mat);
                              setMaterialForm({
                                nombre: mat.nombre,
                                material: mat.material,
                                stock_minimo: (mat.stock_minimo || 0).toString(),
                              });
                              setShowMaterialForm(true);
                            }}
                            className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 touch-manipulation flex-1 min-w-[100px]"
                          >
                            <Edit className="w-4 h-4" />
                            Editar
                          </button>
                        )}
                        {canDelete('fabinsa-stock') && (
                          <button
                            onClick={async () => {
                              if (confirm('¿Eliminar?')) {
                                await supabase.from('stock_materials').delete().eq('id', mat.id);
                                loadAllStock();
                              }
                            }}
                            className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50 touch-manipulation flex-1 min-w-[100px]"
                          >
                            <Trash2 className="w-4 h-4" />
                            Eliminar
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            /* Materials Table - Desktop View */
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Nombre</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Material</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Cantidad (kg)</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Stock Mínimo (kg)</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Costo/kg</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Moneda</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {materials.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                      No hay materia prima registrada
                    </td>
                  </tr>
                ) : (
                  materials.map((mat) => {
                    const stockMinimo = mat.stock_minimo || 0;
                    const stockBajo = mat.kg < stockMinimo;
                    return (
                      <tr 
                        key={mat.id} 
                        className={`hover:bg-gray-50 dark:hover:bg-gray-700 ${
                          stockBajo ? 'bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500' : ''
                        }`}
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <button
                            onClick={() => openMovementsModal(mat)}
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 hover:underline font-medium"
                          >
                            {mat.nombre}
                          </button>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{mat.material}</td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${
                          stockBajo ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'
                        }`}>
                          {mat.kg.toFixed(2)}
                          {stockBajo && (
                            <span className="ml-2 px-2 py-1 text-xs bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded">
                              ⚠ Bajo
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {stockMinimo.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          <div>
                            ${mat.costo_kilo_usd.toFixed(2)} {mat.moneda}
                            {mat.moneda === 'USD' && mat.valor_dolar && (
                              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                (${(mat.costo_kilo_usd * mat.valor_dolar).toFixed(2)} ARS)
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{mat.moneda}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <div className="flex justify-end space-x-2">
                          {canEdit('fabinsa-stock') && (
                            <button
                              onClick={() => {
                                setEditingMaterial(mat);
                                setMaterialForm({
                                  nombre: mat.nombre,
                                  material: mat.material,
                                  stock_minimo: (mat.stock_minimo || 0).toString(),
                                });
                                setShowMaterialForm(true);
                              }}
                              className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          )}
                          {canDelete('fabinsa-stock') && (
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
          )}

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
                                      {(() => {
                                        // Mostrar costo base (sin IVA)
                                        const precioBase = purchase.moneda === 'USD' && purchase.valor_dolar 
                                          ? purchase.precio / purchase.valor_dolar 
                                          : purchase.precio;
                                        
                                        return purchase.moneda === 'USD' && purchase.valor_dolar ? (
                                          <div className="flex items-center space-x-1">
                                            <DollarSign className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                                            <span>${precioBase.toFixed(2)} USD</span>
                                          </div>
                                        ) : (
                                          <div className="flex items-center space-x-1">
                                            <DollarSign className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                                            <span>${precioBase.toFixed(2)} ARS</span>
                                          </div>
                                        );
                                      })()}
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
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Precio/kg</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Motivo</th>
                                </tr>
                              </thead>
                              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                {inventoryMovements.map((movement) => {
                                  // Buscar compra relacionada para obtener el precio
                                  let relatedPurchase: PurchaseMaterial | undefined;
                                  
                                  // Si el motivo contiene "Recepción de compra - Orden", extraer el order_id
                                  if (movement.motivo && movement.motivo.includes('Recepción de compra - Orden')) {
                                    const orderIdMatch = movement.motivo.match(/Orden ([a-f0-9-]+)/i);
                                    if (orderIdMatch) {
                                      const orderIdPrefix = orderIdMatch[1].substring(0, 8);
                                      // Buscar compra que coincida con el order_id y el material (por nombre o material)
                                      relatedPurchase = materialPurchases.find(p => {
                                        const purchaseOrderId = (p as any).order_id?.substring(0, 8);
                                        return purchaseOrderId === orderIdPrefix && 
                                               (p.material === selectedMaterial?.nombre || 
                                                p.material === selectedMaterial?.material ||
                                                p.material?.toLowerCase() === selectedMaterial?.nombre?.toLowerCase());
                                      });
                                    }
                                  }
                                  
                                  // Si no se encontró por order_id, intentar buscar por fecha y material
                                  if (!relatedPurchase && movement.tipo === 'ingreso_mp') {
                                    const movementDate = new Date(movement.created_at).toISOString().split('T')[0];
                                    relatedPurchase = materialPurchases.find(p => {
                                      const purchaseDate = new Date(p.fecha).toISOString().split('T')[0];
                                      return purchaseDate === movementDate && 
                                             (p.material === selectedMaterial?.nombre || 
                                              p.material === selectedMaterial?.material ||
                                              p.material?.toLowerCase() === selectedMaterial?.nombre?.toLowerCase());
                                    });
                                  }
                                  
                                  return (
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
                                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                        {relatedPurchase ? (
                                          <div>
                                            {(() => {
                                              const precioUnitario = relatedPurchase.moneda === 'USD' && relatedPurchase.valor_dolar 
                                                ? relatedPurchase.precio / relatedPurchase.valor_dolar 
                                                : relatedPurchase.precio;
                                              
                                              return (
                                                <div>
                                                  <div className="font-medium">
                                                    ${precioUnitario.toFixed(2)} {relatedPurchase.moneda}
                                                  </div>
                                                  {relatedPurchase.moneda === 'USD' && relatedPurchase.valor_dolar && (
                                                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                                      Dólar: ${relatedPurchase.valor_dolar.toFixed(2)}
                                                    </div>
                                                  )}
                                                </div>
                                              );
                                            })()}
                                          </div>
                                        ) : (
                                          <span className="text-gray-400 dark:text-gray-500">-</span>
                                        )}
                                      </td>
                                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                                        {movement.motivo || '-'}
                                      </td>
                                    </tr>
                                  );
                                })}
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
          <div className={`flex ${isMobile ? 'flex-col gap-3' : 'justify-between items-center'} mb-4`}>
            <h2 className={`${isMobile ? 'text-base' : 'text-lg'} font-semibold text-gray-900 dark:text-white`}>Productos Fabricados</h2>
            <div className={`flex ${isMobile ? 'flex-col w-full gap-2' : 'items-center space-x-2'}`}>
              {canCreate('fabinsa-stock') && (
                <>
                  <button
                    onClick={() => {
                      setShowImportModal(true);
                    }}
                    className={`flex items-center justify-center space-x-2 ${isMobile ? 'w-full px-4 py-3' : 'px-4 py-2'} bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors touch-manipulation`}
                  >
                    <Upload className="w-4 h-4" />
                    <span>Importar</span>
                  </button>
                  <button
                    onClick={() => setShowProductForm(true)}
                    className={`flex items-center justify-center space-x-2 ${isMobile ? 'w-full px-4 py-3' : 'px-4 py-2'} bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors touch-manipulation`}
                  >
                    <Plus className="w-4 h-4" />
                    <span>Agregar</span>
                  </button>
                </>
              )}
            </div>
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
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Stock Mínimo (unidades)</label>
                    <input
                      type="number"
                      step="1"
                      value={productForm.stock_minimo}
                      onChange={(e) => setProductForm({ ...productForm, stock_minimo: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="Cantidad mínima de stock en unidades"
                    />
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

          {/* Products - Mobile Cards View */}
          {isMobile ? (
            <div className="space-y-3">
              {products.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center text-gray-500 dark:text-gray-400">
                  No hay productos fabricados registrados
                </div>
              ) : (
                products.map((prod) => {
                  const stockMinimo = prod.stock_minimo || 0;
                  const stockBajo = prod.cantidad < stockMinimo;
                  return (
                    <div
                      key={prod.id}
                      className={`bg-white dark:bg-gray-800 rounded-lg shadow p-4 border-l-4 ${
                        stockBajo ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : 'border-transparent'
                      }`}
                    >
                      {/* Header */}
                      <div className="mb-3">
                        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">{prod.nombre}</h3>
                      </div>

                      {/* Información principal */}
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Cantidad</p>
                          <p className={`text-sm font-medium ${
                            stockBajo ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'
                          }`}>
                            {prod.cantidad}
                            {stockBajo && (
                              <span className="ml-2 px-2 py-0.5 text-xs bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded">
                                ⚠ Bajo
                              </span>
                            )}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Stock Mínimo</p>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{stockMinimo}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Peso/unidad (kg)</p>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{prod.peso_unidad.toFixed(5)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Costo unitario</p>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {prod.costo_unit_total ? `$${prod.costo_unit_total.toFixed(2)}` : '-'}
                          </p>
                        </div>
                      </div>

                      {/* Botones de acción */}
                      <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                        {canEdit('fabinsa-stock') && (
                          <button
                            onClick={() => {
                              setEditingProduct(prod);
                              setProductForm({
                                nombre: prod.nombre,
                                cantidad: prod.cantidad.toString(),
                                peso_unidad: prod.peso_unidad.toString(),
                                costo_unit_total: prod.costo_unit_total?.toString() || '',
                                stock_minimo: (prod.stock_minimo || 0).toString(),
                              });
                              setShowProductForm(true);
                            }}
                            className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 touch-manipulation flex-1 min-w-[100px]"
                          >
                            <Edit className="w-4 h-4" />
                            Editar
                          </button>
                        )}
                        {canDelete('fabinsa-stock') && (
                          <button
                            onClick={async () => {
                              if (confirm('¿Eliminar?')) {
                                await supabase.from('stock_products').delete().eq('id', prod.id);
                                loadAllStock();
                              }
                            }}
                            className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50 touch-manipulation flex-1 min-w-[100px]"
                          >
                            <Trash2 className="w-4 h-4" />
                            Eliminar
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            /* Products Table - Desktop View */
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Nombre</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Cantidad</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Stock Mínimo</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Peso/unidad (kg)</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Costo unitario</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                      No hay productos fabricados registrados
                    </td>
                  </tr>
                ) : (
                  products.map((prod) => {
                    const stockMinimo = prod.stock_minimo || 0;
                    const stockBajo = prod.cantidad < stockMinimo;
                    return (
                      <tr 
                        key={prod.id} 
                        className={`hover:bg-gray-50 dark:hover:bg-gray-700 ${
                          stockBajo ? 'bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500' : ''
                        }`}
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{prod.nombre}</td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${
                          stockBajo ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'
                        }`}>
                          {prod.cantidad}
                          {stockBajo && (
                            <span className="ml-2 px-2 py-1 text-xs bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded">
                              ⚠ Bajo
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {stockMinimo}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{prod.peso_unidad.toFixed(5)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {prod.costo_unit_total ? `$${prod.costo_unit_total.toFixed(2)}` : '-'}
                        </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <div className="flex justify-end space-x-2">
                          {canEdit('fabinsa-stock') && (
                            <button
                              onClick={() => {
                                setEditingProduct(prod);
                                setProductForm({
                                  nombre: prod.nombre,
                                  cantidad: prod.cantidad.toString(),
                                  peso_unidad: prod.peso_unidad.toString(),
                                  costo_unit_total: prod.costo_unit_total?.toString() || '',
                                  stock_minimo: (prod.stock_minimo || 0).toString(),
                                });
                                setShowProductForm(true);
                              }}
                              className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          )}
                          {canDelete('fabinsa-stock') && (
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
          )}
        </div>
      )}

      {/* Productos de Reventa Tab */}
      {activeTab === 'resale' && (
        <div>
          <div className={`flex ${isMobile ? 'flex-col gap-3' : 'justify-between items-center'} mb-4`}>
            <h2 className={`${isMobile ? 'text-base' : 'text-lg'} font-semibold text-gray-900 dark:text-white`}>Productos de Reventa</h2>
            <div className={`flex ${isMobile ? 'flex-col w-full gap-2' : 'items-center space-x-2'}`}>
              {canCreate('fabinsa-stock') && (
                <>
                  <button
                    onClick={() => {
                      setShowImportModal(true);
                    }}
                    className={`flex items-center justify-center space-x-2 ${isMobile ? 'w-full px-4 py-3' : 'px-4 py-2'} bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors touch-manipulation`}
                  >
                    <Upload className="w-4 h-4" />
                    <span>Importar</span>
                  </button>
                  <button
                    onClick={() => setShowResaleForm(true)}
                    className={`flex items-center justify-center space-x-2 ${isMobile ? 'w-full px-4 py-3' : 'px-4 py-2'} bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors touch-manipulation`}
                  >
                    <Plus className="w-4 h-4" />
                    <span>Agregar</span>
                  </button>
                </>
              )}
            </div>
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
                          required
                          value={resaleForm.valor_dolar}
                          onChange={(e) => setResaleForm({ ...resaleForm, valor_dolar: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                      </div>
                    )}
                  </div>
                  {resaleForm.costo_unitario && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-4">
                      <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Vista Previa del Costo Final:</div>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Costo Unitario:</span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            ${parseFloat(resaleForm.costo_unitario || '0').toFixed(2)} {resaleForm.moneda}
                          </span>
                        </div>
                        {resaleForm.moneda === 'USD' && resaleForm.valor_dolar && (
                          <div className="flex justify-between text-gray-600 dark:text-gray-400">
                            <span>× Valor Dólar:</span>
                            <span>${parseFloat(resaleForm.valor_dolar).toFixed(2)}</span>
                          </div>
                        )}
                        {resaleForm.moneda === 'USD' && resaleForm.valor_dolar && (
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">Costo Unitario en Pesos:</span>
                            <span className="font-medium text-gray-900 dark:text-white">
                              ${(parseFloat(resaleForm.costo_unitario || '0') * parseFloat(resaleForm.valor_dolar)).toFixed(2)} ARS
                            </span>
                          </div>
                        )}
                        {parseFloat(resaleForm.otros_costos || '0') > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">Otros Costos:</span>
                            <span className="font-medium text-gray-900 dark:text-white">
                              ${parseFloat(resaleForm.otros_costos || '0').toFixed(2)} ARS
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between pt-2 border-t border-blue-200 dark:border-blue-800">
                          <span className="font-semibold text-gray-900 dark:text-white">Costo Final:</span>
                          <span className="font-bold text-blue-600 dark:text-blue-400">
                            ${(
                              (resaleForm.moneda === 'USD' && resaleForm.valor_dolar
                                ? parseFloat(resaleForm.costo_unitario || '0') * parseFloat(resaleForm.valor_dolar)
                                : parseFloat(resaleForm.costo_unitario || '0')
                              ) + parseFloat(resaleForm.otros_costos || '0')
                            ).toFixed(2)} ARS
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Stock Mínimo (unidades)</label>
                    <input
                      type="number"
                      step="1"
                      value={resaleForm.stock_minimo}
                      onChange={(e) => setResaleForm({ ...resaleForm, stock_minimo: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="Cantidad mínima de stock en unidades"
                    />
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

          {/* Resale Products - Mobile Cards View */}
          {isMobile ? (
            <div className="space-y-3">
              {resaleProducts.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center text-gray-500 dark:text-gray-400">
                  No hay productos de reventa registrados
                </div>
              ) : (
                resaleProducts.map((prod) => {
                  const stockMinimo = prod.stock_minimo || 0;
                  const stockBajo = prod.cantidad < stockMinimo;
                  return (
                    <div
                      key={prod.id}
                      className={`bg-white dark:bg-gray-800 rounded-lg shadow p-4 border-l-4 ${
                        stockBajo ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : 'border-transparent'
                      }`}
                    >
                      {/* Header */}
                      <div className="mb-3">
                        <button
                          onClick={() => openResaleMovementsModal(prod)}
                          className="text-base font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 hover:underline mb-1"
                        >
                          {prod.nombre}
                        </button>
                      </div>

                      {/* Información principal */}
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Cantidad</p>
                          <p className={`text-sm font-medium ${
                            stockBajo ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'
                          }`}>
                            {prod.cantidad}
                            {stockBajo && (
                              <span className="ml-2 px-2 py-0.5 text-xs bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded">
                                ⚠ Bajo
                              </span>
                            )}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Stock Mínimo</p>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{stockMinimo}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Costo unitario</p>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            ${prod.costo_unitario.toFixed(2)} {prod.moneda}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Costo final</p>
                          <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                            ${prod.costo_unitario_final.toFixed(2)} ARS
                          </p>
                        </div>
                      </div>

                      {/* Botones de acción */}
                      <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                        {canEdit('fabinsa-stock') && (
                          <button
                            onClick={() => {
                              setEditingResale(prod);
                              setResaleForm({
                                nombre: prod.nombre,
                                cantidad: prod.cantidad.toString(),
                                costo_unitario: prod.costo_unitario.toString(),
                                otros_costos: (prod.otros_costos || 0).toString(),
                                moneda: prod.moneda,
                                valor_dolar: (prod.valor_dolar || 0).toString(),
                                stock_minimo: (prod.stock_minimo || 0).toString(),
                              });
                              setShowResaleForm(true);
                            }}
                            className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 touch-manipulation flex-1 min-w-[100px]"
                          >
                            <Edit className="w-4 h-4" />
                            Editar
                          </button>
                        )}
                        {canDelete('fabinsa-stock') && (
                          <button
                            onClick={async () => {
                              if (confirm('¿Eliminar?')) {
                                await supabase.from('resale_products').delete().eq('id', prod.id);
                                loadAllStock();
                              }
                            }}
                            className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50 touch-manipulation flex-1 min-w-[100px]"
                          >
                            <Trash2 className="w-4 h-4" />
                            Eliminar
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            /* Resale Products Table - Desktop View */
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Nombre</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Cantidad</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Stock Mínimo</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Costo unitario</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Costo final</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Moneda</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {resaleProducts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                        No hay productos de reventa registrados
                      </td>
                    </tr>
                  ) : (
                    resaleProducts.map((prod) => {
                    const stockMinimo = prod.stock_minimo || 0;
                    const stockBajo = prod.cantidad < stockMinimo;
                    return (
                      <tr 
                        key={prod.id} 
                        className={`hover:bg-gray-50 dark:hover:bg-gray-700 ${
                          stockBajo ? 'bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500' : ''
                        }`}
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <button
                            onClick={() => openResaleMovementsModal(prod)}
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 hover:underline font-medium"
                          >
                            {prod.nombre}
                          </button>
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${
                          stockBajo ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'
                        }`}>
                          {prod.cantidad}
                          {stockBajo && (
                            <span className="ml-2 px-2 py-1 text-xs bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded">
                              ⚠ Bajo
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {stockMinimo}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          ${prod.costo_unitario.toFixed(2)} {prod.moneda}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white font-semibold">
                          ${prod.costo_unitario_final.toFixed(2)} ARS
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{prod.moneda}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <div className="flex justify-end space-x-2">
                          {canEdit('fabinsa-stock') && (
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
                                  stock_minimo: (prod.stock_minimo || 0).toString(),
                                });
                                setShowResaleForm(true);
                              }}
                              className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          )}
                          {canDelete('fabinsa-stock') && (
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
          )}

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
                      setProductSales([]);
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
                                      {(() => {
                                        // Calcular precio unitario con IVA si corresponde
                                        const precioBase = purchase.moneda === 'USD' && purchase.valor_dolar 
                                          ? purchase.precio / purchase.valor_dolar 
                                          : purchase.precio;
                                        const tieneIva = (purchase as any).tiene_iva || false;
                                        const ivaPct = (purchase as any).iva_pct || 0;
                                        const precioConIva = tieneIva ? precioBase * (1 + ivaPct / 100) : precioBase;
                                        
                                        return purchase.moneda === 'USD' && purchase.valor_dolar ? (
                                          <div className="flex flex-col space-y-1">
                                            <div className="flex items-center space-x-1">
                                              <DollarSign className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                                              <span>${precioConIva.toFixed(2)} USD</span>
                                            </div>
                                            {tieneIva && (
                                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                                (Base: ${precioBase.toFixed(2)} + IVA {ivaPct}%)
                                              </div>
                                            )}
                                          </div>
                                        ) : (
                                          <div className="flex flex-col space-y-1">
                                            <div className="flex items-center space-x-1">
                                              <DollarSign className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                                              <span>${precioConIva.toFixed(2)} ARS</span>
                                            </div>
                                            {tieneIva && (
                                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                                (Base: ${precioBase.toFixed(2)} + IVA {ivaPct}%)
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })()}
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
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Precio/Unidad</th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase">Motivo</th>
                                </tr>
                              </thead>
                              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                {resaleInventoryMovements.map((movement) => {
                                  // Buscar compra o venta relacionada para obtener el precio
                                  let relatedPurchase: PurchaseProduct | undefined;
                                  let relatedSale: Sale | undefined;
                                  
                                  // Si es un ingreso, buscar compra relacionada
                                  if (movement.tipo === 'ingreso_pr') {
                                    // Si el motivo contiene "Recepción de compra - Orden", extraer el order_id
                                    if (movement.motivo && movement.motivo.includes('Recepción de compra - Orden')) {
                                      const orderIdMatch = movement.motivo.match(/Orden ([a-f0-9-]+)/i);
                                      if (orderIdMatch) {
                                        const orderIdPrefix = orderIdMatch[1].substring(0, 8);
                                        // Buscar compra que coincida con el order_id y el producto
                                        relatedPurchase = productPurchases.find(p => {
                                          const purchaseOrderId = (p as any).order_id?.substring(0, 8);
                                          return purchaseOrderId === orderIdPrefix && 
                                                 p.producto === selectedResaleProduct?.nombre;
                                        });
                                      }
                                    }
                                    
                                    // Si no se encontró por order_id, intentar buscar por fecha y producto
                                    if (!relatedPurchase) {
                                      const movementDate = new Date(movement.created_at).toISOString().split('T')[0];
                                      relatedPurchase = productPurchases.find(p => {
                                        const purchaseDate = new Date(p.fecha).toISOString().split('T')[0];
                                        return purchaseDate === movementDate && 
                                               p.producto === selectedResaleProduct?.nombre;
                                      });
                                    }
                                  }
                                  
                                  // Si es un egreso, buscar venta relacionada
                                  if (movement.tipo === 'egreso_pr') {
                                    // Si el motivo contiene "Venta recibida - Orden", extraer el order_id
                                    if (movement.motivo && (movement.motivo.includes('Venta recibida - Orden') || movement.motivo.includes('Recepción de venta'))) {
                                      const orderIdMatch = movement.motivo.match(/Orden ([a-f0-9-]+)/i);
                                      if (orderIdMatch) {
                                        const orderIdPrefix = orderIdMatch[1].substring(0, 8);
                                        // Buscar venta que coincida con el order_id y el producto
                                        relatedSale = productSales.find(s => {
                                          const saleOrderId = s.order_id?.substring(0, 8);
                                          return saleOrderId === orderIdPrefix && 
                                                 s.producto === selectedResaleProduct?.nombre;
                                        });
                                      }
                                    }
                                    
                                    // Si no se encontró por order_id, intentar buscar por fecha y producto
                                    if (!relatedSale) {
                                      const movementDate = new Date(movement.created_at).toISOString().split('T')[0];
                                      relatedSale = productSales.find(s => {
                                        const saleDate = new Date(s.fecha).toISOString().split('T')[0];
                                        return saleDate === movementDate && 
                                               s.producto === selectedResaleProduct?.nombre &&
                                               s.cantidad === movement.cantidad;
                                      });
                                    }
                                  }
                                  
                                  return (
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
                                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                        {relatedPurchase ? (
                                          <div>
                                            {(() => {
                                              const precioUnitario = relatedPurchase.moneda === 'USD' && relatedPurchase.valor_dolar 
                                                ? relatedPurchase.precio / relatedPurchase.valor_dolar 
                                                : relatedPurchase.precio;
                                              
                                              return (
                                                <div>
                                                  <div className="font-medium">
                                                    ${precioUnitario.toFixed(2)} {relatedPurchase.moneda}
                                                  </div>
                                                  {relatedPurchase.moneda === 'USD' && relatedPurchase.valor_dolar && (
                                                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                                      Dólar: ${relatedPurchase.valor_dolar.toFixed(2)}
                                                    </div>
                                                  )}
                                                </div>
                                              );
                                            })()}
                                          </div>
                                        ) : (
                                          <span className="text-gray-400 dark:text-gray-500">-</span>
                                        )}
                                      </td>
                                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                                        {movement.motivo || '-'}
                                      </td>
                                    </tr>
                                  );
                                })}
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

      {/* Control de Recepción Tab */}
      {activeTab === 'reception' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Control de Recepción</h2>
            {/* Filtros */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setReceptionFilter('all')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  receptionFilter === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                Todas
              </button>
              <button
                onClick={() => setReceptionFilter('pending')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  receptionFilter === 'pending'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                Incompletas
              </button>
              <button
                onClick={() => setReceptionFilter('completed')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  receptionFilter === 'completed'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                Completadas
              </button>
            </div>
          </div>

          {loadingReception ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">Cargando controles...</div>
          ) : (() => {
            // Filtrar controles de compras según el filtro seleccionado
            const filteredPurchaseControls = receptionControls.filter((control) => {
              if (receptionFilter === 'all') return true;
              if (receptionFilter === 'completed') {
                // Solo mostrar completadas sin diferencias negativas
                const items = receptionItems[control.id] || [];
                const quantities = receptionQuantities[control.id] || {};
                const hasNegativeDifference = items.some((item: any) => {
                  const cantidadRecibida = quantities[item.id] || item.cantidad_recibida || item.cantidad_esperada;
                  return cantidadRecibida < item.cantidad_esperada;
                });
                return control.estado === 'completado' && !hasNegativeDifference;
              }
              if (receptionFilter === 'pending') {
                // Mostrar pendientes Y completadas con diferencias negativas
                const items = receptionItems[control.id] || [];
                const quantities = receptionQuantities[control.id] || {};
                const hasNegativeDifference = items.some((item: any) => {
                  const cantidadRecibida = quantities[item.id] || item.cantidad_recibida || item.cantidad_esperada;
                  return cantidadRecibida < item.cantidad_esperada;
                });
                return control.estado === 'pendiente' || (control.estado === 'completado' && hasNegativeDifference);
              }
              return true;
            });

            const hasAnyControls = filteredPurchaseControls.length > 0;

            if (!hasAnyControls) {
              return (
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-8 text-center">
                  <p className="text-gray-500 dark:text-gray-400">
                    {receptionFilter === 'all' 
                      ? 'No hay órdenes de control de recepción'
                      : receptionFilter === 'completed'
                      ? 'No hay órdenes completadas sin diferencias'
                      : 'No hay órdenes pendientes o con diferencias negativas'}
                  </p>
                </div>
              );
            }

            return (
              <div className="space-y-6">
                {/* Controles de Recepción de Compras */}
                {filteredPurchaseControls.length > 0 && (
                  <div>
                    <h3 className="text-md font-semibold mb-3 text-gray-900 dark:text-white">Compras</h3>
              <div className="space-y-4">
                      {filteredPurchaseControls.map((control) => {
                const items = receptionItems[control.id] || [];
                const quantities = receptionQuantities[control.id] || {};
                
                // Calcular si hay diferencias negativas (menos stock recibido)
                const hasNegativeDifference = items.some((item: any) => {
                  const cantidadRecibida = quantities[item.id] || item.cantidad_recibida || item.cantidad_esperada;
                  return cantidadRecibida < item.cantidad_esperada;
                });
                
                // Determinar el color del borde según el estado y diferencias
                const borderColor = control.estado === 'completado' 
                  ? (hasNegativeDifference 
                      ? 'border-red-500 dark:border-red-600' 
                      : 'border-green-500 dark:border-green-600')
                  : 'border-gray-200 dark:border-gray-700';
                
                const bgColor = control.estado === 'completado'
                  ? (hasNegativeDifference
                      ? 'bg-red-50 dark:bg-red-900/20'
                      : 'bg-green-50 dark:bg-green-900/20')
                  : 'bg-blue-50 dark:bg-blue-900/20';

                return (
                  <div key={control.id} className={`bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden border-2 ${borderColor}`}>
                    <div className={`px-6 py-4 ${bgColor} border-b border-gray-200 dark:border-gray-700`}>
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                              Orden {control.order_id.substring(0, 8)}
                            </h3>
                            {control.estado === 'completado' && (
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                hasNegativeDifference
                                  ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                                  : 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                              }`}>
                                {hasNegativeDifference ? '⚠ Menor Stock' : '✓ Completado'}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Tipo: {control.purchase_type === 'material' ? 'Materia Prima' : 'Producto'} | 
                            Fecha recepción: {new Date(control.fecha_recepcion).toLocaleDateString('es-AR')}
                            {control.fecha_control && (
                              <> | Completado: {new Date(control.fecha_control).toLocaleDateString('es-AR')}</>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {control.estado === 'pendiente' && (
                            <button
                              onClick={() => handleCompleteReception(control)}
                              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center space-x-2"
                            >
                              <Save className="w-4 h-4" />
                              <span>Completar Control</span>
                            </button>
                          )}
                          {(control.estado === 'completado' || hasNegativeDifference) && (
                            <button
                              onClick={() => {
                                // Scroll a la sección de detalles o mostrar modal de revisión
                                const element = document.getElementById(`reception-details-${control.id}`);
                                if (element) {
                                  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                }
                              }}
                              className={`px-4 py-2 rounded-md flex items-center space-x-2 ${
                                hasNegativeDifference
                                  ? 'bg-red-600 text-white hover:bg-red-700'
                                  : 'bg-blue-600 text-white hover:bg-blue-700'
                              }`}
                              title={hasNegativeDifference ? 'Revisar diferencias de stock' : 'Revisar control'}
                            >
                              <Eye className="w-4 h-4" />
                              <span>Revisar</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="px-6 py-4">
                      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-slate-700">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                              Item
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                              Cantidad Esperada
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                              Cantidad Recibida
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                              Diferencia
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                              Unidad
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-gray-700">
                          {items.map((item: any) => {
                            const cantidadRecibida = quantities[item.id] || item.cantidad_recibida || item.cantidad_esperada;
                            const diferencia = cantidadRecibida - item.cantidad_esperada;
                            const isNegative = diferencia < 0;
                            const isCompleted = control.estado === 'completado';

                            return (
                              <tr key={item.id} className={`hover:bg-gray-50 dark:hover:bg-slate-700 ${
                                isCompleted && isNegative ? 'bg-red-50 dark:bg-red-900/10' : 
                                isCompleted && !isNegative ? 'bg-green-50 dark:bg-green-900/10' : ''
                              }`}>
                                <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                                  {item.item_nombre}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                  {item.cantidad_esperada.toFixed(2)} {item.unidad}
                                </td>
                                <td className="px-4 py-3">
                                  {isCompleted ? (
                                    <span className={`text-sm font-medium ${
                                      isNegative 
                                        ? 'text-red-600 dark:text-red-400' 
                                        : 'text-green-600 dark:text-green-400'
                                    }`}>
                                      {cantidadRecibida.toFixed(2)} {item.unidad}
                                    </span>
                                  ) : (
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={cantidadRecibida}
                                      onChange={(e) => handleUpdateReceptionQuantity(control.id, item.id, parseFloat(e.target.value) || 0)}
                                      className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                                    />
                                  )}
                                </td>
                                <td className={`px-4 py-3 text-sm font-semibold ${
                                  diferencia > 0 
                                    ? 'text-green-600 dark:text-green-400' 
                                    : diferencia < 0 
                                    ? 'text-red-600 dark:text-red-400' 
                                    : 'text-gray-600 dark:text-gray-400'
                                }`}>
                                  {diferencia > 0 ? '+' : ''}{diferencia.toFixed(2)} {item.unidad}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                                  {item.unidad}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
                    </div>
                  </div>
                )}

              </div>
            );
          })()}
        </div>
      )}

      {/* Modal de Importación */}
      {showImportModal && (
        <BulkImportStockModal
          onClose={() => setShowImportModal(false)}
          onSuccess={() => {
            loadAllStock();
            setShowImportModal(false);
          }}
          importType={activeTab === 'materials' ? 'materials' : activeTab === 'products' ? 'products' : 'resale'}
        />
      )}
    </div>
  );
}
