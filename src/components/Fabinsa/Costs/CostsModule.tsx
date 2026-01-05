/**
 * Módulo de Costos
 * Simulación de costos y análisis de rentabilidad
 */

import { useState, useEffect } from 'react';
import { DollarSign, Plus, Trash2, X, Send, Package, ChevronDown, ChevronUp, Upload, Edit, BarChart3, TrendingUp } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useTenant } from '../../../contexts/TenantContext';
import { Database } from '../../../lib/database.types';
import { calculateProductCosts, calculateAverageEmployeeHourValue, formatProductName } from '../../../lib/fabinsaCalculations';
import { getAllFIFOPrices } from '../../../lib/fifoCalculations';
import { BulkImportCostsModal } from './BulkImportCostsModal';

type Product = Database['public']['Tables']['products']['Row'];
type ProductMaterial = Database['public']['Tables']['product_materials']['Row'];
type Employee = Database['public']['Tables']['employees']['Row'];
type StockMaterial = Database['public']['Tables']['stock_materials']['Row'];

interface CostSimulationItem {
  id: string;
  product: Product | null; // null si es manual
  materials: ProductMaterial[];
  precio_venta: number;
  descuento_pct: number;
  cantidad_fabricar: number;
  // Campos para productos manuales
  familia?: string;
  medida?: string;
  caracteristica?: string;
  nombre_manual?: string;
  peso_unidad?: number;
  cantidad_por_hora?: number;
  iibb_porcentaje?: number;
  otros_costos?: number;
  moneda_precio?: 'ARS' | 'USD';
  isManual?: boolean;
}

export function CostsModule() {
  const { tenantId } = useTenant();
  const [products, setProducts] = useState<Product[]>([]);
  const [productMaterials, setProductMaterials] = useState<Record<string, ProductMaterial[]>>({});
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [stockMaterials, setStockMaterials] = useState<StockMaterial[]>([]);
  const [fifoMaterialPrices, setFifoMaterialPrices] = useState<Record<string, { costo_kilo_usd: number; valor_dolar: number; moneda: 'ARS' | 'USD' }>>({});
  const [simulationItems, setSimulationItems] = useState<CostSimulationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [currentSimulationId, setCurrentSimulationId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<CostSimulationItem | null>(null);
  const [editFormData, setEditFormData] = useState({
    precio_venta: 0,
    descuento_pct: 0,
    cantidad_fabricar: 0,
    iibb_porcentaje: 0,
    cantidad_por_hora: 0,
    otros_costos: 0,
  });
  const [editMaterials, setEditMaterials] = useState<Array<{ material_name: string; kg_por_unidad: number }>>([]);
  // Form data for manual product
  const [manualFormData, setManualFormData] = useState({
    familia: '',
    medida: '',
    caracteristica: '',
    precio_venta: '',
    cantidad_fabricar: '',
    cantidad_por_hora: '',
    iibb_porcentaje: '0',
    otros_costos: '0',
    moneda_precio: 'ARS' as 'ARS' | 'USD',
    descuento_pct: '0',
  });
  const [manualMaterials, setManualMaterials] = useState<Array<{ material_name: string; kg_por_unidad: string }>>([]);

  useEffect(() => {
    if (tenantId) {
      loadData();
    }
  }, [tenantId]);

  const loadData = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      // Cargar productos primero
      const { data: prods } = await supabase
        .from('products')
        .select('*')
        .eq('tenant_id', tenantId);
      
      setProducts(prods || []);

      // Cargar todos los demás datos en paralelo
      const productIds = (prods || []).map(p => p.id);
      const [materialsResult, employeesResult, stockResult] = await Promise.all([
        // Load all product materials at once (solo si hay productos)
        productIds.length > 0
          ? supabase
              .from('product_materials')
              .select('*')
              .in('product_id', productIds)
          : Promise.resolve({ data: [], error: null }),
        // Load employees
        supabase
          .from('employees')
          .select('*')
          .eq('tenant_id', tenantId),
        // Load stock materials
        supabase
          .from('stock_materials')
          .select('*')
          .eq('tenant_id', tenantId),
      ]);

      const allMaterials = materialsResult.data || [];

      // Agrupar materiales por product_id
      const materialsMap: Record<string, ProductMaterial[]> = {};
      for (const mat of allMaterials) {
        if (!materialsMap[mat.product_id]) {
          materialsMap[mat.product_id] = [];
        }
        materialsMap[mat.product_id].push(mat);
      }
      setProductMaterials(materialsMap);

      setEmployees(employeesResult.data || []);
      setStockMaterials(stockResult.data || []);

      // Cargar precios FIFO para todos los materiales disponibles
      const stockMats = stockResult.data || [];
      const fifoPrices = await getAllFIFOPrices(
        supabase,
        tenantId,
        stockMats.map(m => ({ material: m.material, moneda: m.moneda, valor_dolar: m.valor_dolar }))
      );
      setFifoMaterialPrices(fifoPrices);

      // Cargar o crear simulación activa
      await loadOrCreateSimulation(prods, allMaterials);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadOrCreateSimulation = async (allProducts: Product[], allMaterials: ProductMaterial[]) => {
    if (!tenantId) return;

    try {
      // Buscar simulación activa (la más reciente)
      const { data: existingSim, error: simError } = await supabase
        .from('cost_simulations')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      let simulationId: string;

      if (existingSim && !simError) {
        simulationId = existingSim.id;
        setCurrentSimulationId(simulationId);
      } else {
        // Crear nueva simulación
        const { data: newSim, error: createError } = await supabase
          .from('cost_simulations')
          .insert({
            tenant_id: tenantId,
            nombre: 'Simulación de Costos',
          })
          .select()
          .single();

        if (createError) throw createError;
        simulationId = newSim.id;
        setCurrentSimulationId(simulationId);
      }

      // Cargar items de la simulación
      const { data: items, error: itemsError } = await supabase
        .from('cost_simulation_items')
        .select('*, product:products(*)')
        .eq('simulation_id', simulationId)
        .order('created_at', { ascending: true });

      if (itemsError) throw itemsError;

      // Crear un mapa de materiales por product_id para acceso rápido
      const materialsMap: Record<string, ProductMaterial[]> = {};
      for (const mat of allMaterials) {
        if (!materialsMap[mat.product_id]) {
          materialsMap[mat.product_id] = [];
        }
        materialsMap[mat.product_id].push(mat);
      }

      // Convertir items a CostSimulationItem (sin consultas adicionales)
      const loadedItems: CostSimulationItem[] = [];
      for (const item of items || []) {
        const product = item.product as Product | null;
        if (product) {
          // Usar materiales del mapa en lugar de hacer consulta
          loadedItems.push({
            id: item.id,
            product,
            materials: materialsMap[product.id] || [],
            precio_venta: item.precio_venta,
            descuento_pct: item.descuento_pct,
            cantidad_fabricar: item.cantidad_fabricar,
            isManual: false,
          });
        }
      }

      setSimulationItems(loadedItems);
    } catch (error) {
      console.error('Error loading simulation:', error);
    }
  };

  const calculatePesoUnidad = (): number => {
    // Calcular peso como suma de los kg de los materiales
    return manualMaterials.reduce((total, mat) => {
      return total + (parseFloat(mat.kg_por_unidad) || 0);
    }, 0);
  };

  const handleAddToSimulation = async () => {
    // Solo modo manual
    if (!manualFormData.familia || !manualFormData.cantidad_por_hora) {
      alert('Complete los campos requeridos: Familia y Cantidad por hora');
      return;
    }

    // Validar que haya al menos un material
    if (manualMaterials.length === 0) {
      alert('Debe agregar al menos un material al producto');
      return;
    }

      const nombre = formatProductName(manualFormData.familia, manualFormData.medida, manualFormData.caracteristica);

      const materials: ProductMaterial[] = manualMaterials.map((mat, idx) => ({
        id: `manual-${idx}`,
        product_id: '',
        material_name: mat.material_name,
        kg_por_unidad: parseFloat(mat.kg_por_unidad) || 0,
        created_at: new Date().toISOString(),
      }));

      // Guardar producto en la base de datos
      if (!tenantId) {
        alert('Error: No se pudo identificar la empresa');
        return;
      }

      try {
        const pesoUnidad = calculatePesoUnidad();
        const productData = {
          tenant_id: tenantId,
          nombre,
          familia: manualFormData.familia || null,
          medida: manualFormData.medida || null,
          caracteristica: manualFormData.caracteristica || null,
          peso_unidad: pesoUnidad, // Calculado automáticamente
          cantidad_por_hora: parseFloat(manualFormData.cantidad_por_hora),
          iibb_porcentaje: parseFloat(manualFormData.iibb_porcentaje) || 0,
          otros_costos: parseFloat(manualFormData.otros_costos) || 0,
          precio_venta: parseFloat(manualFormData.precio_venta) || null,
          cantidad_fabricar: parseInt(manualFormData.cantidad_fabricar) || 0,
          moneda_precio: manualFormData.moneda_precio,
        };

        const { data: newProduct, error: productError } = await supabase
          .from('products')
          .insert(productData)
          .select()
          .single();

        if (productError) throw productError;

        // Guardar materiales del producto
        if (materials.length > 0 && newProduct) {
          const materialsData = materials.map(mat => ({
            product_id: newProduct.id,
            material_name: mat.material_name,
            kg_por_unidad: mat.kg_por_unidad,
          }));

          const { error: materialsError } = await supabase
            .from('product_materials')
            .insert(materialsData);

          if (materialsError) throw materialsError;
        }

        // Asegurar que existe una simulación
        if (!currentSimulationId) {
          await loadOrCreateSimulation();
        }

        // Guardar item en la base de datos
        const { data: savedItem, error: itemError } = await supabase
          .from('cost_simulation_items')
          .insert({
            simulation_id: currentSimulationId!,
            product_id: newProduct.id,
            precio_venta: parseFloat(manualFormData.precio_venta) || 0,
            descuento_pct: parseFloat(manualFormData.descuento_pct) || 0,
            cantidad_fabricar: parseInt(manualFormData.cantidad_fabricar) || 0,
          })
          .select()
          .single();

        if (itemError) throw itemError;

        // Cargar materiales guardados
        const { data: savedMaterialsData } = await supabase
          .from('product_materials')
          .select('*')
          .eq('product_id', newProduct.id);
        
        const savedMaterials = savedMaterialsData || [];

        // Crear item de simulación con el producto guardado
        const newItem: CostSimulationItem = {
          id: savedItem.id,
          product: newProduct,
          materials: savedMaterials,
          precio_venta: parseFloat(manualFormData.precio_venta) || 0,
          descuento_pct: parseFloat(manualFormData.descuento_pct) || 0,
          cantidad_fabricar: parseInt(manualFormData.cantidad_fabricar) || 0,
          familia: manualFormData.familia,
          medida: manualFormData.medida,
          caracteristica: manualFormData.caracteristica,
          nombre_manual: nombre,
          peso_unidad: pesoUnidad, // Usar el peso calculado
          cantidad_por_hora: parseFloat(manualFormData.cantidad_por_hora),
          iibb_porcentaje: parseFloat(manualFormData.iibb_porcentaje) || 0,
          otros_costos: parseFloat(manualFormData.otros_costos) || 0,
          moneda_precio: manualFormData.moneda_precio,
          isManual: false,
        };

        setSimulationItems([...simulationItems, newItem]);
        
        // Recargar productos para que aparezca en el selector
        const { data: updatedProds } = await supabase
          .from('products')
          .select('*')
          .eq('tenant_id', tenantId);
        setProducts(updatedProds || []);
        
        setManualFormData({
          familia: '',
          medida: '',
          caracteristica: '',
          precio_venta: '',
          cantidad_fabricar: '',
          cantidad_por_hora: '',
          iibb_porcentaje: '0',
          otros_costos: '0',
          moneda_precio: 'ARS',
          descuento_pct: '0',
        });
        setManualMaterials([]);
      } catch (error: any) {
        console.error('Error guardando producto:', error);
        alert(`Error al guardar el producto: ${error?.message || 'Error desconocido'}`);
      }
  };

  const addManualMaterial = () => {
    setManualMaterials([...manualMaterials, { material_name: '', kg_por_unidad: '' }]);
  };

  const removeManualMaterial = (index: number) => {
    setManualMaterials(manualMaterials.filter((_, i) => i !== index));
  };

  const updateManualMaterial = (index: number, field: 'material_name' | 'kg_por_unidad', value: string) => {
    const updated = [...manualMaterials];
    updated[index] = { ...updated[index], [field]: value };
    setManualMaterials(updated);
  };

  const handleItemClick = (item: CostSimulationItem) => {
    setSelectedItem(item);
    setEditFormData({
      precio_venta: item.precio_venta,
      descuento_pct: item.descuento_pct,
      cantidad_fabricar: item.cantidad_fabricar,
      iibb_porcentaje: item.product?.iibb_porcentaje || item.iibb_porcentaje || 0,
      cantidad_por_hora: item.product?.cantidad_por_hora || item.cantidad_por_hora || 0,
      otros_costos: (item.product as any)?.otros_costos || item.otros_costos || 0,
    });
    // Cargar materiales editables
    setEditMaterials(item.materials.map(m => ({
      material_name: m.material_name,
      kg_por_unidad: m.kg_por_unidad,
    })));
  };

  const handleSaveItem = async () => {
    if (!selectedItem || !tenantId) return;

    try {
      // Si el producto existe en la base de datos, actualizarlo
      if (selectedItem.product?.id) {
        await supabase
          .from('products')
          .update({
            precio_venta: editFormData.precio_venta || null,
            cantidad_fabricar: editFormData.cantidad_fabricar,
            cantidad_por_hora: editFormData.cantidad_por_hora || null,
            iibb_porcentaje: editFormData.iibb_porcentaje || null,
            otros_costos: editFormData.otros_costos || null,
          })
          .eq('id', selectedItem.product.id);

        // Actualizar materiales del producto
        if (editMaterials.length > 0) {
          // Eliminar materiales existentes
          await supabase
            .from('product_materials')
            .delete()
            .eq('product_id', selectedItem.product.id);

          // Insertar nuevos materiales
          const materialsToInsert = editMaterials.map(m => ({
            product_id: selectedItem.product!.id,
            material_name: m.material_name,
            kg_por_unidad: m.kg_por_unidad,
          }));

          if (materialsToInsert.length > 0) {
            await supabase
              .from('product_materials')
              .insert(materialsToInsert);
          }
        }
      }

      // Actualizar item de simulación
      if (currentSimulationId) {
        const { error } = await supabase
          .from('cost_simulation_items')
          .update({
            precio_venta: editFormData.precio_venta,
            descuento_pct: editFormData.descuento_pct,
            cantidad_fabricar: editFormData.cantidad_fabricar,
          })
          .eq('id', selectedItem.id);

        if (error) throw error;
      }

      // Recargar datos para obtener materiales actualizados
      await loadData();
      
      setSelectedItem(null);
    } catch (error: any) {
      console.error('Error al guardar:', error);
      alert('Error al guardar los cambios: ' + error.message);
    }
  };

  const removeFromSimulation = async (id: string) => {
    try {
      // Eliminar de la base de datos
      const { error } = await supabase
        .from('cost_simulation_items')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Eliminar del estado
      setSimulationItems(simulationItems.filter(item => item.id !== id));
    } catch (error: any) {
      console.error('Error removing item:', error);
      alert(`Error al eliminar: ${error?.message || 'Error desconocido'}`);
    }
  };

  const sendToProduction = async (item: CostSimulationItem) => {
    if (!tenantId) {
      alert('Error: No se pudo identificar la empresa');
      return;
    }

    if (!item.product) {
      alert('Error: Producto no válido');
      return;
    }

    try {
      // El producto ya está guardado (se guarda al agregar a simulación)
      // Solo necesitamos actualizar el stock y enviar a producción
      
      // Descontar materiales del stock
      for (const mat of item.materials) {
          const stockMat = stockMaterials.find(m => m.material === mat.material_name);
          if (stockMat) {
            const kgNecesarios = mat.kg_por_unidad * item.cantidad_fabricar;
            if (stockMat.kg >= kgNecesarios) {
              await supabase
                .from('stock_materials')
                .update({ kg: stockMat.kg - kgNecesarios })
                .eq('id', stockMat.id);

              // Registrar movimiento de inventario
              const productName = item.product?.nombre || item.nombre_manual || 'Producto sin nombre';
              await supabase.from('inventory_movements').insert({
                tenant_id: tenantId,
                tipo: 'egreso_mp',
                item_nombre: mat.material_name,
                cantidad: kgNecesarios,
                motivo: `Producción: ${productName}`,
              });
            } else {
              alert(`Advertencia: No hay suficiente stock de ${mat.material_name}. Stock disponible: ${stockMat.kg.toFixed(2)} kg, necesario: ${kgNecesarios.toFixed(2)} kg`);
            }
          }
        }

      // Actualizar producto con nuevos valores
      await supabase
        .from('products')
        .update({
          precio_venta: item.precio_venta || null,
          cantidad_fabricar: item.cantidad_fabricar,
        })
        .eq('id', item.product.id);

      // Actualizar stock
      const itemCosts = calculateItemCosts(item);
      const { data: existingStock } = await supabase
        .from('stock_products')
        .select('*')
        .eq('tenant_id', tenantId)
        .ilike('nombre', item.product.nombre)
        .limit(1);

      if (existingStock && existingStock.length > 0) {
        await supabase
          .from('stock_products')
          .update({
            cantidad: existingStock[0].cantidad + item.cantidad_fabricar,
            costo_unit_total: itemCosts.costo_base_unitario,
          })
          .eq('id', existingStock[0].id);
      } else {
        await supabase.from('stock_products').insert({
          tenant_id: tenantId,
          nombre: item.product.nombre,
          cantidad: item.cantidad_fabricar,
          peso_unidad: item.product.peso_unidad,
          costo_unit_total: itemCosts.costo_base_unitario,
        });
      }

      // Registrar movimiento de inventario (ingreso de producto fabricado)
      const productNameForMovement = item.product?.nombre || item.nombre_manual || formatProductName(item.familia || '', item.medida || '', item.caracteristica || '');
      await supabase.from('inventory_movements').insert({
        tenant_id: tenantId,
        tipo: 'ingreso_fab',
        item_nombre: productNameForMovement,
        cantidad: item.cantidad_fabricar,
        motivo: 'Producción desde simulación de costos',
      });

      // Calcular kg consumidos (suma de todos los materiales)
      let kgConsumidos = 0;
      item.materials.forEach(mat => {
        const stockMat = stockMaterials.find(m => m.material === mat.material_name);
        if (stockMat) {
          kgConsumidos += mat.kg_por_unidad * item.cantidad_fabricar;
        }
      });

      // Registrar métrica de producción
      const productNameForMetric = item.product?.nombre || item.nombre_manual || formatProductName(item.familia || '', item.medida || '', item.caracteristica || '');
      const productWeight = item.product?.peso_unidad || item.peso_unidad || 0;
      await supabase.from('production_metrics').insert({
        tenant_id: tenantId,
        fecha: new Date().toISOString(),
        producto: productNameForMetric,
        cantidad: item.cantidad_fabricar,
        peso_unidad: productWeight,
        kg_consumidos: kgConsumidos,
        costo_mp: itemCosts.costo_total_mp,
        costo_mo: itemCosts.incidencia_mano_obra,
        costo_prod_unit: itemCosts.costo_base_unitario,
        costo_total_mp: itemCosts.costo_total_mp,
        precio_venta: item.precio_venta,
        rentabilidad_neta: itemCosts.rentabilidad_neta,
        rentabilidad_total: itemCosts.rentabilidad_neta * item.cantidad_fabricar,
      });

      // Eliminar el item de la simulación de costos para que aparezca en Producción
      await supabase
        .from('cost_simulation_items')
        .delete()
        .eq('id', item.id);

      // Remover el item de la lista local
      setSimulationItems(simulationItems.filter(i => i.id !== item.id));

      alert('Producto enviado a producción exitosamente');

      // Recargar stock y materiales
      const { data: updatedStock } = await supabase
        .from('stock_materials')
        .select('*')
        .eq('tenant_id', tenantId);
      setStockMaterials(updatedStock || []);
    } catch (error: any) {
      console.error('Error sending to production:', error);
      alert(`Error al enviar a producción: ${error?.message || 'Error desconocido'}`);
    }
  };

  // Calculate costs for each item in simulation using FIFO
  const calculateItemCosts = (item: CostSimulationItem) => {
    const avgHourValue = calculateAverageEmployeeHourValue(employees);
    
    // Usar precios FIFO (más antiguos primero) en lugar de precios del stock actual
    const materialPrices: Record<string, { costo_kilo_usd: number; valor_dolar: number; moneda: 'ARS' | 'USD' }> = {};
    
    // Para cada material del item, usar precio FIFO si está disponible, sino usar stock
    item.materials.forEach(mat => {
      if (fifoMaterialPrices[mat.material_name]) {
        materialPrices[mat.material_name] = fifoMaterialPrices[mat.material_name];
      } else {
        // Fallback: usar precio del stock si no hay FIFO disponible
        const stockMat = stockMaterials.find(m => m.material === mat.material_name);
        if (stockMat) {
          materialPrices[mat.material_name] = {
            costo_kilo_usd: stockMat.costo_kilo_usd,
            valor_dolar: stockMat.valor_dolar,
            moneda: stockMat.moneda,
          };
        }
      }
    });

    // Create a product object with the simulation values
    const productForCalculation = item.product ? {
      ...item.product,
      cantidad_fabricar: item.cantidad_fabricar,
      precio_venta: item.precio_venta,
      iibb_porcentaje: item.product.iibb_porcentaje || 0,
      otros_costos: (item.product as any).otros_costos || item.otros_costos || 0,
    } : {
      id: item.id,
      tenant_id: tenantId || '',
      nombre: item.nombre_manual || '',
      peso_unidad: item.peso_unidad || 0,
      cantidad_por_hora: item.cantidad_por_hora || 0,
      cantidad_fabricar: item.cantidad_fabricar,
      precio_venta: item.precio_venta,
      iibb_porcentaje: item.iibb_porcentaje || 0,
      otros_costos: item.otros_costos || 0,
      moneda_precio: 'ARS' as const,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as Product;

    const costs = calculateProductCosts(
      productForCalculation,
      item.materials,
      materialPrices,
      avgHourValue
    );

    const cantidad = item.cantidad_fabricar;
    const precioVenta = item.precio_venta;
    const iibbPorcentaje = item.product?.iibb_porcentaje || item.iibb_porcentaje || 0;
    const descuento = item.descuento_pct / 100;
    
    // Calcular valores UNITARIOS (por 1 unidad)
    // IIBB unitario sobre precio de venta
    const iibbUnitario = precioVenta * iibbPorcentaje / 100;
    
    // Precio después de descontar IIBB
    const precioNetoIIBB = precioVenta - iibbUnitario;
    
    // Precio final unitario después de aplicar descuento sobre el precio neto de IIBB
    const precioFinalUnitario = precioNetoIIBB * (1 - descuento);
    
    // Costos unitarios (ya están calculados en costs)
    const costoMPUnitario = costs.costo_unitario_mp;
    const costoMOUnitario = costs.costo_unitario_mano_obra;
    const otrosCostosUnitario = costs.otros_costos_unitario || 0;
    const costoTotalUnitario = costs.costo_base_unitario; // MP + MO + Otros Costos
    
    // Rentabilidad unitaria
    const rentabilidadNetaUnitaria = precioFinalUnitario - costoTotalUnitario - iibbUnitario;
    
    // Margen unitario
    const margen = precioFinalUnitario > 0 ? (rentabilidadNetaUnitaria / precioFinalUnitario) * 100 : 0;

    // Valores totales (para el resumen general)
    const iibbTotal = iibbUnitario * cantidad;
    const ingresoBruto = precioVenta * cantidad;
    const ingresoNeto = precioFinalUnitario * cantidad;
    const costoTotal = costoTotalUnitario * cantidad;
    const gananciaTotal = rentabilidadNetaUnitaria * cantidad;
    const rentabilidadNetaTotal = rentabilidadNetaUnitaria * cantidad;

    return {
      ...costs,
      // Valores unitarios (para mostrar en tabla)
      precio_final_unitario: precioFinalUnitario,
      costo_mp_unitario: costoMPUnitario,
      costo_mo_unitario: costoMOUnitario,
      otros_costos_unitario: otrosCostosUnitario,
      costo_total_unitario: costoTotalUnitario,
      iibb_unitario: iibbUnitario,
      rentabilidad_neta_unitaria: rentabilidadNetaUnitaria,
      margen,
      // Valores totales (para resumen)
      precio_final: precioFinalUnitario,
      ingreso_bruto: ingresoBruto,
      ingreso_neto: ingresoNeto,
      iibb_total: iibbTotal,
      costo_total: costoTotal,
      ganancia_total: gananciaTotal,
      rentabilidad_neta: rentabilidadNetaTotal,
    };
  };

  // Calculate costs for simulation
  const calculateSimulationCosts = () => {
    if (simulationItems.length === 0) return null;

    let totalMP = 0;
    let totalMO = 0;
    let totalOtrosCostos = 0;
    let totalIIBB = 0;
    let totalProduction = 0;
    let totalRevenue = 0;
    let totalProfit = 0;
    let totalIngresoBruto = 0;
    let totalIngresoNeto = 0;

    simulationItems.forEach(item => {
      const itemCosts = calculateItemCosts(item);
      totalMP += itemCosts.costo_total_mp;
      totalMO += itemCosts.incidencia_mano_obra;
      totalOtrosCostos += (itemCosts.otros_costos_unitario || 0) * item.cantidad_fabricar;
      totalIIBB += itemCosts.iibb_total;
      totalProduction += itemCosts.costo_total;
      totalIngresoBruto += itemCosts.ingreso_bruto;
      totalIngresoNeto += itemCosts.ingreso_neto;
      totalRevenue += itemCosts.ingreso_neto;
      totalProfit += itemCosts.rentabilidad_neta;
    });

    return {
      totalMP,
      totalMO,
      totalOtrosCostos,
      totalIIBB,
      totalProduction,
      totalIngresoBruto,
      totalIngresoNeto,
      totalRevenue,
      totalProfit,
      margin: totalIngresoNeto > 0 ? (totalProfit / totalIngresoNeto) * 100 : 0,
    };
  };

  const costs = calculateSimulationCosts();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">Cargando datos...</div>
      </div>
    );
  }

  return (
    <div className="p-2 md:p-4 w-full">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 md:px-6 py-4 -mx-2 md:-mx-4 -mt-2 md:-mt-4 mb-4 md:mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-3">
            <DollarSign className="w-6 h-6 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Costos</h1>
          </div>
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Upload className="w-4 h-4" />
            <span>Importar Masivamente</span>
          </button>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300">Simulación de costos y análisis de rentabilidad</p>
      </div>

      {/* Add Product to Simulation - Collapsible */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-4 md:mb-6 overflow-hidden">
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="w-full px-4 md:px-6 py-3 md:py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <div className="flex items-center space-x-3">
            <Plus className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Agregar Producto a Simulación
            </h2>
          </div>
          {showAddForm ? (
            <ChevronUp className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          )}
        </button>
        
        {showAddForm && (
          <div className="px-4 md:px-6 pb-4 md:pb-6 border-t border-gray-200 dark:border-gray-700 pt-4">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Familia *</label>
                  <input
                    type="text"
                    required
                    value={manualFormData.familia}
                    onChange={(e) => setManualFormData({ ...manualFormData, familia: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Medida</label>
                  <input
                    type="text"
                    value={manualFormData.medida}
                    onChange={(e) => setManualFormData({ ...manualFormData, medida: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Característica</label>
                  <input
                    type="text"
                    value={manualFormData.caracteristica}
                    onChange={(e) => setManualFormData({ ...manualFormData, caracteristica: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Precio de venta</label>
                <div className="flex space-x-2">
                  <input
                    type="number"
                    step="0.01"
                    value={manualFormData.precio_venta}
                    onChange={(e) => setManualFormData({ ...manualFormData, precio_venta: e.target.value })}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                  <select
                    value={manualFormData.moneda_precio}
                    onChange={(e) => setManualFormData({ ...manualFormData, moneda_precio: e.target.value as 'ARS' | 'USD' })}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="ARS">ARS</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Cantidad a fabricar</label>
                <input
                  type="number"
                  value={manualFormData.cantidad_fabricar}
                  onChange={(e) => setManualFormData({ ...manualFormData, cantidad_fabricar: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Cantidad por hora *</label>
                <input
                  type="number"
                  step="0.00001"
                  required
                  value={manualFormData.cantidad_por_hora}
                  onChange={(e) => setManualFormData({ ...manualFormData, cantidad_por_hora: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">IIBB (%)</label>
                <input
                  type="number"
                  step="0.01"
                  value={manualFormData.iibb_porcentaje}
                  onChange={(e) => setManualFormData({ ...manualFormData, iibb_porcentaje: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Otros Costos (ARS)</label>
                <input
                  type="number"
                  step="0.01"
                  value={manualFormData.otros_costos}
                  onChange={(e) => setManualFormData({ ...manualFormData, otros_costos: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Descuento %</label>
                <input
                  type="number"
                  step="0.01"
                  value={manualFormData.descuento_pct}
                  onChange={(e) => setManualFormData({ ...manualFormData, descuento_pct: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={handleAddToSimulation}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4 inline mr-2" />
                  Agregar
                </button>
              </div>
            </div>

            {/* Materiales Manuales */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <div className="flex justify-between items-center mb-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Materiales</label>
                <div className="flex items-center gap-3">
                  {manualMaterials.length > 0 && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Peso total: <strong>{calculatePesoUnidad().toFixed(5)} kg/unidad</strong>
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={addManualMaterial}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center space-x-1"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Agregar Material</span>
                  </button>
                </div>
              </div>
              {manualMaterials.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 py-2">No hay materiales agregados</p>
              ) : (
                <div className="space-y-2">
                  {manualMaterials.map((mat, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <div className="flex-1">
                        <select
                          value={mat.material_name}
                          onChange={(e) => updateManualMaterial(index, 'material_name', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        >
                          <option value="">Seleccione un material</option>
                          {stockMaterials.map((stockMat) => (
                            <option key={stockMat.id} value={stockMat.material}>
                              {stockMat.material} (Stock: {stockMat.kg.toFixed(2)} kg)
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="w-32">
                        <input
                          type="number"
                          step="0.00001"
                          value={mat.kg_por_unidad}
                          onChange={(e) => updateManualMaterial(index, 'kg_por_unidad', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          placeholder="Kg/unidad"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeManualMaterial(index)}
                        className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            </div>
          </div>
        )}
      </div>

      {/* Simulation Items */}
      {simulationItems.length > 0 && (
        <>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden mb-4 md:mb-6">
            <div className="px-4 md:px-6 py-3 md:py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Productos en Simulación</h2>
            </div>
            <div className="overflow-x-auto w-full">
              <div className="w-full">
                <table className="w-full divide-y divide-gray-200 dark:divide-gray-700 table-auto">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase whitespace-nowrap">Producto</th>
                    <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase whitespace-nowrap">Cant.</th>
                    <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase whitespace-nowrap">P. Venta</th>
                    <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase whitespace-nowrap">Desc.</th>
                    <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase whitespace-nowrap">P. Final</th>
                    <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase whitespace-nowrap">MP</th>
                    <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase whitespace-nowrap">MO</th>
                    <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase whitespace-nowrap">Otros</th>
                    <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase whitespace-nowrap">IIBB</th>
                    <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase whitespace-nowrap">C. Total</th>
                    <th className="px-2 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase whitespace-nowrap">Rent.</th>
                    <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase whitespace-nowrap">M%</th>
                    <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase whitespace-nowrap">Acc.</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {simulationItems.map((item) => {
                    const itemCosts = calculateItemCosts(item);
                    const productName = item.product?.nombre || item.nombre_manual || 'Producto sin nombre';
                    return (
                      <tr 
                        key={item.id} 
                        className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                        onClick={() => handleItemClick(item)}
                      >
                        <td className="px-2 py-2 whitespace-nowrap text-xs font-medium text-gray-900 dark:text-white max-w-xs truncate" title={productName}>
                          {productName}
                          {item.isManual && (
                            <span className="ml-1 text-xs text-gray-500 dark:text-gray-400 bg-yellow-100 dark:bg-yellow-900/30 px-1 py-0.5 rounded">M</span>
                          )}
                        </td>
                        <td className="px-2 py-2 whitespace-nowrap text-xs text-center text-gray-900 dark:text-white">{item.cantidad_fabricar}</td>
                        <td className="px-2 py-2 whitespace-nowrap text-xs text-right text-gray-900 dark:text-white">${item.precio_venta.toFixed(2)}</td>
                        <td className="px-2 py-2 whitespace-nowrap text-xs text-center text-gray-900 dark:text-white">{item.descuento_pct}%</td>
                        <td className="px-2 py-2 whitespace-nowrap text-xs font-semibold text-right text-gray-900 dark:text-white">${itemCosts.precio_final_unitario.toFixed(2)}</td>
                        <td className="px-2 py-2 whitespace-nowrap text-xs text-right text-gray-900 dark:text-white">${itemCosts.costo_mp_unitario.toFixed(2)}</td>
                        <td className="px-2 py-2 whitespace-nowrap text-xs text-right text-gray-900 dark:text-white">${itemCosts.costo_mo_unitario.toFixed(2)}</td>
                        <td className="px-2 py-2 whitespace-nowrap text-xs text-right text-gray-900 dark:text-white">${(itemCosts.otros_costos_unitario || 0).toFixed(2)}</td>
                        <td className="px-2 py-2 whitespace-nowrap text-xs text-right text-gray-900 dark:text-white">${itemCosts.iibb_unitario.toFixed(2)}</td>
                        <td className="px-2 py-2 whitespace-nowrap text-xs font-semibold text-right text-gray-900 dark:text-white">${itemCosts.costo_total_unitario.toFixed(2)}</td>
                        <td className={`px-2 py-2 whitespace-nowrap text-xs font-semibold text-right ${itemCosts.rentabilidad_neta_unitaria >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          ${itemCosts.rentabilidad_neta_unitaria.toFixed(2)}
                        </td>
                        <td className={`px-2 py-2 whitespace-nowrap text-xs font-semibold text-center ${itemCosts.margen >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {itemCosts.margen.toFixed(1)}%
                        </td>
                        <td className="px-2 py-2 whitespace-nowrap text-center text-xs" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-center items-center space-x-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                sendToProduction(item);
                              }}
                              className="text-green-600 dark:text-green-400 hover:text-green-900 dark:hover:text-green-300"
                              title="Enviar a producción"
                            >
                              <Send className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                removeFromSimulation(item.id);
                              }}
                              className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                              title="Eliminar"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Cost Summary */}
          {costs && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
              <h2 className="text-lg font-semibold mb-6 text-gray-900 dark:text-white">Resumen General de Costos</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 md:gap-6 mb-6">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">Total Materia Prima</p>
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">${costs.totalMP.toFixed(2)}</p>
                </div>
                <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">Total Mano de Obra</p>
                  <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">${costs.totalMO.toFixed(2)}</p>
                </div>
                <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">Total Otros Costos</p>
                  <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">${(costs.totalOtrosCostos || 0).toFixed(2)}</p>
                </div>
                <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">Total IIBB</p>
                  <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">${costs.totalIIBB.toFixed(2)}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">Costo Total Producción</p>
                  <p className="text-2xl font-bold text-gray-700 dark:text-gray-300">${costs.totalProduction.toFixed(2)}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">Ingreso Bruto</p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">${costs.totalIngresoBruto.toFixed(2)}</p>
                </div>
                <div className="bg-green-100 dark:bg-green-900/30 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">Ingreso Neto</p>
                  <p className="text-2xl font-bold text-green-700 dark:text-green-400">${costs.totalIngresoNeto.toFixed(2)}</p>
                </div>
                <div className={`p-4 rounded-lg ${costs.totalProfit >= 0 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">Rentabilidad Neta</p>
                  <p className={`text-2xl font-bold ${costs.totalProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    ${costs.totalProfit.toFixed(2)}
                  </p>
                </div>
                <div className={`p-4 rounded-lg ${costs.margin >= 0 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">Margen de Ganancia</p>
                  <p className={`text-2xl font-bold ${costs.margin >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {costs.margin.toFixed(2)}%
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Distribution Chart */}
          {costs && costs.totalProduction > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Distribución de Costos</h2>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600 dark:text-gray-300">Materia Prima</span>
                    <span className="font-semibold text-gray-900 dark:text-white">${costs.totalMP.toFixed(2)} ({(costs.totalMP / costs.totalProduction * 100).toFixed(1)}%)</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                    <div 
                      className="bg-blue-600 h-3 rounded-full" 
                      style={{ width: `${(costs.totalMP / costs.totalProduction * 100)}%` }}
                    ></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600 dark:text-gray-300">Mano de Obra</span>
                    <span className="font-semibold text-gray-900 dark:text-white">${costs.totalMO.toFixed(2)} ({(costs.totalMO / costs.totalProduction * 100).toFixed(1)}%)</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                    <div 
                      className="bg-purple-600 h-3 rounded-full" 
                      style={{ width: `${(costs.totalMO / costs.totalProduction * 100)}%` }}
                    ></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600 dark:text-gray-300">Otros Costos</span>
                    <span className="font-semibold text-gray-900 dark:text-white">${(costs.totalOtrosCostos || 0).toFixed(2)} ({((costs.totalOtrosCostos || 0) / costs.totalProduction * 100).toFixed(1)}%)</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                    <div 
                      className="bg-indigo-600 h-3 rounded-full" 
                      style={{ width: `${((costs.totalOtrosCostos || 0) / costs.totalProduction * 100)}%` }}
                    ></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600 dark:text-gray-300">IIBB</span>
                    <span className="font-semibold text-gray-900 dark:text-white">${costs.totalIIBB.toFixed(2)} ({(costs.totalIIBB / costs.totalProduction * 100).toFixed(1)}%)</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                    <div 
                      className="bg-orange-600 h-3 rounded-full" 
                      style={{ width: `${(costs.totalIIBB / costs.totalProduction * 100)}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <BulkImportCostsModal
          onClose={() => setShowImportModal(false)}
          onSuccess={() => {
            loadData();
            setShowImportModal(false);
          }}
        />
      )}

      {simulationItems.length === 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
          <p className="text-gray-500 dark:text-gray-400">Agregue productos para simular costos</p>
        </div>
      )}

      {/* Item Detail Modal */}
      {selectedItem && (() => {
        // Crear materiales actualizados para el cálculo
        const updatedMaterials: ProductMaterial[] = editMaterials.map((mat, idx) => ({
          id: `edit-${idx}`,
          product_id: selectedItem.product?.id || '',
          material_name: mat.material_name,
          kg_por_unidad: mat.kg_por_unidad,
          created_at: new Date().toISOString(),
        }));

        const itemCosts = calculateItemCosts({
          ...selectedItem,
          precio_venta: editFormData.precio_venta,
          descuento_pct: editFormData.descuento_pct,
          cantidad_fabricar: editFormData.cantidad_fabricar,
          iibb_porcentaje: editFormData.iibb_porcentaje,
          cantidad_por_hora: editFormData.cantidad_por_hora,
          otros_costos: editFormData.otros_costos,
          materials: updatedMaterials,
        });
        const productName = selectedItem.product?.nombre || selectedItem.nombre_manual || 'Producto sin nombre';
        const cantidad = editFormData.cantidad_fabricar;
        const precioVenta = editFormData.precio_venta;
        const descuento = editFormData.descuento_pct / 100;
        const iibbPorcentaje = editFormData.iibb_porcentaje || selectedItem.product?.iibb_porcentaje || selectedItem.iibb_porcentaje || 0;
        const iibbUnitario = precioVenta * iibbPorcentaje / 100;
        const precioNetoIIBB = precioVenta - iibbUnitario;
        const precioFinalUnitario = precioNetoIIBB * (1 - descuento);
        const rentabilidadNetaUnitaria = precioFinalUnitario - itemCosts.costo_total_unitario - iibbUnitario;
        const ingresoNeto = precioFinalUnitario * cantidad;
        const costoTotal = itemCosts.costo_total_unitario * cantidad;
        const rentabilidadTotal = rentabilidadNetaUnitaria * cantidad;
        const margen = precioFinalUnitario > 0 ? (rentabilidadNetaUnitaria / precioFinalUnitario) * 100 : 0;

        return (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">{productName}</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Editar y ver métricas avanzadas</p>
                </div>
                <button
                  onClick={() => setSelectedItem(null)}
                  className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Formulario de Edición */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                      <Edit className="w-5 h-5 mr-2" />
                      Editar Valores
                    </h3>
                    
                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                        Precio de Venta (Unit.)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={editFormData.precio_venta}
                        onChange={(e) => setEditFormData({ ...editFormData, precio_venta: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                        Descuento (%)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={editFormData.descuento_pct}
                        onChange={(e) => setEditFormData({ ...editFormData, descuento_pct: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                        Cantidad a Fabricar
                      </label>
                      <input
                        type="number"
                        step="1"
                        value={editFormData.cantidad_fabricar}
                        onChange={(e) => setEditFormData({ ...editFormData, cantidad_fabricar: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                        IIBB (%)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={editFormData.iibb_porcentaje}
                        onChange={(e) => setEditFormData({ ...editFormData, iibb_porcentaje: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                        Otros Costos (ARS)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={editFormData.otros_costos}
                        onChange={(e) => setEditFormData({ ...editFormData, otros_costos: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="0.00"
                      />
                    </div>

                    {selectedItem.product && (
                      <div>
                        <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                          Cantidad por Hora
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={editFormData.cantidad_por_hora}
                          onChange={(e) => setEditFormData({ ...editFormData, cantidad_por_hora: parseFloat(e.target.value) || 0 })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                      </div>
                    )}

                    {/* Editar Materiales */}
                    <div>
                      <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                        Materiales
                      </label>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {editMaterials.map((mat, idx) => (
                          <div key={idx} className="flex items-center space-x-2">
                            <select
                              value={mat.material_name}
                              onChange={(e) => {
                                const updated = [...editMaterials];
                                updated[idx].material_name = e.target.value;
                                setEditMaterials(updated);
                              }}
                              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                            >
                              <option value="">Seleccione un material</option>
                              {stockMaterials.map((stockMat) => (
                                <option key={stockMat.id} value={stockMat.material}>
                                  {stockMat.material}
                                </option>
                              ))}
                            </select>
                            <input
                              type="number"
                              step="0.00001"
                              value={mat.kg_por_unidad}
                              onChange={(e) => {
                                const updated = [...editMaterials];
                                updated[idx].kg_por_unidad = parseFloat(e.target.value) || 0;
                                setEditMaterials(updated);
                              }}
                              className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                              placeholder="Kg/unidad"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setEditMaterials(editMaterials.filter((_, i) => i !== idx));
                              }}
                              className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => {
                            setEditMaterials([...editMaterials, { material_name: '', kg_por_unidad: 0 }]);
                          }}
                          className="w-full text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center justify-center py-2 border border-dashed border-gray-300 dark:border-gray-600 rounded-md"
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Agregar Material
                        </button>
                      </div>
                    </div>

                    <button
                      onClick={handleSaveItem}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
                    >
                      Guardar Cambios
                    </button>
                  </div>

                  {/* Métricas Avanzadas */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                      <BarChart3 className="w-5 h-5 mr-2" />
                      Métricas Avanzadas
                    </h3>

                    {/* Métricas Unitarias */}
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Por Unidad</h4>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Precio Final:</span>
                          <span className="ml-2 font-semibold text-gray-900 dark:text-white">${precioFinalUnitario.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Costo MP:</span>
                          <span className="ml-2 font-semibold text-gray-900 dark:text-white">${itemCosts.costo_mp_unitario.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Costo MO:</span>
                          <span className="ml-2 font-semibold text-gray-900 dark:text-white">${itemCosts.costo_mo_unitario.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Otros Costos:</span>
                          <span className="ml-2 font-semibold text-gray-900 dark:text-white">${(itemCosts.otros_costos_unitario || 0).toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">IIBB:</span>
                          <span className="ml-2 font-semibold text-gray-900 dark:text-white">${iibbUnitario.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Costo Total:</span>
                          <span className="ml-2 font-semibold text-gray-900 dark:text-white">${itemCosts.costo_total_unitario.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Rentabilidad:</span>
                          <span className={`ml-2 font-semibold ${rentabilidadNetaUnitaria >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            ${rentabilidadNetaUnitaria.toFixed(2)}
                          </span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-gray-600 dark:text-gray-400">Margen:</span>
                          <span className={`ml-2 font-semibold ${margen >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {margen.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Métricas Totales */}
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Totales (Cantidad: {cantidad})</h4>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Ingreso Neto:</span>
                          <span className="ml-2 font-semibold text-green-600 dark:text-green-400">${ingresoNeto.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Costo Total:</span>
                          <span className="ml-2 font-semibold text-gray-900 dark:text-white">${costoTotal.toFixed(2)}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-gray-600 dark:text-gray-400">Rentabilidad Total:</span>
                          <span className={`ml-2 font-semibold text-lg ${rentabilidadTotal >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            ${rentabilidadTotal.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Distribución de Costos */}
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Distribución de Costos</h4>
                      <div className="space-y-2">
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-600 dark:text-gray-400">Materia Prima</span>
                            <span className="font-semibold text-gray-900 dark:text-white">
                              ${itemCosts.costo_mp_unitario.toFixed(2)} ({itemCosts.costo_total_unitario > 0 ? ((itemCosts.costo_mp_unitario / itemCosts.costo_total_unitario) * 100).toFixed(1) : 0}%)
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                            <div 
                              className="bg-blue-600 h-2 rounded-full" 
                              style={{ width: `${itemCosts.costo_total_unitario > 0 ? (itemCosts.costo_mp_unitario / itemCosts.costo_total_unitario) * 100 : 0}%` }}
                            ></div>
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-600 dark:text-gray-400">Mano de Obra</span>
                            <span className="font-semibold text-gray-900 dark:text-white">
                              ${itemCosts.costo_mo_unitario.toFixed(2)} ({itemCosts.costo_total_unitario > 0 ? ((itemCosts.costo_mo_unitario / itemCosts.costo_total_unitario) * 100).toFixed(1) : 0}%)
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                            <div 
                              className="bg-purple-600 h-2 rounded-full" 
                              style={{ width: `${itemCosts.costo_total_unitario > 0 ? (itemCosts.costo_mo_unitario / itemCosts.costo_total_unitario) * 100 : 0}%` }}
                            ></div>
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-600 dark:text-gray-400">Otros Costos</span>
                            <span className="font-semibold text-gray-900 dark:text-white">
                              ${(itemCosts.otros_costos_unitario || 0).toFixed(2)} ({itemCosts.costo_total_unitario > 0 ? (((itemCosts.otros_costos_unitario || 0) / itemCosts.costo_total_unitario) * 100).toFixed(1) : 0}%)
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                            <div 
                              className="bg-indigo-600 h-2 rounded-full" 
                              style={{ width: `${itemCosts.costo_total_unitario > 0 ? ((itemCosts.otros_costos_unitario || 0) / itemCosts.costo_total_unitario) * 100 : 0}%` }}
                            ></div>
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-600 dark:text-gray-400">IIBB</span>
                            <span className="font-semibold text-gray-900 dark:text-white">
                              ${iibbUnitario.toFixed(2)} ({precioFinalUnitario > 0 ? ((iibbUnitario / precioFinalUnitario) * 100).toFixed(1) : 0}%)
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                            <div 
                              className="bg-orange-600 h-2 rounded-full" 
                              style={{ width: `${precioFinalUnitario > 0 ? (iibbUnitario / precioFinalUnitario) * 100 : 0}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Materiales Configurados */}
                    {editMaterials.length > 0 && (
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Materiales Configurados</h4>
                        <div className="space-y-1">
                          {editMaterials.map((mat, idx) => (
                            <div key={idx} className="text-xs text-gray-600 dark:text-gray-400">
                              • {mat.material_name || '(Sin material)'}: {mat.kg_por_unidad} kg/unidad
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
