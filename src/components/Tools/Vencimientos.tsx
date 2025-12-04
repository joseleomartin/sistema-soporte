import { useState, useEffect, useCallback } from 'react';
import { Calendar, RefreshCw, Upload, Download, AlertCircle, CheckCircle2, Loader2, FileSpreadsheet } from 'lucide-react';
import { useExtraction } from '../../contexts/ExtractionContext';

// Usar VITE_BACKEND_URL si está disponible, sino VITE_EXTRACTOR_API_URL, sino localhost:5000 (backend por defecto)
const API_BASE_URL = (import.meta.env.VITE_BACKEND_URL as string | undefined) 
  ?? (import.meta.env.VITE_EXTRACTOR_API_URL as string | undefined) 
  ?? (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
      ? 'http://localhost:5000' 
      : window.location.origin);

interface VencimientoData {
  archivo: string;
  fecha_actualizacion: string;
  hojas: {
    [key: string]: {
      total_filas: number;
      columnas: string[];
      datos: any[];
    };
  };
}

interface JobStatus {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: number;
  message: string;
  error?: string;
}

export function Vencimientos() {
  const { addJob, updateJob } = useExtraction();
  const [vencimientos, setVencimientos] = useState<VencimientoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshJobId, setRefreshJobId] = useState<string | null>(null);
  const [localJobId, setLocalJobId] = useState<string | null>(null);
  const [archivoCuils, setArchivoCuils] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [filtrando, setFiltrando] = useState(false);
  const [resultadoFiltrado, setResultadoFiltrado] = useState<{
    filename: string;
    downloadUrl: string;
    total_cuils: number;
    cuils_con_vencimientos: number;
    cuils_sin_vencimientos: number;
  } | null>(null);
  const [localMessage, setLocalMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [tabActiva, setTabActiva] = useState<string | null>(null);

  // Definir cargarVencimientos antes de usarlo en los useEffect
  const cargarVencimientos = useCallback(async () => {
    try {
      setLoading(true);
      const headers: HeadersInit = {};
      if (API_BASE_URL.includes('ngrok')) {
        headers['ngrok-skip-browser-warning'] = 'true';
        headers['User-Agent'] = 'Mozilla/5.0';
      }

      const response = await fetch(`${API_BASE_URL}/vencimientos/listar`, { headers });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setVencimientos(data.data);
          // Establecer la primera hoja como pestaña activa por defecto
          if (data.data.hojas && Object.keys(data.data.hojas).length > 0) {
            const primeraHoja = Object.keys(data.data.hojas)[0];
            setTabActiva(primeraHoja);
          }
        } else {
          setLocalMessage({ type: 'error', text: data.message || 'Error al cargar vencimientos' });
        }
      } else {
        const errorData = await response.json().catch(() => ({ message: 'Error al cargar vencimientos' }));
        setLocalMessage({ type: 'error', text: errorData.message || 'Error al cargar vencimientos' });
      }
    } catch (error: any) {
      console.error('Error:', error);
      setLocalMessage({ type: 'error', text: 'Error de conexión con el servidor' });
    } finally {
      setLoading(false);
    }
  }, []);

  // Cargar vencimientos al montar el componente
  useEffect(() => {
    cargarVencimientos();
  }, [cargarVencimientos]);

  // Polling para el estado del job de refresco
  useEffect(() => {
    if (!refreshJobId) return;

    const interval = setInterval(async () => {
      try {
        const headers: HeadersInit = {};
        if (API_BASE_URL.includes('ngrok')) {
          headers['ngrok-skip-browser-warning'] = 'true';
          headers['User-Agent'] = 'Mozilla/5.0';
        }

        const response = await fetch(`${API_BASE_URL}/vencimientos/status/${refreshJobId}`, { headers });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.job) {
            const job = data.job;
            
            // Actualizar job local en el contexto si existe
            if (localJobId) {
              updateJob(localJobId, {
                progress: job.progress,
                message: job.message,
                status: job.status === 'completed' ? 'completed' : job.status === 'error' ? 'error' : 'processing'
              });
            }

            if (job.status === 'completed') {
              setRefreshing(false);
              setRefreshJobId(null);
              setLocalJobId(null);
              // Recargar vencimientos
              await cargarVencimientos();
              setLocalMessage({
                type: 'success',
                text: 'Vencimientos actualizados exitosamente'
              });
            } else if (job.status === 'error') {
              setRefreshing(false);
              setRefreshJobId(null);
              setLocalJobId(null);
              setLocalMessage({
                type: 'error',
                text: job.error || 'Error al actualizar vencimientos'
              });
            }
          }
        }
      } catch (error) {
        console.error('Error consultando estado del job:', error);
      }
    }, 2000); // Consultar cada 2 segundos

    return () => clearInterval(interval);
  }, [refreshJobId, localJobId, updateJob, cargarVencimientos]);

  const handleRefrescar = async () => {
    setRefreshing(true);
    setLocalMessage(null);

    try {
      const headers: HeadersInit = {};
      if (API_BASE_URL.includes('ngrok')) {
        headers['ngrok-skip-browser-warning'] = 'true';
        headers['User-Agent'] = 'Mozilla/5.0';
      }

      const url = `${API_BASE_URL}/vencimientos/refrescar`;
      console.log('Llamando a:', url);
      console.log('API_BASE_URL:', API_BASE_URL);

      const response = await fetch(url, {
        method: 'POST',
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Error al iniciar actualización' }));
        const errorMessage = errorData.message || `Error al iniciar actualización (${response.status})`;
        console.error('Error en respuesta:', errorMessage, 'URL:', url);
        throw new Error(errorMessage);
      }

      const data = await response.json();
      
      if (data.success && data.job_id) {
        // Usar el job_id que retorna el backend
        const backendJobId = data.job_id;
        console.log('Job ID del backend:', backendJobId);
        
        // Crear job en el contexto local
        const newLocalJobId = addJob({
          banco: 'vencimientos',
          bancoName: 'Vencimientos',
          filename: 'Actualización de vencimientos',
          status: 'processing',
          progress: 10,
          message: 'Scraper iniciado, procesando...',
        });

        // Guardar ambos IDs
        setRefreshJobId(backendJobId);
        setLocalJobId(newLocalJobId);
      } else {
        throw new Error(data.message || 'Error al iniciar actualización');
      }
    } catch (error: any) {
      console.error('Error:', error);
      setRefreshing(false);
      setRefreshJobId(null);
      setLocalJobId(null);
      setLocalMessage({
        type: 'error',
        text: error.message || 'Error de conexión con el servidor',
      });
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
        setArchivoCuils(file);
        setLocalMessage(null);
        setResultadoFiltrado(null);
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
        setArchivoCuils(file);
        setLocalMessage(null);
        setResultadoFiltrado(null);
      } else {
        setLocalMessage({ type: 'error', text: 'Solo se permiten archivos Excel (.xlsx o .xls)' });
      }
    }
  };

  const handleFiltrar = async () => {
    if (!archivoCuils) {
      setLocalMessage({ type: 'error', text: 'Por favor selecciona un archivo Excel con CUILs' });
      return;
    }

    setFiltrando(true);
    setLocalMessage(null);

    // Crear job en el contexto
    const jobId = addJob({
      banco: 'vencimientos',
      bancoName: 'Filtrado de Vencimientos',
      filename: `Filtrado: ${archivoCuils.name}`,
      status: 'processing',
      progress: 0,
      message: 'Iniciando filtrado...',
    });

    try {
      const formData = new FormData();
      formData.append('archivo', archivoCuils);

      const headers: HeadersInit = {};
      if (API_BASE_URL.includes('ngrok')) {
        headers['ngrok-skip-browser-warning'] = 'true';
        headers['User-Agent'] = 'Mozilla/5.0';
      }

      updateJob(jobId, { progress: 20, message: 'Cargando archivo...' });

      const response = await fetch(`${API_BASE_URL}/vencimientos/filtrar-por-cuils`, {
        method: 'POST',
        headers,
        body: formData,
      });

      updateJob(jobId, { progress: 60, message: 'Procesando CUILs...' });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Error al filtrar vencimientos' }));
        let errorMessage = errorData.message || 'Error al filtrar vencimientos';
        
        // Agregar información adicional si está disponible
        if (errorData.columnas_disponibles) {
          errorMessage += `\n\nColumnas encontradas en el archivo: ${errorData.columnas_disponibles.join(', ')}`;
        }
        if (errorData.columna_usada) {
          errorMessage += `\n\nColumna utilizada: ${errorData.columna_usada}`;
        }
        if (errorData.total_filas !== undefined) {
          errorMessage += `\n\nTotal de filas en el archivo: ${errorData.total_filas}`;
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();

      if (data.success) {
        updateJob(jobId, {
          status: 'completed',
          progress: 100,
          message: '✅ Filtrado completado exitosamente',
          downloadUrl: data.downloadUrl,
        });

        setResultadoFiltrado({
          filename: data.filename,
          downloadUrl: data.downloadUrl,
          total_cuils: data.total_cuils,
          cuils_con_vencimientos: data.cuils_con_vencimientos,
          cuils_sin_vencimientos: data.cuils_sin_vencimientos,
        });

        setLocalMessage({
          type: 'success',
          text: `Filtrado completado. ${data.cuils_con_vencimientos} CUILs con vencimientos, ${data.cuils_sin_vencimientos} sin vencimientos.`,
        });
      } else {
        throw new Error(data.message || 'Error al filtrar vencimientos');
      }
    } catch (error: any) {
      console.error('Error:', error);
      updateJob(jobId, {
        status: 'error',
        progress: 0,
        message: error.message || 'Error de conexión con el servidor',
      });
      setLocalMessage({
        type: 'error',
        text: error.message || 'Error de conexión con el servidor',
      });
    } finally {
      setFiltrando(false);
    }
  };

  const handleDescargar = (url: string) => {
    window.open(url, '_blank');
  };

  const formatearFecha = (fechaISO: string) => {
    try {
      const fecha = new Date(fechaISO);
      return fecha.toLocaleString('es-AR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return fechaISO;
    }
  };

  const formatearNombrePestaña = (nombre: string) => {
    // Reemplazar guiones y guiones bajos con espacios
    let formateado = nombre.replace(/[-_]/g, ' ');
    // Capitalizar cada palabra
    formateado = formateado
      .split(' ')
      .map(palabra => {
        if (palabra.length === 0) return '';
        // Si es un número o sigla (como T1), mantenerlo como está
        if (/^[A-Z0-9]+$/.test(palabra)) {
          return palabra;
        }
        // Capitalizar primera letra, resto en minúsculas
        return palabra.charAt(0).toUpperCase() + palabra.slice(1).toLowerCase();
      })
      .join(' ');
    return formateado.trim();
  };

  return (
    <div className="h-full overflow-auto">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-3xl font-bold text-gray-900">Vencimientos</h1>
        </div>
        <p className="text-gray-600">
          Gestiona y controla vencimientos de clientes
        </p>
      </div>

      {/* Botón Refrescar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Actualizar Vencimientos</h3>
            <p className="text-sm text-gray-600">
              Ejecuta el scraper para obtener los vencimientos más recientes
            </p>
            <p className="text-xs text-blue-600 mt-1 font-medium">
              ℹ️ Los datos son compartidos entre todos los usuarios
            </p>
            {vencimientos && (
              <p className="text-xs text-gray-500 mt-2">
                Última actualización: {vencimientos.fecha_actualizacion_formateada || formatearFecha(vencimientos.fecha_actualizacion)}
              </p>
            )}
          </div>
          <button
            onClick={handleRefrescar}
            disabled={refreshing}
            className={`px-6 py-3 rounded-lg font-medium transition flex items-center gap-2 ${
              refreshing
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-orange-600 text-white hover:bg-orange-700'
            }`}
          >
            {refreshing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Actualizando...
              </>
            ) : (
              <>
                <RefreshCw className="w-5 h-5" />
                Refrescar Vencimientos
              </>
            )}
          </button>
        </div>
      </div>

      {/* Mensaje Local */}
      {localMessage && (
        <div
          className={`rounded-xl shadow-sm border p-6 mb-6 ${
            localMessage.type === 'success'
              ? 'bg-blue-50 border-blue-200'
              : 'bg-red-50 border-red-200'
          }`}
        >
          <div className="flex items-start gap-3">
            {localMessage.type === 'success' ? (
              <CheckCircle2 className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <div
                className={`text-sm ${
                  localMessage.type === 'success' ? 'text-blue-900' : 'text-red-900'
                }`}
              >
                {localMessage.text.split('\n').map((line, idx) => (
                  <p key={idx} className={idx > 0 ? 'mt-1' : ''}>
                    {line}
                  </p>
                ))}
              </div>
            </div>
            <button
              onClick={() => setLocalMessage(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Visualización de Vencimientos */}
      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-orange-600 mx-auto mb-4" />
          <p className="text-gray-600">Cargando vencimientos...</p>
        </div>
      ) : vencimientos ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Vencimientos Disponibles
          </h3>
          
          {/* Pestañas */}
          {Object.keys(vencimientos.hojas).length > 0 && (
            <div className="mb-4 border-b border-gray-200">
              <nav className="flex space-x-1 overflow-x-auto" aria-label="Tabs">
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
                            ? 'bg-orange-50 text-orange-700 border-b-2 border-orange-600'
                            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                        }
                      `}
                    >
                      {nombreFormateado}
                      <span className="ml-2 text-xs text-gray-400">
                        ({datos.total_filas})
                      </span>
                    </button>
                  );
                })}
              </nav>
            </div>
          )}

          {/* Contenido de la pestaña activa */}
          {tabActiva && vencimientos.hojas[tabActiva] && (
            <div className="mt-4">
              {(() => {
                const datos = vencimientos.hojas[tabActiva];
                return (
                  <div>
                    <div className="mb-3 text-sm text-gray-600">
                      <p className="font-medium text-gray-900 mb-1">{formatearNombrePestaña(tabActiva)}</p>
                      <p>
                        Total de filas: {datos.total_filas} | Columnas: {datos.columnas.join(', ')}
                      </p>
                    </div>
                    {datos.datos.length > 0 ? (
                      <div className="overflow-x-auto border border-gray-200 rounded-lg">
                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              {datos.columnas.map((col) => (
                                <th
                                  key={col}
                                  className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider"
                                >
                                  {col}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {datos.datos.map((fila, idx) => (
                              <tr key={idx} className="hover:bg-gray-50">
                                {datos.columnas.map((col) => (
                                  <td key={col} className="px-4 py-3 whitespace-nowrap text-gray-900">
                                    {fila[col] !== null && fila[col] !== undefined ? String(fila[col]) : '-'}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {datos.datos.length < datos.total_filas && (
                          <div className="px-4 py-2 bg-gray-50 border-t border-gray-200">
                            <p className="text-xs text-gray-500">
                              Mostrando {datos.datos.length} de {datos.total_filas} filas
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
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
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <AlertCircle className="w-8 h-8 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">
            No hay vencimientos disponibles. Ejecuta "Refrescar Vencimientos" para obtener los datos.
          </p>
        </div>
      )}

      {/* Carga de Excel con CUILs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Filtrar Vencimientos por CUILs
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          Carga un archivo Excel con una columna de CUILs. El sistema buscará vencimientos
          comparando el último dígito del CUIL con los datos disponibles.
        </p>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
          <p className="text-xs text-blue-800 font-medium mb-1">📋 Formato del archivo:</p>
          <ul className="text-xs text-blue-700 space-y-1 ml-4 list-disc">
            <li>El archivo debe tener una columna con CUILs (puede llamarse "CUIL", "CUIT", "CUIL/CUIT", etc.)</li>
            <li>Si no hay columna con ese nombre, se usará la primera columna con datos</li>
            <li>Los CUILs pueden estar en formato: XX-XXXXXXXX-X o XXXXXXXXXXX</li>
            <li>No importa si hay filas vacías, se ignorarán automáticamente</li>
          </ul>
        </div>

        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition mb-4 ${
            dragActive
              ? 'border-orange-500 bg-orange-50'
              : 'border-gray-300 hover:border-gray-400'
          }`}
        >
          <input
            type="file"
            id="file-upload-cuils"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            className="hidden"
          />
          <label htmlFor="file-upload-cuils" className="cursor-pointer">
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-lg font-medium text-gray-700 mb-2">
              {archivoCuils ? archivoCuils.name : 'Arrastra y suelta el archivo Excel con CUILs aquí'}
            </p>
            <p className="text-sm text-gray-500">
              o haz clic para seleccionar un archivo
            </p>
          </label>
        </div>

        <button
          onClick={handleFiltrar}
          disabled={!archivoCuils || filtrando}
          className={`w-full py-3 px-6 rounded-lg font-medium transition flex items-center justify-center gap-2 ${
            !archivoCuils || filtrando
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-orange-600 text-white hover:bg-orange-700'
          }`}
        >
          {filtrando ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Filtrando...
            </>
          ) : (
            <>
              <FileSpreadsheet className="w-5 h-5" />
              Filtrar Vencimientos
            </>
          )}
        </button>
      </div>

      {/* Resultado del Filtrado */}
      {resultadoFiltrado && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 mb-6">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-green-900 mb-2">
                Filtrado Completado
              </h3>
              <p className="text-sm text-green-800 mb-3">
                Total CUILs procesados: {resultadoFiltrado.total_cuils}
              </p>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-white rounded-lg p-3">
                  <p className="text-xs font-medium text-green-900 mb-1">Con Vencimientos</p>
                  <p className="text-2xl font-bold text-green-600">
                    {resultadoFiltrado.cuils_con_vencimientos}
                  </p>
                </div>
                <div className="bg-white rounded-lg p-3">
                  <p className="text-xs font-medium text-green-900 mb-1">Sin Vencimientos</p>
                  <p className="text-2xl font-bold text-gray-600">
                    {resultadoFiltrado.cuils_sin_vencimientos}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleDescargar(resultadoFiltrado.downloadUrl)}
                className="w-full py-3 px-6 rounded-lg font-medium bg-green-600 text-white hover:bg-green-700 transition flex items-center justify-center gap-2"
              >
                <Download className="w-5 h-5" />
                Descargar Resultado Excel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Información sobre Vencimientos */}
      <div className="bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-orange-900 mb-3 flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          ¿Cómo funciona el sistema de Vencimientos?
        </h3>
        <p className="text-sm text-orange-800 mb-3">
          El sistema extrae tablas de vencimientos desde múltiples URLs,
          incluyendo retenciones SICORE, autónomos, IVA, cargas sociales y más.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
          <div className="bg-white rounded-lg p-3">
            <p className="text-xs font-medium text-orange-900 mb-1">✅ Funcionalidades</p>
            <ul className="text-xs text-orange-700 space-y-1 mt-2">
              <li>• Actualización automática de vencimientos</li>
              <li>• Visualización por tipo de vencimiento</li>
              <li>• Filtrado por CUILs</li>
              <li>• Exportación a Excel</li>
            </ul>
          </div>
          <div className="bg-white rounded-lg p-3">
            <p className="text-xs font-medium text-orange-900 mb-1">✅ Filtrado por CUIL</p>
            <ul className="text-xs text-orange-700 space-y-1 mt-2">
              <li>• Compara el último dígito del CUIL</li>
              <li>• Busca en todas las tablas disponibles</li>
              <li>• Genera reporte con resultados</li>
              <li>• Indica CUILs sin vencimientos</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

