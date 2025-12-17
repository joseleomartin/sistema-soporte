import { useState } from 'react';
import { Upload, Download, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useExtraction } from '../../contexts/ExtractionContext';

export function PDFtoOCR() {
  const { addJob, updateJob } = useExtraction();
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

  const handleConvert = async () => {
    if (!selectedFile) {
      setLocalMessage({ type: 'error', text: 'Por favor selecciona un archivo PDF' });
      return;
    }

    // Crear el trabajo en segundo plano
    const jobId = addJob({
      banco: 'pdf_ocr',
      bancoName: 'PDF a OCR',
      filename: selectedFile.name,
      status: 'processing',
      progress: 0,
      message: 'Iniciando conversión OCR...',
    });

    // Mostrar mensaje local de confirmación
    setLocalMessage({ 
      type: 'success', 
      text: `Conversión OCR iniciada. Puedes navegar a otras secciones mientras se procesa.` 
    });

    // Limpiar el formulario
    const fileToProcess = selectedFile;
    setSelectedFile(null);

    // Procesar en segundo plano
    try {
      const formData = new FormData();
      formData.append('pdf', fileToProcess);

      // Simular progreso inicial
      updateJob(jobId, { progress: 10, message: 'Cargando PDF...' });

      // URL del backend de extractores
      // En desarrollo local, usa http://localhost:5000 si no está configurada la variable
      const getApiBaseUrl = () => {
        if (import.meta.env.VITE_EXTRACTOR_API_URL) {
          return import.meta.env.VITE_EXTRACTOR_API_URL;
        }
        // En desarrollo local, asumir que el backend está en localhost:5000
        if (import.meta.env.DEV) {
          return 'http://localhost:5000';
        }
        // En producción, usar el mismo origen
        return window.location.origin;
      };
      
      const API_BASE_URL = getApiBaseUrl();
      
      const response = await fetch(`${API_BASE_URL}/pdf-to-ocr`, {
        method: 'POST',
        body: formData,
      });

      updateJob(jobId, { progress: 50, message: 'Procesando con OCR...' });

      if (!response.ok) {
        throw new Error('Error al procesar el archivo');
      }

      const data = await response.json();
      
      if (data.success) {
        updateJob(jobId, {
          status: 'completed',
          progress: 100,
          message: `✅ PDF convertido exitosamente`,
          downloadUrl: data.downloadUrl,
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
        message: 'Error de conexión con el servidor',
      });
    }
  };

  return (
    <div className="h-full overflow-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">PDF a OCR</h1>
        <p className="text-gray-600 dark:text-gray-300">
          Convierte PDFs escaneados (imágenes) en PDFs con texto copiable
        </p>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-8 mb-6">
        {/* Área de Carga de Archivo */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Carga tu PDF escaneado
          </label>
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition ${
              dragActive
                ? 'border-green-500 dark:border-green-400 bg-green-50 dark:bg-green-900/20'
                : 'border-gray-300 dark:border-slate-600 hover:border-gray-400 dark:hover:border-slate-500'
            }`}
          >
            <input
              type="file"
              id="file-upload-ocr"
              accept=".pdf"
              onChange={handleFileChange}
              className="hidden"
            />
            <label htmlFor="file-upload-ocr" className="cursor-pointer">
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

        {/* Botón de Conversión */}
        <button
          onClick={handleConvert}
          disabled={!selectedFile}
          className={`w-full py-3 px-6 rounded-lg font-medium transition flex items-center justify-center gap-2 ${
            !selectedFile
              ? 'bg-gray-300 dark:bg-slate-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
              : 'bg-green-600 dark:bg-green-500 text-white hover:bg-green-700 dark:hover:bg-green-600'
          }`}
        >
          <FileText className="w-5 h-5" />
          Convertir a OCR
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

      {/* Información sobre OCR */}
      <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-800/50 rounded-xl p-6 mb-6">
        <h3 className="text-lg font-semibold text-green-900 dark:text-green-200 mb-3 flex items-center gap-2">
          <FileText className="w-5 h-5" />
          ¿Qué es OCR?
        </h3>
        <p className="text-sm text-green-800 dark:text-green-300 mb-3">
          OCR (Optical Character Recognition) es una tecnología que convierte imágenes de texto 
          en texto real y copiable. Esta herramienta procesa PDFs escaneados y genera un nuevo 
          PDF idéntico visualmente, pero con todo el texto seleccionable y copiable.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
          <div className="bg-white dark:bg-slate-700 rounded-lg p-3 border border-green-200 dark:border-green-800/50">
            <p className="text-xs font-medium text-green-900 dark:text-green-200 mb-1">✅ Antes (PDF Escaneado)</p>
            <p className="text-xs text-green-700 dark:text-green-300">Imagen de texto, no copiable</p>
          </div>
          <div className="bg-white dark:bg-slate-700 rounded-lg p-3 border border-green-200 dark:border-green-800/50">
            <p className="text-xs font-medium text-green-900 dark:text-green-200 mb-1">✅ Después (PDF OCR)</p>
            <p className="text-xs text-green-700 dark:text-green-300">Texto real, 100% copiable</p>
          </div>
        </div>
      </div>

      {/* Casos de Uso */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-200 mb-3">
          Casos de Uso Comunes
        </h3>
        <ul className="space-y-2">
          <li className="flex items-start gap-2 text-sm text-blue-800 dark:text-blue-300">
            <span className="text-blue-600 dark:text-blue-400 font-bold">•</span>
            <span><strong>Documentos escaneados:</strong> Facturas, contratos, formularios</span>
          </li>
          <li className="flex items-start gap-2 text-sm text-blue-800 dark:text-blue-300">
            <span className="text-blue-600 dark:text-blue-400 font-bold">•</span>
            <span><strong>Extractos bancarios:</strong> Convertir imágenes en texto editable</span>
          </li>
          <li className="flex items-start gap-2 text-sm text-blue-800 dark:text-blue-300">
            <span className="text-blue-600 dark:text-blue-400 font-bold">•</span>
            <span><strong>Archivos antiguos:</strong> Digitalizar documentos históricos</span>
          </li>
          <li className="flex items-start gap-2 text-sm text-blue-800 dark:text-blue-300">
            <span className="text-blue-600 dark:text-blue-400 font-bold">•</span>
            <span><strong>Búsqueda de contenido:</strong> Hacer PDFs buscables</span>
          </li>
        </ul>
      </div>

      {/* Requisitos */}
      <div className="mt-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800/50 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-yellow-900 dark:text-yellow-200 mb-2">
          ⚙️ Requisitos del Sistema
        </h3>
        <p className="text-sm text-yellow-800 dark:text-yellow-300 mb-2">
          Esta herramienta requiere que el servidor tenga instalado:
        </p>
        <ul className="space-y-1 text-sm text-yellow-700 dark:text-yellow-300">
          <li>• <strong>Tesseract OCR</strong> - Motor de reconocimiento óptico</li>
          <li>• <strong>PyMuPDF</strong> o <strong>ocrmypdf</strong> - Procesamiento de PDFs</li>
          <li>• <strong>Ghostscript</strong> (opcional) - Optimización avanzada</li>
        </ul>
        <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-3">
          💡 Si ves errores, contacta al administrador para verificar la instalación.
        </p>
      </div>
    </div>
  );
}



