/**
 * Módulo de Cash Flow (Flujo de Caja)
 * Planificación financiera mensual con disponibilidades, ingresos y egresos por día
 * Permite agregar sub-items configurables a cada categoría
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, X, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../contexts/TenantContext';
import { useAuth } from '../../contexts/AuthContext';
import { useMobile } from '../../hooks/useMobile';
import { AlertModal } from '../Common/AlertModal';

// Función para formatear números con formato de dinero
const formatNumber = (value: number): string => {
  if (value === 0 || value === null || value === undefined) return '$0.00';
  
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

// Función para formatear número para input
const formatNumberForInput = (value: number | string): string => {
  if (value === 0 || value === null || value === undefined) return '';
  
  if (typeof value === 'string') {
    return value;
  }
  
  let valueStr = value.toString();
  
  if (valueStr.includes('e') || valueStr.includes('E')) {
    valueStr = value.toFixed(10);
  }
  
  const parts = valueStr.split('.');
  const integerPart = parts[0];
  const decimalPart = parts[1] || '';
  
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  
  if (decimalPart) {
    const paddedDecimals = decimalPart.length < 2 ? decimalPart.padEnd(2, '0') : decimalPart;
    return `${formattedInteger}.${paddedDecimals}`;
  } else {
    return `${formattedInteger}.00`;
  }
};

// Función para formatear número mientras se escribe
const formatNumberWhileTyping = (inputValue: string): string => {
  if (!inputValue || inputValue.trim() === '') return '';
  
  let cleaned = inputValue.replace(/[^\d.-]/g, '');
  
  const isNegative = cleaned.startsWith('-');
  if (isNegative) {
    cleaned = cleaned.substring(1);
  }
  
  const lastDot = cleaned.lastIndexOf('.');
  const hasDecimal = lastDot !== -1 && cleaned.length - lastDot - 1 <= 2;
  
  let integerPart = '';
  let decimalPart = '';
  
  if (hasDecimal) {
    integerPart = cleaned.substring(0, lastDot).replace(/\./g, '');
    decimalPart = cleaned.substring(lastDot + 1).replace(/\./g, '');
    if (decimalPart.length > 2) {
      decimalPart = decimalPart.substring(0, 2);
    }
  } else {
    integerPart = cleaned.replace(/\./g, '');
    decimalPart = '';
  }
  
  if (integerPart) {
    integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }
  
  let result = integerPart;
  if (decimalPart) {
    result += '.' + decimalPart;
  }
  
  if (isNegative) {
    result = '-' + result;
  }
  
  return result;
};

// Función para parsear número desde input formateado
const parseFormattedNumber = (formattedValue: string): number => {
  if (!formattedValue || formattedValue.trim() === '') return 0;
  
  let cleaned = formattedValue.trim();
  
  const isNegative = cleaned.startsWith('-');
  if (isNegative) {
    cleaned = cleaned.substring(1);
  }
  
  const lastDot = cleaned.lastIndexOf('.');
  if (lastDot !== -1) {
    const afterLastDot = cleaned.substring(lastDot + 1);
    if (afterLastDot.length <= 2 && afterLastDot.length > 0) {
      const beforeLastDot = cleaned.substring(0, lastDot).replace(/\./g, '');
      cleaned = beforeLastDot + '.' + afterLastDot;
    } else {
      cleaned = cleaned.replace(/\./g, '');
    }
  } else {
    cleaned = cleaned.replace(/\./g, '');
  }
  
  const parsed = parseFloat(cleaned);
  if (isNaN(parsed)) return 0;
  
  return isNegative ? -parsed : parsed;
};

// Función para obtener nombre del mes
const getMonthName = (month: number): string => {
  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  return months[month - 1] || '';
};

// Función para obtener días del mes
const getDaysInMonth = (month: number, year: number): number => {
  return new Date(year, month, 0).getDate();
};

// Función para obtener nombre del día de la semana
const getDayName = (day: number, month: number, year: number): string => {
  const date = new Date(year, month - 1, day);
  const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  return days[date.getDay()];
};

// Tipos
type Category = {
  id: string;
  name: string;
  category_type: 'disponibilidades' | 'ingresos' | 'egresos';
  display_order: number;
};

type SubItem = {
  id: string;
  category_id: string;
  name: string;
  display_order: number;
};

type Value = {
  id: string;
  month_id: string;
  sub_item_id?: string | null;
  category_id?: string | null;
  day_of_month: number;
  value: number;
};

type Month = {
  id: string;
  tenant_id: string;
  name: string;
  month: number;
  year: number;
  created_by: string;
};

interface CategoryWithSubItems extends Category {
  sub_items: SubItem[];
  total_by_day: Record<number, number>;
}

export function CashFlowModule() {
  const { tenantId } = useTenant();
  const { profile } = useAuth();
  const isMobile = useMobile();
  
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<CategoryWithSubItems[]>([]);
  const [months, setMonths] = useState<Month[]>([]);
  const [currentMonth, setCurrentMonth] = useState<Month | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [values, setValues] = useState<Value[]>([]);
  const [editingInputs, setEditingInputs] = useState<Record<string, string>>({});
  const [editingCategoryValue, setEditingCategoryValue] = useState<Record<string, string>>({}); // Para editar valores directos de categorías
  
  // Estados para agregar categorías y sub-items
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryType, setNewCategoryType] = useState<'disponibilidades' | 'ingresos' | 'egresos'>('disponibilidades');
  const [addingSubItem, setAddingSubItem] = useState<string | null>(null);
  const [newSubItemName, setNewSubItemName] = useState('');
  
  // Estados para editar nombres
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingSubItemId, setEditingSubItemId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

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

  // Días del mes (1-31)
  const daysOfMonth = useMemo(() => {
    const daysInMonth = getDaysInMonth(selectedMonth, selectedYear);
    return Array.from({ length: daysInMonth }, (_, i) => i + 1);
  }, [selectedMonth, selectedYear]);

  // Cargar datos cuando cambia el mes/año seleccionado
  useEffect(() => {
    if (tenantId) {
      loadData();
    }
  }, [tenantId, selectedMonth, selectedYear]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Cargar meses
      const { data: monthsData, error: monthsError } = await supabase
        .from('cashflow_months')
        .select('*')
        .eq('tenant_id', tenantId!)
        .order('year', { ascending: false })
        .order('month', { ascending: false });

      if (monthsError) throw monthsError;
      
      setMonths(monthsData || []);
      
      // Determinar mes actual
      let selectedMonthData: Month | null = null;
      if (monthsData && monthsData.length > 0) {
        const existingMonth = monthsData.find(m => m.month === selectedMonth && m.year === selectedYear);
        
        if (existingMonth) {
          selectedMonthData = existingMonth;
        } else {
          // Crear mes actual
          const { data: newMonth, error: monthError } = await supabase
            .from('cashflow_months')
            .insert({
              tenant_id: tenantId!,
              name: `${getMonthName(selectedMonth)} ${selectedYear}`,
              month: selectedMonth,
              year: selectedYear,
              created_by: profile?.id!,
            })
            .select()
            .single();

          if (monthError) throw monthError;
          selectedMonthData = newMonth;
          setMonths([newMonth, ...monthsData]);
        }
      } else {
        // Crear primer mes
        const { data: newMonth, error: monthError } = await supabase
          .from('cashflow_months')
          .insert({
            tenant_id: tenantId!,
            name: `${getMonthName(selectedMonth)} ${selectedYear}`,
            month: selectedMonth,
            year: selectedYear,
            created_by: profile?.id!,
          })
          .select()
          .single();

        if (monthError) throw monthError;
        selectedMonthData = newMonth;
        setMonths([newMonth]);
      }
      
      setCurrentMonth(selectedMonthData);

      // Cargar categorías
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('cashflow_categories')
        .select('*')
        .eq('tenant_id', tenantId!)
        .order('category_type', { ascending: true })
        .order('display_order', { ascending: true });

      if (categoriesError) throw categoriesError;

      // Si no hay categorías, crear las básicas
      if (!categoriesData || categoriesData.length === 0) {
        await initializeDefaultCategories();
        // Recargar categorías
        const { data: reloadedCategories, error: reloadError } = await supabase
          .from('cashflow_categories')
          .select('*')
          .eq('tenant_id', tenantId!)
          .order('category_type', { ascending: true })
          .order('display_order', { ascending: true });

        if (reloadError) throw reloadError;
        categoriesData = reloadedCategories || [];
      }

      // Cargar sub-items
      const { data: subItemsData, error: subItemsError } = await supabase
        .from('cashflow_sub_items')
        .select('*')
        .eq('tenant_id', tenantId!)
        .order('display_order', { ascending: true });

      if (subItemsError) throw subItemsError;

      // Cargar valores
      const { data: valuesData, error: valuesError } = await supabase
        .from('cashflow_values')
        .select('*')
        .eq('tenant_id', tenantId!);

      if (valuesError) throw valuesError;
      setValues(valuesData || []);

      // Combinar categorías con sub-items y calcular totales
      const categoriesWithSubs: CategoryWithSubItems[] = (categoriesData || []).map(category => {
        const subItems = (subItemsData || []).filter(si => si.category_id === category.id);
        
        // Calcular total por día
        const total_by_day: Record<number, number> = {};
        daysOfMonth.forEach(day => {
          if (subItems.length > 0) {
            // Si tiene sub-items, sumar valores de sub-items
            total_by_day[day] = subItems.reduce((sum, subItem) => {
              const value = valuesData?.find(
                v => v.month_id === selectedMonthData?.id && v.sub_item_id === subItem.id && v.day_of_month === day
              );
              return sum + (value?.value || 0);
            }, 0);
          } else {
            // Si no tiene sub-items, usar valor directo de la categoría
            const categoryValue = valuesData?.find(
              v => v.month_id === selectedMonthData?.id && v.category_id === category.id && v.sub_item_id === null && v.day_of_month === day
            );
            total_by_day[day] = categoryValue?.value || 0;
          }
        });

        return {
          ...category,
          sub_items: subItems,
          total_by_day,
        };
      });

      setCategories(categoriesWithSubs);

    } catch (error: any) {
      setAlertModal({
        isOpen: true,
        title: 'Error',
        message: error.message || 'Error al cargar los datos',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  // Inicializar categorías por defecto
  const initializeDefaultCategories = async () => {
    const defaultCategories = [
      { name: 'Caja', type: 'disponibilidades' as const, order: 1 },
      { name: 'Banco 1', type: 'disponibilidades' as const, order: 2 },
      { name: 'Banco 2', type: 'disponibilidades' as const, order: 3 },
      { name: 'Cobros Clientes', type: 'ingresos' as const, order: 1 },
      { name: 'Cheques a Acreditarse', type: 'ingresos' as const, order: 2 },
      { name: 'Mercado Pago', type: 'ingresos' as const, order: 3 },
      { name: 'Tienda Nube', type: 'ingresos' as const, order: 4 },
      { name: 'Otros Ingresos', type: 'ingresos' as const, order: 5 },
      { name: 'Préstamos', type: 'ingresos' as const, order: 6 },
      { name: 'Cheques Emitidos', type: 'egresos' as const, order: 1 },
      { name: 'Proveedores', type: 'egresos' as const, order: 2 },
      { name: 'Honorarios y Comisiones', type: 'egresos' as const, order: 3 },
      { name: 'Sueldos', type: 'egresos' as const, order: 4 },
      { name: 'Impuestos a Pagar', type: 'egresos' as const, order: 5 },
      { name: 'Pagos por Caja', type: 'egresos' as const, order: 6 },
      { name: 'Servicios y Gastos Varios', type: 'egresos' as const, order: 7 },
      { name: 'Gastos Impositivos', type: 'egresos' as const, order: 8 },
      { name: 'Bancos y Transferencias', type: 'egresos' as const, order: 9 },
      { name: 'Seguros y ART', type: 'egresos' as const, order: 10 },
      { name: 'Créditos', type: 'egresos' as const, order: 11 },
    ];

    for (const cat of defaultCategories) {
      await supabase
        .from('cashflow_categories')
        .insert({
          tenant_id: tenantId!,
          name: cat.name,
          category_type: cat.type,
          display_order: cat.order,
        });
    }
  };

  // Agregar categoría directamente (desde el botón + del header)
  const handleAddCategoryDirectly = async (categoryType: 'disponibilidades' | 'ingresos' | 'egresos') => {
    try {
      const maxOrder = categories
        .filter(c => c.category_type === categoryType)
        .reduce((max, c) => Math.max(max, c.display_order), 0);

      const defaultNames = {
        disponibilidades: 'Nueva Disponibilidad',
        ingresos: 'Nuevo Ingreso',
        egresos: 'Nuevo Egreso'
      };

      // Generar un nombre único si ya existe una categoría con el nombre por defecto
      let categoryName = defaultNames[categoryType];
      const existingCategories = categories.filter(c => 
        c.category_type === categoryType && 
        c.name.toLowerCase().startsWith(defaultNames[categoryType].toLowerCase())
      );

      if (existingCategories.length > 0) {
        // Buscar el siguiente número disponible
        let counter = 2;
        while (existingCategories.some(c => 
          c.name.toLowerCase() === `${defaultNames[categoryType]} ${counter}`.toLowerCase()
        )) {
          counter++;
        }
        categoryName = `${defaultNames[categoryType]} ${counter}`;
      }

      const { data, error } = await supabase
        .from('cashflow_categories')
        .insert({
          tenant_id: tenantId!,
          name: categoryName,
          category_type: categoryType,
          display_order: maxOrder + 1,
        })
        .select()
        .single();

      if (error) {
        // Si el error es de restricción única, intentar con un nombre diferente
        if (error.code === '23505' || error.message.includes('unique constraint')) {
          // Intentar con un timestamp para hacer el nombre único
          const timestamp = Date.now();
          const uniqueName = `${defaultNames[categoryType]} ${timestamp}`;
          
          const { data: retryData, error: retryError } = await supabase
            .from('cashflow_categories')
            .insert({
              tenant_id: tenantId!,
              name: uniqueName,
              category_type: categoryType,
              display_order: maxOrder + 1,
            })
            .select()
            .single();

          if (retryError) throw retryError;

          await loadData();
          setEditingCategoryId(retryData.id);
          setEditingName(retryData.name);
          return;
        }
        throw error;
      }

      // Después de crear, ponerla en modo edición para que el usuario pueda cambiar el nombre
      await loadData();
      setEditingCategoryId(data.id);
      setEditingName(data.name);
    } catch (error: any) {
      setAlertModal({
        isOpen: true,
        title: 'Error',
        message: error.message || 'Error al crear categoría',
        type: 'error',
      });
    }
  };

  // Agregar categoría desde el modal
  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      setAlertModal({
        isOpen: true,
        title: 'Error',
        message: 'El nombre de la categoría no puede estar vacío',
        type: 'error',
      });
      return;
    }

    try {
      const maxOrder = categories
        .filter(c => c.category_type === newCategoryType)
        .reduce((max, c) => Math.max(max, c.display_order), 0);

      const { data, error } = await supabase
        .from('cashflow_categories')
        .insert({
          tenant_id: tenantId!,
          name: newCategoryName.trim(),
          category_type: newCategoryType,
          display_order: maxOrder + 1,
        })
        .select()
        .single();

      if (error) throw error;

      setAddingCategory(false);
      setNewCategoryName('');
      await loadData();
    } catch (error: any) {
      setAlertModal({
        isOpen: true,
        title: 'Error',
        message: error.message || 'Error al crear categoría',
        type: 'error',
      });
    }
  };

  // Actualizar nombre de categoría
  const handleUpdateCategoryName = async (categoryId: string, newName: string) => {
    if (!newName.trim()) {
      setEditingCategoryId(null);
      return;
    }

    try {
      const { error } = await supabase
        .from('cashflow_categories')
        .update({ name: newName.trim() })
        .eq('id', categoryId);

      if (error) throw error;

      setEditingCategoryId(null);
      await loadData();
    } catch (error: any) {
      setAlertModal({
        isOpen: true,
        title: 'Error',
        message: error.message || 'Error al actualizar categoría',
        type: 'error',
      });
    }
  };

  // Eliminar categoría
  const handleDeleteCategory = async (categoryId: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar esta categoría y todos sus sub-items?')) {
      return;
    }

    try {
      const category = categories.find(c => c.id === categoryId);
      
      // Eliminar valores asociados
      if (category) {
        for (const subItem of category.sub_items) {
          await supabase
            .from('cashflow_values')
            .delete()
            .eq('sub_item_id', subItem.id);
        }
      }

      // Eliminar sub-items
      await supabase
        .from('cashflow_sub_items')
        .delete()
        .eq('category_id', categoryId);

      // Eliminar categoría
      await supabase
        .from('cashflow_categories')
        .delete()
        .eq('id', categoryId);

      await loadData();
    } catch (error: any) {
      setAlertModal({
        isOpen: true,
        title: 'Error',
        message: error.message || 'Error al eliminar categoría',
        type: 'error',
      });
    }
  };

  // Agregar sub-item
  const handleAddSubItem = async (categoryId: string) => {
    if (!newSubItemName.trim()) {
      return;
    }

    try {
      const category = categories.find(c => c.id === categoryId);
      if (!category) {
        throw new Error('Categoría no encontrada');
      }

      // Verificar que no exista un sub-item con el mismo nombre en la misma categoría
      const existingSubItem = category.sub_items.find(si => 
        si.name.toLowerCase().trim() === newSubItemName.toLowerCase().trim()
      );

      if (existingSubItem) {
        setAlertModal({
          isOpen: true,
          title: 'Error',
          message: 'Ya existe un sub-item con ese nombre en esta categoría',
          type: 'error',
        });
        return;
      }

      // Verificar que el nombre no coincida con una categoría existente del mismo tipo
      const existingCategory = categories.find(c => 
        c.category_type === category.category_type &&
        c.name.toLowerCase().trim() === newSubItemName.toLowerCase().trim()
      );

      if (existingCategory) {
        setAlertModal({
          isOpen: true,
          title: 'Error',
          message: `El nombre "${newSubItemName.trim()}" ya existe como categoría. Por favor, usa un nombre diferente.`,
          type: 'error',
        });
        return;
      }

      const maxOrder = category.sub_items.length > 0
        ? Math.max(...category.sub_items.map(si => si.display_order))
        : 0;

      const { data: newSubItem, error } = await supabase
        .from('cashflow_sub_items')
        .insert({
          category_id: categoryId,
          tenant_id: tenantId!,
          name: newSubItemName.trim(),
          display_order: maxOrder + 1,
        })
        .select()
        .single();

      if (error) {
        // Si el error es de restricción única, dar un mensaje más claro
        if (error.code === '23505' || error.message.includes('unique constraint')) {
          if (error.message.includes('cashflow_categories')) {
            throw new Error(`El nombre "${newSubItemName.trim()}" ya existe como categoría. Por favor, usa un nombre diferente.`);
          }
          throw new Error('Ya existe un sub-item con ese nombre en esta categoría');
        }
        throw error;
      }

      setAddingSubItem(null);
      setNewSubItemName('');
      await loadData();
    } catch (error: any) {
      setAlertModal({
        isOpen: true,
        title: 'Error',
        message: error.message || 'Error al crear sub-item',
        type: 'error',
      });
    }
  };

  // Eliminar sub-item
  const handleDeleteSubItem = async (subItemId: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este sub-item?')) {
      return;
    }

    try {
      // Eliminar valores
      await supabase
        .from('cashflow_values')
        .delete()
        .eq('sub_item_id', subItemId);

      // Eliminar sub-item
      await supabase
        .from('cashflow_sub_items')
        .delete()
        .eq('id', subItemId);

      await loadData();
    } catch (error: any) {
      setAlertModal({
        isOpen: true,
        title: 'Error',
        message: error.message || 'Error al eliminar sub-item',
        type: 'error',
      });
    }
  };

  // Actualizar valor directamente en categoría (sin sub-items)
  const handleUpdateCategoryValue = async (categoryId: string, dayOfMonth: number, newValue: string) => {
    if (!currentMonth) return;

    try {
      const parsedValue = parseFormattedNumber(newValue || '0');

      // Buscar valor existente
      const existingValue = values.find(
        v => v.month_id === currentMonth.id && v.category_id === categoryId && v.sub_item_id === null && v.day_of_month === dayOfMonth
      );

      // Actualizar estado local
      let updatedValues: Value[];
      if (existingValue) {
        updatedValues = values.map(v => 
          v.id === existingValue.id 
            ? { ...v, value: parsedValue } 
            : v
        );
      } else {
        updatedValues = [...values, {
          id: `temp-${Date.now()}`,
          month_id: currentMonth.id,
          category_id: categoryId,
          sub_item_id: null,
          day_of_month: dayOfMonth,
          value: parsedValue,
        }];
      }
      setValues(updatedValues);

      // Recalcular totales localmente
      setCategories(prevCategories => {
        return prevCategories.map(category => {
          if (category.id !== categoryId) {
            return category;
          }

          const total_by_day: Record<number, number> = {};
          daysOfMonth.forEach(day => {
            // Si tiene sub-items, sumar sub-items, sino usar valor directo
            if (category.sub_items.length > 0) {
              total_by_day[day] = category.sub_items.reduce((sum, subItem) => {
                const val = updatedValues.find(
                  v => v.month_id === currentMonth.id && v.sub_item_id === subItem.id && v.day_of_month === day
                );
                return sum + (val?.value || 0);
              }, 0);
            } else {
              const val = updatedValues.find(
                v => v.month_id === currentMonth.id && v.category_id === categoryId && v.sub_item_id === null && v.day_of_month === day
              );
              total_by_day[day] = val?.value || 0;
            }
          });
          return { ...category, total_by_day };
        });
      });

      // Guardar en BD
      if (existingValue) {
        const { error } = await supabase
          .from('cashflow_values')
          .update({ value: parsedValue })
          .eq('id', existingValue.id);

        if (error) throw error;
      } else {
        const { data: newValue, error } = await supabase
          .from('cashflow_values')
          .insert({
            month_id: currentMonth.id,
            category_id: categoryId,
            sub_item_id: null,
            tenant_id: tenantId!,
            day_of_month: dayOfMonth,
            value: parsedValue,
          })
          .select()
          .single();

        if (error) throw error;
        
        setValues(updatedValues.map(v => 
          v.id?.startsWith('temp-') && v.category_id === categoryId && v.sub_item_id === null && v.day_of_month === dayOfMonth
            ? newValue
            : v
        ));
      }
    } catch (error: any) {
      await loadData();
      setAlertModal({
        isOpen: true,
        title: 'Error',
        message: error.message || 'Error al actualizar valor',
        type: 'error',
      });
    }
  };

  // Actualizar valor
  const handleUpdateValue = async (subItemId: string, dayOfMonth: number, newValue: string) => {
    if (!currentMonth) return;

    try {
      const parsedValue = parseFormattedNumber(newValue || '0');

      // Buscar valor existente
      const existingValue = values.find(
        v => v.month_id === currentMonth.id && v.sub_item_id === subItemId && v.day_of_month === dayOfMonth
      );

      // Actualizar estado local
      let updatedValues: Value[];
      if (existingValue) {
        updatedValues = values.map(v => 
          v.id === existingValue.id 
            ? { ...v, value: parsedValue } 
            : v
        );
      } else {
        updatedValues = [...values, {
          id: `temp-${Date.now()}`,
          month_id: currentMonth.id,
          sub_item_id: subItemId,
          day_of_month: dayOfMonth,
          value: parsedValue,
        }];
      }
      setValues(updatedValues);

      // Recalcular totales localmente
      setCategories(prevCategories => {
        return prevCategories.map(category => {
          const hasSubItem = category.sub_items.some(si => si.id === subItemId);
          if (!hasSubItem) {
            return category;
          }

          const total_by_day: Record<number, number> = {};
          daysOfMonth.forEach(day => {
            total_by_day[day] = category.sub_items.reduce((sum, subItem) => {
              const val = updatedValues.find(
                v => v.month_id === currentMonth.id && v.sub_item_id === subItem.id && v.day_of_month === day
              );
              return sum + (val?.value || 0);
            }, 0);
          });
          return { ...category, total_by_day };
        });
      });

      // Guardar en BD
      if (existingValue) {
        const { error } = await supabase
          .from('cashflow_values')
          .update({ value: parsedValue })
          .eq('id', existingValue.id);

        if (error) throw error;
      } else {
        const subItem = categories.flatMap(c => c.sub_items).find(si => si.id === subItemId);
        if (subItem) {
          const { data: newValue, error } = await supabase
            .from('cashflow_values')
            .insert({
              month_id: currentMonth.id,
              sub_item_id: subItemId,
              category_id: subItem.category_id,
              tenant_id: tenantId!,
              day_of_month: dayOfMonth,
              value: parsedValue,
            })
            .select()
            .single();

          if (error) throw error;
          
          setValues(updatedValues.map(v => 
            v.id?.startsWith('temp-') && v.sub_item_id === subItemId && v.day_of_month === dayOfMonth
              ? newValue
              : v
          ));
        }
      }
    } catch (error: any) {
      await loadData();
      setAlertModal({
        isOpen: true,
        title: 'Error',
        message: error.message || 'Error al actualizar valor',
        type: 'error',
      });
    }
  };

  // Cambiar mes
  const handleChangeMonth = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      if (selectedMonth === 1) {
        setSelectedMonth(12);
        setSelectedYear(selectedYear - 1);
      } else {
        setSelectedMonth(selectedMonth - 1);
      }
    } else {
      if (selectedMonth === 12) {
        setSelectedMonth(1);
        setSelectedYear(selectedYear + 1);
      } else {
        setSelectedMonth(selectedMonth + 1);
      }
    }
  };

  // Calcular disponibilidades totales por día
  const totalDisponibilidadesByDay = useMemo((): Record<number, number> => {
    const totals: Record<number, number> = {};
    daysOfMonth.forEach(day => {
      totals[day] = categories
        .filter(c => c.category_type === 'disponibilidades')
        .reduce((sum, cat) => sum + (cat.total_by_day[day] || 0), 0);
    });
    return totals;
  }, [categories, daysOfMonth]);

  // Calcular ingresos totales por día
  const totalIngresosByDay = useMemo((): Record<number, number> => {
    const totals: Record<number, number> = {};
    daysOfMonth.forEach(day => {
      totals[day] = categories
        .filter(c => c.category_type === 'ingresos')
        .reduce((sum, cat) => sum + (cat.total_by_day[day] || 0), 0);
    });
    return totals;
  }, [categories, daysOfMonth]);

  // Calcular egresos totales por día
  const totalEgresosByDay = useMemo((): Record<number, number> => {
    const totals: Record<number, number> = {};
    daysOfMonth.forEach(day => {
      totals[day] = categories
        .filter(c => c.category_type === 'egresos')
        .reduce((sum, cat) => sum + (cat.total_by_day[day] || 0), 0);
    });
    return totals;
  }, [categories, daysOfMonth]);

  // Calcular flujo de fondos por día (ingresos - egresos)
  const flujoFondosByDay = useMemo((): Record<number, number> => {
    const flujo: Record<number, number> = {};
    daysOfMonth.forEach(day => {
      flujo[day] = (totalIngresosByDay[day] || 0) - (totalEgresosByDay[day] || 0);
    });
    return flujo;
  }, [totalIngresosByDay, totalEgresosByDay, daysOfMonth]);

  // Calcular saldo final de caja por día (cada día es independiente: disponibilidades del día + flujo del día)
  const saldoFinalByDay = useMemo((): Record<number, number> => {
    const saldo: Record<number, number> = {};
    
    daysOfMonth.forEach(day => {
      // Cada día es independiente: Disponibilidades al inicio del día + Flujo de fondos del día
      const disponibilidadesDelDia = totalDisponibilidadesByDay[day] || 0;
      const flujoDelDia = flujoFondosByDay[day] || 0;
      saldo[day] = disponibilidadesDelDia + flujoDelDia;
    });
    return saldo;
  }, [totalDisponibilidadesByDay, flujoFondosByDay, daysOfMonth]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600 dark:text-gray-400">Cargando...</div>
      </div>
    );
  }

  if (!currentMonth) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600 dark:text-gray-400">No hay mes seleccionado</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Planificación Financiera</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Cash Flow mensual con disponibilidades, ingresos y egresos por día
          </p>
        </div>
      </div>

      {/* Selector de mes */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-4">
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => handleChangeMonth('prev')}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <div className="flex items-center gap-3">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                <option key={month} value={month}>
                  {getMonthName(month)}
                </option>
              ))}
            </select>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
            >
              {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 2 + i).map(year => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={() => handleChangeMonth('next')}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>
      </div>

      {/* Modal para agregar categoría */}
      {addingCategory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Agregar Nueva Categoría</h3>
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="Nombre de la categoría"
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white mb-4"
              autoFocus
            />
            <select
              value={newCategoryType}
              onChange={(e) => setNewCategoryType(e.target.value as 'disponibilidades' | 'ingresos' | 'egresos')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white mb-4"
            >
              <option value="disponibilidades">Disponibilidades</option>
              <option value="ingresos">Ingresos</option>
              <option value="egresos">Egresos</option>
            </select>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setAddingCategory(false);
                  setNewCategoryName('');
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-slate-600 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-500"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddCategory}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Crear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabla - Scroll horizontal y vertical para ver todos los días */}
      <div 
        className="bg-white dark:bg-slate-800 rounded-lg shadow-lg overflow-x-auto max-h-[calc(100vh-300px)] overflow-y-auto"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: '#64748b #1e293b',
        }}
      >
        <style>{`
          div::-webkit-scrollbar {
            width: 12px;
            height: 12px;
          }
          div::-webkit-scrollbar-track {
            background: #1e293b;
            border-radius: 6px;
          }
          div::-webkit-scrollbar-thumb {
            background: #64748b;
            border-radius: 6px;
            border: 2px solid #1e293b;
          }
          div::-webkit-scrollbar-thumb:hover {
            background: #475569;
          }
          div::-webkit-scrollbar-button {
            display: block;
            height: 12px;
            width: 12px;
            background: #1e293b;
          }
          div::-webkit-scrollbar-button:single-button:vertical:decrement {
            border-width: 0 4px 4px 4px;
            border-color: transparent transparent #94a3b8 transparent;
            border-style: solid;
          }
          div::-webkit-scrollbar-button:single-button:vertical:increment {
            border-width: 4px 4px 0 4px;
            border-color: #94a3b8 transparent transparent transparent;
            border-style: solid;
          }
          div::-webkit-scrollbar-button:single-button:horizontal:decrement {
            border-width: 4px 4px 4px 0;
            border-color: transparent #94a3b8 transparent transparent;
            border-style: solid;
          }
          div::-webkit-scrollbar-button:single-button:horizontal:increment {
            border-width: 4px 0 4px 4px;
            border-color: transparent transparent transparent #94a3b8;
            border-style: solid;
          }
        `}</style>
        <table className="w-full min-w-[2000px]">
          <thead className="sticky top-0 z-20 bg-white dark:bg-slate-800">
            <tr className="border-b-2 border-gray-200 dark:border-slate-700">
              <th className="text-left p-3 font-semibold text-gray-900 dark:text-white text-sm sticky left-0 bg-white dark:bg-slate-800 z-30 min-w-[200px]">
                Descripción/Día
              </th>
              {daysOfMonth.map(day => (
                <th key={day} className="text-center p-2 font-semibold text-gray-900 dark:text-white min-w-[80px] text-xs bg-white dark:bg-slate-800">
                  <div className="flex flex-col">
                    <span>{day}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 font-normal">
                      {getDayName(day, selectedMonth, selectedYear)}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* DISPONIBILIDADES */}
            <tr className="border-b-2 border-gray-300 dark:border-slate-600">
              <td className="p-2 bg-blue-50 dark:bg-blue-800 font-bold text-blue-900 dark:text-blue-300 sticky left-0 z-10 min-w-[400px] w-auto">
                <div className="flex items-center gap-2 whitespace-nowrap">
                  <span>DISPONIBILIDADES AL INICIO DEL DÍA</span>
                  <button
                    onClick={() => handleAddCategoryDirectly('disponibilidades')}
                    className="p-1.5 bg-green-600 hover:bg-green-700 text-white rounded transition-colors flex items-center justify-center flex-shrink-0"
                    title="Agregar categoría"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </td>
              {daysOfMonth.map(day => (
                <td key={day} className="p-2 bg-blue-50 dark:bg-blue-800 font-bold text-blue-900 dark:text-blue-300"></td>
              ))}
            </tr>
            {categories
              .filter(c => c.category_type === 'disponibilidades')
              .map(category => (
                <React.Fragment key={category.id}>
                  <tr className="border-b border-gray-200 dark:border-slate-700 bg-yellow-50 dark:bg-yellow-800">
                    <td className="p-3 sticky left-0 bg-yellow-50 dark:bg-yellow-800 z-10">
                      <div className="flex items-center gap-2">
                        {editingCategoryId === category.id ? (
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onBlur={() => handleUpdateCategoryName(category.id, editingName)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleUpdateCategoryName(category.id, editingName);
                              } else if (e.key === 'Escape') {
                                setEditingCategoryId(null);
                              }
                            }}
                            className="flex-1 px-2 py-1 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm font-semibold"
                            autoFocus
                          />
                        ) : (
                          <span 
                            className="font-semibold text-gray-900 dark:text-white flex-1 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400"
                            onClick={() => {
                              setEditingCategoryId(category.id);
                              setEditingName(category.name);
                            }}
                            title="Haz clic para editar"
                          >
                            {category.name}
                          </span>
                        )}
                        <button
                          onClick={() => handleDeleteCategory(category.id)}
                          className="p-1.5 bg-red-600 hover:bg-red-700 text-white rounded transition-colors flex items-center justify-center"
                          title="Eliminar categoría"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                    {daysOfMonth.map(day => {
                      const total = category.total_by_day[day] || 0;
                      const categoryValueKey = `${category.id}_${day}`;
                      const isEditing = editingCategoryValue[categoryValueKey] !== undefined;
                      const displayValue = isEditing 
                        ? editingCategoryValue[categoryValueKey]
                        : (total ? formatNumberForInput(total) : '');

                      // Si la categoría tiene sub-items, el valor es calculado y no se puede editar directamente
                      const canEditDirectly = category.sub_items.length === 0;

                      return (
                        <td 
                          key={day} 
                          className="text-right p-2 border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700/30"
                          onDoubleClick={() => {
                            if (canEditDirectly) {
                              setEditingCategoryValue(prev => ({
                                ...prev,
                                [categoryValueKey]: formatNumberForInput(total)
                              }));
                            }
                          }}
                        >
                          {isEditing && canEditDirectly ? (
                            <input
                              type="text"
                              inputMode="decimal"
                              value={displayValue}
                              onChange={(e) => {
                                const formattedValue = formatNumberWhileTyping(e.target.value);
                                setEditingCategoryValue(prev => ({
                                  ...prev,
                                  [categoryValueKey]: formattedValue
                                }));
                              }}
                              onBlur={async (e) => {
                                const inputValue = e.target.value.trim();
                                if (inputValue === '') {
                                  await handleUpdateCategoryValue(category.id, day, '0');
                                  setEditingCategoryValue(prev => {
                                    const newState = { ...prev };
                                    delete newState[categoryValueKey];
                                    return newState;
                                  });
                                } else {
                                  await handleUpdateCategoryValue(category.id, day, inputValue);
                                  setEditingCategoryValue(prev => {
                                    const newState = { ...prev };
                                    delete newState[categoryValueKey];
                                    return newState;
                                  });
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.currentTarget.blur();
                                } else if (e.key === 'Escape') {
                                  setEditingCategoryValue(prev => {
                                    const newState = { ...prev };
                                    delete newState[categoryValueKey];
                                    return newState;
                                  });
                                }
                              }}
                              className="w-full px-1 py-1 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-xs text-right font-bold"
                              autoFocus
                            />
                          ) : (
                            <div 
                              className={`font-bold text-sm text-green-600 dark:text-green-400 ${canEditDirectly ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700 rounded px-1' : ''}`}
                              title={canEditDirectly ? 'Doble clic para editar' : 'Valor calculado (edita los sub-items)'}
                            >
                              {formatNumber(total)}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                  {category.sub_items.map(subItem => (
                    <tr key={subItem.id} className="border-b border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700">
                      <td className="p-3 pl-8 sticky left-0 bg-white dark:bg-slate-800 z-10">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-700 dark:text-gray-300 text-sm">{subItem.name}</span>
                          <button
                            onClick={() => handleDeleteSubItem(subItem.id)}
                            className="text-red-600 hover:text-red-800 dark:text-red-400"
                            title="Eliminar sub-item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                      {daysOfMonth.map(day => {
                        const value = values.find(
                          v => v.month_id === currentMonth.id && v.sub_item_id === subItem.id && v.day_of_month === day
                        )?.value || 0;
                        const inputKey = `${subItem.id}_${day}`;
                        const displayValue = editingInputs[inputKey] !== undefined 
                          ? editingInputs[inputKey]
                          : (value ? formatNumberForInput(value) : '');

                        return (
                          <td key={day} className="text-right p-2 border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700/30">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={displayValue}
                              onChange={(e) => {
                                const formattedValue = formatNumberWhileTyping(e.target.value);
                                setEditingInputs(prev => ({
                                  ...prev,
                                  [inputKey]: formattedValue
                                }));
                              }}
                              onFocus={(e) => {
                                if (editingInputs[inputKey] === undefined && value !== undefined && value !== null) {
                                  const displayValue = formatNumberForInput(value);
                                  setEditingInputs(prev => ({
                                    ...prev,
                                    [inputKey]: displayValue
                                  }));
                                }
                              }}
                              onBlur={async (e) => {
                                const inputValue = e.target.value.trim();
                                if (inputValue === '') {
                                  await handleUpdateValue(subItem.id, day, '0');
                                  setEditingInputs(prev => {
                                    const newState = { ...prev };
                                    delete newState[inputKey];
                                    return newState;
                                  });
                                } else {
                                  await handleUpdateValue(subItem.id, day, inputValue);
                                  setEditingInputs(prev => ({
                                    ...prev,
                                    [inputKey]: inputValue
                                  }));
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.currentTarget.blur();
                                }
                              }}
                              className="w-full px-1 py-1 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-xs text-right"
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  {addingSubItem === category.id && (
                    <tr className="border-b border-gray-100 dark:border-slate-700 bg-blue-50 dark:bg-blue-800">
                      <td className="p-3 pl-8 sticky left-0 bg-blue-50 dark:bg-blue-800 z-10">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="Nombre del sub-item"
                            value={newSubItemName}
                            onChange={(e) => setNewSubItemName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleAddSubItem(category.id);
                              } else if (e.key === 'Escape') {
                                setAddingSubItem(null);
                                setNewSubItemName('');
                              }
                            }}
                            className="flex-1 px-2 py-1 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm"
                            autoFocus
                          />
                          <button
                            onClick={() => {
                              setAddingSubItem(null);
                              setNewSubItemName('');
                            }}
                            className="text-red-600 hover:text-red-800 dark:text-red-400"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                      {daysOfMonth.map(day => (
                        <td key={day} className="p-2"></td>
                      ))}
                    </tr>
                  )}
                </React.Fragment>
              ))}
            <tr className="border-b-2 border-gray-300 dark:border-slate-600 bg-green-50 dark:bg-green-800">
              <td className="p-3 sticky left-0 bg-green-50 dark:bg-green-800 z-10 font-bold text-green-900 dark:text-green-300">
                TOTAL DISPONIBILIDADES
              </td>
              {daysOfMonth.map(day => (
                <td key={day} className="text-right p-2 font-bold text-green-700 dark:text-green-400 text-sm border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700/30">
                  {formatNumber(totalDisponibilidadesByDay[day] || 0)}
                </td>
              ))}
            </tr>

            {/* INGRESOS */}
            <tr className="border-b-2 border-gray-300 dark:border-slate-600">
              <td className="p-2 bg-green-50 dark:bg-green-800 font-bold text-green-900 dark:text-green-300 sticky left-0 z-10 min-w-[400px] w-auto">
                <div className="flex items-center gap-2 whitespace-nowrap">
                  <span>DISPONIBILIDADES (INGRESOS CORTO PLAZO)</span>
                  <button
                    onClick={() => handleAddCategoryDirectly('ingresos')}
                    className="p-1.5 bg-green-600 hover:bg-green-700 text-white rounded transition-colors flex items-center justify-center flex-shrink-0"
                    title="Agregar categoría"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </td>
              {daysOfMonth.map(day => (
                <td key={day} className="p-2 bg-green-50 dark:bg-green-800 font-bold text-green-900 dark:text-green-300"></td>
              ))}
            </tr>
            {categories
              .filter(c => c.category_type === 'ingresos')
              .map(category => (
                <React.Fragment key={category.id}>
                  <tr className="border-b border-gray-200 dark:border-slate-700 bg-yellow-50 dark:bg-yellow-800">
                    <td className="p-3 sticky left-0 bg-yellow-50 dark:bg-yellow-800 z-10">
                      <div className="flex items-center gap-2">
                        {editingCategoryId === category.id ? (
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onBlur={() => handleUpdateCategoryName(category.id, editingName)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleUpdateCategoryName(category.id, editingName);
                              } else if (e.key === 'Escape') {
                                setEditingCategoryId(null);
                              }
                            }}
                            className="flex-1 px-2 py-1 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm font-semibold"
                            autoFocus
                          />
                        ) : (
                          <span 
                            className="font-semibold text-gray-900 dark:text-white flex-1 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400"
                            onClick={() => {
                              setEditingCategoryId(category.id);
                              setEditingName(category.name);
                            }}
                            title="Haz clic para editar"
                          >
                            {category.name}
                          </span>
                        )}
                        <button
                          onClick={() => handleDeleteCategory(category.id)}
                          className="p-1.5 bg-red-600 hover:bg-red-700 text-white rounded transition-colors flex items-center justify-center"
                          title="Eliminar categoría"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                    {daysOfMonth.map(day => {
                      const total = category.total_by_day[day] || 0;
                      const categoryValueKey = `${category.id}_${day}`;
                      const isEditing = editingCategoryValue[categoryValueKey] !== undefined;
                      const displayValue = isEditing 
                        ? editingCategoryValue[categoryValueKey]
                        : (total ? formatNumberForInput(total) : '');

                      // Si la categoría tiene sub-items, el valor es calculado y no se puede editar directamente
                      const canEditDirectly = category.sub_items.length === 0;

                      return (
                        <td 
                          key={day} 
                          className="text-right p-2 border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700/30"
                          onDoubleClick={() => {
                            if (canEditDirectly) {
                              setEditingCategoryValue(prev => ({
                                ...prev,
                                [categoryValueKey]: formatNumberForInput(total)
                              }));
                            }
                          }}
                        >
                          {isEditing && canEditDirectly ? (
                            <input
                              type="text"
                              inputMode="decimal"
                              value={displayValue}
                              onChange={(e) => {
                                const formattedValue = formatNumberWhileTyping(e.target.value);
                                setEditingCategoryValue(prev => ({
                                  ...prev,
                                  [categoryValueKey]: formattedValue
                                }));
                              }}
                              onBlur={async (e) => {
                                const inputValue = e.target.value.trim();
                                if (inputValue === '') {
                                  await handleUpdateCategoryValue(category.id, day, '0');
                                  setEditingCategoryValue(prev => {
                                    const newState = { ...prev };
                                    delete newState[categoryValueKey];
                                    return newState;
                                  });
                                } else {
                                  await handleUpdateCategoryValue(category.id, day, inputValue);
                                  setEditingCategoryValue(prev => {
                                    const newState = { ...prev };
                                    delete newState[categoryValueKey];
                                    return newState;
                                  });
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.currentTarget.blur();
                                } else if (e.key === 'Escape') {
                                  setEditingCategoryValue(prev => {
                                    const newState = { ...prev };
                                    delete newState[categoryValueKey];
                                    return newState;
                                  });
                                }
                              }}
                              className="w-full px-1 py-1 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-xs text-right font-bold"
                              autoFocus
                            />
                          ) : (
                            <div 
                              className={`font-bold text-sm text-green-600 dark:text-green-400 ${canEditDirectly ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700 rounded px-1' : ''}`}
                              title={canEditDirectly ? 'Doble clic para editar' : 'Valor calculado (edita los sub-items)'}
                            >
                              {formatNumber(total)}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                  {category.sub_items.map(subItem => (
                    <tr key={subItem.id} className="border-b border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700">
                      <td className="p-3 pl-8 sticky left-0 bg-white dark:bg-slate-800 z-10">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-700 dark:text-gray-300 text-sm">{subItem.name}</span>
                          <button
                            onClick={() => handleDeleteSubItem(subItem.id)}
                            className="text-red-600 hover:text-red-800 dark:text-red-400"
                            title="Eliminar sub-item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                      {daysOfMonth.map(day => {
                        const value = values.find(
                          v => v.month_id === currentMonth.id && v.sub_item_id === subItem.id && v.day_of_month === day
                        )?.value || 0;
                        const inputKey = `${subItem.id}_${day}`;
                        const displayValue = editingInputs[inputKey] !== undefined 
                          ? editingInputs[inputKey]
                          : (value ? formatNumberForInput(value) : '');

                        return (
                          <td key={day} className="text-right p-2 border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700/30">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={displayValue}
                              onChange={(e) => {
                                const formattedValue = formatNumberWhileTyping(e.target.value);
                                setEditingInputs(prev => ({
                                  ...prev,
                                  [inputKey]: formattedValue
                                }));
                              }}
                              onFocus={(e) => {
                                if (editingInputs[inputKey] === undefined && value !== undefined && value !== null) {
                                  const displayValue = formatNumberForInput(value);
                                  setEditingInputs(prev => ({
                                    ...prev,
                                    [inputKey]: displayValue
                                  }));
                                }
                              }}
                              onBlur={async (e) => {
                                const inputValue = e.target.value.trim();
                                if (inputValue === '') {
                                  await handleUpdateValue(subItem.id, day, '0');
                                  setEditingInputs(prev => {
                                    const newState = { ...prev };
                                    delete newState[inputKey];
                                    return newState;
                                  });
                                } else {
                                  await handleUpdateValue(subItem.id, day, inputValue);
                                  setEditingInputs(prev => ({
                                    ...prev,
                                    [inputKey]: inputValue
                                  }));
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.currentTarget.blur();
                                }
                              }}
                              className="w-full px-1 py-1 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-xs text-right"
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  {addingSubItem === category.id && (
                    <tr className="border-b border-gray-100 dark:border-slate-700 bg-blue-50 dark:bg-blue-800">
                      <td className="p-3 pl-8 sticky left-0 bg-blue-50 dark:bg-blue-800 z-10">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="Nombre del sub-item"
                            value={newSubItemName}
                            onChange={(e) => setNewSubItemName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleAddSubItem(category.id);
                              } else if (e.key === 'Escape') {
                                setAddingSubItem(null);
                                setNewSubItemName('');
                              }
                            }}
                            className="flex-1 px-2 py-1 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm"
                            autoFocus
                          />
                          <button
                            onClick={() => {
                              setAddingSubItem(null);
                              setNewSubItemName('');
                            }}
                            className="text-red-600 hover:text-red-800 dark:text-red-400"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                      {daysOfMonth.map(day => (
                        <td key={day} className="p-2"></td>
                      ))}
                    </tr>
                  )}
                </React.Fragment>
              ))}
            <tr className="border-b-2 border-gray-300 dark:border-slate-600 bg-green-50 dark:bg-green-800">
              <td className="p-3 sticky left-0 bg-green-50 dark:bg-green-800 z-10 font-bold text-green-900 dark:text-green-300">
                TOTAL DE INGRESOS DIARIOS
              </td>
              {daysOfMonth.map(day => (
                <td key={day} className="text-right p-2 font-bold text-green-700 dark:text-green-400 text-sm border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700/30">
                  {formatNumber(totalIngresosByDay[day] || 0)}
                </td>
              ))}
            </tr>

            {/* EGRESOS */}
            <tr className="border-b-2 border-gray-300 dark:border-slate-600">
              <td className="p-2 bg-red-50 dark:bg-red-800 font-bold text-red-900 dark:text-red-300 sticky left-0 z-10 min-w-[400px] w-auto">
                <div className="flex items-center gap-2 whitespace-nowrap">
                  <span>EGRESOS CORRIENTES</span>
                  <button
                    onClick={() => handleAddCategoryDirectly('egresos')}
                    className="p-1.5 bg-green-600 hover:bg-green-700 text-white rounded transition-colors flex items-center justify-center flex-shrink-0"
                    title="Agregar categoría"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </td>
              {daysOfMonth.map(day => (
                <td key={day} className="p-2 bg-red-50 dark:bg-red-800 font-bold text-red-900 dark:text-red-300"></td>
              ))}
            </tr>
            {categories
              .filter(c => c.category_type === 'egresos')
              .map(category => (
                <React.Fragment key={category.id}>
                  <tr className="border-b border-gray-200 dark:border-slate-700 bg-yellow-50 dark:bg-yellow-800">
                    <td className="p-3 sticky left-0 bg-yellow-50 dark:bg-yellow-800 z-10">
                      <div className="flex items-center gap-2">
                        {editingCategoryId === category.id ? (
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onBlur={() => handleUpdateCategoryName(category.id, editingName)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleUpdateCategoryName(category.id, editingName);
                              } else if (e.key === 'Escape') {
                                setEditingCategoryId(null);
                              }
                            }}
                            className="flex-1 px-2 py-1 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm font-semibold"
                            autoFocus
                          />
                        ) : (
                          <span 
                            className="font-semibold text-gray-900 dark:text-white flex-1 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400"
                            onClick={() => {
                              setEditingCategoryId(category.id);
                              setEditingName(category.name);
                            }}
                            title="Haz clic para editar"
                          >
                            {category.name}
                          </span>
                        )}
                        <button
                          onClick={() => handleDeleteCategory(category.id)}
                          className="p-1.5 bg-red-600 hover:bg-red-700 text-white rounded transition-colors flex items-center justify-center"
                          title="Eliminar categoría"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                    {daysOfMonth.map(day => {
                      const total = category.total_by_day[day] || 0;
                      const categoryValueKey = `${category.id}_${day}`;
                      const isEditing = editingCategoryValue[categoryValueKey] !== undefined;
                      const displayValue = isEditing 
                        ? editingCategoryValue[categoryValueKey]
                        : (total ? formatNumberForInput(total) : '');

                      // Si la categoría tiene sub-items, el valor es calculado y no se puede editar directamente
                      const canEditDirectly = category.sub_items.length === 0;

                      return (
                        <td 
                          key={day} 
                          className="text-right p-2 border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700/30"
                          onDoubleClick={() => {
                            if (canEditDirectly) {
                              setEditingCategoryValue(prev => ({
                                ...prev,
                                [categoryValueKey]: formatNumberForInput(total)
                              }));
                            }
                          }}
                        >
                          {isEditing && canEditDirectly ? (
                            <input
                              type="text"
                              inputMode="decimal"
                              value={displayValue}
                              onChange={(e) => {
                                const formattedValue = formatNumberWhileTyping(e.target.value);
                                setEditingCategoryValue(prev => ({
                                  ...prev,
                                  [categoryValueKey]: formattedValue
                                }));
                              }}
                              onBlur={async (e) => {
                                const inputValue = e.target.value.trim();
                                if (inputValue === '') {
                                  await handleUpdateCategoryValue(category.id, day, '0');
                                  setEditingCategoryValue(prev => {
                                    const newState = { ...prev };
                                    delete newState[categoryValueKey];
                                    return newState;
                                  });
                                } else {
                                  await handleUpdateCategoryValue(category.id, day, inputValue);
                                  setEditingCategoryValue(prev => {
                                    const newState = { ...prev };
                                    delete newState[categoryValueKey];
                                    return newState;
                                  });
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.currentTarget.blur();
                                } else if (e.key === 'Escape') {
                                  setEditingCategoryValue(prev => {
                                    const newState = { ...prev };
                                    delete newState[categoryValueKey];
                                    return newState;
                                  });
                                }
                              }}
                              className="w-full px-1 py-1 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-xs text-right font-bold"
                              autoFocus
                            />
                          ) : (
                            <div 
                              className={`font-bold text-sm text-red-600 dark:text-red-400 ${canEditDirectly ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700 rounded px-1' : ''}`}
                              title={canEditDirectly ? 'Doble clic para editar' : 'Valor calculado (edita los sub-items)'}
                            >
                              {formatNumber(total)}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                  {category.sub_items.map(subItem => (
                    <tr key={subItem.id} className="border-b border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700">
                      <td className="p-3 pl-8 sticky left-0 bg-white dark:bg-slate-800 z-10">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-700 dark:text-gray-300 text-sm">{subItem.name}</span>
                          <button
                            onClick={() => handleDeleteSubItem(subItem.id)}
                            className="text-red-600 hover:text-red-800 dark:text-red-400"
                            title="Eliminar sub-item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                      {daysOfMonth.map(day => {
                        const value = values.find(
                          v => v.month_id === currentMonth.id && v.sub_item_id === subItem.id && v.day_of_month === day
                        )?.value || 0;
                        const inputKey = `${subItem.id}_${day}`;
                        const displayValue = editingInputs[inputKey] !== undefined 
                          ? editingInputs[inputKey]
                          : (value ? formatNumberForInput(value) : '');

                        return (
                          <td key={day} className="text-right p-2 border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700/30">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={displayValue}
                              onChange={(e) => {
                                const formattedValue = formatNumberWhileTyping(e.target.value);
                                setEditingInputs(prev => ({
                                  ...prev,
                                  [inputKey]: formattedValue
                                }));
                              }}
                              onFocus={(e) => {
                                if (editingInputs[inputKey] === undefined && value !== undefined && value !== null) {
                                  const displayValue = formatNumberForInput(value);
                                  setEditingInputs(prev => ({
                                    ...prev,
                                    [inputKey]: displayValue
                                  }));
                                }
                              }}
                              onBlur={async (e) => {
                                const inputValue = e.target.value.trim();
                                if (inputValue === '') {
                                  await handleUpdateValue(subItem.id, day, '0');
                                  setEditingInputs(prev => {
                                    const newState = { ...prev };
                                    delete newState[inputKey];
                                    return newState;
                                  });
                                } else {
                                  await handleUpdateValue(subItem.id, day, inputValue);
                                  setEditingInputs(prev => ({
                                    ...prev,
                                    [inputKey]: inputValue
                                  }));
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.currentTarget.blur();
                                }
                              }}
                              className="w-full px-1 py-1 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-xs text-right"
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  {addingSubItem === category.id && (
                    <tr className="border-b border-gray-100 dark:border-slate-700 bg-blue-50 dark:bg-blue-800">
                      <td className="p-3 pl-8 sticky left-0 bg-blue-50 dark:bg-blue-800 z-10">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="Nombre del sub-item"
                            value={newSubItemName}
                            onChange={(e) => setNewSubItemName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleAddSubItem(category.id);
                              } else if (e.key === 'Escape') {
                                setAddingSubItem(null);
                                setNewSubItemName('');
                              }
                            }}
                            className="flex-1 px-2 py-1 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm"
                            autoFocus
                          />
                          <button
                            onClick={() => {
                              setAddingSubItem(null);
                              setNewSubItemName('');
                            }}
                            className="text-red-600 hover:text-red-800 dark:text-red-400"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                      {daysOfMonth.map(day => (
                        <td key={day} className="p-2"></td>
                      ))}
                    </tr>
                  )}
                </React.Fragment>
              ))}
            <tr className="border-b-2 border-gray-300 dark:border-slate-600 bg-red-50 dark:bg-red-800">
              <td className="p-3 sticky left-0 bg-red-50 dark:bg-red-800 z-10 font-bold text-red-900 dark:text-red-300">
                Total EGRESOS Corriente
              </td>
              {daysOfMonth.map(day => (
                <td key={day} className="text-right p-2 font-bold text-red-700 dark:text-red-400 text-sm border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700/30">
                  {formatNumber(totalEgresosByDay[day] || 0)}
                </td>
              ))}
            </tr>

            {/* FLUJO DE FONDOS */}
            <tr className="border-b-2 border-gray-300 dark:border-slate-600 bg-blue-50 dark:bg-blue-800">
              <td className="p-3 sticky left-0 bg-blue-50 dark:bg-blue-800 z-10 font-bold text-blue-900 dark:text-blue-300">
                FLUJO DE FONDOS
              </td>
              {daysOfMonth.map(day => {
                const flujo = flujoFondosByDay[day] || 0;
                return (
                  <td key={day} className="text-right p-2 font-bold text-sm border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700/30">
                    <span className={flujo >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                      {formatNumber(flujo)}
                    </span>
                  </td>
                );
              })}
            </tr>

            {/* SALDO FINAL DE CAJA */}
            <tr className="border-b-2 border-gray-300 dark:border-slate-600 bg-purple-50 dark:bg-purple-800">
              <td className="p-3 sticky left-0 bg-purple-50 dark:bg-purple-800 z-10 font-bold text-purple-900 dark:text-purple-300">
                SALDO FINAL DE CAJA
              </td>
              {daysOfMonth.map(day => {
                const saldo = saldoFinalByDay[day] || 0;
                return (
                  <td key={day} className="text-right p-2 font-bold text-sm border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700/30">
                    <span className={saldo >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                      {formatNumber(saldo)}
                    </span>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {categories.length === 0 && (
        <div className="text-center py-12 text-gray-600 dark:text-gray-400">
          <p>No hay categorías registradas. Haz clic en el botón "+" de las secciones para agregar categorías.</p>
        </div>
      )}

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
