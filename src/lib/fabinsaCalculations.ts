/**
 * Funciones de lógica de negocio para el sistema Fabinsa
 * Cálculos de costos, empleados, ventas, rentabilidad, etc.
 */

import { Database } from './database.types';

type Product = Database['public']['Tables']['products']['Row'];
type ProductMaterial = Database['public']['Tables']['product_materials']['Row'];
type Employee = Database['public']['Tables']['employees']['Row'];
type StockMaterial = Database['public']['Tables']['stock_materials']['Row'];

// ============================================
// INTERFACES PARA CÁLCULOS
// ============================================

export interface ProductCosts {
  costo_unitario_mp: number;
  costo_total_mp: number;
  horas_necesarias: number;
  incidencia_mano_obra: number;
  costo_unitario_mano_obra: number;
  costo_base_unitario: number;
  iibb_unitario: number;
  total_iibb: number;
  rentabilidad_neta: number | null;
  rentabilidad_neta_total: number | null;
}

export interface EmployeeMetrics {
  dias_efectivos: number;
  horas_productivas: number;
  horas_no_productivas: number;
  horas_trabajadas: number;
  jornal_productivas: number;
  jornal_vacaciones: number;
  jornal_feriados: number;
  jornal_lic_enfermedad: number;
  jornal_otras_licencias: number;
  jornal_ausencias: number;
  jornal_descanso: number;
  jornal_horas_extras: number;
  jornal_feriados_trabajados: number;
  subtotal_col1: number;
  sac_col1: number;
  total_col1: number;
  ccss_productivas: number;
  ccss_vacaciones: number;
  ccss_feriados: number;
  ccss_lic_enfermedad: number;
  ccss_otras_licencias: number;
  ccss_ausencias: number;
  ccss_descanso: number;
  ccss_horas_extras: number;
  ccss_feriados_trabajados: number;
  subtotal_col2: number;
  sac_col2: number;
  total_col2: number;
  indice_ajustado: number;
  valor_hora_ajustado: number;
}

export interface SaleCalculation {
  precio_neto_iib: number;
  precio_final: number;
  ingreso_bruto: number;
  ingreso_neto: number;
  ganancia_un: number;
  ganancia_total: number;
}

// ============================================
// FUNCIONES DE CÁLCULO DE PRODUCTOS
// ============================================

/**
 * Calcula el costo de materiales para un producto
 */
export function calculateMaterialCost(
  materials: ProductMaterial[],
  materialPrices: Record<string, { costo_kilo_usd: number; valor_dolar: number; moneda: 'ARS' | 'USD' }>,
  valorDolarCostos?: number
): number {
  let total = 0;

  for (const material of materials) {
    const precio = materialPrices[material.material_name];
    if (!precio) continue;

    const kgPorUnidad = material.kg_por_unidad;
    let costoPesos = 0;

    if (precio.moneda === 'USD') {
      const valorDolar = valorDolarCostos && valorDolarCostos > 0 ? valorDolarCostos : precio.valor_dolar;
      costoPesos = precio.costo_kilo_usd * valorDolar;
    } else {
      costoPesos = precio.costo_kilo_usd;
    }

    total += kgPorUnidad * costoPesos;
  }

  return total;
}

/**
 * Calcula todos los costos de un producto
 */
export function calculateProductCosts(
  product: Product,
  materials: ProductMaterial[],
  materialPrices: Record<string, { costo_kilo_usd: number; valor_dolar: number; moneda: 'ARS' | 'USD' }>,
  employeeHourValue: number,
  valorDolarCostos?: number
): ProductCosts {
  // Costo unitario de materia prima
  const costo_unitario_mp = calculateMaterialCost(materials, materialPrices, valorDolarCostos);
  const cantidad_fabricar = product.cantidad_fabricar || 0;
  const costo_total_mp = costo_unitario_mp * cantidad_fabricar;

  // Horas necesarias
  const cantidad_por_hora = product.cantidad_por_hora || 0;
  const horas_necesarias = cantidad_por_hora > 0 ? cantidad_fabricar / cantidad_por_hora : 0;

  // Incidencia de mano de obra
  const incidencia_mano_obra = horas_necesarias * employeeHourValue;

  // Costo unitario de mano de obra
  const costo_unitario_mano_obra = cantidad_fabricar > 0 ? incidencia_mano_obra / cantidad_fabricar : 0;

  // Costo base unitario (MP + MO)
  const costo_base_unitario = costo_unitario_mp + costo_unitario_mano_obra;

  // IIBB unitario (sobre precio de venta)
  const precio_venta = product.precio_venta || 0;
  const iibb_porcentaje = product.iibb_porcentaje || 0;
  const iibb_unitario = precio_venta > 0 && iibb_porcentaje > 0 
    ? (precio_venta * iibb_porcentaje / 100) 
    : 0;

  // Total IIBB
  const total_iibb = iibb_unitario * cantidad_fabricar;

  // Rentabilidad neta
  let rentabilidad_neta: number | null = null;
  let rentabilidad_neta_total: number | null = null;

  if (precio_venta > 0) {
    rentabilidad_neta = precio_venta - costo_base_unitario - iibb_unitario;
    rentabilidad_neta_total = rentabilidad_neta * cantidad_fabricar;
  }

  return {
    costo_unitario_mp,
    costo_total_mp,
    horas_necesarias,
    incidencia_mano_obra,
    costo_unitario_mano_obra,
    costo_base_unitario,
    iibb_unitario,
    total_iibb,
    rentabilidad_neta,
    rentabilidad_neta_total,
  };
}

/**
 * Formatea el nombre del producto en formato "Familia - Medida - Característica"
 */
export function formatProductName(familia: string, medida: string, caracteristica: string): string {
  const parts = [familia];
  if (medida && medida.trim() !== '') parts.push(medida);
  if (caracteristica && caracteristica.trim() !== '') parts.push(caracteristica);
  return parts.join(' - ');
}

/**
 * Parsea un nombre de producto en sus componentes
 */
export function parseProductName(nombre: string): { familia: string; medida: string; caracteristica: string } {
  const parts = nombre.split(' - ');
  if (parts.length >= 3) {
    return {
      familia: parts[0],
      medida: parts[1],
      caracteristica: parts.slice(2).join(' - '),
    };
  } else if (parts.length === 2) {
    return {
      familia: parts[0],
      medida: parts[1],
      caracteristica: '',
    };
  } else {
    return {
      familia: nombre,
      medida: '',
      caracteristica: '',
    };
  }
}

// ============================================
// FUNCIONES DE CÁLCULO DE EMPLEADOS
// ============================================

/**
 * Calcula todas las métricas de un empleado según la matriz de mano de obra
 */
export function calculateEmployeeMetrics(employee: Employee): EmployeeMetrics {
  // Días posibles de trabajo = 365 - 104 (fines de semana) = 261
  const dias_posibles_trabajo = 261;
  const dias_no_productivos = 
    employee.feriados + 
    employee.vacaciones + 
    employee.lic_enfermedad + 
    employee.otras_licencias + 
    employee.ausencias;

  const dias_efectivos = dias_posibles_trabajo - dias_no_productivos;

  // Horas productivas = días efectivos × (horas_dia - horas_descanso)
  const horas_productivas = dias_efectivos * (employee.horas_dia - employee.horas_descanso);

  // Horas no productivas
  const horas_vacaciones = employee.vacaciones * employee.horas_dia;
  const horas_feriados = employee.feriados * employee.horas_dia;
  const horas_lic_enfermedad = employee.lic_enfermedad * employee.horas_dia;
  const horas_otras_licencias = employee.otras_licencias * employee.horas_dia;
  const horas_ausencias = employee.ausencias * employee.horas_dia;
  const horas_descanso_total = employee.horas_descanso * dias_efectivos;
  const horas_no_productivas = 
    horas_vacaciones + 
    horas_feriados + 
    horas_lic_enfermedad + 
    horas_otras_licencias + 
    horas_ausencias;

  // Total horas pagas
  const total_horas_pagas = dias_efectivos * employee.horas_dia;
  const base_horas_pagas = total_horas_pagas > 0 ? total_horas_pagas : 1;

  // COLUMNA 1: Porcentajes base (sobre horas pagas)
  const jornal_productivas = 100.0;
  const jornal_feriados = (horas_feriados / base_horas_pagas) * 100;
  const jornal_vacaciones = (horas_vacaciones / base_horas_pagas) * 100;
  const jornal_lic_enfermedad = (horas_lic_enfermedad / base_horas_pagas) * 100;
  const jornal_otras_licencias = (horas_otras_licencias / base_horas_pagas) * 100;
  const jornal_ausencias = (horas_ausencias / base_horas_pagas) * 100;
  const jornal_descanso = (horas_descanso_total / base_horas_pagas) * 100;
  const jornal_horas_extras = (employee.horas_extras / base_horas_pagas) * 100 * 1.5; // 50% adicional
  const jornal_feriados_trabajados = ((employee.feriados_trabajados * employee.horas_dia) / base_horas_pagas) * 100 * 2.0; // 100% adicional

  const subtotal_col1 = 
    jornal_productivas + 
    jornal_feriados + 
    jornal_vacaciones +
    jornal_lic_enfermedad + 
    jornal_otras_licencias + 
    jornal_ausencias + 
    jornal_descanso + 
    jornal_horas_extras + 
    jornal_feriados_trabajados;

  const sac_col1 = subtotal_col1 / 12;
  const total_col1 = subtotal_col1 + sac_col1;

  // COLUMNA 2: Carga social (43% aplicada a TODOS los componentes)
  const c = employee.carga_social / 100;

  const ccss_productivas = jornal_productivas * c;
  const ccss_feriados = jornal_feriados * c;
  const ccss_vacaciones = jornal_vacaciones * c;
  const ccss_lic_enfermedad = jornal_lic_enfermedad * c;
  const ccss_otras_licencias = jornal_otras_licencias * c;
  const ccss_ausencias = jornal_ausencias * c;
  const ccss_descanso = jornal_descanso * c;
  const ccss_horas_extras = jornal_horas_extras * c;
  const ccss_feriados_trabajados = jornal_feriados_trabajados * c;

  const subtotal_col2 = 
    ccss_productivas + 
    ccss_feriados + 
    ccss_vacaciones +
    ccss_lic_enfermedad + 
    ccss_otras_licencias + 
    ccss_ausencias + 
    ccss_descanso + 
    ccss_horas_extras + 
    ccss_feriados_trabajados;

  const sac_col2 = subtotal_col2 / 12;
  const total_col2 = subtotal_col2 + sac_col2;

  // COLUMNA 3: Total final (Columna 1 + Columna 2)
  const indice_ajustado = total_col1 + total_col2;

  // Valor hora ajustado
  const valor_hora_ajustado = employee.valor_hora * (indice_ajustado / 100);

  // Horas trabajadas
  const horas_trabajadas = horas_productivas + employee.horas_extras + (employee.feriados_trabajados * employee.horas_dia);

  return {
    dias_efectivos,
    horas_productivas,
    horas_no_productivas,
    horas_trabajadas,
    jornal_productivas,
    jornal_vacaciones,
    jornal_feriados,
    jornal_lic_enfermedad,
    jornal_otras_licencias,
    jornal_ausencias,
    jornal_descanso,
    jornal_horas_extras,
    jornal_feriados_trabajados,
    subtotal_col1,
    sac_col1,
    total_col1,
    ccss_productivas,
    ccss_vacaciones,
    ccss_feriados,
    ccss_lic_enfermedad,
    ccss_otras_licencias,
    ccss_ausencias,
    ccss_descanso,
    ccss_horas_extras,
    ccss_feriados_trabajados,
    subtotal_col2,
    sac_col2,
    total_col2,
    indice_ajustado,
    valor_hora_ajustado,
  };
}

/**
 * Calcula el valor hora promedio ajustado de todos los empleados
 */
export function calculateAverageEmployeeHourValue(employees: Employee[]): number {
  if (employees.length === 0) return 0;

  const metrics = employees.map(emp => calculateEmployeeMetrics(emp));
  const total = metrics.reduce((sum, m) => sum + m.valor_hora_ajustado, 0);
  return total / employees.length;
}

// ============================================
// FUNCIONES DE CÁLCULO DE VENTAS
// ============================================

/**
 * Calcula el precio final de una venta con IIBB y descuento
 */
export function calculateSalePrice(
  basePrice: number,
  iibPct: number,
  discountPct: number
): SaleCalculation {
  // Precio neto IIBB: precio_unitario × (1 - iib_pct / 100)
  const precio_neto_iib = basePrice * (1 - iibPct / 100);

  // Precio final: precio_neto_iib × (1 - descuento_pct / 100)
  const precio_final = precio_neto_iib * (1 - discountPct / 100);

  return {
    precio_neto_iib,
    precio_final,
    ingreso_bruto: 0, // Se calcula con cantidad
    ingreso_neto: 0, // Se calcula con cantidad
    ganancia_un: 0, // Se calcula con costo
    ganancia_total: 0, // Se calcula con cantidad y costo
  };
}

/**
 * Calcula todos los valores de una venta
 */
export function calculateSaleValues(
  basePrice: number,
  quantity: number,
  iibPct: number,
  discountPct: number,
  unitCost: number
): SaleCalculation {
  const precio_neto_iib = basePrice * (1 - iibPct / 100);
  const precio_final = precio_neto_iib * (1 - discountPct / 100);
  const ingreso_bruto = basePrice * quantity;
  const ingreso_neto = precio_final * quantity;
  const ganancia_un = precio_final - unitCost;
  const ganancia_total = ganancia_un * quantity;

  return {
    precio_neto_iib,
    precio_final,
    ingreso_bruto,
    ingreso_neto,
    ganancia_un,
    ganancia_total,
  };
}

// ============================================
// FUNCIONES DE CÁLCULO DE RENTABILIDAD
// ============================================

/**
 * Calcula la rentabilidad neta de un producto
 */
export function calculateRentability(
  salePrice: number,
  costBase: number,
  iibPct: number
): number {
  const iibb_unitario = salePrice * (iibPct / 100);
  return salePrice - costBase - iibb_unitario;
}

// ============================================
// FUNCIONES DE CONVERSIÓN DE MONEDAS
// ============================================

/**
 * Convierte un precio de USD a ARS
 */
export function convertUSDToARS(usdPrice: number, dollarValue: number): number {
  return usdPrice * dollarValue;
}

/**
 * Convierte un precio de ARS a USD
 */
export function convertARSToUSD(arsPrice: number, dollarValue: number): number {
  return dollarValue > 0 ? arsPrice / dollarValue : 0;
}

// ============================================
// FUNCIONES DE VALIDACIÓN
// ============================================

/**
 * Valida que un número tenga máximo 5 decimales
 */
export function validateDecimal(value: string): boolean {
  if (value === '' || value === '-') return true;
  try {
    if ('.' in value) {
      const parts = value.split('.');
      if (parts.length === 2 && parts[1].length <= 5) {
        parseFloat(value);
        return true;
      }
      return false;
    }
    parseFloat(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Formatea un número con máximo 5 decimales
 */
export function formatDecimal(value: number, decimals: number = 5): string {
  return value.toFixed(decimals);
}

/**
 * Formatea un precio con 2 decimales
 */
export function formatPrice(value: number, currency: 'ARS' | 'USD' = 'ARS'): string {
  const formatted = value.toFixed(2);
  return currency === 'USD' ? `$${formatted} (USD)` : `$${formatted}`;
}

