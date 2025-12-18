import { useState, useEffect, useCallback } from 'react';
import { Calendar, RefreshCw, Upload, Download, AlertCircle, CheckCircle2, Loader2, FileSpreadsheet, UserPlus, Users, Mail, X, Edit2, Trash2 } from 'lucide-react';
import { useExtraction } from '../../contexts/ExtractionContext';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

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

interface Cliente {
  id: string;
  nombre: string;
  cuit: string;
  email: string;
  created_at: string;
  updated_at: string;
}

export function Vencimientos() {
  const { addJob, updateJob } = useExtraction();
  const { profile } = useAuth();
  const [vencimientos, setVencimientos] = useState<VencimientoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshJobId, setRefreshJobId] = useState<string | null>(null);
  const [localJobId, setLocalJobId] = useState<string | null>(null);
  const [archivoCuits, setArchivoCuits] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [filtrando, setFiltrando] = useState(false);
  const [resultadoFiltrado, setResultadoFiltrado] = useState<{
    filename: string;
    downloadUrl: string;
    total_cuits: number;
    cuits_con_vencimientos: number;
    cuits_sin_vencimientos: number;
  } | null>(null);
  const [localMessage, setLocalMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [tabActiva, setTabActiva] = useState<string | null>(null);
  
  // Estados para gestión de clientes
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loadingClientes, setLoadingClientes] = useState(false);
  const [showClienteModal, setShowClienteModal] = useState(false);
  const [clienteEditando, setClienteEditando] = useState<Cliente | null>(null);
  const [formCliente, setFormCliente] = useState({ nombre: '', cuit: '', email: '' });
  const [enviandoEmail, setEnviandoEmail] = useState(false);

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
    cargarClientes();
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
        setArchivoCuits(file);
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
        setArchivoCuits(file);
        setLocalMessage(null);
        setResultadoFiltrado(null);
      } else {
        setLocalMessage({ type: 'error', text: 'Solo se permiten archivos Excel (.xlsx o .xls)' });
      }
    }
  };

  const handleFiltrar = async () => {
    if (!archivoCuits) {
      setLocalMessage({ type: 'error', text: 'Por favor selecciona un archivo Excel con CUITs' });
      return;
    }

    setFiltrando(true);
    setLocalMessage(null);

    // Crear job en el contexto
    const jobId = addJob({
      banco: 'vencimientos',
      bancoName: 'Filtrado de Vencimientos',
      filename: `Filtrado: ${archivoCuits.name}`,
      status: 'processing',
      progress: 0,
      message: 'Iniciando filtrado...',
    });

    try {
      const formData = new FormData();
      formData.append('archivo', archivoCuits);

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

      updateJob(jobId, { progress: 60, message: 'Procesando CUITs...' });

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
          total_cuits: data.total_cuits,
          cuits_con_vencimientos: data.cuits_con_vencimientos,
          cuits_sin_vencimientos: data.cuits_sin_vencimientos,
        });

        setLocalMessage({
          type: 'success',
          text: `Filtrado completado. ${data.cuits_con_vencimientos} CUITs con vencimientos, ${data.cuits_sin_vencimientos} sin vencimientos.`,
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
      // Mapear 'cuil' de la base de datos a 'cuit' en la interfaz
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

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formCliente.email)) {
      setLocalMessage({ type: 'error', text: 'El email no es válido' });
      return;
    }

    try {
      if (clienteEditando) {
        // Actualizar cliente existente
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
        // Crear nuevo cliente
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

  const handleEnviarEmail = async (cliente: Cliente) => {
    if (!vencimientos) {
      setLocalMessage({ type: 'error', text: 'No hay vencimientos disponibles para enviar' });
      return;
    }

    setEnviandoEmail(true);
    setLocalMessage(null);

    try {
      const headers: HeadersInit = {};
      if (API_BASE_URL.includes('ngrok')) {
        headers['ngrok-skip-browser-warning'] = 'true';
        headers['User-Agent'] = 'Mozilla/5.0';
      }

      const response = await fetch(`${API_BASE_URL}/vencimientos/enviar-email`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cliente_id: cliente.id,
          cuit: cliente.cuit,
          email: cliente.email,
          nombre_cliente: cliente.nombre,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Error al enviar email' }));
        throw new Error(errorData.message || 'Error al enviar email');
      }

      const data = await response.json();
      if (data.success) {
        setLocalMessage({ type: 'success', text: `Email enviado correctamente a ${cliente.email}` });
      } else {
        throw new Error(data.message || 'Error al enviar email');
      }
    } catch (error: any) {
      console.error('Error enviando email:', error);
      setLocalMessage({ type: 'error', text: error.message || 'Error al enviar email' });
    } finally {
      setEnviandoEmail(false);
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
    <div className="h-full overflow-auto vencimientos-scroll">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Vencimientos</h1>
        </div>
        <p className="text-gray-600 dark:text-gray-300">
          Gestiona y controla vencimientos de clientes
        </p>
      </div>

      {/* Botón Refrescar */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Actualizar Vencimientos</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Ejecuta el scraper para obtener los vencimientos más recientes
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 font-medium">
              ℹ️ Los datos son compartidos entre todos los usuarios
            </p>
            {vencimientos && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Última actualización: {vencimientos.fecha_actualizacion_formateada || formatearFecha(vencimientos.fecha_actualizacion)}
              </p>
            )}
          </div>
          <button
            onClick={handleRefrescar}
            disabled={refreshing}
            className={`px-6 py-3 rounded-lg font-medium transition flex items-center gap-2 ${
              refreshing
                ? 'bg-gray-300 dark:bg-slate-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                : 'bg-orange-600 dark:bg-orange-500 text-white hover:bg-orange-700 dark:hover:bg-orange-600'
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
                {localMessage.text.split('\n').map((line, idx) => (
                  <p key={idx} className={idx > 0 ? 'mt-1' : ''}>
                    {line}
                  </p>
                ))}
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

      {/* Visualización de Vencimientos */}
      {loading ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-8 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-orange-600 dark:text-orange-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-300">Cargando vencimientos...</p>
        </div>
      ) : vencimientos ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Vencimientos Disponibles
          </h3>
          
          {/* Pestañas */}
          {Object.keys(vencimientos.hojas).length > 0 && (
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
          )}

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
            No hay vencimientos disponibles. Ejecuta "Refrescar Vencimientos" para obtener los datos.
          </p>
        </div>
      )}

      {/* Carga de Excel con CUITs */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Filtrar Vencimientos por CUITs
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
          Carga un archivo Excel con una columna de CUITs. El sistema buscará vencimientos
          comparando el último dígito del CUIT con los datos disponibles.
        </p>
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-lg p-3 mb-4">
          <p className="text-xs text-blue-800 dark:text-blue-200 font-medium mb-1">📋 Formato del archivo:</p>
          <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1 ml-4 list-disc">
            <li>El archivo debe tener una columna con CUITs (puede llamarse "CUIL", "CUIT", "CUIL/CUIT", etc.)</li>
            <li>Si no hay columna con ese nombre, se usará la primera columna con datos</li>
            <li>Los CUITs pueden estar en formato: XX-XXXXXXXX-X o XXXXXXXXXXX</li>
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
              ? 'border-orange-500 dark:border-orange-400 bg-orange-50 dark:bg-orange-900/20'
              : 'border-gray-300 dark:border-slate-600 hover:border-gray-400 dark:hover:border-slate-500'
          }`}
        >
          <input
            type="file"
            id="file-upload-cuits"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            className="hidden"
          />
          <label htmlFor="file-upload-cuits" className="cursor-pointer">
            <Upload className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
            <p className="text-lg font-medium text-gray-700 dark:text-white mb-2">
              {archivoCuits ? archivoCuits.name : 'Arrastra y suelta el archivo Excel con CUITs aquí'}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              o haz clic para seleccionar un archivo
            </p>
          </label>
        </div>

        <button
          onClick={handleFiltrar}
          disabled={!archivoCuits || filtrando}
          className={`w-full py-3 px-6 rounded-lg font-medium transition flex items-center justify-center gap-2 ${
            !archivoCuits || filtrando
              ? 'bg-gray-300 dark:bg-slate-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
              : 'bg-orange-600 dark:bg-orange-500 text-white hover:bg-orange-700 dark:hover:bg-orange-600'
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
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50 rounded-xl p-6 mb-6">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-green-900 dark:text-green-200 mb-2">
                Filtrado Completado
              </h3>
              <p className="text-sm text-green-800 dark:text-green-300 mb-3">
                Total CUITs procesados: {resultadoFiltrado.total_cuits}
              </p>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-white dark:bg-slate-700 rounded-lg p-3 border border-green-200 dark:border-green-800/50">
                  <p className="text-xs font-medium text-green-900 dark:text-green-200 mb-1">Con Vencimientos</p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {resultadoFiltrado.cuits_con_vencimientos}
                  </p>
                </div>
                <div className="bg-white dark:bg-slate-700 rounded-lg p-3 border border-green-200 dark:border-green-800/50">
                  <p className="text-xs font-medium text-green-900 dark:text-green-200 mb-1">Sin Vencimientos</p>
                  <p className="text-2xl font-bold text-gray-600 dark:text-gray-400">
                    {resultadoFiltrado.cuits_sin_vencimientos}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleDescargar(resultadoFiltrado.downloadUrl)}
                className="w-full py-3 px-6 rounded-lg font-medium bg-green-600 dark:bg-green-500 text-white hover:bg-green-700 dark:hover:bg-green-600 transition flex items-center justify-center gap-2"
              >
                <Download className="w-5 h-5" />
                Descargar Resultado Excel
              </button>
            </div>
          </div>
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
                    onClick={() => handleEnviarEmail(cliente)}
                    disabled={enviandoEmail || !vencimientos}
                    className="px-3 py-2 bg-green-600 dark:bg-green-500 text-white rounded-lg hover:bg-green-700 dark:hover:bg-green-600 transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Enviar vencimientos por email"
                  >
                    <Mail className="w-4 h-4" />
                    Enviar Vencimientos
                  </button>
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
          El sistema extrae tablas de vencimientos desde múltiples URLs,
          incluyendo retenciones SICORE, autónomos, IVA, cargas sociales y más.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
          <div className="bg-white dark:bg-slate-700 rounded-lg p-3 border border-orange-200 dark:border-orange-800/50">
            <p className="text-xs font-medium text-orange-900 dark:text-orange-200 mb-1">✅ Funcionalidades</p>
            <ul className="text-xs text-orange-700 dark:text-orange-300 space-y-1 mt-2">
              <li>• Actualización automática de vencimientos</li>
              <li>• Visualización por tipo de vencimiento</li>
              <li>• Filtrado por CUITs</li>
              <li>• Exportación a Excel</li>
            </ul>
          </div>
          <div className="bg-white dark:bg-slate-700 rounded-lg p-3 border border-orange-200 dark:border-orange-800/50">
            <p className="text-xs font-medium text-orange-900 dark:text-orange-200 mb-1">✅ Filtrado por CUIT</p>
            <ul className="text-xs text-orange-700 dark:text-orange-300 space-y-1 mt-2">
              <li>• Compara el último dígito del CUIT</li>
              <li>• Busca en todas las tablas disponibles</li>
              <li>• Genera reporte con resultados</li>
              <li>• Indica CUITs sin vencimientos</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}























