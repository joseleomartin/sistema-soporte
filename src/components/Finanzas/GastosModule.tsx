/**
 * Módulo de Gastos
 * Basado en la lógica de CashFlow pero adaptado para gastos mensuales
 * Categorías con sub-items y valores por mes
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../contexts/TenantContext';
import { useAuth } from '../../contexts/AuthContext';
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

const MONTHS = [
  { num: 1, name: 'Ene', fullName: 'Enero' },
  { num: 2, name: 'Feb', fullName: 'Febrero' },
  { num: 3, name: 'Mar', fullName: 'Marzo' },
  { num: 4, name: 'Abr', fullName: 'Abril' },
  { num: 5, name: 'May', fullName: 'Mayo' },
  { num: 6, name: 'Jun', fullName: 'Junio' },
  { num: 7, name: 'Jul', fullName: 'Julio' },
  { num: 8, name: 'Ago', fullName: 'Agosto' },
  { num: 9, name: 'Sep', fullName: 'Septiembre' },
  { num: 10, name: 'Oct', fullName: 'Octubre' },
  { num: 11, name: 'Nov', fullName: 'Noviembre' },
  { num: 12, name: 'Dic', fullName: 'Diciembre' },
];

// Tipos
type Category = {
  id: string;
  name: string;
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
  concept_id: string;
  month: number;
  year: number;
  value: number;
};

interface CategoryWithSubItems extends Category {
  sub_items: SubItem[];
  total_by_month: Record<number, number>;
}

export function GastosModule() {
  const { tenant } = useTenant();
  const { profile } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<CategoryWithSubItems[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [values, setValues] = useState<Value[]>([]);
  const [editingInputs, setEditingInputs] = useState<Record<string, string>>({});
  const [editingCategoryValue, setEditingCategoryValue] = useState<Record<string, string>>({});
  
  // Estados para agregar categorías y sub-items
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

  // Inicializar categorías por defecto si no existen
  const initializeDefaultCategories = async () => {
    if (!tenant?.id) return;

    try {
      const defaultCategories = [
        { name: 'COGS', order: 1 },
        { name: 'SERVICIOS', order: 2 },
        { name: 'INFRAESTRUCTURA', order: 3 },
        { name: 'COMERCIAL', order: 4 },
      ];

      // Verificar todas las categorías existentes de una vez (sin .single() para evitar 406)
      const { data: existingCategories, error: checkError } = await supabase
        .from('gastos_categories')
        .select('name')
        .eq('tenant_id', tenant.id);

      // Si hay error al verificar, no continuar
      if (checkError) {
        console.error('Error verificando categorías existentes:', checkError);
        return;
      }

      const existingNames = new Set((existingCategories || []).map(c => c.name.toUpperCase()));

      // Insertar solo las que no existen
      const categoriesToInsert = defaultCategories.filter(
        cat => !existingNames.has(cat.name.toUpperCase())
      );

      if (categoriesToInsert.length > 0) {
        // Insertar todas en un solo batch
        const { error } = await supabase
          .from('gastos_categories')
          .insert(
            categoriesToInsert.map(cat => ({
              tenant_id: tenant.id,
              name: cat.name,
              display_order: cat.order,
            }))
          );

        // Ignorar errores de restricción única (23505) - significa que ya existe
        if (error && error.code !== '23505') {
          console.error('Error inicializando categorías:', error);
        }
      }
    } catch (error) {
      // Ignorar errores silenciosamente para evitar problemas en la primera carga
      console.error('Error en initializeDefaultCategories:', error);
    }
  };

  // Cargar datos
  useEffect(() => {
    if (tenant?.id) {
      loadData();
    }
  }, [tenant?.id, selectedYear]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Cargar categorías
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('gastos_categories')
        .select('*')
        .eq('tenant_id', tenant!.id)
        .order('display_order', { ascending: true });

      if (categoriesError) throw categoriesError;

      // Si no hay categorías, crear las básicas
      if (!categoriesData || categoriesData.length === 0) {
        await initializeDefaultCategories();
        // Esperar un momento para que se completen las inserciones
        await new Promise(resolve => setTimeout(resolve, 300));
        // Recargar categorías
        const { data: reloadedCategories, error: reloadError } = await supabase
          .from('gastos_categories')
          .select('*')
          .eq('tenant_id', tenant!.id)
          .order('display_order', { ascending: true });

        if (reloadError) {
          // Si hay error, intentar una vez más después de otro delay
          await new Promise(resolve => setTimeout(resolve, 500));
          const { data: retryCategories, error: retryError } = await supabase
            .from('gastos_categories')
            .select('*')
            .eq('tenant_id', tenant!.id)
            .order('display_order', { ascending: true });
          
          if (retryError) {
            console.error('Error recargando categorías después de reintento:', retryError);
            // Continuar con datos vacíos en lugar de lanzar error
            categoriesData = [];
          } else {
            categoriesData = retryCategories || [];
          }
        } else {
          categoriesData = reloadedCategories || [];
        }
      }

      // Cargar sub-items (conceptos en gastos)
      const { data: subItemsData, error: subItemsError } = await supabase
        .from('gastos_concepts')
        .select('*')
        .eq('tenant_id', tenant!.id)
        .order('display_order', { ascending: true });

      if (subItemsError) throw subItemsError;

      // Cargar valores
      const { data: valuesData, error: valuesError } = await supabase
        .from('gastos_values')
        .select('*')
        .eq('tenant_id', tenant!.id)
        .eq('year', selectedYear);

      if (valuesError) throw valuesError;
      setValues(valuesData || []);

      // Combinar categorías con sub-items y calcular totales
      const categoriesWithSubs: CategoryWithSubItems[] = (categoriesData || []).map(category => {
        const subItems = (subItemsData || []).filter(si => si.category_id === category.id);
        
        // Calcular total por mes
        const total_by_month: Record<number, number> = {};
        MONTHS.forEach(month => {
          if (subItems.length > 0) {
            // Si tiene sub-items, sumar valores de sub-items
            total_by_month[month.num] = subItems.reduce((sum, subItem) => {
              const value = valuesData?.find(
                v => v.concept_id === subItem.id && v.month === month.num && v.year === selectedYear
              );
              return sum + (value?.value || 0);
            }, 0);
          } else {
            // Si no tiene sub-items, usar valor directo de la categoría (no implementado aún)
            total_by_month[month.num] = 0;
          }
        });

        return {
          ...category,
          sub_items: subItems,
          total_by_month,
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

  // Agregar categoría directamente
  const handleAddCategoryDirectly = async () => {
    if (!tenant?.id) return;

    try {
      const maxOrder = categories.length > 0 
        ? Math.max(...categories.map(c => c.display_order))
        : 0;

      // Generar un nombre único
      let categoryName = 'Nueva Categoría';
      const existingCategories = categories.filter(c => 
        c.name.toLowerCase().startsWith('nueva categoría')
      );

      if (existingCategories.length > 0) {
        let counter = 2;
        while (existingCategories.some(c => 
          c.name.toLowerCase() === `nueva categoría ${counter}`.toLowerCase()
        )) {
          counter++;
        }
        categoryName = `Nueva Categoría ${counter}`;
      }

      const { data, error } = await supabase
        .from('gastos_categories')
        .insert({
          tenant_id: tenant.id,
          name: categoryName,
          display_order: maxOrder + 1,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505' || error.message.includes('unique constraint')) {
          const timestamp = Date.now();
          const uniqueName = `Nueva Categoría ${timestamp}`;
          
          const { data: retryData, error: retryError } = await supabase
            .from('gastos_categories')
            .insert({
              tenant_id: tenant.id,
              name: uniqueName,
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

  // Actualizar nombre de categoría
  const handleUpdateCategoryName = async (categoryId: string, newName: string) => {
    if (!newName.trim()) {
      setEditingCategoryId(null);
      return;
    }

    try {
      const { error } = await supabase
        .from('gastos_categories')
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
      const { error } = await supabase
        .from('gastos_categories')
        .delete()
        .eq('id', categoryId);

      if (error) throw error;

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
    if (!newSubItemName.trim() || !tenant?.id) {
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

      const maxOrder = category.sub_items.length > 0
        ? Math.max(...category.sub_items.map(si => si.display_order))
        : 0;

      const { data: newSubItem, error } = await supabase
        .from('gastos_concepts')
        .insert({
          category_id: categoryId,
          tenant_id: tenant.id,
          name: newSubItemName.trim(),
          display_order: maxOrder + 1,
        })
        .select()
        .single();

      if (error) throw error;

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

  // Actualizar nombre de sub-item
  const handleUpdateSubItemName = async (subItemId: string, newName: string) => {
    if (!newName.trim()) {
      setEditingSubItemId(null);
      return;
    }

    try {
      const { error } = await supabase
        .from('gastos_concepts')
        .update({ name: newName.trim() })
        .eq('id', subItemId);

      if (error) throw error;

      setEditingSubItemId(null);
      await loadData();
    } catch (error: any) {
      setAlertModal({
        isOpen: true,
        title: 'Error',
        message: error.message || 'Error al actualizar sub-item',
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
        .from('gastos_values')
        .delete()
        .eq('concept_id', subItemId);

      // Eliminar sub-item
      const { error } = await supabase
        .from('gastos_concepts')
        .delete()
        .eq('id', subItemId);

      if (error) throw error;

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

  // Actualizar valor
  const handleUpdateValue = async (subItemId: string, month: number, newValue: string) => {
    if (!tenant?.id) return;

    try {
      const parsedValue = parseFormattedNumber(newValue || '0');

      // Buscar valor existente
      const existingValue = values.find(
        v => v.concept_id === subItemId && v.month === month && v.year === selectedYear
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
        const subItem = categories.flatMap(c => c.sub_items).find(si => si.id === subItemId);
        updatedValues = [...values, {
          id: `temp-${Date.now()}`,
          concept_id: subItemId,
          month,
          year: selectedYear,
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

          const total_by_month: Record<number, number> = {};
          MONTHS.forEach(m => {
            total_by_month[m.num] = category.sub_items.reduce((sum, subItem) => {
              const val = updatedValues.find(
                v => v.concept_id === subItem.id && v.month === m.num && v.year === selectedYear
              );
              return sum + (val?.value || 0);
            }, 0);
          });
          return { ...category, total_by_month };
        });
      });

      // Guardar en BD
      if (existingValue) {
        const { error } = await supabase
          .from('gastos_values')
          .update({ value: parsedValue })
          .eq('id', existingValue.id);

        if (error) throw error;
      } else {
        const subItem = categories.flatMap(c => c.sub_items).find(si => si.id === subItemId);
        if (subItem) {
          const category = categories.find(c => c.sub_items.some(si => si.id === subItemId));
          const { data: newValue, error } = await supabase
            .from('gastos_values')
            .insert({
              concept_id: subItemId,
              tenant_id: tenant.id,
              month,
              year: selectedYear,
              value: parsedValue,
              category_id: category?.id || null,
              sub_category_id: null,
            })
            .select()
            .single();

          if (error) throw error;
          
          setValues(updatedValues.map(v => 
            v.id?.startsWith('temp-') && v.concept_id === subItemId && v.month === month
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

  // Calcular total general por mes
  const totalsByMonth = useMemo(() => {
    const totals: Record<number, number> = {};
    MONTHS.forEach(month => {
      totals[month.num] = categories.reduce((sum, category) => {
        return sum + (category.total_by_month[month.num] || 0);
      }, 0);
    });
    return totals;
  }, [categories]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Cargando gastos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-2 sm:space-y-3">
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-3 -mx-3 sm:-mx-4 md:-mx-6 -mt-3 sm:-mt-4 md:-mt-6 mb-2 sm:mb-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">Gastos</h1>
        
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Año:
          </label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
          >
            {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i).map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
          
          <button
            onClick={handleAddCategoryDirectly}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Agregar Categoría
          </button>
        </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg overflow-x-auto">
        <table className="w-full min-w-[1200px]">
          <thead>
            <tr className="border-b-2 border-gray-200 dark:border-slate-700">
              <th className="text-left p-3 font-semibold text-gray-900 dark:text-white text-sm sticky left-0 bg-white dark:bg-slate-800 z-10 min-w-[200px]">
                Descripción/Mes
              </th>
              {MONTHS.map(month => (
                <th
                  key={month.num}
                  className="text-center p-2 font-semibold text-gray-900 dark:text-white min-w-[80px] text-xs"
                >
                  {month.name}
                </th>
              ))}
              <th className="text-center p-3 font-semibold text-gray-900 dark:text-white min-w-[120px]">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {categories.map(category => (
              <React.Fragment key={category.id}>
                {/* Header de categoría */}
                <tr className="border-b-2 border-gray-300 dark:border-slate-600">
                  <td className="p-2 bg-blue-50 dark:bg-blue-900/20 font-bold text-blue-900 dark:text-blue-300 sticky left-0 z-10">
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
                        <>
                          <span
                            className="font-semibold text-blue-900 dark:text-blue-300 cursor-pointer"
                            onClick={() => {
                              setEditingCategoryId(category.id);
                              setEditingName(category.name);
                            }}
                          >
                            {category.name}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setAddingSubItem(category.id);
                              setNewSubItemName('');
                            }}
                            className="p-1.5 bg-green-600 hover:bg-green-700 text-white rounded transition-colors flex items-center justify-center"
                            title="Agregar sub-item"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteCategory(category.id);
                            }}
                            className="p-1.5 bg-red-600 hover:bg-red-700 text-white rounded transition-colors flex items-center justify-center"
                            title="Eliminar categoría"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                  {MONTHS.map(() => (
                    <td key={Math.random()} className="p-2 bg-blue-50 dark:bg-blue-900/20"></td>
                  ))}
                  <td className="p-2 bg-blue-50 dark:bg-blue-900/20"></td>
                </tr>

                {/* Sub-items */}
                {category.sub_items.map(subItem => (
                  <tr key={subItem.id} className="border-b border-gray-200 dark:border-slate-700 bg-yellow-50 dark:bg-yellow-900/20">
                    <td className="p-3 sticky left-0 bg-yellow-50 dark:bg-yellow-900/20 z-10">
                      <div className="flex items-center gap-2">
                        {editingSubItemId === subItem.id ? (
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onBlur={() => handleUpdateSubItemName(subItem.id, editingName)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleUpdateSubItemName(subItem.id, editingName);
                              } else if (e.key === 'Escape') {
                                setEditingSubItemId(null);
                              }
                            }}
                            className="flex-1 px-2 py-1 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm"
                            autoFocus
                          />
                        ) : (
                          <span 
                            className="font-semibold text-gray-900 dark:text-white flex-1 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400"
                            onClick={() => {
                              setEditingSubItemId(subItem.id);
                              setEditingName(subItem.name);
                            }}
                            title="Haz clic para editar"
                          >
                            {subItem.name}
                          </span>
                        )}
                        <button
                          onClick={() => handleDeleteSubItem(subItem.id)}
                          className="text-red-600 hover:text-red-800 dark:text-red-400"
                          title="Eliminar sub-item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                    {MONTHS.map(month => {
                      const value = values.find(
                        v => v.concept_id === subItem.id && v.month === month.num && v.year === selectedYear
                      )?.value || 0;
                      const inputKey = `${subItem.id}_${month.num}`;
                      const displayValue = editingInputs[inputKey] !== undefined 
                        ? editingInputs[inputKey]
                        : (value ? formatNumberForInput(value) : '');

                      return (
                        <td key={month.num} className="text-right p-2">
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
                                await handleUpdateValue(subItem.id, month.num, '0');
                                setEditingInputs(prev => {
                                  const newState = { ...prev };
                                  delete newState[inputKey];
                                  return newState;
                                });
                              } else {
                                await handleUpdateValue(subItem.id, month.num, inputValue);
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
                    <td className="text-right p-3 font-bold bg-yellow-50 dark:bg-yellow-900/20">
                      {formatNumber(
                        MONTHS.reduce((sum, month) => {
                          const val = values.find(
                            v => v.concept_id === subItem.id && v.month === month.num && v.year === selectedYear
                          );
                          return sum + (val?.value || 0);
                        }, 0)
                      )}
                    </td>
                  </tr>
                ))}

                {/* Agregar sub-item */}
                {addingSubItem === category.id && (
                  <tr className="border-b border-gray-100 dark:border-slate-700 bg-blue-50 dark:bg-blue-900/10">
                    <td className="p-3 pl-8 sticky left-0 bg-blue-50 dark:bg-blue-900/10 z-10">
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
                    {MONTHS.map(() => (
                      <td key={Math.random()} className="p-2"></td>
                    ))}
                    <td className="p-2"></td>
                  </tr>
                )}

                {/* Total de categoría */}
                <tr className="border-b-2 border-gray-300 dark:border-slate-600 bg-green-50 dark:bg-green-900/20">
                  <td className="p-3 sticky left-0 bg-green-50 dark:bg-green-900/20 z-10 font-bold text-green-900 dark:text-green-300">
                    TOTAL {category.name.toUpperCase()}
                  </td>
                  {MONTHS.map(month => (
                    <td key={month.num} className="text-right p-3 font-bold text-green-900 dark:text-green-300">
                      {formatNumber(category.total_by_month[month.num] || 0)}
                    </td>
                  ))}
                  <td className="text-right p-3 font-bold text-green-900 dark:text-green-300 bg-green-100 dark:bg-green-900/30">
                    {formatNumber(
                      MONTHS.reduce((sum, month) => sum + (category.total_by_month[month.num] || 0), 0)
                    )}
                  </td>
                </tr>
              </React.Fragment>
            ))}

            {/* Total general */}
            <tr className="border-t-4 border-gray-400 dark:border-slate-500 bg-gray-200 dark:bg-slate-700">
              <td className="p-3 font-bold text-lg text-gray-900 dark:text-white sticky left-0 bg-gray-200 dark:bg-slate-700 z-10">
                TOTAL GENERAL
              </td>
              {MONTHS.map(month => (
                <td key={month.num} className="text-right p-3 font-bold text-lg text-gray-900 dark:text-white">
                  {formatNumber(totalsByMonth[month.num] || 0)}
                </td>
              ))}
              <td className="text-right p-3 font-bold text-lg text-gray-900 dark:text-white bg-gray-300 dark:bg-slate-600">
                {formatNumber(
                  MONTHS.reduce((sum, month) => sum + (totalsByMonth[month.num] || 0), 0)
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

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
