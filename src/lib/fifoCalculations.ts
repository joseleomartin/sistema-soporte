/**
 * Funciones para cálculo FIFO (First In, First Out)
 * Calcula costos y descuenta stock usando el método FIFO
 */

import { Database } from './database.types';

type PurchaseMaterial = Database['public']['Tables']['purchases_materials']['Row'];

export interface FIFOCostResult {
  costo_total: number;
  costo_unitario: number;
  compras_usadas: Array<{
    compra_id: string;
    cantidad_usada: number;
    precio_unitario: number;
    fecha: string;
  }>;
}

/**
 * Calcula el costo FIFO para una cantidad específica de material
 * Toma las compras más antiguas primero
 */
export async function calculateFIFOCost(
  supabase: any,
  tenantId: string,
  materialName: string,
  cantidadNecesaria: number
): Promise<FIFOCostResult> {
  // Primero, buscar el material en stock_materials por nombre para obtener el campo "material"
  // porque purchases_materials usa el campo "material", no "nombre"
  const { data: stockData } = await supabase
    .from('stock_materials')
    .select('material')
    .eq('tenant_id', tenantId)
    .ilike('nombre', materialName)
    .limit(1);

  const materialField = (stockData && stockData.length > 0 && stockData[0].material) || materialName;

  // Obtener todas las compras del material ordenadas por fecha (más antiguas primero)
  const { data: compras, error } = await supabase
    .from('purchases_materials')
    .select('*')
    .eq('tenant_id', tenantId)
    .ilike('material', materialField)
    .order('fecha', { ascending: true }); // Más antiguas primero

  if (error) {
    console.error('Error loading purchases for FIFO:', error);
    throw error;
  }

  if (!compras || compras.length === 0) {
    // Si no hay compras, retornar costo 0
    return {
      costo_total: 0,
      costo_unitario: 0,
      compras_usadas: [],
    };
  }

  let cantidadRestante = cantidadNecesaria;
  let costoTotal = 0;
  const comprasUsadas: FIFOCostResult['compras_usadas'] = [];

  // Recorrer las compras desde la más antigua
  for (const compra of compras) {
    if (cantidadRestante <= 0) break;

    const cantidadDisponible = compra.cantidad;
    const cantidadAUsar = Math.min(cantidadRestante, cantidadDisponible);
    const precioUnitario = compra.precio; // Precio ya está en ARS

    costoTotal += cantidadAUsar * precioUnitario;
    cantidadRestante -= cantidadAUsar;

    comprasUsadas.push({
      compra_id: compra.id,
      cantidad_usada: cantidadAUsar,
      precio_unitario: precioUnitario,
      fecha: compra.fecha,
    });
  }

  // Si no hay suficiente stock, usar el último precio disponible
  if (cantidadRestante > 0 && compras.length > 0) {
    const ultimaCompra = compras[compras.length - 1];
    costoTotal += cantidadRestante * ultimaCompra.precio;
    comprasUsadas.push({
      compra_id: ultimaCompra.id,
      cantidad_usada: cantidadRestante,
      precio_unitario: ultimaCompra.precio,
      fecha: ultimaCompra.fecha,
    });
  }

  return {
    costo_total: costoTotal,
    costo_unitario: cantidadNecesaria > 0 ? costoTotal / cantidadNecesaria : 0,
    compras_usadas: comprasUsadas,
  };
}

/**
 * Obtiene el precio unitario FIFO para un material
 * Retorna el precio de la compra más antigua disponible (en ARS)
 */
export async function getFIFOUnitPrice(
  supabase: any,
  tenantId: string,
  materialName: string
): Promise<number> {
  // Primero, buscar el material en stock_materials por nombre para obtener el campo "material"
  const { data: stockData } = await supabase
    .from('stock_materials')
    .select('material')
    .eq('tenant_id', tenantId)
    .ilike('nombre', materialName)
    .limit(1);

  const materialField = (stockData && stockData.length > 0 && stockData[0].material) || materialName;

  const { data: compras, error } = await supabase
    .from('purchases_materials')
    .select('precio, moneda, valor_dolar')
    .eq('tenant_id', tenantId)
    .ilike('material', materialField)
    .order('fecha', { ascending: true }) // Más antigua primero
    .limit(1);

  if (error) {
    console.error('Error loading FIFO price:', error);
    return 0;
  }

  if (!compras || compras.length === 0) {
    return 0;
  }

  const compra = compras[0];
  // El precio en purchases_materials ya está en ARS (se convierte al guardar)
  // Pero por si acaso, verificamos
  if (compra.moneda === 'USD' && compra.valor_dolar) {
    return compra.precio * compra.valor_dolar;
  }
  
  return compra.precio; // Ya está en ARS
}

/**
 * Obtiene el precio FIFO con información completa de la compra más antigua
 * OPTIMIZADO: Hace ambas consultas en paralelo cuando es posible
 */
async function getFIFOPriceInfo(
  supabase: any,
  tenantId: string,
  materialName: string
): Promise<{ precioARS: number; moneda: 'ARS' | 'USD'; valorDolar: number }> {
  // OPTIMIZACIÓN: Buscar primero en purchases_materials directamente con el nombre
  // Si no encuentra, entonces buscar en stock_materials para obtener el campo "material"
  // Esto reduce consultas innecesarias
  const [purchasesResult, stockResult] = await Promise.all([
    // Intentar buscar directamente en purchases_materials con el nombre
    supabase
      .from('purchases_materials')
      .select('precio, moneda, valor_dolar')
      .eq('tenant_id', tenantId)
      .ilike('material', materialName)
      .order('fecha', { ascending: true })
      .limit(1),
    // Buscar en stock_materials para obtener el campo "material" y datos de fallback
    supabase
      .from('stock_materials')
      .select('material, costo_kilo_usd, moneda, valor_dolar')
      .eq('tenant_id', tenantId)
      .ilike('nombre', materialName)
      .limit(1)
  ]);

  const stockData = stockResult.data;
  let materialField = materialName;

  if (stockData && stockData.length > 0) {
    materialField = stockData[0].material || materialName;
  }

  // Si la primera búsqueda no encontró resultados y tenemos un materialField diferente, buscar de nuevo
  let compras = purchasesResult.data;
  if ((!compras || compras.length === 0) && materialField !== materialName) {
    const { data: comprasByField } = await supabase
      .from('purchases_materials')
      .select('precio, moneda, valor_dolar')
      .eq('tenant_id', tenantId)
      .ilike('material', materialField)
      .order('fecha', { ascending: true })
      .limit(1);
    compras = comprasByField;
  }

  if (!compras || compras.length === 0) {
    // Si no hay compras, obtener del stock como fallback
    if (stockData && stockData.length > 0) {
      const stock = stockData[0];
      const precioARS = stock.moneda === 'USD' 
        ? stock.costo_kilo_usd * (stock.valor_dolar || 1)
        : stock.costo_kilo_usd;
      return {
        precioARS,
        moneda: stock.moneda,
        valorDolar: stock.valor_dolar || 1,
      };
    }
    return { precioARS: 0, moneda: 'ARS', valorDolar: 1 };
  }

  const compra = compras[0];
  // El precio en purchases_materials ya está en ARS (se convierte al guardar)
  return {
    precioARS: compra.precio,
    moneda: compra.moneda || 'ARS',
    valorDolar: compra.valor_dolar || 1,
  };
}

/**
 * Calcula el costo FIFO para múltiples materiales
 * Retorna un objeto con los precios por material usando la compra más antigua
 */
export async function calculateFIFOPricesForMaterials(
  supabase: any,
  tenantId: string,
  materials: Array<{ material_name: string; kg_por_unidad: number }>
): Promise<Record<string, { costo_kilo_usd: number; valor_dolar: number; moneda: 'ARS' | 'USD' }>> {
  const materialPrices: Record<string, { costo_kilo_usd: number; valor_dolar: number; moneda: 'ARS' | 'USD' }> = {};

  for (const material of materials) {
    const priceInfo = await getFIFOPriceInfo(supabase, tenantId, material.material_name);
    
    // Convertir precio ARS a costo_kilo_usd (dividir por valor_dolar)
    const costoKiloUSD = priceInfo.precioARS / (priceInfo.valorDolar || 1);

    materialPrices[material.material_name] = {
      costo_kilo_usd: costoKiloUSD,
      valor_dolar: priceInfo.valorDolar,
      moneda: priceInfo.moneda,
    };
  }

  return materialPrices;
}

/**
 * Obtiene todos los precios FIFO para todos los materiales del stock
 * Útil para precargar todos los precios al inicio
 * OPTIMIZADO: Consultas en paralelo en lugar de secuenciales
 */
export async function getAllFIFOPrices(
  supabase: any,
  tenantId: string,
  stockMaterials: Array<{ material: string; moneda: 'ARS' | 'USD'; valor_dolar: number }>
): Promise<Record<string, { costo_kilo_usd: number; valor_dolar: number; moneda: 'ARS' | 'USD' }>> {
  const materialPrices: Record<string, { costo_kilo_usd: number; valor_dolar: number; moneda: 'ARS' | 'USD' }> = {};

  // OPTIMIZACIÓN: Hacer todas las consultas en paralelo en lugar de secuencialmente
  const pricePromises = stockMaterials.map(async (stockMat) => {
    const priceInfo = await getFIFOPriceInfo(supabase, tenantId, stockMat.material);
    const costoKiloUSD = priceInfo.precioARS > 0 ? priceInfo.precioARS / (priceInfo.valorDolar || 1) : 0;

    return {
      material: stockMat.material,
      price: {
        costo_kilo_usd: costoKiloUSD,
        valor_dolar: priceInfo.valorDolar,
        moneda: priceInfo.moneda,
      }
    };
  });

  // Esperar todas las promesas en paralelo
  const results = await Promise.all(pricePromises);
  
  // Construir el objeto de resultados
  results.forEach(({ material, price }) => {
    materialPrices[material] = price;
  });

  return materialPrices;
}

