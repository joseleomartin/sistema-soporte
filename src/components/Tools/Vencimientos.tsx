import { useState, useEffect, useCallback } from 'react';
import { Calendar, Upload, Download, AlertCircle, CheckCircle2, Loader2, FileSpreadsheet, UserPlus, Users, Mail, X, Edit2, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import { read, utils, writeFile } from 'xlsx';

interface VencimientoRow {
  [key: string]: any;
}

interface VencimientoData {
  hojas: {
    [key: string]: {
      total_filas: number;
      columnas: string[];
      datos: VencimientoRow[];
    };
  };
  fecha_actualizacion?: string;
}

interface Cliente {
  id: string;
  nombre: string;
  cuit: string;
  email: string;
  created_at: string;
  updated_at: string;
}

export function Vencimientos() {
  const { profile } = useAuth();
  const { tenantId } = useTenant();
  const [vencimientos, setVencimientos] = useState<VencimientoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [subiendo, setSubiendo] = useState(false);
  const [archivoExcel, setArchivoExcel] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [localMessage, setLocalMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [tabActiva, setTabActiva] = useState<string | null>(null);
  
  // Estados para gestión de clientes
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loadingClientes, setLoadingClientes] = useState(false);
  const [showClienteModal, setShowClienteModal] = useState(false);
  const [clienteEditando, setClienteEditando] = useState<Cliente | null>(null);
  const [formCliente, setFormCliente] = useState({ nombre: '', cuit: '', email: '' });
  const [enviandoEmail, setEnviandoEmail] = useState(false);
  const [showCargarModal, setShowCargarModal] = useState(false);

  // Cargar vencimientos desde la base de datos
  const cargarVencimientos = useCallback(async () => {
    if (!tenantId) return;
    
    try {
      setLoading(true);
      
      // Obtener todos los vencimientos del tenant
      const { data, error } = await supabase
        .from('vencimientos')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Agrupar por hoja
      const hojas: { [key: string]: VencimientoRow[] } = {};
      
      if (data) {
        data.forEach((vencimiento) => {
          const hojaNombre = vencimiento.hoja_nombre;
          if (!hojas[hojaNombre]) {
            hojas[hojaNombre] = [];
          }
          hojas[hojaNombre].push(vencimiento.datos);
        });
      }

      // Convertir a formato esperado
      const resultado: VencimientoData = {
        hojas: {},
      };

      for (const [hojaNombre, filas] of Object.entries(hojas)) {
        if (filas.length === 0) continue;
        
        // Obtener columnas únicas de todas las filas
        const columnasSet = new Set<string>();
        filas.forEach(fila => {
          Object.keys(fila).forEach(col => columnasSet.add(col));
        });
        const columnas = Array.from(columnasSet);

        resultado.hojas[hojaNombre] = {
          total_filas: filas.length,
          columnas,
          datos: filas.slice(0, 100), // Mostrar solo las primeras 100 filas
        };
      }

      setVencimientos(resultado);
      
          // Establecer la primera hoja como pestaña activa por defecto
      if (Object.keys(resultado.hojas).length > 0) {
        const primeraHoja = Object.keys(resultado.hojas)[0];
            setTabActiva(primeraHoja);
      }
    } catch (error: any) {
      console.error('Error cargando vencimientos:', error);
      setLocalMessage({ type: 'error', text: error.message || 'Error al cargar vencimientos' });
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  // Cargar vencimientos al montar el componente
  useEffect(() => {
    cargarVencimientos();
    cargarClientes();
  }, [cargarVencimientos]);

  // Cerrar modal de carga cuando la subida sea exitosa
  useEffect(() => {
    if (!subiendo && localMessage?.type === 'success' && showCargarModal) {
      const timer = setTimeout(() => {
        setShowCargarModal(false);
        setArchivoExcel(null);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [subiendo, localMessage, showCargarModal]);

  // Descargar plantilla Excel
  const handleDescargarPlantilla = () => {
    try {
      // Estructura: Periodo + 10 columnas para CUITs del 0 al 9
      const crearDatosEjemplo = () => [
        {
          'Periodo': 'Enero 2026',
          'CUIT 0': '13-feb',
          'CUIT 1': '13-feb',
          'CUIT 2': '13-feb',
          'CUIT 3': '18-feb',
          'CUIT 4': '18-feb',
          'CUIT 5': '18-feb',
          'CUIT 6': '19-feb',
          'CUIT 7': '19-feb',
          'CUIT 8': '20-feb',
          'CUIT 9': '20-feb',
        },
        {
          'Periodo': 'Febrero 2026',
          'CUIT 0': '13-mar',
          'CUIT 1': '13-mar',
          'CUIT 2': '13-mar',
          'CUIT 3': '16-mar',
          'CUIT 4': '16-mar',
          'CUIT 5': '16-mar',
          'CUIT 6': '17-mar',
          'CUIT 7': '17-mar',
          'CUIT 8': '18-mar',
          'CUIT 9': '18-mar',
        },
        {
          'Periodo': 'Marzo 2026',
          'CUIT 0': '15-abr',
          'CUIT 1': '15-abr',
          'CUIT 2': '15-abr',
          'CUIT 3': '16-abr',
          'CUIT 4': '16-abr',
          'CUIT 5': '16-abr',
          'CUIT 6': '17-abr',
          'CUIT 7': '17-abr',
          'CUIT 8': '20-abr',
          'CUIT 9': '20-abr',
        },
      ];

      // Crear workbook con todas las hojas
      const wb = utils.book_new();
      const datosEjemplo = crearDatosEjemplo();

      // Todas las hojas tienen la misma estructura: Periodo + CUITs 0-9
      // 1. Autónomos
      const wsAutonomos = utils.json_to_sheet(datosEjemplo);
      utils.book_append_sheet(wb, wsAutonomos, 'Autónomos');

      // 2. Monotributo
      const wsMonotributo = utils.json_to_sheet(datosEjemplo);
      utils.book_append_sheet(wb, wsMonotributo, 'Monotributo');

      // 3. IVA
      const wsIVA = utils.json_to_sheet(datosEjemplo);
      utils.book_append_sheet(wb, wsIVA, 'IVA');

      // 4. Ingresos Brutos
      const wsIngresosBrutos = utils.json_to_sheet(datosEjemplo);
      utils.book_append_sheet(wb, wsIngresosBrutos, 'Ingresos Brutos');

      // 5. Relación de Dependencia
      const wsRelacionDependencia = utils.json_to_sheet(datosEjemplo);
      utils.book_append_sheet(wb, wsRelacionDependencia, 'Relación de Dependencia');

      // 6. Servicio Doméstico
      const wsServicioDomestico = utils.json_to_sheet(datosEjemplo);
      utils.book_append_sheet(wb, wsServicioDomestico, 'Servicio Doméstico');

      // 7. Personas Humanas
      const wsPersonasHumanas = utils.json_to_sheet(datosEjemplo);
      utils.book_append_sheet(wb, wsPersonasHumanas, 'Personas Humanas');

      // 8. Personas Jurídicas
      const wsPersonasJuridicas = utils.json_to_sheet(datosEjemplo);
      utils.book_append_sheet(wb, wsPersonasJuridicas, 'Personas Jurídicas');

      // 9. Retenciones
      const wsRetenciones = utils.json_to_sheet(datosEjemplo);
      utils.book_append_sheet(wb, wsRetenciones, 'Retenciones');

      // Descargar
      writeFile(wb, 'plantilla_vencimientos.xlsx');
      setLocalMessage({ type: 'success', text: 'Plantilla descargada exitosamente con todas las hojas de vencimientos' });
    } catch (error: any) {
      console.error('Error descargando plantilla:', error);
      setLocalMessage({ type: 'error', text: 'Error al descargar plantilla' });
    }
  };

  // Procesar y subir Excel
  const handleSubirExcel = async () => {
    // Verificar permisos: solo administradores pueden cargar vencimientos
    if (profile?.role !== 'admin') {
      setLocalMessage({ type: 'error', text: 'Solo los administradores pueden cargar vencimientos' });
      return;
    }

    if (!archivoExcel || !tenantId) {
      setLocalMessage({ type: 'error', text: 'Por favor selecciona un archivo Excel' });
      return;
    }

    setSubiendo(true);
    setLocalMessage(null);

    try {
      // Leer el archivo Excel
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = read(data, { type: 'array' });
          
          // Procesar cada hoja
          const hojas: { [key: string]: VencimientoRow[] } = {};
          
          workbook.SheetNames.forEach((sheetName) => {
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = utils.sheet_to_json(worksheet, { defval: null }) as VencimientoRow[];
            
            // Filtrar filas vacías
            const filasValidas = jsonData.filter(fila => {
              return Object.values(fila).some(valor => valor !== null && valor !== '' && valor !== undefined);
            });
            
            if (filasValidas.length > 0) {
              hojas[sheetName] = filasValidas;
            }
          });

          if (Object.keys(hojas).length === 0) {
            throw new Error('El archivo Excel no contiene datos válidos');
          }

          if (!tenantId) {
            throw new Error('No se pudo obtener el tenant. Por favor, recarga la página.');
          }

          // Limpiar vencimientos anteriores del tenant antes de insertar nuevos
          const { error: deleteError } = await supabase
            .from('vencimientos')
            .delete()
            .eq('tenant_id', tenantId);

          if (deleteError) {
            console.warn('Error eliminando vencimientos anteriores:', deleteError);
            // Continuar de todas formas, puede que no haya vencimientos anteriores
          }

          // Insertar vencimientos por hoja directamente desde el cliente
          let totalInsertados = 0;
          let totalErrores = 0;
          const resultados: { [hoja: string]: { insertados: number; errores: number } } = {};

          for (const [hojaNombre, filas] of Object.entries(hojas)) {
            if (!Array.isArray(filas)) {
              console.error(`La hoja "${hojaNombre}" no contiene un array de filas`);
              resultados[hojaNombre] = { insertados: 0, errores: 1 };
              totalErrores++;
              continue;
            }

            // Preparar datos para inserción
            const datosParaInsertar = filas.map((fila: VencimientoRow) => ({
              tenant_id: tenantId,
              hoja_nombre: hojaNombre,
              datos: fila, // Almacenar toda la fila como JSONB
            }));

            // Insertar en lotes de 1000 para evitar problemas de tamaño
            const batchSize = 1000;
            let insertados = 0;
            let errores = 0;

            for (let i = 0; i < datosParaInsertar.length; i += batchSize) {
              const batch = datosParaInsertar.slice(i, i + batchSize);
              
              const { data, error: insertError } = await supabase
                .from('vencimientos')
                .insert(batch)
                .select('id');

              if (insertError) {
                console.error(`Error insertando lote de ${hojaNombre}:`, insertError);
                errores += batch.length;
              } else {
                insertados += data?.length || batch.length;
              }
            }

            resultados[hojaNombre] = { insertados, errores };
            totalInsertados += insertados;
            totalErrores += errores;
          }
          
          setLocalMessage({
            type: 'success',
            text: `Vencimientos cargados exitosamente. ${totalInsertados} registros insertados${totalErrores > 0 ? `, ${totalErrores} errores` : ''}.`,
          });

          // Recargar vencimientos
          await cargarVencimientos();
          
          // Limpiar archivo
          setArchivoExcel(null);
        } catch (error: any) {
          console.error('Error procesando Excel:', error);
          setLocalMessage({ type: 'error', text: error.message || 'Error al procesar el archivo Excel' });
        } finally {
          setSubiendo(false);
        }
      };

      reader.onerror = () => {
        setLocalMessage({ type: 'error', text: 'Error al leer el archivo' });
        setSubiendo(false);
      };

      reader.readAsArrayBuffer(archivoExcel);
    } catch (error: any) {
      console.error('Error:', error);
      setLocalMessage({ type: 'error', text: error.message || 'Error al subir el archivo' });
      setSubiendo(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const ext = file.name.toLowerCase().split('.').pop();
      if (ext === 'xlsx' || ext === 'xls') {
        setArchivoExcel(file);
        setLocalMessage(null);
      } else {
        setLocalMessage({ type: 'error', text: 'Solo se permiten archivos Excel (.xlsx o .xls)' });
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const ext = file.name.toLowerCase().split('.').pop();
      if (ext === 'xlsx' || ext === 'xls') {
        setArchivoExcel(file);
        setLocalMessage(null);
      } else {
        setLocalMessage({ type: 'error', text: 'Solo se permiten archivos Excel (.xlsx o .xls)' });
      }
    }
  };

  // Funciones para gestión de clientes
  const cargarClientes = async () => {
    if (!profile?.id) return;
    
    try {
      setLoadingClientes(true);
      const { data, error } = await supabase
        .from('vencimientos_clientes')
        .select('*')
        .eq('user_id', profile.id)
        .order('nombre', { ascending: true });

      if (error) throw error;
      setClientes((data || []).map((cliente: any) => ({
        ...cliente,
        cuit: cliente.cuil || cliente.cuit || ''
      })));
    } catch (error: any) {
      console.error('Error cargando clientes:', error);
      setLocalMessage({ type: 'error', text: 'Error al cargar clientes' });
    } finally {
      setLoadingClientes(false);
    }
  };

  const handleGuardarCliente = async () => {
    if (!profile?.id) return;
    
    if (!formCliente.nombre.trim() || !formCliente.cuit.trim() || !formCliente.email.trim()) {
      setLocalMessage({ type: 'error', text: 'Todos los campos son requeridos' });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formCliente.email)) {
      setLocalMessage({ type: 'error', text: 'El email no es válido' });
      return;
    }

    try {
      if (clienteEditando) {
        const { error } = await supabase
          .from('vencimientos_clientes')
          .update({
            nombre: formCliente.nombre.trim(),
            cuil: formCliente.cuit.trim(),
            email: formCliente.email.trim(),
          })
          .eq('id', clienteEditando.id)
          .eq('user_id', profile.id);

        if (error) throw error;
        setLocalMessage({ type: 'success', text: 'Cliente actualizado correctamente' });
      } else {
        const { error } = await supabase
          .from('vencimientos_clientes')
          .insert({
            nombre: formCliente.nombre.trim(),
            cuil: formCliente.cuit.trim(),
            email: formCliente.email.trim(),
            user_id: profile.id,
          });

        if (error) {
          if (error.code === '23505') {
            throw new Error('Ya existe un cliente con ese CUIT');
          }
          throw error;
        }
        setLocalMessage({ type: 'success', text: 'Cliente creado correctamente' });
      }

      setShowClienteModal(false);
      setClienteEditando(null);
      setFormCliente({ nombre: '', cuit: '', email: '' });
      await cargarClientes();
    } catch (error: any) {
      console.error('Error guardando cliente:', error);
      setLocalMessage({ type: 'error', text: error.message || 'Error al guardar cliente' });
    }
  };

  const handleEliminarCliente = async (id: string) => {
    if (!profile?.id) return;
    
    if (!confirm('¿Estás seguro de que deseas eliminar este cliente?')) return;

    try {
      const { error } = await supabase
        .from('vencimientos_clientes')
        .delete()
        .eq('id', id)
        .eq('user_id', profile.id);

      if (error) throw error;
      setLocalMessage({ type: 'success', text: 'Cliente eliminado correctamente' });
      await cargarClientes();
    } catch (error: any) {
      console.error('Error eliminando cliente:', error);
      setLocalMessage({ type: 'error', text: 'Error al eliminar cliente' });
    }
  };

  const handleEditarCliente = (cliente: Cliente) => {
    setClienteEditando(cliente);
    setFormCliente({
      nombre: cliente.nombre,
      cuit: cliente.cuit,
      email: cliente.email,
    });
    setShowClienteModal(true);
  };

  const formatearNombrePestaña = (nombre: string) => {
    let formateado = nombre.replace(/[-_]/g, ' ');
    formateado = formateado
      .split(' ')
      .map(palabra => {
        if (palabra.length === 0) return '';
        if (/^[A-Z0-9]+$/.test(palabra)) {
          return palabra;
        }
        return palabra.charAt(0).toUpperCase() + palabra.slice(1).toLowerCase();
      })
      .join(' ');
    return formateado.trim();
  };

  return (
    <div className="h-full overflow-auto vencimientos-scroll">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Vencimientos</h1>
        </div>
        <p className="text-gray-600 dark:text-gray-300">
          Gestiona y controla vencimientos de clientes
        </p>
      </div>

      {/* Mensaje Local */}
      {localMessage && (
        <div
          className={`rounded-xl shadow-sm border p-6 mb-6 ${
            localMessage.type === 'success'
              ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/50'
              : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/50'
          }`}
        >
          <div className="flex items-start gap-3">
            {localMessage.type === 'success' ? (
              <CheckCircle2 className="w-6 h-6 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <div
                className={`text-sm ${
                  localMessage.type === 'success' ? 'text-blue-900 dark:text-blue-200' : 'text-red-900 dark:text-red-300'
                }`}
              >
                {localMessage.text}
              </div>
            </div>
            <button
              onClick={() => setLocalMessage(null)}
              className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Botón para cargar vencimientos - Solo visible para administradores */}
      {profile?.role === 'admin' && (
        <div className="mb-6">
          <button
            onClick={() => setShowCargarModal(true)}
            className="px-6 py-3 rounded-lg font-medium transition flex items-center gap-2 bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 dark:hover:bg-blue-600"
          >
            <Upload className="w-5 h-5" />
            Cargar Vencimientos
          </button>
        </div>
      )}

      {/* Visualización de Vencimientos */}
      {loading ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-8 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-orange-600 dark:text-orange-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-300">Cargando vencimientos...</p>
        </div>
      ) : vencimientos && Object.keys(vencimientos.hojas).length > 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Vencimientos Disponibles
          </h3>
          
          {/* Pestañas */}
            <div className="mb-4 border-b border-gray-200 dark:border-slate-700">
              <nav className="flex space-x-1 overflow-x-auto vencimientos-scroll" aria-label="Tabs">
                {Object.keys(vencimientos.hojas).map((nombreHoja) => {
                  const datos = vencimientos.hojas[nombreHoja];
                  const isActive = tabActiva === nombreHoja;
                  const nombreFormateado = formatearNombrePestaña(nombreHoja);
                  return (
                    <button
                      key={nombreHoja}
                      onClick={() => setTabActiva(nombreHoja)}
                      className={`
                        px-4 py-2 text-sm font-medium rounded-t-lg transition whitespace-nowrap
                        ${
                          isActive
                            ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 border-b-2 border-orange-600 dark:border-orange-400'
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700'
                        }
                      `}
                    >
                      {nombreFormateado}
                      <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">
                        ({datos.total_filas})
                      </span>
                    </button>
                  );
                })}
              </nav>
            </div>

          {/* Contenido de la pestaña activa */}
          {tabActiva && vencimientos.hojas[tabActiva] && (
            <div className="mt-4">
              {(() => {
                const datos = vencimientos.hojas[tabActiva];
                return (
                  <div>
                    <div className="mb-3 text-sm text-gray-600 dark:text-gray-300">
                      <p className="font-medium text-gray-900 dark:text-white mb-1">{formatearNombrePestaña(tabActiva)}</p>
                      <p>
                        Total de filas: {datos.total_filas} | Columnas: {datos.columnas.join(', ')}
                      </p>
                    </div>
                    {datos.datos.length > 0 ? (
                      <div className="overflow-x-auto border border-gray-200 dark:border-slate-700 rounded-lg vencimientos-scroll">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700 text-sm">
                          <thead className="bg-gray-50 dark:bg-slate-700">
                            <tr>
                              {datos.columnas.map((col) => (
                                <th
                                  key={col}
                                  className="px-4 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider"
                                >
                                  {col}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
                            {datos.datos.map((fila, idx) => (
                              <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-slate-700">
                                {datos.columnas.map((col) => (
                                  <td key={col} className="px-4 py-3 whitespace-nowrap text-gray-900 dark:text-white">
                                    {fila[col] !== null && fila[col] !== undefined ? String(fila[col]) : '-'}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {datos.datos.length < datos.total_filas && (
                          <div className="px-4 py-2 bg-gray-50 dark:bg-slate-700 border-t border-gray-200 dark:border-slate-600">
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              Mostrando {datos.datos.length} de {datos.total_filas} filas
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        <p>No hay datos disponibles en esta hoja</p>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-8 text-center">
          <AlertCircle className="w-8 h-8 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-300">
            No hay vencimientos disponibles. Descarga la plantilla, complétala y súbela para comenzar.
          </p>
        </div>
      )}

      {/* Gestión de Clientes */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Clientes</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Gestiona tus clientes para enviarles vencimientos por email
            </p>
          </div>
          <button
            onClick={() => {
              setClienteEditando(null);
              setFormCliente({ nombre: '', cuit: '', email: '' });
              setShowClienteModal(true);
            }}
            className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" />
            Agregar Cliente
          </button>
        </div>

        {loadingClientes ? (
          <div className="text-center py-8">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400 dark:text-gray-500" />
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Cargando clientes...</p>
          </div>
        ) : clientes.length === 0 ? (
          <div className="text-center py-8">
            <Users className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500 mb-3" />
            <p className="text-gray-500 dark:text-gray-400 mb-2">No tienes clientes registrados</p>
            <p className="text-sm text-gray-400 dark:text-gray-500">Agrega un cliente para comenzar</p>
          </div>
        ) : (
          <div className="space-y-2">
            {clientes.map((cliente) => (
              <div
                key={cliente.id}
                className="flex items-center justify-between p-4 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{cliente.nombre}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-300">CUIT: {cliente.cuit}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-300">Email: {cliente.email}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEditarCliente(cliente)}
                    className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition"
                    title="Editar cliente"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleEliminarCliente(cliente.id)}
                    className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                    title="Eliminar cliente"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal para cargar vencimientos - Solo visible para administradores */}
      {showCargarModal && profile?.role === 'admin' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                Cargar Vencimientos
              </h3>
              <button
                onClick={() => {
                  setShowCargarModal(false);
                  setArchivoExcel(null);
                }}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              Descarga la plantilla, complétala con tus vencimientos y súbela aquí.
            </p>

            <div className="flex gap-4 mb-4">
              <button
                onClick={handleDescargarPlantilla}
                className="px-6 py-3 rounded-lg font-medium transition flex items-center gap-2 bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 dark:hover:bg-blue-600"
              >
                <Download className="w-5 h-5" />
                Descargar Plantilla
              </button>
            </div>

            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-8 text-center transition mb-4 ${
                dragActive
                  ? 'border-orange-500 dark:border-orange-400 bg-orange-50 dark:bg-orange-900/20'
                  : 'border-gray-300 dark:border-slate-600 hover:border-gray-400 dark:hover:border-slate-500'
              }`}
            >
              <input
                type="file"
                id="file-upload-excel"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
              />
              <label htmlFor="file-upload-excel" className="cursor-pointer">
                <Upload className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                <p className="text-lg font-medium text-gray-700 dark:text-white mb-2">
                  {archivoExcel ? archivoExcel.name : 'Arrastra y suelta el archivo Excel aquí'}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  o haz clic para seleccionar un archivo
                </p>
              </label>
            </div>

            <button
              onClick={handleSubirExcel}
              disabled={!archivoExcel || subiendo}
              className={`w-full py-3 px-6 rounded-lg font-medium transition flex items-center justify-center gap-2 ${
                !archivoExcel || subiendo
                  ? 'bg-gray-300 dark:bg-slate-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                  : 'bg-orange-600 dark:bg-orange-500 text-white hover:bg-orange-700 dark:hover:bg-orange-600'
              }`}
            >
              {subiendo ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Subiendo...
                </>
              ) : (
                <>
                  <FileSpreadsheet className="w-5 h-5" />
                  Subir Vencimientos
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Modal para crear/editar cliente */}
      {showClienteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                {clienteEditando ? 'Editar Cliente' : 'Nuevo Cliente'}
              </h3>
              <button
                onClick={() => {
                  setShowClienteModal(false);
                  setClienteEditando(null);
                  setFormCliente({ nombre: '', cuit: '', email: '' });
                }}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nombre del Cliente *
                </label>
                <input
                  type="text"
                  value={formCliente.nombre}
                  onChange={(e) => setFormCliente({ ...formCliente, nombre: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ej: Juan Pérez"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  CUIT *
                </label>
                <input
                  type="text"
                  value={formCliente.cuit}
                  onChange={(e) => setFormCliente({ ...formCliente, cuit: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ej: 20-12345678-9"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  value={formCliente.email}
                  onChange={(e) => setFormCliente({ ...formCliente, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ej: cliente@ejemplo.com"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleGuardarCliente}
                  className="flex-1 px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition"
                >
                  {clienteEditando ? 'Actualizar' : 'Crear'}
                </button>
                <button
                  onClick={() => {
                    setShowClienteModal(false);
                    setClienteEditando(null);
                    setFormCliente({ nombre: '', cuit: '', email: '' });
                  }}
                  className="px-4 py-2 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-600 transition"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Información sobre Vencimientos */}
      <div className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 border border-orange-200 dark:border-orange-800/50 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-orange-900 dark:text-orange-200 mb-3 flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          ¿Cómo funciona el sistema de Vencimientos?
        </h3>
        <p className="text-sm text-orange-800 dark:text-orange-300 mb-3">
          El sistema te permite cargar vencimientos desde un archivo Excel. Descarga la plantilla,
          complétala con tus datos y súbela para comenzar a gestionar vencimientos.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
          <div className="bg-white dark:bg-slate-700 rounded-lg p-3 border border-orange-200 dark:border-orange-800/50">
            <p className="text-xs font-medium text-orange-900 dark:text-orange-200 mb-1">✅ Funcionalidades</p>
            <ul className="text-xs text-orange-700 dark:text-orange-300 space-y-1 mt-2">
              <li>• Carga de vencimientos desde Excel</li>
              <li>• Visualización por tipo de vencimiento</li>
              <li>• Gestión de clientes</li>
              <li>• Envío de vencimientos por email</li>
            </ul>
          </div>
          <div className="bg-white dark:bg-slate-700 rounded-lg p-3 border border-orange-200 dark:border-orange-800/50">
            <p className="text-xs font-medium text-orange-900 dark:text-orange-200 mb-1">📋 Formato</p>
            <ul className="text-xs text-orange-700 dark:text-orange-300 space-y-1 mt-2">
              <li>• Descarga la plantilla Excel</li>
              <li>• Completa con tus datos</li>
              <li>• Sube el archivo completado</li>
              <li>• Los datos se almacenan en la base de datos</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
