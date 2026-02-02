/**
 * Módulo de Compras
 * Registro de compras de materia prima y productos
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { TrendingUp, Plus, Edit, Trash2, Save, X, ChevronDown, FileText, CheckCircle, Package, DollarSign } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useTenant } from '../../../contexts/TenantContext';
import { Database } from '../../../lib/database.types';
import { useDepartmentPermissions } from '../../../hooks/useDepartmentPermissions';
import { generateOrderPDF, OrderData } from '../../../lib/pdfGenerator';

// Función para formatear números con separadores de miles
const formatNumber = (value: number): string => {
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

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
  tiene_iva: boolean;
  iva_pct: number;
  total: number;
  total_con_iva?: number;
}

interface ProductItem {
  id: string;
  producto: string;
  codigo_producto: string | null;
  cantidad: number;
  precio: number;
  moneda: 'ARS' | 'USD';
  valor_dolar: number;
  precioARS: number;
  tiene_iva: boolean;
  iva_pct: number;
  total: number;
  total_con_iva?: number;
}

export function PurchasesModule() {
  const { tenantId, tenant } = useTenant();
  const { canCreate, canEdit, canDelete, canPrint } = useDepartmentPermissions();
  const [activeTab, setActiveTab] = useState<TabType>('materials');
  
  // Compras de Materia Prima
  const [materialPurchases, setMaterialPurchases] = useState<PurchaseMaterial[]>([]);
  const [showMaterialForm, setShowMaterialForm] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<PurchaseMaterial | null>(null);
  const [editingMaterialOrder, setEditingMaterialOrder] = useState<any | null>(null);
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
  const [editingProductOrder, setEditingProductOrder] = useState<any | null>(null);
  const [productItems, setProductItems] = useState<ProductItem[]>([]);
  const [productForm, setProductForm] = useState({
    fecha: new Date().toISOString().split('T')[0],
    producto: '',
    codigo_producto: null as string | null,
    cantidad: '',
    precio: '',
    proveedor: '',
    moneda: 'ARS' as 'ARS' | 'USD',
    valor_dolar: '',
  });

  const [loading, setLoading] = useState(true);
  const [expandedMaterialOrders, setExpandedMaterialOrders] = useState<Set<string>>(new Set());
  const [expandedProductOrders, setExpandedProductOrders] = useState<Set<string>>(new Set());
  
  // Controles de recepción para verificar problemas
  const [receptionControls, setReceptionControls] = useState<any[]>([]);
  const [receptionItems, setReceptionItems] = useState<Record<string, any[]>>({});
  
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

  // Productos para dropdown (desde la tabla products, igual que en costos)
  type Product = Database['public']['Tables']['products']['Row'];
  const [availableProducts, setAvailableProducts] = useState<Array<{ id: string; nombre: string; codigo_producto: string | null }>>([]);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const productInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (tenantId) {
      loadPurchases();
      loadSuppliers();
      loadStockMaterials();
      loadAvailableProducts();
    }
  }, [tenantId]);

  // Memoizar el agrupamiento y cálculos de compras de materiales
  const groupedMaterialPurchases = useMemo(() => {
    if (materialPurchases.length === 0) return { orders: [], individual: [] };

    const grouped = materialPurchases.reduce((acc: any, purchase: any) => {
      if (purchase.order_id) {
        if (!acc[purchase.order_id]) {
          acc[purchase.order_id] = {
            order_id: purchase.order_id,
            fecha: purchase.fecha,
            proveedor: purchase.proveedor,
            items: [],
            total_compra: 0,
            subtotal_sin_iva: 0,
            total_iva: 0,
            tiene_iva: false,
            iva_pct: 0,
          };
        }
        acc[purchase.order_id].items.push(purchase);
        
        // purchase.total siempre es el subtotal sin IVA
        const tieneIva = purchase.tiene_iva || false;
        const ivaPct = purchase.iva_pct || 0;
        const totalSinIva = purchase.total;
        const ivaMonto = tieneIva ? totalSinIva * (ivaPct / 100) : 0;
        const totalConIva = totalSinIva + ivaMonto;
        
        acc[purchase.order_id].total_compra += totalConIva;
        acc[purchase.order_id].subtotal_sin_iva += totalSinIva;
        acc[purchase.order_id].total_iva += ivaMonto;
        if (tieneIva) {
          acc[purchase.order_id].tiene_iva = true;
          // Si ya hay un iva_pct y es diferente, mantener el mayor o el primero encontrado
          // Si no hay iva_pct aún, establecerlo
          if (acc[purchase.order_id].iva_pct === 0 || acc[purchase.order_id].iva_pct === ivaPct) {
            acc[purchase.order_id].iva_pct = ivaPct;
          } else {
            // Si hay diferentes porcentajes, usar el mayor
            acc[purchase.order_id].iva_pct = Math.max(acc[purchase.order_id].iva_pct, ivaPct);
          }
        }
      } else {
        if (!acc.individual) acc.individual = [];
        acc.individual.push(purchase);
      }
      return acc;
    }, {});

    const orders = Object.values(grouped).filter((g: any) => g.order_id);
    orders.forEach((order: any) => {
      if (order.items && order.items.length > 0) {
        order.estado = order.items[0].estado || 'pendiente';
        order.pagado = order.items[0].pagado || false;
      } else {
        order.estado = 'pendiente';
        order.pagado = false;
      }
    });
    orders.sort((a: any, b: any) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
    const individual = grouped.individual || [];

    return { orders, individual };
  }, [materialPurchases]);

  // Memoizar el agrupamiento y cálculos de compras de productos
  const groupedProductPurchases = useMemo(() => {
    if (productPurchases.length === 0) return { orders: [], individual: [] };

    const grouped = productPurchases.reduce((acc: any, purchase: any) => {
      if (purchase.order_id) {
        if (!acc[purchase.order_id]) {
          acc[purchase.order_id] = {
            order_id: purchase.order_id,
            fecha: purchase.fecha,
            proveedor: purchase.proveedor,
            items: [],
            total_compra: 0,
            subtotal_sin_iva: 0,
            total_iva: 0,
            tiene_iva: false,
            iva_pct: 0,
            estado: purchase.estado || 'pendiente',
          };
        }
        acc[purchase.order_id].items.push(purchase);
        
        // purchase.total ahora está en la moneda original (USD si es USD, ARS si es ARS)
        // Pero necesitamos verificar si el total guardado está en la moneda correcta
        let totalSinIva = purchase.total;
        
        // Si la moneda es USD, verificar si el total está en ARS (compras antiguas)
        if (purchase.moneda === 'USD' && purchase.valor_dolar) {
          const totalEsperado = purchase.precio * purchase.cantidad;
          const totalEsperadoARS = totalEsperado * purchase.valor_dolar;
          
          // Si el total guardado está más cerca del total esperado en ARS que del total esperado en USD
          // o si el total es mucho mayor que el esperado en USD (más de 10 veces)
          const distanciaAUSD = Math.abs(purchase.total - totalEsperado);
          const distanciaAARS = Math.abs(purchase.total - totalEsperadoARS);
          
          if (distanciaAARS < distanciaAUSD || purchase.total > totalEsperado * 100) {
            // Convertir de ARS a USD
            console.log('Corrigiendo total de ARS a USD:', {
              producto: purchase.producto,
              total_guardado: purchase.total,
              total_esperado_usd: totalEsperado,
              total_esperado_ars: totalEsperadoARS,
              total_corregido: purchase.total / purchase.valor_dolar
            });
            totalSinIva = purchase.total / purchase.valor_dolar;
          }
        }
        
        const tieneIva = purchase.tiene_iva || false;
        const ivaPct = purchase.iva_pct || 0;
        const ivaMonto = tieneIva ? totalSinIva * (ivaPct / 100) : 0;
        const totalConIva = totalSinIva + ivaMonto; // En la moneda original
        
        // Convertir a ARS para sumar correctamente
        const totalConIvaARS = purchase.moneda === 'USD' && purchase.valor_dolar
          ? totalConIva * purchase.valor_dolar
          : totalConIva;
        const totalSinIvaARS = purchase.moneda === 'USD' && purchase.valor_dolar
          ? totalSinIva * purchase.valor_dolar
          : totalSinIva;
        const ivaMontoARS = purchase.moneda === 'USD' && purchase.valor_dolar
          ? ivaMonto * purchase.valor_dolar
          : ivaMonto;
        
        acc[purchase.order_id].total_compra += totalConIvaARS; // Sumar en ARS
        acc[purchase.order_id].subtotal_sin_iva += totalSinIvaARS; // Sumar en ARS
        acc[purchase.order_id].total_iva += ivaMontoARS; // Sumar en ARS
        
        // Guardar información de moneda para mostrar correctamente
        if (!acc[purchase.order_id].moneda) {
          acc[purchase.order_id].moneda = purchase.moneda;
          acc[purchase.order_id].valor_dolar = purchase.valor_dolar;
        }
        if (tieneIva) {
          acc[purchase.order_id].tiene_iva = true;
          // Si ya hay un iva_pct y es diferente, mantener el mayor o el primero encontrado
          // Si no hay iva_pct aún, establecerlo
          if (acc[purchase.order_id].iva_pct === 0 || acc[purchase.order_id].iva_pct === ivaPct) {
            acc[purchase.order_id].iva_pct = ivaPct;
          } else {
            // Si hay diferentes porcentajes, usar el mayor
            acc[purchase.order_id].iva_pct = Math.max(acc[purchase.order_id].iva_pct, ivaPct);
          }
        }
      } else {
        if (!acc.individual) acc.individual = [];
        acc.individual.push(purchase);
      }
      return acc;
    }, {});

    const orders = Object.values(grouped).filter((g: any) => g.order_id);
    orders.forEach((order: any) => {
      if (order.items && order.items.length > 0) {
        order.estado = order.items[0].estado || 'pendiente';
        order.pagado = order.items[0].pagado || false;
      } else {
        order.estado = 'pendiente';
        order.pagado = false;
      }
    });
    orders.sort((a: any, b: any) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
    const individual = grouped.individual || [];

    return { orders, individual };
  }, [productPurchases]);

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

  const loadAvailableProducts = async () => {
    if (!tenantId) return;
    try {
      // Cargar productos desde la tabla products (igual que en el módulo de costos)
      const { data, error } = await supabase
        .from('products')
        .select('id, nombre, codigo_producto')
        .eq('tenant_id', tenantId)
        .order('nombre', { ascending: true });

      if (error) throw error;

      // Mapear productos al formato esperado
      const products: Array<{ id: string; nombre: string; codigo_producto: string | null }> = 
        (data || []).map((prod: Product) => ({
          id: prod.id,
          nombre: prod.nombre,
          codigo_producto: prod.codigo_producto || null,
        }));

      setAvailableProducts(products);
    } catch (error) {
      console.error('Error loading available products:', error);
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
      (m.nombre && m.nombre.toLowerCase().includes(term)) ||
      (m.material && m.material.toLowerCase().includes(term))
    );
  };

  const getFilteredProducts = (searchTerm: string) => {
    if (!searchTerm) return availableProducts;
    const term = searchTerm.toLowerCase();
    return availableProducts.filter(p => 
      p.nombre.toLowerCase().includes(term) ||
      (p.codigo_producto && p.codigo_producto.toLowerCase().includes(term))
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

      // Cargar controles de recepción para verificar problemas
      await loadReceptionControls();
    } catch (error) {
      console.error('Error loading purchases:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadReceptionControls = async () => {
    if (!tenantId) return;
    try {
      const { data: controls, error } = await supabase
        .from('purchase_reception_control')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('fecha_recepcion', { ascending: false });

      if (error) throw error;
      setReceptionControls(controls || []);

      // Cargar items de recepción
      const itemsMap: Record<string, any[]> = {};
      for (const control of controls || []) {
        const { data: items } = await supabase
          .from('purchase_reception_items')
          .select('*')
          .eq('reception_control_id', control.id);
        if (items) {
          itemsMap[control.id] = items;
        }
      }
      setReceptionItems(itemsMap);
    } catch (error) {
      console.error('Error loading reception controls:', error);
    }
  };

  // Función para verificar si una orden tiene problemas en el control de recepción
  const hasReceptionProblems = (orderId: string): boolean => {
    const control = receptionControls.find(c => c.order_id === orderId);
    if (!control || control.estado !== 'completado') return false;
    
    const items = receptionItems[control.id] || [];
    return items.some((item: any) => {
      const cantidadRecibida = item.cantidad_recibida || item.cantidad_esperada;
      return cantidadRecibida < item.cantidad_esperada;
    });
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

    // Calcular total con IVA si aplica
    const ivaPct = 21.00; // IVA por defecto 21%
    const tieneIva = false; // Por defecto sin IVA, el usuario puede cambiarlo
    const totalSinIva = total;
    const totalConIva = tieneIva ? totalSinIva * (1 + ivaPct / 100) : totalSinIva;

    const newItem: MaterialItem = {
      id: Date.now().toString(),
      material: materialForm.material,
      cantidad,
      precio,
      moneda: materialForm.moneda,
      valor_dolar: valorDolar,
      precioARS,
      tiene_iva: tieneIva,
      iva_pct: ivaPct,
      total: totalSinIva,
      total_con_iva: totalConIva,
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

  const handleToggleMaterialIva = (id: string) => {
    setMaterialItems(materialItems.map(item => {
      if (item.id === id) {
        const tieneIva = !item.tiene_iva;
        const totalConIva = tieneIva ? item.total * (1 + item.iva_pct / 100) : item.total;
        return {
          ...item,
          tiene_iva: tieneIva,
          total_con_iva: totalConIva,
        };
      }
      return item;
    }));
  };

  const handleUpdateMaterialIvaPct = (id: string, ivaPct: number) => {
    setMaterialItems(materialItems.map(item => {
      if (item.id === id) {
        const totalConIva = item.tiene_iva ? item.total * (1 + ivaPct / 100) : item.total;
        return {
          ...item,
          iva_pct: ivaPct,
          total_con_iva: totalConIva,
        };
      }
      return item;
    }));
  };

  const handlePrintMaterialOrder = async (order: any) => {
    const orderData: OrderData = {
      tipo: 'compra',
      fecha: order.fecha,
      proveedor: order.proveedor,
      order_id: order.order_id,
      items: order.items.map((item: any) => ({
        material: item.material,
        cantidad: item.cantidad,
        precio: item.precio,
        total: item.total,
        moneda: item.moneda,
        valor_dolar: item.valor_dolar,
      })),
      total_compra: order.total_compra,
      logoUrl: tenant?.logo_url || undefined,
      companyName: tenant?.name || undefined,
    };
    await generateOrderPDF(orderData);
  };

  const handlePrintProductOrder = async (order: any) => {
    const orderData: OrderData = {
      tipo: 'compra',
      fecha: order.fecha,
      proveedor: order.proveedor,
      order_id: order.order_id,
      items: order.items.map((item: any) => {
        const precioUnitarioMostrar = item.moneda === 'USD' && item.valor_dolar 
          ? item.precio / item.valor_dolar 
          : item.precio;
        return {
          producto: item.producto,
          cantidad: item.cantidad,
          precio: precioUnitarioMostrar,
          total: item.total,
          moneda: item.moneda,
          valor_dolar: item.valor_dolar,
        };
      }),
      total_compra: order.total_compra,
      logoUrl: tenant?.logo_url || undefined,
      companyName: tenant?.name || undefined,
    };
    await generateOrderPDF(orderData);
  };

  const handleEditMaterialOrder = (order: any) => {
    if (!order || !order.items || order.items.length === 0) return;
    
    const firstItem = order.items[0];
    const fechaLocal = new Date(firstItem.fecha);
    const fechaStr = fechaLocal.toISOString().split('T')[0];
    
    setMaterialForm({
      fecha: fechaStr,
      material: '',
      cantidad: '',
      precio: '',
      proveedor: firstItem.proveedor || '',
      moneda: firstItem.moneda || 'ARS',
      valor_dolar: firstItem.valor_dolar?.toString() || '',
    });
    
    const items: MaterialItem[] = order.items.map((item: any) => {
      const precioUnitario = item.moneda === 'USD' && item.valor_dolar 
        ? item.precio / item.valor_dolar 
        : item.precio;
      
      return {
        id: item.id,
        material: item.material,
        cantidad: item.cantidad,
        precio: precioUnitario,
        moneda: item.moneda || 'ARS',
        valor_dolar: item.valor_dolar || 1,
        precioARS: item.precio,
        tiene_iva: (item as any).tiene_iva || false,
        iva_pct: (item as any).iva_pct || 21,
        total: item.total,
        total_con_iva: (item as any).total_con_iva,
      };
    });
    
    setMaterialItems(items);
    setEditingMaterialOrder(order);
    setShowMaterialForm(true);
    setActiveTab('materials');
  };

  const handleEditProductOrder = (order: any) => {
    if (!order || !order.items || order.items.length === 0) return;
    
    const firstItem = order.items[0];
    const fechaLocal = new Date(firstItem.fecha);
    const fechaStr = fechaLocal.toISOString().split('T')[0];
    
    setProductForm({
      fecha: fechaStr,
      producto: '',
      codigo_producto: null,
      cantidad: '',
      precio: '',
      proveedor: firstItem.proveedor || '',
      moneda: firstItem.moneda || 'ARS',
      valor_dolar: firstItem.valor_dolar?.toString() || '',
    });
    
    const items: ProductItem[] = order.items.map((item: any) => {
      const precioUnitario = item.moneda === 'USD' && item.valor_dolar 
        ? item.precio / item.valor_dolar 
        : item.precio;
      
      return {
        id: item.id,
        producto: item.producto,
        codigo_producto: item.codigo_producto || null,
        cantidad: item.cantidad,
        precio: precioUnitario,
        moneda: item.moneda || 'ARS',
        valor_dolar: item.valor_dolar || 1,
        precioARS: item.precio,
        tiene_iva: (item as any).tiene_iva || false,
        iva_pct: (item as any).iva_pct || 21,
        total: item.total,
        total_con_iva: (item as any).total_con_iva,
      };
    });
    
    setProductItems(items);
    setEditingProductOrder(order);
    setShowProductForm(true);
    setActiveTab('products');
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
      
      // Si estamos editando, eliminar la orden antigua
      if (editingMaterialOrder) {
        await supabase
          .from('purchases_materials')
          .delete()
          .eq('order_id', editingMaterialOrder.order_id);
      }
      
      // Usar el order_id existente si estamos editando, o crear uno nuevo
      const orderId = editingMaterialOrder?.order_id || crypto.randomUUID();

      // Crear registros de compra para cada material con el mismo order_id
      for (const item of materialItems) {
        const data: PurchaseMaterialInsert & { order_id?: string; estado?: string; tiene_iva?: boolean; iva_pct?: number } = {
          tenant_id: tenantId,
          fecha,
          material: item.material,
          cantidad: item.cantidad,
          precio: item.precioARS,
          proveedor,
          moneda: item.moneda,
          valor_dolar: item.moneda === 'USD' ? item.valor_dolar : null,
          total: item.total, // Siempre guardar el subtotal sin IVA
          order_id: orderId,
          estado: 'pendiente', // Estado inicial
          tiene_iva: item.tiene_iva,
          iva_pct: item.iva_pct,
        } as any;

        const { error: insertError } = await supabase.from('purchases_materials').insert(data);
        
        if (insertError) {
          console.error('Error inserting purchase:', insertError);
          throw insertError;
        }
        
        // NO actualizar stock automáticamente - se actualizará cuando se complete el control de recepción
      }

      resetMaterialForm();
      setEditingMaterialOrder(null);
      loadPurchases();
      alert(editingMaterialOrder ? 'Orden actualizada exitosamente' : 'Compra registrada exitosamente');
    } catch (error: any) {
      console.error('Error saving purchase:', error);
      const errorMessage = error?.message || 'Error al guardar la compra';
      if (errorMessage.includes('column') || errorMessage.includes('does not exist') || errorMessage.includes('tiene_iva') || errorMessage.includes('iva_pct') || errorMessage.includes('estado')) {
        alert('Error: Las migraciones de base de datos no se han ejecutado. Por favor, ejecuta las migraciones en Supabase:\n\n1. 20250120000050_add_purchase_status_and_reception_control.sql\n2. 20250120000051_add_iva_to_purchases.sql\n\nError: ' + errorMessage);
      } else {
        alert(`Error al guardar la compra: ${errorMessage}`);
      }
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
    // Calcular el total en la moneda original (USD si es USD, ARS si es ARS)
    const total = cantidad * precio; // Total en la moneda original
    const totalARS = cantidad * precioARS; // Total en ARS (para referencia)

    // Verificar si ya existe el producto en la lista
    const existingItem = productItems.find(item => item.producto === productForm.producto);
    if (existingItem) {
      alert('Este producto ya está en la lista. Elimínelo primero si desea cambiarlo.');
      return;
    }

    // Si no hay código de producto pero el nombre coincide con un producto disponible, buscar el código
    let codigoProducto = productForm.codigo_producto;
    if (!codigoProducto) {
      const matchedProduct = availableProducts.find(
        p => p.nombre.toLowerCase().trim() === productForm.producto.toLowerCase().trim()
      );
      if (matchedProduct) {
        codigoProducto = matchedProduct.codigo_producto;
      }
    }

    // Calcular total con IVA si aplica
    const ivaPct = 21.00; // IVA por defecto 21%
    const tieneIva = false; // Por defecto sin IVA, el usuario puede cambiarlo
    const totalSinIva = total;
    const totalConIva = tieneIva ? totalSinIva * (1 + ivaPct / 100) : totalSinIva;

    const newItem: ProductItem = {
      id: Date.now().toString(),
      producto: productForm.producto,
      codigo_producto: codigoProducto,
      cantidad,
      precio,
      moneda: productForm.moneda,
      valor_dolar: valorDolar,
      precioARS,
      tiene_iva: tieneIva,
      iva_pct: ivaPct,
      total: totalSinIva,
      total_con_iva: totalConIva,
    };

    setProductItems([...productItems, newItem]);

    // Limpiar campos del producto (mantener fecha y proveedor)
    setProductForm({
      ...productForm,
      producto: '',
      codigo_producto: null,
      cantidad: '',
      precio: '',
      moneda: 'ARS',
      valor_dolar: '',
    });
  };

  const handleRemoveProduct = (id: string) => {
    setProductItems(productItems.filter(item => item.id !== id));
  };

  const handleToggleProductIva = (id: string) => {
    setProductItems(productItems.map(item => {
      if (item.id === id) {
        const tieneIva = !item.tiene_iva;
        const totalConIva = tieneIva ? item.total * (1 + item.iva_pct / 100) : item.total;
        return {
          ...item,
          tiene_iva: tieneIva,
          total_con_iva: totalConIva,
        };
      }
      return item;
    }));
  };

  const handleUpdateProductIvaPct = (id: string, ivaPct: number) => {
    setProductItems(productItems.map(item => {
      if (item.id === id) {
        const totalConIva = item.tiene_iva ? item.total * (1 + ivaPct / 100) : item.total;
        return {
          ...item,
          iva_pct: ivaPct,
          total_con_iva: totalConIva,
        };
      }
      return item;
    }));
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
      
      // Si estamos editando, eliminar la orden antigua
      if (editingProductOrder) {
        await supabase
          .from('purchases_products')
          .delete()
          .eq('order_id', editingProductOrder.order_id);
      }
      
      // Usar el order_id existente si estamos editando, o crear uno nuevo
      const orderId = editingProductOrder?.order_id || crypto.randomUUID();

      // Crear registros de compra para cada producto con el mismo order_id
      for (const item of productItems) {
        // Si la moneda es USD, guardar el precio original en USD, no el convertido a ARS
        // El precio en ARS se calculará cuando sea necesario usando precio * valor_dolar
        const precioAGuardar = item.moneda === 'USD' ? item.precio : item.precioARS;
        
        const data: PurchaseProductInsert & { order_id?: string; estado?: string; tiene_iva?: boolean; iva_pct?: number; codigo_producto?: string | null } = {
          tenant_id: tenantId,
          fecha,
          producto: item.producto,
          codigo_producto: item.codigo_producto || null,
          cantidad: item.cantidad,
          precio: precioAGuardar,
          proveedor,
          moneda: item.moneda,
          valor_dolar: item.moneda === 'USD' ? item.valor_dolar : null,
          total: item.total, // Siempre guardar el subtotal sin IVA
          order_id: orderId,
          estado: 'pendiente', // Estado inicial
          tiene_iva: item.tiene_iva,
          iva_pct: item.iva_pct,
        } as any;

        console.log('Insertando compra de producto:', {
          producto: item.producto,
          codigo_producto: item.codigo_producto,
          data: data
        });

        const { error: insertError } = await supabase.from('purchases_products').insert(data);
        
        if (insertError) {
          // Si el error es porque la columna codigo_producto no existe, intentar sin ese campo
          if (insertError.message?.includes('codigo_producto') || insertError.message?.includes('column') && insertError.message?.includes('codigo_producto')) {
            console.warn('Columna codigo_producto no existe, intentando insertar sin ese campo');
            const dataWithoutCodigo = { ...data };
            delete (dataWithoutCodigo as any).codigo_producto;
            const { error: retryError } = await supabase.from('purchases_products').insert(dataWithoutCodigo);
            if (retryError) {
              console.error('Error inserting purchase (retry):', retryError);
              throw retryError;
            }
          } else {
            console.error('Error inserting purchase:', insertError);
            throw insertError;
          }
        }
        
        // NO actualizar stock automáticamente - se actualizará cuando se complete el control de recepción
      }

      resetProductForm();
      setEditingProductOrder(null);
      loadPurchases();
      alert(editingProductOrder ? 'Orden actualizada exitosamente' : 'Compra registrada exitosamente');
    } catch (error: any) {
      console.error('Error saving purchase:', error);
      const errorMessage = error?.message || 'Error al guardar la compra';
      if (errorMessage.includes('column') || errorMessage.includes('does not exist') || errorMessage.includes('codigo_producto') || errorMessage.includes('tiene_iva') || errorMessage.includes('iva_pct') || errorMessage.includes('estado')) {
        alert('Error: Las migraciones de base de datos no se han ejecutado. Por favor, ejecuta las migraciones en Supabase:\n\n1. 20250120000050_add_purchase_status_and_reception_control.sql\n2. 20250120000051_add_iva_to_purchases.sql\n3. 20250127000003_add_codigo_producto_to_purchases_products.sql\n\nError: ' + errorMessage);
      } else {
        alert(`Error al guardar la compra: ${errorMessage}`);
      }
    }
  };

  // Funciones para actualizar estado de recepción
  const updateReceptionStatus = async (
    type: 'material' | 'product',
    orderId: string,
    status: 'pendiente' | 'recibido'
  ) => {
    if (!tenantId) return;

    try {
      const table = type === 'material' ? 'purchases_materials' : 'purchases_products';
      console.log(`Actualizando estado de recepción: ${table}, orderId: ${orderId}, status: ${status}`);
      
      // Actualizar estado localmente primero para feedback inmediato
      if (type === 'material') {
        setMaterialPurchases(prev => prev.map(p => 
          p.order_id === orderId ? { ...p, estado: status } : p
        ));
      } else {
        setProductPurchases(prev => prev.map(p => 
          p.order_id === orderId ? { ...p, estado: status } : p
        ));
      }
      
      const { data, error } = await supabase
        .from(table)
        .update({ estado: status })
        .eq('order_id', orderId)
        .eq('tenant_id', tenantId)
        .select();
      
      if (error) {
        console.error('Error updating purchase status:', error);
        // Revertir cambio local si falla
        loadPurchases();
        throw error;
      }
      
      console.log('Registros actualizados:', data?.length || 0);
      
      // Crear el control de recepción solo si el estado es 'recibido'
      if (status === 'recibido') {
        console.log('Creando control de recepción...', { orderId, tenantId, type });
        
        if (!orderId) {
          console.error('Error: order_id es null o undefined');
          alert('Error: La compra no tiene order_id. No se puede crear el control de recepción.');
          return;
        }
        
        // Verificar si ya existe un control
        const { data: existingControl } = await supabase
          .from('purchase_reception_control')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('order_id', orderId)
          .eq('purchase_type', type === 'material' ? 'material' : 'product')
          .maybeSingle();
        
        if (existingControl) {
          console.log('✅ Control de recepción ya existe:', existingControl.id);
          return;
        }
        
        // Crear el control directamente
        const purchaseType = type === 'material' ? 'material' : 'product';
        
        // 1. Crear el control
        const { data: newControl, error: controlError } = await supabase
          .from('purchase_reception_control')
          .insert({
            tenant_id: tenantId,
            order_id: orderId,
            purchase_type: purchaseType,
            estado: 'pendiente'
          })
          .select()
          .single();
        
        if (controlError) {
          console.error('Error creando control:', controlError);
          // Intentar con RPC como respaldo
          const { data: rpcControlId, error: rpcError } = await supabase.rpc('create_reception_control_manual', {
            p_order_id: orderId,
            p_tenant_id: tenantId,
            p_purchase_type: purchaseType
          });
          
          if (rpcError) {
            console.error('Error con RPC también:', rpcError);
            // No mostrar alert, solo loguear el error
          } else {
            console.log('✅ Control creado con RPC:', rpcControlId);
          }
        } else {
          console.log('✅ Control creado:', newControl.id);
          
          // 2. Crear los items del control
          const itemNameField = type === 'material' ? 'material' : 'producto';
          const unidad = type === 'material' ? 'kg' : 'unidades';
          
          const { data: purchaseItems, error: itemsError } = await supabase
            .from(table)
            .select(`${itemNameField}, cantidad`)
            .eq('tenant_id', tenantId)
            .eq('order_id', orderId);
          
          if (itemsError) {
            console.error('Error obteniendo items de la compra:', itemsError);
            // No mostrar alert, solo loguear
          } else {
            // Insertar items del control
            const receptionItems = (purchaseItems || []).map((item: any) => ({
              tenant_id: tenantId,
              reception_control_id: newControl.id,
              item_nombre: item[itemNameField],
              cantidad_esperada: item.cantidad,
              cantidad_recibida: item.cantidad, // Inicializar con la cantidad esperada
              unidad: unidad
            }));
            
            if (receptionItems.length > 0) {
              const { error: insertItemsError } = await supabase
                .from('purchase_reception_items')
                .insert(receptionItems);
              
              if (insertItemsError) {
                console.error('Error insertando items del control:', insertItemsError);
              } else {
                console.log('✅ Items del control creados:', receptionItems.length);
              }
            }
          }
        }
      }
      
      // Recargar para sincronizar con la base de datos
      loadPurchases();
    } catch (error) {
      console.error('Error updating reception status:', error);
      alert('Error al actualizar el estado de recepción');
      // Recargar para restaurar el estado correcto
      loadPurchases();
    }
  };

  // Funciones para actualizar estado de pago
  const updatePaymentStatus = async (
    type: 'material' | 'product',
    orderId: string,
    pagado: boolean
  ) => {
    if (!tenantId) return;

    try {
      const table = type === 'material' ? 'purchases_materials' : 'purchases_products';
      console.log(`Actualizando estado de pago: ${table}, orderId: ${orderId}, pagado: ${pagado}`);
      
      const { data, error } = await supabase
        .from(table)
        .update({ pagado: pagado })
        .eq('order_id', orderId)
        .eq('tenant_id', tenantId)
        .select();
      
      if (error) {
        console.error('Error updating payment status:', error);
        throw error;
      }
      
      console.log('Registros actualizados:', data?.length || 0);
      loadPurchases();
    } catch (error) {
      console.error('Error updating payment status:', error);
      alert('Error al actualizar el estado de pago');
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
        // Buscar el código del producto desde la tabla products
        let codigoProducto: string | null = null;
        const { data: productData } = await supabase
          .from('products')
          .select('codigo_producto')
          .eq('tenant_id', tenantId)
          .ilike('nombre', itemName)
          .limit(1)
          .maybeSingle();
        
        if (productData && productData.codigo_producto) {
          codigoProducto = productData.codigo_producto;
        }

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
          const updateData: any = {
            cantidad: existing[0].cantidad + quantity,
            costo_unitario: costoUnitario,
            costo_unitario_final: costoFinal,
            moneda: currency,
            valor_dolar: currency === 'USD' ? dollarValue : null,
          };
          
          // Actualizar código si se encontró y el existente no tiene código
          if (codigoProducto && !existing[0].codigo_producto) {
            updateData.codigo_producto = codigoProducto;
          }
          
          await supabase
            .from('resale_products')
            .update(updateData)
            .eq('id', existing[0].id);
        } else {
          // Crear nuevo registro
          await supabase.from('resale_products').insert({
            tenant_id: tenantId,
            codigo_producto: codigoProducto,
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
    setEditingMaterialOrder(null);
    setShowMaterialForm(false);
  };

  const resetProductForm = () => {
    setProductForm({
      fecha: new Date().toISOString().split('T')[0],
      producto: '',
      codigo_producto: null,
      cantidad: '',
      precio: '',
      proveedor: '',
      moneda: 'ARS',
      valor_dolar: '',
    });
    setProductItems([]);
    setEditingProduct(null);
    setEditingProductOrder(null);
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
                    {editingMaterialOrder ? 'Editar Orden de Compra' : editingMaterial ? 'Editar Compra' : 'Nueva Compra de Materia Prima'}
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
                                setMaterialForm({ ...materialForm, material: material.nombre || material.material });
                                setShowMaterialDropdown(false);
                              }}
                              className="w-full text-left px-4 py-2 hover:bg-blue-50 dark:hover:bg-slate-600 focus:bg-blue-50 dark:focus:bg-slate-600 focus:outline-none text-gray-900 dark:text-white"
                            >
                              <div className="font-medium">{material.nombre || material.material}</div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">Stock: {formatNumber(material.kg)} kg</div>
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
                          <div key={item.id} className="bg-white dark:bg-slate-600 p-3 rounded-md">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="font-medium text-gray-900 dark:text-white">{item.material}</div>
                                <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                  Cantidad: {formatNumber(item.cantidad)} kg | Precio: ${formatNumber(item.precio)} ({item.moneda})
                                  {item.moneda === 'USD' && item.valor_dolar && (
                                    <span className="ml-2">| Dólar: ${formatNumber(item.valor_dolar)}</span>
                                  )}
                                </div>
                                <div className="text-sm font-semibold text-gray-900 dark:text-white mt-1">
                                  {item.tiene_iva ? (
                                    <>
                                      Subtotal: ${formatNumber(item.total)} | IVA ({item.iva_pct}%): ${formatNumber((item.total_con_iva || item.total) - item.total)} | Total: ${formatNumber(item.total_con_iva || item.total)}
                                    </>
                                  ) : (
                                    <>Total: ${formatNumber(item.total)}</>
                                  )}
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
                            <div className="mt-2 flex items-center space-x-3 pt-2 border-t border-gray-200 dark:border-gray-500">
                              <label className="flex items-center space-x-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={item.tiene_iva}
                                  onChange={() => handleToggleMaterialIva(item.id)}
                                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:bg-slate-700 dark:border-gray-600"
                                />
                                <span className="text-sm text-gray-700 dark:text-gray-300">Tiene IVA</span>
                              </label>
                              {item.tiene_iva && (
                                <div className="flex items-center space-x-2">
                                  <label className="text-sm text-gray-700 dark:text-gray-300">IVA:</label>
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.01"
                                    value={item.iva_pct}
                                    onChange={(e) => handleUpdateMaterialIvaPct(item.id, parseFloat(e.target.value) || 21)}
                                    className="w-20 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                                  />
                                  <span className="text-sm text-gray-700 dark:text-gray-300">%</span>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 pt-3 border-t border-gray-300 dark:border-gray-600">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">Total Compra:</span>
                          <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                            ${formatNumber(materialItems.reduce((sum, item) => sum + (item.tiene_iva ? (item.total_con_iva || item.total) : item.total), 0))}
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
                        className="px-2 sm:px-3 md:px-4 lg:px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-semibold shadow-lg"
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
            <div className="overflow-x-auto">
              <table className="w-full divide-y divide-gray-200 dark:divide-gray-700 table-auto">
              <thead className="bg-gray-50 dark:bg-slate-700">
                <tr>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase whitespace-nowrap w-24">Fecha</th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase w-32">Material</th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase whitespace-nowrap w-20">Cantidad</th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase whitespace-nowrap w-24">Precio</th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase w-28">Proveedor</th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase whitespace-nowrap w-16">IVA</th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase whitespace-nowrap w-24">Total IVA</th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase whitespace-nowrap w-24">Costo</th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase whitespace-nowrap w-24">Total</th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase whitespace-nowrap w-28">Estado</th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase whitespace-nowrap w-32">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-gray-700">
                {materialPurchases.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-2 sm:px-3 md:px-4 lg:px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                      No hay compras registradas
                    </td>
                  </tr>
                ) : (
                  <>
                        {/* Mostrar órdenes agrupadas */}
                        {groupedMaterialPurchases.orders.map((order: any) => {
                          const isExpanded = expandedMaterialOrders.has(order.order_id);
                          const hasProblems = hasReceptionProblems(order.order_id);
                          return (
                            <React.Fragment key={order.order_id}>
                              {/* Fila resumen de la orden */}
                              <tr className={`${hasProblems ? 'bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 border-l-4 border-red-500' : 'bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30'}`}>
                                <td className="px-2 py-3 text-sm font-medium text-gray-900 dark:text-white">
                                  {new Date(order.fecha).toLocaleDateString('es-AR')}
                                </td>
                                <td className="px-2 py-3 text-sm font-medium text-gray-900 dark:text-white" colSpan={2}>
                                  <div className="flex items-center space-x-2">
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
                                      <span className="text-xs">Orden con {order.items.length} material{order.items.length > 1 ? 'es' : ''}</span>
                                      <ChevronDown className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                    </button>
                                    {hasProblems && (
                                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300">
                                        ⚠ Problema en Control
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-2 py-3 text-sm font-medium text-gray-900 dark:text-white"></td>
                                <td className="px-2 py-3 text-sm font-medium text-gray-900 dark:text-white text-xs">{order.proveedor}</td>
                                <td className="px-2 py-3 text-sm text-gray-900 dark:text-white text-xs">
                                  {order.tiene_iva ? `${order.iva_pct}%` : 'Sin IVA'}
                                </td>
                                <td className="px-2 py-3 text-sm font-semibold text-gray-900 dark:text-white text-xs">
                                  ${formatNumber(order.total_iva)}
                                </td>
                                <td className="px-2 py-3 text-sm font-semibold text-green-600 dark:text-green-400 text-xs">
                                  ${formatNumber(order.subtotal_sin_iva)}
                                </td>
                                <td className="px-2 py-3 text-sm font-semibold text-blue-600 dark:text-blue-400 text-xs">
                                  {order.moneda === 'USD' && order.valor_dolar ? (
                                    <>
                                      ${formatNumber(order.total_compra_usd || order.total_compra / order.valor_dolar)} {order.moneda}
                                      <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                        (${formatNumber(order.total_compra)} ARS)
                                      </span>
                                    </>
                                  ) : (
                                    <>${formatNumber(order.total_compra)} ARS</>
                                  )}
                                </td>
                                <td className="px-2 py-3 text-sm">
                                  <div className="flex flex-col gap-1">
                                    {/* Estado de Recepción */}
                                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                                      order.estado === 'recibido'
                                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                                        : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                                    }`}>
                                      {order.estado === 'recibido' ? 'Recibido' : 'Pendiente'}
                                    </span>
                                    {/* Estado de Pago */}
                                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                                      order.pagado
                                        ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                                        : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                                    }`}>
                                      {order.pagado ? 'Pagado' : 'Impago'}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-2 py-3 text-sm whitespace-nowrap">
                                  <div className="flex items-center gap-1">
                                    {canEdit('fabinsa-purchases') && (
                                      <button
                                        onClick={() => updateReceptionStatus('material', order.order_id, order.estado === 'recibido' ? 'pendiente' : 'recibido')}
                                        className={`p-1 rounded text-white transition-colors flex-shrink-0 ${
                                          order.estado === 'recibido'
                                            ? 'bg-orange-600 dark:bg-orange-500 hover:bg-orange-700 dark:hover:bg-orange-600'
                                            : 'bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600'
                                        }`}
                                        title={order.estado === 'recibido' ? 'Marcar como Pendiente' : 'Marcar como Recibido'}
                                      >
                                        <CheckCircle className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                    {canEdit('fabinsa-purchases') && (
                                      <button
                                        onClick={() => updatePaymentStatus('material', order.order_id, !order.pagado)}
                                        className={`p-1 rounded text-white transition-colors flex-shrink-0 ${
                                          order.pagado
                                            ? 'bg-red-600 dark:bg-red-500 hover:bg-red-700 dark:hover:bg-red-600'
                                            : 'bg-green-600 dark:bg-green-500 hover:bg-green-700 dark:hover:bg-green-600'
                                        }`}
                                        title={order.pagado ? 'Marcar como Impago' : 'Marcar como Pagado'}
                                      >
                                        <DollarSign className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                    {canPrint('fabinsa-purchases') && (
                                      <button
                                        onClick={() => handlePrintMaterialOrder(order)}
                                        className="p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors flex-shrink-0"
                                        title="Imprimir/Generar PDF"
                                      >
                                        <FileText className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                    {canDelete('fabinsa-purchases') && (
                                      <button
                                        onClick={async () => {
                                          if (confirm(`¿Eliminar toda la orden con ${order.items.length} material${order.items.length > 1 ? 'es' : ''}?`)) {
                                            await supabase.from('purchases_materials').delete().eq('order_id', order.order_id);
                                            loadPurchases();
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
                              {/* Filas de materiales (si está expandida) */}
                              {isExpanded && order.items.map((item: any) => {
                                // El precio guardado es el precio unitario en ARS
                                // Si la moneda original era USD, necesitamos convertir de vuelta a USD
                                const precioUnitarioMostrar = item.moneda === 'USD' && item.valor_dolar 
                                  ? item.precio / item.valor_dolar 
                                  : item.precio;
                                
                                // Calcular IVA para este item
                                const tieneIva = item.tiene_iva || false;
                                const ivaPct = item.iva_pct || 0;
                                const totalSinIva = item.total;
                                const totalConIva = tieneIva ? totalSinIva * (1 + ivaPct / 100) : totalSinIva;
                                const ivaMonto = tieneIva ? totalSinIva * (ivaPct / 100) : 0;
                                
                                return (
                                  <tr key={item.id} className="bg-gray-50 dark:bg-slate-700 hover:bg-gray-100 dark:hover:bg-slate-600">
                                    <td className="px-2 py-2 text-sm text-gray-600 dark:text-gray-400"></td>
                                    <td className="px-2 py-2 text-sm text-gray-900 dark:text-white pl-6 text-xs">
                                      • {item.material}
                                    </td>
                                    <td className="px-2 py-2 text-sm text-gray-900 dark:text-white text-xs">{formatNumber(item.cantidad)} kg</td>
                                    <td className="px-2 py-2 text-sm text-gray-900 dark:text-white text-xs">
                                      ${formatNumber(precioUnitarioMostrar)} ({item.moneda})
                                      {item.moneda === 'USD' && item.valor_dolar && (
                                        <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                          Dólar: ${formatNumber(item.valor_dolar)}
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-2 py-2 text-sm text-gray-600 dark:text-gray-400"></td>
                                    <td className="px-2 py-2 text-sm text-gray-900 dark:text-white text-xs">
                                      {tieneIva ? `${ivaPct}%` : 'Sin IVA'}
                                    </td>
                                    <td className="px-2 py-2 text-sm text-gray-900 dark:text-white text-xs">
                                      ${formatNumber(ivaMonto)}
                                    </td>
                                    <td className="px-2 py-2 text-sm font-semibold text-green-600 dark:text-green-400 text-xs">
                                      ${formatNumber(totalSinIva)}
                                    </td>
                                    <td className="px-2 py-2 text-sm font-semibold text-blue-600 dark:text-blue-400 text-xs">
                                      ${formatNumber(totalConIva)}
                                    </td>
                                    <td className="px-2 py-2 text-sm"></td>
                                    <td className="px-2 py-2 text-sm"></td>
                                  </tr>
                                );
                              })}
                            </React.Fragment>
                          );
                        })}
                        {/* Mostrar compras individuales (sin order_id) */}
                        {groupedProductPurchases.individual.map((purchase: any) => {
                          // Calcular IVA para compras individuales
                          const tieneIva = purchase.tiene_iva || false;
                          const ivaPct = purchase.iva_pct || 0;
                          const totalSinIva = purchase.total;
                          const totalConIva = tieneIva ? totalSinIva * (1 + ivaPct / 100) : totalSinIva;
                          const ivaMonto = tieneIva ? totalSinIva * (ivaPct / 100) : 0;
                          
                          return (
                            <tr key={purchase.id} className="hover:bg-gray-50 dark:hover:bg-slate-700">
                              <td className="px-2 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white text-xs">
                                {new Date(purchase.fecha).toLocaleDateString('es-AR')}
                              </td>
                              <td className="px-2 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white text-xs">{purchase.material}</td>
                              <td className="px-2 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white text-xs">{formatNumber(purchase.cantidad)} kg</td>
                              <td className="px-2 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white text-xs">
                                ${formatNumber(purchase.precio)} ({purchase.moneda})
                                {purchase.moneda === 'USD' && purchase.valor_dolar && (
                                  <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                    Dólar: ${formatNumber(purchase.valor_dolar)}
                                  </span>
                                )}
                              </td>
                              <td className="px-2 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white text-xs">{purchase.proveedor}</td>
                              <td className="px-2 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white text-xs">
                                {tieneIva ? `${ivaPct}%` : 'Sin IVA'}
                              </td>
                              <td className="px-2 py-3 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-white text-xs">
                                ${formatNumber(ivaMonto)}
                              </td>
                              <td className="px-2 py-3 whitespace-nowrap text-sm font-semibold text-green-600 dark:text-green-400 text-xs">
                                ${formatNumber(totalSinIva)}
                              </td>
                              <td className="px-2 py-3 whitespace-nowrap text-sm font-semibold text-blue-600 dark:text-blue-400 text-xs">
                                ${formatNumber(totalConIva)}
                              </td>
                              <td className="px-2 py-3 whitespace-nowrap text-sm">
                                <div className="flex flex-col gap-1">
                                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                                    purchase.estado === 'recibido'
                                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                                      : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                                  }`}>
                                    {purchase.estado === 'recibido' ? 'Recibido' : 'Pendiente'}
                                  </span>
                                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                                    purchase.pagado
                                      ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                                      : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                                  }`}>
                                    {purchase.pagado ? 'Pagado' : 'Impago'}
                                  </span>
                                </div>
                              </td>
                              <td className="px-2 py-3 whitespace-nowrap text-right text-sm">
                                <div className="flex items-center justify-end gap-1">
                                  {canPrint('fabinsa-purchases') && (
                                  <button
                                    onClick={async () => {
                                      const orderData: OrderData = {
                                        tipo: 'compra',
                                        fecha: purchase.fecha,
                                        proveedor: purchase.proveedor,
                                        items: [{
                                          material: purchase.material,
                                          cantidad: purchase.cantidad,
                                          precio: purchase.precio,
                                          total: purchase.total,
                                          moneda: purchase.moneda,
                                          valor_dolar: purchase.valor_dolar,
                                        }],
                                        total_compra: purchase.total,
                                        logoUrl: tenant?.logo_url || undefined,
                                        companyName: tenant?.name || undefined,
                                      };
                                      await generateOrderPDF(orderData);
                                    }}
                                    className="p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors flex-shrink-0"
                                    title="Imprimir/Generar PDF"
                                  >
                                    <FileText className="w-3.5 h-3.5" />
                                  </button>
                                  )}
                                  {canDelete('fabinsa-purchases') && (
                                    <button
                                      onClick={async () => {
                                        if (confirm('¿Eliminar esta compra?')) {
                                          await supabase.from('purchases_materials').delete().eq('id', purchase.id);
                                          loadPurchases();
                                        }
                                      }}
                                      className="p-1 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors flex-shrink-0"
                                      title="Eliminar compra"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {/* Mostrar compras individuales (sin order_id) */}
                        {groupedMaterialPurchases.individual.map((purchase: any) => {
                          // Calcular IVA para compras individuales
                          const tieneIva = purchase.tiene_iva || false;
                          const ivaPct = purchase.iva_pct || 0;
                          const totalSinIva = purchase.total;
                          const totalConIva = tieneIva ? totalSinIva * (1 + ivaPct / 100) : totalSinIva;
                          const ivaMonto = tieneIva ? totalSinIva * (ivaPct / 100) : 0;
                          
                          return (
                            <tr key={purchase.id} className="hover:bg-gray-50 dark:hover:bg-slate-700">
                              <td className="px-2 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white text-xs">
                                {new Date(purchase.fecha).toLocaleDateString('es-AR')}
                              </td>
                              <td className="px-2 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white text-xs">
                                {purchase.material}
                              </td>
                              <td className="px-2 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white text-xs">{formatNumber(purchase.cantidad)} kg</td>
                              <td className="px-2 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white text-xs">
                                ${formatNumber(purchase.precio)} ({purchase.moneda})
                                {purchase.moneda === 'USD' && purchase.valor_dolar && (
                                  <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                    Dólar: ${formatNumber(purchase.valor_dolar)}
                                  </span>
                                )}
                              </td>
                              <td className="px-2 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white text-xs">{purchase.proveedor}</td>
                              <td className="px-2 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white text-xs">
                                {tieneIva ? `${ivaPct}%` : 'Sin IVA'}
                              </td>
                              <td className="px-2 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white text-xs">
                                ${formatNumber(ivaMonto)}
                              </td>
                              <td className="px-2 py-3 whitespace-nowrap text-sm font-semibold text-green-600 dark:text-green-400 text-xs">
                                ${formatNumber(totalSinIva)}
                              </td>
                              <td className="px-2 py-3 whitespace-nowrap text-sm font-semibold text-blue-600 dark:text-blue-400 text-xs">
                                ${formatNumber(totalConIva)}
                              </td>
                              <td className="px-2 py-3 whitespace-nowrap text-sm">
                                <div className="flex flex-col gap-1">
                                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                                    purchase.estado === 'recibido'
                                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                                      : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                                  }`}>
                                    {purchase.estado === 'recibido' ? 'Recibido' : 'Pendiente'}
                                  </span>
                                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                                    purchase.pagado
                                      ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                                      : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                                  }`}>
                                    {purchase.pagado ? 'Pagado' : 'Impago'}
                                  </span>
                                </div>
                              </td>
                              <td className="px-2 py-3 whitespace-nowrap text-right text-sm">
                                <div className="flex items-center justify-end gap-1">
                                  {canEdit('fabinsa-purchases') && (
                                    <button
                                      onClick={() => {
                                        setEditingMaterial(purchase);
                                        setShowMaterialForm(true);
                                      }}
                                      className="p-1 rounded text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors flex-shrink-0"
                                      title="Editar compra"
                                    >
                                      <Edit className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                  {canDelete('fabinsa-purchases') && (
                                    <button
                                      onClick={async () => {
                                        if (confirm('¿Eliminar esta compra?')) {
                                          await supabase.from('purchases_materials').delete().eq('id', purchase.id);
                                          loadPurchases();
                                        }
                                      }}
                                      className="p-1 rounded text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors flex-shrink-0"
                                      title="Eliminar compra"
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
                )}
              </tbody>
            </table>
            </div>
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
                    {editingProductOrder ? 'Editar Orden de Compra' : editingProduct ? 'Editar Compra' : 'Nueva Compra de Producto'}
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
                    <div className="relative">
                      <input
                        ref={productInputRef}
                        type="text"
                        required={productItems.length === 0}
                        value={productForm.producto}
                        onChange={(e) => {
                          const selectedProductName = e.target.value;
                          setProductForm({ ...productForm, producto: selectedProductName });
                          setShowProductDropdown(selectedProductName.length > 0 && getFilteredProducts(selectedProductName).length > 0);
                        }}
                        onFocus={() => {
                          if (getFilteredProducts(productForm.producto).length > 0) {
                            setShowProductDropdown(true);
                          }
                        }}
                        onBlur={() => {
                          // Delay para permitir que el click en el dropdown funcione
                          setTimeout(() => setShowProductDropdown(false), 200);
                        }}
                        className="w-full px-3 py-2 pr-8 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Escribe o selecciona un producto"
                      />
                      <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
                      {showProductDropdown && getFilteredProducts(productForm.producto).length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-auto top-full">
                          {getFilteredProducts(productForm.producto).map((prod) => (
                            <button
                              key={prod.id}
                              type="button"
                              onClick={() => {
                                setProductForm({ ...productForm, producto: prod.nombre, codigo_producto: prod.codigo_producto });
                                setShowProductDropdown(false);
                                productInputRef.current?.blur();
                              }}
                              className="w-full text-left px-4 py-2 hover:bg-blue-50 dark:hover:bg-slate-600 focus:bg-blue-50 dark:focus:bg-slate-600 focus:outline-none text-gray-900 dark:text-white"
                            >
                              <div className="font-medium">
                                {prod.codigo_producto ? `${prod.codigo_producto} - ${prod.nombre}` : prod.nombre}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
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
                          <div key={item.id} className="bg-white dark:bg-slate-600 p-3 rounded-md">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="font-medium text-gray-900 dark:text-white">
                                  {item.codigo_producto ? `${item.codigo_producto} - ${item.producto}` : item.producto}
                                </div>
                                <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                  Cantidad: {item.cantidad} u | Precio: ${formatNumber(item.precio)} ({item.moneda})
                                  {item.moneda === 'USD' && item.valor_dolar && (
                                    <span className="ml-2">| Dólar: ${formatNumber(item.valor_dolar)}</span>
                                  )}
                                </div>
                                <div className="text-sm font-semibold text-gray-900 dark:text-white mt-1">
                                  {item.tiene_iva ? (
                                    <>
                                      Subtotal: ${formatNumber(item.total)} | IVA ({item.iva_pct}%): ${formatNumber((item.total_con_iva || item.total) - item.total)} | Total: ${formatNumber(item.total_con_iva || item.total)}
                                    </>
                                  ) : (
                                    <>Total: ${formatNumber(item.total)}</>
                                  )}
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
                            <div className="mt-2 flex items-center space-x-3 pt-2 border-t border-gray-200 dark:border-gray-500">
                              <label className="flex items-center space-x-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={item.tiene_iva}
                                  onChange={() => handleToggleProductIva(item.id)}
                                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:bg-slate-700 dark:border-gray-600"
                                />
                                <span className="text-sm text-gray-700 dark:text-gray-300">Tiene IVA</span>
                              </label>
                              {item.tiene_iva && (
                                <div className="flex items-center space-x-2">
                                  <label className="text-sm text-gray-700 dark:text-gray-300">IVA:</label>
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.01"
                                    value={item.iva_pct}
                                    onChange={(e) => handleUpdateProductIvaPct(item.id, parseFloat(e.target.value) || 21)}
                                    className="w-20 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                                  />
                                  <span className="text-sm text-gray-700 dark:text-gray-300">%</span>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 pt-3 border-t border-gray-300 dark:border-gray-600">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">Total Compra:</span>
                          <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                            ${formatNumber(productItems.reduce((sum, item) => sum + (item.tiene_iva ? (item.total_con_iva || item.total) : item.total), 0))}
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
                        className="px-2 sm:px-3 md:px-4 lg:px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-semibold shadow-lg"
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
            <div className="overflow-x-auto">
              <table className="w-full divide-y divide-gray-200 dark:divide-gray-700 table-auto">
              <thead className="bg-gray-50 dark:bg-slate-700">
                <tr>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase whitespace-nowrap w-24">Fecha</th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase w-32">Producto</th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase whitespace-nowrap w-20">Cantidad</th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase whitespace-nowrap w-24">Precio</th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase w-28">Proveedor</th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase whitespace-nowrap w-16">IVA</th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase whitespace-nowrap w-24">Total IVA</th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase whitespace-nowrap w-24">Costo</th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase whitespace-nowrap w-24">Total</th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase whitespace-nowrap w-28">Estado</th>
                  <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase whitespace-nowrap w-32">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-gray-700">
                {productPurchases.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-2 sm:px-3 md:px-4 lg:px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                      No hay compras registradas
                    </td>
                  </tr>
                ) : (
                  <>
                        {/* Mostrar órdenes agrupadas */}
                        {groupedProductPurchases.orders.map((order: any) => {
                          const isExpanded = expandedProductOrders.has(order.order_id);
                          const hasProblems = hasReceptionProblems(order.order_id);
                          return (
                            <React.Fragment key={order.order_id}>
                              {/* Fila resumen de la orden */}
                              <tr className={`${hasProblems ? 'bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 border-l-4 border-red-500' : 'bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30'}`}>
                                <td className="px-2 py-3 text-sm font-medium text-gray-900 dark:text-white">
                                  {new Date(order.fecha).toLocaleDateString('es-AR')}
                                </td>
                                <td className="px-2 py-3 text-sm font-medium text-gray-900 dark:text-white" colSpan={2}>
                                  <div className="flex items-center space-x-2">
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
                                      <span className="text-xs">Orden con {order.items.length} producto{order.items.length > 1 ? 's' : ''}</span>
                                      <ChevronDown className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                    </button>
                                    {hasProblems && (
                                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300">
                                        ⚠ Problema en Control
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-2 py-3 text-sm font-medium text-gray-900 dark:text-white"></td>
                                <td className="px-2 py-3 text-sm font-medium text-gray-900 dark:text-white text-xs">{order.proveedor}</td>
                                <td className="px-2 py-3 text-sm text-gray-900 dark:text-white text-xs">
                                  {order.tiene_iva ? `${order.iva_pct}%` : 'Sin IVA'}
                                </td>
                                <td className="px-2 py-3 text-sm font-semibold text-gray-900 dark:text-white text-xs">
                                  ${formatNumber(order.total_iva)}
                                </td>
                                <td className="px-2 py-3 text-sm font-semibold text-green-600 dark:text-green-400 text-xs">
                                  ${formatNumber(order.subtotal_sin_iva)}
                                </td>
                                <td className="px-2 py-3 text-sm font-semibold text-blue-600 dark:text-blue-400 text-xs">
                                  {order.moneda === 'USD' && order.valor_dolar ? (
                                    <>
                                      ${formatNumber(order.total_compra_usd || order.total_compra / order.valor_dolar)} {order.moneda}
                                      <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                        (${formatNumber(order.total_compra)} ARS)
                                      </span>
                                    </>
                                  ) : (
                                    <>${formatNumber(order.total_compra)} ARS</>
                                  )}
                                </td>
                                <td className="px-2 py-3 text-sm">
                                  <div className="flex flex-col gap-1">
                                    {/* Estado de Recepción */}
                                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                                      order.estado === 'recibido'
                                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                                        : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                                    }`}>
                                      {order.estado === 'recibido' ? 'Recibido' : 'Pendiente'}
                                    </span>
                                    {/* Estado de Pago */}
                                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                                      order.pagado
                                        ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                                        : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                                    }`}>
                                      {order.pagado ? 'Pagado' : 'Impago'}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-2 py-3 text-sm whitespace-nowrap">
                                  <div className="flex items-center gap-1">
                                    {canEdit('fabinsa-purchases') && (
                                      <button
                                        onClick={() => updateReceptionStatus('product', order.order_id, order.estado === 'recibido' ? 'pendiente' : 'recibido')}
                                        className={`p-1 rounded text-white transition-colors flex-shrink-0 ${
                                          order.estado === 'recibido'
                                            ? 'bg-orange-600 dark:bg-orange-500 hover:bg-orange-700 dark:hover:bg-orange-600'
                                            : 'bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600'
                                        }`}
                                        title={order.estado === 'recibido' ? 'Marcar como Pendiente' : 'Marcar como Recibido'}
                                      >
                                        <CheckCircle className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                    {canEdit('fabinsa-purchases') && (
                                      <button
                                        onClick={() => updatePaymentStatus('product', order.order_id, !order.pagado)}
                                        className={`p-1 rounded text-white transition-colors flex-shrink-0 ${
                                          order.pagado
                                            ? 'bg-red-600 dark:bg-red-500 hover:bg-red-700 dark:hover:bg-red-600'
                                            : 'bg-green-600 dark:bg-green-500 hover:bg-green-700 dark:hover:bg-green-600'
                                        }`}
                                        title={order.pagado ? 'Marcar como Impago' : 'Marcar como Pagado'}
                                      >
                                        <DollarSign className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                    {canEdit('fabinsa-purchases') && (
                                      <button
                                        onClick={() => handleEditProductOrder(order)}
                                        className="p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors flex-shrink-0"
                                        title="Editar Orden"
                                      >
                                        <Edit className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                    {canPrint('fabinsa-purchases') && (
                                    <button
                                      onClick={() => handlePrintProductOrder(order)}
                                      className="p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors flex-shrink-0"
                                      title="Imprimir/Generar PDF"
                                    >
                                      <FileText className="w-3.5 h-3.5" />
                                    </button>
                                    )}
                                    {canDelete('fabinsa-purchases') && (
                                      <button
                                        onClick={async () => {
                                          if (confirm(`¿Eliminar toda la orden con ${order.items.length} producto${order.items.length > 1 ? 's' : ''}?`)) {
                                            await supabase.from('purchases_products').delete().eq('order_id', order.order_id);
                                            loadPurchases();
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
                                // El precio guardado ahora es el precio original en la moneda de la compra
                                // Si la moneda es USD, item.precio ya está en USD
                                // Si la moneda es ARS, item.precio está en ARS
                                const precioUnitarioMostrar = item.precio;
                                
                                // Calcular IVA para este item
                                const tieneIva = item.tiene_iva || false;
                                const ivaPct = item.iva_pct || 0;
                                const totalSinIva = item.total;
                                const totalConIva = tieneIva ? totalSinIva * (1 + ivaPct / 100) : totalSinIva;
                                const ivaMonto = tieneIva ? totalSinIva * (ivaPct / 100) : 0;
                                
                                return (
                                  <tr key={item.id} className="bg-gray-50 dark:bg-slate-700 hover:bg-gray-100 dark:hover:bg-slate-600">
                                    <td className="px-2 py-2 text-sm text-gray-600 dark:text-gray-400"></td>
                                    <td className="px-2 py-2 text-sm text-gray-900 dark:text-white pl-6 text-xs">
                                      • {item.codigo_producto ? `${item.codigo_producto} - ${item.producto}` : item.producto}
                                    </td>
                                    <td className="px-2 py-2 text-sm text-gray-900 dark:text-white text-xs">{item.cantidad} u</td>
                                    <td className="px-2 py-2 text-sm text-gray-900 dark:text-white text-xs">
                                      ${formatNumber(precioUnitarioMostrar)} ({item.moneda})
                                      {item.moneda === 'USD' && item.valor_dolar && (
                                        <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                          Dólar: ${formatNumber(item.valor_dolar)}
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-2 py-2 text-sm text-gray-600 dark:text-gray-400"></td>
                                    <td className="px-2 py-2 text-sm text-gray-900 dark:text-white text-xs">
                                      {tieneIva ? `${ivaPct}%` : 'Sin IVA'}
                                    </td>
                                    <td className="px-2 py-2 text-sm text-gray-900 dark:text-white text-xs">
                                      ${formatNumber(ivaMonto)}
                                    </td>
                                    <td className="px-2 py-2 text-sm font-semibold text-green-600 dark:text-green-400 text-xs">
                                      ${formatNumber(totalSinIva)}
                                    </td>
                                    <td className="px-2 py-2 text-sm font-semibold text-blue-600 dark:text-blue-400 text-xs">
                                      ${formatNumber(totalConIva)}
                                    </td>
                                    <td className="px-2 py-2 text-sm"></td>
                                    <td className="px-2 py-2 text-sm"></td>
                                  </tr>
                                );
                              })}
                            </React.Fragment>
                          );
                        })}
                        {/* Mostrar compras individuales (sin order_id) */}
                        {groupedProductPurchases.individual.map((purchase: any) => {
                          // Calcular IVA para compras individuales
                          const tieneIva = purchase.tiene_iva || false;
                          const ivaPct = purchase.iva_pct || 0;
                          const totalSinIva = purchase.total;
                          const totalConIva = tieneIva ? totalSinIva * (1 + ivaPct / 100) : totalSinIva;
                          const ivaMonto = tieneIva ? totalSinIva * (ivaPct / 100) : 0;
                          
                          return (
                          <tr key={purchase.id} className="hover:bg-gray-50 dark:hover:bg-slate-700">
                            <td className="px-2 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white text-xs">
                              {new Date(purchase.fecha).toLocaleDateString('es-AR')}
                            </td>
                            <td className="px-2 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white text-xs">{purchase.codigo_producto ? `${purchase.codigo_producto} - ${purchase.producto}` : purchase.producto}</td>
                            <td className="px-2 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white text-xs">{purchase.cantidad} u</td>
                            <td className="px-2 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white text-xs">
                              ${formatNumber(purchase.precio)} ({purchase.moneda})
                              {purchase.moneda === 'USD' && purchase.valor_dolar && (
                                <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                  Dólar: ${formatNumber(purchase.valor_dolar)}
                                </span>
                              )}
                            </td>
                            <td className="px-2 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white text-xs">{purchase.proveedor}</td>
                            <td className="px-2 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white text-xs">
                              {tieneIva ? `${ivaPct}%` : 'Sin IVA'}
                            </td>
                            <td className="px-2 py-3 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-white text-xs">
                              ${formatNumber(ivaMonto)}
                            </td>
                            <td className="px-2 py-3 whitespace-nowrap text-sm font-semibold text-green-600 dark:text-green-400 text-xs">
                              ${formatNumber(totalSinIva)}
                            </td>
                            <td className="px-2 py-3 whitespace-nowrap text-sm font-semibold text-blue-600 dark:text-blue-400 text-xs">
                              ${formatNumber(totalConIva)}
                            </td>
                            <td className="px-2 py-3 whitespace-nowrap text-sm">
                              <div className="flex flex-col gap-1">
                                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                                  purchase.estado === 'recibido'
                                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                                }`}>
                                  {purchase.estado === 'recibido' ? 'Recibido' : 'Pendiente'}
                                </span>
                                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                                  purchase.pagado
                                    ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                                    : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                                }`}>
                                  {purchase.pagado ? 'Pagado' : 'Impago'}
                                </span>
                              </div>
                            </td>
                            <td className="px-2 py-3 whitespace-nowrap text-right text-sm">
                              <div className="flex items-center justify-end gap-1">
                                {canPrint('fabinsa-purchases') && (
                                <button
                                  onClick={async () => {
                                    const precioUnitarioMostrar = purchase.moneda === 'USD' && purchase.valor_dolar 
                                      ? purchase.precio / purchase.valor_dolar 
                                      : purchase.precio;
                                    const orderData: OrderData = {
                                      tipo: 'compra',
                                      fecha: purchase.fecha,
                                      proveedor: purchase.proveedor,
                                      items: [{
                                        producto: purchase.producto,
                                        cantidad: purchase.cantidad,
                                        precio: precioUnitarioMostrar,
                                        total: purchase.total,
                                        moneda: purchase.moneda,
                                        valor_dolar: purchase.valor_dolar,
                                      }],
                                      total_compra: purchase.total,
                                      logoUrl: tenant?.logo_url || undefined,
                                      companyName: tenant?.name || undefined,
                                    };
                                    await generateOrderPDF(orderData);
                                  }}
                                  className="p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors flex-shrink-0"
                                  title="Imprimir/Generar PDF"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                </button>
                                )}
                                {canDelete('fabinsa-purchases') && (
                                  <button
                                    onClick={async () => {
                                      if (confirm('¿Eliminar esta compra?')) {
                                        await supabase.from('purchases_products').delete().eq('id', purchase.id);
                                        loadPurchases();
                                      }
                                    }}
                                    className="p-1 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors flex-shrink-0"
                                    title="Eliminar compra"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                          );
                        })}
                        {/* Mostrar compras individuales (sin order_id) */}
                        {groupedProductPurchases.individual.map((purchase: any) => {
                          // Calcular IVA para compras individuales
                          const tieneIva = purchase.tiene_iva || false;
                          const ivaPct = purchase.iva_pct || 0;
                          const totalSinIva = purchase.total;
                          const totalConIva = tieneIva ? totalSinIva * (1 + ivaPct / 100) : totalSinIva;
                          const ivaMonto = tieneIva ? totalSinIva * (ivaPct / 100) : 0;
                          
                          return (
                            <tr key={purchase.id} className="hover:bg-gray-50 dark:hover:bg-slate-700">
                              <td className="px-2 sm:px-3 md:px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                {new Date(purchase.fecha).toLocaleDateString('es-AR')}
                              </td>
                              <td className="px-2 sm:px-3 md:px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                {purchase.codigo_producto ? `${purchase.codigo_producto} - ${purchase.producto}` : purchase.producto}
                              </td>
                              <td className="px-2 sm:px-3 md:px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{formatNumber(purchase.cantidad)} u</td>
                              <td className="px-2 sm:px-3 md:px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                ${formatNumber(purchase.precio)} ({purchase.moneda})
                                {purchase.moneda === 'USD' && purchase.valor_dolar && (
                                  <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                    Dólar: ${formatNumber(purchase.valor_dolar)}
                                  </span>
                                )}
                              </td>
                              <td className="px-2 sm:px-3 md:px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{purchase.proveedor}</td>
                              <td className="px-2 sm:px-3 md:px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                {tieneIva ? `${ivaPct}%` : 'Sin IVA'}
                              </td>
                              <td className="px-2 sm:px-3 md:px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                ${formatNumber(ivaMonto)}
                              </td>
                              <td className="px-2 sm:px-3 md:px-4 lg:px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600 dark:text-green-400">
                                ${formatNumber(totalSinIva)}
                              </td>
                              <td className="px-2 sm:px-3 md:px-4 lg:px-6 py-4 whitespace-nowrap text-sm font-semibold text-blue-600 dark:text-blue-400">
                                ${formatNumber(totalConIva)}
                              </td>
                              <td className="px-2 sm:px-3 md:px-4 lg:px-6 py-4 whitespace-nowrap text-sm">
                                <div className="flex flex-col gap-1">
                                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                                    purchase.estado === 'recibido'
                                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                                      : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                                  }`}>
                                    {purchase.estado === 'recibido' ? 'Recibido' : 'Pendiente'}
                                  </span>
                                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                                    purchase.pagado
                                      ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                                      : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                                  }`}>
                                    {purchase.pagado ? 'Pagado' : 'Impago'}
                                  </span>
                                </div>
                              </td>
                              <td className="px-2 sm:px-3 md:px-4 lg:px-6 py-4 whitespace-nowrap text-right text-sm">
                                <div className="flex items-center justify-end gap-2">
                                  {canEdit('fabinsa-purchases') && (
                                    <button
                                      onClick={() => {
                                        setEditingProduct(purchase);
                                        setShowProductForm(true);
                                      }}
                                      className="p-1.5 rounded text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors flex-shrink-0"
                                      title="Editar compra"
                                    >
                                      <Edit className="w-4 h-4" />
                                    </button>
                                  )}
                                  {canDelete('fabinsa-purchases') && (
                                    <button
                                      onClick={async () => {
                                        if (confirm('¿Eliminar esta compra?')) {
                                          await supabase.from('purchases_products').delete().eq('id', purchase.id);
                                          loadPurchases();
                                        }
                                      }}
                                      className="p-1.5 rounded text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors flex-shrink-0"
                                      title="Eliminar compra"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </>
                )}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}




