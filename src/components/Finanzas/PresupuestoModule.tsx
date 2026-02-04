/**
 * Módulo de Presupuesto
 * Permite crear presupuestos anuales con ingresos y egresos
 * que se ven afectados por el IPC (Índice de Precios al Consumidor) mensual
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, X, Settings } from 'lucide-react';
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

// Función para formatear números decimales simples (sin separadores de miles) - para IPC
const formatDecimalWhileTyping = (inputValue: string): string => {
  if (!inputValue || inputValue.trim() === '') return '';
  
  // Permitir solo números, un punto decimal y hasta 4 decimales
  let cleaned = inputValue.replace(/[^\d.]/g, '');
  
  // Asegurar que solo haya un punto decimal
  const dotIndex = cleaned.indexOf('.');
  if (dotIndex !== -1) {
    const beforeDot = cleaned.substring(0, dotIndex);
    const afterDot = cleaned.substring(dotIndex + 1).replace(/\./g, '');
    // Limitar a 4 decimales
    if (afterDot.length > 4) {
      cleaned = beforeDot + '.' + afterDot.substring(0, 4);
    } else {
      cleaned = beforeDot + '.' + afterDot;
    }
  }
  
  return cleaned;
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

// Función para parsear decimales simples (sin separadores de miles) - para IPC
const parseDecimal = (value: string): number => {
  if (!value || value.trim() === '') return 0;
  
  const cleaned = value.trim().replace(/[^\d.]/g, '');
  const parsed = parseFloat(cleaned);
  
  return isNaN(parsed) ? 0 : parsed;
};

const MONTHS = [
  { num: 1, name: 'ene', fullName: 'Enero' },
  { num: 2, name: 'feb', fullName: 'Febrero' },
  { num: 3, name: 'mar', fullName: 'Marzo' },
  { num: 4, name: 'abr', fullName: 'Abril' },
  { num: 5, name: 'may', fullName: 'Mayo' },
  { num: 6, name: 'jun', fullName: 'Junio' },
  { num: 7, name: 'jul', fullName: 'Julio' },
  { num: 8, name: 'ago', fullName: 'Agosto' },
  { num: 9, name: 'sep', fullName: 'Septiembre' },
  { num: 10, name: 'oct', fullName: 'Octubre' },
  { num: 11, name: 'nov', fullName: 'Noviembre' },
  { num: 12, name: 'dic', fullName: 'Diciembre' },
];

// Tipos
type Concept = {
  id: string;
  name: string;
  concept_type: 'ingreso' | 'egreso';
  category?: string;
  display_order: number;
  is_total: boolean;
  parent_concept_id?: string | null;
};

type Value = {
  id: string;
  year_id: string;
  concept_id: string;
  month: number;
  presupuesto: number;
  real?: number | null;
};

type IPC = {
  id: string;
  year_id: string;
  month: number;
  ipc_percentage: number;
};

type Year = {
  id: string;
  tenant_id: string;
  year: number;
  created_by: string;
};

// Conceptos por defecto
const DEFAULT_CONCEPTS: Omit<Concept, 'id' | 'display_order'>[] = [
  // Ingresos
  { name: 'Ingresos por Venta', concept_type: 'ingreso', is_total: false },
  { name: 'Otros Ingresos', concept_type: 'ingreso', is_total: false },
  { name: 'IVA', concept_type: 'ingreso', is_total: false },
  { name: 'Ingresos Totales', concept_type: 'ingreso', is_total: true },
  
  // Egresos
  { name: 'Sueldos', concept_type: 'egreso', is_total: false },
  { name: 'CCSS', concept_type: 'egreso', is_total: false },
  { name: 'SAC', concept_type: 'egreso', is_total: false },
  { name: 'CCSS SAC', concept_type: 'egreso', is_total: false },
  { name: 'Sueldos Socios', concept_type: 'egreso', is_total: false },
  { name: 'Costos de Estructura', concept_type: 'egreso', is_total: false },
  { name: 'Costos Financieros', concept_type: 'egreso', is_total: false },
  { name: 'Egresos Totales', concept_type: 'egreso', is_total: true },
];

export function PresupuestoModule() {
  const { tenant } = useTenant();
  const { profile } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [currentYear, setCurrentYear] = useState<Year | null>(null);
  const [values, setValues] = useState<Value[]>([]);
  const [ipcValues, setIpcValues] = useState<IPC[]>([]);
  const [editingInputs, setEditingInputs] = useState<Record<string, string>>({});
  const [editingIpc, setEditingIpc] = useState<Record<string, string>>({});
  const [showIpcModal, setShowIpcModal] = useState(false);
  
  // Estados para agregar conceptos
  const [addingConcept, setAddingConcept] = useState(false);
  const [newConceptName, setNewConceptName] = useState('');
  const [newConceptType, setNewConceptType] = useState<'ingreso' | 'egreso'>('ingreso');
  
  // Estados para editar nombres
  const [editingConceptId, setEditingConceptId] = useState<string | null>(null);
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

  // Calcular valores con IPC aplicado
  const calculateValueWithIPC = useMemo(() => {
    return (conceptId: string, month: number, presupuestoBase: number): number => {
      if (presupuestoBase === 0) return 0;
      
      // Obtener IPC acumulativo desde enero hasta el mes actual
      let cumulativeMultiplier = 1;
      for (let m = 1; m <= month; m++) {
        const ipc = ipcValues.find(i => i.month === m);
        if (ipc && ipc.ipc_percentage !== null && ipc.ipc_percentage !== undefined) {
          // Aplicar IPC incluso si es 0 (para mantener consistencia)
          cumulativeMultiplier *= (1 + (ipc.ipc_percentage / 100));
        }
      }
      
      const result = presupuestoBase * cumulativeMultiplier;
      return result;
    };
  }, [ipcValues]);

  // Calcular totales
  const totals = useMemo(() => {
    const ingresosByMonth: Record<number, number> = {};
    const egresosByMonth: Record<number, number> = {};
    const superavitByMonth: Record<number, number> = {};
    let acumulado = 0;

    MONTHS.forEach(month => {
      let ingresos = 0;
      let egresos = 0;

      concepts.forEach(concept => {
        if (concept.is_total) return;
        
        // Obtener el presupuesto base del mes 1 (enero)
        const presupuestoBase = values.find(v => v.concept_id === concept.id && v.month === 1)?.presupuesto || 0;
        
        // Obtener el valor real del mes actual (si existe)
        const valueCurrentMonth = values.find(v => v.concept_id === concept.id && v.month === month.num);
        const real = valueCurrentMonth?.real !== null && valueCurrentMonth?.real !== undefined 
          ? valueCurrentMonth.real 
          : calculateValueWithIPC(concept.id, month.num, presupuestoBase);

        if (concept.concept_type === 'ingreso') {
          ingresos += real;
        } else {
          egresos += Math.abs(real); // Los egresos son negativos
        }
      });

      ingresosByMonth[month.num] = ingresos;
      egresosByMonth[month.num] = egresos;
      const superavit = ingresos - egresos;
      superavitByMonth[month.num] = superavit;
      acumulado += superavit;
    });

    return {
      ingresosByMonth,
      egresosByMonth,
      superavitByMonth,
      acumulado,
    };
  }, [concepts, values, calculateValueWithIPC]);

  // Cargar datos
  useEffect(() => {
    if (tenant?.id) {
      loadData();
    }
  }, [tenant?.id, selectedYear]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Cargar o crear año
      const { data: yearsData, error: yearsError } = await supabase
        .from('presupuesto_years')
        .select('*')
        .eq('tenant_id', tenant!.id)
        .eq('year', selectedYear)
        .single();

      let yearData: Year;
      if (yearsError && yearsError.code === 'PGRST116') {
        // No existe, crear
        const { data: newYear, error: createError } = await supabase
          .from('presupuesto_years')
          .insert({
            tenant_id: tenant!.id,
            year: selectedYear,
            created_by: profile?.id!,
          })
          .select()
          .single();

        if (createError) throw createError;
        yearData = newYear;
      } else if (yearsError) {
        throw yearsError;
      } else {
        yearData = yearsData!;
      }

      setCurrentYear(yearData);

      // Cargar conceptos
      const { data: conceptsData, error: conceptsError } = await supabase
        .from('presupuesto_concepts')
        .select('*')
        .eq('tenant_id', tenant!.id)
        .order('concept_type', { ascending: true })
        .order('display_order', { ascending: true });

      if (conceptsError) throw conceptsError;

      // Si no hay conceptos, crear los por defecto
      if (!conceptsData || conceptsData.length === 0) {
        await initializeDefaultConcepts();
        // Recargar
        const { data: reloadedConcepts, error: reloadError } = await supabase
          .from('presupuesto_concepts')
          .select('*')
          .eq('tenant_id', tenant!.id)
          .order('concept_type', { ascending: true })
          .order('display_order', { ascending: true });

        if (reloadError) throw reloadError;
        setConcepts(reloadedConcepts || []);
      } else {
        setConcepts(conceptsData);
      }

      // Cargar valores
      const { data: valuesData, error: valuesError } = await supabase
        .from('presupuesto_values')
        .select('*')
        .eq('year_id', yearData.id);

      if (valuesError) throw valuesError;
      setValues(valuesData || []);

      // Cargar IPC
      const { data: ipcData, error: ipcError } = await supabase
        .from('presupuesto_ipc')
        .select('*')
        .eq('year_id', yearData.id)
        .order('month', { ascending: true });

      if (ipcError) throw ipcError;
      setIpcValues(ipcData || []);

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

  // Inicializar conceptos por defecto
  const initializeDefaultConcepts = async () => {
    if (!tenant?.id) return;

    try {
      const conceptsToInsert = DEFAULT_CONCEPTS.map((concept, index) => ({
        tenant_id: tenant.id,
        name: concept.name,
        concept_type: concept.concept_type,
        is_total: concept.is_total,
        display_order: index + 1,
      }));

      const { error } = await supabase
        .from('presupuesto_concepts')
        .insert(conceptsToInsert);

      if (error && error.code !== '23505') {
        throw error;
      }
    } catch (error) {
      console.error('Error inicializando conceptos:', error);
    }
  };

  // Actualizar valor presupuestado
  const handleUpdatePresupuesto = async (conceptId: string, month: number, value: string) => {
    if (!currentYear) return;

    const numValue = parseFormattedNumber(value);

    // Actualizar estado local inmediatamente
    const existing = values.find(
      v => v.concept_id === conceptId && v.month === month
    );

    if (existing) {
      setValues(prev => prev.map(v => 
        v.id === existing.id 
          ? { ...v, presupuesto: numValue }
          : v
      ));
    } else {
      const newValue: Value = {
        id: `temp-${Date.now()}`,
        year_id: currentYear.id,
        concept_id: conceptId,
        month,
        presupuesto: numValue,
        real: null,
      };
      setValues(prev => [...prev, newValue]);
    }

    // Sincronizar con base de datos en segundo plano (sin bloquear UI)
    try {
      if (existing) {
        const { error } = await supabase
          .from('presupuesto_values')
          .update({ presupuesto: numValue })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('presupuesto_values')
          .insert({
            year_id: currentYear.id,
            concept_id: conceptId,
            tenant_id: tenant!.id,
            month,
            presupuesto: numValue,
          })
          .select()
          .single();

        if (error) throw error;
        
        // Actualizar con el ID real de la base de datos
        if (data) {
          setValues(prev => prev.map(v => 
            v.id.startsWith('temp-') && v.concept_id === conceptId && v.month === month
              ? { ...v, id: data.id }
              : v
          ));
        }
      }
    } catch (error: any) {
      // Revertir cambio local si falla
      if (existing) {
        setValues(prev => prev.map(v => 
          v.id === existing.id 
            ? { ...v, presupuesto: existing.presupuesto }
            : v
        ));
      } else {
        setValues(prev => prev.filter(v => 
          !(v.id.startsWith('temp-') && v.concept_id === conceptId && v.month === month)
        ));
      }
      
      setAlertModal({
        isOpen: true,
        title: 'Error',
        message: error.message || 'Error al actualizar valor',
        type: 'error',
      });
    }
  };

  // Actualizar valor real
  const handleUpdateReal = async (conceptId: string, month: number, value: string) => {
    if (!currentYear) return;

    const numValue = value.trim() === '' ? null : parseFormattedNumber(value);

    // Actualizar estado local inmediatamente
    const existing = values.find(
      v => v.concept_id === conceptId && v.month === month
    );

    if (existing) {
      setValues(prev => prev.map(v => 
        v.id === existing.id 
          ? { ...v, real: numValue }
          : v
      ));
    } else {
      // Si no existe, crear con presupuesto del mes 1 o 0
      const presupuesto = values.find(
        v => v.concept_id === conceptId && v.month === 1
      )?.presupuesto || 0;

      const newValue: Value = {
        id: `temp-${Date.now()}`,
        year_id: currentYear.id,
        concept_id: conceptId,
        month,
        presupuesto,
        real: numValue,
      };
      setValues(prev => [...prev, newValue]);
    }

    // Sincronizar con base de datos en segundo plano (sin bloquear UI)
    try {
      if (existing) {
        const { error } = await supabase
          .from('presupuesto_values')
          .update({ real: numValue })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        const presupuesto = values.find(
          v => v.concept_id === conceptId && v.month === 1
        )?.presupuesto || 0;

        const { data, error } = await supabase
          .from('presupuesto_values')
          .insert({
            year_id: currentYear.id,
            concept_id: conceptId,
            tenant_id: tenant!.id,
            month,
            presupuesto,
            real: numValue,
          })
          .select()
          .single();

        if (error) throw error;
        
        // Actualizar con el ID real de la base de datos
        if (data) {
          setValues(prev => prev.map(v => 
            v.id.startsWith('temp-') && v.concept_id === conceptId && v.month === month
              ? { ...v, id: data.id }
              : v
          ));
        }
      }
    } catch (error: any) {
      // Revertir cambio local si falla
      if (existing) {
        setValues(prev => prev.map(v => 
          v.id === existing.id 
            ? { ...v, real: existing.real }
            : v
        ));
      } else {
        setValues(prev => prev.filter(v => 
          !(v.id.startsWith('temp-') && v.concept_id === conceptId && v.month === month)
        ));
      }
      
      setAlertModal({
        isOpen: true,
        title: 'Error',
        message: error.message || 'Error al actualizar valor real',
        type: 'error',
      });
    }
  };

  // Actualizar IPC
  const handleUpdateIPC = async (month: number, value: string) => {
    if (!currentYear) return;

    const numValue = parseDecimal(value);

    // Actualizar estado local inmediatamente
    const existing = ipcValues.find(i => i.month === month);

    if (existing) {
      setIpcValues(prev => prev.map(i => 
        i.id === existing.id 
          ? { ...i, ipc_percentage: numValue }
          : i
      ));
    } else {
      const newIPC: IPC = {
        id: `temp-${Date.now()}`,
        year_id: currentYear.id,
        month,
        ipc_percentage: numValue,
      };
      setIpcValues(prev => [...prev, newIPC]);
    }

    // Sincronizar con base de datos en segundo plano (sin bloquear UI)
    try {
      if (existing) {
        const { error } = await supabase
          .from('presupuesto_ipc')
          .update({ ipc_percentage: numValue })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('presupuesto_ipc')
          .insert({
            year_id: currentYear.id,
            tenant_id: tenant!.id,
            month,
            ipc_percentage: numValue,
          })
          .select()
          .single();

        if (error) throw error;
        
        // Actualizar con el ID real de la base de datos
        if (data) {
          setIpcValues(prev => prev.map(i => 
            i.id.startsWith('temp-') && i.month === month
              ? { ...i, id: data.id }
              : i
          ));
        }
      }
    } catch (error: any) {
      // Revertir cambio local si falla
      if (existing) {
        setIpcValues(prev => prev.map(i => 
          i.id === existing.id 
            ? { ...i, ipc_percentage: existing.ipc_percentage }
            : i
        ));
      } else {
        setIpcValues(prev => prev.filter(i => 
          !(i.id.startsWith('temp-') && i.month === month)
        ));
      }
      
      setAlertModal({
        isOpen: true,
        title: 'Error',
        message: error.message || 'Error al actualizar IPC',
        type: 'error',
      });
    }
  };

  // Eliminar concepto
  const handleDeleteConcept = async (conceptId: string) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar esta subcategoría? Esta acción no se puede deshacer.')) {
      return;
    }

    // Actualizar estado local inmediatamente
    setConcepts(prev => prev.filter(c => c.id !== conceptId));
    setValues(prev => prev.filter(v => v.concept_id !== conceptId));

    // Sincronizar con base de datos en segundo plano
    try {
      // Eliminar valores asociados
      const { error: valuesError } = await supabase
        .from('presupuesto_values')
        .delete()
        .eq('concept_id', conceptId);

      if (valuesError) throw valuesError;

      // Eliminar concepto
      const { error: conceptError } = await supabase
        .from('presupuesto_concepts')
        .delete()
        .eq('id', conceptId);

      if (conceptError) throw conceptError;
    } catch (error: any) {
      // Recargar datos si falla
      loadData();
      
      setAlertModal({
        isOpen: true,
        title: 'Error',
        message: error.message || 'Error al eliminar concepto',
        type: 'error',
      });
    }
  };

  // Agregar concepto
  const handleAddConcept = async () => {
    const trimmedName = newConceptName.trim();
    if (!trimmedName || !tenant?.id) return;

    const maxOrder = concepts.length > 0 
      ? Math.max(...concepts.map(c => c.display_order))
      : 0;

    const newConcept: Concept = {
      id: `temp-${Date.now()}`,
      name: trimmedName,
      concept_type: newConceptType,
      display_order: maxOrder + 1,
      is_total: false,
      parent_concept_id: null,
    };

    // Actualizar estado local inmediatamente
    setConcepts(prev => [...prev, newConcept]);
    const conceptNameToSave = trimmedName;
    setAddingConcept(false);
    setNewConceptName('');

    // Sincronizar con base de datos en segundo plano
    try {
      const { data, error } = await supabase
        .from('presupuesto_concepts')
        .insert({
          tenant_id: tenant.id,
          name: conceptNameToSave,
          concept_type: newConceptType,
          display_order: maxOrder + 1,
          is_total: false,
        })
        .select()
        .single();

      if (error) throw error;

      // Actualizar con el ID real de la base de datos
      if (data) {
        setConcepts(prev => prev.map(c => 
          c.id === newConcept.id 
            ? { ...c, id: data.id }
            : c
        ));
      }
    } catch (error: any) {
      // Revertir cambio local si falla
      setConcepts(prev => prev.filter(c => c.id !== newConcept.id));
      
      setAlertModal({
        isOpen: true,
        title: 'Error',
        message: error.message || 'Error al crear concepto',
        type: 'error',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">Cargando...</div>
      </div>
    );
  }

  const ingresosConcepts = concepts.filter(c => c.concept_type === 'ingreso' && !c.is_total);
  const ingresosTotales = concepts.filter(c => c.concept_type === 'ingreso' && c.is_total);
  const egresosConcepts = concepts.filter(c => c.concept_type === 'egreso' && !c.is_total);
  const egresosTotales = concepts.filter(c => c.concept_type === 'egreso' && c.is_total);

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-2 sm:space-y-3">
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-3 -mx-3 sm:-mx-4 md:-mx-6 -mt-3 sm:-mt-4 md:-mt-6 mb-2 sm:mb-3">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Presupuesto {selectedYear}</h2>
        <div className="flex items-center gap-4">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
          >
            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
          <button
            onClick={() => setShowIpcModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
          >
            <Settings className="w-5 h-5" />
            Configurar IPC
          </button>
        </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 shadow-lg border border-gray-200 dark:border-slate-700 overflow-auto max-h-[calc(100vh-200px)]">
        <table className="w-full min-w-[1800px] border-collapse">
          <thead className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-slate-700 dark:to-slate-800 sticky top-0 z-20 shadow-md">
            <tr>
              <th rowSpan={2} className="p-2 text-left font-bold text-gray-900 dark:text-white sticky left-0 bg-gradient-to-b from-gray-50 to-gray-100 dark:from-slate-700 dark:to-slate-800 z-30 border-r-2 border-gray-300 dark:border-slate-600 min-w-[200px]">
                <div className="flex flex-col">
                  <span className="text-xs">Concepto</span>
                </div>
              </th>
              <th rowSpan={2} className="p-2 text-center font-bold text-gray-900 dark:text-white min-w-[160px] bg-gray-100 dark:bg-slate-700 border-r-2 border-gray-300 dark:border-slate-600">
                <div className="flex flex-col">
                  <span className="text-xs">Presupuesto</span>
                  <span className="text-[10px] font-normal text-gray-500 dark:text-gray-400 mt-0.5">Base (Enero)</span>
                </div>
              </th>
              {MONTHS.map(month => (
                <th key={month.num} colSpan={3} className="p-2 text-center font-bold text-gray-900 dark:text-white border-l-2 border-gray-300 dark:border-slate-600 bg-gray-100 dark:bg-slate-700">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs">{month.name}-{selectedYear.toString().slice(-2)}</span>
                    <span className="text-[10px] font-normal text-blue-600 dark:text-blue-400">
                      IPC: {(() => {
                        const ipc = ipcValues.find(i => i.month === month.num);
                        return ipc ? `${ipc.ipc_percentage}%` : '0%';
                      })()}
                    </span>
                  </div>
                </th>
              ))}
              <th rowSpan={2} className="p-2 text-center font-bold text-gray-900 dark:text-white min-w-[160px] bg-gray-200 dark:bg-slate-600 border-l-2 border-gray-400 dark:border-slate-500">
                <div className="flex flex-col">
                  <span className="text-xs">Totales</span>
                  <span className="text-[10px] font-normal text-gray-500 dark:text-gray-400 mt-0.5">Anual</span>
                </div>
              </th>
            </tr>
            <tr className="bg-gray-100 dark:bg-slate-700">
              {MONTHS.map(month => (
                <React.Fragment key={month.num}>
                  <th className="p-1 text-center font-semibold text-[10px] text-gray-700 dark:text-gray-300 border-l border-gray-300 dark:border-slate-600 min-w-[140px] bg-gray-50 dark:bg-slate-800">
                    Presupuesto
                  </th>
                  <th className="p-1 text-center font-semibold text-[10px] text-gray-700 dark:text-gray-300 min-w-[140px] bg-gray-50 dark:bg-slate-800">
                    Real
                  </th>
                  <th className="p-1 text-center font-semibold text-[10px] text-gray-700 dark:text-gray-300 min-w-[100px] bg-gray-50 dark:bg-slate-800 border-r border-gray-300 dark:border-slate-600">
                    Diferencia %
                  </th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* INGRESOS */}
            <tr className="bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-700 dark:to-blue-800">
              <td colSpan={24} className="p-2 font-bold text-white text-sm border-b-2 border-blue-800 dark:border-blue-900">
                <div className="flex items-center gap-2">
                  <span>INGRESOS</span>
                </div>
              </td>
            </tr>

            {ingresosConcepts.map(concept => {
              // Obtener el presupuesto base del mes 1 (enero)
              const presupuestoBase = values.find(v => v.concept_id === concept.id && v.month === 1)?.presupuesto || 0;
              
              return (
                <tr key={concept.id} className="border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-700/30 hover:bg-gray-100 dark:hover:bg-slate-700/50 transition-colors">
                  <td className="p-3 sticky left-0 bg-gray-50 dark:bg-slate-700/30 z-10 border-r-2 border-gray-300 dark:border-slate-600 font-medium">
                    <div className="flex items-center gap-2">
                      {editingConceptId === concept.id ? (
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onBlur={async () => {
                            if (editingName.trim() && editingName.trim() !== concept.name) {
                              try {
                                const { error } = await supabase
                                  .from('presupuesto_concepts')
                                  .update({ name: editingName.trim() })
                                  .eq('id', concept.id);

                                if (error) throw error;

                                // Actualizar estado local
                                setConcepts(prev => prev.map(c => 
                                  c.id === concept.id 
                                    ? { ...c, name: editingName.trim() }
                                    : c
                                ));
                                setEditingConceptId(null);
                              } catch (error: any) {
                                setAlertModal({
                                  isOpen: true,
                                  title: 'Error',
                                  message: error.message || 'Error al actualizar concepto',
                                  type: 'error',
                                });
                                setEditingConceptId(null);
                              }
                            } else {
                              setEditingConceptId(null);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.currentTarget.blur();
                            } else if (e.key === 'Escape') {
                              setEditingConceptId(null);
                            }
                          }}
                          className="flex-1 px-2 py-1 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                          autoFocus
                        />
                      ) : (
                        <>
                          <span
                            className="flex-1 cursor-pointer text-gray-900 dark:text-gray-100 font-medium hover:text-blue-600 dark:hover:text-blue-400"
                            onClick={() => {
                              setEditingConceptId(concept.id);
                              setEditingName(concept.name);
                            }}
                          >
                            {concept.name}
                          </span>
                          <button
                            onClick={() => handleDeleteConcept(concept.id)}
                            className="p-1 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                            title="Eliminar subcategoría"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="p-1.5 text-right bg-gray-50 dark:bg-slate-700/30 border-r-2 border-gray-300 dark:border-slate-600">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={editingInputs[`presupuesto_${concept.id}_0`] !== undefined
                        ? editingInputs[`presupuesto_${concept.id}_0`]
                        : (() => {
                            const val = values.find(v => v.concept_id === concept.id && v.month === 1);
                            return val?.presupuesto ? formatNumberForInput(val.presupuesto) : '';
                          })()}
                      onChange={(e) => {
                        const formatted = formatNumberWhileTyping(e.target.value);
                        setEditingInputs(prev => ({
                          ...prev,
                          [`presupuesto_${concept.id}_0`]: formatted
                        }));
                      }}
                      onBlur={(e) => {
                        handleUpdatePresupuesto(concept.id, 1, e.target.value);
                        setEditingInputs(prev => {
                          const newState = { ...prev };
                          delete newState[`presupuesto_${concept.id}_0`];
                          return newState;
                        });
                      }}
                      className="w-full px-2 py-1 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-xs text-right font-medium focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all"
                      placeholder="$0.00"
                    />
                  </td>
                  {MONTHS.map(month => {
                    // Calcular presupuesto ajustado con IPC
                    const presupuestoAjustado = calculateValueWithIPC(concept.id, month.num, presupuestoBase);
                    
                    // Obtener el valor real del mes actual (si existe)
                    const valueCurrentMonth = values.find(v => v.concept_id === concept.id && v.month === month.num);
                    const real = valueCurrentMonth?.real !== null && valueCurrentMonth?.real !== undefined 
                      ? valueCurrentMonth.real 
                      : null;
                    
                    // Calcular diferencia porcentual
                    const diferenciaPorcentual = presupuestoAjustado !== 0 && real !== null
                      ? ((real - presupuestoAjustado) / presupuestoAjustado) * 100
                      : null;
                    
                    const inputKeyPresupuesto = `presupuesto_${concept.id}_${month.num}`;
                    const inputKeyReal = `real_${concept.id}_${month.num}`;

                    return (
                      <React.Fragment key={month.num}>
                        {/* Columna Presupuesto (calculado con IPC) */}
                        <td className="p-1.5 text-right border-l-2 border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-700/30">
                          <div className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                            {formatNumber(presupuestoAjustado)}
                          </div>
                        </td>
                        {/* Columna Real (input editable) */}
                        <td className="p-1.5 text-right bg-white dark:bg-slate-800">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={editingInputs[inputKeyReal] !== undefined
                              ? editingInputs[inputKeyReal]
                              : real !== null ? formatNumberForInput(real) : ''}
                            onChange={(e) => {
                              const formatted = formatNumberWhileTyping(e.target.value);
                              setEditingInputs(prev => ({
                                ...prev,
                                [inputKeyReal]: formatted
                              }));
                            }}
                            onBlur={(e) => {
                              handleUpdateReal(concept.id, month.num, e.target.value);
                              setEditingInputs(prev => {
                                const newState = { ...prev };
                                delete newState[inputKeyReal];
                                return newState;
                              });
                            }}
                            className="w-full px-2 py-1 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-xs text-right font-medium focus:ring-1 focus:ring-green-500 focus:border-green-500 transition-all"
                            placeholder="Ingresar real"
                          />
                        </td>
                        {/* Columna Diferencia % */}
                        <td className="p-1.5 text-right border-r border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-700/30">
                          <div className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                            diferenciaPorcentual === null 
                              ? 'text-gray-400 dark:text-gray-500'
                              : diferenciaPorcentual > 0
                              ? 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20'
                              : diferenciaPorcentual < 0
                              ? 'text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20'
                              : 'text-gray-600 dark:text-gray-400'
                          }`}>
                            {diferenciaPorcentual !== null 
                              ? `${diferenciaPorcentual >= 0 ? '+' : ''}${diferenciaPorcentual.toFixed(2)}%`
                              : '-'
                            }
                          </div>
                        </td>
                      </React.Fragment>
                    );
                  })}
                  <td className="p-3 text-right font-bold bg-gray-100 dark:bg-slate-600 border-l-2 border-gray-400 dark:border-slate-500 text-gray-900 dark:text-white">
                    <div className="text-base">
                      {formatNumber(
                        MONTHS.reduce((sum, month) => {
                          const valueCurrentMonth = values.find(v => v.concept_id === concept.id && v.month === month.num);
                          const real = valueCurrentMonth?.real !== null && valueCurrentMonth?.real !== undefined 
                            ? valueCurrentMonth.real 
                            : calculateValueWithIPC(concept.id, month.num, presupuestoBase);
                          return sum + real;
                        }, 0)
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}

            {/* Botón para agregar nueva subcategoría de Ingresos */}
            <tr className="border-b-2 border-blue-200 dark:border-blue-800">
              <td colSpan={24} className="p-3 bg-blue-50 dark:bg-blue-900/10">
                {addingConcept && newConceptType === 'ingreso' ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newConceptName}
                      onChange={(e) => setNewConceptName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleAddConcept();
                        } else if (e.key === 'Escape') {
                          setAddingConcept(false);
                          setNewConceptName('');
                        }
                      }}
                      placeholder="Nombre de la nueva subcategoría"
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                      autoFocus
                    />
                    <button
                      onClick={handleAddConcept}
                      className="px-4 py-2 bg-green-600 dark:bg-green-500 text-white rounded-lg hover:bg-green-700 dark:hover:bg-green-600 transition-colors"
                    >
                      Agregar
                    </button>
                    <button
                      onClick={() => {
                        setAddingConcept(false);
                        setNewConceptName('');
                      }}
                      className="px-4 py-2 bg-gray-500 dark:bg-gray-600 text-white rounded-lg hover:bg-gray-600 dark:hover:bg-gray-700 transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setNewConceptType('ingreso');
                      setAddingConcept(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span className="text-sm font-medium">Agregar subcategoría de Ingresos</span>
                  </button>
                )}
              </td>
            </tr>

            {/* Totales de Ingresos */}
            {ingresosTotales.map(concept => (
              <tr key={concept.id} className="bg-gradient-to-r from-green-100 to-green-200 dark:from-green-900/30 dark:to-green-800/30 border-t-4 border-green-400 dark:border-green-600">
                <td className="p-2 font-bold text-green-900 dark:text-green-200 text-xs sticky left-0 bg-gradient-to-r from-green-100 to-green-200 dark:from-green-900/30 dark:to-green-800/30 z-10 border-r-2 border-green-400 dark:border-green-600">
                  {concept.name}
                </td>
                <td className="p-2 bg-green-100 dark:bg-green-900/20 border-r-2 border-green-300 dark:border-green-700"></td>
                {MONTHS.map(month => {
                  // Calcular totales de presupuesto ajustado y real para este mes
                  let totalPresupuestoAjustado = 0;
                  let totalReal = 0;
                  
                  ingresosConcepts.forEach(ingresoConcept => {
                    const presupuestoBase = values.find(v => v.concept_id === ingresoConcept.id && v.month === 1)?.presupuesto || 0;
                    const presupuestoAjustado = calculateValueWithIPC(ingresoConcept.id, month.num, presupuestoBase);
                    totalPresupuestoAjustado += presupuestoAjustado;
                    
                    const valueCurrentMonth = values.find(v => v.concept_id === ingresoConcept.id && v.month === month.num);
                    const real = valueCurrentMonth?.real !== null && valueCurrentMonth?.real !== undefined 
                      ? valueCurrentMonth.real 
                      : presupuestoAjustado;
                    totalReal += real;
                  });
                  
                  const diferenciaPorcentual = totalPresupuestoAjustado !== 0
                    ? ((totalReal - totalPresupuestoAjustado) / totalPresupuestoAjustado) * 100
                    : null;
                  
                  return (
                    <React.Fragment key={month.num}>
                      <td className="p-1.5 text-right font-bold text-green-900 dark:text-green-200 text-xs border-l-2 border-green-300 dark:border-green-700 bg-green-100 dark:bg-green-900/20">
                        {formatNumber(totalPresupuestoAjustado)}
                      </td>
                      <td className="p-1.5 text-right font-bold text-green-900 dark:text-green-200 text-xs bg-green-100 dark:bg-green-900/20">
                        {formatNumber(totalReal)}
                      </td>
                      <td className="p-1.5 text-right font-bold bg-green-100 dark:bg-green-900/20 border-r border-green-300 dark:border-green-700">
                        <div className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                          diferenciaPorcentual === null 
                            ? 'text-gray-400 dark:text-gray-500'
                            : diferenciaPorcentual > 0
                            ? 'text-green-800 dark:text-green-300 bg-green-200 dark:bg-green-800/30'
                            : diferenciaPorcentual < 0
                            ? 'text-red-800 dark:text-red-300 bg-red-200 dark:bg-red-800/30'
                            : 'text-gray-600 dark:text-gray-400'
                        }`}>
                          {diferenciaPorcentual !== null 
                            ? `${diferenciaPorcentual >= 0 ? '+' : ''}${diferenciaPorcentual.toFixed(2)}%`
                            : '-'
                          }
                        </div>
                      </td>
                    </React.Fragment>
                  );
                })}
                <td className="p-1.5 text-right font-bold text-green-900 dark:text-green-200 text-xs bg-green-200 dark:bg-green-900/40 border-l-2 border-green-400 dark:border-green-600">
                  {formatNumber(
                    MONTHS.reduce((sum, month) => sum + (totals.ingresosByMonth[month.num] || 0), 0)
                  )}
                </td>
              </tr>
            ))}

            {/* EGRESOS */}
            <tr className="bg-gradient-to-r from-red-600 to-red-700 dark:from-red-700 dark:to-red-800">
              <td colSpan={24} className="p-1.5 font-bold text-white text-xs border-b-2 border-red-800 dark:border-red-900">
                <div className="flex items-center gap-2">
                  <span>EGRESOS</span>
                </div>
              </td>
            </tr>

            {egresosConcepts.map(concept => {
              // Obtener el presupuesto base del mes 1 (enero)
              const presupuestoBase = values.find(v => v.concept_id === concept.id && v.month === 1)?.presupuesto || 0;
              
              return (
                <tr key={concept.id} className="border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-700/30 hover:bg-gray-100 dark:hover:bg-slate-700/50 transition-colors">
                  <td className="p-2 sticky left-0 bg-gray-50 dark:bg-slate-700/30 z-10 border-r-2 border-gray-300 dark:border-slate-600 font-medium">
                    <div className="flex items-center gap-2">
                      {editingConceptId === concept.id ? (
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onBlur={async () => {
                            if (editingName.trim() && editingName.trim() !== concept.name) {
                              try {
                                const { error } = await supabase
                                  .from('presupuesto_concepts')
                                  .update({ name: editingName.trim() })
                                  .eq('id', concept.id);

                                if (error) throw error;

                                // Actualizar estado local
                                setConcepts(prev => prev.map(c => 
                                  c.id === concept.id 
                                    ? { ...c, name: editingName.trim() }
                                    : c
                                ));
                                setEditingConceptId(null);
                              } catch (error: any) {
                                setAlertModal({
                                  isOpen: true,
                                  title: 'Error',
                                  message: error.message || 'Error al actualizar concepto',
                                  type: 'error',
                                });
                                setEditingConceptId(null);
                              }
                            } else {
                              setEditingConceptId(null);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.currentTarget.blur();
                            } else if (e.key === 'Escape') {
                              setEditingConceptId(null);
                            }
                          }}
                          className="flex-1 px-2 py-1 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-xs"
                          autoFocus
                        />
                      ) : (
                        <>
                          <span
                            className="flex-1 cursor-pointer text-gray-900 dark:text-gray-100 font-medium text-xs hover:text-blue-600 dark:hover:text-blue-400"
                            onClick={() => {
                              setEditingConceptId(concept.id);
                              setEditingName(concept.name);
                            }}
                          >
                            {concept.name}
                          </span>
                          <button
                            onClick={() => handleDeleteConcept(concept.id)}
                            className="p-1 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                            title="Eliminar subcategoría"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="p-1.5 text-right bg-gray-50 dark:bg-slate-700/30 border-r-2 border-gray-300 dark:border-slate-600">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={editingInputs[`presupuesto_${concept.id}_0`] !== undefined
                        ? editingInputs[`presupuesto_${concept.id}_0`]
                        : (() => {
                            const val = values.find(v => v.concept_id === concept.id && v.month === 1);
                            return val?.presupuesto ? formatNumberForInput(Math.abs(val.presupuesto)) : '';
                          })()}
                      onChange={(e) => {
                        const formatted = formatNumberWhileTyping(e.target.value);
                        setEditingInputs(prev => ({
                          ...prev,
                          [`presupuesto_${concept.id}_0`]: formatted
                        }));
                      }}
                      onBlur={(e) => {
                        const numValue = parseFormattedNumber(e.target.value);
                        handleUpdatePresupuesto(concept.id, 1, numValue > 0 ? `-${numValue}` : e.target.value);
                        setEditingInputs(prev => {
                          const newState = { ...prev };
                          delete newState[`presupuesto_${concept.id}_0`];
                          return newState;
                        });
                      }}
                      className="w-full px-2 py-1 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-xs text-right font-medium focus:ring-1 focus:ring-red-500 focus:border-red-500 transition-all"
                      placeholder="$0.00"
                    />
                  </td>
                  {MONTHS.map(month => {
                    // Calcular presupuesto ajustado con IPC (para egresos, es negativo)
                    const presupuestoAjustado = calculateValueWithIPC(concept.id, month.num, presupuestoBase);
                    
                    // Obtener el valor real del mes actual (si existe)
                    const valueCurrentMonth = values.find(v => v.concept_id === concept.id && v.month === month.num);
                    const real = valueCurrentMonth?.real !== null && valueCurrentMonth?.real !== undefined 
                      ? valueCurrentMonth.real 
                      : null;
                    
                    // Calcular diferencia porcentual (usando valores absolutos para el cálculo)
                    const diferenciaPorcentual = presupuestoAjustado !== 0 && real !== null
                      ? ((real - presupuestoAjustado) / Math.abs(presupuestoAjustado)) * 100
                      : null;
                    
                    const inputKeyReal = `real_${concept.id}_${month.num}`;

                    return (
                      <React.Fragment key={month.num}>
                        {/* Columna Presupuesto (calculado con IPC) */}
                        <td className="p-1.5 text-right border-l-2 border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-700/30">
                          <div className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                            {formatNumber(Math.abs(presupuestoAjustado))}
                          </div>
                        </td>
                        {/* Columna Real (input editable) */}
                        <td className="p-1.5 text-right bg-white dark:bg-slate-800">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={editingInputs[inputKeyReal] !== undefined
                              ? editingInputs[inputKeyReal]
                              : real !== null ? formatNumberForInput(Math.abs(real)) : ''}
                            onChange={(e) => {
                              const formatted = formatNumberWhileTyping(e.target.value);
                              setEditingInputs(prev => ({
                                ...prev,
                                [inputKeyReal]: formatted
                              }));
                            }}
                            onBlur={(e) => {
                              const numValue = parseFormattedNumber(e.target.value);
                              handleUpdateReal(concept.id, month.num, numValue > 0 ? `-${numValue}` : e.target.value);
                              setEditingInputs(prev => {
                                const newState = { ...prev };
                                delete newState[inputKeyReal];
                                return newState;
                              });
                            }}
                            className="w-full px-2 py-1 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-xs text-right font-medium focus:ring-1 focus:ring-red-500 focus:border-red-500 transition-all"
                            placeholder="Ingresar real"
                          />
                        </td>
                        {/* Columna Diferencia % */}
                        <td className="p-1.5 text-right border-r border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-700/30">
                          <div className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                            diferenciaPorcentual === null 
                              ? 'text-gray-400 dark:text-gray-500'
                              : diferenciaPorcentual > 0
                              ? 'text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20'
                              : diferenciaPorcentual < 0
                              ? 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20'
                              : 'text-gray-600 dark:text-gray-400'
                          }`}>
                            {diferenciaPorcentual !== null 
                              ? `${diferenciaPorcentual >= 0 ? '+' : ''}${diferenciaPorcentual.toFixed(2)}%`
                              : '-'
                            }
                          </div>
                        </td>
                      </React.Fragment>
                    );
                  })}
                  <td className="p-1.5 text-right font-bold bg-gray-100 dark:bg-slate-600 border-l-2 border-gray-400 dark:border-slate-500 text-gray-900 dark:text-white">
                    <div className="text-xs">
                      {formatNumber(
                        Math.abs(MONTHS.reduce((sum, month) => {
                          const valueCurrentMonth = values.find(v => v.concept_id === concept.id && v.month === month.num);
                          const real = valueCurrentMonth?.real !== null && valueCurrentMonth?.real !== undefined 
                            ? valueCurrentMonth.real 
                            : calculateValueWithIPC(concept.id, month.num, presupuestoBase);
                          return sum + real;
                        }, 0))
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}

            {/* Botón para agregar nueva subcategoría de Egresos */}
            <tr className="border-b-2 border-red-200 dark:border-red-800">
              <td colSpan={24} className="p-3 bg-red-50 dark:bg-red-900/10">
                {addingConcept && newConceptType === 'egreso' ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newConceptName}
                      onChange={(e) => setNewConceptName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleAddConcept();
                        } else if (e.key === 'Escape') {
                          setAddingConcept(false);
                          setNewConceptName('');
                        }
                      }}
                      placeholder="Nombre de la nueva subcategoría"
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                      autoFocus
                    />
                    <button
                      onClick={handleAddConcept}
                      className="px-4 py-2 bg-green-600 dark:bg-green-500 text-white rounded-lg hover:bg-green-700 dark:hover:bg-green-600 transition-colors"
                    >
                      Agregar
                    </button>
                    <button
                      onClick={() => {
                        setAddingConcept(false);
                        setNewConceptName('');
                      }}
                      className="px-4 py-2 bg-gray-500 dark:bg-gray-600 text-white rounded-lg hover:bg-gray-600 dark:hover:bg-gray-700 transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setNewConceptType('egreso');
                      setAddingConcept(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span className="text-sm font-medium">Agregar subcategoría de Egresos</span>
                  </button>
                )}
              </td>
            </tr>

            {/* Totales de Egresos */}
            {egresosTotales.map(concept => (
              <tr key={concept.id} className="bg-gradient-to-r from-red-100 to-red-200 dark:from-red-900/30 dark:to-red-800/30 border-t-4 border-red-400 dark:border-red-600">
                <td className="p-2 font-bold text-red-900 dark:text-red-200 text-xs sticky left-0 bg-gradient-to-r from-red-100 to-red-200 dark:from-red-900/30 dark:to-red-800/30 z-10 border-r-2 border-red-400 dark:border-red-600">
                  {concept.name}
                </td>
                <td className="p-2 bg-red-100 dark:bg-red-900/20 border-r-2 border-red-300 dark:border-red-700"></td>
                {MONTHS.map(month => {
                  // Calcular totales de presupuesto ajustado y real para este mes
                  let totalPresupuestoAjustado = 0;
                  let totalReal = 0;
                  
                  egresosConcepts.forEach(egresoConcept => {
                    const presupuestoBase = values.find(v => v.concept_id === egresoConcept.id && v.month === 1)?.presupuesto || 0;
                    const presupuestoAjustado = calculateValueWithIPC(egresoConcept.id, month.num, presupuestoBase);
                    totalPresupuestoAjustado += presupuestoAjustado;
                    
                    const valueCurrentMonth = values.find(v => v.concept_id === egresoConcept.id && v.month === month.num);
                    const real = valueCurrentMonth?.real !== null && valueCurrentMonth?.real !== undefined 
                      ? valueCurrentMonth.real 
                      : presupuestoAjustado;
                    totalReal += real;
                  });
                  
                  const diferenciaPorcentual = totalPresupuestoAjustado !== 0
                    ? ((totalReal - totalPresupuestoAjustado) / Math.abs(totalPresupuestoAjustado)) * 100
                    : null;
                  
                  return (
                    <React.Fragment key={month.num}>
                      <td className="p-1.5 text-right font-bold text-red-900 dark:text-red-200 text-xs border-l-2 border-red-300 dark:border-red-700 bg-red-100 dark:bg-red-900/20">
                        {formatNumber(Math.abs(totalPresupuestoAjustado))}
                      </td>
                      <td className="p-1.5 text-right font-bold text-red-900 dark:text-red-200 text-xs bg-red-100 dark:bg-red-900/20">
                        {formatNumber(Math.abs(totalReal))}
                      </td>
                      <td className="p-1.5 text-right font-bold bg-red-100 dark:bg-red-900/20 border-r border-red-300 dark:border-red-700">
                        <div className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                          diferenciaPorcentual === null 
                            ? 'text-gray-400 dark:text-gray-500'
                            : diferenciaPorcentual > 0
                            ? 'text-red-800 dark:text-red-300 bg-red-200 dark:bg-red-800/30'
                            : diferenciaPorcentual < 0
                            ? 'text-green-800 dark:text-green-300 bg-green-200 dark:bg-green-800/30'
                            : 'text-gray-600 dark:text-gray-400'
                        }`}>
                          {diferenciaPorcentual !== null 
                            ? `${diferenciaPorcentual >= 0 ? '+' : ''}${diferenciaPorcentual.toFixed(2)}%`
                            : '-'
                          }
                        </div>
                      </td>
                    </React.Fragment>
                  );
                })}
                <td className="p-1.5 text-right font-bold text-red-900 dark:text-red-200 text-xs bg-red-200 dark:bg-red-900/40 border-l-2 border-red-400 dark:border-red-600">
                  {formatNumber(
                    Math.abs(MONTHS.reduce((sum, month) => sum + (totals.egresosByMonth[month.num] || 0), 0))
                  )}
                </td>
              </tr>
            ))}

            {/* Superávit | Déficit */}
            <tr className="bg-yellow-50 dark:bg-yellow-900/20 border-t-4 border-gray-400">
              <td className="p-2 font-bold text-xs text-gray-900 dark:text-white sticky left-0 bg-yellow-50 dark:bg-yellow-900/20 z-10 border-r border-gray-200 dark:border-slate-600">
                Superávit | Déficit
              </td>
              <td className="p-2 bg-yellow-50 dark:bg-yellow-900/20 border-r-2 border-gray-300 dark:border-slate-600"></td>
              {MONTHS.map(month => {
                // Calcular superávit/déficit usando la misma lógica que totals
                let ingresosPresupuesto = 0;
                let egresosPresupuesto = 0;
                let ingresosReal = 0;
                let egresosReal = 0;
                
                concepts.forEach(concept => {
                  if (concept.is_total) return;
                  
                  const presupuestoBase = values.find(v => v.concept_id === concept.id && v.month === 1)?.presupuesto || 0;
                  const presupuestoAjustado = calculateValueWithIPC(concept.id, month.num, presupuestoBase);
                  const valueCurrentMonth = values.find(v => v.concept_id === concept.id && v.month === month.num);
                  const real = valueCurrentMonth?.real !== null && valueCurrentMonth?.real !== undefined 
                    ? valueCurrentMonth.real 
                    : presupuestoAjustado;
                  
                  if (concept.concept_type === 'ingreso') {
                    ingresosPresupuesto += presupuestoAjustado;
                    ingresosReal += real;
                  } else {
                    egresosPresupuesto += Math.abs(presupuestoAjustado);
                    egresosReal += Math.abs(real);
                  }
                });
                
                const superavitPresupuesto = ingresosPresupuesto - egresosPresupuesto;
                const superavitReal = ingresosReal - egresosReal;
                const diferenciaPorcentual = superavitPresupuesto !== 0
                  ? ((superavitReal - superavitPresupuesto) / Math.abs(superavitPresupuesto)) * 100
                  : null;
                
                return (
                  <React.Fragment key={month.num}>
                    <td className="p-1.5 text-right font-bold text-xs text-gray-900 dark:text-white border-l-2 border-gray-300 dark:border-slate-600 bg-yellow-50 dark:bg-yellow-900/20">
                      {formatNumber(superavitPresupuesto)}
                    </td>
                    <td className="p-1.5 text-right font-bold text-xs text-gray-900 dark:text-white bg-yellow-50 dark:bg-yellow-900/20">
                      {formatNumber(superavitReal)}
                    </td>
                    <td className="p-1.5 text-right font-bold bg-yellow-50 dark:bg-yellow-900/20 border-r border-gray-300 dark:border-slate-600">
                      <div className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                        diferenciaPorcentual === null 
                          ? 'text-gray-400 dark:text-gray-500'
                          : diferenciaPorcentual > 0
                          ? 'text-green-800 dark:text-green-300 bg-green-200 dark:bg-green-800/30'
                          : diferenciaPorcentual < 0
                          ? 'text-red-800 dark:text-red-300 bg-red-200 dark:bg-red-800/30'
                          : 'text-gray-600 dark:text-gray-400'
                      }`}>
                        {diferenciaPorcentual !== null 
                          ? `${diferenciaPorcentual >= 0 ? '+' : ''}${diferenciaPorcentual.toFixed(2)}%`
                          : '-'
                        }
                      </div>
                    </td>
                  </React.Fragment>
                );
              })}
              <td className="p-1.5 text-right font-bold text-xs text-gray-900 dark:text-white bg-yellow-100 dark:bg-yellow-900/30 border-l-2 border-gray-400 dark:border-slate-500">
                {formatNumber(totals.acumulado)}
              </td>
            </tr>

            {/* Acumulado */}
            <tr className="bg-blue-50 dark:bg-blue-900/20 border-t-2 border-gray-300">
              <td className="p-2 font-bold text-xs text-gray-900 dark:text-white sticky left-0 bg-blue-50 dark:bg-blue-900/20 z-10 border-r border-gray-200 dark:border-slate-600">
                Acumulado
              </td>
              <td className="p-2 bg-blue-50 dark:bg-blue-900/20 border-r-2 border-gray-300 dark:border-slate-600"></td>
              {MONTHS.map((month, index) => {
                // Calcular acumulado usando la misma lógica que totals
                let acumuladoPresupuesto = 0;
                let acumuladoReal = 0;
                
                MONTHS.slice(0, index + 1).forEach(m => {
                  let ingresosPresupuesto = 0;
                  let egresosPresupuesto = 0;
                  let ingresosReal = 0;
                  let egresosReal = 0;
                  
                  concepts.forEach(concept => {
                    if (concept.is_total) return;
                    
                    const presupuestoBase = values.find(v => v.concept_id === concept.id && v.month === 1)?.presupuesto || 0;
                    const presupuestoAjustado = calculateValueWithIPC(concept.id, m.num, presupuestoBase);
                    const valueCurrentMonth = values.find(v => v.concept_id === concept.id && v.month === m.num);
                    const real = valueCurrentMonth?.real !== null && valueCurrentMonth?.real !== undefined 
                      ? valueCurrentMonth.real 
                      : presupuestoAjustado;
                    
                    if (concept.concept_type === 'ingreso') {
                      ingresosPresupuesto += presupuestoAjustado;
                      ingresosReal += real;
                    } else {
                      egresosPresupuesto += Math.abs(presupuestoAjustado);
                      egresosReal += Math.abs(real);
                    }
                  });
                  
                  acumuladoPresupuesto += (ingresosPresupuesto - egresosPresupuesto);
                  acumuladoReal += (ingresosReal - egresosReal);
                });
                
                const diferenciaPorcentual = acumuladoPresupuesto !== 0
                  ? ((acumuladoReal - acumuladoPresupuesto) / Math.abs(acumuladoPresupuesto)) * 100
                  : null;
                
                return (
                  <React.Fragment key={month.num}>
                    <td className="p-1.5 text-right font-bold text-xs text-gray-900 dark:text-white border-l-2 border-gray-300 dark:border-slate-600 bg-blue-50 dark:bg-blue-900/20">
                      {formatNumber(acumuladoPresupuesto)}
                    </td>
                    <td className="p-1.5 text-right font-bold text-xs text-gray-900 dark:text-white bg-blue-50 dark:bg-blue-900/20">
                      {formatNumber(acumuladoReal)}
                    </td>
                    <td className="p-1.5 text-right font-bold bg-blue-50 dark:bg-blue-900/20 border-r border-gray-300 dark:border-slate-600">
                      <div className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                        diferenciaPorcentual === null 
                          ? 'text-gray-400 dark:text-gray-500'
                          : diferenciaPorcentual > 0
                          ? 'text-green-800 dark:text-green-300 bg-green-200 dark:bg-green-800/30'
                          : diferenciaPorcentual < 0
                          ? 'text-red-800 dark:text-red-300 bg-red-200 dark:bg-red-800/30'
                          : 'text-gray-600 dark:text-gray-400'
                      }`}>
                        {diferenciaPorcentual !== null 
                          ? `${diferenciaPorcentual >= 0 ? '+' : ''}${diferenciaPorcentual.toFixed(2)}%`
                          : '-'
                        }
                      </div>
                    </td>
                  </React.Fragment>
                );
              })}
              <td className="p-1.5 text-right font-bold text-xs text-gray-900 dark:text-white bg-blue-100 dark:bg-blue-900/30 border-l-2 border-gray-400 dark:border-slate-500">
                {formatNumber(totals.acumulado)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Modal de IPC */}
      {showIpcModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Configurar IPC Mensual</h3>
              <button
                onClick={() => setShowIpcModal(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {MONTHS.map(month => {
                  const ipc = ipcValues.find(i => i.month === month.num);
                  const inputKey = `ipc_${month.num}`;
                  return (
                    <div key={month.num} className="flex items-center gap-4">
                      <label className="w-32 font-medium text-gray-900 dark:text-white">
                        {month.fullName}:
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={editingIpc[inputKey] !== undefined
                          ? editingIpc[inputKey]
                          : ipc ? ipc.ipc_percentage.toString() : ''}
                        onChange={(e) => {
                          const formatted = formatDecimalWhileTyping(e.target.value);
                          setEditingIpc(prev => ({
                            ...prev,
                            [inputKey]: formatted
                          }));
                        }}
                        onBlur={(e) => {
                          handleUpdateIPC(month.num, e.target.value);
                          setEditingIpc(prev => {
                            const newState = { ...prev };
                            delete newState[inputKey];
                            return newState;
                          });
                        }}
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                        placeholder="0.00"
                      />
                      <span className="text-gray-500 dark:text-gray-400">%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
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
