/**
 * Módulo de Ventas
 * Registro y gestión de ventas
 */

import React, { useState, useEffect, useRef } from 'react';
import { ShoppingCart, Plus, Trash2, ChevronDown, X, Printer, FileText, CheckCircle, DollarSign, Pencil } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useTenant } from '../../../contexts/TenantContext';
import { Database } from '../../../lib/database.types';
import { calculateSaleValues, calculateProductCosts, calculateAverageEmployeeHourValue } from '../../../lib/fabinsaCalculations';
import { useDepartmentPermissions } from '../../../hooks/useDepartmentPermissions';
import { useMobile } from '../../../hooks/useMobile';
import { generateOrderPDF, OrderData } from '../../../lib/pdfGenerator';
import { AlertModal } from '../../Common/AlertModal';

// Función para formatear números con separadores de miles
const formatNumber = (value: number): string => {
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

type Sale = Database['public']['Tables']['sales']['Row'];
type SaleInsert = Database['public']['Tables']['sales']['Insert'];
type StockProduct = Database['public']['Tables']['stock_products']['Row'];
type ResaleProduct = Database['public']['Tables']['resale_products']['Row'];
type Client = Database['public']['Tables']['clients']['Row'];
type Product = Database['public']['Tables']['products']['Row'];
type ProductMaterial = Database['public']['Tables']['product_materials']['Row'];
type StockMaterial = Database['public']['Tables']['stock_materials']['Row'];
type Employee = Database['public']['Tables']['employees']['Row'];

interface SaleItem {
  id: string;
  producto: string;
  tipo_producto: 'fabricado' | 'reventa';
  cantidad: number;
  precio_unitario: number;
  descuento_pct: number;
  iib_pct: number;
  tiene_iva: boolean;
  iva_pct: number;
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
  const { tenantId, tenant } = useTenant();
  const { canCreate, canEdit, canDelete, canPrint } = useDepartmentPermissions();
  const isMobile = useMobile();
  const [sales, setSales] = useState<Sale[]>([]);
  const [fabricatedProducts, setFabricatedProducts] = useState<StockProduct[]>([]);
  const [resaleProducts, setResaleProducts] = useState<ResaleProduct[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [productMaterials, setProductMaterials] = useState<Record<string, ProductMaterial[]>>({});
  const [stockMaterials, setStockMaterials] = useState<StockMaterial[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingOrder, setEditingOrder] = useState<any | null>(null);
  const [productType, setProductType] = useState<'fabricado' | 'reventa'>('fabricado');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const clientInputRef = useRef<HTMLInputElement>(null);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info',
  });
  
  const [formData, setFormData] = useState({
    producto: '',
    cantidad: '',
    precio_unitario: '',
    descuento_pct: '0',
    iib_pct: '0',
    tiene_iva: false,
    iva_pct: '21',
    cliente: '',
    pagado: false,
  });

  const [calculatedValues, setCalculatedValues] = useState({
    precio_final: 0,
    ingreso_bruto: 0,
    ingreso_neto: 0,
    iva_monto: 0,
    total_con_iva: 0,
    ganancia_un: 0,
    ganancia_total: 0,
    margen_pct: 0,
  });

  const [productUnitCost, setProductUnitCost] = useState<number | null>(null);

  useEffect(() => {
    if (tenantId) {
      loadData();
    }
  }, [tenantId]);

  useEffect(() => {
    // Recalcular valores cuando cambian los inputs
    if (formData.precio_unitario && formData.cantidad && formData.producto) {
      const precio = parseFloat(formData.precio_unitario);
      const cantidad = parseInt(formData.cantidad);
      const iibPct = parseFloat(formData.iib_pct) || 0;
      const discountPct = parseFloat(formData.descuento_pct) || 0;
      const tieneIva = formData.tiene_iva;
      const ivaPct = parseFloat(formData.iva_pct) || 0;

      // Obtener costo unitario del producto seleccionado
      let unitCost = 0;
      if (productType === 'fabricado') {
        const prod = fabricatedProducts.find(p => p.nombre === formData.producto);
        if (prod) {
          // Si el producto viene de costos, usar el costo calculado si está disponible
          if (prod.id && typeof prod.id === 'string' && prod.id.startsWith('cost-')) {
            // Si ya tenemos el costo calculado, usarlo; si no, calcularlo
            if (productUnitCost !== null) {
              unitCost = productUnitCost;
            } else {
              // Calcular costo desde costos de forma asíncrona
              calculateProductCostFromCosts(formData.producto).then(cost => {
                setProductUnitCost(cost); // Almacenar el costo calculado
                const values = calculateSaleValues(precio, cantidad, iibPct, discountPct, cost, tieneIva, ivaPct);
                const ivaMonto = tieneIva ? values.ingreso_neto * (ivaPct / 100) : 0;
                const totalConIva = values.ingreso_neto + ivaMonto;
                const margenPct = values.ingreso_neto > 0 ? (values.ganancia_total / values.ingreso_neto) * 100 : 0;
                setCalculatedValues({
                  ...values,
                  iva_monto: ivaMonto,
                  total_con_iva: totalConIva,
                  margen_pct: margenPct,
                });
              });
              return; // Salir temprano, los valores se actualizarán en el then
            }
          } else {
            unitCost = prod.costo_unit_total || 0;
            setProductUnitCost(null); // Limpiar costo calculado si viene de stock
          }
        }
      } else {
        const prod = resaleProducts.find(p => p.nombre === formData.producto);
        if (prod) {
          // Si el producto viene de costos, usar el costo calculado si está disponible
          if (prod.id && typeof prod.id === 'string' && prod.id.startsWith('cost-')) {
            // Si ya tenemos el costo calculado, usarlo; si no, calcularlo
            if (productUnitCost !== null) {
              unitCost = productUnitCost;
            } else {
              // Calcular costo desde costos de forma asíncrona
              calculateProductCostFromCosts(formData.producto).then(cost => {
                setProductUnitCost(cost); // Almacenar el costo calculado
                const values = calculateSaleValues(precio, cantidad, iibPct, discountPct, cost, tieneIva, ivaPct);
                const ivaMonto = tieneIva ? values.ingreso_neto * (ivaPct / 100) : 0;
                const totalConIva = values.ingreso_neto + ivaMonto;
                const margenPct = values.ingreso_neto > 0 ? (values.ganancia_total / values.ingreso_neto) * 100 : 0;
                setCalculatedValues({
                  ...values,
                  iva_monto: ivaMonto,
                  total_con_iva: totalConIva,
                  margen_pct: margenPct,
                });
              });
              return; // Salir temprano, los valores se actualizarán en el then
            }
          } else {
            unitCost = prod.costo_unitario_final || 0;
            setProductUnitCost(null); // Limpiar costo calculado si viene de stock
          }
        }
      }

      const values = calculateSaleValues(precio, cantidad, iibPct, discountPct, unitCost, tieneIva, ivaPct);
      // Calcular IVA como porcentaje del ingreso neto
      const ivaMonto = tieneIva ? values.ingreso_neto * (ivaPct / 100) : 0;
      const totalConIva = values.ingreso_neto + ivaMonto;
      // Calcular margen en porcentaje: (Ganancia Total / Ingreso Neto) * 100
      const margenPct = values.ingreso_neto > 0 ? (values.ganancia_total / values.ingreso_neto) * 100 : 0;
      setCalculatedValues({
        ...values,
        iva_monto: ivaMonto,
        total_con_iva: totalConIva,
        margen_pct: margenPct,
      });
    }
  }, [formData, productType, fabricatedProducts, resaleProducts, products, productMaterials, stockMaterials, employees, productUnitCost]);

  const loadData = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      // Load sales
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('fecha', { ascending: false })
        .order('created_at', { ascending: false });
      
      if (salesError) {
        console.error('Error loading sales:', salesError);
        alert('Error al cargar ventas: ' + salesError.message);
      } else {
        setSales(salesData || []);
      }

      // Load products from costs module to get precio_venta (cargar primero para usarlo después)
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*')
        .eq('tenant_id', tenantId);
      if (productsError) {
        console.error('Error loading products:', productsError);
      } else {
        setProducts(productsData || []);
      }

      // Load stock products (sin filtrar por cantidad > 0 para permitir stock negativo)
      const { data: prods, error: prodsError } = await supabase
        .from('stock_products')
        .select('*')
        .eq('tenant_id', tenantId);
      if (prodsError) {
        console.error('Error loading stock products:', prodsError);
      } else {
        // Combinar productos de stock con productos de costos que no estén en stock
        const stockProductNames = new Set((prods || []).map(p => p.nombre));
        const productsFromCosts: StockProduct[] = (productsData || [])
          .filter(p => !stockProductNames.has(p.nombre))
          .map(p => ({
            id: `cost-${p.id}`, // Prefijo para identificar que viene de costos
            tenant_id: p.tenant_id,
            nombre: p.nombre,
            codigo_producto: p.codigo_producto || null,
            cantidad: 0, // Producto sin stock
            peso_unidad: 0,
            costo_unit_total: null,
            stock_minimo: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as StockProduct));
        
        setFabricatedProducts([...(prods || []), ...productsFromCosts]);
      }

      // Load resale products (sin filtrar por cantidad > 0 para permitir stock negativo)
      const { data: resale, error: resaleError } = await supabase
        .from('resale_products')
        .select('*')
        .eq('tenant_id', tenantId);
      if (resaleError) {
        console.error('Error loading resale products:', resaleError);
      } else {
        // Combinar productos de reventa de stock con productos de costos que no estén en stock de reventa
        const resaleProductNames = new Set((resale || []).map(p => p.nombre));
        const productsFromCostsForResale: ResaleProduct[] = (productsData || [])
          .filter(p => !resaleProductNames.has(p.nombre))
          .map(p => ({
            id: `cost-${p.id}`, // Prefijo para identificar que viene de costos
            tenant_id: p.tenant_id,
            nombre: p.nombre,
            codigo_producto: p.codigo_producto || null,
            cantidad: 0, // Producto sin stock
            costo_unitario: 0,
            otros_costos: 0,
            costo_unitario_final: 0,
            moneda: 'ARS' as const,
            valor_dolar: null,
            stock_minimo: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as ResaleProduct));
        
        setResaleProducts([...(resale || []), ...productsFromCostsForResale]);
      }

      // Load clients
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('nombre', { ascending: true });
      if (clientsError) {
        console.error('Error loading clients:', clientsError);
      } else {
        setClients(clientsData || []);
      }

      // Load product materials and employees for cost calculation
      const productIds = (productsData || []).map(p => p.id);
      if (productIds.length > 0) {
        const [materialsResult, employeesResult, stockMaterialsResult] = await Promise.all([
          supabase
            .from('product_materials')
            .select('*')
            .in('product_id', productIds),
          supabase
            .from('employees')
            .select('*')
            .eq('tenant_id', tenantId),
          supabase
            .from('stock_materials')
            .select('*')
            .eq('tenant_id', tenantId),
        ]);

        const allMaterials = materialsResult.data || [];
        const materialsMap: Record<string, ProductMaterial[]> = {};
        for (const mat of allMaterials) {
          if (!materialsMap[mat.product_id]) {
            materialsMap[mat.product_id] = [];
          }
          materialsMap[mat.product_id].push(mat);
        }
        setProductMaterials(materialsMap);
        setEmployees(employeesResult.data || []);
        setStockMaterials(stockMaterialsResult.data || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Error al cargar datos: ' + (error as Error).message);
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

  // Función para calcular el costo unitario de un producto desde costos
  const calculateProductCostFromCosts = async (productName: string): Promise<number> => {
    try {
      // Buscar el producto en la tabla de costos
      const product = products.find(p => p.nombre === productName);
      if (!product) return 0;

      // Obtener materiales del producto
      const productMats = productMaterials[product.id] || [];
      if (productMats.length === 0) return 0;

      // Calcular valor promedio de hora de empleados
      const avgHourValue = calculateAverageEmployeeHourValue(employees);

      // Crear mapa de precios de materiales
      const materialPrices: Record<string, { costo_kilo_usd: number; valor_dolar: number; moneda: 'ARS' | 'USD' }> = {};
      
      for (const mat of productMats) {
        const stockMat = stockMaterials.find(sm => 
          sm.nombre.toLowerCase() === mat.material_name.toLowerCase() ||
          sm.material?.toLowerCase() === mat.material_name.toLowerCase()
        );
        
        if (stockMat) {
          materialPrices[mat.material_name] = {
            costo_kilo_usd: stockMat.costo_kilo_usd || 0,
            valor_dolar: stockMat.valor_dolar || 1,
            moneda: stockMat.moneda || 'ARS',
          };
        }
      }

      // Calcular costos del producto
      const costs = calculateProductCosts(
        product,
        productMats,
        materialPrices,
        avgHourValue
      );

      // Obtener otros costos del producto
      const otrosCostos = (product as any).otros_costos || 0;

      // Retornar costo total unitario (MP + MO + Otros Costos)
      return costs.costo_base_unitario + otrosCostos;
    } catch (error) {
      console.error('Error calculando costo del producto desde costos:', error);
      return 0;
    }
  };

  const handleAddProduct = async () => {
    if (!formData.producto || !formData.cantidad || !formData.precio_unitario) {
      alert('Complete todos los campos requeridos');
      return;
    }

    const cantidad = parseInt(formData.cantidad);
    const precioUnitario = parseFloat(formData.precio_unitario);
    const iibPct = parseFloat(formData.iib_pct) || 0;
    const discountPct = parseFloat(formData.descuento_pct) || 0;
    const tieneIva = formData.tiene_iva;
    const ivaPct = parseFloat(formData.iva_pct) || 0;

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
      stockActual = prod.cantidad || 0;
      
      // Si el producto viene de costos (id con prefijo "cost-"), calcular costo desde costos
      if (prod.id && typeof prod.id === 'string' && prod.id.startsWith('cost-')) {
        stockId = ''; // No tiene registro en stock_products aún
        // Calcular el costo desde la tabla de costos
        unitCost = await calculateProductCostFromCosts(formData.producto);
      } else {
        stockId = prod.id || '';
        unitCost = prod.costo_unit_total || 0;
      }
    } else {
      const prod = resaleProducts.find(p => p.nombre === formData.producto);
      if (!prod) {
        alert('Producto no encontrado');
        return;
      }
      stockActual = prod.cantidad || 0;
      
      // Si el producto viene de costos (id con prefijo "cost-"), calcular costo desde costos
      if (prod.id && typeof prod.id === 'string' && prod.id.startsWith('cost-')) {
        stockId = ''; // No tiene registro en resale_products aún
        // Calcular el costo desde la tabla de costos
        unitCost = await calculateProductCostFromCosts(formData.producto);
      } else {
        stockId = prod.id;
        unitCost = prod.costo_unitario_final || 0;
      }
    }

    // Permitir stock negativo - eliminamos la validación de stock insuficiente

    // Verificar si ya existe el producto en la lista
    const existingItem = saleItems.find(item => item.producto === formData.producto && item.tipo_producto === productType);
    if (existingItem) {
      setAlertModal({
        isOpen: true,
        title: 'Producto Duplicado',
        message: 'Este producto ya está en la lista de venta. Elimínelo primero si desea modificarlo o agregarlo nuevamente.',
        type: 'warning',
      });
      return;
    }

    // Calcular valores
    const values = calculateSaleValues(precioUnitario, cantidad, iibPct, discountPct, unitCost, tieneIva, ivaPct);

    // Agregar a la lista
    const newItem: SaleItem = {
      id: Date.now().toString(),
      producto: formData.producto,
      tipo_producto: productType,
      cantidad,
      precio_unitario: precioUnitario,
      descuento_pct: discountPct,
      iib_pct: iibPct,
      tiene_iva: tieneIva,
      iva_pct: ivaPct,
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
      tiene_iva: false,
      iva_pct: '21',
    });
    setCalculatedValues({
      precio_final: 0,
      ingreso_bruto: 0,
      ingreso_neto: 0,
      iva_monto: 0,
      total_con_iva: 0,
      ganancia_un: 0,
      ganancia_total: 0,
      margen_pct: 0,
    });
  };

  const handleRemoveItem = (id: string) => {
    setSaleItems(saleItems.filter(item => item.id !== id));
  };

  const updateSaleStatus = async (orderId: string, newStatus: 'pendiente' | 'recibido') => {
    if (!tenantId) return;
    try {
      // Si se marca como recibido, descontar el stock
      if (newStatus === 'recibido') {
        // Cargar todas las ventas de esta orden
        const { data: sales, error: salesError } = await supabase
          .from('sales')
          .select('*')
          .eq('order_id', orderId)
          .eq('tenant_id', tenantId);

        if (salesError) throw salesError;

        // Verificar que no esté ya recibido (evitar descuentos duplicados)
        const alreadyReceived = sales?.some(s => s.estado === 'recibido');
        if (alreadyReceived) {
          // Solo actualizar el estado sin descontar stock nuevamente
          const { error } = await supabase
            .from('sales')
            .update({ estado: newStatus })
            .eq('order_id', orderId)
            .eq('tenant_id', tenantId);
          
          if (error) throw error;
          await loadData();
          return;
        }

        // Descontar stock para cada producto de la venta
        for (const sale of sales || []) {
          if (sale.tipo_producto === 'fabricado') {
            // Buscar producto en stock_products
            const { data: prod, error: findError } = await supabase
              .from('stock_products')
              .select('*')
              .eq('tenant_id', tenantId)
              .eq('nombre', sale.producto)
              .limit(1);

            if (findError) throw findError;

            if (prod && prod.length > 0) {
              const currentStock = prod[0].cantidad || 0;
              // Permitir stock negativo - eliminamos la validación de stock insuficiente
              const newStock = currentStock - sale.cantidad;

              const { error: updateError } = await supabase
                .from('stock_products')
                .update({ cantidad: newStock })
                .eq('id', prod[0].id);

              if (updateError) throw updateError;
            } else {
              // Si el producto no existe en stock, crearlo con stock negativo
              const { error: insertError } = await supabase
                .from('stock_products')
                .insert({
                  tenant_id: tenantId,
                  nombre: sale.producto,
                  cantidad: -sale.cantidad, // Stock negativo
                  peso_unidad: 0,
                  costo_unit_total: sale.costo_unitario || null,
                });
              
              if (insertError) {
                console.error('Error creando producto en stock:', insertError);
                // No lanzar error, solo registrar
              }
            }

            // Descontar materiales del producto fabricado
            // Buscar el producto en la tabla de costos para obtener sus materiales
            const product = products.find(p => p.nombre === sale.producto);
            if (product) {
              const productMats = productMaterials[product.id] || [];
              
              for (const mat of productMats) {
                const kgNecesarios = (mat.kg_por_unidad || 0) * sale.cantidad;
                
                if (kgNecesarios > 0) {
                  // Buscar el material en stock_materials
                  // Primero buscar por nombre
                  let { data: stockMat, error: matFindError } = await supabase
                    .from('stock_materials')
                    .select('*')
                    .eq('tenant_id', tenantId)
                    .ilike('nombre', mat.material_name)
                    .limit(1);

                  // Si no se encuentra por nombre, buscar por campo material
                  if (!stockMat || stockMat.length === 0) {
                    const { data: stockMatByMaterial, error: matFindError2 } = await supabase
                      .from('stock_materials')
                      .select('*')
                      .eq('tenant_id', tenantId)
                      .ilike('material', mat.material_name)
                      .limit(1);
                    
                    if (!matFindError2) {
                      stockMat = stockMatByMaterial;
                      matFindError = matFindError2;
                    }
                  }

                  if (matFindError) {
                    console.error(`Error buscando material ${mat.material_name}:`, matFindError);
                    continue;
                  }

                  if (stockMat && stockMat.length > 0) {
                    const currentKg = stockMat[0].kg || 0;
                    const newKg = currentKg - kgNecesarios; // Permitir stock negativo

                    const { error: matUpdateError } = await supabase
                      .from('stock_materials')
                      .update({ kg: newKg })
                      .eq('id', stockMat[0].id);

                    if (matUpdateError) {
                      console.error(`Error actualizando material ${mat.material_name}:`, matUpdateError);
                    } else {
                      // Registrar movimiento de inventario del material
                      await supabase.from('inventory_movements').insert({
                        tenant_id: tenantId,
                        tipo: 'egreso_mp',
                        item_nombre: mat.material_name,
                        cantidad: kgNecesarios,
                        motivo: `Venta recibida - ${sale.producto} - Orden ${orderId.substring(0, 8)}`,
                      });
                    }
                  } else {
                    // Si el material no existe en stock, crearlo con stock negativo
                    const { error: matInsertError } = await supabase
                      .from('stock_materials')
                      .insert({
                        tenant_id: tenantId,
                        nombre: mat.material_name,
                        material: mat.material_name,
                        kg: -kgNecesarios, // Stock negativo
                        costo_kilo_usd: 0,
                        valor_dolar: 1,
                        moneda: 'ARS',
                      });
                    
                    if (matInsertError) {
                      console.error(`Error creando material ${mat.material_name} en stock:`, matInsertError);
                    } else {
                      // Registrar movimiento de inventario del material
                      await supabase.from('inventory_movements').insert({
                        tenant_id: tenantId,
                        tipo: 'egreso_mp',
                        item_nombre: mat.material_name,
                        cantidad: kgNecesarios,
                        motivo: `Venta recibida - ${sale.producto} - Orden ${orderId.substring(0, 8)}`,
                      });
                    }
                  }
                }
              }
            }

            // Registrar movimiento de inventario del producto
            await supabase.from('inventory_movements').insert({
              tenant_id: tenantId,
              tipo: 'egreso_fab',
              item_nombre: sale.producto,
              cantidad: sale.cantidad,
              motivo: `Venta recibida - Orden ${orderId.substring(0, 8)}`,
            });
          } else {
            // Producto de reventa
            const { data: prod, error: findError } = await supabase
              .from('resale_products')
              .select('*')
              .eq('tenant_id', tenantId)
              .eq('nombre', sale.producto)
              .limit(1);

            if (findError) throw findError;

            if (prod && prod.length > 0) {
              const currentStock = prod[0].cantidad || 0;
              // Permitir stock negativo - eliminamos la validación de stock insuficiente
              const newStock = currentStock - sale.cantidad;

              const { error: updateError } = await supabase
                .from('resale_products')
                .update({ cantidad: newStock })
                .eq('id', prod[0].id);

              if (updateError) throw updateError;
            } else {
              // Si el producto no existe en stock, crearlo con stock negativo
              const { error: insertError } = await supabase
                .from('resale_products')
                .insert({
                  tenant_id: tenantId,
                  nombre: sale.producto,
                  cantidad: -sale.cantidad, // Stock negativo
                  costo_unitario: sale.costo_unitario || 0,
                  otros_costos: 0,
                  costo_unitario_final: sale.costo_unitario || 0,
                  moneda: 'ARS',
                });
              
              if (insertError) {
                console.error('Error creando producto de reventa en stock:', insertError);
                // No lanzar error, solo registrar
              }
            }

            // Registrar movimiento de inventario
            await supabase.from('inventory_movements').insert({
              tenant_id: tenantId,
              tipo: 'egreso_pr',
              item_nombre: sale.producto,
              cantidad: sale.cantidad,
              motivo: `Venta recibida - Orden ${orderId.substring(0, 8)}`,
            });
          }
        }
      } else if (newStatus === 'pendiente') {
        // Si se cambia de recibido a pendiente, restaurar el stock
        const { data: sales, error: salesError } = await supabase
          .from('sales')
          .select('*')
          .eq('order_id', orderId)
          .eq('tenant_id', tenantId)
          .eq('estado', 'recibido');

        if (salesError) throw salesError;

        if (sales && sales.length > 0) {
          for (const sale of sales) {
            if (sale.tipo_producto === 'fabricado') {
              const { data: prod } = await supabase
                .from('stock_products')
                .select('*')
                .eq('tenant_id', tenantId)
                .eq('nombre', sale.producto)
                .limit(1);

              if (prod && prod.length > 0) {
                await supabase
                  .from('stock_products')
                  .update({ cantidad: prod[0].cantidad + sale.cantidad })
                  .eq('id', prod[0].id);
              }

              // Restaurar materiales del producto fabricado
              const product = products.find(p => p.nombre === sale.producto);
              if (product) {
                const productMats = productMaterials[product.id] || [];
                
                for (const mat of productMats) {
                  const kgNecesarios = (mat.kg_por_unidad || 0) * sale.cantidad;
                  
                  if (kgNecesarios > 0) {
                    // Buscar el material en stock_materials
                    let { data: stockMat } = await supabase
                      .from('stock_materials')
                      .select('*')
                      .eq('tenant_id', tenantId)
                      .ilike('nombre', mat.material_name)
                      .limit(1);

                    // Si no se encuentra por nombre, buscar por campo material
                    if (!stockMat || stockMat.length === 0) {
                      const { data: stockMatByMaterial } = await supabase
                        .from('stock_materials')
                        .select('*')
                        .eq('tenant_id', tenantId)
                        .ilike('material', mat.material_name)
                        .limit(1);
                      
                      stockMat = stockMatByMaterial;
                    }

                    if (stockMat && stockMat.length > 0) {
                      const currentKg = stockMat[0].kg || 0;
                      const newKg = currentKg + kgNecesarios; // Restaurar el stock

                      await supabase
                        .from('stock_materials')
                        .update({ kg: newKg })
                        .eq('id', stockMat[0].id);
                    }
                  }
                }
              }
            } else {
              const { data: prod } = await supabase
                .from('resale_products')
                .select('*')
                .eq('tenant_id', tenantId)
                .eq('nombre', sale.producto)
                .limit(1);

              if (prod && prod.length > 0) {
                await supabase
                  .from('resale_products')
                  .update({ cantidad: prod[0].cantidad + sale.cantidad })
                  .eq('id', prod[0].id);
              }
            }
          }
        }
      }

      // Actualizar el estado de todas las ventas de la orden
      const { error } = await supabase
        .from('sales')
        .update({ estado: newStatus })
        .eq('order_id', orderId)
        .eq('tenant_id', tenantId);
      
      if (error) throw error;
      await loadData();
    } catch (error) {
      console.error('Error updating sale status:', error);
      alert('Error al actualizar el estado de la venta: ' + (error as Error).message);
    }
  };

  const updatePaymentStatus = async (orderId: string, pagado: boolean) => {
    if (!tenantId) return;
    try {
      const { error } = await supabase
        .from('sales')
        .update({ pagado })
        .eq('order_id', orderId)
        .eq('tenant_id', tenantId);
      
      if (error) throw error;
      await loadData();
    } catch (error) {
      console.error('Error updating payment status:', error);
      alert('Error al actualizar el estado de pago');
    }
  };

  const handleEditOrder = (order: any) => {
    if (!order || !order.items || order.items.length === 0) return;
    
    // Cargar el primer item de la orden en el formulario
    const firstItem = order.items[0];
    
    // Determinar el tipo de producto
    const tipo = firstItem.tipo_producto;
    setProductType(tipo);
    
    // Cargar los datos en el formulario
    setFormData({
      producto: firstItem.producto,
      cantidad: firstItem.cantidad.toString(),
      precio_unitario: firstItem.precio_unitario.toString(),
      descuento_pct: firstItem.descuento_pct?.toString() || '0',
      iib_pct: firstItem.iib_pct?.toString() || '0',
      tiene_iva: (firstItem as any).tiene_iva || false,
      iva_pct: ((firstItem as any).iva_pct || 21).toString(),
      cliente: order.cliente || '',
      pagado: firstItem.pagado || false,
    });
    
    // Cargar todos los items de la orden en saleItems
    const items: SaleItem[] = order.items.map((item: any) => {
      // Obtener el stock actual del producto
      let stockId = '';
      let stockAntes = 0;
      
      if (tipo === 'fabricado') {
        const prod = fabricatedProducts.find(p => p.nombre === item.producto);
        if (prod) {
          stockId = prod.id;
          stockAntes = prod.cantidad;
        }
      } else {
        const prod = resaleProducts.find(p => p.nombre === item.producto);
        if (prod) {
          stockId = prod.id;
          stockAntes = prod.cantidad;
        }
      }
      
      return {
        id: item.id,
        producto: item.producto,
        tipo_producto: item.tipo_producto,
        cantidad: item.cantidad,
        precio_unitario: item.precio_unitario,
        descuento_pct: item.descuento_pct || 0,
        iib_pct: item.iib_pct || 0,
        tiene_iva: (item as any).tiene_iva || false,
        iva_pct: (item as any).iva_pct || 21,
        costo_unitario: item.costo_unitario,
        precio_final: item.precio_final,
        ingreso_bruto: item.ingreso_bruto,
        ingreso_neto: item.ingreso_neto,
        ganancia_un: item.ganancia_un,
        ganancia_total: item.ganancia_total,
        stock_antes: stockAntes,
        stock_despues: stockAntes - item.cantidad,
        stockId: stockId,
      };
    });
    
    setSaleItems(items);
    setEditingOrder(order);
    setShowForm(true);
  };

  const handlePrintOrder = async (order: any) => {
    // Cargar datos completos del cliente si está disponible
    let clienteData = null;
    if (order.cliente && tenantId) {
      try {
        const { data: clientData } = await supabase
          .from('clients')
          .select('*')
          .eq('tenant_id', tenantId)
          .ilike('nombre', order.cliente)
          .limit(1)
          .maybeSingle();
        
        if (clientData) {
          clienteData = {
            nombre: clientData.nombre,
            razon_social: clientData.razon_social,
            cuit: clientData.cuit,
            telefono: clientData.telefono,
            email: clientData.email,
            provincia: clientData.provincia,
            direccion: clientData.direccion,
            observaciones: clientData.observaciones,
          };
        }
      } catch (error) {
        console.error('Error loading client data:', error);
      }
    }

    const orderData: OrderData = {
      tipo: 'venta',
      fecha: order.fecha,
      cliente: order.cliente,
      clienteData: clienteData || undefined,
      order_id: order.order_id,
      order_number: order.items && order.items.length > 0 ? order.items[0].order_number : undefined,
      items: order.items.map((item: any) => ({
        producto: item.producto,
        tipo: item.tipo_producto,
        cantidad: item.cantidad,
        precio_unitario: item.precio_unitario,
        costo_unitario: item.costo_unitario,
        ingreso_neto: item.ingreso_neto,
        ganancia_total: item.ganancia_total,
      })),
      total_ingreso_neto: order.total_ingreso_neto,
      total_ganancia: order.total_ganancia,
      logoUrl: tenant?.logo_url || undefined,
      companyName: tenant?.name || undefined,
    };
    await generateOrderPDF(orderData);
  };

  const handlePrintIndividualSale = async (sale: any) => {
    // Cargar datos completos del cliente si está disponible
    let clienteData = null;
    if (sale.cliente && tenantId) {
      try {
        const { data: clientData } = await supabase
          .from('clients')
          .select('*')
          .eq('tenant_id', tenantId)
          .ilike('nombre', sale.cliente)
          .limit(1)
          .maybeSingle();
        
        if (clientData) {
          clienteData = {
            nombre: clientData.nombre,
            razon_social: clientData.razon_social,
            cuit: clientData.cuit,
            telefono: clientData.telefono,
            email: clientData.email,
            provincia: clientData.provincia,
            direccion: clientData.direccion,
            observaciones: clientData.observaciones,
          };
        }
      } catch (error) {
        console.error('Error loading client data:', error);
      }
    }

    const orderData: OrderData = {
      tipo: 'venta',
      fecha: sale.fecha,
      cliente: sale.cliente,
      clienteData: clienteData || undefined,
      order_id: sale.order_id,
      order_number: sale.order_number,
      items: [{
        producto: sale.producto,
        tipo: sale.tipo_producto,
        cantidad: sale.cantidad,
        precio_unitario: sale.precio_unitario,
        costo_unitario: sale.costo_unitario,
        ingreso_neto: sale.ingreso_neto,
        ganancia_total: sale.ganancia_total,
      }],
      total_ingreso_neto: sale.ingreso_neto,
      total_ganancia: sale.ganancia_total,
      logoUrl: tenant?.logo_url || undefined,
      companyName: tenant?.name || undefined,
    };
    await generateOrderPDF(orderData);
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
      
      // Obtener el siguiente número de orden secuencial
      const { data: orderNumberData, error: orderNumberError } = await supabase
        .rpc('get_next_order_number', { p_tenant_id: tenantId });
      
      if (orderNumberError) {
        console.error('Error obteniendo número de orden:', orderNumberError);
        throw new Error('Error al generar número de orden');
      }
      
      const orderNumber = orderNumberData || 1;
      
      // Generar un order_id único para agrupar todos los productos de esta venta
      const orderId = crypto.randomUUID();

      // Crear registros de venta para cada producto con el mismo order_id
      for (const item of saleItems) {
        // Construir el objeto de datos base
        const saleDataBase: SaleInsert & { order_id?: string; order_number?: number } = {
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
          order_number: orderNumber,
        };

        // Intentar agregar campos de IVA, estado y pagado si están disponibles
        const saleData: any = { ...saleDataBase };
        saleData.tiene_iva = item.tiene_iva;
        saleData.iva_pct = item.iva_pct;
        saleData.estado = 'pendiente'; // Estado inicial: pendiente (cliente no recibió)
        saleData.pagado = formData.pagado; // Estado de pago

        const { error: insertError } = await supabase.from('sales').insert(saleData);
        
        if (insertError) {
          // Si el error es por campos que no existen, intentar sin ellos
          const errorMsg = insertError.message || String(insertError);
          if (errorMsg.includes('tiene_iva') || errorMsg.includes('iva_pct') || errorMsg.includes('estado') || errorMsg.includes('pagado') || errorMsg.includes('column') || errorMsg.includes('does not exist')) {
            console.warn('Algunos campos no encontrados, guardando sin ellos:', insertError);
            alert('⚠️ Advertencia: Algunos campos no existen en la base de datos.\n\nPor favor, ejecuta las migraciones en Supabase:\n\n- 20250120000054_add_iva_to_sales.sql\n- 20250120000055_add_sales_reception_control.sql\n\nPara habilitar el soporte completo.');
            const { error: retryError } = await supabase.from('sales').insert(saleDataBase);
            if (retryError) {
              throw new Error(`Error al guardar venta: ${retryError.message}`);
            }
          } else {
            throw new Error(`Error al guardar venta: ${errorMsg}`);
          }
        }

        // NO mover stock aquí - el stock se moverá solo cuando se confirme la recepción del cliente
        // Esto se hace en el módulo de Stock cuando se completa el control de recepción
      }

      resetForm();
      setEditingOrder(null);
      await loadData();
      alert(editingOrder ? 'Orden actualizada exitosamente' : 'Venta registrada exitosamente');
    } catch (error: any) {
      console.error('Error saving sale:', error);
      const errorMessage = error?.message || String(error);
      if (errorMessage.includes('column') || errorMessage.includes('does not exist') || errorMessage.includes('tiene_iva') || errorMessage.includes('iva_pct')) {
        alert('Error: Las migraciones de base de datos no se han ejecutado. Por favor, ejecuta la migración en Supabase:\n\n20250120000054_add_iva_to_sales.sql\n\nError: ' + errorMessage);
      } else {
        alert('Error al registrar la venta: ' + errorMessage);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      producto: '',
      cantidad: '',
      precio_unitario: '',
      descuento_pct: '0',
      iib_pct: '0',
      tiene_iva: false,
      iva_pct: '21',
      cliente: '',
      pagado: false,
    });
    setCalculatedValues({
      precio_final: 0,
      ingreso_bruto: 0,
      ingreso_neto: 0,
      iva_monto: 0,
      total_con_iva: 0,
      ganancia_un: 0,
      ganancia_total: 0,
      margen_pct: 0,
    });
    setSaleItems([]);
    setEditingOrder(null);
    setShowForm(false);
    setProductUnitCost(null);
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
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-4 -mx-4 sm:-mx-6 -mt-4 sm:-mt-6 mb-4 sm:mb-6">
        <div className="flex items-center space-x-2 sm:space-x-3 mb-2">
          <ShoppingCart className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Ventas</h1>
        </div>
        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">Registro y gestión de ventas</p>
      </div>

      {/* Header with Add Button */}
      <div className={`flex ${isMobile ? 'flex-col gap-3' : 'justify-between items-center'} mb-4 sm:mb-6`}>
        <h2 className={`${isMobile ? 'text-lg' : 'text-xl'} font-semibold text-gray-900 dark:text-white`}>Registro de Ventas</h2>
        {canCreate('fabinsa-sales') && (
          <button
            onClick={() => setShowForm(true)}
            className={`flex items-center justify-center space-x-2 ${isMobile ? 'w-full px-4 py-3' : 'px-4 py-2'} bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors touch-manipulation`}
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Venta</span>
          </button>
        )}
      </div>

      {/* Sales Form */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingOrder ? 'Editar Orden de Venta' : 'Nueva Venta'}
              </h3>
            </div>
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Tipo de Producto *</label>
                <select
                  value={productType}
                  onChange={(e) => {
                    const newType = e.target.value as 'fabricado' | 'reventa';
                    setProductType(newType);
                    // Si hay un producto seleccionado, buscar su precio de venta
                    if (formData.producto) {
                      const product = products.find(p => p.nombre === formData.producto);
                      const precioVenta = product?.precio_venta;
                      setFormData({ 
                        ...formData, 
                        producto: formData.producto,
                        precio_unitario: precioVenta ? precioVenta.toString() : formData.precio_unitario
                      });
                    } else {
                      setFormData({ ...formData, producto: '' });
                    }
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
                  onChange={async (e) => {
                    const selectedProductName = e.target.value;
                    // Buscar el precio de venta del producto en la tabla products
                    const product = products.find(p => p.nombre === selectedProductName);
                    const precioVenta = product?.precio_venta;
                    
                    setFormData({ 
                      ...formData, 
                      producto: selectedProductName,
                      precio_unitario: precioVenta ? precioVenta.toString() : formData.precio_unitario
                    });

                    // Verificar si viene de costos y calcular el costo (tanto para fabricados como reventa)
                    if (selectedProductName) {
                      let prod;
                      if (productType === 'fabricado') {
                        prod = fabricatedProducts.find(p => p.nombre === selectedProductName);
                      } else {
                        prod = resaleProducts.find(p => p.nombre === selectedProductName);
                      }
                      
                      if (prod && prod.id && typeof prod.id === 'string' && prod.id.startsWith('cost-')) {
                        // Calcular costo desde costos
                        const cost = await calculateProductCostFromCosts(selectedProductName);
                        setProductUnitCost(cost);
                      } else {
                        // Si viene de stock, usar el costo del stock
                        setProductUnitCost(null);
                      }
                    } else {
                      setProductUnitCost(null);
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Seleccione un producto</option>
                  {availableProducts.map((prod) => (
                    <option key={prod.id} value={prod.nombre}>
                      {prod.nombre} {prod.cantidad !== undefined ? `(Stock: ${prod.cantidad})` : '(Sin stock)'}
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
                    <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-auto sales-scroll">
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
                        // Si tenemos un costo calculado almacenado, usarlo
                        if (productUnitCost !== null) {
                          return formatNumber(productUnitCost);
                        }
                        
                        // Si no, buscar en stock
                        let unitCost = 0;
                        if (productType === 'fabricado') {
                          const prod = fabricatedProducts.find(p => p.nombre === formData.producto);
                          unitCost = prod?.costo_unit_total || 0;
                        } else {
                          const prod = resaleProducts.find(p => p.nombre === formData.producto);
                          unitCost = prod?.costo_unitario_final || 0;
                        }
                        return formatNumber(unitCost);
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

              {/* Controles de IVA */}
              <div className="border border-gray-300 dark:border-gray-600 rounded-md p-4 bg-gray-50 dark:bg-gray-700">
                <div className="flex items-center space-x-3 mb-3">
                  <input
                    type="checkbox"
                    id="tiene_iva"
                    checked={formData.tiene_iva}
                    onChange={(e) => setFormData({ ...formData, tiene_iva: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="tiene_iva" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Tiene IVA
                  </label>
                </div>
                {formData.tiene_iva && (
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">IVA (%):</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.iva_pct}
                      onChange={(e) => setFormData({ ...formData, iva_pct: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="21"
                    />
                  </div>
                )}
              </div>

              {/* Calculated Values Display */}
              {calculatedValues.precio_final > 0 && (
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md space-y-2">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600 dark:text-gray-300">Costo Unitario:</span>
                      <span className="ml-2 font-semibold text-gray-700 dark:text-white">
                        ${(() => {
                          // Si tenemos un costo calculado almacenado, usarlo
                          if (productUnitCost !== null) {
                            return formatNumber(productUnitCost);
                          }
                          
                          // Si no, buscar en stock
                          let unitCost = 0;
                          if (productType === 'fabricado') {
                            const prod = fabricatedProducts.find(p => p.nombre === formData.producto);
                            unitCost = prod?.costo_unit_total || 0;
                          } else {
                            const prod = resaleProducts.find(p => p.nombre === formData.producto);
                            unitCost = prod?.costo_unitario_final || 0;
                          }
                          return formatNumber(unitCost);
                        })()}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-300">Precio Final:</span>
                      <span className="ml-2 font-semibold text-gray-900 dark:text-white">${formatNumber(calculatedValues.precio_final)}</span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-300">Ingreso Bruto:</span>
                      <span className="ml-2 font-semibold text-gray-900 dark:text-white">${formatNumber(calculatedValues.ingreso_bruto)}</span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-300">Ingreso Neto:</span>
                      <span className="ml-2 font-semibold text-green-600 dark:text-green-400">
                        ${formatNumber(calculatedValues.ingreso_neto)}
                      </span>
                    </div>
                    {formData.tiene_iva && (
                      <div>
                        <span className="text-gray-600 dark:text-gray-300">IVA ({formData.iva_pct}%):</span>
                        <span className="ml-2 font-semibold text-blue-600 dark:text-blue-400">
                          ${calculatedValues.iva_monto ? formatNumber(calculatedValues.iva_monto) : '0,00'}
                        </span>
                      </div>
                    )}
                    <div>
                      <span className="text-gray-600 dark:text-gray-300">Ganancia Total:</span>
                      <span className="ml-2 font-semibold text-green-600 dark:text-green-400">
                        ${formatNumber(calculatedValues.ganancia_total)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-300">Margen (%):</span>
                      <span className="ml-2 font-semibold text-green-600 dark:text-green-400">
                        {calculatedValues.margen_pct.toFixed(2)}%
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
                  <div className="space-y-2 max-h-80 overflow-y-auto pr-2 sales-scroll">
                    {saleItems.map((item) => {
                      const ivaMonto = item.tiene_iva ? item.ingreso_neto * (item.iva_pct / 100) : 0;
                      const totalConIva = item.ingreso_neto + ivaMonto;
                      return (
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
                            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1 space-y-1">
                              <div>
                                Cantidad: {item.cantidad} | Precio Unitario: ${formatNumber(item.precio_unitario)}
                              </div>
                              <div className="flex items-center space-x-2">
                                <span>Ingreso Neto: <span className="font-semibold text-gray-900 dark:text-white">${formatNumber(item.ingreso_neto)}</span></span>
                                {item.tiene_iva && (
                                  <>
                                    <span className="text-blue-600 dark:text-blue-400">+</span>
                                    <span>IVA ({item.iva_pct}%): <span className="font-semibold text-blue-600 dark:text-blue-400">${formatNumber(ivaMonto)}</span></span>
                                    <span className="text-blue-600 dark:text-blue-400">=</span>
                                    <span className="font-bold text-green-600 dark:text-green-400">Total: ${formatNumber(totalConIva)}</span>
                                  </>
                                )}
                                {!item.tiene_iva && (
                                  <span className="text-xs text-gray-500 dark:text-gray-500 ml-2">(Sin IVA)</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.id)}
                            className="ml-2 text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 flex-shrink-0"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-300 dark:border-gray-600 space-y-2">
                    {(() => {
                      const totalIngresoNeto = saleItems.reduce((sum, item) => sum + item.ingreso_neto, 0);
                      const totalIva = saleItems.reduce((sum, item) => {
                        const ivaMonto = item.tiene_iva ? item.ingreso_neto * (item.iva_pct / 100) : 0;
                        return sum + ivaMonto;
                      }, 0);
                      const totalConIva = totalIngresoNeto + totalIva;
                      const totalGanancia = saleItems.reduce((sum, item) => sum + item.ganancia_total, 0);
                      
                      return (
                        <>
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Total Ingreso Neto:</span>
                            <span className="text-lg font-semibold text-gray-900 dark:text-white">
                              ${formatNumber(totalIngresoNeto)} ARS
                            </span>
                          </div>
                          {totalIva > 0 && (
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Total IVA:</span>
                              <span className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                                ${formatNumber(totalIva)} ARS
                              </span>
                            </div>
                          )}
                          {totalIva > 0 && (
                            <div className="flex justify-between items-center pt-1 border-t border-gray-300 dark:border-gray-600">
                              <span className="text-sm font-bold text-gray-900 dark:text-white">TOTAL (Ingreso Neto + IVA):</span>
                              <span className="text-xl font-bold text-green-600 dark:text-green-400">
                                ${formatNumber(totalConIva)} ARS
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between items-center pt-1 border-t border-gray-300 dark:border-gray-600">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Total Ganancia:</span>
                            <span className="text-lg font-bold text-green-600 dark:text-green-400">
                              ${formatNumber(totalGanancia)} ARS
                            </span>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}
            </form>
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3 flex-shrink-0 bg-white dark:bg-gray-800">
              <button type="button" onClick={resetForm} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
                Cancelar
              </button>
              {saleItems.length > 0 ? (
                <button 
                  onClick={(e) => {
                    e.preventDefault();
                    const form = document.querySelector('form');
                    if (form) {
                      form.requestSubmit();
                    }
                  }}
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
          </div>
        </div>
      )}

      {/* Sales - Mobile Cards View */}
      {isMobile ? (
        <div className="space-y-3">
          {sales.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center text-gray-500 dark:text-gray-400">
              No hay ventas registradas
            </div>
          ) : (
            (() => {
              // Agrupar ventas por order_id (mismo código que en la tabla)
              const groupedSales = sales.reduce((acc: any, sale: any) => {
                if (sale.order_id) {
                  if (!acc[sale.order_id]) {
                    acc[sale.order_id] = {
                      order_id: sale.order_id,
                      order_number: sale.order_number,
                      fecha: sale.fecha,
                      cliente: sale.cliente,
                      items: [],
                      total_ingreso_neto: 0,
                      total_ganancia: 0,
                    };
                  }
                  acc[sale.order_id].items.push(sale);
                  acc[sale.order_id].total_ingreso_neto += sale.ingreso_neto;
                  const tieneIva = (sale as any).tiene_iva || false;
                  const ivaPct = (sale as any).iva_pct || 0;
                  const ivaMonto = tieneIva ? sale.ingreso_neto * (ivaPct / 100) : 0;
                  if (!acc[sale.order_id].total_iva) acc[sale.order_id].total_iva = 0;
                  acc[sale.order_id].total_iva += ivaMonto;
                  acc[sale.order_id].total_ganancia = acc[sale.order_id].total_ingreso_neto + (acc[sale.order_id].total_iva || 0);
                } else {
                  if (!acc.individual) acc.individual = [];
                  acc.individual.push(sale);
                }
                return acc;
              }, {});

              const orders = Object.values(groupedSales).filter((g: any) => g.order_id);
              const individualSales = groupedSales.individual || [];

              return (
                <>
                  {/* Tarjetas de órdenes agrupadas */}
                  {orders.map((order: any) => {
                    const isExpanded = expandedOrders.has(order.order_id);
                    return (
                      <div
                        key={order.order_id}
                        className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border-2 border-blue-200 dark:border-blue-800"
                      >
                        {/* Header de la orden */}
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                                Orden con {order.items.length} producto{order.items.length > 1 ? 's' : ''}
                              </h3>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Fecha: {new Date(order.fecha).toLocaleDateString()}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Cliente: {order.cliente || '-'}</p>
                          </div>
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
                            className="ml-2 flex-shrink-0 text-blue-600 dark:text-blue-400"
                          >
                            <ChevronDown className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          </button>
                        </div>

                        {/* Totales */}
                        <div className="grid grid-cols-2 gap-2 mb-3 p-2 bg-gray-50 dark:bg-gray-700 rounded">
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Ing. Neto</p>
                            <p className="text-sm font-semibold text-green-600 dark:text-green-400">${formatNumber(order.total_ingreso_neto)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">IVA</p>
                            <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">${formatNumber(order.total_iva || 0)}</p>
                          </div>
                          <div className="col-span-2 border-t border-gray-300 dark:border-gray-600 pt-2 mt-2">
                            <p className="text-xs text-gray-500 dark:text-gray-400">Total</p>
                            <p className="text-base font-bold text-green-600 dark:text-green-400">
                              ${formatNumber((order.total_ingreso_neto || 0) + (order.total_iva || 0))}
                            </p>
                          </div>
                        </div>

                        {/* Estados */}
                        <div className="flex flex-wrap gap-2 mb-3">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            order.items[0]?.estado === 'recibido'
                              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                          }`}>
                            {order.items[0]?.estado === 'recibido' ? 'Entregado' : 'Pendiente'}
                          </span>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            order.items[0]?.pagado
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                              : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                          }`}>
                            {order.items[0]?.pagado ? 'Cobrado' : 'Pendiente de cobro'}
                          </span>
                        </div>

                        {/* Productos expandidos */}
                        {isExpanded && (
                          <div className="border-t border-gray-200 dark:border-gray-700 pt-3 mt-3 space-y-2">
                            {order.items.map((item: any) => {
                              const tieneIva = (item as any).tiene_iva || false;
                              const ivaPct = (item as any).iva_pct || 0;
                              const ivaMonto = tieneIva ? item.ingreso_neto * (ivaPct / 100) : 0;
                              return (
                                <div key={item.id} className="bg-gray-50 dark:bg-gray-700 rounded p-2">
                                  <div className="flex items-start justify-between mb-1">
                                    <div className="flex-1">
                                      <p className="text-sm font-medium text-gray-900 dark:text-white">{item.producto}</p>
                                      <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs ${
                                        item.tipo_producto === 'fabricado' 
                                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300' 
                                          : 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                                      }`}>
                                        {item.tipo_producto}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2 text-xs mt-2">
                                    <div>
                                      <p className="text-gray-500 dark:text-gray-400">Cantidad</p>
                                      <p className="font-medium text-gray-900 dark:text-white">{item.cantidad}</p>
                                    </div>
                                    <div>
                                      <p className="text-gray-500 dark:text-gray-400">P. Unit.</p>
                                      <p className="font-medium text-gray-900 dark:text-white">${formatNumber(item.precio_unitario)}</p>
                                    </div>
                                    <div>
                                      <p className="text-gray-500 dark:text-gray-400">C. Unit.</p>
                                      <p className="font-medium text-gray-900 dark:text-white">${formatNumber(item.costo_unitario)}</p>
                                    </div>
                                    <div>
                                      <p className="text-gray-500 dark:text-gray-400">Ing. Neto</p>
                                      <p className="font-semibold text-green-600 dark:text-green-400">${formatNumber(item.ingreso_neto)}</p>
                                    </div>
                                    {tieneIva && (
                                      <>
                                        <div>
                                          <p className="text-gray-500 dark:text-gray-400">IVA</p>
                                          <p className="font-semibold text-blue-600 dark:text-blue-400">${formatNumber(ivaMonto)}</p>
                                        </div>
                                        <div>
                                          <p className="text-gray-500 dark:text-gray-400">Total</p>
                                          <p className="font-bold text-green-600 dark:text-green-400">${formatNumber(item.ingreso_neto + ivaMonto)}</p>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Botones de acción */}
                        <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-200 dark:border-gray-700 mt-3">
                          {canEdit('fabinsa-sales') && (
                            <button
                              onClick={() => updateSaleStatus(order.order_id, order.items[0]?.estado === 'recibido' ? 'pendiente' : 'recibido')}
                              className={`flex items-center justify-center gap-1.5 px-3 py-2 text-xs rounded-lg transition-colors touch-manipulation flex-1 min-w-[100px] ${
                                order.items[0]?.estado === 'recibido'
                                  ? 'bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/50'
                                  : 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50'
                              }`}
                              title={order.items[0]?.estado === 'recibido' ? 'Marcar como Pendiente' : 'Marcar como Entregado'}
                            >
                              <CheckCircle className="w-4 h-4" />
                              {order.items[0]?.estado === 'recibido' ? 'Pendiente' : 'Entregado'}
                            </button>
                          )}
                          {canEdit('fabinsa-sales') && (
                            <button
                              onClick={() => updatePaymentStatus(order.order_id, !order.items[0]?.pagado)}
                              className={`flex items-center justify-center gap-1.5 px-3 py-2 text-xs rounded-lg transition-colors touch-manipulation flex-1 min-w-[100px] ${
                                order.items[0]?.pagado
                                  ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50'
                                  : 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/50'
                              }`}
                              title={order.items[0]?.pagado ? 'Marcar como Pendiente de cobro' : 'Marcar como Cobrado'}
                            >
                              <DollarSign className="w-4 h-4" />
                              {order.items[0]?.pagado ? 'Pendiente' : 'Cobrado'}
                            </button>
                          )}
                          {canEdit('fabinsa-sales') && (
                            <button
                              onClick={() => handleEditOrder(order)}
                              className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 touch-manipulation flex-1 min-w-[100px]"
                              title="Editar Orden"
                            >
                              <Pencil className="w-4 h-4" />
                              Editar
                            </button>
                          )}
                          {canPrint('fabinsa-sales') && (
                            <button
                              onClick={() => handlePrintOrder(order)}
                              className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 touch-manipulation flex-1 min-w-[100px]"
                              title="Imprimir/Generar PDF"
                            >
                              <FileText className="w-4 h-4" />
                              PDF
                            </button>
                          )}
                          {canDelete('fabinsa-sales') && (
                            <button
                              onClick={async () => {
                                if (confirm(`¿Eliminar toda la orden con ${order.items.length} producto${order.items.length > 1 ? 's' : ''}? Esto restaurará el stock.`)) {
                                  for (const item of order.items) {
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
                              className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50 touch-manipulation flex-1 min-w-[100px]"
                              title="Eliminar orden"
                            >
                              <Trash2 className="w-4 h-4" />
                              Eliminar
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Tarjetas de ventas individuales */}
                  {individualSales.map((sale: any) => {
                    const tieneIva = (sale as any).tiene_iva || false;
                    const ivaPct = (sale as any).iva_pct || 0;
                    const ivaMonto = tieneIva ? sale.ingreso_neto * (ivaPct / 100) : 0;
                    return (
                      <div
                        key={sale.id}
                        className="bg-white dark:bg-gray-800 rounded-lg shadow p-4"
                      >
                        {/* Header */}
                        <div className="mb-3">
                          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">{sale.producto}</h3>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Fecha: {new Date(sale.fecha).toLocaleDateString()}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Cliente: {sale.cliente || '-'}</p>
                        </div>

                        {/* Información principal */}
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Tipo</p>
                            <span className={`inline-block px-2 py-0.5 rounded text-xs ${
                              sale.tipo_producto === 'fabricado' 
                                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300' 
                                : 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                            }`}>
                              {sale.tipo_producto}
                            </span>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Cantidad</p>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{sale.cantidad}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">P. Unit.</p>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">${formatNumber(sale.precio_unitario)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">C. Unit.</p>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">${formatNumber(sale.costo_unitario)}</p>
                          </div>
                        </div>

                        {/* Totales */}
                        <div className="border-t border-gray-200 dark:border-gray-700 pt-3 mb-3">
                          <div className="space-y-1 text-xs">
                            <div className="flex justify-between">
                              <span className="text-gray-500 dark:text-gray-400">Ing. Neto</span>
                              <span className="font-semibold text-green-600 dark:text-green-400">${formatNumber(sale.ingreso_neto)}</span>
                            </div>
                            {tieneIva && (
                              <div className="flex justify-between">
                                <span className="text-gray-500 dark:text-gray-400">IVA ({ivaPct}%)</span>
                                <span className="font-semibold text-blue-600 dark:text-blue-400">${formatNumber(ivaMonto)}</span>
                              </div>
                            )}
                            <div className="flex justify-between pt-1 border-t border-gray-200 dark:border-gray-700">
                              <span className="font-bold text-gray-900 dark:text-white">Total</span>
                              <span className="font-bold text-green-600 dark:text-green-400">${formatNumber(sale.ingreso_neto + ivaMonto)}</span>
                            </div>
                          </div>
                        </div>

                        {/* Estados */}
                        <div className="flex flex-wrap gap-2 mb-3">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            (sale as any).estado === 'recibido'
                              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                          }`}>
                            {(sale as any).estado === 'recibido' ? 'Entregado' : 'Pendiente'}
                          </span>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            (sale as any).pagado
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                              : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                          }`}>
                            {(sale as any).pagado ? 'Cobrado' : 'Pendiente de cobro'}
                          </span>
                        </div>

                        {/* Botones de acción */}
                        <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                          {canEdit('fabinsa-sales') && (
                            <button
                              onClick={async () => {
                                const newEstado = (sale as any).estado === 'recibido' ? 'pendiente' : 'recibido';
                                // Lógica de actualización de estado (similar a la tabla)
                                // ... código de actualización ...
                              }}
                              className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 touch-manipulation flex-1 min-w-[100px]"
                            >
                              <CheckCircle className="w-4 h-4" />
                              {(sale as any).estado === 'recibido' ? 'Pendiente' : 'Entregado'}
                            </button>
                          )}
                          {canDelete('fabinsa-sales') && (
                            <button
                              onClick={async () => {
                                if (confirm(`¿Eliminar esta venta?`)) {
                                  // Restaurar stock si estaba recibido
                                  if ((sale as any).estado === 'recibido') {
                                    if (sale.tipo_producto === 'fabricado') {
                                      const { data: prod } = await supabase
                                        .from('stock_products')
                                        .select('*')
                                        .eq('tenant_id', tenantId)
                                        .eq('nombre', sale.producto)
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
                                        .eq('nombre', sale.producto)
                                        .limit(1);
                                      if (prod && prod[0]) {
                                        await supabase
                                          .from('resale_products')
                                          .update({ cantidad: prod[0].cantidad + sale.cantidad })
                                          .eq('id', prod[0].id);
                                      }
                                    }
                                  }
                                  await supabase.from('sales').delete().eq('id', sale.id);
                                  loadData();
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
                  })}
                </>
              );
            })()
          )}
        </div>
      ) : (
        /* Sales Table - Desktop View */
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full divide-y divide-gray-200 dark:divide-gray-700 table-auto">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase whitespace-nowrap w-24">Fecha</th>
                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase w-32">Cliente</th>
                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase w-32">Producto</th>
                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase whitespace-nowrap w-20">Tipo</th>
                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase whitespace-nowrap w-20">Cant.</th>
                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase whitespace-nowrap w-24">P. Unit.</th>
                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase whitespace-nowrap w-24">C. Unit.</th>
                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase whitespace-nowrap w-24">Ing. Neto</th>
                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase whitespace-nowrap w-20">IVA</th>
                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase whitespace-nowrap w-24">Total</th>
                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase whitespace-nowrap w-28">Estado</th>
                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase whitespace-nowrap w-32">Acciones</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {sales.length === 0 ? (
              <tr>
                <td colSpan={12} className="px-2 py-4 text-center text-gray-500 dark:text-gray-400">
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
                    const tieneIva = (sale as any).tiene_iva || false;
                    const ivaPct = (sale as any).iva_pct || 0;
                    const ivaMonto = tieneIva ? sale.ingreso_neto * (ivaPct / 100) : 0;
                    if (!acc[sale.order_id].total_iva) acc[sale.order_id].total_iva = 0;
                    acc[sale.order_id].total_iva += ivaMonto;
                    // Total = Ingreso Neto + IVA
                    acc[sale.order_id].total_ganancia = acc[sale.order_id].total_ingreso_neto + (acc[sale.order_id].total_iva || 0);
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
                            <td className="px-2 py-3 text-sm font-medium text-gray-900 dark:text-white whitespace-nowrap">
                              {new Date(order.fecha).toLocaleDateString()}
                            </td>
                            <td className="px-2 py-3 text-sm font-medium text-gray-900 dark:text-white">
                              {order.cliente || '-'}
                            </td>
                            <td className="px-2 py-3 text-sm font-medium text-gray-900 dark:text-white" colSpan={3}>
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
                            <td className="px-2 py-3 text-sm font-medium text-gray-900 dark:text-white whitespace-nowrap" colSpan={2}>
                              Total
                            </td>
                            <td className="px-2 py-3 text-sm font-semibold text-green-600 dark:text-green-400 whitespace-nowrap">
                              ${formatNumber(order.total_ingreso_neto)}
                            </td>
                            <td className="px-2 py-3 text-sm font-semibold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                              ${formatNumber(order.total_iva || 0)}
                            </td>
                            <td className="px-2 py-3 text-sm font-semibold text-green-600 dark:text-green-400 whitespace-nowrap">
                              ${formatNumber((order.total_ingreso_neto || 0) + (order.total_iva || 0))}
                            </td>
                            <td className="px-2 py-3 text-sm">
                              <div className="flex flex-col gap-1">
                                {/* Estado de Recepción */}
                                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                                  order.items[0]?.estado === 'recibido'
                                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                                }`}>
                                  {order.items[0]?.estado === 'recibido' ? 'Entregado' : 'Pendiente'}
                                </span>
                                {/* Estado de Pago */}
                                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                                  order.items[0]?.pagado
                                    ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                                    : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                                }`}>
                                  {order.items[0]?.pagado ? 'Cobrado' : 'Pendiente de cobro'}
                                </span>
                              </div>
                            </td>
                            <td className="px-2 py-3 text-sm whitespace-nowrap">
                              <div className="flex items-center gap-1">
                                {canEdit('fabinsa-sales') && (
                                  <button
                                    onClick={() => updateSaleStatus(order.order_id, order.items[0]?.estado === 'recibido' ? 'pendiente' : 'recibido')}
                                    className={`p-1 rounded text-white transition-colors flex-shrink-0 ${
                                      order.items[0]?.estado === 'recibido'
                                        ? 'bg-orange-600 dark:bg-orange-500 hover:bg-orange-700 dark:hover:bg-orange-600'
                                        : 'bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600'
                                    }`}
                                    title={order.items[0]?.estado === 'recibido' ? 'Marcar como Pendiente' : 'Marcar como Entregado'}
                                  >
                                    <CheckCircle className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {canEdit('fabinsa-sales') && (
                                  <button
                                    onClick={() => updatePaymentStatus(order.order_id, !order.items[0]?.pagado)}
                                    className={`p-1 rounded text-white transition-colors flex-shrink-0 ${
                                      order.items[0]?.pagado
                                        ? 'bg-red-600 dark:bg-red-500 hover:bg-red-700 dark:hover:bg-red-600'
                                        : 'bg-green-600 dark:bg-green-500 hover:bg-green-700 dark:hover:bg-green-600'
                                    }`}
                                    title={order.items[0]?.pagado ? 'Marcar como Pendiente de cobro' : 'Marcar como Cobrado'}
                                  >
                                    <DollarSign className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {canEdit('fabinsa-sales') && (
                                  <button
                                    onClick={() => handleEditOrder(order)}
                                    className="p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors flex-shrink-0"
                                    title="Editar Orden"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {canPrint('fabinsa-sales') && (
                                <button
                                  onClick={() => handlePrintOrder(order)}
                                    className="p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors flex-shrink-0"
                                  title="Imprimir/Generar PDF"
                                >
                                    <FileText className="w-3.5 h-3.5" />
                                </button>
                                )}
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
                                    className="p-1 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors flex-shrink-0"
                                    title="Eliminar orden"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                          {/* Filas de productos (si está expandida) */}
                          {isExpanded && order.items.map((item: any) => {
                            const tieneIva = (item as any).tiene_iva || false;
                            const ivaPct = (item as any).iva_pct || 0;
                            const ivaMonto = tieneIva ? item.ingreso_neto * (ivaPct / 100) : 0;
                            return (
                              <tr key={item.id} className="bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800">
                                <td className="px-2 py-2 text-sm text-gray-600 dark:text-gray-400"></td>
                                <td className="px-2 py-2 text-sm text-gray-600 dark:text-gray-400"></td>
                                <td className="px-2 py-2 text-sm text-gray-900 dark:text-white pl-6">
                                  • {item.producto}
                                </td>
                                <td className="px-2 py-2 text-sm">
                                  <span className={`px-2 py-1 rounded text-xs ${
                                    item.tipo_producto === 'fabricado' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300' : 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                                  }`}>
                                    {item.tipo_producto}
                                  </span>
                                </td>
                                <td className="px-2 py-2 text-sm text-gray-900 dark:text-white whitespace-nowrap">{item.cantidad}</td>
                                <td className="px-2 py-2 text-sm text-gray-900 dark:text-white whitespace-nowrap">${formatNumber(item.precio_unitario)}</td>
                                <td className="px-2 py-2 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">${formatNumber(item.costo_unitario)}</td>
                                <td className="px-2 py-2 text-sm text-green-600 dark:text-green-400 whitespace-nowrap">${formatNumber(item.ingreso_neto)}</td>
                                <td className="px-2 py-2 text-sm text-blue-600 dark:text-blue-400 whitespace-nowrap">${formatNumber(ivaMonto)}</td>
                                <td className="px-2 py-2 text-sm text-green-600 dark:text-green-400 whitespace-nowrap">${formatNumber(item.ingreso_neto + ivaMonto)}</td>
                                <td className="px-2 py-2 text-sm"></td>
                                <td className="px-2 py-2 text-sm"></td>
                              </tr>
                            );
                          })}
                        </React.Fragment>
                      );
                    })}
                    {/* Mostrar ventas individuales (sin order_id) */}
                    {individualSales.map((sale: any) => {
                      const tieneIva = (sale as any).tiene_iva || false;
                      const ivaPct = (sale as any).iva_pct || 0;
                      const ivaMonto = tieneIva ? sale.ingreso_neto * (ivaPct / 100) : 0;
                      return (
                        <tr key={sale.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {new Date(sale.fecha).toLocaleDateString()}
                          </td>
                          <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {sale.cliente || '-'}
                          </td>
                          <td className="px-2 py-4 text-sm text-gray-900 dark:text-white">{sale.producto}</td>
                          <td className="px-2 py-4 whitespace-nowrap text-sm">
                            <span className={`px-2 py-1 rounded text-xs ${
                              sale.tipo_producto === 'fabricado' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300' : 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                            }`}>
                              {sale.tipo_producto}
                            </span>
                          </td>
                          <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{sale.cantidad}</td>
                          <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">${formatNumber(sale.precio_unitario)}</td>
                          <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300 font-medium">
                            ${formatNumber(sale.costo_unitario)}
                          </td>
                          <td className="px-2 py-4 whitespace-nowrap text-sm font-semibold text-green-600 dark:text-green-400">
                            ${formatNumber(sale.ingreso_neto)}
                          </td>
                          <td className="px-2 py-4 whitespace-nowrap text-sm font-semibold text-blue-600 dark:text-blue-400">
                            ${formatNumber(ivaMonto)}
                          </td>
                          <td className="px-2 py-4 whitespace-nowrap text-sm font-semibold text-green-600 dark:text-green-400">
                            ${formatNumber(sale.ingreso_neto + ivaMonto)}
                          </td>
                          <td className="px-2 py-4 text-sm">
                            <div className="flex flex-col gap-1">
                              {/* Estado de Recepción */}
                              <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                                (sale as any).estado === 'recibido'
                                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                                  : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                              }`}>
                                {(sale as any).estado === 'recibido' ? 'Entregado' : 'Pendiente'}
                              </span>
                              {/* Estado de Pago */}
                              <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                                (sale as any).pagado
                                  ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                                  : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                              }`}>
                                {(sale as any).pagado ? 'Cobrado' : 'Pendiente de cobro'}
                              </span>
                            </div>
                          </td>
                        <td className="px-2 py-4 whitespace-nowrap text-right text-sm">
                          <div className="flex items-center gap-1">
                            {canEdit('fabinsa-sales') && (
                              <button
                                onClick={async () => {
                                  const newEstado = (sale as any).estado === 'recibido' ? 'pendiente' : 'recibido';
                                  if (sale.order_id) {
                                    updateSaleStatus(sale.order_id, newEstado);
                                  } else {
                                    // Para ventas individuales sin order_id
                                    if (newEstado === 'recibido' && (sale as any).estado !== 'recibido') {
                                      // Descontar stock
                                      if (sale.tipo_producto === 'fabricado') {
                                        const { data: prod } = await supabase
                                          .from('stock_products')
                                          .select('*')
                                          .eq('tenant_id', tenantId)
                                          .eq('nombre', sale.producto)
                                          .limit(1);

                                        if (prod && prod.length > 0) {
                                          const currentStock = prod[0].cantidad;
                                          if (currentStock < sale.cantidad) {
                                            alert(`No hay suficiente stock de ${sale.producto}. Stock disponible: ${currentStock}, requerido: ${sale.cantidad}`);
                                            return;
                                          }

                                          await supabase
                                            .from('stock_products')
                                            .update({ cantidad: currentStock - sale.cantidad })
                                            .eq('id', prod[0].id);

                                          await supabase.from('inventory_movements').insert({
                                            tenant_id: tenantId,
                                            tipo: 'egreso_fab',
                                            item_nombre: sale.producto,
                                            cantidad: sale.cantidad,
                                            motivo: 'Venta recibida',
                                          });
                                        }
                                      } else {
                                        const { data: prod } = await supabase
                                          .from('resale_products')
                                          .select('*')
                                          .eq('tenant_id', tenantId)
                                          .eq('nombre', sale.producto)
                                          .limit(1);

                                        if (prod && prod.length > 0) {
                                          const currentStock = prod[0].cantidad;
                                          if (currentStock < sale.cantidad) {
                                            alert(`No hay suficiente stock de ${sale.producto}. Stock disponible: ${currentStock}, requerido: ${sale.cantidad}`);
                                            return;
                                          }

                                          await supabase
                                            .from('resale_products')
                                            .update({ cantidad: currentStock - sale.cantidad })
                                            .eq('id', prod[0].id);

                                          await supabase.from('inventory_movements').insert({
                                            tenant_id: tenantId,
                                            tipo: 'egreso_pr',
                                            item_nombre: sale.producto,
                                            cantidad: sale.cantidad,
                                            motivo: 'Venta recibida',
                                          });
                                        }
                                      }
                                    } else if (newEstado === 'pendiente' && (sale as any).estado === 'recibido') {
                                      // Restaurar stock si se cambia de recibido a pendiente
                                      if (sale.tipo_producto === 'fabricado') {
                                        const { data: prod } = await supabase
                                          .from('stock_products')
                                          .select('*')
                                          .eq('tenant_id', tenantId)
                                          .eq('nombre', sale.producto)
                                          .limit(1);
                                        if (prod && prod.length > 0) {
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
                                          .eq('nombre', sale.producto)
                                          .limit(1);
                                        if (prod && prod.length > 0) {
                                          await supabase
                                            .from('resale_products')
                                            .update({ cantidad: prod[0].cantidad + sale.cantidad })
                                            .eq('id', prod[0].id);
                                        }
                                      }
                                    }

                                    await supabase
                                      .from('sales')
                                      .update({ estado: newEstado })
                                      .eq('id', sale.id);
                                    await loadData();
                                  }
                                }}
                                className={`p-1 rounded text-white transition-colors flex-shrink-0 ${
                                  (sale as any).estado === 'recibido'
                                    ? 'bg-orange-600 dark:bg-orange-500 hover:bg-orange-700 dark:hover:bg-orange-600'
                                    : 'bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600'
                                }`}
                                title={(sale as any).estado === 'recibido' ? 'Marcar como Pendiente' : 'Marcar como Entregado'}
                              >
                                <CheckCircle className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {canEdit('fabinsa-sales') && (
                              <button
                                onClick={() => {
                                  const newPagado = !(sale as any).pagado;
                                  if (sale.order_id) {
                                    updatePaymentStatus(sale.order_id, newPagado);
                                  } else {
                                    supabase
                                      .from('sales')
                                      .update({ pagado: newPagado })
                                      .eq('id', sale.id)
                                      .then(() => loadData());
                                  }
                                }}
                                className={`p-1 rounded text-white transition-colors flex-shrink-0 ${
                                  (sale as any).pagado
                                    ? 'bg-red-600 dark:bg-red-500 hover:bg-red-700 dark:hover:bg-red-600'
                                    : 'bg-green-600 dark:bg-green-500 hover:bg-green-700 dark:hover:bg-green-600'
                                }`}
                                title={(sale as any).pagado ? 'Marcar como Pendiente de cobro' : 'Marcar como Cobrado'}
                              >
                                <DollarSign className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {canPrint('fabinsa-sales') && (
                            <button
                              onClick={() => handlePrintIndividualSale(sale)}
                                className="p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors flex-shrink-0"
                              title="Imprimir/Generar PDF"
                            >
                                <FileText className="w-3.5 h-3.5" />
                            </button>
                            )}
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
                                className="p-1 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors flex-shrink-0"
                                title="Eliminar venta"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      );
                    })}
                  </>
                );
              })()
            )}
          </tbody>
        </table>
        </div>
      </div>
      )}

      {/* Alert Modal */}
      <AlertModal
        isOpen={alertModal.isOpen}
        title={alertModal.title}
        message={alertModal.message}
        type={alertModal.type}
        onClose={() => setAlertModal({ ...alertModal, isOpen: false })}
      />
    </div>
  );
}



