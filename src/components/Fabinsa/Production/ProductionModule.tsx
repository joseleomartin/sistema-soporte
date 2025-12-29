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
import { calculateFIFOPricesForMaterials } from '../../../lib/fifoCalculations';
import { useDepartmentPermissions } from '../../../hooks/useDepartmentPermissions';
import { ConfirmModal } from '../../Common/ConfirmModal';
import { AlertModal } from '../../Common/AlertModal';

type Product = Database['public']['Tables']['products']['Row'];
type ProductInsert = Database['public']['Tables']['products']['Insert'];
type ProductMaterial = Database['public']['Tables']['product_materials']['Row'];
type ProductMaterialInsert = Database['public']['Tables']['product_materials']['Insert'];
type StockMaterial = Database['public']['Tables']['stock_materials']['Row'];
type Employee = Database['public']['Tables']['employees']['Row'];

export function ProductionModule() {
  const { tenantId } = useTenant();
  const { canCreate, canEdit, canDelete } = useDepartmentPermissions();
  const [products, setProducts] = useState<Product[]>([]);
  const [materials, setMaterials] = useState<Record<string, ProductMaterial[]>>({});
  const [stockMaterials, setStockMaterials] = useState<StockMaterial[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formMaterials, setFormMaterials] = useState<Array<{ material_name: string; kg_por_unidad: string }>>([]);
  const [newMaterial, setNewMaterial] = useState({ material_name: '', kg_por_unidad: '' });
  const [showMultiSelectModal, setShowMultiSelectModal] = useState(false);
  const [selectedMaterials, setSelectedMaterials] = useState<Set<string>>(new Set());
  const [materialQuantities, setMaterialQuantities] = useState<Record<string, string>>({});
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  
  // Estados para modales
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type?: 'danger' | 'warning' | 'info';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'warning',
    onConfirm: () => {},
  });
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type?: 'success' | 'error' | 'warning' | 'info';
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info',
  });
  const [isProcessing, setIsProcessing] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    nombre: '',
    familia: '',
    medida: '',
    caracteristica: '',
    peso_unidad: '',
    cantidad_fabricar: '',
    cantidad_por_hora: '',
    otros_costos: '',
  });

  useEffect(() => {
    if (tenantId) {
      loadAllData();
    }
  }, [tenantId]);

  const loadAllData = async () => {
    if (!tenantId) return;

    try {
      setLoading(true);
      
      // Cargar todos los datos en paralelo
      const [productsResult, stockResult, employeesResult] = await Promise.all([
        supabase
          .from('products')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false }),
        supabase
          .from('stock_materials')
          .select('*')
          .eq('tenant_id', tenantId),
        supabase
          .from('employees')
          .select('*')
          .eq('tenant_id', tenantId),
      ]);

      if (productsResult.error) throw productsResult.error;
      if (stockResult.error) throw stockResult.error;
      if (employeesResult.error) throw employeesResult.error;

      const allProducts = productsResult.data || [];
      
      // Obtener IDs de productos que están en simulación de costos activa
      // Primero obtener la simulación activa
      const { data: activeSimulation } = await supabase
        .from('cost_simulations')
        .select('id')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      let productsInSimulation: string[] = [];
      if (activeSimulation) {
        const { data: simulationItems } = await supabase
          .from('cost_simulation_items')
          .select('product_id')
          .eq('simulation_id', activeSimulation.id);
        
        productsInSimulation = (simulationItems || [])
          .map(item => item.product_id)
          .filter((id): id is string => id !== null);
      }
      
      // Filtrar productos: solo mostrar los que NO están en simulación activa
      // Los productos en simulación solo aparecerán cuando se envíen explícitamente a producción
      const productsData = allProducts.filter(p => !productsInSimulation.includes(p.id));
      setProducts(productsData);
      setStockMaterials(stockResult.data || []);
      setEmployees(employeesResult.data || []);

      // Cargar todos los materiales de una vez usando los IDs de productos
      if (productsData.length > 0) {
        const productIds = productsData.map((p: Product) => p.id);
        const { data: allMaterials, error: materialsError } = await supabase
          .from('product_materials')
          .select('*')
          .in('product_id', productIds);

        if (materialsError) throw materialsError;

        // Agrupar materiales por product_id
        const materialsMap: Record<string, ProductMaterial[]> = {};
        (allMaterials || []).forEach((mat: ProductMaterial) => {
          if (!materialsMap[mat.product_id]) {
            materialsMap[mat.product_id] = [];
          }
          materialsMap[mat.product_id].push(mat);
        });
        setMaterials(materialsMap);
      } else {
        setMaterials({});
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProducts = async () => {
    if (!tenantId) return;
    await loadAllData();
  };

  const loadStockMaterials = async () => {
    if (!tenantId) return;
    await loadAllData();
  };

  const loadEmployees = async () => {
    if (!tenantId) return;
    await loadAllData();
  };

  const calculateProductCost = (product: Product): { costoMP: number; costoMO: number; otrosCostos: number; costoTotal: number } => {
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

      // Obtener otros costos del producto
      const otrosCostos = (product as any).otros_costos || 0;

      return {
        costoMP: costs.costo_unitario_mp,
        costoMO: costs.costo_unitario_mano_obra,
        otrosCostos: otrosCostos,
        costoTotal: costs.costo_base_unitario + otrosCostos,
      };
    } catch (error) {
      console.error('Error calculating product cost:', error);
      return { costoMP: 0, costoMO: 0, otrosCostos: 0, costoTotal: 0 };
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
      setAlertModal({
        isOpen: true,
        title: 'Materiales requeridos',
        message: 'Debe agregar al menos un material al producto',
        type: 'warning',
      });
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
        precio_venta: null,
        cantidad_fabricar: parseInt(formData.cantidad_fabricar) || 0,
        cantidad_por_hora: parseFloat(formData.cantidad_por_hora) || 0,
        otros_costos: parseFloat(formData.otros_costos) || 0,
        moneda_precio: 'ARS',
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
      setAlertModal({
        isOpen: true,
        title: 'Error',
        message: 'Error al guardar el producto',
        type: 'error',
      });
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
      cantidad_fabricar: product.cantidad_fabricar.toString(),
      cantidad_por_hora: product.cantidad_por_hora.toString(),
      otros_costos: (product as any).otros_costos?.toString() || '0',
      moneda_precio: 'ARS',
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

  const handleDelete = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Eliminar producto',
      message: '¿Está seguro de eliminar este producto? Esta acción no se puede deshacer.',
      type: 'danger',
      onConfirm: async () => {
        try {
          setIsProcessing(true);
          const { error } = await supabase
            .from('products')
            .delete()
            .eq('id', id);

          if (error) throw error;
          loadProducts();
          setConfirmModal({ ...confirmModal, isOpen: false });
          setAlertModal({
            isOpen: true,
            title: 'Éxito',
            message: 'Producto eliminado correctamente',
            type: 'success',
          });
        } catch (error) {
          console.error('Error deleting product:', error);
          setAlertModal({
            isOpen: true,
            title: 'Error',
            message: 'Error al eliminar el producto',
            type: 'error',
          });
        } finally {
          setIsProcessing(false);
        }
      },
    });
  };

  const completeProduction = async (product: Product) => {
    if (!tenantId) {
      setAlertModal({
        isOpen: true,
        title: 'Error',
        message: 'No se pudo identificar la empresa',
        type: 'error',
      });
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Completar producción',
      message: `¿Desea completar la producción de "${product.nombre}" y enviarla al stock?`,
      type: 'info',
      onConfirm: async () => {
        await executeCompleteProduction(product);
      },
    });
  };

  const executeCompleteProduction = async (product: Product) => {
    if (!tenantId) return;

    try {
      const productMaterials = materials[product.id] || [];
      const cantidad = product.cantidad_fabricar || 0;

      if (cantidad <= 0) {
        setAlertModal({
          isOpen: true,
          title: 'Error de validación',
          message: 'La cantidad a fabricar debe ser mayor a 0',
          type: 'error',
        });
        setIsProcessing(false);
        return;
      }

      // Validar stock de materiales y recopilar advertencias
      const materialWarnings: string[] = [];
      for (const mat of productMaterials) {
        const stockMat = stockMaterials.find(m => m.material === mat.material_name);
        if (!stockMat) {
          materialWarnings.push(`Material "${mat.material_name}" no encontrado en el stock`);
        } else {
          const kgNecesarios = mat.kg_por_unidad * cantidad;
          if (stockMat.kg < kgNecesarios) {
            materialWarnings.push(`Stock insuficiente de "${mat.material_name}". Disponible: ${stockMat.kg.toFixed(2)} kg, Necesario: ${kgNecesarios.toFixed(2)} kg`);
          }
        }
      }

      // Si hay advertencias, mostrar modal para continuar de todos modos
      if (materialWarnings.length > 0) {
        setConfirmModal({
          isOpen: true,
          title: 'Advertencias de Materiales',
          message: `Se encontraron los siguientes problemas:\n\n${materialWarnings.join('\n')}\n\n¿Desea continuar de todos modos?`,
          type: 'warning',
          onConfirm: async () => {
            await proceedWithProduction(product, materialWarnings);
          },
        });
        setIsProcessing(false);
        return;
      }

      // Si no hay advertencias, proceder directamente
      await proceedWithProduction(product, []);
    } catch (error: any) {
      console.error('Error completing production:', error);
      setAlertModal({
        isOpen: true,
        title: 'Error',
        message: `Error al completar la producción: ${error?.message || 'Error desconocido'}`,
        type: 'error',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const proceedWithProduction = async (product: Product, warnings: string[]) => {
    if (!tenantId) return;

    try {
      setIsProcessing(true);
      const productMaterials = materials[product.id] || [];
      const cantidad = product.cantidad_fabricar || 0;

      // Calcular costos usando FIFO (material más viejo primero)
      const costs = calculateProductCost(product);
      const avgHourValue = calculateAverageEmployeeHourValue(employees);
      
      // Obtener precios FIFO (más antiguos primero)
      const materialPrices = await calculateFIFOPricesForMaterials(
        supabase,
        tenantId,
        productMaterials.map(m => ({ material_name: m.material_name, kg_por_unidad: m.kg_por_unidad }))
      );

      const fullCosts = calculateProductCosts(
        product,
        productMaterials,
        materialPrices,
        avgHourValue
      );

      // Descontar materiales del stock (solo si hay stock disponible)
      for (const mat of productMaterials) {
        const stockMat = stockMaterials.find(m => m.material === mat.material_name);
        if (stockMat) {
          const kgNecesarios = mat.kg_por_unidad * cantidad;
          // Solo descontar si hay stock suficiente, sino usar lo disponible o 0
          const kgADescontar = Math.min(kgNecesarios, Math.max(0, stockMat.kg));
          const nuevoStock = Math.max(0, stockMat.kg - kgADescontar);
          
          await supabase
            .from('stock_materials')
            .update({ kg: nuevoStock })
            .eq('id', stockMat.id);

          // Registrar movimiento de egreso de materia prima
          await supabase.from('inventory_movements').insert({
            tenant_id: tenantId,
            tipo: 'egreso_mp',
            item_nombre: mat.material_name,
            cantidad: kgADescontar,
            motivo: `Producción: ${product.nombre}${warnings.length > 0 ? ' (con advertencias)' : ''}`,
          });
        } else {
          // Si no hay material en stock, registrar movimiento con cantidad 0
          await supabase.from('inventory_movements').insert({
            tenant_id: tenantId,
            tipo: 'egreso_mp',
            item_nombre: mat.material_name,
            cantidad: 0,
            motivo: `Producción: ${product.nombre} (material no encontrado en stock)`,
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

      setConfirmModal({ ...confirmModal, isOpen: false });
      setAlertModal({
        isOpen: true,
        title: 'Producción completada',
        message: `La producción de "${product.nombre}" ha sido completada y enviada al stock${warnings.length > 0 ? ' (con advertencias de materiales)' : ''}`,
        type: 'success',
      });
      loadProducts();
      loadStockMaterials(); // Recargar stock para actualizar los valores
    } catch (error: any) {
      console.error('Error completing production:', error);
      setAlertModal({
        isOpen: true,
        title: 'Error',
        message: `Error al completar la producción: ${error?.message || 'Error desconocido'}`,
        type: 'error',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const resetForm = () => {
    setFormData({
      nombre: '',
      familia: '',
      medida: '',
      caracteristica: '',
      peso_unidad: '',
      cantidad_fabricar: '',
      cantidad_por_hora: '',
      otros_costos: '',
      moneda_precio: 'ARS',
    });
    setFormMaterials([]);
    setNewMaterial({ material_name: '', kg_por_unidad: '' });
    setEditingProduct(null);
    setShowForm(false);
  };

  const addMaterial = () => {
    if (!newMaterial.material_name || !newMaterial.kg_por_unidad) {
      setAlertModal({
        isOpen: true,
        title: 'Campos incompletos',
        message: 'Por favor complete todos los campos del material',
        type: 'warning',
      });
      return;
    }
    if (parseFloat(newMaterial.kg_por_unidad) <= 0) {
      setAlertModal({
        isOpen: true,
        title: 'Valor inválido',
        message: 'El kg por unidad debe ser mayor a 0',
        type: 'warning',
      });
      return;
    }
    setFormMaterials([...formMaterials, { ...newMaterial }]);
    setNewMaterial({ material_name: '', kg_por_unidad: '' });
  };

  const removeMaterial = (index: number) => {
    setFormMaterials(formMaterials.filter((_, i) => i !== index));
  };

  const handleMaterialToggle = (materialName: string) => {
    const newSelected = new Set(selectedMaterials);
    if (newSelected.has(materialName)) {
      newSelected.delete(materialName);
      const newQuantities = { ...materialQuantities };
      delete newQuantities[materialName];
      setMaterialQuantities(newQuantities);
    } else {
      newSelected.add(materialName);
      setMaterialQuantities({ ...materialQuantities, [materialName]: '' });
    }
    setSelectedMaterials(newSelected);
  };

  const handleAddMultipleMaterials = () => {
    const materialsToAdd: Array<{ material_name: string; kg_por_unidad: string }> = [];
    
    for (const materialName of selectedMaterials) {
      const quantity = materialQuantities[materialName] || '0';
      if (quantity && parseFloat(quantity) > 0) {
        // Verificar si el material ya está en la lista
        if (!formMaterials.some(m => m.material_name === materialName)) {
          materialsToAdd.push({ material_name: materialName, kg_por_unidad: quantity });
        }
      }
    }

    if (materialsToAdd.length === 0) {
      setAlertModal({
        isOpen: true,
        title: 'Sin materiales válidos',
        message: 'Por favor seleccione al menos un material y especifique un kg por unidad mayor a 0',
        type: 'warning',
      });
      return;
    }

    setFormMaterials([...formMaterials, ...materialsToAdd]);
    setSelectedMaterials(new Set());
    setMaterialQuantities({});
    setShowMultiSelectModal(false);
  };

  const openMultiSelectModal = () => {
    setShowMultiSelectModal(true);
    setSelectedMaterials(new Set());
    setMaterialQuantities({});
  };

  const handleProductToggle = (productId: string) => {
    const newSelected = new Set(selectedProducts);
    if (newSelected.has(productId)) {
      newSelected.delete(productId);
    } else {
      newSelected.add(productId);
    }
    setSelectedProducts(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedProducts.size === products.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(products.map(p => p.id)));
    }
  };

  const handleCompleteSelected = async () => {
    if (selectedProducts.size === 0) return;

    setConfirmModal({
      isOpen: true,
      title: 'Completar producciones',
      message: `¿Desea completar ${selectedProducts.size} producción(es) seleccionada(s) y enviarlas al stock?`,
      type: 'info',
      onConfirm: async () => {
        try {
          setIsProcessing(true);
          const productsToComplete = products.filter(p => selectedProducts.has(p.id));
          
          for (const product of productsToComplete) {
            await executeCompleteProduction(product);
          }

          setSelectedProducts(new Set());
          setConfirmModal({ ...confirmModal, isOpen: false });
          setAlertModal({
            isOpen: true,
            title: 'Producciones completadas',
            message: `${productsToComplete.length} producción(es) completada(s) y enviada(s) al stock`,
            type: 'success',
          });
        } catch (error: any) {
          console.error('Error completing productions:', error);
          setAlertModal({
            isOpen: true,
            title: 'Error',
            message: `Error al completar las producciones: ${error?.message || 'Error desconocido'}`,
            type: 'error',
          });
        } finally {
          setIsProcessing(false);
        }
      },
    });
  };

  const handleDeleteSelected = () => {
    if (selectedProducts.size === 0) return;

    setConfirmModal({
      isOpen: true,
      title: 'Eliminar producciones',
      message: `¿Está seguro de eliminar ${selectedProducts.size} producción(es) seleccionada(s)? Esta acción no se puede deshacer.`,
      type: 'danger',
      onConfirm: async () => {
        try {
          setIsProcessing(true);
          const { error } = await supabase
            .from('products')
            .delete()
            .in('id', Array.from(selectedProducts));

          if (error) throw error;
          
          loadProducts();
          setSelectedProducts(new Set());
          setConfirmModal({ ...confirmModal, isOpen: false });
          setAlertModal({
            isOpen: true,
            title: 'Éxito',
            message: `${selectedProducts.size} producción(es) eliminada(s) correctamente`,
            type: 'success',
          });
        } catch (error) {
          console.error('Error deleting products:', error);
          setAlertModal({
            isOpen: true,
            title: 'Error',
            message: 'Error al eliminar las producciones',
            type: 'error',
          });
        } finally {
          setIsProcessing(false);
        }
      },
    });
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
        <div className="flex items-center gap-2">
          {selectedProducts.size > 0 && (
            <>
              {canEdit('fabinsa-production') && (
                <button
                  onClick={handleCompleteSelected}
                  className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>Completar ({selectedProducts.size})</span>
                </button>
              )}
              {canDelete('fabinsa-production') && (
                <button
                  onClick={handleDeleteSelected}
                  className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Eliminar ({selectedProducts.size})</span>
                </button>
              )}
              <button
                onClick={() => setSelectedProducts(new Set())}
                className="px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100"
              >
                Cancelar selección
              </button>
            </>
          )}
          {canCreate('fabinsa-production') && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Producto</span>
            </button>
          )}
        </div>
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
                    Otros Costos (ARS)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.otros_costos}
                    onChange={(e) => setFormData({ ...formData, otros_costos: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Sección de Materiales */}
              <div className="border-t pt-4 mt-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Materiales</h4>
                  <div className="flex items-center gap-2">
                    {formMaterials.length > 0 && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        Peso total: <strong>{calculatePesoUnidad().toFixed(5)} kg/unidad</strong>
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={openMultiSelectModal}
                      className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition flex items-center gap-1"
                      title="Seleccionar múltiples materiales"
                    >
                      <Plus className="w-3 h-3" />
                      Selección múltiple
                    </button>
                  </div>
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
          <table className="w-full divide-y divide-gray-200 dark:divide-gray-700 table-fixed">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="w-[3%] px-2 py-2 text-center">
                  <input
                    type="checkbox"
                    checked={products.length > 0 && selectedProducts.size === products.length}
                    onChange={handleSelectAll}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                </th>
                <th className="w-[17%] px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Nombre
                </th>
                <th className="w-[10%] px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Peso (kg)
                </th>
                <th className="w-[10%] px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Cant. Fab.
                </th>
                <th className="w-[10%] px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Product.
                </th>
                <th className="w-[12%] px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Costo MP
                </th>
                <th className="w-[10%] px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Costo MO
                </th>
                <th className="w-[10%] px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Otros Costos
                </th>
                <th className="w-[10%] px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Costo Unit.
                </th>
                <th className="w-[10%] px-2 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Estado
                </th>
                <th className="w-[10%] px-2 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {products.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-2 py-4 text-center text-gray-500 dark:text-gray-400">
                    No hay órdenes de producción registradas
                  </td>
                </tr>
              ) : (
                products.map((product) => {
                  const costs = calculateProductCost(product);
                  const isSelected = selectedProducts.has(product.id);
                  return (
                    <tr 
                      key={product.id} 
                      className={`hover:bg-gray-50 dark:hover:bg-gray-700 ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                    >
                      <td className="px-2 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleProductToggle(product.id)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-2 py-3">
                        <div className="text-xs font-medium text-gray-900 dark:text-white truncate" title={product.nombre}>
                          {product.nombre}
                        </div>
                      </td>
                      <td className="px-2 py-3 text-xs text-gray-500 dark:text-gray-400">
                        {product.peso_unidad.toFixed(2)}
                      </td>
                      <td className="px-2 py-3 text-xs text-gray-500 dark:text-gray-400">
                        {product.cantidad_fabricar}
                      </td>
                      <td className="px-2 py-3 text-xs text-gray-500 dark:text-gray-400">
                        {product.cantidad_por_hora.toFixed(2)} u/h
                      </td>
                      <td className="px-2 py-3 text-xs text-gray-700 dark:text-gray-300 font-medium">
                        ${costs.costoMP.toFixed(2)}
                      </td>
                      <td className="px-2 py-3 text-xs text-gray-700 dark:text-gray-300 font-medium">
                        ${costs.costoMO.toFixed(2)}
                      </td>
                      <td className="px-2 py-3 text-xs text-gray-700 dark:text-gray-300 font-medium">
                        ${costs.otrosCostos.toFixed(2)}
                      </td>
                      <td className="px-2 py-3 text-xs text-blue-600 dark:text-blue-400 font-semibold">
                        ${costs.costoTotal.toFixed(2)}
                      </td>
                      <td className="px-2 py-3 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300">
                          Pendiente
                        </span>
                      </td>
                      <td className="px-2 py-3 text-right text-xs font-medium">
                        <div className="flex justify-end space-x-1">
                          {canEdit('fabinsa-production') && (
                            <button
                              onClick={() => completeProduction(product)}
                              className="text-green-600 dark:text-green-400 hover:text-green-900 dark:hover:text-green-300"
                              title="Completar producción y enviar al stock"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                          )}
                          {canEdit('fabinsa-production') && (
                            <button
                              onClick={() => handleEdit(product)}
                              className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
                              title="Editar orden"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          )}
                          {canDelete('fabinsa-production') && (
                            <button
                              onClick={() => handleDelete(product.id)}
                              className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                              title="Eliminar orden"
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
      </div>

      {/* Modales */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
        isLoading={isProcessing}
      />

      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal({ ...alertModal, isOpen: false })}
        title={alertModal.title}
        message={alertModal.message}
        type={alertModal.type}
      />

      {/* Modal de Selección Múltiple de Materiales */}
      {showMultiSelectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Seleccionar Múltiples Materiales
                </h3>
                <button
                  onClick={() => {
                    setShowMultiSelectModal(false);
                    setSelectedMaterials(new Set());
                    setMaterialQuantities({});
                  }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">
                Seleccione los materiales que desea agregar y especifique el kg por unidad para cada uno.
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {stockMaterials.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  No hay materiales disponibles en el stock
                </div>
              ) : (
                <div className="space-y-3">
                  {stockMaterials.map((mat) => {
                    const isSelected = selectedMaterials.has(mat.material);
                    return (
                      <div
                        key={mat.id}
                        className={`p-3 border rounded-lg transition ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleMaterialToggle(mat.material)}
                            className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-2">
                              <label className="text-sm font-medium text-gray-900 dark:text-white cursor-pointer">
                                {mat.material}
                              </label>
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                Stock: {mat.kg.toFixed(2)} kg
                              </span>
                            </div>
                            {isSelected && (
                              <div className="mt-2">
                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                  Kg por unidad
                                </label>
                                <input
                                  type="number"
                                  step="0.00001"
                                  value={materialQuantities[mat.material] || ''}
                                  onChange={(e) =>
                                    setMaterialQuantities({
                                      ...materialQuantities,
                                      [mat.material]: e.target.value,
                                    })
                                  }
                                  className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                  placeholder="0.00000"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowMultiSelectModal(false);
                  setSelectedMaterials(new Set());
                  setMaterialQuantities({});
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddMultipleMaterials}
                disabled={selectedMaterials.size === 0}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Agregar {selectedMaterials.size > 0 ? `(${selectedMaterials.size})` : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

