import { useState } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useExtraction } from '../../contexts/ExtractionContext';

// Usar VITE_BACKEND_URL si está disponible, sino VITE_EXTRACTOR_API_URL, sino localhost
const API_BASE_URL = (import.meta.env.VITE_BACKEND_URL as string | undefined) 
  ?? (import.meta.env.VITE_EXTRACTOR_API_URL as string | undefined) 
  ?? window.location.origin;

const bancos = [
  { id: 'banco_galicia', name: 'Banco Galicia', script: 'extractor_banco_galicia.py' },
  { id: 'banco_galicia_mas', name: 'Banco Galicia Más', script: 'extractor_banco_galicia_mas.py' },
  { id: 'mercado_pago', name: 'Mercado Pago', script: 'extractor_mercado_pago_directo.py' },
  { id: 'banco_comafi', name: 'Banco Comafi', script: 'extractor_banco_comafi.py' },
  { id: 'banco_jpmorgan', name: 'Banco JP Morgan', script: 'extractor_banco_jpmorgan.py' },
  { id: 'banco_bind', name: 'Banco BIND', script: 'extractor_banco_bind.py' },
  { id: 'banco_supervielle', name: 'Banco Supervielle', script: 'extractor_banco_supervielle.py' },
  { id: 'banco_cabal', name: 'Banco Cabal', script: 'extractor_banco_cabal.py' },
  { id: 'banco_credicoop', name: 'Banco Credicoop', script: 'extractor_banco_credicoop_v3.py' },
  { id: 'banco_cmf', name: 'Banco CMF', script: 'extractor_banco_cmf.py' },
  { id: 'banco_santander', name: 'Banco Santander', script: 'extractor_santander_simple.py' },
  { id: 'banco_del_sol', name: 'Banco del Sol', script: 'extractor_banco_del_sol_v1.py' },
  { id: 'banco_ciudad', name: 'Banco Ciudad', script: 'extractor_banco_ciudad.py' },
  { id: 'banco_bbva', name: 'Banco BBVA', script: 'extractor_bbva_mejorado.py' },
  { id: 'banco_icbc', name: 'Banco ICBC', script: 'extractor_banco_icbc.py' },
  { id: 'banco_macro', name: 'Banco Macro', script: 'extractor_banco_macro.py' },
  { id: 'banco_nacion', name: 'Banco Nación', script: 'nacion.py' },
  { id: 'colppy', name: 'Colppy', script: 'Colppy.py' },
];

export function TableExtractor() {
  const { addJob, updateJob } = useExtraction();
  const [selectedBanco, setSelectedBanco] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [localMessage, setLocalMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
      if (file.type === 'application/pdf') {
        setSelectedFile(file);
        setLocalMessage(null);
      } else {
        setLocalMessage({ type: 'error', text: 'Solo se permiten archivos PDF' });
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type === 'application/pdf') {
        setSelectedFile(file);
        setLocalMessage(null);
      } else {
        setLocalMessage({ type: 'error', text: 'Solo se permiten archivos PDF' });
      }
    }
  };

  const handleExtract = async () => {
    if (!selectedBanco || !selectedFile) {
      setLocalMessage({ type: 'error', text: 'Por favor selecciona un banco y un archivo PDF' });
      return;
    }

    const bancoInfo = bancos.find((b) => b.id === selectedBanco);
    if (!bancoInfo) return;

    // Crear el trabajo en segundo plano
    const jobId = addJob({
      banco: selectedBanco,
      bancoName: bancoInfo.name,
      filename: selectedFile.name,
      status: 'processing',
      progress: 0,
      message: 'Iniciando extracción...',
    });

    // Mostrar mensaje local de confirmación
    setLocalMessage({ 
      type: 'success', 
      text: `Extracción iniciada. Puedes navegar a otras secciones mientras se procesa.` 
    });

    // Limpiar el formulario
    setSelectedFile(null);
    setSelectedBanco('');

    // Procesar en segundo plano
    try {
      const formData = new FormData();
      formData.append('pdf', selectedFile);
      formData.append('banco', selectedBanco);

      // Simular progreso inicial
      updateJob(jobId, { progress: 10, message: 'Cargando archivo...' });

      // Headers para ngrok si es necesario
      const headers: HeadersInit = {};
      if (API_BASE_URL.includes('ngrok')) {
        headers['ngrok-skip-browser-warning'] = 'true';
        headers['User-Agent'] = 'Mozilla/5.0';
      }

      const response = await fetch(`${API_BASE_URL}/extract`, {
        method: 'POST',
        headers,
        body: formData,
      });

      updateJob(jobId, { progress: 50, message: 'Procesando PDF...' });

      if (!response.ok) {
        throw new Error('Error al procesar el archivo');
      }

      const data = await response.json();
      
      if (data.success) {
        updateJob(jobId, {
          status: 'completed',
          progress: 100,
          message: `✅ ${data.rows || 0} registros extraídos`,
          downloadUrl: data.downloadUrl,
          rows: data.rows,
        });
      } else {
        updateJob(jobId, {
          status: 'error',
          progress: 0,
          message: data.message || 'Error al procesar el archivo',
        });
      }
    } catch (error) {
      console.error('Error:', error);
      updateJob(jobId, {
        status: 'error',
        progress: 0,
          message: 'Error de conexión con el servidor de extractores',
      });
    }
  };

  return (
    <div className="h-full overflow-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Extractor de Tablas</h1>
        <p className="text-gray-600 dark:text-gray-300">
          Extrae datos de extractos bancarios en formato PDF y conviértelos a Excel
        </p>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-8 mb-6">
        {/* Selector de Banco */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Selecciona el Banco
          </label>
          <select
            value={selectedBanco}
            onChange={(e) => setSelectedBanco(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">-- Selecciona un banco --</option>
            {bancos.map((banco) => (
              <option key={banco.id} value={banco.id}>
                {banco.name}
              </option>
            ))}
          </select>
        </div>

        {/* Área de Carga de Archivo */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Carga tu extracto PDF
          </label>
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition ${
              dragActive
                ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-300 dark:border-slate-600 hover:border-gray-400 dark:hover:border-slate-500'
            }`}
          >
            <input
              type="file"
              id="file-upload"
              accept=".pdf"
              onChange={handleFileChange}
              className="hidden"
            />
            <label htmlFor="file-upload" className="cursor-pointer">
              <Upload className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
              <p className="text-lg font-medium text-gray-700 dark:text-white mb-2">
                {selectedFile ? selectedFile.name : 'Arrastra y suelta tu PDF aquí'}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                o haz clic para seleccionar un archivo
              </p>
            </label>
          </div>
        </div>

        {/* Botón de Extracción */}
        <button
          onClick={handleExtract}
          disabled={!selectedBanco || !selectedFile}
          className={`w-full py-3 px-6 rounded-lg font-medium transition flex items-center justify-center gap-2 ${
            !selectedBanco || !selectedFile
              ? 'bg-gray-300 dark:bg-slate-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
              : 'bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 dark:hover:bg-blue-600'
          }`}
        >
          <FileText className="w-5 h-5" />
          Extraer Datos
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
                  💡 Revisa el panel de notificaciones en la esquina inferior derecha para ver el progreso.
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

      {/* Información Adicional */}
      <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-200 mb-2">
          Bancos Soportados
        </h3>
        <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
          Actualmente soportamos extractos de {bancos.length} bancos diferentes. Cada
          extractor está optimizado para el formato específico de cada entidad.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {bancos.map((banco) => (
            <div
              key={banco.id}
              className="text-sm text-blue-800 dark:text-blue-200 bg-blue-100 dark:bg-blue-900/30 rounded px-3 py-1 border border-blue-200 dark:border-blue-800/50"
            >
              {banco.name}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

