import { useExtraction } from '../../contexts/ExtractionContext';
import { X, Download, Loader2, CheckCircle2, AlertCircle, FileText } from 'lucide-react';
import { useState } from 'react';

export function ExtractionNotifications() {
  const { jobs, removeJob, clearCompletedJobs } = useExtraction();
  const [minimized, setMinimized] = useState(false);

  // Mostrar solo los trabajos recientes (últimos 5)
  const recentJobs = jobs.slice(-5).reverse();

  if (jobs.length === 0) {
    return null;
  }

  const processingCount = jobs.filter((j) => j.status === 'processing').length;
  const completedCount = jobs.filter((j) => j.status === 'completed').length;

  const handleDownload = (url: string) => {
    window.open(url, '_blank');
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 w-96 max-w-[calc(100vw-2rem)]">
      {/* Header */}
      <div className="bg-white rounded-t-xl shadow-lg border border-gray-200">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">
              Extracciones
              {processingCount > 0 && (
                <span className="ml-2 text-sm text-blue-600">
                  ({processingCount} procesando)
                </span>
              )}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {completedCount > 0 && (
              <button
                onClick={clearCompletedJobs}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Limpiar
              </button>
            )}
            <button
              onClick={() => setMinimized(!minimized)}
              className="text-gray-500 hover:text-gray-700"
            >
              {minimized ? '▲' : '▼'}
            </button>
          </div>
        </div>

        {/* Jobs List */}
        {!minimized && (
          <div className="max-h-96 overflow-y-auto">
            {recentJobs.map((job) => (
              <div
                key={job.id}
                className="p-4 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition"
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className="flex-shrink-0 mt-1">
                    {job.status === 'processing' && (
                      <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                    )}
                    {job.status === 'completed' && (
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    )}
                    {job.status === 'error' && (
                      <AlertCircle className="w-5 h-5 text-red-600" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {job.filename}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {job.bancoName}
                        </p>
                      </div>
                      <button
                        onClick={() => removeJob(job.id)}
                        className="flex-shrink-0 text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Status Message */}
                    {job.message && (
                      <p
                        className={`text-xs mt-2 ${
                          job.status === 'completed'
                            ? 'text-green-700'
                            : job.status === 'error'
                            ? 'text-red-700'
                            : 'text-blue-700'
                        }`}
                      >
                        {job.message}
                      </p>
                    )}

                    {/* Progress Bar */}
                    {job.status === 'processing' && (
                      <div className="mt-2">
                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                          <div
                            className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                            style={{ width: `${job.progress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Download Button */}
                    {job.status === 'completed' && job.downloadUrl && (
                      <button
                        onClick={() => handleDownload(job.downloadUrl!)}
                        className="mt-3 w-full bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-green-700 transition flex items-center justify-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        Descargar Excel
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {jobs.length > 5 && (
              <div className="p-3 text-center text-xs text-gray-500 bg-gray-50">
                Mostrando {recentJobs.length} de {jobs.length} trabajos
              </div>
            )}
          </div>
        )}
      </div>

      {/* Summary when minimized */}
      {minimized && processingCount > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-b-xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
            <span className="text-sm text-blue-900 font-medium">
              {processingCount} {processingCount === 1 ? 'archivo procesándose' : 'archivos procesándose'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}



