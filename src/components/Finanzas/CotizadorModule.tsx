/**
 * Módulo de Cotizador
 * Permite crear y gestionar cotizaciones con costos por mes
 * Incluye secciones: Servicios Profesionales, Pauta, Terceros, Gastos Logísticos, Costos Fijos
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, X, Save, FileText } from 'lucide-react';
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

// Función para parsear número desde input formateado
const parseFormattedNumber = (formattedValue: string): number => {
  if (!formattedValue || formattedValue.trim() === '') return 0;
  
  const cleaned = formattedValue.replace(/\./g, '').replace(',', '.');
  const parsed = parseFloat(cleaned);
  
  return isNaN(parsed) ? 0 : parsed;
};

interface Cotizacion {
  id: string;
  tenant_id: string;
  cliente: string;
  proyecto: string | null;
  fecha_cotizacion: string | null;
  fecha_inicio_proyecto: string | null;
  duracion_total_meses: number;
  precio_base_sin_iva: number;
  fee_comercial_porcentaje: number;
  precio_taquion_sin_iva: number;
  precio_taquion_fee_sin_iva: number;
  costo_financiero_porcentaje: number;
  valor_factura_porcentaje: number;
  incremental_iibb_recuperado: number;
  margen_total_porcentaje: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface Seccion {
  id: string;
  tenant_id: string;
  name: string;
  section_type: 'servicios_profesionales' | 'pauta' | 'terceros_integrados' | 'gastos_logisticos' | 'costos_fijos';
  markup_porcentaje: number;
  display_order: number;
  subtotal_label?: string | null;
  markup_label?: string | null;
  custom_name?: string | null; // Nombre personalizado para esta cotización
  custom_subtotal_label?: string | null; // Etiqueta personalizada de subtotal para esta cotización
  custom_markup_label?: string | null; // Etiqueta personalizada de markup para esta cotización
}

interface Concepto {
  id: string;
  cotizacion_id: string;
  seccion_id: string;
  tenant_id: string;
  name: string;
  horas: number;
  precio_unitario: number;
  display_order: number;
}

interface Valor {
  id: string;
  concepto_id: string;
  cotizacion_id: string;
  tenant_id: string;
  month: number;
  value: number;
}

const MONTHS = [
  { num: 1, name: 'Ene' },
  { num: 2, name: 'Feb' },
  { num: 3, name: 'Mar' },
  { num: 4, name: 'Abr' },
  { num: 5, name: 'May' },
  { num: 6, name: 'Jun' },
  { num: 7, name: 'Jul' },
  { num: 8, name: 'Ago' },
  { num: 9, name: 'Sep' },
  { num: 10, name: 'Oct' },
  { num: 11, name: 'Nov' },
  { num: 12, name: 'Dic' },
];

export function CotizadorModule() {
  const { tenantId } = useTenant();
  const { profile } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);
  const [currentCotizacion, setCurrentCotizacion] = useState<Cotizacion | null>(null);
  const [secciones, setSecciones] = useState<Seccion[]>([]);
  const [conceptos, setConceptos] = useState<Concepto[]>([]);
  const [valores, setValores] = useState<Valor[]>([]);
  const [customSectionNames, setCustomSectionNames] = useState<Record<string, {
    custom_name?: string | null;
    custom_subtotal_label?: string | null;
    custom_markup_label?: string | null;
  }>>({});
  
  const [editingInputs, setEditingInputs] = useState<Record<string, string>>({});
  const [editingCotizacion, setEditingCotizacion] = useState<Partial<Cotizacion>>({});
  
  // Estados para agregar conceptos
  const [addingConcepto, setAddingConcepto] = useState<string | null>(null);
  const [newConceptoName, setNewConceptoName] = useState('');
  
  // Estado para editar markups
  const [editingMarkup, setEditingMarkup] = useState<Record<string, string>>({});
  
  // Estados para editar nombres de secciones y filas
  const [editingSectionName, setEditingSectionName] = useState<Record<string, string>>({});
  const [editingSubtotalName, setEditingSubtotalName] = useState<Record<string, string>>({});
  const [editingMarkupName, setEditingMarkupName] = useState<Record<string, string>>({});
  
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

  // Cargar datos iniciales
  useEffect(() => {
    if (tenantId) {
      loadData();
    }
  }, [tenantId]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Cargar cotizaciones
      const { data: cotizacionesData, error: cotizacionesError } = await supabase
        .from('cotizaciones')
        .select('*')
        .eq('tenant_id', tenantId!)
        .order('created_at', { ascending: false });

      if (cotizacionesError) throw cotizacionesError;

      setCotizaciones(cotizacionesData || []);
      
      // No cargar automáticamente, mostrar lista primero

      // Cargar secciones
      const { data: seccionesData, error: seccionesError } = await supabase
        .from('cotizador_secciones')
        .select('*')
        .eq('tenant_id', tenantId!)
        .order('display_order', { ascending: true });

      if (seccionesError) throw seccionesError;

      if (!seccionesData || seccionesData.length === 0) {
        await initializeDefaultSecciones();
        const { data: reloadedSecciones } = await supabase
          .from('cotizador_secciones')
          .select('*')
          .eq('tenant_id', tenantId!)
          .order('display_order', { ascending: true });
        setSecciones(reloadedSecciones || []);
      } else {
        setSecciones(seccionesData);
      }
    } catch (error: any) {
      setAlertModal({
        isOpen: true,
        title: 'Error',
        message: error.message || 'Error al cargar datos',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadCotizacionData = async (cotizacionId: string) => {
    try {
      // Cargar conceptos
      const { data: conceptosData, error: conceptosError } = await supabase
        .from('cotizador_conceptos')
        .select('*')
        .eq('cotizacion_id', cotizacionId)
        .order('display_order', { ascending: true });

      if (conceptosError) throw conceptosError;
      setConceptos(conceptosData || []);

      // Cargar valores
      const { data: valoresData, error: valoresError } = await supabase
        .from('cotizador_valores')
        .select('*')
        .eq('cotizacion_id', cotizacionId);

      if (valoresError) throw valoresError;
      setValores(valoresData || []);

      // Cargar nombres personalizados de secciones para esta cotización
      const { data: customNamesData, error: customNamesError } = await supabase
        .from('cotizador_secciones_cotizacion')
        .select('seccion_id, custom_name, custom_subtotal_label, custom_markup_label')
        .eq('cotizacion_id', cotizacionId);

      if (customNamesError) {
        console.warn('Error cargando nombres personalizados de secciones:', customNamesError);
      } else {
        const customNamesMap: Record<string, {
          custom_name?: string | null;
          custom_subtotal_label?: string | null;
          custom_markup_label?: string | null;
        }> = {};
        
        customNamesData?.forEach((item: any) => {
          customNamesMap[item.seccion_id] = {
            custom_name: item.custom_name,
            custom_subtotal_label: item.custom_subtotal_label,
            custom_markup_label: item.custom_markup_label,
          };
        });
        
        setCustomSectionNames(customNamesMap);
        
        // Actualizar secciones con nombres personalizados
        setSecciones(prevSecciones => prevSecciones.map(sec => ({
          ...sec,
          custom_name: customNamesMap[sec.id]?.custom_name || null,
          custom_subtotal_label: customNamesMap[sec.id]?.custom_subtotal_label || null,
          custom_markup_label: customNamesMap[sec.id]?.custom_markup_label || null,
        })));
      }
    } catch (error: any) {
      console.error('Error cargando datos de cotización:', error);
    }
  };

  const initializeDefaultSecciones = async () => {
    const defaultSecciones = [
      { name: 'SERVICIOS PROFESIONALES', type: 'servicios_profesionales' as const, markup: 100, order: 1 },
      { name: 'PAUTA', type: 'pauta' as const, markup: 10, order: 2 },
      { name: 'TERCEROS INTEGRADOS', type: 'terceros_integrados' as const, markup: 50, order: 3 },
      { name: 'GASTOS LOGÍSTICOS', type: 'gastos_logisticos' as const, markup: 50, order: 4 },
      { name: 'COSTOS FIJOS', type: 'costos_fijos' as const, markup: 0, order: 5 },
    ];

    for (const sec of defaultSecciones) {
      await supabase
        .from('cotizador_secciones')
        .insert({
          tenant_id: tenantId!,
          name: sec.name,
          section_type: sec.type,
          markup_porcentaje: sec.markup,
          display_order: sec.order,
        });
    }
  };

  const createNewCotizacion = async () => {
    try {
      const { data, error } = await supabase
        .from('cotizaciones')
        .insert({
          tenant_id: tenantId!,
          cliente: 'Nuevo Cliente',
          proyecto: 'Nuevo Proyecto',
          fecha_cotizacion: new Date().toISOString().split('T')[0],
          fecha_inicio_proyecto: new Date().toISOString().split('T')[0],
          duracion_total_meses: 12,
          precio_base_sin_iva: 0,
          fee_comercial_porcentaje: 0,
          precio_taquion_sin_iva: 0,
          precio_taquion_fee_sin_iva: 0,
          costo_financiero_porcentaje: 0.03,
          valor_factura_porcentaje: 1.21,
          incremental_iibb_recuperado: 0,
          margen_total_porcentaje: 0,
          created_by: profile?.id || '',
        })
        .select()
        .single();

      if (error) throw error;

      setCurrentCotizacion(data);
      setCotizaciones([data, ...cotizaciones]);
      await loadCotizacionData(data.id);
      
      setAlertModal({
        isOpen: true,
        title: 'Éxito',
        message: 'Nueva cotización creada',
        type: 'success',
      });
    } catch (error: any) {
      setAlertModal({
        isOpen: true,
        title: 'Error',
        message: error.message || 'Error al crear cotización',
        type: 'error',
      });
    }
  };

  // Cálculos automáticos
  const calculos = useMemo(() => {
    if (!currentCotizacion) return null;

    const precioBase = currentCotizacion.precio_base_sin_iva || 0;
    const feePorcentaje = currentCotizacion.fee_comercial_porcentaje || 0;
    const feeComercial = precioBase * (feePorcentaje / 100);
    const subtotalConFee = precioBase + feeComercial;
    const precioTaquion = currentCotizacion.precio_taquion_sin_iva || 0;
    const precioTaquionFee = currentCotizacion.precio_taquion_fee_sin_iva || 0;
    const costoFinancieroPorcentaje = currentCotizacion.costo_financiero_porcentaje || 0;
    const costoFinanciero = precioTaquionFee * costoFinancieroPorcentaje;
    const valorFacturaPorcentaje = currentCotizacion.valor_factura_porcentaje || 1.21;
    const valorFactura = precioTaquionFee * valorFacturaPorcentaje;
    
    // Calcular subtotal precio de venta
    const subtotalPrecioVenta = precioTaquionFee - costoFinanciero;
    const incrementalIIBB = currentCotizacion.incremental_iibb_recuperado || 0;
    
    // Calcular resultado (precio de venta - costos)
    const totalCostos = conceptos.reduce((sum, concepto) => {
      const totalConcepto = MONTHS.reduce((monthSum, month) => {
        const valor = valores.find(
          v => v.concepto_id === concepto.id && v.month === month.num
        )?.value || 0;
        return monthSum + valor;
      }, 0);
      return sum + totalConcepto;
    }, 0);

    const resultado = subtotalPrecioVenta + incrementalIIBB - totalCostos;
    const margenTotal = subtotalPrecioVenta > 0 ? (resultado / subtotalPrecioVenta) * 100 : 0;

    return {
      feeComercial,
      subtotalConFee,
      costoFinanciero,
      valorFactura,
      subtotalPrecioVenta,
      resultado,
      margenTotal,
      totalCostos,
    };
  }, [currentCotizacion, conceptos, valores]);

  const handleSelectCotizacion = async (cotizacion: Cotizacion) => {
    setCurrentCotizacion(cotizacion);
    setEditingCotizacion({});
    setCustomSectionNames({}); // Limpiar nombres personalizados antes de cargar
    // Resetear secciones a sus valores base
    setSecciones(prevSecciones => prevSecciones.map(sec => ({
      ...sec,
      custom_name: null,
      custom_subtotal_label: null,
      custom_markup_label: null,
    })));
    await loadCotizacionData(cotizacion.id);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600 dark:text-gray-400">Cargando...</div>
      </div>
    );
  }

  // Mostrar lista de cotizaciones si no hay una seleccionada
  if (!currentCotizacion) {
    return (
      <div className="space-y-4">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Cotizador
            </h2>
            <button
              onClick={createNewCotizacion}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Nueva Cotización
            </button>
          </div>

          {cotizaciones.length === 0 ? (
            <div className="text-center py-12 text-gray-600 dark:text-gray-400">
              <p className="mb-4">No hay cotizaciones creadas.</p>
              <p>Haz clic en "Nueva Cotización" para crear una.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-gray-200 dark:border-slate-700">
                    <th className="text-left p-3 font-semibold text-gray-900 dark:text-white">Cliente</th>
                    <th className="text-left p-3 font-semibold text-gray-900 dark:text-white">Proyecto</th>
                    <th className="text-left p-3 font-semibold text-gray-900 dark:text-white">Fecha Cotización</th>
                    <th className="text-left p-3 font-semibold text-gray-900 dark:text-white">Fecha Inicio</th>
                    <th className="text-right p-3 font-semibold text-gray-900 dark:text-white">Precio Base</th>
                    <th className="text-center p-3 font-semibold text-gray-900 dark:text-white">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {cotizaciones.map(cotizacion => (
                    <tr 
                      key={cotizacion.id} 
                      className="border-b border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 cursor-pointer"
                      onClick={() => handleSelectCotizacion(cotizacion)}
                    >
                      <td className="p-3 text-gray-900 dark:text-white">{cotizacion.cliente}</td>
                      <td className="p-3 text-gray-900 dark:text-white">{cotizacion.proyecto || '-'}</td>
                      <td className="p-3 text-gray-600 dark:text-gray-400">
                        {cotizacion.fecha_cotizacion 
                          ? new Date(cotizacion.fecha_cotizacion).toLocaleDateString('es-AR')
                          : '-'
                        }
                      </td>
                      <td className="p-3 text-gray-600 dark:text-gray-400">
                        {cotizacion.fecha_inicio_proyecto 
                          ? new Date(cotizacion.fecha_inicio_proyecto).toLocaleDateString('es-AR')
                          : '-'
                        }
                      </td>
                      <td className="p-3 text-right text-gray-900 dark:text-white">
                        {formatNumber(cotizacion.precio_base_sin_iva)}
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectCotizacion(cotizacion);
                            }}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
                          >
                            Abrir
                          </button>
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (!confirm('¿Eliminar esta cotización?')) return;
                              try {
                                const { error } = await supabase
                                  .from('cotizaciones')
                                  .delete()
                                  .eq('id', cotizacion.id);

                                if (error) throw error;

                                setCotizaciones(cotizaciones.filter(c => c.id !== cotizacion.id));
                                setAlertModal({
                                  isOpen: true,
                                  title: 'Éxito',
                                  message: 'Cotización eliminada correctamente',
                                  type: 'success',
                                });
                              } catch (error: any) {
                                setAlertModal({
                                  isOpen: true,
                                  title: 'Error',
                                  message: error.message || 'Error al eliminar cotización',
                                  type: 'error',
                                });
                              }
                            }}
                            className="p-1.5 bg-red-600 hover:bg-red-700 text-white rounded"
                            title="Eliminar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <AlertModal
          isOpen={alertModal.isOpen}
          onClose={() => setAlertModal({ ...alertModal, isOpen: false })}
          title={alertModal.title}
          message={alertModal.message}
          type={alertModal.type}
        />
      </div>
    );
  }

  // Mostrar formulario de cotización cuando hay una seleccionada
  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-2 sm:space-y-3">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-4">
        <div className="flex items-center justify-between mb-2 sm:mb-3">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Cotizador
          </h2>
          <button
            onClick={() => {
              setCurrentCotizacion(null);
              setEditingCotizacion({});
              setCustomSectionNames({}); // Limpiar nombres personalizados
              // Resetear secciones a sus valores base
              setSecciones(prevSecciones => prevSecciones.map(sec => ({
                ...sec,
                custom_name: null,
                custom_subtotal_label: null,
                custom_markup_label: null,
              })));
            }}
            className="px-3 py-1.5 text-sm bg-gray-600 hover:bg-gray-700 text-white rounded-lg flex items-center gap-2"
          >
            <X className="w-4 h-4" />
            Volver a Lista
          </button>
        </div>
        
        {/* Datos de la Oportunidad y Oferta Económica - Compacto */}
        {currentCotizacion && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                DATOS DE LA OPORTUNIDAD
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5">
                    Cliente
                  </label>
                  <input
                    type="text"
                    value={editingCotizacion.cliente ?? currentCotizacion.cliente}
                    onChange={(e) => setEditingCotizacion({ ...editingCotizacion, cliente: e.target.value })}
                    className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5">
                    Proyecto
                  </label>
                  <input
                    type="text"
                    value={editingCotizacion.proyecto ?? currentCotizacion.proyecto ?? ''}
                    onChange={(e) => setEditingCotizacion({ ...editingCotizacion, proyecto: e.target.value })}
                    className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5">
                    Fecha Cotización
                  </label>
                  <input
                    type="date"
                    value={editingCotizacion.fecha_cotizacion ?? currentCotizacion.fecha_cotizacion ?? ''}
                    onChange={(e) => setEditingCotizacion({ ...editingCotizacion, fecha_cotizacion: e.target.value })}
                    className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5">
                    Fecha Inicio
                  </label>
                  <input
                    type="date"
                    value={editingCotizacion.fecha_inicio_proyecto ?? currentCotizacion.fecha_inicio_proyecto ?? ''}
                    onChange={(e) => setEditingCotizacion({ ...editingCotizacion, fecha_inicio_proyecto: e.target.value })}
                    className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5">
                    Duración (meses)
                  </label>
                  <input
                    type="number"
                    value={editingCotizacion.duracion_total_meses ?? currentCotizacion.duracion_total_meses}
                    onChange={(e) => setEditingCotizacion({ ...editingCotizacion, duracion_total_meses: parseInt(e.target.value) || 12 })}
                    className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                OFERTA ECONÓMICA
              </h3>
              <div className="space-y-1.5">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5">
                    Precio Base (Sin IVA)
                  </label>
                  <input
                    type="text"
                    value={formatNumberForInput(editingCotizacion.precio_base_sin_iva ?? currentCotizacion.precio_base_sin_iva)}
                    onChange={(e) => {
                      const parsed = parseFormattedNumber(e.target.value);
                      setEditingCotizacion({ ...editingCotizacion, precio_base_sin_iva: parsed });
                    }}
                    className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                  />
                </div>
                {calculos && (
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    <div className="text-gray-600 dark:text-gray-400">
                      Fee: {formatNumber(calculos.feeComercial)}
                    </div>
                    <div className="text-gray-600 dark:text-gray-400">
                      Subtotal: {formatNumber(calculos.subtotalConFee)}
                    </div>
                    <div className="text-gray-600 dark:text-gray-400">
                      Total: {formatNumber(calculos.subtotalConFee)}
                    </div>
                    <div className="text-xs font-semibold text-gray-900 dark:text-white">
                      Margen: {calculos.margenTotal.toFixed(2)}%
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Botón Guardar - Compacto */}
        <div className="flex justify-end mb-2">
          <button
            onClick={async () => {
              if (!currentCotizacion) return;
              try {
                const { error } = await supabase
                  .from('cotizaciones')
                  .update(editingCotizacion)
                  .eq('id', currentCotizacion.id);

                if (error) throw error;

                setCurrentCotizacion({ ...currentCotizacion, ...editingCotizacion });
                setEditingCotizacion({});
                
                // Mostrar mensaje de éxito
                setAlertModal({
                  isOpen: true,
                  title: 'Éxito',
                  message: 'Cotización guardada correctamente',
                  type: 'success',
                });
                
                // Volver a la lista automáticamente después de un breve delay
                setTimeout(() => {
                  setCurrentCotizacion(null);
                  setEditingCotizacion({});
                  loadData(); // Recargar la lista
                  setAlertModal({ ...alertModal, isOpen: false });
                }, 1500);
              } catch (error: any) {
                setAlertModal({
                  isOpen: true,
                  title: 'Error',
                  message: error.message || 'Error al guardar',
                  type: 'error',
                });
              }
            }}
            className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            Guardar Cotización
          </button>
        </div>
      </div>

      {/* Tabla de secciones y conceptos */}
      {currentCotizacion && (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg overflow-x-auto overflow-y-auto max-h-[calc(100vh-150px)]">
          <style jsx>{`
            div::-webkit-scrollbar {
              width: 12px;
              height: 12px;
            }
            div::-webkit-scrollbar-track {
              background: #1e293b; /* slate-800 */
              border-radius: 10px;
            }
            div::-webkit-scrollbar-thumb {
              background-color: #64748b; /* slate-500 */
              border-radius: 10px;
              border: 3px solid #1e293b; /* slate-800 */
            }
            div::-webkit-scrollbar-thumb:hover {
              background-color: #475569; /* slate-600 */
            }
            div::-webkit-scrollbar-button:single-button {
              background-color: #1e293b; /* slate-800 */
              display: block;
              border-style: solid;
              height: 10px;
              width: 10px;
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
          <table className="w-full min-w-[1600px]">
            <thead className="sticky top-0 z-20 bg-white dark:bg-slate-800">
              <tr className="border-b-2 border-gray-200 dark:border-slate-700">
                <th className="text-left p-3 font-semibold text-gray-900 dark:text-white text-sm sticky left-0 bg-white dark:bg-slate-800 z-30 min-w-[250px]">
                  Descripción/Mes
                </th>
                {MONTHS.map(month => (
                  <th
                    key={month.num}
                    className="text-center p-2 font-semibold text-gray-900 dark:text-white min-w-[100px] text-xs bg-white dark:bg-slate-800"
                  >
                    {month.name}
                  </th>
                ))}
                <th className="text-center p-3 font-semibold text-gray-900 dark:text-white min-w-[120px] bg-white dark:bg-slate-800">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {secciones.map(seccion => {
                const seccionConceptos = conceptos.filter(c => c.seccion_id === seccion.id);
                const seccionTotal = seccionConceptos.reduce((sum, concepto) => {
                  const conceptoTotal = MONTHS.reduce((monthSum, month) => {
                    const valor = valores.find(
                      v => v.concepto_id === concepto.id && v.month === month.num
                    )?.value || 0;
                    return monthSum + valor;
                  }, 0);
                  return sum + conceptoTotal;
                }, 0);
                const markup = seccion.markup_porcentaje || 0;
                const subtotalConMarkup = seccionTotal * (1 + markup / 100);

                return (
                  <React.Fragment key={seccion.id}>
                    {/* Header de sección */}
                    <tr className="border-b-2 border-gray-300 dark:border-slate-600">
                      <td className="p-2 bg-blue-50 dark:bg-blue-800 font-bold text-blue-900 dark:text-blue-300 sticky left-0 z-10">
                        <div className="flex items-center gap-2">
                          {editingSectionName[seccion.id] !== undefined ? (
                            <input
                              type="text"
                              value={editingSectionName[seccion.id]}
                              onChange={(e) => {
                                setEditingSectionName(prev => ({
                                  ...prev,
                                  [seccion.id]: e.target.value
                                }));
                              }}
                              onBlur={async () => {
                                if (!currentCotizacion) return;
                                
                                const newName = editingSectionName[seccion.id]?.trim() || seccion.name;
                                
                                try {
                                  // Obtener valores actuales de customSectionNames
                                  const currentCustom = customSectionNames[seccion.id] || {};
                                  
                                  // Guardar en la tabla de nombres personalizados por cotización
                                  const { error } = await supabase
                                    .from('cotizador_secciones_cotizacion')
                                    .upsert({
                                      cotizacion_id: currentCotizacion.id,
                                      seccion_id: seccion.id,
                                      tenant_id: tenantId!,
                                      custom_name: newName !== seccion.name ? newName : null,
                                      custom_subtotal_label: currentCustom.custom_subtotal_label || null,
                                      custom_markup_label: currentCustom.custom_markup_label || null,
                                    }, {
                                      onConflict: 'cotizacion_id,seccion_id'
                                    });

                                  if (error) throw error;

                                  // Actualizar estado local
                                  setSecciones(secciones.map(s => 
                                    s.id === seccion.id 
                                      ? { ...s, custom_name: newName !== seccion.name ? newName : null }
                                      : s
                                  ));

                                  setCustomSectionNames(prev => ({
                                    ...prev,
                                    [seccion.id]: {
                                      ...prev[seccion.id],
                                      custom_name: newName !== seccion.name ? newName : null,
                                    }
                                  }));

                                  setEditingSectionName(prev => {
                                    const newState = { ...prev };
                                    delete newState[seccion.id];
                                    return newState;
                                  });
                                } catch (error: any) {
                                  setAlertModal({
                                    isOpen: true,
                                    title: 'Error',
                                    message: error.message || 'Error al actualizar nombre de sección',
                                    type: 'error',
                                  });
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.currentTarget.blur();
                                } else if (e.key === 'Escape') {
                                  setEditingSectionName(prev => {
                                    const newState = { ...prev };
                                    delete newState[seccion.id];
                                    return newState;
                                  });
                                }
                              }}
                              className="flex-1 px-2 py-1 border border-blue-300 dark:border-blue-600 rounded bg-white dark:bg-slate-700 text-blue-900 dark:text-blue-300 font-bold"
                              autoFocus
                            />
                          ) : (
                            <span 
                              className="cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-700 rounded px-2 py-1"
                              onClick={() => setEditingSectionName(prev => ({
                                ...prev,
                                [seccion.id]: seccion.custom_name || seccion.name
                              }))}
                              title="Haz clic para editar"
                            >
                              {seccion.custom_name || seccion.name}
                            </span>
                          )}
                          <button
                            onClick={() => {
                              setAddingConcepto(seccion.id);
                              setNewConceptoName('');
                            }}
                            className="p-1.5 bg-green-600 hover:bg-green-700 text-white rounded transition-colors flex items-center justify-center"
                            title="Agregar concepto"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                      {MONTHS.map(month => (
                        <td key={month.num} className="p-2 bg-blue-50 dark:bg-blue-800"></td>
                      ))}
                      <td className="p-2 bg-blue-50 dark:bg-blue-800"></td>
                    </tr>

                    {/* Fila para agregar nuevo concepto */}
                    {addingConcepto === seccion.id && (
                      <tr className="border-b border-gray-200 dark:border-slate-700 bg-blue-50 dark:bg-blue-800">
                        <td className="p-3 sticky left-0 bg-blue-50 dark:bg-blue-800 z-10">
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={newConceptoName}
                              onChange={(e) => setNewConceptoName(e.target.value)}
                              onKeyDown={async (e) => {
                                if (e.key === 'Enter' && newConceptoName.trim()) {
                                  if (!currentCotizacion) return;
                                  
                                  try {
                                    const maxOrder = seccionConceptos.length > 0 
                                      ? Math.max(...seccionConceptos.map(c => c.display_order))
                                      : 0;
                                    
                                    const { data, error } = await supabase
                                      .from('cotizador_conceptos')
                                      .insert({
                                        cotizacion_id: currentCotizacion.id,
                                        seccion_id: seccion.id,
                                        tenant_id: tenantId!,
                                        name: newConceptoName.trim(),
                                        horas: 0,
                                        precio_unitario: 0,
                                        display_order: maxOrder + 1,
                                      })
                                      .select()
                                      .single();

                                    if (error) throw error;
                                    
                                    setConceptos([...conceptos, data]);
                                    setAddingConcepto(null);
                                    setNewConceptoName('');
                                    await loadCotizacionData(currentCotizacion.id);
                                  } catch (error: any) {
                                    setAlertModal({
                                      isOpen: true,
                                      title: 'Error',
                                      message: error.message || 'Error al agregar concepto',
                                      type: 'error',
                                    });
                                  }
                                } else if (e.key === 'Escape') {
                                  setAddingConcepto(null);
                                  setNewConceptoName('');
                                }
                              }}
                              onBlur={async () => {
                                if (newConceptoName.trim() && currentCotizacion) {
                                  try {
                                    const maxOrder = seccionConceptos.length > 0 
                                      ? Math.max(...seccionConceptos.map(c => c.display_order))
                                      : 0;
                                    
                                    const { data, error } = await supabase
                                      .from('cotizador_conceptos')
                                      .insert({
                                        cotizacion_id: currentCotizacion.id,
                                        seccion_id: seccion.id,
                                        tenant_id: tenantId!,
                                        name: newConceptoName.trim(),
                                        horas: 0,
                                        precio_unitario: 0,
                                        display_order: maxOrder + 1,
                                      })
                                      .select()
                                      .single();

                                    if (error) throw error;
                                    
                                    setConceptos([...conceptos, data]);
                                    setAddingConcepto(null);
                                    setNewConceptoName('');
                                    await loadCotizacionData(currentCotizacion.id);
                                  } catch (error: any) {
                                    setAlertModal({
                                      isOpen: true,
                                      title: 'Error',
                                      message: error.message || 'Error al agregar concepto',
                                      type: 'error',
                                    });
                                  }
                                } else {
                                  setAddingConcepto(null);
                                  setNewConceptoName('');
                                }
                              }}
                              className="flex-1 px-2 py-1 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm"
                              placeholder="Nombre del concepto..."
                              autoFocus
                            />
                            <button
                              onClick={() => {
                                setAddingConcepto(null);
                                setNewConceptoName('');
                              }}
                              className="p-1.5 bg-red-600 hover:bg-red-700 text-white rounded transition-colors flex items-center justify-center"
                              title="Cancelar"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                        {MONTHS.map(month => (
                          <td key={month.num} className="p-2 bg-blue-50 dark:bg-blue-800"></td>
                        ))}
                        <td className="p-2 bg-blue-50 dark:bg-blue-800"></td>
                      </tr>
                    )}

                    {/* Conceptos de la sección */}
                    {seccionConceptos.map(concepto => {
                      const conceptoTotal = MONTHS.reduce((sum, month) => {
                        const valor = valores.find(
                          v => v.concepto_id === concepto.id && v.month === month.num
                        )?.value || 0;
                        return sum + valor;
                      }, 0);

                      return (
                        <tr key={concepto.id} className="border-b border-gray-200 dark:border-slate-700 bg-yellow-50 dark:bg-yellow-800">
                          <td className="p-3 sticky left-0 bg-yellow-50 dark:bg-yellow-800 z-10">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-700 dark:text-gray-300 text-sm">{concepto.name}</span>
                              <button
                                onClick={async () => {
                                  if (!confirm('¿Eliminar este concepto?')) return;
                                  try {
                                    const { error } = await supabase
                                      .from('cotizador_conceptos')
                                      .delete()
                                      .eq('id', concepto.id);

                                    if (error) throw error;
                                    
                                    setConceptos(conceptos.filter(c => c.id !== concepto.id));
                                    if (currentCotizacion) {
                                      await loadCotizacionData(currentCotizacion.id);
                                    }
                                  } catch (error: any) {
                                    setAlertModal({
                                      isOpen: true,
                                      title: 'Error',
                                      message: error.message || 'Error al eliminar concepto',
                                      type: 'error',
                                    });
                                  }
                                }}
                                className="text-red-600 hover:text-red-800 dark:text-red-400"
                                title="Eliminar concepto"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                          {MONTHS.map(month => {
                            const valor = valores.find(
                              v => v.concepto_id === concepto.id && v.month === month.num
                            )?.value || 0;
                            const inputKey = `${concepto.id}_${month.num}`;
                            const isEditing = editingInputs[inputKey] !== undefined;
                            const displayValue = isEditing
                              ? editingInputs[inputKey]
                              : (valor ? formatNumberForInput(valor) : '');

                            return (
                              <td key={month.num} className="text-right p-2 border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700/30">
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={displayValue}
                                  onFocus={(e) => {
                                    // Al hacer focus, convertir el valor formateado a número sin formatear
                                    if (!isEditing) {
                                      const rawValue = valor > 0 ? valor.toString() : '';
                                      setEditingInputs(prev => ({
                                        ...prev,
                                        [inputKey]: rawValue
                                      }));
                                    }
                                  }}
                                  onChange={(e) => {
                                    // Permitir escribir números sin formatear mientras se escribe
                                    let value = e.target.value;
                                    
                                    // Permitir solo números, punto y guión (para negativos)
                                    value = value.replace(/[^\d.-]/g, '');
                                    
                                    // Limitar a un solo punto decimal
                                    const parts = value.split('.');
                                    if (parts.length > 2) {
                                      value = parts[0] + '.' + parts.slice(1).join('');
                                    }
                                    
                                    // Limitar decimales a 2 dígitos
                                    if (parts.length === 2 && parts[1].length > 2) {
                                      value = parts[0] + '.' + parts[1].substring(0, 2);
                                    }
                                    
                                    setEditingInputs(prev => ({
                                      ...prev,
                                      [inputKey]: value
                                    }));
                                  }}
                                  onBlur={async (e) => {
                                    const inputValue = e.target.value.trim();
                                    const parsedValue = parseFormattedNumber(inputValue);
                                    
                                    try {
                                      const existingValor = valores.find(
                                        v => v.concepto_id === concepto.id && v.month === month.num
                                      );

                                      if (existingValor) {
                                        if (parsedValue === 0) {
                                          const { error } = await supabase
                                            .from('cotizador_valores')
                                            .delete()
                                            .eq('id', existingValor.id);
                                          if (error) throw error;
                                        } else {
                                          const { error } = await supabase
                                            .from('cotizador_valores')
                                            .update({ value: parsedValue })
                                            .eq('id', existingValor.id);
                                          if (error) throw error;
                                        }
                                      } else if (parsedValue !== 0) {
                                        const { error } = await supabase
                                          .from('cotizador_valores')
                                          .insert({
                                            concepto_id: concepto.id,
                                            cotizacion_id: currentCotizacion.id,
                                            tenant_id: tenantId!,
                                            month: month.num,
                                            value: parsedValue,
                                          });
                                        if (error) throw error;
                                      }

                                      setEditingInputs(prev => {
                                        const newState = { ...prev };
                                        delete newState[inputKey];
                                        return newState;
                                      });

                                      if (currentCotizacion) {
                                        await loadCotizacionData(currentCotizacion.id);
                                      }
                                    } catch (error: any) {
                                      setAlertModal({
                                        isOpen: true,
                                        title: 'Error',
                                        message: error.message || 'Error al actualizar valor',
                                        type: 'error',
                                      });
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
                          <td className="text-right p-2 font-bold text-sm border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700/30">
                            {formatNumber(conceptoTotal)}
                          </td>
                        </tr>
                      );
                    })}

                    {/* Subtotal y Markup de la sección */}
                    <tr className="border-b-2 border-gray-300 dark:border-slate-600 bg-green-50 dark:bg-green-800">
                      <td className="p-3 sticky left-0 bg-green-50 dark:bg-green-800 z-10 font-bold text-green-900 dark:text-green-300">
                        {editingSubtotalName[seccion.id] !== undefined ? (
                          <input
                            type="text"
                            value={editingSubtotalName[seccion.id]}
                            onChange={(e) => {
                              setEditingSubtotalName(prev => ({
                                ...prev,
                                [seccion.id]: e.target.value
                              }));
                            }}
                            onBlur={async () => {
                              if (!currentCotizacion) return;
                              
                              const newName = editingSubtotalName[seccion.id]?.trim() || null;
                              
                              try {
                                // Obtener valores actuales de customSectionNames
                                const currentCustom = customSectionNames[seccion.id] || {};
                                
                                // Guardar en la tabla de nombres personalizados por cotización
                                const { error } = await supabase
                                  .from('cotizador_secciones_cotizacion')
                                  .upsert({
                                    cotizacion_id: currentCotizacion.id,
                                    seccion_id: seccion.id,
                                    tenant_id: tenantId!,
                                    custom_name: currentCustom.custom_name || null,
                                    custom_subtotal_label: newName,
                                    custom_markup_label: currentCustom.custom_markup_label || null,
                                  }, {
                                    onConflict: 'cotizacion_id,seccion_id'
                                  });

                                if (error) throw error;

                                // Actualizar estado local
                                setSecciones(secciones.map(s => 
                                  s.id === seccion.id 
                                    ? { ...s, custom_subtotal_label: newName }
                                    : s
                                ));

                                setCustomSectionNames(prev => ({
                                  ...prev,
                                  [seccion.id]: {
                                    ...prev[seccion.id],
                                    custom_subtotal_label: newName,
                                  }
                                }));

                                setEditingSubtotalName(prev => {
                                  const newState = { ...prev };
                                  delete newState[seccion.id];
                                  return newState;
                                });
                              } catch (error: any) {
                                setAlertModal({
                                  isOpen: true,
                                  title: 'Error',
                                  message: error.message || 'Error al actualizar etiqueta de subtotal',
                                  type: 'error',
                                });
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.currentTarget.blur();
                              } else if (e.key === 'Escape') {
                                setEditingSubtotalName(prev => {
                                  const newState = { ...prev };
                                  delete newState[seccion.id];
                                  return newState;
                                });
                              }
                            }}
                            className="w-full px-2 py-1 border border-green-300 dark:border-green-600 rounded bg-white dark:bg-slate-700 text-green-900 dark:text-green-300 font-bold"
                            autoFocus
                          />
                        ) : (
                          <span 
                            className="cursor-pointer hover:bg-green-100 dark:hover:bg-green-700 rounded px-2 py-1"
                            onClick={() => setEditingSubtotalName(prev => ({
                              ...prev,
                              [seccion.id]: seccion.custom_subtotal_label || seccion.subtotal_label || `Subtotal Costos ${(seccion.custom_name || seccion.name).split(' ')[0]}`
                            }))}
                            title="Haz clic para editar"
                          >
                            {seccion.custom_subtotal_label || seccion.subtotal_label || `Subtotal Costos ${(seccion.custom_name || seccion.name).split(' ')[0]}`}
                          </span>
                        )}
                      </td>
                      {MONTHS.map(month => {
                        const monthTotal = seccionConceptos.reduce((sum, concepto) => {
                          const valor = valores.find(
                            v => v.concepto_id === concepto.id && v.month === month.num
                          )?.value || 0;
                          return sum + valor;
                        }, 0);
                        return (
                          <td key={month.num} className="text-right p-2 font-bold text-sm border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700/30">
                            {formatNumber(monthTotal)}
                          </td>
                        );
                      })}
                      <td className="text-right p-2 font-bold text-sm border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700/30">
                        {formatNumber(seccionTotal)}
                      </td>
                    </tr>
                    <tr className="border-b-2 border-gray-300 dark:border-slate-600 bg-green-50 dark:bg-green-800">
                      <td className="p-3 sticky left-0 bg-green-50 dark:bg-green-800 z-10 font-bold text-green-900 dark:text-green-300">
                        <div className="flex items-center gap-2">
                          {editingMarkupName[seccion.id] !== undefined ? (
                            <input
                              type="text"
                              value={editingMarkupName[seccion.id]}
                              onChange={(e) => {
                                setEditingMarkupName(prev => ({
                                  ...prev,
                                  [seccion.id]: e.target.value
                                }));
                              }}
                              onBlur={async () => {
                                if (!currentCotizacion) return;
                                
                                const newName = editingMarkupName[seccion.id]?.trim() || null;
                                
                                try {
                                  // Obtener valores actuales de customSectionNames
                                  const currentCustom = customSectionNames[seccion.id] || {};
                                  
                                  // Guardar en la tabla de nombres personalizados por cotización
                                  const { error } = await supabase
                                    .from('cotizador_secciones_cotizacion')
                                    .upsert({
                                      cotizacion_id: currentCotizacion.id,
                                      seccion_id: seccion.id,
                                      tenant_id: tenantId!,
                                      custom_name: currentCustom.custom_name || null,
                                      custom_subtotal_label: currentCustom.custom_subtotal_label || null,
                                      custom_markup_label: newName,
                                    }, {
                                      onConflict: 'cotizacion_id,seccion_id'
                                    });

                                  if (error) throw error;

                                  // Actualizar estado local
                                  setSecciones(secciones.map(s => 
                                    s.id === seccion.id 
                                      ? { ...s, custom_markup_label: newName }
                                      : s
                                  ));

                                  setCustomSectionNames(prev => ({
                                    ...prev,
                                    [seccion.id]: {
                                      ...prev[seccion.id],
                                      custom_markup_label: newName,
                                    }
                                  }));

                                  setEditingMarkupName(prev => {
                                    const newState = { ...prev };
                                    delete newState[seccion.id];
                                    return newState;
                                  });
                                } catch (error: any) {
                                  setAlertModal({
                                    isOpen: true,
                                    title: 'Error',
                                    message: error.message || 'Error al actualizar etiqueta de markup',
                                    type: 'error',
                                  });
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.currentTarget.blur();
                                } else if (e.key === 'Escape') {
                                  setEditingMarkupName(prev => {
                                    const newState = { ...prev };
                                    delete newState[seccion.id];
                                    return newState;
                                  });
                                }
                              }}
                              className="flex-1 px-2 py-1 border border-green-300 dark:border-green-600 rounded bg-white dark:bg-slate-700 text-green-900 dark:text-green-300 font-bold"
                              autoFocus
                            />
                          ) : (
                            <span 
                              className="cursor-pointer hover:bg-green-100 dark:hover:bg-green-700 rounded px-2 py-1"
                            onClick={() => setEditingMarkupName(prev => ({
                              ...prev,
                              [seccion.id]: seccion.custom_markup_label || seccion.markup_label || `Markup Costos ${(seccion.custom_name || seccion.name).split(' ')[0]}`
                            }))}
                            title="Haz clic para editar"
                          >
                            {seccion.custom_markup_label || seccion.markup_label || `Markup Costos ${(seccion.custom_name || seccion.name).split(' ')[0]}`}
                          </span>
                          )}
                          {editingMarkup[seccion.id] !== undefined ? (
                            <input
                              type="text"
                              value={editingMarkup[seccion.id]}
                              onChange={(e) => {
                                let value = e.target.value.replace(/[^\d.-]/g, '');
                                const parts = value.split('.');
                                if (parts.length > 2) {
                                  value = parts[0] + '.' + parts.slice(1).join('');
                                }
                                if (parts.length === 2 && parts[1].length > 2) {
                                  value = parts[0] + '.' + parts[1].substring(0, 2);
                                }
                                setEditingMarkup(prev => ({
                                  ...prev,
                                  [seccion.id]: value
                                }));
                              }}
                              onBlur={async () => {
                                const inputValue = editingMarkup[seccion.id]?.trim() || '0';
                                const parsedValue = parseFloat(inputValue) || 0;
                                
                                try {
                                  const { error } = await supabase
                                    .from('cotizador_secciones')
                                    .update({ markup_porcentaje: parsedValue })
                                    .eq('id', seccion.id);

                                  if (error) throw error;

                                  setSecciones(secciones.map(s => 
                                    s.id === seccion.id 
                                      ? { ...s, markup_porcentaje: parsedValue }
                                      : s
                                  ));

                                  setEditingMarkup(prev => {
                                    const newState = { ...prev };
                                    delete newState[seccion.id];
                                    return newState;
                                  });
                                } catch (error: any) {
                                  setAlertModal({
                                    isOpen: true,
                                    title: 'Error',
                                    message: error.message || 'Error al actualizar markup',
                                    type: 'error',
                                  });
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.currentTarget.blur();
                                } else if (e.key === 'Escape') {
                                  setEditingMarkup(prev => {
                                    const newState = { ...prev };
                                    delete newState[seccion.id];
                                    return newState;
                                  });
                                }
                              }}
                              className="w-20 px-2 py-1 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm font-bold"
                              autoFocus
                            />
                          ) : (
                            <span 
                              className="cursor-pointer hover:bg-green-100 dark:hover:bg-green-700 rounded px-2 py-1"
                              onClick={() => setEditingMarkup(prev => ({
                                ...prev,
                                [seccion.id]: markup.toString()
                              }))}
                              title="Haz clic para editar"
                            >
                              ({markup}%)
                            </span>
                          )}
                        </div>
                      </td>
                      {MONTHS.map(month => {
                        const monthTotal = seccionConceptos.reduce((sum, concepto) => {
                          const valor = valores.find(
                            v => v.concepto_id === concepto.id && v.month === month.num
                          )?.value || 0;
                          return sum + valor;
                        }, 0);
                        const markupValue = monthTotal * (markup / 100);
                        return (
                          <td key={month.num} className="text-right p-2 font-bold text-sm border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700/30">
                            {formatNumber(markupValue)}
                          </td>
                        );
                      })}
                      <td className="text-right p-2 font-bold text-sm border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700/30">
                        {formatNumber(subtotalConMarkup - seccionTotal)}
                      </td>
                    </tr>
                  </React.Fragment>
                );
              })}

              {/* Total de costos variables */}
              <tr className="border-b-2 border-gray-300 dark:border-slate-600 bg-purple-50 dark:bg-purple-800">
                <td className="p-3 sticky left-0 bg-purple-50 dark:bg-purple-800 z-10 font-bold text-purple-900 dark:text-purple-300">
                  SUBTOTAL COSTOS VAR
                </td>
                {MONTHS.map(month => {
                  const monthTotal = secciones.reduce((sum, seccion) => {
                    const seccionConceptos = conceptos.filter(c => c.seccion_id === seccion.id);
                    const seccionMonthTotal = seccionConceptos.reduce((conceptoSum, concepto) => {
                      const valor = valores.find(
                        v => v.concepto_id === concepto.id && v.month === month.num
                      )?.value || 0;
                      return conceptoSum + valor;
                    }, 0);
                    const markup = seccion.markup_porcentaje || 0;
                    return sum + seccionMonthTotal * (1 + markup / 100);
                  }, 0);
                  return (
                    <td key={month.num} className="text-right p-2 font-bold text-sm border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700/30">
                      {formatNumber(monthTotal)}
                    </td>
                  );
                })}
                <td className="text-right p-2 font-bold text-sm border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700/30">
                  {formatNumber(calculos?.totalCostos || 0)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={() => {
          setAlertModal({ ...alertModal, isOpen: false });
          // Si es un éxito de guardar cotización, volver a la lista
          if (alertModal.type === 'success' && alertModal.message === 'Cotización guardada correctamente') {
            setCurrentCotizacion(null);
            setEditingCotizacion({});
            loadData();
          }
        }}
        title={alertModal.title}
        message={alertModal.message}
        type={alertModal.type}
      />
    </div>
  );
}
