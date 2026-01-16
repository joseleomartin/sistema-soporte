import { useState } from 'react';
import { X, FolderPlus, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';

interface CreateFolderModalProps {
  type: 'course' | 'document';
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateFolderModal({ type, onClose, onSuccess }: CreateFolderModalProps) {
  const { profile } = useAuth();
  const { tenantId } = useTenant();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    if (!name.trim()) {
      setError('El nombre de la carpeta es requerido');
      return;
    }

    if (!tenantId) {
      setError('No se pudo identificar el tenant. Por favor, recarga la página.');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const { error: insertError } = await supabase
        .from('library_folders')
        .insert({
          name: name.trim(),
          description: description.trim() || null,
          type: type,
          created_by: profile.id,
          tenant_id: tenantId,
        });

      if (insertError) throw insertError;

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error creating folder:', error);
      setError(error.message || 'Error al crear la carpeta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
              <FolderPlus className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Nueva Carpeta
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Nombre de la Carpeta <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
              required
              maxLength={100}
              placeholder={`Ej: ${type === 'course' ? 'Cursos de Contabilidad' : 'Documentos Legales'}`}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Descripción
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
              rows={3}
              maxLength={500}
              placeholder="Descripción opcional de la carpeta..."
            />
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-lg p-3">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Tipo:</strong> {type === 'course' ? 'Cursos' : 'Documentos'}
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
              Esta carpeta solo podrá contener {type === 'course' ? 'cursos' : 'documentos'}.
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="flex-1 px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creando...' : 'Crear Carpeta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}






