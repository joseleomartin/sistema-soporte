import { useState } from 'react';
import { Scale, Upload, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useExtraction } from '../../contexts/ExtractionContext';

// Usar VITE_BACKEND_URL si está disponible, sino VITE_EXTRACTOR_API_URL, sino localhost
const API_BASE_URL = (import.meta.env.VITE_BACKEND_URL as string | undefined) 
  ?? (import.meta.env.VITE_EXTRACTOR_API_URL as string | undefined) 
  ?? window.location.origin;

export function Consilador() {
  const { addJob, updateJob } = useExtraction();
  const [archivo1, setArchivo1] = useState<File | null>(null);
  const [archivo2, setArchivo2] = useState<File | null>(null);
  const [dragActive1, setDragActive1] = useState(false);
  const [dragActive2, setDragActive2] = useState(false);
  const [localMessage, setLocalMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleDrag = (e: React.DragEvent, setDragActive: (active: boolean) => void) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent, setFile: (file: File | null) => void, setDragActive: (active: boolean) => void) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const ext = file.name.toLowerCase().split('.').pop();
      if (ext === 'xlsx' || ext === 'xls') {
        setFile(file);
        setLocalMessage(null);
      } else {
        setLocalMessage({ type: 'error', text: 'Solo se permiten archivos Excel (.xlsx o .xls)' });
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, setFile: (file: File | null) => void) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const ext = file.name.toLowerCase().split('.').pop();
      if (ext === 'xlsx' || ext === 'xls') {
        setFile(file);
        setLocalMessage(null);
      } else {
        setLocalMessage({ type: 'error', text: 'Solo se permiten archivos Excel (.xlsx o .xls)' });
      }
    }
  };

  const handleComparar = async () => {
    if (!archivo1 || !archivo2) {
      setLocalMessage({ type: 'error', text: 'Por favor selecciona ambos archivos Excel' });
      return;
    }

    setIsProcessing(true);
    setLocalMessage(null);

    // Crear el trabajo en segundo plano
    const jobId = addJob({
      banco: 'consilador',
      bancoName: 'Consiliador',
      filename: `Comparación: ${archivo1.name} vs ${archivo2.name}`,
      status: 'processing',
      progress: 0,
      message: 'Iniciando comparación...',
    });

    try {
      const formData = new FormData();
      formData.append('archivo1', archivo1);
      formData.append('archivo2', archivo2);

      updateJob(jobId, { progress: 10, message: 'Cargando archivos...' });

      // Headers para ngrok si es necesario
      const headers: HeadersInit = {};
      if (API_BASE_URL.includes('ngrok')) {
        headers['ngrok-skip-browser-warning'] = 'true';
        headers['User-Agent'] = 'Mozilla/5.0';
      }

      updateJob(jobId, { progress: 30, message: 'Comparando archivos...' });

      const response = await fetch(`${API_BASE_URL}/consilador/comparar`, {
        method: 'POST',
        headers,
        body: formData,
      });

      updateJob(jobId, { progress: 70, message: 'Generando resultado...' });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Error al procesar los archivos' }));
        throw new Error(errorData.message || 'Error al procesar los archivos');
      }

      const data = await response.json();

      if (data.success) {
        updateJob(jobId, {
          status: 'completed',
          progress: 100,
          message: '✅ Comparación completada exitosamente',
          downloadUrl: data.downloadUrl,
        });

        setLocalMessage({
          type: 'success',
          text: 'Comparación completada exitosamente. Puedes descargar el resultado desde el panel de notificaciones.',
        });

        // Limpiar archivos seleccionados
        setArchivo1(null);
        setArchivo2(null);
      } else {
        throw new Error(data.message || 'Error al comparar los archivos');
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
      setIsProcessing(false);
    }
  };

  return (
    <div className="h-full overflow-auto">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Consiliador</h1>
          <span className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 text-sm font-semibold px-3 py-1 rounded-full border border-yellow-300 dark:border-yellow-700/50">
            Experimental
          </span>
        </div>
        <p className="text-gray-600 dark:text-gray-300">
          Compara y concilia datos financieros entre dos archivos Excel
        </p>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-8 mb-6">
        {/* Área de Carga Archivo 1 */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Archivo Excel 1
          </label>
          <div
            onDragEnter={(e) => handleDrag(e, setDragActive1)}
            onDragLeave={(e) => handleDrag(e, setDragActive1)}
            onDragOver={(e) => handleDrag(e, setDragActive1)}
            onDrop={(e) => handleDrop(e, setArchivo1, setDragActive1)}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition ${
              dragActive1
                ? 'border-purple-500 dark:border-purple-400 bg-purple-50 dark:bg-purple-900/20'
                : 'border-gray-300 dark:border-slate-600 hover:border-gray-400 dark:hover:border-slate-500'
            }`}
          >
            <input
              type="file"
              id="file-upload-1"
              accept=".xlsx,.xls"
              onChange={(e) => handleFileChange(e, setArchivo1)}
              className="hidden"
            />
            <label htmlFor="file-upload-1" className="cursor-pointer">
              <Upload className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
              <p className="text-lg font-medium text-gray-700 dark:text-white mb-2">
                {archivo1 ? archivo1.name : 'Arrastra y suelta el primer archivo Excel aquí'}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                o haz clic para seleccionar un archivo
              </p>
            </label>
          </div>
        </div>

        {/* Área de Carga Archivo 2 */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Archivo Excel 2
          </label>
          <div
            onDragEnter={(e) => handleDrag(e, setDragActive2)}
            onDragLeave={(e) => handleDrag(e, setDragActive2)}
            onDragOver={(e) => handleDrag(e, setDragActive2)}
            onDrop={(e) => handleDrop(e, setArchivo2, setDragActive2)}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition ${
              dragActive2
                ? 'border-purple-500 dark:border-purple-400 bg-purple-50 dark:bg-purple-900/20'
                : 'border-gray-300 dark:border-slate-600 hover:border-gray-400 dark:hover:border-slate-500'
            }`}
          >
            <input
              type="file"
              id="file-upload-2"
              accept=".xlsx,.xls"
              onChange={(e) => handleFileChange(e, setArchivo2)}
              className="hidden"
            />
            <label htmlFor="file-upload-2" className="cursor-pointer">
              <Upload className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
              <p className="text-lg font-medium text-gray-700 dark:text-white mb-2">
                {archivo2 ? archivo2.name : 'Arrastra y suelta el segundo archivo Excel aquí'}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                o haz clic para seleccionar un archivo
              </p>
            </label>
          </div>
        </div>

        {/* Botón de Comparación */}
        <button
          onClick={handleComparar}
          disabled={!archivo1 || !archivo2 || isProcessing}
          className={`w-full py-3 px-6 rounded-lg font-medium transition flex items-center justify-center gap-2 ${
            !archivo1 || !archivo2 || isProcessing
              ? 'bg-gray-300 dark:bg-slate-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
              : 'bg-purple-600 dark:bg-purple-500 text-white hover:bg-purple-700 dark:hover:bg-purple-600'
          }`}
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Comparando...
            </>
          ) : (
            <>
              <Scale className="w-5 h-5" />
              Comparar Archivos
            </>
          )}
        </button>
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
              <p
                className={`text-sm ${
                  localMessage.type === 'success' ? 'text-blue-900 dark:text-blue-200' : 'text-red-900 dark:text-red-300'
                }`}
              >
                {localMessage.text}
              </p>
              {localMessage.type === 'success' && (
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">
                  💡 Revisa el panel de notificaciones en la esquina inferior derecha para ver el progreso y descargar el resultado.
                </p>
              )}
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

      {/* Información sobre Conciliación */}
      <div className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border border-purple-200 dark:border-purple-800/50 rounded-xl p-6 mb-6">
        <h3 className="text-lg font-semibold text-purple-900 dark:text-purple-200 mb-3 flex items-center gap-2">
          <Scale className="w-5 h-5" />
          ¿Qué es un Consiliador?
        </h3>
        <p className="text-sm text-purple-800 dark:text-purple-300 mb-3">
          Un consiliador (conciliador) es una herramienta que permite comparar y conciliar información 
          financiera de diferentes fuentes, identificando diferencias, coincidencias y discrepancias 
          entre registros contables, extractos bancarios y otros documentos.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
          <div className="bg-white dark:bg-slate-700 rounded-lg p-3 border border-purple-200 dark:border-purple-800/50">
            <p className="text-xs font-medium text-purple-900 dark:text-purple-200 mb-1">✅ Funcionalidades Principales</p>
            <ul className="text-xs text-purple-700 dark:text-purple-300 space-y-1 mt-2">
              <li>• Comparación automática de archivos Excel</li>
              <li>• Identificación de diferencias</li>
              <li>• Generación de reporte con 3 hojas</li>
            </ul>
          </div>
          <div className="bg-white dark:bg-slate-700 rounded-lg p-3 border border-purple-200 dark:border-purple-800/50">
            <p className="text-xs font-medium text-purple-900 dark:text-purple-200 mb-1">✅ Resultado de la Comparación</p>
            <ul className="text-xs text-purple-700 dark:text-purple-300 space-y-1 mt-2">
              <li>• Faltantes en Archivo 1</li>
              <li>• Faltantes en Archivo 2</li>
              <li>• Retenciones consolidadas</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

