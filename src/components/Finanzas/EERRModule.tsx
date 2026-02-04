/**
 * Módulo de EERR (Estado de Resultados) - Rediseñado
 * Estructura jerárquica: Conceptos principales con sub-conceptos
 * Cada concepto muestra la sumatoria total de sus sub-conceptos
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Plus, Trash2, Edit, GripVertical, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../contexts/TenantContext';
import { useAuth } from '../../contexts/AuthContext';
import { useMobile } from '../../hooks/useMobile';
import { AlertModal } from '../Common/AlertModal';

// Función para formatear números con formato de dinero
const formatNumber = (value: number): string => {
  if (value === 0 || value === null || value === undefined) return '$0.00';
  
  // Usar formato de moneda con separadores de miles y 2 decimales
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

// Función para formatear porcentajes (2 decimales)
const formatPercent = (value: number): string => {
  if (value === 0 || value === null || value === undefined) return '0.00';
  
  return value.toFixed(2);
};

// Función para formatear número para input (formato de dinero sin símbolo $, preservar decimales exactos)
const formatNumberForInput = (value: number | string): string => {
  if (value === 0 || value === null || value === undefined) return '';
  
  // Si es string, devolverlo tal cual (ya está formateado)
  if (typeof value === 'string') {
    return value;
  }
  
  // Si es número, convertir a string preservando todos los decimales
  let valueStr = value.toString();
  
  // Si tiene notación científica, usar toFixed con más decimales
  if (valueStr.includes('e') || valueStr.includes('E')) {
    valueStr = value.toFixed(10);
  }
  
  // Separar parte entera y decimal
  const parts = valueStr.split('.');
  const integerPart = parts[0];
  const decimalPart = parts[1] || '';
  
  // Formatear parte entera con puntos cada 3 dígitos
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  
  // Agregar decimales (preservar todos, pero mostrar mínimo 2)
  if (decimalPart) {
    // Si tiene menos de 2 decimales, agregar ceros
    const paddedDecimals = decimalPart.length < 2 ? decimalPart.padEnd(2, '0') : decimalPart;
    return `${formattedInteger}.${paddedDecimals}`;
  } else {
    // Si no tiene decimales, agregar .00
    return `${formattedInteger}.00`;
  }
};

// Función para formatear número mientras se escribe (formato de dinero)
const formatNumberWhileTyping = (inputValue: string): string => {
  if (!inputValue || inputValue.trim() === '') return '';
  
  // Remover todo excepto números, puntos y signo negativo
  let cleaned = inputValue.replace(/[^\d.-]/g, '');
  
  // Manejar signo negativo
  const isNegative = cleaned.startsWith('-');
  if (isNegative) {
    cleaned = cleaned.substring(1);
  }
  
  // Determinar si hay separador decimal (último punto seguido de 1-2 dígitos)
  const lastDot = cleaned.lastIndexOf('.');
  const hasDecimal = lastDot !== -1 && cleaned.length - lastDot - 1 <= 2;
  
  let integerPart = '';
  let decimalPart = '';
  
  if (hasDecimal) {
    // Punto como separador decimal
    integerPart = cleaned.substring(0, lastDot).replace(/\./g, '');
    decimalPart = cleaned.substring(lastDot + 1).replace(/\./g, '');
    // Limitar decimales a 2
    if (decimalPart.length > 2) {
      decimalPart = decimalPart.substring(0, 2);
    }
  } else {
    // No hay decimales, solo parte entera
    integerPart = cleaned.replace(/\./g, '');
    decimalPart = '';
  }
  
  // Formatear parte entera con puntos cada 3 dígitos
  if (integerPart) {
    integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }
  
  // Construir resultado
  let result = integerPart;
  if (decimalPart) {
    result += '.' + decimalPart;
  }
  
  // Agregar signo negativo si había
  if (isNegative) {
    result = '-' + result;
  }
  
  return result;
};

// Función para parsear número desde input formateado (remover puntos y convertir)
const parseFormattedNumber = (formattedValue: string): number => {
  if (!formattedValue || formattedValue.trim() === '') return 0;
  
  let cleaned = formattedValue.trim();
  
  // Manejar signo negativo
  const isNegative = cleaned.startsWith('-');
  if (isNegative) {
    cleaned = cleaned.substring(1);
  }
  
  // Remover todos los puntos (separadores de miles)
  // El último punto puede ser decimal, verificar
  const lastDot = cleaned.lastIndexOf('.');
  if (lastDot !== -1) {
    const afterLastDot = cleaned.substring(lastDot + 1);
    // Si después del último punto hay 1-2 dígitos, es decimal
    if (afterLastDot.length <= 2 && afterLastDot.length > 0) {
      // El último punto es decimal, remover los demás puntos
      const beforeLastDot = cleaned.substring(0, lastDot).replace(/\./g, '');
      cleaned = beforeLastDot + '.' + afterLastDot;
    } else {
      // Todos los puntos son separadores de miles
      cleaned = cleaned.replace(/\./g, '');
    }
  } else {
    // No hay puntos
    cleaned = cleaned.replace(/\./g, '');
  }
  
  // Convertir a número
  const parsed = parseFloat(cleaned);
  
  // Si el parseo falla, retornar 0
  if (isNaN(parsed)) return 0;
  
  // Aplicar signo negativo si era necesario
  return isNegative ? -parsed : parsed;
};

// Tipos
type Concept = {
  id: string;
  name: string;
  display_order: number;
  is_calculated: boolean;
  calculation_type?: string | null;
};

type SubConcept = {
  id: string;
  concept_id: string;
  name: string;
  display_order: number;
};

type Value = {
  id: string;
  statement_id: string;
  sub_concept_id?: string | null;
  concept_id?: string | null;
  value: number;
};

type Statement = {
  id: string;
  tenant_id: string;
  period_year: number;
  created_by: string;
};

interface ConceptWithSubConcepts extends Concept {
  sub_concepts: SubConcept[];
  total_by_period: Record<number, number>;
}

export function EERRModule() {
  const { tenantId } = useTenant();
  const { profile } = useAuth();
  const isMobile = useMobile();
  
  const [loading, setLoading] = useState(true);
  const [concepts, setConcepts] = useState<ConceptWithSubConcepts[]>([]);
  const [statements, setStatements] = useState<Statement[]>([]);
  const [periods, setPeriods] = useState<number[]>([]);
  
  // Estados para agregar conceptos
  const [addingConcept, setAddingConcept] = useState(false);
  const [newConceptName, setNewConceptName] = useState('');
  
  // Estados para agregar sub-conceptos
  const [addingSubConcept, setAddingSubConcept] = useState<string | null>(null);
  const [newSubConceptName, setNewSubConceptName] = useState('');
  
  // Estados para editar nombres
  const [editingConceptId, setEditingConceptId] = useState<string | null>(null);
  const [editingSubConceptId, setEditingSubConceptId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  
  // Estados para valores
  const [values, setValues] = useState<Value[]>([]);
  const inputValues = useRef<Record<string, string>>({});
  const saveTimeouts = useRef<Record<string, NodeJS.Timeout>>({});
  const [editingInputs, setEditingInputs] = useState<Record<string, string>>({}); // Estado para inputs editables
  
  // Drag and drop
  const [draggedConceptId, setDraggedConceptId] = useState<string | null>(null);
  const [draggedSubConceptId, setDraggedSubConceptId] = useState<string | null>(null);
  
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

  // Cargar datos
  useEffect(() => {
    if (tenantId) {
      loadData();
    }
  }, [tenantId]);

  // Limpiar timeouts
  useEffect(() => {
    return () => {
      Object.values(saveTimeouts.current).forEach(timeout => {
        if (timeout) clearTimeout(timeout);
      });
    };
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Cargar statements
      const { data: statementsData, error: statementsError } = await supabase
        .from('eerr_statements')
        .select('*')
        .eq('tenant_id', tenantId!)
        .order('period_year', { ascending: false });

      if (statementsError) throw statementsError;
      
      // Corregir statements con año 2027 a 2026
      const statementsToUpdate = (statementsData || []).filter(s => s.period_year === 2027);
      if (statementsToUpdate.length > 0) {
        for (const stmt of statementsToUpdate) {
          // Verificar si ya existe un statement para 2026
          const existing2026 = statementsData?.find(s => s.period_year === 2026 && s.id !== stmt.id);
          if (existing2026) {
            // Si existe 2026, mover los valores al statement de 2026 y eliminar el de 2027
            await supabase
              .from('eerr_values')
              .update({ statement_id: existing2026.id })
              .eq('statement_id', stmt.id);
            
            await supabase
              .from('eerr_statements')
              .delete()
              .eq('id', stmt.id);
          } else {
            // Si no existe 2026, actualizar el statement de 2027 a 2026
            await supabase
              .from('eerr_statements')
              .update({ period_year: 2026 })
              .eq('id', stmt.id);
          }
        }
        // Recargar statements después de la corrección
        const { data: updatedStatements, error: reloadError } = await supabase
          .from('eerr_statements')
          .select('*')
          .eq('tenant_id', tenantId!)
          .order('period_year', { ascending: false });
        
        if (reloadError) throw reloadError;
        setStatements(updatedStatements || []);
      } else {
        setStatements(statementsData || []);
      }

      // Extraer períodos de los statements actualizados
      const currentStatements = statementsToUpdate.length > 0 
        ? (await supabase.from('eerr_statements').select('*').eq('tenant_id', tenantId!)).data || statementsData || []
        : statementsData || [];
      
      let uniquePeriods = [...new Set(currentStatements.map(s => s.period_year) || [])];
      
      if (uniquePeriods.length === 0) {
        uniquePeriods.push(2026); // Año por defecto
      }
      setPeriods(uniquePeriods);

      // Cargar conceptos
      const { data: conceptsData, error: conceptsError } = await supabase
        .from('eerr_concepts')
        .select('*')
        .eq('tenant_id', tenantId!)
        .order('display_order', { ascending: true });

      if (conceptsError) throw conceptsError;

      // Cargar sub-conceptos
      const { data: subConceptsData, error: subConceptsError } = await supabase
        .from('eerr_sub_concepts')
        .select('*')
        .eq('tenant_id', tenantId!)
        .order('display_order', { ascending: true });

      if (subConceptsError) throw subConceptsError;

      // Cargar valores - ahora vienen como texto desde la BD
      const { data: valuesData, error: valuesError } = await supabase
        .from('eerr_values')
        .select('*')
        .eq('tenant_id', tenantId!);

      if (valuesError) throw valuesError;
      
      // Preservar los valores exactamente como vienen de la BD (como string)
      // Los valores están guardados en unidades reales, pero se muestran en miles
      // Dividir por 1000 para mostrar en miles
      // Cargar valores exactamente como están en la BD (sin modificar)
      setValues((valuesData || []).map(v => {
        // El valor viene como número desde la BD, preservarlo exactamente
        const numValue = typeof v.value === 'string' ? parseFloat(v.value) : (v.value || 0);
        
        return {
          ...v,
          value: numValue // Valor exacto de la BD, sin modificaciones
        };
      }));

      // Combinar conceptos con sub-conceptos y calcular totales
      const conceptsWithSubs: ConceptWithSubConcepts[] = (conceptsData || []).map(concept => {
        const subConcepts = (subConceptsData || []).filter(sc => sc.concept_id === concept.id);
        
        // Calcular total por período
        const total_by_period: Record<number, number> = {};
        uniquePeriods.forEach(period => {
          const statement = statementsData?.find(s => s.period_year === period);
          if (statement) {
            total_by_period[period] = subConcepts.reduce((sum, subConcept) => {
              const value = valuesData?.find(
                v => v.statement_id === statement.id && v.sub_concept_id === subConcept.id
              );
              return sum + (value?.value || 0);
            }, 0);
          }
        });

        return {
          ...concept,
          sub_concepts: subConcepts,
          total_by_period,
        };
      });

      setConcepts(conceptsWithSubs);

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

  // Agregar período
  const handleAddPeriod = async () => {
    try {
      const newPeriod = 2026; // Año por defecto
      const existing = statements.find(s => s.period_year === newPeriod);
      
      if (existing) {
        setAlertModal({
          isOpen: true,
          title: 'Aviso',
          message: 'Ya existe un período para este año',
          type: 'warning',
        });
        return;
      }

      const { data, error } = await supabase
        .from('eerr_statements')
        .insert({
          tenant_id: tenantId!,
          period_year: newPeriod,
          created_by: profile?.id!,
        })
        .select()
        .single();

      if (error) throw error;

      setStatements([...statements, data]);
      setPeriods([...periods, newPeriod].sort((a, b) => a - b));
      await loadData();
    } catch (error: any) {
      setAlertModal({
        isOpen: true,
        title: 'Error',
        message: error.message || 'Error al agregar período',
        type: 'error',
      });
    }
  };

  // Eliminar período
  const handleDeletePeriod = async (period: number) => {
    if (!confirm(`¿Estás seguro de que deseas eliminar el período ${period}?`)) {
      return;
    }

    try {
      const statement = statements.find(s => s.period_year === period);
      if (statement) {
        // Eliminar valores primero
        await supabase
          .from('eerr_values')
          .delete()
          .eq('statement_id', statement.id);

        // Eliminar statement
        await supabase
          .from('eerr_statements')
          .delete()
          .eq('id', statement.id);

        setStatements(statements.filter(s => s.id !== statement.id));
        setPeriods(periods.filter(p => p !== period));
        await loadData();
      }
    } catch (error: any) {
      setAlertModal({
        isOpen: true,
        title: 'Error',
        message: error.message || 'Error al eliminar período',
        type: 'error',
      });
    }
  };

  // Agregar concepto
  const handleAddConcept = async () => {
    if (!newConceptName.trim()) {
      setAlertModal({
        isOpen: true,
        title: 'Error',
        message: 'El nombre del concepto no puede estar vacío',
        type: 'error',
      });
      return;
    }

    try {
      const maxOrder = concepts.length > 0 
        ? Math.max(...concepts.map(c => c.display_order)) 
        : 0;

      const { data, error } = await supabase
        .from('eerr_concepts')
        .insert({
          tenant_id: tenantId!,
          name: newConceptName.trim(),
          display_order: maxOrder + 1,
          is_calculated: false,
        })
        .select()
        .single();

      if (error) throw error;

      setAddingConcept(false);
      setNewConceptName('');
      await loadData();
    } catch (error: any) {
      setAlertModal({
        isOpen: true,
        title: 'Error',
        message: error.message || 'Error al crear concepto',
        type: 'error',
      });
    }
  };

  // Eliminar concepto
  const handleDeleteConcept = async (conceptId: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este concepto y todos sus sub-conceptos?')) {
      return;
    }

    try {
      // Eliminar valores asociados
      await supabase
        .from('eerr_values')
        .delete()
        .or(`sub_concept_id.in.(${concepts.find(c => c.id === conceptId)?.sub_concepts.map(sc => sc.id).join(',') || ''}),concept_id.eq.${conceptId}`);

      // Eliminar sub-conceptos
      await supabase
        .from('eerr_sub_concepts')
        .delete()
        .eq('concept_id', conceptId);

      // Eliminar concepto
      await supabase
        .from('eerr_concepts')
        .delete()
        .eq('id', conceptId);

      await loadData();
    } catch (error: any) {
      setAlertModal({
        isOpen: true,
        title: 'Error',
        message: error.message || 'Error al eliminar concepto',
        type: 'error',
      });
    }
  };

  // Agregar sub-concepto
  const handleAddSubConcept = async (conceptId: string) => {
    if (!newSubConceptName.trim()) {
      return;
    }

    try {
      const concept = concepts.find(c => c.id === conceptId);
      const maxOrder = concept?.sub_concepts.length > 0
        ? Math.max(...concept.sub_concepts.map(sc => sc.display_order))
        : 0;

      const { data: newSubConcept, error } = await supabase
        .from('eerr_sub_concepts')
        .insert({
          concept_id: conceptId,
          tenant_id: tenantId!,
          name: newSubConceptName.trim(),
          display_order: maxOrder + 1,
        })
        .select()
        .single();

      if (error) throw error;

      // Actualizar estado local sin recargar toda la página
      setConcepts(prevConcepts => 
        prevConcepts.map(c => {
          if (c.id === conceptId) {
            return {
              ...c,
              sub_concepts: [...c.sub_concepts, newSubConcept],
            };
          }
          return c;
        })
      );

      setAddingSubConcept(null);
      setNewSubConceptName('');
    } catch (error: any) {
      setAlertModal({
        isOpen: true,
        title: 'Error',
        message: error.message || 'Error al crear sub-concepto',
        type: 'error',
      });
    }
  };

  // Eliminar sub-concepto
  const handleDeleteSubConcept = async (subConceptId: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este sub-concepto?')) {
      return;
    }

    try {
      // Eliminar valores
      await supabase
        .from('eerr_values')
        .delete()
        .eq('sub_concept_id', subConceptId);

      // Eliminar sub-concepto
      await supabase
        .from('eerr_sub_concepts')
        .delete()
        .eq('id', subConceptId);

      await loadData();
    } catch (error: any) {
      setAlertModal({
        isOpen: true,
        title: 'Error',
        message: error.message || 'Error al eliminar sub-concepto',
        type: 'error',
      });
    }
  };

  // Actualizar nombre de concepto
  const handleUpdateConceptName = async (conceptId: string, newName: string) => {
    if (!newName.trim()) {
      setEditingConceptId(null);
      return;
    }

    try {
      const { error } = await supabase
        .from('eerr_concepts')
        .update({ name: newName.trim() })
        .eq('id', conceptId);

      if (error) throw error;

      setEditingConceptId(null);
      await loadData();
    } catch (error: any) {
      setAlertModal({
        isOpen: true,
        title: 'Error',
        message: error.message || 'Error al actualizar concepto',
        type: 'error',
      });
    }
  };

  // Actualizar nombre de sub-concepto
  const handleUpdateSubConceptName = async (subConceptId: string, newName: string) => {
    if (!newName.trim()) {
      setEditingSubConceptId(null);
      return;
    }

    try {
      const { error } = await supabase
        .from('eerr_sub_concepts')
        .update({ name: newName.trim() })
        .eq('id', subConceptId);

      if (error) throw error;

      setEditingSubConceptId(null);
      await loadData();
    } catch (error: any) {
      setAlertModal({
        isOpen: true,
        title: 'Error',
        message: error.message || 'Error al actualizar sub-concepto',
        type: 'error',
      });
    }
  };

  // Recalcular totales localmente sin recargar desde BD
  const recalculateTotals = () => {
    setConcepts(prevConcepts => {
      return prevConcepts.map(concept => {
        const total_by_period: Record<number, number> = {};
        periods.forEach(period => {
          const statement = statements.find(s => s.period_year === period);
          if (statement) {
            total_by_period[period] = concept.sub_concepts.reduce((sum, subConcept) => {
              const value = values.find(
                v => v.statement_id === statement.id && v.sub_concept_id === subConcept.id
              );
              return sum + (value?.value || 0);
            }, 0);
          }
        });
        return { ...concept, total_by_period };
      });
    });
  };

  // Actualizar valor
  const handleUpdateValue = async (subConceptId: string, period: number, newValue: string) => {
    try {
      // Parsear el valor formateado a número normal (sin formato)
      const parsedValue = parseFormattedNumber(newValue || '0');
      
      let statement = statements.find(s => s.period_year === period);
      
      if (!statement) {
        const { data: newStatement, error: statementError } = await supabase
          .from('eerr_statements')
          .insert({
            tenant_id: tenantId!,
            period_year: period,
            created_by: profile?.id!,
          })
          .select()
          .single();

        if (statementError) throw statementError;
        statement = newStatement;
        setStatements(prev => [...prev, newStatement]);
        setPeriods(prev => [...prev, period].sort((a, b) => a - b));
      }

      // Buscar valor existente
      const existingValue = values.find(
        v => v.statement_id === statement.id && v.sub_concept_id === subConceptId
      );

      // Actualizar estado local INMEDIATAMENTE (optimistic update)
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
          statement_id: statement.id,
          sub_concept_id: subConceptId,
          tenant_id: tenantId!,
          value: parsedValue,
        }];
      }
      setValues(updatedValues);

      // Recalcular totales localmente SIN recargar (solo para el concepto afectado)
      setConcepts(prevConcepts => {
        return prevConcepts.map(concept => {
          // Solo recalcular si este concepto contiene el sub-concepto modificado
          const hasSubConcept = concept.sub_concepts.some(sc => sc.id === subConceptId);
          if (!hasSubConcept) {
            return concept; // No cambiar si no tiene el sub-concepto
          }

          const total_by_period: Record<number, number> = {};
          periods.forEach(p => {
            const stmt = statements.find(s => s.period_year === p) || (p === period ? statement : null);
            if (stmt) {
              total_by_period[p] = concept.sub_concepts.reduce((sum, subConcept) => {
                const val = updatedValues.find(
                  v => v.statement_id === stmt.id && v.sub_concept_id === subConcept.id
                );
                return sum + (val?.value || 0);
              }, 0);
            } else {
              // Mantener el total anterior si no hay statement
              total_by_period[p] = concept.total_by_period[p] || 0;
            }
          });
          return { ...concept, total_by_period };
        });
      });

      // Guardar en BD como número normal (sin formato)
      if (existingValue) {
        const { error } = await supabase
          .from('eerr_values')
          .update({ value: parsedValue }) // Guardar como número normal
          .eq('id', existingValue.id);

        if (error) throw error;
      } else {
        const { data: newValue, error } = await supabase
          .from('eerr_values')
          .insert({
            statement_id: statement.id,
            sub_concept_id: subConceptId,
            tenant_id: tenantId!,
            value: parsedValue, // Guardar como número normal
          })
          .select()
          .single();

        if (error) throw error;
        
        // Actualizar el valor temporal con el ID real
        setValues(updatedValues.map(v => 
          v.id?.startsWith('temp-') && v.sub_concept_id === subConceptId && v.statement_id === statement.id
            ? newValue
            : v
        ));
      }
    } catch (error: any) {
      // Solo recargar en caso de error
      await loadData();
      setAlertModal({
        isOpen: true,
        title: 'Error',
        message: error.message || 'Error al actualizar valor',
        type: 'error',
      });
    }
  };

  // Mover concepto (drag and drop)
  const handleMoveConcept = async (conceptId: string, newOrder: number) => {
    try {
      const { error } = await supabase
        .from('eerr_concepts')
        .update({ display_order: newOrder })
        .eq('id', conceptId);

      if (error) throw error;
      await loadData();
    } catch (error: any) {
      setAlertModal({
        isOpen: true,
        title: 'Error',
        message: error.message || 'Error al mover concepto',
        type: 'error',
      });
    }
  };

  // Drag handlers para conceptos
  const handleConceptDragStart = (e: React.DragEvent, conceptId: string) => {
    setDraggedConceptId(conceptId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleConceptDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleConceptDrop = async (e: React.DragEvent, targetConceptId: string) => {
    e.preventDefault();
    
    if (!draggedConceptId || draggedConceptId === targetConceptId) {
      setDraggedConceptId(null);
      return;
    }

    const draggedConcept = concepts.find(c => c.id === draggedConceptId);
    const targetConcept = concepts.find(c => c.id === targetConceptId);
    
    if (!draggedConcept || !targetConcept) {
      setDraggedConceptId(null);
      return;
    }

    const sortedConcepts = [...concepts].sort((a, b) => a.display_order - b.display_order);
    const draggedIndex = sortedConcepts.findIndex(c => c.id === draggedConceptId);
    const targetIndex = sortedConcepts.findIndex(c => c.id === targetConceptId);

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedConceptId(null);
      return;
    }

    const reordered = [...sortedConcepts];
    const [removed] = reordered.splice(draggedIndex, 1);
    reordered.splice(targetIndex, 0, removed);

    try {
      await Promise.all(
        reordered.map((concept, index) =>
          supabase
            .from('eerr_concepts')
            .update({ display_order: index + 1 })
            .eq('id', concept.id)
        )
      );

      await loadData();
    } catch (error: any) {
      setAlertModal({
        isOpen: true,
        title: 'Error',
        message: error.message || 'Error al mover concepto',
        type: 'error',
      });
    }

    setDraggedConceptId(null);
  };

  const handleConceptDragEnd = () => {
    setDraggedConceptId(null);
  };

  // Calcular total de ventas (primer concepto ordenado) para porcentajes
  const totalRevenueByPeriod = useMemo((): Record<number, number> => {
    const totals: Record<number, number> = {};
    periods.forEach(period => {
      if (concepts.length > 0) {
        // Ordenar conceptos por display_order y tomar el primero (Ventas)
        const sortedConcepts = [...concepts].sort((a, b) => a.display_order - b.display_order);
        const firstConcept = sortedConcepts[0];
        
        if (firstConcept) {
          // Usar el total_by_period del primer concepto (ya calculado)
          totals[period] = firstConcept.total_by_period[period] || 0;
        }
      }
    });
    return totals;
  }, [concepts, periods]);

  // Calcular márgenes acumulativos por concepto y período
  const marginsByConcept = useMemo((): Record<string, Record<number, number>> => {
    const margins: Record<string, Record<number, number>> = {};
    
    if (concepts.length === 0) return margins;

    // Ordenar conceptos por display_order
    const sortedConcepts = [...concepts].sort((a, b) => a.display_order - b.display_order);

    periods.forEach(period => {
      let previousMargin = 0;
      
      sortedConcepts.forEach((concept, index) => {
        const conceptTotal = concept.total_by_period[period] || 0;
        
        if (index === 0) {
          // El primer concepto es la base (Ventas totales)
          previousMargin = conceptTotal;
        } else {
          // Los siguientes conceptos se restan al margen anterior
          // (si el total es negativo, se resta; si es positivo, se suma)
          previousMargin = previousMargin + conceptTotal; // Suma porque conceptTotal ya puede ser negativo
        }
        
        if (!margins[concept.id]) {
          margins[concept.id] = {};
        }
        margins[concept.id][period] = previousMargin;
      });
    });

    return margins;
  }, [concepts, periods]);

  // Calcular márgenes anteriores para cada concepto (para calcular porcentajes)
  const previousMarginsByConcept = useMemo((): Record<string, Record<number, number>> => {
    const previousMargins: Record<string, Record<number, number>> = {};
    
    if (concepts.length === 0) return previousMargins;

    const sortedConcepts = [...concepts].sort((a, b) => a.display_order - b.display_order);

    periods.forEach(period => {
      let previousMargin = 0;
      
      sortedConcepts.forEach((concept, index) => {
        const conceptTotal = concept.total_by_period[period] || 0;
        
        if (index === 0) {
          // El primer concepto no tiene margen anterior (es la base)
          previousMargins[concept.id] = previousMargins[concept.id] || {};
          previousMargins[concept.id][period] = 0; // No hay margen anterior para el primero
          previousMargin = conceptTotal;
        } else {
          // Guardar el margen anterior antes de calcular el nuevo
          previousMargins[concept.id] = previousMargins[concept.id] || {};
          previousMargins[concept.id][period] = previousMargin;
          // Calcular el nuevo margen
          previousMargin = previousMargin + conceptTotal;
        }
      });
    });

    return previousMargins;
  }, [concepts, periods]);

  // Calcular porcentaje de cambio del margen respecto al margen anterior
  // Muestra el cambio porcentual: (cambio_absoluto / margen_anterior) * 100
  // Donde cambio_absoluto = margen_actual - margen_anterior
  const calculatePercentageOfPreviousMargin = (currentMargin: number, previousMargin: number): number | null => {
    if (previousMargin === 0) return null;
    const change = currentMargin - previousMargin;
    return (change / Math.abs(previousMargin)) * 100;
  };

  // Calcular porcentaje sobre ventas
  const calculatePercentageOfRevenue = (value: number, revenue: number): number | null => {
    if (revenue === 0) return null;
    return (value / Math.abs(revenue)) * 100;
  };

  const sortedPeriods = useMemo(() => {
    return [...periods].sort((a, b) => a - b);
  }, [periods]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600 dark:text-gray-400">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-2 sm:space-y-3">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-3 -mx-3 sm:-mx-4 md:-mx-6 -mt-3 sm:-mt-4 md:-mt-6 mb-2 sm:mb-3">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Estado de Resultados (EERR)</h1>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
              Gestiona conceptos y sub-conceptos con sumatorias automáticas
            </p>
          </div>
        <div className="flex gap-2">
          <button
            onClick={() => setAddingConcept(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Agregar Concepto
          </button>
          <button
            onClick={handleAddPeriod}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Agregar Período
          </button>
        </div>
        </div>
      </div>

      {/* Modal para agregar concepto */}
      {addingConcept && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Agregar Nuevo Concepto</h3>
            <input
              type="text"
              value={newConceptName}
              onChange={(e) => setNewConceptName(e.target.value)}
              placeholder="Nombre del concepto"
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white mb-4"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleAddConcept();
                } else if (e.key === 'Escape') {
                  setAddingConcept(false);
                  setNewConceptName('');
                }
              }}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setAddingConcept(false);
                  setNewConceptName('');
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-slate-600 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-500"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddConcept}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Crear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabla */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead>
            <tr className="border-b-2 border-gray-200 dark:border-slate-700">
              <th className="text-left p-3 font-semibold text-gray-900 dark:text-white text-sm sticky left-0 bg-white dark:bg-slate-800 z-10">
                Concepto
              </th>
              {sortedPeriods.map(period => (
                <th key={period} className="text-right p-3 font-semibold text-gray-900 dark:text-white min-w-[150px] text-sm">
                  <div className="flex items-center justify-end gap-2">
                    <span>{period}</span>
                    {periods.length > 1 && (
                      <button
                        onClick={() => handleDeletePeriod(period)}
                        className="text-red-600 hover:text-red-800 dark:text-red-400"
                        title="Eliminar período"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {concepts.map((concept) => (
              <React.Fragment key={concept.id}>
                {/* Fila del concepto principal */}
                <tr
                  className={`border-b border-gray-200 dark:border-slate-700 bg-yellow-50 dark:bg-yellow-900/20 ${
                    draggedConceptId === concept.id ? 'opacity-50' : ''
                  }`}
                  draggable
                  onDragStart={(e) => handleConceptDragStart(e, concept.id)}
                  onDragOver={handleConceptDragOver}
                  onDrop={(e) => handleConceptDrop(e, concept.id)}
                  onDragEnd={handleConceptDragEnd}
                >
                  <td className="p-3 sticky left-0 bg-yellow-50 dark:bg-yellow-900/20 z-10">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 dark:text-gray-500 cursor-move" title="Arrastrar para reordenar">
                        <GripVertical className="w-4 h-4" />
                      </span>
                      {editingConceptId === concept.id ? (
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onBlur={() => handleUpdateConceptName(concept.id, editingName)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleUpdateConceptName(concept.id, editingName);
                            } else if (e.key === 'Escape') {
                              setEditingConceptId(null);
                            }
                          }}
                          className="flex-1 px-2 py-1 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm font-semibold"
                          autoFocus
                        />
                      ) : (
                        <span 
                          className="font-semibold text-gray-900 dark:text-white cursor-pointer"
                          onClick={() => {
                            setEditingConceptId(concept.id);
                            setEditingName(concept.name);
                          }}
                        >
                          {concept.name}
                        </span>
                      )}
                      <button
                        onClick={() => setAddingSubConcept(concept.id)}
                        className="text-green-600 hover:text-green-800 dark:text-green-400"
                        title="Agregar sub-concepto"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteConcept(concept.id)}
                        className="text-red-600 hover:text-red-800 dark:text-red-400"
                        title="Eliminar concepto"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                  {sortedPeriods.map(period => {
                    const total = concept.total_by_period[period] || 0;
                    const revenueTotal = totalRevenueByPeriod[period] || 0;
                    const percentage = calculatePercentageOfRevenue(total, revenueTotal);
                    
                    return (
                      <td key={period} className="text-right p-3">
                        <div className="space-y-1">
                          <div className={`font-bold text-base ${
                            total >= 0 
                              ? 'text-green-600 dark:text-green-400' 
                              : 'text-red-600 dark:text-red-400'
                          }`}>
                            {formatNumber(total)}
                          </div>
                          {percentage !== null && (
                            <div className="text-xs text-blue-600 dark:text-blue-400">
                              {formatPercent(percentage)}% sobre ventas
                            </div>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>

                {/* Filas de sub-conceptos */}
                {concept.sub_concepts.map((subConcept) => (
                  <tr
                    key={subConcept.id}
                    className="border-b border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50"
                  >
                    <td className="p-3 pl-8 sticky left-0 bg-white dark:bg-slate-800 z-10">
                      <div className="flex items-center gap-2">
                        {editingSubConceptId === subConcept.id ? (
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onBlur={() => handleUpdateSubConceptName(subConcept.id, editingName)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleUpdateSubConceptName(subConcept.id, editingName);
                              } else if (e.key === 'Escape') {
                                setEditingSubConceptId(null);
                              }
                            }}
                            className="flex-1 px-2 py-1 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm"
                            autoFocus
                          />
                        ) : (
                          <span 
                            className="text-gray-700 dark:text-gray-300 cursor-pointer"
                            onClick={() => {
                              setEditingSubConceptId(subConcept.id);
                              setEditingName(subConcept.name);
                            }}
                          >
                            {subConcept.name}
                          </span>
                        )}
                        <button
                          onClick={() => handleDeleteSubConcept(subConcept.id)}
                          className="text-red-600 hover:text-red-800 dark:text-red-400"
                          title="Eliminar sub-concepto"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                    {sortedPeriods.map(period => {
                      const statement = statements.find(s => s.period_year === period);
                      const value = statement 
                        ? values.find(v => v.statement_id === statement.id && v.sub_concept_id === subConcept.id)?.value || 0
                        : 0;
                      const revenueTotal = totalRevenueByPeriod[period] || 0;
                      const percentage = calculatePercentageOfRevenue(value, revenueTotal);
                      const inputKey = `${subConcept.id}_${period}`;
                      
                      // Mostrar valor formateado o el que está siendo editado
                      const displayValue = editingInputs[inputKey] !== undefined 
                        ? editingInputs[inputKey]
                        : (value ? formatNumberForInput(value) : '');

                      return (
                        <React.Fragment key={period}>
                          <td className="text-right p-3">
                            <div className="space-y-1">
                              <input
                                type="text"
                                inputMode="decimal"
                                value={displayValue}
                                onChange={(e) => {
                                  const rawValue = e.target.value;
                                  // Formatear el número mientras se escribe
                                  const formattedValue = formatNumberWhileTyping(rawValue);
                                  
                                  // Actualizar estado local con el valor formateado
                                  setEditingInputs(prev => ({
                                    ...prev,
                                    [inputKey]: formattedValue
                                  }));
                                  // También actualizar el ref para el guardado
                                  inputValues.current[inputKey] = formattedValue;
                                }}
                              onFocus={(e) => {
                                // Al enfocar, simplemente formatear el valor actual
                                if (editingInputs[inputKey] === undefined && value !== undefined && value !== null) {
                                  const displayValue = formatNumberForInput(value);
                                  setEditingInputs(prev => ({
                                    ...prev,
                                    [inputKey]: displayValue
                                  }));
                                  inputValues.current[inputKey] = displayValue;
                                }
                              }}
                                onBlur={async (e) => {
                                  const inputValue = e.target.value.trim();
                                  const saveKey = `${subConcept.id}_${period}`;
                                  
                                  if (saveTimeouts.current[saveKey]) {
                                    clearTimeout(saveTimeouts.current[saveKey]);
                                    delete saveTimeouts.current[saveKey];
                                  }

                                  if (inputValue === '') {
                                    await handleUpdateValue(subConcept.id, period, '0');
                                    setEditingInputs(prev => {
                                      const newState = { ...prev };
                                      delete newState[inputKey];
                                      return newState;
                                    });
                                    delete inputValues.current[inputKey];
                                  } else {
                                    // Guardar el valor EXACTO que el usuario escribió (sin parsear primero)
                                    // Esto preserva todos los decimales exactamente como se escribieron
                                    await handleUpdateValue(subConcept.id, period, inputValue);
                                    
                                    // Mantener el valor original que el usuario escribió
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
                                className="w-full px-2 py-1 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm text-right"
                              />
                              {percentage !== null && (
                                <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                                  {formatPercent(percentage)}% sobre ventas
                                </div>
                              )}
                            </div>
                          </td>
                        </React.Fragment>
                      );
                    })}
                  </tr>
                ))}

                {/* Fila para agregar sub-concepto */}
                {addingSubConcept === concept.id && (
                  <tr className="border-b border-gray-100 dark:border-slate-700 bg-blue-50 dark:bg-blue-900/10">
                    <td className="p-3 pl-8 sticky left-0 bg-blue-50 dark:bg-blue-900/10 z-10">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Nombre del sub-concepto"
                          value={newSubConceptName}
                          onChange={(e) => setNewSubConceptName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleAddSubConcept(concept.id);
                            } else if (e.key === 'Escape') {
                              setAddingSubConcept(null);
                              setNewSubConceptName('');
                            }
                          }}
                          className="flex-1 px-2 py-1 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm"
                          autoFocus
                        />
                        <button
                          onClick={() => {
                            setAddingSubConcept(null);
                            setNewSubConceptName('');
                          }}
                          className="text-red-600 hover:text-red-800 dark:text-red-400"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                    {sortedPeriods.map(period => (
                      <td key={period} className="p-3"></td>
                    ))}
                  </tr>
                )}

                {/* Fila de margen al final de cada concepto */}
                <tr className="border-b-2 border-gray-300 dark:border-slate-600 bg-green-50 dark:bg-green-900/20">
                  <td className="p-3 sticky left-0 bg-green-50 dark:bg-green-900/20 z-10">
                    <div className="font-semibold text-green-700 dark:text-green-400">
                      Margen {concept.name}
                    </div>
                  </td>
                  {sortedPeriods.map(period => {
                    const margin = marginsByConcept[concept.id]?.[period] || 0;
                    const revenueTotal = totalRevenueByPeriod[period] || 0;
                    const marginPercentage = calculatePercentageOfRevenue(margin, revenueTotal);
                    
                    return (
                      <td key={period} className="text-right p-3 bg-green-50 dark:bg-green-900/20">
                        <div className="space-y-1">
                          <div className={`font-bold text-base ${
                            margin >= 0 
                              ? 'text-green-700 dark:text-green-400' 
                              : 'text-red-600 dark:text-red-400'
                          }`}>
                            {formatNumber(margin)}
                          </div>
                          {marginPercentage !== null && (
                            <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                              {formatPercent(marginPercentage)}% sobre ventas
                            </div>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {concepts.length === 0 && (
        <div className="text-center py-12 text-gray-600 dark:text-gray-400">
          <p>No hay conceptos registrados. Haz clic en "Agregar Concepto" para comenzar.</p>
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
